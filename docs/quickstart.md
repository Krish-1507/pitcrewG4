# Quickstart

This page is the technical setup path. For the short version, see the [README](../README.md).

## 1. Install

From a checkout, use the user-profile installer:

```powershell
.\install.ps1
```

```sh
./install.sh
```

The installer builds the CLI and Mission Control assets, installs into `%USERPROFILE%\PitCrew` (or `$HOME/PitCrew`), creates a Desktop launcher, and adds only user `PATH` entries. It does not request admin rights.

For a manual source setup:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm package:cli
npm install -g ./release/pitcrew-cli-0.1.0-dev.tgz
```

Node 22.13+, Git and pnpm 11.19.0 are required. The packaged CLI includes the pinned `openpitstop` runtime dependency; PitCrew runs it as a separate process and never imports it.

## 2. Authenticate a model yourself

PitCrew never writes a key value into configuration files, databases, logs,
prompts or evidence artifacts. Keys live either in an environment variable
(referenced by name only) or, when registered through the daemon, in the
operating system keychain — Windows Credential Manager, macOS Keychain or
Linux Secret Service. PitCrew never reads existing Codex authentication.

- Codex: install the official CLI and authenticate it normally.
- OpenAI, Claude, Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI or
  Together: put the API key in the environment variable setup suggests
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, ...).
- Ollama, LM Studio or llama.cpp: start the local server; setup detects your
  hardware, suggests a model size that fits, and lists installed models.

## 3. Generate a trusted config

```sh
pitcrew setup
```

This writes `~/.pitcrew/config.json` (or `$PITCREW_HOME/config.json`) with:

- the provider preset you choose (codex, openai, anthropic, gemini, openrouter,
  deepseek, groq, mistral, xai, together, freellmapi, ollama, lmstudio,
  llamacpp, or custom); for local presets it detects CPU, RAM and GPU and
  suggests a model tier that fits;
- the current Node executable and the installed `openpitstop/dist/cli.js` as the referee;
- `stack`, `architecture` and `baseline` referee layers;
- `node --test` as the project test command;
- a four-call, ten-minute budget;
- reduced isolation **disabled** unless you opt in.

The generated file is validated with the real schema before it is written. Use `--config` and `--state` when you want a checkout-local configuration instead.

If Docker is unavailable, opt in to host execution explicitly:

```sh
pitcrew setup --reduced-isolation --force
```

Reduced isolation provides Git isolation, not process or network containment. Keep it disabled for untrusted repositories. With Docker available, ordinary test commands run in a restricted, network-disabled container. The referee still runs on the host; a containerized referee is not implemented.

## 4. Check, then run

```sh
pitcrew doctor
pitcrew --repo . "fix the failing test"
```

`doctor` reports the real state of Git, Docker, OpenPitStop and the model executable.

Config and state default to the user profile, outside the repository being changed. Use `--config`/`--state` only when you need the older checkout-local workflow. The source `pnpm onboard` and `pnpm pitcrew --config ...` path remains available.

## Configuration

The generated config is ordinary JSON:

```json
{
  "provider": { "type": "codex", "executable": "codex" },
  "execution": { "allowReducedIsolation": false },
  "referee": {
    "executable": "ABSOLUTE_NODE_EXECUTABLE",
    "args": ["ABSOLUTE_OPENPITSTOP_DIST_CLI_JS"],
    "requiredLayers": ["stack", "architecture", "baseline"]
  },
  "test": { "executable": "ABSOLUTE_NODE_EXECUTABLE", "args": ["--test"] },
  "budget": { "maxModelCalls": 4, "timeoutMs": 600000 }
}
```

Windows shell wrappers are intentionally rejected for the referee. Use Node plus a JavaScript entry point.

An OpenAI-compatible provider can replace the Codex provider:

```json
{
  "type": "openai-compatible",
  "baseUrl": "http://127.0.0.1:11434/v1",
  "model": "YOUR_CONFIGURED_MODEL",
  "apiKeyEnv": "PITCREW_PROVIDER_KEY"
}
```

Omit `apiKeyEnv` for keyless loopback endpoints. Never put the key itself in JSON. See [providers.md](providers.md) and [sandbox-security.md](sandbox-security.md).

## Mission Control

```sh
pitcrew app
```

`app` opens the printed URL in your browser. Use `pitcrew ui` to print the URL and wait without opening a browser. The bearer token travels in the URL fragment and is kept in the browser session. Press `Ctrl+C` to stop the daemon. Cross-origin API requests are rejected.

As a desktop application (Windows first), the Electron shell wraps the same interface: native window and tray, daemon lifecycle owned by the app, token injected automatically. Build it with `pnpm --filter @pitcrew/desktop dist`; the installer lands at `release/desktop/PitCrew-Setup-<version>.exe`. The installer is unsigned today.

## Quick Assistant, memory, assistants and research

```sh
pitcrew app --quick
pitcrew quick
pitcrew research "query text"
pitcrew memory add --repo . "Use pnpm for this repository"
pitcrew memory list --repo .
pitcrew assistant add --name Reviewer --prompt "Prefer small, testable changes"
pitcrew assistants
```

`app --quick` and `quick` open the Quick Assistant view. It reads clipboard text when the browser permits it, otherwise paste manually, and returns a draft from the configured model. The draft is not verification and cannot mark a mission `VERIFIED`. The Windows installer registers `Ctrl+Alt+P`; on Linux, bind `$HOME/PitCrew/bin/pitcrew-quick` in your desktop environment. macOS hotkey behavior is unproven.

Memory notes are global or project-scoped. Project notes are attached to a project ID and are included only for that repository; global notes apply everywhere. Assistants store a prompt plus optional `route_id` and `model`. Project assistants are rejected by mission creation for another project and by Quick Assistant, which accepts global assistants only. Memory and assistant text is untrusted context, not policy.

Web research needs no configuration: a keyless DuckDuckGo searcher is built in and runs only when research is used. For a contracted provider, set:

```sh
# Local SearXNG (HTTPS, or HTTP only on loopback)
PITCREW_SEARXNG_URL=http://127.0.0.1:8080 pitcrew app

