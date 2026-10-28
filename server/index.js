/* BingO AI server: a tiny Cloud Run service that calls Gemini on Vertex AI.
   The app sends { model, system, prompt, json, temperature } to POST /generate and gets { text } back.
   Why a server: the API key / Google Cloud credentials never reach a student's phone, usage is paid
   from the team's Google Cloud credits, and limits can be set in one place.

   Deploy (from this folder):
     gcloud run deploy bingo-ai --source . --region europe-west1 --allow-unauthenticated \
       --set-env-vars GOOGLE_CLOUD_PROJECT=<your-project>,GOOGLE_CLOUD_LOCATION=global,ALLOWED_ORIGINS=*\
       ,FEEDBACK_SCRIPT_URL=<apps-script-web-app-url>
   On Cloud Run the service account's credentials are used automatically (give it the "Vertex AI User" role). */
import http from 'node:http';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.PORT || 8080;
const MODELS = (process.env.ALLOWED_MODELS || 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.6-flash').split(',').map(s => s.trim());
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const FEEDBACK_SCRIPT_URL = process.env.FEEDBACK_SCRIPT_URL || '';
const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || 'global' });

/* a very small per-IP limit, enough for a prototype: 30 calls a minute */
const hits = new Map();
const limited = ip => { const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000); list.push(now); hits.set(ip, list); return list.length > 30; };

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
  if (req.method === 'GET' && req.url === '/') return send(res, 200, { ok: true, service: 'bingo-ai', models: MODELS });

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

  if (req.method !== 'POST' || req.url !== '/generate') return send(res, 404, { error: 'not found' });
  const q = await readJson(req, res, 20000);
  if (q === null) return;
  const model = MODELS.includes(q.model) ? q.model : MODELS[0];
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) return send(res, 400, { error: 'prompt is missing' });
  try {
    const r = await ai.models.generateContent({
      model,
      contents: q.prompt,
      config: {
        systemInstruction: typeof q.system === 'string' ? q.system.slice(0, 4000) : undefined,
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
