# Progress

## Done
- Test stability, part 4: documented the test-stability fix and added a clear suite-validation summary.
  - `tests/fixes.py` now prints the total checks, passed checks, failed checks, page errors, and the names of any failed checks.
  - The script exits with code 0 only when every check passes and no page error was captured; otherwise it exits nonzero.
  - `PROGRESS.md` records the `?testSeed=` hook, condition-based waits, isolated browser contexts, deterministic diagnostic/repetition tests, and the validation summary.
- Test stability, part 3: rewrote the flaky diagnostic and repetition checks in `tests/fixes.py`.
  - Test 4 now uses `?testSeed=4`, waits for an actual answer control (`.opt`, `input.field.num`, or `.orderlist`), and handles each recognized task type without random whole-session retries.
  - Test 5 now uses `?testSeed=5`, explicitly waits for every `.task`, and deterministically collects the available prompts before asserting that none repeat.
  - Home readiness in these flows is awaited through stable action hooks (`[data-start="diag"]` / `[data-start="focus"]`) rather than the visual `.losscard` class.
  - The tech lead's suggested stable home data-attributes do not exist in the app, and this part is scoped to `tests/fixes.py`; the existing `[data-start]` action attributes are therefore used as the stable home markers.
  - Manual test: run `python tests/fixes.py` after `python tools/build.py web` at least 10 times; tests 4 and 5 should pass consistently, with no timing-related failures.
- Test stability, part 2: replaced fixed sleeps in `tests/fixes.py` with condition-based Playwright waits and isolated each browser check.
  - Every test now runs in its own browser context through `run()`, with a failure screenshot saved to `build/shots/` and the failing step reported.
  - Fixed `wait_for_timeout()` calls were replaced by waits for visible UI, detached elements, feedback/result screens, and concrete app state via `wait_for_function()` / `expect()`.
  - The suite now opens `?testSeed=123`, using the part-1 hook so diagnostic and generated-task sequences are repeatable.
  - Normal app behavior is unchanged; this PR changes only the browser test harness.
  - Manual test: run `python tests/fixes.py` after `python tools/build.py web`; it should complete without `TimeoutError`, save a screenshot for any failing check, and exit nonzero only when a check or page error fails.
- Test stability, part 1: added a `?testSeed=` hook for repeatable task sequences.
  - `src/index.template.html` reads `testSeed` from the URL before app scripts run.
  - `src/js/99-boot.js` installs a deterministic PRNG in place of `Math.random` only when `?testSeed=` is present.
  - `src/js/61-session.js` uses a stable session id under `?testSeed=`, because `uid()` otherwise mixes the current time into every generated-task seed.
  - `src/js/52-math.js` and `src/js/53-bel.js` already receive deterministic per-slot seeds through `pickTask(..., sessionId + ':' + P.i, ...)`; no generator changes were needed.
  - Normal app behavior is unchanged when `testSeed` is absent.
  - Manual test: open the built web app with `?testSeed=123`, start a diagnostic, refresh, and repeat the same navigation; the task sequence should match. Open without the parameter and confirm task selection remains random.
- Past exams: English UI metadata fix (feature/feedback-20261029-1247-s46).
  - Diagnosis: in English mode, `pastView()` in `src/js/66-past.js` selects the matching English module from `content/past-exams-en/`, so its exam title, part titles and instructions supply the UI chrome. Task content remains Bulgarian by design.
  - Scope: UI only. Questions, answer options, solutions, explanations and rubrics stay in their original language.
  - Files: verified `lang: "en"` in all `content/past-exams-en/*.json`; documented the English metadata selection in `src/js/66-past.js`; checked that every `L()` key in `src/js/66-past.js` already has an English entry in `src/js/49-lang.js`.
  - Manual test: switch Settings → Language to English, open Home → „Изпити от минали години“, open an exam with an English variant, and check that the exam header, part headers and instructions are English while questions, options and solutions remain Bulgarian. Repeat for an exam without an English variant; it should remain Bulgarian and keep the `BG` marker.
