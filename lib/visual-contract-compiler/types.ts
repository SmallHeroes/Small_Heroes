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

/** A real place in the book (e.g. `playground_main`, `home_living_room`). */
export interface VisualLocation {
  id: string;
  name: string;
  description: string;
  /** For cover/world matching (e.g. `day`, `night`, `dusk`). */
  timeOfDay?: string;
  /** ONE canonical set ref per location, reused across that location's pages (filled in 1B). */
  setReference?: SetReferenceDescriptor;
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
}

/** Per-page state of a recurring prop (e.g. the gate `closed` → `open`). */
export interface PagePropState {
  propId: string;
  state: string;
}

/** Which declared cast members appear on a page. */
export interface PageCharacterPresence {
  child: boolean;
  companion: boolean;
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
  recurringProps: RecurringProp[];
  /** Global "never render" list — kills stray entities (e.g. an uninvited dragon) on every page. */
  forbiddenGlobalElements: string[];
  coverContract: CoverContract;
  pageContracts: PageVisualContract[];
  provenance?: VisualContractProvenance;
  /** 0..1 self-reported confidence; advisory only in 1A. */
  confidence?: number;
}
