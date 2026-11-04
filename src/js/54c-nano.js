/* ================= Gemini Nano: Google's on-device model =================
   - Android: ML Kit GenAI Prompt API on top of AICore (platforms/android/.../NanoBridge.kt), exposed to the page
     as window.AndroidNano. Only phones with Gemini Nano have it (e.g. Xiaomi 17 Ultra, Pixel 9/10, Galaxy S25);
     on the others status() says "unavailable" and BingO quietly uses the cloud only.
   - Web: Chrome's built-in Prompt API (window.LanguageModel), where Chrome ships Gemini Nano.
   Nano is used where speed or being offline matters: the first hint, a quick provisional verdict on an open
   answer, a second check of Gemini's new questions and everything when the cloud cannot be reached. */

const NANO = { status: 'unknown', where: null, session: null, progress: 0 };
const nanoReady = () => S.settings.nano !== false && NANO.status === 'available';

async function nanoInit() {
  try {
    if (window.AndroidNano && typeof window.AndroidNano.status === 'function') {
      NANO.where = 'android'; NANO.status = String(window.AndroidNano.status() || 'unavailable');
    } else if (window.LanguageModel && typeof window.LanguageModel.availability === 'function') {
      NANO.where = 'chrome'; NANO.status = await window.LanguageModel.availability(NANO_OPTS());
    } else NANO.status = 'unavailable';
  } catch (e) { console.warn('Gemini Nano', e); NANO.status = 'unavailable'; }
  document.dispatchEvent(new CustomEvent('nano-status'));
  return NANO.status;
}
const NANO_OPTS = () => ({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
/* Android reports progress and the end of a download here */
window.__nanoStatus = (status, progress) => { NANO.status = status; NANO.progress = progress || 0; document.dispatchEvent(new CustomEvent('nano-status')); };

/* downloading the model needs a tap (Chrome asks for a user gesture); the setting shows the progress */
async function nanoDownload() {
  if (NANO.where === 'android') { window.AndroidNano.download(); return; }
  if (NANO.where !== 'chrome') return;
  NANO.status = 'downloading'; document.dispatchEvent(new CustomEvent('nano-status'));
  try {
    NANO.session = await window.LanguageModel.create({
      ...NANO_OPTS(),
      monitor(m) { m.addEventListener('downloadprogress', e => { NANO.progress = e.loaded; document.dispatchEvent(new CustomEvent('nano-status')); }); }
    });
    NANO.status = 'available';
  } catch (e) { console.warn('Gemini Nano download', e); NANO.status = 'unavailable'; }
  document.dispatchEvent(new CustomEvent('nano-status'));
}

let nanoSeq = 0; const nanoWait = {};
window.__nanoDone = (id, ok, text) => { const w = nanoWait[id]; if (!w) return; delete nanoWait[id]; ok ? w.resolve(text) : w.reject(new Error(text || 'Gemini Nano')); };

async function nanoPrompt(system, prompt, { json = false, temperature = 0.4 } = {}) {
  if (!nanoReady()) throw new Error('Gemini Nano is not available');
  const full = prompt + (json ? '\n\nОтговори САМО с валиден JSON, без друг текст.' : '');
  if (NANO.where === 'android') {
    const id = 'n' + (++nanoSeq);
    return new Promise((resolve, reject) => {
      nanoWait[id] = { resolve, reject };
      setTimeout(() => { if (nanoWait[id]) { delete nanoWait[id]; reject(new Error('Gemini Nano timeout')); } }, 25000);
      window.AndroidNano.prompt(id, system || '', full, temperature);
    });
  }
  /* Chrome: a fresh session per question keeps answers independent; the system text goes first */
  const s = await window.LanguageModel.create({ ...NANO_OPTS(), initialPrompts: system ? [{ role: 'system', content: system }] : [] });
  try { return await s.prompt(full); } finally { try { s.destroy(); } catch (e) { } }
}

/* Does Nano, on its own, pick the same answer as the key? true / false, or null when it cannot tell */
async function nanoSolves(subj, task) {
  if (!nanoReady() || task.type !== 'choice') return null;
  const letters = 'ABCD';
  const text = `${task.prompt}\n${task.options.map((o, i) => `${letters[i]}) ${o}`).join('\n')}\nWhich option is correct? Answer with JSON {"answer": "A"|"B"|"C"|"D"}.`;
  const j = parseJSON(await nanoPrompt('You check exam questions. Reply only with JSON.', text, { json: true, temperature: 0 }));
  const i = letters.indexOf(String(j && j.answer || '').trim().toUpperCase()[0]);
  return i < 0 ? null : i === task.answer;
}

/* A first, instant verdict on an open answer while Gemini checks it properly (54b-ai-grade.js) */
async function nanoPreGrade(task, studentText) {
  if (!nanoReady()) return null;
  const j = parseJSON(await nanoPrompt('Ти проверяваш отговори на ученици спрямо официален отговор. Връщаш само JSON.',
    `Задача: ${String(task.prompt).slice(0, 1200)}\nОфициален отговор: ${String(task.answer || task.explain || '').slice(0, 1200)}\nОтговор на ученика: ${String(studentText).slice(0, 1200)}\nДоколко отговорът съвпада по смисъл с официалния, от 0 до 1? Върни {"score": число}.`, { json: true, temperature: 0 }));
  const s = Number(j && j.score); return Number.isFinite(s) ? clamp(s, 0, 1) : null;
}
