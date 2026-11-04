/* ================= BingO for classes: shared rules (no DOM) =================
   The same file runs in the app and in Cloud Functions (tools/sync-functions.js copies it into
   functions/shared/edu.js together with the answer checking), so a grade is worked out the same
   way on the teacher's screen, on the student's phone and on the server.
   - eduStrip: a teacher's test -> what students may see (no answers, no solutions) + the answer key
   - eduScore: one answer against the key (closed tasks are checked; open and photo tasks wait for AI or the teacher)
   - eduGrade: points -> the grade on the scale the teacher picked for this test
   - eduQuizPoints: points in the projector quiz (right and fast earns more) */

const EDU_TASK_TYPES = ['choice', 'multi', 'text', 'number', 'gaps', 'order', 'match', 'open', 'photo'];
const EDU_AUTO_TYPES = ['choice', 'multi', 'text', 'number', 'gaps', 'order', 'match'];
/* fields that give the answer away; they stay in the key */
const EDU_SECRET = ['answer', 'why', 'explain', 'rubric', 'solution', 'solutionMedia', 'misc', 'numMisc', 'tolerance', 'aiCriteria', 'hint', 'bank', 'strict', 'partial'];

/* Grade scales a teacher can pick per test.
   bg6: 2–6 by thresholds in percent (editable); bg6exact: 2 + 4 × share, with two decimals (as on Bulgarian tests);
   matura: МОН's matura scale on 100 points; percent; points. */
const EDU_SCALES = ['bg6', 'bg6exact', 'matura', 'percent', 'points'];
const EDU_BG6_DEFAULT = [50, 65, 80, 90];   /* from this percent: Среден 3, Добър 4, Много добър 5, Отличен 6 */
const EDU_GRADE_NAMES = { 2: 'Слаб', 3: 'Среден', 4: 'Добър', 5: 'Много добър', 6: 'Отличен' };
const EDU_MATURA = [[84, 6], [62.5, 5], [41, 4], [30, 3], [0, 2]];

function eduGradeName(v) {
  /* Bulgarian rounding of a grade with decimals: 3,50 is Добър, 5,50 is Отличен */
  const n = v >= 5.5 ? 6 : v >= 4.5 ? 5 : v >= 3.5 ? 4 : v >= 3 ? 3 : 2;
  return EDU_GRADE_NAMES[n];
}

function eduGrade(points, max, cfg) {
  cfg = cfg || {};
  const scale = EDU_SCALES.includes(cfg.scale) ? cfg.scale : 'bg6';
  const pct = max > 0 ? clamp(points / max, 0, 1) : 0;
  const p100 = roundTo(pct * 100, 2);
  const ptsTxt = roundTo(points, 2) + ' / ' + roundTo(max, 2);
  if (scale === 'percent') return { scale, pct, value: Math.round(p100), text: Math.round(p100) + '%', pass: null };
  if (scale === 'points') return { scale, pct, value: roundTo(points, 2), text: ptsTxt, pass: null };
  if (scale === 'bg6exact') {
    const v = roundTo(2 + 4 * pct, 2);
    return { scale, pct, value: v, name: eduGradeName(v), text: eduGradeName(v) + ' ' + v.toFixed(2).replace('.', ','), pass: v >= 3 };
  }
  if (scale === 'matura') {
    const g = EDU_MATURA.find(x => p100 >= x[0])[1];
    return { scale, pct, value: g, name: EDU_GRADE_NAMES[g], text: EDU_GRADE_NAMES[g] + ' ' + g, pass: g >= 3 };
  }
  const th = Array.isArray(cfg.thresholds) && cfg.thresholds.length === 4 && cfg.thresholds.every(Number.isFinite) ? cfg.thresholds : EDU_BG6_DEFAULT;
  const g = 2 + th.filter(x => p100 >= x).length;
  return { scale, pct, value: g, name: EDU_GRADE_NAMES[g], text: EDU_GRADE_NAMES[g] + ' ' + g, pass: g >= 3 };
}

