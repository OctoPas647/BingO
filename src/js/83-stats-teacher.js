/* ================= Прогнози for teachers (0.9.0) =================
   For each class: how each student will likely do on the coming tests (planned slots too), the НВО/ДЗИ forecast,
   who is at risk and why, and how the class has moved over the months and school years.
   Opens from Табло ("Прогнози"), as the "Прогнози" tab of a class, and as a card on a student's page.
   The model is in 81-analytics.js (predictTest, predictMatura); every number says how sure it is. */

const TP = { cid: null, showAll: {} };

/* everything the projections need for one class */
function tpModel(C, { asg = [], results = [], progress = [], members = [], plans = [] }) {
  const now = Date.now(), sid = subjIdOf(C.subject);
  const names = {}; members.forEach(m => { names[m.id] = m.name || m.email; }); results.forEach(r => { if (!names[r.studentId] && r.studentName) names[r.studentId] = r.studentName; }); progress.forEach(p => { if (!names[p.id] && p.name) names[p.id] = p.name; });
  const ids = [...new Set([...(C.studentIds || []), ...members.map(m => m.id)])];
  const res = results.filter(r => r.classId === C.id && isFinite(r.pct)).map(r => ({ ...r, t: tsMs(r.submittedAt) || tsMs(r.gradedAt) || 0 }));
  const resOf = uid => res.filter(r => r.studentId === uid);
  const progOf = uid => progress.find(p => p.id === uid);
  const recent = res.filter(r => r.t > now - 120 * 864e5), classMean = meanOf((recent.length ? recent : res).map(r => r.pct));
  /* the coming tests: scheduled or still open, and planned slots without a test yet */
  const coming = asg.filter(a => a.classId === C.id && a.kind !== 'practice' && (a.status === 'scheduled' || (a.status === 'open' && (!tsMs(a.closesAt) || tsMs(a.closesAt) > now)) || (a.kind === 'live' && asgState(a) === 'ready')))
    .map(a => ({ id: a.id, title: a.title, at: tsMs(a.opensAt) || now, kind: a.kind, settings: a.settings || {}, skills: [...new Set((a.tasks || []).map(t => t.skill).filter(Boolean))], asg: true }))
    .concat(plans.filter(p => p.classId === C.id && !p.assignmentId && (tsMs(p.at) || 0) > now - 864e5).map(p => ({ id: p.id, title: p.title, at: tsMs(p.at), kind: 'plan', settings: { grading: { scale: p.scale || 'bg6' } }, skills: p.skills || [], plan: true })))
    .sort((a, b) => a.at - b.at);
  const tests = coming.map(u => {
    const subjOK = !u.plan || !u.subj || subjIdOf(u.subj) === sid;
    const rows = ids.map(uid => {
      const pr = predictTest(resOf(uid), subjOK ? masteryFor(progOf(uid), sid, u.skills) : null, classMean);
      if (!pr) return null;
      const g = gradeFor(pr.p, u.settings), lo = gradeFor(pr.lo, u.settings), hi = gradeFor(pr.hi, u.settings);
      return { uid, name: names[uid] || L('Ученик'), pr, g, lo, hi, fail: probBelow(pr, passShare(u.settings)) };
    }).filter(Boolean).sort((a, b) => a.pr.p - b.pr.p);
    const gv = rows.map(r => r.g.value).filter(v => isFinite(v));
    return { ...u, rows, avgP: meanOf(rows.map(r => r.pr.p)), avgG: meanOf(gv), dist: [2, 3, 4, 5, 6].map(v => rows.filter(r => r.g.value === v).length), fails: sum(rows.map(r => r.fail)) };
  });
  /* НВО / ДЗИ */
  const matura = sid ? ids.map(uid => { const m = predictMatura(progOf(uid), sid); return m ? { uid, name: names[uid] || L('Ученик'), ...m } : null; }).filter(Boolean).sort((a, b) => a.pts - b.pts) : [];
  /* who needs help, and why */
  const risk = ids.map(uid => {
    const why = [], h = resOf(uid).sort((a, b) => a.t - b.t), p = progOf(uid); let score = 0;
    const next = tests[0] && tests[0].rows.find(r => r.uid === uid);
    if (next && next.fail >= 0.35) { why.push(L('{p}% риск от Слаб 2 на „{t}“', { p: Math.round(next.fail * 100), t: tests[0].title })); score += next.fail * 3; }
    if (h.length >= 3) { const pr = predictTest(h, null, null); if (pr && pr.trend <= -0.03) { why.push(L('спад {n}% на тест', { n: Math.round(-pr.trend * 100) })); score += -pr.trend * 20; } }
    const last2 = h.slice(-2); if (last2.length === 2 && last2.every(r => r.pct < 0.5)) { why.push(L('последните 2 под 50%')); score += 1; }
    const lastAct = p && tsMs(p.updatedAt); if (!p) { why.push(L('не упражнява в BingO')); score += 0.4; } else if (lastAct && now - lastAct > 10 * 864e5) { why.push(L('не е упражнявал {n} дни', { n: Math.round((now - lastAct) / 864e5) })); score += 0.5; }
    const m = matura.find(x => x.uid === uid); if (m && m.pts < 30) { why.push(L('ДЗИ: ≈ {n} т. (под 30)', { n: Math.round(m.pts) })); score += 1.2; }
    const flags = sum(h.map(r => r.flags || 0)); if (flags >= 3) { why.push(L('{n} сигнала при тестове', { n: flags })); score += 0.3; }
    return { uid, name: names[uid] || L('Ученик'), why, score, avg: meanOf(h.map(r => r.pct)) };
  }).filter(r => r.why.length && r.score >= 0.9).sort((a, b) => b.score - a.score);
  /* the class over time: each test's class average, then the coming tests' projections */
  const byAsg = {}; res.forEach(r => (byAsg[r.assignmentId] = byAsg[r.assignmentId] || []).push(r));
  const timeline = Object.values(byAsg).filter(rs => rs.length >= 3).map(rs => ({ t: meanOf(rs.map(r => r.t)), p: meanOf(rs.map(r => r.pct)), title: rs[0].title, n: rs.length })).sort((a, b) => a.t - b.t);
  const years = {}; res.forEach(r => { const y = schoolYearOf(r.t); (years[y] = years[y] || []).push(r); });
  const yearRows = Object.entries(years).sort().map(([y, rs]) => ({ y, p: meanOf(rs.map(r => r.pct)), g: meanOf(rs.map(r => r.grade || {}).filter(g => GRADE_SCALES.includes(g.scale) && isFinite(g.value)).map(g => g.value)), n: rs.length }));
  const recentT = timeline.slice(-6), trend = recentT.length >= 3 ? predictTest(recentT.map(x => ({ pct: x.p, t: x.t })), null, null).trend : 0;
  return { C, sid, ids, names, tests, matura, risk, timeline, yearRows, classMean, trend };
}

