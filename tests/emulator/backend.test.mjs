/* BingO for classes: the backend against the Firebase emulators (Auth, Firestore, Functions, Storage).
   Run from the repository root:
     cd tests/emulator && npm install && cd ../..
     BINGO_FAKE_AI=1 npx --prefix tests/emulator firebase emulators:exec --project demo-bingo --only auth,firestore,functions,storage "node tests/emulator/backend.test.mjs"
   It plays a teacher and three students through classes, a test, grading, a live test, the projector quiz and a schedule,
   and checks that the security rules keep the answers and other students' work away from students. */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const PROJECT = 'demo-bingo';
let fails = 0, passes = 0;
const ok = (cond, what) => { if (cond) passes++; else { fails++; console.log('FAIL', what); } };
const denied = async (p, what) => { try { await p; fails++; console.log('FAIL (allowed)', what); } catch (e) { if (/permission|PERMISSION_DENIED|insufficient|failed-precondition/i.test((e.code || '') + ' ' + e.message)) passes++; else { fails++; console.log('FAIL (other error)', what, e.code, e.message); } } };

async function person(name, email) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', authDomain: 'localhost' }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
  const fn = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name }));
  const u = await signInWithCredential(auth, cred);
  const call = async (n, d) => (await httpsCallable(fn, n, { timeout: 120000 })(d)).data;
  return { app, auth, db, call, uid: u.user.uid, email, name, refresh: () => u.user.getIdToken(true) };
}

/* start from an empty emulator */
await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

const T = await person('Учител Иванова', 'teacher@school.bg');
const r0 = await T.call('registerProfile', { role: 'teacher', name: 'Мария Иванова', school: 'СУ Иван Вазов' });
ok(r0.role === 'teacher', 'teacher role (open policy)');
await T.refresh();

const { classId, code } = await T.call('createClass', { name: '11Б', subject: 'Математика', grade: '11' });
ok(/^[A-Z2-9]{6}$/.test(code), 'class code');

const A = await person('Ани', 'ani@student.bg');
ok((await A.call('registerProfile', { role: 'student', name: 'Ани Петрова' })).role === 'student', 'student role');
await denied(A.call('createClass', { name: 'x' }), 'student cannot create a class');
const j = await A.call('joinClass', { code });
ok(j.classId === classId, 'join by code');

/* invited by email before signing up -> joins on registration */
const inv = await T.call('inviteStudents', { classId, students: [{ name: 'Борис', email: 'boris@student.bg' }, { name: 'bad', email: 'nope' }] });
ok(inv.invited === 1 && inv.bad.length === 1, 'invite by email ' + JSON.stringify(inv));
const B = await person('Борис', 'boris@student.bg');
const rb = await B.call('registerProfile', { role: 'student', name: 'Борис Г.' });
ok(rb.joined && rb.joined.includes(classId), 'invited student joins on sign-up');
const C = await person('Цвети', 'cveti@student.bg');
await C.call('registerProfile', { role: 'student', name: 'Цвети' });   /* not in the class */

const cls = (await getDoc(doc(T.db, 'classes', classId))).data();
ok(cls.studentIds.length === 2, 'two students in class');
await denied(getDoc(doc(C.db, 'classes', classId)), 'outsider cannot read the class');
await denied(updateDoc(doc(A.db, 'classes', classId), { name: 'hacked' }), 'student cannot rename the class');
await denied(updateDoc(doc(T.db, 'classes', classId), { studentIds: [] }), 'teacher cannot edit members directly');
await updateDoc(doc(T.db, 'classes', classId), { name: '11Б клас', updatedAt: serverTimestamp() });

