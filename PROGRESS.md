# Progress

## Done
- Added НВО 4. клас Math past exams 2007-2016 (content/past-exams/nvo4-math-2007.json ... nvo4-math-2016.json): 170 questions. Official answer keys used for every year except 2013 (no key published, answers calculated and marked with a note).
- 0.3.2 release prepared: version 0.3.1 -> 0.3.2, androidVersionCode 4 -> 5, CHANGELOG entry.
- Fix: confetti no longer falls on the next screen. The result screen now removes the confetti canvas when you leave it (nav.onLeave in src/js/61-session.js).
- Fix: the same question no longer repeats in one session. nextTask() remembers what was shown (prompt, options, answer), retries other seeds, then neighbouring levels, and only repeats if nothing new exists.
- Fix: browser Back button "gets stuck", then suddenly leaves the app.
  - Cause: `go()` pushes a history entry per screen, but in-app back, Android back, `home()` and `backTo()` only popped `NAV`. The history kept stale entries.
  - Fix: `src/js/66-history.js` wraps `back/home/backTo` and rewinds the history by the same number of entries. A real browser Back is not rewound.

## Decisions
- Fixes live in BingO's own src/, not in engine/ (engine is a vendored copy of Shelly and would be overwritten on resync).
- Release and APK are built by the Build workflow (.github/workflows/build.yml) after merge to main.
- Cause of the repeats: generated math tasks get a new id per seed, so the old id check could not see identical questions; some generators have only 3-12 variants.
- Past exams need no code change: tools/build.py loads every *.json in content/past-exams/.
- 25 questions that need a drawing were left out of the 2007-2016 files (the GitHub connector can only push text, not images): 2007 q12,13,14,16; 2008 q13,14; 2009 q13,14; 2010 q14,15; 2011 q14,15,16; 2012 q14,15,16; 2013 q13,14; 2014 q13,14,15; 2015 q13,14; 2016 q13,14,18.
- Formulas rebuilt from the answer key because the PDF text lost the signs: 2012 q9, 2015 q9 and q17 (checked against the key), 2013 q9 and q17 (not confirmed, no key). Each has a note in its file.
- past.pages in the new files is the PDF page range, not the book page numbers used in the 2017+ files.

## Left
- Add the 25 drawing questions with their images (cropped from the PDFs).
- Check the flagged formulas against the original PDFs.
- Add НВО 4. клас БЕЛ 2007-2016 (separate PR).
- After merge to main, check that the release has the new APK.
- Manual test on web and APK.
- Maybe add more variants to the small math generators.

## Bugs
- None known. Edge case: tapping very fast while a history rewind is running was not tested.
