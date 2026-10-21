# Performance

Use this skill when a request claims a speed or resource improvement.

## Workflow

1. Define the workload and the metric before changing code.
2. Record a baseline with repeated runs and report variance.
3. Change one variable at a time.
4. Re-run the same workload and compare distributions, not a single sample.
5. Check the change does not move work into an unmeasured path or weaken correctness.
6. Store raw measurements as evidence.

## Constraints

- Do not claim an improvement from a noisy single run.
- Do not trade correctness, security or cancellation behavior for speed.
- Bound every process with a timeout and output limit.
