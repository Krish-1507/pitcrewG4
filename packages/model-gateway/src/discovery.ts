import { z } from 'zod';
import type { ProviderConfig } from '@pitcrew/protocol';
import { PitCrewError } from '@pitcrew/protocol';
import { runProcess } from '@pitcrew/sandbox';
import { assertNoSecrets } from '@pitcrew/observability';
import { providerSecrets } from './index.js';

export interface ProviderDiscovery {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  models: string[];
  message: string;
}
export async function discoverProvider(
  config: ProviderConfig,
  cwd: string,
  signal: AbortSignal,
): Promise<ProviderDiscovery> {
  try {
    if (config.type === 'codex') {
      const result = await runProcess(
        { executable: config.executable, args: ['--version'] },
        { cwd, signal, timeoutMs: 10000, maxOutputBytes: 8192 },
      );
      return {
        status: result.exitCode === 0 ? 'AVAILABLE' : 'UNAVAILABLE',
        models: [],
        message:
          result.exitCode === 0
            ? 'Official Codex CLI detected; authentication is checked when a task runs.'
            : 'CLI detection failed.',
      };
    }
    const url = new URL(
      config.baseUrl.replace(/\/$/, '') +
        (config.type === 'ollama' ? '/api/tags' : '/models'),
    );
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
      throw new PitCrewError('CONFIGURATION', 'Unsafe provider URL.');
    const secret = providerSecrets(config)[0];
    const response = await fetch(url, {
      redirect: 'error',
      headers: secret ? { authorization: 'Bearer ' + secret } : {},
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok || !response.body) throw new Error('unavailable');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 1048576) {
        await reader.cancel();
        throw new Error('limit');
      }
      chunks.push(part.value);
    }
    const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const models =
      config.type === 'ollama'
        ? z
            .object({
              models: z
                .array(z.object({ name: z.string().max(200) }))
                .max(10000),
            })
            .parse(raw)
            .models.map((m) => m.name)
        : z
            .object({
              data: z.array(z.object({ id: z.string().max(200) })).max(10000),
            })
            .parse(raw)
            .data.map((m) => m.id);
    assertNoSecrets(JSON.stringify(models), secret ? [secret] : []);
    return {
      status: 'AVAILABLE',
      models,
      message: 'Model catalogue received from the configured endpoint.',
    };
  } catch {
    return {
      status: 'UNAVAILABLE',
      models: [],
      message:
        'Provider discovery unavailable. Check endpoint, credentials or installed CLI.',
    };
  }
}
