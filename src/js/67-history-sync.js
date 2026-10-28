/* ================= Sheet history fix =================
   Problem: closing a bottom sheet calls syncHistory(), which removes the history trap with
   history.back(). The sheet promise then resolves and the caller immediately opens a new screen
   with go(). Before the queued history.back() is processed, render() calls syncHistory() again,
   sees that no trap exists and pushes a new one. The queued back then removes that new entry,
   so the browser Back button can leave the app.
   Fix: while a history rewind is pending (histSkip > 0), do not push or pop history. Remember
   that a sync is pending and run it after the queued popstate has been handled.
   Loaded after engine/js/20-ui.js and before 99-boot.js. Works for web and the Android WebView. */
(function () {
  let pending = false;
  const rawSync = syncHistory;

  syncHistory = function () {
    if (histSkip > 0) { pending = true; return; }
    rawSync();
  };

  /* The engine's own popstate listener runs first and consumes histSkip. */
  window.addEventListener('popstate', () => {
    if (histSkip > 0) return;
    if (pending) { pending = false; rawSync(); }
  });
})();
