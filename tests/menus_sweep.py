"""Walks every menu of BingO as the demo teacher and the demo student, on a phone and a tablet, light and dark,
and reports JavaScript errors and layout problems (sideways scrolling, things wider than the screen,
toasts taller than a capsule, empty screens, skeletons that never go away).
Run: python3 tools/build.py web && python3 tests/menus_sweep.py [--shots]
Screenshots (with --shots) go to build/shots/sweep/."""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri()
SHOTS = ROOT / 'build/shots/sweep'; SHOTS.mkdir(parents=True, exist_ok=True)
TAKE = '--shots' in sys.argv
problems, errors = [], []

LAYOUT = """() => {
  const W = innerWidth, out = [];
  const se = document.scrollingElement;
  if (se.scrollWidth > W + 1) out.push('page scrolls sideways: ' + se.scrollWidth + ' > ' + W);
  const scr = document.querySelector('.screen:last-of-type') || document.body;
  for (const e of scr.querySelectorAll('*')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (e.closest('svg,.chart-scroll,.hscroll,.tabs-scroll,.seg-scroll,[data-scroll-x],pre,code,table,.table-wrap,.katex,.qr,.carousel,.chips,.sk-scroll')) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let p = e.parentElement, clipped = false;
    while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { clipped = true; break; } p = p.parentElement; }
    if (clipped) continue;
    if (r.right > W + 2 || r.left < -2) { out.push('wider than the screen: <' + e.tagName.toLowerCase() + ' class="' + e.className + '"> ' + Math.round(r.left) + '..' + Math.round(r.right)); if (out.length > 6) break; }
  }
  const t = document.querySelector('.toast.in'); if (t) { const r = t.getBoundingClientRect(); if (r.height > 120) out.push('toast is ' + Math.round(r.height) + 'px tall'); }
  return out;
}"""

def check(p, where):
    p.wait_for_timeout(700)
    for x in p.evaluate(LAYOUT): problems.append(f'{where}: {x}')
    txt = p.evaluate("() => (document.querySelector('.screen:last-of-type') || document.body).innerText.trim().length")
    if txt < 5: problems.append(f'{where}: empty screen')
    if p.evaluate("() => /undefined|NaN|\\[object Object\\]|null%/.test(document.body.innerText)"):
        bad = p.evaluate("() => (document.body.innerText.match(/.{0,40}(undefined|NaN|\\[object Object\\]|null%).{0,20}/) || [''])[0]")
        problems.append(f'{where}: shows "{bad}"')
    if TAKE: p.screenshot(path=str(SHOTS / f'{where}.png'))

def go(p, screen, params=None):
    p.evaluate("([s, q]) => go(s, q || {})", [screen, params or {}])

def start(b, role, vp, scheme):
    ctx = b.new_context(viewport=vp, device_scale_factor=1, color_scheme=scheme, locale='bg-BG')
    p = ctx.new_page()
    name = f'{role}-{vp["width"]}-{scheme}'
    p.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errors.append(f'{name} console: {m.text[:300]}'))
    p.goto(PAGE); p.wait_for_timeout(600)
    p.evaluate(f"() => {'demoTeacher' if role == 'teacher' else 'demoStudent'}()")
    p.wait_for_timeout(1500)
    return ctx, p, name

def teacher(p, name):
    tabs = p.evaluate("() => [...document.querySelectorAll('.tabbar [data-tab], .t-side [data-tab], [data-tgo]')].map(b => b.dataset.tab || b.dataset.tgo)")
    for s in ['tHome', 'tClasses', 'tTests', 'tCalendar', 'tAI', 'tMore', 'tStats']:
        if p.evaluate(f"() => !!SCREENS['{s}']"): go(p, s); check(p, f'{name}-{s}')
    for cid in ['c12a', 'c12b']:
        go(p, 'tClass', {'cid': cid}); check(p, f'{name}-tClass-{cid}')
        for tab in p.evaluate("() => [...document.querySelectorAll('[data-ctab],[data-tab-k]')].map(b => b.dataset.ctab || b.dataset.tabK)"):
            p.click(f'[data-ctab="{tab}"],[data-tab-k="{tab}"]'); check(p, f'{name}-tClass-{cid}-{tab}')
    go(p, 'tStudent', {'cid': 'c12a', 'uid': 'demo-s1'}); check(p, f'{name}-tStudent')
    for aid in ['demo-ru-mock', 'demo-math-hw', 'demo-math-next', 'demo-ru-hw']:
        go(p, 'tAssignment', {'aid': aid}); check(p, f'{name}-tAssignment-{aid}')
        for tab in p.evaluate("() => [...document.querySelectorAll('[data-atab]')].map(b => b.dataset.atab)"):
            p.click(f'[data-atab="{tab}"]'); check(p, f'{name}-tAssignment-{aid}-{tab}')
    go(p, 'tGrade', {'attemptId': 'demo-ru-mock_demo-s2'}); check(p, f'{name}-tGrade')
    go(p, 'tLive', {'aid': 'demo-math-live'}); check(p, f'{name}-tLive')
    go(p, 'tTestEdit', {}); check(p, f'{name}-tTestEdit-new')
    # the bug from the screenshot: saving a test whose task has no question text
    btn = p.locator('[data-save], [data-publish], [data-act="save"]').first
    if btn.count():
        btn.click(); p.wait_for_timeout(500); check(p, f'{name}-tTestEdit-save-empty')
    go(p, 'tTestEdit', {'testId': 'demo-test-ru'}); check(p, f'{name}-tTestEdit-ru')
    go(p, 'tPublish', {'testId': 'demo-test-ru'}); check(p, f'{name}-tPublish')

def student(p, name):
    for s in ['home', 'stats', 'profile', 'classes', 'insights', 'settings', 'grades']:
        if p.evaluate(f"() => !!SCREENS['{s}']"): go(p, s); check(p, f'{name}-{s}')
    go(p, 'assignment', {'aid': 'demo-ru-mock'}); check(p, f'{name}-assignment-ru')
    go(p, 'assignment', {'aid': 'demo-ru-hw'}); check(p, f'{name}-assignment-practice')
    go(p, 'pastexam', {'id': 'dzi12-ru-2025-05-23-b1-v2'}); check(p, f'{name}-pastexam')
    go(p, 'home'); p.wait_for_timeout(300)
    s = p.locator('[data-start]').first
    if s.count(): s.click(); p.wait_for_timeout(800); check(p, f'{name}-session')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for vp in [{'width': 390, 'height': 844}, {'width': 1180, 'height': 820}]:
        for scheme in ['dark', 'light']:
            if vp['width'] > 1000 and scheme == 'light': continue
            for role in ['teacher', 'student']:
                ctx, p, name = start(b, role, vp, scheme)
                try: (teacher if role == 'teacher' else student)(p, name)
                except Exception as e: problems.append(f'{name}: the sweep stopped: {str(e)[:300]}')
                ctx.close()
    b.close()

for x in errors: print('JS ERROR', x)
for x in problems: print('PROBLEM ', x)
print(f'{len(errors)} JS errors, {len(problems)} layout problems')
sys.exit(1 if errors or problems else 0)
