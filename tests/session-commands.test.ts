import { expect, it } from 'vitest';
import { parseSessionCommand } from '../apps/cli/src/session.js';

it('routes slash commands, mission text and mixed-case input in the interactive session', () => {
  expect(parseSessionCommand('/help')).toEqual({ command: '/help', rest: '' });
  expect(parseSessionCommand('/quick explain closures')).toEqual({
    command: '/quick',
    rest: 'explain closures',
  });
  expect(parseSessionCommand('/memory add   use pnpm ')).toEqual({
    command: '/memory',
    rest: 'add   use pnpm ',
  });
  // Command keywords are lower-cased; the mission text keeps its case.
  expect(parseSessionCommand('/RESEARCH Node 22 APIs')).toEqual({
    command: '/research',
    rest: 'Node 22 APIs',
  });
  // Anything without a leading slash is a mission request.
  expect(parseSessionCommand('fix the failing test')).toEqual({
    command: 'task',
    rest: 'fix the failing test',
  });
  // Unknown slash commands are preserved verbatim for the handler to reject.
  expect(parseSessionCommand('/deploy production')).toEqual({
    command: '/deploy',
    rest: 'production',
  });
});
