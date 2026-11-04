"""BingO for classes in two browsers against the Firebase emulators: a teacher on a laptop and a student on a phone.
Run (from the repository root, emulators running with BINGO_FAKE_AI=1, see backend.test.mjs):
    python3 tools/build.py web && python3 tests/emulator/ui_classes.py
Screenshots go to build/shots/classes/. Firebase's scripts are served from tests/emulator/node_modules/firebase."""
import functools, http.server, json, pathlib, socketserver, sys, threading, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'build/shots/classes'; SHOTS.mkdir(parents=True, exist_ok=True)
FB = ROOT / 'tests/emulator/node_modules/firebase'
CFG = {'apiKey': 'fake-key', 'projectId': 'demo-bingo', 'authDomain': 'localhost', 'storageBucket': 'demo-bingo.appspot.com', 'emulator': True}
errors = []

for url in ['http://127.0.0.1:8085/emulator/v1/projects/demo-bingo/databases/(default)/documents', 'http://127.0.0.1:9099/emulator/v1/projects/demo-bingo/accounts']:
    urllib.request.urlopen(urllib.request.Request(url, method='DELETE'))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist/web')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
PAGE = f'http://localhost:{srv.server_address[1]}/index.html'

def serve_fb(route):
    name = route.request.url.rsplit('/', 1)[-1]
    route.fulfill(path=str(FB / name), content_type='application/javascript')

def browser_page(b, name, **ctx):
    c = b.new_context(**ctx)
    c.route('https://www.gstatic.com/firebasejs/**', serve_fb)
    c.add_init_script(f'window.BINGO_FIREBASE_OVERRIDE = {json.dumps(CFG)};')
    p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errors.append(f'{name} console: {m.text[:300]}'))
    return p

def shot(p, n): p.wait_for_timeout(900); p.screenshot(path=str(SHOTS / f'{n}.png'))

def onboarding(p, role, fields):
    p.wait_for_selector('.onboarding')
    for _ in range(16):
        if not p.locator('#app .onboarding').count(): return
        if p.locator('[data-v="teacher"]').count():
            p.click(f'[data-v="{role}"]')
        for k, v in fields.items():
            if p.locator(f'[data-k="{k}"]').count(): p.fill(f'[data-k="{k}"]', v)
        for seg in p.locator('.onboarding .seg').all():
            if not seg.locator('button.on').count(): seg.locator('button:not([disabled])').first.click()
        try: p.locator('#app [data-ob="next"]').click(timeout=4000)
        except Exception: pass
        p.wait_for_timeout(350)

def sign_in(p, email, name):
    p.wait_for_function('typeof cloudTestSignIn === "function"')
    p.evaluate('([e, n]) => cloudTestSignIn(e, n)', [email, name])

def ok(cond, what):
    if not cond: errors.append('FAIL ' + what)
    print(('  ok   ' if cond else '  FAIL ') + what)

