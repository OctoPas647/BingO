/* ================= Browser back fix =================
   Problem: go() pushes one browser-history entry per screen, but the in-app back button, Android back and
   home() only popped the NAV stack. The history kept stale entries, so the browser Back button seemed
   "stuck" (nothing changed on the first presses) and then suddenly left the app.
   Fix: after any pop that did NOT come from the browser, rewind the history by the same number of entries.
   Loaded after engine/js/20-ui.js and before 99-boot.js. Works for web and for the Android WebView. */
(function () {
  let skip = 0, fromPop = false;
  const rawBack = back, rawHome = home, rawBackTo = backTo;
  const rewind = n => { if (n > 0) { skip++; history.go(-n); } };

  /* capture phase: runs before the engine's own popstate listener */
  window.addEventListener('popstate', e => {
    if (skip > 0) { skip--; e.stopImmediatePropagation(); return; }   /* caused by our own rewind */
    fromPop = true;                                                    /* a real browser Back */
  }, true);

  back = async function () {
    const pop = fromPop; fromPop = false;
    const before = NAV.length;
    const r = await rawBack();
    if (!pop && r === 'popped') rewind(before - NAV.length);
    return r;
  };
  home = function () { const before = NAV.length; rawHome(); rewind(before - NAV.length); };
  backTo = function (screen) { const before = NAV.length; rawBackTo(screen); rewind(before - NAV.length); };
})();