/* the cut points of a scale in shares of the points, for the range rows */
function scaleCuts(settings) {
  const g = (settings && settings.grading) || {};
  if (g.scale === 'matura') return [[0.30, '3'], [0.41, '4'], [0.625, '5'], [0.84, '6']];
  if (g.scale === 'bg6exact') return [[0.25, '3'], [0.375, '3,5'], [0.625, '4,5'], [0.875, '5,5']].map(([v], i) => [v, String(i + 3)]);
  return (Array.isArray(g.thresholds) && g.thresholds.length === 4 ? g.thresholds : EDU_BG6_DEFAULT).map((v, i) => [v / 100, String(i + 3)]);
}
const tpDist = dist => `<div class="tp-dist" role="img" aria-label="${dist.map((n, i) => `${i + 2}: ${n}`).join(', ')}">${dist.map((n, i) => `<span class="${n ? '' : 'n0'}" style="flex:${n};background:${GRADE_VARS[i + 2]}" title="${L(EDU_GRADE_NAMES[i + 2])} ${i + 2}: ${n}">${n > 0 ? `${i + 2}·${n}` : ''}</span>`).join('')}</div>`;
const confWord = c => L({ low: 'малко данни', mid: 'средна сигурност', high: 'добра сигурност' }[c]);

function tpTestCard(u, key) {
  const all = TP.showAll[key + u.id], rows = all ? u.rows : u.rows.slice(0, 8);
  const gv = u.avgG;
  return `<div class="card tp-test ${u.plan ? 'tp-plan' : ''}">
    <div class="tp-head"><div><span class="kicker">${u.plan ? L('Планиран · още без тест') : esc(L(KIND_LABEL[u.kind] || 'Тест'))} · ${esc(fmtWhen(u.at, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><b>${esc(u.title)}</b><small>${L('очаквано средно {p} · {n} ученици', { p: pct(u.avgP), n: u.rows.length })}${u.fails >= 0.5 ? ' · ' + L('≈ {n} двойки', { n: Math.round(u.fails) }) : ''}</small></div>
      ${gv != null ? `<div class="tp-pred" style="--gc:${gradeColor(gv)}"><strong>${fmtG(gv)}</strong><small class="muted">${L('очакван успех')}</small></div>` : ''}</div>
    ${tpDist(u.dist)}
    ${chRange(rows.map(r => ({ label: r.name, sub: `${esc(r.g.text || '')} · ${confWord(r.pr.conf)}${r.pr.trend > 0.02 ? ' · ▲' : r.pr.trend < -0.02 ? ' · ▼' : ''}`, subHtml: true, v: r.pr.p, lo: r.pr.lo, hi: r.pr.hi, color: r.g.value ? GRADE_VARS[r.g.value] : 'var(--ch-1)', right: pct(r.pr.p), attr: `data-tpst="${esc(r.uid)}"`,
      tip: `${r.name}: ${pct(r.pr.p)} (${pct(r.pr.lo)}–${pct(r.pr.hi)}) · ${r.g.text || ''}\n${r.pr.hist != null ? L('от тестовете: {p}', { p: pct(r.pr.hist) }) : ''}${r.pr.mastery != null ? ' · ' + L('умения в BingO: {p}', { p: pct(r.pr.mastery) }) : ''}` })), { min: 0, max: 1, cuts: scaleCuts(u.settings) })}
    ${u.rows.length > 8 ? `<button class="btn ghost small tp-more" data-tpall="${esc(key + u.id)}">${all ? L('Покажи по-малко') : L('Всички {n} ученици', { n: u.rows.length })}</button>` : ''}
    ${u.plan ? `<button class="btn accent small" data-plan="${esc(u.id)}">${icon('file')}${L('Създай или избери теста')}</button>` : ''}</div>`;
}

