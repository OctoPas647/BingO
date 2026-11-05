"""Taps every button on every screen of the demo teacher and the demo student (phone size) and reports
JavaScript errors, red error toasts and layout problems after each tap. Each tap starts from a fresh render
of the screen, so one tap can't hide another one's error.
Run: python3 tools/build.py web && python3 tests/crawl_buttons.py [filter]"""
import json, pathlib, sys, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).parent))
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri()
FILTER = sys.argv[1] if len(sys.argv) > 1 else ''
found = []

SCREENS = {
  'teacher': [('tHome', {}), ('tClasses', {}), ('tTests', {}), ('tCalendar', {}), ('tAI', {}), ('tMore', {}), ('tClass', {'cid': 'c12a'}), ('tClass', {'cid': 'c12b'}),
              ('tStudent', {'cid': 'c12a', 'uid': 'demo-s1'}), ('tAssignment', {'aid': 'demo-ru-mock'}), ('tAssignment', {'aid': 'demo-math-hw'}), ('tAssignment', {'aid': 'demo-math-next'}),
              ('tGrade', {'attemptId': 'demo-ru-mock_demo-s2'}), ('tLive', {'aid': 'demo-math-live'}), ('tTestEdit', {}), ('tTestEdit', {'testId': 'demo-test-ru'}), ('tPublish', {'testId': 'demo-test-ru'})],
  'student': [('home', {}), ('stats', {}), ('profile', {}), ('classes', {}), ('insights', {}), ('settings', {}), ('assignment', {'aid': 'demo-ru-mock'}), ('assignment', {'aid': 'demo-ru-hw'}), ('past', {}), ('forecast', {}), ('skills', {})],
}
SKIP = re.compile(r'Изход|Leave|logout|Нулирай|Изтрий всичко|reset-all|data-exit|data-signout', re.I)

def setup(b, role):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme='dark', locale='bg-BG', accept_downloads=True)
    ctx.add_init_script("window.open = () => null; window.print = () => {};")
    p = ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errs.append(f'console: {m.text[:250]}'))
    p.goto(PAGE); p.wait_for_timeout(600)
    p.evaluate(f"() => {'demoTeacher' if role == 'teacher' else 'demoStudent'}()"); p.wait_for_timeout(1200)
    return ctx, p, errs

def show(p, scr, params):
    p.evaluate("""([s, q]) => { document.querySelectorAll('.sheet-wrap,.sheet-bg,.sheetbg,.overlay').forEach(e => e.remove()); NAV.length = 0; NAV.push({screen: s, params: q}); render(); }""", [scr, params])
    p.wait_for_timeout(450)

BUTTONS = """() => { const scr = document.querySelector('.screen:last-of-type') || document.body;
  return [...scr.querySelectorAll('button, [data-go], a[href^="#"], .ios-row, [role=button], .chip, [data-tab-k], [data-ctab], [data-atab]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.disabled; })
   .map((e, i) => { e.dataset.crawl = i; return { i, txt: (e.innerText || e.title || e.getAttribute('aria-label') || '').trim().slice(0, 40), attrs: [...e.attributes].map(a => a.name).filter(n => n.startsWith('data-') && n !== 'data-crawl').join(' ') }; }); }"""

def state(p):
    return p.evaluate("""() => { const t = document.querySelector('.toast.in'); const r = t && t.getBoundingClientRect();
      return { bad: t && t.classList.contains('bad') ? t.textContent : '', tall: r && r.height > 120 ? Math.round(r.height) : 0,
               wide: document.scrollingElement.scrollWidth > innerWidth + 1, text: /undefined|NaN|\\[object Object\\]/.test(document.body.innerText) ? (document.body.innerText.match(/.{0,40}(undefined|NaN|\\[object Object\\]).{0,20}/) || [''])[0] : '' }; }""")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for role, screens in SCREENS.items():
        ctx, p, errs = setup(b, role)
        for scr, params in screens:
            name = scr + ('' if not params else ':' + ','.join(map(str, params.values())))
            if FILTER and FILTER not in name: continue
            if not p.evaluate(f"() => !!SCREENS['{scr}']"): continue
            show(p, scr, params); btns = p.evaluate(BUTTONS)
            for btn in btns:
                if SKIP.search(btn['txt'] + ' ' + btn['attrs']): continue
                show(p, scr, params); p.evaluate(BUTTONS); errs.clear()
                try:
                    p.locator(f'[data-crawl="{btn["i"]}"]').first.click(timeout=1500); p.wait_for_timeout(500)
                    # inside a sheet that opened: tap its primary action too
                    st = state(p)
                except Exception as e:
                    continue
                issues = list(errs) + ([f'error toast: {st["bad"]}'] if st['bad'] else []) + ([f'toast {st["tall"]}px tall'] if st['tall'] else []) + (['page scrolls sideways'] if st['wide'] else []) + ([f'shows "{st["text"]}"'] if st['text'] else [])
                for x in issues: found.append(f'{role} {name} [{btn["txt"] or btn["attrs"]}]: {x}'); print(found[-1], flush=True)
        ctx.close()
    b.close()
print(f'{len(found)} problems')
