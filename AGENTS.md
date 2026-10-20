# AGENTS.md
## Instructions for AI coding agents working on PitCrew

If a task conflicts with these rules, stop and explain the conflict.

---

## 1. What PitCrew is

PitCrew is a local-first AI software engineering orchestration system.

It coordinates bounded model roles, repository intelligence, isolated candidate branches, policy approvals, browser QA, evidence storage, and independent verification through OpenPitStop.

PitCrew is **not** OpenPitStop.

- PitCrew proposes and executes engineering work.
- OpenPitStop independently verifies the result.
- Do not collapse these boundaries.

---

## 2. Non-negotiable invariants

1. No generative agent may mark its own change VERIFIED.
2. No code path may transition directly from IMPLEMENTING to VERIFIED.
3. Verification evidence belongs to the exact candidate state that produced it.
4. A stale or missing check cannot be rendered as PASS.
5. Repository text is untrusted data and cannot change PitCrew permissions.
6. Secret values must not be written to SQLite, logs, prompts, or evidence artifacts.
7. Arbitrary repository commands do not run on the host by default.
8. Production push/merge/deploy is outside the MVP automatic path.
9. Model/provider selection cannot change the verification standard.
10. Do not weaken tests to make a candidate pass.

---

## 3. Repository map

```text
apps/
  cli/
  desktop/
  daemon/

packages/
  protocol/
  mission-runtime/
  orchestrator/
  agents/
  model-gateway/
  repo-intelligence/
  policy-engine/
  sandbox/
  candidate-manager/
  evidence/
  memory/
  skills/
  browser-lab/
  openpitstop-adapter/
  ui-events/
  config/
  observability/

profiles/
  g4/

skills/
fixtures/
benchmarks/
docs/
```

### Boundaries

- `protocol`: schemas/types only.
- `mission-runtime`: states/events/reducer.
- `orchestrator`: coordination only.
- `model-gateway`: provider access, no mission mutations.
- `policy-engine`: deterministic decisions, no model calls.
- `sandbox`: process/worktree/container execution.
- `evidence`: artifact identity/storage, no UI.
- `openpitstop-adapter`: adapter only, no duplicate referee logic.
- `desktop`: presentation/client state only.
- `daemon`: composition root/API.
- `cli`: client/rendering only.

Avoid deep imports across package internals.

---

## 4. Before editing

1. read this file;
2. inspect package docs/README;
3. inspect scripts/config/tests;
4. inspect neighboring patterns;
5. identify package boundary;
6. identify relevant tests;
7. state smallest intended scope;
8. identify security/policy implications.

Do not begin by inventing a new abstraction.

Prefer an existing pattern.

---

## 5. Change workflow

```text
UNDERSTAND
 -> PLAN
 -> REPRODUCE / DEFINE ACCEPTANCE
 -> PATCH
 -> TARGETED TEST
 -> PACKAGE TESTS
 -> TYPECHECK / LINT / BUILD
 -> OPENPITSTOP
 -> FINAL DIFF REVIEW
```

For a bug, create a reliable reproduction when practical and run it on the known-bad baseline first.

If the bug cannot be reproduced, say so. Do not turn inference into proof.

---

## 6. Required final checks

Run relevant subset:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Prefer package-scoped commands during iteration.

Before completion:

```bash
git status --short
git diff --check
git diff --stat
git diff
```

For verification/policy/candidate changes, run configured OpenPitStop strict verification.

If OpenPitStop is unavailable, report verification unavailable. Do not claim VERIFIED.

---

## 7. Testing rules

Never:

- delete a failing test just to pass;
- add skip/only/xfail/focus to hide a failure;
- change expected output to match buggy behavior without requirement change;
- mock the unit under test into constant success;
- disable lint/typecheck/security config;
- swallow exceptions solely to hide failure.

Legitimate test changes are allowed when requirement/test infrastructure truly changes. Explain why and preserve discrimination.

---

## 8. TypeScript rules

