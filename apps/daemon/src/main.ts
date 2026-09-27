import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from '@pitcrew/config';
import { startDaemon } from './index.js';

const [configPath, statePath] = process.argv.slice(2);
if (!configPath || !statePath)
  throw new Error('Daemon requires explicit trusted config and state paths.');
const stateRoot = resolve(statePath);
await mkdir(stateRoot, { recursive: true });
const lockPath = join(stateRoot, 'daemon.lock');
try {
  const previous = Number(await readFile(lockPath, 'utf8'));
  if (Number.isInteger(previous) && previous > 0) {
    try {
      process.kill(previous, 0);
      throw new Error('State directory already has a running daemon.');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
        await unlink(lockPath);
      else throw error;
    }
  }
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
const lock = await open(lockPath, 'wx');
await lock.writeFile(String(process.pid));
await lock.close();
let closing = false;
try {
  const daemon = await startDaemon(
    stateRoot,
    await loadConfig(resolve(configPath)),
  );
  process.send?.({ type: 'ready', url: daemon.url, token: daemon.token });
  const close = (): void => {
    if (closing) return;
    closing = true;
    void daemon.close().finally(async () => {
      await unlink(lockPath);
      process.exit(0);
    });
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  process.on('disconnect', close);
} catch {
  await unlink(lockPath);
  process.send?.({
    type: 'error',
    message: 'Daemon startup failed. Check config and state directory.',
  });
  process.exitCode = 1;
}
