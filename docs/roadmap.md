# Roadmap

Milestones 0 through 6 are done. This page describes what comes next, in order.

Each milestone ships only when the deterministic suite passes and a real mission produces an OpenPitStop verdict.

## Done so far

1. **Repository foundation** — pnpm workspace, Turborepo, strict TypeScript, ESLint, Prettier, Vitest, Windows/Linux CI.
2. **CLI vertical slice** — one command produces a real Git candidate, a real model edit, real tests and an OpenPitStop verdict.
3. **Mission runtime and policy** — event store, reducer, pause/resume/cancel, approvals, budgets, replay.
4. **Repository intelligence** — Tree-sitter parsing, source-linked facts, content-based invalidation.
5. **Model gateway and routing** — provider adapters, routing profiles, OS keychain storage, failover.
6. **Bounded specialist crew** — CEO, Repository Scientist, Architect, Implementer, Debugger, Test Engineer.
7. **Candidate identity and Arena** — independent hypotheses, patch save/replay, test-weakening detection, elimination, exact-digest selection.

## Next

### Milestone 7: Blindspot Engine

An Assumption Ledger classifies every claim the crew depends on: `PROTECTED`, `INFERRED`, `UNPROTECTED`, `EXTERNAL_VOLATILE` or `CONTRADICTED`. The engine then mutates disposable candidates in controlled ways — removing an auth check, inverting a permission, weakening error handling — and runs the existing verification. If an important mutation survives verification, that is a gap in the test suite, and it is recorded as verification debt. Acceptance: a fixture with a deliberately weak suite exposes a real blindspot, then adding a verifier converts it to protected.

### Milestone 8: Repo Story

Five read-only views over the repository: Product, System, Request Journey, Change Impact and Trust. Every relationship is labeled observed, inferred or user-declared, with evidence. Acceptance: a user action can be traced to source, showing which assumptions around it are protected.

### Milestone 9: Browser QA Lab

An isolated Playwright profile with observe, headless and replay modes. Semantic targeting first, plus traces, screenshots, console and network capture, counterfactual network scenarios and axe accessibility checks. The first scenarios cover the paths that break real apps: invalid input, API 500, timeout, double submit, unauthorized role, multi-tab, keyboard-only. Acceptance: a seeded UI recovery defect is found, reproduced twice, converted to a deterministic test that fails on baseline and passes on the candidate.

### Milestone 10: Desktop Mission Control

Only after the CLI and core are reliable. Screens for project home, new mission, mission control, approvals, candidate arena, repo story, browser lab, evidence and provider settings. The UI shows real daemon events only.

### Milestone 11: Merge certificate and replay

A certificate binds the selected candidate, its exact identity, acceptance, verification coverage, the OpenPitStop verdict, approvals, eliminated candidates, limitations and an evidence manifest. `pitcrew replay <mission>` reconstructs the timeline. Rerunning verification creates new evidence; it never relabels old evidence as current.

### Milestone 12: Skills and integrations

Skills live in `skills/<skill>/` with a manifest, schemas and scripts. Initial set: architecture, debugging, API contract, database safety, security review, accessibility, browser QA, performance, documentation. Skills request permissions; they never grant them. MCP comes after policy and tool contracts stabilize.

### Milestone 13: Benchmark

A public benchmark, `benchmarks/pitcrew-core`, spanning simple bugs, multi-file features, architecture boundaries, authz, concurrency, visible-test blindspots, browser recovery, migrations, dependencies and environment failures. Three contenders: a strong single-path coding agent, PitCrew single-path, and PitCrew with the adaptive Arena plus OpenPitStop. Metrics include task success, false done, regressions, security escapes, model calls, time and human approvals. Raw results are published.

### Milestone 14: PitCrew-G4 profile

A competition-ready profile under `profiles/g4/` that maps Context Packs, candidate identity, budgets, the Arena and the final gate onto competition tooling. Desktop, provider gateway and non-essential integrations are excluded.

### Milestone 15: Release hardening

Clean-machine verification across Windows, Linux and macOS, with and without Docker, local models, OpenPitStop present or missing, interrupted missions, dirty trees, large repos and monorepos. Missing OpenPitStop yields NOT_PROVEN, never a pass.

## Release gate

Before a public beta, all of the following must hold:

- the baseline is never edited by an agent;
- candidate work survives a daemon restart;
- cancellation kills the whole process tree;
- secrets never reach the database or logs;
- a prompt-injection fixture cannot gain permissions;
- high-risk actions require real approval;
- stale evidence cannot authorize a changed candidate;
- an OpenPitStop failure blocks the verified state;
- missing OpenPitStop yields NOT_PROVEN;
- benchmark raw results are published;
- a clean installation is verified.
