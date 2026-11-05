"""BingO Messages in a real browser, with tests/fake-firebase.js in place of Firebase (no emulators needed).
A student on a phone and a teacher on a laptop click through chats, messages, files, reactions, replies,
unsend, Google Drive, Google Meet and Office files that open in Google Docs. Google's APIs are answered by
the test. The security rules are tested separately against the emulators (tests/emulator/chat.test.mjs).
Run from the repository root:
    python3 tools/build.py web && python3 tests/ui_messages.py
Screenshots go to build/shots/messages/."""
import functools, http.server, io, json, pathlib, socketserver, sys, threading, time, urllib.parse
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'build/shots/messages'; SHOTS.mkdir(parents=True, exist_ok=True)
FAKE = (ROOT / 'tests/fake-firebase.js').read_text(encoding='utf-8')
CFG = {'apiKey': 'fake-key', 'projectId': 'demo-bingo', 'authDomain': 'localhost', 'storageBucket': 'demo-bingo.appspot.com', 'emulator': True}
errors, calls = [], []
FILES = {}

def png(color, size=(800, 600)):
    from PIL import Image, ImageDraw
    im = Image.new('RGB', size, color); d = ImageDraw.Draw(im)
    for i in range(0, size[0], 80): d.line([(i, 0), (i + 300, size[1])], fill=(255, 255, 255), width=6)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80); return b.getvalue()
FILES['sample/board.jpg'] = ('image/jpeg', png((52, 120, 246)))
FILES['sample/notes.jpg'] = ('image/jpeg', png((255, 149, 0), (600, 800)))
FILES['sample/plan.docx'] = ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', b'PK fake docx')

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def _key(self): return urllib.parse.unquote(urllib.parse.urlparse(self.path).path[len('/fakestore/'):])
    def do_PUT(self):
        n = int(self.headers.get('Content-Length') or 0); FILES[self._key()] = (self.headers.get('Content-Type'), self.rfile.read(n))
        self.send_response(200); self.end_headers()
    def do_DELETE(self):
        FILES.pop(self._key(), None); self.send_response(204); self.end_headers()
    def do_GET(self):
        if self.path.startswith('/fakestore/'):
            f = FILES.get(self._key())
            if not f: self.send_response(404); self.end_headers(); return
            self.send_response(200); self.send_header('Content-Type', f[0]); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers(); self.wfile.write(f[1]); return
        super().do_GET()

class TS(socketserver.ThreadingMixIn, socketserver.TCPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 0), functools.partial(H, directory=str(ROOT / 'dist/web')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://localhost:{srv.server_address[1]}'
PAGE = BASE + '/index.html'

DRIVE_FILES = [
    {'id': '1EssayDocAbCdEfGhIj', 'name': 'Есе: Под игото', 'mimeType': 'application/vnd.google-apps.document', 'webViewLink': 'https://docs.google.com/document/d/1EssayDocAbCdEfGhIj/edit', 'modifiedTime': '2026-11-04T10:00:00Z', 'capabilities': {'canShare': True}},
    {'id': '1GradesSheetAbCdEfG', 'name': 'Оценки 11Б', 'mimeType': 'application/vnd.google-apps.spreadsheet', 'webViewLink': 'https://docs.google.com/spreadsheets/d/1GradesSheetAbCdEfG/edit', 'modifiedTime': '2026-11-03T10:00:00Z', 'capabilities': {'canShare': True}},
    {'id': '1LessonSlidesAbCdEf', 'name': 'Урок: функции', 'mimeType': 'application/vnd.google-apps.presentation', 'webViewLink': 'https://docs.google.com/presentation/d/1LessonSlidesAbCdEf/edit', 'modifiedTime': '2026-11-01T10:00:00Z', 'capabilities': {'canShare': True}},
]
def google(route):
    u, m = route.request.url, route.request.method
    calls.append((m, u.split('?')[0]))
    if 'upload/drive/v3/files' in u: return route.fulfill(json={'id': '1ConvertedDoc123456', 'webViewLink': 'https://docs.google.com/document/d/1ConvertedDoc123456/edit'})
    if '/permissions' in u: return route.fulfill(json={'id': 'perm1'})
    if 'drive/v3/files/' in u: return route.fulfill(json={'name': 'Есе: Под игото', 'mimeType': 'application/vnd.google-apps.document'})
    if 'drive/v3/files' in u: return route.fulfill(json={'files': DRIVE_FILES})
    if 'calendar/v3' in u: return route.fulfill(json={'id': 'ev1', 'hangoutLink': 'https://meet.google.com/abc-defg-hij'})
    return route.fulfill(status=404, body='{}')

def page_for(b, name, **ctx):
    c = b.new_context(**ctx)
    c.route('https://www.gstatic.com/firebasejs/**', lambda r: r.fulfill(body=FAKE if 'firebase-app-compat' in r.request.url else '/* fake */', content_type='application/javascript'))
    c.route('https://www.googleapis.com/**', google)
    c.route('https://docs.google.com/**', lambda r: r.fulfill(body='<html><body style="font:20px sans-serif;padding:40px">Google Docs preview</body></html>', content_type='text/html'))
    c.route('https://i.ytimg.com/**', lambda r: r.fulfill(body=FILES['sample/board.jpg'][1], content_type='image/jpeg'))
    c.add_init_script(f'window.BINGO_FIREBASE_OVERRIDE = {json.dumps(CFG)};')
    p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and '404' not in m.text and errors.append(f'{name} console: {m.text[:300]}'))
    return p

