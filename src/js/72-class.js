/* ================= BingO for classes: sign-up as a teacher or a student, joining a class, shared helpers =================
   The first-run setup now asks "Учител или ученик?". A student goes on with BingO's usual setup (and can type
   a class code); a teacher gets the teacher's part (74-teacher.js…) after signing in with Google.
   Joining a class works with a 6-letter code, a QR code (a link with ?join=CODE) or an email invitation. */

Object.assign(ICONS, {
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 0 1 6 5.3"/>',
  school: '<path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12.5V17c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  live: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3A9 9 0 0 0 21 12.2z" fill="#4285F4" stroke="none"/><path d="M12 21a8.9 8.9 0 0 0 6.1-2.2l-3-2.3a5.6 5.6 0 0 1-8.3-2.9H3.7v2.4A9 9 0 0 0 12 21z" fill="#34A853" stroke="none"/><path d="M6.8 13.6a5.4 5.4 0 0 1 0-3.4V7.8H3.7a9 9 0 0 0 0 8.2z" fill="#FBBC05" stroke="none"/><path d="M12 6.6a4.9 4.9 0 0 1 3.5 1.4l2.6-2.6A8.7 8.7 0 0 0 12 3a9 9 0 0 0-8.3 4.8l3.1 2.4A5.4 5.4 0 0 1 12 6.6z" fill="#EA4335" stroke="none"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>'
});

