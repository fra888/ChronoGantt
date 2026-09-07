/**
 * Local Calendar & Working Days View Component
 * - Multi-profile support: switch active calendar, clone existing preset, or create custom regional calendar (e.g., for different cities)
 * - Configure weekly working days (e.g. Mon-Fri, custom workweek)
 * - Year-by-year vacation/holidays management (not all in one monolithic list)
 * - Click-to-edit holidays: click any holiday in the list or on the month preview to edit date and name
 * - National & regional holidays management with optional/empty name support
 * - "Extend to Next Year" to duplicate holidays into the following year
 * - Interactive visual monthly grid preview
 */
import { ScheduleEngine } from '../engine.js';
import { ITALIAN_HOLIDAYS_PRESET } from '../store.js';

export class CalendarView {
  constructor(container, store, onCalendarChange) {
    this.container = container;
    this.store = store;
    this.onCalendarChange = onCalendarChange;

    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth(); // 0-indexed
    this.selectedHolidayYear = this.viewYear;
    this.customYears = new Set();

    this.modalInitialized = false;
    this.initEditModal();
  }

  initEditModal() {
    if (this.modalInitialized) return;
    const overlay = document.getElementById('editHolidayModalOverlay');
    if (!overlay) return;

    // Close button & overlay click
    document.getElementById('closeEditHolidayModalBtn')?.addEventListener('click', () => {
      this.closeEditHolidayModal();
    });

    document.getElementById('btnCancelEditHoliday')?.addEventListener('click', () => {
      this.closeEditHolidayModal();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeEditHolidayModal();
      }
    });

    // Delete holiday from modal
    document.getElementById('btnDeleteHolidayModal')?.addEventListener('click', () => {
      const oldDate = document.getElementById('editHolidayOldDate')?.value;
      if (oldDate) {
        if (confirm(`Remove holiday on ${oldDate}?`)) {
          this.store.deleteHoliday(oldDate);
          this.closeEditHolidayModal();
          this.render();
          if (this.onCalendarChange) this.onCalendarChange();
        }
      }
    });

