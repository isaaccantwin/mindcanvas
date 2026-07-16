/**
 * Stroke — 單條筆跡
 */
export class Stroke {
  constructor(color, size) {
    this.color = color || '#2c2c2c';
    this.size = size || 3;
    this.points = []; // [{x, y, pressure}]
    this.createdAt = Date.now();
  }

  addPoint(x, y, pressure = 0.5) {
    this.points.push({ x, y, pressure });
  }

  isEmpty() {
    return this.points.length === 0;
  }

  toJSON() {
    return {
      color: this.color,
      size: this.size,
      points: this.points,
    };
  }

  static fromJSON(data) {
    const s = new Stroke(data.color, data.size);
    s.points = data.points || [];
    return s;
  }

  getBounds() {
    if (this.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }
}

/**
 * InkEngine — 手寫筆跡引擎
 * 管理筆跡的錄製、儲存、繪製、復原
 */
export class InkEngine {
  constructor() {
    this.strokes = [];
    this.currentStroke = null;
    this._undoStack = [];
  }

  /**
   * 開始一個新的筆跡
   */
  beginStroke(x, y, color = '#2c2c2c', size = 3, pressure = 0.5) {
    this.currentStroke = new Stroke(color, size);
    this.currentStroke.addPoint(x, y, pressure);
  }

  /**
   * 繼續當前筆跡
   */
  continueStroke(x, y, pressure = 0.5) {
    if (!this.currentStroke) return;
    this.currentStroke.addPoint(x, y, pressure);
  }

  /**
   * 結束當前筆跡
   */
  endStroke() {
    if (!this.currentStroke || this.currentStroke.isEmpty()) {
      this.currentStroke = null;
      return;
    }
    // 最少需要 2 個點才是一條有效筆跡
    if (this.currentStroke.points.length < 2) {
      this.currentStroke = null;
      return;
    }
    this.strokes.push(this.currentStroke);
    this._undoStack.push(this.currentStroke);
    this.currentStroke = null;
  }

  /**
   * 復原最後一條筆跡
   */
  undo() {
    if (this.strokes.length === 0) return false;
    this.strokes.pop();
    this._undoStack.pop();
    return true;
  }

  /**
   * 清除所有筆跡
   */
  clear() {
    this.strokes = [];
    this.currentStroke = null;
    this._undoStack = [];
  }

  /**
   * 渲染所有筆跡到 context
   */
  render(ctx) {
    const allStrokes = [...this.strokes];
    if (this.currentStroke && !this.currentStroke.isEmpty()) {
      allStrokes.push(this.currentStroke);
    }

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      this._renderStroke(ctx, stroke);
    }
  }

  _renderStroke(ctx, stroke) {
    const pts = stroke.points;
    ctx.save();

    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 壓力感應渲染：分段變粗細
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const p = (p0.pressure || 0.5) * stroke.size;
      ctx.lineWidth = Math.max(0.5, p);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      strokes: this.strokes.map(s => s.toJSON()),
    };
  }

  static fromJSON(data) {
    const engine = new InkEngine();
    engine.strokes = (data.strokes || []).map(s => Stroke.fromJSON(s));
    return engine;
  }
}
