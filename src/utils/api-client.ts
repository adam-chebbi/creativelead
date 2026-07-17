import { getSettings } from '../hooks/useSettingsStore';

// ── Types ────────────────────────────────────────────────────────────────────

export type AiProvider =
  | 'gemini'
  | 'openai'
  | 'openrouter'
  | 'groq'
  | 'anthropic'
  | 'mistral'
  | 'cohere'
  | 'custom';

export interface AiRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiError {
  code: 'NO_KEY' | 'API_ERROR' | 'PARSE_ERROR' | 'RATE_LIMITED';
  message: string;
}

export type AiResult = { ok: true; text: string } | { ok: false; error: AiError };

// ── Provider metadata ─────────────────────────────────────────────────────────

export interface ProviderMeta {
  label: string;
  tier: 'free' | 'free-tier' | 'paid';
  apiBase: string;
  docsUrl: string;
  keyPlaceholder: string;
  models: ModelOption[];
}

export interface ModelOption {
  id: string;
  label: string;
  free: boolean;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  gemini: {
    label: 'Google Gemini',
    tier: 'free-tier',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free)', free: true },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (free)', free: true },
      { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B (free)', free: true },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (paid)', free: false },
      { id: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking (exp)', free: true },
    ],
  },
  openai: {
    label: 'OpenAI',
    tier: 'paid',
    apiBase: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheapest)', free: false },
      { id: 'gpt-4o', label: 'GPT-4o', free: false },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', free: false },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', free: false },
      { id: 'o4-mini', label: 'o4-mini (reasoning)', free: false },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    tier: 'free-tier',
    apiBase: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    models: [
      { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek V3 Chat (FREE) — recommended', free: true },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoning (FREE)', free: true },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B Instruct (FREE)', free: true },
      { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'Llama 3.2 3B Instruct (FREE)', free: true },
      { id: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B IT (FREE)', free: true },
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Instruct (FREE)', free: true },
      { id: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B Instruct (FREE)', free: true },
      { id: 'nousresearch/hermes-3-llama-3.1-8b:free', label: 'Hermes 3 Llama 3.1 8B (FREE)', free: true },
      { id: 'liquid/lfm-40b:free', label: 'Liquid LFM 40B (FREE)', free: true },
      { id: 'openchat/openchat-7b:free', label: 'OpenChat 7B (FREE)', free: true },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (paid)', free: false },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini via OpenRouter (paid)', free: false },
    ],
  },
  groq: {
    label: 'Groq (Ultra-fast)',
    tier: 'free-tier',
    apiBase: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    models: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (FREE)', free: true },
      { id: 'llama3-70b-8192', label: 'Llama 3 70B (FREE)', free: true },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B IT (FREE)', free: true },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (FREE)', free: true },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (FREE)', free: true },
      { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile (FREE)', free: true },
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    tier: 'paid',
    apiBase: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    models: [
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (cheapest)', free: false },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', free: false },
      { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', free: false },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (most capable)', free: false },
    ],
  },
  mistral: {
    label: 'Mistral AI',
    tier: 'free-tier',
    apiBase: 'https://api.mistral.ai/v1',
    docsUrl: 'https://console.mistral.ai/api-keys',
    keyPlaceholder: 'Enter Mistral API key...',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small (free tier)', free: true },
      { id: 'open-mistral-7b', label: 'Mistral 7B (open)', free: true },
      { id: 'open-mixtral-8x7b', label: 'Mixtral 8x7B (open)', free: true },
      { id: 'mistral-medium-latest', label: 'Mistral Medium', free: false },
      { id: 'mistral-large-latest', label: 'Mistral Large', free: false },
    ],
  },
  cohere: {
    label: 'Cohere',
    tier: 'free-tier',
    apiBase: 'https://api.cohere.com/compatibility/v1',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    keyPlaceholder: 'Enter Cohere API key...',
    models: [
      { id: 'command-r', label: 'Command R (free trial)', free: true },
      { id: 'command-r-plus', label: 'Command R+ (free trial)', free: true },
      { id: 'command', label: 'Command', free: false },
    ],
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    tier: 'free',
    apiBase: '',
    docsUrl: '',
    keyPlaceholder: 'Enter API key...',
    models: [
      { id: 'custom', label: 'Specify model in settings', free: true },
    ],
  },
};