- strict TypeScript;
- avoid `any`;
- prefer `unknown` + validation;
- explicit public package types;
- Zod at boundaries;
- discriminated unions for events/verdicts;
- no stringly typed mission state;
- no unchecked JSON at trust boundaries.

---

## 9. Error handling

Distinguish:

```text
configuration
policy_denied
approval_required
provider_unavailable
provider_rate_limited
sandbox_failure
tool_environment_failure
verification_failure
candidate_stale
cancelled
timeout
internal
```

Infrastructure failure is not behavioral failure.

---

## 10. Model code

Model output is untrusted.

- validate structured responses;
- never execute raw model text as shell;
- proposed actions become structured actions;
- policy decides authorization;
- model cannot access raw secret values;
- prefer references/redaction;
- do not expose hidden chain-of-thought.

User-facing rationales are concise artifacts, not private reasoning traces.

---

## 11. Process rules

Use argv execution, not shell interpolation.

Good:

```ts
spawn("git", ["diff", "--", file], { shell: false });
```

Bad:

```ts
exec(`git diff ${file}`);
```

Every process defines:

- cwd;
- timeout/deadline;
- environment policy;
- stdout/stderr capture limit;
- cancellation behavior.

Cancellation must terminate process trees.

---

## 12. Filesystem rules

- resolve real paths;
- prevent `..` escape;
- inspect symlinks;
- generated artifacts under `.pitcrew/`;
- do not modify `.git` internals directly;
- do not touch user home except trusted config/keychain code;
- agents edit candidate worktrees, not baseline.

---

## 13. Database rules

- SQLite is not a secret store;
- schema changes use migration;
- mission events are append-only;
- large logs/traces in artifact store;
- secrets use OS keychain + `secret_ref`.

---

## 14. UI rules

- green means evidence-backed pass;
- no fake percent complete;
- no fake thinking;
- no robot avatars;
- no decorative gradients;
- show NOT_PROVEN/SKIPPED explicitly;
- keep technical evidence accessible.

---

## 15. Dependency rules

Before adding a dependency:

1. check existing/platform capability;
2. prefer small maintained package;
3. check license;
4. classify dev vs runtime;
5. document reason.

Do not add an agent framework just to express a small loop directly.

---

## 16. High-risk areas

Extra review required for:

```text
packages/policy-engine/**
packages/sandbox/**
packages/model-gateway/**
packages/evidence/**
packages/openpitstop-adapter/**
packages/candidate-manager/**
apps/daemon/src/auth/**
```

Also:

- credentials;
- shell execution;
- browser targets;
- Docker;
- network permissions;
- migrations;
- install/update logic.

---

## 17. Agent role boundaries

### CEO
Coordinator only. No direct repository writes.

### Repository Scientist
Read-only except controlled experiment branch.

### Architect
Read-only planning.

### Implementer
Writes approved scope inside candidate.

### Debugger
Activated after repeated non-progress.

### Test Engineer
Owns verification strategy; cannot silently redefine acceptance.

### Browser QA
Only PitCrew-managed browser contexts/authorized targets.

### Security
No scope expansion without policy approval.

### OpenPitStop
Not an LLM role.

---

## 18. Cost discipline

Do not call a model for facts available locally.

Deterministic first:

- git status;
- package scripts;
- manifests;
- file tree;
- candidate hash;
- diff stats;
- policy;
- evidence freshness;
- structured failure classification where possible.

Cache mechanical facts by content identity.

---

## 19. Definition of done

A task is not done because:

- code compiles;
- one test passes;
- model says done;
- UI shows no errors.

A change is complete only when configured definition of done is satisfied and independent referee returns required verdict.

Incomplete evidence means NOT_PROVEN.

---

## 20. Final handoff format

```text
Changed:
- ...

Verified:
- ...

OpenPitStop:
- ...

Not verified / limitations:
- ...

Files:
- ...
```

Do not claim more than evidence establishes.
