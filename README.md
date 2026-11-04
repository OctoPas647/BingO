# BingO — матура без зубрене

**Работа върху слабите места, не повтаряне на силните.**
Alpha версия за EduHack Plovdiv 2026 (тема „Подготовка за матура без зубрене“, 16–18 г., Образователни иновации).

BingO мери всяко умение от матурата поотделно, показва **колко точки на ДЗИ губиш** от всяко, и те тренира **само там, където губиш най-много**. Силното спира да се повтаря — само кратка проверка след 3 дни. Задачите по математика се генерират наново всеки път, така че отговорите не могат да се наизустят.

| Какво | Файл |
|---|---|
| Android | [последната версия в Releases](https://github.com/OctoPas647/BingO/releases/latest) |
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

## BingO за учители (0.7.0)

При първото пускане приложението пита **„Учител или ученик?“**. Учителят влиза с Google и получава отделна част (на лаптоп — странично меню):

- **Класове** — код от 6 знака, QR код, покана по имейл, CSV или внасяне от Google Classroom
- **Тестове** — всички видове задачи (и снимка на ръкописно решение), от банката на BingO и минали НВО/ДЗИ, от Gemini по тема, от PDF/снимка/Google Doc, от Google Forms
- **Тест на живо** — виждате на кой въпрос е всеки ученик, какво пише в момента, верни/грешни, време, кой е излязъл от теста; пауза, +5 мин, заключване, край. Има и **куиз на проектора** с класиране
- **Оценяване** — затворените въпроси се проверяват на сървъра; отворените и снимките — от Gemini (предлага или оценява сам), по вашата рубрика и вашия стил
- **Анализ** — по въпроси, по ученици, дневник, слабите умения на класа от ежедневните упражнения; CSV, Excel, PDF, Google Sheets
- **График** — календар, повтарящи се домашни, Google Calendar; **Асистент** с Gemini

Учениците имат раздел **„Клас“**: тестове на живо, домашни, резултати. Настройка на Firebase: [`docs/firebase.md`](docs/firebase.md).

## Google инструменти

| Инструмент | За какво | Къде в кода |
|---|---|---|
| **Gemini** (облак, през сървъра на BingO) | нови задачи за всеки предмет в стила на МОН, подобни на сгрешените, обяснение на грешка, подсказка без отговор, проверка на свободни отговори, седмичен план, бележка след тренировка | `src/js/54-ai.js`, `server/` |
| **Gemini Nano** (на устройството) | мигновена подсказка, първа оценка на свободен отговор, проверка на задачите на Gemini, работа без интернет | `src/js/54c-nano.js`, `platforms/android/java/app/shelly/NanoBridge.java` |
| **Cloud Run** (+ Gemini API ключ или Vertex AI) | държи ключа — той **никога** не е в приложението | `server/` |
| **Google Sheets + Apps Script** | всеки отговор става ред в таблицата на учителя | `apps-script/Code.gs`, `src/js/55-sync.js` |
| **Looker Studio** | табло за учителя върху таблицата | виж по-долу |

### 1. Сървърът с Gemini (веднъж)
В приложението **няма ключ** и ученикът никога не пише ключ. Ключът е само на сървъра:
```bash
# ключът от Google AI Studio отива в Secret Manager, не в кода
printf '%s' 'ТВОЯТ_GEMINI_КЛЮЧ' | gcloud secrets create gemini-api-key --data-file=-
cd server
gcloud run deploy bingo-ai --source . --region europe-west1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest --set-env-vars ALLOWED_ORIGINS=*
```
(Без `GEMINI_API_KEY` сървърът ползва Vertex AI с правата на service account-а — дай му ролята **Vertex AI User** и добави `GOOGLE_CLOUD_PROJECT=<проект>`.)
Сървърът има лимит 30 заявки/мин и 400 на ден за IP (`DAILY_LIMIT`), моделът се сменя с `GEMINI_MODEL`.

После адресът на услугата (`https://bingo-ai-….run.app`) отива в build-а:
- GitHub → Settings → Secrets and variables → Actions → **Variables** → `BINGO_AI_SERVER` = адреса, или
- `tools/config.json` → `"aiServer": "https://bingo-ai-….run.app"` (за build на твоя компютър).

### 2. Gemini Nano на устройството
- **Android**: на телефони с Gemini Nano (AICore — напр. Xiaomi 17 Ultra, Pixel 9/10, Galaxy S25) BingO го ползва сам; ако моделът още не е свален, Настройки → Изкуствен интелект → „Изтегли Gemini Nano“. На телефони без Nano тази част просто не се показва.
- **Уеб**: в Chrome с вградения Gemini Nano (Prompt API). В други браузъри — само облакът.

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

## Всички матури (0.6.0)
Освен Математика и БЕЛ: История, Биология, Химия, Физика, География, Философия, ИТ, Информатика, Предприемачество, Изобразително изкуство, Музика и чуждите езици (английски, немски, руски, френски, испански, италиански — частта „четене“). Задачите са от изпитите на МОН (папката „dzi and other“ в Google Drive), с официалния ключ:
```bash
pdftotext -layout изпит.pdf изпит.txt                 # за всеки PDF
python tools/import_dzi.py <папка с .txt>             # -> content/past-exams/dzi12-<предмет>-<дата>.json
node tools/import_english.js ../BrainBurst ../BandUP  # -> content/english-bank.json
```
Темите (уменията) на всеки предмет са в `content/subjects.json`. Задачи с картинка, карта, схема или аудио се пропускат — приложението не може да ги покаже вярно.

## Структура
```
engine/        Shelly (копие; commit в engine/SHELLY_COMMIT)
src/js/        BingO: 50 state · 51 умения и модел · 52 генератори · 53 банка БЕЛ · 54 Gemini · 54c Gemini Nano · 55 Sheets/CSV · 56 демо · 60–66 екрани · 61b преговор на грешките · 66b всички задачи в тренировката · 68 анимации
src/css/       стилове; zz-ios.css е iOS видът с Liquid glass
src/fonts/     Inter (близо до SF на Apple, с кирилица)
src/css/       стилове върху тези на Shelly
content/       матурните модули на Shelly, изпитите от минали години (всички предмети), subjects.json, english-bank.json
server/        Cloud Run + Vertex AI
apps-script/   Google Sheets приемник
platforms/     Android обвивка (WebView) — Gradle проект с Gemini Nano (ML Kit GenAI)
tools/         build.py, check.js (3000+ генерирани задачи се проверяват при всеки build)
tests/         play.py (играе приложението в браузър), fixes.py (поправките от 0.3.2 до 0.5.0), ai_mock.py (Gemini пътищата с фалшив Gemini)
functions/     Firebase: роли и тестове с оценяване на сървъра (още не са в приложението, виж docs/firebase.md)
```

## Build
| Цел | Команда |
|---|---|
| Уеб страница | `python tools/build.py web` |
| Преглед на живо | `python tools/build.py serve` → http://localhost:8000 |
| Проверки | `python tools/build.py check` (Node 18+) |
| APK | `python tools/build.py android` (JDK 17+, Android SDK: platform 36, build-tools 35; Gradle идва с `platforms/android/gradlew`) |
| Примерен клас | `python tools/build.py classcsv` |

**Подписване на APK:** първият build създава ключ в `platforms/android/signing/`. Пази го и не го качвай в GitHub — всяко обновяване трябва да е подписано със същия ключ. За автоматичен build в GitHub: zip-ни `bingo.keystore` + `signing.json` в `signing.zip` и запиши base64 текста му като secret `BINGO_SIGNING`.

**Уебсайт (автоматично):** при всеки push в `main` GitHub качва новата уеб версия на сайта (напр. https://preotkrivanegk.com/bingo/).
1. cPanel → **FTP Accounts** → нов акаунт, Directory: `public_html/bingo` (така акаунтът вижда само папката на BingO).
2. GitHub → Settings → Secrets and variables → Actions → добави `FTP_HOST` (напр. `ftp.preotkrivanegk.com`), `FTP_USER` (целият потребител, напр. `bingo@preotkrivanegk.com`) и `FTP_PASSWORD`.
3. `FTP_DIR` е по желание — само ако FTP акаунтът започва от друга папка (напр. `public_html/bingo`).
Без тези secrets build-ът работи както преди, просто не качва нищо.

## Честно за alpha-та
- Тежестите на уменията (колко точки от ДЗИ зависят от всяко) са **приблизителни** и трябва да се сверят със спецификацията на МОН.
- Математиката има 11 умения (генератори + истински задачи от НВО/ДЗИ + Gemini); БЕЛ има ръчна банка + задачите от Shelly и от минали изпити + Gemini. Другите матури идват от изпитите на МОН и Gemini.
- Темите на импортираните въпроси са определени по ключови думи (`content/subjects.json`) — някой въпрос може да е в съседна тема.
- Задачите от Gemini са означени „Създадена от ИИ“ и имат бутон „Докладвай грешка“.
- BingO не разпознава емоции, не оценява ученика официално и не решава нищо вместо учителя — оценката „владеене“ е видима и обяснена (в съответствие с AI Act).
