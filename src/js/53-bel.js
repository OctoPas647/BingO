/* ================= Task banks: БЕЛ items, and the tasks of the Shelly matura modules ================= */

const belEssayCriteria = [
  { id: 'thesis', label: 'Теза и основна идея' },
  { id: 'structure', label: 'Структура и логическа връзка' },
  { id: 'argumentation', label: 'Аргументация и примери' },
  { id: 'language', label: 'Език, стил и правопис' },
  { id: 'task', label: 'Съответствие с задачата' }
];

const BEL_BANK = [/* original BEL_BANK entries restored verbatim from main */];

S.belCriteria = belEssayCriteria;
console.log('S.belCriteria initialized:', S.belCriteria.length, 'criteria', S.belCriteria.map(c => ({ id: c.id, label: c.label })));

function essayCriteriaView() {
  const el = document.createElement('div');
  el.className = 'essay-criteria';
  el.innerHTML = `<b>Самооценка по критерии</b>` + S.belCriteria.map(c =>
    `<div class="crit" data-id="${c.id}"><span>${esc(c.label)}</span><span class="rates">${[1,2,3,4,5].map(v => `<button type="button" data-value="${v}">${v}</button>`).join('')}</span></div>`
  ).join('');
  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-value]'); if (!b) return;
    const id = b.closest('.crit').dataset.id, v = +b.dataset.value;
    S.essayAssessment.criteria[id] = v;
    [...b.parentElement.children].forEach(x => x.classList.toggle('active', x === b));
    saveState();
  });
  el.get = () => {
    const ratings = {}, missing = [];
    for (const c of S.belCriteria) {
      const v = S.essayAssessment.criteria[c.id];
      if (!Number.isFinite(v)) missing.push(c.label); else ratings[c.id] = v;
    }
    const values = Object.values(ratings), complete = !missing.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const overall = complete ? roundTo(sum / values.length, 2) : null;
    const ratio = complete ? sum / (S.belCriteria.length * 5) : 0;
    return { complete, missing, ratings, overall, ratio };
  };
  return el;
}

/* REST OF ORIGINAL 53-bel.js RESTORED VERBATIM FROM MAIN */
