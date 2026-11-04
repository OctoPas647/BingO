/* ================= BingO for teachers: the live test =================
   Each student at their own pace: a grid of the class — on which question each one is, what they are
   writing right now, right and wrong so far, how long on this question, online or not, and every time
   they left the test. Start, pause, add time (for all or one), lock, kick and end.
   The projector quiz: one question at a time on the big screen, answers from the phones, a countdown,
   the answer chart and a leaderboard. */

const ONLINE_MS = 40000;
const EVENT_LABEL = { start: 'започна', left: 'излезе от теста', back: 'се върна', blur: 'смени прозореца', copy: 'копира', cut: 'изряза', paste: 'опита да постави текст', fullscreen: 'излезе от цял екран',
  gap: 'изчезна (без връзка или спрян)', offline: 'прекъсна за малко', split: 'отвори разделен екран или плаващ прозорец', unpin: 'откачи екрана', pinned: 'закачи екрана', nopin: 'не закачи екрана',
  recording: 'записва екрана', cast: 'показва екрана на друг дисплей', device: 'влезе от друго устройство', tamper: 'махна името си от теста', a11y: 'включи приложение, което чете екрана',
  adb: 'включи USB отстраняване на грешки', print: 'опита да разпечата', screenshot: 'направи снимка на екрана', monitors: 'има втори монитор', resize: 'смали прозореца до половин екран',
  devtools: 'отвори инструментите за разработчици', photo: 'снима решение с камерата', warned: 'получи предупреждение', locked: 'беше заключен', unlocked: 'беше отключен', submitted: 'тестът беше предаден' };
/* one event as a line for the teacher (also in 77-teacher-results.js) */
function evLine(e) {
  let label = L(EVENT_LABEL[e.type] || e.type);
  if (e.type === 'screenshot' && e.blocked) label = L('опита снимка на екрана (спряна)');
  if (e.type === 'left' && e.info === 'exit') label = L('затвори теста');
  if (e.type === 'locked' && e.info === 'auto') label = L('беше заключен автоматично');
  if (e.type === 'submitted' && e.info === 'auto') label = L('тестът беше предаден автоматично');
  const extra = [e.q && !['locked', 'unlocked', 'warned', 'submitted'].includes(e.type) ? L('въпрос {n}', { n: e.q }) : '', e.secs ? L('{n} с', { n: e.secs }) : '', e.type === 'warned' && e.info ? L('остават {n}', { n: e.info }) : '', ['cast', 'a11y', 'device', 'resize'].includes(e.type) && e.info ? e.info : ''].filter(Boolean);
  return `<div class="t-ev ev-${esc(e.type)}${e.strike ? ' strike' : ''}"><small>${fmtTime(e.t)}</small><span>${e.strike ? '<b class="t-strike">!</b> ' : ''}${esc(label)}${extra.length ? ' · ' + esc(extra.join(' · ')) : ''}</span></div>`;
}
/* the device a student took the test on */
function deviceLine(a) {
  const d = a.device || {}; if (!d.platform) return '';
  const what = d.platform === 'android' ? [d.model, d.os, d.app ? 'BingO ' + d.app : ''] : [d.browser, d.os];
  const iv = { ok: L('потвърдено от Google Play'), skipped: '', off: '' }[d.integrity];
  return [...what, d.ip ? 'IP ' + d.ip : '', iv == null ? L('Google Play: {v}', { v: d.integrity }) : iv, (a.devicesSeen || []).length > 1 ? L('{n} устройства', { n: a.devicesSeen.length }) : ''].filter(Boolean).join(' · ');
}

