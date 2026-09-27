import { z } from 'zod';
import { runProcess } from '@pitcrew/sandbox';
import { fingerprint } from '@pitcrew/candidate-manager';
import { PitCrewError } from '@pitcrew/protocol';
import type { Candidate, RuntimeConfig, Verdict } from '@pitcrew/protocol';
import type { ProcessResult } from '@pitcrew/sandbox';

export const gateSchema = z.object({
  verdict: z.enum(['VERIFIED', 'BLOCKED', 'FAILED', 'CHEAT', 'UNPROVEN']),
  pass: z.boolean(),
  exitCode: z.number().int(),
  layers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.string(),
      detail: z.string(),
      reasons: z.array(z.string()),
    }),
  ),
  reasons: z.array(z.string()),
});
export interface RefereeResult {
  verdict: Verdict;
  digest: string;
  result: ProcessResult;
  message: string;
}
export async function invokeReferee(
  config: RuntimeConfig['referee'],
  candidate: Candidate,
  args: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ProcessResult> {
  const before = await fingerprint(candidate.root, signal);
  const result = await runProcess(
    { executable: config.executable, args: [...config.args, ...args] },
    { cwd: candidate.root, signal, timeoutMs, maxOutputBytes: 4 * 1024 * 1024 },
  );
  const after = await fingerprint(candidate.root, signal);
  if (before !== after)
    throw new PitCrewError(
      'STALE_EVIDENCE',
      'OpenPitStop changed candidate source; verification invalidated.',
    );
  return result;
}
export async function gate(
  config: RuntimeConfig['referee'],
  candidate: Candidate,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<RefereeResult> {
  const digest = await fingerprint(candidate.root, signal);
  const result = await invokeReferee(
    config,
    candidate,
    [
      'gate',
      '--json',
      '--strict',
      '--require',
      config.requiredLayers.join(','),
    ],
    signal,
    timeoutMs,
  );
  let parsed: z.infer<typeof gateSchema>;
  try {
    parsed = gateSchema.parse(JSON.parse(result.stdout));
  } catch {
    throw new PitCrewError(
      'VERIFICATION_FAILED',
      'OpenPitStop gate returned invalid JSON. No verified outcome is possible.',
    );
  }
  const verified =
    parsed.verdict === 'VERIFIED' &&
    parsed.pass &&
    parsed.exitCode === 0 &&
    result.exitCode === 0 &&
    config.requiredLayers.every((id) =>
      parsed.layers.some((layer) => layer.id === id && layer.status === 'PASS'),
    );
  const verdict: Verdict = verified
    ? 'VERIFIED'
    : ['BLOCKED', 'FAILED', 'CHEAT'].includes(parsed.verdict)
      ? 'BLOCKED'
      : 'NOT_PROVEN';
  return {
    verdict,
    digest,
    result,
    message:
      parsed.reasons.join('; ') ||
      (verified
        ? 'OpenPitStop independently verified the configured layers.'
        : 'Required independent evidence is incomplete.'),
  };
}
