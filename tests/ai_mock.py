"""Checks the Gemini paths with a fake Gemini (no key needed): hint, explain, AI task, week plan."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; SHOTS = ROOT / 'build/shots'
calls = []
def fake(route):
    body = json.loads(route.request.post_data); prompt = body['contents'][0]['parts'][0]['text']; calls.append(prompt[:60])
    if 'подсказка' in prompt: out = {'hint': 'Първо пресметни колко е $25\\%$ от цената — това е частта, която се добавя.'}
    elif 'сгрешил' in prompt: out = {'diagnosis': 'Процентът е добавен като лева', 'explanation': 'Ти добави $25$ лв., но $25\\%$ означава $25$ части от $100$ от цената.', 'check': 'Колко е $10\\%$ от $300$ лв.?'}
    elif 'нова' in prompt: out = {'prompt': 'Тетрадка струва $4$ лв. и поскъпва с $50\\%$. Колко струва сега?', 'options': ['$6$ лв.', '$54$ лв.', '$2$ лв.', '$4{,}5$ лв.'], 'answer': 0, 'misc': [None, 'pct.as_number', 'pct.only_part', 'calc'], 'explain': '$50\\%$ от $4$ е $2$, значи $4+2=6$ лв.'}
    elif 'план' in prompt: out = {'summary': 'Губиш най-много при процентите и вероятностите.', 'days': [{'day': 'Ден 1', 'focus': 'Проценти', 'do': '10 задачи за обратен процент', 'why': 'там е честата грешка'}]}
    else: out = {'ok': True, 'msg': 'Успех!'}
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates': [{'content': {'parts': [{'text': json.dumps(out, ensure_ascii=False)}]}}]}))
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2, locale='bg-BG')
    ctx.route('https://generativelanguage.googleapis.com/**', fake)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto((ROOT / 'dist/web/index.html').as_uri())
    p.evaluate("""() => { const s = JSON.parse(localStorage.getItem('bingo.v1') || '{}'); s.settings = { ...(s.settings || {}), aiMode: 'key', apiKey: 'test', model: 'gemini-3.8-flash' }; s.onboarding = { done: true, step: 0 }; localStorage.setItem('bingo.v1', JSON.stringify(s)); }""")
    p.reload(); p.click('[data-demo]'); p.wait_for_timeout(200)
    p.click('[data-start="focus"]'); p.wait_for_selector('[data-aihint]')
    p.click('[data-aihint]'); p.wait_for_selector('.aibox b'); p.screenshot(path=str(SHOTS / 'ai-01-hint.png'))
    # answer wrong, then ask Gemini why
    if p.locator('.opt').count(): p.locator('.opt').nth(1).click()
    else: p.locator('input.field').fill('999')
    p.click('[data-main]'); p.wait_for_selector('[data-aiexplain]'); p.click('[data-aiexplain]'); p.wait_for_selector('.aiexplain + .aibox b, .fb .aibox b'); p.wait_for_timeout(200)
    p.screenshot(path=str(SHOTS / 'ai-02-explain.png'), full_page=True)
    found = False
    for i in range(14):
        p.click('[data-main]'); p.wait_for_timeout(150)
        if p.locator('.result').count(): break
        if p.locator('.chips i.src-ai').count(): found = True; p.screenshot(path=str(SHOTS / 'ai-03-aitask.png')); break
        if p.locator('.opt').count(): p.locator('.opt').first.click()
        else: p.locator('input.field').fill('1')
        p.click('[data-main]'); p.wait_for_timeout(120)
    p.goto((ROOT / 'dist/web/index.html').as_uri()); p.click('[data-go="insights"]'); p.click('[data-plan]'); p.wait_for_selector('.plan li'); p.screenshot(path=str(SHOTS / 'ai-04-plan.png'))
    b.close()
print('AI calls:', len(calls), calls); print('AI task shown:', found); print('errors:', errors or 'none')
sys.exit(1 if errors or not found else 0)
