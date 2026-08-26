/**
 * Shared, PURE deterministic projections of the Contract-v2 STRUCTURE → the human-readable prose fields
 * (`stableGeometry` / `mustShow` / `mustNotShow` / action + safety prose). Stage 3.
 *
 * Modeled on projectResolvedHumanProse.ts and carrying the same doctrine: ONE implementation, shared by the
 * generator and the validator, so the structure and its prose can never diverge. The STRUCTURE is authoritative;
 * the prose is a projection of it — never a parallel editable source. No I/O, no clock, no randomness.
 *
 * ORDERING IS PART OF THE CONTRACT. Emission order is the authored DECLARATION order (nodes, then relations;
 * props, then actions, then safety). Never sorted at runtime: the canonical JSON maps arrays without sorting, so
 * array order is hash-significant — a re-sort would silently re-hash every frozen contract.
 *
 * THREE TIERS (see the Stage-3 report):
 *  - TIER A `projectZoneStableGeometry` — WIRED BOTH SIDES. The validator enforces equality whenever the zone
 *    authors `spatialNodes`, so prose stops being an independent authority the moment its structure exists.
 *  - TIER B `projectPageMustShow` / `projectPageMustNotShow` / `projectCoverMustNotShow` — pure, exported and
 *    tested, but UNWIRED in Stage 3. `mustShow`/`mustNotShow` are MULTI-SOURCE (they also carry zone exclusions,
 *    style guards and spoiler prose that the structure provably cannot express yet), so an equality check would be
 *    false. Stage 4 wires the correct rule: CONTAINMENT (projection ⊆ stored).
 *  - TIER C `projectPageActionProse` / `projectPageSafetyProse` — WIRED, but never stored and never hashed: they
 *    are computed at prompt-block time. No v1 prose field competes with them, so they need no migration at all.
 */
import type {
  BookVisualContract,
  EntityRef,
  PageActionRequirement,
  PageVisualContract,
  SafetyConstraint,
  SpatialRelationKind,
  VisualZone,
} from './types';
import {
  actionSemanticDefinition,
  isActionPredicate,
} from './actionSemanticCatalog';

/* ── Closed-enum prose tables ────────────────────────────────────────────────────────────────────
 * Explicit `Record<Kind, string>` maps rather than string munging: TS then fails the build if an enum member is
 * added without giving it prose, so a new relation can never silently project as an empty/garbled line.
 */

const SPATIAL_RELATION_PROSE: Record<SpatialRelationKind, string> = {
  on_same_wall_as: 'is on the same wall as',
  adjacent_to: 'is adjacent to',
  opposite_to: 'is opposite',
  above: 'is above',
  below: 'is below',
  centered_in: 'is centered in the zone',
};

const SAFETY_RELATION_PROSE: Record<SafetyConstraint['relation'], string> = {
  must_not_sit_on: 'must NOT sit on',
  must_not_stand_on: 'must NOT stand on',
  must_not_lean_over: 'must NOT lean over',
  must_not_pass_beyond: 'must NOT pass beyond',
  must_not_be_unsupported_at: 'must NOT be unsupported at',
  must_not_be_within_reach_of: 'must NOT be within reach of',
  must_not_be_inside: 'must NOT be inside',
};

/* ── Label resolution ────────────────────────────────────────────────────────────────────────── */

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectableEntityRef(value: unknown): value is EntityRef {
  return (
    isObj(value) &&
    (value.kind === 'cast' ||
      value.kind === 'prop' ||
      value.kind === 'spatial' ||
      value.kind === 'anchor') &&
    typeof value.id === 'string'
  );
}

function safeObjectElements<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObj) as T[];
}

function humanizeKind(kind: string): string {
  return kind.replace(/_/g, ' ');
}

export const SPATIAL_REFERENCE_PROJECTION_VERSION =
  'spatial-reference-projection/v2' as const;

type SpatialReferenceProjectionMode = 'legacy_kind' | 'description_v2';

