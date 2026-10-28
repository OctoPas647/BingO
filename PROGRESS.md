# Progress

## Done
- Added past exam ДЗИ Математика 02.06.2020, вариант 2: content/past-exams/dzi12-math-2020-06-02-v2.json (28 tasks, 100 points) and 5 SVG figures in content/past-exams/media/dzi12-math-2020-06-02-v2/. The key matches the official answer key. Tasks 26-28 have the official solution and point breakdown.
- Duolingo-style progress bar (feature/duo-progress-bar):
  - Intro (first-run setup): animated bar in src/js/58-onboarding.js. It fills with a small spring, has a shimmer, and pulses once on the last step. Style is in src/css/bingo.css (`.duo`).
  - Tests (diagnostic, focus, one topic): same look, but static. `.playbar .bar.pbar` has transitions and animations switched off in src/css/bingo.css. src/js/61-session.js is not changed.
- Added НВО 4. клас Math past exams 2007-2016 (content/past-exams/nvo4-math-2007.json ... nvo4-math-2016.json): 170 questions. Official answer keys used for every year except 2013 (no key published, answers calculated and marked with a note).
- 0.3.2 release prepared: version 0.3.1 -> 0.3.2, androidVersionCode 4 -> 5, CHANGELOG entry.
- Fix: confetti no longer falls on the next screen. The result screen now removes the confetti canvas when you leave it (nav.onLeave in src/js/61-session.js).
- Fix: the same question no longer repeats in one session. nextTask() remembers what was shown (prompt, options, answer), retries other seeds, then neighbouring levels, and only repeats if nothing new exists.
- Fix: browser Back button "gets stuck", then suddenly leaves the app.
  - Cause: `go()` pushes a history entry per screen, but in-app back, Android back, `home()` and `backTo()` only popped `NAV`. The history kept stale entries.
  - Fix: `src/js/66-history.js` wraps `back/home/backTo` and rewinds the history by the same number of entries. A real browser Back is not rewound.
- Added an optional **Liquid glass** appearance setting. The original light, dark, AMOLED and system themes remain unchanged; enabling Liquid glass adds translucent blurred surfaces to cards, inputs, forecast rows and the bottom navigation.
  - `src/css/bingo.css` adds the `data-glass="1"` variables and glass styles for shared surfaces.
  - `src/css/nav.css` adds the glass bottom navigation.
  - `src/css/forecast.css` adds glass forecast rows.
  - `src/js/50-state.js` adds a persisted `settings.glass` boolean and applies `data-glass` in `applySettings()`.
  - `src/js/63-settings.js` adds the Liquid glass switch and saves/applies the choice.

## Decisions
- Progress bar: only the bar is animated in the intro and static in tests. Other animations (confetti, result bars `.dbar`) are unchanged.
- Progress bar uses `var(--good)` so it follows the themes (light, dark, AMOLED). `prefers-reduced-motion` turns the intro animation off too.
- The `3/9` text stays next to the intro bar (`.ob-count`), so existing tests that look for it keep working.
- Fixes live in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync).
- Release and APK are built by the Build workflow (.github/workflows/build.yml) after merge to main.
- Cause of the repeats: generated math tasks get a new id per seed, so the old id check could not see identical questions; some generators have only 3-12 variants.
- New exam id is dzi12-math-2020-06-02-v2 (not ...-06-v2: that one is 03.06.2020). past.date is 2020-06-02. The PDF is named "3dzi" (third ДЗИ); I kept it under dzi12 math.
- Figures for tasks 16, 17, 19, 20 and the solution of 28 are redrawn as SVG, not copied from the PDF. Task 24's table is written as two lines of numbers.
- Liquid glass is an overlay on the selected base theme, not a replacement theme. This preserves the original appearance and works with system, light, dark and AMOLED modes.

## Left
- Run `python tools/build.py check` for the new exam (not run when it was added), then look at the 5 figures on web and APK.
- Manual test of the progress bar on web and APK. I did not run the build; I assumed Shelly's `bar()` renders `.bar.pbar > i`.
- Past exams need no code change: tools/build.py loads every *.json in content/past-exams/.
- 25 questions that need a drawing were left out of the 2007-2016 files (the GitHub connector can only push text, not images): 2007 q12,13,14,16; 2008 q13,14; 2009 q13,14; 2010 q14,15; 2011 q14,15,16; 2012 q14,15,16; 2013 q13,14; 2014 q14,15; 2015 q13,14; 2016 q13,14,18.
- Formulas rebuilt from the answer key because the PDF text lost the signs: 2012 q9, 2015 q9 and q17 (checked against the key), 2013 q9 and q17 (not confirmed, no key). Each has a note in its file.
- past.pages in the new files is the PDF page range, not the book page numbers used in the 2017+ files.
- Manually test Liquid glass on web and Android APK: toggle it in Settings, switch between light/dark/AMOLED, and check Home, Stats, Profile, Forecast and a practice session.

## Left
- Add the 25 drawing questions with their images (cropped from the PDFs).
- Check the flagged formulas against the original PDFs.
- Add НВО 4. клас БЕЛ 2007-2016 (separate PR).
- After merge to main, check that the release has the new APK.
- Manual test on web and APK.
- Maybe add more variants to the small math generators.
- Check the other 2020-2021 files (БЕЛ 01.06.2020, 27.08.2020, 19.05.2021, math 28.08.2020) against the repo; they look already added.

## Bugs
- None known. Edge case: tapping very fast while a history rewind is running was not tested.
