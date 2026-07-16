/**
 * ContextMenu — 右鍵選單
 */
export class ContextMenu {
  constructor() {
    this.el = document.getElementById('context-menu');
    this._callback = null;
    this._onClose = null;

    document.addEventListener('click', () => this.hide());
  }

  show(x, y, items) {
    this.el.innerHTML = '';
    this.el.classList.remove('hidden');

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        this.el.appendChild(sep);
        continue;
      }

      const div = document.createElement('div');
      div.className = 'context-menu-item' + (item.danger ? ' danger' : '');
      div.innerHTML = item.label;

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (item.action) item.action();
      });

      this.el.appendChild(div);
    }

    // 確保選單不會超出視窗
    const rect = this.el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;
    this.el.style.left = Math.min(x, maxX) + 'px';
    this.el.style.top = Math.min(y, maxY) + 'px';
  }

  hide() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }
}
