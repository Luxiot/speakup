import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, Loader2, Sparkles, Key, Settings2, User, UserCircle } from 'lucide-react';

// Voces conocidas por género (Windows, Mac, Chrome)
const FEMALE_VOICES = ['zira', 'aria', 'samantha', 'karen', 'victoria', 'fiona', 'tessa', 'moira', 'kate', 'susan'];
const MALE_VOICES = ['david', 'mark', 'alex', 'daniel', 'fred', 'oliver', 'george', 'russell'];

function getVoiceForGender(gender) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const target = gender === 'male' ? MALE_VOICES : FEMALE_VOICES;
  const found = voices.find(v => target.some(t => v.name.toLowerCase().includes(t) && v.lang.startsWith('en')));
  return found || voices.find(v => v.lang.startsWith('en')) || voices[0];
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
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
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
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const handleVoiceChange = (gender) => {
    setVoiceGender(gender);
    localStorage.setItem('english-conv-voice', gender);
    setShowVoiceMenu(false);
  };

  useEffect(() => {
    const localKey = localStorage.getItem('english-conv-xai-key');
    const base = apiBase || '';
    const checkUrl = base ? `${base.replace(/\/$/, '')}/api/check-key` : '/api/check-key';
    
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
      const base = apiBase || '';
      const saveUrl = base ? `${base.replace(/\/$/, '')}/api/save-key` : '/api/save-key';
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, provider: 'gemini' }),
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const apiMessages = [
        { role: 'system', content: "You are a friendly, patient English conversation partner helping someone practice their English. Have natural, engaging conversations on any topic they choose. Speak fluently and naturally, like a native speaker would. Keep your responses conversational (2-4 sentences typically) unless the topic requires more detail. Occasionally ask follow-up questions to keep the conversation flowing. Don't correct grammar unless it causes confusion - focus on natural conversation. Be encouraging and supportive." },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage }
      ];

      if (!useBackend) {
      const backendMsg = `⚠️ **Se necesita un backend** para conectar con Grok (la API no permite llamadas directas desde el navegador).

**Opciones:**
1. **Plan Blaze en Firebase** – Activa Blaze y vuelve a desplegar.
2. **Render (gratis)** – Despliega \`server.js\` en render.com y pega la URL en Ajustes.`;
      setMessages(prev => [...prev, { role: 'assistant', content: backendMsg }]);
      setIsLoading(false);
      return;
    }

      const base = apiBase || '';
      const chatUrl = base ? `${base.replace(/\/$/, '')}/api/chat` : '/api/chat';
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'grok-3-mini', max_tokens: 1000, messages: apiMessages }),
      });

      const data = await response.json();
      let assistantMessage = data.choices?.[0]?.message?.content || data.error?.message;
      
      if (!assistantMessage) {
        assistantMessage = response.ok 
          ? 'Sorry, I could not get a response.'
          : (data.error?.message || `Error ${response.status}. Verifica tu API key.`);
      }

      if (!response.ok && (response.status === 400 || response.status === 403)) {
        const apiMsg = data.error?.message || '';
        assistantMessage = `⚠️ **Error ${response.status} – API key o cuenta xAI**

${apiMsg ? `Detalle: ${apiMsg}\n\n` : ''}**Revisa:**
1. https://console.x.ai – inicia sesión
2. **Credits** – necesitas cargar créditos (la API es de pago)
3. https://console.x.ai/team/default/api-keys – crea o verifica tu API key
4. Render → Environment → XAI_API_KEY debe coincidir con la key de xAI`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error('Error:', error);
      const msg = error.message?.includes('Failed to fetch') || error.name === 'TypeError'
        ? 'Error de conexión. ¿El backend está activo? Si usas Railway, verifica la URL.'
        : "Sorry, I had trouble connecting. Could you try saying that again?";
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = voiceGender === 'male' ? 0.9 : 1;
      const voice = getVoiceForGender(voiceGender);
      if (voice) utterance.voice = voice;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setVoiceError('Tu navegador no soporta voz. Usa Chrome o Edge.');
      setTimeout(() => setVoiceError(''), 4000);
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    setVoiceError('');
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
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) {
          committedTranscriptRef.current += (committedTranscriptRef.current ? ' ' : '') + text;
        } else {
          interim = text;
        }
      }
      const full = committedTranscriptRef.current + (interim ? ' ' + interim : '');
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              <p className="text-sm text-slate-500">API key de Google Gemini (gratis) o xAI (Grok)</p>
            </div>
          </div>
          <form onSubmit={handleSaveApiKey} className="space-y-5">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
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
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-slate-600 hover:text-slate-900 mt-6 transition-colors"
          >
            Obtener API key Gemini (gratis) →
          </a>
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
                  Practice with AI · Powered by Gemini
                </p>
              </div>
            </div>
            {/* Selector de voz */}
            <div className="relative">
              <button
                onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 text-sm font-medium transition-colors"
                title="Voice settings"
              >
                <Settings2 size={16} />
                <span className="hidden sm:inline">{voiceGender === 'male' ? 'Male voice' : 'Female voice'}</span>
                {voiceGender === 'male' ? <User size={16} /> : <UserCircle size={16} />}
              </button>
              {showVoiceMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowVoiceMenu(false)} />
                  <div className="absolute right-0 mt-1 py-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-20">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <label className="text-xs text-slate-500 font-medium block mb-1">Backend URL (Render / Railway)</label>
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
                    </div>
                    <button
                      onClick={() => handleVoiceChange('female')}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 ${voiceGender === 'female' ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600'}`}
                    >
                      <UserCircle size={18} />
                      Female voice
                    </button>
                    <button
                      onClick={() => handleVoiceChange('male')}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 ${voiceGender === 'male' ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600'}`}
                    >
                      <User size={18} />
                      Male voice
                    </button>
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
          {messages.map((message, index) => (
            <div
              key={index}
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
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
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
              title={isListening ? 'Click to stop recording' : 'Hold or click to speak'}
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
          {(voiceError || isListening) && (
            <p className={`text-xs text-center mt-2 ${voiceError ? 'text-red-600' : 'text-slate-500'}`}>
              {voiceError || 'Recording... click mic again to stop'}
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
