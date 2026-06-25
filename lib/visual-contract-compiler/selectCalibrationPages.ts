/**
 * Pick the 5 RISK calibration pages (NOT pages 1–5) — the spreads most likely to expose a contract/
 * render mismatch. Deterministic selection from the contract:
 *   1. cover                       (always)
 *   2. establishing-location       — first page of the most-used location
 *   3. zone-transition-same-place  — a page whose location == prev page but zone differs
 *   4. companion + action          — a companion-present page (prefer one with an action verb)
 *   5. key-prop / continuity       — a page where a recurring prop's state CHANGES (or any prop page)
 *
 * Only these render first; the hard gate runs on them before any full render.
 */
import type { BookVisualContract, PageVisualContract } from './types';

export interface CalibrationSelection {
  /** Page numbers to render+gate (cover represented as `0`). */
  pageNumbers: number[];
  cover: true;
  establishingLocation: number | null;
  zoneTransitionSamePlace: number | null;
  companionAction: number | null;
  keyProp: number | null;
}

const ACTION_VERB = /\b(reach|reaching|run|running|jump|jumping|climb|climbing|throw|throwing|hold|holding|open|opening|push|pushing|pull|pulling|point|pointing|kneel|kneeling|turn|turning|roar|roaring)\b/i;

function mostUsedLocationId(pages: PageVisualContract[]): string | null {
  const counts = new Map<string, number>();
  for (const p of pages) counts.set(p.locationId, (counts.get(p.locationId) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [id, n] of counts) if (n > bestN) ((best = id), (bestN = n));
  return best;
}

export function selectCalibrationPages(contract: BookVisualContract): CalibrationSelection {
  const pages = [...contract.pageContracts].sort((a, b) => a.pageNumber - b.pageNumber);

  // 2. establishing-location: first page at the most-used location
  const primaryLoc = mostUsedLocationId(pages);
  const establishingLocation = pages.find((p) => p.locationId === primaryLoc)?.pageNumber ?? pages[0]?.pageNumber ?? null;

  // 3. zone transition within the SAME location
  let zoneTransitionSamePlace: number | null = null;
  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1];
    const cur = pages[i];
    if (cur.locationId === prev.locationId && cur.zoneId && cur.zoneId !== prev.zoneId) {
      zoneTransitionSamePlace = cur.pageNumber;
      break;
    }
  }

  // 4. companion + action (prefer an action verb in the camera direction)
  const companionPages = pages.filter((p) => p.characterPresence.companion);
  const companionAction =
    (companionPages.find((p) => ACTION_VERB.test(p.camera)) ?? companionPages[0])?.pageNumber ?? null;

  // 5. key-prop continuity: a page where a recurring prop's state CHANGES vs an earlier page
  let keyProp: number | null = null;
  const lastState = new Map<string, string>();
  outer: for (const p of pages) {
    for (const ps of p.propState ?? []) {
      const prev = lastState.get(ps.propId);
      if (prev !== undefined && prev !== ps.state) {
        keyProp = p.pageNumber;
        break outer;
      }
      lastState.set(ps.propId, ps.state);
    }
  }
  // fallback: first page that has any prop state
  if (keyProp == null) keyProp = pages.find((p) => (p.propState ?? []).length > 0)?.pageNumber ?? null;

  const ordered = [0, establishingLocation, zoneTransitionSamePlace, companionAction, keyProp];
  const pageNumbers = Array.from(
    new Set(ordered.filter((n): n is number => n != null))
  );

  return {
    pageNumbers,
    cover: true,
    establishingLocation,
    zoneTransitionSamePlace,
    companionAction,
    keyProp,
  };
}
