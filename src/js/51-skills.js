/* ================= Skills, misconceptions and the knowledge model ================= */

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
      { id: 'lit', name: 'Литература: Дебелянов', weight: 10 },
      { id: 'thesis', name: 'Теза и основна идея', weight: 6 },
      { id: 'structure', name: 'Структура и логическа връзка', weight: 6 },
      { id: 'argumentation', name: 'Аргументация и примери', weight: 8 },
      { id: 'language', name: 'Език, стил и правопис', weight: 8 },
      { id: 'task', name: 'Съответствие с задачата', weight: 6 }
    ]
  }
};
const skillDef = (subj, id) => skillList(subj).find(s => s.id === id) || SUBJECTS[subj].skills.find(s => s.id === id);

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
  'pct.reverse': 'Обратният процент: делим на $(1+p)$, не умножаваме на $(1-p)$',
  'pow.mult_exp': 'При умножение показателите се събират, не се умножават',
  'pow.sign': 'Знак на показателя',
  'pow.root_square': 'Извлечено е число, а не коренът му',
  'pow.swap': 'Разменени множители под и пред корена',
  'pow.add_root': 'Коренът от сбор е сбор от корени',
  'pow.neg_sign': 'Отрицателният показател прави числото отрицателно',
  'pow.neg_ignored': 'Отрицателният показател обръща дробта',
  'lin.flip': 'При деление на отрицателно число знакът на неравенството се обръща',
  'lin.move_sign': 'Знак при пренасяне от една страна на друга',
  'lin.divide': 'Деление вместо изваждане (или обратно)',
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
  'prob.part_whole': 'Делим на всички възможности, а не на благоприятните',
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
  'spell.num': 'Сложни прилагателни с числително, написано с думи, се пишат слято',
  'spell.compass': 'Посоките се пишат слято: северозапад',
  'calc': 'Сметкова грешка'
};
const miscLabel = code => MISC[code] || MISC[code && code.split('.').pop()] || 'Друга грешка';

const BKT = { prior: 0.3, learn: 0.1, slip: 0.12, strong: 0.9, weak: 0.6 };
const guessOf = task => (task.type === 'choice' ? 1 / task.options.length : task.type === 'gaps' && task.gaps.every(g => g.options) ? Math.min(0.2, Math.pow(0.5, task.gaps.length)) : 0.2);

function skillState(subj, id) {
  const k = subj + '.' + id + '@' + currentExamKey();
  if (!S.skills[k] && S.skills[subj + '.' + id]) { S.skills[k] = S.skills[subj + '.' + id]; delete S.skills[subj + '.' + id]; }
  return S.skills[k] || (S.skills[k] = { p: BKT.prior, n: 0, ok: 0, last: 0, misc: {}, hist: [] });
}
function bktUpdate(p, correct, guess, learn = BKT.learn, maxJump = 1) {
  const s = BKT.slip, g = clamp(guess, 0.01, 0.5);
  const post = correct ? p * (1 - s) / (p * (1 - s) + (1 - p) * g) : p * s / (p * s + (1 - p) * (1 - g));
  const next = correct ? clamp(post + (1 - post) * learn, 0.01, 0.995) : post;
  return clamp(correct ? next : Math.min(p, next), p - maxJump, p + maxJump);
}
function bktStep(st, correct, guess) {
  const learn = BKT.learn * (st.n < 3 ? 0.25 : st.n < 6 ? 0.65 : 1);
  const maxJump = st.n < 2 ? 0.05 : st.n < 4 ? 0.10 : st.n < 7 ? 0.16 : 0.22;
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

function recordEssayCriterion(id, rating) {
  const st = skillState('bel', id), before = st.p, correct = rating >= 3;
  st.p = bktUpdate(st.p, correct, 0.2);
  st.n++; if (correct) st.ok++;
  st.last = Date.now();
  st.hist.push([Date.now(), roundTo(st.p, 3)]); if (st.hist.length > 60) st.hist.shift();
  saveState();
  return { before, after: st.p, correct };
}

function skillStatus(st) { if (st.n < 2) return 'new'; if (st.p >= BKT.strong && st.n >= 3) return 'strong'; if (st.p < BKT.weak) return 'weak'; return 'mid'; }
const STATUS_LABEL = { new: 'Малко данни', weak: 'Слабо', mid: 'Почти', strong: 'Силно' };

const pointsLost = (sk, st) => sk.weight * (1 - st.p);
function subjectSummary(subj) {
  const list = skillList(subj).map(sk => { const st = skillState(subj, sk.id); return { sk, st, status: skillStatus(st), lost: pointsLost(sk, st) }; });
  const total = sum(list.map(x => x.sk.weight)), lost = sum(list.map(x => x.lost)), answered = sum(list.map(x => x.st.n));
  return { list, total, lost, answered, diagnosed: list.every(x => x.st.n >= 1) };
}

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
    while (queues.some(q => q.length)) queues.forEach(q => { if (q.length) plan.push({ skill: q.shift(), why: 'focus' }); });
  }
  if (due) plan.splice(Math.min(3, plan.length), 0, { skill: due.sk.id, why: 'check' });
  return { plan: plan.slice(0, size), focus: focus.map(f => f.sk.id), check: due ? due.sk.id : null };
}
function planDiagnostic(subj) { return skillList(subj).map(sk => ({ skill: sk.id, why: 'diag' })); }

const levelFor = p => {
  const g = nvoGrade(), t = g ? NVO_PROFILES.math[g].levels : { weak: 0.35, mid: 0.7 };
  return p < t.weak ? 1 : p < t.mid ? 2 : 3;
};

const NVO_PROFILES = {
  math: {
    4: { levels: { weak: 0.5, mid: 0.8 }, maxLevel: 2, skills: [
      { id: 'pct', name: 'Проценти', weight: 14 }, { id: 'rtri', name: 'Правоъгълен триъгълник', weight: 12 }, { id: 'prob', name: 'Вероятности', weight: 10 }] },
    7: { levels: { weak: 0.4, mid: 0.7 }, maxLevel: 3, skills: [
      { id: 'quad', name: 'Квадратни уравнения', weight: 12 }, { id: 'pct', name: 'Проценти', weight: 10 }, { id: 'pow', name: 'Степени и корени', weight: 10 },
      { id: 'lin', name: 'Линейни неравенства', weight: 10 }, { id: 'rtri', name: 'Правоъгълен триъгълник', weight: 12 }, { id: 'prog', name: 'Аритметична прогресия', weight: 8 },
      { id: 'prob', name: 'Вероятности', weight: 8 }] },
    10: { levels: { weak: 0.35, mid: 0.65 }, maxLevel: 3, skills: [
      { id: 'quad', name: 'Квадратни уравнения', weight: 14 }, { id: 'pow', name: 'Степени и корени', weight: 12 }, { id: 'lin', name: 'Линейни неравенства', weight: 12 },
      { id: 'rtri', name: 'Правоъгълен триъгълник', weight: 12 }, { id: 'prog', name: 'Аритметична прогресия', weight: 10 }, { id: 'prob', name: 'Вероятности', weight: 10 }] }
  }
};
const nvoGrade = () => ({ nvo4: '4', nvo7: '7', nvo10: '10' })[S.profile && S.profile.exam] || null;
function skillList(subj) {
  const g = nvoGrade(), prof = g && NVO_PROFILES[subj] && NVO_PROFILES[subj][g];
  return prof ? prof.skills : SUBJECTS[subj].skills;
}
