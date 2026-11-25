# Module audit

PitCrew is 17 packages and 3 apps. All 20 build. The deterministic suite is 104 tests in 18 files.

This page records what each module does and which executable evidence exercises it. A label describes coverage in this repository; it is not a formal coverage percentage and it does not independently certify a module. The independent verdict is repo-level and comes only from OpenPitStop.

| Module                | Responsibility                                                                                                          | Evidence                                                                                                         | Coverage                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `protocol`            | Zod schemas and types for missions, events, config and candidates                                                       | `packages/protocol/src/protocol.test.ts`, `assistant-features.test.ts` plus every suite that imports the schemas | Deterministic              |
| `mission-runtime`     | Mission state machine, reducer, event store and replay                                                                  | `mission-control.test.ts`, `referee-gate.test.ts`, `arena.test.ts`, `security.test.ts`                           | Deterministic              |
| `orchestrator`        | Phase coordination across roles, arena, evidence and the gate                                                           | `scripts/live-acceptance.mjs` (real model call); imported by `apps/daemon`                                       | Acceptance only            |
| `agents`              | Bounded role behaviour and model-backed edits                                                                           | `specialists.test.ts`, `mission-control.test.ts`, `security.test.ts`                                             | Deterministic              |
| `model-gateway`       | Provider adapters, routing profiles, keychain references, failover, bounded answers, opt-in search                      | `model-gateway.test.ts`, `assistant-features.test.ts`                                                            | Deterministic              |
| `repo-intelligence`   | Tree-sitter indexing, source-linked graphs and the repo story                                                           | `repository-intelligence.test.ts`, `story.test.ts`                                                               | Deterministic              |
| `policy-engine`       | Deterministic edit/operation authorization and action hashes                                                            | `mission-control.test.ts`, `security.test.ts`                                                                    | Deterministic              |
| `sandbox`             | argv process execution, worktrees, containers and cancellation                                                          | `security.test.ts`, `arena.test.ts`, `candidate.test.ts`, `blindspot.test.ts`                                    | Deterministic              |
| `candidate-manager`   | Baseline inspection, candidate creation, fingerprints, disposal                                                         | `candidate.test.ts`, `arena.test.ts`, `blindspot.test.ts`, `daemon.test.ts`                                      | Deterministic              |
| `evidence`            | Artifact identity, storage, freshness, redaction, memory notes and assistants                                           | `certificate.test.ts`, `security.test.ts`, `repository-intelligence.test.ts`, `assistant-features.test.ts`       | Deterministic              |
| `memory`              | SQLite persistence and migrations                                                                                       | `repository-intelligence.test.ts`; daemon restart test                                                           | Integration                |
| `skills`              | Skill manifest validation, containment and loading                                                                      | `skills.test.ts`                                                                                                 | Deterministic              |
| `browser-lab`         | Playwright Core scenarios, traces, network and axe audits                                                               | `browser-lab.test.ts`; `scripts/browser-acceptance.mjs`                                                          | Deterministic + acceptance |
| `openpitstop-adapter` | Runs the external referee and parses its verdict                                                                        | `arena.test.ts`                                                                                                  | Deterministic              |
| `config`              | Trusted config loading and validation                                                                                   | `model-gateway.test.ts`                                                                                          | Deterministic              |
| `observability`       | Redaction and event/log projection                                                                                      | `security.test.ts`                                                                                               | Integration                |
| `blindspot`           | Assumption ledger and controlled mutation debt                                                                          | `blindspot.test.ts`, daemon blindspot test                                                                       | Deterministic              |
| `daemon`              | Loopback API, authentication, static UI serving, persistence, quick/research/memory/assistant endpoints                 | `daemon.test.ts`, `assistant-features.test.ts`                                                                   | Deterministic              |
| `cli`                 | Argument parsing, rendering, approvals and daemon client                                                                | `scripts/live-acceptance.mjs`, `scripts/check-live-freshness.mjs`, manual `ui` smoke                             | Acceptance + manual        |
| `desktop`             | Mission Control interface, Quick Assistant, memory and assistant views; Electron shell (window, tray, daemon lifecycle) | `daemon.test.ts` asserts the page title and asset; manual `ui` smoke; Electron shell manual acceptance           | Static + manual            |

## Verification gaps

These are current facts, recorded rather than hidden:

- `orchestrator` has no dedicated deterministic test. A full mission needs a model provider, so it is exercised by the live acceptance script rather than CI.
- `apps/cli` has no deterministic lifecycle test. Its mission path is covered by live acceptance and its `ui` hold-open behaviour was verified by a manual smoke run.
- `apps/desktop` has no browser-automation test. Static serving, the page title and asset delivery are asserted in `daemon.test.ts`; evidence semantics were checked by reading the implementation. Quick Assistant clipboard, hotkey, and UI interaction remain `NOT_PROVEN` by automated test.
- `memory` and `observability` have no dedicated unit suite; they are exercised through integration tests.
- Quick Assistant output is a draft and is not a verification path. Web search has deterministic provider-protocol coverage, but no live SearXNG or Brave acceptance run is recorded.
- The browser acceptance script needs a local Chrome or Edge and is not part of the deterministic suite.

## Reproducing

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

The exact test files are listed in the table above. CI runs the same commands on `windows-latest` and `ubuntu-latest`.
