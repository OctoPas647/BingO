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
 * The URL only lets someone ADD rows; it cannot read the Sheet. Treat it like a class password anyway.
 */
const SHEET_NAME = 'answers';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    const columns = data.columns, rows = data.rows;
    if (!Array.isArray(columns) || !Array.isArray(rows) || rows.length > 500) return out({ ok: false, error: 'bad payload' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(columns); sh.setFrozenRows(1); }
    // The app sends a row again when it did not get our answer (a timeout, a lost connection).
    // A row that is already in the Sheet (same student, session and task) is skipped.
    const seen = existingKeys(sh), ki = KEY_COLUMNS.map(c => columns.indexOf(c));
    const fresh = ki.every(i => i >= 0) ? rows.filter(r => { const k = ki.map(i => String(r[i])).join('|'); if (seen.has(k)) return false; seen.add(k); return true; }) : rows;
    const clean = fresh.map(r => columns.map((_, i) => {
      const v = r[i];
      if (typeof v === 'number') return v;
      const s = String(v == null ? '' : v).slice(0, 300);
      return /^[=+\-@]/.test(s) ? "'" + s : s; // never let a cell become a formula
    }));
    if (clean.length) sh.getRange(sh.getLastRow() + 1, 1, clean.length, columns.length).setValues(clean);
    return out({ ok: true, added: clean.length, skipped: rows.length - clean.length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// text columns only: Sheets may turn a timestamp into a date, which would no longer match
const KEY_COLUMNS = ['student_id', 'session_id', 'task_id'];
function existingKeys(sh) {
  const last = sh.getLastRow(), keys = new Set();
  if (last < 2) return keys;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), idx = KEY_COLUMNS.map(c => head.indexOf(c));
  if (idx.some(i => i < 0)) return keys;
  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (const r of data) keys.add(idx.map(i => String(r[i]).replace(/^'/, '')).join('|'));
  return keys;
}

function doGet() { return out({ ok: true, service: 'BingO sheet' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