function tpHTML(M, key = 'c') {
  if (!M.ids.length) return emptyBox('users', L('Още няма ученици'), L('Когато в класа има ученици с резултати, тук излизат прогнозите.'));
  const next = M.tests[0], m = M.matura;
  const kpis = `<div class="tp-kpis">${chStat(L('Очакван успех · следващ тест'), next && next.avgG != null ? next.avgG : '–', { dec: 2, color: next && next.avgG != null ? gradeColor(next.avgG) : '', sub: next ? next.title : L('няма насрочен тест') })}
    ${chStat(L('Нужда от помощ'), M.risk.length, { cls: M.risk.length ? 'warn' : '', sub: L('от {n} ученици', { n: M.ids.length }) })}
    ${chStat(L('Прогноза ДЗИ/НВО · средно'), m.length ? Math.round(meanOf(m.map(x => x.pts))) : '–', { unit: m.length ? ' ' + L('т.') : '', sub: m.length ? L('{n} с данни от BingO', { n: m.length }) : L('учениците още не упражняват') })}
    ${chStat(L('Посока на класа'), M.timeline.length >= 3 ? Math.round(M.trend * 1000) / 10 : '–', { dec: 1, unit: M.timeline.length >= 3 ? '%' : '', delta: M.timeline.length >= 3 ? M.trend : null, deltaText: M.trend >= 0 ? L('нагоре') : L('надолу'), sub: L('на тест, последните 6 теста') })}</div>`;
  const tests = M.tests.length ? M.tests.slice(0, 4).map(u => tpTestCard(u, key)).join('') : `<div class="card">${emptyBox('calendar', L('Няма предстоящи тестове'), L('Насрочете тест — дори още без задачи — и BingO ще покаже как вероятно ще се представи всеки ученик.'), `<button class="btn accent" data-newplan="${esc(M.C.id)}">${icon('calendar')}${L('Насрочи тест')}</button>`)}</div>`;
  const md = [2, 3, 4, 5, 6].map(v => m.filter(x => x.grade === v).length);
  const maturaCard = m.length ? `<div class="card"><h3>${icon('target')}${L('Прогноза за ДЗИ / НВО')}</h3>
    ${chDonut([2, 3, 4, 5, 6].map((v, i) => ({ label: `${L(EDU_GRADE_NAMES[v])} ${v}`, value: md[i], color: GRADE_VARS[v] })), { big: Math.round(meanOf(m.map(x => x.pts))), count: Math.round(meanOf(m.map(x => x.pts))), small: L('т. средно от 100') }, { label: L('Прогноза за ДЗИ / НВО') })}
    <p class="tp-sub">${L('По владеенето на темите от упражненията в BingO, по скалата на МОН (30 / 41 / 62,5 / 84 т.).')}</p>
    ${chRange((TP.showAll[key + 'm'] ? m : m.slice(0, 10)).map(x => ({ label: x.name, sub: L('±{n} т.', { n: Math.round((x.hi - x.lo) / 2) }), v: x.pts, lo: x.lo, hi: x.hi, color: GRADE_VARS[x.grade], right: Math.round(x.pts) + ' ' + L('т.'), attr: `data-tpst="${esc(x.uid)}"`, tip: `${x.name}: ≈ ${Math.round(x.pts)} ${L('т.')} (${Math.round(x.lo)}–${Math.round(x.hi)}) · ${L(EDU_GRADE_NAMES[x.grade])} ${x.grade}` })), { min: 0, max: 100, cuts: [[30, '3'], [41, '4'], [62.5, '5'], [84, '6']] })}
    ${m.length > 10 ? `<button class="btn ghost small tp-more" data-tpall="${esc(key)}m">${TP.showAll[key + 'm'] ? L('Покажи по-малко') : L('Всички {n} ученици', { n: m.length })}</button>` : ''}</div>` : '';
  const riskCard = `<div class="card"><h3>${icon('alert')}${L('Кой има нужда от помощ')}</h3>${M.risk.length ? `<div class="tp-risk">${M.risk.slice(0, 8).map(r => `<button class="tp-riskrow ${r.score < 1.6 ? 'mid' : ''}" data-tpst="${esc(r.uid)}"><b>${esc(r.name)}</b><span class="muted small">${r.avg != null ? L('средно {p}', { p: pct(r.avg) }) : ''}</span><span class="tp-why">${r.why.map(w => `<span>${esc(w)}</span>`).join('')}</span></button>`).join('')}</div>
      <button class="btn accent small tp-more" data-tphw="${esc(M.C.id)}">${icon('target')}${L('Упражнение върху слабите умения')}</button>` : `<p class="muted">${L('Никой не изглежда в риск в момента.')}</p>`}</div>`;
  /* the class over time, with the coming tests as a dashed line and their likely range */
  let timeCard = '';
  if (M.timeline.length >= 2) {
    const fut = M.tests.filter(u => u.avgP != null).slice(0, 3), last = M.timeline[M.timeline.length - 1];
    const series = [{ name: L('Среден резултат на класа'), color: 'var(--ch-1)', pts: M.timeline.map(x => ({ x: x.t, y: x.p * 100, tip: `${fmtDay(x.t)} · ${x.title}: ${pct(x.p)} (${x.n})` })) }];
    if (fut.length) series.push({ name: L('Прогноза'), color: 'var(--ch-2)', dash: true, area: false, pts: [{ x: last.t, y: last.p * 100, tip: `${last.title}: ${pct(last.p)}` }, ...fut.map(u => ({ x: u.at, y: u.avgP * 100, tip: `${fmtDay(u.at)} · ${u.title}: ${L('прогноза')} ${pct(u.avgP)}` }))] });
    const band = fut.length ? { color: 'var(--ch-2)', label: L('вероятен диапазон'), pts: [{ x: last.t, lo: last.p * 100, hi: last.p * 100 }, ...fut.map(u => { const sd = meanOf(u.rows.map(r => r.pr.sd)) / Math.sqrt(Math.max(1, u.rows.length / 4)); return { x: u.at, lo: (u.avgP - sd) * 100, hi: (u.avgP + sd) * 100 }; })] } : null;
    const xs = [...M.timeline.map(x => x.t), ...fut.map(u => u.at)], a = Math.min(...xs), b = Math.max(...xs);
    timeCard = `<div class="card"><h3>${icon('chart')}${L('Класът във времето')}</h3>${chLine(series, { yMin: 0, yMax: 100, yFmt: v => fmtN(v) + '%', band, xLabels: [[a, fmtWhen(a, { month: 'short', year: '2-digit' })], [b, fmtWhen(b, { day: 'numeric', month: 'short' })]], label: L('Класът във времето') })}</div>`;
  }
  const yearsCard = M.yearRows.length >= 1 ? `<div class="card"><h3>${icon('calendar')}${L('По учебни години')}</h3>${chCols(M.yearRows.map(r => ({ label: r.y, value: r.p * 100, cap: r.g != null ? fmtG(r.g) : pct(r.p), color: r.g != null ? gradeColor(r.g) : 'var(--ch-1)', tip: `${r.y}: ${pct(r.p)}${r.g != null ? ' · ' + L('среден успех {g}', { g: fmtG(r.g) }) : ''} · ${L('{n} работи', { n: r.n })}` })), { max: 100, label: L('По учебни години') })}<p class="tp-sub">${L('Среден резултат от тестовете в BingO по години; над стълба — средната оценка.')}</p></div>` : '';
  return `${kpis}${tests}<div class="tp-grid">${riskCard}${maturaCard}</div><div class="tp-grid">${timeCard}${yearsCard}</div>
    <p class="muted small">${L('Прогнозите са ориентировъчни: смятат се от последните резултати на ученика (по-новите тежат повече), посоката им и владеенето на темите на теста от упражненията в BingO. Повече данни дават по-тесен диапазон.')}</p>`;
}

