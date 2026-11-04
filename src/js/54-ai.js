/* ================= Gemini: the AI behind almost everything =================
   Two Google models work together:
   - Gemini (cloud) on BingO's own server (server/, Cloud Run). The app has NO key: the server holds the
     Gemini key (or Vertex AI credentials) and the app only knows the server's address, which the build
     puts in (tools/build.py, aiServer). A learner never types or sees a key.
   - Gemini Nano on the device (54c-nano.js): Android's AICore on phones that have it, Chrome's built-in
     model on the web. It answers instantly and offline, so it gives the first hint, pre-checks open
     answers and double-checks Gemini's new questions; when the cloud is unreachable it takes over.
   What Gemini does: new questions for every subject (math in the real ДЗИ / НВО style, БЕЛ, the other
   maturas and the languages), questions similar to the ones a learner got wrong, hints without the
   answer, why an answer was wrong, checking open answers against the official key, the week plan and
   a short coach note after each session. The app still works without any AI. */

const AI_SERVER = typeof globalThis.BINGO_AI_SERVER === 'string' ? globalThis.BINGO_AI_SERVER : '';
const cloudOn = () => !!AI_SERVER && S.settings.ai !== false;
/* some AI can answer: the cloud, or Gemini Nano on this device */
const aiOn = () => cloudOn() || (typeof nanoReady === 'function' && nanoReady());

const AI_SYSTEM = `Ти си търпелив учител, който подготвя български ученици за НВО и държавните зрелостни изпити (ДЗИ).
Пишеш на правилен български език, кратко и ясно, без излишни похвали и без да обвиняваш ученика.
Математиката пишеш в LaTeX между знаци $...$, с десетична запетая ($2{,}5$).
Никога не измисляш факти. Ако не си сигурен, казваш го.`;

/* where a call went, for the small "✦ Gemini" / "на устройството" label next to an answer */
let AI_LAST = '';

async function cloudCall({ system, prompt, json, temperature }) {
  if (!cloudOn()) throw new Error(L('Няма връзка с Gemini'));
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(AI_SERVER + '/generate', {
      method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, prompt, json, temperature })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || L('Сървърът върна {n}', { n: res.status }));
    return body.text;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(L('Gemini не отговори навреме'));
    throw e;
  } finally { clearTimeout(timer); }
}

/* prefer: 'cloud' (default: quality first, Nano when the cloud fails) or 'nano' (speed first: Nano, then the cloud) */
async function callAI({ system = AI_SYSTEM, prompt, json = true, temperature = 0.4, prefer = 'cloud' }) {
  const nano = typeof nanoReady === 'function' && nanoReady();
  const order = prefer === 'nano' ? ['nano', 'cloud'] : ['cloud', 'nano'];
  let lastErr = null;
  for (const via of order) {
    if (via === 'nano' && !nano) continue;
    if (via === 'cloud' && !cloudOn()) continue;
    try {
      const text = via === 'nano' ? await nanoPrompt(system, prompt, { json, temperature }) : await cloudCall({ system, prompt, json, temperature });
      AI_LAST = via;
      return json ? parseJSON(text) : text;
    } catch (e) { lastErr = e; console.warn('AI via ' + via, e); }
  }
  throw lastErr || new Error(L('ИИ не е достъпен'));
}
function parseJSON(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch (e) {
    const m = s.match(/[[{][\s\S]*[\]}]/); if (m) { try { return JSON.parse(m[0]); } catch (e2) { } }
    throw new Error(L('ИИ не върна четим отговор'));
  }
}
const aiBadge = () => (AI_LAST === 'nano' ? L('✦ Gemini Nano · на устройството') : L('✦ Gemini'));

