/* ================= Skills, misconceptions and the knowledge model =================
   Every task belongs to one skill. For each skill the app keeps one number: the chance
   that the learner has mastered it (Bayesian Knowledge Tracing). From that it works out
   how many matura points the learner is probably losing on the skill, and trains only
   the skills that cost the most. Strong skills are not repeated, only checked now and then. */

/* weight = an estimate of the matura points that depend on the skill (out of 100).
   These are planning numbers for the demo and should be checked against the МОН specification. */
const SUBJECTS = {
  math: {
    id: 'math', title: 'Математика', short: 'Матем.', icon: '📐', color: '#2F5BD3', lang: 'bg',
    skills: [
      { id: 'quad', name: 'Квадратни уравнения', weight: 12 },
      { id: 'pct', name: 'Проценти', weight: 8 },
      { id: 'pow', name: 'Степени и корени', weight: 10 },
      { id: 'lin', name: 'Линейни неравенства', weight: 8 },
      { id: 'rtri', name: 'Правоъгълен триъгълник', weight: 12 },
      { id: 'prog', name: 'Аритметична прогресия', weight: 8 },
      { id: 'prob', name: 'Вероятности', weight: 8 }
    ]
  },
  bel: {
    id: 'bel', title: 'БЕЛ', short: 'БЕЛ', icon: '📖', color: '#B4532A', lang: 'bg',
    skills: [
      { id: 'art', name: 'Пълен и кратък член', weight: 6 },
      { id: 'comma', name: 'Запетая', weight: 8 },
      { id: 'spell', name: 'Слято, полуслято, разделно', weight: 6 },
      { id: 'lit', name: 'Литература: Дебелянов', weight: 10 }
    ]
  }
};
const skillDef = (subj, id) => SUBJECTS[subj].skills.find(s => s.id === id);

/* Typical mistakes. A wrong option in a task can name the mistake it comes from,
   so a wrong answer says *why* it was wrong, not only that it was. */
const MISC = {
  'quad.viet_sign': 'Знак във формулите на Виет: $x_1+x_2=-\\frac{b}{a}$',
  'quad.forgot_a': 'Забравено делене на $a$',
  'quad.viet_swap': 'Сбъркани сбор и произведение на корените',
  'quad.D_formula': 'Дискриминантата е $b^2-4ac$, не $b^2-ac$',
  'quad.ineq_dir': 'Обърната посока на неравенството',
  'quad.strict': 'При $D=0$ коренът е един (двоен)',
  'pct.as_number': 'Процентът е събран като число, а не като част от цената',
  'pct.only_part': 'Сметнато е само увеличението, без началната цена',
  'pct.direction': 'Увеличение и намаление са разменени',
  'pct.add_pcts': 'Последователни проценти не се събират',
  'pct.reverse': 'Обратният процент: делим на $(1+p)$, не умножаваме по $(1-p)$',
  'pow.mult_exp': 'При умножение показателите се събират, не се умножават',
  'pow.sign': 'Знак на показателя',
  'pow.root_square': 'Изнесено е числото, а не коренът му',
  'pow.swap': 'Разменени множители под и пред корена',
  'pow.add_root': 'Коренът от сбор не е сбор от корени',
  'pow.neg_sign': 'Отрицателният показател не прави числото отрицателно',
  'pow.neg_ignored': 'Отрицателният показател обръща дробта',
  'lin.flip': 'При деление на отрицателно число знакът на неравенството се обръща',
  'lin.move_sign': 'Знак при пренасяне от едната страна на другата',
  'lin.divide': 'Делене вместо изваждане (или обратно)',
  'rtri.add_legs': 'Хипотенузата не е сбор от катетите',
  'rtri.no_root': 'Забравен корен квадратен накрая',
  'rtri.hyp_as_leg': 'За катет се изважда: $b^2=c^2-a^2$',
  'rtri.sin_cos': 'Разменени синус и косинус',
  'rtri.tan': 'Тангенс вместо синус',
  'rtri.inverse': 'Обърнато отношение',
  'prog.n_vs_n1': 'Общият член е $a_1+(n-1)d$, не $a_1+nd$',
  'prog.index_diff': 'Делим на разликата на номерата',
  'prog.forgot_half': 'Забравено делене на 2 в сумата',
  'prog.sign': 'Знак на разликата $d$',
  'prob.part_whole': 'Делим на всички възможности, не на неблагоприятните',
  'prob.complement': 'Сметната е вероятността на противоположното събитие',
  'prob.space': 'Неправилно пространство от изходи',
  'prob.not_equal': 'Изходите не са равновероятни',
  'prob.exactly': '„Поне едно“ не е „точно едно“',
  'art.subj': 'Подлогът се членува с пълен член',
  'art.obj': 'Допълнението се членува с кратък член',
  'art.pred': 'Сказуемното определение се членува с пълен член',
  'comma.rel': 'Подчиненото определително се огражда със запетаи от двете страни',
  'comma.che': 'Запетая пред „че“, „който“, „когато“ в сложно изречение',
  'comma.contrast': 'Запетая пред противопоставителен съюз (но, а, ала)',
  'comma.i': 'Без запетая пред единичен съюз „и“',
  'comma.first': 'Подчинено изречение отпред се отделя със запетая',
  'comma.address': 'Обръщението се отделя със запетая',
  'spell.comp': '„по-“ и „най-“ се пишат с тире (полуслято)',
  'spell.ne': '„не“ пред глагол се пише отделно',
  'spell.pol': '„пол“ се пише слято, а с тире пред гласна, „л“ и „й“',
  'spell.num': 'Сложни прилагателни с числително се пишат слято',
  'spell.compass': 'Посоките се пишат слято: северозапад',
  'calc': 'Сметкова грешка'
};
const miscLabel = code => MISC[code] || MISC[code && code.split('.').pop()] || 'Друга грешка';

