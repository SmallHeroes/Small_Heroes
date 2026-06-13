/**
 * Image Provider — AI Image Generation v2
 * Supports DALL-E 3 and Replicate.
 * Style and character anchors stay consistent per story — same prompt strings, every page.
 */
/**
 * PIPELINE STATE NOTE (Phase 1 cleanup, 2026-04-27):
 * Two prompt-assembly paths coexist in this file:
 *  - LEGACY: buildImagePrompt() from lib/promptBuilder.ts — assembles the full
 *    STYLE_CONTRACT block (style optionBlock + rules + character lock + scene + negatives).
 *    ~1000+ words per call. Used when USE_VISUAL_DIRECTOR is unset or "false".
 *  - VISUAL_DIRECTOR: composeVisualDirectorPrompt() from lib/visualDirector.ts —
 *    shorter prompt (~300 words) gated by USE_VISUAL_DIRECTOR="true".
 *
 * In production today, USE_VISUAL_DIRECTOR is "false" by default → the LEGACY
 * path is what real users get. The visual-director path is opt-in only.
 *
 * Future phase will consolidate to one path. For now: do not change defaults.
 * Inspect which path actually ran via the [image_pipeline_path] log line.
 */

import type {
  CharacterSheet,
  StoryConcept,
  HeroVisualLock,
  StyleLock,
  EntityVisualLock,
  PageIntent,
  ShotVisualDirection,
} from './story';
import { buildImagePrompt } from '../../lib/promptBuilder';
import {
  buildFluxCleanChildLine,
  buildFluxCleanCompanionLine,
  buildFluxCleanCompositionLine,
  buildFluxCleanPromptWithinBudget,
  countPromptWords,
  FLUX_CLEAN_ANTI_CROP_NEGATIVES,
  isFluxCleanPromptEnabled,
  normalizeFluxChildDisplayName,
  sanitizeFluxCleanEnglishText,
  shouldIncludeCompanionInFluxCleanPrompt,
} from '../../lib/flux-clean-prompt';
import {
  getNegativeStylePromptBlock,
  getStyleContract,
  normalizeStyleId,
  type StyleId,
} from '@/lib/styles';
import { composeVisualDirectorPrompt, type VisualDirectorInput } from '../../lib/visualDirector';
import type { Companion } from '../../lib/companions';
import { generateGPTImage, generateReplicateImage } from '../../lib/generate-image';
import {
  assembleStyle02BookReferences,
  buildStyle02BookPagePrompt,
  buildStyle02ChildVisualLock,
  buildStyle02CompanionTextLock,
  buildStyle02WardrobeLock,
  classifyStyle02SceneClass,
  resolveCompanionReferencePath,
  isStyle02CloseUpScene,
  resolveStyle02BookPromptProfile,
  resolveStyle02RefBudgetConfig,
  resolveStyle02StyleReferencePaths,
  resolveStyle02SubsetKey,
  shouldInjectBedtimeMedicalTone,
  shouldUseStyle02Phase2Path,
  type Style02SceneClass,
  STYLE_02_AVOIDANCE_NEGATIVE,
  STYLE_02_GPT_MODEL,
  STYLE_02_BEDTIME_MEDICAL_TONE,
} from '../../lib/style02-gptimage';
import {
  assembleGuardedV2PagePrompt,
  resolveGuardedV2SpecForPage,
  type GuardedV2PageDebug,
} from '../../lib/style02-guarded-v2';
import {
  childPresenceAllowsReferencePhoto,
  childPresenceAllowsVisualLock,
  derivePageEntityPresence,
  type PageEntityPresenceContract,
} from '../../lib/image-entity-presence';
import {
  assembleStyle01BookReferences,
  classifyStyle01SceneClass,
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  isStyle01AuditionModeEnabled,
  resolveStyle01AuditionImageQuality,
  resolveStyle01GptModel,
  resolveStyle01StoryLocks,
  resolveStyle01StyleReferencePaths,
  shouldUseStyle01Phase2Path,
  STYLE_01_AVOIDANCE_NEGATIVE,
  type Style01SceneClass,
} from '../../lib/style01-gptimage';
import { assembleStyle01Phase2Prompt } from '../../lib/style01-prompt-assembly';
import { assembleStyle01BookReferencesWithZoneSheets } from '../../lib/story-location-bible/zone-sheets';
import {
  evaluatePageVisualQa,
  resolvePageVisualQaConfig,
} from '../../lib/generation-pipeline/page-visual-qa';
import { resolveCompanionViewIntentForPage, resolveCompanionSheetViewForPage } from '../../lib/generation-pipeline/companion-sheet-page-map';
import { COMPANION_SHEET_VIEW_FILENAME } from '../../lib/generation-pipeline/companion-character-sheet';
import {
  isEmotionalClosingBeat,
  sceneHasRailedBedOrCrib,
  sceneHasStructuredObjects,
} from '../../lib/structured-object-composition';
import type { StoryRecurringEntityDeclaration } from '../../lib/story-bank/recurring-entities';
import {
  assertPipelineStyleBranchMatchesOrder,
  assertShippedBookStyleEngineActive,
  resolveLegacyImageProviderEnv,
} from '../../lib/image-engine-guard';
import type { PageStoryState } from '../../lib/story-page-state';
import { storeImageFromBuffer, storeImageFromProviderUrl } from '../../lib/image-storage';
import type { BookPageTemplate } from '../../lib/bookPageLayout';
import {
  isFluxProOverrideActive,
  replicateModelBaseSlug,
  resolveImageModelMode,
  resolveReplicateImageModel,
} from '../../lib/replicate';
import {
  evaluateImageFaceSignal,
  resolveEffectiveThreshold,
  resolveResemblanceThresholdConfig,
  scoreResemblanceAgainstReference,
  selectResemblanceAnchor,
  type AnchorSelectionResult,
  type ResemblanceThresholdConfig,
  type InputPhotoStrength,
  type ResemblanceCandidate,
} from '../../lib/resemblance-core';
import { createLogger } from '../../lib/logger';
import {
  applyWardrobeToChildStructured,
  buildBookWardrobePromptSection,
  logBookWardrobeLockOnce,
  resolveBookWardrobeLock,
} from '../../lib/book-wardrobe-lock';

import { generateSceneBlocking, isDirectorLayerEnabled, renderSceneBlockingForPrompt, type SceneBlocking } from './director';
import { sanitizeSceneTextForSingleMoment } from '../../lib/image-scene-text';
type PhotoQualityForPrompt = {
  status: 'good' | 'warning' | 'blocked';
  faceCount: number;
  dominantFaceRatio?: number;
  reasonCodes?: string[];
};

// ─── Provider response shapes (private) ──────────────
interface DallEImageResponse {
  data: Array<{ url: string }>;
}

const resemblanceLogger = createLogger({ subsystem: 'resemblance-core', route: 'backend/providers/image' });
let hasLoggedReplicateConfig = false;
let hasLoggedGptImageConfig = false;

function isPresentationPostProcessEnabled(): boolean {
  return (
    process.env.ENABLE_PRESENTATION_POSTPROCESS !== 'false' &&
    process.env.SKIP_ILLUSTRATION_PRESENTATION !== 'true'
  );
}

interface CompositionVariation {
  compositionType:
    | 'medium-shot-interaction'
    | 'wide-shot-environment'
    | 'close-up-emotional'
    | 'over-the-shoulder'
    | 'sitting-interaction'
    | 'lying-resting'
    | 'action-movement';
  cameraDistance: 'close' | 'medium' | 'wide';
  cameraAngle: 'eye-level' | 'slight top' | 'slight side';
  characterPose: 'standing' | 'sitting' | 'lying' | 'moving';
  interactionType: 'talking' | 'holding' | 'pointing' | 'looking' | 'hugging';
  promptDirective: string;
}

export type ShotType =
  | 'close_up'
  | 'medium'
  | 'wide'
  | 'over_shoulder'
  | 'tracking';

export type CompositionMode =
  | 'single_focus'
  | 'duo_interaction'
  | 'environmental'
  | 'foreground_background'
  | 'diagonal_motion';

export type TextZone =
  | 'top_clear'
  | 'bottom_clear'
  | 'left_clear'
  | 'right_clear'
  | 'center_clear';

export type CameraAngle = 'eye_level' | 'low_angle' | 'high_angle' | 'three_quarter';

export type Lighting = 'soft_daylight' | 'warm_golden' | 'moonlit' | 'indoor_warm' | 'dramatic_soft';

export type EmotionalTone = 'calm' | 'hopeful' | 'curious' | 'joyful' | 'brave' | 'tender';

export type MainCharacterVisibility =
  | 'front'
  | 'three_quarter'
  | 'profile'
  | 'back_allowed_only_if_needed';

export type ProtagonistDominance = 'primary' | 'shared' | 'background';

/**
 * How the image is presented on the reader page:
 * - vignette: image "floats" on cream/white reader background. Characters visible, no full-bleed background.
 *   Used for intimate moments, close-ups, single-subject focus, quiet pages.
 * - full_bleed: image fills the entire page edge-to-edge.
 *   Used for atmospheric scenes, wide environments, fantasy world rules, action sequences.
 */
export type PageLayoutStyle = 'vignette' | 'full_bleed';

export interface PageVisualStoryboard {
  pageNumber: number;
  shotType: ShotType;
  compositionMode: CompositionMode;
  textZone: TextZone;
  cameraAngle: CameraAngle;
  lighting: Lighting;
  emotionalTone: EmotionalTone;
  action: string;
  environment: string;
  intent: string;
  mainCharacterVisibility: MainCharacterVisibility;
  protagonistDominance: ProtagonistDominance;
  /** Per-page rendering choice — vignette (on cream) vs full_bleed (edge-to-edge). */
  pageLayoutStyle: PageLayoutStyle;
}

const SHOT_TYPES: ShotType[] = ['close_up', 'medium', 'wide', 'over_shoulder', 'tracking'];
const COMPOSITION_MODES: CompositionMode[] = [
  'single_focus',
  'duo_interaction',
  'environmental',
  'foreground_background',
  'diagonal_motion',
];
const TEXT_ZONES: TextZone[] = ['top_clear', 'bottom_clear', 'left_clear', 'right_clear', 'center_clear'];
const CAMERA_ANGLES: CameraAngle[] = ['eye_level', 'low_angle', 'high_angle', 'three_quarter'];
const LIGHTING_MODES: Lighting[] = ['soft_daylight', 'warm_golden', 'moonlit', 'indoor_warm', 'dramatic_soft'];
const EMOTIONAL_TONES: EmotionalTone[] = ['calm', 'hopeful', 'curious', 'joyful', 'brave', 'tender'];
const MAIN_CHARACTER_VISIBILITY: MainCharacterVisibility[] = [
  'three_quarter',
  'front',
  'profile',
  'back_allowed_only_if_needed',
];
const PROTAGONIST_DOMINANCE: ProtagonistDominance[] = ['primary', 'shared', 'background'];
const PAGE_LAYOUT_STYLES: PageLayoutStyle[] = ['vignette', 'full_bleed'];

/** Force all text zones to top_clear — text is always rendered at the top of the page. */
/**
 * Normalize the storyboard's textZone choice to one of two vertical zones.
 * Storyboard LLM picks per-page based on where the focal subject lives.
 * If storyboard returned something else (left/right/center), we map to vertical fallback.
 * If unspecified, alternate by page index for visual variety (prevents "all top" sameness).
 */
function normalizeToVerticalZone(_raw: unknown, _pageIndex: number): TextZone {
  // POLICY (2026-05-15): Mobile + video text always appears at the BOTTOM.
  // Forcing all body pages to bottom_clear keeps the soft zone in the bottom
  // 25-33% of the image, where the dark Hebrew overlay sits on mobile and
  // where the natural reading eye-flow ends. Top_clear was creating awkward
  // top overlays that competed with the cover/title area.
  // Suppress the unused-param lints — args kept for backwards-compatible signature.
  void _raw;
  void _pageIndex;
  return 'bottom_clear';
}

function isImageGenerationDisabled(): boolean {
  return process.env.DISABLE_IMAGE_GENERATION === 'true';
}

function buildMockImageDataUrl(input: ImageInput): string {
  const safeOrder = (input.orderId ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const safePage = String(input.pageNumber);
  const label = `image generation disabled | order=${safeOrder} | page=${safePage}`;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">',
    '<rect width="1024" height="1536" fill="#f6efe6"/>',
    '<rect x="64" y="64" width="896" height="1408" rx="32" fill="#efe5d8"/>',
    '<text x="512" y="760" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" fill="#7e6956">',
    label,
    '</text>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function buildMockImageResult(input: ImageInput): GeneratedImage {
  return {
    url: buildMockImageDataUrl(input),
    rawUrl: undefined,
    width: 1024,
    height: 1536,
    provider: 'mock-disabled',
    prompt: `[MOCK_IMAGE] DISABLE_IMAGE_GENERATION=true | page=${input.pageNumber}`,
  };
}

// ─── Types ────────────────────────────────────────────
export interface ImageInput {
  pagePrompt: string;            // from story generator (LLM-produced, may already contain styleToken)
  illustrationStyle: string;     // canonical active ids + legacy aliases normalized in lib/styles.ts
  childDescription?: string;     // fallback if no characterSheet
  characterSheet?: CharacterSheet;
  concept?: StoryConcept;        // entity visual description injected when entity is in scene
  heroVisualLock?: HeroVisualLock;
  styleLock?: StyleLock;
  entityVisualLock?: EntityVisualLock;
  pageIntent?: PageIntent;
  compositionRules?: string;
  environmentContinuity?: string;
  referenceImages?: string[];
  anchorCharacters?: Array<{
    characterId: string;
    name: string;
    anchorImageUrl: string;
  }>;
  modelOverride?: string;
  seed?: number;
  orderId?: string;
  pageNumber: number;
  totalPages: number;
  assetType?: 'page' | 'cover';
  pageTemplate?: BookPageTemplate;
  /** Story companion (secondary locked character) — see `lib/companions.ts` */
  companion?: Companion | null;
  photoQuality?: PhotoQualityForPrompt;
  /** When set, adds a short story-direction nudge to illustration prompts. All optional. */
  directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
  /** Wizard challenge category — drives bedtime-medical tone when MEDICAL + bedtime. */
  challengeCategory?: string | null;
  /** True only for the 3 story-direction preview cards. */
  isDirectionPreview?: boolean;
  /**
   * Optional Visual Director (USE_VISUAL_DIRECTOR) — reader-facing line; omit when unknown.
   */
  bookPageText?: string | null;
  /**
   * Optional Visual Director — stage-4 / pipeline illustration string (e.g. same as imagePrompt from story page).
   */
  stage4Prompt?: string | null;
  /** LLM scene only (before locks/render brief); preferred source for GPT Image scene text. */
  rawScenePrompt?: string | null;
  /** Shot-plan structured cues (Phase 5e); reserved for mechanical prompt expansion. */
  visualDirection?: ShotVisualDirection | null;
  /** Cinematic blocking from Director Layer (replaces mechanical Action/Pose/Expression). */
  blocking?: SceneBlocking | null;
  composition?: {
    cameraDistance: 'close' | 'medium' | 'wide';
    cameraAngle: string;
    compositionType: string;
    heroPlacement: string;
    entityPlacement: string;
    topTextAreaPlan: string;
    mainIllustrationZone: string;
  } | null;
  /**
   * Optional Visual Director — display names for characters expected on this page.
   */
  expectedCharacterNames?: string[] | null;
  /**
   * Optional Visual Director — child first name.
   */
  childFirstName?: string | null;
  /** Wizard-provided age, preferred over LLM-inferred age phrasing. */
  childAge?: number | null;
  /** Wizard-provided gender, preferred over LLM-inferred gender phrasing. */
  childGender?: string | null;
  /** Storyboard quiet zone for text overlay — appended as final prompt directive (Replicate path). */
  textZone?: TextZone;
  /** Per-page layout style chosen by storyboard. Drives image size + composition directives. */
  pageLayoutStyle?: 'vignette' | 'full_bleed';
  /** Additional hard negatives to append into GPT prompt mandatory rules. */
  extraNegativeRules?: string[];
  /** Locked visual descriptions for recurring objects — injected when object name appears in scene. */
  propDNA?: Record<string, string>;
  /** Structured child identity lock — labeled fields for GPT Image consistency. */
  childStructured?: {
    face: string;
    hair: string;
    body: string;
    clothing: string;
    signature: string;
  };
  /** Per-order expression mini-sheet anchor used as ref[0] for this page. */
  childExpressionAnchorKind?: string;
  /** Structured companion identity lock — labeled fields for GPT Image consistency. */
  companionStructured?: {
    species: string;
    size: string;
    coloring: string;
    feature: string;
  };
  /** Cover assembly — Style 01 cover scene fields (same locks as interior pages). */
  storyTitle?: string | null;
  coverText?: string | null;
  topicLabel?: string | null;
  coverSceneHint?: string | null;
  /** High-res GPT Image sizing (square) + optional upscale path when PDF add-on purchased. */
  printPdfOptimized?: boolean;
  /** Phase 2 Style 02 — verbatim per-book locks (identical bytes every page). */
  style02ChildVisualLock?: string;
  style02WardrobeLock?: string;
  style02CompanionTextLock?: string;
  supportingCharacters?: Array<{
    name: string;
    description: string;
    relationship?: string;
    physicalDescription?: string;
    clothingDefault?: string;
    signatureDetail?: string;
    ageRange?: string;
  }>;
  /** Per-page storyboard row — required when FLUX_CLEAN_PROMPT=on (Replicate). */
  pageStoryboard?: PageVisualStoryboard;
  /** Per-book cinematography slot (BookShotPlan) — drives Style 01 COMPOSITION block. */
  pageShot?: import('../../lib/book-shot-plan').PageShot | null;
  /** Per-book location continuity — drives BOOK LOCATION CONTINUITY block. */
  locationBible?: import('../../lib/story-location-bible').BookLocationBible | null;
  pageLocationPlan?: import('../../lib/story-location-bible').PageLocationPlan | null;
  /** Pipeline character ids for this page (e.g. child, companion:bolly_armadillo). */
  expectedCharacterIds?: string[];
  /** guarded-v2 recipe id when using production recipe page cards. */
  guardedV2RecipeId?: string | null;
  /** Per-page story state — recurring object/entity locks scoped to page narrative. */
  pageStoryState?: PageStoryState | null;
  /** Story-bank `recurringEntities:` declarations (data-driven locks). */
  storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
  /** Stricter furniture/object composition on visual-QA retry. */
  compositionStrictRetry?: boolean;
  /** Stricter night/dusk lighting block on time_of_day_mismatch retry. */
  timeOfDayStrictRetry?: boolean;
  storyTimeOfDay?: import('../../lib/story-time-of-day').StoryTimeOfDay;
  pageTimeOfDayOverrides?: Partial<Record<number, import('../../lib/story-time-of-day').StoryTimeOfDay>>;
  effectivePageTimeOfDay?: import('../../lib/story-time-of-day').StoryTimeOfDay;
  /** Order-level human family coherence (parents, newborn sibling). */
  familyCoherence?: import('../../lib/family-coherence').FamilyCoherenceBundle | null;
}

export interface Style02PageMeta {
  pageIndex: number;
  sceneText: string;
  sceneClass: Style02SceneClass;
  referenceBreakdown: Record<string, string[]>;
  fallbackUsed: boolean;
  model: string;
  refConfig: string;
  styleSubset: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  /** guarded-v2 manifest debug (when PHASE2_STEP5_PROFILE=guarded-v2). */
  guardedV2?: GuardedV2PageDebug;
  promptProfile?: string;
}

export interface Style01PageMeta {
  pageIndex: number;
  sceneText: string;
  sceneClass: Style01SceneClass;
  entityPresence: PageEntityPresenceContract;
  referenceBreakdown: Record<string, string[]>;
  model: string;
  refConfig: string;
  usage?: Record<string, unknown> | null;
  durationMs?: number;
  storyTimeOfDay?: import('../../lib/story-time-of-day').StoryTimeOfDay;
  effectivePageTimeOfDay?: import('../../lib/story-time-of-day').StoryTimeOfDay;
  pageVisualQa?: {
    passed: boolean;
    reason: string;
    details: string;
    regenAttempts: number;
    timeOfDayOk?: boolean;
    companionSilhouetteOk?: boolean;
  };
  needsHumanReview?: boolean;
  companionViewIntent?: import('../../lib/companion-view-intent').CompanionViewIntent;
}

export interface GeneratedImage {
  url: string;       // final stored URL
  rawUrl?: string;   // provider URL (may expire)
  width: number;
  height: number;
  provider: string;
  prompt: string;
  /** Populated on Style 02 phase-2 book pages (integration manifests). */
  style02Meta?: Style02PageMeta;
  /** Populated on Style 01 phase-2 book pages (integration manifests). */
  style01Meta?: Style01PageMeta;
}

type WarningRetryCandidate = {
  image: GeneratedImage;
  seed: number;
  faceDetectConfidence: number | null;
  faceAreaRatio: number | null;
  faceCount: number | null;
};

function scoreWarningCandidate(candidate: WarningRetryCandidate): number {
  // Neutral defaults when heuristic face signal is missing — avoids tone bias on illustrated output.
  const confidenceScore = candidate.faceDetectConfidence ?? 0.5;
  const areaScore = candidate.faceAreaRatio ?? 0.05;
  return confidenceScore * 10 + areaScore;
}

function selectBestImage(candidates: WarningRetryCandidate[]): WarningRetryCandidate {
  if (candidates.length === 0) {
    throw new Error('selectBestImage requires at least one candidate');
  }
  const sorted = [...candidates].sort((a, b) => scoreWarningCandidate(b) - scoreWarningCandidate(a));
  return sorted[0];
}

const IMAGE_DIRECTION_PREMISE_MAX = 120;

function shortenForImageDirection(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) return `${slice.slice(0, lastSpace).trimEnd()}…`;
  return `${slice.trimEnd()}…`;
}

type ImageDirectionContext = {
  directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
};

/** Compact 1–2 line visual nudge from optional story direction. Empty if no direction context. */
function buildImageStoryDirectionLine(ctx: ImageDirectionContext): string {
  const arch = ctx.directionArchetype;
  const em = (ctx.directionEmotionalLabel ?? '').trim();
  const prRaw = (ctx.directionStoryPremise ?? '').trim();
  const pr = prRaw ? shortenForImageDirection(prRaw, IMAGE_DIRECTION_PREMISE_MAX) : '';

  if (!arch && !em && !pr) return '';

  if (em && pr) {
    return `Story direction: ${em}. Visual mood should support: ${pr}.`;
  }
  if (em && !pr) {
    return `Story direction: ${em}.`;
  }
  if (pr && !em) {
    return `Visual mood should support: ${pr}.`;
  }
  if (arch) {
    return `Maintain tone of a ${arch} story.`;
  }
  return '';
}

export interface CoverImageInput {
  childName: string;
  topicLabel: string;
  storyTitle: string;
  coverText?: string;
  illustrationStyle: string;
  childDescription?: string;
  characterSheet?: CharacterSheet;
  referenceImages?: string[];
  modelOverride?: string;
  orderId?: string;
  directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
  /** Same locks as interior pages when present (from visual bible / story assembly). */
  heroVisualLock?: HeroVisualLock;
  styleLock?: StyleLock;
  entityVisualLock?: EntityVisualLock;
  /** Wizard companion — should appear on cover when present. id+image enable sheet reference resolution (same path as pages). */
  companion?: { id?: string; name: string; visualDescription: string; image?: string };
  /** Wizard challenge category — drives the story-level SCENARIO SETTING LOCK on the cover too. */
  challengeCategory?: string | null;
  /** Structured child identity for cover. */
  childStructured?: { face: string; hair: string; body: string; clothing: string; signature: string };
  /** Structured companion identity for cover. */
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
  childAge?: number | null;
  childGender?: string | null;
  coverSceneHint?: string;
  /** Location continuity for cover (page 0). */
  locationBible?: import('../../lib/story-location-bible').BookLocationBible | null;
  pageLocationPlan?: import('../../lib/story-location-bible').PageLocationPlan | null;
  /** Larger square GPT renders for קובץ מוכן להדפסה. */
  printPdfOptimized?: boolean;
}

export interface CharacterRegistryEntry {
  id: string;
  name: string;
  description: string;
}

export type ResemblanceAuditEntry = {
  orderId?: string;
  pageNumber: number;
  candidateIndex?: number;
  selected: boolean;
  seed?: number;
  model?: string;
  styleId?: string;
  resemblanceScore?: number;
  allCandidateScores?: number[];
  threshold?: number;
  minAcceptableScore?: number;
  softFailBand?: number;
  extremeMargin?: number;
  selectionGap?: number | null;
  resemblanceStatus?: 'pass' | 'soft_fail';
  resemblanceConfidence?: 'high' | 'medium' | 'low';
  sanityDisagreement?: boolean;
  lowDiversity?: boolean;
  extremeMismatch?: boolean;
  reason?: string;
  reasonCodes?: string[];
  faceDetectConfidence?: number;
  faceAreaRatio?: number;
  source: 'anchor_election' | 'page_monitor';
  metadata?: Record<string, unknown>;
};

// ─── No-Text Constraint ───────────────────────────────
// ENFORCED_BY: backend/providers/image.ts:buildPromptParts (passed via globalNegativeConstraints to buildImagePrompt; appended to every Replicate request as negative_prompt).
// Appended to EVERY prompt, regardless of what the LLM produced.
const NO_TEXT_LOCK =
  'no text, no letters, no words, no numbers, no signs, no labels, ' +
  'no captions, no speech bubbles, no book pages with writing, ' +
  'no posters, no banners, no watermarks, pure illustration only';

