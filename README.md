# PitCrew

PitCrew is a local-first AI software engineering crew. Give it a task like "fix the failing test" and it reads the repository, proposes a change on an isolated Git branch, runs your real tests, and reports success only when an independent referee agrees.

The central rule is simple: **PitCrew proposes and executes; OpenPitStop verifies.** They are separate programs. A model can never mark its own change `VERIFIED`, and missing evidence is rendered as `NOT_PROVEN`.

## Why PitCrew

| Concern                 | PitCrew                                                  | A plain agent loop             |
| ----------------------- | -------------------------------------------------------- | ------------------------------ |
| Your working tree       | Never edited; candidates run in disposable worktrees     | Often edits the live checkout  |
| Final verdict           | Independent OpenPitStop process                          | The same model reports success |
| Evidence                | Content-addressed and bound to the exact candidate bytes | Logs or a prose summary        |
| Protected actions       | Policy decision plus an exact action hash                | Varies by tool                 |
| Missing or stale checks | `NOT_PROVEN`, never a green pass                         | Frequently optimistic          |
| Model choice            | Changes the route, not the verification standard         | May change what counts as done |

PitCrew does not push, merge, or deploy as part of the automatic path. It is local-only, has no account system, and sends no telemetry.

## Requirements

- Node.js 22.13 or newer
- Git
- pnpm 11.19.0 for the source installer
- Docker, **or** explicit consent to reduced isolation
- A model: the official [Codex CLI](https://developers.openai.com/codex/), an API key for OpenAI/Claude/Gemini/OpenRouter/DeepSeek/Groq/Mistral/xAI/Together, or a local runtime (Ollama, LM Studio, llama.cpp) — `pitcrew setup` offers all of them and detects your hardware for local sizing
- Nothing else for web research: a keyless DuckDuckGo searcher is built in; a SearXNG instance or Brave key upgrades it

The pinned `openpitstop` package is installed with PitCrew and run as a separate process.

## Install

The supported one-command path today is the source bootstrap. It installs under your user profile, builds the CLI and Mission Control assets, installs the CLI into a user-owned prefix, creates a Desktop launcher, and adds only the user `PATH` entries.

### Windows

From a checkout:

```powershell
.\install.ps1
```

The installer defaults to `%USERPROFILE%\PitCrew`, creates **PitCrew** and **PitCrew Quick Assistant** Start Menu entries, registers `Ctrl+Alt+P` for Quick Assistant, and never requests admin rights. You can pass `-InstallRoot D:\PitCrew`, `-Source <checkout>`, `-SkipPath`, or `-NoShortcut`.

### Linux and macOS

From a checkout:

```sh
./install.sh
```

The installer defaults to `$HOME/PitCrew`, creates `pitcrew-desktop` and `pitcrew-quick`, and adds a Linux application entry with a Quick Assistant action where supported. Bind `pitcrew-quick` to a desktop hotkey yourself. On macOS this source path is `NOT_PROVEN`; CI covers Linux and Windows.

The CLI is packaged as `@pitcrew/cli` for global npm distribution. Publication is pending, so the README does not claim an npm command that would currently fail. To install a locally built tarball:

```sh
pnpm build
pnpm package:cli
npm install -g ./release/pitcrew-cli-0.1.0-dev.tgz
```

### One-command installers

Both installers have a prebuilt fast path that needs only Node and npm — no Git, no pnpm, no build. Put (or point at) a `pitcrew-cli-*.tgz` next to the installer:

```powershell
.\install.ps1 -Tarball .\release\pitcrew-cli-0.1.0-dev.tgz -InstallRoot D:\PitCrew
```

```sh
PITCREW_TARBALL=./release/pitcrew-cli-0.1.0-dev.tgz ./install.sh
```

A tarball next to the installer is detected automatically. Without one, the installer falls back to the full source path (clone, pnpm build, package, install). Both paths install under your user profile, create launchers, and touch nothing system-wide.

### Desktop app (Windows first)

The Electron shell packages Mission Control as a real desktop application: native window and tray, daemon lifecycle owned by the app, and the session token injected automatically — no URL copying. The packaged app carries its own runtime: the same daemon bundle the CLI installs, the Mission Control assets, and the referee dependency, so it runs without a separate CLI install.

Build the portable app (verified end-to-end: the packaged binary boots the packaged daemon and serves the authenticated API):

```sh
pnpm package:desktop
```

This writes `release/desktop/win-unpacked/PitCrew.exe` — a portable app you can copy anywhere and run. For the single-file NSIS installer (`release/desktop/PitCrew-Setup-<version>.exe`), run the packaging step in a normal (non-sandboxed) terminal:

```sh
pnpm --dir apps/desktop exec electron-builder --win --publish never
```

The installer is currently unsigned (a SmartScreen warning is expected until code signing is added). Linux and macOS packaging is `NOT_PROVEN`.

## First-time setup

The installer runs setup when no user config exists. You can rerun it at any time:

```sh
pitcrew setup
```

Setup asks which provider you use from the preset list — Codex, OpenAI, Claude, Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI, Together, FreeLLMAPI, Ollama, LM Studio, llama.cpp, or a custom OpenAI-compatible endpoint — then the model, endpoint, and whether reduced isolation is allowed. It writes `~/.pitcrew/config.json` (or `PITCREW_HOME/config.json`) and references secrets by environment variable name only. It never writes a key value into the config.

Choosing a local runtime also detects your hardware (CPU, RAM, GPU) and suggests a model tier that fits without swapping, then lists the models your endpoint already serves.

Useful non-interactive forms:

```sh
pitcrew setup --provider codex --yes
pitcrew setup --provider anthropic --model claude-sonnet-4-5 --api-key-env ANTHROPIC_API_KEY --yes
pitcrew setup --provider openai --model gpt-4o-mini --api-key-env OPENAI_API_KEY --yes
pitcrew setup --provider ollama --model llama3.1 --base-url http://127.0.0.1:11434/v1 --yes
pitcrew setup --provider lmstudio --yes
pitcrew setup --provider openrouter --model vendor/model --api-key-env OPENROUTER_API_KEY --yes
```

Then check the environment:

```sh
pitcrew doctor
```

`doctor` reports Git, Docker, OpenPitStop, and your model executable. Missing pieces are reported, not hidden. A missing referee means verification is `NOT_PROVEN`.

## Run a mission

Run from the repository you want PitCrew to work on:

```sh
cd ../my-app
pitcrew "fix the failing test"
```

Bare `pitcrew` (in a terminal) opens an interactive session: type a task to start a mission, or use `/quick`, `/research`, `/memory`, `/doctor`, `/providers`, `/skills`, `/app` and `/help` in one place. `/exit` leaves the session.

Config defaults to `~/.pitcrew/config.json`; mission state defaults to `~/.pitcrew/state`. Both can be overridden:

```sh
pitcrew --config .pitcrew/config.json --state .pitcrew --repo . "fix the failing test"
```

This keeps the old checkout-local workflow available without making it mandatory.

Interactive missions accept `/pause`, `/resume`, and `/cancel`. A protected edit prints the exact proposal and action hash and requires typing `approve`; non-interactive clients reject it.

Exit codes: `0` for `VERIFIED`, `1` for `BLOCKED`, `2` for `NOT_PROVEN` or `CANCELLED`.

## Mission Control

```sh
pitcrew app
```

`app` starts the local daemon, opens the printed `http://127.0.0.1:<port>/#token=...` URL in your browser, and keeps running until `Ctrl+C`. Use `pitcrew ui` to print the URL and wait without opening a browser.

Mission Control shows real daemon events: mission state, approvals, candidate arena, repo story, browser lab, evidence, and provider status. A missing referee verdict renders `NOT_PROVEN`; no progress is invented.

The token stays in the URL fragment and browser session. API requests require it, and cross-origin requests are rejected.

## Quick Assistant, memory and web research

```sh
pitcrew app --quick
pitcrew quick
pitcrew research "current documentation for the configured library"
pitcrew memory add --repo . "Use pnpm for this repository"
pitcrew assistant add --name Reviewer --prompt "Review for small, testable changes"
```

`pitcrew app --quick` (or `pitcrew quick`) opens a focused view that reads clipboard text on request and returns a draft from the configured model. The Windows installer registers `Ctrl+Alt+P`; on Linux, bind `pitcrew-quick` in your desktop environment. Quick Assistant output is a draft, not independent verification, and it never marks work `VERIFIED`.

Memory notes are short, user-authored context stored in SQLite as global or project notes. Assistants are saved prompts with an optional route and model override. Project assistants are limited to their project; Quick Assistant only accepts global assistants. Neither can change policy, tools, or the verification standard.

Quick Assistant can use web research automatically: when you do not force it on or off, the assistant decides whether the request needs fresh public information, runs at most one search round, and answers with the sources attached. Three modes are available in Mission Control and via the `web` request field: `automatic` (default), `always`, and `off`. `pitcrew research "<query>"` still searches on demand. Only the normalized search query leaves the machine; results are untrusted context. Research can add context; it can never change authorization, policy or the verification standard, and it is never a substitute for the referee.

The default searcher is keyless DuckDuckGo (HTML endpoint). It is free and unlimited in the everyday sense, not contractually: heavy automated use can be rate-limited or blocked, and the HTML shape can change. Set `PITCREW_SEARXNG_URL` (HTTPS, or HTTP on loopback) or `PITCREW_BRAVE_SEARCH_API_KEY` for a provider with a real SLA.

## Commands

| Command                        | What it does                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `setup`                        | Write or replace the trusted user configuration (provider presets + hardware-aware local suggestions) |
| `pitcrew` (bare, TTY)          | Open the interactive session                                                                          |
| `doctor`                       | Check required executables and services                                                               |
| `app`                          | Serve Mission Control and open the browser                                                            |
| `app --quick` / `quick`        | Open the Quick Assistant; Windows hotkey `Ctrl+Alt+P`                                                 |
| `ui`                           | Serve Mission Control until `Ctrl+C`                                                                  |
| `research "<query>"`           | Search the web now (keyless DuckDuckGo by default)                                                    |
| `memory list\|add\|delete`     | Manage global or project memory notes                                                                 |
| `assistants`                   | List saved assistant prompts and model settings                                                       |
| `assistant add\|delete`        | Manage global or project assistants                                                                   |
| `open`                         | Inspect a repository read-only                                                                        |
| `replay <mis_id>`              | Print a persisted mission timeline                                                                    |
| `diff <mis_id>`                | Print a candidate diff and its evidence identity                                                      |
| `certificate <mis_id>`         | Print the merge certificate, or explain why none exists                                               |
| `story <prj_id>`               | Render the five-view repository story                                                                 |
| `skills [dir]`                 | Validate installed skill manifests                                                                    |
| `blindspot --mutations <file>` | Run controlled mutations to expose verification debt                                                  |
| `"<mission>"`                  | Run a mission and stream events, approvals and the verdict                                            |

## No Docker

The default config uses Docker. If `doctor` reports Docker unavailable, either install it or opt in explicitly:

```sh
pitcrew setup --reduced-isolation --force
```

Reduced isolation runs the target's test/build commands on the host. It provides Git isolation, not process or network containment. Use it only for repositories you trust. See [docs/sandbox-security.md](docs/sandbox-security.md).

## What happens during a mission

1. The request becomes a plan with observable acceptance criteria.
2. A bounded role proposes changes. Model output is untrusted data; policy decides what may run.
3. Changes are applied inside a disposable Git worktree. Your checkout is not touched.
4. Your tests run against the candidate. A candidate that weakens a test to look green is rejected.
5. If tests and policy pass, OpenPitStop independently re-verifies the candidate and issues the verdict.
6. Every step is an append-only event, so a mission can be replayed and audited.

A merge certificate binds the selected candidate, its digest, the verdict, approvals, eliminations, and the evidence manifest. It does not push, merge, or deploy.

## OpenPitStop

OpenPitStop is the independent referee. It is a separate CLI, never imported into PitCrew:

https://github.com/Krish-1507/OpenPitStop

PitCrew does not duplicate the referee's logic. If OpenPitStop is unavailable, the result is `NOT_PROVEN`.

## Benchmarks

```sh
pnpm bench
pnpm bench --only migration-upgrade
```

The latest published result is `benchmarks/pitcrew-core/results/run-2026-11-24T07-58-20-982Z.json`: ten of ten fixture baselines `MATCH`, source commit `8e11062`, `dirty: false`, `contenders: []`.

This is fixture-validation mode. It proves the harness reproduces each intended starting condition, not that a model solves the tasks. No model-backed comparison has been executed here, so no ranking is claimed. Method: [docs/benchmark-methodology.md](docs/benchmark-methodology.md).

## Modules

PitCrew is 17 packages and 3 apps. The deterministic suite passes 104 tests in 18 files. Coverage is not uniform: `orchestrator`, `apps/cli`, and `apps/desktop` rely on integration or manual acceptance rather than dedicated unit tests. The full module-by-module audit is [docs/modules.md](docs/modules.md).

PitCrew ships 14 validated skills — the nine engineering skills plus `web-research`, `design-taste-frontend`, `unslop`, `graphify` and `ponytail`, each adapted to the permission model with credits and licences recorded in their `SKILL.md` files.

| Area               | Packages                                   | Main evidence                                                                                              |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Protocol and state | `protocol`, `mission-runtime`              | `protocol.test.ts`, `mission-control.test.ts`                                                              |
| Roles and planning | `agents`, `orchestrator`                   | `specialists.test.ts`; acceptance script                                                                   |
| Models and policy  | `model-gateway`, `policy-engine`, `config` | `model-gateway.test.ts`, `security.test.ts`                                                                |
| Isolation          | `sandbox`, `candidate-manager`             | `candidate.test.ts`, `arena.test.ts`                                                                       |
| Evidence           | `evidence`, `openpitstop-adapter`          | `certificate.test.ts`, `arena.test.ts`, `assistant-features.test.ts`                                       |
| Intelligence       | `repo-intelligence`, `blindspot`, `memory` | `repository-intelligence.test.ts`, `blindspot.test.ts`                                                     |
| Skills             | `skills`                                   | `skills.test.ts`                                                                                           |
| Browser QA         | `browser-lab`                              | `browser-lab.test.ts`, browser acceptance                                                                  |
| Applications       | `daemon`, `cli`, `desktop`                 | `daemon.test.ts`, `assistant-features.test.ts`, `provider-presets.test.ts`; CLI, session and UI acceptance |

## Development

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
node scripts/release-check.mjs
```

Build the installable CLI package and tarball:

```sh
pnpm package:cli
pnpm pack:cli
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
- npm publication of `@pitcrew/cli` is pending; the source installer is the supported path today.
- Quick Assistant output is a draft and is never verification. Its Windows hotkey comes from the Start Menu shortcut; Linux hotkey binding is manual, and macOS is unproven.
- The built-in DuckDuckGo searcher is keyless and free but has no SLA: heavy automated use can be rate-limited or blocked, and its HTML shape can change without notice. Configure SearXNG or Brave for reliability-critical workflows.
- Automatic research is bounded to one decision call and one search round per request; it is not an open-ended browsing loop.
- The desktop app is Windows-first and unsigned; Linux/macOS Electron packaging and code signing are `NOT_PROVEN`.
- Memory and assistants are local SQLite records without embeddings, sync, or automatic summarization.
- The assistant and provider/session/desktop changes are included in the OpenPitStop strict verification of commit `60a1e79` (OK, CLEAN integrity, TRUSTWORTHY 100/100, 104/104 tests). The desktop build and installer remain NOT_PROVEN.
- Benchmark results are fixture validation only; no model contender was run.
- Browser QA uses a local Chrome or Edge and does not download one.
- The referee runs on the host; a containerized referee is not implemented.
- Production push, merge, and deploy are outside the automatic path.

Full list: [docs/limitations.md](docs/limitations.md). Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before your first change. Security issues go to [SECURITY.md](SECURITY.md). MIT licensed, local-only, no account and no telemetry.
