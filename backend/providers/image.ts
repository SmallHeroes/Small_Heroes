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
import { getStyleContract, normalizeStyleId } from '@/lib/styles';
import { composeVisualDirectorPrompt, type VisualDirectorInput } from '../../lib/visualDirector';
import type { Companion } from '../../lib/companions';
import { generateGPTImage, generateReplicateImage } from '../../lib/generate-image';
import { storeImageFromBuffer, storeImageFromProviderUrl } from '../../lib/image-storage';
import type { BookPageTemplate } from '../../lib/bookPageLayout';
import { isFluxProOverrideActive, resolveImageModelMode, resolveReplicateImageModel } from '../../lib/replicate';
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

/** Force all text zones to top_clear — text is always rendered at the top of the page. */
function normalizeToVerticalZone(_raw: unknown, _pageIndex: number): TextZone {
  return 'top_clear';
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
  directionArchetype?: 'connection' | 'adventure' | 'courage';
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
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
  /** Structured companion identity lock — labeled fields for GPT Image consistency. */
  companionStructured?: {
    species: string;
    size: string;
    coloring: string;
    feature: string;
  };
  /** High-res GPT Image sizing (square) + optional upscale path when PDF add-on purchased. */
  printPdfOptimized?: boolean;
  supportingCharacters?: Array<{
    name: string;
    description: string;
    relationship?: string;
    physicalDescription?: string;
    clothingDefault?: string;
    signatureDetail?: string;
    ageRange?: string;
  }>;
}

export interface GeneratedImage {
  url: string;       // final stored URL
  rawUrl?: string;   // provider URL (may expire)
  width: number;
  height: number;
  provider: string;
  prompt: string;
}

type WarningRetryCandidate = {
  image: GeneratedImage;
  seed: number;
  faceDetectConfidence: number | null;
  faceAreaRatio: number | null;
  faceCount: number | null;
};

