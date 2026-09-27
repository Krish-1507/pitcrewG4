import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { PitCrewError } from '@pitcrew/protocol';
import type { Candidate } from '@pitcrew/protocol';
import { runProcess, resolveInside } from '@pitcrew/sandbox';

export async function git(
  root: string,
  args: string[],
  signal: AbortSignal,
): Promise<string> {
  const result = await runProcess(
    {
      executable: 'git',
      args: [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'core.fsmonitor=false',
        '-c',
        'diff.external=',
        ...args,
      ],
    },
    { cwd: root, signal, timeoutMs: 30000, maxOutputBytes: 8 * 1024 * 1024 },
  );
  if (result.exitCode !== 0)
    throw new PitCrewError(
      'TOOL_ENVIRONMENT_FAILED',
      'Git operation failed: ' + args[0],
    );
  return result.stdout;
}
export async function sourceFiles(
  root: string,
  signal: AbortSignal,
): Promise<string[]> {
  const tracked = (await git(root, ['ls-files', '-z'], signal))
    .split('\0')
    .filter(Boolean);
  const untracked = (
    await git(
      root,
      ['ls-files', '--others', '--exclude-standard', '-z'],
      signal,
    )
  )
    .split('\0')
    .filter(Boolean)
    .filter((p) => !p.startsWith('.pitstop/') && !p.startsWith('.pitcrew/'));
  return [...new Set([...tracked, ...untracked])].sort();
}
export async function fingerprint(
  root: string,
  signal: AbortSignal,
): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await git(root, ['rev-parse', 'HEAD'], signal));
  const files = await sourceFiles(root, signal);
  if (files.length > 20000)
    throw new PitCrewError(
      'CONFIGURATION',
      'Repository exceeds P0 file budget.',
    );
  let size = 0;
  for (const path of files) {
    signal.throwIfAborted();
    const target = await resolveInside(root, path);
    let info;
    try {
      info = await lstat(target);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        hash.update(JSON.stringify([path, 'deleted']));
        continue;
      }
      throw error;
    }
    size += info.size;
    if (size > 128 * 1024 * 1024 || info.size > 8 * 1024 * 1024)
      throw new PitCrewError(
        'CONFIGURATION',
        'Repository exceeds P0 byte budget.',
      );
    hash.update(JSON.stringify([path, info.mode, info.size]));
    hash.update(await readFile(target));
  }
  hash.update(
    await git(
      root,
      ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--binary'],
      signal,
    ),
  );
  return hash.digest('hex');
}
export async function inspectBaseline(
  root: string,
  signal: AbortSignal,
): Promise<{ root: string; head: string; digest: string }> {
  const actual = await realpath(root);
  const gitRoot = (
    await git(actual, ['rev-parse', '--show-toplevel'], signal)
  ).trim();
  if ((await realpath(gitRoot)).toLowerCase() !== actual.toLowerCase())
    throw new PitCrewError(
      'CONFIGURATION',
      'Open the repository root, not a subdirectory.',
    );
  if (
    (
      await git(
        actual,
        ['status', '--porcelain=v1', '--untracked-files=all'],
        signal,
      )
    ).trim()
  )
    throw new PitCrewError(
      'APPROVAL_REQUIRED',
      'Repository has uncommitted work. Commit or stash it explicitly before this P0 mission.',
    );
  return {
    root: actual,
    head: (await git(actual, ['rev-parse', 'HEAD'], signal)).trim(),
    digest: await fingerprint(actual, signal),
  };
}
export async function createCandidate(
  root: string,
  stateRoot: string,
  baseline: string,
  signal: AbortSignal,
): Promise<Candidate> {
  const id = 'cand_' + randomUUID();
  const candidateRoot = join(stateRoot, 'candidates', id);
  await mkdir(join(stateRoot, 'candidates'), { recursive: true });
  const branch = 'pitcrew/' + id;
  await git(
    root,
    ['worktree', 'add', '-b', branch, candidateRoot, baseline],
    signal,
  );
  return { id, root: candidateRoot, branch, baseline };
}
export async function candidateDiff(
  candidate: Candidate,
  signal: AbortSignal,
): Promise<string> {
  return git(
    candidate.root,
    [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--binary',
      candidate.baseline,
      '--',
    ],
    signal,
  );
}
export async function checkpoint(
  candidate: Candidate,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<void> {
  for (const path of paths) await resolveInside(candidate.root, path);
  await git(candidate.root, ['add', '--', ...paths], signal);
  await git(
    candidate.root,
    [
      '-c',
      'user.name=PitCrew',
      '-c',
      'user.email=pitcrew@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'PitCrew candidate checkpoint',
    ],
    signal,
  );
}
