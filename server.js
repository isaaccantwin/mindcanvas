/**
 * MindCanvas Production Server
 * 用於 VPS 上正式運行
 *
 * Usage:
 *   node server.js
 *   或
 *   npm start
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import http from 'http';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(homedir(), 'mindcanvas-data');
const STATIC_DIR = join(__dirname, 'dist');

// 確保資料目錄存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// 確保 dist 目錄存在
if (!existsSync(STATIC_DIR)) {
  console.error('❌ dist/ 目錄不存在，請先執行 npm run build');
  process.exit(1);
}

const git = simpleGit(DATA_DIR);
git.init().catch(() => {});
git.addConfig('user.email', 'mindcanvas@vps', false, 'local').catch(() => {});
git.addConfig('user.name', 'MindCanvas', false, 'local').catch(() => {});

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── API ───
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ready: true }));
    return;
  }

  if (req.url === '/api/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { action, id, name, data } = JSON.parse(body);
        switch (action) {
          case 'save': {
            const filename = `${id || name}.mindcanvas.json`;
            writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
            await git.add(filename);
            await git.commit(`sync: ${name || id}`).catch(() => {});
            await git.push().catch(() => {});
            res.end(JSON.stringify({ ok: true }));
            break;
          }
          case 'list': {
            const files = readdirSync(DATA_DIR)
              .filter(f => f.endsWith('.mindcanvas.json'))
              .map(f => {
                try {
                  const c = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8'));
                  return { id: f.replace('.mindcanvas.json', ''), name: c.name, updatedAt: c.updatedAt, nodeCount: c.nodeCount || 0 };
                } catch { return null; }
              })
              .filter(Boolean)
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            res.end(JSON.stringify({ ok: true, files }));
            break;
          }
          case 'load': {
            const fp = join(DATA_DIR, `${id}.mindcanvas.json`);
            if (!existsSync(fp)) { res.end(JSON.stringify({ ok: false })); return; }
            res.end(JSON.stringify({ ok: true, data: JSON.parse(readFileSync(fp, 'utf-8')) }));
            break;
          }
          case 'pull': {
            await git.pull().catch(() => {});
            res.end(JSON.stringify({ ok: true }));
            break;
          }
          case 'delete': {
            const fn = `${id}.mindcanvas.json`;
            const fp = join(DATA_DIR, fn);
            if (existsSync(fp)) rmSync(fp);
            await git.add(fn);
            await git.commit(`delete: ${id}`).catch(() => {});
            await git.push().catch(() => {});
            res.end(JSON.stringify({ ok: true }));
            break;
          }
          case 'status': {
            const remotes = await git.getRemotes(true).catch(() => []);
            const hasRemote = remotes.length > 0;
            const log = await git.log(['--oneline', '-3']).catch(() => ({ all: [] }));
            const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.mindcanvas.json')).length;
            res.end(JSON.stringify({ ok: true, hasRemote, files, lastCommits: log.all.map(l => l.message).join('\n') }));
            break;
          }
          default:
            res.end(JSON.stringify({ ok: false, error: 'unknown action' }));
        }
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ─── 靜態檔案 ───
  let url = req.url === '/' ? '/index.html' : req.url;
  const ext = url.match(/\.\w+$/)?.[0] || '.html';
  const filePath = join(STATIC_DIR, url);

  if (!existsSync(filePath)) {
    // SPA fallback：沒找到檔案就 index.html
    const fallback = join(STATIC_DIR, 'index.html');
    if (existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(readFileSync(fallback, 'utf-8'));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MindCanvas 已啟動: http://0.0.0.0:${PORT}`);
  console.log(`📂 資料目錄: ${DATA_DIR}`);
  console.log(`📦 靜態檔案: ${STATIC_DIR}`);
});
