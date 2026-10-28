# Changelog

## 0.4.2
Also includes everything from 0.4.1 (past math exams in English), which was never released on its own.

- **Send feedback**: Settings → "Обратна връзка" opens a small form. Messages are sent to the BingO server; if you are offline, they stay safely on the device and are retried automatically later (**redeploy the Cloud Run server with `FEEDBACK_SCRIPT_URL`**)
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
- **Статистики**: answers, accuracy, streak, the last 7 days, a card per matura with where you lose the most points
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
