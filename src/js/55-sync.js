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

/* ================= User feedback -> queued JSON POST =================
   Feedback can be submitted while offline. It is stored in its own localStorage queue,
   then sent as JSON when the app is online. A payload must provide `endpoint`; other
   fields are free-form so later feedback screens can add type, text, diagnostics, etc. */

/**
 * A pending user-feedback submission.
 * @typedef {Object} FeedbackPayload
 * @property {string} endpoint Absolute URL that accepts a JSON POST.
 * @property {*} [data] Arbitrary JSON-safe feedback data.
 * @property {number} [at] Creation time in milliseconds.
 * @property {number} [attempts] Number of failed delivery attempts.
 * @property {string} [id] Stable local id, used to avoid duplicate processing.
 */

const FEEDBACK_QUEUE_KEY = 'bingo.feedback.v1';
const FEEDBACK_QUEUE_MAX = 200;
const FEEDBACK_RETRY_MS = [4000, 15000, 60000, 300000, 600000];
let feedbackQueue = null;
let feedbackFlushTimer = 0;
let feedbackFlushing = false;

function loadFeedbackQueue() {
  if (Array.isArray(feedbackQueue)) return feedbackQueue;
  try {
    const raw = localStorage.getItem(FEEDBACK_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    feedbackQueue = Array.isArray(parsed) ? parsed.filter(isFeedbackPayload) : [];
  } catch (e) {
    console.warn('feedback queue not loaded', e);
    feedbackQueue = [];
  }
  return feedbackQueue;
}

function saveFeedbackQueue() {
  try { localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(loadFeedbackQueue())); }
  catch (e) { console.warn('feedback queue not saved', e); }
}

function isFeedbackPayload(v) {
  return !!v && typeof v === 'object' && typeof v.endpoint === 'string' && /^https?:\/\/[^\s]+$/.test(v.endpoint);
}

function newFeedbackId() {
  return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Store feedback locally and ask for delivery. Safe to call offline.
 * @param {FeedbackPayload} payload
 * @returns {boolean} true when the payload was accepted into the queue
 */
function enqueueFeedback(payload) {
  if (!isFeedbackPayload(payload)) return false;
  const queue = loadFeedbackQueue();
  const item = {
    ...payload,
    id: typeof payload.id === 'string' && payload.id ? payload.id : newFeedbackId(),
    at: typeof payload.at === 'number' ? payload.at : Date.now(),
    attempts: typeof payload.attempts === 'number' && payload.attempts >= 0 ? Math.floor(payload.attempts) : 0
  };
  queue.push(item);
  if (queue.length > FEEDBACK_QUEUE_MAX) queue.splice(0, queue.length - FEEDBACK_QUEUE_MAX);
  saveFeedbackQueue();
  scheduleFeedbackFlush();
  return true;
}

function scheduleFeedbackFlush(delay) {
  clearTimeout(feedbackFlushTimer);
  feedbackFlushTimer = setTimeout(() => { flushFeedback(); }, delay == null ? 4000 : delay);
}

async function postFeedback(payload) {
  const res = await fetch(payload.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({ id: payload.id, at: payload.at, data: payload.data })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const result = await res.json().catch(() => null);
  if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'Неочакван отговор от сървъра');
  return true;
}

/**
 * Send every queued feedback item. Successfully delivered items are removed;
 * failed items stay in localStorage and are retried later.
 * @returns {Promise<boolean>} true when at least one item was delivered
 */
async function flushFeedback() {
  const queue = loadFeedbackQueue();
  if (!queue.length || !navigator.onLine || feedbackFlushing) return false;
  feedbackFlushing = true;
  let delivered = false;
  try {
    for (const item of [...queue]) {
      try {
        await postFeedback(item);
        const index = queue.findIndex(x => x.id === item.id);
        if (index >= 0) queue.splice(index, 1);
        delivered = true;
      } catch (e) {
        console.warn('feedback delivery failed', e);
        item.attempts = (item.attempts || 0) + 1;
      }
    }
    saveFeedbackQueue();
    const next = queue.reduce((min, item) => Math.min(min, item.attempts || 0), Number.MAX_SAFE_INTEGER);
    if (queue.length && next < FEEDBACK_RETRY_MS.length) scheduleFeedbackFlush(FEEDBACK_RETRY_MS[next]);
    return delivered;
  } finally {
    feedbackFlushing = false;
  }
}

window.addEventListener('online', () => scheduleFeedbackFlush());

/* Public API for other BingO modules. */
window.BingOFeedback = { enqueueFeedback, flushFeedback };

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function logCSV(rows = S.log) { return '\uFEFF' + [LOG_COLUMNS.join(','), ...rows.map(r => LOG_COLUMNS.map(c => csvCell(r[c])).join(','))].join('\n'); }
/* Shelly's Native.saveFile: a save dialog on Android, a download in the browser */
function downloadText(name, text, type = 'text/csv') { return Native.saveFile(new Blob([text], { type: type + ';charset=utf-8' }), name, 'save'); }
