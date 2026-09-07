/**
 * Dependency Network Graph View (Topology)
 * Visualizes tasks as interactive nodes with directed arrows showing dependencies.
 * Critical path highlighted. Supports node dragging, canvas panning, and zoom.
 */
import { ScheduleEngine } from '../engine.js';

export class GraphView {
  constructor(container, store, onEditTask) {
    this.container = container;
    this.store = store;
    this.onEditTask = onEditTask;

    this.nodes = [];
    this.links = [];
    this.zoom = 1;
    this.panX = 60;
    this.panY = 60;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };
    this.draggedNode = null;
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

    this.container.innerHTML = `
      <div class="graph-container" id="graphContainer">
        <canvas id="dependencyCanvas"></canvas>
        <div class="graph-legend">
          <span style="font-weight: 700; margin-bottom: 0.2rem;">Workflow Topology</span>
          <div class="legend-item">
            <span class="legend-line normal"></span>
            <span>Prerequisite Dependency</span>
          </div>
          <div class="legend-item">
            <span class="legend-line critical"></span>
            <span>Critical Path Link</span>
          </div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.2rem;">
            Tip: Drag nodes to arrange, scroll to zoom, click to edit
          </div>
        </div>
      </div>
    `;

    this.initCanvas(scheduledTasks, projectMap, resourceMap);
  }

  initCanvas(tasks, projectMap, resourceMap) {
    const canvas = document.getElementById('dependencyCanvas');
    const container = document.getElementById('graphContainer');
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      ctx.scale(dpr, dpr);
      this.draw(ctx, canvas, container.clientWidth, container.clientHeight);
    };

    // Build layered layout for DAG nodes
    this.layoutNodes(tasks, projectMap, resourceMap);

    resize();
    window.addEventListener('resize', resize);

    // Mouse events: pan, drag node, click
    let clickCandidate = null;

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
      const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

      // Check hit node
      const hitNode = this.nodes.find(n => 
        mouseX >= n.x && mouseX <= n.x + n.width &&
        mouseY >= n.y && mouseY <= n.y + n.height
      );

      if (hitNode) {
        this.draggedNode = hitNode;
        this.dragOffset = { x: mouseX - hitNode.x, y: mouseY - hitNode.y };
        clickCandidate = hitNode;
      } else {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        clickCandidate = null;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (this.draggedNode) {
        const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
        const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;
        this.draggedNode.x = mouseX - this.dragOffset.x;
        this.draggedNode.y = mouseY - this.dragOffset.y;
        clickCandidate = null; // moving, not clicking
        this.draw(ctx, canvas, container.clientWidth, container.clientHeight);
      } else if (this.isPanning) {
        this.panX = e.clientX - this.startPan.x;
        this.panY = e.clientY - this.startPan.y;
        this.draw(ctx, canvas, container.clientWidth, container.clientHeight);
      }
    });

    const endInteraction = () => {
      if (clickCandidate && this.onEditTask) {
        this.onEditTask(clickCandidate.task.id);
      }
      this.draggedNode = null;
      this.isPanning = false;
      clickCandidate = null;
    };

    canvas.addEventListener('mouseup', endInteraction);
    canvas.addEventListener('mouseleave', endInteraction);

    // Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = Math.max(0.4, Math.min(2.5, this.zoom * zoomFactor));
      this.draw(ctx, canvas, container.clientWidth, container.clientHeight);
    }, { passive: false });
  }

  layoutNodes(tasks, projectMap, resourceMap) {
    this.nodes = [];
    this.links = [];

    // Assign topological layers
    const inDegree = new Map();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    tasks.forEach(t => inDegree.set(t.id, 0));
    tasks.forEach(t => {
      if (t.dependencies) {
        t.dependencies.forEach(() => {
          inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        });
      }
    });

    // Calculate layer levels (BFS distance from roots)
    const levels = new Map();
    const getLevel = (id) => {
      if (levels.has(id)) return levels.get(id);
      const t = taskMap.get(id);
      if (!t || !t.dependencies || t.dependencies.length === 0) {
        levels.set(id, 0);
        return 0;
      }
      const maxPredLevel = Math.max(...t.dependencies.map(d => getLevel(d)));
      const lvl = maxPredLevel + 1;
      levels.set(id, lvl);
      return lvl;
    };

    tasks.forEach(t => getLevel(t.id));

    // Group tasks by level
    const levelGroups = new Map();
    tasks.forEach(t => {
      const lvl = levels.get(t.id) || 0;
      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
      levelGroups.get(lvl).push(t);
    });

    const colWidth = 260;
    const rowHeight = 110;

    levelGroups.forEach((groupTasks, lvl) => {
      groupTasks.forEach((task, idx) => {
        const proj = projectMap.get(task.projectId);
        const res = resourceMap.get(task.assignedResourceId);

        this.nodes.push({
          x: lvl * colWidth + 50,
          y: idx * rowHeight + 40,
          width: 200,
          height: 80,
          task,
          project: proj,
          resource: res
        });
      });
    });

    // Construct links
    const nodeMap = new Map(this.nodes.map(n => [n.task.id, n]));
    this.nodes.forEach(node => {
      if (node.task.dependencies) {
        node.task.dependencies.forEach(predId => {
          const predNode = nodeMap.get(predId);
          if (predNode) {
            this.links.push({
              source: predNode,
              target: node,
              isCritical: node.task.isCritical && predNode.task.isCritical
            });
          }
        });
      }
    });
  }

  draw(ctx, canvas, width, height) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Draw Links
    this.links.forEach(link => {
      const startX = link.source.x + link.source.width;
      const startY = link.source.y + (link.source.height / 2);
      const endX = link.target.x;
      const endY = link.target.y + (link.target.height / 2);

      const dx = Math.max(30, (endX - startX) * 0.5);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(startX + dx, startY, endX - dx, endY, endX, endY);
      
      if (link.isCritical) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
        ctx.shadowBlur = 6;
      } else {
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Draw Arrow Head
      const arrowSize = 7;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowSize - 2, endY - arrowSize);
      ctx.lineTo(endX - arrowSize - 2, endY + arrowSize);
      ctx.fillStyle = link.isCritical ? '#f43f5e' : '#818cf8';
      ctx.fill();
    });

    // Draw Nodes
    this.nodes.forEach(node => {
      const { x, y, width: w, height: h, task, project, resource } = node;
      const radius = 8;

      // Card Background
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Border (critical glow if critical path)
      if (task.isCritical) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Project Color Pill Stripe on top
      ctx.beginPath();
      ctx.roundRect(x, y, w, 4, [radius, radius, 0, 0]);
      ctx.fillStyle = project?.color || '#6366f1';
      ctx.fill();

      // Task Title
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f8fafc';
      const truncatedTitle = task.title.length > 22 ? task.title.slice(0, 20) + '...' : task.title;
      ctx.fillText(truncatedTitle, x + 10, y + 25);

      // Duration in Man-Hours & Progress
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(`⏱ ${task.durationHours}h effort`, x + 10, y + 46);

      // Resource Assignee badge
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      const assigneesCount = Array.isArray(task.assignedResourceIds) ? task.assignedResourceIds.length : (task.assignedResourceId ? 1 : 0);
      let assigneeText = 'Unassigned';
      if (assigneesCount > 1) {
        assigneeText = `👥 ${assigneesCount} people (${task.effectiveDailyCapacity || 8}h/d)`;
      } else if (resource) {
        assigneeText = `👤 ${resource.name.split(' ')[0]}`;
      }
      ctx.fillText(assigneeText, x + 10, y + 66);

      // Progress percentage on right
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = task.progress === 100 ? '#34d399' : '#e2e8f0';
      ctx.fillText(`${task.progress || 0}%`, x + w - 38, y + 66);
    });

    ctx.restore();
  }
}
