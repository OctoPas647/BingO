# Changelog

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
