# Database safety

Use this skill when a request touches SQLite schema, migrations, evidence persistence, or artifact identity.

## Workflow

1. Read the migration path and the current schema before editing.
2. Take a backup or work against a disposable state directory.
3. Make migrations additive and idempotent where the platform allows.
4. Keep mission events append-only; never rewrite recorded evidence.
5. Verify an upgrade from a populated old database, not only an empty one.
6. Test restart, rollback and interrupted-write behavior.

## Constraints

- SQLite is not a secret store. Use the operating system keychain and secret references.
- Large logs and traces belong in the artifact store, not in rows.
- Do not edit `.git` internals or existing migration files that already shipped.