/* the teacher's test bank */
const tasks = [
  { id: 'q1', type: 'choice', prompt: '2 + 2 = ?', options: ['3', '4', '5', '6'], answer: 1, points: 2, explain: 'Четири.' },
  { id: 'q2', type: 'number', prompt: '10 / 4 = ?', answer: 2.5, points: 1 },
  { id: 'q3', type: 'order', prompt: 'Подреди', items: ['едно', 'две', 'три'], points: 1 },
  { id: 'q4', type: 'open', prompt: 'Обясни защо 0,(9) = 1.', rubric: [{ text: 'довод', points: 2 }], points: 2, aiCriteria: 'дроби' }
];
const tRef = await addDoc(collection(T.db, 'tests'), { ownerId: T.uid, title: 'Дроби', tasks, updatedAt: serverTimestamp() });
await denied(getDoc(doc(A.db, 'tests', tRef.id)), 'student cannot read the test bank');

const { assignmentIds: [aid] } = await T.call('publishAssignment', { classIds: [classId], title: 'Контролно 1', kind: 'test', tasks, testId: tRef.id, timeLimitMin: 30, settings: { feedback: { show: 'score', when: 'now' }, aiGrading: 'ai_review', grading: { scale: 'bg6' } } });
const asg = (await getDoc(doc(A.db, 'assignments', aid))).data();
ok(asg.tasks.length === 4 && asg.tasks.every(t => t.answer === undefined && t.explain === undefined), 'student sees tasks without answers');
ok(JSON.stringify(asg.tasks[2].items) !== JSON.stringify(['едно', 'две', 'три']), 'order items are mixed');
await denied(getDoc(doc(A.db, 'assignments', aid, 'key', 'answers')), 'student cannot read the key');
await denied(getDoc(doc(C.db, 'assignments', aid)), 'outsider cannot read the assignment');
const inbox = await getDocs(collection(A.db, 'users', A.uid, 'inbox'));
ok(inbox.docs.some(d => d.id === aid), 'student got a notification');

/* the student works */
const st = await A.call('startAttempt', { assignmentId: aid });
const atId = st.attemptId;
const att = (await getDoc(doc(A.db, 'attempts', atId))).data();
ok(att.order.length === 4 && att.status === 'in_progress', 'attempt started');
const mixed = asg.tasks[2].items, inv3 = ['едно', 'две', 'три'].map(x => mixed.indexOf(x));
await updateDoc(doc(A.db, 'attempts', atId), { 'responses.q1': 1, 'responses.q2': '2,5', 'responses.q3': { order: inv3, moved: true }, 'responses.q4': { text: 'Защото 1/3 = 0,(3), а 3 по 1/3 е 1, значи 0,(9) = 1.' }, answered: 4, current: 3, lastSeen: serverTimestamp(), events: [{ t: Date.now(), type: 'left' }], flags: 1 });
await denied(updateDoc(doc(A.db, 'attempts', atId), { status: 'graded' }), 'student cannot change the status');
await denied(updateDoc(doc(A.db, 'attempts', atId), { flags: 0 }), 'student cannot clear flags');
await denied(updateDoc(doc(A.db, 'attempts', atId), { events: [] }), 'student cannot clear the alert log');
await denied(getDoc(doc(B.db, 'attempts', atId)), 'another student cannot read my attempt');
const live = (await getDocs(query(collection(T.db, 'attempts'), where('teacherIds', 'array-contains', T.uid), where('assignmentId', '==', aid)))).docs.map(d => d.data());
ok(live.length === 1 && live[0].responses.q1 === 1 && live[0].flags === 1, 'teacher sees the work live');

const sub = await A.call('submitAttempt', { assignmentId: aid });
ok(sub.ok, 'submitted');
await denied(updateDoc(doc(A.db, 'attempts', atId), { 'responses.q1': 0 }), 'no changes after submitting');
const res = (await getDoc(doc(A.db, 'results', atId))).data();
ok(res.per.q1.status === 'right' && res.per.q2.status === 'right' && res.per.q3.status === 'right', 'closed tasks graded ' + JSON.stringify(res.per));
ok(res.ai && res.ai.q4 && res.ai.q4.points === 2 && res.needsReview === true, 'AI suggestion waits for review ' + JSON.stringify(res.ai));
ok(res.points === 4 && res.max === 6, 'points before approval ' + res.points);
await denied(getDoc(doc(A.db, 'reviews', atId)), 'answers hidden (feedback: score)');

