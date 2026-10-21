import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runProcess,
  resolveInside,
  cleanEnvironment,
  runSandbox,
} from '../packages/sandbox/src/index.js';
import {
  evaluatePath,
  actionHash,
} from '../packages/policy-engine/src/index.js';
import {
  redact,
  assertNoSecrets,
} from '../packages/observability/src/index.js';
import { reduceMission } from '../packages/mission-runtime/src/index.js';
import { proposalSchema } from '../packages/protocol/src/index.js';
import type { Mission } from '../packages/protocol/src/index.js';
import { EvidenceStore } from '../packages/evidence/src/index.js';
import { implement } from '../packages/agents/src/index.js';

const signal = (): AbortSignal => new AbortController().signal;
const stores: EvidenceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});
describe('deterministic permission boundary', () => {
  it.each([
    '.env',
    '.env.production',
    '.git/config',
    '../../.ssh/id_rsa',
    'src/secrets.json',
  ])('denies credential or escape path %s', (path) =>
    expect(evaluatePath(path, 'read').decision).toBe('deny'),
  );
  it.each([
    'package.json',
    'db/migrations/001.sql',
    'src/auth.ts',
    '.github/workflows/ci.yml',
    'test/order.test.js',
  ])('requires approval for %s', (path) =>
    expect(evaluatePath(path, 'write').decision).toBe('ask'),
  );
  it('normal source may be edited; repository text cannot grant an approval', () => {
    expect(evaluatePath('src/sum.js', 'write').decision).toBe('allow');
    expect(evaluatePath('README.md', 'read').decision).toBe('allow');
    expect(actionHash('a', 'src/a', 'x', 'y')).not.toBe(
      actionHash('a', 'src/a', 'x', 'z'),
    );
  });
});
describe('paths and bounded process execution', () => {
  it.each([
    '../outside',
    'C:/outside',
    '/outside',
    'sub/../../outside',
    'sub\\outside',
    'file:stream',
    'NUL',
    'file.',
  ])('rejects %s', async (path) => {
    const root = await mkdtemp(join(tmpdir(), 'pitcrew-path-'));
    await expect(resolveInside(root, path)).rejects.toThrow();
  });
  it('rejects junction/symlink escape', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pitcrew-link-'));
    const outside = await mkdtemp(join(tmpdir(), 'pitcrew-out-'));
    await symlink(
      outside,
      join(root, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(resolveInside(root, 'escape/file')).rejects.toThrow();
  });
  it('passes metacharacters literally and removes ambient secrets', async () => {
    process.env.PITCREW_TEST_SECRET = 'not-for-child';
    const result = await runProcess(
      {
        executable: process.execPath,
        args: [
          '-e',
          'console.log(process.argv[1]); console.log(process.env.PITCREW_TEST_SECRET)',
          'x;$(echo bad)&',
        ],
      },
      { cwd: process.cwd(), signal: signal(), timeoutMs: 5000 },
    );
    delete process.env.PITCREW_TEST_SECRET;
    expect(result.stdout).toContain('x;$(echo bad)&');
    expect(result.stdout).toContain('undefined');
    expect(cleanEnvironment()).not.toHaveProperty('PITCREW_TEST_SECRET');
  });
  it('terminates huge output', async () => {
    await expect(
      runProcess(
        {
          executable: process.execPath,
          args: [
            '-e',
            'setInterval(()=>process.stdout.write("x".repeat(10000)),1)',
          ],
        },
        {
          cwd: process.cwd(),
          signal: signal(),
          timeoutMs: 5000,
          maxOutputBytes: 1000,
        },
      ),
    ).rejects.toMatchObject({ code: 'TOOL_ENVIRONMENT_FAILED' });
  });
  it('cancels the process tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pitcrew-cancel-'));
    const pidFile = join(root, 'pid');
    const controller = new AbortController();
    const code =
      'const {spawn}=require("node:child_process"); const fs=require("node:fs"); const p=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); fs.writeFileSync(process.argv[1],String(p.pid)); setInterval(()=>{},1000)';
    const running = runProcess(
      { executable: process.execPath, args: ['-e', code, pidFile] },
      { cwd: root, signal: controller.signal, timeoutMs: 5000 },
    );
    const result = expect(running).rejects.toMatchObject({ code: 'CANCELLED' });
    let pid = 0;
    for (let i = 0; i < 50; i++) {
      try {
        pid = Number(await readFile(pidFile, 'utf8'));
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    expect(pid).toBeGreaterThan(0);
    controller.abort();
    await result;
    let gone = false;
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(pid, 0);
      } catch {
        gone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(gone).toBe(true);
  });
  it('does not silently fall back without Docker authorization', async () => {
    await expect(
      runSandbox(
        { executable: process.execPath, args: ['-e', 'process.exit(0)'] },
        process.cwd(),
        {
          dockerExecutable: 'pitcrew-missing-docker',
          image: 'node:22',
          allowReducedIsolation: false,
        },
        { signal: signal(), timeoutMs: 5000 },
      ),
    ).rejects.toMatchObject({ code: 'SANDBOX_FAILED' });
  });
});
describe('evidence and bounded edits', () => {
  it('rejects malformed model output and extra powers', () =>
    expect(
      proposalSchema.safeParse({
        summary: 'done',
        edits: [],
        shell: 'rm -rf /',
      }).success,
    ).toBe(false));
  it('redacts credentials and blocks them from context', () => {
    expect(redact('api_key=secret-value')).not.toContain('secret-value');
    expect(() => assertNoSecrets('token-value', ['token-value'])).toThrow();
  });
  it('rejects direct IMPLEMENTING to VERIFIED', () => {
    const mission: Mission = {
      id: 'mis_a',
      request: 'fix',
      repo: '.',
      state: 'IMPLEMENTING',
      message: '',
      events: [],
    };
    expect(() =>
      reduceMission(mission, {
        type: 'referee',
        verdict: 'VERIFIED',
        digest: 'x',
        artifact: 'x',
        message: 'self-certified',
      }),
    ).toThrow();
  });
  it('replays persisted events and checks artifact hashes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pitcrew-store-'));
    const store = await EvidenceStore.open(root, ['private-marker']);
    stores.push(store);
    const mission = store.create('/repo', 'fix');
    store.append(mission.id, {
      type: 'phase',
      state: 'UNDERSTANDING',
      message: 'observed',
    });
    const hash = await store.artifact('private-marker');
    expect(await store.readArtifact(hash)).toBe('[REDACTED]');
    expect(store.get(mission.id).state).toBe('UNDERSTANDING');
    await writeFile(
      join(root, 'artifacts', 'sha256', hash.slice(0, 2), hash),
      'tamper',
    );
    await expect(store.readArtifact(hash)).rejects.toMatchObject({
      code: 'STALE_EVIDENCE',
    });
    store.recoverInterrupted();
    expect(store.get(mission.id).state).toBe('NOT_PROVEN');
  });
  it('preflights all edits before any write and enforces preimages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pitcrew-edit-'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'sum.js'), 'old');
    await expect(
      implement(root, {
        summary: 'fix',
        edits: [
          { path: 'src/sum.js', before: 'old', after: 'new' },
          { path: 'package.json', before: '', after: 'bad' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    expect(await readFile(join(root, 'src', 'sum.js'), 'utf8')).toBe('old');
    await expect(
      implement(root, {
        summary: 'fix',
        edits: [{ path: 'src/sum.js', before: 'wrong', after: 'new' }],
      }),
    ).rejects.toMatchObject({ code: 'STALE_EVIDENCE' });
  });
});
