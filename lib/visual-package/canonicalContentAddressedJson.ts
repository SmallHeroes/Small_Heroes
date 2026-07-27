import fs from 'node:fs';

import {
  CanonicalJsonDomainError,
  canonicalize,
} from '@/lib/canonical-json';

import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';

export { CanonicalJsonDomainError };

export function canonicalContentAddressedJsonBytes(
  value: unknown,
): string {
  const serialized = JSON.stringify(
    canonicalize(value),
    null,
    2,
  );
  if (serialized === undefined) {
    throw new CanonicalJsonDomainError(
      'non_json_value',
      '$',
    );
  }
  return `${serialized}\n`;
}

/**
 * Writes one canonical JSON byte form while remaining idempotent with
 * historical D1A0 pretty-JSON artifacts at the same content address.
 * Existing bytes are never rewritten: legacy bytes are accepted only when
 * parsing and re-canonicalizing proves semantic equality.
 */
export function writeCanonicalContentAddressedJsonArtifact(
  args: {
    destinationPath: string;
    value: unknown;
  },
): { created: boolean } {
  const bytes = canonicalContentAddressedJsonBytes(
    args.value,
  );
  if (fs.existsSync(args.destinationPath)) {
    let existing: unknown;
    try {
      existing = JSON.parse(
        fs.readFileSync(args.destinationPath, 'utf8'),
      ) as unknown;
    } catch {
      return writeImmutableLocalArtifact({
        destinationPath: args.destinationPath,
        bytes,
      });
    }
    try {
      if (
        canonicalContentAddressedJsonBytes(existing) ===
        bytes
      ) {
        return { created: false };
      }
    } catch {
      // The immutable byte writer below emits the established collision error.
    }
  }
  return writeImmutableLocalArtifact({
    destinationPath: args.destinationPath,
    bytes,
  });
}
