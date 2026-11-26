#!/usr/bin/env node
/**
 * Package the PitCrew desktop app (Windows first).
 *
 * Steps: workspace build -> CLI package -> stage the self-contained runtime
 * (scripts/build-desktop-resources.mjs) -> electron-builder --dir ->
 * copy the staged runtime into win-unpacked/resources/pitcrew.
 *
 * The copy step is done here, outside electron-builder, because its file
 * matcher unconditionally excludes node_modules directories from
 * extraResources (app-builder-lib/out/fileMatcher.js), and the daemon child
 * needs real dependency files on disk (it runs under ELECTRON_RUN_AS_NODE,
 * which cannot read asar archives).
 *
 * For the NSIS installer, run electron-builder on a terminal outside
 * sandboxed environments (its uninstaller-stub step executes the freshly
 * built installer):
 *   pnpm package:desktop  (without the --dir flag in apps/desktop dist script)
 *   pnpm --dir apps/desktop exec electron-builder --win --publish never
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Run pnpm through Node's own entry point. Spawning the pnpm shim is
 * rejected by modern Node (EINVAL for .cmd/.bat without a shell), and a
 * shell wrapper would break the argv-execution rule; pnpm ships next to
 * the node executable in standard installs (nvm, volta, default prefix).
 */
const pnpmEntry = join(
  dirname(process.execPath),
  'node_modules',
  'pnpm',
  'bin',
  'pnpm.cjs',
);

function run(command, args, cwd = root) {
  if (command === 'pnpm') {
    if (!existsSync(pnpmEntry))
      throw new Error(
        'pnpm runtime not found at ' +
          pnpmEntry +
          '. Install pnpm 11.19.0 alongside Node.js.',
      );
    execFileSync(process.execPath, [pnpmEntry, ...args], {
      cwd,
      stdio: 'inherit',
      shell: false,
    });
    return;
  }
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: false });
}

run('pnpm', ['build']);
run('pnpm', ['package:cli']);
run('node', ['scripts/build-desktop-resources.mjs']);
run('pnpm', [
  '--dir',
  'apps/desktop',
  'exec',
  'electron-builder',
  '--win',
  '--dir',
  '--publish',
  'never',
]);

const staged = join(root, 'release', 'desktop-resources');
const unpacked = join(root, 'release', 'desktop', 'win-unpacked');
if (!existsSync(join(unpacked, 'PitCrew.exe')))
  throw new Error(
    'electron-builder did not produce release/desktop/win-unpacked.',
  );

const resourcesTarget = join(unpacked, 'resources', 'pitcrew');
await rm(resourcesTarget, { recursive: true, force: true });
await mkdir(resourcesTarget, { recursive: true });
await cp(staged, resourcesTarget, { recursive: true });

console.log('Packaged portable desktop app: ' + unpacked);
console.log(
  'Installer (outside sandboxed shells): pnpm --dir apps/desktop exec electron-builder --win --publish never',
);
