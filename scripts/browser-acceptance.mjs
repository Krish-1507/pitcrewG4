import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runBrowserScenario } from '../packages/browser-lab/dist/index.js';

const base = join(process.cwd(), 'fixtures', 'browser-recovery');
const scenarioTemplate = JSON.parse(
  await readFile(join(base, 'scenario.json'), 'utf8'),
);

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      if (request.method === 'POST' && request.url === '/api/checkout') {
        await new Promise((done) => setTimeout(done, 250));
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'seeded payment failure' }));
        return;
      }
      const path = (request.url ?? '/').split('?')[0];
      try {
        const body = await readFile(
          join(root, path === '/' ? 'index.html' : path),
        );
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end('not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        url: 'http://127.0.0.1:' + address.port + '/',
      });
    });
  });
}

const results = {};
let failed = false;
for (const variant of ['bug', 'fixed']) {
  const { server, url } = await startServer(join(base, variant));
  const scenario = {
    ...scenarioTemplate,
    url,
    steps: scenarioTemplate.steps.map((step) => ({ ...step })),
  };
  const attempts = [];
  for (let attempt = 0; attempt < (variant === 'bug' ? 2 : 1); attempt += 1) {
    try {
      const result = await runBrowserScenario({
        scenario,
        mode: 'headless',
        artifactDir: join(
          process.cwd(),
          '.pitcrew',
          'browser-acceptance',
          variant + '-' + (attempt + 1),
        ),
        signal: AbortSignal.timeout(90000),
      });
      attempts.push({ ok: true, checks: result.checks, trace: result.trace });
    } catch (error) {
      attempts.push({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  server.close();
  results[variant] = attempts;
  if (variant === 'bug') {
    const reproduced = attempts.filter(
      (attempt) =>
        attempt.ok === false && attempt.message.includes('Payment failed'),
    );
    if (reproduced.length !== 2) {
      failed = true;
      console.error('DEFECT_NOT_REPRODUCED', JSON.stringify(results, null, 2));
    }
  } else if (attempts[0]?.ok !== true) {
    failed = true;
    console.error('FIX_NOT_VERIFIED', JSON.stringify(results, null, 2));
  }
}
console.log(JSON.stringify(results, null, 2));
process.exitCode = failed ? 1 : 0;
