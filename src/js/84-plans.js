/* ================= Planned tests (0.9.0) =================
   A teacher can put a test in the calendar before it exists: class, date and time, length, subject, topics.
   Later they create the test (or pick one from the bank) and give it to the class from the plan; the publish
   screen opens with the class, the date and the length filled in, and the plan then points at the assignment.
   Students see what is coming in their Клас tab. The projections (83-stats-teacher.js) already count a plan
   as a coming test, using its topics. Firestore: plans/{id} (firestore.rules). */

const PLAN_CTX = { id: null, at: 0 };   /* a plan whose test is being made or picked right now */
async function planForPublish(planId) {
  const id = planId || (PLAN_CTX.id && Date.now() - PLAN_CTX.at < 3 * 3600e3 ? PLAN_CTX.id : null);
  if (!id) return null;
  try { const s = await docRef('plans/' + id).get(); return s.exists && !s.data().assignmentId ? { id: s.id, ...s.data() } : null; } catch (e) { return null; }
}
async function planAttach(plan, assignmentId, testId) {
  PLAN_CTX.id = null;
  await docRef('plans/' + plan.id).update({ assignmentId, testId: testId || '', attachedAt: FV().serverTimestamp() });
}

/* the sheet: a new plan, or an existing one with "create the test" / "pick from the bank" */
async function planSheet({ id, classId, at } = {}) {
  const cls = TD.classes.filter(c => !c.archived);
  if (!cls.length) return toast(L('Първо създайте клас'), 'bad');
  let P = null;
  if (id) { const s = await docRef('plans/' + id).get(); if (!s.exists) return toast(L('Планът е изтрит'), 'bad'); P = { id: s.id, ...s.data() }; }
  const C0 = classById((P && P.classId) || classId) || cls[0];
  const def = at || (P && tsMs(P.at)) || (() => { const d = new Date(Date.now() + 7 * 864e5); d.setHours(8, 0, 0, 0); return d.getTime(); })();
  const subjOf = c => subjIdOf(c && c.subject) || '';
  const skillsHtml = (sid, sel = []) => sid && SUBJECTS[sid] ? `<div class="t-types">${skillList(sid).map(k => `<label class="t-check"><input type="checkbox" data-pk="${k.id}" ${sel.includes(k.id) ? 'checked' : ''}> ${esc(L(k.name))}</label>`).join('')}</div>` : `<p class="muted small">${L('Темите от BingO се показват за предметите, по които BingO има задачи.')}</p>`;
  const attached = P && P.assignmentId, vals = {};
  const v = await sheet({ title: P ? L('Планиран тест') : L('Насрочи тест'), wide: true, body: `
    ${P ? `<p class="muted small">${attached ? L('Тестът вече е зададен на класа.') : L('Още няма тест. Създайте го или изберете от банката — класът, датата и времето ще са попълнени.')}</p>` : `<p class="muted small">${L('Сложете теста в календара сега, а задачите добавете по-късно. Учениците виждат кога е, а BingO показва прогноза за всеки.')}</p>`}
    <label class="fld"><span>${L('Име')}</span><input class="field" data-pf="title" value="${esc(P ? P.title : L('Контролна работа'))}" maxlength="80"></label>
    <div class="t-inline"><label class="fld"><span>${L('Клас')}</span><select class="field" data-pf="classId">${cls.map(c => `<option value="${esc(c.id)}" ${c.id === C0.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.subject || '')}</option>`).join('')}</select></label>
      <label class="fld"><span>${L('Кога')}</span><input class="field" type="datetime-local" data-pf="at" value="${toLocalInput(def)}"></label></div>
    <div class="t-inline"><label class="fld"><span>${L('Минути')}</span><input class="field" type="number" min="5" max="300" data-pf="durationMin" value="${P ? P.durationMin || 40 : 40}"></label>
      <label class="fld"><span>${L('Оценяване')}</span><select class="field" data-pf="scale">${['bg6', 'bg6exact', 'matura'].map(k => `<option value="${k}" ${(P ? P.scale : 'bg6') === k ? 'selected' : ''}>${esc(L(SCALE_LABEL[k]))}</option>`).join('')}</select></label></div>
    <span class="t-lab">${L('Теми (по желание — за по-точна прогноза)')}</span><div data-pskills>${skillsHtml(subjOf(C0), P ? P.skills || [] : [])}</div>
    <label class="fld"><span>${L('Бележка')}</span><input class="field" data-pf="note" value="${esc(P ? P.note || '' : '')}" maxlength="200" placeholder="${L('напр. глави 3–5, носете калкулатор')}"></label>`,
    actions: P ? (attached ? [{ id: 'open', label: L('Отвори теста'), kind: 'primary' }, { id: 'del', label: L('Изтрий плана'), icon: 'trash' }] :
      [{ id: 'del', label: L('Изтрий'), icon: 'trash' }, { id: 'save', label: L('Запази') }, { id: 'pick', label: L('От банката'), icon: 'file' }, { id: 'make', label: L('Създай теста'), kind: 'primary', icon: 'plus' }])
      : [{ id: 'no', label: L('Отказ') }, { id: 'save', label: L('Насрочи'), kind: 'primary', icon: 'calendar' }],
    onMount: sh => {
      const sel = sh.querySelector('[data-pf="classId"]');
      sel.addEventListener('change', () => { sh.querySelector('[data-pskills]').innerHTML = skillsHtml(subjOf(classById(sel.value))); });
      /* keep what is typed when an action closes the sheet */
      sh.addEventListener('click', e => { if (e.target.closest('[data-act]')) { sh.querySelectorAll('[data-pf]').forEach(x => { vals[x.dataset.pf] = x.value; }); vals.skills = [...sh.querySelectorAll('[data-pk]:checked')].map(x => x.dataset.pk); } }, true);
    } }).then(async act => {
      if (!act || act === 'no') return null;
      if (act === 'open') return openAsg(P.assignmentId);
      if (act === 'del') { if (await confirmBox(L('Да изтрия ли плана?'), attached ? L('Зададеният тест остава.') : '', L('Изтрий'), true)) await docRef('plans/' + P.id).delete().catch(failToast); return null; }
      return act;
    });
  if (!v) return;
  const f = k => vals[k] || '';
  const c = classById(f('classId')), when = fromLocalInput(f('at'));
  if (!when) return toast(L('Изберете дата и час'), 'bad');
  const data = { ownerId: myUid(), classId: c.id, className: c.name, subject: c.subject || '', title: f('title').trim() || L('Контролна работа'), at: when,
    durationMin: clamp(+f('durationMin') || 40, 5, 300), scale: f('scale'), note: f('note').trim(), skills: vals.skills || [], assignmentId: P ? P.assignmentId || '' : '', updatedAt: FV().serverTimestamp() };
  let pid = P && P.id;
  try {
    if (P) await docRef('plans/' + P.id).set(data, { merge: true });
    else { data.createdAt = FV().serverTimestamp(); pid = (await col('plans').add(data)).id; }
  } catch (e) { return failToast(e); }
  if (v === 'save') return toast(P ? L('Запазено') : L('Тестът е насрочен за {d}', { d: fmtWhen(when) }));
  PLAN_CTX.id = pid; PLAN_CTX.at = Date.now();
  if (v === 'make') return go('tTestEdit', { title: data.title, planId: pid });
  if (v === 'pick') return go('tTests', { pickFor: c.id, planId: pid });
}

