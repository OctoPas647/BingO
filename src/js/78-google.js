/* ================= BingO for teachers: Google Classroom, Forms, Drive and Calendar =================
   Called straight from the app with the teacher's own Google account (an access token from the Google sign-in),
   so nothing of the teacher's Google data passes through BingO's server.
   - Classroom: bring in classes with their students; post a BingO assignment to a Classroom class
   - Forms: turn a Google Forms quiz (with its answer key) into a BingO test
   - Drive: make a test from a Google Doc; save a gradebook or results as a Google Sheet
   - Calendar: a test or homework as an event with the students invited (Google reminds them) */

const SC = {
  courses: 'classroom.courses.readonly', rosters: 'classroom.rosters.readonly', emails: 'classroom.profile.emails', coursework: 'classroom.coursework.students',
  forms: 'forms.body.readonly', driveRead: 'drive.readonly', driveFile: 'drive.file', calendar: 'calendar.events'
};

/* ---------- Classroom ---------- */
async function classroomCourses() {
  const j = await gapi('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&pageSize=100', { scopes: [SC.courses] });
  return j.courses || [];
}
async function classroomStudents(courseId) {
  const out = []; let page = '';
  do {
    const j = await gapi(`https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=100${page ? '&pageToken=' + page : ''}`, { scopes: [SC.rosters, SC.emails] });
    (j.students || []).forEach(s => out.push({ name: s.profile && s.profile.name ? s.profile.name.fullName : '', email: s.profile && s.profile.emailAddress ? s.profile.emailAddress.toLowerCase() : '' }));
    page = j.nextPageToken || '';
  } while (page);
  return out.filter(s => s.email);
}
async function classroomImportSheet() {
  let courses;
  try { courses = await classroomCourses(); } catch (e) { return failToast(e); }
  if (!courses.length) return toast(L('В Google Classroom няма активни класове'));
  const pick = await sheet({ title: L('Внеси от Google Classroom'), body: `<div class="seg list">${courses.map(c => `<button data-act="${esc(c.id)}">${esc(c.name)}${c.section ? ' · ' + esc(c.section) : ''}</button>`).join('')}</div>`, actions: [{ id: 'no', label: L('Отказ') }] });
  const course = courses.find(c => c.id === pick); if (!course) return;
  try {
    const r = await callFn('createClass', { name: course.name.slice(0, 40), subject: course.section || '', classroomId: course.id });
    const students = await classroomStudents(course.id);
    if (students.length) await callFn('inviteStudents', { classId: r.classId, students });
    toast(L('Внесен клас „{c}“ с {n} ученици', { c: course.name, n: students.length }));
    go('tClass', { cid: r.classId });
  } catch (e) { failToast(e); }
}
async function classroomPostAssignment(aid) {
  const a = (await docRef('assignments/' + aid).get()).data(); const c = (await docRef('classes/' + a.classId).get()).data();
  if (!c.classroomId) return;
  const due = tsMs(a.closesAt), d = due ? new Date(due) : null;
  await gapi(`https://classroom.googleapis.com/v1/courses/${c.classroomId}/courseWork`, { method: 'POST', scopes: [SC.coursework], body: {
    title: a.title, description: L('Отворете в BingO → Клас.') + (a.description ? '\n\n' + a.description : ''), workType: 'ASSIGNMENT', state: 'PUBLISHED', maxPoints: a.maxPoints || undefined,
    materials: [{ link: { url: JOIN_BASE() } }],
    ...(d ? { dueDate: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }, dueTime: { hours: d.getUTCHours(), minutes: d.getUTCMinutes() } } : {})
  } });
}

/* ---------- Google Forms -> a BingO test ---------- */
const formIdOf = url => (String(url).match(/\/forms\/d\/(?:e\/)?([A-Za-z0-9_-]{20,})/) || String(url).match(/^([A-Za-z0-9_-]{20,})$/) || [])[1];
function formToTasks(form) {
  const tasks = [];
  for (const it of form.items || []) {
    const q = it.questionItem && it.questionItem.question; if (!q) continue;
    const g = q.grading || {}, pts = g.pointValue || 1, right = ((g.correctAnswers || {}).answers || []).map(x => x.value);
    const prompt = [it.title, it.description].filter(Boolean).join('\n\n');
    const base = { id: newTaskId(), prompt, points: pts, explain: g.whenRight && g.whenRight.text ? g.whenRight.text : '' };
    if (q.choiceQuestion) {
      const opts = (q.choiceQuestion.options || []).map(o => o.value).filter(v => v != null);
      const ans = opts.map((o, i) => (right.includes(o) ? i : -1)).filter(i => i >= 0);
      if (q.choiceQuestion.type === 'CHECKBOX') tasks.push({ ...base, type: 'multi', options: opts, answer: ans });
      else tasks.push({ ...base, type: 'choice', options: opts, answer: ans.length ? ans[0] : 0 });
    } else if (q.textQuestion) {
      if (right.length && right.every(v => isFinite(parseNumber(v)))) tasks.push({ ...base, type: 'number', answer: parseNumber(right[0]), tolerance: 0 });
      else if (right.length) tasks.push({ ...base, type: 'text', answer: right });
      else tasks.push({ ...base, type: 'open', rubric: [{ text: L('Пълен и верен отговор'), points: pts }], aiCriteria: '' });
    } else if (q.scaleQuestion || q.dateQuestion || q.timeQuestion || q.fileUploadQuestion) continue;
  }
  return tasks;
}
function formsImportSheet(addTasks, setTitle) {
  sheet({ title: L('Внеси от Google Forms'), body: `<p class="muted small">${L('Поставете връзката към формуляра (редакторската, от адресната лента). Верните отговори се взимат от „Тест“ настройките на формуляра.')}</p><input class="field" data-url placeholder="https://docs.google.com/forms/d/…/edit">`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Внеси'), kind: 'primary' }],
    onMount: (sh, o) => { const ok = sh.querySelector('[data-act="ok"]'); ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => {
      const id = formIdOf(sh.querySelector('[data-url]').value.trim()); if (!id) throw new Error(L('Това не е връзка към Google Forms'));
      const form = await gapi(`https://forms.googleapis.com/v1/forms/${id}`, { scopes: [SC.forms] });
      const tasks = formToTasks(form); if (!tasks.length) throw new Error(L('Във формуляра няма въпроси, които BingO може да внесе'));
      setTitle && setTitle((form.info && (form.info.title || form.info.documentTitle)) || '');
      addTasks(tasks); o.close('ok');
    }); }, true); } });
}

