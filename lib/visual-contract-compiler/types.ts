/**
 * BookVisualContract — the TOP source of truth for a book's visual continuity.
 *
 * Derived ONCE from the full story text BEFORE any render (never "learned from page 1"). It sits
 * ABOVE StoryLocationBible / scene-memory / set-appearance and OUTRANKS `imageDirection` and the
 * `extractLocationZone` keyword classifier: where they conflict, the contract wins. A page's
 * `imageDirection` may influence camera/action only — never location identity, cast, wardrobe, or
 * forbidden elements.
 *
 * Phase 1A: this schema is the spine — it SUPPORTS set references (so 1B can fill them) but does NOT
 * generate them, and there is no vision-QA gate yet. Everything here is text-only and deterministic.
 */

export const BOOK_VISUAL_CONTRACT_VERSION = 1 as const;

/**
 * A set reference for a location — the Set Identity Board REFERENCE POLICY (SET-CONSISTENCY step 2).
 *
 * The three statuses are the location's board policy; they do NOT hold the board bytes (an approved board lives in
 * the global registry, keyed by `setDefinitionHash`, and is bound per-order into `pipelineCache` at freeze time):
 *  - absent / `status:'none'` — LEGACY: this location does not require a board (current render path unchanged).
 *  - `status:'pending'`       — an approved board is REQUIRED from the registry before render (fail-closed if missing).
 *  - `status:'ready'`         — required AND must still pass registry / hash / human-approval validation at bind time.
 * `url`/`storageKey`/`prompt` remain advisory hints only; they are NEVER the render authority (the per-order binding is).
 */
export interface SetReferenceDescriptor {
  status: 'none' | 'pending' | 'ready';
  /** Advisory hint only — the render authority is the per-order board binding, never this url. */
  url?: string;
  storageKey?: string;
  /** How the canonical set ref would be generated (offline); recorded for provenance. */
  prompt?: string;
}

/**
 * Coarse environment classification for a location. vNext (WS0): drives style-ref selection
 * "locks-first, regex-last" — the contract's `environmentClass` decides which style-ref subset applies;
 * regex is telemetry-fallback only. `neutral` (or an unknown/unmatched class) → ZERO style refs
 * (never mountains/stream-by-default). Additive + optional so 1A/1B contracts are unaffected.
 */
export type EnvironmentClass = 'indoor' | 'outdoor' | 'neutral';

/** A stable, reusable spatial/set anchor within a location (vNext). Data, never book-specific code. */
export interface LocationAnchor {
  id: string;
  description: string;
}

/** A real place in the book (e.g. `playground_main`, `home_living_room`). */
export interface VisualLocation {
  id: string;
  name: string;
  description: string;
  /** For cover/world matching (e.g. `day`, `night`, `dusk`). */
  timeOfDay?: string;
  /** ONE canonical set ref per location, reused across that location's pages (filled in 1B). */
  setReference?: SetReferenceDescriptor;
  /**
   * SET-CONSISTENCY step 2 (additive, optional): the SHARED physical-set identity. Locations that are different
   * viewpoints/zones of ONE physical set (e.g. a bedroom-window room and the balcony it opens onto) carry the SAME
   * `setIdentityId` so they resolve to ONE reusable Set Identity Board. Default authoring is one identity per
   * location (omit the field). No paid-runtime heuristic may GUESS grouping — it is authored. Locations sharing an
   * identity MUST agree on their `setReference` requiredness (validated), so a set is never half board-required.
   */
  setIdentityId?: string;
  /** vNext: coarse indoor/outdoor/neutral class — the style-ref lock (locks-first). Optional; additive. */
  environmentClass?: EnvironmentClass;
  /** vNext: lighting descriptor for the location (e.g. `clinic_fluorescent`, `warm_dusk`). Optional. */
  lighting?: string;
  /** vNext: stable spatial/set anchors reused across this location's pages. Optional; additive. */
  anchors?: LocationAnchor[];
  /** vNext: freeform spatial-layout / set-topology description for the location. Optional; additive. */
  topology?: string;
}

