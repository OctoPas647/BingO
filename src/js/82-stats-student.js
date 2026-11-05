/* ================= Статистики for a student (0.9.0) =================
   Three tabs:
   - Оценки: as in Shkolo — общ успех, grades per subject and term with срочна and годишна, the spread of grades,
     how the average moved through the year (next to last year), the student next to the class on BingO tests,
     teachers' notes, absences. Grades come from BingO tests and from the student (typed in, any year).
   - Упражнения: BingO practice — activity rings, active days, the week, the matura forecast over time, one card
     per planned matura (the earlier Stats screen), past exams.
   - Години: every school year next to the others — общ успех, each subject, practice, the forecast. */

const STATS_UI = { tab: 'grades', year: null };
const _statsCards090 = SCREENS.stats;   /* the matura cards with their forecast rows (64-nav.js + 65-forecast.js) */

SCREENS.stats = async (el, params = {}) => {
  ensureAnalytics();
  setAccent(el);
  if (params.tab) STATS_UI.tab = params.tab;
  rollYears(); snapForecasts();
  const tabs = [['grades', 'Оценки'], ['practice', 'Упражнения'], ['years', 'Години']];
  el.innerHTML = `<header class="apphead"><div class="brand bingo">Bing<span>O</span></div><button class="iconbtn" data-addgrade aria-label="${L('Добави оценка')}">${icon('plus')}</button></header>
    <section class="pad st-pad"><h1 class="screen-title">${L('Статистики')}</h1>
      <div class="seg st-tabs" role="tablist">${tabs.map(([k, l]) => `<button data-sttab="${k}" role="tab" class="${STATS_UI.tab === k ? 'on' : ''}">${L(l)}</button>`).join('')}</div>
      <div class="st-body"></div></section>`;
  const body = el.querySelector('.st-body');
  const draw = async () => {
    el.querySelectorAll('[data-sttab]').forEach(b => b.classList.toggle('on', b.dataset.sttab === STATS_UI.tab));
    if (STATS_UI.tab === 'grades') body.innerHTML = gradesTab();
    else if (STATS_UI.tab === 'years') body.innerHTML = yearsTab();
    else { body.innerHTML = skel('page'); body.innerHTML = await practiceTab(); }
    if (typeof decorate === 'function') decorate(el);
  };
  await draw();
  /* grades from BingO tests and the class comparison come from the cloud: shimmer until they are here */
  if (CLOUD.user && CLOUD.role !== 'teacher' || (typeof demoCloudOn === 'function' && demoCloudOn() && S.profile.role !== 'teacher')) {
    const ph = body.querySelector('[data-cloudwait]'); if (ph) ph.innerHTML = skel('list', 2);
    (async () => { if (!CLOUD.user && typeof cloudLoad === 'function') { try { await cloudLoad(); } catch (e) { } } return syncBingoGrades(); })()
      .then(ch => { if (!el.isConnected) return; if (ch) draw(); else { const p = body.querySelector('[data-cloudwait]'); if (p) p.innerHTML = ''; } });
  }
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-sttab]'); if (t) { STATS_UI.tab = t.dataset.sttab; const n = NAV[NAV.length - 1]; if (n) n.params = { ...n.params, tab: STATS_UI.tab }; return draw(); }
    const y = e.target.closest('[data-styear]'); if (y) { STATS_UI.year = y.dataset.styear; return draw(); }
    if (e.target.closest('[data-addgrade]')) return gradeSheet({ year: STATS_UI.year || curYear() }).then(ok => ok && draw());
    if (e.target.closest('[data-bulkgrades]')) return bulkSheet(STATS_UI.year || curYear()).then(ok => ok && draw());
    if (e.target.closest('[data-pastyears]')) return yearGradesSheet().then(ok => ok && draw());
    const g = e.target.closest('[data-g]'); if (g) return gradeSheet({ id: g.dataset.g }).then(ok => ok && draw());
    const s = e.target.closest('[data-subj]'); if (s) return subjSheet(s.dataset.subj).then(ok => ok && draw());
    const ab = e.target.closest('[data-abs]'); if (ab) { const [yk, term, k, d] = ab.dataset.abs.split('|'); const a = S.absences[yk] || (S.absences[yk] = { 1: { exc: 0, unexc: 0, late: 0 }, 2: { exc: 0, unexc: 0, late: 0 } }); a[term][k] = Math.max(0, (a[term][k] || 0) + +d); saveState(); return draw(); }
    const o = e.target.closest('[data-open]'); if (o) { S.subject = o.dataset.open; saveState(); return home(); }
    const f = e.target.closest('[data-forecast]'); if (f) return fcSheet(f.dataset.forecast);
    const px = e.target.closest('[data-pastgo]'); if (px) return go('pastexam', { id: px.dataset.pastgo });
  });
};

