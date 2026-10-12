import { describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertIndependentHypotheses,
  detectTestWeakening,
  disposeCandidate,
  eliminationReason,
  normalizeVerification,
  patchIdentity,
  replayPatch,
  savePatch,
  selectCandidate,
  shouldBranch,
  treeDigest,
} from '../packages/candidate-manager/src/arena.js';
import {
  candidateDiff,
  createCandidate,
  fingerprint,
  checkpoint,
  git,
  inspectBaseline,
} from '../packages/candidate-manager/src/index.js';
import { runSandbox } from '../packages/sandbox/src/index.js';
import {
  gate,
  invokeReferee,
} from '../packages/openpitstop-adapter/src/index.js';
import { reduceMission } from '../packages/mission-runtime/src/index.js';
import type { Mission } from '../packages/protocol/src/index.js';

const ROOT = dirname(fileURLToPath(new URL('.', import.meta.url)));
const RACE = join(ROOT, 'fixtures', 'checkout-race');
const PATCHES = join(ROOT, 'fixtures', 'arena-patches');
const REFEREE = join(ROOT, 'node_modules', 'openpitstop', 'dist', 'cli.js');
const EXECUTION = {
  allowReducedIsolation: true,
  dockerExecutable: 'pitcrew-missing-docker',
  image: 'node:22',
};

function missionAt(state: Mission['state']): Mission {
  return {
    id: 'mis_arena',
    request: 'Prevent duplicate checkout orders under concurrent requests.',
    repo: '.',
    state,
    message: '',
    events: [],
  };
}

describe('arena branch policy', () => {
  it('stays single-path when no trigger applies', () => {
    expect(
      shouldBranch({
        proofWeak: false,
        hypothesisUncertain: false,
        repeatedFailures: 0,
        highRisk: false,
        architectureFork: false,
        budgetRemaining: true,
      }),
    ).toEqual({ branch: false, triggers: [] });
  });
  it('branches on weak proof, uncertainty, repeated failure, risk, or fork', () => {
    expect(
      shouldBranch({
        proofWeak: true,
        hypothesisUncertain: false,
        repeatedFailures: 0,
        highRisk: false,
        architectureFork: false,
        budgetRemaining: true,
      }).triggers,
    ).toEqual(['weak-proof']);
    expect(
      shouldBranch({
        proofWeak: false,
        hypothesisUncertain: true,
        repeatedFailures: 0,
        highRisk: false,
        architectureFork: false,
        budgetRemaining: true,
      }).branch,
    ).toBe(true);
    expect(
      shouldBranch({
        proofWeak: false,
        hypothesisUncertain: false,
        repeatedFailures: 1,
        highRisk: false,
        architectureFork: false,
        budgetRemaining: true,
      }).branch,
    ).toBe(false);
    expect(
      shouldBranch({
        proofWeak: false,
        hypothesisUncertain: false,
        repeatedFailures: 2,
        highRisk: false,
        architectureFork: false,
        budgetRemaining: true,
      }).triggers,
    ).toEqual(['repeated-failure']);
    expect(
      shouldBranch({
        proofWeak: false,
        hypothesisUncertain: false,
        repeatedFailures: 0,
        highRisk: true,
        architectureFork: true,
        budgetRemaining: true,
      }).triggers,
    ).toEqual(['high-risk', 'architecture-fork']);
  });
  it('never branches without remaining budget', () => {
    expect(
      shouldBranch({
        proofWeak: true,
        hypothesisUncertain: true,
        repeatedFailures: 5,
        highRisk: true,
        architectureFork: true,
        budgetRemaining: false,
      }).branch,
    ).toBe(false);
  });
});

describe('independent hypotheses', () => {
  it('accepts genuinely different engineering hypotheses', () => {
    expect(() =>
      assertIndependentHypotheses([
        {
          key: 'a',
          hypothesis: 'Serialize checkouts with an in-process mutex.',
        },
        {
          key: 'c',
          hypothesis:
            'Guard the order store with an atomic filesystem lock and re-check the key.',
        },
      ]),
    ).not.toThrow();
  });
  it('rejects cosmetic restatements, duplicate keys, and singletons', () => {
    expect(() =>
      assertIndependentHypotheses([
        { key: 'a', hypothesis: 'Fix the race with a lock.' },
        { key: 'b', hypothesis: 'Fix the race with a lock!' },
      ]),
    ).toThrow('independently justified');
    expect(() =>
      assertIndependentHypotheses([
        { key: 'a', hypothesis: 'Serialize with an in-process mutex.' },
        { key: 'a', hypothesis: 'Use an atomic filesystem lock instead.' },
      ]),
    ).toThrow('distinct keys');
    expect(() =>
      assertIndependentHypotheses([
        { key: 'a', hypothesis: 'Only one hypothesis.' },
      ]),
    ).toThrow();
  });
});

