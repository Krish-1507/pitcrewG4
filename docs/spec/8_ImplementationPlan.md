# PitCrew Implementation Plan

## 1. Delivery rule

Build from the trust boundary outward.

Do not start with desktop animation, ten agents, or a marketplace.

The first proof is:

```text
user mission
 -> real repo understanding
 -> isolated candidate
 -> real model edit
 -> real test
 -> real OpenPitStop verdict
 -> inspectable evidence
```

Everything else earns its place after that vertical slice works.

---

## Milestone 0: Repository foundation

Create monorepo and CI.

Set up:

- pnpm workspace;
- Turborepo;
- strict TS;
- ESLint;
- Prettier;
- Vitest;
- build;
- Windows + Linux CI;
- docs;
- MIT;
- SECURITY.md;
- CONTRIBUTING.md.

Acceptance:

```text
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

all pass.

---

## Milestone 1: CLI vertical slice

Goal:

```bash
pitcrew "fix the failing test"
```

must produce a real candidate and evidence.

Build:

1. daemon startup;
2. CLI connects;
3. project open;
4. Git baseline inspection;
5. single OpenAI-compatible provider;
6. one Implementer role;
7. structured file read/edit tools;
8. Git worktree candidate;
9. test command discovery;
10. sandboxed command runner;
11. OpenPitStop adapter;
12. final diff + verdict.

Do not build desktop/swarm/Browser QA yet.

Acceptance fixture:

```text
baseline test = FAIL
candidate test = PASS
OpenPitStop gate = expected result
candidate diff replayable
baseline untouched
```

---

## Milestone 2: Mission runtime and policy

Build:

- event store;
- reducer;
- pause/resume/cancel;
- approvals;
- policy engine;
- process cancellation;
- project lock;
- budgets.

Tests:

- runtime dependency asks;
- migration asks;
- auth change asks;
- normal source edit allowed;
- secret read denied;
- production deploy denied;
- README prompt injection ignored;
- cancel kills process tree.

Acceptance: replay from events gives identical mission projection.

---

## Milestone 3: Repository intelligence

Build mechanical inventory:

- Git;
- manifests;
- scripts;
- tests;
- CI;
- migrations;
- configs.

Build structural graph:

- Tree-sitter;
- imports;
- symbols;
- routes;
- test relationships.

Build Context Packs and evidence-backed memory.

Acceptance:

- Repo Story facts point to real source evidence;
- changing manifest/auth/CI invalidates relevant facts.

---

## Milestone 4: Model gateway and routing

Adapters:

1. OpenAI-compatible HTTP.
2. Ollama.
3. FreeLLMAPI preset.
4. CLI bridge framework.

Profiles:

```text
economy
balanced
deep
local
manual
```

Routing:

- role;
- risk;
- context;
- tools;
- prior failure;
- cost ceiling;
- provider health.

Acceptance:

- failover only to configured provider;
- cost ceiling blocks disallowed call;
- no secrets in DB/logs;
- unknown cost stays unknown.

---

## Milestone 5: Bounded specialist crew

Add:

- CEO;
- Repository Scientist;
- Architect;
- Implementer;
- Debugger;
- Test Engineer.

Do not instantiate all roles for every mission.

Architect output:

```yaml
goal:
assumptions:
expected_paths:
acceptance:
risk:
verification:
```

Acceptance:

- trivial one-file task uses one path;
- multi-module task activates Architect;
- repeated failure activates Debugger.

---

## Milestone 6: Candidate identity and Arena

Build:

- candidate identity;
- candidate A/B lifecycle;
- independent hypotheses;
- patch save/replay;
- verification normalization;
- elimination;
- final selection.

Branch when:

- proof weak;
- hypothesis uncertain;
- repeated failure;
- high-risk policy;
- material architecture fork.

Hero fixture: duplicate checkout order race.

Candidate A fails concurrency. Candidate B weakens a test and is eliminated. Correct candidate survives and OpenPitStop verifies it.

---

## Milestone 7: Blindspot Engine

Build Assumption Ledger:

```text
PROTECTED
INFERRED
UNPROTECTED
EXTERNAL_VOLATILE
CONTRADICTED
```

Controlled mutations in disposable candidates:

- remove auth check;
- remove idempotency;
- invert permission;
- bypass validation;
- violate architecture;
- weaken error handling.

Run existing verification.

If important mutation survives, record verification debt.

Acceptance: fixture with intentionally weak suite produces real blindspot, then adding verifier converts it to protected.

---

## Milestone 8: Repo Story

Views:

- Product;
- System;
- Request Journey;
- Change Impact;
- Trust.

Every relationship marked observed/inferred/user-declared with evidence.

Acceptance: trace user action to source and show protected/unprotected assumption.

---

## Milestone 9: Browser QA Lab

Build:

- isolated Playwright profile;
- observe/headless/replay;
- semantic targeting first;
- traces/screenshots/console/network;
- counterfactual network scenarios;
- axe integration;
- regression test generation.

First scenarios:

- happy path;
- invalid input;
- API 500;
- timeout;
- double submit;
- unauthorized role;
- multi-tab;
- keyboard-only.

Acceptance: seeded UI recovery defect is discovered, reproduced twice, converted to deterministic test, fails baseline, passes candidate.

---

## Milestone 10: Desktop Mission Control

Only after CLI/core is reliable.

Screens:

1. Project Home
2. New Mission
3. Mission Control
4. Decision/Approval
5. Candidate Arena
6. Repo Story
7. Browser Lab
8. Evidence
9. Provider Settings

UI reflects real daemon events only.

---

## Milestone 11: Merge Certificate and replay

Certificate includes:

- selected candidate;
- exact identity;
- acceptance;
- verification coverage;
- OpenPitStop verdict;
- approvals;
- eliminated candidates;
- limitations;
- evidence manifest.

`pitcrew replay <mission>` reconstructs timeline.

Rerun verification creates new evidence rather than re-labeling historical evidence current.

---

## Milestone 12: Skills and integrations

Skill layout:

```text
skills/<skill>/
  SKILL.md
  manifest.json
  schemas/
  scripts/
