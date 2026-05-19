import type { ValidationReport } from '@/lib/story-validators';
import type { StoryDirection, StoryPageCount } from '@/lib/story-validators';
import type { EditorialReportRuntime } from './editorial/schemas';

export type FinalStoryStatus =
  | 'READY'
  | 'FAILED_TECHNICAL'
  | 'REVIEW_REQUIRED'
  | 'REJECTED_EDITORIAL';

/** v0.2.7 — Surface WHY a story landed in REVIEW_REQUIRED or REJECTED_EDITORIAL. */
export type ReviewReason =
  | 'none'
  | 'diff_ratio_exceeded'           // editorial repair changed >35% of a page
  | 'repair_scope_violation'        // repair touched pages not in changeOnly
  | 'unmatched_quote'               // LLM cited text that doesn't exist in story
  | 'post_repair_not_ready'         // after max repair attempts, still NEEDS_REPAIR
  | 'zod_parse_failed'              // editorial QA returned invalid JSON
  | 'editor_rejected'               // editorial verdict = REJECT (avg too low or too many blockers)
  | 'preserve_list_violated'        // repair lost canonical anchors
  | 'verdict_mismatch_unresolved'   // LLM verdict and code-derived differ in critical way
  | 'exception';                    // unexpected error in pipeline

export type MvpCompanionId = 'bolly_armadillo' | 'chameleon_koko' | 'bat_lily';
export type ChildGender = 'boy' | 'girl';

export interface GenerateInput {
  companionId: MvpCompanionId;
  direction: StoryDirection;
  pageCount?: StoryPageCount;
  childName: string;
  childGender: ChildGender;
  childAge: number;
  prescription: {
    emotionalSituation: string;
    physicalMechanicSuggestion: string;
    tabooDirectWords: string[];
    narrativeConstraint: string;
  };
}

export interface BeatMapEntry {
  pageNumber: number;
  location: string;
  childAction: string;
  companionAction: string;
  emotionalRead: string;
  wordCountTarget: number;
}

export interface MomentContract {
  page: number;
  type?: 'touch' | 'transformation' | 'discovery' | 'comic_failure' | 'sacrifice' | 'naming';
  setup?: string;
  pause?: string;
  physicalAction: string;
  companionSignature: string;
  childBodyResponse?: string;
  echo?: string;
  residue?: string;
}

export interface HookContract {
  sound?: string;
  phrase?: string;
  microAction?: string;
  object?: string;
  appearsOnPages: number[];
}

export interface VisualPacingMap {
  quietPages: number[];
  activePages: number[];
  heartPage: number;
}

export interface Plan {
  beatMap: BeatMapEntry[];
  momentContract: MomentContract;
  hookContract: HookContract;
  preserveListSeeds: string[];
  visualPacingMap: VisualPacingMap;
}

export interface PlanQualityWarning {
  type:
    | 'companion_action_generic'
    | 'child_action_passive'
    | 'pacing_flat'
    | 'location_repetition'
    | 'escalation_missing'
    | 'hook_weak';
  detail: string;
  affectedPages?: number[];
}

export interface PlanValidationResult {
  ok: boolean;
  reason?: string;
  warnings: PlanQualityWarning[];
}

export interface GenerateOutput {
  storyMarkdown: string;
  plan: Plan;
  validationReport: ValidationReport;
  repairAttempts: number;
  fallbackUsed: boolean;
  costUsd: number;
  qaLogPath: string;
  llmCalls: number;
  durationMs: number;
  finalStatus: FinalStoryStatus;
  reviewReason: ReviewReason;
  editorialReport?: EditorialReportRuntime;
  editorialQaCostUsd?: number;
  editorialRepairCostUsd?: number;
  editorialRepairAttempts?: number;
}

export interface AutoInjectionTelemetry {
  page: number;
  line: string;
  context: string;
  reason: string;
}

export interface QASummary {
  finalVerdict: 'PASS' | 'FAIL';
  blockingFindings: ValidationReport['findings'];
  warningFindings: ValidationReport['findings'];
  repairAttempts: number;
  fallbackUsed: boolean;
  costUsd: number;
  durationMs: number;
  llmCalls: number;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  validatorVersion: string;
  generatorVersion: string;
  planQualityWarnings: PlanQualityWarning[];
  timestamp: string;
  /** v0.4.6+ — present only when code injected companion lines into Author output. */
  autoInjections?: AutoInjectionTelemetry[];
}

export interface ManualReview {
  reviewer: string;
  reviewedAt: string;
  scores: {
    childWouldAskAgain: 1 | 2 | 3 | 4 | 5;
    companionIdentity: 1 | 2 | 3 | 4 | 5;
    emotionalTruth: 1 | 2 | 3 | 4 | 5;
    storyFun: 1 | 2 | 3 | 4 | 5;
    visualPotential: 1 | 2 | 3 | 4 | 5;
    hebrewNaturalness: 1 | 2 | 3 | 4 | 5;
  };
  overall: 'PASS' | 'WEAK' | 'FAIL';
  notes: string;
}

export class GeneratorError extends Error {
  constructor(
    public readonly code: 'PLAN_INVALID' | 'VALIDATION_FAILED_AFTER_REPAIR' | 'LLM_ERROR' | 'MISSING_API_KEY',
    message: string
  ) {
    super(message);
    this.name = 'GeneratorError';
  }
}

export const FALLBACK_ENABLED = false;

export interface GeneratorDependencies {
  llm?: import('./llm').StoryGeneratorLLM;
}
