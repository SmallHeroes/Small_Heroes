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
      // scaleContract (optional, but when present it must be well-formed — see lib/companion-scale.ts).
      const sc = comp.scaleContract;
      if (sc !== undefined && sc !== null) {
        if (!isObj(sc)) {
          errors.push('cast.companion.scaleContract must be an object');
        } else {
          const ratio = sc.ratioToChild;
          const band = sc.ratioBand;
          if (typeof ratio !== 'number' || !(ratio > 0 && ratio < 1)) {
            errors.push('scaleContract.ratioToChild must be a number in (0,1)');
          }
          if (
            !Array.isArray(band) ||
            band.length !== 2 ||
            typeof band[0] !== 'number' ||
            typeof band[1] !== 'number' ||
            !(band[0] > 0 && band[0] < band[1] && band[1] <= 1)
          ) {
            errors.push('scaleContract.ratioBand must be [min,max] numbers with 0<min<max<=1');
          } else if (typeof ratio === 'number' && (ratio < band[0] || ratio > band[1])) {
            errors.push('scaleContract.ratioToChild must lie within ratioBand');
          }
          if (!isStr(sc.humanLandmark)) errors.push('scaleContract.humanLandmark missing');
          if (!isStrArr(sc.prohibitions)) errors.push('scaleContract.prohibitions must be a string[]');
        }
      }
    }
  }

  // Recurring props — collect ids for propState validation.
  const propIds = new Set<string>();
  const props = Array.isArray(c.recurringProps) ? c.recurringProps : [];
  props.forEach((p, i) => {
    if (!isObj(p) || !isStr(p.id)) {
      errors.push(`recurringProps[${i}].id missing`);
      return;
    }
    propIds.add(p.id);
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
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, contract: input as unknown as BookVisualContract };
}

/** Fail-closed assertion for the production path: throws InvalidVisualContractError on any problem. */
export function assertValidBookVisualContract(input: unknown): asserts input is BookVisualContract {
  const result = validateBookVisualContract(input);
  if (!result.ok) throw new InvalidVisualContractError(result.errors);
}