/* right / wrong / pending / empty for every task, from the key (teacher's copy) */
function liveMarks(key, at) {
  const out = {};
  for (const [id, k] of Object.entries(key || {})) {
    const r = (at.responses || {})[id];
    if (r == null) { out[id] = 'empty'; continue; }
    out[id] = eduScore(k, r, 'bg').status;
  }
  return out;
}
/* what the student has on the current question, in a few words */
function responseText(t, k, r) {
  if (r == null) return '';
  if (t.type === 'choice') return letterOf('bg', r) + ') ' + String(t.options[r] || '').replace(/\$/g, '').slice(0, 40);
  if (t.type === 'multi') return (r || []).map(i => letterOf('bg', i)).join(', ');
  if (t.type === 'text' || t.type === 'number') return String(r).slice(0, 60);
  if (t.type === 'open') return String((r && r.text) || '').slice(-90);
  if (t.type === 'photo') return r && r.path ? '📷' : '';
  if (t.type === 'gaps') return (r || []).map(v => (v == null ? '…' : typeof v === 'number' && t.gaps[0] ? '#' + (v + 1) : v)).join(' · ').slice(0, 60);
  if (t.type === 'order') return r && r.moved ? L('подредено') : '';
  if (t.type === 'match') return L('{n} двойки', { n: (r || []).filter(x => x != null).length });
  return '';
}