/* A small seeded permutation, so the hidden order of "order" and "match" items is the same for the whole class */
function eduPerm(n, seed) {
  const idx = [...Array(n).keys()]; if (n < 2) return idx;
  let p = shuffled(idx, seed), k = 0;
  while (p.every((v, i) => v === i) && k++ < 6) p = shuffled(idx, seed + ':' + k);
  return p;
}

const eduPoints = t => (Number.isFinite(t.points) && t.points > 0 ? t.points : 1);

/* One task -> { pub, key }. pub is safe to show to a student; key keeps everything needed to grade.
   "order": the right order is the order of task.items, so pub gets the items mixed (key.perm[i] = the original index of pub.items[i]).
   "match": the right pair of left[i] is right[i], so pub gets "right" mixed the same way. */
function eduStripTask(task, seed) {
  const t = JSON.parse(JSON.stringify(task));
  t.points = eduPoints(t);
  const key = JSON.parse(JSON.stringify(t));
  const pub = {};
  for (const [k, v] of Object.entries(t)) if (!EDU_SECRET.includes(k)) pub[k] = v;
  if (t.type === 'order' && Array.isArray(t.items)) {
    const perm = eduPerm(t.items.length, seed + ':' + t.id);
    pub.items = perm.map(i => t.items[i]); key.perm = perm;
  }
  if (t.type === 'match' && Array.isArray(t.right)) {
    const perm = eduPerm(t.right.length, seed + ':' + t.id);
    pub.right = perm.map(i => t.right[i]); key.perm = perm;
  }
  if (t.type === 'gaps' && Array.isArray(t.gaps)) pub.gaps = t.gaps.map(g => (g.options ? { options: g.options } : {}));
  /* the student sees how many points each rubric line is worth, not what it asks for */
  if ((t.type === 'open' || t.type === 'photo') && Array.isArray(t.rubric)) pub.rubricPoints = t.rubric.map(r => (r && Number.isFinite(r.points) ? r.points : 0));
  return { pub, key };
}

function eduStrip(tasks, seed) {
  const pub = [], key = {};
  (tasks || []).forEach(task => { const r = eduStripTask(task, seed || 'bingo'); pub.push(r.pub); key[r.key.id] = r.key; });
  return { pub, key };
}

/* A response given on the student's (mixed) view -> the same response in the key's terms */
function eduUnmix(keyTask, resp) {
  if (resp == null || !keyTask.perm) return resp;
  if (keyTask.type === 'order' && resp && Array.isArray(resp.order)) return { ...resp, order: resp.order.map(i => keyTask.perm[i]) };
  if (keyTask.type === 'match' && Array.isArray(resp)) return resp.map(i => (i == null ? null : keyTask.perm[i]));
  return resp;
}

/* -> { points, max, status: right | partial | wrong | empty | pending } ("pending": an open or photo task that AI or the teacher grades) */
function eduScore(keyTask, resp, lang) {
  const max = eduPoints(keyTask);
  if (keyTask.type === 'photo') return { points: 0, max, status: resp && (resp.path || resp.url) ? 'pending' : 'empty' };
  if (keyTask.type === 'open') {
    const text = resp && typeof resp === 'object' ? resp.text : resp;
    return { points: 0, max, status: String(text || '').trim() ? 'pending' : 'empty' };
  }
  if (!EDU_AUTO_TYPES.includes(keyTask.type)) return { points: 0, max, status: 'pending' };
  try {
    const r = scoreTask({ ...keyTask, points: max }, eduUnmix(keyTask, resp), lang || 'bg');
    return { points: r.points, max, status: r.status === 'ungraded' ? 'pending' : r.status };
  } catch (e) { return { points: 0, max, status: 'wrong' }; }
}

