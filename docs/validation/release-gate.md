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
| Benchmark raw results are published                 | PASS    | `benchmarks/pitcrew-core/results/run-2026-10-20T08-19-26-131Z.json` records ten MATCH rows, source commit `7b72578`, `dirty: true`, `contenders: []` and the fixture-validation limitation.                                                                                                                                               |
| A clean installation is verified                    | PARTIAL | `pnpm install --frozen-lockfile`, build, test, typecheck, lint and format checks pass on Windows 11 locally. CI runs the same commands on `ubuntu-latest` and `windows-latest`. A clean macOS installation has not been exercised and remains NOT_PROVEN.                                                                                 |

## OpenPitStop independent verification

Command:

```bash
node_modules/.bin/openpitstop scan
node_modules/.bin/openpitstop verify
```

Result for source commit `bfce57e9081c8c72b50bbaa6f33d35be68c781af`:

- verdict: OK, exit code 0;
- integrity: CLEAN, 0 confirmed, 0 suspicious;
- honesty: 100, TRUSTWORTHY;
- tests: 92/92 passed;
- candidate binding: clean working tree;
- scan risk: Medium; 21 medium heuristic findings remain (fixture and generated-markup patterns), with no confirmed exploitable finding and no verification-integrity finding.

This document was updated in a later documentation-only commit after the verified source commit; no source file differs.

Raw referee records are written to `.pitstop/verify-*.json` and `.pitstop/scan-latest.json`. These are local evidence artifacts and are not committed.

Limitation: OpenPitStop's integrity detector compares the tree against the last commit. Running it on an uncommitted tree reports false `hardcoded-matches-test-expectation` findings for legitimate HTTP status codes and domain enums, so the recorded verdict was taken on a clean commit. This is documented rather than worked around by altering tests.
