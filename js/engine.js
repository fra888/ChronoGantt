/**
 * Project Management Dependency & Scheduling Engine
 * - Topological sorting & cycle detection (DAG)
 * - Auto-scheduling based on start dates, man-hours effort & resource capacity
 * - Critical Path Method (CPM - Early/Late times, Float/Slack)
 * - Resource workload & utilization calculations
 */

export class ScheduleEngine {
  /**
   * Check if adding dependency creates a cycle
   * @param {Array} tasks - All subtasks
   * @param {string} taskId - Target task id
   * @param {string} prerequisiteId - Candidate dependency id
   * @returns {boolean} true if cycle would be formed
   */
  static wouldCreateCycle(tasks, taskId, prerequisiteId) {
    if (taskId === prerequisiteId) return true;

    // Check if taskId is an ancestor of prerequisiteId
    const visited = new Set();
    const queue = [prerequisiteId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === taskId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const task = tasks.find(t => t.id === currentId);
      if (task && Array.isArray(task.dependencies)) {
        for (const depId of task.dependencies) {
          queue.push(depId);
        }
      }
    }

    return false;
  }

  /**
   * Topological sort of tasks
   * @param {Array} tasks 
   * @returns {Array} Sorted tasks or empty array if cycle exists
   */
  static topologicalSort(tasks) {
    const adj = new Map();
    const inDegree = new Map();

    tasks.forEach(t => {
      adj.set(t.id, []);
      inDegree.set(t.id, 0);
    });

    tasks.forEach(t => {
      if (Array.isArray(t.dependencies)) {
        t.dependencies.forEach(depId => {
          if (adj.has(depId)) {
            adj.get(depId).push(t.id);
            inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
          }
        });
      }
    });

    const queue = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const result = [];
    while (queue.length > 0) {
      const u = queue.shift();
      const task = tasks.find(t => t.id === u);
      if (task) result.push(task);

      if (adj.has(u)) {
        adj.get(u).forEach(v => {
          inDegree.set(v, inDegree.get(v) - 1);
          if (inDegree.get(v) === 0) {
            queue.push(v);
          }
        });
      }
    }

    // If result has fewer tasks than input, there is a cycle
    return result.length === tasks.length ? result : tasks;
  }

