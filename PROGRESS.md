# Progress

## Done
- Duolingo-style progress bar (feature/duo-progress-bar):
  - Intro (first-run setup): animated bar in src/js/58-onboarding.js. It fills with a small spring, has a shimmer, and pulses once on the last step. Style is in src/css/bingo.css (`.duo`).
  - Tests (diagnostic, focus, one topic): same look, but static. `.playbar .bar.pbar` has transitions and animations switched off in src/css/bingo.css. src/js/61-session.js is not changed.
- 0.3.2 release prepared: version 0.3.1 -> 0.3.2, androidVersionCode 4 -> 5, CHANGELOG entry.
- Fix: confetti no longer falls on the next screen. The result screen now removes the confetti canvas when you leave it (nav.onLeave in src/js/61-session.js).
- Fix: the same question no longer repeats in one session. nextTask() remembers what was shown (prompt, options, answer), retries other seeds, then neighbouring levels, and only repeats if nothing new exists.
- Fix: browser Back button "gets stuck", then suddenly leaves the app.
  - Cause: `go()` pushes a history entry per screen, but in-app back, Android back, `home()` and `backTo()` only popped `NAV`. The history kept stale entries.
  - Fix: `src/js/66-history.js` wraps `back/home/backTo` and rewinds the history by the same number of entries. A real browser Back is not rewound.

## Decisions
- Progress bar: only the bar is animated in the intro and static in tests. Other animations (confetti, result bars `.dbar`) are unchanged.
- Progress bar uses `var(--good)` so it follows the themes (light, dark, AMOLED). `prefers-reduced-motion` turns the intro animation off too.
- The `3/9` text stays next to the intro bar (`.ob-count`), so existing tests that look for it keep working.
- Fixes live in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync).
- Release and APK are built by the Build workflow (.github/workflows/build.yml) after merge to main.
- Cause of the repeats: generated math tasks get a new id per seed, so the old id check could not see identical questions; some generators have only 3-12 variants.

## Left
- Manual test of the progress bar on web and APK. I did not run the build; I assumed Shelly's `bar()` renders `.bar.pbar > i`.
- After merge to main, check that the release has the new APK.
- Manual test on web and APK.
- Maybe add more variants to the small math generators.

## Bugs
- None known. Edge case: tapping very fast while a history rewind is running was not tested.
