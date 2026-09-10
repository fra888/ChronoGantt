/**
 * Interactive Gantt Chart View
 * - Render timeline tracks & days
 * - Group by Project, Assignee, Project & Assignee, or None (Flat)
 * - Task bars with man-hours, progress, and daily pacing indicators
 * - Dynamic curved SVG dependency connectors with arrowheads
 * - Project summary bracket bars and Assignee span tracks
 * - Critical path visual highlight
 * - Tooltip with detailed task metrics
 * - Synchronized bidirectional scrolling between tree pane and timeline
 */
import { ScheduleEngine } from '../engine.js?v=2';

export class GanttView {
  constructor(container, store, onEditTask) {
    this.container = container;
    this.store = store;
    this.onEditTask = onEditTask;
    this.viewScale = 'day'; // 'day' | 'week'
    this.groupBy = 'project_assignee'; // 'project_assignee' | 'project' | 'assignee' | 'none'
    this.collapsedGroups = new Set();
    this.colWidth = 42; // px per day in day view
    this.rowHeight = 44; // px per task row
    this.projectHeaderHeight = 38; // px for project header
    this.assigneeHeaderHeight = 34; // px for assignee header
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

  setGroupBy(groupBy) {
    this.groupBy = groupBy;
    this.render();
  }

  toggleGroupCollapse(groupId) {
    if (this.collapsedGroups.has(groupId)) {
      this.collapsedGroups.delete(groupId);
    } else {
      this.collapsedGroups.add(groupId);
    }
    this.render();
  }

  getTaskAssigneesInfo(task, resourceMap) {
    const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
      ? task.assignedResourceIds
      : (task.assignedResourceId ? [task.assignedResourceId] : []);
    const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);

    if (assignees.length === 0) {
      return {
        key: 'unassigned',
        label: 'Unassigned',
        assignees: [],
        isMulti: false
      };
    }
    if (assignees.length === 1) {
      return {
        key: `res-${assignees[0].id}`,
        label: assignees[0].name,
        assignees,
        isMulti: false
      };
    }
    return {
      key: `multi-${ids.slice().sort().join('-')}`,
      label: assignees.map(a => a.name.split(' ')[0]).join(' & '),
      fullLabel: assignees.map(a => a.name).join(', '),
      assignees,
      isMulti: true
    };
  }

