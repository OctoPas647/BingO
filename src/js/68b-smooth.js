/* ================= Smoothness (from LToTS): how much glass the app draws =================
   Settings → Тема → Плавност: Авто · Пълно · Балансирано · Леко, the same levels as LToTS's Look → Smoothness.
   - Пълно (Full): real blur under all the glass (the menu, bars, sheets, toasts, round buttons).
   - Балансирано (Balanced): blur only under the bars that float over the content (the menu, the answer
     bar, the question's top bar); everything else is frosted glass without blur.
   - Леко (Light): frosted glass, no blur anywhere — the cheapest to draw, so the smoothest on any phone.
   - Авто (Automatic): starts at Full and watches how long frames really take while the app is moving
     (scrolling, tapping, page transitions). When frames keep missing (two windows of 120 frames in a row
     with at least 30% of them 1.5× too slow, as LToTS's JankMeter), it steps down one level and stays there.
     The result is remembered for this device ("Измери отново" starts again from Full).
   The level is <html data-fx="full|balanced|light">; zz-ios.css does the rest. */

const FX_LEVELS = ['full', 'balanced', 'light'];
const FX_NAME = { full: 'Пълно', balanced: 'Балансирано', light: 'Леко' };
const FX_KEY = 'bingo.smoothAuto';
const SMOOTH = { auto: 'full' };
try { const a = localStorage.getItem(FX_KEY); if (FX_LEVELS.includes(a)) SMOOTH.auto = a; } catch (e) { }
const smoothMode = () => (S.settings.smooth && S.settings.smooth !== 'auto' && FX_LEVELS.includes(S.settings.smooth) ? S.settings.smooth : 'auto');
const smoothLevel = () => (smoothMode() === 'auto' ? SMOOTH.auto : smoothMode());
function smoothSave(level) { SMOOTH.auto = level; try { localStorage.setItem(FX_KEY, level); } catch (e) { } }
function smoothRecheck() { smoothSave('full'); jank.reset(); applySettings(); }
function smoothApply() { document.documentElement.dataset.fx = smoothLevel(); }

const _applySmooth = applySettings;
applySettings = function () { _applySmooth(); smoothApply(); };

/* ---------- Automatic: a frame meter that only runs while something moves (no battery cost at rest) ---------- */
const jank = {
  frames: 0, late: 0, bad: 0, quietUntil: 0, budget: 0, last: 0, until: 0, raf: 0,
  reset() { this.frames = this.late = this.bad = 0; this.quietUntil = 0; this.budget = 0; },
  add(now, dt) {
    if (!this.quietUntil) this.quietUntil = now + 3000;   /* ignore the first moments (startup) */
    /* the frame budget is the screen's own interval: the shortest frame seen (60, 90, 120 Hz …) */
    if (dt > 4 && (!this.budget || dt < this.budget)) this.budget = Math.max(dt, 6.5);
    if (now < this.quietUntil || !this.budget) return false;
    this.frames++; if (dt > this.budget * 1.5) this.late++;
    if (this.frames < 120) return false;
    const bad = this.late >= 120 * 0.3;
    this.frames = this.late = 0;
    this.bad = bad ? this.bad + 1 : 0;
    if (this.bad >= 2) { this.bad = 0; this.quietUntil = now + 3000; return true; }
    return false;
  }
};
function smoothTooSlow() {
  if (smoothMode() !== 'auto' || !S.settings.glass) return;
  const next = SMOOTH.auto === 'full' ? 'balanced' : 'light';
  if (next !== SMOOTH.auto) { smoothSave(next); smoothApply(); }
}
function jankFrame(t) {
  jank.raf = 0;
  if (document.hidden || t > jank.until) { jank.last = 0; return; }
  if (jank.last) { const dt = t - jank.last; if (dt < 250 && jank.add(t, dt)) smoothTooSlow(); }   /* a longer gap is a pause, not a frame */
  jank.last = t;
  jank.raf = requestAnimationFrame(jankFrame);
}
function jankWake() {
  if (smoothMode() !== 'auto' || SMOOTH.auto === 'light' || !S.settings.glass) return;
  jank.until = performance.now() + 1500;
  if (!jank.raf) jank.raf = requestAnimationFrame(jankFrame);
}
['scroll', 'pointerdown', 'touchmove'].forEach(ev => window.addEventListener(ev, jankWake, { passive: true, capture: true }));

/* ---------- the setting, under Liquid glass in Settings (63-settings.js) ---------- */
function smoothSetting(st) {
  const mode = smoothMode(), now = smoothLevel();
  const opts = [['auto', L('Авто')], ['full', L('Пълно')], ['balanced', L('Балансирано')], ['light', L('Леко')]];
  const text = (mode === 'auto' ? L('Автоматично: сега „{l}“ на това устройство. Следи колко бързо се рисува екранът и сам олекотява стъклото, ако приложението започне да накъсва.', { l: L(FX_NAME[now]) }) + ' ' : '')
    + L({ full: 'Пълно: истинско размазване под цялото стъкло — менюто, лентите, листовете, известията и бутоните.',
      balanced: 'Балансирано: размазване само под лентите над съдържанието (менюто и лентата за отговор); листовете и бутоните са матово стъкло без размазване.',
      light: 'Леко: матово стъкло без никакво размазване. Най-плавното на всеки телефон и най-бързото за решаване на задачи.' }[now]);
  return `<h4 class="fx-title">${L('Плавност')}</h4>
    <div class="seg fx-seg" data-key="smooth">${opts.map(([v, label]) => `<button data-v="${v}" class="${mode === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>
    <p class="muted small">${st.glass ? esc(text) : L('Liquid glass е изключен, затова тази настройка няма значение сега.')}</p>
    ${mode === 'auto' && SMOOTH.auto !== 'full' ? `<button class="btn ghost block" data-smooth-recheck>${icon('reset')}${L('Измери отново от „Пълно“')}</button>` : ''}`;
}
