import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDaemon } from '../apps/daemon/src/index.js';
import {
  configSchema,
  searchSourceSchema,
} from '../packages/protocol/src/index.js';
import { git } from '../packages/candidate-manager/src/index.js';
import { answer, webSearch } from '../packages/model-gateway/src/index.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function listen(
  server: ReturnType<typeof createServer>,
): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('address');
  return 'http://127.0.0.1:' + address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function modelServer(): Promise<{
  url: string;
  bodies: unknown[];
  close: () => Promise<void>;
}> {
  const bodies: unknown[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ answer: 'Draft answer.' }),
            },
          },
        ],
      }),
    );
  });
  const url = await listen(server);
  return { url, bodies, close: () => close(server) };
}

async function searchServer(): Promise<{
  url: string;
  queries: string[];
  close: () => Promise<void>;
}> {
  const queries: string[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    queries.push(url.searchParams.get('q') ?? '');
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        results: [
          {
            title: 'One',
            url: 'https://example.test/one',
            content: 'First result.',
          },
          {
            title: 'Duplicate',
            url: 'https://example.test/one',
            content: 'Dropped duplicate.',
          },
          {
            title: 'Unsafe',
            url: 'javascript:alert(1)',
            content: 'Dropped scheme.',
          },
          {
            title: 'Two',
            url: 'https://example.test/two',
            content: 'Second result.',
          },
        ],
      }),
    );
  });
  const url = await listen(server);
  return { url, queries, close: () => close(server) };
}

it('answers as a bounded draft and includes the assistant preset in the model prompt', async () => {
  const model = await modelServer();
  try {
    const result = await answer(
      {
        type: 'openai-compatible',
        baseUrl: model.url,
        model: 'fixture',
      },
      {
        request: 'Summarize the supplied text.',
        context: JSON.stringify({ text: 'Alpha beta' }),
        directory: tmpdir(),
        signal: AbortSignal.timeout(5000),
        timeoutMs: 5000,
        assistant: 'Use three bullets.',
      },
    );
    expect(result.answer).toBe('Draft answer.');
    expect(result.provider).toBe('openai-compatible');
    const sent = JSON.stringify(model.bodies[0]);
    expect(sent).toContain('ASSISTANT PRESET');
    expect(sent).toContain('Use three bullets.');
  } finally {
    await model.close();
  }
});

it('uses an explicit SearXNG endpoint, normalizes the query, and drops unsafe or duplicate results', async () => {
  const search = await searchServer();
  try {
    vi.stubEnv('PITCREW_SEARXNG_URL', search.url);
    vi.stubEnv('PITCREW_BRAVE_SEARCH_API_KEY', '');
    const result = await webSearch(
      '  local   query ',
      AbortSignal.timeout(5000),
    );
    expect(result.provider).toBe('searxng');
    expect(result.results.map((source) => source.title)).toEqual([
      'One',
      'Two',
    ]);
    expect(search.queries).toEqual(['local query']);
  } finally {
    await search.close();
  }
});

it('rejects search sources with unsafe schemes or embedded credentials', () => {
  const base = { title: 'Example', description: 'Snippet' };
  expect(
    searchSourceSchema.safeParse({
      ...base,
      url: 'javascript:alert(1)',
    }).success,
  ).toBe(false);
  expect(
    searchSourceSchema.safeParse({
      ...base,
      url: 'https://user:pass@example.test/',
    }).success,
  ).toBe(false);
  expect(
    searchSourceSchema.safeParse({
      ...base,
      url: 'https://example.test/path',
    }).success,
  ).toBe(true);
});

