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
  /* two signs in a row ("25--24", "3+-2") read as a typo; a negative number after an operator needs brackets */
  for (const s of [t.prompt, t.explain, ...(t.options || [])]) for (const m of String(s || '').match(/\$[^$]+\$/g) || []) if (/[-+]\s*[-+]/.test(m.replace(/\\pm/g, '±'))) fail(where + ' double sign ' + m, t);
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

/* 3b. past exams (content/past-exams, 66-past.js): every file loads, math renders, media exists, the key scores right */
{
  const fsx = require('fs'), px = require('path'), dir = px.join(__dirname, '../content/past-exams');
  const raw = E('PAST_EXAMS_JSON'), loaded = E('PAST.map(m => m.id)');
  for (const j of raw) {
    const at = 'past ' + j.id;
    if (!loaded.includes(j.id)) { fail(at + ' not loaded', E(`checkModule(${JSON.stringify(j)}).errors`)); continue; }
    if (!E(`!!EXAMS[${JSON.stringify(j.past.exam)}]`) || !['math', 'bel'].includes(j.past.subj)) fail(at + ' unknown exam or subject', j.past);
    const files = p => fsx.existsSync(px.join(dir, 'media', j.id, p));
    const texts = [...Object.values(j.passages || {}).map(p => p.text)];
    for (const part of j.exams[0].parts) {
      texts.push(part.instructions);
      for (const t of part.tasks) {
        n++;
        texts.push(t.prompt, t.explain, ...(t.options || []), typeof t.answer === 'string' ? t.answer : '', ...(t.rubric || []).map(r => r.text));
        for (const b of [...(t.media || []), ...(t.solutionMedia || [])]) if (b.src && !files(b.src)) fail(`${at} ${t.id} missing media ${b.src}`);
        if (t.type === 'choice' || t.type === 'number' || t.type === 'text') {
          const resp = t.type === 'number' ? String(t.answer).replace('.', ',') : t.type === 'text' ? [].concat(t.answer)[0] : t.answer;
          if (E(`scoreTask(${JSON.stringify(t)}, ${JSON.stringify(resp)}, 'bg').status`) !== 'right') fail(`${at} ${t.id} key not scored right`);
        }
      }
    }
    for (const x of texts) { const bad = mathOk(x); if (bad) fail(`${at} katex ${bad}`); }
  }
  if (raw.length && !E(`pastFor(${JSON.stringify(raw[0].past.subj)}, ${JSON.stringify(raw[0].past.exam)}).length`)) fail('past exams: pastFor finds nothing');
  console.log(`${raw.length} past exams checked`);
  /* English versions (content/past-exams-en): same exam, same key; only the text is translated */
  const rawEn = E('PAST_EXAMS_EN_JSON'), loadedEn = E('Object.keys(PAST_EN)');
  for (const j of rawEn) {
    const at = 'past (en) ' + j.id, bg = raw.find(b => b.id === j.id);
    if (!bg) { fail(at + ': no Bulgarian exam with this id'); continue; }
    if (!loadedEn.includes(j.id)) { fail(at + ' not loaded', E(`checkModule(${JSON.stringify(j)}).errors`)); continue; }
    if (j.lang !== 'en') fail(at + ': lang should be "en"');
    if (JSON.stringify(j.past.exam + j.past.subj + j.past.year) !== JSON.stringify(bg.past.exam + bg.past.subj + bg.past.year)) fail(at + ': exam, subject or year differ from the Bulgarian one');
    const pe = j.exams[0].parts, pb = bg.exams[0].parts;
    if (pe.length !== pb.length) { fail(at + ': different number of parts'); continue; }
    const texts = [...Object.values(j.passages || {}).map(p => p.text)];
    pe.forEach((part, pi) => {
      texts.push(part.instructions);
      if (part.tasks.length !== pb[pi].tasks.length) return fail(`${at} part ${pi + 1}: different number of tasks`);
      part.tasks.forEach((t, ti) => {
        const b = pb[pi].tasks[ti];
        texts.push(t.prompt, t.explain, ...(t.options || []), typeof t.answer === 'string' ? t.answer : '', ...(t.rubric || []).map(r => r.text));
        if (t.id !== b.id || t.type !== b.type || t.points !== b.points) return fail(`${at} ${b.id}: id, type or points differ`);
        if ((t.options || []).length !== (b.options || []).length) fail(`${at} ${t.id}: different number of options`);
        if (['choice', 'multi', 'number', 'order', 'match'].includes(t.type) && JSON.stringify(t.answer) !== JSON.stringify(b.answer)) fail(`${at} ${t.id}: the key differs from the Bulgarian exam`);
        /* text answers may add English spellings, but every Bulgarian one must still count */
        if (t.type === 'text') [].concat(b.answer).forEach(a => { if (E(`scoreTask(${JSON.stringify(t)}, ${JSON.stringify(a)}, 'en').status`) !== 'right') fail(`${at} ${t.id}: "${a}" is no longer accepted`); });
        if (JSON.stringify((t.media || []).map(m => m.src)) !== JSON.stringify((b.media || []).map(m => m.src))) fail(`${at} ${t.id}: pictures differ`);
      });
    });
    for (const x of texts) { const bad = mathOk(x); if (bad) fail(`${at} katex ${bad}`); }
  }
  E("S.settings.lang = 'en'");
  if (rawEn.length && E(`pastById(${JSON.stringify(rawEn[0].id)}).lang`) !== 'en') fail('past exams: English is not shown in English');
  E("S.settings.lang = 'bg'");
  if (rawEn.length && E(`pastById(${JSON.stringify(rawEn[0].id)}).lang`) !== 'bg') fail('past exams: Bulgarian changed');
  console.log(`${rawEn.length} English past exams checked`);

}

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
if (E('obStep().id') !== 'extra') fail('onboarding: the extra matura should follow the profile');
if (E('extraOptions("math").some(o => o[0] === "math" || o[0] === "prof")') || E('extraOptions("math")[0][0]') !== 'maths') fail('onboarding: extra matura should list mathematics and the other profiles');
if (E('onboardingNext({ extra: "math" }).ok')) fail('onboarding: own profile accepted as the extra matura');
E('onboardingNext({ extra: "nat" })');
if (E('S.profile.extra') !== 'nat' || !E('examPlanFull("dzi12", "math", "nat")').includes('Допълнителна: природни науки')) fail('onboarding: extra matura not saved or not shown');
if (E('subjectOptions("music", "maths").map(o => o[0]).join()') !== 'bel,,math') fail('onboarding: mathematics as extra matura should be selectable with a non-math profile');
E('onboardingBack()');
if (E('S.profile.track') !== 'math' || !E('examPlan("dzi12", "math")').includes('информатика')) fail('onboarding: profile not saved or not used');
E('onboardingBack(); onboardingBack(); onboardingNext({ exam: "nvo7" })');
if (E('obStep().id') !== 'subject' || E('S.profile.track') !== '') fail('onboarding: 7th grade should skip the profile');
if (E('onboardingBack().step') !== ONB_EXAM) fail('onboarding: back from the subject should pass over the skipped profile');
if (E('subjectOptions("math")[0][0]') !== 'bel' || E('subjectOptions("math")[1][1]') !== '🧮 Математически') fail('onboarding: БЕЛ first, then the profile');
if (!E('subjectOptions("music")[1][2]')) fail('onboarding: a profile without mathematics should not be selectable yet');
E('onboardingNext({ exam: "dzi12" }); onboardingNext({ track: "prof" }); onboardingNext({ extra: "maths" })');
if (E('S.subject') !== 'bel') fail('onboarding: a profile without mathematics should start with БЕЛ');
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

