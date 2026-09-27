# Milestone 3: repository intelligence and evidence-backed memory

Existing P0 context is a bounded file-name-ranked source sample and root package
scripts. It has no structural graph or durable repository facts.

Implement a read-only Git inventory, Tree-sitter WASM parsing for JS/TS, Python,
Rust and Go, source-linked symbols/imports, inferred route candidates and
test-file relationships, manifest/CI/migration inventory, and content-based
fact invalidation. Parsing never executes repository code.

Persist graph artifacts and fact projections in a versioned SQLite migration.
Context selection consumes non-stale facts without widening write permissions.
Read-only project opening must work with dirty Git state; candidate creation
continues to require explicit handling of dirty work.

Tests use actual grammar binaries and real temporary Git repositories. Verify
line references, import edges, inference labels, parser errors, secret omission,
and manifest/auth/CI invalidation. No model calls are needed for inspection.
