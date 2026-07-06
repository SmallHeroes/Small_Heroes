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
 * How a stored/opaque contract value MUST be validated before it can steer a render. The ONE shared classifier so
 * `readFrozenVisualContract` (resume-reuse) and `requireValidContractForRender` (the render gate) can never diverge —
 * the P1 laundering bug was the gate classifying only exact `"resolved"` strictly and letting every other shape fall
 * through to the weak base validator:
 *   • `'resolved'`: exact `contractKind === "resolved"` → the FULL Resolved concreteness validator.
 *   • `'legacy'`  : NO discriminant AND NO Resolved provenance fingerprints → the legacy validator.
 *   • `'reject'`  : NEVER a renderable frozen contract — a Template, an unknown/garbage `contractKind`, a
 *                   discriminant-stripped Resolved (carries the Resolved provenance markers but lost its kind), or a
 *                   non-object. Both callers fail closed (readFrozen → `null`; the gate → throw).
 */
export type FrozenContractClass = 'resolved' | 'legacy' | 'reject';

export function classifyFrozenContract(raw: unknown): FrozenContractClass {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return 'reject';
  const obj = raw as Record<string, unknown>;
  const kind = obj.contractKind;
  if (kind === 'resolved') return 'resolved';
  // A discriminant-less value is genuine legacy ONLY if it carries NO Resolved provenance fingerprints; one that DOES
  // (a stripped Resolved) is rejected, never laundered through the weaker legacy validator (which skips concreteness).
  if (kind === undefined || kind === null) return isResolvedShaped(obj) ? 'reject' : 'legacy';
  return 'reject'; // 'template' or any unknown/garbage kind
}

/**
 * Whether a discriminant-less value nonetheless carries the Resolved-ONLY provenance markers (a legacy vNext
 * `BookVisualContract` has neither). Catches a damaged Resolved whose `contractKind` was stripped/corrupted.
 */
function isResolvedShaped(obj: Record<string, unknown>): boolean {
  return obj.materializerVersion !== undefined || obj.paletteVersion !== undefined;
}

/**
 * Re-validate an opaque stored contract value (e.g. `pipelineCache.visualContract`). Returns the typed contract when
 * it passes its class's validator, else `null`. NEVER throws — a structurally invalid or non-renderable stored value
 * is treated as absent so a WS0b consumer degrades to legacy behavior rather than propagating a corrupt contract.
 */
export function readFrozenVisualContract(raw: unknown): BookVisualContract | null {
  const cls = classifyFrozenContract(raw);
  if (cls === 'reject') return null;
  try {
    // Fail-closed re-validate; NEVER a blind cast. A Resolved must pass the FULL concreteness validator (not merely the
    // vNext structure) before the resume fast-path can reuse it; a genuine legacy contract keeps vNext validation.
    if (cls === 'resolved') assertValidResolvedBookVisualContract(raw);
    else assertValidVNextVisualContract(raw);
    return raw as BookVisualContract;
  } catch {
    return null;
  }
}