/* the whole attempt: per task + totals; graded = points of tasks that are already graded */
function eduScoreAll(key, order, responses, lang, manual) {
  const per = {}; let points = 0, max = 0, pending = 0;
  for (const id of order) {
    const k = key[id]; if (!k) continue;
    let r = eduScore(k, responses ? responses[id] : null, lang);
    const m = manual && manual[id];
    if (m && Number.isFinite(m.points)) r = { ...r, points: clamp(m.points, 0, r.max), status: m.points >= r.max ? 'right' : m.points > 0 ? 'partial' : 'wrong', by: m.by || 'teacher' };
    per[id] = r; max += r.max; points += r.points; if (r.status === 'pending') pending++;
  }
  return { per, points: roundTo(points, 2), max: roundTo(max, 2), pending };
}

/* Projector quiz: 0 for a wrong answer, 500–1000 for a right one, more for a fast one */
function eduQuizPoints(status, ms, limitMs) {
  if (status !== 'right' && status !== 'partial') return 0;
  const speed = limitMs > 0 ? clamp(1 - ms / limitMs, 0, 1) : 0.5;
  return Math.round((status === 'partial' ? 0.5 : 1) * (500 + 500 * speed));
}

/* ---------- Protection during a test (anti-cheat) ----------
   One set of rules for the teacher's settings, the student's phone and the server (proctorReport in functions/index.js).
   Events the student's device reports:
     strike   leaving the test: counts towards the limit, then the test is locked or handed in (the teacher's choice)
     flag     suspicious, shown to the teacher, never locks
     info     start, back, pinned, photo …
   A test or a live test is protected by default; homework and practice only log when the student leaves. */
const EDU_AC_STRIKE = ['left', 'gap', 'split', 'unpin', 'fullscreen', 'recording', 'cast', 'device', 'tamper', 'a11y', 'adb', 'print'];
const EDU_AC_FLAG = ['blur', 'copy', 'cut', 'paste', 'screenshot', 'monitors', 'resize', 'devtools', 'nopin', 'offline'];
const EDU_AC_EVENTS = [...EDU_AC_STRIKE, ...EDU_AC_FLAG, 'start', 'back', 'pinned', 'photo', 'warned', 'locked', 'unlocked', 'submitted'];
const EDU_AC_ACTIONS = ['log', 'lock', 'submit'];
const EDU_AC_SWITCHES = ['detectLeave', 'blockCopy', 'fullscreen', 'lockApp', 'secure', 'noOverlays', 'watermark', 'deviceCheck', 'blockA11y', 'integrity', 'appOnly'];
const EDU_AC_BLUR_STRIKE_S = 3;     /* another window over the test (PC) or the notification shade (phone) for at least 3 s counts as leaving */
const EDU_AC_GAP_STRIKE_S = 60;     /* no sign of life from the test for a minute (offline, or the page was stopped) counts as leaving */

function eduAcDefaults(kind, mode) {
  const on = (kind === 'test' || kind === 'live') && mode !== 'quiz';
  const out = { onLeave: on ? 'lock' : 'log', allowedLeaves: 1 };
  for (const k of EDU_AC_SWITCHES) out[k] = on;
  out.detectLeave = true;           /* homework still tells the teacher when the student left, it just never interrupts */
  out.appOnly = false;              /* the teacher decides whether the web version is allowed */
  out.integrity = false;            /* needs BingO on Google Play (docs/test-security.md) */
  return out;
}

/* the teacher's settings, checked (old tests had autoLockAfter: lock after N alerts) */
function eduAcClean(anti, kind, mode) {
  anti = anti && typeof anti === 'object' ? anti : {};
  const d = eduAcDefaults(kind, mode), out = {};
  for (const k of EDU_AC_SWITCHES) out[k] = typeof anti[k] === 'boolean' ? anti[k] : d[k];
  const old = Math.floor(Number(anti.autoLockAfter) || 0);
  out.onLeave = EDU_AC_ACTIONS.includes(anti.onLeave) ? anti.onLeave : old > 0 ? 'lock' : d.onLeave;
  const al = Number.isFinite(Number(anti.allowedLeaves)) && anti.allowedLeaves !== null && anti.allowedLeaves !== '' ? Math.floor(Number(anti.allowedLeaves)) : old > 0 ? old - 1 : d.allowedLeaves;
  out.allowedLeaves = clamp(al, 0, 10);
  if (!out.detectLeave) out.onLeave = 'log';
  return out;
}

