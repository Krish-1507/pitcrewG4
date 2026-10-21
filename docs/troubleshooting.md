# Troubleshooting

## `Node.js v22.12` or an engine error during install

PitCrew requires Node 22.13.0 or newer because pnpm 11.19.0 requires it. Install a current Node 22 LTS and rerun `pnpm install`.

## Windows: `pipeline`/worktree cleanup warnings

Git worktree removal can briefly fail while a test process releases file handles. PitCrew retries removal, prunes the worktree list and rejects the command if a candidate remains registered. Rerun the command after the process has exited; do not delete `.git` internals by hand.

## Daemon refuses requests

The daemon binds to `127.0.0.1` and requires the bearer token printed at startup. Mission Control receives the token through the URL fragment from `pitcrew ui`. Browser requests from another origin are rejected; do not paste the token into a third-party page.

## Browser QA cannot find a browser

Install Chrome or Edge, or set `PITCREW_BROWSER_EXECUTABLE` to the executable path. Targets must be loopback unless `PITCREW_BROWSER_ALLOW_HOSTS` authorizes the host.

## OpenPitStop is missing

A mission without OpenPitStop ends as NOT_PROVEN. Install the configured referee executable and rerun verification. Do not relabel an earlier verdict as current.

## Docker is unavailable

The default execution policy does not fall back to host execution. Either install Docker or explicitly authorize reduced isolation for a development-only run.

## Tests pass locally but fail in CI

CI checks out with LF line endings and runs `pnpm format:check`. Run `pnpm format` before pushing. Windows-specific failures should be reproduced with the same Node and pnpm versions CI uses.
