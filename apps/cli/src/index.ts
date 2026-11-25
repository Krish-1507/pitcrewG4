#!/usr/bin/env node
import { fork, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  validateConfig,
  PROVIDER_PRESETS,
  providerPreset,
  providerConfigFromPreset,
  type ProviderPreset,
} from '@pitcrew/config';
import { missionSchema, type ProviderConfig } from '@pitcrew/protocol';
import { loadSkills } from '@pitcrew/skills';
import { detectHardware, suggestLocalModel } from './hardware.js';
import { probeProviderCatalogue, hardwareSummary } from './provider-setup.js';
import { runInteractiveSession, streamMission } from './session.js';

const options = parseArgs({
  options: {
    config: { type: 'string' },
    state: { type: 'string' },
    repo: { type: 'string' },
    mutations: { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string' },
    'base-url': { type: 'string' },
    'api-key-env': { type: 'string' },
    'reduced-isolation': { type: 'boolean' },
    quick: { type: 'boolean' },
    name: { type: 'string' },
    prompt: { type: 'string' },
    scope: { type: 'string' },
    project: { type: 'string' },
    route: { type: 'string' },
    assistant: { type: 'string' },
    force: { type: 'boolean' },
    yes: { type: 'boolean' },
    'no-open': { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  },
  allowPositionals: true,
});
const useColor =
  Boolean(process.stdout.isTTY) &&
  !options.values.json &&
  !process.env.NO_COLOR;
const ansi = (code: string, text: string): string =>
  useColor
    ? String.fromCharCode(27) +
      '[' +
      code +
      'm' +
      text +
      String.fromCharCode(27) +
      '[0m'
    : text;
const dim = (text: string): string => ansi('2', text);
const bold = (text: string): string => ansi('1', text);
const green = (text: string): string => ansi('32', text);
const red = (text: string): string => ansi('31', text);
const yellow = (text: string): string => ansi('33', text);
const cyan = (text: string): string => ansi('36', text);
const GLYPH: Record<string, string> = {
  phase: '\u25b8',
  evidence: '\u25c6',
  referee: '\u2696',
  'approval.requested': '\u26a0',
  'approval.resolved': '\u2713',
  candidate: '\u25e7',
  'candidate.eliminated': '\u2715',
  'candidate.selected': '\u2605',
  'arena.decision': '\u2442',
  delegation: '\u25cf',
  model: '\u2726',
  assistant: '\u2726',
  control: '\u23ef',
  pause: '\u23f8',
  budget: '\u2314',
  error: '!',
};
type Mission = z.infer<typeof missionSchema>;
type MissionEvent = Mission['events'][number]['event'];
function styledLine(event: MissionEvent): string {
  const glyph = GLYPH[event.type] ?? '·';
  const head = dim(glyph) + ' ' + bold(event.type.padEnd(18));
  switch (event.type) {
    case 'phase':
      return head + ' ' + dim(event.state.padEnd(11)) + ' ' + event.message;
    case 'evidence':
      return (
        head +
        ' ' +
        event.label +
        dim('  exit ' + (event.exitCode === null ? 'n/a' : event.exitCode))
      );
    case 'referee':
      return (
        head +
        ' ' +
        (event.verdict === 'VERIFIED'
          ? green('VERIFIED')
          : red(event.verdict)) +
        ' ' +
        event.message
      );
    case 'approval.requested':
      return head + ' ' + yellow('action required') + dim(' — ') + event.reason;
    case 'approval.resolved':
      return (
        head + ' ' + (event.approved ? green('approved') : red('rejected'))
      );
    case 'candidate':
      return (
        head + ' ' + event.candidate.id + dim(' @ ') + event.candidate.root
      );
    case 'candidate.eliminated':
      return head + ' ' + event.candidateId + dim(' — ') + event.reason;
    case 'candidate.selected':
      return head + ' ' + green(event.candidateId) + dim(' — ') + event.reason;
    case 'arena.decision':
      return (
        head +
        ' ' +
        (event.branch ? 'branch' : 'single-path') +
        dim(' — ') +
        event.reason
      );
    case 'delegation':
      return (
        head +
        ' ' +
        cyan(event.role) +
        dim(' · ') +
        event.status +
        dim(' · ') +
        event.mode
      );
    case 'model':
      return (
        head + ' ' + event.calls + ' call(s)' + dim(' · ' + event.provider)
      );
    case 'assistant':
      return (
        head +
        ' ' +
        event.name +
        dim(
          ' — prompt ' +
            event.promptDigest.slice(0, 12) +
            (event.routeId ? ' — route ' + event.routeId : ''),
        )
      );
    case 'control':
      return head + ' ' + dim(event.action);
    default:
      return head;
  }
}
const version = '0.1.0-dev';
const homeDirectory = resolve(
  process.env.PITCREW_HOME ?? join(homedir(), '.pitcrew'),
);
const defaultConfigPath = (): string => join(homeDirectory, 'config.json');

function daemonEntry(): string {
  const override = process.env.PITCREW_DAEMON;
  if (override) return resolve(override);
  const bundled = fileURLToPath(new URL('./daemon.js', import.meta.url));
  if (existsSync(bundled)) return bundled;
  return fileURLToPath(new URL('../../daemon/dist/main.js', import.meta.url));
}

function bundledUiRoot(): string | undefined {
  const override = process.env.PITCREW_UI_ROOT;
  if (override) return resolve(override);
  const bundled = fileURLToPath(new URL('./desktop/', import.meta.url));
  return existsSync(join(bundled, 'index.html')) ? bundled : undefined;
}

function refereePath(): string {
  const require = createRequire(import.meta.url);
  const candidates = ['openpitstop/dist/cli.js'];
  for (const candidate of candidates) {
    try {
      const entry = require.resolve(candidate);
      if (existsSync(entry)) return entry;
    } catch {
      // Try the next packaged location.
    }
  }
  const local = resolve(
    fileURLToPath(
      new URL('../../../node_modules/openpitstop/dist/cli.js', import.meta.url),
    ),
  );
  if (existsSync(local)) return local;
  throw new Error(
    'OpenPitStop is not installed. Reinstall PitCrew or run "pnpm referee" in a source checkout.',
  );
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32'
      ? 'cmd.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    console.error('Could not open the browser. Open this URL manually:', url);
  });
  child.unref();
}

