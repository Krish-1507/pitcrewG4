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

PitCrew never reads or stores your model credentials.

- Codex: install the official CLI and authenticate it normally.
- Ollama or another OpenAI-compatible endpoint: have the endpoint ready and use an environment variable for any key.

## 3. Generate a trusted config

```sh
pitcrew setup
```

This writes `~/.pitcrew/config.json` (or `$PITCREW_HOME/config.json`) with:

- the provider and model you choose;
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