# Brave Search
PITCREW_BRAVE_SEARCH_API_KEY=... pitcrew app
```

Only the normalized query is sent. Results are treated as untrusted context. `GET /v1/research` reports the active provider; `POST /v1/research` performs a query. Quick Assistant research is automatic by default: one bounded model decision, then at most one search round. Set the request's `web` field to `true` to always search, `false` to never search; the Mission Control view offers the same three modes.

An interactive session is available in any terminal:

```sh
pitcrew
```

Type a task to start a mission, or use `/quick`, `/research`, `/memory`, `/doctor`, `/providers`, `/skills`, `/story`, `/open`, `/app` and `/help`. `/exit` leaves the session.

If routing is configured, Quick Assistant requests the `quick-assistant` role. Add that role to an eligible route, or keep the single-provider configuration where routing is absent.

## Inspection

Commands use the default user configuration and state. Use `--config`/`--state` to override them.

- `doctor`: actual executable and service checks.
- `open`: read-only Git and source inspection.
- `replay mis_<id>`: persisted mission timeline.
- `diff mis_<id>`: candidate diff and evidence identity.
- `certificate mis_<id>`: merge certificate, or the reason none exists.
- `story prj_<id>`: the five-view repository story.
- `skills <dir>`: validate installed skill manifests.
- `blindspot --mutations <file>`: controlled mutation run.

The daemon owns SQLite and artifacts. The CLI only uses its authenticated loopback API. A private IPC channel bootstraps the bearer token.

## Controls

Interactive missions accept `/pause`, `/resume` and `/cancel` as input lines. Pause takes effect at the next safe operation boundary. A protected edit shows its exact proposal and action hash and requires typing `approve`. Non-interactive clients reject such edits. Credentials and out-of-scope paths cannot be approved.

The API accepts `POST /v1/missions/{id}/pause`, `/resume`, `/cancel`, and `POST /v1/approvals/{id}` with `{ "decision": "approve", "action_hash": "..." }`. Historical verification is projected as stale if current candidate bytes differ.

## Repository intelligence

`open` indexes real Git source even when the working tree is dirty. It returns source-linked facts, observed import edges, inferred route candidates and explicit parse limitations. Manifest, authorization and CI changes invalidate old facts. Graphs are content-addressed artifacts; facts are stored in SQLite migration 2. Inspection uses Tree-sitter and no model calls.

## Acceptance scripts

```sh
node scripts/live-acceptance.mjs
node scripts/browser-acceptance.mjs
```

Live acceptance creates a fresh, truly failing fixture repository under `.pitcrew/acceptance/`, invokes the real Codex CLI and OpenPitStop 1.10.0, and asserts the baseline is unchanged. It spends a real model call and needs an authenticated CLI.

Browser acceptance reproduces a seeded checkout recovery defect twice against the buggy page and verifies the fixed page. It needs a local Chrome or Edge.

Both are separate from the deterministic test suite.
