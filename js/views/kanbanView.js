/**
 * Kanban Board View
 * Drag and drop subtasks across statuses (To Do, In Progress, Blocked, Done)
 * Dependency status warnings
 */
import { ScheduleEngine } from '../engine.js';

export class KanbanView {
  constructor(container, store, onEditTask) {
    this.container = container;
    this.store = store;
    this.onEditTask = onEditTask;
    this.columns = [
      { id: 'todo', title: 'To Do', badgeClass: 'badge-todo' },
      { id: 'in-progress', title: 'In Progress', badgeClass: 'badge-in-progress' },
      { id: 'blocked', title: 'Blocked / Review', badgeClass: 'badge-blocked' },
      { id: 'done', title: 'Completed', badgeClass: 'badge-done' }
    ];
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

    this.container.innerHTML = `
      <div class="kanban-board-wrapper">
        ${this.columns.map(col => {
          const colTasks = scheduledTasks.filter(t => (t.status || 'todo') === col.id);
          return `
            <div class="kanban-column" data-status="${col.id}">
              <div class="kanban-column-header">
                <div class="kanban-column-title">
                  <span>${col.title}</span>
                  <span class="kanban-column-badge">${colTasks.length}</span>
                </div>
              </div>
              <div class="kanban-column-body" data-status="${col.id}">
                ${colTasks.map(task => {
                  const proj = projectMap.get(task.projectId);
                  const res = resourceMap.get(task.assignedResourceId);
                  
                  // Check if any prerequisite is not completed
                  const hasIncompleteDeps = Array.isArray(task.dependencies) && task.dependencies.some(depId => {
                    const depTask = taskMap.get(depId);
                    return depTask && depTask.status !== 'done';
                  });

                  return `
                    <div class="kanban-card ${task.isCritical ? 'critical-task' : ''}" 
                         draggable="true" 
                         data-task-id="${task.id}">
                      <div class="kanban-card-project-pill">
                        <span class="project-color-dot" style="background: ${proj?.color || '#6366f1'};"></span>
                        <span>${escapeHtml(proj?.name || 'Project')}</span>
                        ${task.isCritical ? '<span class="badge badge-critical" style="margin-left: auto; font-size: 0.65rem;">Critical</span>' : ''}
                      </div>

                      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
                      
                      ${task.description ? `
                        <div class="kanban-card-desc">${escapeHtml(task.description)}</div>
                      ` : ''}

                      <div class="kanban-card-tags">
                        <span class="man-hours-pill" title="Work effort duration">
                          ⏱ ${task.durationHours} Man-Hours
                        </span>
                        ${task.targetDate ? `
                          <span class="man-hours-pill" 
                                style="${task.isTargetMissed ? 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35);' : 'background: rgba(16, 185, 129, 0.12); color: #34d399;'}"
                                title="${task.isTargetMissed ? `Target deadline exceeded by ${task.targetDiffDays} day(s)!` : 'Target deadline'}">
                            🎯 ${task.targetDate} ${task.isTargetMissed ? '⚠️' : ''}
                          </span>
                        ` : ''}
                        ${task.dependencies && task.dependencies.length > 0 ? `
                          <span class="dep-indicator ${hasIncompleteDeps ? 'dep-warning' : ''}" 
                                style="${hasIncompleteDeps ? 'background: rgba(239, 68, 68, 0.15); color: #f87171;' : ''}"
                                title="${hasIncompleteDeps ? 'Warning: Prerequisites not yet done!' : 'Prerequisites satisfied'}">
                            🔗 ${task.dependencies.length} Dep${task.dependencies.length > 1 ? 's' : ''}
                            ${hasIncompleteDeps ? '⚠️' : ''}
                          </span>
                        ` : ''}
                      </div>

                      <div class="kanban-card-footer">
                        <div class="kanban-assignee-wrap">
                          ${(() => {
                            const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
                              ? task.assignedResourceIds
                              : (task.assignedResourceId ? [task.assignedResourceId] : []);
                            const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);
                            if (assignees.length === 0) {
                              return '<span style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">Unassigned</span>';
                            }
                            if (assignees.length === 1) {
                              const r = assignees[0];
                              return `
                                <span class="avatar-pill" style="background: ${r.avatarColor};" title="${escapeHtml(r.name)} (${escapeHtml(r.role)})">
                                  ${r.name.split(' ').map(n=>n[0]).join('')}
                                </span>
                                <span class="kanban-assignee-name">${escapeHtml(r.name)}</span>
                              `;
                            }
                            return `
                              <div style="display: flex; align-items: center; gap: 0.35rem;" title="${assignees.map(a => a.name).join(', ')}">
                                <div style="display: flex;">
                                  ${assignees.slice(0, 3).map((r, i) => `
                                    <span class="avatar-pill" style="background: ${r.avatarColor}; width: 20px; height: 20px; font-size: 0.6rem; margin-left: ${i > 0 ? '-6px' : '0'}; border: 1.5px solid var(--bg-surface);" title="${escapeHtml(r.name)} (${escapeHtml(r.role)})">
                                      ${r.name.split(' ').map(n=>n[0]).join('')}
                                    </span>
                                  `).join('')}
                                </div>
                                <span class="kanban-assignee-name" style="font-size: 0.72rem; font-weight: 600; color: var(--accent-primary);">
                                  ${assignees.length} people
                                </span>
                              </div>
                            `;
                          })()}
                        </div>
                        <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">${task.progress || 0}%</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.bindDragAndDrop();
  }

  bindDragAndDrop() {
    const cards = this.container.querySelectorAll('.kanban-card');
    const columns = this.container.querySelectorAll('.kanban-column-body');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      card.addEventListener('click', () => {
        const taskId = card.getAttribute('data-task-id');
        if (taskId && this.onEditTask) {
          this.onEditTask(taskId);
        }
      });
    });

    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = col.getAttribute('data-status');

        if (taskId && newStatus) {
          this.store.updateTaskStatus(taskId, newStatus);
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
