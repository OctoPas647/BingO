/* ================= BingO for teachers: the test bank, the test builder and giving a test to a class =================
   A test is a list of tasks in Shelly's task format (the same the app's own questions use), plus a "photo" task.
   Tasks can be written by hand, taken from BingO's banks and past НВО/ДЗИ exams, made by Gemini (from a topic,
   a PDF, a photo of a textbook page or a Google Doc), or imported from Google Forms (78-google.js). */

const TASK_KINDS = [
  ['choice', 'Един верен отговор', 'check'], ['multi', 'Няколко верни', 'grid'], ['text', 'Кратък отговор', 'text'], ['number', 'Число', 'bolt'],
  ['gaps', 'Попълни пропуските', 'pen'], ['order', 'Подреди', 'layers'], ['match', 'Свържи', 'link'], ['open', 'Свободен отговор (ИИ)', 'book'], ['photo', 'Снимка на решение (ИИ)', 'camera']
];
const kindName = type => { const k = TASK_KINDS.find(x => x[0] === type); return k ? L(k[1]) : type; };
const newTaskId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function blankTask(type) {
  const t = { id: newTaskId(), type, prompt: '', points: type === 'open' || type === 'photo' ? 4 : 1, explain: '' };
  if (type === 'choice') Object.assign(t, { options: ['', '', '', ''], answer: 0 });
  if (type === 'multi') Object.assign(t, { options: ['', '', '', ''], answer: [] });
  if (type === 'text') Object.assign(t, { answer: [''] });
  if (type === 'number') Object.assign(t, { answer: null, tolerance: 0 });
  if (type === 'gaps') Object.assign(t, { prompt: L('Попълни пропуските.'), text: '', gaps: [] });
  if (type === 'order') Object.assign(t, { prompt: L('Подреди в правилния ред.'), items: ['', '', ''] });
  if (type === 'match') Object.assign(t, { prompt: L('Свържи двойките.'), left: ['', '', ''], right: ['', '', ''] });
  if (type === 'open' || type === 'photo') Object.assign(t, { rubric: [{ text: '', points: 4 }], aiCriteria: '' });
  return t;
}

/* a task from BingO's bank or a past exam -> a teacher's task (without BingO-only fields) */
function bankToTask(t) {
  const keep = ['type', 'prompt', 'options', 'answer', 'explain', 'points', 'skill', 'gaps', 'text', 'items', 'left', 'right', 'tolerance', 'unit', 'strict', 'partial', 'rubric', 'why'];
  const out = { id: newTaskId() };
  for (const k of keep) if (t[k] != null) out[k] = JSON.parse(JSON.stringify(t[k]));
  if (out.type === 'gaps' && Array.isArray(t.bank)) out.gaps = out.gaps.map(g => g);   /* the word bank becomes typed blanks */
  if (!(out.points > 0)) out.points = 1;
  if (t.subj || t.subject) out.subject = t.subj || t.subject;
  return out;
}

/* ---------- Тестове: the bank ---------- */
SCREENS.tTests = async (el, { pickFor } = {}, nav) => {
  if (!(await tGate(el, 'tTests'))) return;
  const forCls = pickFor ? classById(pickFor) : null;
  const body = tFrame(el, 'tTests', { title: pickFor ? L('Какво да зададете?') : L('Тестове'), kicker: forCls ? esc(forCls.name) : '', backBtn: !!pickFor, actions: `<button class="btn accent small" data-new>${icon('plus')}${L('Нов тест')}</button><button class="btn ghost small" data-ai>${icon('sparkle')}${L('Тест с Gemini')}</button>` });
  let tests = [], q = '';
  const draw = () => {
    const list = tests.filter(t => !q || (t.title + ' ' + (t.subject || '')).toLowerCase().includes(q.toLowerCase()));
    body.innerHTML = `${pickFor ? `<button class="card t-quick" data-practice>${icon('target')}<div><b>${L('Упражнение в BingO върху слабите умения')}</b><small class="muted">${L('BingO избира задачите за всеки ученик според картата на уменията му')}</small></div>${icon('next')}</button>` : ''}
      <div class="t-search"><input class="field" data-q placeholder="${L('Търси тест…')}" value="${esc(q)}"></div>
      ${list.length ? `<div class="t-cards">${list.map(t => `<div class="card t-testcard" data-test="${esc(t.id)}"><b>${esc(t.title || L('Без име'))}</b><small class="muted">${esc(t.subject || '')}${t.grade ? ' · ' + esc(t.grade) : ''} · ${L('{n} задачи', { n: (t.tasks || []).length })} · ${fmtDay(tsMs(t.updatedAt))}</small>
        <div class="t-tc-actions"><button class="btn accent small" data-assign="${esc(t.id)}">${icon('send')}${L('Задай')}</button><button class="btn ghost small" data-live="${esc(t.id)}">${icon('live')}${L('На живо')}</button><button class="iconbtn" data-dup="${esc(t.id)}" aria-label="${L('Копие')}">${icon('dup')}</button><button class="iconbtn" data-del="${esc(t.id)}" aria-label="${L('Изтрий')}">${icon('trash')}</button></div></div>`).join('')}</div>`
        : emptyBox('file', L('Още нямате тестове'), L('Направете тест ръчно, с Gemini, от банката на BingO или от Google Forms.'))}`;
    const qi = body.querySelector('[data-q]'); qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = body.querySelector('[data-q]'); n.focus(); n.setSelectionRange(pos, pos); };
  };
  watch(col('tests').where('ownerId', '==', myUid()), s => { tests = docs(s).sort((a, b) => (tsMs(b.updatedAt) || 0) - (tsMs(a.updatedAt) || 0)); draw(); }, nav);
  tWatchBase(nav, () => { }, ['classes']);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-new]')) return go('tTestEdit', {});
    if (e.target.closest('[data-ai]')) return go('tTestEdit', { ai: true });
    if (e.target.closest('[data-practice]')) return go('tPublish', { practice: true, classIds: [pickFor] });
    const a = e.target.closest('[data-assign]'); if (a) return go('tPublish', { testId: a.dataset.assign, classIds: pickFor ? [pickFor] : [] });
    const lv = e.target.closest('[data-live]'); if (lv) return go('tPublish', { testId: lv.dataset.live, classIds: pickFor ? [pickFor] : [], kind: 'live' });
    const d = e.target.closest('[data-dup]'); if (d) { const t = tests.find(x => x.id === d.dataset.dup); return col('tests').add({ ...t, id: undefined, title: t.title + ' ' + L('(копие)'), ownerId: myUid(), createdAt: FV().serverTimestamp(), updatedAt: FV().serverTimestamp() }).catch(failToast); }
    const del = e.target.closest('[data-del]'); if (del) return confirmBox(L('Да изтрия ли теста?'), L('Вече зададените на класове остават.'), L('Изтрий'), true).then(ok => ok && docRef('tests/' + del.dataset.del).delete().catch(failToast));
    const t = e.target.closest('[data-test]'); if (t) return go('tTestEdit', { testId: t.dataset.test });
  });
};

