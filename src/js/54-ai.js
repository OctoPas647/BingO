/* ================= Gemini: explain a mistake, hint without the answer, new tasks, weekly plan =================
   Two ways to reach Gemini:
   - 'key'   : straight to the Gemini API with a key from Google AI Studio (fine for a prototype on your own device)
   - 'proxy' : through our small Cloud Run server, which calls Gemini on Vertex AI with the team's
               Google Cloud credits, so no key ever reaches the phone (see server/).
   The app works fully without AI; AI only adds explanations and new tasks. */

const aiOn = () => (S.settings.aiMode === 'key' && !!S.settings.apiKey) || (S.settings.aiMode === 'proxy' && !!S.settings.proxyUrl);

const AI_SYSTEM = `Ти си търпелив учител, който подготвя български ученици за държавния зрелостен изпит (ДЗИ).
Пишеш на правилен български език, кратко и ясно, без излишни похвали и без да обвиняваш ученика.
Математиката пишеш в LaTeX между знаци $...$, с десетична запетая ($2{,}5$).
Никога не измисляш факти. Ако не си сигурен, казваш го.`;

async function callAI({ system = AI_SYSTEM, prompt, json = true, temperature = 0.4 }) {
  if (!aiOn()) throw new Error('ИИ е изключен');
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    let text;
    if (S.settings.aiMode === 'proxy') {
      const res = await fetch(S.settings.proxyUrl.replace(/\/+$/, '') + '/generate', {
        method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: S.settings.model, system, prompt, json, temperature })
      });
      if (!res.ok) throw new Error('Сървърът върна ' + res.status);
      text = (await res.json()).text;
    } else {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.settings.model)}:generateContent`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.settings.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) }
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body.error && body.error.message) || ('Gemini върна ' + res.status));
      text = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    }
    if (!json) return text;
    return parseJSON(text);
  } finally { clearTimeout(timer); }
}
function parseJSON(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('ИИ не върна четим отговор'); }
}

/* The task as plain text, for the prompt */
function taskForAI(task, subj, resp) {
  const m = fakeModule(subj), L = i => letterOf('bg', i);
  let s = `Задача: ${task.prompt || ''}`;
  if (task.passage && m.passages[task.passage]) s = `Текст: ${m.passages[task.passage].text}\n` + s;
  if (task.type === 'choice') {
    s += '\nВъзможни отговори:\n' + task.options.map((o, i) => `${L(i)}) ${o}`).join('\n');
    s += `\nВерен отговор: ${L(task.answer)}) ${task.options[task.answer]}`;
    if (resp != null) s += `\nОтговор на ученика: ${L(resp)}) ${task.options[resp]}`;
  } else if (task.type === 'number' || task.type === 'text') {
    s += `\nВерен отговор: ${arr(task.answer).join(' / ')}${task.unit ? ' ' + task.unit : ''}`;
    if (resp != null) s += `\nОтговор на ученика: ${resp}`;
  } else {
    s += `\n(Тип задача: ${task.type})`;
    if (resp != null) s += `\nОтговор на ученика: ${JSON.stringify(resp)}`;
  }
  if (task.explain) s += `\nРешение от учебника: ${task.explain}`;
  return s;
}

/* 1. Why was this wrong? */
async function aiExplainMistake(subj, task, resp, misc) {
  const sk = skillDef(subj, task.skill);
  const prompt = `${taskForAI(task, subj, resp)}
Умение: ${sk ? sk.name : task.skill}
${misc ? `Вероятна типична грешка: ${miscLabel(misc)}` : ''}

Ученикът е сгрешил. Обясни **какво точно е объркал в мисленето си** (не само кой е верният отговор).
Върни JSON: {"diagnosis": "грешката с до 8 думи", "explanation": "2–4 изречения, конкретно за неговия отговор", "check": "един кратък въпрос, с който сам да провери дали е разбрал"}`;
  return callAI({ prompt, temperature: 0.3 });
}

/* 2. A hint that does not give the answer away */
async function aiHint(subj, task) {
  const t2 = { ...task }; const prompt = `${taskForAI(t2, subj, null)}

