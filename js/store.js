/**
 * Data Store & State Management
 * Persistent with localStorage, pre-seeded with rich demo projects & resources
 */

const STORAGE_KEY = 'PROJECT_MANAGEMENT_APP_STATE_V1';

const INITIAL_RESOURCES = [
  {
    id: 'res-1',
    name: 'Elena Rostova',
    role: 'Lead Architect & Fullstack',
    email: 'elena.rostova@techcorp.io',
    avatarColor: '#6366f1',
    capacityHoursPerDay: 8,
    hourlyRate: 110,
    projectEffort: { 'proj-1': 80 }, // 80% on Project 1, remaining 20% auto-splits to Project 2
    assignedProjectIds: ['proj-1', 'proj-2'],
    calendarId: 'cal-it-milan', // Milan Regional (Sant'Ambrogio)
    vacations: [{ date: '2026-09-18', name: 'Personal Vacation' }]
  },
  {
    id: 'res-2',
    name: 'Marcus Chen',
    role: 'Senior Backend Engineer',
    email: 'marcus.chen@techcorp.io',
    avatarColor: '#06b6d4',
    capacityHoursPerDay: 8,
    hourlyRate: 95,
    projectEffort: { 'proj-1': 100 },
    assignedProjectIds: ['proj-1'],
    calendarId: 'cal-it-rome', // Rome Regional (SS. Pietro e Paolo)
    vacations: [{ date: '2026-09-25', name: 'Family Vacation' }]
  },
  {
    id: 'res-3',
    name: 'Sophia Davis',
    role: 'UI/UX Product Designer',
    email: 'sophia.davis@techcorp.io',
    avatarColor: '#ec4899',
    capacityHoursPerDay: 7,
    hourlyRate: 90,
    projectEffort: { 'proj-2': 100 },
    assignedProjectIds: ['proj-2'],
    calendarId: 'cal-it-national', // Italian National Calendar
    vacations: []
  },
  {
    id: 'res-4',
    name: 'David Okafor',
    role: 'DevOps & Cloud Specialist',
    email: 'david.okafor@techcorp.io',
    avatarColor: '#f59e0b',
    capacityHoursPerDay: 8,
    hourlyRate: 105,
    projectEffort: { 'proj-1': 100 },
    assignedProjectIds: ['proj-1'],
    calendarId: 'cal-us', // US Federal Calendar
    vacations: [{ date: '2026-09-21', name: 'Personal Leave' }]
  },
  {
    id: 'res-5',
    name: 'Aria Thorne',
    role: 'QA & Test Automation Lead',
    email: 'aria.thorne@techcorp.io',
    avatarColor: '#10b981',
    capacityHoursPerDay: 8,
    hourlyRate: 85,
    projectEffort: {}, // Auto split equally across assigned projects
    assignedProjectIds: ['proj-1', 'proj-2'],
    calendarId: 'cal-it-turin', // Turin Regional
    vacations: []
  }
];

const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    name: 'FinTech Cloud Platform 2.0',
    description: 'Next-generation microservices banking API with real-time settlement and compliance ledger.',
    color: '#6366f1',
    startDate: '2026-09-08',
    targetDate: '2026-10-25',
    status: 'active'
  },
  {
    id: 'proj-2',
    name: 'Mobile Customer Portal',
    description: 'Cross-platform mobile application for customer account self-service and biometrics authentication.',
    color: '#06b6d4',
    startDate: '2026-09-12',
    targetDate: '2026-11-15',
    status: 'active'
  }
];

