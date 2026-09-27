# Milestone 2: mission controls and approvals

Existing implementation: P0 already owns a reducer, append-only SQLite event
store, host process-tree cancellation, single-writer state-directory lock,
per-project active mission lock, and bounded call/time budgets.

Add only:

1. User control events for pause request, actual checkpoint pause, and resume.
2. Immutable proposal approval requests and resolutions in the event journal.
3. Approval binding to candidate identity, proposal contents and action hash.
4. Recheck identity and file preimages before applying approved actions.
5. Authenticated approval/pause/resume routes and terminal input.
6. Freshness projection: retained historical verdicts never masquerade as current.

Acceptance tests cover rejection, exact approval, altered action, reused approval,
cancelled waits, secret-deny precedence, bounded source scope and replay.

Pausing waits for the current bounded operation to finish; it does not claim an
active process has stopped. Wall-clock budgets continue during user waits.
Headless requests never auto-approve: they reject a pending material action.
Interrupted missions retain their history/candidate and recover as NOT PROVEN.
