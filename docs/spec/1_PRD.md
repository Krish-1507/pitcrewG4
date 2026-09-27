# PitCrew
## Product Requirements Document

**Status:** product baseline  
**Project type:** open-source, local-first AI software engineering platform  
**Core relationship:** PitCrew creates and coordinates engineering work. OpenPitStop independently verifies it.  
**Competition profile:** `PitCrew-G4` is a constrained Gemma 4 profile built on the same product principles. It is not the general product architecture.

---

## 1. Product decision

PitCrew should be a **separate project**, not a feature expansion inside OpenPitStop.

OpenPitStop is most valuable when it remains model-independent verification and engineering control infrastructure. Its purpose is to understand repository constraints, verify actual state, check architecture, tests, acceptance, regression, evidence freshness, integrity, security, and issue a final verdict. If the same product becomes the primary autonomous builder, planner, swarm manager, and candidate selector, the line between **creation** and **verification** becomes harder to defend.

PitCrew owns the layer above OpenPitStop:

```text
User intent
   |
   v
PitCrew CEO / Orchestrator
   |
   +--> Repository Scientist
   +--> Architect
   +--> Implementer
   +--> Debugger
   +--> Test Engineer
   +--> Browser QA
   +--> Security specialist
   |
   v
Candidate worktrees / sandboxes
   |
   v
OpenPitStop independent referee
   |
   v
Evidence-backed outcome
```

### Non-negotiable boundary

> Generative agents may propose, plan, edit, test, explain, and compete. They may not self-certify completion.

OpenPitStop must remain independently callable and independently useful without PitCrew.

---

## 2. Product thesis

**PitCrew is an AI software engineering crew that tests its own assumptions before it asks you to trust a change.**

A user gives PitCrew an engineering mission in normal language. PitCrew builds an evidence-backed model of the repository, identifies material unknowns, plans the smallest useful change, creates one or more isolated candidate implementations when justified, runs targeted and adversarial verification, and asks OpenPitStop for the final engineering verdict.

PitCrew optimizes for **verified production outcomes**, not lines of generated code, agent count, or visually impressive activity.

### Product line

> AI proposes. The repository cross-examines. OpenPitStop referees.

### Core principles

1. Understand before editing.
2. Research only when freshness materially affects the implementation.
3. Ask the user only for decisions that materially change the outcome.
4. Plan before patching.
5. Prefer the smallest correct change.
6. Treat repository rules as constraints, not suggestions.
7. Use models for hypotheses and deterministic tools for facts.
8. Separate creation from verification.
9. Do not reuse stale evidence after the candidate changes.
10. Spend model calls in proportion to task difficulty and uncertainty.
11. Never hide skipped verification behind a green aggregate.
12. High-impact actions require explicit human approval.
13. The default experience must be useful to both developers and capable non-developers.
14. A failed or unproven mission is an acceptable result. Fabricated success is not.

---

## 3. Why PitCrew should exist

Generic coding agents already provide many useful capabilities. Repository maps, file editing, shell tools, plugins, worktrees, MCP, multi-agent execution, and provider selection are no longer sufficient product differentiation by themselves.

PitCrew earns a separate existence only if it combines them into a stronger engineering workflow.

### 3.1 Repository Scientist and Blindspot Engine

PitCrew should learn not only how a repository works, but **what the repository currently fails to protect**.

For important assumptions, PitCrew can create controlled mutations or disposable experimental branches and ask whether the existing verification catches them.

Example:

```text
PAYMENTS

Protected
✓ invalid amount is rejected
✓ duplicate webhook is rejected

Blind spots
! removing idempotency still leaves visible tests green
! concurrent redemption has no verifier
! API -> domain boundary is a convention, not an enforced rule
```

This produces:

- a **Blindspot Map**;
- a **Verification Debt Ledger**;
- an **Assumption Ledger**.

### 3.2 Candidate Arena