- **0.5.0**: all 64 open branches merged into one version (see CHANGELOG.md). Many branches fixed the same problem several times; each fix is in once, reviewed, without the unrelated edits the bot made on the way. Every merge commit message says what was taken from each branch and what was not, and why.
- Earlier work (0.4.x): ДЗИ Математика 02.06.2020 вариант 2, НВО 4 Математика 2007–2016, Duolingo-style progress bar, browser-history fixes (67-history-sync.js and the tab-bar wrapper in 64-nav.js), confetti cleanup, no repeated question in a session, Android fullscreen-video code removed, no duplicate option values in generated tasks (`normalize()` in 52-math.js).
- **Оценката на усвояването се мени прекалено рязко**: `bktUpdate` in 51-skills.js no longer adds learning after a wrong answer, `guessOf` uses a 0.2 default for non-choice tasks, and `bktStep` keeps a conservative maximum jump (0.05 below two answers, 0.10 below four) and a 0.25 learning multiplier until `st.n >= 3`. This stabilizes the weak/mid/strong classification and matches the new smoothing logic.

## Decisions
- Test stability uses four coordinated changes: a URL test seed, a deterministic PRNG, condition-based waits with isolated contexts, and deterministic diagnostic/repetition scenarios. The suite exits 0 only for a fully green run.
- Session-advance checks wait for the main button to change from „Провери“, which is more reliable than requiring a particular feedback CSS class.
- Before reloading in the Liquid-glass test, the test forces `saveState(true)` so the debounced setting save cannot be lost by the reload.
- Past-exam English support keeps matura content in Bulgarian: only module-level UI metadata and app chrome are translated.
- Fixes live in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync). Strict sentence checking is therefore in src/js/48-scoring.js, which wraps Shelly's `textMatches` and `scoreTask`.
- Skill progress is kept per exam (`math.quad@nvo7`). Keys without an exam move to the current exam the first time they are read (`skillState` in 51-skills.js); the demo learner writes keys for the current exam.
- НВО 4/7/10 profiles follow `S.profile.exam` (`nvoGrade()`, `skillList()`), not a separate picker. ДЗИ 12 keeps the matura skill map.
- Mastery smoothing: one rule only (`bktStep` in 51-skills.js: less learning and a smaller maximum jump while a skill has few answers; a wrong answer never raises mastery). A second engine-level smoothing (feedback-2348-s33) was not added on top.
- Focus and one-topic sessions keep their length: a twin takes the next planned place. The diagnostic still adds one more task where the first was wrong, as documented.
- МОН's grade scale stays 30 / 41 / 62,5 / 84 (checked against МОН's announcement); feedback-1623-s16's 95-point Отличен was not taken.
- The streak counts days with a finished session (`S.sessionDays`); older saves start from the days with answers.
- "Сказуемо определение" is kept as the term (textbook term, used by the typical-mistake labels).
- Firestore: only staff read /questions (it holds correctAnswer); students get questions from `startAttempt`.

## Left
- Exams the bot could not upload (its branches held placeholder text, nothing was taken): НВО 4 БЕЛ 2007–2016, ДЗИ Математика (общообразователна) 2022-08, English НВО 10 Математика 2025 and 2026, integrated НВО 10 samples (БЕЛ, математика).
- НВО 4 Математика 2007–2016: 25 drawing questions are missing (2007 q12,13,14,16; 2008 q13,14; 2009 q13,14; 2010 q13,14,16; 2012 q9, 2013 q9 and q17; 2015 q9 and q17; 2016 q13,14,18), and the formulas rebuilt from the key should be checked against the PDFs.
- The website upload in the Build workflow fails: curl cannot verify the FTP server's certificate (exit code 60). The FTP_HOST secret must be a host name the server's certificate is issued for. The APK and the GitHub release are not affected.
- Firebase is not wired into the app yet (functions, rules and docs only); the Gemini free-text grading (54b-ai-grade.js) is not on a screen yet.
- НВО profiles reuse the matura generators; НВО-specific tasks (especially for НВО 4) and weights checked against МОН's specification are still to do.
- Manual test on web and APK: Liquid glass on a real phone (blur performance), Android font size, feedback form against a deployed server.
- Maybe add more variants to the small math generators.
- Run `python tests/fixes.py` at least 10 times locally after building the web app to confirm the diagnostic and repetition tests remain stable.

## Bugs
- Test flakiness in `tests/fixes.py` is fixed: fixed sleeps, shared browser state, random diagnostic retries, and brittle timing assumptions were replaced with isolated contexts, condition-based waits, and `?testSeed=` scenarios.
- The suite now reports failed checks and page errors clearly, saves a screenshot for each failing test, and exits 0 only when all checks pass.
- Fixed in this branch: the AI-hint translation key was restored to `✦ Подсказка`; session-advance waits now use the main-button state; and the Liquid-glass reload saves state before restarting.
