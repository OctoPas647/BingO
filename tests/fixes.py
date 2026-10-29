"""Browser checks for the testers' feedback fixes (0.3.2). Build first: python tools/build.py web; needs Playwright."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri()
SHOTS = ROOT / 'build/shots'; SHOTS.mkdir(parents=True, exist_ok=True)
results, errors = [], []
def ok(name, cond, extra=''): results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name, extra)

def fresh(b, state=None, raw=None):
    ctx = b.new_context(viewport={'width': 412, 'height': 860}, locale='bg-BG')
    if state is not None or raw is not None:
        val = raw if raw is not None else json.dumps(state)
        ctx.add_init_script(f"try {{ if (!sessionStorage.getItem('seeded')) {{ localStorage.setItem('bingo.v1', {json.dumps(val)}); sessionStorage.setItem('seeded','1'); }} }} catch(e) {{}}")
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(PAGE); p.wait_for_timeout(300)
    return ctx, p

DONE = {'onboarding': {'done': True, 'step': 0}, 'profile': {'name': 'Тест', 'cls': '12а', 'id': 'u1'}}

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. corrupt JSON: app opens, backup kept, notice shown
    ctx, p = fresh(b, raw='{"skills": {broken')
    ok('corrupt save: notice shown', p.locator('.sheet-title', has_text='не можаха').count() == 1)
    keys = p.evaluate("Object.keys(localStorage)")
    ok('corrupt save: backup key kept', any('broken-' in k for k in keys), str(keys))
    ctx.close()

    # 2. old/odd data: app still opens on Home
    ctx, p = fresh(b, state={**DONE, 'subject': 'chem', 'log': None, 'skills': {'math.quad': {'p': 'x'}}, 'settings': {'theme': 'neon'}})
    ok('bad fields: home renders', p.locator('.losscard').count() == 1 and p.locator('.card.error').count() == 0)
    ctx.close()

    # 3. browser back: settings -> back returns home, next back leaves (no stuck presses)
    ctx, p = fresh(b, state=DONE)
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.wait_for_selector('.settings')
    p.click('[data-back]'); p.wait_for_timeout(200)            # in-app back to Profile
    p.click('[data-tab="home"]'); p.wait_for_timeout(300)        # home() pops the rest
    hl = p.evaluate('history.length')
    p.click('[data-tab="stats"]'); p.wait_for_timeout(200)
    p.go_back(); p.wait_for_timeout(300)
    ok('browser back from Stats lands on Home in one press', p.locator('.losscard').count() == 1)
    ok('history has no stale entries', p.evaluate('history.state') is None or 'trap' not in (p.evaluate('history.state') or {}), str(p.evaluate('history.state')))
    ctx.close()

    # 4. session: double tap on Провери keeps the feedback; order needs a move; ± works
    # The diagnostic picks random task variants, so retry until a number task appears.
    seen_number = False
    for attempt in range(3):
        ctx, p = fresh(b, state=DONE)
        p.click('[data-start="diag"]'); p.wait_for_selector('.task')
        for i in range(14):
            if p.locator('input.field.num').count() and not seen_number:
                seen_number = True
                p.fill('input.field.num', '29'); p.click('.signbtn')
                ok('± turns 29 into -29', p.input_value('input.field.num') == '-29')
                p.click('.signbtn'); ok('± again gives 29', p.input_value('input.field.num') == '29')
            if p.locator('.orderlist').count():
                ok('order task: Провери disabled before any move', p.locator('[data-main]').is_disabled())
                p.locator('[data-mv="1"]').first.click()
            if p.locator('.opt').count(): p.locator('.opt').first.click()
            elif p.locator('input.field').count() and not p.input_value('input.field'): p.fill('input.field', '1')
            if p.locator('[data-main]').is_disabled(): break
            before = p.locator('.pcount').inner_text()
            p.locator('[data-main]').dblclick(); p.wait_for_timeout(150)
            if i == 0 and attempt == 0:
                ok('double tap: feedback still shown', p.locator('.checkbar.good, .checkbar.bad').count() == 1 and p.locator('.pcount').inner_text() == before, before)
                p.screenshot(path=str(SHOTS / 'double-tap.png'))
            p.wait_for_timeout(500); p.click('[data-main]'); p.wait_for_timeout(150)
            if p.locator('.result').count(): break
        ctx.close()
        if seen_number: break
    ok('a number task was met', seen_number)

    # 5. no repeated questions in a one-skill session (Дебелянов)
    ctx, p = fresh(b, state={**DONE, 'subject': 'bel'})
    p.evaluate("go('session', { subj: 'bel', mode: 'skill', skill: 'lit' })"); p.wait_for_selector('.task')
    prompts = []
    for i in range(20):
        if not p.locator('[data-main]').count(): break
        prompts.append(p.locator('.task .prompt').first.inner_text())
        if p.locator('.opt').count(): p.locator('.opt').nth(1).click()
        elif p.locator('.mi.l').count():
            for k in range(p.locator('.mi.l').count()): p.locator('.mi.l').nth(k).click(); p.locator('.mi.r').nth(k).click()
        p.click('[data-main]'); p.wait_for_timeout(500); p.click('[data-main]'); p.wait_for_timeout(150)
    ok('lit session: no repeated question', len(prompts) == len(set(prompts)), f'{len(prompts)} tasks; dups: {[x for x in set(prompts) if prompts.count(x) > 1]}')
    ctx.close()

    # 6. demo learner asks first when there is real progress; restore brings it back
    ctx, p = fresh(b, state={**DONE, 'sessions': 2, 'log': [{'t': 1, 'timestamp': '2026-10-01T10:00:00Z', 'student_id': 'u1', 'subject': 'Математика', 'task_id': 'x', 'correct': 1}]})
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.click('[data-demo]'); p.wait_for_timeout(300)
    ok('demo: confirmation shown', p.locator('.sheet-title', has_text='демо').count() == 1)
    p.click('[data-act="no"]'); p.wait_for_timeout(300)
    ok('demo: cancel keeps real progress', p.evaluate("S.sessions") == 2 and p.evaluate("S.log.length") == 1)
    p.click('[data-demo]'); p.click('[data-act="yes"]'); p.wait_for_selector('.losscard')
    ok('demo: loaded after yes', p.evaluate("S.profile.name") == 'Демо ученик')
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.wait_for_selector('[data-restore]')
    p.click('[data-restore]'); p.wait_for_selector('.losscard')
    ok('demo: restore brings real data back', p.evaluate("S.profile.name") == 'Тест')
    ctx.close()

    # 7. settings refuse invalid values
    ctx, p = fresh(b, state=DONE)
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]')
    p.fill('[data-f="settings.sheetUrl"]', 'https://example.com/x')
    ok('settings: bad Sheet URL shows an error', p.locator('.fld-err:not([hidden])').count() == 1)
    ok('settings: bad Sheet URL not saved', p.evaluate("S.settings.sheetUrl") == '')
    p.screenshot(path=str(SHOTS / 'settings-invalid.png'))
    p.fill('[data-f="settings.sheetUrl"]', 'https://script.google.com/macros/s/abc/exec')
    ok('settings: good Sheet URL saved', p.evaluate("S.settings.sheetUrl").endswith('/exec'))
    ctx.close()

    # 8. Sheets: a server error keeps the rows, a confirmed send removes them
    ctx, p = fresh(b, state={**DONE, 'settings': {'sheetUrl': 'https://script.google.com/macros/s/abc/exec'}})
    mode = {'v': 'error'}
    def handle(route):
        if mode['v'] == 'error': route.fulfill(status=500, body='oops')
        else: route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='{"ok":true,"added":1}')
    p.route('https://script.google.com/**', handle)
    p.evaluate("S.queue.push({ timestamp: 'x', student_id: 'u1', session_id: 's', task_id: 't' })")
    p.evaluate("flushToSheet()"); p.wait_for_timeout(400)
    ok('sheets: server error keeps the row', p.evaluate("S.queue.length") == 1)
    mode['v'] = 'ok'; p.evaluate("flushFails = 0"); p.evaluate("flushToSheet()"); p.wait_for_timeout(400)
    ok('sheets: confirmed send clears the queue', p.evaluate("S.queue.length") == 0)
    ctx.close()

    # 9. confetti is removed when leaving the screen
    ctx, p = fresh(b, state=DONE)
    p.evaluate("confetti()"); p.wait_for_timeout(50)
    ok('confetti: running', p.locator('canvas.confetti').count() == 1)
    p.click('[data-tab="stats"]'); p.wait_for_timeout(100)
    ok('confetti: gone on the next screen', p.locator('canvas.confetti').count() == 0)
    ctx.close()

    # 10. quadratic explanation has no "--"
    ctx, p = fresh(b, state=DONE)
    bad = p.evaluate("Array.from({length: 300}, (_, i) => genMathTask('quad', 1, i).explain).filter(e => /\\d--\\d/.test(e)).length")
    ok('quad explanation: no double minus', bad == 0, str(bad))
    ctx.close()

    # 11. MON forecast scale uses the official boundaries
    ctx, p = fresh(b, state=DONE)
    grades = p.evaluate("[29.75, 30, 40.5, 40.75, 62.25, 62.5, 83.75, 84, 94.75, 95].map(p => gradeOf(p)[1])")
    ok('MON scale: boundary grades', grades == ['Слаб 2', 'Среден 3', 'Среден 3', 'Добър 4', 'Добър 4', 'Мн. добър 5', 'Мн. добър 5', 'Мн. добър 5', 'Мн. добър 5', 'Отличен 6'], str(grades))
    scale = p.evaluate("fcScale({ lo: 10, hi: 90, pts: 50 })")
    ok('MON scale: ticks 2-6', all(f'>{g}</span>' in scale for g in ['2', '3', '4', '5', '6']), scale)
    ok('MON scale: band colours from MON_SCALE', 'linear-gradient' in scale and '40.75%' in scale, scale)
    ctx.close()

    # 12. MON scale: a 90-point forecast is Много добър 5, a 98-point forecast is Отличен 6
    ctx, p = fresh(b, state=DONE)
    ok('MON scale: 90 t. forecast is Много добър 5', p.evaluate("gradeText({ conf: 'high', pts: 90, lo: 90, hi: 90 })") == 'Мн. добър 5')
    ok('MON scale: 98 t. forecast is Отличен 6', p.evaluate("gradeText({ conf: 'high', pts: 98, lo: 98, hi: 98 })") == 'Отличен 6')
    ctx.close()
    b.close()

print('page errors:', errors or 'none')
print(sum(r[1] for r in results), '/', len(results), 'passed')
sys.exit(0 if all(r[1] for r in results) and not errors else 1)
