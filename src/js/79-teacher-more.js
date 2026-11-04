/* ================= BingO for teachers: calendar and schedules, the Gemini assistant, settings and admin ================= */

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/* ---------- Календар: a month of tests and homework, and the recurring schedules ---------- */
SCREENS.tCalendar = async (el, p, nav) => {
  if (!(await tGate(el, 'tCalendar'))) return;
  const body = tFrame(el, 'tCalendar', { title: L('Календар'), actions: `<button class="btn accent small" data-newsch>${icon('plus')}${L('Повтарящо се домашно')}</button><button class="btn ghost small" data-newtest>${icon('calendar')}${L('Насрочи тест')}</button>` });
  let month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  let schedules = [];
  const draw = () => {
    const y = month.getFullYear(), m = month.getMonth(), first = (month.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
    const evOn = d => { const a = d.getTime(), b = a + 864e5; return TD.asg.filter(x => { const o = tsMs(x.opensAt), c = tsMs(x.closesAt); return (o >= a && o < b) || (c >= a && c < b); }).map(x => ({ x, closing: tsMs(x.closesAt) >= a && tsMs(x.closesAt) < b })); };
    const schOn = d => schedules.filter(s => s.active && (s.days || []).includes(((d.getDay() + 6) % 7) + 1) && d >= new Date(new Date().toDateString()));
    const today = new Date().toDateString();
    body.innerHTML = `<div class="card t-cal"><div class="t-cal-head"><button class="iconbtn" data-mon="-1">${icon('back')}</button><b>${esc(fmtWhen(month.getTime(), { month: 'long', year: 'numeric' }))}</b><button class="iconbtn" data-mon="1">${icon('next')}</button></div>
        <div class="t-cal-grid">${WD.map(w => `<span class="t-cal-wd">${L(w)}</span>`).join('')}${cells.map(d => d ? `<div class="t-cal-day ${d.toDateString() === today ? 'today' : ''}"><small>${d.getDate()}</small>${evOn(d).map(({ x, closing }) => `<button class="t-cal-ev k-${x.kind}" data-tasg="${esc(x.id)}" title="${esc(x.title)}">${closing ? '⏰ ' : ''}${esc(x.title)}</button>`).join('')}${schOn(d).map(s => `<span class="t-cal-ev k-sch">↻ ${esc(s.title || '')}</span>`).join('')}</div>` : '<div></div>').join('')}</div></div>
      <h2 class="sec-title">${L('Повтарящи се домашни')}</h2>
      ${schedules.length ? `<div class="cl-list">${schedules.map(s => { const c = classById(s.classId); return `<div class="cl-asg"><span class="cl-asg-ic">${icon('reset')}</span><span class="cl-asg-main"><b>${esc(s.title || '')}</b><small class="muted">${esc(c ? c.name : '')} · ${(s.days || []).map(d => L(WD[d - 1])).join(', ')} ${esc(s.time || '')} · ${s.kind === 'practice' ? L('упражнение върху слабите умения') : L('тест от банката')}${s.lastRun ? ' · ' + L('последно {d}', { d: s.lastRun }) : ''}</small></span>
        <button class="switch${s.active ? ' on' : ''}" data-schon="${esc(s.id)}" role="switch"><i></i></button><button class="iconbtn" data-runsch="${esc(s.id)}" aria-label="${L('Пусни сега')}">${icon('play')}</button><button class="iconbtn" data-delsch="${esc(s.id)}" aria-label="${L('Изтрий')}">${icon('trash')}</button></div>`; }).join('')}</div>`
        : emptyBox('reset', L('Няма повтарящи се домашни'), L('Например: всеки понеделник 10 задачи в BingO върху най-слабите умения на класа.'))}`;
  };
  tWatchBase(nav, draw, ['classes', 'asg']);
  watch(col('schedules').where('ownerId', '==', myUid()), s => { schedules = docs(s); draw(); }, nav);
  el.addEventListener('click', e => {
    const mo = e.target.closest('[data-mon]'); if (mo) { month.setMonth(month.getMonth() + +mo.dataset.mon); return draw(); }
    const a = e.target.closest('[data-tasg]'); if (a) return openAsg(a.dataset.tasg);
    if (e.target.closest('[data-newsch]')) return scheduleSheet(schedules);
    if (e.target.closest('[data-newtest]')) return go('tTests');
    const on = e.target.closest('[data-schon]'); if (on) { const s = schedules.find(x => x.id === on.dataset.schon); return docRef('schedules/' + s.id).update({ active: !s.active }).catch(failToast); }
    const run = e.target.closest('[data-runsch]'); if (run) return busy(run, async () => { const r = await callFn('runScheduleNow', { scheduleId: run.dataset.runsch }); toast(r.made ? L('Заданието е създадено') : L('Нищо не беше създадено')); });
    const del = e.target.closest('[data-delsch]'); if (del) return confirmBox(L('Да изтрия ли графика?'), L('Вече създадените задания остават.'), L('Изтрий'), true).then(ok => ok && docRef('schedules/' + del.dataset.delsch).delete().catch(failToast));
  });
};

async function scheduleSheet() {
  const tests = docs(await col('tests').where('ownerId', '==', myUid()).get());
  const cls = TD.classes.filter(c => !c.archived);
  if (!cls.length) return toast(L('Първо създайте клас'), 'bad');
  sheet({ title: L('Повтарящо се домашно'), wide: true, body: `
    <label class="fld"><span>${L('Име')}</span><input class="field" data-s="title" value="${esc(L('Седмично упражнение'))}"></label>
    <label class="fld"><span>${L('Клас')}</span><select class="field" data-s="classId">${cls.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
    <div class="seg" data-skind><button data-k="practice" class="on">${L('Упражнение в BingO')}</button><button data-k="homework">${L('Задачи от тест')}</button></div>
    <div data-pr><label class="fld"><span>${L('Предмет')}</span><select class="field" data-s="subject">${Object.values(SUBJECTS).map(x => `<option value="${x.id}" ${x.id === S.subject ? 'selected' : ''}>${x.icon} ${esc(L(x.title))}</option>`).join('')}</select></label><p class="muted small">${L('Всеки път BingO взима 3-те най-слаби умения на класа.')}</p></div>
    <div data-te hidden><label class="fld"><span>${L('Тест')}</span><select class="field" data-s="testId">${tests.map(t => `<option value="${esc(t.id)}">${esc(t.title)} (${(t.tasks || []).length})</option>`).join('')}</select></label><label class="fld"><span>${L('Случайни задачи от теста (0 = всички)')}</span><input class="field" type="number" min="0" data-s="pick" value="10"></label></div>
    <div class="t-days">${WD.map((w, i) => `<button data-day="${i + 1}" class="${i === 0 ? 'on' : ''}">${L(w)}</button>`).join('')}</div>
    <div class="t-inline"><label class="fld"><span>${L('Час')}</span><input class="field" type="time" data-s="time" value="08:00"></label><label class="fld"><span>${L('Срок (часове)')}</span><input class="field" type="number" min="1" max="336" data-s="durationHours" value="72"></label></div>
    <label class="t-check"><input type="checkbox" data-cal> ${L('Добави и в Google Calendar')}</label>`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Създай'), kind: 'primary' }],
    onMount: (sh, o) => {
      let kind = 'practice';
      sh.addEventListener('click', e => {
        const k = e.target.closest('[data-k]'); if (k) { kind = k.dataset.k; sh.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b === k)); sh.querySelector('[data-pr]').hidden = kind !== 'practice'; sh.querySelector('[data-te]').hidden = kind === 'practice'; }
        const d = e.target.closest('[data-day]'); if (d) d.classList.toggle('on');
      });
      const ok = sh.querySelector('[data-act="ok"]');
      ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => {
        const v = k => sh.querySelector(`[data-s="${k}"]`).value;
        const days = [...sh.querySelectorAll('[data-day].on')].map(b => +b.dataset.day);
        if (!days.length) throw new Error(L('Изберете поне един ден'));
        if (kind !== 'practice' && !v('testId')) throw new Error(L('Нямате тестове в банката'));
        const sch = { ownerId: myUid(), classId: v('classId'), title: v('title') || L('Домашно'), kind, days, time: v('time') || '08:00', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sofia', durationHours: +v('durationHours') || 72, active: true, lastRun: '', runs: 0,
          testId: kind === 'practice' ? '' : v('testId'), pick: kind === 'practice' ? 0 : +v('pick') || 0, subject: kind === 'practice' ? v('subject') : '',
          settings: kind === 'practice' ? { practice: { subject: v('subject'), weakest: true, size: 10 }, feedback: { show: 'score', when: 'now' } } : { feedback: { show: 'full', when: 'close' }, aiGrading: 'ai_auto' }, createdAt: FV().serverTimestamp() };
        await col('schedules').add(sch);
        if (sh.querySelector('[data-cal]').checked) await calendarForSchedule(sch, (classById(sch.classId) || {}).name).catch(e => toast(L('Google Calendar: {e}', { e: errMsg(e) }), 'bad'));
        toast(L('Графикът е създаден')); o.close('ok');
      }); }, true);
    } });
}