  /**
   * Helper to format date as YYYY-MM-DD
   */
  static toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Check if a given date is a working day based on calendar working days and holidays/vacations
   * @param {Date} date
   * @param {Object} calendar
   * @returns {boolean}
   */
  static isWorkingDay(date, calendar = null) {
    // Default: Monday (1) through Friday (5)
    const workingDays = calendar && Array.isArray(calendar.workingDays) 
      ? calendar.workingDays 
      : [1, 2, 3, 4, 5];

    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (!workingDays.includes(dayOfWeek)) {
      return false;
    }

    // Check national/regional holidays & personal vacations
    if (calendar && Array.isArray(calendar.holidays)) {
      const dateStr = this.toDateKey(date);
      if (calendar.holidays.some(h => h.date === dateStr)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Adds working days to a date skipping non-working days, holidays, & personal vacations
   * @param {Date} startDate 
   * @param {number} days 
   * @param {Object} calendar
   * @returns {Date}
   */
  static addWorkDays(startDate, days, calendar = null) {
    return this.addWorkDaysWithDetails(startDate, days, calendar).endDate;
  }

  /**
   * Adds working days to a date and records detailed skipped holidays and vacation days
   * @param {Date} startDate 
   * @param {number} days 
   * @param {Object} calendar 
   * @returns {Object} { endDate: Date, skippedDays: Array }
   */
  static addWorkDaysWithDetails(startDate, days, calendar = null) {
    const result = new Date(startDate);
    const count = Math.max(1, Math.ceil(days));
    const skippedDays = [];

    // Ensure start day is a working day
    while (!this.isWorkingDay(result, calendar)) {
      const dateStr = this.toDateKey(result);
      const holiday = calendar?.holidays?.find(h => h.date === dateStr);
      skippedDays.push({
        date: dateStr,
        name: holiday?.name || 'Non-working day',
        isHoliday: !!holiday,
        isPersonalVacation: !!holiday?.isPersonalVacation
      });
      result.setDate(result.getDate() + 1);
    }

    let added = 0;
    while (added < count - 1) {
      result.setDate(result.getDate() + 1);
      if (this.isWorkingDay(result, calendar)) {
        added++;
      } else {
        const dateStr = this.toDateKey(result);
        const holiday = calendar?.holidays?.find(h => h.date === dateStr);
        skippedDays.push({
          date: dateStr,
          name: holiday?.name || 'Non-working day',
          isHoliday: !!holiday,
          isPersonalVacation: !!holiday?.isPersonalVacation
        });
      }
    }

    return { endDate: result, skippedDays };
  }

  /**
   * Resolve effective calendar for a resource, merging their assigned regional profile
   * and individual vacation days.
   * @param {Object} resource 
   * @param {Object} defaultCalendar 
   * @param {Array} allCalendars 
   * @returns {Object}
   */
  static getResourceEffectiveCalendar(resource, defaultCalendar = null, allCalendars = []) {
    let baseCal = defaultCalendar;
    if (resource && resource.calendarId && Array.isArray(allCalendars) && allCalendars.length > 0) {
      const found = allCalendars.find(c => c.id === resource.calendarId);
      if (found) baseCal = found;
    }

    const workingDays = baseCal && Array.isArray(baseCal.workingDays)
      ? [...baseCal.workingDays]
      : [1, 2, 3, 4, 5];

    const holidays = baseCal && Array.isArray(baseCal.holidays)
      ? [...baseCal.holidays]
      : [];

    // Combine with personal vacation days
    const combinedHolidays = [...holidays];
    if (resource && Array.isArray(resource.vacations)) {
      resource.vacations.forEach(v => {
        const vDate = typeof v === 'string' ? v : v.date;
        const vName = typeof v === 'string' ? 'Personal Vacation' : (v.name || 'Personal Vacation');
        if (vDate && !combinedHolidays.some(h => h.date === vDate)) {
          combinedHolidays.push({
            date: vDate,
            name: `${resource.name}: ${vName}`,
            isPersonalVacation: true
          });
        }
      });
    }

    return {
      id: resource?.calendarId || baseCal?.id || 'default',
      name: baseCal?.name || 'Standard Working Week',
      workingDays,
      holidays: combinedHolidays,
      personalVacations: resource && Array.isArray(resource.vacations) ? resource.vacations : []
    };
  }

  /**
   * Calculate effective project effort percentages for a resource across projects
   * Handles explicit allocations, validates sum <= 100%, and divides remaining effort
   * equally among assigned projects with no specified effort.
   * @param {Object} resource 
   * @param {Array} allProjects 
   * @param {Array} allTasks 
   * @returns {Object} { allocations: Map, totalExplicit, remaining, autoPercentEach, isValid, error }
   */
  static calculateResourceProjectAllocations(resource, allProjects = [], allTasks = []) {
    if (!resource) {
      return { allocations: new Map(), totalExplicit: 0, remaining: 100, autoPercentEach: 0, isValid: true, error: null };
    }

    const dailyCap = Number(resource.capacityHoursPerDay) || 8;
    const projectEffort = resource.projectEffort || {}; // { [projectId]: number }

    // Discover all projects this resource is associated with
    const assignedProjectIds = new Set();

    if (Array.isArray(resource.assignedProjectIds)) {
      resource.assignedProjectIds.forEach(id => assignedProjectIds.add(id));
    }

    Object.keys(projectEffort).forEach(id => {
      if (allProjects.some(p => p.id === id)) {
        assignedProjectIds.add(id);
      }
    });

    allTasks.forEach(t => {
      const isAssigned = (Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.includes(resource.id)) ||
        t.assignedResourceId === resource.id;
      if (isAssigned && t.projectId) {
        assignedProjectIds.add(t.projectId);
      }
    });

    // If no projects explicitly marked, but projects exist in workspace, default to all assigned projects
    const projectList = Array.from(assignedProjectIds)
      .map(id => allProjects.find(p => p.id === id))
      .filter(Boolean);

    // If still empty and projects exist, consider all workspace projects
    const targetProjects = projectList.length > 0 ? projectList : allProjects;

    let explicitSum = 0;
    const explicitProjects = [];
    const unspecifiedProjects = [];

    targetProjects.forEach(proj => {
      const val = projectEffort[proj.id];
      if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
        const numVal = Math.max(0, Number(val));
        explicitSum += numVal;
        explicitProjects.push({ proj, percent: numVal });
      } else {
        unspecifiedProjects.push(proj);
      }
    });

    const isValid = explicitSum <= 100;
    const error = !isValid 
      ? `Total specified effort is ${explicitSum}%, which exceeds the 100% maximum capacity by ${explicitSum - 100}%!` 
      : null;

    const remainingPercent = Math.max(0, 100 - explicitSum);
    const autoPercentEach = unspecifiedProjects.length > 0 
      ? Math.round((remainingPercent / unspecifiedProjects.length) * 10) / 10 
      : 0;

    const allocations = new Map();

    explicitProjects.forEach(({ proj, percent }) => {
      const hoursPerDay = Math.round((dailyCap * (percent / 100)) * 10) / 10;
      allocations.set(proj.id, {
        projectId: proj.id,
        projectName: proj.name,
        projectColor: proj.color,
        percent,
        hoursPerDay,
        isAuto: false
      });
    });

    unspecifiedProjects.forEach(proj => {
      const hoursPerDay = Math.round((dailyCap * (autoPercentEach / 100)) * 10) / 10;
      allocations.set(proj.id, {
        projectId: proj.id,
        projectName: proj.name,
        projectColor: proj.color,
        percent: autoPercentEach,
        hoursPerDay,
        isAuto: true
      });
    });

    return {
      allocations,
      totalExplicit: explicitSum,
      remaining: remainingPercent,
      autoPercentEach,
      isValid,
      error
    };
  }

  /**
   * Compute schedule dates & critical path for tasks, incorporating each user's
   * local regional calendar and personal vacations to skip non-working days.
   * @param {Array} tasks 
   * @param {Array} resources 
   * @param {Array} projects
   * @param {Object} calendar Default workspace calendar
   * @param {Array} allCalendars All regional calendars list
   * @returns {Array} Enhanced tasks with computedStartDate, computedEndDate, durationDays, isCritical, float, skippedVacationDays
   */
  static computeSchedule(tasks, resources = [], projects = [], calendar = null, allCalendars = []) {
    if (!tasks || tasks.length === 0) return [];

    const resourceMap = new Map(resources.map(r => [r.id, r]));
    const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
    const sortedTasks = this.topologicalSort(Array.from(taskMap.values()));

    // Pre-calculate project allocations for all resources
    const resourceAllocations = new Map();
    resources.forEach(r => {
      resourceAllocations.set(r.id, this.calculateResourceProjectAllocations(r, projects, tasks));
    });

    // Helper: test if at least one assigned team member can work on date (or workspace calendar if unassigned)
    const canTeamWorkOnDate = (date, teamInfo, defaultCal) => {
      if (!teamInfo || teamInfo.length === 0) {
        return this.isWorkingDay(date, defaultCal);
      }
      return teamInfo.some(item => this.isWorkingDay(date, item.effectiveCal));
    };

    // 1. Forward Pass: Calculate Early Start (ES) & Early Finish (EF)
    sortedTasks.forEach(task => {
      // Support both assignedResourceIds array and legacy assignedResourceId
      const assignedIds = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
        ? task.assignedResourceIds
        : (task.assignedResourceId ? [task.assignedResourceId] : []);

      const assignedResources = assignedIds.map(id => resourceMap.get(id)).filter(Boolean);

      // Pre-calculate each assigned resource's effective daily capacity on this project and their calendar
      const assignedTeamInfo = assignedResources.map(resource => {
        let dailyCapacity = Number(resource.capacityHoursPerDay) || 8;
        const allocInfo = resourceAllocations.get(resource.id);
        if (allocInfo && allocInfo.allocations.has(task.projectId)) {
          const projAlloc = allocInfo.allocations.get(task.projectId);
          if (projAlloc && projAlloc.percent > 0) {
            dailyCapacity = Math.max(0.1, (Number(resource.capacityHoursPerDay) || 8) * (projAlloc.percent / 100));
          }
        }
        const effectiveCal = this.getResourceEffectiveCalendar(resource, calendar, allCalendars);
        return {
          resource,
          dailyCapacity: Math.round(dailyCapacity * 10) / 10,
          effectiveCal
        };
      });

      task.assignedTeamInfo = assignedTeamInfo;
      task.assignedResourceIds = assignedIds;
      task.assignedResourceId = assignedIds[0] || null;

      // Combined team daily capacity on standard working days
      let teamDailyCapacity = assignedTeamInfo.reduce((sum, item) => sum + item.dailyCapacity, 0);
      if (teamDailyCapacity <= 0) {
        teamDailyCapacity = 8; // Fallback for unassigned task
      }
      task.effectiveDailyCapacity = Math.round(teamDailyCapacity * 10) / 10;

      const durationHours = Math.max(1, Number(task.durationHours) || 8);

      // Determine starting date
      let earliestPossibleStart = task.startDate ? new Date(task.startDate) : new Date();
      earliestPossibleStart.setHours(0, 0, 0, 0);

      // Check all dependencies finish dates
      if (Array.isArray(task.dependencies) && task.dependencies.length > 0) {
        let maxDepFinish = null;
        task.dependencies.forEach(depId => {
          const depTask = taskMap.get(depId);
          if (depTask && depTask.computedEndDate) {
            const nextStart = new Date(depTask.computedEndDate);
            nextStart.setDate(nextStart.getDate() + 1);

            // Skip days until team can work
            while (!canTeamWorkOnDate(nextStart, assignedTeamInfo, calendar)) {
              nextStart.setDate(nextStart.getDate() + 1);
            }
            if (!maxDepFinish || nextStart > maxDepFinish) {
              maxDepFinish = nextStart;
            }
          }
        });

        if (maxDepFinish && maxDepFinish > earliestPossibleStart) {
          earliestPossibleStart = maxDepFinish;
        }
      }

      // Ensure start date is on a day where the team can work
      while (!canTeamWorkOnDate(earliestPossibleStart, assignedTeamInfo, calendar)) {
        earliestPossibleStart.setDate(earliestPossibleStart.getDate() + 1);
      }

      // Multi-resource burn timeline simulation
      let remainingHours = durationHours;
      let workingDaysCount = 0;
      const skippedDays = [];
      const curr = new Date(earliestPossibleStart);
      let loopCount = 0;

      // Optional daily pacing/burn limit set by solver or user
      const dailyPaceLimit = (typeof task.dailyBurnHours === 'number' && task.dailyBurnHours > 0)
        ? task.dailyBurnHours
        : 0;

      while (remainingHours > 0 && loopCount < 1825) {
        loopCount++;
        let hoursBurnedToday = 0;

        if (assignedTeamInfo.length > 0) {
          let teamCapacityToday = 0;
          assignedTeamInfo.forEach(({ dailyCapacity, effectiveCal, resource }) => {
            if (this.isWorkingDay(curr, effectiveCal)) {
              teamCapacityToday += dailyCapacity;
            } else {
              const dateKey = this.toDateKey(curr);
              const holiday = effectiveCal?.holidays?.find(h => h.date === dateKey);
              if (holiday) {
                skippedDays.push({
                  date: dateKey,
                  name: `${resource.name}: ${holiday.name}`,
                  isHoliday: true
                });
              }
            }
          });
          if (teamCapacityToday > 0) {
            hoursBurnedToday = dailyPaceLimit > 0
              ? Math.min(teamCapacityToday, dailyPaceLimit)
              : teamCapacityToday;
          }
        } else {
          if (this.isWorkingDay(curr, calendar)) {
            hoursBurnedToday = dailyPaceLimit > 0 ? Math.min(8, dailyPaceLimit) : 8;
          } else {
            const dateKey = this.toDateKey(curr);
            const holiday = calendar?.holidays?.find(h => h.date === dateKey);
            if (holiday) {
              skippedDays.push({ date: dateKey, name: holiday.name, isHoliday: true });
            }
          }
        }

        if (hoursBurnedToday > 0) {
          workingDaysCount++;
          remainingHours -= hoursBurnedToday;
          if (remainingHours <= 0) {
            break; // Task finishes on curr day
          }
        }

        curr.setDate(curr.getDate() + 1);
      }

      const computedEnd = new Date(curr);
      task.durationDays = Math.max(1, workingDaysCount);

      // Deduplicate skipped vacation days
      const uniqueSkipped = [];
      const seen = new Set();
      skippedDays.forEach(s => {
        const key = `${s.date}-${s.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSkipped.push(s);
        }
      });
      task.skippedVacationDays = uniqueSkipped;

      task.computedStartDate = earliestPossibleStart;
      task.computedEndDate = computedEnd;
      task.es = earliestPossibleStart.getTime();
      task.ef = computedEnd.getTime();

      // Target Date analysis (optional deadline)
      if (task.targetDate && task.targetDate.trim() && task.computedEndDate) {
        const target = new Date(task.targetDate);
        target.setHours(0, 0, 0, 0);
        const finish = new Date(task.computedEndDate);
        finish.setHours(0, 0, 0, 0);
        const diffTime = finish.getTime() - target.getTime();
        const diffDays = Math.round(diffTime / (24 * 60 * 60 * 1000));
        task.isTargetMissed = diffDays > 0;
        task.targetDiffDays = Math.max(0, diffDays);
      } else {
        task.isTargetMissed = false;
        task.targetDiffDays = 0;
      }

      taskMap.set(task.id, task);
    });

    // 2. Backward Pass: Calculate Late Finish (LF) & Late Start (LS) for Critical Path
    const reverseSorted = [...sortedTasks].reverse();
    const maxProjectFinish = Math.max(...sortedTasks.map(t => t.ef || 0));

    reverseSorted.forEach(task => {
      const successors = sortedTasks.filter(s => Array.isArray(s.dependencies) && s.dependencies.includes(task.id));

      if (successors.length === 0) {
        task.lf = task.ef || maxProjectFinish;
      } else {
        let minSuccessorLs = Math.min(...successors.map(s => s.ls || s.es));
        task.lf = minSuccessorLs;
      }

      const dayMs = 24 * 60 * 60 * 1000;
      task.ls = task.lf - ((task.durationDays - 1) * dayMs);

      // Float / Slack
      task.float = Math.max(0, Math.round((task.ls - task.es) / dayMs));
      task.isCritical = task.float <= 0;

      taskMap.set(task.id, task);
    });

    // Group tasks project by project, preserving topological order within each project
    const topologicalOrder = new Map();
    sortedTasks.forEach((t, idx) => topologicalOrder.set(t.id, idx));

    const projectOrder = new Map();
    if (Array.isArray(projects) && projects.length > 0) {
      projects.forEach((p, idx) => projectOrder.set(p.id, idx));
    }

    const scheduledList = Array.from(taskMap.values());
    scheduledList.sort((a, b) => {
      const pA = projectOrder.has(a.projectId) ? projectOrder.get(a.projectId) : 9999;
      const pB = projectOrder.has(b.projectId) ? projectOrder.get(b.projectId) : 9999;
      if (pA !== pB) return pA - pB;

      const tA = topologicalOrder.get(a.id) ?? 9999;
      const tB = topologicalOrder.get(b.id) ?? 9999;
      return tA - tB;
    });

    return scheduledList;
  }

  /**
   * Calculate detailed resource workloads & allocations, dividing task effort proportionally
   * among multiple assigned team members based on their effective project capacity.
   * @param {Array} tasks 
   * @param {Array} resources 
   * @param {Array} projects
   * @returns {Array} Array of resource summaries with utilization and allocated hours
   */
  /**
   * Count working days between two dates inclusive
   */
  static countWorkingDays(startDate, endDate, calendar = null) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (start > end) return 0;

    let count = 0;
    const curr = new Date(start);
    let guard = 0;
    while (curr <= end && guard < 3650) {
      guard++;
      if (this.isWorkingDay(curr, calendar)) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }

  /**
   * Calculate detailed resource workloads & allocations, dividing task effort proportionally
   * among multiple assigned team members based on their effective project capacity.
   * Accurately detects true concurrent daily over-allocations, deadline deficits,
   * and project horizon capacity rather than comparing lifetime task backlog to a single 10-day sprint.
   * @param {Array} tasks 
   * @param {Array} resources 
   * @param {Array} projects
   * @param {Object} calendar
   * @param {Array} allCalendars
   * @returns {Array} Array of resource summaries with utilization and allocated hours
   */
  static calculateResourceWorkload(tasks, resources, projects = [], calendar = null, allCalendars = []) {
    if (!resources || resources.length === 0) return [];

    // Ensure we have computed schedule with dates
    let scheduledTasks = tasks;
    const needsSchedule = tasks.some(t => !t.computedStartDate || !t.computedEndDate);
    if (needsSchedule && tasks.length > 0) {
      scheduledTasks = this.computeSchedule(tasks, resources, projects, calendar, allCalendars);
    }

    return resources.map(resource => {
      const dailyCap = Number(resource.capacityHoursPerDay) || 8;
      const effectiveCal = this.getResourceEffectiveCalendar(resource, calendar, allCalendars);

      const assignedTasks = scheduledTasks.filter(t => {
        const ids = Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.length > 0
          ? t.assignedResourceIds
          : (t.assignedResourceId ? [t.assignedResourceId] : []);
        return ids.includes(resource.id);
      });

      let totalAllocatedHours = 0;
      let completedHours = 0;
      const dailyLoadMap = new Map(); // 'YYYY-MM-DD' -> total hours allocated on that day

      assignedTasks.forEach(task => {
        const taskHours = Number(task.durationHours) || 0;
        const assignedIds = Array.isArray(task.assignedResourceIds) && task.assignedResourceIds.length > 0
          ? task.assignedResourceIds
          : (task.assignedResourceId ? [task.assignedResourceId] : []);

        let resourceTaskShare = taskHours;
        let resourceDailyRate = dailyCap;

        if (assignedIds.length > 1) {
          let totalTeamCap = 0;
          let thisResourceCap = 0;

          assignedIds.forEach(id => {
            const r = resources.find(item => item.id === id);
            if (r) {
              const alloc = this.calculateResourceProjectAllocations(r, projects, tasks);
              const pAlloc = alloc.allocations.get(task.projectId);
              const cap = pAlloc ? pAlloc.hoursPerDay : (Number(r.capacityHoursPerDay) || 8);
              totalTeamCap += cap;
              if (id === resource.id) thisResourceCap = cap;
            }
          });

          if (totalTeamCap > 0 && thisResourceCap > 0) {
            resourceTaskShare = Math.round((taskHours * (thisResourceCap / totalTeamCap)) * 10) / 10;
            resourceDailyRate = thisResourceCap;
          } else {
            resourceTaskShare = Math.round((taskHours / assignedIds.length) * 10) / 10;
            resourceDailyRate = Math.round((dailyCap / assignedIds.length) * 10) / 10;
          }
        } else {
          // Single assignee: check project effort allocation
          const alloc = this.calculateResourceProjectAllocations(resource, projects, tasks);
          const pAlloc = alloc.allocations.get(task.projectId);
          if (pAlloc && pAlloc.hoursPerDay > 0) {
            resourceDailyRate = pAlloc.hoursPerDay;
          }
        }

        // When task is paced / extended over multiple working days, distribute the daily hours evenly
        const taskDurationDays = task.durationDays || (task.computedStartDate && task.computedEndDate ? Math.max(1, this.countWorkingDays(task.computedStartDate, task.computedEndDate, effectiveCal)) : 1);
        if (taskDurationDays > 0 && resourceTaskShare > 0) {
          const spreadDailyRate = Math.round((resourceTaskShare / taskDurationDays) * 10) / 10;
          resourceDailyRate = Math.min(resourceDailyRate, spreadDailyRate);
        }

        totalAllocatedHours += resourceTaskShare;
        const prog = Number(task.progress) || (task.status === 'done' ? 100 : 0);
        completedHours += resourceTaskShare * (prog / 100);

        // Daily load mapping for concurrency check
        if (task.computedStartDate && task.computedEndDate) {
          const curr = new Date(task.computedStartDate);
          const end = new Date(task.computedEndDate);
          curr.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          let guard = 0;

          while (curr <= end && guard < 1825) {
            guard++;
            if (this.isWorkingDay(curr, effectiveCal)) {
              const dKey = this.toDateKey(curr);
              dailyLoadMap.set(dKey, Math.round(((dailyLoadMap.get(dKey) || 0) + resourceDailyRate) * 10) / 10);
            }
            curr.setDate(curr.getDate() + 1);
          }
        }
      });

      totalAllocatedHours = Math.round(totalAllocatedHours * 10) / 10;
      completedHours = Math.round(completedHours * 10) / 10;

      // Project Effort allocations breakdown & validation
      const projectAllocationInfo = this.calculateResourceProjectAllocations(resource, projects, tasks);
      const hasEffortOverload = !projectAllocationInfo.isValid;

      // 1. Daily Concurrency Over-allocation check
      const peakDailyHours = dailyLoadMap.size > 0 
        ? Math.max(...dailyLoadMap.values()) 
        : 0;
      const hasDailyConflict = peakDailyHours > dailyCap + 0.05;
      const conflictDaysCount = Array.from(dailyLoadMap.values()).filter(h => h > dailyCap + 0.05).length;

      // 2. Project Deadline Miss check
      let hasDeadlineMiss = false;
      let overdueTask = null;
      assignedTasks.forEach(task => {
        const proj = projects.find(p => p.id === task.projectId);
        if (proj && proj.targetDate && task.computedEndDate) {
          const target = new Date(proj.targetDate);
          target.setHours(23, 59, 59, 999);
          if (task.computedEndDate > target) {
            hasDeadlineMiss = true;
            overdueTask = { task, proj };
          }
        }
      });

      // 3. Project Delivery Horizon Capacity
      let horizonWorkingDays = 0;
      const associatedProjectIds = new Set(assignedTasks.map(t => t.projectId).filter(Boolean));
      if (Array.isArray(resource.assignedProjectIds)) {
        resource.assignedProjectIds.forEach(id => associatedProjectIds.add(id));
      }

      const associatedProjects = Array.from(associatedProjectIds).map(id => projects.find(p => p.id === id)).filter(Boolean);
      
      let minStart = null;
      let maxEnd = null;

      associatedProjects.forEach(p => {
        if (p.startDate) {
          const s = new Date(p.startDate);
          if (!minStart || s < minStart) minStart = s;
        }
        if (p.targetDate) {
          const e = new Date(p.targetDate);
          if (!maxEnd || e > maxEnd) maxEnd = e;
        }
      });

      assignedTasks.forEach(t => {
        if (t.computedStartDate && (!minStart || t.computedStartDate < minStart)) {
          minStart = t.computedStartDate;
        }
        if (t.computedEndDate && (!maxEnd || t.computedEndDate > maxEnd)) {
          maxEnd = t.computedEndDate;
        }
      });

      if (!minStart) minStart = new Date();
      if (!maxEnd) {
        maxEnd = new Date(minStart);
        maxEnd.setDate(maxEnd.getDate() + 30);
      }

      horizonWorkingDays = this.countWorkingDays(minStart, maxEnd, effectiveCal);
      if (horizonWorkingDays <= 0) horizonWorkingDays = Math.max(10, Math.ceil(totalAllocatedHours / dailyCap));

      const horizonCapacityHours = Math.round(horizonWorkingDays * dailyCap);
      const horizonUtilization = horizonCapacityHours > 0 
        ? Math.round((totalAllocatedHours / horizonCapacityHours) * 100) 
        : 0;
      const hasHorizonOverload = totalAllocatedHours > horizonCapacityHours;

      // 4. Current 10-day Sprint window burn
      const sprintWorkingDays = 10;
      const sprintCapacityHours = Math.round(dailyCap * sprintWorkingDays);
      
      // Calculate hours falling in the first 10 working days
      let sprintAllocatedHours = 0;
      const sprintStart = minStart || new Date();
      let sprintDaysCount = 0;
      const sprintCurr = new Date(sprintStart);
      sprintCurr.setHours(0, 0, 0, 0);
      let sGuard = 0;

      while (sprintDaysCount < sprintWorkingDays && sGuard < 365) {
        sGuard++;
        if (this.isWorkingDay(sprintCurr, effectiveCal)) {
          const dKey = this.toDateKey(sprintCurr);
          if (dailyLoadMap.has(dKey)) {
            sprintAllocatedHours += dailyLoadMap.get(dKey);
          }
          sprintDaysCount++;
        }
        sprintCurr.setDate(sprintCurr.getDate() + 1);
      }
      sprintAllocatedHours = Math.round(sprintAllocatedHours * 10) / 10;
      const sprintUtilization = sprintCapacityHours > 0 
        ? Math.round((sprintAllocatedHours / sprintCapacityHours) * 100) 
        : 0;

      // 5. True Overload Determination
      const isOverloaded = hasDailyConflict || hasDeadlineMiss || hasEffortOverload || hasHorizonOverload;

      let overloadReason = null;
      if (hasDailyConflict) {
        overloadReason = `${resource.name} is scheduled on concurrent subtasks requiring up to ${peakDailyHours}h/day on ${conflictDaysCount} day(s), exceeding their ${dailyCap}h/day capacity.`;
      } else if (hasDeadlineMiss && overdueTask) {
        overloadReason = `Subtask "${overdueTask.task.title}" finishes after project deadline (${overdueTask.proj.targetDate}).`;
      } else if (hasHorizonOverload) {
        overloadReason = `Total work (${totalAllocatedHours}h) exceeds total capacity (${horizonCapacityHours}h) over the project delivery window.`;
      } else if (hasEffortOverload) {
        overloadReason = projectAllocationInfo.error;
      }

      const utilization = associatedProjects.some(p => p.targetDate) 
        ? horizonUtilization 
        : (sprintCapacityHours > 0 ? Math.min(100, Math.round((totalAllocatedHours / sprintCapacityHours) * 100)) : 0);

      return {
        ...resource,
        assignedTasks,
        taskCount: assignedTasks.length,
        totalAllocatedHours,
        completedHours,
        remainingHours: Math.max(0, Math.round((totalAllocatedHours - completedHours) * 10) / 10),
        sprintCapacityHours,
        sprintAllocatedHours,
        sprintUtilization,
        horizonWorkingDays,
        horizonCapacityHours,
        horizonUtilization,
        utilization,
        peakDailyHours,
        hasDailyConflict,
        hasDeadlineMiss,
        isOverloaded,
        overloadReason,
        projectAllocationInfo
      };
    });
  }

  /**
   * Auto-Solve and Level Schedule:
   * Extends task end dates to reach project & task deadlines,
   * pacing daily burn to prevent any resource from exceeding 100% daily capacity,
   * and ensuring zero missed deadlines.
   *
   * @param {Array} tasks 
   * @param {Array} resources 
   * @param {Array} projects 
   * @param {Object} calendar 
   * @param {Array} allCalendars 
   * @returns {Object} { tasks, projects, stats }
   */
  static solveSchedule(tasks, resources = [], projects = [], calendar = null, allCalendars = []) {
    if (!tasks || tasks.length === 0) {
      return { tasks: [], projects, stats: { tasksSolved: 0, deadlinesExtended: 0 } };
    }

    const clonedTasks = JSON.parse(JSON.stringify(tasks));
    const clonedProjects = JSON.parse(JSON.stringify(projects));

    const resourceMap = new Map(resources.map(r => [r.id, r]));
    const projectMap = new Map(clonedProjects.map(p => [p.id, p]));

    // Group tasks by project
    const projectTaskMap = new Map();
    clonedTasks.forEach(t => {
      if (!projectTaskMap.has(t.projectId)) {
        projectTaskMap.set(t.projectId, []);
      }
      projectTaskMap.get(t.projectId).push(t);
    });

    let totalTasksSolved = 0;
    let totalDeadlinesExtended = 0;

    projectTaskMap.forEach((projTasks, projId) => {
      const proj = projectMap.get(projId);
      if (!proj) return;

      let projStart = proj.startDate ? new Date(proj.startDate) : new Date();
      projStart.setHours(0, 0, 0, 0);

      const sorted = this.topologicalSort(projTasks);
      const taskObjMap = new Map(sorted.map(t => [t.id, t]));

      // 1. Calculate minimum required working days at full capacity for each task
      const minDaysMap = new Map();
      sorted.forEach(t => {
        const assignedIds = Array.isArray(t.assignedResourceIds) && t.assignedResourceIds.length > 0
          ? t.assignedResourceIds
          : (t.assignedResourceId ? [t.assignedResourceId] : []);
        const assignedRes = assignedIds.map(id => resourceMap.get(id)).filter(Boolean);
        const teamCap = assignedRes.reduce((s, r) => s + (Number(r.capacityHoursPerDay) || 8), 0) || 8;
        const durHours = Math.max(1, Number(t.durationHours) || 8);
        const minDays = Math.max(1, Math.ceil(durHours / teamCap));
        minDaysMap.set(t.id, minDays);
      });

      // 2. Forward pass: compute earliest finish days along the dependency graph
      const esDaysMap = new Map();
      const efDaysMap = new Map();
      sorted.forEach(t => {
        const deps = (t.dependencies || []).filter(depId => taskObjMap.has(depId));
        let maxDepEf = 0;
        deps.forEach(depId => {
          maxDepEf = Math.max(maxDepEf, efDaysMap.get(depId) || 0);
        });
        esDaysMap.set(t.id, maxDepEf);
        efDaysMap.set(t.id, maxDepEf + (minDaysMap.get(t.id) || 1));
      });

      const criticalPathMinDays = Math.max(1, ...Array.from(efDaysMap.values()));

      // 3. Project target deadline verification
      let projDeadline = proj.targetDate ? new Date(proj.targetDate) : null;
      let availWorkingDays = projDeadline ? this.countWorkingDays(projStart, projDeadline, calendar) : 0;

      if (!projDeadline || availWorkingDays < criticalPathMinDays + 2) {
        const targetWorkingDays = Math.max(criticalPathMinDays + 5, Math.round(criticalPathMinDays * 1.8));
        projDeadline = this.addWorkDays(projStart, targetWorkingDays, calendar);
        proj.targetDate = this.toDateKey(projDeadline);
        availWorkingDays = this.countWorkingDays(projStart, projDeadline, calendar);
        totalDeadlinesExtended++;
      }

      // 4. Calculate timeline expansion ratio
      const expansionRatio = Math.max(1.0, (availWorkingDays - 1) / criticalPathMinDays);

      // 5. Identify critical path tasks
      const criticalTaskIds = new Set();
      const maxEf = Math.max(...Array.from(efDaysMap.values()));
      const lfMinMap = new Map();
      const reverseSorted = [...sorted].reverse();
      const successorsMap = new Map();
      sorted.forEach(t => successorsMap.set(t.id, []));
      sorted.forEach(t => {
        if (Array.isArray(t.dependencies)) {
          t.dependencies.forEach(depId => {
            if (successorsMap.has(depId)) {
              successorsMap.get(depId).push(t.id);
            }
          });
        }
      });

      reverseSorted.forEach(t => {
        const succs = successorsMap.get(t.id) || [];
        if (succs.length === 0) {
          lfMinMap.set(t.id, maxEf);
        } else {
          const minSuccLs = Math.min(...succs.map(sId => (lfMinMap.get(sId) || maxEf) - (minDaysMap.get(sId) || 1)));
          lfMinMap.set(t.id, minSuccLs);
        }
        const slack = (lfMinMap.get(t.id) || maxEf) - (efDaysMap.get(t.id) || 0);
        if (slack <= 0) {
          criticalTaskIds.add(t.id);
        }
      });

      // Total work hours along the critical chain
      const criticalChainHours = sorted
        .filter(t => criticalTaskIds.has(t.id))
        .reduce((sum, t) => sum + (Number(t.durationHours) || 8), 0) || 1;

      // Allocate extended working days to critical tasks proportionally to fill availWorkingDays
      let criticalDaysSum = 0;
      const allocatedDaysMap = new Map();

      sorted.forEach(t => {
        const durHours = Number(t.durationHours) || 8;
        if (criticalTaskIds.has(t.id)) {
          const days = Math.max(2, Math.round(availWorkingDays * (durHours / criticalChainHours)));
          allocatedDaysMap.set(t.id, days);
          criticalDaysSum += days;
        } else {
          // Parallel branches: scale by expansion ratio
          const minDays = minDaysMap.get(t.id) || 1;
          allocatedDaysMap.set(t.id, Math.max(minDays + 1, Math.round(minDays * expansionRatio)));
        }
      });

      // Adjust rounding difference on the last critical task so it reaches the project deadline exactly
      const lastCriticalTask = sorted.filter(t => criticalTaskIds.has(t.id)).pop();
      if (lastCriticalTask && criticalDaysSum > 0) {
        const diff = (availWorkingDays - 1) - criticalDaysSum;
        const current = allocatedDaysMap.get(lastCriticalTask.id) || 2;
        allocatedDaysMap.set(lastCriticalTask.id, Math.max(2, current + diff));
      }

      // Calculate daily burn limit for each task
      sorted.forEach(t => {
        const durHours = Number(t.durationHours) || 8;
        const allocatedDays = allocatedDaysMap.get(t.id) || 1;
        const pace = Math.max(1.0, Math.round((durHours / allocatedDays) * 10) / 10);
        t.dailyBurnHours = pace;
      });
    });

    // 6. Run computeSchedule to get exact simulated dates with working calendars, vacations, and pacing
    const scheduled = this.computeSchedule(clonedTasks, resources, clonedProjects, calendar, allCalendars);
    const scheduledMap = new Map(scheduled.map(t => [t.id, t]));

    // 7. Update every task's startDate and targetDate to match the computed leveled dates!
    clonedTasks.forEach(t => {
      const st = scheduledMap.get(t.id);
      if (st && st.computedStartDate && st.computedEndDate) {
        t.startDate = this.toDateKey(st.computedStartDate);
        t.targetDate = this.toDateKey(st.computedEndDate);
        t.isSolved = true;
        totalTasksSolved++;
      }
    });

    return {
      tasks: clonedTasks,
      projects: clonedProjects,
      stats: {
        tasksSolved: totalTasksSolved,
        deadlinesExtended: totalDeadlinesExtended
      }
    };
  }
}
