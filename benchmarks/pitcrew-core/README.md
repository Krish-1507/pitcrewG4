# PitCrew Core benchmark

`pitcrew-core` defines ten tasks across the failure classes PitCrew claims to handle: simple bugs, multi-file features, architecture boundaries, authz, concurrency, visible-test blindspots, browser recovery, migrations, dependency direction and environment failures.

## What this harness measures today

`run.mjs` executes each task's acceptance command against its fixture and compares the exit code with the recorded baseline. The published raw result validates that:

- every scenario reproduces its intended baseline condition;
- the harness runs each command with an explicit working directory, no shell interpolation and a bounded timeout;
- the raw evidence for the run is stored under `results/`.

It does **not** measure model-backed contender success. No contender was executed here because the deterministic environment has no model provider configured. The result file records `contenders: []` and should not be read as a comparison of a strong single-path agent, PitCrew single-path and PitCrew with Arena plus OpenPitStop.

## Run

```bash
node benchmarks/pitcrew-core/run.mjs
node benchmarks/pitcrew-core/run.mjs --only migration-upgrade
```

Results are written to `benchmarks/pitcrew-core/results/run-<timestamp>.json`. Override the path with `--out`. Each record includes the source commit and a `dirty` flag; a published result generated from an uncommitted tree states that explicitly rather than implying the commit contains it.

## Adding a contender

A model-backed contender must be run only through the configured model gateway, with the same task fixtures, acceptance commands, timeouts and evidence capture. The resulting record should keep raw stdout/stderr and must state which verification layer produced each verdict. Until that exists, comparisons are NOT_PROVEN.
