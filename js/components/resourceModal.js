/**
 * Resource Modal Component
 * Add / Edit team members (people), roles, daily capacity, hourly rate,
 * local calendar profile, individual vacations, and project effort allocation.
 */
import { ScheduleEngine } from '../engine.js';

export class ResourceModal {
  constructor(store, onSave) {
    this.store = store;
    this.onSave = onSave;
    this.currentResourceId = null;
    this.currentVacations = [];
    this.initModal();
  }

  initModal() {
    this.overlay = document.getElementById('resourceModalOverlay');
    this.form = document.getElementById('resourceForm');
    this.closeBtn = document.getElementById('closeResourceModalBtn');
    this.cancelBtn = document.getElementById('cancelResourceBtn');
    this.deleteBtn = document.getElementById('deleteResourceBtn');
    this.titleEl = document.getElementById('resourceModalTitle');

    this.nameInput = document.getElementById('resNameInput');
    this.roleInput = document.getElementById('resRoleInput');
    this.emailInput = document.getElementById('resEmailInput');
    this.capacityInput = document.getElementById('resCapacityInput');
    this.rateInput = document.getElementById('resRateInput');
    this.colorInput = document.getElementById('resColorInput');
    this.calendarSelect = document.getElementById('resCalendarSelect');

    // Vacations elements
    this.vacationsList = document.getElementById('resVacationsList');
    this.vacationsCountBadge = document.getElementById('resVacationsCountBadge');
    this.newVacationDate = document.getElementById('resNewVacationDate');
    this.newVacationName = document.getElementById('resNewVacationName');
    this.addVacationBtn = document.getElementById('resAddVacationBtn');

    // Effort allocation elements
    this.effortList = document.getElementById('resProjectEffortList');
    this.errorBanner = document.getElementById('resEffortErrorBanner');
    this.summaryBadge = document.getElementById('resEffortSummaryBadge');

    this.closeBtn?.addEventListener('click', () => this.close());
    this.cancelBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.capacityInput?.addEventListener('input', () => {
      this.recalculateEffortDistribution();
    });

    this.addVacationBtn?.addEventListener('click', () => {
      const dateVal = this.newVacationDate?.value;
      const nameVal = this.newVacationName?.value ? this.newVacationName.value.trim() : '';
      if (dateVal) {
        if (!this.currentVacations.some(v => v.date === dateVal)) {
          this.currentVacations.push({ date: dateVal, name: nameVal });
          this.currentVacations.sort((a, b) => a.date.localeCompare(b.date));
          this.renderVacationsList();
          if (this.newVacationName) this.newVacationName.value = '';
        } else {
          alert('This vacation date is already added.');
        }
      } else {
        alert('Please pick a vacation date.');
      }
    });

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.deleteBtn?.addEventListener('click', () => {
      if (this.currentResourceId && confirm('Are you sure you want to delete this resource? Any assigned subtasks will become unassigned.')) {
        this.store.deleteResource(this.currentResourceId);
        this.close();
        if (this.onSave) this.onSave();
      }
    });
  }

  open(resourceId = null) {
    this.currentResourceId = resourceId;
    const projects = this.store.getProjects();
    const tasks = this.store.getTasks();
    const allCalendars = this.store.getAllCalendars();

    if (this.calendarSelect) {
      this.calendarSelect.innerHTML = allCalendars.map(c => `
        <option value="${c.id}">${escapeHtml(c.name)}</option>
      `).join('');
    }

    if (this.newVacationDate) {
      this.newVacationDate.value = new Date().toISOString().split('T')[0];
    }
    if (this.newVacationName) {
      this.newVacationName.value = '';
    }

    if (resourceId) {
      const res = this.store.getResources().find(r => r.id === resourceId);
      if (!res) return;

      this.titleEl.textContent = 'Edit Team Resource';
      if (this.deleteBtn) this.deleteBtn.style.display = 'inline-flex';
      this.nameInput.value = res.name;
      this.roleInput.value = res.role || '';
      this.emailInput.value = res.email || '';
      this.capacityInput.value = res.capacityHoursPerDay || 8;
      this.rateInput.value = res.hourlyRate || 80;
      this.colorInput.value = res.avatarColor || '#6366f1';
      if (this.calendarSelect) {
        this.calendarSelect.value = res.calendarId || this.store.state.activeCalendarId;
      }

      this.currentVacations = Array.isArray(res.vacations) ? JSON.parse(JSON.stringify(res.vacations)) : [];
      this.renderVacationsList();
      this.renderProjectEffortRows(res, projects, tasks);
    } else {
      this.titleEl.textContent = 'Add Team Member';
      if (this.deleteBtn) this.deleteBtn.style.display = 'none';
      this.form.reset();
      this.capacityInput.value = 8;
      this.rateInput.value = 90;
      const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
      this.colorInput.value = colors[Math.floor(Math.random() * colors.length)];
      if (this.calendarSelect) {
        this.calendarSelect.value = this.store.state.activeCalendarId;
      }

      this.currentVacations = [];
      this.renderVacationsList();

      const tempRes = {
        id: 'res-temp',
        capacityHoursPerDay: 8,
        projectEffort: {},
        assignedProjectIds: projects.map(p => p.id)
      };
      this.renderProjectEffortRows(tempRes, projects, tasks);
    }

    this.overlay.classList.add('active');
    setTimeout(() => this.nameInput.focus(), 100);
  }

