import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const usage = [
  'Usage: node scripts/onboard.mjs [options]',
  '',
  'Writes a trusted PitCrew config and prints the next commands.',
  '',
  'Options:',
  '  --repo <path>          target Git repository (default: current directory)',
  '  --out <file>           config path (default: .pitcrew/config.json)',
  '  --provider <name>      codex | ollama | openai-compatible (default: codex)',
  '  --model <name>         model for ollama / openai-compatible',
  '  --base-url <url>       endpoint for openai-compatible',
  '  --api-key-env <name>   env var holding the API key (never the key itself)',
  '  --reduced-isolation    authorize host execution when Docker is unavailable',
  '  --help                 show this help',
].join('\n');

const { values } = parseArgs({
  options: {
    repo: { type: 'string' },
    out: { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string' },
    'base-url': { type: 'string' },
    'api-key-env': { type: 'string' },
    'reduced-isolation': { type: 'boolean' },
    help: { type: 'boolean' },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

const repo = resolve(values.repo ?? '.');
const out = resolve(values.out ?? '.pitcrew/config.json');
const referee = resolve('node_modules/openpitstop/dist/cli.js');
if (!existsSync(referee))
  throw new Error('OpenPitStop is not installed. Run pnpm install first.');

let validateConfig;
try {
  ({ validateConfig } = await import('../packages/config/dist/index.js'));
} catch {
  throw new Error('PitCrew is not built. Run pnpm build first.');
}

const kind = values.provider ?? 'codex';
let provider;
if (kind === 'codex') {
  provider = { type: 'codex', executable: 'codex' };
} else if (kind === 'ollama') {
  provider = {
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: values.model ?? 'llama3.1',
  };
} else if (kind === 'openai-compatible') {
  const baseUrl = values['base-url'];
  const model = values.model;
  if (!baseUrl || !model)
    throw new Error('openai-compatible needs --base-url and --model.');
  provider = {
    type: 'openai-compatible',
    baseUrl,
    model,
    ...(values['api-key-env'] ? { apiKeyEnv: values['api-key-env'] } : {}),
  };
} else {
  throw new Error('Unknown provider: ' + kind);
}

const config = validateConfig({
  provider,
  execution: { allowReducedIsolation: values['reduced-isolation'] === true },
  referee: {
    executable: process.execPath,
    args: [referee],
    requiredLayers: ['stack', 'architecture', 'baseline'],
  },
  test: { executable: process.execPath, args: ['--test'] },
  budget: { maxModelCalls: 4, timeoutMs: 600000 },
});

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(config, null, 2) + '\n');

const state = dirname(out);
const prefix =
  'pnpm pitcrew --config "' +
  out +
  '" --state "' +
  state +
  '" --repo "' +
  repo +
  '"';
console.log('Wrote trusted config: ' + out);
console.log('State directory:     ' + state);
console.log('');
console.log('Next:');
console.log('  ' + prefix + ' doctor');
console.log('  ' + prefix + ' "fix the failing test"');
console.log('  ' + prefix + ' ui');
if (!config.execution.allowReducedIsolation)
  console.log(
    '\nDocker is required. If it is unavailable, rerun this command with --reduced-isolation to authorize host execution explicitly.',
  );
