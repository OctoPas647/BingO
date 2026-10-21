/* ================= Прогнозиран резултат =================
   Expected matura points out of 100 = the weighted mastery of the skills in the app (BKT, see 51-skills.js).
   The range gets narrower with every answer. The grade comes from the official MON scale
   (one scale for DZI and NVO since 2022). Honest limit: the app only sees its own skills, not the whole exam. */

const GRADES = [[84, 'Отличен 6'], [62.5, 'Мн. добър 5'], [41, 'Добър 4'], [30, 'Среден 3'], [0, 'Слаб 2']];
const gradeOf = pts => GRADES.find(g => pts >= g[0]);
const nextGrade = pts => [...GRADES].reverse().find(g => g[0] > pts) || null;
const r0 = x => Math.round(x);
const CONF_LABEL = { low: 'Малко данни — диапазонът е широк', mid: 'Средна сигурност', high: 'Добра сигурност' };

function forecast(subj) {
  const sm = subjectSummary(subj);
  if (!sm.answered) return null;
  const n = sm.list.length, pts = 100 * sum(sm.list.map(x => x.sk.weight * x.st.p)) / sm.total;
  const margin = clamp(40 / Math.sqrt(sm.answered + 1), 4, 20);
  const conf = sm.answered < n ? 'low' : sm.answered < 3 * n ? 'mid' : 'high';
  const gains = sm.list.filter(x => x.status !== 'strong')
    .map(x => ({ name: x.sk.name, gain: (Math.max(BKT.strong, x.st.p) - x.st.p) * x.sk.weight / sm.total * 100 }))
    .sort((a, b) => b.gain - a.gain).slice(0, 3);
  return { sm, n, pts, lo: clamp(pts - margin, 0, 100), hi: clamp(pts + margin, 0, 100), conf, gains, measured: sm.list.filter(x => x.st.n >= 1).length };
}
const gradeText = f => { const a = gradeOf(f.lo)[1], b = gradeOf(f.hi)[1]; return a === b ? a : a + ' – ' + b; };

function fcScale(f) {
  const ticks = [[30, '3'], [41, '4'], [62.5, '5'], [84, '6']];
  return `<div class="fcscale"><div class="fctrack"><i class="fcband" style="left:${f.lo}%;width:${f.hi - f.lo}%"></i><b class="fcdot" style="left:${f.pts}%"></b></div>
    <div class="fcticks">${ticks.map(([v, l]) => `<span style="left:${v}%">${l}</span>`).join('')}</div></div>`;
}

function fcCard(subj) {
  const sub = SUBJECTS[subj], f = forecast(subj);
  if (!f) return `<div class="card forecast empty"><span class="kicker">Прогнозен резултат · ${esc(sub.title)}</span><p class="muted">Направи диагностика и ще видиш колко точки очакваш на матурата.</p></div>`;
  return `<button class="card forecast" data-forecast="${subj}">
    <span class="kicker">Прогнозен резултат · ${esc(sub.title)}</span>
    <div class="fc-score"><b>≈ ${r0(f.pts)}</b><span>от 100 т.</span></div>
    <div class="fc-grade">${esc(gradeText(f))}</div>
    ${fcScale(f)}
    <small class="muted">Диапазон ${r0(f.lo)}–${r0(f.hi)} т. · ${CONF_LABEL[f.conf]} · натисни за подробности</small></button>`;
}

function fcSheet(subj) {
  const sub = SUBJECTS[subj], f = forecast(subj); if (!f) return;
  const nx = nextGrade(f.pts);
  const scaleRows = [['Слаб 2', 'под 30 т.'], ['Среден 3', 'от 30 т.'], ['Добър 4', 'от 41 т.'], ['Мн. добър 5', 'от 62,5 т.'], ['Отличен 6', 'от 84 т.']];
  sheet({
    title: 'Прогноза · ' + sub.title,
    body: `<div class="fc-detail">
      <p class="fc-big"><b>≈ ${r0(f.pts)} т.</b> от 100 <span class="muted">(най-вероятно между ${r0(f.lo)} и ${r0(f.hi)})</span></p>
      <p><span class="stchip s-mid">${esc(gradeOf(f.pts)[1])}</span> ${nx ? `До <b>${esc(nx[1])}</b> ти трябват още ≈ <b>${Math.max(1, Math.ceil(nx[0] - f.pts))} т.</b>` : 'Това е най-високата оценка.'}</p>
      ${f.gains.length ? `<h3>Къде се печелят най-бързо точки</h3><ul class="misclist gains">${f.gains.map(g => `<li><span>${esc(g.name)}</span><b>+${fmt1(g.gain)} т.</b></li>`).join('')}</ul><p class="muted small">Ако темата стане силна (≥ 90%).</p>` : ''}
      <h3>Скала за оценяване (МОН)</h3>
      <ul class="misclist scale">${scaleRows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
      <p class="muted small">Прогнозата е ориентировъчна. Тя се смята от владеенето на ${f.n} теми в приложението (${f.measured} вече са измерени) и не вижда останалата част от изпита, напр. писането на есе или съчинение. Повече отговори дават по-тесен диапазон. Тежестите на темите са приблизителни.</p></div>`,
    actions: [{ id: 'x', label: 'Затвори' }, { id: 'go', label: 'Тренирай слабото', kind: 'primary', icon: 'target' }]
  }).then(v => { if (v === 'go') go('session', { subj, mode: 'focus' }); });
}

const bindForecast = el => el.addEventListener('click', e => { const f = e.target.closest('[data-forecast]'); if (f) fcSheet(f.dataset.forecast); });

/* the forecast card on Home, under the "where you lose points" card */
const _homeBase = SCREENS.home;
SCREENS.home = async (el, ...rest) => {
  await _homeBase(el, ...rest);
  const lc = el.querySelector('.losscard');
  if (lc) lc.insertAdjacentHTML('afterend', fcCard(S.subject));
  bindForecast(el);
};

/* a forecast row in each matura card on Stats (cards come in the order of SUBJECTS) */
const _statsBase = SCREENS.stats;
SCREENS.stats = async (el, ...rest) => {
  await _statsBase(el, ...rest);
  const ids = Object.keys(SUBJECTS);
  el.querySelectorAll('.statcard').forEach((c, i) => {
    const f = ids[i] && forecast(ids[i]), head = c.querySelector('.stat-head');
    if (f && head) head.insertAdjacentHTML('afterend', `<button class="fcrow" data-forecast="${ids[i]}"><span>Прогноза</span><b>≈ ${r0(f.pts)} т.</b><em>${esc(gradeText(f))}</em></button>`);
  });
  bindForecast(el);
};
