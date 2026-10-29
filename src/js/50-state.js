/* ================= BingO: state that lives in this browser =================
   Shelly's engine (rich text, task views, scoring) is reused as is; this file replaces
   Shelly's IndexedDB store with one small localStorage record. */
const STORE_KEY = 'bingo.v1';
const APP_NAME_UI = 'BingO';

/* Shelly's 20-ui.js reads APP.settings (theme, sound, motion, lang) */
let APP = { settings: { lang: 'bg', theme: 'auto', sound: true, motion: true, shuffle: false }, xp: 0, days: {} };

const DEFAULT_STATE = () => ({
  v: 1,
  profile: { name: '', cls: '', age: '', exam: '', track: '', extra: '', id: uid() },
  settings: { aiMode: 'off', apiKey: '', model: 'gemini-3.8-flash', proxyUrl: '', sheetUrl: '', theme: 'auto', glass: false, sound: true, lang: 'bg' },
  subject: 'math',
  demo: false,           /* true while the simulated demo learner is loaded (56-demo.js) */
  skills: {},            /* "math.quad@dzi12" -> { p, n, ok, last, misc: { code: count }, hist: [[time, p]] }: one map per exam */
  log: [],               /* every answer, the rows that go to Google Sheets / Looker Studio */
  queue: [],             /* rows not yet sent to the Sheet */
  sessions: 0,
  sessionDays: [],       /* local YYYY-MM-DD days on which the learner finished a session: the streak */
  review: {},            /* "math.quad" -> { box, due }: when a strong skill is checked again (57-review.js) */
  onboarding: null,      /* first-run setup progress (58-onboarding.js) */
  aiFlags: [],           /* AI-made tasks a learner reported as wrong */
  pastResults: {}        /* past exam id -> { pts, max, at }: the last result (66-past.js) */
});

let S = DEFAULT_STATE();
/* What went wrong while loading, shown once after start (99-boot.js): null | { backup: key } */
let STATE_NOTICE = null;

/* Saved data can be broken (a half-written save) or from an older version with other shapes.
   Every field is checked and anything that does not fit falls back to its default, so one bad
   value never stops the app from opening. */
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const isStr = x => typeof x === 'string';
const SETTING_OK = {
  aiMode: v => ['off', 'key', 'proxy'].includes(v),
  apiKey: v => isStr(v) && !/\s/.test(v) && v.length < 200,
  model: v => isStr(v) && /^[\w.\-]{1,80}$/.test(v),
  proxyUrl: v => v === '' || (isStr(v) && /^https:\/\/[^\s]+$/.test(v)),
  sheetUrl: v => v === '' || (isStr(v) && /^https:\/\/script\.google\.com\/[^\s]+$/.test(v)),
  theme: v => ['auto', 'light', 'dark', 'amoled'].includes(v),
  glass: v => typeof v === 'boolean',
  sound: v => typeof v === 'boolean',
  lang: v => ['bg', 'en'].includes(v)
};
function cleanSkill(st) {
  if (!isObj(st)) return null;
  const n = isNum(st.n) && st.n >= 0 ? Math.floor(st.n) : 0;
  return {
    p: isNum(st.p) ? clamp(st.p, 0.01, 0.995) : BKT_PRIOR, n, ok: isNum(st.ok) ? clamp(Math.floor(st.ok), 0, n) : 0, last: isNum(st.last) ? st.last : 0,
    misc: isObj(st.misc) ? Object.fromEntries(Object.entries(st.misc).filter(([, c]) => isNum(c) && c > 0)) : {},
    hist: Array.isArray(st.hist) ? st.hist.filter(h => Array.isArray(h) && isNum(h[0]) && isNum(h[1])).slice(-60) : []
  };
}
/* The whole profile must survive a restart: age, exam, track and extra drive the exam plan, the
   planned maturas on Stats and which skill map is used. The exam/track ids live in 58-onboarding.js,
   which loads later, so only their shape is checked here; every use looks them up anyway. */
