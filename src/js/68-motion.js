/* ================= Motion: the app should feel like a native iOS app — and never get in the way =================
   Rules (0.8.1 rework):
   - Speed first. Nothing waits for an animation: the new page is live and tappable from its first frame,
     and a tap during a transition finishes the running one at once before the next starts.
   - Pages: the bottom-menu tabs cross-fade in 120 ms; a pushed screen slides in from the right (260 ms),
     back slides it out; a question session or past exam comes up from the bottom like a modal (300 ms).
   - During a transition both pages are "pinned": each becomes a viewport-sized box scrolled to its own
     position. Their fixed and sticky bars (answer bar, nav bar) therefore stay exactly where they are,
     instead of jumping to the bottom of the page the way they did when the whole page was transformed.
   - The bottom menu is not part of the pages at all (#tabdock, 64-nav.js), so it never moves with them.
   - Below-the-fold cards ease in as they scroll into view; what is on screen at once appears at once.
   - All motion is off with Settings → Анимации or the system's "reduce motion". */

const motionOn = () => APP.settings.motion !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPRING = 'cubic-bezier(.32,.72,0,1)';
const MODAL_SCREENS = ['session', 'pastexam', 'onboarding'];
const PAGE_MS = { tab: 120, push: 260, pop: 240, present: 300, dismiss: 260 };
/* screens that are tabs of one menu: the student's bottom menu, or the teacher's */
const tabGroup = s => (isTabScreen(s) ? 'student' : typeof T_ROOTS !== 'undefined' && T_ROOTS.includes(s) ? 'teacher' : null);

function transitionKind(from, to) {
  if (!from.screen || (from.screen === to.screen && from.depth === to.depth)) return null;
  const g = tabGroup(from.screen);
  if (g && g === tabGroup(to.screen)) return 'tab';
  if (to.depth > from.depth) return MODAL_SCREENS.includes(to.screen) ? 'present' : 'push';
  if (to.depth < from.depth) return MODAL_SCREENS.includes(from.screen) ? 'dismiss' : 'pop';
  return 'tab';   /* one screen replaced by another at the same depth */
}

/* ---------- page transitions ---------- */
let lastNav = { depth: 0, screen: null }, renderSeq = 0, TR = null;
function endTransition(T = TR) {
  if (!T || T.over) return;
  T.over = true; if (TR === T) TR = null;
  T.anims.forEach(a => { try { a.cancel(); } catch (e) { } });
  T.ghost.remove(); if (T.shade) T.shade.remove();
  T.root.classList.remove('pinned'); T.root.style.zIndex = '';
  if (T.root === root) window.scrollTo(0, T.y);
}
function animatePages(kind, ghost, oldY, y) {
  ghost.removeAttribute('id'); ghost.classList.add('ghost-page'); ghost.inert = true;
  document.body.insertBefore(ghost, root);
  ghost.scrollTop = oldY;
  root.classList.add('pinned'); root.scrollTop = y;
  const back = kind === 'pop' || kind === 'dismiss';
  const shade = kind === 'tab' ? null : document.body.appendChild(Object.assign(document.createElement('div'), { className: 'page-shade' }));
  ghost.style.zIndex = back ? '32' : '30'; root.style.zIndex = back ? '30' : '32'; if (shade) shade.style.zIndex = '31';
  const T = TR = { root, ghost, shade, y, anims: [], over: false };
  const opt = { duration: PAGE_MS[kind], easing: SPRING, fill: 'both' };
  const A = (el, frames, o = opt) => { const a = el.animate(frames, o); T.anims.push(a); return a; };
  let last;
  if (kind === 'tab') last = A(root, [{ opacity: 0 }, { opacity: 1 }], { ...opt, easing: 'ease-out' });
  else if (kind === 'push') {
    A(ghost, [{ transform: 'none' }, { transform: 'translateX(-30%)' }]);
    A(shade, [{ opacity: 0 }, { opacity: .14 }]);
    last = A(root, [{ transform: 'translateX(100%)' }, { transform: 'none' }]);
  } else if (kind === 'pop') {
    A(root, [{ transform: 'translateX(-30%)' }, { transform: 'none' }]);
    A(shade, [{ opacity: .14 }, { opacity: 0 }]);
    last = A(ghost, [{ transform: 'none' }, { transform: 'translateX(100%)' }]);
  } else if (kind === 'present') {
    A(shade, [{ opacity: 0 }, { opacity: .22 }]);
    last = A(root, [{ transform: 'translateY(100%)' }, { transform: 'none' }]);
  } else {
    A(shade, [{ opacity: .22 }, { opacity: 0 }]);
    last = A(ghost, [{ transform: 'none' }, { transform: 'translateY(100%)' }]);
  }
  last.finished.then(() => endTransition(T), () => { });
}