function scoreWarningCandidate(candidate: WarningRetryCandidate): number {
  const confidenceScore = candidate.faceDetectConfidence ?? -1;
  const areaScore = candidate.faceAreaRatio ?? -1;
  const faceCountPenalty = candidate.faceCount === 0 ? -0.2 : 0;
  return confidenceScore * 10 + areaScore + faceCountPenalty;
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
  directionArchetype?: 'connection' | 'adventure' | 'courage';
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
  directionArchetype?: 'connection' | 'adventure' | 'courage';
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
  /** Same locks as interior pages when present (from visual bible / story assembly). */
  heroVisualLock?: HeroVisualLock;
  styleLock?: StyleLock;
  entityVisualLock?: EntityVisualLock;
  /** Wizard companion — should appear on cover when present. */
  companion?: { name: string; visualDescription: string };
  /** Structured child identity for cover. */
  childStructured?: { face: string; hair: string; body: string; clothing: string; signature: string };
  /** Structured companion identity for cover. */
  companionStructured?: { species: string; size: string; coloring: string; feature: string };
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
  const directive = (input.compositionDirective ?? '').trim();

  const model = process.env.SCENE_TRANSLATE_MODEL || 'gpt-4o-mini';
  const systemPrompt = [
    "You are an illustration director for a magical children's picture book. Given a page of Hebrew story text and context about the characters, produce a vivid English scene description for an image generation model.",
    '',
    'Rules:',
    '- Describe the VISUAL SCENE with wonder and enchantment — this is a magical storybook, not a documentary',
    '- FOCUS on the single most dramatic/emotional MOMENT in the Hebrew text — not a generic summary',
    '- If the text names a specific object (soccer ball, book, lamp), that EXACT object must appear; do NOT substitute a similar object',
    '- If the text describes emotion or physical state (frozen, scared, laughing), show it in face, posture, gesture, motion — vividly',
    '- Do NOT generalize: generic "kids playing" is WRONG when the Hebrew text describes one specific action',
    '- EMPHASIZE facial expressions and body language',
    '- Include magical visual elements when fitting: glowing particles, sparkles, light, enchanted atmosphere',
    '- Describe the physical environment with rich sensory detail where the story places the action',
    '- Name characters by name (e.g. "Maya"), not generics',
    '- Be concrete and cinematic',
    '- PRESERVE the exact camera angle and composition type from the existing illustration direction — if it says wide shot do NOT shrink to medium; if it says low angle do NOT change to eye level',
    '- PRESERVE the visual hook/opening beat from the existing illustration direction',
    '- NEVER change the principal child appearance: hair color, hair style, clothing, skin tone, and age impression must remain EXACTLY as in the CHARACTER LOCK cues below',
    '- NEVER omit the main child protagonist from this story page illustration — the child MUST appear clearly as the hero',
    companionAllowed
      ? '- If you describe the companion creature, keep its anatomy/colors LOCKED as in the cues — same design as other pages.'
      : '- Do NOT depict or invent a companion creature unless the Hebrew text mentions them.',
    '- Do NOT include style instructions or "no text" suffixes',
    '- Output ONLY the scene description text, nothing else',
    '- 80-120 words',
  ].join('\n');
  const userPrompt = [
    `Page ${input.pageNumber} of ${input.totalPages}.`,
    '',
    ...(directive ? ['COMPOSITION (DO NOT CHANGE):', directive, ''] : []),
    companionAllowed
      ? ''
      : 'COMPANION PRESENCE RULE: The Hebrew story text below does NOT name the companion character by name — do NOT depict the companion creature, mascot, duplicate animals, or extra sidekicks. Only the protagonist(s) explicitly implied by Hebrew text.',
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
    'Rewrite the illustration direction as a vivid English scene (80-120 words).',
    'Keep the camera angle, composition type, and visual hook intact.',
    'Add emotional and action detail from the Hebrew text without contradicting the composition line above.',
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
        max_tokens: 300,
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
      mainCharacterVisibility:
        typeof row.mainCharacterVisibility === 'string' &&
        MAIN_CHARACTER_VISIBILITY.includes(row.mainCharacterVisibility as MainCharacterVisibility)
          ? (row.mainCharacterVisibility as MainCharacterVisibility)
          : i % 5 === 4
            ? 'profile'
            : 'three_quarter',
      protagonistDominance:
        typeof row.protagonistDominance === 'string' &&
        PROTAGONIST_DOMINANCE.includes(row.protagonistDominance as ProtagonistDominance)
          ? (row.protagonistDominance as ProtagonistDominance)
          : 'primary',
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

async function generateStoryboard(book: {
  fullStory: string;
  pages: Array<{ pageNumber: number; bookPageText?: string; imagePrompt: string }>;
  childProfile: string;
  selectedStyle: string;
}): Promise<PageVisualStoryboard[]> {
  const fallback = normalizeStoryboardRows(book.pages, []);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const system = [
    'You are a storyboard planner for children story illustrations.',
    'Return only valid JSON: { "pages": PageVisualStoryboard[] }.',
    'Create one storyboard row per page number provided.',
    'Hard rules:',
    '- do not repeat shotType consecutively',
    '- do not repeat compositionMode consecutively',
    '- each page must include action, environment, and emotion',
    '- each page must include mainCharacterVisibility and protagonistDominance',
    '- default mainCharacterVisibility should be front or three_quarter',
    '- use back_allowed_only_if_needed only when absolutely necessary',
    '- default protagonistDominance should be primary',
  ].join('\n');

  const user = [
    `Selected style: ${book.selectedStyle}`,
    `Child profile: ${book.childProfile}`,
    `Full story:\n${book.fullStory.slice(0, 7000)}`,
    'Pages:',
    ...book.pages.map((p) => `- page ${p.pageNumber}: ${(p.bookPageText ?? p.imagePrompt).slice(0, 500)}`),
    '',
    'Allowed enum values:',
    `shotType: ${SHOT_TYPES.join(', ')}`,
    `compositionMode: ${COMPOSITION_MODES.join(', ')}`,
    'textZone: top_clear (ALWAYS top_clear — text is always rendered at the top of every page)',
    `cameraAngle: ${CAMERA_ANGLES.join(', ')}`,
    `lighting: ${LIGHTING_MODES.join(', ')}`,
    `emotionalTone: ${EMOTIONAL_TONES.join(', ')}`,
    `mainCharacterVisibility: ${MAIN_CHARACTER_VISIBILITY.join(', ')}`,
    `protagonistDominance: ${PROTAGONIST_DOMINANCE.join(', ')}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.STORYBOARD_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const payload = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? '';
    if (!content) return fallback;
    const parsed = extractJsonPayload(content) as { pages?: unknown };
    return normalizeStoryboardRows(book.pages, parsed.pages);
  } catch {
    return fallback;
  }
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
  switch (visibility) {
    case 'front':
      return 'Main character visibility: front view. Keep face fully readable and unobstructed.';
    case 'profile':
      return 'Main character visibility: profile view with clear facial silhouette and expression.';
    case 'back_allowed_only_if_needed':
      return 'Back view is allowed only if the story strictly requires it. Do not make back view the only readable depiction.';
    case 'three_quarter':
    default:
      return 'Main character visibility: three-quarter view. Face must be clearly visible and identifiable.';
  }
}

function storyboardDominanceInstruction(dominance: ProtagonistDominance): string {
  switch (dominance) {
    case 'shared':
      return 'Protagonist dominance: shared framing is allowed, but the protagonist must remain clearly identifiable.';
    case 'background':
      return 'Protagonist dominance: background is allowed only if required by story; keep protagonist still identifiable.';
    case 'primary':
    default:
      return 'Protagonist dominance: primary. The protagonist is the visual anchor of the image.';
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
}): string {
  const source = input.heroVisualLock;
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
  const hair = isVagueVisualPhrase(hairRaw) ? '' : hairRaw;
  const skinTone = isVagueVisualPhrase(skinToneRaw) ? '' : skinToneRaw;
  const face = isVagueVisualPhrase(faceRaw) ? '' : faceRaw;
  const clothing = isVagueVisualPhrase(clothingRaw) ? '' : clothingRaw;
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
  const withExpression = `${compact}. Expressive face - show clear emotions matching the scene.`;
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
function buildImageHardLockBlock(input: ImageHardLockFields): string {
  const lock = input.heroVisualLock;
  const childName = (input.childFirstName ?? input.characterSheet?.mainCharacter.name ?? 'The child').trim() || 'The child';

  let heroLines: string;
  if (!lock) {
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
  const companionNamedInText = companionReferencedInStoryText(input);
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
    `MAIN CHARACTER LOCK:\n${protagonistVisualLock ?? 'Keep the same child identity across all pages: same age impression, hair, skin tone, face shape, and clothing colors.'}`,
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
      'COMPOSITION NATURALISM:',
      'Avoid perfectly centered compositions.',
      'Allow slight asymmetry and natural framing like printed children book illustrations.',
      'Avoid floating characters in empty space.',
      'Scenes must feel like lived moments inside a world, not isolated renders.',
      'NO REPEATED VISUAL PATTERNS: avoid repeating the same camera angle, pose, composition, or framing across pages.',
      'Each page should feel like a different cinematic shot in the same story world.',
    ].join('\n'),
    [
      'ENVIRONMENT:',
      `Show this environment: ${baseEnvironment || 'a child bedroom at night with concrete room details.'}`,
      'Environment must be visible and specific: include furniture, walls, floor, and depth cues.',
      'Avoid empty, blank, or plain white backgrounds.',
    ].join('\n'),
    [
      'CHARACTER + ACTION:',
      `Depict these characters clearly: ${characterNames}.`,
      `Action must be explicit and visible: ${baseAction || 'show a clear physical action tied to the story beat.'}`,
      'Keep character consistency across pages: same hairstyle, same clothing colors, same age appearance.',
      'CAST CONTROL: do not introduce random extra children unless explicitly required by the story.',
      'If another child appears, label as supporting and keep the protagonist visually dominant and identifiable.',
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
  const companionInText = companionReferencedInStoryText(input);
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
      })
    : extractSceneCore(input.pagePrompt);
  const sceneWithComposition = `${compositionDirective}\n\n${scene}`.trim();
  const characterLockLead = buildImageHardLockBlock(input);
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
  const raw = (process.env.IMAGE_PROVIDER ?? 'replicate').trim().toLowerCase();
  if (raw === 'dall-e-3') return 'dall-e-3';
  if (raw === 'gpt-image') return 'gpt-image';
  return 'replicate';
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

  // ── SCENE EXTRACTOR PATH (deterministic assembly from visualDirection) ──
  const vd = input.visualDirection;

  // Build scene deterministically from Scene Extractor output
  const mechanicalScene = vd
    ? [
        `Location: ${vd.locationZone}.`,
        `Action: ${vd.mainAction}.`,
        vd.characterPose ? `Pose: ${vd.characterPose}.` : '',
        vd.visibleObjects?.length ? `Visible objects: ${vd.visibleObjects.slice(0, 5).join(', ')}.` : '',
        typeof vd.emotionVisual === 'string' && vd.emotionVisual.trim().length > 0
          ? `Expression: ${sanitizeEmotion(vd.emotionVisual, input.bookPageText ?? undefined)}.`
          : 'Expression: aligned with scene emotion and action.',
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
  const cs = input.childStructured;
  if (cs && cs.face && cs.hair && cs.clothing) {
    // Compact identity lock — saves attention budget for style rendering
    charParts.push(
      `CHARACTER (locked): ${cs.face}, ${cs.hair}, ${cs.body}. Wearing: ${cs.clothing}${cs.signature ? ` (${cs.signature})` : ''}.`,
    );
  } else if (input.childDescription) {
    charParts.push(`CHARACTER (locked): ${input.childDescription}`);
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

  const cps = input.companionStructured;
  if (input.companion && companionInMustInclude) {
    if (cps && cps.species && cps.coloring) {
      charParts.push(
        `COMPANION (must appear): ${cps.species}, ${cps.size}, ${cps.coloring}, ${cps.feature}.`,
      );
    } else {
      charParts.push(`COMPANION (must appear): ${input.companion.name}, ${input.companion.visualDescription}`);
    }
  } else if (input.companion && companionInMustNotInclude) {
    charParts.push(`NO companion in this scene.`);
  } else if (input.companion) {
    const companionInScene = companionReferencedInStoryText(input);
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
  if (input.supportingCharacters?.length) {
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
  const styleContract = input.illustrationStyle
    ? getStyleContract(input.illustrationStyle)
    : null;
  const styleNudge = styleContract?.imageNudge?.lines?.[0] ?? '';
  const styleRendering = styleContract?.renderingDescription ?? '';
  const styleBlock = isPreview
    ? `MEDIUM LOCK:\n${styleRendering || "Soft watercolor children's book illustration"}. No text or letters.`
    : `MEDIUM LOCK:\n${styleRendering || "Soft watercolor children's book illustration"}. ${styleNudge} No text, no letters, no UI.`;

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

  // Text zone — always enforce top fade for story-bank pages
  if (input.textZone) {
    const tzMap: Record<string, string> = {
      top_clear: 'CRITICAL COMPOSITION: The top 30% of the image MUST gradually fade to a light, calm, low-detail area (soft cream or light wash). No faces, hands, or important objects in the top third. This zone is reserved for text overlay and must be clearly readable.',
      bottom_clear: 'Bottom 30% must be a calm low-detail area for text.',
      left_clear: 'Left 30% open for text.',
      right_clear: 'Right 30% open for text.',
      center_clear: 'Center area open for text.',
    };
    const tzHint = tzMap[input.textZone];
    if (tzHint) compParts.push(tzHint);
  } else {
    // Default: always request top fade even without explicit textZone
    compParts.push('The top 25-30% of the image should fade to a lighter, calmer area for text overlay. Keep important details in the lower 70%.');
  }

  const compositionBlock = compParts.join(' ');

  // ── FIDELITY RULES (Scene Extractor enforcement) ──
  const sceneRules = [
    'RULES:',
    '- Illustrate EXACTLY what is described. Nothing more, nothing less.',
    mustIncludeBlock ? `- ${mustIncludeBlock}` : '',
    mustNotIncludeBlock ? `- ${mustNotIncludeBlock}` : '',
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

  // ── ASSEMBLE: Style → Scene → TextRef → Character → Props → Rules → Composition ──
  // Style/medium FIRST — early tokens disproportionately shape rendering mode.
  const parts = [styleBlock, trimmedScene, textRef, characterBlock, propBlock, sceneRules, compositionBlock].filter(Boolean);
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
  if (propParts.length > 0) {
    console.log(`[gpt_props] page=${input.pageNumber} injected=${propParts.length} props: ${propParts.map(p => p.split(':')[0]).join(', ')}`);
  }
  return fullPrompt;
}

function resolveGPTBookQuality(): 'low' | 'medium' | 'high' {
  const q = process.env.GPT_IMAGE_QUALITY?.trim().toLowerCase();
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return 'high';
}

async function generateWithGPTImage(input: ImageInput): Promise<GeneratedImage> {
  const isPreview = !!input.isDirectionPreview;
  const hiResPdf = !!input.printPdfOptimized;
  const size = isPreview ? '1024x1024' : hiResPdf ? '1536x1536' : '1024x1536';

  const quality = isPreview ? 'medium' : resolveGPTBookQuality();

  const rawPrompt = buildGPTImagePrompt(input);
  const prompt = sanitizePromptForSafety(rawPrompt);

  console.log(
    `[gpt_image_prompt] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} isPreview=${isPreview} size=${size} quality=${quality} promptLen=${prompt.length}`
  );

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await generateGPTImage({
        finalPrompt: prompt,
        negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border',
        size: size as '1024x1024' | '1024x1536' | '1536x1536',
        quality,
      });

      const durableUrl = await storeImageFromBuffer({
        buffer: result.buffer,
        orderId: input.orderId,
        pageNumber: input.pageNumber,
        assetType: input.assetType === 'cover' ? 'cover' : 'page',
        contentType: 'image/png',
      });

      console.log(
        `[gpt_image_done] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber} model=gpt-image-1 ` +
          `quality=${quality} size=${size} promptLen=${prompt.length} duration=${result.durationMs}ms ` +
          `hasReferencePhoto=${result.hasReferencePhoto} url=${durableUrl.slice(0, 80)}...`
      );

      return {
        url: durableUrl,
        rawUrl: durableUrl,
        width: isPreview ? 1024 : hiResPdf ? 1536 : 1024,
        height: isPreview ? 1024 : hiResPdf ? 1536 : 1536,
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
  const parts = useVd ? null : await buildPromptParts(input);
  const cv = parts?.compositionVariation ?? getCompositionVariation(input.pageNumber);
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
    `[image_pipeline_path] orderId=${input.orderId ?? 'unknown'} page=${input.pageNumber}/${input.totalPages} path=${useVd ? 'visual_director' : 'legacy'} postProcess=${isPresentationPostProcessEnabled() ? 'on' : 'off'} styleId=${styleId} model=${expectedModel} aspectRatio=${replicateAspectRatio}`
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
    loraTriggerWord: loraStyle?.pipeline.loraTriggerWord ?? undefined,
    loraStylePrefix: loraStyle?.pipeline.loraStylePrefix ?? undefined,
  });

  if (modelMode === 'development') {
    const isLoraModel = process.env.ENABLE_LORA === 'true' && loraStyle?.pipeline.loraModel;
    if (!isLoraModel && result.model !== expectedModel) {
      throw new Error(
        `[ImageGuard] Development mode expected model ${expectedModel} but got ${result.model}`
      );
    }
    console.warn('[ImageGuard] Development model in use', {
      mode: modelMode,
      expectedModel,
      model: result.model,
      isLora: Boolean(isLoraModel),
      orderId: input.orderId ?? 'unknown',
      pageNumber: input.pageNumber,
    });
  }

  const promptPreview = result.finalPrompt.replace(/\s+/g, ' ').slice(0, 180);
  console.log(
    `[Image] Page ${input.pageNumber}/${input.totalPages} — style=${styleId} | model=${result.model} | promptLen=${result.finalPrompt.length} | outputCount=${result.outputCount} | preview="${promptPreview}" | url=${result.imageUrl}`
  );

  const durableUrl = await storeImageFromProviderUrl({
    providerUrl: result.imageUrl,
    orderId: input.orderId,
    pageNumber: input.pageNumber,
    assetType: input.assetType ?? 'page',
  });

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

function buildGPTCoverPrompt(input: CoverImageInput): string {
  // Use structured child description when available
  const cs = input.childStructured;
  const childDesc = cs && cs.face && cs.clothing
    ? `${cs.face}. ${cs.hair}. ${cs.body}. Wearing: ${cs.clothing}. ${cs.signature}`
    : (input.childDescription ?? '').trim() || 'a young child shown as the story hero';

  // Use structured companion when available, else flat description
  const cps = input.companionStructured;
  let companionDesc = '';
  if (cps && cps.species && cps.coloring) {
    companionDesc = `${cps.species}, ${cps.size}. ${cps.coloring}. ${cps.feature}`;
  } else if (input.companion?.visualDescription) {
    companionDesc = input.companion.visualDescription;
  } else if (input.entityVisualLock) {
    companionDesc = `a small friendly ${input.entityVisualLock.shape}, ${input.entityVisualLock.color}`;
  }

  // Use explicit cover scene description when provided (story-bank path),
  // otherwise fall back to generic warm scene
  const coverSceneDesc = (input.directionStoryPremise ?? '').trim();

  const sceneParts = coverSceneDesc
    ? [
        `Children's book cover illustration: ${childDesc}.`,
        `Scene: ${coverSceneDesc}.`,
        companionDesc ? `Companion: ${companionDesc}.` : '',
        'The child looks curious and engaged (match the story mood).',
        'Warm soft lighting.',
        'Large calm empty zone at top (about 25-35%) for a title overlay later.',
        'ZERO text, letters, or words anywhere in the image.',
      ]
    : [
        `Children's book cover illustration: ${childDesc} stands in a cozy, brightly lit setting.`,
        companionDesc ? `${companionDesc} is nearby, part of the scene.` : '',
        'Warm, inviting mood; safe bedtime-story feeling. The child looks happy and excited.',
        'Bright soft lighting.',
        'Large calm empty zone at top (about 25-35%) for a title overlay later.',
        'ZERO text, letters, or words anywhere in the image.',
      ];

  const scene = sceneParts.filter(Boolean).join(' ');
  const coverStyleContract = input.illustrationStyle
    ? getStyleContract(input.illustrationStyle)
    : null;
  const coverStyleDesc = coverStyleContract?.renderingDescription ?? '';
  const style = coverStyleDesc
    ? `${coverStyleDesc}. Book cover composition. Cheerful and bright. No text, no letters, no title, no words.`
    : "Soft watercolor children's book cover. Light cream background. Cheerful and bright. No text, no letters, no title, no words.";
  return `${scene}\n\n${style}`;
}

