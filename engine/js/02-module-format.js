/* ================= Module format: checking and preparing a module.json =================
   checkModule(json, files)  -> { errors: [...], warnings: [...] }   (files: Set of paths inside the zip)
   prepareModule(json)       -> the same module with defaults filled in and lookup tables added
   See docs/MODULE-FORMAT.md. Pure functions: the build's content check runs this file in Node. */
const MODULE_FORMAT = 1;
const TASK_TYPES = ['choice', 'multi', 'text', 'number', 'gaps', 'order', 'match', 'open'];
const BLOCK_TYPES = ['text', 'note', 'image', 'audio', 'video', 'code'];
const KNOWN_TOOLS = ['calculator'];
const GAP_RE = /\[\[(\d+)\]\]/g;

const blockOf = b => (typeof b === 'string' ? { type: 'text', text: b } : b);
const mediaPaths = b => ['src', 'poster'].map(k => b && b[k]).filter(Boolean);

function checkModule(m, files) {
  const errors = [], warnings = [], E = (at, msg) => errors.push({ at, msg }), W = (at, msg) => warnings.push({ at, msg });
  if (!isObj(m)) { E('module.json', 'is not a JSON object'); return { errors, warnings }; }
  if (m.format !== MODULE_FORMAT) E('format', `must be ${MODULE_FORMAT}`);
  if (typeof m.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(m.id)) E('id', 'must be 2–80 letters, digits, ".", "-" or "_"');
  if (typeof m.version !== 'string' || !m.version.trim()) E('version', 'is missing');
  if (typeof m.lang !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(m.lang)) E('lang', 'must be a language code such as "bg" or "en"');
  if (typeof m.title !== 'string' || !m.title.trim()) E('title', 'is missing');
  if (m.color != null && !/^#[0-9a-fA-F]{6}$/.test(m.color)) E('color', 'must look like #1A2B3C');
  for (const t of arr(m.tools)) if (!KNOWN_TOOLS.includes(t)) W('tools', `unknown tool "${t}" is ignored`);

  const checkMedia = (at, path) => {
    if (typeof path !== 'string' || /^([a-z]+:|\/|\\)|\.\./i.test(path)) return E(at, 'media must be a file inside the module, like "media/picture.png"');
    if (files && !files.has(path)) E(at, `file "${path}" is not in the module`);
  };
  if (typeof m.icon === 'string' && /[./]/.test(m.icon)) checkMedia('icon', m.icon);

  const scales = isObj(m.scales) ? m.scales : {};
  if (m.scales != null && !isObj(m.scales)) E('scales', 'must be an object of named scales');
  for (const [id, s] of Object.entries(scales)) {
    const at = `scales.${id}`;
    if (!isObj(s)) { E(at, 'must be an object'); continue; }
    if (!Array.isArray(s.map) || s.map.length < 2 || !s.map.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) { E(at + '.map', 'needs at least two [points, result] pairs of numbers'); continue; }
    for (let i = 1; i < s.map.length; i++) if (s.map[i][0] < s.map[i - 1][0]) E(at + '.map', 'points must go from smallest to largest');
    if (s.mode != null && !['linear', 'steps'].includes(s.mode)) E(at + '.mode', 'must be "linear" or "steps"');
    if (s.outOf != null && !(s.outOf > 0)) E(at + '.outOf', 'must be a positive number');
    if (s.round != null && !(Number.isInteger(s.round) && s.round >= 0 && s.round <= 4)) E(at + '.round', 'must be 0–4');
    if (s.bands != null && !(Array.isArray(s.bands) && s.bands.every(b => Array.isArray(b) && Number.isFinite(b[0]) && typeof b[1] === 'string'))) E(at + '.bands', 'must be a list of [from, "name"] pairs');
  }
  const scaleOk = (at, id) => { if (id != null && !scales[id]) E(at, `scale "${id}" is not defined in "scales"`); };

  const passages = isObj(m.passages) ? m.passages : {};
  for (const [id, p] of Object.entries(passages)) {
    if (!isObj(p) || typeof p.text !== 'string') E(`passages.${id}`, 'needs a "text"');
    for (const b of arr(p && p.media)) checkBlock(`passages.${id}.media`, b);
  }

  function checkBlock(at, raw) {
    const b = blockOf(raw);
    if (!isObj(b) || !BLOCK_TYPES.includes(b.type)) return E(at, `unknown block; use one of: ${BLOCK_TYPES.join(', ')}`);
    if ((b.type === 'text' || b.type === 'note') && typeof b.text !== 'string') E(at, 'needs "text"');
    if (b.type === 'code') {
      if (typeof b.code !== 'string' || !b.code.trim()) E(at, 'needs "code" (the program text)');
      if (b.file != null && !(typeof b.file === 'string' && /^[\w][\w .-]{0,79}$/.test(b.file))) E(at, '"file" must be a plain file name like "blink.ino"');
    }
    if (b.type === 'note' && b.style != null && !['key', 'tip', 'warn'].includes(b.style)) W(at, `unknown note style "${b.style}"`);
    if (['image', 'audio', 'video'].includes(b.type)) mediaPaths(b).forEach(p => checkMedia(at, p));
  }

  const taskIds = new Map(), refs = [];
  function checkTask(at, t) {
    if (!isObj(t)) return E(at, 'must be an object');
    if (t.ref != null) { refs.push([at, t.ref]); return; }
    if (typeof t.id !== 'string' || !t.id) return E(at, 'needs an "id"');
    at = `${at} (${t.id})`;
    if (taskIds.has(t.id)) E(at, `id "${t.id}" is used twice`); else taskIds.set(t.id, t);
    if (!TASK_TYPES.includes(t.type)) return E(at, `unknown type "${t.type}"; use one of: ${TASK_TYPES.join(', ')}`);
    if (t.points != null && !(t.points > 0)) E(at, '"points" must be a positive number');
    if (t.passage != null && !passages[t.passage]) E(at, `passage "${t.passage}" is not defined`);
    if (t.hint != null && !(typeof t.hint === 'string' || (Array.isArray(t.hint) && t.hint.every(x => typeof x === 'string')))) E(at, '"hint" must be text or a list of hints');
    for (const b of arr(t.media)) checkBlock(at + '.media', b);
    const opts = n => Array.isArray(t.options) && t.options.length >= n && t.options.every(o => typeof o === 'string');
    const idx = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
    const strs = v => (typeof v === 'string' && v.trim()) || (Array.isArray(v) && v.length && v.every(s => typeof s === 'string' && s.trim()));
    switch (t.type) {
      case 'choice':
        if (!opts(2)) E(at, 'needs at least two "options"');
        else if (!idx(t.answer, t.options.length)) E(at, '"answer" must be the number of the right option, counting from 0');
        if (t.why != null && (!Array.isArray(t.why) || t.why.length > (t.options || []).length)) E(at, '"why" must be a list with one entry per option');
        break;
      case 'multi':
        if (!opts(2)) E(at, 'needs at least two "options"');
        else if (!Array.isArray(t.answer) || !t.answer.length || !t.answer.every(a => idx(a, t.options.length)) || new Set(t.answer).size !== t.answer.length) E(at, '"answer" must be a list of option numbers, counting from 0');
        break;
      case 'text': if (!strs(t.answer)) E(at, '"answer" must be text or a list of accepted texts'); break;
      case 'number':
        if (!Number.isFinite(t.answer)) E(at, '"answer" must be a number');
        if (t.tolerance != null && !(t.tolerance >= 0)) E(at, '"tolerance" must be 0 or more');
        if (t.unit != null && !(typeof t.unit === 'string' && t.unit.length <= 12)) E(at, '"unit" must be short text such as "mA" or "Ω"');
        break;
      case 'gaps': {
        if (typeof t.text !== 'string') { E(at, 'needs "text" with blanks written as [[1]], [[2]]…'); break; }
        const nums = [...t.text.matchAll(GAP_RE)].map(x => +x[1]);
        if (!Array.isArray(t.gaps) || !t.gaps.length) { E(at, 'needs "gaps"'); break; }
        if (nums.length !== t.gaps.length || !nums.every((n, i) => n === i + 1)) E(at, `"text" must contain [[1]] … [[${t.gaps.length}]] once each, in order`);
        if (t.bank != null && !(Array.isArray(t.bank) && t.bank.every(w => typeof w === 'string' && w.trim()))) E(at, '"bank" must be a list of extra (wrong) words');
        if (t.bank != null && !t.gaps.some(g => isObj(g) && !g.options)) W(at, '"bank" only applies to typed blanks, and this task has none');
        t.gaps.forEach((g, i) => {
          if (!isObj(g)) return E(`${at}.gaps[${i}]`, 'must be an object');
          if (g.options != null) { if (!Array.isArray(g.options) || g.options.length < 2) E(`${at}.gaps[${i}]`, 'needs at least two options'); else if (!idx(g.answer, g.options.length)) E(`${at}.gaps[${i}]`, '"answer" must be an option number'); }
          else if (!strs(g.answer)) E(`${at}.gaps[${i}]`, 'needs "answer" (text) or "options" + "answer"');
        });
        break;
      }
      case 'order': if (!Array.isArray(t.items) || t.items.length < 2 || !t.items.every(s => typeof s === 'string')) E(at, 'needs at least two "items" in the right order'); break;
      case 'match':
        if (!Array.isArray(t.left) || !Array.isArray(t.right) || t.left.length < 2 || t.left.length !== t.right.length) E(at, '"left" and "right" must be lists of the same length (2 or more)');
        if (t.extra != null && !Array.isArray(t.extra)) E(at, '"extra" must be a list');
        break;
      case 'open':
        if (t.rubric != null) {
          if (!Array.isArray(t.rubric) || !t.rubric.length || !t.rubric.every(r => isObj(r) && typeof r.text === 'string' && r.points > 0)) E(at, '"rubric" must be a list of { "text", "points" }');
          else if (Math.abs(sum(t.rubric.map(r => r.points)) - (t.points ?? 1)) > 1e-9) E(at, `rubric points add up to ${sum(t.rubric.map(r => r.points))}, but the task is worth ${t.points ?? 1}`);
        }
        break;
    }
  }

  const lessonIds = new Set();
  if (m.units != null && !Array.isArray(m.units)) E('units', 'must be a list');
  const unitIds = new Set();
  arr(m.units).forEach((u, ui) => {
    const at = `units[${ui}]`;
    if (!isObj(u) || typeof u.id !== 'string' || typeof u.title !== 'string') return E(at, 'needs "id" and "title"');
    if (unitIds.has(u.id)) E(at, `unit id "${u.id}" is used twice`); unitIds.add(u.id);
    if (!Array.isArray(u.lessons) || !u.lessons.length) W(at, 'has no lessons');
    arr(u.lessons).forEach((l, li) => {
      const la = `${at}.lessons[${li}]`;
      if (!isObj(l) || typeof l.id !== 'string' || typeof l.title !== 'string') return E(la, 'needs "id" and "title"');
      if (lessonIds.has(l.id)) E(la, `lesson id "${l.id}" is used twice`); lessonIds.add(l.id);
      arr(l.content).forEach((b, bi) => checkBlock(`${la}.content[${bi}]`, b));
      if (l.practice != null) {
        if (!isObj(l.practice) || !Array.isArray(l.practice.tasks)) E(la + '.practice', 'needs "tasks"');
        else {
          l.practice.tasks.forEach((t, ti) => checkTask(`${la}.practice.tasks[${ti}]`, t));
          if (l.practice.pass != null && !(l.practice.pass >= 0 && l.practice.pass <= 1)) E(la + '.practice.pass', 'must be between 0 and 1');
          scaleOk(la + '.practice.scale', l.practice.scale);
        }
      }
      if (!arr(l.content).length && !(l.practice && arr(l.practice.tasks).length)) W(la, 'is empty');
    });
  });

  const examIds = new Set();
  if (m.exams != null && !Array.isArray(m.exams)) E('exams', 'must be a list');
  arr(m.exams).forEach((x, xi) => {
    const at = `exams[${xi}]`;
    if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string') return E(at, 'needs "id" and "title"');
    if (examIds.has(x.id)) E(at, `exam id "${x.id}" is used twice`); examIds.add(x.id);
    if (x.minutes != null && !(x.minutes > 0)) E(at + '.minutes', 'must be a positive number');
    scaleOk(at + '.scale', x.scale);
    if (!Array.isArray(x.parts) || !x.parts.length) return E(at, 'needs at least one part in "parts"');
    x.parts.forEach((p, pi) => {
      if (!isObj(p) || !Array.isArray(p.tasks) || !p.tasks.length) return E(`${at}.parts[${pi}]`, 'needs "tasks"');
      if (p.minutes != null && !(p.minutes > 0)) E(`${at}.parts[${pi}].minutes`, 'must be a positive number');
      p.tasks.forEach((t, ti) => checkTask(`${at}.parts[${pi}].tasks[${ti}]`, t));
    });
  });
  for (const [at, id] of refs) if (!taskIds.has(id)) E(at, `refers to task "${id}", which does not exist`);
  if (!arr(m.units).length && !arr(m.exams).length) E('module', 'has no lessons and no exams');
  return { errors, warnings };
}

/* Fill in defaults and build lookup tables. Call only after checkModule found no errors. */
function prepareModule(json) {
  const m = JSON.parse(JSON.stringify(json));
  m.tools = arr(m.tools).filter(t => KNOWN_TOOLS.includes(t));
  m.scales = m.scales || {}; m.passages = m.passages || {}; m.units = arr(m.units); m.exams = arr(m.exams);
  m.color = m.color || '#5B5BD6';
  const tasks = {}, lessons = [], fix = t => { t.points = t.points ?? 1; t.media = arr(t.media).map(blockOf); return t; };
  m.units.forEach((u, ui) => {
    u.lessons = arr(u.lessons);
    u.lessons.forEach(l => {
      l.unit = u.id; l.index = lessons.length; l.content = arr(l.content).map(blockOf);
      l.practice = l.practice ? { pass: 0.6, ...l.practice } : null;
      if (l.practice) l.practice.tasks.forEach(t => { if (!t.ref) tasks[t.id] = fix(t); });
      lessons.push(l);
    });
  });
  m.exams.forEach(x => x.parts.forEach(p => p.tasks.forEach(t => { if (!t.ref) tasks[t.id] = fix(t); })));
  const resolve = list => list.map(t => (t.ref ? tasks[t.ref] : t));
  lessons.forEach(l => { if (l.practice) l.practice.tasks = resolve(l.practice.tasks); });
  m.exams.forEach(x => { x.parts.forEach(p => { p.tasks = resolve(p.tasks); }); x.max = sum(x.parts.flatMap(p => p.tasks.map(t => t.points))); x.count = sum(x.parts.map(p => p.tasks.length)); });
  for (const p of Object.values(m.passages)) p.media = arr(p.media).map(blockOf);
  Object.defineProperty(m, 'taskById', { value: tasks, enumerable: false });
  Object.defineProperty(m, 'lessonList', { value: lessons, enumerable: false });
  return m;
}

/* Every media path a module uses, so the app keeps exactly those files */
function moduleMediaPaths(m) {
  const out = new Set(), add = b => mediaPaths(blockOf(b)).forEach(p => out.add(p));
  if (typeof m.icon === 'string' && /[./]/.test(m.icon)) out.add(m.icon);
  Object.values(m.passages || {}).forEach(p => arr(p.media).forEach(add));
  const tasks = t => arr(t).forEach(x => arr(x.media).forEach(add));
  arr(m.units).forEach(u => arr(u.lessons).forEach(l => { arr(l.content).forEach(add); if (l.practice) tasks(l.practice.tasks); }));
  arr(m.exams).forEach(x => arr(x.parts).forEach(p => tasks(p.tasks)));
  return out;
}
