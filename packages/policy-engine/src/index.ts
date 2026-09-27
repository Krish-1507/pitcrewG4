import { createHash } from 'node:crypto';
import { PitCrewError } from '@pitcrew/protocol';

export type PolicyDecision =
  | { decision: 'allow' }
  | { decision: 'deny' | 'ask'; reason: string };
export function evaluatePath(
  path: string,
  action: 'read' | 'write',
): PolicyDecision {
  const parts = path.toLowerCase().split(/[\\/]/);
  if (
    parts.some(
      (p) =>
        p === '..' ||
        p.startsWith('.env') ||
        [
          '.git',
          '.pitcrew',
          '.pitstop',
          '.ssh',
          '.aws',
          '.codex',
          'node_modules',
        ].includes(p),
    ) ||
    /(?:^|\/)(?:credentials|secrets?)(?:[./]|$)|\.(?:pem|key|p12|pfx)$/i.test(
      path,
    )
  )
    return {
      decision: 'deny',
      reason: 'Protected metadata or credential path.',
    };
  if (action === 'read') return { decision: 'allow' };
  if (
    /package\.json$|lock\.|lock$|requirements|pyproject|cargo\.toml|go\.mod|\.github|\.gitlab|docker|terraform|migration|schema|auth|permission|billing|payment|security|(?:^|\/)ci(?:\/|\.)|(?:^|\/)\.\w|(?:test|spec)[./]|(?:eslint|tsconfig|vitest|vite|jest|webpack)|AGENTS\.md/i.test(
      path,
    )
  )
    return {
      decision: 'ask',
      reason:
        'Dependency, verification, policy, or security-sensitive edit requires approval.',
    };
  return { decision: 'allow' };
}
export function assertReadable(path: string): void {
  const decision = evaluatePath(path, 'read');
  if (decision.decision !== 'allow')
    throw new PitCrewError('POLICY_DENIED', decision.reason);
}
export function assertWritable(path: string): void {
  const decision = evaluatePath(path, 'write');
  if (decision.decision !== 'allow')
    throw new PitCrewError(
      decision.decision === 'ask' ? 'APPROVAL_REQUIRED' : 'POLICY_DENIED',
      decision.reason,
    );
}
export function actionHash(
  candidate: string,
  path: string,
  before: string,
  after: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ candidate, path, before, after }))
    .digest('hex');
}