function extractSceneCore(pagePrompt: string): string {
  if (!pagePrompt) return '';
  return pagePrompt
    .replace(/,?\s*no text[\s\S]*$/i, '')
    .replace(/,?\s*pure illustration[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function translateSceneForImage(input: {
  bookPageText: string;
  pagePrompt: string;
  pageNumber: number;
  totalPages: number;
  childName?: string | null;
  entityName?: string | null;
  entityVisual?: string | null;
  heroVisualLock?: HeroVisualLock | null;
  textZone?: string | null;
  orderId?: string;
  /** Stage 4B / rotation directive — mirrored into user prompt verbatim; do not dilute. */
  compositionDirective?: string | null;
  /** When false, forbid depicting the story companion despite prior scene direction cues. */
  includeCompanionCharacters?: boolean;
  /** Per-page child visibility — gates mandatory-child translator rules. */
  childPresence?: 'present' | 'absent' | 'background' | 'partial';
  /** legacy = full scene translate; clean = scene-led Flux experiment (~50–80 words, no composition in translate). */
  promptMode?: 'legacy' | 'clean';
}): Promise<string> {
  const fallback = extractSceneCore(input.pagePrompt);
  const hebrewText = (input.bookPageText ?? '').trim();
  if (!hebrewText) return fallback;

  console.log(
    `[scene_translate_input] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} hebrewLen=${hebrewText.length} existingSceneLen=${fallback.length} compositionDirectiveLen=${(input.compositionDirective ?? '').length} includeCompanion=${input.includeCompanionCharacters !== false}`
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      `[scene_translate_fallback] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} reason="OPENAI_API_KEY missing"`
    );
    return fallback;
  }

  const textZoneLabel =
    input.textZone === 'top_clear'
      ? 'top'
      : input.textZone === 'bottom_clear'
        ? 'bottom'
        : input.textZone ?? 'bottom';

  const companionAllowed = input.includeCompanionCharacters !== false;
  const childPresence = input.childPresence ?? 'present';
  const childRequiredInScene =
    childPresence === 'present' || childPresence === 'background' || childPresence === 'partial';
  const cleanMode = input.promptMode === 'clean';
  const directive = cleanMode ? '' : (input.compositionDirective ?? '').trim();

  const model = process.env.SCENE_TRANSLATE_MODEL || 'gpt-4o-mini';
  const systemPrompt = [
    "You are an illustration director for a magical children's picture book. Given a page of Hebrew story text and context about the characters, produce a vivid English scene description for an image generation model.",
    '',
    'Rules:',
    '- Describe the VISUAL SCENE with wonder and enchantment — this is a magical storybook, not a documentary',
    '- FOCUS on the single most dramatic/emotional MOMENT in the Hebrew text — not a generic summary',
    '- PRESERVE SPATIAL ZONES from the Hebrew text. If the text says the child is ON the shore and the companion is IN the water, write that EXACTLY — never put both in the same zone. The boundary between zones (water/shore, inside/outside, ground/sky, above/below) is sacred. State it clearly: "Noa sits on the rocky shore, looking down at the starfish in the shallow water below her."',
    '- If the text names a specific object (soccer ball, book, lamp), that EXACT object must appear; do NOT substitute a similar object',
    '- If the text describes emotion or physical state (frozen, scared, laughing), show it in face, posture, gesture, motion — vividly',
    '- Do NOT generalize: generic "kids playing" is WRONG when the Hebrew text describes one specific action',
    childRequiredInScene
      ? cleanMode
        ? '- Lead with what happens in the scene — action, place, emotion, and concrete props from the Hebrew text.'
        : '- Keep the child PROPORTIONALLY SMALL in the description — the SCENE matters as much as the child. Describe the wider environment in concrete detail (rocks, water, plants, sky, props) so the model has plenty to draw besides the character.'
      : '- This page has NO human child in the story beat — describe ONLY the characters and environment named in the Hebrew text and illustration direction. Do NOT add a boy, girl, kid, or human protagonist.',
    '- EMPHASIZE facial expressions and body language',
    '- Include magical visual elements when fitting: glowing particles, sparkles, light, enchanted atmosphere',
    '- Describe the physical environment with rich sensory detail where the story places the action',
    '- Name characters by name (e.g. "Maya"), not generics',
    '- Be concrete and cinematic',
    cleanMode
      ? '- Do NOT include camera shots, framing, or composition instructions — those are supplied separately.'
      : '- PRESERVE the exact camera angle and composition type from the existing illustration direction — if it says wide shot do NOT shrink to medium; if it says low angle do NOT change to eye level',
    cleanMode ? '' : '- PRESERVE the visual hook/opening beat from the existing illustration direction',
    childRequiredInScene
      ? '- NEVER change the principal child appearance: hair color, hair style, clothing, skin tone, and age impression must remain EXACTLY as in the CHARACTER LOCK cues below'
      : '',
    childRequiredInScene
      ? '- The main child protagonist MUST appear clearly as the hero when the Hebrew text includes them'
      : '- Do NOT depict any human child, boy, girl, kid, or human protagonist unless explicitly named in the Hebrew text for this page',
    companionAllowed
      ? '- If you describe the companion creature, keep its anatomy/colors LOCKED as in the cues — same design as other pages.'
      : '- Do NOT depict or invent a companion creature unless the Hebrew text mentions them.',
    companionAllowed
      ? '- DISAMBIGUATION: when the companion is a non-human creature, qualify body-part nouns with the species (e.g. "starfish arm", "bat wing", "fox paw", "owl talon"). NEVER use bare "her arm / his hand / her leg" for the companion — the image model will spawn a second child to satisfy the ambiguous human-sounding limb. Repeat the species term often instead of relying on pronouns.'
      : '',
    companionAllowed
      ? '- The companion has NO human anatomy. Do NOT describe the companion as having "fingers", "palms", "hands", "shoulders", or any other distinctly human body part — use the species\'s real anatomy only.'
      : '',
    '- Do NOT include style instructions or "no text" suffixes',
    '- Output ONLY the scene description text, nothing else',
    cleanMode ? '- 32-40 words' : '- 80-120 words',
  ]
    .filter(Boolean)
    .join('\n');
  const userPrompt = [
    `Page ${input.pageNumber} of ${input.totalPages}.`,
    '',
    ...(directive ? ['COMPOSITION (DO NOT CHANGE):', directive, ''] : []),
    companionAllowed
      ? ''
      : 'COMPANION PRESENCE RULE: The Hebrew story text below does NOT name the companion character by name — do NOT depict the companion creature, mascot, duplicate animals, or extra sidekicks. Only the characters explicitly implied by Hebrew text.',
    childRequiredInScene
      ? ''
      : 'CHILD ABSENCE RULE: The illustration direction below describes a scene WITHOUT the human child — follow it exactly. Do NOT invent a child viewer or human protagonist.',
    '',
    `Hebrew story text for this page: "${hebrewText}"`,
    '',
    'Existing illustration direction (follow this closely — preserve layout and camera):',
    `"${fallback || 'No existing scene direction provided.'}"`,
    '',
    'Characters (visual identity is binding):',
    `- Main character: ${input.childName ?? 'the protagonist'}${
      input.heroVisualLock
        ? ` — LOCK: ${input.heroVisualLock.ageImpression}, hair: ${input.heroVisualLock.hair}, skin: ${input.heroVisualLock.skinTone}, clothing: ${input.heroVisualLock.clothing}.`
        : ''
    }`,
    companionAllowed && input.entityName
      ? `- Companion: ${input.entityName}${input.entityVisual ? ` (${input.entityVisual})` : ''}`
      : '',
    '',
    `Text overlay will be placed at the ${textZoneLabel} of the image.`,
    '',
    cleanMode
      ? 'Rewrite as a vivid English scene moment (32-40 words). Scene and emotion only — no camera or framing. Refer to the child by the EXACT name given in the Characters block above (do NOT invent or substitute names — never use "Michal" or any other placeholder name; if the name contains non-Latin script, use "the child" / "the boy" / "the girl" instead). Refer to the companion creature by its species only (e.g. "the fox", "the bee", "the armadillo") — do NOT invent a name for the companion; never use "Bolly" or any other placeholder. English only — no Hebrew characters. Never use the phrase close-up.'
      : 'Rewrite the illustration direction as a vivid English scene (80-120 words).',
    cleanMode ? '' : 'Keep the camera angle, composition type, and visual hook intact.',
    cleanMode
      ? 'Add emotional and action detail from the Hebrew text.'
      : 'Add emotional and action detail from the Hebrew text without contradicting the composition line above.',
  ]
    .filter(Boolean)
    .join('\n');

  const startedAt = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: cleanMode ? 120 : 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`openai_status_${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated =
      payload.choices?.[0]?.message?.content?.replace(/\s+/g, ' ').trim() ?? '';
    if (!translated) {
      throw new Error('empty_translation');
    }
    const words = translated.split(/\s+/).filter(Boolean).length;
    const latency = Date.now() - startedAt;
    console.log(
      `[scene_translate] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} words=${words} model=${model} latency=${latency}ms`
    );
    console.log(
      `[scene_translate_text] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} text="${translated.replace(/"/g, "'")}"`
    );
    return translated;
  } catch (error) {
    const latency = Date.now() - startedAt;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[scene_translate_fallback] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} reason="${reason}" latency=${latency}ms`
    );
    return fallback;
  }
}

function isVisualDirectorEnabledForInput(input: ImageInput): boolean {
  if (process.env.USE_VISUAL_DIRECTOR !== 'true') return false;
  if (input.isDirectionPreview) return false;
  if (input.assetType === 'cover') return false;
  return true;
}

function buildVisualDirectorModelInput(input: ImageInput): VisualDirectorInput {
  const book = (input.bookPageText ?? '').trim();
  const stage4 = (input.stage4Prompt ?? '').trim();
  const pageText =
    book ||
    (input.pagePrompt ? extractSceneCore(input.pagePrompt).slice(0, 500) : '') ||
    '';
  const out: VisualDirectorInput = {
    selectedStyle: input.illustrationStyle,
    pageNumber: input.pageNumber,
    totalPages: input.totalPages,
    pageText,
  };
  if (stage4) {
    out.stage4Prompt = stage4;
  }
  const stage4Head = stage4.replace(/\s+/g, ' ').slice(0, 80);
  console.debug(
    `[visual_director_inputs] page=${input.pageNumber} stage4PromptLen=${stage4.length} stage4PromptHead=${stage4Head}`
  );
  if (input.pageIntent !== undefined) {
    out.pageIntent = input.pageIntent;
  }
  if (input.compositionRules) {
    out.composition = input.compositionRules;
  }
  const expected = input.expectedCharacterNames?.map((n) => n.trim()).filter(Boolean) ?? [];
  if (expected.length > 0) {
    out.expectedCharacters = expected;
  }
  const childName = (input.childFirstName ?? input.characterSheet?.mainCharacter.name ?? '').trim();
  if (childName) {
    out.childName = childName;
  }
  const companionAllowed = companionReferencedInStoryText(input);
  if (input.companion?.name && companionAllowed) {
    out.companionName = input.companion.name;
  }
  if (input.companion?.visualDescription && companionAllowed) {
    out.companionDescription = input.companion.visualDescription;
  }
  if (input.directionArchetype) {
    out.directionArchetype = input.directionArchetype;
  }
  if (input.photoQuality) {
    out.photoQuality = JSON.stringify({
      status: input.photoQuality.status,
      faceCount: input.photoQuality.faceCount,
    });
  }
  return out;
}

const COMPOSITION_ROTATION: CompositionVariation[] = [
  {
    compositionType: 'medium-shot-interaction',
    cameraDistance: 'medium',
    cameraAngle: 'eye-level',
    characterPose: 'standing',
    interactionType: 'talking',
    promptDirective: 'medium shot, two characters interacting, eye-level view',
  },
  {
    compositionType: 'wide-shot-environment',
    cameraDistance: 'wide',
    cameraAngle: 'slight side',
    characterPose: 'standing',
    interactionType: 'looking',
    promptDirective: 'wide shot showing environment, characters smaller in frame',
  },
  {
    compositionType: 'close-up-emotional',
    cameraDistance: 'close',
    cameraAngle: 'eye-level',
    characterPose: 'standing',
    interactionType: 'hugging',
    promptDirective: 'close-up on faces, emotional interaction',
  },
  {
    compositionType: 'over-the-shoulder',
    cameraDistance: 'medium',
    cameraAngle: 'slight side',
    characterPose: 'standing',
    interactionType: 'pointing',
    promptDirective: 'over-the-shoulder view focusing on interaction',
  },
  {
    compositionType: 'sitting-interaction',
    cameraDistance: 'medium',
    cameraAngle: 'eye-level',
    characterPose: 'sitting',
    interactionType: 'holding',
    promptDirective: 'medium shot, sitting interaction with clear hand action',
  },
  {
    compositionType: 'lying-resting',
    cameraDistance: 'medium',
    cameraAngle: 'slight top',
    characterPose: 'lying',
    interactionType: 'looking',
    promptDirective: 'resting pose, slight top view, calm readable composition',
  },
  {
    compositionType: 'action-movement',
    cameraDistance: 'wide',
    cameraAngle: 'slight side',
    characterPose: 'moving',
    interactionType: 'pointing',
    promptDirective: 'action moment with movement, clear pose silhouette, readable motion',
  },
];

function getCompositionVariation(pageNumber: number): CompositionVariation {
  const idx = Math.max(0, (pageNumber - 1) % COMPOSITION_ROTATION.length);
  return COMPOSITION_ROTATION[idx];
}

function rotateAvoidingRepeat<T extends string>(prev: T | null, value: T, all: T[], indexHint: number): T {
  if (value !== prev) return value;
  const fallback = all[indexHint % all.length];
  if (fallback !== prev) return fallback;
  return all[(indexHint + 1) % all.length];
}

function normalizeStoryboardRows(
  pages: Array<{ pageNumber: number; bookPageText?: string; imagePrompt: string }>,
  rows: unknown
): PageVisualStoryboard[] {
  const normalized: PageVisualStoryboard[] = [];
  let prevShot: ShotType | null = null;
  let prevComposition: CompositionMode | null = null;
  const inputRows = Array.isArray(rows) ? rows : [];
  const byPage = new Map<number, Record<string, unknown>>();
  for (const raw of inputRows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const pageNumber = Number(row.pageNumber);
    if (!Number.isFinite(pageNumber)) continue;
    byPage.set(pageNumber, row);
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const row = byPage.get(page.pageNumber) ?? {};
    const shot: ShotType = rotateAvoidingRepeat(
      prevShot,
      (typeof row.shotType === 'string' && SHOT_TYPES.includes(row.shotType as ShotType)
        ? (row.shotType as ShotType)
        : SHOT_TYPES[i % SHOT_TYPES.length]),
      SHOT_TYPES,
      i
    );
    const composition: CompositionMode = rotateAvoidingRepeat(
      prevComposition,
      (typeof row.compositionMode === 'string' && COMPOSITION_MODES.includes(row.compositionMode as CompositionMode)
        ? (row.compositionMode as CompositionMode)
        : COMPOSITION_MODES[i % COMPOSITION_MODES.length]),
      COMPOSITION_MODES,
      i + 1
    );
    prevShot = shot;
    prevComposition = composition;
    normalized.push({
      pageNumber: page.pageNumber,
      shotType: shot,
      compositionMode: composition,
      textZone: normalizeToVerticalZone(row.textZone, i),
      cameraAngle:
        typeof row.cameraAngle === 'string' && CAMERA_ANGLES.includes(row.cameraAngle as CameraAngle)
          ? (row.cameraAngle as CameraAngle)
          : CAMERA_ANGLES[i % CAMERA_ANGLES.length],
      lighting:
        typeof row.lighting === 'string' && LIGHTING_MODES.includes(row.lighting as Lighting)
          ? (row.lighting as Lighting)
          : LIGHTING_MODES[i % LIGHTING_MODES.length],
      emotionalTone:
        typeof row.emotionalTone === 'string' && EMOTIONAL_TONES.includes(row.emotionalTone as EmotionalTone)
          ? (row.emotionalTone as EmotionalTone)
          : EMOTIONAL_TONES[i % EMOTIONAL_TONES.length],
      action:
        typeof row.action === 'string' && row.action.trim().length > 0
          ? row.action.trim()
          : 'child performing a meaningful story action',
      environment:
        typeof row.environment === 'string' && row.environment.trim().length > 0
          ? row.environment.trim()
          : 'a coherent environment with depth and story context',
      intent:
        typeof row.intent === 'string' && row.intent.trim().length > 0
          ? row.intent.trim()
          : ((page.bookPageText ?? page.imagePrompt).trim().slice(0, 220) || 'story progression moment'),
      // Rotate fallback values across pages so we never produce 15 identical
      // 'three_quarter + primary' compositions when the storyboard LLM fails.
      // Cycle length 4 for visibility (avoid 'back' overuse — only every 6th page).
      mainCharacterVisibility:
        typeof row.mainCharacterVisibility === 'string' &&
        MAIN_CHARACTER_VISIBILITY.includes(row.mainCharacterVisibility as MainCharacterVisibility)
          ? (row.mainCharacterVisibility as MainCharacterVisibility)
          : (i % 6 === 5
              ? 'back_allowed_only_if_needed'
              : (['front', 'profile', 'three_quarter', 'front', 'profile'] as MainCharacterVisibility[])[i % 5]),
      // Dominance rotation: page 1 = 'shared' so single-page-test renders the
      // child + companion duo, not a lone-child portrait.
      protagonistDominance:
        typeof row.protagonistDominance === 'string' &&
        PROTAGONIST_DOMINANCE.includes(row.protagonistDominance as ProtagonistDominance)
          ? (row.protagonistDominance as ProtagonistDominance)
          : (['shared', 'primary', 'background', 'shared', 'primary', 'shared', 'background'] as ProtagonistDominance[])[i % 7],
      pageLayoutStyle:
        typeof row.pageLayoutStyle === 'string' &&
        PAGE_LAYOUT_STYLES.includes(row.pageLayoutStyle as PageLayoutStyle)
          ? (row.pageLayoutStyle as PageLayoutStyle)
          // Heuristic fallback: close-up/intimate shots → vignette, wide/environmental → full_bleed
          : shot === 'close_up' || composition === 'single_focus'
            ? 'vignette'
            : 'full_bleed',
    });
  }

  return normalized;
}

function extractJsonPayload(raw: string): unknown {
  const cleaned = raw.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!match) throw new Error('Invalid storyboard JSON');
    return JSON.parse(match[1]);
  }
}

/** Storyboard LLM plan — exported for experiment / QA scripts. */
export async function generatePageVisualStoryboard(book: {
  fullStory: string;
  pages: Array<{ pageNumber: number; bookPageText?: string; imagePrompt: string; pageIntent?: PageIntent }>;
  childProfile: string;
  selectedStyle: string;
}): Promise<PageVisualStoryboard[]> {
  return generateStoryboard(book);
}

async function generateStoryboard(book: {
  fullStory: string;
  pages: Array<{ pageNumber: number; bookPageText?: string; imagePrompt: string; pageIntent?: PageIntent }>;
  childProfile: string;
  selectedStyle: string;
}): Promise<PageVisualStoryboard[]> {
  const fallback = normalizeStoryboardRows(book.pages, []);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const system = [
    'You are a CINEMATIC art director for a Hebrew children\'s picture book. You build the storyboard like a film director: each page is a SHOT, and the shots TOGETHER tell the story.',
    'Return only valid JSON: { "pages": PageVisualStoryboard[] }.',
    'Create one storyboard row per page number provided.',
    '',
    '── NARRATIVE-BEAT-TO-SHOT MAPPING (CRITICAL) ──',
    'You receive each page with a "beat" tag. Each beat has a strongly-preferred shotType. Follow this mapping unless the page text overrides it:',
    '  OPENING (first 1-2 pages):           shotType=wide. The reader needs to SEE the world before the character. Wide establishing shot, child small inside the environment.',
    '  INTRODUCING_COMPANION (first companion appearance): shotType=medium, compositionMode=duo_interaction OR over_the_shoulder. The reader should see BOTH the child reacting AND the companion clearly. Often a "child looks at companion who has just appeared" OTS works beautifully.',
    '  RISING_ACTION / DISCOVERY:           shotType=wide OR medium with action_motion. The child or companion is MOVING through the world.',
    '  HEART_LINE / EMOTIONAL_BEAT:         shotType=close_up, compositionMode=intimate_close. Reserved for the 1-2 most emotional pages — never more.',
    '  QUIET_PAGE:                          shotType=medium, low-activity scene. The child paused, listening, breathing.',
    '  RESOLUTION (last 2 pages):           shotType=medium or wide. NEVER end on close-up. The reader exits the world with a panoramic view.',
    '',
    '── PAGE-INTENT (when provided) OVERRIDES BEAT ──',
    'If the page comes with a pageIntent.type, use this exact mapping:',
    '  action_page / world_scene / magical_event → wide (always).',
    '  transition_page / interaction_page → medium.',
    '  emotional_closeup / closeup → close_up.',
    '  symbolic_page / object_symbolic / object_focus / minimal_vignette → medium with shifted focus (companion or object dominant, child secondary).',
    '  character_scene → medium (default).',
    'If pageIntent.camera is provided, treat it as a hard hint — match shotType to it.',
    '',
    '── HARD RULES (still apply) ──',
    '- do not repeat shotType consecutively (alternate close→medium→wide rhythm)',
    '- do not repeat compositionMode consecutively',
    '- each page must include action, environment, and emotion',
    '- each page must include mainCharacterVisibility and protagonistDominance',
    '- each page must include textZone AND pageLayoutStyle (vary across pages — DO NOT pick the same value for every page)',
    '- VARY mainCharacterVisibility across pages — NEVER pick three_quarter for every page. Mix: front, three_quarter, side, three_quarter_back, far_back (only when natural). Aim for ~3 different values across the book.',
    '- use back_allowed_only_if_needed only when absolutely necessary',
    '- VARY protagonistDominance across pages — NEVER pick primary for every page. Mix: primary (child dominant), shared (child + companion equal), secondary (companion or environment dominant, child small in frame), background (child small inside a wide scene). At least 40% of pages should be shared, secondary, or background so the reader SEES THE WORLD, not just the protagonist.',
    '- SHOT DISTRIBUTION: at most 25% of pages may be close_up. AT LEAST 70% must be medium or wide.',
    '- ACTION pages (motion, discovery, environment, transformation) → ALWAYS wide.',
    '- COMPOSITION VARIETY (CRITICAL): across the whole book, ensure at least 4 of these composition types appear — wide_establishing (child small inside big environment), duo_interaction (child + companion side by side), companion_dominant (companion in foreground, child smaller), action_motion (child or companion moving), intimate_close (face/hands close-up at emotional beats only), over_the_shoulder (POV from one character toward another). NEVER 15 identical centered standing duo poses.',
    '- Quiet/intimate pages → may be close_up.',
  ].join('\n');

  const user = [
    `Selected style: ${book.selectedStyle}`,
    `Child profile: ${book.childProfile}`,
    `Full story:\n${book.fullStory.slice(0, 7000)}`,
    'Pages (each tagged with narrative BEAT and pageIntent — use these to drive shotType):',
    ...book.pages.map((p) => {
      const total = book.pages.length;
      // Narrative beat based on position
      let beat: string;
      if (p.pageNumber === 1) beat = 'OPENING';
      else if (p.pageNumber === 2) beat = 'OPENING_OR_INTRODUCING_COMPANION';
      else if (p.pageNumber >= total - 1) beat = 'RESOLUTION';
      else if (p.pageNumber === total - 2) beat = 'RESOLUTION_OR_HEART_LINE';
      else if (p.pageNumber >= Math.floor(total * 0.55) && p.pageNumber <= Math.floor(total * 0.75)) beat = 'HEART_LINE_CANDIDATE';
      else beat = 'RISING_ACTION';
      const intent = p.pageIntent
        ? ` | intent.type=${p.pageIntent.type} intent.camera=${p.pageIntent.camera} intent.focus=${p.pageIntent.focus}`
        : '';
      return `- page ${p.pageNumber} [beat=${beat}${intent}]: ${(p.bookPageText ?? p.imagePrompt).slice(0, 500)}`;
    }),
    '',
    'Allowed enum values:',
    `shotType: ${SHOT_TYPES.join(', ')}`,
    `compositionMode: ${COMPOSITION_MODES.join(', ')}`,
    `cameraAngle: ${CAMERA_ANGLES.join(', ')}`,
    `lighting: ${LIGHTING_MODES.join(', ')}`,
    `emotionalTone: ${EMOTIONAL_TONES.join(', ')}`,
    `mainCharacterVisibility: ${MAIN_CHARACTER_VISIBILITY.join(', ')}`,
    `protagonistDominance: ${PROTAGONIST_DOMINANCE.join(', ')}`,
    '',
    'textZone — choose per page (top_clear OR bottom_clear only — NEVER left/right/center):',
    '  - top_clear: pick when the main characters/action live in the LOWER part of the frame.',
    '    Examples: child looking up at something, ground-level scenes, sitting on floor.',
    '  - bottom_clear: pick when the main characters/action live in the UPPER part of the frame.',
    '    Examples: flying creatures, sky scenes, characters looking down, characters peeking from above.',
    '  Rule: distribute roughly 50/50 across the book. NEVER pick top_clear for every page.',
    '',
    'pageLayoutStyle — choose per page (vignette OR full_bleed). Both produce fully-illustrated edge-to-edge scenes in vivid colors:',
    '  - vignette: INTIMATE close-medium framing — character occupies 45-60% of frame, but environment is still fully rendered around them.',
    '    Pick for: emotional beats, quiet pages, intimate moments where the character carries the page.',
    '  - full_bleed: WIDE cinematic framing — character occupies 30-45% of frame, environment is prominent.',
    '    Pick for: world-establishing shots, atmospheric scenes, group/action shots, fantasy world rules.',
    '  Rule: aim for roughly 40% vignette + 60% full_bleed across the book. Quiet pages should be vignette.',
    '  IMPORTANT: vignette is NOT "character floating on cream" — it is just a tighter scene with fewer environmental elements but still fully colored and detailed.',
  ].join('\n');

  const model = process.env.STORYBOARD_MODEL || 'gpt-4o-mini';
  const useResponsesAPI = model.startsWith('gpt-5.') || model.includes('-pro');
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [1500, 3500];

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[storyboard] attempt=${attempt}/${MAX_ATTEMPTS} model=${model} mode=${useResponsesAPI ? 'responses' : 'chat'}`);
      let content = '';
      if (useResponsesAPI) {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            max_output_tokens: 6000,
            input: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            text: { format: { type: 'json_object' } },
          }),
        });
        if (!res.ok) throw new Error(`Responses ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        content = data.output_text ??
          data.output?.find((it: { type?: string; content?: Array<{ type?: string; text?: string }> }) => it.type === 'message')
            ?.content?.find((c: { type?: string; text?: string }) => c.type === 'output_text')?.text ?? '';
      } else {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!res.ok) throw new Error(`Chat ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const payload = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        content = payload.choices?.[0]?.message?.content ?? '';
      }

      if (!content) throw new Error('empty response from storyboard model');
      const parsed = extractJsonPayload(content) as { pages?: unknown };
      if (!parsed?.pages || !Array.isArray(parsed.pages)) {
        throw new Error('storyboard response had no "pages" array');
      }
      console.log(`[storyboard] SUCCESS attempt=${attempt} pages=${parsed.pages.length}`);
      return normalizeStoryboardRows(book.pages, parsed.pages);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[storyboard] attempt=${attempt} FAILED: ${lastError}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 3000));
      }
    }
  }
  console.error(
    `[storyboard] *** ALL ${MAX_ATTEMPTS} ATTEMPTS FAILED *** falling back to deterministic ROTATING defaults. ` +
    `LastError=${lastError}. Every page will get an algorithmically-varied composition, ` +
    `but the LLM's emotional/scene insight is LOST. THIS IS WHY ALL PAGES MAY LOOK SIMILAR.`
  );
  return fallback;
}

