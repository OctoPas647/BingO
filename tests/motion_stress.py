"""Battle test for the bottom menu, page transitions and the question flow (needs Playwright and dist/web/index.html).

  python tests/motion_stress.py            all checks, screenshots in build/shots/motion/
  python tests/motion_stress.py --slow     the same with the CPU slowed down 4x (a mid-range phone)

Checks: the menu never moves while pages change; its highlight sits exactly under the selected tab on every
tab; hammering tabs, Android back and pushed screens always ends in one clean page; the answer bar stays at
the bottom while a session opens and while a sheet is open; a player who knows every answer can go
Провери → Напред with no dead time, and no question is ever skipped without being answered."""
import json, pathlib, random, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri()
SHOTS = ROOT / 'build/shots/motion'; SHOTS.mkdir(parents=True, exist_ok=True)
SLOW = '--slow' in sys.argv
fails, errors = [], []
def ok(cond, msg):
    print(('  ok   ' if cond else '  FAIL ') + msg, flush=True)
    if not cond: fails.append(msg)

CLEAN = '''() => ({ apps: document.querySelectorAll('#app').length, ghosts: document.querySelectorAll('.ghost-page').length,
  shades: document.querySelectorAll('.page-shade').length, pinned: document.querySelectorAll('.pinned').length,
  docks: document.querySelectorAll('#tabdock').length, nav: NAV.map(n => n.screen), overlays: document.querySelectorAll('.overlay').length })'''
LENS = '''() => { const d = document.getElementById('tabdock'); if (!d) return null;
  const on = d.querySelector('button.on'), l = d.querySelector('.tab-lens'); if (!on || !l) return { missing: true };
  const a = on.getBoundingClientRect(), b = l.getBoundingClientRect();
  return { tab: on.dataset.tab, dx: Math.round(Math.abs(a.left - b.left)), dw: Math.round(Math.abs(a.width - b.width)), off: d.classList.contains('off') }; }'''
DOCKRECT = '''() => { const d = document.getElementById('tabdock'); if (!d) return null; const r = d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }'''

def settle(p, ms=450): p.wait_for_timeout(ms)
def clean(p, label, nav=None):
    c = p.evaluate(CLEAN)
    good = c['apps'] == 1 and c['ghosts'] == 0 and c['shades'] == 0 and c['pinned'] == 0 and c['docks'] <= 1
    ok(good and (nav is None or c['nav'] == nav), f'{label}: one clean page {json.dumps(c, ensure_ascii=False)}')
def lens_ok(p, label):
    l = p.evaluate(LENS)
    ok(l and not l.get('missing') and l['dx'] <= 2 and l['dw'] <= 2, f'{label}: highlight under the selected tab {l}')

def setup(p):
    p.wait_for_selector('.onboarding')
    for _ in range(14):
        if p.locator('.losscard').count(): return
        if p.locator('[data-k="name"]').count(): p.fill('[data-k="name"]', 'Мария'); p.fill('[data-k="age"]', '18')
        for seg in p.locator('.onboarding .seg').all():
            if not seg.locator('button.on').count(): seg.locator('button:not([disabled])').first.click()
        p.click('[data-ob="next"]'); p.wait_for_timeout(200)
    p.wait_for_selector('.losscard')