// Tasks with dependencies and man-hour durations
const INITIAL_TASKS = [
  // Project 1 Tasks
  {
    id: 'task-101',
    projectId: 'proj-1',
    title: 'Architecture & Security Spec',
    description: 'Draft API security protocols, RBAC matrices, and latency SLAs.',
    assignedResourceIds: ['res-1'],
    assignedResourceId: 'res-1',
    durationHours: 32, // 4 man-days
    startDate: '2026-09-08',
    targetDate: '2026-09-14',
    status: 'done',
    progress: 100,
    dependencies: []
  },
  {
    id: 'task-102',
    projectId: 'proj-1',
    title: 'PostgreSQL DB & Ledger Schema',
    description: 'Design immutable database tables, partitioning, and audit logs.',
    assignedResourceIds: ['res-2'],
    assignedResourceId: 'res-2',
    durationHours: 24, // 3 man-days
    startDate: '2026-09-08',
    targetDate: '2026-09-15',
    status: 'done',
    progress: 100,
    dependencies: ['task-101']
  },
  {
    id: 'task-103',
    projectId: 'proj-1',
    title: 'Core Settlement Engine API',
    description: 'Implement atomic transaction processor in Go/Node with zero-loss guarantees.',
    assignedResourceIds: ['res-2', 'res-1'], // Multi-assignee: Marcus Chen (8h/d) + Elena Rostova (6.4h/d) = 14.4h/d combined!
    assignedResourceId: 'res-2',
    durationHours: 48,
    startDate: '2026-09-15',
    targetDate: '2026-09-18',
    status: 'in-progress',
    progress: 55,
    dependencies: ['task-102']
  },
  {
    id: 'task-104',
    projectId: 'proj-1',
    title: 'Kubernetes Cluster Provisioning',
    description: 'Setup Terraform IaC, EKS clusters, VPC peering, and secret management.',
    assignedResourceIds: ['res-4'],
    assignedResourceId: 'res-4',
    durationHours: 40,
    startDate: '2026-09-10',
    targetDate: '',
    status: 'in-progress',
    progress: 75,
    dependencies: ['task-101']
  },
  {
    id: 'task-105',
    projectId: 'proj-1',
    title: 'Integration & Stress Testing',
    description: 'Simulate 10,000 TPS load, chaos testing, and regression suites.',
    assignedResourceIds: ['res-5', 'res-2'], // Multi-assignee: Aria Thorne + Marcus Chen
    assignedResourceId: 'res-5',
    durationHours: 32,
    startDate: '2026-09-22',
    targetDate: '2026-09-28',
    status: 'todo',
    progress: 0,
    dependencies: ['task-103', 'task-104']
  },
  {
    id: 'task-106',
    projectId: 'proj-1',
    title: 'Production Cutover & Monitoring',
    description: 'Deploy Grafana dashboards, Datadog tracing, and execute canary release.',
    assignedResourceIds: ['res-4'],
    assignedResourceId: 'res-4',
    durationHours: 24,
    startDate: '2026-09-28',
    targetDate: '',
    status: 'todo',
    progress: 0,
    dependencies: ['task-105']
  },

  // Project 2 Tasks
  {
    id: 'task-201',
    projectId: 'proj-2',
    title: 'Mobile Wireframes & UI Kit',
    description: 'Figma prototypes for onboarding, biometric scan, and portfolio balance.',
    assignedResourceIds: ['res-3'],
    assignedResourceId: 'res-3',
    durationHours: 35,
    startDate: '2026-09-12',
    targetDate: '2026-09-20',
    status: 'in-progress',
    progress: 80,
    dependencies: []
  },
  {
    id: 'task-202',
    projectId: 'proj-2',
    title: 'Biometric Auth SDK Integration',
    description: 'FaceID & Fingerprint cryptographic enclave authentication flow.',
    assignedResourceIds: ['res-1', 'res-5'], // Multi-assignee: Elena Rostova + Aria Thorne
    assignedResourceId: 'res-1',
    durationHours: 24,
    startDate: '2026-09-18',
    targetDate: '',
    status: 'todo',
    progress: 0,
    dependencies: ['task-201']
  },
  {
    id: 'task-203',
    projectId: 'proj-2',
    title: 'Customer Dashboard Screens',
    description: 'React Native components for live transaction feeds and card controls.',
    assignedResourceIds: ['res-3'],
    assignedResourceId: 'res-3',
    durationHours: 42,
    startDate: '2026-09-21',
    targetDate: '',
    status: 'todo',
    progress: 0,
    dependencies: ['task-201']
  },
  {
    id: 'task-204',
    projectId: 'proj-2',
    title: 'Mobile End-to-End Test Suite',
    description: 'Appium automated tests covering login, card freezing, and payments.',
    assignedResourceIds: ['res-5'],
    assignedResourceId: 'res-5',
    durationHours: 24,
    startDate: '2026-09-29',
    targetDate: '',
    status: 'todo',
    progress: 0,
    dependencies: ['task-202', 'task-203']
  }
];

