# PitCrew

PitCrew is a local-first AI software engineering crew. You give it a task like "fix the failing test". It researches your repository, proposes a fix on an isolated Git branch, runs your real tests, and only reports success when an independent referee agrees.

Trust is the point. PitCrew never edits your working tree. Every candidate change lives in its own Git worktree, evidence is tied to the exact bytes of the change, and the OpenPitStop CLI — a separate program, never imported — issues the final verdict. If no referee says PASS, PitCrew says not proven.

This is a development project, not a finished product. See [docs/roadmap.md](docs/roadmap.md) for what is done and what is next.

## Capabilities

- Evidence-linked repository intelligence with Product, System, Request Journey, Change Impact and Trust views.
- An Assumption Ledger and Blindspot Engine that mutate disposable candidates to expose verification debt.
- A candidate Arena with independent hypotheses, test-weakening detection, elimination and exact-digest selection.
- Browser QA against authorized loopback targets with semantic locators, traces, screenshots, console and network capture, seeded network failures and axe accessibility audits.
- Mission Control: a local web interface served by the daemon with real mission events, approvals, arena state, repo story, evidence and provider status.
- Merge certificates that bind a selected candidate, its digest, the independent verdict, approvals, eliminations and evidence manifest.
- Nine versioned skills with manifests that request permissions and never grant them.
- A deterministic benchmark harness and published raw fixtures results.
- A competition profile under `profiles/g4/`.

## Requirements

- Node.js 22.13 or newer
- Git
- pnpm 11.19.0
- A model. Either the official [Codex CLI](https://developers.openai.com/codex/) installed and authenticated by you, or any OpenAI-compatible endpoint such as Ollama.

Keep the OpenPitStop package installed too. It ships as a development dependency here, and PitCrew runs it as a separate process.

## Install

```sh
pnpm install
pnpm build
```

## Use

Create a JSON config file somewhere outside the repository you want to change:

```json
{
  "provider": { "type": "codex", "executable": "codex" },
  "execution": { "allowReducedIsolation": true },
  "referee": {
    "executable": "node",
    "args": ["/absolute/path/to/node_modules/openpitstop/dist/cli.js"],
    "requiredLayers": ["stack", "architecture", "baseline"]
  },
  "test": { "executable": "node", "args": ["--test"] },
  "budget": { "maxModelCalls": 4, "timeoutMs": 600000 }
}
```

Then run a mission from the repo root:

```sh
node apps/cli/dist/index.js --config /path/to/config.json --repo /path/to/your-repo --state /path/to/state "fix the failing test"
```

The CLI starts its daemon, plans the work, makes a candidate, and prints the diff and the referee's verdict. You can inspect without running a mission:

```sh
node apps/cli/dist/index.js --config /path/to/config.json --repo /path/to/your-repo --state /path/to/state doctor
```

`doctor` checks every executable and service it will need. `open` inspects a repository read-only, `replay` shows a past mission, `diff` shows a candidate, `certificate` prints the merge certificate, `story` renders the repo story and `ui` prints the Mission Control URL.

Browser QA runs through the daemon against a loopback target:

```sh
node scripts/browser-acceptance.mjs
```

The acceptance script reproduces a seeded checkout recovery defect twice and verifies the fixed page.

Ollama and other OpenAI-compatible providers work too, and API keys can live in your OS keychain. Full configuration, provider options and safety notes are in [docs/quickstart.md](docs/quickstart.md) and [docs/providers.md](docs/providers.md).

## How it works

1. Your mission becomes a plan with acceptance criteria.
2. A bounded role — Implementer, Debugger, Architect, and so on — proposes changes. Model output is data, never commands; policy decides what is allowed.
3. Changes are applied inside a Git worktree. Your checkout is never touched.
4. Your tests run against the candidate. If they pass and policy is satisfied, OpenPitStop independently re-verifies the result.
5. Hard tasks can branch into several candidates with different hypotheses. Weak ones get eliminated — including any candidate that weakens a test to look like it passes.
6. Every step is an append-only event, so a mission can be replayed and audited.

## Development

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
node scripts/release-check.mjs
```

Benchmark fixtures:

```sh
node benchmarks/pitcrew-core/run.mjs
```

The live acceptance script `node scripts/live-acceptance.mjs` runs a real end-to-end mission with the real Codex CLI and a really failing fixture. It costs real model calls, so it is separate from the regular test suite.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before your first change.

Security issues go to [SECURITY.md](SECURITY.md). Everything here is MIT licensed, runs locally, and requires no account or telemetry.
