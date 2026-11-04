/* ================= Task banks: БЕЛ items, and the tasks of the Shelly matura modules =================
   БЕЛ is harder to generate from a formula, so it has a hand-written bank (each wrong option
   names its mistake), plus the lesson tasks of Shelly's two matura modules, plus new tasks from
   Gemini when AI is switched on. */

const belEssayCriteria = [
  { id: 'thesis', label: 'Теза и основна идея' },
  { id: 'structure', label: 'Структура и логическа връзка' },
  { id: 'argumentation', label: 'Аргументация и примери' },
  { id: 'language', label: 'Език, стил и правопис' },
  { id: 'task', label: 'Съответствие с задачата' }
];

const BEL_BANK = [
  { id: 'b:art1', skill: 'art', level: 1, type: 'choice', prompt: 'Изберете правилно написаното изречение.', options: ['Новият учител влезе в класа.', 'Новия учител влезе в класа.'], answer: 0, misc: [null, 'art.subj'], explain: '„Новият учител“ е подлог (кой влезе?), затова се пише с **пълен член**.' },
  { id: 'b:art2', skill: 'art', level: 1, type: 'choice', prompt: 'Изберете правилно написаното изречение.', options: ['Поздравихме победителят от състезанието.', 'Поздравихме победителя от състезанието.'], answer: 1, misc: ['art.obj', null], explain: '„Победителя“ е допълнение (кого поздравихме?), затова е с **кратък член**.' },
  { id: 'b:art3', skill: 'art', level: 2, type: 'choice', prompt: 'В кое изречение членуването е **правилно**?', options: ['Той е най-добрия ученик в класа.', 'Той е най-добрият ученик в класа.', 'Най-добрия ученик в класа е той.'], answer: 1, misc: ['art.pred', null, 'art.pred'], explain: '„Най-добрият ученик“ е **сказуемно определение** (след „е“), а то се членува с пълен член, както подлогът.' },
  { id: 'b:art4', skill: 'art', level: 2, type: 'choice', prompt: 'Изберете правилно написаното изречение.', options: ['Говорихме за филмът цяла вечер.', 'Говорихме за филма цяла вечер.'], answer: 1, misc: ['art.obj', null], explain: 'След предлог („за филма“) думата не е подлог, затова е с **кратък член**.' },
  { id: 'b:art5', skill: 'art', level: 3, type: 'choice', prompt: 'В кое изречение **има грешка** в членуването?', options: ['Председателят на журито обяви резултатите.', 'Учителят похвали ученика, който реши задачата.', 'Писмото беше изпратено от директорът.', 'Отборът спечели купата.'], answer: 2, misc: ['art.obj', 'art.obj', null, 'art.obj'], why: ['Тук няма грешка: „председателят“ е подлог.', 'Тук няма грешка: „ученика“ е допълнение.', null, 'Тук няма грешка: „отборът“ е подлог.'], explain: '„От директора“: в страдателна конструкция извършителят е с предлог, не е подлог, затова е с **кратък член**.' },
  { id: 'b:art6', skill: 'art', level: 3, type: 'choice', prompt: 'Изберете правилно написаното изречение.', options: ['Победител в конкурса стана първият участник.', 'Победител в конкурса стана първия участник.'], answer: 0, misc: [null, 'art.subj'], explain: 'Кой стана победител? — „първият участник“. Това е подлогът, макар да е в края на изречението, затова е с **пълен член**.' },
  { id: 'b:com1', skill: 'comma', level: 1, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Знам, че ще дойдеш.', 'Знам че ще дойдеш.'], answer: 0, misc: [null, 'comma.che'], explain: 'Подчиненото изречение „че ще дойдеш“ се отделя със запетая от главното.' },
  { id: 'b:com2', skill: 'comma', level: 1, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Иване ела тук!', 'Иване, ела тук!'], answer: 1, misc: ['comma.address', null], explain: '„Иване“ е обръщение и се отделя със запетая.' },
  { id: 'b:com3', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Книгата която ми подари, е интересна.', 'Книгата, която ми подари е интересна.', 'Книгата, която ми подари, е интересна.'], answer: 2, misc: ['comma.rel', 'comma.rel', null], explain: 'Подчиненото определително „която ми подари“ е вмъкнато в главното, затова се огражда със запетаи **от двете страни**.' },
  { id: 'b:com4', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Исках да дойда, но валеше.', 'Исках да дойда но валеше.'], answer: 0, misc: [null, 'comma.contrast'], explain: 'Пред противопоставителния съюз „но“ се пише запетая.' },
  { id: 'b:com5', skill: 'comma', level: 2, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Слънцето изгря, и птиците запяха.', 'Слънцето изгря и птиците запяха.'], answer: 1, misc: ['comma.i', null], explain: 'Пред единичен съединителен съюз „и“ между две прости изречения запетая **не** се пише.' },
  { id: 'b:com6', skill: 'comma', level: 3, type: 'choice', prompt: 'В кое изречение пунктуацията е **правилна**?', options: ['Когато се стъмни ще запалим огъня.', 'Когато се стъмни, ще запалим огъня.', 'Когато, се стъмни ще запалим огъня.'], answer: 1, misc: ['comma.first', null, 'comma.first'], explain: 'Подчиненото изречение „Когато се стъмни“ стои пред главното и се отделя от него със запетая.' },
  { id: 'b:sp1', skill: 'spell', level: 1, type: 'choice', prompt: 'Кое е написано правилно?', options: ['по добър', 'подобър', 'по-добър'], answer: 2, misc: ['spell.comp', 'spell.comp', null], explain: 'Сравнителната степен с „по-“ се пише **полуслято** (с тире): *по-добър*.' },
  { id: 'b:sp2', skill: 'spell', level: 1, type: 'choice', prompt: 'Кое е написано правилно?', options: ['Не знам отговора.', 'Незнам отговора.'], answer: 0, misc: [null, 'spell.ne'], explain: 'Отрицателната частица „не“ пред глагол се пише **отделно**: *не знам*.' },
  { id: 'b:sp3', skill: 'spell', level: 2, type: 'choice', prompt: 'Кое е написано правилно?', options: ['пол-часа', 'полчаса', 'пол часа'], answer: 1, misc: ['spell.pol', null, 'spell.pol'], explain: '„пол“ се пише **слято** (*полчаса*), а с тире само пред гласна, „л“ и „й“ (*пол-ябълка*, *пол-лимон*).' },
  { id: 'b:sp4', skill: 'spell', level: 2, type: 'choice', prompt: 'Кое е написано правилно?', options: ['пол-лимон', 'поллимон', 'пол лимон'], answer: 0, misc: [null, 'spell.pol', 'spell.pol'], explain: 'Пред „л“ частта „пол“ се пише с тире: *пол-лимон*.' },
  { id: 'b:sp5', skill: 'spell', level: 3, type: 'choice', prompt: 'Кое е написано правилно?', options: ['пет-годишно дете', 'пет годишно дете', 'петгодишно дете'], answer: 2, misc: ['spell.num', 'spell.num', null], explain: 'Сложно прилагателно с числително, написано с думи, се пише **слято**: *петгодишно*. (С цифри е *5-годишно*.)' },
  { id: 'b:sp6', skill: 'spell', level: 3, type: 'choice', prompt: 'Кое е написано правилно?', options: ['северо-запад', 'северозапад', 'северо запад'], answer: 1, misc: ['spell.compass', null, 'spell.compass'], explain: 'Междинните посоки се пишат **слято**: *северозапад, югоизток*.' }
];

S.belCriteria = belEssayCriteria;
console.log('S.belCriteria initialized:', S.belCriteria.length, 'criteria', S.belCriteria.map(c => ({ id: c.id, label: c.label })));

function validateEssayAssessment() {
  return S.belCriteria.every(c => Number.isFinite(S.essayAssessment.criteria[c.id]));
}

function calculateEssayResult() {
  const results = {};
  let total = 0;
  for (const c of S.belCriteria) {
    const rating = S.essayAssessment.criteria[c.id];
    if (!Number.isFinite(rating)) return null;
    results[c.id] = { rating, skill: 'bel.' + c.id, correct: rating >= 3 };
    total += rating;
  }
  return { results, overall: roundTo(total / S.belCriteria.length, 2), ratio: total / (S.belCriteria.length * 5) };
}

function essayCriteriaView() {
  const el = document.createElement('div');
  el.className = 'essay-criteria';
  el.innerHTML = '<b>Самооценка по критерии</b>' + S.belCriteria.map(c =>
    `<div class="crit" data-id="${c.id}"><span>${esc(c.label)}</span><span class="rates">${[1,2,3,4,5].map(v => `<button type="button" data-value="${v}" aria-label="${esc(c.label)}: ${v}">${v}</button>`).join('')}</span></div>`
  ).join('');
  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-value]'); if (!b) return;
    const id = b.closest('.crit').dataset.id, v = +b.dataset.value;
    S.essayAssessment.criteria[id] = v;
    [...b.parentElement.children].forEach(x => x.classList.toggle('active', x === b));
    saveState();
    el.dispatchEvent(new CustomEvent('essay-rating', { bubbles: true }));
  });
  return el;
}

Object.assign(MISC, { 'lit.text': 'Невнимателен прочит на текста', 'lit.term': 'Сбъркан литературен термин', 'lit.author': 'Факт за автора и творчеството му' });
const mixOptions = t => { const o = shuffledIdx(t.options.length, t.id); return { ...t, options: o.map(i => t.options[i]), misc: o.map(i => t.misc[i]), answer: o.indexOf(t.answer) }; };
BEL_BANK.push(...[
  { id: 'b:lit1', skill: 'lit', level: 1, type: 'choice', passage: 'debelyanov', prompt: 'Кого „приласкава“ тихата нощ в строфата?', options: ['скръбни и нещастни', 'децата в бащината къща', 'щастливите и спокойните', 'войниците на фронта'], answer: 0, misc: [null, 'lit.text', 'lit.text', 'lit.text'], explain: 'Последният стих казва, че нощта идва, за да приласкае **скръбни и нещастни**. Утехата е за страдащия — като лирическия Аз.' },
  { id: 'b:lit2', skill: 'lit', level: 1, type: 'choice', prompt: 'Къде е роден Димчо Дебелянов?', options: ['в Копривщица', 'в Пловдив', 'във Велико Търново', 'в София'], answer: 0, misc: [null, 'lit.author', 'lit.author', 'lit.author'], explain: 'Дебелянов е роден през 1887 г. в **Копривщица**. Родният град и бащината къща са важен образ в поезията му.' },
  { id: 'b:lit3', skill: 'lit', level: 1, type: 'choice', prompt: 'Кое от тези стихотворения **не** е от Дебелянов?', options: ['„Две хубави очи“', '„Черна песен“', '„Помниш ли, помниш ли тихия двор“', '„Аз искам да те помня все така“'], answer: 0, misc: [null, 'lit.author', 'lit.author', 'lit.author'], explain: '„Две хубави очи“ е от **Пейо Яворов**. Останалите три са стихотворения на Дебелянов.' },
  { id: 'b:lit4', skill: 'lit', level: 2, type: 'choice', prompt: 'Към кое литературно направление се отнася поезията на Дебелянов?', options: ['символизъм', 'реализъм', 'класицизъм', 'футуризъм'], answer: 0, misc: [null, 'lit.term', 'lit.term', 'lit.term'], explain: 'Дебелянов е поет на **символизма**: блянът, спомените, вътрешният свят и музикалността на стиха са по-важни от описанието на действителността.' },
  { id: 'b:lit5', skill: 'lit', level: 2, type: 'choice', prompt: 'Как загива Дебелянов?', options: ['като войник на фронта през Първата световна война', 'при пожар в родната си къща', 'от болест в чужбина', 'в Балканската война при Одрин'], answer: 0, misc: [null, 'lit.author', 'lit.author', 'lit.author'], explain: 'Дебелянов загива през **1916 г.** на Южния фронт през **Първата световна война**. Стихотворенията му излизат в книга след смъртта му.' },
  { id: 'b:lit6', skill: 'lit', level: 2, type: 'choice', passage: 'debelyanov', prompt: 'Каква е римата в строфата (къща – гасне – разгръща – нещастни)?', options: ['кръстосана', 'съседна', 'обхватна', 'няма рима'], answer: 0, misc: [null, 'lit.term', 'lit.term', 'lit.term'], explain: 'Римуват се 1. и 3. стих (*къща – разгръща*) и 2. и 4. стих (*гасне – нещастни*): схема **абаб**, т.е. **кръстосана** рима.' },
  { id: 'b:lit7', skill: 'lit', level: 2, type: 'choice', passage: 'debelyanov', prompt: 'Коя дума в строфата е **епитет**?', options: ['„тиха“ (нощ)', '„къща“', '„гасне“', '„разгръща“'], answer: 0, misc: [null, 'lit.term', 'lit.term', 'lit.term'], explain: '**Епитетът** е художествено определение: „тиха нощ“, „тихи пазви“. „Къща“ е съществително, а „гасне“ и „разгръща“ са глаголи.' },
  { id: 'b:lit8', skill: 'lit', level: 3, type: 'choice', passage: 'debelyanov', prompt: 'Какво внушава повторението **„тихи пазви тиха нощ“**?', options: ['покой и утеха', 'тревога и опасност', 'празнично веселие', 'гняв и бунт'], answer: 0, misc: [null, 'lit.text', 'lit.text', 'lit.text'], explain: 'Повторението на „тих“ подсилва усещането за **покой**, а „пазви“ и „да приласкае“ — за прегръдка и **утеха**.' },
  { id: 'b:lit9', skill: 'lit', level: 3, type: 'choice', prompt: 'Кое е основното противопоставяне в „Да се завърнеш в бащината къща“?', options: ['блянът за дома срещу самотата и умората на скитника', 'градът срещу селото', 'войната срещу мира', 'богатството срещу бедността'], answer: 0, misc: [null, 'lit.text', 'lit.text', 'lit.text'], explain: 'Лирическият Аз е уморен скиталец. Завръщането в бащината къща е **блян** за покой и обич, противопоставен на **самотата** и разочарованието в настоящето.' }
].map(mixOptions));

const EXPLAIN_FIX = {
  'math:q1': 'Търсим две числа със сбор $5$ и произведение $6$ (формули на Виет): това са $2$ и $3$. Проверка: $2^2-5\\cdot2+6=0$ и $3^2-5\\cdot3+6=0$.',
  'math:p2': '$20\\%$ от $50$ е $50\\cdot0{,}2=10$ лв., затова новата цена е $50+10=60$ лв. Или направо: $50\\cdot1{,}2=60$ лв.',
  'math:p5': 'Увеличение с $25\\%$: новото е $100\\%+25\\%=125\\%$ от старото, т.е. умножаваме по $1{,}25$. Намаление с $25\\%$: остават $100\\%-25\\%=75\\%$ от старото, т.е. умножаваме по $0{,}75$.',
  'math:g4': 'Срещу ъгъла $\\alpha$ е катетът $a$, до него е катетът $b$, а $c$ е хипотенузата. $\\sin\\alpha=\\frac{a}{c}$ (срещулежащ катет : хипотенуза), $\\cos\\alpha=\\frac{b}{c}$ (прилежащ катет : хипотенуза), $\\operatorname{tg}\\alpha=\\frac{a}{b}$ (прилежащ катет : хипотенуза).',
  'bel:c1': 'Подчиненото изречение „която ми подари“ е вмъкнато в главното („Книгата е много интересна“), затова се огражда със запетаи **от двете страни**: пред „която“ и след „подари“.',
  'bel:d1': '„Да се завърнеш…“ изразява **желано** действие — копнеж. Лирическият Аз мечтае за дома, но не е сигурно, че завръщането ще се случи.'
};

const LESSON_SKILL = { 'm-quad': 'quad', 'm-pct': 'pct', 'm-right': 'rtri', 'bel-article': 'art', 'bel-commas': 'comma', 'bel-debelyanov': 'lit' };

const BANK = { math: [], bel: [] };
let SHELLY_MODS = {};
function buildBanks() {
  for (const [subj, json] of Object.entries(window.SHELLY_MODULE_JSON || {})) {
    const { errors } = checkModule(json); if (errors.length) { console.warn('module skipped', errors); continue; }
    const m = prepareModule(json); SHELLY_MODS[subj] = m;
    for (const l of m.lessonList) {
      const skill = LESSON_SKILL[l.id]; if (!skill || !l.practice) continue;
      for (const t of l.practice.tasks) if (t.type !== 'open') BANK[subj].push({ ...t, skill, level: 2, src: 'shelly', from: m.title + ' · ' + l.title, ...(!t.explain && EXPLAIN_FIX[subj + ':' + t.id] ? { explain: EXPLAIN_FIX[subj + ':' + t.id] } : {}) });
    }
  }
  for (const t of BEL_BANK) BANK.bel.push({ points: 1, media: [], ...t, src: 'bank' });
}
const fakeModule = subj => SHELLY_MODS[subj] || { id: 'bingo.' + subj, lang: 'bg', passages: {}, scales: {}, color: SUBJECTS[subj].color };

function seenRecently(id) { const cut = Date.now() - 5 * 24 * 3600 * 1000; return S.log.some(r => r.task_id === id && r.t > cut); }
const taskKey = t => (t.src === 'gen' ? 'q:' + t.skill + ':' + t.prompt : t.id);
function pickTask(subj, skill, level, seed, avoid = new Set()) {
  if (subj === 'math' && MATH_GEN[skill]) {
    const fromModule = BANK.math.filter(t => t.skill === skill && !avoid.has(t.id) && !seenRecently(t.id));
    if (fromModule.length && seedRng(seed).chance(0.25)) return fromModule[Math.floor(seedRng(seed + ':m').f() * fromModule.length)];
    for (const lvl of [level, ...[1, 2, 3].filter(l => l !== level).sort((a, b) => Math.abs(a - level) - Math.abs(b - level))])
      for (let k = 0; k < 24; k++) { const t = genMathTask(skill, lvl, k ? seed + ':' + k : seed); if (!avoid.has(taskKey(t))) return t; }
    return fromModule[0] || null;
  }
  const pool = BANK[subj].filter(t => t.skill === skill && !avoid.has(t.id));
  if (!pool.length) return null;
  const fresh = pool.filter(t => !seenRecently(t.id));
  const list = (fresh.length ? fresh : pool).slice().sort((a, b) => Math.abs((a.level || 2) - level) - Math.abs((b.level || 2) - level));
  const best = list.filter(t => Math.abs((t.level || 2) - level) === Math.abs((list[0].level || 2) - level));
  return best[Math.floor(seedRng(seed).f() * best.length)];
}
