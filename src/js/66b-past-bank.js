/* ================= Every question the app has, in training =================
   Past exams (66-past.js) used to be only a screen of their own. Now every closed question of every
   past exam also goes into the training bank of its subject and skill, so a weak skill is trained on
   real НВО / ДЗИ questions, not only on generated ones:
   - Математика and БЕЛ: the skill is found from the words of the question (MATH_TOPIC, BEL_TOPIC below)
   - the other maturas: tools/import_dzi.py already tagged each question (content/subjects.json)
   - Английски also gets the BrainBurst / BandUP bank (content/english-bank.json)
   A past-exam question is used only for the learner's own exam (an НВО 4 question never shows up
   for a ДЗИ learner) and keeps its reading text: the texts of all exams of a subject are put together
   in one module (subjectModule) so the task views can show them. */

const MATH_TOPIC = [
  ['meas', /\b(мм|см|дм|км|кг|грам|литр|милилитр|тон|час(а|ът)?|минут|секунд|денонощ|мерн)|\b(mm|cm|dm|km|kg)\b/i],
  ['word', /купил|купува|струва|похарчи|спестил|имал|раздели|получил|колко (лева|деца|ученици|книги|бонбони)/i],
  ['num', /събер|изважд|умнож|дел(и|ение)|сбор|разлика|произведени|частно|цифр|числ(о|ото|ата)|стойността на израза/i],
  ['prob', /вероятн|случайно|наслуки|зар(ове|а)?\b|монет|благоприятн/i],
  ['stat', /средно аритметично|медиан|мода(та)?\b|честот|статистик|пермутац|вариаци|комбинаци|по колко начина|диаграм/i],
  ['trig', /\\sin|\\cos|\\tg|\\cotg|синус|косинус|тангенс|котангенс|тригонометр/i],
  ['prog', /прогреси|a_\{?\d|a_n|S_\{?\d/i],
  ['quad', /x\^2|x\^\{2\}|квадратн|дискриминант|Виет|корен(и|ите) на уравнението/i],
  ['pow', /\\sqrt|\^\{-|степен|корен|\\log|логаритъм/i],
  ['lin', /неравенств|\\le|\\ge|[<>]/i],
  ['pct', /%|процент|лв\.|отстъпк|поскъп|поевтин|лихв/i],
  ['rtri', /правоъгълен триъгълник|хипотенуз|катет|Питагор/i],
  ['func', /функци|график|f\(x\)|y\s*=|парабол|ос(та)? O[xy]|координатн|права(та)?\b/i],
  ['geom', /триъгълник|четириъгълник|успоредник|ромб|трапец|окръжност|кръг|ъгъл|ъгли|лице(то)?\b|периметър|медиана|ъглополовящ|височина|радиус|призм|пирамид|куб|цилиндър|конус/i]
];
const BEL_TOPIC = [
  ['art', /член(уван|ът|а)|пълен член|кратък член/i],
  ['comma', /запетая|пунктуац|препинател/i],
  ['spell', /слято|полуслято|разделно|правопис|правописн|написан(а|о|и)? правилно|грешно написан/i],
  ['lit', /творб|автор|стихотворени|повест|разказ|роман|лирическ|герой|литератур|мотив|образ(ът)?\b|Ботев|Вазов|Яворов|Дебелянов|Смирненски|Вапцаров|Елин Пелин|Йовков|Талев|Багряна|Димитрова/i],
  ['norm', /синоним|антоним|пароним|значени|лексик|фразеолог|граматич|глагол|съществително|прилагателно|местоимени|изречени|съгласув|форма(та)?\b|сказуемо|подлог/i],
  ['read', /текст|откъс|според|информаци/i]
];
const topicOf = (rules, text, fallback) => (rules.find(([, rx]) => rx.test(text)) || [fallback])[0];

let SUBJ_MODULES = {};
/* one module per subject: Shelly's module (if any) plus the reading texts of all its past exams */
function subjectModule(subj) {
  if (SUBJ_MODULES[subj]) return SUBJ_MODULES[subj];
  const base = SHELLY_MODS[subj] || { id: 'bingo.' + subj, lang: 'bg', passages: {}, scales: {}, color: SUBJECTS[subj].color };
  const m = { ...base, passages: { ...(base.passages || {}) } };
  for (const p of PAST.filter(x => x.past.subj === subj)) for (const [pid, text] of Object.entries(p.passages || {})) m.passages[p.id + '/' + pid] = text;
  return (SUBJ_MODULES[subj] = m);
}
fakeModule = subj => subjectModule(subj);

function buildPastBank() {
  SUBJ_MODULES = {};
  for (const id of Object.keys(SUBJECTS)) BANK[id] = BANK[id] || [];
  for (const m of PAST) {
    const subj = m.past.subj; if (!SUBJECTS[subj]) continue;
    const skills = SUBJECTS[subj].skills.map(s => s.id);
    for (const { task, part } of pastTasks(m)) {
      if (task.type !== 'choice' || !Array.isArray(task.options) || task.options.length < 4) continue;
      const text = (task.prompt || '') + ' ' + task.options.join(' ');
      /* math: only the skills of that exam (НВО 4 has no trigonometry); the first matching rule wins */
      const examSkills = subj === 'math' && m.past.exam !== 'dzi12' && NVO_PROFILES.math[m.past.exam.slice(3)] ? NVO_PROFILES.math[m.past.exam.slice(3)].skills.map(s => s.id) : skills;
      const skill = task.skill && skills.includes(task.skill) ? task.skill
        : subj === 'math' ? topicOf(MATH_TOPIC.filter(([id]) => examSkills.includes(id)), text, examSkills.includes('func') ? 'func' : examSkills[0]) : subj === 'bel' ? topicOf(BEL_TOPIC, text, task.passage ? 'read' : 'norm') : skills[skills.length - 1];
      /* pictures: copy them under the subject module's id, so the session's task view finds them */
      const modId = subjectModule(subj).id, media = arr(task.media).map(b => {
        if (!b || !b.src || /^(data:|https?:)/.test(b.src)) return b;
        const key = m.id + '/' + b.src, all = window.SHELLY_MEDIA || (window.SHELLY_MEDIA = {});
        if (all[m.id + '\n' + b.src]) all[modId + '\n' + key] = all[m.id + '\n' + b.src];
        return { ...b, src: key };
      });
      BANK[subj].push({ ...task, media, id: 'past:' + m.id + ':' + task.id, skill, level: 2, src: 'past', exam: ['math', 'bel'].includes(subj) ? m.past.exam : undefined,
        passage: task.passage ? m.id + '/' + task.passage : undefined, from: pastTitle(m) + ' · ' + L('задача {n}', { n: String(task.id).replace(/^q/, '') }), pastPart: part.title });
    }
  }
  for (const t of window.ENGLISH_BANK_JSON || []) BANK.en.push({ points: 1, media: [], ...t, src: 'bank' });
}
/* Every closed question has four options (А–Г). A bank question with two or three gets more from questions
   of the same skill, keeping its polarity: "which is right?" gets wrong options of other questions, "where is
   the mistake?" gets right options (the right answers) of others, so exactly one option stays right.
   A number question gets a near number instead. */
const NEG_PROMPT = /грешк|неправилно|НЕ\b|не е\b|\*\*не\*\*/i;
function padToFour(list) {
  for (const t of list) {
    if (t.type !== 'choice' || t.options.length >= 4 || t.src === 'past') continue;
    const neg = NEG_PROMPT.test(t.prompt || ''), have = new Set(t.options.map(o => o.trim()));
    const same = list.filter(x => x !== t && x.skill === t.skill && x.type === 'choice');
    const pool = neg ? same.map(x => x.options[x.answer]) : same.flatMap(x => x.options.filter((_, i) => i !== x.answer));
    const R = seedRng('pad:' + t.id), add = [];
    while (t.options.length + add.length < 4 && pool.length) {
      const o = pool.splice(Math.floor(R.f() * pool.length), 1)[0];
      if (o && !have.has(o.trim()) && o.length < 220) { have.add(o.trim()); add.push(o); }
    }
    if (t.options.length + add.length < 4) { const n = nearNumberOption(t.options); if (n && !have.has(n)) add.push(n); }
    if (!add.length) continue;
    t.options = t.options.concat(add);
    if (Array.isArray(t.misc)) t.misc = t.misc.concat(add.map(() => (neg ? null : t.misc.find(Boolean) || null)));
    if (Array.isArray(t.why)) t.why = t.why.concat(add.map(() => null));
    /* the added options go to random places; the right answer moves with its text */
    const right = t.options[t.answer], order = shuffledIdx(t.options.length, 'pad4:' + t.id);
    const mix = a => (Array.isArray(a) && a.length === t.options.length ? order.map(i => a[i]) : a);
    t.misc = mix(t.misc); t.why = mix(t.why); t.options = order.map(i => t.options[i]); t.answer = t.options.indexOf(right);
    if (Array.isArray(t.misc)) t.misc[t.answer] = null;
  }
}
function nearNumberOption(opts) {
  const nums = opts.map(o => String(o).match(/^\$?\s*(-?\d+(?:\{,\}\d+|,\d+)?)\s*\$?(.*)$/)).filter(Boolean);
  if (nums.length !== opts.length) return null;
  const v = nums.map(m => parseFloat(m[1].replace('{,}', '.').replace(',', '.'))), step = Math.max(1, Math.round((Math.max(...v) - Math.min(...v)) / 3) || 1);
  const x = roundTo(Math.max(...v) + step, 4), txt = String(x).replace('.', '{,}');
  return opts[0].trim().startsWith('$') ? `$${txt}$${nums[0][2].replace(/^\$/, '')}` : txt + nums[0][2];
}
const _buildBanksPast = buildBanks;
buildBanks = function () { _buildBanksPast(); buildPastBank(); for (const list of Object.values(BANK)) padToFour(list); };

/* a bank task belongs to one exam (НВО 4 / 7 / 10 / ДЗИ 12) when it comes from a past exam */
const forMyExam = t => !t.exam || t.exam === currentExamKey();
