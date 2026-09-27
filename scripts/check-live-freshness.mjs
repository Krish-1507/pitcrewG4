import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runProcess } from '../packages/sandbox/dist/index.js';

const runRoot = resolve(process.argv[2] ?? '');
const missionId = process.argv[3];
if (!missionId || !/^mis_[a-f0-9-]+$/.test(missionId))
  throw new Error('Pass the retained live acceptance root and mission ID.');
const signal = AbortSignal.timeout(60000);
async function replay() {
  const result = await runProcess(
    {
      executable: process.execPath,
      args: [
        resolve('apps/cli/dist/index.js'),
        '--config',
        join(runRoot, 'config.json'),
        '--state',
        join(runRoot, 'state'),
        'replay',
        missionId,
      ],
    },
    { cwd: process.cwd(), signal, timeoutMs: 30000 },
  );
  if (result.exitCode !== 0) throw new Error('Replay command failed');
  return JSON.parse(result.stdout);
}
const original = await replay();
if (original.state !== 'VERIFIED' || !original.candidate)
  throw new Error('Need a real previously verified mission.');
const path = join(original.candidate.root, 'src', 'sum.js');
const body = await readFile(path, 'utf8');
try {
  await writeFile(path, body + '\n// deliberate freshness validation probe\n');
  const stale = await replay();
  if (stale.state !== 'NOT_PROVEN' || stale.evidenceState !== 'STALE')
    throw new Error('Stale evidence was not invalidated.');
  console.log('Changed candidate is NOT_PROVEN / STALE: PASS');
} finally {
  await writeFile(path, body);
}
const restored = await replay();
if (restored.state !== 'VERIFIED' || restored.evidenceState !== 'CURRENT')
  throw new Error('Exact restoration did not recover original identity.');
console.log(
  'Historical evidence retained and exact original identity restored: PASS',
);
