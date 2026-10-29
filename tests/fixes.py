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

    # 4. session: double tap on Провери keeps the feedback; order needs a move; ± works.
    #    The diagnostic picks random variants, so a number task may not come in one run: retry a few times.
    sign_checked = False
    def number_task_seen(first):
        global sign_checked
        ctx, p = fresh(b, state=DONE)
        p.click('[data-start="diag"]'); p.wait_for_selector('.task')
        seen = False
        for i in range(14):
            if p.locator('input.field.num').count() and not seen:
                seen = True
                if not sign_checked:
                    sign_checked = True
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
            if i == 0 and first:
                ok('double tap: feedback still shown', p.locator('.checkbar.good, .checkbar.bad').count() == 1 and p.locator('.pcount').inner_text() == before, before)
                p.screenshot(path=str(SHOTS / 'double-tap.png'))
            p.wait_for_timeout(500); p.click('[data-main]'); p.wait_for_timeout(150)
            if p.locator('.result').count(): break
        ctx.close()
        return seen
    ok('a number task was met', any(number_task_seen(k == 0) for k in range(3)))

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
    ok('demo: restore brings real data back', p.evaluate("S.sessions") == 2 and p.evaluate("S.profile.name") == 'Тест')
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

    # 11. the whole profile, past results and the Sheet retry state survive a restart; broken entries are dropped
    state = {**DONE, 'profile': {**DONE['profile'], 'age': '17', 'exam': 'dzi12', 'track': 'math', 'extra': 'maths'},
             'pastResults': {'dzi12-math-2020-06-02-v2': {'pts': 82.5, 'max': 100, 'at': 1760000000000}, 'bad': {'pts': 'x', 'max': 100, 'at': 1}},
             'sync': {'fails': 2, 'lastError': 'x', 'lastOk': 1, 'unverified': True}}
    ctx, p = fresh(b, state=state)
    p.reload(); p.wait_for_timeout(300)
    prof = p.evaluate("S.profile")
    ok('restart: age/exam/track/extra kept', [prof['age'], prof['exam'], prof['track'], prof['extra']] == ['17', 'dzi12', 'math', 'maths'], str(prof))
    ok('restart: past result kept', p.evaluate("S.pastResults['dzi12-math-2020-06-02-v2']?.pts") == 82.5)
    ok('restart: broken past result dropped', p.evaluate("S.pastResults.bad === undefined"))
    ok('restart: Sheet retry state kept', p.evaluate("S.sync.fails") == 2)
    ctx.close()

    # 12. loading the demo twice never replaces the real copy with demo data
    real = {**DONE, 'sessions': 2, 'log': [{'t': 1, 'timestamp': '2026-10-01T10:00:00Z', 'student_id': 'u1', 'subject': 'Математика', 'task_id': 'x', 'correct': 1}]}
    ctx, p = fresh(b, state=real)
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.click('[data-demo]'); p.click('[data-act="yes"]'); p.wait_for_selector('.losscard')
    ok('demo: marked as demo', p.evaluate("S.demo") is True)
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.click('[data-demo]'); p.wait_for_selector('.losscard')
    ok('demo: second load keeps the demo', p.evaluate("S.demo") is True and p.evaluate("S.profile.name") == 'Демо ученик')
    p.click('[data-tab="profile"]'); p.click('[data-go="settings"]'); p.wait_for_selector('[data-restore]')
    p.click('[data-restore]'); p.wait_for_selector('.losscard')
    ok('demo: restore after two loads brings real data back', p.evaluate("S.sessions") == 2 and p.evaluate("S.profile.name") == 'Тест' and p.evaluate("S.demo") is False)
    ok('demo: no restore button without a real copy', p.evaluate("demoBackupHasRealData()") is False)
    ctx.close()

    # 13. running the setup again with the demo loaded does not keep the demo's answers
    ctx, p = fresh(b, state=DONE)
    p.evaluate("simulateLearner()")
    p.evaluate("onboardingRestart()")
    ok('setup again: demo answers removed', p.evaluate("S.log.length") == 0 and p.evaluate("S.demo") is False)
    ctx.close()

    # 14. streak counts days with a finished session; activity counts only this learner's answers
    rows = [{'t': 1, 'timestamp': '2026-10-01T10:00:00Z', 'student_id': 'u1', 'subject': 'Математика', 'task_id': 'a', 'correct': 1},
            {'t': 2, 'timestamp': '2026-10-01T10:00:00Z', 'student_id': 'someone-else', 'subject': 'Математика', 'task_id': 'b', 'correct': 0}]
    ctx, p = fresh(b, state={**DONE, 'log': rows, 'sessionDays': []})
    ok('streak: answers alone do not make a streak', p.evaluate("activity().streak") == 0)
    ok('activity: only my answers counted', p.evaluate("myLog().length") == 1)
    p.evaluate("S.sessionDays = [localDay()]")
    ok('streak: a finished session today counts', p.evaluate("activity().streak") == 1)
    ctx.close()

    # 15. skill progress is kept per exam; an old key moves to the current exam
    ctx, p = fresh(b, state={**DONE, 'profile': {**DONE['profile'], 'exam': 'nvo7'}, 'skills': {'math.quad': {'p': 0.8, 'n': 5, 'ok': 4, 'last': 1, 'misc': {}, 'hist': []}}})
    ok('exam scope: old key moved to the current exam', p.evaluate("skillState('math', 'quad').p") == 0.8 and p.evaluate("'math.quad@nvo7' in S.skills"))
    p.evaluate("S.profile.exam = 'dzi12'")
    ok('exam scope: another exam starts fresh', p.evaluate("skillState('math', 'quad').n") == 0)
    p.evaluate("S.profile.exam = 'nvo7'")
    ok('exam scope: switching back keeps the progress', p.evaluate("skillState('math', 'quad').n") == 5)
    ctx.close()

    # 16. generated math: quadratics at level 2 have real roots, every choice task has four options
    ctx, p = fresh(b, state=DONE)
    bad = p.evaluate(r"""(() => {
      const fails = [];
      for (let i = 0; i < 1000; i++) {
        const t = genMathTask('quad', 2, i);
        const m = t.prompt.match(/\$([2-5])x\^2([+-])(\d*)x([+-])(\d+)=0\$/);
        if (!m) { fails.push(['parse', i, t.prompt]); continue; }
        const a = +m[1], b = (m[2] === '-' ? -1 : 1) * (m[3] ? +m[3] : 1), c = (m[4] === '-' ? -1 : 1) * +m[5];
        if (b * b - 4 * a * c < 0) fails.push(['D<0', i, b * b - 4 * a * c]);
      }
      return fails.slice(0, 5);
    })()""")
    ok('quad level 2: D >= 0', len(bad) == 0, str(bad))
    few = p.evaluate("Object.keys(MATH_GEN).flatMap(sk => [1, 2, 3].flatMap(l => Array.from({ length: 150 }, (_, i) => genMathTask(sk, l, i)))).filter(t => t.type === 'choice' && t.options.length < 4).map(t => t.id).slice(0, 5)")
    ok('generated choice tasks: always four options', len(few) == 0, str(few))
    ctx.close()

    # 17. the model: a wrong answer never raises mastery; the first answers move it only a little
    ctx, p = fresh(b, state=DONE)
    ok('model: wrong answer never raises mastery', p.evaluate("[0.02, 0.05, 0.1, 0.3].every(x => bktUpdate(x, false, 0.5) <= x)"))
    ok('model: first answer moves at most 0.08', p.evaluate("bktStep({ p: 0.3, n: 0 }, true, 0.05)") <= 0.3801)
    ok('model: later answers may move more', p.evaluate("bktStep({ p: 0.3, n: 8 }, true, 0.05)") > 0.45)
    ctx.close()

    # 18. weak practice keeps 8 tasks: a twin takes the next planned place, the counter stays "/ 8"
    weak = {k: {'p': v, 'n': 3, 'ok': 1, 'last': 0, 'misc': {}, 'hist': []} for k, v in {'math.quad': 0.2, 'math.pct': 0.3, 'math.pow': 0.4}.items()}
    ctx, p = fresh(b, state={**DONE, 'subject': 'math', 'skills': weak})
    p.click('[data-start="focus"]'); p.wait_for_selector('.task')
    ok('weak practice: counter starts at 1 / 8', p.locator('.pcount').inner_text() == '1 / 8', p.locator('.pcount').inner_text())
    stable = True
    for i in range(6):
        if p.locator('.result').count(): break
        if p.locator('.opt').count(): p.locator('.opt').last.click()
        elif p.locator('input.field').count() and p.locator('input.field').first.is_editable(): p.fill('input.field', '12345')
        elif p.locator('.bank .chip:not(.used)').count(): p.locator('.bank .chip:not(.used)').first.click()
        if p.locator('[data-main]').is_disabled(): break
        p.locator('[data-main]').click(); p.wait_for_timeout(500)
        p.locator('[data-main]').click(); p.wait_for_timeout(200)
        if p.locator('.pcount').count() and '/ 8' not in p.locator('.pcount').inner_text(): stable = False; break
    ok('weak practice: counter stays / 8 after answers', stable)
    ctx.close()

    # 19. bottom menu: fast tab switches keep browser history in sync (feedback-1443-s1, fix/tab-history)
    ctx, p = fresh(b, state=DONE)
    p.click('[data-tab="stats"]'); p.wait_for_timeout(100)
    p.click('[data-tab="profile"]'); p.wait_for_timeout(100)
    p.click('[data-tab="home"]'); p.wait_for_timeout(300)
    p.click('[data-tab="stats"]'); p.wait_for_timeout(300)
    p.go_back(); p.wait_for_timeout(300)
    ok('bottom menu: Back from Stats lands on Home', p.locator('.losscard').count() == 1)
    ok('bottom menu: no stale trap on Home', not ((p.evaluate('history.state') or {}).get('trap')))
    ctx.close()

    # 20. strict text answers: a whole sentence ignores case, final full stop and quotes; a strict word does not
    ctx, p = fresh(b, state=DONE)
    ok('strict sentence: case and full stop ignored', p.evaluate("textMatches('новият учител е подлог.', ['„Новият учител е подлог“'], 'bg', true)"))
    ok('strict sentence: other words still wrong', not p.evaluate("textMatches('новият учител е допълнение', ['Новият учител е подлог'], 'bg', true)"))
    ok('strict gap word: capital letter still matters', p.evaluate("scoreTask({ type: 'gaps', points: 1, strict: true, gaps: [{ answer: 'Директорът' }] }, ['директорът'], 'bg').status") == 'wrong')
    ctx.close()

    # 21. setup: no Gemini step, and the step counter moves by one
    ctx, p = fresh(b)
    ok('setup: no Gemini step', p.evaluate("ONBOARD.steps.every(s => s.id !== 'ai')"))
    seen = []
    for i in range(6):
        if not p.locator('.ob-count').count(): break
        seen.append(p.locator('.ob-count').inner_text().split('/')[0].strip())
        if p.locator('[data-ob="skip"]').count(): p.click('[data-ob="skip"]')
        else:
            if p.locator('.seg button:not([disabled])').count(): p.locator('.seg button:not([disabled])').first.click()
            p.click('[data-ob="next"]')
        p.wait_for_timeout(250)
    nums = [int(x) for x in seen if x.isdigit()]
    ok('setup: counter goes up by one', nums == list(range(1, len(nums) + 1)) and len(nums) >= 3, str(seen))
    ctx.close()
    b.close()

print('page errors:', errors or 'none')
print(sum(r[1] for r in results), '/', len(results), 'passed')
sys.exit(0 if all(r[1] for r in results) and not errors else 1)
