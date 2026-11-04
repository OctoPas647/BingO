/* ================= BingO for classes: the student's side =================
   - the "Клас" tab: my classes, a live test that is running now, homework and tests to do, results
   - taking a test or homework: answers are saved as you go (the teacher sees them live), a timer, a
     question map, photos of handwritten work, and the anti-cheat rules the teacher picked
   - the projector quiz on the phone, and the result with the right answers when the teacher allows it
   - the skill map from everyday practice goes to the student's teachers (progress/{uid}) */

/* ---------- the "Клас" tab ---------- */
TABS.splice(2, 0, ['classes', 'users', 'Клас']);
(function wrapClassesTab() {
  const inner = el => classesScreen(el);
  SCREENS.classes = async (el, ...rest) => {
    await inner(el, ...rest);
    el.classList.add('has-nav');
    el.insertAdjacentHTML('beforeend', tabBar('classes'));
    el.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab('classes', b.dataset.tab); });
  };
})();

/* the state of one assignment for this student */
function studentStatus(a, at) {
  const t = Date.now(), opens = tsMs(a.opensAt), closes = tsMs(a.closesAt);
  if (at && (at.status === 'submitted' || at.status === 'graded')) return 'done';
  if (a.kind === 'live') return a.status === 'closed' || (a.live && a.live.state === 'ended') ? (at ? 'done' : 'missed') : 'live';
  if (a.status === 'closed') return at ? 'done' : 'missed';
  if (opens && opens > t) return 'upcoming';
  if (closes && closes < t && !(a.settings && a.settings.lateAllowed)) return at ? 'done' : 'missed';
  return at && at.status === 'in_progress' ? 'doing' : 'todo';
}
const ST_LABEL = { done: 'Предадено', missed: 'Пропуснато', live: 'На живо сега', upcoming: 'Предстои', doing: 'Започнато', todo: 'За правене' };

function assignmentCard(a, at, opts = {}) {
  const st = studentStatus(a, at), closes = tsMs(a.closesAt), opens = tsMs(a.opensAt);
  const when = st === 'upcoming' ? L('отваря {d}', { d: fmtWhen(opens) }) : closes ? L('до {d}', { d: fmtWhen(closes) }) : '';
  return `<button class="cl-asg st-${st}" data-asg="${esc(a.id)}">
    <span class="cl-asg-ic k-${a.kind}">${icon(KIND_ICON[a.kind] || 'file')}</span>
    <span class="cl-asg-main"><b>${esc(a.title)}</b><small class="muted">${esc(L(KIND_LABEL[a.kind] || ''))} · ${esc(a.className || '')}${a.taskCount ? ' · ' + L('{n} задачи', { n: a.taskCount }) : ''}${when ? ' · ' + esc(when) : ''}</small></span>
    <span class="cl-pill p-${st}">${esc(L(ST_LABEL[st]))}</span></button>`;
}

