import { expect, it } from 'vitest';
import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildRepoStory,
  indexRepository,
} from '../packages/repo-intelligence/src/index.js';
import { repoStorySchema } from '../packages/protocol/src/index.js';
import { git } from '../packages/candidate-manager/src/index.js';

async function init(root: string, signal: AbortSignal): Promise<void> {
  await git(root, ['init'], signal);
  await git(root, ['add', '.'], signal);
  await git(
    root,
    [
      '-c',
      'user.name=PitCrew story',
      '-c',
      'user.email=story@localhost',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Story baseline',
    ],
    signal,
  );
}

it('projects evidence-labelled product, system, journey, impact and trust views', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-story-'));
  await cp(join(process.cwd(), 'fixtures', 'multi-module'), root, {
    recursive: true,
  });
  const signal = AbortSignal.timeout(60000);
  await init(root, signal);
  const graph = await indexRepository(root, signal);
  const story = buildRepoStory(graph);
  repoStorySchema.parse(story);
  expect(story.root).toBe(graph.root);
  expect(story.head).toBe(graph.head);
  expect(story.boundaryDigest).toBe(graph.boundaryDigest);
  const views = new Set(story.items.map((item) => item.view));
  expect(views.has('product')).toBe(true);
  expect(views.has('system')).toBe(true);
  expect(views.has('change-impact')).toBe(true);
  expect(views.has('trust')).toBe(true);
  for (const item of story.items) {
    expect(item.evidence.length).toBeGreaterThan(0);
    for (const evidence of item.evidence)
      expect(graph.files.some((file) => file.path === evidence.path)).toBe(
        true,
      );
  }
  const imports = story.items.find(
    (item) =>
      item.view === 'change-impact' && item.statement.includes(' imports '),
  );
  expect(imports?.kind).toBe('observed');
  expect(
    story.items.find((item) => item.view === 'product')?.statement,
  ).toContain('pitcrew-real-acceptance-fixture');
}, 120000);

it('builds a valid story for a repository without manifests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-story-plain-'));
  await writeFile(
    join(root, 'index.js'),
    'export function value() { return 1; }\n',
    'utf8',
  );
  const signal = AbortSignal.timeout(60000);
  await init(root, signal);
  const story = buildRepoStory(await indexRepository(root, signal));
  repoStorySchema.parse(story);
  expect(story.items.some((item) => item.view === 'system')).toBe(true);
  expect(story.items.some((item) => item.view === 'trust')).toBe(true);
  expect(story.items.every((item) => item.evidence.length > 0)).toBe(true);
}, 120000);
