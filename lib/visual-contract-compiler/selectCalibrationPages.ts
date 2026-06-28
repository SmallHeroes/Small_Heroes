/**
 * Pick the 5 RISK calibration pages (NOT pages 1–5) — the spreads most likely to expose a contract/
 * render mismatch. Deterministic selection from the contract. EXCLUDES the cover and yields 5 DISTINCT
 * MEASURABLE FACE pages (the child is present, so identity AND companion-vs-child scale are measurable):
 *   1. establishing-location       — first face page at the most-used location
 *   2. zone-transition-same-place  — a face page whose location == prev page but zone differs
 *   3. companion + action          — a face page WITH the companion (prefer an action verb) → scale-measurable
 *   4. key-prop / continuity       — a face page where a recurring prop's state CHANGES
 *   5. (+ fill)                    — additional DISTINCT face pages, preferring companion-present (scale)
 *
 * The set never collapses below 5 when ≥5 face pages exist (the old version deduped to 3 and included
 * the cover). The hard gate runs on these before any full render.
 */
import type { BookVisualContract, PageVisualContract } from './types';

export interface CalibrationSelection {
  /** 5 DISTINCT measurable face page numbers (no cover). */
  pageNumbers: number[];
  /** The cover is intentionally NOT a calibration target (the proof is measurable FACE pages). */
  cover: false;
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
  const all = [...contract.pageContracts].sort((a, b) => a.pageNumber - b.pageNumber);
  // MEASURABLE FACE pages: child present → identity + companion-vs-child scale are measurable.
  const facePages = all.filter((p) => p.characterPresence.child);
  const pool = facePages.length > 0 ? facePages : all; // defensive: never operate on an empty pool

  // 1. establishing-location: first face page at the most-used location
  const primaryLoc = mostUsedLocationId(pool);
  const establishingLocation =
    (pool.find((p) => p.locationId === primaryLoc) ?? pool[0])?.pageNumber ?? null;

  // 2. zone transition within the SAME location (among face pages)
  let zoneTransitionSamePlace: number | null = null;
  for (let i = 1; i < pool.length; i++) {
    const prev = pool[i - 1];
    const cur = pool[i];
    if (cur.locationId === prev.locationId && cur.zoneId && cur.zoneId !== prev.zoneId) {
      zoneTransitionSamePlace = cur.pageNumber;
      break;
    }
  }

  // 3. companion + action (a FACE page that also has the companion → scale-measurable)
  const companionFacePages = pool.filter((p) => p.characterPresence.companion);
  const companionAction =
    (companionFacePages.find((p) => ACTION_VERB.test(p.camera)) ?? companionFacePages[0])?.pageNumber ??
    null;

  // 4. key-prop continuity: a face page where a recurring prop's state CHANGES vs an earlier page
  let keyProp: number | null = null;
  const lastState = new Map<string, string>();
  outer: for (const p of pool) {
    for (const ps of p.propState ?? []) {
      const prev = lastState.get(ps.propId);
      if (prev !== undefined && prev !== ps.state) {
        keyProp = p.pageNumber;
        break outer;
      }
      lastState.set(ps.propId, ps.state);
    }
  }
  if (keyProp == null) keyProp = pool.find((p) => (p.propState ?? []).length > 0)?.pageNumber ?? null;

  // Assemble 5 DISTINCT face pages: the 4 risk dimensions first, then fill from companion-present face
  // pages (scale-measurable), then any face page — so the set never collapses below 5.
  const picks: number[] = [];
  const add = (n: number | null) => {
    if (n != null && picks.length < 5 && !picks.includes(n)) picks.push(n);
  };
  add(establishingLocation);
  add(zoneTransitionSamePlace);
  add(companionAction);
  add(keyProp);
  for (const p of companionFacePages) add(p.pageNumber);
  for (const p of pool) add(p.pageNumber);

  return {
    pageNumbers: [...picks].sort((a, b) => a - b),
    cover: false,
    establishingLocation,
    zoneTransitionSamePlace,
    companionAction,
    keyProp,
  };
}
