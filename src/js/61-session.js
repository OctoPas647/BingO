/* ================= A session: diagnostic, focus training, one skill, or "similar to my mistakes" =================
   Built on Shelly's practice screen and task views. What is new:
   - tasks come from the weakest skills (planSession), at a level that follows the learner; real НВО / ДЗИ
     questions, generated variants and Gemini's new questions are mixed (53-bel.js pickTask, 54-ai.js)
   - kind, not punishing: a wrong first pick on a choice question gets a second try (the skill map counts the
     first try, so it stays honest), "Не знам" shows the solution without a red screen, and a lost point
     is never shown as a falling number during the session
   - after a wrong answer comes a "twin": the same skill, a new question, to fix it while it is fresh
   - at the end: every missed question can be gone over, and "Тренирай подобни" trains on SIMILAR questions
     (a new variant, a Gemini question made from the mistake, or another question of the skill), never the same one
   - every answer updates the skill map and goes to the log (Google Sheets / Looker Studio) */

const MODE_TITLE = { diag: 'Диагностика', focus: 'Тренировка на слабото', skill: 'Една тема', similar: 'Подобни на грешките', assigned: 'Домашно от учителя' };

SCREENS.session = async (el, { subj, mode, skill, similar, skills, size, assignmentId }, nav) => {
  const sub = SUBJECTS[subj], m = fakeModule(subj), sessionId = uid();
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color)); el.setAttribute('lang', 'bg');
  const startMap = subjectSummary(subj), before = Object.fromEntries(startMap.list.map(x => [x.sk.id, x.st.p]));
  const planned = mode === 'diag' ? { plan: planDiagnostic(subj) }
    : mode === 'skill' ? { plan: Array.from({ length: 6 }, () => ({ skill, why: 'focus' })) }
    : mode === 'similar' ? { plan: arr(similar).map(x => ({ skill: x.task.skill, why: 'similar', like: x })) }
    /* homework from the teacher (73-class-student.js): the skills the teacher picked, or the class's weakest */
    : mode === 'assigned' && arr(skills).some(s => skillDef(subj, s)) ? { plan: Array.from({ length: size || 10 }, (_, i) => { const ok = arr(skills).filter(s => skillDef(subj, s)); return { skill: ok[i % ok.length], why: 'focus' }; }) }
    : mode === 'assigned' ? planSession(subj, size || 10)
    : planSession(subj, 8);
  const Q = planned.plan.map(p => ({ ...p })), P = { i: 0, phase: 'answer', done: false, touched: false, answers: [], used: new Set(), extraDiag: new Set(), tried: null };
  if (!Q.length) { toast('Всички теми са силни — няма какво да тренираме'); return back(); }
  /* the questions the learner missed are never asked again in "similar" mode */
  arr(similar).forEach(x => { P.used.add(x.task.id); P.used.add(taskKey(x.task)); });
  const freeSlot = (skillId, from) => Q.find((x, i) => i >= from && x.why === 'focus' && !x.task && (!skillId || x.skill === skillId)) || Q.find((x, i) => i >= from && x.why === 'focus' && !x.task);

  /* Gemini prepares new questions for the session's skills in the background (kept for offline use) */
  if (mode !== 'diag') aiPrefetch(subj, Q.map(x => x.skill), s => levelFor(skillState(subj, s).p));
  /* "similar" mode: Gemini makes a question from each mistake; until it arrives a variant or another question of the skill is used */
  if (mode === 'similar' && cloudOn()) Q.forEach((q, i) => {
    q.waiting = aiNewTasks(subj, q.skill, q.like.task.level || levelFor(skillState(subj, q.skill).p), { n: 1, similarTo: q.like }).then(ts => { if (!q.task && i >= P.i) q.task = ts[0]; aiCachePut(subj, ts.slice(1)); }).catch(e => console.warn('AI similar', e));
  });

  el.innerHTML = `<header class="playbar"><button class="iconbtn" data-back aria-label="${L('Затвори')}">${icon('close')}</button>${bar(0, 'pbar')}<span class="pcount"></span></header>
    <main class="playmain"></main>
    <footer class="checkbar"><div class="verdict"></div><div class="cb-actions"><button class="btn ghost dunno" data-dunno>${L('Не знам')}</button><button class="btn accent big" data-main></button></div></footer>`;
  const main = el.querySelector('.playmain'), foot = el.querySelector('.checkbar'), btn = foot.querySelector('[data-main]'), dunno = foot.querySelector('[data-dunno]'), verdict = foot.querySelector('.verdict');
  nav.guard = async () => P.done || !P.touched || confirmBox(L('Да спрем ли?'), L('Отговорите досега вече са записани в картата на уменията.'), L('Спри'), true);
  let view = null, task = null, shownAt = 0, aiHints = 0, checkedAt = 0;
  const paintCount = () => { el.querySelector('.pcount').textContent = `${Math.min(P.i + 1, Q.length)} / ${Q.length}`; el.querySelector('.pbar i').style.width = (P.i / Q.length * 100) + '%'; };

  /* The same question never comes twice in one session (P.used holds ids and, for generated tasks, the text) */
  function nextTask() {
    const item = Q[P.i], st = skillState(subj, item.skill), lvl = item.level || levelFor(st.p);
    if (item.task && !P.used.has(item.task.id) && !P.used.has(taskKey(item.task))) return mark(item.task);
    let t = null;
    if (item.why === 'similar' && subj === 'math' && MATH_GEN[item.skill]) t = genMathTask(item.skill, item.like.task.level || lvl, sessionId + ':sim:' + P.i);
    /* a Gemini question about every third time (always when the bank has nothing left) */
    const ai = aiCacheTake(subj, item.skill, P.used);
    if (!t && ai && (item.why === 'similar' || (!P.aiShown && P.i >= 2) || seedRng(sessionId + P.i).chance(0.34))) t = ai;
    if (!t) t = pickTask(subj, item.skill, lvl, sessionId + ':' + P.i, P.used) || ai;
    return t ? mark(t) : null;
  }
  function mark(t) { if (t.src === 'ai') P.aiShown = true; Q[P.i].task = t; P.used.add(t.id); P.used.add(taskKey(t)); if (t.src === 'ai') { const k = subj + '.' + t.skill; S.aiCache[k] = (S.aiCache[k] || []).filter(x => x.id !== t.id); } return t; }

  async function showTask() {
    P.phase = 'loading';   /* taps on the main button wait until the next task is on screen */
    /* "similar" mode waits a moment for Gemini's question before falling back */
    const item0 = Q[P.i];
    if (item0 && item0.waiting && !item0.task) {
      main.innerHTML = `<div class="ai-wait"><div class="spinner"></div><p class="muted">${L('Gemini подготвя подобна задача…')}</p></div>`;
      await Promise.race([item0.waiting, new Promise(r => setTimeout(r, 6000))]);
    }
    while (P.i < Q.length && !(task = nextTask())) Q.splice(P.i, 1);
    if (P.i >= Q.length) return P.answers.length ? finish() : (toast('Няма нови задачи по тази тема'), back());
    const item = Q[P.i]; P.phase = 'answer'; P.tried = null; aiHints = 0; shownAt = Date.now();
    view = taskView(task, m, { mode: 'practice', seed: sessionId, onChange: upd });
    const sk = skillDef(subj, task.skill);
    const tag = item.why === 'check' ? `<i class="chk">${icon('check')}${L('Проверка на силно умение')}</i>`
      : item.why === 'twin' ? `<i class="twin">${icon('reset')}${L(subj === 'math' ? 'Близнак: същото, нови числа' : 'Близнак: същото умение, нова задача')}</i>`
      : item.why === 'similar' ? `<i class="twin">${icon('reset')}${L('Подобна на сгрешена')}</i>` : '';
    main.innerHTML = `<div class="taskhead"><div class="chips"><i class="score">${esc(L(sk.name))}</i><i class="src-${task.src}">${esc(task.src === 'past' ? task.from : L(SRC_LABEL[task.src] || ''))}</i>${tag}</div></div>`;
    main.appendChild(view.el);
    if (task.src === 'ai') main.insertAdjacentHTML('beforeend', `<p class="aiwarn">${icon('info')}${L('Задачата е създадена от ИИ и може да има грешка.')} <button class="linkbtn" data-report>${L('Докладвай грешка')}</button></p>`);
    if (aiOn()) main.insertAdjacentHTML('beforeend', `<button class="hintbtn aihint" data-aihint>${icon('bulb')}${L('Подсказка от Gemini')} <small>${L('без отговора')}</small></button><div class="aibox" hidden></div>`);
    window.scrollTo(0, 0); paintCount();
    foot.className = 'checkbar'; verdict.innerHTML = ''; btn.textContent = L('Провери'); dunno.hidden = mode === 'diag'; upd();
  }
  function upd() {
    if (P.phase !== 'answer') return;
    btn.disabled = !view.ready() || (P.tried != null && view.get() === P.tried);
    P.touched = P.touched || view.ready();
  }

  function mistakeOf(resp) {
    if (task.type === 'choice' && Array.isArray(task.misc)) return task.misc[resp] || null;
    if (task.type === 'number' && task.numMisc) { const v = parseNumber(resp); const hit = task.numMisc.find(w => Number.isFinite(v) && Math.abs(v - w.v) < 0.011); return hit ? hit.misc : null; }
    return null;
  }
  /* the first answer is what counts for the skill map and the teacher's data */
  function record(correct, misc, resp, skipped) {
    const item = Q[P.i], secs = (Date.now() - shownAt) / 1000, hints = view.hintsUsed() + aiHints;
    const ch = recordAnswer(subj, task, correct, misc);
    logAnswer({ subj, task, correct, misc, secs, hints, before: ch.before, after: ch.after, mode: item.why === 'check' ? 'check' : mode, session: sessionId });
    P.answers.push({ skill: task.skill, correct, misc, task, resp, skipped: !!skipped, i: P.i });
    return ch;
  }

  function check(skip) {
    const item = Q[P.i], resp = skip ? null : view.get();
    const res = skip ? { status: 'wrong', points: 0 } : scoreTask(task, resp, 'bg'), correct = res.status === 'right';
    P.touched = true;
    /* second try after a wrong first pick: the skill map already has the first try */
    if (P.tried != null) {
      const last = P.answers[P.answers.length - 1]; last.retryOk = correct;
      return reveal(res, correct, last.misc, true);
    }
    const misc = correct ? null : mistakeOf(resp);
    const ch = record(correct, misc, resp, skip);
    if (!correct && !skip && task.type === 'choice' && mode !== 'diag' && task.options.length >= 3) {
      /* a gentle second chance: the wrong option is struck through, nothing turns red yet */
      P.tried = resp; sound('wrong');
      const opt = view.el.querySelector(`.opt[data-i="${resp}"]`); if (opt) { opt.classList.add('tried'); opt.disabled = true; opt.classList.remove('sel'); }
      foot.className = 'checkbar meh'; verdict.innerHTML = `${icon('reset')}<span><b>${L('Почти! Опитай още веднъж')}</b><small>${misc ? esc(plainMisc(misc)) : L('Помисли пак — задачата има един верен отговор.')}</small></span>`;
      upd(); return;
    }
    reveal(res, correct, misc, false, ch, skip);
  }

  function reveal(res, correct, misc, second, ch, skip) {
    const item = Q[P.i];
    view.show(res); P.phase = 'next'; checkedAt = Date.now(); dunno.hidden = true;
    sound(correct ? 'right' : skip ? '' : 'wrong');
    foot.className = 'checkbar ' + (correct ? 'good' : second || skip ? 'meh' : 'bad');
    const sk = skillDef(subj, task.skill);
    const sub2 = correct && ch && ch.after > ch.before + 0.005 ? `${esc(L(sk.name))}: ${pctTxt(ch.before)} → ${pctTxt(ch.after)}` : correct && second ? L('От втория опит — браво, че не се отказа.') : !correct ? L('Ще го упражним с подобна задача.') : esc(L(sk.name));
    verdict.innerHTML = `${icon(correct ? 'check' : skip ? 'info' : 'close')}<span><b>${correct ? (second ? L('Вярно!') : L('Вярно!')) : skip ? L('Ето решението') : L('Не съвсем')}</b><small>${sub2}</small></span>`;
    main.querySelector('[data-aihint]')?.remove();
    const fb = view.el.querySelector('.fb');
    if (!correct) {
      fb.hidden = false;
      const inlineWhy = task.type === 'choice' && task.why && task.why[P.tried ?? -1];
      if ((misc || !inlineWhy) && !skip) fb.insertAdjacentHTML('afterbegin', `<div class="mistake">${icon('target')}<div><b>${misc ? L('Типична грешка') : L('Грешка')}</b><span class="rt">${misc ? richInline(miscLabel(misc)) : task.explain ? L('Виж решението по-долу.') : L('Верният отговор е отбелязан в зелено.')}</span></div></div>`);
      if (aiOn()) fb.insertAdjacentHTML('beforeend', `<button class="btn ghost block aiexplain" data-aiexplain>${L('✦ Защо сгреших? Обясни Gemini')}</button><div class="aibox" hidden></div>`);
      /* a twin right away (once per original task): the next planned task becomes the twin */
      if (!['twin', 'similar'].includes(item.why) && mode !== 'diag') {
        const next = Q[P.i + 1];
        if (next && next.why === 'focus' && !next.task) { Object.assign(next, { skill: task.skill, why: 'twin', level: task.level }); delete next.task; }
      }
      if (mode === 'diag' && !P.extraDiag.has(task.skill)) { P.extraDiag.add(task.skill); Q.push({ skill: task.skill, why: 'diag' }); }
    }
    btn.textContent = P.i === Q.length - 1 ? L('Виж резултата') : L('Напред');
    btn.disabled = false;
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  btn.addEventListener('click', () => {
    if (P.phase === 'answer') return check(false);
    if (P.phase !== 'next' || P.done) return;
    /* an accidental double tap on "Провери" must not skip the feedback it just opened;
       150 ms is shorter than any deliberate second tap, so fast players never wait */
    if (Date.now() - checkedAt < 150) return;
    if (++P.i < Q.length) showTask(); else finish();
  });
  dunno.addEventListener('click', () => { if (P.phase === 'answer') { if (P.tried != null) { const last = P.answers[P.answers.length - 1]; last.retryOk = false; reveal({ status: 'wrong', points: 0 }, false, last.misc, true); } else check(true); } });
  main.addEventListener('submit-answer', () => { if (P.phase === 'answer' && !btn.disabled) check(false); });
  main.addEventListener('click', async e => {
    const hb = e.target.closest('[data-aihint]');
    if (hb) {
      const box = main.querySelector('.aibox'); hb.disabled = true; box.hidden = false; box.innerHTML = skel('text', 2);
      try { const j = await aiHint(subj, task); aiHints++; box.innerHTML = `<b>${esc(aiBadge())} · ${L('подсказка')}</b><div class="rt">${rich(j.hint || '')}</div>`; hb.remove(); }
      catch (err) { box.innerHTML = `<span class="danger-text">${esc(err.message)}</span>`; hb.disabled = false; }
      return;
    }
    const xb = e.target.closest('[data-aiexplain]');
    if (xb) {
      const box = xb.nextElementSibling, last = P.answers[P.answers.length - 1]; xb.disabled = true; box.hidden = false; box.innerHTML = skel('text', 2);
      try {
        const j = await aiExplainMistake(subj, task, last.resp, last.misc);
        box.innerHTML = `<b>${esc(aiBadge())} · ${esc(j.diagnosis || L('Какво се обърка'))}</b><div class="rt">${rich(j.explanation || '')}</div>${j.check ? `<p class="aicheck"><b>${L('Провери се:')}</b> <span class="rt">${richInline(j.check)}</span></p>` : ''}`;
        xb.remove();
      } catch (err) { box.innerHTML = `<span class="danger-text">${esc(err.message)}</span>`; xb.disabled = false; }
      return;
    }
    if (e.target.closest('[data-report]')) { S.aiFlags.push({ at: new Date().toISOString(), task }); saveState(); toast('Благодаря! Задачата е отбелязана за проверка от учител.'); e.target.closest('.aiwarn').remove(); }
  });

  function finish() {
    P.done = true; S.sessions++;
    const day = localDay(); if (!S.sessionDays.includes(day)) { S.sessionDays.push(day); S.sessionDays = S.sessionDays.slice(-400); }
    saveState(true); flushToSheet();
    if (assignmentId && typeof classPracticeDone === 'function') classPracticeDone(assignmentId, subj, P.answers);   /* homework from the teacher */
    if (typeof cloudSyncProgress === 'function') cloudSyncProgress();   /* the skill map for the teacher */
    const endMap = subjectSummary(subj), touched = [...new Set(P.answers.map(a => a.skill))];
    const right = P.answers.filter(a => a.correct).length, gained = startMap.lost - endMap.lost;
    const rows = touched.map(id => { const x = endMap.list.find(y => y.sk.id === id); return x && { x }; }).filter(Boolean);
    const newlyStrong = rows.filter(r => r.x.status === 'strong' && before[r.x.sk.id] < BKT.strong);
    const missed = P.answers.filter(a => !a.correct);
    if (right / P.answers.length >= 0.7) { sound('done'); confetti(); }
    nav.onLeave = () => $$('canvas.confetti').forEach(c => c.remove()); /* confetti must not fall on the next screen */
    el.querySelector('.playbar').outerHTML = topbar(esc(L(MODE_TITLE[mode])), { noBack: true, right: `<button class="iconbtn" data-close aria-label="${esc(L('Затвори'))}">${icon('close')}</button>` });
    el.querySelector('[data-close]').onclick = () => home();
    foot.remove();
    main.innerHTML = `<div class="result pad">
      <div class="res-hero">${ring(right / P.answers.length, right + '/' + P.answers.length, 'big')}
        <h1>${mode === 'diag' ? L('Картата е готова') : gained > 0.05 ? L('Върна си ≈ {n} т.', { n: fmt1(gained) }) : L('Добра работа')}</h1>
        <p class="res-main">${L('Сега губиш ≈ <b>{a}</b> от {b} т.', { a: fmt1(endMap.lost), b: endMap.total })}</p></div>
      <div class="aibox coach" hidden></div>
      ${newlyStrong.length ? `<div class="card strongnote">${icon('trophy')}<div><b>${L(newlyStrong.length > 1 ? '{s} станаха силни.' : '{s} стана силно.', { s: esc(newlyStrong.map(r => L(r.x.sk.name)).join(', ')) })}</b><br><span class="muted">${L(newlyStrong.length > 1 ? 'Спираме да ги повтаряме — само кратки проверки, все по-рядко.' : 'Спираме да го повтаряме — само кратки проверки, все по-рядко.')}</span></div></div>` : ''}
      ${reviewHTML(missed)}
      <h2 class="sec-title">${L('Какво се промени')}</h2>
      <div class="deltas">${rows.map(({ x }) => `<div class="delta"><b>${esc(L(x.sk.name))}</b><div class="dbar"><i class="was" style="width:${before[x.sk.id] * 100}%"></i><i class="now m-${x.status}" style="width:${x.st.p * 100}%"></i></div><small>${pctTxt(before[x.sk.id])} → <b>${pctTxt(x.st.p)}</b> · ${L(STATUS_LABEL[x.status])}</small></div>`).join('')}</div>
      <div class="res-actions"><button class="btn ghost" data-out>${L('Към картата')}</button><button class="btn accent" data-again>${icon('target')}${L('Още 8 задачи')}</button></div></div>`;
    mountReview(main, subj, m, missed);
    main.querySelector('[data-out]').onclick = () => home();
    main.querySelector('[data-again]').onclick = () => go('session', { subj, mode: 'focus' }, { replace: true });
    if (aiOn() && P.answers.length >= 3) aiSessionNote(subj, P.answers).then(j => {
      const box = main.querySelector('.coach'); if (!box || !j || !j.note) return;
      box.hidden = false; box.innerHTML = `<b>${esc(aiBadge())} · ${L('бележка от треньора')}</b><div class="rt">${rich(j.note)}</div>`;
    }).catch(() => { });
  }
  showTask();
};
