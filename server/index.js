/* BingO AI server: a tiny Cloud Run service that calls Gemini for the app.
   The app sends { system, prompt, json, temperature } to POST /generate and gets { text } back.
   Why a server: the Gemini key never reaches a student's phone or the public web page (anything inside an
   APK or a page can be copied), usage and limits are in one place, and the key can be changed without a new app.

   Two ways to reach Gemini, picked automatically:
   - GEMINI_API_KEY set  -> the Gemini API with that key (from Google AI Studio). Keep it in Secret Manager:
       gcloud run deploy bingo-ai --source . --region europe-west1 --allow-unauthenticated \
         --set-secrets GEMINI_API_KEY=gemini-api-key:latest --set-env-vars ALLOWED_ORIGINS=*
   - otherwise           -> Gemini on Vertex AI with the service account's credentials (role "Vertex AI User"):
       gcloud run deploy bingo-ai --source . --region europe-west1 --allow-unauthenticated \
         --set-env-vars GOOGLE_CLOUD_PROJECT=<project>,GOOGLE_CLOUD_LOCATION=global,ALLOWED_ORIGINS=*
   Optional: GEMINI_MODEL (default: the first of ALLOWED_MODELS), DAILY_LIMIT (calls per IP per day, default 400),
   FEEDBACK_SCRIPT_URL (the Apps Script that stores the in-app feedback). */
import http from 'node:http';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.PORT || 8080;
const MODELS = (process.env.ALLOWED_MODELS || 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.6-flash').split(',').map(s => s.trim());
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const FEEDBACK_SCRIPT_URL = process.env.FEEDBACK_SCRIPT_URL || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || MODELS[0];
const TTS_MODEL = process.env.TTS_MODEL || 'gemini-3.1-flash-tts-preview';   /* Gemini text-to-speech, for listening texts */
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || 'global' });

/* small per-IP limits, so a copied server address cannot run up the bill: 30 calls a minute, DAILY_LIMIT a day */
const hits = new Map(), daily = new Map(), DAILY = Number(process.env.DAILY_LIMIT) || 400;
const limited = ip => {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000); list.push(now); hits.set(ip, list);
  const day = new Date().toISOString().slice(0, 10), d = daily.get(ip);
  const n = d && d.day === day ? d.n + 1 : 1; daily.set(ip, { day, n });
  if (hits.size > 50000) hits.clear(); if (daily.size > 50000) daily.clear();
  return list.length > 30 || n > DAILY;
};

function cors(req, res) {
  const o = req.headers.origin || '';
  const allow = ORIGINS.includes('*') ? '*' : ORIGINS.includes(o) ? o : '';
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

async function readJson(req, res, limit = 20000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) { send(res, 413, { error: 'too large' }); return null; }
  }
  try { return JSON.parse(body); }
  catch { send(res, 400, { error: 'bad json' }); return null; }
}

async function forwardFeedback(payload) {
  const res = await fetch(FEEDBACK_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Apps Script returned HTTP ' + res.status);
  const result = await res.json().catch(() => null);
  if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'Apps Script did not confirm the save');
  return result;
}

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/') return send(res, 200, { ok: true, service: 'bingo-ai', model: DEFAULT_MODEL, via: process.env.GEMINI_API_KEY ? 'gemini-api' : 'vertex-ai' });

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
  if (limited(ip)) return send(res, 429, { error: 'Твърде много заявки, опитай след минута' });

  if (req.method === 'POST' && req.url === '/api/feedback') {
    if (!FEEDBACK_SCRIPT_URL) return send(res, 503, { error: 'feedback database is not configured' });
    const q = await readJson(req, res, 20000);
    if (q === null) return;
    if (typeof q.id !== 'string' || !q.id.trim()) return send(res, 400, { error: 'id is missing' });
    if (!Number.isFinite(q.at)) return send(res, 400, { error: 'at is missing' });
    if (!q.data || typeof q.data !== 'object' || Array.isArray(q.data)) return send(res, 400, { error: 'data must be an object' });
    try {
      await forwardFeedback({ id: q.id.trim(), at: q.at, data: q.data });
      return send(res, 200, { ok: true });
    } catch (e) {
      console.error('feedback forward failed', e);
      return send(res, 502, { error: 'feedback database error: ' + (e.message || e) });
    }
  }

  /* text-to-speech for the listening parts of past language exams (66c-listen.js): { text } -> { audio: base64 16-bit PCM, rate } */
  if (req.method === 'POST' && req.url === '/tts') {
    const q = await readJson(req, res, 20000);
    if (q === null) return;
    if (typeof q.text !== 'string' || !q.text.trim()) return send(res, 400, { error: 'text is missing' });
    try {
      const r = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: q.text.slice(0, 12000),
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
      });
      const part = (r.candidates?.[0]?.content?.parts || []).find(x => x.inlineData);
      if (!part) return send(res, 502, { error: 'no audio in the answer' });
      return send(res, 200, { audio: part.inlineData.data, mime: part.inlineData.mimeType || 'audio/pcm', rate: 24000 });
    } catch (e) {
      console.error(e);
      return send(res, 502, { error: 'Gemini TTS error: ' + (e.message || e) });
    }
  }

  if (req.method !== 'POST' || req.url !== '/generate') return send(res, 404, { error: 'not found' });
  const q = await readJson(req, res, 40000);
  if (q === null) return;
  const model = MODELS.includes(q.model) ? q.model : DEFAULT_MODEL;
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) return send(res, 400, { error: 'prompt is missing' });
  try {
    const r = await ai.models.generateContent({
      model,
      contents: q.prompt,
      config: {
        systemInstruction: typeof q.system === 'string' ? q.system.slice(0, 6000) : undefined,
        temperature: Math.min(1, Math.max(0, Number(q.temperature) || 0.4)),
        ...(q.json ? { responseMimeType: 'application/json' } : {})
      }
    });
    send(res, 200, { text: r.text, model });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Gemini/Vertex AI error: ' + (e.message || e) });
  }
}).listen(PORT, () => console.log(`bingo-ai listening on ${PORT}`));
