import type { ProviderConfig } from '@pitcrew/protocol';
import type { HardwareReport } from './hardware.js';

/**
 * Setup-time provider probe. The full health/discovery machinery lives in
 * the daemon (and the CLI cannot import the gateway package), so setup uses
 * a small bounded catalogue request purely to pre-fill sensible defaults.
 * `pitcrew doctor` remains the authoritative check.
 */
export async function probeProviderCatalogue(
  provider: ProviderConfig,
): Promise<string[]> {
  if (provider.type === 'codex') return [];
  const url = new URL(
    provider.baseUrl.replace(/\/$/, '') +
      (provider.type === 'ollama' ? '/api/tags' : '/models'),
  );
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  )
    return [];
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const raw: unknown = await response.json();
    if (provider.type === 'ollama') {
      const parsed = raw as { models?: { name?: unknown }[] };
      return (parsed.models ?? [])
        .map((model) => String(model.name ?? ''))
        .filter(Boolean)
        .slice(0, 50);
    }
    const parsed = raw as { data?: { id?: unknown }[] };
    return (parsed.data ?? [])
      .map((model) => String(model.id ?? ''))
      .filter(Boolean)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function hardwareSummary(report: HardwareReport): string {
  const parts = [report.cpuCores + ' CPU core(s)', report.ramGb + ' GiB RAM'];
  if (report.gpuName) parts.push(report.gpuName);
  if (report.gpuVramGb) parts.push('≥' + report.gpuVramGb + ' GiB VRAM');
  return parts.join(', ');
}
