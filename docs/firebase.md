# Firebase setup

BingO uses Firebase for authentication, roles and Firestore data. The existing `server/` Cloud Run service remains responsible for Gemini/Vertex AI calls.

## 1. Create the project

1. Create a Firebase project in the EU region if possible.
2. Enable **Authentication > Email/Password**.
3. Create a Firestore database.
4. Add a Web app and copy its Firebase config into environment variables; do not commit keys.

## 2. Deploy rules and functions

```bash
npm --prefix functions install
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## 3. Make the first admin

After registering the first account, run this once from a machine with the Firebase Admin SDK/service account:

```js
const admin = require('firebase-admin');
admin.initializeApp();

admin.auth().setCustomUserClaims('<UID>', { role: 'admin' });
```

Then have that user call `setUserRole` to promote teachers.

## 4. Data model

- `users/{uid}` — display name and role; role is mirrored from custom claims.
- `classes/{classId}` — teacher-owned classes.
- `questions/{questionId}` — question bank.
- `attempts/{attemptId}` — one test attempt; score/status are server-managed.
- `attempts/{attemptId}/answers/{answerId}` — server-written answers and grading data.
- `results/{resultId}` — final results, server-written.

## 5. Security model

- Students can read and update only their own profile and attempts.
- Students cannot read other students' answers or write final results.
- Teachers can read class results but cannot directly write answers or results.
- Only admins can change roles.
- Firestore rules deny everything not explicitly allowed.

## 6. Local testing

```bash
npm --prefix functions install
npm --prefix functions run serve
```

Use the Firebase Emulator Suite for Auth, Firestore and Functions before deploying.
