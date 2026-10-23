/* ================= Answer log -> Google Sheets -> Looker Studio =================
   Every answer becomes one row. Rows can go live to a Google Sheet (a tiny Apps Script web app,
   see apps-script/Code.gs), and Looker Studio reads that Sheet for the teacher's dashboard.
   Without a Sheet, the same rows download as a CSV that Looker Studio can also read. */

const LOG_COLUMNS = ['timestamp', 'student_id', 'student', 'class', 'subject', 'skill_id', 'skill', 'level', 'correct', 'misconception_code', 'misconception', 'source', 'seconds', 'hints', 'mastery_before', 'mastery_after', 'mode', 'session_id', 'task_id'];

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
  if (S.settings.sheetUrl) { S.queue.push(row); if (S.queue.length > 3000) S.queue.splice(0, S.queue.length - 3000); }
  saveState();
  scheduleFlush();
}

/* Rows leave the queue only after the Sheet answers {ok: true}. A server error, a bad answer or no
   network keeps them for the next try (with a growing pause). Apps Script skips rows it already has
   (same student, session and task), so sending a row twice never makes a duplicate. */
let flushTimer = 0, flushFails = 0, flushing = false;
function scheduleFlush(ms = 4000) { clearTimeout(flushTimer); flushTimer = setTimeout(flushToSheet, ms); }
async function flushToSheet() {
  const url = S.settings.sheetUrl; if (!url || !S.queue.length || !navigator.onLine || flushing) return false;
  flushing = true;
  const batch = S.queue.slice(0, 200), rows = batch.map(r => LOG_COLUMNS.map(c => r[c]));
  try {
    /* text/plain keeps this a "simple" request (no CORS preflight, which Apps Script cannot answer);
       Apps Script replies through a redirect that does allow reading the answer */
    const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ columns: LOG_COLUMNS, rows }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json().catch(() => null);
    if (!j || j.ok !== true) throw new Error((j && j.error) || 'the Sheet did not confirm');
    /* remove exactly the rows that were sent (new answers may have been queued meanwhile) */
    S.queue = S.queue.filter(r => !batch.includes(r)); flushFails = 0; saveState();
    if (S.queue.length) scheduleFlush(500);
    return true;
  } catch (e) {
    console.warn('sheet sync failed, rows kept for later', e);
    flushFails++; scheduleFlush(Math.min(10 * 60e3, 15e3 * 2 ** Math.min(flushFails, 6)));
    return false;
  } finally { flushing = false; }
}
window.addEventListener('online', scheduleFlush);

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function logCSV(rows = S.log) { return '﻿' + [LOG_COLUMNS.join(','), ...rows.map(r => LOG_COLUMNS.map(c => csvCell(r[c])).join(','))].join('\n'); }
/* Shelly's Native.saveFile: a save dialog on Android, a download in the browser */
function downloadText(name, text, type = 'text/csv') { return Native.saveFile(new Blob([text], { type: type + ';charset=utf-8' }), name, 'save'); }
