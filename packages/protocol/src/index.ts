import { z } from 'zod';

export const verdictSchema = z.enum(['VERIFIED', 'BLOCKED', 'NOT_PROVEN']);
export type Verdict = z.infer<typeof verdictSchema>;
export const stateSchema = z.enum([
  'CREATED',
  'UNDERSTANDING',
  'PLANNING',
  'AWAITING_APPROVAL',
  'BASELINING',
  'IMPLEMENTING',
  'TESTING',
  'VERIFYING',
  'FINAL_GATE',
  'VERIFIED',
  'BLOCKED',
  'NOT_PROVEN',
  'CANCELLED',
]);
export type MissionState = z.infer<typeof stateSchema>;
export const phaseSchema = stateSchema.exclude(['VERIFIED']);
export const commandSchema = z
  .object({ executable: z.string().min(1), args: z.array(z.string()).max(128) })
  .strict();
export type Command = z.infer<typeof commandSchema>;
export const providerSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('codex'),
      executable: z.string().min(1),
      model: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('openai-compatible'),
      baseUrl: z.string().url(),
      model: z.string().min(1),
      apiKeyEnv: z
        .string()
        .regex(/^[A-Z][A-Z0-9_]*$/)
        .optional(),
    })
    .strict(),
]);
export type ProviderConfig = z.infer<typeof providerSchema>;
export const configSchema = z
  .object({
    provider: providerSchema,
    execution: z
      .object({
        allowReducedIsolation: z.boolean().default(false),
        dockerExecutable: z.string().default('docker'),
        image: z.string().default('node:22-bookworm-slim'),
      })
      .strict(),
    referee: z
      .object({
        executable: z.string().min(1),
        args: z.array(z.string()).default([]),
        requiredLayers: z
          .array(z.string().regex(/^[a-z]+$/))
          .default(['stack', 'architecture', 'baseline']),
      })
      .strict(),
    test: commandSchema.optional(),
    budget: z
      .object({
        maxModelCalls: z.number().int().min(1).max(50).default(4),
        timeoutMs: z.number().int().min(1000).max(3600000).default(600000),
      })
      .strict()
      .default({}),
  })
  .strict();
export type RuntimeConfig = z.infer<typeof configSchema>;
export const editSchema = z
  .object({
    path: z.string().min(1).max(500),
    before: z.string().max(131072),
    after: z.string().max(131072),
  })
  .strict();
export const proposalSchema = z
  .object({
    summary: z.string().min(1).max(2000),
    edits: z.array(editSchema).min(1).max(20),
  })
  .strict();
export type Proposal = z.infer<typeof proposalSchema>;
export const candidateSchema = z
  .object({
    id: z.string(),
    root: z.string(),
    baseline: z.string(),
    branch: z.string(),
  })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const eventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('control'),
      action: z.enum(['pause_requested', 'paused', 'resumed']),
    })
    .strict(),
  z
    .object({
      type: z.literal('approval.requested'),
      id: z.string(),
      hash: z.string(),
      candidateId: z.string(),
      artifact: z.string(),
      reason: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('approval.resolved'),
      id: z.string(),
      hash: z.string(),
      approved: z.boolean(),
    })
    .strict(),

  z
    .object({
      type: z.literal('phase'),
      state: phaseSchema,
      message: z.string(),
    })
    .strict(),
  z
    .object({ type: z.literal('candidate'), candidate: candidateSchema })
    .strict(),
  z
    .object({
      type: z.literal('evidence'),
      label: z.string(),
      artifact: z.string(),
      digest: z.string(),
      exitCode: z.number().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('model'),
      calls: z.number().int(),
      provider: z.string(),
      costUsd: z.number().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('referee'),
      verdict: verdictSchema,
      digest: z.string(),
      artifact: z.string(),
      message: z.string(),
    })
    .strict(),
]);
export type MissionEvent = z.infer<typeof eventSchema>;
export const storedEventSchema = z.object({
  sequence: z.number().int(),
  missionId: z.string(),
  timestamp: z.number(),
  event: eventSchema,
});
export type StoredEvent = z.infer<typeof storedEventSchema>;
export const missionSchema = z.object({
  id: z.string(),
  request: z.string(),
  repo: z.string(),
  state: stateSchema,
  message: z.string(),
  candidate: candidateSchema.optional(),
  events: z.array(storedEventSchema),
  control: z.enum(['running', 'pause_requested', 'paused']).optional(),
  evidenceState: z.enum(['CURRENT', 'STALE', 'UNAVAILABLE']).optional(),
});
export type Mission = z.infer<typeof missionSchema>;
export const errorCodeSchema = z.enum([
  'CONFIGURATION',
  'POLICY_DENIED',
  'APPROVAL_REQUIRED',
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'SANDBOX_FAILED',
  'TOOL_ENVIRONMENT_FAILED',
  'VERIFICATION_FAILED',
  'STALE_EVIDENCE',
  'TIMEOUT',
  'CANCELLED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export class PitCrewError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PitCrewError';
  }
}
