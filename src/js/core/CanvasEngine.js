/**
 * CanvasEngine — 畫布引擎
 * 管理平移、縮放、座標轉換
 */
export class CanvasEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1;
    this.minZoom = 0.1;
    this.maxZoom = 5;
    this._resizeHandler = null;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  /** 螢幕座標 → 畫布世界座標 */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.zoom - this.offsetX,
      y: (sy - this.height / 2) / this.zoom - this.offsetY,
    };
  }

  /** 畫布世界座標 → 螢幕座標 */
  worldToScreen(wx, wy) {
    return {
      x: (wx + this.offsetX) * this.zoom + this.width / 2,
      y: (wy + this.offsetY) * this.zoom + this.height / 2,
    };
  }

  pan(dx, dy) {
    this.offsetX += dx / this.zoom;
    this.offsetY += dy / this.zoom;
  }

  zoomAt(centerSx, centerSy, factor) {
    const world = this.screenToWorld(centerSx, centerSy);
    const oldZoom = this.zoom;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const actualFactor = this.zoom / oldZoom;
    // 保持中心點不動
    this.offsetX = (centerSx - this.width / 2) / this.zoom - world.x;
    this.offsetY = (centerSy - this.height / 2) / this.zoom - world.y;
  }

  setZoom(zoom, centerSx, centerSy) {
    const factor = zoom / this.zoom;
    this.zoomAt(centerSx, centerSy, factor);
  }

  fitView(nodes, padding = 80) {
    if (!nodes || nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const hw = (n.width || 120) / 2;
      const hh = (n.height || 40) / 2;
      if (n.x - hw < minX) minX = n.x - hw;
      if (n.y - hh < minY) minY = n.y - hh;
      if (n.x + hw > maxX) maxX = n.x + hw;
      if (n.y + hh > maxY) maxY = n.y + hh;
    }
    const worldW = maxX - minX + padding * 2;
    const worldH = maxY - minY + padding * 2;
    if (worldW <= 0 || worldH <= 0) return;
    const zoomX = this.width / worldW;
    const zoomY = this.height / worldH;
    this.zoom = Math.min(zoomX, zoomY, 2);
    this.offsetX = -(minX + (maxX - minX) / 2);
    this.offsetY = -(minY + (maxY - minY) / 2);
  }

  clear() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 儲存並套用畫布 transform */
  saveTransform() {
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(this.offsetX, this.offsetY);
  }

  restoreTransform() {
    this.ctx.restore();
  }

  /** 在畫布世界座標繪製網格點 */
  drawGrid() {
    const gridSize = 60;
    const dpr = window.devicePixelRatio || 1;

    // 計算可見範圍（世界座標）
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.width, this.height);

    const startX = Math.floor(topLeft.x / gridSize) * gridSize;
    const startY = Math.floor(topLeft.y / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(this.offsetX, this.offsetY);

    // 根據 zoom 調整網格透明度
    const dotAlpha = Math.min(1, Math.max(0.05, (this.zoom - 0.3) / 1.5));
    this.ctx.fillStyle = `rgba(180, 170, 150, ${dotAlpha * 0.4})`;

    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }
}