function readableSpatialDescription(description: string): string {
  const trimmed = description.trim().replace(/[.!?]+$/u, '');
  if (!trimmed) return '';
  const withoutArticle = trimmed.replace(/^(?:a|an|the)\s+/iu, '');
  return withoutArticle.replace(/^[A-Z]/u, (value) => value.toLowerCase());
}

/** The page's own zone (never another zone — geometry is zone-scoped by construction). */
function zoneOfPage(page: PageVisualContract, contract: BookVisualContract): VisualZone | undefined {
  if (!page.zoneId) return undefined;
  return safeObjectElements<VisualZone>(contract.zones).find(
    (z) => z.id === page.zoneId && z.locationId === page.locationId,
  );
}

/** A cast member's readable label: authored name, else the human-cast role, else the raw id. */
function castLabel(castId: string, contract: BookVisualContract): string {
  const cast = contract.cast;
  if (cast?.child?.id === castId) return cast.child.name ?? 'the child';
  if (cast?.companion?.id === castId) return cast.companion.name ?? 'the companion';
  const human = safeObjectElements<NonNullable<BookVisualContract['humanCast']>[number]>(
    contract.humanCast,
  ).find((h) => h.id === castId);
  if (human) return `the ${human.role}`;
  return castId;
}

function castGroupLabel(
  castIds: readonly string[],
  contract: BookVisualContract,
): string {
  const labels = castIds.map((castId) => castLabel(castId, contract));
  const members =
    labels.length === 2
      ? `${labels[0]} and ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1] ?? ''}`;
  return `the cast group (${members})`;
}

/**
 * A typed reference's readable label. Falls back to the raw id when a ref does not resolve: this is a PURE
 * projection, never a validator — dangling ids are rejected by validateBookVisualContract, and a projection must
 * not throw on input the validator is about to reject anyway.
 */
function refLabel(
  ref: EntityRef,
  page: PageVisualContract,
  contract: BookVisualContract,
  spatialMode: SpatialReferenceProjectionMode,
): string {
  if (!isObj(ref) || typeof ref.kind !== 'string' || typeof ref.id !== 'string') {
    return '';
  }
  switch (ref.kind) {
    case 'cast':
      return castLabel(ref.id, contract);
    case 'prop': {
      const prop = safeObjectElements<BookVisualContract['recurringProps'][number]>(
        contract.recurringProps,
      ).find((p) => p.id === ref.id);
      return prop ? prop.name : ref.id;
    }
    case 'spatial': {
      const node = safeObjectElements<
        NonNullable<VisualZone['spatialNodes']>[number]
      >(zoneOfPage(page, contract)?.spatialNodes).find((n) => n.id === ref.id);
      if (!node) return ref.id;
      if (spatialMode === 'legacy_kind') {
        return `the ${humanizeKind(node.kind)}`;
      }
      const description = readableSpatialDescription(node.description);
      return description
        ? `the ${description} [spatial:${node.id}]`
        : `spatial:${node.id}`;
    }
    case 'anchor': {
      const location = safeObjectElements<BookVisualContract['locations'][number]>(
        contract.locations,
      ).find((l) => l.id === page.locationId);
      const anchor = safeObjectElements<
        NonNullable<BookVisualContract['locations'][number]['anchors']>[number]
      >(location?.anchors).find((a) => a.id === ref.id);
      return anchor ? anchor.description : ref.id;
    }
  }
}

/* ── TIER A — stableGeometry (wired: the validator enforces equality) ─────────────────────────── */

/**
 * Deterministic PROJECTION of a zone's structured geometry → its `stableGeometry` prose.
 *
 * Returns `undefined` (NOT `[]`) when the zone authors no `spatialNodes`, so an unauthored zone projects to an
 * OMITTED key and the contract hashes byte-identical — the omit-when-unauthored invariant the whole vNext schema
 * rests on. Nodes emit in declaration order, then relations in declaration order.
 */