/* the projections, wired to live data; used by tStats and by a class's "Прогнози" tab */
function tpMount(box, nav, { cid, key = 'c', onClass } = {}) {
  let members = [], plans = [], memberStop = null, cur = cid;
  const draw = () => {
    if (!box.isConnected) return;
    const C = classById(cur) || TD.classes.find(c => !c.archived);
    if (!C) { box.innerHTML = TD.classes.length ? skel('teacher') : emptyBox('users', L('Започнете с клас'), ''); return; }
    if (C.id !== cur) { cur = C.id; watchMembers(); }
    if (onClass) onClass(C);
    box.innerHTML = tpHTML(tpModel(C, { asg: TD.asg, results: TD.results, progress: TD.progress, members, plans }), key);
    if (typeof decorate === 'function') decorate(box);
  };
  const watchMembers = () => { if (memberStop) memberStop(); members = []; if (cur) memberStop = watch(col(`classes/${cur}/members`), s => { members = docs(s); draw(); }, nav, () => { }); };
  tWatchBase(nav, draw, ['classes', 'asg', 'results', 'progress']);
  watch(col('plans').where('ownerId', '==', myUid()), s => { plans = docs(s); draw(); }, nav, () => { });
  if (cur) watchMembers();
  box.addEventListener('click', e => {
    const st = e.target.closest('[data-tpst]'); if (st) return go('tStudent', { cid: cur, uid: st.dataset.tpst });
    const all = e.target.closest('[data-tpall]'); if (all) { TP.showAll[all.dataset.tpall] = !TP.showAll[all.dataset.tpall]; return draw(); }
    const hw = e.target.closest('[data-tphw]'); if (hw) return go('tPublish', { practice: true, classIds: [hw.dataset.tphw] });
    const np = e.target.closest('[data-newplan]'); if (np) return planSheet({ classId: np.dataset.newplan });
    const pl = e.target.closest('[data-plan]'); if (pl) return planSheet({ id: pl.dataset.plan });
  });
  return { setClass: id => { cur = id; watchMembers(); draw(); }, draw, get cid() { return cur; } };
}