function normalizedOverlayTextLength(raw: string | null | undefined): number {
  return (raw ?? '').replace(/\s+/g, ' ').trim().length;
}

/**
 * Hard prompt block: reserve a physical frame zone for reader text overlay.
 * Zone names are visual (screen top/bottom/left/right), not logical/RTL — matches reader CSS.
 */
function textZoneDirective(textZone?: TextZone, textLength?: number): string {
  if (!textZone) return '';
  const zoneLabelMap: Record<TextZone, string> = {
    top_clear: 'upper portion',
    bottom_clear: 'lower portion',
    left_clear: 'left portion',
    right_clear: 'right portion',
    center_clear: 'central portion',
  };
  const zoneLabel = zoneLabelMap[textZone] ?? textZone;
  const isLong = (textLength ?? 0) > 120;
  const sizeLabelByZone: Record<TextZone, { short: string; long: string }> = {
    top_clear: {
      short: 'at least the upper 25% of the frame',
      long: 'at least the upper 40% of the frame',
    },
    bottom_clear: {
      short: 'at least the lower 25% of the frame',
      long: 'at least the lower 40% of the frame',
    },
    left_clear: {
      short: 'at least the left 25% of the frame',
      long: 'at least the left 40% of the frame',
    },
    right_clear: {
      short: 'at least the right 25% of the frame',
      long: 'at least the right 40% of the frame',
    },
    center_clear: {
      short: 'a central rectangle covering roughly 30% of the frame',
      long: 'a central rectangle covering roughly 50% of the frame',
    },
  };
  const sizeLabel = sizeLabelByZone[textZone][isLong ? 'long' : 'short'];
  return [
    `CRITICAL TEXT OVERLAY ZONE: The ${zoneLabel} must be visually quiet for text overlay.`,
    `This zone must cover ${sizeLabel}, with low color saturation and minimal detail.`,
    `Acceptable content for the zone: open sky, plain wall, soft fog, water surface, snow, grass, or atmospheric haze.`,
    `Do NOT place faces, hands, intricate patterns, written text, complex lighting, or focal subjects in this zone.`,
    `The rest of the frame can be richly detailed, but this zone must remain calm and uncluttered.`,
  ].join(' ');
}

function storyboardTextZoneInstruction(textZone: TextZone): string {
  switch (textZone) {
    case 'top_clear':
      return 'Reserve the top area as clean negative space. Keep that zone free of characters and dense objects.';
    case 'bottom_clear':
      return 'Reserve the bottom area as clean negative space. Keep that zone free of characters and dense objects.';
    case 'left_clear':
      return 'Reserve the left side as clean negative space. Keep that zone free of characters and dense objects.';
    case 'right_clear':
      return 'Reserve the right side as clean negative space. Keep that zone free of characters and dense objects.';
    case 'center_clear':
    default:
      return 'Reserve the center as clean negative space. Keep that zone free of characters and dense objects.';
  }
}

function storyboardShotInstruction(shotType: ShotType): string {
  switch (shotType) {
    case 'wide':
      return 'Use a wide shot. Show full room and full-body subject with visible floor, walls, and depth.';
    case 'close_up':
      return 'Use a close shot. Face and emotion must dominate the frame with readable expression.';
    case 'medium':
      return 'Use a medium shot. Show torso-level interaction with clear hand and body action.';
    case 'over_shoulder':
      return 'Use over-shoulder framing. Keep shoulder foreground and target subject clearly visible.';
    case 'tracking':
    default:
      return 'Use tracking-like framing. Show directional movement and clear motion path across the scene.';
  }
}

function storyboardCompositionInstruction(mode: CompositionMode): string {
  switch (mode) {
    case 'environmental':
      return 'Environment must dominate the frame. Characters are present but secondary to place context.';
    case 'duo_interaction':
      return 'Show two characters interacting clearly with readable eye-lines and gesture exchange.';
    case 'foreground_background':
      return 'Enforce depth layering: clear foreground element, active midground subject, readable background context.';
    case 'diagonal_motion':
      return 'Build composition on a strong diagonal flow that guides the eye through action.';
    case 'single_focus':
    default:
      return 'Keep one primary subject as the visual focus with no competing focal point.';
  }
}

function storyboardCameraInstruction(camera: CameraAngle): string {
  switch (camera) {
    case 'low_angle':
      return 'Camera angle is low-angle and must be visually noticeable.';
    case 'high_angle':
      return 'Camera angle is high-angle and must be visually noticeable.';
    case 'three_quarter':
      return 'Camera angle is three-quarter view with clear depth and directional perspective.';
    case 'eye_level':
    default:
      return 'Camera angle is eye-level and should feel natural and grounded.';
  }
}

function storyboardLightingInstruction(lighting: Lighting): string {
  switch (lighting) {
    case 'warm_golden':
      return 'Use warm golden lighting with soft highlights.';
    case 'moonlit':
      return 'Use moonlit night lighting with cool tones and readable forms.';
    case 'indoor_warm':
      return 'Use warm indoor practical lighting from visible room sources.';
    case 'dramatic_soft':
      return 'Use soft but directional dramatic lighting to support action clarity.';
    case 'soft_daylight':
    default:
      return 'Use soft daylight with gentle contrast and clear forms.';
  }
}

function storyboardEmotionInstruction(tone: EmotionalTone): string {
  switch (tone) {
    case 'brave':
      return 'Expression and body language must communicate bravery.';
    case 'joyful':
      return 'Expression and body language must communicate joy.';
    case 'hopeful':
      return 'Expression and body language must communicate hope.';
    case 'curious':
      return 'Expression and body language must communicate curiosity.';
    case 'tender':
      return 'Expression and body language must communicate tenderness.';
    case 'calm':
    default:
      return 'Expression and body language must communicate calm confidence.';
  }
}

function storyboardVisibilityInstruction(visibility: MainCharacterVisibility): string {
  // Push toward ACTION + SCENE, not a static identifiable-portrait pose.
  switch (visibility) {
    case 'front':
      return 'Camera view: front 3/4 angle showing the child engaged with the scene — walking, reaching, looking at the companion or environment. NOT a centered standing portrait facing the camera. Show the child IN ACTION, not posing.';
    case 'profile':
      return 'Camera view: side profile showing the child moving across or interacting with the environment. The body is in motion or engaged — NOT a static profile portrait.';
    case 'back_allowed_only_if_needed':
      return 'Camera view: child is shown from behind looking into the scene/environment. Allowed only when the story moment is about discovery or facing forward into the world.';
    case 'three_quarter':
    default:
      return 'Camera view: 3/4 angle of the child mid-action inside the scene. The child is doing something specific from the page (walking, reaching, kneeling, looking up/down). NEVER a static standing pose facing the camera. The pose must show story momentum, not a character-reference shot.';
  }
}

function storyboardDominanceInstruction(dominance: ProtagonistDominance): string {
  switch (dominance) {
    case 'shared':
      return 'Frame composition: SHARED — the child and the companion share the frame roughly equally. Both must be clearly visible AT THE SAME SIZE. The child occupies 30-40% of frame width, the companion another 25-35%. They interact, look at each other, or face the same thing.';
    case 'background':
      return 'Frame composition: ENVIRONMENT-LED — pull the camera back. The child is SMALL inside the frame (15-25% of frame height), nested inside a wide-open environment that fills the rest of the canvas. Show the world the story takes place in. NOT a portrait.';
    case 'primary':
    default:
      return 'Frame composition: PROTAGONIST-LED — the child is the visual anchor, but NOT a centered portrait. Show them mid-action inside the scene; the child occupies 35-50% of the frame, with environment + props clearly visible around them. They are doing something specific from the page text.';
  }
}

function inferGenderFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('girl') || t.includes('female') || t.includes('ילדה')) return 'girl';
  if (t.includes('boy') || t.includes('male') || t.includes('ילד')) return 'boy';
  return 'child';
}

function extractVisualPhrase(text: string, fallback: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 180);
}

function isVagueVisualPhrase(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.includes('consistent across pages') ||
    lowered.includes('age-appropriate') ||
    lowered.includes('natural')
  );
}

