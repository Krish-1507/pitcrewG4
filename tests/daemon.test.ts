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

it('persists provider metadata and routing without accepting raw credentials in profiles', async () => {
  const config = configSchema.parse({
    provider: { type: 'codex', executable: 'missing' },
    execution: {},
    referee: { executable: 'missing' },
  });
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-providers-'));
  let daemon = await startDaemon(root, config);
  async function api(path: string, value?: unknown) {
    const response = await fetch(daemon.url + path, {
      method: value === undefined ? 'GET' : 'POST',
      headers: {
        authorization: 'Bearer ' + daemon.token,
        'content-type': 'application/json',
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }
  const provider = {
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'local',
  };
  try {
    expect(
      (await api('/v1/providers', { name: 'Local', config: provider })).status,
    ).toBe(201);
    expect((await api('/v1/providers')).body).toMatchObject({
      providers: [{ name: 'Local', config: provider }],
    });
    expect(
      (
        await api('/v1/model-profiles', {
          profile: 'local',
          providers: [
            {
              id: 'local',
              provider,
              roles: ['implementer'],
              local: true,
              maxContextChars: 10000,
            },
          ],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api('/v1/model-profiles', {
          profile: 'local',
          providers: [
            {
              id: 'bad',
              provider: { ...provider, apiKey: 'plaintext' },
              roles: ['implementer'],
              local: true,
              maxContextChars: 10000,
            },
          ],
        })
      ).status,
    ).toBe(400);
    await daemon.close();
    daemon = await startDaemon(root, config);
    expect((await api('/v1/model-profiles')).body).toMatchObject({
      active: { profile: 'local' },
    });
    expect((await api('/v1/providers')).body).toMatchObject({
      providers: [{ name: 'Local' }],
    });
  } finally {
    await daemon.close();
  }
});
