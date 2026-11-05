/* ================= Past exams: НВО and ДЗИ from earlier years, as they were =================
   content/past-exams/*.json are Shelly modules with one exam each and a "past" record:
   { exam: 'nvo4' | 'nvo7' | 'nvo10' | 'dzi12', subj: 'math' | 'bel', year, date, variant }.
   They run on the same play screen as a session. Points come from the official key; open tasks are
   marked by the learner against the official answer. Past exams have no skills, so the skill map
   is left alone; the last result of each exam is kept in S.pastResults.
   content/past-exams-en/*.json are English versions with the same id; in English the app shows them
   instead (results stay shared, since the id and the key are the same). An exam without one stays Bulgarian. */
let PAST = [], PAST_EN = {};
function buildPast() {
  PAST = [];
  for (const json of window.PAST_EXAMS_JSON || []) {
    const { errors } = checkModule(json);
    if (errors.length || !json.past) { console.warn('past exam skipped', json.id, errors); continue; }
    PAST.push(prepareModule(json));
  }
  for (const json of window.PAST_EXAMS_EN_JSON || []) {
    const { errors } = checkModule(json);
    if (errors.length || !json.past || !PAST.some(m => m.id === json.id)) { console.warn('English past exam skipped', json.id, errors); continue; }
    PAST_EN[json.id] = prepareModule(json);
  }
  PAST.sort((a, b) => b.past.year - a.past.year || String(b.past.date || '').localeCompare(String(a.past.date || '')) || (a.past.variant || 0) - (b.past.variant || 0));
}
const _buildBanksBase = buildBanks;
buildBanks = function () { _buildBanksBase(); buildPast(); };

/* the learner's exam from the setup (58-onboarding.js); before the setup asked, it was the ДЗИ */
const myExam = () => (!['math', 'bel'].includes(S.subject) ? 'dzi12' : EXAMS[S.profile.exam] ? S.profile.exam : 'dzi12');
const pastView = m => (m && appLang() === 'en' && PAST_EN[m.id]) || m;
/* In English mode, pastView() swaps in the English module, so its exam title, part titles and
   instructions supply the UI chrome. Tasks, options, solutions, explanations and rubrics stay in
   their original language. */
/* math and БЕЛ have past exams for every НВО and the ДЗИ; the other maturas only exist as a ДЗИ */
const pastFor = (subj, exam) => PAST.filter(m => m.past.subj === subj && (m.past.exam === exam || !['math', 'bel'].includes(subj))).map(pastView);
const pastById = id => pastView(PAST.find(m => m.id === id));
const pastTasks = m => m.exams[0].parts.flatMap(p => p.tasks.map(t => ({ task: t, part: p })));
/* the MON scale (65-forecast.js) is for 100 points and holds for НВО 7, НВО 10 and ДЗИ */
const pastGrade = (m, pts, max) => (m.past.exam !== 'dzi12' || !max ? '' : gradeOf(pts / max * 100)[1]);
/* English UI title for a Bulgarian-only exam: translated metadata, not translated questions. */
const pastTitle = m => {
  const x = m.exams[0];
  if (appLang() !== 'en' || m.lang === 'en') return x.title;
  const p = m.past, bits = [L(EXAMS[p.exam]), L(SUBJECTS[p.subj].title)];
  if (p.date) bits.push(p.date.split('-').reverse().join('.'));
  else if (p.year) bits.push(String(p.year));
  if (p.session) bits.push(L(p.session));
  if (p.variant) bits.push(L('Вариант {n}', { n: p.variant }));
  return bits.join(' · ');
};

/* the button on Home, under the training buttons */
const _homePastBase = SCREENS.home;
SCREENS.home = async (el, ...rest) => {
  await _homePastBase(el, ...rest);
  const list = pastFor(S.subject, myExam()), sec = el.querySelector('.sec-title');
  if (!list.length || !sec) return;
  sec.insertAdjacentHTML('beforebegin', `<button class="btn ghost block" data-past>${icon('text')}${L('Изпити от минали години')} <small class="btn-sub">${list.length}</small></button>`);
  el.querySelector('[data-past]').onclick = () => pastSheet(S.subject);
};

function pastSheet(subj) {
  const list = pastFor(subj, myExam()), res = S.pastResults || {};
  sheet({
    title: L('Изпити от минали години'),
    body: `<p class="muted">${esc(L(EXAMS[myExam()]))} · ${esc(L(SUBJECTS[subj].title))}. ${esc(L('Задачите са както на изпита; отговорите се проверяват по официалния ключ.'))}${appLang() === 'en' && list.some(m => m.lang !== 'en') ? ' ' + esc(L('Изпитите без английски превод са на български.')) : ''}</p>
      <div class="sklist">${list.map(m => {
        const x = m.exams[0], r = res[m.id];
        return `<button class="skrow" data-act="${esc(m.id)}"><div class="sk-main"><b>${esc(pastTitle(m))}</b>
          <small>${L('{n} задачи · {p} т.', { n: x.count, p: fmtPts(x.max, appLang()) })}${r ? L(' · последно: {p} т.', { p: fmtPts(r.pts, appLang()) }) : ''}${appLang() === 'en' && m.lang !== 'en' ? ' · BG' : ''}</small></div></button>`;
      }).join('')}</div>`,
    actions: [{ id: 'x', label: L('Затвори') }]
  }).then(v => { if (v && v !== 'x' && pastById(v)) go('pastexam', { id: v }); });
}