/**
 * vNext (Contract v2 / Stage 3): a typed reference into ONE of the contract's id spaces.
 *
 * A discriminated union rather than a bare string because the id spaces already COLLIDE: `exam_chair` is BOTH a
 * `VisualLocation.anchors[].id` and a `RecurringProp.id` in the shipped bunny artifact. A bare id would need a
 * guessing resolver, and this layer never guesses (cf. `resolveZoneRef`: exact, else exactly-one-normalized, else throw).
 *  - `cast`    → resolves against `cast.child.id` / `cast.companion?.id` / `humanCast[].id` (the `castIds` id space)
 *  - `prop`    → resolves against `recurringProps[].id`
 *  - `spatial` → resolves against the PAGE'S OWN zone's `spatialNodes[].id` (zone-scoped — never cross-zone)
 *  - `anchor`  → resolves against the page's location's `anchors[].id`
 */
export type EntityRef =
  | { kind: 'cast'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'spatial'; id: string }
  | { kind: 'anchor'; id: string };

/**
 * vNext (Contract v2 / Stage 3): the kind of a `SpatialNode`. CLOSED enum, checked at RUNTIME (the TS type is not
 * enforced on JSON parsed from an artifact). An opening is declared PER NODE — never one ambiguous `openingType`
 * on a whole scene — so a zone may hold a window AND a balcony door AND a doorway without collapsing them.
 */
export type SpatialNodeKind =
  | 'doorway'
  | 'window'
  | 'balcony_door'
  | 'railing'
  | 'ledge'
  | 'wall'
  /** THE FLOOR gets an id — today it exists only as the words ", not on the floor" fused into `bodyState` prose. */
  | 'floor'
  | 'furniture';

/**
 * vNext (Contract v2 / Stage 3): a named piece of a zone's fixed set geometry — the STRUCTURED SOURCE that
 * `VisualZone.stableGeometry` projects FROM (see projectContractProse.ts).
 *
 * Zone-scoped by construction: a node is declared on the zone it belongs to, so it carries no locationId/zoneId (the
 * zone already knows), and a page can only ever see its OWN zone's nodes (derivePageVisualContracts.ts resolves only
 * `zone?.stableGeometry`). That is what makes "no cross-zone geometry leak" true BY CONSTRUCTION rather than by
 * discipline — the property commit b846c47b (P1-2c) had to restore by hand.
 */
export interface SpatialNode {
  /** Unique WITHIN this zone (not book-global — zone-scoped, like the node itself). */
  id: string;
  kind: SpatialNodeKind;
  /** The authored set description for this node — the payload the projection emits. */
  description: string;
  /**
   * OPTIONAL identity bind: this node IS an already-declared prop or location anchor (the exam chair is BOTH a
   * `recurringProp` and a location anchor in the shipped bunny artifact). Reconciles the colliding id spaces
   * without minting a third. At most ONE bind; only `prop` / `anchor` refs are legal here.
   */
  bindsTo?: Extract<EntityRef, { kind: 'prop' } | { kind: 'anchor' }>;
}

/**
 * vNext (Contract v2 / Stage 3): a fixed geometric relation between two `SpatialNode`s of the SAME zone. CLOSED
 * enum, runtime-checked.
 *
 * INTRA-ZONE ONLY. Cross-zone / inter-room topology already has a home (`VisualLocation.topology`, which feeds the
 * SET TOPOLOGY LOCK) and re-expressing it here would re-open the P1-2c adjacency-leak class.
 *
 * `left_of` / `right_of` are deliberately EXCLUDED: set laterality inverts with camera angle, so it is not a STABLE
 * geometry fact, and this layer already refuses to derive laterality (it is a human authoring choice).
 * `leads_to` / `adjoins` are excluded as cross-zone facts — they belong in the node's `description`.
 */
export type SpatialRelationKind =
  | 'on_same_wall_as'
  | 'adjacent_to'
  | 'opposite_to'
  | 'above'
  | 'below'
  | 'centered_in';

export interface SpatialRelation {
  /** A `SpatialNode.id` in THIS zone. */
  subjectId: string;
  relation: SpatialRelationKind;
  /** A `SpatialNode.id` in THIS zone. Omitted ONLY for `centered_in`, whose object is the zone itself. */
  objectId?: string;
}

