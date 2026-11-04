# Progress

## Done
- **0.8.0** Test security (ai/test-security). Files: `src/js/70-edu-core.js` (shared rules: what counts as leaving, warn/lock/submit; also in `functions/shared/edu.js`), `src/js/72b-proctor.js` (student side: heartbeat, event queue, warnings, cover screens, watermark, browser detections, preflight device checks), `functions/proctor.js` + `proctorChallenge`/`proctorReport`/`proctorControl` in `functions/index.js`, `firestore.rules` (events/flags/device/heartbeat server-only; answers need a live heartbeat), `platforms/android/java/app/shelly/SecureBridge.java` (FLAG_SECURE, hidden overlays, a11y-sensitive, screen capture/recording callbacks, displays, pinning watch, root/emulator/ADB/a11y checks, Play Integrity), teacher settings (75), monitor for tests (76/77). Checks: tools/check.js 0 problems; tests/proctor_rules.test.js 29/29; backend.test.mjs 81/81; ui_classes.py clean; fixes.py 71/71, play.py, ai_mock.py clean; Gradle APK builds.
- **0.7.0** BingO for classes (teacher's part, "Клас" tab, Firebase backend). Files: `src/js/70-edu-core.js` (shared grading rules, also in `functions/shared/edu.js`), `71-cloud.js` (Firebase, Google sign-in, Google API tokens), `72-class.js` (setup role step, joining), `73-class-student.js`, `74-teacher.js` … `79-teacher-more.js`, `src/css/zzz-class.css`, `functions/index.js` + `functions/ai.js`, `firestore.rules`, `storage.rules`, `platforms/android/java/app/shelly/GoogleAuthBridge.java`. Checks: tools/check.js 0 problems; tests/emulator/backend.test.mjs 50/50; tests/emulator/ui_classes.py clean (teacher + student, live test, quiz); fixes.py 71/71, play.py, ai_mock.py clean; Gradle APK builds.
- **0.6.0** (claude/ios-redesign-ai-matura): iOS redesign with Liquid glass as the navigation layer and spring motion (zz-ios.css, 68-motion.js); no typed API key anywhere — Gemini through BingO's server, key only on the server; Gemini Nano on the device (54c-nano.js, NanoBridge.java, Gradle build with ML Kit GenAI); every matura from МОН's PDFs (tools/import_dzi.py, content/subjects.json) and an English bank from BrainBurst/BandUP; every past-exam question in training (66b-past-bank.js); four options on every closed question; math topics Функции/Тригонометрия/Планиметрия/Статистика with MON-style generators; second try, "Не знам", mistake review and "Тренирай подобни" (61-session.js, 61b-review.js). Checks: tools/check.js 0 problems; tests fixes.py 71/71, play.py and ai_mock.py clean; Gradle APK builds.
- Past exams: English UI metadata fix (feature/feedback-20261029-1247-s46).
  - Diagnosis: in English mode, `pastView()` in `src/js/66-past.js` selects the matching English module from `content/past-exams-en/`, so its exam title, part titles and instructions supply the UI chrome. Task content remains Bulgarian by design.
  - Scope: UI only. Questions, answer options, solutions, explanations and rubrics stay in their original language.
  - Files: verified `lang: "en"` in all `content/past-exams-en/*.json`; documented the English metadata selection in `src/js/66-past.js`; checked that every `L()` key in `src/js/66-past.js` already has an English entry in `src/js/49-lang.js`.
  - Manual test: switch Settings → Language to English, open Home → „Изпити от минали години“, open an exam with an English variant, and check that the exam header, part headers and instructions are English while questions, options and solutions remain Bulgarian. Repeat for an exam without an English variant; it should remain Bulgarian and keep the `BG` marker.
- **0.5.0**: all 64 open branches merged into one version (see CHANGELOG.md). Many branches fixed the same problem several times; each fix is in once, reviewed, without the unrelated edits the bot made on the way. Every merge commit message says what was taken from each branch and what was not, and why.
- Earlier work (0.4.x): ДЗИ Математика 02.06.2020 вариант 2, НВО 4 Математика 2007–2016, Duolingo-style progress bar, browser-history fixes (67-history-sync.js and the tab-bar wrapper in 64-nav.js), confetti cleanup, no repeated question in a session, Android fullscreen-video code removed, no duplicate option values in generated tasks (`normalize()` in 52-math.js).
- **Оценката на усвояването се мени прекалено рязко**: `bktUpdate` in 51-skills.js no longer adds learning after a wrong answer, `guessOf` uses a 0.2 default for non-choice tasks, and `bktStep` keeps a conservative maximum jump (0.05 below two answers, 0.10 below four) and a 0.25 learning multiplier until `st.n >= 3`. This stabilizes the weak/mid/strong classification and matches the new smoothing logic.

## Decisions
- Test security: the server is the only writer of events/strikes/locks (`proctorReport`); clients only report. The heartbeat (10 s) is required for saving answers (90 s window in the rules), so a silent page can't keep answering. Leaving counts once per absence: `left`, or a `gap` if nothing was reported. Strikes count only while a live test is running and the student isn't locked. Unlocking sets `forgiven = strikes`, so the warnings start over.
- Full screen is required on computers only (`pointer: fine`); on phones the back gesture would leave it too easily, and pinning covers phones in the app.
- Opening the camera for a photo answer isn't leaving (the photo button marks an expected leave for 3 minutes).
- AI key: never in the app or the public web page (the repo, the APK and the web page are public). The app calls `BINGO_AI_SERVER/generate`; the server holds `GEMINI_API_KEY` (Secret Manager) or uses Vertex AI. Per-IP limits on the server.
- Liquid glass is for the navigation layer only (bars, tab bar, answer bar, sheets, toasts); content stays on solid grouped surfaces, as in iOS 26. On by default; Settings can turn it off.
- Official three-option questions get a 4th option that is never right ("none of these" or a near number) and are marked `added: [3]`; true/false items are left as they are.
- Imported questions that need a picture, map, diagram or audio are skipped; language exams keep only the reading part.
- The second try does not change the skill map: the first answer counts.
- Past-exam English support keeps matura content in Bulgarian: only module-level UI metadata and app chrome are translated.
- Fixes live in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync). Strict sentence checking is therefore in src/js/48-scoring.js, which wraps Shelly's `textMatches` and `scoreTask`.
- Skill progress is kept per exam (`math.quad@nvo7`). Keys without an exam move to the current exam the first time they are read (`skillState` in 51-skills.js); the demo learner writes keys for the current exam.
- НВО 4/7/10 profiles follow `S.profile.exam` (`nvoGrade()`, `skillList()`), not a separate picker. ДЗИ 12 keeps the matura skill map.
- Mastery smoothing: one rule only (`bktStep` in 51-skills.js: less learning and a smaller maximum jump while a skill has few answers; a wrong answer never raises mastery). A second engine-level smoothing (feedback-2348-s33) was not added on top.
- Focus and one-topic sessions keep their length: a twin takes the next planned place. The diagnostic still adds one more task where the first was wrong, as documented.
- МОН's grade scale stays 30 / 41 / 62,5 / 84 (checked against МОН's announcement); feedback-1623-s16's 95-point Отличен was not taken.
- The streak counts days with a finished session (`S.sessionDays`); older saves start from the days with answers.
- "Сказуемно определение" is kept as the term (textbook term, used by the typical-mistake labels).
- Firestore: only staff read /questions (it holds correctAnswer); students get questions from `startAttempt`.

