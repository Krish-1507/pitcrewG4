import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configSchema } from '../packages/protocol/src/index.js';

it('keeps the competition profile valid and free of secret values', async () => {
  const raw = await readFile(
    join(process.cwd(), 'profiles', 'g4', 'profile.json'),
    'utf8',
  );
  const config = configSchema.parse(JSON.parse(raw));
  expect(config.execution.allowReducedIsolation).toBe(false);
  expect(config.referee.requiredLayers).toEqual([
    'stack',
    'architecture',
    'baseline',
  ]);
  expect(config.routing?.providers.map((provider) => provider.id)).toEqual([
    'competition-implementer',
  ]);
  expect(raw).not.toMatch(/api[_-]?key|secret|token/i);
});
