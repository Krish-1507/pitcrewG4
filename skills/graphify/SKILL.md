# Graphify

Use this skill when a task needs to understand how a codebase connects:
call paths, cross-package relationships, blast radius of a change, or
"what calls this" questions that file-by-file reading answers badly.

Adapted for PitCrew from Graphify (Graphify-Labs/graphify, Apache-2.0), a
local deterministic tree-sitter knowledge-graph CLI with no vector store.

## Workflow

1. Check availability: `graphify --version` (installed from PyPI as
   `graphifyy`). If unavailable, fall back to repo-intelligence facts and
   say the graph path is unavailable — do not pretend it ran.
2. Build the map read-only against the repository or candidate:
   `graphify build <root>` produces `graph.json`, `graph.html` and
   `GRAPH_REPORT.md` in the target's output directory. Nothing leaves the
   machine; the structural pass calls no model.
3. Query the graph instead of grepping: what calls a function, how two
   modules connect, what a change could break.
4. Distinguish edge provenance when reporting: `EXTRACTED` edges are read
   directly from source; `INFERRED` edges are graphify's resolution;
   `AMBIGUOUS` edges could not bind to exactly one definition. Never
   present an INFERRED edge as a fact.

## Constraints

- Structural analysis is read-only; it never edits the candidate.
- Graph output belongs to the candidate's artifact area, not the baseline.
- A graph edge is evidence of connection, not proof of correctness —
  verification still comes only from real tests and the referee.
