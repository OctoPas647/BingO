/* ================= Settings: who you are, Gemini / Vertex AI, Google Sheets, demo ================= */
SCREENS.settings = async el => {
  const st = S.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, label]) => `<button data-v="${v}" class="${st[key] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
  const field = (key, label, ph, type = 'text', obj = 'settings') => `<label class="fld"><span>${esc(label)}</span><input class="field" data-f="${obj}.${key}" type="${type}" value="${esc((obj === 'profile' ? S.profile : st)[key] || '')}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></label>`;
  el.innerHTML = `${topbar('Настройки')}<div class="pad settings">
    <section class="card"><h3>✦ Gemini</h3>${seg('aiMode', [['off', 'Изключен'], ['key', 'API ключ'], ['proxy', 'Vertex AI сървър']])}
      <div class="ai-key" ${st.aiMode === 'key' ? '' : 'hidden'}>${field('apiKey', 'Gemini API ключ', 'от aistudio.google.com', 'password')}
        <p class="muted small">Ключът стои само на това устройство. За прототип е добре; за истински ученици ползвай сървъра (Vertex AI).</p></div>
      <div class="ai-proxy" ${st.aiMode === 'proxy' ? '' : 'hidden'}>${field('proxyUrl', 'Адрес на сървъра (Cloud Run)', 'https://bingo-ai-xxxx.run.app')}</div>
      <div ${st.aiMode === 'off' ? 'hidden' : ''}>${field('model', 'Модел', 'gemini-3.8-flash')}<button class="btn ghost block" data-test>${icon('bolt')}Провери връзката</button></div>
      <p class="muted small">Gemini обяснява грешките, дава подсказки без отговора, прави нови задачи за слабите теми и седмичен план. Без него приложението работи изцяло.</p></section>
    <section class="card"><h3>${icon('upload')}Google Sheets → Looker Studio</h3>${field('sheetUrl', 'Адрес на Apps Script (Web app)', 'https://script.google.com/macros/s/…/exec')}
      <p class="muted small">Всеки отговор става ред в таблица на учителя. Как се прави — apps-script/Code.gs в проекта.</p></section>
    <section class="card"><h3>${icon('moon')}Тема</h3>${seg('theme', [['auto', 'Системна'], ['light', 'Светла'], ['dark', 'Тъмна'], ['amoled', 'AMOLED']])}
      <p class="muted small">„Системна“ следва светлата или тъмната тема на телефона.</p>
      <div class="rows"><div class="row"><span>${icon('sound')}Звуци</span><button class="switch${st.sound ? ' on' : ''}" data-sw="sound" role="switch"><i></i></button></div></div></section>
    <section class="card"><h3>${icon('eye')}Демо</h3>
      <button class="btn ghost block" data-demo>${icon('play')}Зареди демо ученик</button>
      ${demoBackupExists() ? `<button class="btn ghost block" data-restore>${icon('reset')}Върни моите отговори</button>` : ''}
      <button class="btn ghost block" data-setup>${icon('reset')}Начална настройка отново</button>
      <button class="btn ghost danger-text block" data-wipe>${icon('trash')}Изчисти всичките ми отговори</button></section>
    <section class="card"><h3>${icon('info')}За BingO</h3><p class="small"><b>BingO</b> alpha · подготовка за матура без зубрене: работа върху слабите места, не повтаряне на силните.</p>
      <p class="muted small">Построено върху Shelly (задачи, точкуване, модули) и идеи от BrainBurst, BandUp и SQL Practice. EduHack Plovdiv 2026.</p></section>
  </div>`;
  el.addEventListener('click', async e => {
    const b = e.target.closest('.seg button');
    if (b) { st[b.parentNode.dataset.key] = b.dataset.v; APP.settings.theme = st.theme; saveState(); applySettings(); return refresh(); }
    const w = e.target.closest('[data-sw]');
    if (w) { st.sound = !st.sound; APP.settings.sound = st.sound; saveState(); w.classList.toggle('on'); return; }
    if (e.target.closest('[data-setup]')) { onboardingRestart(); NAV.length = 0; NAV.push({ screen: 'onboarding', params: {} }); return render(); }
    if (e.target.closest('[data-demo]')) { if (await loadDemoLearner()) { toast('Зареден е демо ученик'); home(); } return; }
    if (e.target.closest('[data-restore]')) { if (restoreFromDemo()) { APP.settings.theme = S.settings.theme; applySettings(); toast('Твоите отговори са върнати'); home(); } else toast('Копието не може да се прочете', 'bad'); return; }
    if (e.target.closest('[data-wipe]') && await confirmBox('Да изчистим ли всичко?', 'Картата на уменията и всички отговори на това устройство ще се изтрият.', 'Изчисти', true)) { resetState(true); toast('Изчистено'); return home(); }
    if (e.target.closest('[data-test]')) {
      const tb = e.target.closest('[data-test]'); tb.disabled = true;
      try { const j = await callAI({ prompt: 'Отговори с JSON {"ok": true, "msg": "кратък поздрав на български за ученик преди матура"}', temperature: 0.7 }); toast('Работи! ' + (j.msg || '')); }
      catch (err) { toast('Не стана: ' + err.message, 'bad'); }
      tb.disabled = false;
    }
  });
  /* A value is saved only when it is valid; otherwise the field says what is wrong and the last
     good value stays (the same rules the first-run setup and loadState use) */
  const SETTING_MSG = {
    apiKey: 'Ключът не може да съдържа интервали',
    model: 'Само латински букви, цифри, точка и тире (напр. gemini-3.8-flash)',
    proxyUrl: 'Адресът трябва да започва с https://',
    sheetUrl: 'Адресът трябва да започва с https://script.google.com/'
  };
  const fieldError = (f, msg) => {
    f.classList.toggle('invalid', !!msg); f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    let m = f.parentNode.querySelector('.fld-err');
    if (msg && !m) { m = document.createElement('small'); m.className = 'fld-err danger-text'; f.after(m); }
    if (m) { m.textContent = msg || ''; m.hidden = !msg; }
  };
  el.addEventListener('input', e => {
    const f = e.target.closest('[data-f]'); if (!f) return;
    const [obj, key] = f.dataset.f.split('.'), v = f.value.trim(), ok = SETTING_OK[key];
    if (obj === 'settings' && ok && !ok(v)) {
      if (!(key === 'model' && v === '')) return fieldError(f, SETTING_MSG[key] || 'Невалидна стойност');
      return fieldError(f, 'Задължително поле');
    }
    fieldError(f, ''); (obj === 'profile' ? S.profile : st)[key] = v; saveState();
  });
  /* leaving a field with a wrong value puts the saved value back */
  el.addEventListener('focusout', e => {
    const f = e.target.closest('[data-f]'); if (!f || !f.classList.contains('invalid')) return;
    const [obj, key] = f.dataset.f.split('.'); f.value = (obj === 'profile' ? S.profile : st)[key] || ''; fieldError(f, '');
    toast('Невалидната стойност не е запазена');
  });
};
