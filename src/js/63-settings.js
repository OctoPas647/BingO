/* ================= Settings: who you are, Gemini / Vertex AI, Google Sheets, demo ================= */
/* icons for the Liquid glass switch and the feedback card */
Object.assign(ICONS, {
  spark: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.4 4.3 4.3 0 0 0 7 18z"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  motion: '<path d="M4 12h3M17 12h3M12 4v3M12 17v3"/><circle cx="12" cy="12" r="3.2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', glass: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>' });

SCREENS.settings = async el => {
  const st = S.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, label]) => `<button data-v="${v}" class="${st[key] === v ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
  const field = (key, label, ph, type = 'text', obj = 'settings') => `<label class="fld"><span>${esc(label)}</span><input class="field" data-f="${obj}.${key}" type="${type}" value="${esc((obj === 'profile' ? S.profile : st)[key] || '')}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></label>`;
  el.innerHTML = `${topbar(L('Настройки'))}<div class="pad settings">
    <section class="card"><h3>${icon('globe')}Език · Language</h3>${seg('lang', LANGS)}
      <p class="muted small">${L('Езикът сменя менютата и бутоните. Задачите остават на български.')}</p></section>
    <section class="card"><h3>${icon('spark')}${L('Изкуствен интелект')}</h3>
      <div class="rows">
        <div class="row"><span>${icon('cloud')}<span class="row-text"><b>Gemini</b><small class="muted" data-cloud-state>${AI_SERVER ? L('Облак · сървърът на BingO') : L('Сървърът още не е настроен')}</small></span></span><button class="switch${st.ai !== false ? ' on' : ''}" data-sw="ai" role="switch" aria-checked="${st.ai !== false}"><i></i></button></div>
        <div class="row"><span>${icon('chip')}<span class="row-text"><b>Gemini Nano</b><small class="muted" data-nano-state></small></span></span><button class="switch${st.nano !== false ? ' on' : ''}" data-sw="nano" role="switch" aria-checked="${st.nano !== false}"><i></i></button></div>
      </div>
      <button class="btn ghost block" data-nano-dl hidden>${icon('download')}${L('Изтегли Gemini Nano')}</button>
      ${AI_SERVER ? `<button class="btn ghost block" data-test>${icon('bolt')}${L('Провери връзката')}</button>` : ''}
      <p class="muted small">${L('И двата модела са на Google. Gemini в облака прави новите задачи, обяснява грешките и проверява свободните отговори; Gemini Nano работи на самото устройство — мигновено и без интернет — дава първата подсказка и проверява задачите на Gemini. Не е нужен никакъв ключ.')}</p></section>
    <section class="card"><h3>${icon('upload')}Google Sheets → Looker Studio</h3>${field('sheetUrl', L('Адрес на Apps Script (Web app)'), 'https://script.google.com/macros/s/…/exec')}
      <p class="muted small">${L('Всеки отговор става ред в таблица на учителя. Как се прави — apps-script/Code.gs в проекта.')}</p></section>
    <section class="card"><h3>${icon('moon')}${L('Тема')}</h3>${seg('theme', [['auto', L('Системна')], ['light', L('Светла')], ['dark', L('Тъмна')], ['amoled', 'AMOLED']])}
      <p class="muted small">${L('„Системна“ следва светлата или тъмната тема на телефона.')}</p>
      <div class="rows">
        <div class="row"><span>${icon('glass')}${L('Liquid glass')}</span><button class="switch${st.glass ? ' on' : ''}" data-sw="glass" role="switch"><i></i></button></div>
        <div class="row"><span>${icon('motion')}${L('Анимации')}</span><button class="switch${st.motion !== false ? ' on' : ''}" data-sw="motion" role="switch"><i></i></button></div>
        <div class="row"><span>${icon('sound')}${L('Звуци')}</span><button class="switch${st.sound ? ' on' : ''}" data-sw="sound" role="switch"><i></i></button></div></div>
      <p class="muted small">${L('Liquid glass: менютата и лентите са от полупрозрачно стъкло над съдържанието, както в iOS. Изключи го, ако телефонът е бавен или искаш повече контраст.')}</p>
      ${smoothSetting(st)}</section>
    <section class="card"><h3>${icon('chat')}${L('Обратна връзка')}</h3>
      <button class="btn ghost block" data-feedback>${icon('chat')}${L('Изпрати обратна връзка')}</button>
      <p class="muted small">${L('Ако си офлайн, съобщението се пази на устройството и се изпраща автоматично по-късно.')}</p></section>
    <section class="card"><h3>${icon('eye')}${L('Демо')}</h3>
      <button class="btn ghost block" data-demo>${icon('play')}${L('Зареди демо ученик')}</button>
      ${demoBackupHasRealData() ? `<button class="btn ghost block" data-restore>${icon('reset')}${L('Върни моите отговори')}</button>` : ''}
      <button class="btn ghost block" data-setup>${icon('reset')}${L('Начална настройка отново')}</button>
      <button class="btn ghost danger-text block" data-wipe>${icon('trash')}${L('Изчисти всичките ми отговори')}</button></section>
    <section class="card"><h3>${icon('info')}${L('За BingO')}</h3><p class="small"><b>BingO</b> ${L('alpha · подготовка за матура без зубрене: работа върху слабите места, не повтаряне на силните.')}</p>
      <p class="muted small">${L('Построено върху Shelly (задачи, точкуване, модули) и идеи от BrainBurst, BandUp и SQL Practice. EduHack Plovdiv 2026.')}</p></section>
  </div>
  <div class="fb-overlay" data-fb-overlay style="position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;z-index:1000">
    <div class="fb-modal card" style="width:100%;max-width:420px;padding:16px">
      <h3>${icon('chat')}${L('Обратна връзка')}</h3>
      <label class="fld"><span>${L('Какво искаш да кажеш?')}</span>
        <textarea class="field" data-fb-text rows="4" placeholder="${esc(L('Какво ти помогна, какво не стана или какво липсва?'))}"></textarea></label>
      <p class="muted small" data-fb-status></p>
      <div class="rows" style="display:flex;gap:8px;margin-top:8px">
        <button class="btn ghost" data-fb-cancel style="flex:1">${L('Отказ')}</button>
        <button class="btn" data-fb-send style="flex:1">${L('Изпрати')}</button>
      </div>
    </div>
  </div>`;
  const feedbackEndpoint = () => (AI_SERVER ? AI_SERVER + '/api/feedback' : '');
  /* Gemini Nano: what this device can do, and a download button when the model can be fetched */
  const paintNano = () => {
    const t = el.querySelector('[data-nano-state]'), dl = el.querySelector('[data-nano-dl]'); if (!t) return;
    const word = { available: L('На устройството · готов'), downloadable: L('Може да се изтегли на това устройство'), downloading: L('Изтегля се… {p}%', { p: Math.round((NANO.progress || 0) * 100) }), unavailable: L('Не се поддържа на това устройство'), unknown: L('Проверява се…') }[NANO.status] || NANO.status;
    t.textContent = word; dl.hidden = NANO.status !== 'downloadable';
  };
  paintNano(); document.addEventListener('nano-status', paintNano); NAV[NAV.length - 1].onLeave = () => document.removeEventListener('nano-status', paintNano);
  const openFeedback = () => {
    const overlay = el.querySelector('[data-fb-overlay]');
    overlay.style.display = 'flex';
    el.querySelector('[data-fb-text]').focus();
  };
  const closeFeedback = () => {
    el.querySelector('[data-fb-overlay]').style.display = 'none';
    el.querySelector('[data-fb-status]').textContent = '';
  };
  const sendFeedback = async () => {
    const button = el.querySelector('[data-fb-send]');
    const status = el.querySelector('[data-fb-status]');
    const text = el.querySelector('[data-fb-text]').value.trim();
    const endpoint = feedbackEndpoint();
    if (!text) { status.textContent = L('Напиши съобщение първо.'); return; }
    if (!endpoint) { status.textContent = L('Обратната връзка не може да се изпрати: сървърът на BingO не е настроен.'); return; }
    button.disabled = true;
    status.textContent = L('Изпращане…');
    const queued = window.BingOFeedback && window.BingOFeedback.enqueueFeedback({ endpoint, data: { text, app: 'BingO', lang: appLang(), theme: st.theme } });
    if (!queued) { button.disabled = false; status.textContent = L('Съобщението не може да се запази.'); return; }
    try {
      const ok = await window.BingOFeedback.flushFeedback();
      if (ok) { status.textContent = L('Благодаря! Обратната връзка е изпратена.'); setTimeout(closeFeedback, 1200); }
      else { status.textContent = L('Запазено е офлайн. Ще се изпрати автоматично.'); setTimeout(closeFeedback, 1600); }
    } catch (e) {
      status.textContent = L('Запазено е офлайн. Ще се изпрати автоматично.');
      setTimeout(closeFeedback, 1600);
    } finally {
      button.disabled = false;
      el.querySelector('[data-fb-text]').value = '';
    }
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('.seg button');
    if (b) { st[b.parentNode.dataset.key] = b.dataset.v; APP.settings.theme = st.theme; APP.settings.lang = st.lang; saveState(); applySettings(); return refresh(); }
    const w = e.target.closest('[data-sw]');
    if (w) { const key = w.dataset.sw; st[key] = st[key] === false ? true : !st[key]; APP.settings[key] = st[key]; saveState(); w.classList.toggle('on', st[key]); w.setAttribute('aria-checked', st[key]); if (key === 'glass' || key === 'motion') applySettings(); return; }
    if (e.target.closest('[data-smooth-recheck]')) { smoothRecheck(); return refresh(); }
    if (e.target.closest('[data-nano-dl]')) { nanoDownload(); return; }
    if (e.target.closest('[data-feedback]')) return openFeedback();
    if (e.target.closest('[data-fb-cancel]') || e.target.closest('[data-fb-overlay]') === e.target) return closeFeedback();
    if (e.target.closest('[data-fb-send]')) return sendFeedback();
    if (e.target.closest('[data-setup]')) { onboardingRestart(); NAV.length = 0; NAV.push({ screen: 'onboarding', params: {} }); return render(); }
    if (e.target.closest('[data-demo]')) { if (await loadDemoLearner()) { toast('Зареден е демо ученик'); home(); } return; }
    if (e.target.closest('[data-restore]')) { if (restoreFromDemo()) { APP.settings.theme = S.settings.theme; APP.settings.lang = S.settings.lang; applySettings(); toast('Твоите отговори са върнати'); home(); } else toast('Копието не може да се прочете', 'bad'); return; }
    if (e.target.closest('[data-wipe]') && await confirmBox(L('Да изчистим ли всичко?'), L('Картата на уменията и всички отговори на това устройство ще се изтрият.'), L('Изчисти'), true)) { resetState(true); toast('Изчистено'); return home(); }
    if (e.target.closest('[data-test]')) {
      const tb = e.target.closest('[data-test]'); tb.disabled = true;
      try { const j = await callAI({ prompt: `Отговори с JSON {"ok": true, "msg": "кратък поздрав на ${appLang() === 'en' ? 'английски' : 'български'} за ученик преди матура"}`, temperature: 0.7 }); toast(L('Работи! {m}', { m: j.msg || '' })); }
      catch (err) { toast(L('Не стана: {e}', { e: err.message }), 'bad'); }
      tb.disabled = false;
    }
  });
  /* A value is saved only when it is valid; otherwise the field says what is wrong and the last
     good value stays (the same rules the first-run setup and loadState use) */
  const SETTING_MSG = {
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
      return fieldError(f, L(SETTING_MSG[key] || 'Невалидна стойност'));
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
