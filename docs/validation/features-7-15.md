# Milestones 7-15: implementation record

This page links each delivered milestone to its code and executable evidence. A milestone is listed as shipped only when the deterministic suite passes and the acceptance command below has been observed.

## Milestone 7: Blindspot Engine

- Assumption states: PROTECTED, INFERRED, UNPROTECTED, EXTERNAL_VOLATILE, CONTRADICTED.
- Controlled mutations run inside a disposable candidate; bytes are restored in a `finally` block and the candidate fingerprint is checked before reporting.
- A survived mutation becomes verification debt; a declared-protected survival is CONTRADICTED.
- Evidence: `tests/blindspot.test.ts` (weak suite exposes debt, strong verifier protects the same assumptions, ambiguous mutations and path escapes are rejected, verifier crashes restore bytes) and the blindspot API test in `tests/daemon.test.ts`.
- Fixture: `fixtures/blindspot-weak-suite/`.

## Milestone 8: Repo Story

- Five views: product, system, request journey, change impact and trust.
- Every item carries observed, inferred or user-declared kind plus source evidence. Relationships are linked to the repository graph and boundary digest.
- Evidence: `tests/story.test.ts`, `packages/repo-intelligence/src/story.ts`, daemon `GET /v1/projects/:id/story`, CLI `story`.
- Limitations are carried from the repository graph instead of being invented.

## Milestone 9: Browser QA Lab

- Managed Chrome or Edge through `playwright-core`; no browser download.
- Observe, headless and replay modes; semantic locators; traces, screenshots, console and network capture; counterfactual 500, abort, timeout and offline routes; axe injection.
- Targets are restricted to http(s) loopback unless `PITCREW_BROWSER_ALLOW_HOSTS` authorizes the host.
- Acceptance: `node scripts/browser-acceptance.mjs` reproduces the seeded recovery defect twice on `fixtures/browser-recovery/bug` and passes every check on `fixtures/browser-recovery/fixed`; artifacts are written under `.pitcrew/browser-acceptance/`.
- Unit evidence: `tests/browser-lab.test.ts`.

## Milestone 10: Mission Control

- Served by the daemon at `/`; assets under `/ui/`.
- Screens: project home, new mission, mission control, approvals, arena, repo story, browser lab, evidence and providers.
- Renders real daemon state only. A missing verdict renders NOT_PROVEN; no progress is fabricated.
- Same-origin browser requests are accepted with the bearer token; cross-origin requests remain rejected.

## Milestone 11: Merge certificate and replay

- `buildMergeCertificate` binds the selected candidate digest, referee verdict and artifact, approvals, eliminations and evidence manifest.
- Merge eligibility requires VERIFIED state, matching selection/referee digests and fresh evidence. A missing verdict yields no certificate.
- API: `GET /v1/missions/:id/certificate`; CLI: `certificate`.
- Evidence: `tests/certificate.test.ts`; replay remains the append-only timeline from the mission runtime.

## Milestone 12: Skills

- `packages/skills` validates manifests, directory names, instructions and containment.
- Skills request permissions; loading a skill never grants one.
- Nine skills installed under `skills/`: architecture, debugging, api-contract, database-safety, security-review, accessibility, browser-qa, performance, documentation.
- CLI: `skills <dir>`. Evidence: `tests/skills.test.ts`.

## Milestone 13: Benchmark

- Ten tasks under `benchmarks/pitcrew-core` cover simple bugs, multi-file features, architecture boundaries, authz, concurrency, visible-test blindspots, browser recovery, migrations, dependency direction and environment failures.
- Raw results are published in `benchmarks/pitcrew-core/results/`.
- The published result is fixture-validation mode with `contenders: []`; no model-backed comparison is claimed. See [benchmark-methodology.md](../benchmark-methodology.md).

## Milestone 14: Competition profile

- `profiles/g4/profile.json` maps one Codex route, Docker execution, bounded budgets, Arena policy and the OpenPitStop gate.
- Desktop, provider gateway failover and non-essential integrations are excluded.
- Evidence: `tests/profile.test.ts`.

## Milestone 15: Release hardening

- Documentation: [sandbox-security.md](../sandbox-security.md), [troubleshooting.md](../troubleshooting.md), [limitations.md](../limitations.md), [third-party-notices.md](../third-party-notices.md), [benchmark-methodology.md](../benchmark-methodology.md).
- `scripts/release-check.mjs` runs build, test, typecheck, lint and format checks, confirms the referee is installed and checks that benchmark raw results exist.
- OpenPitStop strict verification on the clean source commit reports OK, CLEAN integrity, TRUSTWORTHY honesty and 92/92 tests.
- Release gate evidence is tracked in [release-gate.md](release-gate.md).
