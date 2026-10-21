import { expect, it } from 'vitest';
import { reduceMission } from '../packages/mission-runtime/src/index.js';
import { missionSchema } from '../packages/protocol/src/index.js';
import type { Mission } from '../packages/protocol/src/index.js';

const candidate = {
  id: 'cand_1',
  root: '/tmp/candidate',
  baseline: 'b'.repeat(40),
  branch: 'pitcrew/cand_1',
};

function atGate(): Mission {
  return missionSchema.parse({
    id: 'mis_gate',
    request: 'fix',
    repo: '/tmp/repo',
    state: 'FINAL_GATE',
    message: 'awaiting referee',
    candidate,
    candidates: [candidate],
    events: [],
  });
}

it('maps a failed or missing referee verdict to blocked or not proven, never verified', () => {
  const blocked = reduceMission(atGate(), {
    type: 'referee',
    verdict: 'BLOCKED',
    digest: 'c'.repeat(64),
    artifact: 'd'.repeat(64),
    message: 'OpenPitStop rejected the candidate.',
  });
  expect(blocked.state).toBe('BLOCKED');
  const missing = reduceMission(atGate(), {
    type: 'referee',
    verdict: 'NOT_PROVEN',
    digest: 'c'.repeat(64),
    artifact: 'd'.repeat(64),
    message: 'OpenPitStop is unavailable.',
  });
  expect(missing.state).toBe('NOT_PROVEN');
});

it('rejects a verdict before the final gate and without a candidate', () => {
  const early = missionSchema.parse({
    ...atGate(),
    state: 'TESTING',
    candidate: undefined,
    candidates: undefined,
  });
  expect(() =>
    reduceMission(early, {
      type: 'referee',
      verdict: 'VERIFIED',
      digest: 'c'.repeat(64),
      artifact: 'd'.repeat(64),
      message: 'self-certified',
    }),
  ).toThrow(/final gate/);
  expect(() =>
    reduceMission(
      missionSchema.parse({
        ...atGate(),
        candidate: undefined,
        candidates: undefined,
      }),
      {
        type: 'referee',
        verdict: 'VERIFIED',
        digest: 'c'.repeat(64),
        artifact: 'd'.repeat(64),
        message: 'no candidate',
      },
    ),
  ).toThrow(/final gate/);
});
