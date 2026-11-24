# Troubleshooting

## `Node.js v22.12` or an engine error during install

PitCrew requires Node 22.13.0 or newer because pnpm 11.19.0 requires it. Install a current Node 22 LTS and rerun `pnpm install`.

## `pitcrew` is not a recognized command

PitCrew is not published as a global binary. Use the workspace script from the checkout:

```sh
pnpm pitcrew --config .pitcrew/config.json --state .pitcrew --repo . doctor
```

`pnpm onboard` and `pnpm pitcrew` read built `dist` output, so run `pnpm build` after installing or changing package source. If `.pitcrew/config.json` does not exist, run `pnpm onboard --repo .` first.

## Windows: `pipeline`/worktree cleanup warnings

Git worktree removal can briefly fail while a test process releases file handles. PitCrew retries removal, prunes the worktree list and rejects the command if a candidate remains registered. Rerun the command after the process has exited; do not delete `.git` internals by hand.

## Daemon refuses requests

The daemon binds to `127.0.0.1` and requires the bearer token printed at startup. Mission Control receives the token through the URL fragment from `pnpm pitcrew ... ui`. Browser requests from another origin are rejected; do not paste the token into a third-party page. Open the full printed URL including `#token=...`; a bare `http://127.0.0.1:<port>/` loads static assets but API calls need the token.

`pnpm pitcrew ... ui` keeps running until you press `Ctrl+C` or the daemon exits. If the command returns immediately, check the printed error (for example a state directory lock held by another daemon) and that OpenPitStop and the model executable exist.

## Browser QA cannot find a browser

Install Chrome or Edge, or set `PITCREW_BROWSER_EXECUTABLE` to the executable path. Targets must be loopback unless `PITCREW_BROWSER_ALLOW_HOSTS` authorizes the host.

## OpenPitStop is missing

A mission without OpenPitStop ends as NOT_PROVEN. Install the configured referee executable and rerun verification. Do not relabel an earlier verdict as current.

## Docker is unavailable

The default execution policy does not fall back to host execution. Either install Docker or explicitly authorize reduced isolation for a development-only run.

## Tests pass locally but fail in CI

CI checks out with LF line endings and runs `pnpm format:check`. Run `pnpm format` before pushing. Windows-specific failures should be reproduced with the same Node and pnpm versions CI uses.
