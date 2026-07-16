/**
 * Toolbar — UI 工具列控制
 */
export class Toolbar {
  constructor() {
    this.elements = {};

    // 收集所有有 id 的 toolbar 子元素
    const toolbar = document.getElementById('toolbar');
    toolbar.querySelectorAll('[id]').forEach(el => {
      this.elements[el.id] = el;
    });

    this.elements.modeEdit = document.getElementById('btn-mode-edit');
    this.elements.modeInk = document.getElementById('btn-mode-ink');
    this.elements.inkTools = document.getElementById('ink-tools');
    this.elements.editTools = document.getElementById('edit-tools');
    this.elements.statusText = document.getElementById('status-text');
    this.elements.modeIndicator = document.getElementById('mode-indicator');
    this.elements.zoomLevel = document.getElementById('zoom-level');
  }

  setMode(mode) {
    const isEdit = mode === 'edit';
    this.elements.modeEdit.classList.toggle('active', isEdit);
    this.elements.modeInk.classList.toggle('active', !isEdit);
    this.elements.inkTools.style.display = isEdit ? 'none' : 'flex';
    this.elements.statusText.textContent = isEdit ? '編輯模式：雙擊編輯文字 · Tab 新增子節點 · Enter 新增同級' : '手寫模式：自由書寫畫線';
    this.elements.modeIndicator.textContent = isEdit ? '✏️ 編輯模式' : '🖊️ 手寫模式';
  }

  setZoom(zoom) {
    this.elements.zoomLevel.textContent = Math.round(zoom * 100) + '%';
  }

  setStatus(text) {
    this.elements.statusText.textContent = text;
  }
}
