/* ================= Math task generators =================
   The idea comes from BrainBurst: a task is built from a seed, so there is an endless supply
   of fresh variants and nobody can learn the answers by heart. Every wrong option is built
   from one typical mistake, so a wrong answer tells us which mistake was made.
   Output is a normal Shelly task (choice / number) plus: skill, level, misc (per option). */

function seedRng(seed) {
  const f = rng(String(seed));
  const R = {
    f,
    int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
    nz: (lo, hi) => { let v = 0; while (v === 0) v = lo + Math.floor(f() * (hi - lo + 1)); return v; },
    pick: a => a[Math.floor(f() * a.length)],
    chance: p => f() < p
  };
  return R;
}
const gcdN = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
/* a number in LaTeX with the Bulgarian decimal comma */
const N = x => { const v = roundTo(x, 4); const s = String(Math.abs(v)).replace('.', '{,}'); return (v < 0 ? '-' : '') + s; };
/* a reduced fraction in LaTeX */
function Fr(a, b) {
  if (b < 0) { a = -a; b = -b; }
  const g = gcdN(a, b); a /= g; b /= g;
  if (b === 1) return N(a);
  return (a < 0 ? '-' : '') + `\\frac{${Math.abs(a)}}{${b}}`;
}
const term = (k, v, first) => { if (k === 0) return ''; const s = k < 0 ? '-' : first ? '' : '+'; const a = Math.abs(k); return s + (a === 1 && v ? '' : a) + v; };
const poly = (...pairs) => pairs.map(([k, v], i) => term(k, v, pairs.slice(0, i).every(([kk]) => kk === 0))).join('') || '0';

/* Canonical form used only to detect duplicate option values.
   It turns LaTeX fractions and numbers with Bulgarian decimal commas into numbers;
   other expressions fall back to whitespace-normalized text. */
function normalize(t) {
  const s = String(t).replace(/\s+/g, '');
  const frac = s.match(/^(-?)\\frac\{(-?\d+)\}\{(-?\d+)\}$/);
  if (frac) return String(Number(frac[1] + frac[2]) / Number(frac[3]));
  const num = s.replace(/\{,\}/g, '.');
  if (/^-?\d+(\.\d+)?$/.test(num)) return String(Number(num));
  return s;
}

/* A choice task from a right answer and distractors that each come from a named mistake.
   Duplicates (a mistake that happens to give the right value) are dropped and filled with near misses. */
function mcTask(r, { prompt, right, wrong, explain, fill }) {
  const opts = [{ t: right, misc: null }];
  for (const w of wrong) if (w && !opts.some(o => normalize(o.t) === normalize(w.t))) opts.push(w);
  const extra = (fill || []).slice();
  while (opts.length < 4 && extra.length) { const t = extra.shift(); if (!opts.some(o => normalize(o.t) === normalize(t))) opts.push({ t, misc: 'calc' }); }
  /* still fewer than four: add near misses (one number in the right answer changed slightly) */
  if (opts.length < 4) for (const t of nearMisses(right)) { if (opts.length >= 4) break; if (!opts.some(o => normalize(o.t) === normalize(t))) opts.push({ t, misc: 'calc' }); }
  const pick = opts.slice(0, 4), order = shuffledIdx(pick.length, String(r.f()));
  const o = order.map(i => pick[i]);
  return {
    type: 'choice', prompt, explain,
    options: o.map(x => '$' + x.t + '$'),
    answer: o.findIndex(x => x.misc === null),
    misc: o.map(x => x.misc)
  };
}
/* Near misses for mcTask: the right answer with one of its numbers moved by 1, 2 or 10 */
function nearMisses(right) {
  const out = [];
  for (const m of String(right).matchAll(/-?\d+(?:\{,\}\d+)?/g)) for (const d of [1, -1, 2, -2, 10, -10]) {
    const v = roundTo(parseFloat(m[0].replace('{,}', '.')) + d, 4), rep = N(v);
    const t = right.slice(0, m.index) + rep + right.slice(m.index + m[0].length);
    if (t !== right && !out.includes(t)) out.push(t);
  }
  return out;
}
/* A typed-number task; known wrong values map to mistakes */
const numTask = ({ prompt, answer, explain, wrongs, unit }) => ({ type: 'number', prompt, answer, explain, unit, numMisc: (wrongs || []).filter(w => Number.isFinite(w.v) && Math.abs(w.v - answer) > 0.011) });

