/**
 * Main Application Controller (ChronoGantt)
 * Initializes store, routing, KPI summaries, and view orchestrations
 */
import { AppStore } from './store.js?v=2';
import { ScheduleEngine } from './engine.js?v=2';
import { GanttView } from './views/ganttView.js?v=2';
import { KanbanView } from './views/kanbanView.js?v=2';
import { WorkloadView } from './views/workloadView.js?v=2';
import { GraphView } from './views/graphView.js?v=2';
import { ProjectListView } from './views/projectList.js?v=2';
import { CalendarView } from './views/calendarView.js?v=2';

import { TaskModal } from './components/taskModal.js?v=2';
import { ResourceModal } from './components/resourceModal.js?v=2';
import { ProjectModal } from './components/projectModal.js?v=2';
import { MessagesCenter } from './components/messagesCenter.js?v=2';

class ChronoGanttApp {
  constructor() {
    this.store = new AppStore();
    this.activeView = 'gantt';
    this.currentViewInstance = null;

    this.initTheme();
    this.initComponents();
    this.initEvents();
    this.renderSidebarProjects();
    this.updateHeaderFilters();
    this.updateKPIs();
    this.updateSolveRevertButtons();
    this.switchView('gantt');

    // Subscribe to state updates
    this.store.subscribe(() => {
      this.renderSidebarProjects();
      this.updateHeaderFilters();
      this.updateKPIs();
      this.updateSolveRevertButtons();
      this.messagesCenter?.update();
      this.renderCurrentView();
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('nexus_pm_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nexus_pm_theme', next);
    this.showToast(`Switched to ${next} mode`, 'info');
  }

  initComponents() {
    this.viewContainer = document.getElementById('mainViewContainer');

    // Modals
    this.taskModal = new TaskModal(this.store, () => {
      this.showToast('Subtask saved successfully', 'success');
    });

    this.resourceModal = new ResourceModal(this.store, () => {
      this.showToast('Resource updated successfully', 'success');
    });

    this.projectModal = new ProjectModal(this.store, () => {
      this.showToast('Project saved successfully', 'success');
    });

    // View Instances
    this.views = {
      gantt: new GanttView(this.viewContainer, this.store, (taskId) => this.taskModal.open(taskId)),
      kanban: new KanbanView(this.viewContainer, this.store, (taskId) => this.taskModal.open(taskId)),
      workload: new WorkloadView(
        this.viewContainer, 
        this.store, 
        (resId) => this.resourceModal.open(resId),
        (taskId) => this.taskModal.open(taskId)
      ),
      graph: new GraphView(this.viewContainer, this.store, (taskId) => this.taskModal.open(taskId)),
      table: new ProjectListView(
        this.viewContainer, 
        this.store, 
        (taskId) => this.taskModal.open(taskId),
        (projId) => this.projectModal.open(projId)
      ),
      calendar: new CalendarView(this.viewContainer, this.store, () => {
        this.updateKPIs();
        this.renderSidebarProjects();
        this.showToast('Local calendar and holiday schedules updated', 'success');
      })
    };

    // Messages & System Warnings Center
    this.messagesCenter = new MessagesCenter(
      this.store,
      this.taskModal,
      this.resourceModal,
      (viewId) => this.switchView(viewId)
    );
  }

  initEvents() {
    // Navigation Tabs
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        this.switchView(viewId);
      });
    });

    // Top action buttons
    document.getElementById('btnAddTaskBtn')?.addEventListener('click', () => {
      const activeProjId = this.store.state.selectedProjectId;
      this.taskModal.open(null, activeProjId);
    });

    document.getElementById('btnAddResourceBtn')?.addEventListener('click', () => {
      this.resourceModal.open(null);
    });

    document.getElementById('quickAddProjectBtn')?.addEventListener('click', () => {
      this.projectModal.open(null);
    });

    // Header Filters
    const projFilter = document.getElementById('headerProjectFilter');
    const headerEditProjBtn = document.getElementById('headerEditProjectBtn');

    projFilter?.addEventListener('change', (e) => {
      this.store.setFilterProject(e.target.value);
      if (headerEditProjBtn) {
        headerEditProjBtn.style.display = e.target.value !== 'all' ? 'inline-flex' : 'none';
      }
    });

    headerEditProjBtn?.addEventListener('click', () => {
      const activeProjId = this.store.state.selectedProjectId;
      if (activeProjId && activeProjId !== 'all') {
        this.projectModal.open(activeProjId);
      }
    });

    const resFilter = document.getElementById('headerResourceFilter');
    resFilter?.addEventListener('change', (e) => {
      this.store.setFilterResource(e.target.value);
    });

    // Global Search
    const searchInput = document.getElementById('globalSearchInput');
    let searchTimer = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.store.setSearchQuery(e.target.value);
      }, 200);
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Direct Header Export JSON Button
    document.getElementById('btnExportJsonHeader')?.addEventListener('click', () => {
      this.triggerJsonExport();
    });

    // Direct Header Load JSON Button & File Picker
    const fileInput = document.getElementById('jsonFileInput');
    document.getElementById('btnLoadJsonHeader')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const res = this.store.importJSON(content);
        if (res.success) {
          this.showToast(`Loaded ${res.counts.projects} projects, ${res.counts.tasks} subtasks, ${res.counts.resources} people`, 'success');
        } else {
          this.showToast(`Load failed: ${res.error || 'Invalid format'}`, 'error');
          alert(`Failed to load JSON file:\n${res.error || 'Invalid format'}`);
        }
        // Reset file input so same file can be reloaded if edited
        fileInput.value = '';
      };
      reader.onerror = () => {
        this.showToast('Failed to read selected file', 'error');
        fileInput.value = '';
      };
      reader.readAsText(file);
    });

    // Data Sync Modal
    const dataModal = document.getElementById('dataModalOverlay');
    const dataArea = document.getElementById('dataJsonArea');
    document.getElementById('btnDataBackup')?.addEventListener('click', () => {
      if (dataArea) dataArea.value = this.store.exportJSON();
      dataModal?.classList.add('active');
    });

    document.getElementById('closeDataModalBtn')?.addEventListener('click', () => {
      dataModal?.classList.remove('active');
    });

    document.getElementById('btnDownloadJson')?.addEventListener('click', () => {
      this.triggerJsonExport();
    });

    document.getElementById('btnImportJson')?.addEventListener('click', () => {
      if (dataArea && dataArea.value) {
        const res = this.store.importJSON(dataArea.value);
        if (res.success) {
          dataModal?.classList.remove('active');
          this.showToast(`Imported ${res.counts.projects} projects, ${res.counts.tasks} subtasks, ${res.counts.resources} people`, 'success');
        } else {
          alert(`Invalid JSON format: ${res.error || 'Please verify the structure'}`);
        }
      }
    });

    document.getElementById('btnResetDemoData')?.addEventListener('click', () => {
      if (confirm('Reset workspace to the initial demonstration dataset? Any custom data will be replaced.')) {
        this.store.resetDemoData();
        dataModal?.classList.remove('active');
        this.showToast('Reset to demo dataset', 'info');
      }
    });

    // Auto-Solve Schedule Button
    document.getElementById('btnSolveSchedule')?.addEventListener('click', () => {
      const result = this.store.solveSchedule();
      this.updateSolveRevertButtons();
      this.renderCurrentView();
      this.messagesCenter?.update();
      this.updateKPIs();
      const extNote = result.stats.deadlinesExtended > 0 ? ` (auto-adjusted ${result.stats.deadlinesExtended} project deadline)` : '';
      this.showToast(
        `✨ Schedule Solved! Leveled ${result.stats.tasksSolved} subtasks to reach deadlines with 0 over-allocations${extNote}.`,
        'success'
      );
    });

    // Revert Schedule Button
    document.getElementById('btnRevertSchedule')?.addEventListener('click', () => {
      if (confirm('Revert schedule back to the original dates and pacing before Solve?')) {
        const reverted = this.store.revertSchedule();
        if (reverted) {
          this.updateSolveRevertButtons();
          this.renderCurrentView();
          this.messagesCenter?.update();
          this.updateKPIs();
          this.showToast('Schedule reverted to pre-solve state', 'info');
        }
      }
    });
  }

  updateSolveRevertButtons() {
    const btnRevert = document.getElementById('btnRevertSchedule');
    if (btnRevert) {
      btnRevert.style.display = this.store.hasSolveBackup() ? 'inline-flex' : 'none';
    }
  }

  switchView(viewId) {
    if (!this.views[viewId]) return;

    this.activeView = viewId;

    // Update Sidebar Navigation state
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Update Header Text
    const titleEl = document.getElementById('currentViewTitle');
    const subtitleEl = document.getElementById('currentViewSubtitle');

    const viewMeta = {
      gantt: { title: 'Gantt & Timeline', sub: 'Interactive roadmap with SVG dependency arrows & critical paths' },
      kanban: { title: 'Kanban Board', sub: 'Drag and drop subtasks across statuses with dependency warnings' },
      workload: { title: 'People & Workload', sub: 'Allocated man-hours vs sprint capacities & over-allocation alerts' },
      graph: { title: 'Dependency Topology', sub: 'Interactive node-link directed acyclic workflow diagram' },
      table: { title: 'Subtasks List', sub: 'Detailed breakdown of all tasks, effort hours, and predecessors' },
      calendar: { title: 'Working Calendar & Holidays', sub: 'Configure weekly workdays and national holidays (e.g. Italian calendar presets)' }
    };

    if (titleEl && viewMeta[viewId]) titleEl.textContent = viewMeta[viewId].title;
    if (subtitleEl && viewMeta[viewId]) subtitleEl.textContent = viewMeta[viewId].sub;

    this.renderCurrentView();
  }

  renderCurrentView() {
    const view = this.views[this.activeView];
    if (view && typeof view.render === 'function') {
      view.render();
    }
  }

  renderSidebarProjects() {
    const container = document.getElementById('sidebarProjectsList');
    if (!container) return;

    const projects = this.store.getProjects();
    const activeId = this.store.state.selectedProjectId;

    container.innerHTML = `
      <div class="project-item-pill ${activeId === 'all' ? 'active' : ''}" data-project-id="all">
        <span class="project-color-dot" style="background: var(--text-secondary);"></span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">All Projects</span>
        <span class="project-task-count" style="font-size: 0.72rem; color: var(--text-muted);">${this.store.getTasks().length}</span>
      </div>
      ${projects.map(p => {
        const pTasks = this.store.getTasks().filter(t => t.projectId === p.id);
        return `
          <div class="project-item-pill ${activeId === p.id ? 'active' : ''}" data-project-id="${p.id}">
            <span class="project-color-dot" style="background: ${p.color || '#6366f1'};"></span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(p.name)}">
              ${escapeHtml(p.name)}
            </span>
            <span class="project-task-count" style="font-size: 0.72rem; color: var(--text-muted);">${pTasks.length}</span>
            <div class="project-pill-actions">
              <button type="button" class="project-pill-action-btn edit-proj-btn" data-project-id="${p.id}" title="Edit Project">
                ✏️
              </button>
              <button type="button" class="project-pill-action-btn delete delete-proj-btn" data-project-id="${p.id}" title="Delete Project">
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('')}
    `;

    // Click project pill to filter
    container.querySelectorAll('.project-item-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        if (e.target.closest('.project-pill-actions')) return;
        const pId = pill.getAttribute('data-project-id');
        this.store.setFilterProject(pId);
        const headerSelect = document.getElementById('headerProjectFilter');
        if (headerSelect) headerSelect.value = pId;
        const headerEditProjBtn = document.getElementById('headerEditProjectBtn');
        if (headerEditProjBtn) {
          headerEditProjBtn.style.display = (pId && pId !== 'all') ? 'inline-flex' : 'none';
        }
      });
    });

    // Bind Edit Project buttons
    container.querySelectorAll('.edit-proj-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-project-id');
        if (pId) this.projectModal.open(pId);
      });
    });

    // Bind Delete Project buttons
    container.querySelectorAll('.delete-proj-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-project-id');
        const proj = this.store.getProjects().find(p => p.id === pId);
        if (!proj) return;

        const tasksCount = this.store.getTasks().filter(t => t.projectId === pId).length;
        const msg = `Are you sure you want to delete project "${proj.name}"?\n\nThis will permanently remove the project and all ${tasksCount} associated subtask(s). This action cannot be undone.`;

        if (confirm(msg)) {
          const res = this.store.deleteProject(pId);
          this.showToast(`Project "${proj.name}" and ${res.deletedTasksCount} subtask(s) removed`, 'success');
        }
      });
    });

    const peopleBadge = document.getElementById('sidebarPeopleCount');
    if (peopleBadge) peopleBadge.textContent = this.store.getResources().length;

    const holidaysBadge = document.getElementById('sidebarHolidaysCount');
    if (holidaysBadge) holidaysBadge.textContent = (this.store.getCalendar().holidays || []).length;
  }

  updateHeaderFilters() {
    const projects = this.store.getProjects();
    const resources = this.store.getResources();

    const projSelect = document.getElementById('headerProjectFilter');
    const headerEditProjBtn = document.getElementById('headerEditProjectBtn');

    if (projSelect) {
      const currVal = this.store.state.selectedProjectId || 'all';
      projSelect.innerHTML = `
        <option value="all">All Projects (${projects.length})</option>
        ${projects.map(p => `<option value="${p.id}" ${p.id === currVal ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      `;

      if (headerEditProjBtn) {
        const projExists = projects.some(p => p.id === currVal);
        headerEditProjBtn.style.display = (currVal && currVal !== 'all' && projExists) ? 'inline-flex' : 'none';
      }
    }

    const resSelect = document.getElementById('headerResourceFilter');
    if (resSelect) {
      const currRes = this.store.state.selectedResourceId || 'all';
      resSelect.innerHTML = `
        <option value="all">All People (${resources.length})</option>
        ${resources.map(r => `<option value="${r.id}" ${r.id === currRes ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
      `;
    }
  }

  updateKPIs() {
    const tasks = this.store.getFilteredTasks();
    const allTasks = this.store.getTasks();
    const projects = this.store.getProjects();
    const resources = this.store.getResources();
    const calendar = this.store.getCalendar();
    const allCalendars = this.store.getAllCalendars();

    const scheduled = ScheduleEngine.computeSchedule(tasks, resources, projects, calendar, allCalendars);
    const workloads = ScheduleEngine.calculateResourceWorkload(allTasks, resources, projects, calendar, allCalendars);

    const totalManHours = tasks.reduce((sum, t) => sum + (Number(t.durationHours) || 0), 0);
    const completedHours = tasks.reduce((sum, t) => {
      const prog = Number(t.progress) || (t.status === 'done' ? 100 : 0);
      return sum + ((Number(t.durationHours) || 0) * (prog / 100));
    }, 0);

    const criticalCount = scheduled.filter(t => t.isCritical).length;

    // Set KPI elements
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('kpiProjectsCount', projects.length);
    setVal('kpiTasksCount', tasks.length);
    setVal('kpiManHoursCount', `${totalManHours}h`);
    setVal('kpiCompletedHoursSub', `${Math.round(completedHours)}h effort done`);
    setVal('kpiPeopleCount', resources.length);
    setVal('kpiCriticalCount', criticalCount);

    // Sidebar capacity calculation
    const totalCapacity = workloads.reduce((sum, w) => sum + (w.horizonCapacityHours || w.sprintCapacityHours), 0);
    const allAllocatedHours = workloads.reduce((sum, w) => sum + w.totalAllocatedHours, 0);
    const overallUtil = totalCapacity > 0 ? Math.round((allAllocatedHours / totalCapacity) * 100) : 0;

    setVal('sidebarUtilPercent', `${overallUtil}%`);
    const fillEl = document.getElementById('sidebarUtilFill');
    if (fillEl) fillEl.style.width = `${Math.min(100, overallUtil)}%`;
  }

  triggerJsonExport() {
    const activeProjId = this.store.state.selectedProjectId;
    const isFiltered = activeProjId && activeProjId !== 'all';
    const jsonString = this.store.exportJSON({ filteredOnly: false });

    // Format clean filename with current date
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `chronogantt_project_data_${dateStr}.json`;

    // Download via Blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);

    this.showToast(`Exported project data as ${filename}`, 'success');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.chronoGanttApp = new ChronoGanttApp();
  window.nexusApp = window.chronoGanttApp;
});