/* render() replaces engine/js/20-ui.js's: same job (a fresh element per screen, history, scroll), plus the
   bottom menu and the transitions. The transition starts as soon as the screen has drawn what it draws
   synchronously, so a screen that loads from the cloud (Клас) moves in at once with its loading state. */
render = async function (restore) {
  const e = NAV[NAV.length - 1]; if (!e) return;
  const seq = ++renderSeq;
  endTransition();
  e.guard = null;
  document.querySelectorAll('canvas.confetti').forEach(c => c.remove()); /* confetti belongs to the screen that started it */
  syncHistory();
  const oldRoot = root, oldY = window.scrollY, from = lastNav, to = { depth: NAV.length, screen: e.screen };
  lastNav = to;
  const fresh = document.createElement('div'); fresh.id = 'app'; fresh.className = 'screen screen-' + e.screen;
  if (isTabScreen(e.screen)) fresh.classList.add('has-nav');
  root.replaceWith(fresh); root = fresh;
  syncDock(e.screen);
  const y = restore ? e.y || 0 : 0;
  const job = (async () => SCREENS[e.screen](root, e.params, e))();
  decorate(root);
  const kind = transitionKind(from, to);
  if (kind && motionOn() && oldRoot && oldRoot.childElementCount) animatePages(kind, oldRoot, oldY, y);
  else window.scrollTo(0, y);
  try { await job; }
  catch (err) {
    console.error(err);
    if (seq === renderSeq) root.innerHTML = `<div class="pad"><div class="card error">${esc(t('err.screen'))}<br><small>${esc(err.message)}</small></div><button class="btn" onclick="home()">${esc(t('nav.home'))}</button></div>`;
  }
  if (seq !== renderSeq) return;
  decorate(root);
  if (TR) TR.root.scrollTop = y; else if (restore && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
};

/* ---------- what every new screen gets (safe to run twice: before and after a screen's async part) ---------- */
const tabPrev = {};
function decorate(el) {
  if (!el) return;
  /* a large title under the nav bar of a pushed screen (Settings, Mistakes and data …) */
  const tb = el.querySelector(':scope > .topbar'), tt = tb && tb.querySelector('.tb-title');
  if (tb && tt && !el.querySelector('.large-title') && !el.classList.contains('screen-session') && !el.classList.contains('screen-pastexam')) {
    tb.insertAdjacentHTML('afterend', `<h1 class="large-title">${tt.innerHTML}</h1>`);
  }
  /* a tab bar drawn inside the page (the teacher's part on a phone): its lens slides from the previous tab */
  el.querySelectorAll('.tabbar').forEach(bar => {
    if (bar.dataset.lens) return; bar.dataset.lens = '1';
    const btns = [...bar.querySelectorAll('button')], i = btns.findIndex(b => b.classList.contains('on'));
    if (i < 0 || !btns[i].offsetWidth) return;
    bar.insertAdjacentHTML('afterbegin', '<i class="tab-lens" aria-hidden="true"></i>');
    const key = bar.className, prev = btns[tabPrev[key]];
    if (prev && prev !== btns[i] && motionOn()) {
      prev.classList.add('on'); btns[i].classList.remove('on'); placeLens(bar, false);
      prev.classList.remove('on'); btns[i].classList.add('on');
      requestAnimationFrame(() => placeLens(bar, true));
    } else placeLens(bar, false);
    tabPrev[key] = i;
  });
  segThumbs(el);
  reveal(el);
  onScroll();
  /* the ring on Home and the result screens draws itself */
  if (motionOn()) el.querySelectorAll('.ring .fill:not([data-drawn])').forEach(c => {
    c.dataset.drawn = '1';
    const to = c.getAttribute('stroke-dashoffset'), from = c.getAttribute('stroke-dasharray');
    c.style.transition = 'none'; c.setAttribute('stroke-dashoffset', from);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = ''; c.setAttribute('stroke-dashoffset', to); }));
  });
}

