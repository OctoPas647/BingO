/* ================= Demo mode: a whole school in the app, with no internet and no sign-in =================
   For showing BingO (EduHack demo day): "Демо ученик" and "Демо учител" fill the app with a realistic
   student and a realistic class, and the REAL teacher and class screens run on top of it.
   How: a small in-memory copy of the Firestore / Functions / Auth API that the class features use
   (collection, doc, where, orderBy, limit, get, onSnapshot, add, set, update, delete, FieldValue,
   httpsCallable). cloudLoad() hands it out instead of Firebase while the demo is on, so nothing
   leaves the device and nothing needs a network. The data is rebuilt on every start of the demo:
   - class 12А (Руски език, 24 students) after a mock ДЗИ in Russian (a real МОН past exam, B1 2025),
     graded: closed questions by the "server", open answers by "Gemini" waiting for the teacher,
     two students with anti-cheat alerts (one locked by the server)
   - class 12Б (Математика, 20 students) with homework due this week and a live test ready to start
   - every student's skill map from everyday practice (the class's weak skills)
   The demo student is Мария Петрова from 12А: her Клас tab, her Russian result, her own skill map. */

const DEMO_KEY = 'bingo.demo';
const DEMO = { role: null };
try { const v = localStorage.getItem(DEMO_KEY); if (v === 'student' || v === 'teacher') DEMO.role = v; } catch (e) { }
const demoCloudOn = () => !!DEMO.role;
const DEMO_T = 'demo-teacher', DEMO_ME = 'demo-s1';

