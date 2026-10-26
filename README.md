# BingO — матура без зубрене

**Работа върху слабите места, не повтаряне на силните.**
Alpha версия за EduHack Plovdiv 2026 (тема „Подготовка за матура без зубрене“, 16–18 г., Образователни иновации).

BingO мери всяко умение от матурата поотделно, показва **колко точки на ДЗИ губиш** от всяко, и те тренира **само там, където губиш най-много**. Силното спира да се повтаря — само кратка проверка след 3 дни. Задачите по математика се генерират наново всеки път, така че отговорите не могат да се наизустят.

| Какво | Файл |
|---|---|
| Android | [`downloads/BingO-0.4.0.apk`](downloads/BingO-0.4.0.apk) |
| Уеб версия (един файл, работи и офлайн) | [`downloads/BingO-web.html`](downloads/BingO-web.html) |
| Примерни данни за клас (Looker Studio) | `data/sample-class.csv` |

## Как работи

1. **Диагностика** (≈5 мин): по една задача за всяко умение; където сгрешиш — още една, за да сме сигурни.
2. **Карта на уменията**: за всяко умение вероятността да го владееш (Bayesian Knowledge Tracing) и колко точки вероятно губиш: `тежест на умението × (1 − владеене)`.
3. **Тренировка на слабото**: 8 задачи от 2–3-те умения, които струват най-много точки, разбъркани (така учиш да разпознаваш *кой* метод трябва). Силните умения не влизат.
4. **Типична грешка**: всеки грешен отговор идва от конкретна грешка („процентът е събран като число“, „знакът не е обърнат при деление на отрицателно“). Приложението казва *как* си сгрешил, не само *че* си сгрешил.
5. **Близнак**: след грешка веднага идва същата задача с нови числа, за да поправиш грешката, докато е прясна.
6. **Gemini** (по желание): обяснява *твоята* грешка, дава подсказка **без** отговора, създава нови задачи, насочени към твоите грешки, и прави 5-дневен план.
7. **Учителят** вижда целия клас в **Looker Studio**: кои умения и кои грешки струват най-много точки на класа.

## Google инструменти

| Инструмент | За какво | Къде в кода |
|---|---|---|
| **Gemini API** | обяснение на грешка, подсказка без отговор, нова задача, седмичен план | `src/js/54-ai.js` |
| **Vertex AI** (+ Cloud Run) | същото, но през сървър с кредитите на отбора — ключът не стига до телефона | `server/` |
| **Google Sheets + Apps Script** | всеки отговор става ред в таблицата на учителя | `apps-script/Code.gs`, `src/js/55-sync.js` |
| **Looker Studio** | табло за учителя върху таблицата | виж по-долу |

