/* ================= First-run setup: a short series of screens =================
   Logic first, looks later: the steps, validation and saving are plain functions (easy to test
   in Node); SCREENS.onboarding at the bottom is a deliberately plain screen built from the
   existing classes, to be restyled. Progress is saved in S.onboarding, so an interrupted setup
   resumes. People who already have data are marked done, so an update never shows it to them. */
const ONBOARD = {
  steps: [
    { id: 'welcome', title: 'Добре дошъл в BingO', text: 'Няколко кратки въпроса и приложението е готово. Всичко може да се промени по-късно в Профил и Настройки.', fields: [
      { key: 'lang', path: 'settings.lang', type: 'choice', options: LANGS, native: true, validate: v => (['bg', 'en'].includes(v) ? '' : 'Избери език') }
    ] },
    { id: 'profile', title: 'Кой си ти?', text: 'Името и годините са по желание. Учителят вижда името само ако свържеш Google Sheets.', skippable: true, fields: [
      { key: 'name', path: 'profile.name', type: 'text', label: 'Име и фамилия', ph: 'напр. Мария Петрова', maxlength: 120, validate: v => (v.length > 40 ? 'Най-много 40 знака' : '') },
      { key: 'age', path: 'profile.age', type: 'number', label: 'Години', ph: 'напр. 17', validate: v => (/^\d+$/.test(v) && +v >= 7 && +v <= 99 ? '' : 'Въведи години от 7 до 99') }
    ] },
    { id: 'exam', title: () => (examFromAge(S.profile.age) ? L('Значи за {e}, нали?', { e: L(EXAMS[examFromAge(S.profile.age)]) }) : L('За кой изпит се готвиш?')), text: 'Ако не е така, избери своя клас.', fields: [
      { key: 'exam', path: 'profile.exam', type: 'choice', required: true, options: () => Object.entries(EXAMS).map(([id, name]) => [id, L(name)]), validate: v => (EXAMS[v] ? '' : 'Избери изпит') }
    ] },
    { id: 'track', title: 'Какъв е профилът ти?', when: () => needsTrack(S.profile.exam), text: () => (S.profile.exam === 'nvo10' ? L('НВО в 10-ти клас е еднакво за всички, но профилът решава коя ще е втората ти матура в 12-ти клас.') : L('Профилът решава коя може да е втората ти матура в 12-ти клас.')), fields: [
      { key: 'track', path: 'profile.track', type: 'choice', list: true, required: true, options: () => Object.entries(TRACKS).map(([id, t]) => [id, t.icon + ' ' + L(t.title)]), validate: v => (TRACKS[v] ? '' : 'Избери профил') }
    ] },
    { id: 'extra', title: 'Допълнителна матура?', when: () => needsTrack(S.profile.exam) && !!TRACKS[S.profile.track], skippable: true, text: 'Освен двете задължителни можеш да се явиш и на допълнителна матура. Пропусни, ако нямаш.', fields: [
      { key: 'extra', path: 'profile.extra', type: 'choice', list: true, required: true, options: () => extraOptions(S.profile.track), validate: (v, d) => (extraOptions(S.profile.track).some(o => o[0] === v) ? '' : 'Избери матура') }
    ] },
    { id: 'subject', title: 'Коя матура първо?', text: () => examPlanFull(S.profile.exam, S.profile.track, S.profile.extra) + ' ' + L('Можеш да сменяш предмета по всяко време от началния екран.'), fields: [
      { key: 'subject', path: 'subject', type: 'choice', required: true, options: () => subjectOptions(S.profile.track, S.profile.extra), validate: v => (SUBJECTS[v] ? '' : 'Избери матура') }
    ] },
    { id: 'theme', title: 'Как да изглежда?', text: '„Системна“ следва светлата или тъмната тема на телефона.', fields: [
      { key: 'theme', path: 'settings.theme', type: 'choice', required: true, options: [['auto', 'Системна'], ['light', 'Светла'], ['dark', 'Тъмна'], ['amoled', 'AMOLED']], validate: v => (['auto', 'light', 'dark', 'amoled'].includes(v) ? '' : 'Избери тема') }
    ] },
    { id: 'ai', title: 'Gemini (по желание)', text: 'Обяснява грешките и дава подсказки без отговора. Без него приложението работи изцяло.', skippable: true, fields: [
      { key: 'aiMode', path: 'settings.aiMode', type: 'choice', required: true, options: [['off', 'Изключен'], ['key', 'API ключ'], ['proxy', 'Vertex AI сървър']], validate: v => (['off', 'key', 'proxy'].includes(v) ? '' : 'Избери режим') },
      { key: 'apiKey', path: 'settings.apiKey', type: 'password', label: 'Gemini API ключ', ph: 'от aistudio.google.com', showIf: d => d.aiMode === 'key', required: d => d.aiMode === 'key' },
      { key: 'proxyUrl', path: 'settings.proxyUrl', type: 'text', label: 'Адрес на сървъра (Cloud Run)', ph: 'https://bingo-ai-xxxx.run.app', showIf: d => d.aiMode === 'proxy', required: d => d.aiMode === 'proxy', validate: v => (/^https:\/\//.test(v) ? '' : 'Адресът трябва да започва с https://') }
    ] },
    { id: 'sheets', title: 'Свързване с учител (по желание)', text: 'Ако учителят ти е дал адрес на Apps Script, постави го тук. Иначе пропусни.', skippable: true, fields: [
      { key: 'sheetUrl', path: 'settings.sheetUrl', type: 'text', label: 'Адрес на Apps Script (Web app)', ph: 'https://script.google.com/macros/s/…/exec', validate: v => (/^https:\/\/script\.google\.com\//.test(v) ? '' : 'Адресът трябва да е от script.google.com') }
    ] },
    { id: 'done', title: 'Готово!', text: 'Започни с кратка диагностика, за да видим къде губиш най-много точки.', fields: [] }
  ]
};

/* Which exam a learner of this age prepares for. In Bulgaria 1st grade starts at 7, so the grade is
   about age − 6: up to 4th grade it is НВО 4, 5th–7th НВО 7, 8th–10th НВО 10, above 10th the ДЗИ in 12th. */
const EXAMS = { nvo4: 'НВО 4-ти клас', nvo7: 'НВО 7-ми клас', nvo10: 'НВО 10-ти клас', dzi12: 'ДЗИ 12-ти клас' };
function examFromAge(age) {
  const a = parseInt(age, 10); if (!(a >= 7 && a <= 99)) return '';
  const grade = a - 6;
  return grade > 10 ? 'dzi12' : grade > 7 ? 'nvo10' : grade > 4 ? 'nvo7' : 'nvo4';
}

/* High-school profiles (Наредба № 4 за учебния план) and the usual profiling subjects of each. With a
   profile the 2nd ДЗИ is one of the profiling subjects; in a vocational school it is the state exam for
   a professional qualification (ЗПУО, чл. 134). Schools pick the exact profiling subjects themselves. */
const TRACKS = {
  math: { icon: '🧮', title: 'Математически', dzi: ['математика', 'информатика', 'информационни технологии', 'физика и астрономия'] },
  soft: { icon: '💻', title: 'Софтуерни и хардуерни науки', dzi: ['информатика', 'информационни технологии', 'математика'] },
  nat: { icon: '🔬', title: 'Природни науки', dzi: ['биология и здравно образование', 'химия и опазване на околната среда', 'физика и астрономия', 'математика'] },
  econ: { icon: '📊', title: 'Икономическо развитие', dzi: ['география и икономика', 'математика', 'информационни технологии', 'чужд език'] },
  ent: { icon: '🚀', title: 'Предприемачески', dzi: ['предприемачество', 'география и икономика', 'информационни технологии', 'чужд език'] },
  lang: { icon: '🌍', title: 'Чужди езици', dzi: ['чужд език'] },
  hum: { icon: '📜', title: 'Хуманитарни науки', dzi: ['български език и литература', 'история и цивилизации', 'чужд език', 'философия'] },
  soc: { icon: '🏛️', title: 'Обществени науки', dzi: ['история и цивилизации', 'математика', 'чужд език', 'философия'] },
  art: { icon: '🎨', title: 'Изобразително изкуство', dzi: ['изобразително изкуство'] },
  music: { icon: '🎵', title: 'Музика', dzi: ['музика'] },
  sport: { icon: '⚽', title: 'Физическо възпитание и спорт', dzi: ['физическо възпитание и спорт', 'биология и здравно образование'] },
  prof: { icon: '🛠️', title: 'Професионална гимназия', dzi: [] }
};
/* 4th and 7th grade have no profile yet, so the profile question is skipped for them */
const needsTrack = exam => exam === 'nvo10' || exam === 'dzi12';
function examPlan(exam, track) {
  if (exam === 'nvo4') return 'На НВО в 4-ти клас: БЕЛ, математика, човекът и обществото, човекът и природата.';
  if (exam === 'nvo7') return 'На НВО в 7-ми клас: БЕЛ и математика, по желание и чужд език.';
  if (exam === 'nvo10') return 'На НВО в 10-ти клас: БЕЛ и математика, по желание чужд език и информационни технологии.';
  if (exam !== 'dzi12') return '';
  const t = TRACKS[track];
  if (!t) return 'На матурите: БЕЛ (задължителна) и втора по избор.';
  if (track === 'prof') return 'На матурите: БЕЛ (задължителна) и държавен изпит за професионална квалификация.';
  return `На матурите: БЕЛ (задължителна) и втора по избор от профилиращите предмети: ${t.dzi.join(', ')}.`;
}
const examPlanFull = (exam, track, extra) => examPlan(exam, track) + (exam === 'dzi12' && extraText(extra) ? ` Допълнителна: ${extraText(extra)}.` : '');
/* БЕЛ first (it is the 1st matura for everyone), then the learner's profile in the 2nd place. The app
   only has mathematics besides БЕЛ, so a profile without mathematics is shown but can't be picked yet. */
const trackHasMath = track => !!TRACKS[track] && TRACKS[track].dzi.includes('математика');
function subjectOptions(track, extra) {
  const bel = SUBJECTS.bel, math = SUBJECTS.math, t = TRACKS[track];
  const second = !t ? [math.id, math.icon + ' ' + L(math.title)]
    : trackHasMath(track) ? [math.id, t.icon + ' ' + L(t.title)] : ['', t.icon + ' ' + L(t.title) + L(' (скоро)'), true];
  const opts = [[bel.id, bel.icon + ' ' + L(bel.title)], second];
  /* the extra matura in the 3rd place; mathematics only once, so a math profile already covers it */
  if (extra === EXTRA_MATH && second[0] !== math.id) opts.push([math.id, math.icon + ' ' + L(math.title)]);
  else if (TRACKS[extra] && extra !== track) opts.push(trackHasMath(extra) && second[0] !== math.id ? [math.id, TRACKS[extra].icon + ' ' + L(TRACKS[extra].title)] : ['', TRACKS[extra].icon + ' ' + L(TRACKS[extra].title) + L(' (скоро)'), true]);
  return opts;
}
/* The extra (optional) ДЗИ: mathematics or one of the other profiles' subjects */
const EXTRA_MATH = 'maths';
const extraOptions = track => [[EXTRA_MATH, '📐 ' + L('Математика')], ...Object.entries(TRACKS).filter(([id]) => id !== track && id !== 'prof').map(([id, t]) => [id, t.icon + ' ' + L(t.title)])];
const extraText = extra => (extra === EXTRA_MATH ? 'математика' : TRACKS[extra] ? TRACKS[extra].title.toLowerCase() + ' (профилиращ предмет)' : '');
const obText = v => (typeof v === 'function' ? v() : v);
const obTitle = step => obText(step.title);
const obActive = step => !step.when || step.when();

/* ---------- state helpers ---------- */
const obState = () => {
  const o = S.onboarding || (S.onboarding = { done: false, step: 0 });
  o.step = clamp(o.step | 0, 0, ONBOARD.steps.length - 1);
  return o;
};
const obStep = () => ONBOARD.steps[obState().step];
const obGet = path => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S);
function obSet(path, val) { const p = path.split('.'), k = p.pop(); p.reduce((o, x) => o[x], S)[k] = val; }
const obVisible = (f, d) => !f.showIf || f.showIf(d);

/* ---------- logic ---------- */
function onboardingNeeded() {
  if (S.onboarding) return !S.onboarding.done;
  if (S.log.length || S.sessions || (S.profile && S.profile.name)) {
    S.onboarding = { done: true, step: 0, existing: true }; saveState(true); return false;
  }
  return true;
}

/* d = { fieldKey: value } for the current step -> { fieldKey: message } (empty object = valid) */
function obValidate(step, d) {
  const errors = {};
  for (const f of step.fields) {
    if (!obVisible(f, d)) continue;
    const v = String(d[f.key] == null ? '' : d[f.key]).trim();
    const req = typeof f.required === 'function' ? f.required(d) : f.required;
    if (req && !v) errors[f.key] = 'Задължително поле';
    else if (v && f.validate) { const m = f.validate(v, d); if (m) errors[f.key] = m; }
  }
  return errors;
}
function obApply(step, d) {
  for (const f of step.fields) {
    const v = String(d[f.key] == null ? '' : d[f.key]).trim();
    if (obVisible(f, d) && !(f.type === 'choice' && !v)) obSet(f.path, v);
  }
  if (step.id === 'theme') { APP.settings.theme = S.settings.theme; applySettings(); }
  if (step.id === 'exam' && !needsTrack(S.profile.exam)) S.profile.track = '';
  if (step.id === 'exam' && !needsTrack(S.profile.exam)) S.profile.extra = '';
  if (step.id === 'track' && !trackHasMath(S.profile.track)) S.subject = 'bel';   /* its 2nd matura has no tasks here yet */
  if (step.id === 'track' && S.profile.extra === S.profile.track) S.profile.extra = '';
  if (step.id === 'profile') S.profile.exam = examFromAge(S.profile.age) || S.profile.exam || '';  /* the next step suggests the exam for this age */
  if (step.id === 'welcome') { APP.settings.lang = S.settings.lang; applySettings(); }
}
function obMove(dir) {
  const o = obState(), last = ONBOARD.steps.length - 1;
  let i = clamp(o.step + dir, 0, last);
  while (i > 0 && i < last && !obActive(ONBOARD.steps[i])) i += dir;   /* steps that don't apply are passed over */
  o.step = i; saveState(true);
  return { ok: true, done: false, step: o.step };
}

function onboardingNext(d) {
  d = d || {};
  const step = obStep(), errors = obValidate(step, d);
  if (Object.keys(errors).length) return { ok: false, errors };
  obApply(step, d);
  if (obState().step >= ONBOARD.steps.length - 1) return onboardingFinish();
  return obMove(1);
}
function onboardingBack() { return obState().step > 0 ? obMove(-1) : { ok: false }; }
function onboardingSkip() {
  const step = obStep(); if (!step.skippable) return { ok: false };
  if (step.id === 'extra') S.profile.extra = '';   /* skipping means "no extra matura" */
  return obMove(1);
}
function onboardingFinish() {
  const o = obState(); o.done = true; o.finishedAt = Date.now(); saveState(true);
  return { ok: true, done: true };
}
let _obShown = 0;   /* last drawn bar fraction, so the intro bar animates from there to the new step */
function onboardingRestart() { S.onboarding = { done: false, step: 0 }; _obShown = 0; saveState(true); }

/* "Clear my answers" keeps the profile and settings, so it must keep the setup state too */
const _resetStateBase = resetState;
resetState = function (keepSettings) {
  const ob = S.onboarding;
  _resetStateBase(keepSettings);
  if (keepSettings && ob) { S.onboarding = ob; saveState(true); }
};

/* ---------- a plain screen on top of the logic (restyle later) ---------- */
/* Android back and the browser back go one step back during setup instead of closing the app */
const _backHook = window.__back;
window.__back = () => {
  const cur = NAV[NAV.length - 1];
  if (cur && cur.screen === 'onboarding' && !overlays.length && obState().step > 0) { onboardingBack(); refresh(); return 'h'; }
  return _backHook ? _backHook() : '';
};

SCREENS.onboarding = async el => {
  el.style.setProperty('--accent', SUBJECTS[S.subject].color); el.style.setProperty('--accent-ink', inkOn(SUBJECTS[S.subject].color));
  const o = obState(), step = obStep(), isLast = o.step >= ONBOARD.steps.length - 1;
  const shown = ONBOARD.steps.filter(obActive), n = shown.length, pos = shown.indexOf(step) + 1;
  const d = {}; step.fields.forEach(f => { const v = obGet(f.path); d[f.key] = v == null ? '' : v; });
  let errors = {};
  const fieldHtml = f => {
    if (!obVisible(f, d)) return '';
    const err = errors[f.key] ? `<small class="ob-err">${esc(L(errors[f.key]))}</small>` : '';
    if (f.type === 'choice') {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      return `<div class="seg${f.list ? ' list' : ''}" data-key="${f.key}">${opts.map(([v, label, off]) => `<button data-v="${esc(v)}" class="${!off && d[f.key] === v ? 'on' : ''}"${off ? ' disabled' : ''}>${esc(f.native ? label : L(label))}</button>`).join('')}</div>${err}`;
    }
    return `<label class="fld"><span>${esc(L(f.label))}</span><input class="field" data-k="${f.key}" type="${f.type}" value="${esc(d[f.key])}" placeholder="${esc(L(f.ph || ''))}"${f.maxlength ? ` maxlength="${f.maxlength}"` : ''} autocomplete="off" spellcheck="false"></label>${err}`;
  };
  const draw = () => {
    el.innerHTML = `<div class="pad onboarding">
      <header class="ob-top">${o.step > 0 ? `<button class="iconbtn" data-ob="back" aria-label="${L('Назад')}">${icon('back')}</button>` : '<span class="tb-gap"></span>'}<div class="duo anim" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${pos}"><i style="width:${_obShown * 100}%"></i></div><span class="ob-count">${pos}/${n}</span></header>
      ${o.step === 0 || isLast ? '<div class="brand bingo ob-brand">Bing<span>O</span></div>' : ''}
      <h1 class="ob-title">${esc(L(obTitle(step)))}</h1><p class="muted ob-text">${esc(L(obText(step.text)))}</p>
      ${step.fields.length ? `<section class="card ob-card">${step.fields.map(fieldHtml).join('')}</section>` : ''}
      <div class="ob-actions"><button class="btn accent big block" data-ob="next">${isLast ? L('Към BingO') : L('Напред')}</button>
      ${step.skippable ? `<button class="btn ghost block" data-ob="skip">${L('Пропусни')}</button>` : ''}</div></div>`;
    el.querySelector('[data-k]')?.focus({ preventScroll: true });
    const duo = el.querySelector('.duo'), fill = duo.firstElementChild, to = pos / n;
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = (to * 100) + '%'; duo.classList.toggle('full', to === 1); }));
    _obShown = to;
  };
  draw();
  el.addEventListener('click', e => {
    const b = e.target.closest('.seg button');
    if (b) {
      const key = b.parentNode.dataset.key; d[key] = b.dataset.v;
      if (key === 'theme') { S.settings.theme = d.theme; APP.settings.theme = d.theme; applySettings(); }
      if (key === 'lang') { S.settings.lang = d.lang; APP.settings.lang = d.lang; applySettings(); saveState(); }
      return draw();
    }
    const a = e.target.closest('[data-ob]'); if (!a) return;
    if (a.dataset.ob === 'back') { onboardingBack(); return refresh(); }
    if (a.dataset.ob === 'skip') { onboardingSkip(); return refresh(); }
    const res = onboardingNext(d);
    if (!res.ok) { errors = res.errors; return draw(); }
    if (res.done) return go('home', {}, { replace: true });
    refresh();
  });
  el.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (i) d[i.dataset.k] = i.value; });
};
