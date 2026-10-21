/* ================= Bottom menu: Начало · Статистики · Профил =================
   The menu sits on the three main screens. Home stays the root of the navigation stack:
   Stats and Profile open on top of it, and switching between them replaces the top screen,
   so the Android back button always goes back to Home. */

Object.assign(ICONS, {
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
});

const TABS = [['home', 'home', 'Начало'], ['stats', 'chart', 'Статистики'], ['profile', 'user', 'Профил']];
const tabBar = cur => `<nav class="tabbar" aria-label="Основно меню">${TABS.map(([id, ic, label]) => `<button data-tab="${id}" class="${id === cur ? 'on' : ''}"${id === cur ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;

function goTab(from, to) {
  if (to === from) return;
  if (to === 'home') return home();
  go(to, {}, from === 'home' ? {} : { replace: true });
}

/* ---------- numbers shared by Stats and Profile ---------- */
const rowTime = r => r.t || Date.parse(r.timestamp) || 0;
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function activity() {
  const days = new Set(S.log.map(r => dayKey(rowTime(r))));
  let streak = 0; const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const names = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const week = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(); x.setDate(x.getDate() - (6 - i)); const k = dayKey(x);
    return { label: names[x.getDay()], n: S.log.filter(r => dayKey(rowTime(r)) === k).length };
  });
  return { days: days.size, streak, week };
}
const accOf = rows => rows.length ? rows.filter(r => r.correct).length / rows.length : 0;
function setAccent(el) { const sub = SUBJECTS[S.subject]; el.style.setProperty('--accent', sub.color); el.style.setProperty('--accent-ink', inkOn(sub.color)); }

/* ---------- Статистики: one card per matura ---------- */
SCREENS.stats = async el => {
  setAccent(el);
  const act = activity(), total = S.log.length, max = Math.max(1, ...act.week.map(w => w.n));
  const cards = Object.values(SUBJECTS).map(sub => {
    const sm = subjectSummary(sub.id), rows = S.log.filter(r => r.subject === sub.title), started = sm.answered > 0, kept = sm.total - sm.lost;
    const cnt = { strong: 0, mid: 0, weak: 0, new: 0 }; sm.list.forEach(x => cnt[x.status]++);
    const worst = sm.list.filter(x => x.status !== 'strong').sort((a, b) => b.lost - a.lost).slice(0, 3);
    const avgSec = rows.length ? Math.round(sum(rows.map(r => r.seconds || 0)) / rows.length) : 0;
    return `<article class="card statcard" style="--accent:${sub.color};--accent-ink:${inkOn(sub.color)}">
      <div class="stat-head">${ring(started ? kept / sm.total : 0, started ? Math.round(kept / sm.total * 100) + '%' : '?')}
        <div><span class="kicker">Матура</span><h3>${sub.icon} ${esc(sub.title)}</h3>
          <p class="muted small">${started ? `≈ ${fmt1(kept)} от ${sm.total} т. запазени` : 'Още не е измерено — направи диагностика'}</p></div></div>
      <div class="minis"><div><b>${rows.length}</b><small>отговора</small></div><div><b>${rows.length ? pctTxt(accOf(rows)) : '–'}</b><small>верни</small></div><div><b>${rows.length ? avgSec + ' с' : '–'}</b><small>средно време</small></div></div>
      <div class="statchips"><span class="stchip s-strong">${cnt.strong} силни</span><span class="stchip s-mid">${cnt.mid} почти</span><span class="stchip s-weak">${cnt.weak} слаби</span><span class="stchip">${cnt.new} малко данни</span></div>
      ${started && worst.length ? `<h4 class="stat-sub">Къде губиш най-много</h4><ul class="worst">${worst.map(x => `<li><span>${esc(x.sk.name)}</span><b>−${fmt1(x.lost)} т.</b></li>`).join('')}</ul>` : ''}
      <button class="btn accent block" data-open="${sub.id}">${icon('target')}Отвори картата · ${esc(sub.short)}</button></article>`;
  }).join('');
  el.innerHTML = `<header class="apphead"><div class="brand bingo">Bing<span>O</span></div></header>
    <section class="pad"><h1 class="screen-title">Статистики</h1>
      <div class="card"><div class="minis four"><div><b>${total}</b><small>отговора</small></div><div><b>${total ? pctTxt(accOf(S.log)) : '–'}</b><small>верни</small></div><div><b>${act.streak}</b><small>дни поредни</small></div><div><b>${act.days}</b><small>активни дни</small></div></div>
        <h4 class="stat-sub">Последните 7 дни</h4>
        <div class="weekbars">${act.week.map(w => `<div class="wk"><i style="height:${Math.max(4, w.n / max * 100)}%" title="${w.n}"></i><small>${w.label}</small></div>`).join('')}</div></div>
      <h2 class="sec-title">По матури</h2>${cards}</section>`;
  el.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) { S.subject = o.dataset.open; saveState(); home(); }
  });
};

