/* ================= Start ================= */
(function boot() {
  root = document.getElementById('app');
  loadState(); applySettings(); buildBanks();
  history.replaceState({ d: 1 }, '');
  NAV.push({ screen: onboardingNeeded() ? 'onboarding' : 'home', params: {} });
  render();
  scheduleFlush();
  if (window.AndroidFiles && window.AndroidFiles.ready) window.AndroidFiles.ready();
})();
