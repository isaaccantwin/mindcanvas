import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import simpleGit from 'simple-git';

const DATA_DIR = join(homedir(), 'mindcanvas-data');

// 確保資料目錄存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const git = simpleGit(DATA_DIR);

export default defineConfig({
  root: 'src',
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [mindcanvasSyncPlugin()]
});

function mindcanvasSyncPlugin() {
  return {
    name: 'mindcanvas-sync',
    configureServer(server) {
      // 初始化 git repo
      git.init().catch(() => {});

      // 設定 user config（如果沒有）
      git.addConfig('user.email', 'mindcanvas@local', false, 'local').catch(() => {});
      git.addConfig('user.name', 'MindCanvas', false, 'local').catch(() => {});

      server.middlewares.use('/api/sync', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { action, id, name, data } = JSON.parse(body || '{}');

            switch (action) {
              case 'save': {
                const filename = `${id || name}.mindcanvas.json`;
                const filepath = join(DATA_DIR, filename);
                writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
                await git.add(filename);
                const commit = await git.commit(`sync: ${name || id}`).catch(() => null);
                const push = await git.push().catch(() => null);
                res.end(JSON.stringify({
                  ok: true,
                  pushed: push !== null,
                  committed: commit !== null && commit.commit !== null,
                }));
                break;
              }
              case 'list': {
                const files = readdirSync(DATA_DIR)
                  .filter(f => f.endsWith('.mindcanvas.json'))
                  .map(f => {
                    try {
                      const content = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8'));
                      return {
                        id: f.replace('.mindcanvas.json', ''),
                        name: content.name || f.replace('.mindcanvas.json', ''),
                        updatedAt: content.updatedAt || '未知',
                        nodeCount: content.nodeCount || 0,
                      };
                    } catch { return null; }
                  })
                  .filter(Boolean)
                  .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                res.end(JSON.stringify({ ok: true, files }));
                break;
              }
              case 'load': {
                const filepath = join(DATA_DIR, `${id}.mindcanvas.json`);
                if (!existsSync(filepath)) {
                  res.end(JSON.stringify({ ok: false, error: 'not found' }));
                  return;
                }
                const content = JSON.parse(readFileSync(filepath, 'utf-8'));
                res.end(JSON.stringify({ ok: true, data: content }));
                break;
              }
              case 'pull': {
                await git.pull().catch(() => null);
                res.end(JSON.stringify({ ok: true }));
                break;
              }
              case 'status': {
                const remotes = await git.getRemotes(true).catch(() => []);
                const hasRemote = remotes.length > 0;
                const log = await git.log(['--oneline', '-3']).catch(() => ({ all: [] }));
                const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.mindcanvas.json')).length;
                res.end(JSON.stringify({
                  ok: true,
                  hasRemote,
                  files,
                  lastCommits: log.all.map(l => l.message).join('\n'),
                }));
                break;
              }
              case 'delete': {
                const filename = `${id}.mindcanvas.json`;
                const filepath = join(DATA_DIR, filename);
                if (existsSync(filepath)) rmSync(filepath);
                await git.add(filename);
                await git.commit(`delete: ${id}`).catch(() => {});
                await git.push().catch(() => {});
                res.end(JSON.stringify({ ok: true }));
                break;
              }
              default:
                res.end(JSON.stringify({ ok: false, error: 'unknown action' }));
            }
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });

      // Health check
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, ready: true }));
      });
    }
  };
}
