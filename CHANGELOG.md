# Changelog

## 0.1.0 (alpha, EduHack Plovdiv 2026)
- Skill map per subject (Математика, БЕЛ): how many matura points each skill probably costs you
- Diagnostic (one task per skill, a second one where the first was wrong)
- Focus training: only the 2–3 skills that cost the most points; strong skills are not repeated, only checked after 3 days
- Typical mistakes: every wrong option comes from one named mistake; a "twin" task follows a wrong answer
- Endless fresh math variants from seeded generators (7 skills × 3 levels)
- Gemini: explain my mistake, hint without the answer, new tasks for a weak skill, 5-day plan; through an API key or the Cloud Run server on Vertex AI
- Every answer as a row for Google Sheets → Looker Studio; CSV export; sample class of 28 learners
- Android APK and a single web page from the same code (Shelly's engine)
