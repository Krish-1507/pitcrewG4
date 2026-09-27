import { readFile, stat, realpath } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { z } from 'zod';
import { PitCrewError, repositoryGraphSchema } from '@pitcrew/protocol';
import type { RepositoryGraph, RepoFact } from '@pitcrew/protocol';
import { resolveInside, runProcess } from '@pitcrew/sandbox';
import { evaluatePath } from '@pitcrew/policy-engine';
import { redact } from '@pitcrew/observability';
import { contentHash, fact, parseStructure, linkImports } from './structure.js';

export async function indexRepository(
  root: string,
  signal: AbortSignal,
): Promise<RepositoryGraph> {
  const actual = await realpath(root);
  const git = async (args: string[]): Promise<string> => {
    const result = await runProcess(
      { executable: 'git', args: ['-c', 'core.fsmonitor=false', ...args] },
      {
        cwd: actual,
        signal,
        timeoutMs: 30000,
        maxOutputBytes: 4 * 1024 * 1024,
      },
    );
    if (result.exitCode !== 0)
      throw new PitCrewError(
        'TOOL_ENVIRONMENT_FAILED',
        'Repository inspection requires a valid Git repository.',
      );
    return result.stdout;
  };
  const head = (await git(['rev-parse', 'HEAD'])).trim();
  const dirty = Boolean((await git(['status', '--porcelain'])).trim());
  const paths = (
    await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  )
    .split('\0')
    .filter(Boolean);
  if (paths.length > 20000)
    throw new PitCrewError(
      'CONFIGURATION',
      'Repository exceeds indexing file limit.',
    );
  const facts: RepoFact[] = [];
  const files: RepositoryGraph['files'] = [];
  const limitations: string[] = [];
  const allDigests: Record<string, string> = {};
  let bytes = 0;
  for (const path of paths) {
    signal.throwIfAborted();
    if (evaluatePath(path, 'read').decision !== 'allow') continue;
    const target = await resolveInside(actual, path);
    let info;
    try {
      info = await stat(target);
    } catch {
      limitations.push('Missing file: ' + path);
      continue;
    }
    if (info.size > 262144 || bytes + info.size > 16 * 1024 * 1024) {
      limitations.push('Index size limit: ' + path);
      continue;
    }
    bytes += info.size;
    const raw = await readFile(target, 'utf8');
    if (raw.includes('\0')) continue;
    const digest = contentHash(raw);
    allDigests[path] = digest;
    const content = redact(raw);
    if (content !== raw) {
      limitations.push('Credential-like content omitted: ' + path);
      continue;
    }
    const parsed = await parseStructure(path, content, signal);
    const language = extname(path).slice(1) || 'text';
    files.push({
      path,
      digest,
      language,
      parser: parsed.parser,
      parseErrors: parsed.errors,
    });
    facts.push(...parsed.facts);
    if (parsed.errors) limitations.push('Incomplete syntax parse: ' + path);
    const evidence = { path, line: 1, digest };
    if (basename(path) === 'package.json') {
      try {
        const manifest = z
          .object({
            name: z.string().optional(),
            scripts: z.record(z.string()).default({}),
            dependencies: z.record(z.string()).default({}),
            devDependencies: z.record(z.string()).default({}),
          })
          .parse(JSON.parse(content));
        if (manifest.name)
          facts.push(
            fact(path, 'package', manifest.name, 'observed', evidence),
          );
        for (const [name, command] of Object.entries(manifest.scripts))
          facts.push(
            fact(path, 'script:' + name, command, 'observed', evidence),
          );
        for (const name of Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
        }))
          facts.push(fact(path, 'depends_on', name, 'observed', evidence));
      } catch {
        limitations.push('Invalid manifest: ' + path);
      }
    }
    if (
      /(?:pnpm-lock.yaml|package-lock.json|yarn.lock|bun.lock|Cargo.lock|poetry.lock)$/.test(
        path,
      )
    )
      facts.push(fact(path, 'lockfile', basename(path), 'observed', evidence));
    if (/\.github\/workflows|\.gitlab-ci|Jenkinsfile/.test(path))
      facts.push(
        fact(path, 'ci_configuration', 'present', 'observed', evidence),
      );
    if (/migration|schema\.(sql|prisma)/i.test(path))
      facts.push(
        fact(
          path,
          'data_boundary',
          'migration or schema',
          'observed',
          evidence,
        ),
      );
    if (/(?:test|spec)[./]|__tests__/.test(path))
      facts.push(
        fact(path, 'test_file', 'test naming convention', 'inferred', evidence),
      );
  }
  const boundaryDigests = Object.fromEntries(
    Object.entries(allDigests).filter(([path]) =>
      /package.json|auth|permission|\.github|\.gitlab|schema|migration/i.test(
        path,
      ),
    ),
  );
  const boundaryDigest = contentHash(
    JSON.stringify(
      Object.entries(boundaryDigests).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  for (const entry of facts)
    entry.dependencies = {
      ...boundaryDigests,
      ...entry.dependencies,
      $boundaries: boundaryDigest,
    };
  const graph: RepositoryGraph = {
    root: actual,
    head,
    dirty,
    observedAt: Date.now(),
    boundaryDigest,
    files,
    facts,
    relationships: [],
    limitations,
  };
  return repositoryGraphSchema.parse(linkImports(graph));
}
