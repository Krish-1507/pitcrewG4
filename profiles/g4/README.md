# PitCrew-G4 competition profile

This profile maps the competition path onto the same mission runtime used by development: context collection, candidate identity, bounded budgets, optional Arena branching and the independent OpenPitStop gate.

```bash
pitcrew --config profiles/g4/profile.json --repo . --state .pitcrew "<mission>"
```

## Included

- One Codex-backed implementer/debugger route with an explicit context limit.
- Docker execution by default; reduced isolation is not enabled.
- A nine-minute wall-clock budget and six model calls per mission.
- OpenPitStop with stack, architecture and baseline layers.
- Arena branching remains available but is triggered by the configured policy, not by this file.

## Excluded

- Desktop Mission Control.
- Provider gateway failover and additional provider routes.
- Non-essential integrations and model profiles.

## Requirements

The executable paths resolve from `PATH`. No secret value belongs in this profile. A missing `codex` or `openpitstop` executable blocks the mission or returns NOT_PROVEN; it never falls back to a weaker verification standard.