/* ---------- a tiny Firestore ---------- */
class DemoTs { constructor(ms) { this._ms = ms; this.seconds = Math.floor(ms / 1000); this.nanoseconds = (ms % 1000) * 1e6; } toMillis() { return this._ms; } toDate() { return new Date(this._ms); } }
const dts = ms => new DemoTs(Math.round(ms));
const DFV = {
  serverTimestamp: () => ({ __fv: 'ts' }), delete: () => ({ __fv: 'del' }),
  arrayUnion: (...v) => ({ __fv: 'union', v }), arrayRemove: (...v) => ({ __fv: 'remove', v }), increment: n => ({ __fv: 'inc', n })
};
const DB = new Map();     /* full path -> data */
const DB_SUBS = new Set();
let demoSeq = 0;
const demoId = () => 'd' + Date.now().toString(36) + (demoSeq++).toString(36);
function dbApply(old, data, merge) {
  const out = merge && old ? { ...old } : {};
  const put = (obj, k, v) => {
    if (v && typeof v === 'object' && v.__fv) {
      if (v.__fv === 'ts') obj[k] = dts(Date.now());
      else if (v.__fv === 'del') delete obj[k];
      else if (v.__fv === 'union') obj[k] = [...new Set([...(obj[k] || []), ...v.v])];
      else if (v.__fv === 'remove') obj[k] = (obj[k] || []).filter(x => !v.v.includes(x));
      else if (v.__fv === 'inc') obj[k] = (obj[k] || 0) + v.n;
    } else obj[k] = v;
  };
  for (const [k, v] of Object.entries(data || {})) {
    if (k.includes('.')) {   /* update({ 'a.b': x }) */
      const parts = k.split('.'); let o = out;
      for (const p of parts.slice(0, -1)) { o[p] = { ...(o[p] || {}) }; o = o[p]; }
      put(o, parts[parts.length - 1], v);
    } else put(out, k, v);
  }
  return out;
}
function dbWrite(path, data, merge) { DB.set(path, dbApply(DB.get(path), data, merge)); dbNotify(); }
function dbNotify() { clearTimeout(dbNotify.t); dbNotify.t = setTimeout(() => DB_SUBS.forEach(f => { try { f(); } catch (e) { console.warn(e); } }), 0); }
const getField = (o, f) => f.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const cmpVal = v => (v instanceof DemoTs ? v.toMillis() : v);
function docSnap(path) {
  const d = DB.get(path), id = path.split('/').pop();
  return { id, exists: !!d, ref: demoDoc(path), data: () => (d ? JSON.parse(JSON.stringify(d), (k, v) => (v && v._ms != null && v.seconds != null ? dts(v._ms) : v)) : undefined), get: f => d && getField(d, f) };
}
function demoQuery(path, filters = [], order = [], lim = 0) {
  const run = () => {
    const depth = path.split('/').length + 1;
    let rows = [...DB.keys()].filter(k => k.startsWith(path + '/') && k.split('/').length === depth).map(docSnap);
    for (const [f, op, v] of filters) rows = rows.filter(s => {
      const x = cmpVal(getField(s.data(), f)), y = cmpVal(v);
      return op === '==' ? x === y : op === '!=' ? x !== y : op === 'array-contains' ? Array.isArray(x) && x.includes(y) : op === 'in' ? y.includes(x)
        : op === 'array-contains-any' ? Array.isArray(x) && x.some(z => y.includes(z)) : op === '>=' ? x >= y : op === '<=' ? x <= y : op === '>' ? x > y : op === '<' ? x < y : true;
    });
    for (const [f, dir] of order.slice().reverse()) rows.sort((a, b) => { const x = cmpVal(getField(a.data(), f)) ?? 0, y = cmpVal(getField(b.data(), f)) ?? 0; return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); });
    if (lim) rows = rows.slice(0, lim);
    return { docs: rows, empty: !rows.length, size: rows.length, forEach: fn => rows.forEach(fn) };
  };
  return {
    where: (f, op, v) => demoQuery(path, [...filters, [f, op, v]], order, lim),
    orderBy: (f, dir) => demoQuery(path, filters, [...order, [f, dir || 'asc']], lim),
    limit: n => demoQuery(path, filters, order, n), limitToLast: n => demoQuery(path, filters, order, n), startAfter: () => demoQuery(path, filters, order, lim),
    get: async () => run(),
    onSnapshot: (cb, err) => { let last = ''; const f = () => { const s = run(), sig = JSON.stringify(s.docs.map(d => [d.id, DB.get(path + '/' + d.id)])); if (sig !== last) { last = sig; cb(s); } }; setTimeout(f, 0); DB_SUBS.add(f); return () => DB_SUBS.delete(f); },
    add: async data => { const id = demoId(); dbWrite(path + '/' + id, data); return demoDoc(path + '/' + id); },
    doc: id => demoDoc(path + '/' + (id || demoId()))
  };
}
function demoDoc(path) {
  return {
    id: path.split('/').pop(), path,
    get: async () => docSnap(path),
    set: async (data, opt) => dbWrite(path, data, opt && opt.merge),
    update: async data => { if (!DB.has(path)) throw new Error('not found'); dbWrite(path, data, true); },
    delete: async () => { DB.delete(path); dbNotify(); },
    onSnapshot: (cb) => { let last = null; const f = () => { const sig = JSON.stringify(DB.get(path) || null); if (sig !== last) { last = sig; cb(docSnap(path)); } }; setTimeout(f, 0); DB_SUBS.add(f); return () => DB_SUBS.delete(f); },
    collection: sub => demoQuery(path + '/' + sub)
  };
}
const demoDb = { collection: p => demoQuery(p), doc: p => demoDoc(p), batch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: r => ops.push(() => r.delete()), commit: async () => { for (const f of ops) await f(); } }; } };

