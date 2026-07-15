/**
 * Deterministic, fail-closed validation of a BookVisualContract.
 *
 * The whole system's authority rests on the contract being structurally sound: every page must point
 * at a real location, every zone at a real parent location, the cast/cover/props must be coherent.
 * A malformed contract (bad LLM JSON, dangling locationId, zone in the wrong location — the exact
 * gate→cave class of bug) must FAIL CLOSED, never silently pass.
 */
import { projectZoneStableGeometry } from './projectContractProse';
import {
  BOOK_VISUAL_CONTRACT_VERSION,
  type BookVisualContract,
  type PageVisualContract,
  type VisualZone,
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

/* ── Contract v2 (Stage 3) — CLOSED enums, checked at RUNTIME ─────────────────────────────────────
 * The TS unions are erased at runtime and these contracts arrive as JSON parsed from an artifact, so each closed
 * enum needs a runtime Set — the established vNext convention (a TS type alone protects nothing here).
 */
const SPATIAL_NODE_KINDS = new Set(['doorway', 'window', 'balcony_door', 'railing', 'ledge', 'wall', 'floor', 'furniture']);
const SPATIAL_RELATION_KINDS = new Set(['on_same_wall_as', 'adjacent_to', 'opposite_to', 'above', 'below', 'centered_in']);
const PROP_VISIBILITIES = new Set(['required', 'forbidden', 'optional']);
const ACTION_PREDICATES = new Set(['holds', 'offers', 'touches', 'looks_at', 'reaches_toward', 'climbs_onto', 'sits_on', 'stands_on', 'points_at']);
const ACTION_POLARITIES = new Set(['must', 'must_not']);
const SAFETY_RELATIONS = new Set([
  'must_not_sit_on',
  'must_not_stand_on',
  'must_not_lean_over',
  'must_not_pass_beyond',
  'must_not_be_unsupported_at',
  'must_not_be_within_reach_of',
  'must_not_be_inside',
]);
const ENTITY_REF_KINDS = new Set(['cast', 'prop', 'spatial', 'anchor']);
const SAFETY_ORIGIN_KINDS = new Set(['story_evidence', 'authored', 'policy_default']);
/** Namespaced so an action check id can never collide with a QA check id or the `safety:` evidence tag. */
const CHECK_ID_RE = /^action:[a-z0-9_]+$/;

/**
 * The vNext omit-when-unauthored rule, made FAIL-CLOSED: a key that is present MUST be a non-empty array. An
 * authored `[]` moves the frozen contract hash while emitting no steering, so it is rejected rather than tolerated.
 * Returns the array only when it is usable.
 */
function nonEmptyArrayOrNull(value: unknown, label: string, errors: string[]): unknown[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array when present`);
    return null;
  }
  if (value.length === 0) {
    errors.push(`${label} must be a NON-EMPTY array when present — omit the key instead of []`);
    return null;
  }
  return value;
}

/** The id spaces an `EntityRef` may resolve against, narrowed to ONE page's scope. */
interface RefScope {
  castIdSet: Set<string>;
  propIds: Set<string>;
  /** The ids of THIS page's own zone's spatialNodes — zone-scoped, so a ref can never reach another zone. */
  zoneNodeIds: Set<string>;
  /** The ids of THIS page's location's anchors. */
  anchorIds: Set<string>;
}

/** Single-hop resolution of a typed reference against the ONE id space its `kind` names. */
function validateEntityRef(ref: unknown, label: string, scope: RefScope, errors: string[]): void {
  if (!isObj(ref) || !isStr(ref.kind) || !isStr(ref.id)) {
    errors.push(`${label} must be an EntityRef { kind, id }`);
    return;
  }
  if (!ENTITY_REF_KINDS.has(ref.kind)) {
    errors.push(`${label}.kind "${ref.kind}" is not one of ${[...ENTITY_REF_KINDS].join(' | ')}`);
    return;
  }
  const spaces: Record<string, { set: Set<string>; what: string; skipWhenEmpty: boolean }> = {
    // `cast` alone tolerates an empty space: a contract with no cast already reports "cast missing", and piling
    // "unknown castId" onto every entry is noise (the established castStates convention).
    cast: { set: scope.castIdSet, what: 'cast member', skipWhenEmpty: true },
    // The rest must NOT skip when empty — an empty space means the ref has NOTHING to resolve against, which is a
    // dangling ref, not an absent check. A zone legitimately declares no spatialNodes (that is the v1 default), so
    // skipping-when-empty would let every spatial ref fail OPEN. Matches the propState convention (no size guard).
    prop: { set: scope.propIds, what: 'recurringProp', skipWhenEmpty: false },
    spatial: { set: scope.zoneNodeIds, what: "spatialNode of this page's own zone", skipWhenEmpty: false },
    anchor: { set: scope.anchorIds, what: "anchor of this page's location", skipWhenEmpty: false },
  };
  const space = spaces[ref.kind];
  if (space.skipWhenEmpty && space.set.size === 0) return;
  if (!space.set.has(ref.id)) {
    errors.push(`${label} references unknown ${space.what} "${ref.id}"`);
  }
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
  /** (Stage 3) per-location anchor ids — the id space an `{ kind:'anchor' }` EntityRef resolves against. */
  const anchorsByLocation = new Map<string, Set<string>>();
  locations.forEach((loc, i) => {
    if (!isObj(loc) || !isStr(loc.id)) {
      errors.push(`locations[${i}].id missing`);
      return;
    }
    if (locationIds.has(loc.id)) errors.push(`duplicate location id "${loc.id}"`);
    locationIds.add(loc.id);
    if (!isStr(loc.name)) errors.push(`locations[${i}] (${loc.id}) name missing`);
    const anchorIds = new Set<string>();
    (Array.isArray(loc.anchors) ? loc.anchors : []).forEach((a) => {
      if (isObj(a) && isStr(a.id)) anchorIds.add(a.id);
    });
    anchorsByLocation.set(loc.id, anchorIds);
  });

  // Zones — every zone must belong to a declared location (the gate→cave guard).
  const zones = Array.isArray(c.zones) ? c.zones : [];
  const zoneByLocation = new Map<string, Set<string>>();
  /** (Stage 3) zone lookup — a page resolves `{ kind:'spatial' }` refs against its OWN zone's nodes only. */
  const zoneById = new Map<string, VisualZone>();
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
    zoneById.set(z.id, z as unknown as VisualZone);
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
    // (Stage 3) the prop LIFECYCLE — the first page this prop may be visible on. Page 0 is the cover, which
    // precedes every page, so a prop revealable on the cover has NO lifecycle → omit the key (never 0, never null).
    if (p.firstRevealPage !== undefined) {
      if (typeof p.firstRevealPage !== 'number' || !Number.isInteger(p.firstRevealPage) || p.firstRevealPage < 1) {
        errors.push(
          `recurringProps[${i}] (${p.id}) firstRevealPage must be an integer >= 1 when present — omit the key for a prop with no lifecycle`
        );
      }
    }
  });

  // ── Contract v2 (Stage 3): structured zone GEOMETRY. Runs after props/anchors are collected (a node may bind to
  // either). EVERY check below fires only when the new key is PRESENT, so v1 contracts — which author none of this —
  // are untouched and keep hashing byte-identically. That is a correctness requirement, not politeness: a rule that
  // rejected a shipped artifact would NOT fail loudly, because the freeze path catches a contract-load throw and
  // silently degrades to the legacy path — i.e. a tightening buys a silent loss of steering.
  zones.forEach((z) => {
    if (!isObj(z) || !isStr(z.id)) return; // shape already reported above
    const zLabel = `zone "${z.id}"`;
    // Watermark: did THIS zone's structure record any problem? The Tier-A equality below is only meaningful — and
    // only safe — against well-formed structure (see the guard there).
    const errorsBeforeZone = errors.length;

    const nodes = nonEmptyArrayOrNull(z.spatialNodes, `${zLabel}.spatialNodes`, errors);
    const nodeIds = new Set<string>();
    if (nodes) {
      nodes.forEach((n, j) => {
        if (!isObj(n) || !isStr(n.id)) {
          errors.push(`${zLabel}.spatialNodes[${j}].id missing`);
          return;
        }
        if (nodeIds.has(n.id)) errors.push(`${zLabel} duplicate spatialNode id "${n.id}"`);
        nodeIds.add(n.id);
        if (!isStr(n.kind) || !SPATIAL_NODE_KINDS.has(n.kind)) {
          errors.push(
            `${zLabel}.spatialNodes[${j}] (${n.id}) kind "${String(n.kind)}" is not one of ${[...SPATIAL_NODE_KINDS].join(' | ')}`
          );
        }
        if (!isStr(n.description)) errors.push(`${zLabel}.spatialNodes[${j}] (${n.id}) description missing`);
        if (n.bindsTo !== undefined) {
          const bind = n.bindsTo;
          const bLabel = `${zLabel}.spatialNodes[${j}] (${n.id}) bindsTo`;
          if (!isObj(bind) || !isStr(bind.kind) || !isStr(bind.id)) {
            errors.push(`${bLabel} must be an EntityRef { kind, id }`);
          } else if (bind.kind !== 'prop' && bind.kind !== 'anchor') {
            errors.push(`${bLabel}.kind must be 'prop' or 'anchor' — a node binds only to an already-declared prop or anchor`);
          } else if (bind.kind === 'prop') {
            if (!propIds.has(bind.id)) {
              errors.push(`${bLabel} references unknown recurringProp "${bind.id}"`);
            }
          } else {
            const anchorIds = anchorsByLocation.get(String(z.locationId)) ?? new Set<string>();
            if (!anchorIds.has(bind.id)) {
              errors.push(`${bLabel} references unknown anchor "${bind.id}" of location "${String(z.locationId)}"`);
            }
          }
        }
      });
    }

    const relations = nonEmptyArrayOrNull(z.spatialRelations, `${zLabel}.spatialRelations`, errors);
    if (relations) {
      if (z.spatialNodes === undefined) {
        errors.push(`${zLabel}.spatialRelations present without spatialNodes — a relation needs nodes to relate`);
      }
      relations.forEach((r, j) => {
        const rLabel = `${zLabel}.spatialRelations[${j}]`;
        if (!isObj(r) || !isStr(r.subjectId) || !isStr(r.relation)) {
          errors.push(`${rLabel} needs subjectId + relation`);
          return;
        }
        if (!SPATIAL_RELATION_KINDS.has(r.relation)) {
          errors.push(`${rLabel} relation "${r.relation}" is not one of ${[...SPATIAL_RELATION_KINDS].join(' | ')}`);
        }
        if (nodeIds.size > 0 && !nodeIds.has(r.subjectId)) {
          errors.push(`${rLabel} references unknown spatialNode subjectId "${r.subjectId}" — relations are INTRA-ZONE only`);
        }
        if (r.relation === 'centered_in') {
          if (r.objectId !== undefined) {
            errors.push(`${rLabel} centered_in takes no objectId — its object is the zone itself`);
          }
        } else if (!isStr(r.objectId)) {
          errors.push(`${rLabel} objectId is required for relation "${String(r.relation)}"`);
        } else if (nodeIds.size > 0 && !nodeIds.has(r.objectId)) {
          errors.push(`${rLabel} references unknown spatialNode objectId "${r.objectId}" — relations are INTRA-ZONE only`);
        }
      });
    }

    // TIER A — THE AUTHORITY SWITCH. The moment a zone authors `spatialNodes`, its `stableGeometry` prose stops
    // being an independently-editable authority and MUST equal the deterministic projection of that structure.
    // Gated on presence, so a v1 zone (no structure) keeps its hand-authored prose untouched — the switch is
    // per-ZONE, not per-contract and not per-schema-version. Inert on every shipped artifact (none author structure).
    // Only compare against a projection of structure we have NOT already rejected: the node/relation loops above
    // FLAG a malformed entry without filtering it, so projecting here would (a) pile a confusing "does not equal the
    // projection" on top of the real errors and (b) hand malformed input to the projection. The structure's own
    // errors are the useful ones; equality is checked once the structure is sound.
    const zoneStructureSound = errors.length === errorsBeforeZone;
    if (z.spatialNodes !== undefined && nodes && zoneStructureSound) {
      const projected = projectZoneStableGeometry(z as unknown as VisualZone);
      const stored = z.stableGeometry;
      const equal =
        Array.isArray(stored) &&
        projected !== undefined &&
        stored.length === projected.length &&
        stored.every((s, k) => s === projected[k]);
      if (!equal) {
        errors.push(
          `${zLabel}.stableGeometry must EQUAL the projection of its spatialNodes/spatialRelations — it is a deterministic PROJECTION of the structure, not an independent authority. Expected ${JSON.stringify(projected)}`
        );
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

    // ── Contract v2 (Stage 3): structured per-page PROPS / ACTIONS / HAZARDS. Present-only, like every rule above.
    const pageCastIdSet = new Set(Array.isArray(pc.castIds) ? (pc.castIds as unknown[]).filter(isStr) : []);
    const pageZone = isStr(pc.zoneId) ? zoneById.get(pc.zoneId) : undefined;
    const zoneNodeIds = new Set<string>(
      (pageZone?.spatialNodes ?? []).map((n) => n?.id).filter((id): id is string => isStr(id))
    );
    const scope: RefScope = {
      castIdSet,
      propIds,
      zoneNodeIds,
      anchorIds: anchorsByLocation.get(String(pc.locationId)) ?? new Set<string>(),
    };

    const propConstraints = nonEmptyArrayOrNull(pc.propConstraints, `${label}.propConstraints`, errors);
    if (propConstraints) {
      const visibilityByProp = new Map<string, string>();
      propConstraints.forEach((raw, j) => {
        const cLabel = `${label}.propConstraints[${j}]`;
        if (!isObj(raw) || !isStr(raw.propId)) {
          errors.push(`${cLabel}.propId missing`);
          return;
        }
        if (!propIds.has(raw.propId)) {
          errors.push(`${cLabel} references unknown propId "${raw.propId}"`);
        }
        if (!isStr(raw.visibility) || !PROP_VISIBILITIES.has(raw.visibility)) {
          errors.push(
            `${cLabel} (${raw.propId}) visibility "${String(raw.visibility)}" is not one of ${[...PROP_VISIBILITIES].join(' | ')}`
          );
        } else {
          // Intra-page self-contradiction — detectable from shape alone, so it belongs in Stage 3.
          const prior = visibilityByProp.get(raw.propId);
          if (prior !== undefined && prior !== raw.visibility) {
            errors.push(
              `${label}.propConstraints declares propId "${raw.propId}" as both "${prior}" and "${raw.visibility}" on the same page`
            );
          }
          visibilityByProp.set(raw.propId, raw.visibility);
        }
        if (raw.stateId !== undefined && !isStr(raw.stateId)) {
          errors.push(`${cLabel} (${raw.propId}) stateId must be a non-empty string when present`);
        }
        if (raw.anchorId !== undefined) {
          if (!isStr(raw.anchorId)) {
            errors.push(`${cLabel} (${raw.propId}) anchorId must be a non-empty string when present`);
          } else if (!scope.anchorIds.has(raw.anchorId)) {
            errors.push(`${cLabel} (${raw.propId}) references unknown anchorId "${raw.anchorId}" of location "${String(pc.locationId)}"`);
          }
        }
      });
    }

    const actions = nonEmptyArrayOrNull(pc.actionRequirements, `${label}.actionRequirements`, errors);
    if (actions) {
      const checkIds = new Set<string>();
      actions.forEach((raw, j) => {
        const aLabel = `${label}.actionRequirements[${j}]`;
        if (!isObj(raw)) {
          errors.push(`${aLabel} is not an object`);
          return;
        }
        if (!isStr(raw.checkId) || !CHECK_ID_RE.test(raw.checkId)) {
          errors.push(`${aLabel} checkId "${String(raw.checkId)}" must match ${String(CHECK_ID_RE)} (a namespaced, stable id)`);
        } else if (checkIds.has(raw.checkId)) {
          errors.push(`${label}.actionRequirements duplicate checkId "${raw.checkId}" on the same page`);
        } else {
          checkIds.add(raw.checkId);
        }
        if (!isStr(raw.actorId)) {
          errors.push(`${aLabel}.actorId missing`);
        } else if (castIdSet.size > 0 && !castIdSet.has(raw.actorId)) {
          errors.push(`${aLabel} references unknown castId "${raw.actorId}"`);
        } else if (!pageCastIdSet.has(raw.actorId)) {
          errors.push(
            `${aLabel} actorId "${raw.actorId}" is NOT present on this page (must be in castIds) — no action requirement for an absent actor`
          );
        }
        if (!isStr(raw.predicate) || !ACTION_PREDICATES.has(raw.predicate)) {
          errors.push(`${aLabel} predicate "${String(raw.predicate)}" is not one of ${[...ACTION_PREDICATES].join(' | ')}`);
        }
        if (!isStr(raw.polarity) || !ACTION_POLARITIES.has(raw.polarity)) {
          errors.push(`${aLabel} polarity "${String(raw.polarity)}" must be 'must' or 'must_not'`);
        }
        if (raw.object !== undefined) validateEntityRef(raw.object, `${aLabel}.object`, scope, errors);
        if (raw.laterality !== undefined && raw.laterality !== 'left' && raw.laterality !== 'right') {
          errors.push(`${aLabel}.laterality must be 'left' or 'right' when present`);
        }
      });
    }

    const safetyConstraints = nonEmptyArrayOrNull(pc.safetyConstraints, `${label}.safetyConstraints`, errors);
    if (safetyConstraints) {
      safetyConstraints.forEach((raw, j) => {
        const sLabel = `${label}.safetyConstraints[${j}]`;
        if (!isObj(raw)) {
          errors.push(`${sLabel} is not an object`);
          return;
        }
        if (!isStr(raw.subjectId)) {
          errors.push(`${sLabel}.subjectId missing`);
        } else if (castIdSet.size > 0 && !castIdSet.has(raw.subjectId)) {
          errors.push(`${sLabel} references unknown castId "${raw.subjectId}"`);
        } else if (!pageCastIdSet.has(raw.subjectId)) {
          errors.push(
            `${sLabel} subjectId "${raw.subjectId}" is NOT present on this page (must be in castIds) — no hazard constraint for an absent subject`
          );
        }
        if (!isStr(raw.relation) || !SAFETY_RELATIONS.has(raw.relation)) {
          errors.push(`${sLabel} relation "${String(raw.relation)}" is not one of ${[...SAFETY_RELATIONS].join(' | ')}`);
        }
        validateEntityRef(raw.target, `${sLabel}.target`, scope, errors);
        // Typed evidence origin: every hazard traces to story text, a named human, or a versioned policy — there is
        // deliberately no `derived` kind, because a model can hallucinate a fully-consistent contract from nothing.
        const origin = raw.origin;
        if (!isObj(origin) || !isStr(origin.kind) || !SAFETY_ORIGIN_KINDS.has(origin.kind)) {
          errors.push(`${sLabel}.origin.kind must be one of ${[...SAFETY_ORIGIN_KINDS].join(' | ')}`);
        } else if (origin.kind === 'story_evidence') {
          if (typeof origin.page !== 'number' || !Number.isInteger(origin.page)) {
            errors.push(`${sLabel}.origin (story_evidence) needs an integer page`);
          }
          if (!isStr(origin.phrase)) errors.push(`${sLabel}.origin (story_evidence) needs a non-empty phrase`);
        } else if (origin.kind === 'authored') {
          if (!isStr(origin.authorNote)) errors.push(`${sLabel}.origin (authored) needs a non-empty authorNote`);
        } else if (origin.kind === 'policy_default') {
          if (!isStr(origin.policyId) || !isStr(origin.version)) {
            errors.push(`${sLabel}.origin (policy_default) needs policyId + version`);
          }
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