const providerPresetById = (id: string): ProviderPreset | undefined =>
  PROVIDER_PRESETS.find((preset) => preset.id === id);

function pickPreset(value: string): ProviderPreset | undefined {
  const id = value.toLowerCase();
  const alias: Record<string, string> = {
    claude: 'anthropic',
    chatgpt: 'openai',
    gpt: 'openai',
  };
  return providerPreset(alias[id] ?? id);
}

async function askPreset(
  terminal: Awaited<ReturnType<typeof createInterface>>,
): Promise<ProviderPreset> {
  console.log('Available providers:');
  PROVIDER_PRESETS.forEach((preset, index) => {
    console.log(
      '  ' +
        String(index + 1).padStart(2) +
        '. ' +
        preset.label +
        (preset.note ? dim('  — ' + preset.note) : ''),
    );
  });
  for (;;) {
    const answer = (await terminal.question('Provider number or name [1]: '))
      .trim()
      .toLowerCase();
    if (!answer || answer === '1') return providerPresetById('codex')!;
    const byNumber = Number.parseInt(answer, 10);
    const found = Number.isFinite(byNumber)
      ? PROVIDER_PRESETS[byNumber - 1]
      : pickPreset(answer);
    if (found) return found;
    console.log(
      'Pick a number from the list, or a preset name such as "ollama".',
    );
  }
}

