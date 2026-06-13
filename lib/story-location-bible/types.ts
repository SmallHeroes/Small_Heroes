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

export interface BookLocationBible {
  continuityMode: LocationContinuityMode;
  primarySetting: string;
  allowedZones: LocationZone[];
  fixedAnchors: FixedAnchor[];
  forbiddenDrift: string[];
  transitionRules: string[];
  source: LocationBibleSource;
  pageCount?: number;
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
  visualSpoilerPolicy?: VisualSpoilerPolicy;
  expectedBucketVisibility?: ExpectedBucketVisibility;
  referenceSheets?: PageReferenceSheets;
}

export interface StoryLocationPlanBundle {
  bible: BookLocationBible;
  pagePlans: PageLocationPlan[];
}