/* ---------- Cloud Functions: what the real server would answer ---------- */
const DEMO_AI_TEXT = {
  insights: '**Какво да направите в следващия час**\n\n- Въпроси 9–12 (четене, текст 2) са най-трудни: 41% верни. Половината клас избира „Неправильно“ при перифраза — упражнете синоними и перифраза.\n- Отворените въпроси за писане: граматиката на глаголите за движение (идти/ходить) е най-честата грешка.\n- 6 ученици са под 50%: дайте им упражнение в BingO върху „Граматика“ — приложението ще им подбере задачите.',
  default: 'В демото Gemini отговаря с примерен текст. С настроен сървър тук идва истинският отговор на Gemini.'
};
async function demoFn(name, data) {
  await new Promise(r => setTimeout(r, 450));
  data = data || {};
  if (name === 'teacherAI') return { text: DEMO_AI_TEXT[data.action] || DEMO_AI_TEXT.default, tasks: [], ok: true };
  if (name === 'createClass') { const id = demoId(), code = eduCode(); dbWrite('classes/' + id, { name: data.name, subject: data.subject || '', grade: data.grade || '', color: data.color || '#2F5BD3', code, teacherIds: [DEMO_T], studentIds: [], createdAt: DFV.serverTimestamp() }); return { classId: id, code }; }
  if (name === 'updateAssignment') { const { assignmentId, ...rest } = data; if (rest.reopen) rest.status = 'open'; if (rest.close) rest.status = 'closed'; delete rest.reopen; delete rest.close; dbWrite('assignments/' + assignmentId, rest, true); return { ok: true }; }
  if (name === 'releaseResults') { dbWrite('assignments/' + data.assignmentId, { released: { score: true, full: !!data.full } }, true); return { ok: true }; }
  if (name === 'approveAll') { for (const [p, r] of DB) if (p.startsWith('results/') && r.assignmentId === data.assignmentId && r.needsReview) dbWrite(p, { needsReview: false }, true); return { ok: true }; }
  if (name === 'gradeTask') { const p = 'results/' + data.attemptId, r = DB.get(p); if (r && r.per && r.per[data.taskId]) { const per = { ...r.per, [data.taskId]: { ...r.per[data.taskId], points: data.points, status: data.points >= r.per[data.taskId].max ? 'right' : data.points > 0 ? 'partial' : 'wrong', by: 'teacher' } }; const pts = sum(Object.values(per).map(x => x.points || 0)); dbWrite(p, { per, points: pts, pct: pts / r.max, grade: eduGrade(pts, r.max, { scale: 'matura' }), needsReview: Object.values(per).some(x => x.status === 'pending' || x.by === 'ai') }, true); } return { ok: true }; }
  if (name === 'liveControl') { const p = 'assignments/' + data.assignmentId, a = DB.get(p); if (a) { const live = { ...(a.live || {}) }; if (data.action === 'start') { live.state = 'question'; live.q = 0; live.startedAt = dts(Date.now()); } else if (data.action === 'end') live.state = 'ended'; else if (data.action === 'pause') live.state = 'paused'; else if (data.action === 'resume') live.state = 'question'; else if (data.action === 'next') live.q = (live.q || 0) + 1; dbWrite(p, { live, status: live.state === 'ended' ? 'closed' : a.status }, true); } return { ok: true }; }
  if (name === 'proctorControl') { const p = 'attempts/' + (data.attemptId || ''); if (DB.has(p)) dbWrite(p, data.action === 'unlock' || data.action === 'forgive' ? { locked: false, forgiven: (DB.get(p).flags || 0) } : data.action === 'lock' ? { locked: true } : {}, true); return { ok: true }; }
  if (name === 'inviteStudents') return { invited: (data.emails || []).length, ok: true };
  if (name === 'registerProfile') return { ok: true };
  toast(L('В демото това не се изпраща никъде.'));
  return { ok: true };
}

/* ---------- the demo user ---------- */
function demoUser(role) {
  const t = role === 'teacher';
  return { uid: t ? DEMO_T : DEMO_ME, displayName: t ? 'Елена Петрова' : 'Мария Петрова', email: t ? 'e.petrova@demo.bingo.bg' : 'maria.petrova@demo.bingo.bg', photoURL: null,
    getIdTokenResult: async () => ({ claims: { role: t ? 'teacher' : 'student' } }), getIdToken: async () => 'demo' };
}
async function demoCloudLoad() {
  if (!DB.size) demoSeed();
  CLOUD.db = demoDb; CLOUD.fn = { httpsCallable: name => d => demoFn(name, d).then(data => ({ data })) };
  CLOUD.auth = { currentUser: CLOUD.user, signOut: async () => { }, onAuthStateChanged: () => () => { } };
  CLOUD.storage = { ref: () => ({ put: async () => { }, getDownloadURL: async () => '' }) };
  CLOUD.user = demoUser(DEMO.role); CLOUD.role = DEMO.role === 'teacher' ? 'teacher' : 'student'; CLOUD.claims = { role: CLOUD.role };
  CLOUD.profile = (DB.get('users/' + CLOUD.user.uid)) || null; CLOUD.ready = true;
  window.firebase = window.firebase || { firestore: { FieldValue: DFV, Timestamp: { fromMillis: dts, now: () => dts(Date.now()) } } };
  if (!window.firebase.firestore || !window.firebase.firestore.FieldValue) window.firebase.firestore = { FieldValue: DFV };
  return CLOUD;
}

