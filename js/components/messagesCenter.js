/**
 * Messages & Warnings Center Component
 * Analyzes workspace state for scheduling bottlenecks, resource over-allocations,
 * dependency blockers, unassigned tasks, and critical path warnings.
 */
import { ScheduleEngine } from '../engine.js';

export class MessagesCenter {
  constructor(store, taskModal, resourceModal, switchView) {
    this.store = store;
    this.taskModal = taskModal;
    this.resourceModal = resourceModal;
    this.switchView = switchView;

    this.activeFilter = 'all'; // 'all' | 'warning' | 'critical' | 'info'
    this.messages = [];
    this.initUI();
  }

  initUI() {
    this.openBtn = document.getElementById('btnOpenAlerts');
    this.badge = document.getElementById('alertsCountBadge');
    this.overlay = document.getElementById('messagesDrawerOverlay');
    this.closeBtn = document.getElementById('closeMessagesDrawerBtn');
    this.bodyEl = document.getElementById('messagesDrawerBody');

    this.countAll = document.getElementById('countFilterAll');
    this.countWarning = document.getElementById('countFilterWarning');
    this.countCritical = document.getElementById('countFilterCritical');
    this.countInfo = document.getElementById('countFilterInfo');

    this.openBtn?.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.querySelectorAll('.drawer-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.drawer-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter') || 'all';
        this.renderMessagesList();
      });
    });

    this.update();
  }

  open() {
    this.update();
    this.overlay?.classList.add('active');
  }

  close() {
    this.overlay?.classList.remove('active');
  }

  update() {
    this.messages = this.collectMessages();
    this.updateBadge();
    if (this.overlay?.classList.contains('active')) {
      this.renderMessagesList();
    }
  }

  collectMessages() {
    const list = [];
    const tasks = this.store.getTasks();
    const projects = this.store.getProjects();
    const resources = this.store.getResources();

    const projectMap = new Map(projects.map(p => [p.id, p]));
    const resourceMap = new Map(resources.map(r => [r.id, r]));

    const calendar = this.store.getCalendar();
    const allCalendars = this.store.getAllCalendars();
    const scheduled = ScheduleEngine.computeSchedule(tasks, resources, projects, calendar, allCalendars);
    const taskMap = new Map(scheduled.map(t => [t.id, t]));
    const workloads = ScheduleEngine.calculateResourceWorkload(tasks, resources, projects, calendar, allCalendars);

    // 1. Check for Resource Over-allocations
    workloads.forEach(w => {
      if (w.isOverloaded && (w.hasDailyConflict || w.hasDeadlineMiss || w.hasHorizonOverload)) {
        list.push({
          id: `warn-overload-${w.id}`,
          type: 'warning',
          category: 'Overload',
          icon: '⚠️',
          title: `Resource Over-allocated: ${w.name}`,
          desc: w.overloadReason || `${w.name} has exceeded available capacity (${w.totalAllocatedHours}h allocated).`,
          actionText: 'Adjust Capacity / Member',
          onAction: () => {
            this.close();
            this.resourceModal.open(w.id);
          }
        });
      }

      // Check for effort allocation errors (sum > 100%)
      if (w.projectAllocationInfo && !w.projectAllocationInfo.isValid) {
        list.push({
          id: `warn-effort-${w.id}`,
          type: 'warning',
          category: 'Effort Error',
          icon: '🛑',
          title: `Effort Allocation Error: ${w.name}`,
          desc: w.projectAllocationInfo.error,
          actionText: 'Fix Effort Split',
          onAction: () => {
            this.close();
            this.resourceModal.open(w.id);
          }
        });
      }
    });

    // 2. Check for Dependency Blockers
    scheduled.forEach(t => {
      if (t.status === 'in-progress' && Array.isArray(t.dependencies) && t.dependencies.length > 0) {
        const incompletePrereqs = t.dependencies
          .map(depId => taskMap.get(depId))
          .filter(depTask => depTask && depTask.status !== 'done');

        if (incompletePrereqs.length > 0) {
          const prereqNames = incompletePrereqs.map(pt => `"${pt.title}"`).join(', ');
          const proj = projectMap.get(t.projectId);
          list.push({
            id: `warn-dep-${t.id}`,
            type: 'warning',
            category: 'Prerequisite Blocker',
            icon: '🔗',
            title: `Blocked Dependency: "${t.title}"`,
            desc: `This subtask is marked "In Progress" in [${proj?.name || 'Project'}], but its prerequisite subtask(s) ${prereqNames} are not yet completed!`,
            actionText: 'Inspect Subtask',
            onAction: () => {
              this.close();
              this.taskModal.open(t.id);
            }
          });
        }
      }
    });

    // 3. Check for Unassigned Subtasks
    scheduled.forEach(t => {
      const hasAssignees = (Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.length > 0) || t.assignedResourceId;
      if (!hasAssignees) {
        const proj = projectMap.get(t.projectId);
        list.push({
          id: `warn-unassigned-${t.id}`,
          type: 'warning',
          category: 'Unassigned',
          icon: '👤',
          title: `Unassigned Subtask: "${t.title}"`,
          desc: `Requires ${t.durationHours} man-hours of work in [${proj?.name || 'Project'}], but has no team member assigned to it.`,
          actionText: 'Assign Person',
          onAction: () => {
            this.close();
            this.taskModal.open(t.id);
          }
        });
      }
    });

    // 3b. Check for Target End Date Misses
    scheduled.forEach(t => {
      if (t.targetDate && t.isTargetMissed) {
        const proj = projectMap.get(t.projectId);
        const endFormatted = t.computedEndDate ? ScheduleEngine.toDateKey(t.computedEndDate) : 'unknown';
        list.push({
          id: `warn-target-${t.id}`,
          type: 'warning',
          category: 'Deadline Miss',
          icon: '🎯',
          title: `Target Date Exceeded: "${t.title}"`,
          desc: `Projected to finish on ${endFormatted} in [${proj?.name || 'Project'}], which is ${t.targetDiffDays} day(s) past its target deadline (${t.targetDate}).`,
          actionText: 'Inspect Subtask',
          onAction: () => {
            this.close();
            this.taskModal.open(t.id);
          }
        });
      }
    });

    // 4. Critical Path Bottlenecks
    scheduled.filter(t => t.isCritical).forEach(t => {
      const proj = projectMap.get(t.projectId);
      const ids = Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.length > 0
        ? t.assignedResourceIds
        : (t.assignedResourceId ? [t.assignedResourceId] : []);
      const assigneeNames = ids.map(id => resourceMap.get(id)?.name).filter(Boolean).join(', ') || 'Unassigned';
      list.push({
        id: `crit-${t.id}`,
        type: 'critical',
        category: 'Critical Path',
        icon: '⚡',
        title: `Zero Slack: "${t.title}"`,
        desc: `On the Critical Path for [${proj?.name || 'Project'}]. Any delay to this ${t.durationHours}h subtask (${assigneeNames}) will directly postpone overall project completion.`,
        actionText: 'View in Gantt',
        onAction: () => {
          this.close();
          if (this.switchView) this.switchView('gantt');
          // Highlight tree row
          setTimeout(() => {
            const row = document.getElementById(`tree-row-${t.id}`);
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              row.classList.add('selected');
              setTimeout(() => row.classList.remove('selected'), 2500);
            }
          }, 300);
        }
      });
    });

    // 5. System Notices & Healthy Status
    list.push({
      id: 'info-status-summary',
      type: 'info',
      category: 'System Health',
      icon: '📊',
      title: 'Workspace Health Summary',
      desc: `${projects.length} project(s) active with ${tasks.length} subtask(s) total (${tasks.reduce((s,t)=>s+(Number(t.durationHours)||0),0)} man-hours) and ${resources.length} team members. LocalStorage auto-sync active.`,
      actionText: 'View All Subtasks',
      onAction: () => {
        this.close();
        if (this.switchView) this.switchView('table');
      }
    });

    return list;
  }

  updateBadge() {
    const warnings = this.messages.filter(m => m.type === 'warning');
    const criticals = this.messages.filter(m => m.type === 'critical');
    const totalAlerts = warnings.length + criticals.length;

    if (this.badge) {
      this.badge.textContent = totalAlerts;
      if (totalAlerts > 0) {
        this.badge.style.display = 'inline-flex';
        this.openBtn?.classList.add('has-warnings');
      } else {
        this.badge.style.display = 'none';
        this.openBtn?.classList.remove('has-warnings');
      }
    }

    if (this.countAll) this.countAll.textContent = this.messages.length;
    if (this.countWarning) this.countWarning.textContent = warnings.length;
    if (this.countCritical) this.countCritical.textContent = criticals.length;
    if (this.countInfo) this.countInfo.textContent = this.messages.filter(m => m.type === 'info').length;
  }

  renderMessagesList() {
    if (!this.bodyEl) return;

    let filtered = this.messages;
    if (this.activeFilter !== 'all') {
      filtered = this.messages.filter(m => m.type === this.activeFilter);
    }

    if (filtered.length === 0) {
      this.bodyEl.innerHTML = `
        <div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">✨</div>
          <h3 style="font-size: 1rem; color: var(--text-primary); font-weight: 700;">No messages in this category</h3>
          <p style="font-size: 0.8rem; margin-top: 0.35rem;">Everything in your project schedule is running smoothly.</p>
        </div>
      `;
      return;
    }

    this.bodyEl.innerHTML = filtered.map(item => {
      const typeClass = item.type === 'critical' ? 'alert-critical' : (item.type === 'warning' ? 'alert-warning' : 'alert-info');
      return `
        <div class="alert-card ${typeClass}" data-alert-id="${item.id}">
          <div class="alert-card-top">
            <div class="alert-card-title">
              <span>${item.icon}</span>
              <span>${escapeHtml(item.title)}</span>
            </div>
            <span class="badge ${item.type === 'critical' ? 'badge-critical' : (item.type === 'warning' ? 'badge-blocked' : 'badge-in-progress')}" style="font-size: 0.68rem;">
              ${escapeHtml(item.category)}
            </span>
          </div>

          <div class="alert-card-desc">
            ${escapeHtml(item.desc)}
          </div>

          <div class="alert-card-footer">
            <span class="alert-badge-tag">ChronoGantt Monitor</span>
            ${item.actionText ? `
              <button class="btn btn-secondary btn-sm alert-action-btn" data-alert-id="${item.id}" style="font-size: 0.74rem;">
                ${escapeHtml(item.actionText)} &rarr;
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Bind action buttons
    this.bodyEl.querySelectorAll('.alert-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-alert-id');
        const alertItem = this.messages.find(m => m.id === id);
        if (alertItem && typeof alertItem.onAction === 'function') {
          alertItem.onAction();
        }
      });
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
