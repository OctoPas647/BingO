# BingO for classes — Firebase setup

BingO 0.7.0 has a teacher's part (classes, tests, live tests, grading, schedules) and a "Клас" tab for students.
It runs on Firebase: **Google sign-in**, **Firestore** (live updates), **Cloud Functions** (roles, the answer key,
grading, live control, Gemini) and **Storage** (photos of handwritten solutions). The existing `server/` on Cloud Run
still does the students' everyday AI. Until the steps below are done, the app works as before and the class screens say
"Класната стая още не е свързана".

Time: about 30–40 minutes, once.

## 1. The project

1. Open <https://console.firebase.google.com> → **Add project**. You can pick the same Google Cloud project as the
   `bingo-ai` Cloud Run server (recommended: one bill, Vertex AI already there).
2. Switch the project to the **Blaze** plan (Cloud Functions and Storage need it). A class-sized school stays inside the
   free allowance; set a budget alert in Google Cloud → Billing → Budgets (e.g. 5 €).
3. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
   Under **Settings → Authorized domains** add `preotkrivanegk.com` (where the web version lives).
4. **Build → Firestore Database → Create database**, location `eur3` or `europe-west1`, production mode.
5. **Build → Storage → Get started**, same region.

## 2. The app's config (GitHub variable)

1. Firebase console → ⚙ **Project settings → Your apps → Web (</>)** → register "BingO web". Copy the `firebaseConfig`.
2. Google Cloud console → **APIs & Services → Credentials** → the OAuth client called
   **"Web client (auto created by Google Service)"** → copy its **Client ID** (`…apps.googleusercontent.com`).
3. GitHub → the BingO repo → **Settings → Secrets and variables → Actions → Variables → New variable**
   `BINGO_FIREBASE` with one line of JSON (none of this is secret; the security rules protect the data):

```json
{"apiKey":"AIza…","authDomain":"your-project.firebaseapp.com","projectId":"your-project","storageBucket":"your-project.firebasestorage.app","messagingSenderId":"123…","appId":"1:123…:web:…","webClientId":"123…-abc.apps.googleusercontent.com"}
```

The next push to `main` builds the APK and the web page with it. (Locally: put the same object under `"firebase"` in
`tools/config.json`, or `BINGO_FIREBASE='{…}' python tools/build.py web`.)

## 3. Sign-in on Android

Google does not allow its sign-in page inside an app, so the APK uses the phone's own account picker. Google must know
the app's signing key:

1. Get the SHA-1 of BingO's release key (the one in the `BINGO_SIGNING` secret):
   `keytool -list -v -keystore platforms/android/signing/bingo.keystore -alias bingo` → copy `SHA1`.
2. Firebase console → Project settings → **Add app → Android**, package `app.bingo`, paste the SHA-1. (This creates the
   Android OAuth client. You don't need the `google-services.json` file.)

## 4. Deploy the backend

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick the project
npm --prefix functions install
firebase deploy --only firestore,storage,functions
```

`firebase.json` runs `node tools/sync-functions.js` first, so the functions grade with exactly the app's checking code.

**Gemini for teachers** (AI grading, tests from a topic/PDF/Google Doc, the assistant, class analysis) — pick one:
- *Vertex AI (no key)*: Google Cloud → enable **Vertex AI API**. The functions use the project's service account.
- *API key*: create `functions/.env` with `GEMINI_API_KEY=…` (never commit it) and deploy again.
Optional: `GEMINI_MODEL=…` in the same file.

## 5. Google Classroom, Forms, Drive and Calendar (optional)

The teacher's own Google account talks to these APIs straight from the app.

1. Google Cloud → **APIs & Services → Library** → enable **Google Classroom API**, **Google Forms API**,
   **Google Drive API**, **Google Calendar API**.
2. **OAuth consent screen** → add the scopes `classroom.courses.readonly`, `classroom.rosters.readonly`,
   `classroom.profile.emails`, `classroom.coursework.students`, `forms.body.readonly`, `drive.readonly`, `drive.file`,
   `calendar.events`.
3. While the app is in **Testing**, add each teacher's email under **Test users** (up to 100). For a whole school, submit
   the app for Google's verification (Classroom and Drive scopes need it).

## 6. Who can be a teacher

By default anyone picks "Учител" at sign-up (policy `open`). To lock it down, make yourself admin first:
Firestore console → **Start collection** `config` → document `roles` → field `admins` (array) with your email, field
`policy` (string) `open`. Sign out and in again in BingO: **Още → Администрация** appears, where you can switch to
- `whitelist` — only listed emails or domains (`@school.bg`),
- `code` — a school code you generate and hand out,
- `approval` — requests wait until you approve them,
and set roles by email.

## 7. Data model (short)

| Collection | What | Who reads |
|---|---|---|
| `users/{uid}` | name, role, school, classes; `inbox/` with new assignments | the user |
| `classes/{id}` + `members/` | name, code, teachers, students, invited emails | its teachers and students |
| `codes/{CODE}` | code → class | functions only |
| `tests/{id}` | a teacher's test **with answers** | its owner (and `sharedWith`) |
| `assignments/{id}` | a test given to a class, **without answers**; live state | its teachers and students |
| `assignments/{id}/key/answers` | the answer key | its teachers |
| `attempts/{aid}_{uid}` | one student's work: answers, current question, events (left the app, paste…) | the student and the teachers |
| `results/{aid}_{uid}` | points, grade, AI suggestions, teacher's marks | teachers; the student when `visible` |
| `reviews/{aid}_{uid}` | right answers and comments | teachers; the student when `visible` |
| `progress/{uid}` | the skill map from everyday BingO practice | the student and their teachers |
| `schedules/{id}` | recurring homework | its teacher |
| `aiExamples/{uid}/items` | the teacher's corrections of Gemini (AI grades like them) | the teacher |

## 8. Testing locally

```bash
cd tests/emulator && npm install && cd ../..
npm --prefix functions install
BINGO_FAKE_AI=1 npx --prefix tests/emulator firebase emulators:start --project demo-bingo --only auth,firestore,functions,storage
# in another terminal
node tests/emulator/backend.test.mjs          # 50 checks: roles, classes, the key stays secret, grading, live test, quiz, schedules
python3 tools/build.py web && python3 tests/emulator/ui_classes.py   # a teacher and a student in two browsers, screenshots in build/shots/classes/
```
