/**
 * Vercel Serverless Function: Google Sheets 帳號同步
 * POST /api/sheets  { action: "login" | "register", username, password }
 */
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function getSheetClient() {
  const auth = new google.auth.JWT(CLIENT_EMAIL, null, PRIVATE_KEY, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
  return google.sheets({ version: 'v4', auth });
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

    const sheets = await getSheetClient();

    if (action === 'register') {
      // 檢查是否已存在
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A:A',
      });
      const rows = existing.data.values || [];
      for (const [u] of rows) {
        if (u === username) {
          return res.status(409).json({ ok: false, error: '此名稱已被註冊' });
        }
      }
      // 寫入新帳號
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'A:C',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[username, password, new Date().toISOString()]] },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'login') {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A:B',
      });
      const rows = result.data.values || [];
      for (const [u, p] of rows) {
        if (u === username && p === password) {
          return res.status(200).json({ ok: true, username });
        }
      }
      return res.status(401).json({ ok: false, error: '帳號或密碼錯誤' });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
