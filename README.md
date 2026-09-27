# PitCrew

Local-first engineering orchestration. AI proposes. The repository cross-examines.
OpenPitStop referees.

Development is proceeding in the order specified in [the implementation plan](docs/spec/8_ImplementationPlan.md).
This repository is not yet a production release. See [delivery status](docs/status.md).

## Development

Node.js 22.12 or newer, Git and pnpm 11.19.0 are required.

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Specifications are preserved in `docs/spec/`. `AGENTS.md` defines package and trust boundaries.
OpenPitStop remains an independent installation; PitCrew does not implement its referee.

MIT licensed. No telemetry or cloud account is required.