def shot(p, n): p.wait_for_timeout(700); p.screenshot(path=str(SHOTS / f'{n}.png'))
def ok(cond, what):
    if not cond: errors.append('FAIL ' + what)
    print(('  ok   ' if cond else '  FAIL ') + what)

def onboarding(p, role, fields):
    p.wait_for_selector('.onboarding')
    for _ in range(16):
        if not p.locator('#app .onboarding').count(): return
        if p.locator('[data-v="teacher"]').count(): p.click(f'[data-v="{role}"]')
        for k, v in fields.items():
            if p.locator(f'[data-k="{k}"]').count(): p.fill(f'[data-k="{k}"]', v)
        for seg in p.locator('.onboarding .seg').all():
            if not seg.locator('button.on').count(): seg.locator('button:not([disabled])').first.click()
        try: p.locator('#app [data-ob="next"]').click(timeout=3000)
        except Exception: pass
        p.wait_for_timeout(300)

SEED = r'''([role, base]) => {
  const me = CLOUD.user.uid, T = role === 'teacher' ? me : 't1', S1 = role === 'teacher' ? 's1' : me, ts = __fake.ts, H = 3600000, now = Date.now();
  const people = { [T]: { name: 'Мария Иванова', photo: '', teacher: true }, [S1]: { name: 'Ани Петрова', photo: '', teacher: false }, s2: { name: 'Борис Георгиев', photo: '', teacher: false }, s3: { name: 'Цвети Колева', photo: '', teacher: false } };
  const img = n => ({ name: n, size: 184000, mime: 'image/jpeg', path: 'sample/' + n, url: base + '/fakestore/sample/' + n, w: 800, h: 600 });
  const docs = {
    ['users/' + me]: { uid: me, name: role === 'teacher' ? 'Мария Иванова' : 'Ани Петрова', role, email: role + '@school.bg' },
    'classes/c1': { name: '11Б', teacherIds: [T], studentIds: [S1, 's2', 's3'], color: '#2F5BD3' },
    'chats/class_c1': { type: 'class', classId: 'c1', title: '11Б', color: '#2F5BD3', members: [T, S1, 's2', 's3'], teacherIds: [T], people,
      lastMessage: { from: 's2', at: ts(now - 5 * 60000), text: 'Ето моите бележки', key: '' }, updatedAt: ts(now - 5 * 60000), reads: { [me]: ts(now - 2 * H) }, typing: {} },
    'chats/class_c1/messages/m1': { from: T, at: ts(now - 26 * H), text: 'Добро утро! Утре пишем контролно по функции 📚', files: [], links: [], reply: null, reactions: { s2: '👍', s3: '👍', [S1]: '😮' }, deleted: false },
    'chats/class_c1/messages/m2': { from: T, at: ts(now - 26 * H + 30000), text: 'Ето презентацията от часа: https://docs.google.com/presentation/d/1LessonSlidesAbCdEf/edit', files: [], links: [{ url: 'https://docs.google.com/presentation/d/1LessonSlidesAbCdEf/edit', app: 'slides', id: '1LessonSlidesAbCdEf', title: 'Урок: функции' }], reply: null, reactions: {}, deleted: false },
    'chats/class_c1/messages/m3': { from: 's2', at: ts(now - 3 * H), text: 'Може ли да ни пратите и задачите?', files: [], links: [], reply: null, reactions: {}, deleted: false },
    'chats/class_c1/messages/m4': { from: T, at: ts(now - 3 * H + 60000), text: '', files: [{ name: 'Задачи за упражнение.docx', size: 48213, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', path: 'sample/plan.docx', url: base + '/fakestore/sample/plan.docx' }], links: [], reply: { id: 'm3', from: 's2', text: 'Може ли да ни пратите и задачите?' }, reactions: { s2: '❤️' }, deleted: false },
    'chats/class_c1/messages/m5': { from: 's3', at: ts(now - 6 * 60000), text: 'Благодаря!', files: [], links: [], reply: null, reactions: {}, deleted: false },
    'chats/class_c1/messages/m6': { from: 's2', at: ts(now - 5 * 60000), text: 'Ето моите бележки', files: [img('board.jpg'), img('notes.jpg')], links: [], reply: null, reactions: {}, deleted: false },
    ['chats/dm_' + [T, S1].sort().join('_')]: { type: 'dm', members: [T, S1].sort(), teacherIds: [T], classIds: ['c1'], people: { [T]: people[T], [S1]: people[S1] },
      lastMessage: { from: role === 'teacher' ? S1 : T, at: ts(now - 40 * 60000), text: role === 'teacher' ? 'Може ли въпрос за есето?' : 'Виж коментарите в документа', key: '' }, updatedAt: ts(now - 40 * 60000), reads: {}, typing: {} },
    ['chats/dm_' + [T, S1].sort().join('_') + '/messages/d1']: { from: S1, at: ts(now - 50 * 60000), text: 'Може ли въпрос за есето?', files: [], links: [], reply: null, reactions: {}, deleted: false },
    ['chats/dm_' + [T, S1].sort().join('_') + '/messages/d2']: { from: T, at: ts(now - 40 * 60000), text: 'Виж коментарите в документа', files: [], links: [{ url: 'https://docs.google.com/document/d/1EssayDocAbCdEfGhIj/edit', app: 'docs', id: '1EssayDocAbCdEfGhIj', title: 'Есе: Под игото' }], reply: null, reactions: {}, deleted: false }
  };
  __fake.seed(docs);
  return me;
}'''

