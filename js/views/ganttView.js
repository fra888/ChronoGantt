/**
 * Interactive Gantt Chart View
 * - Render timeline tracks & days
 * - Task bars with man-hours and progress
 * - Dynamic curved SVG dependency connectors with arrowheads
 * - Critical path visual highlight
 * - Tooltip with detailed task metrics
 */
import { ScheduleEngine } from '../engine.js';

export class GanttView {
  constructor(container, store, onEditTask) {
    this.container = container;
    this.store = store;
    this.onEditTask = onEditTask;
    this.viewScale = 'day'; // 'day' | 'week'
    this.colWidth = 42; // px per day in day view
    this.rowHeight = 44; // px per row
    this.tooltipEl = null;

    this.initTooltip();
  }

  initTooltip() {
    let tip = document.getElementById('ganttTaskTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'ganttTaskTooltip';
      tip.className = 'gantt-tooltip';
      document.body.appendChild(tip);
    }
    this.tooltipEl = tip;
  }

  setScale(scale) {
    this.viewScale = scale;
    this.colWidth = scale === 'week' ? 20 : 42;
    this.render();
  }

  render() {
    const rawTasks = this.store.getFilteredTasks();
    const resources = this.store.getResources();
    const projects = this.store.getProjects();
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const resourceMap = new Map(resources.map(r => [r.id, r]));
    const calendar = this.store.getCalendar();
    const allCalendars = this.store.getAllCalendars();

    // Compute schedules & critical path using project effort allocations, user local calendars & vacations
    const scheduledTasks = ScheduleEngine.computeSchedule(rawTasks, resources, projects, calendar, allCalendars);

    if (scheduledTasks.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <h3>No subtasks match your filters</h3>
          <p style="margin-top: 0.5rem; font-size: 0.85rem;">Click "+ New Subtask" to add a subtask to this project.</p>
        </div>
      `;
      return;
    }

    // Determine overall timeline date range
    let minDate = new Date();
    let maxDate = new Date();
    if (scheduledTasks.length > 0) {
      minDate = new Date(Math.min(...scheduledTasks.map(t => t.computedStartDate.getTime())));
      maxDate = new Date(Math.max(...scheduledTasks.map(t => t.computedEndDate.getTime())));
    }

    // Add padding (3 days before, 10 days after)
    minDate.setDate(minDate.getDate() - 3);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + 10);
    maxDate.setHours(0, 0, 0, 0);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    const timelineWidth = totalDays * this.colWidth;

    // Generate Day Array
    const days = [];
    const curr = new Date(minDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < totalDays; i++) {
      const isToday = curr.getTime() === today.getTime();
      const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      const holiday = (calendar.holidays || []).find(h => h.date === dateStr);
      const isWorkingDay = ScheduleEngine.isWorkingDay(curr, calendar);

      days.push({
        date: new Date(curr),
        dayNum: curr.getDate(),
        dayName: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][curr.getDay()],
        monthName: curr.toLocaleString('default', { month: 'short' }),
        monthYear: `${curr.toLocaleString('default', { month: 'short' })} ${curr.getFullYear()}`,
        isToday,
        isWeekend: !isWorkingDay && !holiday,
        isHoliday: !!holiday,
        holidayName: holiday?.name || null
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Group days by month for top header scale
    const monthGroups = [];
    let currentMonth = null;
    let monthDayCount = 0;

    days.forEach(d => {
      if (d.monthYear !== currentMonth) {
        if (currentMonth !== null) {
          monthGroups.push({ name: currentMonth, daysCount: monthDayCount });
        }
        currentMonth = d.monthYear;
        monthDayCount = 1;
      } else {
        monthDayCount++;
      }
    });
    if (currentMonth !== null) {
      monthGroups.push({ name: currentMonth, daysCount: monthDayCount });
    }

    // Construct UI Shell
    this.container.innerHTML = `
      <div class="gantt-wrapper">
        <div class="gantt-toolbar">
          <div class="gantt-toolbar-left">
            <span style="font-weight: 700; font-size: 0.9rem;">Timeline & Gantt Schedule</span>
            <span class="badge badge-critical" style="font-size: 0.72rem;">
              ⚡ ${scheduledTasks.filter(t => t.isCritical).length} Critical Path Tasks
            </span>
          </div>
          <div class="gantt-toolbar-right">
            <span class="filter-label">Scale:</span>
            <div class="view-mode-toggle">
              <button class="view-mode-btn ${this.viewScale === 'day' ? 'active' : ''}" id="scaleDayBtn">Days</button>
              <button class="view-mode-btn ${this.viewScale === 'week' ? 'active' : ''}" id="scaleWeekBtn">Compact</button>
            </div>
          </div>
        </div>

        <div class="gantt-main-container">
          <!-- Left Table Panel -->
          <div class="gantt-tree-pane">
            <div class="gantt-tree-header">
              <span>#</span>
              <span>Subtask</span>
              <span>Assignee</span>
              <span style="text-align: right; padding-right: 0.5rem;">Effort</span>
            </div>
            <div class="gantt-tree-body" id="ganttTreeBody">
              ${scheduledTasks.map((task, idx) => {
                const res = resourceMap.get(task.assignedResourceId);
                const proj = projectMap.get(task.projectId);
                return `
                  <div class="gantt-tree-row" data-task-id="${task.id}" id="tree-row-${task.id}">
                    <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.72rem;">${idx + 1}</span>
                    <div class="gantt-tree-title">
                      <span class="project-color-dot" style="background: ${proj?.color || '#6366f1'};"></span>
                      <span title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
                      ${task.isTargetMissed ? `<span title="Target deadline missed by ${task.targetDiffDays} day(s)!" style="margin-left: 4px; font-size: 0.72rem; cursor: help;">⚠️</span>` : ''}
                    </div>
                    <div class="gantt-tree-assignee">
                      ${(() => {
                        const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
                          ? task.assignedResourceIds
                          : (task.assignedResourceId ? [task.assignedResourceId] : []);
                        const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);
                        if (assignees.length === 0) {
                          return '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';
                        }
                        if (assignees.length === 1) {
                          const r = assignees[0];
                          return `
                            <span class="avatar-pill" style="background: ${r.avatarColor}; width: 20px; height: 20px; font-size: 0.62rem;">
                              ${r.name.split(' ').map(n=>n[0]).join('')}
                            </span>
                            <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.name.split(' ')[0])}</span>
                          `;
                        }
                        return `
                          <div style="display: flex; align-items: center;" title="${assignees.map(a => a.name).join(', ')}">
                            <div style="display: flex; margin-right: 0.3rem;">
                              ${assignees.slice(0, 3).map((r, i) => `
                                <span class="avatar-pill" style="background: ${r.avatarColor}; width: 18px; height: 18px; font-size: 0.58rem; margin-left: ${i > 0 ? '-6px' : '0'}; border: 1.5px solid var(--bg-surface);" title="${escapeHtml(r.name)}">
                                  ${r.name.split(' ').map(n=>n[0]).join('')}
                                </span>
                              `).join('')}
                            </div>
                            <span style="font-size: 0.72rem; font-weight: 600; color: var(--accent-primary);">${assignees.length}p</span>
                          </div>
                        `;
                      })()}
                    </div>
                    <div class="gantt-tree-effort">${task.durationHours}h</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Right Timeline Canvas -->
          <div class="gantt-timeline-pane" id="ganttTimelinePane">
            <div class="gantt-timeline-header-wrap" style="width: ${timelineWidth}px;">
              <!-- Month Scale -->
              <div class="gantt-scale-months">
                ${monthGroups.map(mg => `
                  <div class="gantt-month-cell" style="width: ${mg.daysCount * this.colWidth}px;">
                    ${mg.name}
                  </div>
                `).join('')}
              </div>
              <!-- Day Scale -->
              <div class="gantt-scale-days">
                ${days.map(d => `
                  <div class="gantt-day-cell ${d.isHoliday ? 'holiday' : (d.isWeekend ? 'weekend' : '')} ${d.isToday ? 'today' : ''}" 
                       style="width: ${this.colWidth}px;" 
                       title="${d.isHoliday ? `🇮🇹 Holiday: ${d.holidayName} (${d.date.toDateString()})` : d.date.toDateString()}">
                    ${this.viewScale === 'day' ? `${d.isHoliday ? '🎉 ' : ''}${d.dayName} ${d.dayNum}` : d.dayNum}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Timeline Content with Grid & Task Bars -->
            <div class="gantt-timeline-content" style="width: ${timelineWidth}px; height: ${scheduledTasks.length * this.rowHeight}px;">
              <!-- Background Vertical Grid -->
              <div class="gantt-grid-columns">
                ${days.map(d => `
                  <div class="gantt-grid-col ${d.isHoliday ? 'holiday' : (d.isWeekend ? 'weekend' : '')} ${d.isToday ? 'today-col' : ''}" 
                       style="width: ${this.colWidth}px;"></div>
                `).join('')}
              </div>

              <!-- SVG Connectors Overlay -->
              <svg class="gantt-svg-overlay" id="ganttSvgOverlay" style="width: ${timelineWidth}px; height: ${scheduledTasks.length * this.rowHeight}px;">
                <defs>
                  <!-- Standard Dependency Arrow -->
                  <marker id="depArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
                  </marker>
                  <!-- Critical Path Arrow -->
                  <marker id="criticalArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
                  </marker>
                </defs>
                <g id="svgDependencyLines"></g>
              </svg>

              <!-- Timeline Bars Rows -->
              <div class="gantt-timeline-rows">
                ${scheduledTasks.map((task, rowIdx) => {
                  const dayMs = 1000 * 60 * 60 * 24;
                  const startOffsetDays = Math.max(0, (task.computedStartDate - minDate) / dayMs);
                  const endOffsetDays = Math.max(startOffsetDays + 1, (task.computedEndDate - minDate) / dayMs + 1);
                  const barLeft = Math.round(startOffsetDays * this.colWidth);
                  const barWidth = Math.max(28, Math.round((endOffsetDays - startOffsetDays) * this.colWidth));
                  const topPos = rowIdx * this.rowHeight + 8;
                  const proj = projectMap.get(task.projectId);
                  const barColor = proj?.color || '#6366f1';
                  const res = resourceMap.get(task.assignedResourceId);

                  return `
                    <div class="gantt-bar-row" style="height: ${this.rowHeight}px;" data-row-id="${task.id}">
                      <div class="gantt-task-bar ${task.isCritical ? 'critical-path' : ''} ${task.isTargetMissed ? 'target-missed-bar' : ''}" 
                           id="task-bar-${task.id}"
                           data-task-id="${task.id}"
                           data-row-idx="${rowIdx}"
                           style="left: ${barLeft}px; width: ${barWidth}px; top: 8px; background: ${barColor};"
                           title="${escapeHtml(task.title)}">
                        <!-- Progress Fill Layer -->
                        <div class="gantt-task-progress" style="width: ${task.progress || 0}%;"></div>
                        <div class="gantt-task-content">
                          <span class="gantt-task-title">${escapeHtml(task.title)}</span>
                          ${task.isTargetMissed ? '<span style="font-size: 0.65rem;" title="Target date missed">⚠️</span>' : ''}
                          <span class="gantt-task-hours">${task.durationHours}h</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind scale toggle buttons
    document.getElementById('scaleDayBtn')?.addEventListener('click', () => this.setScale('day'));
    document.getElementById('scaleWeekBtn')?.addEventListener('click', () => this.setScale('week'));

    // Bind synchronized scrolling between left tree and right timeline
    const treeBody = document.getElementById('ganttTreeBody');
    const timelinePane = document.getElementById('ganttTimelinePane');

    timelinePane?.addEventListener('scroll', () => {
      if (treeBody) treeBody.scrollTop = timelinePane.scrollTop;
    });

    // Draw SVG dependency arrows
    this.drawDependencies(scheduledTasks, minDate);

    // Bind interactions (hover tooltip & click to edit)
    this.bindBarInteractions(scheduledTasks, projectMap, resourceMap);
  }

  drawDependencies(tasks, minDate) {
    const linesGroup = document.getElementById('svgDependencyLines');
    if (!linesGroup) return;

    let svgHtml = '';
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    tasks.forEach(task => {
      if (!Array.isArray(task.dependencies) || task.dependencies.length === 0) return;

      const targetBar = document.getElementById(`task-bar-${task.id}`);
      if (!targetBar) return;

      const targetLeft = parseFloat(targetBar.style.left);
      const targetTop = parseFloat(targetBar.parentElement.offsetTop) + (this.rowHeight / 2);

      task.dependencies.forEach(predId => {
        const predTask = taskMap.get(predId);
        const predBar = document.getElementById(`task-bar-${predId}`);
        if (!predBar || !predTask) return;

        const predLeft = parseFloat(predBar.style.left);
        const predWidth = parseFloat(predBar.style.width);
        const predRight = predLeft + predWidth;
        const predTop = parseFloat(predBar.parentElement.offsetTop) + (this.rowHeight / 2);

        // Calculate smooth S-curve / bezier path
        const startX = predRight;
        const startY = predTop;
        const endX = targetLeft;
        const endY = targetTop;

        const isCriticalLink = task.isCritical && predTask.isCritical;
        const dx = Math.max(20, Math.abs(endX - startX) * 0.45);

        const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

        svgHtml += `
          <path d="${pathData}" 
                class="dep-line ${isCriticalLink ? 'critical' : ''}" 
                data-pred="${predId}" 
                data-succ="${task.id}"
                marker-end="url(#${isCriticalLink ? 'criticalArrow' : 'depArrow'})" />
        `;
      });
    });

    linesGroup.innerHTML = svgHtml;
  }

  bindBarInteractions(tasks, projectMap, resourceMap) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Clicking tree row or task bar
    this.container.querySelectorAll('.gantt-tree-row, .gantt-task-bar').forEach(el => {
      el.addEventListener('click', (e) => {
        const taskId = el.getAttribute('data-task-id');
        if (taskId && this.onEditTask) {
          this.onEditTask(taskId);
        }
      });
    });

    // Hover tooltip & highlight dependency lines
    this.container.querySelectorAll('.gantt-task-bar').forEach(bar => {
      const taskId = bar.getAttribute('data-task-id');
      const task = taskMap.get(taskId);
      if (!task) return;

      bar.addEventListener('mouseenter', (e) => {
        // Highlight connected dependency paths
        this.container.querySelectorAll(`.dep-line[data-pred="${taskId}"], .dep-line[data-succ="${taskId}"]`).forEach(l => {
          l.classList.add('highlighted');
        });

        // Show Tooltip
        const res = resourceMap.get(task.assignedResourceId);
        const proj = projectMap.get(task.projectId);
        const depsCount = task.dependencies ? task.dependencies.length : 0;

        this.tooltipEl.innerHTML = `
          <div class="tooltip-title" style="color: ${proj?.color || 'var(--primary)'};">
            ${escapeHtml(task.title)}
          </div>
          <div class="tooltip-row">
            <span>Project:</span>
            <span class="tooltip-val">${escapeHtml(proj?.name || 'Unknown')}</span>
          </div>
          <div class="tooltip-row">
            <span>Assignees:</span>
            <span class="tooltip-val">${(() => {
              const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
                ? task.assignedResourceIds
                : (task.assignedResourceId ? [task.assignedResourceId] : []);
              const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);
              if (assignees.length === 0) return 'Unassigned';
              return assignees.map(a => escapeHtml(a.name)).join(', ');
            })()}</span>
          </div>
          <div class="tooltip-row">
            <span>Daily Burn:</span>
            <span class="tooltip-val" style="color: #a7f3d0;">${task.effectiveDailyCapacity || 8}h/day combined</span>
          </div>
          <div class="tooltip-row">
            <span>Calendar:</span>
            <span class="tooltip-val" style="color: #6ee7b7;">${escapeHtml(task.effectiveCalendar?.name || 'Standard')}</span>
          </div>
          ${task.skippedVacationDays && task.skippedVacationDays.length > 0 ? `
            <div class="tooltip-row">
              <span>Skipped Vacations:</span>
              <span class="tooltip-val" style="color: #f472b6;">
                ${task.skippedVacationDays.length} day(s) (${task.skippedVacationDays.map(v => `${v.date}: ${v.name}`).join('; ')})
              </span>
            </div>
          ` : ''}
          <div class="tooltip-row">
            <span>Effort:</span>
            <span class="tooltip-val" style="color: #93c5fd;">${task.durationHours} Man-Hours</span>
          </div>
          <div class="tooltip-row">
            <span>Duration:</span>
            <span class="tooltip-val">${task.durationDays} Working Days</span>
          </div>
          <div class="tooltip-row">
            <span>Start Date:</span>
            <span class="tooltip-val">${task.computedStartDate.toLocaleDateString()}</span>
          </div>
          <div class="tooltip-row">
            <span>End Date:</span>
            <span class="tooltip-val">${task.computedEndDate.toLocaleDateString()}</span>
          </div>
          ${task.targetDate ? `
            <div class="tooltip-row">
              <span>Target End Date:</span>
              <span class="tooltip-val" style="${task.isTargetMissed ? 'color: #f87171; font-weight: 700;' : 'color: #34d399; font-weight: 600;'}">
                🎯 ${task.targetDate} ${task.isTargetMissed ? `(+${task.targetDiffDays}d late ⚠️)` : '(On Track)'}
              </span>
            </div>
          ` : `
            <div class="tooltip-row">
              <span>Target End Date:</span>
              <span class="tooltip-val" style="color: var(--text-muted); font-style: italic;">None set</span>
            </div>
          `}
          <div class="tooltip-row">
            <span>Dependencies:</span>
            <span class="tooltip-val">${depsCount} prerequisite${depsCount === 1 ? '' : 's'}</span>
          </div>
          <div class="tooltip-row">
            <span>Progress:</span>
            <span class="tooltip-val">${task.progress || 0}%</span>
          </div>
          ${task.isCritical ? `
            <div style="margin-top: 0.4rem; padding: 0.2rem 0.4rem; background: rgba(244, 63, 94, 0.15); border-radius: 4px; color: #f43f5e; font-size: 0.72rem; font-weight: 700; text-align: center;">
              ⚡ On Critical Path (Zero Slack)
            </div>
          ` : ''}
        `;

        this.tooltipEl.classList.add('visible');
        this.positionTooltip(e);
      });

      bar.addEventListener('mousemove', (e) => {
        this.positionTooltip(e);
      });

      bar.addEventListener('mouseleave', () => {
        this.container.querySelectorAll('.dep-line.highlighted').forEach(l => {
          l.classList.remove('highlighted');
        });
        this.tooltipEl.classList.remove('visible');
      });
    });
  }

  positionTooltip(e) {
    if (!this.tooltipEl) return;
    const x = e.clientX + 16;
    const y = e.clientY + 16;
    this.tooltipEl.style.left = `${Math.min(window.innerWidth - 320, x)}px`;
    this.tooltipEl.style.top = `${Math.min(window.innerHeight - 260, y)}px`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