/* ---------- Профил ---------- */
SCREENS.profile = async el => {
  setAccent(el);
  const p = S.profile, act = activity(), total = S.log.length;
  const subs = Object.values(SUBJECTS).map(s => ({ s, sm: subjectSummary(s.id) }));
  const strongN = sum(subs.map(x => x.sm.list.filter(y => y.status === 'strong').length)), skillN = sum(subs.map(x => x.sm.list.length));
  const initials = (name => name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'У');
  el.innerHTML = `<header class="apphead"><div class="brand bingo">Bing<span>O</span></div>
      <div class="head-stats"><button class="iconbtn" data-go="settings" aria-label="Настройки">${icon('settings')}</button></div></header>
    <section class="pad">
      <div class="profhead"><div class="avatar">${esc(initials(p.name || ''))}</div>
        <h1 class="pname">${esc(p.name || 'Ученик')}</h1><p class="muted pcls">${p.cls ? 'Клас ' + esc(p.cls) : 'Добави клас по-долу'}</p></div>
      <div class="card"><h3>${icon('pen')}Данни</h3>
        <label class="fld"><span>Име</span><input class="field" data-p="name" value="${esc(p.name || '')}" placeholder="напр. Мария П." autocomplete="off"></label>
        <label class="fld"><span>Клас</span><input class="field" data-p="cls" value="${esc(p.cls || '')}" placeholder="напр. 12а" autocomplete="off"></label>
        <p class="muted small">Името и класът отиват при учителя само ако си свързал Google Sheets.</p></div>
      <div class="card"><h3>${icon('trophy')}Моят напредък</h3>
        <div class="rows prows">
          <div class="row"><span>${icon('flame')}Поредни дни</span><b>${act.streak}</b></div>
          <div class="row"><span>${icon('check')}Отговори</span><b>${total}${total ? ' · ' + pctTxt(accOf(S.log)) + ' верни' : ''}</b></div>
          <div class="row"><span>${icon('play')}Тренировки</span><b>${S.sessions}</b></div>
          <div class="row"><span>${icon('target')}Силни умения</span><b>${strongN} от ${skillN}</b></div></div>
        ${subs.map(({ s, sm }) => `<div class="psub" style="--accent:${s.color}"><span>${s.icon} ${esc(s.title)}</span>${bar(sm.answered ? 1 - sm.lost / sm.total : 0)}<small class="muted">${sm.answered ? 'запазени ≈ ' + fmt1(sm.total - sm.lost) + ' от ' + sm.total + ' т.' : 'още не е измерено'}</small></div>`).join('')}</div>
      <div class="card"><button class="btn ghost block" data-go="insights">${icon('grid')}Грешки и данни</button>
        <button class="btn ghost block" data-go="settings">${icon('settings')}Настройки</button>
        <button class="btn ghost block" data-csv>${icon('download')}Моите отговори (CSV)</button></div>
    </section>`;
  el.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-csv]')) return downloadText(`bingo-${slug(S.profile.name || 'uchenik')}-${todayKey()}.csv`, logCSV());
  });
  el.addEventListener('input', e => {
    const f = e.target.closest('[data-p]'); if (!f) return;
    S.profile[f.dataset.p] = f.value.trim(); saveState();
    el.querySelector('.pname').textContent = S.profile.name || 'Ученик';
    el.querySelector('.avatar').textContent = initials(S.profile.name || '');
    el.querySelector('.pcls').textContent = S.profile.cls ? 'Клас ' + S.profile.cls : 'Добави клас по-долу';
  });
};

/* ---------- put the menu under the three main screens ---------- */
['home', 'stats', 'profile'].forEach(name => {
  const inner = SCREENS[name];
  SCREENS[name] = async (el, ...rest) => {
    await inner(el, ...rest);
    el.classList.add('has-nav');
    el.insertAdjacentHTML('beforeend', tabBar(name));
    el.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab(name, b.dataset.tab); });
  };
});
