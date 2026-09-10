/**
 * Projects & Subtasks Table View
 * Detailed tabular view with full metadata, search, sorting, and inline actions
 */
import { ScheduleEngine } from '../engine.js';

export class ProjectListView {
  constructor(container, store, onEditTask, onEditProject) {
    this.container = container;
    this.store = store;
    this.onEditTask = onEditTask;
    this.onEditProject = onEditProject;
  }

  render() {
    const rawTasks = this.store.getFilteredTasks();
    const resources = this.store.getResources();
    const projects = this.store.getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const resourceMap = new Map(resources.map(r => [r.id, r]));

    const calendar = this.store.getCalendar();
    const allCalendars = this.store.getAllCalendars();
    const scheduledTasks = ScheduleEngine.computeSchedule(rawTasks, resources, projects, calendar, allCalendars);
    const taskMap = new Map(scheduledTasks.map(t => [t.id, t]));

    const activeProjId = this.store.state.selectedProjectId;
    const activeProject = activeProjId && activeProjId !== 'all' ? projectMap.get(activeProjId) : null;

    this.container.innerHTML = `
      <div class="table-view-wrapper">
        ${activeProject ? `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.15rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
              <span class="project-color-dot" style="background: ${activeProject.color || '#6366f1'}; width: 14px; height: 14px;"></span>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0; color: var(--text-primary);">${escapeHtml(activeProject.name)}</h3>
                  <span class="badge badge-done" style="font-size: 0.68rem; text-transform: uppercase;">${escapeHtml(activeProject.status || 'Active')}</span>
                </div>
                ${activeProject.description ? `
                  <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">${escapeHtml(activeProject.description)}</p>
                ` : ''}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="editActiveProjBtn">
                ✏️ Edit Project
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="deleteActiveProjBtn" style="color: #f87171; border-color: rgba(239, 68, 68, 0.3);">
                🗑️ Delete Project
              </button>
            </div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700;">
              ${activeProject ? `Subtasks in ${escapeHtml(activeProject.name)}` : 'All Subtasks & Effort Matrix'}
            </h3>
            <span style="font-size: 0.78rem; color: var(--text-muted);">
              Showing ${scheduledTasks.length} subtasks with scheduled start dates and durations
            </span>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Subtask Title</th>
              <th>Project</th>
              <th>Assignee</th>
              <th>Start Point</th>
              <th>Target Date</th>
              <th>Effort (Hours)</th>
              <th>Prerequisites</th>
              <th>Status</th>
              <th>Progress</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${scheduledTasks.length > 0 ? scheduledTasks.map((task, idx) => {
              const proj = projectMap.get(task.projectId);
              const res = resourceMap.get(task.assignedResourceId);

              const depNames = (task.dependencies || []).map(depId => {
                const depTask = taskMap.get(depId);
                return depTask ? depTask.title : depId;
              });

              return `
                <tr data-task-id="${task.id}">
                  <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.78rem;">
                    ${idx + 1}
                  </td>
                  <td>
                    <div style="font-weight: 600; color: var(--text-primary);">
                      ${escapeHtml(task.title)}
                      ${task.isCritical ? '<span class="badge badge-critical" style="margin-left: 0.4rem; font-size: 0.65rem;">⚡ Critical</span>' : ''}
                    </div>
                    ${task.description ? `<div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(task.description)}</div>` : ''}
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;">
                      <div style="display: flex; align-items: center; gap: 0.4rem; min-width: 0;">
                        <span class="project-color-dot" style="background: ${proj?.color || '#6366f1'};"></span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(proj?.name || 'Unknown')}</span>
                      </div>
                      ${proj ? `
                        <button type="button" class="btn-ghost edit-table-proj-btn" data-proj-id="${proj.id}" title="Edit / Remove Project" style="padding: 2px 4px; font-size: 0.72rem; color: var(--text-muted); cursor: pointer;">
                          ⚙️
                        </button>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    ${(() => {
                      const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
                        ? task.assignedResourceIds
                        : (task.assignedResourceId ? [task.assignedResourceId] : []);
                      const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);
                      if (assignees.length === 0) {
                        return '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';
                      }
                      return `
                        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                            ${assignees.map(r => `
                              <span class="avatar-pill" style="background: ${r.avatarColor}; width: 22px; height: 22px; font-size: 0.65rem;" title="${escapeHtml(r.name)} (${escapeHtml(r.role)})">
                                ${r.name.split(' ').map(n=>n[0]).join('')}
                              </span>
                            `).join('')}
                            <span style="font-size: 0.78rem; font-weight: 500;">
                              ${assignees.map(r => escapeHtml(r.name.split(' ')[0])).join(', ')}
                            </span>
                          </div>
                          ${assignees.length > 1 ? `
                            <span style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 600;">
                              ⚡ ${task.effectiveDailyCapacity || 8}h/day combined
                            </span>
                          ` : ''}
                        </div>
                      `;
                    })()}
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                    ${task.computedStartDate ? task.computedStartDate.toLocaleDateString() : task.startDate}
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                    ${task.targetDate ? `
                      <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                        <span style="${task.isTargetMissed ? 'color: #f87171; font-weight: 600;' : 'color: var(--text-secondary);'}">
                          🎯 ${task.targetDate}
                        </span>
                        ${task.isTargetMissed ? `
                          <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.65rem; padding: 1px 4px;" title="Projected finish is ${task.targetDiffDays}d late">
                            +${task.targetDiffDays}d ⚠️
                          </span>
                        ` : ''}
                      </div>
                    ` : '<span style="color: var(--text-muted); font-style: italic; font-size: 0.75rem;">None</span>'}
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                      <span class="man-hours-pill">
                        ⏱ ${task.durationHours} Man-Hours
                      </span>
                      ${task.dailyBurnHours ? `
                        <span style="font-size: 0.7rem; color: #fbbf24; font-weight: 600;">
                          ⚡ ${task.dailyBurnHours}h/day pace
                        </span>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    ${depNames.length > 0 ? `
                      <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${depNames.map(dn => `
                          <span class="dep-indicator" title="Prerequisite">🔗 ${escapeHtml(dn)}</span>
                        `).join('')}
                      </div>
                    ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>'}
                  </td>
                  <td>
                    <span class="badge badge-${task.status || 'todo'}">
                      ${task.status || 'todo'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <div style="width: 50px; height: 6px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${task.progress || 0}%; height: 100%; background: var(--primary);"></div>
                      </div>
                      <span style="font-size: 0.75rem; font-family: var(--font-mono);">${task.progress || 0}%</span>
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm edit-table-task-btn" data-task-id="${task.id}">
                      Edit
                    </button>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                  No subtasks found matching your filters.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;

    // Bind Edit Task buttons
    this.container.querySelectorAll('.edit-table-task-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const taskId = btn.getAttribute('data-task-id');
        if (taskId && this.onEditTask) {
          this.onEditTask(taskId);
        }
      });
    });

    // Bind Edit Project buttons from table rows
    this.container.querySelectorAll('.edit-table-proj-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projId = btn.getAttribute('data-proj-id');
        if (projId && this.onEditProject) {
          this.onEditProject(projId);
        }
      });
    });

    // Bind Active Project Edit button
    this.container.querySelector('#editActiveProjBtn')?.addEventListener('click', () => {
      if (activeProject && this.onEditProject) {
        this.onEditProject(activeProject.id);
      }
    });

    // Bind Active Project Delete button
    this.container.querySelector('#deleteActiveProjBtn')?.addEventListener('click', () => {
      if (!activeProject) return;
      const tasksCount = this.store.getTasks().filter(t => t.projectId === activeProject.id).length;
      const msg = `Are you sure you want to delete project "${activeProject.name}"?\n\nThis will permanently remove the project and all ${tasksCount} associated subtask(s). This action cannot be undone.`;

      if (confirm(msg)) {
        this.store.deleteProject(activeProject.id);
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
