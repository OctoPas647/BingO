'use strict';
/* ================= BingO Messages: the server side =================
   Chats live in chats/{chatId}, messages in chats/{chatId}/messages. People write messages, reactions,
   "read" and "typing" themselves (firestore.rules checks every write); this file does only what a client
   must not decide:
   - who is in a chat. Every class has a group chat (class_{classId}) whose members follow the class: the
     chatSyncClass trigger copies teacherIds + studentIds and the names/photos each time the class changes.
   - private chats (dm_{uidA}_{uidB}): chatOpenDm checks that both people share a class and one of them
     teaches it, so students can write to their teachers but not to strangers.
   - chatEnsure makes the group chats of classes that existed before Messages.
   - chatEmails gives the emails to share a Google Drive file with: the other person in a private chat, or
     (for a teacher) everyone in the class chat. Emails are never stored in a chat. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const db = getFirestore();
const fail = (code, msg) => { throw new HttpsError(code, msg); };
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const uidOf = req => { if (!req.auth) fail('unauthenticated', 'Влез с Google първо.'); return req.auth.uid; };
const classChatId = cid => 'class_' + cid;
const dmChatId = (a, b) => 'dm_' + [a, b].sort().join('_');
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

/* names and photos of the people in a class: the class roster for students, the profile for everyone */
async function peopleOf(classRef, c) {
  const teacherIds = c.teacherIds || [], ids = [...new Set([...teacherIds, ...(c.studentIds || [])])];
  if (!ids.length) return { ids, people: {} };
  const [users, members] = await Promise.all([
    db.getAll(...ids.map(id => db.doc('users/' + id))),
    classRef.collection('members').get()
  ]);
  const roster = Object.fromEntries(members.docs.map(d => [d.id, d.data()]));
  const people = {};
  users.forEach((u, i) => {
    const id = ids[i], p = u.exists ? u.data() : {};
    people[id] = { name: str((roster[id] && roster[id].name) || p.name || '', 80), photo: str(p.photo || '', 500), teacher: teacherIds.includes(id) };
  });
  return { ids, people };
}

/* make the group chat of a class match the class (members, names, title, colour) */
async function syncClassChat(classId, classSnap) {
  const ref = db.doc('chats/' + classChatId(classId));
  const snap = classSnap || await db.doc('classes/' + classId).get();
  if (!snap.exists) {
    await db.recursiveDelete(ref);
    try { await getStorage().bucket().deleteFiles({ prefix: `chats/${classChatId(classId)}/` }); } catch (e) { console.warn('chat files', e.message); }
    return null;
  }
  const c = snap.data(), { ids, people } = await peopleOf(snap.ref, c);
  const cur = await ref.get();
  const data = { type: 'class', classId, title: str(c.name, 60), color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#2F5BD3', archived: !!c.archived,
    members: ids, teacherIds: c.teacherIds || [], people };
  if (!cur.exists) await ref.set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), reads: {}, typing: {} });
  else {
    const d = cur.data();
    const changed = !sameSet(d.members || [], ids) || !sameSet(d.teacherIds || [], data.teacherIds) || d.title !== data.title || d.color !== data.color
      || d.archived !== data.archived || JSON.stringify(d.people || {}) !== JSON.stringify(people);
    if (changed) await ref.update(data);
  }
  return ref.id;
}

exports.chatSyncClass = onDocumentWritten({ document: 'classes/{classId}', region: 'europe-west1' }, async ev => {
  const after = ev.data && ev.data.after;
  await syncClassChat(ev.params.classId, after);
});

/* the group chats of my classes, for classes made before Messages (or if the trigger missed one) */
exports.chatEnsure = onCall(async req => {
  const uid = uidOf(req);
  const [asStudent, asTeacher] = await Promise.all([
    db.collection('classes').where('studentIds', 'array-contains', uid).get(),
    db.collection('classes').where('teacherIds', 'array-contains', uid).get()
  ]);
  const all = new Map([...asStudent.docs, ...asTeacher.docs].map(d => [d.id, d]));
  const ids = [];
  for (const [id, snap] of all) { await syncClassChat(id, snap); ids.push(classChatId(id)); }
  return { chats: ids };
});

/* a private chat with someone from one of my classes; a student can only start one with a teacher */
exports.chatOpenDm = onCall(async req => {
  const uid = uidOf(req), d = req.data || {};
  const other = str(d.uid, 128), classId = str(d.classId, 60);
  if (!other || other === uid) fail('invalid-argument', 'Избери с кого да пишеш.');
  const cs = await db.doc('classes/' + classId).get();
  if (!cs.exists) fail('not-found', 'Класът не съществува.');
  const c = cs.data(), inClass = id => (c.teacherIds || []).includes(id) || (c.studentIds || []).includes(id);
  if (!inClass(uid) || !inClass(other)) fail('permission-denied', 'Можеш да пишеш само на хора от твоите класове.');
  const teachers = [uid, other].filter(id => (c.teacherIds || []).includes(id));
  if (!teachers.length) fail('permission-denied', 'Учениците могат да пишат лично само на учителите си.');
  const ref = db.doc('chats/' + dmChatId(uid, other));
  const { people } = await peopleOf(cs.ref, c);
  const pair = { [uid]: people[uid] || { name: '', photo: '', teacher: false }, [other]: people[other] || { name: '', photo: '', teacher: false } };
  await db.runTransaction(async tx => {
    const cur = await tx.get(ref);
    if (!cur.exists) tx.set(ref, { type: 'dm', members: [uid, other].sort(), teacherIds: teachers, classIds: [classId], people: pair,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), reads: {}, typing: {} });
    else tx.update(ref, { people: pair, classIds: FieldValue.arrayUnion(classId), teacherIds: FieldValue.arrayUnion(...teachers) });
  });
  return { chatId: ref.id };
});

/* emails to share a Google Drive file with the chat (with the sender's own Google access, in the app) */
exports.chatEmails = onCall(async req => {
  const uid = uidOf(req);
  const chat = await db.doc('chats/' + str((req.data || {}).chatId, 300)).get();
  if (!chat.exists || !(chat.data().members || []).includes(uid)) fail('permission-denied', 'Не си в този разговор.');
  const c = chat.data();
  if (c.type !== 'dm' && !(c.teacherIds || []).includes(uid)) fail('permission-denied', 'В класния чат само учителят може да споделя с имейлите на всички. Използвай „Всеки с връзката“.');
  const others = (c.members || []).filter(id => id !== uid);
  if (!others.length) return { emails: [] };
  const users = await db.getAll(...others.map(id => db.doc('users/' + id)));
  return { emails: users.map(u => (u.exists ? str(u.data().email, 200).toLowerCase() : '')).filter(Boolean) };
});

exports._chatTest = { syncClassChat, dmChatId, classChatId };