/* ---------- the demo school ---------- */
const DEMO_NAMES = ['Мария Петрова', 'Георги Иванов', 'Елена Димитрова', 'Никола Стоянов', 'Виктория Николова', 'Александър Георгиев', 'Йоана Христова', 'Мартин Тодоров', 'Габриела Ангелова', 'Даниел Колев',
  'Симона Маринова', 'Петър Василев', 'Десислава Петкова', 'Калоян Илиев', 'Рая Михайлова', 'Стефан Атанасов', 'Теодора Йорданова', 'Борис Костадинов', 'Ивана Русева', 'Кристиан Попов',
  'Михаела Стефанова', 'Владимир Генов', 'Цветелина Борисова', 'Радослав Митев', 'Ния Кирилова', 'Емил Цветков', 'Магдалена Пенева', 'Пламен Захариев', 'Адриана Симеонова', 'Любомир Дончев',
  'Яна Велева', 'Христо Лазаров', 'Деница Славова', 'Огнян Бонев', 'Златина Ганева', 'Васил Найденов', 'Анелия Тончева', 'Тодор Китанов', 'Кремена Янкова', 'Илиян Динев', 'Силвия Ценова', 'Румен Добрев', 'Нели Вълчева', 'Асен Бояджиев'];
const DEMO_RU_EXAM = 'dzi12-ru-2025-05-23-b1-v2';
const DEMO_RU_OPEN = [   /* what students wrote in the open questions, and what "Gemini" said about it */
  ['Я думаю, что летом лучше всего отдыхать на море, потому что там можно плавать и загорать.', 'Отговорът е по темата и граматически верен. Липсва втори аргумент.', 0.8],
  ['Мой друг ходил в кино вчера и он сказал что фильм был очень интересно.', 'Смисълът е ясен, но „интересно“ трябва да е „интересный“; липсва запетая пред „что“.', 0.5],
  ['Я хочу ехать в Москву потому что там много музеи.', 'Глаголът за движение е верен, но „много музеи“ → „много музеев“ (родителен падеж мн. ч.).', 0.5],
  ['Каждое утро я иду в школу пешком, это занимает двадцать минут.', 'Правилен глагол и вид; естествена фраза. Пълен брой точки.', 1],
  ['не знаю', 'Отговорът не отговаря на задачата.', 0]
];
function demoSeed() {
  DB.clear();
  const now = Date.now(), day = 864e5, r = seedRng('bingo-demo-day');
  dbWrite('users/' + DEMO_T, { name: 'Елена Петрова', role: 'teacher', school: 'ПГЕЕ Пловдив', subjects: ['Руски език', 'Математика'], lang: 'bg' });
  dbWrite('users/' + DEMO_ME, { name: 'Мария Петрова', role: 'student', school: 'ПГЕЕ Пловдив' });
  const mk = (n, from) => Array.from({ length: n }, (_, i) => ({ id: 'demo-s' + (from + i + 1), name: DEMO_NAMES[(from + i) % DEMO_NAMES.length] }));
  const A12 = mk(24, 0), B12 = mk(20, 24);
  const classes = [['c12a', '12А', 'Руски език', '#E5484D', 'K7M2QX', A12], ['c12b', '12Б', 'Математика', '#2F5BD3', 'P4WH9R', B12]];
  for (const [id, name, subject, color, code, st] of classes) {
    dbWrite('classes/' + id, { name, subject, grade: '12', color, code, teacherIds: [DEMO_T], studentIds: st.map(s => s.id), createdAt: dts(now - 40 * day), settings: {} });
    st.forEach((s, i) => dbWrite(`classes/${id}/members/${s.id}`, { name: s.name, email: s.id.replace('demo-', '') + '@demo.bingo.bg', joinedAt: dts(now - (39 - i % 5) * day) }));
  }
  /* ---- the Russian mock exam (a real МОН past exam), given yesterday, graded ---- */
  const ex = (window.PAST_EXAMS_JSON || []).find(x => x.id === DEMO_RU_EXAM) || (window.PAST_EXAMS_JSON || []).find(x => /-ru-/.test(x.id));
  if (ex) {
    const tasks = ex.exams[0].parts.flatMap(p => p.tasks).map(t => ({ ...t, id: t.id, passage: undefined, prompt: t.passage && ex.passages && ex.passages[t.passage] ? t.prompt : t.prompt }));
    const passages = ex.passages || {};
    const { pub, key } = eduStrip(tasks, 'demo-ru');
    const aid = 'demo-ru-mock', title = 'Пробен ДЗИ · Руски език B1 (МОН, май 2025)', anti = eduAcDefaults('test');
    dbWrite('assignments/' + aid, { title, kind: 'test', mode: 'exam', classId: 'c12a', className: '12А', subject: 'Руски език', lang: 'ru', teacherIds: [DEMO_T], studentIds: A12.map(s => s.id), tasks: pub, passages, taskCount: pub.length, maxPoints: sum(pub.map(eduPoints)),
      status: 'closed', createdAt: dts(now - 1.2 * day), opensAt: dts(now - day), closesAt: dts(now - day + 150 * 60e3), timeLimitMin: 150, testId: 'demo-test-ru', released: { score: true, full: true },
      settings: { grading: { scale: 'matura' }, feedback: { show: 'full', when: 'release' }, anti } });
    dbWrite(`assignments/${aid}/key/answers`, { tasks: key });
    const order = pub.map(t => t.id), ability = A12.map((s, i) => (s.id === DEMO_ME ? 0.82 : clamp(0.35 + r.f() * 0.6, 0.2, 0.97)));
    A12.forEach((s, i) => {
      if (i === 23) return;   /* one student never started */
      const responses = {}, timeOn = {}, manual = {}, ai = {};
      order.forEach((id, n) => {
        const k = key[id]; timeOn[id] = 20 + Math.floor(r.f() * 90);
        if (k.type === 'choice') responses[id] = r.f() < ability[i] ? k.answer : (k.answer + 1 + Math.floor(r.f() * (k.options.length - 1))) % k.options.length;
        else if (k.type === 'open') {
          const o = DEMO_RU_OPEN[Math.min(DEMO_RU_OPEN.length - 1, Math.floor((1 - ability[i]) * 4 + r.f() * 1.5))];
          responses[id] = { text: o[0] };
          const pts = roundTo(o[2] * eduPoints(k), 1);
          ai[id] = { points: pts, max: eduPoints(k), feedback: o[1], comment: o[1], approved: i % 4 !== 1, at: dts(now - day + 3 * 3600e3) };
          if (i % 4 !== 1) manual[id] = { points: pts, by: i % 4 === 0 ? 'teacher' : 'ai' };
        }
      });
      const scored = eduScoreAll(key, order, responses, 'ru', manual);
      const pending = Object.values(scored.per).some(p => p.status === 'pending');
      const flagsN = i === 3 ? 3 : i === 9 ? 1 : 0, start = now - day + 2 * 60e3 + i * 20e3, end = start + (95 + Math.floor(r.f() * 50)) * 60e3;
      const events = [{ type: 'start', at: dts(start) }];
      if (flagsN) {
        events.push({ type: 'left', at: dts(start + 31 * 60e3), secs: 14, app: 'Chrome' });
        if (flagsN > 1) events.push({ type: 'warned', at: dts(start + 31 * 60e3 + 1000) }, { type: 'screenshot', at: dts(start + 47 * 60e3), blocked: true }, { type: 'left', at: dts(start + 52 * 60e3), secs: 41, app: 'Google Lens' }, { type: 'locked', at: dts(start + 52 * 60e3 + 900) }, { type: 'unlocked', at: dts(start + 55 * 60e3), by: 'teacher' });
      }
      events.push({ type: 'submitted', at: dts(end) });
      const attId = aid + '_' + s.id;
      dbWrite('attempts/' + attId, { assignmentId: aid, studentId: s.id, studentName: s.name, studentEmail: s.id.replace('demo-', '') + '@demo.bingo.bg', teacherIds: [DEMO_T], classId: 'c12a', status: pending ? 'submitted' : 'graded',
        order, responses, timeOn, startedAt: dts(start), submittedAt: dts(end), flags: flagsN, strikes: flagsN ? Math.min(2, flagsN) : 0, events,
        device: { platform: 'android', model: ['Xiaomi 17 Ultra', 'Samsung Galaxy A56', 'Pixel 9a', 'Nothing Phone (3a)'][i % 4], os: 'Android 16', app: '0.8.1', integrity: 'ok', ip: '85.11.' + (40 + i) + '.' + (10 + i) } });
      const grade = eduGrade(scored.points, scored.max, { scale: 'matura' });
      dbWrite('results/' + attId, { assignmentId: aid, attemptId: attId, studentId: s.id, studentName: s.name, teacherIds: [DEMO_T], classId: 'c12a', title, points: scored.points, max: scored.max, pct: scored.points / scored.max, grade,
        per: Object.fromEntries(Object.entries(scored.per).map(([id, p]) => [id, ai[id] && !manual[id] ? { ...p, status: 'pending', by: 'ai' } : p])), manual, ai, needsReview: i % 4 === 1, flags: flagsN, gradedAt: dts(end + 3 * 3600e3), kind: 'test', visible: true, startedAt: dts(start), submittedAt: dts(end),
        comment: s.id === DEMO_ME ? 'Много добро четене! Упражнявай граматиката — глаголите за движение и падежите след „много“.' : '' });
      dbWrite('reviews/' + attId, { assignmentId: aid, studentId: s.id, teacherIds: [DEMO_T], visible: true,
        tasks: Object.fromEntries(order.map(id => { const k = key[id]; return [id, { answer: k.answer ?? null, gaps: null, perm: k.perm || null, explain: k.explain || '', rubric: k.rubric || null, aiComment: ai[id] ? ai[id].comment : '' }]; })) });
    });
    dbWrite('tests/demo-test-ru', { title: 'ДЗИ Руски език B1 · май 2025', subject: 'Руски език', grade: '12', ownerId: DEMO_T, tasks, passages, lang: 'ru', createdAt: dts(now - 3 * day), updatedAt: dts(now - 3 * day) });
    /* Мария's message from the teacher */
    dbWrite(`users/${DEMO_ME}/inbox/n1`, { title: L('Резултатът е готов: {t}', { t: title }), assignmentId: aid, at: dts(now - 2 * 3600e3), read: false });
  }
  /* ---- 12Б: math homework due this week, a live test ready, a test next week ---- */
  const mathTasks = [];
  for (const sk of ['pct', 'lin', 'quad', 'prob', 'rtri', 'pow']) for (let j = 0; j < 2; j++) { const t = typeof MATH_GEN !== 'undefined' && MATH_GEN[sk] ? genMathTask(sk, 2, 'demo-hw' + sk + j) : null; if (t) mathTasks.push({ ...t, id: 'm' + mathTasks.length, points: 2 }); }
  if (mathTasks.length) {
    const { pub, key } = eduStrip(mathTasks, 'demo-m');
    const hw = 'demo-math-hw';
    dbWrite('assignments/' + hw, { title: 'Домашно: проценти и линейни уравнения', kind: 'homework', classId: 'c12b', className: '12Б', subject: 'Математика', teacherIds: [DEMO_T], studentIds: B12.map(s => s.id), tasks: pub, taskCount: pub.length, maxPoints: sum(pub.map(eduPoints)),
      status: 'open', createdAt: dts(now - 2 * day), opensAt: dts(now - 2 * day), closesAt: dts(now + 2 * day), timeLimitMin: 0, settings: { grading: { scale: 'bg6' }, feedback: { show: 'full', when: 'now' }, anti: eduAcDefaults('homework') } });
    dbWrite(`assignments/${hw}/key/answers`, { tasks: key });
    B12.slice(0, 13).forEach((s, i) => {
      const order = pub.map(t => t.id), responses = {};
      order.forEach(id => { const k = key[id]; if (k.type === 'choice') responses[id] = r.f() < 0.7 ? k.answer : (k.answer + 1) % k.options.length; else if (k.type === 'number') responses[id] = r.f() < 0.65 ? String(arr(k.answer)[0]) : '7'; });
      const sc = eduScoreAll(key, order, responses, 'bg'), at = dts(now - day + i * 3600e3), id = hw + '_' + s.id;
      dbWrite('attempts/' + id, { assignmentId: hw, studentId: s.id, studentName: s.name, teacherIds: [DEMO_T], classId: 'c12b', status: 'graded', order, responses, startedAt: at, submittedAt: dts(tsMs(at) + 25 * 60e3), flags: 0, events: [] });
      dbWrite('results/' + id, { assignmentId: hw, attemptId: id, studentId: s.id, studentName: s.name, teacherIds: [DEMO_T], classId: 'c12b', title: 'Домашно: проценти и линейни уравнения', points: sc.points, max: sc.max, pct: sc.points / sc.max, grade: eduGrade(sc.points, sc.max, { scale: 'bg6' }), per: sc.per, needsReview: false, flags: 0, gradedAt: at });
    });
    dbWrite('assignments/demo-math-live', { title: 'Тест на живо: вероятности', kind: 'live', mode: 'exam', classId: 'c12b', className: '12Б', subject: 'Математика', teacherIds: [DEMO_T], studentIds: B12.map(s => s.id), tasks: pub.slice(0, 6),
      status: 'open', live: { state: 'lobby' }, createdAt: dts(now - 3600e3), timeLimitMin: 20, settings: { grading: { scale: 'bg6' }, feedback: { show: 'score', when: 'now' }, anti: eduAcDefaults('live') } });
    dbWrite('assignments/demo-math-live/key/answers', { tasks: Object.fromEntries(pub.slice(0, 6).map(t => [t.id, key[t.id]])) });
    dbWrite('assignments/demo-math-next', { title: 'Тест: функции и графики', kind: 'test', classId: 'c12b', className: '12Б', subject: 'Математика', teacherIds: [DEMO_T], studentIds: B12.map(s => s.id), tasks: pub,
      status: 'scheduled', createdAt: dts(now - 3600e3), opensAt: dts(now + 4 * day), closesAt: dts(now + 4 * day + 45 * 60e3), timeLimitMin: 40, settings: { grading: { scale: 'bg6' }, feedback: { show: 'score', when: 'release' }, anti: eduAcDefaults('test') } });
    dbWrite('assignments/demo-ru-hw', { title: 'Упражнение в BingO: граматика', kind: 'practice', classId: 'c12a', className: '12А', subject: 'Руски език', teacherIds: [DEMO_T], studentIds: A12.map(s => s.id), tasks: [],
      practice: { subj: 'ru', skills: ['gram'] }, status: 'open', createdAt: dts(now - 3 * 3600e3), opensAt: dts(now - 3 * 3600e3), closesAt: dts(now + 3 * day), settings: { grading: { scale: 'percent' }, feedback: { show: 'full', when: 'now' }, anti: eduAcDefaults('practice') } });
  }
  /* ---- everyday practice: every student's skill map, for "Слаби места на учениците" ---- */
  const prog = (s, cid, subj, truth) => {
    const skills = {};
    for (const sk of SUBJECTS[subj].skills) {
      const p = clamp((truth[sk.id] ?? 0.6) + (r.f() - 0.5) * 0.5, 0.05, 0.98);
      const misc = (BANK[subj] || []).filter(t => t.skill === sk.id && Array.isArray(t.misc)).flatMap(t => t.misc.filter(Boolean)).slice(0, 3);
      skills[subj + '.' + sk.id] = { p: roundTo(p, 2), w: sk.weight || 1, name: sk.name, status: p >= BKT.strong ? 'strong' : p < BKT.weak ? 'weak' : 'mid', misc: p < 0.6 && misc.length ? [{ k: misc[0], label: miscLabel(misc[0]).replace(/\$/g, ''), n: 1 + Math.floor(r.f() * 3) }] : [] };
    }
    dbWrite('progress/' + s.id + '_' + subj, { id: s.id, name: s.name, classIds: [cid], teacherIds: [DEMO_T], skills, updatedAt: dts(now - r.f() * 3 * day) });
  };
  A12.forEach(s => prog(s, 'c12a', 'ru', { read: 0.62, gram: 0.38, vocab: 0.55 }));
  B12.forEach(s => prog(s, 'c12b', 'math', DEMO_TRUE.math));
}

