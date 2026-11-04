/* ================= BingO for teachers: results, grading and analysis =================
   One assignment: who handed in what, every question's statistics (how many got it right, the most
   common wrong answer, how long it took), the AI grading queue, and exports (CSV, Excel, PDF, Google Sheets).
   One student's work: every answer next to the key, Gemini's suggestion and the teacher's points and comment.
   When the teacher changes Gemini's points, the server keeps it as an example, so Gemini grades more like them. */

const statusPill = st => `<span class="cl-pill p-${st === 'right' ? 'done' : st === 'partial' ? 'doing' : st === 'pending' ? 'upcoming' : 'missed'}">${esc(L({ right: 'Вярно', partial: 'Частично', wrong: 'Грешно', empty: 'Без отговор', pending: 'За проверка' }[st] || st))}</span>`;
const gradeShort = g => (!g ? '–' : g.scale === 'percent' || g.scale === 'points' || g.scale === 'manual' ? g.text : String(g.value).replace('.', ','));
const minutes = (a, b) => (a && b ? Math.max(0, Math.round((b - a) / 60000)) : null);

/* per-question statistics of an assignment */
function questionStats(A, key, atts, results) {
  return (A.tasks || []).map((t, n) => {
    const k = key[t.id] || t, st = { right: 0, partial: 0, wrong: 0, empty: 0, pending: 0 }, pts = [], times = [], wrongAns = {};
    for (const a of atts) {
      if (a.status === 'in_progress' && A.kind !== 'live') continue;
      const res = results.find(r => r.studentId === a.studentId), per = res && res.per && res.per[t.id];
      const s = per ? per.status : eduScore(k, (a.responses || {})[t.id], 'bg').status;
      st[s] = (st[s] || 0) + 1;
      if (per) pts.push(per.points / Math.max(per.max, 1e-9));
      if (a.timeOn && a.timeOn[t.id]) times.push(a.timeOn[t.id]);
      if (s === 'wrong' || s === 'partial') { const r = (a.responses || {})[t.id], lab = responseText(t, k, r); if (lab) wrongAns[lab] = (wrongAns[lab] || 0) + 1; }
    }
    const n2 = st.right + st.partial + st.wrong + st.empty + st.pending;
    const top = Object.entries(wrongAns).sort((x, y) => y[1] - x[1])[0];
    return { n, t, k, st, total: n2, rightShare: n2 ? st.right / n2 : null, avgPts: avg(pts), avgTime: avg(times), topWrong: top ? { text: top[0], n: top[1] } : null };
  });
}

