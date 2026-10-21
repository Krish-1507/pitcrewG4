import { expect, it } from 'vitest';
import { buildMergeCertificate } from '../packages/evidence/src/index.js';
import {
  mergeCertificateSchema,
  missionSchema,
} from '../packages/protocol/src/index.js';
import type { Mission, MissionEvent } from '../packages/protocol/src/index.js';

const digest = 'a'.repeat(64);
const candidate = {
  id: 'cand_1',
  root: '/tmp/candidate',
  baseline: 'b'.repeat(40),
  branch: 'pitcrew/cand_1',
};
function stored(event: MissionEvent, sequence: number) {
  return { sequence, missionId: 'mis_1', timestamp: 1, event };
}
function mission(
  overrides: Partial<Mission> = {},
  events: MissionEvent[] = [
    {
      type: 'evidence',
      label: 'OpenPitStop gate',
      artifact: digest,
      digest,
      exitCode: 0,
    },
    {
      type: 'approval.resolved',
      id: 'apr_1',
      hash: 'f'.repeat(64),
      approved: true,
    },
    {
      type: 'referee',
      verdict: 'VERIFIED',
      digest,
      artifact: digest,
      message: 'OpenPitStop independently verified the configured layers.',
    },
  ],
): Mission {
  return missionSchema.parse({
    id: 'mis_1',
    request: 'fix the failing test',
    repo: '/tmp/repo',
    state: 'VERIFIED',
    message: 'ok',
    candidate,
    candidates: [candidate],
    selection: { candidateId: 'cand_1', digest, reason: 'passed' },
    events: events.map(stored),
    ...overrides,
  });
}

it('issues a merge certificate only for an exactly verified selection', () => {
  const certificate = buildMergeCertificate(mission());
  expect(certificate).toBeDefined();
  mergeCertificateSchema.parse(certificate);
  expect(certificate?.mergeEligible).toBe(true);
  expect(certificate?.verdict).toBe('VERIFIED');
  expect(certificate?.selected?.digest).toBe(digest);
  expect(certificate?.approvals).toEqual([
    { id: 'apr_1', hash: 'f'.repeat(64), approved: true },
  ]);
  expect(certificate?.evidenceManifest).toHaveLength(1);
  expect(certificate?.limitations).toEqual([]);
});

it('refuses merge eligibility when the mission is not verified or the digest moved', () => {
  const blocked = buildMergeCertificate(mission({ state: 'BLOCKED' }));
  expect(blocked?.mergeEligible).toBe(false);
  expect(blocked?.limitations.join(' ')).toContain('No verified outcome');
  const moved = buildMergeCertificate(
    mission({
      selection: {
        candidateId: 'cand_1',
        digest: 'c'.repeat(64),
        reason: 'stale',
      },
    }),
  );
  expect(moved?.mergeEligible).toBe(false);
  expect(moved?.limitations.join(' ')).toContain(
    'does not match the independently verified digest',
  );
  const stale = buildMergeCertificate(mission({ evidenceState: 'STALE' }));
  expect(stale?.mergeEligible).toBe(false);
  expect(stale?.limitations.join(' ')).toContain('stale');
});

it('records rejected approvals and withholds a certificate without a verdict', () => {
  const rejected = buildMergeCertificate(
    mission({}, [
      {
        type: 'approval.resolved',
        id: 'apr_1',
        hash: 'f'.repeat(64),
        approved: false,
      },
      {
        type: 'referee',
        verdict: 'VERIFIED',
        digest,
        artifact: digest,
        message: 'ok',
      },
    ]),
  );
  expect(rejected?.mergeEligible).toBe(true);
  expect(rejected?.limitations.join(' ')).toContain('rejected');
  expect(buildMergeCertificate(mission({}, []))).toBeUndefined();
});
