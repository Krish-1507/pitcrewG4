#!/usr/bin/env node
/**
 * Stage the self-contained desktop runtime: release/desktop-resources.
 *
 * The packaged Electron app runs the same daemon bundle the CLI ships, plus
 * the runtime dependencies that stay external in that bundle (OpenPitStop
 * referee, playwright-core, tree-sitter grammars) and the Mission Control
 * assets. The daemon child runs under Electron as plain Node
 * (ELECTRON_RUN_AS_NODE), so everything must be real files, not asar.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cliDist = join(root, 'release', 'cli', 'dist');
const desktopDist = join(root, 'apps', 'desktop', 'dist');
const target = join(root, 'release', 'desktop-resources');

if (!existsSync(join(cliDist, 'daemon.js'))) {
  throw new Error(
    'Build the CLI package first: pnpm build && pnpm package:cli',
  );
}
if (!existsSync(join(desktopDist, 'index.html'))) {
  throw new Error(
    'Build the desktop assets first: pnpm --filter @pitcrew/desktop build',
  );
}

await rm(target, { recursive: true, force: true });
await mkdir(join(target, 'dist'), { recursive: true });

await cp(join(cliDist, 'daemon.js'), join(target, 'dist', 'daemon.js'));
await cp(join(desktopDist), join(target, 'dist', 'desktop'), {
  recursive: true,
});

const resolveFrom = [
  createRequire(join(root, 'package.json')),
  createRequire(join(root, 'packages', 'browser-lab', 'package.json')),
  createRequire(join(root, 'packages', 'repo-intelligence', 'package.json')),
  createRequire(join(root, 'apps', 'daemon', 'package.json')),
];
const dependencies = [
  'openpitstop',
  'playwright-core',
  '@vscode/tree-sitter-wasm',
];
for (const name of dependencies) {
  let resolved = null;
  for (const require of resolveFrom) {
    try {
      resolved = require.resolve(name + '/package.json');
      break;
    } catch {
      // Try the next package context.
    }
  }
  if (!resolved) throw new Error('Cannot resolve runtime dependency: ' + name);
  // resolved points at <packageRoot>/package.json; the package root is one level up.
  const packageRoot = resolve(resolved, '..');
  await cp(packageRoot, join(target, 'node_modules', name), {
    recursive: true,
    filter: (source) => !source.includes(`${name}${join('.', 'node_modules')}`),
  });
}

await writeFile(
  join(target, 'package.json'),
  JSON.stringify(
    {
      name: 'pitcrew-desktop-runtime',
      version: '0.1.0',
      private: true,
      type: 'module',
      description:
        'Runtime staged for the PitCrew desktop app: daemon bundle, Mission Control assets and external runtime dependencies.',
      license: 'MIT',
    },
    null,
    2,
  ) + '\n',
);

console.log('Staged desktop runtime in ' + target);
