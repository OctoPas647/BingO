/* ================= Answer log -> Google Sheets -> Looker Studio =================
   Every answer becomes one row. Rows can go live to a Google Sheet (a tiny Apps Script web app,
   see apps-script/Code.gs), and Looker Studio reads that Sheet for the teacher's dashboard.
   Without a Sheet, the same rows download as a CSV that Looker Studio can also read.
   Unsent rows wait in S.queue (saved on the device) until the server confirms them. */

const LOG_COLUMNS = ['timestamp', 'student_id', 'student', 'class', 'subject', 'skill_id', 'skill', 'level', 'correct', 'misconception_code', 'misconception', 'source', 'seconds', 'hints', 'mastery_before', 'mastery_after', 'mode', 'session_id', 'task_id'];
const QUEUE_MAX = 5000;
const RETRY_MS = [4000, 15000, 60000, 300000, 600000];

function logAnswer({ subj, task, correct, misc, secs, hints, before, after, mode, session }) {
  const sk = skillDef(subj, task.skill);
  const row = {
    t: Date.now(), timestamp: new Date().toISOString(), student_id: S.profile.id, student: S.profile.name || 'Ученик', class: S.profile.cls || '',
    subject: SUBJECTS[subj].title, skill_id: subj + '.' + task.skill, skill: sk ? sk.name : task.skill, level: task.level || 2,
    correct: correct ? 1 : 0, misconception_code: correct ? '' : (misc || ''), misconception: correct ? '' : (misc ? miscLabel(misc).replace(/\$/g, '') : ''),
    source: task.src || 'bank', seconds: Math.round(secs), hints: hints || 0,
    mastery_before: roundTo(before, 3), mastery_after: roundTo(after, 3), mode, session_id: session, task_id: task.id
  };
  S.log.push(row); if (S.log.length > 3000) S.log.splice(0, S.log.length - 3000);
  if (S.settings.sheetUrl) { S.queue.push(row); if (S.queue.length > QUEUE_MAX) S.queue.splice(0, S.queue.length - QUEUE_MAX); }
  saveState();
  scheduleFlush();
}

let flushTimer = 0, flushing = false;
function scheduleFlush(delay) { clearTimeout(flushTimer); flushTimer = setTimeout(flushToSheet, delay == null ? 4000 : delay); }

/* 'confirmed' = the server answered {ok:true}. 'unverified' = the browser hid the answer (CORS), so we can only tell it was sent. Anything else throws and the rows stay queued. */
async function postRows(url, rows) {
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' }, body = JSON.stringify({ columns: LOG_COLUMNS, rows });
  try {
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json().catch(() => null);
    if (!j || j.ok !== true) throw new Error(j && j.error ? j.error : 'Неочакван отговор от сървъра');
    return 'confirmed';
  } catch (e) {
    if (!(e instanceof TypeError) || !navigator.onLine) throw e;
    /* the request may have arrived but the answer cannot be read: send in no-cors mode (the server skips duplicates) */
    await fetch(url, { method: 'POST', mode: 'no-cors', headers, body });
    return 'unverified';
  }
}

async function flushToSheet() {
  const url = S.settings.sheetUrl; if (!url || !S.queue.length || !navigator.onLine || flushing) return false;
  flushing = true;
  const batch = S.queue.slice(0, 200), rows = batch.map(r => LOG_COLUMNS.map(c => r[c]));
  S.sync = S.sync || { fails: 0, lastError: '', lastOk: 0, unverified: false };
  try {
    const mode = await postRows(url, rows);
    const sent = new Set(batch); S.queue = S.queue.filter(r => !sent.has(r));
    S.sync.fails = 0; S.sync.lastError = ''; S.sync.lastOk = Date.now(); S.sync.unverified = mode === 'unverified';
    saveState(true); flushing = false;
    if (S.queue.length) scheduleFlush();
    return true;
  } catch (e) {
    console.warn('sheet sync failed', e);
    S.sync.fails++; S.sync.lastError = String((e && e.message) || e);
    saveState(true); flushing = false;
    scheduleFlush(RETRY_MS[Math.min(S.sync.fails, RETRY_MS.length) - 1]);
    return false;
  }
}
window.addEventListener('online', () => scheduleFlush());

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function logCSV(rows = S.log) { return '\uFEFF' + [LOG_COLUMNS.join(','), ...rows.map(r => LOG_COLUMNS.map(c => csvCell(r[c])).join(','))].join('\n'); }
/* Shelly's Native.saveFile: a save dialog on Android, a download in the browser */
function downloadText(name, text, type = 'text/csv') { return Native.saveFile(new Blob([text], { type: type + ';charset=utf-8' }), name, 'save'); }