async function setupConfig(
  configPath: string,
  assumeYes: boolean,
): Promise<void> {
  const interactive = Boolean(process.stdin.isTTY) && !assumeYes;
  const terminal = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;
  const ask = async (question: string, fallback: string): Promise<string> => {
    if (!terminal) return fallback;
    const answer = (
      await terminal.question(question + ' [' + fallback + ']: ')
    ).trim();
    return answer || fallback;
  };
  const askYes = async (question: string): Promise<boolean> => {
    if (!terminal) return false;
    const answer = (await terminal.question(question + ' [y/N]: '))
      .trim()
      .toLowerCase();
    return answer === 'y' || answer === 'yes';
  };
  try {
    if (existsSync(configPath) && !options.values.force) {
      if (!terminal) {
        console.error(
          'Configuration already exists at ' +
            configPath +
            '. Pass --force to replace it.',
        );
        return;
      }
      const replace = await askYes(
        'Configuration already exists at ' + configPath + '. Replace it?',
      );
      if (!replace) return;
    }
    const preset = options.values.provider
      ? pickPreset(options.values.provider)
      : interactive
        ? await askPreset(terminal!)
        : providerPresetById('codex')!;
    if (!preset) throw new Error('Unknown provider preset.');
    let provider: ProviderConfig;
    if (preset.id === 'codex') {
      provider = providerConfigFromPreset(preset, {
        ...(options.values.model ? { model: options.values.model } : {}),
      });
    } else {
      let baseUrl = preset.baseUrl;
      if (preset.id === 'custom' || options.values['base-url'])
        baseUrl =
          options.values['base-url'] ??
          (await ask(
            'Provider base URL',
            preset.baseUrl ?? 'http://127.0.0.1:8000/v1',
          ));
      const model =
        options.values.model ?? (await ask('Model', preset.defaultModel));
      let apiKeyEnv = options.values['api-key-env'];
      if (apiKeyEnv === undefined && preset.requiresKey && terminal)
        apiKeyEnv =
          (await ask(
            'API key env var (name only; the key itself is never asked for)',
            preset.keyEnv ?? '',
          )) || undefined;
      provider = providerConfigFromPreset(preset, {
        model,
        ...(apiKeyEnv ? { apiKeyEnv } : {}),
        ...(baseUrl && baseUrl !== preset.baseUrl ? { baseUrl } : {}),
      });
    }
    if (preset.local || preset.id === 'custom') {
      const report = await detectHardware();
      const suggestion = suggestLocalModel(report);
      console.log(
        'Hardware: ' +
          hardwareSummary(report) +
          '\nSuggested local model tier: ' +
          suggestion.tier +
          ' — ' +
          suggestion.reasoning +
          '\nExamples: ' +
          suggestion.models.join(', '),
      );
      const models = await probeProviderCatalogue(provider);
      if (models.length)
        console.log(
          'Detected models at ' +
            ('baseUrl' in provider ? provider.baseUrl : 'the endpoint') +
            ': ' +
            models.slice(0, 12).join(', ') +
            (models.length > 12 ? ' …' : ''),
        );
      else
        console.log(
          'Endpoint not reachable right now; pitcrew doctor will verify it later.',
        );
    }
    const reduced =
      options.values['reduced-isolation'] ??
      (await askYes(
        'Allow host execution when Docker is unavailable (reduced isolation)?',
      ));
    const config = validateConfig({
      provider,
      execution: {
        allowReducedIsolation: reduced,
        dockerExecutable: 'docker',
        image: 'node:22-bookworm-slim',
      },
      referee: {
        executable: process.execPath,
        args: [refereePath()],
        requiredLayers: ['stack', 'architecture', 'baseline'],
      },
      test: { executable: process.execPath, args: ['--test'] },
    });
    await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', {
      mode: 0o600,
    });
    if (options.values.json) return;
    console.log('Wrote ' + configPath);
    console.log('Next: pitcrew app --repo .');
    console.log('Check: pitcrew doctor --json');
  } finally {
    terminal?.close();
  }
}

