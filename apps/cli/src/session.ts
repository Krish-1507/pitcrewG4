import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { missionSchema } from '@pitcrew/protocol';

type MissionEvent = z.infer<typeof missionSchema>['events'][number]['event'];

export type Api = (
  path: string,
  body?: unknown,
  method?: 'GET' | 'POST' | 'DELETE',
  timeoutMs?: number,
) => Promise<unknown>;

export interface TerminalLike {
  question(question: string): Promise<string>;
  close(): void;
}

export interface MissionRun {
  missionId?: string;
}

const terminalHelp =
  'Session commands:\n' +
  '  /help                 show this help\n' +
  '  /app                  open Mission Control in the browser\n' +
  '  /quick <text>         one bounded Quick Assistant draft (never verification)\n' +
  '  /research <query>     run a web search now\n' +
  '  /memory add <note>    save a global memory note\n' +
  '  /memory list          list memory notes\n' +
  '  /doctor               check Git, Docker, referee and provider state\n' +
  '  /providers            show configured providers and routes\n' +
  '  /skills               list installed skills\n' +
  '  /story <projectId>    read-only Repo Story for a project\n' +
  '  /open                 open the current directory as a project\n' +
  '  /exit                 leave the session\n' +
  'Anything else starts a mission on an isolated candidate branch.';

/** Stream one mission to completion, printing events and handling approvals. */
export async function streamMission(deps: {
  api: Api;
  styledLine: (event: MissionEvent) => string;
  paint: {
    bold(value: string): string;
    dim(value: string): string;
    green(value: string): string;
    red(value: string): string;
    yellow(value: string): string;
  };
  terminal: TerminalLike | null;
  jsonMode: boolean;
  request: string;
  repo: string;
  assistantId?: string;
}): Promise<MissionRun> {
  const { api, styledLine, paint, terminal, jsonMode } = deps;
  const created = z.object({ mission_id: z.string() }).parse(
    await api('missions', {
      repo: deps.repo,
      request: deps.request,
      ...(deps.assistantId ? { assistant_id: deps.assistantId } : {}),
    }),
  );
  const missionId = created.mission_id;
  if (!jsonMode)
    console.log(
      '\n' +
        paint.bold('PITCREW') +
        paint.dim('  mission control') +
        '\n ' +
        deps.request +
        '\n' +
        paint.dim(' mission ') +
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
          paint.yellow('\n ⚠ Approval required') +
            paint.dim(' — ') +
            approval.reason +
            '\n ' +
            paint.dim('action hash ') +
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
      if (jsonMode) console.log(JSON.stringify(item));
      else console.log(' ' + styledLine(item.event));
    }
    if (
      ['VERIFIED', 'BLOCKED', 'NOT_PROVEN', 'CANCELLED'].includes(mission.state)
    ) {
      if (!jsonMode) {
        const verdictColor =
          mission.state === 'VERIFIED'
            ? paint.green
            : mission.state === 'BLOCKED'
              ? paint.red
              : paint.yellow;
        const lines = [
          '',
          ' ' + verdictColor(paint.bold(mission.state.replace('_', ' '))),
          ' ' + mission.message,
        ];
        if (mission.candidate) {
          lines.push(paint.dim(' candidate ') + mission.candidate.root);
          lines.push(paint.dim(' inspect   ') + 'pitcrew diff ' + mission.id);
        }
        console.log(lines.join('\n') + '\n');
      }
      process.exitCode =
        mission.state === 'VERIFIED' ? 0 : mission.state === 'BLOCKED' ? 1 : 2;
      break;
    }
    await delay(300);
  }
  return { missionId };
}

export interface SessionCommand {
  command: string;
  rest: string;
}

/** Split a session line into a command and its argument text. Slash
 * commands are case-sensitive keywords; anything else is a mission. */
export function parseSessionCommand(line: string): SessionCommand {
  if (line.startsWith('/')) {
    const split = line.indexOf(' ');
    const command = split === -1 ? line : line.slice(0, split);
    return {
      command: command.toLowerCase(),
      rest: line.slice(command.length).trimStart(),
    };
  }
  return { command: 'task', rest: line };
}

const quickResult = z.object({
  answer: z.string(),
  provider: z.string(),
  research_query: z.string().nullable().optional(),
  sources: z
    .array(
      z.object({ title: z.string(), url: z.string(), description: z.string() }),
    )
    .max(8),
});

const searchResult = z.object({
  provider: z.string(),
  results: z
    .array(
      z.object({ title: z.string(), url: z.string(), description: z.string() }),
    )
    .max(8),
});