/* ---------- segmented controls: a sliding thumb ---------- */
const segLast = {};
function segThumbs(el) {
  el.querySelectorAll('.seg:not(.list)').forEach(seg => {
    if (seg.dataset.thumb) return;
    const on = seg.querySelector('button.on'); if (!on) return;
    seg.dataset.thumb = '1';
    const th = document.createElement('i'); th.className = 'seg-thumb'; seg.prepend(th);
    const place = b => { th.style.left = b.offsetLeft + 'px'; th.style.width = b.offsetWidth + 'px'; };
    const key = seg.dataset.key || '';
    const prev = segLast[key] != null ? seg.querySelectorAll('button')[segLast[key]] : null;
    th.style.transition = 'none'; place(prev || on); th.offsetWidth; th.style.transition = '';
    if (prev && prev !== on) requestAnimationFrame(() => place(on));
    segLast[key] = [...seg.querySelectorAll('button')].indexOf(on);
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { place(b); segLast[key] = [...seg.querySelectorAll('button')].indexOf(b); } });
  });
}

/* ---------- cards below the fold ease in as they come into view ---------- */
const REVEAL_SEL = '.card, .skrow, .statcard, .delta, .rv, .ios-group, .losscard, .sklist, .review-list, .res-hero';
let revealObs = null;
function reveal(el) {
  if (!motionOn() || !('IntersectionObserver' in window)) return;
  revealObs = revealObs || new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); } }), { rootMargin: '0px 0px -4% 0px' });
  el.querySelectorAll(REVEAL_SEL).forEach(n => {
    if (n.dataset.rv || n.closest('.tabbar, .checkbar, .sheet, .reveal')) return;
    n.dataset.rv = '1';
    if (n.getBoundingClientRect().top < innerHeight) return;   /* on screen now: no delay, no fade */
    n.classList.add('reveal'); revealObs.observe(n);
  });
}
motionReveal = el => {
  if (!motionOn()) return;
  el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: SPRING });
};

/* ---------- scroll: glass bars, large titles, the tab bar shrinking ---------- */
let lastY = 0, ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const el = root; if (!el) return;
    const y = Math.max(0, el.classList.contains('pinned') ? el.scrollTop : window.scrollY);
    el.querySelectorAll(':scope > .apphead, :scope > .topbar').forEach(b => b.classList.toggle('scrolled', y > 2));
    const lt = el.querySelector('.large-title'), tb = el.querySelector(':scope > .topbar');
    if (lt) {
      const p = Math.min(1, y / 44);
      lt.style.setProperty('--lt-op', String(1 - p)); lt.style.setProperty('--lt-scale', String(1 - p * 0.08));
      if (tb) tb.style.setProperty('--tb-title', String(Math.max(0, Math.min(1, (y - 26) / 22))));
    } else if (tb) tb.style.setProperty('--tb-title', '1');
    [DOCK.el, el.querySelector('.tabbar')].forEach(tab => {
      if (!tab) return;
      if (y > 90 && y - lastY > 6) tab.classList.add('min'); else if (lastY - y > 6 || y < 40) tab.classList.remove('min');
    });
    lastY = y;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- sheets: pull down to close ----------
   (The page behind no longer shrinks: scaling the page moved its fixed answer bar and menu.) */
new MutationObserver(() => document.querySelectorAll('.sheet:not([data-drag])').forEach(dragToClose)).observe(document.body, { childList: true });
function dragToClose(sh) {
  sh.dataset.drag = '1';
  let y0 = null, dy = 0;
  sh.addEventListener('pointerdown', e => { if (sh.scrollTop > 0 || e.target.closest('input,textarea,select,button:not(.grip),a,label')) return; y0 = e.clientY; dy = 0; });
  sh.addEventListener('pointermove', e => {
    if (y0 == null) return; dy = Math.max(0, e.clientY - y0);
    if (dy > 4) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; }
  });
  const end = () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 110) closeTopOverlay(); dy = 0; };
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
