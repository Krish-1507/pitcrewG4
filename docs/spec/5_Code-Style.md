# PitCrew Code Style

## 1. Goals

PitCrew code should be:

- boring to read;
- explicit at trust boundaries;
- strongly typed;
- easy to test without an LLM;
- modular without unnecessary abstraction;
- resistant to partial failure;
- safe around processes, paths, credentials, and untrusted repositories.

A clever implementation that hides control flow is worse than a longer explicit one.

---

## 2. Baseline

### TypeScript

- Node.js 22+
- TypeScript strict mode
- ESM
- modern runtime target
- `noImplicitAny`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes` where compatible

### React

- function components;
- hooks;
- business logic in packages/daemon, not components.

### Tauri Rust

Keep Rust glue thin.

Use `cargo fmt` and `cargo clippy`.

---

## 3. Formatting/linting

Use:

- Prettier;
- ESLint TypeScript rules;
- import-boundary linting;
- `tsc --noEmit`.

Do not hand-align object literals.

---

## 4. Naming

Files:

```text
candidate-manager.ts
mission-reducer.ts
openpitstop-adapter.ts
```

React:

```text
MissionHeader.tsx
CandidateCard.tsx
EvidenceBadge.tsx
```

Tests:

```text
candidate-manager.test.ts
MissionHeader.test.tsx
```

Types: PascalCase.  
Functions/variables: camelCase.  
Constants: uppercase only for true constants.

---

## 5. Package API

Each package has one public entry point:

```text
packages/foo/src/index.ts
```

Import:

```ts
import { createPolicyEngine } from "@pitcrew/policy-engine";
```

Avoid deep imports into package internals.

---

## 6. Dependency direction

```text
protocol
  ^
  |
domain packages
  ^
  |
daemon composition root
  ^
  |
CLI / Desktop
```

Rules:

- protocol imports no app/domain implementation;
- model gateway imports no UI;
- policy engine calls no models;
- OpenPitStop adapter imports no orchestrator;
- desktop does not execute repository commands directly.

---

## 7. Runtime validation

Parse external data with Zod:

- daemon input;
- WebSocket control;
- config YAML;
- model structured output;
- provider metadata;
- skill manifests;
- plugin messages.

Never cast unknown payload to trusted type without validation.

---

## 8. IDs

Opaque IDs with prefixes:

```text
prj_
mis_
evt_
cand_
run_
art_
apr_
fact_
```

Do not encode mutable business values into IDs.

---

## 9. Time

Database: integer epoch ms.  
API: ISO 8601 UTC.

Do not depend on host locale.

---

## 10. Events

Immutable discriminated unions.

```ts
type MissionEvent =
  | {
      type: "candidate.created";
      candidateId: CandidateId;
      baselineId: BaselineId;
    }
  | {
      type: "verification.finished";
      candidateId: CandidateId;
      verificationId: VerificationId;
      verdict: VerificationVerdict;
    };
```

Avoid `{ type: string, data: any }` inside domain packages.

---

## 11. Reducers

Mission projections must be deterministic:

```ts
nextState = reduceMission(previousState, event)
```

Reducer performs no I/O, model calls, current-time reads, or environment reads.

---

## 12. Async/cancellation

Long operations accept `AbortSignal`.

Propagate cancellation to:

- models;
- child processes;
- Docker;
- Playwright;
- scans.

Never leave untracked processes after cancellation.

---

## 13. Processes

Use `spawn`/`execFile` argv execution.

Every call defines:

- cwd;
- timeout;
- sanitized env;
- stdout/stderr capture limits;
- cancellation.

---

## 14. Logging

Structured logs:

```ts
logger.info("candidate.verify.started", {
  missionId,
  candidateId,
  verificationId
});
```

Never log:

- API keys;
- Authorization headers;
- cookies;
- `.env`;
- access tokens;
- private keys;
- full prompts by default.

---

## 15. Errors

Typed codes:

```text
POLICY_DENIED
APPROVAL_REQUIRED
PROVIDER_UNAVAILABLE
RATE_LIMITED
SANDBOX_FAILED
TOOL_ENVIRONMENT_FAILED
VERIFICATION_FAILED
STALE_EVIDENCE
TIMEOUT
CANCELLED
INTERNAL
```

Preserve original cause for technical inspection.

---

## 16. Paths

Normalize/validate every repository path.

Use helpers such as:

```ts
resolveInside(root, requestedPath)
assertNoEscapingSymlink(path)
```

PitCrew-generated files under `.pitcrew/` unless task explicitly requests source/docs.

---

## 17. Config

Project config:

```text
.pitcrew/config.yaml
```

Priority:

```text
CLI flags
> env references
> project config
> user config
> defaults
```

Secret values never live in YAML.

---

## 18. Providers

Normalize provider streaming:

```ts
type ModelEvent =
  | { type: "text.delta"; text: string }
  | { type: "tool.request"; call: ToolCall }
  | { type: "usage"; usage: Usage }
  | { type: "finish"; reason: FinishReason };
```

Do not leak provider-specific payloads through orchestration APIs.

---

## 19. Model output safety

Never execute raw model command strings directly.

Model selects structured tools.

If Expert mode supports free-form commands:

1. parse;
2. policy-check;
3. approval if required;
4. sandbox execute.

---

## 20. UI components

Components should be presentational where possible.

Bad:

```text
CandidateCard -> starts verification itself
```

Good:

```text
CandidateCard -> renders state and emits user intent
```

---

## 21. CSS/Tailwind

Prefer semantic tokens:

```tsx
className="text-status-pass"
```

not raw color utility when semantic token exists.

---

## 22. Testing

### Unit

Use Vitest for:

- policy;
- reducers;
- candidate identity;
- evidence freshness;
- routing;
- config;
- failure classification.

### Integration

Use real temp Git repos for:

- worktrees;
- candidate lifecycle;
- diff;
- OpenPitStop adapter;
- process cancellation.

### Browser

Playwright.

### Security fixtures

Include:

- prompt-injection README;
- symlink escape;
- malicious filename;
- secret-looking env;
- shell metacharacters;
- huge output;
- hung process.

---

## 23. Test quality

Tests should fail for the behavior they claim to protect.

For bug reproductions prefer:

```text
baseline fails
candidate passes
```

Avoid over-mocking Git/process/provider behavior in integration tests.

---

## 24. Comments

Explain why/constraint, not syntax.

Good:

```ts
// Capture identity before execution because the verifier itself may mutate
// the candidate. A post-run fingerprint would authorize the wrong state.
```

---

## 25. Abstraction rule

Create abstraction only if:

- two real call sites need same behavior;
- trust boundary needs isolation;
- package interface required;
- testing materially improves.

Avoid service/factory/helper layering by default.

---

## 26. Documentation

When changing contracts described in PRD/Architecture/Database/API/Security, update the relevant doc in same change.

---

## 27. Final checklist

```text
[ ] smallest reasonable scope
[ ] no unrelated formatting churn
[ ] external data validated
[ ] shell/path handling safe
[ ] secrets not logged
[ ] tests added/updated if needed
[ ] tests pass
[ ] typecheck passes
[ ] lint passes
[ ] build passes
[ ] final diff reviewed
[ ] OpenPitStop result recorded where required
[ ] limitations stated
```
