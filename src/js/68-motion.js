/* ================= Motion: the app should feel like a native iOS app =================
   All motion is spring-like (the iOS curve cubic-bezier(.32,.72,0,1), or a small overshoot for things you
   press) and is switched off by Settings → Анимации or the system's "reduce motion".
   - pages: a new screen pushes in from the right while the old one slides a third to the left under a shade;
     back does the reverse; a question session or past exam comes up from the bottom like a modal;
     the three tabs cross-fade
   - scroll: the nav bar turns into Liquid glass when content goes under it, a large title shrinks into the bar,
     the floating tab bar gets smaller while you scroll down and comes back when you scroll up,
     cards and list rows ease in the first time they come into view
   - sheets lift the page behind them (it shrinks a little and darkens) and can be pulled down to close
   - the segmented control's thumb and the tab bar's lens slide to the new choice
   - a light haptic tick on a right or wrong answer (Android) */

const motionOn = () => APP.settings.motion !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPRING = 'cubic-bezier(.32,.72,0,1)';
const MODAL_SCREENS = ['session', 'pastexam', 'onboarding'];
const TAB_SCREENS = ['home', 'stats', 'profile'];

/* ---------- page transitions ---------- */
let lastNav = { depth: 0, screen: null };
const _renderBase = render;
render = async function (restore) {
  const e = NAV[NAV.length - 1], from = lastNav, to = { depth: NAV.length, screen: e && e.screen };
  const oldRoot = root, oldY = window.scrollY, animate = motionOn() && from.screen && oldRoot && oldRoot.isConnected && oldRoot.childElementCount;
  await _renderBase(restore);
  lastNav = to;
  decorate(root);
  if (!animate || from.screen === to.screen && from.depth === to.depth) return;
  const kind = TAB_SCREENS.includes(from.screen) && TAB_SCREENS.includes(to.screen) && Math.abs(to.depth - from.depth) <= 1 ? 'tab'
    : to.depth > from.depth ? (MODAL_SCREENS.includes(to.screen) ? 'present' : 'push')
    : (MODAL_SCREENS.includes(from.screen) ? 'dismiss' : 'pop');
  /* the old page stays on screen as a still picture while the new one moves in */
  const ghost = oldRoot; ghost.removeAttribute('id'); ghost.classList.add('ghost-page'); ghost.style.height = innerHeight + 'px';
  ghost.scrollTop = 0; ghost.firstElementChild && (ghost.style.paddingTop = '0');
  [...ghost.children].forEach(c => { c.style.transform = `translateY(${-oldY}px)`; });
  ghost.querySelectorAll('.tabbar, .checkbar, .playbar, .apphead, .topbar').forEach(c => { if (getComputedStyle(c).position === 'fixed' || getComputedStyle(c).position === 'sticky') c.style.transform = ''; });
  document.body.appendChild(ghost);
  const shade = document.createElement('div'); shade.className = 'page-shade'; document.body.appendChild(shade);
  const done = () => { ghost.remove(); shade.remove(); root.style.transform = ''; root.style.position = ''; root.style.zIndex = ''; root.getAnimations().forEach(a => a.cancel()); };
  const opt = { duration: kind === 'tab' ? 280 : 520, easing: SPRING, fill: 'both' };
  const front = kind === 'pop' || kind === 'dismiss' ? ghost : root, back_ = front === root ? ghost : root;
  root.style.zIndex = kind === 'pop' || kind === 'dismiss' ? '' : '31';
  if (kind === 'tab') {
    ghost.style.zIndex = '30'; shade.remove();
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], opt);
    root.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], opt).finished.then(done, done);
    return;
  }
  if (kind === 'push' || kind === 'pop') {
    const inX = kind === 'push' ? ['100%', '0%'] : ['-30%', '0%'], outX = kind === 'push' ? ['0%', '-30%'] : ['0%', '100%'];
    ghost.style.zIndex = kind === 'pop' ? '32' : '29'; shade.style.zIndex = kind === 'pop' ? '31' : '30';
    root.style.position = 'relative'; root.style.zIndex = kind === 'push' ? '31' : '1';
    root.animate([{ transform: `translateX(${inX[0]})` }, { transform: `translateX(${inX[1]})` }], opt);
    shade.animate([{ opacity: kind === 'push' ? 0 : .18 }, { opacity: kind === 'push' ? .18 : 0 }], opt);
    ghost.animate([{ transform: `translateX(${outX[0]})` }, { transform: `translateX(${outX[1]})` }], opt).finished.then(done, done);
    if (kind === 'push') ghost.animate([{ filter: 'none' }, { filter: 'brightness(.9)' }], opt);
    return;
  }
  /* present / dismiss: a sheet-like card from the bottom */
  ghost.style.zIndex = kind === 'dismiss' ? '32' : '29'; shade.style.zIndex = kind === 'dismiss' ? '31' : '30';
  root.style.position = 'relative'; root.style.zIndex = kind === 'present' ? '31' : '1';
  if (kind === 'present') {
    root.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { ...opt, duration: 560 });
    ghost.animate([{ transform: 'none', borderRadius: '0' }, { transform: 'scale(.94)', borderRadius: '18px' }], { ...opt, duration: 560 });
    shade.animate([{ opacity: 0 }, { opacity: .25 }], { ...opt, duration: 560 }).finished.then(done, done);
  } else {
    root.animate([{ transform: 'scale(.94)', borderRadius: '18px' }, { transform: 'none', borderRadius: '0' }], { ...opt, duration: 500 });
    shade.animate([{ opacity: .25 }, { opacity: 0 }], { ...opt, duration: 500 });
    ghost.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { ...opt, duration: 500 }).finished.then(done, done);
  }
};

