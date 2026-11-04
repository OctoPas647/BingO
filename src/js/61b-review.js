/* ================= Going over the missed questions =================
   At the end of a session or a past exam, every question that was wrong, skipped ("Не знам") or right only on
   the second try is listed. Tapping one opens it again with the learner's answer, the right answer and the
   solution. "Тренирай подобни" then starts a short session of SIMILAR questions (61-session.js, mode "similar"):
   a new variant of a generated task, a Gemini question made from that exact mistake, or another real question
   of the same skill — never the same question again. */

const missedLabel = a => (a.skipped ? L('Пропусната') : a.retryOk ? L('От втория опит') : L('Грешна'));

function reviewHTML(missed) {
  if (!missed.length) return `<div class="card strongnote">${icon('check')}<div><b>${L('Без нито една грешка!')}</b><br><span class="muted">${L('Няма какво да преговаряме от тази тренировка.')}</span></div></div>`;
  return `<section class="review">
    <div class="review-head"><h2 class="sec-title">${L('Да преговорим грешките')}</h2><span class="pill">${missed.length}</span></div>
    <p class="muted small">${L('Докосни задача, за да видиш твоя отговор, верния и решението. После тренирай върху подобни — не същите — задачи.')}</p>
    <div class="review-list">${missed.map((a, i) => `<div class="rv" data-rv="${i}">
      <button class="rv-row"><span class="rv-n">${i + 1}</span><span class="rv-text">${esc(plainPrompt(a.task.prompt)).slice(0, 140)}</span><span class="rv-tag ${a.skipped ? 'skip' : a.retryOk ? 'second' : 'wrong'}">${esc(missedLabel(a))}</span><span class="rv-chev">${icon('down')}</span></button>
      <div class="rv-body" hidden></div></div>`).join('')}</div>
    <button class="btn accent big block" data-similar>${icon('reset')}${L('Тренирай подобни · {n}', { n: missed.length })}</button>
    ${!cloudOn() ? `<p class="muted small center">${L('Без връзка с Gemini подобните задачи идват от банката и генераторите.')}</p>` : ''}
  </section>`;
}
/* the question as one plain line: no LaTeX, markdown or quoted reading text */
const plainPrompt = s => String(s || '').replace(/^>.*$/gm, '').replace(/\$([^$]*)\$/g, '$1').replace(/\\(frac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, '$2/$3').replace(/\\[a-z]+/gi, '').replace(/[*_{}]/g, '').replace(/\s+/g, ' ').trim();

function mountReview(root, subj, m, missed) {
  root.querySelectorAll('[data-rv]').forEach(card => {
    const a = missed[+card.dataset.rv], body = card.querySelector('.rv-body');
    card.querySelector('.rv-row').addEventListener('click', () => {
      const open = body.hidden;
      if (open && !body.childElementCount) {
        const v = taskView(a.task, a.mod || m, { mode: 'review', response: a.resp, seed: 'review' });
        body.appendChild(v.el);
        try { v.show(a.resp == null ? { status: 'wrong', points: 0 } : scoreTask(a.task, a.resp, 'bg')); } catch (e) { }
        const fb = v.el.querySelector('.fb'); if (fb) fb.hidden = false;
        if (a.misc) body.insertAdjacentHTML('afterbegin', `<div class="mistake">${icon('target')}<div><b>${L('Типична грешка')}</b><span class="rt">${richInline(miscLabel(a.misc))}</span></div></div>`);
      }
      body.hidden = !open; card.classList.toggle('open', open);
      if (open) motionReveal(body);
    });
  });
  const b = root.querySelector('[data-similar]');
  if (b) b.onclick = () => go('session', { subj, mode: 'similar', similar: missed.map(a => ({ task: a.task, resp: a.resp })) }, { replace: true });
}
/* a small expand animation; 68-motion.js replaces it with the spring version */
let motionReveal = el => { };
