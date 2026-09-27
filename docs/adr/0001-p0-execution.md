# ADR 0001: P0 execution and provider trust boundaries

The user authorized the installed Codex CLI session, OpenPitStop >=1.10.0,
and reduced isolation for ordinary fixture build/test execution.
Reduced isolation is explicit configuration, never automatic fallback.

Codex returns structured edits in read-only mode. PitCrew applies them through
policy-checked Implementer tools. Authentication storage is never read.
Codex is optional; OpenAI-compatible providers use the same proposal contract.

The real CLI contract, not a guessed schema, defines the OpenPitStop adapter.
Only its strict gate supplies the final independent verdict.

Node SQLite uses the experimental flag where Node 22 requires it, avoiding
native database build dependencies. Migrations remain versioned SQL.
