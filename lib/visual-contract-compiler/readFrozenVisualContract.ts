/**
 * readFrozenVisualContract (WS0b) — the ONE safe way to read a frozen contract back out of storage.
 *
 * `pipelineCache.visualContract` is persisted as opaque JSON (it round-trips through Postgres JSONB), so a
 * consumer must NEVER blind-cast it to `BookVisualContract` — a corrupted/truncated/partial cache value would
 * then propagate into steering/QA. This RE-VALIDATES the raw value through the fail-closed vNext validator and
 * returns the typed contract only when it is structurally sound; anything else → `null` (treat as "no contract",
 * i.e. the legacy path). Pure — no I/O, no clock.
 */
import { assertValidVNextVisualContract } from './validateVNextVisualContract';
import { assertValidResolvedBookVisualContract } from './validateResolvedContract';
import type { BookVisualContract } from './types';

/**
 * Re-validate an opaque stored contract value (e.g. `pipelineCache.visualContract`). Returns the typed contract
 * when it passes the vNext validator, else `null`. NEVER throws — a structurally invalid stored value is treated
 * as absent so a WS0b consumer degrades to legacy behavior rather than propagating a corrupt contract.
 */
export function readFrozenVisualContract(raw: unknown): BookVisualContract | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj.contractKind;
  try {
    // DISPATCH on the discriminant, fail-closed in EVERY branch (a Resolved with a missing/deferred structured trait
    // passes the vNext structure but must NOT be reused/rendered, so it must go through the FULL concreteness
    // validator — never the vNext validator):
    //   • `resolved`               → the FULL Resolved validator.
    //   • absent + NOT resolved-shaped → a genuine legacy vNext contract → the vNext validator.
    //   • absent BUT resolved-shaped   → a damaged Resolved that LOST its discriminant — REJECT (do not launder it
    //                                    through the weaker vNext validator, which would skip the concreteness gate).
    //   • any other kind (`template`, or an unknown/garbage value) → NOT a renderable frozen contract → REJECT.
    if (kind === 'resolved') {
      assertValidResolvedBookVisualContract(raw);
      return raw as BookVisualContract;
    }
    if (kind === undefined || kind === null) {
      if (isResolvedShaped(obj)) return null;
      assertValidVNextVisualContract(raw); // fail-closed re-validate; NEVER a blind cast
      return raw as BookVisualContract;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whether a discriminant-less value nonetheless carries the Resolved-ONLY provenance markers (a legacy vNext
 * `BookVisualContract` has neither). Used to catch a damaged Resolved whose `contractKind` was stripped/corrupted — it
 * must never be validated as if it were a legacy contract (that path skips the full concreteness gate).
 */
function isResolvedShaped(obj: Record<string, unknown>): boolean {
  return obj.materializerVersion !== undefined || obj.paletteVersion !== undefined;
}
