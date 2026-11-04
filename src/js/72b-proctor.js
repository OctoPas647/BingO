/* ================= BingO for classes: protection during a test (the student's side) =================
   What SmarTest, Shkolo and exam browsers do, plus what banking and streaming apps do on Android:
   - every time the student leaves the test (another app or tab, split screen, a floating window, unpinning,
     going offline) the server hears about it (proctorReport) and the teacher sees it live;
   - the teacher's rule decides what happens: only a signal, or a warning and then the test is locked
     (until the teacher unlocks it) or handed in;
   - on Android (SecureBridge.java): no screenshots, recording or casting, no other apps over BingO, nothing for
     apps that read the screen, the screen pinned to BingO, and no start on a rooted phone, an emulator or with
     USB debugging on; Google Play Integrity can prove it is the real app;
   - in a browser: full screen, the test is hidden while another window is in front, and print, the PrintScreen key,
     developer tools and a second monitor are reported (a browser cannot block screenshots);
   - the student's name, moving faintly over the test, so a photo taken with another phone shows whose test it was.
   The rules (what counts as leaving) are in 70-edu-core.js and are the same on the server. */

const AC_BEAT_MS = 10000;
const FLAG_EVENTS = [...EDU_AC_STRIKE, ...EDU_AC_FLAG];
const acIsApp = () => !!window.AndroidSecure;
const acRules = A => eduAcClean(((A && A.settings) || {}).antiCheat, A && A.kind, A && A.mode);
const acDebounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function acDeviceId() {
  try { const a = window.AndroidSecure && AndroidSecure.deviceId(); if (a) return a; } catch (e) { }
  try {
    let id = localStorage.getItem('bingo.devId');
    if (!id) { id = 'w-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); localStorage.setItem('bingo.devId', id); }
    return id;
  } catch (e) { return ''; }
}

/* what the device says about itself (Android: SecureBridge.check()) */
function acDevice() {
  if (acIsApp()) { try { return JSON.parse(AndroidSecure.check()); } catch (e) { } }
  const ua = navigator.userAgent || '';
  const br = (ua.match(/(Edg|OPR|SamsungBrowser|Firefox|Chrome)\/\d+/) || ua.match(/Version\/\d+.*Safari/) || [''])[0].split(' ')[0].replace('Version', 'Safari');
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { platform: 'web', browser: br, os, checks: { monitors: screen.isExtended ? 2 : 1 } };
}

/* why this device may not start the test (the server checks the same) */
function acDeviceProblem(ac, dev) {
  if (ac.appOnly && dev.platform !== 'android') return L('Този тест се решава само в приложението BingO за Android. Отвори го на телефона си.');
  if (dev.platform !== 'android') return '';
  const c = dev.checks || {};
  if (ac.deviceCheck && (c.root || c.hook)) return L('Телефонът е с root достъп или с програма, която променя приложенията. Тестът не може да започне на него.');
  if (ac.deviceCheck && c.emulator) return L('Тестът не се решава на емулатор.');
  if (ac.deviceCheck && c.adb) return L('Изключи „USB отстраняване на грешки“ (Настройки → Опции за програмисти) и опитай пак.');
  if (ac.blockA11y && (c.a11y || []).length) return L('Изключи тези приложения с достъп до екрана (Настройки → Достъпност): {a}.', { a: c.a11y.join(', ') });
  return '';
}

/* a Google Play Integrity token for the server's one-time number (Android only) */
function acIntegrityToken(nonce) {
  return new Promise((resolve, reject) => {
    const proj = String(globalThis.BINGO_PLAY_PROJECT || '');
    if (!acIsApp() || !proj || !AndroidSecure.integrity) return resolve('');
    const timer = setTimeout(() => { window.__acIntegrity = null; reject(new Error(L('Google Play не отговори. Провери интернета и опитай пак.'))); }, 20000);
    window.__acIntegrity = (ok, v) => { clearTimeout(timer); window.__acIntegrity = null; ok ? resolve(v) : reject(new Error(L('Google Play не потвърди приложението: {e}', { e: v }))); };
    try { AndroidSecure.integrity(nonce, proj); } catch (e) { clearTimeout(timer); reject(e); }
  });
}

/* before startAttempt: the checks and what the server needs to know */
async function acPreflight(A, aid) {
  const ac = acRules(A), dev = acDevice();
  const problem = acDeviceProblem(ac, dev);
  if (problem) throw new Error(problem);
  let integrityToken = '';
  if (ac.integrity && dev.platform === 'android') {
    const c = await callFn('proctorChallenge', { assignmentId: aid });
    if (c.needed) integrityToken = await acIntegrityToken(c.nonce);
  }
  return { device: dev, deviceId: acDeviceId(), integrityToken };
}

/* the rules a student sees before starting */
function acRuleLines(ac) {
  const what = { lock: L('тестът се заключва, докато учителят не го отключи'), submit: L('тестът се предава автоматично') };
  return [
    ac.detectLeave ? (ac.onLeave === 'log' ? L('Учителят вижда, ако излезеш от теста') : ac.allowedLeaves === 1 ? L('Ако излезеш от теста повече от веднъж, {w}', { w: what[ac.onLeave] }) : ac.allowedLeaves ? L('Ако излезеш от теста повече от {n} пъти, {w}', { n: ac.allowedLeaves, w: what[ac.onLeave] }) : L('Ако излезеш от теста, {w}', { w: what[ac.onLeave] })) : '',
    ac.blockCopy ? L('Копиране и поставяне са изключени') : '',
    ac.secure ? L('Без снимки и запис на екрана (Android)') : '',
    ac.lockApp ? L('Телефонът ще бъде закачен към BingO') : '',
    ac.noOverlays ? L('Без разделен екран и плаващи прозорци') : '',
    ac.fullscreen ? L('На компютър тестът е на цял екран') : '',
    ac.watermark ? L('Името ти е върху теста') : '',
    ac.appOnly ? L('Само в приложението BingO за Android') : ''
  ].filter(Boolean);
}

/* ---------- during the test ----------
   acStart({ aid, A, el, getQ, name }) -> { stop(), beat(), expectLeave() }
   el is the test screen; its .cl-takemain is hidden while the student is not really in the test. */
function acStart({ aid, A, el, getQ, name }) {
  const ac = acRules(A);
  const off = [], timers = [];
  const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); off.push(() => target.removeEventListener(ev, fn, opt)); };
  const devId = acDeviceId(), qKey = 'bingo.acq.' + aid;
  let queue = [], sending = false, again = false, stopped = false;
  let leftAt = 0, blurAt = 0, expectUntil = 0, warnedAt = 0;
  const shields = new Set();
  try { queue = JSON.parse(localStorage.getItem(qKey) || '[]').filter(e => e && e.type); } catch (e) { queue = []; }
  const save = () => { try { queue.length ? localStorage.setItem(qKey, JSON.stringify(queue.slice(-60))) : localStorage.removeItem(qKey); } catch (e) { } };
  const evId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const expecting = () => Date.now() < expectUntil;

  function report(type, extra = {}) {
    if (stopped) return;
    queue.push({ id: evId(), t: Date.now(), type, q: getQ(), ...extra });
    save(); send(false);
  }
  async function send(beat) {
    if (sending) { again = true; return; }
    sending = true;
    const batch = queue.slice(0, 30);
    try {
      const r = await callFn('proctorReport', { assignmentId: aid, deviceId: devId, events: batch, beat }, { timeout: 20000 });
      const sent = new Set(batch.map(e => e.id)); queue = queue.filter(e => !sent.has(e.id)); save();
      handle(r);
    } catch (e) { /* offline: the events stay in the queue and go with the next heartbeat */ }
    finally { sending = false; if (again && !stopped) { again = false; send(false); } }
  }
  function handle(r) {
    if (!r || r.status !== 'in_progress') return;
    if (r.newStrikes && r.action === 'warn') warn(r);
    else if (r.newStrikes && !r.action && ac.onLeave === 'log' && Date.now() - warnedAt > 20000) { warnedAt = Date.now(); toast(L('Излезе от теста — учителят го вижда'), 'bad'); }
  }

  /* ---------- what the student sees ---------- */
  el.insertAdjacentHTML('beforeend', `<div class="cl-shield" hidden><div class="card">${icon('eye')}<h3></h3><p class="muted"></p><button class="btn accent" data-acfix hidden></button><button class="linkbtn" data-acnopin hidden>${L('Телефонът ми не позволява')}</button></div></div>
    <div class="cl-lockcover cl-acwarn" hidden><div class="card">${icon('alert')}<h3>${L('Излезе от теста')}</h3><p class="muted" data-acwarntext></p><button class="btn accent" data-acok>${L('Разбрах')}</button></div></div>`);
  const shieldEl = el.querySelector('.cl-shield'), warnEl = el.querySelector('.cl-acwarn');
  const SHIELD = {
    window: [L('Върни се в теста'), L('Тестът е скрит, докато друг прозорец е отпред.')],
    split: [L('Затвори разделения екран'), L('Тестът се решава само на цял екран — без друго приложение до него или над него.')],
    recording: [L('Спри записа на екрана'), L('Тестът е скрит, докато екранът се записва или споделя.')],
    pin: [L('Закачи екрана към BingO'), L('Натисни „Закачи“ и потвърди. Докато тестът е отворен, другите приложения не се отварят.')],
    fullscreen: [L('Върни се на цял екран'), L('Тестът се решава на цял екран.')]
  };
  const paintShield = () => {
    const top = ['pin', 'recording', 'split', 'fullscreen', 'window'].find(k => shields.has(k));
    el.classList.toggle('cl-shielded', !!top);
    shieldEl.hidden = !top; if (!top) return;
    shieldEl.querySelector('h3').textContent = SHIELD[top][0];
    shieldEl.querySelector('p').textContent = SHIELD[top][1];
    const fix = shieldEl.querySelector('[data-acfix]');
    fix.hidden = !(top === 'pin' || top === 'fullscreen');
    fix.textContent = top === 'pin' ? L('Закачи') : L('Цял екран');
    shieldEl.querySelector('[data-acnopin]').hidden = top !== 'pin';
  };
  const shield = (k, v) => { v ? shields.add(k) : shields.delete(k); paintShield(); };
  function warn(r) {
    const left = r.allowed - (r.strikes - r.forgiven) + 1;
    const what = r.onLeave === 'submit' ? L('тестът ще бъде предаден') : L('тестът ще бъде заключен');
    warnEl.querySelector('[data-acwarntext]').textContent = (left <= 1 ? L('Учителят вижда това. Ако излезеш още веднъж, {w}.', { w: what }) : L('Учителят вижда това. Още {n} пъти и {w}.', { n: left, w: what }));
    warnEl.hidden = false; vibrate();
  }
  function vibrate() { try { navigator.vibrate && navigator.vibrate([60, 60, 120]); } catch (e) { } }
  el.addEventListener('click', e => {
    if (e.target.closest('[data-acok]')) warnEl.hidden = true;
    if (e.target.closest('[data-acfix]')) {
      if (shields.has('pin')) { try { AndroidSecure.pin(); } catch (x) { } }
      else if (shields.has('fullscreen')) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { });
    }
    if (e.target.closest('[data-acnopin]')) { report('nopin'); shield('pin', false); }
  });

  /* ---------- leaving: tab, app, window ---------- */
  const gone = () => { blurAt = 0; if (leftAt) return; leftAt = Date.now(); report(expecting() ? 'photo' : 'left'); };
  const back = () => { if (!leftAt) return; const secs = Math.round((Date.now() - leftAt) / 1000); leftAt = 0; report('back', { secs }); send(true); };
  if (ac.detectLeave) {
    on(document, 'visibilitychange', () => (document.hidden ? gone() : back()));
    on(window, 'pagehide', gone);
    window.__appPaused = gone;
    window.__appResumed = back;
    off.push(() => { window.__appPaused = null; window.__appResumed = null; });
    if (!acIsApp()) {
      /* another window in front (PC): the test is hidden; 3 s or more counts as leaving */
      on(window, 'blur', () => { if (document.hidden) return; blurAt = Date.now(); if (!expecting()) shield('window', true); });
      on(window, 'focus', () => { shield('window', false); if (!blurAt) return; const secs = Math.round((Date.now() - blurAt) / 1000); blurAt = 0; if (!expecting() && secs >= 1 && !leftAt) report('blur', { secs }); });
    }
  }
  window.__acExpectLeave = () => { expectUntil = Date.now() + 3 * 60000; };
  off.push(() => { window.__acExpectLeave = null; });

  /* ---------- Android ---------- */
  if (acIsApp()) {
    window.__acEvent = (type, d = {}) => {
      if (stopped) return;
      if (type === 'split') { shield('split', !!d.on); if (d.on) report('split'); }
      else if (type === 'recording') { shield('recording', !!d.on); if (d.on) report('recording'); }
      else if (type === 'pinned') { shield('pin', false); report('pinned'); }
      else if (type === 'unpin') { if (ac.lockApp) shield('pin', true); report('unpin'); }
      else if (type === 'screenshot') { report('screenshot', { blocked: !!d.blocked }); if (d.blocked) toast(L('Снимките на екрана са изключени по време на теста'), 'bad'); }
      else if (type === 'cast') report('cast', { info: String(d.name || '').slice(0, 60) });
      else if (type === 'blur') { if (!expecting() && (d.secs || 0) >= 1) report('blur', { secs: d.secs }); }
      else if (type === 'a11y') report('a11y', { info: (d.apps || []).join(', ').slice(0, 100) });
      else if (type === 'adb') report('adb');
    };
    off.push(() => { window.__acEvent = null; });
    try { AndroidSecure.begin(JSON.stringify({ secure: ac.secure, lockApp: ac.lockApp, noOverlays: ac.noOverlays, blockA11y: ac.blockA11y })); } catch (e) { }
    off.push(() => { try { AndroidSecure.end(); } catch (e) { } });
    if (ac.lockApp) {
      shield('pin', true);
      timers.push(setTimeout(() => { try { const s = JSON.parse(AndroidSecure.state()); if (s.pinned) shield('pin', false); } catch (e) { } }, 1500));
    }
  } else {
    /* ---------- in a browser ---------- */
    /* full screen on a computer (on a phone the back gesture leaves full screen too easily) */
    const desktop = !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (ac.fullscreen && desktop && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => shield('fullscreen', true));
      on(document, 'fullscreenchange', () => { const fs = !!document.fullscreenElement; shield('fullscreen', !fs); if (!fs) report('fullscreen'); });
      off.push(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); });
    }
    if (ac.noOverlays) {
      /* the browser window made small (split screen, snapped next to another window) */
      let small = false;
      const chk = () => { const s = window.outerWidth < screen.availWidth * 0.7 || window.outerHeight < screen.availHeight * 0.6; if (s && !small) report('resize', { info: `${window.outerWidth}×${window.outerHeight}` }); small = s; };
      on(window, 'resize', acDebounce(chk, 600)); chk();
    }
    if (screen.isExtended) report('monitors');
    on(document, 'keydown', e => {
      const k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && k === 'p') { e.preventDefault(); report('print'); }
      else if (k === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(k))) { e.preventDefault(); report('devtools'); }
      else if (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k)) report('screenshot', { blocked: false });
    }, true);
    on(document, 'keyup', e => { if (e.key === 'PrintScreen') { report('screenshot', { blocked: false }); try { navigator.clipboard && navigator.clipboard.writeText(''); } catch (x) { } } }, true);
    on(window, 'beforeprint', () => report('print'));
  }

  /* ---------- copy and paste ---------- */
  if (ac.blockCopy) {
    for (const ev of ['copy', 'cut']) on(document, ev, e => { e.preventDefault(); report(ev); });
    on(document, 'paste', e => { e.preventDefault(); report('paste'); toast(L('Поставянето е изключено в този тест'), 'bad'); });
    on(document, 'contextmenu', e => e.preventDefault());
    on(document, 'dragstart', e => e.preventDefault());
    on(document, 'drop', e => e.preventDefault());
    document.body.classList.add('cl-nocopy'); off.push(() => document.body.classList.remove('cl-nocopy'));
  }
  el.classList.add('cl-protected'); off.push(() => el.classList.remove('cl-protected'));

  /* ---------- the student's name over the test ---------- */
  if (ac.watermark) {
    const mark = () => {
      const t = new Date(), stamp = `${esc(name || '')} · ${t.toLocaleDateString(locale())} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `<div class="cl-watermark" aria-hidden="true" style="--wx:${Math.round(Math.random() * 80)}px;--wy:${Math.round(Math.random() * 80)}px">${Array.from({ length: 40 }, () => `<span>${stamp}</span>`).join('')}</div>`;
    };
    let wm = h(mark()); el.appendChild(wm);
    const swap = () => { const n = h(mark()); wm.replaceWith(n); wm = n; };
    timers.push(setInterval(swap, 30000));
    /* the name is taken off the page (developer tools, an extension): put it back and tell the teacher */
    const mo = new MutationObserver(() => {
      if (stopped) return;
      const cs = wm.isConnected ? getComputedStyle(wm) : null;
      if (!wm.isConnected || !cs || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) { report('tamper', { info: 'watermark' }); const n = h(mark()); (wm.isConnected ? wm.replaceWith(n) : el.appendChild(n)); wm = n; }
    });
    mo.observe(el, { childList: true, subtree: false, attributes: true, attributeFilter: ['style', 'class'] });
    off.push(() => mo.disconnect());
  }

  /* ---------- the heartbeat ---------- */
  timers.push(setInterval(() => send(true), AC_BEAT_MS));
  send(true);

  return {
    report,
    beat: () => send(true),
    expectLeave: () => window.__acExpectLeave && window.__acExpectLeave(),
    stop() {
      if (stopped) return;
      send(false); stopped = true;
      timers.forEach(x => { clearInterval(x); clearTimeout(x); });
      off.splice(0).forEach(f => f());
      shieldEl.remove(); warnEl.remove(); el.querySelectorAll('.cl-watermark').forEach(x => x.remove());
      el.classList.remove('cl-shielded');
    }
  };
}
