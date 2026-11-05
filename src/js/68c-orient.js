/* ================= Portrait on phones =================
   The Android app locks itself (MainActivity.applyOrientation): portrait on phones, any orientation on tablets,
   unfolded foldables and other big or near-square screens. A browser can't lock a normal page, so on a phone
   turned sideways the web version asks to turn it back; where the browser allows it (installed web app or full
   screen) it locks to portrait. Same rule as the app: the short side under 600 px and the long side more than
   1.45 × the short side. */
const ORIENT = {
  phone() { const a = Math.min(screen.width, screen.height), b = Math.max(screen.width, screen.height); return a < 600 && b / Math.max(1, a) > 1.45; },
  lock() {
    if (window.AndroidUI || !ORIENT.phone()) return;
    try { const o = screen.orientation; if (o && o.lock) o.lock('portrait').catch(() => { }); } catch (e) { }
  }
};
(function orientInit() {
  if (window.AndroidUI) return;   /* the app does it natively */
  const el = document.createElement('div'); el.id = 'rotatehint'; el.setAttribute('role', 'alert');
  const draw = () => { el.innerHTML = `<div><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><rect x="20" y="8" width="24" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 40a18 18 0 0 1-14 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M36 50l0 5 5-1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><b>${typeof L === 'function' ? L('Завърти телефона') : 'Завърти телефона'}</b><span>${typeof L === 'function' ? L('BingO работи изправено на телефон.') : ''}</span></div>`; };
  const upd = () => { const on = ORIENT.phone() && innerWidth > innerHeight; if (on && !el.isConnected) { draw(); document.body.appendChild(el); } document.documentElement.classList.toggle('sideways', on); };
  addEventListener('resize', upd); addEventListener('orientationchange', upd);
  document.addEventListener('fullscreenchange', ORIENT.lock);
  try { if (matchMedia('(display-mode: standalone)').matches) ORIENT.lock(); } catch (e) { }
  if (document.body) upd(); else addEventListener('DOMContentLoaded', upd);
})();