/* ---------- the calendar shows plans; "Насрочи тест" makes one ---------- */
const _tCal090 = SCREENS.tCalendar;
SCREENS.tCalendar = async (el, p, nav) => {
  await _tCal090(el, p, nav);
  let plans = [];
  const paint = () => {
    const grid = el.querySelector('.t-cal-grid'); if (!grid) return;
    grid.querySelectorAll('.k-plan').forEach(x => x.remove());
    const head = el.querySelector('.t-cal-head b'); if (!head) return;
    const days = [...grid.querySelectorAll('.t-cal-day')];
    const month = days.length ? days : [];
    month.forEach(d => {
      const n = +d.querySelector('small').textContent, label = head.textContent;
      const ref = plans.filter(pl => !pl.assignmentId).filter(pl => { const t = tsMs(pl.at); if (!t) return false; const x = new Date(t); return x.getDate() === n && fmtWhen(t, { month: 'long', year: 'numeric' }) === label; });
      ref.forEach(pl => d.insertAdjacentHTML('beforeend', `<button class="t-cal-ev k-plan" data-planev="${esc(pl.id)}" title="${esc(pl.title)}">◌ ${esc(pl.title)}</button>`));
    });
    /* the list of plans under the calendar */
    let box = el.querySelector('.tp-planlist');
    const up = plans.filter(pl => !pl.assignmentId && (tsMs(pl.at) || 0) > Date.now() - 864e5).sort((a, b) => tsMs(a.at) - tsMs(b.at));
    if (!box) { const cal = el.querySelector('.t-cal'); if (!cal) return; cal.insertAdjacentHTML('afterend', '<div class="tp-planlist"></div>'); box = el.querySelector('.tp-planlist'); }
    box.innerHTML = up.length ? `<h2 class="sec-title">${L('Планирани тестове')}</h2><div class="cl-list">${up.map(pl => `<button class="cl-asg" data-planev="${esc(pl.id)}"><span class="cl-asg-ic">${icon('calendar')}</span><span class="cl-asg-main"><b>${esc(pl.title)}</b><small class="muted">${esc(pl.className || '')} · ${esc(fmtWhen(tsMs(pl.at)))} · ${L('{n} мин', { n: pl.durationMin || 40 })}${(pl.skills || []).length ? ' · ' + L('{n} теми', { n: pl.skills.length }) : ''}</small></span><span class="cl-pill p-scheduled">${L('без тест')}</span></button>`).join('')}</div>` : '';
  };
  watch(col('plans').where('ownerId', '==', myUid()), s => { plans = docs(s); paint(); }, nav, () => { });
  const body = el.querySelector('.t-body'); if (body) new MutationObserver(() => { if (!body.querySelector('.k-plan') && plans.length) paint(); }).observe(body, { childList: true });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-newtest]')) { e.stopImmediatePropagation(); return planSheet({}); }
    const pe = e.target.closest('[data-planev]'); if (pe) { e.stopImmediatePropagation(); return planSheet({ id: pe.dataset.planev }); }
  }, true);
};

