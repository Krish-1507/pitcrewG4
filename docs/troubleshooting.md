# Troubleshooting

## `Node.js v22.12` or an engine error during install

PitCrew requires Node 22.13.0 or newer because pnpm 11.19.0 requires it. Install a current Node 22 LTS and rerun `pnpm install`.

## `pitcrew` is not a recognized command

Run the source installer (`.\install.ps1` or `./install.sh`) and open a new terminal so the user `PATH` changes apply. The installer places the CLI and launcher under `%USERPROFILE%\PitCrew` or `$HOME/PitCrew`.

If you are working inside the checkout without the installer:

```sh
pnpm build
pnpm pitcrew doctor
```

`pnpm pitcrew` reads built `dist` output, so rebuild after changing source. With the installed CLI, the first command auto-creates setup or runs `pitcrew setup`.

## Wrong config or state

Config defaults to `~/.pitcrew/config.json`; mission state defaults to `~/.pitcrew/state`. Set `PITCREW_HOME` to move both, or pass `--config` and `--state` explicitly:

```sh
pitcrew --config .pitcrew/config.json --state .pitcrew --repo . doctor
```

`pitcrew setup --force` replaces the default config after confirmation. It never writes a raw API key.

## Windows: `pipeline`/worktree cleanup warnings

Git worktree removal can briefly fail while a test process releases file handles. PitCrew retries removal, prunes the worktree list and rejects the command if a candidate remains registered. Rerun the command after the process has exited; do not delete `.git` internals by hand.

## Daemon refuses requests

The daemon binds to `127.0.0.1` and requires the bearer token printed at startup. Mission Control receives the token through the URL fragment from `pitcrew app` or `pitcrew ui`. Browser requests from another origin are rejected; do not paste the token into a third-party page. Open the full printed URL including `#token=...`; a bare `http://127.0.0.1:<port>/` loads static assets but API calls need the token.

`pitcrew app` and `pitcrew ui` keep running until you press `Ctrl+C` or the daemon exits. If the command returns immediately, check the printed error (for example a state directory lock held by another daemon) and that OpenPitStop and the model executable exist.

## Quick Assistant does not open or the hotkey is missing

Run `pitcrew app --quick` or `pitcrew quick` directly. The Windows installer creates a **PitCrew Quick Assistant** Start Menu shortcut with `Ctrl+Alt+P`; if another application owns that shortcut, create a new shortcut to `pitcrew-quick.cmd` and assign a different key. On Linux, bind `$HOME/PitCrew/bin/pitcrew-quick` in your desktop environment. macOS hotkey behavior is not verified.

Clipboard auto-read requires browser permission. If the page reports permission unavailable, paste the text manually; the rest of the Quick Assistant still works.

## Quick Assistant rejects my project assistant

Quick Assistant accepts global assistants only. Create the assistant with global scope, or use the project assistant from a mission in that project.

## Web research is unavailable or rate-limited

The built-in keyless DuckDuckGo searcher needs no configuration and runs only when research is used. It is a public page, not a contracted API: heavy automated use can be rate-limited or blocked (HTTP 429), and the HTML shape can change without notice. For reliability-critical work, set `PITCREW_SEARXNG_URL` or `PITCREW_BRAVE_SEARCH_API_KEY`. `pitcrew doctor` and `GET /v1/research` report the active provider. SearXNG must use HTTPS or HTTP on loopback, with no embedded credentials. Brave uses the fixed `api.search.brave.com` endpoint. Only the normalized query leaves the machine.

## A memory note or assistant prompt is rejected

PitCrew rejects text containing a configured provider or search secret. Remove the secret and reference the credential by environment variable or keychain instead. Memory notes are limited to 4000 characters and assistant prompts to 8000.

## Browser QA cannot find a browser

Install Chrome or Edge, or set `PITCREW_BROWSER_EXECUTABLE` to the executable path. Targets must be loopback unless `PITCREW_BROWSER_ALLOW_HOSTS` authorizes the host.

## OpenPitStop is missing

A mission without OpenPitStop ends as NOT_PROVEN. Install the configured referee executable and rerun verification. Do not relabel an earlier verdict as current.

## Docker is unavailable

The default execution policy does not fall back to host execution. Either install Docker or explicitly authorize reduced isolation for a development-only run.

## Tests pass locally but fail in CI

CI checks out with LF line endings and runs `pnpm format:check`. Run `pnpm format` before pushing. Windows-specific failures should be reproduced with the same Node and pnpm versions CI uses.

## Electron installed but incomplete during development

Symptom: `node_modules/electron/dist` holds only `locales/` and `path.txt`/`dist/version` are missing, although `pnpm install` exits cleanly. Root cause: on some Node builds (observed on Node 26) the `extract-zip` read stream that `electron/install.js` uses stalls, so the extraction never settles and Node exits with the partial tree. The cached zip itself is intact.

Repair automatically:

```sh
pnpm --dir apps/desktop run preflight:electron
```

This verifies the cached zip's SHA-256 against the package's own `checksums.json` and expands it with the platform archive tool (`Expand-Archive` on Windows). No network access is needed when the zip is already cached.

## Desktop app cannot find the daemon runtime

The packaged desktop app carries its own runtime under `resources/pitcrew` (daemon bundle, Mission Control assets, referee dependency). If it was launched without that runtime — for example a plain `electron .` in development — it looks for the CLI install: install Node.js 22.13+, run the PitCrew installer (or `npm install -g @pitcrew/cli`), and run `pitcrew setup` once so `~/.pitcrew/config.json` exists. Set `PITCREW_DAEMON` or `PITCREW_INSTALL_ROOT` if the CLI was installed somewhere non-default.