/* the teacher grades */
const g = await T.call('gradeTask', { attemptId: atId, taskId: 'q4', points: 1.5, comment: 'Липсва обосновка с граница.' });
ok(g.points === 5.5 && g.needsReview === false, 'teacher grade ' + JSON.stringify(g));
const ex = await getDocs(collection(T.db, 'aiExamples', T.uid, 'items'));
ok(ex.size === 1 && ex.docs[0].data().teacherPoints === 1.5, 'AI learns from the teacher');
const g2 = await T.call('gradeTask', { attemptId: atId, grade: { value: 6, text: 'Отличен 6' } });
ok(g2.grade.text === 'Отличен 6', 'grade override');
await T.call('releaseResults', { assignmentId: aid, full: true });
const rv = (await getDoc(doc(A.db, 'reviews', atId))).data();
ok(rv.tasks.q1.answer === 1 && rv.tasks.q4.teacherComment, 'answers visible after release');

/* B starts, the teacher closes the test: B's attempt is handed in */
await B.call('startAttempt', { assignmentId: aid });
await updateDoc(doc(B.db, 'attempts', aid + '_' + B.uid), { 'responses.q1': 0, answered: 1 });
await T.call('updateAssignment', { assignmentId: aid, close: true });
const rb2 = (await getDoc(doc(B.db, 'results', aid + '_' + B.uid))).data();
ok(rb2 && rb2.per.q1.status === 'wrong', 'closing hands in open attempts');
await denied(B.call('startAttempt', { assignmentId: aid }).then(r => { if (r.finished) throw new Error('permission: finished'); return r; }), 'closed test cannot be started again');

/* a live test: lock and add time */
const { assignmentIds: [lid] } = await T.call('publishAssignment', { classIds: [classId], title: 'На живо', kind: 'live', tasks, timeLimitMin: 10 });
await A.call('startAttempt', { assignmentId: lid });
const s1 = await T.call('liveControl', { assignmentId: lid, action: 'start' });
ok(s1.live.state === 'running' && s1.live.endsAt > Date.now(), 'live started');
await T.call('liveControl', { assignmentId: lid, action: 'lock', uid: A.uid });
await denied(updateDoc(doc(A.db, 'attempts', lid + '_' + A.uid), { 'responses.q1': 1 }), 'locked student cannot answer');
await T.call('liveControl', { assignmentId: lid, action: 'unlock', uid: A.uid });
await updateDoc(doc(A.db, 'attempts', lid + '_' + A.uid), { 'responses.q1': 1 });
const before = (await getDoc(doc(A.db, 'attempts', lid + '_' + A.uid))).data().deadline.toMillis();
await T.call('liveControl', { assignmentId: lid, action: 'addTime', uid: A.uid, seconds: 120 });
const after = (await getDoc(doc(A.db, 'attempts', lid + '_' + A.uid))).data().deadline.toMillis();
ok(after - before === 120000, 'extra time for one student');
await T.call('liveControl', { assignmentId: lid, action: 'kick', uid: B.uid });
await denied(B.call('startAttempt', { assignmentId: lid }), 'kicked student cannot join');
await T.call('liveControl', { assignmentId: lid, action: 'end' });
const lr = (await getDoc(doc(T.db, 'results', lid + '_' + A.uid))).data();
ok(lr && lr.per.q1.status === 'right', 'ending grades everyone');

