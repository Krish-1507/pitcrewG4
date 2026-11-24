# Release gate evidence

This record maps each gate from [roadmap.md](../roadmap.md) to executable evidence. A gate is `PASS` only when the named deterministic test or check was observed on the current source. Missing evidence is `NOT_PROVEN`, never assumed.

Deterministic suite: 92 tests across 16 files, passing. Commands: `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `node scripts/release-check.mjs`.

| Gate                                                | Status  | Evidence                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The baseline is never edited by an agent            | PASS    | `tests/candidate.test.ts` checks the baseline stays clean while edits land only in the candidate. `tests/arena.test.ts` re-fingerprints the baseline after candidate creation, verification, elimination and selection. `tests/blindspot.test.ts` asserts the mutated candidate is restored byte-for-byte even when the verifier crashes. |
| Candidate work survives a daemon restart            | PASS    | `tests/daemon.test.ts`: "keeps candidate work after a daemon restart" starts and stops the daemon twice and asserts the candidate root and fingerprint are stable.                                                                                                                                                                        |
| Cancellation kills the whole process tree           | PASS    | `tests/security.test.ts` cancels a running sandbox child process and asserts that no descendant survives.                                                                                                                                                                                                                                 |
| Secrets never reach the database or logs            | PASS    | `tests/security.test.ts` redacts credentials, rejects secret values from model context, stores a redacted artifact and reads it back as `[REDACTED]`. Provider credentials are keychain references; `tests/daemon.test.ts` verifies raw credentials are not accepted in routing profiles.                                                 |
| A prompt-injection fixture cannot gain permissions  | PASS    | `tests/security.test.ts` produces repository text that requests approval and asserts it cannot change policy or grant permissions.                                                                                                                                                                                                        |
| High-risk actions require real approval             | PASS    | `tests/mission-control.test.ts` binds approval to the exact action hash; changed scope, changed contents and secret paths are rejected before a write.                                                                                                                                                                                    |
| Stale evidence cannot authorize a changed candidate | PASS    | `tests/arena.test.ts` binds records and selection to exact candidate digests and rejects mismatches. `tests/security.test.ts` returns `STALE_EVIDENCE` for a tampered artifact. `tests/certificate.test.ts` requires matching selection and referee digests with fresh evidence.                                                          |
| An OpenPitStop failure blocks the verified state    | PASS    | `tests/referee-gate.test.ts` reduces a BLOCKED verdict to BLOCKED and forbids a verdict before the final gate or without a candidate. `packages/mission-runtime` forbids IMPLEMENTING to VERIFIED directly.                                                                                                                               |
| Missing OpenPitStop yields NOT_PROVEN               | PASS    | `tests/referee-gate.test.ts` reduces a missing verdict to NOT_PROVEN. `tests/certificate.test.ts` produces no certificate and reports no verified referee when the verdict is absent.                                                                                                                                                     |
| Benchmark raw results are published                 | PASS    | `benchmarks/pitcrew-core/results/run-2026-11-24T07-20-08-264Z.json` records ten MATCH rows, source commit `46f119b`, `dirty: false`, `contenders: []` and the fixture-validation limitation.                                                                                                                                              |
| A clean installation is verified                    | PARTIAL | `pnpm install --frozen-lockfile`, build, test, typecheck, lint and format checks pass on Windows 11 locally. CI runs the same commands on `ubuntu-latest` and `windows-latest`. A clean macOS installation has not been exercised and remains NOT_PROVEN.                                                                                 |

## OpenPitStop independent verification

Command:

```bash
node_modules/.bin/openpitstop scan
node_modules/.bin/openpitstop verify
```

Result for source commit `fe84322567e392d0e985905e793410610e70ffa1` (Mission Control UI and CLI redesign, plus a test-stability hardening):

- verdict: OK, exit code 0;
- integrity: CLEAN, 0 confirmed, 0 suspicious;
- honesty: 100, TRUSTWORTHY;
- regression risk: Low, zero deltas in tests passed/failed, security and duplication;
- tests: 92/92 passed;
- candidate binding: clean working tree (tree digest `69f79329…`);
- OpenPitStop score: 56/100 (C-), unchanged from the baseline scan;
- scan risk: Low; 22 medium heuristic findings remain.

The redesign changed only `apps/cli` and `apps/desktop`. Remaining heuristic findings include two UI render sinks at `apps/desktop/src/app.js:49` and `:135`; every interpolated value passes through the `esc()` helper, so they are recorded as known false positives rather than accepted exploits. The pre-existing clusters (file-upload size/type, direct DB access, fixture duplication) are unchanged from the baseline scan.

CI is green on `ubuntu-latest` and `windows-latest` for this commit (build, test, typecheck, lint, format). Three timing-sensitive checks were hardened without weakening their assertions: the process-tree cancellation test allows bounded reaping time; the daemon blindspot test forces deterministic reduced isolation so a CI Docker daemon cannot change the execution path; and its disposable-worktree check retries a transient `git worktree list` lock before asserting exactly one worktree.

This document was updated in a later documentation-only commit after the verified source commit; no source file differs.

Raw referee records are written to `.pitstop/verify-*.json` and `.pitstop/scan-latest.json`. These are local evidence artifacts and are not committed.

Limitation: OpenPitStop's integrity detector compares the tree against the last commit. Running it on an uncommitted tree reports false `hardcoded-matches-test-expectation` findings for legitimate HTTP status codes and domain enums, so the recorded verdict was taken on a clean commit. This is documented rather than worked around by altering tests.