  close() {
    this.overlay.classList.remove('active');
    this.currentResourceId = null;
    this.currentVacations = [];
  }

  renderVacationsList() {
    if (!this.vacationsList) return;

    if (this.vacationsCountBadge) {
      this.vacationsCountBadge.textContent = `${this.currentVacations.length} Day${this.currentVacations.length === 1 ? '' : 's'}`;
    }

    if (this.currentVacations.length === 0) {
      this.vacationsList.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; padding: 0.35rem 0.2rem;">
          No personal vacation days configured for this person.
        </div>
      `;
      return;
    }

    this.vacationsList.innerHTML = this.currentVacations.map((v, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.6rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.78rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
          <span class="badge badge-critical" style="font-size: 0.68rem; font-family: var(--font-mono);">
            ${v.date}
          </span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${v.name ? 'var(--text-primary)' : 'var(--text-muted)'};">
            ${escapeHtml(v.name || 'Personal Vacation')}
          </span>
        </div>
        <button type="button" class="btn-ghost btn-sm remove-vacation-btn" data-idx="${idx}" style="color: #f87171; padding: 0.15rem 0.35rem; font-size: 0.75rem;" title="Remove vacation">
          ✕
        </button>
      </div>
    `).join('');

    this.vacationsList.querySelectorAll('.remove-vacation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) {
          this.currentVacations.splice(idx, 1);
          this.renderVacationsList();
        }
      });
    });
  }

  renderProjectEffortRows(resource, allProjects, allTasks) {
    if (!this.effortList) return;

    const assignedSet = new Set(resource.assignedProjectIds || []);
    allTasks.forEach(t => {
      const isAssigned = (Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.includes(resource.id)) ||
        t.assignedResourceId === resource.id;
      if (isAssigned && t.projectId) {
        assignedSet.add(t.projectId);
      }
    });

    if (allProjects.length === 0) {
      this.effortList.innerHTML = `
        <div style="padding: 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          No projects created yet. Create a project first to assign effort allocations.
        </div>
      `;
      return;
    }

    this.effortList.innerHTML = allProjects.map(proj => {
      const isAssigned = assignedSet.has(proj.id);
      const effortVal = resource.projectEffort && resource.projectEffort[proj.id] !== undefined
        ? resource.projectEffort[proj.id]
        : '';

      return `
        <div class="effort-row" data-proj-id="${proj.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
            <input type="checkbox" class="effort-proj-checkbox" data-proj-id="${proj.id}" ${isAssigned ? 'checked' : ''} style="accent-color: var(--primary);">
            <span class="project-color-dot" style="background: ${proj.color || '#6366f1'}; flex-shrink: 0;"></span>
            <span style="font-size: 0.82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(proj.name)}">
              ${escapeHtml(proj.name)}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <input type="number" class="form-input effort-num-input" data-proj-id="${proj.id}" 
                     min="0" max="100" step="5" placeholder="Auto" 
                     value="${effortVal !== '' ? effortVal : ''}"
                     style="width: 75px; padding: 0.3rem 0.4rem; font-size: 0.82rem; text-align: right;"
                     ${!isAssigned ? 'disabled' : ''}>
              <span style="font-size: 0.8rem; color: var(--text-muted);">%</span>
            </div>
            <span class="badge effort-result-badge" data-proj-id="${proj.id}" style="min-width: 90px; font-size: 0.7rem; justify-content: center;">
              --
            </span>
          </div>
        </div>
      `;
    }).join('');

    this.effortList.querySelectorAll('.effort-proj-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const projId = e.target.getAttribute('data-proj-id');
        const numInput = this.effortList.querySelector(`.effort-num-input[data-proj-id="${projId}"]`);
        if (numInput) {
          numInput.disabled = !e.target.checked;
          if (!e.target.checked) numInput.value = '';
        }
        this.recalculateEffortDistribution();
      });
    });

    this.effortList.querySelectorAll('.effort-num-input').forEach(inp => {
      inp.addEventListener('input', () => {
        this.recalculateEffortDistribution();
      });
    });

    this.recalculateEffortDistribution();
  }

  recalculateEffortDistribution() {
    const projects = this.store.getProjects();
    const tasks = this.store.getTasks();

    const tempEffort = {};
    const tempAssigned = [];

    this.effortList.querySelectorAll('.effort-proj-checkbox').forEach(cb => {
      const projId = cb.getAttribute('data-proj-id');
      if (cb.checked) {
        tempAssigned.push(projId);
        const numInput = this.effortList.querySelector(`.effort-num-input[data-proj-id="${projId}"]`);
        if (numInput && numInput.value.trim() !== '') {
          tempEffort[projId] = Number(numInput.value);
        }
      }
    });

    const tempRes = {
      id: this.currentResourceId || 'temp',
      capacityHoursPerDay: Number(this.capacityInput.value) || 8,
      projectEffort: tempEffort,
      assignedProjectIds: tempAssigned
    };

    const allocInfo = ScheduleEngine.calculateResourceProjectAllocations(tempRes, projects, tasks);

    if (this.summaryBadge) {
      if (!allocInfo.isValid) {
        this.summaryBadge.className = 'badge badge-critical';
        this.summaryBadge.textContent = `${allocInfo.totalExplicit}% (Exceeds 100%!)`;
      } else {
        this.summaryBadge.className = 'badge badge-done';
        this.summaryBadge.textContent = `${allocInfo.totalExplicit}% Explicit (${allocInfo.remaining}% Auto)`;
      }
    }

    if (this.errorBanner) {
      if (!allocInfo.isValid) {
        this.errorBanner.style.display = 'block';
        this.errorBanner.textContent = `⚠️ Error: ${allocInfo.error}`;
      } else {
        this.errorBanner.style.display = 'none';
      }
    }

    this.effortList.querySelectorAll('.effort-proj-checkbox').forEach(cb => {
      const projId = cb.getAttribute('data-proj-id');
      const badge = this.effortList.querySelector(`.effort-result-badge[data-proj-id="${projId}"]`);
      const numInput = this.effortList.querySelector(`.effort-num-input[data-proj-id="${projId}"]`);

      if (!cb.checked) {
        if (badge) {
          badge.className = 'badge badge-todo';
          badge.textContent = 'Not assigned';
        }
        return;
      }

      const alloc = allocInfo.allocations.get(projId);
      if (alloc && badge) {
        if (!alloc.isAuto) {
          badge.className = 'badge badge-in-progress';
          badge.textContent = `${alloc.percent}% (${alloc.hoursPerDay}h/d)`;
          if (numInput) numInput.style.borderColor = !allocInfo.isValid ? 'var(--danger)' : '';
        } else {
          badge.className = 'badge badge-review';
          badge.textContent = `Auto: ${alloc.percent}% (${alloc.hoursPerDay}h/d)`;
          if (numInput) numInput.style.borderColor = '';
        }
      }
    });

    return allocInfo;
  }

  handleSubmit() {
    const allocInfo = this.recalculateEffortDistribution();

    if (allocInfo && !allocInfo.isValid) {
      alert(`Cannot save resource:\n${allocInfo.error}\n\nPlease adjust the project effort percentages so their sum does not exceed 100%.`);
      return;
    }

    const projectEffort = {};
    const assignedProjectIds = [];

    this.effortList.querySelectorAll('.effort-proj-checkbox').forEach(cb => {
      const projId = cb.getAttribute('data-proj-id');
      if (cb.checked) {
        assignedProjectIds.push(projId);
        const numInput = this.effortList.querySelector(`.effort-num-input[data-proj-id="${projId}"]`);
        if (numInput && numInput.value.trim() !== '') {
          projectEffort[projId] = Math.max(0, Math.min(100, Number(numInput.value)));
        }
      }
    });

    const resData = {
      name: this.nameInput.value.trim(),
      role: this.roleInput.value.trim(),
      email: this.emailInput.value.trim(),
      capacityHoursPerDay: Number(this.capacityInput.value) || 8,
      hourlyRate: Number(this.rateInput.value) || 0,
      avatarColor: this.colorInput.value,
      calendarId: this.calendarSelect ? this.calendarSelect.value : (this.store.state.activeCalendarId || 'cal-it-national'),
      vacations: this.currentVacations,
      projectEffort,
      assignedProjectIds
    };

    if (!resData.name) {
      alert('Please enter a name for this person.');
      return;
    }

    if (this.currentResourceId) {
      this.store.updateResource(this.currentResourceId, resData);
    } else {
      this.store.addResource(resData);
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
