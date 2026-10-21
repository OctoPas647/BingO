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
  return days <= 0 ? 'проверка днес' : days === 1 ? 'проверка утре' : `проверка след ${days} дни`;
}
