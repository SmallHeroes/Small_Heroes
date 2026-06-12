export const SHOT_TYPES = [
  'establishing_wide',
  'medium_wide',
  'medium',
  'intimate',
  'close_up',
  'dynamic_angle',
] as const;

export type ShotType = (typeof SHOT_TYPES)[number];
export type ShotAngle = 'eye' | 'low' | 'high' | 'over_shoulder';

export interface PageShot {
  page: number;
  shot: ShotType;
  angle?: ShotAngle;
  rationale: string;
}

export interface BookShotPlan {
  pageCount: number;
  source: 'derived' | 'override';
  pages: PageShot[];
}

export interface PageBeatInput {
  page: number;
  imageDirection: string;
  bookPageText: string;
  wordCount?: number;
}

export interface ShotPlanQuotas {
  establishing: number;
  emotionalClose: number;
  dynamicAction: number;
  quietTransition: number;
  finalResolving: number;
}
