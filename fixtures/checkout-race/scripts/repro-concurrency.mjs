// Concurrency reproduction: N independent OS processes submit the same
// checkout key at once. All workers are spawned first, then released
// together with a small per-worker start offset. The offsets keep every
// check-then-act window overlapped but no two check-phase reads coincident,
// so an unguarded check-then-act implementation deterministically appends
// duplicates while a correctly locked one still yields exactly one order.
// Exit 0 only when exactly one order exists; exit 1 otherwise.
// Usage: node scripts/repro-concurrency.mjs <store|auto> <key> <parallelism>
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { countOrders } from '../src/checkout.js';

let store = process.argv[2];
const key = process.argv[3];
const parallelism = Number(process.argv[4] ?? 6);
if (!store || !key || !Number.isInteger(parallelism) || parallelism < 2) {
  console.error(
    'Usage: repro-concurrency.mjs <store|auto> <key> <parallelism>=6',
  );
  process.exit(2);
}
// A hermetic store keeps repeated runs (baseline vs candidate) independent.
if (store === 'auto') store = join(tmpdir(), `repro-${randomUUID()}.json`);

const checkoutUrl = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'checkout.js'),
).href;
const gateDir = await mkdtemp(join(tmpdir(), 'checkout-gate-'));
const gate = join(gateDir, 'go');

function workerScript(index) {
  // Static imports resolve while the worker is parked at the gate, so every
  // worker starts its check phase hot and only the explicit offsets differ.
  return [
    `import { access } from 'node:fs/promises';`,
    `import { createOrder } from ${JSON.stringify(checkoutUrl)};`,
    `for (let i = 0; i < 600; i++) {`,
    `  try { await access(${JSON.stringify(gate)}); break; } catch { await new Promise((r) => setTimeout(r, 10)); }`,
    `}`,
    // Staggered starts overlap the race windows without coinciding reads.
    `await new Promise((r) => setTimeout(r, ${index * 40}));`,
    `await createOrder(${JSON.stringify(store)}, ${JSON.stringify(key)});`,
  ].join('\n');
}

const children = [];
for (let i = 0; i < parallelism; i++) {
  children.push(
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--input-type=module', '-e', workerScript(i)],
        { stdio: 'ignore', windowsHide: true },
      );
      child.once('error', reject);
      child.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error('worker exited with ' + code)),
      );
    }),
  );
}
// Release every worker together once all of them are waiting at the gate.
await setTimeout(1500);
await writeFile(gate, 'go');

try {
  await Promise.all(children);
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(2);
}
let total = -1;
try {
  total = await countOrders(store, key);
} catch {
  // Concurrent blind writes can interleave into an unreadable store. That is
  // itself the defect under reproduction: one checkout must yield one order.
  console.log('orders=unreadable(store corrupt)');
  process.exit(1);
}
console.log(`orders=${total}`);
process.exit(total === 1 ? 0 : 1);
