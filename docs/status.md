# Status

Current state: milestones 0 through 15, the local assistant extension (Quick Assistant, web research, memory, saved assistants), and a provider/session/desktop extension: named provider presets with a native Claude adapter, hardware-aware local-model onboarding, a built-in keyless DuckDuckGo searcher with automatic research in Quick Assistant, an interactive CLI session, an Electron desktop shell (Windows first) and five vendored community skills. Release-gate evidence is recorded in [validation/release-gate.md](validation/release-gate.md); ten of eleven gates pass and a clean macOS installation remains NOT_PROVEN. The module-by-module audit is [modules.md](modules.md). See also [roadmap.md](roadmap.md) and [validation/features-7-15.md](validation/features-7-15.md).

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

All 20 workspace packages build. The current deterministic suite passes 105 tests across 19 files, and typecheck, lint and format checks pass locally. OpenPitStop strict verification of clean source commit `ea4ab55` (which includes the assistant extension, the provider/session/desktop extension, the prebuilt install fast path and the self-contained desktop packaging) reports OK, CLEAN integrity, 0 confirmed, 0 suspicious, TRUSTWORTHY honesty 100/100 and 105/105 tests; evidence is recorded in [validation/release-gate.md](validation/release-gate.md).

## Local assistant extension

The post-milestone extension adds:

- a Quick Assistant CLI/UI path (`pitcrew quick`, `pitcrew app --quick`), clipboard read and Windows `Ctrl+Alt+P`;
- opt-in web research through SearXNG or Brave, with no request when unconfigured;
- global and project memory notes stored in SQLite migration 4;
- saved assistants with prompt digest events, optional route/model, and project scoping;
- daemon endpoints and Mission Control views for all four features.

The extension is covered by `assistant-features.test.ts` and the existing suite. It is a draft/context feature, not a new verification path. Its verdict is included in the `60a1e79` strict verification.

## Provider, session and desktop extension

The newest extension adds:

- a native `anthropic` provider type (Messages API, `x-api-key` + `anthropic-version` headers, prose structured output validated like every other transport) and robust JSON extraction for providers that wrap structured output;
- fifteen provider presets in setup (Codex, OpenAI, Claude, Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI, Together, FreeLLMAPI, Ollama, LM Studio, llama.cpp, custom) plus a hardware-aware local model suggestion (CPU, RAM, GPU probe) and endpoint model discovery;
- a built-in keyless DuckDuckGo HTML searcher as the default research backend, with SearXNG/Brave overrides;
- automatic research in Quick Assistant: one bounded model decision, then at most one search round, with results attached as untrusted context (`web`: auto/on/off);
- an interactive CLI session (bare `pitcrew` in a terminal) with slash commands and inline missions;
- an Electron desktop shell for Windows (window, tray, daemon lifecycle, token injection) with an NSIS installer target;
- five vendored skills: `web-research`, `design-taste-frontend`, `unslop`, `graphify`, `ponytail` (adapted, credited, permission-scoped).

Coverage: `provider-presets.test.ts` (presets, schema validation, secret hygiene, JSON extraction), updated `assistant-features.test.ts` (keyless default, HTML parsing, research modes) and `skills.test.ts` (14 skills). The extension's verdict is included in the `ea4ab55` strict verification (CLEAN integrity, TRUSTWORTHY 100/100). The portable desktop build is verified end to end; the NSIS single-file installer and live TTY acceptance remain NOT_PROVEN locally.

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
- Mission Control is served by the daemon and wrapped by a Windows-first Electron shell; the desktop build and its installer are NOT_PROVEN locally, and UI interaction is not covered by an automated browser test.
- Quick Assistant is a draft path, not verification. Windows hotkey registration depends on the installer shortcut; Linux binding is manual; macOS is unproven.
- Web research defaults to the keyless DuckDuckGo searcher (no SLA; rate-limiting possible) and has no live acceptance run recorded beyond the deterministic HTML-parsing test.
- Memory notes and assistants have no embeddings, sync, or automatic summarization.
- The assistant-feature, provider-preset and desktop changes have deterministic tests but no new OpenPitStop verdict.

## CI

Windows and Linux CI runs on every push: build, test, typecheck, lint and format checks. Commit `3a6bc41` is green on both (run `45403194168`). The assistant-feature and provider/session/desktop changes are committed but not yet CI-verified.
