================================================================================
                                CHRONOGANTT
         Interactive Project, Resource & Schedule Management Platform
================================================================================

ChronoGantt is a modern, responsive Single Page Application (SPA) designed for
advanced project scheduling, resource allocation, and timeline visualization.
It provides Gantt charts, Kanban boards, dependency graph visualization, and
multi-resource effort calculations with support for regional holidays and
personal vacations.

--------------------------------------------------------------------------------
1. NOTICES & AI ATTRIBUTION
--------------------------------------------------------------------------------
This project was written and developed in collaboration with Artificial
Intelligence (AI) assistance (Antigravity by Google DeepMind).

--------------------------------------------------------------------------------
2. LICENSE
--------------------------------------------------------------------------------
This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License (GPL) as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <https://www.gnu.org/licenses/>.

--------------------------------------------------------------------------------
3. KEY FEATURES
--------------------------------------------------------------------------------
- Interactive Gantt & Timeline View:
  * Interactive Gantt chart with day-by-day and compact weekly zoom scales.
  * Hierarchical Timeline Grouping: Group tasks by "Project & Assignee" (default),
    "Project", "Assignee", or "None (Flat)".
  * Collapsible project & assignee headers with live task counters and total effort.
  * Project summary bracket bars and assignee span tracks on the timeline canvas.
  * SVG dependency connector lines with arrowheads and critical path highlights.
  * Target End Date tracking with overdue indicator badges (⚠️).
  * Bidirectional synchronized scrolling between task list and timeline canvas.

- Auto-Solve Schedule & Leveling Engine:
  * "Solve" button: Automatically extends the end dates of every task across the
    available project timeline to reach target deadlines without any resource
    exceeding 100% daily capacity and without missing deadlines.
  * Paces work effort evenly along dependency chains to eliminate peak crunch.
  * "Revert" button: Instant one-click restoration back to the original schedule
    dates and pacing.

- Multi-Assignee & Effort Calculation:
  * Assign multiple team members to a single subtask.
  * Proportional effort distribution based on each resource's capacity and
    project-specific effort allocation percentage.
  * Combined burn rate simulation (e.g., 2 contributors delivering 14.4h/day).

- Regional Calendars & Personal Vacations:
  * Working day configuration (e.g., Monday through Friday).
  * National and regional calendar profiles (e.g., Italian National, Milan,
    Rome, Turin, and US Federal holidays).
  * Ability to add, edit, or clone calendars and extend holidays to next year.
  * Interactive holiday picker directly on the calendar interface.
  * Resource-specific calendar assignments and personal vacation leaves.

- Resource Workload & Capacity Engine:
  * Accurate daily concurrency collision detection across personal schedules.
  * Project horizon capacity analysis vs. 10-day sprint capacity burn.
  * Overload diagnostics and deadline deficit alerts.

- Kanban Board:
  * Drag-and-drop workflow status updates (To Do, In Progress, Blocked, Done).
  * Prerequisite blocker warnings and target date indicators.

- Interactive Dependency Graph:
  * Visual node-and-edge network map of tasks and dependency paths.

- Subtasks & Effort Matrix:
  * Comprehensive table view with multi-assignee pills, prerequisites,
    target deadlines, and instant editing.

- Messages & Warnings Center:
  * Live drawer highlighting prerequisite blockers, unassigned tasks,
    zero-slack critical paths, and missed target dates.

- Data Persistence & Portability:
  * Automated LocalStorage synchronization.
  * JSON export and import for full state backup and migration.

--------------------------------------------------------------------------------
4. TECHNOLOGY STACK
--------------------------------------------------------------------------------
- Pure Vanilla Web Technologies (no external heavyweight frameworks required):
  * HTML5 Semantic Architecture
  * Vanilla CSS with Custom Properties (CSS variables), sleek dark mode, and
    responsive glassmorphism styling
  * Modern ES6 JavaScript Modules (ESM)

--------------------------------------------------------------------------------
5. GETTING STARTED / RUNNING LOCALLY
--------------------------------------------------------------------------------
Because ChronoGantt uses standard ES6 modules, it needs to be served via an HTTP
server rather than opened directly via file://.

You can launch a local HTTP server using any of the following methods:

Option A (Python 3):
    python3 -m http.server 8085
    Then open http://localhost:8085 in your browser.

Option B (Node.js):
    npx serve .
    or
    npx http-server -p 8085

Option C (PHP):
    php -S localhost:8085
