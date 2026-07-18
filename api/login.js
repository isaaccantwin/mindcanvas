/**
 * Vercel Serverless Function: 登入驗證
 * POST /api/login  { password: "..." }  →  { ok, token? }
 * GET  /api/check  { token: "..." }     →  { ok, valid }
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correctPassword = process.env.MIND_PASSWORD;
  if (!correctPassword) {
    // 如果沒設密碼，開放存取（開發模式）
    res.status(200).json({ ok: true, open: true });
    return;
  }

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (password === correctPassword) {
      // 簡單 token：時間戳 + 密碼 hash
      const token = Buffer.from(`${Date.now()}:${correctPassword}`).toString('base64');
      res.status(200).json({ ok: true, token });
    } else {
      res.status(401).json({ ok: false, error: '密碼錯誤' });
    }
    return;
  }

  if (req.method === 'GET') {
    const { token } = req.query || {};
    if (!token) { res.status(401).json({ ok: false, valid: false }); return; }
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [, pwd] = decoded.split(':');
      if (pwd === correctPassword) {
        res.status(200).json({ ok: true, valid: true });
      } else {
        res.status(401).json({ ok: false, valid: false });
      }
    } catch {
      res.status(401).json({ ok: false, valid: false });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
