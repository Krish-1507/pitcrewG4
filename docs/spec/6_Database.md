# PitCrew Database and Persistence

## 1. Persistence philosophy

PitCrew is local-first.

Default durable store is SQLite managed by the daemon.

SQLite stores structured state/indexes. Large/binary artifacts live on disk by content hash. Secrets live in OS credential storage, not SQLite.

---

## 2. Physical layout

User-level:

```text
~/.pitcrew/
  user.db
  runtime/
  providers/
  logs/
```

Project-level:

```text
<repo>/.pitcrew/
  pitcrew.db
  config.yaml
  artifacts/
    sha256/
  cache/
  browser/
```

Use platform-specific config locations where appropriate.

Project `.pitcrew/` is ignored by Git by default except optional shareable config explicitly chosen by user.

---

## 3. SQLite rules

Use WAL mode.

Daemon is sole normal writer.

Desktop/CLI never open DB directly.

Recommended ORM: Drizzle.

Migrations are versioned and append-only.

Before destructive migration create backup/checkpoint.

---

## 4. Core entities

```text
projects
missions
mission_events
mission_snapshots
agents
delegations
approvals
provider_profiles
model_profiles
usage_records
repo_facts
repo_fact_evidence
memory_entries
failure_records
candidate_branches
candidate_changes
tool_runs
verification_runs
verification_checks
findings
artifacts
certificates
skills
automations
browser_runs
```

---

## 5. Projects

```sql
projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  git_remote_hash TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  last_observed_head TEXT,
  config_hash TEXT
)
```

Remote URL may contain credentials. Store normalized hash when possible.

---

## 6. Missions

```sql
missions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  user_request TEXT NOT NULL,
  state TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  autonomy_mode TEXT NOT NULL,
  active_candidate_id TEXT,
  selected_candidate_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
)
```

---

## 7. Mission events

Append-only.

```sql
mission_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT
)
```

Index:

```sql
CREATE INDEX idx_mission_events_mission_sequence
ON mission_events(mission_id, sequence);
```

Corrections are new events, not updates.

---

## 8. Mission snapshots

Disposable acceleration cache.

```sql
mission_snapshots (
  mission_id TEXT PRIMARY KEY REFERENCES missions(id),
  through_sequence INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
)
```

If replay differs from snapshot, rebuild from events.

---

## 9. Agents/delegations

```sql
agents (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  model_profile_id TEXT,
  status TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

delegations (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  parent_agent_id TEXT,
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER
);
```

Do not create persistent agent-personality state by default.

---

## 10. Approvals

```sql
approvals (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at_ms INTEGER NOT NULL,
  resolved_at_ms INTEGER,
  resolver TEXT,
  constraints_json TEXT
);
```

Approval binds to action hash. Changed action invalidates approval.

---

## 11. Provider profiles

```sql
provider_profiles (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  base_url TEXT,
  secret_ref TEXT,
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
```

Example:

```text
keychain:pitcrew/provider/openrouter/default
```

No secret value in DB.

---

## 12. Model profiles

```sql
model_profiles (
  id TEXT PRIMARY KEY,
  provider_profile_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  profile_kind TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  context_limit INTEGER,
  input_cost_hint REAL,
  output_cost_hint REAL,
  enabled INTEGER NOT NULL,
  last_discovered_at_ms INTEGER
);
```

Cost is a hint unless provider reports it.

---

## 13. Usage

```sql
usage_records (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  delegation_id TEXT,
  provider_profile_id TEXT,
  model_id TEXT,
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  provider_cost_usd REAL,
  wall_time_ms INTEGER,
  status TEXT NOT NULL
);
```

Unknown remains NULL.

---

## 14. Repository facts

```sql
repo_facts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_json TEXT NOT NULL,
  fact_kind TEXT NOT NULL,
  confidence TEXT NOT NULL,
  observed_head TEXT,
  observed_at_ms INTEGER NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0
);
```

`fact_kind`:

```text
observed
inferred
user_declared
```

---

## 15. Fact evidence/invalidation

```sql
repo_fact_evidence (
  fact_id TEXT NOT NULL REFERENCES repo_facts(id),
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  evidence_kind TEXT NOT NULL,
  PRIMARY KEY(fact_id, artifact_id)
);
```

Optional normalized rules:

```sql
fact_invalidation_rules (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL
);
```

---

## 16. Memory

```sql
memory_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_head TEXT,
  invalidation_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  last_verified_at_ms INTEGER,
  stale INTEGER NOT NULL DEFAULT 0
);
```

