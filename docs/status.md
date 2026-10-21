# Status

Current state: milestones 0 through 15 are implemented. Release-gate evidence is recorded in [validation/release-gate.md](validation/release-gate.md); ten of eleven gates pass and a clean macOS installation remains NOT_PROVEN. See [roadmap.md](roadmap.md) and [validation/features-7-15.md](validation/features-7-15.md).

## Delivered

| Milestone | Highlight                                                                                  | Date                         |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| 0         | Monorepo, strict TypeScript, Vitest, Windows/Linux CI                                      | shipped                      |
| 1         | CLI vertical slice: real candidate, real tests, OpenPitStop VERIFIED                       | shipped                      |
| 2         | Pause/resume/cancel, approvals, durable event replay                                       | shipped                      |
| 3         | Tree-sitter repository intelligence with source-linked facts                               | shipped                      |
| 4         | Provider adapters, routing profiles, OS keychain                                           | shipped                      |
| 5         | Bounded specialist roles (CEO, Scientist, Architect, Implementer, Debugger, Test Engineer) | shipped                      |
| 6         | Candidate identity and Arena: hypotheses, elimination, exact-digest selection              | shipped                      |
| 7         | Assumption Ledger and Blindspot Engine with verification debt                              | shipped                      |
| 8         | Five-view evidence-labelled Repo Story                                                     | shipped                      |
| 9         | Browser QA Lab with traces, seeded failures and axe audits                                 | shipped                      |
| 10        | Mission Control served by the daemon                                                       | shipped                      |
| 11        | Merge certificate and append-only replay                                                   | shipped                      |
| 12        | Nine validated skills with permission requests only                                        | shipped                      |
| 13        | Ten-category benchmark harness with published raw results                                  | shipped                      |
| 14        | Competition profile `profiles/g4/`                                                         | shipped                      |
| 15        | Release hardening documentation, release-check script and gate evidence                    | shipped, one gate NOT_PROVEN |

The deterministic suite currently passes 92 tests across 16 files. OpenPitStop strict verification on the clean source commit reports OK, CLEAN integrity, TRUSTWORTHY honesty and 92/92 tests.

## Live evidence

Milestone 1 produced a full P0 acceptance: an authenticated Codex CLI, a real isolated Git candidate, a failing baseline, a passing candidate test set and an OpenPitStop 1.10.0 strict VERIFIED verdict, with the baseline untouched. The record is in [validation/p0.md](validation/p0.md).

Milestone 6's hero fixture is a real duplicate-checkout race. The racy candidate is eliminated for failing the reproduction, a test-weakening candidate is eliminated, and the correct candidate survives and receives a strict OpenPitStop VERIFIED verdict with matching digest.

Milestone 9's browser acceptance reproduces a seeded checkout recovery defect twice against the buggy page and verifies the fixed page with a passing check sequence and accessibility audit. Raw artifacts are written under `.pitcrew/browser-acceptance/`.

Milestone 13's published raw result validates all ten fixture baselines. It does not claim a model comparison.

## Known limitations

- Live model missions could not be re-recorded in this environment because the Codex CLI was unavailable; prior live runs remain the standing evidence.
- The published benchmark results validate fixtures and harness behavior only; no model-backed contender was executed.
- Browser QA depends on a locally installed Chrome or Edge. Observe mode requires a desktop session.
- The referee always runs on the host; a containerized referee is not implemented yet.
- macOS clean-machine installation has not been verified locally; CI covers Windows and Linux, and the macOS gate is NOT_PROVEN.
- Mission Control is a local web interface, not a packaged native desktop application.

## CI

Windows and Linux CI runs on every push: build, test, typecheck, lint and format checks.
