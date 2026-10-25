/* ================= Start ================= */
(function boot() {
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
