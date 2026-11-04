/* ================= Text answers: strict checking of whole sentences =================
   Shelly's strict mode compares text exactly, which is right for a single word where the
   capital letter or the full article is the point (a strict gap such as „Директорът“).
   For an answer that is a whole sentence, exact comparison made a correct sentence wrong
   for a capital letter, a final full stop or the kind of quotation marks. Here a strict
   text answer with more than one word ignores those, while the words themselves, their
   order and the punctuation inside the sentence still have to match.
   Gap blanks keep Shelly's behaviour. This lives in BingO's src/ so a resync of engine/
   (a copy of Shelly) does not undo it. */
const _textMatchesShelly = textMatches;
const isSentenceText = s => /\s/.test(String(s ?? '').trim());
function normSentence(s, lang, cyr) {
  s = String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase(lang || undefined);
  s = s.replace(/[’‘`´]/g, "'").replace(/[“”„«»]/g, '"').replace(/[‐-―−]/g, '-');
  s = s.replace(/^["'(\[]+/, '').replace(/["')\]]+$/, '').replace(/[\s.,;:!?…]+$/u, '').trim();
  if (cyr) s = s.replace(/[acepoxyk]/g, ch => LOOKALIKE[ch]);
  return s;
}
textMatches = function (given, accepted, lang, strict, sentence = true) {
  const list = arr(accepted);
  if (strict && sentence && (isSentenceText(given) || list.some(isSentenceText))) {
    const cyr = list.some(hasCyr), g = normSentence(given, lang, cyr);
    return g !== '' && list.some(a => normSentence(a, lang, cyr) === g);
  }
  return _textMatchesShelly(given, accepted, lang, strict);
};
/* blanks in a gap task are checked the old way */
const _scoreTaskShelly = scoreTask;
scoreTask = function (t, r, lang) {
  if (t && t.type !== 'gaps') return _scoreTaskShelly(t, r, lang);
  const keep = textMatches;
  textMatches = (g, a, l, s) => _textMatchesShelly(g, a, l, s);
  try { return _scoreTaskShelly(t, r, lang); } finally { textMatches = keep; }
};

/* Author/work matching: BingO keeps Shelly's match scoring, but requires the learner to pick
   the left item (author) before picking a right item (work). Otherwise tapping a work first
   auto-paired it with the first free author and made the two sides hard to choose separately.
   The override lives here so an engine/Shelly resync does not undo it. */
TASK_BUILDERS.match = function (task, m, resp, seed, changed) {
  const pool = [...task.right, ...arr(task.extra)], order = shuffled([...pool.keys()], seed);
  const pairs = Array.isArray(resp) ? resp.slice() : task.left.map(() => null);
  let cur = null, area;
  const paint = () => {
    area.querySelectorAll('.mi.l').forEach(b => { const i = +b.dataset.l, k = pairs[i]; b.classList.toggle('cur', cur === i); b.classList.toggle('paired', k != null); b.querySelector('.badge').textContent = k != null ? i + 1 : ''; b.dataset.c = k != null ? i % 6 : ''; });
    area.querySelectorAll('.mi.r').forEach(b => { const k = +b.dataset.r, i = pairs.indexOf(k); b.classList.toggle('paired', i >= 0); b.querySelector('.badge').textContent = i >= 0 ? i + 1 : ''; b.dataset.c = i >= 0 ? i % 6 : ''; });
  };
  return {
    html: `<div class="match"><div class="mcol">${task.left.map((x, i) => `<button class="mi l" data-l="${i}"><span class="badge"></span><span>${richInline(x)}</span></button>`).join('')}</div>
      <div class="mcol">${order.map(k => `<button class="mi r" data-r="${k}"><span class="badge"></span><span>${richInline(pool[k])}</span></button>`).join('')}</div></div>`,
    mount(a) {
      area = a; paint();
      a.addEventListener('click', e => {
        const l = e.target.closest('.mi.l'), r = e.target.closest('.mi.r');
        if (l) { const i = +l.dataset.l; cur = cur === i ? null : i; }
        else if (r && cur != null) {
          const k = +r.dataset.r, owner = pairs.indexOf(k);
          if (owner >= 0 && cur !== owner) pairs[owner] = null;
          pairs[cur] = owner === cur ? null : k;
          cur = pairs[cur] == null ? cur : null;
          changed();
        }
        paint();
      });
    },
    get: () => pairs.slice(),
    show(res) {
      area.querySelectorAll('.mi.l').forEach(b => b.classList.add(res.detail && res.detail[+b.dataset.l] ? 'right' : 'wrong'));
      return res.status === 'right' ? '' : solutionLine(t('task.rightPairs'), `<ul class="sol-list">${task.left.map((x, i) => `<li>${richInline(x)} → ${richInline(task.right[i])}</li>`).join('')}</ul>`);
    }
  };
};
