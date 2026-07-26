import type {
  ActionPredicate,
  EntityRef,
  PageTransitionKind,
  SafetyRelation,
} from '@/lib/visual-contract-compiler/types';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';

import type {
  StorySourceIdentity,
  VisualPackageManifest,
  VisualPackageTemplateIdentity,
} from './types';

/**
 * Explicit version boundary for the successor book-level visual authority.
 *
 * PVB-A deliberately does not make this part of visual-package/v3 qualification. PVB-B owns
 * review/approval lifecycle and PVB-C owns runtime cutover.
 */
export const PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION =
  'pre-render-book-visual-blueprint/v1' as const;
export const PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM =
  'canonical-json-sha256' as const;
export const PRE_RENDER_BLUEPRINT_COORDINATE_SPACE =
  'normalized-1000/v1' as const;
export const PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO = {
  width: 2,
  height: 3,
} as const;

export interface PreRenderBlueprintPackageIdentity {
  artifactPath: string;
  digestAlgorithm: typeof PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM;
  digest: string;
  manifestVersion: VisualPackageManifest['manifestVersion'];
  storyKey: string;
  styleId: string;
}

export interface PreRenderBlueprintIdentity {
  storyKey: string;
  styleId: string;
  source: StorySourceIdentity;
  template: VisualPackageTemplateIdentity;
  visualPackage: PreRenderBlueprintPackageIdentity;
}

/**
 * Integer coordinates in a closed 0..1000 normalized plane. Integer-only geometry keeps
 * containment and collision decisions deterministic across JSON/JS runtimes.
 */
export interface BlueprintRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlueprintConnectionEndpoint {
  zoneId: string;
  /** Optional only for legacy zones with no structured nodes yet. When present it resolves in this zone. */
  spatialNodeId?: string;
}

export type BlueprintConnectionKind =
  | 'doorway'
  | 'opening'
  | 'threshold'
  | 'path'
  | 'portal'
  | 'continuous_space';

export interface BlueprintWorldConnection {
  id: string;
  kind: BlueprintConnectionKind;
  from: BlueprintConnectionEndpoint;
  to: BlueprintConnectionEndpoint;
  bidirectional: boolean;
  /**
   * One or more explicitly authored traversal footprints. Bidirectional connections need a
   * destination-zone affordance for each direction that is used by a portrait frame.
   */
  traversalAffordanceIds: string[];
  openingClearanceAffordanceIds: string[];
  safeBoundaryAffordanceIds: string[];
}

export type BlueprintAffordanceConsumer =
  | { kind: 'frame'; frameId: string }
  | { kind: 'action'; pageNumber: number; checkId: string }
  | { kind: 'placement'; pageNumber: number; propId: string }
  | { kind: 'transition'; pageNumber: number }
  | {
      kind: 'safety';
      pageNumber: number;
      subjectId: string;
      relation: SafetyRelation;
      target: EntityRef;
    };

interface BlueprintAffordanceBase {
  id: string;
  zoneId: string;
  footprint: BlueprintRegion;
  consumers: BlueprintAffordanceConsumer[];
}

export interface BlueprintTraversalAffordance extends BlueprintAffordanceBase {
  kind: 'traversal';
  connectionId: string;
  direction: 'forward' | 'reverse' | 'both';
  /** Minimum required `min(width, height)` in normalized-1000 units. */
  minimumClearance: number;
}

export interface BlueprintOpeningClearanceAffordance extends BlueprintAffordanceBase {
  kind: 'opening_clearance';
  connectionId: string;
  openingSpatialNodeId?: string;
  clearanceRegion: BlueprintRegion;
}

export interface BlueprintPlacementSupportAffordance extends BlueprintAffordanceBase {
  kind: 'placement_support';
  support: EntityRef;
  supportedEntities: EntityRef[];
  maximumOccupants: number;
}

export interface BlueprintActionSpaceAffordance extends BlueprintAffordanceBase {
  kind: 'action_space';
  supportedPredicates: ActionPredicate[];
  supportedEntities: EntityRef[];
  /** Maximum unique required-action `actorId` cast members assigned on one frame/page. */
  maximumActors: number;
}

export interface BlueprintCameraAccessAffordance extends BlueprintAffordanceBase {
  kind: 'camera_access';
  visibleRegion: BlueprintRegion;
}

export interface BlueprintSafeBoundaryAffordance extends BlueprintAffordanceBase {
  kind: 'safe_boundary';
  target: EntityRef;
  permittedRegion: BlueprintRegion;
}

export type BlueprintSpatialAffordance =
  | BlueprintTraversalAffordance
  | BlueprintOpeningClearanceAffordance
  | BlueprintPlacementSupportAffordance
  | BlueprintActionSpaceAffordance
  | BlueprintCameraAccessAffordance
  | BlueprintSafeBoundaryAffordance;

/**
 * Stable geometry that may be shown before a narrative prop's first reveal.
 *
 * It points at existing zone geometry and may internally declare which props it eventually
 * supports, but a frame refers only to this neutral geometry id, never to the hidden prop.
 */
export interface RevealSafeSupportingGeometry {
  id: string;
  zoneId: string;
  spatialNodeId: string;
  supportsPropIds: string[];
  spoilerNeutral: true;
}

export type BlueprintNarrativePurpose =
  | 'cover_promise'
  | 'establish_world'
  | 'introduce_cast'
  | 'advance_action'
  | 'transition'
  | 'reveal'
  | 'emotional_turn'
  | 'resolution';

