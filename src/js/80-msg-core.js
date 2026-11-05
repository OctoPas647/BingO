/* ================= BingO Messages: the rules that need no screen =================
   Used by the Messages tab (81-messages.js) and checked in Node by tools/check.js:
   - chat ids: one group chat per class, one private chat per pair of people
   - links in a message, and what kind of Google Workspace thing a link is (Docs, Sheets, Slides, Forms, Drive, Meet…)
   - what kind of file a file is, which Google format it opens as, and Google Drive's shortcut files (.gdoc, .gsheet…)
   - grouping messages into bubbles (same sender, close in time), day separators, reactions, the preview in the list */

const MSG = {
  MAX_FILE: 25 * 1024 * 1024,   /* also in storage.rules */
  MAX_FILES: 10, MAX_TEXT: 4000, MAX_LINKS: 10,
  REACTIONS: ['❤️', '😂', '😮', '😢', '😡', '👍'],
  GROUP_GAP: 3 * 60000,         /* a new bubble group after 3 minutes */
  TIME_GAP: 60 * 60000          /* a time line between messages more than an hour apart */
};

const classChatId = classId => 'class_' + classId;
const dmChatId = (a, b) => 'dm_' + [a, b].sort().join('_');

/* ---------- links ---------- */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}»“”]/gi;
const safeUrl = u => { const s = String(u || '').trim(); const v = /^www\./i.test(s) ? 'https://' + s : s; return /^https?:\/\/[^\s<>"']+$/i.test(v) ? v : ''; };

/* the text cut into plain parts and links, so the screen can escape the text and make the links clickable */
function linkParts(text) {
  const out = [], s = String(text || ''); let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    out.push({ t: 'url', v: m[0], href: safeUrl(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}
const urlsIn = text => [...new Set(linkParts(text).filter(p => p.t === 'url' && p.href).map(p => p.href))];

/* Google Workspace apps: what a link opens, its colour, and an embeddable preview */
const GAPPS = {
  docs: { label: 'Google Документ', color: '#4285F4', ic: 'gdoc' },
  sheets: { label: 'Google Таблица', color: '#0F9D58', ic: 'gsheet' },
  slides: { label: 'Google Презентация', color: '#F4B400', ic: 'gslides' },
  forms: { label: 'Google Формуляр', color: '#7248B9', ic: 'gform' },
  drawings: { label: 'Google Рисунка', color: '#DB4437', ic: 'gdraw' },
  drive: { label: 'Файл в Google Drive', color: '#1A73E8', ic: 'gdrive' },
  folder: { label: 'Папка в Google Drive', color: '#5F6368', ic: 'folder' },
  meet: { label: 'Google Meet среща', color: '#00897B', ic: 'video' },
  calendar: { label: 'Google Календар', color: '#1A73E8', ic: 'calendar' },
  classroom: { label: 'Google Classroom', color: '#188038', ic: 'school' },
  sites: { label: 'Google Сайт', color: '#3F51B5', ic: 'globe' },
  maps: { label: 'Google Карти', color: '#34A853', ic: 'pin' },
  youtube: { label: 'YouTube видео', color: '#FF0000', ic: 'play' }
};
const ID = '([A-Za-z0-9_-]{10,})';
const GLINK_RULES = [
  [new RegExp('docs\\.google\\.com/(?:a/[^/]+/)?document/(?:u/\\d+/)?d/' + ID), 'docs', id => `https://docs.google.com/document/d/${id}/preview`],
  [new RegExp('docs\\.google\\.com/(?:a/[^/]+/)?spreadsheets/(?:u/\\d+/)?d/' + ID), 'sheets', id => `https://docs.google.com/spreadsheets/d/${id}/preview`],
  [new RegExp('docs\\.google\\.com/(?:a/[^/]+/)?presentation/(?:u/\\d+/)?d/' + ID), 'slides', id => `https://docs.google.com/presentation/d/${id}/preview`],
  [new RegExp('docs\\.google\\.com/(?:a/[^/]+/)?forms/(?:u/\\d+/)?d/(e/)?' + ID), 'forms', (id, m) => m[1] ? `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true` : ''],
  [/forms\.gle\/([A-Za-z0-9]+)/, 'forms', () => ''],
  [new RegExp('docs\\.google\\.com/(?:a/[^/]+/)?drawings/(?:u/\\d+/)?d/' + ID), 'drawings', id => `https://docs.google.com/drawings/d/${id}/preview`],
  [new RegExp('drive\\.google\\.com/(?:a/[^/]+/)?drive/(?:u/\\d+/)?(?:mobile/)?folders/' + ID), 'folder', id => `https://drive.google.com/embeddedfolderview?id=${id}#list`],
  [new RegExp('drive\\.google\\.com/(?:a/[^/]+/)?file/(?:u/\\d+/)?d/' + ID), 'drive', id => `https://drive.google.com/file/d/${id}/preview`],
  [new RegExp('drive\\.google\\.com/(?:open|uc)\\?(?:[^#]*&)?id=' + ID), 'drive', id => `https://drive.google.com/file/d/${id}/preview`],
  [/meet\.google\.com\/([a-z]{3,4}-[a-z]{4}-[a-z]{3,4})/, 'meet', () => ''],
  [/calendar\.google\.com\//, 'calendar', () => ''],
  [/classroom\.google\.com\//, 'classroom', () => ''],
  [/sites\.google\.com\//, 'sites', () => ''],
  [/(?:maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/, 'maps', () => ''],
  [/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/, 'youtube', id => `https://www.youtube.com/embed/${id}`]
];
/* { app, id, preview, url } for a Google link, or null */
function gLinkInfo(url) {
  const u = safeUrl(url); if (!u) return null;
  let host = ''; try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return null; }
  if (!/(^|\.)(google\.[a-z.]+|youtube\.com|youtu\.be|forms\.gle|goo\.gl)$/.test(host)) return null;
  for (const [re, app, prev] of GLINK_RULES) {
    const m = u.match(re); if (!m) continue;
    const id = m.length > 1 ? m[m.length - 1] || '' : '';
    return { app, id, preview: prev(id, m) || '', url: u };
  }
  return null;
}
/* the Google app for a Drive mime type (from the Drive API) */
function gAppOfMime(mime) {
  const m = String(mime || '');
  return { 'application/vnd.google-apps.document': 'docs', 'application/vnd.google-apps.spreadsheet': 'sheets', 'application/vnd.google-apps.presentation': 'slides',
    'application/vnd.google-apps.form': 'forms', 'application/vnd.google-apps.drawing': 'drawings', 'application/vnd.google-apps.folder': 'folder', 'application/vnd.google-apps.site': 'sites' }[m] || 'drive';
}
/* the link a Drive file opens with (Docs/Sheets/Slides open in their editor) */
function gOpenUrl(app, id, fallback) {
  const base = { docs: 'document', sheets: 'spreadsheets', slides: 'presentation', drawings: 'drawings', forms: 'forms' }[app];
  if (base && id) return `https://docs.google.com/${base}/d/${id}/edit`;
  if (app === 'folder' && id) return `https://drive.google.com/drive/folders/${id}`;
  if (app === 'drive' && id) return `https://drive.google.com/file/d/${id}/view`;
  return safeUrl(fallback);
}
const gPreviewUrl = (app, id) => (GLINK_RULES.find(r => r[1] === app && app !== 'forms') || [0, 0, () => ''])[2](id, []) || '';

/* ---------- files ---------- */
const EXT_KIND = {
  image: 'jpg jpeg png gif webp heic heif bmp svg avif', video: 'mp4 mov webm mkv avi m4v 3gp', audio: 'mp3 m4a wav ogg oga aac flac opus amr',
  pdf: 'pdf', doc: 'doc docx odt rtf dot dotx', sheet: 'xls xlsx ods csv tsv xlsm', slides: 'ppt pptx odp pps ppsx', text: 'txt md json xml html htm css js py java c cpp ts tex',
  archive: 'zip rar 7z tar gz tgz', gshortcut: 'gdoc gsheet gslides gform gdraw gsite gtable gjam gmap glink gnote gscript'
};
const extOf = name => { const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,6})$/); return m ? m[1] : ''; };
function fileKind(name, mime) {
  const e = extOf(name), m = String(mime || '').toLowerCase();
  for (const [k, list] of Object.entries(EXT_KIND)) if (e && list.split(' ').includes(e)) return k;
  if (m.startsWith('image/')) return 'image'; if (m.startsWith('video/')) return 'video'; if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf'; if (m.startsWith('text/')) return 'text';
  if (/wordprocessing|msword|opendocument\.text/.test(m)) return 'doc';
  if (/spreadsheet|ms-excel/.test(m)) return 'sheet';
  if (/presentation|ms-powerpoint/.test(m)) return 'slides';
  return 'file';
}
/* the Google format a file converts to when opened in Google Docs, Sheets or Slides (Drive upload with conversion) */
function gTargetOf(name, mime) {
  const k = fileKind(name, mime), e = extOf(name);
  if (k === 'doc' || e === 'txt' || e === 'html' || e === 'htm') return { app: 'docs', mime: 'application/vnd.google-apps.document' };
  if (k === 'sheet') return { app: 'sheets', mime: 'application/vnd.google-apps.spreadsheet' };
  if (k === 'slides') return { app: 'slides', mime: 'application/vnd.google-apps.presentation' };
  return null;
}
/* Google Drive for desktop puts small JSON "shortcut" files on the computer (.gdoc, .gsheet …); in a chat they become the real link */
function gShortcutUrl(name, text) {
  const e = extOf(name); if (!EXT_KIND.gshortcut.split(' ').includes(e)) return '';
  let j; try { j = JSON.parse(String(text || '')); } catch (x) { return ''; }
  if (j && typeof j.url === 'string' && safeUrl(j.url)) return safeUrl(j.url);
  const id = j && typeof j.doc_id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(j.doc_id) ? j.doc_id : '';
  if (!id) return '';
  const rk = j.resource_key && /^[A-Za-z0-9_-]+$/.test(j.resource_key) ? '?resourcekey=' + j.resource_key : '';
  const base = { gdoc: 'document', gsheet: 'spreadsheets', gslides: 'presentation', gform: 'forms', gdraw: 'drawings' }[e];
  return base ? `https://docs.google.com/${base}/d/${id}/edit${rk}` : `https://drive.google.com/open?id=${id}${rk ? '&' + rk.slice(1) : ''}`;
}
/* a name that is safe as the last part of a Storage path */
const safeFileName = name => (String(name || 'file').normalize('NFC').replace(/[\\/#?[\]*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim() || 'file').slice(-120);
function fmtSize(bytes, lang) {
  const b = Number(bytes) || 0, loc = lang === 'en' ? 'en' : 'bg';
  const f = (v, d) => v.toLocaleString(loc, { maximumFractionDigits: d });
  return b < 1024 ? b + ' B' : b < 1048576 ? f(b / 1024, 0) + ' KB' : f(b / 1048576, b < 10485760 ? 1 : 0) + ' MB';
}
/* which picked files can be sent: too big or too many are refused with a reason */
function checkFiles(files, already = 0) {
  const ok = [], bad = [];
  for (const f of files) {
    if (ok.length + already >= MSG.MAX_FILES) bad.push({ name: f.name, why: 'many' });
    else if (!(f.size > 0)) bad.push({ name: f.name, why: 'empty' });
    else if (f.size > MSG.MAX_FILE) bad.push({ name: f.name, why: 'big' });
    else ok.push(f);
  }
  return { ok, bad };
}

/* ---------- messages on the screen ---------- */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣|\s)+$/u;
const emojiOnly = text => { const s = String(text || '').trim(); if (!s || !EMOJI_ONLY.test(s)) return 0; const n = [...s.matchAll(/\p{Extended_Pictographic}/gu)].length; return n && n <= 3 ? n : 0; };
const dayOf = t => { const d = new Date(t); return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate(); };

/* messages (oldest first, `at` in ms) -> each with where it sits in its group, and day/time lines between them */
function layoutMessages(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i], p = list[i - 1], n = list[i + 1];
    const newDay = !p || dayOf(p.at) !== dayOf(m.at), timeLine = newDay || m.at - p.at > MSG.TIME_GAP;
    const joinPrev = p && !timeLine && p.from === m.from && m.at - p.at < MSG.GROUP_GAP && !p.deleted && !m.deleted;
    const joinNext = n && n.from === m.from && n.at - m.at < MSG.GROUP_GAP && dayOf(n.at) === dayOf(m.at) && n.at - m.at <= MSG.TIME_GAP && !n.deleted && !m.deleted;
    out.push({ m, first: !joinPrev, last: !joinNext, newDay, timeLine });
  }
  return out;
}
/* reactions { uid: '❤️' } -> [{ e, n, mine }], the most used first */
function reactionSummary(reactions, me) {
  const by = {};
  for (const [uid, e] of Object.entries(reactions || {})) { if (!e) continue; (by[e] = by[e] || { e, n: 0, mine: false, who: [] }).n++; by[e].who.push(uid); if (uid === me) by[e].mine = true; }
  return Object.values(by).sort((a, b) => b.n - a.n || MSG.REACTIONS.indexOf(a.e) - MSG.REACTIONS.indexOf(b.e));
}
/* what a message says in the chat list and in notifications (the Bulgarian text is a key for L()) */
function msgPreview(m) {
  if (!m) return { key: '', text: '' };
  if (m.deleted) return { key: 'Съобщението е премахнато', text: '' };
  const t = String(m.text || '').replace(/\s+/g, ' ').trim();
  if (t) return { key: '', text: t.length > 90 ? t.slice(0, 88) + '…' : t };
  const f = (m.files || [])[0], l = (m.links || [])[0];
  if (f) { const k = fileKind(f.name, f.mime); return { key: k === 'image' ? '📷 Снимка' : k === 'video' ? '🎬 Видео' : k === 'audio' ? '🎧 Звук' : '', text: k === 'image' || k === 'video' || k === 'audio' ? '' : '📎 ' + f.name }; }
  if (l) return { key: '', text: '🔗 ' + (l.title || l.url) };
  return { key: '', text: '' };
}
/* is the chat unread for me: someone else wrote after I last read it */
function chatUnread(chat, me, ms) {
  const lm = chat && chat.lastMessage; if (!lm || !lm.from || lm.from === me) return false;
  const at = ms(lm.at), read = ms(chat.reads && chat.reads[me]);
  return at != null && (read == null || read < at);
}
/* the other person in a private chat, or the class in a group chat: what the list and the header show */
function chatHeader(chat, me) {
  if (!chat) return { title: '', people: [] };
  const people = Object.entries(chat.people || {}).map(([uid, p]) => ({ uid, ...p }));
  if (chat.type === 'dm') { const o = people.find(p => p.uid !== me) || {}; return { title: o.name || '', photo: o.photo || '', other: o, people, teacher: !!o.teacher }; }
  return { title: chat.title || '', color: chat.color || '#2F5BD3', people, count: (chat.members || []).length };
}
/* who I can start a private chat with, from my class chats: a student, the teachers; a teacher, everyone in their classes */
function dmContacts(classChats, me, iAmTeacher) {
  const by = {};
  for (const c of classChats) for (const [uid, p] of Object.entries(c.people || {})) {
    if (uid === me || !(iAmTeacher || p.teacher)) continue;
    const x = by[uid] = by[uid] || { uid, name: p.name || '', photo: p.photo || '', teacher: !!p.teacher, classes: [] };
    x.classes.push({ id: c.classId, title: c.title });
  }
  return Object.values(by).sort((a, b) => (b.teacher - a.teacher) || a.name.localeCompare(b.name, 'bg'));
}
const initialsOf = name => String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
