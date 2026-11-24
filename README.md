# PitCrew

PitCrew is a local-first AI software engineering crew. You give it a task like "fix the failing test". It reads your repository, proposes a change on an isolated Git branch, runs your real tests, and reports success only when an independent referee agrees.

Trust is the point:

- your working tree is never edited;
- every candidate lives in its own Git worktree;
- evidence is bound to the exact bytes it describes;
- the OpenPitStop CLI — a separate program, never imported — issues the final verdict;
- if no referee says PASS, PitCrew says `NOT_PROVEN`.

PitCrew is early development software. Milestones 0 through 15 are implemented; Windows and Linux CI pass; a clean macOS installation is still `NOT_PROVEN`. See [docs/status.md](docs/status.md) and [docs/limitations.md](docs/limitations.md).

## Requirements

- Node.js 22.13 or newer
- pnpm 11.19.0
- Git
- Docker, **or** explicit consent to reduced isolation for development
- A model: the official [Codex CLI](https://developers.openai.com/codex/) installed and authenticated by you, or a local/OpenAI-compatible endpoint such as Ollama

The pinned `openpitstop` package is installed as a development dependency. PitCrew runs it as a separate process.

## Install and onboard

Run these from the PitCrew checkout.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm onboard --repo .
```

`pnpm onboard` writes a trusted `.pitcrew/config.json`, points the referee at the pinned OpenPitStop entry point, validates the result against the real schema, and prints the commands to run next. It never prints or stores a secret value.

Check the environment, then run a mission:

```sh
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo . doctor
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo . "fix the failing test"
```

`doctor` checks Git, Docker, OpenPitStop and your model executable. A missing referee or model is reported, not hidden.

To work on a different repository, pass its path:

```sh
pnpm onboard --repo ../my-app
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo ../my-app "fix the failing test"
```

Keep the config and state in the PitCrew checkout, outside the repository being changed.

### No Docker

The default config uses Docker. If `doctor` reports Docker unavailable, either install it or opt in to host execution explicitly:

```sh
pnpm onboard --repo . --reduced-isolation
```

Reduced isolation runs the target's test/build commands on the host. It provides Git isolation, not process or network containment. Use it only for repositories you trust. See [docs/sandbox-security.md](docs/sandbox-security.md).

### Ollama or another compatible endpoint

```sh
pnpm onboard --provider ollama --model llama3.1
pnpm onboard --provider openai-compatible --base-url http://127.0.0.1:11434/v1 --model llama3.1
```

Add `--api-key-env NAME` to reference an environment variable. Never put the key itself in JSON. Details: [docs/providers.md](docs/providers.md).

## Mission Control

```sh
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew ui
```

Open the printed `http://127.0.0.1:<port>/#token=...` URL, then press `Ctrl+C` in the terminal to stop the daemon. The token stays in the URL fragment and the browser session; API requests need it, cross-origin requests are rejected.

Mission Control shows real daemon events: mission state, approvals, candidate arena, repo story, browser lab, evidence and provider status. A missing referee verdict renders `NOT_PROVEN`; no progress is invented.

## Commands

All commands accept the same `--config`, `--state` and `--repo` flags shown above.

| Command                        | What it does                                               |
| ------------------------------ | ---------------------------------------------------------- |
| `doctor`                       | Check required executables and services                    |
| `open`                         | Inspect a repository read-only                             |
| `ui`                           | Serve Mission Control until `Ctrl+C`                       |
| `replay <mis_id>`              | Print a persisted mission timeline                         |
| `diff <mis_id>`                | Print a candidate diff and its evidence identity           |
| `certificate <mis_id>`         | Print the merge certificate, or explain why none exists    |
| `story <prj_id>`               | Render the five-view repository story                      |
| `skills [dir]`                 | Validate installed skill manifests                         |
| `blindspot --mutations <file>` | Run controlled mutations to expose verification debt       |
| `"<mission>"`                  | Run a mission and stream events, approvals and the verdict |

Exit codes: `0` for `VERIFIED`, `1` for `BLOCKED`, `2` for `NOT_PROVEN` or `CANCELLED`.

Interactive missions accept `/pause`, `/resume` and `/cancel`. A protected edit prints the exact proposal and action hash and requires typing `approve`; non-interactive clients reject it.

## What happens during a mission

1. The request becomes a plan with observable acceptance criteria.
2. A bounded role (Architect, Implementer, Debugger, Test Engineer, and so on) proposes changes. Model output is untrusted data; policy decides what may run.
3. Changes are applied inside a disposable Git worktree. Your checkout is not touched.
4. Your tests run against the candidate. A candidate that weakens a test to look green is rejected.
5. If tests and policy pass, OpenPitStop independently re-verifies the candidate and issues the verdict.
6. Every step is an append-only event, so a mission can be replayed and audited.

A merge certificate binds the selected candidate, its digest, the verdict, approvals, eliminations and the evidence manifest. It does not push, merge or deploy anything.

## Benchmarks

```sh
pnpm bench
pnpm bench --only migration-upgrade
```

The latest published result is `benchmarks/pitcrew-core/results/run-2026-11-24T07-20-08-264Z.json`: ten of ten fixture baselines `MATCH`, source commit `46f119b`, `dirty: false`, `contenders: []`.

This is fixture-validation mode. It proves the harness reproduces each intended starting condition, not that a model solves the tasks. No model-backed comparison has been executed here, so no ranking is claimed. Method: [docs/benchmark-methodology.md](docs/benchmark-methodology.md).

## Modules

PitCrew is 17 packages and 3 apps. The deterministic suite passes 92 tests in 16 files. Coverage is not uniform: `orchestrator`, `apps/cli` and `apps/desktop` rely on integration or manual acceptance rather than dedicated unit tests. The full module-by-module audit is [docs/modules.md](docs/modules.md).

| Area               | Packages                                   | Main evidence                                          |
| ------------------ | ------------------------------------------ | ------------------------------------------------------ |
| Protocol and state | `protocol`, `mission-runtime`              | `protocol.test.ts`, `mission-control.test.ts`          |
| Roles and planning | `agents`, `orchestrator`                   | `specialists.test.ts`; acceptance script               |
| Models and policy  | `model-gateway`, `policy-engine`, `config` | `model-gateway.test.ts`, `security.test.ts`            |
| Isolation          | `sandbox`, `candidate-manager`             | `candidate.test.ts`, `arena.test.ts`                   |
| Evidence           | `evidence`, `openpitstop-adapter`          | `certificate.test.ts`, `arena.test.ts`                 |
| Intelligence       | `repo-intelligence`, `blindspot`, `memory` | `repository-intelligence.test.ts`, `blindspot.test.ts` |
| Skills             | `skills`                                   | `skills.test.ts`                                       |
| Browser QA         | `browser-lab`                              | `browser-lab.test.ts`, browser acceptance              |
| Applications       | `daemon`, `cli`, `desktop`                 | `daemon.test.ts`; CLI and UI acceptance                |

## Development

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
node scripts/release-check.mjs
```

Independent referee, on a clean commit:

```sh
pnpm referee
```

`pnpm referee` runs `openpitstop scan` and `openpitstop verify`. Verification is bound to the committed tree; uncommitted changes are not certified.

Live acceptance spends a real model call and needs an authenticated Codex CLI:

```sh
node scripts/live-acceptance.mjs
```

Browser acceptance needs a locally installed Chrome or Edge:

```sh
node scripts/browser-acceptance.mjs
```

Neither acceptance script is part of the deterministic suite.

## Limitations

- macOS clean-install verification is `NOT_PROVEN`; CI covers Windows and Linux.
- Benchmark results are fixture validation only; no model contender was run.
- Browser QA uses a local Chrome or Edge and does not download one.
- The referee runs on the host; a containerized referee is not implemented.
- Mission Control is a local web interface, not a packaged native app.
- Production push, merge and deploy are outside the automatic path.

Full list: [docs/limitations.md](docs/limitations.md). Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before your first change. Security issues go to [SECURITY.md](SECURITY.md). MIT licensed, local-only, no account and no telemetry.
