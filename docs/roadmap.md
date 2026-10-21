# Roadmap

Milestones 0 through 14 are implemented. Release hardening is the remaining milestone.

Each milestone ships only when the deterministic suite passes and the recorded evidence is linked from [validation/features-7-15.md](validation/features-7-15.md).

## Done so far

1. **Repository foundation** — pnpm workspace, Turborepo, strict TypeScript, ESLint, Prettier, Vitest, Windows/Linux CI.
2. **CLI vertical slice** — one command produces a real Git candidate, a real model edit, real tests and an OpenPitStop verdict.
3. **Mission runtime and policy** — event store, reducer, pause/resume/cancel, approvals, budgets, replay.
4. **Repository intelligence** — Tree-sitter parsing, source-linked facts, content-based invalidation.
5. **Model gateway and routing** — provider adapters, routing profiles, OS keychain storage, failover.
6. **Bounded specialist crew** — CEO, Repository Scientist, Architect, Implementer, Debugger, Test Engineer.
7. **Candidate identity and Arena** — independent hypotheses, patch save/replay, test-weakening detection, elimination, exact-digest selection.
8. **Blindspot Engine** — an assumption ledger, controlled mutations and verification debt.
9. **Repo Story** — five evidence-labelled read-only views over the repository.
10. **Browser QA Lab** — managed Chrome/Edge scenarios with traces, network capture and axe audits.
11. **Mission Control** — a local daemon-served interface over real mission, approval, arena, story, browser and evidence state.
12. **Merge certificate and replay** — a digest-bound certificate and append-only replay.
13. **Skills** — nine installed, validated skill manifests and instructions.
14. **Benchmark and competition profile** — a ten-category harness with published raw fixture results and `profiles/g4/`.

## Delivered milestone detail

### Milestone 7: Blindspot Engine (shipped)

An Assumption Ledger classifies every claim the crew depends on: `PROTECTED`, `INFERRED`, `UNPROTECTED`, `EXTERNAL_VOLATILE` or `CONTRADICTED`. The engine then mutates disposable candidates in controlled ways — removing an auth check, inverting a permission, weakening error handling — and runs the existing verification. If an important mutation survives verification, that is a gap in the test suite, and it is recorded as verification debt. Acceptance: a fixture with a deliberately weak suite exposes a real blindspot, then adding a verifier converts it to protected.

### Milestone 8: Repo Story (shipped)

Five read-only views over the repository: Product, System, Request Journey, Change Impact and Trust. Every relationship is labeled observed, inferred or user-declared, with evidence. Acceptance: a user action can be traced to source, showing which assumptions around it are protected.

### Milestone 9: Browser QA Lab (shipped)

An isolated Playwright profile with observe, headless and replay modes. Semantic targeting first, plus traces, screenshots, console and network capture, counterfactual network scenarios and axe accessibility checks. The implementation uses `playwright-core` with a locally installed Chrome or Edge rather than a downloaded browser, and restricts targets to authorized loopback origins. The first scenario covers a seeded checkout recovery defect. Acceptance: the defect is found, reproduced twice, and the fixed page passes deterministically.

### Milestone 10: Mission Control (shipped)

Only after the CLI and core are reliable. Screens for project home, new mission, mission control, approvals, candidate arena, repo story, browser lab, evidence and provider settings. The UI shows real daemon events only.

### Milestone 11: Merge certificate and replay (shipped)

A certificate binds the selected candidate, its exact identity, acceptance, verification coverage, the OpenPitStop verdict, approvals, eliminated candidates, limitations and an evidence manifest. `pitcrew replay <mission>` reconstructs the timeline. Rerunning verification creates new evidence; it never relabels old evidence as current.

### Milestone 12: Skills and integrations (shipped)

Skills live in `skills/<skill>/` with a manifest, schemas and scripts. Initial set: architecture, debugging, API contract, database safety, security review, accessibility, browser QA, performance, documentation. Skills request permissions; they never grant them. MCP comes after policy and tool contracts stabilize.

### Milestone 13: Benchmark (shipped, fixture validation mode)

A public benchmark, `benchmarks/pitcrew-core`, spanning simple bugs, multi-file features, architecture boundaries, authz, concurrency, visible-test blindspots, browser recovery, migrations, dependencies and environment failures. The intended contenders are a strong single-path coding agent, PitCrew single-path, and PitCrew with the adaptive Arena plus OpenPitStop. Metrics would include task success, false done, regressions, security escapes, model calls, time and human approvals. The published raw results currently validate the ten fixtures and harness in fixture-validation mode with `contenders: []`; no model-backed comparison has been executed. Raw results are published.

### Milestone 14: PitCrew-G4 profile (shipped)

A competition-ready profile under `profiles/g4/` that maps Context Packs, candidate identity, budgets, the Arena and the final gate onto competition tooling. Desktop, provider gateway and non-essential integrations are excluded.

## Remaining: release hardening

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