/* ---------- Асистент: chat with Gemini about the teacher's classes ---------- */
const AI_CHAT = { msgs: [] };
SCREENS.tAI = async (el, p, nav) => {
  if (!(await tGate(el, 'tAI'))) return;
  const body = tFrame(el, 'tAI', { title: L('Асистент'), kicker: '✦ Gemini', actions: `<button class="btn ghost small" data-clear>${icon('reset')}${L('Нов разговор')}</button>` });
  const ideas = ['Направи тест от 10 въпроса за пасивен залог за 9 клас', 'Кои ученици имат нужда от помощ и по какво?', 'Предложи план за следващия час по слабите места на класа', 'Напиши съобщение до родителите за контролното в петък'];
  const draw = () => {
    body.innerHTML = `<div class="t-chat"><div class="t-msgs">${AI_CHAT.msgs.length ? AI_CHAT.msgs.map((m, i) => `<div class="t-msg ${m.role}"><div class="rt">${m.role === 'user' ? esc(m.text) : rich(m.text)}</div>${m.tasks && m.tasks.length ? `<button class="btn accent small" data-opentasks="${i}">${icon('file')}${L('Отвори {n} задачи в редактора', { n: m.tasks.length })}</button>` : ''}</div>`).join('') : `<div class="t-ideas">${ideas.map(x => `<button data-idea>${esc(L(x))}</button>`).join('')}</div>`}</div>
      <form class="t-ask"><textarea class="field" rows="2" data-q placeholder="${L('Попитайте нещо за класовете си или поискайте тест…')}"></textarea><button class="btn accent" type="submit">${icon('send')}</button></form></div>`;
    const m = body.querySelector('.t-msgs'); m.scrollTop = m.scrollHeight;
  };
  const context = () => JSON.stringify({
    classes: TD.classes.map(c => ({ name: c.name, subject: c.subject, students: (c.studentIds || []).length })),
    recent: TD.asg.slice(0, 15).map(a => { const rs = TD.results.filter(r => r.assignmentId === a.id); return { title: a.title, class: a.className, kind: a.kind, avgPct: rs.length ? Math.round(avg(rs.map(r => r.pct)) * 100) : null, handedIn: rs.length }; }),
    weakSkills: classWeakSkills(TD.progress).slice(0, 8).map(x => ({ skill: x.name, avgMastery: Math.round(x.avgP * 100), weakStudents: x.weak.slice(0, 8), commonMistakes: x.topMisc })),
    lowStudents: Object.values(TD.results.reduce((o, r) => { (o[r.studentId] = o[r.studentId] || { name: r.studentName, p: [] }).p.push(r.pct); return o; }, {})).map(s => ({ name: s.name, avgPct: Math.round(avg(s.p) * 100) })).sort((a, b) => a.avgPct - b.avgPct).slice(0, 10)
  });
  const ask = async text => {
    AI_CHAT.msgs.push({ role: 'user', text }); AI_CHAT.msgs.push({ role: 'assistant', text: '…' }); draw();
    try {
      const r = await callFn('teacherAI', { action: 'chat', messages: AI_CHAT.msgs.slice(0, -1).map(m => ({ role: m.role, text: m.text })), context: context(), lang: appLang() }, { timeout: 280000 });
      AI_CHAT.msgs[AI_CHAT.msgs.length - 1] = { role: 'assistant', text: r.reply || '', tasks: r.tasks || [] };
    } catch (e) { AI_CHAT.msgs[AI_CHAT.msgs.length - 1] = { role: 'assistant', text: '⚠ ' + errMsg(e) }; }
    draw();
  };
  tWatchBase(nav, () => { }, ['classes', 'asg', 'results', 'progress']);
  draw();
  body.addEventListener('submit', e => { e.preventDefault(); const q = body.querySelector('[data-q]').value.trim(); if (q) ask(q); });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches('[data-q]')) { e.preventDefault(); body.querySelector('form').requestSubmit(); } });
  el.addEventListener('click', e => {
    const i = e.target.closest('[data-idea]'); if (i) return ask(i.textContent);
    if (e.target.closest('[data-clear]')) { AI_CHAT.msgs = []; return draw(); }
    const o = e.target.closest('[data-opentasks]'); if (o) { const m = AI_CHAT.msgs[+o.dataset.opentasks]; return go('tTestEdit', { tasks: m.tasks, title: '' }); }
  });
};