/* The task as plain text, for the prompt */
function taskForAI(task, subj, resp) {
  const m = fakeModule(subj), L_ = i => 'АБВГДЕ'[i] || String(i + 1);
  let s = `Задача: ${task.prompt || ''}`;
  if (task.passage && m.passages[task.passage]) s = `Текст: ${String(m.passages[task.passage].text).slice(0, 3500)}\n` + s;
  if (task.type === 'choice') {
    s += '\nВъзможни отговори:\n' + task.options.map((o, i) => `${L_(i)}) ${o}`).join('\n');
    s += `\nВерен отговор: ${L_(task.answer)}) ${task.options[task.answer]}`;
    if (resp != null) s += `\nОтговор на ученика: ${L_(resp)}) ${task.options[resp]}`;
  } else if (task.type === 'number' || task.type === 'text') {
    s += `\nВерен отговор: ${arr(task.answer).join(' / ')}${task.unit ? ' ' + task.unit : ''}`;
    if (resp != null) s += `\nОтговор на ученика: ${resp}`;
  } else if (task.type === 'open') {
    if (task.answer) s += `\nОфициален отговор: ${String(task.answer).slice(0, 1200)}`;
    if (resp != null) s += `\nОтговор на ученика: ${String(resp).slice(0, 1500)}`;
  } else {
    s += `\n(Тип задача: ${task.type})`;
    if (resp != null) s += `\nОтговор на ученика: ${JSON.stringify(resp)}`;
  }
  if (task.explain) s += `\nРешение от учебника: ${task.explain}`;
  return s;
}
/* the exam and subject in words, for every prompt */
const examWords = subj => {
  const e = currentExamKey(), sub = SUBJECTS[subj];
  return `${e === 'dzi12' ? 'ДЗИ (държавен зрелостен изпит, 12. клас)' : e === 'nvo10' ? 'НВО в 10. клас' : e === 'nvo7' ? 'НВО в 7. клас' : 'НВО в 4. клас'} по ${sub.title}`;
};

/* 1. Why was this wrong? */
async function aiExplainMistake(subj, task, resp, misc) {
  const sk = skillDef(subj, task.skill);
  const prompt = `${taskForAI(task, subj, resp)}
Изпит: ${examWords(subj)}. Умение: ${sk ? sk.name : task.skill}
${misc ? `Вероятна типична грешка: ${miscLabel(misc)}` : ''}

Ученикът е сгрешил. Обясни **какво точно е объркал в мисленето си** (не само кой е верният отговор).
Върни JSON: {"diagnosis": "грешката с до 8 думи", "explanation": "2–4 изречения, конкретно за неговия отговор", "check": "един кратък въпрос, с който сам да провери дали е разбрал"}`;
  return callAI({ prompt, temperature: 0.3 });
}

/* 2. A hint that does not give the answer away: Nano first (instant, offline), Gemini when Nano is not there */
async function aiHint(subj, task) {
  const prompt = `${taskForAI({ ...task, answer: undefined, explain: undefined }, subj, null).replace(/\nВерен отговор:.*$/m, '')}

Ученикът още не е отговорил и иска подсказка. Дай **една** насочваща подсказка: кое правило или първа стъпка да приложи.
НЕ казвай верния отговор, НЕ изключвай отговори и НЕ решавай задачата докрай.
Върни JSON: {"hint": "1–2 изречения"}`;
  return callAI({ prompt, temperature: 0.4, prefer: 'nano' });
}

/* ---------- 3. New questions, in the real exam's style ----------
   Real questions of the same skill and exam (past exams, the banks) go into the prompt as examples, so
   Gemini copies how МОН writes them: the wording, four options А–Г, the length, the level. */
