# Milestone 6: candidate identity and Arena

Scope: extend the existing single-candidate flow with an adaptive Arena that
creates independent candidates only when branch triggers justify the cost,
then eliminates and selects on normalized evidence. No parallel model
execution is added; live missions continue on one bounded candidate while the
Arena policy, patch replay, weakening detection, normalization and selection
are deterministic, tested, and demonstrated on a real race fixture.

Candidate identity is the content fingerprint captured before and after every
verification. Verification records bind to that exact digest; a mismatched or
missing check never normalizes into a pass. Saved patches replay onto a fresh
baseline worktree to an identical Git tree, so every candidate branch is
independently replayable.

Branch triggers: weak proof, uncertain hypothesis, repeated failure,
high-risk policy, material architecture fork. Diversity comes from
independently justified hypotheses, enforced by key and text-overlap checks,
not cosmetic restatements.

Elimination is evidence-first with one plain sentence: a candidate that
modifies its own verification is eliminated for weakening tests; one that
passes visible tests but fails the concurrency reproduction is eliminated for
the race; regressions and acceptance failures eliminate the same way. Only a
survivor with an exact-digest OpenPitStop VERIFIED verdict can be selected,
through SELECTING and FINAL_GATE. No path leads from IMPLEMENTING to
VERIFIED, and terminal history stays append-only: selection is recorded
before the terminal referee verdict.

Hero fixture `fixtures/checkout-race`: concurrent same-key checkouts
duplicate orders. Candidate A (in-process mutex) passes visible tests but
fails the multi-process reproduction and is eliminated. Candidate B keeps
baseline behavior, weakens its own test, and is eliminated for test
weakening. Candidate C (atomic filesystem lock with re-check) survives
normalization and strict OpenPitStop returns VERIFIED for the configured
stack, architecture and baseline layers. Baseline stays untouched.

Acceptance: deterministic unit coverage for triggers, hypotheses, weakening
markers, normalization, stale-digest rejection and selection; real Git
patch-save/replay tree equality; the full hero run with real test commands
and a real strict gate; 73 tests, build, typecheck, lint and formatting pass.
Live multi-model A/B execution remains future work and is stated as such.
