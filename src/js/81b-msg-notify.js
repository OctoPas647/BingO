/* ================= BingO Messages: notifications =================
   - While BingO is open but in the background (another tab, another app on a computer): a system
     notification for each new message; tapping it opens the chat. In the foreground: a toast (81-messages.js).
   - The unread count in the page's title, e.g. "(2) BingO".
   - Mute a chat ("Заглуши"): no notifications, no push, no count on the tab (the dot in the list stays).
   - When BingO is closed: web push through Firebase Cloud Messaging. This device's push token is saved in
     users/{uid}/push/{id}; functions/chat.js (chatNotify) sends the push when a message is written.
     Needs "vapidKey" in the Firebase config (docs/messages.md) and the service worker bingo-push-sw.js,
     which tools/build.py writes next to the page.
   Nothing is shown during a test, a quiz or practice (msgQuietScreen), on the device or by push
   (chatNotify skips students with a test running). The Android app has no web push: see docs/messages.md. */

Object.assign(ICONS, {
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  belloff: '<path d="M8.6 4.1A6 6 0 0 1 18 9c0 3 .6 4.9 1.3 6M6.2 6.6A6 6 0 0 0 6 9c0 6-2.5 7.5-2.5 7.5H16.5"/><path d="M10 20a2 2 0 0 0 4 0M3 3l18 18"/>'
});

const MSGN = { key: 'bingo.msgnotify', token: '', registered: '', asked: false };
const notifySupported = () => typeof Notification !== 'undefined' && !onAndroid();
const notifyPref = () => { try { return localStorage.getItem(MSGN.key) || ''; } catch (e) { return ''; } };
const setNotifyPref = v => { try { localStorage.setItem(MSGN.key, v); } catch (e) { } };
/* 'unsupported' | 'denied' | 'off' | 'on' | 'ask' */
function notifyState() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (notifyPref() === 'off') return 'off';
  return Notification.permission === 'granted' ? 'on' : 'ask';
}
const pushReady = () => !!(FB_CFG && FB_CFG.vapidKey && 'serviceWorker' in navigator && !(typeof demoCloudOn === 'function' && demoCloudOn()));

