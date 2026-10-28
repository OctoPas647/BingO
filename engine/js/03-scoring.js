/* ================= Checking answers and turning points into a result =================
   scoreTask(task, response, lang) -> { points, max, status: right | partial | wrong | empty | ungraded, detail }
   applyScale(scale, points, max, lang) -> { value, band, text, pass, pct }
   Responses by task type:
     choice: option index · multi: [indices] · text / number: string · gaps: [string | index per blank]
     order: { order: [item indices in the learner's order], moved: whether the learner moved anything } · match: [index of the chosen right-hand item for each left item]
     open: { text, marks: [points per rubric line] | null } */

/* Latin letters that look like Cyrillic ones: a Bulgarian keyboard user who types "о" with the Latin
   layout on is not wrong, so loose checking treats them as the same letter when the answer is Cyrillic. */
const LOOKALIKE = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к' };
const hasCyr = s => /[Ѐ-ӿ]/.test(s);
function normText(s, lang, strict, cyr) {
  s = String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (strict) return s;
  s = s.toLocaleLowerCase(lang || undefined).replace(/[’‘`´]/g, "'").replace(/[“”„«»]/g, '"').replace(/[‐-―−]/g, '-').replace(/[\s.,;:!?…]+$/u, '').replace(/^["'(]+|["')]+$/g, '').trim();
  if (cyr) s = s.replace(/[acepoxyk]/g, ch => LOOKALIKE[ch]);
  return s;
}
/* Strict checking must still be fair for whole-sentence *text* answers: capitalization, final punctuation,
   outer quotation marks and dash/quote variants should not make a correct sentence wrong. Internal
   punctuation and word order remain important. Gap blanks keep their previous strict behavior. */
function normSentence(s, lang, cyr) {
  s = String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  s = s.toLocaleLowerCase(lang || undefined).replace(/[’‘`´]/g, "'").replace(/[“”„«»]/g, '"').replace(/[‐-―−]/g, '-');
  s = s.replace(/^["'(\[]+/, '').replace(/["')\]]+$/, '').replace(/[\s.,;:!?…]+$/u, '').trim();
  if (cyr) s = s.replace(/[acepoxyk]/g, ch => LOOKALIKE[ch]);
  return s;
}
const isSentence = s => /\s/.test(String(s ?? '').trim());
function textMatches(given, accepted, lang, strict, allowSentence = true) {
  const list = arr(accepted), cyr = list.some(hasCyr);
  if (strict && allowSentence && (isSentence(given) || list.some(isSentence))) {
    const g = normSentence(given, lang, cyr);
    return g !== '' && list.some(a => normSentence(a, lang, cyr) === g);
  }
  const g = normText(given, lang, strict, cyr);
  return g !== '' && list.some(a => normText(a, lang, strict, cyr) === g);
}

/* "3,5", "3.5", "7/2", "−1,25", "1 000" -> number (or NaN) */
function parseNumber(s) {
  s = String(s ?? '').trim().replace(/[\s  ]/g, '').replace(/[−–]/g, '-');
  if (!s) return NaN;
  const frac = s.match(/^(-?)(\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/);
  if (frac) { const d = +frac[3].replace(',', '.'); return d ? (frac[1] ? -1 : 1) * (+frac[2].replace(',', '.')) / d : NaN; }
  if (!/^-?(\d+([.,]\d+)?|[.,]\d+)$/.test(s)) return NaN;
  return +s.replace(',', '.');
}

function scoreTask(t, r, lang) {
  const max = t.points, out = (share, status, detail) => ({ points: roundTo(max * clamp(share, 0, 1), 4), max, status: status || (share >= 1 ? 'right' : share > 0 ? 'partial' : 'wrong'), detail });
  const empty = r == null || r === '' || (Array.isArray(r) && !r.some(v => v != null && v !== ''));
  if (t.type !== 'open' && empty) return { points: 0, max, status: 'empty' };
  switch (t.type) {
    case 'choice': return out(r === t.answer ? 1 : 0);
    case 'multi': {
      const want = new Set(t.answer), got = new Set(r), hits = [...got].filter(i => want.has(i)).length, misses = got.size - hits;
      const exact = hits === want.size && misses === 0;
      return out(exact ? 1 : t.partial ? (hits - misses) / want.size : 0);
    }
    case 'text': return out(textMatches(r, t.answer, lang, t.strict) ? 1 : 0);
    case 'number': { const v = parseNumber(r); return out(Number.isFinite(v) && Math.abs(v - t.answer) <= (t.tolerance || 1e-9) ? 1 : 0); }
    case 'gaps': {
      const marks = t.gaps.map((g, i) => (g.options ? r[i] === g.answer : textMatches(r[i], g.answer, lang, g.strict ?? t.strict, false)));
      return out(marks.filter(Boolean).length / marks.length, null, marks);
    }
    case 'order': {
      if (!r.moved) return { points: 0, max, status: 'empty' };
      const marks = t.items.map((_, i) => r.order[i] === i);
      return out(marks.every(Boolean) ? 1 : t.partial ? marks.filter(Boolean).length / marks.length : 0, null, marks);
    }
    case 'match': {
      const marks = t.left.map((_, i) => r[i] === i);
      return out(marks.filter(Boolean).length / marks.length, null, marks);
    }
    case 'open': {
      if (!r || !String(r.text || '').trim()) return { points: 0, max, status: 'empty' };
      if (!Array.isArray(r.marks)) return { points: 0, max, status: 'ungraded' };
      return out(sum(r.marks) / max);
    }
  }
  return { points: 0, max, status: 'wrong' };
}

/* The rubric of an open task (a task without one is graded as a whole) */
const rubricOf = t => (t.rubric && t.rubric.length ? t.rubric : [{ text: '', points: t.points }]);

function scaleValue(s, x) {
  const map = s.map;
  if (s.mode === 'steps') { let y = map[0][1]; for (const [px, py] of map) if (px <= x) y = py; return y; }
  if (x <= map[0][0]) return map[map.findLastIndex(p => p[0] === map[0][0])][1];
  let i = -1; map.forEach((p, k) => { if (p[0] <= x) i = k; });
  if (i === map.length - 1) return map[i][1];
  const [x0, y0] = map[i], [x1, y1] = map[i + 1];
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}

function applyScale(scale, points, max, lang) {
  const pct = max > 0 ? points / max : 0;
  if (!scale) { const v = Math.round(pct * 100); return { value: v, pct, band: null, text: fmtNum(v, lang, 0) + ' %', pass: null }; }
  const x = roundTo(scale.outOf ? pct * scale.outOf : points, 6), d = scale.round ?? 2, value = roundTo(scaleValue(scale, x), d);
  let band = null; for (const [from, name] of scale.bands || []) if (value >= from) band = name;
  const vals = { band: band || '', value: fmtNum(value, lang, d), points: fmtPts(points, lang), max: fmtPts(max, lang) };
  const text = (scale.show || (band ? '{band} {value}' : '{value}')).replace(/\{(\w+)\}/g, (m, k) => vals[k] ?? m).trim();
  return { value, pct, band, text, pass: scale.pass != null ? value >= scale.pass : null };
}