describe('test-weakening detection', () => {
  it('leaves a source-only patch clean', () => {
    const diff = `diff --git a/src/checkout.js b/src/checkout.js
--- a/src/checkout.js
+++ b/src/checkout.js
@@
-  latest.push(order);
+  fresh.push(order);`;
    expect(detectTestWeakening(diff, ['src/checkout.js'])).toEqual({
      weakened: false,
      details: [],
    });
  });
  it('flags modified verification files', () => {
    const diff = `diff --git a/test/visible.test.js b/test/visible.test.js
--- a/test/visible.test.js
+++ b/test/visible.test.js
@@
-  assert.equal(await countOrders(store, 'key-2'), 1);
+  assert.ok((await countOrders(store, 'key-2')) >= 1);`;
    const report = detectTestWeakening(diff, ['test/visible.test.js']);
    expect(report.weakened).toBe(true);
    expect(report.details.join(' ')).toContain('verification file');
  });
  it('flags skips, removed assertions, and forced exits', () => {
    expect(
      detectTestWeakening('+test.skip("race", () => {});', ['src/checkout.js'])
        .weakened,
    ).toBe(true);
    expect(
      detectTestWeakening('-assert.equal(count, 1);\n+// no check', [
        'src/checkout.js',
      ]).details.join(' '),
    ).toContain('assertion');
    expect(
      detectTestWeakening('+process.exit(0);', ['src/checkout.js']).weakened,
    ).toBe(true);
  });
});

describe('verification normalization and selection', () => {
  const digest = 'a'.repeat(64);
  it('binds every record to its exact candidate digest', () => {
    expect(
      normalizeVerification({
        candidateId: 'cand_a',
        digest,
        evidenceDigest: digest,
        targetExit: 0,
        regressionExit: 0,
        integrityClean: true,
        concurrencyPass: true,
        detail: 'all green',
      }),
    ).toMatchObject({ targetPass: true, regressionPass: true });
    expect(() =>
      normalizeVerification({
        candidateId: 'cand_a',
        digest,
        evidenceDigest: 'b'.repeat(64),
        targetExit: 0,
        regressionExit: 0,
        integrityClean: true,
        concurrencyPass: true,
        detail: 'stale',
      }),
    ).toThrow('different candidate state');
  });
  it('never renders missing checks as passes', () => {
    const record = normalizeVerification({
      candidateId: 'cand_a',
      digest,
      evidenceDigest: digest,
      targetExit: 0,
      regressionExit: null,
      integrityClean: true,
      concurrencyPass: null,
      detail: 'regression was never run',
    });
    expect(record.regressionPass).toBe(false);
    expect(eliminationReason(record)).toContain('regression');
  });
  it('explains elimination in one plain sentence', () => {
    const base = {
      candidateId: 'cand_x',
      digest,
      targetPass: true,
      regressionPass: true,
      integrityClean: true,
      concurrencyPass: true as boolean | null,
      detail: 'ok',
    };
    expect(eliminationReason({ ...base, integrityClean: false })).toContain(
      'verification test',
    );
    expect(eliminationReason({ ...base, targetPass: false })).toContain(
      'acceptance check',
    );
    expect(eliminationReason({ ...base, concurrencyPass: false })).toContain(
      'concurrency reproduction',
    );
    expect(eliminationReason(base)).toBeUndefined();
  });
  it('selects only an exact-digest VERIFIED survivor', () => {
    const survivor = {
      candidateId: 'cand_c',
      digest,
      targetPass: true,
      regressionPass: true,
      integrityClean: true,
      concurrencyPass: true as boolean | null,
      detail: 'ok',
    };
    expect(
      selectCandidate(
        [survivor],
        [{ candidateId: 'cand_c', digest, verdict: 'VERIFIED' as const }],
      ),
    ).toMatchObject({ candidateId: 'cand_c', digest });
    expect(
      selectCandidate(
        [survivor],
        [
          {
            candidateId: 'cand_c',
            digest: 'b'.repeat(64),
            verdict: 'VERIFIED' as const,
          },
        ],
      ),
    ).toBeUndefined();
    expect(selectCandidate([survivor], [])).toBeUndefined();
  });
});