it('refuses disabled, credential-bearing, and non-loopback HTTP SearXNG configuration', async () => {
  vi.stubEnv('PITCREW_SEARXNG_URL', '');
  vi.stubEnv('PITCREW_BRAVE_SEARCH_API_KEY', '');
  await expect(
    webSearch('query', AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
  vi.stubEnv('PITCREW_SEARXNG_URL', 'https://user:pass@example.test');
  await expect(
    webSearch('query', AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ code: 'CONFIGURATION' });
  vi.stubEnv('PITCREW_SEARXNG_URL', 'http://example.test');
  await expect(
    webSearch('query', AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ code: 'CONFIGURATION' });
});

it('persists notes and assistants, rejects project assistants in Quick Assistant, and drafts from global presets', async () => {
  vi.stubEnv('PITCREW_SEARXNG_URL', '');
  vi.stubEnv('PITCREW_BRAVE_SEARCH_API_KEY', '');
  const model = await modelServer();
  const search = await searchServer();
  const daemon = await startDaemon(
    await mkdtemp(join(tmpdir(), 'pitcrew-assistant-state-')),
    configSchema.parse({
      provider: {
        type: 'openai-compatible',
        baseUrl: model.url,
        model: 'fixture',
      },
      execution: {},
      referee: { executable: 'missing-referee' },
    }),
  );
  async function api(
    path: string,
    body?: unknown,
    method?: 'GET' | 'POST' | 'DELETE',
  ): Promise<{ status: number; body: unknown }> {
    const response = await fetch(daemon.url + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        authorization: 'Bearer ' + daemon.token,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }
  try {
    expect((await api('/v1/research')).body).toEqual({
      configured: false,
      provider: null,
    });
    vi.stubEnv('PITCREW_SEARXNG_URL', search.url);
    expect(
      (await api('/v1/research', { query: 'local facts' }, 'POST')).body,
    ).toMatchObject({ provider: 'searxng' });
    expect(search.queries).toEqual(['local facts']);

    const savedNote = await api('/v1/memory', {
      text: 'Use pnpm.',
      scope: 'global',
    });
    expect(savedNote.status).toBe(201);
    const noteId = (savedNote.body as { note: { id: string } }).note.id;
    expect((await api('/v1/memory')).body).toMatchObject({
      notes: [{ text: 'Use pnpm.', scope: 'global' }],
    });

    const savedAssistant = await api('/v1/assistants', {
      name: 'Terse',
      prompt: 'Use short bullets.',
      scope: 'global',
    });
    expect(savedAssistant.status).toBe(201);
    const assistantId = (savedAssistant.body as { assistant: { id: string } })
      .assistant.id;

    const quick = await api('/v1/quick', {
      text: 'Alpha beta',
      preset: 'summarize',
      assistantId,
    });
    expect(quick.status).toBe(200);
    expect(quick.body).toMatchObject({
      answer: 'Draft answer.',
      provider: 'openai-compatible',
      web: false,
      sources: [],
    });
    const sent = JSON.stringify(model.bodies.at(-1));
    expect(sent).toContain('Summarize the supplied text');
    expect(sent).toContain('Alpha beta');
    expect(sent).toContain('Use short bullets.');

    const webQuick = await api('/v1/quick', {
      text: 'Alpha beta',
      preset: 'summarize',
      web: true,
    });
    expect(webQuick.status).toBe(200);
    expect(webQuick.body).toMatchObject({ web: true });
    expect((webQuick.body as { sources: unknown[] }).sources).toHaveLength(2);
    expect(search.queries.at(-1)).toBe('Alpha beta');
    expect(JSON.stringify(model.bodies.at(-1))).toContain('First result.');

    expect(
      (await api('/v1/memory/' + noteId, undefined, 'DELETE')).body,
    ).toEqual({ deleted: true });
    expect(
      (await api('/v1/assistants/' + assistantId, undefined, 'DELETE')).body,
    ).toEqual({ deleted: true });

    const repo = await mkdtemp(join(tmpdir(), 'pitcrew-project-'));
    await writeFile(join(repo, 'README.md'), '# Project\n');
    const signal = AbortSignal.timeout(30000);
    await git(repo, ['init'], signal);
    await git(repo, ['add', '.'], signal);
    await git(
      repo,
      [
        '-c',
        'user.name=PitCrew test',
        '-c',
        'user.email=test@localhost',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-m',
        'Baseline',
      ],
      signal,
    );
    const opened = await api('/v1/projects/open', { path: repo });
    expect(opened.status).toBe(200);
    const projectId = (opened.body as { project: { id: string } }).project.id;
    const projectNote = await api('/v1/memory', {
      text: 'Project convention.',
      scope: 'project',
      project_id: projectId,
    });
    expect(projectNote.status).toBe(201);
    expect(
      (await api('/v1/memory?project_id=' + projectId)).body,
    ).toMatchObject({
      notes: [{ text: 'Project convention.', scope: 'project' }],
    });
    const projectAssistant = await api('/v1/assistants', {
      name: 'Project only',
      prompt: 'Use local conventions.',
      scope: 'project',
      project_id: projectId,
    });
    expect(projectAssistant.status).toBe(201);
    const calls = model.bodies.length;
    const rejected = await api('/v1/quick', {
      text: 'Alpha beta',
      preset: 'explain',
      assistantId: (projectAssistant.body as { assistant: { id: string } })
        .assistant.id,
    });
    expect(rejected.status).toBe(400);
    expect(model.bodies.length).toBe(calls);
  } finally {
    await daemon.close();
    await model.close();
    await search.close();
  }
});