export function projectZoneStableGeometry(zone: VisualZone): string[] | undefined {
  // TOTAL over unvalidated input — this must never throw. It is called from validateBookVisualContract, whose
  // contract is to RETURN the list of problems; a TypeError escaping it fails `isInvalidVisualContractError`, so no
  // caller can classify it, and the freeze path would log "cannot read properties of undefined" instead of the
  // itemized problems. Malformed entries are SKIPPED here and reported by the validator, which owns rejection.
  const nodes = zone.spatialNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;

  const lines: string[] = [];
  for (const n of nodes) {
    if (!n || typeof n.id !== 'string' || typeof n.kind !== 'string' || typeof n.description !== 'string') continue;
    lines.push(`${humanizeKind(n.kind)} "${n.id}": ${n.description}`);
  }

  const relations = zone.spatialRelations;
  if (Array.isArray(relations)) {
    for (const rel of relations) {
      if (!rel || typeof rel.subjectId !== 'string' || typeof rel.relation !== 'string') continue;
      const phrase = SPATIAL_RELATION_PROSE[rel.relation];
      if (!phrase) continue; // unknown relation → the validator rejects it; never emit a garbled line
      lines.push(
        rel.relation === 'centered_in' || typeof rel.objectId !== 'string'
          ? `"${rel.subjectId}" ${phrase}`
          : `"${rel.subjectId}" ${phrase} "${rel.objectId}"`
      );
    }
  }

  return lines.length > 0 ? lines : undefined;
}

/* ── TIER C — action + safety prose (wired to the prompt block; never stored, never hashed) ───── */

/** One readable action beat. `polarity` decides the wording — and, upstream, which array it may land in. */
export function projectActionPredicateProse(
  predicate: PageActionRequirement['predicate'],
): string {
  return actionSemanticDefinition(predicate).proseProjection;
}

function actionProseLine(
  action: PageActionRequirement,
  page: PageVisualContract,
  contract: BookVisualContract,
  spatialMode: SpatialReferenceProjectionMode = 'description_v2',
): string | null {
  // This projector is called before the total contract validator on the compiler-owned
  // projection pass. Unknown provider-authored predicates belong to validation/repair;
  // they must not escape that boundary as a raw catalog lookup exception or synthesize
  // prose outside the closed Action Semantic Catalog.
  if (!isActionPredicate(action.predicate)) return null;
  const legacyActorId = (action as unknown as { actorId?: string }).actorId;
  if (action.polarity !== 'must' && action.polarity !== 'must_not') return null;
  if (
    action.object !== undefined &&
    !projectableEntityRef(action.object)
  ) {
    return null;
  }
  if (
    action.laterality !== undefined &&
    typeof action.laterality !== 'string'
  ) {
    return null;
  }
  if (
    action.spatialEffect !== undefined &&
    (!isObj(action.spatialEffect) ||
      (action.spatialEffect.kind === 'directional'
        ? typeof action.spatialEffect.direction !== 'string'
        : action.spatialEffect.kind === 'relation'
          ? typeof action.spatialEffect.relation !== 'string' ||
            !projectableEntityRef(action.spatialEffect.target)
          : true))
  ) {
    return null;
  }
  if (
    action.spatialConstraint !== undefined &&
    (!isObj(action.spatialConstraint) ||
      typeof action.spatialConstraint.relation !== 'string' ||
      !projectableEntityRef(action.spatialConstraint.target))
  ) {
    return null;
  }
  if (
    isObj(action.subject) &&
    (action.subject.kind === 'entity'
      ? !projectableEntityRef(action.subject.entity)
      : action.subject.kind === 'cast_group'
        ? !Array.isArray(action.subject.castIds) ||
          action.subject.castIds.length === 0 ||
          action.subject.castIds.some((castId) => typeof castId !== 'string')
        : action.subject.kind === 'source_phenomenon'
          ? typeof action.subject.sourcePhrase !== 'string'
          : true)
  ) {
    return null;
  }
  if (!isObj(action.subject) && typeof legacyActorId !== 'string') return null;
  const actor =
    action.subject?.kind === 'entity'
      ? refLabel(action.subject.entity, page, contract, spatialMode)
      : action.subject?.kind === 'cast_group'
        ? castGroupLabel(action.subject.castIds, contract)
      : action.subject?.kind === 'source_phenomenon'
        ? `the exact source phenomenon ${JSON.stringify(action.subject.sourcePhrase)}`
        : castLabel(legacyActorId ?? 'unresolved:legacy_actor', contract);
  const verb = projectActionPredicateProse(action.predicate);
  const hand = action.laterality ? ` with the ${action.laterality} hand` : '';
  const object = action.object
    ? ` ${refLabel(action.object, page, contract, spatialMode)}`
    : '';
  const spatialResult = action.spatialEffect
    ? action.spatialEffect.kind === 'directional'
      ? ` ${action.spatialEffect.direction.replace(/_/g, ' ')}`
      : ` ${action.spatialEffect.relation.replace(/_/g, ' ')} ${refLabel(action.spatialEffect.target, page, contract, spatialMode)}`
    : '';
  const spatialConstraint = action.spatialConstraint
    ? ` ${action.spatialConstraint.relation} ${refLabel(action.spatialConstraint.target, page, contract, spatialMode)}`
    : '';
  const lead = action.polarity === 'must_not' ? `${actor} must NOT ${verb}` : `${actor} ${verb}`;
  return `${lead}${object}${spatialResult}${spatialConstraint}${hand}`;
}

