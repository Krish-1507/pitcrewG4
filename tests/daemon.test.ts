import { expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDaemon } from '../apps/daemon/src/index.js';
import { configSchema } from '../packages/protocol/src/index.js';

it('authenticates loopback API and rejects browser origins and extra mutation fields', async () => {
  const config = configSchema.parse({
    provider: { type: 'codex', executable: 'missing-codex' },
    execution: {},
    referee: { executable: 'missing-referee' },
  });
  const daemon = await startDaemon(
    await mkdtemp(join(tmpdir(), 'pitcrew-api-')),
    config,
  );
  try {
    expect((await fetch(daemon.url + '/v1/health')).status).toBe(401);
    expect(
      (
        await fetch(daemon.url + '/v1/health', {
          headers: {
            authorization: 'Bearer ' + daemon.token,
            origin: 'https://evil.example',
          },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(daemon.url + '/v1/health', {
          headers: { authorization: 'Bearer ' + daemon.token },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(daemon.url + '/v1/missions', {
          method: 'POST',
          headers: {
            authorization: 'Bearer ' + daemon.token,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ repo: '.', request: 'fix', grant: 'all' }),
        })
      ).status,
    ).toBe(400);
  } finally {
    await daemon.close();
  }
});
