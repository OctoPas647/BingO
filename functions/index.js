'use strict';
/* ================= BingO for classes: Cloud Functions =================
   Everything a client must not be trusted with runs here: roles, class membership, the answer key,
   starting and grading an attempt, live-test control, AI grading and the schedule.
   The Firestore rules (firestore.rules) let the app read and write only what is safe; the rest goes through these calls.
   Grading uses functions/shared/edu.js, a copy of the app's own answer checking (tools/sync-functions.js). */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const EDU = require('./shared/edu');
const AI = require('./ai');
const PROCTOR = require('./proctor');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 20 });

const db = getFirestore();
const auth = getAuth();

/* ---------- small helpers ---------- */
const fail = (code, msg) => { throw new HttpsError(code, msg); };
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ms = v => (v instanceof Timestamp ? v.toMillis() : Number.isFinite(v) ? v : v && typeof v._seconds === 'number' ? v._seconds * 1000 : null);
const ts = v => (Number.isFinite(v) ? Timestamp.fromMillis(v) : null);
const now = () => Date.now();
const GRACE_MS = 2 * 60 * 1000;   /* a slow phone still gets its last answer in */

function uidOf(req) { if (!req.auth) fail('unauthenticated', 'Влез с Google първо.'); return req.auth.uid; }
function roleOf(req) { return (req.auth && req.auth.token && req.auth.token.role) || 'student'; }
function requireTeacher(req) { const uid = uidOf(req); const r = roleOf(req); if (r !== 'teacher' && r !== 'admin') fail('permission-denied', 'Само за учители.'); return uid; }
function requireAdmin(req) { const uid = uidOf(req); if (roleOf(req) !== 'admin') fail('permission-denied', 'Само за администратор.'); return uid; }

async function getDoc(path, what) { const d = await db.doc(path).get(); if (!d.exists) fail('not-found', (what || 'Документът') + ' не съществува.'); return d; }
async function classFor(teacherUid, classId) {
  const c = await getDoc('classes/' + str(classId, 60), 'Класът');
  if (!(c.data().teacherIds || []).includes(teacherUid)) fail('permission-denied', 'Това не е твой клас.');
  return c;
}
async function assignmentFor(teacherUid, aid) {
  const a = await getDoc('assignments/' + str(aid, 80), 'Заданието');
  if (!(a.data().teacherIds || []).includes(teacherUid)) fail('permission-denied', 'Това не е твое задание.');
  return a;
}
async function userByEmail(email) { try { return await auth.getUserByEmail(email); } catch (e) { return null; } }
const emailOk = e => typeof e === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const normEmail = e => String(e || '').trim().toLowerCase();

/* ========================================================================
   Roles. In the app anyone picks "учител" or "ученик" (policy "open").
   An admin can switch the policy in config/roles without an app update:
     open       anyone can be a teacher
     whitelist  only emails / domains in the list ("ivan@school.bg", "@school.bg")
     code       a school code from schoolCodes/{CODE}
     approval   the request waits in teacherRequests/{uid} until an admin approves it
   ======================================================================== */
async function rolesConfig() {
  const d = await db.doc('config/roles').get();
  const c = d.exists ? d.data() : {};
  return { policy: ['open', 'whitelist', 'code', 'approval'].includes(c.policy) ? c.policy : 'open', whitelist: Array.isArray(c.whitelist) ? c.whitelist.map(normEmail) : [], admins: Array.isArray(c.admins) ? c.admins.map(normEmail) : [] };
}
function onWhitelist(cfg, email) {
  const e = normEmail(email); if (!e) return false;
  return cfg.whitelist.some(w => (w.startsWith('@') ? e.endsWith(w) : e === w));
}

async function setRole(uid, role) {
  const u = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(u.customClaims || {}), role });
  await db.doc('users/' + uid).set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/* Adds a signed-in student to every class that invited their email (teacher typed it or imported a CSV) */
async function acceptInvites(uid, email, name) {
  const e = normEmail(email); if (!e) return [];
  const q = await db.collection('classes').where('invited', 'array-contains', e).get();
  const joined = [];
  for (const c of q.docs) { await addMember(c, uid, name, e); joined.push(c.id); }
  return joined;
}

async function addMember(classDoc, uid, name, email) {
  const ref = classDoc.ref, c = classDoc.data();
  const batch = db.batch();
  batch.update(ref, { studentIds: FieldValue.arrayUnion(uid), invited: FieldValue.arrayRemove(normEmail(email)), updatedAt: FieldValue.serverTimestamp() });
  batch.set(ref.collection('members').doc(uid), { uid, name: str(name, 80), email: normEmail(email), joinedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.doc('users/' + uid), { classIds: FieldValue.arrayUnion(classDoc.id) }, { merge: true });
  batch.set(db.doc('progress/' + uid), { teacherIds: FieldValue.arrayUnion(...(c.teacherIds || [])), classIds: FieldValue.arrayUnion(classDoc.id) }, { merge: true });
  await batch.commit();
  /* tests and homework that are still open reach a student who joins late */
  const open = await db.collection('assignments').where('classId', '==', classDoc.id).where('status', 'in', ['scheduled', 'open']).get();
  for (const a of open.docs) await a.ref.update({ studentIds: FieldValue.arrayUnion(uid) });
}

exports.registerProfile = onCall(async req => {
  const uid = uidOf(req);
  const d = req.data || {};
  const want = d.role === 'teacher' ? 'teacher' : 'student';
  const user = await auth.getUser(uid);
  const email = normEmail(user.email);
  const name = str(d.name, 80) || user.displayName || '';
  const ref = db.doc('users/' + uid), existing = await ref.get();
  const cfg = await rolesConfig();
  let role = (user.customClaims && user.customClaims.role) || (existing.exists && existing.data().role) || '';
  let pending = false, message = '';
  /* the first admin: an email listed in config/roles.admins */
  if (cfg.admins.includes(email)) role = 'admin';
  else if (want === 'teacher' && role !== 'teacher' && role !== 'admin') {
    if (cfg.policy === 'open') role = 'teacher';
    else if (cfg.policy === 'whitelist') { if (onWhitelist(cfg, email)) role = 'teacher'; else { role = role || 'student'; message = 'Имейлът ти не е в списъка с учители на училището.'; } }
    else if (cfg.policy === 'code') {
      const code = str(d.schoolCode, 20).toUpperCase();
      const sc = code ? await db.doc('schoolCodes/' + code).get() : null;
      const ok = sc && sc.exists && sc.data().active !== false && !(sc.data().maxUses > 0 && (sc.data().uses || 0) >= sc.data().maxUses);
      if (ok) { role = 'teacher'; await sc.ref.update({ uses: FieldValue.increment(1) }); d.school = d.school || sc.data().school; }
      else { role = role || 'student'; message = code ? 'Кодът на училището не е верен или е изтекъл.' : 'Нужен е код на училището.'; }
    } else if (cfg.policy === 'approval') {
      role = role || 'student'; pending = true;
      await db.doc('teacherRequests/' + uid).set({ uid, email, name, school: str(d.school, 120), at: FieldValue.serverTimestamp(), status: 'pending' }, { merge: true });
      message = 'Заявката ти за учител чака одобрение.';
    }
  } else if (!role) role = 'student';

  const profile = {
    uid, email, name, photo: user.photoURL || '', role, school: str(d.school, 120) || (existing.exists ? existing.data().school || '' : ''),
    subjects: Array.isArray(d.subjects) ? d.subjects.slice(0, 12).map(s => str(s, 40)) : (existing.exists ? existing.data().subjects || [] : []),
    lang: d.lang === 'en' ? 'en' : 'bg', teacherPending: pending, updatedAt: FieldValue.serverTimestamp()
  };
  if (!existing.exists) profile.createdAt = FieldValue.serverTimestamp();
  await ref.set(profile, { merge: true });
  if (!user.customClaims || user.customClaims.role !== role) await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), role });
  const joined = role === 'student' ? await acceptInvites(uid, email, name) : [];
  return { uid, role, pending, message, joined };
});

