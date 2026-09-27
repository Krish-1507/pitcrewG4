import { spawn } from 'node:child_process';
import { lstat, realpath, access } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep, delimiter } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PitCrewError } from '@pitcrew/protocol';
import type { Command, RuntimeConfig } from '@pitcrew/protocol';

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}
export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  signal: AbortSignal;
  input?: string;
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
}
export function cleanEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'WINDIR',
    'COMSPEC',
    'PATHEXT',
    'TEMP',
    'TMP',
    'TMPDIR',
    'LANG',
  ]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    NO_COLOR: '1',
    CI: 'true',
  };
}
export async function runProcess(
  command: Command,
  options: ProcessOptions,
): Promise<ProcessResult> {
  options.signal.throwIfAborted();
  if (/\.(cmd|bat)$/i.test(command.executable))
    throw new PitCrewError(
      'CONFIGURATION',
      'Use a native executable or node plus a script path, not a shell wrapper.',
    );
  const executable = await trustedExecutable(command.executable);
  const start = Date.now();
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, command.args, {
      cwd: options.cwd,
      env: options.env ?? cleanEnvironment(),
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let failure: PitCrewError | undefined;
    let killPromise: Promise<void> | undefined;
    const kill = (): Promise<void> => {
      if (killPromise) return killPromise;
      killPromise = new Promise((done) => {
        if (!child.pid) {
          done();
          return;
        }
        if (process.platform === 'win32') {
          const killer = spawn(
            join(
              process.env.SystemRoot ?? 'C:\\Windows',
              'System32',
              'taskkill.exe',
            ),
            ['/PID', String(child.pid), '/T', '/F'],
            {
              shell: false,
              windowsHide: true,
              stdio: 'ignore',
              env: cleanEnvironment(),
            },
          );
          const killTimeout = setTimeout(() => {
            failure = new PitCrewError(
              'SANDBOX_FAILED',
              'Operating system refused process-tree termination; descendant cleanup could not be confirmed.',
            );
            killer.kill();
            child.kill();
            child.stdout.destroy();
            child.stderr.destroy();
            done();
          }, 5000);
          killer.once('error', () => {
            clearTimeout(killTimeout);
            failure = new PitCrewError(
              'SANDBOX_FAILED',
              'Process-tree termination could not be started.',
            );
            child.kill();
            done();
          });
          killer.once('close', (code) => {
            clearTimeout(killTimeout);
            if (code !== 0) {
              failure = new PitCrewError(
                'SANDBOX_FAILED',
                'Process-tree termination failed.',
              );
              child.kill();
            }
            done();
          });
        } else {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
          done();
        }
      });
      return killPromise;
    };
    const stop = (
      code: 'TIMEOUT' | 'CANCELLED' | 'TOOL_ENVIRONMENT_FAILED',
      message: string,
    ): void => {
      failure ??= new PitCrewError(code, message);
      void kill();
    };
    const timer = setTimeout(
      () => stop('TIMEOUT', 'Process deadline exceeded.'),
      options.timeoutMs,
    );
    const abort = (): void => stop('CANCELLED', 'Mission cancelled.');
    options.signal.addEventListener('abort', abort, { once: true });
    const collect = (data: Buffer, stream: 'stdout' | 'stderr'): void => {
      bytes += data.length;
      if (bytes > (options.maxOutputBytes ?? 1048576)) {
        stop('TOOL_ENVIRONMENT_FAILED', 'Process exceeded output limit.');
        return;
      }
      if (stream === 'stdout') stdout += data.toString('utf8');
      else stderr += data.toString('utf8');
    };
    child.stdout.on('data', (data: Buffer) => collect(data, 'stdout'));
    child.stderr.on('data', (data: Buffer) => collect(data, 'stderr'));
    child.stdin.on('error', () => {
      /* Early child exit is handled by close. */
    });
    const cleanup = (): void => {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', abort);
    };
    child.once('error', () => {
      cleanup();
      reject(
        new PitCrewError(
          'TOOL_ENVIRONMENT_FAILED',
          'Executable could not be started. Check the configured executable path.',
        ),
      );
    });
    child.once('close', (exitCode) => {
      cleanup();
      void (async () => {
        if (killPromise) await killPromise;
        if (failure) reject(failure);
        else
          resolveResult({
            exitCode,
            stdout,
            stderr,
            durationMs: Date.now() - start,
          });
      })();
    });
    child.stdin.end(options.input);
  });
}
export async function resolveInside(
  root: string,
  path: string,
): Promise<string> {
  if (
    !path ||
    isAbsolute(path) ||
    /[\\:]/.test(path) ||
    [...path].some((character) => character.charCodeAt(0) < 32)
  )
    throw new PitCrewError(
      'POLICY_DENIED',
      'Invalid repository-relative path.',
    );
  const parts = path.split('/');
  if (
    parts.some(
      (p) =>
        !p ||
        p === '.' ||
        p === '..' ||
        /[. ]$/.test(p) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
    )
  )
    throw new PitCrewError('POLICY_DENIED', 'Unsafe path component.');
  const base = await realpath(root);
  const target = resolve(base, ...parts);
  if (relative(base, target).startsWith('..' + sep))
    throw new PitCrewError('POLICY_DENIED', 'Path escapes candidate.');
  let current = base;
  for (const part of parts) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
        throw new PitCrewError(
          'POLICY_DENIED',
          'Links and special files are outside the tool scope.',
        );
      const actual = await realpath(current);
      if (actual !== base && relative(base, actual).startsWith('..' + sep))
        throw new PitCrewError('POLICY_DENIED', 'Path escapes candidate.');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        break;
      throw error;
    }
  }
  return target;
}
export async function runSandbox(
  command: Command,
  root: string,
  config: RuntimeConfig['execution'],
  options: Omit<ProcessOptions, 'cwd'>,
): Promise<ProcessResult & { isolation: 'docker' | 'reduced' }> {
  let docker = false;
  try {
    docker =
      (
        await runProcess(
          {
            executable: config.dockerExecutable,
            args: ['info', '--format', '{{.ServerVersion}}'],
          },
          { cwd: root, timeoutMs: 10000, signal: options.signal },
        )
      ).exitCode === 0;
  } catch (error) {
    if (options.signal.aborted) throw error;
  }
  if (!docker) {
    if (!config.allowReducedIsolation)
      throw new PitCrewError(
        'SANDBOX_FAILED',
        'Docker unavailable. Explicit reduced-isolation approval is required.',
      );
    return {
      ...(await runProcess(command, { ...options, cwd: root })),
      isolation: 'reduced',
    };
  }
  const name = 'pitcrew-' + randomUUID();
  try {
    return {
      ...(await runProcess(
        {
          executable: config.dockerExecutable,
          args: [
            'run',
            '--rm',
            '--name',
            name,
            '--network',
            'none',
            '--cap-drop',
            'ALL',
            '--security-opt',
            'no-new-privileges',
            '--cpus',
            '2',
            '--memory',
            '1g',
            '--pids-limit',
            '128',
            '--read-only',
            '--user',
            '65534:65534',
            '--tmpfs',
            '/tmp:rw,nosuid,size=256m',
            '--mount',
            `type=bind,source=${root},target=/workspace`,
            '--workdir',
            '/workspace',
            config.image,
            command.executable,
            ...command.args,
          ],
        },
        { ...options, cwd: root },
      )),
      isolation: 'docker',
    };
  } finally {
    await runProcess(
      { executable: config.dockerExecutable, args: ['rm', '--force', name] },
      { cwd: root, signal: new AbortController().signal, timeoutMs: 10000 },
    ).catch(() => undefined);
  }
}

async function trustedExecutable(name: string): Promise<string> {
  if (isAbsolute(name)) return name;
  if (name === 'node') return process.execPath;
  if (/[\\/]/.test(name))
    throw new PitCrewError(
      'CONFIGURATION',
      'Executable must be absolute or a PATH name.',
    );
  const extensions = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const directory of (process.env.PATH ?? process.env.Path ?? '').split(
    delimiter,
  )) {
    if (!isAbsolute(directory)) continue;
    for (const extension of extensions) {
      const path = join(directory, name + extension);
      try {
        await access(path);
        if ((await lstat(path)).isFile()) return path;
      } catch {
        /* Continue through trusted PATH only, never candidate cwd. */
      }
    }
  }
  throw new PitCrewError(
    'TOOL_ENVIRONMENT_FAILED',
    'Executable not found on trusted PATH: ' + name,
  );
}
