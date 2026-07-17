/**
 * GitSync — Git 同步前端模組
 * 透過 Vite dev server 的 API 端點操作 git
 */
const API = '/api/sync';

export class GitSync {
  constructor() {
    this.ready = false;
    this.hasRemote = false;
    this.lastSyncAt = null;
    this.syncing = false;
  }

  async _call(action, payload = {}) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  /** 檢查 sync server 是否可用 */
  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      this.ready = data.ready === true;
      return this.ready;
    } catch {
      this.ready = false;
      return false;
    }
  }

  /** 拉取最新資料 */
  async pull() {
    const result = await this._call('pull');
    return result.ok;
  }

  /** 儲存 + 同步（寫檔 + commit + push） */
  async save(id, name, data) {
    if (this.syncing) return { ok: false, error: 'already syncing' };
    this.syncing = true;
    try {
      const result = await this._call('save', { id, name, data });
      if (result.ok) {
        this.lastSyncAt = new Date();
        this.hasRemote = result.pushed;
      }
      return result;
    } finally {
      this.syncing = false;
    }
  }

  /** 列出所有檔案 */
  async list() {
    const result = await this._call('list');
    if (result.ok) return result.files;
    return [];
  }

  /** 載入指定檔案 */
  async load(id) {
    const result = await this._call('load', { id });
    if (result.ok) return result.data;
    return null;
  }

  /** 刪除檔案 */
  async delete(id) {
    return await this._call('delete', { id });
  }

  /** 取得同步狀態 */
  async status() {
    const result = await this._call('status');
    if (result.ok) {
      this.hasRemote = result.hasRemote;
    }
    return result;
  }

  /** 取得狀態文字 */
  getStatusText() {
    if (!this.ready) return '離線模式（僅本機）';
    if (this.syncing) return '同步中…';
    if (this.lastSyncAt) {
      const ago = Math.round((Date.now() - this.lastSyncAt.getTime()) / 1000);
      return this.hasRemote
        ? `已同步（${ago}秒前）`
        : `已儲存（${ago}秒前，未設定遠端）`;
    }
    return '就緒';
  }
}
