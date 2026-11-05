/* ================= BingO Messages: chats with the class and the teacher =================
   Like Apple's Messages with a little Instagram: blue bubbles that group by sender, a tap-and-hold (or
   right-click) bar of reactions, double-tap for ❤️, "Видяно", "… пише", replies and unsend.
   - "Съобщения" is a tab for students and a section for teachers. On a laptop the list and the chat sit
     side by side; on a phone the chat opens on top of the list.
   - Every class has a group chat; a student can write privately to a teacher, a teacher to anyone in their classes.
   - Files of any kind up to 25 MB (pictures and videos show inline), pasted or dropped too.
   - Google Workspace: Docs/Sheets/Slides/Forms/Drive/Meet links become cards with a preview; files can be picked
     from Google Drive (and shared with the chat in one step); Word/Excel/PowerPoint files open in Google
     Docs/Sheets/Slides; Drive's .gdoc/.gsheet/... shortcut files turn into their links; a Google Meet call starts
     from the chat's header.
   The rules for who may read and write are in firestore.rules / storage.rules; who is in a chat, in functions/chat.js. */

Object.assign(ICONS, {
  heart: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.3 1.1 4 2.3h3.2C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.5 21.2 11.4 19 15.6 12 20 12 20z"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  clip: '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2L9.8 17.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  pin: '<path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01"/>',
  compose: '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  gdrive: '<path d="M8.5 4h7l6 10.5-3.5 6h-12L2.5 14.5z"/><path d="M8.5 4l6 10.5H2.5M15.5 4L9.6 14.5M21.5 14.5L18 20.5"/>',
  gdoc: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 11h6M9 14h6M9 17h4"/>',
  gsheet: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 11h6v7H9zM9 14.5h6M12 11v7"/>',
  gslides: '<path d="M6 3h8l4 4v14H6z"/><rect x="8.5" y="11" width="7" height="5" rx=".8"/>',
  gform: '<path d="M6 3h8l4 4v14H6z"/><circle cx="9.5" cy="12" r=".9" fill="currentColor"/><circle cx="9.5" cy="16" r=".9" fill="currentColor"/><path d="M12 12h3M12 16h3"/>',
  gdraw: '<path d="M6 3h8l4 4v14H6z"/><circle cx="10.5" cy="13.5" r="2.2"/><path d="M12.5 17.5l3-5 2 3.5"/>'
});

