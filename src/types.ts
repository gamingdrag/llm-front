export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnvVar?: string;
  defaultModel: string;
  models: string[];
  streamingSupported: boolean;
  requiresAuth: boolean;
  chatCompletionPath: string;
  buildRequestBody: (params: BuildRequestParams) => unknown;
}

export interface BuildRequestParams {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
  systemPrompt?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  providerId: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  apiKeys: Record<string, string>;
  activeProvider: string;
  activeModel: string;
  systemPrompt: string;
  contextLength: number;
  temperature: number;
  customProviders: CustomProvider[];
}

export interface ModelCacheEntry {
  models: string[];
  fetchedAt: number;
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  chatCompletionPath: string;
  defaultModel: string;
  models: string[];
  apiKeyEnvVar?: string;
}

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | string;
