import { mergeCertificateSchema } from '@pitcrew/protocol';
import type {
  MergeCertificate,
  Mission,
  MissionEvent,
} from '@pitcrew/protocol';

export function buildMergeCertificate(
  mission: Mission,
): MergeCertificate | undefined {
  const events: MissionEvent[] = mission.events.map((item) => item.event);
  const referee = events.findLast((event) => event.type === 'referee');
  if (!referee || referee.type !== 'referee') return undefined;
  const evidence = events
    .filter((event) => event.type === 'evidence')
    .map((event) => ({
      label: event.label,
      artifact: event.artifact,
      digest: event.digest,
      exitCode: event.exitCode,
    }));
  const approvals = events
    .filter((event) => event.type === 'approval.resolved')
    .map((event) => ({
      id: event.id,
      hash: event.hash,
      approved: event.approved,
    }));
  const limitations: string[] = [];
  if (mission.state !== 'VERIFIED')
    limitations.push(
      'No verified outcome was established; this certificate does not authorize a merge.',
    );
  if (mission.evidenceState === 'STALE')
    limitations.push(
      'Candidate bytes changed after verification; the recorded verdict is stale.',
    );
  if (mission.evidenceState === 'UNAVAILABLE')
    limitations.push(
      'Candidate evidence is unavailable; the recorded verdict cannot be revalidated.',
    );
  if (!mission.selection)
    limitations.push('No candidate was selected for integration.');
  if (mission.selection && mission.selection.digest !== referee.digest)
    limitations.push(
      'Selected candidate digest does not match the independently verified digest.',
    );
  if (approvals.some((approval) => !approval.approved))
    limitations.push(
      'At least one protected action was rejected during the mission.',
    );
  const verifier = events.findLast(
    (event) =>
      event.type === 'evidence' &&
      event.label.startsWith('OpenPitStop ') &&
      event.exitCode === 0,
  );
  if (!verifier)
    limitations.push(
      'No successful independent evidence-collection stage is recorded.',
    );
  const mergeEligible =
    mission.state === 'VERIFIED' &&
    referee.verdict === 'VERIFIED' &&
    mission.selection !== undefined &&
    mission.selection.digest === referee.digest &&
    mission.evidenceState !== 'STALE' &&
    mission.evidenceState !== 'UNAVAILABLE';
  return mergeCertificateSchema.parse({
    missionId: mission.id,
    request: mission.request,
    repo: mission.repo,
    state: mission.state,
    verdict: referee.verdict,
    mergeEligible,
    selected: mission.selection ?? null,
    referee: {
      verdict: referee.verdict,
      digest: referee.digest,
      artifact: referee.artifact,
      message: referee.message,
    },
    approvals,
    eliminated: mission.eliminations ?? [],
    evidenceManifest: evidence,
    limitations,
    generatedAt: Date.now(),
  });
}