/** One readable hazard prohibition. Always negative — hazards have no polarity. */
function safetyProseLine(
  safety: SafetyConstraint,
  page: PageVisualContract,
  contract: BookVisualContract,
  spatialMode: SpatialReferenceProjectionMode = 'description_v2',
): string | null {
  if (
    typeof safety.subjectId !== 'string' ||
    safety.subjectId.trim().length === 0 ||
    typeof safety.relation !== 'string' ||
    !(safety.relation in SAFETY_RELATION_PROSE)
  ) return null;
  const subject = castLabel(safety.subjectId, contract);
  return `${subject} ${SAFETY_RELATION_PROSE[safety.relation]} ${refLabel(safety.target, page, contract, spatialMode)}`;
}

/**
 * Deterministic PROJECTION of a page's structured action beats → one prompt line. Empty string when the page
 * authors none, so the caller's `line()` helper filters it out and the prompt block stays byte-identical.
 */
export function projectPageActionProse(page: PageVisualContract, contract: BookVisualContract): string {
  const actions = safeObjectElements<PageActionRequirement>(page.actionRequirements);
  if (actions.length === 0) return '';
  return actions
    .map((action) => actionProseLine(action, page, contract))
    .filter((line): line is string => line !== null)
    .join('; ');
}

/**
 * Deterministic PROJECTION of a page's structured hazard prohibitions → one prompt line. Empty string when the
 * page authors none (→ byte-identical prompt block).
 */
export function projectPageSafetyProse(page: PageVisualContract, contract: BookVisualContract): string {
  const safety = safeObjectElements<SafetyConstraint>(page.safetyConstraints);
  if (safety.length === 0) return '';
  return safety.map((s) => safetyProseLine(s, page, contract)).join('; ');
}

/* ── TIER B — mustShow / mustNotShow (pure + tested, UNWIRED in Stage 3; Stage 4 checks containment) ── */

/**
 * The prop's AUTHORED NAME — load-bearing, not cosmetic. The vision gate builds its "required to be visible" list
 * by matching `recurringProps[].name`/`id` against `mustShow` prose (name/id equality or substring containment). A
 * projection that dropped the name would silently empty that list and the gate would stop requiring the prop.
 * (Stage 5 fixes this properly by making the gate read `PagePropConstraint` directly.)
 */
function propName(propId: string, contract: BookVisualContract): string {
  const prop = safeObjectElements<BookVisualContract['recurringProps'][number]>(
    contract.recurringProps,
  ).find((p) => p.id === propId);
  return prop ? prop.name : propId;
}

/**
 * Deterministic PROJECTION of a page's structure → the `mustShow` entries it can account for.
 *
 * Stage 3 ships this PURE and UNWIRED: `mustShow` is multi-source, so the structure covers a SUBSET of it and an
 * equality check would be false today. Stage 4 wires the sound rule — CONTAINMENT: every projected entry must be
 * present in the stored `mustShow`.
 */
