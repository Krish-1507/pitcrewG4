import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runProcess } from '../packages/sandbox/dist/index.js';

const runRoot = resolve('.pitcrew', 'acceptance', randomUUID());
const repo = join(runRoot, 'repo');
const state = join(runRoot, 'state');
await mkdir(runRoot, { recursive: true });
await cp(resolve('fixtures/failing-test'), repo, { recursive: true });
const signal = AbortSignal.timeout(900000);
async function run(executable, args, cwd = repo, timeoutMs = 60000) {
  return runProcess(
    { executable, args },
    { cwd, signal, timeoutMs, maxOutputBytes: 8 * 1024 * 1024 },
  );
}
for (const args of [
  ['init'],
  ['add', '.'],
  [
    '-c',
    'user.name=PitCrew acceptance',
    '-c',
    'user.email=acceptance@localhost',
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'Known failing acceptance baseline',
  ],
]) {
  const result = await run('git', args);
  if (result.exitCode !== 0) throw new Error('Fixture Git setup failed.');
}
const sourceBefore = await readFile(join(repo, 'src/sum.js'), 'utf8');
const baseline = await run(process.execPath, ['--test']);
if (baseline.exitCode === 0 || !baseline.stdout.includes('not ok'))
  throw new Error(
    'Fixture did not demonstrate the genuine baseline assertion failure.',
  );
await writeFile(
  join(runRoot, 'baseline-test.json'),
  JSON.stringify(baseline, null, 2),
);
const config = {
  provider: { type: 'codex', executable: 'codex' },
  execution: { allowReducedIsolation: true },
  referee: {
    executable: process.execPath,
    args: [resolve('node_modules/openpitstop/dist/cli.js')],
    requiredLayers: ['stack', 'architecture', 'baseline'],
  },
  test: { executable: 'node', args: ['--test'] },
  budget: { maxModelCalls: 3, timeoutMs: 600000 },
};
const configPath = join(runRoot, 'config.json');
await writeFile(configPath, JSON.stringify(config, null, 2));
console.log('LIVE ACCEPTANCE ' + runRoot);
console.log(
  'Baseline test: genuine FAIL. Docker unavailable; explicit reduced-isolation execution authorized.',
);
const result = await run(
  process.execPath,
  [
    resolve('apps/cli/dist/index.js'),
    '--config',
    configPath,
    '--state',
    state,
    '--repo',
    repo,
    'fix the failing test',
  ],
  process.cwd(),
  700000,
);
console.log(result.stdout);
if (result.stderr) console.log(result.stderr);
await writeFile(join(runRoot, 'cli-output.txt'), result.stdout);
const baselineAfter = await run('git', ['status', '--porcelain']);
if (
  baselineAfter.stdout.trim() ||
  (await readFile(join(repo, 'src/sum.js'), 'utf8')) !== sourceBefore
)
  throw new Error('Baseline was modified.');
console.log('Baseline repository unchanged: PASS');
console.log('CLI exit code: ' + result.exitCode);
await writeFile(
  join(runRoot, 'acceptance-summary.json'),
  JSON.stringify(
    {
      runRoot,
      baselineExit: baseline.exitCode,
      baselineUnchanged: true,
      cliExit: result.exitCode,
    },
    null,
    2,
  ),
);
process.exitCode = result.exitCode ?? 2;
