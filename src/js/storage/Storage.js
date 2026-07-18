/**
 * Storage — IndexedDB 封裝 + Git 同步 + 版本歷史
 */
const DB_NAME = 'MindCanvasDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const VERSION_STORE = 'versions';
const MAX_VERSIONS = 20;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(VERSION_STORE)) {
        const vs = db.createObjectStore(VERSION_STORE, { keyPath: 'vid', autoIncrement: true });
        vs.createIndex('projectId', 'projectId', { unique: false });
        vs.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class Storage {
  constructor() {
    this.db = null;
    this.sync = null;
  }

  async init() {
    this.db = await openDB();
  }

  async list() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result.map(item => ({
          id: item.id,
          name: item.name,
          updatedAt: item.updatedAt,
          nodeCount: item.nodeCount || 0,
        }));
        items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async load(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * 儲存專案 + 保留版本歷史
   */
  async save(data) {
    const db = await openDB();
    const item = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const id = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = data.id ? store.put(item) : store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // 儲存版本快照（保留最近 MAX_VERSIONS 個）
    await this._saveVersion(db, id, item);
    await this._pruneVersions(db, id);

    // Git 同步
    let synced = false;
    if (this.sync && this.sync.ready) {
      this.sync.save(String(id), item.name, item).then(r => {
        synced = r.ok;
      }).catch(() => {});
    }

    return { id, synced };
  }

  async _saveVersion(db, projectId, data) {
    const tx = db.transaction(VERSION_STORE, 'readwrite');
    const store = tx.objectStore(VERSION_STORE);
    return new Promise((resolve, reject) => {
      const req = store.add({
        projectId: Number(projectId),
        name: data.name,
        mindmap: data.mindmap,
        ink: data.ink,
        nodeCount: data.nodeCount,
        savedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _pruneVersions(db, projectId) {
    const tx = db.transaction(VERSION_STORE, 'readwrite');
    const store = tx.objectStore(VERSION_STORE);
    const index = store.index('projectId');
    const req = index.getAll(Number(projectId));
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const versions = req.result;
        if (versions.length <= MAX_VERSIONS) { resolve(); return; }
        // 刪除最舊的
        versions.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
        const toDelete = versions.slice(0, versions.length - MAX_VERSIONS);
        const tx2 = db.transaction(VERSION_STORE, 'readwrite');
        const s2 = tx2.objectStore(VERSION_STORE);
        for (const v of toDelete) s2.delete(v.vid);
        tx2.oncomplete = () => resolve();
        tx2.onerror = () => reject();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** 取得某個專案的所有版本歷史 */
  async getVersions(projectId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VERSION_STORE, 'readonly');
      const index = tx.objectStore(VERSION_STORE).index('projectId');
      const req = index.getAll(Number(projectId));
      req.onsuccess = () => {
        const versions = req.result;
        versions.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        resolve(versions.map(v => ({
          vid: v.vid,
          savedAt: v.savedAt,
          nodeCount: v.nodeCount || 0,
        })));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** 從版本歷史還原 */
  async restoreVersion(versionId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VERSION_STORE, 'readonly');
      const store = tx.objectStore(VERSION_STORE);
      const req = store.get(Number(versionId));
      req.onsuccess = () => {
        const version = req.result;
        if (!version) { resolve(null); return; }
        resolve({
          name: version.name,
          mindmap: version.mindmap,
          ink: version.ink,
          nodeCount: version.nodeCount,
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async remove(id) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (this.sync && this.sync.ready) {
      this.sync.delete(String(id)).catch(() => {});
    }
  }

  async getAutoSave() {
    const items = await this.list();
    if (items.length === 0) return null;
    return items[0];
  }
}
