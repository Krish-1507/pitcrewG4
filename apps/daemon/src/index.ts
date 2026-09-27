import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { EvidenceStore } from '@pitcrew/evidence';
import { startMission } from '@pitcrew/orchestrator';
import { candidateDiff, fingerprint } from '@pitcrew/candidate-manager';
import { indexRepository } from '@pitcrew/repo-intelligence';
import { runProcess } from '@pitcrew/sandbox';
import {
  configuredSecrets,
  providerSecrets,
  discoverProvider,
  storeCredential,
  deleteCredential,
} from '@pitcrew/model-gateway';
import { validateConfig } from '@pitcrew/config';
import { providerSchema, configSchema } from '@pitcrew/protocol';
import type { RuntimeConfig } from '@pitcrew/protocol';

const createSchema = z
  .object({ repo: z.string().min(1), request: z.string().min(1).max(8000) })
  .strict();
export interface Daemon {
  url: string;
  token: string;
  close: () => Promise<void>;
}
export async function startDaemon(
  stateRoot: string,
  config: RuntimeConfig,
): Promise<Daemon> {
  const store = await EvidenceStore.open(stateRoot, configuredSecrets(config));
  const savedRouting = store.routing();
  if (savedRouting)
    config = validateConfig({ ...config, routing: savedRouting });
  for (const secret of configuredSecrets(config)) store.addSecret(secret);
  for (const provider of store.providers()) {
    for (const secret of providerSecrets(provider.config))
      store.addSecret(secret);
  }
  store.recoverInterrupted();
  const token = randomBytes(32).toString('hex');
  const active = new Map<
    string,
    {
      abort: AbortController;
      done: Promise<unknown>;
      control: ReturnType<typeof startMission>['control'];
    }
  >();
  const projects = new Set<string>();
  async function currentMission(id: string) {
    const mission = store.get(id);
    if (mission.state !== 'VERIFIED' || !mission.candidate) return mission;
    const final = mission.events
      .map((item) => item.event)
      .findLast((event) => event.type === 'referee');
    try {
      const digest = await fingerprint(
        mission.candidate.root,
        AbortSignal.timeout(30000),
      );
      if (final?.type === 'referee' && final.digest === digest)
        return { ...mission, evidenceState: 'CURRENT' as const };
    } catch {
      return {
        ...mission,
        state: 'NOT_PROVEN' as const,
        evidenceState: 'UNAVAILABLE' as const,
        message:
          'Historical verdict retained; current candidate evidence is unavailable.',
      };
    }
    return {
      ...mission,
      state: 'NOT_PROVEN' as const,
      evidenceState: 'STALE' as const,
      message:
        'Candidate changed since independent verification. Historical PASS is stale.',
    };
  }

  async function body(req: IncomingMessage): Promise<unknown> {
    let bytes = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      const data = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      bytes += data.length;
      if (bytes > 65536) throw new Error('payload limit');
      chunks.push(data);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  function json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(JSON.stringify(value));
  }
  const server = createServer((req, res) => {
    void route(req, res).catch(() => {
      if (!res.headersSent)
        json(res, 400, {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request or unavailable resource.',
          },
        });
      else res.end();
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  async function route(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = req.headers.authorization ?? '';
    const expected = 'Bearer ' + token;
    if (
      req.headers.origin ||
      !['127.0.0.1', '::ffff:127.0.0.1'].includes(
        req.socket.remoteAddress ?? '',
      ) ||
      Buffer.byteLength(auth) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    ) {
      json(res, 401, {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Daemon authorization required.',
        },
      });
      return;
    }
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/v1/health') {
      json(res, 200, { status: 'ready', version: '0.1.0-dev' });
      return;
    }
    if (req.method === 'GET' && path === '/v1/providers') {
      json(res, 200, {
        providers: store.providers(),
        configured: config.routing?.providers ?? [
          { id: 'primary', provider: config.provider },
        ],
      });
      return;
    }
    if (req.method === 'POST' && path === '/v1/providers') {
      if (active.size) {
        json(res, 409, {
          error: {
            code: 'MISSION_ACTIVE',
            message: 'Change providers after active missions finish.',
          },
        });
        return;
      }
      const input = z
        .object({
          name: z.string().min(1).max(100),
          config: providerSchema,
          api_key: z.string().min(1).max(16384).optional(),
        })
        .strict()
        .parse(await body(req));
      validateConfig({ ...config, provider: input.config });
      if (
        input.api_key &&
        (input.config.type === 'codex' ||
          input.config.apiKeyEnv ||
          input.config.secretRef)
      )
        throw new Error('conflicting credentials');
      let secretRef: string | undefined;
      try {
        if (input.api_key) {
          secretRef = storeCredential(input.api_key);
          store.addSecret(input.api_key);
        }
        const provider = {
          id: 'prov_' + randomUUID(),
          name: input.name,
          config: providerSchema.parse({
            ...input.config,
            ...(secretRef ? { secretRef } : {}),
          }),
        };
        for (const secret of providerSecrets(provider.config))
          store.addSecret(secret);
        store.saveProvider(provider);
        json(res, 201, { provider });
      } catch (error) {
        if (secretRef) deleteCredential(secretRef);
        throw error;
      }
      return;
    }
    const providerMatch =
      /^\/v1\/providers\/(prov_[a-f0-9-]+)\/(discover|health)$/.exec(path);
    if (
      providerMatch &&
      ((req.method === 'POST' && providerMatch[2] === 'discover') ||
        (req.method === 'GET' && providerMatch[2] === 'health'))
    ) {
      const provider = store.providers().find((p) => p.id === providerMatch[1]);
      if (!provider) throw new Error('unknown provider');
      json(
        res,
        200,
        await discoverProvider(
          provider.config,
          stateRoot,
          AbortSignal.timeout(15000),
        ),
      );
      return;
    }
    if (req.method === 'GET' && path === '/v1/model-profiles') {
      json(res, 200, {
        profiles: ['economy', 'balanced', 'deep', 'local', 'manual'],
        active: config.routing ?? null,
      });
      return;
    }
    if (req.method === 'POST' && path === '/v1/model-profiles') {
      if (active.size) {
        json(res, 409, {
          error: {
            code: 'MISSION_ACTIVE',
            message: 'Change routing after active missions finish.',
          },
        });
        return;
      }
      const routing = configSchema.shape.routing.parse(await body(req));
      if (!routing) throw new Error('missing routing');
      const updated = validateConfig({ ...config, routing });
      for (const secret of configuredSecrets(updated)) store.addSecret(secret);
      store.saveRouting(routing);
      config = updated;
      json(res, 200, { active: routing });
      return;
    }

    if (req.method === 'GET' && path === '/v1/doctor') {
      const signal = AbortSignal.timeout(15000);
      const commands = [
        { name: 'Git', executable: 'git', args: ['--version'] },
        {
          name: 'Docker',
          executable: config.execution.dockerExecutable,
          args: ['info', '--format', '{{.ServerVersion}}'],
        },
        {
          name: 'OpenPitStop',
          executable: config.referee.executable,
          args: [...config.referee.args, '--version'],
        },
      ];
      if (config.provider.type === 'codex')
        commands.push({
          name: 'Codex',
          executable: config.provider.executable,
          args: ['--version'],
        });
      const capabilities = await Promise.all(
        commands.map(async (c) => {
          try {
            const r = await runProcess(c, {
              cwd: stateRoot,
              signal,
              timeoutMs: 10000,
            });
            return {
              name: c.name,
              available: r.exitCode === 0,
              version: r.exitCode === 0 ? r.stdout.trim() : null,
            };
          } catch {
            return { name: c.name, available: false, version: null };
          }
        }),
      );
      json(res, 200, {
        capabilities,
        reducedIsolation: config.execution.allowReducedIsolation,
      });
      return;
    }
    if (req.method === 'POST' && path === '/v1/projects/open') {
      const input = z
        .object({ path: z.string().min(1) })
        .strict()
        .parse(await body(req));
      const graph = await indexRepository(
        input.path,
        AbortSignal.timeout(30000),
      );
      const artifact = await store.saveGraph(graph);
      json(res, 200, {
        project: {
          id: store
            .projects()
            .find((project) => project.root_path === graph.root)!.id,
          root: graph.root,
          head: graph.head,
          dirty: graph.dirty,
        },
        graph,
        artifact,
      });
      return;
    }
    if (req.method === 'GET' && path === '/v1/projects') {
      json(res, 200, { projects: store.projects() });
      return;
    }
    const projectMatch =
      /^\/v1\/projects\/(prj_[a-f0-9-]+)(?:\/(observe|story|facts))?$/.exec(
        path,
      );
    if (
      projectMatch &&
      (req.method === 'GET' ||
        (req.method === 'POST' && projectMatch[2] === 'observe'))
    ) {
      const root = store.projectRoot(projectMatch[1]!);
      const graph = await indexRepository(root, AbortSignal.timeout(30000));
      const artifact = await store.saveGraph(graph);
      json(res, 200, { graph, artifact, facts: store.facts(root) });
      return;
    }
    if (req.method === 'GET' && path === '/v1/missions') {
      json(res, 200, {
        missions: await Promise.all(
          store.list().map((m) => currentMission(m.id)),
        ),
      });
      return;
    }
    if (req.method === 'POST' && path === '/v1/missions') {
      const input = createSchema.parse(await body(req));
      const normalized = (await import('node:fs/promises')).realpath;
      const root = await normalized(input.repo);
      const key = process.platform === 'win32' ? root.toLowerCase() : root;
      if (projects.has(key)) {
        json(res, 409, {
          error: {
            code: 'PROJECT_BUSY',
            message: 'One mission per repository is allowed.',
          },
        });
        return;
      }
      projects.add(key);
      const abort = new AbortController();
      try {
        const running = startMission(store, {
          repo: root,
          request: input.request,
          config,
          signal: abort.signal,
        });
        const done = running.done.finally(() => {
          active.delete(running.mission.id);
          projects.delete(key);
        });
        active.set(running.mission.id, {
          abort,
          done,
          control: running.control,
        });
        json(res, 202, { mission_id: running.mission.id });
      } catch (error) {
        projects.delete(key);
        throw error;
      }
      return;
    }
    const approvalMatch = /^\/v1\/approvals\/(apr_[a-f0-9-]+)$/.exec(path);
    if (req.method === 'POST' && approvalMatch) {
      const input = z
        .object({
          decision: z.enum(['approve', 'reject']),
          action_hash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
        .parse(await body(req));
      for (const [missionId, running] of active) {
        if (
          store
            .get(missionId)
            .events.some(
              (item) =>
                item.event.type === 'approval.requested' &&
                item.event.id === approvalMatch[1],
            )
        ) {
          running.control.resolveApproval(
            approvalMatch[1]!,
            input.action_hash,
            input.decision === 'approve',
          );
          json(res, 200, { resolved: true });
          return;
        }
      }
      json(res, 409, {
        error: {
          code: 'STALE_APPROVAL',
          message: 'No matching active approval.',
        },
      });
      return;
    }
    const missionMatch =
      /^\/v1\/missions\/(mis_[a-f0-9-]+)(?:\/(cancel|pause|resume|diff|events))?$/.exec(
        path,
      );
    if (missionMatch) {
      const id = missionMatch[1]!;
      const action = missionMatch[2];
      if (req.method === 'POST' && action === 'cancel') {
        active.get(id)?.abort.abort();
        json(res, 202, { requested: true });
        return;
      }
      if (
        req.method === 'POST' &&
        (action === 'pause' || action === 'resume')
      ) {
        const running = active.get(id);
        if (!running) {
          json(res, 409, {
            error: { code: 'NOT_ACTIVE', message: 'Mission is not active.' },
          });
          return;
        }
        if (action === 'pause') running.control.pause();
        else running.control.resume();
        json(res, 202, { requested: true });
        return;
      }
      if (req.method === 'GET') {
        const mission = await currentMission(id);
        if (action === 'events') {
          json(res, 200, { events: mission.events });
          return;
        }
        if (action === 'diff') {
          if (!mission.candidate) {
            json(res, 404, {
              error: {
                code: 'NO_CANDIDATE',
                message: 'No candidate was created.',
              },
            });
            return;
          }
          const signal = AbortSignal.timeout(30000);
          const digest = await fingerprint(mission.candidate.root, signal);
          const final = mission.events
            .map((e) => e.event)
            .findLast((e) => e.type === 'referee');
          json(res, 200, {
            diff: await candidateDiff(mission.candidate, signal),
            digest,
            fresh: final?.type === 'referee' && final.digest === digest,
          });
          return;
        }
        json(res, 200, mission);
        return;
      }
    }
    const artifact = /^\/v1\/artifacts\/([a-f0-9]{64})$/.exec(path);
    if (req.method === 'GET' && artifact) {
      json(res, 200, { content: await store.readArtifact(artifact[1]!) });
      return;
    }
    json(res, 404, {
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No loopback address.');
  return {
    url: 'http://127.0.0.1:' + address.port,
    token,
    close: async () => {
      for (const item of active.values()) item.abort.abort();
      await Promise.allSettled([...active.values()].map((item) => item.done));
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    },
  };
}
