#!/usr/bin/env python3
"""
BingO build tool.

  python tools/build.py web        one self-contained page (fonts and content inside) -> dist/web/index.html
  python tools/build.py serve      live preview at http://localhost:8000
  python tools/build.py check      engine + generator tests, bundle syntax (needs Node.js 18+)
  python tools/build.py android    signed Android APK -> dist/android/BingO-<version>.apk
  python tools/build.py classcsv   simulated class for Looker Studio -> data/sample-class.csv
  python tools/build.py icons      launcher icons -> assets/icons/

The engine (engine/) is Shelly's: module format, scoring, rich text, task views, Android wrapper.
BingO's own code is in src/. Android needs a JDK 17+ and the Android SDK (build-tools 35, platform 34).
"""
import base64, functools, http.server, json, os, pathlib, re, shutil, socketserver, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST, BUILD = ROOT / 'dist', ROOT / 'build'
CFG = json.loads((ROOT / 'tools/config.json').read_text(encoding='utf-8'))
def read(p): return (p if isinstance(p, pathlib.Path) else ROOT / p).read_text(encoding='utf-8')
def write(p, text): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text, encoding='utf-8')
def say(msg): print(f'  {msg}', flush=True)

# ---------------- bundling ----------------
def js_files(): return sorted((ROOT / 'engine/js').glob('*.js')) + sorted((ROOT / 'src/js').glob('*.js'))

def content_js():
    mods, media = {}, {}
    for f in sorted((ROOT / 'content/shelly-modules').glob('*.json')):
        j = json.loads(read(f)); subj = 'math' if 'math' in f.stem else 'bel'; mods[subj] = j
        src_dir = ROOT / 'content/shelly-media' / f.stem
        for m in sorted(src_dir.rglob('*')) if src_dir.exists() else []:
            if m.is_file():
                mime = {'svg': 'image/svg+xml', 'png': 'image/png', 'jpg': 'image/jpeg', 'webp': 'image/webp'}.get(m.suffix[1:].lower(), 'application/octet-stream')
                media[j['id'] + '\n' + m.relative_to(src_dir).as_posix()] = f'data:{mime};base64,' + base64.b64encode(m.read_bytes()).decode()
    return f'window.SHELLY_MODULE_JSON = {json.dumps(mods, ensure_ascii=False)};\nwindow.SHELLY_MEDIA = {json.dumps(media)};\n'

def js_bundle():
    head = f'const APP_NAME = {json.dumps(CFG["appName"])}, APP_VERSION = {json.dumps(CFG["version"])};\n' + content_js()
    parts = [head, '/* ==== engine/vendor/katex.min.js ==== */\n' + read('engine/vendor/katex.min.js')]
    parts += [f'/* ==== {f.relative_to(ROOT).as_posix()} ==== */\n' + read(f) for f in js_files()]
    return '\n;\n'.join(parts)

def inline_fonts(css):
    def rep(m):
        f = ROOT / 'engine/fonts' / pathlib.Path(m.group(1)).name
        return f'url(data:font/woff2;base64,{base64.b64encode(f.read_bytes()).decode()})' if f.exists() else m.group(0)
    return re.sub(r'url\((?:fonts/)?([^)]+\.woff2)\)', rep, css)

def css_bundle():
    files = [ROOT / 'engine/fonts/fonts.css', ROOT / 'engine/vendor/katex.css'] + sorted((ROOT / 'engine/css').glob('*.css')) + sorted((ROOT / 'src/css').glob('*.css'))
    return inline_fonts('\n'.join(read(f) for f in files))

def page(pre_script=''):
    html = read('src/index.template.html')
    for k, v in {'TITLE': CFG['appName'], 'PRE_SCRIPT': pre_script}.items(): html = html.replace('{{' + k + '}}', v)
    html = html.replace('{{CSS}}', css_bundle(), 1)
    return re.sub(r'\{\{JS\}\}', lambda m: js_bundle(), html, count=1)

def build_web():
    out = DIST / 'web' / 'index.html'; write(out, page())
    say(f'web      -> {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)'); return out

