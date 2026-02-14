import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, Loader2, Sparkles, Key, Settings2, User, UserCircle } from 'lucide-react';

// Voces conocidas por género (Windows, Mac, Chrome)
const FEMALE_VOICES = ['zira', 'aria', 'samantha', 'karen', 'victoria', 'fiona', 'tessa', 'moira', 'kate', 'susan'];
const MALE_VOICES = ['david', 'mark', 'alex', 'daniel', 'fred', 'oliver', 'george', 'russell'];

function getVoiceForGender(gender, preferredName, excludeName) {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (preferredName) {
    const byName = voices.find(v => v.name === preferredName);
    if (byName) return byName;
  }
  const target = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
  const isEn = (v) => (v.lang || '').toLowerCase().startsWith('en');
  const matchesTarget = (v) => isEn(v) && target.some(t => v.name.toLowerCase().includes(t));

  let found = voices.find(matchesTarget);
  if (found && excludeName && found.name === excludeName) {
    found = voices.find(v => matchesTarget(v) && v.name !== excludeName);
  }
  if (found) return found;

  const anyEn = voices.find(v => isEn(v) && (!excludeName || v.name !== excludeName));
  return anyEn || voices[0];
}

export default function EnglishConversationApp() {
  const [hasApiKey, setHasApiKey] = useState(null);
  const [useBackend, setUseBackend] = useState(null);
  const DEFAULT_BACKEND = 'https://speakup-bf52.onrender.com';
  const [apiBase, setApiBase] = useState(() => 
    import.meta.env.VITE_API_URL || localStorage.getItem('english-conv-api-url') || DEFAULT_BACKEND
  );
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  const [voiceGender, setVoiceGender] = useState(() => 
    localStorage.getItem('english-conv-voice') || 'female'
  );
  const [femaleVoiceName, setFemaleVoiceName] = useState(() =>
    localStorage.getItem('english-conv-voice-female-name') || ''
  );
  const [maleVoiceName, setMaleVoiceName] = useState(() =>
    localStorage.getItem('english-conv-voice-male-name') || ''
  );
  const [availableVoices, setAvailableVoices] = useState([]);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 'm0',
      role: 'assistant',
      kind: 'text',
      content: "Hi! I'm here to help you practice your English conversation skills. What would you like to talk about today? We can discuss hobbies, travel, work, daily life, or anything else you're interested in!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);
  const committedTranscriptRef = useRef('');
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const pendingVoiceNoteTextRef = useRef('');
  const messagesRef = useRef(messages);
  const messagesEndRef = useRef(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef(null);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('english-conv-auto-speak') !== 'false');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (apiBase && !localStorage.getItem('english-conv-api-url')) {
      localStorage.setItem('english-conv-api-url', apiBase);
    }
  }, [apiBase]);

  // Limpiar reconocimiento al desmontar
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  // Cargar voces del navegador (necesario en Chrome)
  useEffect(() => {
    if (window.speechSynthesis) {
      const load = () => {
        const all = window.speechSynthesis.getVoices() || [];
        const en = all.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
        setAvailableVoices(en.length ? en : all);
        // Auto-selección si no hay nombres guardados
        if (!femaleVoiceName && all.length) {
          const v = getVoiceForGender('female', '', '');
          if (v?.name) {
            setFemaleVoiceName(v.name);
            localStorage.setItem('english-conv-voice-female-name', v.name);
          }
        }
        if (!maleVoiceName && all.length) {
          const v = getVoiceForGender('male', '', femaleVoiceName);
          if (v?.name) {
            setMaleVoiceName(v.name);
            localStorage.setItem('english-conv-voice-male-name', v.name);
          }
        }
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const handleVoiceChange = (gender) => {
    setVoiceGender(gender);
    localStorage.setItem('english-conv-voice', gender);
    if (availableVoices.length > 1) {
      if (gender === 'male') {
        const pick = getVoiceForGender('male', maleVoiceName, femaleVoiceName);
        if (pick?.name && pick.name !== maleVoiceName) {
          setMaleVoiceName(pick.name);
          localStorage.setItem('english-conv-voice-male-name', pick.name);
        }
      } else {
        const pick = getVoiceForGender('female', femaleVoiceName, maleVoiceName);
        if (pick?.name && pick.name !== femaleVoiceName) {
          setFemaleVoiceName(pick.name);
          localStorage.setItem('english-conv-voice-female-name', pick.name);
        }
      }
    }
    setShowVoiceMenu(false);
  };

  const recheckBackend = () => {
    const base = (apiBase || '').trim() || DEFAULT_BACKEND;
    const checkUrl = `${base.replace(/\/$/, '')}/api/check-key`;
    fetch(checkUrl)
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasKey || !!localStorage.getItem('english-conv-xai-key'));
        setUseBackend(!!data.hasKey);
      })
      .catch(() => {
        setUseBackend(false);
      });
  };

  useEffect(() => {
    const localKey = localStorage.getItem('english-conv-xai-key');
    const base = (apiBase || '').trim() || DEFAULT_BACKEND;
    const checkUrl = `${base.replace(/\/$/, '')}/api/check-key`;
    
    fetch(checkUrl)
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasKey || !!localKey);
        setUseBackend(!!data.hasKey);
      })
      .catch(() => {
        setHasApiKey(!!localKey);
        setUseBackend(false);
      });
  }, [apiBase]);

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim() || savingKey) return;
    setSavingKey(true);
    setKeyError('');
    const key = apiKeyInput.trim();
    try {
      const base = (apiBase || '').trim() || DEFAULT_BACKEND;
      const saveUrl = `${base.replace(/\/$/, '')}/api/save-key`;
      const provider = key.startsWith('gsk_') ? 'groq' : key.startsWith('AIza') ? 'gemini' : 'groq';
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, provider }),
      });
      const data = await res.json();
      if (data.success) {
        setHasApiKey(true);
        setUseBackend(true);
        setApiKeyInput('');
      } else {
        throw new Error(data.message || 'Error');
      }
    } catch (err) {
      localStorage.setItem('english-conv-xai-key', key);
      setHasApiKey(true);
      setUseBackend(false);
      setApiKeyInput('');
    } finally {
      setSavingKey(false);
    }
  };

  const handleSend = () => {
    sendUserMessage(input);
  };

  const handleSpeak = (text) => {
    if (!('speechSynthesis' in window)) return;
    // Limpiar markdown: **text**, # headers, saltos de línea
    const cleanText = (text || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.(); // Chrome: reanudar si estaba pausado
    // Forzar carga de voces (Chrome las carga tras interacción)
    window.speechSynthesis.getVoices();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = voiceGender === 'male' ? 0.9 : 1;
    utterance.volume = 1;
    const preferredName = voiceGender === 'male' ? maleVoiceName : femaleVoiceName;
    const excludeName = voiceGender === 'male' ? femaleVoiceName : maleVoiceName;
    const voice = getVoiceForGender(voiceGender, preferredName, excludeName);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      setIsSpeaking(false);
      setVoiceError('No se pudo reproducir. Usa Chrome o Edge y verifica el volumen.');
      setTimeout(() => setVoiceError(''), 4000);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setIsSpeaking(false);
      setVoiceError('Tu navegador no soporta lectura en voz alta. Usa Chrome o Edge.');
      setTimeout(() => setVoiceError(''), 4000);
    }
  };

  const startVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setVoiceError('Tu navegador no soporta voz. Usa Chrome o Edge.');
      setTimeout(() => setVoiceError(''), 4000);
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      return;
    }

    setVoiceError('');
    pendingVoiceNoteTextRef.current = '';

    // Iniciar grabación de audio (nota de voz estilo WhatsApp)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // parar tracks
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        // Mensaje tipo WhatsApp: audio + (transcribiendo...)
        const audioId = `a-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setMessages(prev => [...prev, { id: audioId, role: 'user', kind: 'audio', audioUrl, content: 'Transcribing…' }]);
        // Transcribir en backend (IA “escucha” tu voz)
        transcribeAndSend(blob, recorder.mimeType || 'audio/webm', audioId);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch (e) {
      setVoiceError('No pude acceder al micrófono para grabar audio. Revisa permisos.');
      setTimeout(() => setVoiceError(''), 5000);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      committedTranscriptRef.current = '';
    };
    recognition.onend = () => {
      setIsListening(false);
      setIsRecordingAudio(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      // capturar el texto final para la nota de voz
      pendingVoiceNoteTextRef.current = (committedTranscriptRef.current || '').trim();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) {
          const committed = committedTranscriptRef.current.trim();
          const lowerCommitted = committed.toLowerCase();
          const lowerText = text.toLowerCase();
          // Evitar duplicados: no agregar si ya está al final o es repetición
          const yaAlFinal = lowerCommitted.endsWith(lowerText) || lowerCommitted === lowerText;
          const esRepeticionPalabra = committed && lowerText.split(/\s+/).length === 1 &&
            lowerCommitted.split(/\s+/).pop() === lowerText;
          if (!yaAlFinal && !esRepeticionPalabra) {
            committedTranscriptRef.current = committed ? `${committed} ${text}` : text;
          }
        } else {
          // Interim: reemplazar (no acumular) y descartar si repite lo ya confirmado
          const committed = committedTranscriptRef.current.trim();
          if (!committed.toLowerCase().endsWith(text.toLowerCase())) {
            interim = text;
          }
        }
      }
      const full = committedTranscriptRef.current.trim() + (interim ? ' ' + interim : '');
      setInput(full.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      const messages = {
        'no-speech': 'No se detectó voz. Habla más cerca del micrófono.',
        'audio-capture': 'No hay acceso al micrófono. Revisa los permisos.',
        'not-allowed': 'Permiso de micrófono denegado. Actívalo en el navegador.',
        'network': 'Error de red. Verifica tu conexión.',
        'language-not-supported': 'Inglés (en-US) no está disponible.',
      };
      const msg = messages[event.error] || 'Error de reconocimiento. Intenta de nuevo.';
      setVoiceError(msg);
      setTimeout(() => setVoiceError(''), 5000);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result;
      const base64 = typeof res === 'string' ? res.split(',')[1] : '';
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const transcribeAndSend = async (blob, mimeType, audioMessageId) => {
    try {
      const base = (apiBase || '').trim() || DEFAULT_BACKEND;
      const url = `${base.replace(/\/$/, '')}/api/transcribe`;
      const audioBase64 = await blobToBase64(blob);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
        signal: controller.signal,
      });
      clearTimeout(t);
      let data = null;
      try {
        data = await res.json();
      } catch {
        const raw = await res.text().catch(() => '');
        throw new Error(raw ? raw.slice(0, 200) : `Respuesta inválida (HTTP ${res.status})`);
      }
      const errMsg = (data?.error?.message ?? data?.message ?? (typeof data?.error === 'string' ? data.error : '')).trim();
      if (!res.ok) throw new Error(errMsg || `Error ${res.status}`);
      const text = (data.text || '').trim();
      if (!text) throw new Error(errMsg || 'No se pudo transcribir');

      // Actualizar el bubble del audio con la transcripción
      setMessages(prev => prev.map(m => m.id === audioMessageId ? { ...m, content: text } : m));

      // Enviar a la IA sin duplicar el mensaje del usuario (ya está en el chat)
      await sendUserMessage(text, { skipAppend: true });
    } catch (e) {
      const reason = e?.name === 'AbortError' ? 'Timeout transcribiendo (backend tardó demasiado)' : (e.message || String(e));
      setMessages(prev => prev.map(m => m.id === audioMessageId ? { ...m, content: `Transcription failed: ${reason}` } : m));
    }
  };

  const sendUserMessage = async (userText, uiMessageOverride) => {
    const options = uiMessageOverride && typeof uiMessageOverride === 'object' && !Array.isArray(uiMessageOverride) ? uiMessageOverride : null;
    const skipAppend = !!options?.skipAppend;
    const uiOverride = options?.uiMessageOverride;

    if (!userText?.trim()) return;
    if (isLoading) {
      console.warn('sendUserMessage: ya hay una solicitud en curso');
      return;
    }
    const userMessage = userText.trim();
    setInput('');

    const uiMsg = uiOverride || { id: `u-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'user', content: userMessage, kind: 'text' };
    let msgs = messagesRef.current.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
    if (skipAppend) {
      const lastUserIdx = [...msgs].reverse().findIndex(m => m.role === 'user');
      if (lastUserIdx !== -1) {
        const idx = msgs.length - 1 - lastUserIdx;
        msgs[idx] = { role: 'user', content: userMessage };
      } else {
        msgs.push({ role: 'user', content: userMessage });
      }
    } else {
      msgs.push({ role: 'user', content: userMessage });
    }
    const historyForApi = [
      { role: 'system', content: "You are a friendly, patient English conversation partner helping someone practice their English. Have natural, engaging conversations on any topic they choose. Speak fluently and naturally, like a native speaker would. Keep your responses conversational (2-4 sentences typically) unless the topic requires more detail. Occasionally ask follow-up questions to keep the conversation flowing. Don't correct grammar unless it causes confusion - focus on natural conversation. Be encouraging and supportive." },
      ...msgs
    ];

    if (!skipAppend) setMessages(prev => [...prev, uiMsg]);
    setIsLoading(true);

    try {
      if (!useBackend) {
        const backendMsg = `⚠️ **Se necesita un backend** (la API no permite llamadas directas desde el navegador).

**La forma más rápida – Groq (gratis, sin restricciones):**
1. https://console.groq.com/keys – crea una API key (gratis, sin tarjeta)
2. Render → tu servicio → Environment → añade \`GROQ_API_KEY\` = tu clave
3. Redeploy → **Ajustes** → **Revisar conexión**

**Alternativa – Gemini:** \`GEMINI_API_KEY\` en Render (aistudio.google.com/apikey)`;
        setMessages(prev => [...prev, { role: 'assistant', content: backendMsg, kind: 'text' }]);
        return;
      }

      const base = (apiBase || '').trim() || DEFAULT_BACKEND;
      const chatUrl = `${base.replace(/\/$/, '')}/api/chat`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'grok-3-mini', max_tokens: 1000, messages: historyForApi }),
        signal: controller.signal,
      });
      clearTimeout(t);
      let data = null;
      try {
        data = await response.json();
      } catch {
        const raw = await response.text().catch(() => '');
        throw new Error(raw ? raw.slice(0, 200) : `Respuesta inválida (HTTP ${response.status})`);
      }
      let assistantMessage = data.choices?.[0]?.message?.content || data.error?.message;
      if (!assistantMessage) {
        assistantMessage = response.ok
          ? 'Sorry, I could not get a response.'
          : (data.error?.message || `Error ${response.status}. Verifica tu API key.`);
      }
      if (!response.ok && (response.status === 400 || response.status === 403)) {
        const apiMsg = data.error?.message || data.error?.error?.message || data.message || '';
        assistantMessage = `⚠️ **Error ${response.status} – API key**

${apiMsg ? `**Detalle:** ${apiMsg}\n\n` : ''}**Solución más rápida – usa Groq:**
1. https://console.groq.com/keys – crea una key (gratis, sin tarjeta)
2. Render → Environment → añade \`GROQ_API_KEY\` = tu clave → redeploy`;
      }

      const assistantObj = { id: `a-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'assistant', content: assistantMessage, kind: 'text' };
      setMessages(prev => [...prev, assistantObj]);
      if (autoSpeak) handleSpeak(assistantMessage);
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      const msg = error.message?.includes('Failed to fetch') || error.name === 'TypeError'
        ? 'Error de conexión. ¿El backend está activo? Verifica la URL en Ajustes.'
        : (isAbort ? 'Timeout esperando respuesta de la IA. Intenta de nuevo.' : "Sorry, I had trouble connecting. Could you try saying that again?");
      setMessages(prev => [...prev, { id: `e-${Date.now()}-${Math.random().toString(16).slice(2)}`, role: 'assistant', content: msg, kind: 'text' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage(input);
    }
  };

  // Pantalla de configuración de API key
  if (hasApiKey === false) {
    return (
      <div className="min-h-screen font-sans bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="fixed inset-0 bg-slate-100 -z-10" />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white">
              <Key className="w-7 h-7" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Configuración</h1>
              <p className="text-sm text-slate-500">Groq (recomendado) o Gemini · Ambos gratis</p>
            </div>
          </div>
          <form onSubmit={handleSaveApiKey} className="space-y-5">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="gsk_... (Groq) o AIza... (Gemini)"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
              disabled={savingKey}
              autoFocus
            />
            {keyError && <p className="text-sm text-red-600">{keyError}</p>}
            <button
              type="submit"
              disabled={!apiKeyInput.trim() || savingKey}
              className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingKey ? 'Guardando...' : 'Guardar (quedará permanente)'}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Si usas Firebase Hosting, configura la URL del backend (Render) en Ajustes.
          </p>
          <div className="flex gap-4 justify-center mt-6 flex-wrap">
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Groq (gratis, recomendado) →
            </a>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Gemini (gratis) →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-slate-50 flex flex-col">
      {/* Header profesional */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white">
                <Sparkles className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                  English Conversation
                </h1>
                <p className="text-xs text-slate-500">
                  Practice with AI · Groq o Gemini
                </p>
              </div>
            </div>
            {/* Selector de voz: hablar con mujer u hombre */}
            <div className="relative flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:inline">Talk with:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50/80">
                <button
                  onClick={() => handleVoiceChange('female')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                    voiceGender === 'female'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Voz de mujer"
                >
                  <UserCircle size={18} />
                  <span>Woman</span>
                </button>
                <button
                  onClick={() => handleVoiceChange('male')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                    voiceGender === 'male'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Voz de hombre"
                >
                  <User size={18} />
                  <span>Man</span>
                </button>
              </div>
              <button
                onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-600"
                title="Ajustes"
              >
                <Settings2 size={18} />
              </button>
              {showVoiceMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowVoiceMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 py-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-20">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium mb-2">Voces (Text-to-Speech)</p>
                      <label className="text-[11px] text-slate-500 block mb-1">Voz mujer</label>
                      <select
                        value={femaleVoiceName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFemaleVoiceName(v);
                          localStorage.setItem('english-conv-voice-female-name', v);
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                      >
                        <option value="">Auto</option>
                        {availableVoices.map(v => (
                          <option key={`f-${v.name}`} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                      <label className="text-[11px] text-slate-500 block mb-1 mt-2">Voz hombre</label>
                      <select
                        value={maleVoiceName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMaleVoiceName(v);
                          localStorage.setItem('english-conv-voice-male-name', v);
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                      >
                        <option value="">Auto</option>
                        {availableVoices.map(v => (
                          <option key={`m-${v.name}`} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                      {availableVoices.length <= 1 && (
                        <p className="mt-2 text-[11px] text-amber-700">
                          Solo hay 1 voz disponible en tu sistema, por eso “Man/Woman” suenan igual. Instala más voces en Windows (Configuración → Hora e idioma → Voz).
                        </p>
                      )}
                    </div>
                    <div className="px-4 py-2">
                      <label className="text-xs text-slate-500 font-medium block mb-1">Backend URL</label>
                      <input
                        type="url"
                        value={apiBase}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setApiBase(v);
                          localStorage.setItem('english-conv-api-url', v);
                          if (v) {
                            fetch(`${v.replace(/\/$/, '')}/api/check-key`)
                              .then(r => r.json())
                              .then(d => { if (d.hasKey) { setUseBackend(true); setHasApiKey(true); } })
                              .catch(() => {});
                          }
                        }}
                        placeholder="https://tu-app.onrender.com"
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <button
                        type="button"
                        onClick={recheckBackend}
                        className="mt-2 w-full py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        {useBackend ? '✓ Conectado' : 'Revisar conexión'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Chat container */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="flex-1 overflow-y-auto space-y-6 chat-scrollbar min-h-0">
          {messages.map((message) => (
            <div
              key={message.id || `${message.role}-${message.content?.slice(0, 20)}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-3 max-w-[90%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                  message.role === 'user' 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-white border border-slate-200 text-slate-700 shadow-sm'
                }`}>
                  {message.role === 'user' ? 'You' : 'AI'}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-slate-800 text-white rounded-br-md'
                      : 'bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-bl-md'
                  }`}
                >
                  {message.kind === 'audio' && message.audioUrl ? (
                    <div className="space-y-2">
                      <audio controls src={message.audioUrl} className="w-full" />
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
                  )}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleSpeak(message.content)}
                      className="mt-3 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
                      disabled={isSpeaking}
                    >
                      <Volume2 size={14} />
                      <span>{isSpeaking ? 'Playing...' : 'Listen'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">AI</div>
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 pt-4">
          <div className="flex gap-2 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={startVoiceInput}
              className={`p-3 rounded-xl flex-shrink-0 transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white mic-recording'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800'
              }`}
              title={isListening ? 'Soltar para enviar' : 'Mantén para grabar'}
              disabled={isLoading}
            >
              {isListening ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? 'Listening... speak in English' : 'Type your message in English...'}
              className="flex-1 px-4 py-3 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={20} strokeWidth={2} />
            </button>
          </div>
          {(voiceError || isListening || isRecordingAudio) && (
            <p className={`text-xs text-center mt-2 ${voiceError ? 'text-red-600' : 'text-slate-500'}`}>
              {voiceError || (isRecordingAudio ? `Grabando nota de voz… ${String(Math.floor(recordSeconds/60)).padStart(2,'0')}:${String(recordSeconds%60).padStart(2,'0')} (suelta para enviar)` : 'Recording… suelta para enviar')}
            </p>
          )}
          {!voiceError && !isListening && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Press Enter to send · Click microphone to speak
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
