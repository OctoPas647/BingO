# Progress

## Done
- 0.3.2 release prepared: version 0.3.1 -> 0.3.2, androidVersionCode 4 -> 5, CHANGELOG entry.
- Fix: confetti no longer falls on the next screen. The result screen now removes the confetti canvas when you leave it (nav.onLeave in src/js/61-session.js).
- Fix: the same question no longer repeats in one session. nextTask() remembers what was shown (prompt, options, answer), retries other seeds, then neighbouring levels, and only repeats if nothing new exists.

## Decisions
- Fixed in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync).
- Release and APK are built by the Build workflow (.github/workflows/build.yml) after merge to main.
- Cause of the repeats: generated math tasks get a new id per seed, so the old id check could not see identical questions; some generators have only 3-12 variants.

## Left
- Merge the PRs in order (#4, confetti, duplicates), then check that release v0.3.2 has BingO-0.3.2.apk.
- Maybe add more variants to the small math generators.

## Bugs
- None known.
