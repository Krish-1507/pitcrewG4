import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseStructure,
  indexRepository,
} from '../packages/repo-intelligence/src/index.js';
import { revalidateFacts, graphDigests } from '../packages/memory/src/index.js';
import { git } from '../packages/candidate-manager/src/index.js';
import { runProcess } from '../packages/sandbox/src/index.js';
import { EvidenceStore } from '../packages/evidence/src/index.js';
const signal = (): AbortSignal => new AbortController().signal;

it.each([
  [
    'src/a.ts',
    'export function total(a:number,b:number){return a+b;}',
    'total',
  ],
  ['src/a.py', 'def total(a,b):\n    return a+b\n', 'total'],
  ['src/a.rs', 'fn total(a:i32,b:i32)->i32 { a+b }', 'total'],
  [
    'src/a.go',
    'package main\nfunc total(a int,b int) int { return a+b }',
    'total',
  ],
])(
  'extracts actual Tree-sitter symbols from %s',
  async (path, source, name) => {
    const parsed = await parseStructure(path, source, signal());
    expect(parsed.parser).toBe('tree-sitter');
    expect(parsed.errors).toBe(false);
    expect(parsed.facts).toContainEqual(
      expect.objectContaining({
        predicate: 'declares',
        value: name,
        kind: 'observed',
        evidence: expect.objectContaining({ path, line: expect.any(Number) }),
      }),
    );
  },
);
it('marks route interpretation as inferred and reports syntax errors', async () => {
  const parsed = await parseStructure(
    'api.js',
    'app.get("/orders", handler);',
    signal(),
  );
  expect(
    parsed.facts.find((fact) => fact.predicate === 'possible_route')?.kind,
  ).toBe('inferred');
  expect(
    (await parseStructure('broken.ts', 'function {', signal())).errors,
  ).toBe(true);
});
it('indexes real Git source, resolves imports, persists facts and invalidates config changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-index-'));
  await runProcess(
    { executable: 'git', args: ['init', root] },
    { cwd: root, signal: signal(), timeoutMs: 10000 },
  );
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'test'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }),
  );
  await writeFile(
    join(root, 'src', 'sum.js'),
    'export function sum(a,b){return a+b;}',
  );
  await writeFile(
    join(root, 'test', 'sum.test.js'),
    'import {sum} from "../src/sum.js";',
  );
  await writeFile(join(root, '.env'), 'PRIVATE_VALUE=never-index-this');
  await git(root, ['add', '.'], signal());
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
    signal(),
  );
  const initial = await indexRepository(root, signal());
  expect(initial.relationships).toContainEqual(
    expect.objectContaining({
      from: 'test/sum.test.js',
      to: 'src/sum.js',
      kind: 'observed',
    }),
  );
  expect(JSON.stringify(initial)).not.toContain('never-index-this');
  expect(initial.files.some((file) => file.path === '.env')).toBe(false);
  expect(
    revalidateFacts(initial.facts, graphDigests(initial)).every(
      (fact) => !fact.stale,
    ),
  ).toBe(true);
  const store = await EvidenceStore.open(
    await mkdtemp(join(tmpdir(), 'pitcrew-facts-')),
  );
  try {
    await store.saveGraph(initial);
    expect((await store.loadGraph(root))?.facts).toEqual(initial.facts);
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        type: 'module',
        scripts: { test: 'node --test --test-concurrency=1' },
      }),
    );
    const changed = await indexRepository(root, signal());
    expect(changed.dirty).toBe(true);
    expect(
      revalidateFacts(initial.facts, graphDigests(changed)).every(
        (fact) => fact.stale,
      ),
    ).toBe(true);
    await store.saveGraph(changed);
    expect(store.facts(root).some((fact) => fact.stale)).toBe(true);
    await writeFile(
      join(root, 'src', 'auth.js'),
      'export const role = "admin";',
    );
    const authAdded = await indexRepository(root, signal());
    expect(
      revalidateFacts(changed.facts, graphDigests(authAdded)).every(
        (fact) => fact.stale,
      ),
    ).toBe(true);
  } finally {
    store.close();
  }
}, 30000);
