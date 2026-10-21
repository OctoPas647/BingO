/* ================= Small helpers (no DOM, also used by the Node checks) ================= */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const sum = a => a.reduce((x, y) => x + y, 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Seeded random numbers, so a shuffle can be repeated (exam review shows the same order) */
function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const c of String(seed)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(list, seed) {
  const a = list.slice(), r = seed == null ? Math.random : rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* A shuffle that never returns the original order (when that is possible) */
function shuffledIdx(n, seed) {
  const base = [...Array(n).keys()]; if (n < 2) return base;
  let s = shuffled(base, seed), k = 0;
  while (s.every((v, i) => v === i) && k++ < 5) s = shuffled(base, seed == null ? null : seed + ':' + k);
  return s;
}

/* Numbers in the content's language: 4,32 in Bulgarian, 4.32 in English */
function fmtNum(x, lang, decimals) {
  if (x == null || isNaN(x)) return '–';
  const d = decimals == null ? (Number.isInteger(x) ? 0 : 2) : decimals;
  try { return new Intl.NumberFormat(lang || 'en', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x); }
  catch (e) { return x.toFixed(d); }
}
/* A number with up to `digits` significant digits (0.155, 2.381, 18 000), in the content's language */
function fmtSig(x, lang, digits = 4) {
  if (x == null || isNaN(x)) return '–';
  if (Number.isInteger(x)) return fmtNum(x, lang, 0);
  try { return new Intl.NumberFormat(lang || 'en', { maximumSignificantDigits: digits }).format(x); } catch (e) { return String(+x.toPrecision(digits)); }
}
const roundTo = (x, d) => { const p = Math.pow(10, d || 0); return Math.round((x + Number.EPSILON) * p) / p; };
/* Points like 2.5 or 1.333: whole numbers stay whole, others get up to 2 decimals */
const fmtPts = (x, lang) => fmtNum(roundTo(x, 2), lang, Number.isInteger(roundTo(x, 2)) ? 0 : (Number.isInteger(roundTo(x, 1)) ? 1 : 2));
const fmtClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };
const slug = s => String(s || 'module').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48) || 'module';
const todayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const wordCount = s => (String(s || '').trim().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || []).length;
