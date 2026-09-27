import { randomUUID } from 'node:crypto';
import { PitCrewError } from '@pitcrew/protocol';
import type { MissionEvent } from '@pitcrew/protocol';

export class MissionControl {
  private pauseRequested = false;
  private resumeWaiter: (() => void) | undefined;
  private pending = new Map<
    string,
    { hash: string; resolve: (approved: boolean) => void }
  >();
  constructor(private readonly emit: (event: MissionEvent) => void) {}
  pause(): void {
    if (this.pauseRequested) return;
    this.pauseRequested = true;
    this.emit({ type: 'control', action: 'pause_requested' });
  }
  resume(): void {
    if (!this.pauseRequested) return;
    this.pauseRequested = false;
    this.emit({ type: 'control', action: 'resumed' });
    this.resumeWaiter?.();
    this.resumeWaiter = undefined;
  }
  async checkpoint(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (!this.pauseRequested) return;
    this.emit({ type: 'control', action: 'paused' });
    await new Promise<void>((resolve, reject) => {
      const abort = (): void => {
        this.resumeWaiter = undefined;
        reject(new PitCrewError('CANCELLED', 'Interrupted while paused.'));
      };
      this.resumeWaiter = () => {
        signal.removeEventListener('abort', abort);
        resolve();
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  async approval(
    hash: string,
    candidateId: string,
    artifact: string,
    reason: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    signal.throwIfAborted();
    const id = 'apr_' + randomUUID();
    return new Promise<boolean>((resolve, reject) => {
      const abort = (): void => {
        this.pending.delete(id);
        reject(
          new PitCrewError('CANCELLED', 'Interrupted while awaiting approval.'),
        );
      };
      this.pending.set(id, {
        hash,
        resolve: (approved) => {
          this.pending.delete(id);
          signal.removeEventListener('abort', abort);
          this.emit({ type: 'approval.resolved', id, hash, approved });
          resolve(approved);
        },
      });
      signal.addEventListener('abort', abort, { once: true });
      this.emit({
        type: 'approval.requested',
        id,
        hash,
        candidateId,
        artifact,
        reason,
      });
      if (signal.aborted) abort();
    });
  }
  resolveApproval(id: string, hash: string, approved: boolean): void {
    const pending = this.pending.get(id);
    if (!pending || pending.hash !== hash)
      throw new PitCrewError(
        'POLICY_DENIED',
        'Approval does not match a pending immutable action.',
      );
    pending.resolve(approved);
  }
}