/* ---------- admin ---------- */
exports.adminSetPolicy = onCall(async req => {
  requireAdmin(req);
  const d = req.data || {};
  const upd = {};
  if (d.policy) { if (!['open', 'whitelist', 'code', 'approval'].includes(d.policy)) fail('invalid-argument', 'Непозната политика.'); upd.policy = d.policy; }
  if (Array.isArray(d.whitelist)) upd.whitelist = d.whitelist.map(normEmail).filter(Boolean).slice(0, 2000);
  if (Array.isArray(d.admins)) upd.admins = d.admins.map(normEmail).filter(Boolean).slice(0, 50);
  await db.doc('config/roles').set({ ...upd, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

exports.adminSchoolCode = onCall(async req => {
  requireAdmin(req);
  const d = req.data || {};
  if (d.action === 'disable') { await db.doc('schoolCodes/' + str(d.code, 20).toUpperCase()).update({ active: false }); return { ok: true }; }
  let code = str(d.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) code = 'SCH' + EDU.eduCode();
  await db.doc('schoolCodes/' + code).set({ code, school: str(d.school, 120), maxUses: Number(d.maxUses) > 0 ? Math.floor(d.maxUses) : 0, uses: 0, active: true, createdAt: FieldValue.serverTimestamp() });
  return { code };
});

exports.adminTeacherRequest = onCall(async req => {
  requireAdmin(req);
  const d = req.data || {}, uid = str(d.uid, 128);
  const r = await getDoc('teacherRequests/' + uid, 'Заявката');
  if (d.action === 'approve') { await setRole(uid, 'teacher'); await db.doc('users/' + uid).set({ teacherPending: false, school: r.data().school || '' }, { merge: true }); }
  await r.ref.update({ status: d.action === 'approve' ? 'approved' : 'rejected', decidedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

exports.setUserRole = onCall(async req => {
  requireAdmin(req);
  const d = req.data || {};
  if (!['student', 'teacher', 'admin'].includes(d.role)) fail('invalid-argument', 'Невалидна роля.');
  let uid = str(d.uid, 128);
  if (!uid && emailOk(d.email)) { const u = await userByEmail(normEmail(d.email)); if (!u) fail('not-found', 'Няма такъв потребител.'); uid = u.uid; }
  if (!uid) fail('invalid-argument', 'Липсва потребител.');
  await setRole(uid, d.role);
  return { uid, role: d.role };
});

/* ========================================================================
   Classes
   ======================================================================== */
async function freeCode() {
  for (let i = 0; i < 20; i++) {
    const code = EDU.eduCode();
    const d = await db.doc('codes/' + code).get();
    if (!d.exists) return code;
  }
  fail('resource-exhausted', 'Не успях да създам код, опитай пак.');
}

exports.createClass = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const name = str(d.name, 40); if (!name) fail('invalid-argument', 'Напиши име на класа.');
  const code = await freeCode();
  const ref = db.collection('classes').doc();
  const me = await db.doc('users/' + uid).get();
  await db.runTransaction(async tx => {
    tx.set(ref, {
      name, subject: str(d.subject, 60), grade: str(d.grade, 10), school: str(d.school, 120) || (me.exists ? me.data().school || '' : ''),
      ownerId: uid, ownerName: me.exists ? me.data().name || '' : '', teacherIds: [uid], code, studentIds: [], invited: [], color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#2F5BD3',
      archived: false, classroomId: str(d.classroomId, 40), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(db.doc('codes/' + code), { classId: ref.id, createdAt: FieldValue.serverTimestamp() });
  });
  return { classId: ref.id, code };
});

exports.updateClass = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const c = await classFor(uid, d.classId);
  const upd = { updatedAt: FieldValue.serverTimestamp() };
  for (const k of ['name', 'subject', 'grade', 'school']) if (typeof d[k] === 'string') upd[k] = str(d[k], k === 'school' ? 120 : 60);
  if (typeof d.archived === 'boolean') upd.archived = d.archived;
  if (/^#[0-9a-f]{6}$/i.test(d.color || '')) upd.color = d.color;
  if (d.newCode) {
    const code = await freeCode();
    await db.doc('codes/' + c.data().code).delete().catch(() => { });
    await db.doc('codes/' + code).set({ classId: c.id, createdAt: FieldValue.serverTimestamp() });
    upd.code = code;
  }
  if (emailOk(d.addTeacher)) {
    const t = await userByEmail(normEmail(d.addTeacher));
    if (!t || !['teacher', 'admin'].includes((t.customClaims || {}).role)) fail('not-found', 'Няма учител с този имейл.');
    upd.teacherIds = FieldValue.arrayUnion(t.uid);
  }
  await c.ref.update(upd);
  return { ok: true, code: upd.code || c.data().code };
});

exports.deleteClass = onCall(async req => {
  const uid = requireTeacher(req);
  const c = await classFor(uid, (req.data || {}).classId);
  if (c.data().ownerId !== uid) fail('permission-denied', 'Само създателят на класа може да го изтрие.');
  await db.doc('codes/' + c.data().code).delete().catch(() => { });
  await db.recursiveDelete(c.ref);
  return { ok: true };
});

exports.joinClass = onCall(async req => {
  const uid = uidOf(req);
  const code = str((req.data || {}).code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!EDU.eduCodeOk(code)) fail('invalid-argument', 'Кодът е 6 знака, напр. K7M2QX.');
  const map = await db.doc('codes/' + code).get();
  if (!map.exists) fail('not-found', 'Няма клас с този код.');
  const c = await getDoc('classes/' + map.data().classId, 'Класът');
  if (c.data().archived) fail('failed-precondition', 'Класът е архивиран.');
  const user = await auth.getUser(uid);
  const me = await db.doc('users/' + uid).get();
  await addMember(c, uid, (me.exists && me.data().name) || user.displayName || '', user.email || '');
  return { classId: c.id, name: c.data().name, subject: c.data().subject || '' };
});

exports.leaveClass = onCall(async req => {
  const uid = uidOf(req);
  const c = await getDoc('classes/' + str((req.data || {}).classId, 60), 'Класът');
  await removeMember(c, uid);
  return { ok: true };
});

async function removeMember(c, uid) {
  const batch = db.batch();
  batch.update(c.ref, { studentIds: FieldValue.arrayRemove(uid) });
  batch.delete(c.ref.collection('members').doc(uid));
  batch.set(db.doc('users/' + uid), { classIds: FieldValue.arrayRemove(c.id) }, { merge: true });
  await batch.commit();
}

exports.inviteStudents = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const c = await classFor(uid, d.classId);
  const list = (Array.isArray(d.students) ? d.students : []).slice(0, 500);
  let added = 0, invited = 0, bad = [];
  const roster = {};
  for (const s of list) {
    const email = normEmail(s && s.email), name = str(s && s.name, 80);
    if (!emailOk(email)) { if (name || email) bad.push(email || name); continue; }
    const u = await userByEmail(email);
    if (u) { await addMember(c, u.uid, name || u.displayName || '', email); added++; }
    else { await c.ref.update({ invited: FieldValue.arrayUnion(email) }); invited++; }
    if (name) roster[email.replace(/\./g, ',')] = name;
  }
  if (Object.keys(roster).length) await c.ref.set({ roster }, { merge: true });
  return { added, invited, bad };
});

exports.removeStudent = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const c = await classFor(uid, d.classId);
  if (d.email) { await c.ref.update({ invited: FieldValue.arrayRemove(normEmail(d.email)) }); return { ok: true }; }
  await removeMember(c, str(d.uid, 128));
  return { ok: true };
});

/* ========================================================================
   Assignments: a test, homework, a live test or a BingO practice, given to one class.
   The tasks students see are copied into the assignment without answers; the key goes to
   assignments/{id}/key/answers, which only the class's teachers can read.
   ======================================================================== */
const KINDS = ['homework', 'test', 'live', 'practice'];
function cleanSettings(s, kind) {
  s = s || {};
  const anti = s.antiCheat || {};
  const fb = s.feedback || {};
  const gr = s.grading || {};
  return {
    shuffleQ: s.shuffleQ !== false && kind !== 'live-quiz',
    shuffleOpts: s.shuffleOpts !== false,
    oneByOne: !!s.oneByOne,                  /* no going back to an earlier question */
    allowHints: !!s.allowHints && kind === 'homework',
    attempts: Math.min(10, Math.max(1, Math.floor(Number(s.attempts) || 1))),
    lateAllowed: !!s.lateAllowed,
    antiCheat: EDU.eduAcClean(anti, kind === 'live-quiz' ? 'live' : kind, kind === 'live-quiz' ? 'quiz' : 'normal'),
    feedback: { show: ['none', 'score', 'full'].includes(fb.show) ? fb.show : 'score', when: ['now', 'close', 'manual'].includes(fb.when) ? fb.when : 'now' },
    grading: { scale: EDU.EDU_SCALES.includes(gr.scale) ? gr.scale : 'bg6', thresholds: Array.isArray(gr.thresholds) && gr.thresholds.length === 4 && gr.thresholds.every(Number.isFinite) ? gr.thresholds : EDU.EDU_BG6_DEFAULT },
    aiGrading: ['manual', 'ai_review', 'ai_auto'].includes(s.aiGrading) ? s.aiGrading : 'ai_review',
    aiInstructions: str(s.aiInstructions, 3000),
    quizSeconds: Math.min(240, Math.max(5, Math.floor(Number(s.quizSeconds) || 20))),
    practice: s.practice && typeof s.practice === 'object' ? { subject: str(s.practice.subject, 20), skills: Array.isArray(s.practice.skills) ? s.practice.skills.slice(0, 20).map(x => str(x, 40)) : [], size: Math.min(30, Math.max(4, Math.floor(Number(s.practice.size) || 10))), weakest: !!s.practice.weakest } : null
  };
}

function cleanTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  const out = [], seen = new Set();
  for (const t0 of tasks.slice(0, 200)) {
    if (!t0 || typeof t0 !== 'object') continue;
    const t = JSON.parse(JSON.stringify(t0));
    t.id = str(t.id, 60) || ('q' + out.length);
    while (seen.has(t.id)) t.id += 'x';
    seen.add(t.id);
    t.media = Array.isArray(t.media) ? t.media.filter(b => b && typeof b === 'object' && /^https:\/\//.test(b.src || '')).slice(0, 4) : [];
    const p = EDU.eduTaskProblem(t);
    if (p) fail('invalid-argument', `Задача ${out.length + 1}: ${p}.`);
    out.push(t);
  }
  return out;
}

async function weakestSkills(classId, subject, n) {
  /* the skills where the class loses the most points, from everyday BingO practice (progress/{uid}) */
  const q = await db.collection('progress').where('classIds', 'array-contains', classId).get();
  const tot = {};
  for (const d of q.docs) for (const [k, v] of Object.entries(d.data().skills || {})) {
    if (subject && !k.startsWith(subject + '.')) continue;
    if (!v || !Number.isFinite(v.p)) continue;
    const e = tot[k] || (tot[k] = { lost: 0, n: 0 }); e.lost += (v.w || 1) * (1 - v.p); e.n++;
  }
  return Object.entries(tot).sort((a, b) => b[1].lost / b[1].n - a[1].lost / a[1].n).slice(0, n).map(([k]) => k.split('.').slice(1).join('.'));
}

async function createAssignment(uid, classDoc, d, extra = {}) {
  const kind = KINDS.includes(d.kind) ? d.kind : 'homework';
  const mode = kind === 'live' && d.mode === 'quiz' ? 'quiz' : 'normal';
  const settings = cleanSettings(d.settings, kind === 'live' && mode === 'quiz' ? 'live-quiz' : kind);
  let tasks = kind === 'practice' ? [] : cleanTasks(d.tasks);
  if (kind !== 'practice' && !tasks.length) fail('invalid-argument', 'Тестът няма задачи.');
  if (kind === 'practice' && settings.practice && settings.practice.weakest) settings.practice.skills = await weakestSkills(classDoc.id, settings.practice.subject, 3);
  const ref = db.collection('assignments').doc();
  const { pub, key } = EDU.eduStrip(tasks, ref.id);
  const opensAt = Number.isFinite(d.opensAt) ? d.opensAt : now();
  const closesAt = Number.isFinite(d.closesAt) && d.closesAt > opensAt ? d.closesAt : (kind === 'live' ? null : null);
  const timeLimitMin = Number(d.timeLimitMin) > 0 ? Math.min(600, Number(d.timeLimitMin)) : 0;
  const c = classDoc.data();
  const maxPoints = EDU.roundTo(tasks.reduce((s, t) => s + EDU.eduPoints(t), 0), 2);
  const doc = {
    classId: classDoc.id, className: c.name, subject: str(d.subject, 60) || c.subject || '', ownerId: uid, teacherIds: c.teacherIds || [uid],
    testId: str(d.testId, 80), title: str(d.title, 120) || 'Тест', description: str(d.description, 2000), kind, mode,
    tasks: pub, taskCount: pub.length, maxPoints, studentIds: c.studentIds || [], settings,
    opensAt: ts(opensAt), closesAt: ts(closesAt), timeLimitMin,
    status: kind === 'live' ? 'open' : (opensAt > now() + 1000 ? 'scheduled' : 'open'),
    live: kind === 'live' ? { state: 'lobby', startedAt: null, endsAt: null, pausedAt: null, current: -1, questionStartedAt: null, reveal: false, kicked: [], locked: [], extra: {}, leaderboard: [] } : null,
    released: { score: false, full: false }, scheduleId: str(extra.scheduleId, 80), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.set(ref, doc);
  batch.set(ref.collection('key').doc('answers'), { tasks: key, teacherIds: doc.teacherIds });
  for (const sid of doc.studentIds) batch.set(db.collection('users').doc(sid).collection('inbox').doc(ref.id), { type: 'assignment', assignmentId: ref.id, title: doc.title, kind, className: c.name, opensAt: doc.opensAt, closesAt: doc.closesAt, read: false, at: FieldValue.serverTimestamp() });
  await batch.commit();
  return ref.id;
}

exports.publishAssignment = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const classIds = (Array.isArray(d.classIds) ? d.classIds : [d.classId]).filter(Boolean).slice(0, 20);
  if (!classIds.length) fail('invalid-argument', 'Избери клас.');
  const ids = [];
  for (const cid of classIds) ids.push(await createAssignment(uid, await classFor(uid, cid), d));
  return { assignmentIds: ids };
});

exports.updateAssignment = onCall(async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const a = await assignmentFor(uid, d.assignmentId);
  const upd = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof d.title === 'string') upd.title = str(d.title, 120);
  if (typeof d.description === 'string') upd.description = str(d.description, 2000);
  if ('opensAt' in d && Number.isFinite(d.opensAt)) { upd.opensAt = ts(d.opensAt); if (a.data().status === 'scheduled' || a.data().status === 'open') upd.status = d.opensAt > now() + 1000 ? 'scheduled' : 'open'; }
  if ('closesAt' in d) upd.closesAt = Number.isFinite(d.closesAt) ? ts(d.closesAt) : null;
  if ('timeLimitMin' in d) upd.timeLimitMin = Number(d.timeLimitMin) > 0 ? Math.min(600, Number(d.timeLimitMin)) : 0;
  if (d.settings) upd.settings = cleanSettings({ ...a.data().settings, ...d.settings }, a.data().kind === 'live' && a.data().mode === 'quiz' ? 'live-quiz' : a.data().kind);
  if (d.reopen) { upd.status = 'open'; if (!('closesAt' in d)) upd.closesAt = null; }
  if (d.close) { upd.status = 'closed'; if (!ms(a.data().closesAt) || ms(a.data().closesAt) > now()) upd.closesAt = Timestamp.fromMillis(now()); }
  await a.ref.update(upd);
  if (d.close) await finalizeAssignment(a.ref);
  return { ok: true };
});

