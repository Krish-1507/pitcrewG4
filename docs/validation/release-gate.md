# Release gate evidence

This record maps each gate from [roadmap.md](../roadmap.md) to executable evidence. A gate is `PASS` only when the named deterministic test or check was observed on the current source. Missing evidence is `NOT_PROVEN`, never assumed.

Deterministic suite: 93 tests across 16 files, passing. Commands: `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `node scripts/release-check.mjs`.

| Gate                                                | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The baseline is never edited by an agent            | PASS    | `tests/candidate.test.ts` checks the baseline stays clean while edits land only in the candidate. `tests/arena.test.ts` re-fingerprints the baseline after candidate creation, verification, elimination and selection. `tests/blindspot.test.ts` asserts the mutated candidate is restored byte-for-byte even when the verifier crashes.                                                |
| Candidate work survives a daemon restart            | PASS    | `tests/daemon.test.ts`: "keeps candidate work after a daemon restart" starts and stops the daemon twice and asserts the candidate root and fingerprint are stable.                                                                                                                                                                                                                       |
| Cancellation kills the whole process tree           | PASS    | `tests/security.test.ts` cancels a running sandbox child process and asserts that no descendant survives.                                                                                                                                                                                                                                                                                |
| Secrets never reach the database or logs            | PASS    | `tests/security.test.ts` redacts credentials, rejects secret values from model context, stores a redacted artifact and reads it back as `[REDACTED]`. Provider credentials are keychain references; `tests/daemon.test.ts` verifies raw credentials are not accepted in routing profiles.                                                                                                |
| A prompt-injection fixture cannot gain permissions  | PASS    | `tests/security.test.ts` produces repository text that requests approval and asserts it cannot change policy or grant permissions.                                                                                                                                                                                                                                                       |
| High-risk actions require real approval             | PASS    | `tests/mission-control.test.ts` binds approval to the exact action hash; changed scope, changed contents and secret paths are rejected before a write.                                                                                                                                                                                                                                   |
| Stale evidence cannot authorize a changed candidate | PASS    | `tests/arena.test.ts` binds records and selection to exact candidate digests and rejects mismatches. `tests/security.test.ts` returns `STALE_EVIDENCE` for a tampered artifact. `tests/certificate.test.ts` requires matching selection and referee digests with fresh evidence.                                                                                                         |
| An OpenPitStop failure blocks the verified state    | PASS    | `tests/referee-gate.test.ts` reduces a BLOCKED verdict to BLOCKED and forbids a verdict before the final gate or without a candidate. `packages/mission-runtime` forbids IMPLEMENTING to VERIFIED directly.                                                                                                                                                                              |
| Missing OpenPitStop yields NOT_PROVEN               | PASS    | `tests/referee-gate.test.ts` reduces a missing verdict to NOT_PROVEN. `tests/certificate.test.ts` produces no certificate and reports no verified referee when the verdict is absent.                                                                                                                                                                                                    |
| Benchmark raw results are published                 | PASS    | `benchmarks/pitcrew-core/results/run-2026-11-24T07-58-20-982Z.json` records ten MATCH rows, source commit `8e11062`, `dirty: false`, `contenders: []` and the fixture-validation limitation.                                                                                                                                                                                             |
| A clean installation is verified                    | PARTIAL | `pnpm install --frozen-lockfile`, build, test, typecheck, lint and format checks pass on Windows 11 locally. `install.ps1` was smoke-tested into a fresh temporary user prefix, including packaged CLI install, setup, doctor, Mission Control and tree-sitter indexing. `install.sh` passed syntax validation but was not executed here. A clean macOS installation remains NOT_PROVEN. |

## OpenPitStop independent verification

Command:

```bash
node_modules/.bin/openpitstop scan
node_modules/.bin/openpitstop verify
```

Result for source commit `1c21762cf8bc7d0f0eca0aa4d4093e6d5dd52edd` (one-command installer, packaged CLI, user config, and documentation alignment):

- verdict: OK, exit code 0, not blocked, not stale;
- integrity: CLEAN, 0 confirmed, 0 suspicious;
- honesty: 100, TRUSTWORTHY;
- regression risk: Low, zero deltas in tests passed/failed, security and duplication;
- tests: 93/93 passed (54.8 s);
- candidate binding: clean working tree, head `1c21762`, tree digest `1e4a7e9162f1ab9b25a637fbb405993667e09addd1bb05d076325048781c2ee0`;
- sealed evidence digest: `028b7edb27144ab13efd652d274f0554e60ca03c95035c06164d6d5cb8bc34be`, signed at `2026-11-24T12:27:02.660Z` (baseline evidence `e3b272f7de5812418c2aab5ae9d3bf803ec4407b612e91ef0a8d5edf6a12b3f6`);
- OpenPitStop score: 56/100 (C-), unchanged from the baseline scan;
- scan risk: Low; 21 medium heuristic findings remain.

Remaining heuristic findings include two UI render sinks at `apps/desktop/src/app.js:49` and `:135`; every interpolated value passes through the `esc()` helper, so they are recorded as known false positives rather than accepted exploits. The scan also flags the printed Mission Control URL at `apps/cli/src/index.ts:424` as credential logging. That bearer token is an ephemeral, loopback-only daemon session token printed to the local operator's terminal because the UI reads it from the URL fragment and `sessionStorage`; it is never written to SQLite, evidence artifacts, model context or remote logs. It is recorded here as an intentional local-only disclosure. The pre-existing clusters (file-upload size/type, direct DB access, fixture duplication) are unchanged from the baseline scan.

Three timing-sensitive checks were hardened in an earlier source commit without weakening their assertions: the process-tree cancellation test allows bounded reaping time; the daemon blindspot test forces deterministic reduced isolation so a CI Docker daemon cannot change the execution path; and its disposable-worktree check retries a transient `git worktree list` lock before asserting exactly one worktree.

CI status for commit `1c21762` is not yet recorded here; it is expected to run on push. This document is updated in a later documentation-only commit after the verified source commit; no source file differs.

Raw referee records are written to `.pitstop/verify-*.json` and `.pitstop/scan-latest.json`. These are local evidence artifacts and are not committed.

Limitation: OpenPitStop's integrity detector compares the tree against the last commit. Running it on an uncommitted tree reports false `hardcoded-matches-test-expectation` findings for legitimate HTTP status codes and domain enums, so the recorded verdict was taken on a clean commit. This is documented rather than worked around by altering tests.
