# Status

Current state: milestones 0 through 15 are implemented, followed by a local assistant extension for Quick Assistant, opt-in web research, memory notes and saved assistants. Release-gate evidence is recorded in [validation/release-gate.md](validation/release-gate.md); ten of eleven gates pass and a clean macOS installation remains NOT_PROVEN. The module-by-module audit is [modules.md](modules.md). See also [roadmap.md](roadmap.md) and [validation/features-7-15.md](validation/features-7-15.md).

## Delivered

| Milestone | Highlight                                                                                  | Date                         |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| 0         | Monorepo, strict TypeScript, Vitest, Windows/Linux CI                                      | shipped                      |
| 1         | CLI vertical slice: real candidate, real tests, OpenPitStop VERIFIED                       | shipped                      |
| 2         | Pause/resume/cancel, approvals, durable event replay                                       | shipped                      |
| 3         | Tree-sitter repository intelligence with source-linked facts                               | shipped                      |
| 4         | Provider adapters, routing profiles, OS keychain                                           | shipped                      |
| 5         | Bounded specialist roles (CEO, Scientist, Architect, Implementer, Debugger, Test Engineer) | shipped                      |
| 6         | Candidate identity and Arena: hypotheses, elimination, exact-digest selection              | shipped                      |
| 7         | Assumption Ledger and Blindspot Engine with verification debt                              | shipped                      |
| 8         | Five-view evidence-labelled Repo Story                                                     | shipped                      |
| 9         | Browser QA Lab with traces, seeded failures and axe audits                                 | shipped                      |
| 10        | Mission Control served by the daemon                                                       | shipped                      |
| 11        | Merge certificate and append-only replay                                                   | shipped                      |
| 12        | Nine validated skills with permission requests only                                        | shipped                      |
| 13        | Ten-category benchmark harness with published raw results                                  | shipped                      |
| 14        | Competition profile `profiles/g4/`                                                         | shipped                      |
| 15        | Release hardening documentation, release-check script and gate evidence                    | shipped, one gate NOT_PROVEN |

A user-profile install path is implemented in `install.ps1` and `install.sh`: it builds the workspace, packages the CLI, installs into a user-owned prefix, creates a Desktop launcher, and changes only user `PATH` entries. The npm artifact is prepared as `@pitcrew/cli`; publication is pending, so the source installer is the supported path today.

All 20 workspace packages build. The current deterministic suite passes 98 tests across 17 files, and typecheck, lint and format checks pass locally. OpenPitStop strict verification of clean source commit `1c21762` reports OK, CLEAN integrity, TRUSTWORTHY honesty and 93/93 tests; evidence is recorded in [validation/release-gate.md](validation/release-gate.md). The local assistant extension is not yet independently verified by OpenPitStop.

## Local assistant extension

The post-milestone extension adds:

- a Quick Assistant CLI/UI path (`pitcrew quick`, `pitcrew app --quick`), clipboard read and Windows `Ctrl+Alt+P`;
- opt-in web research through SearXNG or Brave, with no request when unconfigured;
- global and project memory notes stored in SQLite migration 4;
- saved assistants with prompt digest events, optional route/model, and project scoping;
- daemon endpoints and Mission Control views for all four features.

The extension is covered by `assistant-features.test.ts` and the existing suite. It is a draft/context feature, not a new verification path. It has no new OpenPitStop verdict yet; the recorded strict verdict remains `1c21762`.

## Modules

The audit in [modules.md](modules.md) lists all 17 packages and 3 apps with their responsibility and the test or acceptance path that exercises each. Most modules have direct deterministic coverage. Three gaps are recorded rather than hidden:

- `orchestrator` full-mission behaviour is exercised by live acceptance, not CI.
- `apps/cli` lifecycle and rendering have acceptance and manual coverage, not a dedicated unit test.
- `apps/desktop` interaction is not covered by browser automation; static serving and the page title are asserted in `daemon.test.ts`.

## Live evidence

Milestone 1 produced a full P0 acceptance: an authenticated Codex CLI, a real isolated Git candidate, a failing baseline, a passing candidate test set and an OpenPitStop 1.10.0 strict VERIFIED verdict, with the baseline untouched. The record is in [validation/p0.md](validation/p0.md).

Milestone 6's hero fixture is a real duplicate-checkout race. The racy candidate is eliminated for failing the reproduction, a test-weakening candidate is eliminated, and the correct candidate survives and receives a strict OpenPitStop VERIFIED verdict with matching digest.

Milestone 9's browser acceptance reproduces a seeded checkout recovery defect twice against the buggy page and verifies the fixed page with a passing check sequence and accessibility audit. Raw artifacts are written under `.pitcrew/browser-acceptance/`.

Milestone 13's latest raw result is `benchmarks/pitcrew-core/results/run-2026-11-24T07-58-20-982Z.json`: ten of ten fixture baselines `MATCH` on clean commit `8e11062`, `dirty: false`, `contenders: []`. It validates the fixtures and harness only; it does not claim a model comparison.

## Known limitations

- Live model missions could not be re-recorded in this environment because the Codex CLI was unavailable; prior live runs remain the standing evidence.
- The published benchmark results validate fixtures and harness behaviour only; no model-backed contender was executed.
- Browser QA depends on a locally installed Chrome or Edge. Observe mode requires a desktop session.
- The referee always runs on the host; a containerized referee is not implemented yet.
- macOS clean-machine installation has not been verified locally; CI covers Windows and Linux, and the macOS gate is NOT_PROVEN.
- Mission Control is a local web interface, not a packaged native desktop application; UI interaction is not covered by an automated browser test.
- Quick Assistant is a draft path, not verification. Windows hotkey registration depends on the installer shortcut; Linux binding is manual; macOS is unproven.
- Web research is disabled by default and has no live provider acceptance run recorded.
- Memory notes and assistants have no embeddings, sync, or automatic summarization.
- The current assistant-feature changes have deterministic tests but no new OpenPitStop verdict.

## CI

Windows and Linux CI runs on every push: build, test, typecheck, lint and format checks. Commit `3a6bc41` is green on both (run `45403194168`). The assistant-feature changes are not yet committed or CI-verified.
