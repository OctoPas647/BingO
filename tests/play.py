"""Plays BingO in a headless browser and saves screenshots to build/shots/ (needs Playwright)."""
import pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri(); SHOTS = ROOT / 'build/shots'; SHOTS.mkdir(parents=True, exist_ok=True)
errors = []
def shot(p, name): p.screenshot(path=str(SHOTS / f'{name}.png'), full_page=False)
def setup(p, theme, take_shots):
    """walk through the first-run setup"""
    p.wait_for_selector('.onboarding')
    for i in range(14):
        if p.locator('.losscard').count(): return
        if take_shots: shot(p, f'{theme}-00-setup-{i}')
        if p.locator('[data-k="name"]').count():
            p.fill('[data-k="name"]', 'x' * 41); p.click('[data-ob="next"]'); p.wait_for_selector('.ob-err')
            if take_shots: shot(p, f'{theme}-00-setup-error')
            p.fill('[data-k="name"]', 'Мария П.'); p.fill('[data-k="age"]', '18')
        for seg in p.locator('.onboarding .seg').all():   # a choice with nothing picked yet: take the first option
            if not seg.locator('button.on').count(): seg.locator('button:not([disabled])').first.click()
        p.click('[data-ob="next"]'); p.wait_for_timeout(150)
    p.wait_for_selector('.losscard')
def answer(p, wrong=False):
    """answer the current task: pick an option, or type a number"""
    if p.locator('.opt').count():
        n = p.locator('.opt').count()
        p.locator('.opt').nth(1 if wrong else 0).click()
    elif p.locator('input.field').count():
        p.locator('input.field').fill('999' if wrong else '1')
    elif p.locator('.gap.pick button').count():
        p.locator('.gap.pick button').first.click()
    else:
        p.locator('.gap-in').first.fill('x')
    p.click('[data-main]')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for theme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2, color_scheme=theme, locale='bg-BG')
        p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        p.goto(PAGE); setup(p, theme, theme == 'light'); shot(p, f'{theme}-01-start')
        if theme == 'dark':
            p.click('[data-demo]'); p.wait_for_timeout(300); shot(p, 'dark-02-demo-map')
            p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.click('[data-key="theme"] [data-v="amoled"]'); p.wait_for_timeout(200); shot(p, 'dark-03-amoled-settings')
            p.click('[data-back]'); p.wait_for_timeout(200); p.click('[data-tab="home"]'); p.wait_for_timeout(200); shot(p, 'dark-04-amoled-home'); ctx.close(); continue
        # diagnostic
        p.click('[data-start="diag"]'); p.wait_for_selector('.task'); shot(p, 'light-02-diag-task')
        for i in range(30):
            if not p.locator('[data-main]').count(): break
            answer(p, wrong=(i % 3 == 1)); p.wait_for_timeout(500)  # a quick second tap is ignored on purpose
            if i == 1: shot(p, 'light-03-diag-wrong')
            p.click('[data-main]'); p.wait_for_timeout(120)
        p.wait_for_selector('.result'); shot(p, 'light-04-diag-result')
        p.click('[data-out]'); p.wait_for_selector('.losscard'); shot(p, 'light-05-map')
        # demo learner and focus
        p.click('[data-go="settings"]'); p.wait_for_selector('.settings'); shot(p, 'light-06-settings'); p.click('[data-demo]'); p.click('[data-act="yes"]'); p.wait_for_selector('.losscard'); shot(p, 'light-07-demo-map')
        p.locator('.skrow').first.click(); p.wait_for_timeout(400); shot(p, 'light-08-skill-sheet'); p.click('[data-act="x"]'); p.wait_for_timeout(300)
        p.click('[data-start="focus"]'); p.wait_for_selector('.task'); shot(p, 'light-09-focus-task')
        for i in range(25):
            if not p.locator('[data-main]').count(): break
            answer(p, wrong=(i == 0)); p.wait_for_timeout(500)
            if i == 0: shot(p, 'light-10-focus-wrong')
            if i == 1: shot(p, 'light-11-twin')
            p.click('[data-main]'); p.wait_for_timeout(150)
        p.wait_for_selector('.result'); p.wait_for_timeout(900); shot(p, 'light-12-focus-result')
        p.click('[data-out]'); p.wait_for_selector('.losscard')
        p.click('[data-go="insights"]'); p.wait_for_selector('.misclist, .card'); shot(p, 'light-13-insights')
        p.select_option('#subjSelect', 'bel'); p.wait_for_timeout(200); p.click('[data-back]'); p.wait_for_selector('.losscard'); shot(p, 'light-14-bel-map')
        p.click('[data-tab="stats"]'); p.wait_for_selector('.statcard'); shot(p, 'light-16-stats')
        p.click('[data-tab="profile"]'); p.wait_for_selector('.profhead'); shot(p, 'light-17-profile')
        p.click('[data-tab="home"]'); p.wait_for_selector('[data-forecast]'); p.click('[data-forecast]'); p.wait_for_timeout(400); shot(p, 'light-18-forecast'); p.click('[data-act="x"]'); p.wait_for_timeout(300)
        p.click('[data-start="focus"]'); p.wait_for_selector('.task'); shot(p, 'light-15-bel-task')
        ctx.close()
    b.close()
print('errors:', errors or 'none'); print('shots in', SHOTS)
sys.exit(1 if errors else 0)
