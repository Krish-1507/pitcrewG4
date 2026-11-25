import type { ProviderConfig } from '@pitcrew/protocol';

/**
 * Named provider presets. Each preset maps to a real wire protocol:
 * - 'ollama' uses Ollama's native /api/chat endpoint.
 * - 'anthropic' uses the native Anthropic Messages API.
 * - every other preset uses the OpenAI-compatible chat-completions protocol
 *   (including Gemini's OpenAI-compatible endpoint), so breadth stays cheap.
 * A user who needs something else picks 'custom' and supplies a baseUrl.
 * Presets never embed credentials; keys travel by env reference or keychain.
 */
export interface ProviderPreset {
  id: string;
  label: string;
  type: ProviderConfig['type'];
  baseUrl?: string;
  requiresKey: boolean;
  keyEnv: string | null;
  defaultModel: string;
  local: boolean;
  note: string;
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'codex',
    label: 'Codex CLI (uses your existing Codex login)',
    type: 'codex',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'gpt-5-codex',
    local: false,
    note: 'PitCrew drives the installed, already-authenticated Codex CLI.',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT API)',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    local: false,
    note: 'Any OpenAI API key. ChatGPT Plus subscriptions do not cover the API.',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic API)',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresKey: true,
    keyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-5',
    local: false,
    note: 'Native Anthropic Messages API adapter.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini (OpenAI-compatible endpoint)',
    type: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    requiresKey: true,
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    local: false,
    note: 'Uses Gemini AI Studio keys.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (hundreds of models, one key)',
    type: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'openrouter/auto',
    local: false,
    note: 'Prefix models with vendor, e.g. anthropic/claude-sonnet-4-5.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresKey: true,
    keyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    local: false,
    note: '',
  },
  {
    id: 'groq',
    label: 'Groq',
    type: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    keyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    local: false,
    note: '',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    type: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresKey: true,
    keyEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    local: false,
    note: '',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    type: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    requiresKey: true,
    keyEnv: 'XAI_API_KEY',
    defaultModel: 'grok-4-fast',
    local: false,
    note: '',
  },
  {
    id: 'together',
    label: 'Together AI',
    type: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    requiresKey: true,
    keyEnv: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    local: false,
    note: '',
  },
  {
    id: 'freellmapi',
    label: 'FreeLLMAPI (explicit OpenAI-compatible endpoint)',
    type: 'freellmapi',
    baseUrl: 'http://127.0.0.1:8000/v1',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'free-model',
    local: false,
    note: 'No hosted vendor default; confirm the endpoint yourself.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'llama3.1',
    local: true,
    note: 'Runs fully local; discovery lists models you already pulled.',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local server)',
    type: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:1234/v1',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'local-model',
    local: true,
    note: 'Start the LM Studio local server, then discover models.',
  },
  {
    id: 'llamacpp',
    label: 'llama.cpp (llama-server)',
    type: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:8080/v1',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'local-model',
    local: true,
    note: 'Start llama-server with --embedding disabled and a chat model.',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible endpoint',
    type: 'openai-compatible',
    requiresKey: false,
    keyEnv: null,
    defaultModel: 'local-model',
    local: false,
    note: 'Any HTTPS endpoint (or loopback HTTP) speaking /chat/completions.',
  },
];

export function providerPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
}

export function providerConfigFromPreset(
  preset: ProviderPreset,
  overrides: { model?: string; apiKeyEnv?: string; baseUrl?: string },
): ProviderConfig {
  if (preset.type === 'codex')
    return {
      type: 'codex',
      executable: process.env.PITCREW_CODEX_EXECUTABLE ?? 'codex',
      ...(overrides.model ? { model: overrides.model } : {}),
    };
  const baseUrl = overrides.baseUrl ?? preset.baseUrl;
  if (!baseUrl) throw new Error('Preset requires a base URL: ' + preset.id);
  return {
    type: preset.type,
    baseUrl,
    model: overrides.model ?? preset.defaultModel,
    ...(overrides.apiKeyEnv ? { apiKeyEnv: overrides.apiKeyEnv } : {}),
  };
}