### 1. Gemini с API ключ (най-бързо, за демото)
1. Вземи ключ от [Google AI Studio](https://aistudio.google.com/).
2. BingO → Настройки → Gemini → **API ключ** → постави ключа → „Провери връзката“.
Моделът по подразбиране е `gemini-3.8-flash` (сменя се в настройките).

### 2. Vertex AI сървър (Cloud Run) — за истински ученици
```bash
cd server
gcloud run deploy bingo-ai --source . --region europe-west1 --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=<проект>,GOOGLE_CLOUD_LOCATION=global,ALLOWED_ORIGINS=*
```
Дай на service account-а на Cloud Run ролята **Vertex AI User**. После в BingO → Настройки → Gemini → **Vertex AI сървър** → адреса на услугата.
Сървърът има лимит 30 заявки/мин на IP и пуска само разрешените модели (`ALLOWED_MODELS`).

### 3. Google Sheets → Looker Studio
1. Нова Google таблица → Extensions → Apps Script → постави `apps-script/Code.gs` → Deploy → Web app (Execute as: Me, Who has access: Anyone) → копирай адреса.
2. BingO → Настройки → Google Sheets → постави адреса. Отговорите отиват в лист `answers`.
   Ако вече имаш стар deploy: постави новия `Code.gs` и направи **Deploy → Manage deployments → Edit → New version**. Новата версия пропуска повторно изпратени редове, така че приложението може спокойно да опитва пак при грешка.
3. [Looker Studio](https://lookerstudio.google.com/) → Create → Data source → Google Sheets → таблицата (или **File upload** → `data/sample-class.csv`, ако още няма истински данни).
4. Табло (≈15 мин):
   - **Таблица с топлинна карта**: редове `student`, колони `skill`, стойност `mastery_after` (Average) → кой ученик къде е слаб.
   - **Стълбова диаграма**: измерение `misconception`, метрика Record Count, филтър `correct = 0` → най-честите грешки в класа.
   - **Време**: `timestamp` (по ден) × Average `correct` → дали класът напредва.
   - **Контроли**: филтри за `class` и `subject`.

Колони: `timestamp, student_id, student, class, subject, skill_id, skill, level, correct, misconception_code, misconception, source, seconds, hints, mastery_before, mastery_after, mode, session_id, task_id`.

## Построено върху моите приложения
- **Shelly** — двигателят: формат на модулите, проверка на отговори, точкуване, rich text + KaTeX, изгледите на 8-те типа задачи, Android обвивката и шрифтът Sofia Sans (`engine/`). Задачите от матурните модули на Shelly влизат директно в банката.
- **BrainBurst** — идеята за генератори със seed: безкрайно нови варианти, всеки грешен отговор обяснен.
- **BandUp** — Duolingo-подобният ритъм: една задача, проверка, обратна връзка.
- **SQL Practice** — стълбицата от подсказки (всяка подсказка намалява стойността на задачата).

## Структура
```
engine/        Shelly (копие; commit в engine/SHELLY_COMMIT)
src/js/        BingO: 50 state · 51 умения и модел · 52 генератори · 53 банка БЕЛ · 54 Gemini · 55 Sheets/CSV · 56 демо · 60–63 екрани
src/css/       стилове върху тези на Shelly
content/       матурните модули на Shelly (математика, БЕЛ)
server/        Cloud Run + Vertex AI
apps-script/   Google Sheets приемник
platforms/     Android обвивка (WebView)
tools/         build.py, check.js (3000+ генерирани задачи се проверяват при всеки build)
tests/         play.py (играе приложението в браузър), fixes.py (поправките от 0.3.2), ai_mock.py (Gemini пътищата с фалшив Gemini)
```

## Build
| Цел | Команда |
|---|---|
| Уеб страница | `python tools/build.py web` |
| Преглед на живо | `python tools/build.py serve` → http://localhost:8000 |
| Проверки | `python tools/build.py check` (Node 18+) |
| APK | `python tools/build.py android` (JDK 17+, Android SDK: build-tools 35, platform 34) |
| Примерен клас | `python tools/build.py classcsv` |

**Подписване на APK:** първият build създава ключ в `platforms/android/signing/`. Пази го и не го качвай в GitHub — всяко обновяване трябва да е подписано със същия ключ. За автоматичен build в GitHub: zip-ни `bingo.keystore` + `signing.json` в `signing.zip` и запиши base64 текста му като secret `BINGO_SIGNING`.

**Уебсайт (автоматично):** при всеки push в `main` GitHub качва новата уеб версия на сайта (напр. https://preotkrivanegk.com/bingo/).
1. cPanel → **FTP Accounts** → нов акаунт, Directory: `public_html/bingo` (така акаунтът вижда само папката на BingO).
2. GitHub → Settings → Secrets and variables → Actions → добави `FTP_HOST` (напр. `ftp.preotkrivanegk.com`), `FTP_USER` (целият потребител, напр. `bingo@preotkrivanegk.com`) и `FTP_PASSWORD`.
3. `FTP_DIR` е по желание — само ако FTP акаунтът започва от друга папка (напр. `public_html/bingo`).
Без тези secrets build-ът работи както преди, просто не качва нищо.

## Честно за alpha-та
- Тежестите на уменията (колко точки от ДЗИ зависят от всяко) са **приблизителни** и трябва да се сверят със спецификацията на МОН.
- Математиката има 7 умения × 3 нива генератори; БЕЛ има ръчна банка (≈580 задачи: правопис, членуване, запетая) + задачите от Shelly + Gemini. Литературата засега идва от Shelly и Gemini.
- Задачите от Gemini са означени „Създадена от ИИ“ и имат бутон „Докладвай грешка“.
- BingO не разпознава емоции, не оценява ученика официално и не решава нищо вместо учителя — оценката „владеене“ е видима и обяснена (в съответствие с AI Act).
