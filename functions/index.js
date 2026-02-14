import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializar Firebase Admin (solo una vez)
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const app = express();
app.use(express.json());

const CONFIG_DOC = 'config';
const CONFIG_COLLECTION = 'app';

// Obtener API key de Firestore
async function getApiKey() {
  try {
    const doc = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
    return doc.exists ? doc.data()?.xaiKey || null : null;
  } catch (e) {
    console.error('Error leyendo API key:', e);
    return null;
  }
}

// Guardar API key en Firestore (para siempre)
async function saveApiKey(apiKey) {
  try {
    await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({ xaiKey: apiKey }, { merge: true });
    return true;
  } catch (e) {
    console.error('Error guardando API key:', e);
    return false;
  }
}

app.get('/api/check-key', async (req, res) => {
  try {
    const key = await getApiKey();
    res.json({ hasKey: !!key });
  } catch (e) {
    res.status(500).json({ hasKey: false });
  }
});

app.post('/api/save-key', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, message: 'API key requerida' });
  }
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return res.status(400).json({ success: false, message: 'API key no puede estar vacía' });
  }
  if (await saveApiKey(trimmed)) {
    res.json({ success: true, message: 'API key guardada. Ya no tendrás que ingresarla de nuevo.' });
  } else {
    res.status(500).json({ success: false, message: 'Error al guardar' });
  }
});

app.post('/api/chat', async (req, res) => {
  const apiKey = await getApiKey();
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

// Cloud Function que maneja /api/*
export const api = onRequest(
  { region: 'us-central1', cors: true },
  app
);