/**
 * A zone is a sub-area of a location, shown hierarchically as `locationId → zoneId`. CRITICAL: a
 * "gate" is a ZONE inside `playground_main`, NOT a new location — this is the fix for the
 * gate→cave reclassification (the keyword classifier used to promote a zone to a whole new world).
 */
export interface VisualZone {
  id: string;
  /** Parent location — every zone belongs to exactly one location. */
  locationId: string;
  name: string;
  description: string;
  /** Optional default shot/framing hint for the zone. */
  shot?: string;
  /**
   * vNext (Slice B): stable per-zone SET GEOMETRY — the parts of this zone's set that must stay put across every
   * page in the zone (door type/placement, wall/decal layout, cabinets/furniture, floor cues). Additive + OPTIONAL:
   * OMIT the key entirely when unauthored (NEVER `[]` or `null`) so a contract without it hashes byte-identical.
   * Emitted per-page via the authoritative contract prompt block (page → its own zone → geometry) — no cross-zone leak.
   *
   * vNext (Contract v2 / Stage 3) — NO LONGER AN INDEPENDENT AUTHORITY once its structured source exists: when
   * `spatialNodes` is present this array MUST EQUAL `projectZoneStableGeometry(zone)` element-for-element (enforced by
   * validateBookVisualContract). When `spatialNodes` is absent it stays hand-authored v1 prose, untouched. The switch
   * is per-ZONE (not per-contract, not per-schema-version), so v1 zones keep working and hash byte-identically.
   */
  stableGeometry?: string[];
  /**
   * vNext (Contract v2 / Stage 3): the STRUCTURED source of this zone's set geometry — `stableGeometry` is its
   * deterministic projection. Additive + OPTIONAL: OMIT the key entirely when unauthored (NEVER `[]` or `null`) so a
   * contract without it hashes byte-identical. When present it MUST be a NON-EMPTY array of well-formed nodes.
   */
  spatialNodes?: SpatialNode[];
  /**
   * vNext (Contract v2 / Stage 3): fixed geometric relations between this zone's `spatialNodes`. Same omit rule.
   * Subject/object MUST resolve to nodes of THIS zone — intra-zone only, so geometry can never leak across zones.
   */
  spatialRelations?: SpatialRelation[];
}

/** A locked outfit for a cast member — the contract's wardrobe authority. */
export interface WardrobeLock {
  description: string;
  /** Outfit elements that must NEVER appear (drift guards). */
  forbidden?: string[];
}

export type VisualCastRole = 'child' | 'companion';

export interface VisualCastMember {
  id: string;
  role: VisualCastRole;
  name?: string;
  wardrobe: WardrobeLock;
}

/** Child is always present in the cast; companion is optional (some stories have none). */
export interface VisualCast {
  child: VisualCastMember;
  companion?: VisualCastMember;
}

/** A key recurring object whose identity must stay stable across the book. */
export interface RecurringProp {
  id: string;
  name: string;
  description: string;
  /**
   * vNext (Slice B): stable MATERIAL / finish of this prop (e.g. "padded medical vinyl seat, metal base"). Additive +
   * OPTIONAL — OMIT when unauthored (never `null`) so the contract hash stays byte-identical.
   */
  material?: string;
  /**
   * vNext (Slice B): stable SCALE, expressed relative to the child where possible (e.g. "the seat reaches the child's
   * chest — the 'sitting mountain'"). Additive + OPTIONAL; omit when unauthored.
   */
  scale?: string;
  /**
   * vNext (Slice B): identity-PERSISTENCE note — the SAME object wherever it appears (e.g. "the identical chair on
   * every exam-room page; never redesigned or re-materialed"). Additive + OPTIONAL; omit when unauthored.
   */
  persistence?: string;
  /**
   * vNext (Contract v2 / Stage 3): the PROP LIFECYCLE — the first page number on which this prop may be visible.
   *
   * It lives on the PROP, not per-page, for four reasons:
   *  1. The COVER cannot express it per-page — the cover has no `pageContracts` entry (no propState, no castIds, no
   *     zoneId), yet the no-spoiler rule is exactly a lifecycle read ("the injection — the page-10 moment").
   *     `projectCoverMustNotShow` reads this field directly.
   *  2. It is a BOOK-level fact: per-page storage would let 12 pages disagree about one prop's first reveal — a
   *     contradiction the schema should PREVENT rather than police.
   *  3. Precedent: `RecurringHumanCastMember.pagesPresent` — cast lifecycle lives on the cast member, not each page.
   *  4. `recurringProps` passes by reference through materialize() → zero threading.
   *
   * Page 0 (the cover) precedes every page ≥ 1, so any prop carrying this key is a cover spoiler. A prop that may be
   * revealed on the cover has no lifecycle → OMIT the key (never `0`, never `null`). Stage 3 validates
   * `Number.isInteger && >= 1`; the CROSS-PAGE coherence rule (no `required` constraint on a page < firstRevealPage)
   * is deferred to Stage 4, alongside the existing `humanCast.pagesPresent ↔ castIds` bidirectional rule.
   */
  firstRevealPage?: number;
}

