import { readFile, realpath } from 'node:fs/promises';
import { configSchema, PitCrewError } from '@pitcrew/protocol';
import type { RuntimeConfig } from '@pitcrew/protocol';
export async function loadConfig(path: string): Promise<RuntimeConfig> {
  const config = configSchema.parse(
    JSON.parse(await readFile(await realpath(path), 'utf8')),
  );
  if (config.provider.type === 'openai-compatible') {
    const url = new URL(config.provider.baseUrl);
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
  return config;
}