/* ---------- Bayesian Knowledge Tracing ----------
   p = chance the skill is mastered. Each answer updates it with Bayes' rule, allowing for
   lucky guesses (guess) and careless slips (slip); then a little learning happens (learn). */
const BKT = { prior: 0.3, learn: 0.1, slip: 0.12, strong: 0.9, weak: 0.6 };
const guessOf = task => (task.type === 'choice' ? 1 / task.options.length : task.type === 'gaps' && task.gaps.every(g => g.options) ? Math.pow(0.5, task.gaps.length) : 0.05);

function skillState(subj, id) {
  const k = subj + '.' + id + '@' + currentExamKey();
  /* a key without an exam (an older save, imported data) moves to the current exam when first read */
  if (!S.skills[k] && S.skills[subj + '.' + id]) { S.skills[k] = S.skills[subj + '.' + id]; delete S.skills[subj + '.' + id]; }
  return S.skills[k] || (S.skills[k] = { p: BKT.prior, n: 0, ok: 0, last: 0, misc: {}, hist: [] });
}
function bktUpdate(p, correct, guess, learn = BKT.learn, maxJump = 1) {
  const s = BKT.slip, g = clamp(guess, 0.01, 0.5);
  const post = correct ? p * (1 - s) / (p * (1 - s) + (1 - p) * g) : p * s / (p * s + (1 - p) * (1 - g));
  const next = clamp(post + (1 - post) * learn, 0.01, 0.995);
  /* a wrong answer may lower mastery but never raise it (the learning step could otherwise lift a
     very weak skill after a mistake); and one answer moves it by at most maxJump */
  return clamp(correct ? next : Math.min(p, next), p - maxJump, p + maxJump);
}
/* With little evidence one lucky or unlucky answer must not swing the estimate: the first answers
   on a skill learn less and may move it only a little; the limits loosen as answers add up. */
