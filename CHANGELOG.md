# Changelog

## 1.0.0
**Съобщения**: a chat for classes, like Apple's Messages with a little Instagram. Setup and details: docs/messages.md.

- **A group chat for every class**, made and kept up to date by the server (joining, leaving, co-teachers, renaming); **private chats** between a student and their teacher (students cannot start private chats with each other)
- **Messages that feel native**: blue bubbles grouped by sender with day and time lines, big emoji, clickable links, replies with a quote, unsend, a teacher can remove a message in their chats; "Изпратено" / "Видяно" / "Видяно от N", "… пише", unread dots and a count on the tab, a toast for a new message in another chat (never during a test or practice)
- **Notifications**: a system notification for a new message while BingO is in the background (tap opens the chat), **web push** when BingO is closed (Firebase Cloud Messaging, `chatNotify`, the `bingo-push-sw.js` worker next to the page), the unread count in the page title, mute a chat, nothing during a test; the Android app shows messages while open (push there needs Firebase Messaging in the Gradle build, docs/messages.md)
- **Reactions**: hold (or right-click) a message for ❤️ 😂 😮 😢 😡 👍, double-tap for ❤️
- **Any file up to 25 MB** (10 per message): pick, paste or drag & drop; pictures in a grid, videos and audio play in the chat, other files as cards
- **Google Workspace**: Docs/Sheets/Slides/Forms/Drive/Meet/YouTube links become cards with a preview; pick files **from Google Drive** and give the chat access in the same step; **Word, Excel and PowerPoint open in Google Docs, Sheets and Slides**; Drive's `.gdoc`/`.gsheet`/… shortcut files turn into their links; save any file to Google Drive; start a **Google Meet** call from the chat
- **Laptop and phone**: list and chat side by side on a wide screen; a tab for students (Начало · Статистики · Клас · Съобщения · Профил) and a section for teachers
- **Demo mode**: the demo school has its class chats and a private chat, so Messages can be shown offline
- Security: Firestore and Storage rules for chats (members only, write only as yourself, one reaction each, unsend clears the message), functions in `functions/chat.js`; tests in `tools/check.js` (section 11), `tests/emulator/chat.test.mjs` and `tests/ui_messages.py` (the UI with a stand-in for Firebase)


## 0.9.0 — statistics, projections, planned tests
- Student **Статистики** in three tabs: **Оценки** (Shkolo-style: общ успех, grades by subject and term with срочна/годишна, spread of grades, the year's average next to last year's, you vs the class on BingO tests, teachers' notes, absences), **Упражнения** (activity rings, active days, accuracy by week, the matura forecast over time) and **Години** (every school year side by side). Grades come from BingO tests automatically and can be typed in (one by one, many at once, or past years' year grades); everything is kept across school years.
- Teacher **Прогнози** (from Табло, a class's tab and each student's page): likely result and grade of every student on each coming test with a range, НВО/ДЗИ forecast, who needs help and why, the class over time and by school year. New `classStats` function gives students class averages only.
- **Planned tests**: Календар → „Насрочи тест“ puts a test in the calendar before it exists; create it or pick it from the bank later — the class, date and length are filled in. Students see planned tests in Клас.
- Animated charts (lines, columns, donut, rings, heatmap, ranges) with tooltips, light and dark; Apple-style shimmering skeletons while things load.
- Orientation: portrait on phones; any orientation on tablets, unfolded foldables and near-square screens (Android); the web version asks to turn a phone back upright.
- Fixes: notifications stretched over the whole screen on screens with the bottom menu; the demo teacher's student pages showed no skill map; the website upload went to the FTP account's top folder instead of bingo/.

## 0.8.1
Bottom menu rebuilt, every animation made fast and crash-proof, Smoothness from LToTS, and a demo mode for showing BingO.

- **Demo mode** (80-demo-cloud.js): "Покажи демо" on the very first screen, in Profile, in Settings and in the teacher's "Още" opens **Демо ученик** or **Демо учител** — no internet, no sign-in. The real class and teacher screens run on an in-memory copy of the cloud: class 12А after a mock ДЗИ in Russian (МОН, B1, May 2025) — 23/24 handed in, graded on the matura scale, open answers graded by Gemini waiting for the teacher, two students with anti-cheat alerts (one locked by the server); class 12Б with homework, a live test ready to start and a test next week; every student's skill map. The demo student is Мария Петрова from 12А: her skill maps (math, БЕЛ, Russian), her Russian result with the teacher's note and the right answers, and a finished Russian past exam. Your own data is kept and comes back with "Изход от демото"

