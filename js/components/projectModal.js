/**
 * Project Modal Component
 * Add / Edit projects with deadlines, color identities, and descriptions
 */
export class ProjectModal {
  constructor(store, onSave) {
    this.store = store;
    this.onSave = onSave;
    this.currentProjectId = null;
    this.initModal();
  }

  initModal() {
    this.overlay = document.getElementById('projectModalOverlay');
    this.form = document.getElementById('projectForm');
    this.closeBtn = document.getElementById('closeProjectModalBtn');
    this.cancelBtn = document.getElementById('cancelProjectBtn');
    this.deleteBtn = document.getElementById('deleteProjectBtn');
    this.titleEl = document.getElementById('projectModalTitle');

    this.nameInput = document.getElementById('projNameInput');
    this.descInput = document.getElementById('projDescInput');
    this.startDateInput = document.getElementById('projStartDateInput');
    this.targetDateInput = document.getElementById('projTargetDateInput');
    this.colorInput = document.getElementById('projColorInput');
    this.statusSelect = document.getElementById('projStatusInput');

    this.closeBtn?.addEventListener('click', () => this.close());
    this.cancelBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.deleteBtn?.addEventListener('click', () => {
      if (!this.currentProjectId) return;
      const proj = this.store.getProjects().find(p => p.id === this.currentProjectId);
      if (!proj) return;

      const tasksCount = this.store.getTasks().filter(t => t.projectId === this.currentProjectId).length;
      const msg = `Are you sure you want to delete project "${proj.name}"?\n\nThis will also remove all ${tasksCount} associated subtask(s). This action cannot be undone.`;

      if (confirm(msg)) {
        this.store.deleteProject(this.currentProjectId);
        this.close();
        if (this.onSave) this.onSave();
      }
    });
  }

  open(projectId = null) {
    this.currentProjectId = projectId;

    if (projectId) {
      const proj = this.store.getProjects().find(p => p.id === projectId);
      if (!proj) return;

      this.titleEl.textContent = 'Edit Project';
      if (this.deleteBtn) this.deleteBtn.style.display = 'inline-flex';
      this.nameInput.value = proj.name;
      this.descInput.value = proj.description || '';
      this.startDateInput.value = proj.startDate || '';
      this.targetDateInput.value = proj.targetDate || '';
      this.colorInput.value = proj.color || '#6366f1';
      this.statusSelect.value = proj.status || 'active';
    } else {
      this.titleEl.textContent = 'Create New Project';
      if (this.deleteBtn) this.deleteBtn.style.display = 'none';
      this.form.reset();
      this.startDateInput.value = new Date().toISOString().split('T')[0];
      const target = new Date();
      target.setDate(target.getDate() + 30);
      this.targetDateInput.value = target.toISOString().split('T')[0];
      const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
      this.colorInput.value = colors[Math.floor(Math.random() * colors.length)];
      this.statusSelect.value = 'active';
    }

    this.overlay.classList.add('active');
    setTimeout(() => this.nameInput.focus(), 100);
  }

  close() {
    this.overlay.classList.remove('active');
    this.currentProjectId = null;
  }

  handleSubmit() {
    const projData = {
      name: this.nameInput.value.trim(),
      description: this.descInput.value.trim(),
      startDate: this.startDateInput.value,
      targetDate: this.targetDateInput.value,
      color: this.colorInput.value,
      status: this.statusSelect.value
    };

    if (!projData.name) {
      alert('Please enter a project name.');
      return;
    }

    if (this.currentProjectId) {
      this.store.updateProject(this.currentProjectId, projData);
    } else {
      this.store.addProject(projData);
    }

    this.close();
    if (this.onSave) this.onSave();
  }
}