exports.deleteAssignment = onCall(async req => {
  const uid = requireTeacher(req);
  const a = await assignmentFor(uid, (req.data || {}).assignmentId);
  const atts = await db.collection('attempts').where('assignmentId', '==', a.id).get();
  const batch = db.batch();
  atts.docs.forEach(x => { batch.delete(x.ref); batch.delete(db.doc('results/' + x.id)); batch.delete(db.doc('reviews/' + x.id)); });
  for (const sid of a.data().studentIds || []) batch.delete(db.collection('users').doc(sid).collection('inbox').doc(a.id));
  await batch.commit();
  await db.recursiveDelete(a.ref);
  return { ok: true };
});

/* ---------- a student starts: the server fixes the order, the deadline and the start time ---------- */
function deadlineFor(a, startMs, extraSec) {
  const s = a.settings || {};
  const limits = [];
  if (a.timeLimitMin > 0) limits.push(startMs + a.timeLimitMin * 60000);
  const close = ms(a.closesAt); if (close && !s.lateAllowed) limits.push(close);
  if (a.kind === 'live' && a.live && ms(a.live.endsAt)) limits.push(ms(a.live.endsAt));
  const base = limits.length ? Math.min(...limits) : startMs + 365 * 24 * 3600 * 1000;
  return base + (extraSec || 0) * 1000;
}