SCREENS.tStats = async (el, p = {}, nav) => {
  if (!(await tGate(el, 'tHome'))) return;
  const body = tFrame(el, 'tHome', { title: L('Прогнози'), kicker: L('Статистики и прогнози'), backBtn: true, wide: true });
  body.innerHTML = `<div class="tp-classes" role="tablist"></div><div class="tp-box">${skel('teacher')}</div>`;
  const chips = body.querySelector('.tp-classes');
  const mt = tpMount(body.querySelector('.tp-box'), nav, { cid: p.cid || TP.cid, key: 's', onClass: C => {
    TP.cid = C.id; p.cid = C.id;
    chips.innerHTML = TD.classes.filter(c => !c.archived).map(c => `<button data-tpc="${esc(c.id)}" class="${c.id === C.id ? 'on' : ''}" style="--cc:${esc(c.color || '#2F5BD3')}"><i></i>${esc(c.name)}<small class="muted">${esc(c.subject || '')}</small></button>`).join('');
  } });
  chips.addEventListener('click', e => { const c = e.target.closest('[data-tpc]'); if (c) mt.setClass(c.dataset.tpc); });
};

/* ---------- Табло gets a "Прогнози" card; a class gets a "Прогнози" tab; a student page gets their projection ---------- */
const _tHome090 = SCREENS.tHome;
SCREENS.tHome = async (el, p, nav) => {
  await _tHome090(el, p, nav);
  const body = el.querySelector('.t-body'); if (!body) return;
  const put = () => {
    if (!body.isConnected || body.querySelector('.tp-homecard') || !TD.classes.length) return;
    const parts = TD.classes.filter(c => !c.archived).map(C => tpModel(C, { asg: TD.asg, results: TD.results, progress: TD.progress })).filter(M => M.ids.length);
    const risk = sum(parts.map(M => M.risk.length)), next = parts.flatMap(M => M.tests.map(u => ({ ...u, cls: M.C.name }))).sort((a, b) => a.at - b.at)[0];
    const html = `<button class="card tp-homecard" data-tstats><span class="tp-hc-ic">${icon('chart')}</span><span class="tp-hc-txt"><b>${L('Прогнози и статистики')}</b><small class="muted">${next ? L('„{t}“ ({c}): очакван успех {g}', { t: esc(next.title), c: esc(next.cls), g: fmtG(next.avgG) }) : L('Как ще се представи всеки ученик на следващите тестове и на матурата')}${risk ? ' · ' + L('{n} ученици с нужда от помощ', { n: risk }) : ''}</small></span>${icon('next')}</button>`;
    const kp = body.querySelector('.t-kpis'); if (kp) kp.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('afterbegin', html);
  };
  /* Табло redraws on every update; the card goes back after each redraw */
  new MutationObserver(() => put()).observe(body, { childList: true });
  put();
  el.addEventListener('click', e => { if (e.target.closest('[data-tstats]')) go('tStats', {}); });
};