def last_msg(p, cid):
    return p.evaluate('cid => { const k = __fake.list(`chats/${cid}/messages/`); const all = k.map(x => ({ id: x.split("/").pop(), ...__fake.get(x) })); all.sort((a, b) => a.at.ms - b.at.ms); return JSON.parse(JSON.stringify(all[all.length - 1])); }', cid)

def student(b):
    print('student on a phone')
    S = page_for(b, 'student', viewport={'width': 400, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True)
    S.goto(PAGE)
    onboarding(S, 'student', {'name': 'Ани Петрова', 'age': '17'})
    S.wait_for_function('typeof cloudTestSignIn === "function"')
    S.evaluate('() => cloudTestSignIn("ani@student.bg", "Ани Петрова").then(() => cloudAfterSignIn())')
    me = S.evaluate(SEED, ['student', BASE])
    S.evaluate('() => home()'); S.wait_for_timeout(500)
    ok(S.locator('[data-tab="messages"]').count() == 1, 'Messages tab in the student tab bar')
    S.wait_for_timeout(600)
    ok('msg-has' in (S.locator('[data-tab="messages"]').get_attribute('class') or ''), 'red dot on the tab for unread chats')
    shot(S, '01-student-home-tab')
    S.click('[data-tab="messages"]'); S.wait_for_selector('.msg-item')
    ok(S.locator('.msg-item').count() == 2, 'two chats: the class and the teacher')
    ok(S.locator('.msg-item.unread').count() == 2, 'both unread')
    shot(S, '02-student-list')

    S.click('.msg-item[data-cid="class_c1"]'); S.wait_for_selector('#app.screen-chat .msg-row')
    S.wait_for_timeout(500)
    ok(S.locator('.msg-gcard').count() >= 1, 'Google Slides link shows as a card')
    ok(S.locator('.msg-file').count() >= 1 and S.locator('[data-gopen]').count() >= 1, 'Word file with "Open in Google Docs"')
    ok(S.locator('.msg-imgs.n2 img').count() == 2, 'two pictures in a grid')
    ok(S.locator('.msg-quote').count() == 1, 'a reply quote')
    ok(S.locator('.msg-rx').count() >= 2, 'reaction badges')
    ok(S.evaluate('() => !!(__fake.get("chats/class_c1").reads[CLOUD.user.uid].ms > Date.now() - 60000)'), 'opening the chat marks it read')
    shot(S, '03-student-class-chat')
    S.locator('.msg-scroll').evaluate('e => e.scrollTop = 0'); shot(S, '03b-student-class-chat-top')
    S.locator('.msg-scroll').evaluate('e => e.scrollTop = e.scrollHeight')

    # send a message
    S.fill('.msg-field textarea', 'Ще има ли и задачи с графики?')
    ok('go' in S.locator('[data-send]').get_attribute('class'), 'send button turns blue')
    S.click('[data-send]'); S.wait_for_timeout(900)
    m = last_msg(S, 'class_c1')
    ok(m['text'] == 'Ще има ли и задачи с графики?' and m['from'] == me, 'message saved')
    ok(S.evaluate('() => __fake.get("chats/class_c1").lastMessage.text') == 'Ще има ли и задачи с графики?', 'the list shows the last message')
    ok(S.locator('.msg-seen').inner_text().strip() in ('Изпратено', 'Delivered'), '"Изпратено" under my message')
    # the teacher reads it and starts typing
    S.evaluate('() => __fake.update("chats/class_c1", { "reads.t1": __fake.FV.serverTimestamp(), "typing.t1": __fake.FV.serverTimestamp() })'); S.wait_for_timeout(600)
    ok('Видяно' in S.locator('.msg-seen').inner_text(), 'seen by the teacher')
    ok(S.locator('.msg-typing:not([hidden])').count() == 1, '"… пише" while the teacher types')
    shot(S, '04-student-sent-seen-typing')

    # hold a message: reactions + actions
    S.locator('.msg-row[data-mid="m3"] .msg-bubble').dispatch_event('contextmenu')
    S.wait_for_selector('.msg-menu.in'); shot(S, '05-student-reaction-bar')
    S.click('.msg-menu [data-rx="😂"]'); S.wait_for_timeout(400)
    ok(S.evaluate('() => __fake.get("chats/class_c1/messages/m3").reactions[CLOUD.user.uid]') == '😂', 'reaction saved')
    S.locator('.msg-row[data-mid="m5"] .msg-bubble').dispatch_event('dblclick'); S.wait_for_timeout(400)
    ok(S.evaluate('() => __fake.get("chats/class_c1/messages/m5").reactions[CLOUD.user.uid]') == '❤️', 'double-tap gives ❤️')

    # reply
    S.locator('.msg-row[data-mid="m1"] .msg-bubble').dispatch_event('contextmenu'); S.wait_for_selector('.msg-menu.in')
    S.click('.msg-menu [data-a="reply"]')
    ok(S.locator('.msg-replybar:not([hidden])').count() == 1, 'reply bar')
    S.fill('.msg-field textarea', 'Ок, ще се подготвя'); S.click('[data-send]'); S.wait_for_timeout(900)
    ok((last_msg(S, 'class_c1').get('reply') or {}).get('id') == 'm1', 'reply saved with the quoted message')

    # files: a picture, a Word document and a Google Drive shortcut file
    tmp = ROOT / 'build/fake-upload'; tmp.mkdir(parents=True, exist_ok=True)
    (tmp / 'граф.jpg').write_bytes(png((52, 199, 89)))
    (tmp / 'Решения.docx').write_bytes(b'PK' + b'x' * 5000)
    (tmp / 'Есе.gdoc').write_text(json.dumps({'doc_id': '1EssayDocAbCdEfGhIj', 'email': 'ani@student.bg'}), encoding='utf-8')
    S.set_input_files('[data-file]', [str(tmp / 'граф.jpg'), str(tmp / 'Решения.docx'), str(tmp / 'Есе.gdoc')])
    S.wait_for_timeout(400)
    ok(S.locator('.msg-chip').count() == 3, 'three things ready to send')
    shot(S, '06-student-attachments')
    S.click('[data-send]'); S.wait_for_selector('[data-pending]', timeout=3000); shot(S, '07-student-uploading')
    S.wait_for_function('() => !document.querySelector("[data-pending]")', timeout=15000); S.wait_for_timeout(500)
    m = last_msg(S, 'class_c1')
    ok(len(m['files']) == 2 and {f['name'] for f in m['files']} == {'граф.jpg', 'Решения.docx'}, 'two files uploaded')
    ok(m['links'] and m['links'][0]['app'] == 'docs' and '1EssayDocAbCdEfGhIj' in m['links'][0]['url'], 'the .gdoc shortcut became a Google Docs link')
    ok(any(k.startswith(f'chats/class_c1/{me}/') for k in FILES), 'files stored under the chat and the sender')
    ok(m['files'][0].get('w') == 800, 'picture size kept for the layout')
    shot(S, '08-student-files-sent')

    # too big
    S.evaluate('() => { const i = document.querySelector("[data-file]"); const f = new File([new Uint8Array(1)], "огромен.mp4"); Object.defineProperty(f, "size", { value: 26 * 1024 * 1024 }); const dt = new DataTransfer(); dt.items.add(f); i.files = dt.files; i.dispatchEvent(new Event("change")); }')
    S.wait_for_timeout(300)
    ok(S.locator('.toast').filter(has_text='25 MB').count() >= 1, 'a file over 25 MB is refused with a reason')

    # unsend
    mid = m['id']
    S.locator(f'.msg-row[data-mid="{mid}"] .msg-col > *').first.dispatch_event('contextmenu'); S.wait_for_selector('.msg-menu.in')
    S.click('.msg-menu [data-a="unsend"]'); S.click('.sheet [data-act="yes"]'); S.wait_for_timeout(700)
    d = S.evaluate(f'() => __fake.get("chats/class_c1/messages/{mid}")')
    ok(d['deleted'] and not d['files'] and d['text'] == '', 'unsend clears the message')
    ok(not any(k.startswith(f'chats/class_c1/{me}/{mid}/') for k in FILES), 'unsend removes my files')

    # a message arrives in another chat while this one is open: a toast
    S.evaluate('''() => { const id = Object.keys(__fake.STORE ? Object.fromEntries(__fake.STORE) : {}).find(k => /^chats\\/dm_[^/]+$/.test(k));
      __fake.set(id + "/messages/d3", { from: "t1", at: __fake.FV.serverTimestamp(), text: "Браво за есето!", files: [], links: [], reply: null, reactions: {}, deleted: false });
      __fake.update(id, { lastMessage: { from: "t1", at: __fake.FV.serverTimestamp(), text: "Браво за есето!", key: "" }, updatedAt: __fake.FV.serverTimestamp() }); }''')
    S.wait_for_timeout(700)
    ok(S.locator('.toast').filter(has_text='Браво за есето').count() == 1, 'a toast for a new message in another chat')

    # back to the list, compose: only teachers
    S.click('#app.screen-chat [data-back]'); S.wait_for_selector('.msg-item')
    S.click('[data-compose]'); S.wait_for_selector('.sheet .msg-person')
    ok(S.locator('.sheet .msg-person').count() == 1 and 'Иванова' in S.locator('.sheet .msg-person').inner_text(), 'a student can start a chat only with the teacher')
    shot(S, '09-student-compose')
    S.click('.sheet .msg-person'); S.wait_for_selector('#app.screen-chat .msg-gcard')
    ok(S.locator('.msg-head-txt b').inner_text() == 'Мария Иванова', 'the private chat with the teacher')
    shot(S, '10-student-dm')
    S.evaluate('() => { S.settings.theme = APP.settings.theme = "dark"; saveState(); applySettings(); }'); S.wait_for_timeout(300)
    shot(S, '11-student-dm-dark')
    S.evaluate('() => { S.settings.theme = APP.settings.theme = "light"; S.settings.lang = "en"; saveState(); applySettings(); refresh(); }'); S.wait_for_timeout(600)
    ok(S.locator('.msg-field textarea').get_attribute('placeholder') == 'Message…', 'English UI')
    shot(S, '12-student-dm-english')
    S.close()

def teacher(b):
    print('teacher on a laptop')
    T = page_for(b, 'teacher', viewport={'width': 1366, 'height': 860})
    T.goto(PAGE)
    onboarding(T, 'teacher', {'tname': 'Мария Иванова', 'school': 'СУ „Иван Вазов“'})
    T.wait_for_function('typeof cloudTestSignIn === "function"')
    T.evaluate('() => cloudTestSignIn("maria@school.bg", "Мария Иванова")')
    T.wait_for_selector('[data-in], [data-become], .t-kpis', timeout=10000)
    if T.locator('[data-in]').count(): T.click('[data-in]')
    elif T.locator('[data-become]').count(): T.click('[data-become]')
    T.wait_for_selector('.t-kpis', timeout=10000)
    me = T.evaluate(SEED, ['teacher', BASE])
    T.wait_for_timeout(400)
    ok(T.locator('.t-side [data-tnav="tMessages"]').count() == 1, 'Messages in the teacher sidebar')
    T.click('.t-side [data-tnav="tMessages"]'); T.wait_for_selector('.msg-item')
    shot(T, '20-teacher-list')
    T.click('.msg-item[data-cid="class_c1"]'); T.wait_for_selector('.msg-threadpane .msg-row')
    ok(T.locator('.msg-threadpane .msg-thread').count() == 1 and T.locator('.msg-item.on').count() == 1, 'list and chat side by side')
    shot(T, '21-teacher-class-chat')

    # Enter sends on a computer
    T.fill('.msg-field textarea', 'Утре в 8:00, не закъснявайте 🙂'); T.press('.msg-field textarea', 'Enter'); T.wait_for_timeout(800)
    ok(last_msg(T, 'class_c1')['text'] == 'Утре в 8:00, не закъснявайте 🙂', 'Enter sends')

    # the teacher removes a student's message
    T.locator('.msg-row[data-mid="m5"] .msg-bubble').click(button='right'); T.wait_for_selector('.msg-menu.in')
    ok(T.locator('.msg-menu [data-a="remove"]').count() == 1, 'the teacher can remove a student\'s message')
    T.click('.msg-menu [data-a="remove"]'); T.click('.sheet [data-act="yes"]'); T.wait_for_timeout(600)
    ok(T.evaluate('() => __fake.get("chats/class_c1/messages/m5").deletedBy') == me, 'removed by the teacher')

    # Google Drive: pick two files, give the class access, send
    T.click('[data-plus]'); T.wait_for_selector('.msg-plusgrid'); shot(T, '22-teacher-attach-menu')
    T.click('.msg-plusgrid [data-act="drive"]'); T.wait_for_selector('.msg-dfile')
    T.click('.msg-dfile[data-df="1EssayDocAbCdEfGhIj"]'); T.click('.msg-dfile[data-df="1GradesSheetAbCdEfG"]')
    T.select_option('[data-share]', 'members')
    shot(T, '23-teacher-drive-picker')
    T.click('.sheet [data-act="ok"]'); T.wait_for_timeout(800)
    perms = [u for m_, u in calls if m_ == 'POST' and u.endswith('/permissions')]
    ok(len(perms) == 2, 'both files shared with the class (Drive permissions)')
    ok(T.locator('.msg-chip').count() == 2, 'Drive files ready to send')
    T.click('[data-send]'); T.wait_for_timeout(900)
    lm = last_msg(T, 'class_c1')
    ok([l['app'] for l in lm['links']] == ['docs', 'sheets'] and lm['links'][0]['title'] == 'Есе: Под игото' and lm['links'][0].get('shared') == 'members', 'Drive files sent as Google cards')
    shot(T, '24-teacher-drive-sent')

    # a pasted Google link gets its name from Drive (the token is already there)
    T.fill('.msg-field textarea', 'Прочетете до петък: https://docs.google.com/document/d/1EssayDocAbCdEfGhIj/edit'); T.press('.msg-field textarea', 'Enter'); T.wait_for_timeout(900)
    ok(last_msg(T, 'class_c1')['links'][0]['title'] == 'Есе: Под игото', 'a pasted Google Docs link gets its title')

    # Google Meet from the header
    T.click('[data-meet]'); T.click('.sheet [data-act="yes"]'); T.wait_for_timeout(1000)
    lm = last_msg(T, 'class_c1')
    ok(lm['links'] and lm['links'][0]['app'] == 'meet' and 'meet.google.com' in lm['links'][0]['url'], 'a Google Meet call posted to the chat')
    shot(T, '25-teacher-meet')

    # a Word file opens in Google Docs (converted copy in my Drive)
    T.locator('.msg-scroll').evaluate('e => e.scrollTop = 0'); T.wait_for_timeout(300)
    with T.expect_popup() as pop:
        T.click('[data-gopen]')
    T.wait_for_timeout(800)
    ok('1ConvertedDoc123456' in pop.value.url, 'Word file opened as a Google Doc')
    ok(any('upload/drive/v3/files' in u for _, u in calls), 'uploaded to Drive with conversion')
    pop.value.close()

    # preview of a Google Slides card
    T.click('.msg-gcard [data-gprev]'); T.wait_for_selector('.sheet iframe.msg-frame'); shot(T, '26-teacher-preview')
    T.click('.sheet [data-act="no"]'); T.wait_for_timeout(300)

    # the people in the class chat, and a private chat with a student
    T.click('[data-info]'); T.wait_for_selector('.sheet .msg-person'); shot(T, '27-teacher-people')
    ok(T.locator('.sheet [data-dm]').count() == 3, 'the teacher can start a private chat with any student')
    T.click('.sheet [data-dm="s2"]'); T.wait_for_timeout(900)
    ok(T.locator('.msg-head-txt b').inner_text() == 'Борис Георгиев', 'private chat with a student opened in the pane')
    shot(T, '28-teacher-new-dm')
    T.evaluate('() => { S.settings.theme = APP.settings.theme = "dark"; saveState(); applySettings(); }'); T.wait_for_timeout(200)
    T.click('.msg-item[data-cid="class_c1"]'); T.wait_for_timeout(600); shot(T, '29-teacher-dark')
    T.close()

    # the teacher on a phone: the tab bar still fits
    P = page_for(b, 'teacher-phone', viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    P.goto(PAGE)
    onboarding(P, 'teacher', {'tname': 'Мария Иванова', 'school': 'СУ'})
    P.wait_for_function('typeof cloudTestSignIn === "function"')
    P.evaluate('() => cloudTestSignIn("maria@school.bg", "Мария Иванова")')
    P.wait_for_selector('[data-in], [data-become], .t-kpis', timeout=10000)
    if P.locator('[data-in]').count(): P.click('[data-in]')
    P.wait_for_selector('.t-kpis', timeout=10000)
    P.evaluate(SEED, ['teacher', BASE]); P.wait_for_timeout(300)
    P.click('.t-tabbar [data-tnav="tMessages"]'); P.wait_for_selector('.msg-item'); shot(P, '30-teacher-phone-list')
    ok(P.evaluate('() => { const b = document.querySelector(".t-tabbar"); return b.scrollWidth <= b.clientWidth + 1; }'), 'teacher tab bar fits on a phone')
    P.click('.msg-item[data-cid="class_c1"]'); P.wait_for_selector('#app.screen-chat .msg-row'); shot(P, '31-teacher-phone-chat')
    P.close()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    student(b)
    teacher(b)
    b.close()
srv.shutdown()
bad = [e for e in errors]
print('\n'.join(bad) if bad else 'all clean')
sys.exit(1 if bad else 0)
