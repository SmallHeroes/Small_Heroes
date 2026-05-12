/**
 * Story Generation Pipeline — 4-Stage Architecture v3
 *
 * Stage 1 — StoryBrain     : emotional core, entity, hero, tone, narrative arc, locked visuals
 * Stage 2 — PageOutline    : page-by-page structure (purpose, beat, focus, characters)
 * Stage 3 — Page Prose     : Hebrew prose per page, narration text
 * Stage 4 — Illustration   : imageSubject, focus, action, mustExclude, imagePrompt
 *
 * Locked visuals (hero, entity, supporting cast) are generated in Stage 1
 * so every downstream stage references them verbatim.
 */

import { STORY_LENGTHS } from '../config/wizard';
import { normalizeIllustrationStyle, STYLE_PROFILES, type FinalIllustrationStyle } from '../config/visual-system';
import type { Companion } from '../../lib/companions';
import { getCategoryBranching } from '../../lib/categoryBranching';

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface FamilyContext {
  parent1?: { name: string; description?: string };
  parent2?: { name: string; description?: string };
  sibling?: { name: string; age?: string; description?: string };
  homeText?: string;
}

export interface StoryInput {
  childName:         string;
  childAge?:         number | null;
  childGender?:      string | null;
  childTraits:       string[];
  childSuperpower?:  string | null;
  familyContext?:    FamilyContext | null;
  topic:             string;
  topicLabel:        string;
  challengeItems:    string[];
  challengeFree?:    string;
  outcomeItems:      string[];
  outcomeFree?:      string;
  helperItems:       string[];
  helperFree?:       string;
  avoidItems:        string[];
  avoidFree?:        string;
  storyLength:       'short' | 'medium' | 'long';
  /** Dev-only override for minimal test runs. Ignored in production. */
  debugPageCount?:   number;
  illustrationStyle: string;
  childImageUrl?:    string | null;
  /** When set, the story must feature this companion as the catalyst (aligned with the magical entity). */
  companionForStory?: Companion | null;
  /** Wizard narrative bucket (e.g. ANGER_FRUSTRATION) — shapes tone, directions, and illustration mood. */
  challengeCategory?: string | null;
  /** Parent answers to category follow-up questions (from wizard). */
  categoryAnswers?: Array<{ questionId?: string; question: string; answer: string; selectedQuickAnswers?: string[] }>;
  directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
  directionTitle?: string;
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
  directionOpeningScenePrompt?: string;
  meaningfulAppearanceRetry?: boolean;
}

/** Appended to Outline + raw-story prompts when a story direction is selected. No-op if no archetype. */
function buildStoryDirectionReinforcementBlock(input: StoryInput | null | undefined): string {
  if (!input?.directionArchetype) return '';
  return `

STORY_DIRECTION_REINFORCEMENT:
- Archetype: ${input.directionArchetype}
- Tone: ${input.directionEmotionalLabel ?? 'not specified'}
- Core premise: ${input.directionStoryPremise ?? 'not specified'}
- Opening context: ${input.directionOpeningScenePrompt ?? 'not specified'}
`;
}

export interface HeroVisualLock {
  sourceImageUrl:     string | null;
  faceShape:          string;
  hair:               string;
  skinTone:           string;
  eyes:               string;
  ageImpression:      string;
  clothing:           string;
  // legacy naming, refers to resemblance logic
  // LEGACY_NAME: kept for compatibility; these are resemblance-oriented prompt guardrails.
  identityGuardrails: string[];
}

export interface StyleLock {
  styleId:            FinalIllustrationStyle;
  colorPalette:       string;
  lightingStyle:      string;
  textureStyle:       string;
  renderingBehavior:  string;
}

export interface EntityVisualLock {
  shape:              string;
  color:              string;
  proportions:        string;
  expressiveStyle:    string;
  consistencyRules:   string[];
}