/** Per-page state of a recurring prop (e.g. the gate `closed` → `open`). */
export interface PagePropState {
  propId: string;
  state: string;
}

/** vNext (Slice B): left/right laterality — a closed enum so it can be checked for cross-page consistency. */
export type Laterality = 'left' | 'right';

/**
 * vNext (Slice B): per-(page, castId) BODY STATE + LATERALITY. `castId` shares the `castIds` id space (it MUST
 * resolve to `cast.child.id`, `cast.companion?.id`, or a `humanCast[].id`). The individual fields are additive +
 * OPTIONAL, but an entry is NOT a no-op holder: every entry MUST carry ≥1 authored field (bodyState OR a laterality
 * field). A castId-only entry changes the frozen hash while emitting no steering, so it is rejected at validation —
 * omit the entry (or the whole `castStates` key) instead, so the contract hash stays byte-identical.
 */
export interface PageCastState {
  castId: string;
  /** e.g. "seated on the examination chair (not on the floor)". */
  bodyState?: string;
  /** The arm receiving the injection. */
  injectionArm?: Laterality;
  /** The arm the bandage is on — MUST equal `injectionArm` across the procedure pages (the laterality continuity). */
  bandageArm?: Laterality;
  /** The hand holding the parent's hand — the OTHER arm from the injection/bandage. */
  freeHand?: Laterality;
}

/** Which declared cast members appear on a page. */
export interface PageCharacterPresence {
  child: boolean;
  companion: boolean;
}

/**
 * vNext transition state for a page.
 *  - `steady`            — the scene is settled inside one zone; no destination is shown.
 *  - `before_transition` — a page LEADING UP to a move; the destination zone (and its unique cast) must NOT
 *                          appear yet (the door is still closed).
 *  - `threshold`         — the "door opens" page; both origin and destination may be visible at the doorway.
 *  - `after_transition`  — the scene has moved into the destination zone.
 */
export type PageTransitionKind = 'steady' | 'before_transition' | 'threshold' | 'after_transition';

/**
 * A per-page zone transition (vNext). For a non-`steady` kind, `fromZoneId`/`toZoneId` reference declared
 * zones; `cue` is the story/image cue that motivates the move (e.g. "the exam-room door opens").
 */
export interface PageTransition {
  kind: PageTransitionKind;
  fromZoneId?: string;
  toZoneId?: string;
  cue?: string;
}

/**
 * vNext (Contract v2 / Stage 3): a per-page prop VISIBILITY constraint — the structured replacement for "the prop's
 * name happens to appear somewhere in this page's `mustShow` prose", which is how the vision gate decides what is
 * required today (pageVisualContractQa substring-matches `mustShow` against `recurringProps` names/ids).
 *
 *  - `required`  the prop MUST be visible on this page.
 *  - `forbidden` the prop MUST NOT be visible on this page.
 *
 * STAGE-4 DECISION — `'optional'` is DROPPED (it existed in the Stage-3 draft and in the original brief). It emitted
 * no steering whatsoever (neither projector reads it, so it reached neither the prompt nor any gate) yet it MOVED the
 * frozen contract hash — precisely the no-op class this layer already rejects (cf. the castId-only rule). The ABSENCE
 * of a constraint already MEANS "optional": the value was pure redundancy with a real cost. Omit the entry instead.
 * A deliberate lifecycle exception is expressed by the prop's `firstRevealPage`, not by a per-page no-op.
 */
