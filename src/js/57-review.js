/* ================= Spaced review: simple Leitner boxes =================
   Replaces the fixed "check a strong skill after 3 days" rule. Each skill has a box 0..5.
   A correct answer moves it up one box (longer wait), a wrong answer sends it back to box 0.
   Wrapped the same way 50-state.js wraps applySettings(): no existing file is edited.
   Skills without a box yet fall back to the old 3-day rule, so old saved data keeps working. */
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
const DAY_MS = 24 * 3600 * 1000;

function reviewUpdate(key, correct, now = Date.now()) {
  if (!S.review) S.review = {};
  const r = S.review[key] || { box: 0, due: 0 };
  r.box = correct ? Math.min(r.box + 1, BOX_DAYS.length - 1) : 0;
  r.due = now + BOX_DAYS[r.box] * DAY_MS;
  S.review[key] = r;
  return r;
}

function reviewDue(key, lastSeen, now = Date.now()) {
  const r = S.review && S.review[key];
  return r ? r.due <= now : now - lastSeen > CHECK_AFTER;
}

const _recordAnswerBase = recordAnswer;
recordAnswer = function (subj, task, correct, misc) {
  const res = _recordAnswerBase(subj, task, correct, misc);
  reviewUpdate(subj + '.' + task.skill, correct);
  saveState();
  return res;
};

const _planSessionBase = planSession;
planSession = function (subj, size = 8) {
  const base = _planSessionBase(subj, size);
  const plan = base.plan.filter(x => x.why !== 'check');
  const due = subjectSummary(subj).list
    .filter(x => x.status === 'strong' && reviewDue(subj + '.' + x.sk.id, x.st.last))
    .sort((a, b) => a.st.last - b.st.last)[0];
  if (due) plan.splice(Math.min(3, plan.length), 0, { skill: due.sk.id, why: 'check' });
  return { plan, focus: base.focus, check: due ? due.sk.id : null };
};

/* "проверка днес" / "проверка след 5 дни", for the skill map */
function reviewLabel(key, lastSeen, now = Date.now()) {
  const r = S.review && S.review[key], due = r ? r.due : lastSeen + CHECK_AFTER;
  const days = Math.ceil((due - now) / DAY_MS);
  return days <= 0 ? L('проверка днес') : days === 1 ? L('проверка утре') : L('проверка след {d} дни', { d: days });
}

/* ================= Essay / ЛИС self-assessment =================
   The assessment screen has one input per rubric criterion. Submission stays disabled until
   the essay text is valid and every criterion has a score; the displayed total is calculated
   by scoreEssay() and can never exceed 30 points. */
const ESSAY_RUBRIC_UI = [
  { id: 'content', label: 'Съдържание и аргументация' },
  { id: 'structure', label: 'Структура и свързаност' },
  { id: 'language', label: 'Език и стил' },
  { id: 'compliance', label: 'Съответствие с задачата' }
];

function renderEssayAssessment(container, text) {
  if (!container) return;
  if (!S.essay || !S.essay.criterionScores) S.essay = { criterionScores: { content: 0, structure: 0, language: 0, compliance: 0 } };

  container.innerHTML = `
    <div class="essay-assessment">
      <h3>Самооценка на есе/ЛИС</h3>
      <p class="essay-hint">Оцени своя отговор по всеки критерий от 0 до 7,5 точки.</p>
      ${ESSAY_RUBRIC_UI.map(c => `
        <label class="essay-criterion">
          <span>${c.label}</span>
          <input class="essay-score" type="range" min="0" max="7.5" step="0.5"
            data-criterion="${c.id}" value="${S.essay.criterionScores[c.id] ?? 0}">
          <output data-output="${c.id}">${Number(S.essay.criterionScores[c.id] ?? 0).toFixed(1)} / 7,5</output>
        </label>`).join('')}
      <p class="essay-total">Общо: <b data-essay-total>0,0</b> / 30 т.</p>
      <p class="essay-error" data-essay-error hidden>Добави поне 10 символа текст и оцени всички критерии.</p>
      <button class="btn block" type="button" data-essay-submit disabled>Запази самооценката</button>
    </div>`;

  const inputs = [...container.querySelectorAll('.essay-score')];
  const submit = container.querySelector('[data-essay-submit]');
  const error = container.querySelector('[data-essay-error]');
  const totalEl = container.querySelector('[data-essay-total]');

  const refresh = () => {
    inputs.forEach(input => {
      const value = Number(input.value);
      S.essay.criterionScores[input.dataset.criterion] = value;
      container.querySelector(`[data-output="${input.dataset.criterion}"]`).textContent = value.toFixed(1) + ' / 7,5';
    });
    const total = scoreEssay(S.essay.criterionScores);
    totalEl.textContent = (total === null ? 0 : total).toFixed(1);
    const valid = canSubmitEssay(text, S.essay.criterionScores);
    submit.disabled = !valid;
    error.hidden = valid;
  };

  inputs.forEach(input => input.addEventListener('input', () => { refresh(); saveState(); }));

  submit.addEventListener('click', () => {
    const total = scoreEssay(S.essay.criterionScores);
    if (!canSubmitEssay(text, S.essay.criterionScores) || total === null) return;
    S.essay.total = total;
    saveState(true);
    totalEl.textContent = total.toFixed(1);
    submit.textContent = `Запазено: ${total.toFixed(1)} / 30 т.`;
  });

  refresh();
}
