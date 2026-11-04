/* Builds content/english-bank.json for the English matura from two of my other apps:
   - BrainBurst (SAT Reading & Writing): Standard English conventions and words-in-context questions -> grammar / vocabulary
   - BandUP (IELTS): the synonym list of the quick-fire games -> vocabulary
   Usage: node tools/import_english.js <path to brainburst> <path to bandup>
   Every question has four options. Explanations stay in English (the questions are in English too). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const [bbDir, buDir] = process.argv.slice(2);
const out = [];
const ctx = { console, Math, items: [] };
/* the drill files use the question stems defined in the lesson files */
ctx.lessonSet = (sk, n, t, tip, items) => items.forEach((q, i) => ctx.items.push({ sk, set: `${sk}-L${n}`, i, q }));
ctx.drillSet = (sk, n, items) => items.forEach((q, i) => ctx.items.push({ sk, set: `${sk}-D${n}`, i, q }));
ctx.testSet = () => {};
vm.createContext(ctx);
/* one script, like the app's bundle: the drill files use the question stems (const Q_…) of the lesson files */
const files = ['sec.js', 'cs.js', 'eoi.js', 'ii.js', 'x1-drills.js', 'x2-drills.js', 'x3-drills.js'].map(f => path.join(bbDir, 'src/content/rw', f)).filter(fs.existsSync);
try { vm.runInContext(files.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n'), ctx); } catch (e) { console.warn('BrainBurst content:', e.message); }
const SK = { bnd: 'gram', fss: 'gram', trn: 'gram', wic: 'vocab', cid: 'read', inf: 'read', tsp: 'read', ctc: 'read', coet: 'read' };   /* conventions and transitions = grammar, words in context = vocabulary, ideas / inference / structure = reading (data tables and quantitative evidence are left out: they need a table or chart) */
for (const { sk, set, i, q } of ctx.items) {
  const skill = SK[sk]; if (!skill || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
  const prompt = (q.ps ? q.ps.replace(/_{3,}/g, '………') + '\n\n' : '') + (q.p || '');
  out.push({ id: `bb:${set}:${i}`, skill, level: q.d || 2, type: 'choice', prompt, options: q.o, answer: q.a, explain: q.x || '', from: 'BrainBurst' });
}
/* BandUP synonyms: "Which word is closest in meaning to X?" with three other synonyms' answers as distractors */
const bu = fs.readFileSync(path.join(buDir, 'src/content/banks/03-quickfire-banks.js'), 'utf8');
const m = bu.match(/const VOCAB = (\[[\s\S]*?\]);/);
if (m) {
  const pairs = vm.runInNewContext(m[1]);
  pairs.forEach(([w, syn], i) => {
    const others = []; for (let k = 1; others.length < 3; k++) { const o = pairs[(i + k * 7) % pairs.length][1]; if (o !== syn && !others.includes(o)) others.push(o); }
    const ans = i % 4, options = others.slice(); options.splice(ans, 0, syn);
    out.push({ id: `bu:vocab:${i}`, skill: 'vocab', level: w.length > 9 ? 3 : 2, type: 'choice', prompt: `Which word or phrase is closest in meaning to **${w}**?`, options, answer: ans, explain: `“${w}” means “${syn}”.`, from: 'BandUP' });
  });
}
fs.writeFileSync(path.join(__dirname, '../content/english-bank.json'), JSON.stringify(out, null, 1));
console.log('english bank:', out.length, 'tasks', Object.entries(out.reduce((a, t) => (a[t.skill] = (a[t.skill] || 0) + 1, a), {})));
