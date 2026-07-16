/**
 * LayoutEngine — 樹狀自動布局演算法
 * 標準心智圖布局：根節點置中，子節點向右放射性展開
 */
export class LayoutEngine {
  /**
   * 水平間距、垂直間距
   */
  constructor(options = {}) {
    this.hGap = options.hGap || 160;
    this.vGap = options.vGap || 50;
    this.nodeWidth = options.nodeWidth || 120;
    this.nodeHeight = options.nodeHeight || 40;
  }

  /**
   * 執行自動布局
   * 使用改良的 Walker 演算法（簡化版）
   */
  layout(mindMap) {
    if (!mindMap || !mindMap.root) return;
    const root = mindMap.root;

    // First pass: 計算子樹所需的垂直空間
    this._layout(root, 0);
    this._centerChildren(root);
  }

  /**
   * 遞迴布局：定位節點 x, y
   * 回傳 { width: 子樹寬度, height: 子樹高度 }
   */
  _layout(node, depth) {
    node.x = depth * this.hGap;

    if (node.children.length === 0 || node.collapsed) {
      // 葉節點
      node.y = 0;
      return { width: this.nodeWidth, height: this.nodeHeight };
    }

    // 遞迴布局所有子節點
    const childResults = [];
    for (const child of node.children) {
      const result = this._layout(child, depth + 1);
      childResults.push(result);
    }

    // 垂直堆疊子節點
    let totalHeight = 0;
    for (const r of childResults) {
      totalHeight += r.height;
    }
    totalHeight += (node.children.length - 1) * this.vGap;

    // 子節點垂直居中對齊
    let yOffset = -totalHeight / 2 + this.nodeHeight / 2;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const result = childResults[i];
      // 垂直居中這個子樹
      child.y = yOffset + result.height / 2 - this.nodeHeight / 2;
      yOffset += result.height + this.vGap;
    }

    // 這個節點的 y 在子樹垂直中心
    node.y = 0;

    return {
      width: depth === 0 ? this.nodeWidth : this.nodeWidth,
      height: totalHeight,
    };
  }

  /**
   * 將子樹垂直居中對齊父節點
   */
  _centerChildren(node) {
    if (node.children.length === 0 || node.collapsed) return;

    // 計算子節點群的垂直範圍
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];

    // 取得子節點群的中心（可能是子樹）
    const firstY = this._getSubtreeTop(firstChild);
    const lastY = this._getSubtreeBottom(lastChild);
    const centerY = (firstY + lastY) / 2;

    // 父節點 y 對齊這個中心
    const offset = node.y - centerY;
    for (const child of node.children) {
      this._shiftSubtree(child, 0, offset);
    }

    // 遞迴
    for (const child of node.children) {
      this._centerChildren(child);
    }
  }

  _getSubtreeTop(node) {
    if (node.children.length === 0 || node.collapsed) return node.y - this.nodeHeight / 2;
    let top = Infinity;
    const walk = (n) => {
      const t = n.y - this.nodeHeight / 2;
      if (t < top) top = t;
      if (!n.collapsed) for (const c of n.children) walk(c);
    };
    walk(node);
    return top;
  }

  _getSubtreeBottom(node) {
    if (node.children.length === 0 || node.collapsed) return node.y + this.nodeHeight / 2;
    let bottom = -Infinity;
    const walk = (n) => {
      const b = n.y + this.nodeHeight / 2;
      if (b > bottom) bottom = b;
      if (!n.collapsed) for (const c of n.children) walk(c);
    };
    walk(node);
    return bottom;
  }

  _shiftSubtree(node, dx, dy) {
    node.x += dx;
    node.y += dy;
    if (!node.collapsed) {
      for (const child of node.children) {
        this._shiftSubtree(child, dx, dy);
      }
    }
  }
}
