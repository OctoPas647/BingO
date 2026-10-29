/* Android bridge: system bars follow the app theme, and Android can flush queued feedback. */
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

  /* Android calls AndroidBridge.submitFeedback(function (result) { ... }).
     It flushes BingOFeedback's localStorage queue and reports whether at least one item reached the server. */
  window.AndroidBridge = {
    submitFeedback: function (callback) {
      var done = typeof callback === 'function' ? callback : function () { };
      if (!window.BingOFeedback || typeof window.BingOFeedback.flushFeedback !== 'function') {
        done({ ok: false, sent: 0, error: 'Feedback queue is unavailable' });
        return;
      }
      window.BingOFeedback.flushFeedback().then(function (delivered) {
        done({ ok: !!delivered, sent: delivered ? 1 : 0 });
      }).catch(function (error) {
        done({ ok: false, sent: 0, error: error && error.message ? error.message : String(error) });
      });
    }
  };
})();