const EXAM_IDS = ['nvo4', 'nvo7', 'nvo10', 'dzi12'];
const MAX_NAME_LEN = 40, MAX_CLS_LEN = 10;
function cleanProfile(p, d) {
  const text = (x, max) => (isStr(x) ? x.slice(0, max) : '');
  const id = x => (isStr(x) && /^\w{1,20}$/.test(x) ? x : '');
  const age = isNum(p.age) ? String(Math.floor(p.age)) : p.age;
  return {
    name: text(p.name, MAX_NAME_LEN), cls: text(p.cls, MAX_CLS_LEN),
    age: isStr(age) && /^\d{1,2}$/.test(age) ? age : '',
    exam: EXAM_IDS.includes(p.exam) ? p.exam : '',
    track: id(p.track), extra: id(p.extra),
    id: isStr(p.id) && p.id ? p.id : d.profile.id
  };
}
function cleanPastResult(r) {
  if (!isObj(r) || !isNum(r.pts) || !isNum(r.max) || r.max <= 0 || r.pts < 0 || r.pts > r.max) return null;
  return { pts: r.pts, max: r.max, at: isNum(r.at) ? r.at : 0 };
}
function sanitizeState(v) {
  const d = DEFAULT_STATE();
  if (!isObj(v)) return d;
  const prof = isObj(v.profile) ? v.profile : {}, set = isObj(v.settings) ? v.settings : {};
  const out = { ...d };
  out.profile = cleanProfile(prof, d);
  out.settings = { ...d.settings };
  for (const [k, ok] of Object.entries(SETTING_OK)) if (k in set && ok(set[k])) out.settings[k] = set[k];
  out.subject = ['math', 'bel'].includes(v.subject) ? v.subject : d.subject;
  out.demo = v.demo === true;
  out.skills = {};
  if (isObj(v.skills)) for (const [k, st] of Object.entries(v.skills)) { const c = cleanSkill(st); if (c && /^\w+\.\w+(@\w+)?$/.test(k)) out.skills[k] = c; }
  out.log = Array.isArray(v.log) ? v.log.filter(r => isObj(r) && isStr(r.task_id || '') && isStr(r.subject || '')).slice(-3000) : [];
  out.queue = Array.isArray(v.queue) ? v.queue.filter(isObj).slice(-3000) : [];
  out.sessions = isNum(v.sessions) && v.sessions >= 0 ? Math.floor(v.sessions) : 0;
  /* saves from before 0.5.0 have no sessionDays: start the streak from the days with answers */
  const days = Array.isArray(v.sessionDays) ? v.sessionDays : out.log.filter(r => r.student_id !== 'demo').map(r => localDay(r.t || Date.parse(r.timestamp) || 0));
  out.sessionDays = [...new Set(days.filter(x => isStr(x) && /^\d{4}-\d\d-\d\d$/.test(x)))].sort().slice(-400);
  out.review = {};
  if (isObj(v.review)) for (const [k, r] of Object.entries(v.review)) if (isObj(r) && isNum(r.box) && isNum(r.due)) out.review[k] = { box: clamp(Math.floor(r.box), 0, 5), due: r.due };
  out.onboarding = isObj(v.onboarding) ? { ...v.onboarding, done: !!v.onboarding.done, step: isNum(v.onboarding.step) ? v.onboarding.step : 0 } : null;
  out.aiFlags = Array.isArray(v.aiFlags) ? v.aiFlags.filter(isObj).slice(-200) : [];
  out.pastResults = {};
  if (isObj(v.pastResults)) for (const [k, r] of Object.entries(v.pastResults)) { const c = cleanPastResult(r); if (c && k) out.pastResults[k] = c; }
  /* the Sheet's retry state (55-sync.js): without it a restart forgets failed sends */
  if (isObj(v.sync)) out.sync = { fails: isNum(v.sync.fails) ? Math.max(0, Math.floor(v.sync.fails)) : 0, lastError: isStr(v.sync.lastError) ? v.sync.lastError.slice(0, 200) : '', lastOk: isNum(v.sync.lastOk) ? v.sync.lastOk : 0, unverified: !!v.sync.unverified };
  return out;
}
const BKT_PRIOR = 0.3; /* the same as BKT.prior in 51-skills.js, which loads after this file */

