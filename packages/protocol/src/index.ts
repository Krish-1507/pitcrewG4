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
  'SELECTING',
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
      type: z.enum(['openai-compatible', 'freellmapi', 'ollama']),
      baseUrl: z.string().url(),
      model: z.string().min(1),
      secretRef: z
        .string()
        .regex(/^keychain:pitcrew\/prov_[a-f0-9-]+$/)
        .optional(),
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
    routing: z
      .object({
        profile: z.enum(['economy', 'balanced', 'deep', 'local', 'manual']),
        providers: z
          .array(
            z
              .object({
                id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
                provider: providerSchema,
                roles: z.array(z.string().min(1)).min(1),
                enabled: z.boolean().default(true),
                local: z.boolean().default(false),
                highRisk: z.boolean().default(false),
                tools: z.boolean().default(false),
                maxContextChars: z.number().int().positive().max(2000000),
                estimatedCostUsd: z.number().finite().nonnegative().optional(),
              })
              .strict(),
          )
          .min(1)
          .max(16),
      })
      .strict()
      .refine(
        (value) =>
          new Set(value.providers.map((p) => p.id)).size ===
          value.providers.length,
        'Duplicate provider route id',
      )
      .optional(),
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
        maxCostUsdPerCall: z.number().finite().nonnegative().optional(),
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
export const branchTriggerSchema = z.enum([
  'weak-proof',
  'uncertain-hypothesis',
  'repeated-failure',
  'high-risk',
  'architecture-fork',
]);
export type BranchTrigger = z.infer<typeof branchTriggerSchema>;
export const arenaHypothesisSchema = z
  .object({
    key: z.string().min(1).max(64),
    hypothesis: z.string().min(1).max(2000),
  })
  .strict();
export type ArenaHypothesis = z.infer<typeof arenaHypothesisSchema>;
export const normalizedVerificationSchema = z
  .object({
    candidateId: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    targetPass: z.boolean(),
    regressionPass: z.boolean(),
    integrityClean: z.boolean(),
    concurrencyPass: z.boolean().nullable(),
    detail: z.string().min(1).max(2000),
  })
  .strict();
export type NormalizedVerification = z.infer<
  typeof normalizedVerificationSchema
>;
export const mutationCategorySchema = z.enum([
  'authz',
  'idempotency',
  'permission',
  'validation',
  'architecture',
  'error-handling',
]);
export type MutationCategory = z.infer<typeof mutationCategorySchema>;
export const blindspotMutationSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    category: mutationCategorySchema,
    description: z.string().min(1).max(1000),
    path: z.string().min(1).max(500),
    find: z.string().min(1).max(20000),
    replace: z.string().max(20000),
  })
  .strict();
export type BlindspotMutation = z.infer<typeof blindspotMutationSchema>;
export const blindspotAssumptionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    statement: z.string().min(1).max(1000),
    mutationId: z.string().nullable().default(null),
    declaredProtected: z.boolean().default(false),
    volatile: z.boolean().default(false),
  })
  .strict();
export type BlindspotAssumption = z.infer<typeof blindspotAssumptionSchema>;
export const assumptionStateSchema = z.enum([
  'PROTECTED',
  'INFERRED',
  'UNPROTECTED',
  'EXTERNAL_VOLATILE',
  'CONTRADICTED',
]);
export type AssumptionState = z.infer<typeof assumptionStateSchema>;
export const blindspotFindingSchema = z
  .object({
    mutationId: z.string(),
    category: mutationCategorySchema,
    description: z.string(),
    path: z.string(),
    outcome: z.enum(['killed', 'survived']),
    verifierExitCode: z.number().nullable(),
    detail: z.string().max(2000),
  })
  .strict();
export type BlindspotFinding = z.infer<typeof blindspotFindingSchema>;
export const assumptionEntrySchema = z
  .object({
    id: z.string(),
    statement: z.string(),
    state: assumptionStateSchema,
    mutationId: z.string().nullable(),
  })
  .strict();
export type AssumptionEntry = z.infer<typeof assumptionEntrySchema>;
export const blindspotReportSchema = z
  .object({
    candidateDigest: z.string().regex(/^[a-f0-9]{64}$/),
    findings: z.array(blindspotFindingSchema),
    ledger: z.array(assumptionEntrySchema),
    verificationDebt: z.array(z.string()),
  })
  .strict();
export type BlindspotReport = z.infer<typeof blindspotReportSchema>;
export const eventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('delegation'),
      id: z.string(),
      role: z.enum([
        'ceo',
        'repository-scientist',
        'architect',
        'implementer',
        'debugger',
        'test-engineer',
      ]),
      status: z.enum(['started', 'completed', 'failed']),
      mode: z.enum(['deterministic', 'model']),
      paths: z.array(z.string()),
      artifact: z.string().optional(),
    })
    .strict(),

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
      type: z.literal('arena.decision'),
      branch: z.boolean(),
      triggers: z.array(branchTriggerSchema).max(5),
      reason: z.string().min(1).max(2000),
      hypotheses: z.array(arenaHypothesisSchema).min(1).max(8),
    })
    .strict(),
  z
    .object({
      type: z.literal('candidate.eliminated'),
      candidateId: z.string().min(1),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal('candidate.selected'),
      candidateId: z.string().min(1),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().min(1).max(2000),
    })
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
  candidates: z.array(candidateSchema).max(8).optional(),
  eliminations: z
    .array(
      z
        .object({
          candidateId: z.string(),
          digest: z.string(),
          reason: z.string(),
        })
        .strict(),
    )
    .max(8)
    .optional(),
  selection: z
    .object({
      candidateId: z.string(),
      digest: z.string(),
      reason: z.string(),
    })
    .strict()
    .optional(),
  events: z.array(storedEventSchema),
  control: z.enum(['running', 'pause_requested', 'paused']).optional(),
  evidenceState: z.enum(['CURRENT', 'STALE', 'UNAVAILABLE']).optional(),
});
export type Mission = z.infer<typeof missionSchema>;
export const evidenceEntrySchema = z
  .object({
    label: z.string(),
    artifact: z.string(),
    digest: z.string(),
    exitCode: z.number().nullable(),
  })
  .strict();