/* the anti-cheat settings of an assignment (old assignments are cleaned the same way) */
const acOf = A => EDU.eduAcClean((A.settings || {}).antiCheat, A.kind, A.mode);

/* Play Integrity: the app asks for a one-time number first, then starts the test with a token made for it */
exports.proctorChallenge = onCall(async req => {
  const uid = uidOf(req);
  const aid = str((req.data || {}).assignmentId, 80);
  const nonce = PROCTOR.newNonce();
  await db.doc(`proctorNonces/${aid}_${uid}`).set({ nonce, uid, at: Timestamp.fromMillis(now()) });
  return { nonce, needed: PROCTOR.integrityConfigured() };
});

exports.startAttempt = onCall(async req => {
  const uid = uidOf(req);
  const aid = str((req.data || {}).assignmentId, 80);
  const a = await getDoc('assignments/' + aid, 'Тестът');
  const A = a.data();
  if (!(A.studentIds || []).includes(uid)) fail('permission-denied', 'Не си в този клас.');
  /* protection: the device must be allowed for this test (web vs. app, root, USB debugging, apps that read the screen, Play Integrity) */
  const ac = acOf(A);
  const dev = PROCTOR.cleanDevice((req.data || {}).device, req);
  const devId = str((req.data || {}).deviceId, 64);
  const problem = PROCTOR.deviceProblem(ac, dev);
  if (problem) fail('failed-precondition', problem);
  let integrity = { verdict: 'off' };
  if (ac.integrity && dev.platform === 'android') {
    const nd = await db.doc(`proctorNonces/${aid}_${uid}`).get();
    const fresh = nd.exists && now() - ms(nd.data().at) < 10 * 60000;
    integrity = await PROCTOR.checkIntegrity(str((req.data || {}).integrityToken, 4000), fresh ? nd.data().nonce : '\u0000');
    if (nd.exists) await nd.ref.delete();
    if (!['ok', 'skipped'].includes(integrity.verdict)) fail('failed-precondition', 'Google Play не потвърди, че това е истинското приложение BingO на истински телефон (' + integrity.verdict + '). Инсталирай BingO от Google Play.');
  }
  dev.integrity = integrity.verdict;
  const t = now();
  if (A.kind !== 'live' && ms(A.opensAt) > t + 5000) fail('failed-precondition', 'Тестът още не е отворен.');
  if (A.status === 'closed') fail('failed-precondition', 'Тестът е затворен.');
  if (A.kind !== 'live' && ms(A.closesAt) && t > ms(A.closesAt) && !(A.settings || {}).lateAllowed) fail('failed-precondition', 'Срокът е изтекъл.');
  if (A.kind === 'live' && A.live && (A.live.kicked || []).includes(uid)) fail('permission-denied', 'Учителят те е изключил от теста.');
  const ref = db.doc(`attempts/${aid}_${uid}`);
  const cur = await ref.get();
  if (cur.exists) {
    const C = cur.data();
    if (C.status === 'in_progress') {
      /* continuing on another phone or computer is a strike (someone else may be taking the test) */
      if (devId && C.deviceId && devId !== C.deviceId && !(C.devicesSeen || []).includes(devId)) {
        await proctorApply(ref, A, [{ type: 'device', info: dev.platform + ' ' + (dev.model || dev.browser || ''), t }], { devId, device: dev });
      }
      return { attemptId: ref.id, resumed: true };
    }
    const used = C.attemptNo || 1;
    if (used >= ((A.settings || {}).attempts || 1) || A.kind === 'live') return { attemptId: ref.id, finished: true };
    /* another try: the old result is kept in history */
    await ref.collection('history').doc(String(used)).set({ ...C, archivedAt: FieldValue.serverTimestamp() });
  }
  const user = await auth.getUser(uid);
  const me = await db.doc('users/' + uid).get();
  const ids = (A.tasks || []).map(x => x.id);
  const order = A.mode === 'quiz' || !(A.settings || {}).shuffleQ ? ids : EDU.shuffled(ids, ref.id + ':' + t);
  const extra = (A.live && A.live.extra && A.live.extra[uid]) || 0;
  const attempt = {
    assignmentId: aid, classId: A.classId, studentId: uid, studentName: (me.exists && me.data().name) || user.displayName || user.email || '', studentEmail: normEmail(user.email),
    teacherIds: A.teacherIds || [], kind: A.kind, mode: A.mode || 'normal', order, optSeed: ref.id + ':' + t, responses: {}, current: 0, answered: 0, timeOn: {}, events: [], flags: 0,
    quiz: {}, photos: {}, status: 'in_progress', locked: false, attemptNo: cur.exists ? (cur.data().attemptNo || 1) + 1 : 1,
    startedAt: Timestamp.fromMillis(t), deadline: Timestamp.fromMillis(deadlineFor(A, t, extra)), lastSeen: Timestamp.fromMillis(t),
    device: dev, deviceId: devId, devicesSeen: devId ? [devId] : [], lastBeat: Timestamp.fromMillis(t), strikes: 0, forgiven: 0,
    updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp()
  };
  await ref.set(attempt);
  return { attemptId: ref.id, started: true };
});

/* ---------- grading ---------- */
async function loadAiExamples(teacherIds, subject) {
  const out = [];
  for (const tid of (teacherIds || []).slice(0, 3)) {
    const q = await db.collection('aiExamples').doc(tid).collection('items').orderBy('at', 'desc').limit(30).get().catch(() => null);
    if (!q) continue;
    q.docs.forEach(d => { const x = d.data(); if (!subject || !x.subject || x.subject === subject) out.push(x); });
  }
  return out.slice(0, 8);
}

async function aiGradeTasks(A, keyTasks, attempt, per) {
  const s = A.settings || {};
  if (s.aiGrading === 'manual' || !AI.available()) return {};
  const pending = Object.entries(per).filter(([, r]) => r.status === 'pending');
  if (!pending.length) return {};
  const examples = await loadAiExamples(A.teacherIds, A.subject);
  const bucket = getStorage().bucket();
  const out = {};
  for (const [id] of pending.slice(0, 30)) {
    const k = keyTasks[id], resp = attempt.responses ? attempt.responses[id] : null;
    try {
      let image = null;
      if (k.type === 'photo' && resp && resp.path) {
        const [buf] = await bucket.file(resp.path).download();
        image = { data: buf.toString('base64'), mime: resp.mime || 'image/jpeg' };
      }
      const r = await AI.gradeAnswer({ task: k, response: resp, image, instructions: s.aiInstructions, examples, subject: A.subject });
      out[id] = { points: EDU.clamp(r.points, 0, EDU.eduPoints(k)), comment: r.comment, confidence: r.confidence, marks: r.marks || null, by: 'ai', approved: s.aiGrading === 'ai_auto', at: now() };
    } catch (e) { console.warn('AI grade failed', id, e.message); out[id] = { error: String(e.message || e).slice(0, 200), by: 'ai' }; }
  }
  return out;
}

/* points for the result: closed tasks checked, then the teacher's marks, then approved (or auto) AI marks */
function combine(keyTasks, attempt, ai, manual, aiMode) {
  const merged = {};
  for (const [id, m] of Object.entries(ai || {})) if (Number.isFinite(m.points) && (m.approved || aiMode === 'ai_auto')) merged[id] = { points: m.points, by: 'ai' };
  for (const [id, m] of Object.entries(manual || {})) if (Number.isFinite(m.points)) merged[id] = { points: m.points, by: 'teacher' };
  return EDU.eduScoreAll(keyTasks, attempt.order || Object.keys(keyTasks), attempt.responses || {}, 'bg', merged);
}

/* may the student see the score ('score') or the right answers ('full') now? Rechecked when the teacher
   releases results and when the assignment closes (finalizeAssignment), so the rules only read a boolean */
function isVisible(A, kind) {
  const fb = (A.settings || {}).feedback || {}, rel = A.released || {};
  if (rel.full || (kind === 'score' && rel.score)) return true;
  if (kind === 'full' && fb.show !== 'full') return false;
  if (fb.show === 'none') return false;
  if (fb.when === 'now') return true;
  if (fb.when === 'close') return A.status === 'closed' || (!!ms(A.closesAt) && ms(A.closesAt) <= now());
  return false;
}

