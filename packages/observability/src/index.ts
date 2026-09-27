import { PitCrewError } from '@pitcrew/protocol';

export function redact(
  text: string,
  knownSecrets: readonly string[] = [],
): string {
  let result = text;
  for (const secret of knownSecrets) {
    if (!secret.length) continue;
    result = result.split(secret).join('[REDACTED]');
    result = result
      .split(JSON.stringify(secret).slice(1, -1))
      .join('[REDACTED]');
  }
  return result
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      '[REDACTED PRIVATE KEY]',
    )
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{16})\b/g,
      '[REDACTED]',
    )
    .replace(
      /((?:api[_-]?key|access[_-]?token|password|authorization|secret)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@')
    .replace(
      new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g'),
      '',
    );
}
export function assertNoSecrets(
  text: string,
  knownSecrets: readonly string[] = [],
): void {
  if (redact(text, knownSecrets) !== text)
    throw new PitCrewError(
      'POLICY_DENIED',
      'Credential-like content was blocked before context or storage.',
    );
}

export function redactObject(
  value: unknown,
  secrets: readonly string[] = [],
): unknown {
  if (typeof value === 'string') return redact(value, secrets);
  if (Array.isArray(value))
    return value.map((item) => redactObject(item, secrets));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactObject(item, secrets),
      ]),
    );
  return value;
}
