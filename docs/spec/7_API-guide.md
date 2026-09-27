# PitCrew API Guide

## 1. Philosophy

PitCrew has multiple clients:

- Desktop;
- CLI;
- future editor extensions;
- headless CI.

All talk to the local daemon.

Clients never directly call model providers, Docker, Git worktrees, OpenPitStop, or project DB.

---

## 2. Transport

MVP:

```text
HTTP on 127.0.0.1:<random-port>
WebSocket on same loopback server
```

Authentication:

- daemon generates strong random session token;
- token written to user-only runtime file;
- desktop/CLI use bearer token;
- reject non-loopback connections by default.

Future:

- Unix socket;
- Windows named pipe;
- separate remote/team server threat model.

---

## 3. Versioning

Routes:

```text
/v1/
```

Breaking changes create `/v2`.

WebSocket schemas have independent version number.

---

## 4. JSON conventions

IDs opaque:

```json
{ "mission_id": "mis_01J..." }
```

Dates ISO 8601 UTC.

Enums lower snake case.

Clients ignore unknown response fields. Security-sensitive mutation requests reject unknown fields unless schema explicitly permits.

---

## 5. Error envelope

```json
{
  "error": {
    "code": "APPROVAL_REQUIRED",
    "message": "This change modifies the database schema.",
    "request_id": "req_...",
    "details": {
      "approval_id": "apr_..."
    }
  }
}
```

No raw stack traces in normal client response.

---

## 6. Projects

### Open

```http
POST /v1/projects/open
```

```json
{ "path": "C:\\dev\\my-app" }
```

Response:

```json
{
  "project": {
    "id": "prj_...",
    "name": "my-app",
    "root_path": "C:\\dev\\my-app",
    "git": { "head": "abc123", "dirty": false }
  }
}
```

### Get

```http
GET /v1/projects/{project_id}
```

### Observe/reindex

```http
POST /v1/projects/{project_id}/observe
```

```json
{ "mode": "incremental" }
```

---

## 7. Missions

### Create

```http
POST /v1/missions
```

```json
{
  "project_id": "prj_...",
  "request": "Fix duplicate order creation when checkout is submitted twice.",
  "autonomy": "standard",
  "model_profile": "balanced"
}
```

### Get

```http
GET /v1/missions/{mission_id}
```

### Pause/resume/cancel

```http
POST /v1/missions/{mission_id}/pause
POST /v1/missions/{mission_id}/resume
POST /v1/missions/{mission_id}/cancel
```

Cancellation propagates to model/tool/container/browser operations.

---

## 8. Decisions/approvals

### Decision

```http
POST /v1/missions/{mission_id}/decisions/{decision_id}
```

```json
{ "choice": "recommended" }
```

### Approval

```http
POST /v1/approvals/{approval_id}
```

```json
{
  "decision": "approve",
  "constraints": { "candidate_only": true }
}
```

Approval binds to action hash. Changed action requires new approval.

---

## 9. Candidates

```http
GET /v1/missions/{mission_id}/candidates
GET /v1/candidates/{candidate_id}
GET /v1/candidates/{candidate_id}/diff
POST /v1/candidates/{candidate_id}/verify
POST /v1/candidates/{candidate_id}/apply
```

Apply requires:

- candidate identity still matches verification;
- working tree compatible;
- policy allows;
- approval if configured.

Apply is not commit/push.

---

## 10. Evidence

```http
GET /v1/missions/{mission_id}/evidence
GET /v1/evidence/{evidence_id}
GET /v1/artifacts/{artifact_id}
```

Sensitive artifacts may require explicit reveal. Secret-store values are never returned.

---

## 11. Repo Story

```http
GET /v1/projects/{project_id}/story?view=product
GET /v1/projects/{project_id}/story?view=system
GET /v1/projects/{project_id}/story?view=trust
```

Request journey:

```http
POST /v1/projects/{project_id}/journey
```

```json
{ "query": "How does checkout create an order?" }
```

Nodes include evidence refs.

---

## 12. Blindspots

```http
GET /v1/projects/{project_id}/assumptions
GET /v1/projects/{project_id}/blindspots
POST /v1/projects/{project_id}/blindspots/probe
```

Probe is potentially mutating experiment and must pass policy.

---

## 13. Providers

### List

```http
GET /v1/providers
```

### Add OpenAI-compatible provider

```http
POST /v1/providers
```

```json
{
  "type": "openai_compatible",
  "name": "Local FreeLLMAPI",
  "base_url": "http://127.0.0.1:4000/v1",
  "api_key": "..."
}
```

Server:

1. stores credential in OS keychain;
2. DB stores `secret_ref` only;
3. response never returns secret.

### Discover

```http
POST /v1/providers/{provider_id}/discover
```

### Health