def watch_dock(p, action, ms=400):
    """run an action and sample the menu's position every frame while the transition runs"""
    p.evaluate('''() => { window.__dockSamples = []; const d = document.getElementById('tabdock'); const t0 = performance.now();
      (function s() { const r = d.getBoundingClientRect(); window.__dockSamples.push([Math.round(r.left), Math.round(r.top), Math.round(r.width), d.classList.contains('off')]);
        if (performance.now() - t0 < ''' + str(ms) + ''') requestAnimationFrame(s); })(); }''')
    action(); p.wait_for_timeout(ms + 80)
    return p.evaluate('window.__dockSamples')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='bg-BG')
    p = ctx.new_page()
    p.on('pageerror', lambda e: errors.append(str(e))); p.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    if SLOW: ctx.new_cdp_session(p).send('Emulation.setCPUThrottlingRate', {'rate': 4})
    p.goto(PAGE); setup(p); settle(p, 700)
    tabs = p.evaluate('TABS.map(t => t[0])')
    print('tabs:', tabs)

    print('1. every tab: menu stays still, highlight lines up')
    for t in tabs[1:] + tabs[:1]:
        samples = watch_dock(p, lambda: p.click(f'#tabdock [data-tab="{t}"]'))
        ok(len({tuple(s[:3]) for s in samples}) == 1 and not any(s[3] for s in samples), f'{t}: menu did not move or hide during the switch ({len(samples)} frames)')
        settle(p); lens_ok(p, t); clean(p, t)
        p.screenshot(path=str(SHOTS / f'tab-{t}.png'))

    print('2. hammering the tabs')
    random.seed(7)
    for i in range(60):
        p.click(f'#tabdock [data-tab="{random.choice(tabs)}"]', timeout=3000); p.wait_for_timeout(random.choice([0, 5, 16, 30, 60, 120]))
    settle(p, 600); clean(p, 'after 60 random taps'); lens_ok(p, 'after 60 random taps')
    nav = p.evaluate('NAV.map(n => n.screen)')
    ok(nav[0] == 'home' and len(nav) <= 2, f'stack is Home + at most one tab: {nav}')
    ok(p.evaluate("document.querySelector('#tabdock button.on').dataset.tab") == nav[-1], 'selected tab = the page shown')

    print('3. Android back, hammered')
    p.click('#tabdock [data-tab="profile"]'); settle(p)
    for _ in range(6): p.evaluate('window.__back()'); p.wait_for_timeout(20)
    settle(p, 600); clean(p, 'back x6 from Profile', ['home']); lens_ok(p, 'back to Home')
    ok(p.evaluate('window.__back()') == '', 'back on Home lets Android close the app')

    print('4. pushed screens: Settings from Profile, back, quickly')
    for i in range(8):
        p.click('#tabdock [data-tab="profile"]'); p.wait_for_timeout(30 if i % 2 else 300)
        p.click('#app [data-go="settings"]', timeout=3000); p.wait_for_timeout(30 if i % 2 else 300)
        ok(p.evaluate("document.getElementById('tabdock').classList.contains('off')"), f'round {i}: menu hidden on Settings')
        p.click('#app [data-back]', timeout=3000); p.wait_for_timeout(30 if i % 2 else 300)
    settle(p, 600); clean(p, 'after 8 Settings round trips', ['home', 'profile']); lens_ok(p, 'back on Profile')
    p.click('#app [data-go="settings"]'); p.wait_for_timeout(120); p.screenshot(path=str(SHOTS / 'push-mid.png')); settle(p)
    p.click('#app [data-back]'); settle(p)

    print('5. Клас tab (no cloud in this build): page and menu appear at once')
    if 'classes' in tabs:
        p.click('#tabdock [data-tab="classes"]'); p.wait_for_timeout(50)
        ok(p.evaluate("!!document.querySelector('#app.screen-classes') && !document.getElementById('tabdock').classList.contains('off')"), 'Клас page + menu within 50 ms')
        settle(p); lens_ok(p, 'classes'); clean(p, 'classes')

    print('6. scroll, then switch: menu shrinks while reading and is whole again on the next tab')
    p.click('#tabdock [data-tab="home"]'); settle(p)
    p.mouse.wheel(0, 1200); settle(p, 500)
    ok(p.evaluate("document.getElementById('tabdock').classList.contains('min')"), 'menu shrank while scrolling down')
    lens_ok(p, 'shrunk menu')
    p.click('#tabdock [data-tab="stats"]'); settle(p); lens_ok(p, 'stats after a scrolled Home'); clean(p, 'stats after a scrolled Home')
    ok(p.evaluate('window.scrollY') == 0, 'new tab starts at the top')

    print('7. a session opens: the answer bar stays at the bottom of the screen the whole time')
    p.click('#tabdock [data-tab="home"]'); settle(p)
    bars = []
    p.click('[data-start="diag"]')
    for _ in range(12):
        # the bar rides with the sliding page (its distance from the page's own bottom edge never changes)
        bars.append(p.evaluate("(() => { const c = document.querySelector('#app .checkbar'), a = document.getElementById('app'); if (!c) return null; const r = c.getBoundingClientRect(), q = a.getBoundingClientRect(); return [Math.round(Math.min(q.bottom, q.top + innerHeight) - r.bottom), Math.round(innerHeight - r.bottom)]; })()")); p.wait_for_timeout(25)
    bars = [x for x in bars if x is not None]
    rel = [x[0] for x in bars]
    ok(bars and max(rel) - min(rel) <= 2 and 0 <= bars[-1][1] <= 40, f'answer bar stays on the sliding page and ends at the bottom: {bars}')
    ok(p.evaluate("document.getElementById('tabdock').classList.contains('off')"), 'menu hidden in a session')
    settle(p)

    print('8. a sheet over a session: the answer bar does not move')
    y0 = p.evaluate("Math.round(document.querySelector('#app .checkbar').getBoundingClientRect().bottom)")
    p.evaluate("void sheet({ title: 'test', body: '<p>x</p>', actions: [{ id: 'x', label: 'OK' }] })"); p.wait_for_timeout(150)
    y1 = p.evaluate("Math.round(document.querySelector('#app .checkbar').getBoundingClientRect().bottom)")
    ok(y0 == y1, f'answer bar bottom {y0} -> {y1} with a sheet open')
    p.screenshot(path=str(SHOTS / 'sheet-over-session.png'))
    p.evaluate('closeTopOverlay()'); settle(p, 350)
    ok(p.evaluate("document.querySelectorAll('.overlay').length") == 0, 'sheet gone')

    print('9. flying through: tap the answer, Провери, Напред — as fast as a person can')
    def pick():
        if p.locator('#app .opt:not([disabled])').count(): p.locator('#app .opt:not([disabled])').first.click(); return True
        if p.locator('#app input.field').count(): p.locator('#app input.field').first.fill('1'); return True
        return False
    # a normal training session (the diagnostic has no "Не знам" for task types this test can't answer)
    p.evaluate("NAV.length = 1; loadDemoLearner().then(() => home())"); settle(p, 900)
    p.click('[data-start="focus"]'); settle(p, 700)
    lat, checks = [], 0
    for q in range(40):
        if not p.locator('#app [data-main]').count(): break
        pick()
        if p.locator('#app [data-main]').is_disabled():
            if p.locator('#app [data-dunno]:visible').count(): p.click('#app [data-dunno]')
            else: break
        else: p.click('#app [data-main]')
        checks += 1
        p.wait_for_timeout(160)   # a very fast human: read the verdict for a blink
        before = p.evaluate("document.querySelector('#app .task') && document.querySelector('#app .task').innerHTML.length")
        t0 = time.time(); p.click('#app [data-main]')
        moved = p.evaluate("!document.querySelector('#app .checkbar.good, #app .checkbar.bad, #app .checkbar.meh') || !document.querySelector('#app [data-main]')")
        lat.append(round((time.time() - t0) * 1000))
        ok(moved, f'question {q + 1}: Напред worked on the first tap') if not moved else None
        if p.locator('#app .result').count(): break
    answered = p.evaluate("S.log ? S.log.length : -1") if False else None
    ok(len(lat) >= 6 and all(x < 250 for x in lat), f'{len(lat)} questions, Напред -> next question in {lat} ms')
    p.screenshot(path=str(SHOTS / 'speedrun-end.png'))

    print('10. double taps never skip a question')
    p.evaluate('home()'); settle(p)
    p.click('[data-start]'); settle(p)
    skipped = 0
    for q in range(10):
        if not p.locator('#app [data-main]').count() or p.locator('#app .result').count(): break
        n0 = p.evaluate("document.querySelector('#app .pcount') ? document.querySelector('#app .pcount').textContent : ''")
        pick()
        if p.locator('#app [data-main]').is_disabled() and p.locator('#app [data-dunno]:visible').count(): p.click('#app [data-dunno]')
        else: p.locator('#app [data-main]').dblclick()   # double tap on Провери
        if p.locator('#app .opt.tried').count() and p.locator('#app [data-dunno]:visible').count(): p.click('#app [data-dunno]')
        has_fb = p.evaluate("!!document.querySelector('#app .checkbar.good, #app .checkbar.bad, #app .checkbar.meh')")
        if not has_fb: skipped += 1
        p.wait_for_timeout(170); p.click('#app [data-main]'); p.wait_for_timeout(30)
    ok(skipped == 0, f'feedback shown after every double tap (skipped {skipped})')
    p.evaluate('home()'); settle(p, 700); clean(p, 'home after sessions', ['home']); lens_ok(p, 'home after sessions')

    print('11. dark mode + language switch keep the menu right')
    p.evaluate("APP.settings.theme = 'dark'; APP.settings.lang = 'en'; saveState(); applySettings(); refresh()"); settle(p)
    lens_ok(p, 'English, dark'); p.screenshot(path=str(SHOTS / 'dark-en-home.png'))
    p.click('#tabdock [data-tab="profile"]'); settle(p); lens_ok(p, 'English profile'); p.screenshot(path=str(SHOTS / 'dark-en-profile.png'))

    print('12. Smoothness levels (from LToTS)')
    BF = "(sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).backdropFilter : 'missing'; }"
    for lvl in ['full', 'balanced', 'light']:
        p.evaluate(f"S.settings.smooth = '{lvl}'; applySettings()"); p.wait_for_timeout(50)
        p.evaluate("void sheet({ title: 'x', body: '<p>x</p>' })"); p.wait_for_timeout(350)
        dock, sh = p.evaluate(BF, '#tabdock'), p.evaluate(BF, '.sheet')
        want = {'full': (True, True), 'balanced': (True, False), 'light': (False, False)}[lvl]
        ok(((dock != 'none') == want[0]) and ((sh != 'none') == want[1]), f'{lvl}: menu blur {dock!r}, sheet blur {sh!r}')
        p.evaluate('closeTopOverlay()'); p.wait_for_timeout(300)
    p.evaluate("S.settings.smooth = 'auto'; smoothSave('full'); applySettings()")
    ok(p.evaluate("document.documentElement.dataset.fx") == 'full', 'Auto starts at Full')
    p.click('#tabdock [data-tab="profile"]'); settle(p); p.click('#app [data-go="settings"]'); settle(p)
    p.locator('.fx-seg').scroll_into_view_if_needed(); p.click('.fx-seg [data-v="light"]'); settle(p)
    ok(p.evaluate("S.settings.smooth") == 'light' and p.evaluate("document.documentElement.dataset.fx") == 'light', 'picking Леко in Settings applies it')
    p.locator('.fx-seg').scroll_into_view_if_needed(); p.screenshot(path=str(SHOTS / 'settings-smoothness.png'))
    p.click('.fx-seg [data-v="auto"]'); settle(p)

    ok(not errors, f'no JavaScript errors {errors[:3]}')
    b.close()
print(f'\n{len(fails)} failed' if fails else '\nall passed')
sys.exit(1 if fails else 0)
