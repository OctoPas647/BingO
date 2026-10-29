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
