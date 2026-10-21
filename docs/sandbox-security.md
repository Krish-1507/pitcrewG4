# Sandbox and process security

PitCrew treats every repository, model response and browser target as untrusted.

## Process execution

- Commands use an executable plus an argv array. No shell interpolation is used.
- Every process has an explicit working directory, timeout, environment policy, stdout/stderr capture limit and cancellation path.
- Cancellation terminates the process tree, not only the direct child.
- Output above the capture limit is truncated and the result is marked as such.
- A missing isolation backend does not silently fall back. Reduced isolation requires explicit configuration.

## Sandbox

Execution defaults to Docker when available. `execution.allowReducedIsolation` is false in the shipped configuration and in the competition profile. When Docker is unavailable and reduced isolation is not authorized, the mission fails as an environment failure rather than running arbitrary repository commands on the host.

## Filesystem

- Candidate edits happen in a Git worktree, never in the baseline.
- Paths are resolved and checked against the intended root; junction and symlink escapes are rejected.
- Generated artifacts live under the state directory (`.pitcrew/` by default), not in the repository.
- `.git` internals are not edited directly.

## Browser

- Browser QA only accepts `http` or `https` targets.
- Targets must be loopback unless `PITCREW_BROWSER_ALLOW_HOSTS` explicitly authorizes a host.
- Only PitCrew-managed browser contexts are used.
- Scenarios cannot submit real credentials or personal data.

## Secrets

- Secret values are stored through the operating system keychain and referenced by `secret_ref`.
- Secrets are never written to SQLite, logs, prompts or evidence artifacts.
- Child processes start from a scrubbed environment unless a configured provider requires an explicit key.

## Reporting

Infrastructure failure, policy denial, approval denial and behavioral failure are distinct outcomes. A failure in the referee or the sandbox produces BLOCKED or NOT_PROVEN, never VERIFIED.