// ── Default models per provider ───────────────────────────────────────────────

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  openrouter: 'deepseek/deepseek-chat:free',
  groq: 'llama-3.1-8b-instant',
  anthropic: 'claude-3-5-haiku-20241022',
  mistral: 'mistral-small-latest',
  cohere: 'command-r',
  custom: 'custom',
};

// ── Rate-limit throttle for Gemini ───────────────────────────────────────────

const GEMINI_MIN_INTERVAL_MS = 2100; // 30 rpm → 2s + buffer
let lastGeminiCall = 0;

function scheduleGeminiCall(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, GEMINI_MIN_INTERVAL_MS - (now - lastGeminiCall));
  lastGeminiCall = now + wait;
  if (wait === 0) return Promise.resolve();
  return new Promise<void>(resolve => setTimeout(resolve, wait));
}

// ── Shared retry helper ───────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: any) => boolean,
  maxRetries = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[AI] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
}

// ── Gemini caller (native API) ────────────────────────────────────────────────

export async function callGemini(
  req: AiRequest,
  apiKey: string,
  model = 'gemini-2.0-flash',
  _retryCount = 0,
): Promise<AiResult> {
  const MAX_RETRIES = 3;
  await scheduleGeminiCall();

  const contents: any[] = [];
  if (req.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: `${req.systemPrompt}\n\n${req.prompt}` }] });
  } else {
    contents.push({ parts: [{ text: req.prompt }] });
  }

  const body: any = {
    contents,
    generationConfig: {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 1200,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 429) {
        if (_retryCount < MAX_RETRIES) {
          const backoffMs = GEMINI_MIN_INTERVAL_MS * Math.pow(2, _retryCount + 1);
          console.warn(`[Gemini] 429 — retrying in ${backoffMs}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, backoffMs));
          return callGemini(req, apiKey, model, _retryCount + 1);
        }
        return { ok: false, error: createAiError('RATE_LIMITED',
          'Gemini rate limit hit (30 req/min). The app retried automatically but the limit persists. ' +
          'Wait 60 s, switch to a different provider (e.g. OpenRouter free), or upgrade at https://aistudio.google.com/plan') };
      }
      if (res.status === 403) {
        return { ok: false, error: createAiError('NO_KEY', 'Gemini API key is invalid or quota exhausted. Check your key at https://aistudio.google.com/apikey') };
      }
      return { ok: false, error: createAiError('API_ERROR', `Gemini error (${res.status}): ${errBody.slice(0, 300)}`) };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const fr = data?.candidates?.[0]?.finishReason;
      if (fr && fr !== 'STOP') {
        return { ok: false, error: createAiError('API_ERROR', `Gemini blocked (finishReason: ${fr}). Try rephrasing.`) };
      }
      return { ok: false, error: createAiError('PARSE_ERROR', 'Gemini returned an empty response.') };
    }
    return { ok: true, text: text.trim() };
  } catch (err) {
    return { ok: false, error: createAiError('API_ERROR', 'Network error calling Gemini: ' + (err instanceof Error ? err.message : 'Unknown')) };
  }
}

// ── OpenAI-compatible caller (shared by OpenAI, OpenRouter, Groq, Mistral, Cohere, Custom) ──

export async function callOpenAiCompat(
  req: AiRequest,
  apiKey: string,
  model: string,
  baseUrl: string,
  providerName: string,
  extraHeaders: Record<string, string> = {},
): Promise<AiResult> {
  const body: any = {
    model,
    messages: [
      ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
      { role: 'user' as const, content: req.prompt },
    ],
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 1200,
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 429) {
        return { ok: false, error: createAiError('RATE_LIMITED', `${providerName} rate limit hit. Wait a moment and retry, or switch to another provider.`) };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: createAiError('NO_KEY', `${providerName} API key is invalid or lacks permissions. Check your key in Settings.`) };
      }
      return { ok: false, error: createAiError('API_ERROR', `${providerName} API error (${res.status}): ${errBody.slice(0, 300)}`) };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: createAiError('PARSE_ERROR', `${providerName} returned an empty response. The model may not support this request format.`) };
    return { ok: true, text: text.trim() };
  } catch (err) {
    return { ok: false, error: createAiError('API_ERROR', `Network error calling ${providerName}: ` + (err instanceof Error ? err.message : 'Unknown')) };
  }
}

// ── Anthropic caller (Messages API — different shape) ─────────────────────────

export async function callAnthropic(
  req: AiRequest,
  apiKey: string,
  model: string,
): Promise<AiResult> {
  const body: any = {
    model,
    max_tokens: req.maxTokens ?? 1200,
    messages: [{ role: 'user', content: req.prompt }],
    ...(req.systemPrompt ? { system: req.systemPrompt } : {}),
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 429) return { ok: false, error: createAiError('RATE_LIMITED', 'Anthropic rate limit hit. Wait a moment and retry.') };
      if (res.status === 401) return { ok: false, error: createAiError('NO_KEY', 'Anthropic API key is invalid. Check your key at https://console.anthropic.com/settings/keys') };
      return { ok: false, error: createAiError('API_ERROR', `Anthropic API error (${res.status}): ${errBody.slice(0, 300)}`) };
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text) return { ok: false, error: createAiError('PARSE_ERROR', 'Anthropic returned an empty response.') };
    return { ok: true, text: text.trim() };
  } catch (err) {
    return { ok: false, error: createAiError('API_ERROR', 'Network error calling Anthropic: ' + (err instanceof Error ? err.message : 'Unknown')) };
  }
}

// ── Unified callAi — provider dispatcher ─────────────────────────────────────

export async function callAi(req: AiRequest): Promise<AiResult> {
  const settings = getSettings();
  const provider: AiProvider = settings.aiProvider || 'gemini';
  const model = settings.aiModel || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'gemini': {
      const key = settings.geminiApiKey;
      if (!key) return missingKey('Gemini', 'https://aistudio.google.com/apikey');
      return callGemini(req, key, model);
    }

    case 'openai': {
      const key = settings.openAiKey;
      if (!key) return missingKey('OpenAI', 'https://platform.openai.com/api-keys');
      return callOpenAiCompat(req, key, model, 'https://api.openai.com/v1', 'OpenAI');
    }

    case 'openrouter': {
      const key = settings.openrouterApiKey;
      if (!key) return missingKey('OpenRouter', 'https://openrouter.ai/keys');
      return callOpenAiCompat(req, key, model, 'https://openrouter.ai/api/v1', 'OpenRouter', {
        'HTTP-Referer': 'https://creativelead.app',
        'X-Title': 'CreativeLead',
      });
    }

    case 'groq': {
      const key = settings.groqApiKey;
      if (!key) return missingKey('Groq', 'https://console.groq.com/keys');
      return callOpenAiCompat(req, key, model, 'https://api.groq.com/openai/v1', 'Groq');
    }

    case 'anthropic': {
      const key = settings.anthropicApiKey;
      if (!key) return missingKey('Anthropic', 'https://console.anthropic.com/settings/keys');
      return callAnthropic(req, key, model);
    }

    case 'mistral': {
      const key = settings.mistralApiKey;
      if (!key) return missingKey('Mistral', 'https://console.mistral.ai/api-keys');
      return callOpenAiCompat(req, key, model, 'https://api.mistral.ai/v1', 'Mistral');
    }

    case 'cohere': {
      const key = settings.cohereApiKey;
      if (!key) return missingKey('Cohere', 'https://dashboard.cohere.com/api-keys');
      return callOpenAiCompat(req, key, model, 'https://api.cohere.com/compatibility/v1', 'Cohere');
    }

    case 'custom': {
      const key = settings.customApiKey;
      const base = settings.customApiBase;
      if (!key) return { ok: false, error: createAiError('NO_KEY', 'No API key set for the custom provider. Go to Settings → AI Provider.') };
      if (!base) return { ok: false, error: createAiError('NO_KEY', 'No base URL set for the custom provider. Go to Settings → AI Provider.') };
      const customModel = settings.customModel || model;
      return callOpenAiCompat(req, key, customModel, base.replace(/\/$/, ''), 'Custom');
    }

    default:
      return { ok: false, error: createAiError('NO_KEY', 'Unknown AI provider. Go to Settings and configure a provider.') };
  }
}

// ── Test connection ───────────────────────────────────────────────────────────

export async function testAiConnection(
  provider: AiProvider,
  overrides?: Partial<ReturnType<typeof getSettings>>,
): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  const settings = { ...getSettings(), ...(overrides || {}) };
  const model = overrides?.aiModel ?? settings.aiModel ?? DEFAULT_MODELS[provider];

  const testReq: AiRequest = {
    prompt: 'Reply with exactly one word: OK',
    temperature: 0,
    maxTokens: 10,
    systemPrompt: 'You are a test oracle. Respond only with "OK".',
  };

  let result: AiResult;

  switch (provider) {
    case 'gemini':
      if (!settings.geminiApiKey) return { ok: false, error: 'No Gemini API key configured.' };
      result = await callGemini(testReq, settings.geminiApiKey, model);
      break;
    case 'openai':
      if (!settings.openAiKey) return { ok: false, error: 'No OpenAI API key configured.' };
      result = await callOpenAiCompat(testReq, settings.openAiKey, model, 'https://api.openai.com/v1', 'OpenAI');
      break;
    case 'openrouter':
      if (!settings.openrouterApiKey) return { ok: false, error: 'No OpenRouter API key configured.' };
      result = await callOpenAiCompat(testReq, settings.openrouterApiKey, model, 'https://openrouter.ai/api/v1', 'OpenRouter', {
        'HTTP-Referer': 'https://creativelead.app', 'X-Title': 'CreativeLead',
      });
      break;
    case 'groq':
      if (!settings.groqApiKey) return { ok: false, error: 'No Groq API key configured.' };
      result = await callOpenAiCompat(testReq, settings.groqApiKey, model, 'https://api.groq.com/openai/v1', 'Groq');
      break;
    case 'anthropic':
      if (!settings.anthropicApiKey) return { ok: false, error: 'No Anthropic API key configured.' };
      result = await callAnthropic(testReq, settings.anthropicApiKey, model);
      break;
    case 'mistral':
      if (!settings.mistralApiKey) return { ok: false, error: 'No Mistral API key configured.' };
      result = await callOpenAiCompat(testReq, settings.mistralApiKey, model, 'https://api.mistral.ai/v1', 'Mistral');
      break;
    case 'cohere':
      if (!settings.cohereApiKey) return { ok: false, error: 'No Cohere API key configured.' };
      result = await callOpenAiCompat(testReq, settings.cohereApiKey, model, 'https://api.cohere.com/compatibility/v1', 'Cohere');
      break;
    case 'custom': {
      if (!settings.customApiKey) return { ok: false, error: 'No custom API key configured.' };
      if (!settings.customApiBase) return { ok: false, error: 'No custom base URL configured.' };
      const cm = settings.customModel || model;
      result = await callOpenAiCompat(testReq, settings.customApiKey, cm, settings.customApiBase.replace(/\/$/, ''), 'Custom');
      break;
    }
    default:
      return { ok: false, error: 'Unknown provider.' };
  }

  if (!result.ok) return { ok: false, error: result.error.message };

  const cleaned = result.text.trim().toLowerCase();
  if (cleaned.startsWith('ok') || cleaned.includes('ok')) {
    return { ok: true, model };
  }
  // Accept any non-empty response as success (some models don't literally say "OK")
  if (result.text.trim().length > 0) {
    return { ok: true, model };
  }
  return { ok: false, error: `Unexpected response: "${result.text.slice(0, 60)}" — check your API key.` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createAiError(code: AiError['code'], message: string): AiError {
  return { code, message };
}

function missingKey(providerName: string, url: string): AiResult {
  return {
    ok: false,
    error: createAiError('NO_KEY',
      `No ${providerName} API key configured. Go to Settings → AI Provider and add your key. Get one at ${url}`),
  };
}