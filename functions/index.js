'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const db = admin.firestore();
const auth = admin.auth();

/**
 * Creates or updates the signed-in user's own Firestore profile.
 * New users are always students; role changes require an admin.
 */
exports.registerProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }

  const uid = request.auth.uid;
  const displayName = typeof request.data.displayName === 'string'
    ? request.data.displayName.trim().slice(0, 80)
    : '';

  const ref = db.collection('users').doc(uid);
  const existing = await ref.get();

  if (existing.exists) {
    await ref.update({
      displayName: displayName || existing.data().displayName || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { uid, role: existing.data().role || 'student' };
  }

  const role = request.auth.token.role || 'student';
  const profile = {
    uid,
    displayName,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await ref.set(profile);
  return { uid, role };
});

/**
 * Admin-only: assigns a Firebase custom claim and mirrors it in Firestore.
 * Valid roles: student, teacher, admin.
 */
exports.setUserRole = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
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
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { uid: targetUid, role };
});