async function writeResult(aRef, A, attemptRef, attempt, opts = {}) {
  const keyDoc = await aRef.collection('key').doc('answers').get();
  const key = keyDoc.exists ? keyDoc.data().tasks || {} : {};
  const resRef = db.doc('results/' + attemptRef.id);
  const prev = await resRef.get();
  const P = prev.exists ? prev.data() : {};
  let ai = P.ai || {};
  if (opts.runAI) {
    const first = EDU.eduScoreAll(key, attempt.order || Object.keys(key), attempt.responses || {}, 'bg');
    ai = { ...ai, ...(await aiGradeTasks(A, key, attempt, first.per)) };
  }
  const manual = P.manual || {};
  const aiMode = (A.settings || {}).aiGrading;
  const sc = combine(key, attempt, ai, manual, aiMode);
  /* homework that is a BingO practice session: the score is the share of right answers */
  if (A.kind === 'practice') { const pr = attempt.practice || {}; sc.points = Number(pr.right) || 0; sc.max = Number(pr.n) || 0; sc.pending = 0; }
  const needsReview = Object.entries(sc.per).some(([id, r]) => r.status === 'pending' && !(manual[id])) || (aiMode === 'ai_review' && Object.entries(ai).some(([id, m]) => Number.isFinite(m.points) && !m.approved && !manual[id]));
  const grade = P.gradeOverride || EDU.eduGrade(sc.points, sc.max, (A.settings || {}).grading);
  const per = {};
  for (const [id, r] of Object.entries(sc.per)) per[id] = { points: r.points, max: r.max, status: r.status, by: r.by || 'auto' };
  /* the projector quiz: speed points */
  let quizScore = null;
  if (A.mode === 'quiz') {
    quizScore = 0;
    for (const [qi, q] of Object.entries(attempt.quiz || {})) {
      const t = (A.tasks || [])[+qi]; if (!t || !key[t.id]) continue;
      const r = EDU.eduScore(key[t.id], q.resp, 'bg');
      quizScore += EDU.eduQuizPoints(r.status, quizMs(A, qi, q), ((A.settings || {}).quizSeconds || 20) * 1000);
    }
  }
  const result = {
    assignmentId: aRef.id, classId: A.classId, studentId: attempt.studentId, studentName: attempt.studentName || '', teacherIds: A.teacherIds || [],
    title: A.title, kind: A.kind, points: sc.points, max: sc.max, pct: sc.max ? EDU.roundTo(sc.points / sc.max, 4) : 0, grade, per, ai, manual,
    pending: sc.pending, needsReview, quizScore, flags: attempt.flags || 0, attemptNo: attempt.attemptNo || 1,
    startedAt: attempt.startedAt || null, submittedAt: attempt.submittedAt || FieldValue.serverTimestamp(), gradedAt: FieldValue.serverTimestamp(),
    visible: isVisible(A, 'score'), comment: P.comment || ''
  };
  await resRef.set(result);
  /* the review: the right answers and the solutions, for "show answers" */
  const review = { assignmentId: aRef.id, studentId: attempt.studentId, teacherIds: A.teacherIds || [], visible: isVisible(A, 'full'), tasks: {} };
  for (const id of attempt.order || []) {
    const k = key[id]; if (!k) continue;
    review.tasks[id] = { answer: k.answer ?? null, gaps: k.gaps ? k.gaps.map(g => ({ answer: g.answer })) : null, perm: k.perm || null, explain: k.explain || '', rubric: k.rubric || null, aiComment: ai[id] && ai[id].comment && (ai[id].approved || aiMode === 'ai_auto' || manual[id]) ? ai[id].comment : '', teacherComment: manual[id] && manual[id].comment ? manual[id].comment : '' };
  }
  await db.doc('reviews/' + attemptRef.id).set(review);
  return result;
}

async function finishAttempt(attemptRef, reason) {
  const snap = await attemptRef.get(); if (!snap.exists) return null;
  const at = snap.data();
  if (at.status === 'in_progress') await attemptRef.update({ status: 'submitted', submittedAt: FieldValue.serverTimestamp(), submitReason: reason || 'student', updatedAt: FieldValue.serverTimestamp() });
  const aRef = db.doc('assignments/' + at.assignmentId), a = await aRef.get(); if (!a.exists) return null;
  const fresh = (await attemptRef.get()).data();
  const res = await writeResult(aRef, a.data(), attemptRef, fresh, { runAI: true });
  await attemptRef.update({ status: 'graded' });
  return res;
}

exports.submitAttempt = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = uidOf(req);
  const aid = str((req.data || {}).assignmentId, 80);
  const ref = db.doc(`attempts/${aid}_${uid}`);
  const s = await ref.get();
  if (!s.exists) fail('not-found', 'Няма започнат опит.');
  if (s.data().studentId !== uid) fail('permission-denied', 'Това не е твой опит.');
  if (s.data().status !== 'in_progress') return { ok: true, already: true };
  const res = await finishAttempt(ref, 'student');
  return { ok: true, visible: !!(res && res.visible) };
});

/* ========================================================================
   Protection during a test. The student's device reports what happens (left the app, split screen,
   screenshot …) and sends a heartbeat every 10 s; only this function writes the events and the counts,
   so a student cannot hide or clear them. A gap in the heartbeat is itself an event: a phone that went
   offline or a page that was stopped cannot stay silent. After the teacher's number of warnings the
   test is locked (until the teacher unlocks it) or handed in.
   ======================================================================== */
const MAX_EVENTS = 400;
const GAP_FLAG_MS = 25000;

async function proctorApply(ref, A, incoming, opts = {}) {
  const ac = acOf(A);
  const t = now();
  const res = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: 'missing' };
    const at = snap.data();
    if (at.status !== 'in_progress') return { status: at.status };
    const seenIds = new Set((at.events || []).map(e => e.id).filter(Boolean));
    const evs = [];
    for (const raw of incoming) { const e = PROCTOR.cleanEvent(raw, t); if (e && !(e.id && seenIds.has(e.id))) { evs.push(e); if (e.id) seenIds.add(e.id); } }
    const upd = { lastSeen: Timestamp.fromMillis(t), updatedAt: FieldValue.serverTimestamp() };
    /* a second device sending heartbeats for the same test */
    if (opts.devId && at.deviceId && opts.devId !== at.deviceId && !(at.devicesSeen || []).includes(opts.devId) && !evs.some(e => e.type === 'device')) evs.push({ type: 'device', t, ts: t, info: opts.devInfo || '' });
    if (opts.devId && !(at.devicesSeen || []).includes(opts.devId)) upd.devicesSeen = [...(at.devicesSeen || []), opts.devId].slice(-8);
    if (opts.device) upd.device2 = opts.device;
    /* the heartbeat: nothing heard for too long while the test was running */
    const live = A.kind !== 'live' || (A.live && A.live.state === 'running');
    if (opts.beat && (!opts.devId || !at.deviceId || opts.devId === at.deviceId)) {
      const last = ms(at.lastBeat) || ms(at.startedAt) || t, gap = t - last;
      /* already counted: this absence was reported (left, back, the camera), or the last thing heard was "left" */
      const lastMove = (at.events || []).filter(e => ['left', 'back', 'photo'].includes(e.type)).pop();
      const explained = evs.some(e => e.type === 'back' || e.type === 'left' || e.type === 'photo') || (lastMove && lastMove.type === 'left');
      if (ac.detectLeave && live && !at.locked && gap > GAP_FLAG_MS && !explained) evs.push({ type: gap >= EDU.EDU_AC_GAP_STRIKE_S * 1000 ? 'gap' : 'offline', secs: Math.round(gap / 1000), t, ts: t });
      upd.lastBeat = Timestamp.fromMillis(t);
    }
    let strikes = at.strikes || 0, flags = at.flags || 0, newStrikes = 0;
    for (const e of evs) {
      if (EDU.eduAcFlagged(e) && !(e.type === 'blur' && !EDU.eduAcStrike(e) && (e.secs || 0) < 1)) flags++;
      if (ac.detectLeave && live && !at.locked && EDU.eduAcStrike(e)) { strikes++; newStrikes++; e.strike = true; }
    }
    let action = null;
    if (newStrikes) action = EDU.eduAcVerdict(ac, strikes, at.forgiven || 0);
    if (action === 'warn') evs.push({ type: 'warned', t, ts: t, info: String(ac.allowedLeaves - (strikes - (at.forgiven || 0)) + 1) });
    if (action === 'lock') { upd.locked = true; upd.lockReason = 'left'; upd.lockedAt = Timestamp.fromMillis(t); evs.push({ type: 'locked', t, ts: t, info: 'auto' }); }
    if (action === 'submit') evs.push({ type: 'submitted', t, ts: t, info: 'auto' });
    if (evs.length) upd.events = [...(at.events || []), ...evs].slice(-MAX_EVENTS);
    upd.strikes = strikes; upd.flags = flags;
    tx.update(ref, upd);
    return { status: 'in_progress', strikes, forgiven: at.forgiven || 0, allowed: ac.allowedLeaves, onLeave: ac.onLeave, action, locked: !!(upd.locked || at.locked), newStrikes };
  });
  if (res.action === 'submit') await finishAttempt(ref, 'left');
  if (res.action === 'lock' && A.kind === 'live') await db.doc('assignments/' + ref.id.split('_')[0]).update({ 'live.locked': FieldValue.arrayUnion(ref.id.slice(ref.id.indexOf('_') + 1)) }).catch(() => { });
  return res;
}