## Left
- Test security: Play Integrity needs BingO on Google Play plus `PLAY_INTEGRITY_PACKAGE` on the functions and `BINGO_PLAY_PROJECT` in the build (docs/test-security.md). Try pinning, FLAG_SECURE and the overlay hiding on the Xiaomi 17 Ultra (HyperOS floating windows) and a Samsung. A student who leaves and never comes back is only seen as offline on the monitor; their absence becomes a strike when they come back, or the deadline hands the test in.
- BingO for classes: create the Firebase project and set the `BINGO_FIREBASE` GitHub variable, add the Android app's SHA-1, deploy rules and functions (docs/firebase.md). Test Google sign-in on the Xiaomi (needs the SHA-1).
- Classroom/Forms/Drive/Calendar need those APIs enabled and teachers added as test users until Google verifies the app.
- Not done from Shkolo on purpose (scope: tests and homework): absences, remarks, parents' accounts, messages.
- Deploy `server/` on Cloud Run with the Gemini key and set the `BINGO_AI_SERVER` GitHub variable (until then the app runs without cloud AI; Gemini Nano still works on phones/browsers that have it).
- Try Gemini Nano on the Xiaomi 17 Ultra: its Bulgarian may be weak; it is only used for hints, first estimates and checks.
- More of the Drive folder: only the newest 4 exams per subject were imported (≈70 of ≈230 PDFs); run tools/import_dzi.py on the rest.
- Topic tagging of imported questions is by keywords; a teacher could check it.
- Exams the bot could not upload (its branches held placeholder text, nothing was taken): НВО 4 БЕЛ 2007–2016, ДЗИ Математика (общообразователна) 2022-08, English НВО 10 Математика 2025 and 2026, integrated НВО 10 samples (БЕЛ, математика).
- НВО 4 Математика 2007–2016: 25 drawing questions are missing (2007 q12,13,14,16; 2008 q13,14; 2009 q13,14; 2010 q14,15; 2011 q14,15,16; 2012 q13,14; 2013 q9 and q17; 2014 q13,14,15; 2015 q9 and q17; 2016 q13,14,18), and the formulas rebuilt from the key (2012 q9, 2013 q9 and q17, 2015 q9 and q17) should be checked against the PDFs.
- The website upload in the Build workflow fails: curl cannot verify the FTP server's certificate (exit code 60). The FTP_HOST secret must be a host name the server's certificate is issued for. The APK and the GitHub release are not affected.
- Firebase is not wired into the app yet (functions, rules and docs only); the Gemini free-text grading (54b-ai-grade.js) is not on a screen yet.
- НВО profiles reuse the matura generators; НВО-specific tasks (especially for НВО 4) and weights checked against МОН's specification are still to do.
- Manual test on web and APK: Liquid glass on a real phone (blur performance), Android font size, feedback form against a deployed server.
- Maybe add more variants to the small math generators.

## Bugs
- None known. tests/fixes.py covers the 0.5.0 fixes (tests 11–25).
