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
  settings: { aiMode: 'off', apiKey: '', model: 'gemini-3.8-flash', proxyUrl: '', sheetUrl: '', theme: 'auto', sound: true, lang: 'bg' },
  subject: 'math',
  skills: {},
  log: [],
  queue: [],
  sessions: 0,
  review: {},
  onboarding: null,
  aiFlags: [],
  pastResults: {},
  progress: {}
});

let S = DEFAULT_STATE();
let STATE_NOTICE = null;

const isNum = x => typeof x === 'number' && Number.isFinite(x);
const isStr = x => typeof x === 'string';
const SETTING_OK = {
  aiMode: v => ['off', 'key', 'proxy'].includes(v),
  apiKey: v => isStr(v) && !/\s/.test(v) && v.length < 200,
  model: v => isStr(v) && /^[\w.\-]{1,80}$/.test(v),
  proxyUrl: v => v === '' || (isStr(v) && /^https:\/\/[^\s]+$/.test(v)),
  sheetUrl: v => v === '' || (isStr(v) && /^https:\/\/script\.google\.com\/[^\s]+$/.test(v)),
  theme: v => ['auto', 'light', 'dark', 'amoled'].includes(v),
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
function cleanClassProgress(p) {
  const out = { skills: {}, review: {}, pastResults: {} };
  if (!isObj(p)) return out;
  if (isObj(p.skills)) for (const [k, st] of Object.entries(p.skills)) { const c = cleanSkill(st); if (c && /^\w+\.\w+$/.test(k)) out.skills[k] = c; }
  if (isObj(p.review)) for (const [k, r] of Object.entries(p.review)) if (isObj(r) && isNum(r.box) && isNum(r.due)) out.review[k] = { box: clamp(Math.floor(r.box), 0, 5), due: r.due };
  if (isObj(p.pastResults)) for (const [k, r] of Object.entries(p.pastResults)) if (isObj(r) && isNum(r.pts) && isNum(r.max)) out.pastResults[k] = { pts: r.pts, max: r.max, at: isNum(r.at) ? r.at : 0 };
  return out;
}
function sanitizeState(v) {
  const d = DEFAULT_STATE();
  if (!isObj(v)) return d;
  const prof = isObj(v.profile) ? v.profile : {}, set = isObj(v.settings) ? v.settings : {};
  const out = { ...d };
  out.profile = { name: isStr(prof.name) ? prof.name.slice(0, 40) : '', cls: isStr(prof.cls) ? prof.cls.slice(0, 10) : '', age: isStr(prof.age) ? prof.age.slice(0, 10) : '', exam: isStr(prof.exam) ? prof.exam.slice(0, 20) : '', track: isStr(prof.track) ? prof.track.slice(0, 30) : '', extra: isStr(prof.extra) ? prof.extra.slice(0, 30) : '', id: isStr(prof.id) && prof.id ? prof.id : d.profile.id };
  out.settings = { ...d.settings };
  for (const [k, ok] of Object.entries(SETTING_OK)) if (k in set && ok(set[k])) out.settings[k] = set[k];
  out.subject = ['math', 'bel'].includes(v.subject) ? v.subject : d.subject;
  out.log = Array.isArray(v.log) ? v.log.filter(r => isObj(r) && isStr(r.task_id || '') && isStr(r.subject || '')).slice(-3000) : [];
  out.queue = Array.isArray(v.queue) ? v.queue.filter(isObj).slice(-3000) : [];
  out.sessions = isNum(v.sessions) && v.sessions >= 0 ? Math.floor(v.sessions) : 0;
  out.onboarding = isObj(v.onboarding) ? { ...v.onboarding, done: !!v.onboarding.done, step: isNum(v.onboarding.step) ? v.onboarding.step : 0 } : null;
  out.aiFlags = Array.isArray(v.aiFlags) ? v.aiFlags.filter(isObj).slice(-200) : [];

  out.progress = {};
  if (isObj(v.progress)) for (const [cls, p] of Object.entries(v.progress)) if (isStr(cls) && cls) out.progress[cls] = cleanClassProgress(p);
  const legacy = cleanClassProgress({ skills: v.skills, review: v.review, pastResults: v.pastResults });
  const legacyId = out.profile.exam || 'default';
  const hasLegacy = Object.keys(legacy.skills).length || Object.keys(legacy.review).length || Object.keys(legacy.pastResults).length;
  if (hasLegacy && !Object.keys(out.progress[legacyId] || {}).length) out.progress[legacyId] = legacy;

  const active = getClassId(out);
  out.progress[active] = out.progress[active] || cleanClassProgress(null);
  Object.assign(out, out.progress[active]);
  return out;
}
const BKT_PRIOR = 0.3;

function backupRaw(raw) {
  const key = STORE_KEY + '.broken-' + new Date().toISOString().replace(/[:.]/g, '-');
  try { localStorage.setItem(key, raw); return key; } catch (e) { return null; }
}
function getClassId(state = S) {
  return (state.profile && isStr(state.profile.exam) && state.profile.exam) || 'default';
}
function ensureClassProgress(classId) {
  const id = isStr(classId) && classId ? classId : 'default';
  if (!isObj(S.progress[id])) S.progress[id] = { skills: {}, review: {}, pastResults: {} };
  return S.progress[id];
}
function storeActiveClassProgress(classId = getClassId()) {
  S.progress[classId] = { skills: S.skills || {}, review: S.review || {}, pastResults: S.pastResults || {} };
}
function loadClassProgress(classId) {
  storeActiveClassProgress();
  const id = isStr(classId) && classId ? classId : 'default';
  S.profile.exam = id === 'default' ? '' : id;
  const p = ensureClassProgress(id);
  S.skills = p.skills;
  S.review = p.review;
  S.pastResults = p.pastResults;
  saveState(true);
}
function startClassProgress(classId, prevClassId = getClassId()) {
  const id = isStr(classId) && classId ? classId : 'default';
  const prev = isStr(prevClassId) && prevClassId ? prevClassId : 'default';
  storeActiveClassProgress(prev);
  S.profile.exam = id === 'default' ? '' : id;
  S.progress[id] = { skills: {}, review: {}, pastResults: {} };
  S.skills = S.progress[id].skills;
  S.review = S.progress[id].review;
  S.pastResults = S.progress[id].pastResults;
  saveState(true);
}
function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { console.warn('storage not readable', e); }
  if (raw) {
    try { S = sanitizeState(JSON.parse(raw)); }
    catch (e) { console.warn('state not loaded', e); S = DEFAULT_STATE(); STATE_NOTICE = { backup: backupRaw(raw) }; }
  }
  ensureClassProgress(getClassId());
  APP.settings.theme = S.settings.theme; APP.settings.sound = S.settings.sound !== false; APP.settings.lang = S.settings.lang;
}
let saveTimer = 0;
function saveState(now) {
  storeActiveClassProgress();
  clearTimeout(saveTimer);
  const put = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { console.warn('state not saved', e); } };
  if (now) put(); else saveTimer = setTimeout(put, 120);
}
function resetState(keepSettings) {
  const keep = keepSettings ? { settings: S.settings, profile: S.profile } : {};
  S = { ...DEFAULT_STATE(), ...keep };
  ensureClassProgress(getClassId());
  Object.assign(S, S.progress[getClassId()]);
  saveState(true);
}

const _applyBase = applySettings;
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = am ? '#000000' : rootEl.dataset.theme === 'dark' ? '#121117' : '#F6F3EC';
};

function hydrateMedia(root, id) {
  root.querySelectorAll('[data-media]').forEach(el => {
    const url = (window.SHELLY_MEDIA || {})[id + '\n' + el.dataset.media]; el.removeAttribute('data-media');
    if (url) el.src = url; else el.classList.add('missing');
    if (el.dataset.poster) { const poster = (window.SHELLY_MEDIA || {})[id + '\n' + el.dataset.poster]; if (url) el.src = url; if (el.dataset.poster) el.poster = poster; }
  });
}
