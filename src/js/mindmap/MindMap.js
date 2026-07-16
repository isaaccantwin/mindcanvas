/**
 * Node — 心智圖節點
 */
export class Node {
  constructor(id, text, x, y) {
    this.id = id;
    this.text = text || '新節點';
    this.x = x || 0;
    this.y = y || 0;
    this.parent = null;
    this.children = [];
    this.width = 120;
    this.height = 40;
    this.collapsed = false;
    this.color = '#2c2c2c';
    this.bgColor = '#faf6ef';
    this.createdAt = Date.now();
  }

  get isRoot() {
    return this.parent === null;
  }

  get depth() {
    let d = 0;
    let n = this;
    while (n.parent) { d++; n = n.parent; }
    return d;
  }

  get visible() {
    if (this.isRoot) return true;
    let p = this.parent;
    while (p) {
      if (p.collapsed) return false;
      p = p.parent;
    }
    return true;
  }

  /** 取得此節點及所有可見子節點（用於拖曳命中檢測） */
  getSelfAndVisibleDescendants() {
    const result = [];
    const walk = (n) => {
      result.push(n);
      if (!n.collapsed) {
        for (const c of n.children) walk(c);
      }
    };
    walk(this);
    return result;
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      collapsed: this.collapsed,
      color: this.color,
      bgColor: this.bgColor,
      children: this.children.map(c => c.toJSON()),
    };
  }

  static fromJSON(data, parent = null) {
    const node = new Node(data.id, data.text, data.x, data.y);
    node.width = data.width || 120;
    node.height = data.height || 40;
    node.collapsed = data.collapsed || false;
    node.color = data.color || '#2c2c2c';
    node.bgColor = data.bgColor || '#faf6ef';
    node.parent = parent;
    for (const cData of (data.children || [])) {
      const child = Node.fromJSON(cData, node);
      node.children.push(child);
    }
    return node;
  }

  /** 從根到自己的路徑（用於唯一標識） */
  getPath() {
    const parts = [this.id];
    let n = this.parent;
    while (n) {
      parts.unshift(n.id);
      n = n.parent;
    }
    return parts.join('/');
  }
}

/**
 * MindMap — 心智圖資料模型
 * 管理所有節點的操作
 */
export class MindMap {
  constructor() {
    this.root = null;
    this.nextId = 1;
  }

  createRoot(text) {
    this.root = new Node(`n${this.nextId++}`, text, 0, 0);
    return this.root;
  }

  addChild(parentNode, text) {
    const child = new Node(`n${this.nextId++}`, text, parentNode.x + 150, parentNode.y);
    child.parent = parentNode;
    parentNode.children.push(child);
    return child;
  }

  addSibling(node, text) {
    if (!node.parent) return null;
    return this.addChild(node.parent, text);
  }

  deleteNode(node) {
    if (node.isRoot) return false;
    const parent = node.parent;
    const idx = parent.children.indexOf(node);
    if (idx === -1) return false;
    parent.children.splice(idx, 1);
    return true;
  }

  getNodeById(id) {
    const walk = (n) => {
      if (n.id === id) return n;
      for (const c of n.children) {
        const found = walk(c);
        if (found) return found;
      }
      return null;
    };
    return this.root ? walk(this.root) : null;
  }

  /** 所有可見節點（用於渲染） */
  getAllVisible() {
    if (!this.root) return [];
    const result = [];
    const walk = (n) => {
      result.push(n);
      if (!n.collapsed) {
        for (const c of n.children) walk(c);
      }
    };
    walk(this.root);
    return result;
  }

  /** 所有節點（無視折疊） */
  getAll() {
    if (!this.root) return [];
    const result = [];
    const walk = (n) => {
      result.push(n);
      for (const c of n.children) walk(c);
    };
    walk(this.root);
    return result;
  }

  /** 所有可見連線 */
  getAllConnections() {
    if (!this.root) return [];
    const result = [];
    const walk = (n) => {
      if (!n.collapsed) {
        for (const c of n.children) {
          result.push({ from: n, to: c });
          if (!c.collapsed) walk(c);
        }
      }
    };
    walk(this.root);
    return result;
  }

  toJSON() {
    return {
      nextId: this.nextId,
      root: this.root ? this.root.toJSON() : null,
    };
  }

  static fromJSON(data) {
    const map = new MindMap();
    map.nextId = data.nextId || 1;
    if (data.root) {
      map.root = Node.fromJSON(data.root);
    }
    return map;
  }
}