Ученикът още не е отговорил и иска подсказка. Дай **една** насочваща подсказка: кое правило или първа стъпка да приложи.
НЕ казвай верния отговор, НЕ изключвай отговори и НЕ решавай задачата докрай.
Върни JSON: {"hint": "1–2 изречения"}`;
  return callAI({ prompt, temperature: 0.4 });
}

/* 3. A new task for a weak skill, aimed at the mistakes this learner actually makes */
async function aiNewTask(subj, skill, level, seed) {
  const sk = skillDef(subj, skill), st = skillState(subj, skill);
  const miscs = Object.entries(st.misc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const known = Object.keys(MISC).filter(k => k.startsWith(skill + '.'));
  const examples = (subj === 'math' ? [genMathTask(skill, level, seed + 'x')] : BANK[subj].filter(t => t.skill === skill).slice(0, 2))
    .map(t => JSON.stringify({ prompt: t.prompt, options: t.options, answer: t.answer, explain: t.explain }));
  const lit = skill === 'lit' ? '\nЗадачата е по поезията на Димчо Дебелянов от учебната програма за 11–12 клас (напр. „Да се завърнеш в бащината къща“, „Помниш ли, помниш ли…“, „Сиротна песен“). Питай само за неща, в които си напълно сигурен (теми, мотиви, образи), не за дати и цитати.' : '';
  const prompt = `Създай **една нова** задача с избираем отговор за ДЗИ по ${SUBJECTS[subj].title}.
Умение: ${sk.name}. Трудност: ${level} от 3.${lit}
Ученикът най-често греши така: ${miscs.length ? miscs.map(miscLabel).join('; ') : 'още не знаем'}.
Направи грешните отговори така, че всеки да идва от една от тези типични грешки: ${known.map(k => `"${k}" (${miscLabel(k)})`).join(', ') || 'обичайни грешки'}.
Примери за формата (не ги повтаряй): ${examples.join('\n')}

Върни JSON точно така:
{"prompt": "условието", "options": ["А", "Б", "В", "Г"], "answer": индекс на верния (0–3),
 "misc": [за всеки отговор: null за верния, иначе кодът на грешката от списъка],
 "explain": "кратко решение"}`;
  const j = await callAI({ prompt, temperature: 0.8 });
  const ok = j && typeof j.prompt === 'string' && Array.isArray(j.options) && j.options.length >= 2 && j.options.length <= 5 && j.options.every(o => typeof o === 'string' && o.trim())
    && Number.isInteger(j.answer) && j.answer >= 0 && j.answer < j.options.length && new Set(j.options).size === j.options.length;
  if (!ok) throw new Error('ИИ върна непълна задача');
  const misc = j.options.map((_, i) => (i === j.answer ? null : (Array.isArray(j.misc) && typeof j.misc[i] === 'string' && MISC[j.misc[i]] ? j.misc[i] : null)));
  const task = { id: `ai:${skill}:${uid()}`, type: 'choice', points: 1, media: [], prompt: j.prompt, options: j.options, answer: j.answer, misc,
    explain: typeof j.explain === 'string' ? j.explain : '', skill, level, src: 'ai' };
  /* run it through Shelly's own module checker, like any shared module */
  const { errors } = checkModule({ format: 1, id: 'ai.check', version: '1', lang: 'bg', title: 'x', exams: [{ id: 'x', title: 'x', parts: [{ title: 'x', tasks: [task] }] }] });
  if (errors.length) throw new Error('ИИ задачата не мина проверката: ' + errors[0].msg);
  return task;
}

/* 4. A short plan for the week, from the skill map */
async function aiWeekPlan(subj) {
  const sm = subjectSummary(subj);
  const lines = sm.list.map(x => `- ${x.sk.name}: овладяно ${Math.round(x.st.p * 100)}%, отговори ${x.st.n}, губи ≈${fmtNum(roundTo(x.lost, 1), 'bg', 1)} т., чести грешки: ${Object.entries(x.st.misc).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => miscLabel(k) + ' ×' + n).join('; ') || 'няма'}`).join('\n');
  const prompt = `Карта на уменията на ученик за ДЗИ по ${SUBJECTS[subj].title}:
${lines}

Направи план за следващите 5 дни по 20 минути. Правило: работим **само върху слабите места**; силните не повтаряме.
Върни JSON: {"summary": "2 изречения: къде губи най-много точки и защо", "days": [{"day": "Ден 1", "focus": "умение", "do": "какво точно да прави", "why": "защо"}]}`;
  return callAI({ prompt, temperature: 0.4 });
}
