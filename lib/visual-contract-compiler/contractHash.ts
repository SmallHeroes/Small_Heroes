/**
 * The canonical hash of a BookVisualContract (vNext / WS0).
 *
 * Computed via the shared canonical serializer (`lib/canonical-json.ts`) so it is invariant to object-key
 * ORDER and Unicode normal form — REQUIRED because the contract round-trips through Postgres JSONB
 * (`pipelineCache`) before it is re-hashed. This hash is:
 *   - stamped on `Order.visualContractHash` when the contract is frozen (WS0 step 4), and
 *   - carried on each `QualityEvidence.contractHash` so a row is only admissible while it matches the
 *     Order's active contract (WS0 step 8 — a mismatch is treated as stale, forcing a re-QA).
 *
 * PURE — no I/O, no clock. Enforcement is OFF in WS0; this only computes the identifier.
 */
import { canonicalHash } from '@/lib/canonical-json';
import type { BookVisualContract } from './types';

/** SHA-256 of the canonical serialization of the contract (key-order- + Unicode-invariant). */
export function computeVisualContractHash(contract: BookVisualContract): string {
  return canonicalHash(contract);
}