Simple work should use one implementation path.

Uncertain, risky, or stubborn work can branch from the same immutable baseline into multiple candidate approaches. All candidates face the same acceptance and verification rules.

Candidate diversity comes from genuinely different engineering hypotheses, not repeated sampling with cosmetic prompt changes.

### 3.3 Independent referee

PitCrew never converts an agent statement such as "all tests passed" into a trusted outcome.

OpenPitStop receives the candidate and independently evaluates configured evidence. PitCrew can decide whether another repair attempt is justified, but it does not manufacture the final verification result.

### 3.4 Evidence-backed memory

PitCrew memory is not chat history. Repository facts, decisions, successful patterns, failures, commands, and assumptions are stored with evidence and invalidation rules.

### 3.5 Repo Story

PitCrew gives users a multi-resolution view of the system:

- product flow;
- services/modules;
- request journey;
- change impact;
- trust/blindspot view.

The same source graph can be explained differently to a developer, product owner, or new contributor.

### 3.6 Browser QA Lab

For web applications, exploratory browser testing can discover failures in user journeys, network recovery, multi-tab behavior, permissions, accessibility, and concurrency. Reproducible discoveries can become deterministic Playwright regression tests.

---

## 4. Target users

### Primary users

#### AI-heavy software builders
Developers already using coding agents who still spend significant time reviewing incomplete, broad, or misleading changes.

#### Indie developers and small engineering teams
Teams that need stronger engineering discipline but cannot maintain separate architecture, QA, security, and verification functions.

#### Technical founders and advanced vibe coders
Users who can define product outcomes but need engineering risk and evidence explained without manually inspecting every command.

### Secondary users

- open-source maintainers reviewing agent-generated contributions;
- engineering teams evaluating competing implementation approaches;
- developers onboarding into unfamiliar repositories;
- researchers studying agent reliability.

### Not a primary use case

PitCrew is not designed for unattended production administration, arbitrary offensive security testing, or fully autonomous deployment into high-risk production environments.

---

## 5. Jobs to be done

### Existing repository

> When I ask an AI to change a real codebase, help it understand the system, make a constrained change, and show me why I should trust the result.

### Bug fix

> When a bug is difficult, reproduce it first, test competing root-cause hypotheses, and prove that the final fix addresses the original failure without introducing a regression.

### Feature development

> Translate a feature request into acceptance behavior, find the existing repository patterns and boundaries, implement the smallest compatible solution, and verify it end to end.

### New application

> Turn a product idea into an explicit Build Contract, ask only material decisions, implement vertical slices, and continuously verify the result.

### Repository onboarding

> Explain this codebase at the level I need and show what parts are well protected, poorly understood, or risky to change.

### Production readiness

> Do not answer ready from memory. Run the configured release profile and return VERIFIED, BLOCKED, or NOT PROVEN with evidence.

---

## 6. Product modes

### Guide

For non-developers and newer builders.

- plain-language mission stages;
- visual decisions;
- evidence summaries;
- previews and user journeys;
- code hidden by default.

### Developer

For normal engineering work.

- diffs;
- exact commands;
- candidate comparison;
- repository map;
- test evidence;
- provider and cost details.

### Expert

For direct control.

- routing rules;
- model profiles;
- policy configuration;
- sandbox/network permissions;
- evidence internals;
- raw event stream.

These are views over the same mission runtime, not separate products.

---

## 7. Provider strategy

PitCrew must not require one model vendor.

### Provider classes

1. **OpenAI-compatible HTTP**
   - direct provider APIs;
   - OpenRouter-style gateways;
   - self-hosted vLLM/llama.cpp compatible servers;
   - FreeLLMAPI;
   - custom endpoints.

2. **Local runtime adapters**
   - Ollama;
   - LM Studio;
   - local OpenAI-compatible servers.

