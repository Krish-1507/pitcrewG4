# Providers and routing

JSON and YAML configurations are supported. Duplicate keys, aliases, plaintext
API keys and unsafe endpoints are rejected. HTTP is restricted to loopback;
remote providers require HTTPS without embedded credentials or query strings.

Provider types:

- `codex`: official installed CLI with its existing authenticated session.
- `openai-compatible`: user-chosen `baseUrl` (including `/v1`) and `model`.
- `freellmapi`: explicit OpenAI-compatible FreeLLMAPI endpoint; no hosted vendor default.
- `ollama`: native `/api/chat` and `/api/tags`, root base URL.

Use `apiKeyEnv` or `secretRef`, never a key value in configuration. The daemon
provider registration endpoint accepts a key once and stores it in OS keychain.
Windows Credential Manager, macOS Keychain and Linux Secret Service are supported.
Unavailable keychains fail closed. Existing Codex authentication is never read.

```yaml
provider:
  type: codex
  executable: codex
routing:
  profile: balanced
  providers:
    - id: local
      provider:
        type: ollama
        baseUrl: http://127.0.0.1:11434
        model: YOUR_INSTALLED_MODEL
      roles: [implementer]
      maxContextChars: 32000
      local: true
    - id: codex
      provider: { type: codex, executable: codex }
      roles: [implementer]
      maxContextChars: 128000
execution:
  allowReducedIsolation: false
referee:
  executable: pitstop
budget:
  maxModelCalls: 4
  timeoutMs: 600000
```

Routing is optional; existing single-provider configuration remains supported.
Balanced and manual preserve configured order; economy orders by configured cost
estimates; deep prefers larger context capacity; local only admits loopback
endpoints marked local. Disabled, failed or incompatible routes are excluded.
Risk is conservatively classified from mission scope. It never authorizes edits.

`budget.maxCostUsdPerCall` admits only configured estimates at or below the
ceiling; unknown cost is excluded. These estimates are admission limits, not
provider billing guarantees. Actual costs remain null when unavailable. Configure
upstream spending controls for hard billing caps. Every failed request counts
toward maxModelCalls. Failover does not add providers or change verification.

Daemon endpoints: GET/POST /v1/providers, POST /v1/providers/:id/discover,
GET /v1/providers/:id/health, GET/POST /v1/model-profiles. Provider registration
uses {name, config, api_key?}; profile update uses the routing object above.
Registration does not automatically grant a provider mission work. Active
missions prevent provider/profile mutation. Metadata and selected routes persist
in SQLite; secret values do not.

CLI bridge implementations are trusted code behind the CliBridge contract.
The initial Codex bridge disables tools and requests bounded structured proposals.
Arbitrary command templates and private authentication extraction are unsupported.
