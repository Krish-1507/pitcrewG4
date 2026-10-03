import { expect, it } from 'vitest';
import {
  planCrew,
  shouldDebug,
  validateArchitecture,
  validateDiagnosis,
} from '../packages/agents/src/index.js';
import { eventSchema } from '../packages/protocol/src/index.js';

const test = { executable: 'node', args: ['--test'] };
it('uses one inference path for trivial work and invokes architecture only for multiple source modules', () => {
  const simple = planCrew(
    'fix the failing test',
    ['src/sum.js', 'sum.test.js', 'package.json', '.env'],
    test,
  );
  expect(simple.writePaths).toEqual(['src/sum.js']);
  expect(simple.architect).toBe(false);
  const multi = planCrew(
    'fix totals',
    ['src/math/add.js', 'src/cart/line.js'],
    test,
  );
  expect(multi.architect).toBe(true);
  expect(multi.acceptance).toEqual(test);
  test.args.push('--test-reporter=spec');
  expect(multi.acceptance.args).toEqual(['--test']);
  test.args.pop();
});
it('activates a single debugger only after repeated behavioral failure', () => {
  expect(shouldDebug(0, false)).toBe(false);
  expect(shouldDebug(1, false)).toBe(false);
  expect(shouldDebug(2, false)).toBe(true);
  expect(shouldDebug(3, true)).toBe(false);
});
it('rejects architecture scope expansion and acceptance substitution', () => {
  const crew = planCrew('fix', ['src/math/add.js', 'src/cart/line.js'], test);
  const plan = {
    goal: 'fix',
    assumptions: ['source causes failure'],
    expected_paths: ['src/math/add.js'],
    acceptance: ['same tests pass'],
    risk: 'low',
    verification: [test],
  };
  expect(validateArchitecture(plan, crew).expected_paths).toEqual([
    'src/math/add.js',
  ]);
  expect(() =>
    validateArchitecture(
      { ...plan, expected_paths: ['tests/acceptance.test.js'] },
      crew,
    ),
  ).toThrow('expand');
  expect(() =>
    validateArchitecture(
      {
        ...plan,
        verification: [{ executable: 'node', args: ['-e', 'process.exit(0)'] }],
      },
      crew,
    ),
  ).toThrow('frozen');
  expect(() =>
    validateArchitecture({ ...plan, verdict: 'VERIFIED' }, crew),
  ).toThrow();
});
it('rejects unsupported debugger evidence and role self-certification', () => {
  const diagnosis = {
    summary: 'localized failure',
    hypotheses: [
      {
        cause: 'incorrect operator',
        evidence_paths: ['src/add.js'],
        next_experiment: 'rerun the same test after a scoped repair',
      },
    ],
  };
  expect(validateDiagnosis(diagnosis, ['src/add.js']).hypotheses).toHaveLength(
    1,
  );
  expect(() => validateDiagnosis(diagnosis, ['src/other.js'])).toThrow(
    'outside',
  );
  expect(() =>
    eventSchema.parse({
      type: 'delegation',
      id: 'd',
      role: 'debugger',
      status: 'VERIFIED',
      mode: 'model',
      paths: [],
    }),
  ).toThrow();
});
