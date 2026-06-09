/**
 * HebrewReadAloudEditor v0 — types.
 */

export type HebrewReadAloudMode =
  | 'diagnose_only'
  | 'apply_safe_fixes'
  | 'apply_high_confidence_fixes';

export type HebrewReadAloudIssueType =
  | 'unnatural_hebrew'
  | 'translated_sounding'
  | 'adult_or_technical_wording'
  | 'unclear_joke'
  | 'too_abstract'
  | 'too_explanatory'
  | 'image_prompt_residue'
  | 'awkward_read_aloud'
  | 'emotion_worded_awkwardly'
  | 'child_voice_not_native'
  | 'companion_voice_not_native'
  | 'broken_or_truncated_text'
  | 'chip_or_placeholder_risk'
  | 'raw_artifact_token_in_prose'
  | 'slash_chip_style';

export type HebrewReadAloudActionMode =
  | 'SAFE_FIX'
  | 'HIGH_CONFIDENCE_EDITORIAL_FIX'
  | 'TASTE_CALL'
  | 'PROTECTED_LINE_SUGGEST_ONLY'
  | 'STRUCTURAL_CONCERN'
  | 'FAIL';

export type HebrewReadAloudSeverity = 'low' | 'medium' | 'high';

export type HebrewReadAloudReplacementRisk = 'low' | 'medium' | 'high';

export interface HebrewReadAloudIssue {
  id: string;
  page: number;
  exactLine: string;
  issueType: HebrewReadAloudIssueType;
  severity: HebrewReadAloudSeverity;
  actionMode: HebrewReadAloudActionMode;
  confidence: number;
  whyItFailsAloud: string;
  suggestedReplacement?: string;
  alternateReplacements?: string[];
  replacementRisk: HebrewReadAloudReplacementRisk;
  preserveMeaningNotes?: string;
  requiresHumanDecision: boolean;
}

export interface HebrewReadAloudAppliedFix {
  page: number;
  before: string;
  after: string;
  actionMode: HebrewReadAloudActionMode;
  confidence: number;
  reason: string;
}

export interface HebrewReadAloudHumanDecision {
  page: number;
  line: string;
  options: string[];
  recommendation: string;
  whyHumanNeeded: string;
}

export interface HebrewReadAloudReadBackValidation {
  storyMdReadBack: boolean;
  validUtf8: boolean;
  completedEnding: boolean;
  allPagesPresent: boolean;
  appliedLinesPresent: boolean;
  badLinesRemoved: boolean;
}

export type HebrewReadAloudVerdict =
  | 'PASS'
  | 'AUTHOR_PASS_HEBREW'
  | 'SAFE_FIXES_APPLIED'
  | 'HIGH_CONFIDENCE_FIXES_APPLIED'
  | 'SUGGESTIONS_NEED_HUMAN'
  | 'STRUCTURAL_CONCERN'
  | 'FAIL';

export interface HebrewReadAloudReport {
  verdict: HebrewReadAloudVerdict;
  mode: HebrewReadAloudMode;
  artifactTokenScan?: import('./artifact-token-scan').RawArtifactTokenScanReport;
  slashChipStyle?: import('./artifact-token-scan').SlashChipStyleReport;
  summary: string;
  issueCounts: {
    low: number;
    medium: number;
    high: number;
    safeFix: number;
    highConfidenceFix: number;
    tasteCall: number;
    protectedSuggestOnly: number;
    structuralConcern: number;
  };
  issues: HebrewReadAloudIssue[];
  appliedFixes: HebrewReadAloudAppliedFix[];
  remainingHumanDecisions: HebrewReadAloudHumanDecision[];
  protectedLinesTouched: Array<{ page: number; line: string; reason: string }>;
  readBackValidation: HebrewReadAloudReadBackValidation;
  chipSafetyPass: boolean;
  chipNormalizePass: boolean;
  storyAliveVerdict?: string;
}

export interface HebrewReadAloudInput {
  storyMarkdownPath: string;
  storyPagesPath?: string;
  pageBeatsPath?: string;
  storySpinePath?: string;
  childAgeMin?: number;
  childAgeMax?: number;
  targetReadAloudAge?: string;
  companionId?: string;
  companionVoiceNotes?: string;
  protectedLines?: string[];
  protectedPages?: number[];
  requiredAnchors?: string[];
  goldenReferenceIds?: string[];
  mode: HebrewReadAloudMode;
  modelId?: string;
  skipLlm?: boolean;
  outputDir?: string;
  /** If omitted, derived from story.md frontmatter or parsed pages. */
  expectedPageCount?: number;
  endingProfile?: 'dini_popcorn' | 'koko_transition' | 'confidence_generic';
}
