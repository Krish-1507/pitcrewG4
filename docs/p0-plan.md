# Milestone 1 implementation plan and boundaries

Starting point: empty upstream repository; milestone 0 adds only tooling and specs.

The smallest vertical slice uses:

- protocol schemas; pure event reducer;
- deterministic policy; sanitized process runner;
- real Git candidate manager;
- mechanical source context;
- bounded Implementer;
- optional Codex and OpenAI-compatible proposal adapters;
- SQLite append-only events and SHA-256 artifacts;
- separate public OpenPitStop CLI adapter;
- daemon composition and CLI client.

Verification: real Git fixture, malicious paths/junctions, credential filtering,
bounded output, cancellation of descendants, approval classification, immutable
edit preimages, invalid state transitions, artifact tampering and authenticated
HTTP mutation schemas. Live acceptance separately invokes actual external tools.

Deliberate P0 limits: existing files only; no automatic apply/merge; dirty
repositories stop; high-risk edits block until milestone 2 approvals; state is
replayed after restart and interrupted work is NOT PROVEN, never auto-verified.
This is not a complete product or clean-machine release.