export async function generateBookCover(input: CoverImageInput): Promise<GeneratedImage> {
  const provider = normalizeImageProviderEnv();

  if (provider === 'gpt-image') {
    const rawCoverPrompt = buildGPTCoverPrompt(input);
    const prompt = sanitizePromptForSafety(rawCoverPrompt);
    console.log(`[gpt_cover_prompt] orderId=${input.orderId ?? 'unknown'} promptLen=${prompt.length}`);

    const hiResPdf = !!input.printPdfOptimized;
    const result = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt: 'text, letters, words, numbers, watermark, signature, frame, border, sad, scared, dark, crying',
      size: hiResPdf ? '1536x1536' : '1024x1536',
      quality: 'high',
    });

    const durableUrl = await storeImageFromBuffer({
      buffer: result.buffer,
      orderId: input.orderId,
      pageNumber: 0,
      assetType: 'cover',
      contentType: 'image/png',
    });

    return {
      url: durableUrl,
      rawUrl: durableUrl,
      width: hiResPdf ? 1536 : 1024,
      height: hiResPdf ? 1536 : 1536,
      provider: 'gpt-image-1',
      prompt,
    };
  }

  const pagePrompt = buildCoverPrompt(input);
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
    compositionRules:
      'Cover composition only: keep title-safe area in top 25-40% calm and uncluttered; focal subject in lower-mid area with strong silhouette; avoid centered symmetry and avoid cropped head/hands.',
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
    directionArchetype?: 'connection' | 'adventure' | 'courage';
    directionEmotionalLabel?: string;
    directionStoryPremise?: string;
    extraNegativeRules?: string[];
    propDNA?: Record<string, string>;
    /** Structured child identity lock — threaded to buildGPTImagePrompt for labeled constraints. */
    childStructured?: { face: string; hair: string; body: string; clothing: string; signature: string };
    /** Structured companion identity lock — threaded to buildGPTImagePrompt for labeled constraints. */
    companionStructured?: { species: string; size: string; coloring: string; feature: string };
    /** Larger GPT Image + upscale path for קובץ מוכן להדפסה. */
    pdfEnabled?: boolean;
  }
): Promise<{
  results: Map<number, GeneratedImage>;
  failedPages: number[];
  textZones: Map<number, TextZone>;
  lightingModes: Map<number, Lighting>;
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
  console.log(
    `[Image] Generating ${pagesToGenerate.length} images | ` +
    `style=${normalizedStyle} | ` +
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
  const anchorCandidatesCount = (() => {
    const parsed = Number.parseInt(process.env.RESEMBLANCE_ANCHOR_CANDIDATES ?? '3', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 3;
    return Math.min(parsed, 6);
  })();
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
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
      try {
        const generated = await makeAttempt(attempt);
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

  for (const page of pagesToGenerate) {
    const expectedCharacterIds = page.expectedCharacterIds && page.expectedCharacterIds.length > 0
      ? page.expectedCharacterIds
      : ['child'];
    const pageStoryboard =
      storyboardByPage.get(page.pageNumber) ??
      normalizeStoryboardRows(
        [{ pageNumber: page.pageNumber, imagePrompt: page.imagePrompt, bookPageText: page.bookPageText }],
        []
      )[0];
    textZones.set(page.pageNumber, pageStoryboard.textZone);
    lightingModes.set(page.pageNumber, pageStoryboard.lighting);
    console.log('[storyboard]', {
      page: page.pageNumber,
      shotType: pageStoryboard.shotType,
      compositionMode: pageStoryboard.compositionMode,
      textZone: pageStoryboard.textZone,
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
    const baseReferenceImages = config.referenceImages ?? [];
    const anchorReferenceImages = passedAnchorUrls;
    const mergedReferenceImages = [...new Set([...baseReferenceImages, ...anchorReferenceImages])];
    const referenceImages = mergedReferenceImages.length > 0 ? mergedReferenceImages : undefined;
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
    const isPortrait = /\bportrait|headshot|character sheet|isolated character|reference pose\b/i.test(
      `${page.imagePrompt} ${page.bookPageText ?? ''}`
    );
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
      | 'childFirstName'
      | 'expectedCharacterNames'
      | 'supportingCharacters'
    > = {
      bookPageText: page.bookPageText ?? null,
      stage4Prompt: rawScene || cleanedImagePrompt,
      rawScenePrompt: page.rawScenePrompt || null,
      visualDirection: page.visualDirection ?? null,
      childFirstName: config.childName ?? null,
      expectedCharacterNames: pageExpectedDisplayNames,
      supportingCharacters: page.supportingCharacters ?? [],
    };
    console.log(
      `[Image] Page ${page.pageNumber}/${pagesToGenerate.length} — expectedCharacters=[${expectedCharacterIds.join(', ')}] unresolved=[${unresolvedCharacterIds.join(', ')}] suitable=[${suitableCharacterIds.join(', ')}] assigned=[${assignedCharacterIds.join(', ')}] availableAnchors=[${availableAnchorIds.join(', ')}] passedAnchors=[${anchorCharacters.map((entry) => entry.characterId).join(', ')}]`
    );

    let image: GeneratedImage | null = null;
    let lastError: unknown = null;
    const baseReferenceImage = config.referenceImages?.[0];
    const shouldRunAnchorElection = assignedCharacterIds.includes('child') && !characterAnchors.child && Boolean(baseReferenceImage);

    if (shouldRunAnchorElection && baseReferenceImage) {
      const candidateImages: Array<{ image: GeneratedImage; seed: number }> = [];
      const candidateRows: ResemblanceCandidate[] = [];
      const effectiveThreshold = resolveEffectiveThreshold(normalizedStyle.toLowerCase(), thresholdConfig);
      for (let candidateIndex = 0; candidateIndex < anchorCandidatesCount; candidateIndex++) {
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
              totalPages: pagesToGenerate.length,
              assetType: 'page',
              companion: config.companion ?? null,
              photoQuality: config.photoQuality,
              directionArchetype: config.directionArchetype,
              directionEmotionalLabel: config.directionEmotionalLabel,
              directionStoryPremise: config.directionStoryPremise,
              childAge: config.childAge ?? null,
              childGender: config.childGender ?? null,
              textZone: pageStoryboard.textZone,
              extraNegativeRules: config.extraNegativeRules,
              propDNA: config.propDNA,
              childStructured: config.childStructured,
              companionStructured: config.companionStructured,
              printPdfOptimized: !!config.pdfEnabled,
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
                totalPages: pagesToGenerate.length,
                assetType: 'page',
                companion: config.companion ?? null,
                photoQuality: config.photoQuality,
                directionArchetype: config.directionArchetype,
                directionEmotionalLabel: config.directionEmotionalLabel,
                directionStoryPremise: config.directionStoryPremise,
                childAge: config.childAge ?? null,
                childGender: config.childGender ?? null,
                textZone: pageStoryboard.textZone,
                extraNegativeRules: config.extraNegativeRules,
                propDNA: config.propDNA,
                childStructured: config.childStructured,
                companionStructured: config.companionStructured,
                printPdfOptimized: !!config.pdfEnabled,
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
              totalPages: pagesToGenerate.length,
              assetType: 'page',
              companion: config.companion ?? null,
              photoQuality: config.photoQuality,
              directionArchetype: config.directionArchetype,
              directionEmotionalLabel: config.directionEmotionalLabel,
              directionStoryPremise: config.directionStoryPremise,
              childAge: config.childAge ?? null,
              childGender: config.childGender ?? null,
              textZone: pageStoryboard.textZone,
              extraNegativeRules: config.extraNegativeRules,
              propDNA: config.propDNA,
              childStructured: config.childStructured,
              companionStructured: config.companionStructured,
              printPdfOptimized: !!config.pdfEnabled,
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
    const newlyResolvedAnchors: Record<string, string> = {};
    for (const characterId of assignedCharacterIds) {
      if (characterAnchors[characterId]) continue;
      characterAnchors[characterId] = image.url;
      newlyResolvedAnchors[characterId] = image.url;
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
      console.warn(`[Image] Page ${page.pageNumber} — anchor missing for expected characters, generated without reference`);
    }

  }

  console.log(
    `[Image] Complete — ${results.size}/${pagesToGenerate.length} succeeded; failedPages=[${failedPages.join(', ')}]`
  );

  return { results, failedPages, textZones, lightingModes };
}
