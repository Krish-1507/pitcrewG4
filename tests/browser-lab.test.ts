import { expect, it } from 'vitest';
import {
  assertAuthorizedTarget,
  browserExecutable,
  browserScenarioSchema,
} from '../packages/browser-lab/src/index.js';

it('restricts browser targets to http loopback hosts', () => {
  expect(assertAuthorizedTarget('http://127.0.0.1:4173/').port).toBe('4173');
  expect(assertAuthorizedTarget('http://localhost:3000/app').pathname).toBe(
    '/app',
  );
  expect(() => assertAuthorizedTarget('file:///etc/passwd')).toThrow(
    /http or https/,
  );
  expect(() => assertAuthorizedTarget('http://example.com/')).toThrow(
    /loopback/,
  );
  expect(
    assertAuthorizedTarget('https://preview.example.com/', [
      'preview.example.com',
    ]).hostname,
  ).toBe('preview.example.com');
  expect(() => assertAuthorizedTarget('not a url')).toThrow(/not a URL/);
});

it('requires an existing browser executable when configured explicitly', () => {
  expect(() =>
    browserExecutable({
      PITCREW_BROWSER_EXECUTABLE: 'C:/missing/chrome.exe',
    } as NodeJS.ProcessEnv),
  ).toThrow(/does not exist/);
});

it('rejects scenarios without semantic targets or with unsafe protocols', () => {
  expect(() =>
    browserScenarioSchema.parse({
      name: 'empty target',
      url: 'http://localhost:3000/',
      steps: [{ action: 'click', target: {} }],
    }),
  ).toThrow(/at least one locator/);
  expect(() =>
    browserScenarioSchema.parse({
      name: 'too many steps',
      url: 'http://localhost:3000/',
      steps: Array.from({ length: 81 }, () => ({ action: 'wait', ms: 1 })),
    }),
  ).toThrow();
  expect(
    browserScenarioSchema.parse({
      name: 'valid',
      url: 'http://localhost:3000/',
      network: [{ urlGlob: 'http://localhost:3000/api/*', action: 'fail500' }],
      steps: [
        { action: 'fill', target: { label: 'Amount' }, value: '2' },
        { action: 'expectEnabled', target: { name: 'Pay' }, enabled: true },
      ],
      accessibility: true,
    }).steps,
  ).toHaveLength(2);
});
