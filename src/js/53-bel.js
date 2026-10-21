/* ================= Task banks: БЕЛ items, and the tasks of the Shelly matura modules =================
   БЕЛ is harder to generate from a formula, so it has a hand-written bank (each wrong option
   names its mistake), plus the lesson tasks of Shelly's two matura modules, plus new tasks from
   Gemini when AI is switched on. */

const BEL_BANK = [
  /* ---------- пълен и кратък член ---------- */
  { id: 'b:art1', skill: 'art', level: 1, type: 'choice', prompt: 'Изберете правилно написаното изречение.',
    options: ['Новият учител влезе в класа.', 'Новия учител влезе в класа.'], answer: 0, misc: [null, 'art.subj'],
    explain: '„Новият учител“ е подлог (кой влезе?), затова се пише с **пълен член**.' },
  { id: 'b:art2', skill: 'art', level: 1, type: 'choice', prompt: 'Изберете правилно написаното изречение.',
    options: ['Поздравихме победителят от състезанието.', 'Поздравихме победителя от състезанието.'], answer: 1, misc: ['art.obj', null],
    explain: '„Победителя“ е допълнение (кого поздравихме?), затова е с **кратък член**.' },
  { id: 'b:art3', skill: 'art', level: 2, type: 'choice', prompt: 'В кое изречение членуването е **правилно**?',
    options: ['Той е най-добрия ученик в класа.', 'Той е най-добрият ученик в класа.', 'Най-добрия ученик в класа е той.'], answer: 1, misc: ['art.pred', null, 'art.pred'],
    explain: '„Най-добрият ученик“ е **сказуемно определение** (след „е“), а то се членува с пълен член, както подлогът.' },
  { id: 'b:art4', skill: 'art', level: 2, type: 'choice', prompt: 'Изберете правилно написаното изречение.',
    options: ['Говорихме за филмът цяла вечер.', 'Говорихме за филма цяла вечер.'], answer: 1, misc: ['art.obj', null],
    explain: 'След предлог („за филма“) думата не е подлог, затова е с **кратък член**.' },
  { id: 'b:art5', skill: 'art', level: 3, type: 'choice', prompt: 'В кое изречение **има грешка** в членуването?',
    options: ['Председателят на журито обяви резултатите.', 'Учителят похвали ученика, който реши задачата.', 'Писмото беше изпратено от директорът.', 'Отборът спечели купата.'], answer: 2, misc: ['art.obj', 'art.obj', null, 'art.obj'],
    why: ['Тук няма грешка: „председателят“ е подлог.', 'Тук няма грешка: „ученика“ е допълнение.', null, 'Тук няма грешка: „отборът“ е подлог.'],
    explain: '„От директора“: в страдателна конструкция извършителят е с предлог, не е подлог, затова е с **кратък член**.' },
  { id: 'b:art6', skill: 'art', level: 3, type: 'choice', prompt: 'Изберете правилно написаното изречение.',
    options: ['Победител в конкурса стана първият участник.', 'Победител в конкурса стана първия участник.'], answer: 0, misc: [null, 'art.subj'],
    explain: 'Кой стана победител? — „първият участник“. Това е подлогът, макар да е в края на изречението, затова е с **пълен член**.' },

  /* ---------- запетая ---------- */
  { id: 'b:com1', skill: 'comma', level: 1, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Знам, че ще дойдеш.', 'Знам че ще дойдеш.'], answer: 0, misc: [null, 'comma.che'],
    explain: 'Подчиненото изречение „че ще дойдеш“ се отделя със запетая от главното.' },
  { id: 'b:com2', skill: 'comma', level: 1, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Иване ела тук!', 'Иване, ела тук!'], answer: 1, misc: ['comma.address', null],
    explain: '„Иване“ е обръщение и се отделя със запетая.' },
  { id: 'b:com3', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Книгата която ми подари, е интересна.', 'Книгата, която ми подари е интересна.', 'Книгата, която ми подари, е интересна.'], answer: 2, misc: ['comma.rel', 'comma.rel', null],
    explain: 'Подчиненото определително „която ми подари“ е вмъкнато в главното, затова се огражда със запетаи **от двете страни**.' },
  { id: 'b:com4', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Исках да дойда, но валеше.', 'Исках да дойда но валеше.'], answer: 0, misc: [null, 'comma.contrast'],
    explain: 'Пред противопоставителния съюз „но“ се пише запетая.' },
  { id: 'b:com5', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Слънцето изгря, и птиците запяха.', 'Слънцето изгря и птиците запяха.'], answer: 1, misc: ['comma.i', null],
    explain: 'Пред единичен съединителен съюз „и“ между две прости изречения запетая **не** се пише.' },
  { id: 'b:com6', skill: 'comma', level: 3, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?',
    options: ['Когато се стъмни ще запалим огъня.', 'Когато се стъмни, ще запалим огъня.', 'Когато, се стъмни ще запалим огъня.'], answer: 1, misc: ['comma.first', null, 'comma.first'],
    explain: 'Подчиненото изречение „Когато се стъмни“ стои пред главното и се отделя от него със запетая.' },

  /* ---------- слято, полуслято, разделно ---------- */
  { id: 'b:sp1', skill: 'spell', level: 1, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['по добър', 'подобър', 'по-добър'], answer: 2, misc: ['spell.comp', 'spell.comp', null],
    explain: 'Сравнителната степен с „по-“ се пише **полуслято** (с тире): *по-добър*.' },
  { id: 'b:sp2', skill: 'spell', level: 1, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['Не знам отговора.', 'Незнам отговора.'], answer: 0, misc: [null, 'spell.ne'],
    explain: 'Отрицателната частица „не“ пред глагол се пише **отделно**: *не знам*.' },
  { id: 'b:sp3', skill: 'spell', level: 2, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['пол-часа', 'полчаса', 'пол часа'], answer: 1, misc: ['spell.pol', null, 'spell.pol'],
    explain: '„пол“ се пише **слято** (*полчаса*), а с тире само пред гласна, „л“ и „й“ (*пол-ябълка*, *пол-лимон*).' },
  { id: 'b:sp4', skill: 'spell', level: 2, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['пол-лимон', 'поллимон', 'пол лимон'], answer: 0, misc: [null, 'spell.pol', 'spell.pol'],
    explain: 'Пред „л“ частта „пол“ се пише с тире: *пол-лимон*.' },
  { id: 'b:sp5', skill: 'spell', level: 3, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['пет-годишно дете', 'пет годишно дете', 'петгодишно дете'], answer: 2, misc: ['spell.num', 'spell.num', null],
    explain: 'Сложно прилагателно с числително, написано с думи, се пише **слято**: *петгодишно*. (С цифри е *5-годишно*.)' },
  { id: 'b:sp6', skill: 'spell', level: 3, type: 'choice', prompt: 'Кое е написано правилно?',
    options: ['северо-запад', 'северозапад', 'северо запад'], answer: 1, misc: ['spell.compass', null, 'spell.compass'],
    explain: 'Междинните посоки се пишат **слято**: *северозапад, югоизток*.' }
];

