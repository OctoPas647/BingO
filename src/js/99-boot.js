/* ================= Start ================= */
(function boot() {
  /* Test hook: ?testSeed=123 makes task generation repeatable. Without it, the app keeps its
     normal randomness. The seed is read early so every later Math.random() call is deterministic. */
  const testSeed = window.__BINGO_TEST_SEED;
  if (testSeed !== null && testSeed !== undefined && String(testSeed).trim() !== '') {
    let a = 2166136261;
    for (const ch of String(testSeed)) { a ^= ch.charCodeAt(0); a = Math.imul(a, 16777619); }
    a >>>= 0;
    if (!a) a = 1;
    Math.random = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  root = document.getElementById('app');
  loadState(); applySettings(); buildBanks();
  history.replaceState({ d: 1 }, '');
  NAV.push({ screen: onboardingNeeded() ? 'onboarding' : 'home', params: {} });
  render();
  if (STATE_NOTICE) sheet({
    title: 'Запазените данни не можаха да се прочетат',
    body: `<p>${L('Файлът с отговорите ти на това устройство е повреден, затова BingO започва начисто.')}</p><p class="muted small">${STATE_NOTICE.backup ? L('Старите данни не са изтрити — запазени са като резервно копие ({k}).', { k: esc(STATE_NOTICE.backup) }) : L('Резервно копие не можа да се запише (няма място).')}</p>`,
    actions: [{ id: 'ok', label: 'Разбрах', kind: 'primary' }]
  });
  scheduleFlush();
  if (window.AndroidFiles && window.AndroidFiles.ready) window.AndroidFiles.ready();
})();
