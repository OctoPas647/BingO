/* ================= Home: the skill map — where the matura points are lost ================= */
const fmt1 = x => fmtNum(roundTo(x, 1), 'bg', 1);
const pctTxt = p => Math.round(p * 100) + '%';
const SRC_LABEL = { gen: 'Нов вариант', shelly: 'От Shelly', bank: 'Банка задачи', ai: 'Създадена от ИИ' };

function subjectTabs(cur) {
  return `<label class="subj-pick"><span class="kicker">Предмет за матура</span><span class="selwrap"><select class="field subj-select" id="subjSelect" aria-label="Избери предмет за матура">${Object.values(SUBJECTS).map(s => `<option value="${s.id}"${s.id === cur ? ' selected' : ''}>${s.icon} ${esc(s.title)}</option>`).join('')}</select></span></label>`;
}

function skillRow(subj, x) {
  const top = Object.entries(x.st.misc).sort((a, b) => b[1] - a[1])[0];
  return `<button class="skrow st-${x.status}" data-skill="${x.sk.id}">
    <div class="sk-main"><b>${esc(x.sk.name)}</b>
      <div class="sk-bar">${bar(x.st.p, 'm-' + x.status)}</div>
      <small>${x.status === 'strong' ? 'Не се повтаря · ' + reviewLabel(subj + '.' + x.sk.id, x.st.last) : x.st.n ? (top ? 'Честа грешка: ' + esc(plainMisc(top[0])) : `${x.st.ok} от ${x.st.n} верни`) : 'Още не е измерено'}</small></div>
    <div class="sk-side"><span class="stchip s-${x.status}">${STATUS_LABEL[x.status]}</span><span class="lost">${x.status === 'strong' ? '✓' : '−' + fmt1(x.lost) + ' т.'}</span></div></button>`;
}
const plainMisc = code => miscLabel(code).replace(/\$([^$]*)\$/g, '$1').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2').replace(/\\/g, '');

SCREENS.home = async el => {
  const subj = S.subject, sm = subjectSummary(subj), sub = SUBJECTS[subj];
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color));
  const list = sm.list.slice().sort((a, b) => (a.status === 'strong') - (b.status === 'strong') || b.lost - a.lost);
  const kept = 1 - sm.lost / sm.total, started = sm.answered > 0;
  const weakest = list.find(x => x.status !== 'strong');
  el.innerHTML = `
    <header class="apphead">
      <div class="brand bingo">Bing<span>O</span></div>
      <div class="head-stats">
        <span class="pill" title="Отговори досега">${icon('check')}${S.log.length}</span>
        <button class="iconbtn" data-go="insights" aria-label="Грешки и данни">${icon('grid')}</button>
        <button class="iconbtn" data-go="settings" aria-label="Настройки">${icon('settings')}</button>
      </div>
    </header>
    <section class="pad">
      ${subjectTabs(subj)}
      <div class="card losscard">
        ${ring(started ? kept : 0, started ? '−' + fmt1(sm.lost) : '?', 'big')}
        <div><span class="kicker">Матура · ${esc(sub.title)}</span>
          ${started ? `<h1>Губиш ≈ ${fmt1(sm.lost)} от ${sm.total} т.</h1><p class="muted">в тези теми на ДЗИ. Тренираме само там, където губиш най-много — силното не го повтаряме.</p>`
            : `<h1>Къде губиш точки?</h1><p class="muted">Кратка диагностика (≈5 мин): по една задача за всяка тема. После тренираш само слабото.</p>`}
        </div>
      </div>
      ${started ? `<button class="btn accent big block" data-start="focus">${icon('target')}Тренирай слабото · 8 задачи</button>
        ${weakest ? `<p class="muted small center">Започваме от <b>${esc(weakest.sk.name)}</b> — там губиш най-много.</p>` : `<p class="muted small center">Всички теми са силни. Направи пробна матура в Shelly!</p>`}`
        : `<button class="btn accent big block" data-start="diag">${icon('play')}Започни диагностика</button>
           <button class="btn ghost block demo-btn" data-demo>${icon('eye')}Покажи с демо ученик</button>`}
      <h2 class="sec-title">Карта на уменията</h2>
      <div class="sklist">${list.map(x => skillRow(subj, x)).join('')}</div>
      ${started ? `<button class="btn ghost block" data-start="diag">${icon('reset')}Нова диагностика</button>` : ''}
      <p class="muted small center foot">${aiOn() ? '✦ Gemini е включен' : 'Без ИИ · включи Gemini в настройките'} · ${S.settings.sheetUrl ? 'данните отиват в Google Sheets' : 'данните остават на устройството'}</p>
    </section>`;
  el.onchange = e => {
    const s = e.target.closest('#subjSelect'); if (s && SUBJECTS[s.value]) { S.subject = s.value; saveState(); return refresh(); }
  };
  el.addEventListener('click', async e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    const st = e.target.closest('[data-start]'); if (st) return go('session', { subj, mode: st.dataset.start });
    if (e.target.closest('[data-demo]')) { simulateLearner(); toast('Зареден е демо ученик с история от 6 дни'); return refresh(); }
    const k = e.target.closest('[data-skill]'); if (k) return skillSheet(subj, k.dataset.skill);
  });
};

/* A skill in detail: how sure we are, the mistakes, and a button to train only it */
function skillSheet(subj, id) {
  const sk = skillDef(subj, id), st = skillState(subj, id), status = skillStatus(st);
  const miscs = Object.entries(st.misc).sort((a, b) => b[1] - a[1]);
  const spark = st.hist.length > 1 ? sparkline(st.hist.map(h => h[1])) : '';
  sheet({
    title: sk.name, body: `<div class="sk-detail">
      <p><span class="stchip s-${status}">${STATUS_LABEL[status]}</span> Овладяно ≈ <b>${pctTxt(st.p)}</b> · ${st.ok}/${st.n} верни · губиш ≈ <b>${fmt1(pointsLost(sk, st))}</b> от ${sk.weight} т.</p>
      ${spark ? `<div class="spark">${spark}<small class="muted">как се променя увереността с всеки отговор</small></div>` : ''}
      ${miscs.length ? `<h3>Твоите типични грешки</h3><ul class="misclist">${miscs.map(([k, n]) => `<li><span class="rt">${richInline(miscLabel(k))}</span><b>×${n}</b></li>`).join('')}</ul>` : '<p class="muted">Още няма грешки в тази тема.</p>'}
      <p class="muted small">„Овладяно“ е вероятността да решиш вярно нова задача от темата (Bayesian Knowledge Tracing). Тежестта ${sk.weight} т. е приблизителна оценка за демото.</p></div>`,
    actions: [{ id: 'x', label: 'Затвори' }, { id: 'go', label: 'Тренирай само това', kind: 'primary', icon: 'target' }]
  }).then(v => { if (v === 'go') go('session', { subj, mode: 'skill', skill: id }); });
}
function sparkline(vals) {
  const w = 280, hgt = 54, n = vals.length, x = i => 4 + i * (w - 8) / Math.max(1, n - 1), y = v => hgt - 4 - v * (hgt - 8);
  const pts = vals.map((v, i) => `${roundTo(x(i), 1)},${roundTo(y(v), 1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${hgt}" class="sparksvg" aria-hidden="true"><line x1="0" x2="${w}" y1="${y(BKT.strong)}" y2="${y(BKT.strong)}" class="sp-strong"/><line x1="0" x2="${w}" y1="${y(BKT.weak)}" y2="${y(BKT.weak)}" class="sp-weak"/><polyline points="${pts}" class="sp-line"/><circle cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="4" class="sp-dot"/></svg>`;
}
