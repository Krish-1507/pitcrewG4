# P0 quickstart

This is a development CLI vertical slice, not the completed desktop product.

1. Install Node 22.12+, Git and pnpm 11.19.0.
2. Run `pnpm install --frozen-lockfile` and `pnpm build`.
3. Authenticate the official Codex CLI yourself. PitCrew never reads its tokens.
4. Create a trusted JSON configuration outside the target repository (example below).
5. Run `node apps/cli/dist/index.js --config <absolute-config> --repo <clean-repo> --state <state-directory> "fix the failing test"`.

```json
{
  "provider": { "type": "codex", "executable": "codex" },
  "execution": { "allowReducedIsolation": true },
  "referee": {
    "executable": "ABSOLUTE_NODE_EXECUTABLE",
    "args": ["ABSOLUTE_OPENPITSTOP_DIST_CLI_JS"],
    "requiredLayers": ["stack", "architecture", "baseline"]
  },
  "test": { "executable": "node", "args": ["--test"] },
  "budget": { "maxModelCalls": 4, "timeoutMs": 600000 }
}
```

For the development installation, the independent referee entry point is
`node_modules/openpitstop/dist/cli.js`. It is a pinned npm package, invoked as a
separate process, never imported. Installed `pitstop` native executables can
also be configured. Windows shell wrappers are intentionally rejected: use
Node plus a CLI JavaScript entry point.

Reduced isolation is explicit consent to running the target's test/build code
on the host. It provides Git isolation, not process or network containment.
Keep it disabled for untrusted repositories. With Docker available, ordinary
test commands use a restricted, network-disabled container. The initial referee
runner still needs explicit host execution consent; a containerized referee is
not yet implemented. Docker-only security checks are not invoked or marked pass.

An OpenAI-compatible provider can replace the Codex configuration:

```json
{
  "type": "openai-compatible",
  "baseUrl": "http://127.0.0.1:11434/v1",
  "model": "YOUR_CONFIGURED_MODEL",
  "apiKeyEnv": "PITCREW_PROVIDER_KEY"
}
```

Omit `apiKeyEnv` for keyless local endpoints. Never put the key itself in JSON.
FreeLLMAPI and LM Studio can use their configured compatible endpoint. Native
Ollama routing, OS keychain settings and additional CLI bridges are later milestones.

## Inspection

Use the same `--config` and `--state` arguments with:

- `doctor`: actual executable/service checks.
- `open --repo <path>`: read-only Git and source inspection.
- `replay mis_<id>`: persisted mission timeline.
- `diff mis_<id>`: candidate diff and current evidence identity.

The daemon owns SQLite and artifacts. The CLI only uses its authenticated
loopback API. A private IPC channel bootstraps the bearer token.

## Real acceptance

`node scripts/live-acceptance.mjs` creates a fresh, truly failing fixture Git
repository under `.pitcrew/acceptance/`, invokes the real Codex CLI and real
OpenPitStop 1.10.0, and asserts the baseline is unchanged. This spends a real
model call and requires the authenticated CLI. It is deliberately separate from
the deterministic unit/integration test suite.

## Controls

Interactive missions accept `/pause`, `/resume` and `/cancel` as input lines.
Pause takes effect at the next safe operation boundary. A protected edit shows
its exact proposal and action hash and requires typing `approve`. Noninteractive
clients reject such edits. Credentials and out-of-scope paths cannot be approved.

The API accepts `/v1/missions/{id}/pause`, `/resume`, `/cancel`, and
`POST /v1/approvals/{id}` with `{ "decision": "approve", "action_hash": "..." }`.
Historical verification is projected as stale if current candidate bytes differ.

## Repository intelligence

`open` now indexes real Git source even when the working tree is dirty. It returns source-linked facts, observed import edges, inferred route candidates and explicit parse limitations. Manifest, authorization and CI changes invalidate old facts. Graphs are content-addressed artifacts; facts are stored in SQLite migration 2. Inspection uses Tree-sitter and no model calls.