/* ---------- the test builder ---------- */
SCREENS.tTestEdit = async (el, { testId, live, ai, tasks: preTasks, title: preTitle }, nav) => {
  if (!(await tGate(el, 'tTests'))) return;
  let T = { title: preTitle || '', subject: (CLOUD.profile && (CLOUD.profile.subjects || [])[0]) || '', grade: '', description: '', tasks: preTasks ? preTasks.map(bankToTask) : [] };
  if (testId) {
    const s = await docRef('tests/' + testId).get();
    if (s.exists) T = { ...T, ...s.data() };
  }
  let dirty = !!preTasks, open = T.tasks.length ? null : null, savedId = testId || null;
  const body = tFrame(el, 'tTests', { title: testId ? esc(T.title || L('Тест')) : L('Нов тест'), backBtn: true, wide: true,
    actions: `<button class="btn ghost small" data-preview>${icon('eye')}${L('Преглед')}</button><button class="btn ghost small" data-save>${icon('check')}${L('Запази')}</button><button class="btn accent small" data-publish>${icon('send')}${live ? L('Пусни на живо') : L('Задай')}</button>` });
  nav.guard = async () => !dirty || confirmBox(L('Да изляза ли без запазване?'), L('Промените в теста ще се загубят.'), L('Излез'), true);
  const totalPts = () => roundTo(sum(T.tasks.map(t => Number(t.points) || 0)), 2);
  const subjOpts = () => Object.values(SUBJECTS).map(s => `<option value="${esc(L(s.title))}">`).join('');
  const subjId = () => { const s = Object.values(SUBJECTS).find(x => L(x.title) === T.subject || x.title === T.subject || x.short === T.subject); return s ? s.id : null; };

  const draw = () => {
    body.innerHTML = `<div class="t-builder">
      <div class="card t-form t-testmeta">
        <input class="field t-title-in" data-m="title" placeholder="${L('Име на теста, напр. Контролно — Квадратни уравнения')}" value="${esc(T.title)}">
        <div class="t-inline"><input class="field" data-m="subject" placeholder="${L('Предмет')}" value="${esc(T.subject || '')}" list="t-subj2"><datalist id="t-subj2">${subjOpts()}</datalist><input class="field" data-m="grade" placeholder="${L('Клас')}" value="${esc(T.grade || '')}" style="max-width:110px"></div>
        <textarea class="field" rows="2" data-m="description" placeholder="${L('Указания към учениците (по желание)')}">${esc(T.description || '')}</textarea>
        <p class="muted small">${L('{n} задачи · {p} точки', { n: T.tasks.length, p: fmtPts(totalPts(), appLang()) })}</p></div>
      <div class="t-tasks">${T.tasks.map((t, i) => taskCardHTML(t, i, open === t.id)).join('')}</div>
      <div class="card t-add"><h3>${icon('plus')}${L('Добави задача')}</h3><div class="t-kinds">${TASK_KINDS.map(([id, label, ic]) => `<button data-add="${id}">${icon(ic)}<span>${L(label)}</span></button>`).join('')}</div>
        <h3>${icon('download')}${L('Или внеси')}</h3><div class="t-kinds">
          <button data-imp="ai">${icon('sparkle')}<span>${L('Gemini по тема')}</span></button>
          <button data-imp="doc">${icon('file')}<span>${L('От PDF, снимка или текст')}</span></button>
          <button data-imp="gdoc">${icon('google')}<span>${L('От Google Doc')}</span></button>
          <button data-imp="forms">${icon('google')}<span>${L('От Google Forms')}</span></button>
          <button data-imp="bank">${icon('target')}<span>${L('Банката на BingO')}</span></button>
          <button data-imp="past">${icon('book')}<span>${L('Минали НВО и матури')}</span></button></div></div>
    </div>`;
    body.querySelectorAll('.t-tasks .t-task.open').forEach(c => mountTaskEditor(c, T.tasks.find(t => t.id === c.dataset.tid)));
  };
  const save = async () => {
    for (const [i, t] of T.tasks.entries()) { const p = eduTaskProblem(t); if (p) { open = t.id; draw(); throw new Error(L('Задача {n}: {p}', { n: i + 1, p: L(p) })); } }
    if (!T.title.trim()) throw new Error(L('Дайте име на теста'));
    const data = { ownerId: myUid(), title: T.title.trim(), subject: T.subject || '', grade: T.grade || '', description: T.description || '', tasks: JSON.parse(JSON.stringify(T.tasks)), updatedAt: FV().serverTimestamp() };
    if (savedId) await docRef('tests/' + savedId).set(data, { merge: true });
    else { data.createdAt = FV().serverTimestamp(); const r = await col('tests').add(data); savedId = r.id; NAV[NAV.length - 1].params.testId = savedId; }
    dirty = false; return savedId;
  };
  const addTasks = list => { const n = list.map(t => (t.id ? t : { ...t, id: newTaskId() })); T.tasks.push(...n); dirty = true; open = null; draw(); toast(L('Добавени задачи: {n}', { n: n.length })); };

  body.addEventListener('input', e => {
    dirty = true;
    const m = e.target.closest('[data-m]'); if (m) T[m.dataset.m] = m.value;
  });
  body.addEventListener('change', () => { dirty = true; });
  el.addEventListener('click', async e => {
    const tg = e.target.closest('[data-toggle]'); if (tg && !e.target.closest('.t-task-tools')) { open = open === tg.dataset.toggle ? null : tg.dataset.toggle; return draw(); }
    const ad = e.target.closest('[data-add]'); if (ad) { const t = blankTask(ad.dataset.add); T.tasks.push(t); open = t.id; dirty = true; draw(); body.querySelector(`[data-tid="${t.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const tool = e.target.closest('[data-tool]');
    if (tool) {
      const i = T.tasks.findIndex(t => t.id === tool.closest('[data-tid]').dataset.tid), t = T.tasks[i];
      const a = tool.dataset.tool; dirty = true;
      if (a === 'up' && i > 0) [T.tasks[i - 1], T.tasks[i]] = [T.tasks[i], T.tasks[i - 1]];
      if (a === 'down' && i < T.tasks.length - 1) [T.tasks[i + 1], T.tasks[i]] = [T.tasks[i], T.tasks[i + 1]];
      if (a === 'dup') T.tasks.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(t)), id: newTaskId() });
      if (a === 'del') { if (!(await confirmBox(L('Да изтрия ли задачата?'), String(t.prompt || '').slice(0, 120), L('Изтрий'), true))) return; T.tasks.splice(i, 1); }
      if (a === 'ai') return improveTaskSheet(t, nt => { T.tasks[i] = nt; open = nt.id; draw(); });
      return draw();
    }
    const imp = e.target.closest('[data-imp]');
    if (imp) {
      const k = imp.dataset.imp;
      if (k === 'ai') return aiTestSheet(T, addTasks);
      if (k === 'doc') return docTestSheet(T, addTasks);
      if (k === 'gdoc') return gdocTestSheet(T, addTasks);
      if (k === 'forms') return formsImportSheet(addTasks, title => { if (!T.title) { T.title = title; draw(); } });
      if (k === 'bank') return bankSheet(subjId(), addTasks);
      if (k === 'past') return pastSheet(subjId(), addTasks);
    }
    if (e.target.closest('[data-save]')) return busy(e.target.closest('[data-save]'), async () => { await save(); toast(L('Запазено')); });
    if (e.target.closest('[data-preview]')) return previewTest(T);
    if (e.target.closest('[data-publish]')) return busy(e.target.closest('[data-publish]'), async () => { if (!T.tasks.length) throw new Error(L('Тестът няма задачи')); const id = await save(); go('tPublish', { testId: id, kind: live ? 'live' : undefined }); });
  });
  draw();
  if (ai) aiTestSheet(T, addTasks);
};

function taskSummary(t) {
  const p = String(t.prompt || (t.type === 'gaps' ? t.text : '') || '').replace(/\s+/g, ' ').trim();
  return p ? richInline(p.length > 140 ? p.slice(0, 140) + '…' : p) : `<span class="muted">${L('(без условие)')}</span>`;
}
function taskCardHTML(t, i, isOpen) {
  const prob = eduTaskProblem(t);
  return `<div class="card t-task${isOpen ? ' open' : ''}${prob ? ' bad' : ''}" data-tid="${esc(t.id)}">
    <div class="t-task-head" data-toggle="${esc(t.id)}"><span class="t-tnum">${i + 1}</span><div class="t-task-sum"><small class="muted">${esc(kindName(t.type))} · ${L('{n} т.', { n: fmtPts(Number(t.points) || 0, appLang()) })}${t.skill ? ' · ' + esc(t.skill) : ''}${prob ? ` · <span class="danger-text">${esc(L(prob))}</span>` : ''}</small><div class="rt">${taskSummary(t)}</div></div>
      <div class="t-task-tools"><button class="iconbtn" data-tool="ai" aria-label="${L('Подобри с Gemini')}">${icon('sparkle')}</button><button class="iconbtn" data-tool="up" aria-label="${L('Нагоре')}">${icon('up')}</button><button class="iconbtn" data-tool="down" aria-label="${L('Надолу')}">${icon('down')}</button><button class="iconbtn" data-tool="dup" aria-label="${L('Копие')}">${icon('dup')}</button><button class="iconbtn" data-tool="del" aria-label="${L('Изтрий')}">${icon('trash')}</button></div></div>
    ${isOpen ? '<div class="t-editor"></div>' : ''}</div>`;
}

/* the editor of one task; every change goes straight into the task object */
function mountTaskEditor(card, t) {
  const box = card.querySelector('.t-editor'); if (!box || !t) return;
  const list = (key, label, opts = {}) => `<div class="t-listed" data-list="${key}"><span class="t-lab">${esc(label)}</span>${(t[key] || []).map((v, k) => `<div class="t-li">${opts.mark ? opts.mark(k) : `<span class="t-li-n">${k + 1}</span>`}<input class="field" data-li="${key}" data-k="${k}" value="${esc(v)}" placeholder="${esc(opts.ph ? opts.ph(k) : '')}"><button class="iconbtn" data-rm="${key}" data-k="${k}" aria-label="${L('Махни')}">${icon('close')}</button></div>`).join('')}<button class="linkbtn" data-plus="${key}">+ ${L('Добави')}</button></div>`;
  const draw = () => {
    let typeHTML = '';
    if (t.type === 'choice') typeHTML = list('options', L('Отговори (отбележете верния)'), { mark: k => `<button class="t-right ${t.answer === k ? 'on' : ''}" data-right="${k}" aria-label="${L('Верен')}">${icon('check')}</button>`, ph: k => L('Отговор {l}', { l: letterOf('bg', k) }) });
    if (t.type === 'multi') typeHTML = list('options', L('Отговори (отбележете всички верни)'), { mark: k => `<button class="t-right sq ${(t.answer || []).includes(k) ? 'on' : ''}" data-rightm="${k}" aria-label="${L('Верен')}">${icon('check')}</button>`, ph: k => L('Отговор {l}', { l: letterOf('bg', k) }) }) + `<label class="t-check"><input type="checkbox" data-bool="partial" ${t.partial ? 'checked' : ''}> ${L('Частични точки')}</label>`;
    if (t.type === 'text') typeHTML = list('answer', L('Приемани отговори'), { ph: () => L('верен отговор') }) + `<label class="t-check"><input type="checkbox" data-bool="strict" ${t.strict ? 'checked' : ''}> ${L('Главните букви и препинанието имат значение')}</label>`;
    if (t.type === 'number') typeHTML = `<div class="t-inline"><label class="fld"><span>${L('Верен отговор')}</span><input class="field" data-num="answer" inputmode="decimal" value="${t.answer == null ? '' : esc(String(t.answer).replace('.', ','))}"></label><label class="fld"><span>${L('Допуск ±')}</span><input class="field" data-num="tolerance" inputmode="decimal" value="${esc(String(t.tolerance || 0).replace('.', ','))}"></label><label class="fld"><span>${L('Мерна единица')}</span><input class="field" data-str="unit" value="${esc(t.unit || '')}"></label></div>`;
    if (t.type === 'gaps') typeHTML = `<label class="fld"><span>${L('Текст — празните места са [[1]], [[2]]…')}</span><textarea class="field" rows="3" data-str="text">${esc(t.text || '')}</textarea></label><button class="btn ghost small" data-gap>${L('+ Празно място')}</button>
      ${(t.gaps || []).map((g, k) => `<div class="t-gap"><b>[[${k + 1}]]</b>${g.options ? `<input class="field" data-gopts="${k}" value="${esc(g.options.join(' | '))}" placeholder="${L('избор: а | б | в')}"><select class="field" data-gans="${k}">${g.options.map((o, j) => `<option value="${j}" ${g.answer === j ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input class="field" data-gtext="${k}" value="${esc(arr(g.answer).join(' | '))}" placeholder="${L('верен отговор (варианти с |)')}">`}<button class="linkbtn" data-gmode="${k}">${g.options ? L('пиши') : L('избор')}</button></div>`).join('')}`;
    if (t.type === 'order') typeHTML = list('items', L('Елементи в ПРАВИЛНИЯ ред (учениците ги виждат разбъркани)'), { ph: k => L('{n}-и', { n: k + 1 }) });
    if (t.type === 'match') typeHTML = `<div class="t-pairs"><span class="t-lab">${L('Двойки (дясната колона се разбърква)')}</span>${(t.left || []).map((v, k) => `<div class="t-li"><input class="field" data-pair="left" data-k="${k}" value="${esc(v)}" placeholder="${L('ляво')}"><span>↔</span><input class="field" data-pair="right" data-k="${k}" value="${esc((t.right || [])[k] || '')}" placeholder="${L('дясно')}"><button class="iconbtn" data-rmpair="${k}">${icon('close')}</button></div>`).join('')}<button class="linkbtn" data-addpair>+ ${L('Добави двойка')}</button></div>`;
    if (t.type === 'open' || t.type === 'photo') typeHTML = `<div class="t-rubric"><span class="t-lab">${L('Критерии (рубрика) — по тях оценява ИИ')}</span>${(t.rubric || []).map((r, k) => `<div class="t-li"><input class="field" data-rub="${k}" value="${esc(r.text || '')}" placeholder="${L('напр. Посочена е теза')}"><input class="field t-pts" data-rubp="${k}" inputmode="decimal" value="${esc(String(r.points || 0))}"><button class="iconbtn" data-rmrub="${k}">${icon('close')}</button></div>`).join('')}<button class="linkbtn" data-addrub>+ ${L('Добави критерий')}</button></div>
      <label class="fld"><span>${L('Какво да търси ИИ (вашият начин на оценяване)')}</span><textarea class="field" rows="2" data-str="aiCriteria" placeholder="${L('напр. Без обосновка — най-много половината точки. Не наказвай правописни грешки.')}">${esc(t.aiCriteria || '')}</textarea></label>`;
    box.innerHTML = `<label class="fld"><span>${L('Условие')}</span><textarea class="field" rows="3" data-str="prompt" placeholder="${L('Математика: $x^2 - 4 = 0$; удебелено: **дума**')}">${esc(t.prompt || '')}</textarea></label>
      ${t.prompt && /\$|\*\*/.test(t.prompt) ? `<div class="t-prevline rt">${rich(t.prompt)}</div>` : ''}
      <div class="t-media">${(t.media || []).map((b, k) => `<span class="t-thumb"><img src="${esc(b.src)}" alt=""><button data-rmimg="${k}">${icon('close')}</button></span>`).join('')}<label class="linkbtn">${icon('image')} ${L('Снимка към условието')}<input type="file" accept="image/*" data-img hidden></label></div>
      ${typeHTML}
      <div class="t-inline"><label class="fld"><span>${L('Точки')}</span><input class="field t-pts" data-num="points" inputmode="decimal" value="${esc(String(t.points || 1).replace('.', ','))}"></label>
        <label class="fld"><span>${L('Умение (за анализа)')}</span><input class="field" data-str="skill" value="${esc(t.skill || '')}" placeholder="${L('напр. квадратни уравнения')}"></label></div>
      <label class="fld"><span>${t.type === 'open' || t.type === 'photo' ? L('Примерен отговор / решение') : L('Обяснение (учениците го виждат след теста, ако позволите)')}</span><textarea class="field" rows="2" data-str="explain">${esc(t.explain || '')}</textarea></label>`;
  };
  const touch = () => { const c = card.closest('.t-builder'); if (c) c.dispatchEvent(new CustomEvent('task-changed', { bubbles: true })); const pr = eduTaskProblem(t); card.classList.toggle('bad', !!pr); card.querySelector('.t-task-sum .rt').innerHTML = taskSummary(t); };
  box.addEventListener('input', e => {
    const x = e.target;
    if (x.dataset.str != null) t[x.dataset.str] = x.value;
    if (x.dataset.num != null) { const v = parseNumber(x.value); t[x.dataset.num] = isFinite(v) ? v : (x.dataset.num === 'answer' ? null : 0); }
    if (x.dataset.li != null) t[x.dataset.li][+x.dataset.k] = x.value;
    if (x.dataset.pair != null) { t[x.dataset.pair] = t[x.dataset.pair] || []; t[x.dataset.pair][+x.dataset.k] = x.value; }
    if (x.dataset.rub != null) t.rubric[+x.dataset.rub].text = x.value;
    if (x.dataset.rubp != null) { t.rubric[+x.dataset.rubp].points = parseNumber(x.value) || 0; t.points = roundTo(sum(t.rubric.map(r => r.points || 0)), 2) || t.points; const pi = box.querySelector('[data-num="points"]'); if (pi && document.activeElement !== pi) pi.value = String(t.points).replace('.', ','); }
    if (x.dataset.gtext != null) t.gaps[+x.dataset.gtext].answer = x.value.split('|').map(s => s.trim()).filter(Boolean);
    if (x.dataset.gopts != null) { const g = t.gaps[+x.dataset.gopts]; g.options = x.value.split('|').map(s => s.trim()).filter(Boolean); if (!(g.answer < g.options.length)) g.answer = 0; }
    if (x.dataset.gans != null) t.gaps[+x.dataset.gans].answer = +x.value;
    if (x.dataset.bool != null) t[x.dataset.bool] = x.checked;
    if (x.dataset.str === 'text' && t.type === 'gaps') { const n = (t.text.match(/\[\[\d+\]\]/g) || []).length; while ((t.gaps || []).length < n) (t.gaps = t.gaps || []).push({ answer: [] }); if (t.gaps.length > n) t.gaps.length = n; }
    touch();
  });
  box.addEventListener('change', e => { if (e.target.dataset.gopts != null || e.target.dataset.bool != null) { draw(); touch(); } });
  box.addEventListener('change', async e => {
    if (e.target.matches('[data-img]')) {
      const f = e.target.files[0]; if (!f) return;
      try { const up = await uploadImage(`tests/${myUid()}/${Date.now()}.jpg`, f); t.media = [...(t.media || []), { type: 'image', src: up.url, alt: '' }]; draw(); touch(); } catch (err) { failToast(err); }
    }
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button,[data-plus]'); if (!b) return;
    const d = b.dataset;
    if (d.right != null) t.answer = +d.right;
    else if (d.rightm != null) { const k = +d.rightm, s = new Set(t.answer || []); s.has(k) ? s.delete(k) : s.add(k); t.answer = [...s].sort((a, c) => a - c); }
    else if (d.plus) { t[d.plus] = [...(t[d.plus] || []), '']; }
    else if (d.rm) { const k = +d.k; t[d.rm].splice(k, 1); if (t.type === 'choice' && d.rm === 'options') t.answer = t.answer === k ? 0 : t.answer > k ? t.answer - 1 : t.answer; if (t.type === 'multi' && d.rm === 'options') t.answer = (t.answer || []).filter(a => a !== k).map(a => (a > k ? a - 1 : a)); }
    else if (d.addpair != null) { t.left = [...(t.left || []), '']; t.right = [...(t.right || []), '']; }
    else if (d.rmpair != null) { t.left.splice(+d.rmpair, 1); t.right.splice(+d.rmpair, 1); }
    else if (d.addrub != null) t.rubric = [...(t.rubric || []), { text: '', points: 1 }];
    else if (d.rmrub != null) t.rubric.splice(+d.rmrub, 1);
    else if (d.gap != null) { const n = (String(t.text || '').match(/\[\[\d+\]\]/g) || []).length + 1; t.text = (t.text || '') + ` [[${n}]]`; t.gaps = [...(t.gaps || []), { answer: [] }]; }
    else if (d.gmode != null) { const g = t.gaps[+d.gmode]; if (g.options) { delete g.options; g.answer = []; } else { g.options = ['', '']; g.answer = 0; } }
    else if (d.rmimg != null) t.media.splice(+d.rmimg, 1);
    else return;
    if (t.type === 'open' || t.type === 'photo') t.points = roundTo(sum((t.rubric || []).map(r => r.points || 0)), 2) || t.points;
    draw(); touch();
  });
  draw();
}

function previewTest(T) {
  const m = classModule(null);
  const { pub } = eduStrip(T.tasks, 'preview');
  const body = h(`<div class="t-preview"></div>`);
  pub.forEach((t, i) => {
    const c = h(`<div class="card"><span class="kicker">${L('Въпрос {a} от {b}', { a: i + 1, b: pub.length })} · ${L('{n} т.', { n: fmtPts(t.points, appLang()) })}</span></div>`);
    if (t.type === 'photo') c.insertAdjacentHTML('beforeend', `<div class="prompt rt">${rich(t.prompt || '')}</div><div class="cl-photo-empty">${icon('camera')}<span>${L('Снимай решението си на лист')}</span></div>`);
    else c.appendChild(taskView(viewTask(t), m, { mode: 'exam', seed: 'pv' }).el);
    body.appendChild(c);
  });
  sheet({ title: L('Как го виждат учениците'), wide: true, body: '', actions: [{ id: 'x', label: L('Затвори') }], onMount: sh => { sh.querySelector('.sheet-body').appendChild(body); mountMedia(body, m.id); } });
}

/* ---------- Gemini: a test on a topic, from a document, or a better task ---------- */
const TYPE_PICK = () => TASK_KINDS.filter(k => k[0] !== 'photo').map(([id, label]) => `<label class="t-check"><input type="checkbox" data-type="${id}" ${['choice', 'multi', 'number', 'text', 'open'].includes(id) ? 'checked' : ''}> ${L(label)}</label>`).join('');
const pickedTypes = sh => [...sh.querySelectorAll('[data-type]:checked')].map(x => x.dataset.type);
function genOptsHTML(T) {
  return `<div class="t-inline"><label class="fld"><span>${L('Предмет')}</span><input class="field" data-g="subject" value="${esc(T.subject || '')}"></label><label class="fld"><span>${L('Клас')}</span><input class="field" data-g="grade" value="${esc(T.grade || '')}" style="max-width:90px"></label><label class="fld"><span>${L('Брой')}</span><input class="field" data-g="n" type="number" min="1" max="40" value="10" style="max-width:90px"></label></div>
    <label class="fld"><span>${L('Трудност')}</span><select class="field" data-g="level"><option value="">${L('смесена')}</option><option value="лесни">${L('лесни')}</option><option value="средни">${L('средни')}</option><option value="трудни, като на матура">${L('трудни, като на матура')}</option></select></label>
    <div class="t-types">${TYPE_PICK()}</div><label class="fld"><span>${L('Бележки към Gemini (по желание)')}</span><input class="field" data-g="notes" placeholder="${L('напр. без калкулатор; като НВО 7 клас')}"></label>`;
}
const genVals = sh => ({ subject: sh.querySelector('[data-g="subject"]').value, grade: sh.querySelector('[data-g="grade"]').value, n: +sh.querySelector('[data-g="n"]').value || 10, level: sh.querySelector('[data-g="level"]').value, notes: sh.querySelector('[data-g="notes"]').value, types: pickedTypes(sh), lang: appLang() });
function aiTestSheet(T, addTasks) {
  sheet({ title: L('Тест с Gemini'), wide: true, body: `<label class="fld"><span>${L('Тема')}</span><input class="field" data-g="topic" placeholder="${L('напр. Квадратни уравнения — формула и Виет')}"></label>${genOptsHTML(T)}`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Създай'), kind: 'primary', icon: 'sparkle' }],
    onMount: (sh, o) => { const ok = sh.querySelector('[data-act="ok"]'); ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => { const topic = sh.querySelector('[data-g="topic"]').value.trim(); if (!topic) throw new Error(L('Напишете тема')); const r = await callFn('teacherAI', { action: 'generate', topic, ...genVals(sh) }, { timeout: 280000 }); if (!T.title) T.title = topic; if (!T.subject) T.subject = genVals(sh).subject; addTasks(r.tasks); o.close('ok'); }); }, true); } });
}
function docTestSheet(T, addTasks) {
  sheet({ title: L('Тест от материал'), wide: true, body: `<p class="muted small">${L('PDF (урок, глава от учебник), снимка на страница или поставен текст. Gemini прави задачи само по него.')}</p>
    <label class="btn ghost block">${icon('upload')}<span data-fname>${L('Избери файл (PDF, снимка, .txt)')}</span><input type="file" accept="application/pdf,image/*,text/plain" data-file hidden></label>
    <textarea class="field t-area" rows="5" data-text placeholder="${L('…или поставете текста тук')}"></textarea>${genOptsHTML(T)}`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Създай'), kind: 'primary', icon: 'sparkle' }],
    onMount: (sh, o) => {
      let file = null;
      sh.querySelector('[data-file]').onchange = e => { file = e.target.files[0] || null; sh.querySelector('[data-fname]').textContent = file ? file.name : L('Избери файл (PDF, снимка, .txt)'); };
      const ok = sh.querySelector('[data-act="ok"]');
      ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => {
        const text = sh.querySelector('[data-text]').value.trim();
        let r;
        if (file) {
          if (file.size > 10 * 1024 * 1024) throw new Error(L('Файлът е по-голям от 10 MB'));
          if (file.type === 'text/plain') r = await callFn('teacherAI', { action: 'fromText', text: await file.text(), ...genVals(sh) }, { timeout: 280000 });
          else { const data = await b64(file.type.startsWith('image/') ? await shrinkImage(file, 2200, 0.85) : file); r = await callFn('teacherAI', { action: 'fromFile', data, mime: file.type.startsWith('image/') ? 'image/jpeg' : file.type, ...genVals(sh) }, { timeout: 280000 }); }
        } else if (text) r = await callFn('teacherAI', { action: 'fromText', text, ...genVals(sh) }, { timeout: 280000 });
        else throw new Error(L('Изберете файл или поставете текст'));
        if (!T.title && file) T.title = file.name.replace(/\.[a-z0-9]+$/i, '');
        addTasks(r.tasks); o.close('ok');
      }); }, true);
    } });
}
function improveTaskSheet(t, done) {
  sheet({ title: L('Подобри с Gemini'), body: `<label class="fld"><span>${L('Какво да промени?')}</span><input class="field" data-how placeholder="${L('напр. по-трудна; провери отговора; направи я с 4 отговора')}"></label>`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Подобри'), kind: 'primary', icon: 'sparkle' }],
    onMount: (sh, o) => { const ok = sh.querySelector('[data-act="ok"]'); ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => { const r = await callFn('teacherAI', { action: 'improveTask', task: t, how: sh.querySelector('[data-how]').value, lang: appLang() }); done(r.task); o.close('ok'); }); }, true); } });
}

