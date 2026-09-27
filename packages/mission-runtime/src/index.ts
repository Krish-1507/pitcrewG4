import { PitCrewError } from '@pitcrew/protocol';
import type { Mission, MissionEvent, MissionState } from '@pitcrew/protocol';

const next: Partial<Record<MissionState, readonly MissionState[]>> = {
  CREATED: ['UNDERSTANDING'],
  UNDERSTANDING: ['PLANNING'],
  PLANNING: ['BASELINING', 'AWAITING_APPROVAL'],
  AWAITING_APPROVAL: ['BASELINING', 'IMPLEMENTING'],
  BASELINING: ['IMPLEMENTING'],
  IMPLEMENTING: ['TESTING', 'AWAITING_APPROVAL'],
  TESTING: ['IMPLEMENTING', 'VERIFYING'],
  VERIFYING: ['FINAL_GATE'],
};
export function isTerminal(state: MissionState): boolean {
  return ['VERIFIED', 'BLOCKED', 'NOT_PROVEN', 'CANCELLED'].includes(state);
}
export function reduceMission(mission: Mission, event: MissionEvent): Mission {
  if (isTerminal(mission.state))
    throw new PitCrewError(
      'INTERNAL',
      'Terminal missions cannot receive mutations.',
    );
  if (event.type === 'control')
    return {
      ...mission,
      control: event.action === 'resumed' ? 'running' : event.action,
    };
  if (event.type === 'phase') {
    if (
      !['BLOCKED', 'NOT_PROVEN', 'CANCELLED'].includes(event.state) &&
      !next[mission.state]?.includes(event.state)
    )
      throw new PitCrewError('INTERNAL', 'Forbidden mission transition.');
    return { ...mission, state: event.state, message: event.message };
  }
  if (event.type === 'candidate')
    return { ...mission, candidate: event.candidate };
  if (event.type === 'referee') {
    if (mission.state !== 'FINAL_GATE' || !mission.candidate)
      throw new PitCrewError(
        'INTERNAL',
        'Final verdict requires an independent final gate and candidate.',
      );
    return { ...mission, state: event.verdict, message: event.message };
  }
  return mission;
}

export { MissionControl } from './mission-control.js';
