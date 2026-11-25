# Providers and routing

JSON and YAML configurations are supported. Duplicate keys, aliases, plaintext
API keys and unsafe endpoints are rejected. HTTP is restricted to loopback;
remote providers require HTTPS without embedded credentials or query strings.

Provider types:

- `codex`: official installed CLI with its existing authenticated session.
- `openai-compatible`: user-chosen `baseUrl` (including `/v1`) and `model`.
- `anthropic`: native Anthropic Messages API (`baseUrl` ending in `/v1`, for
  example `https://api.anthropic.com/v1`); sends `x-api-key` and
  `anthropic-version` instead of a bearer token, and requests structured
  output in prose (validated like every other transport).
- `freellmapi`: explicit OpenAI-compatible FreeLLMAPI endpoint; no hosted vendor default.
- `ollama`: native `/api/chat` and `/api/tags`, root base URL.

`pitcrew setup` offers named presets on top of these five wire protocols:
codex, openai, anthropic (Claude), gemini (OpenAI-compatible endpoint),
openrouter, deepseek, groq, mistral, xai, together, freellmapi, ollama,
lmstudio, llamacpp and custom. Presets only fill `type`, `baseUrl` and a
default model; they never embed credentials. Anything unlisted still works
through `custom` (any HTTPS OpenAI-compatible endpoint) or `openai-compatible`
configuration. Local presets additionally print a hardware-based model-size
suggestion and the models the endpoint already serves.

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

## Web research

Web research is a separate provider path. It is not a mission model route and cannot change the verification standard.

- **Built-in keyless searcher (default):** the DuckDuckGo HTML endpoint. No
  key, no configuration, no network call until research actually runs. It is
  a public page, not a contracted API: results are best-effort, heavy
  automated use can be rate-limited or blocked, and the HTML shape can change
  without notice.
- `PITCREW_SEARXNG_URL`: SearXNG base URL (overrides the default). HTTPS is accepted; plain HTTP is accepted only for `localhost`, `127.0.0.1` or `[::1]`. Embedded credentials, query strings and fragments are rejected.
- `PITCREW_BRAVE_SEARCH_API_KEY`: Brave Search subscription token (overrides the default). The endpoint is fixed to `https://api.search.brave.com/res/v1/web/search`; the key is sent only to that host and is included in secret redaction.

Queries are normalized to one line and limited to 500 characters. Results are capped at five, restricted to HTTP(S) URLs, deduplicated, and treated as untrusted context. The daemon exposes `GET /v1/research` for status and `POST /v1/research` for a query.

Quick Assistant research is automatic by default: one bounded model decision, then at most one search round whose results are attached as untrusted context. Requests can force the behaviour with the `web` field: `true` always searches, `false` disables research and skips the decision call, `undefined` is automatic. A failed research decision never fails the request. Research results cannot affect authorization, policy, tools or verification.

If routing is configured, Quick Assistant asks for the `quick-assistant` role. Add that role to an eligible route, or keep a single-provider configuration where routing is absent. An assistant can prefer a route and override the model, but not the provider type or verification policy.
