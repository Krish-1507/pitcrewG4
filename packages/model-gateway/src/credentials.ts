import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { Entry as KeyringEntry } from '@napi-rs/keyring';
import { PitCrewError } from '@pitcrew/protocol';

const require = createRequire(import.meta.url);
const reference = /^keychain:pitcrew\/(prov_[a-f0-9-]+)$/;
function entry(ref: string): KeyringEntry {
  const match = reference.exec(ref);
  if (!match)
    throw new PitCrewError('CONFIGURATION', 'Invalid credential reference.');
  try {
    const module =
      require('@napi-rs/keyring') as typeof import('@napi-rs/keyring');
    return new module.Entry('PitCrew', match[1]!, {
      linux: { store: 'secret-service' },
    });
  } catch {
    throw new PitCrewError(
      'CONFIGURATION',
      'OS credential store unavailable; configure an environment reference or unlock the keychain.',
    );
  }
}
export function storeCredential(value: string): string {
  if (!value || value.length > 16384 || /[\r\n\0]/.test(value))
    throw new PitCrewError('CONFIGURATION', 'Invalid credential value.');
  const ref = 'keychain:pitcrew/prov_' + randomUUID();
  try {
    entry(ref).setPassword(value);
    return ref;
  } catch {
    throw new PitCrewError(
      'CONFIGURATION',
      'Could not store credential in OS keychain.',
    );
  }
}
export function readCredential(ref: string): string {
  try {
    const value = entry(ref).getPassword();
    if (!value) throw new Error('missing');
    return value;
  } catch {
    throw new PitCrewError(
      'CONFIGURATION',
      'Configured OS credential is unavailable.',
    );
  }
}
export function deleteCredential(ref: string): boolean {
  try {
    return entry(ref).deleteCredential();
  } catch {
    throw new PitCrewError('CONFIGURATION', 'Could not delete OS credential.');
  }
}