function buildCompactProtagonistLock(input: {
  childName?: string | null;
  childDescription?: string;
  heroVisualLock?: HeroVisualLock;
  orderId?: string;
  pageNumber?: number;
  childAge?: number | null;
  childGender?: string | null;
  directionArchetype?: 'bedtime' | 'adventure' | 'fantasy' | null;
}): string {
  const source = input.heroVisualLock;
  const wardrobeLock = resolveBookWardrobeLock(input.directionArchetype);
  const ageFromWizard = input.childAge ? `${input.childAge}-year-old` : null;
  const ageFromLock = extractVisualPhrase(source?.ageImpression ?? '', 'young child');
  const age = ageFromWizard ?? (isVagueVisualPhrase(ageFromLock) ? 'young' : ageFromLock);
  const genderFromWizard =
    input.childGender === 'girl' ? 'girl' : input.childGender === 'boy' ? 'boy' : null;
  const genderFromLock = inferGenderFromText(input.childDescription ?? source?.ageImpression ?? '');
  const gender = genderFromWizard ?? genderFromLock;
  const hairRaw = extractVisualPhrase(source?.hair ?? '', 'natural age-appropriate hair, consistent across pages');
  const skinToneRaw = extractVisualPhrase(
    source?.skinTone ?? '',
    'natural skin tone, consistent across pages'
  );
  const faceRaw = extractVisualPhrase(
    source?.faceShape ?? '',
    'natural child facial features, consistent across pages'
  );
  const clothingRaw = extractVisualPhrase(
    source?.clothing ?? '',
    'clothing should remain consistent across pages'
  );
  const eyesRaw = extractVisualPhrase(
    source?.eyes ?? '',
    'natural expressive eyes, consistent shape and color'
  );
  const hair = wardrobeLock
    ? wardrobeLock.hairstyle
    : isVagueVisualPhrase(hairRaw)
      ? ''
      : hairRaw;
  const skinTone = isVagueVisualPhrase(skinToneRaw) ? '' : skinToneRaw;
  const face = isVagueVisualPhrase(faceRaw) ? '' : faceRaw;
  const clothing = wardrobeLock
    ? wardrobeLock.outfit
    : isVagueVisualPhrase(clothingRaw)
      ? ''
      : clothingRaw;
  const eyes = isVagueVisualPhrase(eyesRaw) ? '' : eyesRaw;
  if ((input.pageNumber ?? 0) > 0) {
    console.log(
      `[character_lock_resolved] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber ?? 0} hasAge=${Boolean(source?.ageImpression)} hasHair=${Boolean(source?.hair)} hasSkin=${Boolean(source?.skinTone)} hasFace=${Boolean(source?.faceShape)} hasEyes=${Boolean(source?.eyes)} hasClothing=${Boolean(source?.clothing)}`
    );
  }
  const childLabel = (input.childName ?? 'The protagonist').trim() || 'The protagonist';
  const visualParts = [
    hair ? `with ${hair}` : '',
    skinTone,
    face,
    eyes,
    clothing ? `wearing ${clothing}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const compact = `${childLabel}, a ${age} ${gender}${visualParts ? ` ${visualParts}` : ''}`.replace(/\s+/g, ' ').trim();
  // EMOTION BIAS: 'match the scene' caused every page to inherit the story's
  // emotional arc — sad stories produced sad faces on every page. Reframed to
  // emphasize warmth, curiosity, and gentle expressiveness UNLESS the page text
  // literally describes fear/sadness (sanitizeEmotion handles those cases).
  const withExpression = `${compact}. Warm, expressive face — natural curiosity, gentle wonder, soft smile or thoughtful calm. The default mood is hopeful and inviting. Only show fear/sadness when the page text explicitly describes it. NEVER a flat sad gaze on every page.`;
  console.log(
    `[protagonist_lock_compact] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber ?? 0} lock="${withExpression}"`
  );
  return withExpression;
}

/**
 * Wizard companion visuals: include on a page image only when Hebrew text names them, OR when there is no
 * page-specific text (covers / fallback) so the cover still shows the companion consistently.
 */
/**
 * Sanitize emotion from visualDirection — enforce warm/happy default for children's book.
 * Only allow negative emotions if the page text explicitly contains matching Hebrew keywords.
 */
function sanitizeEmotion(rawEmotion: string, bookPageText?: string): string {
  const text = (bookPageText ?? '').trim().toLowerCase();
  const raw = rawEmotion.toLowerCase().trim();

  // Negative emotion keywords — only pass through if text justifies them
  const negativePatterns = [
    { emotions: ['scared', 'afraid', 'frightened', 'terrified', 'fearful', 'anxious'],
      softened: 'alert and attentive',
      textTriggers: ['פחד', 'מפחד', 'מפוחד', 'נבהל', 'חשש', 'פחדה', 'מפוחדת'] },
    { emotions: ['sad', 'crying', 'tearful', 'upset', 'distressed', 'melancholy'],
      softened: 'thoughtful and quiet',
      textTriggers: ['עצוב', 'בכה', 'בכתה', 'דמעה', 'עצובה', 'נעצב'] },
    { emotions: ['worried', 'nervous'],
      softened: 'curious but cautious',
      textTriggers: ['דאג', 'דאגה', 'חשש', 'לחש'] },
    { emotions: ['angry', 'furious', 'frustrated', 'annoyed'],
      softened: 'determined',
      textTriggers: ['כעס', 'כועס', 'כועסת', 'זעם', 'עצבני'] },
  ];

  for (const { emotions, softened, textTriggers } of negativePatterns) {
    if (emotions.some(e => raw.includes(e))) {
      // Check if the Hebrew text actually justifies this emotion
      if (text && textTriggers.some(t => text.includes(t))) {
        return rawEmotion; // Text supports it — keep original
      }
      // Text doesn't support negative emotion — soften to appropriate alternative
      return softened;
    }
  }

  // Tense/dramatic emotions — soften for children's book warmth
  if (['tense', 'struggle', 'dramatic'].includes(raw)) {
    return 'focused and determined';
  }

  // Not a recognized negative emotion — pass through (could be "excited", "determined", etc.)
  return rawEmotion;
}

function companionReferencedInStoryText(input: Pick<ImageInput, 'companion' | 'bookPageText'>): boolean {
  const n = input.companion?.name?.trim();
  const t = (input.bookPageText ?? '').trim();
  if (!n) return false;
  if (!t) return true;
  return t.includes(n);
}

function deriveImageInputEntityPresence(input: ImageInput): PageEntityPresenceContract {
  const imageDirection =
    (input.rawScenePrompt ?? '').trim() ||
    extractSceneCore(input.pagePrompt || '').trim();
  const storyLocks = resolveStyle01StoryLocks(input.companion?.id);
  return derivePageEntityPresence({
    bookPageText: input.bookPageText,
    imageDirection,
    rawScenePrompt: input.rawScenePrompt,
    pagePrompt: input.pagePrompt,
    childFirstName: input.childFirstName,
    companionName: input.companion?.name,
    companionId: input.companion?.id,
    visualDirection: input.visualDirection,
    recurringObjectCatalog: storyLocks.recurringObjectCatalog,
    recurringEntityCatalog: storyLocks.recurringEntityCatalog,
  });
}

function filterReferenceImagesForEntityPresence(
  referenceImages: string[] | undefined,
  presence: PageEntityPresenceContract
): string[] | undefined {
  if (!referenceImages?.length) return referenceImages;
  if (childPresenceAllowsReferencePhoto(presence.childPresence)) return referenceImages;
  // Child photo is conventionally first ref when mergeGptImageReferenceSources is used
  return referenceImages.length > 1 ? referenceImages.slice(1) : [];
}

type ImageHardLockFields = Pick<
  ImageInput,
  | 'heroVisualLock'
  | 'childFirstName'
  | 'characterSheet'
  | 'childDescription'
  | 'entityVisualLock'
  | 'companion'
  | 'bookPageText'
  | 'orderId'
  | 'pageNumber'
> & {
  childAge?: ImageInput['childAge'];
  childGender?: ImageInput['childGender'];
};

/** Hard Flux identity block: hero MUST match bible; optional companion lock only when Hebrew names them. */
function buildImageHardLockBlock(
  input: ImageHardLockFields,
  entityPresence?: PageEntityPresenceContract
): string {
  const lock = input.heroVisualLock;
  const childName = (input.childFirstName ?? input.characterSheet?.mainCharacter.name ?? 'The child').trim() || 'The child';
  const childAllowed =
    !entityPresence || childPresenceAllowsVisualLock(entityPresence.childPresence);

  let heroLines: string;
  if (!childAllowed) {
    heroLines =
      'NO human child protagonist in this scene. Do NOT render any boy, girl, kid, or human child. Illustrate only the characters named in the page text and image direction.';
  } else if (!lock) {
    const compact = buildCompactProtagonistLock({
      childName: input.childFirstName,
      heroVisualLock: input.heroVisualLock,
      childDescription: input.childDescription,
      orderId: input.orderId,
      pageNumber: input.pageNumber,
      childAge: input.childAge,
      childGender: input.childGender,
    });
    heroLines =
      `CHARACTER_LOCK (do NOT deviate): ${childName}: ${compact} Must be visually identical on every page — same gender presentation, proportions, outfit, hair, and skin tone.`;
  } else {
    const ageFromWizard = input.childAge ? `${input.childAge}-year-old` : null;
    const genderFromWizard =
      input.childGender === 'girl' ? 'girl' : input.childGender === 'boy' ? 'boy' : null;
    const gender =
      genderFromWizard ?? inferGenderFromText(input.childDescription ?? lock.ageImpression ?? '');
    const age = ageFromWizard ?? extractVisualPhrase(lock.ageImpression, 'young child');
    heroLines = [
      `CHARACTER_LOCK (do NOT deviate): ${age} ${gender} child named ${childName}, hair: ${lock.hair}, skin tone: ${lock.skinTone}, clothing: ${lock.clothing}, face: ${lock.faceShape}, eyes: ${lock.eyes}. Must be visually identical on every page.`,
      'Do NOT change the protagonist into a different person, animal, mascot, twins, silhouettes-only, or unnamed background figures occupying the hero role.',
    ].join('\n');
  }

  const parts = [heroLines];
  const companionNamedInText =
    entityPresence?.companionPresence === 'present' || companionReferencedInStoryText(input);
  if (companionNamedInText && input.entityVisualLock) {
    const ev = input.entityVisualLock;
    parts.push(
      `COMPANION_LOCK (do NOT deviate): ${ev.shape}, ${ev.color}, ${ev.proportions} proportions, ${ev.expressiveStyle} expression — same species, colors, and proportions every page this character appears.`
    );
  }

  return parts.join('\n\n');
}

const STRICT_TEXT_EXCLUSION_BLOCK = [
  'CRITICAL TEXT EXCLUSION RULE:',
  'Do NOT include any text, letters, words, numbers, symbols, captions, labels, signage, logos, speech bubbles, handwriting, or watermarks anywhere in the image.',
  'No written elements of any kind are allowed.',
].join('\n');

const STRICT_NEGATIVE_PROMPT =
  'text, letters, words, numbers, symbols, captions, labels, signage, logos, speech bubbles, handwriting, watermarks, subtitles, typographic marks, empty white background, blank background';

/**
 * Hebrew + English action verbs that signal a "scene with action", not a "character portrait".
 * If a page text contains any of these, the composition decision is overridden to a
 * scene-focused variant regardless of what stage 4B chose.
 */
const ACTION_VERB_PATTERNS = [
  /מציצ|מסתכל|רץ|רצה|הולך|הולכת|רוקד|רוקדת|קופץ|קופצת|מתחב|התחב|שומע|שומעת|מדבר|מדברת|מחבק|מחבקת|מצביע|מצביעה|מחזיק|מחזיקה|פותח|פותחת|סוגר|סוגרת|מתגל|מתגלגל|מתגלגלת|מתכרבל|מתכרבלת|מנסה|בורח|בורחת|רואה|רואים|מסתת|התרגש|התלהב/i,
  /צעק|לחש|שאל|ענה|חייך|בכה|התחבא|הציץ|רעם|רשרש|זרק|תפס|ניתר|נבהל|נדהם/i,
  /\b(peek|peeks|peeking|hide|hides|hiding|run|runs|running|walk|walks|walking|jump|jumps|jumping|dance|dances|dancing|talk|talks|talking|hug|hugs|hugging|point|points|pointing|hold|holds|holding|reach|reaches|reaching|look|looks|looking|listen|listens|listening|whisper|whispers|whispering|shout|shouts|shouting|smile|smiles|smiling|cry|cries|crying|chase|chases|chasing|flee|flees|fleeing|tumble|tumbles|tumbling)\b/i,
] as const;

function looksLikeActionBeat(text: string | null | undefined): boolean {
  if (!text) return false;
  return ACTION_VERB_PATTERNS.some((re) => re.test(text));
}

/**
 * Some upstream stage stuffs `page.imagePrompt` with a "PROMPT_CONTRACT_PAGE_N: CRITICAL_IMAGE_RULE: ..."
 * preamble before any actual scene content. Flux treats it as instructions and the scene gets buried.
 * Strip everything up to and including the first instructional block; return only the scene tail.
 */
function composeStoryboardDrivenPagePrompt(
  page: { imagePrompt: string; bookPageText?: string; expectedCharacterIds?: string[]; pageNumber: number },
  storyboard: PageVisualStoryboard,
  illustrationStyle: string,
  characterRegistry?: Record<string, CharacterRegistryEntry>,
  protagonistVisualLock?: string
): string {
  const styleContract = getStyleContract(illustrationStyle);
  const cleanedImagePrompt = extractSceneCore(page.imagePrompt);
  const characterNames =
    page.expectedCharacterIds
      ?.map((id) => characterRegistry?.[id]?.name || id)
      .slice(0, 3)
      .join(', ') || 'child protagonist';

  // Build COMPANION/SUPPORTING-CHARACTER visual locks from the registry. Without
  // this, the prompt only mentions characters by NAME and the image model
  // hallucinates appearances (e.g. a 'gentle giant' rendered as a short bald man
  // because the canonical visualDescription was never injected).
  const supportingLocks: string[] = [];
  for (const id of page.expectedCharacterIds ?? []) {
    if (id === 'child') continue;  // protagonist handled by MAIN CHARACTER LOCK
    const entry = characterRegistry?.[id];
    if (!entry?.description) continue;
    const label = entry.name || id;
    const desc = entry.description.replace(/\s+/g, ' ').trim().slice(0, 320);
    if (desc.length < 5) continue;
    supportingLocks.push(`${label}: ${desc}`);
  }
  // CRITICAL: this lock describes WHO the companion is (identity/appearance)
  // but MUST NOT push toward the same composition every page. Earlier wording
  // 'identical to the cover and every other page' confused the model into
  // rendering identical poses. Now scoped to identity only.
  const companionLockBlock = supportingLocks.length > 0
    ? `COMPANION IDENTITY (use as character reference, NOT as scene reference):\n${supportingLocks.join('\n')}\nKeep these character traits consistent across pages — same species, colors, body shape, and distinctive features. BUT the pose, action, position, expression, and camera angle MUST CHANGE per page based on what is happening in that page's story beat. Identity = same. Composition = varied.`
    : '';
  const baseIntent = (storyboard.intent || page.bookPageText || cleanedImagePrompt).replace(/\s+/g, ' ').trim().slice(0, 320);
  const baseAction = (storyboard.action || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  const baseEnvironment = (storyboard.environment || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  const textZoneRule = storyboardTextZoneInstruction(storyboard.textZone);
  const storySceneRule = [
    'STORY SCENE RULE:',
    '- Every image must represent a specific moment from the story.',
    '- SCENE MUST MATCH STORY: the final image should only fit this page moment, not a generic scene.',
    '- The protagonist must be doing a clear visible action (not a static pose).',
    '- The environment must reflect the scene context and story location.',
    '- Avoid portrait-like framing and avoid static character showcase imagery.',
    '- The image must include emotional context (fear, curiosity, calm, relief, wonder, etc.).',
    'FORBIDDEN:',
    '- centered character looking at camera',
    '- plain background',
    '- character standing still doing nothing',
    '- character showcase / reference pose',
    'REQUIRED:',
    '- clear action (reaching, reacting, moving, guiding, looking, etc.)',
    '- clear environment (room, forest, bed, hallway, yard, etc.)',
    '- clear emotional state readable through pose and composition',
  ].join('\n');
  return [
    `STYLE LOCK:\n${styleContract.optionBlock}`,
    `MAIN CHARACTER IDENTITY (use for character recognition, NOT for pose):\n${protagonistVisualLock ?? 'Keep the same child recognizable across pages — same hair, skin tone, eye color, distinctive features. BUT pose, action, position, expression, and camera angle CHANGE per page based on the story beat. Identity is fixed; composition is not.'}`,
    companionLockBlock,
    storySceneRule,
    [
      'STORYBOARD INTENT:',
      `Depict this exact story beat: ${baseIntent || 'advance the page event clearly with concrete actions.'}`,
      `Storyboard action intent: ${baseAction || 'show a clear physical action tied to the story beat.'}`,
    ].join('\n'),
    [
      'COMPOSITION:',
      storyboardShotInstruction(storyboard.shotType),
      storyboardCompositionInstruction(storyboard.compositionMode),
      storyboardCameraInstruction(storyboard.cameraAngle),
      storyboardVisibilityInstruction(storyboard.mainCharacterVisibility),
      storyboardDominanceInstruction(storyboard.protagonistDominance),
      'Do not output a portrait/headshot/character-sheet composition.',
      'Do not show the protagonist only from behind unless explicitly required by the story beat.',
    ].join('\n'),
    [
      'PAGE-SPECIFIC COMPOSITION:',
      'This page must feel like a different cinematic shot than every other page in the book.',
      'No two pages have the same pose, camera angle, or framing.',
      'Off-center placement is preferred over perfect symmetry.',
      'Characters are embedded in the scene — not floating in empty space.',
    ].join('\n'),
    [
      'ENVIRONMENT:',
      `Show this environment: ${baseEnvironment || 'a child bedroom at night with concrete room details.'}`,
      'Environment must be visible and specific: include furniture, walls, floor, and depth cues.',
      'Avoid empty, blank, or plain white backgrounds.',
    ].join('\n'),
    [
      'CAST CONTROL:',
      `Show only these characters: ${characterNames}. Do not introduce extra children or animals unless explicitly required by the story.`,
    ].join('\n'),
    [
      'EMOTION + LIGHTING:',
      storyboardEmotionInstruction(storyboard.emotionalTone),
      storyboardLightingInstruction(storyboard.lighting),
    ].join('\n'),
    ['TEXT ZONE:', textZoneRule].join('\n'),
    STRICT_TEXT_EXCLUSION_BLOCK,
    'PAGE INTEGRATION / COMPOSITION RULE:\nIllustration must feel integrated into a printed children\'s book page with organic boundaries and story-aware white space; avoid hard rectangular poster framing.',
    `NEGATIVE PROMPT:\n${STRICT_NEGATIVE_PROMPT}`,
  ].join('\n\n');
}

export async function previewStoryboardPrompts(input: {
  pages: Array<{
    pageNumber: number;
    imagePrompt: string;
    bookPageText?: string;
    expectedCharacterIds?: string[];
    pageIntent?: PageIntent;
  }>;
  childName?: string | null;
  childDescription?: string;
  illustrationStyle: string;
  characterRegistry?: Record<string, CharacterRegistryEntry>;
}): Promise<Array<{ pageNumber: number; storyboard: PageVisualStoryboard; finalPrompt: string }>> {
  const normalizedStyle = normalizeStyleId(input.illustrationStyle);
  const protagonistVisualLock = buildCompactProtagonistLock({
    childName: input.childName,
    childDescription: input.childDescription,
  });
  const storyboardPlan = await generateStoryboard({
    fullStory: input.pages
      .map((p) => (p.bookPageText ?? '').trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 12000),
    pages: input.pages.map((p) => ({
      pageNumber: p.pageNumber,
      imagePrompt: p.imagePrompt,
      bookPageText: p.bookPageText,
      pageIntent: p.pageIntent,
    })),
    childProfile: [input.childName ?? '', input.childDescription ?? ''].filter(Boolean).join(' | '),
    selectedStyle: normalizedStyle,
  });
  const storyboardByPage = new Map<number, PageVisualStoryboard>(
    storyboardPlan.map((row) => [row.pageNumber, row])
  );

  return input.pages.map((page) => {
    const storyboard =
      storyboardByPage.get(page.pageNumber) ??
      normalizeStoryboardRows(
        [{ pageNumber: page.pageNumber, imagePrompt: page.imagePrompt, bookPageText: page.bookPageText }],
        []
      )[0];
    return {
      pageNumber: page.pageNumber,
      storyboard,
      finalPrompt: composeStoryboardDrivenPagePrompt(
        {
          pageNumber: page.pageNumber,
          imagePrompt: page.imagePrompt,
          bookPageText: page.bookPageText,
          expectedCharacterIds: page.expectedCharacterIds,
        },
        storyboard,
        normalizedStyle,
        input.characterRegistry,
        protagonistVisualLock
      ),
    };
  });
}

function resolvePageCharacterDisplayNames(
  page: { expectedCharacterIds?: string[] },
  registry: Record<string, CharacterRegistryEntry>
): string[] | null {
  const ids = page.expectedCharacterIds;
  if (!ids || ids.length === 0) return null;
  const names = ids
    .map((id) => registry[id]?.name?.trim())
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names : null;
}

type Stage4CompositionInput = NonNullable<ImageInput['composition']>;

function buildCompositionDirectiveFromStage4Plan(composition: Stage4CompositionInput): string {
  return [
    `COMPOSITION: ${composition.cameraDistance} shot, ${composition.cameraAngle}, ${composition.compositionType}.`,
    `CHARACTER PLACEMENT: hero ${composition.heroPlacement}, entity ${composition.entityPlacement}.`,
    `ILLUSTRATION ZONE: ${composition.mainIllustrationZone}.`,
    `TEXT-SAFE ZONE: top 20-30% of frame must be ${composition.topTextAreaPlan} - calm, uncluttered.`,
  ].join(' ');
}

/** Visual Director Flux prompts skip buildPromptParts — apply the same locks + composition so behavior matches LEGACY path. */
function prependFluxHardLocksAndComposition(promptBody: string, input: ImageInput): string {
  const lockBlock = buildImageHardLockBlock(input).trim();
  const compositionVariation = getCompositionVariation(input.pageNumber);
  const directive =
    input.composition?.cameraAngle && input.composition?.compositionType
      ? buildCompositionDirectiveFromStage4Plan(input.composition)
      : `COMPOSITION: ${compositionVariation.promptDirective}.`;
  const head = `${lockBlock}\n\nCOMPOSITION (do NOT soften — match interior pages): ${directive}`.trim();
  return `${head}\n\n${promptBody}`.trim();
}

async function buildPromptParts(input: ImageInput): Promise<{
  finalPrompt: string;
  negativePrompt: string;
  styleId: string;
  compositionVariation: CompositionVariation;
}> {
  const compositionVariation = getCompositionVariation(input.pageNumber);
  const entityPresence = deriveImageInputEntityPresence(input);
  const companionInText = entityPresence.companionPresence === 'present';
  const hasWizardCompanion = Boolean(input.companion?.name?.trim());
  const includeCompanionInScene = !hasWizardCompanion || companionInText;
  const compositionDirective =
    input.composition && input.composition.cameraAngle && input.composition.compositionType
      ? buildCompositionDirectiveFromStage4Plan(input.composition)
      : `COMPOSITION: ${compositionVariation.promptDirective}.`;

  console.log(
    `[composition_directive_for_translate] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} directive="${compositionDirective.replace(/"/g, "'")}"`
  );

  const entityNameForTranslate =
    hasWizardCompanion && !companionInText ? null : (input.concept?.centralEntity?.name ?? null);
  const entityVisualForTranslate =
    hasWizardCompanion && !companionInText
      ? null
      : input.entityVisualLock
        ? `${input.entityVisualLock.shape}, ${input.entityVisualLock.color}`
        : input.concept?.centralEntity?.visualDescription ?? null;

  const scene = input.bookPageText
    ? await translateSceneForImage({
        bookPageText: input.bookPageText,
        pagePrompt: input.pagePrompt,
        pageNumber: input.pageNumber,
        totalPages: input.totalPages,
        childName: input.childFirstName,
        entityName: entityNameForTranslate,
        entityVisual: entityVisualForTranslate,
        heroVisualLock: input.heroVisualLock ?? null,
        textZone: input.textZone ?? null,
        orderId: input.orderId,
        compositionDirective,
        includeCompanionCharacters: includeCompanionInScene,
        childPresence: entityPresence.childPresence,
      })
    : extractSceneCore(input.pagePrompt);
  const sceneWithComposition = `${compositionDirective}\n\n${scene}`.trim();
  const characterLockLead = buildImageHardLockBlock(input, entityPresence);
  const protagonistLock = characterLockLead
    ? ''
    : buildCompactProtagonistLock({
        childName: input.childFirstName,
        heroVisualLock: input.heroVisualLock,
        childDescription: input.childDescription,
        orderId: input.orderId,
        pageNumber: input.pageNumber,
        childAge: input.childAge,
        childGender: input.childGender,
      });
  const entityLock =
    input.entityVisualLock && includeCompanionInScene
      ? `Companion: ${input.entityVisualLock.shape}, ${input.entityVisualLock.color}, ${input.entityVisualLock.proportions} proportions, ${input.entityVisualLock.expressiveStyle} expression style`
      : '';
  const zone = textZoneDirective(input.textZone, normalizedOverlayTextLength(input.bookPageText));
  const result = buildImagePrompt({
    styleIdInput: input.illustrationStyle,
    sceneDescription: sceneWithComposition,
    textZoneDirective: zone,
    protagonistLock,
    entityLock,
    characterLockLead,
    globalNegativeConstraints: [NO_TEXT_LOCK],
  });
  const wordCount = result.finalPrompt.split(/\s+/).filter(Boolean).length;
  console.log(
    `[prompt_compact] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} words=${wordCount} chars=${result.finalPrompt.length} sceneWords=${sceneWithComposition.split(/\s+/).filter(Boolean).length} textZonePresent=${Boolean(zone)} compositionDirective="${compositionDirective.replace(/"/g, "'")}"`
  );
  if (wordCount > 450) {
    console.warn(`[prompt_compact_warning] Prompt exceeds 450 words (${wordCount}). Scene may be truncated by Flux.`);
  }

  return {
    finalPrompt: result.finalPrompt,
    negativePrompt: result.negativePrompt,
    styleId: result.styleId,
    compositionVariation,
  };
}

/** Scene-led Flux prompt (~70–110 words) when FLUX_CLEAN_PROMPT=on. Legacy path unchanged when off. */
async function buildFluxCleanPromptParts(
  input: ImageInput & { pageStoryboard: PageVisualStoryboard }
): Promise<{
  finalPrompt: string;
  negativePrompt: string;
  styleId: string;
}> {
  const styleId = normalizeStyleId(input.illustrationStyle);
  const includeCompanion = shouldIncludeCompanionInFluxCleanPrompt({
    companion: input.companion,
    bookPageText: input.bookPageText,
    pagePrompt: input.pagePrompt,
    visualDirection: input.visualDirection,
    expectedCharacterIds: input.expectedCharacterIds,
    pageStoryboard: input.pageStoryboard,
  });

  const childDisplayName = normalizeFluxChildDisplayName(input.childFirstName);
  const entityNameForTranslate =
    includeCompanion ? 'Bolly' : input.concept?.centralEntity?.name ?? null;
  const entityVisualForTranslate =
    includeCompanion && input.companion?.visualDescription
      ? input.companion.visualDescription
      : input.entityVisualLock
        ? `${input.entityVisualLock.shape}, ${input.entityVisualLock.color}`
        : input.concept?.centralEntity?.visualDescription ?? null;

  const scene = input.bookPageText
    ? await translateSceneForImage({
        bookPageText: input.bookPageText,
        pagePrompt: input.pagePrompt,
        pageNumber: input.pageNumber,
        totalPages: input.totalPages,
        childName: childDisplayName,
        entityName: entityNameForTranslate,
        entityVisual: entityVisualForTranslate,
        heroVisualLock: input.heroVisualLock ?? null,
        textZone: null,
        orderId: input.orderId,
        compositionDirective: null,
        includeCompanionCharacters: includeCompanion,
        childPresence: deriveImageInputEntityPresence(input).childPresence,
        promptMode: 'clean',
      })
    : sanitizeFluxCleanEnglishText(extractSceneCore(input.pagePrompt));

  const entityPresence = deriveImageInputEntityPresence(input);
  const childLine = childPresenceAllowsVisualLock(entityPresence.childPresence)
    ? buildFluxCleanChildLine({
        childName: childDisplayName,
        childAge: input.childAge,
        childGender: input.childGender,
        directionArchetype: input.directionArchetype ?? null,
        heroVisualLock: input.heroVisualLock ?? null,
      })
    : 'no human child in this scene';
  const companionLine = includeCompanion
    ? buildFluxCleanCompanionLine(input.companion, input.companionStructured ?? null)
    : undefined;
  const compositionLine = buildFluxCleanCompositionLine(input.pageStoryboard);
  const promptParts = {
    childLine,
    companionLine,
    compositionLine: sanitizeFluxCleanEnglishText(compositionLine),
  };
  const { finalPrompt, wordCount } = buildFluxCleanPromptWithinBudget(
    sanitizeFluxCleanEnglishText(scene),
    promptParts
  );
  console.log(
    `[flux_clean_prompt] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} words=${wordCount} chars=${finalPrompt.length} includeCompanion=${includeCompanion} shot=${input.pageStoryboard.shotType} angle=${input.pageStoryboard.cameraAngle}`
  );
  if (input.pageNumber === 1) {
    console.log('[flux_clean_prompt_page1]', { wordCount, fullPrompt: finalPrompt });
  }
  if (wordCount < 70 || wordCount > 130) {
    console.warn(
      `[flux_clean_prompt_warning] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} words=${wordCount} (target 70-130)`
    );
  }

  const negativeParts = [
    getNegativeStylePromptBlock(styleId),
    NO_TEXT_LOCK,
    FLUX_CLEAN_ANTI_CROP_NEGATIVES,
    ...(input.extraNegativeRules ?? []),
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    finalPrompt,
    negativePrompt: negativeParts.join('; '),
    styleId,
  };
}

/** Build clean Flux prompt without calling Replicate (for experiments / QA). */
export async function previewFluxCleanPrompt(
  input: ImageInput
): Promise<{ finalPrompt: string; negativePrompt: string; styleId: string; wordCount: number }> {
  if (!isFluxCleanPromptEnabled()) {
    throw new Error('previewFluxCleanPrompt requires FLUX_CLEAN_PROMPT=on');
  }
  if (!input.pageStoryboard) {
    throw new Error('previewFluxCleanPrompt requires pageStoryboard on ImageInput');
  }
  const parts = await buildFluxCleanPromptParts({ ...input, pageStoryboard: input.pageStoryboard });
  return { ...parts, wordCount: countPromptWords(parts.finalPrompt) };
}

function withConsistencyReinforcement(
  finalPrompt: string,
  anchoredCharacters: Array<{ name: string; anchorImageUrl: string }>
): string {
  if (anchoredCharacters.length === 0) return finalPrompt;

  // PROMPT_ONLY: Reinforcement language below is guidance for generation models.
  const anchorLines = anchoredCharacters.map((entry) => `- ${entry.name}: ${entry.anchorImageUrl}`);

  // ENFORCED_BY (child only): backend/providers/image.ts:generateAllPageImages — anchor election + scoreResemblanceAgainstReference + selectResemblanceAnchor.
  // PROMPT_ONLY (supporting characters and rendering-finish drift): no per-character resemblance scoring beyond child; style-drift detection is not in code.
  const block = [
    'CHARACTER_CONSISTENCY_GUIDELINE:',
    'all recurring characters should stay consistent with their reference images in:',
    '- face structure',
    '- hair',
    '- proportions',
    '- resemblance',
    '- skin tone and facial feature geometry',
    '- clothing silhouette and palette unless scene explicitly requires a change',
    '- rendering finish should remain consistent across pages (no style drift)',
    '',
    'STRONG CHILD RESEMBLANCE GUIDANCE:',
    '- keep the same illustrated child character with strong resemblance in every image',
    '- preserve consistent face geometry (jaw, cheeks, chin, eye shape/spacing, nose, mouth)',
    '- preserve consistent skin tone, hair color/length/style, and age appearance',
    '- never reinterpret the child as a different face',
    '- only clothing, pose, expression, lighting, and environment may vary',
    '- if resemblance drifts, regenerate to match the anchor character',
    '',
    'SUPPORTING_CHARACTER_GUIDANCE:',
    '- every anchored supporting character should remain recognizable as the same person',
    '- preserve the same face shape, hair, skin tone, and body proportions for anchored supporting characters',
    '- if resemblance to any supporting anchor is weak, prefer a regenerate that recovers recognizability',
    '',
    'CHARACTER REFERENCE REGISTRY:',
    ...anchorLines,
    '',
    'preserve character design across pages',
  ].join('\n');

  return `${finalPrompt}\n\n${block}`;
}

async function assembleImagePrompt(input: ImageInput): Promise<string> {
  const parts = await buildPromptParts(input);
  return withConsistencyReinforcement(
    parts.finalPrompt,
    (input.anchorCharacters ?? []).map((entry) => ({ name: entry.name, anchorImageUrl: entry.anchorImageUrl }))
  );
}

function buildDirectionPreviewStyleLockPrefix(styleIdInput: string): string {
  const style = getStyleContract(styleIdInput);
  return [
    'STYLE_LOCK:',
    style.optionBlock,
    '',
    'CONSISTENCY_RULE:',
    'All three direction preview images must use the exact same illustration style. Do not vary style between images.',
    'Only vary scene, lighting, emotion, pose, and composition.',
    '',
    'CRITICAL_SCENE_RULE:',
    'Do not generate a character portrait or plain/white background.',
    'The image must include a full environment scene with depth, background, and context.',
    '',
  ].join('\n');
}

function normalizeImageProviderEnv(): 'replicate' | 'dall-e-3' | 'gpt-image' {
  return resolveLegacyImageProviderEnv();
}

/**
 * Strip Flux/LoRA-specific blocks from the incoming pagePrompt.
 * The pipeline adds STYLE_LOCK, PROMPT_CONTRACT, CHARACTER_LOCK, LoRA triggers etc.
 * that are irrelevant (and harmful) for GPT Image — we only want the scene description.
 */
function stripFluxArtifacts(raw: string): string {
  let cleaned = raw;
  // Remove STYLE_LOCK blocks (everything from STYLE_LOCK to next major section or end)
  cleaned = cleaned.replace(/STYLE_LOCK:[\s\S]*?(?=(?:PRIMARY SCENE:|SCENE:|CHARACTER_LOCK:|PROMPT_CONTRACT:|$))/gi, '');
  // Remove PROMPT_CONTRACT blocks
  cleaned = cleaned.replace(/PROMPT_CONTRACT[\s\S]*?(?=(?:PRIMARY SCENE:|SCENE:|$))/gi, '');
  // Remove CHARACTER_LOCK / HARD_LOCK blocks
  cleaned = cleaned.replace(/(?:CHARACTER_LOCK|HARD_LOCK|CHARACTER_SHEET)[:\s][\s\S]*?(?=(?:PRIMARY SCENE:|SCENE:|Environment|$))/gi, '');
  // Remove LoRA trigger words
  cleaned = cleaned.replace(/\b(?:REALISTART01|REALISTART02|PENCILSTYLE02|TOK|trigger:\s*\S+)\b/gi, '');
  // Remove STYLE OPTION blocks
  cleaned = cleaned.replace(/STYLE OPTION \d+:[\s\S]*?(?=(?:PRIMARY SCENE:|SCENE:|Environment|$))/gi, '');
  // Remove "DIRECTION_PREVIEW_" template markers
  cleaned = cleaned.replace(/DIRECTION_PREVIEW_\w+/g, '');
  // Remove internal_id lines
  cleaned = cleaned.replace(/internal_id:\s*\S+/gi, '');
  // Remove USER_LABEL_HE lines
  cleaned = cleaned.replace(/USER_LABEL_HE:\s*.+/gi, '');
  // Remove "STYLE LOCK —" lines
  cleaned = cleaned.replace(/STYLE LOCK\s*[-—].*/gi, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Safety sanitizer — replace words/phrases known to trigger GPT Image content filters.
 * Applied as the last step before sending any prompt to the API.
 * Keeps visual meaning intact while breaking self-harm pattern matches.
 */
function sanitizePromptForSafety(prompt: string): string {
  let s = prompt;
  // "rope" + child/tree context triggers self-harm filter
  s = s.replace(/\brope\b/gi, 'cloth cord');
  // "exposed roots" can read as bodily harm
  s = s.replace(/\bexposed roots\b/gi, 'visible roots');
  // "grimacing" + child reads as pain/harm
  s = s.replace(/\bgrimacing\b/gi, 'focused');
  // "clenched jaw" + child reads as distress
  s = s.replace(/\bclenched jaw\b/gi, 'firm expression');
  // "pained" + child reads as suffering
  s = s.replace(/\bpained\b/gi, 'disappointed');
  // "torn rope" doubly bad
  s = s.replace(/\btorn cloth cord\b/gi, 'frayed cloth cord');
  // "rain hitting her face" + distress = self-harm adjacent
  s = s.replace(/rain hitting (?:her|his|their) face/gi, 'rain around her');
  return s;
}

function buildGPTImagePrompt(input: ImageInput): string {
  const isPreview = !!input.isDirectionPreview;
  const entityPresence = deriveImageInputEntityPresence(input);

  // ── SCENE EXTRACTOR PATH (deterministic assembly from visualDirection) ──
  const vd = input.visualDirection;

  // Build scene deterministically: prefer Director Layer BLOCKING when available,
  // otherwise fall back to the legacy mechanical Scene Extractor lines.
  const directorBlocking = input.blocking;
  const mechanicalScene = directorBlocking
    ? renderSceneBlockingForPrompt(directorBlocking, vd ?? null)
    : vd
    ? [
        `Location: ${vd.locationZone}.`,
        `Action: ${vd.mainAction}.`,
        vd.characterPose ? `Pose: ${vd.characterPose}.` : '',
        vd.visibleObjects?.length ? `Visible objects: ${vd.visibleObjects.slice(0, 5).join(', ')}.` : '',
        // Only emit Expression when we have an explicit, sanitized emotion.
        // Previously the fallback "aligned with scene emotion and action" was injected on every page
        // — combined with cool/dim scenes, this dragged the model toward defaulting all faces to sad.
        // No fallback line → model picks expression from the scene action naturally.
        typeof vd.emotionVisual === 'string' && vd.emotionVisual.trim().length > 0
          ? `Expression: ${sanitizeEmotion(vd.emotionVisual, input.bookPageText ?? undefined)}.`
          : '',
        vd.lightingSource ? `Lighting: ${vd.lightingSource}.` : '',
        vd.environmentDetail ? `Detail: ${vd.environmentDetail}.` : '',
      ].filter(Boolean).join(' ')
    : '';

  // mustInclude enforcement — append explicit requirement
  const mustIncludeBlock = vd?.mustInclude?.length
    ? `MUST INCLUDE in this illustration: ${vd.mustInclude.join(', ')}.`
    : '';

  // mustNotInclude enforcement — explicit negative constraints
  const mustNotIncludeBlock = vd?.mustNotInclude?.length
    ? `DO NOT include: ${vd.mustNotInclude.join(', ')}.`
    : '';

  // Use textTranslation as ground truth reference when available
  const textTranslation = vd?.textTranslation?.trim() ?? '';

  // Camera/composition from Scene Extractor (overrides rotation table)
  const extractorCamera = vd?.camera?.trim() ?? '';
  const extractorComposition = vd?.composition?.trim() ?? '';

  // Fallback sources (only if no visualDirection)
  const rawScene = (input.rawScenePrompt ?? '').trim();
  const stage4 = (input.stage4Prompt ?? '').trim();
  const fallbackScene = extractSceneCore(input.pagePrompt || '').trim();

  const sceneSource = mechanicalScene
    ? 'sceneExtractor'
    : rawScene ? 'rawScene'
    : stage4 ? 'stage4'
    : fallbackScene ? 'fallback'
    : 'bookPageText';
  const sceneDesc =
    mechanicalScene || rawScene || stage4 || fallbackScene || (input.bookPageText ?? '').trim() || '';

  const trimmedScene =
    sceneDesc.length > 450 ? sceneDesc.slice(0, 447).replace(/\s\S*$/, '...') : sceneDesc;

  // ── CHARACTER DNA — structured lock preferred, flat fallback ──
  const charParts: string[] = [];
  const wardrobeLock = resolveBookWardrobeLock(input.directionArchetype);
  if (wardrobeLock) {
    logBookWardrobeLockOnce(wardrobeLock, input.orderId ?? `page-${input.pageNumber}`);
  }
  const cs = input.childStructured;
  const effectiveCs = wardrobeLock && cs ? applyWardrobeToChildStructured(cs, wardrobeLock) : cs;
  // IMPORTANT: this block is recognition-only. A long detailed face description placed near
  // the end of the prompt causes the model to compose around the face (centered close-up portrait).
  // We prefix every variant with a usage hint so the features stay consistent across pages
  // WITHOUT becoming the framing target.
  const charRecognitionHint =
    'CHARACTER IDENTITY (for cross-page recognition only — do NOT use this as a reason to center, close-up, or pose toward camera):';
  if (childPresenceAllowsVisualLock(entityPresence.childPresence)) {
    if (effectiveCs && effectiveCs.face && effectiveCs.hair && effectiveCs.clothing) {
      charParts.push(
        `${charRecognitionHint} ${effectiveCs.face} ${effectiveCs.hair} ${effectiveCs.body}. Wearing: ${effectiveCs.clothing}${effectiveCs.signature ? ` (${effectiveCs.signature})` : ''}.`,
      );
    } else if (input.childDescription) {
      charParts.push(`${charRecognitionHint} ${input.childDescription}`);
    }
    if (wardrobeLock) {
      charParts.push(buildBookWardrobePromptSection(wardrobeLock));
    }
  } else {
    charParts.push(
      'NO human child in this scene. Do NOT depict boy, girl, kid, toddler, or human protagonist.'
    );
  }

  // ── COMPANION PRESENCE — use mustInclude/mustNotInclude as source of truth ──
  const companionInMustInclude = vd?.mustInclude?.some(item =>
    input.companion && (item.toLowerCase().includes(input.companion.name.toLowerCase()) ||
    item.toLowerCase().includes('companion'))
  );
  const companionInMustNotInclude = vd?.mustNotInclude?.some(item =>
    input.companion && (item.toLowerCase().includes(input.companion.name.toLowerCase()) ||
    item.toLowerCase().includes('companion'))
  );
  const companionShouldAppear = entityPresence.companionPresence === 'present';

  const cps = input.companionStructured;
  if (input.companion && companionShouldAppear && companionInMustInclude) {
    if (cps && cps.species && cps.coloring) {
      charParts.push(
        `COMPANION (must appear): ${cps.species}, ${cps.size}, ${cps.coloring}, ${cps.feature}.`,
      );
    } else {
      charParts.push(`COMPANION (must appear): ${input.companion.name}, ${input.companion.visualDescription}`);
    }
  } else if (input.companion && (!companionShouldAppear || companionInMustNotInclude)) {
    charParts.push(`NO companion in this scene.`);
  } else if (input.companion && companionShouldAppear) {
    const companionInScene = companionReferencedInStoryText(input) || companionShouldAppear;
    if (companionInScene) {
      if (cps && cps.species && cps.coloring) {
        charParts.push(
          `COMPANION: ${cps.species}, ${cps.size}, ${cps.coloring}, ${cps.feature}.`,
        );
      } else {
        charParts.push(`COMPANION: ${input.companion.name}, ${input.companion.visualDescription}`);
      }
    } else {
      charParts.push(`NO companion in this scene.`);
    }
  }
  if (input.supportingCharacters?.length && childPresenceAllowsVisualLock(entityPresence.childPresence)) {
    for (const sc of input.supportingCharacters) {
      const relLabel = sc.relationship ? ` (${sc.relationship})` : '';
      const hasStructured =
        sc.physicalDescription &&
        sc.clothingDefault &&
        sc.signatureDetail &&
        sc.ageRange;
      if (hasStructured) {
        charParts.push(
          `SUPPORTING CHARACTER - ${sc.name}${relLabel}:`,
          `Physical: ${sc.physicalDescription}`,
          `Clothing: ${sc.clothingDefault}`,
          `Signature: ${sc.signatureDetail}`,
          `Age: ${sc.ageRange}`,
          'This character MUST appear in this scene alongside the main child. Render with the SAME level of detail and consistency as the protagonist.'
        );
      } else {
        charParts.push(
          `SUPPORTING CHARACTER - ${sc.name}${relLabel}:`,
          `${sc.description}`,
          'This character MUST appear in this scene alongside the main child.'
        );
      }
    }
  }
  const characterBlock = charParts.length > 0 ? charParts.join('\n') : '';

  // ── PROP DNA — inject locked descriptions for recurring objects in this scene ──
  const propParts: string[] = [];
  if (input.propDNA && typeof input.propDNA === 'object') {
    const sceneLC = (mechanicalScene + ' ' + rawScene + ' ' + (input.bookPageText ?? '')).toLowerCase();
    for (const [propName, propDesc] of Object.entries(input.propDNA)) {
      // Match prop name (with underscores → spaces) against scene text
      const searchTerms = propName.replace(/_/g, ' ').split(' ').filter(w => w.length > 2);
      const found = searchTerms.some(term => sceneLC.includes(term));
      if (found) {
        propParts.push(`${propName.replace(/_/g, ' ')}: ${propDesc}`);
      }
    }
  }
  const propBlock = propParts.length > 0
    ? `PROPS: ${propParts.join('; ')}.`
    : '';

  // ── STYLE — pull from style contract for differentiated rendering ──
  // Single source of truth: renderingDescription. styleNudge is intentionally NOT
  // appended here — it duplicates the same idea and caused the "two Premium blocks"
  // bug where the model interpreted "characters" plural as a directive to render
  // multiple children. Keep ONE concise paragraph.
  const styleContract = input.illustrationStyle
    ? getStyleContract(input.illustrationStyle)
    : null;
  const styleRendering = styleContract?.renderingDescription ?? '';
  const styleBlock = isPreview
    ? `MEDIUM LOCK:\n${styleRendering || "Modern children's picture book illustration with vivid saturated full colors and rich edge-to-edge detail"}. No text or letters.`
    : `MEDIUM LOCK:\n${styleRendering || "Modern children's picture book illustration with vivid saturated full colors and rich edge-to-edge detail"}. No text, no letters, no UI.`;

  // ── PREVIEW PATH (direction cards) ──
  if (isPreview) {
    let previewScene = trimmedScene.replace(/PRIMARY SCENE:|STYLE_LOCK:[^\n]*/gi, ' ').trim();
    previewScene = stripFluxArtifacts(previewScene).trim() || previewScene || trimmedScene;
    const previewParts = [previewScene, characterBlock, styleBlock].filter(Boolean);
    const previewFull = previewParts.join('\n\n');
    console.log(`[gpt_prompt_preview] page=${input.pageNumber} previewSceneLen=${previewScene.length}`);
    return previewFull;
  }

  // ── COMPOSITION — prefer Scene Extractor camera, fallback to rotation ──
  const compParts: string[] = [];
  if (extractorCamera) {
    compParts.push(extractorCamera);
  } else if (input.pageNumber && input.totalPages) {
    const cameraRotation = [
      'Wide shot, character small in the scene.',
      'Medium shot, character fills lower third.',
      'Close-up, focus on hands or face.',
      'Over-shoulder view from behind character.',
      'Wide shot from a different angle than page 1.',
      'Close-up of companion or key object.',
      'Dynamic angle, slightly above looking down.',
      'Calm wide shot, peaceful composition.',
    ];
    const camIdx = ((input.pageNumber - 1) % cameraRotation.length + cameraRotation.length) % cameraRotation.length;
    compParts.push(cameraRotation[camIdx]!);
  }
  if (extractorComposition) {
    compParts.push(extractorComposition);
  }
  if (input.pageNumber && input.totalPages) {
    compParts.push(`Page ${input.pageNumber} of ${input.totalPages} — visually distinct from other pages.`);
  }

  // Text zone — keep the anti-cream-flood guardrail here.
  // The actual percentage (33%) is owned by layoutDirective below — do NOT duplicate
  // a conflicting number here. Earlier this block said "25%" while layoutDirective
  // said "33%" — the model averaged them and produced inconsistent text bands.
  if (input.textZone) {
    const tzMap: Record<string, string> = {
      top_clear: 'In the upper text-overlay band: keep environment soft and low-detail (open sky, calm ceiling, atmospheric haze) — STILL in real saturated colors, NOT cream or sepia. No faces, hands, or important objects in this band.',
      bottom_clear: 'In the lower text-overlay band: keep environment soft and low-detail (floor, bedding, ground, soft foreground) — STILL in real saturated colors, NOT cream or sepia. No faces, hands, or important objects in this band.',
      left_clear: 'In the left text-overlay band: real saturated colors, low detail, no faces or hands.',
      right_clear: 'In the right text-overlay band: real saturated colors, low detail, no faces or hands.',
      center_clear: 'In the center text-overlay band: real saturated colors, low detail, no faces or hands.',
    };
    const tzHint = tzMap[input.textZone];
    if (tzHint) compParts.push(tzHint);
  } else {
    // Default: top band hint without a hard percentage (layoutDirective owns the %)
    compParts.push('Keep the upper text-overlay band soft and lighter — real saturated colors, no key details there.');
  }

  const compositionBlock = compParts.join(' ');

  // ── FIDELITY RULES (Scene Extractor enforcement) ──
  // The "ONE child only" rule is critical: when CHARACTER IDENTITY + SCENE BLOCKING
  // both reference the protagonist by name, gpt-image-1 sometimes spawns the child
  // twice. The species rule kills "her arm" anthropomorphism on non-human companions.
  const companionSpeciesForRule =
    (input.companionStructured?.species || input.companion?.name || '').trim();
  const sceneRules = [
    'RULES:',
    '- Illustrate EXACTLY what is described. Nothing more, nothing less.',
    entityPresence.childPresence === 'absent'
      ? '- NO human child, boy, girl, kid, or human protagonist in this frame.'
      : '- Exactly ONE child in the frame when a child is present. Do NOT duplicate the protagonist anywhere in the image, including the foreground, background, or edges.',
    companionSpeciesForRule
      ? `- The companion is a ${companionSpeciesForRule} — draw it as that real species. NEVER add human arms, hands, fingers, or a human face to the companion. Any body parts mentioned (e.g. "arm", "leg") refer to the species' own anatomy, not to a human.`
      : '',
    mustIncludeBlock ? `- ${mustIncludeBlock}` : '',
    mustNotIncludeBlock ? `- ${mustNotIncludeBlock}` : '',
    entityPresence.forbiddenEntities.length
      ? `- FORBIDDEN entities: ${entityPresence.forbiddenEntities.join(', ')}.`
      : '',
    '- Expression MUST match scene emotion — do NOT default to smiling.',
    '- Child-safe. No horror, no violence.',
    '- ZERO text, letters, numbers, or symbols anywhere in the image.',
    '- Character appearance is LOCKED — do not modify face, hair, clothing, or skin tone.',
    ...(input.extraNegativeRules ?? []).map((rule) => `- ${rule}`),
  ].filter(Boolean).join('\n');

  // ── TEXT REFERENCE (ground truth from Hebrew) ──
  const textRef = textTranslation
    ? `Scene based on text: "${textTranslation.slice(0, 200)}"`
    : '';

  // ── UNIVERSAL LAYOUT DIRECTIVE — single image, dual-use ──
  // Every interior image is portrait 1024x1536.
  // - On mobile / video: image fills screen; Hebrew text overlays the textZone soft band (top OR bottom 25%).
  // - On desktop / PDF: CSS crops out the textZone soft band; the remaining 75% becomes the image page of a 2-page spread.
  //
  // pageLayoutStyle stays as a NARRATIVE/COMPOSITION signal (intimate close-medium vs wide cinematic),
  // but does NOT change size or text-zone presence anymore.
  const isVignetteFraming = input.pageLayoutStyle === 'vignette';
  // CRITICAL: gpt-image-1 systematically defaults to 55-65% character fill no
  // matter what we ask. We compensate by demanding 25-35% explicitly and
  // repeating the constraint multiple times — observed empirically to land
  // the model around 40%, which matches a proper picture-book wide shot.
  const framingHint = isVignetteFraming
    ? 'SMALL CHARACTER IN A LARGER WORLD — the child occupies AT MOST 25% of the frame height (one quarter, not half). The scene is the protagonist; the child is a small figure inside it. PULL THE CAMERA WAY BACK. Generous BREATHING SPACE above and around the character — at least 30% empty/atmospheric area between character and the frame edges. NO close-up. NO centered hero shot. Like a Sergio Ruzzier or Jon Klassen picture-book page: tiny figure, vast scene, lots of negative space.'
    : 'TINY CHARACTER IN VAST ENVIRONMENT — child occupies AT MOST 15-20% of the frame. The environment dominates 80%+. Think drone-shot or storybook wide: child as a small marker inside a sweeping landscape. NEVER centered. NEVER large. Override any earlier instruction that wants character larger.';

  const textZoneSide = input.textZone === 'top_clear'
    ? 'TOP 33% of the frame'
    : input.textZone === 'bottom_clear'
      ? 'BOTTOM 33% of the frame'
      : 'BOTTOM 33% of the frame (default)';

  const layoutDirective = [
    // CRITICAL: this block is at the END of the prompt — model weights it most heavily.
    // The header used to say 'UNIVERSAL PORTRAIT' which the model interpreted as a
    // composition style (centered character portrait), not as the page aspect ratio.
    // Renamed to 'PAGE ASPECT' to remove that ambiguity.
    'CANVAS — 2:3 tall format, 1024x1536 pixels. This is the page SHAPE only, not a composition style.',
    '- Render a full STORYBOOK SCENE: the environment of this story beat is clearly visible — room, terrain, sky, props.',
    `- ${framingHint}`,
    '- Character is naturally embedded in the scene, in motion or interacting with the environment. NOT centered, NOT posing toward camera, NOT isolated on a blank background.',
    '',
    `TEXT-ZONE READABILITY (at the ${textZoneSide}, ~one third of frame height):`,
    `- This band should be visually quieter than the rest — softer edges, fewer sharp details, lower contrast — so dark Hebrew text can sit on it legibly on mobile.`,
    `- Quietness comes from LOW-DETAIL ENVIRONMENT in this zone: ground, floor, water, foliage, bedding, atmospheric haze, sky, soft snow, etc. Real saturated colors — NOT cream, NOT a vignette.`,
    `- Do NOT crop the character at the waist, chest, or hip to make room. Do NOT shrink them to a centered portrait above the band. The character can extend INTO this band — only avoid placing faces, hands, and key props inside it.`,
    `- A CSS gradient handles legibility on mobile, and the band is cropped out on desktop — so this is a gentle softening, not a hard fade.`,
    '',
    'No vignette mask, no soft borders on the other three sides, no fade-to-cream anywhere.',
  ].join('\n');

  // ── ASSEMBLE: Style → Scene → TextRef → Character → Props → Rules → Composition → LayoutMode ──
  // Style/medium FIRST — early tokens disproportionately shape rendering mode.
  // LayoutMode LAST — strongest signal for composition framing.
  const parts = [styleBlock, trimmedScene, textRef, characterBlock, propBlock, sceneRules, compositionBlock, layoutDirective].filter(Boolean);
  const fullPrompt = parts.join('\n\n');

  // ── DIAGNOSTIC LOG ──
  console.log(
    `[gpt_prompt_v6_extractor] page=${input.pageNumber} source=${sceneSource}` +
    (vd ? ` locationZone=${vd.locationZone} camera=${extractorCamera || 'rotation'}` +
          ` mustInclude=[${(vd.mustInclude ?? []).slice(0, 3).join(',')}]` +
          ` mustNotInclude=[${(vd.mustNotInclude ?? []).slice(0, 2).join(',')}]` : '') +
    ` sceneLen=${trimmedScene.length} finalLen=${fullPrompt.length}`
  );
  console.log(`[gpt_scene] page=${input.pageNumber} "${trimmedScene.slice(0, 200)}"`);
  // DEBUG: full prompt preview so user can see what gpt-image-1 actually receives.
  console.log(`[gpt_prompt_full] page=${input.pageNumber} ===PROMPT START===\n${fullPrompt}\n===PROMPT END===`);
  if (propParts.length > 0) {
    console.log(`[gpt_props] page=${input.pageNumber} injected=${propParts.length} props: ${propParts.map(p => p.split(':')[0]).join(', ')}`);
  }
  return fullPrompt;
}

function resolveStyle01Phase2ImageQuality(): 'low' | 'medium' | 'high' {
  if (isStyle01AuditionModeEnabled()) {
    return resolveStyle01AuditionImageQuality();
  }
  return resolveGPTBookQuality();
}

function resolveGPTBookQuality(): 'low' | 'medium' | 'high' {
  const q = process.env.GPT_IMAGE_QUALITY?.trim().toLowerCase();
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  // Unset → LOW (cost-safe). Production must set GPT_IMAGE_QUALITY=high explicitly.
  return 'low';
}

async function generateWithGPTImage(input: ImageInput): Promise<GeneratedImage> {
  const isPreview = !!input.isDirectionPreview;
  const hiResPdf = !!input.printPdfOptimized;
  // PORTRAIT ORIENTATION canvas (NOT composition style) — single image serves both desktop+PDF (crop out soft zone via CSS)
  // and mobile/video (show full image, text overlays soft zone).
  // The textZone soft band lives at the top or bottom 25%; the remaining 75% is the standalone scene.
  const size = hiResPdf ? '1536x1536' : isPreview ? '1024x1024' : '1024x1536';

  const quality = isPreview ? 'medium' : resolveGPTBookQuality();

  const entityPresence = deriveImageInputEntityPresence(input);
  const rawPrompt = buildGPTImagePrompt(input);
  const prompt = sanitizePromptForSafety(rawPrompt);
  const referenceImages = filterReferenceImagesForEntityPresence(
    input.referenceImages,
    entityPresence
  );

  console.log(
    `[gpt_image_prompt] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
    `isPreview=${isPreview} size=${size} quality=${quality} ` +
    `layout=${input.pageLayoutStyle ?? 'auto'} promptLen=${prompt.length} ` +
    `childPresence=${entityPresence.childPresence} refs=${referenceImages?.length ?? 0}`
  );

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await generateGPTImage({
        finalPrompt: prompt,
        negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border, sad face, gloomy, scary, dark moody atmosphere, crying, tearful, flat sad expression',
        size: size as '1024x1024' | '1024x1536' | '1536x1536',
        quality,
        referenceImages,
      });

      const durableUrl = await storeImageFromBuffer({
        buffer: result.buffer,
        orderId: input.orderId,
        pageNumber: input.pageNumber,
        assetType: input.assetType === 'cover' ? 'cover' : 'page',
        contentType: 'image/png',
      });

      console.log(
        `[gpt_image_done] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} model=${result.model} ` +
          `quality=${quality} size=${size} promptLen=${prompt.length} duration=${result.durationMs}ms ` +
          `hasReferencePhoto=${result.hasReferencePhoto} url=${durableUrl.slice(0, 80)}...`
      );

      // Parse actual dimensions from size string (e.g. "1024x1536")
      const [widthStr, heightStr] = size.split('x');
      return {
        url: durableUrl,
        rawUrl: durableUrl,
        width: parseInt(widthStr, 10),
        height: parseInt(heightStr, 10),
        provider: 'gpt-image-1',
        prompt,
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      lastError = error instanceof Error ? error : new Error(String(error));
      const errMsg = err?.message ?? String(error);

      if (errMsg.includes('content_policy_violation') || errMsg.includes('safety')) {
        console.warn(`[GPTImage] Content policy violation, not retrying: ${errMsg.slice(0, 200)}`);
        break;
      }

      if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`[GPTImage] Rate limited, waiting ${waitMs}ms before retry ${attempt}/3`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (errMsg.includes('401') || errMsg.includes('invalid_api_key')) {
        console.error(`[GPTImage] Auth error, not retrying: ${errMsg.slice(0, 200)}`);
        break;
      }

      if (attempt < 3) {
        console.warn(`[GPTImage] Error attempt ${attempt}/3: ${errMsg.slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error('GPT Image generation failed after retries');
}

/** Phase 2 — Style 02 book pages via gpt-image-2 + scene-typed style refs + character budget. */
async function generateWithGPTImageStyle02(input: ImageInput): Promise<GeneratedImage> {
  // Gap 2: hard fail if this Style 02 branch runs for a non-Style-02 order.
  assertPipelineStyleBranchMatchesOrder({
    orderIllustrationStyle: input.illustrationStyle,
    pipelineStyleBranch: 'style02',
    context: `generateWithGPTImageStyle02 orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber ?? '?'}`,
  });
  const hiResPdf = !!input.printPdfOptimized;
  const size = hiResPdf ? '1536x1536' : '1024x1536';
  const quality = resolveGPTBookQuality();
  const profile = resolveStyle02BookPromptProfile();

  const childVisualLock =
    profile === 'default'
      ? (input.style02ChildVisualLock ??
        buildStyle02ChildVisualLock({
          childName: input.childFirstName,
          childDescription: input.childDescription,
          childStructured: input.childStructured,
          childAge: input.childAge,
          childGender: input.childGender,
        }))
      : undefined;
  const wardrobeLock =
    profile === 'default'
      ? (input.style02WardrobeLock ?? buildStyle02WardrobeLock({ childStructured: input.childStructured }))
      : undefined;
  const companionTextLock =
    profile === 'default'
      ? (input.style02CompanionTextLock ??
        (input.companion
          ? buildStyle02CompanionTextLock({
              companionId: input.companion.id,
              companionName: input.companion.name,
              companionStructured: input.companionStructured,
              companionVisualDescription: input.companion.visualDescription,
            })
          : ''))
      : undefined;

  const sceneClass = classifyStyle02SceneClass({
    imagePrompt: input.pagePrompt,
    bookPageText: input.bookPageText ?? undefined,
    environment: input.pageStoryboard?.environment,
    lighting: input.pageStoryboard?.lighting,
  });
  const subsetKey = resolveStyle02SubsetKey(sceneClass);
  const refConfig = resolveStyle02RefBudgetConfig();
  const styleRefCount = refConfig === 'A' ? 2 : 3;
  const styleRefPaths = resolveStyle02StyleReferencePaths(subsetKey, styleRefCount);
  const childPhotoPath = input.referenceImages?.[0];
  const companionRefPath = resolveCompanionReferencePath(input.companion?.image ?? null);
  const otherCharacterRefPaths = (input.anchorCharacters ?? [])
    .filter(
      (entry) =>
        entry.anchorImageUrl &&
        entry.characterId !== 'child' &&
        !entry.characterId.startsWith('companion:')
    )
    .map((entry) => entry.anchorImageUrl);
  const { paths: referenceImages, breakdown } = assembleStyle02BookReferences({
    styleRefPaths,
    childPhotoPath: refConfig === 'C' ? undefined : childPhotoPath,
    companionRefPath: refConfig === 'B' ? undefined : companionRefPath,
    otherCharacterRefPaths,
    config: refConfig,
  });

  const vd = input.visualDirection;
  const mechanicalScene = input.blocking
    ? renderSceneBlockingForPrompt(input.blocking, vd ?? null)
    : vd
      ? [
          `Location: ${vd.locationZone}.`,
          `Action: ${vd.mainAction}.`,
          vd.characterPose ? `Pose: ${vd.characterPose}.` : '',
          vd.lightingSource ? `Lighting: ${vd.lightingSource}.` : '',
          vd.environmentDetail ? `Detail: ${vd.environmentDetail}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : '';
  const rawScene = (input.rawScenePrompt ?? '').trim();
  const fallbackScene = extractSceneCore(input.pagePrompt || '').trim();
  const sceneDescription = sanitizeSceneTextForSingleMoment(
    (mechanicalScene || rawScene || fallbackScene).trim()
  );

  const bedtimeMedicalTone = shouldInjectBedtimeMedicalTone({
    directionArchetype: input.directionArchetype,
    challengeCategory: input.challengeCategory,
    sceneClass,
  });

  let guardedV2Debug: GuardedV2PageDebug | undefined;
  let guardedV2PromptOverride: string | undefined;

  if (profile === 'guarded-v2') {
    const spec = resolveGuardedV2SpecForPage(input.pageNumber, {
      bookPageText: input.bookPageText,
      sceneClass,
      imageIntent: input.rawScenePrompt ?? input.pagePrompt,
      companionId: input.companion?.id ?? null,
      recipeId: input.guardedV2RecipeId ?? null,
    });
    const assembled = assembleGuardedV2PagePrompt({
      sceneDescription,
      spec,
      bedtimeMedicalTone,
      bedtimeMedicalToneBlock: STYLE_02_BEDTIME_MEDICAL_TONE,
      strictFramingWarnings: process.env.GUARDED_V2_STRICT_FRAMING === 'true',
    });
    guardedV2PromptOverride = assembled.prompt;
    guardedV2Debug = assembled.debug;
    for (const w of assembled.warnings) {
      console.warn(`[guarded-v2] ${w}`);
    }
  }

  const finalPrompt = buildStyle02BookPagePrompt({
    sceneDescription,
    profile,
    bedtimeMedicalTone,
    closeUpRule: profile === 'guarded-v1' && isStyle02CloseUpScene(sceneDescription),
    guardedV2PromptOverride,
    ...(profile === 'default' ? { childVisualLock, wardrobeLock, companionTextLock } : {}),
  });
  const prompt = sanitizePromptForSafety(finalPrompt);

  console.log(
    `[style02_phase2] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
      `subset=${subsetKey} refConfig=${refConfig} sceneClass=${sceneClass} ` +
      `refs=${referenceImages.length} breakdown=${JSON.stringify({
        child: breakdown.child.length,
        companion: breakdown.companion.length,
        otherCharacters: (breakdown.otherCharacters ?? []).length,
        style: breakdown.style.length,
      })}`
  );
  console.log(
    `[style02_refs] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
      `characterRefs=${JSON.stringify([
        ...breakdown.child,
        ...breakdown.companion,
        ...(breakdown.otherCharacters ?? []),
      ])} ` +
      `styleRefs=${JSON.stringify(breakdown.style)} ` +
      `finalOrder=${JSON.stringify(referenceImages)}`
  );

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_02_AVOIDANCE_NEGATIVE,
    referenceImages,
    referenceMode: 'style02_book',
    requireReferenceEdit: true,
    size: size as '1024x1024' | '1024x1536' | '1536x1536',
    quality,
    modelOverride: STYLE_02_GPT_MODEL,
  });

  if (result.model !== STYLE_02_GPT_MODEL) {
    throw new Error(
      `[style02_phase2] BLOCKER: expected model ${STYLE_02_GPT_MODEL}, got ${result.model}. No silent fallback.`
    );
  }
  if (result.fallbackUsed) {
    throw new Error('[style02_phase2] BLOCKER: fallbackUsed=true');
  }

  const manifestSnippet = {
    pageNumber: input.pageNumber,
    model: result.model,
    apiMode: result.apiMode,
    quality,
    size,
    refsRequested: result.referenceCountRequested,
    refsPassed: result.referenceCountPassed,
    fallbackUsed: result.fallbackUsed,
    referenceBreakdown: breakdown,
    styleSubset: subsetKey,
    refConfig,
    promptProfile: profile,
    guardedV2: guardedV2Debug,
    durationMs: result.durationMs,
    usage: result.usage,
    responseMeta: result.responseMeta,
  };
  console.log(`[style02_phase2_manifest] ${JSON.stringify(manifestSnippet)}`);

  const durableUrl = await storeImageFromBuffer({
    buffer: result.buffer,
    orderId: input.orderId,
    pageNumber: input.pageNumber,
    assetType: input.assetType === 'cover' ? 'cover' : 'page',
    contentType: 'image/png',
  });

  const [widthStr, heightStr] = size.split('x');
  return {
    url: durableUrl,
    rawUrl: durableUrl,
    width: parseInt(widthStr, 10),
    height: parseInt(heightStr, 10),
    provider: result.model,
    prompt,
    style02Meta: {
      pageIndex: input.pageNumber ?? 0,
      sceneText: sceneDescription,
      sceneClass,
      referenceBreakdown: breakdown,
      fallbackUsed: result.fallbackUsed,
      model: result.model,
      refConfig,
      styleSubset: subsetKey,
      usage: result.usage ?? null,
      promptProfile: profile,
      guardedV2: guardedV2Debug,
    },
  };
}

/** Phase 2 — Style 01 book pages via gpt-image-2 (STYLE_01_GPT_MODEL) + scene-typed style refs. */
async function patchPageRefManifestQa(input: {
  orderId?: string;
  pageNumber?: number;
  pageVisualQa: NonNullable<Style01PageMeta['pageVisualQa']>;
}): Promise<void> {
  const manifestDir = process.env.PAGE_REF_MANIFEST_DIR?.trim();
  if (!manifestDir || !input.orderId || input.pageNumber == null) return;
  const fs = await import('fs');
  const pathMod = await import('path');
  const manifestPath = pathMod.join(manifestDir, `page-${input.pageNumber}.json`);
  if (!fs.existsSync(manifestPath)) return;
  try {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ ...existing, pageVisualQa: input.pageVisualQa }, null, 2)
    );
  } catch {
    /* ignore manifest patch errors */
  }
}

async function generateWithGPTImageStyle01Phase2(input: ImageInput): Promise<GeneratedImage> {
  // Gap 2: hard fail if this Style 01 branch runs for a non-Style-01 order.
  assertPipelineStyleBranchMatchesOrder({
    orderIllustrationStyle: input.illustrationStyle,
    pipelineStyleBranch: 'style01',
    context: `generateWithGPTImageStyle01Phase2 orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber ?? '?'}`,
  });
  const qaConfig = resolvePageVisualQaConfig();
  let compositionStrictRetry = input.compositionStrictRetry ?? false;
  let timeOfDayStrictRetry = input.timeOfDayStrictRetry ?? false;
  let regenAttempts = 0;
  let last: GeneratedImage | null = null;

  while (true) {
    last = await generateWithGPTImageStyle01Phase2Once({
      ...input,
      compositionStrictRetry,
      timeOfDayStrictRetry,
    });
    if (!qaConfig.enabled) return last;

    const entityPresence = deriveImageInputEntityPresence(input);
    const expectsChild = entityPresence.childPresence === 'present';
    const expectsCompanion = entityPresence.companionPresence === 'present';
    const structuredCtx = {
      imagePrompt: input.rawScenePrompt ?? input.pagePrompt ?? undefined,
      bookPageText: input.bookPageText ?? undefined,
      rawScenePrompt: input.rawScenePrompt ?? undefined,
    };
    const hasStructuredObjects = sceneHasStructuredObjects(structuredCtx);
    const hasRailedBedOrCrib = sceneHasRailedBedOrCrib(structuredCtx);
    const isEmotionalClosing = isEmotionalClosingBeat({
      pageNumber: input.pageNumber,
      totalPages: input.totalPages,
      imagePrompt: input.pagePrompt ?? undefined,
      bookPageText: input.bookPageText ?? undefined,
    });
    const { pageHasHumanFamily } = await import('../../lib/family-coherence');
    const hasHumanFamily = pageHasHumanFamily({
      bookPageText: input.bookPageText,
      imageDirection: input.rawScenePrompt ?? input.pagePrompt,
      rawScenePrompt: input.rawScenePrompt,
      pagePrompt: input.pagePrompt,
      presentEntityIds: input.pageStoryState?.presentEntities,
    });
    const effectivePageTimeOfDay =
      last.style01Meta?.effectivePageTimeOfDay ?? input.effectivePageTimeOfDay ?? null;
    const qa = await evaluatePageVisualQa({
      imageUrl: last.url,
      expectsChild,
      expectsCompanion,
      expectedPageTimeOfDay: effectivePageTimeOfDay,
      isEmotionalClosing,
      hasStructuredObjects,
      hasRailedBedOrCrib,
      hasHumanFamily,
    });

    const needsHumanReview = !qa.passed && regenAttempts >= qaConfig.maxRegens;
    const enriched: GeneratedImage = {
      ...last,
      style01Meta: {
        ...last.style01Meta!,
        pageVisualQa: {
          passed: qa.passed,
          reason: qa.reason,
          details: qa.details,
          regenAttempts,
          timeOfDayOk: qa.flags.timeOfDayOk,
          companionSilhouetteOk: qa.flags.companionSilhouetteOk,
        },
        needsHumanReview,
      },
    };

    if (qa.passed || regenAttempts >= qaConfig.maxRegens) {
      if (needsHumanReview) {
        console.warn(
          `[page_visual_qa] FLAG_HUMAN_REVIEW orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
            `reason=${qa.reason} details=${qa.details} regenAttempts=${regenAttempts}`
        );
      }
      await patchPageRefManifestQa({
        orderId: input.orderId,
        pageNumber: input.pageNumber,
        pageVisualQa: enriched.style01Meta!.pageVisualQa!,
      });
      return enriched;
    }

    console.log(
      `[page_visual_qa] regen orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
        `reason=${qa.reason} attempt=${regenAttempts + 1}/${qaConfig.maxRegens} details=${qa.details}`
    );
    regenAttempts += 1;
    if (qa.reason === 'time_of_day_mismatch') {
      timeOfDayStrictRetry = true;
    } else {
      compositionStrictRetry = true;
    }
  }
}

async function generateWithGPTImageStyle01Phase2Once(input: ImageInput): Promise<GeneratedImage> {
  const hiResPdf = !!input.printPdfOptimized;
  const size = hiResPdf ? '1536x1536' : '1024x1536';
  const quality = resolveStyle01Phase2ImageQuality();

  const vd = input.visualDirection;
  const mechanicalScene = input.blocking
    ? renderSceneBlockingForPrompt(input.blocking, vd ?? null)
    : vd
      ? [
          `Location: ${vd.locationZone}.`,
          `Action: ${vd.mainAction}.`,
          vd.characterPose ? `Pose: ${vd.characterPose}.` : '',
          vd.lightingSource ? `Lighting: ${vd.lightingSource}.` : '',
          vd.environmentDetail ? `Detail: ${vd.environmentDetail}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : '';

  const childRefPath = input.referenceImages?.[0];
  const useCanonicalChildAnchorRef =
    !!childRefPath &&
    (childRefPath.includes('/character-anchors/') ||
      childRefPath.includes('character-anchors%2F'));

  const assembled = assembleStyle01Phase2Prompt({
    pageNumber: input.pageNumber ?? 0,
    totalPages: input.totalPages,
    pagePrompt: input.pagePrompt,
    rawScenePrompt: input.rawScenePrompt,
    mechanicalScene: mechanicalScene || undefined,
    bookPageText: input.bookPageText,
    childFirstName: input.childFirstName,
    childAge: input.childAge,
    childGender: input.childGender,
    childDescription: input.childDescription,
    childStructured: input.childStructured,
    companion: input.companion,
    companionStructured: input.companionStructured,
    pageStoryState: input.pageStoryState,
    useCanonicalChildAnchorRef,
    storyRecurringEntityDeclarations: input.storyRecurringEntityDeclarations,
    compositionStrictRetry: input.compositionStrictRetry,
    timeOfDayStrictRetry: input.timeOfDayStrictRetry,
    storyTimeOfDay: input.storyTimeOfDay,
    pageTimeOfDayOverrides: input.pageTimeOfDayOverrides,
    familyCoherence: input.familyCoherence ?? null,
    challengeCategory: input.challengeCategory ?? null,
    // Close-up wording survives when BookShotPlan or storyboard chose close_up.
    explicitCloseUp:
      input.pageShot?.shot === 'close_up' || input.pageStoryboard?.shotType === 'close_up',
    pageShot: input.pageShot ?? null,
    locationBible: input.locationBible ?? null,
    pageLocationPlan: input.pageLocationPlan ?? null,
    assetType: input.assetType,
    storyTitle: input.storyTitle,
    coverText: input.coverText,
    topicLabel: input.topicLabel,
    coverSceneHint: input.coverSceneHint,
  });

  const {
    prompt: finalPrompt,
    sceneDescription,
    sceneClass,
    entityPresence,
    pageStoryState,
    storyTimeOfDay,
    effectivePageTimeOfDay,
  } = assembled;

  const refConfig = resolveStyle01RefBudgetConfig();
  const companionRefPaths =
    entityPresence.companionPresence === 'absent'
      ? []
      : resolveStyle01CompanionReferencePaths({
          companionId: input.companion?.id,
          companionImage: input.companion?.image,
          presentEntities: pageStoryState?.presentEntities,
          companionPresence: entityPresence.companionPresence,
          pageNumber: input.pageNumber,
          imagePrompt: input.pagePrompt,
          bookPageText: input.bookPageText ?? undefined,
          rawScenePrompt: input.rawScenePrompt ?? undefined,
        });
  const companionViewIntent = resolveCompanionViewIntentForPage({
    pageNumber: input.pageNumber,
    imagePrompt: input.pagePrompt,
    bookPageText: input.bookPageText ?? undefined,
    rawScenePrompt: input.rawScenePrompt ?? undefined,
    companionPresence: entityPresence.companionPresence,
  });
  const useMultiCompanionSheets = companionRefPaths.length >= 3;
  const styleRefCount = useMultiCompanionSheets ? 1 : refConfig === 'A' ? 2 : 3;
  const styleRefPaths = resolveStyle01StyleReferencePaths(sceneClass, styleRefCount);
  const childPhotoPath = input.referenceImages?.[0];
  const otherCharacterRefPaths = (input.anchorCharacters ?? [])
    .filter(
      (entry) =>
        entry.anchorImageUrl &&
        entry.characterId !== 'child' &&
        !entry.characterId.startsWith('companion:')
    )
    .map((entry) => entry.anchorImageUrl);
  const { paths: referenceImages, breakdown } = assembleStyle01BookReferencesWithZoneSheets({
    styleRefPaths,
    childPhotoPath: refConfig === 'C' ? undefined : childPhotoPath,
    companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
    otherCharacterRefPaths,
    config: refConfig,
    includeChildPhoto: childPresenceAllowsReferencePhoto(entityPresence.childPresence),
    useMultiCompanionSheets,
    isolatedObjectRefPaths: input.pageLocationPlan?.referenceSheets?.isolatedObjectPaths,
  });

  const prompt = sanitizePromptForSafety(finalPrompt);

  console.log(
    `[style01_phase2] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
      `sceneClass=${sceneClass} refConfig=${refConfig} childPresence=${entityPresence.childPresence} ` +
      `refs=${referenceImages.length} breakdown=${JSON.stringify({
        child: breakdown.child.length,
        companion: breakdown.companion.length,
        zoneSet: (breakdown.zoneSet ?? []).length,
        objectAnchors: (breakdown.objectAnchors ?? []).length,
        isolatedObjects: (breakdown.isolatedObjects ?? breakdown.objectAnchors ?? []).length,
        otherCharacters: (breakdown.otherCharacters ?? []).length,
        style: breakdown.style.length,
      })}`
  );
  const characterRefPaths = [
    ...breakdown.child,
    ...breakdown.companion,
    ...(breakdown.zoneSet ?? []),
    ...(breakdown.objectAnchors ?? []),
    ...(breakdown.otherCharacters ?? []),
  ];
  console.log(
    `[style01_refs] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
      `characterRefs=${JSON.stringify(characterRefPaths)} ` +
      `isolatedObjectRefs=${JSON.stringify(breakdown.isolatedObjects ?? breakdown.objectAnchors ?? [])} ` +
      `styleRefs=${JSON.stringify(breakdown.style)} ` +
      `finalOrder=${JSON.stringify(referenceImages)} ` +
      `canonicalAnchorRef=${useCanonicalChildAnchorRef}`
  );
  const manifestDir = process.env.PAGE_REF_MANIFEST_DIR?.trim();
  if (manifestDir && input.orderId && input.pageNumber != null) {
    const fs = await import('fs');
    const pathMod = await import('path');
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = pathMod.join(manifestDir, `page-${input.pageNumber}.json`);
    const companionSheetView =
      breakdown.companion[0]?.includes('style01-sheets')
        ? breakdown.companion[0].replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? null
        : null;
    const companionSheetViewKind = companionSheetView
      ? resolveCompanionSheetViewForPage({
          pageNumber: input.pageNumber,
          imagePrompt: input.pagePrompt,
          bookPageText: input.bookPageText ?? undefined,
          rawScenePrompt: input.rawScenePrompt ?? undefined,
          companionPresence: entityPresence.companionPresence,
        })
      : null;
    const expectedSheetFilename =
      companionSheetViewKind != null
        ? COMPANION_SHEET_VIEW_FILENAME[companionSheetViewKind]
        : null;
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          orderId: input.orderId,
          pageNumber: input.pageNumber,
          canonicalAnchorRef: useCanonicalChildAnchorRef,
          childExpressionKind: input.childExpressionAnchorKind ?? null,
          characterRefs: characterRefPaths,
          zoneSetRefs: breakdown.zoneSet ?? [],
          objectAnchorRefs: breakdown.objectAnchors ?? [],
          isolatedObjectRefs: breakdown.isolatedObjects ?? breakdown.objectAnchors ?? [],
          styleRefs: breakdown.style,
          finalOrder: referenceImages,
          refConfig,
          locationZoneId: input.pageLocationPlan?.zoneId ?? null,
          pageAction: input.pageLocationPlan?.pageAction ?? null,
          expectedBucketVisibility: input.pageLocationPlan?.expectedBucketVisibility ?? null,
          zoneObjectRefsAttached: Boolean(
            (breakdown.isolatedObjects ?? breakdown.objectAnchors ?? []).length
          ),
          sceneClass,
          storyTimeOfDay,
          effectivePageTimeOfDay,
          companionPresence: entityPresence.companionPresence,
          companionViewIntent,
          companionSheetView,
          companionSheetViewKind,
          companionViewMatchesSheet:
            expectedSheetFilename != null && companionSheetView != null
              ? companionSheetView === expectedSheetFilename.replace(/\.png$/i, '') ||
                companionSheetView === expectedSheetFilename
              : null,
        },
        null,
        2
      )
    );
  }
  console.log(`[style01_phase2_prompt] page=${input.pageNumber} ===PROMPT START===\n${prompt}\n===PROMPT END===`);

  const style01Model = resolveStyle01GptModel();

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
    referenceImages,
    referenceMode: 'style02_book',
    requireReferenceEdit: referenceImages.length > 0,
    size: size as '1024x1024' | '1024x1536' | '1536x1536',
    quality,
    modelOverride: style01Model,
  });

  if (result.model !== style01Model) {
    throw new Error(
      `[style01_phase2] BLOCKER: expected model ${style01Model}, got ${result.model}. No silent fallback.`
    );
  }

  const manifestSnippet = {
    pageNumber: input.pageNumber,
    model: result.model,
    entityPresence,
    sceneClass,
    refConfig,
    referenceBreakdown: breakdown,
    promptLen: prompt.length,
    durationMs: result.durationMs,
  };
  console.log(`[style01_phase2_manifest] ${JSON.stringify(manifestSnippet)}`);

  const durableUrl = await storeImageFromBuffer({
    buffer: result.buffer,
    orderId: input.orderId,
    pageNumber: input.pageNumber,
    assetType: input.assetType === 'cover' ? 'cover' : 'page',
    contentType: 'image/png',
  });

  const [widthStr, heightStr] = size.split('x');
  return {
    url: durableUrl,
    rawUrl: durableUrl,
    width: parseInt(widthStr, 10),
    height: parseInt(heightStr, 10),
    provider: result.model,
    prompt,
    style01Meta: {
      pageIndex: input.pageNumber ?? 0,
      sceneText: sceneDescription,
      sceneClass,
      entityPresence,
      referenceBreakdown: breakdown,
      model: result.model,
      refConfig,
      usage: result.usage ?? null,
      durationMs: result.durationMs,
      storyTimeOfDay,
      effectivePageTimeOfDay,
      companionViewIntent,
    },
  };
}