function bktStep(st, correct, guess) {
  const learn = BKT.learn * (st.n < 3 ? 0.35 : st.n < 6 ? 0.65 : 1);
  const maxJump = st.n < 2 ? 0.08 : st.n < 4 ? 0.12 : st.n < 7 ? 0.16 : 0.22;
  return bktUpdate(st.p, correct, guess, learn, maxJump);
}
function recordAnswer(subj, task, correct, misc) {
  const st = skillState(subj, task.skill), before = st.p;
  st.p = bktStep(st, correct, guessOf(task)); st.n++; if (correct) st.ok++; st.last = Date.now();
  if (!correct && misc) st.misc[misc] = (st.misc[misc] || 0) + 1;
  st.hist.push([Date.now(), roundTo(st.p, 3)]); if (st.hist.length > 60) st.hist.shift();
  saveState();
  return { before, after: st.p };
}

/* status: 'new' (not enough answers), 'weak', 'mid', 'strong' */
function skillStatus(st) { if (st.n < 2) return 'new'; if (st.p >= BKT.strong && st.n >= 3) return 'strong'; if (st.p < BKT.weak) return 'weak'; return 'mid'; }
const STATUS_LABEL = { new: 'Малко данни', weak: 'Слабо', mid: 'Почти', strong: 'Силно' };

/* Matura points the learner probably loses on a skill */
const pointsLost = (sk, st) => sk.weight * (1 - st.p);
function subjectSummary(subj) {
  const list = SUBJECTS[subj].skills.map(sk => { const st = skillState(subj, sk.id); return { sk, st, status: skillStatus(st), lost: pointsLost(sk, st) }; });
  const total = sum(list.map(x => x.sk.weight)), lost = sum(list.map(x => x.lost)), answered = sum(list.map(x => x.st.n));
  return { list, total, lost, answered, diagnosed: list.every(x => x.st.n >= 1) };
}

/* ---------- Choosing what to train ----------
   Highest expected points lost first; unknown skills get a small push so they get measured;
   strong skills are left out, except one quick check if not seen for 3 days.
   The plan never has more than `size` tasks, the quick check included. */
const CHECK_AFTER = 3 * 24 * 3600 * 1000;
function planSession(subj, size = 8) {
  const sum_ = subjectSummary(subj);
  const open = sum_.list.filter(x => x.status !== 'strong').map(x => ({ ...x, prio: x.lost * (x.st.n < 2 ? 1.3 : 1) })).sort((a, b) => b.prio - a.prio);
  const focus = open.slice(0, Math.min(open.length, open.length > 3 ? 3 : open.length));
  const due = sum_.list.filter(x => x.status === 'strong' && Date.now() - x.st.last > CHECK_AFTER).sort((a, b) => a.st.last - b.st.last)[0];
  const room = due && focus.length ? size - 1 : size;
  const plan = [];
  if (focus.length) {
    const shares = focus.length === 1 ? [room] : focus.length === 2 ? [Math.ceil(room * 0.6), Math.floor(room * 0.4)] : [Math.ceil(room * 0.5), Math.round(room * 0.3), 0];
    shares[shares.length - 1] = room - sum(shares.slice(0, -1));
    const queues = focus.map((f, i) => Array.from({ length: shares[i] }, () => f.sk.id));
    /* interleave the skills: mixing them makes you recognise *which* method to use */
    while (queues.some(q => q.length)) queues.forEach(q => { if (q.length) plan.push({ skill: q.shift(), why: 'focus' }); });
  }
  if (due) plan.splice(Math.min(3, plan.length), 0, { skill: due.sk.id, why: 'check' });
  return { plan: plan.slice(0, size), focus: focus.map(f => f.sk.id), check: due ? due.sk.id : null };
}
/* Diagnostic: one task per skill, a second one only where the first was wrong */
function planDiagnostic(subj) { return SUBJECTS[subj].skills.map(sk => ({ skill: sk.id, why: 'diag' })); }

/* level 1..3 follows how well the skill is known */
const levelFor = p => (p < 0.35 ? 1 : p < 0.7 ? 2 : 3);
