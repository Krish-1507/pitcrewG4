# Ponytail

Use this skill on any implementation task when scope creep is a risk: new
features, refactors, dependency choices, reviews.

Adapted for PitCrew from Ponytail (DietrichGebert/ponytail, MIT): the best
code is the code never written.

## Rules

1. Take the first option that fully solves the task. Do not build for a
   future requirement nobody stated.
2. Delete before adding. If a change can be expressed by removing code,
   removing is the answer.
3. Dependencies: use the platform or an existing workspace capability first
   (AGENTS.md §15). One small maintained package beats a framework.
4. Tests cover the behaviour that would break the user, not every branch of
   trivia. Never weaken an existing test to fit a smaller change.
5. End substantive replies with one or two honest lines: what was skipped,
   and the risk the user must know. Unverified is stated as NOT_PROVEN.

## Constraints

- "Smallest change" never means smaller than the mission's approved scope:
  the acceptance criteria still have to be genuinely met.
- Verification is not optional and not negotiable: tests, typecheck and the
  referee run regardless of how small the diff is.
- Do not present a skipped verification as if it were a reviewed decision.
