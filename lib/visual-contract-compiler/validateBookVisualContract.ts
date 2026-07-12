/**
 * Deterministic, fail-closed validation of a BookVisualContract.
 *
 * The whole system's authority rests on the contract being structurally sound: every page must point
 * at a real location, every zone at a real parent location, the cast/cover/props must be coherent.
 * A malformed contract (bad LLM JSON, dangling locationId, zone in the wrong location — the exact
 * gate→cave class of bug) must FAIL CLOSED, never silently pass.
 */
import {
  BOOK_VISUAL_CONTRACT_VERSION,
  type BookVisualContract,
  type PageVisualContract,
} from './types';

export type ContractValidationResult =
  | { ok: true; contract: BookVisualContract }
  | { ok: false; errors: string[] };

export class InvalidVisualContractError extends Error {
  readonly isInvalidVisualContract = true as const;
  constructor(readonly errors: string[]) {
    super(`Invalid BookVisualContract: ${errors.join('; ')}`);
    this.name = 'InvalidVisualContractError';
  }
}

export function isInvalidVisualContractError(e: unknown): e is InvalidVisualContractError {
  return (
    e instanceof InvalidVisualContractError ||
    (e as { isInvalidVisualContract?: boolean })?.isInvalidVisualContract === true
  );
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** Pure, exhaustive validation. Returns ok + the narrowed contract, or the full list of problems. */
export function validateBookVisualContract(input: unknown): ContractValidationResult {
  const errors: string[] = [];
  const c = input as Record<string, unknown>;

  if (!isObj(input)) {
    return { ok: false, errors: ['contract is not an object'] };
  }
  if (c.version !== BOOK_VISUAL_CONTRACT_VERSION) {
    errors.push(`version must be ${BOOK_VISUAL_CONTRACT_VERSION}`);
  }
  if (!isStr(c.worldType)) errors.push('worldType missing');
  if (!isStrArr(c.forbiddenGlobalElements)) errors.push('forbiddenGlobalElements must be a string[]');

  // Locations
  const locations = Array.isArray(c.locations) ? c.locations : [];
  if (locations.length === 0) errors.push('locations[] must be non-empty');
  const locationIds = new Set<string>();
  locations.forEach((loc, i) => {
    if (!isObj(loc) || !isStr(loc.id)) {
      errors.push(`locations[${i}].id missing`);
      return;
    }
    if (locationIds.has(loc.id)) errors.push(`duplicate location id "${loc.id}"`);
    locationIds.add(loc.id);
    if (!isStr(loc.name)) errors.push(`locations[${i}] (${loc.id}) name missing`);
  });

  // Zones — every zone must belong to a declared location (the gate→cave guard).
  const zones = Array.isArray(c.zones) ? c.zones : [];
  const zoneByLocation = new Map<string, Set<string>>();
  zones.forEach((z, i) => {
    if (!isObj(z) || !isStr(z.id) || !isStr(z.locationId)) {
      errors.push(`zones[${i}] needs id + locationId`);
      return;
    }
    if (!locationIds.has(z.locationId)) {
      errors.push(`zone "${z.id}" references unknown locationId "${z.locationId}"`);
      return;
    }
    if (!zoneByLocation.has(z.locationId)) zoneByLocation.set(z.locationId, new Set());
    zoneByLocation.get(z.locationId)!.add(z.id);
    // (Slice B) optional per-zone stableGeometry — OMIT when unauthored; if present it must be a NON-EMPTY string[] of
    // non-empty strings (an authored `[]`/`null` is rejected so the omit-when-unauthored hash invariant is enforced).
    if (z.stableGeometry !== undefined && !(Array.isArray(z.stableGeometry) && z.stableGeometry.length > 0 && z.stableGeometry.every(isStr))) {
      errors.push(`zone "${z.id}" stableGeometry must be a non-empty string[] of non-empty strings when present`);
    }
  });

  // Cast — child mandatory with a wardrobe.
  const cast = isObj(c.cast) ? c.cast : undefined;
  if (!cast) {
    errors.push('cast missing');
  } else {
    const child = isObj(cast.child) ? cast.child : undefined;
    if (!child || !isObj(child.wardrobe) || !isStr((child.wardrobe as Record<string, unknown>).description)) {
      errors.push('cast.child.wardrobe.description missing');
    }
    if (cast.companion !== undefined && cast.companion !== null) {
      const comp = cast.companion as Record<string, unknown>;
      if (!isObj(comp.wardrobe) || !isStr((comp.wardrobe as Record<string, unknown>).description)) {
        errors.push('cast.companion present but wardrobe.description missing');
      }
    }
  }

  // (Slice B) The valid cast-id space (child + companion + recurring humans) — used to resolve castStates below.
  const castIdSet = new Set<string>();
  if (cast) {
    const childC = isObj(cast.child) ? cast.child : undefined;
    if (childC && isStr(childC.id)) castIdSet.add(childC.id);
    const compC = isObj(cast.companion) ? cast.companion : undefined;
    if (compC && isStr(compC.id)) castIdSet.add(compC.id);
  }
  (Array.isArray(c.humanCast) ? c.humanCast : []).forEach((h) => {
    if (isObj(h) && isStr(h.id)) castIdSet.add(h.id);
  });

  // Recurring props — collect ids for propState validation.
  const propIds = new Set<string>();
  const props = Array.isArray(c.recurringProps) ? c.recurringProps : [];
  props.forEach((p, i) => {
    if (!isObj(p) || !isStr(p.id)) {
      errors.push(`recurringProps[${i}].id missing`);
      return;
    }
    propIds.add(p.id);
    // (Slice B) optional identity fields — OMIT when unauthored; each must be a non-empty string when present.
    for (const k of ['material', 'scale', 'persistence'] as const) {
      if (p[k] !== undefined && !isStr(p[k])) {
        errors.push(`recurringProps[${i}] (${p.id}) ${k} must be a non-empty string when present`);
      }
    }
  });

  // Cover contract — must point at a real location.
  const cover = isObj(c.coverContract) ? c.coverContract : undefined;
  if (!cover) {
    errors.push('coverContract missing');
  } else {
    if (!isStr(cover.worldType)) errors.push('coverContract.worldType missing');
    if (!isStr(cover.locationId) || !locationIds.has(cover.locationId)) {
      errors.push(`coverContract.locationId "${String(cover.locationId)}" not a declared location`);
    }
  }

  // Page contracts — the core authority checks.
  const pages = Array.isArray(c.pageContracts) ? c.pageContracts : [];
  if (pages.length === 0) errors.push('pageContracts[] must be non-empty');
  pages.forEach((p, i) => {
    if (!isObj(p)) {
      errors.push(`pageContracts[${i}] is not an object`);
      return;
    }
    const pc = p as Partial<PageVisualContract> & Record<string, unknown>;
    const label = typeof pc.pageNumber === 'number' ? `page ${pc.pageNumber}` : `pageContracts[${i}]`;
    if (typeof pc.pageNumber !== 'number') errors.push(`${label}.pageNumber must be a number`);
    if (!isStr(pc.locationId) || !locationIds.has(pc.locationId)) {
      errors.push(`${label}.locationId "${String(pc.locationId)}" not a declared location`);
    } else if (isStr(pc.zoneId)) {
      // zoneId must belong to THIS page's location — a zone can never live in another location.
      const zonesHere = zoneByLocation.get(pc.locationId);
      if (!zonesHere || !zonesHere.has(pc.zoneId)) {
        errors.push(`${label}.zoneId "${pc.zoneId}" is not a zone of location "${pc.locationId}"`);
      }
    }
    if (!isStr(pc.camera)) errors.push(`${label}.camera missing`);
    if (!isStrArr(pc.mustShow)) errors.push(`${label}.mustShow must be a string[]`);
    if (!isStrArr(pc.mustNotShow)) errors.push(`${label}.mustNotShow must be a string[]`);
    if (!isObj(pc.characterPresence) || typeof (pc.characterPresence as Record<string, unknown>).child !== 'boolean') {
      errors.push(`${label}.characterPresence.child must be boolean`);
    }
    if (Array.isArray(pc.propState)) {
      pc.propState.forEach((ps) => {
        if (isObj(ps) && isStr(ps.propId) && !propIds.has(ps.propId)) {
          errors.push(`${label} propState references unknown propId "${ps.propId}"`);
        }
      });
    }
    // (Slice B) optional per-(page,castId) body-state / laterality — OMIT the key when unauthored. To keep the
    // omit-when-unauthored HASH invariant fail-closed: if the key is present it MUST be a NON-EMPTY array (an authored
    // `[]` changes the frozen hash while emitting no steering → rejected), and every entry MUST carry ≥1 meaningful
    // authored field (bodyState OR a laterality field). A castId-only no-op entry likewise changes the hash while
    // emitting nothing → rejected. Malformed values fail closed at load AND at freeze.
    if (pc.castStates !== undefined) {
      if (!Array.isArray(pc.castStates)) {
        errors.push(`${label}.castStates must be an array when present`);
      } else if (pc.castStates.length === 0) {
        errors.push(`${label}.castStates must be a NON-EMPTY array when present — omit the key instead of []`);
      } else {
        // Presence rule: a body-state / laterality is only meaningful for a cast member PRESENT on THIS page.
        // Its castId MUST be in this page's castIds — not merely globally valid — so a draft cannot emit a
        // BODY STATE (or laterality) for an ABSENT character (facts overlaid LAST; fail-closed belt).
        const pageCastIds = new Set(Array.isArray(pc.castIds) ? (pc.castIds as unknown[]).filter(isStr) : []);
        (pc.castStates as unknown[]).forEach((cs, j) => {
          if (!isObj(cs) || !isStr(cs.castId)) {
            errors.push(`${label}.castStates[${j}].castId missing`);
            return;
          }
          if (castIdSet.size > 0 && !castIdSet.has(cs.castId)) {
            errors.push(`${label}.castStates[${j}] references unknown castId "${cs.castId}"`);
          } else if (!pageCastIds.has(cs.castId)) {
            errors.push(
              `${label}.castStates[${j}] castId "${cs.castId}" is NOT present on this page (must be in castIds) — no body-state/laterality for an absent cast member`
            );
          }
          if (cs.bodyState !== undefined && !isStr(cs.bodyState)) {
            errors.push(`${label}.castStates[${j}].bodyState must be a non-empty string when present`);
          }
          for (const k of ['injectionArm', 'bandageArm', 'freeHand'] as const) {
            if (cs[k] !== undefined && cs[k] !== 'left' && cs[k] !== 'right') {
              errors.push(`${label}.castStates[${j}].${k} must be 'left' or 'right' when present`);
            }
          }
          // Reject a no-op entry (only castId, no authored state/laterality): it changes the hash but steers nothing.
          const hasAuthoredField =
            cs.bodyState !== undefined ||
            cs.injectionArm !== undefined ||
            cs.bandageArm !== undefined ||
            cs.freeHand !== undefined;
          if (!hasAuthoredField) {
            errors.push(
              `${label}.castStates[${j}] (castId "${cs.castId}") must carry at least one authored field (bodyState / injectionArm / bandageArm / freeHand) — a castId-only entry emits no steering and must be omitted`
            );
          }
        });
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, contract: input as unknown as BookVisualContract };
}

/** Fail-closed assertion for the production path: throws InvalidVisualContractError on any problem. */
export function assertValidBookVisualContract(input: unknown): asserts input is BookVisualContract {
  const result = validateBookVisualContract(input);
  if (!result.ok) throw new InvalidVisualContractError(result.errors);
}
