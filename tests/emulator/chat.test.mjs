/* BingO Messages against the Firebase emulators: who is in which chat, what each person may write, files.
   Run from the repository root (same setup as backend.test.mjs):
     cd tests/emulator && npm install && cd ../..
     npx --prefix tests/emulator firebase emulators:exec --project demo-bingo --only auth,firestore,functions,storage "node tests/emulator/chat.test.mjs"
   A teacher, two students of the class and an outsider: the class chat follows the class, private chats need a
   teacher, nobody outside a chat can read it, reactions are one per person, only the sender (or the teacher) can
   remove a message, files up to 25 MB reach only the chat's members. */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, orderBy, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from 'firebase/storage';

const PROJECT = 'demo-bingo';
let fails = 0, passes = 0;
const ok = (cond, what) => { if (cond) passes++; else { fails++; console.log('FAIL', what); } };
const denied = async (p, what) => { try { await p; fails++; console.log('FAIL (allowed)', what); } catch (e) { if (/permission|PERMISSION_DENIED|unauthorized|insufficient|failed-precondition/i.test((e.code || '') + ' ' + e.message)) passes++; else { fails++; console.log('FAIL (other error)', what, e.code, e.message); } } };
const allowed = async (p, what) => { try { await p; passes++; } catch (e) { fails++; console.log('FAIL (denied)', what, e.code, e.message); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) { } await wait(300); } ok(false, 'timed out: ' + what); return false; }

async function person(name, email) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', authDomain: 'localhost', storageBucket: PROJECT + '.appspot.com' }, 'chat-' + email);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
  const fn = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const st = getStorage(app); connectStorageEmulator(st, '127.0.0.1', 9199);
  const u = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name })));
  const call = async (n, d) => (await httpsCallable(fn, n, { timeout: 120000 })(d)).data;
  return { app, db, st, call, uid: u.user.uid, email, name, refresh: () => u.user.getIdToken(true) };
}
/* a message the way the app writes it: the message and the chat's last message in one batch */
function send(P, chatId, fields = {}) {
  const r = doc(collection(P.db, 'chats', chatId, 'messages'));
  const b = writeBatch(P.db);
  b.set(r, { from: P.uid, at: serverTimestamp(), text: 'здравей', files: [], links: [], reply: null, reactions: {}, deleted: false, ...fields });
  b.update(doc(P.db, 'chats', chatId), { lastMessage: { from: P.uid, at: serverTimestamp(), text: fields.text ?? 'здравей', key: '' }, updatedAt: serverTimestamp(), ['reads.' + P.uid]: serverTimestamp() });
  return b.commit().then(() => r.id);
}

await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

const T = await person('Учител', 'teacher@chat.bg');
await T.call('registerProfile', { role: 'teacher', name: 'Мария Иванова' }); await T.refresh();
const { classId, code } = await T.call('createClass', { name: '11Б', subject: 'Математика' });
const A = await person('Ани', 'ani@chat.bg'); await A.call('registerProfile', { role: 'student', name: 'Ани Петрова' });
const B = await person('Борис', 'boris@chat.bg'); await B.call('registerProfile', { role: 'student', name: 'Борис Г.' });
const X = await person('Външен', 'x@chat.bg'); await X.call('registerProfile', { role: 'student', name: 'Външен' });
await A.call('joinClass', { code }); await B.call('joinClass', { code });

/* the class chat follows the class (trigger) */
const cid = 'class_' + classId;
await until(async () => { const d = await getDoc(doc(T.db, 'chats', cid)); return d.exists() && d.data().members.length === 3; }, 'class chat has the teacher and two students');
const chat = (await getDoc(doc(A.db, 'chats', cid))).data();
ok(chat.type === 'class' && chat.title === '11Б' && chat.people[T.uid].teacher === true && chat.people[A.uid].name === 'Ани Петрова', 'class chat names and roles');
ok(!JSON.stringify(chat).includes('@chat.bg'), 'no emails in a chat');
await denied(getDoc(doc(X.db, 'chats', cid)), 'an outsider cannot read the class chat');
const mine = await getDocs(query(collection(A.db, 'chats'), where('members', 'array-contains', A.uid)));
ok(mine.docs.some(d => d.id === cid), 'a student lists their chats');
await denied(getDocs(query(collection(A.db, 'chats'), where('type', '==', 'class'))), 'nobody can list chats they are not in');