/* ---------- what every new screen gets ---------- */
function decorate(el) {
  if (!el) return;
  /* a large title under the nav bar of a pushed screen (Settings, Mistakes and data …) */
  const tb = el.querySelector(':scope > .topbar'), tt = tb && tb.querySelector('.tb-title');
  if (tb && tt && !el.querySelector('.large-title') && !el.classList.contains('screen-session') && !el.classList.contains('screen-pastexam')) {
    tb.insertAdjacentHTML('afterend', `<h1 class="large-title">${tt.innerHTML}</h1>`);
  }
  /* the tab bar's lens starts at the previous tab and slides to this one */
  const tabbar = el.querySelector('.tabbar');
  if (tabbar) {
    const i = [...tabbar.querySelectorAll('button')].findIndex(b => b.classList.contains('on'));
    tabbar.style.setProperty('--tab-n', tabbar.querySelectorAll('button').length);   /* the lens is one tab wide */
    const prev = decorate.tab == null ? i : decorate.tab;
    tabbar.style.setProperty('--tab-i', prev);
    requestAnimationFrame(() => requestAnimationFrame(() => tabbar.style.setProperty('--tab-i', i)));
    decorate.tab = i;
  }
  segThumbs(el);
  reveal(el);
  onScroll();
  /* the ring on Home and the result screens draws itself */
  if (motionOn()) el.querySelectorAll('.ring .fill').forEach(c => {
    const to = c.getAttribute('stroke-dashoffset'), from = c.getAttribute('stroke-dasharray');
    c.style.transition = 'none'; c.setAttribute('stroke-dashoffset', from);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = ''; c.setAttribute('stroke-dashoffset', to); }));
  });
}

/* ---------- segmented controls: a sliding thumb ---------- */
const segLast = {};
function segThumbs(el) {
  el.querySelectorAll('.seg:not(.list)').forEach(seg => {
    const on = seg.querySelector('button.on'); if (!on) return;
    let th = seg.querySelector('.seg-thumb'); if (!th) { th = document.createElement('i'); th.className = 'seg-thumb'; seg.prepend(th); }
    const place = b => { th.style.left = b.offsetLeft + 'px'; th.style.width = b.offsetWidth + 'px'; };
    const key = seg.dataset.key || '';
    const prev = segLast[key] != null ? seg.querySelectorAll('button')[segLast[key]] : null;
    th.style.transition = 'none'; place(prev || on);
    requestAnimationFrame(() => { th.style.transition = ''; place(on); });
    segLast[key] = [...seg.querySelectorAll('button')].indexOf(on);
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { place(b); segLast[key] = [...seg.querySelectorAll('button')].indexOf(b); } });
  });
}

