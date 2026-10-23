/* ================= Guards: demo confirmation and a short delay after "Провери" =================
   Capture-phase listeners, so the screens (60-home.js, 63-settings.js, 61-session.js) stay unchanged. */

/* 1. "Демо ученик" replaces the skill map, the answers, the name and the unsent queue: ask first when real progress exists */
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-demo]'); if (!b) return;
  const hasReal = S.log.length > 0 || S.queue.length > 0 || S.sessions > 0;
  if (!hasReal) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const ok = await confirmBox('Да заменим ли прогреса ти с демо?', 'Демо ученикът ще замени картата на уменията, всички отговори, името ти и неизпратените данни на това устройство. Това не може да се върне.', 'Замени', true);
  if (!ok) return;
  simulateLearner();
  const cur = NAV[NAV.length - 1];
  if (cur && cur.screen === 'settings') { toast('Зареден е демо ученик'); return home(); }
  toast('Зареден е демо ученик с история от 6 дни'); refresh();
}, true);

/* 5. The same button is "Провери" and then "Напред": a fast double tap skipped the feedback. Ignore taps for a moment after checking. */
const CHECK_DELAY_MS = 600;
let lastCheckAt = 0;
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.checkbar [data-main]'); if (!b) return;
  if (b.textContent.trim() === 'Провери') { lastCheckAt = Date.now(); return; }
  if (Date.now() - lastCheckAt < CHECK_DELAY_MS) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
/* checking with the keyboard (Enter) starts the same delay */
document.addEventListener('submit-answer', () => { lastCheckAt = Date.now(); }, true);