/* ---------- starting and leaving the demo ---------- */
function demoSetRole(role) { DEMO.role = role; try { if (role) localStorage.setItem(DEMO_KEY, role); else localStorage.removeItem(DEMO_KEY); } catch (e) { } }
/* "Демо ученик": Мария Петрова, 12А — her skill map (math, БЕЛ, Russian), a finished Russian past exam, and her class */
async function demoStudent() {
  if (!(await loadDemoLearner())) return false;
  const ruTruth = { read: 0.78, gram: 0.34, vocab: 0.6 };
  simulateLearner({ truth: DEMO_TRUE, name: 'Мария Петрова', cls: '12А' });
  /* Russian: the skill map from her answers in the mock exam (BingO's Russian tasks come from the past exams) */
  const now = Date.now(), rr = seedRng('demo-ru-map');
  for (const sk of (SUBJECTS.ru ? SUBJECTS.ru.skills : [])) {
    const st = { p: BKT.prior, n: 0, ok: 0, last: 0, misc: {}, hist: [] }, n = 9 + Math.floor(rr.f() * 5);
    for (let i = 0; i < n; i++) { const ok = rr.f() < (ruTruth[sk.id] ?? 0.6); st.p = bktStep(st, ok, 0.25); st.n++; if (ok) st.ok++; st.last = now - (n - i) * 3600e3; st.hist.push([st.last, roundTo(st.p, 3)]); }
    S.skills['ru.' + sk.id + '@' + currentExamKey()] = st;
  }
  Object.assign(S.profile, { role: 'student', exam: 'dzi12', track: 'lang', extra: '', age: S.profile.age || '18' });
  S.subject = 'math';
  S.onboarding = { ...(S.onboarding || {}), done: true };
  const ex = (window.PAST_EXAMS_JSON || []).find(x => x.id === DEMO_RU_EXAM);
  if (ex) (S.pastResults || (S.pastResults = {}))[ex.id] = { pts: 41, max: 50, at: Date.now() - 864e5 };
  saveState(true);
  demoSetRole('student'); DB.clear(); await demoCloudLoad();
  NAV.length = 0; NAV.push({ screen: 'home', params: {} }); render();
  return true;
}
/* "Демо учител": Елена Петрова with 12А and 12Б */
async function demoTeacher() {
  demoSetRole('teacher'); DB.clear();
  Object.assign(S.profile, { role: 'teacher', name: S.profile.name || 'Елена Петрова' });
  S.onboarding = { ...(S.onboarding || {}), done: true }; saveState(true);
  await demoCloudLoad();
  NAV.length = 0; NAV.push({ screen: 'tHome', params: {} }); render();
}
function demoExit() {
  demoSetRole(null); DB.clear(); cloudStopAll();
  Object.assign(CLOUD, { user: null, profile: null, role: '', claims: {}, db: null, fn: null, auth: null, ready: false, loading: null });
  if (S.profile.role === 'teacher') S.profile.role = 'student';
  if (demoBackupHasRealData()) restoreFromDemo(); else saveState(true);
  NAV.length = 0; NAV.push({ screen: onboardingNeeded() ? 'onboarding' : 'home', params: {} }); render();
}
/* the demo picker, the same everywhere it is offered */
function demoPicker() {
  return sheet({ title: L('Покажи демо'), body: `<p>${L('Демото пълни приложението с ученик и цял клас — без интернет и без вход. Твоите данни се пазят и се връщат с „Изход от демото“.')}</p>
    <div class="ios-group demo-pick">
      <button class="ios-row" data-act="student"><span class="sp-icon">🎓</span><span class="ios-row-text"><b>${L('Демо ученик')}</b><small>${L('Мария, 12А: карта на уменията, решен ДЗИ по руски, клас')}</small></span>${icon('next')}</button>
      <button class="ios-row" data-act="teacher"><span class="sp-icon">🧑‍🏫</span><span class="ios-row-text"><b>${L('Демо учител')}</b><small>${L('12А и 12Б: пробен ДЗИ по руски с резултати, сигнали, тест на живо')}</small></span>${icon('next')}</button>
    </div>${demoCloudOn() ? `<button class="btn ghost block" data-act="exit">${icon('logout')}${L('Изход от демото')}</button>` : ''}` })
    .then(v => (v === 'student' ? demoStudent() : v === 'teacher' ? demoTeacher() : v === 'exit' ? demoExit() : null));
}
document.addEventListener('click', e => { if (e.target.closest('[data-demo-pick]')) { e.preventDefault(); e.stopPropagation(); demoPicker(); } }, true);
/* the old "Покажи с демо ученик" / "Зареди демо ученик" buttons open the picker too */
document.addEventListener('click', e => { const b = e.target.closest('[data-demo]'); if (b && !b.closest('.sheet')) { e.preventDefault(); e.stopImmediatePropagation(); demoPicker(); } }, true);

/* the teacher's "Още" screen and the student's Profile get the demo buttons too */
(function demoButtons() {
  const add = (name, where) => {
    const inner = SCREENS[name];
    SCREENS[name] = async (el, ...rest) => {
      await inner(el, ...rest);
      const host = where(el); if (!host || el.querySelector('[data-demo-pick]')) return;
      host.insertAdjacentHTML('beforeend', `<div class="card demo-card"><h3>${icon('eye')}${L('Демо')}</h3><p class="muted small">${L('Ученик и цял клас с резултати — без интернет и без вход.')}</p>
        <button class="btn accent block" data-demo-pick>${icon('play')}${demoCloudOn() ? L('Демо: смени или излез') : L('Покажи демо: ученик или учител')}</button></div>`);
    };
  };
  add('profile', el => el.querySelector('.pad'));
  add('tMore', el => el.querySelector('.t-main'));
})();
