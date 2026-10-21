import { z } from 'zod';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import axe from 'axe-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PitCrewError } from '@pitcrew/protocol';

export const semanticTargetSchema = z
  .object({
    role: z.string().optional(),
    name: z.string().optional(),
    text: z.string().optional(),
    testId: z.string().optional(),
    label: z.string().optional(),
    selector: z.string().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    'A semantic target requires at least one locator.',
  );
export type SemanticTarget = z.infer<typeof semanticTargetSchema>;
export const browserStepSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('fill'),
      target: semanticTargetSchema,
      value: z.string(),
    })
    .strict(),
  z
    .object({
      action: z.literal('click'),
      target: semanticTargetSchema,
      times: z.number().int().min(1).max(5).optional(),
    })
    .strict(),
  z.object({ action: z.literal('press'), key: z.string().min(1) }).strict(),
  z
    .object({
      action: z.literal('expectVisible'),
      target: semanticTargetSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('expectText'),
      target: semanticTargetSchema,
      text: z.string(),
    })
    .strict(),
  z
    .object({
      action: z.literal('expectEnabled'),
      target: semanticTargetSchema,
      enabled: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('expectUrl'), url: z.string() }).strict(),
  z
    .object({
      action: z.literal('wait'),
      ms: z.number().int().min(0).max(10000),
    })
    .strict(),
  z.object({ action: z.literal('screenshot'), name: z.string() }).strict(),
  z.object({ action: z.literal('openTab'), url: z.string() }).strict(),
  z.object({ action: z.literal('closeTab') }).strict(),
]);
export type BrowserStep = z.infer<typeof browserStepSchema>;
export const networkScenarioSchema = z
  .object({
    urlGlob: z.string(),
    action: z.enum(['fail500', 'abort', 'timeout', 'offline']),
  })
  .strict();
export const browserScenarioSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    network: z.array(networkScenarioSchema).max(20).optional(),
    steps: z.array(browserStepSchema).max(80),
    accessibility: z.boolean().optional(),
  })
  .strict();
