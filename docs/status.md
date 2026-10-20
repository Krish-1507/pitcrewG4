# Status

Current state: milestones 0 through 6 are complete. Milestones 7 through 15 are not. See [roadmap.md](roadmap.md).

## Delivered

| Milestone | Highlight                                                                                  | Date    |
| --------- | ------------------------------------------------------------------------------------------ | ------- |
| 0         | Monorepo, strict TypeScript, Vitest, Windows/Linux CI                                      | shipped |
| 1         | CLI vertical slice: real candidate, real tests, OpenPitStop VERIFIED                       | shipped |
| 2         | Pause/resume/cancel, approvals, durable event replay                                       | shipped |
| 3         | Tree-sitter repository intelligence with source-linked facts                               | shipped |
| 4         | Provider adapters, routing profiles, OS keychain                                           | shipped |
| 5         | Bounded specialist roles (CEO, Scientist, Architect, Implementer, Debugger, Test Engineer) | shipped |
| 6         | Candidate identity and Arena: hypotheses, elimination, exact-digest selection              | shipped |

The deterministic suite currently passes 73 tests.

## Live evidence

Milestone 1 produced a full P0 acceptance: an authenticated Codex CLI, a real isolated Git candidate, a failing baseline, a passing candidate test set and an OpenPitStop 1.10.0 strict VERIFIED verdict, with the baseline untouched. The record is in [validation/p0.md](validation/p0.md).

Milestone 6's hero fixture is a real duplicate-checkout race. The racy candidate is eliminated for failing the reproduction, a test-weakening candidate is eliminated, and the correct candidate survives and receives a strict OpenPitStop VERIFIED verdict with matching digest.

## Known limitations

- Milestone 6 live evidence could not be re-recorded with a fresh model in this environment because the Codex CLI was unavailable; prior live runs remain the standing evidence.
- The referee always runs on the host; a containerized referee is not implemented yet.
- This is not a production release or a finished desktop application.

## CI

Windows and Linux CI runs on every push: build, test, typecheck, lint and format checks.