export interface BlueprintNarrativeBeat {
  purpose: BlueprintNarrativePurpose;
  /** Authored frame authority, bound to the exact Story Source by the blueprint identity. */
  summary: string;
}

export interface BlueprintFramePropLifecycle {
  requiredPropIds: string[];
  forbiddenPropIds: string[];
}

export type BlueprintFramePlacementSubject =
  | { kind: 'cast'; castId: string }
  | { kind: 'prop'; propId: string }
  | { kind: 'action'; checkId: string }
  | { kind: 'supporting_geometry'; geometryId: string };

export interface BlueprintFramePlacement {
  id: string;
  subject: BlueprintFramePlacementSubject;
  region: BlueprintRegion;
  depth: 'foreground' | 'midground' | 'background';
  importance: 'key' | 'supporting';
}

export interface BlueprintFrameCamera {
  shot: 'wide' | 'medium' | 'close_up' | 'over_shoulder' | 'tracking';
  angle: 'eye_level' | 'low_angle' | 'high_angle' | 'three_quarter' | 'overhead';
  affordanceId: string;
}

export interface BlueprintFrameContinuity {
  previousFrameId: string | null;
  transitionKind: PageTransitionKind;
  connectionId?: string;
  carryoverRefs: EntityRef[];
}

interface PortraitBlueprintFrameBase {
  id: string;
  aspectRatio: typeof PRE_RENDER_BLUEPRINT_PORTRAIT_ASPECT_RATIO;
  coordinateSpace: typeof PRE_RENDER_BLUEPRINT_COORDINATE_SPACE;
  narrative: BlueprintNarrativeBeat;
  locationId: string;
  zoneId: string;
  castIds: string[];
  propLifecycle: BlueprintFramePropLifecycle;
  placements: BlueprintFramePlacement[];
  camera: BlueprintFrameCamera;
  textSafeRegion: BlueprintRegion;
  affordanceIds: string[];
  continuity: BlueprintFrameContinuity;
}

export interface PortraitCoverBlueprintFrame extends PortraitBlueprintFrameBase {
  kind: 'cover';
}

export interface PortraitPageBlueprintFrame extends PortraitBlueprintFrameBase {
  kind: 'page';
  pageNumber: number;
}

export type PortraitBlueprintFrame =
  | PortraitCoverBlueprintFrame
  | PortraitPageBlueprintFrame;

export interface PreRenderBlueprintWorldPlan {
  connections: BlueprintWorldConnection[];
  affordances: BlueprintSpatialAffordance[];
  revealSafeSupportingGeometry: RevealSafeSupportingGeometry[];
}

/**
 * One successor authority: the existing validated Visual Contract is embedded once and remains
 * the only declaration of world/cast/prop/action/safety facts. The new worldPlan and frames add
 * only the missing feasibility and portrait-composition authority.
 */
export interface PreRenderBookVisualBlueprint {
  version: typeof PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION;
  identity: PreRenderBlueprintIdentity;
  visualContract: BookVisualContractTemplate;
  worldPlan: PreRenderBlueprintWorldPlan;
  frames: PortraitBlueprintFrame[];
  digestAlgorithm: typeof PRE_RENDER_BLUEPRINT_DIGEST_ALGORITHM;
  digest: string;
}

export type PreRenderBookVisualBlueprintDraft = Omit<
  PreRenderBookVisualBlueprint,
  'digestAlgorithm' | 'digest'
>;

export interface PreRenderBlueprintValidationContext {
  source: StorySourceIdentity;
  template: BookVisualContractTemplate;
  visualPackage: VisualPackageManifest;
  visualPackageArtifactPath: string;
}

export type PreRenderBlueprintIssueCode =
  | 'schema_invalid'
  | 'schema_version_unsupported'
  | 'digest_mismatch'
  | 'identity_mismatch'
  | 'source_stale'
  | 'template_stale'
  | 'package_stale'
  | 'visual_contract_invalid'
  | 'coverage_incomplete'
  | 'coverage_duplicate'
  | 'coverage_extra'
  | 'reference_unresolved'
  | 'reference_duplicate'
  | 'aspect_ratio_invalid'
  | 'region_invalid'
  | 'frame_authority_mismatch'
  | 'affordance_incompatible'
  | 'placement_infeasible'
  | 'action_infeasible'
  | 'traversal_infeasible'
  | 'camera_infeasible'
  | 'safety_infeasible'
  | 'transition_invalid'
  | 'reveal_violation'
  | 'text_safe_collision';

export interface PreRenderBlueprintIssue {
  code: PreRenderBlueprintIssueCode;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export type PreRenderBlueprintValidationResult =
  | { ok: true; blueprint: PreRenderBookVisualBlueprint }
  | { ok: false; issues: PreRenderBlueprintIssue[] };

export class InvalidPreRenderBookVisualBlueprintError extends Error {
  readonly isInvalidPreRenderBookVisualBlueprint = true as const;

  constructor(readonly issues: PreRenderBlueprintIssue[]) {
    super(
      `Invalid PreRenderBookVisualBlueprint: ${issues
        .map((entry) => `${entry.code}: ${entry.message}`)
        .join('; ')}`,
    );
    this.name = 'InvalidPreRenderBookVisualBlueprintError';
  }
}
