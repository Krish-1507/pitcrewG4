import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import { PitCrewError } from '@pitcrew/protocol';
import type {
  ArenaHypothesis,
  BranchTrigger,
  Candidate,
  NormalizedVerification,
} from '@pitcrew/protocol';
import { runProcess } from '@pitcrew/sandbox';

async function arenaGit(
  root: string,
  args: string[],
  signal: AbortSignal,
): Promise<string> {
  const result = await runProcess(
    {
      executable: 'git',
      args: [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'core.fsmonitor=false',
        '-c',
        'diff.external=',
        ...args,
      ],
    },
    { cwd: root, signal, timeoutMs: 30000, maxOutputBytes: 8 * 1024 * 1024 },
  );
  if (result.exitCode !== 0)
    throw new PitCrewError(
      'TOOL_ENVIRONMENT_FAILED',
      'Git operation failed: ' + args[0],
    );
  return result.stdout;
}

const branchInputSchema = z
  .object({
    proofWeak: z.boolean(),
    hypothesisUncertain: z.boolean(),
    repeatedFailures: z.number().int().min(0).max(100),
    highRisk: z.boolean(),
    architectureFork: z.boolean(),
    budgetRemaining: z.boolean(),
  })
  .strict();

export interface BranchDecision {
  branch: boolean;
  triggers: BranchTrigger[];
}

export function shouldBranch(
  input: z.infer<typeof branchInputSchema>,
): BranchDecision {
  const value = branchInputSchema.parse(input);
  const triggers: BranchTrigger[] = [];
  if (value.proofWeak) triggers.push('weak-proof');
  if (value.hypothesisUncertain) triggers.push('uncertain-hypothesis');
  if (value.repeatedFailures >= 2) triggers.push('repeated-failure');
  if (value.highRisk) triggers.push('high-risk');
  if (value.architectureFork) triggers.push('architecture-fork');
  return { branch: value.budgetRemaining && triggers.length > 0, triggers };
}

export function describeBranchReason(
  triggers: readonly BranchTrigger[],
): string {
  if (!triggers.length)
    return 'Single implementation path; proof is strong and no branch trigger applies.';
  return (
    'Branching into independent candidates because: ' +
    triggers.join(', ') +
    '.'
  );
}

const hypothesisInputSchema = z.array(
  z
    .object({
      key: z.string().min(1).max(64),
      hypothesis: z.string().min(1).max(2000),
    })
    .strict(),
);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}

// Candidate diversity must come from genuinely different engineering
// hypotheses, not repeated sampling with cosmetic prompt changes.
export function assertIndependentHypotheses(
  hypotheses: readonly ArenaHypothesis[],
): void {
  const values = hypothesisInputSchema.min(2).max(8).parse(hypotheses);
  const keys = new Set(values.map((h) => h.key.toLowerCase()));
  if (keys.size !== values.length)
    throw new PitCrewError(
      'POLICY_DENIED',
      'Candidate hypotheses must use distinct keys.',
    );
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i]!.hypothesis.trim().toLowerCase();
      const b = values[j]!.hypothesis.trim().toLowerCase();
      if (a === b || a.includes(b) || b.includes(a))
        throw new PitCrewError(
          'POLICY_DENIED',
          'Candidate hypotheses must be independently justified, not cosmetic restatements.',
        );
      const setA = words(a);
      const setB = words(b);
      const intersection = [...setA].filter((word) => setB.has(word)).length;
      const union = new Set([...setA, ...setB]).size;
      if (union > 0 && intersection / union > 0.9)
        throw new PitCrewError(
          'POLICY_DENIED',
          'Candidate hypotheses must be independently justified, not cosmetic restatements.',
        );
    }
  }
}

export function isTestPath(path: string): boolean {
  return (
    /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/i.test(path) ||
    /\.(?:test|spec)\.[^.]+$/i.test(path)
  );
}

