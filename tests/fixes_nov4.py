"""Browser checks for the 4 Nov 2026 Notion fixes. Build first: python tools/build.py web; needs Playwright.
Waits for conditions (wait_for_function / wait_for_selector) instead of fixed sleeps, so slow PCs don't fail it."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist/web/index.html').as_uri()
results, errors = [], []
def ok(name, cond, extra=''): results.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name, extra)

def fresh(b, state=None, extra_keys=None):
    ctx = b.new_context(viewport={'width': 412, 'height': 860}, locale='bg-BG')
    seed = {}
    if state is not None: seed['bingo.v1'] = json.dumps(state)
    seed.update(extra_keys or {})
    if seed:
        ctx.add_init_script(f"try {{ if (!sessionStorage.getItem('seeded')) {{ const s = {json.dumps(seed)}; for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded','1'); }} }} catch(e) {{}}")
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(PAGE); p.wait_for_function("typeof S === 'object' && !!document.querySelector('#app *')")
    return ctx, p

DONE = {'onboarding': {'done': True, 'step': 0}, 'profile': {'name': 'Тест', 'cls': '12а', 'id': 'u1', 'exam': 'dzi12', 'track': 'math'}}
def to_settings(p): p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.wait_for_selector('.settings')

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. feedback saved offline is sent on the next start
    queued = json.dumps([{'endpoint': 'https://bingo.example.run.app/api/feedback', 'data': {'text': 'от вчера'}, 'id': 'f1', 'at': 1, 'attempts': 0}])
    ctx = b.new_context(viewport={'width': 412, 'height': 860})
    hits = []
    ctx.route('https://bingo.example.run.app/**', lambda r: (hits.append(1), r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='{"ok":true}')))
    ctx.add_init_script(f"try {{ if (!sessionStorage.getItem('seeded')) {{ localStorage.setItem('bingo.v1', {json.dumps(json.dumps(DONE))}); localStorage.setItem('bingo.feedback.v1', {json.dumps(queued)}); sessionStorage.setItem('seeded','1'); }} }} catch(e) {{}}")
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.goto(PAGE)
    try: p.wait_for_function("JSON.parse(localStorage.getItem('bingo.feedback.v1') || '[]').length === 0", timeout=8000); sent = True
    except Exception: sent = False
    ok('offline feedback: sent after restart', sent and len(hits) == 1, str(len(hits)))
    ctx.close()

    # 3. glass menu: background is at least 85% opaque
    ctx, p = fresh(b, state={**DONE, 'settings': {'glass': True}})
    alpha = p.evaluate("(() => { const c = getComputedStyle(document.querySelector('.tabbar')).backgroundColor; const m = c.match(/[\\d.]+(?=\\)$)/); return c.startsWith('rgba') || c.includes('/') ? parseFloat(m ? m[0] : '1') : 1; })()")
    ok('glass menu: text underneath is hidden', alpha >= 0.85, str(alpha))
    ctx.close()

    # 4. a switch is written at once (no 120 ms wait)
    ctx, p = fresh(b, state=DONE)
    to_settings(p); p.click('[data-sw="sound"]')
    ok('switch: saved immediately', p.evaluate("JSON.parse(localStorage.getItem('bingo.v1')).settings.sound") is False)
    ctx.close()

    # 5. Profile: class and name can't be longer than what is kept
    ctx, p = fresh(b, state=DONE)
    p.click('[data-tab="profile"]'); p.wait_for_selector('[data-p="cls"]')
    p.fill('[data-p="cls"]', ''); p.type('[data-p="cls"]', '12а клас профилиран')
    ok('class: limited while typing', p.input_value('[data-p="cls"]') == '12а клас п', p.input_value('[data-p="cls"]'))
    ok('name: has a limit', p.get_attribute('[data-p="name"]', 'maxlength') == '40')
    ctx.close()

    # 6. Back with the feedback box open closes the box, stays in Settings, keeps the text
    ctx, p = fresh(b, state=DONE)
    to_settings(p); p.click('[data-feedback]'); p.fill('[data-fb-text]', 'чернова')
    p.go_back(); p.wait_for_function("getComputedStyle(document.querySelector('[data-fb-overlay]')).display === 'none'")
    ok('feedback + Back: still in Settings', p.locator('.settings').count() == 1)
    ok('feedback + Back: text kept', p.input_value('[data-fb-text]') == 'чернова')
    p.go_back(); p.wait_for_function("!document.querySelector('.settings')")
    ok('feedback + Back: next Back leaves Settings', p.locator('.settings').count() == 0)
    ctx.close()

    # 7. Sheets status: never "sent" before a send worked
    ctx, p = fresh(b, state={**DONE, 'settings': {'sheetUrl': 'https://script.google.com/macros/s/x/exec'}})
    p.click('[data-tab="profile"]'); p.click('[data-go="insights"]'); p.wait_for_selector('.rows')
    txt = p.locator('.row', has_text='Google Sheets').inner_text()
    ok('sheets: nothing sent yet', 'още нищо' in txt, txt)
    ctx.close()

    # 8. setup counter: the total never grows
    ctx, p = fresh(b)
    totals = []
    for i in range(9):
        if not p.locator('.ob-count').count(): break
        totals.append(int(p.locator('.ob-count').inner_text().split('/')[1]))
        if p.locator('[data-k="age"]').count(): p.fill('[data-k="age"]', '17')
        cur = p.locator('.ob-count').inner_text()
        if p.locator('.seg button:not([disabled])').count() and not p.locator('[data-ob="skip"]').count(): p.locator('.seg button:not([disabled])').first.click()
        if p.locator('[data-ob="skip"]').count(): p.click('[data-ob="skip"]')
        else: p.click('[data-ob="next"]')
        try: p.wait_for_function(f"!document.querySelector('.ob-count') || document.querySelector('.ob-count').textContent !== {json.dumps(cur)}", timeout=3000)
        except Exception: break
    ok('setup counter: total never grows', len(totals) >= 3 and all(a >= b2 for a, b2 in zip(totals, totals[1:])), str(totals))
    ctx.close()

    # 11. answer counts are per exam
    rows = [{'t': 1, 'timestamp': '2026-11-01T10:00:00Z', 'student_id': 'u1', 'subject': 'Математика', 'skill_id': 'math.pct', 'task_id': 'a', 'correct': 1, 'exam': 'dzi12'},
            {'t': 2, 'timestamp': '2026-11-01T10:01:00Z', 'student_id': 'u1', 'subject': 'Математика', 'skill_id': 'math.pct', 'task_id': 'b', 'correct': 0, 'exam': 'nvo7'},
            {'t': 3, 'timestamp': '2026-11-01T10:02:00Z', 'student_id': 'u1', 'subject': 'Математика', 'skill_id': 'math.pct', 'task_id': 'c', 'correct': 0}]
    ctx, p = fresh(b, state={**DONE, 'log': rows})
    ok('per exam: old rows get the current exam', p.evaluate("S.log[2].exam") == 'dzi12')
    ok('per exam: ДЗИ counts only ДЗИ answers', p.evaluate("myExamLog().length") == 2)
    ok('per exam: Home pill', p.locator('.pill', has_text='2').count() >= 1)
    p.evaluate("S.profile.exam = 'nvo7'")
    ok('per exam: НВО 7 counts its own', p.evaluate("myExamLog().length") == 1)
    ok('per exam: CSV still has all answers', p.evaluate("logCSV().trim().split('\\n').length") == 4)
    ctx.close()

    # 12. change the exam from Profile
    ctx, p = fresh(b, state=DONE)
    p.click('[data-tab="profile"]'); p.click('[data-exam]'); p.wait_for_selector('.sheet [data-act="nvo7"]')
    p.click('.sheet [data-act="nvo7"]'); p.wait_for_function("S.profile.exam === 'nvo7'")
    ok('change exam: НВО 7 saved', p.evaluate("JSON.parse(localStorage.getItem('bingo.v1')).profile.exam") == 'nvo7')
    p.wait_for_selector('[data-exam]')
    ok('change exam: Profile shows it', 'НВО 7' in p.locator('.row', has_text='Изпит').inner_text())
    p.click('[data-exam]'); p.wait_for_selector('.sheet [data-act="dzi12"]'); p.click('.sheet [data-act="dzi12"]')
    p.wait_for_selector('.sheet [data-act="hum"]'); p.click('.sheet [data-act="hum"]')
    p.wait_for_selector('.sheet [data-act="none"]'); p.click('.sheet [data-act="none"]')
    p.wait_for_function("S.profile.exam === 'dzi12' && S.profile.track === 'hum'")
    ok('change exam: ДЗИ + profile without math -> БЕЛ', p.evaluate("S.subject") == 'bel' and p.evaluate("S.profile.extra") == '')
    p.click('[data-exam]'); p.wait_for_selector('.sheet [data-act="x"]'); p.click('.sheet [data-act="x"]')
    ok('change exam: Отказ changes nothing', p.evaluate("S.profile.exam") == 'dzi12')
    ctx.close()

    # 10. the Gemini key is not copied into backups
    ctx, p = fresh(b, state={**DONE, 'sessions': 3, 'settings': {'aiMode': 'key', 'apiKey': 'AIzaSECRET123'}})
    to_settings(p); p.click('[data-demo]'); p.wait_for_selector('.sheet [data-act="yes"]'); p.click('.sheet [data-act="yes"]')
    p.wait_for_function("!!localStorage.getItem('bingo.v1.before-demo')")
    ok('api key: not in the demo backup', 'AIzaSECRET123' not in p.evaluate("localStorage.getItem('bingo.v1.before-demo')"))
    p.evaluate("restoreFromDemo()")
    ok('api key: kept after restoring', p.evaluate("S.settings.apiKey") == 'AIzaSECRET123')
    ok('api key: not in a broken-save backup', 'AIzaSECRET' not in p.evaluate("localStorage.getItem(backupRaw('{\"settings\":{\"apiKey\":\"AIzaSECRET9\"},broken'))"))
    ctx.close()
    b.close()

print('page errors:', errors or 'none')
print(sum(r[1] for r in results), '/', len(results), 'passed')
sys.exit(0 if all(r[1] for r in results) and not errors else 1)