```

Initial skills:

- architecture;
- debugging;
- API contract;
- database safety;
- security review;
- accessibility;
- browser QA;
- performance;
- documentation.

Skills request permissions, never grant them.

MCP after policy/tool contracts stabilize.

---

## Milestone 13: Benchmark

Create `benchmarks/pitcrew-core`.

Task families:

- simple bug;
- multi-file feature;
- architecture boundary;
- authz;
- concurrency;
- visible-test blindspot;
- browser recovery;
- migration;
- dependency;
- environment failure.

Compare:

```text
A. strong single-path coding agent
B. PitCrew single-path
C. PitCrew adaptive Arena + OpenPitStop
```

Metrics:

```text
task success
acceptance
false done
regression
architecture violations
security escapes
model calls
time
known cost
human approvals
```

Publish raw results.

---

## Milestone 14: PitCrew-G4 profile

After core abstractions are stable.

```text
profiles/g4/
  agent.yaml
  prompts/
  skills/
  scripts/
```

Map:

- Context Pack -> competition repository/graph tools;
- candidate identity -> lightweight diff hash;
- budget controller -> competition status;
- Arena -> PBTS candidate A/B;
- final gate -> deterministic scripts;
- apply -> submit patch tool.

Do not include:

- desktop;
- provider gateway;
- FreeLLMAPI;
- arbitrary research;
- full Browser Lab unless useful/supported;
- full OpenPitStop CLI if overhead hurts score.

---

## Milestone 15: Release hardening

Clean-machine tests:

- Windows;
- Linux;
- macOS;
- Docker present/absent;
- local model;
- OpenAI-compatible provider;
- OpenPitStop missing;
- interrupted mission;
- dirty Git tree;
- large repo;
- monorepo.

Required docs:

- README;
- quickstart;
- provider setup;
- sandbox security;
- troubleshooting;
- limitations;
- benchmark methodology;
- third-party notices.

---

## Build priority

### P0

- CLI vertical slice;
- candidate isolation;
- mission runtime;
- policy;
- OpenPitStop;
- evidence.

### P1

- repo intelligence;
- provider routing;
- Arena;
- Blindspot Engine;
- Repo Story.

### P2

- Browser Lab;
- desktop;
- skills;
- automation;
- G4 profile.

Cut P2 UI breadth before weakening trust boundaries.

---

## Do not build yet

- marketplace;
- cloud account;
- billing;
- remote team server;
- dozens of agents;
- custom model training;
- production deploy automation;
- every provider integration;
- fancy graph animation before correctness;
- autonomous public-site security testing.

---

## Public beta release gate

```text
[ ] baseline never edited by agent
[ ] candidate work survives daemon restart
[ ] cancellation kills process tree
[ ] secrets absent from DB/logs
[ ] prompt-injection fixture cannot gain permissions
[ ] high-risk actions require real approval
[ ] stale evidence cannot authorize changed candidate
[ ] OpenPitStop failure blocks verified state
[ ] missing OpenPitStop yields NOT_PROVEN
[ ] benchmark raw results published
[ ] clean installation verified
```
