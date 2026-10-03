import {
  architecturePlanSchema,
  diagnosisSchema,
  PitCrewError,
} from '@pitcrew/protocol';
import type { ArchitecturePlan, Diagnosis, Command } from '@pitcrew/protocol';
import { evaluatePath } from '@pitcrew/policy-engine';

export interface CrewPlan {
  goal: string;
  writePaths: string[];
  architect: boolean;
  acceptance: Command;
  risk: 'low' | 'high';
}
export function planCrew(
  goal: string,
  sourcePaths: readonly string[],
  test: Command,
): CrewPlan {
  const writePaths = [
    ...new Set(
      sourcePaths.filter(
        (path) => evaluatePath(path, 'write').decision === 'allow',
      ),
    ),
  ];
  const modules = new Set(
    writePaths.map((path) => path.split('/').slice(0, -1).join('/')),
  );
  return {
    goal,
    writePaths,
    architect: modules.size > 1,
    acceptance: { executable: test.executable, args: [...test.args] },
    risk: /auth|permission|tenant|billing|payment|migration|deploy|security/i.test(
      goal + '\n' + sourcePaths.join('\n'),
    )
      ? 'high'
      : 'low',
  };
}
export function shouldDebug(
  failedAttempts: number,
  alreadyDiagnosed: boolean,
): boolean {
  return failedAttempts >= 2 && !alreadyDiagnosed;
}
export function validateArchitecture(
  value: unknown,
  crew: CrewPlan,
): ArchitecturePlan {
  const plan = architecturePlanSchema.parse(value);
  if (plan.expected_paths.some((path) => !crew.writePaths.includes(path)))
    throw new PitCrewError(
      'POLICY_DENIED',
      'Architect attempted to expand candidate write scope.',
    );
  if (
    plan.verification.length !== 1 ||
    JSON.stringify(plan.verification[0]) !== JSON.stringify(crew.acceptance)
  )
    throw new PitCrewError(
      'POLICY_DENIED',
      'Architect cannot redefine the frozen acceptance command.',
    );
  return plan;
}
export function validateDiagnosis(
  value: unknown,
  paths: readonly string[],
): Diagnosis {
  const diagnosis = diagnosisSchema.parse(value);
  if (
    diagnosis.hypotheses.some((h) =>
      h.evidence_paths.some((path) => !paths.includes(path)),
    )
  )
    throw new PitCrewError(
      'POLICY_DENIED',
      'Debugger cited evidence outside its Context Pack.',
    );
  return diagnosis;
}
const string = { type: 'string' };
const strings = { type: 'array', items: string };
export const architectureFormat: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'goal',
    'assumptions',
    'expected_paths',
    'acceptance',
    'risk',
    'verification',
  ],
  properties: {
    goal: string,
    assumptions: strings,
    expected_paths: strings,
    acceptance: strings,
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    verification: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['executable', 'args'],
        properties: { executable: string, args: strings },
      },
    },
  },
};
export const diagnosisFormat: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'hypotheses'],
  properties: {
    summary: string,
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cause', 'evidence_paths', 'next_experiment'],
        properties: {
          cause: string,
          evidence_paths: strings,
          next_experiment: string,
        },
      },
    },
  },
};
export const architectInstructions =
  'You are the read-only PitCrew Architect. Return the bounded architecture plan matching the JSON schema. Use only writePaths in the supplied crew plan. Preserve the exact executable and argv in acceptance as the single verification command. Label assumptions explicitly. No edits, commands, permissions or verification verdicts.';
export const debuggerInstructions =
  'You are the read-only PitCrew Debugger. Diagnose repeated behavioral test failures using only the provided source and real test evidence. Return concise hypotheses with evidence_paths and a next_experiment description. Do not execute experiments, edit files, change tests or certify work. Do not provide private reasoning traces.';
