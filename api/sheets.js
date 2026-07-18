/**
 * Vercel Serverless Function: Google Sheets 帳號同步
 * POST /api/sheets  { action: "login" | "register", username, password }
 *
 * 使用 google-auth-library + direct REST calls
 * 避免 googleapis 套件過大
 */
import { GoogleAuth } from 'google-auth-library';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/"([^"]*)"/g, '$1');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function sheetsFetch(method, range, body) {
  const token = await getAccessToken();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const url = method === 'GET' ? base : `${base}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const { action, username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: '缺少欄位' });
    }

    if (action === 'register') {
      // 檢查是否已存在
      const existing = await sheetsFetch('GET', 'A:A');
      const rows = existing.values || [];
      for (const [u] of rows) {
        if (u === username) {
          return res.status(200).json({ ok: false, error: '此名稱已被註冊' });
        }
      }
      // 寫入新帳號
      await sheetsFetch('POST', 'A:C', {
        values: [[username, password, new Date().toISOString()]],
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'login') {
      const result = await sheetsFetch('GET', 'A:B');
      const rows = result.values || [];
      for (const [u, p] of rows) {
        if (u === username && p === password) {
          return res.status(200).json({ ok: true, username });
        }
      }
      return res.status(200).json({ ok: false, error: '帳號或密碼錯誤' });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
