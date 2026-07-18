/**
 * EventManager — 統一的 Pointer Events 管理
 * 支援滑鼠、觸控、觸控筆
 * 分派給對應的 handler（編輯模式 / 手寫模式 / 平移縮放）
 */
export class EventManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handlers = {
      onPointerDown: null,
      onPointerMove: null,
      onPointerUp: null,
      onWheel: null,
      onDblClick: null,
    };
    this._activePointerId = null;
    this._bind();
  }

  setHandler(name, fn) {
    this.handlers[name] = fn;
  }

  _bind() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && e.isPrimary === false) return;
      this._activePointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      if (this.handlers.onPointerDown) {
        this.handlers.onPointerDown(this._extract(e));
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._activePointerId) return;
      if (this.handlers.onPointerMove) {
        this.handlers.onPointerMove(this._extract(e));
      }
    });

    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this._activePointerId) return;
      this._activePointerId = null;
      if (this.handlers.onPointerUp) {
        this.handlers.onPointerUp(this._extract(e));
      }
    });

    el.addEventListener('pointerleave', (e) => {
      if (e.pointerId !== this._activePointerId) return;
      this._activePointerId = null;
      if (this.handlers.onPointerUp) {
        this.handlers.onPointerUp(this._extract(e));
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.handlers.onWheel) {
        this.handlers.onWheel({
          x: e.offsetX,
          y: e.offsetY,
          deltaY: e.deltaY,
          ctrlKey: e.ctrlKey || e.metaKey,
        });
      }
    }, { passive: false });

    // 右鍵
    el.addEventListener('contextmenu', (e) => {
      if (this.handlers.onContextMenu) {
        this.handlers.onContextMenu(this._extract(e));
      }
      e.preventDefault();
    });

    // 雙擊
    el.addEventListener('dblclick', (e) => {
      if (this.handlers.onDblClick) {
        this.handlers.onDblClick(this._extract(e));
      }
    });
  }

  _extract(e) {
    return {
      x: e.offsetX,
      y: e.offsetY,
      pressure: e.pressure || 0.5,
      pointerType: e.pointerType,
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      event: e,
    };
  }
}
