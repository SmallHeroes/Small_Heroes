import type { PageShot } from '../book-shot-plan/types';

export type SceneMemorySceneType =
  | 'fixed_interior'
  | 'fixed_exterior'
  | 'journey_leg'
  | 'abstract';

export type SceneMemorySeedSource =
  | 'approved_wide_page'
  | 'set_plate'
  | 'authored_seed';

export type SceneMemoryLockLevel = 'open' | 'soft' | 'human_locked';

export type SceneMemoryProvenance =
  | 'story'
  | 'authored_seed'
  | 'set_plate_vision'
  | 'page_vision'
  | 'human';

export type SceneMemoryFactKind = 'position' | 'appearance' | 'stateful';

export type SceneMemoryObservedState =
  | 'standing_canopy'
  | 'loose_pile'
  | 'nest'
  | 'built_or_tent'
  | 'collapsed'
  | 'scattered'
  | 'folded'
  | 'dimmed'
  | 'unchanged'
  | 'not_visible'
  | 'ambiguous';

export type SceneMemoryStableFact = {
  factKind: SceneMemoryFactKind;
  position: string;
  appearance?: string;
  color?: string;
  confidence: number;
  lockLevel: SceneMemoryLockLevel;
  provenance: SceneMemoryProvenance[];
};

export type SceneMemoryStatefulTimelineEntry = {
  page: number;
  state: SceneMemoryObservedState;
  authorizedBy: 'story' | 'human';
};

export type SceneMemoryStatefulObject = {
  identity: string;
  timeline: SceneMemoryStatefulTimelineEntry[];
};

export type SceneMemory = {
  sceneId: string;
  sceneType: SceneMemorySceneType;
  seedSource: SceneMemorySeedSource;
  stableFacts: Record<string, SceneMemoryStableFact>;
  statefulObjects: Record<string, SceneMemoryStatefulObject>;
  unknowns: string[];
  allowedChanges: string[];
  forbiddenChanges: string[];
  inventory: string[];
};

export type SceneMemoryPlan = {
  memory: SceneMemory;
};

export type ObservedSceneFact = {
  factId: string;
  position?: string;
  appearance?: string;
  color?: string;
  state?: SceneMemoryObservedState | string;
  confidence: number;
  visibility: 'visible' | 'uncertain' | 'not_visible';
};

export type ObservedSceneFacts = {
  sceneId: string;
  facts: ObservedSceneFact[];
  unauthorizedProps: string[];
  unknowns: string[];
  visionSkipped: boolean;
  visionError?: string;
};

export type SceneMemoryDriftFactStatus =
  | 'consistent'
  | 'new_info'
  | 'story_authorized_change'
  | 'drift'
  | 'unknown';

export type SceneMemoryDriftPerFact = {
  factId: string;
  status: SceneMemoryDriftFactStatus;
  expected?: string;
  observed?: string;
  note?: string;
  lowSeverityNote?: string;
};

export type SceneMemoryDriftReport = {
  page: number;
  sceneId: string;
  expected: Record<string, SceneMemoryStableFact>;
  observed: ObservedSceneFacts;
  perFact: SceneMemoryDriftPerFact[];
  driftFlags: string[];
  sceneMemoryLockPresent: boolean;
};

export type SceneMemoryLockOptions = {
  pageShot?: PageShot | null;
  pageNumber?: number;
};