/* messages */
const m1 = await send(A, cid, { text: 'Кога е контролното?' });
ok(!!m1, 'a student writes in the class chat');
await allowed(send(T, cid, { text: 'В петък' }), 'the teacher writes');
await denied(send(X, cid), 'an outsider cannot write');
await denied(getDocs(collection(X.db, 'chats', cid, 'messages')), 'an outsider cannot read the messages');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: B.uid, at: serverTimestamp(), text: 'фалшиво', files: [], links: [], reply: null, reactions: {}, deleted: false }), 'cannot write as someone else');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: A.uid, at: new Date(2020, 1, 1), text: 'x', files: [], links: [], reply: null, reactions: {}, deleted: false }), 'cannot back-date a message');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: A.uid, at: serverTimestamp(), text: '', files: [], links: [], reply: null, reactions: {}, deleted: false }), 'an empty message is refused');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: A.uid, at: serverTimestamp(), text: 'x'.repeat(4001), files: [], links: [], reply: null, reactions: {}, deleted: false }), 'text over 4000 is refused');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: A.uid, at: serverTimestamp(), text: 'x', files: [], links: [], reply: null, reactions: { [B.uid]: '❤️' }, deleted: false }), 'cannot start with fake reactions');
await denied(setDoc(doc(collection(A.db, 'chats', cid, 'messages')), { from: A.uid, at: serverTimestamp(), text: 'x', files: [], links: [], reply: null, reactions: {}, deleted: false, pinned: true }), 'unknown fields are refused');
const msgs = await getDocs(query(collection(B.db, 'chats', cid, 'messages'), orderBy('at')));
ok(msgs.size === 2 && msgs.docs[0].data().text === 'Кога е контролното?', 'a classmate reads the messages in order');

/* the chat document: only my own read/typing, only my own last message */
await allowed(updateDoc(doc(B.db, 'chats', cid), { ['reads.' + B.uid]: serverTimestamp() }), 'mark as read');
await allowed(updateDoc(doc(B.db, 'chats', cid), { ['typing.' + B.uid]: serverTimestamp() }), 'typing');
await denied(updateDoc(doc(B.db, 'chats', cid), { ['reads.' + A.uid]: serverTimestamp() }), 'cannot mark read for someone else');
await denied(updateDoc(doc(B.db, 'chats', cid), { members: [B.uid] }), 'cannot change who is in the chat');
await denied(updateDoc(doc(B.db, 'chats', cid), { title: 'хак' }), 'cannot rename the class chat');
await denied(updateDoc(doc(B.db, 'chats', cid), { lastMessage: { from: A.uid, at: serverTimestamp(), text: 'фалшиво', key: '' }, updatedAt: serverTimestamp() }), 'cannot fake someone else\'s last message');

/* reactions: one per person, only my own */
const mref = u => doc(u.db, 'chats', cid, 'messages', m1);
await allowed(updateDoc(mref(B), { ['reactions.' + B.uid]: '❤️' }), 'react');
await allowed(updateDoc(mref(T), { ['reactions.' + T.uid]: '👍' }), 'the teacher reacts');
await denied(updateDoc(mref(B), { ['reactions.' + A.uid]: '😡' }), 'cannot react for someone else');
await denied(updateDoc(mref(B), { text: 'промених го' }), 'cannot edit someone else\'s message');
await allowed(updateDoc(mref(B), { ['reactions.' + B.uid]: deleteField() }), 'take a reaction back');
ok(Object.keys((await getDoc(mref(A))).data().reactions).join() === T.uid, 'reactions kept per person');

/* unsend and the teacher removing a message */
const unsend = (P, id) => updateDoc(doc(P.db, 'chats', cid, 'messages', id), { deleted: true, deletedBy: P.uid, text: '', files: [], links: [], reply: null });
const m2 = await send(B, cid, { text: 'грубо' });
await denied(unsend(A, m2), 'a classmate cannot remove a message');
await allowed(unsend(T, m2), 'the teacher removes a message in the class chat');
const m3 = await send(A, cid, { text: 'сбърках' });
await denied(updateDoc(doc(A.db, 'chats', cid, 'messages', m3), { deleted: true, deletedBy: A.uid, text: 'остава', files: [], links: [], reply: null }), 'unsend must clear the text');
await allowed(unsend(A, m3), 'unsend my own message');
await denied(updateDoc(doc(A.db, 'chats', cid, 'messages', m3), { ['reactions.' + A.uid]: '❤️' }), 'no reactions on a removed message');

