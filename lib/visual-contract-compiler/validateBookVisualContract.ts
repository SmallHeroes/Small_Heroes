/**
 * Deterministic, fail-closed validation of a BookVisualContract.
 *
 * The whole system's authority rests on the contract being structurally sound: every page must point
 * at a real location, every zone at a real parent location, the cast/cover/props must be coherent.
 * A malformed contract (bad LLM JSON, dangling locationId, zone in the wrong location — the exact
 * gate→cave class of bug) must FAIL CLOSED, never silently pass.
 */
import { resolvePageCheckIds } from './pageCheckIds';
import { VISUAL_CONTRACT_SCHEMA_VERSION } from './contractTemplateTypes';
import {
  projectCoverMustNotShow,
  projectPageMustNotShow,
  projectPageMustShow,
  projectZoneStableGeometry,
} from './projectContractProse';
import {
  ACTION_POLARITY_VALUES,
  ACTION_PREDICATE_VALUES,
  ACTION_SPATIAL_DIRECTION_VALUES,
  ACTION_SPATIAL_RELATION_VALUES,
  ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
  BOOK_VISUAL_CONTRACT_VERSION,
  type BookVisualContract,
  type PageVisualContract,
  type VisualZone,
} from './types';
import {
  actionSemanticDefinition,
  isActionPredicate,
} from './actionSemanticCatalog';
import { SOURCE_EVIDENCE_ID_PATTERN } from './sourceEvidenceCatalog';
import { setBoardStableAuthorityErrors } from './setBoardStableAuthority';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
  type PageFinalStructuralCause,
} from './draftValidationDiagnostics';
import {
  classifyPagePropConstraints,
  type PagePropConstraintViolation,
} from './pagePropConstraintValidation';

export type ContractValidationResult =
  | { ok: true; contract: BookVisualContract }
  | {
      ok: false;
      errors: string[];
      diagnosticIssues: readonly DraftValidationIssue[];
    };

export class InvalidVisualContractError extends Error {
  readonly isInvalidVisualContract = true as const;
  readonly diagnosticIssues: readonly DraftValidationIssue[];

  constructor(
    readonly errors: string[],
    diagnosticIssues: readonly DraftValidationIssue[],
  ) {
    super(`Invalid BookVisualContract: ${errors.join('; ')}`);
    this.name = 'InvalidVisualContractError';
    if (
      !Array.isArray(diagnosticIssues) ||
      diagnosticIssues.length === 0 ||
      !diagnosticIssues.every(draftValidationIssueIsValid)
    ) {
      throw new Error('draft validation diagnostic contract invalid');
    }
    this.diagnosticIssues = diagnosticIssues.map((issue) =>
      structuredClone(issue),
    );
  }
}

class DraftValidationErrorCollector extends Array<string> {
  readonly diagnosticIssues: DraftValidationIssue[] = [];
  private currentIssue: DraftValidationIssue;

  constructor(initialIssue: DraftValidationIssue) {
    super();
    this.currentIssue = initialIssue;
  }

  useIssue(issue: DraftValidationIssue): void {
    if (!draftValidationIssueIsValid(issue)) {
      throw new Error('draft validation diagnostic contract invalid');
    }
    this.currentIssue = issue;
  }

  override push(...items: string[]): number {
    for (const _item of items) {
      this.diagnosticIssues.push(structuredClone(this.currentIssue));
    }
    return super.push(...items);
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

function pageFinalStructuralIssue(
  page: unknown,
  pageIndex: number,
  cause: PageFinalStructuralCause,
): DraftValidationIssue {
  return isObj(page) &&
    typeof page.pageNumber === 'number' &&
    Number.isSafeInteger(page.pageNumber) &&
    page.pageNumber > 0
    ? {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'page',
          fieldRole: 'final_structure',
          pageNumber: page.pageNumber,
        },
        causes: [cause],
      }
    : {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'collection_item',
          collectionRole: 'page_contracts',
          fieldRole: 'final_structure',
          itemIndex: pageIndex,
        },
      };
}

/* ── Contract v2 (Stage 3) — CLOSED enums, checked at RUNTIME ─────────────────────────────────────
 * The TS unions are erased at runtime and these contracts arrive as JSON parsed from an artifact, so each closed
 * enum needs a runtime Set — the established vNext convention (a TS type alone protects nothing here).
 */
const SPATIAL_NODE_KINDS = new Set(['doorway', 'window', 'balcony_door', 'railing', 'ledge', 'wall', 'floor', 'furniture']);
const SPATIAL_RELATION_KINDS = new Set(['on_same_wall_as', 'adjacent_to', 'opposite_to', 'above', 'below', 'centered_in']);
// Stage-4 decision: 'optional' is DROPPED — it emitted no steering yet moved the frozen hash (the no-op class this
// layer rejects). The absence of a constraint already means "optional"; omit the entry instead.
const PROP_VISIBILITIES = new Set(['required', 'forbidden']);
/** (SET-CONSISTENCY step 2) the closed setReference status vocabulary — a location's Set Identity Board policy. */
const SET_REFERENCE_STATUSES = new Set(['none', 'pending', 'ready']);
const ACTION_SPATIAL_DIRECTIONS = new Set<string>(
  ACTION_SPATIAL_DIRECTION_VALUES,
);
const ACTION_SPATIAL_RELATIONS = new Set<string>(
  ACTION_SPATIAL_RELATION_VALUES,
);
const ACTION_SPATIAL_CONSTRAINT_RELATIONS = new Set<string>(
  ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
);

/* ── Stage 4 — relation coherence tables ────────────────────────────────────────────────────────── */
/** Order-independent relations: `adjacent_to(a,b)` states the SAME fact as `adjacent_to(b,a)`. */
const SYMMETRIC_RELATIONS = new Set(['on_same_wall_as', 'adjacent_to', 'opposite_to']);
/** Directed relations that are each other's inverse — `above(a,b)` states the SAME fact as `below(b,a)`. */
const INVERSE_RELATIONS: Record<string, string> = { above: 'below', below: 'above' };
/** Relation pairs that cannot both hold between the same two nodes. */
const MUTUALLY_EXCLUSIVE_RELATIONS: Array<[string, string]> = [['on_same_wall_as', 'opposite_to']];
const ACTION_POLARITIES = new Set<string>(
  ACTION_POLARITY_VALUES,
);
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

function canonicalStringCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
  if (
    JSON.stringify(Object.keys(ref).sort()) !==
    JSON.stringify(['id', 'kind'])
  ) {
    errors.push(`${label} must contain only kind + id`);
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
  const c = input as Record<string, unknown>;

  if (!isObj(input)) {
    return {
      ok: false,
      errors: ['contract is not an object'],
      diagnosticIssues: [{
        family: 'draft_schema',
        code: 'value_type_invalid',
        locator: { kind: 'root', fieldRole: 'root' },
      }],
    };
  }
  const errors = new DraftValidationErrorCollector({
    family: 'draft_schema',
    code: 'value_domain_invalid',
    locator: { kind: 'root', fieldRole: 'root' },
  });
  if (c.version !== BOOK_VISUAL_CONTRACT_VERSION) {
    errors.push(`version must be ${BOOK_VISUAL_CONTRACT_VERSION}`);
  }
  if (!isStr(c.worldType)) errors.push('worldType missing');
  if (!isStrArr(c.forbiddenGlobalElements)) errors.push('forbiddenGlobalElements must be a string[]');

  // Locations
  errors.useIssue({
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'collection',
      collectionRole: 'locations',
      fieldRole: 'final_structure',
    },
  });
  const locations = Array.isArray(c.locations) ? c.locations : [];
  if (locations.length === 0) errors.push('locations[] must be non-empty');
  const locationIds = new Set<string>();
  /** (Stage 3) per-location anchor ids — the id space an `{ kind:'anchor' }` EntityRef resolves against. */
  const anchorsByLocation = new Map<string, Set<string>>();
  /** (SET-CONSISTENCY step 2) setIdentityId → its board REQUIREDNESS + the first location that declared it. Locations
   *  sharing an identity must agree, so a physical set is never HALF board-required (a mixed set would render one
   *  chunk board-bound and another legacy — the half-legacy book the freeze snapshot exists to prevent). */
  const setIdentityRequiredness = new Map<string, { required: boolean; locId: string }>();
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

    // (SET-CONSISTENCY step 2) optional setIdentityId + setReference policy — additive, so a contract that authors
    // neither is untouched (both absent → no-op). Present-only checks; fail closed on ambiguous/contradictory data.
    if (loc.setIdentityId !== undefined && !isStr(loc.setIdentityId)) {
      errors.push(`location "${loc.id}" setIdentityId must be a non-empty string when present`);
    }
    let boardRequired = false;
    if (loc.setReference !== undefined) {
      const ref = loc.setReference;
      if (!isObj(ref) || !isStr(ref.status) || !SET_REFERENCE_STATUSES.has(ref.status)) {
        errors.push(
          `location "${loc.id}" setReference.status must be one of ${[...SET_REFERENCE_STATUSES].join(' | ')} when present`,
        );
      } else {
        boardRequired = ref.status === 'pending' || ref.status === 'ready';
        // A required board must have an identity to bind to — nothing keys the registry lookup otherwise.
        if (boardRequired && !isStr(loc.setIdentityId)) {
          errors.push(
            `location "${loc.id}" declares a required setReference ("${ref.status}") but no setIdentityId — a required board needs a set identity to bind to`,
          );
        }
      }
    }
    if (isStr(loc.setIdentityId)) {
      const prior = setIdentityRequiredness.get(loc.setIdentityId);
      if (prior === undefined) {
        setIdentityRequiredness.set(loc.setIdentityId, { required: boardRequired, locId: loc.id });
      } else if (prior.required !== boardRequired) {
        errors.push(
          `setIdentityId "${loc.setIdentityId}" has contradictory reference policies: location "${prior.locId}" is ${prior.required ? 'board-required' : 'legacy'} but location "${loc.id}" is ${boardRequired ? 'board-required' : 'legacy'} — locations sharing a set identity must agree on whether a board is required`,
        );
      }
    }
  });

  // Zones — every zone must belong to a declared location (the gate→cave guard).
  errors.useIssue({
    family: 'draft_contract',
    code: 'topology_malformed',
    locator: {
      kind: 'collection',
      collectionRole: 'zones',
      fieldRole: 'topology',
    },
  });
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
  errors.useIssue({
    family: 'draft_contract',
    code: 'cast_authority_mismatch',
    locator: { kind: 'root', fieldRole: 'cast_presence' },
  });
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
  errors.useIssue({
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'collection',
      collectionRole: 'recurring_props',
      fieldRole: 'final_structure',
    },
  });
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
  errors.useIssue({
    family: 'draft_contract',
    code: 'topology_malformed',
    locator: {
      kind: 'collection',
      collectionRole: 'zones',
      fieldRole: 'topology',
    },
  });
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

      // ── Stage 4: relation COHERENCE — self-reference, exact duplication, and contradiction. All three are
      // decidable from the zone alone. Facts are canonicalized first so the SAME statement written two ways is
      // recognized as one: a symmetric relation is order-independent, and `below(a,b)` IS `above(b,a)`.
      const canonicalFacts = new Map<string, string>(); // canonical key → the source label that declared it
      const pairRelations = new Map<string, Set<string>>(); // unordered node pair → the relations asserted on it
      relations.forEach((r, j) => {
        if (!isObj(r) || !isStr(r.subjectId) || !isStr(r.relation)) return;
        if (!SPATIAL_RELATION_KINDS.has(r.relation)) return; // enum already reported
        const rLabel = `${zLabel}.spatialRelations[${j}]`;

        if (r.relation === 'centered_in') {
          const key = `centered_in|${r.subjectId}`;
          if (canonicalFacts.has(key)) errors.push(`${rLabel} duplicates the relation already declared by ${canonicalFacts.get(key)}`);
          else canonicalFacts.set(key, rLabel);
          return;
        }
        if (!isStr(r.objectId)) return; // missing objectId already reported

        // A node cannot be spatially related to ITSELF — no such geometry fact exists.
        if (r.objectId === r.subjectId) {
          errors.push(`${rLabel} relates spatialNode "${r.subjectId}" to itself ("${r.relation}") — a node has no spatial relation to itself`);
          return;
        }

        // Canonicalize: symmetric → sorted pair; below(a,b) → above(b,a). One fact, one key.
        let key: string;
        if (SYMMETRIC_RELATIONS.has(r.relation)) {
          key = `${r.relation}|${[r.subjectId, r.objectId].sort().join('~')}`;
        } else if (r.relation === 'below') {
          key = `above|${r.objectId}>${r.subjectId}`;
        } else {
          key = `${r.relation}|${r.subjectId}>${r.objectId}`;
        }
        const prior = canonicalFacts.get(key);
        if (prior) {
          errors.push(
            `${rLabel} duplicates the relation already declared by ${prior} (the same fact stated twice — it moves the frozen hash and steers nothing)`
          );
          return;
        }
        canonicalFacts.set(key, rLabel);

        // Contradiction A — the inverse of a declared directed fact: above(a,b) AND above(b,a) cannot both hold.
        if (INVERSE_RELATIONS[r.relation]) {
          const inverseKey =
            r.relation === 'below'
              ? `above|${r.subjectId}>${r.objectId}`
              : `above|${r.objectId}>${r.subjectId}`;
          const clash = canonicalFacts.get(inverseKey);
          if (clash && clash !== rLabel) {
            errors.push(
              `${rLabel} contradicts ${clash}: "${r.subjectId}" and "${r.objectId}" cannot each be above the other`
            );
          }
        }

        const pairKey = [r.subjectId, r.objectId].sort().join('~');
        if (!pairRelations.has(pairKey)) pairRelations.set(pairKey, new Set());
        pairRelations.get(pairKey)!.add(r.relation);
      });

      // Contradiction B — mutually exclusive relations asserted on the same pair of nodes.
      for (const [pairKey, rels] of pairRelations) {
        for (const [a, b] of MUTUALLY_EXCLUSIVE_RELATIONS) {
          if (rels.has(a) && rels.has(b)) {
            errors.push(
              `${zLabel}.spatialRelations declares both "${a}" and "${b}" between the same nodes (${pairKey.replace('~', ' / ')}) — they cannot both hold`
            );
          }
        }
      }
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
  errors.useIssue({
    family: 'draft_contract',
    code: 'cover_projection_invalid',
    locator: { kind: 'cover', fieldRole: 'final_structure' },
  });
  const cover = isObj(c.coverContract) ? c.coverContract : undefined;
  if (!cover) {
    errors.push('coverContract missing');
  } else {
    if (!isStr(cover.worldType)) errors.push('coverContract.worldType missing');
    if (!isStr(cover.locationId) || !locationIds.has(cover.locationId)) {
      errors.push(`coverContract.locationId "${String(cover.locationId)}" not a declared location`);
    }
    if (cover.zoneId !== undefined) {
      if (!isStr(cover.zoneId)) {
        errors.push('coverContract.zoneId must be a non-empty string when present');
      } else if (!isStr(cover.locationId) || !zoneByLocation.get(cover.locationId)?.has(cover.zoneId)) {
        errors.push(
          `coverContract.zoneId "${cover.zoneId}" is not a zone of location "${String(cover.locationId)}"`,
        );
      }
    }
    if (cover.castIds !== undefined) {
      if (!Array.isArray(cover.castIds) || cover.castIds.length === 0 || !cover.castIds.every(isStr)) {
        errors.push('coverContract.castIds must be a non-empty string[] when present');
      } else {
        const seenCoverCast = new Set<string>();
        for (const castId of cover.castIds) {
          if (seenCoverCast.has(castId)) errors.push(`coverContract.castIds contains duplicate "${castId}"`);
          seenCoverCast.add(castId);
          if (!castIdSet.has(castId)) errors.push(`coverContract.castIds references unknown cast id "${castId}"`);
        }
      }
    }
    // (Stage 4) The cover's steering arrays were validated NOWHERE — yet the cover is the book's promise, and for a
    // contract-driven cover its `mustNotShow` is the SOLE no-spoiler authority. Require the shape.
    //
    // `[]` STAYS LEGAL, deliberately: 2 of the 3 shipped artifacts author `mustNotShow: []` on real pages, and a
    // contract-load throw is CAUGHT by the freeze path and degrades silently to legacy — so rejecting `[]` would buy
    // a SILENT loss of steering, not a loud failure. Only the shape and blank entries are tightened.
    if (!isStrArr(cover.mustShow)) errors.push('coverContract.mustShow must be a string[]');
    else if (cover.mustShow.some((s) => !isStr(s))) {
      errors.push('coverContract.mustShow contains a blank entry — omit it instead of authoring ""');
    }
    if (!isStrArr(cover.mustNotShow)) errors.push('coverContract.mustNotShow must be a string[]');
    else if (cover.mustNotShow.some((s) => !isStr(s))) {
      errors.push('coverContract.mustNotShow contains a blank entry — omit it instead of authoring ""');
    }
  }

  // Page contracts — the core authority checks.
  errors.useIssue({
    family: 'draft_contract',
    code: 'coverage_invalid',
    locator: {
      kind: 'collection',
      collectionRole: 'page_contracts',
      fieldRole: 'coverage',
    },
  });
  const pages = Array.isArray(c.pageContracts) ? c.pageContracts : [];
  if (pages.length === 0) errors.push('pageContracts[] must be non-empty');
  pages.forEach((p, i) => {
    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_spatial_binding_invalid'),
    );
    if (!isObj(p)) {
      errors.push(`pageContracts[${i}] is not an object`);
      return;
    }
    const pc = p as Partial<PageVisualContract> & Record<string, unknown>;
    const label = typeof pc.pageNumber === 'number' ? `page ${pc.pageNumber}` : `pageContracts[${i}]`;
    if (typeof pc.pageNumber !== 'number') errors.push(`${label}.pageNumber must be a number`);
    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_spatial_binding_invalid'),
    );
    if (!isStr(pc.locationId) || !locationIds.has(pc.locationId)) {
      errors.push(`${label}.locationId "${String(pc.locationId)}" not a declared location`);
    } else if (isStr(pc.zoneId)) {
      // zoneId must belong to THIS page's location — a zone can never live in another location.
      const zonesHere = zoneByLocation.get(pc.locationId);
      if (!zonesHere || !zonesHere.has(pc.zoneId)) {
        errors.push(`${label}.zoneId "${pc.zoneId}" is not a zone of location "${pc.locationId}"`);
      }
    }
    errors.useIssue(pageFinalStructuralIssue(p, i, 'page_steering_invalid'));
    if (!isStr(pc.camera)) errors.push(`${label}.camera missing`);
    // (Stage 4) `[]` stays legal here too (shipped artifacts author `mustNotShow: []`) — but a BLANK entry is
    // always an authoring bug: it steers nothing and `isStrArr` used to wave `['']` straight through.
    if (!isStrArr(pc.mustShow)) errors.push(`${label}.mustShow must be a string[]`);
    else if (pc.mustShow.some((s) => !isStr(s))) {
      errors.push(`${label}.mustShow contains a blank entry — omit it instead of authoring ""`);
    }
    if (!isStrArr(pc.mustNotShow)) errors.push(`${label}.mustNotShow must be a string[]`);
    else if (pc.mustNotShow.some((s) => !isStr(s))) {
      errors.push(`${label}.mustNotShow contains a blank entry — omit it instead of authoring ""`);
    }
    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_character_presence_invalid'),
    );
    if (!isObj(pc.characterPresence) || typeof (pc.characterPresence as Record<string, unknown>).child !== 'boolean') {
      errors.push(`${label}.characterPresence.child must be boolean`);
    }
    if (pc.childWardrobeOverride !== undefined) {
      errors.useIssue(pageFinalStructuralIssue(p, i, 'page_steering_invalid'));
      const override = pc.childWardrobeOverride;
      if (!isObj(override)) {
        errors.push(`${label}.childWardrobeOverride must be an object when present`);
      } else {
        const allowedOverrideKeys = ['description', 'forbidden', 'origin'];
        const actualOverrideKeys = Object.keys(override).sort();
        if (
          actualOverrideKeys.some((key) => !allowedOverrideKeys.includes(key)) ||
          !actualOverrideKeys.includes('description') ||
          !actualOverrideKeys.includes('origin')
        ) {
          errors.push(
            `${label}.childWardrobeOverride keys are invalid — expected description, origin, and optional forbidden`,
          );
        }
        if (!isStr(override.description)) {
          errors.push(`${label}.childWardrobeOverride.description must be a non-empty string`);
        }
        if (
          override.forbidden !== undefined &&
          (!isStrArr(override.forbidden) || override.forbidden.some((entry) => !isStr(entry)))
        ) {
          errors.push(`${label}.childWardrobeOverride.forbidden must be a non-blank string[] when present`);
        }
        if (
          isObj(pc.characterPresence) &&
          pc.characterPresence.child !== true
        ) {
          errors.push(`${label}.childWardrobeOverride requires the child to be present on the page`);
        }
        const defaultWardrobe = isObj(c.cast) && isObj(c.cast.child) && isObj(c.cast.child.wardrobe)
          ? c.cast.child.wardrobe.description
          : undefined;
        if (
          isStr(override.description) &&
          isStr(defaultWardrobe) &&
          override.description.trim() === defaultWardrobe.trim()
        ) {
          errors.push(`${label}.childWardrobeOverride is a no-op — omit it when wardrobe is unchanged`);
        }
        const origin = override.origin;
        if (!isObj(origin) || !isStr(origin.kind)) {
          errors.push(`${label}.childWardrobeOverride.origin is invalid`);
        } else if (origin.kind === 'story_evidence') {
          if (
            JSON.stringify(Object.keys(origin).sort()) !==
              JSON.stringify(['kind', 'page', 'phrase']) ||
            origin.page !== pc.pageNumber ||
            !isStr(origin.phrase)
          ) {
            errors.push(
              `${label}.childWardrobeOverride.origin story_evidence must contain exact kind/page/phrase for this page`,
            );
          }
        } else if (origin.kind === 'authored') {
          if (
            JSON.stringify(Object.keys(origin).sort()) !==
              JSON.stringify(['authorNote', 'kind']) ||
            !isStr(origin.authorNote)
          ) {
            errors.push(
              `${label}.childWardrobeOverride.origin authored must contain exact kind/authorNote`,
            );
          }
        } else if (origin.kind === 'policy_default') {
          if (
            JSON.stringify(Object.keys(origin).sort()) !==
              JSON.stringify(['kind', 'policyId', 'version']) ||
            !isStr(origin.policyId) ||
            !isStr(origin.version)
          ) {
            errors.push(
              `${label}.childWardrobeOverride.origin policy_default must contain exact kind/policyId/version`,
            );
          }
        } else {
          errors.push(`${label}.childWardrobeOverride.origin.kind is unsupported`);
        }
      }
    }
    errors.useIssue(pageFinalStructuralIssue(p, i, 'page_prop_state_invalid'));
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
    errors.useIssue(pageFinalStructuralIssue(p, i, 'page_cast_state_invalid'));
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
    const errorsBeforePageV2 = errors.length;
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

    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_prop_constraints_invalid'),
    );
    const propConstraintClassification = classifyPagePropConstraints({
      propConstraints: pc.propConstraints,
      propIds,
      anchorIds: scope.anchorIds,
    });
    /** propId → visibility on THIS page. Stage 4 reads the classifier's exact last-valid-write state. */
    const visibilityByProp = propConstraintClassification.visibilityByProp;
    const propConstraintValues = Array.isArray(pc.propConstraints)
      ? pc.propConstraints
      : [];
    const propConstraintMessage = (
      violation: PagePropConstraintViolation,
    ): string => {
      if (violation.code === 'prop_constraints_not_array') {
        return `${label}.propConstraints must be an array when present`;
      }
      if (violation.code === 'prop_constraints_empty') {
        return `${label}.propConstraints must be a NON-EMPTY array when present — omit the key instead of []`;
      }
      if (!('constraintIndex' in violation)) {
        throw new Error('page prop-constraint classifier evidence invalid');
      }
      const raw = propConstraintValues[violation.constraintIndex];
      const cLabel = `${label}.propConstraints[${violation.constraintIndex}]`;
      if (violation.code === 'prop_id_missing') {
        return `${cLabel}.propId missing`;
      }
      if (!isObj(raw) || !isStr(raw.propId)) {
        throw new Error('page prop-constraint classifier evidence invalid');
      }
      if (violation.code === 'prop_id_unknown') {
        return `${cLabel} references unknown propId "${raw.propId}"`;
      }
      if (violation.code === 'visibility_invalid') {
        return `${cLabel} (${raw.propId}) visibility "${String(raw.visibility)}" is not one of ${[...PROP_VISIBILITIES].join(' | ')}`;
      }
      if (violation.code === 'visibility_self_contradiction') {
        const related = propConstraintValues[
          violation.relatedConstraintIndex
        ];
        if (!isObj(related)) {
          throw new Error('page prop-constraint classifier evidence invalid');
        }
        return `${label}.propConstraints declares propId "${raw.propId}" as both "${String(related.visibility)}" and "${String(raw.visibility)}" on the same page`;
      }
      if (violation.code === 'state_id_invalid') {
        return `${cLabel} (${raw.propId}) stateId must be a non-empty string when present`;
      }
      if (violation.code === 'anchor_id_invalid') {
        return `${cLabel} (${raw.propId}) anchorId must be a non-empty string when present`;
      }
      if (violation.code === 'anchor_id_unknown') {
        return `${cLabel} (${raw.propId}) references unknown anchorId "${String(raw.anchorId)}" of location "${String(pc.locationId)}"`;
      }
      throw new Error('unreachable page prop-constraint violation');
    };
    for (const violation of propConstraintClassification.violations) {
      errors.push(propConstraintMessage(violation));
    }

    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_action_requirements_invalid'),
    );
    const actions = nonEmptyArrayOrNull(pc.actionRequirements, `${label}.actionRequirements`, errors);
    if (actions) {
      const checkIds = new Set<string>();
      actions.forEach((raw, j) => {
        const aLabel = `${label}.actionRequirements[${j}]`;
        if (!isObj(raw)) {
          errors.push(`${aLabel} is not an object`);
          return;
        }
        const allowedActionFields = [
          'checkId',
          'subject',
          'predicate',
          'object',
          'spatialEffect',
          'spatialConstraint',
          'polarity',
          'laterality',
        ];
        if (
          JSON.stringify(Object.keys(raw).sort()) !==
          JSON.stringify(
            Object.keys(raw)
              .filter((key) => allowedActionFields.includes(key))
              .sort(),
          )
        ) {
          errors.push(
            `${aLabel} contains an unknown field; action requirements use only ${allowedActionFields.join(' | ')}`,
          );
        }
        if (!isStr(raw.checkId) || !CHECK_ID_RE.test(raw.checkId)) {
          errors.push(`${aLabel} checkId "${String(raw.checkId)}" must match ${String(CHECK_ID_RE)} (a namespaced, stable id)`);
        } else if (checkIds.has(raw.checkId)) {
          errors.useIssue(
            pageFinalStructuralIssue(
              p,
              i,
              'page_action_check_id_collision_invalid',
            ),
          );
          errors.push(`${label}.actionRequirements duplicate checkId "${raw.checkId}" on the same page`);
          errors.useIssue(
            pageFinalStructuralIssue(
              p,
              i,
              'page_action_requirements_invalid',
            ),
          );
        } else {
          checkIds.add(raw.checkId);
        }
        if (raw.actorId !== undefined) {
          errors.push(
            `${aLabel}.actorId is legacy authority and is forbidden by ${VISUAL_CONTRACT_SCHEMA_VERSION}; use typed subject`,
          );
        }
        const subject = isObj(raw.subject) ? raw.subject : null;
        let subjectKind: string | null = null;
        let subjectEntity: Record<string, unknown> | null = null;
        let subjectCastIds = new Set<string>();
        if (!subject || !isStr(subject.kind)) {
          errors.push(`${aLabel}.subject missing`);
        } else if (subject.kind === 'entity') {
          if (
            JSON.stringify(Object.keys(subject).sort()) !==
            JSON.stringify(['entity', 'kind'])
          ) {
            errors.push(`${aLabel}.subject entity must contain only kind + entity`);
          }
          validateEntityRef(
            subject.entity,
            `${aLabel}.subject.entity`,
            scope,
            errors,
          );
          const entity = isObj(subject.entity) ? subject.entity : null;
          subjectEntity = entity;
          subjectKind = isStr(entity?.kind) ? entity.kind : null;
          if (
            entity?.kind === 'cast' &&
            isStr(entity.id) &&
            !pageCastIdSet.has(entity.id)
          ) {
            errors.push(
              `${aLabel}.subject.entity cast "${entity.id}" is NOT present on this page`,
            );
          }
          if (entity?.kind === 'cast' && isStr(entity.id)) {
            subjectCastIds = new Set([entity.id]);
          }
        } else if (subject.kind === 'cast_group') {
          if (
            JSON.stringify(Object.keys(subject).sort()) !==
            JSON.stringify(['castIds', 'kind'])
          ) {
            errors.push(
              `${aLabel}.subject cast_group must contain only kind + castIds`,
            );
          }
          const castIds = Array.isArray(subject.castIds)
            ? subject.castIds
            : null;
          if (
            !castIds ||
            castIds.length < 2 ||
            !castIds.every(isStr)
          ) {
            errors.push(
              `${aLabel}.subject.castIds must contain at least two non-empty cast ids`,
            );
          } else {
            const typedCastIds = castIds as string[];
            subjectCastIds = new Set(typedCastIds);
            if (subjectCastIds.size !== typedCastIds.length) {
              errors.push(
                `${aLabel}.subject.castIds contains a duplicate member`,
              );
            }
            for (const castId of typedCastIds) {
              if (!castIdSet.has(castId)) {
                errors.push(
                  `${aLabel}.subject.castIds references unknown cast "${castId}"`,
                );
              } else if (!pageCastIdSet.has(castId)) {
                errors.push(
                  `${aLabel}.subject.castIds cast "${castId}" is NOT present on this page`,
                );
              }
            }
            const canonical = typedCastIds.slice().sort(canonicalStringCompare);
            if (JSON.stringify(typedCastIds) !== JSON.stringify(canonical)) {
              errors.push(
                `${aLabel}.subject.castIds must use deterministic canonical ordering`,
              );
            }
          }
          subjectKind = 'cast_group';
        } else if (subject.kind === 'source_phenomenon') {
          if (
            JSON.stringify(Object.keys(subject).sort()) !==
            JSON.stringify(['kind', 'sourceEvidenceId', 'sourcePhrase'])
          ) {
            errors.push(
              `${aLabel}.subject source_phenomenon must contain only kind + exact sourceEvidenceId + compiler-resolved sourcePhrase`,
            );
          }
          if (
            !isStr(subject.sourceEvidenceId) ||
            !SOURCE_EVIDENCE_ID_PATTERN.test(subject.sourceEvidenceId)
          ) {
            errors.push(
              `${aLabel}.subject.sourceEvidenceId must be one exact Source Evidence ID`,
            );
          }
          if (!isStr(subject.sourcePhrase)) {
            errors.push(
              `${aLabel}.subject.sourcePhrase must be the non-empty compiler-resolved exact excerpt`,
            );
          }
          subjectKind = 'source_phenomenon';
        } else {
          errors.push(
            `${aLabel}.subject.kind "${String(subject.kind)}" is not entity | cast_group | source_phenomenon`,
          );
        }
        if (!isActionPredicate(raw.predicate)) {
          errors.push(`${aLabel} predicate "${String(raw.predicate)}" is not one of ${ACTION_PREDICATE_VALUES.join(' | ')}`);
        } else {
          const definition = actionSemanticDefinition(raw.predicate);
          if (
            subjectKind !== null &&
            !definition.subjectKinds.some(
              (kind) => kind === subjectKind,
            )
          ) {
            errors.push(
              `${aLabel}.subject kind "${subjectKind}" is not allowed for predicate "${raw.predicate}"`,
            );
          }
          if (definition.objectRule === 'required' && raw.object === undefined) {
            errors.push(
              `${aLabel}.object is required for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          if (definition.objectRule === 'forbidden' && raw.object !== undefined) {
            errors.push(
              `${aLabel}.object is forbidden for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          if (
            definition.spatialEffectRule === 'required' &&
            raw.spatialEffect === undefined
          ) {
            errors.push(
              `${aLabel}.spatialEffect is required for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          if (
            definition.spatialEffectRule === 'forbidden' &&
            raw.spatialEffect !== undefined
          ) {
            errors.push(
              `${aLabel}.spatialEffect is forbidden for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          if (
            definition.spatialConstraintRule === 'required' &&
            raw.spatialConstraint === undefined
          ) {
            errors.push(
              `${aLabel}.spatialConstraint is required for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          if (
            definition.spatialConstraintRule === 'forbidden' &&
            raw.spatialConstraint !== undefined
          ) {
            errors.push(
              `${aLabel}.spatialConstraint is forbidden for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
          const catalogConstraintRelation = isObj(raw.spatialConstraint) &&
            isStr(raw.spatialConstraint.relation)
            ? raw.spatialConstraint.relation
            : null;
          if (
            catalogConstraintRelation !== null &&
            !definition.spatialConstraintRelations.some(
              (relation) => relation === catalogConstraintRelation,
            )
          ) {
            errors.push(
              `${aLabel}.spatialConstraint.relation "${catalogConstraintRelation}" is not allowed for predicate "${raw.predicate}"`,
            );
          }
          const objectKind = isObj(raw.object) &&
              isStr(raw.object.kind)
            ? raw.object.kind
            : null;
          if (
            objectKind !== null &&
            !definition.objectKinds.some((kind) => kind === objectKind)
          ) {
            errors.push(
              `${aLabel}.object.kind "${objectKind}" is not allowed for predicate "${raw.predicate}"`,
            );
          }
          if (raw.laterality !== undefined && !definition.lateralityAllowed) {
            errors.push(
              `${aLabel}.laterality is forbidden for predicate "${raw.predicate}" by the Action Semantic Catalog`,
            );
          }
        }
        if (!isStr(raw.polarity) || !ACTION_POLARITIES.has(raw.polarity)) {
          errors.push(`${aLabel} polarity "${String(raw.polarity)}" must be 'must' or 'must_not'`);
        }
        if (raw.object !== undefined) validateEntityRef(raw.object, `${aLabel}.object`, scope, errors);
        if (
          isObj(raw.object) &&
          raw.object.kind === 'cast' &&
          isStr(raw.object.id) &&
          !pageCastIdSet.has(raw.object.id)
        ) {
          errors.push(
            `${aLabel}.object cast "${raw.object.id}" is NOT present on this page`,
          );
        }
        if (raw.spatialEffect !== undefined) {
          const effect = isObj(raw.spatialEffect)
            ? raw.spatialEffect
            : null;
          if (!effect || !isStr(effect.kind)) {
            errors.push(
              `${aLabel}.spatialEffect must be directional or relation`,
            );
          } else if (effect.kind === 'directional') {
            if (
              JSON.stringify(Object.keys(effect).sort()) !==
                JSON.stringify(['direction', 'kind']) ||
              !isStr(effect.direction) ||
              !ACTION_SPATIAL_DIRECTIONS.has(effect.direction)
            ) {
              errors.push(
                `${aLabel}.spatialEffect directional result requires one closed direction`,
              );
            }
          } else if (effect.kind === 'relation') {
            if (
              JSON.stringify(Object.keys(effect).sort()) !==
              JSON.stringify(['kind', 'relation', 'target'])
            ) {
              errors.push(
                `${aLabel}.spatialEffect relation result must contain only kind + relation + target`,
              );
            }
            if (
              !isStr(effect.relation) ||
              !ACTION_SPATIAL_RELATIONS.has(effect.relation)
            ) {
              errors.push(
                `${aLabel}.spatialEffect.relation is not in the closed relation catalog`,
              );
            }
            validateEntityRef(
              effect.target,
              `${aLabel}.spatialEffect.target`,
              scope,
              errors,
            );
            if (
              isObj(effect.target) &&
              effect.target.kind === 'cast' &&
              isStr(effect.target.id) &&
              !pageCastIdSet.has(effect.target.id)
            ) {
              errors.push(
                `${aLabel}.spatialEffect.target cast "${effect.target.id}" is NOT present on this page`,
              );
            }
          } else {
            errors.push(
              `${aLabel}.spatialEffect.kind "${String(effect.kind)}" is not directional | relation`,
            );
          }
        }
        if (raw.spatialConstraint !== undefined) {
          const constraint = isObj(raw.spatialConstraint)
            ? raw.spatialConstraint
            : null;
          if (
            !constraint ||
            JSON.stringify(Object.keys(constraint).sort()) !==
              JSON.stringify(['relation', 'target']) ||
            !isStr(constraint.relation) ||
            !ACTION_SPATIAL_CONSTRAINT_RELATIONS.has(constraint.relation)
          ) {
            errors.push(
              `${aLabel}.spatialConstraint must contain only one closed relation + typed target`,
            );
          }
          validateEntityRef(
            constraint?.target,
            `${aLabel}.spatialConstraint.target`,
            scope,
            errors,
          );
          const target = isObj(constraint?.target)
            ? constraint.target
            : null;
          if (
            target?.kind === 'cast' &&
            isStr(target.id) &&
            !pageCastIdSet.has(target.id)
          ) {
            errors.push(
              `${aLabel}.spatialConstraint.target cast "${target.id}" is NOT present on this page`,
            );
          }
          if (
            target &&
            ((subjectEntity &&
              target.kind === subjectEntity.kind &&
              target.id === subjectEntity.id) ||
              (target.kind === 'cast' &&
                isStr(target.id) &&
                subjectCastIds.has(target.id)))
          ) {
            errors.push(
              `${aLabel}.spatialConstraint.target cannot reference its own subject`,
            );
          }
        }
        if (raw.laterality !== undefined && raw.laterality !== 'left' && raw.laterality !== 'right') {
          errors.push(`${aLabel}.laterality must be 'left' or 'right' when present`);
        }
      });
    }

    errors.useIssue(
      pageFinalStructuralIssue(p, i, 'page_safety_constraints_invalid'),
    );
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

    // ── Stage 4: cross-field conflicts, check-id resolution, TIER-B containment. Gated on THIS page's v2 structure
    // being sound — deriving from entries we already rejected would pile confusing errors onto the real ones and
    // hand malformed input to the projections.
    if (errors.length === errorsBeforePageV2) {
      errors.useIssue(
        pageFinalStructuralIssue(
          p,
          i,
          'page_action_constraint_conflict_invalid',
        ),
      );
      const pcTyped = pc as unknown as PageVisualContract;
      const contractView = c as unknown as BookVisualContract;

      // (a) A REQUIRED action must not contradict a visibility or safety constraint on the same page.
      const beats = new Map<string, Set<string>>(); // subject|predicate|object|result → asserted polarities
      (Array.isArray(pc.actionRequirements) ? (pc.actionRequirements as unknown[]) : []).forEach((raw, j) => {
        if (!isObj(raw)) return;
        const aLabel = `${label}.actionRequirements[${j}]`;
        const subject = isObj(raw.subject) ? raw.subject : null;
        const subjectEntity =
          subject?.kind === 'entity' && isObj(subject.entity)
            ? subject.entity
            : null;
        const subjectKey = subjectEntity
          ? `${String(subjectEntity.kind)}:${String(subjectEntity.id)}`
          : subject?.kind === 'cast_group' && Array.isArray(subject.castIds)
            ? `cast_group:${subject.castIds.map(String).join(',')}`
          : subject?.kind === 'source_phenomenon'
            ? `source_phenomenon:${String(subject.sourceEvidenceId)}`
            : 'invalid_subject';
        const castSubjectId =
          subjectEntity?.kind === 'cast' && isStr(subjectEntity.id)
            ? subjectEntity.id
            : null;
        const objRef = isObj(raw.object) ? (raw.object as { kind?: unknown; id?: unknown }) : null;
        const effect = isObj(raw.spatialEffect)
          ? raw.spatialEffect
          : null;
        const constraint = isObj(raw.spatialConstraint)
          ? raw.spatialConstraint
          : null;
        const effectTarget =
          effect?.kind === 'relation' && isObj(effect.target)
            ? effect.target
            : null;
        const effectKey = effect
          ? effect.kind === 'directional'
            ? `directional:${String(effect.direction)}`
            : `relation:${String(effect.relation)}:${String(effectTarget?.kind)}:${String(effectTarget?.id)}`
          : '-';
        const constraintTarget =
          constraint && isObj(constraint.target)
            ? constraint.target
            : null;
        const constraintKey = constraint
          ? `${String(constraint.relation)}:${String(constraintTarget?.kind)}:${String(constraintTarget?.id)}`
          : '-';
        const beatKey = `${subjectKey}|${String(raw.predicate)}|${objRef ? `${String(objRef.kind)}:${String(objRef.id)}` : '-'}|${effectKey}|${constraintKey}`;
        if (!beats.has(beatKey)) beats.set(beatKey, new Set());
        beats.get(beatKey)!.add(String(raw.polarity));

        if (raw.polarity !== 'must') return;

        // vs a FORBIDDEN prop — the page requires the actor to act on something it also says must not be visible.
        if (objRef && objRef.kind === 'prop' && isStr(objRef.id) && visibilityByProp.get(objRef.id) === 'forbidden') {
          errors.push(
            `${aLabel} requires "${subjectKey}" to ${String(raw.predicate)} prop "${objRef.id}", but propConstraints FORBIDS that prop on this page — a required action cannot act on a forbidden prop`
          );
        }
        if (
          subjectEntity?.kind === 'prop' &&
          isStr(subjectEntity.id) &&
          visibilityByProp.get(subjectEntity.id) === 'forbidden'
        ) {
          errors.push(
            `${aLabel} requires forbidden prop subject "${subjectEntity.id}" to be visible on this page`,
          );
        }
        if (
          effectTarget?.kind === 'prop' &&
          isStr(effectTarget.id) &&
          visibilityByProp.get(effectTarget.id) === 'forbidden'
        ) {
          errors.push(
            `${aLabel} spatial result targets forbidden prop "${effectTarget.id}" on this page`,
          );
        }
        if (
          constraintTarget?.kind === 'prop' &&
          isStr(constraintTarget.id) &&
          visibilityByProp.get(constraintTarget.id) === 'forbidden'
        ) {
          errors.push(
            `${aLabel} static spatial constraint targets forbidden prop "${constraintTarget.id}" on this page`,
          );
        }

        // vs a HAZARD — the page requires exactly what a safetyConstraint prohibits, for the same subject+target.
        const banned = isActionPredicate(raw.predicate)
          ? actionSemanticDefinition(raw.predicate).safetyConflictRelation
          : null;
        if (banned && objRef && isStr(objRef.id)) {
          for (const rawS of Array.isArray(pc.safetyConstraints) ? (pc.safetyConstraints as unknown[]) : []) {
            if (!isObj(rawS) || !isObj(rawS.target)) continue;
            const t = rawS.target as { kind?: unknown; id?: unknown };
            if (rawS.relation === banned && rawS.subjectId === castSubjectId && t.kind === objRef.kind && t.id === objRef.id) {
              errors.push(
                `${aLabel} requires "${subjectKey}" to ${String(raw.predicate)} ${String(objRef.kind)}:"${String(objRef.id)}", but a safetyConstraint on this page declares "${banned}" for the same subject and target — the page requires the hazard it forbids`
              );
            }
          }
        }
      });
      for (const [beatKey, polarities] of beats) {
        if (polarities.has('must') && polarities.has('must_not')) {
          errors.push(
            `${label}.actionRequirements declares the same beat (${beatKey}) as BOTH must and must_not — self-contradictory`
          );
        }
      }

      // (b) Every enforcement-relevant claim must resolve to a UNIQUE check id. Stage 5 binds exactly one QA result
      // per required id, so two claims sharing an id is an ambiguity it could not resolve.
      const idCounts = new Map<
        string,
        { count: number; kind: 'action' | 'prop' | 'safety' }
      >();
      for (const chk of resolvePageCheckIds(pcTyped)) {
        const prior = idCounts.get(chk.checkId);
        idCounts.set(chk.checkId, {
          count: (prior?.count ?? 0) + 1,
          kind: chk.kind,
        });
      }
      for (const [checkId, value] of idCounts) {
        if (value.count > 1) {
          const collisionIssue =
            value.kind === 'action'
              ? pageFinalStructuralIssue(
                  p,
                  i,
                  'page_action_check_id_collision_invalid',
                )
              : value.kind === 'prop'
                ? pageFinalStructuralIssue(
                    p,
                    i,
                    'page_prop_check_id_collision_invalid',
                  )
                : pageFinalStructuralIssue(
                    p,
                    i,
                    'page_safety_check_id_collision_invalid',
                  );
          errors.useIssue(
            collisionIssue,
          );
          errors.push(
            `${label} resolves ${value.count} enforcement checks to the same checkId "${checkId}" — every enforcement-relevant claim needs a UNIQUE resolved id (Stage 5 binds exactly one QA result per id)`
          );
        }
      }

      // (c) TIER-B CONTAINMENT — the stored prose must CONTAIN the structure's projection. NOT equality:
      // mustShow/mustNotShow are multi-source (zone exclusions, style guards, spoiler prose), so extra stored
      // steering is legitimate and must survive. A v1 page projects nothing → vacuously contained.
      const missingFrom = (projected: string[], stored: unknown): string[] => {
        const have = isStrArr(stored) ? stored : [];
        return projected.filter((p) => !have.includes(p));
      };
      errors.useIssue(
        pageFinalStructuralIssue(
          p,
          i,
          'page_projection_containment_invalid',
        ),
      );
      const missShow = missingFrom(projectPageMustShow(pcTyped, contractView), pc.mustShow);
      if (missShow.length > 0) {
        errors.push(
          `${label}.mustShow does not CONTAIN its structure's projection — missing ${JSON.stringify(missShow)}. Every projected requirement must appear in mustShow (extra hand-authored steering is allowed; a projected one may not be dropped)`
        );
      }
      const missNot = missingFrom(projectPageMustNotShow(pcTyped, contractView), pc.mustNotShow);
      if (missNot.length > 0) {
        errors.push(
          `${label}.mustNotShow does not CONTAIN its structure's projection — missing ${JSON.stringify(missNot)}`
        );
      }
    }
  });

  // ── Stage 4: PROP LIFECYCLE (cross-page). `firstRevealPage` lives on the PROP precisely so ONE book-level fact
  // governs every page — this is where that fact is enforced against them. Gated on the key being authored, so a
  // contract with no lifecycle is untouched.
  errors.useIssue({
    family: 'draft_contract',
    code: 'lifecycle_invariant_invalid',
    locator: {
      kind: 'collection',
      collectionRole: 'recurring_props',
      fieldRole: 'lifecycle',
    },
  });
  {
    const firstReveal = new Map<string, number>();
    props.forEach((p) => {
      if (isObj(p) && isStr(p.id) && typeof p.firstRevealPage === 'number' && Number.isInteger(p.firstRevealPage)) {
        firstReveal.set(p.id, p.firstRevealPage);
      }
    });
    if (firstReveal.size > 0) {
      const maxPage = pages.reduce(
        (max: number, p) => (isObj(p) && typeof p.pageNumber === 'number' && p.pageNumber > max ? p.pageNumber : max),
        0
      );
      for (const [propId, reveal] of firstReveal) {
        if (maxPage > 0 && reveal > maxPage) {
          errors.push(
            `recurringProp "${propId}" firstRevealPage ${reveal} is beyond the book's last page (${maxPage}) — the lifecycle must reference a page that exists`
          );
        }
        for (let pageNumber = 1; pageNumber < reveal; pageNumber += 1) {
          const page = pages.find(
            (candidate) => isObj(candidate) && candidate.pageNumber === pageNumber,
          );
          const hasExplicitProhibition =
            isObj(page) &&
            Array.isArray(page.propConstraints) &&
            page.propConstraints.some(
              (constraint) =>
                isObj(constraint) &&
                constraint.propId === propId &&
                constraint.visibility === 'forbidden',
            );
          if (!hasExplicitProhibition) {
            errors.push(
              `page ${pageNumber}.propConstraints must explicitly FORBID prop "${propId}" before its firstRevealPage (${reveal}) — pre-reveal authority must be complete`
            );
          }
        }
      }
      pages.forEach((p) => {
        if (!isObj(p) || typeof p.pageNumber !== 'number' || !Array.isArray(p.propConstraints)) return;
        const pageNumber = p.pageNumber; // narrowed here; the nested closure would lose it
        (p.propConstraints as unknown[]).forEach((raw, j) => {
          if (!isObj(raw) || !isStr(raw.propId) || raw.visibility !== 'required') return;
          const reveal = firstReveal.get(raw.propId);
          if (reveal !== undefined && pageNumber < reveal) {
            errors.push(
              `page ${pageNumber}.propConstraints[${j}] REQUIRES prop "${raw.propId}" on a page BEFORE its firstRevealPage (${reveal}) — a prop cannot be required before it is revealed (lifecycle violation / spoiler)`
            );
          }
        });
      });

      // The cover's no-spoiler line is a pure lifecycle read (the cover has no page contract), so it is the one
      // containment rule that lives at book level. A prop with a firstRevealPage is BY DEFINITION a cover spoiler.
      if (cover) {
        const coverProjection = projectCoverMustNotShow(c as unknown as BookVisualContract);
        const storedCover = isStrArr(cover.mustNotShow) ? cover.mustNotShow : [];
        const missingCover = coverProjection.filter((p) => !storedCover.includes(p));
        if (missingCover.length > 0) {
          errors.push(
            `coverContract.mustNotShow does not CONTAIN the prop-lifecycle projection — missing ${JSON.stringify(missingCover)}. A prop carrying a firstRevealPage is by definition a cover spoiler`
          );
        }
      }
    }
  }

  errors.useIssue({
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'collection',
      collectionRole: 'set_board_authorities',
      fieldRole: 'authority',
    },
  });
  errors.push(...setBoardStableAuthorityErrors(input));

  if (errors.length > 0) {
    return {
      ok: false,
      errors: [...errors],
      diagnosticIssues: errors.diagnosticIssues,
    };
  }
  return { ok: true, contract: input as unknown as BookVisualContract };
}

/** Fail-closed assertion for the production path: throws InvalidVisualContractError on any problem. */
export function assertValidBookVisualContract(input: unknown): asserts input is BookVisualContract {
  const result = validateBookVisualContract(input);
  if (!result.ok) {
    throw new InvalidVisualContractError(
      result.errors,
      result.diagnosticIssues,
    );
  }
}