const weakeningMarkers: { pattern: RegExp; label: string }[] = [
  { pattern: /\.\s*skip\s*\(/, label: 'skipped test' },
  { pattern: /\btest\s*\.\s*only\s*\(/, label: 'focused test' },
  { pattern: /\bdescribe\s*\.\s*only\s*\(/, label: 'focused suite' },
  { pattern: /\bit\s*\.\s*only\s*\(/, label: 'focused test' },
  { pattern: /\bxit\s*\(/, label: 'disabled test' },
  { pattern: /\bxdescribe\s*\(/, label: 'disabled suite' },
  { pattern: /\.\s*todo\s*\(/, label: 'todo placeholder' },
  { pattern: /\bjest\s*\.\s*mock\s*\(/, label: 'mocked module' },
  { pattern: /\bvi\s*\.\s*mock\s*\(/, label: 'mocked module' },
];

export interface WeakeningReport {
  weakened: boolean;
  details: string[];
}

export function detectTestWeakening(
  diff: string,
  changedPaths: readonly string[],
): WeakeningReport {
  const details: string[] = [];
  for (const path of changedPaths) {
    if (isTestPath(path))
      details.push('Modified verification file ' + path + '.');
  }
  const added = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'));
  const removed = diff
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'));
  for (const line of added) {
    for (const marker of weakeningMarkers) {
      if (marker.pattern.test(line)) {
        details.push('Added ' + marker.label + ' in verification.');
        break;
      }
    }
    if (/process\.exit\s*\(\s*0\s*\)/.test(line))
      details.push('Added forced successful exit in verification.');
    if (/expect\s*\(\s*true\s*\)/.test(line))
      details.push('Added hardcoded successful expectation.');
  }
  const removedAssertion = removed.some((line) => /\bassert\b/i.test(line));
  const addedAssertion = added.some((line) => /\bassert\b/i.test(line));
  if (removedAssertion && !addedAssertion)
    details.push('Removed an assertion without a replacement.');
  return { weakened: details.length > 0, details };
}

const normalizeInputSchema = z
  .object({
    candidateId: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    targetExit: z.number().int().nullable(),
    regressionExit: z.number().int().nullable(),
    integrityClean: z.boolean(),
    concurrencyPass: z.boolean().nullable(),
    detail: z.string().min(1).max(2000),
  })
  .strict();

// Verification records are bound to the exact candidate digest that produced
// them. A mismatched or missing check is never normalized into a pass.
export function normalizeVerification(
  input: z.infer<typeof normalizeInputSchema>,
): NormalizedVerification {
  const value = normalizeInputSchema.parse(input);
  if (value.evidenceDigest !== value.digest)
    throw new PitCrewError(
      'STALE_EVIDENCE',
      'Verification belongs to a different candidate state.',
    );
  return {
    candidateId: value.candidateId,
    digest: value.digest,
    targetPass: value.targetExit === 0,
    regressionPass: value.regressionExit === 0,
    integrityClean: value.integrityClean,
    concurrencyPass: value.concurrencyPass,
    detail: value.detail,
  };
}

export function eliminationReason(
  verification: NormalizedVerification,
): string | undefined {
  if (!verification.integrityClean)
    return 'Modified a verification test to obtain a pass.';
  if (!verification.targetPass) return 'Failed the targeted acceptance check.';
  if (verification.concurrencyPass === false)
    return 'Passed visible tests but failed concurrency reproduction.';
  if (!verification.regressionPass)
    return 'Introduced a regression in previously passing checks.';
  return undefined;
}

export interface RefereeVerdict {
  candidateId: string;
  digest: string;
  verdict: 'VERIFIED' | 'BLOCKED' | 'NOT_PROVEN';
}

// Evidence-first selection: only a survivor with an exact-digest VERIFIED
// referee verdict can be selected. Anything else stays unselected.
export function selectCandidate(
  verifications: readonly NormalizedVerification[],
  verdicts: readonly RefereeVerdict[],
): { candidateId: string; digest: string; reason: string } | undefined {
  for (const verification of verifications) {
    if (eliminationReason(verification)) continue;
    const match = verdicts.find(
      (verdict) =>
        verdict.candidateId === verification.candidateId &&
        verdict.digest === verification.digest &&
        verdict.verdict === 'VERIFIED',
    );
    if (match)
      return {
        candidateId: verification.candidateId,
        digest: verification.digest,
        reason: 'Passed target behavior and regression checks.',
      };
  }
  return undefined;
}

export function patchIdentity(patch: string): string {
  return createHash('sha256').update(patch).digest('hex');
}

export async function treeDigest(
  root: string,
  signal: AbortSignal,
): Promise<string> {
  return (await arenaGit(root, ['rev-parse', 'HEAD^{tree}'], signal)).trim();
}

export async function savePatch(
  candidate: Candidate,
  signal: AbortSignal,
): Promise<string> {
  return arenaGit(
    candidate.root,
    [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--binary',
      candidate.baseline,
      '--',
    ],
    signal,
  );
}

// Replay a saved patch onto a fresh worktree from the same baseline and
// return the resulting tree digest. The patched content is staged and its
// index tree is compared with the original candidate tree, so identical
// patches replay to identical trees without depending on commit metadata.
export async function replayPatch(
  root: string,
  baseline: string,
  patch: string,
  destination: string,
  signal: AbortSignal,
): Promise<{ root: string; branch: string; tree: string }> {
  const branch = 'pitcrew/replay-' + randomUUID();
  await arenaGit(
    root,
    ['worktree', 'add', '-b', branch, destination, baseline],
    signal,
  );
  try {
    await runProcess(
      { executable: 'git', args: ['apply', '--whitespace=fix'] },
      {
        cwd: destination,
        signal,
        timeoutMs: 30000,
        maxOutputBytes: 8 * 1024 * 1024,
        input: patch,
      },
    );
    await arenaGit(destination, ['add', '-A'], signal);
    const tree = (await arenaGit(destination, ['write-tree'], signal)).trim();
    return { root: destination, branch, tree };
  } catch (error) {
    await disposeWorktree(root, destination, branch, signal);
    throw error;
  }
}

async function disposeWorktree(
  root: string,
  destination: string,
  branch: string,
  signal: AbortSignal,
): Promise<void> {
  const normalized = destination.replace(/\\/g, '/');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await arenaGit(
      root,
      ['worktree', 'remove', '--force', destination],
      signal,
    ).catch(() => undefined);
    const listed = await arenaGit(
      root,
      ['worktree', 'list', '--porcelain'],
      signal,
    ).catch(() => '');
    if (!listed.includes(normalized)) break;
    await rm(destination, {
      recursive: true,
      force: true,
      maxRetries: 3,
    }).catch(() => undefined);
    await arenaGit(root, ['worktree', 'prune'], signal).catch(() => undefined);
    await new Promise((done) => setTimeout(done, 100 * (attempt + 1)));
  }
  await arenaGit(root, ['branch', '-D', branch], signal).catch(() => undefined);
}

export async function disposeCandidate(
  root: string,
  candidate: Candidate,
  signal: AbortSignal,
): Promise<void> {
  await disposeWorktree(root, candidate.root, candidate.branch, signal);
}