/** Interactive OpenCode-style session: type a task or a slash command. */
export async function runInteractiveSession(deps: {
  api: Api;
  terminal: TerminalLike;
  missionControlUrl: string;
  openApp: () => void;
  runMission: (request: string) => Promise<void>;
  version: string;
}): Promise<void> {
  const { api, terminal } = deps;
  console.log(
    'PitCrew ' +
      deps.version +
      ' — local-first AI engineering crew. Type a task, or /help for commands.\n' +
      'Outcomes are decided by the independent OpenPitStop referee, never by a model.\n',
  );
  for (;;) {
    let line: string;
    try {
      line = (await terminal.question('› ')).trim();
    } catch {
      break;
    }
    if (!line) continue;
    const input = parseSessionCommand(line);
    const command = input.command;
    const rest = input.rest;
    if (command === '/exit' || command === '/quit' || command === '/q') break;
    if (command === '/help') {
      console.log('\n' + terminalHelp + '\n');
      continue;
    }
    if (command === '/app') {
      deps.openApp();
      console.log('Mission Control: ' + deps.missionControlUrl);
      continue;
    }
    if (command === '/quick') {
      const text = rest;
      if (!text) {
        console.log('Usage: /quick <text>');
        continue;
      }
      try {
        const result = quickResult.parse(
          await api('quick', { text, preset: 'explain' }, 'POST', 150000),
        );
        console.log(
          '\n' + result.answer + '\n' + ' provider ' + result.provider,
        );
        if (result.research_query)
          console.log(' research “' + result.research_query + '”');
        for (const source of result.sources)
          console.log('  • ' + source.title + ' — ' + source.url);
        console.log(' draft only — never verification\n');
      } catch (error) {
        console.log('Quick assistant failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/research') {
      const query = rest;
      if (!query) {
        console.log('Usage: /research <query>');
        continue;
      }
      try {
        const result = searchResult.parse(
          await api('research', { query }, 'POST', 30000),
        );
        console.log(' provider ' + result.provider);
        for (const source of result.results)
          console.log('  • ' + source.title + ' — ' + source.url);
        console.log('');
      } catch (error) {
        console.log('Research failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/memory') {
      const action = rest.split(/\s+/)[0] ?? '';
      try {
        if (action === 'add') {
          const note = rest.slice(action.length).trim();
          if (!note) {
            console.log('Usage: /memory add <note>');
            continue;
          }
          await api('memory', { text: note, scope: 'global' }, 'POST');
          console.log('Memory note saved.\n');
        } else if (action === 'list' || action === '') {
          const listed = z
            .object({
              notes: z.array(z.object({ id: z.string(), text: z.string() })),
            })
            .parse(await api('memory'));
          if (!listed.notes.length) console.log('No memory notes.\n');
          for (const note of listed.notes)
            console.log(' ' + note.id + '  ' + note.text);
          console.log('');
        } else console.log('Usage: /memory add <note> | /memory list\n');
      } catch (error) {
        console.log('Memory failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/doctor') {
      try {
        console.log(JSON.stringify(await api('doctor'), null, 2) + '\n');
      } catch (error) {
        console.log('Doctor failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/providers') {
      try {
        const listed = z
          .object({
            configured: z.array(
              z.object({
                id: z.string(),
                provider: z
                  .object({ type: z.string(), model: z.string() })
                  .passthrough(),
              }),
            ),
          })
          .passthrough()
          .parse(await api('providers'));
        if (!listed.configured.length) console.log('No configured routes.\n');
        for (const provider of listed.configured)
          console.log(
            ' ' +
              provider.id +
              '  ' +
              provider.provider.type +
              '  ' +
              (provider.provider.model ?? ''),
          );
        console.log('');
      } catch (error) {
        console.log('Providers failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/skills') {
      try {
        const listed = z
          .object({
            skills: z.array(
              z.object({ name: z.string(), description: z.string() }),
            ),
          })
          .parse(await api('skills'));
        if (!listed.skills.length) console.log('No skills installed.\n');
        for (const skill of listed.skills)
          console.log(' ' + skill.name + ' — ' + skill.description);
        console.log('');
      } catch (error) {
        console.log('Skills failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/open') {
      try {
        const opened = z
          .object({
            project: z.object({ id: z.string(), root_path: z.string() }),
          })
          .passthrough()
          .parse(await api('projects/open', { path: process.cwd() }, 'POST'));
        console.log(
          'Project ' +
            opened.project.id +
            ' at ' +
            opened.project.root_path +
            '\n',
        );
      } catch (error) {
        console.log('Open failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command === '/story') {
      const id = rest;
      if (!/^prj_[a-f0-9-]+$/.test(id)) {
        console.log('Usage: /story <projectId> (see /open for the id)');
        continue;
      }
      try {
        console.log(
          JSON.stringify(await api('projects/' + id + '/story'), null, 2),
        );
      } catch (error) {
        console.log('Story failed: ' + message(error) + '\n');
      }
      continue;
    }
    if (command.startsWith('/')) {
      console.log(
        'Unknown command ' + command + '. Type /help for commands.\n',
      );
      continue;
    }
    try {
      await deps.runMission(rest);
    } catch (error) {
      console.log('Mission failed: ' + message(error) + '\n');
    }
  }
  console.log('Session ended.');
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
