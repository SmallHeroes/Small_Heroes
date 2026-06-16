import type { PageShot } from '../book-shot-plan/types';

export type AppearanceLightingTarget =
  | 'night_warm_lamp'
  | 'night_moonlit'
  | 'day_soft'
  | 'unspecified';

export type AppearanceDriftSeverity = 'hard' | 'review' | 'accept';

export type SceneAppearanceSignature = {
  factId: string;
  silhouette?: string;
  material?: string;
  colorFamily?: string;
  formNote?: string;
};

export type SceneAppearanceMemory = {
  sceneId: string;
  lightingTarget: AppearanceLightingTarget;
  lightingLockNote: string;
  signatures: SceneAppearanceSignature[];
};

export type SetAppearanceBoardManifest = {
  sceneId: string;
  boardPath: string;
  /** Human acceptance — never auto-set true. */
  approved: boolean;
  humanApprovedAt?: string | null;
  /** Vision QA gate — must pass before human approval. */
  qaPassed: boolean;
  qaFlags?: string[];
  qaCheckedAt?: string | null;
  boardVersion: string;
  generatedAt: string;
  quality: 'low' | 'medium';
  promptExcerpt?: string;
};

export type BoardQaResult = {
  passed: boolean;
  flags: string[];
  visionSkipped: boolean;
};

export type AppearanceDriftFinding = {
  factId: string;
  severity: AppearanceDriftSeverity;
  category: 'position' | 'form' | 'palette' | 'lighting' | 'presence';
  note: string;
};

export type AppearanceDriftReport = {
  page: number;
  sceneId: string;
  findings: AppearanceDriftFinding[];
  hardCount: number;
  reviewCount: number;
  acceptCount: number;
};

export type SetAppearanceBoardOptions = {
  pageShot?: PageShot | null;
  pageNumber?: number;
};
