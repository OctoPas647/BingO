/* ================= BingO for teachers: the frame, the dashboard, classes and students =================
   On a laptop the teacher's part has a sidebar; on a phone a tab bar. The sections are
   Табло · Класове · Тестове · Календар · Асистент · Още; details (a class, a test, a live test, grading)
   open on top and go back with the back button. Everything updates live from Firestore. */

const T_NAV = [['tHome', 'home', 'Табло'], ['tClasses', 'users', 'Класове'], ['tTests', 'file', 'Тестове'], ['tCalendar', 'calendar', 'Календар'], ['tAI', 'sparkle', 'Асистент'], ['tMore', 'settings', 'Още']];
const T_ROOTS = T_NAV.map(x => x[0]);

function tGo(to, params = {}) {
  if (to === 'tHome') { while (NAV.length > 1) leave(NAV.pop()); NAV[0] = { screen: 'tHome', params: {} }; return render(); }
  const top = NAV[NAV.length - 1];
  if (T_ROOTS.includes(top.screen) && top.screen !== 'tHome') return go(to, params, { replace: true });
  while (NAV.length > 1) leave(NAV.pop());
  go(to, params);
}

/* the frame: sidebar + header + body; returns the body element */
function tFrame(el, cur, { title = '', kicker = '', actions = '', backBtn = false, wide = false } = {}) {
  el.classList.add('t-screen'); if (wide) el.classList.add('t-wide');
  const u = CLOUD.user;
  const navBtns = cls => T_NAV.map(([id, ic, label]) => `<button data-tnav="${id}" class="${cls} ${id === cur ? 'on' : ''}"${id === cur ? ' aria-current="page"' : ''}>${icon(ic)}<span>${L(label)}</span></button>`).join('');
  el.innerHTML = `<aside class="t-side"><div class="brand bingo">Bing<span>O</span><small>${L('за учители')}</small></div><nav>${navBtns('t-navbtn')}</nav>
      ${u ? `<div class="t-me">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((u.displayName || '?')[0])}</span>`}<div><b>${esc((CLOUD.profile && CLOUD.profile.name) || u.displayName || '')}</b><small>${esc((CLOUD.profile && CLOUD.profile.school) || u.email || '')}</small></div></div>` : ''}</aside>
    <div class="t-main"><header class="t-head">${backBtn ? `<button class="iconbtn" data-back aria-label="${L('Назад')}">${icon('back')}</button>` : ''}<div class="t-titles">${kicker ? `<span class="kicker">${kicker}</span>` : ''}<h1>${title}</h1></div><div class="t-actions">${actions}</div></header><div class="t-body"></div></div>
    <nav class="tabbar t-tabbar" aria-label="${L('Основно меню')}">${T_NAV.filter(x => x[0] !== 'tMore' || true).map(([id, ic, label]) => `<button data-tnav="${id}" class="${id === cur ? 'on' : ''}">${icon(ic)}<span>${L(label)}</span></button>`).join('')}</nav>`;
  el.querySelectorAll('[data-tnav]').forEach(b => b.addEventListener('click', () => tGo(b.dataset.tnav)));
  return el.querySelector('.t-body');
}

/* only a signed-in teacher gets in; otherwise a sign-in panel */
async function tGate(el, cur) {
  const body = tFrame(el, cur, { title: L('BingO за учители') });
  if (!cloudConfigured()) { body.innerHTML = notConfiguredCard() + `<button class="btn ghost" data-student>${L('Към ученическата част')}</button>`; body.querySelector('[data-student]').onclick = toStudent; return false; }
  body.innerHTML = skel('teacher');
  try { await cloudLoad(); } catch (e) { body.innerHTML = `<div class="card error">${esc(errMsg(e))}</div>`; return false; }
  if (signedIn() && isTeacher()) return true;
  body.innerHTML = `<div class="card cl-hero">${icon('school')}<h3>${signedIn() ? L('Този акаунт още не е учителски') : L('Влезте с Google')}</h3>
    <p class="muted">${signedIn() ? esc(CLOUD.user.email) + ' · ' + L('Натиснете „Стани учител“ или влезте с друг акаунт.') : L('Учителската част работи с Google акаунт, за да виждате класовете си от всяко устройство.')}</p>
    <div class="cl-acc-actions">${signedIn() ? `<button class="btn accent" data-become>${icon('school')}${L('Стани учител')}</button><button class="btn ghost" data-out>${icon('logout')}${L('Друг акаунт')}</button>` : `<button class="btn accent big" data-in>${icon('google')}${L('Вход с Google')}</button>`}
    <button class="btn ghost" data-student>${L('Към ученическата част')}</button></div><p class="cl-msg muted"></p></div>`;
  body.querySelector('[data-student]').onclick = toStudent;
  body.querySelector('[data-in]')?.addEventListener('click', e => busy(e.currentTarget, async () => { const r = await cloudRegister('teacher'); cloudAfterSignIn(); if (r.message) body.querySelector('.cl-msg').textContent = L(r.message); refresh(); }));
  body.querySelector('[data-become]')?.addEventListener('click', e => busy(e.currentTarget, async () => { const r = await cloudRegister('teacher'); if (r.message) body.querySelector('.cl-msg').textContent = L(r.message); refresh(); }));
  body.querySelector('[data-out]')?.addEventListener('click', e => busy(e.currentTarget, async () => { await signOutCloud(); refresh(); }));
  return false;
}
function toStudent() {
  S.profile.role = 'student'; saveState(true);
  NAV.length = 0; NAV.push({ screen: onboardingNeeded() ? 'onboarding' : 'home', params: {} }); render();
}

/* the teacher's data, shared by the screens: classes and assignments, kept live while a teacher screen is open */
const TD = { classes: [], asg: [], results: [], progress: [], tests: [], subs: [] };
function tWatchBase(nav, onChange, what = ['classes', 'asg']) {
  const uid = myUid();
  if (what.includes('classes')) watch(col('classes').where('teacherIds', 'array-contains', uid), s => { TD.classes = docs(s).sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true })); onChange(); }, nav);
  if (what.includes('asg')) watch(col('assignments').where('teacherIds', 'array-contains', uid).orderBy('createdAt', 'desc').limit(300), s => { TD.asg = docs(s); onChange(); }, nav);
  if (what.includes('results')) watch(col('results').where('teacherIds', 'array-contains', uid).orderBy('gradedAt', 'desc').limit(600), s => { TD.results = docs(s); onChange(); }, nav);
  if (what.includes('progress')) watch(col('progress').where('teacherIds', 'array-contains', uid), s => { TD.progress = docs(s); onChange(); }, nav);
}
const classById = id => TD.classes.find(c => c.id === id);
const asgState = a => (a.kind === 'live' ? (a.live && a.live.state === 'ended' || a.status === 'closed' ? 'closed' : a.live && a.live.state !== 'lobby' ? 'live' : 'ready') : a.status === 'scheduled' ? 'scheduled' : a.status === 'closed' ? 'closed' : 'open');
const ASG_STATE = { live: 'Тече сега', ready: 'Готов за старт', scheduled: 'Насрочен', open: 'Отворен', closed: 'Приключил' };
const avg = xs => (xs.length ? sum(xs) / xs.length : null);

function asgRow(a, extra = '') {
  const st = asgState(a);
  const when = st === 'scheduled' ? L('отваря {d}', { d: fmtWhen(tsMs(a.opensAt)) }) : tsMs(a.closesAt) ? L('до {d}', { d: fmtWhen(tsMs(a.closesAt)) }) : fmtDay(tsMs(a.createdAt));
  return `<button class="cl-asg t-asg" data-tasg="${esc(a.id)}"><span class="cl-asg-ic k-${a.kind}">${icon(KIND_ICON[a.kind] || 'file')}</span>
    <span class="cl-asg-main"><b>${esc(a.title)}</b><small class="muted">${esc(L(KIND_LABEL[a.kind]))}${a.mode === 'quiz' ? ' · ' + L('куиз') : ''} · ${esc(a.className || '')} · ${esc(when)}</small></span>${extra}<span class="cl-pill p-${st}">${esc(L(ASG_STATE[st]))}</span></button>`;
}
function openAsg(id) { const a = TD.asg.find(x => x.id === id); go(a && a.kind === 'live' && asgState(a) !== 'closed' ? 'tLive' : 'tAssignment', { aid: id }); }

/* ---------- Табло ---------- */
SCREENS.tHome = async (el, p, nav) => {
  if (!(await tGate(el, 'tHome'))) return;
  const name = ((CLOUD.profile && CLOUD.profile.name) || CLOUD.user.displayName || '').split(' ')[0];
  const hour = new Date().getHours(), hello = hour < 11 ? L('Добро утро') : hour < 18 ? L('Добър ден') : L('Добър вечер');
  const body = tFrame(el, 'tHome', { title: `${hello}${name ? ', ' + esc(name) : ''}`, kicker: esc(fmtWhen(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })), actions: `<button class="btn accent small" data-new-test>${icon('plus')}${L('Нов тест')}</button><button class="btn ghost small" data-new-live>${icon('live')}${L('Тест на живо')}</button>` });
  const draw = () => {
    const live = TD.asg.filter(a => a.kind === 'live' && ['live', 'ready'].includes(asgState(a)));
    const students = new Set(TD.classes.flatMap(c => c.studentIds || []));
    const open = TD.asg.filter(a => ['open', 'scheduled'].includes(asgState(a)) && a.kind !== 'live');
    const review = TD.results.filter(r => r.needsReview);
    const byAsg = {}; TD.results.forEach(r => (byAsg[r.assignmentId] = byAsg[r.assignmentId] || []).push(r));
    const soon = TD.asg.filter(a => { const t = tsMs(a.opensAt), c = tsMs(a.closesAt), now = Date.now(); return (a.status === 'scheduled' && t < now + 7 * 864e5) || (a.status === 'open' && c && c > now && c < now + 7 * 864e5); }).sort((x, y) => (tsMs(x.status === 'scheduled' ? x.opensAt : x.closesAt)) - (tsMs(y.status === 'scheduled' ? y.opensAt : y.closesAt)));
    const recent = TD.asg.filter(a => byAsg[a.id]).slice(0, 6);
    const weak = classWeakSkills(TD.progress).slice(0, 5);
    body.innerHTML = `
      ${live.map(a => `<button class="card cl-livebanner t-livebanner" data-tasg="${esc(a.id)}"><span class="cl-dot"></span><div><b>${esc(a.title)}</b><small>${esc(a.className || '')} · ${esc(L(ASG_STATE[asgState(a)]))}</small></div><span class="btn accent small">${icon('tv')}${L('Монитор')}</span></button>`).join('')}
      <div class="t-kpis">
        <div class="card t-kpi"><b>${TD.classes.filter(c => !c.archived).length}</b><small>${L('класа')}</small></div>
        <div class="card t-kpi"><b>${students.size}</b><small>${L('ученици')}</small></div>
        <div class="card t-kpi"><b>${open.length}</b><small>${L('отворени задания')}</small></div>
        <div class="card t-kpi ${review.length ? 'warn' : ''}"><b>${review.length}</b><small>${L('за проверка')}</small></div></div>
      <div class="t-grid">
        <div class="card"><h3>${icon('pen')}${L('За проверка')}</h3>${review.length ? groupReview(review) : `<p class="muted">${L('Всичко е проверено.')}</p>`}</div>
        <div class="card"><h3>${icon('calendar')}${L('Следващите 7 дни')}</h3>${soon.length ? `<div class="cl-list">${soon.slice(0, 6).map(a => asgRow(a)).join('')}</div>` : `<p class="muted">${L('Нищо насрочено.')}</p>`}</div>
        <div class="card"><h3>${icon('chart')}${L('Последни резултати')}</h3>${recent.length ? `<div class="cl-list">${recent.map(a => { const rs = byAsg[a.id] || []; return asgRow(a, `<span class="t-avg">${pct(avg(rs.map(r => r.pct)))}<small>${rs.length}/${(a.studentIds || []).length}</small></span>`); }).join('')}</div>` : `<p class="muted">${L('Още няма предадени работи.')}</p>`}</div>
        <div class="card"><h3>${icon('target')}${L('Слаби места на учениците')}</h3>${weak.length ? weakList(weak) : `<p class="muted">${L('Когато учениците ви упражняват в BingO, тук ще видите кои умения им струват най-много точки.')}</p>`}</div>
      </div>
      ${!TD.classes.length ? `<div class="card cl-hero">${icon('users')}<h3>${L('Започнете с клас')}</h3><p class="muted">${L('Създайте клас и дайте на учениците кода или QR кода. Можете и да внесете класовете си от Google Classroom.')}</p><button class="btn accent" data-new-class>${icon('plus')}${L('Нов клас')}</button></div>` : ''}`;
  };
  tWatchBase(nav, draw, ['classes', 'asg', 'results', 'progress']);
  draw();
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-tasg]'); if (a) return openAsg(a.dataset.tasg);
    const r = e.target.closest('[data-rev]'); if (r) return go('tAssignment', { aid: r.dataset.rev, tab: 'review' });
    if (e.target.closest('[data-new-test]')) return go('tTestEdit', {});
    if (e.target.closest('[data-new-live]')) return go('tTestEdit', { live: true });
    if (e.target.closest('[data-new-class]')) return newClassSheet();
    const sk = e.target.closest('[data-skill]'); if (sk) return go('tClasses');
  });
};
function groupReview(list) {
  const g = {}; list.forEach(r => { (g[r.assignmentId] = g[r.assignmentId] || { title: r.title, n: 0 }).n++; });
  return `<div class="cl-list">${Object.entries(g).map(([id, x]) => `<button class="cl-asg" data-rev="${esc(id)}"><span class="cl-asg-ic">${icon('pen')}</span><span class="cl-asg-main"><b>${esc(x.title)}</b><small class="muted">${L('{n} работи чакат', { n: x.n })}</small></span>${icon('next')}</button>`).join('')}</div>`;
}

/* skills where the students lose the most, from everyday BingO practice */
function classWeakSkills(progress, classId) {
  const tot = {};
  for (const p of progress) {
    if (classId && !(p.classIds || []).includes(classId)) continue;
    for (const [k, v] of Object.entries(p.skills || {})) {
      if (!v || !isFinite(v.p)) continue;
      const e = tot[k] || (tot[k] = { key: k, name: v.name || k, lost: 0, p: [], weak: [], misc: {} });
      e.lost += (v.w || 1) * (1 - v.p); e.p.push(v.p); if (v.status === 'weak') e.weak.push(p.name || p.id);
      (v.misc || []).forEach(m => { e.misc[m.label || m.k] = (e.misc[m.label || m.k] || 0) + m.n; });
    }
  }
  return Object.values(tot).map(x => ({ ...x, avgP: avg(x.p), n: x.p.length, topMisc: Object.entries(x.misc).sort((a, b) => b[1] - a[1]).slice(0, 2).map(m => m[0]) })).sort((a, b) => b.lost / b.n - a.lost / a.n);
}
function weakList(list) {
  return `<div class="t-weak">${list.map(x => `<div class="t-weakrow"><div><b>${esc(L(x.name))}</b><small class="muted">${esc(SUBJECTS[x.key.split('.')[0]] ? L(SUBJECTS[x.key.split('.')[0]].short) : '')} · ${L('{n} ученици', { n: x.n })}${x.weak.length ? ' · ' + L('{n} слаби', { n: x.weak.length }) : ''}${x.topMisc.length ? ' · ' + esc(x.topMisc.join(', ')) : ''}</small></div>${bar(x.avgP, x.avgP < 0.6 ? 'weak' : x.avgP < 0.9 ? 'mid' : 'strong')}<span class="t-avg">${pct(x.avgP)}</span></div>`).join('')}</div>`;
}

/* ---------- Класове ---------- */
SCREENS.tClasses = async (el, p, nav) => {
  if (!(await tGate(el, 'tClasses'))) return;
  const body = tFrame(el, 'tClasses', { title: L('Класове'), actions: `<button class="btn accent small" data-new-class>${icon('plus')}${L('Нов клас')}</button><button class="btn ghost small" data-classroom>${icon('google')}${L('От Google Classroom')}</button>` });
  let showArchived = false;
  const draw = () => {
    const list = TD.classes.filter(c => !!c.archived === showArchived);
    body.innerHTML = `${list.length ? `<div class="t-cards">${list.map(c => `<button class="card t-classcard" data-class="${esc(c.id)}" style="--cc:${esc(c.color || '#2F5BD3')}"><span class="t-cc-band"></span><b>${esc(c.name)}</b><small class="muted">${esc(c.subject || '')}${c.grade ? ' · ' + esc(c.grade) + ' ' + L('клас') : ''}</small>
        <div class="t-cc-foot"><span>${icon('users')}${(c.studentIds || []).length}</span><span class="t-code">${esc(c.code)}</span></div></button>`).join('')}</div>`
      : emptyBox('users', showArchived ? L('Няма архивирани класове') : L('Още нямате класове'), showArchived ? '' : L('Създайте клас или го внесете от Google Classroom.'))}
      <button class="linkbtn" data-arch>${showArchived ? L('Покажи активните') : L('Покажи архивираните')}</button>`;
  };
  tWatchBase(nav, draw, ['classes']); draw();
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-class]'); if (c) return go('tClass', { cid: c.dataset.class });
    if (e.target.closest('[data-new-class]')) return newClassSheet();
    if (e.target.closest('[data-classroom]')) return classroomImportSheet();
    if (e.target.closest('[data-arch]')) { showArchived = !showArchived; draw(); }
  });
};

const CLASS_COLORS = ['#2F5BD3', '#E5484D', '#30A46C', '#F76B15', '#8E4EC6', '#0091FF', '#D6409F', '#AD7F58'];
async function newClassSheet(prefill = {}) {
  const r = await sheet({ title: L('Нов клас'), body: `
    <label class="fld"><span>${L('Име')}</span><input class="field" data-f="name" placeholder="${L('напр. 11Б')}" value="${esc(prefill.name || '')}" maxlength="40"></label>
    <label class="fld"><span>${L('Предмет')}</span><input class="field" data-f="subject" placeholder="${L('напр. Математика')}" value="${esc(prefill.subject || (CLOUD.profile && (CLOUD.profile.subjects || [])[0]) || '')}" list="t-subjects"></label>
    <datalist id="t-subjects">${Object.values(SUBJECTS).map(s => `<option value="${esc(L(s.title))}">`).join('')}</datalist>
    <label class="fld"><span>${L('Клас (година)')}</span><input class="field" data-f="grade" placeholder="11" value="${esc(prefill.grade || '')}" maxlength="10"></label>
    <div class="t-colors">${CLASS_COLORS.map((c, i) => `<button data-color="${c}" style="background:${c}" class="${i === 0 ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Създай'), kind: 'primary' }],
    onMount: (sh, o) => {
      sh.addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { sh.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b)); } });
      const okBtn = sh.querySelector('[data-act="ok"]');
      okBtn.addEventListener('click', ev => {
        ev.stopPropagation();
        const v = k => sh.querySelector(`[data-f="${k}"]`).value.trim();
        if (!v('name')) return toast(L('Напишете име на класа'), 'bad');
        busy(okBtn, async () => {
          const res = await callFn('createClass', { name: v('name'), subject: v('subject'), grade: v('grade'), color: sh.querySelector('[data-color].on').dataset.color, classroomId: prefill.classroomId || '' });
          o.close(res);
        });
      }, true);
    }
  });
  if (r && r.classId) { toast(L('Класът е създаден. Код: {c}', { c: r.code })); go('tClass', { cid: r.classId }); }
  return r;
}

/* ---------- one class ---------- */
SCREENS.tClass = async (el, { cid, tab = 'students' }, nav) => {
  if (!(await tGate(el, 'tClasses'))) return;
  let C = null, members = [], prog = [], results = [], asg = [];
  const body = tFrame(el, 'tClasses', { title: '…', backBtn: true, wide: true });
  const draw = () => {
    if (!C) return;
    el.querySelector('.t-titles').innerHTML = `<span class="kicker">${esc(C.subject || '')}${C.grade ? ' · ' + esc(C.grade) + ' ' + L('клас') : ''}</span><h1>${esc(C.name)}</h1>`;
    el.querySelector('.t-actions').innerHTML = `<button class="t-codechip" data-qr>${icon('qr')}<b>${esc(C.code)}</b></button><button class="btn accent small" data-assign>${icon('send')}${L('Задай')}</button>`;
    const tabs = [['students', 'Ученици'], ['work', 'Задания'], ['book', 'Дневник'], ['skills', 'Умения'], ['settings', 'Настройки']];
    body.innerHTML = `<div class="seg t-tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${L(l)}</button>`).join('')}</div><div class="t-tabbody"></div>`;
    const tb = body.querySelector('.t-tabbody');
    if (tab === 'students') tb.innerHTML = studentsTab();
    if (tab === 'work') tb.innerHTML = asg.length ? `<div class="cl-list">${asg.map(a => { const rs = results.filter(r => r.assignmentId === a.id); return asgRow(a, rs.length ? `<span class="t-avg">${pct(avg(rs.map(r => r.pct)))}<small>${rs.length}/${(a.studentIds || []).length}</small></span>` : ''); }).join('')}</div>` : emptyBox('file', L('Още няма задания'), '', `<button class="btn accent" data-assign>${icon('send')}${L('Задай тест или домашно')}</button>`);
    if (tab === 'book') tb.innerHTML = gradebookHTML();
    if (tab === 'skills') { const w = classWeakSkills(prog, cid); tb.innerHTML = w.length ? `<div class="card">${weakList(w.slice(0, 15))}</div><button class="btn accent" data-weakhw>${icon('target')}${L('Домашно върху най-слабите умения')}</button>` : emptyBox('target', L('Още няма данни'), L('Когато учениците упражняват в BingO, тук виждате картата на уменията на класа.')); }
    if (tab === 'settings') tb.innerHTML = classSettingsHTML();
  };
  const studentsTab = () => {
    const progOf = uid => prog.find(p => p.id === uid);
    const avgOf = uid => avg(results.filter(r => r.studentId === uid).map(r => r.pct));
    const invited = C.invited || [];
    return `<div class="t-row-actions"><button class="btn ghost small" data-invite>${icon('mail')}${L('Покани по имейл')}</button><button class="btn ghost small" data-csv>${icon('upload')}${L('Внеси CSV')}</button><button class="btn ghost small" data-qr>${icon('qr')}${L('QR код')}</button></div>
      ${members.length ? `<div class="t-table"><table><thead><tr><th>${L('Ученик')}</th><th>${L('Среден резултат')}</th><th>${L('Упражнява')}</th><th>${L('Последно')}</th><th></th></tr></thead><tbody>
        ${members.map(m => { const pr = progOf(m.id), a = avgOf(m.id); return `<tr data-student="${esc(m.id)}"><td><b>${esc(m.name || m.email)}</b><small class="muted">${esc(m.email || '')}</small></td><td>${a == null ? '–' : `<span class="t-score ${a < 0.5 ? 'bad' : a < 0.8 ? 'mid' : 'good'}">${pct(a)}</span>`}</td><td>${pr ? L('{n} отг. / 7 дни', { n: pr.answers7 || 0 }) : '–'}</td><td>${pr && pr.updatedAt ? fmtDay(tsMs(pr.updatedAt)) : '–'}</td><td><button class="iconbtn" data-remove="${esc(m.id)}" aria-label="${L('Махни')}">${icon('trash')}</button></td></tr>`; }).join('')}</tbody></table></div>`
        : emptyBox('users', L('Още няма ученици'), L('Дайте им кода {c} или QR кода. Учениците влизат с Google и пишат кода в „Клас“.', { c: `<b>${esc(C.code)}</b>` }))}
      ${invited.length ? `<h3 class="t-sub">${L('Поканени, още не са влезли')}</h3><div class="t-chips">${invited.map(e => `<span class="t-chip">${esc(e)}<button data-uninvite="${esc(e)}" aria-label="${L('Махни')}">${icon('close')}</button></span>`).join('')}</div>` : ''}`;
  };
  const gradebookHTML = () => {
    const cols = asg.filter(a => a.kind !== 'practice' || results.some(r => r.assignmentId === a.id)).slice().reverse();
    if (!cols.length || !members.length) return emptyBox('grid', L('Дневникът е празен'), L('Оценките от тестовете се появяват тук автоматично.'));
    return `<div class="t-row-actions"><button class="btn ghost small" data-export="csv">${icon('download')}CSV</button><button class="btn ghost small" data-export="xls">${icon('download')}Excel</button><button class="btn ghost small" data-export="sheet">${icon('google')}Google Sheets</button></div>
      <div class="t-table t-book"><table><thead><tr><th>${L('Ученик')}</th>${cols.map(a => `<th title="${esc(a.title)}"><button class="linkbtn" data-tasg="${esc(a.id)}">${esc(a.title.slice(0, 18))}</button><small>${fmtDay(tsMs(a.createdAt))}</small></th>`).join('')}<th>${L('Средно')}</th></tr></thead><tbody>
      ${members.map(m => { const mine = cols.map(a => results.find(r => r.assignmentId === a.id && r.studentId === m.id)); const ps = mine.filter(Boolean).map(r => r.pct); return `<tr><td><b>${esc(m.name || m.email)}</b></td>${mine.map((r, k) => `<td>${r ? `<button class="t-gradecell ${r.needsReview ? 'rev' : ''}" data-grade="${esc(cols[k].id)}_${esc(m.id)}" title="${pct(r.pct)}">${esc((r.grade && (r.grade.value != null && r.grade.scale !== 'percent' && r.grade.scale !== 'points' ? String(r.grade.value).replace('.', ',') : r.grade.text)) || pct(r.pct))}</button>` : '<span class="muted">·</span>'}</td>`).join('')}<td><b>${ps.length ? pct(avg(ps)) : '–'}</b></td></tr>`; }).join('')}</tbody></table></div>`;
  };
  const classSettingsHTML = () => `<div class="card t-form">
      <label class="fld"><span>${L('Име')}</span><input class="field" data-cf="name" value="${esc(C.name)}" maxlength="40"></label>
      <label class="fld"><span>${L('Предмет')}</span><input class="field" data-cf="subject" value="${esc(C.subject || '')}"></label>
      <label class="fld"><span>${L('Клас (година)')}</span><input class="field" data-cf="grade" value="${esc(C.grade || '')}" maxlength="10"></label>
      <div class="t-colors">${CLASS_COLORS.map(c => `<button data-color="${c}" style="background:${c}" class="${c === C.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
      <button class="btn accent" data-savecls>${L('Запази')}</button></div>
    <div class="card"><h3>${icon('qr')}${L('Код за влизане')}</h3><p class="muted small">${L('Нов код спира стария — който още не е влязъл, ще трябва да ползва новия.')}</p><button class="btn ghost" data-newcode>${L('Нов код')}</button></div>
    <div class="card"><h3>${icon('users')}${L('Още учители в класа')}</h3><p class="muted small">${L('Друг учител (с акаунт в BingO) ще вижда класа, заданията и оценките.')}</p><div class="t-inline"><input class="field" data-coteacher placeholder="${L('имейл на учителя')}"><button class="btn ghost" data-addteacher>${L('Добави')}</button></div></div>
    <div class="card"><h3>${icon('trash')}${L('Архив и изтриване')}</h3><button class="btn ghost" data-archive>${C.archived ? L('Върни от архива') : L('Архивирай')}</button> ${C.ownerId === myUid() ? `<button class="btn ghost danger-text" data-delcls>${L('Изтрий класа')}</button>` : ''}</div>`;

  watch(docRef('classes/' + cid), s => { if (!s.exists) { body.innerHTML = emptyBox('info', L('Класът е изтрит'), ''); return; } C = { id: s.id, ...s.data() }; draw(); }, nav, () => { body.innerHTML = `<div class="card error">${L('Нямате достъп до този клас.')}</div>`; });
  watch(col(`classes/${cid}/members`), s => { members = docs(s).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bg')); draw(); }, nav);
  watch(col('progress').where('teacherIds', 'array-contains', myUid()), s => { prog = docs(s).filter(p => (p.classIds || []).includes(cid)); draw(); }, nav);
  watch(col('results').where('teacherIds', 'array-contains', myUid()).where('classId', '==', cid), s => { results = docs(s); draw(); }, nav);
  watch(col('assignments').where('teacherIds', 'array-contains', myUid()).where('classId', '==', cid), s => { asg = docs(s).sort((a, b) => (tsMs(b.createdAt) || 0) - (tsMs(a.createdAt) || 0)); TD.asg = [...asg, ...TD.asg.filter(x => x.classId !== cid)]; draw(); }, nav);

  el.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; NAV[NAV.length - 1].params.tab = tab; return draw(); }
    if (e.target.closest('[data-qr]')) return qrSheet(C);
    if (e.target.closest('[data-assign]')) return go('tTests', { pickFor: cid });
    if (e.target.closest('[data-invite]')) return inviteSheet(C);
    if (e.target.closest('[data-csv]')) return csvImport(C);
    const st = e.target.closest('[data-student]'); if (st && !e.target.closest('[data-remove]')) return go('tStudent', { cid, uid: st.dataset.student });
    const rm = e.target.closest('[data-remove]'); if (rm) return confirmBox(L('Да махна ли ученика?'), L('Резултатите му остават, но няма да получава нови задания.'), L('Махни'), true).then(ok => ok && callFn('removeStudent', { classId: cid, uid: rm.dataset.remove }).catch(failToast));
    const un = e.target.closest('[data-uninvite]'); if (un) return callFn('removeStudent', { classId: cid, email: un.dataset.uninvite }).catch(failToast);
    const a = e.target.closest('[data-tasg]'); if (a) return openAsg(a.dataset.tasg);
    const g = e.target.closest('[data-grade]'); if (g) return go('tGrade', { attemptId: g.dataset.grade });
    const ex = e.target.closest('[data-export]'); if (ex) return exportGradebook(C, members, asg, results, ex.dataset.export, ex);
    const col2 = e.target.closest('[data-color]'); if (col2) { body.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === col2)); return; }
    const sv = e.target.closest('[data-savecls]'); if (sv) return busy(sv, async () => { const v = k => body.querySelector(`[data-cf="${k}"]`).value.trim(); await callFn('updateClass', { classId: cid, name: v('name'), subject: v('subject'), grade: v('grade'), color: (body.querySelector('[data-color].on') || {}).dataset?.color }); toast(L('Запазено')); });
    const nc = e.target.closest('[data-newcode]'); if (nc) return busy(nc, async () => { const r = await callFn('updateClass', { classId: cid, newCode: true }); toast(L('Нов код: {c}', { c: r.code })); });
    const at = e.target.closest('[data-addteacher]'); if (at) return busy(at, async () => { await callFn('updateClass', { classId: cid, addTeacher: body.querySelector('[data-coteacher]').value.trim().toLowerCase() }); toast(L('Учителят е добавен')); });
    const ar = e.target.closest('[data-archive]'); if (ar) return busy(ar, () => callFn('updateClass', { classId: cid, archived: !C.archived }));
    const dl = e.target.closest('[data-delcls]'); if (dl) return confirmBox(L('Да изтрия ли класа?'), L('Учениците излизат от класа. Заданията и оценките остават в архива ви.'), L('Изтрий'), true).then(ok => ok && busy(dl, async () => { await callFn('deleteClass', { classId: cid }); tGo('tClasses'); }));
    if (e.target.closest('[data-weakhw]')) return go('tPublish', { practice: true, classIds: [cid] });
  });
};

function qrSheet(C) {
  const link = joinLink(C.code);
  sheet({ title: C.name, wide: true, body: `<div class="t-qr">${qrSvg(link, 260)}<div class="t-qr-code">${esc(C.code)}</div><p class="muted small">${L('Учениците сканират QR кода или пишат кода в BingO → Клас → „+“.')}</p><p class="t-qr-link"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></p></div>`,
    actions: [{ id: 'copy', label: L('Копирай връзката'), icon: 'copy' }, { id: 'full', label: L('На цял екран'), icon: 'tv', kind: 'primary' }] }).then(a => {
    if (a === 'copy') copyText(link).then(() => toast(L('Копирано')));
    if (a === 'full') { const ov = h(`<div class="t-projector-qr" role="dialog">${qrSvg(link, 520)}<div class="t-qr-code big">${esc(C.code)}</div><p>${esc(C.name)}</p><button class="btn ghost" data-x>${L('Затвори')}</button></div>`); document.body.appendChild(ov); ov.requestFullscreen && ov.requestFullscreen().catch(() => { }); ov.querySelector('[data-x]').onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); ov.remove(); }; }
  });
}

/* "Ivan Petrov <ivan@x.bg>", "Иван, ivan@x.bg", "ivan@x.bg" — one per line */
function parseStudents(text) {
  const out = [];
  for (const line of String(text || '').split(/[\n;]+/)) {
    const em = (line.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[a-z]{2,}/i) || [])[0]; if (!em) continue;
    const name = line.replace(em, '').replace(/[<>,"';]/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ email: em.toLowerCase(), name });
  }
  return out;
}
async function inviteSheet(C) {
  await sheet({ title: L('Покани ученици'), body: `<p class="muted small">${L('По един на ред: име и имейл. Който вече има акаунт, влиза веднага; останалите — щом влязат в BingO с този имейл.')}</p><textarea class="field t-area" rows="8" data-list placeholder="Мария Петрова, maria@school.bg&#10;ivan@school.bg"></textarea><p class="t-count muted small"></p>`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Покани'), kind: 'primary' }],
    onMount: (sh, o) => {
      const ta = sh.querySelector('[data-list]'), cnt = sh.querySelector('.t-count');
      ta.addEventListener('input', () => { cnt.textContent = L('{n} имейла', { n: parseStudents(ta.value).length }); });
      const ok = sh.querySelector('[data-act="ok"]');
      ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => { const list = parseStudents(ta.value); if (!list.length) throw new Error(L('Няма нито един имейл')); const r = await callFn('inviteStudents', { classId: C.id, students: list }); toast(L('Добавени: {a} · поканени: {b}', { a: r.added, b: r.invited })); o.close('ok'); }); }, true);
    } });
}
/* a CSV or a text file with names and emails (e.g. exported from Shkolo or a spreadsheet) */
function csvImport(C) {
  const inp = h('<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden>');
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files[0]; inp.remove(); if (!f) return;
    const text = await f.text();
    const rows = text.split(/\r?\n/).map(l => l.split(/[;,\t]/).map(c => c.replace(/^"|"$/g, '').trim()));
    const head = rows[0].map(x => x.toLowerCase());
    const ei = head.findIndex(x => /mail|имейл|е-поща/.test(x)), ni = head.findIndex(x => /name|име/.test(x)), si = head.findIndex(x => /фамил|surname|last/.test(x));
    const list = (ei >= 0 ? rows.slice(1) : rows).map(r => { const email = ei >= 0 ? r[ei] : r.find(c => /@/.test(c)); return email && /@/.test(email) ? { email: email.toLowerCase(), name: [ni >= 0 ? r[ni] : r.filter(c => !/@/.test(c)).join(' '), si >= 0 ? r[si] : ''].join(' ').trim() } : null; }).filter(Boolean);
    if (!list.length) return toast(L('Във файла няма имейли'), 'bad');
    if (!(await confirmBox(L('Да поканя ли {n} ученици?', { n: list.length }), list.slice(0, 6).map(x => x.name || x.email).join(', ') + (list.length > 6 ? '…' : ''), L('Покани')))) return;
    try { const r = await callFn('inviteStudents', { classId: C.id, students: list }); toast(L('Добавени: {a} · поканени: {b}', { a: r.added, b: r.invited })); } catch (e) { failToast(e); }
  };
  inp.click();
}

/* ---------- one student ---------- */
SCREENS.tStudent = async (el, { cid, uid }, nav) => {
  if (!(await tGate(el, 'tClasses'))) return;
  const body = tFrame(el, 'tClasses', { title: '…', backBtn: true, wide: true });
  let M = null, P = null, rs = [];
  const draw = () => {
    if (!M) return;
    el.querySelector('.t-titles').innerHTML = `<span class="kicker">${esc(M.email || '')}</span><h1>${esc(M.name || M.email)}</h1>`;
    const sorted = rs.slice().sort((a, b) => (tsMs(a.submittedAt) || 0) - (tsMs(b.submittedAt) || 0));
    const a = avg(rs.map(r => r.pct)), flags = sum(rs.map(r => r.flags || 0));
    const skills = P ? Object.entries(P.skills || {}).map(([k, v]) => ({ k, ...v })).sort((x, y) => x.p - y.p) : [];
    body.innerHTML = `<div class="t-kpis"><div class="card t-kpi"><b>${pct(a)}</b><small>${L('среден резултат')}</small></div><div class="card t-kpi"><b>${rs.length}</b><small>${L('предадени')}</small></div><div class="card t-kpi"><b>${P ? P.streak || 0 : '–'}</b><small>${L('дни поредни')}</small></div><div class="card t-kpi ${flags ? 'warn' : ''}"><b>${flags}</b><small>${L('сигнала')}</small></div></div>
      <div class="t-grid">
        <div class="card"><h3>${icon('chart')}${L('Развитие')}</h3>${sorted.length > 1 ? sparkline(sorted.map(r => r.pct)) : ''}<div class="cl-list">${sorted.slice().reverse().map(r => `<button class="cl-asg" data-grade="${esc(r.id)}"><span class="cl-asg-main"><b>${esc(r.title)}</b><small class="muted">${fmtDay(tsMs(r.submittedAt))}${r.flags ? ' · ⚠ ' + r.flags : ''}</small></span><span class="t-score ${r.pct < 0.5 ? 'bad' : r.pct < 0.8 ? 'mid' : 'good'}">${esc((r.grade && r.grade.text) || pct(r.pct))}</span></button>`).join('') || `<p class="muted">${L('Още няма предадени работи.')}</p>`}</div></div>
        <div class="card"><h3>${icon('target')}${L('Карта на уменията (BingO)')}</h3>${skills.length ? `<div class="t-weak">${skills.slice(0, 14).map(x => `<div class="t-weakrow"><div><b>${esc(L(x.name || x.k))}</b><small class="muted">${esc(L(STATUS_LABEL[x.status] || ''))} · ${L('{n} отг.', { n: x.n })}${x.misc && x.misc.length ? ' · ' + esc(x.misc.map(m => m.label).join(', ')) : ''}</small></div>${bar(x.p, x.status)}<span class="t-avg">${pct(x.p)}</span></div>`).join('')}</div>` : `<p class="muted">${L('Ученикът още не е упражнявал в BingO.')}</p>`}</div>
      </div>`;
  };
  watch(docRef(`classes/${cid}/members/${uid}`), s => { M = s.exists ? { id: s.id, ...s.data() } : { id: uid, name: L('Ученик') }; draw(); }, nav);
  watch(docRef('progress/' + uid), s => { P = s.exists ? s.data() : null; draw(); }, nav, () => { });
  watch(col('results').where('teacherIds', 'array-contains', myUid()).where('studentId', '==', uid), s => { rs = docs(s); draw(); }, nav);
  el.addEventListener('click', e => { const g = e.target.closest('[data-grade]'); if (g) go('tGrade', { attemptId: g.dataset.grade }); });
};