/* A clear fallback rubric for a 30-point essay / ЛИС when the exam file does not provide one. */
const ESSAY_RUBRIC_30 = [
  { text: 'Съдържание и аргументация: отговаря на темата, има ясна позиция и подкрепящи примери.', points: 10 },
  { text: 'Структура и свързаност: въведение, развитие и заключение; логични връзки между частите.', points: 7 },
  { text: 'Езикова грамотност: правопис, пунктуация, словообразуване и подходящ речников запас.', points: 7 },
  { text: 'Формат и изисквания: обем, стил и съответствие с поставената задача.', points: 6 }
];

SCREENS.pastexam = async (el, { id }, nav) => {
  const m = pastById(id); if (!m) return back();
  const sub = SUBJECTS[m.past.subj], x = m.exams[0], Q = pastTasks(m);
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color)); el.setAttribute('lang', m.lang || 'bg'); const lg = appLang();
  const P = { i: 0, phase: 'answer', done: false, touched: false, got: [], resp: [] };
  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${L('Затвори')}">${icon('close')}</button>${bar(0, 'pbar')}<span class="pcount"></span></header>
    <main class="playmain"></main>
    <footer class="checkbar"><div class="verdict"></div><button class="btn accent big" data-main></button></footer>`;
  const main = el.querySelector('.playmain'), foot = el.querySelector('.checkbar'), btn = foot.querySelector('[data-main]'), verdict = foot.querySelector('.verdict');
  nav.guard = async () => {
    const ok = P.done || !P.touched || await confirmBox(L('Да спрем ли?'), L('Резултатът от този изпит няма да се запази.'), L('Спри'), true);
    if (ok && 'speechSynthesis' in window) speechSynthesis.cancel();   /* a listening text must not keep talking */
    return ok;
  };
  let view = null, task = null, rubric = null, checkedAt = 0;
  const paintCount = () => { el.querySelector('.pcount').textContent = `${P.i + 1} / ${Q.length}`; el.querySelector('.pbar i').style.width = (P.i / Q.length * 100) + '%'; };
  const upd = () => {
    if (P.phase !== 'answer') return;
    if (task.type === 'open') btn.disabled = !String(view.get().text || '').trim();
    else btn.disabled = !(view.ready() || task.type === 'order');
    P.touched = P.touched || !btn.disabled;
  };

  function showTask() {
    const { task: t, part } = Q[P.i]; task = t; P.phase = 'answer'; rubric = null;
    view = taskView(task, m, { mode: 'practice', seed: id, onChange: upd });
    const first = part.tasks[0] === task;   /* the part's instructions, as on the exam sheet, before its first task */
    main.innerHTML = `<div class="taskhead"><div class="chips"><i class="score">${esc(pastTitle(m))}</i><i>${esc(L(part.title || ''))}</i><i>${L('Задача {n} · {p} т.', { n: esc(task.id.replace(/^q/, '')), p: fmtPts(task.points, lg) })}</i></div></div>
      ${first && part.instructions ? `<p class="muted rt">${richInline(part.instructions)}</p>` : ''}`;
    main.appendChild(view.el);
    listenMount(m, task, view.el);   /* listening texts: a player instead of the text (66c-listen.js) */
    window.scrollTo(0, 0); paintCount();
    foot.className = 'checkbar'; verdict.innerHTML = ''; btn.textContent = L(task.type === 'open' ? 'Виж отговора' : 'Провери'); upd();
  }

  function check() {
    const fb = view.el.querySelector('.fb');
    if (task.type === 'open') {
      const answer = view.get();
      if (!String(answer.text || '').trim()) { toast(L('Напиши отговор, преди да се оцениш.'), 'bad'); return; }
      if (task.points >= 30 && (!Array.isArray(task.rubric) || !task.rubric.length)) task.rubric = ESSAY_RUBRIC_30;
      P.phase = 'next'; P.touched = true;
      view.show({ status: 'ungraded' }); listenReveal(view.el);
      /* pictures that belong to the official solution (a drawing in the key), shown only after the answer */
      if (task.solutionMedia && task.solutionMedia.length) { fb.insertAdjacentHTML('beforeend', `<div class="task-media">${blocksHTML(task.solutionMedia)}</div>`); hydrateMedia(fb, m.id); }
      rubric = rubricView(task, null);
      fb.hidden = false; fb.appendChild(rubric.el);
      verdict.innerHTML = `${icon('info')}<span><b>${L('Оцени се сам')}</b><small>${L('по официалния отговор и критериите')}</small></span>`;
      /* Gemini checks the answer against the official answer (Gemini Nano gives a first guess at once) */
      if (aiOn() && task.answer) {
        fb.insertAdjacentHTML('beforeend', `<button class="btn ghost block" data-aigrade>${L('✦ Gemini да провери отговора ми')}</button><div class="aibox" hidden></div>`);
        const gb = fb.querySelector('[data-aigrade]'), box = gb.nextElementSibling;
        gb.onclick = async () => {
          gb.disabled = true; box.hidden = false; box.innerHTML = '<div class="spinner"></div>';
          nanoPreGrade(task, answer.text).then(s => { if (s != null && box.querySelector('.spinner')) box.insertAdjacentHTML('beforeend', `<p class="muted small">${L('Първа оценка на устройството: ≈ {p}%', { p: Math.round(s * 100) })}</p>`); }).catch(() => { });
          try {
            const v = await aiGrade(m.past.subj, { ...task, skill: task.skill || 'read' }, answer.text);
            const pts = roundTo(v.score * task.points, 1);
            box.innerHTML = `<b>${esc(aiBadge())} · ${L('≈ {a} от {b} т.', { a: fmtPts(pts, lg), b: fmtPts(task.points, lg) })}</b><div class="rt">${rich(v.feedback || '')}</div><p class="muted small">${L('Това е подсказка за оценката — крайната оценка е твоя.')}</p>`;
            P.aiPts = P.aiPts || {}; P.aiPts[P.i] = pts; gb.remove();
          } catch (err) { box.innerHTML = `<span class="danger-text">${esc(err.message)}</span>`; gb.disabled = false; }
        };
      }
    } else {
      P.phase = 'next'; P.touched = true;
      const res = scoreTask(task, view.get(), m.lang || 'bg'), right = res.status === 'right';
      P.got[P.i] = res.points;
      view.show(res); sound(right ? 'right' : 'wrong'); listenReveal(view.el);
      foot.className = 'checkbar ' + (right ? 'good' : 'bad');
      verdict.innerHTML = `${icon(right ? 'check' : 'close')}<span><b>${L(right ? 'Вярно!' : res.points > 0 ? 'Отчасти' : 'Не съвсем')}</b><small>${L('{a} от {b} т.', { a: fmtPts(res.points, lg), b: fmtPts(task.points, lg) })}</small></span>`;
    }
    btn.textContent = L(P.i === Q.length - 1 ? 'Виж резултата' : 'Напред');
    checkedAt = Date.now();
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  btn.addEventListener('click', () => {
    if (P.done) return;
    if (P.phase === 'answer') return check();
    if (Date.now() - checkedAt < 150) return;   /* a double tap must not skip the answer it just showed */
    if (rubric) P.got[P.i] = sum(rubric.get()) || (P.aiPts && P.aiPts[P.i]) || 0;
    if (P.phase === 'next') P.resp[P.i] = view.get();
    if (++P.i < Q.length) showTask(); else finish();
  });
  main.addEventListener('submit-answer', () => { if (P.phase === 'answer' && !btn.disabled) check(); });

  function finish() {
    P.done = true;
    const pts = roundTo(sum(P.got.map(v => v || 0)), 2), max = x.max, grade = pastGrade(m, pts, max);
    (S.pastResults || (S.pastResults = {}))[id] = { pts, max, at: Date.now() }; saveState(true);
    /* the missed closed questions, with the skill the training bank gave them (66b-past-bank.js) */
    const missed = Q.map((q, i) => ({ q, i })).filter(({ q, i }) => q.task.type === 'choice' && (P.got[i] || 0) < q.task.points)
      .map(({ q, i }) => { const b = (BANK[m.past.subj] || []).find(t => t.id === 'past:' + m.id + ':' + q.task.id); return { task: b || { ...q.task, skill: SUBJECTS[m.past.subj].skills[0].id }, mod: b ? fakeModule(m.past.subj) : m, resp: P.resp[i] ?? null, skipped: P.resp[i] == null, correct: false }; });
    if (pts / max >= 0.7) { sound('done'); confetti(); }
    el.querySelector('.playbar').outerHTML = topbar(esc(pastTitle(m)), { noBack: true, right: `<button class="iconbtn" data-close aria-label="${esc(L('Затвори'))}">${icon('close')}</button>` });
    el.querySelector('[data-close]').onclick = () => home();
    foot.remove();
    main.innerHTML = `<div class="result pad">
      <div class="res-hero">${ring(pts / max, Math.round(pts / max * 100) + '%', 'big')}
        <h1>${L('{a} от {b} т.', { a: fmtPts(pts, lg), b: fmtPts(max, lg) })}</h1>
        <p class="res-main">${grade ? `${L('По скалата на МОН:')} <b>${esc(grade)}</b>` : esc(pastTitle(m))}</p></div>
      ${reviewHTML(missed)}
      <div class="res-actions"><button class="btn ghost" data-out>${L('Към картата')}</button><button class="btn accent" data-again>${icon('reset')}${L('Отначало')}</button></div></div>`;
    mountReview(main, m.past.subj, m, missed);
    main.querySelector('[data-out]').onclick = () => home();
    main.querySelector('[data-again]').onclick = () => go('pastexam', { id }, { replace: true });
  }
  showTask();
};
