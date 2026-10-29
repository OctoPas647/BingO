/**
 * BingO → Google Sheets (→ Looker Studio)
 *
 * Every answer in BingO becomes one row in this Sheet. Looker Studio reads the Sheet and shows
 * the teacher the whole class: which skills cost the most points and which mistakes repeat.
 *
 * Set up (5 minutes):
 *  1. Create a Google Sheet, e.g. "BingO 12а". Extensions → Apps Script. Paste this file. Save.
 *  2. Deploy → New deployment → type "Web app".
 *       Execute as: Me    ·    Who has access: Anyone
 *     Copy the Web app URL (https://script.google.com/macros/s/…/exec).
 *  3. In BingO: Settings → "Google Sheets → Looker Studio" → paste the URL.
 *  4. Looker Studio → Create → Data source → Google Sheets → this Sheet, tab "answers".
 *
 * After changing this file: Deploy → Manage deployments → Edit → New version.
 *
 * The URL only lets someone ADD rows; it cannot read the Sheet. Treat it like a class password anyway.
 * The app resends rows when it did not get a confirmation, so rows already in the last 2000 are skipped (same time, student and task).
 * Feedback submissions are stored in a separate "feedback" tab; the server forwards them as { id, at, data }.
 */
const SHEET_NAME = 'answers';
const FEEDBACK_SHEET_NAME = 'feedback';
const KEY_COLS = ['timestamp', 'student_id', 'task_id'];
const DEDUPE_WINDOW = 2000;

function rowKey(vals) {
  const t = vals[0] instanceof Date ? vals[0].getTime() : Date.parse(vals[0]);
  const ts = isNaN(t) ? String(vals[0]) : String(Math.floor(t / 1000));
  return [ts, String(vals[1]), String(vals[2])].join('|');
}

function loadSeen(sh) {
  const seen = new Set(), last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || !width) return seen;
  const header = sh.getRange(1, 1, 1, width).getValues()[0], idx = KEY_COLS.map(c => header.indexOf(c));
  if (idx.some(i => i < 0)) return seen;
  const n = Math.min(DEDUPE_WINDOW, last - 1);
  sh.getRange(last - n + 1, 1, n, width).getValues().forEach(r => seen.add(rowKey(idx.map(i => r[i]))));
  return seen;
}

function safeCell(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function feedbackRow(payload) {
  const receivedAt = new Date();
  const submittedAt = new Date(Number(payload.at));
  return [
    safeCell(payload.id),
    receivedAt,
    isNaN(submittedAt.getTime()) ? safeCell(payload.at) : submittedAt,
    safeCell(JSON.stringify(payload.data || {}))
  ];
}

function saveFeedback(payload) {
  if (typeof payload.id !== 'string' || !payload.id.trim()) throw new Error('id is missing');
  if (!Number.isFinite(payload.at)) throw new Error('at is missing');
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('data must be an object');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FEEDBACK_SHEET_NAME) || ss.insertSheet(FEEDBACK_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['id', 'received_at', 'submitted_at', 'data']);
    sh.setFrozenRows(1);
  }
  sh.appendRow(feedbackRow(payload));
  return { ok: true, added: 1 };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (data && typeof data === 'object' && data.id != null && data.data != null && !data.columns) return saveFeedback(data);
    const columns = data.columns, rows = data.rows;
    if (!Array.isArray(columns) || !Array.isArray(rows) || rows.length > 500) return out({ ok: false, error: 'bad payload' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(columns); sh.setFrozenRows(1); }
    const keyIdx = KEY_COLS.map(c => columns.indexOf(c)), canDedupe = keyIdx.every(i => i >= 0);
    const seen = canDedupe ? loadSeen(sh) : new Set();
    const clean = []; let skipped = 0;
    rows.forEach(r => {
      if (canDedupe) {
        const k = rowKey(keyIdx.map(i => r[i]));
        if (seen.has(k)) { skipped++; return; }
        seen.add(k);
      }
      clean.push(columns.map((_, i) => safeCell(r[i])));
    });
    if (clean.length) sh.getRange(sh.getLastRow() + 1, 1, clean.length, columns.length).setValues(clean);
    return out({ ok: true, added: clean.length, skipped: skipped });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, service: 'BingO sheet' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