export type EvidenceEntry = z.infer<typeof evidenceEntrySchema>;
export const mergeCertificateSchema = z
  .object({
    missionId: z.string(),
    request: z.string(),
    repo: z.string(),
    state: stateSchema,
    verdict: verdictSchema,
    mergeEligible: z.boolean(),
    selected: z
      .object({
        candidateId: z.string(),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        reason: z.string(),
      })
      .strict()
      .nullable(),
    referee: z
      .object({
        verdict: verdictSchema,
        digest: z.string(),
        artifact: z.string(),
        message: z.string(),
      })
      .strict()
      .nullable(),
    approvals: z.array(
      z
        .object({ id: z.string(), hash: z.string(), approved: z.boolean() })
        .strict(),
    ),
    eliminated: z.array(
      z
        .object({
          candidateId: z.string(),
          digest: z.string(),
          reason: z.string(),
        })
        .strict(),
    ),
    evidenceManifest: z.array(evidenceEntrySchema),
    limitations: z.array(z.string()),
    generatedAt: z.number(),
  })
  .strict();
export type MergeCertificate = z.infer<typeof mergeCertificateSchema>;
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

export const sourceEvidenceSchema = z
  .object({
    path: z.string(),
    line: z.number().int().positive(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export const repoFactSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    predicate: z.string(),
    value: z.string(),
    kind: z.enum(['observed', 'inferred', 'user_declared']),
    evidence: sourceEvidenceSchema,
    dependencies: z.record(z.string()),
    stale: z.boolean(),
  })
  .strict();
export type RepoFact = z.infer<typeof repoFactSchema>;
export const repositoryGraphSchema = z
  .object({
    root: z.string(),
    head: z.string(),
    dirty: z.boolean(),
    observedAt: z.number(),
    boundaryDigest: z.string(),
    files: z.array(
      z
        .object({
          path: z.string(),
          digest: z.string(),
          language: z.string(),
          parser: z.string(),
          parseErrors: z.boolean(),
        })
        .strict(),
    ),
    facts: z.array(repoFactSchema),
    relationships: z.array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          kind: z.enum(['observed', 'inferred', 'user_declared']),
          relation: z.string(),
          evidence: sourceEvidenceSchema,
        })
        .strict(),
    ),
    limitations: z.array(z.string()),
  })
  .strict();
export type RepositoryGraph = z.infer<typeof repositoryGraphSchema>;
export const storyViewSchema = z.enum([
  'product',
  'system',
  'request-journey',
  'change-impact',
  'trust',
]);
export type StoryView = z.infer<typeof storyViewSchema>;
export const storyItemSchema = z
  .object({
    view: storyViewSchema,
    statement: z.string().min(1).max(500),
    kind: z.enum(['observed', 'inferred', 'user_declared']),
    evidence: z.array(sourceEvidenceSchema).min(1).max(8),
  })
  .strict();
export type StoryItem = z.infer<typeof storyItemSchema>;
export const repoStorySchema = z
  .object({
    root: z.string(),
    head: z.string(),
    boundaryDigest: z.string(),
    items: z.array(storyItemSchema),
    limitations: z.array(z.string()),
  })
  .strict();
export type RepoStory = z.infer<typeof repoStorySchema>;
export const registeredProviderSchema = z
  .object({
    id: z.string().regex(/^prov_[a-f0-9-]+$/),
    name: z.string().min(1).max(100),
    config: providerSchema,
  })
  .strict();
export type RegisteredProvider = z.infer<typeof registeredProviderSchema>;

export const roleSchema = z.enum([
  'ceo',
  'repository-scientist',
  'architect',
  'implementer',
  'debugger',
  'test-engineer',
]);
export type AgentRole = z.infer<typeof roleSchema>;
export const architecturePlanSchema = z
  .object({
    goal: z.string().min(1).max(2000),
    assumptions: z.array(z.string().max(1000)).max(20),
    expected_paths: z.array(z.string().min(1).max(500)).min(1).max(30),
    acceptance: z.array(z.string().min(1).max(1000)).min(1).max(20),
    risk: z.enum(['low', 'medium', 'high']),
    verification: z.array(commandSchema).min(1).max(10),
  })
  .strict();
export type ArchitecturePlan = z.infer<typeof architecturePlanSchema>;
export const diagnosisSchema = z
  .object({
    summary: z.string().min(1).max(2000),
    hypotheses: z
      .array(
        z
          .object({
            cause: z.string().min(1).max(2000),
            evidence_paths: z.array(z.string().max(500)).min(1).max(30),
            next_experiment: z.string().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();
export type Diagnosis = z.infer<typeof diagnosisSchema>;