export type PropVisibility = 'required' | 'forbidden';

export interface PagePropConstraint {
  /** MUST resolve to a `recurringProps[].id`. */
  propId: string;
  visibility: PropVisibility;
  /** Optional pin to WHICH state of the prop is meant on this page (cf. `PagePropState.state`). */
  stateId?: string;
  /** Optional pin to WHERE the prop sits — MUST resolve to an anchor of this page's location. */
  anchorId?: string;
}

/**
 * vNext (Contract v2 / Stage 3): the CLOSED predicate vocabulary for a page action beat. Runtime-checked.
 *
 * Every member is a POSITIVE verb — the negation lives in `PageActionRequirement.polarity`, never in the verb — so a
 * projection lands in `mustShow` (must) or `mustNotShow` (must_not) by a single field read, with no double negation
 * possible. Deliberately small: the vision gate needs a FINITE check vocabulary (a free string would be the
 * prose-as-authority bug relocated; a mini-DSL would be unparseable downstream).
 */
export type ActionPredicate =
  | 'holds'
  | 'offers'
  | 'touches'
  | 'looks_at'
  | 'reaches_toward'
  | 'climbs_onto'
  | 'sits_on'
  | 'stands_on'
  | 'points_at';

export type ActionPolarity = 'must' | 'must_not';

/**
 * vNext (Contract v2 / Stage 3): a per-page ACTION beat, structured.
 *
 * POLARITY IS LOAD-BEARING, not stylistic: it decides which array the prose projects into, and the wrong array
 * INVERTS a downstream lock. `staging-lock.ts` regex-mines ONLY `mustShow` for /floor|rug|cave|fort/i and emits an
 * ABSOLUTE floor lock; `mustNotShow` is not scanned and is the safe landing zone for negatives. Likewise the
 * cast-contradiction NLP parses ONLY `mustShow` as a positive cast reference — which the `actorId ∈ page.castIds`
 * rule makes safe by construction.
 */
export interface PageActionRequirement {
  /**
   * Stable, NAMESPACED check id — MUST match /^action:[a-z0-9_]+$/ and be unique on this page. A SEPARATE id space
   * from the QA check union and from the `safety:` evidence tag — never collide with either. Follows the existing
   * namespaced-id idiom (`location:` / `zone:` / `transition:` / `cast:` / `prop:`). Binding a checkId to a QA check
   * is Stage 5; Stage 3 enforces only the namespace + per-page uniqueness.
   */
  checkId: string;
  /**
   * MUST be in THIS page's `castIds` — the "no steering for an absent cast member" rule generalized: no action
   * requirement for an actor the page does not contain.
   */
  actorId: string;
  predicate: ActionPredicate;
  /**
   * The thing acted upon. A typed `EntityRef` rather than the loose `objectId?`/`anchorId?` pair: those two can name
   * a prop or an anchor but CANNOT express a cast object ("the child holds the PARENT's hand") or a spatial one
   * ("climbs onto the LEDGE") — and the colliding id spaces make a bare id ambiguous. Omitted for intransitive uses.
   */
  object?: EntityRef;
  polarity: ActionPolarity;
  /** Which arm/hand — reuses the existing closed `Laterality` enum rather than minting a parallel one. */
  laterality?: Laterality;
}

