# Limitations

PitCrew is an early development build. The following limitations are current facts, not roadmap aspirations.

## Verification

- OpenPitStop is the only source of an independently verified verdict. When it is unavailable, the outcome is NOT_PROVEN.
- A merge certificate is informational. It does not push, merge or deploy anything.
- Rerunning verification produces new evidence. Old evidence is never relabeled as current.

## Models and benchmarks

- No model-backed contender was executed for the published benchmark results in this repository. Those results validate fixtures and harness behavior only.
- Provider comparisons require a configured provider and the same task fixtures, commands and evidence capture. Nothing in this repository claims a model ranking without that run.

## Browser lab

- Browser QA uses a locally installed Chrome or Edge through `playwright-core`. It does not download a browser.
- Observe mode needs a desktop session. Headless mode is the default for automation.
- Targets are restricted to loopback unless explicitly authorized.

## Platforms

- CI covers Windows and Linux. A clean macOS installation has not been verified in this repository.
- Native desktop packaging is not shipped. Mission Control is a local web interface served by the daemon.

## Scope

- Production push, merge and deploy are outside the automatic path.
- MCP integrations are not implemented. Skills request permissions; they never grant them.
- The benchmark harness has no live model contenders configured in this environment.
