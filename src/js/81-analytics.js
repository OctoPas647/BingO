/* ================= Grades, school years and projections (0.9.0) =================
   The data behind the statistics screens (82-stats-student.js, 83-stats-teacher.js).

   A student's grades live on the device (S.grades) and come from two places:
   - BingO: the grades teachers give through BingO tests and homework (results/*), copied in when the student
     opens Статистики, so they stay after a class is archived or a new school year starts;
   - typed in by the student: the grades from school (the same as in Shkolo), any year, any subject.
   Years are school years (15 September – 30 June; July and August belong to the year that just ended),
   terms are I (September – early February) and II. Nothing is thrown away when a new year starts, so every
   screen can compare this year with the years before.
   S.years keeps a summary of BingO practice per school year (answers, right, active days), so it survives the
   answer log being trimmed; S.fcHist keeps the matura forecast once a day, to draw how it moved.

   Projections for teachers: a student's likely result on a coming test = their recent results (newer count
   more, with their trend) mixed with their BingO skill mastery for the test's topics. The range narrows with
   more data. НВО/ДЗИ: the weighted mastery of the exam's skills, as on the student's own forecast. */

/* ---------- school years ---------- */
function schoolYearOf(t) { const d = new Date(t), y = d.getFullYear(); return d.getMonth() >= 8 ? `${y}/${String(y + 1).slice(-2)}` : `${y - 1}/${String(y).slice(-2)}`; }
function termOf(t) { const d = new Date(t), m = d.getMonth(); return m >= 8 || m === 0 || (m === 1 && d.getDate() <= 7) ? 1 : 2; }
const yearStart = yk => new Date(+yk.slice(0, 4), 8, 15).getTime();
const yearEnd = yk => new Date(+yk.slice(0, 4) + 1, 5, 30, 23, 59).getTime();
const curYear = () => schoolYearOf(Date.now());
const prevYear = yk => `${+yk.slice(0, 4) - 1}/${yk.slice(2, 4)}`;
const yearLabel = yk => yk.replace('/', '/');
const YEAR_RE = /^\d{4}\/\d\d$/;
/* the class a student is in during a school year, counted back from this year's class (12 now → 11 last year) */
function gradeInYear(yk) {
  const now = parseInt(S.profile.cls, 10); if (!now) return '';
  const g = now - (+curYear().slice(0, 4) - +yk.slice(0, 4));
  return g >= 1 && g <= 12 ? L('{n} клас', { n: g }) : '';
}

/* ---------- kinds of grades, as in a school diary ---------- */
const GRADE_KINDS = [['cur', 'Текуща'], ['test', 'Контролна'], ['class', 'Класна работа'], ['oral', 'Изпитване'], ['hw', 'Домашна работа'], ['project', 'Проект'], ['bingo', 'Тест в BingO'], ['term', 'Срочна'], ['year', 'Годишна']];
const GRADE_KIND_IDS = GRADE_KINDS.map(k => k[0]);
const kindLabel = k => L((GRADE_KINDS.find(x => x[0] === k) || [0, 'Текуща'])[1]);
const isFinal = g => g.kind === 'term' || g.kind === 'year';
const SCHOOL_SUBJECTS = ['Български език и литература', 'Математика', 'Английски език', 'Немски език', 'Руски език', 'Френски език', 'Испански език', 'История и цивилизации', 'География и икономика',
  'Биология и здравно образование', 'Химия и опазване на околната среда', 'Физика и астрономия', 'Информационни технологии', 'Информатика', 'Философия', 'Гражданско образование', 'Музика', 'Изобразително изкуство', 'Физическо възпитание и спорт', 'Технологии и предприемачество'];