async function classesScreen(el) {
  const nav = NAV[NAV.length - 1];
  const head = `<header class="apphead"><div class="brand bingo">Bing<span>O</span></div><div class="head-stats"><button class="iconbtn" data-join aria-label="${L('Присъедини се към клас')}">${icon('plus')}</button></div></header>`;
  const shell = body => { el.innerHTML = `${head}<section class="pad"><h1 class="screen-title">${L('Клас')}</h1>${body}</section>`; };
  el.addEventListener('click', e => {
    if (e.target.closest('[data-join]')) return go('joinClass');
    const a = e.target.closest('[data-asg]'); if (a) return go('assignment', { aid: a.dataset.asg });
    const s = e.target.closest('[data-signin]'); if (s) return busy(s, async () => { await cloudRegister('student'); cloudAfterSignIn(); refresh(); });
    const r = e.target.closest('[data-readall]'); if (r) { (r._ids || []).forEach(id => docRef(`users/${myUid()}/inbox/${id}`).update({ read: true }).catch(() => { })); }
  });
  if (!cloudConfigured()) return shell(notConfiguredCard());
  shell(`<div class="cl-loading"><span class="spinner"></span></div>`);
  try { await cloudLoad(); } catch (e) { return shell(`<div class="card error">${esc(errMsg(e))}</div>`); }
  if (!signedIn()) return shell(`<div class="card cl-hero">${icon('users')}<h3>${L('Свържи се с учителя си')}</h3><p class="muted">${L('С код от учителя влизаш в класа: получаваш тестове и домашни, участваш в тестове на живо и виждаш оценките си.')}</p>
    <button class="btn accent big block" data-join>${icon('users')}${L('Имам код на клас')}</button><button class="btn ghost block" data-signin>${icon('google')}${L('Вход с Google')}</button></div>`);
  const uid = myUid();
  const data = { classes: [], asg: [], atts: {}, inbox: [] };
  const draw = () => {
    const by = st => data.asg.filter(a => studentStatus(a, data.atts[a.id]) === st);
    const live = by('live'), todo = [...by('doing'), ...by('todo')], up = by('upcoming'), done = data.asg.filter(a => ['done', 'missed'].includes(studentStatus(a, data.atts[a.id])));
    todo.sort((x, y) => (tsMs(x.closesAt) || 9e15) - (tsMs(y.closesAt) || 9e15)); up.sort((x, y) => tsMs(x.opensAt) - tsMs(y.opensAt)); done.sort((x, y) => (tsMs(y.closesAt) || tsMs(y.createdAt) || 0) - (tsMs(x.closesAt) || tsMs(x.createdAt) || 0));
    const unread = data.inbox.filter(n => !n.read);
    const body = `
      ${live.map(a => `<button class="card cl-livebanner" data-asg="${esc(a.id)}"><span class="cl-dot"></span><div><b>${esc(a.title)}</b><small>${esc(a.className || '')} · ${a.live && a.live.state === 'lobby' ? L('Учителят те чака') : L('Тестът тече')}</small></div><span class="btn accent small">${L('Влез')}</span></button>`).join('')}
      ${unread.length ? `<div class="card cl-inbox"><h3>${icon('bolt')}${L('Ново')}</h3>${unread.slice(0, 5).map(n => `<div class="cl-inrow" data-asg="${esc(n.assignmentId || '')}"><b>${esc(n.title || '')}</b><small class="muted">${esc(L(KIND_LABEL[n.kind] || ''))} · ${esc(n.className || '')}</small></div>`).join('')}<button class="linkbtn" data-readall>${L('Отбележи като прочетени')}</button></div>` : ''}
      <h2 class="sec-title">${L('За правене')}</h2>${todo.length ? `<div class="cl-list">${todo.map(a => assignmentCard(a, data.atts[a.id])).join('')}</div>` : `<p class="muted cl-none">${L('Нищо за правене. Браво!')}</p>`}
      ${up.length ? `<h2 class="sec-title">${L('Предстоящи')}</h2><div class="cl-list">${up.map(a => assignmentCard(a, data.atts[a.id])).join('')}</div>` : ''}
      ${done.length ? `<h2 class="sec-title">${L('Готови')}</h2><div class="cl-list">${done.slice(0, 30).map(a => assignmentCard(a, data.atts[a.id])).join('')}</div>` : ''}
      <h2 class="sec-title">${L('Моите класове')}</h2>
      ${data.classes.length ? `<div class="ios-group">${data.classes.map(c => `<div class="ios-row"><span class="cl-swatch" style="background:${esc(c.color || '#2F5BD3')}"></span><span class="ios-row-text"><b>${esc(c.name)}</b><small>${esc(c.subject || '')}${c.ownerName ? ' · ' + esc(c.ownerName) : ''}</small></span></div>`).join('')}</div>` : `<p class="muted">${L('Още не си в клас.')}</p>`}
      <button class="btn ghost block" data-join>${icon('plus')}${L('Присъедини се към клас')}</button>`;
    shell(body);
    const ra = el.querySelector('[data-readall]'); if (ra) ra._ids = unread.map(n => n.id);
  };
  watch(col('classes').where('studentIds', 'array-contains', uid), s => { data.classes = docs(s); draw(); }, nav);
  watch(col('assignments').where('studentIds', 'array-contains', uid), s => { data.asg = docs(s); draw(); }, nav);
  watch(col('attempts').where('studentId', '==', uid), s => { data.atts = Object.fromEntries(docs(s).map(x => [x.assignmentId, x])); draw(); }, nav);
  watch(col(`users/${uid}/inbox`), s => { data.inbox = docs(s).sort((a, b) => (tsMs(b.at) || 0) - (tsMs(a.at) || 0)); draw(); }, nav);
}

/* a small card on the student's Home: a live test now, or how much is due */
(function homeClassCard() {
  const inner = SCREENS.home;
  SCREENS.home = async (el, ...rest) => {
    await inner(el, ...rest);
    if (!cloudConfigured() || !signedIn() || isTeacher()) return;
    const nav = NAV[NAV.length - 1], uid = myUid();
    const slot = h('<div class="cl-homeslot"></div>');
    const anchor = el.querySelector('.apphead'); if (!anchor) return;
    anchor.insertAdjacentElement('afterend', slot);
    let asg = [], atts = {};
    const draw = () => {
      const live = asg.filter(a => studentStatus(a, atts[a.id]) === 'live');
      const due = asg.filter(a => ['todo', 'doing'].includes(studentStatus(a, atts[a.id])));
      slot.innerHTML = live.length ? `<button class="card cl-livebanner" data-asg="${esc(live[0].id)}"><span class="cl-dot"></span><div><b>${esc(live[0].title)}</b><small>${L('Тест на живо')} · ${esc(live[0].className || '')}</small></div><span class="btn accent small">${L('Влез')}</span></button>`
        : due.length ? `<button class="card cl-duecard" data-go-classes>${icon('book')}<div><b>${L('{n} за правене от учителя', { n: due.length })}</b><small class="muted">${esc(due[0].title)}</small></div>${icon('next')}</button>` : '';
    };
    slot.addEventListener('click', e => { const a = e.target.closest('[data-asg]'); if (a) return go('assignment', { aid: a.dataset.asg }); if (e.target.closest('[data-go-classes]')) goTab('home', 'classes'); });
    watch(col('assignments').where('studentIds', 'array-contains', uid), s => { asg = docs(s); draw(); }, nav);
    watch(col('attempts').where('studentId', '==', uid), s => { atts = Object.fromEntries(docs(s).map(x => [x.assignmentId, x])); draw(); }, nav);
  };
})();