/* ---------- Още: account, look, the student part, Gemini's examples, admin ---------- */
SCREENS.tMore = async (el, p, nav) => {
  if (!(await tGate(el, 'tMore'))) return;
  const body = tFrame(el, 'tMore', { title: L('Още') });
  const P = CLOUD.profile || {};
  let examples = [];
  const draw = () => {
    body.innerHTML = `<div class="t-grid">
      <div class="card t-form"><h3>${icon('user')}${L('Профил')}</h3>
        <label class="fld"><span>${L('Име и фамилия')}</span><input class="field" data-pf="name" value="${esc(P.name || '')}"></label>
        <label class="fld"><span>${L('Училище')}</span><input class="field" data-pf="school" value="${esc(P.school || '')}"></label>
        <label class="fld"><span>${L('Предмети (със запетая)')}</span><input class="field" data-pf="subjects" value="${esc((P.subjects || []).join(', '))}"></label>
        <button class="btn accent small" data-saveprof>${L('Запази')}</button>
        <p class="muted small">${esc(CLOUD.user.email)} · ${isAdmin() ? L('Администратор') : L('Учител')}</p>
        <div class="cl-acc-actions"><button class="btn ghost small" data-student>${icon('target')}${L('Ученическата част (упражнения)')}</button><button class="btn ghost small" data-settings>${icon('settings')}${L('Език и вид')}</button><button class="btn ghost small" data-out>${icon('logout')}${L('Изход')}</button></div></div>
      <div class="card"><h3>${icon('sparkle')}${L('Как Gemini оценява като вас')}</h3><p class="muted small">${L('Всеки път, когато промените точките, дадени от Gemini, това става пример. Gemini гледа последните примери и следва вашата строгост.')}</p>
        ${examples.length ? `<div class="t-exlist">${examples.slice(0, 20).map(x => `<div class="t-ex"><span class="rt">${richInline(String(x.prompt || '').slice(0, 90))}</span><small class="muted">Gemini ${x.aiPoints} → ${L('вие')} ${x.teacherPoints} / ${x.max}${x.comment ? ' · ' + esc(x.comment.slice(0, 80)) : ''}</small><button class="iconbtn" data-delex="${esc(x.id)}">${icon('trash')}</button></div>`).join('')}</div>` : `<p class="muted">${L('Още няма примери.')}</p>`}</div>
      ${isAdmin() ? `<div class="card t-form"><h3>${icon('lock')}${L('Администрация: кой може да е учител')}</h3><select class="field" data-policy><option value="open">${L('Всеки (свободен избор)')}</option><option value="whitelist">${L('Само имейли и домейни от списъка')}</option><option value="code">${L('С код на училището')}</option><option value="approval">${L('След одобрение от администратор')}</option></select>
        <label class="fld"><span>${L('Списък (по един на ред: ivan@school.bg или @school.bg)')}</span><textarea class="field" rows="3" data-wl></textarea></label><button class="btn accent small" data-savepol>${L('Запази')}</button>
        <h3>${L('Кодове на училища')}</h3><div class="t-inline"><input class="field" data-scschool placeholder="${L('Училище')}"><button class="btn ghost small" data-newsc>${L('Нов код')}</button></div><div class="t-sclist"></div>
        <h3>${L('Заявки за учители')}</h3><div class="t-reqs"></div>
        <h3>${L('Роля по имейл')}</h3><div class="t-inline"><input class="field" data-roleemail placeholder="email"><select class="field" data-rolesel><option value="teacher">${L('Учител')}</option><option value="student">${L('Ученик')}</option><option value="admin">${L('Администратор')}</option></select><button class="btn ghost small" data-setrole>${L('Задай')}</button></div></div>` : ''}
    </div>`;
    if (isAdmin()) loadAdmin();
  };
  const loadAdmin = async () => {
    try {
      const c = await docRef('config/roles').get(), d = c.exists ? c.data() : {};
      body.querySelector('[data-policy]').value = d.policy || 'open'; body.querySelector('[data-wl]').value = (d.whitelist || []).join('\n');
      const codes = docs(await col('schoolCodes').get());
      body.querySelector('.t-sclist').innerHTML = codes.map(x => `<div class="t-ex"><b>${esc(x.code)}</b><small class="muted">${esc(x.school || '')} · ${x.uses || 0}${x.maxUses ? '/' + x.maxUses : ''}${x.active === false ? ' · ' + L('спрян') : ''}</small>${x.active !== false ? `<button class="linkbtn" data-offsc="${esc(x.code)}">${L('Спри')}</button>` : ''}</div>`).join('');
      const reqs = docs(await col('teacherRequests').where('status', '==', 'pending').get());
      body.querySelector('.t-reqs').innerHTML = reqs.length ? reqs.map(r => `<div class="t-ex"><b>${esc(r.name || r.email)}</b><small class="muted">${esc(r.email)} · ${esc(r.school || '')}</small><button class="btn accent small" data-req="approve" data-uid="${esc(r.uid)}">${L('Одобри')}</button><button class="btn ghost small" data-req="reject" data-uid="${esc(r.uid)}">${L('Откажи')}</button></div>`).join('') : `<p class="muted small">${L('Няма чакащи заявки.')}</p>`;
    } catch (e) { console.warn(e); }
  };
  watch(col(`aiExamples/${myUid()}/items`).orderBy('at', 'desc').limit(40), s => { examples = docs(s); draw(); }, nav, () => { });
  draw();
  el.addEventListener('click', e => {
    const sp = e.target.closest('[data-saveprof]'); if (sp) return busy(sp, async () => { const v = k => body.querySelector(`[data-pf="${k}"]`).value.trim(); await docRef('users/' + myUid()).update({ name: v('name'), school: v('school'), subjects: v('subjects').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12), updatedAt: FV().serverTimestamp() }); await cloudRefreshProfile(); toast(L('Запазено')); });
    if (e.target.closest('[data-student]')) return toStudent();
    if (e.target.closest('[data-settings]')) return go('settings');
    const o = e.target.closest('[data-out]'); if (o) return busy(o, async () => { await signOutCloud(); S.cloud = null; saveState(true); refresh(); });
    const dx = e.target.closest('[data-delex]'); if (dx) return docRef(`aiExamples/${myUid()}/items/${dx.dataset.delex}`).delete().catch(failToast);
    const pol = e.target.closest('[data-savepol]'); if (pol) return busy(pol, async () => { await callFn('adminSetPolicy', { policy: body.querySelector('[data-policy]').value, whitelist: body.querySelector('[data-wl]').value.split(/\s+/).filter(Boolean) }); toast(L('Запазено')); });
    const ns = e.target.closest('[data-newsc]'); if (ns) return busy(ns, async () => { const r = await callFn('adminSchoolCode', { school: body.querySelector('[data-scschool]').value }); toast(L('Код: {c}', { c: r.code })); loadAdmin(); });
    const off = e.target.closest('[data-offsc]'); if (off) return busy(off, async () => { await callFn('adminSchoolCode', { action: 'disable', code: off.dataset.offsc }); loadAdmin(); });
    const rq = e.target.closest('[data-req]'); if (rq) return busy(rq, async () => { await callFn('adminTeacherRequest', { uid: rq.dataset.uid, action: rq.dataset.req }); loadAdmin(); });
    const sr = e.target.closest('[data-setrole]'); if (sr) return busy(sr, async () => { await callFn('setUserRole', { email: body.querySelector('[data-roleemail]').value.trim(), role: body.querySelector('[data-rolesel]').value }); toast(L('Ролята е сменена. Потребителят трябва да влезе отново.')); });
  });
};