exports.proctorReport = onCall(async req => {
  const uid = uidOf(req);
  const d = req.data || {};
  const aid = str(d.assignmentId, 80);
  const ref = db.doc(`attempts/${aid}_${uid}`);
  const a = await db.doc('assignments/' + aid).get();
  if (!a.exists) fail('not-found', 'Тестът не съществува.');
  const events = Array.isArray(d.events) ? d.events.slice(0, 30) : [];
  const res = await proctorApply(ref, a.data(), events, { beat: !!d.beat, devId: str(d.deviceId, 64), devInfo: str(d.deviceInfo, 80) });
  return { ...res, serverTime: now() };
});

/* the teacher: lock, unlock (the warnings start again), or hand in now — for any test, not only live ones */
exports.proctorControl = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const a = await assignmentFor(uid, d.assignmentId);
  const target = str(d.uid, 128);
  if (!target) fail('invalid-argument', 'Кой ученик?');
  const ref = db.doc(`attempts/${a.id}_${target}`);
  const at = (await getDoc(ref.path, 'Опитът')).data();
  const t = now();
  const ev = info => FieldValue.arrayUnion({ type: info, t, ts: t, info: 'teacher' });
  switch (d.action) {
    case 'lock': await ref.update({ locked: true, lockReason: 'teacher', lockedAt: Timestamp.fromMillis(t), events: ev('locked') }); break;
    case 'unlock': await ref.update({ locked: false, lockReason: '', forgiven: at.strikes || 0, lastBeat: Timestamp.fromMillis(t), events: ev('unlocked') }); break;
    case 'forgive': await ref.update({ forgiven: at.strikes || 0, events: ev('unlocked') }); break;
    case 'submit': if (at.status === 'in_progress') await finishAttempt(ref, 'teacher'); break;
    default: fail('invalid-argument', 'Непознато действие.');
  }
  if (a.data().kind === 'live' && (d.action === 'lock' || d.action === 'unlock')) await a.ref.update({ 'live.locked': d.action === 'lock' ? FieldValue.arrayUnion(target) : FieldValue.arrayRemove(target) });
  return { ok: true };
});

async function finalizeAssignment(aRef, reason) {
  const q = await db.collection('attempts').where('assignmentId', '==', aRef.id).where('status', '==', 'in_progress').get();
  for (const d of q.docs) await finishAttempt(d.ref, reason || 'closed');
  /* "show after the deadline": the deadline is now, so the results that were handed in earlier become visible too */
  const A = (await aRef.get()).data();
  if (A && ((A.settings || {}).feedback || {}).when === 'close') {
    const rs = await db.collection('results').where('assignmentId', '==', aRef.id).get();
    for (const r of rs.docs) { await r.ref.update({ visible: isVisible(A, 'score') }); await db.doc('reviews/' + r.id).set({ visible: isVisible(A, 'full') }, { merge: true }); }
  }
  return q.size;
}

/* ---------- live test control ---------- */
exports.liveControl = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const a = await assignmentFor(uid, d.assignmentId);
  const A = a.data();
  if (A.kind !== 'live') fail('failed-precondition', 'Това не е тест на живо.');
  const L = { ...(A.live || {}) };
  const t = now();
  const target = str(d.uid, 128);
  const durMs = (A.timeLimitMin || 0) * 60000;
  const attemptsOf = async () => (await db.collection('attempts').where('assignmentId', '==', a.id).where('status', '==', 'in_progress').get()).docs;
  const shiftDeadlines = async deltaMs => { for (const x of await attemptsOf()) { const dl = ms(x.data().deadline); if (dl) await x.ref.update({ deadline: Timestamp.fromMillis(dl + deltaMs) }); } };
  switch (d.action) {
    case 'start':
      L.state = 'running'; L.startedAt = Timestamp.fromMillis(t); L.endsAt = durMs ? Timestamp.fromMillis(t + durMs) : null; L.pausedAt = null;
      if (A.mode === 'quiz') { L.current = 0; L.questionStartedAt = Timestamp.fromMillis(t); L.reveal = false; L.qStarts = { 0: t }; }
      for (const x of await attemptsOf()) await x.ref.update({ deadline: Timestamp.fromMillis(deadlineFor({ ...A, live: L }, t, (L.extra || {})[x.data().studentId] || 0)), startedAt: Timestamp.fromMillis(t), lastBeat: Timestamp.fromMillis(t) });
      break;
    case 'pause': if (L.state === 'running') { L.state = 'paused'; L.pausedAt = Timestamp.fromMillis(t); } break;
    case 'resume':
      if (L.state === 'paused') {
        const gap = t - (ms(L.pausedAt) || t);
        if (ms(L.endsAt)) L.endsAt = Timestamp.fromMillis(ms(L.endsAt) + gap);
        if (A.mode === 'quiz' && ms(L.questionStartedAt)) { L.questionStartedAt = Timestamp.fromMillis(ms(L.questionStartedAt) + gap); L.qStarts = { ...(L.qStarts || {}), [L.current]: ms(L.questionStartedAt) }; }
        L.state = 'running'; L.pausedAt = null; await shiftDeadlines(gap);
        for (const x of await attemptsOf()) await x.ref.update({ lastBeat: Timestamp.fromMillis(t) });
      }
      break;
    case 'addTime': {
      const sec = Math.max(-3600, Math.min(3600, Math.floor(Number(d.seconds) || 300)));
      if (target) {
        L.extra = { ...(L.extra || {}), [target]: ((L.extra || {})[target] || 0) + sec };
        const x = await db.doc(`attempts/${a.id}_${target}`).get();
        if (x.exists && ms(x.data().deadline)) await x.ref.update({ deadline: Timestamp.fromMillis(ms(x.data().deadline) + sec * 1000) });
      } else { if (ms(L.endsAt)) L.endsAt = Timestamp.fromMillis(ms(L.endsAt) + sec * 1000); await shiftDeadlines(sec * 1000); }
      break;
    }
    case 'kick': if (target) { L.kicked = [...new Set([...(L.kicked || []), target])]; const x = db.doc(`attempts/${a.id}_${target}`); if ((await x.get()).exists) await finishAttempt(x, 'kicked'); } break;
    case 'unkick': L.kicked = (L.kicked || []).filter(x => x !== target); break;
    case 'lock': if (target) { L.locked = [...new Set([...(L.locked || []), target])]; await db.doc(`attempts/${a.id}_${target}`).set({ locked: true }, { merge: true }); } break;
    case 'unlock': if (target) { L.locked = (L.locked || []).filter(x => x !== target); const x = await db.doc(`attempts/${a.id}_${target}`).get(); if (x.exists) await x.ref.update({ locked: false, lockReason: '', forgiven: x.data().strikes || 0, lastBeat: Timestamp.fromMillis(t) }); } break;
    case 'lockAll': for (const x of await attemptsOf()) await x.ref.update({ locked: true }); L.lockedAll = true; break;
    case 'unlockAll': for (const x of await attemptsOf()) await x.ref.update({ locked: false, lockReason: '', forgiven: x.data().strikes || 0, lastBeat: Timestamp.fromMillis(t) }); L.lockedAll = false; L.locked = []; break;
    /* the projector quiz */
    case 'reveal': if (A.mode === 'quiz') { L.reveal = true; L.leaderboard = await quizBoard(a.ref, { ...A, live: L }, L.current); L.stats = await quizStats(a.ref, A, L.current); } break;
    case 'next':
      if (A.mode === 'quiz') {
        if (L.current + 1 >= (A.tasks || []).length) { L.state = 'ended'; L.leaderboard = await quizBoard(a.ref, { ...A, live: L }, L.current); }
        else { L.current = (L.current || 0) + 1; L.questionStartedAt = Timestamp.fromMillis(t); L.reveal = false; L.stats = null; L.qStarts = { ...(L.qStarts || {}), [L.current]: t }; }
      }
      break;
    case 'end': L.state = 'ended'; break;
    case 'restart': L.state = 'lobby'; L.current = -1; L.reveal = false; L.startedAt = null; L.endsAt = null; L.leaderboard = []; L.qStarts = {}; break;
    default: fail('invalid-argument', 'Непознато действие.');
  }
  await a.ref.update({ live: L, status: L.state === 'ended' ? 'closed' : 'open', ...(L.state === 'ended' && !ms(A.closesAt) ? { closesAt: Timestamp.fromMillis(t) } : {}), updatedAt: FieldValue.serverTimestamp() });
  if (L.state === 'ended') await finalizeAssignment(a.ref, 'ended');
  return { ok: true, live: { ...L, startedAt: ms(L.startedAt), endsAt: ms(L.endsAt), questionStartedAt: ms(L.questionStartedAt), pausedAt: ms(L.pausedAt) } };
});

