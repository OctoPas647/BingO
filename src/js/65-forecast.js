/* ================= Прогнозиран резултат =================
   Expected matura points out of 100 = the weighted mastery of the skills in the app (BKT, see 51-skills.js).
   The range gets narrower with every answer. The grade comes from the official MON scale
   (one scale for DZI and NVO since 2022). Honest limit: the app only sees its own skills, not the whole exam. */

/* Official MON scale for DZI (and used as a guide for NVO since 2022).
   Each band: minimum points, grade label, inclusive upper bound (null = 100). */
const MON_SCALE = [
  { min: 0, max: 29.75, grade: 'Слаб 2', label: '2' },
  { min: 30, max: 40.5, grade: 'Среден 3', label: '3' },
  { min: 40.75, max: 62.25, grade: 'Добър 4', label: '4' },
  { min: 62.5, max: 83.75, grade: 'Мн. добър 5', label: '5' },
  { min: 84, max: 94.75, grade: 'Мн. добър 5', label: '5' },
  { min: 95, max: 100, grade: 'Отличен 6', label: '6' }
];
const gradeOf = pts => { const b = MON_SCALE.find(x => pts >= x.min && pts <= x.max); return [b.min, L(b.grade)]; };
const nextGrade = pts => {
  const bands = [];
  for (const b of MON_SCALE) if (!bands.some(x => x.min === b.min)) bands.push(b);
  const nx = bands.find(x => x.min > pts);
  return nx ? [nx.min, L(nx.grade)] : null;
};
const r0 = x => Math.round(x);
const CONF_LABEL = { low: 'Малко данни — диапазонът е широк, оценка още не показваме', mid: 'Средна сигурност', high: 'Добра сигурност' };

function forecast(subj) {
  const sm = subjectSummary(subj);
  if (!sm.answered) return null;
  const n = sm.list.length, pts = 100 * sum(sm.list.map(x => x.sk.weight * x.st.p)) / sm.total;
  const margin = clamp(40 / Math.sqrt(sm.answered + 1), 4, 20);
  /* one answer per skill (the diagnostic) is not enough to name a grade: a single lucky guess moves a skill a lot */
  const conf = sm.answered < 2 * n || sm.list.some(x => x.st.n < 1) ? 'low' : sm.answered < 4 * n ? 'mid' : 'high';
  const gains = sm.list.filter(x => x.status !== 'strong')
    .map(x => ({ name: x.sk.name, gain: (Math.max(BKT.strong, x.st.p) - x.st.p) * x.sk.weight / sm.total * 100 }))
    .sort((a, b) => b.gain - a.gain).slice(0, 3);
  return { sm, n, pts, lo: clamp(pts - margin, 0, 100), hi: clamp(pts + margin, 0, 100), conf, gains, measured: sm.list.filter(x => x.st.n >= 1).length };
}
const gradeText = f => { if (f.conf === 'low') return L('Оценка — след още няколко отговора'); const a = gradeOf(f.lo)[1], b = gradeOf(f.hi)[1]; return a === b ? a : a + ' – ' + b; };

function fcScale(f) {
  const ticks = MON_SCALE.map(b => [b.min, b.label]).filter(([v], i, a) => a.findIndex(x => x[0] === v) === i);
  const stops = MON_SCALE.map((b, i) => {
    const color = i < 1 ? 'var(--bad-bg)' : b.min < 95 ? 'var(--meh-bg)' : 'var(--good-bg)';
    const start = i ? MON_SCALE[i - 1].max + 0.25 : 0;
    return `${color} ${start}% ${b.max}%`;
  }).join(', ');
  return `<div class="fcscale"><div class="fctrack" style="background:linear-gradient(90deg,${stops})"><i class="fcband" style="left:${f.lo}%;width:${f.hi - f.lo}%"></i><b class="fcdot" style="left:${f.pts}%"></b></div>
    <div class="fcticks">${ticks.map(([v, l]) => `<span style="left:${v}%">${l}</span>`).join('')}</div></div>`;
}