export function projectPageMustShow(page: PageVisualContract, contract: BookVisualContract): string[] {
  return projectPageMustShowWithSpatialMode(
    page,
    contract,
    'description_v2',
  );
}

/**
 * Historical vc-schema/v4 read compatibility only. New compiler output must
 * use `projectPageMustShow`; this projector exists so immutable old Candidates
 * remain reviewable and can be upgraded by an explicit correction overlay.
 */
export function projectPageMustShowLegacySpatial(
  page: PageVisualContract,
  contract: BookVisualContract,
): string[] {
  return projectPageMustShowWithSpatialMode(page, contract, 'legacy_kind');
}

function projectPageMustShowWithSpatialMode(
  page: PageVisualContract,
  contract: BookVisualContract,
  spatialMode: SpatialReferenceProjectionMode,
): string[] {
  const out: string[] = [];
  for (const pc of safeObjectElements<
    NonNullable<PageVisualContract['propConstraints']>[number]
  >(page.propConstraints)) {
    if (pc.visibility === 'required') out.push(propName(pc.propId, contract));
  }
  for (const action of safeObjectElements<PageActionRequirement>(page.actionRequirements)) {
    if (action.polarity === 'must') {
      const line = actionProseLine(action, page, contract, spatialMode);
      if (line !== null) out.push(line);
    }
  }
  return out;
}

/**
 * Deterministic PROJECTION of a page's structure → the `mustNotShow` entries it can account for. Forbidden props,
 * negative action beats, and EVERY hazard (hazards are always prohibitions, so they can only land here — which is
 * what keeps them clear of the `mustShow`-only floor/bed staging lock). Pure + UNWIRED in Stage 3 (see above).
 */
export function projectPageMustNotShow(page: PageVisualContract, contract: BookVisualContract): string[] {
  return projectPageMustNotShowWithSpatialMode(
    page,
    contract,
    'description_v2',
  );
}

/** See `projectPageMustShowLegacySpatial`. */
export function projectPageMustNotShowLegacySpatial(
  page: PageVisualContract,
  contract: BookVisualContract,
): string[] {
  return projectPageMustNotShowWithSpatialMode(page, contract, 'legacy_kind');
}

function projectPageMustNotShowWithSpatialMode(
  page: PageVisualContract,
  contract: BookVisualContract,
  spatialMode: SpatialReferenceProjectionMode,
): string[] {
  const out: string[] = [];
  for (const pc of safeObjectElements<
    NonNullable<PageVisualContract['propConstraints']>[number]
  >(page.propConstraints)) {
    if (pc.visibility === 'forbidden') out.push(propName(pc.propId, contract));
  }
  for (const action of safeObjectElements<PageActionRequirement>(page.actionRequirements)) {
    if (action.polarity === 'must_not') {
      const line = actionProseLine(action, page, contract, spatialMode);
      if (line !== null) out.push(line);
    }
  }
  for (const safety of safeObjectElements<SafetyConstraint>(page.safetyConstraints)) {
    const line = safetyProseLine(safety, page, contract, spatialMode);
    if (line !== null) out.push(line);
  }
  return out;
}

/**
 * Deterministic PROJECTION of the prop LIFECYCLE → the cover's no-spoiler `mustNotShow` entries.
 *
 * The cover has no page contract (no castIds, no zoneId, no propState), so its no-spoiler rule can only be read
 * from book-level data — which is exactly why `firstRevealPage` lives on the prop. Any prop with a lifecycle is by
 * definition revealed after page 0, so it is a cover spoiler. Pure + UNWIRED in Stage 3.
 */
export function projectCoverMustNotShow(contract: BookVisualContract): string[] {
  const out: string[] = [];
  for (const prop of safeObjectElements<BookVisualContract['recurringProps'][number]>(
    contract.recurringProps,
  )) {
    if (typeof prop.firstRevealPage === 'number') {
      out.push(`${prop.name} (first revealed on page ${prop.firstRevealPage} — no spoiler)`);
    }
  }
  return out;
}