Never store secrets.

---

## 17. Failure records

```sql
failure_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  mission_id TEXT,
  signature TEXT NOT NULL,
  command_hash TEXT,
  failure_class TEXT NOT NULL,
  normalized_summary TEXT NOT NULL,
  cause TEXT,
  attempted_fix TEXT,
  outcome TEXT,
  candidate_id TEXT,
  artifact_id TEXT,
  created_at_ms INTEGER NOT NULL
);
```

Search by signature before retrying known failed strategy.

---

## 18. Candidate branches

```sql
candidate_branches (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  baseline_commit TEXT,
  worktree_path TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  status TEXT NOT NULL,
  candidate_digest TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  eliminated_reason TEXT
);
```

Worktree path is local state only; identity cannot rely on path alone.

---

## 19. Candidate changes

```sql
candidate_changes (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  git_head TEXT,
  clean INTEGER NOT NULL,
  changed_paths_json TEXT NOT NULL,
  diff_artifact_id TEXT,
  created_at_ms INTEGER NOT NULL
);
```

Verification points to a specific candidate change.

---

## 20. Tool runs

```sql
tool_runs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  candidate_change_id TEXT,
  tool_name TEXT NOT NULL,
  argv_json TEXT,
  cwd_rel TEXT,
  policy_decision_id TEXT,
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  exit_code INTEGER,
  status TEXT NOT NULL,
  stdout_artifact_id TEXT,
  stderr_artifact_id TEXT
);
```

---

## 21. Verification runs/checks

```sql
verification_runs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  candidate_change_id TEXT NOT NULL,
  verification_type TEXT NOT NULL,
  verdict TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  evidence_artifact_id TEXT,
  openpitstop_ref TEXT
);
```

```sql
verification_checks (
  id TEXT PRIMARY KEY,
  verification_run_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  check_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  failure_class TEXT,
  output_artifact_id TEXT
);
```

Mismatched candidate identity cannot authorize final candidate.

---

## 22. Findings

```sql
findings (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  candidate_change_id TEXT,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_artifact_id TEXT,
  created_at_ms INTEGER NOT NULL,
  resolved_at_ms INTEGER
);
```

Distinguish no findings from tool failure.

---

## 23. Artifacts

```sql
artifacts (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  sensitivity TEXT NOT NULL,
  retention_class TEXT NOT NULL
);
```

Body path:

```text
.pitcrew/artifacts/sha256/<prefix>/<hash>
```

Use temp write + atomic rename.

---

## 24. Browser runs

```sql
browser_runs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  candidate_change_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  browser_name TEXT NOT NULL,
  viewport_json TEXT NOT NULL,
  verdict TEXT NOT NULL,
  trace_artifact_id TEXT,
  screenshot_manifest_artifact_id TEXT,
  network_artifact_id TEXT,
  console_artifact_id TEXT,
  created_at_ms INTEGER NOT NULL
);
```

---

## 25. Certificates

```sql
certificates (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  candidate_change_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  evidence_manifest_artifact_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);
```

This is an evidence manifest, not legal/security certification.

---

## 26. Skills/automations

```sql
skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT,
  manifest_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL
);

automations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  workflow_json TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL
);
```

Automation is P2 and can be deferred.

---

## 27. Retention

Defaults:

- mission events: retain;
- final evidence: retain;
- large raw model responses: short retention unless diagnostics enabled;
- temporary worktrees: delete after mission unless pinned;
- browser video: configurable;
- provider request bodies: not persisted by default;
- cache: disposable.

Commands:

```text
pitcrew clean --cache
pitcrew clean --temporary
pitcrew export <mission>
pitcrew delete <mission>
```

---

## 28. Backup/export

Export bundle:

```text
mission.json
events.jsonl
certificate.json
evidence-manifest.json
artifacts/...
```

Secrets never exported.

Use SQLite online backup/consistent checkpoint for DB backup.

---

## 29. Integrity

Artifacts use SHA-256 content addressing.

Mission events may optionally include chain hashes.

Do not call plain digest a digital signature.

Future trusted CI/team mode can add signed attestations.

---

## 30. Privacy/audit

Classify context before provider send:

```text
normal
sensitive-code
credential-like
personal-data
restricted
```

Credential-like data is redacted/blocked by default.

System should be able to answer:

- what source/context class was sent;
- to which provider;
- when;
- for which mission;
- under which provider config.

MVP can store metadata only, not full prompts.
