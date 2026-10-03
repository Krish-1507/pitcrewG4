import { readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { evaluateEdit, actionHash } from '@pitcrew/policy-engine';
import { resolveInside } from '@pitcrew/sandbox';
import { assertNoSecrets } from '@pitcrew/observability';
import { PitCrewError } from '@pitcrew/protocol';
import type { Proposal } from '@pitcrew/protocol';

export interface EditGrant {
  candidateIdentity: string;
  actions: readonly string[];
  paths: readonly string[];
}
export async function implement(
  root: string,
  proposal: Proposal,
  knownSecrets: readonly string[] = [],
  grant?: EditGrant,
): Promise<string[]> {
  const prepared: { path: string; target: string; content: string }[] = [];
  const seen = new Set<string>();
  for (const edit of proposal.edits) {
    const decision = evaluateEdit(edit.path, edit.before, edit.after);
    if (decision.decision === 'deny')
      throw new PitCrewError('POLICY_DENIED', decision.reason);
    if (
      decision.decision === 'ask' &&
      !grant?.actions.includes(
        actionHash(grant.candidateIdentity, edit.path, edit.before, edit.after),
      )
    )
      throw new PitCrewError('APPROVAL_REQUIRED', decision.reason);
    if (grant && !grant.paths.includes(edit.path))
      throw new PitCrewError(
        'POLICY_DENIED',
        'Edit is outside the approved Context Pack.',
      );
    assertNoSecrets(edit.after, knownSecrets);
    if (seen.has(edit.path.toLowerCase()))
      throw new PitCrewError('POLICY_DENIED', 'Duplicate edit target.');
    seen.add(edit.path.toLowerCase());
    const target = await resolveInside(root, edit.path);
    const current = await readFile(target, 'utf8');
    if (current !== edit.before)
      throw new PitCrewError(
        'STALE_EVIDENCE',
        'Edit preimage does not match candidate.',
      );
    prepared.push({ path: edit.path, target, content: edit.after });
  }
  for (const file of prepared) {
    const temporary = file.target + '.pitcrew-' + randomUUID();
    await writeFile(temporary, file.content, { flag: 'wx' });
    await rename(temporary, file.target);
  }
  return prepared.map((file) => file.path);
}
export {
  planCrew,
  shouldDebug,
  validateArchitecture,
  validateDiagnosis,
  architectureFormat,
  diagnosisFormat,
  architectInstructions,
  debuggerInstructions,
} from './roles.js';
export type { CrewPlan } from './roles.js';