export const ITALIAN_HOLIDAYS_PRESET = [
  { date: '2026-01-01', name: 'Capodanno (New Year)' },
  { date: '2026-01-06', name: 'Epifania' },
  { date: '2026-04-05', name: 'Pasqua' },
  { date: '2026-04-06', name: 'Lunedì dell\'Angelo (Pasquetta)' },
  { date: '2026-04-25', name: 'Festa della Liberazione' },
  { date: '2026-05-01', name: 'Festa dei Lavoratori' },
  { date: '2026-06-02', name: 'Festa della Repubblica' },
  { date: '2026-08-15', name: 'Ferragosto (Assunzione)' },
  { date: '2026-11-01', name: 'Tutti i Santi (Ognissanti)' },
  { date: '2026-12-08', name: 'Immacolata Concezione' },
  { date: '2026-12-25', name: 'Natale' },
  { date: '2026-12-26', name: 'Santo Stefano' }
];

export const US_HOLIDAYS_PRESET = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day' },
  { date: '2026-02-16', name: 'Presidents\' Day' },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-06-19', name: 'Juneteenth' },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-10-12', name: 'Columbus / Indigenous Peoples Day' },
  { date: '2026-11-11', name: 'Veterans Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-12-25', name: 'Christmas Day' }
];

export const INITIAL_CALENDAR_PROFILES = [
  {
    id: 'cal-it-national',
    name: '🇮🇹 Italian National Calendar',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [...ITALIAN_HOLIDAYS_PRESET]
  },
  {
    id: 'cal-it-milan',
    name: '🇮🇹 Milan Regional (Sant\'Ambrogio)',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      ...ITALIAN_HOLIDAYS_PRESET,
      { date: '2026-12-07', name: 'Sant\'Ambrogio (Patrono Milano)' }
    ]
  },
  {
    id: 'cal-it-rome',
    name: '🇮🇹 Rome Regional (SS. Pietro e Paolo)',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      ...ITALIAN_HOLIDAYS_PRESET,
      { date: '2026-06-29', name: 'Santi Pietro e Paolo (Patroni Roma)' }
    ]
  },
  {
    id: 'cal-it-turin',
    name: '🇮🇹 Turin Regional (San Giovanni)',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      ...ITALIAN_HOLIDAYS_PRESET,
      { date: '2026-06-24', name: 'San Giovanni Battista (Patrono Torino)' }
    ]
  },
  {
    id: 'cal-it-naples',
    name: '🇮🇹 Naples Regional (San Gennaro)',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      ...ITALIAN_HOLIDAYS_PRESET,
      { date: '2026-09-19', name: 'San Gennaro (Patrono Napoli)' }
    ]
  },
  {
    id: 'cal-standard',
    name: '🌐 Standard Working Week (Mon-Fri)',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: []
  },
  {
    id: 'cal-us',
    name: '🇺🇸 US Federal Calendar',
    isPreset: true,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [...US_HOLIDAYS_PRESET]
  }
];

export const DEFAULT_CALENDAR = INITIAL_CALENDAR_PROFILES[0];

