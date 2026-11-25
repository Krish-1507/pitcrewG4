import { expect, it } from 'vitest';
import {
  PROVIDER_PRESETS,
  providerConfigFromPreset,
  providerPreset,
} from '../packages/config/src/presets.js';
import {
  parseStructuredJson,
  providerSecrets,
} from '../packages/model-gateway/src/index.js';
import { providerSchema } from '../packages/protocol/src/index.js';

it('exposes named presets for every supported wire protocol plus a custom path', () => {
  const ids = PROVIDER_PRESETS.map((preset) => preset.id);
  for (const required of [
    'codex',
    'openai',
    'anthropic',
    'gemini',
    'openrouter',
    'deepseek',
    'groq',
    'mistral',
    'xai',
    'together',
    'freellmapi',
    'ollama',
    'lmstudio',
    'llamacpp',
    'custom',
  ])
    expect(ids).toContain(required);
  expect(new Set(ids).size).toBe(ids.length);
  const local = providerPreset('ollama');
  expect(local?.local).toBe(true);
  expect(local?.requiresKey).toBe(false);
  const remote = providerPreset('openai');
  expect(remote?.baseUrl?.startsWith('https://')).toBe(true);
  expect(remote?.keyEnv).toBe('OPENAI_API_KEY');
});

it('maps presets onto validated provider configurations without embedding secrets', () => {
  const codex = providerPreset('codex')!;
  const codexConfig = providerConfigFromPreset(codex, { model: 'test-model' });
  expect(codexConfig).toEqual({
    type: 'codex',
    executable: 'codex',
    model: 'test-model',
  });

  const openai = providerPreset('openai')!;
  const openaiConfig = providerConfigFromPreset(openai, {
    apiKeyEnv: 'OPENAI_API_KEY',
  });
  if (openaiConfig.type === 'codex') throw new Error('preset mapping');
  expect(openaiConfig.baseUrl).toBe('https://api.openai.com/v1');
  expect(providerSchema.safeParse(openaiConfig).success).toBe(true);
  // The env *reference* is configuration; the key value itself must not be.
  expect(JSON.stringify(openaiConfig)).not.toMatch(/sk-|secret|password/i);

  const claude = providerPreset('anthropic')!;
  const claudeConfig = providerConfigFromPreset(claude, {
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  });
  if (claudeConfig.type !== 'anthropic') throw new Error('preset mapping');
  expect(claudeConfig.baseUrl).toBe('https://api.anthropic.com/v1');
  expect(providerSchema.safeParse(claudeConfig).success).toBe(true);

  const lmstudio = providerPreset('lmstudio')!;
  const lmstudioConfig = providerConfigFromPreset(lmstudio, {});
  if (lmstudioConfig.type === 'codex') throw new Error('preset mapping');
  expect(lmstudioConfig.baseUrl).toBe('http://127.0.0.1:1234/v1');
  expect(providerSchema.safeParse(lmstudioConfig).success).toBe(true);

  const custom = providerPreset('custom')!;
  expect(() => providerConfigFromPreset(custom, {})).toThrow(/base URL/i);
  const customConfig = providerConfigFromPreset(custom, {
    baseUrl: 'https://gateway.internal.example/v1',
    model: 'internal-model',
  });
  expect(providerSchema.safeParse(customConfig).success).toBe(true);
});

it('rejects a provider whose key material would be embedded in configuration', () => {
  const claude = providerPreset('anthropic')!;
  const claudeConfig = providerConfigFromPreset(claude, {
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  });
  expect(providerSchema.safeParse(claudeConfig).success).toBe(true);
  expect('apiKey' in claudeConfig).toBe(false);
  expect(() =>
    providerSchema.parse({ ...claudeConfig, apiKey: 'sk-secret' }),
  ).toThrow();
});

it('extracts structured JSON from plain, fenced and prose-wrapped responses', () => {
  expect(parseStructuredJson('{"answer":"a"}')).toEqual({ answer: 'a' });
  expect(parseStructuredJson('```json\n{"answer":"b"}\n```')).toEqual({
    answer: 'b',
  });
  expect(
    parseStructuredJson('Here is the result:\n{"answer":"c"}\nDone.'),
  ).toEqual({ answer: 'c' });
  expect(() => parseStructuredJson('no json here')).toThrow(
    /unparseable structured response/,
  );
});

it('keeps provider secrets out of prompt text and requires a key source', () => {
  expect(providerSecrets({ type: 'codex', executable: 'codex' })).toEqual([]);
  expect(() =>
    providerSecrets({
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-5',
      secretRef: 'keychain:pitcrew/prov_0b52e5c4-9e15-4a2f-8d0f-3ecf0a1b2c3d',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    }),
  ).toThrow(/one credential/);
});
