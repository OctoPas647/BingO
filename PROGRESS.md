# PROGRESS

## Done
- Fix: browser Back button "gets stuck", then suddenly leaves the app (branch `fix/browser-back`).
  - Cause: `go()` pushes a history entry per screen, but in-app back, Android back, `home()` and `backTo()` only popped `NAV`. The history kept stale entries.
  - Fix: `src/js/66-history.js` wraps `back/home/backTo` and rewinds the history by the same number of entries. A real browser Back is not rewound.

## Left
- Rebuild `downloads/BingO-web.html` and the APK after merging (not done in this PR).
- Manual test on web and APK (see PR).

## Decisions
- The fix lives in `src/js/` (BingO code) and not in `engine/` (Shelly copy), so the engine stays identical to Shelly.

## Bugs
- None known after this fix. Edge case: tapping very fast while a history rewind is running was not tested.