describe('mission runtime arena', () => {
  it('compares candidates in SELECTING and records evidence-first selection', () => {
    let mission = missionAt('VERIFYING');
    mission = reduceMission(mission, {
      type: 'phase',
      state: 'SELECTING',
      message: 'Comparing candidate evidence.',
    });
    expect(mission.state).toBe('SELECTING');
    const digest = 'c'.repeat(64);
    mission = reduceMission(mission, {
      type: 'candidate',
      candidate: { id: 'cand_a', root: '/a', baseline: 'base', branch: 'b-a' },
    });
    mission = reduceMission(mission, {
      type: 'candidate',
      candidate: { id: 'cand_c', root: '/c', baseline: 'base', branch: 'b-c' },
    });
    mission = reduceMission(mission, {
      type: 'candidate.eliminated',
      candidateId: 'cand_a',
      digest,
      reason: 'Passed visible tests but failed concurrency reproduction.',
    });
    expect(mission.eliminations).toHaveLength(1);
    mission = reduceMission(mission, {
      type: 'phase',
      state: 'FINAL_GATE',
      message: 'gate',
    });
    mission = reduceMission(mission, {
      type: 'candidate.selected',
      candidateId: 'cand_c',
      digest,
      reason: 'Passed target behavior and regression checks.',
    });
    expect(mission.selection?.candidateId).toBe('cand_c');
    expect(mission.candidate?.id).toBe('cand_c');
    mission = reduceMission(mission, {
      type: 'referee',
      verdict: 'VERIFIED',
      digest,
      artifact: 'art',
      message: 'verified',
    });
    expect(mission.state).toBe('VERIFIED');
  });
  it('still forbids IMPLEMENTING to VERIFIED', () => {
    expect(() =>
      reduceMission(missionAt('IMPLEMENTING'), {
        type: 'referee',
        verdict: 'VERIFIED',
        digest: 'x',
        artifact: 'y',
        message: 'self-certified',
      }),
    ).toThrow();
  });
});

async function initRaceRepo(
  signal: AbortSignal,
): Promise<{ root: string; baseline: string; digest: string }> {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-arena-'));
  await cp(RACE, root, { recursive: true });
  await git(root, ['init'], signal);
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=PitCrew arena',
      '-c',
      'user.email=arena@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Known duplicate-checkout race baseline',
    ],
    signal,
  );
  const baseline = (await git(root, ['rev-parse', 'HEAD'], signal)).trim();
  const digest = (await inspectBaseline(root, signal)).digest;
  return { root, baseline, digest };
}

