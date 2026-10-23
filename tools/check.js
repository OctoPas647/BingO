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

/* 4. first-run setup (58-onboarding.js): steps, validation, resume */
const ONB_EXAM = E('ONBOARD.steps.findIndex(s => s.id === "exam")');
E('resetState(false); S.onboarding = null');
if (!E('onboardingNeeded()')) fail('onboarding: a fresh install should see the setup');
E('onboardingNext({})');                                                         // welcome
if (E('onboardingNext({ name: "x".repeat(41), age: "17" }).ok')) fail('onboarding: a 41-letter name should be refused');
if (E('onboardingNext({ name: "Мария П.", age: "abc" }).ok')) fail('onboarding: a non-number age should be refused');
if (!E('onboardingNext({ name: "Мария П.", age: "17" }).ok') || E('S.profile.name') !== 'Мария П.') fail('onboarding: name not saved');
if (E('S.profile.exam') !== 'dzi12' || E('obTitle(obStep())') !== 'Значи за ДЗИ 12-ти клас, нали?') fail('onboarding: age 17 should suggest the ДЗИ in 12th grade');
if (E('examFromAge(16)') !== 'nvo10' || E('examFromAge(13)') !== 'nvo7' || E('examFromAge(9)') !== 'nvo4' || E('examFromAge("")') !== '') fail('onboarding: wrong exam for an age');
if (E('onboardingNext({ exam: "xx" }).ok')) fail('onboarding: unknown exam accepted');
E('onboardingNext({ exam: "dzi12" })');
if (E('obStep().id') !== 'track') fail('onboarding: ДЗИ should ask for the profile');
if (E('onboardingNext({ track: "xx" }).ok')) fail('onboarding: unknown profile accepted');
E('onboardingNext({ track: "math" })');
if (E('S.profile.track') !== 'math' || !E('examPlan("dzi12", "math")').includes('информатика')) fail('onboarding: profile not saved or not used');
E('onboardingBack(); onboardingBack(); onboardingNext({ exam: "nvo7" })');
if (E('obStep().id') !== 'subject' || E('S.profile.track') !== '') fail('onboarding: 7th grade should skip the profile');
if (E('onboardingBack().step') !== ONB_EXAM) fail('onboarding: back from the subject should pass over the skipped profile');
E('onboardingNext({ exam: "dzi12" }); onboardingNext({ track: "prof" })');
if (E('onboardingNext({ subject: "xx" }).ok')) fail('onboarding: unknown subject accepted');
E('onboardingNext({ subject: "bel" })'); if (E('S.subject') !== 'bel') fail('onboarding: subject not saved');
E('onboardingNext({ theme: "amoled" })');
if (E('onboardingNext({ aiMode: "key", apiKey: "" }).ok')) fail('onboarding: API key mode without a key accepted');
E('onboardingNext({ aiMode: "off" })');
if (E('onboardingNext({ sheetUrl: "https://example.com" }).ok')) fail('onboarding: non-Apps-Script URL accepted');
E('onboardingSkip()');
if (!E('onboardingNext({}).done') || E('onboardingNeeded()')) fail('onboarding: finishing did not stick');
E('S.onboarding = null; S.log = [{ t: 1 }]'); if (E('onboardingNeeded()')) fail('onboarding: an existing user should not see the setup');
E('resetState(false)');

/* 5. spaced review (57-review.js) */
const box = E("reviewUpdate('math.quad', true, 0); reviewUpdate('math.quad', true, 0).box"); if (box !== 2) fail('review: two right answers should reach box 2, got ' + box);
if (E("reviewUpdate('math.quad', false, 0).box") !== 0) fail('review: a wrong answer should go back to box 0');

console.log(`${n} tasks checked, ${fails} problems`);
process.exit(fails ? 1 : 0);