export class AppStore {
  constructor() {
    this.listeners = [];
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projects && parsed.resources && parsed.tasks) {
          // Normalize calendar profiles
          if (!Array.isArray(parsed.calendars) || parsed.calendars.length === 0) {
            parsed.calendars = JSON.parse(JSON.stringify(INITIAL_CALENDAR_PROFILES));
            if (parsed.calendar) {
              // Preserve any custom changes user previously made
              parsed.calendars[0] = { ...parsed.calendars[0], ...parsed.calendar };
            }
          }
          if (!parsed.activeCalendarId) {
            parsed.activeCalendarId = parsed.calendars[0]?.id || 'cal-it-national';
          }

          // Normalize resource local calendars and personal vacations
          if (Array.isArray(parsed.resources)) {
            const demoCalMap = {
              'res-1': 'cal-it-milan',
              'res-2': 'cal-it-rome',
              'res-3': 'cal-it-national',
              'res-4': 'cal-us',
              'res-5': 'cal-it-turin'
            };
            const demoVacMap = {
              'res-1': [{ date: '2026-09-18', name: 'Personal Vacation' }],
              'res-2': [{ date: '2026-09-25', name: 'Family Vacation' }],
              'res-4': [{ date: '2026-09-21', name: 'Personal Leave' }]
            };
            parsed.resources.forEach(r => {
              if (!r.calendarId) {
                r.calendarId = demoCalMap[r.id] || parsed.activeCalendarId || 'cal-it-national';
              }
              if (!Array.isArray(r.vacations)) {
                r.vacations = demoVacMap[r.id] || [];
              }
            });
          }

          // Normalize tasks assignedResourceIds & targetDate
          if (Array.isArray(parsed.tasks)) {
            parsed.tasks.forEach(t => {
              if (typeof t.targetDate === 'undefined' || t.targetDate === null) {
                t.targetDate = '';
              }
              if (!Array.isArray(t.assignedResourceIds)) {
                t.assignedResourceIds = t.assignedResourceId ? [t.assignedResourceId] : [];
              }
              if (!t.assignedResourceId && t.assignedResourceIds.length > 0) {
                t.assignedResourceId = t.assignedResourceIds[0];
              }
            });
          }

          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load state from localStorage, initializing defaults', err);
    }
    return {
      projects: INITIAL_PROJECTS,
      resources: INITIAL_RESOURCES,
      tasks: INITIAL_TASKS,
      calendars: JSON.parse(JSON.stringify(INITIAL_CALENDAR_PROFILES)),
      activeCalendarId: 'cal-it-national',
      selectedProjectId: 'all',
      selectedResourceId: 'all',
      searchQuery: '',
      theme: 'dark'
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error('Failed to save state to localStorage', err);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  // Getters
  getProjects() {
    return this.state.projects;
  }

  getResources() {
    return this.state.resources;
  }

  getTasks() {
    return this.state.tasks;
  }

  getFilteredTasks() {
    let filtered = [...this.state.tasks];
    if (this.state.selectedProjectId && this.state.selectedProjectId !== 'all') {
      filtered = filtered.filter(t => t.projectId === this.state.selectedProjectId);
    }
    if (this.state.selectedResourceId && this.state.selectedResourceId !== 'all') {
      filtered = filtered.filter(t => 
        (Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.includes(this.state.selectedResourceId)) ||
        t.assignedResourceId === this.state.selectedResourceId
      );
    }
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return filtered;
  }

  // Filters & Search
  setFilterProject(projectId) {
    this.state.selectedProjectId = projectId;
    this.notify();
  }

  setFilterResource(resourceId) {
    this.state.selectedResourceId = resourceId;
    this.notify();
  }

  setSearchQuery(query) {
    this.state.searchQuery = query;
    this.notify();
  }

  // Project CRUD
  addProject(project) {
    const newProj = {
      id: 'proj-' + Date.now(),
      name: project.name || 'Untitled Project',
      description: project.description || '',
      color: project.color || '#6366f1',
      startDate: project.startDate || new Date().toISOString().split('T')[0],
      targetDate: project.targetDate || '',
      status: project.status || 'active'
    };
    this.state.projects.push(newProj);
    this.saveState();
    return newProj;
  }

  updateProject(id, updates) {
    const idx = this.state.projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.state.projects[idx] = { ...this.state.projects[idx], ...updates };
      this.saveState();
    }
  }