/* lessons of Shelly's matura modules -> skills here */
const LESSON_SKILL = { 'm-quad': 'quad', 'm-pct': 'pct', 'm-right': 'rtri', 'bel-article': 'art', 'bel-commas': 'comma', 'bel-debelyanov': 'lit' };

/* All bank tasks per subject: hand-written + taken from Shelly modules (open tasks need self-grading, so they stay out) */
const BANK = { math: [], bel: [] };
let SHELLY_MODS = {};
function buildBanks() {
  for (const [subj, json] of Object.entries(window.SHELLY_MODULE_JSON || {})) {
    const { errors } = checkModule(json); if (errors.length) { console.warn('module skipped', errors); continue; }
    const m = prepareModule(json); SHELLY_MODS[subj] = m;
    for (const l of m.lessonList) {
      const skill = LESSON_SKILL[l.id]; if (!skill || !l.practice) continue;
      for (const t of l.practice.tasks) if (t.type !== 'open') BANK[subj].push({ ...t, skill, level: 2, src: 'shelly', from: m.title + ' · ' + l.title });
    }
  }
  for (const t of BEL_BANK) BANK.bel.push({ points: 1, media: [], ...t, src: 'bank' });
}
/* The Shelly module the task views need (language, passages) */
const fakeModule = subj => SHELLY_MODS[subj] || { id: 'bingo.' + subj, lang: 'bg', passages: {}, scales: {}, color: SUBJECTS[subj].color };

/* Pick a task for a skill: math prefers a fresh generated variant; БЕЛ uses the bank (and AI when on).
   Recently seen bank tasks are avoided so the same question does not come back in the same week. */
function seenRecently(id) { const cut = Date.now() - 5 * 24 * 3600 * 1000; return S.log.some(r => r.task_id === id && r.t > cut); }
function pickTask(subj, skill, level, seed, avoid = new Set()) {
  if (subj === 'math' && MATH_GEN[skill]) {
    const fromModule = BANK.math.filter(t => t.skill === skill && !avoid.has(t.id) && !seenRecently(t.id));
    if (fromModule.length && seedRng(seed).chance(0.25)) return fromModule[0];
    return genMathTask(skill, level, seed);
  }
  const pool = BANK[subj].filter(t => t.skill === skill && !avoid.has(t.id));
  if (!pool.length) return null;
  const fresh = pool.filter(t => !seenRecently(t.id));
  const list = (fresh.length ? fresh : pool).slice().sort((a, b) => Math.abs((a.level || 2) - level) - Math.abs((b.level || 2) - level));
  const best = list.filter(t => Math.abs((t.level || 2) - level) === Math.abs((list[0].level || 2) - level));
  return best[Math.floor(seedRng(seed).f() * best.length)];
}