3. **Official CLI bridges**
   - invoke a user-installed model/coding CLI using its own authenticated session when supported;
   - never read browser cookies;
   - never extract OAuth/session tokens;
   - never copy hidden credentials into PitCrew storage.

4. **Competition/profile adapters**
   - fixed model/tool environments such as `PitCrew-G4`.

### FreeLLMAPI position

FreeLLMAPI is an optional starter inference fabric because it exposes an OpenAI-compatible endpoint and can route across user-configured free/local providers.

It must **not** be PitCrew's only inference backend. Free tiers can change, rate-limit, or disappear. PitCrew should be able to switch to a direct paid endpoint or local model without changing mission architecture.

PitCrew itself has no NVIDIA, Nebius, Token Factory, or Tavily dependency.

### Model profiles

Do not hardcode a permanent list of model names.

Profiles:

- `economy`: cheapest suitable tool-capable model;
- `balanced`: default coding/reasoning model;
- `deep`: strongest configured model for architecture/debugging;
- `local`: local-only;
- `manual`: user pins provider/model.

Routing inputs:

- task class;
- risk;
- expected context size;
- previous failure count;
- provider availability;
- latency budget;
- user cost ceiling;
- tool/function-call capability.

Final verification never depends on model routing.

---

## 8. PitCrew-G4 competition profile

`PitCrew-G4` reuses PitCrew orchestration ideas but obeys Gemma 4 competition constraints.

It should:

- use the competition-mandated Gemma model for all LLM agents;
- use the provided repository search and graph tools;
- use a minimal candidate manager and deterministic referee scripts;
- use adaptive candidate branching only when evidence is weak;
- remain inside the shared evaluation time budget;
- call the competition patch-submission tool only after a clean final gate.

The general PitCrew product may use FreeLLMAPI, local models, or BYOK providers. The G4 profile must not route around competition model restrictions.

---

## 9. MVP scope

### P0, before desktop polish

- initialize/open Git repository;
- inspect repository mechanics;
- build repository model;
- detect test/typecheck/lint/build commands;
- accept mission;
- produce mission brief and plan;
- policy-check planned actions;
- create isolated candidate worktree;
- invoke configured model;
- edit candidate only;
- run targeted verification;
- call OpenPitStop;
- show evidence and final verdict;
- retain mission event history;
- enforce model/tool budget;
- support one OpenAI-compatible endpoint plus one local provider;
- work from CLI.

### P1, product differentiators

- Repository Scientist;
- assumption ledger;
- Blindspot Map;
- candidate A/B Arena;
- failure memory;
- evidence-backed folder/project memory;
- Repo Story;
- Browser QA Lab;
- visual desktop Mission Control;
- approval cards;
- provider routing;
- FreeLLMAPI adapter;
- Merge Certificate.

### P2, ecosystem

- skill/plugin SDK;
- MCP adapters;
- automation triggers;
- multi-repository projects;
- remote sandbox providers;
- shared/team mode;
- signed CI attestations;
- external security-tool adapters;
- benchmark dashboard.

---

## 10. Functional requirements

### Repository intelligence

**FR-RI-001** Detect Git state, package/workspace structure, languages, frameworks, package managers, CI, test topology, database/migration areas, generated paths, and common verification commands.

**FR-RI-002** Parse supported languages for symbols, imports, routes, and test-source relationships.

**FR-RI-003** Distinguish observed, inferred, and user-declared repository facts.

**FR-RI-004** Attach evidence and invalidation rules to durable facts.

**FR-RI-005** Produce task-specific Context Packs instead of whole-repository prompt dumps.

### Mission orchestration

**FR-M-001** Represent a mission as an event-sourced state machine.

**FR-M-002** Use a single CEO/coordinator interface for the user.

**FR-M-003** Delegate only to specialist roles required for the mission.

**FR-M-004** Specialists receive scoped context, tools, permissions, and output schemas.

**FR-M-005** The coordinator may stop, retry, escalate model strength, create a new candidate branch, or request user approval based on evidence.