/* ---------- one assignment: what it is, start / continue, and the result ---------- */
SCREENS.assignment = async (el, { aid }) => {
  const nav = NAV[NAV.length - 1];
  el.innerHTML = `${topbar('')}<section class="pad"><div class="cl-loading"><span class="spinner"></span></div></section>`;
  await cloudLoad();
  const uid = myUid(), atId = `${aid}_${uid}`;
  let A = null, AT = null, R = null, RV = null;
  const pad = () => el.querySelector('section.pad');
  const draw = () => {
    if (!A) return;
    const st = studentStatus(A, AT), s = A.settings || {}, ac = s.antiCheat || {};
    const rules = [
      A.timeLimitMin ? L('Време: {n} мин', { n: A.timeLimitMin }) : '',
      tsMs(A.closesAt) ? L('Краен срок: {d}', { d: fmtWhen(tsMs(A.closesAt)) }) : '',
      s.oneByOne ? L('Без връщане към предишен въпрос') : '',
      ac.detectLeave ? L('Учителят вижда, ако излезеш от приложението') : '',
      ac.blockCopy ? L('Копиране и поставяне са изключени') : '',
      ac.lockApp ? L('Телефонът ще бъде закачен към BingO') : '',
      s.attempts > 1 ? L('Опити: {n}', { n: s.attempts }) : ''
    ].filter(Boolean);
    const startLabel = AT && AT.status === 'in_progress' ? L('Продължи') : A.kind === 'live' ? L('Влез в теста') : A.kind === 'practice' ? L('Започни упражнението') : L('Започни');
    const canStart = ['todo', 'doing', 'live'].includes(st) || (st === 'done' && AT && (AT.attemptNo || 1) < (s.attempts || 1) && A.status !== 'closed');
    pad().innerHTML = `<span class="kicker">${esc(L(KIND_LABEL[A.kind] || ''))} · ${esc(A.className || '')}</span><h1 class="screen-title">${esc(A.title)}</h1>
      ${A.description ? `<div class="card rt">${rich(A.description)}</div>` : ''}
      <div class="card"><div class="minis">${A.kind === 'practice' ? `<div><b>${(s.practice && s.practice.size) || 10}</b><small>${L('задачи')}</small></div>` : `<div><b>${A.taskCount}</b><small>${L('задачи')}</small></div><div><b>${fmtNum(A.maxPoints, appLang(), Number.isInteger(A.maxPoints) ? 0 : 1)}</b><small>${L('точки')}</small></div>`}<div><b>${A.timeLimitMin ? A.timeLimitMin + "'" : '∞'}</b><small>${L('време')}</small></div></div>
        ${rules.length ? `<ul class="cl-rules">${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        ${st === 'upcoming' ? `<p class="cl-msg">${L('Отваря {d}', { d: fmtWhen(tsMs(A.opensAt)) })}</p>` : ''}
        ${st === 'missed' ? `<p class="cl-msg danger-text">${L('Срокът изтече.')}</p>` : ''}
        ${canStart ? `<button class="btn accent big block" data-start>${icon('play')}${esc(startLabel)}</button>` : ''}</div>
      <div class="cl-result"></div>`;
    drawResult();
  };
  const drawResult = () => {
    const box = el.querySelector('.cl-result'); if (!box || !AT || !['submitted', 'graded'].includes(AT.status)) return;
    if (!R) { box.innerHTML = `<div class="card cl-note">${icon('clock')}<div><b>${L('Предадено')}</b><p class="muted small">${L('Резултатът ще се покаже, когато учителят реши.')}</p></div></div>`; return; }
    const g = R.grade || {};
    box.innerHTML = `<div class="card cl-score"><div class="cl-score-top">${ring(R.max ? R.points / R.max : 0, pct(R.max ? R.points / R.max : 0), 'big')}<div><span class="kicker">${L('Резултат')}</span><h2>${esc(g.text || '')}</h2><p class="muted">${L('{a} от {b} т.', { a: fmtPts(R.points, appLang()), b: fmtPts(R.max, appLang()) })}${R.quizScore != null ? ' · ' + L('{n} точки в куиза', { n: R.quizScore }) : ''}</p></div></div>
      ${R.needsReview ? `<p class="muted small">${L('Някои отговори още се проверяват.')}</p>` : ''}${R.comment ? `<div class="cl-tcomment"><b>${L('Бележка от учителя')}</b><p>${esc(R.comment)}</p></div>` : ''}</div>
      ${RV ? `<h2 class="sec-title">${L('Отговори')}</h2><div class="cl-review"></div>` : (A.settings && A.settings.feedback && A.settings.feedback.show === 'full' ? `<p class="muted">${L('Верните отговори ще се покажат след крайния срок.')}</p>` : '')}`;
    if (RV) mountStudentReview(box.querySelector('.cl-review'), A, AT, R, RV);
  };
  const loadResult = async () => {
    try { const r = await docRef('results/' + atId).get(); R = r.exists ? r.data() : null; } catch (e) { R = null; }
    try { const r = await docRef('reviews/' + atId).get(); RV = r.exists ? r.data() : null; } catch (e) { RV = null; }
    drawResult();
  };
  watch(docRef('assignments/' + aid), s => { if (!s.exists) { pad().innerHTML = emptyBox('info', L('Заданието е изтрито'), ''); return; } A = { id: s.id, ...s.data() }; draw(); }, nav, () => { pad().innerHTML = `<div class="card error">${L('Нямаш достъп до това задание.')}</div>`; });
  watch(docRef('attempts/' + atId), s => { const was = AT && AT.status; AT = s.exists ? s.data() : null; draw(); if (AT && AT.status !== was && ['submitted', 'graded'].includes(AT.status)) loadResult(); }, nav, () => { });
  /* the teacher may release the result later: look again every 20 s while it is hidden */
  const poll = setInterval(() => { if (AT && ['submitted', 'graded'].includes(AT.status) && (!R || (!RV && A && A.settings.feedback.show === 'full'))) loadResult(); }, 20000);
  const prevLeave = nav.onLeave; nav.onLeave = () => { clearInterval(poll); prevLeave && prevLeave(); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-start]'); if (!b) return;
    busy(b, async () => {
      const r = await callFn('startAttempt', { assignmentId: aid });
      if (r.finished) return toast(L('Вече си предал.'));
      if (A.kind === 'practice') {
        const p = A.settings.practice || {}, subj = SUBJECTS[p.subject] ? p.subject : S.subject;
        return go('session', { subj, mode: 'assigned', skills: p.skills || [], size: p.size || 10, assignmentId: aid });
      }
      go(A.mode === 'quiz' ? 'quizPlay' : 'take', { aid });
    });
  });
};

/* the student's own answers with the right ones, when the teacher allows it */
function mountStudentReview(box, A, AT, R, RV) {
  const m = classModule(A);
  const order = AT.order || (A.tasks || []).map(t => t.id);
  order.forEach((id, i) => {
    const pub = (A.tasks || []).find(t => t.id === id); if (!pub) return;
    const rv = RV.tasks && RV.tasks[id]; const per = R.per && R.per[id] || {};
    const full = fullTaskFromReview(pub, rv);
    const resp = eduUnmix(full, (AT.responses || {})[id]);
    const wrap = h(`<div class="card cl-rvtask s-${per.status || 'empty'}"><div class="cl-rvhead"><b>${i + 1}.</b><span class="cl-pill p-${per.status === 'right' ? 'done' : per.status === 'pending' ? 'upcoming' : 'missed'}">${fmtPts(per.points || 0, appLang())} / ${fmtPts(per.max || full.points || 1, appLang())}</span></div></div>`);
    if (full.type === 'photo') {
      wrap.insertAdjacentHTML('beforeend', `<div class="prompt rt">${rich(full.prompt || '')}</div>`);
      const ph = resp && resp.path; if (ph) imageUrl(ph).then(u => wrap.insertAdjacentHTML('beforeend', `<img class="cl-photo" src="${esc(u)}" alt="">`)).catch(() => { });
    } else {
      const v = taskView(viewTask(full), m, { mode: 'review', response: resp, seed: 'rv' });
      wrap.appendChild(v.el);
      try { if (EDU_AUTO_TYPES.includes(full.type)) v.show(scoreTask(full, resp, 'bg')); else v.show({}); } catch (e) { }
    }
    if (rv && (rv.aiComment || rv.teacherComment)) wrap.insertAdjacentHTML('beforeend', `<div class="cl-tcomment">${rv.teacherComment ? `<b>${L('Учителят')}</b><p>${esc(rv.teacherComment)}</p>` : `<b>✦ Gemini</b><p>${esc(rv.aiComment)}</p>`}</div>`);
    box.appendChild(wrap);
  });
}
/* the task with its answer back in (from the review); "order" and "match" in the original order */
function fullTaskFromReview(pub, rv) {
  const t = JSON.parse(JSON.stringify(pub));
  if (!rv) return t;
  if (rv.answer != null) t.answer = rv.answer;
  if (rv.explain) t.explain = rv.explain;
  if (rv.gaps && t.gaps) t.gaps = t.gaps.map((g, i) => ({ ...g, answer: rv.gaps[i] && rv.gaps[i].answer }));
  if (rv.perm && t.type === 'order') { const items = []; rv.perm.forEach((orig, i) => { items[orig] = pub.items[i]; }); t.items = items; t.perm = rv.perm; }
  if (rv.perm && t.type === 'match') { const right = []; rv.perm.forEach((orig, i) => { right[orig] = pub.right[i]; }); t.right = right; t.perm = rv.perm; }
  if (rv.rubric) t.rubric = rv.rubric;
  return t;
}
/* a fake Shelly module for the task views (language, passages) */
function classModule(A) { return { id: 'class.' + (A && A.id || 'x'), lang: (A && A.lang) || 'bg', passages: {}, color: '#2F5BD3' }; }
/* the engine's views expect some fields that the student's copy does not have */
function viewTask(t) {
  const v = { media: [], hint: [], ...t };
  v.media = Array.isArray(t.media) ? t.media : [];
  if (v.type === 'gaps' && Array.isArray(v.gaps)) v.gaps = v.gaps.map(g => (g.options || g.answer != null ? g : { ...g, answer: ['__________'] }));
  if (v.type === 'open') v.points = v.points || 1;
  return v;
}

/* options in a seeded mixed order for this student (the saved answer is always in the teacher's order) */
function optPerm(n, seed) { return eduPermClient(n, seed); }
function eduPermClient(n, seed) { const idx = [...Array(n).keys()]; return n < 2 ? idx : shuffled(idx, seed); }
function mixTask(t, seed, on) {
  if (!on || !['choice', 'multi'].includes(t.type) || !Array.isArray(t.options)) return { task: t, toView: r => r, fromView: r => r };
  const p = optPerm(t.options.length, seed + ':' + t.id);   /* view i shows the original option p[i] */
  const task = { ...t, options: p.map(i => t.options[i]) };
  const toView = r => (r == null ? r : t.type === 'choice' ? p.indexOf(r) : r.map(o => p.indexOf(o)));
  const fromView = r => (r == null ? r : t.type === 'choice' ? p[r] : r.map(d => p[d]).sort((a, b) => a - b));
  return { task, toView, fromView };
}

/* ---------- anti-cheat: what the student does outside the test ---------- */
function antiCheat(rules, report) {
  const off = [];
  const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); off.push(() => target.removeEventListener(ev, fn, opt)); };
  let leftAt = 0;
  if (rules.detectLeave) {
    on(document, 'visibilitychange', () => {
      if (document.hidden) { leftAt = Date.now(); report('left'); }
      else if (leftAt) { report('back', { secs: Math.round((Date.now() - leftAt) / 1000) }); leftAt = 0; }
    });
    on(window, 'blur', () => { if (!document.hidden) report('blur'); });
    window.__appPaused = () => { if (!leftAt) { leftAt = Date.now(); report('left'); } };
    window.__appResumed = () => { if (leftAt) { report('back', { secs: Math.round((Date.now() - leftAt) / 1000) }); leftAt = 0; } };
    off.push(() => { window.__appPaused = null; window.__appResumed = null; });
  }
  if (rules.blockCopy) {
    for (const ev of ['copy', 'cut']) on(document, ev, e => { e.preventDefault(); report(ev); });
    on(document, 'paste', e => { e.preventDefault(); report('paste'); toast(L('Поставянето е изключено в този тест'), 'bad'); });
    on(document, 'contextmenu', e => e.preventDefault());
    document.body.classList.add('cl-nocopy'); off.push(() => document.body.classList.remove('cl-nocopy'));
  }
  if (rules.fullscreen && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => { });
    on(document, 'fullscreenchange', () => { if (!document.fullscreenElement) report('fullscreen'); });
    off.push(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); });
  }
  const UI = window.AndroidUI;
  if (UI && rules.secure && UI.secure) { try { UI.secure(true); } catch (e) { } off.push(() => { try { UI.secure(false); } catch (e) { } }); }
  if (UI && rules.lockApp && UI.pin) { try { UI.pin(true); } catch (e) { } off.push(() => { try { UI.pin(false); } catch (e) { } }); }
  return () => off.splice(0).forEach(f => f());
}
const FLAG_EVENTS = ['left', 'blur', 'copy', 'cut', 'paste', 'fullscreen'];

/* ---------- taking a test or homework ---------- */
SCREENS.take = async (el, { aid }, nav) => {
  el.innerHTML = `<div class="pad"><div class="cl-loading"><span class="spinner"></span></div></div>`;
  await cloudLoad();
  const uid = myUid(), atRef = docRef(`attempts/${aid}_${uid}`);
  const [aSnap, atSnap] = await Promise.all([docRef('assignments/' + aid).get(), atRef.get()]);
  if (!aSnap.exists || !atSnap.exists) { el.innerHTML = `<div class="pad"><div class="card error">${L('Тестът не е намерен.')}</div><button class="btn" data-back>${L('Назад')}</button></div>`; return; }
  let A = { id: aSnap.id, ...aSnap.data() }, AT = atSnap.data();
  const s = A.settings || {}, m = classModule(A);
  const tasks = Object.fromEntries((A.tasks || []).map(t => [t.id, t]));
  const order = (AT.order || []).filter(id => tasks[id]);
  const R = { ...(AT.responses || {}) }, timeOn = { ...(AT.timeOn || {}) };
  let i = clamp(AT.current || 0, 0, Math.max(0, order.length - 1)), view = null, mix = null, shownAt = Date.now(), done = false, pending = {}, saveTimer = 0;
  const answeredN = () => order.filter(id => answered(tasks[id], R[id])).length;
  function answered(t, r) { if (r == null) return false; if (t.type === 'photo') return !!(r && r.path); try { return isAnswered(t, r); } catch (e) { return false; } }

  el.innerHTML = `<header class="playbar cl-takebar"><button class="iconbtn" data-exit aria-label="${L('Затвори')}">${icon('close')}</button>${bar(0, 'pbar')}<span class="cl-timer" hidden>${icon('clock')}<b></b></span><button class="iconbtn" data-map aria-label="${L('Всички въпроси')}">${icon('grid')}</button></header>
    <div class="cl-qmap" hidden></div>
    <main class="playmain cl-takemain"></main>
    <div class="cl-lockcover" hidden><div class="card">${icon('lock')}<h3>${L('Тестът е заключен')}</h3><p class="muted">${L('Учителят спря теста за теб. Изчакай или вдигни ръка.')}</p></div></div>
    <div class="cl-lockcover cl-pause" hidden><div class="card">${icon('pause')}<h3>${L('Пауза')}</h3><p class="muted">${L('Учителят спря теста за всички. Не затваряй приложението.')}</p></div></div>
    <footer class="checkbar cl-takefoot"><div class="cb-actions"><button class="btn ghost" data-prev>${icon('back')}${L('Назад')}</button><button class="btn accent big" data-next></button></div></footer>`;
  const main = el.querySelector('.cl-takemain'), timerEl = el.querySelector('.cl-timer');

  /* saving: answers go to Firestore a moment after each change; the teacher's live screen shows them */
  const flush = async () => {
    clearTimeout(saveTimer);
    const upd = { ...pending }; pending = {};
    if (!Object.keys(upd).length || done) return;
    upd.lastSeen = FV().serverTimestamp(); upd.answered = answeredN();
    try { await atRef.update(upd); }
    catch (e) { console.warn('save', e); Object.assign(pending, upd); if (/permission/i.test(e.code || e.message)) { /* locked, past the deadline or handed in */ } else saveTimer = setTimeout(flush, 4000); }
  };
  const queue = (k, v, now) => { pending[k] = v; clearTimeout(saveTimer); saveTimer = setTimeout(flush, now ? 0 : 900); };
  const report = (type, extra = {}) => {
    if (done) return;
    const flagged = FLAG_EVENTS.includes(type);
    pending.events = FV().arrayUnion({ t: Date.now(), type, q: i + 1, ...extra });
    if (flagged) pending.flags = FV().increment(1);
    flush();
  };
  const stopCheat = antiCheat(s.antiCheat || {}, report);
  const heartbeat = setInterval(() => queue('lastSeen', FV().serverTimestamp(), true), 15000);
  const tick = setInterval(paintTimer, 1000);
  const cleanup = () => { stopCheat(); clearInterval(heartbeat); clearInterval(tick); flush(); };
  const prevLeave = nav.onLeave; nav.onLeave = () => { cleanup(); prevLeave && prevLeave(); };
  nav.guard = async () => done || confirmBox(L('Да излезеш ли?'), L('Отговорите ти са запазени. Можеш да продължиш по-късно, докато тестът е отворен.'), L('Излез'), false);

  function stamp() { const id = order[i]; if (!id) return; timeOn[id] = Math.round((timeOn[id] || 0) + (Date.now() - shownAt) / 1000); shownAt = Date.now(); pending.timeOn = timeOn; }
  function deadline() { return tsMs(AT.deadline); }
  function paintTimer() {
    const dl = deadline(); const left = dl ? dl - Date.now() : null;
    if (left == null || left > 365 * 86400000 / 2) { timerEl.hidden = true; return; }
    timerEl.hidden = false; timerEl.querySelector('b').textContent = fmtLeft(left);
    timerEl.classList.toggle('low', left < 60000);
    if (left <= 0 && !done) submit(true);
  }
  function paintMap() {
    el.querySelector('.cl-qmap').innerHTML = `<div class="cl-qgrid">${order.map((id, k) => `<button data-q="${k}" class="${k === i ? 'cur' : ''} ${answered(tasks[id], R[id]) ? 'ans' : ''}"${s.oneByOne && k < i ? ' disabled' : ''}>${k + 1}</button>`).join('')}</div><p class="muted small">${L('Отговорени: {a} от {b}', { a: answeredN(), b: order.length })}</p>`;
    el.querySelector('.pbar i').style.width = (answeredN() / Math.max(1, order.length) * 100) + '%';
  }
  function show() {
    const id = order[i], t = tasks[id];
    mix = mixTask(t, AT.optSeed || aid, s.shuffleOpts !== false);
    main.innerHTML = `<div class="cl-qhead"><span class="kicker">${L('Въпрос {a} от {b}', { a: i + 1, b: order.length })}</span><span class="cl-qpts">${L('{n} т.', { n: fmtPts(t.points || 1, appLang()) })}</span></div>`;
    if (t.type === 'photo') { main.appendChild(photoTask(t, R[id], r => { R[id] = r; queue('responses.' + id, r, true); paintMap(); }, aid, uid)); view = null; }
    else {
      view = taskView(viewTask(mix.task), m, { mode: 'exam', response: mix.toView(R[id] ?? null), seed: AT.optSeed || aid, onChange: () => { const r = mix.fromView(view.get()); R[id] = r; queue('responses.' + id, r); paintMap(); } });
      main.appendChild(view.el);
      if (s.allowHints && t.hint) { /* hints are not in the student's copy: none to show */ }
    }
    el.querySelector('[data-prev]').disabled = i === 0 || !!s.oneByOne;
    el.querySelector('[data-next]').innerHTML = i === order.length - 1 ? `${icon('send')}${L('Предай')}` : `${L('Напред')}${icon('next')}`;
    paintMap(); window.scrollTo(0, 0);
    pending.curSince = FV().serverTimestamp(); queue('current', i);
  }
  function goTo(k) { if (k === i || k < 0 || k >= order.length) return; if (s.oneByOne && k < i) return; stamp(); i = k; show(); }
  async function submit(auto) {
    if (done) return;
    if (!auto) {
      const left = order.length - answeredN();
      const ok = await confirmBox(L('Да предадеш ли?'), left ? L('Имаш {n} въпроса без отговор.', { n: left }) : L('Всички въпроси имат отговор.'), L('Предай'), false);
      if (!ok) return;
    }
    stamp(); await flush(); done = true;
    main.innerHTML = `<div class="cl-loading"><span class="spinner"></span><p class="muted">${L('Предаване…')}</p></div>`;
    try { await callFn('submitAttempt', { assignmentId: aid }); toast(auto ? L('Времето изтече — тестът е предаден') : L('Предадено!')); }
    catch (e) { failToast(e); }
    cleanup(); backToAssignment(aid);
  }
  el.addEventListener('click', e => {
    if (e.target.closest('[data-exit]')) return back();
    if (e.target.closest('[data-map]')) { const q = el.querySelector('.cl-qmap'); q.hidden = !q.hidden; return; }
    const q = e.target.closest('[data-q]'); if (q) { el.querySelector('.cl-qmap').hidden = true; return goTo(+q.dataset.q); }
    if (e.target.closest('[data-prev]')) return goTo(i - 1);
    if (e.target.closest('[data-next]')) return i === order.length - 1 ? submit(false) : goTo(i + 1);
  });
  /* the teacher can lock, add time, pause or end the test while it runs */
  watch(atRef, sn => {
    if (!sn.exists) return; AT = sn.data();
    el.querySelector('.cl-lockcover:not(.cl-pause)').hidden = !AT.locked;
    if (!done && ['submitted', 'graded'].includes(AT.status)) { done = true; cleanup(); toast(L('Тестът е предаден')); backToAssignment(aid); }
  }, nav);
  if (A.kind === 'live') watch(docRef('assignments/' + aid), sn => {
    if (!sn.exists) return; A = { id: sn.id, ...sn.data() };
    const st = A.live && A.live.state;
    el.querySelector('.cl-pause').hidden = st !== 'paused';
    if (st === 'lobby') main.innerHTML = `<div class="cl-wait">${icon('live')}<h2>${L('Чакаме учителя да започне')}</h2></div>`;
    else if (st !== 'paused' && !view && !main.querySelector('.task, .cl-photo-task')) show();
  }, nav);
  report('start');
  if (!(A.kind === 'live' && A.live && A.live.state === 'lobby')) show();
  paintTimer();
};

/* after a test: back to the assignment it was opened from (not a second copy of it) */
function backToAssignment(aid) {
  const prev = NAV[NAV.length - 2];
  if (prev && prev.screen === 'assignment' && prev.params.aid === aid) { leave(NAV.pop()); render(true); }
  else go('assignment', { aid }, { replace: true });
}

/* a photo answer: the student takes or picks a picture of the handwritten solution */
function photoTask(t, resp, onChange, aid, uid) {
  const wrap = h(`<div class="task cl-photo-task"><div class="prompt rt">${rich(t.prompt || '')}</div>
    <div class="cl-photobox">${resp && resp.url ? `<img class="cl-photo" src="${esc(resp.url)}" alt="">` : `<div class="cl-photo-empty">${icon('camera')}<span>${L('Снимай решението си на лист')}</span></div>`}</div>
    <label class="btn accent block cl-photobtn">${icon('camera')}<span>${resp && resp.url ? L('Смени снимката') : L('Снимай / избери снимка')}</span><input type="file" accept="image/*" capture="environment" hidden></label>
    <p class="muted small">${L('Снимай отблизо, на светло, целия лист. Учителят (или Gemini) ще провери решението.')}</p></div>`);
  wrap.querySelector('input').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const btn = wrap.querySelector('.cl-photobtn'); btn.classList.add('busy');
    try {
      const up = await uploadImage(`uploads/${aid}/${uid}/${t.id}-${Date.now()}.jpg`, f);
      wrap.querySelector('.cl-photobox').innerHTML = `<img class="cl-photo" src="${esc(up.url)}" alt="">`;
      onChange({ path: up.path, url: up.url, mime: up.mime });
    } catch (err) { failToast(err); } finally { btn.classList.remove('busy'); }
  });
  return wrap;
}

/* ---------- the projector quiz on the student's phone ---------- */
const QUIZ_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#864CBF', '#0AA3A3'];
const QUIZ_SHAPES = ['▲', '◆', '●', '■', '★', '⬟'];
SCREENS.quizPlay = async (el, { aid }, nav) => {
  await cloudLoad();
  const uid = myUid(), atRef = docRef(`attempts/${aid}_${uid}`);
  let A = null, AT = null, view = null, shownQ = -2;
  el.classList.add('cl-quiz-screen');
  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${L('Затвори')}">${icon('close')}</button><b class="cl-qz-title"></b><span class="cl-qz-score"></span></header><main class="cl-qz-main"></main>`;
  const main = el.querySelector('.cl-qz-main');
  nav.guard = async () => !A || (A.live && A.live.state === 'ended') || confirmBox(L('Да излезеш ли?'), L('Ще пропуснеш въпросите, докато те няма.'), L('Излез'), false);
  const answerQ = async (qi, resp) => {
    try { await atRef.update({ ['quiz.' + qi]: { resp, at: FV().serverTimestamp() }, lastSeen: FV().serverTimestamp(), current: qi }); }
    catch (e) { failToast(e); }
  };
  const draw = () => {
    if (!A || !AT) return;
    const Lv = A.live || {}, qi = Lv.current, t = (A.tasks || [])[qi], mine = (AT.quiz || {})[qi];
    el.querySelector('.cl-qz-title').textContent = A.title;
    const me = (Lv.leaderboard || []).findIndex(r => r.uid === uid);
    el.querySelector('.cl-qz-score').textContent = me >= 0 ? `#${me + 1} · ${Lv.leaderboard[me].score}` : '';
    if (Lv.state === 'lobby' || qi < 0) { main.innerHTML = `<div class="cl-wait">${icon('live')}<h2>${L('Вътре си!')}</h2><p class="muted">${L('Виждаш ли името си на екрана? Чакаме учителя да започне.')}</p></div>`; shownQ = -2; return; }
    if (Lv.state === 'paused') { main.innerHTML = `<div class="cl-wait">${icon('pause')}<h2>${L('Пауза')}</h2></div>`; shownQ = -2; return; }
    if (Lv.state === 'ended') {
      const place = me >= 0 ? me + 1 : null;
      main.innerHTML = `<div class="cl-wait cl-qz-end">${icon('trophy')}<h2>${place ? L('Ти си {n}-и!', { n: place }) : L('Край!')}</h2>${me >= 0 ? `<p class="cl-qz-big">${Lv.leaderboard[me].score}</p><p class="muted">${L('{n} верни', { n: Lv.leaderboard[me].right })}</p>` : ''}</div>`;
      if (place && place <= 3) confetti();
      shownQ = -3; return;
    }
    if (Lv.reveal) {
      let right = null;
      if (mine && Lv.stats) { const full = { ...t, answer: Lv.stats.answer, perm: Lv.stats.perm }; try { right = EDU_AUTO_TYPES.includes(t.type) ? scoreTask(full, eduUnmix(full, mine.resp), 'bg').status === 'right' : null; } catch (e) { } }
      main.innerHTML = `<div class="cl-wait cl-qz-reveal ${right ? 'ok' : 'no'}">${icon(right ? 'check' : 'close')}<h2>${!mine ? L('Не отговори навреме') : right ? L('Вярно!') : L('Грешно')}</h2>${me >= 0 ? `<p class="muted">${L('Място {n}', { n: me + 1 })}</p>` : ''}</div>`;
      if (right) sound('right'); else if (mine) sound('wrong');
      shownQ = -4; return;
    }
    if (mine) { main.innerHTML = `<div class="cl-wait">${icon('check')}<h2>${L('Отговорът е изпратен')}</h2><p class="muted">${L('Чакаме останалите…')}</p></div>`; shownQ = -5; return; }
    if (shownQ === qi) return;
    shownQ = qi;
    if (t.type === 'choice') {
      main.innerHTML = `<div class="cl-qz-q rt">${rich(t.prompt || '')}</div><div class="cl-qz-opts n${t.options.length}">${t.options.map((o, k) => `<button data-o="${k}" style="--c:${QUIZ_COLORS[k % 6]}"><span>${QUIZ_SHAPES[k % 6]}</span><span class="rt">${richInline(o)}</span></button>`).join('')}</div>`;
    } else {
      view = taskView(viewTask(t), classModule(A), { mode: 'exam', seed: aid });
      main.innerHTML = ''; main.appendChild(view.el);
      main.insertAdjacentHTML('beforeend', `<button class="btn accent big block" data-send>${icon('send')}${L('Изпрати')}</button>`);
    }
  };
  main.addEventListener('click', e => {
    const o = e.target.closest('[data-o]'); if (o) { main.querySelectorAll('[data-o]').forEach(b => { b.disabled = true; }); o.classList.add('picked'); return answerQ(A.live.current, +o.dataset.o); }
    if (e.target.closest('[data-send]') && view && view.ready()) { e.target.closest('[data-send]').disabled = true; return answerQ(A.live.current, view.get()); }
  });
  watch(docRef('assignments/' + aid), s => { if (s.exists) { A = { id: s.id, ...s.data() }; draw(); } }, nav);
  watch(atRef, s => { if (s.exists) { AT = s.data(); draw(); } }, nav);
  const hb = setInterval(() => atRef.update({ lastSeen: FV().serverTimestamp() }).catch(() => { }), 20000);
  const prev = nav.onLeave; nav.onLeave = () => { clearInterval(hb); prev && prev(); };
};

/* ---------- homework that is a BingO practice session ---------- */
async function classPracticeDone(aid, subj, answers) {
  try {
    const uid = myUid(); if (!uid) return;
    const right = answers.filter(a => a.correct).length;
    await docRef(`attempts/${aid}_${uid}`).update({ practice: { n: answers.length, right, subject: subj, skills: [...new Set(answers.map(a => a.skill))] }, answered: answers.length, lastSeen: FV().serverTimestamp() });
    await callFn('submitAttempt', { assignmentId: aid });
    toast(L('Домашното е предадено на учителя'));
  } catch (e) { failToast(e); }
}

/* ---------- the skill map from everyday practice, for the teacher ---------- */
let _progressAt = 0;
async function cloudSyncProgress(force) {
  if (!cloudConfigured() || !signedIn() || isTeacher()) return;
  if (!force && Date.now() - _progressAt < 60000) return;
  _progressAt = Date.now();
  try {
    const skills = {};
    for (const subj of Object.keys(SUBJECTS)) {
      let list; try { list = skillList(subj); } catch (e) { continue; }
      for (const sk of list) {
        const st = skillState(subj, sk.id); if (!st || !st.n) continue;
        const misc = Object.entries(st.misc || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => ({ k, n, label: plainMisc(k) }));
        skills[subj + '.' + sk.id] = { p: roundTo(st.p, 3), n: st.n, ok: st.ok, w: sk.weight || 1, name: sk.name, status: skillStatus(st), misc };
      }
    }
    const act = activity();
    await docRef('progress/' + myUid()).set({ name: (CLOUD.profile && CLOUD.profile.name) || S.profile.name || '', exam: S.profile.exam || '', skills, sessions: S.sessions, streak: act.streak, days: act.days, answers7: sum(act.week.map(w => w.n)), updatedAt: FV().serverTimestamp() }, { merge: true });
  } catch (e) { console.warn('progress', e); }
}
