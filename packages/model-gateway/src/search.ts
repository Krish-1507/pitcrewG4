import { z } from 'zod';
import { PitCrewError, searchSourceSchema } from '@pitcrew/protocol';
import type { SearchSource } from '@pitcrew/protocol';

export interface SearchConfiguration {
  provider: 'brave' | 'searxng' | 'duckduckgo';
}
export interface SearchResult {
  provider: SearchConfiguration['provider'];
  results: SearchSource[];
}
export function searchSecrets(): string[] {
  const key = process.env.PITCREW_BRAVE_SEARCH_API_KEY;
  return key ? [key] : [];
}
export function searchConfiguration(): SearchConfiguration {
  if (process.env.PITCREW_SEARXNG_URL) return { provider: 'searxng' };
  if (process.env.PITCREW_BRAVE_SEARCH_API_KEY) return { provider: 'brave' };
  return { provider: 'duckduckgo' };
}
function source(value: {
  title: string;
  url: string;
  description?: string | null;
  content?: string | null;
}): SearchSource | undefined {
  try {
    const url = new URL(value.url);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      value.url.length > 2048
    )
      return undefined;
    return searchSourceSchema.parse({
      title: value.title.slice(0, 500),
      url: url.toString(),
      description: (value.description ?? value.content ?? '').slice(0, 2000),
    });
  } catch {
    return undefined;
  }
}
function searxngEndpoint(): URL {
  const raw = process.env.PITCREW_SEARXNG_URL;
  if (!raw)
    throw new PitCrewError(
      'POLICY_DENIED',
      'SearXNG search is not configured.',
    );
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new PitCrewError('CONFIGURATION', 'Invalid SearXNG URL.');
  }
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== 'https:' &&
      !(
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      ))
  )
    throw new PitCrewError(
      'CONFIGURATION',
      'SearXNG must use HTTPS or explicit loopback HTTP, with no embedded credentials.',
    );
  return new URL(
    'search',
    base.pathname.endsWith('/') ? base : new URL(base.toString() + '/'),
  );
}
async function readJson(response: Response): Promise<unknown> {
  if (!response.body)
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider returned no response body.',
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 1024 * 1024) {
      await reader.cancel();
      throw new PitCrewError(
        'PROVIDER_UNAVAILABLE',
        'Search provider output exceeded limit.',
      );
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider returned invalid JSON.',
    );
  }
}
function entityDecode(value: string): string {
  return value
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
function stripTags(value: string): string {
  return entityDecode(value.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}
function resolveDdgHref(href: string): string | undefined {
  let raw = entityDecode(href);
  if (raw.startsWith('//')) raw = 'https:' + raw;
  try {
    const url = new URL(raw, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? new URL(entityDecode(target)).toString() : url.toString();
  } catch {
    return undefined;
  }
}
/** Parse the DuckDuckGo HTML result page into validated sources. */
export function duckduckgoResultsFromHtml(html: string): SearchSource[] {
  const titles = [
    ...html.matchAll(
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    ),
  ];
  const snippets = [
    ...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g),
  ];
  const seen = new Set<string>();
  const results: SearchSource[] = [];
  for (let index = 0; index < titles.length; index += 1) {
    const title = stripTags(titles[index]![2] ?? '');
    const url = resolveDdgHref(titles[index]![1] ?? '');
    if (!title || !url || seen.has(url)) continue;
    const item = source({
      title,
      url,
      description: stripTags(snippets[index]?.[1] ?? ''),
    });
    if (!item) continue;
    seen.add(url);
    results.push(item);
    if (results.length === 5) break;
  }
  return results;
}

/**
 * Keyless DuckDuckGo HTML backend. The endpoint is a public page, not a
 * contracted API: results are best-effort, heavy automated use can be
 * rate-limited or blocked, and the HTML shape can change without notice.
 * Everything returned is untrusted context.
 */
async function duckduckgoSearch(
  normalized: string,
  signal: AbortSignal,
): Promise<SearchSource[]> {
  let response: Response;
  try {
    response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'PitCrew/0.1 (local-first coding agent)',
        accept: 'text/html',
      },
      body: new URLSearchParams({ q: normalized }).toString(),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    if (signal.aborted)
      throw new PitCrewError('CANCELLED', 'Search request cancelled.');
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider could not be reached.',
    );
  }
  if (!response.ok)
    throw new PitCrewError(
      response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
      'Search provider failed (HTTP ' + response.status + ').',
    );
  if (!response.body)
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider returned no response body.',
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new PitCrewError(
        'PROVIDER_UNAVAILABLE',
        'Search provider output exceeded limit.',
      );
    }
    chunks.push(part.value);
  }
  const html = Buffer.concat(chunks).toString('utf8');
  return duckduckgoResultsFromHtml(html);
}

export async function webSearch(
  query: string,
  signal: AbortSignal,
): Promise<SearchResult> {
  const configuration = searchConfiguration();
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 500 || normalized.includes('\0'))
    throw new PitCrewError(
      'CONFIGURATION',
      'Search query must be one line of at most 500 characters.',
    );
  if (configuration.provider === 'duckduckgo')
    return {
      provider: configuration.provider,
      results: await duckduckgoSearch(normalized, signal),
    };
  let endpoint: URL;
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'PitCrew/0.1',
  };
  if (configuration.provider === 'brave') {
    const key = process.env.PITCREW_BRAVE_SEARCH_API_KEY;
    if (!key)
      throw new PitCrewError(
        'POLICY_DENIED',
        'Brave Search is not configured.',
      );
    endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
    endpoint.searchParams.set('q', normalized);
    endpoint.searchParams.set('count', '5');
    headers['x-subscription-token'] = key;
  } else {
    endpoint = searxngEndpoint();
    endpoint.searchParams.set('q', normalized);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('categories', 'general');
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      redirect: 'error',
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    if (signal.aborted)
      throw new PitCrewError('CANCELLED', 'Search request cancelled.');
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider could not be reached.',
    );
  }
  if (!response.ok)
    throw new PitCrewError(
      response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
      'Search provider failed (HTTP ' + response.status + ').',
    );
  const raw = await readJson(response);
  const parsed =
    configuration.provider === 'brave'
      ? z
          .object({
            web: z
              .object({
                results: z
                  .array(
                    z.object({
                      title: z.string(),
                      url: z.string(),
                      description: z.string().optional(),
                    }),
                  )
                  .default([]),
              })
              .optional(),
          })
          .safeParse(raw)
      : z
          .object({
            results: z
              .array(
                z.object({
                  title: z.string(),
                  url: z.string(),
                  content: z.string().optional(),
                }),
              )
              .default([]),
          })
          .safeParse(raw);
  if (!parsed.success)
    throw new PitCrewError(
      'PROVIDER_UNAVAILABLE',
      'Search provider returned an invalid response.',
    );
  const candidates =
    configuration.provider === 'brave'
      ? ((
          parsed.data as {
            web?: {
              results: { title: string; url: string; description?: string }[];
            };
          }
        ).web?.results ?? [])
      : (
          parsed.data as {
            results: { title: string; url: string; content?: string }[];
          }
        ).results;
  const seen = new Set<string>();
  const results: SearchSource[] = [];
  for (const candidate of candidates) {
    const item = source(candidate);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    results.push(item);
    if (results.length === 5) break;
  }
  return { provider: configuration.provider, results };
}
