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
import type { BookVisualContract } from './types';

/**
 * Re-validate an opaque stored contract value (e.g. `pipelineCache.visualContract`). Returns the typed contract
 * when it passes the vNext validator, else `null`. NEVER throws — a structurally invalid stored value is treated
 * as absent so a WS0b consumer degrades to legacy behavior rather than propagating a corrupt contract.
 */
export function readFrozenVisualContract(raw: unknown): BookVisualContract | null {
  if (raw == null) return null;
  try {
    assertValidVNextVisualContract(raw); // fail-closed re-validate; NEVER a blind cast
    return raw as BookVisualContract;
  } catch {
    return null;
  }
}
