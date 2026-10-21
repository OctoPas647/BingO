/* ================= Mistakes and data: typical mistakes, Gemini week plan, Sheets / Looker Studio ================= */
SCREENS.insights = async el => {
  const subj = S.subject, sm = subjectSummary(subj), sub = SUBJECTS[subj];
  el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color));
  const miscs = [];
  sm.list.forEach(x => Object.entries(x.st.misc).forEach(([k, n]) => miscs.push({ k, n, sk: x.sk })));
  miscs.sort((a, b) => b.n - a.n);
  const mine = S.log.filter(r => r.subject === sub.title), acc = mine.length ? mine.filter(r => r.correct).length / mine.length : 0;
  el.innerHTML = `${topbar('Грешки и данни')}<div class="pad settings">
    ${subjectTabs(subj)}
    <section class="card"><h3>${icon('target')}Типичните ти грешки · ${esc(sub.title)}</h3>
      ${miscs.length ? `<ol class="misclist big">${miscs.slice(0, 8).map(x => `<li><div><span class="rt">${richInline(miscLabel(x.k))}</span><small class="muted">${esc(x.sk.name)}</small></div><b>×${x.n}</b></li>`).join('')}</ol>
        <p class="muted small">Всяка грешна опция в задачите идва от една конкретна типична грешка, затова виждаме не само <i>че</i> грешиш, а <i>как</i>.</p>` : '<p class="muted">Още няма грешки. Направи диагностика.</p>'}
      <p class="muted small">${mine.length} отговора · ${pctTxt(acc)} верни</p></section>
    <section class="card"><h3>✦ План за седмицата от Gemini</h3>
      <div class="aiplan"><p class="muted small">${aiOn() ? 'Gemini прави 5-дневен план само върху слабите места, по 20 минути на ден.' : 'Включи Gemini в настройките, за да получиш план.'}</p></div>
      ${aiOn() ? `<button class="btn accent block" data-plan>Направи план</button>` : `<button class="btn ghost block" data-go="settings">${icon('settings')}Настройки</button>`}</section>
    <section class="card"><h3>${icon('grid')}Данни за учителя (Looker Studio)</h3>
      <p class="small">Всеки отговор е един ред: ученик, клас, тема, вярно/грешно, типична грешка, време, увереност преди и след. Учителят вижда целия клас в Looker Studio.</p>
      <div class="rows">
        <div class="row"><span>${icon('upload')}Google Sheets</span><b class="small">${S.settings.sheetUrl ? (S.queue.length ? S.queue.length + ' чакат' : 'изпратено') : 'не е свързан'}</b></div></div>
      ${S.settings.sheetUrl ? `<button class="btn ghost block" data-flush>${icon('upload')}Изпрати сега</button>` : ''}
      <button class="btn ghost block" data-csv>${icon('download')}Моите отговори (CSV)</button>
      <button class="btn ghost block" data-class>${icon('download')}Примерен клас от 28 ученика (CSV)</button>
      <p class="muted small">В Looker Studio: <b>Create → Data source → Google Sheets</b> (или File upload за CSV), после таблица „умение × ученик“ със средно <code>mastery_after</code> и стълбова диаграма на <code>misconception</code>. Подробно — в README.</p>
      <a class="btn ghost block" href="https://lookerstudio.google.com/" target="_blank" rel="noopener">${icon('next')}Отвори Looker Studio</a></section>
    ${S.aiFlags.length ? `<section class="card"><h3>${icon('flag')}Докладвани ИИ задачи</h3><p class="small">${S.aiFlags.length} задачи чакат проверка от учител.</p><button class="btn ghost block" data-flags>${icon('download')}Изтегли (JSON)</button></section>` : ''}
  </div>`;
  el.onchange = e => { const s = e.target.closest('#subjSelect'); if (s && SUBJECTS[s.value]) { S.subject = s.value; saveState(); refresh(); } };
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-go]')) return go('settings');
    if (e.target.closest('[data-csv]')) return downloadText(`bingo-${slug(S.profile.name || 'uchenik')}-${todayKey()}.csv`, logCSV());
    if (e.target.closest('[data-class]')) return downloadText('bingo-primeren-klas.csv', logCSV(simulateClass()));
    if (e.target.closest('[data-flags]')) return downloadText('bingo-ai-flags.json', JSON.stringify(S.aiFlags, null, 2), 'application/json');
    if (e.target.closest('[data-flush]')) { const ok = await flushToSheet(); toast(ok ? 'Изпратено към Google Sheets' : 'Няма връзка — ще опитаме пак'); return refresh(); }
    const pb = e.target.closest('[data-plan]');
    if (pb) {
      const box = el.querySelector('.aiplan'); pb.disabled = true; box.innerHTML = '<div class="spinner"></div>';
      try {
        const j = await aiWeekPlan(subj);
        box.innerHTML = `<div class="rt"><p>${rich(j.summary || '')}</p></div><ol class="plan">${arr(j.days).map(d => `<li><b>${esc(d.day || '')}: ${esc(d.focus || '')}</b><div class="rt">${richInline(d.do || '')}</div><small class="muted">${richInline(d.why || '')}</small></li>`).join('')}</ol>`;
        pb.textContent = 'Нов план';
      } catch (err) { box.innerHTML = `<p class="danger-text">${esc(err.message)}</p>`; }
      pb.disabled = false;
    }
  });
};
