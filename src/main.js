/**
 * MindCanvas — 主應用程式入口
 * 整合所有模組，管理狀態機與事件流
 */
import { CanvasEngine } from './js/core/CanvasEngine.js';
import { EventManager } from './js/core/EventManager.js';
import { Renderer } from './js/core/Renderer.js';
import { MindMap } from './js/mindmap/MindMap.js';
import { LayoutEngine } from './js/mindmap/LayoutEngine.js';
import { InkEngine } from './js/ink/InkEngine.js';
import { Storage } from './js/storage/Storage.js';
import { Toolbar } from './js/ui/Toolbar.js';
import { FileManager } from './js/ui/FileManager.js';
import { ContextMenu } from './js/ui/ContextMenu.js';

class MindCanvasApp {
  constructor() {
    this.canvas = document.getElementById('main-canvas');
    this.ce = new CanvasEngine(this.canvas);
    this.events = new EventManager(this.canvas);
    this.renderer = new Renderer(this.ce);
    this.mindMap = new MindMap();
    this.layout = new LayoutEngine();
    this.ink = new InkEngine();
    this.storage = new Storage();
    this.toolbar = new Toolbar();
    this.fileManager = new FileManager(this.storage);
    this.contextMenu = new ContextMenu();

    this.mode = 'edit'; // 'edit' | 'ink'
    this.selectedNodeId = null;
    this.editingNodeId = null;
    this.draggingNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.zoom = 1;

    this.currentProjectId = null;
    this.currentProjectName = '未命名心智圖';
    this.isDirty = false;
    this.autoSaveTimer = null;

    this._initCanvas();
    this._initEvents();
    this._initKeyboard();
    this._initToolbarButtons();
    this._initDefaultMindMap();
    this._loadAutoSave();
    this._renderLoop();
  }

  _initCanvas() {
    this.ce.resize();
    window.addEventListener('resize', () => {
      this.ce.resize();
    });
  }

  _initEvents() {
    // Pointer Down
    this.events.setHandler('onPointerDown', (e) => {
      if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
        // 中鍵或 Ctrl+左鍵 → 平移
        this.isPanning = true;
        this.panStart = { x: e.x, y: e.y };
        return;
      }

      if (this.mode === 'ink') {
        // 手寫模式
        const world = this.ce.screenToWorld(e.x, e.y);
        this.ink.beginStroke(world.x, world.y, this._getInkColor(), this._getInkSize(), e.pressure);
        return;
      }

      // 編輯模式
      const world = this.ce.screenToWorld(e.x, e.y);
      const node = this._hitTestNode(world.x, world.y);

      if (node) {
        this.selectedNodeId = node.id;
        this.draggingNode = node;
        const screen = this.ce.worldToScreen(node.x, node.y);
        this.dragOffset = { x: world.x - node.x, y: world.y - node.y };
      } else {
        this.selectedNodeId = null;
        // 點空白 → 平移
        this.isPanning = true;
        this.panStart = { x: e.x, y: e.y };
      }
    });

    // Pointer Move
    this.events.setHandler('onPointerMove', (e) => {
      if (this.isPanning) {
        const dx = e.x - this.panStart.x;
        const dy = e.y - this.panStart.y;
        this.ce.pan(dx, dy);
        this.panStart = { x: e.x, y: e.y };
        return;
      }

      if (this.mode === 'ink') {
        const world = this.ce.screenToWorld(e.x, e.y);
        this.ink.continueStroke(world.x, world.y, e.pressure);
        return;
      }

      if (this.draggingNode) {
        const world = this.ce.screenToWorld(e.x, e.y);
        this.draggingNode.x = world.x - this.dragOffset.x;
        this.draggingNode.y = world.y - this.dragOffset.y;
        this.isDirty = true;
      }
    });

    // Pointer Up
    this.events.setHandler('onPointerUp', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        return;
      }

      if (this.mode === 'ink') {
        this.ink.endStroke();
        this.isDirty = true;
        return;
      }

