import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outputIndex = process.argv.indexOf('--out');
const only =
  process.argv.indexOf('--only') >= 0
    ? process.argv[process.argv.indexOf('--only') + 1]
    : undefined;
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;

function run(command, cwd) {
  return new Promise((resolveRun) => {
    const child = spawn(command.executable, command.args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      settle({ exitCode: 124, timedOut: true });
    }, 180000);
    function settle(extra) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({
        exitCode: extra.exitCode,
        timedOut: extra.timedOut ?? false,
        stdout: stdout.slice(0, 20000),
        stderr: stderr.slice(0, 20000),
      });
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      stderr += String(error);
      settle({ exitCode: 127 });
    });
    child.once('close', (code) => settle({ exitCode: code ?? 1 }));
  });
}

const manifest = JSON.parse(await readFile(join(here, 'tasks.json'), 'utf8'));
const tasks = manifest.tasks.filter((task) => !only || task.id === only);
const results = [];
for (const task of tasks) {
  const fixture = resolve(repoRoot, task.fixture);
  const result = await run(task.command, fixture);
  results.push({
    id: task.id,
    category: task.category,
    description: task.description,
    fixture: task.fixture,
    command: task.command,
    expectedBaselineExit: task.expectedBaselineExit,
    exitCode: result.exitCode,
    matched: result.exitCode === task.expectedBaselineExit,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}
const record = {
  benchmark: 'pitcrew-core',
  mode: 'baseline-fixture-validation',
  generatedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot })
    .toString()
    .trim(),
  dirty:
    execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot })
      .toString()
      .trim().length > 0,
  environment: {
    platform: process.platform,
    release: process.release.name,
    node: process.version,
  },
  contenders: [],
  limitations: [
    'No model-backed contender was executed in this environment; these results validate the harness and fixture baselines only.',
    'A green baseline row does not measure agent task success, false-done rate or regressions.',
    'Browser recovery requires a locally installed Chrome or Edge and a local HTTP server.',
  ],
  tasks: results,
};
const target =
  output ??
  join(
    here,
    'results',
    'run-' + record.generatedAt.replace(/[:.]/g, '-') + '.json',
  );
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(record, null, 2));
console.log(
  results
    .map(
      (result) =>
        (result.matched ? 'MATCH ' : 'MISMATCH ') +
        result.id +
        ' expected=' +
        result.expectedBaselineExit +
        ' actual=' +
        result.exitCode,
    )
    .join('\n'),
);
console.log('Raw results: ' + target);
process.exitCode = results.every((result) => result.matched) ? 0 : 1;
