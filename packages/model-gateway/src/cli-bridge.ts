import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { PitCrewError } from '@pitcrew/protocol';
import type { ProviderConfig } from '@pitcrew/protocol';
import { cleanEnvironment, runProcess } from '@pitcrew/sandbox';
import type { ModelInput } from './index.js';

export interface CliBridge {
  readonly id: string;
  capabilities(): readonly (
    | 'structured-proposal'
    | 'read-only-sandbox'
    | 'authenticated-session'
  )[];
  detect(
    executable: string,
    cwd: string,
    signal: AbortSignal,
  ): Promise<boolean>;
  run(
    config: Extract<ProviderConfig, { type: 'codex' }>,
    input: ModelInput,
    outputSchema: Record<string, unknown>,
  ): Promise<string>;
}
export const codexBridge: CliBridge = {
  id: 'codex',
  capabilities: () => [
    'structured-proposal',
    'read-only-sandbox',
    'authenticated-session',
  ],
  async detect(executable, cwd, signal) {
    try {
      return (
        (
          await runProcess(
            { executable, args: ['--version'] },
            { cwd, signal, timeoutMs: 10000, maxOutputBytes: 8192 },
          )
        ).exitCode === 0
      );
    } catch {
      return false;
    }
  },
  async run(config, input, outputSchema) {
    const prompt = input.context;
    await mkdir(input.directory, { recursive: true });
    const schemaPath = join(input.directory, 'proposal-schema.json');
    await writeFile(schemaPath, JSON.stringify(outputSchema), 'utf8');
    const env = cleanEnvironment();
    // The official CLI resolves its own authenticated session. No token files are read.
    for (const key of [
      'USERPROFILE',
      'HOME',
      'APPDATA',
      'LOCALAPPDATA',
      'CODEX_HOME',
    ])
      if (process.env[key]) env[key] = process.env[key];
    const args = [
      'exec',
      '--ignore-user-config',
      '--ignore-rules',
      '--ephemeral',
      '--sandbox',
      'read-only',
      '--skip-git-repo-check',
      '--disable',
      'shell_tool',
      '--disable',
      'apps',
      '--color',
      'never',
      '--json',
      '--output-schema',
      schemaPath,
      '--cd',
      input.directory,
    ];
    if (config.model) args.push('--model', config.model);
    args.push('-');
    const result = await runProcess(
      { executable: config.executable, args },
      {
        cwd: input.directory,
        signal: input.signal,
        timeoutMs: input.timeoutMs,
        input: prompt,
        env,
        maxOutputBytes: 2 * 1024 * 1024,
      },
    ).catch((error: unknown) => {
      if (
        error instanceof PitCrewError &&
        ['CANCELLED', 'TIMEOUT'].includes(error.code)
      )
        throw error;
      throw new PitCrewError(
        'PROVIDER_UNAVAILABLE',
        'Configured Codex executable could not be started.',
      );
    });
    if (result.exitCode !== 0)
      throw new PitCrewError(
        'PROVIDER_UNAVAILABLE',
        'Codex CLI failed. Verify its authenticated session and network access using the official CLI.',
      );
    const event = z.object({
      type: z.string(),
      item: z
        .object({ type: z.string(), text: z.string().optional() })
        .optional(),
    });
    const messages: string[] = [];
    for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
      const parsed = event.safeParse(JSON.parse(line));
      if (
        parsed.success &&
        parsed.data.type === 'item.completed' &&
        parsed.data.item?.type === 'agent_message' &&
        parsed.data.item.text
      )
        messages.push(parsed.data.item.text);
    }
    return messages.at(-1) ?? '';
  },
};
