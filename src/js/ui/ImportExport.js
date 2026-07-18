/**
 * ImportExport — 心智圖格式匯入匯出
 * 支援 Markdown 大綱 / FreeMind .mm / JSON
 */
import { Node } from '../mindmap/MindMap.js';

export class ImportExport {
  constructor(mindMap) {
    this.mindMap = mindMap;
  }

  // ═══════════════════ 匯出 ═══════════════════

  /** 匯出 Markdown 大綱 */
  toMarkdown() {
    const walk = (node, depth) => {
      let s = '#'.repeat(Math.min(depth + 1, 6)) + ' ' + node.text + '\n';
      if (!node.collapsed) {
        for (const c of node.children) s += walk(c, depth + 1);
      }
      return s;
    };
    return walk(this.mindMap.root, 1);
  }

  /** 匯出 FreeMind .mm（XML） */
  toFreeMind() {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const walk = (node) => {
      let xml = `<node TEXT="${esc(node.text)}" ID="${esc(node.id)}"`;
      if (node.collapsed) xml += ' FOLDED="true"';
      if (node.children.length === 0) { xml += ' />\n'; return xml; }
      xml += '>\n';
      for (const c of node.children) xml += walk(c);
      xml += '</node>\n';
      return xml;
    };
    return '<map version="1.1">\n' + walk(this.mindMap.root) + '</map>';
  }

  /** 匯出原生 JSON */
  toJSON() {
    return JSON.stringify(this.mindMap.toJSON(), null, 2);
  }

  /** 下載檔案 */
  download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════ 匯入 ═══════════════════

  /** 從 File 物件匯入（自動偵測格式） */
  async importFile(file) {
    const text = await file.text();
    const name = file.name.toLowerCase();

    if (name.endsWith('.mm')) return this._parseFreeMind(text);
    if (name.endsWith('.md') || name.endsWith('.markdown')) return this._parseMarkdown(text);
    if (name.endsWith('.json') || name.endsWith('.mindcanvas.json')) return this._parseJSON(text);
    throw new Error('不支援的格式：' + file.name);
  }

  _parseMarkdown(text) {
    const lines = text.split('\n');
    const stack = []; // 用棧追蹤各層級的最後節點
    let root = null;

    for (const line of lines) {
      const m = line.match(/^(#{1,6})\s+(.+)/);
      if (!m) continue;
      const level = m[1].length;
      const text = m[2].trim();

      if (level === 1) {
        this.mindMap.createRoot(text);
        root = this.mindMap.root;
        stack.length = 0;
        stack[1] = root;
      } else if (root) {
        // 找到最近的上層節點
        let parent = null;
        for (let l = level - 1; l >= 1; l--) {
          if (stack[l]) { parent = stack[l]; break; }
        }
        if (parent) {
          const child = this.mindMap.addChild(parent, text);
          stack[level] = child;
        }
      }
    }
    return root;
  }

  _parseFreeMind(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const rootNode = doc.querySelector('map > node');
    if (!rootNode) throw new Error('無法解析 .mm 檔案');

    const idMap = {};
    const walk = (node, parent) => {
      const text = node.getAttribute('TEXT') || '未命名';
      const id = node.getAttribute('ID') || `import_${Math.random().toString(36).slice(2,8)}`;
      const folded = node.getAttribute('FOLDED') === 'true';

      let newNode;
      if (!parent) {
        this.mindMap.createRoot(text);
        newNode = this.mindMap.root;
      } else {
        newNode = this.mindMap.addChild(parent, text);
      }
      newNode.id = id;
      newNode.collapsed = folded;
      idMap[id] = newNode;

      for (const child of node.children) {
        if (child.tagName === 'node') walk(child, newNode);
      }
    };
    walk(rootNode, null);
    return this.mindMap.root;
  }

  _parseJSON(text) {
    const data = JSON.parse(text);
    this.mindMap.nextId = data.nextId || 1;
    if (data.root) {
      this.mindMap.root = Node.fromJSON(data.root);
    }
    return this.mindMap.root;
  }
}