/* short names that mean the same subject */
const SUBJ_ALIAS = { 'бел': 'Български език и литература', 'български език': 'Български език и литература', 'математика': 'Математика', 'английски': 'Английски език', 'руски': 'Руски език', 'немски': 'Немски език', 'история': 'История и цивилизации', 'география': 'География и икономика', 'биология': 'Биология и здравно образование', 'химия': 'Химия и опазване на околната среда', 'физика': 'Физика и астрономия', 'ит': 'Информационни технологии' };
function normSubj(s) {
  s = String(s || '').trim().replace(/\s+/g, ' ').slice(0, 60); if (!s) return '';
  const low = s.toLowerCase();
  if (SUBJ_ALIAS[low]) return SUBJ_ALIAS[low];
  const hit = SCHOOL_SUBJECTS.find(x => x.toLowerCase() === low || x.toLowerCase().startsWith(low + ' ') || low.startsWith(x.toLowerCase().split(' ')[0]) && x.toLowerCase().split(' ')[0].length > 5);
  return hit || s;
}
const shortSubj = s => ({ 'Български език и литература': 'БЕЛ', 'История и цивилизации': 'История', 'География и икономика': 'География', 'Биология и здравно образование': 'Биология', 'Химия и опазване на околната среда': 'Химия', 'Физика и астрономия': 'Физика', 'Информационни технологии': 'ИТ', 'Физическо възпитание и спорт': 'Физ. възпитание', 'Технологии и предприемачество': 'Технологии', 'Гражданско образование': 'Гражд. образование', 'Изобразително изкуство': 'Изобр. изкуство' }[s] || s);
/* a subject keeps its colour everywhere (colour follows the subject, not its place in a list) */
const SUBJ_COLORS = ['var(--ch-1)', 'var(--ch-2)', 'var(--ch-3)', 'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)', 'var(--ch-7)', 'var(--ch-8)'];
function subjColor(s) {
  const fixed = { 'Математика': 'var(--ch-1)', 'Български език и литература': 'var(--ch-2)', 'Английски език': 'var(--ch-3)', 'Руски език': 'var(--ch-8)', 'История и цивилизации': 'var(--ch-4)', 'Биология и здравно образование': 'var(--ch-6)', 'Физика и астрономия': 'var(--ch-7)', 'Химия и опазване на околната среда': 'var(--ch-5)' };
  if (fixed[s]) return fixed[s];
  let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return SUBJ_COLORS[Math.abs(h) % SUBJ_COLORS.length];
}

/* ---------- keeping the new fields through a restart (50-state.js checks every saved field) ---------- */
function cleanGrade(g) {
  if (!isObj(g) || !isNum(g.v) || g.v < 2 || g.v > 6) return null;
  const at = isNum(g.at) ? g.at : 0, year = isStr(g.year) && YEAR_RE.test(g.year) ? g.year : at ? schoolYearOf(at) : '';
  if (!year) return null;
  return { id: isStr(g.id) && g.id ? g.id.slice(0, 80) : uid(), subj: normSubj(g.subj) || '—', v: Math.round(g.v * 100) / 100, kind: GRADE_KIND_IDS.includes(g.kind) ? g.kind : 'cur', year, term: [0, 1, 2].includes(g.term) ? g.term : at ? termOf(at) : 1,
    at: at || yearStart(year), note: isStr(g.note) ? g.note.slice(0, 200) : '', src: g.src === 'bingo' ? 'bingo' : 'manual', pct: isNum(g.pct) ? clamp(g.pct, 0, 1) : undefined, title: isStr(g.title) ? g.title.slice(0, 120) : undefined, aid: isStr(g.aid) ? g.aid.slice(0, 80) : undefined };
}
function cleanAnalytics(v, out) {
  out.grades = Array.isArray(v.grades) ? v.grades.map(cleanGrade).filter(Boolean).slice(-3000) : [];
  out.absences = {};
  if (isObj(v.absences)) for (const [yk, t] of Object.entries(v.absences)) if (YEAR_RE.test(yk) && isObj(t)) {
    out.absences[yk] = {}; for (const term of ['1', '2']) { const a = isObj(t[term]) ? t[term] : {}; out.absences[yk][term] = { exc: isNum(a.exc) ? clamp(a.exc, 0, 999) : 0, unexc: isNum(a.unexc) ? clamp(a.unexc, 0, 999) : 0, late: isNum(a.late) ? clamp(a.late, 0, 999) : 0 }; }
  }
  out.years = {};
  if (isObj(v.years)) for (const [yk, y] of Object.entries(v.years)) if (YEAR_RE.test(yk) && isObj(y)) out.years[yk] = { ans: isNum(y.ans) ? y.ans : 0, ok: isNum(y.ok) ? y.ok : 0, days: isNum(y.days) ? y.days : 0, subj: isObj(y.subj) ? Object.fromEntries(Object.entries(y.subj).filter(([k, s]) => /^\w+$/.test(k) && isObj(s)).map(([k, s]) => [k, { ans: isNum(s.ans) ? s.ans : 0, ok: isNum(s.ok) ? s.ok : 0, fc: isNum(s.fc) ? s.fc : null }])) : {} };
  out.fcHist = {};
  if (isObj(v.fcHist)) for (const [k, h] of Object.entries(v.fcHist)) if (/^\w+$/.test(k) && Array.isArray(h)) out.fcHist[k] = h.filter(x => Array.isArray(x) && isNum(x[0]) && isNum(x[1])).slice(-500);
  out.classCmp = isObj(v.classCmp) ? Object.fromEntries(Object.entries(v.classCmp).filter(([, c]) => isObj(c) && isNum(c.avgPct)).slice(-300)) : {};
  out.notes = Array.isArray(v.notes) ? v.notes.filter(n => isObj(n) && isStr(n.text)).slice(-200) : [];
  return out;
}
const _sanitizeBase090 = sanitizeState;
sanitizeState = function (v) { const out = _sanitizeBase090(v); return isObj(v) ? cleanAnalytics(v, out) : cleanAnalytics({}, out); };
function ensureAnalytics() { if (!Array.isArray(S.grades) || !isObj(S.absences) || !isObj(S.years) || !isObj(S.fcHist) || !isObj(S.classCmp) || !Array.isArray(S.notes)) cleanAnalytics(S, S); }