const MATH_GEN = {
  quad(r, lvl) {
    if (lvl === 1) {
      let p = r.nz(-7, 8), q = r.nz(-7, 8); if (p === q) q = p + 1 || 2;
      const s = p + q, pr = p * q;
      const set = (a, b) => `x_1=${N(Math.max(a, b))},\\ x_2=${N(Math.min(a, b))}`;
      return mcTask(r, {
        prompt: `Корените на уравнението $${poly([1, 'x^2'], [-s, 'x'], [pr, ''])}=0$ са:`,
        right: set(p, q),
        wrong: [{ t: set(-p, -q), misc: 'quad.viet_sign' }, { t: set(s, pr === s ? pr + 1 : pr), misc: 'quad.viet_swap' }, { t: set(p, -q), misc: 'calc' }],
        fill: [set(p + 1, q + 1), set(p - 1, q + 2)],
        explain: `$D=${N(s * s)}${pr < 0 ? '+' + N(-4 * pr) : '-' + N(4 * pr)}=${N((p - q) ** 2)}$, $\\sqrt{D}=${N(Math.abs(p - q))}$, затова $x_{1,2}=\\frac{${N(s)}\\pm${N(Math.abs(p - q))}}{2}$, т.е. $${set(p, q)}$. Проверка с Виет: $x_1+x_2=${N(s)}$, $x_1x_2=${N(pr)}$.`
      });
    }
    if (lvl === 2) {
      let a, b, c;
      do {
        a = r.pick([2, 3, 4, 5]);
        b = r.nz(-9, 9);
        c = r.nz(-9, 9);
      } while (b * b - 4 * a * c < 0);
      const askSum = r.chance(0.6);
      return mcTask(r, askSum ? {
        prompt: `Ако $x_1$ и $x_2$ са корените на $${poly([a, 'x^2'], [b, 'x'], [c, ''])}=0$, то $x_1+x_2$ е:`,
        right: Fr(-b, a), wrong: [{ t: Fr(b, a), misc: 'quad.viet_sign' }, { t: N(-b), misc: 'quad.forgot_a' }, { t: Fr(c, a), misc: 'quad.viet_swap' }],
        fill: [Fr(-b, 2 * a), Fr(-c, a)],
        explain: `По формулите на Виет $x_1+x_2=-\\frac{b}{a}=${Fr(-b, a)}$.`
      } : {
        prompt: `Ако $x_1$ и $x_2$ са корените на $${poly([a, 'x^2'], [b, 'x'], [c, ''])}=0$, то $x_1\\cdot x_2$ е:`,
        right: Fr(c, a), wrong: [{ t: Fr(-c, a), misc: 'quad.viet_sign' }, { t: N(c), misc: 'quad.forgot_a' }, { t: Fr(-b, a), misc: 'quad.viet_swap' }],
        fill: [Fr(c, 2 * a), Fr(b, a)],
        explain: `По формулите на Виет $x_1x_2=\\frac{c}{a}=${Fr(c, a)}$.`
      });
    }
    const b = 2 * r.int(2, 6), k = b * b / 4; /* x^2 - b x + m = 0 has two roots when m < b^2/4 */
    return mcTask(r, {
      prompt: `За кои стойности на параметъра $m$ уравнението $x^2-${b}x+m=0$ има **два различни** реални корена?`,
      right: `m<${k}`, wrong: [{ t: `m>${k}`, misc: 'quad.ineq_dir' }, { t: `m\\le ${k}`, misc: 'quad.strict' }, { t: `m<${b * b}`, misc: 'quad.D_formula' }],
      explain: `Два различни корена има при $D>0$: $D=${b * b}-4m>0$, значи $4m<${b * b}$ и $m<${k}$. При $m=${k}$ коренът е двоен.`
    });
  },

  pct(r, lvl) {
    if (lvl === 1) {
      const P = r.pick([40, 60, 80, 120, 150, 200, 250]), k = r.pick([10, 15, 20, 25, 30]), up = r.chance(0.6);
      const right = P * (1 + (up ? 1 : -1) * k / 100);
      return mcTask(r, {
        prompt: `Цената на стока е $${P}$ лв. Тя ${up ? 'се увеличава' : 'се намалява'} с $${k}\\%$. Колко струва стоката след ${up ? 'увеличението' : 'намалението'}?`,
        right: N(right) + '\\text{ лв.}',
        wrong: [{ t: N(up ? P + k : P - k) + '\\text{ лв.}', misc: 'pct.as_number' }, { t: N(P * k / 100) + '\\text{ лв.}', misc: 'pct.only_part' }, { t: N(P * (1 - (up ? 1 : -1) * k / 100)) + '\\text{ лв.}', misc: 'pct.direction' }],
        explain: `$${k}\\%$ от ${P} е $${N(P * k / 100)}$ лв., затова новата цена е $${P}${up ? '+' : '-'}${N(P * k / 100)}=${N(right)}$ лв. Или направо: $${P}\\cdot${N(1 + (up ? 1 : -1) * k / 100)}$.`
      });
    }
    if (lvl === 2) {
      const a = r.pick([10, 20, 30, 40, 50]), drop = a * a / 100;
      return mcTask(r, {
        prompt: `Цената на стока първо се увеличава с $${a}\\%$, а след това новата цена се намалява с $${a}\\%$. Как се е променила цената спрямо началната?`,
        right: `\\text{намалява с } ${N(drop)}\\%`,
        wrong: [{ t: '\\text{не се променя}', misc: 'pct.add_pcts' }, { t: `\\text{увеличава се с } ${N(drop)}\\%`, misc: 'pct.direction' }, { t: `\\text{намалява с } ${a}\\%`, misc: 'calc' }],
        explain: `Ако началната цена е $100$: след увеличението е $${100 + a}$, а $${a}\\%$ от $${100 + a}$ е $${N((100 + a) * a / 100)}$. Остава $${N((100 + a) * (100 - a) / 100)}$, т.е. с $${N(drop)}\\%$ по-малко. Процентите се смятат от различни основи, затова не се „унищожават“.`
      });
    }
    const k = r.pick([10, 20, 25, 50]), O = r.pick([40, 60, 80, 120, 160, 200]), Nn = O * (1 + k / 100);
    return numTask({
      prompt: `След поскъпване с $${k}\\%$ една стока струва $${N(Nn)}$ лв. Колко е струвала **преди** поскъпването (в лв.)?`,
      answer: O, unit: 'лв.',
      wrongs: [{ v: roundTo(Nn * (1 - k / 100), 2), misc: 'pct.reverse' }, { v: Nn - k, misc: 'pct.as_number' }],
      explain: `Новата цена е $${N(1 + k / 100)}$ пъти старата: $x\\cdot${N(1 + k / 100)}=${N(Nn)}$, затова $x=${N(Nn)}:${N(1 + k / 100)}=${O}$. Изваждането на $${k}\\%$ от новата цена дава грешен резултат, защото процентът е бил от старата.`
    });
  },

  pow(r, lvl) {
    if (lvl === 1) {
      const a = r.pick([2, 3, 5]), m = r.int(3, 7), n = -r.int(1, m - 1), e = m + n;
      return mcTask(r, {
        prompt: `Стойността на израза $${a}^{${m}}\\cdot ${a}^{${n}}$ е:`,
        right: N(a ** e), wrong: [{ t: `${a}^{${m * n}}`, misc: 'pow.mult_exp' }, { t: N(a ** (m - n)), misc: 'pow.sign' }, { t: N(a * a) + `^{${e}}`, misc: 'calc' }],
        fill: [N(a ** (e + 1)), N(a ** e * 2)],
        explain: `При умножение на степени с еднаква основа показателите се събират: $${a}^{${m}+(${n})}=${a}^{${e}}=${N(a ** e)}$.`
      });
    }
    if (lvl === 2) {
      const k = r.pick([2, 3, 4, 5, 6]), m = r.pick([2, 3, 5, 6, 7]), x = k * k * m;
      return mcTask(r, {
        prompt: `Изнесете множител пред корена: $\\sqrt{${x}}=$`,
        right: `${k}\\sqrt{${m}}`, wrong: [{ t: `${k * k}\\sqrt{${m}}`, misc: 'pow.root_square' }, { t: `${m}\\sqrt{${k}}`, misc: 'pow.swap' }, { t: `${k}\\sqrt{${m * 2}}`, misc: 'calc' }],
        explain: `$${x}=${k * k}\\cdot ${m}$ и $${k * k}$ е точен квадрат, затова $\\sqrt{${x}}=\\sqrt{${k * k}}\\cdot\\sqrt{${m}}=${k}\\sqrt{${m}}$.`
      });
    }
    let a = r.pick([2, 3, 4, 5]), b = r.pick([3, 5, 7]); if (a === b) b = 7;
    return mcTask(r, {
      prompt: `Стойността на $\\left(\\frac{${a}}{${b}}\\right)^{-2}$ е:`,
      right: Fr(b * b, a * a), wrong: [{ t: '-' + Fr(a * a, b * b), misc: 'pow.neg_sign' }, { t: Fr(a * a, b * b), misc: 'pow.neg_ignored' }, { t: '-' + Fr(2 * a, b), misc: 'pow.mult_exp' }],
      explain: `Отрицателният показател обръща дробта: $\\left(\\frac{${a}}{${b}}\\right)^{-2}=\\left(\\frac{${b}}{${a}}\\right)^{2}=${Fr(b * b, a * a)}$. Знакът на числото не се сменя.`
    });
  },

  lin(r, lvl) {
    if (lvl === 1) {
      const x = r.nz(-9, 12), a = r.int(2, 9), b = r.nz(-15, 15), c = a * x + b;
      return numTask({
        prompt: `Решете уравнението $${poly([a, 'x'], [b, ''])}=${c}$. На колко е равно $x$?`,
        answer: x, wrongs: [{ v: (c + b) / a, misc: 'lin.move_sign' }, { v: c - b - a, misc: 'lin.divide' }],
        explain: `Пренасяме $${N(b)}$: $${a}x=${c}${b > 0 ? '-' : '+'}${Math.abs(b)}=${c - b}$, после делим на $${a}$: $x=${x}$.`
      });
    }
    const a = r.int(2, 6), b = r.nz(-9, 9), x0 = r.nz(-6, 6), neg = lvl === 3;
    const A = neg ? -a : a, c = A * x0 + b; /* A x + b < c  ->  A x < c-b */
    const sign = neg ? '>' : '<', rhs = neg ? '<' : '>'; /* solution direction */
    return mcTask(r, {
      prompt: `Решенията на неравенството $${poly([A, 'x'], [b, ''])}${sign === '<' ? '<' : '<'}${c}$ са:`,
      right: `x${neg ? '>' : '<'}${N(x0)}`,
      wrong: [{ t: `x${neg ? '<' : '>'}${N(x0)}`, misc: neg ? 'lin.flip' : 'lin.move_sign' }, { t: `x${neg ? '>' : '<'}${N(-x0) === N(x0) ? N(x0 + 1) : N(-x0)}`, misc: 'lin.move_sign' }, { t: `x${neg ? '>' : '<'}${N((c + b) / A)}`, misc: 'lin.move_sign' }],
      fill: [`x${neg ? '>' : '<'}${N(x0 + 2)}`, `x${neg ? '<' : '>'}${N(x0 - 1)}`],
      explain: `$${A}x<${c}${b > 0 ? '-' : '+'}${Math.abs(b)}$, т.е. $${A}x<${c - b}$. ${neg ? `Делим на $${A}$ — отрицателно число, затова знакът се обръща: $x>${N(x0)}$.` : `Делим на $${A}>0$ и знакът остава: $x<${N(x0)}$.`}`
    });
  },

  rtri(r, lvl) {
    const [p, q, h] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]), k = r.pick([1, 2, 3]);
    const a = p * k, b = q * k, c = h * k;
    if (lvl === 1) return numTask({
      prompt: `Катетите на правоъгълен триъгълник са $${a}$ cm и $${b}$ cm. Колко сантиметра е хипотенузата?`,
      answer: c, unit: 'cm', wrongs: [{ v: a + b, misc: 'rtri.add_legs' }, { v: a * a + b * b, misc: 'rtri.no_root' }],
      explain: `По Питагоровата теорема $c^2=${a}^2+${b}^2=${a * a}+${b * b}=${c * c}$, затова $c=\\sqrt{${c * c}}=${c}$ cm.`
    });
    if (lvl === 2) return numTask({
      prompt: `Хипотенузата на правоъгълен триъгълник е $${c}$ cm, а единият катет е $${a}$ cm. Колко сантиметра е другият катет?`,
      answer: b, unit: 'cm', wrongs: [{ v: roundTo(Math.sqrt(c * c + a * a), 2), misc: 'rtri.hyp_as_leg' }, { v: c - a, misc: 'rtri.add_legs' }, { v: c * c - a * a, misc: 'rtri.no_root' }],
      explain: `$b^2=c^2-a^2=${c * c}-${a * a}=${b * b}$, затова $b=${b}$ cm.`
    });
    return mcTask(r, {
      prompt: `В $\\triangle ABC$ с $\\angle C=90^\\circ$ катетите са $BC=${a}$, $AC=${b}$, а хипотенузата е $AB=${c}$. На колко е равно $\\sin\\angle A$?`,
      right: Fr(a, c), wrong: [{ t: Fr(b, c), misc: 'rtri.sin_cos' }, { t: Fr(a, b), misc: 'rtri.tan' }, { t: Fr(c, a), misc: 'rtri.inverse' }],
      explain: `Синусът е срещулежащият катет върху хипотенузата. Срещу $\\angle A$ е $BC$, затова $\\sin\\angle A=\\frac{BC}{AB}=${Fr(a, c)}$.`
    });
  },

  prog(r, lvl) {
    if (lvl === 1) {
      const a1 = r.nz(-8, 12), d = r.nz(-5, 6), n = r.int(6, 15), an = a1 + (n - 1) * d;
      return numTask({
        prompt: `В аритметична прогресия $a_1=${N(a1)}$ и $d=${N(d)}$. Намерете $a_{${n}}$.`,
        answer: an, wrongs: [{ v: a1 + n * d, misc: 'prog.n_vs_n1' }, { v: a1 - (n - 1) * d, misc: 'prog.sign' }],
        explain: `$a_n=a_1+(n-1)d$, затова $a_{${n}}=${N(a1)}+${n - 1}\\cdot(${N(d)})=${N(an)}$.`
      });
    }
    if (lvl === 2) {
      const a1 = r.nz(-6, 10), d = r.nz(-4, 5), k = r.int(2, 4), m = k + r.int(3, 6);
      const ak = a1 + (k - 1) * d, am = a1 + (m - 1) * d;
      return numTask({
        prompt: `В аритметична прогресия $a_{${k}}=${N(ak)}$ и $a_{${m}}=${N(am)}$. Намерете разликата $d$.`,
        answer: d, wrongs: [{ v: roundTo((am - ak) / m, 4), misc: 'prog.index_diff' }, { v: -d, misc: 'prog.sign' }],
        explain: `$a_{${m}}-a_{${k}}=(${m}-${k})d$, т.е. $${N(am - ak)}=${m - k}d$ и $d=${N(d)}$.`
      });
    }
    const a1 = r.int(1, 9), d = r.int(1, 5), n = r.pick([10, 12, 15, 20]), an = a1 + (n - 1) * d, Sn = n * (a1 + an) / 2;
    return numTask({
      prompt: `Намерете сбора на първите $${n}$ члена на аритметичната прогресия $${a1}, ${a1 + d}, ${a1 + 2 * d}, \\dots$`,
      answer: Sn, wrongs: [{ v: n * (a1 + an), misc: 'prog.forgot_half' }, { v: n * (a1 + a1 + n * d) / 2, misc: 'prog.n_vs_n1' }],
      explain: `$d=${d}$, $a_{${n}}=${a1}+${n - 1}\\cdot${d}=${an}$, $S_{${n}}=\\frac{${n}(a_1+a_{${n}})}{2}=\\frac{${n}\\cdot${a1 + an}}{2}=${Sn}$.`
    });
  },

  prob(r, lvl) {
    if (lvl === 1) {
      const red = r.int(2, 9), blue = r.int(2, 9);
      return mcTask(r, {
        prompt: `В кутия има $${red}$ червени и $${blue}$ сини топки. Изваждаме една топка наслуки. Каква е вероятността тя да е червена?`,
        right: Fr(red, red + blue), wrong: [{ t: Fr(red, blue), misc: 'prob.part_whole' }, { t: Fr(blue, red + blue), misc: 'prob.complement' }, { t: Fr(1, red + blue), misc: 'calc' }],
        fill: [Fr(1, 2), Fr(red, 2 * (red + blue))],
        explain: `Благоприятни са $${red}$ от всички $${red + blue}$ равновъзможни изхода: $P=${Fr(red, red + blue)}$.`
      });
    }
    if (lvl === 2) {
      const s = r.pick([4, 5, 6, 8, 9, 10]), ways = 6 - Math.abs(7 - s);
      return mcTask(r, {
        prompt: `Хвърляме два зара. Каква е вероятността сборът от точките да е $${s}$?`,
        right: Fr(ways, 36), wrong: [{ t: Fr(1, 11), misc: 'prob.not_equal' }, { t: Fr(ways, 12), misc: 'prob.space' }, { t: Fr(36 - ways, 36), misc: 'prob.complement' }],
        explain: `Изходите са $6\\cdot6=36$ равновероятни подредени двойки. Сбор $${s}$ дават $${ways}$ от тях, затова $P=${Fr(ways, 36)}$. Сборовете от 2 до 12 не са равновероятни.`
      });
    }
    const n = r.pick([2, 3, 4]);
    return mcTask(r, {
      prompt: `Хвърляме монета $${n}$ пъти. Каква е вероятността да се падне **поне едно** ези?`,
      right: Fr(2 ** n - 1, 2 ** n), wrong: [{ t: Fr(n, 2 ** n), misc: 'prob.exactly' }, { t: Fr(1, 2 ** n), misc: 'prob.complement' }, { t: Fr(1, 2), misc: 'prob.space' }],
      explain: `По-лесно е през противоположното събитие „нито едно ези“: $P=\\left(\\frac12\\right)^{${n}}=${Fr(1, 2 ** n)}$. Затова $P(\\text{поне едно})=1-${Fr(1, 2 ** n)}=${Fr(2 ** n - 1, 2 ** n)}$.`
    });
  }
};


