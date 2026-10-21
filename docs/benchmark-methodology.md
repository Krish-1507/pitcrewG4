# Benchmark methodology

`benchmarks/pitcrew-core` defines ten tasks covering simple bugs, multi-file features, architecture boundaries, authz, concurrency, visible-test blindspots, browser recovery, migrations, dependency direction and environment failures.

## Fixture validation mode

`run.mjs` runs each task's acceptance command in the task's fixture directory with:

- an argv command and no shell;
- an explicit working directory;
- a 180-second timeout;
- capped stdout/stderr capture;
- an expected baseline exit code.

A row matches when the observed exit code equals the baseline expectation. This proves the scenario reproduces the intended starting condition. It does not prove that any agent can solve it.

## Contenders

The planned contenders are a strong single-path coding agent, PitCrew single-path, and PitCrew with the adaptive Arena plus OpenPitStop. They require a configured model provider and must run through the same gateway, fixtures, acceptance commands and evidence capture.

No contender run is included in the current raw results. The result file records `contenders: []` and the limitation in plain text. Any comparison without that run is NOT_PROVEN.

## Metrics

When contender runs exist, record: task success, false-done claims, regressions, security escapes, model calls, wall time and human approvals. Keep raw output next to the derived summary.

## Reproducing

```bash
node benchmarks/pitcrew-core/run.mjs
node benchmarks/pitcrew-core/run.mjs --only browser-recovery
```

Browser recovery needs Chrome or Edge. Results are written to `benchmarks/pitcrew-core/results/`.