// ─── Provider: DALL-E 3 ───────────────────────────────
async function generateWithDallE(input: ImageInput): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const useVd = isVisualDirectorEnabledForInput(input);
  const parts = useVd ? null : await buildPromptParts(input);
  const cv = parts?.compositionVariation ?? getCompositionVariation(input.pageNumber);
  console.log(
    `[ImageComposition] Page ${input.pageNumber}/${input.totalPages} — ` +
      `type=${cv.compositionType} ` +
      `cameraDistance=${cv.cameraDistance} ` +
      `cameraAngle=${cv.cameraAngle} ` +
      `characterPose=${cv.characterPose} ` +
      `interactionType=${cv.interactionType}` +
      (useVd ? ' | visualDirector=on' : '')
  );

  let prompt: string;
  if (useVd) {
    const vd = composeVisualDirectorPrompt(buildVisualDirectorModelInput(input));
    const fluxBody = prependFluxHardLocksAndComposition(vd.finalPrompt, input);
    console.log(
      `[VisualDirector] enabled=true orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
        `promptHead: ${fluxBody.slice(0, 200)}`
    );
    prompt = withConsistencyReinforcement(
      fluxBody,
      (input.anchorCharacters ?? []).map((entry) => ({ name: entry.name, anchorImageUrl: entry.anchorImageUrl }))
    );
  } else {
    prompt = await assembleImagePrompt(input);
  }
  console.log(
    `[Image] Page ${input.pageNumber}/${input.totalPages} — DALL-E prompt (first 220):\n` +
    prompt.slice(0, 220)
  );
  const styleId = parts?.styleId ?? normalizeStyleId(input.illustrationStyle);
  const dallEAspect = input.isDirectionPreview ? '1:1' : '2:3';
  console.log(
    `[image_pipeline_path] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber}/${input.totalPages} path=${useVd ? 'visual_director' : 'legacy'} postProcess=${isPresentationPostProcessEnabled() ? 'on' : 'off'} styleId=${styleId} model=dall-e-3 aspectRatio=${dallEAspect}`
  );
  if (input.assetType === 'cover') {
    const coverStyleId = normalizeStyleId(input.illustrationStyle);
    const styleBlockLen = getStyleContract(input.illustrationStyle).optionBlock.length;
    const matchesInteriorPath = Boolean(input.styleLock && input.heroVisualLock);
    console.log(
      `[cover_style_alignment] orderId=${input.orderId ?? 'unknown'} styleId=${coverStyleId} styleBlockLen=${styleBlockLen} matchesInteriorPath=${matchesInteriorPath}`,
    );
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:           'dall-e-3',
      prompt,
      n:               1,
      size:            input.isDirectionPreview ? '1024x1024' : '1024x1792',
      quality:         'standard',
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E image error (page ${input.pageNumber}): ${res.status} ${err}`);
  }

  const data   = await res.json() as DallEImageResponse;
  const rawUrl = data.data[0].url;
  const durableUrl = await storeImageFromProviderUrl({
    providerUrl: rawUrl,
    orderId: input.orderId,
    pageNumber: input.pageNumber,
    assetType: input.assetType ?? 'page',
  });

  console.log(`[Image] Page ${input.pageNumber} — DALL-E succeeded`);

  return {
    url:      durableUrl,
    rawUrl,
    width:    1024,
    height:   input.isDirectionPreview ? 1024 : 1792,
    provider: 'dall-e-3',
    prompt,
  };
}

