# Quickstart

This page is the technical setup path. For the short version, see the [README](../README.md).

## 1. Install

```sh
pnpm install --frozen-lockfile
pnpm build
```

Node 22.13+, Git and pnpm 11.19.0 are required. Keep the pinned `openpitstop` development dependency installed; PitCrew runs it as a separate process and never imports it.

## 2. Authenticate a model yourself

PitCrew never reads or stores your model credentials.

- Codex: install the official CLI and authenticate it normally.
- Ollama or another OpenAI-compatible endpoint: have the endpoint ready and use an environment variable for any key.

## 3. Generate a trusted config

```sh
pnpm onboard --repo .
```

This writes `.pitcrew/config.json` with:

- the Codex provider by default;
- the current Node executable and the pinned `node_modules/openpitstop/dist/cli.js` as the referee;
- `stack`, `architecture` and `baseline` referee layers;
- `node --test` as the project test command;
- a four-call, ten-minute budget;
- reduced isolation **disabled**.

The generated file is validated with the real schema before it is written. Edit it if your project does not use `node --test`.

If Docker is unavailable, opt in to host execution explicitly:

```sh
pnpm onboard --repo . --reduced-isolation
```

Reduced isolation provides Git isolation, not process or network containment. Keep it disabled for untrusted repositories. With Docker available, ordinary test commands run in a restricted, network-disabled container. The referee still runs on the host; a containerized referee is not implemented.

## 4. Check, then run

```sh
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo . doctor
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo . "fix the failing test"
```

`doctor` reports the real state of Git, Docker, OpenPitStop and the model executable.

Keep `--config` and `--state` outside the repository you are changing. The examples above are safe because `.pitcrew/` is ignored in this checkout; for another repository, run from here and pass `--repo ../my-app`.

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
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew ui
```

Open the printed URL. The bearer token travels in the URL fragment and is kept in the browser session. Press `Ctrl+C` to stop the daemon. Cross-origin API requests are rejected.

## Inspection

Use the same `--config` and `--state` arguments with:

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
