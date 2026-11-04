'use strict';
/* ================= BingO for classes: protection during a test (helpers) =================
   What the student's device says about itself and about leaving the test, cleaned before it is stored,
   and the Google Play Integrity check (a real, unmodified BingO from Google Play on a real phone).
   The rules themselves (what counts as leaving, warn / lock / hand in) are shared with the app: functions/shared/edu.js. */

const crypto = require('crypto');
const EDU = require('./shared/edu');

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

/* one event from the student's device: only known types and short fields */
function cleanEvent(e, serverMs) {
  if (!e || typeof e !== 'object' || !EDU.EDU_AC_EVENTS.includes(e.type)) return null;
  const t = int(e.t, 0, 9e15);
  const out = { type: e.type, t: t && Math.abs(t - serverMs) < 6 * 3600e3 ? t : serverMs, ts: serverMs };
  const q = int(e.q, 0, 500); if (q) out.q = q;
  const secs = int(e.secs, 0, 86400); if (secs) out.secs = secs;
  if (typeof e.blocked === 'boolean') out.blocked = e.blocked;
  const info = str(e.info, 120); if (info) out.info = info;
  const id = str(e.id, 32); if (id) out.id = id;
  return out;
}

/* what the device says about itself when the test starts */
function cleanDevice(d, req) {
  d = d && typeof d === 'object' ? d : {};
  const c = d.checks && typeof d.checks === 'object' ? d.checks : {};
  const raw = req && req.rawRequest;
  const ip = raw ? str(String((raw.headers && raw.headers['x-forwarded-for']) || raw.ip || '').split(',')[0], 64) : '';
  return {
    platform: d.platform === 'android' ? 'android' : 'web',
    model: str(d.model, 80), os: str(d.os, 40), app: str(d.app, 20), browser: str(d.browser, 80),
    ip, ua: raw && raw.headers ? str(raw.headers['user-agent'], 200) : '',
    checks: {
      root: !!c.root, emulator: !!c.emulator, adb: !!c.adb, hook: !!c.hook, overlaysBlocked: !!c.overlaysBlocked,
      a11y: Array.isArray(c.a11y) ? c.a11y.slice(0, 8).map(x => str(x, 80)) : [], monitors: int(c.monitors, 0, 16) || 0
    }
  };
}

/* why this device may not start a protected test ('' = it may) */
function deviceProblem(ac, dev) {
  if (ac.appOnly && dev.platform !== 'android') return 'Този тест се решава само в приложението BingO за Android.';
  if (dev.platform !== 'android') return '';
  const c = dev.checks;
  if (ac.deviceCheck && (c.root || c.hook)) return 'Телефонът е с root достъп или с програма, която променя приложенията. Тестът не може да започне на него.';
  if (ac.deviceCheck && c.emulator) return 'Тестът не се решава на емулатор.';
  if (ac.deviceCheck && c.adb) return 'Изключи „USB отстраняване на грешки“ (Настройки → Опции за програмисти) и опитай пак.';
  if (ac.blockA11y && c.a11y.length) return 'Изключи тези приложения с достъп до екрана (Настройки → Достъпност): ' + c.a11y.join(', ') + '.';
  return '';
}

/* ---------- Google Play Integrity ----------
   On only when the server has PLAY_INTEGRITY_PACKAGE (the app's package on Google Play, e.g. app.bingo) and
   the Cloud project is linked in Play Console. Without it the check is skipped and the attempt says "skipped". */
const integrityConfigured = () => !!process.env.PLAY_INTEGRITY_PACKAGE;
const newNonce = () => crypto.randomBytes(24).toString('base64url');

async function decodeIntegrity(token) {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/playintegrity'] });
  const client = await auth.getClient();
  const pkg = process.env.PLAY_INTEGRITY_PACKAGE;
  const r = await client.request({ url: `https://playintegrity.googleapis.com/v1/${encodeURIComponent(pkg)}:decodeIntegrityToken`, method: 'POST', data: { integrity_token: token } });
  return r.data && r.data.tokenPayloadExternal;
}

/* 'ok' | 'skipped' | a reason it failed */
async function checkIntegrity(token, nonce, decode = decodeIntegrity) {
  if (!integrityConfigured()) return { verdict: 'skipped' };
  if (!token) return { verdict: 'no-token' };
  let p;
  try { p = await decode(token); } catch (e) { return { verdict: 'error', detail: String(e.message || e).slice(0, 160) }; }
  if (!p) return { verdict: 'error' };
  const rd = p.requestDetails || {}, app = p.appIntegrity || {}, dev = p.deviceIntegrity || {};
  if (rd.nonce !== nonce) return { verdict: 'bad-nonce' };
  if (rd.requestPackageName !== process.env.PLAY_INTEGRITY_PACKAGE) return { verdict: 'bad-package' };
  if (Math.abs(Date.now() - Number(rd.timestampMillis || 0)) > 10 * 60000) return { verdict: 'stale' };
  const allowSideload = process.env.PLAY_INTEGRITY_ALLOW_SIDELOAD === '1';
  if (app.appRecognitionVerdict !== 'PLAY_RECOGNIZED' && !(allowSideload && app.appRecognitionVerdict === 'UNRECOGNIZED_VERSION')) return { verdict: 'app-' + String(app.appRecognitionVerdict || 'unknown').toLowerCase() };
  if (!(dev.deviceRecognitionVerdict || []).includes('MEETS_DEVICE_INTEGRITY')) return { verdict: 'device' };
  return { verdict: 'ok' };
}

module.exports = { cleanEvent, cleanDevice, deviceProblem, integrityConfigured, newNonce, checkIntegrity };
