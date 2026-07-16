import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppSettings, Conversation, ChatMessage } from './types';
import { getProvider } from './providers';
import { streamChat } from './api';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import Settings from './Settings';

const STORAGE_KEY = 'llm-front:settings';
const CONVS_KEY = 'llm-front:conversations';

function loadSettings(): AppSettings {
  const defaults: AppSettings = {
    apiKeys: {},
    activeProvider: 'openai',
    activeModel: 'gpt-4o',
    systemPrompt: '',
    contextLength: 4096,
    temperature: 0.7,
    customProviders: [],
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

function createConversation(settings: AppSettings): Conversation {
  return {
    id: uuid(),
    title: 'New chat',
    messages: settings.systemPrompt ? [{ role: 'system', content: settings.systemPrompt }] : [],
    providerId: settings.activeProvider,
    model: settings.activeModel,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const raw = localStorage.getItem(CONVS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const s = loadSettings();
    return [createConversation(s)];
  });
  const [activeConvId, setActiveConvId] = useState(() => conversations[0]?.id || '');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(CONVS_KEY, JSON.stringify(conversations));
  }, [conversations]);

  const updateConversation = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c));
  }, []);

  const getApiKey = useCallback(() => {
    return settings.apiKeys[settings.activeProvider] || '';
  }, [settings]);

  function handleNewChat() {
    const s = settings;
    const conv = createConversation(s);
    setConversations(prev => [...prev, conv]);
    setActiveConvId(conv.id);
    setSidebarOpen(false);
  }

  function handleDeleteChat(id: string) {
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (id === activeConvId && remaining.length > 0) {
        setActiveConvId(remaining[remaining.length - 1].id);
      } else if (remaining.length === 0) {
        const s = settings;
        const newConv = createConversation(s);
        setActiveConvId(newConv.id);
        return [newConv];
      }
      return remaining;
    });
  }

  function handleSend(content: string | ChatMessage['content']) {
    if (!activeConv || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const updatedConv = {
      ...activeConv,
      messages: [...activeConv.messages, userMsg],
      updatedAt: Date.now(),
    };
    updateConversation(activeConv.id, () => updatedConv);

    const provider = getProvider(settings.activeProvider, settings.customProviders || []);
    const apiKey = getApiKey();

    if (!apiKey && provider.requiresAuth) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `No API key set for **${provider.name}**. Open Settings to add your key.`,
      };
      updateConversation(activeConv.id, c => ({
        ...c,
        messages: [...c.messages, errorMsg],
        updatedAt: Date.now(),
      }));
      return;
    }

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let fullContent = '';
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    updateConversation(activeConv.id, c => ({
      ...c,
      messages: [...c.messages, assistantMsg],
    }));

    streamChat(
      provider,
      apiKey,
      settings.activeModel,
      updatedConv.messages,
      {
        onToken(token) {
          if (controller.signal.aborted) return;
          fullContent += token;
          updateConversation(activeConv.id, c => {
            const msgs = [...c.messages];
            msgs[msgs.length - 1] = { role: 'assistant', content: fullContent };
            return { ...c, messages: msgs, updatedAt: Date.now() };
          });
        },
        onDone() {
          setStreaming(false);
          abortRef.current = null;
          if (activeConv.title === 'New chat' && fullContent) {
            const title = fullContent.slice(0, 50).replace(/\n/g, ' ');
            updateConversation(activeConv.id, c => ({ ...c, title }));
          }
        },
        onError(error) {
          setStreaming(false);
          abortRef.current = null;
          if (controller.signal.aborted) return;
          updateConversation(activeConv.id, c => {
            const msgs = [...c.messages];
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && !(msgs[msgs.length - 1].content as string).length) {
              msgs[msgs.length - 1] = { role: 'assistant', content: `Error: ${error.message}` };
            } else {
              msgs.push({ role: 'assistant', content: `Error: ${error.message}` });
            }
            return { ...c, messages: msgs, updatedAt: Date.now() };
          });
        },
      },
      {
        maxTokens: settings.contextLength,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
        signal: controller.signal,
      }
    );
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  useEffect(() => {
    if (!activeConv && conversations.length > 0) {
      setActiveConvId(conversations[conversations.length - 1].id);
    }
  }, [activeConv, conversations]);

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0f] text-zinc-200 overflow-hidden">
      <header
        className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] flex-shrink-0"
        style={{ paddingTop: `calc(0.5rem + var(--safe-top))` }}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={id => { setActiveConvId(id); setSidebarOpen(false); }}
          onNew={handleNewChat}
          onDelete={handleDeleteChat}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />

        {sidebarOpen && (
          <div />
        )}

        <div className="flex items-center gap-2">
          {activeConv && !sidebarOpen && (
            <span className="text-[11px] text-zinc-600 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded-full truncate max-w-[140px]">
              {settings.activeModel}
            </span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="h-10 w-10 flex items-center justify-center bg-glass rounded-xl text-zinc-400 active:text-white active:scale-90 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeConv ? (
          <ChatView
            conversation={activeConv}
            streaming={streaming}
            onSend={handleSend}
            onStop={handleStop}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-border bg-glass mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-400">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-300 mb-1">No conversation</h2>
              <button onClick={handleNewChat} className="mt-4 btn-accent rounded-xl px-6 py-2.5 text-sm font-medium text-white active:scale-[0.98] transition-all">
                Start a new chat
              </button>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