// ─── Provider: Replicate ───────────────────────────────
async function generateWithReplicate(input: ImageInput): Promise<GeneratedImage> {
  const useVd = isVisualDirectorEnabledForInput(input);
  const useCleanFlux = !useVd && isFluxCleanPromptEnabled();
  let parts: Awaited<ReturnType<typeof buildPromptParts>> | Awaited<ReturnType<typeof buildFluxCleanPromptParts>> | null =
    null;
  if (useVd) {
    parts = null;
  } else if (useCleanFlux) {
    if (!input.pageStoryboard) {
      throw new Error(
        `[flux_clean_prompt] pageStoryboard is required on ImageInput when FLUX_CLEAN_PROMPT=on (page ${input.pageNumber})`
      );
    }
    parts = await buildFluxCleanPromptParts({ ...input, pageStoryboard: input.pageStoryboard });
  } else {
    parts = await buildPromptParts(input);
  }
  const cv =
    'compositionVariation' in (parts ?? {})
      ? (parts as Awaited<ReturnType<typeof buildPromptParts>>).compositionVariation
      : getCompositionVariation(input.pageNumber);
  const modelMode = resolveImageModelMode();
  const expectedModel = resolveReplicateImageModel(input.modelOverride);
  console.log(
    `[ImageComposition] Page ${input.pageNumber}/${input.totalPages} — ` +
      `type=${cv.compositionType} ` +
      `cameraDistance=${cv.cameraDistance} ` +
      `cameraAngle=${cv.cameraAngle} ` +
      `characterPose=${cv.characterPose} ` +
      `interactionType=${cv.interactionType}` +
      (useVd ? ' | visualDirector=on' : '')
  );
  let finalPromptForReplicate: string;
  let negativePromptForReplicate: string;
  if (useVd) {
    const vd = composeVisualDirectorPrompt(buildVisualDirectorModelInput(input));
    finalPromptForReplicate = prependFluxHardLocksAndComposition(vd.finalPrompt, input);
    console.log(
      `[VisualDirector] enabled=true orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} ` +
        `promptHead: ${finalPromptForReplicate.slice(0, 200)}`
    );
    negativePromptForReplicate = vd.negativePrompt;
  } else {
    finalPromptForReplicate = parts!.finalPrompt;
    negativePromptForReplicate = parts!.negativePrompt;
  }
  negativePromptForReplicate = `${negativePromptForReplicate}, ${STRICT_NEGATIVE_PROMPT}`;
  console.log('[image_prompt_final]', finalPromptForReplicate);
  if (input.isDirectionPreview) {
    const previewStyleLockPrefix = buildDirectionPreviewStyleLockPrefix(input.illustrationStyle);
    finalPromptForReplicate = `${previewStyleLockPrefix}\n${finalPromptForReplicate}`;
  }
  if (input.totalPages === 3) {
    console.info('[DirPreviewDebug][ReplicatePrompt]', {
      orderId: input.orderId ?? 'unknown',
      pageNumber: input.pageNumber,
      startsWithStyleLock: finalPromptForReplicate.startsWith('STYLE_LOCK'),
      startsWithStyleContract: finalPromptForReplicate.startsWith('STYLE_CONTRACT: STYLE_SELECTION_SYSTEM'),
      hasStyleLockAnywhere: finalPromptForReplicate.includes('STYLE_LOCK'),
      hasStyleSelectionSystemAnywhere: finalPromptForReplicate.includes('STYLE_SELECTION_SYSTEM'),
      promptHead700: finalPromptForReplicate.slice(0, 700),
    });
  }
  console.log('[image_reference_provider]', {
    page: input.pageNumber,
    referenceImageExists: Boolean(input.referenceImages && input.referenceImages.length > 0),
    providerReceivesReferenceImages: Boolean(input.referenceImages && input.referenceImages.length > 0),
    providerReferenceImageCount: input.referenceImages?.length ?? 0,
  });
  console.log('[image_negative_prompt_final]', negativePromptForReplicate);
  const styleId = parts?.styleId ?? normalizeStyleId(input.illustrationStyle);
  const replicateAspectRatio = input.isDirectionPreview ? '1:1' : '2:3';
  console.log(
    `[image_pipeline_path] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber}/${input.totalPages} path=${useVd ? 'visual_director' : useCleanFlux ? 'flux_clean' : 'legacy'} postProcess=${isPresentationPostProcessEnabled() ? 'on' : 'off'} styleId=${styleId} model=${expectedModel} aspectRatio=${replicateAspectRatio}`
  );
  // Resolve LoRA params from style
  const loraStyle = getStyleContract(input.illustrationStyle);
  if (input.assetType === 'cover') {
    const coverStyleId = normalizeStyleId(input.illustrationStyle);
    const styleBlockLen = getStyleContract(input.illustrationStyle).optionBlock.length;
    const matchesInteriorPath = Boolean(input.styleLock && input.heroVisualLock);
    console.log(
      `[cover_style_alignment] orderId=${input.orderId ?? 'unknown'} styleId=${coverStyleId} styleBlockLen=${styleBlockLen} matchesInteriorPath=${matchesInteriorPath}`,
    );
  }
  const result = await generateReplicateImage({
    finalPrompt: finalPromptForReplicate,
    negativePrompt: negativePromptForReplicate,
    referenceImages: input.referenceImages,
    modelOverride: input.modelOverride,
    seed: input.seed,
    aspectRatio: replicateAspectRatio,
    styleId: styleId,
  });

  if (modelMode === 'development') {
    if (replicateModelBaseSlug(result.model) !== replicateModelBaseSlug(expectedModel)) {
      throw new Error(
        `[ImageGuard] Development mode expected model ${expectedModel} but got ${result.model}`
      );
    }
    console.warn('[ImageGuard] Development model in use', {
      mode: modelMode,
      expectedModel,
      model: result.model,
      orderId: input.orderId ?? 'unknown',
      pageNumber: input.pageNumber,
    });
  }

  const promptPreview = result.finalPrompt.replace(/\s+/g, ' ').slice(0, 180);
  console.log(
    `[Image] Page ${input.pageNumber}/${input.totalPages} — style=${styleId} | model=${result.model} | promptLen=${result.finalPrompt.length} | outputCount=${result.outputCount} | preview="${promptPreview}" | url=${result.imageUrl}`
  );

  let durableUrl = result.imageUrl;
  try {
    durableUrl = await storeImageFromProviderUrl({
      providerUrl: result.imageUrl,
      orderId: input.orderId,
      pageNumber: input.pageNumber,
      assetType: input.assetType ?? 'page',
    });
  } catch (error) {
    console.warn(
      `[image_storage] Supabase persist failed (non-fatal) orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber}: ${
        error instanceof Error ? error.message : String(error)
      } — using provider URL`
    );
  }

  return {
    url:      durableUrl,
    rawUrl:   result.imageUrl,
    width:    1024,
    height:   input.isDirectionPreview ? 1024 : 1536,
    provider: result.model,
    prompt:   result.finalPrompt,
  };
}

// ─── Main Entry Point ─────────────────────────────────
export async function generateImage(input: ImageInput): Promise<GeneratedImage> {
  if (shouldUseStyle02Phase2Path(input.illustrationStyle)) {
    return generateWithGPTImageStyle02(input);
  }
  if (shouldUseStyle01Phase2Path(input.illustrationStyle)) {
    return generateWithGPTImageStyle01Phase2(input);
  }
  assertShippedBookStyleEngineActive(input.illustrationStyle);
  if (isImageGenerationDisabled()) {
    console.warn(
      `[ImageGuard] Mock image returned orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} route=provider reason=DISABLE_IMAGE_GENERATION`
    );
    return buildMockImageResult(input);
  }
  const provider = normalizeImageProviderEnv();
  if (provider === 'replicate' && !hasLoggedReplicateConfig) {
    hasLoggedReplicateConfig = true;
    const mode = resolveImageModelMode();
    const resolvedModel = resolveReplicateImageModel();
    console.info(`[ImageConfig] provider=replicate mode=${mode} model=${resolvedModel}`);
  }
  if (provider === 'gpt-image' && !hasLoggedGptImageConfig) {
    hasLoggedGptImageConfig = true;
    console.info(`[ImageConfig] provider=gpt-image bookQualityEnv=${resolveGPTBookQuality()}`);
  }
  if (provider === 'dall-e-3' && input.referenceImages && input.referenceImages.length > 0) {
    throw new Error('DALL-E cannot be used when child reference images are provided');
  }
  const modelMode = resolveImageModelMode();
  if (modelMode === 'development' && provider !== 'replicate' && provider !== 'gpt-image') {
    const forcedDevModel = resolveReplicateImageModel();
    throw new Error(
      `[ImageGuard] Development mode requires replicate provider for ${forcedDevModel}, got IMAGE_PROVIDER=${provider}`
    );
  }

  switch (provider) {
    case 'replicate':
      return generateWithReplicate(input);
    case 'gpt-image':
      return generateWithGPTImage(input);
    case 'dall-e-3':
    default:
      return generateWithDallE(input);
  }
}

function buildCoverPrompt(input: CoverImageInput): string {
  const characterLockLead = buildImageHardLockBlock({
    heroVisualLock: input.heroVisualLock,
    childFirstName: input.childName,
    characterSheet: input.characterSheet,
    childDescription: input.childDescription,
    entityVisualLock: input.entityVisualLock ?? undefined,
    companion: undefined,
    bookPageText: '',
    orderId: input.orderId,
    pageNumber: 0,
  });
  const protagonistLock = '';
  const entityLock = input.entityVisualLock
    ? `Companion: ${input.entityVisualLock.shape}, ${input.entityVisualLock.color}, ${input.entityVisualLock.proportions}`
    : '';
  const coverTextZone =
    'Reserve the top 25-35% of the frame as a calm, low-detail area for title overlay. No faces, hands, or focal elements in this zone.';
  const coverSceneParts = [
    `Book cover scene: ${input.storyTitle}.`,
    input.coverText ? `Story hook: ${input.coverText}.` : '',
    `Topic: ${input.topicLabel}.`,
    'Opening moment of the story. Warm, inviting, emotionally readable.',
  ];
  const directionLine = buildImageStoryDirectionLine({
    directionArchetype: input.directionArchetype,
    directionEmotionalLabel: input.directionEmotionalLabel,
    directionStoryPremise: input.directionStoryPremise,
  });
  if (directionLine) {
    coverSceneParts.push(directionLine);
  }
  const coverScene = coverSceneParts.filter(Boolean).join(' ');
  const result = buildImagePrompt({
    styleIdInput: input.illustrationStyle,
    sceneDescription: coverScene,
    textZoneDirective: coverTextZone,
    protagonistLock,
    entityLock,
    characterLockLead,
    globalNegativeConstraints: [NO_TEXT_LOCK],
  });
  const coverPrompt = result.finalPrompt;
  const coverWords = coverPrompt.split(/\s+/).filter(Boolean).length;
  console.log(`[cover_prompt_compact] orderId=${input.orderId ?? 'unknown'} words=${coverWords} chars=${coverPrompt.length}`);
  return coverPrompt;
}

