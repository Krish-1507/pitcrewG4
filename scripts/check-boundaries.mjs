import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const forbidden = {
  protocol: ['@pitcrew/'],
  'policy-engine': ['@pitcrew/model-gateway', '@pitcrew/orchestrator'],
  'model-gateway': ['@pitcrew/orchestrator', '@pitcrew/mission-runtime'],
  'openpitstop-adapter': ['@pitcrew/orchestrator'],
  cli: [
    '@pitcrew/sandbox',
    '@pitcrew/evidence',
    '@pitcrew/model-gateway',
    '@pitcrew/candidate-manager',
  ],
  desktop: [
    '@pitcrew/sandbox',
    '@pitcrew/evidence',
    '@pitcrew/model-gateway',
    '@pitcrew/candidate-manager',
  ],
};
async function check(dir, owner) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !['node_modules', 'dist', '.turbo'].includes(entry.name)
    )
      await check(path, owner);
    if (!entry.isFile() || !/\.[cm]?tsx?$/.test(entry.name)) continue;
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(
      /(?:from\s*|import\s*\()(['"])([^'"]+)\1/g,
    )) {
      const specifier = match[2];
      if (
        /^@pitcrew\/[^/]+\//.test(specifier) ||
        forbidden[owner]?.some((prefix) => specifier.startsWith(prefix))
      ) {
        throw new Error(`Forbidden package import ${specifier} in ${path}`);
      }
    }
  }
}
for (const root of ['packages', 'apps']) {
  for (const entry of await readdir(root, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (entry.isDirectory()) await check(join(root, entry.name), entry.name);
  }
}