/* private chats */
await denied(A.call('chatOpenDm', { uid: B.uid, classId }), 'two students cannot start a private chat');
await denied(X.call('chatOpenDm', { uid: T.uid, classId }), 'an outsider cannot write to the teacher');
const { chatId: dm } = await A.call('chatOpenDm', { uid: T.uid, classId });
ok(dm === 'dm_' + [A.uid, T.uid].sort().join('_'), 'private chat id');
ok((await T.call('chatOpenDm', { uid: A.uid, classId })).chatId === dm, 'the same private chat from the other side');
await allowed(send(A, dm, { text: 'Може ли въпрос?' }), 'the student writes to the teacher');
await denied(getDoc(doc(B.db, 'chats', dm)), 'a classmate cannot read a private chat');
await denied(getDocs(collection(B.db, 'chats', dm, 'messages')), 'a classmate cannot read private messages');
const dmUnsend = (P, id) => updateDoc(doc(P.db, 'chats', dm, 'messages', id), { deleted: true, deletedBy: P.uid, text: '', files: [], links: [], reply: null });
await denied(dmUnsend(A, await send(T, dm, { text: 'Разбира се' })), 'a student cannot remove the teacher\'s message');
ok((await A.call('chatEmails', { chatId: dm })).emails.join() === 'teacher@chat.bg', 'emails for sharing a Drive file in a private chat');
await denied(A.call('chatEmails', { chatId: cid }), 'a student does not get the class\'s emails');
ok((await T.call('chatEmails', { chatId: cid })).emails.sort().join() === 'ani@chat.bg,boris@chat.bg', 'the teacher gets the class\'s emails to share a file');
await denied(X.call('chatEmails', { chatId: dm }), 'an outsider gets no emails');

/* files: up to 25 MB, only members */
const fpath = (P, chatId, name = 'a.txt') => `chats/${chatId}/${P.uid}/m1/${name}`;
await allowed(uploadBytes(ref(A.st, fpath(A, cid)), new TextEncoder().encode('Здравей'), { contentType: 'text/plain' }), 'a member uploads a file');
await allowed(getBytes(ref(B.st, fpath(A, cid))), 'a classmate opens it');
await denied(getBytes(ref(X.st, fpath(A, cid))), 'an outsider cannot open it');
await denied(uploadBytes(ref(X.st, fpath(X, cid)), new Uint8Array(10)), 'an outsider cannot upload');
await denied(uploadBytes(ref(A.st, fpath(B, cid))), 'cannot upload into someone else\'s folder');
await denied(uploadBytes(ref(A.st, fpath(A, cid, 'big.bin')), new Uint8Array(25 * 1024 * 1024 + 1)), 'over 25 MB is refused');
await allowed(uploadBytes(ref(A.st, fpath(A, cid, 'any.xyz')), new Uint8Array(1000), { contentType: 'application/x-anything' }), 'any file type');
await denied(getBytes(ref(B.st, fpath(A, dm))), 'not in the private chat: no file');

/* membership changes reach the chat; a removed student loses the class chat */
await T.call('removeStudent', { classId, uid: B.uid });
await until(async () => !(await getDoc(doc(T.db, 'chats', cid))).data().members.includes(B.uid), 'a removed student leaves the class chat');
await denied(getDocs(collection(B.db, 'chats', cid, 'messages')), 'a removed student cannot read the class chat any more');
await T.call('updateClass', { classId, name: '11Б клас' });
await until(async () => (await getDoc(doc(T.db, 'chats', cid))).data().title === '11Б клас', 'renaming the class renames its chat');
await T.call('deleteClass', { classId });
await until(async () => { try { return !(await getDoc(doc(T.db, 'chats', cid))).exists(); } catch (e) { return true; } }, 'deleting the class deletes its chat');

console.log(`chat: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