export async function generateBookCover(input: CoverImageInput): Promise<GeneratedImage> {
  assertShippedBookStyleEngineActive(input.illustrationStyle);

  const useStyle01 = shouldUseStyle01Phase2Path(input.illustrationStyle);
  const pagePrompt = useStyle01 ? '' : buildCoverPrompt(input);
  return generateImage({
    pagePrompt,
    illustrationStyle: input.illustrationStyle,
    childDescription: input.childDescription,
    characterSheet: input.characterSheet,
    referenceImages: input.referenceImages,
    modelOverride: input.modelOverride,
    orderId: input.orderId,
    pageNumber: 0,
    totalPages: 1,
    assetType: 'cover',
    childFirstName: input.childName,
    childAge: input.childAge,
    childGender: input.childGender,
    childStructured: input.childStructured,
    companionStructured: input.companionStructured,
    storyTitle: input.storyTitle,
    coverText: input.coverText,
    topicLabel: input.topicLabel,
    coverSceneHint: input.coverSceneHint,
    // Cover shares the SAME reference-assembly path as pages: companion id+image
    // let the style01 path resolve the published character sheet for the cover too.
    companion: (input.companion ?? null) as unknown as ImageInput['companion'],
    challengeCategory: input.challengeCategory ?? null,
    locationBible: input.locationBible ?? null,
    pageLocationPlan: input.pageLocationPlan ?? null,
    heroVisualLock: input.heroVisualLock,
    styleLock: input.styleLock,
    entityVisualLock: input.entityVisualLock,
    pageIntent: {
      type: 'interaction_page',
      focus: 'hero',
      camera: 'medium',
      background: 'full',
      emotion: 'calm',
    },
    compositionRules: useStyle01
      ? undefined
      : 'Cover composition only: keep title-safe area in top 25-40% calm and uncluttered; focal subject in lower-mid area with strong silhouette; avoid centered symmetry and avoid cropped head/hands.',
    printPdfOptimized: input.printPdfOptimized,
  });
}

/** Structured log line for diagnosing provider failures (policy, 429, timeouts). */
function formatImageGenFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'unknown_error');
  const lower = raw.toLowerCase();
  if (/content.?pol|safety|moderation|disallowed|blocked|policy|content.?filter/.test(lower)) {
    return `CONTENT_POLICY_OR_SAFETY: ${raw}`;
  }
  if (/429|rate.?limit|too many requests|quota/.test(lower)) {
    return `RATE_LIMIT: ${raw}`;
  }
  if (/timeout|timed out|abort|aborterror|deadline|econnreset|socket|network/.test(lower)) {
    return `TIMEOUT_OR_NETWORK: ${raw}`;
  }
  return `OTHER: ${raw}`;
}

const DEFAULT_CHILD_ANCHOR_VARIANTS = 3;
const MAX_CHILD_ANCHOR_VARIANTS = 6;

/** Canonical env: CHILD_ANCHOR_VARIANTS (legacy alias: RESEMBLANCE_ANCHOR_CANDIDATES). */
function parseChildAnchorVariantsCount(): number {
  const raw =
    process.env.CHILD_ANCHOR_VARIANTS?.trim() ??
    process.env.RESEMBLANCE_ANCHOR_CANDIDATES?.trim() ??
    String(DEFAULT_CHILD_ANCHOR_VARIANTS);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CHILD_ANCHOR_VARIANTS;
  return Math.min(parsed, MAX_CHILD_ANCHOR_VARIANTS);
}

type ChildAnchorVariantPlan = {
  variantCount: number;
  useAnchorElection: boolean;
  reason: string;
};

function resolveChildAnchorVariantPlan(args: {
  imagePrompt: string;
  rawScenePrompt?: string;
  bookPageText?: string;
  visualDirection?: ShotVisualDirection;
  assignedIncludesChild: boolean;
  hasChildAnchor: boolean;
  childReferencePhotoUrl?: string;
  companionId?: string | null;
  childFirstName?: string | null;
  companionName?: string | null;
}): ChildAnchorVariantPlan {
  const skipSingle = (reason: string): ChildAnchorVariantPlan => ({
    variantCount: 1,
    useAnchorElection: false,
    reason,
  });

  if (!args.assignedIncludesChild) {
    return skipSingle('child_not_assigned_for_anchor');
  }
  if (args.hasChildAnchor) {
    return skipSingle('child_anchor_already_resolved');
  }
  if (!args.childReferencePhotoUrl) {
    return skipSingle('no_child_reference_photo');
  }
  if (isStyle01AuditionModeEnabled()) {
    return skipSingle('style01_audition_mode');
  }

  const imageDirection =
    (args.rawScenePrompt ?? '').trim() || extractSceneCore(args.imagePrompt).trim();
  const storyLocks = resolveStyle01StoryLocks(args.companionId ?? null);
  const entityPresence = derivePageEntityPresence({
    bookPageText: args.bookPageText,
    imageDirection,
    rawScenePrompt: args.rawScenePrompt,
    pagePrompt: args.imagePrompt,
    childFirstName: args.childFirstName,
    companionName: args.companionName ?? undefined,
    companionId: args.companionId ?? undefined,
    visualDirection: args.visualDirection,
    recurringObjectCatalog: storyLocks.recurringObjectCatalog,
    recurringEntityCatalog: storyLocks.recurringEntityCatalog,
  });

  if (entityPresence.childPresence !== 'present') {
    return skipSingle(`childPresence=${entityPresence.childPresence}`);
  }

  const variantCount = parseChildAnchorVariantsCount();
  if (variantCount <= 1) {
    return skipSingle('child_anchor_variants=1');
  }

  return {
    variantCount,
    useAnchorElection: true,
    reason: 'child_anchor_election',
  };
}

