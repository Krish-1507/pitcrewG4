# Debugging

Use this skill when a mission reports a failing check, an intermittent defect, or a non-progress loop.

## Workflow

1. Capture the exact command, stdout, stderr and exit code.
2. Build a minimal reproduction against the known-bad baseline.
3. Confirm the reproduction fails for the stated reason, not for an environment error.
4. Reduce the input until one assumption is isolated.
5. Change code only after the reproduction is stable, then rerun the same reproduction.
6. Keep the reproduction as a regression test when practical.

## Constraints

- Do not call a model for facts available from local commands.
- Distinguish infrastructure failure from behavioral failure and report the classification.
- Never weaken or skip a test to make a failure disappear.
