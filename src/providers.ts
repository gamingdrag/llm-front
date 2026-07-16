import type { ProviderConfig } from './types';

export const BUILTIN_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
    streamingSupported: true,
    requiresAuth: true,
    chatCompletionPath: '/v1/chat/completions',
    buildRequestBody: ({ model, messages, maxTokens, temperature, stream, systemPrompt }) => {
      const msgs = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;
      return { model, messages: msgs, max_tokens: maxTokens, temperature, stream };
    },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    streamingSupported: true,
    requiresAuth: true,
    chatCompletionPath: '/v1/messages',
    buildRequestBody: ({ model, messages, maxTokens, temperature, stream, systemPrompt }) => {
      const nonSystem = messages.filter(m => m.role !== 'system');
      return {
        model,
        messages: nonSystem,
        max_tokens: maxTokens,
        temperature,
        stream,
        ...(systemPrompt ? { system: systemPrompt } : {}),
      };
    },
  },
  google: {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-pro',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    streamingSupported: true,
    requiresAuth: true,
    chatCompletionPath: '/v1beta/models/{model}:streamGenerateContent?alt=sse',
    buildRequestBody: ({ messages, maxTokens, temperature, systemPrompt }) => {
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => {
          if (typeof m.content === 'string') {
            return {
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            };
          }
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: (m.content as Array<{ type: string; text?: string; image_url?: { url: string } }>).map(part => {
              if (part.type === 'text') return { text: part.text };
              if (part.type === 'image_url') {
                const url = part.image_url?.url || '';
                if (url.startsWith('data:')) {
                  const [mimePart, data] = url.split(',');
                  const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/png';
                  return { inline_data: { mime_type: mimeType, data } };
                }
                return { file_data: { file_uri: url } };
              }
              return { text: '' };
            }),
          };
        });
      return {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
        systemInstruction: systemPrompt
          ? { parts: [{ text: systemPrompt }] }
          : undefined,
      };
    },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    defaultModel: 'openai/gpt-4o',
    models: [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4-20250514',
      'anthropic/claude-opus-4-20250514',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'meta-llama/llama-4-maverick',
      'meta-llama/llama-4-scout',
      'deepseek/deepseek-chat-v3-0324',
      'deepseek/deepseek-r1',
    ],
    streamingSupported: true,
    requiresAuth: true,
    chatCompletionPath: '/v1/chat/completions',
    buildRequestBody: ({ model, messages, maxTokens, temperature, stream, systemPrompt }) => {
      const msgs = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;
      return { model, messages: msgs, max_tokens: maxTokens, temperature, stream };
    },
  },
};

export function getProvider(providerId: string, customProviders: { id: string; name: string; baseUrl: string; chatCompletionPath: string; defaultModel: string; models: string[] }[]): ProviderConfig {
  const builtin = BUILTIN_PROVIDERS[providerId];
  if (builtin) return builtin;

  const custom = customProviders.find(p => p.id === providerId);
  if (!custom) return BUILTIN_PROVIDERS.openai;

  return {
    id: custom.id,
    name: custom.name,
    baseUrl: custom.baseUrl.replace(/\/$/, ''),
    defaultModel: custom.defaultModel,
    models: custom.models,
    streamingSupported: true,
    requiresAuth: true,
    chatCompletionPath: custom.chatCompletionPath,
    buildRequestBody: ({ model, messages, maxTokens, temperature, stream, systemPrompt }) => {
      const msgs = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;
      return { model, messages: msgs, max_tokens: maxTokens, temperature, stream };
    },
  };
}