/* 6. broken or old saved data must not stop the app, and must not be overwritten silently (50-state.js) */
const bad = E(`sanitizeState({ subject: 'chem', log: null, queue: 'x', skills: { 'math.quad': { p: 'a', n: -3, misc: null, hist: 5 }, junk: 1 }, settings: { theme: 'neon', model: 'a b', proxyUrl: 'http://x', sheetUrl: 'https://example.com', sound: 'yes' }, review: { 'math.quad': { box: 99, due: 1 } }, onboarding: 'x', aiFlags: {} })`);
if (bad.subject !== 'math' || !Array.isArray(bad.log) || !Array.isArray(bad.queue) || bad.onboarding !== null || !Array.isArray(bad.aiFlags)) fail('state: broken top-level fields not repaired');
if (bad.skills['math.quad'].p !== 0.3 || bad.skills['math.quad'].n !== 0 || !Array.isArray(bad.skills['math.quad'].hist) || 'junk' in bad.skills) fail('state: broken skill not repaired', bad.skills);
if (bad.settings.theme !== 'auto' || bad.settings.model !== 'gemini-3.8-flash' || bad.settings.proxyUrl !== '' || bad.settings.sheetUrl !== '' || bad.settings.sound !== true) fail('state: invalid settings kept', bad.settings);
if (bad.review['math.quad'].box !== 5) fail('state: review box not clamped');
const warn = console.warn; console.warn = () => { }; /* the expected "state not loaded" warning */
E(`localStorage.setItem(STORE_KEY, '{"skills": {broken'); STATE_NOTICE = null; loadState()`);
console.warn = warn;
if (!E('STATE_NOTICE && STATE_NOTICE.backup') || E('localStorage.getItem(STATE_NOTICE.backup)') !== '{"skills": {broken') fail('state: unreadable save was not backed up');
E('resetState(false); STATE_NOTICE = null');