/* does this event count as leaving the test? */
function eduAcStrike(e) {
  if (!e || typeof e !== 'object') return false;
  if (e.type === 'blur') return (Number(e.secs) || 0) >= EDU_AC_BLUR_STRIKE_S;
  if (e.type === 'gap') return (Number(e.secs) || 0) >= EDU_AC_GAP_STRIKE_S;
  if (e.type === 'screenshot') return e.blocked === false;      /* a screenshot that Android blocked is only an attempt */
  return EDU_AC_STRIKE.includes(e.type);
}
const eduAcFlagged = e => !!e && (EDU_AC_STRIKE.includes(e.type) || EDU_AC_FLAG.includes(e.type));

/* what happens after one more strike: null (nothing), 'warn', 'lock' or 'submit' */
function eduAcVerdict(ac, strikes, forgiven) {
  const n = (strikes || 0) - (forgiven || 0);
  if (n <= 0) return null;
  if (ac.onLeave === 'log') return null;
  return n > ac.allowedLeaves ? ac.onLeave : 'warn';
}

/* Class codes: 6 letters and digits without look-alikes (no 0/O, 1/I/L) */
const EDU_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function eduCode(rand) { let s = ''; for (let i = 0; i < 6; i++) s += EDU_CODE_CHARS[Math.floor((rand || Math.random)() * EDU_CODE_CHARS.length)]; return s; }
const eduCodeOk = c => typeof c === 'string' && /^[A-HJ-KM-NP-Z2-9]{6}$/.test(c);

/* A task the teacher wrote must be complete before it goes to a class */
function eduTaskProblem(t) {
  if (!t || typeof t !== 'object') return 'празна задача';
  if (!EDU_TASK_TYPES.includes(t.type)) return 'непознат вид задача';
  if (!t.id) return 'няма id';
  if (!String(t.prompt || '').trim() && t.type !== 'gaps') return 'няма условие';
  switch (t.type) {
    case 'choice': return Array.isArray(t.options) && t.options.length >= 2 && Number.isInteger(t.answer) && t.answer >= 0 && t.answer < t.options.length ? '' : 'избери верния отговор';
    case 'multi': return Array.isArray(t.options) && t.options.length >= 2 && Array.isArray(t.answer) && t.answer.length ? '' : 'отбележи поне един верен отговор';
    case 'text': return arr(t.answer).some(a => String(a).trim()) ? '' : 'напиши верния отговор';
    case 'number': return Number.isFinite(t.answer) ? '' : 'напиши верното число';
    case 'gaps': return typeof t.text === 'string' && Array.isArray(t.gaps) && t.gaps.length && (t.text.match(/\[\[\d+\]\]/g) || []).length === t.gaps.length && t.gaps.every(g => (g.options ? Number.isInteger(g.answer) : arr(g.answer).some(a => String(a).trim()))) ? '' : 'всяко празно място [[1]] трябва да има отговор';
    case 'order': return Array.isArray(t.items) && t.items.length >= 2 ? '' : 'нужни са поне 2 елемента';
    case 'match': return Array.isArray(t.left) && Array.isArray(t.right) && t.left.length >= 2 && t.left.length === t.right.length ? '' : 'двете колони трябва да са еднакво дълги';
    default: return '';
  }
}

if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, { EDU_TASK_TYPES, EDU_AUTO_TYPES, EDU_SCALES, EDU_BG6_DEFAULT, EDU_GRADE_NAMES, eduGrade, eduGradeName, eduStrip, eduStripTask, eduUnmix, eduScore, eduScoreAll, eduQuizPoints, eduCode, eduCodeOk, eduTaskProblem, eduPoints,
  EDU_AC_STRIKE, EDU_AC_FLAG, EDU_AC_EVENTS, EDU_AC_ACTIONS, EDU_AC_SWITCHES, EDU_AC_BLUR_STRIKE_S, EDU_AC_GAP_STRIKE_S, eduAcDefaults, eduAcClean, eduAcStrike, eduAcFlagged, eduAcVerdict });
