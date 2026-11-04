/* Android bridge: system bars follow the app theme. (Queued feedback is sent by the web app itself
   on start and when the connection comes back, see 55-sync.js and 99-boot.js.) */
(function () {
  var UI = window.AndroidUI;
  if (UI) {
    var last = '';
    var sync = function () {
      var cs = getComputedStyle(document.documentElement), bg = (cs.getPropertyValue('--bg') || '').trim();
      if (!/^#[0-9a-f]{6}$/i.test(bg)) return;
      var r = parseInt(bg.substr(1, 2), 16) / 255, g = parseInt(bg.substr(3, 2), 16) / 255, b = parseInt(bg.substr(5, 2), 16) / 255;
      var dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45, key = bg + dark;
      if (key !== last) { last = key; try { UI.bars(bg, dark); } catch (e) { } }
    };
    document.addEventListener('DOMContentLoaded', function () {
      sync();
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] });
      if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { setTimeout(sync, 50); });
    });
  }
})();
