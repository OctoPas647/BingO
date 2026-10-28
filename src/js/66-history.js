/* ================= Bottom menu: keep browser history in sync =================
   Engine's syncHistory() removes the history "trap" with an asynchronous history.back().
   If a new screen pushes a trap before that pop arrives, the queued back removes the NEW trap
   and history drifts; a later browser Back can then close the app.

   Fix: while a trap removal is still running, do not push or remove another trap. After the
   removal's popstate arrives, add a trap back if the app still needs one. This fixes fast
   switches between Начало, Статистики and Профил in the bottom menu. */
(function () {
  let removing = false;
  syncHistory = function () {
    if (removing) return;
    if (needTrap() && !histTrap) { history.pushState({ trap: 1 }, ''); histTrap = true; return; }
    if (!needTrap() && histTrap) { histTrap = false; removing = true; histSkip++; history.back(); }
  };
  /* Capture phase: runs before the engine's own popstate listener. */
  window.addEventListener('popstate', () => {
    if (!removing) return;
    removing = false;
    /* The engine's handler returns early for this own-removal pop, so add the trap back
       after it if the app still needs one. */
    setTimeout(() => { if (!removing) syncHistory(); }, 0);
  }, true);
})();
