/**
 * MindCanvas 帳號同步 — Google Apps Script Web App
 *
 * 部署方式：
 * 1. 打開你的 Google Sheet
 * 2. 選單 → 擴充功能 → Apps Script
 * 3. 貼上這整段程式碼 → 按儲存
 * 4. 點「部署」→「新增部署」→ 選「網頁應用程式」
 * 5. 執行身分：選「我」(你的 Google 帳號)
 * 6. 誰可以存取：選「任何人」
 * 7. 點「部署」→ 複製產生的網址
 *
 * Sheet 格式：
 *   A 欄: 使用者名稱
 *   B 欄: 密碼
 *   C 欄: 註冊時間
 */

function doGet(e) {
  const action = e.parameter.action;
  const username = e.parameter.username;
  const password = e.parameter.password;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (action === 'login') {
    const data = sheet.getDataRange().getValues();
    for (const row of data) {
      if (row[0] === username && row[1] === password) {
        return ok({ ok: true, username });
      }
    }
    return ok({ ok: false, error: '帳號或密碼錯誤' });
  }
  
  if (action === 'register') {
    const data = sheet.getDataRange().getValues();
    for (const row of data) {
      if (row[0] === username) {
        return ok({ ok: false, error: '此名稱已被註冊' });
      }
    }
    sheet.appendRow([username, password, new Date().toISOString()]);
    return ok({ ok: true });
  }
  
  return ok({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  // 支援 POST（與 GET 行為相同，但 body 可以是 JSON）
  const params = JSON.parse(e.postData.contents);
  return doGet({ parameter: params });
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