/* ---------- shared helpers ---------- */
const KIND_LABEL = { homework: 'Домашно', test: 'Тест', live: 'На живо', practice: 'Упражнение' };
const KIND_ICON = { homework: 'book', test: 'file', live: 'live', practice: 'target' };
const SCALE_LABEL = { bg6: 'Оценка 2–6 (по прагове)', bg6exact: 'Оценка 2–6 с точност (2 + 4 × дял)', matura: 'Скала на МОН за матура', percent: 'Процент', points: 'Точки' };
const locale = () => (appLang() === 'en' ? 'en-GB' : 'bg-BG');
function fmtWhen(t, opts) {
  if (!t) return '—';
  try { return new Intl.DateTimeFormat(locale(), opts || { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); } catch (e) { return new Date(t).toLocaleString(); }
}
const fmtDay = t => fmtWhen(t, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = t => fmtWhen(t, { hour: '2-digit', minute: '2-digit' });
function fmtLeft(msLeft) {
  const s = Math.max(0, Math.round(msLeft / 1000));
  if (s >= 2 * 86400) return L('{n} дни', { n: Math.round(s / 86400) });
  if (s >= 3600) return L('{h} ч {m} мин', { h: Math.floor(s / 3600), m: Math.floor(s % 3600 / 60) });
  return fmtClock(s);
}
/* <input type="datetime-local"> works in local time */
const toLocalInput = t => { if (!t) return ''; const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = v => (v ? new Date(v).getTime() : null);
const pct = x => (x == null || !isFinite(x) ? '–' : Math.round(x * 100) + '%');
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
function errMsg(e) { return (e && e.message) || String(e); }
function failToast(e) { console.warn(e); toast(errMsg(e), 'bad'); }

/* a button shows a spinner while its work runs, and cannot be pressed twice */
async function busy(btn, work) {
  if (btn && btn.disabled) return;
  const html = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>' + html; }
  try { return await work(); }
  catch (e) { failToast(e); return undefined; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}

/* a QR code as SVG (69-qrcode.js) */
function qrSvg(text, px = 220) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, size = n + m * 2;
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg class="qrsvg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
/* the address a QR code or an invitation opens: the web version, which offers the app */
const JOIN_BASE = () => (globalThis.BINGO_WEB_URL || 'https://preotkrivanegk.com/bingo/');
const joinLink = code => JOIN_BASE() + '?join=' + encodeURIComponent(code);

/* a simple empty state */
const emptyBox = (ic, title, text, action = '') => `<div class="empty-cl">${icon(ic)}<b>${esc(title)}</b>${text ? `<p class="muted">${text}</p>` : ''}${action}</div>`;

/* ---------- first-run setup: "Учител или ученик?" ---------- */
(function patchOnboarding() {
  const steps = ONBOARD.steps, at = id => steps.findIndex(s => s.id === id);
  const student = () => S.profile.role !== 'teacher', teacher = () => S.profile.role === 'teacher';
  steps.splice(at('welcome') + 1, 0, { id: 'role', title: 'Учител или ученик?', text: 'BingO има отделна част за учители: класове, тестове, тест на живо в час, оценки и анализ с Gemini.', fields: [
    { key: 'role', path: 'profile.role', type: 'choice', list: true, required: true, options: [['student', '🎓 Ученик — подготвям се за изпит'], ['teacher', '🧑‍🏫 Учител — водя класове']], validate: v => (['student', 'teacher'].includes(v) ? '' : 'Избери едно от двете') }
  ] });
  for (const id of ['profile', 'exam', 'track', 'extra', 'subject']) {
    const s = steps[at(id)]; if (!s) continue;
    const prev = s.when; s.when = () => student() && (!prev || prev());
  }
  /* the Apps Script step becomes "join your class" (Google Sheets stays in Settings) */
  const sh = at('sheets');
  if (sh >= 0) steps.splice(sh, 1, { id: 'class', title: 'Имаш ли код на клас?', when: student, skippable: true, text: 'Ако учителят ти е дал код на клас, напиши го. Ще влезеш с Google акаунта си. Ако нямаш — пропусни, можеш да се присъединиш и по-късно.', fields: [
    { key: 'classCode', path: 'profile.classCode', type: 'text', label: 'Код на класа', ph: 'напр. K7M2QX', validate: v => (eduCodeOk(normCode(v)) ? '' : 'Кодът е 6 знака — букви и цифри') }
  ] });
  steps.splice(at('theme'), 0, { id: 'teacher', title: 'Здравейте!', when: teacher, text: 'Ще влезете с Google акаунта си (най-добре училищния). Имената ви виждат само вашите ученици.', fields: [
    { key: 'tname', path: 'profile.name', type: 'text', label: 'Име и фамилия', ph: 'напр. Мария Иванова', required: true, validate: v => (v.length > 40 ? 'Най-много 40 знака' : '') },
    { key: 'school', path: 'profile.school', type: 'text', label: 'Училище', ph: 'напр. СУ „Иван Вазов“', validate: v => (v.length > 120 ? 'Най-много 120 знака' : '') }
  ] });
})();

function afterOnboarding() {
  if (S.profile.role === 'teacher') return ['teacherSetup', {}];
  const code = normCode(S.profile.classCode);
  if (code) { S.profile.classCode = ''; saveState(true); return ['joinClass', { code }]; }
  return ['home', {}];
}
function startScreen() { return S.profile.role === 'teacher' ? 'tHome' : 'home'; }

/* ---------- the teacher signs in and is registered ---------- */
function notConfiguredCard() {
  return `<div class="card cl-note">${icon('info')}<div><b>${L('Класната стая още не е свързана')}</b><p class="muted small">${L('Тази версия на BingO няма Firebase настройки. Виж docs/firebase.md в проекта.')}</p></div></div>`;
}

SCREENS.teacherSetup = async el => {
  el.innerHTML = `<div class="pad onboarding cl-setup"><div class="brand bingo ob-brand">Bing<span>O</span></div>
    <h1 class="ob-title">${L('BingO за учители')}</h1>
    <ul class="cl-feats">
      <li>${icon('users')}<span>${L('Класове с код, QR, покана по имейл или Google Classroom')}</span></li>
      <li>${icon('file')}<span>${L('Тестове от банката на BingO, от Gemini, от Google Forms или от ваш документ')}</span></li>
      <li>${icon('live')}<span>${L('Тест на живо: виждате кой на кой въпрос е и какво пише, в реално време')}</span></li>
      <li>${icon('sparkle')}<span>${L('Gemini проверява отворените отговори и снимки на решения — като вас')}</span></li>
      <li>${icon('calendar')}<span>${L('График, повтарящи се домашни и Google Calendar')}</span></li>
    </ul>
    ${cloudConfigured() ? '' : notConfiguredCard()}
    <div class="cl-schoolcode" hidden><label class="fld"><span>${L('Код на училището')}</span><input class="field" data-sc placeholder="SCH…" autocomplete="off"></label></div>
    <p class="cl-msg muted"></p>
    <div class="ob-actions"><button class="btn accent big block" data-in${cloudConfigured() ? '' : ' disabled'}>${icon('google')}${L('Вход с Google')}</button>
      <button class="btn ghost block" data-student>${L('Продължи като ученик')}</button></div></div>`;
  el.querySelector('[data-student]').onclick = () => { S.profile.role = 'student'; S.onboarding = { done: false, step: 2, pos: 2 }; saveState(true); go('onboarding', {}, { replace: true }); };
  el.querySelector('[data-in]').onclick = e => busy(e.currentTarget, async () => {
    const r = await cloudRegister('teacher', { name: S.profile.name, school: S.profile.school, schoolCode: (el.querySelector('[data-sc]').value || '').trim() });
    cloudAfterSignIn();
    if (r.role === 'teacher' || r.role === 'admin') { toast(L('Добре дошли!')); return go('tHome', {}, { replace: true }); }
    el.querySelector('.cl-msg').textContent = L(r.message || 'Учителският достъп още не е разрешен.');
    if (/код/i.test(r.message || '')) el.querySelector('.cl-schoolcode').hidden = false;
  });
};

/* ---------- joining a class ---------- */
SCREENS.joinClass = async (el, { code = '' }) => {
  el.innerHTML = `${topbar(L('Присъедини се към клас'))}<section class="pad cl-join">
    <h1 class="screen-title">${L('Присъедини се към клас')}</h1>
    <div class="card"><label class="fld"><span>${L('Код от учителя')}</span><input class="field codefield" data-code maxlength="8" value="${esc(normCode(code))}" placeholder="K7M2QX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <button class="btn accent big block" data-join${cloudConfigured() ? '' : ' disabled'}>${icon('users')}${L('Влез в класа')}</button>
      ${'BarcodeDetector' in window ? `<button class="btn ghost block" data-scan>${icon('qr')}${L('Сканирай QR кода')}</button>` : ''}
      <p class="muted small">${L('Влизаш с Google акаунта си. Учителят вижда името ти, резултатите от тестовете и картата на уменията ти от BingO.')}</p></div>
    ${cloudConfigured() ? '' : notConfiguredCard()}
    <div class="cl-scanbox" hidden><video playsinline muted></video><button class="btn ghost block" data-stopscan>${L('Затвори камерата')}</button></div></section>`;
  const inp = el.querySelector('[data-code]');
  inp.addEventListener('input', () => { inp.value = normCode(inp.value); });
  let stream = null;
  const stopScan = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; el.querySelector('.cl-scanbox').hidden = true; };
  const nav = NAV[NAV.length - 1]; nav.onLeave = stopScan;
  let joining = false;
  const join = async btn => { if (joining) return; joining = true; try { await joinNow(btn); } finally { joining = false; } };
  const joinNow = async btn => busy(btn, async () => {
    const c = normCode(inp.value);
    if (!eduCodeOk(c)) throw new Error(L('Кодът е 6 знака — букви и цифри'));
    if (!signedIn() || !CLOUD.role) { await cloudRegister('student'); cloudAfterSignIn(); }
    const r = await callFn('joinClass', { code: c });
    toast(L('Вече си в {c}!', { c: r.name }));
    go('classes', {}, { replace: true });
  });
  el.querySelector('[data-join]').onclick = e => join(e.currentTarget);
  el.querySelector('[data-scan]')?.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const box = el.querySelector('.cl-scanbox'), v = box.querySelector('video'); box.hidden = false; v.srcObject = stream; await v.play();
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!stream) return;
        try {
          const found = await det.detect(v);
          const raw = found[0] && found[0].rawValue;
          if (raw) { const m = raw.match(/[?&]join=([A-Za-z0-9]{6})/) || raw.match(/^([A-Za-z0-9]{6})$/); if (m) { inp.value = normCode(m[1]); stopScan(); return join(el.querySelector('[data-join]')); } }
        } catch (e) { }
        setTimeout(tick, 300);
      };
      tick();
    } catch (e) { toast(L('Няма достъп до камерата'), 'bad'); }
  });
  el.querySelector('[data-stopscan]').onclick = stopScan;
  if (eduCodeOk(normCode(code)) && signedIn()) join(el.querySelector('[data-join]'));
};

