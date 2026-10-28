/* ================= Screen framework: navigation, sheets, toasts, icons, sounds ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', close: '<path d="M18 6L6 18M6 6l12 12"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M20 6L9 17l-5-5"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1-2.5 2.5-4 1.5 1.5 2.5 2.5 2.5 4A2.5 2.5 0 0 1 12 21z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/>', grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>', pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  book: '<path d="M4 19V6a2 2 0 0 1 2-2h14v13H6a1 1 0 0 0-2 0zm0 0a2 2 0 0 0 2 2h14"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4v3h-4z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.3.8 2.4h6c0-1.1.2-1.9.8-2.4A6 6 0 0 0 12 3z"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
  text: '<path d="M5 6h14M5 10h14M5 14h9M5 18h11"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v4h4"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><circle cx="12" cy="12" r="3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

/* ---------- navigation: a stack of screens; Android back and the browser back both go through back() ----------
   The browser history holds at most ONE extra entry (a "trap") while there is somewhere to go back to:
   a screen above the first one, or an open sheet. The browser's back button uses up the trap, the app
   goes one step back and sets a new trap if it is still needed. Keeping one entry (instead of one per
   screen) means in-app back buttons and home() can never leave stale entries behind, which made the
   browser's back button seem stuck and then suddenly leave the app. */
const SCREENS = {}, NAV = [];
let root, histTrap = false, histSkip = 0, trapBackPending = false, trapBackToken = 0;
const needTrap = () => NAV.length > 1 || overlays.length > 0;
function syncHistory() {
  /* A trap removal is still running: do not push or remove another entry until its popstate arrives. */
  if (trapBackPending) return;
  if (needTrap() && !histTrap) { history.pushState({ trap: 1 }, ''); histTrap = true; }
  else if (!needTrap() && histTrap) {
    trapBackPending = true;
    const token = ++trapBackToken;
    histSkip++;
    history.back();
    /* Safety net: if the popstate never arrives, stop waiting instead of leaving histSkip stuck. */
    setTimeout(() => {
      if (trapBackPending && trapBackToken === token) {
        trapBackPending = false;
        if (histSkip > 0) histSkip--;
        histTrap = false;
        syncHistory();
      }
    }, 1000);
  }
}
function go(screen, params = {}, opt = {}) {
  const cur = NAV[NAV.length - 1];
  if (cur) { cur.y = window.scrollY; leave(cur); }
  if (opt.replace) NAV.pop();
  NAV.push({ screen, params });
  render();
}
function leave(e) { if (e.onLeave) { try { e.onLeave(); } catch (x) { } e.onLeave = null; } }
async function back() {
  if (closeTopOverlay()) return 'blocked';
  if (NAV.length <= 1) return false;
  const cur = NAV[NAV.length - 1];
  if (cur.guard && !(await cur.guard())) return 'blocked';
  leave(cur); NAV.pop(); render(true);
  return 'popped';
}
function backTo(screen) { while (NAV.length > 1 && NAV[NAV.length - 1].screen !== screen) leave(NAV.pop()); render(true); }
function home() { while (NAV.length > 1) leave(NAV.pop()); render(); }
/* Android's back button: 'h' means the app handled it; '' lets Android close the app */
window.__back = () => { if (!overlays.length && NAV.length <= 1) return ''; back(); return 'h'; };
window.addEventListener('popstate', async () => {
  if (histSkip > 0) {
    histSkip--;
    /* This popstate is our own trap removal, not a user Back: resync without popping NAV. */
    if (trapBackPending) { trapBackPending = false; histTrap = false; syncHistory(); }
    return;
  }
  histTrap = false;
  await back();
  syncHistory();
});
async function render(restore) {
  const e = NAV[NAV.length - 1]; if (!e) return;
  e.guard = null;
  document.querySelectorAll('canvas.confetti').forEach(c => c.remove()); /* confetti belongs to the screen that started it */
  syncHistory();
  /* A fresh element per screen, so event handlers from the previous screen go away with it */
  const fresh = document.createElement('div'); fresh.id = 'app'; fresh.className = 'screen screen-' + e.screen;
  root.replaceWith(fresh); root = fresh;
  try { await SCREENS[e.screen](root, e.params, e); }
  catch (err) { console.error(err); root.innerHTML = `<div class="pad"><div class="card error">${esc(t('err.screen'))}<br><small>${esc(err.message)}</small></div><button class="btn" onclick="home()">${esc(t('nav.home'))}</button></div>`; }
  window.scrollTo(0, restore ? e.y || 0 : 0);
}
const refresh = () => { const e = NAV[NAV.length - 1]; if (e) { e.y = window.scrollY; render(true); } };

