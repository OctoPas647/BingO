'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  return request.auth.uid;
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Creates or updates the signed-in user's own Firestore profile.
 * New users are always students; role changes require an admin.
 */
exports.registerProfile = onCall(async (request) => {
  const uid = requireAuth(request);

  const displayName = typeof request.data.displayName === 'string'
    ? request.data.displayName.trim().slice(0, 80)
    : '';

  const ref = db.collection('users').doc(uid);
  const existing = await ref.get();

  if (existing.exists) {
    await ref.update({
      displayName: displayName || existing.data().displayName || '',
      updatedAt: FieldValue.serverTimestamp()
    });
    return { uid, role: existing.data().role || 'student' };
  }

  const role = request.auth.token.role || 'student';
  const profile = {
    uid,
    displayName,
    role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await ref.set(profile);
  return { uid, role };
});

/**
 * Admin-only: assigns a Firebase custom claim and mirrors it in Firestore.
 * Valid roles: student, teacher, admin.
 */
exports.setUserRole = onCall(async (request) => {
  const uid = requireAuth(request);

  if (request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admins only.');
  }

  const targetUid = request.data.uid;
  const role = request.data.role;

  if (typeof targetUid !== 'string' || !targetUid) {
    throw new HttpsError('invalid-argument', 'uid is required.');
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role.');
  }

  await auth.setCustomUserClaims(targetUid, { role });
  await db.collection('users').doc(targetUid).set({
    role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { uid: targetUid, role };
});

/**
 * Starts a timed attempt for a signed-in student.
 * Expected test document:
 * tests/{testId} = { title, classId?, durationMinutes, questionIds: [] }
 */
exports.startAttempt = onCall(async (request) => {
  const uid = requireAuth(request);
  const testId = request.data.testId;

  if (typeof testId !== 'string' || !testId) {
    throw new HttpsError('invalid-argument', 'testId is required.');
  }

  const testRef = db.collection('tests').doc(testId);
  const test = await testRef.get();

  if (!test.exists) {
    throw new HttpsError('not-found', 'Test not found.');
  }

  const testData = test.data();
  const questionIds = Array.isArray(testData.questionIds) ? testData.questionIds : [];
  const durationMinutes = Number(testData.durationMinutes);

  if (!questionIds.length) {
    throw new HttpsError('failed-precondition', 'Test has no questions.');
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 300) {
    throw new HttpsError('failed-precondition', 'Invalid test duration.');
  }

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + durationMinutes * 60 * 1000);

  const attemptRef = await db.collection('attempts').add({
    studentId: uid,
    testId,
    classId: testData.classId || null,
    questionIds,
    totalQuestions: questionIds.length,
    status: 'in_progress',
    score: null,
    startedAt: FieldValue.serverTimestamp(),
    expiresAt,
    finishedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    attemptId: attemptRef.id,
    expiresAt: expiresAt.toMillis(),
    totalQuestions: questionIds.length
  };
});

/**
 * Records and grades one answer. The correct answer never leaves the server.
 * Expected question document:
 * questions/{questionId} = { correctAnswer, ... }
 */
exports.submitAnswer = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId, questionId, answer } = request.data;
  const timeMs = Number(request.data.timeMs);

  if (typeof attemptId !== 'string' || !attemptId
    || typeof questionId !== 'string' || !questionId) {
    throw new HttpsError('invalid-argument', 'attemptId and questionId are required.');
  }

  const attemptRef = db.collection('attempts').doc(attemptId);
  const attempt = await attemptRef.get();

  if (!attempt.exists) {
    throw new HttpsError('not-found', 'Attempt not found.');
  }

  const attemptData = attempt.data();
  if (attemptData.studentId !== uid) {
    throw new HttpsError('permission-denied', 'This is not your attempt.');
  }
  if (attemptData.status !== 'in_progress') {
    throw new HttpsError('failed-precondition', 'Attempt is not active.');
  }

  const expiresAt = attemptData.expiresAt;
  if (expiresAt && Date.now() > expiresAt.toMillis()) {
    throw new HttpsError('deadline-exceeded', 'Time is up.');
  }

  if (!Array.isArray(attemptData.questionIds)
    || !attemptData.questionIds.includes(questionId)) {
    throw new HttpsError('invalid-argument', 'Question is not part of this attempt.');
  }

  const answerRef = attemptRef.collection('answers').doc(questionId);
  const existingAnswer = await answerRef.get();

  if (existingAnswer.exists) {
    throw new HttpsError('already-exists', 'Question already answered.');
  }

  const questionRef = db.collection('questions').doc(questionId);
  const question = await questionRef.get();

  if (!question.exists) {
    throw new HttpsError('not-found', 'Question not found.');
  }

  const correctAnswer = question.data().correctAnswer;
  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(correctAnswer);

  await answerRef.set({
    questionId,
    answer: answer ?? null,
    isCorrect,
    timeMs: Number.isFinite(timeMs) && timeMs >= 0
      ? Math.min(Math.round(timeMs), 30 * 60 * 1000)
      : null,
    answeredAt: FieldValue.serverTimestamp()
  });

  await attemptRef.update({ updatedAt: FieldValue.serverTimestamp() });

  return { questionId, isCorrect };
});

/**
 * Finishes an attempt, calculates its score and creates a result document.
 * Can be called early; expired attempts are finalized automatically.
 */
exports.finishAttempt = onCall(async (request) => {
  const uid = requireAuth(request);
  const attemptId = request.data.attemptId;

  if (typeof attemptId !== 'string' || !attemptId) {
    throw new HttpsError('invalid-argument', 'attemptId is required.');
  }

  const attemptRef = db.collection('attempts').doc(attemptId);
  const attempt = await attemptRef.get();

  if (!attempt.exists) {
    throw new HttpsError('not-found', 'Attempt not found.');
  }

  const attemptData = attempt.data();
  if (attemptData.studentId !== uid) {
    throw new HttpsError('permission-denied', 'This is not your attempt.');
  }
  if (attemptData.status !== 'in_progress') {
    throw new HttpsError('failed-precondition', 'Attempt is already finished.');
  }

  const answers = await attemptRef.collection('answers').get();
  const score = answers.docs.filter(doc => doc.data().isCorrect === true).length;
  const totalQuestions = Number(attemptData.totalQuestions) || answers.size;

  await attemptRef.update({
    status: 'completed',
    score,
    finishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await db.collection('results').doc(attemptId).set({
    attemptId,
    studentId: uid,
    testId: attemptData.testId,
    classId: attemptData.classId || null,
    score,
    totalQuestions,
    percentage: totalQuestions ? Math.round((score / totalQuestions) * 100) : 0,
    createdAt: FieldValue.serverTimestamp()
  });

  return { attemptId, score, totalQuestions };
});