/* how long a student took on quiz question qi: the server time of the answer minus the server time the question appeared */
const quizMs = (A, qi, q) => { const st = ((A.live || {}).qStarts || {})[qi]; const at = ms(q.at); return st && at ? Math.max(0, at - st) : ((A.settings || {}).quizSeconds || 20) * 1000; };

async function quizRows(aRef, A) {
  const keyDoc = await aRef.collection('key').doc('answers').get();
  const key = keyDoc.exists ? keyDoc.data().tasks || {} : {};
  const atts = await db.collection('attempts').where('assignmentId', '==', aRef.id).get();
  return { key, atts: atts.docs.map(d => d.data()) };
}
async function quizBoard(aRef, A, upto) {
  const { key, atts } = await quizRows(aRef, A);
  const lim = ((A.settings || {}).quizSeconds || 20) * 1000;
  return atts.map(at => {
    let score = 0, right = 0;
    for (const [qi, q] of Object.entries(at.quiz || {})) {
      if (+qi > upto) continue;
      const t = (A.tasks || [])[+qi]; if (!t || !key[t.id]) continue;
      const r = EDU.eduScore(key[t.id], q.resp, 'bg');
      score += EDU.eduQuizPoints(r.status, quizMs(A, qi, q), lim); if (r.status === 'right') right++;
    }
    return { uid: at.studentId, name: at.studentName || '', score, right };
  }).sort((x, y) => y.score - x.score).slice(0, 50);
}
async function quizStats(aRef, A, qi) {
  const { key, atts } = await quizRows(aRef, A);
  const t = (A.tasks || [])[qi]; if (!t) return null;
  const k = key[t.id]; const counts = {}; let right = 0, n = 0;
  for (const at of atts) {
    const q = (at.quiz || {})[qi]; if (!q) continue; n++;
    const label = JSON.stringify(q.resp); counts[label] = (counts[label] || 0) + 1;
    if (EDU.eduScore(k, q.resp, 'bg').status === 'right') right++;
  }
  return { n, right, counts, answer: k ? (k.answer ?? null) : null, perm: k && k.perm ? k.perm : null };
}

/* ---------- the teacher grades ---------- */
exports.gradeTask = onCall({ timeoutSeconds: 120 }, async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const attemptId = str(d.attemptId, 200);
  const att = await getDoc('attempts/' + attemptId, 'Опитът');
  const A0 = att.data();
  const a = await assignmentFor(uid, A0.assignmentId);
  const resRef = db.doc('results/' + attemptId);
  const res = await resRef.get();
  const R = res.exists ? res.data() : { manual: {}, ai: {} };
  const manual = { ...(R.manual || {}) }, ai = { ...(R.ai || {}) };
  let gradeOverride = R.gradeOverride || null, comment = R.comment || '';
  const keyDoc = await a.ref.collection('key').doc('answers').get();
  const key = keyDoc.exists ? keyDoc.data().tasks || {} : {};
  if (d.taskId) {
    const id = str(d.taskId, 60), k = key[id];
    if (!k) fail('not-found', 'Няма такава задача.');
    if (d.clear) delete manual[id];
    else {
      const pts = Number(d.points); if (!Number.isFinite(pts)) fail('invalid-argument', 'Точките трябва да са число.');
      manual[id] = { points: EDU.clamp(pts, 0, EDU.eduPoints(k)), comment: str(d.comment, 1500), by: 'teacher', at: now() };
      /* the teacher corrected (or confirmed) AI: keep it as an example, so AI grades more like this teacher */
      const resp = (A0.responses || {})[id];
      if ((k.type === 'open' || k.type === 'photo') && ai[id] && Number.isFinite(ai[id].points)) {
        await db.collection('aiExamples').doc(uid).collection('items').add({
          subject: a.data().subject || '', prompt: String(k.prompt || '').slice(0, 1500), rubric: k.rubric || null, aiCriteria: k.aiCriteria || '',
          answer: k.type === 'open' ? String((resp && resp.text) || resp || '').slice(0, 1500) : '[снимка]', aiPoints: ai[id].points, teacherPoints: manual[id].points, max: EDU.eduPoints(k), comment: manual[id].comment, at: now()
        });
      }
    }
  }
  if (d.approveAI) for (const [id, m] of Object.entries(ai)) if (Number.isFinite(m.points)) ai[id] = { ...m, approved: true };
  if ('grade' in d) gradeOverride = d.grade && typeof d.grade === 'object' ? { value: Number(d.grade.value) || 0, text: str(d.grade.text, 40), scale: 'manual', pct: null } : null;
  if (typeof d.comment === 'string' && !d.taskId) comment = str(d.comment, 2000);
  await resRef.set({ manual, ai, gradeOverride, comment }, { merge: true });
  const result = await writeResult(a.ref, a.data(), att.ref, A0, { runAI: false });
  return { ok: true, points: result.points, max: result.max, grade: result.grade, needsReview: result.needsReview };
});

exports.regradeAI = onCall({ timeoutSeconds: 540 }, async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const a = await assignmentFor(uid, d.assignmentId);
  const q = d.attemptId ? [await getDoc('attempts/' + str(d.attemptId, 200))] : (await db.collection('attempts').where('assignmentId', '==', a.id).where('status', 'in', ['submitted', 'graded']).get()).docs;
  let n = 0;
  for (const att of q) {
    const resRef = db.doc('results/' + att.id);
    await resRef.set({ ai: {} }, { merge: true });
    await writeResult(a.ref, a.data(), att.ref, att.data(), { runAI: true }); n++;
  }
  return { ok: true, regraded: n };
});

exports.approveAll = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = requireTeacher(req);
  const a = await assignmentFor(uid, (req.data || {}).assignmentId);
  const q = await db.collection('results').where('assignmentId', '==', a.id).get();
  for (const r of q.docs) {
    const ai = { ...(r.data().ai || {}) };
    for (const [id, m] of Object.entries(ai)) if (Number.isFinite(m.points)) ai[id] = { ...m, approved: true };
    await r.ref.update({ ai });
    const att = await db.doc('attempts/' + r.id).get();
    if (att.exists) await writeResult(a.ref, a.data(), att.ref, att.data(), { runAI: false });
  }
  return { ok: true, n: q.size };
});

exports.releaseResults = onCall({ timeoutSeconds: 300 }, async req => {
  const uid = requireTeacher(req);
  const d = req.data || {};
  const a = await assignmentFor(uid, d.assignmentId);
  const released = { score: !!d.score || !!d.full, full: !!d.full };
  await a.ref.update({ released });
  const A = { ...a.data(), released };
  const q = await db.collection('results').where('assignmentId', '==', a.id).get();
  for (const r of q.docs) {
    await r.ref.update({ visible: isVisible(A, 'score') });
    await db.doc('reviews/' + r.id).set({ visible: isVisible(A, 'full') }, { merge: true });
  }
  return { ok: true };
});

