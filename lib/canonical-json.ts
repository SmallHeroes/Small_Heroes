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
export function canonicalize(v: unknown): unknown {
  if (typeof v === 'string') return v.normalize('NFC');
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce((acc, k) => { acc[k] = canonicalize((v as Record<string, unknown>)[k]); return acc; }, {} as Record<string, unknown>);
  }
  return v;
}

/** SHA-256 of the canonical serialization of `payload` (key-order- and Unicode-normal-form-invariant). */
export function canonicalHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}