SCREENS.tLive = async (el, { aid }, nav) => {
  if (!(await tGate(el, 'tHome'))) return;
  const body = tFrame(el, 'tHome', { title: '…', backBtn: true, wide: true });
  let A = null, key = null, atts = [], members = [], sortBy = 'name', autoLocked = new Set(), revealing = false;
  try { const k = await docRef(`assignments/${aid}/key/answers`).get(); key = k.exists ? k.data().tasks : {}; } catch (e) { key = {}; }
  const tick = setInterval(() => { paintClock(); if (A && A.mode === 'quiz') quizTick(); else paintTimes(); }, 1000);
  const prevLeave = nav.onLeave; nav.onLeave = () => { clearInterval(tick); prevLeave && prevLeave(); };
  const ctl = (action, extra = {}, btn) => busy(btn, () => callFn('liveControl', { assignmentId: aid, action, ...extra }, { timeout: 280000 }));

  function paintClock() {
    const c = el.querySelector('.t-liveclock'); if (!c || !A || !A.live) return;
    const Lv = A.live, end = tsMs(Lv.endsAt);
    if (Lv.state === 'running' && end) { const left = end - Date.now(); c.textContent = fmtLeft(left); c.classList.toggle('low', left < 120000); }
    else if (Lv.state === 'paused') c.textContent = L('Пауза');
    else c.textContent = '';
  }
  function paintTimes() {
    el.querySelectorAll('[data-since]').forEach(x => { const t = +x.dataset.since; if (t) x.textContent = fmtClock((Date.now() - t) / 1000); });
    el.querySelectorAll('.t-stu[data-seen]').forEach(x => x.classList.toggle('off', Date.now() - +x.dataset.seen > ONLINE_MS && !x.classList.contains('done')));
  }
  const header = () => {
    const Lv = A.live || {}, st = Lv.state || 'lobby';
    el.querySelector('.t-titles').innerHTML = `<span class="kicker">${esc(A.className || '')} · ${A.mode === 'quiz' ? L('Куиз на проектора') : A.kind === 'live' ? L('Тест на живо') : L('Монитор')}</span><h1>${esc(A.title)} <span class="t-liveclock"></span></h1>`;
    if (A.kind !== 'live') { el.querySelector('.t-actions').innerHTML = `<button class="btn accent small" data-results>${icon('chart')}${L('Резултати')}</button>`; return; }
    const b = (act, ic, label, kind = 'ghost') => `<button class="btn ${kind} small" data-ctl="${act}">${icon(ic)}${label}</button>`;
    el.querySelector('.t-actions').innerHTML = (st === 'lobby' ? b('start', 'play', L('Започни'), 'accent')
      : st === 'running' ? (A.mode === 'quiz' ? '' : b('addTime', 'clock', L('+5 мин')) + b(Lv.lockedAll ? 'unlockAll' : 'lockAll', Lv.lockedAll ? 'unlock' : 'lock', Lv.lockedAll ? L('Отключи всички') : L('Заключи всички'))) + b('pause', 'pause', L('Пауза')) + b('end', 'stop', L('Край'))
      : st === 'paused' ? b('resume', 'play', L('Продължи'), 'accent') + b('end', 'stop', L('Край'))
      : `<button class="btn accent small" data-results>${icon('chart')}${L('Резултати')}</button>`) + (A.mode === 'quiz' ? `<button class="iconbtn" data-full aria-label="${L('На цял екран')}">${icon('tv')}</button>` : '');
    paintClock();
  };

  /* ---------- each at their own pace ---------- */
  const drawNormal = () => {
    const order = (A.tasks || []).map(t => t.id), byUid = Object.fromEntries(atts.map(a => [a.studentId, a]));
    const joined = atts.length, done = atts.filter(a => a.status !== 'in_progress').length, total = (A.studentIds || []).length;
    const flagsN = sum(atts.map(a => a.flags || 0));
    const rows = atts.map(a => ({ a, marks: liveMarks(key, a), ans: Object.values(a.responses || {}).filter(v => v != null).length }));
    rows.sort((x, y) => sortBy === 'alerts' ? (y.a.flags || 0) - (x.a.flags || 0) : sortBy === 'progress' ? y.ans - x.ans : (x.a.studentName || '').localeCompare(y.a.studentName || '', 'bg'));
    const missing = members.filter(m => !byUid[m.id] && !(A.live && (A.live.kicked || []).includes(m.id)));
    const events = atts.flatMap(a => (a.events || []).filter(e => FLAG_EVENTS.includes(e.type) || ['back', 'locked', 'submitted'].includes(e.type)).map(e => ({ ...e, name: a.studentName, uid: a.studentId }))).sort((x, y) => y.t - x.t).slice(0, 40);
    const right = rows.map(r => Object.values(r.marks).filter(s => s === 'right').length);
    body.innerHTML = `<div class="t-livebar"><span><b>${joined}</b>/${total} ${L('влезли')}</span><span><b>${done}</b> ${L('предали')}</span><span><b>${rows.length ? pct(avg(rows.map(r => r.ans / Math.max(1, order.length)))) : '–'}</b> ${L('напредък')}</span><span><b>${rows.length ? pct(avg(right.map(x => x / Math.max(1, order.length)))) : '–'}</b> ${L('верни досега')}</span><span class="${flagsN ? 'warn' : ''}"><b>${flagsN}</b> ${L('сигнала')}</span>
        <div class="seg t-sort">${[['name', 'Име'], ['progress', 'Напредък'], ['alerts', 'Сигнали']].map(([k, l]) => `<button data-sort="${k}" class="${sortBy === k ? 'on' : ''}">${L(l)}</button>`).join('')}</div></div>
      ${A.live && A.live.state === 'lobby' ? `<div class="card cl-note">${icon('info')}<div><b>${L('Учениците влизат от BingO → Клас')}</b><p class="muted small">${L('Тестът им се появява сам. Натиснете „Започни“, когато всички са вътре.')}</p></div></div>` : ''}
      <div class="t-live">
        <div class="t-stugrid">${rows.map(({ a, marks, ans }) => stuCard(a, marks, ans, order)).join('') || emptyBox('users', L('Още никой не е влязъл'), '')}
          ${missing.length ? `<div class="t-missing"><b>${L('Не са влезли ({n})', { n: missing.length })}</b> ${missing.map(m => `<span>${esc(m.name || m.email)}</span>`).join('')}</div>` : ''}</div>
        <aside class="card t-feed"><h3>${icon('alert')}${L('Сигнали')}</h3>${events.length ? events.map(e => evLine(e).replace('<div class="t-ev', `<div data-stu="${esc(e.uid)}" class="t-ev`).replace('<span>', `<span><b>${esc(e.name || '')}</b> `)).join('') : `<p class="muted small">${L('Няма сигнали.')}</p>`}</aside>
      </div>`;
    paintTimes();
  };
  const stuCard = (a, marks, ans, order) => {
    const cur = (a.order || [])[a.current || 0], t = (A.tasks || []).find(x => x.id === cur), k = key[cur];
    const doneSt = a.status !== 'in_progress';
    const recentFlag = (a.events || []).some(e => FLAG_EVENTS.includes(e.type) && Date.now() - e.t < 30000);
    const leftNow = (() => { const ev = (a.events || []).filter(e => ['left', 'back', 'start'].includes(e.type)).sort((x, y) => x.t - y.t).pop(); return ev && ev.type === 'left'; })();
    const ac = acRules(A), strikes = (a.strikes || 0) - (a.forgiven || 0);
    const resp = t ? responseText(t, k, (a.responses || {})[cur]) : '';
    return `<button class="t-stu ${doneSt ? 'done' : ''} ${a.locked ? 'locked' : ''} ${recentFlag || leftNow ? 'flag' : ''}" data-stu="${esc(a.studentId)}" data-seen="${tsMs(a.lastSeen) || 0}">
      <div class="t-stu-top"><b>${esc(a.studentName || '')}</b>${a.flags ? `<span class="t-flag" title="${L('Сигнали')}">⚠ ${a.flags}</span>` : ''}${ac.onLeave !== 'log' && strikes > 0 && !doneSt ? `<span class="t-strikes" title="${L('Излизания / позволени')}">${strikes}/${ac.allowedLeaves + 1}</span>` : ''}${a.locked ? icon('lock') : ''}${a.device && a.device.platform ? `<span class="t-dev" title="${esc(deviceLine(a))}">${icon(a.device.platform === 'android' ? 'phone' : 'tv')}</span>` : ''}${doneSt ? `<span class="cl-pill p-done">${L('Предаде')}</span>` : a.locked && a.lockReason === 'left' ? `<span class="cl-pill p-missed">${L('Заключен')}</span>` : leftNow ? `<span class="cl-pill p-missed">${L('Извън теста')}</span>` : ''}</div>
      <div class="t-dots">${order.map((id, n) => `<i class="d-${marks[id] || 'empty'} ${id === cur && !doneSt ? 'cur' : ''}" title="${n + 1}"></i>`).join('')}</div>
      <div class="t-stu-now">${doneSt ? `<span class="muted">${L('{a} от {b} отговора', { a: ans, b: order.length })}</span>` : `<span>${L('Въпрос {a} от {b}', { a: (a.current || 0) + 1, b: order.length })}</span><span class="t-since" data-since="${tsMs(a.curSince) || tsMs(a.startedAt) || 0}"></span>`}</div>
      ${!doneSt && resp ? `<div class="t-stu-resp">${esc(resp)}</div>` : ''}</button>`;
  };
  const stuSheet = uid => {
    const a = atts.find(x => x.studentId === uid); if (!a) return;
    const marks = liveMarks(key, a);
    sheet({ title: a.studentName, wide: true, body: `<div class="t-stu-detail">
        <div class="t-stu-qs">${(A.tasks || []).map((t, n) => { const r = (a.responses || {})[t.id]; return `<div class="t-sq m-${marks[t.id] || 'empty'}"><b>${n + 1}.</b><span class="rt">${richInline(String(t.prompt || t.text || '').slice(0, 90))}</span><span class="t-sq-a">${esc(responseText(t, key[t.id], r)) || '<span class="muted">—</span>'}</span><small>${a.timeOn && a.timeOn[t.id] ? fmtClock(a.timeOn[t.id]) : ''}</small></div>`; }).join('')}</div>
        ${deviceLine(a) ? `<p class="muted small t-devline">${icon(a.device.platform === 'android' ? 'phone' : 'tv')} ${esc(deviceLine(a))}</p>` : ''}
        <h3>${L('Събития')}</h3><div class="t-evlist">${(a.events || []).slice().sort((x, y) => x.t - y.t).map(evLine).join('') || `<p class="muted">${L('Няма')}</p>`}</div></div>`,
      actions: a.status === 'in_progress' ? [...(A.kind === 'live' ? [{ id: 'time', label: L('+5 мин'), icon: 'clock' }] : []), { id: a.locked ? 'unlock' : 'lock', label: a.locked ? L('Отключи') : L('Заключи'), icon: a.locked ? 'unlock' : 'lock' }, ...(!a.locked && (a.strikes || 0) > (a.forgiven || 0) ? [{ id: 'forgive', label: L('Прости излизанията') }] : []), A.kind === 'live' ? { id: 'kick', label: L('Изключи'), kind: 'danger' } : { id: 'submit', label: L('Предай сега'), kind: 'danger' }] : [{ id: 'grade', label: L('Към оценката'), kind: 'primary' }] }).then(act => {
      const pc = action => busy(null, () => callFn('proctorControl', { assignmentId: aid, uid, action }));
      if (act === 'time') ctl('addTime', { uid, seconds: 300 });
      if (act === 'lock' || act === 'unlock' || act === 'forgive') pc(act).then(() => act === 'unlock' && toast(L('{n} е отключен; предупрежденията започват отначало', { n: a.studentName })));
      if (act === 'submit') confirmBox(L('Да предам ли теста на {n}?', { n: a.studentName }), L('Предава се това, което е написал дотук.'), L('Предай'), true).then(ok => ok && pc('submit'));
      if (act === 'kick') confirmBox(L('Да изключа ли {n}?', { n: a.studentName }), L('Работата му се предава веднага и не може да влезе отново.'), L('Изключи'), true).then(ok => ok && ctl('kick', { uid }));
      if (act === 'grade') go('tGrade', { attemptId: `${aid}_${uid}` });
    });
  };
  /* a student the server locked a moment ago (the teacher's rule) — the server does the locking, even with this screen closed */
  const autoLock = () => {
    for (const a of atts) if (a.status === 'in_progress' && a.locked && a.lockReason === 'left' && !autoLocked.has(a.studentId)) { autoLocked.add(a.studentId); if (Date.now() - (tsMs(a.lockedAt) || 0) < 60000) toast(L('{n} е заключен автоматично (излезе от теста)', { n: a.studentName }), 'bad'); }
  };

  /* ---------- the projector quiz ---------- */
  const quizCounts = qi => { const c = {}; let n = 0; atts.forEach(a => { const q = (a.quiz || {})[qi]; if (q) { n++; const k = JSON.stringify(q.resp); c[k] = (c[k] || 0) + 1; } }); return { c, n }; };
  const drawQuiz = () => {
    const Lv = A.live || {}, qi = Lv.current, t = (A.tasks || [])[qi], total = (A.studentIds || []).length;
    el.classList.add('t-quizmode');
    if (Lv.state === 'lobby') {
      const cls = classById(A.classId);
      body.innerHTML = `<div class="t-qz t-qz-lobby"><h2>${L('Отворете BingO → Клас')}</h2>${cls ? `<div class="t-qr-code big">${esc(cls.code)}</div>` : ''}<p class="muted">${L('{n} вътре', { n: atts.length })}</p><div class="t-qz-names">${atts.map(a => `<span>${esc(a.studentName || '')}</span>`).join('')}</div><button class="btn accent big" data-ctl="start">${icon('play')}${L('Започни')}</button></div>`;
      return;
    }
    if (Lv.state === 'ended') {
      const lb = Lv.leaderboard || [];
      body.innerHTML = `<div class="t-qz t-qz-end"><h2>${L('Класиране')}</h2><div class="t-podium">${[1, 0, 2].map(k => lb[k] ? `<div class="p${k + 1}"><b>${esc(lb[k].name)}</b><span>${lb[k].score}</span><i>${k + 1}</i></div>` : '').join('')}</div><ol class="t-lb">${lb.slice(3, 20).map(r => `<li><b>${esc(r.name)}</b><span>${r.score}</span></li>`).join('')}</ol><button class="btn accent" data-results>${icon('chart')}${L('Резултати')}</button></div>`;
      confetti(); return;
    }
    if (!t) { body.innerHTML = ''; return; }
    const { c, n } = quizCounts(qi), k = key[t.id];
    const opts = t.type === 'choice' ? t.options : null;
    body.innerHTML = `<div class="t-qz">
      <div class="t-qz-top"><span class="kicker">${L('Въпрос {a} от {b}', { a: qi + 1, b: A.tasks.length })}</span><span class="t-qz-timer"></span><span class="t-qz-n"><b>${n}</b>/${total} ${L('отговора')}</span></div>
      <div class="t-qz-q rt">${rich(t.prompt || t.text || '')}</div>
      ${opts ? `<div class="t-qz-opts">${opts.map((o, j) => { const cnt = c[JSON.stringify(j)] || 0, right = Lv.reveal && k && k.answer === j; return `<div class="t-qz-opt ${Lv.reveal ? (right ? 'right' : 'dim') : ''}" style="--c:${QUIZ_COLORS[j % 6]}"><span class="shape">${QUIZ_SHAPES[j % 6]}</span><span class="rt">${richInline(o)}</span>${Lv.reveal ? `<span class="t-qz-cnt">${cnt}</span><i style="width:${n ? cnt / n * 100 : 0}%"></i>` : ''}</div>`; }).join('')}</div>`
        : `<p class="muted">${Lv.reveal && Lv.stats ? L('{a} от {b} верни', { a: Lv.stats.right, b: Lv.stats.n }) : L('Учениците пишат отговора на телефоните си.')}</p>`}
      ${Lv.reveal ? `<div class="t-qz-lb"><h3>${L('Класиране')}</h3><ol>${(Lv.leaderboard || []).slice(0, 5).map(r => `<li><b>${esc(r.name)}</b><span>${r.score}</span></li>`).join('')}</ol></div>` : ''}
      <div class="t-qz-ctl">${Lv.state === 'paused' ? '' : Lv.reveal ? `<button class="btn accent big" data-ctl="next">${qi + 1 >= A.tasks.length ? L('Край и класиране') : L('Следващ въпрос')}${icon('next')}</button>` : `<button class="btn ghost big" data-ctl="reveal">${L('Покажи отговора')}</button>`}</div></div>`;
    quizTick();
  };
  function quizTick() {
    const tEl = el.querySelector('.t-qz-timer'); if (!tEl || !A || !A.live) return;
    const Lv = A.live; if (Lv.reveal || Lv.state !== 'running') { tEl.textContent = ''; return; }
    const lim = ((A.settings || {}).quizSeconds || 20) * 1000, left = Math.max(0, tsMs(Lv.questionStartedAt) + lim - Date.now());
    tEl.textContent = Math.ceil(left / 1000);
    tEl.classList.toggle('low', left < 5000);
    const { n } = quizCounts(Lv.current), total = atts.filter(a => a.status === 'in_progress').length || (A.studentIds || []).length;
    if (!revealing && (left <= 0 || (total && n >= total))) { revealing = true; ctl('reveal').finally(() => { revealing = false; }); }
  }

  const draw = () => { if (!A) return; header(); if (A.mode === 'quiz') drawQuiz(); else drawNormal(); };
  watch(docRef('assignments/' + aid), s => { if (!s.exists) { body.innerHTML = emptyBox('info', L('Тестът е изтрит'), ''); return; } const was = A && A.live && A.live.current; A = { id: s.id, ...s.data() }; if (A.mode === 'quiz' && A.live && A.live.current !== was) revealing = false; draw(); }, nav);
  watch(col('attempts').where('teacherIds', 'array-contains', myUid()).where('assignmentId', '==', aid), s => { atts = docs(s); if (A) { if (A.mode !== 'quiz') { drawNormal(); autoLock(); } else if (A.live && ['lobby', 'running'].includes(A.live.state)) drawQuiz(); } }, nav);
  docRef('assignments/' + aid).get().then(s => s.exists && watch(col(`classes/${s.data().classId}/members`), m => { members = docs(m); if (A && A.mode !== 'quiz') drawNormal(); }, nav)).catch(() => { });
  tWatchBase(nav, () => { }, ['classes']);

  el.addEventListener('click', e => {
    const c = e.target.closest('[data-ctl]');
    if (c) {
      const act = c.dataset.ctl;
      if (act === 'end') return confirmBox(L('Да приключа ли теста?'), L('Работите на всички се предават и се оценяват.'), L('Край'), true).then(ok => ok && ctl('end', {}, c));
      if (act === 'addTime') return ctl('addTime', { seconds: 300 }, c);
      return ctl(act, {}, c);
    }
    if (e.target.closest('[data-results]')) return go('tAssignment', { aid }, { replace: true });
    const so = e.target.closest('[data-sort]'); if (so) { sortBy = so.dataset.sort; return drawNormal(); }
    const st = e.target.closest('[data-stu]'); if (st) return stuSheet(st.dataset.stu);
    if (e.target.closest('[data-full]')) { const r = document.documentElement; document.fullscreenElement ? document.exitFullscreen().catch(() => { }) : r.requestFullscreen && r.requestFullscreen().catch(() => { }); }
  });
};
