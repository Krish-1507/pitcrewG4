# Limitations

PitCrew is an early development build. The following limitations are current facts, not roadmap aspirations.

## Verification

- OpenPitStop is the only source of an independently verified verdict. When it is unavailable, the outcome is NOT_PROVEN.
- A merge certificate is informational. It does not push, merge or deploy anything.
- Rerunning verification produces new evidence. Old evidence is never relabeled as current.

## Test coverage

- The deterministic suite is 105 tests in 19 files. It does not cover every module directly; the per-module map is [modules.md](modules.md).
- `orchestrator` full-mission behaviour is exercised by the live acceptance script, not CI.
- `apps/cli` and `apps/desktop` have acceptance and manual coverage; the desktop UI has no automated browser interaction test, and the interactive CLI session and Electron shell have manual acceptance only.
- A live mission requires an installed, authenticated model provider.

## Local assistant features

- Quick Assistant output is a draft from the configured model. It is never `VERIFIED` and is not independent evidence.
- Quick Assistant does not persist answers. Clipboard auto-read depends on browser permission; manual paste is always available.
- The Windows installer registers `Ctrl+Alt+P` through a Start Menu shortcut. Linux users must bind `pitcrew-quick` manually. macOS hotkey behavior is unproven.
- Web research runs through a built-in keyless DuckDuckGo searcher by default. It is free and needs no configuration, but it is a public page, not a contracted API: heavy automated use can be rate-limited or blocked, and the HTML shape can change without notice. Set `PITCREW_SEARXNG_URL` or `PITCREW_BRAVE_SEARCH_API_KEY` for a provider with an SLA.
- Automatic research is bounded: one decision call, then at most one search round per Quick Assistant request. It is not an open-ended browsing loop. Search results are untrusted context.
- Memory notes and assistant prompts are local SQLite records. There are no embeddings, semantic search, sync, or automatic summarization.
- Quick Assistant accepts global assistants only. Project assistants are restricted to their project.
- Assistant route and model overrides can fail if the selected route is no longer eligible. A configured routing profile needs a route with the `quick-assistant` role for Quick Assistant.
- The assistant-feature, provider-preset and packaging changes are included in the strict verification of commit `ea4ab55` (CLEAN, TRUSTWORTHY 100/100). The NSIS single-file installer and the interactive session's live TTY behaviour remain NOT_PROVEN; the portable desktop build is verified end to end.
- The Electron binary extraction can fail on Node builds where the `extract-zip` read stream stalls (observed on Node 26): `electron/install.js` exits 0 while writing only `dist/locales/`. The downloaded zip is intact and checksum-verified; `pnpm run preflight:electron` in `apps/desktop` auto-repairs from the cached zip with the platform archive tool. NSIS installer generation additionally requires executing the freshly built installer stub (electron-builder's uninstaller-stub step), which sandboxed shells may refuse — run it in a normal terminal.

## Models and benchmarks

- No model-backed contender was executed for the published benchmark results in this repository. Those results validate fixtures and harness behavior only.
- Provider comparisons require a configured provider and the same task fixtures, commands and evidence capture. Nothing in this repository claims a model ranking without that run.

## Browser lab

- Browser QA uses a locally installed Chrome or Edge through `playwright-core`. It does not download a browser.
- Observe mode needs a desktop session. Headless mode is the default for automation.
- Targets are restricted to loopback unless explicitly authorized.

## Platforms

- CI covers Windows and Linux. A clean macOS installation has not been verified in this repository.
- The desktop app is Windows-first and unsigned: expect SmartScreen/Gatekeeper warnings until code signing is added. The portable `win-unpacked` build is verified end-to-end (packaged binary boots the packaged daemon, authenticated API responds); the NSIS single-file installer path is documented but was not produced in the sandboxed environment, and Linux/macOS packaging and tray icon assets are `NOT_PROVEN`.

## Scope

- Production push, merge and deploy are outside the automatic path.
- MCP integrations are not implemented. Skills request permissions; they never grant them.
- The benchmark harness has no live model contenders configured in this environment.