async function configuredPath(): Promise<string> {
  if (options.values.config) {
    const explicit = resolve(options.values.config);
    if (!existsSync(explicit))
      throw new Error('Configuration not found: ' + explicit);
    return explicit;
  }
  const path = defaultConfigPath();
  if (!existsSync(path)) {
    if (!options.values.json)
      console.log('No configuration found. Starting setup...');
    await setupConfig(path, Boolean(options.values.yes));
    if (!existsSync(path))
      throw new Error('Setup did not create ' + path + '.');
  }
  return path;
}

const commandName = options.positionals[0];
const interactiveSession =
  !options.positionals.length &&
  process.stdin.isTTY &&
  !options.values.json &&
  !options.values.help;
if (
  options.values.help ||
  (!options.positionals.length && !interactiveSession)
) {
  console.log(
    'PITCREW\n\nUsage: pitcrew setup [--provider codex] [--model <name>] [--yes] [--force]\n       pitcrew [--repo .] "<mission>"\n       pitcrew app [--repo .] [--quick]\n       pitcrew quick [--repo .]\n       pitcrew doctor | open | ui | replay <mission> | diff <mission> | certificate <mission>\n       pitcrew research "<query>"\n       pitcrew memory list|add|delete [--repo <path>] [<note>|<id>]\n       pitcrew assistant list|add|delete [--name <name>] [--prompt <text>] [--scope global|project] [--project <id>] [--route <id>] [--model <name>]\n       pitcrew story <project> | skills <dir> | blindspot --repo <path> --mutations <file.json>\n\nConfiguration defaults to ~/.pitcrew/config.json; state defaults to ~/.pitcrew/state.\nPass --config/--state to override. Evidence-backed outcomes: VERIFIED / BLOCKED / NOT PROVEN.\nQuick Assistant output is a draft and is never verification.',
  );
} else if (commandName === 'setup') {
  await setupConfig(
    options.values.config
      ? resolve(options.values.config)
      : defaultConfigPath(),
    Boolean(options.values.yes),
  );
} else {
  const configPath = await configuredPath();
  const statePath = options.values.state
    ? resolve(options.values.state)
    : options.values.config
      ? dirname(configPath)
      : join(homeDirectory, 'state');
  const uiRoot = bundledUiRoot();
  const child = fork(daemonEntry(), [configPath, statePath], {
    execArgv: ['--experimental-sqlite'],
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    env: uiRoot ? { ...process.env, PITCREW_UI_ROOT: uiRoot } : process.env,
  });
  const ready = z.object({
    type: z.literal('ready'),
    url: z.string().url(),
    token: z.string(),
  });
  let missionId: string | undefined;
  const connection = await new Promise<z.infer<typeof ready>>(
    (resolveReady, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Daemon startup timed out.'));
      }, 20000);
      child.once('error', reject);
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('Daemon exited before startup.'));
      });
      child.on('message', (value: unknown) => {
        const parsed = ready.safeParse(value);
        if (parsed.success) {
          clearTimeout(timer);
          resolveReady(parsed.data);
        } else {
          clearTimeout(timer);
          reject(new Error('Daemon configuration failed.'));
        }
      });
    },
  );
  async function api(
    path: string,
    body?: unknown,
    method?: 'GET' | 'POST' | 'DELETE',
    timeoutMs = 30000,
  ): Promise<unknown> {
    const response = await fetch(connection.url + '/v1/' + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        authorization: 'Bearer ' + connection.token,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        'Daemon request failed (' +
          response.status +
          '): ' +
          JSON.stringify(result),
      );
    return result;
  }
  const terminal =
    process.stdin.isTTY && !options.values.json
      ? createInterface({ input: process.stdin, output: process.stdout })
      : undefined;
  terminal?.on('line', (line) => {
    const command = line.trim();
    if (missionId && ['/pause', '/resume', '/cancel'].includes(command))
      void api('missions/' + missionId + '/' + command.slice(1), {}).catch(() =>
        console.error('Control request failed.'),
      );
  });
  const cancel = (): void => {
    if (missionId) void api('missions/' + missionId + '/cancel', {});
    else child.disconnect();
  };
  process.on('SIGINT', cancel);
  try {
    const command = options.positionals[0];
    const projectIdFor = async (repo: string): Promise<string> => {
      const path = resolve(repo);
      const listed = z
        .object({
          projects: z.array(
            z.object({ id: z.string(), root_path: z.string() }),
          ),
        })
        .parse(await api('projects'));
      const found = listed.projects.find(
        (project) => project.root_path.toLowerCase() === path.toLowerCase(),
      );
      if (found) return found.id;
      const opened = z
        .object({ project: z.object({ id: z.string() }) })
        .parse(await api('projects/open', { path }));
      return opened.project.id;
    };
    if (command === 'doctor')
      console.log(JSON.stringify(await api('doctor'), null, 2));
    else if (
      command === 'ui' ||
      command === 'app' ||
      command === 'quick' ||
      options.values.quick
    ) {
      const quickMode = command === 'quick' || Boolean(options.values.quick);
      const url =
        connection.url +
        '/#token=' +
        connection.token +
        (quickMode ? '&quick=1' : '');
      console.log('Mission Control: ' + url);
      if (
        (command === 'app' || command === 'quick') &&
        !options.values['no-open']
      )
        openBrowser(url);
      console.log('Press Ctrl+C to stop the daemon.');
      await new Promise<void>((hold) => {
        const release = (): void => {
          child.removeListener('exit', release);
          hold();
        };
        child.once('exit', release);
        process.once('SIGINT', release);
      });
    } else if (command === 'research') {
      const query = options.positionals.slice(1).join(' ').trim();
      if (!query) throw new Error('A search query is required.');
      console.log(
        JSON.stringify(
          await api('research', { query }, 'POST', 30000),
          null,
          2,
        ),
      );
    } else if (command === 'memory') {
      const action = options.positionals[1];
      if (action === 'list') {
        const projectId = options.values.repo
          ? await projectIdFor(options.values.repo)
          : undefined;
        console.log(
          JSON.stringify(
            await api('memory' + (projectId ? '?project_id=' + projectId : '')),
            null,
            2,
          ),
        );
      } else if (action === 'add') {
        const text = options.positionals.slice(2).join(' ').trim();
        if (!text) throw new Error('A memory note is required.');
        const projectId = options.values.repo
          ? await projectIdFor(options.values.repo)
          : undefined;
        console.log(
          JSON.stringify(
            await api('memory', {
              text,
              scope: projectId ? 'project' : 'global',
              ...(projectId ? { project_id: projectId } : {}),
            }),
            null,
            2,
          ),
        );
      } else if (action === 'delete') {
        const id = options.positionals[2];
        if (!id || !/^mem_[a-f0-9-]+$/.test(id))
          throw new Error('A valid memory note ID is required.');
        console.log(
          JSON.stringify(await api('memory/' + id, undefined, 'DELETE')),
        );
      } else throw new Error('Use memory list, memory add, or memory delete.');
    } else if (command === 'assistants') {
      console.log(JSON.stringify(await api('assistants'), null, 2));
    } else if (command === 'assistant') {
      const action = options.positionals[1];
      if (action === 'list') {
        console.log(JSON.stringify(await api('assistants'), null, 2));
      } else if (action === 'add') {
        const name = options.values.name ?? options.positionals[2];
        const prompt =
          options.values.prompt ??
          (options.values.name
            ? options.positionals.slice(2).join(' ')
            : options.positionals.slice(3).join(' '));
        if (!name || !prompt)
          throw new Error(
            'Assistant add requires a name and prompt via --name/--prompt or positional arguments.',
          );
        const scope = options.values.scope ?? 'global';
        if (!['global', 'project'].includes(scope))
          throw new Error('--scope must be global or project.');
        if (scope === 'project' && !options.values.project)
          throw new Error('Project assistants require --project <id>.');
        console.log(
          JSON.stringify(
            await api('assistants', {
              name,
              prompt,
              scope,
              ...(options.values.project
                ? { project_id: options.values.project }
                : {}),
              ...(options.values.route
                ? { route_id: options.values.route }
                : {}),
              ...(options.values.model ? { model: options.values.model } : {}),
            }),
            null,
            2,
          ),
        );
      } else if (action === 'delete') {
        const id = options.positionals[2];
        if (!id || !/^ast_[a-f0-9-]+$/.test(id))
          throw new Error('A valid assistant ID is required.');
        console.log(
          JSON.stringify(await api('assistants/' + id, undefined, 'DELETE')),
        );
      } else
        throw new Error(
          'Use assistant list, assistant add, or assistant delete.',
        );
    } else if (command === 'blindspot') {
      if (!options.values.mutations)
        throw new Error(
          'Pass --mutations with a JSON array of controlled mutations.',
        );
      const mutations: unknown = JSON.parse(
        await readFile(resolve(options.values.mutations), 'utf8'),
      );
      console.log(
        JSON.stringify(
          await api('blindspot', {
            repo: resolve(options.values.repo ?? '.'),
            mutations,
          }),
          null,
          2,
        ),
      );
    } else if (command === 'story') {
      const id = options.positionals[1];
      if (!id || !/^prj_[a-f0-9-]+$/.test(id))
        throw new Error('A valid project ID is required.');
      console.log(
        JSON.stringify(await api('projects/' + id + '/story'), null, 2),
      );
    } else if (command === 'skills') {
      const skills = await loadSkills(
        resolve(options.positionals[1] ?? 'skills'),
      );
      console.log(
        JSON.stringify(
          skills.map((skill) => skill.manifest),
          null,
          2,
        ),
      );
    } else if (command === 'open')
      console.log(
        JSON.stringify(
          await api('projects/open', {
            path: resolve(options.values.repo ?? '.'),
          }),
          null,
          2,
        ),
      );
    else if (
      command === 'replay' ||
      command === 'diff' ||
      command === 'certificate'
    ) {
      const id = options.positionals[1];
      if (!id || !/^mis_[a-f0-9-]+$/.test(id))
        throw new Error('A valid mission ID is required.');
      console.log(
        JSON.stringify(
          await api(
            'missions/' + id + (command === 'replay' ? '' : '/' + command),
          ),
          null,
          2,
        ),
      );
    } else {
      if (interactiveSession) {
        await runInteractiveSession({
          api,
          terminal: terminal!,
          missionControlUrl: connection.url + '/#token=' + connection.token,
          openApp: () =>
            openBrowser(connection.url + '/#token=' + connection.token),
          runMission: (request) =>
            streamMission({
              api,
              styledLine,
              paint: { bold, dim, green, red, yellow },
              terminal: terminal ?? null,
              jsonMode: false,
              request,
              repo: resolve(options.values.repo ?? '.'),
              ...(options.values.assistant
                ? { assistantId: options.values.assistant }
                : {}),
            }).then((run) => {
              missionId = run.missionId;
            }),
          version,
        });
      } else {
        await streamMission({
          api,
          styledLine,
          paint: { bold, dim, green, red, yellow },
          terminal: terminal ?? null,
          jsonMode: Boolean(options.values.json),
          request: options.positionals.join(' '),
          repo: resolve(options.values.repo ?? '.'),
          ...(options.values.assistant
            ? { assistantId: options.values.assistant }
            : {}),
        }).then((run) => {
          missionId = run.missionId;
        });
      }
    }
  } finally {
    terminal?.close();
    process.removeListener('SIGINT', cancel);
    if (child.connected) child.disconnect();
  }
}