/* ---------- averages ---------- */
const meanOf = xs => (xs.length ? sum(xs) / xs.length : null);
const gradesOf = ({ year, subj, term } = {}) => (ensureAnalytics(), S.grades.filter(g => (!year || g.year === year) && (!subj || g.subj === subj) && (!term || g.term === term)));
/* the average of one subject in a year: the year grade if there is one, else the term grades, else the current grades */
function subjYearAvg(list) {
  const y = list.find(g => g.kind === 'year'); if (y) return y.v;
  const t = [1, 2].map(n => list.find(g => g.kind === 'term' && g.term === n)).filter(Boolean);
  if (t.length === 2) return meanOf(t.map(g => g.v));
  const cur = list.filter(g => !isFinal(g)).map(g => g.v);
  if (t.length === 1) { const other = list.filter(g => !isFinal(g) && g.term !== t[0].term).map(g => g.v); return other.length ? (t[0].v + meanOf(other)) / 2 : t[0].v; }
  return meanOf(cur);
}
const curAvg = list => meanOf(list.filter(g => !isFinal(g)).map(g => g.v));
function subjectsIn(list) { const m = new Map(); list.forEach(g => m.set(g.subj, (m.get(g.subj) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); }
/* общ успех: the mean of the subjects' averages (as the school works it out, from the year grades) */
function yearSuccess(yk) {
  const list = gradesOf({ year: yk }), subs = subjectsIn(list);
  const per = subs.map(s => ({ subj: s, v: subjYearAvg(list.filter(g => g.subj === s)), n: list.filter(g => g.subj === s && !isFinal(g)).length })).filter(x => x.v != null);
  return { v: meanOf(per.map(x => x.v)), per, n: list.length };
}
const gradeWord = v => L(EDU_GRADE_NAMES[v >= 5.5 ? 6 : v >= 4.5 ? 5 : v >= 3.5 ? 4 : v >= 3 ? 3 : 2]);
function yearsWithData() {
  ensureAnalytics();
  const ys = new Set([curYear(), ...S.grades.map(g => g.year), ...Object.keys(S.years), ...Object.keys(S.absences)]);
  myLog().forEach(r => { const t = r.t || Date.parse(r.timestamp); if (t) ys.add(schoolYearOf(t)); });
  return [...ys].filter(y => YEAR_RE.test(y)).sort();
}

/* ---------- BingO practice per school year (kept even when the answer log is trimmed) ---------- */
function rollYears() {
  ensureAnalytics();
  const by = {};
  for (const r of myLog()) {
    const t = r.t || Date.parse(r.timestamp); if (!t) continue;
    const yk = schoolYearOf(t), y = by[yk] || (by[yk] = { ans: 0, ok: 0, days: new Set(), subj: {} });
    y.ans++; if (r.correct) y.ok++; y.days.add(localDay(t));
    const sid = Object.values(SUBJECTS).find(s => s.title === r.subject); if (!sid) continue;
    const s = y.subj[sid.id] || (y.subj[sid.id] = { ans: 0, ok: 0 }); s.ans++; if (r.correct) s.ok++;
  }
  for (const [yk, y] of Object.entries(by)) {
    const old = S.years[yk] || { ans: 0, ok: 0, days: 0, subj: {} };
    if (y.ans >= old.ans) {
      const subj = { ...old.subj }; for (const [k, s] of Object.entries(y.subj)) subj[k] = { ...(subj[k] || {}), ans: s.ans, ok: s.ok };
      S.years[yk] = { ans: y.ans, ok: y.ok, days: Math.max(old.days, y.days.size), subj };
    }
  }
  /* the matura forecast at the end of each year (the last one kept that year) */
  for (const [k, h] of Object.entries(S.fcHist)) for (const [t, pts] of h) { const yk = schoolYearOf(t); const y = S.years[yk] || (S.years[yk] = { ans: 0, ok: 0, days: 0, subj: {} }); (y.subj[k] = y.subj[k] || { ans: 0, ok: 0 }).fc = pts; }
}
/* the matura forecast, once a day per subject */
function snapForecasts() {
  ensureAnalytics();
  if (typeof myMatura !== 'function' || typeof forecast !== 'function') return;
  const today = localDay();
  for (const m of myMatura()) {
    if (!m.ready || !SUBJECTS[m.id]) continue;
    const f = forecast(m.id); if (!f) continue;
    const h = S.fcHist[m.id] || (S.fcHist[m.id] = []), last = h[h.length - 1], v = Math.round(f.pts * 10) / 10;
    if (last && localDay(last[0]) === today) last[1] = v; else h.push([Date.now(), v]);
    if (h.length > 500) h.splice(0, h.length - 500);
  }
}

/* ---------- grades from BingO tests (the student's own released results) ---------- */
const GRADE_SCALES = ['bg6', 'bg6exact', 'matura'];
async function syncBingoGrades() {
  ensureAnalytics();
  if (!CLOUD.user || CLOUD.role === 'teacher' || typeof col !== 'function') return false;
  try {
    const me = myUid();
    const rs = docs(await col('results').where('studentId', '==', me).where('visible', '==', true).get());
    const clsIds = [...new Set(rs.map(r => r.classId).filter(Boolean))], cls = {};
    for (const id of clsIds) { try { const s = await docRef('classes/' + id).get(); if (s.exists) cls[id] = s.data(); } catch (e) { } }
    let changed = false;
    for (const r of rs) {
      const g = r.grade || {}, at = tsMs(r.submittedAt) || tsMs(r.gradedAt) || Date.now();
      const id = 'r:' + r.id, old = S.grades.find(x => x.id === id);
      if (!GRADE_SCALES.includes(g.scale) || !isFinite(g.value)) { if (old) { S.grades.splice(S.grades.indexOf(old), 1); changed = true; } continue; }
      const subj = normSubj(r.subject || (cls[r.classId] && cls[r.classId].subject) || r.title);
      const ng = cleanGrade({ id, subj, v: g.value, kind: 'bingo', at, year: schoolYearOf(at), term: termOf(at), src: 'bingo', pct: r.pct, title: r.title, aid: r.assignmentId, note: r.comment || '' });
      if (!ng) continue;
      if (!old) { S.grades.push(ng); changed = true; } else if (JSON.stringify(old) !== JSON.stringify(ng)) { Object.assign(old, ng); changed = true; }
    }
    try {
      const cs = await callFn('classStats', {});
      for (const [aid, c] of Object.entries((cs && cs.stats) || {})) { const r = rs.find(x => x.assignmentId === aid); S.classCmp[aid] = { ...c, title: r ? r.title : '', pct: r ? r.pct : null, at: r ? tsMs(r.submittedAt) || 0 : 0, subj: r ? normSubj(r.subject || (cls[r.classId] && cls[r.classId].subject) || '') : '' }; changed = true; }
    } catch (e) { console.warn('classStats', e); }
    if (changed) saveState();
    return changed;
  } catch (e) { console.warn('grades from BingO', e); return false; }
}

/* ================= projections (for teachers) ================= */
/* a class's subject ("Математика", "Руски език") -> BingO's subject id, for the skill map */
function subjIdOf(title) {
  const t = String(title || '').toLowerCase(); if (!t) return '';
  const hit = Object.values(SUBJECTS).find(s => s.title.toLowerCase() === t || L(s.title).toLowerCase() === t || (s.short && s.short.toLowerCase() === t) || t.startsWith(s.title.toLowerCase().split(' ')[0]) && s.title.toLowerCase().split(' ')[0].length > 4);
  return hit ? hit.id : '';
}
/* the student's BingO mastery for some skills of a subject (0..1), or null */
function masteryFor(prog, subjId, skills) {
  if (!prog || !prog.skills || !subjId) return null;
  const list = Object.entries(prog.skills).filter(([k, v]) => k.startsWith(subjId + '.') && v && isFinite(v.p) && (!skills || !skills.length || skills.includes(k.split('.')[1])));
  if (!list.length) return null;
  const w = list.map(([, v]) => v.w || 1);
  return { p: sum(list.map(([, v], i) => v.p * w[i])) / sum(w), n: sum(list.map(([, v]) => v.n || 1)) };
}
/* one student on a coming test -> { p, lo, hi, n, trend, why: [] } (p is the expected share of the points) */
function predictTest(history, mastery, classMean) {
  const h = history.filter(r => isFinite(r.pct)).sort((a, b) => a.t - b.t);
  let hp = null, trend = 0;
  if (h.length) {
    /* newer results count more: weights halve every 3 tests back */
    const w = h.map((_, i) => Math.pow(0.5, (h.length - 1 - i) / 3));
    hp = sum(h.map((r, i) => r.pct * w[i])) / sum(w);
    if (h.length >= 3) {
      const xs = h.map((_, i) => i), mx = meanOf(xs), my = meanOf(h.map(r => r.pct));
      const sl = sum(xs.map((x, i) => (x - mx) * (h[i].pct - my))) / Math.max(1e-9, sum(xs.map(x => (x - mx) ** 2)));
      trend = clamp(sl, -0.08, 0.08);
      hp = clamp(hp + trend * 0.8, 0, 1);
    }
  }
  const mp = mastery ? clamp(mastery.p * 0.92 + 0.04, 0, 1) : null;
  let p = hp != null && mp != null ? hp * 0.6 + mp * 0.4 : hp != null ? hp : mp != null ? mp : classMean;
  if (p == null) return null;
  const n = h.length + (mastery ? Math.min(6, mastery.n / 5) : 0);
  const sd = clamp(0.05 + 0.16 / Math.sqrt(n + 1), 0.06, 0.2);
  return { p: clamp(p, 0, 1), lo: clamp(p - sd, 0, 1), hi: clamp(p + sd, 0, 1), sd, n: h.length, trend, hist: hp, mastery: mp, conf: n >= 5 ? 'high' : n >= 2 ? 'mid' : 'low' };
}
/* the chance the result falls below a share x (normal approximation) */
function probBelow(pr, x) { const z = (x - pr.p) / Math.max(0.02, pr.sd); return 1 / (1 + Math.exp(-1.702 * z)); }
/* the grade a share of the points gets on an assignment's scale */
function gradeFor(p, settings) {
  const g = (settings && settings.grading) || { scale: 'bg6' };
  const scale = GRADE_SCALES.includes(g.scale) ? g.scale : 'bg6';
  return eduGrade(p * 100, 100, { ...g, scale });
}
/* the share of the points a grade starts at on that scale (for "chance of a 2") */
function passShare(settings) {
  const g = (settings && settings.grading) || {};
  if (g.scale === 'matura') return 0.30;
  if (g.scale === 'bg6exact') return 0.25;
  return ((Array.isArray(g.thresholds) && g.thresholds.length === 4 ? g.thresholds : EDU_BG6_DEFAULT)[0]) / 100;
}
/* НВО / ДЗИ: points out of 100 from the weighted mastery of the exam's skills */
function predictMatura(prog, subjId) {
  const m = masteryFor(prog, subjId); if (!m) return null;
  const pts = m.p * 100, margin = clamp(40 / Math.sqrt(m.n + 1), 4, 20);
  return { pts, lo: clamp(pts - margin, 0, 100), hi: clamp(pts + margin, 0, 100), n: m.n, grade: EDU_MATURA.find(x => pts >= x[0])[1] };
}
