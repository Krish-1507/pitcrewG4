#!/usr/bin/env node
/**
 * Repair an incomplete Electron binary installation in apps/desktop.
 *
 * Background: `electron/install.js` extracts its zip with extract-zip.
 * On some Node builds the read stream stalls, the promise never settles,
 * and Node exits 0 with a dist folder holding only `locales/`. The
 * downloaded zip in the Electron cache is still intact, so this script
 * verifies its SHA-256 against the package's own checksums.json and
 * expands it with the platform's archive tool instead.
 *
 * Never runs when the installation is already complete.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  'apps',
  'desktop',
);
const electronRoot = join(desktopRoot, 'node_modules', 'electron');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { version } = JSON.parse(
  readFileSync(join(electronRoot, 'package.json'), 'utf8'),
);
const platform = process.env.npm_config_platform || process.platform;
const arch = process.env.npm_config_arch || process.arch;
const platformPath =
  platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : platform === 'win32'
      ? 'electron.exe'
      : 'electron';
const distPath = join(electronRoot, 'dist');

function installed() {
  try {
    return (
      readFileSync(join(distPath, 'version'), 'utf8').replace(/^v/, '') ===
        version && existsSync(join(distPath, platformPath))
    );
  } catch {
    return false;
  }
}

if (installed()) {
  console.log('Electron binary is already installed and complete.');
  process.exit(0);
}

const checksums = JSON.parse(
  readFileSync(join(electronRoot, 'checksums.json'), 'utf8'),
);
const artifactName = `electron-v${version}-${platform}-${arch}.zip`;
const expected = checksums[artifactName];
if (!expected)
  fail(
    `No checksum for ${artifactName}; run "node ${join(electronRoot, 'install.js')}" manually.`,
  );

const cacheRoot =
  process.env.electron_config_cache ||
  join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'electron',
    'Cache',
  );
let cached = null;
if (existsSync(cacheRoot)) {
  for (const hashDir of readdirSafe(cacheRoot)) {
    const candidate = join(cacheRoot, hashDir, artifactName);
    if (existsSync(candidate)) {
      cached = candidate;
      break;
    }
  }
  if (!cached) {
    const flat = join(cacheRoot, artifactName);
    if (existsSync(flat)) cached = flat;
  }
}
if (!cached)
  fail(
    `No cached ${artifactName} under ${cacheRoot}.\n` +
      'Run "node node_modules/electron/install.js" with network access to download it, then rerun this script.',
  );

const actual = createHash('sha256').update(readFileSync(cached)).digest('hex');
if (actual !== expected)
  fail(
    `Cached ${artifactName} failed checksum verification (got ${actual.slice(0, 16)}…, expected ${expected.slice(0, 16)}…).\n` +
      'Delete it from the cache and re-download with "node node_modules/electron/install.js".',
  );
console.log(
  `Verified ${artifactName} against checksums.json (${statSync(cached).size} bytes).`,
);

if (existsSync(distPath)) {
  // Remove only the incomplete extraction; a complete install exits above.
  execFileSync(
    process.platform === 'win32' ? 'powershell.exe' : 'rm',
    platform === 'win32'
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Remove-Item -LiteralPath "${distPath}" -Recurse -Force`,
        ]
      : ['-rf', distPath],
    { stdio: 'ignore' },
  );
}

if (platform === 'win32') {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath "${cached}" -DestinationPath "${distPath}"`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
} else {
  execFileSync('unzip', ['-q', '-o', cached, '-d', distPath], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

writeFileSync(join(electronRoot, 'path.txt'), platformPath);
if (!installed())
  fail(`Repair did not produce a working installation in ${distPath}.`);
console.log(`Electron ${version} repaired: ${join(distPath, platformPath)}`);

function readdirSafe(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}
