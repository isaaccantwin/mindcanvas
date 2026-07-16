/**
 * Renderer — 繪圖管線
 * 負責渲染心智圖節點、連線、手寫筆跡
 */
export class Renderer {
  constructor(canvasEngine) {
    this.ce = canvasEngine;
    this.ctx = canvasEngine.ctx;
  }

  /** 主渲染循環 */
  render(mindMap, selectedNodeId, inkEngine, editingNodeId) {
    const ctx = this.ctx;
    const ce = this.ce;

    ce.clear();
    ce.drawGrid();

    if (!mindMap || !mindMap.root) return;

    // 世界座標 transform
    ce.saveTransform();

    // 1. 繪製連線
    const connections = mindMap.getAllConnections();
    for (const conn of connections) {
      this._drawConnection(conn.from, conn.to);
    }

    // 2. 繪製節點
    const nodes = mindMap.getAllVisible();
    for (const node of nodes) {
      const isSelected = node.id === selectedNodeId;
      const isEditing = node.id === editingNodeId;
      this._drawNode(node, isSelected, isEditing);
    }

    ce.restoreTransform();

    // 3. 繪製手寫筆跡（在螢幕座標系，但用世界 transform）
    if (inkEngine) {
      ce.saveTransform();
      inkEngine.render(ctx);
      ce.restoreTransform();
    }
  }

  _drawNode(node, isSelected, isEditing) {
    const ctx = this.ctx;
    const x = node.x;
    const y = node.y;
    const w = node.width;
    const h = node.height;
    const halfW = w / 2;
    const halfH = h / 2;

    // 手繪矩形 — 用兩次 stroke 製造自然感
    ctx.save();

    // 陰影
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // 背景
    ctx.fillStyle = node.bgColor || '#faf6ef';
    this._roundRect(x - halfW, y - halfH, w, h, 6);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // 邊框 — 主線
    ctx.strokeStyle = isSelected ? '#d4a574' : '#c8b89a';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    this._roundRect(x - halfW, y - halfH, w, h, 6);
    ctx.stroke();

    // 邊框 — 手繪疊加重疊線，製造手繪感
    if (!isSelected) {
      ctx.strokeStyle = 'rgba(180, 160, 130, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const r = 6;
      const x1 = x - halfW, y1 = y - halfH, x2 = x + halfW, y2 = y + halfH;
      ctx.moveTo(x1 + r + 2, y1 - 1);
      ctx.lineTo(x2 - r + 1, y1 + 1);
      ctx.stroke();
    }

    // 文字（編輯中不畫，避免與 textarea 重疊）
    if (!isEditing) {
      ctx.fillStyle = node.color || '#2c2c2c';
      ctx.font = '14px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let text = node.text;
      const maxWidth = w - 16;
      if (ctx.measureText(text).width > maxWidth) {
        while (ctx.measureText(text + '…').width > maxWidth && text.length > 1) {
          text = text.slice(0, -1);
        }
        text += '…';
      }
      ctx.fillText(text, x, y);
    }

    // 子節點數量標記（折疊時顯示數量）
    if (node.children.length > 0 && node.collapsed) {
      ctx.fillStyle = '#b8834a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`+${node.children.length}`, x, y + halfH - 2);
    }

    ctx.restore();
  }

  _drawConnection(from, to) {
    const ctx = this.ctx;
    const x1 = from.x + from.width / 2;
    const y1 = from.y;
    const x2 = to.x - to.width / 2;
    const y2 = to.y;

    ctx.save();

    // 貝茲曲線 — 有機自然感
    const cpx = (x1 + x2) / 2;
    const cpy = (y1 + y2) / 2;

    // 主線
    ctx.strokeStyle = '#b8a88a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();

    // 疊加重疊線（手繪感）
    ctx.strokeStyle = 'rgba(180, 160, 130, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 - 1);
    ctx.quadraticCurveTo(cpx + 2, cpy + 1, x2 + 1, y2 - 1);
    ctx.stroke();

    ctx.restore();
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