def serve(port=8000):
    build_web()
    class H(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path in ('/', '/index.html'):
                body = page().encode('utf-8'); self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)
            else: super().do_GET()
        def log_message(self, *a): pass
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', port), functools.partial(H, directory=str(DIST / 'web'))) as s:
        say(f'serving http://localhost:{port}  (Ctrl+C to stop)'); s.serve_forever()

def node(script_path):
    n = shutil.which('node')
    if not n: sys.exit('Node.js is needed.')
    r = subprocess.run([n, str(script_path)], cwd=ROOT)
    if r.returncode: sys.exit(r.returncode)

def check():
    tmp = BUILD / 'check-bundle.js'; write(tmp, js_bundle())
    r = subprocess.run([shutil.which('node'), '--check', str(tmp)], capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit('The bundle has a syntax error.')
    say('bundle syntax ok'); node(ROOT / 'tools/check.js')

def class_csv(): node(ROOT / 'tools/classcsv.js')

# ---------------- icons ----------------
def icons():
    from PIL import Image, ImageDraw, ImageFont
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    def draw(n):
        s = 1024; im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=230, fill='#2F5BD3')
        d.ellipse([560, 300, 860, 600], fill='#FFFFFF'); d.ellipse([640, 380, 780, 520], fill='#2F5BD3')   # the target "O"
        d.ellipse([686, 426, 734, 474], fill='#FFB020')
        font = None
        for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
            if os.path.exists(f): font = ImageFont.truetype(f, 520); break
        d.text((150, 210), 'B', fill='#FFFFFF', font=font or ImageFont.load_default())
        d.rounded_rectangle([150, 790, 874, 850], radius=30, fill='#FFFFFF')
        return im.resize((n, n), Image.LANCZOS)
    out = ROOT / 'assets/icons'; draw(1024).save(out / 'icon-1024.png')
    for k, n in sizes.items():
        p = out / 'android' / f'mipmap-{k}'; p.mkdir(parents=True, exist_ok=True); draw(n).save(p / 'ic_launcher.png')
    say('icons    -> assets/icons/')

# ---------------- Android (Shelly's no-Gradle build) ----------------
def find_sdk():
    cands = [os.environ.get('ANDROID_HOME'), os.environ.get('ANDROID_SDK_ROOT'), os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk'),
             os.path.expanduser('~/Library/Android/sdk'), os.path.expanduser('~/Android/Sdk'), os.path.expanduser('~/android-sdk')]
    for c in cands:
        if c and (pathlib.Path(c) / 'build-tools').is_dir(): return pathlib.Path(c)
    sys.exit('Android SDK not found. Install it and set ANDROID_HOME to its folder.')
def vkey(name): return tuple(int(x) if x.isdigit() else 0 for x in re.split(r'[.-]', name))
def tool(folder, name):
    for ext in ('', '.exe', '.bat'):
        p = folder / (name + ext)
        if p.exists(): return str(p)
    return shutil.which(name) or sys.exit(f'Could not find "{name}" in {folder}')
def java_tool(name):
    jh = os.environ.get('JAVA_HOME')
    if jh:
        for ext in ('', '.exe'):
            p = pathlib.Path(jh) / 'bin' / (name + ext)
            if p.exists(): return str(p)
    return shutil.which(name) or sys.exit(f'"{name}" not found. Install a JDK 17+.')
