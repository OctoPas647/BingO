/* ================= App language: Български / English =================
   Only the app around the tasks is translated: menus, buttons, screen titles, the skill map,
   the forecast and the first-run setup. Tasks, explanations and the names of typical mistakes
   stay in Bulgarian (they are matura content; their translation is a separate job).
   The Bulgarian text is its own key: L('Начало') gives "Home" in English, and a missing
   entry simply shows the Bulgarian text. Values like {n} are filled in from `vars`.
   tools/check.js fails when an L('…') in src/js has no English entry here. */
const LANGS = [['bg', 'Български'], ['en', 'English']];
const appLang = () => (typeof S !== 'undefined' && S && S.settings && S.settings.lang === 'en' ? 'en' : 'bg');
function L(bg, vars) {
  let s = appLang() === 'en' && EN_UI[bg] != null ? EN_UI[bg] : bg;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
const ptsL = n => L('{n} т.', { n });

const EN_UI = {
  /* subjects, skills, statuses */
  'Математика': 'Mathematics', 'БЕЛ': 'Bulgarian', 'Матем.': 'Math',
  'Квадратни уравнения': 'Quadratic equations', 'Проценти': 'Percentages', 'Степени и корени': 'Powers and roots',
  'Линейни неравенства': 'Linear inequalities', 'Правоъгълен триъгълник': 'Right triangle', 'Аритметична прогресия': 'Arithmetic progression',
  'Вероятности': 'Probability', 'Пълен и кратък член': 'Full and short article', 'Запетая': 'Commas',
  'Слято, полуслято, разделно': 'Joined, hyphenated, separate', 'Литература: Дебелянов': 'Literature: Debelyanov',
  'Малко данни': 'Little data', 'Слабо': 'Weak', 'Почти': 'Almost', 'Силно': 'Strong',
  'Нов вариант': 'New variant', 'От Shelly': 'From Shelly', 'Банка задачи': 'Task bank', 'Създадена от ИИ': 'Made by AI',
  '{n} т.': '{n} pts',

  /* bottom menu */
  'Начало': 'Home', 'Статистики': 'Stats', 'Профил': 'Profile', 'Основно меню': 'Main menu',

  /* home */
  'Предмет за матура': 'Matura subject', 'Избери предмет за матура': 'Choose a matura subject',
  'Не се повтаря · ': 'Not repeated · ', 'Честа грешка: ': 'Common mistake: ', '{ok} от {n} верни': '{ok} of {n} right', 'Още не е измерено': 'Not measured yet',
  'Отговори досега': 'Answers so far', 'Грешки и данни': 'Mistakes and data', 'Настройки': 'Settings',
  'Матура · {s}': 'Matura · {s}', 'Губиш ≈ {a} от {b} т.': 'You lose ≈ {a} of {b} pts',
  'в тези теми на ДЗИ. Тренираме само там, където губиш най-много — силното не го повтаряме.': 'on these matura topics. We train only where you lose the most — what you know well is not repeated.',
  'Къде губиш точки?': 'Where do you lose points?',
  'Кратка диагностика (≈5 мин): по една задача за всяка тема. После тренираш само слабото.': 'A short diagnostic (≈5 min): one task per topic. Then you train only your weak spots.',
  'Тренирай слабото · 8 задачи': 'Train weak spots · 8 tasks', 'Започваме от <b>{s}</b> — там губиш най-много.': 'We start with <b>{s}</b> — that is where you lose the most.',
  'Всички теми са силни. Направи пробна матура в Shelly!': 'All topics are strong. Try a practice matura in Shelly!',
  'Започни диагностика': 'Start the diagnostic', 'Покажи с демо ученик': 'Show with a demo learner', 'Карта на уменията': 'Skill map', 'Нова диагностика': 'New diagnostic',
  '✦ Gemini е включен': '✦ Gemini is on', 'Без ИИ · включи Gemini в настройките': 'No AI · turn on Gemini in Settings',
  'данните отиват в Google Sheets': 'data goes to Google Sheets', 'данните остават на устройството': 'data stays on this device',
  'Зареден е демо ученик с история от 6 дни': 'Demo learner loaded with 6 days of history',
  'Овладяно ≈ <b>{p}</b> · {ok}/{n} верни · губиш ≈ <b>{lost}</b> от {w} т.': 'Mastered ≈ <b>{p}</b> · {ok}/{n} right · you lose ≈ <b>{lost}</b> of {w} pts',
  'как се променя увереността с всеки отговор': 'how the estimate changes with each answer', 'Твоите типични грешки': 'Your typical mistakes',
  '{k} грешен отговор, но без разпозната типична грешка — виж обясненията след задачите.': '{k} wrong answer, but no typical mistake recognised — see the explanations after the tasks.',
  '{k} грешни отговора, но без разпозната типична грешка — виж обясненията след задачите.': '{k} wrong answers, but no typical mistake recognised — see the explanations after the tasks.',
  'Още няма грешки в тази тема.': 'No mistakes in this topic yet.', 'Още няма отговори в тази тема.': 'No answers in this topic yet.',
  '„Овладяно“ е вероятността да решиш вярно нова задача от темата (Bayesian Knowledge Tracing). Тежестта {w} т. е приблизителна оценка за демото.': '"Mastered" is the chance that you solve a new task from this topic correctly (Bayesian Knowledge Tracing). The weight of {w} pts is a rough estimate for the demo.',
  'Затвори': 'Close', 'Тренирай само това': 'Train only this', 'Тренирай слабото': 'Train weak spots',
  'проверка днес': 'check today', 'проверка утре': 'check tomorrow', 'проверка след {d} дни': 'check in {d} days',

  /* session */
  'Диагностика': 'Diagnostic', 'Тренировка на слабото': 'Weak-spot training', 'Една тема': 'One topic', 'Затвори сесията': 'Close the session',
  'Всички теми са силни — няма какво да тренираме': 'All topics are strong — nothing to train', 'Няма нови задачи по тази тема': 'No new tasks for this topic',
  'Да спрем ли?': 'Stop here?', 'Отговорите досега вече са записани в картата на уменията.': 'Your answers so far are already saved in the skill map.', 'Спри': 'Stop',
  'Проверка на силно умение': 'Check of a strong skill', 'Близнак: същото, нови числа': 'Twin: same thing, new numbers', 'Ниво {n}': 'Level {n}',
  'Задачата е създадена от ИИ и може да има грешка.': 'This task was made by AI and may contain a mistake.', 'Докладвай грешка': 'Report a mistake',
  'Подсказка от Gemini': 'Hint from Gemini', 'без отговора': 'without the answer', 'Провери': 'Check', 'Напред': 'Next', 'Виж резултата': 'See the result',
  'Вярно!': 'Correct!', 'Не съвсем': 'Not quite', 'Типична грешка': 'Typical mistake', 'Грешка': 'Mistake', 'Виж решението по-долу.': 'See the solution below.',
  '✦ Защо сгреших? Обясни Gemini': '✦ Why was I wrong? Ask Gemini', '✦ Подсказка': '✦ Hint', 'Какво се обърка': 'What went wrong', 'Провери се:': 'Check yourself:',
  'Благодаря! Задачата е отбелязана за проверка от учител.': 'Thank you! The task is marked for a teacher to check.',
  'Картата е готова': 'Your map is ready', 'Върна си ≈ {n} т.': 'You won back ≈ {n} pts', 'Добра работа': 'Good work',
  'Сега губиш ≈ <b>{a}</b> от {b} т.': 'Now you lose ≈ <b>{a}</b> of {b} pts', '(преди: {n})': '(before: {n})',
  '{s} стана силно.': '{s} is now strong.', '{s} станаха силни.': '{s} are now strong.',
  'Спираме да го повтаряме — само кратки проверки, все по-рядко.': 'We stop repeating it — only short checks, less and less often.',
  'Спираме да ги повтаряме — само кратки проверки, все по-рядко.': 'We stop repeating them — only short checks, less and less often.',
  'Какво се промени': 'What changed', 'Към картата': 'To the map', 'Още 8 задачи': '8 more tasks',

  /* stats and profile */
  'Матура': 'Matura', '≈ {a} от {b} т. запазени': '≈ {a} of {b} pts kept', 'Още не е измерено — направи диагностика': 'Not measured yet — do the diagnostic',
  'отговора': 'answers', 'верни': 'right', 'средно време': 'average time', '{n} с': '{n} s',
  '{n} силни': '{n} strong', '{n} почти': '{n} almost', '{n} слаби': '{n} weak', '{n} малко данни': '{n} little data',
  'Къде губиш най-много': 'Where you lose the most', 'Отвори картата · {s}': 'Open the map · {s}',
  'дни поредни': 'day streak', 'активни дни': 'active days', 'Последните 7 дни': 'Last 7 days', 'По матури': 'By matura',
  'Нд': 'Su', 'Пн': 'Mo', 'Вт': 'Tu', 'Ср': 'We', 'Чт': 'Th', 'Пт': 'Fr', 'Сб': 'Sa',
  'Ученик': 'Learner', 'Клас {c}': 'Class {c}', 'Добави клас по-долу': 'Add your class below', 'Данни': 'Details', 'Име': 'Name', 'Клас': 'Class',
  'напр. Мария П.': 'e.g. Maria P.', 'напр. 12а': 'e.g. 12a',
  'Името и класът отиват при учителя само ако си свързал Google Sheets.': 'Your name and class reach the teacher only if you connected Google Sheets.',
  'Моят напредък': 'My progress', 'Поредни дни': 'Day streak', 'Отговори': 'Answers', '{n} верни': '{n} right', 'Тренировки': 'Training sessions',
  'Силни умения': 'Strong skills', '{a} от {b}': '{a} of {b}', 'запазени ≈ {a} от {b} т.': 'kept ≈ {a} of {b} pts', 'още не е измерено': 'not measured yet',
  'Моите отговори (CSV)': 'My answers (CSV)',

  /* forecast */
  'Отличен 6': 'Excellent 6', 'Мн. добър 5': 'Very good 5', 'Добър 4': 'Good 4', 'Среден 3': 'Average 3', 'Слаб 2': 'Poor 2',
  'Малко данни — диапазонът е широк, оценка още не показваме': 'Little data — the range is wide, no grade yet', 'Средна сигурност': 'Medium certainty', 'Добра сигурност': 'Good certainty',
  'Оценка — след още няколко отговора': 'Grade — after a few more answers', 'Прогнозен резултат · {s}': 'Forecast score · {s}', 'Прогноза': 'Forecast', 'Прогноза · {s}': 'Forecast · {s}',
  'Направи диагностика и ще видиш колко точки очакваш на матурата.': 'Do the diagnostic to see how many points you can expect on the matura.',
  'от 100 т.': 'of 100 pts', 'Диапазон {a}–{b} т. · {c} · натисни за подробности': 'Range {a}–{b} pts · {c} · tap for details',
  '<b>≈ {n} т.</b> от 100 <span class="muted">(най-вероятно между {a} и {b})</span>': '<b>≈ {n} pts</b> of 100 <span class="muted">(most likely between {a} and {b})</span>',
  'Още е рано за оценка: имаш {a} отговора в {b} теми. След още няколко тренировки прогнозата ще покаже и оценка.': 'Too early for a grade: you have {a} answers in {b} topics. After a few more sessions the forecast will show a grade too.',
  'До <b>{g}</b> ти трябват още ≈ <b>{n} т.</b>': 'You need ≈ <b>{n} more pts</b> for <b>{g}</b>', 'Това е най-високата оценка.': 'This is the highest grade.',
  'Къде се печелят най-бързо точки': 'Where points are won fastest', 'Ако темата стане силна (≥ 90%).': 'If the topic becomes strong (≥ 90%).',
  'Скала за оценяване (МОН)': 'Grading scale (Ministry of Education)', 'под 30 т.': 'below 30 pts', 'от {n} т.': 'from {n} pts',
  'Прогнозата е ориентировъчна. Тя се смята от владеенето на {n} теми в приложението ({m} вече са измерени) и не вижда останалата част от изпита, напр. писането на есе или съчинение. Повече отговори дават по-тесен диапазон. Тежестите на темите са приблизителни.': 'The forecast is a rough guide. It comes from your mastery of {n} topics in the app ({m} measured so far) and cannot see the rest of the exam, e.g. writing an essay. More answers give a narrower range. The topic weights are approximate.',

  /* mistakes and data */
  'Типичните ти грешки · {s}': 'Your typical mistakes · {s}',
  'Всяка грешна опция в задачите идва от една конкретна типична грешка, затова виждаме не само <i>че</i> грешиш, а <i>как</i>.': 'Every wrong option in a task comes from one specific typical mistake, so we see not only <i>that</i> you are wrong but <i>how</i>.',
  'Имаш грешни отговори, но без разпозната типична грешка — виж обясненията след задачите.': 'You have wrong answers, but no typical mistake was recognised — see the explanations after the tasks.',
  'Още няма грешки.': 'No mistakes yet.', 'Още няма отговори. Направи диагностика.': 'No answers yet. Do the diagnostic.',
  '{a} отговора · {b} верни': '{a} answers · {b} right', '✦ План за седмицата от Gemini': '✦ Week plan from Gemini',
  'Gemini прави 5-дневен план само върху слабите места, по 20 минути на ден.': 'Gemini makes a 5-day plan on your weak spots only, 20 minutes a day.',
  'Включи Gemini в настройките, за да получиш план.': 'Turn on Gemini in Settings to get a plan.', 'Направи план': 'Make a plan', 'Нов план': 'New plan',
  'Данни за учителя (Looker Studio)': 'Data for the teacher (Looker Studio)',
  'Всеки отговор е един ред: ученик, клас, тема, вярно/грешно, типична грешка, време, увереност преди и след. Учителят вижда целия клас в Looker Studio.': 'Every answer is one row: learner, class, topic, right/wrong, typical mistake, time, mastery before and after. The teacher sees the whole class in Looker Studio.',
  '{n} чакат': '{n} waiting', 'изпратено': 'sent', 'не е свързан': 'not connected', 'Изпрати сега': 'Send now',
  'Примерен клас от 28 ученика (CSV)': 'Sample class of 28 learners (CSV)', 'Отвори Looker Studio': 'Open Looker Studio',
  'Докладвани ИИ задачи': 'Reported AI tasks', '{n} задачи чакат проверка от учител.': '{n} tasks are waiting for a teacher to check.', 'Изтегли (JSON)': 'Download (JSON)',
  'В Looker Studio: <b>Create → Data source → Google Sheets</b> (или File upload за CSV), после таблица „умение × ученик“ със средно <code>mastery_after</code> и стълбова диаграма на <code>misconception</code>. Подробно — в README.': 'In Looker Studio: <b>Create → Data source → Google Sheets</b> (or File upload for a CSV), then a "skill × learner" table with the average <code>mastery_after</code> and a bar chart of <code>misconception</code>. Details in the README.',
  'Изпратено към Google Sheets': 'Sent to Google Sheets', 'Няма връзка — ще опитаме пак': 'Could not send — we will try again',

  /* settings */
  'Език': 'Language', 'Езикът сменя менютата и бутоните. Задачите остават на български.': 'The language changes menus and buttons. Tasks stay in Bulgarian.',
  'Изключен': 'Off', 'API ключ': 'API key', 'Vertex AI сървър': 'Vertex AI server', 'Gemini API ключ': 'Gemini API key', 'от aistudio.google.com': 'from aistudio.google.com',
  'Ключът стои само на това устройство. За прототип е добре; за истински ученици ползвай сървъра (Vertex AI).': 'The key stays on this device only. Fine for a prototype; for real learners use the server (Vertex AI).',
  'Адрес на сървъра (Cloud Run)': 'Server address (Cloud Run)', 'Модел': 'Model', 'Провери връзката': 'Test the connection',
  'Gemini обяснява грешките, дава подсказки без отговора, прави нови задачи за слабите теми и седмичен план. Без него приложението работи изцяло.': 'Gemini explains mistakes, gives hints without the answer, makes new tasks for weak topics and a week plan. The app works fully without it.',
  'Адрес на Apps Script (Web app)': 'Apps Script address (Web app)',
  'Всеки отговор става ред в таблица на учителя. Как се прави — apps-script/Code.gs в проекта.': 'Every answer becomes a row in the teacher\'s Sheet. How to set it up: apps-script/Code.gs in the project.',
  'Тема': 'Theme', 'Системна': 'System', 'Светла': 'Light', 'Тъмна': 'Dark',
  '„Системна“ следва светлата или тъмната тема на телефона.': '"System" follows the phone\'s light or dark theme.', 'Звуци': 'Sounds', 'Демо': 'Demo',
  'Зареди демо ученик': 'Load a demo learner', 'Върни моите отговори': 'Bring back my answers', 'Начална настройка отново': 'Run the first-time setup again',
  'Изчисти всичките ми отговори': 'Clear all my answers', 'За BingO': 'About BingO',
  'alpha · подготовка за матура без зубрене: работа върху слабите места, не повтаряне на силните.': 'alpha · matura prep without cramming: work on weak spots, don\'t repeat the strong ones.',
  'Построено върху Shelly (задачи, точкуване, модули) и идеи от BrainBurst, BandUp и SQL Practice. EduHack Plovdiv 2026.': 'Built on Shelly (tasks, scoring, modules) and ideas from BrainBurst, BandUp and SQL Practice. EduHack Plovdiv 2026.',
  'Зареден е демо ученик': 'Demo learner loaded', 'Твоите отговори са върнати': 'Your answers are back', 'Копието не може да се прочете': 'The copy cannot be read',
  'Да изчистим ли всичко?': 'Clear everything?', 'Картата на уменията и всички отговори на това устройство ще се изтрият.': 'The skill map and all answers on this device will be deleted.',
  'Изчисти': 'Clear', 'Изчистено': 'Cleared', 'Работи! {m}': 'It works! {m}', 'Не стана: {e}': 'That did not work: {e}',
  'Ключът не може да съдържа интервали': 'The key cannot contain spaces', 'Само латински букви, цифри, точка и тире (напр. gemini-3.8-flash)': 'Only Latin letters, digits, dot and dash (e.g. gemini-3.8-flash)',
  'Адресът трябва да започва с https://': 'The address must start with https://', 'Адресът трябва да започва с https://script.google.com/': 'The address must start with https://script.google.com/',
  'Невалидна стойност': 'Invalid value', 'Задължително поле': 'Required field', 'Невалидната стойност не е запазена': 'The invalid value was not saved',

  /* demo and saved data */
  'Да заредим ли демо ученик?': 'Load a demo learner?',
  'Демото заменя картата на уменията и отговорите ти. Ще пазим копие на твоите данни и можеш да ги върнеш от Настройки → „Върни моите отговори“.': 'The demo replaces your skill map and answers. We keep a copy of your data, and you can bring it back from Settings → "Bring back my answers".',
  'Зареди демото': 'Load the demo', 'Няма място за копие на данните ти — демото не е заредено.': 'No room for a copy of your data — the demo was not loaded.',
  'Запазените данни не можаха да се прочетат': 'Your saved data could not be read',
  'Файлът с отговорите ти на това устройство е повреден, затова BingO започва начисто.': 'The file with your answers on this device is damaged, so BingO starts fresh.',
  'Старите данни не са изтрити — запазени са като резервно копие ({k}).': 'The old data was not deleted — it is kept as a backup ({k}).',
  'Резервно копие не можа да се запише (няма място).': 'A backup could not be saved (no room).', 'Разбрах': 'OK',

  /* first-run setup */
  'Добре дошъл в BingO': 'Welcome to BingO',
  'Няколко кратки въпроса и приложението е готово. Всичко може да се промени по-късно в Профил и Настройки.': 'A few short questions and the app is ready. Everything can be changed later in Profile and Settings.',
  'Кой си ти?': 'Who are you?', 'Името и класът са по желание. Учителят ги вижда само ако свържеш Google Sheets.': 'Name and class are optional. The teacher sees them only if you connect Google Sheets.',
  'Най-много 40 знака': 'At most 40 characters', 'Адресът трябва да е от script.google.com': 'The address must be on script.google.com', 'Най-много 10 знака': 'At most 10 characters',
  /* past exams (66-past.js) */
  'Изпити от минали години': 'Past exams', 'Задачите са както на изпита; отговорите се проверяват по официалния ключ.': 'The tasks are as they were on the exam; answers are checked against the official key.',
  'Изпитите без английски превод са на български.': 'Exams marked BG have no English translation yet.',
  '{n} задачи · {p} т.': '{n} tasks · {p} pts', ' · последно: {p} т.': ' · last: {p} pts', 'Резултатът от този изпит няма да се запази.': 'The result of this exam will not be saved.',
  'Задача {n} · {p} т.': 'Task {n} · {p} pts', 'Виж отговора': 'See the answer', 'Оцени се сам': 'Mark it yourself', 'по официалния отговор и критериите': 'using the official answer and criteria',
  'Отчасти': 'Partly', '{a} от {b} т.': '{a} of {b} pts', 'По скалата на МОН:': 'On the Ministry of Education scale:', 'Сгрешени задачи с избор:': 'Wrong multiple-choice tasks:', 'Отначало': 'Start over',
  /* setup: age, exam, high-school profile, extra matura */
  'Името и годините са по желание. Учителят вижда името само ако свързал Google Sheets.': 'Name and age are optional. Your teacher sees the name only if you connect Google Sheets.',
  'Име и фамилия': 'Full name', 'напр. Мария Петрова': 'e.g. Maria Petrova', 'Години': 'Age', 'напр. 17': 'e.g. 17', 'Въведи години от 7 до 99': 'Enter an age from 7 to 99',
  'Значи за {e}, нали?': 'So it is {e}, right?', 'За кой изпит се готвиш?': 'Which exam are you preparing for?', 'Ако не е така, избери своя клас.': 'If not, choose your grade.', 'Избери изпит': 'Choose an exam',
  'НВО 4-ти клас': 'NVO, 4th grade', 'НВО 7-ми клас': 'NVO, 7th grade', 'НВО 10-ти клас': 'NVO, 10th grade', 'ДЗИ 12-ти клас': 'Matura (DZI), 12th grade',
  'Какъв е профилът ти?': 'What is your school profile?', 'Избери профил': 'Choose a profile',
  'НВО в 10-ти клас е еднакво за всички, но профилът решава коя ще е втората ти матура в 12-ти клас.': 'The 10th-grade NVO is the same for everyone, but your profile decides your second matura in 12th grade.',
  'Профилът решава коя може да е втората ти матура.': 'Your profile decides what your second matura can be.',
  'Допълнителна матура?': 'An extra matura?', 'Освен двете задължителни можеш да се явиш и на допълнителна матура. Пропусни, ако нямаш.': 'Besides the two required ones you can also take an extra matura. Skip this if you don\'t have one.',
  ' (скоро)': ' (soon)',
  'Математически': 'Mathematics', 'Софтуерни и хардуерни науки': 'Software and hardware sciences', 'Природни науки': 'Natural sciences', 'Икономическо развитие': 'Economic development',
  'Предприемачески': 'Entrepreneurship', 'Чужди езици': 'Foreign languages', 'Хуманитарни науки': 'Humanities', 'Обществени науки': 'Social sciences',
  'Изобразително изкуство': 'Fine arts', 'Музика': 'Music', 'Физическо възпитание и спорт': 'Physical education and sport', 'Професионална гимназия': 'Vocational school',
  'Коя матура първо?': 'Which matura first?', 'Можеш да сменяш предмета по всяко време от началния екран.': 'You can switch the subject any time on the Home screen.', 'Избери матура': 'Choose a matura',
  'Как да изглежда?': 'How should it look?', 'Избери тема': 'Choose a theme',
  'Gemini (по желание)': 'Gemini (optional)', 'Обяснява грешките и дава подсказки без отговора. Без него приложението работи изцяло.': 'Explains mistakes and gives hints without the answer. The app works fully without it.',
  'Свързване с учител (по желание)': 'Connect to a teacher (optional)',
  'Ако учителят ти е дал адрес на Apps Script, постави го тук. Иначе пропусни.': 'If your teacher gave you an Apps Script address, paste it here. Otherwise skip.',
  'Готово!': 'Done!', 'Започни с кратка диагностика, за да видим къде губиш най-много точки.': 'Start with a short diagnostic so we can see where you lose the most points.',
  'Назад': 'Back', 'Избери език': 'Choose a language', 'Избери режим': 'Choose a mode', 'Към BingO': 'To BingO', 'Пропусни': 'Skip'
};

/* toasts and sheet titles/buttons go through L() automatically */
if (typeof toast === 'function') { const _toastL = toast; toast = (msg, kind) => _toastL(L(msg), kind); }
if (typeof sheet === 'function') { const _sheetL = sheet; sheet = opt => _sheetL({ ...opt, title: opt.title && L(opt.title), actions: (opt.actions || []).map(a => ({ ...a, label: L(a.label) })) }); }
