/**
 * Location authority — the enforcement point for the contract's non-negotiable authority rule.
 *
 * Once a valid BookVisualContract exists, a page's location identity comes ONLY from the contract.
 * `imageDirection.locationZone` and the `extractLocationZone()` keyword classifier
 * (backend/providers/story-bank-loader.ts) are ADVISORY hints — they may inform camera/action
 * phrasing but may NEVER override `locationId`/`zoneId`. Where they conflict, the contract wins.
 *
 * This is the gate→cave fix in code: even if the keyword classifier shouts "cave", a page whose
 * contract says `playground_main / gate` resolves to playground_main/gate.
 */
import type { BookVisualContract } from './types';

/** An advisory hint from legacy sources (imageDirection.locationZone / extractLocationZone output). */
export interface LocationHint {
  locationZone?: string | null;
}

export interface ResolvedLocationAuthority {
  locationId: string;
  zoneId?: string;
  /** Always 'contract' when a contract governs the page — the hint never wins. */
  source: 'contract';
  /** The advisory hint that was IGNORED for identity (kept for logging/telemetry only). */
  advisoryHintIgnored?: string;
}

/**
 * Resolve a page's authoritative location from the contract. The hint is recorded as ignored — never
 * used to choose the location. Throws if the page is not in the contract (fail-closed: the caller
 * must hold a validated contract that covers the page).
 */
export function resolveAuthoritativePageLocation(
  contract: BookVisualContract,
  pageNumber: number,
  hint?: LocationHint | null
): ResolvedLocationAuthority {
  const page = contract.pageContracts.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    throw new Error(
      `resolveAuthoritativePageLocation: no page contract for page ${pageNumber} — contract does not cover this page`
    );
  }
  const advisory = hint?.locationZone?.trim() || undefined;
  return {
    locationId: page.locationId,
    zoneId: page.zoneId,
    source: 'contract',
    advisoryHintIgnored: advisory,
  };
}

/**
 * The authority rule as a predicate: legacy locationZone output is advisory-only whenever a contract
 * governs the render. (When NO contract exists, the hint is all there is — but the production path
 * fails closed before reaching a render without a valid contract; see assertValidBookVisualContract.)
 */
export function isLocationZoneAdvisoryOnly(hasValidContract: boolean): boolean {
  return hasValidContract === true;
}
