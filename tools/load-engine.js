/* Loads the DOM-free parts of BingO into Node (for checks and the sample class CSV) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
module.exports = function load() {
  const store = {};
  const ctx = {
    console, Math, Date, JSON, Intl, Promise, setTimeout, clearTimeout, URL, Blob: class { },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { onLine: false, language: 'bg' }, document: { documentElement: { dataset: {} }, querySelector: () => null }, matchMedia: () => ({ matches: false, addEventListener() { } }),
    history: { pushState() { }, replaceState() { } }, fetch: async () => { throw new Error('no network in checks'); }
  };
  ctx.window = ctx; ctx.addEventListener = () => { }; ctx.applySettings = () => { }; ctx.SCREENS = {}; /* Shelly's UI (20-ui.js) is not loaded in Node */
  vm.createContext(ctx);
  const run = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  run('engine/vendor/katex.min.js');
  ctx.window.SHELLY_MODULE_JSON = {
    math: JSON.parse(fs.readFileSync(path.join(ROOT, 'content/shelly-modules/matura-math.json'), 'utf8')),
    bel: JSON.parse(fs.readFileSync(path.join(ROOT, 'content/shelly-modules/matura-bel.json'), 'utf8'))
  };
  for (const f of ['engine/js/00-util.js', 'engine/js/02-module-format.js', 'engine/js/03-scoring.js', 'engine/js/10-i18n.js',
    'src/js/50-state.js', 'src/js/51-skills.js', 'src/js/52-math.js', 'src/js/53-bel.js', 'src/js/53b-bel-bank.js', 'src/js/54-ai.js', 'src/js/55-sync.js', 'src/js/56-demo.js', 'src/js/57-review.js', 'src/js/58-onboarding.js', 'src/js/65-forecast.js']) run(f);
  vm.runInContext('buildBanks()', ctx);
  return ctx;
};