export interface PageIntent {
  type:
    | 'character_scene'
    | 'action_page'
    | 'world_scene'
    | 'object_symbolic'
    | 'symbolic_page'
    | 'transition_page'
    | 'emotional_closeup'
    | 'minimal_vignette'
    | 'magical_event'
    | 'interaction_page'
    | 'closeup'
    | 'object_focus';
  focus:              'hero' | 'entity' | 'environment';
  camera:             'close' | 'medium' | 'wide';
  background:         'full' | 'partial' | 'minimal';
  emotion:            'excitement' | 'tension' | 'calm';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — StoryBrain
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryBrain {
  emotionalCore: {
    challenge:          string;
    behavioral_pattern: string;
    emotional_shift:    string;
    therapeutic_action: string;
  };
  hero: {
    name:            string;
    core_trait:      string;
    hidden_strength: string;
    growth_action:   string;
    superpower_setup?: string;
    superpower_test?: string;
    superpower_resolution?: string;
  };
  entity: {
    name:         string;
    type:         'external_helper' | 'internal_force' | 'hidden_world' | 'object';
    core_ability: string;
    movement_trigger: string;
    transformation_ability: string;
    rule:         string;
    limitation:   string;
    personality:  string;
    humor_hook:   string;
    metaphor_connection?: string;
  };
  worldTransition: string;
  tone: {
    emotional_tone: string;
    wonder_tone:    string;
    humor_style:    string;
  };
  narrativeCore: {
    problem?:        string;
    escalation?:     string;
    opening:        string;
    inciting_event: string;
    first_reaction: string;
    entity_reveal:  string;
    rule_discovery: string;
    first_attempt:  string;
    failure?:       string;
    midpoint_shift: string;
    climax_action:  string;
    resolution:     string;
    centralMetaphor?: {
      metaphor: string;
      why_it_works: string;
      reframe: string;
    };
  };
  // Locked visual descriptions — generated here, used verbatim in every downstream stage
  visuals: {
    heroVisual:     string;   // English — age, gender, hair, clothing, skin, eyes — LOCKED
    entityVisual:   string;   // English — size, shape, color, texture, movement quality — LOCKED
    worldAnchor:    string;   // English — primary location + 2-3 recurring visual details
    supportingCast: Array<{
      name:          string;
      relationship:  string;
      narrativeRole: 'anchor' | 'contrast' | 'guidance' | 'turning-point' | 'humor' | 'world-color';
      visual:        string;  // English — LOCKED
      oneAction:     string;
    }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Page Outline
// ─────────────────────────────────────────────────────────────────────────────

export type OutlineFocus = 'environment' | 'child' | 'interaction' | 'entity' | 'action' | 'symbolic';

export interface PageOutline {
  page:               number;
  purpose:            string;
  beat:               string;
  emotional_state:    string;
  focus:              OutlineFocus;
  characters_present: string[];
  humor:              string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Page Prose
// ─────────────────────────────────────────────────────────────────────────────

export interface PageProse {
  pageNumber:    number;
  text:          string;
  narrationText: string;
  imageSubject?: string;   // 'environment'|'child'|'interaction'|'entity'|'action'|'symbolic'
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 — Illustration Shot
// ─────────────────────────────────────────────────────────────────────────────

export type ShotType = 'wide' | 'close' | 'action' | 'symbolic' | 'environment' | 'reveal';

/** Structured visual direction from the shot-plan LLM (Phase 5e). */
export interface ShotVisualDirection {
  locationZone:      string;
  mainAction:        string;
  visibleObjects:    string[];
  characterPose:     string;
  emotionVisual:     string;
  lightingSource:    string;
  environmentDetail: string;
  /** Strict scene extractor fields — derived directly from page text */
  textTranslation?:  string;
  mustInclude?:      string[];
  mustNotInclude?:   string[];
  camera?:           string;
  composition?:      string;
}

export interface IllustrationShot {
  pageNumber:   number;
  imageSubject: string;
  shotType:     ShotType;
  action:       string;
  mustExclude:  string[];
  imagePrompt:  string;
  /** LLM scene only, before Flux consistency locks / render brief (for GPT Image). */
  rawScenePrompt?: string;
  /** Concrete who/where/what/lighting — wired for future mechanical prompts; optional if LLM omits. */
  visualDirection?: ShotVisualDirection;
}

type VisualScenePhase =
  | 'familiar_reality'
  | 'emotional_disruption'
  | 'threshold_transition'
  | 'imaginative_world'
  | 'active_transformation'
  | 'resolution_return';

function getVisualScenePhase(pageNumber: number, totalPages: number): VisualScenePhase {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(safeTotal, pageNumber));
  if (safeTotal === 1) return 'resolution_return';
  const progress = (safePage - 1) / (safeTotal - 1);
  if (progress <= 0.05) return 'familiar_reality';
  if (progress <= 0.23) return 'emotional_disruption';
  if (progress <= 0.36) return 'threshold_transition';
  if (progress <= 0.65) return 'imaginative_world';
  if (progress <= 0.78) return 'active_transformation';
  return 'resolution_return';
}

function buildVisualScenePhaseBlock(params: {
  pageNumber: number;
  totalPages: number;
  phase: VisualScenePhase;
  directionArchetype?: string;
  directionEmotionalLabel?: string;
  directionStoryPremise?: string;
}): string {
  const tone = (params.directionEmotionalLabel ?? '').trim().toLowerCase();
  const premise = (params.directionStoryPremise ?? '').trim();
  const archetype = (params.directionArchetype ?? '').trim().toLowerCase();
  const calmFlavor =
    tone.includes('calm') || tone.includes('bed') || tone.includes('sleep') || archetype === 'bedtime';
  const adventureFlavor =
    tone.includes('adventure') || tone.includes('discover') || tone.includes('path') || archetype === 'adventure';
  const fantasyFlavor =
    tone.includes('challenge') ||
    tone.includes('brave') ||
    tone.includes('fantasy') ||
    archetype === 'fantasy';

  const phaseIntent: Record<VisualScenePhase, string[]> = {
    familiar_reality: [
      'Ground the page in an everyday, recognizable setting; no magical-world leap yet.',
      'Keep composition calm and readable while establishing where the child is.',
    ],
    emotional_disruption: [
      'Keep the same familiar place but let lighting/scale/color subtly reflect emotional tension.',
      'The environment should feel charged yet still recognizable as the same world.',
    ],
    threshold_transition: [
      'Show a clear transition moment into an inner/imaginative space (doorway, path, opening, glow, edge).',
      'Make this page feel like crossing a boundary rather than repeating the same room beat.',
    ],
    imaginative_world: [
      'Expand into symbolic/imaginative environments; avoid locking into one repeated room layout.',
      'Keep child/companion design consistent while the world becomes more exploratory and varied.',
    ],
    active_transformation: [
      'Deliver the strongest visual action beat with visible environmental change and dynamic movement.',
      'Use child-safe intensity: urgent and brave, never horror or threatening darkness.',
    ],
    resolution_return: [
      'Return to calmer real or semi-real space with warmer safer lighting and emotional relief.',
      'Do not mirror page 1 exactly; show a visibly changed, healed environment.',
    ],
  };

  const flavorHints: string[] = [];
  if (calmFlavor) {
    flavorHints.push('Flavor: prefer softer lighting transitions and gentle dreamlike safety.');
  }
  if (adventureFlavor) {
    flavorHints.push('Flavor: favor paths, maps, open-space exploration, and discovery framing.');
  }
  if (fantasyFlavor) {
    flavorHints.push('Flavor: favor movement diagonals and challenge-facing momentum while staying child-safe.');
  }
  if (premise) {
    flavorHints.push(`Premise anchor: ${premise.slice(0, 120)}`);
  }

  return [
    'VISUAL_SCENE_PROGRESS:',
    `phase: ${params.phase}`,
    'intent:',
    ...phaseIntent[params.phase].map((line) => `- ${line}`),
    ...flavorHints.map((line) => `- ${line}`),
    'anti_repetition:',
    '- Avoid repeating the same room layout, bed angle, wall composition, or camera framing from adjacent pages.',
    '- Preserve character/style consistency while evolving the environment.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4A — Visual Bible
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualBible {
  style: {
    overallDirection:      string;
    childrenBookReference: string;
    lineQuality:           string;
    renderingStyle:        string;
    brushTexture:          string;
    brushBehavior:         string;   // physical media: stroke type, tool, drag behavior
    pigmentBehavior:       string;   // how color blooms, bleeds, or pools
    paperTexture:          string;   // hot-press / cold-press / rough — grain behavior
    detailLevel:           string;
    colorPalette:          string;
    lighting:              string;
    mood:                  string;
    pageFeel:              string;
    printSuitability:      string;
  };
  layoutRules: {
    bookPageComposition:        string;
    topTextArea:                string;
    mainIllustrationZone:       string;
    safeMargins:                string;
    clutterRules:               string;
    importantElementsPlacement: string;
    textImageRelationship:      string;
  };
  hero: {
    name:                    string;
    lockedVisualDescription: string;
    faceShape:               string;
    hair:                    string;
    eyes:                    string;
    skinTone:                string;
    bodyScale:               string;
    bodyProportions:         string;   // head-to-body ratio, limb lengths
    postureTendencies:       string;   // habitual postures that signal personality
    clothing:                string;
    clothingMaterial:        string;   // fabric type, how it sits, wear details
    visualQuirks:            string[]; // 2–3 recurring details recognizable in silhouette
    signatureDetails:        string[];
    expressionRange:         string[];
    mustStayConsistent:      string[];
  };
  entity: {
    name:                       string;
    lockedVisualDescription:    string;
    shapeLanguage:              string;
    shapeLogic:                 string;   // geometric rule that defines the base form
    surfaceTexture:             string;
    motionFeel:                 string;
    activeStateTransformation:  string;   // how body changes when moving vs. resting
    powerVisualTransformation:  string;   // visible change when using its special ability
    signatureVisualBehavior:    string;
    facialBehavior:             string;
    humorVisualTrait:           string;
    surprisingVisualTrait:      string;   // one trait no other character in the book shares
    mustStayConsistent:         string[];
  };
  world: {
    environmentDescription:   string;
    recurringObjects:         string[];
    roomIdentity:             string;
    backgroundLanguage:       string;
    windowLightBehavior:      string;
    printFriendlyVisualRules: string[];
  };
  illustrationRules: string[];
  heroVisualLock: HeroVisualLock;
  styleLock: StyleLock;
  entityVisualLock: EntityVisualLock;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4B — Page Composition Plan
// ─────────────────────────────────────────────────────────────────────────────

export interface PageComposition {
  pageNumber:           number;
  compositionType:      string;   // e.g. "centered", "rule-of-thirds", "over-shoulder", "wide establishing"
  cameraDistance:       'close' | 'medium' | 'wide';
  cameraAngle:          'eye-level' | 'slightly-above' | 'over-shoulder';
  mainFocus:            string;   // primary visual element the eye goes to first
  secondaryFocus:       string;   // supporting element
  heroPlacement:        string;   // where in frame — e.g. "lower-center", "right third"
  entityPlacement:      string;   // where in frame, or "not present on this page"
  environmentRole:      'background' | 'atmospheric' | 'active';
  topTextAreaPlan:      string;   // what the top 20–30% shows (sky, wall, soft blur, etc.)
  mainIllustrationZone: string;   // description of the middle/lower 70–80% of the image
  backgroundComplexity: 'minimal' | 'moderate' | 'detailed';
  emotion:              string;   // dominant emotional quality of this page's image
  movement:             string;   // direction or energy of visual movement
  consistencyNotes:     string;   // what must match the Visual Bible on this specific page
  printLayoutNotes:     string;   // any PDF/print-specific composition considerations
  visualRhythmRole?:    'reveal' | 'action' | 'pause' | 'wonder' | 'transition' | 'symbolic';
  heroPresence?:        'primary' | 'secondary' | 'absent';
  pageIntent:           PageIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// GeneratedStory — final output (shape unchanged; orchestrator unaffected)
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryConcept {
  centralEntity: {
    name: string; type: string; visualDescription: string;
    behaviorRules: [string, string, string]; strangeDetail: string;
  };
  narrativePurpose: { represents: string; whyItAppears: string; whatItNeedsOrWants: string };
  resilienceLayer: {
    identificationAnchor: string; projectionLogic: string;
    regulationAction: string; transformationMarker: string;
  };
  surpriseOrShift: string;
  emotionalPeak:   string;
  resolution:      { action: string; transformation: string };
}

export interface CharacterSheet {
  mainCharacter:        { name: string; visualDescription: string };
  supportingCharacters: Array<{ name: string; relationship: string; visualDescription: string; narrativeRole?: string }>;
  worldDescription:     string;
}

export interface StoryPage {
  pageNumber:    number;
  text:          string;
  narrationText: string;
  imageSubject:  string;
  imagePrompt:   string;
  /** Clean scene from shot plan before stage-4 wrapping; optional for older stored stories. */
  rawScenePrompt?: string;
  visualDirection?: ShotVisualDirection;
}

export interface QualityResult {
  isValid: boolean;
  errors:  string[];
}

export interface GeneratedStory {
  title:          string;
  coverText:      string;
  characterSheet: CharacterSheet;
  concept:        StoryConcept;
  pages:          StoryPage[];
  visualBible?:          VisualBible;
  pageCompositionPlan?:  PageComposition[];
  heroVisualLock?:       HeroVisualLock;
  styleLock?:            StyleLock;
  entityVisualLock?:     EntityVisualLock;
  /** English cover scene hint for story-bank stories (extracted from metadata). */
  coverSceneHint?:       string;
  meta: {
    provider:         string;
    model:            string;
    tokens?:          number;
    totalTokens?:     number;
    qualityWarnings?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Style tokens
// ─────────────────────────────────────────────────────────────────────────────

export const STYLE_TOKENS: Record<string, string> = {
  pencil_watercolor: STYLE_PROFILES.pencil_watercolor.styleToken,
  realistic_illustrated: STYLE_PROFILES.realistic_illustrated.styleToken,
  whimsical_comic_fantasy: STYLE_PROFILES.whimsical_comic_fantasy.styleToken,
};

// ─────────────────────────────────────────────────────────────────────────────
// LLM primitive
// ─────────────────────────────────────────────────────────────────────────────

interface LLMResult { text: string; tokens: number }

const STORY_STAGE_PREFIXES = ['Brain', 'Outline', 'Prose-3A', 'Prose-3B', 'Prose-3C', 'Prose-3D'] as const;

function isStoryStage(stage: string): boolean {
  return STORY_STAGE_PREFIXES.some((prefix) => stage.startsWith(prefix));
}

function getModelForStage(stage: string, provider: string): string {
  const defaultStoryModel = provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-pro';
  const defaultSupportModel = provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-chat-latest';
  if (isStoryStage(stage)) {
    return process.env.STORY_MODEL || defaultStoryModel;
  }
  return process.env.PIPELINE_SUPPORT_MODEL || process.env.STORY_MODEL || defaultSupportModel;
}

let modelValidated = false;

async function validateStoryModel(): Promise<void> {
  if (modelValidated) return;
  const provider = process.env.STORY_PROVIDER || 'openai';
  if (provider !== 'openai') {
    modelValidated = true;
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    modelValidated = true;
    return;
  }
  const model = process.env.STORY_MODEL || 'gpt-5.3-pro';
  console.log(`[Pipeline] Validating story model: ${model}`);
  try {
    const res = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn(`[Pipeline] WARNING: STORY_MODEL=${model} may not be available (${res.status}). Will attempt anyway — some models are not listed but still work.`);
    } else {
      console.log(`[Pipeline] Story model ${model} confirmed available.`);
    }
  } catch (err) {
    console.warn(`[Pipeline] Could not validate model ${model}: ${String(err)}`);
  }
  modelValidated = true;
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (/\b50[023]\b/.test(msg)) return true;
  if (/\b429\b/.test(msg)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) return true;
  return false;
}

async function callLLMOnce(
  systemPrompt: string,
  userPrompt:   string,
  maxTokens:    number,
  temperature:  number,
  stage:        string,
  jsonMode:     boolean = true,   // false → plain text (Stage 3A)
): Promise<LLMResult> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model = getModelForStage(stage, provider);
  const storyStage = isStoryStage(stage);
  const reasoningEffort = storyStage ? (process.env.STORY_REASONING_EFFORT || '') : '';
  const verbosity = storyStage ? (process.env.STORY_VERBOSITY || '') : '';

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    console.log(`[Pipeline][${stage}] model=${model}, provider=${provider}, jsonMode=${jsonMode}, reasoning=none, verbosity=none`);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });
    if (!res.ok) throw new Error(`[${stage}] Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.content[0].text, tokens: data.usage?.output_tokens ?? 0 };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  console.log(
    `[Pipeline][${stage}] model=${model}, provider=${provider}, jsonMode=${jsonMode}, reasoning=${reasoningEffort || 'none'}, verbosity=${verbosity || 'none'}`
  );

  const callOpenAIWithModel = async (
    modelName: string,
    selectedReasoningEffort: string,
    selectedVerbosity: string
  ): Promise<LLMResult> => {
    const useResponsesAPI = modelName.includes('-pro') || !!selectedReasoningEffort;
    if (useResponsesAPI) {
      const body: Record<string, unknown> = {
        model: modelName,
        max_output_tokens: maxTokens,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      if (selectedReasoningEffort) {
        body.reasoning = { effort: selectedReasoningEffort };
      }
      if (selectedVerbosity) {
        body.text = { verbosity: selectedVerbosity };
      }
      if (jsonMode) {
        body.text = { ...((body.text as Record<string, unknown>) || {}), format: { type: 'json_object' } };
      }

      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        const modelMissing =
          res.status === 404 ||
          errText.includes('does not exist') ||
          errText.includes('not found') ||
          errText.includes('model_not_found');
        if (modelMissing) {
          const fallback = process.env.FALLBACK_STORY_MODEL?.trim() || '';
          if (!fallback) {
            throw new Error(
              `[${stage}] STORY_MODEL=${modelName} is not available for this API key/project. ` +
              `Do not fallback silently. Either request access to ${modelName} or set FALLBACK_STORY_MODEL. ` +
              `Original error: ${res.status} ${errText.slice(0, 200)}`
            );
          }
          console.warn(`[Pipeline][${stage}] ${modelName} unavailable, falling back to FALLBACK_STORY_MODEL=${fallback}`);
          return callOpenAIWithModel(fallback, '', '');
        }
        throw new Error(`[${stage}] OpenAI Responses ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const outputText =
        data.output_text ??
        data.output?.find((item: { type?: string; content?: Array<{ type?: string; text?: string }> }) => item.type === 'message')
          ?.content?.find((contentItem: { type?: string; text?: string }) => contentItem.type === 'output_text')
          ?.text ??
        '';
      const tokens = data.usage?.total_tokens ?? 0;
      return { text: outputText, tokens };
    }

    const body: Record<string, unknown> = {
      model: modelName,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    };
    if (modelName.startsWith('gpt-5.')) {
      body.max_completion_tokens = maxTokens;
    } else {
      body.max_tokens = maxTokens;
      body.temperature = temperature;
    }
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`[${stage}] OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { text: data.choices[0].message.content, tokens: data.usage?.total_tokens ?? 0 };
  };

  return callOpenAIWithModel(model, reasoningEffort, verbosity);
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  stage: string,
  jsonMode: boolean = true,
): Promise<LLMResult> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLMOnce(systemPrompt, userPrompt, maxTokens, temperature, stage, jsonMode);
    } catch (error) {
      const retryable = isTransientError(error);
      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = RETRY_DELAYS[attempt] ?? 8000;
      console.warn(
        `[Pipeline][${stage}] Transient error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms: ${
          error instanceof Error ? error.message.slice(0, 100) : String(error)
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[Pipeline][${stage}] Should not reach here`);
}

function parseJSON<T>(raw: string, stage: string): T {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error(`[Pipeline][${stage}] Parse failed. First 500:`, cleaned.slice(0, 500));
    throw new Error(`[Pipeline][${stage}] Invalid JSON: ${(e as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Generate StoryBrain (includes locked visuals)
// ─────────────────────────────────────────────────────────────────────────────

// PROMPT_ONLY: The text built here is instruction guidance for LLM generation, not runtime-validated business logic.
function buildBrainUserPrompt(input: StoryInput): string {
  const genderWord = input.childGender === 'girl' ? 'ילדה' : 'ילד';
  const traits     = input.childTraits.length > 0 ? input.childTraits.join(', ') : 'not specified';
  const challenge  = [...input.challengeItems, input.challengeFree].filter(Boolean).join(', ');
  const outcome    = [...input.outcomeItems,   input.outcomeFree].filter(Boolean).join(', ');
  const helpers    = [...input.helperItems,    input.helperFree].filter(Boolean).join(', ');
  const avoid      = [...input.avoidItems,     input.avoidFree].filter(Boolean).join(', ');

  const relationLabelForPrompt = (value: string | undefined): string => {
    if (!value) return 'דמות קרובה';
    if (value === 'mother') return 'אמא';
    if (value === 'father') return 'אבא';
    if (value === 'brother') return 'אח';
    if (value === 'sister') return 'אחות';
    if (value === 'other') return 'דמות קרובה';
    // Backward compatibility for previously stored payloads.
    if (value === 'parent') return 'הורה';
    if (value === 'sibling') return 'אח/אחות';
    if (value === 'grandparent') return 'סבא/סבתא';
    if (value === 'friend') return 'חבר/ה';
    return value;
  };

  const collectFamilyLines = (fc: FamilyContext): string[] => {
    const lines: string[] = [];
    if (fc.parent1?.name) lines.push(`parent1: ${fc.parent1.name}${fc.parent1.description ? ` (${fc.parent1.description})` : ''}`);
    if (fc.parent2?.name) lines.push(`parent2: ${fc.parent2.name}${fc.parent2.description ? ` (${fc.parent2.description})` : ''}`);
    if (fc.sibling?.name) lines.push(`sibling: ${fc.sibling.name}${fc.sibling.age ? `, age ${fc.sibling.age}` : ''}${fc.sibling.description ? ` (${fc.sibling.description})` : ''}`);
    if (fc.homeText) lines.push(`home: ${fc.homeText}`);
    return lines;
  };

  let familyContext = '';
  if (input.familyContext) {
    const fc = input.familyContext;
    const parts = collectFamilyLines(fc);
    if (parts.length > 0) familyContext = `\nFAMILY (use at most 1-2 with clear narrative roles):\n${parts.join('\n')}`;
  }

  // PROMPT_ONLY: Direction block below influences model writing style; selection persistence is enforced separately in API/database flow.
  const directionGuidance = input.directionArchetype
    ? `
STORY_DIRECTION (MANDATORY):
- archetype: ${input.directionArchetype}
- title: ${input.directionTitle ?? 'not specified'}
- emotional_label: ${input.directionEmotionalLabel ?? 'not specified'}
- story_premise: ${input.directionStoryPremise ?? 'not specified'}
- opening_scene_hint: ${input.directionOpeningScenePrompt ?? 'not specified'}
- You SHOULD preserve this emotional direction while keeping strong child resemblance and recurring supporting characters.`
    : '';
  const meaningfulAppearanceRetryGuidance = input.meaningfulAppearanceRetry
    ? `
MEANINGFUL_SUPPORTING_CHARACTER_RETRY (CRITICAL):
- At least one supporting character from FAMILY must appear in an active, meaningful interaction with ${input.childName}.
- Use explicit actions (e.g. speaking, helping, guiding, encouraging, hugging, joining an activity) near the supporting character name.
- Keep this natural and selective; do not force all supporting characters into all pages.`
    : '';

  const companionBlock = input.companionForStory
    ? `COMPANION CHARACTER (appears as the hero's ally in this story):
- Name (Hebrew): ${input.companionForStory.name}
- Role: ${input.companionForStory.tagline}
- Narrative function: ${input.companionForStory.narrativeHook}
- English visual (for lock consistency in illustration prompts): ${input.companionForStory.visualDescription}

The companion is the story catalyst — present in key emotional moments, NOT on every page.
Rules for companion presence:
- The companion MUST appear in the opening (scenes 1-2), the emotional turning point (scenes 5-6), and the resolution (scenes 9-10).
- The companion MAY appear in 1-2 other scenes where they add humor, comfort, or surprise.
- Scenes 3-4 and 7-8 should have moments WITHOUT the companion — let the child act independently.
- When the companion appears, give them personality: clumsy attempts to help, exaggerated reactions, physical comedy, surprised expressions.
- The companion is NOT a silent sidekick following the child — they have opinions, make mistakes, and add humor.
- The JSON "entity" in your output should align with this companion.
- Close the final narrative with a moment where the companion acknowledges the child's growth.

`
    : '';

  const branching = getCategoryBranching(input.challengeCategory ?? null);
  const directionMatch = branching?.storyDirections.find(
    (d) => d.flavor === input.directionArchetype,
  );
  const effectiveConstraint = directionMatch?.narrativeOverride
    ?? branching?.treatmentStrategy.narrativeConstraint
    ?? null;
  const treatmentBlock =
    branching?.treatmentStrategy != null
      ? `
TREATMENT STRATEGY (shape tone, arc, and resolution; do not dump verbatim as a list into the child-facing text):
- core_need: ${branching.treatmentStrategy.coreNeed}
- approach: ${branching.treatmentStrategy.approach}
- must_avoid: ${branching.treatmentStrategy.avoid.join(' | ')}
- resolution_type: ${branching.treatmentStrategy.resolutionType}
- NARRATIVE CONSTRAINT (hard rule — may NOT be broken; outranks generic "epic adventure" or "wild imagination" lines elsewhere in the system prompt):
  ${effectiveConstraint}

NARRATIVE CONSTRAINT ENFORCEMENT (MANDATORY):
- The story logic you invent MUST satisfy the NARRATIVE CONSTRAINT above, including in fields world, worldTransition, world.magical_world, and entity.
- If the category forbids escape into a fantasy world / second plane: do NOT set entity.type to hidden_world; do not describe portals, pocket dimensions, or the child walking into a separate "realm." Prefer entity.type "external_helper" or "object". Make world.magical_world an in-place transformation of the *same* real anchor (mood, light, sound, object behavior) or a second *real* room — not a new dimension the child physically enters.
- If the category requires staying in one intimate real space (e.g. night at home) and there is no direction-level override: "two places" in the mind of the model means two micro-locations in the *same* home (bed, hall, window nook) with optional soft dreamlike imagery on the ceiling — not a long adventure somewhere else.
- The plot engine (what actually changes scene to scene) MUST follow: ${branching.treatmentStrategy.approach}
- The final spread MUST show, in the child’s or hero’s *action* (not narrator lecture), the outcome: ${branching.treatmentStrategy.resolutionType}
- TONE: keep ${branching.storyTone.narrativeRegister} and never use these as story drivers, morals, or "lesson endings": ${branching.treatmentStrategy.avoid.join('; ')}
`
      : '';

  const categoryBlock = branching
    ? `EMOTIONAL CATEGORY: ${branching.category} (${branching.hebrewLabel})
PSYCHOLOGICAL FRAME: ${branching.psychologicalMeaning}
${treatmentBlock}
NARRATIVE REGISTER: ${branching.storyTone.narrativeRegister}
ILLUSTRATION MOOD (for image prompts): ${branching.storyTone.illustrationMood}

${directionMatch
  ? `DIRECTION HINT (${directionMatch.id} / ${directionMatch.flavor}): ${directionMatch.promptHint}
REAL_WORLD_ANCHOR (Hebrew props/settings — use in scene staging; paraphrase in child text): ${directionMatch.realWorldAnchor}`
  : ''}

${input.categoryAnswers?.length
  ? `PARENT CONTEXT (shape specifics, do not quote verbatim):
${input.categoryAnswers
  .map((a) => {
    const quick = Array.isArray(a.selectedQuickAnswers) && a.selectedQuickAnswers.length > 0
      ? `\n  QUICK: ${a.selectedQuickAnswers.join(', ')}`
      : '';
    const answerText = (a.answer || '').trim().length > 0 ? a.answer : '(no free text)';
    return `- Q: ${a.question}${quick}\n  A: ${answerText}`;
  })
  .join('\n')}`
  : ''}

`
    : '';

  return `${categoryBlock}${companionBlock}CHILD: ${input.childName}, ${genderWord}, age ${input.childAge ?? 5}
TRAITS: ${traits}
SUPERPOWER: ${input.childSuperpower || 'not specified'}
TOPIC: ${input.topicLabel}
CHALLENGE: ${challenge || 'not specified'}
DESIRED OUTCOME: ${outcome || 'not specified'}
WHAT HELPS: ${helpers || 'not specified'}
WHAT TO AVOID: ${avoid || 'not specified'}${familyContext}${directionGuidance}${meaningfulAppearanceRetryGuidance}

ADDITIONAL CHARACTER RULES (MANDATORY):
- If FAMILY includes supporting characters, at least one supporting character must appear with meaningful action in the story.
- Supporting characters should have a clear role (support / guidance / companion / gentle challenge), never decorative only.
- Do not force all supporting characters into every page. Prefer: child alone, or child + one supporting character.
- Visual staging should stay clear and readable: usually one main subject and at most one supporting character in an image.

Return exactly this JSON structure:
{
  "emotionalCore": {
    "challenge": "specific emotional challenge slug — e.g. fear_of_loud_noises",
    "behavioral_pattern": "what the child actually does: freeze / explode / avoid / shut_down / cling",
    "emotional_shift": "what changes by the end — described as behavior, not feeling",
    "therapeutic_action": "what the child will DO differently after the story"
  },
  "hero": {
    "name": "${input.childName}",
    "core_trait": "one specific non-generic trait used in action",
    "hidden_strength": "a specific ability that can become a visible power in the world",
    "growth_action": "what they learn to DO physically under pressure",
    "superpower_internal_meaning": "the emotional trait behind the power (courage/kindness/focus/attention/imagination etc.)",
    "superpower_external_expression": "child-friendly visible magical ACTIVE expression of that trait in the world (clear, playful, non-violent)",
    "superpower_setup": "how the child's selected superpower appears as visible action early in the story",
    "superpower_test": "how first use of the superpower fails and makes the situation worse",
    "superpower_resolution": "how final successful use of the superpower is the only way to resolve the climax"
  },
  "entity": {
    "name": "short memorable child-friendly sticky name",
    "type": "external_helper | internal_force | hidden_world | object",
    "metaphor_connection": "how this entity embodies or connects to the central metaphor",
    "core_ability": "clear action the entity performs — not abstract",
    "movement_trigger": "specific moment and mechanism that causes the child to physically move through space or be forced to move",
    "transformation_ability": "specific way the entity physically transforms the environment or opens a new enterable space (door/passage/fall/shift)",
    "rule": "when/how it works — simple and powerful",
    "limitation": "when it does NOT work — this creates real tension",
    "personality": "1-2 specific traits",
    "humor_hook": "how it creates light moments — character-based, not random"
  },
  "world": {
    "real_start": "specific grounded place where the story starts",
    "magical_world": "wild transformed world with surprising elements tied to the challenge",
    "world_rules": "short active rules of this world (movement/physics/creatures)"
  },
  "worldTransition": "clear mechanism for real-world to transformed/imaginative environment transition that creates a new enterable space (not just visual effects), including exactly how the child moves into it; this world must reflect the child's challenge directly",
  "tone": {
    "emotional_tone": "adventurous, playful, energetic",
    "wonder_tone": "bold magical spectacle with child-safe stakes",
    "humor_style": "physical, exaggerated, character-driven"
  },
  "narrativeCore": {
    "problem": "clear active danger/problem to solve",
    "escalation": "how the problem grows and starts affecting the world",
    "opening": "real-life grounded scene — specific, no entity",
    "inciting_event": "what disrupts the opening",
    "first_reaction": "what ${input.childName} does (behavior, not feeling)",
    "entity_reveal": "how and where the entity first appears",
    "rule_discovery": "how ${input.childName} learns what the entity can do",
    "first_attempt": "what ${input.childName} tries — and how it partially works",
    "failure": "how the first attempt fails and creates a bigger mess",
    "midpoint_shift": "entity does something unexpected",
    "climax_action": "${input.childName} takes a risky physical action using the power at the right moment",
    "resolution": "what is concretely different — NO moral explanation",
    "centralMetaphor": {
      "metaphor": "what the challenge becomes in story form (concrete, visual, character-based)",
      "why_it_works": "how this metaphor mirrors the real challenge without naming it",
      "reframe": "what the child discovers about the metaphor that changes their relationship to it"
    }
  },
  "visuals": {
    "heroVisual": "English — age, gender, hair (color+type+length), one locked clothing item, skin tone, eye color — LOCKED for all pages",
    "entityVisual": "English — size, shape, color, texture, any movement quality — LOCKED for all pages",
    "worldAnchor": "English — primary location (specific, not generic) + 2-3 recurring visual details",
    "supportingCast": [
      {
        "name": "character name — max 2 total, only those with real narrative roles",
        "relationship": "relationship to hero",
        "narrativeRole": "anchor | contrast | guidance | turning-point | humor | world-color",
        "visual": "English visual description — LOCKED",
        "oneAction": "the single specific thing this character does in the story"
      }
    ]
  }
}`;
}

export async function generateBrain(input: StoryInput): Promise<{ brain: StoryBrain; tokens: number }> {
  if (input.companionForStory) {
    console.info('[Pipeline][Brain] companion', input.companionForStory.id, input.companionForStory.name);
  }
  const system = `You are a master Hebrew children's story author.
Your stories work through metaphor, warmth, and surprise — never through direct lessons or forced bravery.
A great children's story makes the child FEEL something without ever naming the feeling.
If the result names emotions directly, explains feelings, or teaches a lesson — it fails.
If the result has no central metaphor that embodies the challenge — it fails.
Return ONLY JSON.

CRITICAL REQUIREMENTS

1. THE CHILD IS THE HERO
   - The child must actively do things.
   - The child must solve the problem through action.
   - The child must form a meaningful connection with something/someone that changes how they see the challenge.
   - "Feels better" alone is NOT a resolution.

2. SUPERPOWER MUST FEEL REAL
   - The superpower must be visible, active, and world-changing.
   - If input power is abstract, transform it into a visual active power.
   - Bad: "kind heart", "brave inside".
   - Good pattern: creates light shields / freezes sounds / grows bridges / opens paths / slows moments.
   - Keep child-safe, playful, and non-violent.

3. CENTRAL METAPHOR (replaces "wild imagination")
   - Every story must be built around ONE central metaphor/analogy.
   - The metaphor embodies the child's challenge WITHOUT naming it directly.
   - The child encounters something that IS the challenge in transformed form.
   - Examples:
     * Fear of loud noises -> booms that turn out to be a lost giant's footsteps. The giant is sad, not scary.
     * Fear of dark -> shadows that are actually shy night-creatures who need a friend to come out.
     * Separation anxiety -> a little cloud that got separated from its cloud-family and needs help floating back.
     * Anger/frustration -> a friendly dragon whose fire keeps lighting things accidentally — it needs to learn to aim, not to stop.
     * Low confidence -> a tiny seed that thinks it's too small to grow, but it just needs the right song.
   - The metaphor must be CONCRETE and VISUAL — a character, creature, or situation the child interacts with.
   - The resolution comes from the child's RELATIONSHIP with the metaphor changing — not from defeating anything.
   - The scary/hard thing turns out to need the child's help, understanding, or friendship.
   - NEVER write a story where the child "faces their fear directly" or "learns to be brave."
     Instead: the child helps something, befriends something, or discovers something isn't what it seemed.

4. HUMOR IS REQUIRED
   - Include at least one clearly funny character layer in the entity.
   - Humor must be physical/action-based: slips, gets stuck, overreacts, funny chaos, exaggerated mistakes.
   - There must be at least one real laugh moment.

5. ENTITY MUST BE INTERESTING
   - The entity should have personality, quirks, and needs.
   - It can be vulnerable, funny, lost, or confused.
   - The entity does not need to physically drag the child; relational pull is valid.

6. REAL FAILURE BEFORE SUCCESS
   - The first failure should come from misunderstanding, not lack of "power level."
   - The child may misread the situation first, then understand what is really needed.

7. FINAL CLIMAX MUST BE A CHOICE
   - The child makes a visible decision that shows growth.
   - It can be physical (approach, reach, stay) or relational (offer help, extend trust), but must be SHOWN through action.
   - Not allowed: abstract explanation of growth.

ADDITIONAL HARD RULES

8. The entity rule must create tension and force a real choice between hiding/escaping vs staying/acting.
9. The limitation must matter and create risk in climax.
10. The child's power must be structurally required:
    - visible early as concrete action
    - tested under pressure and fails/partially fails
    - required for final resolution (cannot resolve without it)
11. The world must visibly react to actions:
    - objects shift, paths move, physics bends, sounds/creatures react.
12. Include exactly one WOW moment: surprising visual transformation specific to this power/entity.
13. Parents/supporting cast cannot solve the core problem.
14. Keep language concise, visual, and action-first. No therapy language, no moralizing.`;

  const brainBranching = getCategoryBranching(input.challengeCategory ?? null);
  const brainDirectionMatch = brainBranching?.storyDirections.find((d) => d.flavor === input.directionArchetype);
  const brainNarrativeConstraint = brainDirectionMatch?.narrativeOverride
    ?? brainBranching?.treatmentStrategy.narrativeConstraint
    ?? null;
  const systemWithConstraint =
    system +
    (brainNarrativeConstraint
      ? `

══════════════════════════════════════════════════════════════
CATEGORY NARRATIVE CONSTRAINT — HIGHEST PRECEDENCE
══════════════════════════════════════════════════════════════
${brainNarrativeConstraint}

This constraint OVERRIDES any conflicting line above (including broad fantasy cues like "floating islands", "magical doors" as a separate destination, "new enterable space" as another world, etc.).

Obey the constraint in your JSON. Examples:
- Real-world–only: world.magical_world = the same home/yard *behaving* strangely or brightly; worldTransition = moving between real rooms or a real run outside — not a portal.
- Night / intimate: stay in the bedroom + narrow adjacent real areas; any "wonder" is soft and tied to the same room.
- Light fantasy with return: a brief imaginative beat may appear, but resolution must land in the real situation the parent described.

If a field would violate this constraint, rewrite that field so the child never "escapes" into a second fantasy world when the category forbids it.
══════════════════════════════════════════════════════════════
`
      : '');

  const companionEntityOverride = input.companionForStory
    ? `

ENTITY IDENTITY LOCK (CANNOT BE OVERRIDDEN):
The entity in this story IS the companion character: "${input.companionForStory.name}".
- entity.name MUST be "${input.companionForStory.name}"
- entity.type MUST be "external_helper"
- entity.personality MUST align with: "${input.companionForStory.tagline}"
- entity.humor_hook MUST come from this character's nature
- Do NOT invent a different entity. The companion IS the entity.
- Visual: ${input.companionForStory.visualDescription}
`
    : '';

  const finalSystem = systemWithConstraint + companionEntityOverride;

  const result = await callLLM(finalSystem, buildBrainUserPrompt(input), 2500, 0.85, 'Brain');
  const raw    = parseJSON<Record<string, unknown>>(result.text, 'Brain');
  const brain  = (raw.storyBrain ?? raw.story_brain ?? raw) as StoryBrain;

  if (
    !brain.emotionalCore ||
    !brain.entity ||
    !brain.entity.movement_trigger ||
    !brain.entity.transformation_ability ||
    !brain.narrativeCore ||
    !brain.visuals ||
    !brain.worldTransition
  ) {
    throw new Error('[Pipeline][Brain] Missing required fields (emotionalCore / entity / narrativeCore / worldTransition / visuals)');
  }
  console.log(`[Pipeline][Brain] entity="${brain.entity.name}" challenge="${brain.emotionalCore.challenge}" supportingCast=${brain.visuals.supportingCast?.length ?? 0}`);
  return { brain, tokens: result.tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Generate Page Outline
// ─────────────────────────────────────────────────────────────────────────────

// PROMPT_ONLY: Outline constraints below steer model output quality; enforcement is by downstream checks/retries, not strict validators.
function buildOutlineUserPrompt(
  brain: StoryBrain,
  pageCount: number,
  input?: StoryInput | null,
): string {
  // Scale the structural zones to the actual page count
  const z1end = Math.round(pageCount * 0.2);           // grounded reality
  const z2end = Math.round(pageCount * 0.5);           // tension builds
  const z3end = Math.round(pageCount * 0.7);           // entity + rule
  const z4end = Math.round(pageCount * 0.9);           // action + choice
  // remaining page(s): quiet resolution

  const outlineBranching = getCategoryBranching(input?.challengeCategory ?? null);
  const outlineDirectionMatch = outlineBranching?.storyDirections.find((d) => d.flavor === input?.directionArchetype);
  const narrativeConstraint = outlineDirectionMatch?.narrativeOverride
    ?? outlineBranching?.treatmentStrategy.narrativeConstraint
    ?? null;
  const hasNarrativeOverride = Boolean(outlineDirectionMatch?.narrativeOverride);
  const outlineConstraintBlock =
    narrativeConstraint != null
      ? `

══════════════════════════════════════════════════════════════
CATEGORY NARRATIVE CONSTRAINT (HARD — cannot be violated in this outline)
══════════════════════════════════════════════════════════════
${narrativeConstraint}

How to read the generic outline rules when they might conflict with the above:
- "Two distinct locations" must satisfy the NARRATIVE CONSTRAINT. If the category forbids a separate fantasy world, the two locations are two REAL-PLACE micro-settings (e.g. bedroom and hallway, playroom and porch) or the same room before/after a real change — not a second plane, floating island, or magical kingdom the child literally enters.${hasNarrativeOverride ? '' : ' If the category says stay intimate at night, keep both "locations" inside the home or the bed–hall–window triangle (no long journey elsewhere).'}
- "Transformed/imaginative location" re-reads as: the same place can *feel* transformed (light, sound, shadows, objects) OR you move to a second real small space — not necessarily a new dimension. Do NOT add portals or "step through the door into another world" unless the constraint explicitly allows that kind of fantasy and requires return to the real.
- "Transition into a new enterable space" must NOT be a portal to fantasy when the category forbids escape. Use: open door to another *real* room, stairs, go outside, step into a closet/hall, move under the bed — or an in-place shift that is still the same real geography. ANGER/REGULATION categories: resolution stays in the real situation.
- "Climax location different from opening" still applies, but the alternative is another real micro-location, not a cloud kingdom, unless the constraint allows a brief imaginative interlude and mandates ending in the real.
══════════════════════════════════════════════════════════════
`
      : '';

  return `STORY BRAIN:
${JSON.stringify(brain, null, 2)}

Create a ${pageCount}-page outline.

Structural zones for ${pageCount} pages:
- Pages 1-${z1end}: grounded reality (no entity)
- Pages ${z1end + 1}-${z2end}: tension builds
- Pages ${z2end + 1}-${z3end}: entity appears, rule is discovered
- Pages ${z3end + 1}-${z4end}: action and choice
- Pages ${z4end + 1}-${pageCount}: quiet resolution

For EACH page return:
{
  "page": N,
  "purpose": "what this page does in the story — one clause",
  "beat": "what actually happens — specific event",
  "emotional_state": "hero's internal state — described as sensation or posture, not emotion word",
  "focus": "environment | child | interaction | entity | action | symbolic",
  "characters_present": ["name or entity name"],
  "humor": "small character-based moment if relevant — null if not"
}

Rules:
- Every page advances the story. No recap pages.
- Pages 1-${z1end}: entity NOT present.
- characters_present uses names from brain.visuals.supportingCast and brain.entity.name only.
- No new characters introduced outside the StoryBrain.
- focus must vary — no two consecutive pages with the same focus.
- humor only where brain.entity.humor_hook or brain.entity.personality creates a natural moment.
- The outline MUST include at least 2 distinct locations:
  1) opening real-world location,
  2) transformed/imaginative location.
- Include one explicit transition beat where the real-world location physically transforms or opens a new enterable space and the child moves into it.
- Include at least one first failed attempt BEFORE midpoint (before or at page ${z2end}) where:
  - the child takes action,
  - the attempt clearly fails,
  - stakes get worse (more intense danger/noise/instability),
  - and the entity struggles or loses power.
- The first failed attempt MUST use the child's superpower (from StoryBrain/SUPERPOWER) in an incomplete way.
- Before climax, include at least 2 playful superpower attempts:
  - one attempt clearly fails,
  - one attempt creates a surprising or funny result,
  - both must require adaptation (not instant mastery).
- The entity must drive the progression by forcing transition OR initiating movement, and must react to the child's choices.
- Climax must involve physical ACTION with real risk (something can go wrong), not just deciding, realizing, or calling louder.
- Climax location must be different from the opening location.
- Final resolution must require a second, successful use of the child's superpower.
- Superpower uses must be visible in behavior/action, not described abstractly.
- HARD DEPENDENCY: the story MUST NOT resolve unless the child uses the superpower correctly at the right moment.
- If the child does not act, failure persists and nothing improves.
- The entity cannot solve the problem alone; it can support, but it cannot complete resolution without the child's decisive action.
- At climax, the power must almost fail again before final success (earned success, not smooth success).
- The environment must resist: it reacts unpredictably, does not stabilize immediately, and forces the child to adapt.
- Extend humor as a running beat: include 2–3 humorous entity actions across the outline (not a single isolated moment).
- Use brain.worldTransition, brain.entity.movement_trigger, and brain.entity.transformation_ability directly in the outline logic.
${outlineConstraintBlock}${buildStoryDirectionReinforcementBlock(input)}
Output: { "pages": [ ... ] }`;
}

export async function generateOutline(
  brain:     StoryBrain,
  pageCount: number,
  input?:    StoryInput | null,
): Promise<{ outline: PageOutline[]; tokens: number }> {
  const system = `You are NOT writing a story yet.
You are creating a structured page-by-page outline from a given StoryBrain.
Return JSON only.`;

  const result = await callLLM(system, buildOutlineUserPrompt(brain, pageCount, input), 2500, 0.8, 'Outline');
  const parsed = parseJSON<{ pages?: PageOutline[] } | PageOutline[]>(result.text, 'Outline');
  const outline = Array.isArray(parsed) ? parsed : (parsed as { pages: PageOutline[] }).pages;

  if (!outline || outline.length < pageCount) {
    throw new Error(`[Pipeline][Outline] Expected ${pageCount} pages, got ${outline?.length ?? 0}`);
  }
  console.log(`[Pipeline][Outline] ${outline.length} pages | focuses: ${outline.map(p => p.focus).join(', ')}`);
  return { outline, tokens: result.tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Generate Page Prose (3A: free writing → 3B: page structuring)
// ─────────────────────────────────────────────────────────────────────────────

// ── Stage 3A — Free story generation (plain text, no JSON constraint) ──────────

// ── Reference story for few-shot learning ──────────────────────────────────
const EXAMPLE_STORY = `היו היה פעם, בחדר שלא נראה מיוחד בכלל…
אבל אם היית מקשיב טוב בלילה— היית שומע אותו מתלונן.
לא בקול רם. לא "איי איי איי".
יותר כזה— קירקוש קטן, פיהוק של מגירה, ושמיכה שלוחשת:
"אוףףף… שוב אותו לילה…"

יובל שמעה את זה ראשונה.
היא הרימה גבה אחת. ואז את השנייה.
"אוקיי," היא לחשה לעצמה, "זה חדש."

המנורה הבהבה. לא כי היא התקלקלה—
כי היא ניסתה להגיד משהו.
השטיח התקפל קצת בפינה, כאילו הוא מתכווץ.
והכרית… נפלה מהמיטה.
לא "נפלה".
קפצה.

"מה קורה פה?" יובל לחשה.
ואז—
מתחת למיטה—
נשמע צחקוק.
קטן.
חשוד.

יובל ירדה מהמיטה לאט. לא כי היא פחדה—
כי היא רצתה לתפוס אותו על חם.
היא התכופפה…
והציצה.

ושם—
ישב יצור קטן, עגול, קצת פרוותי, עם אוזניים גדולות מדי—
ולובש פיג'מה.
הוא החזיק ביד… בורג.

"אהה!" הוא אמר בשמחה. "מצאתי אחד!"
יובל מצמצה.
"למה אתה לוקח בורג מהמיטה שלי?"

היצור עצר. חשב.
ואז אמר:
"כי היא מתפרקת."

יובל הביטה במיטה. המיטה הביטה בה בחזרה. (כן, זה היה לילה כזה.)

"מה זאת אומרת מתפרקת?"
היצור נאנח.
"החדר שלך מאבד צורה," הוא אמר, כאילו זה הדבר הכי רגיל בעולם.
"זה קורה לפעמים. כשדברים לא יושבים במקום."

"אבל הכל יושב במקום," יובל אמרה.
היצור הביט בה.
"בטוחה?"

יובל שתקה רגע.
היא חשבה על היום שלה. על כל הדברים שלא ממש הסתדרו. על מחשבות שקפצו לה בראש. על הרגשות שהתבלבלו לה קצת בבטן.
"…אולי לא בדיוק," היא הודתה.

היצור הנהן.
"כן. ככה זה מתחיל. קודם קצת בפנים… ואז גם בחוץ."

באותו רגע—
המגירה נפתחה לבד.
ואז עוד אחת.
ואז כולן.

"אה לא לא לא לא," היצור קם בבהלה. "זה נהיה בלגן אמיתי."
הוא התחיל לרוץ מצד לצד, אוסף ברגים, מסובב כפתורים, מנסה לעצור את החדר—
אבל כלום לא עבד.

השטיח התגלגל. הכיסא הסתובב. המנורה התחילה לשיר (שיר לא משהו).

"זה לא עובד!" הוא צעק. "זה אף פעם לא עובד לבד!"

יובל עמדה באמצע כל זה.
והלב שלה… התחיל לדפוק מהר.

אבל אז—
היא עצרה.
לקחה נשימה.
עוד אחת.
ושמה יד על הלב שלה.

"רגע," היא אמרה.

היצור עצר. גם המנורה הפסיקה לשיר (למזל כולם).

"מה את עושה?" הוא שאל.
יובל לא ענתה מיד.
היא פשוט נשמה.
לאט.
ועוד פעם.

משהו בתוכה התחיל להירגע. והמחשבות— שהיו מקופלות ומבולבלות— התחילו להסתדר קצת.

ואז היא פתחה עיניים.
"זה לא הבורג," היא אמרה. "זה אני."

היצור מצמץ.
"…מה?"

"אני צריכה לסדר את זה מבפנים," היא אמרה, כאילו זה ברור.
הוא גירד באוזן.
"אוקיי… לא ניסיתי את זה אף פעם."

יובל חייכה קצת.
"אז בוא ננסה."

היא לקחה עוד נשימה. דמיינה את המחשבות שלה מסתדרות. אחת ליד השנייה.

ואז—
המגירה נסגרה.
הכיסא עצר.
השטיח נפרש חזרה.
המנורה— הפכה להיות סתם מנורה.

היצור קפא.
"איך עשית את זה?!"
יובל משכה בכתפיים.
"נשמתי."

הוא הביט בה בהערצה.
"זה… הרבה יותר קל מברגים."
"וגם פחות מתגלגלים מתחת למיטה," היא הוסיפה.

היצור צחק.
צחוק אמיתי הפעם.

"טוב," הוא אמר, "אז נראה לי שאני יכול ללכת."
"לאן?" יובל שאלה.
"לעוד חדרים," הוא אמר. "יש הרבה מקומות שמתפרקים בלילה."

הוא התחיל לזחול חזרה מתחת למיטה, אבל אז עצר.
הוציא משהו קטן מהכיס.
בורג.
"למקרה שתצטרכי," הוא קרץ.
"ליתר ביטחון."

יובל לקחה אותו. "תודה."
הוא חייך. ונעלם.

החדר היה שוב שקט.
הכל במקום.

יובל נשכבה במיטה. הסתכלה בתקרה.
נשמה.
והפעם—
הכל הרגיש… יציב.
לא מושלם. לא תמיד מסודר.
אבל שלה.

ולפני שנרדמה—
היא לחשה לעצמה:
"אני יודעת לסדר דברים."
גם אם לפעמים—
הם מתפרקים קצת קודם.`;

const EXAMPLE_STORY_ADVENTURE = `היה לילה שקט בחדר של יואב.
שקט מדי.

כי הגרביים שעל הכיסא—
עשו "פפפפ" קטן.

יואב התיישב.
"סליחה?"

מהחלון קפץ יצור עגלגל עם כובע עקום.
נחת על השטיח.
החליק.
התגלגל לתוך סל כביסה.

"אני בסדר!" הוא צעק מתוך חולצה.
"הכול מתוכנן."

יואב צחק.
"מי אתה?"

"פיץ," אמר היצור,
יוצא עם תחתונים על הראש.
"וממש עכשיו מתחיל מסלול הכוכבים.
באים?"

יואב נעל נעל אחת.
ואז גילה שהשנייה על היד.
"באים."

הם יצאו לחצר.
שביל אבנים מנצנץ נמתח בין העציצים.
הרוח דחפה אותם קדימה כמו נדנדה ארוכה.

בגינה פגשו קיפוד שומר.
הוא בדק כרטיסים עם עלה.
"בלי דגדוג באף, אין מעבר."

פיץ ניסה להראות אומץ,
דרך על ענף,
קפץ "אאוץ'",
ונחת בתוך שיח נענע.

הוא יצא ירוק וריחני.
"עכשיו אני תה."

בהמשך הגיעו לשביל ביערון הקטן.
גשר חבלים רעד מעל נחל דק.
קרש אחד היה חסר.

יואב קפץ ראשון—
והחליק לאחור.
הנעל עפה ונחתה על ראש של ינשופה.

הינשופה נעלבה.
ואז החזירה את הנעל בנימוס:
"פעם הבאה, תכוון."

פיץ ניסה "לעזור" עם חבל.
קשר לעצמו את הזנב.
סיבוב אחד—
פלאק—
ונתלה כמו כביסה.

"זו טכניקה מתקדמת," הוא אמר הפוך.

יואב עצר.
אסף שלושה מקלות,
הניח אבן רחבה,
ובנה מעבר קטן מעל הקרש החסר.

הוא עבר ראשון.
פיץ זחל אחריו באצילות מפוקפקת.
והינשופה מחאה כנף.

על הגבעה חיכתה להם קופסת פח זעירה.
בפנים: כוכב עץ קטן.

"מזכרת למסיימי מסלול," אמר הקיפוד,
שכבר איכשהו הגיע לפניהם.

הם חזרו הביתה דרך החצר השקטה.
יואב הניח את הכוכב ליד המיטה.
פיץ פיהק.

"מחר שוב?" שאל.

"בטח," אמר יואב.
"אבל בלי סל כביסה."

פיץ הנהן ברצינות.
ואז נפל שוב לתוכו.`;

function buildProse3ASystem(
  childAge: number | null | undefined,
  pageCount: number,
  archetype?: 'bedtime' | 'adventure' | 'fantasy',
): string {
  const age = childAge ?? 5;
  const exampleStory = archetype === 'adventure' ? EXAMPLE_STORY_ADVENTURE : EXAMPLE_STORY;
  return `אתה סופר ילדים ישראלי. הנה דוגמה לסיפור ברמה שאתה חייב לכתוב:

${exampleStory}

═══ למה הסיפור הזה עובד — חייב לעשות אותו דבר ═══

קצב (הכי חשוב!):
רע: "מאיה ראתה צל גדול על הקיר וקצת נבהלה אך אז שמעה רעש מצחיק מתחת למיטה."
טוב:
"ואז—
מתחת למיטה—
נשמע צחקוק.
קטן.
חשוד."

הבדל קריטי: שורות קצרות. ואז קצרות יותר. ואז מילה אחת. שורה חדשה = פאוזה בקריאה בקול. כך כותבים סיפור ילדים שנשמע יפה בקריאה בקול.

עוד דוגמה לקצב:
"לא 'נפלה'.
קפצה."

"לא כי היא פחדה—
כי היא רצתה לתפוס אותו על חם."

קול מספר: המספר הוא חבר של הילד. יש לו הערות סוגריים מצחיקות "(כן, זה היה לילה כזה.)", שובר ציפיות, מדבר ישירות.

מטאפורה: האתגר הופך לדבר פיזי בחדר. לא ליטרלי (חושך=מפלצת) אלא מטאפורי (חדר מתפרק = ילדה שלא מסודרת מבפנים). הטוויסט: הפתרון הוא לא לתקן בחוץ אלא לגלות שזה משקף משהו פנימי.

הומור מאופיין: היצור מנסה לפתור בדרך לא נכונה ברצינות מלאה (ברגים!). הומור שנובע מהאישיות, לא בדיחות.

סיום: אין מוסר. אין "והוא למד ש...". אין "ומאז הכל השתנה". פשוט רגע שקט אחד, חם, ומשפט אחד שקט שהילד לוקח למיטה.

═══ חוקים קשיחים ═══

אורך: כל סצנה חייבת להיות 25-40 מילים בעברית. 2-3 שורות קצרות בלבד. יותר מ-40 = נכשלת. סה"כ ${pageCount} סצנות. כל עמוד = רגע ויזואלי אחד בלבד.

חוק עמוד חי (קריטי — לא ניתן לעקיפה):
כל עמוד חייב לכלול:
- פעולה פיזית ברורה (משהו קורה — לא "מסתכלת", "חושבת", "עומדת")
- תגובה של דמות (מה היא עושה בתגובה)
- שינוי: משהו בסצנה שונה בסוף העמוד ממה שהיה בתחילתו

אסור בשום פנים:
- עמוד תיאורי בלבד ("היא הסתכלה סביב וראתה שהכל שקט")
- עמוד שבו שום דבר לא משתנה
- חזרה על אותו מצב רגשי בלי התקדמות
- שני עמודים רצופים עם אותה פעולה ("ראתה... ראתה... ראתה...")

מבחן: אם מוחקים עמוד והסיפור לא נפגע — העמוד מיותר.

עיצוב: השתמש בשורות קצרות ושבירות שורה כמו בדוגמה. לא פסקאות צפופות — שורות נפרדות ליצירת קצב. כל שורה = נשימה בקריאה בקול.

אסור בהחלט — המילים האלה לא יופיעו בסיפור בשום צורה:
"הרגישה/הרגיש", "חשה/חש", "ידעה/ידע", "פחד", "אומץ", "ביטחון", "שמחה", "עצב",
"נרגעה", "נשמה עמוק" (כתיאור רגשי), "הכל בסדר", "הכל יסתדר",
"החליטה להיות אמיצה", "התגברה על", "למדה ש", "הבינה ש"

במקום לכתוב מה הדמות מרגישה — תראה מה היא עושה. הקורא יבין לבד.

הילד/ה פועל/ת: הילד/ה חייב/ת לעשות דברים — לא רק לצפות. הפתרון חייב לבוא מפעולה של הילד/ה, לא מהיצור ולא ממבוגר.

ויזואליות: כל סצנה = רגע ויזואלי אחד ברור שאפשר לצייר כאיור. לא שני אירועים באותו משפט. תחשוב: מה הילד רואה בתמונה הזו?

דיוק סצנה:
כל סצנה חייבת להיות ספציפית ופיזית:
רע: "היא הלכה ביער וגילתה משהו"
טוב: "היא דרכה על ענף — קראאק! משהו קפץ בתוך השיח"

רע: "השועל עזר לה"
טוב: "השועל תפס את הזנב שלו בפה וגרר אותה קדימה"

כלל: אם אי אפשר לצייר את זה בתמונה אחת ברורה — תשכתב.

שפה: עברית מדוברת לילד בן ${age}. מילים פשוטות שילד שומע בבית.

פורמט: JSON בלבד: { "title": "...", "scenes": [{ "page": 1, "text": "..." }, ...] }`;
}

// PROMPT_ONLY: Prose rules below are generation guidance and should not be interpreted as code-enforced validation.
function buildRawStoryPrompt(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): string {
  const childName = input.childName || 'הילד';
  const age = input.childAge ?? 5;
  const genderHe = (input.childGender === 'girl' || input.childGender === 'female') ? 'בת' : 'בן';

  const companion = input.companionForStory;
  const companionDesc = companion
    ? `${companion.name} — ${companion.tagline}. ${companion.narrativeHook}`
    : (brain.entity?.name ? `${brain.entity.name} — ${brain.entity.personality}` : 'יצור קטן ומצחיק');

  const companionName = companion?.name || brain.entity?.name || 'היצור';

  const topic = input.topicLabel || input.topic || brain.emotionalCore?.challenge || 'אתגר לילי';
  const superpower = input.childSuperpower || 'כוח דמיוני מיוחד';

  // Calculate act boundaries based on page count
  const act1End = Math.ceil(pageCount * 0.25);   // ~25% — fear + introduction
  const act2End = Math.ceil(pageCount * 0.5);     // ~50% — meeting + resistance
  const act3End = Math.ceil(pageCount * 0.75);    // ~75% — exploration + almost-failure
  // act4 = rest — insight + independent action + closure
  const actsBlock = input.directionArchetype === 'adventure'
    ? `מבנה 4 מערכות (חובה!):
- עמודים 1-${act1End}: חדר הילד/ה. משהו לא רגיל קורה (תקלה, תנועה מוזרה, חפץ שזז). ${companionName} מופיע. משהו לא מתנהג "כמו שצריך". הזמנה לצאת.
- עמודים ${act1End + 1}-${act2End}: יציאה אמיתית החוצה. תנועה פיזית (ריצה, טיפוס, קפיצה). מפגש עם מקום ראשון + יצור נוסף. אירוע בלתי צפוי + הומור. כל עמוד = אירוע חדש.
- עמודים ${act2End + 1}-${act3End}: אתגר ממשי — משהו חוסם/מפחיד/נשבר. ${childName} מנסה ונכשל/ת. ${companionName} מנסה לעזור — נכשל בצורה מצחיקה. המצב מחמיר. צריך דרך אחרת.
- עמודים ${act3End + 1}-${pageCount}: פתרון מהילד/ה (לא מ${companionName}!). רגע הצלחה פיזי ברור. חזרה הביתה עם שינוי (חפץ/ידע/חבר). משפט סגירה אחד חם.`
    : `מבנה 4 מערכות (חובה!):
- עמודים 1-${act1End}: פחד והצגה. ${childName} לבד עם האתגר. אין ${companionName} עדיין. בנה מתח.
- עמודים ${act1End + 1}-${act2End}: מפגש עם ${companionName}. חוסר אמון, הומור, אינטראקציה ראשונה מצחיקה.
- עמודים ${act2End + 1}-${act3End}: חקירה ופעולה. ${childName} מנסה, כמעט נכשל/ת, ${companionName} עוזר בדרך מצחיקה ולא נכונה.
- עמודים ${act3End + 1}-${pageCount}: הבנה פנימית, פעולה עצמאית של ${childName}, סגירה רגשית שקטה.`;
  const environmentBlock = input.directionArchetype === 'adventure'
    ? `סביבה: הסיפור מתחיל בחדר הילד/ה (עמוד 1 בלבד!) ומיד יוצא החוצה — לטבע, שבילים, יער, כוכבים, גבעות, נחלים. לפחות 3 מיקומים חיצוניים שונים. החדר הוא רק נקודת ההתחלה.
הרפתקאה = תנועה, גילוי, אתגרים פיזיים, מפגשים עם יצורים. לא "להישאר במקום ולהרגיש". לצאת, לרוץ, לטפס, לגלות.
הומור = היצור עושה דברים מצחיקים פיזית — נופל, מתבלבל, מנסה פתרונות מגוחכים. לא סתם מילים מצחיקות — פעולות מצחיקות.
עולם = חי, מלא יצורים קטנים, צמחים מדברים, אבנים שמתלחשות, דברים שמפתיעים.`
    : input.directionArchetype === 'fantasy'
      ? `סביבה: מרחב אינטימי וקטן — החדר, המסדרון, פינת החלון. הילד/ה נשאר/ת במקום מוכר ועושה מעשה אמיץ קטן.`
      : `סביבה: מרחב ביתי חם — חדר, מסדרון, מרפסת. יצור שמגיע ומלווה. הקרבה היא הפתרון.`;
  const escalationBlock = `
הסלמה (חובה):
כל 2-3 עמודים חייב לקרות לפחות אחד מאלה:
- משהו נהיה יותר מוזר / מפתיע
- אתגר נהיה קשה יותר
- מתגלה מידע חדש שמשנה את המצב
- קורה משהו מצחיק שמשנה כיוון

אם 3 עמודים רצופים באותה "רמה" — זה שטוח. אסור.
`;
  const humorBlock = `
הומור ופשלות (חובה — לא אופציונלי!):
- ${companionName} נכשל לפחות פעם אחת בצורה מצחיקה (נופל, נתקע, מנסה פתרון מגוחך)
- ${childName} מנסה משהו שלא עובד לפחות פעם אחת
- הומור = פעולות מצחיקות, לא מילים מצחיקות. נפילה > בדיחה.
- הכישלון חייב להיות פיזי וניתן לציור (לא "הוא הרגיש טיפשי")
`;

  return `כתוב סיפור חדש עבור ${childName}, ${genderHe} ${age}.
הנושא: ${topic}.
היצור: ${companionDesc}.
הכוח של ${childName}: ${superpower}.

${actsBlock}

${environmentBlock}
${escalationBlock}
${humorBlock}

דגשים:
- בדיוק ${pageCount} סצנות. כל סצנה = רגע ויזואלי אחד שאפשר לצייר. 25-40 מילים בלבד — 2-3 שורות קצרות.
- כל עמוד = רגע אחד בלבד. אם קורים שני דברים — חלק לשני עמודים.
- אל תכתוב מה ${childName} מרגיש/ה — תראה מה הוא/היא עושה. הקורא יבין לבד.
- מטאפורה מרכזית: דבר אחד מוזר שקורה בחדר שמשקף את האתגר הפנימי. לא ליטרלי.
- טוויסט שמפתיע. רגע WOW אחד. 2 רגעים מצחיקים אמיתיים.
- הטקסט צריך לתת מקום לאיור — אם האיור נעלם, הטקסט צריך להרגיש חסר.`;
}

export async function generateRawStory(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ rawStory: string; scenes: Array<{ page: number; text: string }>; tokens: number }> {
  const MIN_WORDS    = pageCount * 20; // ~20 words minimum per page
  const MAX_ATTEMPTS = 2;

  const userPrompt = buildRawStoryPrompt(brain, outline, input, pageCount);
  const systemPrompt = buildProse3ASystem(input.childAge, pageCount, input.directionArchetype);

  console.log(`[Pipeline][Prose-3A] USE_FEWSHOT=${USE_FEWSHOT}`);
  console.log(`[Pipeline][Prose-3A] STORY_MODEL=${process.env.STORY_MODEL || '(not set)'}`);
  console.log(`[Pipeline][Prose-3A] systemPrompt length=${systemPrompt.length} chars`);
  console.log(`[Pipeline][Prose-3A] userPrompt length=${userPrompt.length} chars`);

  let bestText      = '';
  let bestScenes: Array<{ page: number; text: string }> = [];
  let bestWordCount = 0;
  let totalTokens   = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = attempt === 1
      ? userPrompt
      : userPrompt + '\n\nהסיפור הקודם היה קצר מדי. שמור על הקצב והסגנון אבל ודא שכל סצנה מכילה 25-40 מילים — 2-3 שורות קצרות עם משקל רגשי.';

    const result = await callLLM(
      systemPrompt, prompt,
      6000, 1.0, `Prose-3A(${attempt})`,
      true,
    );

    totalTokens += result.tokens;

    let text = '';
    let parsedScenes: Array<{ page: number; text: string }> = [];
    try {
      const parsed = parseJSON<{ scenes?: Array<{ page: number; text: string }> }>(result.text, `Prose-3A(${attempt})`);
      parsedScenes = parsed.scenes ?? (Array.isArray(parsed) ? parsed as Array<{ page: number; text: string }> : []);
      text = parsedScenes.map(s => s.text ?? '').join('\n\n').trim();
      console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${parsedScenes.length} scenes parsed`);
    } catch {
      console.warn(`[Pipeline][Prose-3A] Attempt ${attempt}: JSON parse failed, skipping`);
      continue;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(`[Pipeline][Prose-3A] Attempt ${attempt}: ${wordCount} words, ${parsedScenes.length} scenes`);

    if (wordCount > bestWordCount) {
      bestText = text;
      bestScenes = parsedScenes;
      bestWordCount = wordCount;
    }
    if (wordCount >= MIN_WORDS) break;
  }

  if (!bestText) throw new Error('[Pipeline][Prose-3A] All attempts failed');
  return { rawStory: bestText, scenes: bestScenes, tokens: totalTokens };
}

// ── Stage 3B — Structural page split (JSON) ────────────────────────────────────

/** Hebrew word count targets per printed page (Stages 3B–3D + quality thresholds). */
const PAGE_HEBREW_WORDS_MIN = 20;
const PAGE_HEBREW_WORDS_MAX = 45;

const PROSE_3B_SYSTEM = `You are NOT splitting text.
You are rewriting a story into a children's book.

Input:
- A full story (rawStory)
- A structured outline (pageOutline)

Your task: Rewrite the story into pages.

CRITICAL RULES:

1. Each page must contain ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words. Target the middle of this range naturally.
   Pages below ${PAGE_HEBREW_WORDS_MIN} words are invalid. Pages above ${PAGE_HEBREW_WORDS_MAX} words are invalid.
   1–2 pages near ${PAGE_HEBREW_WORDS_MIN}–32 words is acceptable. 1–2 pages near 48–${PAGE_HEBREW_WORDS_MAX} words is acceptable.
   Most pages should fall naturally in the middle.

2. You MUST expand thin moments:
   - add concrete details
   - extend actions
   - deepen the scene
   Do NOT compress. Do NOT summarize. Do NOT leave fragment pages.

3. Each page must feel like a complete mini-scene:
   - something happens
   - not just description
   - not a fragment

4. Follow the outline: Each page must match its purpose, emotional beat, and focus.

5. Keep the same story: Do not invent a new plot. Do not change the core events.
   But you ARE allowed to enrich and expand.

6. Preserve structure and movement from rawStory:
   - Do NOT collapse multiple locations into one location
   - Do NOT remove or flatten scene transitions
   - Do NOT remove action progression or turning points
   - Preserve the same order of major events

7. If rawStory includes a transition from real-world location to an imaginative/transformed environment,
   that transition MUST remain clearly visible in the paged output.

8. If the climax happens in a different location from the opening in rawStory,
   that MUST remain true after paging.

9. You may only make LIGHT adjustments for page boundaries, flow, and readability.
   You must NOT simplify, summarize, or reframe the story.

10. Maintain strong storytelling:
   - visible actions (not internal thoughts)
   - entity behavior
   - humor moments
   - climax with struggle

11. The climax page MUST include:
   - hesitation
   - physical struggle
   - clear action

12. The ending must SHOW change. No explanation sentences like:
   - "היא הרגישה..."
   - "היא הבינה..."
   Only visible behavior.

13. Assign imageSubject per page — the main visual focus:
   environment | child | entity | interaction | action | symbolic

ACTION ENFORCEMENT — REQUIRED ON EVERY PAGE:

For EACH page you must include:
- At least 2 physical actions (something a character does — moves, picks up, turns, calls out, steps, reaches)
- At least 1 visible change in the environment (something shifts, shakes, lights up, moves, changes)

Do NOT allow pages that only contain:
- feelings or emotional states
- atmosphere or description
- thoughts or internal reactions

Every page must show something happening.
Movement is required on every page.

SIMPLE HEBREW ENFORCEMENT:

Rewrite the text using simple, natural, everyday Hebrew.

Do NOT use:
- poetic metaphors
- abstract comparisons
- unusual or invented phrases

Examples of what to fix:
  Instead of: "אבן שנזרקה אל האגם" → Write: "הרעש היה חזק ופתאומי"
  Instead of: "האור נשבר על הקירות" → Write: "האור זז על הקיר"

The text must sound like something a parent would naturally say out loud.

HEBREW QUALITY AND BALANCE:

- Hebrew must be grammatically correct ✔
- But NOT high-level or literary ✗
- Sentences: short to medium length
- Flow: natural and easy to read aloud
- Fix any unnatural or awkward phrasing — rewrite the sentence if needed
- Do NOT preserve broken or robotic text

Only light sentence-level edits are allowed for readability and page-fit.
Do NOT fully rewrite the story voice or scene structure.
Result: clean, natural, action-driven children's story in Hebrew.

Return valid JSON only in the following format:
{ "pages": [ { "pageNumber": 1, "text": "...", "narrationText": "...", "imageSubject": "..." } ] }`;

function buildStructurePrompt(
  rawStory:  string,
  outline:   PageOutline[],
  pageCount: number,
): string {
  return `RAW STORY:
${rawStory}

PAGE OUTLINE (${pageCount} pages — split the story to match these beats):
${outline.map(p => `Page ${p.page}: [${p.focus}] ${p.beat}`).join('\n')}

Split the story into exactly ${pageCount} pages.

Rules:
- Each page: ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words. Do not cut a sentence in the middle. Pages below ${PAGE_HEBREW_WORDS_MIN} or above ${PAGE_HEBREW_WORDS_MAX} are invalid.
- Each page must follow the corresponding outline beat.
- Preserve rawStory location structure. Do NOT collapse locations into one.
- Preserve all major scene transitions and turning points in the same order.
- Keep real-world → imaginative/transformed environment transitions explicit when present in rawStory.
- If climax location differs from opening location in rawStory, keep that difference after paging.
- Only light adjustments are allowed for page boundaries and readability. Do NOT simplify, summarize, or reframe.
- narrationText: same text with ...... added at natural audio pauses.
- imageSubject: choose one per page — environment | child | interaction | entity | action | symbolic

Return valid JSON in the following format:
{ "pages": [ { "pageNumber": 1, "text": "...", "narrationText": "...", "imageSubject": "..." }, ... ] }`;
}

async function structureStoryToPages(
  rawStory:  string,
  outline:   PageOutline[],
  pageCount: number,
): Promise<{ prose: PageProse[]; tokens: number }> {
  const result = await callLLM(
    PROSE_3B_SYSTEM,
    buildStructurePrompt(rawStory, outline, pageCount),
    6000, 0.3, 'Prose-3B',
    true,  // JSON mode
  );
  const parsed = parseJSON<{ pages?: PageProse[] } | PageProse[]>(result.text, 'Prose-3B');
  const prose  = Array.isArray(parsed) ? parsed : (parsed as { pages: PageProse[] }).pages;
  if (!prose || prose.length < pageCount) {
    throw new Error(`[Pipeline][Prose-3B] Expected ${pageCount} pages, got ${prose?.length ?? 0}`);
  }
  const wordCounts = prose.map(p => {
    const w = (p.text ?? '').replace(/[^\u05D0-\u05EA\u05F0-\u05F4\s]/g, ' ').trim().split(/\s+/).filter((t: string) => t.length > 0).length;
    return `p${p.pageNumber}:${w}w`;
  });
  console.log(`[Pipeline][Prose-3B] ${prose.length} pages | ${wordCounts.join(' ')} | tokens=${result.tokens}`);
  return { prose, tokens: result.tokens };
}

// ── Stage 3C — Hebrew language polish (structure-preserving) ──────────────────

const PROSE_3C_SYSTEM = `You are a Hebrew language editor for a children's book.
Your ONLY job is to polish the Hebrew text on each page.

You must NOT change:
- page count or page order
- imageSubject values
- core events or story beats
- emotional arc or character actions

You MUST fix:
1. Broken or awkward phrasing
2. AI-like or robotic wording
3. Overly poetic, abstract, or literary language
4. Unnatural sentence structures

LENGTH PRESERVATION — CRITICAL:

Each page MUST stay within ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words.
- minimum: ${PAGE_HEBREW_WORDS_MIN} Hebrew words
- maximum: ${PAGE_HEBREW_WORDS_MAX} Hebrew words

Do NOT shorten the text.
If your rewrite makes the text shorter — you MUST expand it back by:
- adding small physical actions
- adding concrete sensory details
- extending the moment with one more step

You are allowed to rewrite sentences.
You are NOT allowed to reduce content.
Do NOT compress. Do NOT summarize.

Goal: polish the Hebrew WITHOUT losing richness or length.
Result: natural Hebrew ✔ | same or slightly longer text ✔ | still ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} words per page ✔

Result must be:
- natural, everyday Hebrew
- grammatically correct
- simple, clear, modern language
- easy read-aloud rhythm
- child-friendly and parent-friendly

Do NOT summarize.
Do NOT add new plot points.
Do NOT make the language literary or poetic.
Do NOT change imageSubject.

Return valid JSON only in the following format:
{ "pages": [ { "pageNumber": 1, "text": "...", "narrationText": "...", "imageSubject": "..." } ] }`;

function buildPolishPrompt(prose: PageProse[], pageCount: number): string {
  return `PAGES TO POLISH (${pageCount} pages):
${JSON.stringify(prose.map(p => ({
  pageNumber:    p.pageNumber,
  text:          p.text,
  narrationText: p.narrationText,
  imageSubject:  p.imageSubject,
})), null, 2)}

Your task: rewrite only the text and narrationText of each page.
Fix awkward, AI-like, poetic, or unnatural Hebrew.
Keep every imageSubject exactly as given.
Keep the same story, same actions, same page structure.

WORD COUNT: each page must contain ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words.
Do NOT shorten. If a rewrite is shorter than the original — expand it back with actions or details.

Return valid JSON in the following format:
{ "pages": [ { "pageNumber": 1, "text": "...", "narrationText": "...", "imageSubject": "..." }, ... ] }`;
}

async function polishStoryPages(
  prose:     PageProse[],
  pageCount: number,
): Promise<{ prose: PageProse[]; tokens: number }> {
  const result = await callLLM(
    PROSE_3C_SYSTEM,
    buildPolishPrompt(prose, pageCount),
    6000, 0.2, 'Prose-3C',
    true,  // JSON mode
  );
  const parsed   = parseJSON<{ pages?: PageProse[] } | PageProse[]>(result.text, 'Prose-3C');
  const polished = Array.isArray(parsed) ? parsed : (parsed as { pages: PageProse[] }).pages;
  if (!polished || polished.length < pageCount) {
    throw new Error(`[Pipeline][Prose-3C] Expected ${pageCount} pages, got ${polished?.length ?? 0}`);
  }
  // Preserve imageSubject from 3B output — 3C must not change it, but enforce as safety net
  const proseMap = new Map(prose.map(p => [p.pageNumber, p]));
  const safe = polished.map(p => ({
    ...p,
    imageSubject: p.imageSubject ?? proseMap.get(p.pageNumber)?.imageSubject ?? 'child',
  }));
  const wordCounts = safe.map(p => {
    const w = (p.text ?? '').replace(/[^\u05D0-\u05EA\u05F0-\u05F4\s]/g, ' ').trim().split(/\s+/).filter((t: string) => t.length > 0).length;
    return `p${p.pageNumber}:${w}w`;
  });
  console.log(`[Pipeline][Prose-3C] ${safe.length} pages polished | ${wordCounts.join(' ')} | tokens=${result.tokens}`);
  return { prose: safe, tokens: result.tokens };
}

// ── Stage 3D — Code-level page length repair ──────────────────────────────────

const PAGE_REPAIR_SYSTEM = `You are expanding a single page of a Hebrew children's book.
The page is too short. Your job is to expand it to ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words.

Rules:
- Keep the same scene and story beat
- Add small physical actions
- Add one or two concrete sensory details
- Extend the moment — do not rush past it
- Keep natural, simple, modern Hebrew
- Do NOT add new characters or plot points
- Do NOT use poetic or abstract language
- Do NOT write generic filler

Return valid JSON only:
{ "text": "...", "narrationText": "..." }`;

function buildRepairPrompt(
  page:     PageProse,
  prevPage: PageProse | null,
  nextPage: PageProse | null,
): string {
  const ctx: string[] = [];
  if (prevPage) ctx.push(`PREVIOUS PAGE (${prevPage.pageNumber}): ${prevPage.text}`);
  if (nextPage) ctx.push(`NEXT PAGE (${nextPage.pageNumber}): ${nextPage.text}`);

  return `PAGE TO EXPAND:
pageNumber: ${page.pageNumber}
imageSubject: ${page.imageSubject ?? 'child'}
current text (${countHebrewWords(page.text ?? '')} Hebrew words — below minimum of ${PAGE_HEBREW_WORDS_MIN}):
${page.text}
${ctx.length > 0 ? `\nCONTEXT:\n${ctx.join('\n')}\n` : ''}
Target: ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX} Hebrew words.
Expand naturally. Add physical actions and concrete details. Keep the same scene and imageSubject.
Do NOT add new characters. Do NOT introduce new plot points. Do NOT write generic filler.

Return valid JSON: { "text": "...", "narrationText": "..." }`;
}

const PAGE_CONTINUATION_SYSTEM = `You are writing a single short sentence to continue a page of a Hebrew children's book.

The sentence must:
1. match the existing scene exactly — same location, same characters, same moment
2. include one clear physical action
3. use simple, natural, everyday Hebrew
4. be 6–12 Hebrew words
5. feel like a natural continuation of the page — not a new scene

VARIATION RULES — CRITICAL:
Each sentence must introduce something slightly different from what already exists on the page.
Choose one of the following types of detail:
- movement of hands or fingers
- movement of eyes or gaze
- movement of body or posture
- a small interaction with an object in the scene
- a visible environmental change (light, sound, movement in the background)

Do NOT:
- repeat the same sentence structure as any sentence already on the page
- reuse the same action pattern (e.g. "הסתכלה" again if already used, "הזיזה את היד" again if already used)
- write generic filler ("היא נשמה עמוק", "הכל היה שקט")
- write abstract or poetic language
- start a new scene
- add new characters or plot points
- change the emotional beat or imageSubject

Return valid JSON only:
{ "sentence": "..." }`;

function buildContinuationPrompt(text: string, imageSubject: string): string {
  return `PAGE TEXT SO FAR:
${text}

imageSubject: ${imageSubject}

Write ONE continuation sentence (6–12 Hebrew words).

Rules:
- Include a physical action not already present in the text above
- Use a different sentence structure from the sentences already written
- Do NOT repeat an action pattern that already appears in the text
- Match the scene and imageSubject exactly
- Simple, natural, everyday Hebrew only

Return valid JSON: { "sentence": "..." }`;
}

async function enforcePageMinimumLength(
  prose:     PageProse[],
  _pageCount: number,
): Promise<{ prose: PageProse[]; tokens: number }> {
  const MIN_WORDS = PAGE_HEBREW_WORDS_MIN;

  // Identify short pages
  const shortPages = prose
    .map((page, index) => ({ page, index, words: countHebrewWords(page.text ?? '') }))
    .filter(({ words }) => words < MIN_WORDS);

  if (shortPages.length === 0) {
    console.log(`[Pipeline][Prose-3D] All pages ≥ ${MIN_WORDS} words. No repairs needed.`);
    return { prose, tokens: 0 };
  }

  console.log(
    `[Pipeline][Prose-3D] ${shortPages.length} short page(s) to repair: ` +
    shortPages.map(({ page, words }) => `p${page.pageNumber}(${words}w)`).join(', '),
  );

  const repairedProse = [...prose];
  let totalTokens = 0;

  for (const { page, index, words } of shortPages) {
    const prevPage = index > 0               ? prose[index - 1] : null;
    const nextPage = index < prose.length - 1 ? prose[index + 1] : null;

    console.log(
      `[Pipeline][Prose-3D] Repairing p${page.pageNumber} (${words}w → target ${PAGE_HEBREW_WORDS_MIN}–${PAGE_HEBREW_WORDS_MAX})...`,
    );

    const result = await callLLM(
      PAGE_REPAIR_SYSTEM,
      buildRepairPrompt(page, prevPage, nextPage),
      800, 0.7, `Prose-3D-p${page.pageNumber}`,
      true,
    );
    totalTokens += result.tokens;

    const repaired = parseJSON<{ text?: string; narrationText?: string }>(
      result.text, `Prose-3D-p${page.pageNumber}`,
    );
    let repairedText      = repaired.text          ?? page.text;
    let repairedNarration = repaired.narrationText ?? page.narrationText;
    let newWords          = countHebrewWords(repairedText ?? '');
    console.log(`[Pipeline][Prose-3D] p${page.pageNumber}: ${words}w → ${newWords}w after LLM`);

    // Safety fallback: if still below minimum, append continuation sentences one at a time
    const MAX_FALLBACK = 5;
    let fallbackIter = 0;
    while (newWords < MIN_WORDS && fallbackIter < MAX_FALLBACK) {
      fallbackIter++;
      const contResult = await callLLM(
        PAGE_CONTINUATION_SYSTEM,
        buildContinuationPrompt(repairedText ?? '', page.imageSubject ?? 'child'),
        120, 0.7, `Prose-3D-cont-p${page.pageNumber}-i${fallbackIter}`,
        true,
      );
      totalTokens += contResult.tokens;
      const cont     = parseJSON<{ sentence?: string }>(contResult.text, `Prose-3D-cont-p${page.pageNumber}`);
      const sentence = (cont.sentence ?? '').trim();
      if (!sentence) break;
      repairedText      = (repairedText      ?? '').trimEnd() + ' ' + sentence;
      repairedNarration = (repairedNarration ?? '').trimEnd() + ' ' + sentence;
      newWords          = countHebrewWords(repairedText);
      console.log(`[Pipeline][Prose-3D] p${page.pageNumber} fallback iter ${fallbackIter}: → ${newWords}w`);
    }
    if (fallbackIter > 0) {
      console.log(`[Pipeline][Prose-3D] p${page.pageNumber}: fallback applied (${fallbackIter} sentence(s) added)`);
    }

    // Preserve pageNumber and imageSubject — only update text fields
    repairedProse[index] = {
      ...page,
      text:          repairedText,
      narrationText: repairedNarration,
    };
    console.log(`[Pipeline][Prose-3D] p${page.pageNumber}: final ${newWords}w`);
  }

  const wordCounts = repairedProse.map(p => {
    const w = countHebrewWords(p.text ?? '');
    return `p${p.pageNumber}:${w}w`;
  });
  console.log(`[Pipeline][Prose-3D] Done | ${wordCounts.join(' ')} | tokens=${totalTokens}`);
  return { prose: repairedProse, tokens: totalTokens };
}

// ── Stage 3 wrapper ───────────────────────────────────────────────────────────

const USE_FEWSHOT = true; // TODO: move to env var

async function generateProse(
  brain:     StoryBrain,
  outline:   PageOutline[],
  input:     StoryInput,
  pageCount: number,
): Promise<{ prose: PageProse[]; rawStory: string; tokens: number }> {
  console.log(`[Pipeline][Prose] USE_FEWSHOT=${USE_FEWSHOT}, pageCount=${pageCount}`);
  // 3A — few-shot story generation (outputs structured scenes)
  console.log('[Pipeline][Prose-3A] Few-shot story generation...');
  const { rawStory, scenes, tokens: t3a } = await generateRawStory(brain, outline, input, pageCount);

  if (USE_FEWSHOT) {
    // Use parsed JSON scenes directly — DO NOT split by \n\n (destroys rhythm)
    console.log(`[Pipeline][Prose] Scenes from 3A JSON: ${scenes.length}`);
    scenes.forEach((s, i) => {
      const words = countHebrewWords(s.text ?? '');
      console.log(`[Pipeline][Prose] Scene ${i + 1}: ${words} Hebrew words, starts: "${(s.text ?? '').trim().substring(0, 60)}..."`);
    });
    const prose: PageProse[] = scenes.map((s, i) => ({
      pageNumber: s.page ?? (i + 1),
      text: (s.text ?? '').trim(),
      narrationText: (s.text ?? '').trim(),
    }));

    while (prose.length < pageCount) {
      const fallbackText = prose[prose.length - 1]?.text || '';
      prose.push({ pageNumber: prose.length + 1, text: fallbackText, narrationText: fallbackText });
    }
    if (prose.length > pageCount) {
      prose.length = pageCount;
    }

    const shortPages = prose.filter(p => countHebrewWords(p.text ?? '') < PAGE_HEBREW_WORDS_MIN);
    if (shortPages.length > 0) {
      console.log(`[Pipeline][Prose-3D] ${shortPages.length} short pages, running repair...`);
      shortPages.forEach(p => {
        const hw = countHebrewWords(p.text ?? '');
        console.log(`[Pipeline][Prose-3D] Page ${p.pageNumber}: ${hw} Hebrew words (min: ${PAGE_HEBREW_WORDS_MIN})`);
        console.log(`[Pipeline][Prose-3D] Text preview: "${(p.text ?? '').substring(0, 80)}..."`);
      });
      const { prose: final, tokens: t3d } = await enforcePageMinimumLength(prose, pageCount);
      return { prose: final, rawStory, tokens: t3a + t3d };
    } else {
      console.log('[Pipeline][Prose-3D] All pages meet minimum, skipping repair.');
      return { prose, rawStory, tokens: t3a };
    }
  }

  // Legacy path (3B → 3C → 3D)
  console.log('[Pipeline][Prose-3B] Structuring into pages...');
  const { prose: prose3b, tokens: t3b } = await structureStoryToPages(rawStory, outline, pageCount);
  console.log('[Pipeline][Prose-3C] Polishing Hebrew...');
  const { prose: prose3c, tokens: t3c } = await polishStoryPages(prose3b, pageCount);
  console.log('[Pipeline][Prose-3D] Enforcing minimum page length...');
  const { prose, tokens: t3d } = await enforcePageMinimumLength(prose3c, pageCount);
  return { prose, rawStory, tokens: t3a + t3b + t3c + t3d };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4A — Visual Bible (locks style, layout, characters, world)
// ─────────────────────────────────────────────────────────────────────────────

// PROMPT_ONLY: Visual bible system prompt is guidance to the model, not a runtime policy engine.
const VISUAL_BIBLE_SYSTEM = `You are a children's book art director — not a prompt engineer.
Your job is to define the complete visual signature of an illustrated children's picture book.
This document is used by an illustrator to paint every page. It must read like a professional brief.

This is NOT image generation. You are LOCKING the visual rules for the whole book.

THE BOOK MUST FEEL LIKE:
- A real, physically printed illustrated children's picture book — tactile and page-aware
- Consistent in character design, art style, and layout across every page
- Suitable for PDF download and physical print on A4/Letter

BANNED WORDS — do not use these anywhere in any field:
vibrant, stunning, beautiful, magical, cozy, detailed, whimsical, enchanting, charming, delightful, heartwarming, soft and warm, full of wonder
These are generic and useless to an illustrator. Replace with physical, measurable description.

HERO DESIGN PRINCIPLES:
Every memorable children's book hero has a distinct body silhouette — not a generic small child.
You must define:
- Exact body proportions: head-to-body ratio, relative limb length, torso size
- Characteristic posture tendencies that signal personality — not just "stands straight"
- Clothing with physical texture: what is the fabric? how does it sit? does it crease or bunch?
- 2–3 small visual quirks that appear on every page — these create recognition even in silhouette

ENTITY DESIGN PRINCIPLES:
The entity must be visually UNIQUE — designed by a character designer, not described in one sentence.
You must define:
- The exact geometric shape logic that defines its base form — NOT "round and fluffy"
- How the body changes between resting state and active state
- A visible transformation when it uses its special ability
- One surprising visual trait that no other character in the book shares

STYLE DIRECTION PRINCIPLES:
Describe style as a print illustrator would — as physical media in action, not mood words.
- Pigment behavior: how does color bloom at edges? does it bleed into paper grain? where does it pool?
- Paper texture: is it hot-press (smooth), cold-press (visible grain), or rough (heavy texture)?
- Brush behavior: what tool makes the primary shapes? what makes the line details? any dry-brush drag?
- Line quality: is line weight variable? is it drawn with fineliner, brush pen, or dip pen?
Describe the medium — not the feeling.

FINAL STYLE CATEGORIES (pick one database id and keep it for the whole book):
- pencil_watercolor
- realistic_illustrated
- whimsical_comic_fantasy
(These map to the three current product looks; do not change mid-story.)

Every field must be concrete, specific, and directly usable by an illustrator.
Return ONLY valid JSON. No prose. No markdown.`;

function buildVisualBiblePrompt(
  brain:             StoryBrain,
  prose:             PageProse[],
  illustrationStyle: FinalIllustrationStyle,
  styleToken:        string,
  childImageUrl:     string | null,
): string {
  const firstPage = prose[0]?.text                               ?? '';
  const midPage   = prose[Math.floor(prose.length / 2)]?.text   ?? '';
  const lastPage  = prose[prose.length - 1]?.text               ?? '';

  const styleProfile = STYLE_PROFILES[illustrationStyle];

  return `ILLUSTRATION STYLE KEY: ${illustrationStyle}
STYLE TOKEN: ${styleToken}
STYLE PROFILE:
${JSON.stringify({
  colorPalette: styleProfile.colorPalette,
  lightingStyle: styleProfile.lightingStyle,
  textureStyle: styleProfile.textureStyle,
  renderingBehavior: styleProfile.renderingBehavior,
}, null, 2)}

UPLOADED CHILD IMAGE (SOURCE OF TRUTH FOR HERO LIKENESS):
${childImageUrl ?? 'none'}

STORY TONE:
${JSON.stringify(brain.tone, null, 2)}

HERO — base character input (you must EXPAND this into detailed design):
name: ${brain.hero.name}
base visual: ${brain.visuals.heroVisual}
core trait: ${brain.hero.core_trait}
hidden strength: ${brain.hero.hidden_strength}
→ Add body proportions, posture tendencies, clothing material, and 2–3 recurring visual quirks.

ENTITY — base character input (you must EXPAND this into detailed design):
name: ${brain.entity.name}
base visual: ${brain.visuals.entityVisual}
personality: ${brain.entity.personality}
humor hook: ${brain.entity.humor_hook}
core ability: ${brain.entity.core_ability}
→ Define shape logic, resting vs. active state transformation, power visual transformation, and one surprising visual trait.

WORLD:
${brain.visuals.worldAnchor}

SUPPORTING CAST:
${JSON.stringify((brain.visuals.supportingCast ?? []).map(c => ({ name: c.name, relationship: c.relationship, visual: c.visual })), null, 2)}

STORY SAMPLE — opening:
${firstPage}

STORY SAMPLE — middle:
${midPage}

STORY SAMPLE — ending:
${lastPage}

PAGE COUNT: ${prose.length}

The book will be exported as a PDF and potentially printed.
It is read by a parent to a child aged 4–7.

The illustration MUST:
- leave space at the TOP of each page for Hebrew text
- feel like a page inside a printed children's picture book
- NOT feel like a poster, digital screen, or standalone AI image
- keep style ID fixed to "${illustrationStyle}" and NEVER mix styles
- generate immutable locks used later by all pages (heroVisualLock, styleLock, entityVisualLock)
- heroVisualLock MUST be the only source of hero appearance truth
- visualBible guidance must not override heroVisualLock/styleLock/entityVisualLock

Return valid JSON exactly matching this structure:
{
  "style": {
    "overallDirection": "...",
    "childrenBookReference": "...",
    "lineQuality": "...",
    "renderingStyle": "...",
    "brushTexture": "...",
    "brushBehavior": "...",
    "pigmentBehavior": "...",
    "paperTexture": "...",
    "detailLevel": "...",
    "colorPalette": "...",
    "lighting": "...",
    "mood": "...",
    "pageFeel": "...",
    "printSuitability": "..."
  },
  "layoutRules": {
    "bookPageComposition": "...",
    "topTextArea": "...",
    "mainIllustrationZone": "...",
    "safeMargins": "...",
    "clutterRules": "...",
    "importantElementsPlacement": "...",
    "textImageRelationship": "..."
  },
  "hero": {
    "name": "...",
    "lockedVisualDescription": "...",
    "faceShape": "...",
    "hair": "...",
    "eyes": "...",
    "skinTone": "...",
    "bodyScale": "...",
    "bodyProportions": "...",
    "postureTendencies": "...",
    "clothing": "...",
    "clothingMaterial": "...",
    "visualQuirks": ["...", "...", "..."],
    "signatureDetails": ["..."],
    "expressionRange": ["..."],
    "mustStayConsistent": ["..."]
  },
  "entity": {
    "name": "...",
    "lockedVisualDescription": "...",
    "shapeLanguage": "...",
    "shapeLogic": "...",
    "surfaceTexture": "...",
    "motionFeel": "...",
    "activeStateTransformation": "...",
    "powerVisualTransformation": "...",
    "signatureVisualBehavior": "...",
    "facialBehavior": "...",
    "humorVisualTrait": "...",
    "surprisingVisualTrait": "...",
    "mustStayConsistent": ["..."]
  },
  "world": {
    "environmentDescription": "...",
    "recurringObjects": ["..."],
    "roomIdentity": "...",
    "backgroundLanguage": "...",
    "windowLightBehavior": "...",
    "printFriendlyVisualRules": ["..."]
  },
  "illustrationRules": [
    "...",
    "The art must feel like a printed children's book page, not a screen-first image",
    "Leave visual breathing room at the top for text",
    "Main action should usually live in the middle or lower two-thirds of the page",
    "Do not place key faces or story actions in the top text zone",
    "Avoid full-frame poster composition",
    "Avoid over-detail that will fight with text readability",
    "Keep character scale, outfit, hair, proportions, and visual quirks consistent across all pages"
  ],
  "heroVisualLock": {
    "sourceImageUrl": "${childImageUrl ?? ''}",
    "faceShape": "...",
    "hair": "...",
    "skinTone": "...",
    "eyes": "...",
    "ageImpression": "...",
    "clothing": "...",
    "identityGuardrails": ["..."]
  },
  "styleLock": {
    "styleId": "${illustrationStyle}",
    "colorPalette": "...",
    "lightingStyle": "...",
    "textureStyle": "...",
    "renderingBehavior": "..."
  },
  "entityVisualLock": {
    "shape": "...",
    "color": "...",
    "proportions": "...",
    "expressiveStyle": "...",
    "consistencyRules": ["..."]
  }
}`;
}

async function generateVisualBible(
  brain:             StoryBrain,
  prose:             PageProse[],
  illustrationStyle: FinalIllustrationStyle,
  styleToken:        string,
  childImageUrl:     string | null,
): Promise<{ visualBible: VisualBible; tokens: number }> {
  const result = await callLLM(
    VISUAL_BIBLE_SYSTEM,
    buildVisualBiblePrompt(brain, prose, illustrationStyle, styleToken, childImageUrl),
    3200, 0.6, 'VisualBible',
    true,
  );
  const parsed = parseJSON<VisualBible>(result.text, 'VisualBible');
  if (
    !parsed.style ||
    !parsed.hero ||
    !parsed.entity ||
    !parsed.world ||
    !parsed.layoutRules ||
    !parsed.illustrationRules ||
    !parsed.heroVisualLock ||
    !parsed.styleLock ||
    !parsed.entityVisualLock
  ) {
    throw new Error('[Pipeline][VisualBible] Missing required fields');
  }
  // Enforce single source of truth for style lock in code.
  const styleProfile = STYLE_PROFILES[illustrationStyle];
  parsed.styleLock = {
    styleId: illustrationStyle,
    colorPalette: styleProfile.colorPalette,
    lightingStyle: styleProfile.lightingStyle,
    textureStyle: styleProfile.textureStyle,
    renderingBehavior: styleProfile.renderingBehavior,
  };
  parsed.heroVisualLock.sourceImageUrl = childImageUrl;
  console.log(`[Pipeline][VisualBible] Done — style="${parsed.style.overallDirection?.slice(0, 60)}" hero="${parsed.hero.name}" entity="${parsed.entity.name}" | tokens=${result.tokens}`);
  return { visualBible: parsed, tokens: result.tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4B — Page Composition Plan (layout, camera, text-safe zones)
// ─────────────────────────────────────────────────────────────────────────────

const COMPOSITION_SYSTEM = `You are a children's book layout director.
Your job is to plan the page composition for each page of a printed illustrated children's book.

This is NOT image generation. You are planning layout, camera, and composition only.

KEY PRINCIPLE: Every page is a BOOK PAGE, not a poster or digital screen.
The top 20–30% of every page must remain visually calm and uncluttered to hold Hebrew text.
Key faces, characters, and story actions must be placed in the middle or lower two-thirds.

COMPOSITION RULES:

1. Top text zone (top 20–30%):
   - Must be calm, uncluttered, readable
   - Use sky, wall, ceiling, soft color field, or gentle gradient
   - Never place character faces or story-critical actions here

2. Main illustration zone (bottom 70–80%):
   - Where the story action, character, and emotion live
   - Characters, entity, key objects, and movements belong here

3. Camera distance MUST vary across pages:
   - close: face and upper body — emotional detail, intimate moment
   - medium: full body or waist-up — character in context
   - wide: full environment with character(s) small — world, scale, atmosphere
   - Never repeat the same cameraDistance more than twice in a row

4. Camera angle:
   - eye-level: default for most pages — reading as equals
   - slightly-above: gentle, safe, warm — good for comfort moments
   - over-shoulder: discovery, looking at entity together with character
   - Do NOT use dramatic low-angle or cinematic hero angles

5. Composition type must vary:
   - centered: entity reveal, emotional climax
   - rule-of-thirds: most action and movement pages
   - over-shoulder: discovery and interaction
   - wide-establishing: world and environment pages
   - close-detail: symbolic, emotional peak, or ending

6. Do NOT create full-frame poster compositions.
7. Do NOT create cinematic edge-to-edge compositions with no breathing room.
8. Do NOT place the hero facing forward as the sole subject of a close portrait.
9. Each page must feel embedded in a book — warm, readable, page-aware.

10. VISUAL RHYTHM LAYER (MANDATORY):
   - Plan each page as one rhythm role:
     reveal | action | pause | wonder | transition | symbolic
   - Avoid long repetition:
     * no more than 2 consecutive pages with same pageIntent.focus
     * no more than 2 consecutive hero-primary pages
     * no more than 2 consecutive identical cameraDistance
   - Hero presence strategy:
     * hero does NOT need to appear on every page
     * at least one page should be hero absent when page count >= 6
     * if hero is absent, scene must still advance story clearly
   - Background strategy:
     * avoid using "full" on almost every page
     * include partial/minimal pages for breathing room and pacing
   - Composition variety:
     * avoid centered poster framing on consecutive pages
     * mix asymmetric placements, directional movement, and negative space
     * keep storybook readability over cinematic spectacle

11. Every page must include an explicit pageIntent object:
   pageIntent = {
     type,       // character_scene | action_page | world_scene | object_symbolic | symbolic_page | interaction_page | transition_page | emotional_closeup | minimal_vignette | magical_event
     focus,      // hero | entity | environment
     camera,     // close | medium | wide
     background, // full | partial | minimal
     emotion     // excitement | tension | calm
   }
   This is mandatory and is consumed downstream by prompt generation and validation.

Return ONLY valid JSON. No prose. No markdown.`;

function buildCompositionPrompt(
  brain:       StoryBrain,
  outline:     PageOutline[],
  prose:       PageProse[],
  visualBible: VisualBible,
): string {
  const pageCount = prose.length;
  const minPartialOrMinimal = Math.max(2, Math.ceil(pageCount * 0.25));
  const maxFullBackground = Math.max(2, pageCount - minPartialOrMinimal);
  const minHeroAbsentPages = pageCount >= 6 ? 1 : 0;
  const proseRef = prose
    .map(p => `p${p.pageNumber}: [${p.imageSubject ?? '?'}] ${(p.text ?? '').slice(0, 80)}`)
    .join('\n');

  return `STORY OVERVIEW:
hero: ${brain.hero.name} — ${visualBible.hero.hair}, ${visualBible.hero.clothing}
entity: ${brain.entity.name} — ${visualBible.entity.shapeLanguage}
world: ${visualBible.world.roomIdentity} — ${visualBible.world.environmentDescription.slice(0, 120)}

VISUAL BIBLE LAYOUT RULES:
bookPageComposition: ${visualBible.layoutRules.bookPageComposition}
topTextArea: ${visualBible.layoutRules.topTextArea}
mainIllustrationZone: ${visualBible.layoutRules.mainIllustrationZone}
importantElementsPlacement: ${visualBible.layoutRules.importantElementsPlacement}
textImageRelationship: ${visualBible.layoutRules.textImageRelationship}

OUTLINE (page beats):
${outline.map(p => `p${p.page}: [focus=${p.focus}] ${p.beat} | present: ${p.characters_present.join(', ')}`).join('\n')}

PROSE REFERENCE (first 80 chars):
${proseRef}

PAGE COUNT: ${prose.length}

Plan the composition for EACH page.
Remember: top 20–30% = calm text zone. Key actions and faces = middle or lower two-thirds.
Camera distance must vary — never repeat the same distance more than twice in a row.

VISUAL RHYTHM TARGETS FOR THIS BOOK:
- max pages with background=full: ${maxFullBackground}
- min pages with background=partial/minimal: ${minPartialOrMinimal}
- min pages where heroPresence=absent: ${minHeroAbsentPages}
- avoid runs longer than 2 pages for: same focus, same heroPresence=primary, same cameraDistance
- use at least 4 distinct visualRhythmRole values across the book

Return valid JSON exactly matching this structure:
{ "pages": [ {
  "pageNumber": 1,
  "compositionType": "...",
  "cameraDistance": "close | medium | wide",
  "cameraAngle": "eye-level | slightly-above | over-shoulder",
  "mainFocus": "...",
  "secondaryFocus": "...",
  "heroPlacement": "...",
  "entityPlacement": "...",
  "environmentRole": "background | atmospheric | active",
  "topTextAreaPlan": "...",
  "mainIllustrationZone": "...",
  "backgroundComplexity": "minimal | moderate | detailed",
  "emotion": "...",
  "movement": "...",
  "consistencyNotes": "...",
  "printLayoutNotes": "...",
  "visualRhythmRole": "reveal | action | pause | wonder | transition | symbolic",
  "heroPresence": "primary | secondary | absent",
  "pageIntent": {
    "type": "character_scene | action_page | world_scene | object_symbolic | symbolic_page | interaction_page | transition_page | emotional_closeup | minimal_vignette | magical_event",
    "focus": "hero | entity | environment",
    "camera": "close | medium | wide",
    "background": "full | partial | minimal",
    "emotion": "excitement | tension | calm"
  }
}, ... ] }`;
}

function inferRhythmRole(page: PageComposition): 'reveal' | 'action' | 'pause' | 'wonder' | 'transition' | 'symbolic' {
  if (page.visualRhythmRole) return page.visualRhythmRole;
  switch (page.pageIntent?.type) {
    case 'action_page':
      return 'action';
    case 'magical_event':
      return 'wonder';
    case 'transition_page':
      return 'transition';
    case 'symbolic_page':
    case 'object_symbolic':
    case 'minimal_vignette':
      return 'symbolic';
    case 'world_scene':
      return 'reveal';
    default:
      return 'pause';
  }
}

function inferHeroPresence(page: PageComposition): 'primary' | 'secondary' | 'absent' {
  if (page.heroPresence) return page.heroPresence;
  const heroPlacement = (page.heroPlacement ?? '').toLowerCase();
  const mainFocus = (page.mainFocus ?? '').toLowerCase();
  const heroAbsent = /not present|absent|off-page|off page|no hero/.test(heroPlacement);
  if (heroAbsent) return 'absent';
  if (mainFocus.includes('hero') || mainFocus.includes('child') || page.pageIntent?.focus === 'hero') return 'primary';
  return 'secondary';
}

async function generatePageCompositionPlan(
  brain:       StoryBrain,
  outline:     PageOutline[],
  prose:       PageProse[],
  visualBible: VisualBible,
  pageCount:   number,
): Promise<{ plan: PageComposition[]; tokens: number }> {
  const result = await callLLM(
    COMPOSITION_SYSTEM,
    buildCompositionPrompt(brain, outline, prose, visualBible),
    3000, 0.5, 'Composition',
    true,
  );
  const parsed = parseJSON<{ pages?: PageComposition[] } | PageComposition[]>(result.text, 'Composition');
  const planRaw = Array.isArray(parsed) ? parsed : (parsed as { pages: PageComposition[] }).pages;
  const plan = (planRaw ?? []).map((page) => ({
    ...page,
    visualRhythmRole: inferRhythmRole(page),
    heroPresence: inferHeroPresence(page),
  }));
  if (!plan || plan.length < pageCount) {
    throw new Error(`[Pipeline][Composition] Expected ${pageCount} pages, got ${plan?.length ?? 0}`);
  }
  for (const page of plan) {
    if (!page.pageIntent) {
      throw new Error(`[Pipeline][Composition] Missing pageIntent for page ${page.pageNumber}`);
    }
  }
  const camSummary = plan.map(p => p.cameraDistance[0].toUpperCase()).join('');  // e.g. MCWMCWMCWM
  const fullBackgroundCount = plan.filter((p) => p.pageIntent?.background === 'full').length;
  const heroAbsentCount = plan.filter((p) => p.heroPresence === 'absent').length;
  console.log(
    `[Pipeline][Composition] ${plan.length} pages | cameras: ${camSummary} | fullBg=${fullBackgroundCount} | heroAbsent=${heroAbsentCount} | tokens=${result.tokens}`,
  );
  return { plan, tokens: result.tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4C — Illustration Shot Plan (consumes VisualBible + CompositionPlan)
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_BANS = [
  'family portrait lineup',
  'multiple characters posed facing camera',
  'group standing and smiling',
  'front-facing character collage',
  'same composition as previous page',
].join(' / ');

function buildPromptContractPrefix(
  pageNumber: number,
  totalPages: number,
  pageIntent: PageIntent | undefined,
  composition: PageComposition | undefined,
  visualBible: VisualBible | null,
  worldAnchor: string,
  previousSceneHint: string,
  directionContext?: {
    directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
    directionEmotionalLabel?: string;
    directionStoryPremise?: string;
  },
): string {
  const heroLock = visualBible?.heroVisualLock ?? null;
  const styleLock = visualBible?.styleLock ?? null;
  const entityLock = visualBible?.entityVisualLock ?? null;
  const intent = pageIntent ?? null;
  const compositionRules = composition
    ? {
        camera: `${composition.cameraDistance}/${composition.cameraAngle}`,
        compositionType: composition.compositionType,
        topTextAreaPlan: composition.topTextAreaPlan,
        mainIllustrationZone: composition.mainIllustrationZone,
        backgroundComplexity: composition.backgroundComplexity,
      }
    : null;
  const visualRhythm = composition
    ? { role: composition.visualRhythmRole ?? null, heroPresence: composition.heroPresence ?? null }
    : null;
  const phase = getVisualScenePhase(pageNumber, totalPages);
  const scenePhaseBlock = buildVisualScenePhaseBlock({
    pageNumber,
    totalPages,
    phase,
    directionArchetype: directionContext?.directionArchetype,
    directionEmotionalLabel: directionContext?.directionEmotionalLabel,
    directionStoryPremise: directionContext?.directionStoryPremise,
  });

  return [
    `PROMPT_CONTRACT_PAGE_${pageNumber}:`,
    'CRITICAL_IMAGE_RULE:',
    'The image must not contain any text, letters, words, captions, labels, titles, logos, signs, watermarks, page numbers, handwriting, symbols, or speech bubbles.',
    'The image must be illustration only.',
    'All story text is rendered separately by the app.',
    `heroVisualLock=${JSON.stringify(heroLock)}`,
    `entityVisualLock=${JSON.stringify(entityLock)}`,
    `styleLock=${JSON.stringify(styleLock)}`,
    `pageIntent=${JSON.stringify(intent)}`,
    `compositionRules=${JSON.stringify(compositionRules)}`,
    `visualRhythm=${JSON.stringify(visualRhythm)}`,
    `environmentContinuity=${JSON.stringify({ previousSceneHint, worldAnchor })}`,
    scenePhaseBlock,
    'rhythmConstraint=follow visualRhythm role and heroPresence; if heroPresence=absent, hero must not appear',
    'compositionVarietyConstraint=avoid centered poster framing; prefer asymmetric storybook composition with readable negative space',
    'likenessConstraint=match uploaded-photo-derived heroVisualLock as stylized likeness; no random child variation; no photoreal clone',
    'textSafeConstraint=top 20-30% must stay calm and uncluttered for Hebrew text',
  ].join(' ');
}

function cameraFeelingForPage(
  composition: PageComposition | undefined,
  pageIntent: PageIntent | undefined,
): string {
  const distance = composition?.cameraDistance ?? pageIntent?.camera ?? 'medium';
  const emotion = pageIntent?.emotion ?? 'calm';
  if (distance === 'close') return emotion === 'tension' ? 'intimate urgency' : 'quiet intimacy';
  if (distance === 'wide') return emotion === 'excitement' ? 'playful breadth' : 'gentle cinematic distance';
  if (emotion === 'tension') return 'observant suspense';
  if (emotion === 'excitement') return 'playful momentum';
  return 'grounded warmth';
}

function lightingMoodForEmotion(emotion: PageIntent['emotion'] | undefined): string {
  if (emotion === 'tension') return 'dark corners cut by one directional light source';
  if (emotion === 'excitement') return 'bright highlights with stronger contrast and visible motion streaks';
  return 'even, low-contrast light with gentle falloff';
}

function splitPromptSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractSceneMoment(shotPrompt: string): { hook: string; action: string } {
  const cleaned = (shotPrompt ?? '')
    .replace(/\s+/g, ' ')
    .replace(/children's book page.*$/i, '')
    .trim();
  const parts = splitPromptSentences(cleaned);
  const hook = parts[0] ?? 'A clear visual beat anchors the page';
  const action = parts[1] ?? parts[0] ?? 'The moment should feel alive and in motion';
  return { hook, action };
}

function chooseForegroundCue(actionBeat: string, zone: string): string {
  const source = `${actionBeat} ${zone}`.toLowerCase();
  if (source.includes('blanket') || source.includes('bed')) return 'the blanket edge spilling into the foreground';
  if (source.includes('light') || source.includes('beam') || source.includes('glow')) return 'a diagonal light trail crossing the foreground';
  if (source.includes('closet') || source.includes('door')) return 'a doorframe cutting into the near foreground';
  if (source.includes('window') || source.includes('curtain')) return 'a curtain fold drifting across the near foreground';
  if (source.includes('object') || source.includes('music box') || source.includes('toy')) return 'a tilted object corner anchoring the foreground';
  return 'a nearby edge element partially framing the scene';
}

function compositionPlacementSentence(
  composition: PageComposition | undefined,
  heroPresence: 'primary' | 'secondary' | 'absent',
  pageIntent: PageIntent | undefined,
): string {
  const heroPlacement = cleanSceneFragment(composition?.heroPlacement, 'left third');
  const entityPlacement = cleanSceneFragment(composition?.entityPlacement, 'right third');
  const type = (composition?.compositionType ?? '').toLowerCase();
  const centeredAllowed = type.includes('centered') && pageIntent?.type === 'magical_event';

  if (heroPresence === 'absent') {
    return `Anchor the main event in ${entityPlacement}, keep weight on one side of the frame, and leave the opposite side breathing room for story flow.`;
  }

  if (heroPresence === 'secondary') {
    return `Keep the hero small in ${heroPlacement}, partly occluded or pushed back, while the main visual event dominates ${entityPlacement}.`;
  }

  if (centeredAllowed) {
    return `Use near-center placement only for this reveal beat, then offset supporting elements toward ${entityPlacement} so the page still reads asymmetrically.`;
  }

  return `Place the hero at ${heroPlacement} and push the strongest secondary action toward ${entityPlacement}, avoiding dead-center symmetry.`;
}

function depthSentence(
  composition: PageComposition | undefined,
  actionBeat: string,
): string {
  const zone = cleanSceneFragment(composition?.mainIllustrationZone, 'the main action area');
  const envRole = cleanSceneFragment(composition?.environmentRole, 'background');
  const foregroundCue = chooseForegroundCue(actionBeat, zone);
  return `Build depth with ${foregroundCue}, keep ${zone} in the midground, and simplify the ${envRole} background to one supporting layer.`;
}

function backgroundBehaviorSentence(pageIntent: PageIntent | undefined): string {
  const backgroundMode = pageIntent?.background ?? 'partial';
  if (backgroundMode === 'full') {
    return 'Render a complete environment only as far as it supports the story beat, with painterly simplicity and no dense micro-detail.';
  }
  if (backgroundMode === 'minimal') {
    return 'Keep background minimal: remove full-room description, keep only hints of space, and let details dissolve into a soft textured wash with gently disappearing edges.';
  }
  return 'Keep background partial: render only space near the action, let the room fade asymmetrically into shadow or light, and avoid fully defined scene edges.';
}

function focusPrioritySentence(
  shot: IllustrationShot,
  composition: PageComposition | undefined,
): string {
  const mainFocus = cleanSceneFragment(composition?.mainFocus, imageSubjectLabel(shot.imageSubject));
  return `Make the viewer read ${mainFocus} first; all other environment detail stays suggested, not fully drawn.`;
}

function contrastSentence(pageIntent: PageIntent | undefined): string {
  const emotion = pageIntent?.emotion ?? 'calm';
  if (emotion === 'tension') return 'Let shadows feel heavier than highlights so the page carries clear tension.';
  if (emotion === 'excitement') return 'Push contrast and directional movement so the page feels energetic and in transition.';
  return 'Reduce motion and contrast so the page reads as a quiet pause after action.';
}

function cleanSceneFragment(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  const lowered = raw.toLowerCase();
  if (
    lowered === 'none' ||
    lowered === 'n/a' ||
    lowered.includes('not present') ||
    lowered.includes('not shown') ||
    lowered.includes('absent')
  ) {
    return fallback;
  }
  return raw;
}

function imageSubjectLabel(imageSubject: string): string {
  if (imageSubject.startsWith('supporting:')) return 'supporting character moment';
  if (imageSubject.startsWith('object:')) return imageSubject.replace('object:', '').trim() || 'symbolic object moment';
  if (imageSubject === 'child') return 'hero action moment';
  if (imageSubject === 'entity') return 'entity reveal moment';
  if (imageSubject === 'environment') return 'environment-led moment';
  return imageSubject || 'story moment';
}

function buildVisualRenderBrief(
  shot: IllustrationShot,
  composition: PageComposition | undefined,
  visualBible: VisualBible | null,
): string {
  const pageIntent = composition?.pageIntent;
  const heroPresence = composition ? (composition.heroPresence ?? inferHeroPresence(composition)) : 'primary';
  const cameraFeeling = cameraFeelingForPage(composition, pageIntent);
  const lightingMood = lightingMoodForEmotion(pageIntent?.emotion);
  const topTextPlan = composition?.topTextAreaPlan || 'a soft, uncluttered color field';
  const worldFeelRaw = visualBible?.world.roomIdentity || visualBible?.world.environmentDescription || 'the room';
  const worldFeel = cleanSceneFragment(worldFeelRaw, 'the story world');
  const explicitActionBeat = cleanSceneFragment(
    shot.action || composition?.mainIllustrationZone,
    `${imageSubjectLabel(shot.imageSubject)} with clear visual storytelling`,
  );
  const { hook, action } = extractSceneMoment(shot.imagePrompt);
  const actionBeat = cleanSceneFragment(action, explicitActionBeat);
  const heroHair = cleanSceneFragment(visualBible?.heroVisualLock?.hair, 'the same hair silhouette');
  const heroClothing = cleanSceneFragment(visualBible?.heroVisualLock?.clothing, 'the same pajamas');
  const textZoneSentence = `Keep the top 20-30% as clean negative space (${topTextPlan}) with no faces, hands, or key action entering that band.`;
  const backgroundSentence = backgroundBehaviorSentence(pageIntent);
  const focusSentence = focusPrioritySentence(shot, composition);

  const subjectSentence = heroPresence === 'absent'
    ? `Do not include the hero; let ${imageSubjectLabel(shot.imageSubject)} carry the page tension and movement.`
    : heroPresence === 'secondary'
      ? `Show ${visualBible?.hero.name ?? 'the hero'} only as a small secondary figure, recognizable by ${heroHair} and ${heroClothing}.`
      : `Show ${visualBible?.hero.name ?? 'the hero'} as the active figure, recognizable by ${heroHair} and ${heroClothing}, reacting in the moment rather than posing.`;

  const brief = [
    hook,
    `Frame the scene with a ${cameraFeeling} camera feel: ${actionBeat}.`,
    compositionPlacementSentence(composition, heroPresence, pageIntent),
    depthSentence(composition, actionBeat),
    backgroundSentence,
    focusSentence,
    subjectSentence,
    `Light the scene with ${lightingMood} so ${worldFeel} feels specific and lived-in.`,
    contrastSentence(pageIntent),
    textZoneSentence,
    'Keep style consistency across pages: soft, expressive, slightly stylized realism; no plastic 3D, no photorealism, no UI/text/symbol overlays; keep entity design identical.',
  ];

  // 4–7 sentences max with non-redundant detail.
  const selected = heroPresence === 'absent'
    ? [brief[0], brief[1], brief[2], brief[3], brief[4], brief[5], brief[7]]
    : [brief[0], brief[1], brief[2], brief[3], brief[4], brief[5], brief[6]];
  return `VISUAL_RENDER_BRIEF:\n${selected.join(' ')}`;
}

function applyStage4PromptContract(
  shots: IllustrationShot[],
  compositionPlan: PageComposition[],
  visualBible: VisualBible | null,
  worldAnchor: string,
  prose: PageProse[],
  categoryIllustrationMood?: string | null,
  categoryNarrativeConstraint?: string | null,
  directionContext?: {
    directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
    directionEmotionalLabel?: string;
    directionStoryPremise?: string;
  },
): IllustrationShot[] {
  void prose;
  const compByPage = new Map(compositionPlan.map((c) => [c.pageNumber, c]));
  const moodSuffix = categoryIllustrationMood?.trim()
    ? ` Mood: ${categoryIllustrationMood.trim()}.`
    : '';
  const lockedHeroName = visualBible?.hero.name?.trim() || 'child';
  const lockedEntityName = visualBible?.entity.name?.trim() || 'companion';
  const lockedHeroVisual = visualBible?.hero.lockedVisualDescription?.trim()
    || (visualBible?.heroVisualLock
      ? `face ${visualBible.heroVisualLock.faceShape}, hair ${visualBible.heroVisualLock.hair}, skin ${visualBible.heroVisualLock.skinTone}, eyes ${visualBible.heroVisualLock.eyes}, clothing ${visualBible.heroVisualLock.clothing}`
      : '')
    || 'same child appearance on every page';
  const lockedEntityVisual = visualBible?.entity.lockedVisualDescription?.trim()
    || (visualBible?.entityVisualLock
      ? `shape ${visualBible.entityVisualLock.shape}, color ${visualBible.entityVisualLock.color}, proportions ${visualBible.entityVisualLock.proportions}, expression ${visualBible.entityVisualLock.expressiveStyle}`
      : '')
    || 'same companion appearance on every page';
  const narrativeLock = categoryNarrativeConstraint?.trim()
    ? `LOCKED NARRATIVE ENVIRONMENT CONSTRAINT (must remain visible in the image): ${categoryNarrativeConstraint.trim()}`
    : '';

  return shots.map((shot) => {
    const comp = compByPage.get(shot.pageNumber);
    const renderBrief = buildVisualRenderBrief(shot, comp, visualBible);
    const consistencyLock = [
      'LOCKED CHARACTER — MUST MATCH EXACTLY ON EVERY PAGE:',
      `[${lockedHeroName}]: ${lockedHeroVisual}`,
      `[${lockedEntityName}]: ${lockedEntityVisual}`,
      'DO NOT add, remove, or change any character. Only these characters appear.',
      `LOCKED WORLD ANCHOR: ${worldAnchor}`,
      narrativeLock,
    ].filter(Boolean).join('\n');
    const rawScene = shot.imagePrompt;
    const base = `${consistencyLock}\n\n${rawScene}${moodSuffix} ${renderBrief}`.trim();
    return {
      ...shot,
      imagePrompt: base,
      rawScenePrompt: rawScene,
      visualDirection: shot.visualDirection,
    };
  });
}

function buildShotPlanPrompt(
  brain:               StoryBrain,
  outline:             PageOutline[],
  prose:               PageProse[],
  styleToken:          string,
  pageCount:           number,
  visualBible:         VisualBible | null,
  compositionPlan:     PageComposition[],
): string {
  const maxChildPages = Math.ceil(pageCount * 0.5);
  const proseRef = prose.map(p => `p${p.pageNumber}: ${(p.text ?? '').slice(0, 250)}`).join('\n');

  // Use VisualBible locked descriptions when available; fall back to brain.visuals
  const heroVisual   = visualBible?.hero.lockedVisualDescription   ?? brain.visuals.heroVisual;
  const entityVisual = visualBible?.entity.lockedVisualDescription ?? brain.visuals.entityVisual;
  const worldAnchor  = visualBible?.world.environmentDescription   ?? brain.visuals.worldAnchor;
  const stylePrefix  = visualBible
    ? `${visualBible.style.renderingStyle}, ${visualBible.style.brushTexture}, ${visualBible.style.colorPalette}`
    : styleToken;
  const extraRules = visualBible?.illustrationRules.map(r => `- ${r}`).join('\n') ?? '';

  // Physical media notes for prompt layer construction (new fields)
  const physicalMediaNotes = visualBible
    ? [visualBible.style.brushBehavior, visualBible.style.pigmentBehavior, visualBible.style.paperTexture]
        .filter(Boolean).slice(0, 2).join('; ')
    : '';
  // Entity evolution state descriptions (new fields)
  const entityResting = visualBible?.entity.lockedVisualDescription  ?? '';
  const entityActive  = visualBible?.entity.activeStateTransformation ?? '';
  const entityPower   = visualBible?.entity.powerVisualTransformation  ?? '';

  // Compact per-page composition reference
  const compRef = compositionPlan
    .map(c =>
      `p${c.pageNumber}: [${c.cameraDistance}/${c.cameraAngle}] ${c.compositionType} | ` +
      `hero: ${c.heroPlacement} | entity: ${c.entityPlacement} | ` +
      `top: ${c.topTextAreaPlan} | zone: ${c.mainIllustrationZone} | ` +
      `rhythm=${c.visualRhythmRole ?? 'n/a'} | heroPresence=${c.heroPresence ?? 'n/a'} | ` +
      `intent: ${JSON.stringify(c.pageIntent)}`,
    )
    .join('\n');
  const minHeroAbsentPages = pageCount >= 6 ? 1 : 0;
  const minPartialOrMinimal = Math.max(2, Math.ceil(pageCount * 0.25));

  return `LOCKED VISUALS:
heroVisual: ${heroVisual}
entityVisual (resting): ${entityResting}
entityVisual (active state): ${entityActive}
entityVisual (power transformation): ${entityPower}
worldAnchor: ${worldAnchor}
supportingCast: ${JSON.stringify((brain.visuals.supportingCast ?? []).map(c => ({ name: c.name, visual: c.visual })))}
hero.bodyProportions: ${visualBible?.hero.bodyProportions ?? ''}
hero.postureTendencies: ${visualBible?.hero.postureTendencies ?? ''}
hero.visualQuirks: ${JSON.stringify(visualBible?.hero.visualQuirks ?? [])}
entity.shapeLogic: ${visualBible?.entity.shapeLogic ?? ''}
entity.surprisingVisualTrait: ${visualBible?.entity.surprisingVisualTrait ?? ''}
heroVisualLock: ${JSON.stringify(visualBible?.heroVisualLock ?? null)}
styleLock: ${JSON.stringify(visualBible?.styleLock ?? null)}
entityVisualLock: ${JSON.stringify(visualBible?.entityVisualLock ?? null)}

PHYSICAL MEDIA STYLE:
stylePrefix: ${stylePrefix}
physicalMediaNotes: ${physicalMediaNotes}
${extraRules ? `\nILLUSTRATION RULES:\n${extraRules}\n` : ''}

OUTLINE (focus + characters per page):
${JSON.stringify(outline.map(p => ({ page: p.page, focus: p.focus, characters_present: p.characters_present, beat: p.beat })))}

PROSE REFERENCE:
${proseRef}

PAGE COMPOSITION PLAN (camera, placement, text-safe zones):
${compRef}

You are a STRICT SCENE EXTRACTOR. Your ONLY job is to translate Hebrew prose text into visual scene descriptions.

CRITICAL RULE: You may ONLY describe what is EXPLICITLY written in the PROSE TEXT for each page.
- If the text says "הילד פתח את הדלת" → the image shows the child opening the door.
- If the text does NOT mention an object → that object MUST NOT appear in the scene.
- You are a TRANSLATOR from text to visual. You do NOT add, invent, interpret, or embellish.
- NEVER add atmospheric objects, magical effects, or mood elements that are not literally described in the text.

Return: { "shots": [ {
  "pageNumber": N,
  "imageSubject": "child" | "entity" | "supporting:NAME" | "environment" | "object:DESCRIPTION",
  "shotType": "wide" | "close" | "action" | "symbolic" | "environment" | "reveal",
  "action": "...",
  "mustExclude": [...],
  "imagePrompt": "...",
  "visualDirection": {
    "locationZone": "bed | doorway | window | hallway | floor-level | shelf area | under-bed | ceiling-view | closet | ...",
    "mainAction": "concrete physical verb phrase from text",
    "visibleObjects": ["object1", "object2", "object3"],
    "characterPose": "specific body position implied by text",
    "emotionVisual": "physical expression from text context",
    "lightingSource": "specific light source",
    "environmentDetail": "one detail from text",
    "textTranslation": "English translation of the Hebrew page text",
    "mustInclude": ["object/action from text that MUST appear in illustration"],
    "mustNotInclude": ["objects/characters NOT mentioned in this page's text"],
    "camera": "camera angle from composition plan",
    "composition": "composition type from composition plan"
  }
}, ... ] }

SCENE EXTRACTION PROCESS (follow for EACH page):
1. Read the Hebrew PROSE TEXT for this page
2. Translate it to English literally (store in textTranslation)
3. List EVERY concrete noun/object mentioned → these become mustInclude + visibleObjects
4. Identify the SINGLE main verb/action → this becomes mainAction
5. Determine WHO is doing the action → this determines imageSubject
6. Check: is the companion/entity mentioned BY NAME in this page's text?
   - YES → include them in mustInclude
   - NO → add them to mustNotInclude (prevents character leakage)
7. Write imagePrompt as 2-3 sentences describing ONLY items from steps 3-5

imageSubject mapping:
  focus=child       → "child"
  focus=entity      → "entity"
  focus=interaction → "child" or "supporting:NAME" (the one doing the action in text)
  focus=action      → "child" or "entity" (the one doing the action in text)
  focus=environment → "environment"
  focus=symbolic    → "object:DESCRIPTION" or "environment"

imagePrompt rules:
- Maximum 350 characters
- ONLY describe what a camera would see based on the text
- NO poetry, metaphors, mood words, or invented atmosphere
- Format: "[Who] [does what] [where]. [Key objects and positions]. [Light source]."
- Follow PAGE COMPOSITION PLAN for camera angle and character placement

mustInclude examples:
  Text: "הילדה הרימה מפתח זהוב מהרצפה" → mustInclude: ["golden key", "floor", "child reaching down"]
  Text: "הינשוף ישב על הכתף שלה" → mustInclude: ["owl on shoulder", "child standing"]

mustNotInclude rules:
- If companion is NOT mentioned in page text → mustNotInclude: ["companion name", "companion type"]
- If entity is NOT mentioned in page text → mustNotInclude: ["entity name"]
- Always include: ["text", "words", "letters", "UI elements"]

LOCATION ZONE DIVERSITY — MANDATORY:
No two consecutive pages may use the same locationZone.
For ${pageCount} pages, use AT LEAST ${Math.min(pageCount, 5)} different locationZones.
Rotate: bed, floor-level, doorway, window, shelf area, under-bed, closet edge, hallway strip, ceiling-view, etc.

VARIETY ENFORCEMENT:
- Different physical verb + different locationZone on every page
- Express emotions through BODY LANGUAGE: "wide eyes, rigid shoulders" not "scared"
- Banned words in imagePrompt: cozy, magical, beautiful, detailed, stunning, vibrant, warm, whimsical, enchanting, heartwarming, charming, delightful

Hard limits:
- "child" imageSubject: MAXIMUM ${maxChildPages} pages
- "entity" imageSubject: MINIMUM 2 pages
- At least 1 "environment" or "object:X"
- No two consecutive pages same imageSubject type
- At least ${minHeroAbsentPages} page(s) hero-absent
- At least ${minPartialOrMinimal} page(s) background partial or minimal

Hero does NOT need to appear on every page.
When heroPresence=absent in composition plan, do not depict hero.

GLOBALLY BANNED:
${IMAGE_BANS}

mustExclude on every page must include at minimum:
["portrait lineup", "posed group", "characters facing camera", "full-frame poster composition"]`;
}

function coerceShotTypeFromLLM(raw: unknown): ShotType {
  const allowed: ShotType[] = ['wide', 'close', 'action', 'symbolic', 'environment', 'reveal'];
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (allowed.includes(v as ShotType)) return v as ShotType;
  // Map common LLM outputs to valid ShotType
  const mapping: Record<string, ShotType> = {
    medium: 'close',          // medium → close (not wide — avoids over-pushing wide)
    close_up: 'close',
    'close-up': 'close',
    closeup: 'close',
    over_shoulder: 'action',
    'over-shoulder': 'action',
    dynamic: 'action',
    establishing: 'wide',
    panoramic: 'wide',
    detail: 'symbolic',
    vignette: 'symbolic',
    landscape: 'environment',
  };
  return mapping[v] ?? 'wide';
}

function normalizeShotVisualDirection(raw: unknown): ShotVisualDirection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const str = (key: string) => (typeof o[key] === 'string' ? (o[key] as string).trim() : '');
  const arr = (key: string): string[] =>
    Array.isArray(o[key])
      ? (o[key] as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  const locationZone = str('locationZone');
  if (!locationZone) return undefined;
  const textTranslation = str('textTranslation');
  const mustInclude = arr('mustInclude');
  const mustNotInclude = arr('mustNotInclude');
  const camera = str('camera');
  const composition = str('composition');
  return {
    locationZone,
    mainAction: str('mainAction'),
    visibleObjects: arr('visibleObjects'),
    characterPose: str('characterPose'),
    emotionVisual: str('emotionVisual'),
    lightingSource: str('lightingSource'),
    environmentDetail: str('environmentDetail'),
    ...(textTranslation ? { textTranslation } : {}),
    ...(mustInclude.length > 0 ? { mustInclude } : {}),
    ...(mustNotInclude.length > 0 ? { mustNotInclude } : {}),
    ...(camera ? { camera } : {}),
    ...(composition ? { composition } : {}),
  };
}

function normalizeIllustrationShotsFromLLM(parsedShots: unknown[], pageCount: number): IllustrationShot[] {
  return parsedShots.slice(0, pageCount).map((row, idx) => {
    const s = row as Record<string, unknown>;
    const pageNumber = typeof s.pageNumber === 'number' ? s.pageNumber : idx + 1;
    const vd = normalizeShotVisualDirection(s.visualDirection);
    if (vd && (!vd.mustInclude || vd.mustInclude.length === 0) && vd.visibleObjects.length > 0) {
      vd.mustInclude = [...vd.visibleObjects];
    }
    if (!vd) {
      console.warn(`[Pipeline][Shots] Missing or invalid visualDirection for page ${pageNumber}`);
    }
    const must = s.mustExclude;
    return {
      pageNumber,
      imageSubject: typeof s.imageSubject === 'string' ? s.imageSubject : 'child',
      shotType: coerceShotTypeFromLLM(s.shotType),
      action: typeof s.action === 'string' ? s.action : '',
      mustExclude: Array.isArray(must) ? must.filter((item): item is string => typeof item === 'string') : [],
      imagePrompt: typeof s.imagePrompt === 'string' ? s.imagePrompt : '',
      visualDirection: vd ?? undefined,
    };
  });
}

async function generateShotPlan(
  brain:           StoryBrain,
  outline:         PageOutline[],
  prose:           PageProse[],
  styleToken:      string,
  pageCount:       number,
  visualBible:     VisualBible | null,
  compositionPlan: PageComposition[],
  categoryIllustrationMood: string | null | undefined,
  categoryNarrativeConstraint: string | null | undefined,
  directionContext?: {
    directionArchetype?: 'bedtime' | 'adventure' | 'fantasy';
    directionEmotionalLabel?: string;
    directionStoryPremise?: string;
  },
): Promise<{ shots: IllustrationShot[]; tokens: number }> {
  const system = `You write visual directions for AI-generated children's book illustrations.

You output STRUCTURED JSON — not prose poetry, not metaphors.

For each page, describe ONLY what a camera would see:
- Physical objects, body positions, spatial relationships
- Concrete locations within the story's setting (locationZone changes every page)
- Specific lighting conditions
- Character actions as physical verbs (reaching, kneeling, turning) — never replace action with vibes

NEVER use:
- Abstract concepts ("quiet determination", "gentle threshold moment") without visible bodies
- Repeated motifs ("glowing dots", "glowing lines") across many pages — max 2 pages for any one motif type
- Poetic phrases ("ribbon of shadow", "light spills like …")
- Mood-only words ("magical atmosphere") — show the body/posture/light instead

ALWAYS:
- Each page uses a DIFFERENT locationZone from the previous page
- Each page uses a DIFFERENT characterPose / mainAction framing
- Each page lists DIFFERENT visibleObjects focal props
- Emotion appears as emotionVisual: face + shoulders + hands posture, not adjectives alone

Locks and rendering style tokens are appended later by software — omit them from imagePrompt.
Return only valid JSON.`;

  const result = await callLLM(
    system,
    buildShotPlanPrompt(brain, outline, prose, styleToken, pageCount, visualBible, compositionPlan),
    4000, 0.75, 'Shots',
  );
  const parsed = parseJSON<{ shots?: IllustrationShot[] } | IllustrationShot[]>(result.text, 'Shots');
  const parsedList = Array.isArray(parsed) ? parsed : (parsed as { shots: IllustrationShot[] }).shots;

  if (!parsedList || parsedList.length < pageCount) {
    throw new Error(`[Pipeline][Shots] Expected ${pageCount} shots, got ${parsedList?.length ?? 0}`);
  }

  const shots = normalizeIllustrationShotsFromLLM(parsedList as unknown[], pageCount);
  const worldAnchor = visualBible?.world.environmentDescription ?? brain.visuals.worldAnchor;
  const lockedShots = applyStage4PromptContract(
    shots,
    compositionPlan,
    visualBible,
    worldAnchor,
    prose,
    categoryIllustrationMood,
    categoryNarrativeConstraint,
    directionContext,
  );
  const dist = [...new Set(lockedShots.map(s => s.imageSubject.split(':')[0]))].join(', ');
  console.log(`[Pipeline][Shots] ${lockedShots.length} shots | subjects: ${dist}`);
  return { shots: lockedShots, tokens: result.tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly — combine all stages → GeneratedStory
// ─────────────────────────────────────────────────────────────────────────────

function assembleStory(
  input:               StoryInput,
  brain:               StoryBrain,
  outline:             PageOutline[],
  prose:               PageProse[],
  shots:               IllustrationShot[],
  visualBible:         VisualBible | null,
  compositionPlan:     PageComposition[] | null,
  totalTokens:         number,
): GeneratedStory {
  // Index prose and shots by page number
  const proseMap = new Map(prose.map(p => [p.pageNumber, p]));
  const shotMap  = new Map(shots.map(s => [s.pageNumber, s]));

  // outline uses p.page; prose/shots use p.pageNumber — map by position
  const pages: StoryPage[] = outline.map((o, idx) => {
    const pageNum = o.page ?? (idx + 1);
    const p = proseMap.get(pageNum) ?? prose[idx];
    const s = shotMap.get(pageNum)  ?? shots[idx];
    // imageSubject priority: Stage 4 shot > Stage 3 prose > fallback 'child'
    const imageSubject = s?.imageSubject ?? p?.imageSubject ?? 'child';
    return {
      pageNumber:    pageNum,
      text:          p?.text          ?? '',
      narrationText: p?.narrationText ?? '',
      imageSubject,
      imagePrompt:   s?.imagePrompt   ?? '',
      rawScenePrompt: s?.rawScenePrompt ?? '',
      visualDirection: s?.visualDirection,
    };
  });

  const characterSheet: CharacterSheet = {
    mainCharacter: { name: brain.hero.name, visualDescription: brain.visuals.heroVisual },
    supportingCharacters: (brain.visuals.supportingCast ?? []).map(c => ({
      name:              c.name,
      relationship:      c.relationship,
      visualDescription: c.visual,
      narrativeRole:     c.narrativeRole,
    })),
    worldDescription: brain.visuals.worldAnchor,
  };

  const concept: StoryConcept = {
    centralEntity: {
      name:              brain.entity.name,
      type:              brain.entity.type,
      visualDescription: brain.visuals.entityVisual,
      behaviorRules:     [brain.entity.rule, brain.entity.limitation, brain.entity.core_ability],
      strangeDetail:     brain.entity.humor_hook,
    },
    narrativePurpose: {
      represents:         brain.emotionalCore.challenge,
      whyItAppears:       brain.narrativeCore.entity_reveal,
      whatItNeedsOrWants: brain.entity.limitation,
    },
    resilienceLayer: {
      identificationAnchor: brain.narrativeCore.opening,
      projectionLogic:      brain.emotionalCore.behavioral_pattern,
      regulationAction:     brain.emotionalCore.therapeutic_action,
      transformationMarker: brain.emotionalCore.emotional_shift,
    },
    surpriseOrShift: brain.narrativeCore.midpoint_shift,
    emotionalPeak:   brain.narrativeCore.climax_action,
    resolution: {
      action:         brain.narrativeCore.climax_action,
      transformation: brain.narrativeCore.resolution,
    },
  };

  return {
    title:     `הספר של ${input.childName}`,
    coverText:  brain.narrativeCore.opening,
    characterSheet,
    concept,
    pages,
    ...(visualBible        ? { visualBible }        : {}),
    ...(compositionPlan    ? { pageCompositionPlan: compositionPlan } : {}),
    ...(visualBible?.heroVisualLock ? { heroVisualLock: visualBible.heroVisualLock } : {}),
    ...(visualBible?.styleLock ? { styleLock: visualBible.styleLock } : {}),
    ...(visualBible?.entityVisualLock ? { entityVisualLock: visualBible.entityVisualLock } : {}),
    meta: {
      provider:    process.env.STORY_PROVIDER || 'openai',
      model:       getModelForStage('Brain', process.env.STORY_PROVIDER || 'openai'),
      totalTokens,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Soft quality validation (never blocks generation)
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_PHRASES = [
  'הוא הרגיש ש', 'היא הרגישה ש', 'הוא הבין ש', 'היא הבינה ש',
  'הכל יהיה בסדר', 'הכל יסתדר', 'אין מה לפחד',
];

const QUALITY_THRESHOLDS = {
  wordsMin:      PAGE_HEBREW_WORDS_MIN,
  wordsMax:      PAGE_HEBREW_WORDS_MAX,
  sentencesMin:  3,
  childImagePct: 0.6,
  thinCharMin:   70, // sanity floor: thin pages ≈ PAGE_HEBREW_WORDS_MIN words in Hebrew chars
} as const;

function countHebrewWords(text: string): number {
  return text.replace(/[^\u05D0-\u05EA\u05F0-\u05F4\s]/g, ' ').trim().split(/\s+/).filter(t => t.length > 0).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|(?<=[.!?])$/).map(s => s.trim()).filter(s => s.length > 0);
}

const ACTION_VERBS_RE = /נגע|אמר|שם|נתן|הרים|פתח|סגר|הלך|בא|עזר|חייך|לחש|מסר|הושיט|ישב|קם|רץ|הביא|הגיש|הראה|עשה|עמד|הניח|שאל|ענה|חיבק|אחז|תפס|לחץ|הסתכל|הביט|קרא|הצביע|הוריד|הכניס|הוציא|חזר|הגיע|ניגש|פנה/;
const INTERACTION_CONTEXT_RE = /עם|ביחד|ליד|לצד|מחבק|מחבקת|שיחה|משחק|משחקת|משחקים|מקשיב|מקשיבה|מעודד|מעודדת|מסייע|מסייעת|עוזר|עוזרת|מוביל|מובילה|מלווה|מלווה/;

function findAllOccurrences(text: string, token: string): number[] {
  const indices: number[] = [];
  if (!token) return indices;
  let fromIndex = 0;
  while (fromIndex < text.length) {
    const idx = text.indexOf(token, fromIndex);
    if (idx === -1) break;
    indices.push(idx);
    fromIndex = idx + token.length;
  }
  return indices;
}

function characterAppearsWithAction(name: string, allText: string, childName?: string): boolean {
  if (!name) return false;
  const sentences = splitSentences(allText);
  for (const sentence of sentences) {
    if (!sentence.includes(name)) continue;
    if (ACTION_VERBS_RE.test(sentence)) return true;
    if (childName && sentence.includes(childName) && INTERACTION_CONTEXT_RE.test(sentence)) return true;
  }

  const indices = findAllOccurrences(allText, name);
  for (const idx of indices) {
    const win = allText.slice(Math.max(0, idx - 120), idx + name.length + 220);
    if (ACTION_VERBS_RE.test(win)) return true;
    if (childName && win.includes(childName) && INTERACTION_CONTEXT_RE.test(win)) return true;
  }
  return false;
}

function collectSupportingCharacterNames(input: StoryInput): string[] {
  const fc = input.familyContext;
  if (!fc) return [];
  return [fc.parent1?.name, fc.parent2?.name, fc.sibling?.name]
    .map((value) => value?.trim())
    .filter((name): name is string => Boolean(name));
}

export function validateStoryQuality(story: GeneratedStory, input: StoryInput): QualityResult {
  const errors: string[] = [];
  const pages   = story.pages ?? [];
  const allText = pages.map(p => p.text ?? '').join(' ');

  for (const page of pages) {
    const w = countHebrewWords(page.text ?? '');
    if (w < QUALITY_THRESHOLDS.wordsMin) errors.push(`p${page.pageNumber}: ${w} words < ${QUALITY_THRESHOLDS.wordsMin}`);
    if (w > QUALITY_THRESHOLDS.wordsMax) errors.push(`p${page.pageNumber}: ${w} words > ${QUALITY_THRESHOLDS.wordsMax}`);
  }

  for (const page of pages) {
    const s = splitSentences(page.text ?? '');
    if (s.length < QUALITY_THRESHOLDS.sentencesMin) errors.push(`p${page.pageNumber}: ${s.length} sentences < ${QUALITY_THRESHOLDS.sentencesMin}`);
  }

  if (pages.length > 0) {
    const childCount = pages.filter(p => (p.imageSubject ?? '').toLowerCase().startsWith('child')).length;
    const ratio = childCount / pages.length;
    if (ratio > QUALITY_THRESHOLDS.childImagePct)
      errors.push(`imageSubject: ${childCount}/${pages.length} child (${Math.round(ratio * 100)}%) > 60%`);
  }

  const names = collectSupportingCharacterNames(input);
  if (names.length > 0 && !names.some((name) => characterAppearsWithAction(name, allText, input.childName))) {
    errors.push(`family (${names.join(', ')}) not found with action`);
  }

  for (const phrase of FORBIDDEN_PHRASES) {
    if (allText.includes(phrase)) errors.push(`forbidden: "${phrase}"`);
  }

  for (const page of pages) {
    const t = page.text ?? '';
    if (t.length < QUALITY_THRESHOLDS.thinCharMin) errors.push(`p${page.pageNumber}: thin (${t.length} chars)`);
    if (!t.includes(',') && !t.includes('—') && !t.includes('–')) errors.push(`p${page.pageNumber}: no commas or dashes`);
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    console.warn(`[Pipeline][Quality] ${errors.length} warnings — generation continues:\n${errors.map(e => `  • ${e}`).join('\n')}`);
  } else {
    console.log('[Pipeline][Quality] passed.');
  }
  return { isValid, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function runStoryPipeline(input: StoryInput): Promise<GeneratedStory> {
  const len         = STORY_LENGTHS.find(l => l.id === input.storyLength) ?? STORY_LENGTHS[1];
  const requestedDebugPages = Number(input.debugPageCount);
  const useDebugPageOverride =
    process.env.NODE_ENV !== 'production' &&
    Number.isFinite(requestedDebugPages) &&
    requestedDebugPages >= 2 &&
    requestedDebugPages <= 3;
  const pageCount = useDebugPageOverride ? requestedDebugPages : len.pages;
  const normalizedStyle = normalizeIllustrationStyle(input.illustrationStyle);
  const styleToken  = STYLE_TOKENS[normalizedStyle] ?? STYLE_PROFILES.pencil_watercolor.styleToken;
  let   totalTokens = 0;

  console.log(`[Pipeline] Starting: ${pageCount} pages, style=${normalizedStyle}, child=${input.childName}`);
  await validateStoryModel();

  // Stage 1 — Emotional foundation + locked visuals
  console.log('[Pipeline] Stage 1: StoryBrain');
  const { brain, tokens: t1 } = await generateBrain(input);
  totalTokens += t1;

  // Stage 2 — Page outline
  console.log('[Pipeline] Stage 2: PageOutline');
  const { outline, tokens: t2 } = await generateOutline(brain, pageCount, input);
  totalTokens += t2;

  // Stage 3 — Hebrew prose (3A: free write → 3B: page structuring → 3C: polish → 3D: length repair)
  console.log('[Pipeline] Stage 3: Prose');
  const { prose, rawStory, tokens: t3 } = await generateProse(brain, outline, input, pageCount);
  totalTokens += t3;
  void rawStory; // available for debugging; not stored in DB

  // Stage 4A — Visual Bible (locks style, layout, hero, entity, world)
  console.log('[Pipeline] Stage 4A: VisualBible');
  const { visualBible, tokens: t4a } = await generateVisualBible(
    brain,
    prose,
    normalizedStyle,
    styleToken,
    input.childImageUrl ?? null,
  );
  totalTokens += t4a;

  // Stage 4B — Page Composition Plan (camera, placement, text-safe zones, print layout)
  console.log('[Pipeline] Stage 4B: Composition');
  const { plan: compositionPlan, tokens: t4b } = await generatePageCompositionPlan(brain, outline, prose, visualBible, pageCount);
  totalTokens += t4b;

  // Stage 4C — Illustration shot plan (consumes VisualBible + CompositionPlan)
  console.log('[Pipeline] Stage 4C: Shots');
  const categoryBranchingForMood = getCategoryBranching(input.challengeCategory ?? null);
  const directionMatchForMood = categoryBranchingForMood?.storyDirections.find(
    (d) => d.flavor === input.directionArchetype,
  );
  const categoryIllustrationMood = categoryBranchingForMood?.storyTone.illustrationMood ?? null;
  const categoryNarrativeConstraint = directionMatchForMood?.narrativeOverride
    ?? categoryBranchingForMood?.treatmentStrategy.narrativeConstraint
    ?? null;
  const { shots, tokens: t4c } = await generateShotPlan(
    brain,
    outline,
    prose,
    styleToken,
    pageCount,
    visualBible,
    compositionPlan,
    categoryIllustrationMood,
    categoryNarrativeConstraint,
    {
      directionArchetype: input.directionArchetype,
      directionEmotionalLabel: input.directionEmotionalLabel,
      directionStoryPremise: input.directionStoryPremise,
    },
  );
  totalTokens += t4c;

  console.log(`[Pipeline] All stages done. totalTokens=${totalTokens}`);

  const story = assembleStory(input, brain, outline, prose, shots, visualBible, compositionPlan, totalTokens);

  // Structural hard check
  if (!story.pages || story.pages.length < pageCount) {
    throw new Error(`[Pipeline] Assembly: ${story.pages?.length ?? 0} pages, expected ${pageCount}`);
  }

  // Soft quality — never blocks
  const quality = validateStoryQuality(story, input);
  if (!quality.isValid) {
    story.meta.qualityWarnings = quality.errors;
  }

  // Product rule: when additional characters are provided, at least one must be used meaningfully.
  const familyNames = collectSupportingCharacterNames(input);
  if (familyNames.length > 0) {
    const allText = story.pages.map((page) => page.text ?? '').join(' ');
    const meaningfulUsageExists = familyNames.some((name) =>
      characterAppearsWithAction(name, allText, input.childName)
    );
    if (!meaningfulUsageExists) {
      if (!input.meaningfulAppearanceRetry) {
        console.warn('[Pipeline] Meaningful supporting appearance missing; retrying once with strengthened instruction');
        return runStoryPipeline({ ...input, meaningfulAppearanceRetry: true });
      }
      throw new Error('[Pipeline] Additional characters were provided but none appeared with meaningful action (after retry)');
    }
  }

  return story;
}
