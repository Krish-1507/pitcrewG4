# Limitations

PitCrew is an early development build. The following limitations are current facts, not roadmap aspirations.

## Verification

- OpenPitStop is the only source of an independently verified verdict. When it is unavailable, the outcome is NOT_PROVEN.
- A merge certificate is informational. It does not push, merge or deploy anything.
- Rerunning verification produces new evidence. Old evidence is never relabeled as current.

## Test coverage

- The deterministic suite is 98 tests in 17 files. It does not cover every module directly; the per-module map is [modules.md](modules.md).
- `orchestrator` full-mission behaviour is exercised by the live acceptance script, not CI.
- `apps/cli` and `apps/desktop` have acceptance and manual coverage; the desktop UI has no automated browser interaction test.
- A live mission requires an installed, authenticated model provider.

## Local assistant features

- Quick Assistant output is a draft from the configured model. It is never `VERIFIED` and is not independent evidence.
- Quick Assistant does not persist answers. Clipboard auto-read depends on browser permission; manual paste is always available.
- The Windows installer registers `Ctrl+Alt+P` through a Start Menu shortcut. Linux users must bind `pitcrew-quick` manually. macOS hotkey behavior is unproven.
- Web research is disabled by default. It requires `PITCREW_SEARXNG_URL` or `PITCREW_BRAVE_SEARCH_API_KEY`; with neither set, no search request is made.
- Web research is an explicit endpoint and Quick Assistant option, not an autonomous model tool loop. Search results are untrusted context.
- Memory notes and assistant prompts are local SQLite records. There are no embeddings, semantic search, sync, or automatic summarization.
- Quick Assistant accepts global assistants only. Project assistants are restricted to their project.
- Assistant route and model overrides can fail if the selected route is no longer eligible. A configured routing profile needs a route with the `quick-assistant` role for Quick Assistant.
- The current assistant-feature changes have deterministic coverage but no new OpenPitStop verdict. The recorded OpenPitStop evidence is for `1c21762`.

## Models and benchmarks

- No model-backed contender was executed for the published benchmark results in this repository. Those results validate fixtures and harness behavior only.
- Provider comparisons require a configured provider and the same task fixtures, commands and evidence capture. Nothing in this repository claims a model ranking without that run.

## Browser lab

- Browser QA uses a locally installed Chrome or Edge through `playwright-core`. It does not download a browser.
- Observe mode needs a desktop session. Headless mode is the default for automation.
- Targets are restricted to loopback unless explicitly authorized.

## Platforms

- CI covers Windows and Linux. A clean macOS installation has not been verified in this repository.
- Native desktop packaging is not shipped. Mission Control is a local web interface served by the daemon and is verified by static assertions plus a manual smoke run, not an automated interaction test.

## Scope

- Production push, merge and deploy are outside the automatic path.
- MCP integrations are not implemented. Skills request permissions; they never grant them.
- The benchmark harness has no live model contenders configured in this environment.