/**
 * vNext (Contract v2 / Stage 3): the CLOSED hazard-relation vocabulary. Runtime-checked.
 *
 * EVERY member is a PROHIBITION and there is deliberately NO `polarity` field: the negation lives in the relation
 * name, so the projection ALWAYS lands in `mustNotShow` and can never invert the `mustShow`-only floor/bed staging
 * lock. Pairing a `polarity` with a `must_not_`-prefixed relation would create a double-negation trap where
 * `polarity:'must_not' + must_not_sit_on` reads as "the child MUST sit on the railing".
 *
 * The brief's `must_remain_behind` / `must_be_supported_by` appear here in prohibitive form — `must_not_pass_beyond`
 * / `must_not_be_unsupported_at` — same authored intent, uniform direction. A POSITIVE "the child IS supported by the
 * chair" is a `PageActionRequirement { predicate:'sits_on', polarity:'must' }`, not a SafetyConstraint.
 *
 * These are hazard RELATIONS over authored structure — never crude booleans like `feetOnFloor`, which wrongly reject
 * sitting / bed / carried-child. Names are chosen so a Stage-5 mapping onto the existing render-time hazard codes is
 * possible, but Stage 3 MUST NOT encode that map (no import edge from this layer into the generation pipeline).
 */
export type SafetyRelation =
  | 'must_not_sit_on'
  | 'must_not_stand_on'
  | 'must_not_lean_over'
  | 'must_not_pass_beyond'
  | 'must_not_be_unsupported_at'
  | 'must_not_be_within_reach_of'
  | 'must_not_be_inside';

/**
 * vNext (Contract v2 / Stage 3): typed evidence origin for a hazard — a discriminated union, never a bare string.
 *
 * There is deliberately NO `derived` / `inferred` kind: the authoring model can hallucinate a fully-valid,
 * internally-consistent contract from nothing (which is why source-prose assertion exists at all), and a hazard whose
 * origin a model may fabricate would re-open exactly that hole. Every hazard traces to story text, a named human, or
 * a versioned policy.
 */
export type SafetyEvidenceOrigin =
  | { kind: 'story_evidence'; page: number; phrase: string }
  | { kind: 'authored'; authorNote: string }
  | { kind: 'policy_default'; policyId: string; version: string };

/**
 * vNext (Contract v2 / Stage 3): a per-page HAZARD PROHIBITION over AUTHORED STRUCTURE (pre-render) — distinct from
 * the render-time safety evaluator, which inspects rendered PIXELS post-render. Different tracks, deliberately.
 *
 * Supersedes the trailing prose clause fused onto `PageCastState.bodyState` today (e.g. "climbing onto the tall
 * examination chair …, not on the floor"), where the safety assertion is an unparseable substring welded to a pose
 * description in one free string. `bodyState` stays POSE-ONLY.
 */
export interface SafetyConstraint {
  /** MUST be in THIS page's `castIds` — no hazard constraint for a subject the page does not contain. */
  subjectId: string;
  relation: SafetyRelation;
  /** The hazard surface/object. A `{kind:'spatial'}` ref is what finally gives THE FLOOR an id. */
  target: EntityRef;
  origin: SafetyEvidenceOrigin;
}

/** Per-page visual contract — every page gets all of these. */
export interface PageVisualContract {
  pageNumber: number;
  /** MUST reference a `BookVisualContract.locations[].id`. */
  locationId: string;
  /** When set, MUST reference a `zones[].id` whose `locationId` equals this page's `locationId`. */
  zoneId?: string;
  /** Page number this page shares a location with (continuity hint); null/undefined if none. */
  sameLocationAs?: number | null;
  mustShow: string[];
  mustNotShow: string[];
  characterPresence: PageCharacterPresence;
  /** Resolved from the companion's wardrobe by derivePageVisualContracts (do not hand-set). */
  companionWardrobeLock?: string;
  propState: PagePropState[];
  /** The ONLY dimension `imageDirection` may influence — camera/shot/action. */
  camera: string;
  shot?: string;
  /**
   * vNext: the stable cast-member ids present on this page (child / companion / recurring human cast).
   * Each id MUST resolve to a defined cast member (cast.child.id, cast.companion?.id, or a humanCast[].id).
   * Optional + additive so 1A/1B contracts validate unchanged; the vNext validator enforces resolution.
   */
  castIds?: string[];
  /** vNext: this page's zone-transition state (defaults to `steady` when absent). Additive. */
  transition?: PageTransition;
  /**
   * vNext (Slice B): per-(page, castId) BODY STATE + LATERALITY (see PageCastState). Steers "child seated on the
   * exam chair, not on the floor" and the injection↔bandage same-arm continuity. Additive + OPTIONAL — OMIT the key
   * when unauthored (NEVER `[]`) so the contract hash stays byte-identical. When present it MUST be a NON-EMPTY array
   * whose entries each carry ≥1 authored field; an authored `[]` or a castId-only entry is rejected at validation.
   */
  castStates?: PageCastState[];
  /**
   * vNext (Contract v2 / Stage 3): structured per-page prop VISIBILITY — the source `mustShow`/`mustNotShow` project
   * from (projection wired in Stage 4; see projectContractProse.ts). Additive + OPTIONAL — OMIT the key when
   * unauthored (NEVER `[]`) so the contract hash stays byte-identical.
   */
  propConstraints?: PagePropConstraint[];
  /**
   * vNext (Contract v2 / Stage 3): structured per-page ACTION beats — the source the action prose projects from.
   * Same omit rule. Every `actorId` MUST be in this page's `castIds`.
   */
  actionRequirements?: PageActionRequirement[];
  /**
   * vNext (Contract v2 / Stage 3): structured per-page HAZARD prohibitions — replaces safety clauses fused into
   * `bodyState` prose. Same omit rule. Every `subjectId` MUST be in this page's `castIds`.
   */
  safetyConstraints?: SafetyConstraint[];
}

