# Contributing

Thanks for helping out. A few things matter in this repo, so read this first.

## Ground rules

- Read `AGENTS.md` and the package you want to touch before editing. `AGENTS.md` explains the package boundaries and the trust rules that keep the referee independent.
- Keep orchestration separate from verification. PitCrew never certifies its own work; only OpenPitStop does.
- Use public package entry points. Do not reach into other packages' internals.
- Fix the system, not the test. Never delete, skip or weaken a failing test to make it pass.
- TypeScript is strict. No `any` at trust boundaries; validate untrusted data with Zod.

## Checks

Your change needs all of these to pass:

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Changes to verification, policy or candidate handling also need a real OpenPitStop run where configured. If independent verification is not available, say so in the description. An unverifiable change is reported as NOT PROVEN, never as verified.

## Dependencies

Before adding a package, check whether the platform already covers it. If you add one, record its purpose and license in `docs/dependencies.md`.

## Reporting issues

For security issues, follow `SECURITY.md` and report privately. For everything else, open a GitHub issue with steps to reproduce and the commands you ran.