export type BrowserScenario = z.infer<typeof browserScenarioSchema>;
export const browserQaResultSchema = z
  .object({
    name: z.string(),
    url: z.string(),
    mode: z.enum(['observe', 'headless', 'replay']),
    title: z.string(),
    checks: z.array(
      z
        .object({ step: z.string(), ok: z.boolean(), detail: z.string() })
        .strict(),
    ),
    console: z.array(z.object({ type: z.string(), text: z.string() }).strict()),
    network: z.array(
      z
        .object({
          method: z.string(),
          url: z.string(),
          status: z.number().nullable(),
          failure: z.string().nullable(),
        })
        .strict(),
    ),
    accessibility: z
      .object({
        violations: z.number(),
        serious: z.number(),
        details: z.array(
          z
            .object({
              id: z.string(),
              impact: z.string(),
              help: z.string(),
              nodes: z.number(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    screenshots: z.array(z.string()),
    trace: z.string().nullable(),
  })
  .strict();
export type BrowserQaResult = z.infer<typeof browserQaResultSchema>;

export function browserExecutable(env = process.env): string {
  const explicit = env.PITCREW_BROWSER_EXECUTABLE;
  if (explicit) {
    if (!existsSync(explicit))
      throw new PitCrewError(
        'CONFIGURATION',
        'PITCREW_BROWSER_EXECUTABLE does not exist.',
      );
    return explicit;
  }
  const candidates = [
    env.PROGRAMFILES &&
      join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] &&
      join(
        env['PROGRAMFILES(X86)']!,
        'Google',
        'Chrome',
        'Application',
        'chrome.exe',
      ),
    env.PROGRAMFILES &&
      join(env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env['PROGRAMFILES(X86)'] &&
      join(
        env['PROGRAMFILES(X86)']!,
        'Microsoft',
        'Edge',
        'Application',
        'msedge.exe',
      ),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((entry): entry is string => typeof entry === 'string');
  const found = candidates.find((entry) => existsSync(entry));
  if (!found)
    throw new PitCrewError(
      'CONFIGURATION',
      'No Chrome or Edge executable was found; set PITCREW_BROWSER_EXECUTABLE.',
    );
  return found;
}

export function assertAuthorizedTarget(
  url: string,
  allowHosts = (process.env.PITCREW_BROWSER_ALLOW_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PitCrewError('CONFIGURATION', 'Browser target is not a URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new PitCrewError(
      'POLICY_DENIED',
      'Browser QA targets must use http or https.',
    );
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (
    !loopback.includes(parsed.hostname) &&
    !allowHosts.includes(parsed.hostname)
  )
    throw new PitCrewError(
      'POLICY_DENIED',
      'Browser QA is restricted to loopback targets unless PITCREW_BROWSER_ALLOW_HOSTS authorizes the host.',
    );
  return parsed;
}

function assertAuthorizedRoutePattern(pattern: string): void {
  if (!/^https?:\/\//.test(pattern))
    throw new PitCrewError(
      'POLICY_DENIED',
      'Network scenarios must target an absolute http(s) URL pattern.',
    );
  const prefix = pattern.split('*')[0] ?? pattern;
  try {
    assertAuthorizedTarget(prefix);
  } catch {
    throw new PitCrewError(
      'POLICY_DENIED',
      'Network scenarios are restricted to authorized hosts.',
    );
  }
}

function locator(page: Page, target: SemanticTarget): Locator {
  if (target.testId) return page.getByTestId(target.testId);
  if (target.label) return page.getByLabel(target.label, { exact: true });
  if (target.role)
    return page.getByRole(
      target.role as Parameters<Page['getByRole']>[0],
      target.name === undefined ? {} : { name: target.name },
    );
  if (target.name) return page.getByRole('button', { name: target.name });
  if (target.text) return page.getByText(target.text, { exact: false });
  if (target.selector) return page.locator(target.selector);
  throw new PitCrewError('CONFIGURATION', 'Unsupported semantic target.');
}

async function describe(step: BrowserStep): Promise<string> {
  if (step.action === 'wait') return 'wait ' + step.ms + 'ms';
  return step.action;
}

async function applyStep(
  page: Page,
  step: BrowserStep,
  context: BrowserContext,
  active: { page: Page },
): Promise<string | undefined> {
  switch (step.action) {
    case 'fill':
      await locator(page, step.target).fill(step.value);
      return undefined;
    case 'click':
      await locator(page, step.target).click({ clickCount: step.times ?? 1 });
      return undefined;
    case 'press':
      await page.keyboard.press(step.key);
      return undefined;
    case 'expectVisible':
      await locator(page, step.target).waitFor({ state: 'visible' });
      return undefined;
    case 'expectText': {
      const text = await locator(page, step.target).innerText();
      if (!text.includes(step.text))
        throw new PitCrewError(
          'VERIFICATION_FAILED',
          'Expected text "' + step.text + '" in "' + text.slice(0, 200) + '".',
        );
      return undefined;
    }
    case 'expectEnabled': {
      const enabled = await locator(page, step.target).isEnabled();
      if (enabled !== step.enabled)
        throw new PitCrewError(
          'VERIFICATION_FAILED',
          'Expected target to be ' +
            (step.enabled ? 'enabled' : 'disabled') +
            '.',
        );
      return undefined;
    }
    case 'expectUrl':
      if (!page.url().includes(step.url))
        throw new PitCrewError(
          'VERIFICATION_FAILED',
          'Expected URL to contain "' + step.url + '".',
        );
      return undefined;
    case 'wait':
      await page.waitForTimeout(step.ms);
      return undefined;
    case 'screenshot':
      return step.name;
    case 'openTab': {
      const next = await context.newPage();
      await next.goto(step.url, { waitUntil: 'domcontentloaded' });
      active.page = next;
      return undefined;
    }
    case 'closeTab':
      await page.close();
      active.page = context.pages().at(-1) ?? page;
      return undefined;
  }
}

export async function runBrowserScenario(options: {
  scenario: BrowserScenario;
  mode: 'observe' | 'headless' | 'replay';
  artifactDir: string;
  signal?: AbortSignal;
}): Promise<BrowserQaResult> {
  const scenario = browserScenarioSchema.parse(options.scenario);
  assertAuthorizedTarget(scenario.url);
  for (const route of scenario.network ?? [])
    assertAuthorizedRoutePattern(route.urlGlob);
  const artifactDir = resolve(options.artifactDir);
  await mkdir(artifactDir, { recursive: true });
  const signal = options.signal ?? AbortSignal.timeout(120000);
  if (signal.aborted)
    throw new PitCrewError('CANCELLED', 'Browser QA was cancelled.');
  let browser: Browser | undefined;
  const consoleEntries: BrowserQaResult['console'] = [];
  const networkEntries: BrowserQaResult['network'] = [];
  const checks: BrowserQaResult['checks'] = [];
  const screenshots: string[] = [];
  let trace: string | null = null;
  try {
    browser = await chromium.launch({
      headless: options.mode !== 'observe',
      executablePath: browserExecutable(),
      args: [
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    const context = await browser.newContext();
    if (options.mode !== 'replay')
      await context.tracing.start({ screenshots: true, snapshots: true });
    const active = { page: await context.newPage() };
    active.page.on('console', (message) =>
      consoleEntries.push({ type: message.type(), text: message.text() }),
    );
    active.page.on('requestfailed', (request) =>
      networkEntries.push({
        method: request.method(),
        url: request.url(),
        status: null,
        failure: request.failure()?.errorText ?? 'failed',
      }),
    );
    active.page.on('response', (response) =>
      networkEntries.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
        failure: null,
      }),
    );
    for (const route of scenario.network ?? []) {
      await context.route(route.urlGlob, async (handler) => {
        if (route.action === 'fail500')
          await handler.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'seeded failure' }),
          });
        else if (route.action === 'offline')
          await handler.abort('internetdisconnected');
        else if (route.action === 'abort') await handler.abort('failed');
        else await handler.fulfill({ status: 504, body: 'timeout' });
      });
    }
    active.page.setDefaultTimeout(10000);
    await active.page.goto(scenario.url, { waitUntil: 'domcontentloaded' });
    for (const step of scenario.steps) {
      if (signal.aborted)
        throw new PitCrewError('CANCELLED', 'Browser QA was cancelled.');
      const label = await describe(step);
      try {
        const shot = await applyStep(active.page, step, context, active);
        if (shot) {
          const file = join(
            artifactDir,
            shot.replace(/[^a-z0-9._-]/gi, '_') + '.png',
          );
          await active.page.screenshot({ path: file, fullPage: true });
          screenshots.push(file);
        }
        checks.push({ step: label, ok: true, detail: 'completed' });
      } catch (error) {
        checks.push({
          step: label,
          ok: false,
          detail:
            error instanceof Error ? error.message.slice(0, 400) : 'failed',
        });
        if (step.action === 'screenshot') {
          const file = join(
            artifactDir,
            step.name.replace(/[^a-z0-9._-]/gi, '_') + '.png',
          );
          await active.page
            .screenshot({ path: file, fullPage: true })
            .catch(() => undefined);
          screenshots.push(file);
        }
        if (
          step.action === 'expectVisible' ||
          step.action === 'expectText' ||
          step.action === 'expectEnabled' ||
          step.action === 'expectUrl' ||
          step.action === 'fill' ||
          step.action === 'click'
        )
          throw error;
        checks[checks.length - 1] = {
          step: label,
          ok: false,
          detail: checks[checks.length - 1]!.detail,
        };
      }
    }
    let accessibility: BrowserQaResult['accessibility'] = null;
    if (scenario.accessibility) {
      const source = (axe as unknown as { source?: string }).source;
      if (!source)
        throw new PitCrewError(
          'CONFIGURATION',
          'axe-core source is unavailable for injection.',
        );
      await active.page.addScriptTag({ content: source });
      const audit = (await active.page.evaluate(async () => {
        const runner = (
          globalThis as unknown as {
            axe: {
              run: () => Promise<{
                violations: {
                  id: string;
                  impact?: string | null;
                  help: string;
                  nodes: unknown[];
                }[];
              }>;
            };
          }
        ).axe;
        const result = await runner.run();
        return result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact ?? 'unknown',
          help: violation.help,
          nodes: violation.nodes.length,
        }));
      })) as { id: string; impact: string; help: string; nodes: number }[];
      accessibility = {
        violations: audit.length,
        serious: audit.filter(
          (entry) => entry.impact === 'serious' || entry.impact === 'critical',
        ).length,
        details: audit,
      };
      await writeFile(
        join(artifactDir, 'accessibility.json'),
        JSON.stringify(accessibility, null, 2),
      );
    }
    if (options.mode !== 'replay') {
      trace = join(artifactDir, 'trace.zip');
      await context.tracing.stop({ path: trace });
    }
    const result = browserQaResultSchema.parse({
      name: scenario.name,
      url: scenario.url,
      mode: options.mode,
      title: await active.page.title(),
      checks,
      console: consoleEntries.slice(0, 200),
      network: networkEntries.slice(0, 200),
      accessibility,
      screenshots,
      trace,
    });
    await writeFile(
      join(artifactDir, 'result.json'),
      JSON.stringify(result, null, 2),
    );
    return result;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