- **One bottom menu for all tabs** (`#tabdock`, 64-nav.js): it lives outside the pages, so it no longer jumps half off the screen or vanishes while switching, and it shows at once even while Клас is still loading. It slides away on other screens and comes back with the tabs
- **The highlight fits the menu**: it was sized for 3 tabs and slid off the bar on Профил once Клас made 4. It is now measured from the selected tab (works for 4 student tabs and the teacher's 6). Tapping the tab you are on scrolls it to the top; any way of switching tabs keeps the stack as Home + one tab, so Android back always goes to Home
- **Page transitions** (68-motion.js): tabs cross-fade in 120 ms, pushed screens slide in 260 ms, sessions come up in 300 ms (were 280–560 ms). Both pages are pinned to the screen while moving, so the answer bar and nav bars stay where they are. A tap during a transition finishes it at once instead of stacking another on top. The page behind a sheet no longer shrinks (it moved the answer bar)
- **Flying through questions**: "Напред" works 150 ms after "Провери" (was 450 ms — 4–5 taps were swallowed); a tap while the next question loads can no longer skip it; past exams get the same double-tap guard. Questions, verdicts, options, buttons, sheets and toasts animate in 0.14–0.32 s; cards on screen appear at once, only cards below the fold ease in
- **Smoothness** (Settings → Тема, from LToTS's Look → Smoothness): Авто · Пълно · Балансирано · Леко. Light draws the glass with no blur at all; Auto watches frame times while the app moves and steps down by itself when it keeps stuttering (remembered per device, "Измери отново" starts over)
- Tests: `tests/motion_stress.py` (menu stays still, highlight lines up, 60 random tab taps, back and push spam, answer bar position, speed run, double taps, Smoothness levels; `--slow` for a 4× slower CPU)

## 0.8.0
Test security for teacher-set tests. Setup and details: docs/test-security.md.

- **Leaving the test is enforced by the server**: switching app or tab, split screen, floating windows, unpinning, leaving full screen, going offline, a second device. The teacher picks what happens per test: only an alert, **warn then lock** (the default for tests: 1 warning) or **warn then hand in** (like SmarTest). Locking works even when the teacher's monitor is closed; the teacher unlocks (or forgives) from the monitor, and the warnings start over
- **Students can't hide or clear it**: only the new `proctorReport` function writes events, alerts and the device. A 10-second heartbeat catches airplane mode and stopped pages, and answers are only saved while the heartbeat is alive
- **Android, like banking and streaming apps** (`SecureBridge.java`): no screenshots, recording or casting, and no preview in Recents; other apps' floating windows are hidden (Android 12+); taps through overlays are ignored; content is hidden from apps that read the screen (Android 14+); screenshot attempts (Android 14+) and screen recording (Android 15+) are reported; the screen stays on; screen pinning is required, and unpinning counts as leaving
- **Safe devices only** (optional per test): no start on rooted phones, hooking tools, emulators, with USB debugging on, or with non-system apps that read the screen; **Google Play Integrity** (when set up); **Android app only** (the web version refuses the test)
- **Browser**: full screen on computers, the test hidden while another window is in front, and reports for PrintScreen, print, developer tools, a second monitor and a half-screen window
- **The student's name as a moving watermark** over the test, so photos taken with another phone can be traced
- **Teacher's monitor for ordinary tests too**: exits as 1/2, the device (model or browser, IP, Play check), every event with exits in red; lock, unlock, forgive the exits, hand in now
- Protection is on by default for tests and live tests; homework only logs. Old tests' "lock after N alerts" setting carries over
- Tests: `tests/proctor_rules.test.js` (29), backend emulator tests 81/81 (31 new), UI test with the warning and the monitor

## 0.7.0
BingO for classes: a teacher's part and a "Клас" tab for students. Setup: docs/firebase.md.

- **Teacher or student**: the first-run setup asks. A teacher signs in with Google and gets the teacher's part (a sidebar on a laptop, a tab bar on a phone); a student can type a class code. Anyone can choose "Учител" for now; the backend can also limit teachers to a list of emails/domains, a school code or admin approval (no app update needed)
- **Classes**: join with a 6-letter code, a QR code, an email invitation or a CSV list; import classes and students from Google Classroom; co-teachers; archive
- **Tests**: every question type (one or several right answers, short answer, number, fill the gaps, order, match, open answer, photo of a handwritten solution), pictures and math in questions; from BingO's banks and past НВО/ДЗИ exams, from Gemini on a topic, from a PDF / photo / text / Google Doc, or from a Google Forms quiz; Gemini can improve one task; preview as a student
- **Giving a test**: homework, a test or a live test, to several classes at once; open and close times, a time limit, attempts, late work; shuffled questions and answers per student; no going back; grading per test (2–6 by thresholds, 2–6 with decimals, МОН matura scale, percent or points); what students see afterwards and when
- **Anti-cheating**: an alert when a student leaves the test or the app, copy/paste blocked, full screen on a computer, the phone pinned to BingO and screenshots blocked on Android, automatic lock after N alerts
- **Live test**: a grid of the class — the question each student is on, what they are writing now, right/wrong so far, time on the question, online or not, every alert; start, pause, +5 min for all or one student, lock, kick, end
- **Projector quiz**: one question at a time on the big screen, coloured answers on the phones, countdown, answer chart, leaderboard and podium
- **Grading**: closed questions are checked on the server (the answers never reach a student's phone); open answers and photos are graded by Gemini — suggested for approval or fully automatic — with the teacher's rubric and "what to look for"; every time the teacher changes Gemini's points it becomes an example, so Gemini grades more like that teacher
- **Results and analysis**: per student and per question (how many got it right, the most common wrong answer, average time), grade distribution, a gradebook per class, a student's history and BingO skill map, the class's weakest skills from everyday practice, Gemini's analysis of a test; export to CSV, Excel, PDF or a Google Sheet
- **Schedule**: a calendar of tests and homework, recurring homework (e.g. every Monday: BingO practice on the class's weakest skills, or random tasks from a test), Google Calendar invitations with reminders, in-app notifications
- **Gemini assistant for teachers**: chat about your classes; it can make a test you open in the editor
- **Students**: the "Клас" tab with live tests, homework and results; homework that is a BingO practice session; results and right answers when the teacher allows
- Firebase: Firestore rules, Storage rules, Cloud Functions (`functions/`), emulator tests (`tests/emulator/`); Android: Google sign-in with the phone's account picker

## 0.6.0
A native-feeling redesign, Google AI behind almost everything, and every matura.

- **iOS look with Liquid glass**: system colours and type (SF on Apple devices, Inter elsewhere), grouped lists, large titles that shrink into the nav bar as you scroll, a floating glass tab bar that gets smaller while you read, a glass answer bar, glass sheets that lift the page behind them. Content stays on solid surfaces; glass is only the navigation layer, like iOS 26. "Liquid glass" is on by default (turn it off in Settings for solid bars)
- **Apple-like motion**: spring curves everywhere; screens push and pop, questions and past exams come up like a modal, tabs cross-fade, sheets can be pulled down to close, the segmented control and the tab bar's lens slide, cards ease in as they scroll into view, buttons give under the finger, a light haptic tick on answers. "Анимации" in Settings (and the system's reduce motion) turns it off
- **No typed API key anywhere**: the key field is gone from Settings and setup, and an old key saved on a phone is dropped. Gemini runs on BingO's own server (`server/`, Cloud Run), which holds the Gemini key or uses Vertex AI; the app only knows the server's address (`BINGO_AI_SERVER`). **Deploy the server** (see README) and set the GitHub variable `BINGO_AI_SERVER`
- **Gemini for almost everything**: new questions for every subject in the real exam's style (real МОН questions of the same topic are the examples), questions similar to the ones you missed, hints, why an answer was wrong, checking open past-exam answers against the official answer, the week plan and a coach note after each session. AI questions are kept on the phone for offline use
- **Gemini Nano on the device**: Android phones with Gemini Nano (ML Kit GenAI Prompt API / AICore, e.g. Xiaomi 17 Ultra) and Chrome's built-in model on the web give the first hint instantly, pre-check open answers, double-check Gemini's new questions and take over when there is no internet. Phones without it simply use the cloud
- **Every matura**: История, Биология, Химия, Физика, География, Философия, ИТ, Информатика, Предприемачество, Изобразително изкуство, Музика and Английски, Немски, Руски, Френски, Испански, Италиански — imported from МОН's past exams with the official key (≈950 closed questions, plus past exams to solve). English also gets ≈400 questions from BrainBurst and BandUP. Pick any matura from Home; your profile's maturas come first
- **Every question the app has is used**: all closed questions of all past exams now also train their topic (only for your own exam: no НВО 4 question for a ДЗИ learner)
- **Four answers on every closed question**: bank questions get extra options from questions of the same topic; official three-option questions get a 4th (a near number, or "none of these"), never the right one
- **Math like the real exam**: about every other training question is a real НВО / ДЗИ question; new topics Функции, Тригонометрия, Планиметрия, Статистика with generators worded like МОН's tasks; НВО 4 trains numbers, measures, shapes and word problems from its real exams
- **Less punishing**: a wrong first pick gets a second try (the skill map still counts the first one), "Не знам" shows the solution without a red screen, a lost point is not shown as a falling number during practice
- **Go over your mistakes**: at the end of a session or a past exam every missed question is listed with your answer, the right one and the solution; "Тренирай подобни" trains on similar questions — a new variant, a Gemini question made from that mistake or another real question of the topic — never the same one
- **Android is built with Gradle** (for Gemini Nano): `python tools/build.py android` runs `platforms/android/gradlew`; Android 8.0+ (was 7.0+); the same signing key, so it installs over the old app

## 0.5.0
Everything from the 64 open branches in one version.

- **Your data stays after a restart**: age, exam, profile and extra matura, past exam results and the Sheet's retry state were lost when the app restarted
- **Demo learner is safe**: loading it again never overwrites the copy of your own answers; "Върни моите отговори" shows up only when there is a real copy; running the setup again with the demo loaded removes the demo's answers. A short note under "Покажи с демо ученик" says what the demo is
- **Progress per exam**: НВО 4, НВО 7, НВО 10 and ДЗИ 12 each keep their own skill map, so switching exams starts fresh and switching back keeps what you had
- **НВО math profiles**: with an НВО chosen in the setup, mathematics trains that grade's topics at that grade's pace (НВО 4 never gets the hardest level)
- **Planned maturas**: Stats and the subject picker show the maturas from your setup; one without tasks yet says "Скоро"
- **Fairer skill map**: a wrong answer never raises mastery, and the first answers on a topic move it only a little, so one lucky or unlucky answer does not swing it
- **Training keeps 8 tasks**: the "twin" after a mistake takes the next place instead of making the session longer
- **Streak** counts days on which you finished a session; Stats, Profile and the CSV count only your own answers
- **Setup**: no Gemini step (set it up in Settings); the step counter moves one by one
- **Liquid glass**: an optional see-through look in Settings, over any theme
- **Feedback from the app**: Settings → "Изпрати обратна връзка"; it waits on the phone when offline and goes to a "feedback" tab of the teacher's Sheet (**redeploy `apps-script/Code.gs`**; the server needs `FEEDBACK_SCRIPT_URL`)
- **Android**: text follows the phone's font size
- **Past exams**: English titles for exams that are only in Bulgarian, a close button on results, essays need an answer before self-grading, the "wrong choice tasks" list shows only choice tasks
- **Text answers**: a whole-sentence answer is not wrong because of a capital letter, a final full stop or the quotation marks
- **Generated math**: every choice task has four options; Дебелянов: the right option now quotes the poem word for word
- **For later**: Firebase sign-in, roles and server-side timed tests (`functions/`, `firestore.rules`, see `docs/firebase.md`) and Gemini grading of free-text answers are in the code but not in the app yet

## 0.4.2
Also includes everything from 0.4.1 (past math exams in English), which was never released on its own.

- **Duolingo-style progress bar**: a green pill bar in the first-run setup that fills with a small bounce, shimmers and pops on the last step; tests use the same look but stay still. Follows the theme and turns off its animation when the phone asks for reduced motion
- **НВО 4. клас Математика 2007–2016**: 10 more past exams (170 questions) with the official keys
- **ДЗИ Математика 02.06.2020, вариант 2**: 28 tasks, 100 points, with 5 redrawn figures and the official solutions for tasks 26–28
- **Past math exams in English** (from 0.4.1): with the app in English, all 16 ДЗИ papers (2019–2026) and НВО 10 from 2021–2024 open in English; exams without a translation are marked **BG**

## 0.4.1
- **Past math exams in English**: with the app in English, 20 math exams open in English — all 16 ДЗИ papers (2019–2026) and НВО 10 from 2021–2024. Answers are checked against the same official key; your results are shared between the two languages
- The past-exam screens (list, task, check, result) are now translated too; an exam that has no English version yet is marked **BG** and stays in Bulgarian
- ДЗИ август 2021, task 24: "3 процента" counts again as a right answer in the English version (it had been changed to "3 procenta")
- `python tools/build.py check` now compares every English exam with its Bulgarian original: same tasks, points, pictures and key, and every Bulgarian text answer still accepted

## 0.4.0
Everything from the open branches in one version.

- **English**: Настройки → "Език · Language" (also the first screen of the setup) switches the app to English: menus, buttons, screen titles, the skill map, statistics, profile, forecast and setup. **Tasks, explanations and the names of typical mistakes stay in Bulgarian** — they are matura content and will be translated separately
- **Past exams**: real ДЗИ (математика, БЕЛ) and НВО 4, 7 and 10 papers, with redrawn figures and pictures, a run screen and a home button
- **Setup asks for age** and suggests the exam (НВО 7, НВО 10 or ДЗИ 12); for НВО 10 and ДЗИ it asks for the high-school profile (with an emoji each) and an optional extra matura, and shows which exams that means
- **Your progress is safe**: "Зареди демо ученик" asks first when you have real answers, keeps a copy, and Settings → "Върни моите отговори" brings them back
- **Broken or old saved data** no longer stops the app: every saved field is checked and repaired; a save that cannot be read at all is kept as a backup copy and the app says so
- **Google Sheets**: answers leave the phone only after the Sheet confirms them; errors keep them for the next try with a growing pause. The Apps Script skips rows it already has, so a retry never makes duplicates (**redeploy `apps-script/Code.gs`**)
- **Android: a ± button** next to number answers, because many phone keyboards have no minus
- **A question never repeats in one session** (also when the numbers look the same); a topic that runs out of new questions ends early instead of repeating them
- **Дебелянов**: 9 new tasks; explanations added to the 6 bank tasks that only showed the answer
- A quick double tap on "Провери" no longer skips the feedback; an ordering task can't be checked before you move anything
- The browser's back button no longer gets "stuck" and then suddenly leaves the app
- Confetti stays on the result screen instead of falling on the next one
- "Още няма грешки в тази тема" is no longer shown after wrong answers
- Settings refuse invalid values (Sheet and server addresses, model name, API key) and say why
- Quadratic equations: "$D=25--24$" is now "$D=25+24$" (a new check catches doubled signs in every generated task)
- Forecast: no grade until there are at least two answers per topic
- Added rules for AI agents (AGENTS.md)

## 0.3.1
- "Системна" theme now follows the phone's dark mode in the Android app (the app asks Android directly and updates when the phone switches); the window is dark while loading too
- Setup screens: no progress bar

## 0.3.0
- **First-run setup**: welcome, name and class, which matura first, theme, Gemini, teacher's Sheet. Saves each step, resumes if interrupted, and is never shown to people who already have answers. Back goes one step back; Settings can run it again
- **БЕЛ: ~560 new tasks** (spelling, articles, commas), each rule as "Кое е правилно?" and "Къде е грешката?"
- **Spaced review**: strong skills are rechecked after 1, 3, 7, 14, 30 days (Leitner boxes); a wrong answer starts over. The skill map shows when the next check is
- **Theme**: "Автоматично" is now "Системна"
- Language check of the new БЕЛ rows: removed rows whose comma rule is disputed ("според мен", "например", "следователно" at the start) and one unnatural phrase

## 0.2.0
- **Bottom menu**: Начало · Статистики · Профил. Back always returns to Начало
- **Статистики**: answers, accuracy, streak, the last 7 days, and a card per matura with where you lose the most points
- **Профил**: name, class, streak, strong skills, progress per matura. Name and class moved here from Settings
- **Прогнозиран резултат**: expected points out of 100, a range that narrows with every answer, and the grade on МОН's scale (30 / 41 / 62,5 / 84 points); tap it to see where points are won fastest
- **Subject as a dropdown** on Начало and on Грешки и данни
- **AMOLED theme**: true black for OLED screens, status and navigation bars included

## 0.1.0 (alpha, EduHack Plovdiv 2026)
- Skill map per subject (Математика, БЕЛ): how many matura points each skill probably costs you
- Diagnostic (one task per skill, a second one where the first was wrong)
- Focus training: only the 2–3 skills that cost the most points; strong skills are not repeated, only checked after 3 days
- Typical mistakes: every wrong option comes from one named mistake; a "twin" task follows a wrong answer
- Endless fresh math variants from seeded generators (7 skills × 3 levels)
- Gemini: explain my mistake, hint without the answer, new tasks for a weak skill, 5-day plan; through an API key or the Cloud Run server on Vertex AI
- Every answer as a row for Google Sheets → Looker Studio; CSV export; sample class of 28 learners
- Android APK and a single web page from the same code (Shelly's engine)