  deleteProject(id) {
    const projToDelete = this.state.projects.find(p => p.id === id);
    if (!projToDelete) return { success: false, deletedTasksCount: 0 };

    const tasksToDelete = this.state.tasks.filter(t => t.projectId === id);
    const deletedTaskIds = new Set(tasksToDelete.map(t => t.id));

    // Remove project
    this.state.projects = this.state.projects.filter(p => p.id !== id);

    // Remove associated tasks
    this.state.tasks = this.state.tasks.filter(t => t.projectId !== id);

    // Clean up dependencies pointing to deleted tasks
    this.state.tasks.forEach(t => {
      if (Array.isArray(t.dependencies)) {
        t.dependencies = t.dependencies.filter(depId => !deletedTaskIds.has(depId));
      }
    });

    // Clean up resources projectEffort and assignedProjectIds
    if (Array.isArray(this.state.resources)) {
      this.state.resources.forEach(r => {
        if (r.projectEffort && r.projectEffort[id] !== undefined) {
          delete r.projectEffort[id];
        }
        if (Array.isArray(r.assignedProjectIds)) {
          r.assignedProjectIds = r.assignedProjectIds.filter(projId => projId !== id);
        }
      });
    }

    if (this.state.selectedProjectId === id) {
      this.state.selectedProjectId = 'all';
    }

    this.saveState();
    return {
      success: true,
      deletedProject: projToDelete,
      deletedTasksCount: tasksToDelete.length
    };
  }

  // Resource CRUD
  addResource(resource) {
    const newRes = {
      id: 'res-' + Date.now(),
      name: resource.name || 'New Team Member',
      role: resource.role || 'Member',
      email: resource.email || '',
      avatarColor: resource.avatarColor || '#6366f1',
      capacityHoursPerDay: Number(resource.capacityHoursPerDay) || 8,
      hourlyRate: Number(resource.hourlyRate) || 80,
      projectEffort: resource.projectEffort || {},
      assignedProjectIds: Array.isArray(resource.assignedProjectIds) ? resource.assignedProjectIds : [],
      calendarId: resource.calendarId || this.state.activeCalendarId || 'cal-it-national',
      vacations: Array.isArray(resource.vacations) ? resource.vacations : []
    };
    this.state.resources.push(newRes);
    this.saveState();
    return newRes;
  }