const _tClass090 = SCREENS.tClass;
SCREENS.tClass = async (el, p, nav) => {
  const wantForecast = p.tab === 'forecast';
  if (wantForecast) p.tab = 'students';
  await _tClass090(el, p, nav);
  /* one projections box per screen, mounted once (its live data keeps it current) and moved into the tab */
  let mounted = null; const fbox = document.createElement('div'); fbox.className = 'tp-box';
  const addTab = () => {
    const seg = el.querySelector('.t-tabs'); if (!seg || seg.querySelector('[data-tab="forecast"]')) return;
    seg.querySelector('[data-tab="students"]').insertAdjacentHTML('afterend', `<button data-tab="forecast">${L('Прогнози')}</button>`);
    if (TP.classTab === p.cid) { seg.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === 'forecast')); showForecast(); }
  };
  const showForecast = () => {
    const tb = el.querySelector('.t-tabbody'); if (!tb) return;
    tb.innerHTML = ''; tb.appendChild(fbox);
    if (!mounted) { fbox.innerHTML = skel('teacher'); mounted = tpMount(fbox, nav, { cid: p.cid, key: 'k' }); } else mounted.draw();
  };
  const body = el.querySelector('.t-body');
  if (body) new MutationObserver(() => addTab()).observe(body, { childList: true });
  addTab();
  el.addEventListener('click', e => {
    const t = e.target.closest('.t-tabs [data-tab]'); if (!t) return;
    if (t.dataset.tab === 'forecast') { e.stopImmediatePropagation(); TP.classTab = p.cid; el.querySelectorAll('.t-tabs [data-tab]').forEach(b => b.classList.toggle('on', b === t)); if (typeof decorate === 'function') decorate(el); showForecast(); }
    else TP.classTab = null;
  }, true);
  if (wantForecast) { TP.classTab = p.cid; addTab(); }
};

