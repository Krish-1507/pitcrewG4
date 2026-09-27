# Contributing

Read `AGENTS.md`, then the relevant package and specification before editing.
Keep orchestration separate from verification. Use public package entry points.

Run `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and
`pnpm format:check`. Trust-boundary changes require adversarial tests and a real
OpenPitStop run where configured. Missing independent verification must be
reported as NOT PROVEN. Never fabricate fixture results as live acceptance.

Dependency additions must record purpose and license in `docs/dependencies.md`.
