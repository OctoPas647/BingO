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
const myExam = () => (EXAMS[S.profile.exam] ? S.profile.exam : 'dzi12');
const pastView = m => (m && appLang() === 'en' && PAST_EN[m.id]) || m;
const pastFor = (subj, exam) => PAST.filter(m => m.past.subj === subj && m.past.exam === exam).map(pastView);
const pastById = id => pastView(PAST.find(m => m.id === id));
const pastTasks = m => m.exams[0].parts.flatMap(p => p.tasks.map(t => ({ task: t, part: p })));
/* the MON scale (65-forecast.js) is for 100 points and holds for НВО 7, НВО 10 and ДЗИ */
const pastGrade = (m, pts, max) => (m.past.exam !== 'dzi12' || !max ? '' : gradeOf(pts / max * 100)[1]);

/* the button on Home, under the training buttons */
const _homePastBase = SCREENS.home;
SCREENS.home = async (el, ...rest) => {
  await _homePastBase(el, ...rest);
  const list = pastFor(S.subject, myExam()), sec = el.querySelector('.sec-title');
  if (!list.length || !sec) return;
  sec.insertAdjacentHTML('beforebegin', `<button class="btn ghost block" data-past>${icon('text')}${L('Изпити от минали години')} · ${esc(L(EXAMS[myExam()]))}</button>`);
  el.querySelector('[data-past]').onclick = () => pastSheet(S.subject);
};

function pastSheet(subj) {
  const list = pastFor(subj, myExam()), res = S.pastResults || {};
  sheet({
    title: L('Изпити от минали години'),
    body: `<p class="muted">${esc(L(EXAMS[myExam()]))} · ${esc(L(SUBJECTS[subj].title))}. ${esc(L('Задачите са както на изпита; отговорите се проверяват по официалния ключ.'))}${appLang() === 'en' && list.some(m => m.lang !== 'en') ? ' ' + esc(L('Изпитите без английски превод са на български.')) : ''}</p>
      <div class="sklist">${list.map(m => {
        const x = m.exams[0], r = res[m.id];
        return `<button class="skrow" data-act="${esc(m.id)}"><div class="sk-main"><b>${esc(x.title)}</b>
          <small>${L('{n} задачи · {p} т.', { n: x.count, p: fmtPts(x.max, appLang()) })}${r ? L(' · последно: {p} т.', { p: fmtPts(r.pts, appLang()) }) : ''}${appLang() === 'en' && m.lang !== 'en' ? ' · BG' : ''}</small></div></button>`;
      }).join('')}</div>`,
    actions: [{ id: 'x', label: L('Затвори') }]
  }).then(v => { if (v && v !== 'x' && pastById(v)) go('pastexam', { id: v }); });
}

