/**
 * Resource Capacity & Workload Matrix View
 * Visualizes people, assigned man-hours vs daily/sprint capacity, over-allocation alerts
 */
import { ScheduleEngine } from '../engine.js';

export class WorkloadView {
  constructor(container, store, onEditResource, onEditTask) {
    this.container = container;
    this.store = store;
    this.onEditResource = onEditResource;
    this.onEditTask = onEditTask;
  }

  render() {
    const tasks = this.store.getTasks();
    const resources = this.store.getResources();
    const projects = this.store.getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const calendar = this.store.getCalendar();
    const allCalendars = this.store.getAllCalendars();
    const workloads = ScheduleEngine.calculateResourceWorkload(tasks, resources, projects, calendar, allCalendars);

    // Summary KPIs
    const totalManHours = workloads.reduce((sum, w) => sum + w.totalAllocatedHours, 0);
    const totalCapacity = workloads.reduce((sum, w) => sum + (w.horizonCapacityHours || w.sprintCapacityHours), 0);
    const overallUtil = totalCapacity > 0 ? Math.round((totalManHours / totalCapacity) * 100) : 0;
    const overloadedCount = workloads.filter(w => w.isOverloaded).length;

    this.container.innerHTML = `
      <div class="workload-wrapper">
        <!-- Resource KPI Banner -->
        <div style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); display: grid; gap: 1rem;">
          <div class="kpi-card">
            <div class="kpi-icon indigo">👥</div>
            <div class="kpi-info">
              <span class="kpi-label">Team Members</span>
              <span class="kpi-value">${resources.length}</span>
              <span class="kpi-sub">Active resources</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon cyan">⏱</div>
            <div class="kpi-info">
              <span class="kpi-label">Total Allocated</span>
              <span class="kpi-value">${totalManHours}h</span>
              <span class="kpi-sub">Across all projects</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon emerald">⚡</div>
            <div class="kpi-info">
              <span class="kpi-label">Total Capacity</span>
              <span class="kpi-value">${totalCapacity}h</span>
              <span class="kpi-sub">Project timeline available</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon ${overloadedCount > 0 ? 'rose' : 'amber'}">📊</div>
            <div class="kpi-info">
              <span class="kpi-label">Team Utilization</span>
              <span class="kpi-value">${overallUtil}%</span>
              <span class="kpi-sub">${overloadedCount > 0 ? `${overloadedCount} person overloaded!` : 'Optimal balance'}</span>
            </div>
          </div>
        </div>

        <!-- Resources Workload Grid -->
        <div class="workload-grid">
          ${workloads.map(res => {
            const userResource = resources.find(r => r.id === res.id);
            const calId = userResource?.calendarId;
            const cal = allCalendars.find(c => c.id === calId);
            const calName = cal ? cal.name : 'Standard Calendar';
            const vacationsCount = userResource?.vacations ? userResource.vacations.length : 0;
            const utilClass = res.isOverloaded ? 'overload' : (res.utilization > 75 ? 'optimal' : 'under');
            const allocMap = res.projectAllocationInfo?.allocations || new Map();
            const allocList = Array.from(allocMap.values());

            return `
              <div class="resource-card" data-resource-id="${res.id}">
                <div class="resource-card-header">
                  <div class="resource-profile">
                    <div class="resource-avatar-large" style="background: ${res.avatarColor};">
                      ${res.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div class="resource-meta">
                      <span class="resource-name">${escapeHtml(res.name)}</span>
                      <span class="resource-role">${escapeHtml(res.role)}</span>
                      <div style="display: flex; align-items: center; gap: 0.35rem; margin-top: 0.3rem; flex-wrap: wrap;">
                        <span class="badge badge-done" style="font-size: 0.65rem; padding: 0.15rem 0.45rem;" title="Assigned Local Calendar">
                          📅 ${escapeHtml(calName)}
                        </span>
                        ${vacationsCount > 0 ? `
                          <span class="badge badge-critical" style="font-size: 0.65rem; padding: 0.15rem 0.45rem;" title="${vacationsCount} personal vacation day(s) configured">
                            🏖️ ${vacationsCount} vacation day${vacationsCount > 1 ? 's' : ''}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm edit-resource-btn" data-res-id="${res.id}">
                    Edit
                  </button>
                </div>

                <!-- Metrics Grid -->
                <div class="resource-util-metrics">
                  <div class="util-metric-item">
                    <span class="util-metric-val">${res.totalAllocatedHours}h</span>
                    <span class="util-metric-lbl">Allocated</span>
                  </div>
                  <div class="util-metric-item">
                    <span class="util-metric-val">${res.horizonCapacityHours || res.sprintCapacityHours}h</span>
                    <span class="util-metric-lbl">${res.horizonWorkingDays || 10} Work Days</span>
                  </div>
                  <div class="util-metric-item">
                    <span class="util-metric-val" style="color: ${res.isOverloaded ? '#f87171' : (res.utilization > 75 ? 'var(--primary)' : '#34d399')};">
                      ${res.utilization}%
                    </span>
                    <span class="util-metric-lbl">Load</span>
                  </div>
                </div>

                <!-- Capacity Progress Bar -->
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.35rem;">
                    <span>Project Horizon Load (${res.capacityHoursPerDay}h/day standard)</span>
                    <span style="font-weight: 600; color: var(--text-primary);">${res.totalAllocatedHours} / ${res.horizonCapacityHours || res.sprintCapacityHours} man-hrs (${res.utilization}%)</span>
                  </div>
                  <div class="workload-progress-track">
                    <div class="workload-progress-fill ${utilClass}" style="width: ${Math.min(100, res.utilization)}%;"></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-muted); margin-top: 0.25rem;">
                    <span>Sprint window: ${res.sprintAllocatedHours || 0}h / ${res.sprintCapacityHours}h (${res.sprintUtilization || 0}%)</span>
                    <span>Peak daily rate: ${res.peakDailyHours || 0}h/d</span>
                  </div>
                  ${res.isOverloaded ? `
                    <div style="margin-top: 0.35rem; font-size: 0.72rem; color: #f87171; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;">
                      ⚠️ ${escapeHtml(res.overloadReason || 'Over-allocated!')}
                    </div>
                  ` : ''}
                </div>

                <!-- Project Effort Allocation Pills -->
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">
                    Project Effort Allocation (% Time)
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
                    ${allocList.length > 0 ? allocList.map(a => `
                      <span class="badge ${a.isAuto ? 'badge-review' : 'badge-in-progress'}" 
                            style="font-size: 0.72rem; padding: 0.2rem 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem;"
                            title="${a.projectName}: ${a.percent}% effort (${a.hoursPerDay}h/day capacity). ${a.isAuto ? 'Auto-split from remaining time' : 'Explicitly specified'}">
                        <span class="project-color-dot" style="background: ${a.projectColor || '#6366f1'}; width: 7px; height: 7px;"></span>
                        <span>${escapeHtml(a.projectName)}:</span>
                        <strong style="font-family: var(--font-mono);">${a.percent}%</strong>
                        <span style="opacity: 0.75; font-size: 0.65rem;">(${a.hoursPerDay}h/d${a.isAuto ? ' · auto' : ''})</span>
                      </span>
                    `).join('') : `
                      <span style="font-size: 0.74rem; color: var(--text-muted); font-style: italic;">All capacity allocated to assigned tasks</span>
                    `}
                  </div>
                </div>

                <!-- Assigned Subtasks -->
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">
                    Assigned Subtasks (${res.assignedTasks.length})
                  </div>
                  <div class="assigned-tasks-list">
                    ${res.assignedTasks.length > 0 ? res.assignedTasks.map(t => {
                      const proj = projectMap.get(t.projectId);
                      return `
                        <div class="assigned-task-chip task-click-chip" data-task-id="${t.id}" style="cursor: pointer;">
                          <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                            <span class="project-color-dot" style="background: ${proj?.color || '#6366f1'};"></span>
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
                              ${escapeHtml(t.title)}
                            </span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span class="man-hours-pill">${t.durationHours}h</span>
                            <span class="badge badge-${t.status || 'todo'}" style="font-size: 0.65rem;">${t.status || 'todo'}</span>
                          </div>
                        </div>
                      `;
                    }).join('') : `
                      <div style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 0.4rem;">
                        No subtasks currently assigned.
                      </div>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind edit resource buttons
    this.container.querySelectorAll('.edit-resource-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resId = btn.getAttribute('data-res-id');
        if (resId && this.onEditResource) {
          this.onEditResource(resId);
        }
      });
    });

    // Bind subtask click to open task editor
    this.container.querySelectorAll('.task-click-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const taskId = chip.getAttribute('data-task-id');
        if (taskId && this.onEditTask) {
          this.onEditTask(taskId);
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