  updateResource(id, updates) {
    const idx = this.state.resources.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.state.resources[idx] = { ...this.state.resources[idx], ...updates };
      this.saveState();
    }
  }

  deleteResource(id) {
    this.state.resources = this.state.resources.filter(r => r.id !== id);
    // Unassign tasks assigned to this resource
    this.state.tasks.forEach(t => {
      if (Array.isArray(t.assignedResourceIds)) {
        t.assignedResourceIds = t.assignedResourceIds.filter(rid => rid !== id);
      }
      if (t.assignedResourceId === id) {
        t.assignedResourceId = (t.assignedResourceIds && t.assignedResourceIds[0]) || null;
      }
    });
    this.saveState();
  }

  // Subtask CRUD
  addTask(task) {
    const assignedResourceIds = Array.isArray(task.assignedResourceIds) 
      ? task.assignedResourceIds 
      : (task.assignedResourceId ? [task.assignedResourceId] : []);

    const newTask = {
      id: 'task-' + Date.now(),
      projectId: task.projectId,
      title: task.title || 'Untitled Subtask',
      description: task.description || '',
      assignedResourceIds: assignedResourceIds,
      assignedResourceId: assignedResourceIds[0] || null,
      durationHours: Math.max(1, Number(task.durationHours) || 8),
      startDate: task.startDate || new Date().toISOString().split('T')[0],
      targetDate: task.targetDate ? String(task.targetDate).trim() : '',
      status: task.status || 'todo',
      progress: Number(task.progress) || 0,
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : []
    };
    this.state.tasks.push(newTask);
    this.saveState();
    return newTask;
  }

  updateTask(id, updates) {
    const idx = this.state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      const merged = { ...this.state.tasks[idx], ...updates };
      if (updates.targetDate !== undefined) {
        merged.targetDate = updates.targetDate ? String(updates.targetDate).trim() : '';
      }
      if (Array.isArray(merged.assignedResourceIds)) {
        merged.assignedResourceId = merged.assignedResourceIds[0] || null;
      } else if (merged.assignedResourceId) {
        merged.assignedResourceIds = [merged.assignedResourceId];
      } else {
        merged.assignedResourceIds = [];
        merged.assignedResourceId = null;
      }
      this.state.tasks[idx] = merged;
      this.saveState();
    }
  }

  updateTaskStatus(id, newStatus) {
    const task = this.state.tasks.find(t => t.id === id);
    if (task) {
      task.status = newStatus;
      if (newStatus === 'done') {
        task.progress = 100;
      } else if (newStatus === 'todo' && task.progress === 100) {
        task.progress = 0;
      }
      this.saveState();
    }
  }

  deleteTask(id) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    // Remove as dependency from other tasks
    this.state.tasks.forEach(t => {
      if (Array.isArray(t.dependencies)) {
        t.dependencies = t.dependencies.filter(depId => depId !== id);
      }
    });
    this.saveState();
  }

  // Calendar Multi-Profile CRUD & Preset Helpers
  getAllCalendars() {
    if (!Array.isArray(this.state.calendars) || this.state.calendars.length === 0) {
      this.state.calendars = JSON.parse(JSON.stringify(INITIAL_CALENDAR_PROFILES));
    }
    return this.state.calendars;
  }

  getCalendar() {
    const all = this.getAllCalendars();
    const active = all.find(c => c.id === this.state.activeCalendarId);
    return active || all[0] || DEFAULT_CALENDAR;
  }

  setActiveCalendar(calendarId) {
    const all = this.getAllCalendars();
    if (all.some(c => c.id === calendarId)) {
      this.state.activeCalendarId = calendarId;
      this.saveState();
    }
  }

  cloneCalendar(sourceId, newName) {
    const all = this.getAllCalendars();
    const source = all.find(c => c.id === sourceId) || this.getCalendar();
    const clonedName = newName && newName.trim() ? newName.trim() : `${source.name} (Copy)`;
    
    const cloned = {
      id: 'cal-' + Date.now(),
      name: clonedName,
      isCustom: true,
      workingDays: [...(source.workingDays || [1, 2, 3, 4, 5])],
      holidays: JSON.parse(JSON.stringify(source.holidays || []))
    };

    all.push(cloned);
    this.state.activeCalendarId = cloned.id;
    this.saveState();
    return cloned;
  }

  createNewCalendar(name, copyHolidaysFromActive = false) {
    const all = this.getAllCalendars();
    const active = this.getCalendar();
    const calName = name && name.trim() ? name.trim() : 'Custom Regional Calendar';

    const newCal = {
      id: 'cal-' + Date.now(),
      name: calName,
      isCustom: true,
      workingDays: [1, 2, 3, 4, 5],
      holidays: copyHolidaysFromActive ? JSON.parse(JSON.stringify(active.holidays || [])) : []
    };

    all.push(newCal);
    this.state.activeCalendarId = newCal.id;
    this.saveState();
    return newCal;
  }

  deleteCalendar(calendarId) {
    const all = this.getAllCalendars();
    if (all.length <= 1) {
      return false; // Cannot delete the only remaining calendar
    }

    this.state.calendars = all.filter(c => c.id !== calendarId);
    if (this.state.activeCalendarId === calendarId) {
      this.state.activeCalendarId = this.state.calendars[0].id;
    }
    this.saveState();
    return true;
  }

  renameCalendar(calendarId, newName) {
    const all = this.getAllCalendars();
    const cal = all.find(c => c.id === calendarId);
    if (cal && newName && newName.trim()) {
      cal.name = newName.trim();
      this.saveState();
    }
  }

  updateCalendar(updates) {
    const cal = this.getCalendar();
    Object.assign(cal, updates);
    this.saveState();
  }

  setWorkingDays(workingDays) {
    const cal = this.getCalendar();
    cal.workingDays = Array.isArray(workingDays) ? workingDays.sort() : [1, 2, 3, 4, 5];
    this.saveState();
  }

  addHoliday(holiday) {
    const cal = this.getCalendar();
    if (!Array.isArray(cal.holidays)) cal.holidays = [];
    
    // Holiday name can be left empty as per user request
    const holidayName = holiday.name !== undefined && holiday.name !== null ? holiday.name.trim() : '';

    // Prevent duplicate date
    cal.holidays = cal.holidays.filter(h => h.date !== holiday.date);
    cal.holidays.push({
      date: holiday.date,
      name: holidayName
    });
    cal.holidays.sort((a, b) => a.date.localeCompare(b.date));
    this.saveState();
  }

  updateHoliday(oldDate, updatedHoliday) {
    const cal = this.getCalendar();
    if (!Array.isArray(cal.holidays)) cal.holidays = [];
    
    const holidayName = updatedHoliday.name !== undefined && updatedHoliday.name !== null ? updatedHoliday.name.trim() : '';
    const newDate = updatedHoliday.date;

    // Remove old date and prevent duplicate if date was changed
    cal.holidays = cal.holidays.filter(h => h.date !== oldDate && h.date !== newDate);
    cal.holidays.push({
      date: newDate,
      name: holidayName
    });
    cal.holidays.sort((a, b) => a.date.localeCompare(b.date));
    this.saveState();
  }

  deleteHoliday(date) {
    const cal = this.getCalendar();
    if (Array.isArray(cal.holidays)) {
      cal.holidays = cal.holidays.filter(h => h.date !== date);
      this.saveState();
    }
  }

  extendHolidaysToNextYear() {
    const cal = this.getCalendar();
    if (!Array.isArray(cal.holidays) || cal.holidays.length === 0) {
      return { addedCount: 0, nextYear: null };
    }

    // Determine highest year among current holidays
    let maxYear = 2026;
    cal.holidays.forEach(h => {
      const yr = parseInt(h.date.split('-')[0], 10);
      if (!isNaN(yr) && yr > maxYear) maxYear = yr;
    });

    const nextYear = maxYear + 1;
    const existingDates = new Set(cal.holidays.map(h => h.date));
    let addedCount = 0;

    // Extend holidays from the maxYear
    const sourceHolidays = cal.holidays.filter(h => h.date.startsWith(`${maxYear}-`));
    const listToExtend = sourceHolidays.length > 0 ? sourceHolidays : cal.holidays;

    listToExtend.forEach(h => {
      const parts = h.date.split('-');
      if (parts.length === 3) {
        let month = parts[1];
        let day = parts[2];
        // Handle leap day Feb 29
        if (month === '02' && day === '29') {
          day = '28';
        }
        const nextDate = `${nextYear}-${month}-${day}`;
        if (!existingDates.has(nextDate)) {
          existingDates.add(nextDate);
          cal.holidays.push({
            date: nextDate,
            name: h.name || ''
          });
          addedCount++;
        }
      }
    });

    cal.holidays.sort((a, b) => a.date.localeCompare(b.date));
    this.saveState();

    return { addedCount, nextYear };
  }

  // Reset to default demo data
  resetDemoData() {
    this.state.projects = INITIAL_PROJECTS;
    this.state.resources = INITIAL_RESOURCES;
    this.state.tasks = INITIAL_TASKS;
    this.state.calendar = DEFAULT_CALENDAR;
    this.saveState();
  }

  // Export JSON (supports full workspace or active filtered project)
  exportJSON(options = {}) {
    const { filteredOnly = false } = options;
    let projectsToExport = [...this.state.projects];
    let tasksToExport = [...this.state.tasks];
    let resourcesToExport = [...this.state.resources];

    if (filteredOnly && this.state.selectedProjectId && this.state.selectedProjectId !== 'all') {
      projectsToExport = projectsToExport.filter(p => p.id === this.state.selectedProjectId);
      tasksToExport = tasksToExport.filter(t => t.projectId === this.state.selectedProjectId);
      const usedResourceIds = new Set();
      tasksToExport.forEach(t => {
        if (Array.isArray(t.assignedResourceIds)) {
          t.assignedResourceIds.forEach(id => usedResourceIds.add(id));
        } else if (t.assignedResourceId) {
          usedResourceIds.add(t.assignedResourceId);
        }
      });
      resourcesToExport = resourcesToExport.filter(r => usedResourceIds.has(r.id));
    }

    const exportPayload = {
      app: 'ChronoGantt',
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      summary: {
        totalProjects: projectsToExport.length,
        totalTasks: tasksToExport.length,
        totalResources: resourcesToExport.length,
        totalManHours: tasksToExport.reduce((acc, t) => acc + (Number(t.durationHours) || 0), 0)
      },
      calendar: this.getCalendar(),
      calendars: this.getAllCalendars(),
      activeCalendarId: this.state.activeCalendarId,
      projects: projectsToExport,
      resources: resourcesToExport,
      tasks: tasksToExport
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  // Import JSON with validation and normalization
  importJSON(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'File content must be a valid JSON object' };
      }

      // Check for valid projects and tasks arrays
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const resources = Array.isArray(data.resources) ? data.resources : [];
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];

      if (projects.length === 0 && tasks.length === 0) {
        return { success: false, error: 'JSON does not contain any valid projects or subtasks' };
      }

      // Normalize tasks
      const normalizedTasks = tasks.map((t, idx) => {
        const assignees = Array.isArray(t.assignedResourceIds)
          ? t.assignedResourceIds
          : (t.assignedResourceId ? [t.assignedResourceId] : []);
        return {
          id: t.id || `task-${Date.now()}-${idx}`,
          projectId: t.projectId || (projects[0]?.id || 'proj-default'),
          title: t.title || 'Untitled Subtask',
          description: t.description || '',
          assignedResourceIds: assignees,
          assignedResourceId: assignees[0] || null,
          durationHours: Math.max(1, Number(t.durationHours) || 8),
          startDate: t.startDate || new Date().toISOString().split('T')[0],
          targetDate: t.targetDate ? String(t.targetDate).trim() : '',
          status: t.status || 'todo',
          progress: Number(t.progress) || 0,
          dependencies: Array.isArray(t.dependencies) ? t.dependencies : []
        };
      });

      // Normalize projects
      const normalizedProjects = projects.map((p, idx) => ({
        id: p.id || `proj-${Date.now()}-${idx}`,
        name: p.name || 'Untitled Project',
        description: p.description || '',
        color: p.color || '#6366f1',
        startDate: p.startDate || new Date().toISOString().split('T')[0],
        targetDate: p.targetDate || '',
        status: p.status || 'active'
      }));

      // Normalize resources
      const normalizedResources = resources.map((r, idx) => ({
        id: r.id || `res-${Date.now()}-${idx}`,
        name: r.name || 'Team Member',
        role: r.role || 'Member',
        email: r.email || '',
        avatarColor: r.avatarColor || '#6366f1',
        capacityHoursPerDay: Number(r.capacityHoursPerDay) || 8,
        hourlyRate: Number(r.hourlyRate) || 80,
        projectEffort: r.projectEffort || {},
        assignedProjectIds: Array.isArray(r.assignedProjectIds) ? r.assignedProjectIds : [],
        calendarId: r.calendarId || 'cal-it-national',
        vacations: Array.isArray(r.vacations) ? r.vacations : []
      }));

      if (Array.isArray(data.calendars) && data.calendars.length > 0) {
        this.state.calendars = data.calendars;
        this.state.activeCalendarId = data.activeCalendarId || data.calendars[0].id;
      } else if (data.calendar && Array.isArray(data.calendar.workingDays)) {
        const active = this.getCalendar();
        Object.assign(active, data.calendar);
      }

      this.state.projects = normalizedProjects;
      this.state.resources = normalizedResources;
      this.state.tasks = normalizedTasks;
      this.state.selectedProjectId = 'all';
      this.state.selectedResourceId = 'all';

      this.saveState();

      return {
        success: true,
        counts: {
          projects: normalizedProjects.length,
          tasks: normalizedTasks.length,
          resources: normalizedResources.length
        }
      };
    } catch (e) {
      console.error('Import parse failed', e);
      return { success: false, error: e.message };
    }
  }
}
