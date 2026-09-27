import { join } from 'node:path';
import { PitCrewError } from '@pitcrew/protocol';
import type {
  RuntimeConfig,
  Mission,
  MissionEvent,
  Candidate,
  Command,
} from '@pitcrew/protocol';
import { EvidenceStore } from '@pitcrew/evidence';
import { observe } from '@pitcrew/repo-intelligence';
import {
  inspectBaseline,
  createCandidate,
  fingerprint,
  candidateDiff,
  checkpoint,
} from '@pitcrew/candidate-manager';
import { runSandbox } from '@pitcrew/sandbox';
import { propose, providerSecrets } from '@pitcrew/model-gateway';
import { implement } from '@pitcrew/agents';
import { gate, invokeReferee } from '@pitcrew/openpitstop-adapter';
import { assertNoSecrets } from '@pitcrew/observability';

export interface MissionOptions {
  repo: string;
  request: string;
  config: RuntimeConfig;
  signal: AbortSignal;
  onEvent?: (mission: Mission) => void;
}
export function startMission(
  store: EvidenceStore,
  options: MissionOptions,
): { mission: Mission; done: Promise<Mission> } {
  assertNoSecrets(options.request, providerSecrets(options.config.provider));
  const mission = store.create(options.repo, options.request);
  const done = execute(store, mission, options);
  return { mission, done };
}
async function execute(
  store: EvidenceStore,
  mission: Mission,
  options: MissionOptions,
): Promise<Mission> {
  const { config } = options;
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(config.budget.timeoutMs),
  ]);
  const deadline = Date.now() + config.budget.timeoutMs;
  const remaining = (): number => Math.max(1, deadline - Date.now());
  const emit = (event: MissionEvent): void => {
    mission = store.append(mission.id, event);
    options.onEvent?.(mission);
  };
  let baseline: { root: string; head: string; digest: string } | undefined;
  let candidate: Candidate | undefined;
  try {
    emit({
      type: 'phase',
      state: 'UNDERSTANDING',
      message: 'Inspecting real Git state and repository mechanics.',
    });
    baseline = await inspectBaseline(options.repo, signal);
    const context = await observe(baseline.root, options.request, signal);
    const test: Command | undefined = config.test ?? context.test;
    if (!test)
      throw new PitCrewError(
        'CONFIGURATION',
        'No targeted verification command found. Configure test executable and argv.',
      );
    // Native node test needs no package-manager shell wrapper on Windows.
    if (process.platform === 'win32' && test.executable === 'npm')
      throw new PitCrewError(
        'CONFIGURATION',
        'On Windows configure test as node plus an npm CLI script path, or a native test command.',
      );
    emit({
      type: 'phase',
      state: 'PLANNING',
      message:
        'Plan: reproduce unchanged baseline in candidate; request a bounded source edit; rerun the same test; invoke independent referee.',
    });
    emit({
      type: 'phase',
      state: 'BASELINING',
      message: 'Creating isolated candidate from immutable baseline.',
    });
    candidate = await createCandidate(
      baseline.root,
      store.root,
      baseline.head,
      signal,
    );
    emit({ type: 'candidate', candidate });
    const beforeTest = await fingerprint(candidate.root, signal);
    const failed = await runSandbox(test, candidate.root, config.execution, {
      signal,
      timeoutMs: remaining(),
    });
    if ((await fingerprint(candidate.root, signal)) !== beforeTest)
      throw new PitCrewError('STALE_EVIDENCE', 'Baseline test mutated source.');
    const baseArtifact = await store.artifact(
      JSON.stringify({ command: test, ...failed }),
    );
    emit({
      type: 'evidence',
      label: 'baseline test (' + failed.isolation + ' isolation)',
      artifact: baseArtifact,
      digest: beforeTest,
      exitCode: failed.exitCode,
    });
    if (failed.exitCode === 0) {
      emit({
        type: 'phase',
        state: 'NOT_PROVEN',
        message:
          'The baseline test passed; the requested failure was not reproduced.',
      });
      return mission;
    }
    if (
      !/AssertionError|ERR_ASSERTION|not ok|FAIL|failed|Assertion failed/i.test(
        failed.stdout + '\n' + failed.stderr,
      )
    )
      throw new PitCrewError(
        'TOOL_ENVIRONMENT_FAILED',
        'Baseline failed without a recognized behavioral assertion. Fix the test environment first.',
      );
    emit({
      type: 'phase',
      state: 'IMPLEMENTING',
      message:
        'Requesting bounded Implementer edits from the configured real provider.',
    });
    let passed = false;
    let latest = failed;
    for (let call = 1; call <= config.budget.maxModelCalls; call++) {
      signal.throwIfAborted();
      const currentContext = await observe(
        candidate.root,
        options.request,
        signal,
      );
      const response = await propose(config.provider, {
        request: options.request,
        context: JSON.stringify({
          repository: currentContext,
          test: { stdout: latest.stdout, stderr: latest.stderr },
        }),
        directory: join(store.root, 'bridge', mission.id),
        signal,
        timeoutMs: remaining(),
      });
      emit({
        type: 'model',
        calls: call,
        provider: response.provider,
        costUsd: response.costUsd,
      });
      const paths = await implement(
        candidate.root,
        response.proposal,
        providerSecrets(config.provider),
      );
      emit({
        type: 'phase',
        state: 'TESTING',
        message: 'Running the same targeted verification on the candidate.',
      });
      const digest = await fingerprint(candidate.root, signal);
      latest = await runSandbox(test, candidate.root, config.execution, {
        signal,
        timeoutMs: remaining(),
      });
      if ((await fingerprint(candidate.root, signal)) !== digest)
        throw new PitCrewError(
          'STALE_EVIDENCE',
          'Test mutated candidate source; evidence invalidated.',
        );
      emit({
        type: 'evidence',
        label: 'candidate test (' + latest.isolation + ' isolation)',
        artifact: await store.artifact(
          JSON.stringify({ command: test, ...latest }),
        ),
        digest,
        exitCode: latest.exitCode,
      });
      if (latest.exitCode === 0) {
        await checkpoint(candidate, paths, signal);
        passed = true;
        break;
      }
      if (call < config.budget.maxModelCalls)
        emit({
          type: 'phase',
          state: 'IMPLEMENTING',
          message:
            'Targeted verification failed; repairing within the configured call budget.',
        });
    }
    if (!passed)
      throw new PitCrewError(
        'VERIFICATION_FAILED',
        'Candidate still fails targeted verification. Model call budget exhausted.',
      );
    const diff = await candidateDiff(candidate, signal);
    emit({
      type: 'evidence',
      label: 'candidate diff',
      artifact: await store.artifact(diff),
      digest: await fingerprint(candidate.root, signal),
      exitCode: null,
    });
    emit({
      type: 'phase',
      state: 'VERIFYING',
      message: 'Running independent OpenPitStop evidence collection.',
    });
    if (!config.execution.allowReducedIsolation)
      throw new PitCrewError(
        'SANDBOX_FAILED',
        'P0 host referee execution requires explicit reduced-isolation authorization; containerized referee is not yet configured.',
      );
    const stages = [
      ['understand', '--json'],
      ['try', '--json'],
      ['verify-stack', '--json'],
      ['architecture-check', '--from', candidate.baseline, '--json'],
    ];
    // The public referee accepts a command string. Only a fixed built-in command
    // is passed here; arbitrary argv is never joined into shell text.
    if (
      test.executable === 'node' &&
      test.args.length === 1 &&
      test.args[0] === '--test'
    )
      stages.push([
        'baseline-verify',
        '--baseline',
        candidate.baseline,
        '--command',
        'node --test',
        '--json',
      ]);
    for (const args of stages) {
      const result = await invokeReferee(
        config.referee,
        candidate,
        args,
        signal,
        remaining(),
      );
      emit({
        type: 'evidence',
        label: 'OpenPitStop ' + args[0],
        artifact: await store.artifact(JSON.stringify(result)),
        digest: await fingerprint(candidate.root, signal),
        exitCode: result.exitCode,
      });
    }
    emit({
      type: 'phase',
      state: 'FINAL_GATE',
      message: 'Requesting OpenPitStop strict final verdict.',
    });
    const result = await gate(config.referee, candidate, signal, remaining());
    if ((await fingerprint(candidate.root, signal)) !== result.digest)
      throw new PitCrewError('STALE_EVIDENCE', 'Candidate changed after gate.');
    if ((await fingerprint(baseline.root, signal)) !== baseline.digest)
      throw new PitCrewError(
        'STALE_EVIDENCE',
        'Baseline changed during mission.',
      );
    emit({
      type: 'referee',
      verdict: result.verdict,
      digest: result.digest,
      artifact: await store.artifact(JSON.stringify(result.result)),
      message: result.message,
    });
  } catch (error) {
    const code =
      error instanceof PitCrewError
        ? error.code
        : signal.aborted
          ? options.signal.aborted
            ? 'CANCELLED'
            : 'TIMEOUT'
          : 'INTERNAL';
    const message =
      error instanceof PitCrewError
        ? error.message
        : signal.aborted
          ? 'Mission interrupted by cancellation or deadline.'
          : 'Unexpected runtime failure; candidate retained for inspection.';
    const state =
      code === 'CANCELLED'
        ? 'CANCELLED'
        : [
              'POLICY_DENIED',
              'APPROVAL_REQUIRED',
              'VERIFICATION_FAILED',
            ].includes(code)
          ? 'BLOCKED'
          : 'NOT_PROVEN';
    emit({ type: 'phase', state, message: code + ': ' + message });
  }
  return mission;
}
