/* ================= A session: diagnostic, focus training, or one skill =================
   Built on Shelly's practice screen and task views. What is new:
   - tasks come from the weakest skills (planSession), at a level that follows the learner
   - a wrong answer names the typical mistake, and Gemini can explain it for *this* answer
   - after a wrong answer, an existing later focus slot may become a "twin"
   - every answer updates the skill map and goes to the log (Google Sheets / Looker Studio) */

const MODE_TITLE = { diag: 'Диагностика', focus: 'Тренировка на слабото', skill: 'Една тема' };

SCREENS.session = async (el, { subj, mode, skill }, nav) => {
  const sub = SUBJECTS[subj], m = fakeModule(subj), sessionId = uid();
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color)); el.setAttribute('lang', 'bg');
  const startMap = subjectSummary(subj), before = Object.fromEntries(startMap.list.map(x => [x.sk.id, x.st.p]));
  const planned = mode === 'diag' ? { plan: planDiagnostic(subj) } : mode === 'skill' ? { plan: Array.from({ length: 6 }, () => ({ skill, why: 'focus' })) } : planSession(subj, 8);
  /* The task queue is initialized once and never changes length during a session.
     AI tasks and twins may fill or retarget existing slots, but cannot add slots. */
  const Q = planned.plan.slice(0, 8).map(p => ({ ...p })), P = { i: 0, phase: 'answer', done: false, touched: false, answers: [], used: new Set(), sigs: new Set(), extraDiag: new Set() };
  if (!Q.length) { toast('Всички теми са силни — няма какво да тренираме'); return back(); }

  /* Gemini: prepare one new task for the weakest skill in the background. It fills an
     existing upcoming focus slot; it never inserts a new queue item. */
  if (aiOn() && mode !== 'diag') {
    const target = planned.focus ? planned.focus[0] : skill;
    if (target) aiNewTask(subj, target, levelFor(skillState(subj, target).p), sessionId)
      .then(t => {
        if (P.done || !t || P.used.has(taskKey(t))) return;
        const slot = Q.find((item, index) => index >= P.i && item.why === 'focus' && !item.task);
        if (slot) { slot.task = t; paintCount(); }
      })
      .catch(err => console.warn('AI task', err));
  }

  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${L('Затвори')}">${icon('close')}</button>${bar(0, 'pbar')}<span class="pcount"></span></header>
    <main class="playmain"></main>
    <footer class="checkbar"><div class="verdict"></div><button class="btn accent big" data-main></button></footer>`;
  const main = el.querySelector('.playmain'), foot = el.querySelector('.checkbar'), btn = foot.querySelector('[data-main]'), verdict = foot.querySelector('.verdict');
  nav.guard = async () => P.done || !P.touched || confirmBox(L('Да спрем ли?'), L('Отговорите досега вече са записани в картата на уменията.'), L('Спри'), true);
  let view = null, task = null, shownAt = 0, aiHints = 0, checkedAt = 0;
  const paintCount = () => { el.querySelector('.pcount').textContent = `${Math.min(P.i + 1, Q.length)} / ${Q.length}`; el.querySelector('.pbar i').style.width = (P.i / Q.length * 100) + '%'; };

  /* The same question never comes twice in one session (P.used holds ids and, for generated
     tasks, the question text). A slot with no unseen task is skipped, not removed. */
  function nextTask() {
    const item = Q[P.i], st = skillState(subj, item.skill), lvl = item.level || levelFor(st.p);
    const t = item.task && !P.used.has(taskKey(item.task)) ? item.task : pickTask(subj, item.skill, lvl, sessionId + ':' + P.i, P.used);
    if (!t) return null;
    item.task = t; P.used.add(t.id); P.used.add(taskKey(t));
    return t;
  }

  function showTask() {
    while (P.i < Q.length && !(task = nextTask())) P.i++;
    if (P.i >= Q.length) return P.answers.length ? finish() : (toast('Няма нови задачи по тази тема'), back());
    const item = Q[P.i]; P.phase = 'answer'; aiHints = 0; shownAt = Date.now();
    view = taskView(task, m, { mode: 'practice', seed: sessionId, onChange: upd });
    const sk = skillDef(subj, task.skill);
    const tag = item.why === 'check' ? `<i class="chk">${icon('check')}${L('Проверка на силно умение')}</i>` : item.why === 'twin' ? `<i class="twin">${icon('reset')}${L('Близнак: същото, нови числа')}</i>` : '';
    main.innerHTML = `<div class="taskhead"><div class="chips"><i class="score">${esc(L(sk.name))}</i><i>${L('Ниво {n}', { n: task.level || 2 })}</i><i class="src-${task.src}">${esc(L(SRC_LABEL[task.src] || ''))}</i>${tag}</div></div>`;
    main.appendChild(view.el);
    if (task.src === 'ai') main.insertAdjacentHTML('beforeend', `<p class="aiwarn">${icon('info')}${L('Задачата е създадена от ИИ и може да има грешка.')} <button class="linkbtn" data-report>${L('Докладвай грешка')}</button></p>`);
    if (aiOn()) main.insertAdjacentHTML('beforeend', `<button class="hintbtn aihint" data-aihint>${icon('bulb')}${L('Подсказка от Gemini')} <small>${L('без отговора')}</small></button><div class="aibox" hidden></div>`);
    window.scrollTo(0, 0); paintCount();
    foot.className = 'checkbar'; verdict.innerHTML = ''; btn.textContent = L('Провери'); upd();
  }
  function upd() { if (P.phase === 'answer') { btn.disabled = !view.ready(); P.touched = P.touched || view.ready(); } }

  function mistakeOf(resp) {
    if (task.type === 'choice' && Array.isArray(task.misc)) return task.misc[resp] || null;
    if (task.type === 'number' && task.numMisc) { const v = parseNumber(resp); const hit = task.numMisc.find(w => Number.isFinite(v) && Math.abs(v - w.v) < 0.011); return hit ? hit.misc : null; }
    return null;
  }

  function check() {
    const item = Q[P.i], resp = view.get(), res = scoreTask(task, resp, 'bg'), correct = res.status === 'right';
    const misc = correct ? null : mistakeOf(resp), secs = (Date.now() - shownAt) / 1000, hints = view.hintsUsed() + aiHints;
    const ch = recordAnswer(subj, task, correct, misc);
    logAnswer({ subj, task, correct, misc, secs, hints, before: ch.before, after: ch.after, mode: item.why === 'check' ? 'check' : mode, session: sessionId });
    P.answers.push({ skill: task.skill, correct, misc, task, resp, res });
    view.show(res); P.phase = 'next'; P.touched = true; checkedAt = Date.now();
    sound(correct ? 'right' : 'wrong');
    foot.className = 'checkbar ' + (correct ? 'good' : 'bad');
    const sk = skillDef(subj, task.skill);
    verdict.innerHTML = `${icon(correct ? 'check' : 'close')}<span><b>${correct ? L('Вярно!') : L('Не съвсем')}</b><small>${esc(L(sk.name))}: ${pctTxt(ch.before)} → ${pctTxt(ch.after)}</small></span>`;
    main.querySelector('[data-aihint]')?.remove();
    const fb = view.el.querySelector('.fb');
    if (!correct) {
      fb.hidden = false;
      const inlineWhy = task.type === 'choice' && task.why && task.why[resp];
      if (misc || !inlineWhy) fb.insertAdjacentHTML('afterbegin', `<div class="mistake">${icon('target')}<div><b>${misc ? L('Типична грешка') : L('Грешка')}</b><span class="rt">${misc ? richInline(miscLabel(misc)) : L('Виж решението по-долу.')}</span></div></div>`);
      if (aiOn()) fb.insertAdjacentHTML('beforeend', `<button class="btn ghost block aiexplain" data-aiexplain>${L('✦ Защо сгреших? Обясни Gemini')}</button><div class="aibox" hidden></div>`);
      /* Turn one existing later focus slot into a twin. This keeps the remediation
         immediately after the mistake without changing the queue length. */
      if (item.why !== 'twin' && mode !== 'diag') {
        const twin = Q.find((x, index) => index > P.i && x.why === 'focus');
        if (twin) { twin.why = 'twin'; twin.level = task.level; }
      }
      /* Diagnostic already has one slot per skill; do not append another. */
      if (mode === 'diag') P.extraDiag.add(task.skill);
    }
    btn.textContent = P.i === Q.length - 1 ? L('Виж резултата') : L('Напред');
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  btn.addEventListener('click', () => {
    if (P.phase === 'answer') return check();
    /* a quick second tap on "Провери" must not skip the feedback the first tap just opened */
    if (Date.now() - checkedAt < 450) return;
    if (++P.i < Q.length) showTask(); else finish();
  });
  main.addEventListener('submit-answer', () => { if (P.phase === 'answer' && !btn.disabled) check(); });
  main.addEventListener('click', async e => {
    const hb = e.target.closest('[data-aihint]');
    if (hb) {
      const box = main.querySelector('.aibox'); hb.disabled = true; box.hidden = false; box.innerHTML = `<div class="spinner"></div>`;
      try { const j = await aiHint(subj, task); aiHints++; box.innerHTML = `<b>✦ ${esc(L('Подсказка'))}</b><div class="rt">${rich(j.hint || '')}</div>`; hb.remove(); }
      catch (err) { box.innerHTML = `<span class="danger-text">${esc(err.message)}</span>`; hb.disabled = false; }
      return;
    }
    const xb = e.target.closest('[data-aiexplain]');
    if (xb) {
      const box = xb.nextElementSibling, last = P.answers[P.answers.length - 1]; xb.disabled = true; box.hidden = false; box.innerHTML = `<div class="spinner"></div>`;
      try {
        const j = await aiExplainMistake(subj, task, last.resp, last.misc);
        box.innerHTML = `<b>✦ ${esc(j.diagnosis || L('Какво се обърка'))}</b><div class="rt">${rich(j.explanation || '')}</div>${j.check ? `<p class="aicheck"><b>${L('Провери се:')}</b> <span class="rt">${richInline(j.check)}</span></p>` : ''}`;
        xb.remove();
      } catch (err) { box.innerHTML = `<span class="danger-text">${esc(err.message)}</span>`; xb.disabled = false; }
      return;
    }
    if (e.target.closest('[data-report]')) { S.aiFlags.push({ at: new Date().toISOString(), task }); saveState(); toast('Благодаря! Задачата е отбелязана за проверка от учител.'); e.target.closest('.aiwarn').remove(); }
  });

  function finish() {
    P.done = true; S.sessions++; saveState(true); flushToSheet();
    const endMap = subjectSummary(subj), touched = [...new Set(P.answers.map(a => a.skill))];
    const right = P.answers.filter(a => a.correct).length, gained = startMap.lost - endMap.lost;
    const rows = touched.map(id => { const x = endMap.list.find(y => y.sk.id === id), was = skillStatus({ ...x.st, p: before[id] }); return { x, was }; });
    const newlyStrong = rows.filter(r => r.x.status === 'strong' && before[r.x.sk.id] < BKT.strong);
    if (right / P.answers.length >= 0.7) { sound('done'); confetti(); }
    nav.onLeave = () => $$('canvas.confetti').forEach(c => c.remove()); /* confetti must not fall on the next screen */
    el.querySelector('.playbar').outerHTML = topbar(esc(L(MODE_TITLE[mode])), { closeIcon: true });
    foot.remove();
    main.innerHTML = `<div class="result pad">
      <div class="res-hero">${ring(right / P.answers.length, right + '/' + P.answers.length, 'big')}
        <h1>${mode === 'diag' ? L('Картата е готова') : gained > 0.05 ? L('Върна си ≈ {n} т.', { n: fmt1(gained) }) : L('Добра работа')}</h1>
        <p class="res-main">${L('Сега губиш ≈ <b>{a}</b> от {b} т.', { a: fmt1(endMap.lost), b: endMap.total })} ${mode !== 'diag' ? L('(преди: {n})', { n: fmt1(startMap.lost) }) : ''}</p></div>
      ${newlyStrong.length ? `<div class="card strongnote">${icon('trophy')}<div><b>${L(newlyStrong.length > 1 ? '{s} станаха силни.' : '{s} стана силно.', { s: esc(newlyStrong.map(r => L(r.x.sk.name)).join(', ')) })}</b><br><span class="muted">${L('Спираме да ги повтаряме — само кратки проверки, все по-рядко.')}</span></div></div>` : ''}
      <h2 class="sec-title">${L('Какво се промени')}</h2>
      <div class="deltas">${rows.map(({ x }) => `<div class="delta"><b>${esc(L(x.sk.name))}</b><div class="dbar"><i class="was" style="width:${before[x.sk.id] * 100}%"></i><i class="now m-${x.status}" style="width:${x.st.p * 100}%"></i></div><small>${pctTxt(before[x.sk.id])} → <b>${pctTxt(x.st.p)}</b> · ${L(STATUS_LABEL[x.status])}</small></div>`).join('')}</div>
      <div class="res-actions"><button class="btn ghost" data-out>${L('Към картата')}</button><button class="btn accent" data-again>${icon('target')}${L('Още 8 задачи')}</button></div></div>`;
    main.querySelector('[data-out]').onclick = () => home();
    main.querySelector('[data-again]').onclick = () => go('session', { subj, mode: 'focus' }, { replace: true });
  }
  showTask();
};
