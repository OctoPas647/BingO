/* ================= First-run setup: a short series of screens =================
   Logic first, looks later: the steps, validation and saving are plain functions (easy to test
   in Node); SCREENS.onboarding at the bottom is a deliberately plain screen built from the
   existing classes, to be restyled. Progress is saved in S.onboarding, so an interrupted setup
   resumes. People who already have data are marked done, so an update never shows it to them. */
const ONBOARD = {
  steps: [
    { id: 'welcome', title: 'Добре дошъл в BingO', text: 'Няколко кратки въпроса и приложението е готово. Всичко може да се промени по-късно в Профил и Настройки.', fields: [] },
    { id: 'profile', title: 'Кой си ти?', text: 'Името и класът са по желание. Учителят ги вижда само ако свържеш Google Sheets.', skippable: true, fields: [
      { key: 'name', path: 'profile.name', type: 'text', label: 'Име', ph: 'напр. Мария П.', validate: v => (v.length > 40 ? 'Най-много 40 знака' : '') },
      { key: 'cls', path: 'profile.cls', type: 'text', label: 'Клас', ph: 'напр. 12а', validate: v => (v.length > 10 ? 'Най-много 10 знака' : '') }
    ] },
    { id: 'subject', title: 'Коя матура първо?', text: 'Можеш да сменяш предмета по всяко време от началния екран.', fields: [
      { key: 'subject', path: 'subject', type: 'choice', required: true, options: () => Object.values(SUBJECTS).map(s => [s.id, s.icon + ' ' + s.title]), validate: v => (SUBJECTS[v] ? '' : 'Избери матура') }
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
  for (const f of step.fields) if (obVisible(f, d)) obSet(f.path, String(d[f.key] == null ? '' : d[f.key]).trim());
  if (step.id === 'theme') { APP.settings.theme = S.settings.theme; applySettings(); }
}
function obMove(dir) {
  const o = obState(); o.step = clamp(o.step + dir, 0, ONBOARD.steps.length - 1); saveState(true);
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
function onboardingSkip() { return obStep().skippable ? obMove(1) : { ok: false }; }
function onboardingFinish() {
  const o = obState(); o.done = true; o.finishedAt = Date.now(); saveState(true);
  return { ok: true, done: true };
}
function onboardingRestart() { S.onboarding = { done: false, step: 0 }; saveState(true); }

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
  const o = obState(), step = obStep(), n = ONBOARD.steps.length, isLast = o.step >= n - 1;
  const d = {}; step.fields.forEach(f => { const v = obGet(f.path); d[f.key] = v == null ? '' : v; });
  let errors = {};
  const fieldHtml = f => {
    if (!obVisible(f, d)) return '';
    const err = errors[f.key] ? `<small class="ob-err">${esc(errors[f.key])}</small>` : '';
    if (f.type === 'choice') {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      return `<div class="seg" data-key="${f.key}">${opts.map(([v, label]) => `<button data-v="${esc(v)}" class="${d[f.key] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>${err}`;
    }
    return `<label class="fld"><span>${esc(f.label)}</span><input class="field" data-k="${f.key}" type="${f.type}" value="${esc(d[f.key])}" placeholder="${esc(f.ph || '')}" autocomplete="off" spellcheck="false"></label>${err}`;
  };
  const draw = () => {
    el.innerHTML = `<div class="pad onboarding">
      <header class="ob-top">${o.step > 0 ? `<button class="iconbtn" data-ob="back" aria-label="Назад">${icon('back')}</button>` : '<span class="tb-gap"></span>'}${bar((o.step + 1) / n, 'ob-bar')}<span class="ob-count">${o.step + 1}/${n}</span></header>
      ${o.step === 0 || isLast ? '<div class="brand bingo ob-brand">Bing<span>O</span></div>' : ''}
      <h1 class="ob-title">${esc(step.title)}</h1><p class="muted ob-text">${esc(step.text)}</p>
      ${step.fields.length ? `<section class="card ob-card">${step.fields.map(fieldHtml).join('')}</section>` : ''}
      <div class="ob-actions"><button class="btn accent big block" data-ob="next">${isLast ? 'Към BingO' : 'Напред'}</button>
      ${step.skippable ? '<button class="btn ghost block" data-ob="skip">Пропусни</button>' : ''}</div></div>`;
    el.querySelector('[data-k]')?.focus({ preventScroll: true });
  };
  draw();
  el.addEventListener('click', e => {
    const b = e.target.closest('.seg button');
    if (b) {
      const key = b.parentNode.dataset.key; d[key] = b.dataset.v;
      if (key === 'theme') { S.settings.theme = d.theme; APP.settings.theme = d.theme; applySettings(); }
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
