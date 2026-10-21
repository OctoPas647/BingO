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
  if (S.settings.sheetUrl) S.queue.push(row);
  saveState();
  scheduleFlush();
}

let flushTimer = 0;
function scheduleFlush() { clearTimeout(flushTimer); flushTimer = setTimeout(flushToSheet, 4000); }
async function flushToSheet() {
  const url = S.settings.sheetUrl; if (!url || !S.queue.length || !navigator.onLine) return false;
  const rows = S.queue.slice(0, 200).map(r => LOG_COLUMNS.map(c => r[c]));
  try {
    /* Apps Script web apps do not send CORS headers; a plain-text POST still arrives */
    await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ columns: LOG_COLUMNS, rows }) });
    S.queue.splice(0, rows.length); saveState(); if (S.queue.length) scheduleFlush();
    return true;
  } catch (e) { console.warn('sheet sync failed', e); return false; }
}
window.addEventListener('online', scheduleFlush);

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function logCSV(rows = S.log) { return '﻿' + [LOG_COLUMNS.join(','), ...rows.map(r => LOG_COLUMNS.map(c => csvCell(r[c])).join(','))].join('\n'); }
/* Shelly's Native.saveFile: a save dialog on Android, a download in the browser */
function downloadText(name, text, type = 'text/csv') { return Native.saveFile(new Blob([text], { type: type + ';charset=utf-8' }), name, 'save'); }