```http
GET /v1/providers/{provider_id}/health
```

---

## 14. Model profiles

```http
GET /v1/model-profiles
POST /v1/model-profiles
```

Example:

```json
{
  "name": "balanced",
  "rules": {
    "preferred_provider_ids": ["prov_local", "prov_free"],
    "requires_tools": true,
    "max_cost_usd_per_call": 0.20
  }
}
```

Provider cost hints are not guaranteed exact.

---

## 15. CLI bridges

Internal/admin detection:

```http
POST /v1/cli-bridges/detect
```

Return installed supported bridges without auth data.

Invocation runs through model gateway/sandbox and budget/policy.

---

## 16. Browser Lab

Start:

```http
POST /v1/missions/{mission_id}/browser-runs
```

```json
{
  "candidate_id": "cand_...",
  "scenario": {
    "persona": "admin",
    "goal": "Invite a teammate"
  },
  "mode": "observe"
}
```

Control:

```http
POST /v1/browser-runs/{run_id}/takeover
POST /v1/browser-runs/{run_id}/release
POST /v1/browser-runs/{run_id}/replay
```

---

## 17. WebSocket

```text
GET /v1/events
Upgrade: websocket
```

Subscribe:

```json
{
  "type": "subscribe",
  "topics": ["mission:mis_123", "project:prj_123"]
}
```

Events:

```text
mission.snapshot
mission.state_changed
mission.event
specialist.started
specialist.finished
decision.requested
approval.requested
candidate.created
candidate.updated
candidate.eliminated
tool.started
tool.output
tool.finished
verification.started
verification.finished
browser.step
evidence.created
budget.updated
mission.completed
```

Envelope:

```json
{
  "schema": 1,
  "id": "evt_...",
  "sequence": 141,
  "topic": "mission:mis_123",
  "type": "verification.finished",
  "created_at": "...",
  "payload": {}
}
```

---

## 18. Reconnection

Client sends last sequence.

```json
{
  "type": "resume",
  "mission_id": "mis_123",
  "after_sequence": 140
}
```

Server replays missing events then resumes live.

---

## 19. Idempotency

Mutation endpoints accept:

```http
Idempotency-Key: <uuid>
```

Use for:

- create mission;
- approve;
- apply candidate;
- start browser run.

---

## 20. OpenPitStop communication

MVP uses subprocess JSON, not public HTTP.

```text
pitstop <command> --json
```

Requirements:

- exact cwd;
- timeout;
- candidate identity check before/after;
- schema-parse stdout;
- preserve stderr;
- preserve exit code;
- no shell interpolation.

Normalize result into PitCrew verification records.

---

## 21. Model provider protocol

```ts
interface NormalizedModelRequest {
  model: string;
  messages: NormalizedMessage[];
  tools: ToolDefinition[];
  maxOutputTokens?: number;
  temperature?: number;
  metadata: {
    missionId: string;
    delegationId: string;
  };
}
```

Streaming:

```ts
type ModelEvent =
  | TextDelta
  | ToolCall
  | UsageUpdate
  | ProviderWarning
  | Finish;
```

---

## 22. Tool protocol

```ts
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  riskClass: "read" | "write" | "execute" | "network" | "high";
}
```

Flow:

```text
model request
 -> parse
 -> policy
 -> approval if needed
 -> sandbox
 -> execute
 -> artifact capture
 -> normalized result
 -> model
```

---

## 23. Skills

Manifest:

```json
{
  "name": "database-safety",
  "version": "1.0.0",
  "roles": ["architect", "reviewer"],
  "permissions": ["repo:read"],
  "inputs": ["mission", "repo_context"],
  "outputs": ["database_review"]
}
```

Skills cannot grant permissions.

---

## 24. External research

No Tavily dependency.

Research can come from:

- user-configured search/web plugin;
- MCP server;
- provider-native browsing where allowed;
- explicit URL fetch tool.

Web content is untrusted and cannot grant permissions or request secrets.

---

## 25. Budgets

Daemon enforces mission limits:

```yaml
budget:
  max_model_calls: 20
  max_wall_minutes: 30
  max_cost_usd: 2.00
```

Unknown provider cost is not zero.

Represent separately:

```text
known cost
estimated cost
unknown
```

---

## 26. G4 profile

G4 maps PitCrew operations onto competition APIs/tools.

It:

- locks model;
- exposes only competition tools;
- maps status to budget controller;
- maps final candidate to submit patch;
- disables unsupported actions;
- stores candidate evidence only in allowed paths.

---

## 27. API security

- loopback bind only;
- random bearer token;
- CORS disabled except known local origin if needed;
- WebSocket auth;
- payload limits;
- path validation;
- no arbitrary file-read endpoint;
- artifact ownership checks;
- secrets never returned after creation;
- audit high-risk calls.
