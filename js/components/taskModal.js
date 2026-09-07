/**
 * Task Modal Component
 * Create / Edit subtasks with multi-assignee effort calculation and cycle-safe dependency picker
 */
import { ScheduleEngine } from '../engine.js';

export class TaskModal {
  constructor(store, onSave) {
    this.store = store;
    this.onSave = onSave;
    this.currentTaskId = null;
    this.initModal();
  }

  initModal() {
    this.overlay = document.getElementById('taskModalOverlay');
    this.form = document.getElementById('taskForm');
    this.closeBtn = document.getElementById('closeTaskModalBtn');
    this.cancelBtn = document.getElementById('cancelTaskBtn');
    this.deleteBtn = document.getElementById('deleteTaskBtn');
    this.titleEl = document.getElementById('taskModalTitle');

    this.projectSelect = document.getElementById('taskProjectInput');
    this.titleInput = document.getElementById('taskTitleInput');
    this.descInput = document.getElementById('taskDescInput');
    this.assigneesContainer = document.getElementById('taskAssigneesContainer');
    this.assigneesCapacityBadge = document.getElementById('taskAssigneesCapacityBadge');
    this.speedNoteEl = document.getElementById('taskEffortSpeedNote');
    this.workingDaysPreviewEl = document.getElementById('taskWorkingDaysPreview');
    this.dateInput = document.getElementById('taskDateInput');
    this.targetDateInput = document.getElementById('taskTargetDateInput');
    this.hoursInput = document.getElementById('taskHoursInput');
    this.statusSelect = document.getElementById('taskStatusInput');
    this.progressInput = document.getElementById('taskProgressInput');
    this.progressVal = document.getElementById('taskProgressVal');
    this.depsContainer = document.getElementById('taskDependenciesContainer');

    // Event bindings
    this.closeBtn?.addEventListener('click', () => this.close());
    this.cancelBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.progressInput?.addEventListener('input', (e) => {
      if (this.progressVal) this.progressVal.textContent = `${e.target.value}%`;
    });

    this.projectSelect?.addEventListener('change', () => {
      // Re-populate assignees to recalculate their specific effort on the newly selected project
      const currentlyChecked = this.getSelectedResourceIds();
      this.populateAssigneesList(currentlyChecked);
      this.populateDependenciesList([], this.currentTaskId);
      this.updateCapacityPreview();
    });

    this.hoursInput?.addEventListener('input', () => {
      this.updateCapacityPreview();
    });

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.deleteBtn?.addEventListener('click', () => {
      if (this.currentTaskId && confirm('Are you sure you want to delete this subtask?')) {
        this.store.deleteTask(this.currentTaskId);
        this.close();
        if (this.onSave) this.onSave();
      }
    });
  }

  getSelectedResourceIds() {
    if (!this.assigneesContainer) return [];
    const checked = this.assigneesContainer.querySelectorAll('input[name="taskAssigneeCheckbox"]:checked');
    return Array.from(checked).map(cb => cb.value);
  }

  open(taskId = null, defaultProjectId = null) {
    this.currentTaskId = taskId;
    this.populateProjectSelect();

    if (taskId) {
      const task = this.store.getTasks().find(t => t.id === taskId);
      if (!task) return;

      this.titleEl.textContent = 'Edit Subtask';
      if (this.deleteBtn) this.deleteBtn.style.display = 'inline-flex';
      this.projectSelect.value = task.projectId;
      this.titleInput.value = task.title;
      this.descInput.value = task.description || '';
      this.dateInput.value = task.startDate || new Date().toISOString().split('T')[0];
      if (this.targetDateInput) this.targetDateInput.value = task.targetDate || '';
      this.hoursInput.value = task.durationHours || 8;
      this.statusSelect.value = task.status || 'todo';
      this.progressInput.value = task.progress || 0;
      if (this.progressVal) this.progressVal.textContent = `${task.progress || 0}%`;

      const initialAssignees = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
        ? task.assignedResourceIds
        : (task.assignedResourceId ? [task.assignedResourceId] : []);

      this.populateAssigneesList(initialAssignees);
      this.populateDependenciesList(task.dependencies || [], task.id);
    } else {
      this.titleEl.textContent = 'Create New Subtask';
      if (this.deleteBtn) this.deleteBtn.style.display = 'none';
      this.form.reset();
      
      const projects = this.store.getProjects();
      const initialProjId = defaultProjectId && defaultProjectId !== 'all' 
        ? defaultProjectId 
        : (projects[0]?.id || '');
      this.projectSelect.value = initialProjId;
      this.dateInput.value = new Date().toISOString().split('T')[0];
      if (this.targetDateInput) this.targetDateInput.value = '';
      this.hoursInput.value = 16;
      this.progressInput.value = 0;
      if (this.progressVal) this.progressVal.textContent = '0%';

      this.populateAssigneesList([]);
      this.populateDependenciesList([], null);
    }

    this.updateCapacityPreview();
    this.overlay.classList.add('active');
    setTimeout(() => this.titleInput.focus(), 100);
  }

