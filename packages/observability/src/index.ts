import { PitCrewError } from '@pitcrew/protocol';

export function redact(
  text: string,
  knownSecrets: readonly string[] = [],
): string {
  let result = text;
  for (const secret of knownSecrets)
    if (secret.length) result = result.split(secret).join('[REDACTED]');
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