/** The cover is the book's promise — its own contract (QA enforced in 1B). */
export interface CoverContract {
  worldType: string;
  /** MUST reference a `BookVisualContract.locations[].id`. */
  locationId: string;
  timeOfDay?: string;
  mustShow: string[];
  mustNotShow: string[];
}

/** Coarse, text-evidenced gender for a recurring human cast member (vNext). */
export type HumanCastGender = 'male' | 'female' | 'unspecified';

/**
 * A recurring HUMAN cast member whose identity must stay stable across the book (vNext) — e.g. the doctor,
 * the mother, the teacher. General (never book-specific): compiled from the story text's cues into DATA.
 *
 *  - `id`               stable, namespaced (e.g. `human:doctor`) so it never collides with positional ids.
 *  - `role`             the narrative role (`doctor`, `mother`, `teacher`, …).
 *  - `aliases`          other phrases the story uses for this person.
 *  - `gender`           text-evidenced coarse gender; `textEvidence` binds the decision to a story phrase.
 *  - `coarseAppearance` stable, low-resolution appearance lock (build/hair/skin — NOT a likeness identity).
 *  - `wardrobe`         locked outfit (reuses the shared WardrobeLock).
 *  - `forbiddenAppearance` appearance elements that must NEVER be rendered for this person (drift guards).
 *  - `pagesPresent`     the page numbers this person appears on.
 *  - `textEvidence`     the exact story phrase the identity decision is bound to (e.g. "הרופא" → male).
 */
export interface RecurringHumanCastMember {
  id: string;
  role: string;
  aliases: string[];
  gender: HumanCastGender;
  coarseAppearance: string;
  wardrobe: WardrobeLock;
  forbiddenAppearance: string[];
  pagesPresent: number[];
  textEvidence: string;
}

export interface VisualContractProvenance {
  source: 'llm' | 'fallback';
  model?: string;
  compiledFromPages: number;
}

export interface BookVisualContract {
  version: typeof BOOK_VISUAL_CONTRACT_VERSION;
  storyKey?: string;
  worldType: string;
  locations: VisualLocation[];
  zones: VisualZone[];
  cast: VisualCast;
  /**
   * vNext: recurring HUMAN cast (doctor/mother/teacher/…), with stable namespaced ids. Optional + additive
   * so existing contracts validate unchanged; the vNext validator resolves per-page castIds against these.
   */
  humanCast?: RecurringHumanCastMember[];
  recurringProps: RecurringProp[];
  /** Global "never render" list — kills stray entities (e.g. an uninvited dragon) on every page. */
  forbiddenGlobalElements: string[];
  coverContract: CoverContract;
  pageContracts: PageVisualContract[];
  provenance?: VisualContractProvenance;
  /** 0..1 self-reported confidence; advisory only in 1A. */
  confidence?: number;
}
