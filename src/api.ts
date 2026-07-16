import type { ChatMessage, ContentPart, ProviderConfig, ModelCacheEntry } from './types';

const PROXY_PATH = '/api/proxy';
const USE_PROXY = true;

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!USE_PROXY) return fetch(url, init);

  const headers = new Headers(init.headers);
  headers.set('x-proxy-url', url);

  return fetch(PROXY_PATH, {
    ...init,
    headers,
  });
}

function getAuthHeaders(provider: ProviderConfig, apiKey: string): Record<string, string> {
  if (provider.id === 'anthropic') {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  }
  if (provider.id === 'openrouter') {
    return { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'LLM Chat' };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function buildUrl(provider: ProviderConfig, model: string): string {
  if (provider.id === 'google') {
    return `${provider.baseUrl}${provider.chatCompletionPath.replace('{model}', model)}`;
  }
  return `${provider.baseUrl}${provider.chatCompletionPath}`;
}

function parseStreamChunk(provider: ProviderConfig, text: string): ParsedChunk {
  if (provider.id === 'google') {
    if (text.startsWith('data: ')) {
      const json = text.slice(6);
      if (json === '[DONE]') return { content: '', done: true };
      try {
        const data = JSON.parse(json);
        const parts = data?.candidates?.[0]?.content?.parts;
        let content = '';
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (typeof p?.text === 'string') content += p.text;
          }
        }
        const done = !!data?.candidates?.[0]?.finishReason;
        if (content) return { content, done };
        if (done) return { content: '', done: true };
      } catch { return { content: '', done: false }; }
    }
    return { content: '', done: false };
  }

  if (provider.id === 'anthropic') {
    if (text.startsWith('data: ')) {
      const json = text.slice(6);
      try {
        const data = JSON.parse(json);
        if (data.type === 'content_block_delta') {
          return { content: data.delta?.text || '', done: false };
        }
        if (data.type === 'message_stop') {
          return { content: '', done: true };
        }
      } catch { return { content: '', done: false }; }
    }
    return { content: '', done: false };
  }

  if (text.startsWith('data: ')) {
    const json = text.slice(6);
    if (json === '[DONE]') return { content: '', done: true };
    try {
      const data = JSON.parse(json);
      const content = data.choices?.[0]?.delta?.content;
      if (content) return { content, done: false };
      if (data.choices?.[0]?.finish_reason) return { content: '', done: true };
    } catch { return { content: '', done: false }; }
  }
  return { content: '', done: false };
}

interface ParsedChunk {
  content: string;
  done: boolean;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  provider: ProviderConfig,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  opts: { maxTokens: number; temperature: number; systemPrompt?: string; signal?: AbortSignal }
): Promise<void> {
  const url = buildUrl(provider, model);
  const body = provider.buildRequestBody({
    model,
    messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    stream: true,
    systemPrompt: opts.systemPrompt,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(provider, apiKey),
  };

  try {
    const response = await apiFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      try {
        const err = JSON.parse(errorText);
        errorMsg = err.error?.message || err.message || errorText;
      } catch {}
      throw new Error(`${provider.name} API error (${response.status}): ${errorMsg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        const parsed = parseStreamChunk(provider, line);
        if (parsed.content) callbacks.onToken(parsed.content);
        if (parsed.done) return callbacks.onDone();
      }
    }

    if (buffer.trim()) {
      const parsed = parseStreamChunk(provider, buffer);
      if (parsed.content) callbacks.onToken(parsed.content);
    }

    callbacks.onDone();
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      callbacks.onDone();
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

const MODEL_CACHE_KEY = 'llm-front:model-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function loadModelCache(): Record<string, ModelCacheEntry> {
  try {
    const raw = localStorage.getItem(MODEL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveModelCache(cache: Record<string, ModelCacheEntry>) {
  localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(cache));
}

export function clearModelCacheEntry(providerId: string) {
  const cache = loadModelCache();
  delete cache[providerId];
  saveModelCache(cache);
}

export async function fetchModels(
  provider: ProviderConfig,
  apiKey: string
): Promise<string[]> {
  const cache = loadModelCache();
  const cached = cache[provider.id];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.models;
  }

  let models: string[];

  try {
    if (provider.id === 'anthropic') {
      models = provider.models;
    } else if (provider.id === 'google') {
      models = await fetchGoogleModels(apiKey);
    } else {
      models = await fetchOpenAICompatibleModels(provider, apiKey);
    }
  } catch {
    models = provider.models;
  }

  cache[provider.id] = { models, fetchedAt: Date.now() };
  saveModelCache(cache);
  return models;
}

async function fetchOpenAICompatibleModels(
  provider: ProviderConfig,
  apiKey: string
): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (provider.id === 'openrouter') {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = window.location.origin;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const url = `${provider.baseUrl}/v1/models`;
  const res = await apiFetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`);
  }

  const json = await res.json();
  const allModels: Array<{ id: string }> = json.data || [];

  if (provider.id === 'openrouter') {
    return allModels.map(m => m.id).sort();
  }

  if (provider.id !== 'openai') {
    // Custom OpenAI-compatible provider — return everything the endpoint reports.
    return allModels.map(m => m.id).sort();
  }

  const exclude = /instruct|audio|realtime|tts|whisper|dall-e|embedding|davinci|babbage|ada|moderation/i;
  return allModels
    .filter(m => {
      const id = m.id.toLowerCase();
      if (id.includes('gpt') || id.includes('o1') || id.includes('o3') || id.includes('o4')) {
        return !exclude.test(id);
      }
      return false;
    })
    .map(m => m.id)
    .sort();
}

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await apiFetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch Google models: ${res.status}`);
  }

  const json = await res.json();
  const models: Array<{
    name: string;
    displayName: string;
    supportedGenerationMethods: string[];
  }> = json.models || [];

  return models
    .filter(m => {
      const methods = m.supportedGenerationMethods || [];
      return methods.includes('generateContent') && !m.name.includes('embedding');
    })
    .map(m => m.name.replace(/^models\//, ''))
    .sort();
}

export function fileToContentPart(file: File): Promise<ContentPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string);
      resolve({
        type: 'image_url',
        image_url: { url: base64 },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
