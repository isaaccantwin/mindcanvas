/**
 * Storage — IndexedDB 封裝
 * 儲存心智圖檔案（含筆跡）
 */
const DB_NAME = 'MindCanvasDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class Storage {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await openDB();
  }

  /**
   * 列出所有專案
   */
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
        // 依更新時間排序（最新的在前）
        items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * 載入專案
   */
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
   * 儲存專案（新增或更新）
   */
  async save(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const req = data.id ? store.put(item) : store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * 刪除專案
   */
  async remove(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * 取得自動儲存用的預設專案
   */
  async getAutoSave() {
    const items = await this.list();
    if (items.length === 0) return null;
    return items[0];
  }
}