/* ---------- picking a test for a plan: the test list says so, and giving it fills in the plan ---------- */
const _tTests090 = SCREENS.tTests;
SCREENS.tTests = async (el, p = {}, nav) => {
  if (p.planId) { PLAN_CTX.id = p.planId; PLAN_CTX.at = Date.now(); }
  await _tTests090(el, p, nav);
  if (p.planId) { const k = el.querySelector('.t-titles .kicker'); if (k) k.textContent = L('Избор на тест за планирания'); }
};
const _tTestEdit090 = SCREENS.tTestEdit;
SCREENS.tTestEdit = async (el, p = {}, nav) => {
  if (p.planId) { PLAN_CTX.id = p.planId; PLAN_CTX.at = Date.now(); }
  return _tTestEdit090(el, p, nav);
};

/* ---------- students see what is coming in their class ---------- */
async function studentPlans() {
  if (!CLOUD.user) return [];
  try {
    const me = myUid(), cls = docs(await col('classes').where('studentIds', 'array-contains', me).get());
    const out = [];
    for (const c of cls) { try { docs(await col('plans').where('classId', '==', c.id).get()).forEach(pl => { if (!pl.assignmentId && tsMs(pl.at) > Date.now() - 3600e3) out.push({ ...pl, className: c.name, subject: c.subject }); }); } catch (e) { } }
    return out.sort((a, b) => tsMs(a.at) - tsMs(b.at));
  } catch (e) { return []; }
}