/* ---------- Оценки ---------- */
function yearPicker() {
  const ys = yearsWithData().filter(y => y === curYear() || S.grades.some(g => g.year === y) || S.absences[y]);
  const cur = STATS_UI.year && ys.includes(STATS_UI.year) ? STATS_UI.year : curYear();
  STATS_UI.year = cur;
  return ys.length > 1 ? `<div class="st-years hscroll">${ys.slice().reverse().map(y => `<button data-styear="${y}" class="st-chip${y === cur ? ' on' : ''}">${esc(y)}${gradeInYear(y) ? `<small>${esc(gradeInYear(y))}</small>` : ''}</button>`).join('')}</div>` : '';
}
function gradesTab() {
  const picker = yearPicker(), yk = STATS_UI.year, list = gradesOf({ year: yk });
  const ys = yearSuccess(yk), prev = yearSuccess(prevYear(yk));
  if (!list.length) {
    return `${picker}<div class="card st-empty">${icon('trophy')}<h3>${L('Оценките ти на едно място')}</h3>
      <p class="muted">${L('Оценките от тестовете в BingO идват сами. Добави и тези от училище (както са в Shkolo) — и ще видиш успеха си по предмети, срокове и години.')}</p>
      <button class="btn accent block" data-addgrade>${icon('plus')}${L('Добави оценка')}</button><button class="btn ghost block" data-bulkgrades>${icon('text')}${L('Много наведнъж')}</button>
      <button class="btn ghost block" data-pastyears>${icon('calendar')}${L('Годишни оценки от минали години')}</button></div><div data-cloudwait></div>`;
  }
  const cur = list.filter(g => !isFinal(g)), dist = [2, 3, 4, 5, 6].map(v => ({ v, n: cur.filter(g => Math.round(g.v >= 5.5 ? 6 : g.v >= 4.5 ? 5 : g.v >= 3.5 ? 4 : g.v >= 3 ? 3 : 2) === v).length }));
  const cmp = Object.values(S.classCmp).filter(c => c.at && schoolYearOf(c.at) === yk);
  const classAvg = meanOf(cmp.map(c => c.avgGrade).filter(x => x != null));
  const delta = ys.v != null && prev.v != null ? ys.v - prev.v : null;
  const hero = `<div class="card st-hero" style="--gc:${gradeColor(ys.v || 2)}">
      <div class="st-gauge">${chRings([{ p: ys.v != null ? (ys.v - 2) / 4 : 0, color: gradeColor(ys.v || 2), label: L('Общ успех'), value: fmtG(ys.v) }], { label: L('Общ успех'), legend: false })}</div>
      <div class="st-hero-txt"><span class="kicker">${L('Общ успех · {y}', { y: esc(yk) })}</span>
        <b class="st-big" data-count="${ys.v || 0}" data-dec="2">${fmtG(ys.v)}</b><span class="st-word">${ys.v != null ? esc(gradeWord(ys.v)) : ''}</span>
        ${delta != null ? `<em class="st-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${fmtG(Math.abs(delta))} ${L('спрямо {y}', { y: esc(prevYear(yk)) })}</em>` : ''}
        <small class="muted">${L('{n} оценки · {m} предмета', { n: cur.length, m: ys.per.length })}${classAvg != null ? ' · ' + L('класът: {v}', { v: fmtG(classAvg) }) : ''}</small></div></div>`;
  const kpi = `<div class="st-kpis">${chStat(L('Отлични'), dist[4].n, { color: 'var(--g6)' })}${chStat(L('Най-силен'), ys.per.length ? shortSubj(ys.per.slice().sort((a, b) => b.v - a.v)[0].subj) : '–')}${chStat(L('За внимание'), ys.per.filter(p => p.v < 4.5).length, { sub: ys.per.filter(p => p.v < 4.5).map(p => shortSubj(p.subj)).slice(0, 2).join(', ') || L('няма') })}${chStat(L('Отсъствия'), absTotal(yk), { sub: L('извинени и неизвинени') })}</div>`;
  /* averages per subject, with the class's average on BingO tests where there is one */
  const bars = ys.per.slice().sort((a, b) => b.v - a.v).map(p => {
    const cl = meanOf(cmp.filter(c => c.subj === p.subj).map(c => c.avgGrade).filter(x => x != null));
    return { label: shortSubj(p.subj), sub: L('{n} оценки', { n: p.n }), value: p.v, color: gradeColor(p.v), right: `<span class="gchip sm" style="--gc:${gradeColor(p.v)}">${fmtG(p.v)}</span>`, rightHtml: true, mark: cl, markLabel: L('класът: {v}', { v: fmtG(cl) }), tip: `${p.subj}: ${fmtG(p.v)}${cl != null ? ' · ' + L('класът: {v}', { v: fmtG(cl) }) : ''}` };
  });
  const subjRows = `<div class="st-subjrows">${chHBars(bars, { min: 2, max: 6, markLegend: cmp.length ? L('средно за класа (тестове в BingO)') : '' })}</div>`;
  /* the grade book: subject → I term grades | срочна | II term | срочна | годишна */
  const book = ys.per.slice().sort((a, b) => a.subj.localeCompare(b.subj, 'bg')).map(p => {
    const sl = list.filter(g => g.subj === p.subj).sort((a, b) => a.at - b.at);
    const term = n => { const cg = sl.filter(g => g.term === n && !isFinal(g)), tg = sl.find(g => g.kind === 'term' && g.term === n); return `<div class="st-term"><span class="st-tl">${n === 1 ? L('I срок') : L('II срок')}</span><span class="st-chips">${cg.map(g => gradeChip(g.v, { small: true, attr: `data-g="${esc(g.id)}"`, title: kindLabel(g.kind) + (g.title ? ': ' + g.title : '') })).join('') || '<i class="muted">—</i>'}</span>${tg ? gradeChip(tg.v, { term: true, attr: `data-g="${esc(tg.id)}"`, title: L('Срочна') }) : cg.length ? `<span class="st-avg muted">${fmtG(curAvg(cg))}</span>` : ''}</div>`; };
    const yg = sl.find(g => g.kind === 'year');
    return `<div class="st-bookrow"><button class="st-bsubj" data-subj="${esc(p.subj)}"><i style="background:${subjColor(p.subj)}"></i><b>${esc(shortSubj(p.subj))}</b>${yg ? gradeChip(yg.v, { term: true, attr: `data-g="${esc(yg.id)}"`, title: L('Годишна') }) : `<span class="gchip sm ghost">${fmtG(p.v)}</span>`}</button>${term(1)}${term(2)}</div>`;
  }).join('');
  /* the year so far: the running average, next to last year's */
  const run = yk2 => { const gs = gradesOf({ year: yk2 }).filter(g => !isFinal(g)).sort((a, b) => a.at - b.at); let s = 0; return gs.map((g, i) => { s += g.v; return { x: (g.at - yearStart(yk2)) / 864e5, y: s / (i + 1), tip: `${fmtDay(g.at)} · ${shortSubj(g.subj)} ${fmtG(g.v)} → ${L('средно')} ${fmtG(s / (i + 1))}` }; }); };
  const runNow = run(yk), runPrev = run(prevYear(yk));
  const months = [[0, L('IX')], [76, L('XII')], [138, L('II')], [197, L('IV')], [288, L('VI')]];
  const trend = runNow.length > 1 ? `<div class="card"><h3>${icon('chart')}${L('Как се движи успехът')}</h3>${chLine([{ name: yk, pts: runNow, color: 'var(--ch-1)' }, ...(runPrev.length > 1 ? [{ name: prevYear(yk), pts: runPrev, color: 'var(--ch-muted)', dash: true, area: false }] : [])],
    { yMin: Math.max(2, Math.floor(Math.min(...[...runNow, ...runPrev].map(p => p.y)) - 0.3)), yMax: 6, yFmt: v => fmtN(v, v % 1 ? 1 : 0), xLabels: months.filter(m => m[0] <= Math.max(...[...runNow, ...runPrev].map(p => p.x)) + 20), legend: true, label: L('Как се движи успехът') })}</div>` : '';
  const vs = cmp.length ? `<div class="card"><h3>${icon('users')}${L('Ти и класът')}</h3>${chHBars(cmp.sort((a, b) => b.at - a.at).slice(0, 8).map(c => ({ label: c.title || '—', sub: L('по-добре от {p}% от класа', { p: Math.round((c.rank || 0) * 100) }), value: c.pct ?? 0, max: 1, color: (c.pct ?? 0) >= c.avgPct ? 'var(--g6)' : 'var(--g3)', mark: c.avgPct, right: pct(c.pct), tip: `${L('Ти')}: ${pct(c.pct)} · ${L('класът')}: ${pct(c.avgPct)} (${c.n})` })), { min: 0, max: 1, markLegend: L('средно за класа') })}</div>` : '';
  const notes = list.filter(g => g.note).sort((a, b) => b.at - a.at).slice(0, 5);
  const notesCard = notes.length ? `<div class="card"><h3>${icon('chat')}${L('Отзиви от учителите')}</h3><div class="st-notes">${notes.map(g => `<div class="st-note">${gradeChip(g.v, { small: true })}<div><b>${esc(g.title || shortSubj(g.subj))}</b><p>${esc(g.note)}</p><small class="muted">${fmtDay(g.at)}</small></div></div>`).join('')}</div></div>` : '';
  return `${picker}${hero}${kpi}
    <div class="st-grid">
      <div class="card"><h3>${icon('grid')}${L('Разпределение на оценките')}</h3>${chDonut(dist.map(d => ({ label: `${L(EDU_GRADE_NAMES[d.v])} ${d.v}`, value: d.n, color: GRADE_VARS[d.v] })), { big: cur.length, count: cur.length, small: L('оценки') }, { label: L('Разпределение на оценките') })}</div>
      <div class="card"><h3>${icon('trophy')}${L('По предмети')}</h3>${subjRows}</div></div>
    ${trend}
    <div class="card st-book"><h3>${icon('book')}${L('Дневник')}<button class="btn ghost small st-h3btn" data-bulkgrades>${icon('text')}${L('Много наведнъж')}</button></h3>${book}<p class="muted small">${L('Натисни оценка, за да я промениш, или предмет — за всичко по него.')}</p></div>
    <div data-cloudwait></div>${vs}${notesCard}${absCard(yk)}`;
}
const absTotal = yk => { const a = S.absences[yk]; return a ? sum(['1', '2'].map(t => (a[t].exc || 0) + (a[t].unexc || 0))) : 0; };
function absCard(yk) {
  const a = S.absences[yk] || { 1: { exc: 0, unexc: 0, late: 0 }, 2: { exc: 0, unexc: 0, late: 0 } };
  const step = (t, k) => `<span class="st-step"><button data-abs="${yk}|${t}|${k}|-1" aria-label="−">−</button><b>${a[t][k] || 0}</b><button data-abs="${yk}|${t}|${k}|1" aria-label="+">+</button></span>`;
  return `<div class="card"><h3>${icon('calendar')}${L('Отсъствия')}</h3><div class="st-abs"><span></span><small>${L('Извинени')}</small><small>${L('Неизвинени')}</small><small>${L('Закъснения')}</small>
    ${['1', '2'].map(t => `<b>${t === '1' ? L('I срок') : L('II срок')}</b>${step(t, 'exc')}${step(t, 'unexc')}${step(t, 'late')}`).join('')}</div>
    <p class="muted small">${L('Препиши ги от Shkolo, за да ги виждаш до оценките си.')}</p></div>`;
}

/* ---------- Упражнения ---------- */
async function practiceTab() {
  const act = activity(), mine = myLog(), total = mine.length;
  const now = Date.now(), day = 864e5;
  const today = mine.filter(r => localDay(r.t || Date.parse(r.timestamp)) === localDay()).length;
  const wk = mine.filter(r => (r.t || Date.parse(r.timestamp)) > now - 7 * day), acc7 = wk.length ? accOf(wk) : 0;
  const counts = {}; mine.forEach(r => { const k = localDay(r.t || Date.parse(r.timestamp) || 0); counts[k] = (counts[k] || 0) + 1; });
  /* weekly accuracy over the last 10 weeks */
  const weeks = Array.from({ length: 10 }, (_, i) => { const a = now - (10 - i) * 7 * day, b = a + 7 * day, rs = mine.filter(r => { const t = r.t || Date.parse(r.timestamp); return t >= a && t < b; }); return { x: i, y: rs.length ? accOf(rs) * 100 : null, n: rs.length, a }; }).filter(w => w.y != null);
  const rings = chRings([
    { p: today / 20, color: 'var(--ring-1)', label: L('Днес'), value: L('{n} от 20 задачи', { n: today }) },
    { p: acc7, color: 'var(--ring-2)', label: L('Точност 7 дни'), value: wk.length ? pct(acc7) : '–' },
    { p: act.streak / 7, color: 'var(--ring-3)', label: L('Поредни дни'), value: L('{n} от 7', { n: act.streak }) }], { label: L('Днес') });
  const kpis = `<div class="st-kpis">${chStat(L('отговора'), total)}${chStat(L('верни'), total ? Math.round(accOf(mine) * 100) : 0, { unit: '%' })}${chStat(L('дни поредни'), act.streak, { color: 'var(--ring-3)' })}${chStat(L('активни дни'), act.days)}</div>`;
  /* the matura forecast through time */
  const fcSeries = Object.entries(S.fcHist).filter(([k, h]) => SUBJECTS[k] && h.length > 1).slice(0, 4).map(([k, h]) => ({ name: L(SUBJECTS[k].short || SUBJECTS[k].title), color: SUBJECTS[k].color, pts: h.map(([t, v]) => ({ x: t, y: v, tip: `${fmtDay(t)} · ${L(SUBJECTS[k].short || SUBJECTS[k].title)}: ${fmtN(v)} ${L('т.')}` })) }));
  const fcX = fcSeries.length ? (() => { const xs = fcSeries.flatMap(s => s.pts.map(p => p.x)), a = Math.min(...xs), b = Math.max(...xs); return [[a, fmtWhen(a, { day: 'numeric', month: 'short' })], [b, fmtWhen(b, { day: 'numeric', month: 'short' })]]; })() : [];
  const fcCardHtml = fcSeries.length ? `<div class="card"><h3>${icon('target')}${L('Прогнозата за матурата във времето')}</h3>${chLine(fcSeries, { yMin: 0, yMax: 100, yTicks: [0, 30, 41, 62.5, 84, 100], yFmt: v => ({ 30: '3', 41: '4', 62.5: '5', 84: '6' }[v] || fmtN(v)), xLabels: fcX, legend: true, label: L('Прогнозата за матурата във времето') })}<p class="muted small">${L('Линиите отбелязват прага за Среден 3, Добър 4, Мн. добър 5 и Отличен 6 по скалата на МОН.')}</p></div>` : '';
  /* the earlier Stats screen's matura cards, with their forecast rows */
  const tmp = document.createElement('div'); try { await _statsCards090(tmp); } catch (e) { }
  const cards = [...tmp.querySelectorAll('.statcard')].map(c => c.outerHTML).join('');
  const past = Object.entries(S.pastResults || {}).map(([id, r]) => ({ id, ...r, ex: (window.PAST_EXAMS_JSON || []).find(x => x.id === id) })).filter(x => x.ex).sort((a, b) => b.at - a.at).slice(0, 6);
  const pastCard = past.length ? `<div class="card"><h3>${icon('book')}${L('Изпити от минали години')}</h3>${chHBars(past.map(p => ({ label: p.ex.title || p.id, sub: p.at ? fmtDay(p.at) : '', value: p.pts / p.max, max: 1, color: gradeColor(2 + 4 * p.pts / p.max), right: `${fmtN(p.pts)}/${p.max}`, tip: `${fmtN(p.pts)} ${L('от')} ${p.max} ${L('т.')}` })), { min: 0, max: 1 })}</div>` : '';
  return `<div class="card st-rings"><h3>${icon('flame')}${L('Днес')}</h3>${rings}</div>${kpis}
    <div class="st-grid">
      <div class="card"><h3>${icon('calendar')}${L('Активни дни')}</h3>${chHeat(counts, { label: L('Активни дни') })}</div>
      <div class="card"><h3>${icon('chart')}${L('Последните 7 дни')}</h3>${chCols(act.week.map(w => ({ label: w.label, value: w.n, color: 'var(--ch-1)', tip: `${w.label}: ${w.n}` })), { label: L('Последните 7 дни'), h: 140 })}</div></div>
    ${weeks.length > 1 ? `<div class="card"><h3>${icon('check')}${L('Точност по седмици')}</h3>${chLine([{ name: L('верни'), pts: weeks.map(w => ({ x: w.x, y: w.y, tip: `${fmtWhen(w.a, { day: 'numeric', month: 'short' })}: ${fmtN(w.y)}% · ${w.n}` })), color: 'var(--ring-2)' }], { yMin: 0, yMax: 100, yFmt: v => fmtN(v) + '%', xLabels: [[weeks[0].x, fmtWhen(weeks[0].a, { day: 'numeric', month: 'short' })], [weeks[weeks.length - 1].x, L('тази седмица')]], label: L('Точност по седмици') })}</div>` : ''}
    ${fcCardHtml}<h2 class="sec-title">${L('По матури')}</h2>${cards}${pastCard}`;
}

/* ---------- Години ---------- */
function yearsTab() {
  const ys = yearsWithData();
  const rows = ys.map(y => ({ y, s: yearSuccess(y), p: S.years[y] || { ans: 0, ok: 0, days: 0, subj: {} }, abs: absTotal(y) }));
  const withGrades = rows.filter(r => r.s.v != null);
  if (!withGrades.length && !rows.some(r => r.p.ans)) return `<div class="card st-empty">${icon('calendar')}<h3>${L('Годините ти една до друга')}</h3><p class="muted">${L('Добави годишните си оценки от минали години и ще видиш как се развиваш — по предмети и общо.')}</p><button class="btn accent block" data-pastyears>${icon('plus')}${L('Годишни оценки от минали години')}</button></div>`;
  const cols = withGrades.length ? `<div class="card"><h3>${icon('trophy')}${L('Общ успех по години')}</h3>${chCols(withGrades.map(r => ({ label: r.y.slice(2), value: r.s.v - 2, cap: fmtG(r.s.v), color: gradeColor(r.s.v), tip: `${r.y}${gradeInYear(r.y) ? ' · ' + gradeInYear(r.y) : ''}: ${fmtG(r.s.v)} ${gradeWord(r.s.v)}` })), { max: 4, label: L('Общ успех по години') })}</div>` : '';
  /* each subject year by year (the four with the most grades), and who moved the most */
  const subs = subjectsIn(S.grades).slice(0, 4);
  const yIdx = y => ys.indexOf(y);
  const lines = withGrades.length > 1 ? `<div class="card"><h3>${icon('chart')}${L('Предметите през годините')}</h3>${chLine(subs.map(s => ({ name: shortSubj(s), color: subjColor(s), area: false, pts: withGrades.map(r => { const p = r.s.per.find(x => x.subj === s); return p ? { x: yIdx(r.y), y: p.v, tip: `${shortSubj(s)} · ${r.y}: ${fmtG(p.v)}` } : null; }).filter(Boolean) })), { yMin: 2, yMax: 6, yTicks: [2, 3, 4, 5, 6], xLabels: withGrades.map(r => [yIdx(r.y), r.y.slice(2)]), endLabel: false, legend: true, label: L('Предметите през годините') })}</div>` : '';
  let moves = '';
  if (withGrades.length > 1) {
    const first = withGrades[0], last = withGrades[withGrades.length - 1];
    const d = last.s.per.map(p => { const f = first.s.per.find(x => x.subj === p.subj); return f ? { subj: p.subj, from: f.v, to: p.v, d: p.v - f.v } : null; }).filter(Boolean).sort((a, b) => b.d - a.d);
    if (d.length) moves = `<div class="card"><h3>${icon('up')}${L('Най-голям напредък ({a} → {b})', { a: first.y, b: last.y })}</h3><div class="st-moves">${d.slice(0, 6).map(x => `<div class="st-move"><b>${esc(shortSubj(x.subj))}</b><span>${gradeChip(x.from, { small: true })}<i>→</i>${gradeChip(x.to, { small: true })}</span><em class="${x.d >= 0 ? 'up' : 'down'}">${x.d >= 0 ? '+' : '−'}${fmtG(Math.abs(x.d))}</em></div>`).join('')}</div></div>`;
  }
  const prac = rows.filter(r => r.p.ans);
  const pracCard = prac.length ? `<div class="card"><h3>${icon('target')}${L('Упражнения в BingO по години')}</h3>${chCols(prac.map(r => ({ label: r.y.slice(2), value: r.p.ans, color: 'var(--ch-1)', tip: `${r.y}: ${r.p.ans} ${L('отговора')} · ${pct(r.p.ans ? r.p.ok / r.p.ans : null)} ${L('верни')} · ${r.p.days} ${L('дни')}` })), { label: L('Упражнения в BingO по години') })}</div>` : '';
  const table = `<div class="card st-ytable"><h3>${icon('grid')}${L('Година по година')}</h3><div class="t-table"><table><thead><tr><th>${L('Година')}</th><th>${L('Успех')}</th><th>${L('Оценки')}</th><th>${L('Отсъствия')}</th><th>${L('Задачи в BingO')}</th><th>${L('Верни')}</th></tr></thead><tbody>
    ${rows.slice().reverse().map((r, i, a) => { const pr = a[i + 1], dd = pr && r.s.v != null && pr.s.v != null ? r.s.v - pr.s.v : null; return `<tr><td><b>${esc(r.y)}</b><small class="muted">${esc(gradeInYear(r.y))}</small></td><td>${r.s.v != null ? gradeChip(Math.round(r.s.v * 100) / 100, { small: true }) : '–'}${dd != null ? `<small class="st-dd ${dd >= 0 ? 'up' : 'down'}">${dd >= 0 ? '▲' : '▼'}${fmtG(Math.abs(dd))}</small>` : ''}</td><td>${r.s.n || '–'}</td><td>${r.abs || '–'}</td><td>${r.p.ans || '–'}</td><td>${r.p.ans ? pct(r.p.ok / r.p.ans) : '–'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  return `${cols}${moves}${lines}${pracCard}${table}<button class="btn ghost block" data-pastyears>${icon('plus')}${L('Годишни оценки от минали години')}</button>`;
}

/* ---------- one subject: every grade, every year ---------- */
function subjSheet(subj) {
  const all = gradesOf({ subj }).sort((a, b) => a.at - b.at);
  const ys = [...new Set(all.map(g => g.year))].sort();
  const perYear = ys.map(y => ({ y, v: subjYearAvg(all.filter(g => g.year === y)) })).filter(x => x.v != null);
  const cur = all.filter(g => !isFinal(g));
  const line = cur.length > 1 ? chLine([{ name: shortSubj(subj), color: subjColor(subj), pts: cur.map(g => ({ x: g.at, y: g.v, tip: `${fmtDay(g.at)} · ${kindLabel(g.kind)}: ${fmtG(g.v)}${g.title ? ' · ' + g.title : ''}` })) }], { yMin: 2, yMax: 6, yTicks: [2, 3, 4, 5, 6], xLabels: [[cur[0].at, fmtWhen(cur[0].at, { month: 'short', year: '2-digit' })], [cur[cur.length - 1].at, fmtWhen(cur[cur.length - 1].at, { month: 'short', year: '2-digit' })]], endLabel: false, label: subj }) : '';
  return sheet({ title: subj, wide: true, body: `
    ${perYear.length ? `<div class="st-sy">${perYear.map(x => `<div><small>${esc(x.y)}</small>${gradeChip(Math.round(x.v * 100) / 100)}</div>`).join('')}</div>` : ''}
    ${line}
    ${ys.slice().reverse().map(y => `<h4 class="stat-sub">${esc(y)}</h4><div class="st-glist">${all.filter(g => g.year === y).slice().reverse().map(g => `<button class="st-gi" data-gi="${esc(g.id)}">${gradeChip(g.v, { term: isFinal(g) })}<span><b>${esc(g.title || kindLabel(g.kind))}</b><small class="muted">${esc(kindLabel(g.kind))} · ${g.term ? (g.term === 1 ? L('I срок') : L('II срок')) + ' · ' : ''}${fmtDay(g.at)}${g.src === 'bingo' ? ' · BingO' : ''}</small></span></button>`).join('')}</div>`).join('')}`,
    actions: [{ id: 'add', label: L('Добави оценка'), icon: 'plus' }, { id: 'x', label: L('Готово'), kind: 'primary' }],
    onMount: (sh, o) => sh.addEventListener('click', e => { const g = e.target.closest('[data-gi]'); if (g) { o.close('edit:' + g.dataset.gi); } })
  }).then(v => v === 'add' ? gradeSheet({ subj, year: STATS_UI.year || curYear() }) : v && v.startsWith('edit:') ? gradeSheet({ id: v.slice(5) }) : false);
}

/* ---------- adding and changing a grade ---------- */
function subjOptions() { const used = subjectsIn(S.grades); return [...new Set([...used, ...SCHOOL_SUBJECTS])].map(s => `<option value="${esc(s)}">`).join(''); }
function yearOptions(sel) { const c = +curYear().slice(0, 4); return Array.from({ length: 8 }, (_, i) => `${c - i}/${String(c - i + 1).slice(-2)}`).map(y => `<option value="${y}" ${y === sel ? 'selected' : ''}>${y}${gradeInYear(y) ? ' · ' + gradeInYear(y) : ''}</option>`).join(''); }
function gradeSheet({ id, subj = '', year } = {}) {
  ensureAnalytics();
  const g0 = id ? S.grades.find(g => g.id === id) : null;
  if (id && !g0) return Promise.resolve(false);
  const ro = g0 && g0.src === 'bingo';
  const st = { v: g0 ? g0.v : 6, kind: g0 ? g0.kind : 'cur', subj: g0 ? g0.subj : subj, year: g0 ? g0.year : year || curYear(), term: g0 ? g0.term : 0, at: g0 ? g0.at : Date.now(), note: g0 ? g0.note : '' };
  if (!g0 && st.year !== curYear()) { st.at = yearEnd(st.year) - 30 * 864e5; }
  const dayInput = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  return sheet({ title: ro ? L('Оценка от BingO') : g0 ? L('Промени оценката') : L('Нова оценка'), body: ro ? `<div class="st-ro">${gradeChip(g0.v)}<div><b>${esc(g0.title || '')}</b><p class="muted">${esc(g0.subj)} · ${fmtDay(g0.at)}${g0.pct != null ? ' · ' + pct(g0.pct) : ''}</p>${g0.note ? `<p>${esc(g0.note)}</p>` : ''}<small class="muted">${L('Тази оценка идва от теста в BingO и се променя само от учителя.')}</small></div></div>` : `
    <label class="fld"><span>${L('Предмет')}</span><input class="field" data-gf="subj" list="st-subjs" value="${esc(st.subj)}" placeholder="${L('напр. Математика')}" autocomplete="off"><datalist id="st-subjs">${subjOptions()}</datalist></label>
    <div class="st-gpick">${[2, 3, 4, 5, 6].map(v => `<button data-gv="${v}" class="${Math.round(st.v) === v ? 'on' : ''}" style="--gc:${GRADE_VARS[v]}"><b>${v}</b><small>${L(EDU_GRADE_NAMES[v])}</small></button>`).join('')}</div>
    <label class="fld"><span>${L('Вид')}</span><select class="field" data-gf="kind">${GRADE_KINDS.filter(k => k[0] !== 'bingo').map(([k, l]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${L(l)}</option>`).join('')}</select></label>
    <div class="t-inline"><label class="fld"><span>${L('Учебна година')}</span><select class="field" data-gf="year">${yearOptions(st.year)}</select></label>
      <label class="fld" data-dayfld><span>${L('Дата')}</span><input class="field" type="date" data-gf="at" value="${dayInput(st.at)}"></label>
      <label class="fld" data-termfld hidden><span>${L('Срок')}</span><select class="field" data-gf="term"><option value="1">${L('I срок')}</option><option value="2">${L('II срок')}</option></select></label></div>
    <label class="fld"><span>${L('Бележка (по желание)')}</span><input class="field" data-gf="note" value="${esc(st.note)}" maxlength="200"></label>`,
    actions: ro ? [{ id: 'x', label: L('Затвори'), kind: 'primary' }] : [...(g0 ? [{ id: 'del', label: L('Изтрий'), icon: 'trash' }] : []), { id: 'x', label: L('Отказ') }, { id: 'ok', label: L('Запази'), kind: 'primary' }],
    onMount: (sh, o) => {
      if (ro) return;
      const v = k => sh.querySelector(`[data-gf="${k}"]`);
      const kindUi = () => { const k = v('kind').value; sh.querySelector('[data-dayfld]').hidden = k === 'term' || k === 'year'; sh.querySelector('[data-termfld]').hidden = k !== 'term'; };
      if (st.term) v('term').value = String(st.term);
      kindUi(); v('kind').addEventListener('change', kindUi);
      v('year').addEventListener('change', () => { const yk = v('year').value, t = fromDayInput(v('at').value); if (schoolYearOf(t) !== yk) v('at').value = dayInput(Math.min(Date.now(), yearEnd(yk) - 30 * 864e5)); });
      sh.addEventListener('click', e => { const b = e.target.closest('[data-gv]'); if (b) { st.v = +b.dataset.gv; sh.querySelectorAll('[data-gv]').forEach(x => x.classList.toggle('on', x === b)); } });
      const ok = sh.querySelector('[data-act="ok"]');
      ok.addEventListener('click', ev => {
        ev.stopPropagation();
        const subjV = normSubj(v('subj').value); if (!subjV) { v('subj').focus(); return toast(L('Напиши предмета'), 'bad'); }
        const kind = v('kind').value, yk = v('year').value;
        let at = kind === 'year' ? yearEnd(yk) - 864e5 : kind === 'term' ? (v('term').value === '1' ? new Date(+yk.slice(0, 4) + 1, 0, 31).getTime() : yearEnd(yk) - 864e5) : fromDayInput(v('at').value) || Date.now();
        if (kind !== 'term' && kind !== 'year' && schoolYearOf(at) !== yk) at = Math.min(Date.now(), yearEnd(yk) - 30 * 864e5);
        const term = kind === 'year' ? 0 : kind === 'term' ? +v('term').value : termOf(at);
        if ((kind === 'term' || kind === 'year') && S.grades.some(g => g !== g0 && g.subj === subjV && g.year === yk && g.kind === kind && (kind === 'year' || g.term === term))) return toast(kind === 'year' ? L('Годишната оценка по този предмет вече е въведена') : L('Срочната оценка по този предмет вече е въведена'), 'bad');
        const ng = cleanGrade({ id: g0 ? g0.id : 'm' + uid(), subj: subjV, v: st.v, kind, year: yk, term, at, note: v('note').value, src: 'manual' });
        if (g0) Object.assign(g0, ng); else S.grades.push(ng);
        STATS_UI.year = yk; saveState(); toast(L('Запазено')); o.close('saved');
      }, true);
      const del = sh.querySelector('[data-act="del"]');
      if (del) del.addEventListener('click', ev => { ev.stopPropagation(); S.grades.splice(S.grades.indexOf(g0), 1); saveState(); toast(L('Оценката е изтрита')); o.close('saved'); }, true);
    }
  }).then(r => r === 'saved');
}
const fromDayInput = v => { if (!v) return null; const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };

/* many grades at once: one subject per line, as copied from the school diary ("Математика: 5 6 4") */
function bulkSheet(year) {
  return sheet({ title: L('Много наведнъж'), wide: true, body: `<p class="muted small">${L('По един предмет на ред: името, двоеточие и оценките. Например:')}</p><pre class="st-pre">Математика: 5 6 4 6\nБЕЛ: 6, 5, 6\nАнглийски език: 6 6</pre>
    <div class="t-inline"><label class="fld"><span>${L('Учебна година')}</span><select class="field" data-b="year">${yearOptions(year)}</select></label><label class="fld"><span>${L('Срок')}</span><select class="field" data-b="term"><option value="1">${L('I срок')}</option><option value="2" ${termOf(Date.now()) === 2 ? 'selected' : ''}>${L('II срок')}</option></select></label>
      <label class="fld"><span>${L('Вид')}</span><select class="field" data-b="kind"><option value="cur">${L('Текуща')}</option><option value="term">${L('Срочна')}</option><option value="year">${L('Годишна')}</option></select></label></div>
    <textarea class="field" rows="7" data-b="text" placeholder="Математика: 5 6 4"></textarea>`,
    actions: [{ id: 'x', label: L('Отказ') }, { id: 'ok', label: L('Добави'), kind: 'primary' }],
    onMount: (sh, o) => {
      sh.querySelector('[data-act="ok"]').addEventListener('click', ev => {
        ev.stopPropagation();
        const v = k => sh.querySelector(`[data-b="${k}"]`).value, yk = v('year'), term = +v('term'), kind = v('kind');
        const parsed = parseBulkGrades(v('text'));
        if (!parsed.length) return toast(L('Не намерих оценки — пиши „Предмет: 5 6 4“'), 'bad');
        const base = kind === 'year' ? yearEnd(yk) - 864e5 : term === 1 ? new Date(+yk.slice(0, 4), 9, 1).getTime() : new Date(+yk.slice(0, 4) + 1, 1, 15).getTime();
        const span = term === 1 ? 110 : 120; let n = 0;
        for (const { subj, vals } of parsed) vals.forEach((gv, i) => {
          const at = kind === 'cur' ? Math.min(Date.now(), base + Math.round((i + 1) / (vals.length + 1) * span) * 864e5) : base;
          const g = cleanGrade({ id: 'm' + uid(), subj, v: gv, kind, year: yk, term: kind === 'year' ? 0 : term, at, src: 'manual' }); if (g) { S.grades.push(g); n++; }
        });
        STATS_UI.year = yk; saveState(); toast(L('Добавени {n} оценки', { n })); o.close('saved');
      }, true);
    } }).then(r => r === 'saved');
}
function parseBulkGrades(text) {
  return String(text || '').split(/\n+/).map(line => {
    const m = line.match(/^\s*([^:\d–—-][^:–—]*?)\s*[:–—-]\s*(.+)$/); if (!m) return null;
    const vals = (m[2].match(/[2-6](?:[.,]\d{1,2})?/g) || []).map(x => +x.replace(',', '.')).filter(x => x >= 2 && x <= 6);
    const subj = normSubj(m[1]); return subj && vals.length ? { subj, vals } : null;
  }).filter(Boolean);
}
/* the year grades of past years, all subjects on one sheet */
function yearGradesSheet() {
  const c = +curYear().slice(0, 4), def = `${c - 1}/${String(c).slice(-2)}`;
  const subs = [...new Set([...subjectsIn(S.grades), ...SCHOOL_SUBJECTS.slice(0, 11)])];
  const rowsFor = yk => subs.map(s => { const g = S.grades.find(x => x.subj === s && x.year === yk && x.kind === 'year'); return `<div class="st-yg"><b>${esc(shortSubj(s))}</b><div class="st-ygp" data-ys="${esc(s)}">${[2, 3, 4, 5, 6].map(v => `<button data-yv="${v}" class="${g && Math.round(g.v) === v ? 'on' : ''}" style="--gc:${GRADE_VARS[v]}">${v}</button>`).join('')}</div></div>`; }).join('');
  return sheet({ title: L('Годишни оценки'), wide: true, body: `<label class="fld"><span>${L('Учебна година')}</span><select class="field" data-yy>${yearOptions(def)}</select></label><div class="st-ygrid">${rowsFor(def)}</div>`,
    actions: [{ id: 'x', label: L('Отказ') }, { id: 'ok', label: L('Запази'), kind: 'primary' }],
    onMount: (sh, o) => {
      const yy = sh.querySelector('[data-yy]');
      yy.addEventListener('change', () => { sh.querySelector('.st-ygrid').innerHTML = rowsFor(yy.value); });
      sh.addEventListener('click', e => { const b = e.target.closest('[data-yv]'); if (b) { const was = b.classList.contains('on'); b.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('on')); if (!was) b.classList.add('on'); } });
      sh.querySelector('[data-act="ok"]').addEventListener('click', ev => {
        ev.stopPropagation(); const yk = yy.value; let n = 0;
        sh.querySelectorAll('[data-ys]').forEach(r => {
          const s = r.dataset.ys, on = r.querySelector('.on'), old = S.grades.find(x => x.subj === s && x.year === yk && x.kind === 'year');
          if (!on) { if (old) S.grades.splice(S.grades.indexOf(old), 1); return; }
          if (old) old.v = +on.dataset.yv; else S.grades.push(cleanGrade({ id: 'm' + uid(), subj: s, v: +on.dataset.yv, kind: 'year', year: yk, term: 0, at: yearEnd(yk) - 864e5, src: 'manual' }));
          n++;
        });
        STATS_UI.year = yk; saveState(); toast(L('Запазени {n} годишни оценки за {y}', { n, y: yk })); o.close('saved');
      }, true);
    } }).then(r => r === 'saved');
}
