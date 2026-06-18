export type LocationContinuityMode =
  | 'single_location'
  | 'location_cluster'
  | 'journey'
  | 'fantasy_world';

export type LocationBibleSource =
  | 'frontmatter'
  | 'sidecar'
  | 'v3_artifact'
  | 'derived'
  | 'scenario_default';

export interface LocationZoneReferenceSheet {
  /** Zone set reference filename — design artifact only; never attached to page generation. */
  setFile?: string;
  /** @deprecated scene object refs — use isolatedObjectFile instead. */
  objectFiles?: string[];
  /** Isolated object on neutral ground (e.g. bucket-object.png). */
  isolatedObjectFile?: string;
}

export type ExpectedBucketVisibility =
  | 'hidden'
  | 'first_reveal'
  | 'visible'
  | 'background'
  | 'absent';

export interface VisualSpoilerPolicy {
  hiddenObjects?: string[];
  revealObjects?: string[];
  note?: string;
}

export interface LocationZone {
  id: string;
  description: string;
  stableGeometry: string[];
  visualAnchors: string[];
  allowedCameraAccess: string[];
  referenceSheet?: LocationZoneReferenceSheet;
}

export interface PageReferenceSheets {
  zoneId: string;
  /** Never populated for page generation after scene-lock fix. */
  zoneSetPath?: string;
  /** @deprecated scene bucket refs */
  objectAnchorPaths?: string[];
  isolatedObjectPaths?: string[];
}

export interface ZoneSheetManifest {
  zoneId: string;
  approvedBy?: string;
  approvedAt?: string;
  generatedAt: string;
  files: {
    set?: string;
    objects?: string[];
    isolatedObject?: string;
  };
  notes?: string;
}

export interface FixedAnchor {
  id: string;
  label: string;
  description: string;
  mustRemainSameAcrossPages: boolean;
}

/** Fixed spatial relations for a single-location interior set (data-driven; no story branches). */
export interface SetTopologyElement {
  id: string;
  placement: string;
  wall?: string;
  zone?: string;
  colorLock?: string;
}

export interface SetTopology {
  elements: SetTopologyElement[];
  walls?: string;
  floor?: string;
  timeOfDay?: string;
  forbidden?: string[];
}

/**
 * Scene-Graph node — a named place the book moves through.
 * General structure (auto-generatable per story); koko is the first populated pilot.
 */
export interface LocationSceneNode {
  id: string;
  label?: string;
  description: string;
  /** Scene-graph edges — the next scene(s) reachable from this one along the journey. */
  transitionsTo?: string[];
  visualAnchors?: string[];
  /**
   * Pages this scene covers. Lets allowedZones + pagePlans be auto-derived from the
   * sceneGraph alone (single source of truth) — see deriveLocationPlanFromSceneGraph.
   * Optional: a bible may instead author allowedZones/pagePlans explicitly.
   */
  pages?: number[];
}

/** One state of a recurring object on a specific page (free-text lock note). */
export interface RecurringObjectStateEntry {
  page: number;
  state: string;
}

/**
 * When/where a recurring object is locked onto a page:
 * - `timeline_only` (DEFAULT) — only the pages in its stateTimeline. Correct for PARTIAL objects
 *   that appear/change partway (a note drawn on p6, a button placed on p11). Never forced onto a
 *   page where it does not exist yet.
 * - `whole_scene` — every page of the scenes in `appearsInScenes`. ONLY for real set fixtures
 *   (bed / window / the gate-as-set) that are physically present throughout their scene(s).
 * - `explicit_pages` — exactly the pages in `appearsOnPages`.
 */
export type RecurringObjectPresencePolicy = 'whole_scene' | 'timeline_only' | 'explicit_pages';

/**
 * Recurring-Object lock — an object whose identity must stay constant wherever it
 * appears across scenes, while its state may evolve per stateTimeline.
 */
export interface RecurringObjectLock {
  id: string;
  label: string;
  /** Identity that must hold every appearance — the part that never drifts. */
  identity: string;
  /** Scene ids this object may appear in (used by `whole_scene`). */
  appearsInScenes?: string[];
  /** Presence policy — defaults to `timeline_only` when omitted (safe for partial objects). */
  presencePolicy?: RecurringObjectPresencePolicy;
  /** Exact pages this object appears on — used only with `explicit_pages`. */
  appearsOnPages?: number[];
  forbiddenDrift?: string[];
  stateTimeline: RecurringObjectStateEntry[];
}

/**
 * Scene-Graph + Recurring-Object lock layer. The schema is generic and reusable
 * for all 18 stories; per-story data is authored (or auto-generated) into the sidecar.
 * When present, this layer drives scene-memory derivation over the generic fallback.
 */
export interface SceneGraph {
  scenes: LocationSceneNode[];
  recurringObjects: RecurringObjectLock[];
  forbiddenDrift?: string[];
  /**
   * When false (DEFAULT), `derivePagePlansFromSceneGraph` requires every page (1..pageCount) to be
   * covered by some scene's `pages` and THROWS on a gap — no silent carry-forward. Set true to
   * intentionally let an uncovered page inherit the previous scene.
   */
  allowCarryForward?: boolean;
}

export interface BookLocationBible {
  continuityMode: LocationContinuityMode;
  primarySetting: string;
  allowedZones: LocationZone[];
  fixedAnchors: FixedAnchor[];
  forbiddenDrift: string[];
  transitionRules: string[];
  source: LocationBibleSource;
  pageCount?: number;
  /** Scene-Graph + Recurring-Object lock layer — overrides the generic fallback when present. */
  sceneGraph?: SceneGraph;
  /** Optional override for isolated-object reference block (e.g. lion pillow-cave, not bucket). */
  isolatedObjectPromptInstruction?: string;
  /** Fixed room geography — rendered as SET TOPOLOGY LOCK in prompts. */
  setTopology?: SetTopology;
  /** elementId → isolated asset filename (resolved under zone-sheets dir). */
  setElementFiles?: Record<string, string>;
  /** Future composed topology map — UNUSED in Round 1 (behind future flag). */
  setTopologyMapPath?: string;
}

export type StagingSurfaceOverride = 'floor' | 'bed';

/** Optional per-page staging override when keyword inference misreads surface. */
export interface PageStagingOverride {
  surface: StagingSurfaceOverride;
  /** Named anchor for the STAGING LOCK line (e.g. "the scattered pillow-cave"). */
  anchorHint?: string;
}

export interface PageLocationPlan {
  page: number;
  zoneId: string;
  visibleAnchors: string[];
  cameraPositionHint?: string;
  allowedVariation: string;
  forbiddenDrift: string[];
  /** Mandatory single action line — wins over location continuity in prompt. */
  pageAction?: string;
  /** Overrides inferred floor/bed staging surface for STAGING LOCK. */
  staging?: PageStagingOverride;
  /** When true, attach isolated object refs from zone sheet (if published). Overrides fox bucket heuristics. */
  attachIsolatedObjectRefs?: boolean;
  /** When set, only these manifest filenames attach (basename match). */
  isolatedObjectFiles?: string[];
  visualSpoilerPolicy?: VisualSpoilerPolicy;
  expectedBucketVisibility?: ExpectedBucketVisibility;
  referenceSheets?: PageReferenceSheets;
}

export interface StoryLocationPlanBundle {
  bible: BookLocationBible;
  pagePlans: PageLocationPlan[];
}