/* ========================================================================
   Gemini for teachers: make a test, a test from a document, chat, and class insights
   ======================================================================== */
exports.teacherAI = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async req => {
  const uid = requireTeacher(req);
  if (!AI.available()) fail('failed-precondition', 'Gemini не е настроен на сървъра.');
  const d = req.data || {};
  /* a small daily limit per teacher */
  const day = new Date().toISOString().slice(0, 10), lim = db.doc(`aiUsage/${uid}_${day}`);
  const used = (await lim.get()).data();
  if (used && used.n >= 300) fail('resource-exhausted', 'Днешният лимит за Gemini е изчерпан.');
  await lim.set({ n: FieldValue.increment(1), uid, day }, { merge: true });
  switch (d.action) {
    case 'generate': return { tasks: await AI.makeTest({ topic: str(d.topic, 500), subject: str(d.subject, 60), grade: str(d.grade, 20), n: Math.min(40, Math.max(1, Number(d.n) || 10)), types: Array.isArray(d.types) ? d.types.slice(0, 9) : null, level: str(d.level, 20), lang: d.lang === 'en' ? 'en' : 'bg', notes: str(d.notes, 1500) }) };
    case 'fromText': return { tasks: await AI.makeTest({ source: str(d.text, 60000), subject: str(d.subject, 60), grade: str(d.grade, 20), n: Math.min(40, Math.max(1, Number(d.n) || 10)), types: Array.isArray(d.types) ? d.types.slice(0, 9) : null, level: str(d.level, 20), lang: d.lang === 'en' ? 'en' : 'bg', notes: str(d.notes, 1500) }) };
    case 'fromFile': {
      const data = typeof d.data === 'string' ? d.data : '';
      if (!data || data.length > 14 * 1024 * 1024) fail('invalid-argument', 'Файлът липсва или е по-голям от 10 MB.');
      if (!/^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/.test(d.mime || '')) fail('invalid-argument', 'Поддържам PDF, снимка или текст.');
      return { tasks: await AI.makeTest({ file: { data, mime: d.mime }, subject: str(d.subject, 60), grade: str(d.grade, 20), n: Math.min(40, Math.max(1, Number(d.n) || 10)), types: Array.isArray(d.types) ? d.types.slice(0, 9) : null, level: str(d.level, 20), lang: d.lang === 'en' ? 'en' : 'bg', notes: str(d.notes, 1500) }) };
    }
    case 'chat': return await AI.chat({ messages: Array.isArray(d.messages) ? d.messages.slice(-20) : [], context: str(d.context, 20000), lang: d.lang === 'en' ? 'en' : 'bg' });
    case 'insights': return { text: await AI.insights({ data: str(d.data, 30000), lang: d.lang === 'en' ? 'en' : 'bg' }) };
    case 'improveTask': return { task: await AI.improveTask({ task: d.task, how: str(d.how, 500), lang: d.lang === 'en' ? 'en' : 'bg' }) };
    default: fail('invalid-argument', 'Непознато действие.');
  }
});

/* ========================================================================
   The clock: every 5 minutes
   - scheduled tests open, closed ones are graded
   - attempts past their deadline are handed in
   - recurring homework (schedules/{id}) creates this week's assignment
   ======================================================================== */
const DAY = 24 * 3600 * 1000;
function zonedParts(t, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { wd, hm: (+p.hour % 24) * 60 + +p.minute, day: `${p.year}-${p.month}-${p.day}` };
}

async function runSchedules(t, only) {
  const q = only ? { docs: [only] } : await db.collection('schedules').where('active', '==', true).get();
  let made = 0;
  for (const s of q.docs) {
    const S = s.data();
    const z = zonedParts(t, S.tz);
    const [hh, mm] = String(S.time || '08:00').split(':').map(Number);
    if (!only) {
      if (!(S.days || []).includes(z.wd)) continue;
      if (z.hm < hh * 60 + mm) continue;
      if (S.lastRun === z.day) continue;
    }
    if (Number.isFinite(S.until) && t > S.until) { await s.ref.update({ active: false }); continue; }
    try {
      const cls = await db.doc('classes/' + S.classId).get(); if (!cls.exists) { await s.ref.update({ active: false }); continue; }
      let tasks = [], title = S.title || 'Домашно';
      if (S.kind !== 'practice' && S.testId) {
        const test = await db.doc('tests/' + S.testId).get();
        if (!test.exists) continue;
        tasks = test.data().tasks || []; title = S.title || test.data().title;
        if (S.pick > 0 && tasks.length > S.pick) tasks = EDU.shuffled(tasks, s.id + z.day).slice(0, S.pick);
      }
      await createAssignment(S.ownerId, cls, { kind: S.kind === 'practice' ? 'practice' : (S.kind || 'homework'), title: `${title} · ${z.day.split('-').reverse().slice(0, 2).join('.')}`, tasks, testId: S.testId || '', subject: S.subject || '', opensAt: t, closesAt: t + (Number(S.durationHours) || 72) * 3600000, timeLimitMin: S.timeLimitMin || 0, settings: S.settings || {} }, { scheduleId: s.id });
      await s.ref.update({ lastRun: z.day, runs: FieldValue.increment(1) }); made++;
    } catch (e) { console.error('schedule', s.id, e); }
  }
  return made;
}

exports.tick = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Europe/Sofia', timeoutSeconds: 540 }, async () => {
  const t = now();
  /* open */
  const due = await db.collection('assignments').where('status', '==', 'scheduled').where('opensAt', '<=', Timestamp.fromMillis(t)).get();
  for (const a of due.docs) await a.ref.update({ status: 'open' });
  /* close (late work allowed: wait a week past the deadline) */
  const open = await db.collection('assignments').where('status', '==', 'open').where('closesAt', '<=', Timestamp.fromMillis(t)).get();
  for (const a of open.docs) {
    if (a.data().kind === 'live') continue;
    if ((a.data().settings || {}).lateAllowed && ms(a.data().closesAt) + 7 * DAY > t) continue;
    await a.ref.update({ status: 'closed' }); await finalizeAssignment(a.ref, 'deadline');
  }
  /* attempts past their own deadline */
  const late = await db.collection('attempts').where('status', '==', 'in_progress').where('deadline', '<=', Timestamp.fromMillis(t - GRACE_MS)).limit(300).get();
  for (const x of late.docs) await finishAttempt(x.ref, 'time');
  await runSchedules(t);
});

/* run the clock now (for a teacher who just made a schedule, and for tests) */
exports.runScheduleNow = onCall(async req => {
  const uid = requireTeacher(req);
  const sid = str((req.data || {}).scheduleId, 80);
  const s = await getDoc('schedules/' + sid, 'Графикът');
  if (s.data().ownerId !== uid) fail('permission-denied', 'Не е твой график.');
  const made = await runSchedules(now(), s);
  return { made };
});

/* ---------- a student's results next to the class, as in Shkolo's statistics (0.9.0) ----------
   Only averages and the student's own place: never another student's name or score. A test with fewer than
   3 results gives nothing, so one classmate's score can't be worked out. */
exports.classStats = onCall({ timeoutSeconds: 120 }, async req => {
  const uid = req.auth && req.auth.uid; if (!uid) fail('unauthenticated', 'Влезте в профила си.');
  const mine = await db.collection('results').where('studentId', '==', uid).where('visible', '==', true).limit(200).get();
  const stats = {};
  const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  for (const d of mine.docs) {
    const r = d.data(); if (!r.assignmentId || stats[r.assignmentId] || !Number.isFinite(r.pct)) continue;
    const all = (await db.collection('results').where('assignmentId', '==', r.assignmentId).get()).docs.map(x => x.data()).filter(x => Number.isFinite(x.pct));
    if (all.length < 3) continue;
    const pcts = all.map(x => x.pct);
    const grades = all.map(x => x.grade || {}).filter(g => ['bg6', 'bg6exact', 'matura'].includes(g.scale) && Number.isFinite(g.value)).map(g => g.value);
    const below = pcts.filter(p => p < r.pct).length, same = pcts.filter(p => p === r.pct).length;
    stats[r.assignmentId] = { n: all.length, avgPct: mean(pcts), avgGrade: grades.length >= 3 ? mean(grades) : null, rank: (below + (same - 1) / 2) / Math.max(1, all.length - 1), classId: r.classId || '' };
  }
  return { stats };
});

exports._test = { deadlineFor, isVisible, zonedParts, cleanSettings };