  computeGroupMetrics(tasks) {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      return { minStart: now, maxEnd: now, totalHours: 0 };
    }
    const minStart = new Date(Math.min(...tasks.map(t => t.computedStartDate.getTime())));
    const maxEnd = new Date(Math.max(...tasks.map(t => t.computedEndDate.getTime())));
    const totalHours = tasks.reduce((sum, t) => sum + (Number(t.durationHours) || 0), 0);
    return { minStart, maxEnd, totalHours };
  }

  buildDisplayRows(scheduledTasks, projectMap, resourceMap) {
    const rows = [];

    // Mode 1: Flat List (None)
    if (this.groupBy === 'none') {
      scheduledTasks.forEach((task, idx) => {
        rows.push({ type: 'task', id: task.id, task, level: 0, index: idx + 1 });
      });
      return rows;
    }

    // Mode 2: Group by Project
    if (this.groupBy === 'project') {
      const projectGroups = new Map();
      scheduledTasks.forEach(task => {
        if (!projectGroups.has(task.projectId)) projectGroups.set(task.projectId, []);
        projectGroups.get(task.projectId).push(task);
      });

      let taskIndex = 1;
      projectGroups.forEach((tasks, projId) => {
        const proj = projectMap.get(projId) || { id: projId, name: 'Untitled Project', color: '#6366f1' };
        const groupId = `proj-${projId}`;
        const isCollapsed = this.collapsedGroups.has(groupId);
        const metrics = this.computeGroupMetrics(tasks);

        rows.push({
          type: 'project-header',
          groupId,
          id: groupId,
          project: proj,
          tasks,
          isCollapsed,
          ...metrics
        });

        if (!isCollapsed) {
          tasks.forEach(task => {
            rows.push({ type: 'task', id: task.id, task, level: 1, index: taskIndex++ });
          });
        }
      });
      return rows;
    }

    // Mode 3: Group by Assignee
    if (this.groupBy === 'assignee') {
      const assigneeGroups = new Map();
      scheduledTasks.forEach(task => {
        const aInfo = this.getTaskAssigneesInfo(task, resourceMap);
        if (!assigneeGroups.has(aInfo.key)) {
          assigneeGroups.set(aInfo.key, { info: aInfo, tasks: [] });
        }
        assigneeGroups.get(aInfo.key).tasks.push(task);
      });

      let taskIndex = 1;
      assigneeGroups.forEach(({ info, tasks }, aKey) => {
        const groupId = `assignee-${aKey}`;
        const isCollapsed = this.collapsedGroups.has(groupId);
        const metrics = this.computeGroupMetrics(tasks);

        rows.push({
          type: 'assignee-header',
          groupId,
          id: groupId,
          assigneeInfo: info,
          tasks,
          isCollapsed,
          ...metrics
        });

        if (!isCollapsed) {
          tasks.forEach(task => {
            rows.push({ type: 'task', id: task.id, task, level: 1, index: taskIndex++ });
          });
        }
      });
      return rows;
    }

    // Mode 4: Group by Project AND Assignee (Default)
    const projectGroups = new Map();
    scheduledTasks.forEach(task => {
      if (!projectGroups.has(task.projectId)) projectGroups.set(task.projectId, []);
      projectGroups.get(task.projectId).push(task);
    });

    let taskIndex = 1;
    projectGroups.forEach((projTasks, projId) => {
      const proj = projectMap.get(projId) || { id: projId, name: 'Untitled Project', color: '#6366f1' };
      const projGroupId = `proj-${projId}`;
      const isProjCollapsed = this.collapsedGroups.has(projGroupId);
      const projMetrics = this.computeGroupMetrics(projTasks);

      rows.push({
        type: 'project-header',
        groupId: projGroupId,
        id: projGroupId,
        project: proj,
        tasks: projTasks,
        isCollapsed: isProjCollapsed,
        ...projMetrics
      });

      if (!isProjCollapsed) {
        // Sub-group by assignee within this project
        const assigneeSubgroups = new Map();
        projTasks.forEach(task => {
          const aInfo = this.getTaskAssigneesInfo(task, resourceMap);
          if (!assigneeSubgroups.has(aInfo.key)) {
            assigneeSubgroups.set(aInfo.key, { info: aInfo, tasks: [] });
          }
          assigneeSubgroups.get(aInfo.key).tasks.push(task);
        });

        assigneeSubgroups.forEach(({ info, tasks: subTasks }, aKey) => {
          const assigneeGroupId = `proj-${projId}-assignee-${aKey}`;
          const isAssigneeCollapsed = this.collapsedGroups.has(assigneeGroupId);
          const aMetrics = this.computeGroupMetrics(subTasks);

          rows.push({
            type: 'assignee-header',
            groupId: assigneeGroupId,
            id: assigneeGroupId,
            assigneeInfo: info,
            project: proj,
            tasks: subTasks,
            isCollapsed: isAssigneeCollapsed,
            ...aMetrics
          });

          if (!isAssigneeCollapsed) {
            subTasks.forEach(task => {
              rows.push({ type: 'task', id: task.id, task, level: 2, index: taskIndex++ });
            });
          }
        });
      }
    });

    return rows;
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

    // Generate rows list (grouped or flat)
    const displayRows = this.buildDisplayRows(scheduledTasks, projectMap, resourceMap);

    // Calculate total height of timeline canvas
    const totalTimelineHeight = displayRows.reduce((sum, row) => {
      if (row.type === 'project-header') return sum + this.projectHeaderHeight;
      if (row.type === 'assignee-header') return sum + this.assigneeHeaderHeight;
      return sum + this.rowHeight;
    }, 0);

    const dayMs = 1000 * 60 * 60 * 24;

    // Helper to render assignee avatars in tree
    const renderAssigneesPill = (assignees) => {
      if (!assignees || assignees.length === 0) {
        return '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';
      }
      if (assignees.length === 1) {
        const r = assignees[0];
        return `
          <span class="avatar-pill" style="background: ${r.avatarColor}; width: 18px; height: 18px; font-size: 0.6rem;">
            ${r.name.split(' ').map(n => n[0]).join('')}
          </span>
          <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.name.split(' ')[0])}</span>
        `;
      }
      return `
        <div style="display: flex; align-items: center;" title="${assignees.map(a => a.name).join(', ')}">
          <div style="display: flex; margin-right: 0.25rem;">
            ${assignees.slice(0, 3).map((r, i) => `
              <span class="avatar-pill" style="background: ${r.avatarColor}; width: 16px; height: 16px; font-size: 0.54rem; margin-left: ${i > 0 ? '-5px' : '0'}; border: 1px solid var(--bg-surface);" title="${escapeHtml(r.name)}">
                ${r.name.split(' ').map(n => n[0]).join('')}
              </span>
            `).join('')}
          </div>
          <span style="font-size: 0.7rem; font-weight: 600; color: var(--accent-primary);">${assignees.length}p</span>
        </div>
      `;
    };

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
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-right: 0.5rem;">
              <span class="filter-label" style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">Group by:</span>
              <select class="select-filter" id="ganttGroupBySelect" style="padding: 0.25rem 0.6rem; font-size: 0.76rem; border-radius: var(--radius-sm); cursor: pointer;">
                <option value="project_assignee" ${this.groupBy === 'project_assignee' ? 'selected' : ''}>Project & Assignee</option>
                <option value="project" ${this.groupBy === 'project' ? 'selected' : ''}>Project</option>
                <option value="assignee" ${this.groupBy === 'assignee' ? 'selected' : ''}>Assignee</option>
                <option value="none" ${this.groupBy === 'none' ? 'selected' : ''}>None (Flat)</option>
              </select>
            </div>

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
              ${displayRows.map((row) => {
                if (row.type === 'project-header') {
                  return `
                    <div class="gantt-group-header-row gantt-project-header" data-group-id="${row.groupId}" style="border-left-color: ${row.project.color || 'var(--primary)'};">
                      <span class="gantt-group-chevron ${row.isCollapsed ? 'collapsed' : ''}">▼</span>
                      <span class="project-color-dot" style="background: ${row.project.color || '#6366f1'}; width: 10px; height: 10px;"></span>
                      <span class="gantt-group-title" title="${escapeHtml(row.project.name)}">
                        ${escapeHtml(row.project.name)}
                      </span>
                      <div class="gantt-group-meta">
                        <span class="badge" style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.15); color: #a5b4fc;">
                          ${row.tasks.length} task${row.tasks.length === 1 ? '' : 's'}
                        </span>
                        <span style="font-family: var(--font-mono); color: #93c5fd; font-size: 0.72rem; font-weight: 600;">
                          ${row.totalHours}h
                        </span>
                        ${row.project.targetDate ? `
                          <span title="Project Target Deadline: ${row.project.targetDate}" style="font-size: 0.68rem; color: #34d399; font-weight: 600;">
                            🎯 ${row.project.targetDate.slice(5)}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }

                if (row.type === 'assignee-header') {
                  const assignees = row.assigneeInfo.assignees;
                  return `
                    <div class="gantt-group-header-row gantt-assignee-header" data-group-id="${row.groupId}">
                      <span class="gantt-group-chevron ${row.isCollapsed ? 'collapsed' : ''}">▼</span>
                      <div style="display: flex; align-items: center; gap: 0.35rem;">
                        ${assignees.length === 0 ? `
                          <span style="font-size: 0.8rem;">👤</span>
                        ` : assignees.map(a => `
                          <span class="avatar-pill" style="background: ${a.avatarColor}; width: 18px; height: 18px; font-size: 0.58rem;" title="${escapeHtml(a.name)}">
                            ${a.name.split(' ').map(n=>n[0]).join('')}
                          </span>
                        `).join('')}
                      </div>
                      <span class="gantt-group-title" title="${escapeHtml(row.assigneeInfo.fullLabel || row.assigneeInfo.label)}">
                        ${escapeHtml(row.assigneeInfo.label)}
                      </span>
                      <div class="gantt-group-meta">
                        <span class="badge" style="font-size: 0.66rem; background: rgba(148, 163, 184, 0.15); color: #cbd5e1;">
                          ${row.tasks.length}
                        </span>
                        <span style="font-family: var(--font-mono); color: #93c5fd; font-size: 0.72rem;">
                          ${row.totalHours}h
                        </span>
                      </div>
                    </div>
                  `;
                }

                // Normal task row
                const task = row.task;
                const proj = projectMap.get(task.projectId);
                const ids = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
                  ? task.assignedResourceIds
                  : (task.assignedResourceId ? [task.assignedResourceId] : []);
                const assignees = ids.map(id => resourceMap.get(id)).filter(Boolean);

                return `
                  <div class="gantt-tree-row level-${row.level}" data-task-id="${task.id}" id="tree-row-${task.id}">
                    <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.72rem;">${row.index}</span>
                    <div class="gantt-tree-title">
                      <span class="project-color-dot" style="background: ${proj?.color || '#6366f1'};"></span>
                      <span title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
                      ${task.isTargetMissed ? `<span title="Target deadline missed by ${task.targetDiffDays} day(s)!" style="margin-left: 4px; font-size: 0.72rem; cursor: help;">⚠️</span>` : ''}
                    </div>
                    <div class="gantt-tree-assignee">
                      ${renderAssigneesPill(assignees)}
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
            <div class="gantt-timeline-content" style="width: ${timelineWidth}px; height: ${totalTimelineHeight}px;">
              <!-- Background Vertical Grid -->
              <div class="gantt-grid-columns">
                ${days.map(d => `
                  <div class="gantt-grid-col ${d.isHoliday ? 'holiday' : (d.isWeekend ? 'weekend' : '')} ${d.isToday ? 'today-col' : ''}" 
                       style="width: ${this.colWidth}px;"></div>
                `).join('')}
              </div>

              <!-- SVG Connectors Overlay -->
              <svg class="gantt-svg-overlay" id="ganttSvgOverlay" style="width: ${timelineWidth}px; height: ${totalTimelineHeight}px;">
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
                ${displayRows.map((row) => {
                  if (row.type === 'project-header') {
                    const startOffsetDays = Math.max(0, (row.minStart - minDate) / dayMs);
                    const endOffsetDays = Math.max(startOffsetDays + 1, (row.maxEnd - minDate) / dayMs + 1);
                    const barLeft = Math.round(startOffsetDays * this.colWidth);
                    const barWidth = Math.max(32, Math.round((endOffsetDays - startOffsetDays) * this.colWidth));
                    const projColor = row.project.color || '#6366f1';

                    return `
                      <div class="gantt-group-timeline-row gantt-project-timeline-row" style="height: ${this.projectHeaderHeight}px;">
                        <div class="gantt-project-summary-bar" 
                             style="left: ${barLeft}px; width: ${barWidth}px; --proj-color: ${projColor}; background: linear-gradient(90deg, ${projColor}, ${projColor}dd);"
                             title="Project Summary: ${escapeHtml(row.project.name)} (${row.tasks.length} tasks • ${row.totalHours}h effort)">
                          <span class="gantt-summary-label">${escapeHtml(row.project.name)} (${row.tasks.length} tasks • ${row.totalHours}h)</span>
                        </div>
                      </div>
                    `;
                  }

                  if (row.type === 'assignee-header') {
                    const startOffsetDays = Math.max(0, (row.minStart - minDate) / dayMs);
                    const endOffsetDays = Math.max(startOffsetDays + 1, (row.maxEnd - minDate) / dayMs + 1);
                    const barLeft = Math.round(startOffsetDays * this.colWidth);
                    const barWidth = Math.max(28, Math.round((endOffsetDays - startOffsetDays) * this.colWidth));

                    return `
                      <div class="gantt-group-timeline-row gantt-assignee-timeline-row" style="height: ${this.assigneeHeaderHeight}px;">
                        <div class="gantt-assignee-summary-bar" 
                             style="left: ${barLeft}px; width: ${barWidth}px;"
                             title="${escapeHtml(row.assigneeInfo.fullLabel || row.assigneeInfo.label)}: ${row.tasks.length} subtask(s) • ${row.totalHours}h">
                          <span>${escapeHtml(row.assigneeInfo.label)} • ${row.totalHours}h</span>
                        </div>
                      </div>
                    `;
                  }

                  // Normal Task Row
                  const task = row.task;
                  const startOffsetDays = Math.max(0, (task.computedStartDate - minDate) / dayMs);
                  const endOffsetDays = Math.max(startOffsetDays + 1, (task.computedEndDate - minDate) / dayMs + 1);
                  const barLeft = Math.round(startOffsetDays * this.colWidth);
                  const barWidth = Math.max(28, Math.round((endOffsetDays - startOffsetDays) * this.colWidth));
                  const proj = projectMap.get(task.projectId);
                  const barColor = proj?.color || '#6366f1';

                  return `
                    <div class="gantt-bar-row" style="height: ${this.rowHeight}px;" data-row-id="${task.id}">
                      <div class="gantt-task-bar ${task.isCritical ? 'critical-path' : ''} ${task.isTargetMissed ? 'target-missed-bar' : ''}" 
                           id="task-bar-${task.id}"
                           data-task-id="${task.id}"
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

    // Bind group by select dropdown
    const groupBySelect = document.getElementById('ganttGroupBySelect');
    groupBySelect?.addEventListener('change', (e) => {
      this.setGroupBy(e.target.value);
    });

    // Bind collapse / expand clicks on group headers
    this.container.querySelectorAll('.gantt-group-header-row').forEach(header => {
      header.addEventListener('click', () => {
        const gId = header.getAttribute('data-group-id');
        if (gId) this.toggleGroupCollapse(gId);
      });
    });

    // Bidirectional synchronized scrolling between left tree and right timeline
    const treeBody = document.getElementById('ganttTreeBody');
    const timelinePane = document.getElementById('ganttTimelinePane');

    if (timelinePane && treeBody) {
      let isSyncingTimeline = false;
      let isSyncingTree = false;

      timelinePane.addEventListener('scroll', () => {
        if (!isSyncingTimeline) {
          isSyncingTree = true;
          treeBody.scrollTop = timelinePane.scrollTop;
          isSyncingTree = false;
        }
      });

      treeBody.addEventListener('scroll', () => {
        if (!isSyncingTree) {
          isSyncingTimeline = true;
          timelinePane.scrollTop = treeBody.scrollTop;
          isSyncingTimeline = false;
        }
      });
    }

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
          ${task.dailyBurnHours ? `
            <div class="tooltip-row">
              <span>Leveled Pace:</span>
              <span class="tooltip-val" style="color: #fbbf24; font-weight: 600;">⚡ ${task.dailyBurnHours}h/day (Leveled)</span>
            </div>
          ` : ''}
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