  close() {
    this.overlay.classList.remove('active');
    this.currentTaskId = null;
  }

  populateProjectSelect() {
    const projects = this.store.getProjects();
    this.projectSelect.innerHTML = projects.map(p => `
      <option value="${p.id}">${escapeHtml(p.name)}</option>
    `).join('');
  }

  populateAssigneesList(selectedResourceIds = []) {
    if (!this.assigneesContainer) return;
    const resources = this.store.getResources();
    const projects = this.store.getProjects();
    const tasks = this.store.getTasks();
    const allCalendars = this.store.getAllCalendars();
    const currentProjectId = this.projectSelect.value;

    if (resources.length === 0) {
      this.assigneesContainer.innerHTML = `
        <div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
          No team members added yet.
        </div>
      `;
      return;
    }

    this.assigneesContainer.innerHTML = resources.map(resource => {
      const isChecked = selectedResourceIds.includes(resource.id);
      
      // Calculate this person's effort on current project
      const allocInfo = ScheduleEngine.calculateResourceProjectAllocations(resource, projects, tasks);
      let projectCap = Number(resource.capacityHoursPerDay) || 8;
      let percentLabel = '100%';

      if (allocInfo && allocInfo.allocations.has(currentProjectId)) {
        const pAlloc = allocInfo.allocations.get(currentProjectId);
        if (pAlloc) {
          projectCap = pAlloc.hoursPerDay;
          percentLabel = `${pAlloc.percent}%${pAlloc.isAuto ? ' (auto)' : ''}`;
        }
      }

      const cal = allCalendars.find(c => c.id === resource.calendarId);
      const calName = cal ? cal.name.split(' ')[0] : '🌐';
      const vacCount = Array.isArray(resource.vacations) ? resource.vacations.length : 0;
      const initials = resource.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s ease;" class="assignee-checkbox-row">
          <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1;">
            <input type="checkbox" name="taskAssigneeCheckbox" value="${resource.id}" data-daily-cap="${projectCap}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${resource.avatarColor || '#6366f1'}; color: #fff; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${initials}
            </div>
            <div style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(resource.name)}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 0.3rem;">${escapeHtml(resource.role)}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
            <span class="badge" style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); border: 1px solid rgba(99, 102, 241, 0.3);" title="Project Effort Allocation">
              ${percentLabel} · ${projectCap}h/d
            </span>
            ${vacCount > 0 ? `<span class="badge badge-warning" style="font-size: 0.65rem;" title="${vacCount} vacation days scheduled">🏖️ ${vacCount}d</span>` : ''}
          </div>
        </label>
      `;
    }).join('');

    // Attach change listeners to update preview
    this.assigneesContainer.querySelectorAll('input[name="taskAssigneeCheckbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.updateCapacityPreview());
    });
  }

  updateCapacityPreview() {
    const checkedCheckboxes = this.assigneesContainer?.querySelectorAll('input[name="taskAssigneeCheckbox"]:checked') || [];
    const count = checkedCheckboxes.length;
    const manHours = Math.max(1, Number(this.hoursInput?.value) || 8);

    let totalDailyCap = 0;
    checkedCheckboxes.forEach(cb => {
      totalDailyCap += parseFloat(cb.dataset.dailyCap || 8);
    });
    totalDailyCap = Math.round(totalDailyCap * 10) / 10;

    if (count === 0) {
      if (this.assigneesCapacityBadge) {
        this.assigneesCapacityBadge.textContent = 'Unassigned · 8h/d (Standard)';
        this.assigneesCapacityBadge.className = 'badge';
        this.assigneesCapacityBadge.style.background = 'rgba(148, 163, 184, 0.15)';
        this.assigneesCapacityBadge.style.color = 'var(--text-muted)';
      }
      const days = Math.ceil(manHours / 8);
      if (this.speedNoteEl) {
        this.speedNoteEl.innerHTML = `No one assigned: Burns at baseline <strong>8.0h/day</strong>`;
      }
      if (this.workingDaysPreviewEl) {
        this.workingDaysPreviewEl.textContent = `~${days} working ${days === 1 ? 'day' : 'days'}`;
        this.workingDaysPreviewEl.className = 'badge badge-todo';
      }
    } else {
      if (this.assigneesCapacityBadge) {
        this.assigneesCapacityBadge.textContent = `${count} ${count === 1 ? 'Person' : 'People'} · ${totalDailyCap}h/day Combined`;
        this.assigneesCapacityBadge.className = 'badge badge-done';
        this.assigneesCapacityBadge.style.background = '';
        this.assigneesCapacityBadge.style.color = '';
      }
      const days = totalDailyCap > 0 ? Math.ceil(manHours / totalDailyCap) : Math.ceil(manHours / 8);
      if (this.speedNoteEl) {
        this.speedNoteEl.innerHTML = `Combined speed: <strong>${totalDailyCap}h/day</strong> effort across ${count} ${count === 1 ? 'contributor' : 'contributors'}`;
      }
      if (this.workingDaysPreviewEl) {
        this.workingDaysPreviewEl.textContent = `Finish in ~${days} working ${days === 1 ? 'day' : 'days'}`;
        this.workingDaysPreviewEl.className = 'badge badge-in-progress';
      }
    }
  }

  populateDependenciesList(selectedDepIds = [], currentTaskId = null) {
    const allTasks = this.store.getTasks();
    const currentProjectId = this.projectSelect.value;
    
    // Suggest dependencies primarily from the same project
    const candidateTasks = allTasks.filter(t => t.projectId === currentProjectId && t.id !== currentTaskId);

    if (candidateTasks.length === 0) {
      this.depsContainer.innerHTML = `<div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No other subtasks available to depend on in this project.</div>`;
      return;
    }

    this.depsContainer.innerHTML = candidateTasks.map(task => {
      const isChecked = selectedDepIds.includes(task.id);
      // Check if selecting this would create a cycle
      const causesCycle = currentTaskId ? ScheduleEngine.wouldCreateCycle(allTasks, currentTaskId, task.id) : false;

      return `
        <label class="dependency-checkbox-label ${causesCycle ? 'disabled-dep' : ''}" style="${causesCycle ? 'opacity: 0.45; cursor: not-allowed;' : ''}">
          <input type="checkbox" name="depCheckbox" value="${task.id}" 
            ${isChecked ? 'checked' : ''} 
            ${causesCycle ? 'disabled' : ''}>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(task.title)}
          </span>
          <span class="man-hours-pill">${task.durationHours}h</span>
          ${causesCycle ? '<span style="font-size: 0.68rem; color: #f87171; font-weight:600;">(Cycle Loop)</span>' : ''}
        </label>
      `;
    }).join('');
  }

  handleSubmit() {
    const selectedCheckboxes = this.depsContainer.querySelectorAll('input[name="depCheckbox"]:checked');
    const selectedDependencies = Array.from(selectedCheckboxes).map(cb => cb.value);

    // Multi-assignees collection
    const assignedResourceIds = this.getSelectedResourceIds();

    const taskData = {
      projectId: this.projectSelect.value,
      title: this.titleInput.value.trim(),
      description: this.descInput.value.trim(),
      assignedResourceIds: assignedResourceIds,
      assignedResourceId: assignedResourceIds[0] || null,
      startDate: this.dateInput.value,
      targetDate: this.targetDateInput ? this.targetDateInput.value.trim() : '',
      durationHours: Number(this.hoursInput.value) || 8,
      status: this.statusSelect.value,
      progress: Number(this.progressInput.value) || 0,
      dependencies: selectedDependencies
    };

    if (!taskData.title) {
      alert('Please enter a subtask title');
      return;
    }

    if (this.currentTaskId) {
      this.store.updateTask(this.currentTaskId, taskData);
    } else {
      this.store.addTask(taskData);
    }

    this.close();
    if (this.onSave) this.onSave();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