/* ---------- the rest of the ДЗИ syllabus (0.6.0), worded like МОН's tasks ---------- */
Object.assign(MISC, {
  'trig.swap': 'Разменени $\\sin$ и $\\cos$ на специалния ъгъл',
  'trig.pyth': 'Забравено е $\\sin^2\\alpha+\\cos^2\\alpha=1$: косинусът не е равен на синуса',
  'trig.sign': 'Знакът на тригонометричната функция в II квадрант',
  'trig.inverse': 'Обърната дроб',
  'func.order': 'Сбъркан ред на действията при заместване',
  'func.sign': 'Знак при $x_0=-\\frac{b}{2a}$',
  'func.half': 'Забравено делене на $2a$',
  'func.axes': 'Разменени оси: пресечната точка с $Oy$ има $x=0$',
  'geom.half': 'Лицето на триъгълник е $\\frac{a\\cdot h_a}{2}$ — забравена е половината',
  'geom.circ': 'Объркани лице на кръг ($\\pi r^2$) и дължина на окръжност ($2\\pi r$)',
  'geom.diam': 'Използван е диаметърът вместо радиуса',
  'geom.sum': 'Сборът от вътрешните ъгли на $n$-ъгълник е $(n-2)\\cdot180^\\circ$',
  'stat.median': 'Средно аритметично и медиана са разменени',
  'stat.count': 'Делено е на грешен брой стойности',
  'stat.even': 'При четен брой стойности медианата е средното на двете в средата',
  'stat.order': 'Броени са наредени двойки, а изборът не зависи от реда'
});
const SPECIAL = [[30, '\\frac{1}{2}', '\\frac{\\sqrt{3}}{2}', 0.5, Math.sqrt(3) / 2], [45, '\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{2}}{2}', Math.SQRT1_2, Math.SQRT1_2], [60, '\\frac{\\sqrt{3}}{2}', '\\frac{1}{2}', Math.sqrt(3) / 2, 0.5]];
Object.assign(MATH_GEN, {
  trig(r, lvl) {
    if (lvl === 1) {
      const [a, sa, ca] = r.pick(SPECIAL.filter(x => x[0] !== 45)), f = r.chance(0.5) ? 'sin' : 'cos';
      const right = f === 'sin' ? sa : ca, wrong = f === 'sin' ? ca : sa;
      return mcTask(r, {
        prompt: `Стойността на $\\${f} ${a}^\\circ$ е:`,
        right, wrong: [{ t: wrong, misc: 'trig.swap' }, { t: '-' + right, misc: 'trig.sign' }, { t: right === '\\frac{1}{2}' ? '2' : '\\frac{2}{\\sqrt{3}}', misc: 'trig.inverse' }],
        explain: `От таблицата на специалните ъгли: $\\sin ${a}^\\circ=${sa}$, $\\cos ${a}^\\circ=${ca}$.`
      });
    }
    if (lvl === 2) {
      const [p, q, h] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
      return mcTask(r, {
        prompt: `Ако $\\alpha$ е остър ъгъл и $\\sin\\alpha=\\frac{${p}}{${h}}$, то $\\cos\\alpha$ е равно на:`,
        right: Fr(q, h), wrong: [{ t: Fr(p, h), misc: 'trig.pyth' }, { t: Fr(h, q), misc: 'trig.inverse' }, { t: '-' + Fr(q, h), misc: 'trig.sign' }],
        explain: `$\\cos^2\\alpha=1-\\sin^2\\alpha=1-\\frac{${p * p}}{${h * h}}=\\frac{${q * q}}{${h * h}}$. Ъгълът е остър, затова $\\cos\\alpha>0$ и $\\cos\\alpha=${Fr(q, h)}$.`
      });
    }
    const [a, sa, ca] = r.pick(SPECIAL), b = 180 - a, f = r.chance(0.5) ? 'sin' : 'cos';
    const right = f === 'sin' ? sa : '-' + ca;
    return mcTask(r, {
      prompt: `Стойността на $\\${f} ${b}^\\circ$ е:`,
      right, wrong: [{ t: f === 'sin' ? '-' + sa : ca, misc: 'trig.sign' }, { t: f === 'sin' ? ca : '-' + sa, misc: 'trig.swap' }, { t: f === 'sin' ? '-' + ca : sa, misc: 'trig.swap' }],
      explain: `$${b}^\\circ=180^\\circ-${a}^\\circ$ е във II квадрант: $\\sin(180^\\circ-\\alpha)=\\sin\\alpha$, а $\\cos(180^\\circ-\\alpha)=-\\cos\\alpha$. Затова $\\${f} ${b}^\\circ=${right}$.`
    });
  },
  func(r, lvl) {
    if (lvl === 1) {
      const a = r.nz(-5, 6), b = r.nz(-9, 9), x = r.nz(-4, 5), y = a * x + b;
      return mcTask(r, {
        prompt: `Дадена е функцията $f(x)=${poly([a, 'x'], [b, ''])}$. Стойността $f(${N(x)})$ е:`,
        right: N(y), wrong: [{ t: N(a * (x + b)), misc: 'func.order' }, { t: N(a * x - b), misc: 'calc' }, { t: N(-a * x + b), misc: 'func.sign' }],
        fill: [N(y + 1), N(y - 2)],
        explain: `Заместваме $x=${N(x)}$: $f(${N(x)})=${a}\\cdot(${N(x)})${b < 0 ? '-' + -b : '+' + b}=${N(y)}$.`
      });
    }
    if (lvl === 2) {
      const x0 = r.nz(-5, 5), y0 = r.int(-9, 9), b = -2 * x0, c = x0 * x0 + y0;
      const pt = (x, y) => `(${N(x)};\\,${N(y)})`;
      return mcTask(r, {
        prompt: `Координатите на върха на параболата $y=${poly([1, 'x^2'], [b, 'x'], [c, ''])}$ са:`,
        right: pt(x0, y0), wrong: [{ t: pt(-x0, (-x0) ** 2 + b * -x0 + c), misc: 'func.sign' }, { t: pt(-b, b * b + b * -b + c), misc: 'func.half' }, { t: pt(y0, x0), misc: 'func.axes' }],
        fill: [pt(x0, y0 + 1), pt(x0 + 1, y0)],
        explain: `$x_0=-\\frac{b}{2a}=-\\frac{${b}}{2}=${N(x0)}$, $y_0=f(${N(x0)})=${N(y0)}$. Върхът е $${pt(x0, y0)}$.`
      });
    }
    const a = r.nz(-4, 4), b = r.nz(-8, 8);
    const pt = (x, y) => `(${x};\\,${y})`;
    return mcTask(r, {
      prompt: `Графиката на функцията $y=${poly([a, 'x'], [b, ''])}$ пресича оста $Oy$ в точката:`,
      right: pt(0, N(b)), wrong: [{ t: pt(N(b), 0), misc: 'func.axes' }, { t: pt(0, N(a)), misc: 'calc' }, { t: pt(Fr(-b, a), 0), misc: 'func.axes' }],
      explain: `На оста $Oy$ е $x=0$, затова $y=${a}\\cdot0${b < 0 ? '-' + -b : '+' + b}=${N(b)}$: точката е $${pt(0, N(b))}$.`
    });
  },
  geom(r, lvl) {
    if (lvl === 1) {
      const a = r.int(4, 16), h = 2 * r.int(2, 9), S = a * h / 2;
      return mcTask(r, {
        prompt: `Страната на триъгълник е $${a}$ cm, а височината към нея е $${h}$ cm. Лицето на триъгълника е:`,
        right: `${N(S)}\\text{ cm}^2`, wrong: [{ t: `${N(a * h)}\\text{ cm}^2`, misc: 'geom.half' }, { t: `${N(a + h)}\\text{ cm}^2`, misc: 'calc' }, { t: `${N(S / 2)}\\text{ cm}^2`, misc: 'calc' }],
        explain: `$S=\\frac{a\\cdot h_a}{2}=\\frac{${a}\\cdot${h}}{2}=${N(S)}$ cm².`
      });
    }
    if (lvl === 2) {
      const rr = r.int(2, 9);
      return mcTask(r, {
        prompt: `Лицето на кръг с радиус $${rr}$ cm е:`,
        right: `${rr * rr}\\pi\\text{ cm}^2`, wrong: [{ t: `${2 * rr}\\pi\\text{ cm}^2`, misc: 'geom.circ' }, { t: `${4 * rr * rr}\\pi\\text{ cm}^2`, misc: 'geom.diam' }, { t: `${rr}\\pi\\text{ cm}^2`, misc: 'calc' }],
        explain: `$S=\\pi r^2=\\pi\\cdot${rr}^2=${rr * rr}\\pi$ cm². (Дължината на окръжността е $2\\pi r=${2 * rr}\\pi$ cm.)`
      });
    }
    const n = r.pick([5, 6, 7, 8, 9, 10, 12]);
    return mcTask(r, {
      prompt: `Сборът от вътрешните ъгли на изпъкнал ${n}-ъгълник е:`,
      right: `${(n - 2) * 180}^\\circ`, wrong: [{ t: `${n * 180}^\\circ`, misc: 'geom.sum' }, { t: `${(n - 1) * 180}^\\circ`, misc: 'geom.sum' }, { t: `360^\\circ`, misc: 'geom.sum' }],
      explain: `Сборът е $(n-2)\\cdot180^\\circ=(${n}-2)\\cdot180^\\circ=${(n - 2) * 180}^\\circ$.`
    });
  },
  stat(r, lvl) {
    if (lvl === 1) {
      let xs; do { xs = Array.from({ length: 5 }, () => r.int(2, 9)); } while (xs.reduce((a, b) => a + b) % 5);
      const mean = xs.reduce((a, b) => a + b) / 5, med = xs.slice().sort((a, b) => a - b)[2];
      return mcTask(r, {
        prompt: `Средното аритметично на числата $${xs.join(';\\ ')}$ е:`,
        right: N(mean), wrong: [{ t: N(med), misc: med === mean ? null : 'stat.median' }, { t: N(roundTo(xs.reduce((a, b) => a + b) / 4, 2)), misc: 'stat.count' }, { t: N(xs.reduce((a, b) => a + b)), misc: 'calc' }],
        fill: [N(mean + 1), N(mean - 1)],
        explain: `Сборът е $${xs.reduce((a, b) => a + b)}$, а числата са $5$: $${xs.reduce((a, b) => a + b)}:5=${N(mean)}$.`
      });
    }
    if (lvl === 2) {
      let xs; do { xs = Array.from({ length: 6 }, () => r.int(1, 20)).sort((a, b) => a - b); } while ((xs[2] + xs[3]) % 2 || xs[2] === xs[3]);
      const med = (xs[2] + xs[3]) / 2, shown = xs.slice().sort(() => r.f() - 0.5);
      return mcTask(r, {
        prompt: `Медианата на данните $${shown.join(';\\ ')}$ е:`,
        right: N(med), wrong: [{ t: N(xs[2]), misc: 'stat.even' }, { t: N(roundTo(xs.reduce((a, b) => a + b) / 6, 2)), misc: 'stat.median' }, { t: N(shown[2]), misc: 'stat.even' }],
        fill: [N(xs[3]), N(med + 1)],
        explain: `Подреждаме: $${xs.join(';\\ ')}$. Стойностите са $6$ (четен брой), затова медианата е средното на 3-тата и 4-тата: $\\frac{${xs[2]}+${xs[3]}}{2}=${N(med)}$.`
      });
    }
    const n = r.int(5, 12), c = n * (n - 1) / 2;
    return mcTask(r, {
      prompt: `По колко начина от $${n}$ ученици могат да се изберат двама дежурни?`,
      right: N(c), wrong: [{ t: N(n * (n - 1)), misc: 'stat.order' }, { t: N(2 * n), misc: 'calc' }, { t: N(n * n), misc: 'calc' }],
      explain: `Редът на избора няма значение, затова това са комбинации: $C_{${n}}^2=\\frac{${n}\\cdot${n - 1}}{2}=${c}$.`
    });
  }
});

function genMathTask(skill, level, seed) {
  const g = nvoGrade(); if (g) level = Math.min(level, NVO_PROFILES.math[g].maxLevel);   /* НВО 4: never level 3 */
  if (!MATH_GEN[skill] || (g === '4' && ['geom', 'func', 'trig', 'stat'].includes(skill))) return null;   /* НВО 4 uses its real exam tasks; skills without a generator (Планиметрия, НВО 4 …) use real exam tasks and Gemini */
  const r = seedRng(skill + ':' + level + ':' + seed);
  const t = MATH_GEN[skill](r, level);
  return { id: `g:${skill}:${level}:${seed}`, points: 1, media: [], ...t, skill, level, src: 'gen' };
}