/* ---------- BingO's own banks and past exams ---------- */
function bankSheet(subj, addTasks) {
  const subs = Object.values(SUBJECTS);
  let cur = subj && SUBJECTS[subj] ? subj : S.subject;
  const picked = new Map();
  const tasksOf = (sid, skill) => {
    const pool = (BANK[sid] || []).filter(t => t.skill === skill && !(t.media && t.media.length) && !t.passage);
    if (sid === 'math' && typeof MATH_GEN !== 'undefined' && MATH_GEN[skill]) for (let lv = 1; lv <= 3; lv++) for (let s = 0; s < 2; s++) pool.push(genMathTask(skill, lv, 'teacher:' + lv + ':' + s + ':' + Date.now()));
    return pool.slice(0, 40);
  };
  const draw = sh => {
    const sk = skillList(cur);
    sh.querySelector('.sheet-body').innerHTML = `<select class="field" data-subj>${subs.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${s.icon} ${esc(L(s.title))}</option>`).join('')}</select>
      <div class="t-bank">${sk.map(s => { const ts = tasksOf(cur, s.id); return ts.length ? `<details><summary><b>${esc(L(s.name))}</b><small class="muted">${ts.length}</small></summary>${ts.map((t, k) => { const key = cur + ':' + s.id + ':' + k; return `<label class="t-bankrow"><input type="checkbox" data-pick="${esc(key)}" ${picked.has(key) ? 'checked' : ''}><span class="rt">${richInline(String(t.prompt || t.text || '').slice(0, 220))}</span></label>`; }).join('')}</details>` : ''; }).join('')}</div>`;
    sh._tasks = Object.fromEntries(sk.flatMap(s => tasksOf(cur, s.id).map((t, k) => [cur + ':' + s.id + ':' + k, { ...t, skill: t.skill || s.id }])));
  };
  sheet({ title: L('Банката на BingO'), wide: true, body: '', actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Добави избраните'), kind: 'primary' }],
    onMount: (sh, o) => {
      draw(sh);
      sh.addEventListener('change', e => {
        if (e.target.matches('[data-subj]')) { cur = e.target.value; draw(sh); }
        if (e.target.matches('[data-pick]')) { const k = e.target.dataset.pick; e.target.checked ? picked.set(k, sh._tasks[k]) : picked.delete(k); }
      });
      sh.querySelector('[data-act="ok"]').addEventListener('click', ev => { ev.stopPropagation(); if (!picked.size) return toast(L('Изберете задачи'), 'bad'); addTasks([...picked.values()].map(bankToTask)); o.close('ok'); }, true);
    } });
}
function pastSheet(subj, addTasks) {
  const exams = (typeof PAST !== 'undefined' ? PAST : []).filter(m => !subj || !m.past || m.past.subj === subj || true);
  sheet({ title: L('Минали НВО и матури'), wide: true, body: `<p class="muted small">${L('Задачи с текст за четене, картинка или аудио не се внасят.')}</p><div class="t-bank">${exams.map(m => { const ts = m.exams[0].parts.flatMap(p => p.tasks).filter(t => !t.passage && !(t.media && t.media.length) && t.type !== 'open'); return ts.length ? `<details><summary><b>${esc(m.title)}</b><small class="muted">${ts.length}</small></summary><button class="linkbtn" data-all="${esc(m.id)}">${L('Целия изпит')}</button>${ts.map(t => `<label class="t-bankrow"><input type="checkbox" data-pt="${esc(m.id)}|${esc(t.id)}"><span class="rt">${richInline(String(t.prompt || t.text || '').slice(0, 200))}</span></label>`).join('')}</details>` : ''; }).join('') || `<p class="muted">${L('Няма внесени изпити.')}</p>`}</div>`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Добави избраните'), kind: 'primary' }],
    onMount: (sh, o) => {
      const find = (mid, tid) => { const m = exams.find(x => x.id === mid); return m && m.exams[0].parts.flatMap(p => p.tasks).find(t => t.id === tid); };
      sh.addEventListener('click', e => { const a = e.target.closest('[data-all]'); if (a) sh.querySelectorAll(`[data-pt^="${a.dataset.all}|"]`).forEach(c => { c.checked = true; }); });
      sh.querySelector('[data-act="ok"]').addEventListener('click', ev => { ev.stopPropagation(); const ts = [...sh.querySelectorAll('[data-pt]:checked')].map(c => find(...c.dataset.pt.split('|'))).filter(Boolean); if (!ts.length) return toast(L('Изберете задачи'), 'bad'); addTasks(ts.map(bankToTask)); o.close('ok'); }, true);
    } });
}

/* ---------- giving a test (or a BingO practice) to classes ---------- */
SCREENS.tPublish = async (el, { testId, classIds = [], kind: kind0, practice, planId }, nav) => {
  if (!(await tGate(el, 'tTests'))) return;
  let test = null;
  if (testId) { const s = await docRef('tests/' + testId).get(); if (s.exists) test = { id: s.id, ...s.data() }; }
  /* a test planned in the calendar first (84-plans.js): its class, date and length are filled in */
  const plan = !practice ? await planForPublish(planId) : null;
  if (plan) { classIds = [plan.classId]; kind0 = 'test'; }
  const body = tFrame(el, 'tTests', { title: practice ? L('Упражнение в BingO') : esc((test && test.title) || L('Задай')), kicker: L('Задай на клас'), backBtn: true });
  const now = Date.now();
  const st = {
    classIds: new Set(classIds.filter(Boolean)), kind: practice ? 'practice' : kind0 || 'homework', mode: 'normal',
    opensNow: true, opensAt: now + 3600000, closesAt: practice ? now + 3 * 864e5 : now + 7 * 864e5, noClose: false, timeLimitMin: 0,
    settings: { shuffleQ: true, shuffleOpts: true, oneByOne: false, attempts: 1, lateAllowed: false, antiCheat: eduAcDefaults(practice ? 'practice' : kind0 || 'homework', 'normal'), feedback: { show: 'score', when: 'now' }, grading: { scale: 'bg6', thresholds: EDU_BG6_DEFAULT.slice() }, aiGrading: 'ai_review', aiInstructions: '', quizSeconds: 20, practice: { subject: S.subject, skills: [], size: 10, weakest: true } },
    calendar: false, classroom: false, acTouched: false
  };
  /* protection follows the kind of assignment (on for tests and live tests) until the teacher changes it */
  const acFollow = () => { if (!st.acTouched) st.settings.antiCheat = eduAcDefaults(st.kind, st.mode); };
  if (st.kind === 'test' || st.kind === 'live') { st.timeLimitMin = 40; st.settings.feedback.when = 'close'; }
  if (plan) { const at = tsMs(plan.at); if (at > now) { st.opensNow = false; st.opensAt = at; } st.closesAt = Math.max(st.opensNow ? now : at, at) + Math.max(15, plan.durationMin || 40) * 60e3 + 10 * 60e3; st.timeLimitMin = plan.durationMin || 40; if (plan.scale) st.settings.grading.scale = plan.scale; }
  const hasOpen = test && test.tasks.some(t => t.type === 'open' || t.type === 'photo');
  const sw = (path, on, label, sub = '') => `<div class="row"><span class="row-text"><b>${label}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</span><button class="switch${on ? ' on' : ''}" data-sw="${path}" role="switch" aria-checked="${!!on}"><i></i></button></div>`;
  const draw = () => {
    const s = st.settings, ac = s.antiCheat, isLive = st.kind === 'live', quiz = isLive && st.mode === 'quiz';
    body.innerHTML = `<div class="t-publish">
      ${plan ? `<div class="card tp-plan"><b>${icon('calendar')} ${L('За планирания тест „{t}“', { t: esc(plan.title) })}</b><p class="muted small">${esc(fmtWhen(tsMs(plan.at)))} · ${L('{n} мин', { n: plan.durationMin || 40 })}</p></div>` : ''}
      <div class="card"><h3>${icon('users')}${L('На кои класове')}</h3><div class="t-clspick">${TD.classes.filter(c => !c.archived).map(c => `<button data-cls="${esc(c.id)}" class="${st.classIds.has(c.id) ? 'on' : ''}" style="--cc:${esc(c.color || '#2F5BD3')}">${esc(c.name)}<small>${(c.studentIds || []).length}</small></button>`).join('') || `<p class="muted">${L('Първо създайте клас.')}</p>`}</div></div>
      ${practice ? `<div class="card"><h3>${icon('target')}${L('Упражнението')}</h3><select class="field" data-psubj>${Object.values(SUBJECTS).map(x => `<option value="${x.id}" ${x.id === s.practice.subject ? 'selected' : ''}>${x.icon} ${esc(L(x.title))}</option>`).join('')}</select>
        <div class="rows">${sw('practice.weakest', s.practice.weakest, L('Най-слабите умения на класа'), L('BingO ги избира от упражненията на учениците'))}</div>
        ${s.practice.weakest ? '' : `<div class="t-types">${skillList(s.practice.subject).map(k => `<label class="t-check"><input type="checkbox" data-pskill="${k.id}" ${s.practice.skills.includes(k.id) ? 'checked' : ''}> ${esc(L(k.name))}</label>`).join('')}</div>`}
        <label class="fld"><span>${L('Брой задачи')}</span><input class="field" type="number" min="4" max="30" data-psize value="${s.practice.size}"></label></div>`
      : `<div class="card"><h3>${icon('file')}${L('Вид')}</h3><div class="seg" data-segk>${[['homework', 'Домашно'], ['test', 'Тест'], ['live', 'На живо в час']].map(([k, l]) => `<button data-kind="${k}" class="${st.kind === k ? 'on' : ''}">${L(l)}</button>`).join('')}</div>
        ${isLive ? `<div class="seg t-mt">${[['normal', 'Всеки със своето темпо'], ['quiz', 'Куиз на проектора']].map(([k, l]) => `<button data-mode="${k}" class="${st.mode === k ? 'on' : ''}">${L(l)}</button>`).join('')}</div><p class="muted small">${quiz ? L('Въпросите вървят заедно на голям екран, учениците отговарят от телефоните, бързите печелят повече точки.') : L('Учениците решават сами, а вие виждате всеки на кой въпрос е и какво пише.')}</p>` : ''}</div>`}
      ${isLive ? '' : `<div class="card"><h3>${icon('calendar')}${L('Кога')}</h3><div class="rows">${sw('opensNow', st.opensNow, L('Отвори веднага'))}</div>
        ${st.opensNow ? '' : `<label class="fld"><span>${L('Отваря')}</span><input class="field" type="datetime-local" data-dt="opensAt" value="${toLocalInput(st.opensAt)}"></label>`}
        <div class="rows">${sw('noClose', st.noClose, L('Без краен срок'))}</div>
        ${st.noClose ? '' : `<label class="fld"><span>${L('Краен срок')}</span><input class="field" type="datetime-local" data-dt="closesAt" value="${toLocalInput(st.closesAt)}"></label>`}
        <div class="rows">${sw('lateAllowed', s.lateAllowed, L('Приемай закъснели'), L('отбелязани като закъснели'))}</div></div>`}
      ${practice || quiz ? (quiz ? `<div class="card"><label class="fld"><span>${L('Секунди за въпрос')}</span><input class="field" type="number" min="5" max="240" data-quizsec value="${s.quizSeconds}"></label></div>` : '') : `<div class="card"><h3>${icon('clock')}${L('Време и опити')}</h3><div class="t-inline"><label class="fld"><span>${L('Минути (0 = без ограничение)')}</span><input class="field" type="number" min="0" max="600" data-limit value="${st.timeLimitMin}"></label><label class="fld"><span>${L('Опити')}</span><input class="field" type="number" min="1" max="10" data-attempts value="${s.attempts}"></label></div>
        <div class="rows">${sw('shuffleQ', s.shuffleQ, L('Разбъркай въпросите'), L('всеки ученик ги вижда в различен ред'))}${sw('shuffleOpts', s.shuffleOpts, L('Разбъркай отговорите'))}${sw('oneByOne', s.oneByOne, L('Без връщане назад'))}</div></div>
      <div class="card t-ac"><h3>${icon('lock')}${L('Против преписване')}</h3>
        <p class="muted small">${st.kind === 'homework' ? L('За домашно само следим кога ученикът излиза. Включете защитата, ако е нужна.') : L('Включено за тестове. Ученикът вижда правилата, преди да започне.')}</p>
        ${ac.detectLeave ? `<span class="t-lab">${L('Когато ученикът излезе от теста')}</span><div class="seg t-mt">${[['log', 'Само сигнал'], ['lock', 'Заключи'], ['submit', 'Предай']].map(([k, l]) => `<button data-onleave="${k}" class="${ac.onLeave === k ? 'on' : ''}">${L(l)}</button>`).join('')}</div>
        ${ac.onLeave === 'log' ? `<p class="muted small">${L('Тестът продължава; вие виждате всяко излизане.')}</p>` : `<label class="fld"><span>${L('Предупреждения преди това (0 = веднага)')}</span><input class="field" type="number" min="0" max="10" data-allowed value="${ac.allowedLeaves}"></label>
          <p class="muted small">${ac.onLeave === 'lock' ? L('Заключеният ученик чака; вие го отключвате от монитора.') : L('Предава се това, което ученикът е написал дотук.')}</p>`}` : ''}
        <div class="rows">${sw('antiCheat.detectLeave', ac.detectLeave, L('Следи кога ученикът излиза'), L('друго приложение или раздел, разделен екран, плаващ прозорец, без интернет'))}
          ${sw('antiCheat.secure', ac.secure, L('Без снимки, запис и споделяне на екрана'), L('Android; в браузър снимките само се засичат'))}
          ${sw('antiCheat.noOverlays', ac.noOverlays, L('Без други приложения над теста'), L('плаващи прозорци, балончета на чатове, разделен екран'))}
          ${sw('antiCheat.lockApp', ac.lockApp, L('Закачи телефона към BingO'), L('Android: другите приложения не се отварят до края на теста'))}
          ${sw('antiCheat.fullscreen', ac.fullscreen, L('Цял екран на компютър'))}
          ${sw('antiCheat.blockCopy', ac.blockCopy, L('Без копиране и поставяне'))}
          ${sw('antiCheat.watermark', ac.watermark, L('Името на ученика върху теста'), L('снимка с друг телефон показва чий е тестът'))}
          ${sw('antiCheat.deviceCheck', ac.deviceCheck, L('Само на сигурен телефон'), L('не на телефон с root, на емулатор или с включено USB отстраняване на грешки'))}
          ${sw('antiCheat.blockA11y', ac.blockA11y, L('Без приложения, които четат екрана'), L('TalkBack и другите вградени в телефона са разрешени'))}
          ${sw('antiCheat.appOnly', ac.appOnly, L('Само в приложението за Android'), L('уеб версията не отваря този тест'))}
          ${sw('antiCheat.integrity', ac.integrity, L('Проверка от Google Play'), L('истинското BingO от Google Play на истински телефон (нужна е настройка)'))}</div></div>`}
      ${practice ? '' : `<div class="card"><h3>${icon('trophy')}${L('Оценяване')}</h3><select class="field" data-scale>${EDU_SCALES.map(k => `<option value="${k}" ${s.grading.scale === k ? 'selected' : ''}>${esc(L(SCALE_LABEL[k]))}</option>`).join('')}</select>
        ${s.grading.scale === 'bg6' ? `<div class="t-thresh">${[3, 4, 5, 6].map((g, k) => `<label class="fld"><span>${esc(L(EDU_GRADE_NAMES[g]))} ${g} ${L('от')} %</span><input class="field" type="number" min="0" max="100" data-th="${k}" value="${s.grading.thresholds[k]}"></label>`).join('')}</div>` : ''}
        ${hasOpen ? `<label class="fld"><span>${L('Отворени отговори и снимки')}</span><select class="field" data-aigr><option value="ai_review" ${s.aiGrading === 'ai_review' ? 'selected' : ''}>${L('Gemini предлага, аз одобрявам')}</option><option value="ai_auto" ${s.aiGrading === 'ai_auto' ? 'selected' : ''}>${L('Изцяло от Gemini')}</option><option value="manual" ${s.aiGrading === 'manual' ? 'selected' : ''}>${L('Само аз')}</option></select></label>
          <label class="fld"><span>${L('Указания към Gemini за целия тест')}</span><textarea class="field" rows="2" data-aiins placeholder="${L('напр. Оценявай като на матура; за непълен отговор — половината точки.')}">${esc(s.aiInstructions)}</textarea></label>` : ''}</div>`}
      <div class="card"><h3>${icon('eye')}${L('Какво виждат учениците след това')}</h3><select class="field" data-fbshow><option value="none" ${s.feedback.show === 'none' ? 'selected' : ''}>${L('Нищо')}</option><option value="score" ${s.feedback.show === 'score' ? 'selected' : ''}>${L('Само резултата и оценката')}</option><option value="full" ${s.feedback.show === 'full' ? 'selected' : ''}>${L('Резултата и верните отговори')}</option></select>
        ${s.feedback.show === 'none' ? '' : `<select class="field t-mt" data-fbwhen><option value="now" ${s.feedback.when === 'now' ? 'selected' : ''}>${L('Веднага след предаване')}</option><option value="close" ${s.feedback.when === 'close' ? 'selected' : ''}>${L('След крайния срок')}</option><option value="manual" ${s.feedback.when === 'manual' ? 'selected' : ''}>${L('Когато аз реша')}</option></select>`}</div>
      ${isLive ? '' : `<div class="card"><h3>${icon('google')}Google</h3><div class="rows">${sw('calendar', st.calendar, L('Добави в Google Calendar'), L('учениците получават покана и напомняне'))}${TD.classes.some(c => st.classIds.has(c.id) && c.classroomId) ? sw('classroom', st.classroom, L('Публикувай в Google Classroom')) : ''}</div></div>`}
      <button class="btn accent big block" data-go>${icon(isLive ? 'live' : 'send')}${isLive ? L('Отвори теста на живо') : L('Задай')}</button></div>`;
  };
  const setPath = (path, v) => { const ks = path.split('.'); let o = ['opensNow', 'noClose', 'calendar', 'classroom'].includes(ks[0]) ? st : st.settings; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; };
  const getPath = path => { const ks = path.split('.'); let o = ['opensNow', 'noClose', 'calendar', 'classroom'].includes(ks[0]) ? st : st.settings; for (const k of ks) o = o[k]; return o; };
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-cls]'); if (c) { st.classIds.has(c.dataset.cls) ? st.classIds.delete(c.dataset.cls) : st.classIds.add(c.dataset.cls); return draw(); }
    const k = e.target.closest('[data-kind]'); if (k) { st.kind = k.dataset.kind; if (st.kind !== 'homework' && !st.timeLimitMin) st.timeLimitMin = 40; if (st.kind === 'live') st.settings.feedback.when = 'close'; acFollow(); return draw(); }
    const m = e.target.closest('[data-mode]'); if (m) { st.mode = m.dataset.mode; acFollow(); return draw(); }
    const s = e.target.closest('[data-sw]'); if (s) { if (s.dataset.sw.startsWith('antiCheat.')) st.acTouched = true; setPath(s.dataset.sw, !getPath(s.dataset.sw)); return draw(); }
    const ol = e.target.closest('[data-onleave]'); if (ol) { st.acTouched = true; st.settings.antiCheat.onLeave = ol.dataset.onleave; return draw(); }
    const g = e.target.closest('[data-go]'); if (g) return busy(g, publish);
  });
  body.addEventListener('change', e => {
    const x = e.target, s = st.settings;
    if (x.dataset.dt) st[x.dataset.dt] = fromLocalInput(x.value);
    if (x.matches('[data-limit]')) st.timeLimitMin = Math.max(0, +x.value || 0);
    if (x.matches('[data-attempts]')) s.attempts = clamp(+x.value || 1, 1, 10);
    if (x.matches('[data-allowed]')) { st.acTouched = true; s.antiCheat.allowedLeaves = clamp(Math.floor(+x.value || 0), 0, 10); }
    if (x.matches('[data-quizsec]')) s.quizSeconds = clamp(+x.value || 20, 5, 240);
    if (x.matches('[data-scale]')) { s.grading.scale = x.value; draw(); }
    if (x.dataset.th != null) s.grading.thresholds[+x.dataset.th] = clamp(+x.value || 0, 0, 100);
    if (x.matches('[data-aigr]')) s.aiGrading = x.value;
    if (x.matches('[data-aiins]')) s.aiInstructions = x.value;
    if (x.matches('[data-fbshow]')) { s.feedback.show = x.value; draw(); }
    if (x.matches('[data-fbwhen]')) s.feedback.when = x.value;
    if (x.matches('[data-psubj]')) { s.practice.subject = x.value; s.practice.skills = []; draw(); }
    if (x.dataset.pskill) { const set = new Set(s.practice.skills); x.checked ? set.add(x.dataset.pskill) : set.delete(x.dataset.pskill); s.practice.skills = [...set]; }
    if (x.matches('[data-psize]')) s.practice.size = clamp(+x.value || 10, 4, 30);
  });
  async function publish() {
    if (!st.classIds.size) throw new Error(L('Изберете клас'));
    if (st.kind === 'practice' && !st.settings.practice.weakest && !st.settings.practice.skills.length) throw new Error(L('Изберете умения или „най-слабите“'));
    const opensAt = st.kind === 'live' || st.opensNow ? Date.now() : st.opensAt;
    const closesAt = st.kind === 'live' || st.noClose ? null : st.closesAt;
    if (closesAt && closesAt <= opensAt) throw new Error(L('Крайният срок е преди отварянето'));
    const sp = st.settings.practice, subjTitle = SUBJECTS[sp.subject] ? L(SUBJECTS[sp.subject].title) : '';
    const r = await callFn('publishAssignment', {
      classIds: [...st.classIds], testId: test ? test.id : '', title: test ? test.title : L('Упражнение: {s}', { s: subjTitle }), description: test ? test.description : '', subject: test ? test.subject : subjTitle,
      tasks: test ? test.tasks : [], kind: st.kind, mode: st.mode, opensAt, closesAt, timeLimitMin: st.timeLimitMin, settings: st.settings, ...(plan ? { planId: plan.id } : {})
    });
    for (const aid of r.assignmentIds) {
      if (st.calendar) await calendarForAssignment(aid).catch(e => toast(L('Google Calendar: {e}', { e: errMsg(e) }), 'bad'));
      if (st.classroom) await classroomPostAssignment(aid).catch(e => toast(L('Google Classroom: {e}', { e: errMsg(e) }), 'bad'));
    }
    if (plan) await planAttach(plan, r.assignmentIds[0], test ? test.id : '').catch(e => console.warn('plan', e));
    toast(r.assignmentIds.length > 1 ? L('Зададено на {n} класа', { n: r.assignmentIds.length }) : L('Зададено!'));
    while (NAV.length > 1) leave(NAV.pop());
    go(st.kind === 'live' ? 'tLive' : 'tAssignment', { aid: r.assignmentIds[0] });
  }
  tWatchBase(nav, draw, ['classes']);
  draw();
};