/* ---------- the account card (Profile and Settings) ---------- */
function accountCardHTML() {
  if (!cloudConfigured()) return '';
  const u = CLOUD.user;
  const role = CLOUD.role === 'admin' ? L('Администратор') : CLOUD.role === 'teacher' ? L('Учител') : L('Ученик');
  return `<div class="card cl-account"><h3>${icon('school')}${L('Класна стая')}</h3>
    ${u ? `<div class="cl-acc-row">${u.photoURL ? `<img class="cl-ava" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="cl-ava">${esc((u.displayName || u.email || '?')[0].toUpperCase())}</span>`}<div><b>${esc(u.displayName || '')}</b><small class="muted">${esc(u.email || '')} · ${role}</small></div></div>
      <div class="cl-acc-actions">${isTeacher() ? `<button class="btn ghost small" data-acc="teacher">${icon('school')}${L('Учителска част')}</button>` : `<button class="btn ghost small" data-acc="classes">${icon('users')}${L('Моите класове')}</button>`}<button class="btn ghost small" data-acc="out">${icon('logout')}${L('Изход')}</button></div>`
    : `<p class="muted small">${L('Влез с Google, за да се присъединиш към клас и да получаваш тестове и домашни от учителя.')}</p><button class="btn ghost block" data-acc="in">${icon('google')}${L('Вход с Google')}</button>`}</div>`;
}
function mountAccountCard(el) {
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-acc]'); if (!b) return;
    const a = b.dataset.acc;
    if (a === 'in') return busy(b, async () => { await cloudRegister(S.profile.role === 'teacher' ? 'teacher' : 'student'); cloudAfterSignIn(); refresh(); });
    if (a === 'out') return busy(b, async () => { await signOutCloud(); S.cloud = null; saveState(true); refresh(); });
    if (a === 'classes') return go('classes');
    if (a === 'teacher') { S.profile.role = 'teacher'; saveState(true); NAV.length = 0; NAV.push({ screen: 'tHome', params: {} }); render(); }
  });
}
['profile', 'settings'].forEach(name => {
  const inner = SCREENS[name]; if (!inner) return;
  SCREENS[name] = async (el, ...rest) => {
    await inner(el, ...rest);
    if (!cloudConfigured()) return;
    const host = el.querySelector('section.pad, .pad'); if (!host) return;
    const first = host.querySelector('.card');
    const html = accountCardHTML();
    if (first) first.insertAdjacentHTML(name === 'profile' ? 'afterend' : 'beforebegin', html); else host.insertAdjacentHTML('beforeend', html);
    mountAccountCard(el);
    if (!CLOUD.ready) cloudLoad().then(() => { if (NAV[NAV.length - 1] && NAV[NAV.length - 1].screen === name) cloudChanged(); }).catch(() => { });
  };
});