def run(cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode != 0: print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(f'Step failed: {pathlib.Path(str(cmd[0])).name}')
    return r.stdout

def build_android():
    sdk = find_sdk()
    bt = sorted((d for d in (sdk / 'build-tools').iterdir() if d.is_dir()), key=lambda d: vkey(d.name))[-1]
    tgt = CFG['androidTargetSdk']
    plats = sorted((d for d in (sdk / 'platforms').glob('android-*') if (d / 'android.jar').exists()), key=lambda d: vkey(d.name.split('-')[1]))
    plat = next((d for d in plats if d.name == f'android-{tgt}'), plats[-1] if plats else None)
    if not plat: sys.exit('No Android platform installed. Install "platforms;android-34" with sdkmanager.')
    jar = plat / 'android.jar'; pa = ROOT / 'platforms/android'; b = BUILD / 'android'
    if b.exists(): shutil.rmtree(b)
    for d in ('res', 'assets', 'gen', 'classes', 'dex'): (b / d).mkdir(parents=True)
    shutil.copytree(pa / 'res', b / 'res', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'assets/icons/android', b / 'res', dirs_exist_ok=True)
    write(b / 'assets/index.html', page(pre_script='<script>\n' + read('platforms/android/bridge.js') + '\n</script>'))
    pkg = CFG['androidPackage']
    write(b / 'AndroidManifest.xml', read('platforms/android/AndroidManifest.xml').replace('package="app.shelly"', f'package="{pkg}"').replace('app.shelly.files', f'{pkg}.files'))
    write(b / 'res/values/strings.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">{CFG["appName"]}</string>\n</resources>\n')
    say(f'android  SDK {sdk} · build-tools {bt.name} · {plat.name}')
    run([tool(bt, 'aapt2'), 'compile', '--dir', b / 'res', '-o', b / 'res.zip'])
    run([tool(bt, 'aapt2'), 'link', '-o', b / 'base.apk', '-I', jar, '--manifest', b / 'AndroidManifest.xml', '-R', b / 'res.zip', '--java', b / 'gen', '-A', b / 'assets',
         '--min-sdk-version', CFG['androidMinSdk'], '--target-sdk-version', tgt, '--version-code', CFG['androidVersionCode'], '--version-name', CFG['version'], '--auto-add-overlay'])
    java = sorted((pa / 'java').rglob('*.java')) + sorted((b / 'gen').rglob('*.java'))
    run([java_tool('javac'), '-nowarn', '-Xlint:-options', '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-bootclasspath', jar, '-classpath', jar, '-d', b / 'classes'] + java)
    run([tool(bt, 'd8'), '--release', '--min-api', CFG['androidMinSdk'], '--lib', jar, '--output', b / 'dex'] + sorted((b / 'classes').rglob('*.class')))
    unsigned = b / 'unsigned.apk'; shutil.copy2(b / 'base.apk', unsigned)
    with zipfile.ZipFile(unsigned, 'a', zipfile.ZIP_DEFLATED) as zf: zf.write(b / 'dex' / 'classes.dex', 'classes.dex')
    run([tool(bt, 'zipalign'), '-p', '-f', '4', unsigned, b / 'aligned.apk'])
    sj = pa / 'signing' / 'signing.json'
    if not sj.exists():
        import secrets
        say('no signing.json: creating platforms/android/signing/ (keep it safe; never commit it)')
        pw = secrets.token_urlsafe(18)
        write(sj, json.dumps({'keystore': 'bingo.keystore', 'alias': 'bingo', 'storePassword': pw, 'keyPassword': pw}, indent=2))
    sg = json.loads(sj.read_text(encoding='utf-8')); ks = pa / 'signing' / sg['keystore']
    if not ks.exists():
        run([java_tool('keytool'), '-genkeypair', '-keystore', ks, '-alias', sg['alias'], '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-storepass', sg['storePassword'], '-keypass', sg['keyPassword'], '-dname', 'CN=BingO, O=BingO'])
    out = DIST / 'android' / f"{CFG['appName']}-{CFG['version']}.apk"; out.parent.mkdir(parents=True, exist_ok=True)
    run([tool(bt, 'apksigner'), 'sign', '--ks', ks, '--ks-key-alias', sg['alias'], '--ks-pass', 'pass:' + sg['storePassword'], '--key-pass', 'pass:' + sg['keyPassword'], '--out', out, b / 'aligned.apk'])
    run([tool(bt, 'apksigner'), 'verify', out])
    say(f'android  -> {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)'); return out

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'web'
    {'web': build_web, 'check': check, 'android': build_android, 'classcsv': class_csv, 'icons': icons}.get(cmd, lambda: serve(int(sys.argv[2]) if len(sys.argv) > 2 else 8000) if cmd == 'serve' else sys.exit(__doc__))()