    // Save changes form submit
    const form = document.getElementById('editHolidayForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const oldDate = document.getElementById('editHolidayOldDate')?.value;
      const newDate = document.getElementById('editHolidayDate')?.value;
      const newName = document.getElementById('editHolidayName')?.value || '';

      if (!newDate) return;

      this.store.updateHoliday(oldDate, {
        date: newDate,
        name: newName.trim()
      });

      // If user changed the year, switch view to the new year
      const yr = parseInt(newDate.split('-')[0], 10);
      if (!isNaN(yr)) {
        this.selectedHolidayYear = yr;
        this.viewYear = yr;
      }

      this.closeEditHolidayModal();
      this.render();
      if (this.onCalendarChange) this.onCalendarChange();
    });

    this.modalInitialized = true;
  }

  openEditHolidayModal(date, name = '') {
    this.initEditModal();
    const overlay = document.getElementById('editHolidayModalOverlay');
    const oldDateInput = document.getElementById('editHolidayOldDate');
    const dateInput = document.getElementById('editHolidayDate');
    const nameInput = document.getElementById('editHolidayName');
    const titleEl = document.getElementById('editHolidayModalTitle');

    if (!overlay || !dateInput) return;

    if (oldDateInput) oldDateInput.value = date;
    dateInput.value = date;
    if (nameInput) nameInput.value = name || '';
    if (titleEl) titleEl.textContent = `Edit Holiday (${date})`;

    overlay.classList.add('active');
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 50);
  }

  closeEditHolidayModal() {
    const overlay = document.getElementById('editHolidayModalOverlay');
    overlay?.classList.remove('active');
  }

  render() {
    const allCalendars = this.store.getAllCalendars();
    const calendar = this.store.getCalendar();
    const workingDays = calendar.workingDays || [1, 2, 3, 4, 5];
    const holidays = calendar.holidays || [];

    // Collect available years
    const holidayYearsSet = new Set();
    holidays.forEach(h => {
      const yr = parseInt(h.date.split('-')[0], 10);
      if (!isNaN(yr)) holidayYearsSet.add(yr);
    });
    holidayYearsSet.add(this.viewYear);
    this.customYears.forEach(y => holidayYearsSet.add(y));

    const availableYears = Array.from(holidayYearsSet).sort((a, b) => a - b);

    if (!availableYears.includes(this.selectedHolidayYear)) {
      this.selectedHolidayYear = availableYears.includes(this.viewYear) ? this.viewYear : availableYears[0];
    }

    // Filter holidays for selected year
    const yearHolidays = holidays.filter(h => h.date.startsWith(`${this.selectedHolidayYear}-`));

    const dayDefs = [
      { id: 1, name: 'Monday', short: 'Mon' },
      { id: 2, name: 'Tuesday', short: 'Tue' },
      { id: 3, name: 'Wednesday', short: 'Wed' },
      { id: 4, name: 'Thursday', short: 'Thu' },
      { id: 5, name: 'Friday', short: 'Fri' },
      { id: 6, name: 'Saturday', short: 'Sat' },
      { id: 0, name: 'Sunday', short: 'Sun' }
    ];

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    this.container.innerHTML = `
      <div class="workload-wrapper" style="max-width: 1200px; margin: 0 auto; width: 100%;">
        <!-- Header Profile Switcher & Actions -->
        <div class="kpi-card" style="padding: 1.25rem 1.5rem; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="kpi-icon emerald" style="font-size: 1.3rem;">📅</div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0;">${escapeHtml(calendar.name)}</h2>
                ${calendar.isCustom ? '<span class="badge badge-in-progress" style="font-size: 0.68rem;">Custom / Regional</span>' : '<span class="badge badge-done" style="font-size: 0.68rem;">Official Preset</span>'}
              </div>
              <span style="font-size: 0.78rem; color: var(--text-muted);">
                Select or clone regional calendars (e.g. Italian cities with local patron saint holidays).
              </span>
            </div>
          </div>

          <!-- Profile Actions Bar -->
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <select class="select-filter" id="calendarProfileSelect" style="min-width: 240px; font-weight: 600;">
              ${allCalendars.map(c => `
                <option value="${c.id}" ${c.id === calendar.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
              `).join('')}
            </select>

            <button class="btn btn-secondary btn-sm" id="btnCloneCalendar" title="Clone current calendar to create a regional variant">
              📋 Clone Preset
            </button>

            <button class="btn btn-secondary btn-sm" id="btnNewCalendar" title="Create a new blank regional calendar">
              + New Calendar
            </button>

            ${allCalendars.length > 1 ? `
              <button class="btn btn-secondary btn-sm" id="btnDeleteCalendar" title="Delete current calendar" style="color: #f87171;">
                🗑 Delete
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Weekly Working Days Selector -->
        <div class="resource-card" style="padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 700;">Standard Working Days of the Week</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                Select which days of the week are working business days (e.g., Monday to Friday).
              </span>
            </div>
            <span class="badge badge-done" id="workingDaysCountBadge">
              ${workingDays.length} Working Days / Week
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
            ${dayDefs.map(d => {
              const isWorking = workingDays.includes(d.id);
              return `
                <div class="working-day-card ${isWorking ? 'active-workday' : ''}" 
                     data-day-id="${d.id}"
                     style="padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid ${isWorking ? 'var(--primary)' : 'var(--border-color)'}; background: ${isWorking ? 'var(--primary-light)' : 'var(--bg-secondary)'}; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; transition: all var(--transition-fast);">
                  <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="font-weight: 700; font-size: 0.85rem;">${d.name}</span>
                    <input type="checkbox" class="day-checkbox" data-day-id="${d.id}" ${isWorking ? 'checked' : ''} style="accent-color: var(--primary); pointer-events: none;">
                  </div>
                  <span style="font-size: 0.72rem; font-weight: 600; color: ${isWorking ? 'var(--primary)' : 'var(--text-muted)'};">
                    ${isWorking ? '✓ Working Day' : '✕ Off Day'}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2 Column Layout: Holidays Manager & Visual Grid -->
        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 1.25rem;">
          <!-- Left: Year-by-Year Holidays & Vacations Manager -->
          <div class="resource-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.15rem;">Vacations & Holidays</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Click any holiday to edit date or name. Filtered year by year.</span>
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <button class="btn btn-secondary btn-sm" id="btnExtendNextYear" title="Duplicate current year holidays to the following year" style="background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.3); color: #a5b4fc;">
                  ⏩ Extend to Next Year
                </button>
                <button class="btn btn-secondary btn-sm" id="btnClearHolidays" title="Remove all holidays for ${this.selectedHolidayYear}" style="color: #f87171;">
                  Clear Year
                </button>
              </div>
            </div>

            <!-- Year Selector Tabs (Year by Year) -->
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-right: 0.2rem;">SELECT YEAR:</span>
                ${availableYears.map(yr => {
                  const count = holidays.filter(h => h.date.startsWith(`${yr}-`)).length;
                  const isActive = yr === this.selectedHolidayYear;
                  return `
                    <button class="btn btn-sm year-tab-btn ${isActive ? 'btn-primary' : 'btn-secondary'}" 
                            data-year="${yr}" 
                            style="padding: 0.25rem 0.65rem; font-size: 0.78rem; border-radius: 20px;">
                      ${yr} <span style="opacity: 0.9; font-size: 0.7rem; margin-left: 0.2rem; background: ${isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}; padding: 0.1rem 0.35rem; border-radius: 10px;">${count}</span>
                    </button>
                  `;
                }).join('')}
                <button class="btn btn-secondary btn-sm" id="btnAddYearBtn" title="Add another year tab" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; border-radius: 20px;">
                  + Year
                </button>
              </div>
              <span class="badge badge-neutral" style="font-size: 0.7rem; font-family: var(--font-mono);">
                ${yearHolidays.length} vacation days in ${this.selectedHolidayYear}
              </span>
            </div>

            <!-- Add New Holiday Form for Active Year -->
            <form id="addHolidayForm" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: flex-end;">
              <div style="flex: 1.2;">
                <label class="form-label" style="font-size: 0.72rem;">Holiday Date *</label>
                <input type="date" class="form-input" id="newHolidayDate" required 
                       value="${this.selectedHolidayYear}-01-01" 
                       style="padding: 0.4rem 0.6rem; font-size: 0.82rem;">
              </div>
              <div style="flex: 2;">
                <label class="form-label" style="font-size: 0.72rem;">
                  <span>Holiday / Regional Name</span>
                  <span class="form-hint" style="font-style: italic;">(Optional - can leave empty)</span>
                </label>
                <input type="text" class="form-input" id="newHolidayName" placeholder="e.g. Local Festivity / Company Off" style="padding: 0.4rem 0.6rem; font-size: 0.82rem;">
              </div>
              <button type="submit" class="btn btn-primary btn-sm" style="padding: 0.45rem 0.85rem; height: 35px;">
                + Add
              </button>
            </form>

            <!-- Holidays List (Year by Year) -->
            <div style="display: flex; flex-direction: column; gap: 0.45rem; max-height: 290px; overflow-y: auto; padding-right: 0.25rem;" id="holidaysListContainer">
              ${yearHolidays.length > 0 ? yearHolidays.map(h => {
                const hasName = h.name && h.name.trim().length > 0;
                return `
                  <div class="holiday-row" 
                       data-date="${h.date}" 
                       data-name="${escapeHtml(h.name || '')}" 
                       style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;"
                       title="Click to edit holiday date or name">
                    <div style="display: flex; align-items: center; gap: 0.6rem; overflow: hidden; pointer-events: none;">
                      <span class="badge badge-critical" style="font-size: 0.68rem; font-family: var(--font-mono); min-width: 90px; justify-content: center;">
                        ${h.date}
                      </span>
                      <span style="font-weight: 600; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${hasName ? 'var(--text-primary)' : 'var(--text-muted)'}; font-style: ${hasName ? 'normal' : 'italic'};">
                        ${hasName ? escapeHtml(h.name) : 'Holiday (No description)'}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <span style="font-size: 0.72rem; color: var(--primary); font-weight: 600; padding: 0.15rem 0.4rem; border-radius: 4px; background: rgba(99,102,241,0.1);">
                        ✏️ Edit
                      </span>
                      <button class="btn-ghost btn-sm delete-holiday-btn" data-date="${h.date}" title="Remove holiday" style="color: #f87171; padding: 0.2rem 0.4rem;">
                        ✕
                      </button>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
                  No holidays configured for <strong>${this.selectedHolidayYear}</strong>.<br>
                  <span style="font-size: 0.75rem;">Add one above, or click "Extend to Next Year" to copy over previous holidays.</span>
                </div>
              `}
            </div>
          </div>

          <!-- Right: Visual Month Calendar Grid Preview -->
          <div class="resource-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 700;">Month Preview</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Visual schedule of working vs off days. Click any holiday to edit.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" id="prevMonthBtn">&larr;</button>
                <span style="font-weight: 700; font-size: 0.85rem; min-width: 120px; text-align: center;">
                  ${monthNames[this.viewMonth]} ${this.viewYear}
                </span>
                <button class="btn btn-secondary btn-sm" id="nextMonthBtn">&rarr;</button>
              </div>
            </div>

            <!-- Month Calendar Table -->
            <div id="calendarPreviewContainer">
              ${this.renderMonthPreview(this.viewYear, this.viewMonth, calendar)}
            </div>

            <div style="display: flex; gap: 1rem; align-items: center; justify-content: center; margin-top: 0.85rem; font-size: 0.72rem; color: var(--text-secondary); flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="width: 12px; height: 12px; background: var(--bg-secondary); border-radius: 3px; border: 1px solid var(--border-color);"></span>
                <span>Work Day</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="width: 12px; height: 12px; background: rgba(0, 0, 0, 0.4); border-radius: 3px;"></span>
                <span>Weekend / Off</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="width: 12px; height: 12px; background: rgba(236, 72, 153, 0.3); border-radius: 3px; border: 1px solid var(--critical);"></span>
                <span>Holiday (Click to edit)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(calendar);
  }

  renderMonthPreview(year, month, calendar) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startOffset = (firstDay.getDay() + 6) % 7; // Monday-based offset

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const holidayMap = new Map((calendar.holidays || []).map(h => [h.date, h.name]));

    let cellsHtml = '';

    for (let i = 0; i < startOffset; i++) {
      cellsHtml += `<div style="background: rgba(0,0,0,0.1); border-radius: 4px; opacity: 0.2; height: 44px;"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isWorking = ScheduleEngine.isWorkingDay(dateObj, calendar);
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;
      const hasHoliday = holidayMap.has(dateKey);
      const holidayName = holidayMap.get(dateKey);

      let bgStyle = 'background: var(--bg-secondary); border: 1px solid var(--border-color);';
      let tagHtml = '';
      let cellClasses = 'calendar-day-cell';
      let clickAttr = '';

      if (hasHoliday) {
        bgStyle = 'background: rgba(236, 72, 153, 0.18); border: 1px solid var(--critical); color: #f472b6;';
        const label = holidayName && holidayName.trim() ? holidayName : 'Holiday';
        tagHtml = `<span style="font-size: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; display: block;" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
        cellClasses += ' holiday-day-cell';
        clickAttr = `data-date="${dateKey}" data-name="${escapeHtml(holidayName || '')}" title="Click to edit holiday: ${escapeHtml(label)} (${dateKey})"`;
      } else if (!isWorking) {
        bgStyle = 'background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.04); opacity: 0.55;';
        tagHtml = `<span style="font-size: 0.6rem; color: var(--text-muted);">Off</span>`;
      }

      cellsHtml += `
        <div class="${cellClasses}" ${clickAttr} style="${bgStyle} border-radius: 6px; padding: 0.3rem; height: 46px; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: 700; font-size: 0.78rem; font-family: var(--font-mono);">${d}</span>
            ${hasHoliday ? '<span style="font-size: 0.6rem; opacity: 0.75;">✏️</span>' : ''}
          </div>
          ${tagHtml}
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; text-align: center;">
        ${dayHeaders.map(h => `
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); padding: 0.2rem 0;">${h}</div>
        `).join('')}
        ${cellsHtml}
      </div>
    `;
  }

  bindEvents(calendar) {
    // Switch active calendar profile
    document.getElementById('calendarProfileSelect')?.addEventListener('change', (e) => {
      this.store.setActiveCalendar(e.target.value);
      this.render();
      if (this.onCalendarChange) this.onCalendarChange();
    });

    // Clone Calendar button
    document.getElementById('btnCloneCalendar')?.addEventListener('click', () => {
      const currentCal = this.store.getCalendar();
      const defaultName = `${currentCal.name} (Clone)`;
      const newName = prompt(`Enter name for the cloned regional calendar profile:`, defaultName);
      if (newName !== null && newName.trim() !== '') {
        const cloned = this.store.cloneCalendar(currentCal.id, newName.trim());
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      }
    });

    // Create New Regional Calendar button
    document.getElementById('btnNewCalendar')?.addEventListener('click', () => {
      const calName = prompt('Enter a name for the new regional calendar (e.g. Florence Regional / Custom City):', 'New Regional Calendar');
      if (calName !== null && calName.trim() !== '') {
        const copyHolidays = confirm('Do you want to pre-populate this calendar with Italian National Holidays? (Click OK for yes, Cancel for blank holidays)');
        this.store.createNewCalendar(calName.trim(), copyHolidays);
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      }
    });

    // Delete Calendar button
    document.getElementById('btnDeleteCalendar')?.addEventListener('click', () => {
      const currentCal = this.store.getCalendar();
      if (confirm(`Are you sure you want to delete the calendar profile "${currentCal.name}"?`)) {
        const deleted = this.store.deleteCalendar(currentCal.id);
        if (deleted) {
          this.render();
          if (this.onCalendarChange) this.onCalendarChange();
        } else {
          alert('Cannot delete the only remaining calendar profile.');
        }
      }
    });

    // Year Tabs switcher
    this.container.querySelectorAll('.year-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const yr = parseInt(btn.getAttribute('data-year'), 10);
        if (!isNaN(yr)) {
          this.selectedHolidayYear = yr;
          this.viewYear = yr;
          this.render();
        }
      });
    });

    // Add Year button
    document.getElementById('btnAddYearBtn')?.addEventListener('click', () => {
      const nextSuggested = this.selectedHolidayYear + 1;
      const input = prompt(`Enter year to add (e.g. ${nextSuggested}):`, nextSuggested);
      if (input !== null) {
        const yr = parseInt(input.trim(), 10);
        if (!isNaN(yr) && yr >= 2000 && yr <= 2100) {
          this.customYears.add(yr);
          this.selectedHolidayYear = yr;
          this.viewYear = yr;
          this.render();
        } else if (input.trim() !== '') {
          alert('Please enter a valid 4-digit year (between 2000 and 2100).');
        }
      }
    });

    // Extend Holidays to Next Year
    document.getElementById('btnExtendNextYear')?.addEventListener('click', () => {
      const result = this.store.extendHolidaysToNextYear();
      if (result.addedCount > 0) {
        alert(`Successfully extended ${result.addedCount} holiday(s) to year ${result.nextYear}!`);
        if (result.nextYear) {
          this.selectedHolidayYear = result.nextYear;
          this.viewYear = result.nextYear;
        }
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      } else {
        alert('No holidays available to extend, or all holidays for next year are already present.');
      }
    });

    // Working Days click toggles
    this.container.querySelectorAll('.working-day-card').forEach(card => {
      card.addEventListener('click', () => {
        const dayId = Number(card.getAttribute('data-day-id'));
        let currentDays = [...(this.store.getCalendar().workingDays || [1, 2, 3, 4, 5])];

        if (currentDays.includes(dayId)) {
          if (currentDays.length <= 1) {
            alert('At least one working day per week must remain active.');
            return;
          }
          currentDays = currentDays.filter(d => d !== dayId);
        } else {
          currentDays.push(dayId);
        }

        this.store.setWorkingDays(currentDays);
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      });
    });

    // Clear holidays for selected year
    document.getElementById('btnClearHolidays')?.addEventListener('click', () => {
      if (confirm(`Clear all holidays in ${this.selectedHolidayYear} for this calendar profile?`)) {
        const cal = this.store.getCalendar();
        const prefix = `${this.selectedHolidayYear}-`;
        cal.holidays = (cal.holidays || []).filter(h => !h.date.startsWith(prefix));
        this.store.saveState();
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      }
    });

    // Add holiday form (Name is optional)
    const form = document.getElementById('addHolidayForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateInp = document.getElementById('newHolidayDate');
      const nameInp = document.getElementById('newHolidayName');

      if (dateInp && dateInp.value) {
        this.store.addHoliday({
          date: dateInp.value,
          name: nameInp ? nameInp.value.trim() : '' // Optional, can be empty
        });

        // Switch to the year of the added holiday
        const yr = parseInt(dateInp.value.split('-')[0], 10);
        if (!isNaN(yr)) {
          this.selectedHolidayYear = yr;
          this.viewYear = yr;
        }

        dateInp.value = `${this.selectedHolidayYear}-01-01`;
        if (nameInp) nameInp.value = '';
        this.render();
        if (this.onCalendarChange) this.onCalendarChange();
      }
    });

    // Click on Holiday Row in list to edit
    this.container.querySelectorAll('.holiday-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // If delete button was clicked, don't open modal
        if (e.target.closest('.delete-holiday-btn')) return;
        const date = row.getAttribute('data-date');
        const name = row.getAttribute('data-name') || '';
        if (date) {
          this.openEditHolidayModal(date, name);
        }
      });
    });

    // Click on Holiday Cell in month grid preview to edit
    this.container.querySelectorAll('.holiday-day-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.getAttribute('data-date');
        const name = cell.getAttribute('data-name') || '';
        if (date) {
          this.openEditHolidayModal(date, name);
        }
      });
    });

    // Delete holiday buttons
    this.container.querySelectorAll('.delete-holiday-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = btn.getAttribute('data-date');
        if (date) {
          this.store.deleteHoliday(date);
          this.render();
          if (this.onCalendarChange) this.onCalendarChange();
        }
      });
    });

    // Month Navigation
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
      if (this.viewMonth === 0) {
        this.viewMonth = 11;
        this.viewYear--;
      } else {
        this.viewMonth--;
      }
      // Keep selectedHolidayYear in sync if year changed
      if (this.selectedHolidayYear !== this.viewYear) {
        this.selectedHolidayYear = this.viewYear;
      }
      this.render();
    });

    document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
      if (this.viewMonth === 11) {
        this.viewMonth = 0;
        this.viewYear++;
      } else {
        this.viewMonth++;
      }
      // Keep selectedHolidayYear in sync if year changed
      if (this.selectedHolidayYear !== this.viewYear) {
        this.selectedHolidayYear = this.viewYear;
      }
      this.render();
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