/* the projector quiz */
const quizTasks = tasks.slice(0, 2);
const { assignmentIds: [qid] } = await T.call('publishAssignment', { classIds: [classId], title: 'Куиз', kind: 'live', mode: 'quiz', tasks: quizTasks, settings: { quizSeconds: 20 } });
await A.call('startAttempt', { assignmentId: qid }); await B.call('startAttempt', { assignmentId: qid });
await T.call('liveControl', { assignmentId: qid, action: 'start' });
await updateDoc(doc(A.db, 'attempts', qid + '_' + A.uid), { 'quiz.0': { resp: 1, at: serverTimestamp() } });
await denied(updateDoc(doc(A.db, 'attempts', qid + '_' + A.uid), { 'quiz.0': { resp: 2, at: serverTimestamp() } }), 'quiz answer cannot be changed');
await updateDoc(doc(B.db, 'attempts', qid + '_' + B.uid), { 'quiz.0': { resp: 0, at: serverTimestamp() } });
const rev = await T.call('liveControl', { assignmentId: qid, action: 'reveal' });
ok(rev.live.leaderboard[0].uid === A.uid && rev.live.leaderboard[0].score > 500 && rev.live.stats.n === 2, 'quiz leaderboard ' + JSON.stringify(rev.live.leaderboard));
await T.call('liveControl', { assignmentId: qid, action: 'next' });
const fin = await T.call('liveControl', { assignmentId: qid, action: 'next' });
ok(fin.live.state === 'ended', 'quiz ends after the last question');

/* everyday practice shared with the teacher */
await setDoc(doc(A.db, 'progress', A.uid), { name: 'Ани', skills: { 'math.quad': { p: 0.3, n: 5, w: 6 } }, updatedAt: serverTimestamp(), teacherIds: (await getDoc(doc(A.db, 'progress', A.uid))).data().teacherIds, classIds: [classId] }, { merge: false }).catch(async () => {
  await updateDoc(doc(A.db, 'progress', A.uid), { name: 'Ани', skills: { 'math.quad': { p: 0.3, n: 5, w: 6 } }, updatedAt: serverTimestamp() });
});
await updateDoc(doc(A.db, 'progress', A.uid), { name: 'Ани', skills: { 'math.quad': { p: 0.3, n: 5, w: 6 } }, updatedAt: serverTimestamp() });
await denied(updateDoc(doc(A.db, 'progress', A.uid), { teacherIds: [] }), 'student cannot hide progress from teachers by editing teacherIds');
const prog = await getDocs(query(collection(T.db, 'progress'), where('teacherIds', 'array-contains', T.uid)));
ok(prog.docs.some(d => d.id === A.uid), 'teacher sees practice progress');

/* recurring homework */
const sRef = await addDoc(collection(T.db, 'schedules'), { ownerId: T.uid, classId, kind: 'practice', title: 'Упражнение', days: [1, 2, 3, 4, 5, 6, 7], time: '00:00', tz: 'Europe/Sofia', durationHours: 48, active: true, settings: { practice: { subject: 'math', weakest: true, size: 10 } } });
await denied(addDoc(collection(A.db, 'schedules'), { ownerId: A.uid, classId, active: true }), 'student cannot make a schedule');
const made = await T.call('runScheduleNow', { scheduleId: sRef.id });
ok(made.made === 1, 'schedule made homework');
const prac = (await getDocs(query(collection(T.db, 'assignments'), where('teacherIds', 'array-contains', T.uid), where('classId', '==', classId)))).docs.map(d => d.data()).find(a => a.kind === 'practice');
ok(prac && prac.settings.practice.skills.includes('quad'), 'practice targets the weakest skill ' + JSON.stringify(prac && prac.settings.practice));

/* Gemini for teachers (fake in the emulator) */
const gen = await T.call('teacherAI', { action: 'generate', topic: 'събиране', n: 3 });
ok(gen.tasks.length === 3 && gen.tasks[0].type === 'choice', 'AI makes a test');
await denied(A.call('teacherAI', { action: 'generate', topic: 'x' }), 'students cannot use the teacher AI');

/* roles: whitelist policy */
await denied(T.call('adminSetPolicy', { policy: 'whitelist' }), 'only admins change the policy');

for (const p of [T, A, B, C]) await deleteApp(p.app);
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
