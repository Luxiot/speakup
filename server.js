import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'SpeakUp API', endpoints: ['/api/check-key', '/api/save-key', '/api/chat'] });
});

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const envPath = path.join(__dirname, '.env');

// Leer API key: primero env vars (Railway), luego .env
function getApiKey() {
  const fromEnv = process.env.XAI_API_KEY || process.env.VITE_XAI_API_KEY;
  if (fromEnv) return fromEnv.trim();
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/VITE_XAI_API_KEY=(.+)/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// Guardar API key en .env
function saveApiKey(apiKey) {
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
      content = content.replace(/VITE_XAI_API_KEY=.*\n?/g, '');
    }
    content += `VITE_XAI_API_KEY=${apiKey}\n`;
    fs.writeFileSync(envPath, content.trim() + '\n');
    return true;
  } catch (e) {
    console.error('Error guardando API key:', e);
    return false;
  }
}

// Verificar si hay API key configurada
app.get('/api/check-key', (req, res) => {
  const key = getApiKey();
  res.json({ hasKey: !!key });
});

// Guardar API key
app.post('/api/save-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, message: 'API key requerida' });
  }
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return res.status(400).json({ success: false, message: 'API key no puede estar vacía' });
  }
  if (saveApiKey(trimmed)) {
    res.json({ success: true, message: 'API key guardada en .env' });
  } else {
    res.status(500).json({ success: false, message: 'Error al guardar' });
  }
});

// Proxy para Grok API (la key se lee del .env)
app.post('/api/chat', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(401).json({ error: { message: 'Configura tu API key primero' } });
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error Grok API:', error);
    res.status(500).json({
      error: { message: 'Error de conexión con Grok. Intenta de nuevo.' },
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Servidor backend en http://localhost:${PORT}`);
  console.log(`  API key guardada en: ${envPath}\n`);
});
