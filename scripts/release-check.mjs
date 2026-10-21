import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const steps = [];
function invoke(executable, args) {
  if (process.platform !== 'win32')
    return spawnSync(executable, args, {
      cwd: process.cwd(),
      shell: false,
      stdio: 'inherit',
      env: process.env,
    });
  return spawnSync(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', [executable, ...args].join(' ')],
    {
      cwd: process.cwd(),
      shell: false,
      stdio: 'inherit',
      env: process.env,
    },
  );
}
function step(name, executable, args) {
  const result = invoke(executable, args);
  steps.push({ name, ok: result.status === 0, status: result.status });
  return result.status === 0;
}

const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = major > 22 || (major === 22 && minor >= 13);
steps.push({ name: 'node >= 22.13', ok: nodeOk, status: nodeOk ? 0 : 1 });
if (!nodeOk) {
  console.error('Node 22.13.0 or newer is required.');
  process.exit(1);
}

let ok = true;
for (const [name, executable, args] of [
  ['build', 'pnpm', ['build']],
  ['test', 'pnpm', ['test']],
  ['typecheck', 'pnpm', ['typecheck']],
  ['lint', 'pnpm', ['lint']],
  ['format:check', 'pnpm', ['format:check']],
]) {
  if (!step(name, executable, args)) ok = false;
}

const referee = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'openpitstop.cmd' : 'openpitstop',
);
const refereeOk = existsSync(referee);
steps.push({
  name: 'OpenPitStop installed',
  ok: refereeOk,
  status: refereeOk ? 0 : 1,
});
if (existsSync(referee)) {
  const packageRoot = join(process.cwd(), 'node_modules', 'openpitstop');
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8'),
  );
  const entry = join(packageRoot, manifest.bin.openpitstop);
  const version = spawnSync(process.execPath, [entry, '--version'], {
    cwd: process.cwd(),
    shell: false,
    encoding: 'utf8',
  });
  steps.push({
    name: 'OpenPitStop available',
    ok: version.status === 0,
    status: version.status,
  });
} else ok = false;

const benchmarkRoot = join(
  process.cwd(),
  'benchmarks',
  'pitcrew-core',
  'results',
);
const published = existsSync(benchmarkRoot)
  ? readdirSync(benchmarkRoot).filter((name) => name.endsWith('.json'))
  : [];
steps.push({
  name: 'benchmark raw results published',
  ok: published.length > 0,
  status: published.length > 0 ? 0 : 1,
});
if (!published.length) ok = false;

const status = spawnSync('git', ['status', '--porcelain'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
const dirty = (status.stdout ?? '').trim().length > 0;
steps.push({ name: 'working tree reviewed', ok: true, status: dirty ? 1 : 0 });
if (dirty)
  console.warn(
    'Working tree contains uncommitted changes; commit or review before release.',
  );

console.log('\nRelease check');
for (const entry of steps)
  console.log(
    (entry.ok ? 'PASS ' : 'FAIL ') +
      entry.name +
      (entry.status ? ' (' + entry.status + ')' : ''),
  );
console.log(
  '\nOpenPitStop independent verification was not executed by this script. Run the configured strict verification separately; a missing verdict is NOT_PROVEN.',
);
process.exitCode = ok ? 0 : 1;
