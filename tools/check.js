/* BingO checks: every generator variant is valid and renders, banks pass Shelly's module checker, the model behaves */
const vm = require('vm');
const ctx = require('./load-engine')();
const E = code => vm.runInContext(code, ctx);
let fails = 0, n = 0;
const fail = (what, t) => { fails++; if (fails < 25) console.log('FAIL', what, t ? JSON.stringify(t).slice(0, 400) : ''); };

/* math in a rich text string must render with KaTeX (the same way Shelly's rich() finds $...$) */
function mathOk(s) {
  const parts = String(s || '').match(/\$\$[\s\S]+?\$\$|\$[^$]+\$/g) || [];
  for (const p of parts) { const src = p.replace(/^\$\$?|\$\$?$/g, ''); try { ctx.katex.renderToString(src, { throwOnError: true }); } catch (e) { return p + ' -> ' + e.message; } }
  return null;
}
function checkTask(t, where) {
  n++;
  for (const s of [t.prompt, t.explain, ...(t.options || [])]) { const bad = mathOk(s); if (bad) fail(where + ' katex ' + bad, t); }
  if (!t.explain && t.src !== 'shelly') fail(where + ' no explain', t);
  if (t.type === 'choice') {
    if (t.options.length < 2) fail(where + ' few options', t);
    if (new Set(t.options).size !== t.options.length) fail(where + ' duplicate options', t);
    if (!(t.answer >= 0 && t.answer < t.options.length)) fail(where + ' answer index', t);
    if (t.misc && t.misc[t.answer] !== null) fail(where + ' misc on right answer', t);
    if (t.misc && t.misc.some((m, i) => i !== t.answer && m && !E(`!!MISC[${JSON.stringify(m)}]`))) fail(where + ' unknown misc', t);
    const r = E(`scoreTask(${JSON.stringify(t)}, ${t.answer}, 'bg')`); if (r.status !== 'right') fail(where + ' right answer not scored right', t);
  }
  if (t.type === 'number') {
    if (!Number.isFinite(t.answer)) fail(where + ' answer not finite', t);
    for (const w of t.numMisc || []) if (Math.abs(w.v - t.answer) < 0.011) fail(where + ' a mistake gives the right number', t);
    const r = E(`scoreTask(${JSON.stringify(t)}, ${JSON.stringify(String(t.answer).replace('.', ','))}, 'bg')`); if (r.status !== 'right') fail(where + ' typed answer not right', t);
  }
}

/* 1. generators: 7 skills x 3 levels x 150 seeds */
const skills = E('Object.keys(MATH_GEN)');
for (const sk of skills) for (const lvl of [1, 2, 3]) for (let s = 0; s < 150; s++) checkTask(E(`genMathTask(${JSON.stringify(sk)}, ${lvl}, ${s})`), `gen ${sk}/${lvl}/${s}`);
/* a choice task should usually keep 4 options */
const few = skills.flatMap(sk => [1, 2, 3].map(l => E(`genMathTask(${JSON.stringify(sk)}, ${l}, 7)`))).filter(t => t.type === 'choice' && t.options.length < 4);
if (few.length) console.log('note: choice tasks with fewer than 4 options:', few.map(t => t.id).join(', '));

/* 2. banks pass Shelly's module checker */
for (const subj of ['math', 'bel']) {
  const tasks = E(`BANK.${subj}`);
  for (const t of tasks) checkTask(t, `bank ${subj} ${t.id}`);
  const mod = { format: 1, id: 'bingo.check.' + subj, version: '1', lang: 'bg', title: 'x', passages: E(`SHELLY_MODS.${subj} ? SHELLY_MODS.${subj}.passages : {}`), exams: [{ id: 'x', title: 'x', parts: [{ title: 'x', tasks: JSON.parse(JSON.stringify(tasks)).map(t => { delete t.media; return t; }) }] }] };
  const { errors } = E(`checkModule(${JSON.stringify(mod)})`);
  errors.forEach(e => fail(`bank ${subj} module check: ${e.at} ${e.msg}`));
  E('SUBJECTS.' + subj).skills.forEach(s => { if (!tasks.some(t => t.skill === s.id) && !(subj === 'math' && E(`!!MATH_GEN.${s.id}`))) fail(`no tasks for ${subj}.${s.id}`); });
}

/* 3. the knowledge model */
let p = 0.3; for (let i = 0; i < 6; i++) { const q = E(`bktUpdate(${p}, true, 0.25)`); if (!(q > p || p > 0.98)) fail('BKT: right answer should raise p'); p = q; }
if (!(p > 0.9)) fail('BKT: six right answers should make a skill strong, got ' + p);
const w = E('bktUpdate(0.8, false, 0.25)'); if (!(w < 0.8)) fail('BKT: wrong answer should lower p');
E('simulateLearner()');
const plan = E("planSession('math', 8)");
if (plan.plan.filter(x => x.why === 'focus').length !== 8) fail('plan size ' + JSON.stringify(plan));
if (plan.plan.some(x => ['quad', 'rtri'].includes(x.skill) && x.why === 'focus')) console.log('note: demo plan trains a strong skill', JSON.stringify(plan.focus));
console.log(`demo learner -> focus: ${plan.focus.join(', ')}${plan.check ? ' · check: ' + plan.check : ''}`);
const sm = E("subjectSummary('math')"); console.log('demo learner loses ≈', sm.lost.toFixed(1), 'of', sm.total, 'points');

console.log(`${n} tasks checked, ${fails} problems`);
process.exit(fails ? 1 : 0);