/* ---------- bottom sheets ---------- */
const overlays = [];
function closeTopOverlay() { const o = overlays[overlays.length - 1]; if (!o) return false; if (o.dismiss !== false) o.close(null); return true; }
function sheet({ title, body = '', actions = [], dismiss = true, onMount, wide }) {
  return new Promise(resolve => {
    const el = h(`<div class="overlay"><div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="grip"></div>${title ? `<h2 class="sheet-title">${esc(title)}</h2>` : ''}<div class="sheet-body">${body}</div>
      ${actions.length ? `<div class="sheet-actions">${actions.map(a => `<button class="btn ${a.kind || 'ghost'}" data-act="${esc(a.id)}">${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div></div>`);
    const o = { dismiss, close(v) { if (o.done) return; o.done = true; overlays.splice(overlays.indexOf(o), 1); el.classList.add('out'); setTimeout(() => el.remove(), 220); syncHistory(); resolve(v); } };
    overlays.push(o); syncHistory();
    el.addEventListener('click', ev => {
      const a = ev.target.closest('[data-act]'); if (a) return o.close(a.dataset.act);
      if (ev.target === el && dismiss) o.close(null);
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    onMount && onMount(el.querySelector('.sheet'), o);
  });
}
const confirmBox = (title, text, ok, danger) => sheet({ title, body: `<p>${esc(text)}</p>`, actions: [{ id: 'no', label: t('btn.cancel') }, { id: 'yes', label: ok, kind: danger ? 'danger' : 'primary' }] }).then(v => v === 'yes');

function toast(msg, kind = '') {
  const el = h(`<div class="toast ${kind}" role="status">${esc(msg)}</div>`);
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------- theme and language ---------- */
function applySettings() {
  const s = APP.settings, dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('still', !s.motion);
  UI_LANG = s.lang === 'auto' ? ((navigator.language || 'en').toLowerCase().startsWith('bg') ? 'bg' : 'en') : s.lang;
  document.documentElement.lang = UI_LANG;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (APP.settings.theme === 'auto') applySettings(); });
/* Module screens take the module's colour and language (so Cyrillic gets the right letter shapes) */
function moduleLook(el, m) { el.style.setProperty('--accent', m.color); el.style.setProperty('--accent-ink', inkOn(m.color)); }
function inkOn(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1B1A22' : '#FFFFFF'; }

/* ---------- sound (tiny synth, no files) ---------- */
function sound(kind) {
  if (!APP.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { right: [[660, 0], [880, 0.09]], wrong: [[220, 0], [196, 0.12]], done: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]] }[kind] || [];
    for (const [f, at] of notes) {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + at;
      o.type = kind === 'wrong' ? 'triangle' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.25);
    }
  } catch (e) { }
}

/* ---------- confetti ---------- */
function confetti() {
  if (!APP.settings.motion) return;
  const c = h('<canvas class="confetti"></canvas>'), x = c.getContext('2d'), W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const cs = getComputedStyle(document.documentElement), cols = ['--accent', '--good', '--gold', '--primary'].map(v => cs.getPropertyValue(v).trim() || '#888');
  const ps = Array.from({ length: 120 }, () => ({ x: W / 2, y: H * 0.3, vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 18 - 6, r: (Math.random() * 5 + 3) * devicePixelRatio, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6 }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += 0.55; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.15; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }
    if (++f < 110 && c.isConnected) requestAnimationFrame(step); else c.remove();
  })();
}

/* ---------- small view helpers ---------- */
function ring(pct, label, cls = '') {
  const r = 26, C = 2 * Math.PI * r, p = clamp(pct, 0, 1);
  return `<div class="ring ${cls}"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="track"/><circle cx="32" cy="32" r="${r}" class="fill" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"/></svg><span>${label}</span></div>`;
}
const bar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(pct, 0, 1) * 100}%"></i></div>`;
const topbar = (title, opts = {}) => `<header class="topbar ${opts.cls || ''}">${opts.noBack ? '<span class="tb-gap"></span>' : `<button class="iconbtn" data-back aria-label="${esc(t('nav.back'))}">${icon(opts.closeIcon ? 'close' : 'back')}</button>`}<div class="tb-title">${title}</div>${opts.right || '<span class="tb-gap"></span>'}</header>`;
document.addEventListener('click', e => { if (e.target.closest('[data-back]')) back(); });