/* ---------- Drive ---------- */
const docIdOf = url => (String(url).match(/\/d\/([A-Za-z0-9_-]{20,})/) || String(url).match(/^([A-Za-z0-9_-]{20,})$/) || [])[1];
async function driveDocText(url) {
  const id = docIdOf(url); if (!id) throw new Error(L('Това не е връзка към Google документ'));
  const meta = await gapi(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType&supportsAllDrives=true`, { scopes: [SC.driveRead] });
  const res = meta.mimeType === 'application/vnd.google-apps.document' || meta.mimeType === 'application/vnd.google-apps.presentation'
    ? await gapi(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`, { scopes: [SC.driveRead], raw: true })
    : null;
  if (!res) throw new Error(L('Поддържат се Google Docs и Slides. За PDF използвайте „От PDF, снимка или текст“.'));
  return { name: meta.name, text: (await res.text()).slice(0, 60000) };
}
function gdocTestSheet(T, addTasks) {
  sheet({ title: L('Тест от Google Doc'), wide: true, body: `<input class="field" data-url placeholder="https://docs.google.com/document/d/…">${genOptsHTML(T)}`,
    actions: [{ id: 'no', label: L('Отказ') }, { id: 'ok', label: L('Създай'), kind: 'primary', icon: 'sparkle' }],
    onMount: (sh, o) => { const ok = sh.querySelector('[data-act="ok"]'); ok.addEventListener('click', ev => { ev.stopPropagation(); busy(ok, async () => {
      const d = await driveDocText(sh.querySelector('[data-url]').value.trim());
      const r = await callFn('teacherAI', { action: 'fromText', text: d.text, ...genVals(sh) }, { timeout: 280000 });
      if (!T.title) T.title = d.name; addTasks(r.tasks); o.close('ok');
    }); }, true); } });
}
/* a CSV uploaded and converted to a Google Sheet in the teacher's Drive */
async function driveUploadSheet(name, csv) {
  const boundary = 'bingo' + Date.now();
  const meta = { name, mimeType: 'application/vnd.google-apps.spreadsheet' };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${boundary}--`;
  return gapi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', { method: 'POST', scopes: [SC.driveFile], body, headers: { 'Content-Type': 'multipart/related; boundary=' + boundary } });
}

/* ---------- Calendar ---------- */
async function calendarForAssignment(aid) {
  const a = (await docRef('assignments/' + aid).get()).data();
  const members = docs(await col(`classes/${a.classId}/members`).get());
  const start = tsMs(a.opensAt) || Date.now(), end = tsMs(a.closesAt) || start + (a.timeLimitMin || 60) * 60000;
  const isShort = end - start <= 6 * 3600000;
  const ev = await gapi('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', { method: 'POST', scopes: [SC.calendar], body: {
    summary: `${L(KIND_LABEL[a.kind])}: ${a.title} (${a.className || ''})`,
    description: `${a.description || ''}\n\n${L('Отворете в BingO → Клас.')} ${JOIN_BASE()}`.trim(),
    start: isShort ? { dateTime: new Date(start).toISOString() } : { dateTime: new Date(end - 30 * 60000).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
    attendees: members.filter(m => m.email).map(m => ({ email: m.email })),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }] }
  } });
  return ev;
}
async function calendarForSchedule(sch, className) {
  const days = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' };
  const now = new Date(), [hh, mm] = (sch.time || '08:00').split(':').map(Number);
  const first = new Date(now); first.setHours(hh, mm, 0, 0);
  while (!sch.days.includes(((first.getDay() + 6) % 7) + 1) || first < now) first.setDate(first.getDate() + 1);
  return gapi('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', scopes: [SC.calendar], body: {
    summary: `BingO: ${sch.title} (${className || ''})`, start: { dateTime: first.toISOString(), timeZone: sch.tz || 'Europe/Sofia' }, end: { dateTime: new Date(first.getTime() + 30 * 60000).toISOString(), timeZone: sch.tz || 'Europe/Sofia' },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${sch.days.map(d => days[d]).join(',')}`]
  } });
}
