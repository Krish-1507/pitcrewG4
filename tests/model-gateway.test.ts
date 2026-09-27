import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configSchema } from '../packages/protocol/src/index.js';
import {
  propose,
  selectRoute,
  providerSecrets,
} from '../packages/model-gateway/src/index.js';
import { loadConfig } from '../packages/config/src/index.js';

const base = {
  provider: { type: 'codex', executable: 'codex' },
  execution: {},
  referee: { executable: 'pitstop' },
};
const request = {
  role: 'implementer',
  risk: 'low' as const,
  contextChars: 100,
  tools: false,
  priorFailures: new Set<string>(),
};
const route = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  provider: {
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'local',
  },
  roles: ['implementer'],
  maxContextChars: 10000,
  local: true,
  ...extra,
});
it('routes only configured eligible providers and preserves unknown cost', () => {
  const config = configSchema.parse({
    ...base,
    routing: { profile: 'balanced', providers: [route('one'), route('two')] },
  });
  expect(selectRoute(config, request)).toMatchObject({
    id: 'one',
    estimatedCostUsd: null,
  });
  expect(
    selectRoute(config, { ...request, priorFailures: new Set(['one']) }).id,
  ).toBe('two');
  expect(() =>
    selectRoute(config, { ...request, priorFailures: new Set(['one', 'two']) }),
  ).toThrow('No configured route');
  expect(() => selectRoute(config, { ...request, role: 'security' })).toThrow();
  expect(() => selectRoute(config, { ...request, risk: 'high' })).toThrow();
  expect(() => selectRoute(config, { ...request, tools: true })).toThrow();
  expect(() =>
    selectRoute(config, { ...request, contextChars: 10001 }),
  ).toThrow();
});
it('enforces cost ceiling before any model call', () => {
  const config = configSchema.parse({
    ...base,
    budget: { maxCostUsdPerCall: 0.1 },
    routing: {
      profile: 'economy',
      providers: [
        route('unknown'),
        route('expensive', { estimatedCostUsd: 0.2 }),
        route('affordable', { estimatedCostUsd: 0.05 }),
      ],
    },
  });
  expect(selectRoute(config, request).id).toBe('affordable');
  expect(() =>
    selectRoute(config, { ...request, priorFailures: new Set(['affordable']) }),
  ).toThrow();
  expect(() =>
    selectRoute(
      configSchema.parse({ ...base, budget: { maxCostUsdPerCall: 1 } }),
      request,
    ),
  ).toThrow('Unknown provider cost');
});
it('applies local, economy and deep preferences without adding routes', () => {
  const providers = [
    route('small', { estimatedCostUsd: 0.01 }),
    route('large', { maxContextChars: 20000, estimatedCostUsd: 0.1 }),
  ];
  expect(
    selectRoute(
      configSchema.parse({
        ...base,
        routing: { profile: 'economy', providers },
      }),
      request,
    ).id,
  ).toBe('small');
  expect(
    selectRoute(
      configSchema.parse({ ...base, routing: { profile: 'deep', providers } }),
      request,
    ).id,
  ).toBe('large');
  expect(() =>
    selectRoute(
      configSchema.parse({
        ...base,
        routing: {
          profile: 'local',
          providers: [route('remote', { local: false })],
        },
      }),
      request,
    ),
  ).toThrow();
  expect(() =>
    configSchema.parse({
      ...base,
      routing: {
        profile: 'balanced',
        providers: [route('same'), route('same')],
      },
    }),
  ).toThrow();
});
it('loads strict YAML and rejects duplicate keys, aliases, raw keys and unsafe fallback URLs', async () => {
  const path = join(
    await mkdtemp(join(tmpdir(), 'pitcrew-config-')),
    'config.yaml',
  );
  await writeFile(
    path,
    'provider:\n  type: codex\n  executable: codex\nexecution: {}\nreferee:\n  executable: pitstop\n',
  );
  expect((await loadConfig(path)).provider.type).toBe('codex');
  for (const text of [
    'provider: {}\nprovider: {}',
    'a: &a {x: y}\nb: *a',
    JSON.stringify({
      ...base,
      provider: {
        type: 'openai-compatible',
        baseUrl: 'https://example.test/v1',
        model: 'm',
        apiKey: 'forbidden',
      },
    }),
    JSON.stringify({
      ...base,
      routing: {
        profile: 'balanced',
        providers: [
          route('unsafe', {
            provider: {
              type: 'openai-compatible',
              baseUrl: 'http://example.test',
              model: 'm',
            },
          }),
        ],
      },
    }),
    JSON.stringify({
      ...base,
      routing: {
        profile: 'local',
        providers: [
          route('fake-local', {
            provider: { type: 'codex', executable: 'codex' },
          }),
        ],
      },
    }),
  ]) {
    await writeFile(path, text);
    await expect(loadConfig(path)).rejects.toThrow();
  }
});
it('does not accept competing credential references or absent environment credentials', () => {
  expect(() =>
    providerSecrets({
      type: 'openai-compatible',
      baseUrl: 'https://example.test',
      model: 'm',
      apiKeyEnv: 'PITCREW_TEST_MISSING_KEY',
    }),
  ).toThrow('not available');
  expect(() =>
    providerSecrets({
      type: 'openai-compatible',
      baseUrl: 'https://example.test',
      model: 'm',
      apiKeyEnv: 'ANY',
      secretRef: 'keychain:pitcrew/prov_123',
    }),
  ).toThrow('Choose one');
});
for (const type of ['openai-compatible', 'freellmapi', 'ollama'] as const) {
  it(
    'validates the ' +
      type +
      ' HTTP protocol without claiming a live model acceptance',
    async () => {
      const proposal = {
        summary: 'Protocol fixture',
        edits: [{ path: 'src/a.ts', before: 'a', after: 'b' }],
      };
      const received: { url?: string; body?: unknown } = {};
      const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        received.url = req.url ?? '';
        received.body = JSON.parse(Buffer.concat(chunks).toString());
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify(
            type === 'ollama'
              ? { message: { content: JSON.stringify(proposal) }, done: true }
              : {
                  choices: [{ message: { content: JSON.stringify(proposal) } }],
                },
          ),
        );
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      try {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('address');
        const result = await propose(
          {
            type,
            baseUrl: 'http://127.0.0.1:' + addr.port,
            model: 'protocol-fixture',
          },
          {
            request: 'fix',
            context: 'source',
            directory: tmpdir(),
            signal: AbortSignal.timeout(5000),
            timeoutMs: 5000,
          },
        );
        expect(result.proposal).toEqual(proposal);
        expect(result.costUsd).toBeNull();
        expect(received.url).toBe(
          type === 'ollama' ? '/api/chat' : '/chat/completions',
        );
        expect(received.body).toMatchObject(
          type === 'ollama'
            ? { stream: false, format: { type: 'object' } }
            : { response_format: { type: 'json_object' } },
        );
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );
}
it('classifies malformed transport replies and rate limits as provider failures', async () => {
  let mode = 0;
  const server = createServer((_req, res) => {
    if (mode === 0) {
      res.statusCode = 429;
      res.end('not echoed');
    } else if (mode === 1) res.end('malformed');
    else {
      res.statusCode = 302;
      res.setHeader('location', 'http://example.test/');
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('address');
    const config = {
      type: 'openai-compatible' as const,
      baseUrl: 'http://127.0.0.1:' + addr.port,
      model: 'fixture',
    };
    const input = {
      request: 'fix',
      context: 'source',
      directory: tmpdir(),
      signal: AbortSignal.timeout(5000),
      timeoutMs: 5000,
    };
    await expect(propose(config, input)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    mode = 1;
    await expect(propose(config, input)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    mode = 2;
    await expect(propose(config, input)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