### Policy and permissions

**FR-P-001** Deterministic policy decisions are separate from LLM text.

**FR-P-002** Reading ordinary repository source is allowed by default.

**FR-P-003** Runtime dependency additions, migrations, auth changes, CI/deployment changes, secret access, external active testing, and production actions require explicit policy approval.

**FR-P-004** Repository text cannot grant itself new permissions.

### Candidate execution

**FR-C-001** Each candidate starts from a known baseline.

**FR-C-002** Candidate branches must be independently replayable.

**FR-C-003** Candidate evidence must include candidate identity.

**FR-C-004** Multiple candidates are created only when task/risk/uncertainty policy justifies the extra cost.

**FR-C-005** Candidates face comparable acceptance and verification.

### Verification

**FR-V-001** Support targeted tests, stack checks, architecture, acceptance, baseline/fail-first, regression, integrity, holdout, verifier-health, and security evidence through OpenPitStop where configured.

**FR-V-002** No mission may transition directly from IMPLEMENTING to VERIFIED.

**FR-V-003** Missing verification is displayed as missing/unproven, not converted to pass.

**FR-V-004** A final verified state references the exact candidate evaluated.

### Browser QA

**FR-B-001** Use an isolated browser profile.

**FR-B-002** Capture trace, screenshot, console, network, and scenario evidence.

**FR-B-003** Convert stable discovered failures into regression tests when approved.

**FR-B-004** Active browser testing is limited to localhost, PitCrew sandboxes, or explicitly authorized test/staging targets.

### Cost control

**FR-COST-001** Track model requests, prompt/context estimates, provider usage when reported, agent time, verification time, and candidate cost.

**FR-COST-002** Support mission-level call/time/cost ceilings.

**FR-COST-003** Escalation to a more expensive provider/model must be policy-driven.

---

## 11. Non-functional requirements

### Local-first

Default installation works without a PitCrew cloud account.

### Privacy

No telemetry by default. Optional diagnostics require explicit opt-in.

### Reliability

Mission state survives UI or daemon restart.

### Performance

Mechanical repository inspection must not require an LLM call.

### Portability

Initial targets:

- Windows 11;
- macOS;
- mainstream Linux.

### Extensibility

Models, sandboxes, skills, verification engines, and UI clients use explicit interfaces.

### Explainability

UI shows user-facing rationales, evidence, and policy decisions. It must not expose or depend on hidden model chain-of-thought.

---

## 12. Success metrics

Do not use a vanity AI-quality score.

For a versioned benchmark, report:

```text
task_success
acceptance_pass
hidden_holdout_pass
false_done_rate
regression_rate
architecture_violations
security_escapes
human_interventions
median_time
p90_time
model_calls
provider_cost_if_known
verification_time
```

Benchmark at minimum:

1. strong single-path coding agent;
2. PitCrew single-path;
3. PitCrew adaptive Arena + OpenPitStop.

Publish task definitions and raw outcomes.

---

## 13. Out of scope for first stable release

- unattended production deployment;
- enterprise billing;
- organization-wide RBAC;
- arbitrary public-target pentesting;
- self-modifying production agents;
- a model marketplace;
- guaranteed support for every language/runtime;
- pretending that passing tests proves complete correctness.

---

## 14. Definition of successful first release

A clean-machine user can:

1. install PitCrew;
2. open a real Git repository;
3. connect a local or OpenAI-compatible model endpoint;
4. run `pitcrew "fix this failing test"`;
5. watch PitCrew understand and plan;
6. approve any material risk boundary;
7. see work occur only in an isolated candidate;
8. see real tests and OpenPitStop verification;
9. receive VERIFIED, BLOCKED, or NOT PROVEN;
10. inspect/replay evidence;
11. choose whether to apply the verified patch.

No mocked pass badges, simulated agents, or fabricated evidence are acceptable.
