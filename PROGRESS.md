# Progress

## Done
- 0.3.2 release prepared: version 0.3.1 -> 0.3.2, androidVersionCode 4 -> 5, CHANGELOG entry.
- Fix: confetti no longer falls on the next screen. The result screen now removes the confetti canvas when you leave it (nav.onLeave in src/js/61-session.js).

## Decisions
- Fixed in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync).
- Release and APK are built by the Build workflow (.github/workflows/build.yml) after merge to main.

## Left
- Merge the PRs in order, then check that release v0.3.2 has BingO-0.3.2.apk.
- Fix: the same question can repeat in one session (separate PR).

## Bugs
- Same question repeating in one session (being fixed).
