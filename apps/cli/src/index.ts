#!/usr/bin/env node
import { fork } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { missionSchema } from '@pitcrew/protocol';
import { loadSkills } from '@pitcrew/skills';

const options = parseArgs({
  options: {
    config: { type: 'string' },
    state: { type: 'string' },
    repo: { type: 'string' },
    mutations: { type: 'string' },
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
    case 'control':
      return head + ' ' + dim(event.action);
    default:
      return head;
  }
}
if (options.values.help || !options.positionals.length) {
  console.log(
    'PITCREW\n\nUsage: pitcrew --config <trusted.json> [--repo .] [--state .pitcrew] "<mission>"\n       pitcrew --config <trusted.json> doctor | open | ui | replay <mission> | diff <mission> | certificate <mission>\n       pitcrew --config <trusted.json> story <project> | skills <dir> | blindspot --repo <path> --mutations <file.json>\n\nEvidence-backed outcomes: VERIFIED / BLOCKED / NOT PROVEN.\nDevelopment P0: explicit provider and execution configuration required.',
  );
} else {
  if (!options.values.config)
    throw new Error('Pass --config with a trusted runtime configuration file.');
  const child = fork(
    fileURLToPath(new URL('../../daemon/dist/main.js', import.meta.url)),
    [
      resolve(options.values.config),
      resolve(options.values.state ?? '.pitcrew'),
    ],
    {
      execArgv: ['--experimental-sqlite'],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
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
  async function api(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(connection.url + '/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: 'Bearer ' + connection.token,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
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
    if (command === 'doctor')
      console.log(JSON.stringify(await api('doctor'), null, 2));
    else if (command === 'ui') {
      console.log(
        'Mission Control: ' + connection.url + '/#token=' + connection.token,
      );
      console.log('Press Ctrl+C to stop the daemon.');
      await new Promise<void>((hold) => {
        const release = (): void => {
          child.removeListener('exit', release);
          hold();
        };
        child.once('exit', release);
        process.once('SIGINT', release);
      });
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
      const created = z.object({ mission_id: z.string() }).parse(
        await api('missions', {
          repo: resolve(options.values.repo ?? '.'),
          request: options.positionals.join(' '),
        }),
      );
      missionId = created.mission_id;
      if (!options.values.json)
        console.log(
          '\n' +
            bold('PITCREW') +
            dim('  mission control') +
            '\n ' +
            options.positionals.join(' ') +
            '\n' +
            dim(' mission ') +
            missionId +
            '\n',
        );
      let seen = 0;
      for (;;) {
        const mission = missionSchema.parse(await api('missions/' + missionId));
        for (const item of mission.events.filter((e) => e.sequence > seen)) {
          seen = item.sequence;
          if (item.event.type === 'approval.requested') {
            const approval = item.event;
            console.log(
              yellow('\n ⚠ Approval required') +
                dim(' — ') +
                approval.reason +
                '\n ' +
                dim('action hash ') +
                approval.hash,
            );
            console.log(
              z
                .object({ content: z.string() })
                .parse(await api('artifacts/' + approval.artifact)).content,
            );
            const answer = terminal
              ? await terminal.question(
                  'Approve this exact candidate-only change? Type approve: ',
                )
              : 'reject';
            await api('approvals/' + approval.id, {
              decision: answer.trim() === 'approve' ? 'approve' : 'reject',
              action_hash: approval.hash,
            });
          }
          if (options.values.json) console.log(JSON.stringify(item));
          else console.log(' ' + styledLine(item.event));
        }
        if (
          ['VERIFIED', 'BLOCKED', 'NOT_PROVEN', 'CANCELLED'].includes(
            mission.state,
          )
        ) {
          if (!options.values.json) {
            const verdictColor =
              mission.state === 'VERIFIED'
                ? green
                : mission.state === 'BLOCKED'
                  ? red
                  : yellow;
            const lines = [
              '',
              ' ' + verdictColor(bold(mission.state.replace('_', ' '))),
              ' ' + mission.message,
            ];
            if (mission.candidate) {
              lines.push(dim(' candidate ') + mission.candidate.root);
              lines.push(
                dim(' inspect   ') +
                  'pitcrew --config <config> --state <state> diff ' +
                  mission.id,
              );
            }
            console.log(lines.join('\n') + '\n');
          }
          process.exitCode =
            mission.state === 'VERIFIED'
              ? 0
              : mission.state === 'BLOCKED'
                ? 1
                : 2;
          break;
        }
        await delay(300);
      }
    }
  } finally {
    terminal?.close();
    process.removeListener('SIGINT', cancel);
    if (child.connected) child.disconnect();
  }
}
