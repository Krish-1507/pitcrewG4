import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { runProcess, resolveInside } from '@pitcrew/sandbox';
import { evaluatePath } from '@pitcrew/policy-engine';
import { redact } from '@pitcrew/observability';
import type { Command, RepoFact } from '@pitcrew/protocol';
import { indexRepository } from './index-repository.js';
import { relevantFacts } from '@pitcrew/memory';

export interface RepoContext {
  files: string[];
  facts: RepoFact[];
  sources: { path: string; content: string }[];
  scripts: Record<string, string>;
  test: Command | undefined;
}
export async function observe(
  root: string,
  request: string,
  signal: AbortSignal,
): Promise<RepoContext> {
  const listing = await runProcess(
    {
      executable: 'git',
      args: ['-c', 'core.fsmonitor=false', 'ls-files', '-z'],
    },
    { cwd: root, signal, timeoutMs: 30000 },
  );
  const files = listing.stdout.split('\0').filter(Boolean);
  let scripts: Record<string, string> = {};
  if (files.includes('package.json')) {
    const raw = JSON.parse(
      await readFile(await resolveInside(root, 'package.json'), 'utf8'),
    ) as unknown;
    scripts = z
      .object({ scripts: z.record(z.string()).default({}) })
      .parse(raw).scripts;
  }
  const graph = await indexRepository(root, signal);
  const terms = request
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const ranked = files
    .filter(
      (p) =>
        evaluatePath(p, 'read').decision === 'allow' &&
        /\.(?:[cm]?[jt]sx?|py|rs|go|json|md)$/.test(p),
    )
    .sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  function score(path: string): number {
    return (
      terms.filter((t) => path.toLowerCase().includes(t)).length * 5 +
      graph.facts.filter(
        (fact) =>
          fact.subject === path &&
          terms.some((term) => fact.value.toLowerCase().includes(term)),
      ).length *
        3 +
      (/(test|spec)/.test(path) ? 2 : 0)
    );
  }
  const sources: { path: string; content: string }[] = [];
  let bytes = 0;
  for (const path of ranked) {
    signal.throwIfAborted();
    if (sources.length >= 30) break;
    const target = await resolveInside(root, path);
    const info = await stat(target);
    if (info.size > 32768 || bytes + info.size > 131072) continue;
    const content = redact(await readFile(target, 'utf8'));
    sources.push({ path, content });
    bytes += info.size;
  }
  const nodeTests = files.some((p) => /(?:test|spec)\.[cm]?js$/.test(p));
  const test = scripts.test
    ? { executable: 'npm', args: ['test'] }
    : nodeTests
      ? { executable: 'node', args: ['--test'] }
      : undefined;
  return {
    files: files.filter((p) => evaluatePath(p, 'read').decision === 'allow'),
    sources,
    facts: relevantFacts(graph.facts, request),
    scripts,
    test,
  };
}

export { indexRepository } from './index-repository.js';
export { parseStructure, contentHash } from './structure.js';