const FILE_IC = { image: 'image', video: 'video', audio: 'sound', pdf: 'file', doc: 'gdoc', sheet: 'gsheet', slides: 'gslides', text: 'text', archive: 'layers', file: 'file' };
const FILE_COLOR = { pdf: '#E5534B', doc: '#4285F4', sheet: '#0F9D58', slides: '#F4B400', archive: '#8E8E93', text: '#5F6368', audio: '#AF52DE', video: '#FF2D55', file: '#8E8E93', image: '#34C759' };
const G_OPEN = { docs: 'Отвори в Google Документи', sheets: 'Отвори в Google Таблици', slides: 'Отвори в Google Презентации' };
const isWide = () => matchMedia('(min-width: 900px)').matches;
const onAndroid = () => !!window.AndroidAuth;
const finePointer = () => matchMedia('(pointer: fine)').matches;
const msgLocale = () => (appLang() === 'en' ? 'en-GB' : 'bg-BG');
const msgClock = t => new Intl.DateTimeFormat(msgLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(t));
function fmtListTime(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date(), days = (dayOf(now) === dayOf(t)) ? 0 : Math.floor((now - d) / 864e5) + 1;
  if (days === 0) return msgClock(t);
  if (days === 1) return L('Вчера');
  if (days < 7) return new Intl.DateTimeFormat(msgLocale(), { weekday: 'short' }).format(d);
  return new Intl.DateTimeFormat(msgLocale(), { day: 'numeric', month: 'short' }).format(d);
}
function fmtDayLine(t) {
  const now = new Date();
  const label = dayOf(now) === dayOf(t) ? L('Днес') : dayOf(new Date(now - 864e5)) === dayOf(t) ? L('Вчера')
    : new Intl.DateTimeFormat(msgLocale(), { weekday: 'long', day: 'numeric', month: 'long', ...(new Date(t).getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(new Date(t));
  return `<b>${esc(label)}</b> ${esc(msgClock(t))}`;
}
const previewText = (lm, me) => { if (!lm) return ''; const p = lm.key ? L(lm.key) : lm.text || ''; return (lm.from === me ? L('Ти: ') : '') + p; };

/* avatars: a photo, or initials on the class colour */
function avatar(p, size = 40, square) {
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
  if (p && p.photo && /^https:\/\//.test(p.photo)) return `<span class="msg-av${square ? ' sq' : ''}" style="${st}"><img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" loading="lazy"></span>`;
  return `<span class="msg-av${square ? ' sq' : ''}" style="${st};--av:${esc((p && p.color) || '#8E8E93')}">${esc(initialsOf(p && p.name))}</span>`;
}
const chatAvatar = (c, me, size = 46) => {
  const h0 = chatHeader(c, me);
  if (c.type === 'dm') return avatar({ name: h0.title, photo: h0.photo, color: '#007AFF' }, size);
  const t = String(h0.title || '').trim(), short = t.length <= 3 && !/\s/.test(t);   /* "11Б" stays "11Б" */
  return `<span class="msg-av sq" style="width:${size}px;height:${size}px;font-size:${Math.round(size * (short && t.length === 3 ? 0.32 : 0.4))}px;--av:${esc(h0.color)}">${esc(short ? t.toUpperCase() : initialsOf(t))}</span>`;
};

/* ================= the chats I am in, kept live while signed in (the list, the tab's dot, a toast for new messages) ================= */
const MSGS = { uid: '', chats: [], stop: null, ready: false, seen: {}, openCid: '', listeners: new Set(), ensured: false };
function msgStart() {
  if (!cloudConfigured() || !CLOUD.ready || !signedIn()) return;
  if (MSGS.uid === myUid() && MSGS.stop) return;
  if (MSGS.stop) try { MSGS.stop(); } catch (e) { }
  MSGS.uid = myUid(); MSGS.ready = false; MSGS.chats = []; MSGS.seen = {}; MSGS.ensured = false;
  MSGS.stop = watch(col('chats').where('members', 'array-contains', MSGS.uid), s => {
    const list = s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    list.sort((a, b) => (tsMs(b.updatedAt) || 0) - (tsMs(a.updatedAt) || 0));
    if (MSGS.ready) for (const c of list) {   /* a toast when someone writes and that chat is not open */
      const lm = c.lastMessage, at = lm && tsMs(lm.at);
      if (lm && lm.from !== MSGS.uid && at && at > (MSGS.seen[c.id] || 0) && c.id !== MSGS.openCid && !s.metadata.fromCache && !msgQuietScreen()) {
        const who = (c.people && c.people[lm.from] && c.people[lm.from].name) || '';
        toast(`${c.type === 'class' ? (c.title ? c.title + ' · ' : '') : ''}${who}: ${lm.key ? L(lm.key) : lm.text || ''}`.slice(0, 120));
      }
    }
    list.forEach(c => { MSGS.seen[c.id] = Math.max(MSGS.seen[c.id] || 0, tsMs(c.lastMessage && c.lastMessage.at) || 0); });
    MSGS.chats = list; MSGS.ready = true;
    msgDecorate(); MSGS.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  }, null, e => { MSGS.stop = null; console.warn('chats', e); });
}
/* signing out stops every live listener (71-cloud.js): the chats start again on the next sign-in */
const _msgStopAll = cloudStopAll;
cloudStopAll = function () { MSGS.stop = null; MSGS.uid = ''; MSGS.chats = []; MSGS.ready = false; _msgStopAll(); msgDecorate(); };
/* no message toasts over a test, a quiz or a practice session (a test should not become a chat) */
const MSG_QUIET = ['take', 'quizPlay', 'session', 'pastexam', 'onboarding'];
const msgQuietScreen = () => { const top = NAV[NAV.length - 1]; return !!top && MSG_QUIET.includes(top.screen); };
const unreadCount = () => MSGS.chats.filter(c => chatUnread(c, MSGS.uid, tsMs)).length;
/* the red dot on the Messages tab (student tab bar, teacher sidebar and tab bar) */
function msgDecorate() {
  const n = signedIn() ? unreadCount() : 0;
  document.querySelectorAll('[data-tab="messages"], [data-tnav="tMessages"]').forEach(b => { b.classList.toggle('msg-has', n > 0); b.dataset.badge = n > 9 ? '9+' : String(n || ''); });
}
/* make the group chats of classes from before Messages (once per session, only if one is missing) */
async function msgEnsureClassChats() {
  if (MSGS.ensured || !signedIn()) return; MSGS.ensured = true;
  try {
    const uid = myUid();
    const [a, b] = await Promise.all([col('classes').where('studentIds', 'array-contains', uid).get(), col('classes').where('teacherIds', 'array-contains', uid).get()]);
    const ids = new Set([...a.docs, ...b.docs].map(d => d.id));
    const have = new Set(MSGS.chats.filter(c => c.type === 'class').map(c => c.classId));
    if ([...ids].some(id => !have.has(id))) await callFn('chatEnsure', {});
  } catch (e) { MSGS.ensured = false; console.warn('chatEnsure', e); }
}

/* every render: keep the chats live once signed in, and put the dot on the tab */
const _msgRender = render;
render = async function (restore) {
  const r = await _msgRender(restore);
  if (CLOUD.ready && signedIn()) msgStart();
  msgDecorate();
  return r;
};

/* ---------- the tab for students and the section for teachers ---------- */
TABS.splice(TABS.findIndex(t => t[0] === 'profile'), 0, ['messages', 'chat', 'Съобщения']);
T_NAV.splice(T_NAV.findIndex(t => t[0] === 'tCalendar'), 0, ['tMessages', 'chat', 'Съобщения']);
T_ROOTS.push('tMessages');

SCREENS.messages = async (el, params, nav) => {
  el.classList.add('has-nav', 'msg-screen');
  const head = `<header class="apphead"><div class="brand bingo">Bing<span>O</span></div><div class="head-stats"><button class="iconbtn" data-compose aria-label="${L('Ново съобщение')}">${icon('compose')}</button></div></header>`;
  el.innerHTML = `${head}<section class="msg-host"></section>${tabBar('messages')}`;
  el.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab('messages', b.dataset.tab); });
  const host = el.querySelector('.msg-host');
  if (!(await msgGate(host, 'student'))) return;
  const view = msgView(host, nav);
  el.querySelector('[data-compose]').addEventListener('click', () => view.compose());
};

SCREENS.tMessages = async (el, params, nav) => {
  if (!(await tGate(el, 'tMessages'))) return;
  const body = tFrame(el, 'tMessages', { title: L('Съобщения'), actions: `<button class="btn accent small" data-compose>${icon('compose')}${L('Ново съобщение')}</button>`, wide: true });
  el.classList.add('t-msg');
  const view = msgView(body, nav);
  el.querySelector('[data-compose]').addEventListener('click', () => view.compose());
};

/* signed in and Firebase set up, or a card that says what to do */
async function msgGate(host, role) {
  if (!cloudConfigured()) { host.innerHTML = `<div class="pad">${notConfiguredCard()}</div>`; return false; }
  host.innerHTML = `<div class="cl-loading"><span class="spinner"></span></div>`;
  try { await cloudLoad(); } catch (e) { host.innerHTML = `<div class="pad"><div class="card error">${esc(errMsg(e))}</div></div>`; return false; }
  if (signedIn()) { msgStart(); return true; }
  host.innerHTML = `<div class="pad"><h1 class="screen-title">${L('Съобщения')}</h1><div class="card cl-hero">${icon('chat')}<h3>${L('Пиши на класа и на учителя')}</h3>
    <p class="muted">${L('Всеки клас има общ чат. Можеш да пишеш и лично на учителя си, да пращаш снимки, файлове и връзки към Google Документи.')}</p>
    <button class="btn accent big block" data-in>${icon('google')}${L('Вход с Google')}</button><button class="btn ghost block" data-join>${icon('users')}${L('Имам код на клас')}</button></div></div>`;
  host.querySelector('[data-in]').addEventListener('click', e => busy(e.currentTarget, async () => { await cloudRegister(role); cloudAfterSignIn(); refresh(); }));
  host.querySelector('[data-join]').addEventListener('click', () => go('joinClass'));
  return false;
}

/* ================= the list (and, on a wide screen, the open chat beside it) ================= */
function msgView(host, nav) {
  const me = myUid();
  host.innerHTML = `<div class="msg-split"><aside class="msg-listpane">
      <h1 class="screen-title msg-title">${L('Съобщения')}</h1>
      <label class="msg-search">${icon('search')}<input type="search" placeholder="${L('Търси')}" aria-label="${L('Търси')}"></label>
      <div class="msg-list" role="list"></div></aside>
    <main class="msg-threadpane"><div class="msg-empty">${icon('chat')}<p>${L('Избери разговор')}</p></div></main></div>`;
  const listEl = host.querySelector('.msg-list'), pane = host.querySelector('.msg-threadpane'), q = host.querySelector('.msg-search input');
  let thread = null;
  const open = cid => {
    if (!isWide()) return go('chat', { cid });
    nav.params.cid = cid;
    if (thread) thread.close();
    thread = mountThread(pane, cid, { inPane: true });
    draw();
  };
  const draw = () => {
    if (!MSGS.ready) { listEl.innerHTML = `<div class="cl-loading"><span class="spinner"></span></div>`; return; }
    const f = q.value.trim().toLowerCase();
    const rows = MSGS.chats.filter(c => !f || chatHeader(c, me).title.toLowerCase().includes(f) || previewText(c.lastMessage, me).toLowerCase().includes(f));
    if (!MSGS.chats.length) {
      listEl.innerHTML = `<div class="msg-none">${icon('users')}<p>${L('Още нямаш разговори. Когато влезеш в клас, тук ще се появи чатът на класа.')}</p><button class="btn ghost" data-join>${icon('plus')}${L('Присъедини се към клас')}</button></div>`;
      return;
    }
    listEl.innerHTML = rows.map(c => {
      const hd = chatHeader(c, me), un = chatUnread(c, me, tsMs), lm = c.lastMessage;
      const sub = c.type === 'dm' ? (hd.teacher ? L('Учител') : L('Ученик')) : L('{n} души', { n: hd.count });
      return `<button class="msg-item${un ? ' unread' : ''}${nav.params.cid === c.id && isWide() ? ' on' : ''}" data-cid="${esc(c.id)}" role="listitem">
        ${chatAvatar(c, me)}<span class="msg-item-main"><span class="msg-item-top"><b>${esc(hd.title || L('Разговор'))}</b><time>${esc(fmtListTime(tsMs(lm && lm.at) || tsMs(c.updatedAt)))}</time></span>
        <span class="msg-item-sub">${esc(lm ? previewText(lm, me) : sub)}</span></span>${un ? '<i class="msg-dot" aria-label="' + esc(L('Непрочетено')) + '"></i>' : ''}</button>`;
    }).join('') || `<p class="muted msg-nores">${L('Няма намерени')}</p>`;
  };
  listEl.addEventListener('click', e => {
    const b = e.target.closest('[data-cid]'); if (b) return open(b.dataset.cid);
    if (e.target.closest('[data-join]')) go('joinClass');
  });
  q.addEventListener('input', draw);
  MSGS.listeners.add(draw);
  const prev = nav.onLeave; nav.onLeave = () => { MSGS.listeners.delete(draw); if (thread) thread.close(); prev && prev(); };
  draw();
  msgEnsureClassChats();
  if (nav.params.cid && isWide()) open(nav.params.cid);
  return { compose: () => composeSheet(open) };
}

/* a new private chat: a student picks a teacher, a teacher anyone from their classes */
async function composeSheet(open) {
  const me = myUid(), classChats = MSGS.chats.filter(c => c.type === 'class');
  const people = dmContacts(classChats, me, isTeacher());
  const row = p => `<button class="msg-person" data-uid="${esc(p.uid)}" data-class="${esc(p.classes[0].id)}">${avatar({ name: p.name, photo: p.photo, color: p.teacher ? '#FF9500' : '#007AFF' }, 38)}<span><b>${esc(p.name || L('Без име'))}</b><small>${p.teacher ? L('Учител') + ' · ' : ''}${esc(p.classes.map(c => c.title).join(', '))}</small></span></button>`;
  const v = await sheet({ title: L('Ново съобщение'), body: people.length
    ? `<label class="msg-search">${icon('search')}<input type="search" data-q placeholder="${L('Търси')}"></label><div class="msg-people">${people.map(row).join('')}</div>`
    : `<p class="muted">${isTeacher() ? L('Когато в класовете ви има ученици, ще можете да им пишете лично.') : L('Можеш да пишеш лично на учителите от твоите класове. Още не си в клас.')}</p>`,
    actions: [{ id: 'no', label: L('Отказ') }],
    onMount: (sh, o) => {
      const qq = sh.querySelector('[data-q]'); if (qq) qq.addEventListener('input', () => { const f = qq.value.toLowerCase(); sh.querySelectorAll('.msg-person').forEach(b => { b.hidden = f && !b.textContent.toLowerCase().includes(f); }); });
      sh.addEventListener('click', e => { const b = e.target.closest('[data-uid]'); if (!b) return; busy(b, async () => { const r = await callFn('chatOpenDm', { uid: b.dataset.uid, classId: b.dataset.class }); o.close(r.chatId); }); });
    } });
  if (v && v.startsWith('dm_')) open(v);
}

/* the chat on a phone: a screen of its own */
SCREENS.chat = async (el, { cid }, nav) => {
  el.classList.add('msg-chatscreen');
  el.innerHTML = `<div class="cl-loading"><span class="spinner"></span></div>`;
  await cloudLoad();
  if (!signedIn()) return back();
  msgStart();
  const t = mountThread(el, cid, { inPane: false });
  const prev = nav.onLeave; nav.onLeave = () => { t.close(); prev && prev(); };
};

/* ================= one chat ================= */
function mountThread(host, cid, { inPane }) {
  const me = myUid(), chatRef = docRef('chats/' + cid), msgCol = col(`chats/${cid}/messages`);
  const T = { chat: null, msgs: [], limit: 60, pending: [], reply: null, tray: [], links: [], stops: [], timers: [], lastRead: 0, lastTyping: 0, closed: false, atBottom: true, more: false };
  MSGS.openCid = cid;
  host.innerHTML = `<div class="msg-thread">
    <header class="msg-head">${inPane ? '' : `<button class="iconbtn" data-back aria-label="${L('Назад')}">${icon('back')}</button>`}
      <button class="msg-head-who" data-info><span class="msg-head-av"></span><span class="msg-head-txt"><b></b><small></small></span></button>
      <button class="iconbtn msg-meet" data-meet aria-label="${L('Google Meet среща')}" title="${L('Google Meet среща')}">${icon('video')}</button></header>
    <div class="msg-scroll"><button class="linkbtn msg-older" hidden>${L('По-стари съобщения')}</button><div class="msg-msgs"></div><div class="msg-typing" hidden><span class="msg-typing-dots"><i></i><i></i><i></i></span><small></small></div></div>
    <button class="msg-jump" hidden aria-label="${L('Към последните')}">${icon('down')}</button>
    <footer class="msg-composer">
      <div class="msg-replybar" hidden></div>
      <div class="msg-tray" hidden></div>
      <div class="msg-inputrow">
        <button class="msg-plus" data-plus aria-label="${L('Прикачи')}">${icon('plus')}</button>
        <div class="msg-field"><textarea rows="1" maxlength="${MSG.MAX_TEXT}" placeholder="${L('Съобщение…')}" aria-label="${L('Съобщение')}"></textarea></div>
        <button class="msg-send" data-send aria-label="${L('Изпрати')}">${icon('heart')}</button>
      </div>
      <input type="file" multiple hidden data-file>
    </footer></div>`;
  const $ = s => host.querySelector(s);
  const scroller = $('.msg-scroll'), list = $('.msg-msgs'), ta = $('textarea'), sendBtn = $('[data-send]'), fileIn = $('[data-file]');

  /* ---------- live data ---------- */
  const listen = () => {
    T.stops.forEach(s => s()); T.stops = [];
    T.stops.push(watch(chatRef, d => { T.chat = d.exists ? { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } : null; drawHead(); drawMsgs(); markRead(); }, null, e => showErr(e)));
    T.stops.push(watch(msgCol.orderBy('at', 'desc').limit(T.limit), s => {
      T.more = s.size >= T.limit;
      T.msgs = s.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: tsMs(x.at) || Date.now(), sending: d.metadata.hasPendingWrites }; }).reverse();
      T.pending = T.pending.filter(p => !T.msgs.some(m => m.id === p.id));
      drawMsgs(); markRead();
    }, null, e => showErr(e)));
  };
  const showErr = e => { list.innerHTML = `<div class="card error">${esc(/permission/i.test(e.code || e.message) ? L('Нямаш достъп до този разговор.') : errMsg(e))}</div>`; };

  /* ---------- the header ---------- */
  function drawHead() {
    const c = T.chat; if (!c) return;
    const hd = chatHeader(c, me);
    $('.msg-head-av').innerHTML = chatAvatar(c, me, 36);
    $('.msg-head-txt b').textContent = hd.title || L('Разговор');
    $('.msg-head-txt small').textContent = c.type === 'dm' ? (hd.teacher ? L('Учител') : L('Ученик')) : L('{n} души', { n: hd.count }) + (c.archived ? ' · ' + L('архивиран') : '');
  }

  /* ---------- the messages ---------- */
  const isClass = () => T.chat && T.chat.type === 'class';
  const person = uid => (T.chat && T.chat.people && T.chat.people[uid]) || {};
  function fileHTML(f, m) {
    const k = fileKind(f.name, f.mime), url = safeUrl(f.url);
    if (!url) return '';
    if (k === 'image') return `<button class="msg-img" data-view="${esc(url)}" data-name="${esc(f.name)}"><img src="${esc(safeUrl(f.thumb) || url)}" alt="${esc(f.name)}" loading="lazy"${f.w && f.h ? ` width="${f.w}" height="${f.h}"` : ''}></button>`;
    if (k === 'video') return `<video class="msg-video" src="${esc(url)}" controls preload="metadata" playsinline></video>`;
    if (k === 'audio') return `<div class="msg-file msg-audio"><audio src="${esc(url)}" controls preload="metadata"></audio><small>${esc(f.name)}</small></div>`;
    const tg = gTargetOf(f.name, f.mime);
    const canPreview = !onAndroid() && (k === 'pdf' || tg);
    return `<div class="msg-file" data-fid="${esc(f.path || '')}">
      <span class="msg-file-ic" style="--fc:${FILE_COLOR[k] || '#8E8E93'}">${icon(FILE_IC[k] || 'file')}<em>${esc(extOf(f.name).toUpperCase().slice(0, 4))}</em></span>
      <span class="msg-file-main"><b>${esc(f.name)}</b><small>${esc(fmtSize(f.size, appLang()))}</small></span>
      <span class="msg-file-acts">
        ${tg ? `<button class="btn small accent" data-gopen="${esc(m.id)}|${esc(f.path)}">${icon('ext')}${L(G_OPEN[tg.app])}</button>` : ''}
        ${canPreview ? `<button class="btn small ghost" data-fprev="${esc(m.id)}|${esc(f.path)}">${icon('eye')}${L('Преглед')}</button>` : ''}
        <a class="btn small ghost" href="${esc(url)}" target="_blank" rel="noopener" download="${esc(f.name)}">${icon('download')}${L('Изтегли')}</a></span></div>`;
  }
  function linkHTML(l) {
    const g = gLinkInfo(l.url) || (l.app ? { app: l.app, id: l.id || '', preview: gPreviewUrl(l.app, l.id || ''), url: l.url } : null);
    const url = safeUrl(l.url); if (!url || !g) return '';
    const a = GAPPS[g.app] || GAPPS.drive;
    const title = l.title || L(a.label);
    if (g.app === 'youtube') return `<a class="msg-yt" href="${esc(url)}" target="_blank" rel="noopener"><img src="https://i.ytimg.com/vi/${esc(g.id)}/hqdefault.jpg" alt="" loading="lazy"><span>${icon('play')}</span><b>${esc(l.title || L(a.label))}</b></a>`;
    return `<div class="msg-gcard" style="--gc:${a.color}">
      <span class="msg-gcard-ic">${icon(a.ic)}</span>
      <span class="msg-gcard-main"><b>${esc(title)}</b><small>${esc(L(a.label))}${l.shared ? ' · ' + esc(L(l.shared === 'anyone' ? 'всеки с връзката' : 'споделен с чата')) : ''}</small></span>
      <span class="msg-gcard-acts">${g.preview && !onAndroid() ? `<button class="btn small ghost" data-gprev="${esc(g.preview)}" data-gurl="${esc(url)}" data-gtitle="${esc(title)}">${icon('eye')}${L('Преглед')}</button>` : ''}
      <a class="btn small accent" href="${esc(url)}" target="_blank" rel="noopener">${icon('ext')}${g.app === 'meet' ? L('Влез') : L('Отвори')}</a></span></div>`;
  }
  function textHTML(text) {
    return linkParts(text).map(p => p.t === 'url' && p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.v)}</a>` : esc(p.v)).join('').replace(/\n/g, '<br>');
  }
  function msgHTML({ m, first, last, newDay, timeLine }) {
    const mine = m.from === me, p = person(m.from), parts = [];
    let line = '';
    if (timeLine) line = `<div class="msg-timeline">${fmtDayLine(m.at)}</div>`;
    if (m.deleted) return `${line}<div class="msg-row ${mine ? 'mine' : 'theirs'} first last" data-mid="${esc(m.id)}"><div class="msg-col"><div class="msg-bubble msg-gone">${esc(L(m.deletedBy && m.deletedBy !== m.from ? 'Премахнато от учителя' : 'Съобщението е премахнато'))}</div></div></div>`;
    if (!mine && first && isClass()) parts.push(`<div class="msg-name">${esc(p.name || '')}${p.teacher ? ` <span class="msg-tbadge">${L('учител')}</span>` : ''}</div>`);
    if (m.reply && m.reply.id) parts.push(`<button class="msg-quote" data-goto="${esc(m.reply.id)}"><small>${icon('reply')}${esc(m.reply.from === me ? L('Ти') : (person(m.reply.from).name || ''))}</small><span>${esc(m.reply.text || '')}</span></button>`);
    const files = (m.files || []), imgs = files.filter(f => fileKind(f.name, f.mime) === 'image'), other = files.filter(f => fileKind(f.name, f.mime) !== 'image');
    if (imgs.length) parts.push(`<div class="msg-imgs n${Math.min(imgs.length, 4)}">${imgs.map(f => fileHTML(f, m)).join('')}</div>`);
    other.forEach(f => parts.push(fileHTML(f, m)));
    const big = emojiOnly(m.text);
    if (m.text) parts.push(`<div class="msg-bubble${big ? ' msg-emoji e' + big : ''}" data-bubble>${textHTML(m.text)}</div>`);
    (m.links || []).forEach(l => parts.push(linkHTML(l)));
    const rx = reactionSummary(m.reactions, me);
    const rxHTML = rx.length ? `<button class="msg-rx" data-rxlist>${rx.map(r => `<span class="${r.mine ? 'mine' : ''}">${r.e}${r.n > 1 ? `<small>${r.n}</small>` : ''}</span>`).join('')}</button>` : '';
    const av = !mine && isClass() ? `<span class="msg-avslot">${last ? avatar({ name: p.name, photo: p.photo, color: p.teacher ? '#FF9500' : '#007AFF' }, 28) : ''}</span>` : '';
    return `${line}<div class="msg-row ${mine ? 'mine' : 'theirs'}${first ? ' first' : ''}${last ? ' last' : ''}${m.sending ? ' sending' : ''}${rx.length ? ' has-rx' : ''}" data-mid="${esc(m.id)}">${av}
      <div class="msg-col">${parts.join('')}${rxHTML}</div>
      <button class="msg-more" data-menu aria-label="${L('Още')}">${icon('smile')}</button></div>`;
  }
  function seenHTML() {
    const mineList = T.msgs.filter(m => m.from === me && !m.deleted); const lastMine = mineList[mineList.length - 1];
    if (!lastMine || T.msgs[T.msgs.length - 1].id !== lastMine.id || !T.chat) return '';
    if (lastMine.sending) return `<div class="msg-seen">${L('Изпраща се…')}</div>`;
    const reads = T.chat.reads || {}, others = (T.chat.members || []).filter(u => u !== me);
    const seen = others.filter(u => (tsMs(reads[u]) || 0) >= lastMine.at);
    if (T.chat.type === 'dm') return `<div class="msg-seen">${seen.length ? L('Видяно') : L('Изпратено')}</div>`;
    return `<div class="msg-seen">${seen.length ? (seen.length === others.length ? L('Видяно от всички') : L('Видяно от {n}', { n: seen.length })) : L('Изпратено')}</div>`;
  }
  function pendingHTML(p) {
    return `<div class="msg-row mine first last sending" data-pending="${esc(p.id)}"><div class="msg-col">
      ${p.items.map(it => `<div class="msg-file msg-up"><span class="msg-file-ic">${it.preview ? `<img src="${esc(it.preview)}" alt="">` : icon(FILE_IC[fileKind(it.file.name, it.file.type)] || 'file')}</span><span class="msg-file-main"><b>${esc(it.file.name)}</b><small>${it.error ? esc(it.error) : esc(fmtSize(it.file.size, appLang()))}</small>${it.error ? '' : bar(it.progress || 0, 'msg-bar')}</span></div>`).join('')}
      ${p.text ? `<div class="msg-bubble">${textHTML(p.text)}</div>` : ''}
      ${p.failed ? `<button class="linkbtn msg-retry" data-retry="${esc(p.id)}">${L('Неуспешно. Опитай пак')}</button>` : ''}</div></div>`;
  }
  function drawMsgs() {
    if (!T.chat && !T.msgs.length) return;
    const fromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    T.atBottom = fromBottom < 80;
    $('.msg-older').hidden = !T.more;
    const lay = layoutMessages(T.msgs);
    list.innerHTML = (T.msgs.length || T.pending.length ? '' : `<div class="msg-hello">${T.chat ? chatAvatar(T.chat, me, 72) : ''}<b>${esc(T.chat ? chatHeader(T.chat, me).title : '')}</b><p class="muted">${isClass() ? L('Това е чатът на класа. Всички в класа виждат съобщенията тук.') : L('Само двамата виждате този разговор.')}</p></div>`)
      + lay.map(msgHTML).join('') + seenHTML() + T.pending.map(pendingHTML).join('');
    if (T.atBottom || T.forceBottom) { scroller.scrollTop = scroller.scrollHeight; T.forceBottom = false; }
    else scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - fromBottom;
    /* pictures load after the first paint: keep the bottom in view while they do */
    list.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', () => { if (T.atBottom) scroller.scrollTop = scroller.scrollHeight; }, { once: true }); });
    drawTyping();
  }
  function drawTyping() {
    const c = T.chat, box = $('.msg-typing'); if (!c) return;
    const now = Date.now(), who = Object.entries(c.typing || {}).filter(([u, t]) => u !== me && now - (tsMs(t) || 0) < 7000).map(([u]) => person(u).name || '');
    box.hidden = !who.length;
    if (who.length) box.querySelector('small').textContent = c.type === 'dm' ? '' : who.length === 1 ? L('{n} пише…', { n: who[0].split(' ')[0] }) : L('{n} души пишат…', { n: who.length });
  }
  scroller.addEventListener('scroll', () => {
    const fromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    T.atBottom = fromBottom < 80; $('.msg-jump').hidden = fromBottom < 400;
  }, { passive: true });
  $('.msg-jump').addEventListener('click', () => scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }));
  $('.msg-older').addEventListener('click', () => { T.limit += 60; listen(); });

  /* ---------- read and typing ---------- */
  function markRead() {
    const c = T.chat; if (!c || T.closed || document.visibilityState !== 'visible') return;
    const lm = tsMs(c.lastMessage && c.lastMessage.at) || 0, mine = tsMs(c.reads && c.reads[me]) || 0;
    if (lm > mine && Date.now() - T.lastRead > 1500) { T.lastRead = Date.now(); chatRef.update({ ['reads.' + me]: FV().serverTimestamp() }).catch(e => console.warn('read', e)); }
  }
  const onVis = () => markRead();
  document.addEventListener('visibilitychange', onVis);
  T.timers.push(setInterval(drawTyping, 2500));
  function typing() {
    if (Date.now() - T.lastTyping < 4000) return;
    T.lastTyping = Date.now(); chatRef.update({ ['typing.' + me]: FV().serverTimestamp() }).catch(() => { });
  }

  /* ---------- the composer ---------- */
  const hasContent = () => ta.value.trim() || T.tray.length || T.links.length;
  function syncComposer() {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    const any = hasContent();
    sendBtn.innerHTML = icon(any ? 'send' : 'heart'); sendBtn.classList.toggle('go', !!any);
    sendBtn.setAttribute('aria-label', any ? L('Изпрати') : L('Изпрати ❤️'));
    const tray = $('.msg-tray');
    tray.hidden = !(T.tray.length || T.links.length);
    tray.innerHTML = T.tray.map((it, i) => `<span class="msg-chip">${it.preview ? `<img src="${esc(it.preview)}" alt="">` : `<span class="msg-chip-ic" style="--fc:${FILE_COLOR[fileKind(it.file.name, it.file.type)] || '#8E8E93'}">${icon(FILE_IC[fileKind(it.file.name, it.file.type)] || 'file')}</span>`}<small>${esc(it.file.name)}</small><button data-untray="${i}" aria-label="${L('Махни')}">${icon('close')}</button></span>`).join('')
      + T.links.map((l, i) => { const a = GAPPS[l.app || (gLinkInfo(l.url) || {}).app] || GAPPS.drive; return `<span class="msg-chip"><span class="msg-chip-ic" style="--fc:${a.color}">${icon(a.ic)}</span><small>${esc(l.title || L(a.label))}</small><button data-unlink="${i}" aria-label="${L('Махни')}">${icon('close')}</button></span>`; }).join('');
    const rb = $('.msg-replybar');
    rb.hidden = !T.reply;
    if (T.reply) rb.innerHTML = `${icon('reply')}<span><b>${esc(L('Отговор на {n}', { n: T.reply.from === me ? L('себе си') : person(T.reply.from).name || '' }))}</b><small>${esc(T.reply.text)}</small></span><button data-unreply aria-label="${L('Отказ')}">${icon('close')}</button>`;
  }
  ta.addEventListener('input', () => { syncComposer(); if (ta.value.trim()) typing(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && finePointer()) { e.preventDefault(); doSend(); } });
  ta.addEventListener('paste', e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
  host.querySelector('.msg-thread').addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); host.querySelector('.msg-thread').classList.add('drop'); } });
  host.querySelector('.msg-thread').addEventListener('dragleave', e => { if (e.target.classList && e.target.classList.contains('msg-thread')) host.querySelector('.msg-thread').classList.remove('drop'); });
  host.querySelector('.msg-thread').addEventListener('drop', e => { e.preventDefault(); host.querySelector('.msg-thread').classList.remove('drop'); addFiles([...(e.dataTransfer.files || [])]); });
  fileIn.addEventListener('change', () => { addFiles([...fileIn.files]); fileIn.value = ''; });

  async function addFiles(files) {
    const plain = [];
    for (const f of files) {
      /* Google Drive's shortcut files (.gdoc …) are tiny JSON pointers: send the real link instead */
      if (EXT_KIND.gshortcut.split(' ').includes(extOf(f.name)) && f.size < 64 * 1024) {
        const url = gShortcutUrl(f.name, await f.text().catch(() => ''));
        if (url) { const g = gLinkInfo(url); T.links.push({ url, title: f.name.replace(/\.[^.]+$/, ''), app: g ? g.app : 'drive', id: g ? g.id : '' }); continue; }
      }
      plain.push(f);
    }
    const { ok, bad } = checkFiles(plain, T.tray.length);
    ok.forEach(file => T.tray.push({ file, preview: fileKind(file.name, file.type) === 'image' ? URL.createObjectURL(file) : '' }));
    if (bad.length) toast(bad[0].why === 'big' ? L('„{n}“ е над 25 MB', { n: bad[0].name }) : bad[0].why === 'many' ? L('До {n} файла в едно съобщение', { n: MSG.MAX_FILES }) : L('„{n}“ е празен файл', { n: bad[0].name }), 'bad');
    syncComposer(); ta.focus();
  }

  async function doSend() {
    const text = ta.value.trim();
    if (!hasContent()) return sendNow({ text: '❤️' });
    const items = T.tray.map(it => ({ ...it, progress: 0 })), links = T.links.slice(), reply = T.reply;
    ta.value = ''; T.tray = []; T.links = []; T.reply = null; T.lastTyping = 0; syncComposer();
    if (text.length > MSG.MAX_TEXT) return toast(L('Съобщението е твърде дълго'), 'bad');
    await sendNow({ text, items, links, reply });
  }
  async function sendNow({ text = '', items = [], links = [], reply = null }, retryOf) {
    const ref = retryOf ? msgCol.doc(retryOf.id) : msgCol.doc();
    const p = retryOf || { id: ref.id, text, items, links, reply };
    p.failed = false;
    if (items.length) { if (!retryOf) T.pending.push(p); T.forceBottom = true; drawMsgs(); }
    try {
      const files = [];
      for (let i = 0; i < p.items.length; i++) {
        const it = p.items[i]; if (it.done) { files.push(it.done); continue; }
        it.done = await uploadChatFile(cid, ref.id, i, it.file, pr => { it.progress = pr; const el = list.querySelector(`[data-pending="${p.id}"] .msg-up:nth-child(${i + 1}) .bar i`); if (el) el.style.width = pr * 100 + '%'; });
        files.push(it.done);
      }
      const allLinks = [...p.links, ...urlsIn(p.text).filter(u => gLinkInfo(u)).map(u => { const g = gLinkInfo(u); return { url: u, app: g.app, id: g.id }; })].slice(0, MSG.MAX_LINKS);
      await nameGoogleLinks(allLinks);
      const clean = allLinks.map(l => ({ url: l.url, app: l.app || '', id: l.id || '', title: String(l.title || '').slice(0, 200), ...(l.shared ? { shared: l.shared } : {}) }));
      const msg = { from: me, at: FV().serverTimestamp(), text: p.text, files, links: clean, reply: p.reply ? { id: p.reply.id, from: p.reply.from, text: String(p.reply.text || '').slice(0, 140) } : null, reactions: {}, deleted: false };
      const pv = msgPreview({ ...msg, links: clean });
      const b = CLOUD.db.batch();
      b.set(ref, msg);
      b.update(chatRef, { lastMessage: { from: me, at: FV().serverTimestamp(), text: pv.text, key: pv.key }, updatedAt: FV().serverTimestamp(), ['reads.' + me]: FV().serverTimestamp() });
      T.forceBottom = true;
      const done = b.commit();
      if (!items.length) drawMsgs();
      await done;
      setTimeout(() => p.items.forEach(it => it.preview && URL.revokeObjectURL(it.preview)), 20000);   /* the uploading bubble may still show it */
    } catch (e) {
      console.warn('send', e); p.failed = true;
      if (!T.pending.includes(p)) T.pending.push(p);
      drawMsgs(); toast(errMsg(e), 'bad');
    }
  }

  /* ---------- tapping things in the chat ---------- */
  host.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-send]')) return doSend();
    if (t.closest('[data-plus]')) return plusMenu();
    if (t.closest('[data-meet]')) return startMeet();
    if (t.closest('[data-info]')) return infoSheet();
    const un = t.closest('[data-untray]'); if (un) { const it = T.tray.splice(+un.dataset.untray, 1)[0]; if (it && it.preview) URL.revokeObjectURL(it.preview); return syncComposer(); }
    const ul = t.closest('[data-unlink]'); if (ul) { T.links.splice(+ul.dataset.unlink, 1); return syncComposer(); }
    if (t.closest('[data-unreply]')) { T.reply = null; return syncComposer(); }
    const rt = t.closest('[data-retry]'); if (rt) { const p = T.pending.find(x => x.id === rt.dataset.retry); if (p) return sendNow(p, p); }
    const v = t.closest('[data-view]'); if (v) return viewImage(v.dataset.view, v.dataset.name);
    const gp = t.closest('[data-gprev]'); if (gp) return previewSheet(gp.dataset.gtitle, gp.dataset.gprev, gp.dataset.gurl);
    const fp = t.closest('[data-fprev]'); if (fp) { const f = fileOf(fp.dataset.fprev); if (f) return previewSheet(f.name, fileKind(f.name, f.mime) === 'pdf' ? f.url : 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(f.url), f.url); }
    const go2 = t.closest('[data-gopen]'); if (go2) { const f = fileOf(go2.dataset.gopen); if (f) return busy(go2, () => openInGoogle(f)); }
    const q = t.closest('[data-goto]'); if (q) { const r = list.querySelector(`[data-mid="${CSS.escape(q.dataset.goto)}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1200); } return; }
    if (t.closest('[data-rxlist]')) { const row = t.closest('[data-mid]'); return reactionsSheet(T.msgs.find(m => m.id === row.dataset.mid)); }
    const mb = t.closest('[data-menu]'); if (mb) { const row = mb.closest('[data-mid]'); return msgMenu(row); }
  });
  const fileOf = key => { const [mid, path] = key.split('|'); const m = T.msgs.find(x => x.id === mid); return m && (m.files || []).find(f => f.path === path); };

  /* double-tap a message for ❤️; hold (or right-click) for the reaction bar */
  let lastTap = { id: '', t: 0 }, hold = 0;
  list.addEventListener('dblclick', e => { const r = e.target.closest('.msg-row[data-mid]'); if (r && !e.target.closest('a,button,video,audio')) { e.preventDefault(); toggleReaction(r.dataset.mid, '❤️', true); } });
  list.addEventListener('touchend', e => {
    const r = e.target.closest('.msg-row[data-mid]'); if (!r || e.target.closest('a,button,video,audio')) return;
    const now = Date.now();
    if (lastTap.id === r.dataset.mid && now - lastTap.t < 320) { e.preventDefault(); toggleReaction(r.dataset.mid, '❤️', true); lastTap = { id: '', t: 0 }; }
    else lastTap = { id: r.dataset.mid, t: now };
  });
  list.addEventListener('touchstart', e => { const r = e.target.closest('.msg-row[data-mid]'); if (!r || e.target.closest('a,video,audio')) return; clearTimeout(hold); hold = setTimeout(() => { navigator.vibrate && navigator.vibrate(8); msgMenu(r); }, 480); }, { passive: true });
  ['touchmove', 'touchend', 'touchcancel'].forEach(ev => list.addEventListener(ev, () => clearTimeout(hold), { passive: true }));
  list.addEventListener('contextmenu', e => { const r = e.target.closest('.msg-row[data-mid]'); if (r && !e.target.closest('a,video,audio')) { e.preventDefault(); if (!T.menu) msgMenu(r); } });

  async function toggleReaction(mid, emoji, onlyAdd) {
    const m = T.msgs.find(x => x.id === mid); if (!m || m.deleted || m.sending) return;
    const cur = (m.reactions || {})[me];
    if (onlyAdd && cur === emoji) return pop(mid, emoji);
    const val = cur === emoji ? FV().delete() : emoji;
    m.reactions = { ...(m.reactions || {}) }; if (cur === emoji) delete m.reactions[me]; else m.reactions[me] = emoji;
    drawMsgs(); if (cur !== emoji) pop(mid, emoji);
    try { await msgCol.doc(mid).update({ ['reactions.' + me]: val }); } catch (e) { failToast(e); }
  }
  function pop(mid, emoji) {
    const r = list.querySelector(`[data-mid="${CSS.escape(mid)}"] .msg-col`); if (!r || !motionOn()) return;
    const b = h(`<span class="msg-pop">${emoji}</span>`); r.appendChild(b); setTimeout(() => b.remove(), 800);
  }

  /* the reaction bar and the actions for one message */
  function msgMenu(row) {
    const m = T.msgs.find(x => x.id === row.dataset.mid); if (!m || m.deleted) return;
    closeMenu();
    const mine = m.from === me, teacherHere = T.chat && (T.chat.teacherIds || []).includes(me);
    const cur = (m.reactions || {})[me];
    const menu = h(`<div class="msg-menu ${mine ? 'mine' : ''}" role="menu">
      <div class="msg-menu-rx">${MSG.REACTIONS.map(e => `<button data-rx="${e}" class="${cur === e ? 'on' : ''}" aria-label="${e}">${e}</button>`).join('')}</div>
      <div class="msg-menu-acts">
        <button data-a="reply">${icon('reply')}${L('Отговори на съобщението')}</button>
        ${m.text ? `<button data-a="copy">${icon('copy')}${L('Копирай')}</button>` : ''}
        ${(m.files || []).length && !onAndroid() ? `<button data-a="drive">${icon('gdrive')}${L('Запази в Google Drive')}</button>` : ''}
        ${mine ? `<button data-a="unsend" class="bad">${icon('trash')}${L('Отмени изпращането')}</button>` : teacherHere ? `<button data-a="remove" class="bad">${icon('trash')}${L('Премахни')}</button>` : ''}
      </div></div>`);
    const shade = h('<div class="msg-shade"></div>');
    const thread = host.querySelector('.msg-thread');
    thread.append(shade, menu);
    row.classList.add('lifted');
    const rr = row.querySelector('.msg-col').getBoundingClientRect(), tr = thread.getBoundingClientRect();
    const top = Math.max(8, Math.min(rr.top - tr.top - 58, tr.height - menu.offsetHeight - 8));
    menu.style.top = top + 'px';
    if (mine) menu.style.right = '12px'; else menu.style.left = Math.max(12, rr.left - tr.left) + 'px';
    requestAnimationFrame(() => menu.classList.add('in'));
    const o = { dismiss: true, close: () => closeMenu() };
    overlays.push(o); syncHistory();
    T.menu = { menu, shade, row, o };
    shade.addEventListener('click', closeMenu);
    menu.addEventListener('click', async e => {
      const rx = e.target.closest('[data-rx]'); if (rx) { closeMenu(); return toggleReaction(m.id, rx.dataset.rx); }
      const a = e.target.closest('[data-a]'); if (!a) return;
      closeMenu();
      if (a.dataset.a === 'reply') { T.reply = { id: m.id, from: m.from, text: msgPreview(m).text || L(msgPreview(m).key) }; syncComposer(); ta.focus(); }
      if (a.dataset.a === 'copy') { try { await navigator.clipboard.writeText(m.text); toast(L('Копирано')); } catch (x) { toast(L('Не успях да копирам'), 'bad'); } }
      if (a.dataset.a === 'drive') saveToDrive(m.files);
      if (a.dataset.a === 'unsend' || a.dataset.a === 'remove') {
        if (!(await confirmBox(a.dataset.a === 'unsend' ? L('Да отменя ли изпращането?') : L('Да премахна ли съобщението?'), L('Съобщението ще изчезне за всички в разговора.'), L('Премахни'), true))) return;
        try {
          await msgCol.doc(m.id).update({ deleted: true, deletedBy: me, text: '', files: [], links: [], reply: null });
          if (mine) (m.files || []).forEach(f => f.path && CLOUD.storage.ref(f.path).delete().catch(() => { }));
          if (mine) (m.files || []).forEach(f => f.thumbPath && CLOUD.storage.ref(f.thumbPath).delete().catch(() => { }));
        } catch (x) { failToast(x); }
      }
    });
  }
  function closeMenu() {
    const M = T.menu; if (!M) return; T.menu = null;
    const i = overlays.indexOf(M.o); if (i >= 0) { overlays.splice(i, 1); syncHistory(); }
    M.row.classList.remove('lifted'); M.menu.remove(); M.shade.remove();
  }
  function reactionsSheet(m) {
    if (!m) return;
    const rx = reactionSummary(m.reactions, me);
    sheet({ title: L('Реакции'), body: `<div class="msg-people">${rx.flatMap(r => r.who.map(u => `<div class="msg-person">${avatar({ name: person(u).name, photo: person(u).photo, color: '#007AFF' }, 34)}<span><b>${esc(u === me ? L('Ти') : person(u).name || '')}</b></span><span class="msg-person-rx">${r.e}</span></div>`)).join('')}</div>`, actions: [{ id: 'ok', label: L('Готово'), kind: 'primary' }] });
  }

  /* ---------- the + menu: photo or video, file, Google Drive, Google Meet ---------- */
  async function plusMenu() {
    const v = await sheet({ title: L('Прикачи'), body: `<div class="msg-plusgrid">
      <button data-act="media"><span style="--fc:#34C759">${icon('image')}</span>${L('Снимка или видео')}</button>
      <button data-act="file"><span style="--fc:#007AFF">${icon('clip')}</span>${L('Файл')}</button>
      <button data-act="drive"><span style="--fc:#1A73E8">${icon('gdrive')}</span>${L('От Google Drive')}</button>
      <button data-act="link"><span style="--fc:#4285F4">${icon('link')}</span>${L('Връзка към Google')}</button>
      <button data-act="meet"><span style="--fc:#00897B">${icon('video')}</span>${L('Google Meet среща')}</button></div>
      <p class="muted small">${L('Всякакви файлове до 25 MB. Word, Excel и PowerPoint се отварят в Google Документи, Таблици и Презентации.')}</p>`,
      actions: [{ id: 'no', label: L('Отказ') }] });
    if (v === 'media') { fileIn.accept = 'image/*,video/*'; fileIn.click(); }
    if (v === 'file') { fileIn.accept = ''; fileIn.click(); }
    if (v === 'drive') drivePicker();
    if (v === 'link') linkSheet();
    if (v === 'meet') startMeet();
  }
  function linkSheet() {
    sheet({ title: L('Връзка към Google'), body: `<p class="muted small">${L('Постави връзка към Google Документ, Таблица, Презентация, Формуляр, файл или папка в Drive, Meet, YouTube…')}</p><input class="field" data-url placeholder="https://docs.google.com/…" inputmode="url">`,
      actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Добави'), kind: 'primary' }],
      onMount: (sh, o) => { const inp = sh.querySelector('[data-url]'); setTimeout(() => inp.focus(), 250); sh.querySelector('[data-act="ok"]').addEventListener('click', ev => {
        ev.stopPropagation(); const u = safeUrl(inp.value.trim()), g = u && gLinkInfo(u);
        if (!g) return toast(L('Това не е връзка към Google'), 'bad');
        T.links.push({ url: u, app: g.app, id: g.id }); syncComposer(); o.close('ok');
      }, true); } });
  }

  /* Google Drive: recent files and search; picked files go as cards, optionally shared with the chat first */
  async function drivePicker() {
    const fields = 'files(id,name,mimeType,webViewLink,modifiedTime,ownedByMe,capabilities(canShare))';
    const query = async term => {
      const q = term ? `name contains '${term.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and trashed = false` : 'trashed = false';
      const j = await gapi(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=40&orderBy=${term ? 'modifiedTime desc' : 'viewedByMeTime desc'}&fields=${encodeURIComponent(fields)}&supportsAllDrives=true&includeItemsFromAllDrives=true`, { scopes: [SC.driveRead] });
      return j.files || [];
    };
    let files;
    try { files = await query(''); } catch (e) { return failToast(e); }
    const picked = new Map();
    const canMembers = T.chat && (T.chat.type === 'dm' || (T.chat.teacherIds || []).includes(me));
    const rows = fs => fs.map(f => { const app = gAppOfMime(f.mimeType), a = GAPPS[app] || GAPPS.drive; return `<button class="msg-dfile${picked.has(f.id) ? ' on' : ''}" data-df="${esc(f.id)}"><span class="msg-gcard-ic" style="--gc:${a.color}">${icon(app === 'drive' ? FILE_IC[fileKind(f.name, f.mimeType)] || 'file' : a.ic)}</span><span><b>${esc(f.name)}</b><small>${esc(L(a.label))} · ${esc(fmtListTime(Date.parse(f.modifiedTime)))}</small></span><i class="msg-check">${icon('check')}</i></button>`; }).join('') || `<p class="muted">${L('Няма намерени')}</p>`;
    const v = await sheet({ title: L('От Google Drive'), wide: true, body: `<label class="msg-search">${icon('search')}<input type="search" data-q placeholder="${L('Търси в Drive')}"></label>
      <div class="msg-dlist">${rows(files)}</div>
      <label class="fld"><span>${L('Кой може да отвори файловете')}</span><select class="field" data-share>
        <option value="">${L('Както са споделени сега')}</option>
        ${canMembers ? `<option value="members">${T.chat.type === 'dm' ? L('Дай достъп на събеседника (четене)') : L('Дай достъп на всички в класа (четене)')}</option>` : ''}
        <option value="anyone">${L('Всеки с връзката (четене)')}</option></select></label>`,
      actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Добави'), kind: 'primary', icon: 'check' }],
      onMount: (sh, o) => {
        const listBox = sh.querySelector('.msg-dlist'); let tm = 0;
        sh.querySelector('[data-q]').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(async () => { try { files = await query(e.target.value.trim()); listBox.innerHTML = rows(files); } catch (x) { failToast(x); } }, 350); });
        listBox.addEventListener('click', e => { const b = e.target.closest('[data-df]'); if (!b) return; const f = files.find(x => x.id === b.dataset.df); if (picked.has(f.id)) picked.delete(f.id); else picked.set(f.id, f); b.classList.toggle('on'); });
        const ok = sh.querySelector('[data-act="ok"]');
        ok.addEventListener('click', ev => { ev.stopPropagation(); if (!picked.size) return toast(L('Избери поне един файл')); busy(ok, async () => {
          const share = sh.querySelector('[data-share]').value, list2 = [...picked.values()];
          if (share) await shareDriveFiles(list2, share);
          list2.forEach(f => { const app = gAppOfMime(f.mimeType); T.links.push({ url: f.webViewLink || gOpenUrl(app, f.id), app, id: f.id, title: f.name, ...(share ? { shared: share } : {}) }); });
          syncComposer(); o.close('ok');
        }); }, true);
      } });
    return v;
  }
  async function shareDriveFiles(files, how) {
    const emails = how === 'members' ? (await callFn('chatEmails', { chatId: cid })).emails : [];
    let bad = 0;
    for (const f of files) {
      if (f.capabilities && f.capabilities.canShare === false) { bad++; continue; }
      const perms = how === 'anyone' ? [{ type: 'anyone', role: 'reader', allowFileDiscovery: false }] : emails.map(e => ({ type: 'user', role: 'reader', emailAddress: e }));
      for (const body of perms) {
        try { await gapi(`https://www.googleapis.com/drive/v3/files/${f.id}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, { method: 'POST', scopes: ['drive'], body }); }
        catch (e) { bad++; console.warn('share', e); break; }
      }
    }
    if (bad) toast(L('{n} файла не можаха да се споделят (нямаш право или училището не позволява)', { n: bad }), 'bad');
  }

  /* Google Meet: a meeting now (an event in my Google Calendar with a Meet link), posted to the chat */
  async function startMeet() {
    if (!(await confirmBox(L('Google Meet среща'), L('Ще създам среща в Google Meet и ще пратя връзката в този разговор.'), L('Създай')))) return;
    try {
      const start = new Date(), end = new Date(start.getTime() + 60 * 60000);
      const ev = await gapi('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', { method: 'POST', scopes: [SC.calendar], body: {
        summary: `BingO: ${chatHeader(T.chat, me).title || L('Разговор')}`, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: 'bingo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      } });
      const link = ev.hangoutLink || ((ev.conferenceData && ev.conferenceData.entryPoints) || []).map(p => p.uri).find(u => /meet\.google\.com/.test(u || ''));
      if (!link) throw new Error(L('Google не създаде връзка за Meet'));
      await sendNow({ text: '', links: [{ url: link, app: 'meet', id: '', title: L('Google Meet среща') }] });
    } catch (e) { failToast(e); }
  }

  /* ---------- the people in the chat ---------- */
  function infoSheet() {
    const c = T.chat; if (!c) return;
    const ppl = chatHeader(c, me).people.sort((a, b) => (b.teacher - a.teacher) || String(a.name).localeCompare(String(b.name), 'bg'));
    const canDm = p => p.uid !== me && c.type === 'class' && (isTeacher() || p.teacher);
    sheet({ title: chatHeader(c, me).title, body: `<div class="msg-people">${ppl.map(p => `<${canDm(p) ? 'button' : 'div'} class="msg-person" ${canDm(p) ? `data-dm="${esc(p.uid)}"` : ''}>${avatar({ name: p.name, photo: p.photo, color: p.teacher ? '#FF9500' : '#007AFF' }, 38)}<span><b>${esc(p.uid === me ? L('Ти') : p.name || L('Без име'))}</b><small>${p.teacher ? L('Учител') : L('Ученик')}</small></span>${canDm(p) ? `<span class="msg-person-rx">${icon('chat')}</span>` : ''}</${canDm(p) ? 'button' : 'div'}>`).join('')}</div>`,
      actions: [{ id: 'ok', label: L('Готово'), kind: 'primary' }],
      onMount: (sh, o) => sh.addEventListener('click', e => { const b = e.target.closest('[data-dm]'); if (!b) return; busy(b, async () => { const r = await callFn('chatOpenDm', { uid: b.dataset.dm, classId: c.classId }); o.close(); if (isWide() && inPane) { const nav = NAV[NAV.length - 1]; nav.params.cid = r.chatId; refresh(); } else go('chat', { cid: r.chatId }, { replace: !inPane }); }); }) });
  }

  listen(); syncComposer();
  if (finePointer()) setTimeout(() => ta.focus(), 60);
  return {
    close() {
      if (T.closed) return; T.closed = true; closeMenu();
      T.stops.forEach(s => s()); T.timers.forEach(clearInterval);
      document.removeEventListener('visibilitychange', onVis);
      if (MSGS.openCid === cid) MSGS.openCid = '';
      T.tray.forEach(it => it.preview && URL.revokeObjectURL(it.preview));
    }
  };
}

/* ================= files ================= */
/* upload one file (and a small preview for a big picture); the progress callback gets 0..1 */
async function uploadChatFile(cid, mid, i, file, onProgress) {
  const base = `chats/${cid}/${myUid()}/${mid}/${i}-${safeFileName(file.name)}`;
  const mime = file.type || 'application/octet-stream';
  const ref = CLOUD.storage.ref(base);
  const task = ref.put(file, { contentType: mime, contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.name)}` });
  await new Promise((res, rej) => task.on('state_changed', s => onProgress && onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), rej, res));
  const out = { name: String(file.name).slice(0, 200), size: file.size, mime, path: base, url: await ref.getDownloadURL() };
  if (fileKind(file.name, mime) === 'image' && !/svg|gif/.test(mime)) {
    try {
      const dim = await imageSize(file); if (dim) { out.w = dim.w; out.h = dim.h; }
      if (file.size > 400 * 1024) {
        const small = await shrinkImage(file, 1080, 0.8), tp = base.replace(/\/([^/]+)$/, '/t-$1') + '.jpg', tr = CLOUD.storage.ref(tp);
        await tr.put(small, { contentType: 'image/jpeg' });
        out.thumb = await tr.getDownloadURL(); out.thumbPath = tp;
      }
    } catch (e) { console.warn('thumb', e); }
  }
  return out;
}
function imageSize(file) {
  return new Promise(res => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res({ w: i.naturalWidth, h: i.naturalHeight }); URL.revokeObjectURL(u); }; i.onerror = () => { res(null); URL.revokeObjectURL(u); }; i.src = u; });
}
async function fileBlob(f) {
  try { const r = await fetch(f.url); if (!r.ok) throw new Error(String(r.status)); return await r.blob(); }
  catch (e) { throw new Error(L('Файлът не можа да се изтегли за Google Drive. Изтегли го и го качи сам.')); }
}
/* a multipart Drive upload (metadata + the file), converting to a Google format when `toMime` is given */
async function driveUpload(blob, name, toMime) {
  const b = 'bingo' + Date.now().toString(36);
  const meta = { name, ...(toMime ? { mimeType: toMime } : {}) };
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`]);
  return gapi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', { method: 'POST', scopes: [SC.driveFile], body, headers: { 'Content-Type': 'multipart/related; boundary=' + b } });
}
/* Word/Excel/PowerPoint (and OpenDocument, CSV, text) -> a Google Doc/Sheet/Slides copy in my Drive, opened right away */
async function openInGoogle(f) {
  const tg = gTargetOf(f.name, f.mime); if (!tg) return;
  const w = !onAndroid() ? window.open('', '_blank') : null;
  try {
    const r = await driveUpload(await fileBlob(f), f.name.replace(/\.[^.]+$/, ''), tg.mime);
    const link = r.webViewLink || gOpenUrl(tg.app, r.id);
    if (w) w.location.href = link; else window.open(link, '_blank');
    toast(L('Копие е запазено в твоя Google Drive'));
  } catch (e) { if (w) w.close(); failToast(e); }
}
async function saveToDrive(files) {
  try {
    for (const f of files) await driveUpload(await fileBlob(f), f.name);
    toast(files.length > 1 ? L('{n} файла са запазени в Google Drive', { n: files.length }) : L('Запазено в Google Drive'));
  } catch (e) { failToast(e); }
}

