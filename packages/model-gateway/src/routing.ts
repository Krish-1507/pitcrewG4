import { PitCrewError } from '@pitcrew/protocol';
import type { RuntimeConfig, ProviderConfig } from '@pitcrew/protocol';
import { providerSecrets } from './index.js';

export interface RouteRequest {
  role: string;
  risk: 'low' | 'medium' | 'high';
  contextChars: number;
  tools: boolean;
  priorFailures: ReadonlySet<string>;
}
export interface SelectedRoute {
  id: string;
  provider: ProviderConfig;
  estimatedCostUsd: number | null;
}
export function configuredSecrets(config: RuntimeConfig): string[] {
  return [
    ...new Set(
      [
        config.provider,
        ...(config.routing?.providers.map((r) => r.provider) ?? []),
      ].flatMap(providerSecrets),
    ),
  ];
}
export function selectRoute(
  config: RuntimeConfig,
  request: RouteRequest,
): SelectedRoute {
  const routing = config.routing;
  if (!routing) {
    if (request.priorFailures.has('primary'))
      throw new PitCrewError(
        'PROVIDER_UNAVAILABLE',
        'Configured provider failed; no authorized failover remains.',
      );
    if (config.budget.maxCostUsdPerCall !== undefined)
      throw new PitCrewError(
        'CONFIGURATION',
        'Unknown provider cost cannot satisfy a finite cost ceiling.',
      );
    return { id: 'primary', provider: config.provider, estimatedCostUsd: null };
  }
  const eligible = routing.providers.filter(
    (route) =>
      !request.priorFailures.has(route.id) &&
      route.enabled &&
      route.roles.includes(request.role) &&
      route.maxContextChars >= request.contextChars &&
      (!request.tools || route.tools) &&
      (request.risk !== 'high' || route.highRisk) &&
      (routing.profile !== 'local' || route.local) &&
      (config.budget.maxCostUsdPerCall === undefined ||
        (route.estimatedCostUsd !== undefined &&
          route.estimatedCostUsd <= config.budget.maxCostUsdPerCall)),
  );
  if (routing.profile === 'economy')
    eligible.sort(
      (a, b) =>
        (a.estimatedCostUsd ?? Infinity) - (b.estimatedCostUsd ?? Infinity),
    );
  if (routing.profile === 'deep')
    eligible.sort((a, b) => b.maxContextChars - a.maxContextChars);
  const route = eligible[0];
  if (!route)
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'No configured route satisfies role, risk, context, tools, health and cost limits.',
    );
  return {
    id: route.id,
    provider: route.provider,
    estimatedCostUsd: route.estimatedCostUsd ?? null,
  };
}
