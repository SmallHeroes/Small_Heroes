import { createHash } from 'crypto';

/**
 * Canonical JSON serialization shared by every integrity/idempotency hash in the delivery pipeline.
 *
 * Recursively sorts object keys AND NFC-normalizes strings so the serialization is invariant to (a) key ORDER
 * and (b) Unicode composition. REQUIRED wherever a payload is stored as Postgres JSONB and later re-hashed:
 * JSONB physically reorders object keys and does NOT preserve insertion order, and a string could round-trip in
 * a different Unicode normal form — so hashing `JSON.stringify(payload)` directly would make the enqueue-time
 * hash differ from the read-back hash and every row would false-mismatch. Canonicalizing first makes the hash
 * stable across the round-trip.
 *
 * Consumers: the DeliveryOutbox payload integrity recompute (#3h #4) and the AtomicOperationReceipt payloadHash
 * fence (Codex B′) — the receipt folds the REAL mutation payload into its hash, so a same-key/different-payload
 * retry fails closed, and that only holds if the serialization is canonical.
 */
export type CanonicalJsonDomainErrorCode =
  | 'non_finite_number'
  | 'non_json_value'
  | 'normalized_key_collision';

export class CanonicalJsonDomainError extends Error {
  constructor(
    readonly code: CanonicalJsonDomainErrorCode,
    location: string,
  ) {
    super(`canonical JSON ${code} at ${location}`);
    this.name = 'CanonicalJsonDomainError';
  }
}

function canonicalValue(
  v: unknown,
  location: string,
): unknown {
  if (typeof v === 'string') return v.normalize('NFC');
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      throw new CanonicalJsonDomainError(
        'non_finite_number',
        location,
      );
    }
    return v;
  }
  if (Array.isArray(v)) {
    return v.map((entry, index) =>
      canonicalValue(entry, `${location}[${index}]`),
    );
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(
      v as Record<string, unknown>,
    )
      .map(
        ([key, entry]) =>
          [key.normalize('NFC'), entry] as const,
      )
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
    const result: Record<string, unknown> = {};
    const normalizedKeys = new Set<string>();
    for (const [key, entry] of entries) {
      if (normalizedKeys.has(key)) {
        throw new CanonicalJsonDomainError(
          'normalized_key_collision',
          location,
        );
      }
      normalizedKeys.add(key);
      result[key] = canonicalValue(
        entry,
        `${location}.${key}`,
      );
    }
    return result;
  }
  // Preserve the historical JSON.stringify semantics used by existing
  // callers: nested undefined/function/symbol values are omitted in objects
  // or become null in arrays. Top-level non-JSON values remain rejected by
  // canonicalHash below.
  return v;
}

export function canonicalize(v: unknown): unknown {
  return canonicalValue(v, '$');
}

/** SHA-256 of the canonical serialization of `payload` (key-order- and Unicode-normal-form-invariant). */
export function canonicalHash(payload: unknown): string {
  const serialized = JSON.stringify(canonicalize(payload));
  if (serialized === undefined) {
    throw new CanonicalJsonDomainError(
      'non_json_value',
      '$',
    );
  }
  return createHash('sha256')
    .update(serialized)
    .digest('hex');
}
