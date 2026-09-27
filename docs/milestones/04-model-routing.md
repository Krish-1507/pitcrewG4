# Milestone 4: model gateway and routing

Scope: extend the existing gateway with explicit configured routes, native Ollama,
a FreeLLMAPI compatible preset, OS keychain references, bounded provider failover,
and strict JSON/YAML configuration. Codex remains the first real CLI bridge.

The gateway owns provider I/O and deterministic selection; the orchestrator owns
mission events and call budgets. Routing never changes referee requirements.
Only configured routes are eligible. Context capacity, role, tools, risk, health
and per-call cost ceilings filter routes before profile preference. Unknown cost
remains null and is ineligible under a finite ceiling. Estimates are not bills.
Each attempted request consumes the mission call budget, including failed calls.

Credentials are resolved only in the gateway. Keychain errors fail closed; Linux
uses Secret Service explicitly, with no volatile or plaintext fallback. Trusted
configuration contains references only. No arbitrary CLI command template is
accepted: bridges must have a reviewed implementation, starting with Codex.

Acceptance: discriminate routing exclusions and failover; exercise real local
HTTP protocol servers as transport tests (not model acceptance); reject malformed
responses, redirects and unsafe configuration. Repeat live Codex/OpenPitStop flow.