async function notifyEnable() {
  if (!notifySupported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') { toast(L('Браузърът не позволи известия. Разреши ги от настройките на сайта.'), 'bad'); return notifyState(); }
  setNotifyPref('on');
  await pushRegister(true);
  return 'on';
}
async function notifyDisable() { setNotifyPref('off'); await pushUnregister(); }

/* a message came in: a toast when BingO is in front, a system notification when it is not */
function msgIncoming(c, lm) {
  if (msgQuietScreen() || (c.muted && c.muted[MSGS.uid])) return;
  const who = (c.people && c.people[lm.from] && c.people[lm.from].name) || '';
  const title = c.type === 'class' ? `${c.title || ''} · ${who}` : who;
  const body = lm.key ? L(lm.key) : lm.text || '';
  const away = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
  if (away && notifyState() === 'on') {
    try {
      const icon = (document.querySelector('link[rel~="icon"]') || {}).href || undefined;
      const n = new Notification(title, { body, tag: 'chat-' + c.id, icon });   /* the same tag as the push: never twice */
      n.onclick = () => { try { window.focus(); } catch (e) { } msgOpenChat(c.id); n.close(); };
      return;
    } catch (e) { console.warn('notify', e); }
  }
  if (!away) toast(`${title}: ${body}`.slice(0, 120));
}

/* open a chat from anywhere (a notification, a push link) */
function msgOpenChat(cid) {
  if (!cid) return;
  if (isTeacher()) { tGo('tMessages', { cid }); if (!isWide()) go('chat', { cid }); return; }
  while (NAV.length > 1) leave(NAV.pop());
  if (!NAV.length || NAV[0].screen !== 'home') NAV.splice(0, NAV.length, { screen: 'home', params: {} });
  NAV.push({ screen: 'messages', params: { cid } });
  if (!isWide()) NAV.push({ screen: 'chat', params: { cid } });
  render();
}

/* a push opens BingO with ?chat=<id>: go there once signed in */
const MSG_LINK = (() => { try { return new URLSearchParams(location.search).get('chat') || ''; } catch (e) { return ''; } })();
function msgFollowLink() {
  if (!MSG_LINK || MSGN.followed || !signedIn()) return;
  MSGN.followed = true;
  try { const u = new URL(location.href); u.searchParams.delete('chat'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { }
  setTimeout(() => msgOpenChat(MSG_LINK), 0);
}

/* ---------- web push (Firebase Cloud Messaging) ---------- */
async function tokenId(t) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return t.replace(/[^\w-]/g, '').slice(-40); }
}
async function pushRegister(loud) {
  if (!pushReady() || notifyState() !== 'on' || !signedIn() || MSGN.registered === myUid()) return;
  try {
    await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-messaging-compat.js`);
    const reg = await navigator.serviceWorker.register('bingo-push-sw.js');
    const token = await window.firebase.messaging().getToken({ vapidKey: FB_CFG.vapidKey, serviceWorkerRegistration: reg });
    if (!token) return;
    await docRef(`users/${myUid()}/push/${await tokenId(token)}`).set({ token, at: FV().serverTimestamp(), ua: String(navigator.userAgent || '').slice(0, 160), lang: appLang() });
    MSGN.token = token; MSGN.registered = myUid();
  } catch (e) { console.warn('push', e); if (loud) toast(L('Известията работят, докато BingO е отворен. Push известията не можаха да се включат.')); }
}
async function pushUnregister() {
  const t = MSGN.token; MSGN.registered = ''; MSGN.token = '';
  if (!t) return;
  try { await docRef(`users/${myUid()}/push/${await tokenId(t)}`).delete(); } catch (e) { }
  try { await window.firebase.messaging().deleteToken(); } catch (e) { }
}

/* the bell in the Messages header: turn notifications on or off */
async function notifySheet() {
  const st = notifyState();
  const text = {
    on: L('Получаваш известие за всяко ново съобщение. Отделен разговор можеш да заглушиш от горната му част.'),
    off: L('Известията за съобщения са изключени на това устройство.'),
    ask: L('Включи известията, за да разбираш веднага, когато класът или учителят ти пишат.'),
    denied: L('Браузърът е спрял известията за BingO. Разреши ги от настройките на сайта (иконата до адреса).'),
    unsupported: onAndroid() ? L('В приложението за Android новите съобщения се показват, докато BingO е отворен. Известия при затворено приложение — в следваща версия.') : L('Този браузър не поддържа известия.')
  }[st];
  const actions = [{ id: 'no', label: L('Затвори') }];
  if (st === 'on') actions.push({ id: 'off', label: L('Изключи известията'), kind: 'danger' });
  if (st === 'ask' || st === 'off') actions.push({ id: 'on', label: L('Включи известията'), kind: 'primary', icon: 'bell' });
  const v = await sheet({ title: L('Известия'), body: `<p>${esc(text)}</p>${st === 'on' && !pushReady() ? `<p class="muted small">${esc(L('Когато BingO е затворен, известия не идват (push не е настроен).'))}</p>` : ''}`, actions });
  if (v === 'on') await notifyEnable();
  if (v === 'off') await notifyDisable();
  msgDecorate();
}

/* a slim card at the top of the list until the person decides */
function notifyPromptHTML() {
  return notifyState() === 'ask' && notifyPref() !== 'later'
    ? `<div class="msg-notecard">${icon('bell')}<span><b>${esc(L('Включи известията'))}</b><small>${esc(L('За нови съобщения от класа и учителя'))}</small></span><button class="btn small accent" data-notify-on>${esc(L('Включи'))}</button><button class="iconbtn" data-notify-later aria-label="${esc(L('По-късно'))}">${icon('close')}</button></div>` : '';
}