/* ================= viewers ================= */
function viewImage(url, name) {
  const el = h(`<div class="msg-viewer" role="dialog" aria-modal="true"><header><button class="iconbtn" data-x aria-label="${L('Затвори')}">${icon('close')}</button><span>${esc(name || '')}</span><a class="iconbtn" href="${esc(url)}" target="_blank" rel="noopener" download="${esc(name || '')}" aria-label="${L('Изтегли')}">${icon('download')}</a></header><img src="${esc(url)}" alt="${esc(name || '')}"></div>`);
  const o = { dismiss: true, close() { if (o.done) return; o.done = true; overlays.splice(overlays.indexOf(o), 1); el.classList.add('out'); setTimeout(() => el.remove(), 200); syncHistory(); } };
  overlays.push(o); syncHistory();
  el.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === el) o.close(); });
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
}
function previewSheet(title, src, openUrl) {
  if (!safeUrl(src)) return;
  sheet({ title, wide: true, body: `<iframe class="msg-frame" src="${esc(safeUrl(src))}" allow="autoplay; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
    actions: [{ id: 'no', label: L('Затвори') }, { id: 'open', label: L('Отвори'), kind: 'primary', icon: 'ext' }] })
    .then(v => { if (v === 'open' && safeUrl(openUrl)) window.open(safeUrl(openUrl), '_blank', 'noopener'); });
}

/* the names of Google files in a message, when this device already has Google Drive access (no pop-up while sending) */
async function nameGoogleLinks(links) {
  const need = links.filter(l => !l.title && l.id && /^(docs|sheets|slides|forms|drawings|drive|folder)$/.test(l.app));
  if (!need.length) return;
  const key = [...GTOKENS.keys()].find(k => k.includes('drive.readonly') || /auth\/drive( |$)/.test(k)), tok = key && GTOKENS.get(key);
  if (!tok || tok.exp < Date.now() + 30000) return;
  await Promise.all(need.map(async l => {
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(l.id)}?fields=name,mimeType&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + tok.token } });
      if (r.ok) { const j = await r.json(); l.title = j.name || ''; }
    } catch (e) { }
  }));
}