/* 7. one session never shows the same question twice (53-bel.js pickTask + taskKey) */
for (const [subj, skill] of [['math', 'prob'], ['math', 'rtri'], ['bel', 'lit']]) for (const lvl of [1, 3]) {
  const keys = E(`(() => { const used = new Set(), out = []; for (let i = 0; i < 9; i++) { const t = pickTask('${subj}', '${skill}', ${lvl}, 'sess:' + i, used); if (!t) break; used.add(t.id); used.add(taskKey(t)); out.push(taskKey(t)); } return out; })()`);
  if (new Set(keys).size !== keys.length) fail(`session repeats a question: ${subj}.${skill} level ${lvl}`, keys);
}

/* 8. the forecast does not name a grade from a handful of answers (65-forecast.js) */
E("SUBJECTS.math.skills.forEach((s, i) => recordAnswer('math', genMathTask(s.id, 1, i), i < 2, null))");
if (E("forecast('math').conf") !== 'low' || !/след още/.test(E("gradeText(forecast('math'))"))) fail('forecast: a grade is shown after one answer per skill');
E('resetState(false)');

/* 9. English UI (49-lang.js): every text that goes through L(), a toast, a sheet button or a label table has an English entry */
{
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '../src/js'), EN = E('EN_UI'), keys = new Set();
  const unq = x => x.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  for (const f of fs.readdirSync(dir)) {
    if (f === '49-lang.js') continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const re of [/\bL\('((?:[^'\\]|\\.)*)'/g, /\btoast\('((?:[^'\\]|\\.)*)'/g, /\blabel: '((?:[^'\\]|\\.)*)'/g, /L\(\w+ [=!<>]+[^?]+\? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)'/g])
      for (const m of src.matchAll(re)) for (const k of m.slice(1)) if (k && /[А-Яа-я]/.test(k)) keys.add(unq(k));
    for (const m of src.matchAll(/toast\(ok \? '([^']*)' : '([^']*)'/g)) { keys.add(m[1]); keys.add(m[2]); }
  }
  E('Object.values(SUBJECTS)').forEach(s => { keys.add(s.title); keys.add(s.short); s.skills.forEach(k => keys.add(k.name)); });
  [...Object.values(E('STATUS_LABEL')), ...Object.values(E('CONF_LABEL')), ...E('GRADES').map(g => g[1])].forEach(k => keys.add(k));
  E('ONBOARD.steps').forEach(st => { [st.title, st.text].forEach(x => typeof x === 'string' && keys.add(x)); /* computed titles call L() themselves */ st.fields.forEach(f => {
    if (f.label) keys.add(f.label); if (f.ph && /[А-Яа-я]/.test(f.ph)) keys.add(f.ph);
    if (!f.native && Array.isArray(f.options)) f.options.forEach(o => /[А-Яа-я]/.test(o[1]) && keys.add(o[1]));
    if (f.validate) { const m = f.validate('x'.repeat(60)); if (m) keys.add(m); }
  }); });
  const missing = [...keys].filter(k => EN[k] == null);
  missing.forEach(k => fail('English UI: no translation for ' + JSON.stringify(k)));
  E("S.settings.lang = 'en'");
  if (E("L('Начало')") !== 'Home' || E("L('Губиш ≈ {a} от {b} т.', { a: 3, b: 66 })") !== 'You lose ≈ 3 of 66 pts') fail('English UI: L() does not translate');
  E("S.settings.lang = 'bg'");
  if (E("L('Начало')") !== 'Начало') fail('English UI: Bulgarian changed');
  console.log(`English UI: ${keys.size} texts, ${missing.length} without translation`);
}

console.log(`${n} tasks checked, ${fails} problems`);
process.exit(fails ? 1 : 0);
