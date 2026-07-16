import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { AppSettings, CustomProvider } from './types';
import { BUILTIN_PROVIDERS, getProvider } from './providers';
import { fetchModels, clearModelCacheEntry } from './api';

interface Props {
  settings: AppSettings;
  onUpdate: (s: AppSettings) => void;
  onClose: () => void;
}

const TABS = [
  { key: 'keys', label: 'Keys', icon: 'key' },
  { key: 'model', label: 'Model', icon: 'cpu' },
  { key: 'custom', label: 'Custom', icon: 'plus' },
  { key: 'advanced', label: 'Advanced', icon: 'sliders' },
] as const;
type Tab = typeof TABS[number]['key'];

export default function Settings({ settings, onUpdate, onClose }: Props) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<Tab>('keys');
  const [newCustom, setNewCustom] = useState({ name: '', baseUrl: '', chatCompletionPath: '/v1/chat/completions', defaultModel: '', models: '', apiKey: '' });
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const update = (partial: Partial<AppSettings>) => setLocal(p => ({ ...p, ...partial }));
  const currentProvider = getProvider(local.activeProvider, local.customProviders || []);
  const apiKey = local.apiKeys[local.activeProvider] || '';
  const loadIdRef = useRef(0);
  const localRef = useRef(local);
  localRef.current = local;

  function loadModels(forceRefresh: boolean) {
    if (!currentProvider) return;
    const loadId = ++loadIdRef.current;
    if (forceRefresh) clearModelCacheEntry(local.activeProvider);
    setFetchingModels(true);
    fetchModels(currentProvider, apiKey)
      .then(models => {
        if (loadId !== loadIdRef.current) return;
        setFetchedModels(models);
        if (!models.includes(local.activeModel) && models.length > 0) {
          update({
            activeModel: models.includes(currentProvider.defaultModel)
              ? currentProvider.defaultModel
              : models[0],
          });
        }
      })
      .catch(() => {
        if (loadId !== loadIdRef.current) return;
        setFetchedModels(currentProvider.models);
      })
      .finally(() => {
        if (loadId === loadIdRef.current) setFetchingModels(false);
      });
  }

  useEffect(() => {
    setFetchedModels([]);
    loadModels(false);
  }, [local.activeProvider]);

  function save() {
    onUpdate(localRef.current);
    onClose();
  }

  function addCustomProvider() {
    if (!newCustom.name || !newCustom.baseUrl || !newCustom.defaultModel) return;
    const id = 'custom-' + Date.now();
    const commaModels = newCustom.models.split(',').map(m => m.trim()).filter(Boolean);
    const allModels = [...new Set([newCustom.defaultModel, ...commaModels])];
    const cp: CustomProvider = {
      id,
      name: newCustom.name,
      baseUrl: newCustom.baseUrl,
      chatCompletionPath: newCustom.chatCompletionPath || '/v1/chat/completions',
      defaultModel: newCustom.defaultModel,
      models: allModels,
    };
    const updated: AppSettings = {
      ...local,
      customProviders: [...(local.customProviders || []), cp],
      activeProvider: id,
      activeModel: cp.defaultModel,
      apiKeys: { ...local.apiKeys, ...(newCustom.apiKey ? { [id]: newCustom.apiKey } : {}) },
    };
    setLocal(updated);
    onUpdate(updated);
    setNewCustom({ name: '', baseUrl: '', chatCompletionPath: '/v1/chat/completions', defaultModel: '', models: '', apiKey: '' });
  }

  function removeCustomProvider(id: string) {
    const updatedProviders = (local.customProviders || []).filter(p => p.id !== id);
    const updated: AppSettings = {
      ...local,
      customProviders: updatedProviders,
      activeProvider: local.activeProvider === id ? 'openai' : local.activeProvider,
      apiKeys: { ...local.apiKeys, [id]: '' },
    };
    setLocal(updated);
    onUpdate(updated);
  }

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all";
  const selectCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-white/[0.15] transition-all appearance-none";

  const tabIcons: Record<string, ReactNode> = {
    key: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
    cpu: <g><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></g>,
    plus: <g><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
    sliders: <g><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></g>,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      <div className="relative w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/[0.06] rounded-t-3xl sm:rounded-2xl animate-slide-up sm:animate-fade-in flex flex-col shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-200">Settings</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center btn-glass rounded-lg text-zinc-400 active:text-white active:scale-90 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                activeTab === t.key
                  ? 'bg-white/[0.08] text-zinc-200 border border-white/[0.08]'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tabIcons[t.key]}
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {activeTab === 'keys' && (
            <div className="space-y-3">
              {Object.entries(BUILTIN_PROVIDERS).map(([id, info]) => (
                <div key={id}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{info.name} API Key</label>
                  <input
                    type="password"
                    value={local.apiKeys[id] || ''}
                    onChange={e => update({ apiKeys: { ...local.apiKeys, [id]: e.target.value } })}
                    placeholder="sk-..."
                    className={inputCls}
                  />
                </div>
              ))}
              {(local.customProviders || []).map(cp => (
                <div key={cp.id}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{cp.name} API Key</label>
                  <input
                    type="password"
                    value={local.apiKeys[cp.id] || ''}
                    onChange={e => update({ apiKeys: { ...local.apiKeys, [cp.id]: e.target.value } })}
                    placeholder="sk-..."
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'model' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Provider</label>
                <select
                  value={local.activeProvider}
                  onChange={e => {
                    if (e.target.value === '__add_custom__') {
                      setActiveTab('custom');
                      return;
                    }
                    update({ activeProvider: e.target.value });
                  }}
                  className={selectCls}
                >
                  {Object.entries(BUILTIN_PROVIDERS).map(([id, p]) => (
                    <option key={id} value={id} className="bg-[#1a1a20]">{p.name}</option>
                  ))}
                  {(local.customProviders || []).map(cp => (
                    <option key={cp.id} value={cp.id} className="bg-[#1a1a20]">{cp.name}</option>
                  ))}
                  <option value="__add_custom__" className="bg-[#1a1a20] text-zinc-500">+ Add custom provider</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-500">Model</label>
                  <button
                    onClick={() => loadModels(true)}
                    disabled={fetchingModels}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={fetchingModels ? 'animate-spin' : ''}
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh
                  </button>
                </div>
                <select
                  value={local.activeModel}
                  onChange={e => update({ activeModel: e.target.value })}
                  className={selectCls}
                >
                  {((): string[] => {
                    const models = fetchedModels.length > 0 ? fetchedModels : (currentProvider?.models || []);
                    if (models.length === 0 && local.activeModel) return [local.activeModel];
                    return models;
                  })().map(m => (
                    <option key={m} value={m} className="bg-[#1a1a20]">{m}</option>
                  ))}
                </select>
                {fetchingModels && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                    Fetching models...
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              {(local.customProviders || []).length > 0 && (
                <div className="space-y-3">
                  {local.customProviders.map(cp => (
                    <div key={cp.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-300 font-medium truncate">{cp.name}</div>
                          <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{cp.baseUrl}{cp.chatCompletionPath}</div>
                        </div>
                        <button
                          onClick={() => removeCustomProvider(cp.id)}
                          className="ml-3 flex-shrink-0 text-xs text-red-400/80 hover:text-red-400 active:scale-90 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">API Key</label>
                        <input
                          type="password"
                          value={local.apiKeys[cp.id] || ''}
                          onChange={e => update({ apiKeys: { ...local.apiKeys, [cp.id]: e.target.value } })}
                          placeholder="sk-..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/[0.04] pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Add Provider</h3>
                <input value={newCustom.name} onChange={e => setNewCustom(p => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. Ollama)" className={inputCls} />
                <input value={newCustom.baseUrl} onChange={e => setNewCustom(p => ({ ...p, baseUrl: e.target.value }))} placeholder="Base URL (e.g. http://localhost:11434)" className={inputCls} />
                <input value={newCustom.chatCompletionPath} onChange={e => setNewCustom(p => ({ ...p, chatCompletionPath: e.target.value }))} placeholder="Path (e.g. /v1/chat/completions)" className={inputCls} />
                <input value={newCustom.defaultModel} onChange={e => setNewCustom(p => ({ ...p, defaultModel: e.target.value }))} placeholder="Default model (e.g. llama3)" className={inputCls} />
                <input value={newCustom.models} onChange={e => setNewCustom(p => ({ ...p, models: e.target.value }))} placeholder="Additional models (comma-separated, optional)" className={inputCls} />
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">API Key (optional)</label>
                  <input
                    type="password"
                    value={newCustom.apiKey}
                    onChange={e => setNewCustom(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className={inputCls}
                  />
                </div>
                <button
                  onClick={addCustomProvider}
                  disabled={!newCustom.name || !newCustom.baseUrl || !newCustom.defaultModel}
                  className="w-full btn-accent rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-30 disabled:shadow-none disabled:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  Add Provider
                </button>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">System Prompt</label>
                <textarea
                  value={local.systemPrompt}
                  onChange={e => update({ systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-500">Max Output Tokens</label>
                  <span className="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-lg">{local.contextLength.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={256}
                  max={32768}
                  step={256}
                  value={local.contextLength}
                  onChange={e => update({ contextLength: Number(e.target.value) })}
                  className="w-full h-1.5 appearance-none bg-white/[0.06] rounded-full outline-none accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/30"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>256</span><span>32K</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-500">Temperature</label>
                  <span className="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-lg">{local.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={local.temperature}
                  onChange={e => update({ temperature: Number(e.target.value) })}
                  className="w-full h-1.5 appearance-none bg-white/[0.06] rounded-full outline-none accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/30"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>Deterministic</span><span>Creative</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 px-4 py-3 border-t border-white/[0.04]">
          <button onClick={onClose} className="flex-1 btn-glass rounded-xl py-2.5 text-sm font-medium text-zinc-300 active:scale-[0.98] transition-all">Cancel</button>
          <button onClick={save} className="flex-1 btn-accent rounded-xl py-2.5 text-sm font-medium text-white active:scale-[0.98] transition-all">Save</button>
        </div>
      </div>
    </div>
  );
}
