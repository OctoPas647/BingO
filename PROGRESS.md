# Progress

## Done
- Essay / ЛИС self-grading: a 30-point open task without criteria now shows four clear criteria (content and argumentation 10, structure and coherence 7, language 7, format and requirements 6) via `essayRubric()` in `src/js/59-rubric.js`. An empty open answer still cannot be self-graded and scores 0. Regression check 26 added in `tests/fixes.py`.
- **0.5.0**: all 64 open branches merged into one version (see CHANGELOG.md). Many branches fixed the same problem several times; each fix is in once, reviewed, without the unrelated edits the bot made on the way. Every merge commit message says what was taken from each branch and what was not, and why.
- Earlier work (0.4.x): ДЗИ Математика 02.06.2020 вариант 2, НВО 4 Математика 2007–2016, Duolingo-style progress bar, browser-history fixes (67-history-sync.js and the tab-bar wrapper in 64-nav.js), confetti cleanup, no repeated question in a session, Android fullscreen-video code removed, no duplicate option values in generated tasks (`normalize()` in 52-math.js).

## Decisions
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
- Exams the bot could not upload (its branches held placeholder text, nothing was taken): НВО 4 БЕЛ 2007–2016, ДЗИ Математика (общообразователна) 2022-08, English НВО 10 Математика 2025 and 2026, integrated НВО 10 samples (БЕЛ, математика).
- НВО 4 Математика 2007–2016: 25 drawing questions are missing (2007 q12,13,14,16; 2008 q13,14; 2009 q13,14; 2010 q14,15; 2011 q14,15,16; 2012 q13,14; 2013 q9 and q17, 2015 q9 and q17) should be checked against the PDFs.
- The website upload in the Build workflow fails: curl cannot verify the FTP server's certificate (exit code 60). The FTP_HOST secret must be a host name the server's certificate is issued for. The APK and the GitHub release are not affected.
- Firebase is not wired into the app yet (functions, rules and docs only); the Gemini free-text grading (54b-ai-grade.js) is not on a screen yet.
- НВО profiles reuse the matura generators; НВО-specific tasks (especially for НВО 4) and weights checked against МОН's specification are still to do.
- Manual test on web and APK: Liquid glass on a real phone (blur performance), Android font size, feedback form against a deployed server.
- Maybe add more variants to the small math generators.

## Bugs
- None known. tests/fixes.py covers the 0.5.0 fixes (tests 11–26).
