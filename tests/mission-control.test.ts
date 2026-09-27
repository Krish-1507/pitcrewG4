import { expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MissionControl } from '../packages/mission-runtime/src/mission-control.js';
import type { MissionEvent } from '../packages/protocol/src/index.js';
import {
  actionHash,
  evaluateEdit,
  evaluateOperation,
} from '../packages/policy-engine/src/index.js';
import { implement } from '../packages/agents/src/index.js';

it('pauses only at a checkpoint and resumes without fabricating completed work', async () => {
  const events: MissionEvent[] = [];
  const control = new MissionControl((event) => events.push(event));
  control.pause();
  expect(events).toEqual([{ type: 'control', action: 'pause_requested' }]);
  let finished = false;
  const pending = control.checkpoint(new AbortController().signal).then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(events.at(-1)).toEqual({ type: 'control', action: 'paused' });
  control.resume();
  await pending;
  expect(finished).toBe(true);
});
it('cancellation unblocks a paused mission', async () => {
  const control = new MissionControl(() => undefined);
  const abort = new AbortController();
  control.pause();
  const pending = control.checkpoint(abort.signal);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
});
it('only an exact pending action hash can be approved, once', async () => {
  const events: MissionEvent[] = [];
  const control = new MissionControl((event) => events.push(event));
  const waiting = control.approval(
    'original',
    'cand_a',
    'artifact',
    'auth edit',
    new AbortController().signal,
  );
  const event = events[0];
  if (event?.type !== 'approval.requested')
    throw new Error('No approval event');
  expect(() => control.resolveApproval(event.id, 'changed', true)).toThrow();
  control.resolveApproval(event.id, 'original', true);
  expect(await waiting).toBe(true);
  expect(() => control.resolveApproval(event.id, 'original', true)).toThrow();
  expect(events.at(-1)).toMatchObject({
    type: 'approval.resolved',
    approved: true,
  });
});
it('cancellation invalidates a pending approval', async () => {
  const events: MissionEvent[] = [];
  const control = new MissionControl((event) => events.push(event));
  const abort = new AbortController();
  const waiting = control.approval(
    'hash',
    'cand_a',
    'artifact',
    'risk',
    abort.signal,
  );
  abort.abort();
  await expect(waiting).rejects.toMatchObject({ code: 'CANCELLED' });
  const event = events[0];
  if (event?.type !== 'approval.requested') throw new Error('No approval');
  expect(() => control.resolveApproval(event.id, 'hash', true)).toThrow();
});
it('approved writes cannot change scope or contents and cannot authorize secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitcrew-approved-'));
  await writeFile(join(root, 'auth.js'), 'before');
  const grant = {
    candidateIdentity: 'digest',
    actions: [actionHash('digest', 'auth.js', 'before', 'after')],
    paths: ['auth.js'],
  };
  await expect(
    implement(
      root,
      {
        summary: 'auth',
        edits: [{ path: 'auth.js', before: 'before', after: 'changed' }],
      },
      [],
      grant,
    ),
  ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
  expect(await readFile(join(root, 'auth.js'), 'utf8')).toBe('before');
  await implement(
    root,
    {
      summary: 'auth',
      edits: [{ path: 'auth.js', before: 'before', after: 'after' }],
    },
    [],
    grant,
  );
  expect(await readFile(join(root, 'auth.js'), 'utf8')).toBe('after');
  await expect(
    implement(
      root,
      {
        summary: 'secret',
        edits: [{ path: '.env', before: '', after: 'test' }],
      },
      [],
      {
        candidateIdentity: 'digest',
        actions: [actionHash('digest', '.env', '', 'test')],
        paths: ['.env'],
      },
    ),
  ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
});

it('classifies authorization edits by content and denies production deployment', () => {
  expect(
    evaluateEdit('src/router.js', 'requireAdmin(user);', 'allow(user);')
      .decision,
  ).toBe('ask');
  expect(evaluateOperation('deploy', 'production').decision).toBe('deny');
  expect(evaluateOperation('read', '.env').decision).toBe('deny');
});