SCREENS.pastexam = async (el, { id }, nav) => {
  const m = pastById(id); if (!m) return back();
  const sub = SUBJECTS[m.past.subj], x = m.exams[0], Q = pastTasks(m);
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color)); el.setAttribute('lang', m.lang || 'bg'); const lg = appLang();
  const P = { i: 0, phase: 'answer', done: false, touched: false, got: [] };
  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${L('Затвори')}">${icon('close')}</button>${bar(0, 'pbar')}<span class="pcount"></span></header>
    <main class="playmain"></main>
    <footer class="checkbar"><div class="verdict"></div><button class="btn accent big" data-main></button></footer>`;
  const main = el.querySelector('.playmain'), foot = el.querySelector('.checkbar'), btn = foot.querySelector('[data-main]'), verdict = foot.querySelector('.verdict');
  nav.guard = async () => P.done || !P.touched || confirmBox(L('Да спрем ли?'), L('Резултатът от този изпит няма да се запази.'), L('Спри'), true);
  let view = null, task = null, rubric = null;
  const paintCount = () => { el.querySelector('.pcount').textContent = `${P.i + 1} / ${Q.length}`; el.querySelector('.pbar i').style.width = (P.i / Q.length * 100) + '%'; };
  const upd = () => { if (P.phase === 'answer') btn.disabled = !(view.ready() || task.type === 'order' || task.type === 'open'); P.touched = P.touched || view.ready(); };

  function showTask() {
    const { task: t, part } = Q[P.i]; task = t; P.phase = 'answer'; rubric = null;
    view = taskView(task, m, { mode: 'practice', seed: id, onChange: upd });
    const first = part.tasks[0] === task;   /* the part's instructions, as on the exam sheet, before its first task */
    main.innerHTML = `<div class="taskhead"><div class="chips"><i class="score">${esc(x.title)}</i><i>${esc(part.title || '')}</i><i>${L('Задача {n} · {p} т.', { n: esc(task.id.replace(/^q/, '')), p: fmtPts(task.points, lg) })}</i></div></div>
      ${first && part.instructions ? `<p class="muted rt">${richInline(part.instructions)}</p>` : ''}`;
    main.appendChild(view.el);
    window.scrollTo(0, 0); paintCount();
    foot.className = 'checkbar'; verdict.innerHTML = ''; btn.textContent = L(task.type === 'open' ? 'Виж отговора' : 'Провери'); upd();
  }

  function check() {
    P.phase = 'next'; P.touched = true;
    const fb = view.el.querySelector('.fb');
    if (task.type === 'open') {
      view.show({ status: 'ungraded' });
      /* pictures that belong to the official solution (a drawing in the key), shown only after the answer */
      if (task.solutionMedia && task.solutionMedia.length) { fb.insertAdjacentHTML('beforeend', `<div class="task-media">${blocksHTML(task.solutionMedia)}</div>`); hydrateMedia(fb, m.id); }
      rubric = rubricView(task, null);
      fb.hidden = false; fb.appendChild(rubric.el);
      verdict.innerHTML = `${icon('info')}<span><b>${L('Оцени се сам')}</b><small>${L('по официалния отговор и критериите')}</small></span>`;
    } else {
      const res = scoreTask(task, view.get(), m.lang || 'bg'), right = res.status === 'right';
      P.got[P.i] = res.points;
      view.show(res); sound(right ? 'right' : 'wrong');
      foot.className = 'checkbar ' + (right ? 'good' : 'bad');
      verdict.innerHTML = `${icon(right ? 'check' : 'close')}<span><b>${L(right ? 'Вярно!' : res.points > 0 ? 'Отчасти' : 'Не съвсем')}</b><small>${L('{a} от {b} т.', { a: fmtPts(res.points, lg), b: fmtPts(task.points, lg) })}</small></span>`;
    }
    btn.textContent = L(P.i === Q.length - 1 ? 'Виж резултата' : 'Напред');
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  btn.addEventListener('click', () => {
    if (P.phase === 'answer') return check();
    /* an empty essay cannot earn self-assessed points, even if its rubric has a full-points line */
    if (rubric) P.got[P.i] = String(view.get().text || '').trim() ? sum(rubric.get()) : 0;
    if (++P.i < Q.length) showTask(); else finish();
  });
  main.addEventListener('submit-answer', () => { if (P.phase === 'answer' && !btn.disabled) check(); });

  function finish() {
    P.done = true;
    const pts = roundTo(sum(P.got.map(v => v || 0)), 2), max = x.max, grade = pastGrade(m, pts, max);
    (S.pastResults || (S.pastResults = {}))[id] = { pts, max, at: Date.now() }; saveState(true);
    const wrong = Q.map((q, i) => (q.task.type !== 'open' && (P.got[i] || 0) < q.task.points ? i + 1 : 0)).filter(Boolean);
    if (pts / max >= 0.7) { sound('done'); confetti(); }
    el.querySelector('.playbar').outerHTML = topbar(esc(x.title), { closeIcon: true });
    foot.remove();
    main.innerHTML = `<div class="result pad">
      <div class="res-hero">${ring(pts / max, Math.round(pts / max * 100) + '%', 'big')}
        <h1>${L('{a} от {b} т.', { a: fmtPts(pts, lg), b: fmtPts(max, lg) })}</h1>
        <p class="res-main">${grade ? `${L('По скалата на МОН:')} <b>${esc(grade)}</b>` : esc(x.title)}</p></div>
      ${wrong.length ? `<div class="card strongnote">${icon('target')}<div><b>${L('Сгрешени задачи с избор:')}</b><br><span class="muted">${wrong.join(', ')}</span></div></div>` : ''}
      <div class="res-actions"><button class="btn ghost" data-out>${L('Към картата')}</button><button class="btn accent" data-again>${icon('reset')}${L('Отначало')}</button></div></div>`;
    main.querySelector('[data-out]').onclick = () => home();
    main.querySelector('[data-again]').onclick = () => go('pastexam', { id }, { replace: true });
  }
  showTask();
};