export async function generateAllPageImages(
  pages: Array<{
    pageNumber: number;
    imagePrompt: string;
    /** Clean LLM scene before pipeline locks; GPT Image prefers this over wrapped imagePrompt. */
    rawScenePrompt?: string;
    visualDirection?: ShotVisualDirection;
    /** Reader-facing line (e.g. story page text); for Visual Director when enabled. */
    bookPageText?: string;
    pageTemplate?: BookPageTemplate;
    expectedCharacterIds?: string[];
    imageSubject?: string;
    pageIntent?: PageIntent;
    composition?: {
      cameraDistance: 'close' | 'medium' | 'wide';
      cameraAngle: string;
      compositionType: string;
      heroPlacement: string;
      entityPlacement: string;
      topTextAreaPlan: string;
      mainIllustrationZone: string;
    };
    compositionRules?: string;
    environmentContinuity?: string;
    supportingCharacters?: Array<{
      name: string;
      description: string;
      relationship?: string;
      physicalDescription?: string;
      clothingDefault?: string;
      signatureDetail?: string;
      ageRange?: string;
    }>;
  }>,
  config: {
    illustrationStyle: string;
    childDescription?: string;
    /** Child first name (Visual Director and prompts). */
    childName?: string | null;
    childAge?: number | null;
    childGender?: string | null;
    referenceImages?: string[];
    characterRegistry?: Record<string, CharacterRegistryEntry>;
    initialCharacterAnchors?: Record<string, string>;
    existingPageNumbers?: number[];
    orderId?: string;
    characterSheet?: CharacterSheet;
    concept?: StoryConcept;
    heroVisualLock?: HeroVisualLock;
    styleLock?: StyleLock;
    entityVisualLock?: EntityVisualLock;
    onAnchorsResolved?: (resolvedAnchors: Record<string, string>) => Promise<void>;
    onResemblanceAudit?: (entry: ResemblanceAuditEntry) => Promise<void>;
    resemblanceThresholdConfig?: ResemblanceThresholdConfig;
    inputPhotoStrength?: InputPhotoStrength;
    photoQuality?: PhotoQualityForPrompt;
    /** When set, illustration prompts include the secondary companion block + anchoring. */
    companion?: Companion | null;
    directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
    directionEmotionalLabel?: string;
    directionStoryPremise?: string;
    challengeCategory?: string | null;
    extraNegativeRules?: string[];
    propDNA?: Record<string, string>;
    /** Structured child identity lock — threaded to buildGPTImagePrompt for labeled constraints. */
    childStructured?: { face: string; hair: string; body: string; clothing: string; signature: string };
    /** Structured companion identity lock — threaded to buildGPTImagePrompt for labeled constraints. */
    companionStructured?: { species: string; size: string; coloring: string; feature: string };
    /** Larger GPT Image + upscale path for קובץ מוכן להדפסה. */
    pdfEnabled?: boolean;
    /** Soft per-page cap (ms); rejects with timeout error when exceeded. */
    pageGenerationTimeoutMs?: number;
    /** Chunked worker: stop after generating this many new pages (skipped existing do not count). */
    maxNewPages?: number;
    /** Chunked worker: stop before this timestamp (ms since epoch). */
    workerDeadlineMs?: number;
    /** guarded-v2 — production recipe id for explicit page cards (e.g. bolly_bedtime_age_5). */
    guardedV2RecipeId?: string | null;
    /** When set, picks per-page child ref (expression mini-sheet) before style refs. */
    resolvePageChildExpressionRef?: (ctx: {
      pageNumber: number;
      imagePrompt?: string;
      bookPageText?: string;
      rawScenePrompt?: string;
      shotType?: string;
      action?: string;
      emotion?: string;
    }) => { url: string; kind: string } | null;
    /** Parsed from story-bank `recurringEntities:` frontmatter. */
    storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
    storyTimeOfDay?: import('../../lib/story-time-of-day').StoryTimeOfDay;
    pageTimeOfDayOverrides?: Partial<Record<number, import('../../lib/story-time-of-day').StoryTimeOfDay>>;
    familyCoherence?: import('../../lib/family-coherence').FamilyCoherenceBundle | null;
    /** Per-book shot plan — derived at render or story override; consumed by Style 01 assembly. */
    bookShotPlan?: import('../../lib/book-shot-plan').BookShotPlan;
    storyLocationPlan?: import('../../lib/story-location-bible').StoryLocationPlanBundle;
  }
): Promise<{
  results: Map<number, GeneratedImage>;
  failedPages: number[];
  textZones: Map<number, TextZone>;
  lightingModes: Map<number, Lighting>;
  storyboardPlan: PageVisualStoryboard[];
}> {
  const fluxOverrideActive = isFluxProOverrideActive();
  const pagesToGenerate = fluxOverrideActive ? pages.slice(0, 2) : pages;
  if (fluxOverrideActive) {
    console.log('[test_mode]', 'flux override → generating 2 pages only');
  }

  const results = new Map<number, GeneratedImage>();
  const textZones = new Map<number, TextZone>();
  const lightingModes = new Map<number, Lighting>();
  const failedPages: number[] = [];
  const normalizedStyle = normalizeStyleId(config.illustrationStyle);
  assertShippedBookStyleEngineActive(normalizedStyle);
  const style02Phase2Active = shouldUseStyle02Phase2Path(normalizedStyle);
  const style02BookProfile = style02Phase2Active ? resolveStyle02BookPromptProfile() : 'default';
  const style02ChildVisualLock =
    style02Phase2Active && style02BookProfile === 'default'
      ? buildStyle02ChildVisualLock({
          childName: config.childName,
          childDescription: config.childDescription,
          childStructured: config.childStructured,
          childAge: config.childAge,
          childGender: config.childGender,
        })
      : undefined;
  const style02WardrobeLock =
    style02Phase2Active && style02BookProfile === 'default'
      ? buildStyle02WardrobeLock({ childStructured: config.childStructured, childDescription: config.childDescription })
      : undefined;
  const style02CompanionTextLock =
    style02Phase2Active && style02BookProfile === 'default' && config.companion
      ? buildStyle02CompanionTextLock({
          companionId: config.companion.id,
          companionName: config.companion.name,
          companionStructured: config.companionStructured,
          companionVisualDescription: config.companion.visualDescription,
        })
      : undefined;
  if (style02Phase2Active) {
    console.log(
      `[Phase2] Style 02 gpt-image-2 book path | model=${STYLE_02_GPT_MODEL} | refConfig=${resolveStyle02RefBudgetConfig()} | NOT live customer path`
    );
  }
  console.log(
    `[Image] Generating ${pagesToGenerate.length} images | ` +
    `style=${normalizedStyle} | ` +
    `style02Phase2=${style02Phase2Active} | ` +
    `characterSheet=${!!config.characterSheet} | ` +
    `concept entity="${config.concept?.centralEntity?.name ?? 'none'}"`
  );

  const characterRegistry = config.characterRegistry ?? {
    child: {
      id: 'child',
      name: 'child',
      description: config.childDescription ?? 'child-safe story protagonist',
    },
  };
  const protagonistVisualLock = buildCompactProtagonistLock({
    childName: config.childName,
    childDescription: config.childDescription,
    heroVisualLock: config.heroVisualLock,
    orderId: config.orderId,
    pageNumber: 0,
    childAge: config.childAge,
    childGender: config.childGender,
    directionArchetype: config.directionArchetype ?? null,
  });
  const characterAnchors: Record<string, string> = { ...(config.initialCharacterAnchors ?? {}) };
  const existingPages = new Set(config.existingPageNumbers ?? []);
  const generatedPages = new Set<number>();
  const unsuitablePromptRegex =
    /\b(background|far away|distant|tiny|small figure|silhouette|occluded|behind|crowd|partial|from behind|blurred)\b/i;

  const rankCharacter = (characterId: string): number => {
    if (characterId === 'child') return 0;
    if (characterId.startsWith('companion:')) return 1;
    if (characterId === 'father') return 2;
    if (characterId === 'mother') return 3;
    if (characterId.startsWith('sibling_')) return 4;
    if (characterId.startsWith('supporting_')) return 5;
    return 6;
  };

  const isPageReferenceFriendly = (page: { imagePrompt: string; imageSubject?: string }): boolean => {
    const subject = (page.imageSubject ?? '').toLowerCase();
    if (subject.startsWith('environment') || subject.startsWith('object:')) return false;
    return !unsuitablePromptRegex.test(page.imagePrompt.toLowerCase());
  };

  const isCharacterSuitableForAnchor = (
    characterId: string,
    page: { imagePrompt: string; imageSubject?: string },
    pageFriendly: boolean
  ): boolean => {
    const subject = (page.imageSubject ?? '').toLowerCase();
    const pageText = `${page.imagePrompt} ${page.imageSubject ?? ''}`.toLowerCase();
    if (characterId === 'child') {
      if (subject.startsWith('environment') || subject.startsWith('object:')) return false;
      // Child is prioritized for early anchoring even when the page is not ideal for secondary characters.
      return true;
    }
    if (!pageFriendly) return false;
    const entry = characterRegistry[characterId];
    if (!entry) return false;
    const haystack = pageText;
    const normalizedName = entry.name.trim().toLowerCase();
    const nameMentioned = normalizedName.length > 0 && haystack.includes(normalizedName);
    const aliasMentioned = entry.description.trim().toLowerCase().split(/\s+/).slice(0, 3).some((token) => token.length > 2 && haystack.includes(token));
    return nameMentioned || aliasMentioned;
  };

  const selectAssignedAnchors = (
    unresolvedCharacterIds: string[],
    suitableCharacterIds: string[]
  ): string[] => {
    const assigned: string[] = [];
    if (suitableCharacterIds.includes('child') && unresolvedCharacterIds.includes('child')) {
      assigned.push('child');
    }
    const remaining = suitableCharacterIds
      .filter((characterId) => characterId !== 'child')
      .sort((a, b) => rankCharacter(a) - rankCharacter(b));
    if (remaining.length > 0) {
      assigned.push(remaining[0]); // only one non-child per page to avoid weak shared anchors
    }
    return assigned;
  };

  const thresholdConfig = config.resemblanceThresholdConfig ?? resolveResemblanceThresholdConfig();
  const inputPhotoStrength = config.inputPhotoStrength ?? 'adequate';
  const storyboardPlan = await generateStoryboard({
    fullStory: pagesToGenerate
      .map((p) => (p.bookPageText ?? '').trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 12000),
    pages: pagesToGenerate.map((p) => ({
      pageNumber: p.pageNumber,
      bookPageText: p.bookPageText,
      imagePrompt: p.imagePrompt,
    })),
    childProfile: [config.childName ?? '', config.childDescription ?? ''].filter(Boolean).join(' | '),
    selectedStyle: normalizedStyle,
  });
  const storyboardByPage = new Map<number, PageVisualStoryboard>(
    storyboardPlan.map((row) => [row.pageNumber, row])
  );

  // ── DIRECTOR LAYER ─ run cinematic blocking generation per page in parallel.
  // Each page gets a BLOCKING JSON (positions, eyeline, interaction, emotion) that
  // replaces the mechanical "Location/Action/Pose/Expression" lines downstream.
  // Disable with USE_DIRECTOR_LAYER=false (falls back to legacy mechanical scene block).
  const blockingByPage = new Map<number, SceneBlocking>();
  if (isDirectorLayerEnabled() && !isFluxCleanPromptEnabled()) {
    const directorStart = Date.now();
    const pageByNum = new Map(pagesToGenerate.map((p) => [p.pageNumber, p]));
    const totalPagesForDirector = pagesToGenerate.length;
    const directorResults = await Promise.all(
      pagesToGenerate.map(async (page) => {
        const sb = storyboardByPage.get(page.pageNumber);
        const prevPage = pageByNum.get(page.pageNumber - 1);
        const nextPage = pageByNum.get(page.pageNumber + 1);
        // Per-page companion presence check — only pass companion data to the Director when
        // this page actually features the companion. Without this, the Director happily
        // composes the companion into every page (including pages where the text does not
        // introduce them yet), producing visual contradictions with the story.
        const companionPresentOnPage = (() => {
          if (!config.companion) return false;
          const companionNameLc = config.companion.name.toLowerCase();
          const speciesLc = (config.companionStructured?.species ?? '').toLowerCase();
          const textLc = (page.bookPageText ?? '').toLowerCase();
          // 1) Page text names the companion explicitly
          if (companionNameLc && textLc.includes(companionNameLc)) return true;
          // 2) visualDirection.mustInclude lists the companion name or species
          const mustInclude = (page.visualDirection?.mustInclude ?? []).map((it) => it.toLowerCase());
          if (mustInclude.some((it) => companionNameLc && it.includes(companionNameLc))) return true;
          if (speciesLc && mustInclude.some((it) => speciesLc.split(/\s+/).some((tok) => tok && it.includes(tok)))) return true;
          // 3) visualDirection.mustNotInclude explicitly excludes the companion → definitely absent
          const mustNotInclude = (page.visualDirection?.mustNotInclude ?? []).map((it) => it.toLowerCase());
          if (mustNotInclude.some((it) => companionNameLc && it.includes(companionNameLc))) return false;
          return false;
        })();
        const blocking = await generateSceneBlocking({
          pageNumber: page.pageNumber,
          pageText: page.bookPageText ?? '',
          imageDirection: page.imagePrompt ?? '',
          visualDirection: page.visualDirection ?? null,
          storyboard: sb ?? null,
          companion: companionPresentOnPage && config.companion
            ? {
                name: config.companion.name,
                species: config.companionStructured?.species,
                feature: config.companionStructured?.feature,
              }
            : null,
          child: {
            name: config.childName ?? null,
            age: config.childAge ?? null,
            gender: config.childGender ?? null,
          },
          previousPageContext: prevPage
            ? {
                pageNumber: prevPage.pageNumber,
                pageTextSnippet: (prevPage.bookPageText ?? '').trim().slice(0, 200) || undefined,
              }
            : null,
          nextPageContext: nextPage
            ? {
                pageNumber: nextPage.pageNumber,
                pageTextSnippet: (nextPage.bookPageText ?? '').trim().slice(0, 200) || undefined,
              }
            : null,
          totalPages: totalPagesForDirector,
        });
        return { pageNumber: page.pageNumber, blocking, companionPresentOnPage };
      })
    );
    let companionPresentCount = 0;
    for (const { pageNumber, blocking, companionPresentOnPage } of directorResults) {
      if (blocking) blockingByPage.set(pageNumber, blocking);
      if (companionPresentOnPage) companionPresentCount++;
    }
    console.log(
      `[Director] companion-on-page: ${companionPresentCount}/${pagesToGenerate.length} pages include the companion`,
    );
    const elapsed = Date.now() - directorStart;
    console.log(
      `[Director] completed — ${blockingByPage.size}/${pagesToGenerate.length} pages got blocking (${elapsed}ms)`,
    );
  } else if (isFluxCleanPromptEnabled()) {
    console.log('[Director] skipped — FLUX_CLEAN_PROMPT=on (Director output unused on Flux clean path)');
  } else {
    console.log('[Director] disabled via USE_DIRECTOR_LAYER=false — using legacy mechanical scene block');
  }

  const resemblesMonitorEnabled = process.env.RESEMBLANCE_PAGE_MONITOR_ENABLED !== 'false';
  const THROTTLE_DELAY_MS = 1500;
  const MAX_PAGE_ATTEMPTS = 3;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isRateLimitError = (error: unknown): boolean => {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    return msg.includes('429') || /too many requests/i.test(msg);
  };

  const extractRetryAfterMs = (error: unknown): number | null => {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    const explicit = msg.match(/retry_after[^0-9]*(\d+)/i);
    if (explicit) return Number(explicit[1]) * 1000 + 500;
    return null;
  };

  const runImageWithThrottleAndRetry = async (
    makeAttempt: (attempt: number) => Promise<GeneratedImage>,
    pageNumber: number,
    attemptContext: string
  ): Promise<GeneratedImage> => {
    const pageTimeoutMs = config.pageGenerationTimeoutMs;
    const withOptionalTimeout = async (promise: Promise<GeneratedImage>): Promise<GeneratedImage> => {
      if (!pageTimeoutMs || pageTimeoutMs <= 0) return promise;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<GeneratedImage>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`Page ${pageNumber} soft timeout after ${pageTimeoutMs}ms`)),
              pageTimeoutMs
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
      try {
        const generated = await withOptionalTimeout(makeAttempt(attempt));
        await sleep(THROTTLE_DELAY_MS);
        return generated;
      } catch (error) {
        lastError = error;
        const retriesLeft = MAX_PAGE_ATTEMPTS - attempt;
        if (retriesLeft <= 0) break;
        if (isRateLimitError(error)) {
          const retryMs = extractRetryAfterMs(error) ?? 2500;
          console.warn(
            `[Image] Page ${pageNumber} ${attemptContext} hit 429; waiting ${retryMs}ms before retry (retriesLeft=${retriesLeft})`
          );
          await sleep(retryMs);
        } else {
          console.warn(
            `[Image] Page ${pageNumber} ${attemptContext} failed on attempt ${attempt}; retriesLeft=${retriesLeft}; err=${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  const emitResemblanceAudit = async (entry: ResemblanceAuditEntry): Promise<void> => {
    if (!config.onResemblanceAudit) return;
    try {
      await config.onResemblanceAudit(entry);
    } catch (error) {
      console.warn(
        `[ResemblanceCore] audit persist failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  let newPagesGenerated = 0;

  for (const page of pagesToGenerate) {
    if (config.workerDeadlineMs && Date.now() >= config.workerDeadlineMs) {
      console.log(
        `[Image] Chunk worker deadline reached; stopping before page ${page.pageNumber} (${results.size} pages in this invocation)`
      );
      break;
    }
    if (config.maxNewPages != null && config.maxNewPages > 0 && newPagesGenerated >= config.maxNewPages) {
      console.log(
        `[Image] maxNewPages=${config.maxNewPages} reached; stopping before page ${page.pageNumber}`
      );
      break;
    }
    if (existingPages.has(page.pageNumber)) {
      console.log(`[Image] Page ${page.pageNumber} already complete; skipping generation`);
      continue;
    }

    const expectedCharacterIds = page.expectedCharacterIds && page.expectedCharacterIds.length > 0
      ? page.expectedCharacterIds
      : ['child'];
    const pageStoryboard =
      storyboardByPage.get(page.pageNumber) ??
      normalizeStoryboardRows(
        [{ pageNumber: page.pageNumber, imagePrompt: page.imagePrompt, bookPageText: page.bookPageText }],
        []
      )[0];
    const pageShot =
      config.bookShotPlan?.pages.find((slot) => slot.page === page.pageNumber) ?? null;
    const pageLocationPlan =
      config.storyLocationPlan
        ? (config.storyLocationPlan.pagePlans.find((p) => p.page === page.pageNumber) ?? null)
        : null;
    if (config.bookShotPlan) {
      console.log('[book-shot-plan]', {
        page: page.pageNumber,
        shot: pageShot?.shot,
        angle: pageShot?.angle ?? 'eye',
        rationale: pageShot?.rationale?.slice(0, 80),
      });
    }
    textZones.set(page.pageNumber, pageStoryboard.textZone);
    lightingModes.set(page.pageNumber, pageStoryboard.lighting);
    console.log('[storyboard]', {
      page: page.pageNumber,
      shotType: pageStoryboard.shotType,
      compositionMode: pageStoryboard.compositionMode,
      textZone: pageStoryboard.textZone,
      pageLayoutStyle: pageStoryboard.pageLayoutStyle,
      mainCharacterVisibility: pageStoryboard.mainCharacterVisibility,
      protagonistDominance: pageStoryboard.protagonistDominance,
    });
    const storyboardPrompt = composeStoryboardDrivenPagePrompt(
      {
        pageNumber: page.pageNumber,
        imagePrompt: page.imagePrompt,
        bookPageText: page.bookPageText,
        expectedCharacterIds,
      },
      pageStoryboard,
      normalizedStyle,
      characterRegistry,
      protagonistVisualLock
    );
    const exprRef = config.resolvePageChildExpressionRef?.({
      pageNumber: page.pageNumber,
      imagePrompt: page.imagePrompt,
      bookPageText: page.bookPageText,
      rawScenePrompt: page.rawScenePrompt,
      shotType: pageStoryboard.shotType,
      action: pageStoryboard.action,
      emotion: pageStoryboard.emotionalTone,
    });
    if (exprRef?.url && expectedCharacterIds.includes('child')) {
      characterAnchors.child = exprRef.url;
    }
    const pageReferenceImages =
      exprRef?.url != null
        ? [exprRef.url, ...(config.referenceImages?.slice(1) ?? [])]
        : config.referenceImages;
    const pageChildExpressionKind = exprRef?.kind;

    const unresolvedCharacterIds = expectedCharacterIds
      .filter((characterId) => !characterAnchors[characterId])
      .sort((a, b) => rankCharacter(a) - rankCharacter(b));
    const pageFriendly = isPageReferenceFriendly(page);
    const suitableCharacterIds = unresolvedCharacterIds
      .filter((characterId) => isCharacterSuitableForAnchor(characterId, page, pageFriendly))
      .sort((a, b) => rankCharacter(a) - rankCharacter(b));
    const assignedCharacterIds = selectAssignedAnchors(unresolvedCharacterIds, suitableCharacterIds);
    const availableAnchorIds = expectedCharacterIds.filter((characterId) => Boolean(characterAnchors[characterId]));
    const passedAnchorUrls = [...new Set(availableAnchorIds.map((characterId) => characterAnchors[characterId]))];
    const anchorCharacters = availableAnchorIds.map((characterId) => ({
      characterId,
      name: characterRegistry[characterId]?.name ?? characterId,
      anchorImageUrl: characterAnchors[characterId],
    }));
    const baseReferenceImages = pageReferenceImages ?? [];
    const anchorReferenceImages = passedAnchorUrls;
    const mergedReferenceImages = [...new Set([...baseReferenceImages, ...anchorReferenceImages])];
    const referenceImages = mergedReferenceImages.length > 0 ? mergedReferenceImages : undefined;
    const childExpected = expectedCharacterIds.includes('child');
    const childReferenceRequested = Boolean(pageReferenceImages?.[0]);
    const childAnchorAvailable = Boolean(characterAnchors.child);
    const childReferenceReachesProvider = Boolean(
      referenceImages && (childReferenceRequested || childAnchorAvailable)
    );
    if (childExpected && !childReferenceReachesProvider) {
      const message =
        `[ImageGate] Page ${page.pageNumber} blocked: child expected but no child reference reached provider`;
      console.error(message, {
        orderId: config.orderId ?? 'unknown',
        page: page.pageNumber,
        expectedCharacterIds,
        availableAnchorIds,
        requestedRefCount: pageReferenceImages?.length ?? 0,
      });
      failedPages.push(page.pageNumber);
      continue;
    }
    console.log('[image_reference_and_lock]', {
      page: page.pageNumber,
      referenceImageExists: baseReferenceImages.length > 0,
      providerReceivesReferenceImages: Boolean(referenceImages && referenceImages.length > 0),
      providerReferenceImageCount: referenceImages?.length ?? 0,
      protagonistVisualLock,
      mainCharacterVisibility: pageStoryboard.mainCharacterVisibility,
      protagonistDominance: pageStoryboard.protagonistDominance,
      finalPromptExcerpt: storyboardPrompt.slice(0, 260),
    });
    const sceneAction = (pageStoryboard.action ?? '').trim();
    const sceneEnvironment = (pageStoryboard.environment ?? '').trim();
    // Only look at the story-derived prompt (page.imagePrompt + bookPageText), NOT the style
    // block. The style block can mention 'portrait' inside NOT-directives like 'NOT a portrait'
    // which previously caused isPortrait to false-positive. Also require a positive directive.
    const promptForCheck = `${page.imagePrompt} ${page.bookPageText ?? ''}`;
    const hasPortraitWord = /\b(portrait|headshot|character sheet|isolated character|reference pose)\b/i.test(promptForCheck);
    const hasNegation = /\b(not|never|no|avoid)[^.]{0,40}\b(portrait|headshot|character sheet)\b/i.test(promptForCheck);
    const isPortrait = hasPortraitWord && !hasNegation;
    console.log('[story_scene_check]', {
      hasAction: sceneAction.length > 0,
      hasEnvironment: sceneEnvironment.length > 0,
      isPortrait,
    });
    const cleanedImagePrompt = extractSceneCore(page.imagePrompt);
    const hadContract = /^(\s*PROMPT_CONTRACT_PAGE_\d+:|\s*CRITICAL_IMAGE_RULE:)/i.test(page.imagePrompt);
    console.log(
      `[image_prompt_stripped] page=${page.pageNumber} originalLen=${page.imagePrompt.length} cleanedLen=${cleanedImagePrompt.length} hadContract=${hadContract}`
    );
    const isActionBeat = looksLikeActionBeat(cleanedImagePrompt) || looksLikeActionBeat(page.bookPageText ?? null);
    const beforePageTemplate = page.pageTemplate ?? 'art_top_text_bottom';
    const effectivePageTemplate =
      isActionBeat && beforePageTemplate === 'character_vignette_text'
        ? 'art_top_text_bottom'
        : beforePageTemplate;
    const beforePageIntent = page.pageIntent;
    const effectivePageIntent: PageIntent | undefined = isActionBeat
      ? {
          type: 'action_page',
          focus: 'action' as unknown as PageIntent['focus'],
          camera: beforePageIntent?.camera ?? 'medium',
          background: 'full',
          emotion: beforePageIntent?.emotion ?? 'tension',
        }
      : beforePageIntent;
    if (isActionBeat) {
      console.log(
        `[composition_override] page=${page.pageNumber} isActionBeat=true beforeType=${beforePageIntent?.type ?? 'none'} afterType=action_page beforePageTemplate=${beforePageTemplate} afterPageTemplate=${effectivePageTemplate}`
      );
    } else {
      console.log(
        `[composition_override] page=${page.pageNumber} isActionBeat=false beforeType=${beforePageIntent?.type ?? 'none'} afterType=${beforePageIntent?.type ?? 'none'} beforePageTemplate=${beforePageTemplate} afterPageTemplate=${effectivePageTemplate}`
      );
    }
    const pageExpectedDisplayNames = resolvePageCharacterDisplayNames(page, characterRegistry);
    const rawScene = (page.rawScenePrompt ?? '').trim();
    const visualDirectorPageFields: Pick<
      ImageInput,
      | 'bookPageText'
      | 'stage4Prompt'
      | 'rawScenePrompt'
      | 'visualDirection'
      | 'blocking'
      | 'childFirstName'
      | 'expectedCharacterNames'
      | 'supportingCharacters'
      | 'pageStoryboard'
      | 'expectedCharacterIds'
      | 'guardedV2RecipeId'
    > = {
      bookPageText: page.bookPageText ?? null,
      guardedV2RecipeId:
        config.guardedV2RecipeId ??
        (config.companion?.id === 'bolly_armadillo' ? 'bolly_bedtime_age_5' : null),
      stage4Prompt: rawScene || cleanedImagePrompt,
      rawScenePrompt: page.rawScenePrompt || null,
      visualDirection: page.visualDirection ?? null,
      blocking: blockingByPage.get(page.pageNumber) ?? null,
      childFirstName: config.childName ?? null,
      expectedCharacterNames: pageExpectedDisplayNames,
      supportingCharacters: page.supportingCharacters ?? [],
      pageStoryboard,
      expectedCharacterIds,
    };
    const style01PipelineFields: Pick<
      ImageInput,
      | 'storyRecurringEntityDeclarations'
      | 'totalPages'
      | 'familyCoherence'
      | 'storyTimeOfDay'
      | 'pageTimeOfDayOverrides'
      | 'pageShot'
      | 'locationBible'
      | 'pageLocationPlan'
    > = {
      totalPages: pagesToGenerate.length,
      ...(shouldUseStyle01Phase2Path(normalizedStyle)
        ? {
            storyRecurringEntityDeclarations: config.storyRecurringEntityDeclarations,
            familyCoherence: config.familyCoherence ?? null,
            storyTimeOfDay: config.storyTimeOfDay,
            pageTimeOfDayOverrides: config.pageTimeOfDayOverrides,
            pageShot,
            locationBible: config.storyLocationPlan?.bible ?? null,
            pageLocationPlan,
          }
        : {}),
    };
    console.log(
      `[Image] Page ${page.pageNumber}/${pagesToGenerate.length} — expectedCharacters=[${expectedCharacterIds.join(', ')}] unresolved=[${unresolvedCharacterIds.join(', ')}] suitable=[${suitableCharacterIds.join(', ')}] assigned=[${assignedCharacterIds.join(', ')}] availableAnchors=[${availableAnchorIds.join(', ')}] passedAnchors=[${anchorCharacters.map((entry) => entry.characterId).join(', ')}]`
    );

    let image: GeneratedImage | null = null;
    let lastError: unknown = null;
    const baseReferenceImage = pageReferenceImages?.[0];
    if (exprRef) {
      console.log(
        `[child_expression_ref] page=${page.pageNumber} kind=${exprRef.kind} url=${exprRef.url.slice(0, 80)}…`
      );
    }
    const anchorVariantPlan = resolveChildAnchorVariantPlan({
      imagePrompt: page.imagePrompt,
      rawScenePrompt: page.rawScenePrompt,
      bookPageText: page.bookPageText,
      visualDirection: page.visualDirection,
      assignedIncludesChild: assignedCharacterIds.includes('child'),
      hasChildAnchor: Boolean(characterAnchors.child),
      childReferencePhotoUrl: baseReferenceImage,
      companionId: config.companion?.id ?? null,
      childFirstName: config.childName ?? null,
      companionName: config.companion?.name ?? null,
    });
    console.log(
      `[image] page=${page.pageNumber} variantCount=${anchorVariantPlan.variantCount} reason="${anchorVariantPlan.reason}"`
    );
    const shouldRunAnchorElection =
      !style02Phase2Active &&
      anchorVariantPlan.useAnchorElection &&
      Boolean(baseReferenceImage);
    const anchorCandidatesForPage = shouldRunAnchorElection
      ? anchorVariantPlan.variantCount
      : 1;

    if (shouldRunAnchorElection && baseReferenceImage) {
      const candidateImages: Array<{ image: GeneratedImage; seed: number }> = [];
      const candidateRows: ResemblanceCandidate[] = [];
      const effectiveThreshold = resolveEffectiveThreshold(normalizedStyle.toLowerCase(), thresholdConfig);
      for (let candidateIndex = 0; candidateIndex < anchorCandidatesForPage; candidateIndex++) {
        const seed = Math.floor(Date.now() + page.pageNumber * 100 + candidateIndex);
        const generated = await runImageWithThrottleAndRetry(
          () =>
            generateImage({
              pagePrompt: storyboardPrompt,
              illustrationStyle: normalizedStyle,
              pageTemplate: effectivePageTemplate,
              childDescription: config.childDescription,
              referenceImages,
              anchorCharacters,
              orderId: config.orderId,
              characterSheet: config.characterSheet,
              concept: config.concept,
              heroVisualLock: config.heroVisualLock,
              styleLock: config.styleLock,
              entityVisualLock: config.entityVisualLock,
              pageIntent: effectivePageIntent,
              composition: page.composition,
              compositionRules: page.compositionRules,
              environmentContinuity: page.environmentContinuity,
              pageNumber: page.pageNumber,
              assetType: 'page',
              companion: config.companion ?? null,
              photoQuality: config.photoQuality,
              directionArchetype: config.directionArchetype,
              directionEmotionalLabel: config.directionEmotionalLabel,
              directionStoryPremise: config.directionStoryPremise,
              challengeCategory: config.challengeCategory,
              childAge: config.childAge ?? null,
              childGender: config.childGender ?? null,
              textZone: pageStoryboard.textZone,
              pageLayoutStyle: pageStoryboard.pageLayoutStyle,
              extraNegativeRules: config.extraNegativeRules,
              propDNA: config.propDNA,
              childStructured: config.childStructured,
              companionStructured: config.companionStructured,
              childExpressionAnchorKind: pageChildExpressionKind,
              printPdfOptimized: !!config.pdfEnabled,
              style02ChildVisualLock,
              style02WardrobeLock,
              style02CompanionTextLock,
              ...style01PipelineFields,
              ...visualDirectorPageFields,
              seed,
            }),
          page.pageNumber,
          `anchor-candidate-${candidateIndex + 1}`
        );
        candidateImages.push({ image: generated, seed });
        const scored = await scoreResemblanceAgainstReference({
          referenceImageUrl: baseReferenceImage,
          candidateImageUrl: generated.url,
          effectiveThreshold,
          minAcceptableScore: thresholdConfig.minAcceptableScore,
        });
        candidateRows.push({
          candidateIndex,
          imageUrl: generated.url,
          resemblanceScore: scored.resemblanceScore,
          faceDetectConfidence: scored.faceDetectConfidence,
          faceAreaRatio: scored.faceAreaRatio,
          sanityFlags: scored.sanityFlags,
          candidateEmbedding: scored.candidateEmbedding,
        });
        await emitResemblanceAudit({
          orderId: config.orderId,
          pageNumber: page.pageNumber,
          candidateIndex,
          selected: false,
          seed,
          model: generated.provider,
          styleId: normalizedStyle,
          resemblanceScore: scored.resemblanceScore,
          threshold: effectiveThreshold,
          minAcceptableScore: thresholdConfig.minAcceptableScore,
          softFailBand: thresholdConfig.softFailBand,
          extremeMargin: thresholdConfig.extremeMargin,
          faceDetectConfidence: scored.faceDetectConfidence,
          faceAreaRatio: scored.faceAreaRatio,
          sanityDisagreement:
            scored.sanityFlags.embeddingMismatch || scored.sanityFlags.colorMismatch || scored.sanityFlags.geometryWeird,
          source: 'anchor_election',
        });
      }

      const selection: AnchorSelectionResult = selectResemblanceAnchor({
        candidates: candidateRows,
        effectiveThreshold,
        minAcceptableScore: thresholdConfig.minAcceptableScore,
        softFailBand: thresholdConfig.softFailBand,
        extremeMargin: thresholdConfig.extremeMargin,
        inputStrength: inputPhotoStrength,
      });
      const selectedCandidate = candidateImages.find((c, idx) => idx === selection.selectedIndex) ?? candidateImages[0];
      if (childExpected && selection.resemblanceStatus === 'soft_fail') {
        const message =
          `[ImageGate] Page ${page.pageNumber} blocked: child anchor resemblance soft_fail (${selection.reason})`;
        console.error(message, {
          orderId: config.orderId ?? 'unknown',
          page: page.pageNumber,
          reasonCodes: selection.reasonCodes,
          scores: selection.scores,
          selectedIndex: selection.selectedIndex,
        });
        failedPages.push(page.pageNumber);
        continue;
      }
      image = selectedCandidate.image;

      await emitResemblanceAudit({
        orderId: config.orderId,
        pageNumber: page.pageNumber,
        candidateIndex: selection.selectedIndex,
        selected: true,
        seed: selectedCandidate.seed,
        model: selectedCandidate.image.provider,
        styleId: normalizedStyle,
        resemblanceScore: candidateRows[selection.selectedIndex]?.resemblanceScore,
        allCandidateScores: selection.scores,
        threshold: effectiveThreshold,
        minAcceptableScore: thresholdConfig.minAcceptableScore,
        softFailBand: thresholdConfig.softFailBand,
        extremeMargin: thresholdConfig.extremeMargin,
        selectionGap: selection.selectionGap,
        resemblanceStatus: selection.resemblanceStatus,
        resemblanceConfidence: selection.confidence,
        sanityDisagreement: selection.sanityDisagreement,
        lowDiversity: selection.lowDiversity,
        extremeMismatch: selection.extremeMismatch,
        reason: selection.reason,
        reasonCodes: selection.reasonCodes,
        source: 'anchor_election',
        metadata: { inputPhotoStrength },
      });

      resemblanceLogger.info('child_anchor_resemblance_selected', {
        orderId: config.orderId ?? 'unknown',
        pageNumber: page.pageNumber,
        selectedIndex: selection.selectedIndex,
        resemblanceStatus: selection.resemblanceStatus,
        resemblanceConfidence: selection.confidence,
        selectionGap: selection.selectionGap,
        reason: selection.reason,
      });
    } else if (config.photoQuality?.status === 'warning') {
      const attemptAnchors = anchorCharacters;
      const warningCandidates: WarningRetryCandidate[] = [];
      for (let candidateIndex = 0; candidateIndex < 2; candidateIndex++) {
        const seed = Math.floor(Date.now() + page.pageNumber * 1000 + candidateIndex * 17);
        try {
          const generated = await runImageWithThrottleAndRetry(
            () =>
              generateImage({
                pagePrompt: storyboardPrompt,
                illustrationStyle: normalizedStyle,
              pageTemplate: effectivePageTemplate,
                childDescription: config.childDescription,
                referenceImages,
                anchorCharacters: attemptAnchors,
                orderId: config.orderId,
                characterSheet: config.characterSheet,
                concept: config.concept,
                heroVisualLock: config.heroVisualLock,
                styleLock: config.styleLock,
                entityVisualLock: config.entityVisualLock,
                pageIntent: effectivePageIntent,
                composition: page.composition,
                compositionRules: page.compositionRules,
                environmentContinuity: page.environmentContinuity,
                pageNumber: page.pageNumber,
                assetType: 'page',
                companion: config.companion ?? null,
                photoQuality: config.photoQuality,
                directionArchetype: config.directionArchetype,
                directionEmotionalLabel: config.directionEmotionalLabel,
                directionStoryPremise: config.directionStoryPremise,
              challengeCategory: config.challengeCategory,
                childAge: config.childAge ?? null,
                childGender: config.childGender ?? null,
                textZone: pageStoryboard.textZone,
              pageLayoutStyle: pageStoryboard.pageLayoutStyle,
                extraNegativeRules: config.extraNegativeRules,
                propDNA: config.propDNA,
                childStructured: config.childStructured,
                companionStructured: config.companionStructured,
                childExpressionAnchorKind: pageChildExpressionKind,
                printPdfOptimized: !!config.pdfEnabled,
                style02ChildVisualLock,
                style02WardrobeLock,
                style02CompanionTextLock,
                ...style01PipelineFields,
                ...visualDirectorPageFields,
                seed,
              }),
            page.pageNumber,
            `warning-candidate-${candidateIndex + 1}`
          );
          let signal: Awaited<ReturnType<typeof evaluateImageFaceSignal>> | null = null;
          try {
            signal = await evaluateImageFaceSignal(generated.url);
          } catch (_) {
            signal = null;
          }
          warningCandidates.push({
            image: generated,
            seed,
            faceDetectConfidence: signal?.faceDetectConfidence ?? null,
            faceAreaRatio: signal?.faceAreaRatio ?? null,
            faceCount: signal?.faceCount ?? null,
          });
        } catch (error) {
          lastError = error;
        }
      }
      if (warningCandidates.length > 0) {
        const selected = selectBestImage(warningCandidates);
        image = selected.image;
        console.debug('WARNING_IMAGE_RETRY', {
          page: page.pageNumber,
          candidates: warningCandidates.map((candidate) => ({
            seed: candidate.seed,
            provider: candidate.image.provider,
            faceDetectConfidence: candidate.faceDetectConfidence,
            faceAreaRatio: candidate.faceAreaRatio,
            faceCount: candidate.faceCount,
          })),
          selected: {
            seed: selected.seed,
            faceDetectConfidence: selected.faceDetectConfidence,
            faceAreaRatio: selected.faceAreaRatio,
            faceCount: selected.faceCount,
          },
        });
      }
    } else {
      const attemptAnchors = anchorCharacters;
      try {
        image = await runImageWithThrottleAndRetry(
          (attempt) => {
            const retrySuffix =
              attempt > 1
                ? '\n\nRETRY_HINT: previous render attempt failed for provider/runtime reasons. Preserve character consistency from anchors and reference images.'
                : '';
            console.log(
              `[ImageAttempt] orderId=${config.orderId ?? 'unknown'} page=${page.pageNumber} attempt=${attempt} anchorUsed=${Boolean(
                referenceImages && referenceImages.length > 0
              )} skippedExistingImage=false`
            );
            return generateImage({
              pagePrompt: `${storyboardPrompt}${retrySuffix}`,
              illustrationStyle: normalizedStyle,
              pageTemplate: effectivePageTemplate,
              childDescription: config.childDescription,
              referenceImages,
              anchorCharacters: attemptAnchors,
              orderId: config.orderId,
              characterSheet: config.characterSheet,
              concept: config.concept,
              heroVisualLock: config.heroVisualLock,
              styleLock: config.styleLock,
              entityVisualLock: config.entityVisualLock,
              pageIntent: effectivePageIntent,
              composition: page.composition,
              compositionRules: page.compositionRules,
              environmentContinuity: page.environmentContinuity,
              pageNumber: page.pageNumber,
              assetType: 'page',
              companion: config.companion ?? null,
              photoQuality: config.photoQuality,
              directionArchetype: config.directionArchetype,
              directionEmotionalLabel: config.directionEmotionalLabel,
              directionStoryPremise: config.directionStoryPremise,
              challengeCategory: config.challengeCategory,
              childAge: config.childAge ?? null,
              childGender: config.childGender ?? null,
              textZone: pageStoryboard.textZone,
              pageLayoutStyle: pageStoryboard.pageLayoutStyle,
              extraNegativeRules: config.extraNegativeRules,
              propDNA: config.propDNA,
              childStructured: config.childStructured,
              companionStructured: config.companionStructured,
              childExpressionAnchorKind: pageChildExpressionKind,
              printPdfOptimized: !!config.pdfEnabled,
              style02ChildVisualLock,
              style02WardrobeLock,
              style02CompanionTextLock,
              ...style01PipelineFields,
              ...visualDirectorPageFields,
            });
          },
          page.pageNumber,
          'page-render'
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (!image) {
      const attemptLabel =
        config.photoQuality?.status === 'warning' ? '2 warning candidates' : `${MAX_PAGE_ATTEMPTS} attempts`;
      const reason = formatImageGenFailureReason(lastError);
      console.error(
        `[ImageGen] Page ${page.pageNumber} FAILED after ${attemptLabel} | ${reason} | raw=${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`
      );
      failedPages.push(page.pageNumber);
      continue;
    }

    if (
      resemblesMonitorEnabled &&
      expectedCharacterIds.includes('child') &&
      characterAnchors.child &&
      !shouldRunAnchorElection
    ) {
      const monitorThreshold = resolveEffectiveThreshold(normalizedStyle.toLowerCase(), thresholdConfig);
      try {
        const monitor = await scoreResemblanceAgainstReference({
          referenceImageUrl: characterAnchors.child,
          candidateImageUrl: image.url,
          effectiveThreshold: monitorThreshold,
          minAcceptableScore: thresholdConfig.minAcceptableScore,
        });
        await emitResemblanceAudit({
          orderId: config.orderId,
          pageNumber: page.pageNumber,
          selected: true,
          model: image.provider,
          styleId: normalizedStyle,
          resemblanceScore: monitor.resemblanceScore,
          threshold: monitorThreshold,
          minAcceptableScore: thresholdConfig.minAcceptableScore,
          softFailBand: thresholdConfig.softFailBand,
          extremeMargin: thresholdConfig.extremeMargin,
          faceDetectConfidence: monitor.faceDetectConfidence,
          faceAreaRatio: monitor.faceAreaRatio,
          sanityDisagreement:
            monitor.sanityFlags.embeddingMismatch ||
            monitor.sanityFlags.colorMismatch ||
            monitor.sanityFlags.geometryWeird,
          source: 'page_monitor',
        });
      } catch (monitorError) {
        console.warn(
          `[ResemblanceCore] page monitor failed non-fatally: ${
            monitorError instanceof Error ? monitorError.message : String(monitorError)
          }`
        );
      }
    }

    results.set(page.pageNumber, image);
    generatedPages.add(page.pageNumber);
    newPagesGenerated += 1;
    // ── Page-output-as-anchor (May 15 regression fix) ──
    // Storing the generated page URL as the child anchor causes every subsequent
    // page to be rendered as images.edit with this page as visual reference. The
    // model copies pose/framing/composition from it, killing storyboard variety.
    // Default: DISABLED. External photo (config.referenceImages) still anchors face.
    // Opt-in: set ENABLE_PAGE_OUTPUT_ANCHOR=1 to restore the May 15 behavior.
    const newlyResolvedAnchors: Record<string, string> = {};
    if (process.env.ENABLE_PAGE_OUTPUT_ANCHOR === '1') {
      for (const characterId of assignedCharacterIds) {
        if (characterAnchors[characterId]) continue;
        characterAnchors[characterId] = image.url;
        newlyResolvedAnchors[characterId] = image.url;
      }
    }
    console.log(
      `[Image] Page ${page.pageNumber}/${pagesToGenerate.length} — expectedCharacters=[${expectedCharacterIds.join(
        ', '
      )}] unresolved=[${unresolvedCharacterIds.join(', ')}] suitable=[${suitableCharacterIds.join(
        ', '
      )}] assigned=[${assignedCharacterIds.join(
        ', '
      )}] passedAnchors=[${anchorCharacters.map((entry) => entry.characterId).join(', ')}] outputUrl=${image.url}`
    );

    if (Object.keys(newlyResolvedAnchors).length > 0) {
      console.log(
        `[Image] Page ${page.pageNumber}/${pages.length} — newAnchors=[${Object.keys(newlyResolvedAnchors).join(', ')}]`
      );
      if (config.onAnchorsResolved) {
        try {
          await config.onAnchorsResolved(newlyResolvedAnchors);
          console.log('[Image] Anchor updates persisted');
        } catch (persistErr) {
          console.warn(
            `[Image] Anchor persistence failed (non-fatal): ${
              persistErr instanceof Error ? persistErr.message : String(persistErr)
            }`
          );
        }
      }
    } else if (availableAnchorIds.length === 0 && expectedCharacterIds.length > 0) {
      // NOTE: availableAnchorIds tracks dynamic/page-output anchors only.
      // Child identity can still be correctly anchored by the external child photo
      // passed via referenceImages (images.edit path), so do not block on this signal.
      console.warn(
        `[Image] Page ${page.pageNumber} — anchor registry empty for expected characters; proceeding because provider references may still be present`
      );
    }

  }

  console.log(
    `[Image] Complete — ${results.size}/${pagesToGenerate.length} succeeded; failedPages=[${failedPages.join(', ')}]`
  );

  return { results, failedPages, textZones, lightingModes, storyboardPlan };
}
