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

/* ================= Essay / ЛИС self-assessment =================
   An essay needs meaningful text and a score for every rubric criterion before it can be
   submitted. The total is calculated from the four criterion scores and can never exceed 30.
   These constants have scoring-specific names because 50-state.js already defines the shared
   ESSAY_CRITERIA and ESSAY_CRITERION_MAX constants in the concatenated bundle. */
const ESSAY_MIN_LENGTH = 10;
const ESSAY_SCORE_CRITERIA = ['content', 'structure', 'language', 'compliance'];
const ESSAY_SCORE_CRITERION_MAX = 7.5;
const ESSAY_MAX_POINTS = 30;

/* Empty, whitespace-only and under-10-character answers cannot be self-assessed. */
function validateEssay(text) {
  return String(text ?? '').trim().length >= ESSAY_MIN_LENGTH;
}

/* Returns the 0-30 total, or null when a criterion is missing, invalid or out of range. */
function scoreEssay(criterionScores) {
  if (!criterionScores || typeof criterionScores !== 'object') return null;
  let total = 0;
  for (const id of ESSAY_SCORE_CRITERIA) {
    const value = criterionScores[id];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > ESSAY_SCORE_CRITERION_MAX) return null;
    total += value;
  }
  return Math.min(total, ESSAY_MAX_POINTS);
}

/* Submission is allowed only when the text passes validation and every criterion has a score. */
function canSubmitEssay(text, criterionScores) {
  return validateEssay(text) && scoreEssay(criterionScores) !== null;
}