SCREENS.tAssignment = async (el, { aid, tab = 'overview' }, nav) => {
  if (!(await tGate(el, 'tHome'))) return;
  const body = tFrame(el, 'tHome', { title: '…', backBtn: true, wide: true });
  let A = null, key = {}, atts = [], results = [], members = [];
  try { const k = await docRef(`assignments/${aid}/key/answers`).get(); key = k.exists ? k.data().tasks : {}; } catch (e) { }
  const draw = () => {
    if (!A) return;
    const st = asgState(A);
    el.querySelector('.t-titles').innerHTML = `<span class="kicker">${esc(L(KIND_LABEL[A.kind]))} · ${esc(A.className || '')} · ${esc(L(ASG_STATE[st]))}</span><h1>${esc(A.title)}</h1>`;
    el.querySelector('.t-actions').innerHTML = `${A.kind === 'live' && st !== 'closed' ? `<button class="btn accent small" data-golive>${icon('tv')}${L('Монитор')}</button>` : ''}<button class="btn ghost small" data-export>${icon('download')}${L('Експорт')}</button>`;
    const review = results.filter(r => r.needsReview);
    const tabs = [['overview', 'Обзор'], ['students', 'Ученици'], ['questions', 'Въпроси'], ['review', review.length ? L('Проверка ({n})', { n: review.length }) : 'Проверка'], ['settings', 'Настройки']];
    body.innerHTML = `<div class="seg t-tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${L(l)}</button>`).join('')}</div><div class="t-tabbody"></div>`;
    const tb = body.querySelector('.t-tabbody');
    if (tab === 'overview') tb.innerHTML = overview();
    if (tab === 'students') tb.innerHTML = studentsTable();
    if (tab === 'questions') tb.innerHTML = questionsTab();
    if (tab === 'review') tb.innerHTML = reviewTab(review);
    if (tab === 'settings') tb.innerHTML = settingsTab();
  };
  const overview = () => {
    const total = (A.studentIds || []).length, pcts = results.map(r => r.pct).sort((a, b) => a - b);
    const med = pcts.length ? pcts[Math.floor(pcts.length / 2)] : null;
    const dist = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    results.forEach(r => { const g = r.grade && r.grade.value; const k = r.grade && ['percent', 'points'].includes(r.grade.scale) ? eduGrade(r.points, r.max, { scale: 'bg6' }).value : Math.round(g); if (dist[k] != null) dist[k]++; });
    const maxD = Math.max(1, ...Object.values(dist));
    const rel = A.released || {}, fb = (A.settings || {}).feedback || {};
    const qs = questionStats(A, key, atts, results).filter(q => q.total);
    const hardest = qs.slice().sort((a, b) => (a.rightShare ?? 1) - (b.rightShare ?? 1)).slice(0, 3);
    return `<div class="t-kpis"><div class="card t-kpi"><b>${results.length}/${total}</b><small>${L('предадени')}</small></div><div class="card t-kpi"><b>${pct(avg(pcts))}</b><small>${L('среден резултат')}</small></div><div class="card t-kpi"><b>${pct(med)}</b><small>${L('медиана')}</small></div><div class="card t-kpi ${results.some(r => r.needsReview) ? 'warn' : ''}"><b>${results.filter(r => r.needsReview).length}</b><small>${L('за проверка')}</small></div></div>
      <div class="t-grid">
        <div class="card"><h3>${icon('chart')}${L('Оценки')}</h3><div class="t-dist">${[2, 3, 4, 5, 6].map(g => `<div><i style="height:${dist[g] / maxD * 100}%"></i><b>${dist[g]}</b><small>${g}</small></div>`).join('')}</div></div>
        <div class="card"><h3>${icon('alert')}${L('Най-трудни въпроси')}</h3>${hardest.length ? hardest.map(q => `<div class="t-weakrow"><div><b>${L('Въпрос {n}', { n: q.n + 1 })}</b><small class="muted rt">${richInline(String(q.t.prompt || q.t.text || '').slice(0, 80))}${q.topWrong ? ' · ' + L('често: {a}', { a: esc(q.topWrong.text) }) : ''}</small></div>${bar(q.rightShare || 0, q.rightShare < 0.4 ? 'weak' : 'mid')}<span class="t-avg">${pct(q.rightShare)}</span></div>`).join('') : `<p class="muted">${L('Още няма отговори.')}</p>`}</div>
        <div class="card"><h3>${icon('eye')}${L('Учениците виждат')}</h3><p class="muted small">${esc(L({ none: 'Нищо', score: 'Само резултата и оценката', full: 'Резултата и верните отговори' }[fb.show] || ''))} · ${esc(L({ now: 'Веднага след предаване', close: 'След крайния срок', manual: 'Когато аз реша' }[fb.when] || ''))}</p>
          <div class="cl-acc-actions"><button class="btn ghost small" data-release="score" ${rel.score ? 'disabled' : ''}>${rel.score ? L('Резултатите са пуснати') : L('Пусни резултатите')}</button><button class="btn ghost small" data-release="full" ${rel.full ? 'disabled' : ''}>${rel.full ? L('Отговорите са пуснати') : L('Пусни и верните отговори')}</button></div></div>
        <div class="card"><h3>${icon('sparkle')}${L('Анализ с Gemini')}</h3><div class="t-insights muted small">${L('Gemini разглежда резултатите и предлага какво да направите в следващия час.')}</div><button class="btn ghost small" data-insights>${icon('sparkle')}${L('Анализирай')}</button></div>
      </div>`;
  };
  const studentsTable = () => {
    const byUid = Object.fromEntries(results.map(r => [r.studentId, r]));
    const rows = atts.slice().sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'bg'));
    const missing = members.filter(m => !atts.some(a => a.studentId === m.id));
    return `<div class="t-table"><table><thead><tr><th>${L('Ученик')}</th><th>${L('Състояние')}</th><th>${L('Точки')}</th><th>%</th><th>${L('Оценка')}</th><th>${L('Време')}</th><th>⚠</th><th>${L('Предадено')}</th></tr></thead><tbody>
      ${rows.map(a => { const r = byUid[a.studentId]; return `<tr data-grade="${esc(aid + '_' + a.studentId)}"><td><b>${esc(a.studentName || '')}</b></td><td>${a.status === 'in_progress' ? `<span class="cl-pill p-doing">${L('Работи')}</span>` : r && r.needsReview ? `<span class="cl-pill p-upcoming">${L('За проверка')}</span>` : `<span class="cl-pill p-done">${L('Готово')}</span>`}</td><td>${r ? `${fmtPts(r.points, appLang())}/${fmtPts(r.max, appLang())}` : '–'}</td><td>${r ? `<span class="t-score ${r.pct < 0.5 ? 'bad' : r.pct < 0.8 ? 'mid' : 'good'}">${pct(r.pct)}</span>` : '–'}</td><td><b>${r ? esc(gradeShort(r.grade)) : '–'}</b></td><td>${minutes(tsMs(a.startedAt), tsMs(a.submittedAt) || (a.status === 'in_progress' ? Date.now() : null)) ?? '–'} ${L('мин')}</td><td>${a.flags ? `<span class="t-flag">${a.flags}</span>` : ''}</td><td>${fmtWhen(tsMs(a.submittedAt))}${a.submitReason && a.submitReason !== 'student' ? ` <small class="muted">(${esc(L({ time: 'времето изтече', closed: 'затворен', deadline: 'срок', ended: 'край', kicked: 'изключен' }[a.submitReason] || a.submitReason))})</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      ${missing.length ? `<h3 class="t-sub">${L('Не са започнали ({n})', { n: missing.length })}</h3><div class="t-chips">${missing.map(m => `<span class="t-chip">${esc(m.name || m.email)}</span>`).join('')}</div>` : ''}`;
  };
  const questionsTab = () => {
    const qs = questionStats(A, key, atts, results);
    return `<div class="t-qstats">${qs.map(q => `<div class="card t-qstat"><div class="t-qs-head"><span class="t-tnum">${q.n + 1}</span><div class="rt">${richInline(String(q.t.prompt || q.t.text || '').slice(0, 200))}</div><span class="t-avg">${pct(q.rightShare)}</span></div>
      <div class="t-stack">${['right', 'partial', 'pending', 'wrong', 'empty'].map(s => q.st[s] ? `<i class="m-${s}" style="flex:${q.st[s]}" title="${esc(L({ right: 'Вярно', partial: 'Частично', wrong: 'Грешно', empty: 'Без отговор', pending: 'За проверка' }[s]))}: ${q.st[s]}"></i>` : '').join('')}</div>
      <small class="muted">${L('{a} верни · {b} грешни · {c} без отговор', { a: q.st.right, b: q.st.wrong + q.st.partial, c: q.st.empty })}${q.avgTime ? ' · ' + L('средно {t}', { t: fmtClock(q.avgTime) }) : ''}${q.topWrong ? ' · ' + L('най-честа грешка: „{a}“ ({n})', { a: esc(q.topWrong.text), n: q.topWrong.n }) : ''}${q.rightShare != null && q.rightShare < 0.3 && q.total >= 4 ? ` · <b class="danger-text">${L('проверете въпроса')}</b>` : ''}</small></div>`).join('')}</div>`;
  };
  const reviewTab = review => `<div class="t-row-actions"><button class="btn accent small" data-approveall>${icon('check')}${L('Одобри всички предложения на Gemini')}</button><button class="btn ghost small" data-regrade>${icon('sparkle')}${L('Провери отново с Gemini')}</button></div>
    ${review.length ? `<div class="cl-list">${review.map(r => `<button class="cl-asg" data-grade="${esc(r.id)}"><span class="cl-asg-main"><b>${esc(r.studentName)}</b><small class="muted">${L('{n} отговора чакат', { n: Object.values(r.per || {}).filter(p => p.status === 'pending' || p.by === 'ai').length })}</small></span><span class="t-score">${pct(r.pct)}</span>${icon('next')}</button>`).join('')}</div>` : emptyBox('check', L('Всичко е проверено'), '')}`;
  const settingsTab = () => `<div class="card t-form">
      <label class="fld"><span>${L('Име')}</span><input class="field" data-af="title" value="${esc(A.title)}"></label>
      ${A.kind !== 'live' ? `<label class="fld"><span>${L('Отваря')}</span><input class="field" type="datetime-local" data-af="opensAt" value="${toLocalInput(tsMs(A.opensAt))}"></label>
      <label class="fld"><span>${L('Краен срок')}</span><input class="field" type="datetime-local" data-af="closesAt" value="${toLocalInput(tsMs(A.closesAt))}"></label>` : ''}
      <label class="fld"><span>${L('Минути (0 = без ограничение)')}</span><input class="field" type="number" min="0" data-af="timeLimitMin" value="${A.timeLimitMin || 0}"></label>
      <label class="fld"><span>${L('Оценяване')}</span><select class="field" data-af="scale">${EDU_SCALES.map(k => `<option value="${k}" ${A.settings.grading.scale === k ? 'selected' : ''}>${esc(L(SCALE_LABEL[k]))}</option>`).join('')}</select></label>
      <label class="fld"><span>${L('Какво виждат учениците след това')}</span><select class="field" data-af="fbshow">${[['none', 'Нищо'], ['score', 'Само резултата и оценката'], ['full', 'Резултата и верните отговори']].map(([k, l]) => `<option value="${k}" ${A.settings.feedback.show === k ? 'selected' : ''}>${L(l)}</option>`).join('')}</select></label>
      <button class="btn accent" data-saveasg>${L('Запази')}</button></div>
    <div class="card"><div class="cl-acc-actions">${A.status === 'closed' ? `<button class="btn ghost" data-reopen>${L('Отвори отново')}</button>` : `<button class="btn ghost" data-close>${L('Затвори сега')}</button>`}${A.testId ? `<button class="btn ghost" data-again>${icon('send')}${L('Задай на друг клас')}</button>` : ''}<button class="btn ghost danger-text" data-delasg>${L('Изтрий')}</button></div></div>`;

  watch(docRef('assignments/' + aid), s => { if (!s.exists) { body.innerHTML = emptyBox('info', L('Заданието е изтрито'), ''); return; } A = { id: s.id, ...s.data() }; draw(); if (!members.length) watch(col(`classes/${A.classId}/members`), m => { members = docs(m); draw(); }, nav); }, nav);
  watch(col('attempts').where('teacherIds', 'array-contains', myUid()).where('assignmentId', '==', aid), s => { atts = docs(s); draw(); }, nav);
  watch(col('results').where('teacherIds', 'array-contains', myUid()).where('assignmentId', '==', aid), s => { results = docs(s); draw(); }, nav);

  el.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; NAV[NAV.length - 1].params.tab = tab; return draw(); }
    const g = e.target.closest('[data-grade]'); if (g) return go('tGrade', { attemptId: g.dataset.grade });
    if (e.target.closest('[data-golive]')) return go('tLive', { aid }, { replace: true });
    const ex = e.target.closest('[data-export]'); if (ex) return exportSheet(A, key, atts, results, ex);
    const rl = e.target.closest('[data-release]'); if (rl) return busy(rl, async () => { await callFn('releaseResults', { assignmentId: aid, score: true, full: rl.dataset.release === 'full' || !!(A.released && A.released.full) }); toast(L('Учениците вече виждат резултатите')); });
    const ins = e.target.closest('[data-insights]'); if (ins) return busy(ins, async () => {
      const qs = questionStats(A, key, atts, results).map(q => ({ n: q.n + 1, prompt: String(q.t.prompt || '').slice(0, 160), skill: q.k.skill || '', right: q.st.right, wrong: q.st.wrong + q.st.partial, empty: q.st.empty, topWrong: q.topWrong && q.topWrong.text, avgTime: q.avgTime && Math.round(q.avgTime) }));
      const studs = results.map(r => ({ name: r.studentName, pct: Math.round(r.pct * 100), flags: r.flags || 0 }));
      const r = await callFn('teacherAI', { action: 'insights', data: JSON.stringify({ title: A.title, subject: A.subject, questions: qs, students: studs }), lang: appLang() }, { timeout: 200000 });
      body.querySelector('.t-insights').classList.remove('muted'); body.querySelector('.t-insights').innerHTML = `<div class="rt">${rich(r.text)}</div>`;
    });
    const ap = e.target.closest('[data-approveall]'); if (ap) return busy(ap, async () => { await callFn('approveAll', { assignmentId: aid }, { timeout: 280000 }); toast(L('Одобрено')); });
    const rg = e.target.closest('[data-regrade]'); if (rg) return busy(rg, async () => { const r = await callFn('regradeAI', { assignmentId: aid }, { timeout: 540000 }); toast(L('Проверени отново: {n}', { n: r.regraded })); });
    const sv = e.target.closest('[data-saveasg]'); if (sv) return busy(sv, async () => {
      const v = k => body.querySelector(`[data-af="${k}"]`);
      const upd = { assignmentId: aid, title: v('title').value, timeLimitMin: +v('timeLimitMin').value || 0, settings: { grading: { ...A.settings.grading, scale: v('scale').value }, feedback: { ...A.settings.feedback, show: v('fbshow').value } } };
      if (v('opensAt')) { upd.opensAt = fromLocalInput(v('opensAt').value) || tsMs(A.opensAt); upd.closesAt = fromLocalInput(v('closesAt').value); }
      await callFn('updateAssignment', upd); toast(L('Запазено'));
    });
    const cl = e.target.closest('[data-close]'); if (cl) return confirmBox(L('Да затворя ли заданието?'), L('Започнатите работи се предават и се оценяват.'), L('Затвори'), true).then(ok => ok && busy(cl, () => callFn('updateAssignment', { assignmentId: aid, close: true }, { timeout: 280000 })));
    const ro = e.target.closest('[data-reopen]'); if (ro) return busy(ro, () => callFn('updateAssignment', { assignmentId: aid, reopen: true }));
    if (e.target.closest('[data-again]')) return go('tPublish', { testId: A.testId });
    const dl = e.target.closest('[data-delasg]'); if (dl) return confirmBox(L('Да изтрия ли заданието?'), L('Изтриват се и всички работи и оценки по него.'), L('Изтрий'), true).then(ok => ok && busy(dl, async () => { await callFn('deleteAssignment', { assignmentId: aid }); back(); }));
  });
};

/* ---------- one student's work ---------- */
SCREENS.tGrade = async (el, { attemptId }, nav) => {
  if (!(await tGate(el, 'tHome'))) return;
  const body = tFrame(el, 'tHome', { title: '…', backBtn: true, wide: true });
  const aid = attemptId.slice(0, attemptId.lastIndexOf('_'));
  let A = null, AT = null, R = null, key = {}, siblings = [];
  try { const k = await docRef(`assignments/${aid}/key/answers`).get(); key = k.exists ? k.data().tasks : {}; } catch (e) { }
  const draw = () => {
    if (!A || !AT) return;
    const idx = siblings.findIndex(s => s.id === attemptId);
    el.querySelector('.t-titles').innerHTML = `<span class="kicker">${esc(A.title)} · ${esc(A.className || '')}</span><h1>${esc(AT.studentName || '')}</h1>`;
    el.querySelector('.t-actions').innerHTML = `${idx > 0 ? `<button class="iconbtn" data-sib="${esc(siblings[idx - 1].id)}" aria-label="${L('Предишен')}">${icon('back')}</button>` : ''}${idx >= 0 && idx < siblings.length - 1 ? `<button class="iconbtn" data-sib="${esc(siblings[idx + 1].id)}" aria-label="${L('Следващ')}">${icon('next')}</button>` : ''}`;
    const g = R && R.grade;
    body.innerHTML = `<div class="card t-gradehead">${R ? `${ring(R.max ? R.points / R.max : 0, pct(R.max ? R.points / R.max : 0), 'big')}<div><h2>${esc((g && g.text) || '')}</h2><p class="muted">${L('{a} от {b} т.', { a: fmtPts(R.points, appLang()), b: fmtPts(R.max, appLang()) })}${R.needsReview ? ' · ' + L('има непроверени') : ''}</p></div>` : `<p class="muted">${AT.status === 'in_progress' ? L('Ученикът още работи.') : L('Оценява се…')}</p>`}
        ${R ? `<div class="t-override"><label class="fld"><span>${L('Своя оценка (по желание)')}</span><input class="field" data-ov value="${esc(R.gradeOverride ? R.gradeOverride.text : '')}" placeholder="${L('напр. Отличен 6')}"></label><label class="fld"><span>${L('Бележка към ученика')}</span><textarea class="field" rows="2" data-cm>${esc(R.comment || '')}</textarea></label><button class="btn ghost small" data-saveov>${L('Запази')}</button></div>` : ''}</div>
      ${(AT.events || []).some(e => FLAG_EVENTS.includes(e.type)) ? `<details class="card"><summary><b>⚠ ${L('Сигнали: {n}', { n: AT.flags || 0 })}</b></summary><div class="t-evlist">${(AT.events || []).slice().sort((a, b) => a.t - b.t).map(e => `<div class="t-ev ev-${e.type}"><small>${fmtTime(e.t)}</small><span>${esc(L(EVENT_LABEL[e.type] || e.type))}${e.q ? ' · ' + L('въпрос {n}', { n: e.q }) : ''}${e.secs ? ' · ' + L('{n} с', { n: e.secs }) : ''}</span></div>`).join('')}</div></details>` : ''}
      <div class="t-gradelist"></div>`;
    const list = body.querySelector('.t-gradelist'), m = classModule(A);
    (AT.order || []).forEach((id, n) => {
      const k = key[id]; if (!k) return;
      const resp = eduUnmix(k, (AT.responses || {})[id]);
      const per = (R && R.per && R.per[id]) || eduScore(k, (AT.responses || {})[id], 'bg');
      const ai = R && R.ai && R.ai[id], man = R && R.manual && R.manual[id];
      const card = h(`<div class="card t-gtask"><div class="cl-rvhead"><b>${n + 1}.</b>${statusPill(per.status)}<span class="t-pts-big">${fmtPts(per.points || 0, appLang())} / ${fmtPts(per.max || k.points || 1, appLang())}</span>${AT.timeOn && AT.timeOn[id] ? `<small class="muted">${fmtClock(AT.timeOn[id])}</small>` : ''}</div></div>`);
      if (k.type === 'photo') {
        card.insertAdjacentHTML('beforeend', `<div class="prompt rt">${rich(k.prompt || '')}</div>`);
        if (resp && resp.path) imageUrl(resp.path).then(u => card.querySelector('.t-gtask-ph').innerHTML = `<img class="cl-photo" src="${esc(u)}" alt="" data-zoomsrc="${esc(u)}">`).catch(() => { });
        card.insertAdjacentHTML('beforeend', `<div class="t-gtask-ph">${resp && resp.path ? '<span class="spinner"></span>' : `<p class="muted">${L('Без снимка')}</p>`}</div>`);
      } else {
        const v = taskView(viewTask(k), m, { mode: 'review', response: resp, seed: 'g' });
        card.appendChild(v.el);
        try { if (EDU_AUTO_TYPES.includes(k.type)) v.show(scoreTask(k, resp, 'bg')); else v.show({}); } catch (e) { }
      }
      if (k.type === 'open' || k.type === 'photo' || man) {
        card.insertAdjacentHTML('beforeend', `<div class="t-gradebox">
          ${ai && isFinite(ai.points) ? `<div class="t-ai ${ai.approved ? 'ok' : ''}"><b>✦ Gemini: ${fmtPts(ai.points, appLang())} ${L('т.')}</b> <small class="muted">${L('сигурност {n}', { n: pct(ai.confidence) })}${ai.approved ? ' · ' + L('одобрено') : ''}</small><p>${esc(ai.comment || '')}</p>${!man && !ai.approved ? `<button class="btn ghost small" data-accept="${esc(id)}" data-pts="${ai.points}">${icon('check')}${L('Приеми')}</button>` : ''}</div>` : ai && ai.error ? `<p class="danger-text small">${L('Gemini не успя: {e}', { e: esc(ai.error) })}</p>` : ''}
          ${k.rubric && k.rubric.length ? `<ul class="t-rublist">${k.rubric.map(r => `<li>${esc(r.text)} <b>(${r.points})</b></li>`).join('')}</ul>` : ''}
          <div class="t-inline"><label class="fld"><span>${L('Точки')}</span><input class="field t-pts" data-p="${esc(id)}" inputmode="decimal" value="${man ? String(man.points).replace('.', ',') : ''}" placeholder="0–${fmtPts(k.points || 1, appLang())}"></label><label class="fld t-grow"><span>${L('Коментар')}</span><input class="field" data-c="${esc(id)}" value="${esc(man ? man.comment || '' : '')}"></label><button class="btn accent small" data-setpts="${esc(id)}">${L('Запази')}</button></div></div>`);
      }
      list.appendChild(card);
    });
  };
  watch(docRef('attempts/' + attemptId), s => { AT = s.exists ? s.data() : null; draw(); }, nav);
  watch(docRef('results/' + attemptId), s => { R = s.exists ? s.data() : null; draw(); }, nav, () => { });
  watch(docRef('assignments/' + aid), s => { A = s.exists ? { id: s.id, ...s.data() } : null; draw(); }, nav);
  col('attempts').where('teacherIds', 'array-contains', myUid()).where('assignmentId', '==', aid).get().then(s => { siblings = docs(s).sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'bg')); draw(); }).catch(() => { });
  const grade = (data, btn) => busy(btn, async () => { await callFn('gradeTask', { attemptId, ...data }, { timeout: 110000 }); toast(L('Запазено')); });
  el.addEventListener('click', e => {
    const sb = e.target.closest('[data-sib]'); if (sb) return go('tGrade', { attemptId: sb.dataset.sib }, { replace: true });
    const ac = e.target.closest('[data-accept]'); if (ac) return grade({ taskId: ac.dataset.accept, points: +ac.dataset.pts, comment: '' }, ac);
    const sp = e.target.closest('[data-setpts]'); if (sp) { const id = sp.dataset.setpts, v = parseNumber(body.querySelector(`[data-p="${id}"]`).value); if (!isFinite(v)) return toast(L('Точките трябва да са число'), 'bad'); return grade({ taskId: id, points: v, comment: body.querySelector(`[data-c="${id}"]`).value }, sp); }
    const so = e.target.closest('[data-saveov]'); if (so) { const txt = body.querySelector('[data-ov]').value.trim(), num = parseFloat((txt.match(/[\d]+([.,]\d+)?/) || ['0'])[0].replace(',', '.')); return grade({ grade: txt ? { value: num, text: txt } : null, comment: body.querySelector('[data-cm]').value }, so); }
    const z = e.target.closest('[data-zoomsrc]'); if (z) sheet({ body: `<img class="zoomed" src="${esc(z.dataset.zoomsrc)}" alt="">`, wide: true, actions: [{ id: 'x', label: L('Затвори') }] });
  });
};

/* ---------- exports ---------- */
function resultRows(A, key, atts, results) {
  const tasks = A.tasks || [];
  const head = [L('Ученик'), L('Имейл'), L('Точки'), L('Максимум'), '%', L('Оценка'), L('Сигнали'), L('Предадено'), ...tasks.map((t, i) => L('В{n}', { n: i + 1 }))];
  const rows = atts.slice().sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'bg')).map(a => {
    const r = results.find(x => x.studentId === a.studentId);
    return [a.studentName || '', a.studentEmail || '', r ? r.points : '', r ? r.max : '', r ? Math.round(r.pct * 100) : '', r && r.grade ? r.grade.text : '', a.flags || 0, tsMs(a.submittedAt) ? new Date(tsMs(a.submittedAt)).toLocaleString(locale()) : '', ...tasks.map(t => (r && r.per && r.per[t.id] ? r.per[t.id].points : ''))];
  });
  return [head, ...rows];
}
const toCSV = rows => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
/* Excel 2003 XML: opens in Excel, LibreOffice and Google Sheets with no library */
function toXLS(rows, sheetName) {
  const cell = v => (typeof v === 'number' && isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${esc(String(v ?? ''))}</Data></Cell>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="${esc(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 30))}"><Table>${rows.map((r, i) => `<Row${i === 0 ? ' ss:StyleID="h"' : ''}>${r.map(cell).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
}
function printReport(title, rows, extra = '') {
  const w = window.open('', '_blank');
  if (!w) return toast(L('Разрешете изскачащи прозорци, за да се отвори PDF'), 'bad');
  w.document.write(`<!doctype html><html lang="bg"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0 0 4px}p{color:#555;margin:0 0 14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#f2f2f7}tr:nth-child(even) td{background:#fafafa}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><p>BingO · ${esc(new Date().toLocaleString(locale()))}</p>${extra}<table>${rows.map((r, i) => `<tr>${r.map(v => (i ? `<td>${esc(String(v ?? ''))}</td>` : `<th>${esc(String(v ?? ''))}</th>`)).join('')}</tr>`).join('')}</table><p><button onclick="print()">${esc(L('Печат / PDF'))}</button></p><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
async function exportRows(kind, name, rows, btn) {
  const file = slug(name) || 'bingo';
  if (kind === 'csv') return downloadText(file + '.csv', toCSV(rows));
  if (kind === 'xls') return downloadText(file + '.xls', toXLS(rows, name), 'application/vnd.ms-excel');
  if (kind === 'pdf') return printReport(name, rows);
  if (kind === 'sheet') return busy(btn, async () => { const r = await driveUploadSheet(name, toCSV(rows).slice(1)); toast(L('Записано в Google Drive')); if (r && r.webViewLink) window.open(r.webViewLink, '_blank'); });
}
function exportSheet(A, key, atts, results, btn) {
  sheet({ title: L('Експорт'), body: `<p class="muted small">${L('Оценките и точките по всеки въпрос.')}</p>`, actions: [{ id: 'csv', label: 'CSV' }, { id: 'xls', label: 'Excel' }, { id: 'pdf', label: 'PDF' }, { id: 'sheet', label: 'Google Sheets', kind: 'primary' }] })
    .then(k => k && exportRows(k, `${A.title} — ${A.className || ''}`, resultRows(A, key, atts, results), btn));
}
function exportGradebook(C, members, asg, results, kind, btn) {
  const cols = asg.slice().reverse();
  const rows = [[L('Ученик'), L('Имейл'), ...cols.map(a => a.title), L('Средно %')], ...members.map(m => {
    const mine = cols.map(a => results.find(r => r.assignmentId === a.id && r.studentId === m.id));
    const ps = mine.filter(Boolean).map(r => r.pct);
    return [m.name || '', m.email || '', ...mine.map(r => (r ? (r.grade && r.grade.text) || Math.round(r.pct * 100) + '%' : '')), ps.length ? Math.round(avg(ps) * 100) : ''];
  })];
  return exportRows(kind, `${C.name} — ${L('Дневник')}`, rows, btn);
}
