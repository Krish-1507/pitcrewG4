import { readFile, writeFile } from 'node:fs/promises';
import { fingerprint } from '@pitcrew/candidate-manager';
import { resolveInside } from '@pitcrew/sandbox';
import {
  blindspotReportSchema,
  blindspotMutationSchema,
  PitCrewError,
} from '@pitcrew/protocol';
import type {
  AssumptionEntry,
  BlindspotAssumption,
  BlindspotFinding,
  BlindspotMutation,
  BlindspotReport,
} from '@pitcrew/protocol';

export interface VerifyResult {
  exitCode: number | null;
  detail?: string;
}
export interface BlindspotOptions {
  root: string;
  mutations: readonly BlindspotMutation[];
  assumptions?: readonly BlindspotAssumption[];
  verify: (root: string, signal: AbortSignal) => Promise<VerifyResult>;
  signal: AbortSignal;
}

export async function applyMutation(
  root: string,
  mutation: BlindspotMutation,
): Promise<{ original: string; mutated: string }> {
  const parsed = blindspotMutationSchema.parse(mutation);
  const target = await resolveInside(root, parsed.path);
  const original = await readFile(target, 'utf8');
  const matches = original.split(parsed.find).length - 1;
  if (matches !== 1)
    throw new PitCrewError(
      'CONFIGURATION',
      'Mutation ' +
        parsed.id +
        ' must match exactly one occurrence; found ' +
        matches +
        '.',
    );
  const mutated = original.replace(parsed.find, parsed.replace);
  await writeFile(target, mutated, 'utf8');
  return { original, mutated };
}

export async function runBlindspot(
  options: BlindspotOptions,
): Promise<BlindspotReport> {
  const before = await fingerprint(options.root, options.signal);
  const findings: BlindspotFinding[] = [];
  for (const mutation of options.mutations) {
    options.signal.throwIfAborted();
    const parsed = blindspotMutationSchema.parse(mutation);
    const target = await resolveInside(options.root, parsed.path);
    const original = await readFile(target, 'utf8');
    const matches = original.split(parsed.find).length - 1;
    if (matches !== 1)
      throw new PitCrewError(
        'CONFIGURATION',
        'Mutation ' +
          parsed.id +
          ' must match exactly one occurrence; found ' +
          matches +
          '.',
      );
    let result: VerifyResult;
    try {
      await writeFile(
        target,
        original.replace(parsed.find, parsed.replace),
        'utf8',
      );
      result = await options.verify(options.root, options.signal);
    } finally {
      await writeFile(target, original, 'utf8');
    }
    const survived = result.exitCode === 0;
    findings.push({
      mutationId: parsed.id,
      category: parsed.category,
      description: parsed.description,
      path: parsed.path,
      outcome: survived ? 'survived' : 'killed',
      verifierExitCode: result.exitCode,
      detail: survived
        ? 'Existing verification passed with the mutation applied.'
        : 'Existing verification rejected the mutation.',
    });
  }
  const after = await fingerprint(options.root, options.signal);
  if (before !== after)
    throw new PitCrewError(
      'STALE_EVIDENCE',
      'Blindspot mutations did not restore the candidate bytes.',
    );
  const byMutation = new Map(findings.map((f) => [f.mutationId, f]));
  const ledger: AssumptionEntry[] = (options.assumptions ?? []).map(
    (assumption) => {
      const finding = assumption.mutationId
        ? byMutation.get(assumption.mutationId)
        : undefined;
      const state = finding
        ? finding.outcome === 'survived'
          ? assumption.declaredProtected
            ? 'CONTRADICTED'
            : 'UNPROTECTED'
          : 'PROTECTED'
        : assumption.volatile
          ? 'EXTERNAL_VOLATILE'
          : 'INFERRED';
      return {
        id: assumption.id,
        statement: assumption.statement,
        state,
        mutationId: assumption.mutationId,
      };
    },
  );
  const report: BlindspotReport = {
    candidateDigest: after,
    findings,
    ledger,
    verificationDebt: findings
      .filter((finding) => finding.outcome === 'survived')
      .map((finding) => finding.mutationId),
  };
  return blindspotReportSchema.parse(report);
}
