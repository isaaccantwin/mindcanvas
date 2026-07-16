/**
 * FileManager — 檔案管理 UI（儲存/開啟對話框）
 */
export class FileManager {
  constructor(storage) {
    this.storage = storage;
    this.modal = document.getElementById('file-modal');
    this.fileList = document.getElementById('file-list');
    this.closeBtn = this.modal.querySelector('.close-btn');

    this.closeBtn.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this._resolve = null;
    this._reject = null;
  }

  /**
   * 開啟檔案選擇對話框
   * 回傳 Promise<{id, name, data} | null>
   */
  async open() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._render();
      this.modal.classList.remove('hidden');
    });
  }

  close() {
    this.modal.classList.add('hidden');
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
  }

  async _render() {
    const items = await this.storage.list();

    if (items.length === 0) {
      this.fileList.innerHTML = '<p class="empty-msg">暫無儲存檔案</p>';
      return;
    }

    this.fileList.innerHTML = '';
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'file-item';

      const info = document.createElement('div');
      info.style.flex = '1';

      const nameSpan = document.createElement('div');
      nameSpan.className = 'file-item-name';
      nameSpan.textContent = item.name;

      const dateSpan = document.createElement('div');
      dateSpan.className = 'file-item-date';
      dateSpan.textContent = new Date(item.updatedAt).toLocaleString('zh-TW') +
        ` · ${item.nodeCount} 個節點`;

      info.appendChild(nameSpan);
      info.appendChild(dateSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'file-item-delete';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.storage.remove(item.id);
        this._render();
      });

      div.appendChild(info);
      div.appendChild(delBtn);

      div.addEventListener('click', async () => {
        const data = await this.storage.load(item.id);
        this.modal.classList.add('hidden');
        if (this._resolve) {
          this._resolve(data);
          this._resolve = null;
        }
      });

      this.fileList.appendChild(div);
    }
  }

  /**
   * 另存新檔對話框（簡易 prompt）
   */
  async saveAs(currentName) {
    const name = prompt('儲存名稱:', currentName || '未命名心智圖');
    if (!name) return null;
    return name;
  }
}
