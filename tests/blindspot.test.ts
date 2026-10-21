import { expect, it } from 'vitest';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBlindspot } from '../packages/blindspot/src/index.js';
import { fingerprint, git } from '../packages/candidate-manager/src/index.js';
import { runProcess } from '../packages/sandbox/src/index.js';
import { blindspotReportSchema } from '../packages/protocol/src/index.js';
import type { BlindspotMutation } from '../packages/protocol/src/index.js';

const FIXTURE = join(process.cwd(), 'fixtures', 'blindspot-weak-suite');

const mutations: BlindspotMutation[] = [
  {
    id: 'drop-anonymous-check',
    category: 'authz',
    description: 'Remove the anonymous caller rejection.',
    path: 'src/auth.js',
    find: "if (!user) throw new Error('unauthorized');",
    replace: "if (false) throw new Error('unauthorized');",
  },
  {
    id: 'drop-role-check',
    category: 'permission',
    description: 'Remove the delete permission check.',
    path: 'src/auth.js',
    find: "if (action === 'delete' && user.role !== 'admin')\n    throw new Error('forbidden');",
    replace: "if (false) throw new Error('forbidden');",
  },
  {
    id: 'bypass-quantity-validation',
    category: 'validation',
    description: 'Bypass order quantity validation.',
    path: 'src/validation.js',
    find: 'if (!order || !Number.isInteger(order.quantity) || order.quantity <= 0)\n    return { ok: false };',
    replace: 'if (false)\n    return { ok: false };',
  },
];

async function initRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-blindspot-'));
  await cp(FIXTURE, root, { recursive: true });
  const signal = AbortSignal.timeout(30000);
  await git(root, ['init'], signal);
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=PitCrew blindspot',
      '-c',
      'user.email=blindspot@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Weak verification baseline',
    ],
    signal,
  );
  return root;
}
function verifier(args: string[]) {
  return async (root: string, signal: AbortSignal) =>
    (
      await runProcess(
        { executable: 'node', args },
        { cwd: root, signal, timeoutMs: 30000 },
      )
    ).exitCode === 0
      ? { exitCode: 0 }
      : { exitCode: 1 };
}

it('records real verification debt when a weak suite survives controlled mutations', async () => {
  const root = await initRepo();
  try {
    const signal = AbortSignal.timeout(60000);
    const before = await fingerprint(root, signal);
    const report = await runBlindspot({
      root,
      mutations,
      assumptions: [
        {
          id: 'auth-required',
          statement: 'Anonymous callers cannot use the service.',
          mutationId: 'drop-anonymous-check',
          declaredProtected: true,
          volatile: false,
        },
        {
          id: 'role-required',
          statement: 'Only admins may delete.',
          mutationId: 'drop-role-check',
          declaredProtected: false,
          volatile: false,
        },
        {
          id: 'external-provider',
          statement: 'The upstream provider stays available.',
          mutationId: null,
          declaredProtected: false,
          volatile: true,
        },
      ],
      verify: verifier(['--test', 'test/weak.test.js']),
      signal,
    });
    blindspotReportSchema.parse(report);
    expect(await fingerprint(root, signal)).toBe(before);
    expect(report.findings.map((f) => f.outcome)).toEqual([
      'survived',
      'survived',
      'survived',
    ]);
    expect(report.verificationDebt).toEqual([
      'drop-anonymous-check',
      'drop-role-check',
      'bypass-quantity-validation',
    ]);
    expect(report.ledger.map((entry) => entry.state)).toEqual([
      'CONTRADICTED',
      'UNPROTECTED',
      'EXTERNAL_VOLATILE',
    ]);
    expect(
      (await readFile(join(root, 'src', 'auth.js'), 'utf8')).includes(
        "if (!user) throw new Error('unauthorized');",
      ),
    ).toBe(true);
  } finally {
    await git(root, ['worktree', 'prune'], AbortSignal.timeout(30000));
  }
}, 120000);

it('converts the same assumptions to protected once a stronger verifier exists', async () => {
  const root = await initRepo();
  const signal = AbortSignal.timeout(60000);
  const report = await runBlindspot({
    root,
    mutations,
    assumptions: [
      {
        id: 'auth-required',
        statement: 'Anonymous callers cannot use the service.',
        mutationId: 'drop-anonymous-check',
        declaredProtected: true,
        volatile: false,
      },
      {
        id: 'role-required',
        statement: 'Only admins may delete.',
        mutationId: 'drop-role-check',
        declaredProtected: false,
        volatile: false,
      },
      {
        id: 'unverified-claim',
        statement: 'Caching never changes order totals.',
        mutationId: null,
        declaredProtected: false,
        volatile: false,
      },
    ],
    verify: verifier(['--test']),
    signal,
  });
  expect(report.findings.every((f) => f.outcome === 'killed')).toBe(true);
  expect(report.verificationDebt).toEqual([]);
  expect(report.ledger.map((entry) => entry.state)).toEqual([
    'PROTECTED',
    'PROTECTED',
    'INFERRED',
  ]);
  expect(await fingerprint(root, signal)).toBe(report.candidateDigest);
}, 120000);

it('rejects ambiguous mutations and path escapes without editing the repository', async () => {
  const root = await initRepo();
  const signal = AbortSignal.timeout(30000);
  const verify = verifier(['--test']);
  await expect(
    runBlindspot({
      root,
      mutations: [{ ...mutations[0]!, find: 'throw new Error' }],
      verify,
      signal,
    }),
  ).rejects.toMatchObject({ code: 'CONFIGURATION' });
  await expect(
    runBlindspot({
      root,
      mutations: [{ ...mutations[0]!, path: '../outside.js' }],
      verify,
      signal,
    }),
  ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
}, 60000);

it('restores the candidate when verification itself fails unexpectedly', async () => {
  const root = await initRepo();
  const signal = AbortSignal.timeout(30000);
  const source = await readFile(join(root, 'src', 'auth.js'), 'utf8');
  await expect(
    runBlindspot({
      root,
      mutations: [mutations[0]!],
      verify: async () => {
        throw new Error('verifier crashed');
      },
      signal,
    }),
  ).rejects.toThrow('verifier crashed');
  expect(await readFile(join(root, 'src', 'auth.js'), 'utf8')).toBe(source);
}, 60000);
