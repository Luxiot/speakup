import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Necesario para recibir audio en base64 (nota de voz)
app.use(express.json({ limit: '25mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'SpeakUp API', endpoints: ['/api/check-key', '/api/save-key', '/api/chat', '/api/transcribe'] });
});

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const envPath = path.join(__dirname, '.env');

// Prioridad: Groq (gratis, sin restricciones) > Gemini > xAI
function getApiKey() {
  const groq = process.env.GROQ_API_KEY;
  if (groq) return { key: groq.trim(), provider: 'groq' };
  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (gemini) return { key: gemini.trim(), provider: 'gemini' };
  const xai = process.env.XAI_API_KEY || process.env.VITE_XAI_API_KEY;
  if (xai) return { key: xai.trim(), provider: 'xai' };
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const q = content.match(/GROQ_API_KEY=(.+)/);
      if (q) return { key: q[1].trim().replace(/^["']|["']$/g, ''), provider: 'groq' };
      const g = content.match(/GEMINI_API_KEY=(.+)/);
      if (g) return { key: g[1].trim().replace(/^["']|["']$/g, ''), provider: 'gemini' };
      const x = content.match(/VITE_XAI_API_KEY=(.+)/);
      if (x) return { key: x[1].trim().replace(/^["']|["']$/g, ''), provider: 'xai' };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

function saveApiKey(apiKey, provider = 'groq') {
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
      content = content.replace(/GROQ_API_KEY=.*\n?/g, '').replace(/GEMINI_API_KEY=.*\n?/g, '').replace(/VITE_XAI_API_KEY=.*\n?/g, '');
    }
    const varName = provider === 'groq' ? 'GROQ_API_KEY' : provider === 'gemini' ? 'GEMINI_API_KEY' : 'VITE_XAI_API_KEY';
    content += `${varName}=${apiKey}\n`;
    fs.writeFileSync(envPath, content.trim() + '\n');
    return true;
  } catch (e) {
    console.error('Error guardando API key:', e);
    return false;
  }
}

// Verificar si hay API key configurada
app.get('/api/check-key', (req, res) => {
  const api = getApiKey();
  res.json({ hasKey: !!api, provider: api?.provider });
});

// Guardar API key (provider: 'groq' | 'gemini' | 'xai')
app.post('/api/save-key', (req, res) => {
  const { apiKey, provider = 'gemini' } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, message: 'API key requerida' });
  }
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return res.status(400).json({ success: false, message: 'API key no puede estar vacía' });
  }
  if (saveApiKey(trimmed, provider)) {
    res.json({ success: true, message: 'API key guardada', provider });
  } else {
    res.status(500).json({ success: false, message: 'Error al guardar' });
  }
});

// Proxy para Gemini (gratis) o Grok API
app.post('/api/chat', async (req, res) => {
  const api = getApiKey();
  if (!api) {
    return res.status(401).json({ error: { message: 'Configura tu API key primero' } });
  }

  const { key, provider } = api;
  let url, headers, body;

  if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
    const { messages, max_tokens } = req.body;
    body = { model: 'llama-3.3-70b-versatile', messages, max_tokens: max_tokens || 1000 };
  } else if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${key}`;
    headers = { 'Content-Type': 'application/json' };
    const { messages, max_tokens } = req.body;
    body = { model: 'gemini-1.5-flash', messages, max_tokens: max_tokens || 1000 };
  } else {
    url = 'https://api.x.ai/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
    body = req.body;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`${provider} API error:`, response.status, data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error(`Error ${provider} API:`, error);
    res.status(500).json({
      error: { message: 'Error de conexión. Intenta de nuevo.' },
    });
  }
});

// Transcribir audio (nota de voz) usando Groq Whisper
app.post('/api/transcribe', async (req, res) => {
  const api = getApiKey();
  if (!api) {
    return res.status(401).json({ error: { message: 'Configura tu API key primero' } });
  }

  const { provider, key } = api;
  if (provider !== 'groq') {
    return res.status(400).json({ error: { message: 'La transcripción de voz requiere GROQ_API_KEY (Whisper).' } });
  }

  const { audioBase64, mimeType } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: { message: 'audioBase64 requerido' } });
  }

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const rawType = (typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm').trim();
    const type = rawType.split(';')[0].trim() || 'audio/webm';
    // FormData nativo (Node 18+) + Blob: mismo formato que el navegador
    const form = new FormData();
    form.append('file', new Blob([buffer], { type }), 'audio.webm');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('language', 'en');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: form,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      const raw = await response.text().catch(() => '');
      console.error('groq transcribe parse error:', response.status, raw?.slice(0, 300));
      return res.status(response.status).json({ error: { message: raw || `Error ${response.status}` }, text: '' });
    }
    if (!response.ok) {
      console.error('groq transcribe error:', response.status, data);
      const errMsg = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : '') || JSON.stringify(data);
      return res.status(response.status).json({ error: { message: errMsg }, text: '' });
    }

    return res.json({ text: data.text || '' });
  } catch (e) {
    console.error('transcribe error:', e);
    return res.status(500).json({ error: { message: e.message || 'Error transcribiendo audio' } });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Servidor backend en http://localhost:${PORT}`);
  console.log(`  API key guardada en: ${envPath}\n`);
});