function fcCard(subj) {
  const sub = SUBJECTS[subj], f = forecast(subj);
  if (!f) return `<div class="card forecast empty"><span class="kicker">${L('Прогнозен резултат · {s}', { s: esc(L(sub.title)) })}</span><p class="muted">${L('Направи диагностика и ще видиш колко точки очакваш на матурата.')}</p></div>`;
  return `<button class="card forecast" data-forecast="${subj}">
    <span class="kicker">${L('Прогнозен резултат · {s}', { s: esc(L(sub.title)) })}</span>
    <div class="fc-score"><b>≈ ${r0(f.pts)}</b><span>${L('от 100 т.')}</span></div>
    <div class="fc-grade">${esc(gradeText(f))}</div>
    ${fcScale(f)}
    <small class="muted">${L('Диапазон {a}–{b} т. · {c} · натисни за подробности', { a: r0(f.lo), b: r0(f.hi), c: L(CONF_LABEL[f.conf]) })}</small></button>`;
}

function fcSheet(subj) {
  const sub = SUBJECTS[subj], f = forecast(subj); if (!f) return;
  const nx = nextGrade(f.pts);
  const scaleRows = MON_SCALE.map(b => [L(b.grade), b.max >= 100 ? L('{a}–100 т.', { a: fmtNum(b.min, appLang(), b.min % 1 ? 2 : 0) }) : L('{a}–{b} т.', { a: fmtNum(b.min, appLang(), b.min % 1 ? 2 : 0), b: fmtNum(b.max, appLang(), b.max % 1 ? 2 : 0) })]);
  sheet({
    title: L('Прогноза · {s}', { s: L(sub.title) }),
    body: `<div class="fc-detail">
      <p class="fc-big">${L('<b>≈ {n} т.</b> от 100 <span class="muted">(най-вероятно между {a} и {b})</span>', { n: r0(f.pts), a: r0(f.lo), b: r0(f.hi) })}</p>
      ${f.conf === 'low' ? `<p class="muted">${L('Още е рано за оценка: имаш {a} отговора в {b} теми. След още няколко тренировки прогнозата ще покаже и оценка.', { a: f.sm.answered, b: f.n })}</p>` : `<p><span class="stchip s-mid">${esc(gradeOf(f.pts)[1])}</span> ${nx ? L('До <b>{g}</b> ти трябват още ≈ <b>{n} т.</b>', { g: esc(nx[1]), n: Math.max(1, Math.ceil(nx[0] - f.pts)) }) : L('Това е най-високата оценка.')}</p>`}
      ${f.gains.length ? `<h3>${L('Къде се печелят най-бързо точки')}</h3><ul class="misclist gains">${f.gains.map(g => `<li><span>${esc(L(g.name))}</span><b>+${ptsL(fmt1(g.gain))}</b></li>`).join('')}</ul><p class="muted small">${L('Ако темата стане силна (≥ 90%).')}</p>` : ''}
      <h3>${L('Скала за оценяване (МОН)')}</h3>
      <ul class="misclist scale">${scaleRows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
      <p class="muted small">${L('Официалната скала на МОН за ДЗИ преобразува точките в оценка на стъпки от 0,25 т. Прогнозата е ориентировъчна: тя се смята от владеенето на {n} теми в приложението ({m} вече са измерени) и не вижда останалата част от изпита, напр. писането на есе или съчинение. Повече отговори дават по-тесен диапазон. Тежестите на темите са приблизителни.', { n: f.n, m: f.measured })}</p></div>`,
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
    if (f && head) head.insertAdjacentHTML('afterend', `<button class="fcrow" data-forecast="${ids[i]}"><span>${L('Прогноза')}</span><b>≈ ${ptsL(r0(f.pts))}</b><em>${esc(gradeText(f))}</em></button>`);
  });
  bindForecast(el);
};
