import { readFile, realpath } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { configSchema, PitCrewError } from '@pitcrew/protocol';
import type { RuntimeConfig } from '@pitcrew/protocol';
export async function loadConfig(path: string): Promise<RuntimeConfig> {
  const text = await readFile(await realpath(path), 'utf8');
  if (Buffer.byteLength(text) > 65536)
    throw new PitCrewError('CONFIGURATION', 'Configuration exceeds 64 KiB.');
  let raw: unknown;
  try {
    const doc = parseDocument(text, { uniqueKeys: true, schema: 'core' });
    if (doc.errors.length) throw new Error('invalid');
    raw = doc.toJS({ maxAliasCount: 0 });
  } catch {
    throw new PitCrewError(
      'CONFIGURATION',
      'Invalid JSON/YAML configuration; aliases and duplicate keys are not supported.',
    );
  }
  return validateConfig(raw);
}
export function validateConfig(raw: unknown): RuntimeConfig {
  const config = configSchema.parse(raw);
  for (const provider of [
    config.provider,
    ...(config.routing?.providers.map((p) => p.provider) ?? []),
  ]) {
    if (provider.type === 'codex') continue;
    if (provider.secretRef && provider.apiKeyEnv)
      throw new PitCrewError(
        'CONFIGURATION',
        'Choose one credential reference.',
      );
    const url = new URL(provider.baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    )
      throw new PitCrewError(
        'CONFIGURATION',
        'Provider requires HTTPS or explicit loopback HTTP, with no embedded credentials.',
      );
  }
  if (config.routing)
    for (const route of config.routing.providers) {
      if (
        route.local &&
        (route.provider.type === 'codex' ||
          !['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(route.provider.baseUrl).hostname,
          ))
      )
        throw new PitCrewError(
          'CONFIGURATION',
          'Local routes must use an explicit loopback model endpoint.',
        );
    }
  return config;
}
