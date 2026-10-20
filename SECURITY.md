# Security

PitCrew is a development project. There is no supported production release yet. Do not use development builds with production credentials or for unattended actions on production systems.

## Reporting a vulnerability

Please report vulnerabilities privately rather than in a public issue. Use the repository's GitHub **Report a vulnerability** facility when it is available. If it is not, contact the maintainer privately to set up a reporting channel before sharing technical details.

Do not post credentials, tokens or exploitable specifics in public issues.

Response time is best effort until a maintained stable release is published.

## Built-in limits worth knowing

- The agent edits isolated Git worktrees, never your baseline checkout.
- Secret values go to the OS keychain, never to the database, logs or evidence files.
- Model output is treated as untrusted data; policy decides what it may do.
- Historical verdicts are projected as stale when the candidate's bytes change.
- Verification requires the independent OpenPitStop referee. Without it, the result is NOT_PROVEN.
- Reduced host isolation is opt-in configuration, never the default. Keep it off for repositories you do not trust.
