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

/** A set reference for a location. 1A: schema-only — `status: 'none'` until 1B generates/stores it. */
export interface SetReferenceDescriptor {
  status: 'none' | 'pending' | 'ready';
  /** Present only when status === 'ready' (1B). */
  url?: string;
  storageKey?: string;
  /** How the canonical set ref would be generated (1B); recorded now so 1A stays text-only. */
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
   */
  stableGeometry?: string[];
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
 * resolve to `cast.child.id`, `cast.companion?.id`, or a `humanCast[].id`). All fields additive + OPTIONAL — omit a
 * field (or the whole entry / the whole `castStates` key) when unauthored so the contract hash stays byte-identical.
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
   * exam chair, not on the floor" and the injection↔bandage same-arm continuity. Additive + OPTIONAL — omit the key
   * when unauthored so the contract hash stays byte-identical.
   */
  castStates?: PageCastState[];
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