def run(pw):
    b = pw.chromium.launch()
    T = browser_page(b, 'teacher', viewport={'width': 1366, 'height': 860})
    T.goto(PAGE)
    onboarding(T, 'teacher', {'tname': 'Мария Иванова', 'school': 'СУ „Иван Вазов“'})
    T.wait_for_selector('.cl-setup'); shot(T, '01-teacher-setup')
    sign_in(T, 'maria@school.bg', 'Мария Иванова')
    T.click('[data-in]'); T.wait_for_selector('.t-kpis', timeout=30000)
    shot(T, '02-teacher-dashboard-empty')
    ok(T.locator('.t-side').is_visible(), 'teacher sidebar on a laptop')

    # a class
    T.click('[data-tnav="tClasses"]'); T.click('[data-new-class]')
    T.fill('[data-f="name"]', '11Б'); T.fill('[data-f="subject"]', 'Математика'); T.fill('[data-f="grade"]', '11')
    T.click('.sheet [data-act="ok"]'); T.wait_for_selector('.t-codechip', timeout=30000)
    code = T.locator('.t-codechip b').inner_text().strip()
    ok(len(code) == 6, f'class code {code}')
    shot(T, '03-class-empty')

    # a student joins by code during setup
    S = browser_page(b, 'student', viewport={'width': 412, 'height': 900}, device_scale_factor=2, is_mobile=True, has_touch=True)
    S.goto(PAGE)
    onboarding(S, 'student', {'name': 'Ани Петрова', 'age': '17', 'classCode': code})
    S.wait_for_selector('.cl-join'); sign_in(S, 'ani@student.bg', 'Ани Петрова')
    S.wait_for_timeout(2500)   # signing in redraws the screen, which joins with the code by itself
    if S.locator('#app.screen-joinClass [data-join]').count(): S.click('#app.screen-joinClass [data-join]')
    S.wait_for_selector('#app.screen-classes', timeout=30000)
    shot(S, '10-student-classes')
    T.wait_for_selector('tr[data-student]', timeout=20000)
    ok(T.locator('tr[data-student]').count() == 1, 'teacher sees the student join live')
    shot(T, '04-class-with-student')

    # a test with three kinds of tasks
    T.click('[data-tnav="tTests"]'); T.click('[data-new]')
    T.fill('[data-m="title"]', 'Квадратни уравнения'); T.fill('[data-m="subject"]', 'Математика')
    T.click('[data-add="choice"]')
    ed = T.locator('.t-task.open')
    ed.locator('[data-str="prompt"]').fill('Колко корена има $x^2 - 4 = 0$?')
    for k, v in enumerate(['0', '1', '2', '3']): ed.locator(f'[data-li="options"][data-k="{k}"]').fill(v)
    ed.locator('[data-right="2"]').click()
    T.click('[data-add="number"]')
    ed = T.locator('.t-task.open'); ed.locator('[data-str="prompt"]').fill('Реши: $2x = 7$. $x = ?$'); ed.locator('[data-num="answer"]').fill('3,5')
    T.click('[data-add="open"]')
    ed = T.locator('.t-task.open'); ed.locator('[data-str="prompt"]').fill('Обясни какво е дискриминанта.'); ed.locator('[data-rub="0"]').fill('Вярна дефиниция')
    T.click('[data-imp="ai"]'); T.fill('[data-g="topic"]', 'Събиране'); T.fill('[data-g="n"]', '2'); T.click('.sheet [data-act="ok"]')
    T.wait_for_function('document.querySelectorAll(".t-task").length === 5', timeout=60000)
    shot(T, '05-test-builder')
    T.click('[data-preview]'); T.wait_for_selector('.t-preview'); shot(T, '06-test-preview'); T.click('.sheet [data-act="x"]'); T.wait_for_timeout(300)

    # a live test
    T.click('[data-publish]'); T.wait_for_selector('.t-publish', timeout=30000)
    T.click(f'[data-cls]'); T.click('[data-kind="live"]')
    shot(T, '07-publish')
    T.locator('.t-ac').scroll_into_view_if_needed(); shot(T, '07b-publish-protection')
    ok(T.locator('.t-ac [data-onleave="lock"].on').count() == 1, 'a live test locks after a warning by default')
    T.click('[data-go]'); T.wait_for_selector('.t-livebar', timeout=30000)

    S.wait_for_selector('.cl-livebanner', timeout=20000); shot(S, '11-student-live-banner')
    S.click('.cl-livebanner'); S.wait_for_selector('[data-start]'); shot(S, '12-student-assignment')
    S.click('[data-start]'); S.wait_for_selector('.cl-wait', timeout=30000)
    T.wait_for_selector('.t-stu', timeout=20000); shot(T, '08-live-lobby')
    T.click('[data-ctl="start"]'); S.wait_for_selector('.task', timeout=30000)
    shot(S, '13-student-question')
    # answer whatever comes first, then the next one
    for _ in range(2):
        if S.locator('.opt').count(): S.locator('.opt').nth(1).click()
        elif S.locator('textarea.essay').count(): S.fill('textarea.essay', 'Дискриминантата е b² − 4ac и показва колко корена има уравнението.')
        elif S.locator('input.field').count(): S.fill('input.field', '3,5')
        S.wait_for_timeout(1200)
        S.click('[data-next]'); S.wait_for_timeout(500)
    # test security: another window in front for a moment (an alert), then the student leaves the test (a warning)
    S.evaluate('window.dispatchEvent(new Event("blur"))'); S.wait_for_timeout(300)
    ok(S.locator('.cl-shield:not([hidden])').count() == 1, 'the test is hidden while another window is in front')
    S.wait_for_timeout(1200); S.evaluate('window.dispatchEvent(new Event("focus"))'); S.wait_for_timeout(300)
    ok(S.locator('.cl-shield:not([hidden])').count() == 0, 'the test shows again')
    S.evaluate('''() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange"));
      setTimeout(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); }, 1500); }''')
    S.wait_for_selector('.cl-acwarn:not([hidden])', timeout=20000); shot(S, '13b-student-warning')
    ok(S.locator('[data-acwarntext]').inner_text().strip() != '', 'the student is warned')
    S.click('[data-acok]')
    ok(S.locator('.cl-watermark').count() == 1, 'the student\'s name is over the test')
    T.wait_for_function('document.querySelector(".t-stu .t-dots i.d-right, .t-stu .t-dots i.d-wrong, .t-stu .t-dots i.d-pending")', timeout=20000)
    T.wait_for_selector('.t-flag', timeout=20000)
    shot(T, '09-live-monitor')
    ok(T.locator('.t-ev').count() >= 1, 'teacher sees the alert')
    T.wait_for_selector('.t-strikes', timeout=20000)
    ok(T.locator('.t-strikes').first.inner_text().strip() == '1/2', 'teacher sees 1 of 2 allowed exits')
    T.click('.t-stu'); T.wait_for_selector('.t-stu-detail'); shot(T, '09b-live-student-detail'); T.keyboard.press('Escape'); T.click('.overlay', position={'x': 5, 'y': 5}); T.wait_for_timeout(300)

    # the student hands in, the teacher ends and grades
    S.click('[data-map]'); S.click('[data-q]:last-child'); S.wait_for_timeout(300)
    while S.locator('[data-next]').inner_text().strip() not in ('Предай',):
        S.click('[data-next]'); S.wait_for_timeout(300)
    S.click('[data-next]'); S.click('.sheet [data-act="yes"]')
    S.wait_for_selector('.cl-result', timeout=60000); S.wait_for_timeout(1500); shot(S, '14-student-handed-in')
    T.click('[data-ctl="end"]'); T.click('.sheet [data-act="yes"]')
    T.wait_for_selector('[data-results]', timeout=60000); T.click('[data-results]')
    T.wait_for_selector('.t-dist', timeout=30000); shot(T, '10-results-overview')
    T.click('[data-tab="questions"]'); shot(T, '11-results-questions')
    T.click('[data-tab="students"]'); T.click('tr[data-grade]'); T.wait_for_selector('.t-gtask', timeout=30000)
    shot(T, '12-grade-student')
    if T.locator('[data-setpts]').count():
        T.locator('[data-p]').first.fill('1'); T.locator('[data-setpts]').first.click(); T.wait_for_timeout(2500)
    shot(T, '13-graded')

    # gradebook, calendar, assistant, more
    T.click('[data-tnav="tClasses"]'); T.click('[data-class]'); T.click('[data-tab="book"]'); T.wait_for_timeout(1200); shot(T, '14-gradebook')
    T.click('[data-tnav="tCalendar"]'); T.wait_for_selector('.t-cal'); shot(T, '15-calendar')
    T.click('[data-tnav="tAI"]'); T.click('[data-idea]'); T.wait_for_selector('.t-msg.assistant', timeout=30000); T.wait_for_timeout(2500); shot(T, '16-assistant')
    T.click('[data-tnav="tHome"]'); T.wait_for_selector('.t-kpis'); T.wait_for_timeout(1500); shot(T, '17-dashboard')
    T.set_viewport_size({'width': 412, 'height': 900}); T.wait_for_timeout(500); shot(T, '18-dashboard-phone')

    S.wait_for_selector('.cl-score', timeout=40000); shot(S, '15-student-result')
    ok(S.locator('.cl-score').count() == 1, 'student sees the result after the live test ends')
    S.click('#app [data-back]'); S.wait_for_selector('#app.screen-classes')

    # the projector quiz
    T.set_viewport_size({'width': 1366, 'height': 860})
    T.click('[data-tnav="tTests"]'); T.locator('[data-live]').first.click(); T.wait_for_selector('.t-publish')
    T.click('[data-cls]'); T.click('[data-mode="quiz"]'); T.fill('[data-quizsec]', '30'); T.locator('[data-quizsec]').dispatch_event('change')
    T.click('[data-go]'); T.wait_for_selector('.t-qz-lobby', timeout=30000)
    S.wait_for_selector('.cl-livebanner', timeout=20000); S.click('.cl-livebanner'); S.click('[data-start]')
    S.wait_for_selector('.cl-qz-main .cl-wait', timeout=30000)
    T.wait_for_selector('.t-qz-names span', timeout=20000); shot(T, '19-quiz-lobby')
    T.click('[data-ctl="start"]'); T.wait_for_selector('.t-qz-q', timeout=30000); shot(T, '20-quiz-question')
    S.wait_for_selector('.cl-qz-opts button, .cl-qz-main .task', timeout=20000); shot(S, '16-quiz-phone')
    if S.locator('.cl-qz-opts button').count(): S.locator('.cl-qz-opts button').first.click()
    else:
        if S.locator('input.field').count(): S.fill('input.field', '3,5')
        elif S.locator('textarea.essay').count(): S.fill('textarea.essay', 'отговор')
        S.click('[data-send]')
    T.wait_for_selector('.t-qz-lb', timeout=30000); shot(T, '21-quiz-reveal'); shot(S, '17-quiz-phone-reveal')
    ok(S.locator('.cl-qz-reveal').count() == 1, 'student sees right or wrong after the reveal')
    for _ in range(8):
        if T.locator('.t-qz-end').count(): break
        T.click('[data-ctl="next"]'); T.wait_for_timeout(1500)
        if T.locator('.t-qz-end').count(): break
        if T.locator('[data-ctl="reveal"]').count(): T.click('[data-ctl="reveal"]'); T.wait_for_selector('.t-qz-lb', timeout=30000)
    T.wait_for_selector('.t-qz-end', timeout=30000); shot(T, '22-quiz-podium'); shot(S, '18-quiz-phone-end')
    b.close()

with sync_playwright() as pw:
    try: run(pw)
    except Exception as e:
        errors.append('FAIL exception: ' + str(e)[:600])
srv.shutdown()
bad = [e for e in errors if 'FAIL' in e or 'pageerror' in e or ': ' in e]
print('\n'.join(errors) if errors else 'no errors')
sys.exit(1 if any(e.startswith('FAIL') or 'console' not in e for e in errors) else 0)