function styleExamples(subj, skill, n = 3, avoidIds = new Set()) {
  const pool = (BANK[subj] || []).filter(t => t.skill === skill && t.type === 'choice' && forMyExam(t) && !avoidIds.has(t.id));
  const real = pool.filter(t => t.src === 'past'), rest = pool.filter(t => t.src !== 'past');
  const R = seedRng('ex:' + subj + skill + Date.now());
  const pick = list => list.slice().sort(() => R.f() - 0.5);
  const list = [...pick(real), ...pick(rest)].slice(0, n);
  if (subj === 'math' && list.length < n && MATH_GEN[skill]) list.push(genMathTask(skill, 2, 'ex' + Date.now()));
  return list.filter(Boolean).map(t => JSON.stringify({ prompt: String(t.prompt).slice(0, 600), options: t.options, answer: t.answer }));
}
const LANG_NAME = { en: 'английски', de: 'немски', ru: 'руски', fr: 'френски', es: 'испански', it: 'италиански' };
function styleRules(subj, skill) {
  const sub = SUBJECTS[subj], e = currentExamKey();
  if (subj === 'math') return `Пиши като в ${examWords(subj)}: кратко условие в стила на МОН („Стойността на израза … е:“, „Решенията на неравенството … са:“, „Лицето на … е:“), математиката в LaTeX между $...$, десетична запетая ($2{,}5$), мерни единици като в изпита (cm, cm², лв.).
Отговорите са числа или изрази в LaTeX. Без „Задача 1:“ и без номера.${e === 'nvo4' ? ' Числата и сметките са за 4. клас (без отрицателни числа, без x).' : ''}`;
  if (sub.lang && sub.lang !== 'bg') return `Изпитът е по ${LANG_NAME[sub.lang] || sub.title} език. Условието и отговорите са на ${LANG_NAME[sub.lang] || 'чуждия'} език, на ниво B1–B2 като в ДЗИ. Обяснението („explain“) е на български. ${skill === 'read' ? 'Дай кратък текст (60–120 думи) в полето "text" и въпрос за разбиране върху него.' : skill === 'gram' ? 'Изречение с пропуск (___) и четири граматични форми.' : 'Изречение с пропуск (___) или дума, и четири думи / изрази.'}`;
  return `Пиши като в ${examWords(subj)}: кратко условие в стила на МОН, точни факти от учебната програма, без въпроси за неща, в които не си напълно сигурен (дати, цитати, числа).`;
}
async function aiNewTasks(subj, skill, level, { n = 2, similarTo = null, seed = '' } = {}) {
  if (!cloudOn()) throw new Error(L('Няма връзка с Gemini'));
  const sk = skillDef(subj, skill), st = skillState(subj, skill);
  const miscs = Object.entries(st.misc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const known = Object.keys(MISC).filter(k => k.startsWith(skill + '.'));
  const sim = similarTo ? `
Ученикът сгреши тази задача:
${taskForAI(similarTo.task, subj, similarTo.resp)}
Направи **подобни, но различни** задачи: същото умение и същия капан, други числа / факти / формулировка. НЕ повтаряй тази задача.` : '';
  const prompt = `Създай ${n} нови задачи с избираем отговор за ${examWords(subj)}.
Умение: ${sk ? sk.name : skill}. Трудност: ${level} от 3.
${styleRules(subj, skill)}
Ученикът най-често греши така: ${miscs.length ? miscs.map(miscLabel).join('; ') : 'още не знаем'}.
${known.length ? `Всеки грешен отговор да идва от една от тези типични грешки: ${known.map(k => `"${k}" (${miscLabel(k)})`).join(', ')}.` : 'Грешните отговори да са правдоподобни грешки, не очевидни глупости.'}
Примери от истински изпити (стил и ниво; не ги повтаряй):
${styleExamples(subj, skill).join('\n') || 'няма'}${sim}

Точно ЧЕТИРИ отговора, точно един верен, различни един от друг.
Върни JSON: {"tasks": [{"text": "текст за четене или празно", "prompt": "условието", "options": ["…", "…", "…", "…"], "answer": индекс на верния (0–3), "misc": [за всеки отговор: null за верния, иначе код от списъка или null], "explain": "кратко решение"}]}`;
  const j = await callAI({ prompt, temperature: 0.8 });
  const list = Array.isArray(j) ? j : Array.isArray(j && j.tasks) ? j.tasks : j && j.prompt ? [j] : [];
  const out = [];
  for (const x of list) {
    const ok = x && typeof x.prompt === 'string' && x.prompt.trim() && Array.isArray(x.options) && x.options.length === 4 && x.options.every(o => typeof o === 'string' && o.trim())
      && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4 && new Set(x.options.map(o => o.trim())).size === 4;
    if (!ok) continue;
    const misc = x.options.map((_, i) => (i === x.answer ? null : (Array.isArray(x.misc) && typeof x.misc[i] === 'string' && MISC[x.misc[i]] ? x.misc[i] : null)));
    const prompt = (typeof x.text === 'string' && x.text.trim().length > 40 ? `> ${x.text.trim().replace(/\n+/g, '\n> ')}\n\n` : '') + x.prompt.trim();
    const task = { id: `ai:${subj}:${skill}:${uid()}`, type: 'choice', points: 1, media: [], prompt, options: x.options.map(o => o.trim()), answer: x.answer, misc,
      explain: typeof x.explain === 'string' ? x.explain : '', skill, level, src: 'ai', similar: similarTo ? similarTo.task.id : undefined };
    const { errors } = checkModule({ format: 1, id: 'ai.check', version: '1', lang: 'bg', title: 'x', exams: [{ id: 'x', title: 'x', parts: [{ title: 'x', tasks: [task] }] }] });
    if (!errors.length) out.push(task);
  }
  if (!out.length) throw new Error(L('ИИ върна непълна задача'));
  /* Gemini Nano solves each new question on its own; a question it answers differently goes to the back of the queue */
  if (typeof nanoReady === 'function' && nanoReady()) await Promise.all(out.map(async t => { t.nanoAgrees = await nanoSolves(subj, t).catch(() => null); }));
  return out;
}
/* kept for older callers: one task */
async function aiNewTask(subj, skill, level, seed) { return (await aiNewTasks(subj, skill, level, { n: 1, seed }))[0]; }

/* AI-made questions are kept per skill, so they also work offline and are not asked for twice */
function aiCachePut(subj, tasks) {
  for (const t of tasks) { const k = subj + '.' + t.skill, list = S.aiCache[k] || (S.aiCache[k] = []); if (!list.some(x => x.prompt === t.prompt)) list.push(t); S.aiCache[k] = list.slice(-24); }
  saveState();
}
function aiCacheTake(subj, skill, avoid) {
  const list = (S.aiCache[subj + '.' + skill] || []).filter(t => !avoid.has(t.id) && !avoid.has(taskKey(t)) && !seenRecently(t.id));
  list.sort((a, b) => (b.nanoAgrees !== false) - (a.nanoAgrees !== false));
  return list[0] || null;
}
/* fill the cache in the background for the skills of a session (never blocks the screen) */
const aiFilling = new Set();
function aiPrefetch(subj, skills, level) {
  if (!cloudOn()) return;
  for (const skill of [...new Set(skills)].slice(0, 3)) {
    const k = subj + '.' + skill;
    if (aiFilling.has(k) || (S.aiCache[k] || []).filter(t => !seenRecently(t.id)).length >= 3) continue;
    aiFilling.add(k);
    aiNewTasks(subj, skill, level(skill), { n: 3 }).then(ts => aiCachePut(subj, ts)).catch(e => console.warn('AI prefetch', e)).finally(() => aiFilling.delete(k));
  }
}

/* 4. A short plan for the week, from the skill map */
async function aiWeekPlan(subj) {
  const sm = subjectSummary(subj);
  const lines = sm.list.map(x => `- ${x.sk.name}: овладяно ${Math.round(x.st.p * 100)}%, отговори ${x.st.n}, губи ≈${fmtNum(roundTo(x.lost, 1), 'bg', 1)} т., чести грешки: ${Object.entries(x.st.misc).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => miscLabel(k) + ' ×' + n).join('; ') || 'няма'}`).join('\n');
  const prompt = `Карта на уменията на ученик за ${examWords(subj)}:
${lines}

Направи план за следващите 5 дни по 20 минути. Правило: работим **само върху слабите места**; силните не повтаряме.
Върни JSON: {"summary": "2 изречения: къде губи най-много точки и защо", "days": [{"day": "Ден 1", "focus": "умение", "do": "какво точно да прави", "why": "защо"}]}`;
  return callAI({ prompt, temperature: 0.4 });
}

/* 5. A coach note after a session: what went well, the one thing to fix next */
async function aiSessionNote(subj, answers) {
  const lines = answers.map(a => `- ${skillDef(subj, a.skill)?.name || a.skill}: ${a.correct ? 'вярно' : 'грешно' + (a.misc ? ' (' + miscLabel(a.misc) + ')' : '')}`).join('\n');
  const prompt = `Ученик току-що реши ${answers.length} задачи за ${examWords(subj)}:
${lines}
Напиши кратка, топла и конкретна бележка: какво се получи и **едно** нещо, върху което да работи следващия път. Без оценки и без укор.
Върни JSON: {"note": "2–3 изречения"}`;
  return callAI({ prompt, temperature: 0.6, prefer: 'nano' });
}
