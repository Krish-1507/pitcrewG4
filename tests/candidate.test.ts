import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  git,
  inspectBaseline,
  createCandidate,
  fingerprint,
  checkpoint,
  candidateDiff,
} from '../packages/candidate-manager/src/index.js';
import { runProcess } from '../packages/sandbox/src/index.js';

it('uses a real isolated branch and replayable diff without changing baseline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-git-'));
  const state = await mkdtemp(join(tmpdir(), 'pitcrew-state-'));
  const signal = new AbortController().signal;
  await runProcess(
    { executable: 'git', args: ['init', root] },
    { cwd: root, signal, timeoutMs: 10000 },
  );
  await mkdir(join(root, 'src'));
  await writeFile(
    join(root, 'src', 'sum.js'),
    'export const sum = (a,b) => a-b;\n',
  );
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'fixture',
    ],
    signal,
  );
  const baseline = await inspectBaseline(root, signal);
  const candidate = await createCandidate(root, state, baseline.head, signal);
  const before = await fingerprint(candidate.root, signal);
  await writeFile(
    join(candidate.root, 'src', 'sum.js'),
    'export const sum = (a,b) => a+b;\n',
  );
  expect(await fingerprint(candidate.root, signal)).not.toBe(before);
  await checkpoint(candidate, ['src/sum.js'], signal);
  expect(await candidateDiff(candidate, signal)).toContain(
    '+export const sum = (a,b) => a+b;',
  );
  expect(await fingerprint(root, signal)).toBe(baseline.digest);
  expect(await readFile(join(root, 'src', 'sum.js'), 'utf8')).toContain('a-b');
  expect((await git(root, ['status', '--porcelain'], signal)).trim()).toBe('');
}, 30000);
