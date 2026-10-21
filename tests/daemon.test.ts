import { expect, it } from 'vitest';
import { cp, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDaemon } from '../apps/daemon/src/index.js';
import { configSchema } from '../packages/protocol/src/index.js';
import {
  createCandidate,
  disposeCandidate,
  fingerprint,
  git,
  inspectBaseline,
} from '../packages/candidate-manager/src/index.js';

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
            origin: new URL(daemon.url).origin,
          },
          body: JSON.stringify({ repo: '.', request: 'fix', grant: 'all' }),
        })
      ).status,
    ).toBe(400);
    const ui = await fetch(daemon.url + '/');
    expect(ui.status).toBe(200);
    expect(await ui.text()).toContain('PitCrew Mission Control');
    expect((await fetch(daemon.url + '/ui/app.js')).status).toBe(200);
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

it('runs controlled blindspot mutations only inside a disposable worktree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-blindspot-repo-'));
  await cp(join(process.cwd(), 'fixtures', 'blindspot-weak-suite'), root, {
    recursive: true,
  });
  const signal = AbortSignal.timeout(60000);
  await git(root, ['init'], signal);
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=PitCrew daemon',
      '-c',
      'user.email=daemon@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Weak verification baseline',
    ],
    signal,
  );
  const daemon = await startDaemon(
    await mkdtemp(join(tmpdir(), 'pitcrew-blindspot-state-')),
    configSchema.parse({
      provider: { type: 'codex', executable: 'missing-codex' },
      execution: { allowReducedIsolation: true },
      referee: { executable: 'missing-referee' },
      test: { executable: 'node', args: ['--test', 'test/weak.test.js'] },
    }),
  );
  try {
    const response = await fetch(daemon.url + '/v1/blindspot', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + daemon.token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repo: root,
        mutations: [
          {
            id: 'drop-anonymous-check',
            category: 'authz',
            description: 'Remove the anonymous caller rejection.',
            path: 'src/auth.js',
            find: "if (!user) throw new Error('unauthorized');",
            replace: "if (false) throw new Error('unauthorized');",
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    const report = (await response.json()) as {
      verificationDebt: string[];
      findings: { outcome: string }[];
    };
    expect(report.findings[0]?.outcome).toBe('survived');
    expect(report.verificationDebt).toEqual(['drop-anonymous-check']);
    let leftover = await git(root, ['worktree', 'list', '--porcelain'], signal);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (leftover.trim().split(/\r?\n\r?\n/).length === 1) break;
      await new Promise((done) => setTimeout(done, 100));
      leftover = await git(root, ['worktree', 'list', '--porcelain'], signal);
    }
    expect(leftover.trim().split(/\r?\n\r?\n/)).toHaveLength(1);
  } finally {
    await daemon.close();
  }
});

it('keeps candidate work after a daemon restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-restart-repo-'));
  await cp(join(process.cwd(), 'fixtures', 'failing-test'), root, {
    recursive: true,
  });
  const state = await mkdtemp(join(tmpdir(), 'pitcrew-restart-state-'));
  const signal = AbortSignal.timeout(60000);
  await git(root, ['init'], signal);
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=PitCrew restart',
      '-c',
      'user.email=restart@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Restart baseline',
    ],
    signal,
  );
  const baseline = await inspectBaseline(root, signal);
  const candidate = await createCandidate(root, state, baseline.head, signal);
  const digest = await fingerprint(candidate.root, signal);
  const config = configSchema.parse({
    provider: { type: 'codex', executable: 'missing-codex' },
    execution: {},
    referee: { executable: 'missing-referee' },
  });
  const first = await startDaemon(state, config);
  await first.close();
  const second = await startDaemon(state, config);
  try {
    expect(existsSync(candidate.root)).toBe(true);
    expect(await fingerprint(candidate.root, signal)).toBe(digest);
    expect(
      (await git(root, ['worktree', 'list', '--porcelain'], signal)).includes(
        candidate.id,
      ),
    ).toBe(true);
  } finally {
    await second.close();
    await disposeCandidate(root, candidate, signal);
  }
});
