/* ================= Demo data: a simulated learner, and a simulated class for Looker Studio =================
   Used for the 3-minute pitch (the skill map is full at once) and to build the Looker Studio
   dashboard before real students use the app. Simulated answers go through the same model. */

const DEMO_TRUE = {
  math: { quad: 0.92, pct: 0.35, pow: 0.88, lin: 0.2, rtri: 0.95, prog: 0.7, prob: 0.42 },
  bel: { art: 0.3, comma: 0.35, spell: 0.92, lit: 0.45 }
};

/* One simulated answer: right with the learner's true chance, otherwise one of the task's real mistakes */
/* u is an even spread of numbers (golden-ratio steps), so a short history still matches the learner's true level */
function simulateAnswer(task, pTrue, r, u) {
  const correct = u < pTrue * 0.9 + (task.type === 'choice' ? (1 - pTrue) * (1 / task.options.length) : 0);
  let misc = null;
  if (!correct) {
    if (task.misc) { const ms = task.misc.filter(Boolean); misc = ms.length ? ms[Math.floor(r.f() * Math.min(2, ms.length))] : null; }
    else if (task.numMisc && task.numMisc.length) misc = task.numMisc[0].misc;
  }
  return { correct, misc };
}

function simulateLearner({ truth = DEMO_TRUE, name = 'Демо ученик', cls = '12а', id = 'demo', days = 6, perSkill = [4, 7], seed = 'demo', commit = true } = {}) {
  const r = seedRng(seed), rows = [], start = Date.now() - days * 24 * 3600 * 1000;
  const skills = {};
  for (const subj of Object.keys(truth)) for (const sk of SUBJECTS[subj].skills) {
    const pTrue = truth[subj][sk.id] ?? 0.6, n = perSkill[0] + Math.floor(r.f() * (perSkill[1] - perSkill[0] + 1));
    const st = { p: BKT.prior, n: 0, ok: 0, last: 0, misc: {}, hist: [] }, used = new Set(), off = r.f();
    for (let i = 0; i < n; i++) {
      const lvl = levelFor(st.p), task = pickTask(subj, sk.id, lvl, seed + sk.id + i, used) || pickTask(subj, sk.id, lvl, seed + sk.id + i); used.add(task.id);
      const { correct, misc } = simulateAnswer(task, pTrue, r, (off + i * 0.6180339887) % 1);
      const t = start + (i / n) * days * 24 * 3600 * 1000 + Math.floor(r.f() * 3600e3);
      const before = st.p; st.p = bktUpdate(st.p, correct, guessOf(task)); st.n++; if (correct) st.ok++; st.last = t;
      if (!correct && misc) st.misc[misc] = (st.misc[misc] || 0) + 1;
      st.hist.push([t, roundTo(st.p, 3)]);
      rows.push({ t, timestamp: new Date(t).toISOString(), student_id: id, student: name, class: cls, subject: SUBJECTS[subj].title, skill_id: subj + '.' + sk.id, skill: sk.name,
        level: lvl, correct: correct ? 1 : 0, misconception_code: correct ? '' : misc || '', misconception: correct || !misc ? '' : miscLabel(misc).replace(/\$/g, ''), source: task.src || 'bank',
        seconds: 20 + Math.floor(r.f() * 70), hints: 0, mastery_before: roundTo(before, 3), mastery_after: roundTo(st.p, 3), mode: i < 1 ? 'diag' : 'focus', session_id: 'demo' + Math.floor(i / 3), task_id: task.id });
    }
    skills[subj + '.' + sk.id] = st;
  }
  rows.sort((a, b) => a.t - b.t);
  if (commit) { S.skills = skills; S.log = rows; S.profile = { ...S.profile, name, cls }; S.queue = []; saveState(true); }
  return rows;
}

/* A class of 28 learners with different strengths, for the teacher's Looker Studio dashboard */
function simulateClass(n = 28, seed = 'class') {
  const r = seedRng(seed), names = ['Мария', 'Георги', 'Иван', 'Елена', 'Никола', 'Виктория', 'Александър', 'Йоана', 'Мартин', 'Габриела', 'Даниел', 'Симона', 'Петър', 'Десислава', 'Калоян', 'Рая', 'Стефан', 'Божидара', 'Христо', 'Теодора', 'Борис', 'Ивета', 'Кристиян', 'Николета', 'Радослав', 'Цветелина', 'Васил', 'Михаела'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const truth = {};
    for (const subj of Object.keys(DEMO_TRUE)) { truth[subj] = {}; for (const [k, v] of Object.entries(DEMO_TRUE[subj])) truth[subj][k] = clamp(v + (r.f() - 0.5) * 0.6, 0.05, 0.98); }
    out.push(...simulateLearner({ truth, name: names[i % names.length] + ' ' + String.fromCharCode(1040 + (i * 7) % 28) + '.', cls: i < n / 2 ? '12а' : '12б', id: 's' + (i + 1), seed: seed + i, commit: false }));
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ---------- loading the demo learner without losing a real learner's progress ----------
   The demo replaces the skill map and the answers. If there is real progress, ask first and keep
   a copy under its own key, so "Върни моите отговори" in Settings can bring it back. */
const DEMO_BACKUP_KEY = STORE_KEY + '.before-demo';
const hasRealProgress = () => S.sessions > 0 || S.log.some(r => r.student_id !== 'demo');
const demoBackupExists = () => { try { return !!localStorage.getItem(DEMO_BACKUP_KEY); } catch (e) { return false; } };
async function loadDemoLearner() {
  if (hasRealProgress()) {
    const ok = await confirmBox(L('Да заредим ли демо ученик?'), L('Демото заменя картата на уменията и отговорите ти. Ще пазим копие на твоите данни и можеш да ги върнеш от Настройки → „Върни моите отговори“.'), L('Зареди демото'));
    if (!ok) return false;
    try { localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(S)); }
    catch (e) { toast('Няма място за копие на данните ти — демото не е заредено.', 'bad'); return false; }
  }
  simulateLearner();
  return true;
}
function restoreFromDemo() {
  let raw = null; try { raw = localStorage.getItem(DEMO_BACKUP_KEY); } catch (e) { }
  if (!raw) return false;
  try { S = sanitizeState(JSON.parse(raw)); } catch (e) { return false; }
  saveState(true);
  try { localStorage.removeItem(DEMO_BACKUP_KEY); } catch (e) { }
  return true;
}