/* ---------- things easing in as they come into view ---------- */
const REVEAL_SEL = '.card, .skrow, .statcard, .delta, .rv, .ios-group, .losscard, .subj-pick, .sklist, .review-list, .opt, .res-hero, .ob-card .seg button';
let revealObs = null;
function reveal(el) {
  if (!motionOn() || !('IntersectionObserver' in window)) return;
  revealObs = revealObs || new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' });
  let k = 0;
  el.querySelectorAll(REVEAL_SEL).forEach(n => {
    if (n.closest('.tabbar, .checkbar, .sheet') || n.closest('.sklist') && n.classList.contains('skrow') && false) return;
    n.classList.add('reveal');
    const r = n.getBoundingClientRect();
    if (r.top < innerHeight) { n.style.setProperty('--d', Math.min(k++ * 45, 420) + 'ms'); requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('in'))); }
    else revealObs.observe(n);
    n.addEventListener('transitionend', () => n.style.removeProperty('--d'), { once: true });
  });
}
motionReveal = el => {
  if (!motionOn()) return;
  el.animate([{ opacity: 0, transform: 'translateY(-6px)', maxHeight: '0px' }, { opacity: 1, transform: 'none', maxHeight: '2000px' }], { duration: 480, easing: SPRING });
};

/* ---------- scroll: glass bars, large titles, the tab bar shrinking ---------- */
let lastY = 0, ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = Math.max(0, window.scrollY), el = root; if (!el) return;
    el.querySelectorAll(':scope > .apphead, :scope > .topbar').forEach(b => b.classList.toggle('scrolled', y > 2));
    const lt = el.querySelector('.large-title');
    if (lt) {
      const p = Math.min(1, y / 44);
      lt.style.setProperty('--lt-op', String(1 - p)); lt.style.setProperty('--lt-scale', String(1 - p * 0.08));
      const tb = el.querySelector(':scope > .topbar'); if (tb) tb.style.setProperty('--tb-title', String(Math.max(0, Math.min(1, (y - 26) / 22))));
    } else { const tb = el.querySelector(':scope > .topbar'); if (tb) tb.style.setProperty('--tb-title', '1'); }
    const tab = el.querySelector('.tabbar');
    if (tab) { if (y > 90 && y - lastY > 6) tab.classList.add('min'); else if (lastY - y > 6 || y < 40) tab.classList.remove('min'); }
    lastY = y;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- sheets: lift the page behind, pull down to close ---------- */
new MutationObserver(() => {
  const open = !!document.querySelector('.overlay.in:not(.out), .overlay:not(.out) .sheet');
  document.documentElement.classList.toggle('sheet-open', open && motionOn());
  document.querySelectorAll('.sheet:not([data-drag])').forEach(dragToClose);
}).observe(document.body, { childList: true, subtree: false, attributes: false });
function dragToClose(sh) {
  sh.dataset.drag = '1';
  let y0 = null, dy = 0;
  sh.addEventListener('pointerdown', e => { if (sh.scrollTop > 0 || e.target.closest('input,textarea,select,button:not(.grip)')) return; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; });
  sh.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 110) closeTopOverlay(); };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
}

/* ---------- haptics: a light tick with the sound of an answer ---------- */
const _soundBase = sound;
sound = function (kind) {
  _soundBase(kind);
  if (!motionOn() || !navigator.vibrate) return;
  try { navigator.vibrate(kind === 'right' ? 12 : kind === 'wrong' ? [10, 50, 14] : kind === 'done' ? [12, 60, 12, 60, 20] : 0); } catch (e) { }
};

/* ---------- light theme colour of the system bars follows the iOS background ---------- */
const _applyIOS = applySettings;
applySettings = function () {
  _applyIOS();
  document.documentElement.classList.toggle('still', !motionOn());
  const meta = document.querySelector('meta[name="theme-color"]'), dark = document.documentElement.dataset.theme === 'dark';
  if (meta) meta.content = document.documentElement.dataset.amoled ? '#000000' : dark ? '#0B0B0D' : '#F2F2F7';
};