      if (this.draggingNode) {
        // 檢查是否拖曳到新的父節點
        this.draggingNode = null;
        this.isDirty = true;
      }
    });

    // Wheel (縮放)
    this.events.setHandler('onWheel', (e) => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.ce.zoomAt(e.x, e.y, factor);
      this.toolbar.setZoom(this.ce.zoom);
    });

    // Context Menu
    this.events.setHandler('onContextMenu', (e) => {
      const world = this.ce.screenToWorld(e.x, e.y);
      const node = this._hitTestNode(world.x, world.y);
      if (node) {
        this.selectedNodeId = node.id;
        const items = [
          { label: '✏️ 編輯文字', action: () => this._editNode(node) },
          { label: '➕ 新增子節點', action: () => { this._addChild(node); this._layoutAndRender(); } },
          { label: '↕️ 新增同級節點', action: () => { this._addSibling(node); this._layoutAndRender(); } },
          { label: node.collapsed ? '🔽 展開' : '🔼 折疊', action: () => { node.collapsed = !node.collapsed; this._layoutAndRender(); } },
          { separator: true },
          { label: '🗑️ 刪除節點', danger: true, action: () => { this._deleteNode(node); this._layoutAndRender(); } },
        ];
        this.contextMenu.show(e.x, e.y, items);
      }
    });
  }

  _initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // 如果正在編輯文字，不攔截
      if (document.querySelector('.node-editor')) {
        if (e.key === 'Escape') {
          // 關閉編輯器由編輯器自己處理
        }
        return;
      }

      const selectedNode = this.selectedNodeId ? this.mindMap.getNodeById(this.selectedNodeId) : null;

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          if (selectedNode) {
            this._addChild(selectedNode);
            this._layoutAndRender();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedNode && !selectedNode.isRoot) {
            this._addSibling(selectedNode);
            this._layoutAndRender();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedNode && !selectedNode.isRoot) {
            this._deleteNode(selectedNode);
            this.selectedNodeId = null;
            this._layoutAndRender();
          }
          break;
        case ' ':
          e.preventDefault();
          if (selectedNode) {
            selectedNode.collapsed = !selectedNode.collapsed;
            this._layoutAndRender();
          }
          break;
        case 'e':
        case 'E':
          if (!e.ctrlKey && !e.metaKey) {
            this._setMode('edit');
          }
          break;
        case 'w':
        case 'W':
          if (!e.ctrlKey && !e.metaKey) {
            this._setMode('ink');
          }
          break;
      }

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this._saveProject();
            break;
          case 'o':
            e.preventDefault();
            this._openProject();
            break;
          case 'z':
            if (this.mode === 'ink') {
              e.preventDefault();
              this.ink.undo();
            }
            break;
          case '=':
          case '+':
            e.preventDefault();
            this.ce.zoomAt(this.ce.width / 2, this.ce.height / 2, 1.1);
            this.toolbar.setZoom(this.ce.zoom);
            break;
          case '-':
            e.preventDefault();
            this.ce.zoomAt(this.ce.width / 2, this.ce.height / 2, 0.9);
            this.toolbar.setZoom(this.ce.zoom);
            break;
          case '0':
            e.preventDefault();
            this.ce.zoom = 1;
            this.toolbar.setZoom(1);
            break;
        }
      }
    });
  }

  _initToolbarButtons() {
    // Mode buttons
    document.getElementById('btn-mode-edit').addEventListener('click', () => this._setMode('edit'));
    document.getElementById('btn-mode-ink').addEventListener('click', () => this._setMode('ink'));

    // Ink tools
    document.getElementById('btn-ink-undo').addEventListener('click', () => {
      this.ink.undo();
    });
    document.getElementById('btn-ink-clear').addEventListener('click', () => {
      if (confirm('清除所有手寫筆跡？')) {
        this.ink.clear();
      }
    });

    // Edit tools
    document.getElementById('btn-add-child').addEventListener('click', () => {
      const node = this.selectedNodeId ? this.mindMap.getNodeById(this.selectedNodeId) : this.mindMap.root;
      if (node) {
        this._addChild(node);
        this._layoutAndRender();
      }
    });
    document.getElementById('btn-add-sibling').addEventListener('click', () => {
      const node = this.selectedNodeId ? this.mindMap.getNodeById(this.selectedNodeId) : null;
      if (node && !node.isRoot) {
        this._addSibling(node);
        this._layoutAndRender();
      }
    });
    document.getElementById('btn-delete').addEventListener('click', () => {
      const node = this.selectedNodeId ? this.mindMap.getNodeById(this.selectedNodeId) : null;
      if (node && !node.isRoot) {
        this._deleteNode(node);
        this.selectedNodeId = null;
        this._layoutAndRender();
      }
    });
    document.getElementById('btn-collapse').addEventListener('click', () => {
      const node = this.selectedNodeId ? this.mindMap.getNodeById(this.selectedNodeId) : null;
      if (node) {
        node.collapsed = !node.collapsed;
        this._layoutAndRender();
      }
    });

    // File operations
    document.getElementById('btn-save').addEventListener('click', () => this._saveProject());
    document.getElementById('btn-open').addEventListener('click', () => this._openProject());
    document.getElementById('btn-export').addEventListener('click', () => this._exportPNG());

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.ce.zoomAt(this.ce.width / 2, this.ce.height / 2, 1.2);
      this.toolbar.setZoom(this.ce.zoom);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.ce.zoomAt(this.ce.width / 2, this.ce.height / 2, 0.8);
      this.toolbar.setZoom(this.ce.zoom);
    });
    document.getElementById('btn-fit').addEventListener('click', () => {
      const nodes = this.mindMap.getAllVisible();
      this.ce.fitView(nodes);
      this.toolbar.setZoom(this.ce.zoom);
    });
  }

  _setMode(mode) {
    this.mode = mode;
    this.toolbar.setMode(mode);

    if (mode === 'ink') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'grab';
    }
  }

  _initDefaultMindMap() {
    this.mindMap.createRoot('中央主題');

    const child1 = this.mindMap.addChild(this.mindMap.root, '分支一');
    const child2 = this.mindMap.addChild(this.mindMap.root, '分支二');
    const child3 = this.mindMap.addChild(this.mindMap.root, '分支三');

    this.mindMap.addChild(child1, '子項 A');
    this.mindMap.addChild(child1, '子項 B');
    this.mindMap.addChild(child2, '子項 C');
    this.mindMap.addChild(child3, '子項 D');
    this.mindMap.addChild(child3, '子項 E');

    this.layout.layout(this.mindMap);
    this.selectedNodeId = this.mindMap.root.id;
  }

  _addChild(parentNode) {
    const child = this.mindMap.addChild(parentNode, '新節點');
    this.selectedNodeId = child.id;
    this.isDirty = true;
    // 自動觸發編輯
    setTimeout(() => this._editNode(child), 50);
    return child;
  }

  _addSibling(node) {
    const sibling = this.mindMap.addSibling(node, '新節點');
    if (sibling) {
      this.selectedNodeId = sibling.id;
      this.isDirty = true;
      setTimeout(() => this._editNode(sibling), 50);
    }
    return sibling;
  }

  _deleteNode(node) {
    if (this.mindMap.deleteNode(node)) {
      this.isDirty = true;
    }
  }

  _editNode(node) {
    // 先移除舊的 editor
    document.querySelectorAll('.node-editor').forEach(el => el.remove());

    const screen = this.ce.worldToScreen(node.x, node.y);
    const canvasRect = this.canvas.getBoundingClientRect();

    const textarea = document.createElement('textarea');
    textarea.className = 'node-editor';
    textarea.value = node.text;
    textarea.placeholder = '輸入文字…';
    textarea.style.position = 'fixed';
    textarea.style.left = (canvasRect.left + screen.x - node.width / 2 * this.ce.zoom + 6 * this.ce.zoom) + 'px';
    textarea.style.top = (canvasRect.top + screen.y - node.height / 2 * this.ce.zoom + 4 * this.ce.zoom) + 'px';
    textarea.style.width = Math.max(30, node.width * this.ce.zoom - 12 * this.ce.zoom) + 'px';
    textarea.style.height = Math.max(24, node.height * this.ce.zoom - 8 * this.ce.zoom) + 'px';
    textarea.style.fontSize = (14 * this.ce.zoom) + 'px';
    textarea.style.zIndex = '999';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const finish = (save) => {
      if (save && textarea.value.trim()) {
        node.text = textarea.value.trim();
        // 自動調整寬度
        const ctx = this.ce.ctx;
        ctx.font = '14px "Noto Sans TC", sans-serif';
        const textWidth = ctx.measureText(node.text).width;
        node.width = Math.max(120, Math.min(280, textWidth + 24));
        node.height = 40;
        this.isDirty = true;
      }
      textarea.remove();
      this._activeEditor = null;
      this._activeEditorNode = null;
      this.editingNodeId = null;
    };

    textarea.addEventListener('blur', () => finish(true));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        finish(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish(true);
        this._layoutAndRender();
      }
    });

    this._activeEditor = textarea;
    this._activeEditorNode = node;
    this.editingNodeId = node.id;
  }

  _hitTestNode(wx, wy) {
    const nodes = this.mindMap.getAllVisible();
    // 從葉子往根測（上層節點優先選）
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const halfW = (n.width || 120) / 2;
      const halfH = (n.height || 40) / 2;
      if (wx >= n.x - halfW && wx <= n.x + halfW &&
          wy >= n.y - halfH && wy <= n.y + halfH) {
        return n;
      }
    }
    return null;
  }

  _getInkColor() {
    return document.getElementById('ink-color').value;
  }

  _getInkSize() {
    return parseFloat(document.getElementById('ink-size').value);
  }

  _layoutAndRender() {
    this.layout.layout(this.mindMap);
  }

  // ─── 檔案操作 ───

  async _loadAutoSave() {
    try {
      await this.storage.init();
      const autoSave = await this.storage.getAutoSave();
      if (autoSave) {
        this._loadProjectData(autoSave);
        this.toolbar.setStatus(`已自動載入：${autoSave.name}`);
      }
    } catch (e) {
      console.warn('Auto load failed:', e);
    }
  }

  _loadProjectData(data) {
    if (!data) return;
    this.currentProjectId = data.id;
    this.currentProjectName = data.name;
    this.mindMap = MindMap.fromJSON(data.mindmap);
    if (data.ink) {
      this.ink = InkEngine.fromJSON(data.ink);
    } else {
      this.ink = new InkEngine();
    }
    this.layout.layout(this.mindMap);
    this.selectedNodeId = this.mindMap.root ? this.mindMap.root.id : null;
    this.isDirty = false;
  }

  async _saveProject() {
    const data = {
      name: this.currentProjectName,
      mindmap: this.mindMap.toJSON(),
      ink: this.ink.toJSON(),
      nodeCount: this.mindMap.getAll().length,
    };

    if (this.currentProjectId) {
      data.id = this.currentProjectId;
    } else {
      const name = await this.fileManager.saveAs(this.currentProjectName);
      if (!name) return;
      data.name = name;
      this.currentProjectName = name;
    }

    try {
      const id = await this.storage.save(data);
      this.currentProjectId = id;
      this.isDirty = false;
      this.toolbar.setStatus(`已儲存：${data.name}`);
    } catch (e) {
      console.error('Save failed:', e);
      this.toolbar.setStatus('❌ 儲存失敗');
    }
  }

  async _openProject() {
    const data = await this.fileManager.open();
    if (data) {
      this._loadProjectData(data);
      this.toolbar.setStatus(`已開啟：${data.name}`);
    }
  }

  _exportPNG() {
    const offscreen = document.createElement('canvas');
    const nodes = this.mindMap.getAll();

    // 計算範圍
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const hw = (n.width || 120) / 2;
      const hh = (n.height || 40) / 2;
      if (n.x - hw < minX) minX = n.x - hw;
      if (n.y - hh < minY) minY = n.y - hh;
      if (n.x + hw > maxX) maxX = n.x + hw;
      if (n.y + hh > maxY) maxY = n.y + hh;
    }

    // 包含筆跡
    if (this.ink.strokes.length > 0) {
      for (const s of this.ink.strokes) {
        const b = s.getBounds();
        if (!b) continue;
        if (b.minX < minX) minX = b.minX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.maxY > maxY) maxY = b.maxY;
      }
    }

    const padding = 60;
    const width = (maxX - minX + padding * 2);
    const height = (maxY - minY + padding * 2);
    const scale = 2; // 2x 輸出

    offscreen.width = width * scale;
    offscreen.height = height * scale;
    const ctx = offscreen.getContext('2d');
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, width, height);

    // 轉換
    ctx.translate(padding - minX, padding - minY);

    // 繪製連線
    const connections = this.mindMap.getAllConnections();
    ctx.strokeStyle = '#b8a88a';
    ctx.lineWidth = 1.8;
    for (const conn of connections) {
      const x1 = conn.from.x + conn.from.width / 2;
      const y1 = conn.from.y;
      const x2 = conn.to.x - conn.to.width / 2;
      const y2 = conn.to.y;
      const cpx = (x1 + x2) / 2;
      const cpy = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.stroke();
    }

    // 繪製節點
    const allNodes = this.mindMap.getAllVisible();
    for (const node of allNodes) {
      const x = node.x;
      const y = node.y;
      const w = node.width;
      const h = node.height;
      const halfW = w / 2;
      const halfH = h / 2;

      ctx.fillStyle = '#faf6ef';
      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      // round rect
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(x - halfW + r, y - halfH);
      ctx.lineTo(x + halfW - r, y - halfH);
      ctx.quadraticCurveTo(x + halfW, y - halfH, x + halfW, y - halfH + r);
      ctx.lineTo(x + halfW, y + halfH - r);
      ctx.quadraticCurveTo(x + halfW, y + halfH, x + halfW - r, y + halfH);
      ctx.lineTo(x - halfW + r, y + halfH);
      ctx.quadraticCurveTo(x - halfW, y + halfH, x - halfW, y + halfH - r);
      ctx.lineTo(x - halfW, y - halfH + r);
      ctx.quadraticCurveTo(x - halfW, y - halfH, x - halfW + r, y - halfH);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#c8b89a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#2c2c2c';
      ctx.font = '14px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.text, x, y);
    }

    // 繪製筆跡
    ctx.shadowColor = 'transparent';
    for (const stroke of this.ink.strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p0 = stroke.points[i];
        const p1 = stroke.points[i + 1];
        const p = (p0.pressure || 0.5) * stroke.size;
        ctx.lineWidth = Math.max(0.5, p);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // 輸出
    const link = document.createElement('a');
    link.download = `${this.currentProjectName}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
    this.toolbar.setStatus('✅ 已匯出 PNG');
  }

  // ─── 自動儲存 ───

  _autoSave() {
    if (!this.isDirty) return;
    // 每 30 秒自動存一次（如果有變更）
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this._saveProject();
    }, 30000);
  }

  // ─── 渲染循環 ───

  _renderLoop() {
    // 更新 floating editor 位置
    if (this._activeEditor && this._activeEditorNode) {
      const node = this._activeEditorNode;
      const screen = this.ce.worldToScreen(node.x, node.y);
      const canvasRect = this.canvas.getBoundingClientRect();
      this._activeEditor.style.left = (canvasRect.left + screen.x - node.width / 2 * this.ce.zoom + 6 * this.ce.zoom) + 'px';
      this._activeEditor.style.top = (canvasRect.top + screen.y - node.height / 2 * this.ce.zoom + 4 * this.ce.zoom) + 'px';
      this._activeEditor.style.width = Math.max(30, node.width * this.ce.zoom - 12 * this.ce.zoom) + 'px';
      this._activeEditor.style.height = Math.max(24, node.height * this.ce.zoom - 8 * this.ce.zoom) + 'px';
      this._activeEditor.style.fontSize = (14 * this.ce.zoom) + 'px';
    }

    this.renderer.render(this.mindMap, this.selectedNodeId, this.ink, this.editingNodeId);
    this._autoSave();
    requestAnimationFrame(() => this._renderLoop());
  }
}

// ─── 啟動 ───
document.addEventListener('DOMContentLoaded', () => {
  new MindCanvasApp();
});
