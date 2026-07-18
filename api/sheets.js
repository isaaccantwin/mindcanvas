/**
 * Vercel Serverless Function: 轉發到 Google Apps Script Web App
 * POST /api/sheets  { action, username, password }
 */
const AS_URL = process.env.GOOGLE_AS_URL;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!AS_URL) {
    return res.status(500).json({ ok: false, error: 'GOOGLE_AS_URL 未設定' });
  }

  try {
    const { action, username, password } = req.body || {};
    const params = new URLSearchParams({ action, username, password });

    const result = await fetch(`${AS_URL}?${params}`);
    const data = await result.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
