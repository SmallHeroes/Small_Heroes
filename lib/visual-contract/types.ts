/**
 * Visual Contract Compiler — Phase 1 types.
 *
 * A `BookVisualContract` is a hard, render-obedience contract derived from a book's
 * story (prose + imageDirections + frontmatter motifs + optional location bible).
 * Renders must OBEY it; a per-page vision-QA gate enforces it across the three
 * failure classes the Leo render exhibited: continuity, entity, storytelling.
 *
 * Phase 1 is deterministic + fail-closed: if the compiled contract is low-confidence
 * or missing the render-critical sections, `renderReady` is false and full render is
 * blocked (the caller must refuse to render on a weak contract).
 */

export type FailureClass = 'continuity' | 'entity' | 'storytelling';

export type ContractSource =
  | 'story_frontmatter'
  | 'image_direction'
  | 'story_prose'
  | 'location_bible'
  | 'manual_override'
  | 'derived';

/** dotted path of the tagged element, e.g. "criticalObjects.stone_gate". */
export interface ContractProvenanceEntry {
  path: string;
  source: ContractSource;
  /** 0..1 — confidence this element is correct/grounded. */
  confidence: number;
  note?: string;
}

export interface ObjectStateEntry {
  page: number;
  state: string;
}

export interface CriticalObject {
  objectId: string;
  canonicalDescription: string;
  scaleLock: string;
  allowedVariants: string[];
  forbiddenVariants: string[];
  stateTimeline: ObjectStateEntry[];
  /** Populated in Increment 2 when the object reference sheet is generated. */
  refSheetUrl?: string | null;
}

export interface CharacterLock {
  protagonistId: string;
  age?: string | null;
  hair?: string | null;
  skin?: string | null;
  outfit?: string | null;
  /** Exactly one protagonist; clones/duplicates are a hard fail. */
  singleInstance: true;
  /** NO-PHOTO orders: illustrated storybook, never photoreal cutout. */
  photoPolicy: 'illustrated_not_photoreal';
}

export interface CompanionScaleLock {
  rule: string; // e.g. "small_cub_always"
  relativeScale: string; // e.g. "knee-to-waist height of the child"
  neverAdultOrGiant: boolean;
  /** Page numbers explicitly allowed to deviate (none by default). */
  approvedExceptions: number[];
}

export interface CompanionLock {
  companionId: string;
  name?: string | null;
  species?: string | null;
  visualDescription?: string | null;
  characterScaleLock: CompanionScaleLock;
}

export interface SceneDef {
  sceneId: string;
  label: string;
  pages: number[];
  transitionRules: string[];
}

export interface PageCompanion {
  present: boolean;
  scale?: string | null;
}

export interface PageContract {
  page: number;
  sceneId: string;
  action: string;
  emotionalBeat: string;
  companion: PageCompanion;
  mustShow: string[];
  mustNotShow: string[];
}

export interface ReferencePlan {
  /** Strict priority, highest first. Lower tiers drop first under ref budget. */
  priority: string[];
  dropPolicy: 'style_first';
  criticalRefsOutrankStyle: true;
}

export interface QaPolicy {
  hardAssertions: FailureClass[];
  warningAssertions: string[];
  maxRerolls: number;
  failClosed: true;
}

export interface CoverContract {
  /** Phase 1 placeholder — cover is reviewed/built separately in Phase 3. */
  reviewedSeparately: true;
  title?: string | null;
}

export interface ContractConfidence {
  overall: number;
  min: number;
  byClass: Record<FailureClass, number>;
}

export interface BookVisualContract {
  schemaVersion: 1;
  storyKey: string;
  companionId: string | null;
  direction?: string | null;
  category?: string | null;
  pageCount: number;
  /** ISO timestamp; passed in by the caller (render-safe code never calls Date.now). */
  generatedAt: string;

  characterLock: CharacterLock;
  companionLock: CompanionLock | null;
  criticalObjects: CriticalObject[];
  scenes: SceneDef[];
  /** pageNumber (string) -> sceneId */
  worldStateByPage: Record<string, string>;
  /** objectId -> ordered state entries */
  objectStateTimeline: Record<string, ObjectStateEntry[]>;
  pageContracts: PageContract[];
  referencePlan: ReferencePlan;
  qaPolicy: QaPolicy;
  coverContract: CoverContract;

  provenance: ContractProvenanceEntry[];
  confidence: ContractConfidence;
  /** Fail-closed verdict computed at compile time (see assertContractRenderReady). */
  renderReady: boolean;
  renderReadyBlockers: string[];
}
