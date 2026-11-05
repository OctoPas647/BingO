/* ================= Listening parts of past language exams =================
   A listening text is a passage with `listen: true`: its `text` is only the instruction printed on the
   exam sheet, `transcript` is the official text the examiners read out (shown only after the answer),
   and `audio` (optional) is a recording in media/<exam id>/. Without a recording the app speaks the
   transcript: Gemini text-to-speech when Gemini is on, otherwise the browser's own voice. An exam whose
   PDF had no transcript gets one written by Gemini from its questions and official answers, marked so.
   Gemini is reached only through BingO's server (AI_SERVER, POST /tts and /generate); no key is in the app. */

const TTS_CACHE = new Map();     /* passage key -> object URL of the spoken audio, for this session */
const SCRIPT_CACHE = new Map();  /* passage key -> transcript written by Gemini */
/* transcripts are plain text; an escaped \$ from the exam file is read as a dollar sign */
const plainSpoken = t => String(t).replace(/\\\$/g, '$');
const BCP47 = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', ru: 'ru-RU', bg: 'bg-BG' };

/* raw 16-bit mono PCM (what Gemini TTS returns) -> a playable WAV blob */
function pcmToWav(b64, rate = 24000) {
  const pcm = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), buf = new ArrayBuffer(44 + pcm.length), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length, true); new Uint8Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

/* Gemini TTS through BingO's server (server/index.js, POST /tts) */
async function geminiSpeak(text, lang) {
  const say = `Read this ${lang && lang !== 'bg' ? `${lang} ` : ''}exam listening text aloud clearly, at a natural classroom pace:\n\n${text}`;
  const res = await fetch(AI_SERVER + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: say, lang }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.audio) throw new Error(body.error || L('Сървърът върна {n}', { n: res.status }));
  return pcmToWav(body.audio, body.rate || 24000);
}

/* a transcript for a listening text the PDF did not include: written by Gemini so that the official answers hold */
async function geminiScript(m, pid) {
  const k = m.id + '/' + pid; if (SCRIPT_CACHE.has(k)) return SCRIPT_CACHE.get(k);
  const lg = (SUBJECTS[m.past && m.past.subj] || {}).lang || m.lang;
  const tasks = m.exams[0].parts.flatMap(p => p.tasks).filter(t => t.passage === pid);
  const keyed = tasks.map(t => `${t.id}. ${t.prompt || ''}${t.options ? '\n' + t.options.map((o, i) => `${i === t.answer ? '*' : '-'} ${o}`).join('\n') : ''}`).join('\n\n');
  const text = await callAI({
    system: `You write listening texts for a ${lg} language state exam. Write only the text that is read aloud, in ${lg}, natural and at the exam's level.`,
    prompt: `Instructions on the sheet: ${m.passages[pid].text || ''}\n\nWrite the listening text so that every answer marked * below is right and the others are wrong. 120–350 words. No title, no notes.\n\n${keyed}`,
    json: false, temperature: 0.6
  });
  SCRIPT_CACHE.set(k, text.trim()); return text.trim();
}

function browserSpeak(text, lang, onEnd) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = BCP47[lang] || lang; u.rate = 0.95; u.onend = onEnd;
  const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith((lang || '').slice(0, 2)));
  if (v) u.voice = v;
  speechSynthesis.speak(u); return true;
}

/* replace the passage box of a listening task with a player; the transcript stays hidden until the answer */
function listenMount(m, task, root) {
  const pid = task.passage, p = pid && m.passages[pid];
  if (!p || !p.listen) return;
  const box = root.querySelector('.passage'); if (!box) return;
  const k = m.id + '/' + pid, lang = (SUBJECTS[m.past && m.past.subj] || {}).lang || m.lang || 'bg', hasAudio = !!p.audio;
  const card = h(`<div class="card listen" data-listen>
    <div class="listen-head">${icon('play')}<b>${esc(p.title || L('Слушане'))}</b></div>
    ${p.text ? `<div class="muted small rt">${rich(p.text)}</div>` : ''}
    ${hasAudio ? `<div class="task-media">${blocksHTML([{ type: 'audio', src: p.audio }])}</div>`
      : `<button class="btn accent block" data-say>${icon('play')}${L('Пусни текста за слушане')}</button>`}
    <p class="muted small" data-ls></p>
    <details class="transcript" hidden><summary>${L('Текст за слушане')}</summary><div class="rt" data-tx></div></details></div>`);
  box.replaceWith(card);
  if (hasAudio) hydrateMedia(card, m.id);
  const status = card.querySelector('[data-ls]'), tx = card.querySelector('[data-tx]');
  const setStatus = s => { status.textContent = s; };
  const script = async () => (p.transcript ? p.transcript : aiOn() ? geminiScript(m, pid) : null);
  const ttsOn = cloudOn();
  if (!p.transcript && !hasAudio) setStatus(aiOn() ? L('Изпитът няма текст за слушане — Gemini ще напише такъв по официалния ключ.') : L('Изпитът няма текст за слушане, а Gemini не е достъпен, за да създаде такъв.'));
  else if (!hasAudio && !ttsOn) setStatus(L('Без връзка с Gemini текстът се чете с гласа на устройството.'));
  card._script = script;
  const btn = card.querySelector('[data-say]');
  if (btn) btn.onclick = async () => {
    btn.disabled = true;
    try {
      const raw = await script(), text = raw && plainSpoken(raw);
      if (!text) { setStatus(L('Няма текст за слушане.')); return; }
      if (ttsOn) {
        setStatus(L('Gemini подготвя записа…'));
        let url = TTS_CACHE.get(k);
        if (!url) {
          try { url = URL.createObjectURL(await geminiSpeak(text, lang)); TTS_CACHE.set(k, url); }
          catch (e) { url = null; setStatus(L('Gemini не успя ({e}); чете гласът на устройството.', { e: e.message })); }
        }
        if (url) {
          const a = new Audio(url); document.querySelectorAll('audio,video').forEach(o => o.pause());
          a.onended = () => { btn.disabled = false; setStatus(L('Можеш да го пуснеш още веднъж.')); };
          await a.play(); setStatus(p.transcript ? L('Слушай внимателно…') : L('Слушай внимателно… (текстът е създаден от Gemini)'));
          return;
        }
      }
      if (!browserSpeak(text, lang, () => { btn.disabled = false; setStatus(L('Можеш да го пуснеш още веднъж.')); })) setStatus(L('Устройството не може да чете текст на глас.'));
      else setStatus(L('Слушай внимателно…'));
    } catch (e) { setStatus(e.message); btn.disabled = false; }
  };
}

/* after the answer: show the transcript under the player */
async function listenReveal(root) {
  const card = root.querySelector('[data-listen]'); if (!card || !card._script) return;
  try {
    const text = await card._script(); if (!text) return;
    /* a transcript is plain text: a price like $4.99 must not turn into math */
    card.querySelector('[data-tx]').innerHTML = rich(plainSpoken(text).replace(/\$/g, '\\$'));
    card.querySelector('.transcript').hidden = false;
  } catch (e) { /* no transcript to show */ }
}