const _tStudent090 = SCREENS.tStudent;
SCREENS.tStudent = async (el, p, nav) => {
  await _tStudent090(el, p, nav);
  const body = el.querySelector('.t-body'); if (!body) return;
  let members = [], plans = [];
  const put = () => {
    if (!body.isConnected || body.querySelector('.tp-student')) return;
    const C = classById(p.cid); if (!C || !body.querySelector('.t-kpis')) return;
    const M = tpModel(C, { asg: TD.asg, results: TD.results, progress: TD.progress, members, plans });
    const tests = M.tests.map(u => ({ u, r: u.rows.find(r => r.uid === p.uid) })).filter(x => x.r).slice(0, 4), mt = M.matura.find(x => x.uid === p.uid), rk = M.risk.find(x => x.uid === p.uid);
    const mine = TD.results.filter(r => r.studentId === p.uid && r.classId === p.cid && isFinite(r.pct)).map(r => ({ x: tsMs(r.submittedAt) || tsMs(r.gradedAt) || 0, y: r.pct * 100, tip: `${r.title}: ${pct(r.pct)}` })).sort((a, b) => a.x - b.x);
    const fut = tests.map(x => ({ x: x.u.at, y: x.r.pr.p * 100, tip: `${x.u.title}: ${L('прогноза')} ${pct(x.r.pr.p)}` }));
    const line = mine.length >= 2 ? chLine([{ name: L('Резултати'), color: 'var(--ch-1)', pts: mine }, ...(fut.length ? [{ name: L('Прогноза'), color: 'var(--ch-2)', dash: true, area: false, pts: [mine[mine.length - 1], ...fut] }] : [])],
      { yMin: 0, yMax: 100, yFmt: v => fmtN(v) + '%', band: fut.length ? { color: 'var(--ch-2)', pts: [{ x: mine[mine.length - 1].x, lo: mine[mine.length - 1].y, hi: mine[mine.length - 1].y }, ...tests.map(x => ({ x: x.u.at, lo: x.r.pr.lo * 100, hi: x.r.pr.hi * 100 }))] } : null, xLabels: [[mine[0].x, fmtWhen(mine[0].x, { month: 'short', year: '2-digit' })], [(fut.length ? fut[fut.length - 1] : mine[mine.length - 1]).x, fmtWhen((fut.length ? fut[fut.length - 1] : mine[mine.length - 1]).x, { day: 'numeric', month: 'short' })]], label: L('Резултати') }) : '';
    const html = `<div class="card tp-student"><h3>${icon('chart')}${L('Прогноза')}</h3>${line}
      ${tests.length ? chRange(tests.map(x => ({ label: x.u.title, sub: fmtDay(x.u.at) + ' · ' + (x.r.g.text || ''), v: x.r.pr.p, lo: x.r.pr.lo, hi: x.r.pr.hi, color: x.r.g.value ? GRADE_VARS[x.r.g.value] : 'var(--ch-1)', right: pct(x.r.pr.p), tip: `${x.u.title}: ${pct(x.r.pr.lo)}–${pct(x.r.pr.hi)}` })), { min: 0, max: 1, cuts: scaleCuts(tests[0].u.settings) }) : `<p class="muted">${L('Няма предстоящи тестове за прогноза.')}</p>`}
      ${mt ? `<p class="tp-sub">${L('ДЗИ / НВО: ≈ {n} т. ({a}–{b}) · {g}', { n: Math.round(mt.pts), a: Math.round(mt.lo), b: Math.round(mt.hi), g: L(EDU_GRADE_NAMES[mt.grade]) + ' ' + mt.grade })}</p>` : ''}
      ${rk ? `<div class="tp-why">${rk.why.map(w => `<span>${esc(w)}</span>`).join('')}</div>` : ''}</div>`;
    body.querySelector('.t-kpis').insertAdjacentHTML('afterend', html);
  };
  tWatchBase(nav, put, ['classes', 'asg', 'results', 'progress']);
  watch(col(`classes/${p.cid}/members`), s => { members = docs(s); put(); }, nav, () => { });
  watch(col('plans').where('ownerId', '==', myUid()), s => { plans = docs(s); put(); }, nav, () => { });
  new MutationObserver(() => put()).observe(body, { childList: true });
};