/* Local calendar day (the phone's time zone), used for the streak */
function localDay(t = Date.now()) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* This learner's own answers: the activity, counts and CSV export never mix in another learner's
   rows (for example rows left from the demo). While the demo is loaded, its rows are the learner's. */
const myLog = () => S.log.filter(r => r.student_id === S.profile.id || (S.demo && r.student_id === 'demo'));

/* Skill progress belongs to one exam (НВО 4, НВО 7, НВО 10 or ДЗИ 12): switching exams starts
   that exam with a fresh skill map, and the old one stays saved for when the learner switches back.
   Keys are "math.quad@dzi12"; keys without an exam come from older saves and the demo learner and
   are moved to the current exam the first time they are read (51-skills.js). */
const currentExamKey = () => (S.profile && EXAM_IDS.includes(S.profile.exam) ? S.profile.exam : 'dzi12');

/* A save that cannot be read is copied to its own key before anything can overwrite it */
function backupRaw(raw) {
  const key = STORE_KEY + '.broken-' + new Date().toISOString().replace(/[:.]/g, '-');
  try { localStorage.setItem(key, raw); return key; } catch (e) { return null; }
}
function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { console.warn('storage not readable', e); }
  if (raw) {
    try { S = sanitizeState(JSON.parse(raw)); }
    catch (e) { console.warn('state not loaded', e); S = DEFAULT_STATE(); STATE_NOTICE = { backup: backupRaw(raw) }; }
  }
  APP.settings.theme = S.settings.theme; APP.settings.glass = S.settings.glass; APP.settings.sound = S.settings.sound !== false; APP.settings.lang = S.settings.lang;
}
let saveTimer = 0;
function saveState(now) {
  clearTimeout(saveTimer);
  const put = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { console.warn('state not saved', e); } };
  if (now) put(); else saveTimer = setTimeout(put, 120);
}
function resetState(keepSettings) {
  const keep = keepSettings ? { settings: S.settings, profile: S.profile } : {};
  S = { ...DEFAULT_STATE(), ...keep }; saveState(true);
}

/* AMOLED theme: the dark theme with true-black surfaces (OLED pixels switch off).
   Shelly's applySettings() only knows auto/light/dark, so BingO wraps it. */
const _applyBase = applySettings;
/* "Системна": the phone's own setting. In the Android app the WebView reports the app theme, not the
   phone's, so the app asks Android directly (AndroidUI.night); in a browser prefers-color-scheme works. */
function systemDark() {
  try { if (window.AndroidUI && typeof window.AndroidUI.night === 'function') return !!window.AndroidUI.night(); } catch (e) { }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
window.__systemTheme = () => { if (S.settings.theme === 'auto') applySettings(); };
document.addEventListener && document.addEventListener('visibilitychange', () => { if (!document.hidden) window.__systemTheme(); });
applySettings = function () {
  _applyBase();
  const am = S.settings.theme === 'amoled', rootEl = document.documentElement;
  if (S.settings.theme === 'auto') rootEl.dataset.theme = systemDark() ? 'dark' : 'light';
  if (am) { rootEl.dataset.theme = 'dark'; rootEl.dataset.amoled = '1'; } else delete rootEl.dataset.amoled;
  if (S.settings.glass) rootEl.dataset.glass = '1'; else delete rootEl.dataset.glass;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = am ? '#000000' : rootEl.dataset.theme === 'dark' ? '#121117' : '#F6F3EC';
};

/* Shelly's media loader, reading the few pictures that the build embeds (window.SHELLY_MEDIA: "module id\npath" -> data URL) */
function hydrateMedia(root, id) {
  root.querySelectorAll('[data-media]').forEach(el => {
    const url = (window.SHELLY_MEDIA || {})[id + '\n' + el.dataset.media]; el.removeAttribute('data-media');
    if (url) el.src = url; else el.classList.add('missing');
    if (el.dataset.poster) { const poster = (window.SHELLY_MEDIA || {})[id + '\n' + el.dataset.media]; if (poster) el.src = poster; el.removeAttribute('data-poster'); }
  });
}
