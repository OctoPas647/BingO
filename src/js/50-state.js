/* ================= BingO: state that lives in this browser =================
   Shelly's engine (rich text, task views, scoring) is reused as is; this file replaces
   Shelly's IndexedDB store with one small localStorage record. */
const STORE_KEY = 'bingo.v1';
const APP_NAME_UI = 'BingO';

/* Shelly's 20-ui.js reads APP.settings (theme, sound, motion, lang) */
let APP = { settings: { lang: 'bg', theme: 'auto', sound: true, motion: true, shuffle: false }, xp: 0, days: {} };

const DEFAULT_STATE = () => ({
  v: 1,
  profile: { name: '', cls: '', age: '', exam: '', id: uid() },
  settings: { aiMode: 'off', apiKey: '', model: 'gemini-3.8-flash', proxyUrl: '', sheetUrl: '', theme: 'auto', sound: true },
  subject: 'math',
  skills: {},            /* "math.quad" -> { p, n, ok, last, misc: { code: count }, hist: [[time, p]] } */
  log: [],               /* every answer, the rows that go to Google Sheets / Looker Studio */
  queue: [],             /* rows not yet sent to the Sheet */
  sessions: 0,
  review: {},            /* "math.quad" -> { box, due }: when a strong skill is checked again (57-review.js) */
  onboarding: null,      /* first-run setup progress (58-onboarding.js) */
  aiFlags: []            /* AI-made tasks a learner reported as wrong */
});

let S = DEFAULT_STATE();
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const v = JSON.parse(raw); S = { ...DEFAULT_STATE(), ...v, profile: { ...DEFAULT_STATE().profile, ...(v.profile || {}) }, settings: { ...DEFAULT_STATE().settings, ...(v.settings || {}) } }; } }
  catch (e) { console.warn('state not loaded', e); }
  APP.settings.theme = S.settings.theme; APP.settings.sound = S.settings.sound !== false;
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = am ? '#000000' : rootEl.dataset.theme === 'dark' ? '#121117' : '#F6F3EC';
};

/* Shelly's media loader, reading the few pictures that the build embeds (window.SHELLY_MEDIA: "module id\npath" -> data URL) */
function hydrateMedia(root, id) {
  root.querySelectorAll('[data-media]').forEach(el => {
    const url = (window.SHELLY_MEDIA || {})[id + '\n' + el.dataset.media]; el.removeAttribute('data-media');
    if (url) el.src = url; else el.classList.add('missing');
  });
}
