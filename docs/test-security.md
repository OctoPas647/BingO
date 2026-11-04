# BingO for classes — test security

BingO 0.8.0 protects a teacher's test the way SmarTest, Shkolo and exam browsers do. On Android it also uses the protections that banking and streaming apps use.
It works as soon as Firebase is set up (docs/firebase.md). The only part that needs extra setup is the Google Play check (section 4).

## 1. What the teacher chooses (Задай → "Против преписване")

| Setting | Test / live test | Homework | What it does |
|---|---|---|---|
| When the student leaves | **Заключи** after 1 warning | Само сигнал | *Само сигнал*: the teacher only sees it. *Заключи*: the test freezes until the teacher unlocks it from the monitor. *Предай*: what the student has written so far is handed in. "Предупреждения преди това" sets how many free warnings the student gets (0 = right away). |
| Следи кога ученикът излиза | on | on | Logs every time the student switches app or tab, opens split screen or a floating window, unpins the screen, goes offline or closes the test. |
| Без снимки, запис и споделяне на екрана | on | off | Android: FLAG_SECURE, so screenshots, screen recording and casting show black, and Recents shows no preview. Android 14+ also reports screenshot attempts; Android 15+ reports screen recording. A browser can't block screenshots, but it reports the PrintScreen key and the macOS shortcuts. |
| Без други приложения над теста | on | off | Android 12+ hides other apps' floating windows over BingO, and taps through an overlay are ignored. Split screen and floating windows hide the test until they are closed. On a computer, a window shrunk to half the screen is reported. |
| Закачи телефона към BingO | on | off | Screen pinning. Android asks the student to confirm, and the test stays hidden until they do. Unpinning counts as leaving. If the phone has pinning turned off in its settings, the student can tap "Телефонът ми не позволява"; the teacher sees "не закачи екрана". |
| Цял екран на компютър | on | off | Leaving full screen counts as leaving. The test is hidden while another window is in front. |
| Без копиране и поставяне | on | off | Copy, cut, paste, right-click and drag are blocked and reported. |
| Името на ученика върху теста | on | off | A faint, moving watermark with the student's name and the time, like streaming apps use. A photo taken with a second phone shows whose test it was. If someone removes it from the page, it comes back and the teacher is told. |
| Само на сигурен телефон | on | off | A test won't start on a rooted phone (Magisk, KernelSU, APatch, SuperSU), on a phone with hooking tools (Xposed/LSPosed, Frida), on an emulator, or with USB debugging on. If USB debugging is switched on during the test, that counts as leaving. |
| Без приложения, които четат екрана | on | off | A test won't start while a non-system accessibility service that can read the screen is on. TalkBack and the phone's own services are allowed. On Android 14+ the test is also marked "sensitive", so other accessibility services see nothing. |
| Само в приложението за Android | off | off | The web version shows "open this in the BingO app" and won't start the test. |
| Проверка от Google Play | off | off | Google Play Integrity: the real, unmodified BingO from Google Play, on a real phone. Needs section 4. |

The student sees the rules before starting ("Влез в теста"), and gets a full-screen warning that says how many warnings are left.

## 2. What counts as leaving (one "strike")

Switching app or tab, closing the test screen, split screen or a floating window, unpinning, leaving full screen, screen recording, casting to another display, joining from a second device, removing the watermark, an app that reads the screen or USB debugging switched on during the test, printing, a screenshot that was **not** blocked (web), another window in front for 3 s or more, and no heartbeat for 60 s or more.

These are only alerts (they never lock the test): copy, cut or paste, a screenshot attempt that Android blocked, a second monitor, a half-screen window, developer tools, a short blur, a short dropout (25–60 s), and not pinning the screen.

Nothing counts while a live test is in the lobby or paused, or while the student is locked. Taking a photo of a handwritten solution with the camera isn't leaving.

## 3. Why a student can't hide it

- The phone or browser reports events to the `proctorReport` Cloud Function, and only the server writes them. The Firestore rules no longer let a student write `events`, `flags`, `strikes`, `locked`, `device` or the heartbeat. The server decides about warnings, locking and handing in, so it works even when the teacher's monitor is closed.
- Every 10 s the test sends a heartbeat. A gap is itself an event, so a phone in airplane mode or a page whose script was stopped is caught as soon as it comes back.
- **Answers are only saved while the heartbeat is alive (90 s).** A page that stops reporting also stops saving.
- Events that couldn't be sent wait on the device and go with the next heartbeat. The same event is never counted twice.
- The device is recorded at the start: Android model, Android version and app version, or the browser and OS, plus the IP address. Joining the same test from a second device counts as leaving.

The teacher's monitor ("Монитор", now also for ordinary tests) shows each student's exits as *1/2*, their device, every event (exits marked in red), and lets the teacher lock, unlock, forgive the exits or hand the test in. Unlocking also restarts the warnings.

## 4. Google Play Integrity (optional)

This proves that the request comes from BingO as published on Google Play, on a real Android device. Sideloaded or modified APKs and emulators fail.

1. Publish BingO on Google Play. Internal testing is enough.
2. Play Console → the app → **Test and release → App integrity → Play Integrity API** → link the Google Cloud project of your Firebase project. Note the project **number** (not the id). It's on the Google Cloud dashboard.
3. Google Cloud → **APIs & Services → Library → Play Integrity API → Enable**.
4. Give the Cloud Functions service account (`PROJECT_ID@appspot.gserviceaccount.com`, or the compute default service account) the Play Integrity scope. No extra role is needed. The API only checks that the project is linked.
5. Set the function's environment variable `PLAY_INTEGRITY_PACKAGE=app.bingo` (the package name), for example in `functions/.env`, and redeploy the functions. While testing an APK you build yourself, also set `PLAY_INTEGRITY_ALLOW_SIDELOAD=1`.
6. Add the GitHub Actions variable `BINGO_PLAY_PROJECT` = the project number, or set `"playProject"` in `tools/config.json`, and build again.

Until then, "Проверка от Google Play" is skipped and the monitor doesn't show the check.

## 5. What no app can stop

- **A photo of the screen taken with a second phone.** The watermark makes the photo traceable, and in class the teacher sees phones on desks.
- **Screenshots in a browser on a computer.** They're detected where the browser allows it (the PrintScreen key, Cmd+Shift+3/4/5, another window coming to the front). For a strict test, turn on "Само в приложението за Android".
- **Without a device-management (MDM) setup, screen pinning can be undone.** Android always allows unpinning by holding Back + Overview. BingO notices it and counts it as leaving. A school that manages its phones (Android Enterprise, kiosk mode) can make pinning permanent.
- **A notification shown on top of the test.** Opening it takes the student out of the test and is counted.
- **iPhone.** There's no iOS app yet; on an iPhone the web version runs with the browser protections.

## 6. Tests

- `node tests/proctor_rules.test.js`: the shared rules, event cleaning, the device check and the Play Integrity verdicts.
- `tests/emulator/backend.test.mjs`: warn → lock → unlock → warnings start over, a second device, hand-in on leaving, homework only logs, app-only, a rooted phone, USB debugging, apps that read the screen, nothing counted in the lobby, and the rules that keep students from writing events.
- `tests/emulator/ui_classes.py`: the test hidden while another window is in front, the warning, the watermark, and the teacher's "1/2" on the monitor.