describe('duplicate-checkout arena hero', () => {
  it('eliminates the racy and weakened candidates and verifies the correct one', async () => {
    const signal = AbortSignal.timeout(240000);
    const state = await mkdtemp(join(tmpdir(), 'pitcrew-arena-state-'));
    const {
      root,
      baseline,
      digest: baselineDigest,
    } = await initRaceRepo(signal);

    const visible = { executable: 'node', args: ['--test'] };
    const baseVisible = await runSandbox(visible, root, EXECUTION, {
      signal,
      timeoutMs: 60000,
    });
    expect(baseVisible.exitCode).toBe(0);
    const baseRepro = await runSandbox(
      {
        executable: 'node',
        args: ['scripts/repro-concurrency.mjs', 'auto', 'race-key', '6'],
      },
      root,
      EXECUTION,
      { signal, timeoutMs: 90000 },
    );
    // Baseline: visible suite passes, concurrent checkouts duplicate.
    expect(baseRepro.exitCode).not.toBe(0);

    assertIndependentHypotheses([
      { key: 'a', hypothesis: 'Serialize checkouts with an in-process mutex.' },
      {
        key: 'b',
        hypothesis: 'Loosen the duplicate assertion so the suite passes.',
      },
      {
        key: 'c',
        hypothesis:
          'Guard the order store with an atomic filesystem lock and re-check the key.',
      },
    ]);

    const hypotheses = {
      a: await readFile(join(PATCHES, 'candidate-a-checkout.js'), 'utf8'),
      bTest: await readFile(
        join(PATCHES, 'candidate-b-visible.test.js'),
        'utf8',
      ),
      c: await readFile(join(PATCHES, 'candidate-c-checkout.js'), 'utf8'),
    };
    const candidates = {
      a: await createCandidate(root, state, baseline, signal),
      b: await createCandidate(root, state, baseline, signal),
      c: await createCandidate(root, state, baseline, signal),
    };
    try {
      await writeFile(
        join(candidates.a.root, 'src', 'checkout.js'),
        hypotheses.a,
      );
      await checkpoint(candidates.a, ['src/checkout.js'], signal);
      // Candidate B keeps baseline behavior and weakens its own test instead.
      await writeFile(
        join(candidates.b.root, 'test', 'visible.test.js'),
        hypotheses.bTest,
      );
      await checkpoint(candidates.b, ['test/visible.test.js'], signal);
      await writeFile(
        join(candidates.c.root, 'src', 'checkout.js'),
        hypotheses.c,
      );
      await checkpoint(candidates.c, ['src/checkout.js'], signal);

      const records = [];
      for (const key of ['a', 'b', 'c'] as const) {
        const candidate = candidates[key];
        const candidateDigest = await fingerprint(candidate.root, signal);
        const target = await runSandbox(visible, candidate.root, EXECUTION, {
          signal,
          timeoutMs: 60000,
        });
        const repro = await runSandbox(
          {
            executable: 'node',
            args: ['scripts/repro-concurrency.mjs', 'auto', 'race-key', '6'],
          },
          candidate.root,
          EXECUTION,
          { signal, timeoutMs: 90000 },
        );
        if ((await fingerprint(candidate.root, signal)) !== candidateDigest)
          throw new Error('Verification mutated candidate ' + key);
        const diff = await candidateDiff(candidate, signal);
        const changed = (
          await git(candidate.root, ['diff', '--name-only', baseline], signal)
        )
          .split('\n')
          .map((line) => line.trim().replace(/\\/g, '/'))
          .filter(Boolean);
        const weakening = detectTestWeakening(diff, changed);
        records.push({
          key,
          candidate,
          digest: candidateDigest,
          record: normalizeVerification({
            candidateId: candidate.id,
            digest: candidateDigest,
            evidenceDigest: candidateDigest,
            targetExit: target.exitCode,
            regressionExit: target.exitCode,
            integrityClean: !weakening.weakened,
            concurrencyPass: repro.exitCode === 0 ? true : false,
            detail:
              weakening.details.join('; ') ||
              `visible=${target.exitCode} repro=${repro.exitCode}`,
          }),
        });
      }

      const byKey = Object.fromEntries(records.map((r) => [r.key, r]));
      // Candidate A passes visible tests but duplicates under concurrency.
      expect(byKey['a']!.record.targetPass).toBe(true);
      expect(byKey['a']!.record.concurrencyPass).toBe(false);
      expect(eliminationReason(byKey['a']!.record)).toContain(
        'concurrency reproduction',
      );
      // Candidate B is eliminated for weakening its own verification.
      expect(byKey['b']!.record.integrityClean).toBe(false);
      expect(eliminationReason(byKey['b']!.record)).toContain(
        'verification test',
      );
      // Candidate C survives normalization.
      expect(eliminationReason(byKey['c']!.record)).toBeUndefined();

      // A saved patch replays byte-identically onto a fresh baseline.
      const patch = await savePatch(byKey['c']!.candidate, signal);
      expect(patchIdentity(patch)).toHaveLength(64);
      const replayRoot = join(state, 'replay-check');
      const replayed = await replayPatch(
        root,
        baseline,
        patch,
        replayRoot,
        signal,
      );
      try {
        expect(replayed.tree).toBe(
          await treeDigest(byKey['c']!.candidate.root, signal),
        );
      } finally {
        await disposeCandidate(
          root,
          {
            ...byKey['c']!.candidate,
            root: replayRoot,
            branch: replayed.branch,
          },
          signal,
        );
      }

      // Independent referee: full production stage sequence, then strict gate.
      const referee = {
        executable: process.execPath,
        args: [REFEREE],
        requiredLayers: ['stack', 'architecture', 'baseline'],
      };
      const candidateC = byKey['c']!.candidate;
      const candidateCDigest = byKey['c']!.digest;
      const stages: string[][] = [
        ['understand', '--json'],
        ['try', '--json'],
        ['verify-stack', '--json'],
        ['architecture-check', '--from', baseline, '--json'],
        [
          'baseline-verify',
          '--baseline',
          baseline,
          '--command',
          'node scripts/repro-concurrency.mjs auto race-key 6',
          '--json',
        ],
      ];
      for (const args of stages) {
        const result = await invokeReferee(
          referee,
          candidateC,
          args,
          signal,
          180000,
        );
        expect(result.exitCode).toBe(0);
      }
      const gated = await gate(referee, candidateC, signal, 180000);
      expect(gated.digest).toBe(candidateCDigest);
      // The correct candidate is retained only after independent verification.
      expect(gated.verdict).toBe('VERIFIED');
      const selection = selectCandidate(
        records.map((r) => r.record),
        records.map((r) => ({
          candidateId: r.candidate.id,
          digest: r.digest,
          verdict: r.key === 'c' ? gated.verdict : ('NOT_PROVEN' as const),
        })),
      );
      expect(selection?.candidateId).toBe(candidateC.id);

      // Baseline untouched by the whole arena.
      expect(await fingerprint(root, signal)).toBe(baselineDigest);
      expect((await git(root, ['status', '--porcelain'], signal)).trim()).toBe(
        '',
      );
    } finally {
      for (const candidate of Object.values(candidates))
        await disposeCandidate(root, candidate, signal).catch(() => undefined);
    }
  }, 240000);
});
