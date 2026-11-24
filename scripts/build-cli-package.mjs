import { build } from 'esbuild';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const release = join(root, 'release', 'cli');
const dist = join(release, 'dist');
const desktop = join(root, 'apps', 'desktop', 'dist');
if (!existsSync(join(desktop, 'index.html'))) {
  throw new Error('Build the desktop app before packaging the CLI.');
}

await rm(release, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const bundles = [
  ['apps/cli/src/index.ts', 'index.js'],
  ['apps/daemon/src/main.ts', 'daemon.js'],
];
for (const [entry, output] of bundles) {
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(dist, output),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: false,
    logLevel: 'silent',
    external: ['playwright-core', '@vscode/tree-sitter-wasm'],
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
  });
}
await cp(desktop, join(dist, 'desktop'), { recursive: true });
await copyFile(join(root, 'LICENSE'), join(release, 'LICENSE'));
await copyFile(join(root, 'README.md'), join(release, 'README.md'));

const rootPackage = JSON.parse(
  await readFile(join(root, 'package.json'), 'utf8'),
);
const packageName = process.env.PITCREW_PACKAGE_NAME ?? '@pitcrew/cli';
const packageJson = {
  name: packageName,
  version: rootPackage.version,
  description:
    'Local-first AI software engineering orchestration with independent verification.',
  type: 'module',
  bin: { pitcrew: 'dist/index.js' },
  files: ['dist', 'README.md', 'LICENSE'],
  engines: { node: '>=22.13.0' },
  dependencies: {
    '@vscode/tree-sitter-wasm': '0.3.1',
    openpitstop: '1.10.0',
    'playwright-core': '1.64.1',
  },
  license: 'MIT',
  repository: {
    type: 'git',
    url: 'https://github.com/Krish-1507/pitcrewG4.git',
  },
  publishConfig: { access: 'public' },
};
await writeFile(
  join(release, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n',
);
console.log('Built ' + packageName + ' in ' + release);
