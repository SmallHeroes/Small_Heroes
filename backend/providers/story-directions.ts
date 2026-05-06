import { generateImage } from './image';
import type { CharacterSheet, PageIntent } from './story';
import type { Companion } from '../../lib/companions';
import { getCompanionReferencePublicUrl } from '../../lib/companions';
import { companionAnchorKey } from '../../lib/orderMeta';
import type { StyleId } from '../../lib/styles';
import { getStyleContract, normalizeStyleId } from '../../lib/styles';
import { getCategoryBranching } from '../../lib/categoryBranching';

export type StoryDirectionArchetype = 'connection' | 'adventure' | 'courage';

export interface SharedStoryFoundation {
  childName: string;
  ageBand: '3-5' | '5-7' | '7-9';
  heroCoreTraits: string[];
  familyEntities: string[];
  visualWorldAnchors: string[];
  selectedStyle: StyleId;
}

export interface StoryDirectionDraft {
  archetype: StoryDirectionArchetype;
  title: string;
  summary: string;
  emotionalLabel: string;
  storyPremise: string;
  openingScenePrompt: string;
  previewImagePrompt: string;
}

export interface StoryDirectionWithPreview extends StoryDirectionDraft {
  previewImageUrl?: string;
  previewImageRawUrl?: string;
}

interface RuntimeDirectionInput {
  orderId: string;
  childName: string;
  childAge: number | null;
  childGender: string | null;
  childTraits: string[];
  childImageUrl: string | null;
  illustrationStyle: string;
  familyContext: unknown;
  topic: string;
  topicLabel: string;
  challengeItems: string[];
  challengeFree: string | null;
  outcomeItems: string[];
  helperItems: string[];
  /** Wizard-selected companion; optional for legacy orders. */
  companion: Companion | null;
  /** Challenge bucket from wizard topic map (e.g. ANGER_FRUSTRATION). */
  challengeCategory?: string | null;
  /** Parent follow-up answers (optional). */
  categoryAnswers?: Array<{ questionId?: string; question: string; answer: string; selectedQuickAnswers?: string[] }>;
}

interface FamilyMember {
  name: string;
  relation: string;
  description?: string;
  imageUrl?: string;
}

interface ParsedFamilyContext {
  members: FamilyMember[];
  homeText?: string;
}

function relationLabelForPrompt(value: string): string {
  if (value === 'mother') return 'אמא';
  if (value === 'father') return 'אבא';
  if (value === 'brother') return 'אח';
  if (value === 'sister') return 'אחות';
  // Backward compatibility for older payloads.
  if (value === 'parent') return 'הורה';
  if (value === 'sibling') return 'אח/אחות';
  if (value === 'grandparent') return 'סבא/סבתא';
  if (value === 'friend') return 'חבר/ה';
  if (value === 'other') return 'דמות קרובה';
  return value;
}

function toAgeBand(age: number | null): SharedStoryFoundation['ageBand'] {
  if (!age || age <= 5) return '3-5';
  if (age <= 7) return '5-7';
  return '7-9';
}

function normalizeStyleForFoundation(style: string): StyleId {
  return normalizeStyleId(style);
}

function parseFamilyContext(raw: unknown): ParsedFamilyContext {
  if (!raw || typeof raw !== 'object') return { members: [] };
  const source = raw as Record<string, unknown>;
  const members: FamilyMember[] = [];

  const appendMember = (
    field: unknown,
    relation: string
  ) => {
    if (!field || typeof field !== 'object') return;
    const candidate = field as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) return;
    members.push({
      name,
      relation,
      description: typeof candidate.description === 'string' ? candidate.description : undefined,
    });
  };

  const additionalCharacters = Array.isArray(source.additionalCharacters)
    ? source.additionalCharacters.slice(0, 2)
    : [];
  if (additionalCharacters.length > 0) {
    additionalCharacters.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const candidate = entry as Record<string, unknown>;
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
      if (!name) return;
      const relation = typeof candidate.relation === 'string' && candidate.relation.trim().length > 0
        ? relationLabelForPrompt(candidate.relation.trim())
        : 'דמות תומכת';
      const description = typeof candidate.description === 'string' ? candidate.description : undefined;
      const imageUrl = typeof candidate.imageUrl === 'string' ? candidate.imageUrl : undefined;
      members.push({ name, relation, description, imageUrl });
    });
  } else {
    appendMember(source.parent1, 'הורה');
    appendMember(source.parent2, 'הורה');
    appendMember(source.sibling, 'אח/אחות');
  }

  const homeText = typeof source.homeText === 'string' ? source.homeText.trim() : undefined;
  return { members, homeText: homeText || undefined };
}

function buildChildVisualDescription(input: RuntimeDirectionInput): string {
  const age = input.childAge ?? 5;
  const gender =
    input.childGender === 'girl'
      ? 'girl'
      : input.childGender === 'boy'
      ? 'boy'
      : 'child';
  const traits = input.childTraits.slice(0, 3).join(', ');
  return `A ${gender} named ${input.childName}, around ${age} years old, warm child-friendly expression, consistent hairstyle and outfit, traits: ${traits || 'gentle and curious'}`;
}

function buildCharacterSheet(input: RuntimeDirectionInput, family: ParsedFamilyContext): CharacterSheet {
  const supporting = family.members.map((member) => ({
    name: member.name,
    relationship: member.relation,
    visualDescription: member.description || `${member.name} is a recurring family character with warm and reassuring presence.`,
    narrativeRole: 'anchor',
  }));

  return {
    mainCharacter: {
      name: input.childName,
      visualDescription: buildChildVisualDescription(input),
    },
    supportingCharacters: supporting,
    worldDescription: family.homeText || 'A safe and familiar family environment with child-friendly details.',
  };
}

export function buildSharedStoryFoundation(input: RuntimeDirectionInput): SharedStoryFoundation {
  const family = parseFamilyContext(input.familyContext);
  const anchors = [
    family.homeText || 'cozy home environment',
    'child-safe lighting',
    'storybook clarity',
  ];

  return {
    childName: input.childName,
    ageBand: toAgeBand(input.childAge),
    heroCoreTraits: input.childTraits.slice(0, 4),
    familyEntities: family.members.map((member) => member.name),
    visualWorldAnchors: anchors,
    selectedStyle: normalizeStyleForFoundation(input.illustrationStyle),
  };
}

function seedFrom(orderId: string, archetype: StoryDirectionArchetype): number {
  const s = `${orderId}:${archetype}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickVariant<T>(variants: T[], seed: number): T {
  return variants[seed % variants.length];
}

function joinHebrewList(items: string[], max: number): string {
  const slice = items.filter(Boolean).slice(0, max);
  if (slice.length === 0) return '';
  return slice.join(' · ');
}

function environmentSnippetForPreview(seed: number, archetype: StoryDirectionArchetype): string {
  const calmIndoor = [
    'cozy indoor bedtime or reading corner with linen textures, warm lamp pools, soft wood furniture, bookshelves or rug—tactile walls and clear room depth, intimate safe space',
    'quiet family nook with wool blanket folds, warm tungsten glow, matte wall color blocks and a table or nightstand with real objects in frame',
    'gentle home interior near a rain-streaked window: warm practical lights, houseplants, cushion textures—lived-in foreground props before any figures',
  ];
  const outdoorAdventure = [
    'sweeping wide outdoor valley path at golden hour with layered hills, wind in grass, path stones and a visible forward trail—horizon and sky for scale',
    'deep forest-to-clearing transition: roots, ferns, tall trunks, distant ridgeline; strong diagonal path leading the eye; environmental clutter for depth',
    'open nature with wooden footbridge, river glint, birds or leaves in the air, broad cloudscape—child physically inside the landscape, not pasted on a void',
  ];
  const emotionalIndoorDuo = [
    'warm family living or kitchen-dining zone at soft evening: table edge, shared mug or bowl, chair backs, a doorway slice—enough set dressing for a two-person moment',
    'soft-lit hallway or stair landing: handrails, family photos, a coat hook or plant; threshold light catching dust—space staged for an emotional two-shot',
    'cozy room corner with two seats or floor cushions, shared book or toy on the rug, lamp wrapping both figures—intimate but clearly different from a lone bedtime portrait',
  ];
  if (archetype === 'adventure') return pickVariant(outdoorAdventure, seed);
  if (archetype === 'courage') return pickVariant(emotionalIndoorDuo, seed);
  return pickVariant(calmIndoor, seed);
}

/**
 * Build simple, parent-facing card summary.
 * This is what the parent reads on the direction card — must be clear, warm, short Hebrew.
 * All pipeline / therapeutic detail goes into `storyPremise` instead.
 */
function parentFacingCardSummary(
  archetype: StoryDirectionArchetype,
  hero: string,
  companion: { name: string } | null
): string {
  const companionBit = companion ? ` יחד עם ${companion.name}` : '';
  switch (archetype) {
    case 'connection':
      return `סיפור חם ורגוע שבו ${hero} מרגיש/ה קרבה, חום ובטחון${companionBit}. מתאים לרגעים שצריכים חיבוק ושקט.`;
    case 'adventure':
      return `${hero} יוצא/ת להרפתקה מלאת הפתעות וגילויים${companionBit}. סיפור עם דמיון, תנועה וסקרנות.`;
    case 'courage':
      return `${hero} מגלה שגם צעד קטן יכול להיות אמיץ${companionBit}. סיפור על כוח פנימי ואמונה בעצמך.`;
  }
}

/**
 * Build the detailed premise for the LLM pipeline (NOT shown on card).
 * Includes topic, traits, challenges, companion, and twist variants.
 */
function buildPremiseContext(input: RuntimeDirectionInput, foundation: SharedStoryFoundation): string {
  const hero = foundation.childName;
  const topic = input.topicLabel;
  const companionBlock = input.companion
    ? `Companion: ${input.companion.name} — ${input.companion.tagline}. Must appear meaningfully in the story.`
    : '';
  const traits = joinHebrewList(foundation.heroCoreTraits, 2);
  const traitsBlock = traits ? `Hero traits: ${traits}.` : '';
  const helper = input.helperItems[0];
  const helperBlock = helper ? `Real-world helper: ${helper}.` : '';
  const challengeBit = input.challengeItems[0] || input.challengeFree || '';
  const challengeBlock = challengeBit ? `Challenge (handle gently): ${challengeBit}.` : '';
  const outcomeBit = input.outcomeItems[0] || '';
  const outcomeBlock = outcomeBit ? `Desired emotional outcome: ${outcomeBit}.` : '';

  return [companionBlock, traitsBlock, helperBlock, challengeBlock, outcomeBlock]
    .filter(Boolean)
    .join(' ');
}

function buildPersonalizedCopy(input: RuntimeDirectionInput, foundation: SharedStoryFoundation): StoryDirectionDraft[] {
  const hero = foundation.childName;
  const topic = input.topicLabel;
  const premiseContext = buildPremiseContext(input, foundation);

  const baseDrafts: StoryDirectionDraft[] = [
    {
      archetype: 'connection',
      title: `קרוב ללב של ${hero}`,
      summary: parentFacingCardSummary('connection', hero, input.companion),
      emotionalLabel: 'חיבור וביטחון',
      storyPremise: `Calm, safety-first arc for ${hero} tied to topic "${topic}"; emphasize co-regulation, warmth, and a recognizable home anchor. ${premiseContext}`,
      openingScenePrompt: `Home evening scene for ${hero}: soft lamp, tactile comfort, a parent or trusted figure nearby, topic "${topic}" implied through props not text.`,
      previewImagePrompt: '',
    },
    {
      archetype: 'adventure',
      title: `${hero} והשביל המאיר`,
      summary: parentFacingCardSummary('adventure', hero, input.companion),
      emotionalLabel: 'הרפתקה וגילוי',
      storyPremise: `Curious, low-threat exploration for ${hero} tied to "${topic}"; movement, wonder, and playful discovery beats. ${premiseContext}`,
      openingScenePrompt: `A clear transition beat: ${hero} steps toward a whimsical outdoor or hybrid space, bright and inviting, tied to "${topic}".`,
      previewImagePrompt: '',
    },
    {
      archetype: 'courage',
      title: `צעד קטן, אומץ גדול`,
      summary: parentFacingCardSummary('courage', hero, input.companion),
      emotionalLabel: 'אתגר ואומץ',
      storyPremise: `Mild challenge and growth for ${hero} about "${topic}"; bravery through a small decisive action and visible payoff. ${premiseContext}`,
      openingScenePrompt: `Familiar room; ${hero} faces a softened symbolic challenge element; body language shifts from hesitation to forward intent.`,
      previewImagePrompt: '',
    },
  ];

  const branching = getCategoryBranching(input.challengeCategory);
  if (branching) {
    return baseDrafts.map((draft) => {
      const m = branching.storyDirections.find((d) => d.flavor === draft.archetype);
      if (!m) return draft;

      // Parent answers context — goes into storyPremise, NOT onto the card
      let parentAnswersBlock = '';
      if (input.categoryAnswers && input.categoryAnswers.length > 0) {
        const filled = input.categoryAnswers.filter((a) => {
          const hasText = (a.answer || '').trim().length > 0;
          const hasQuick = Array.isArray(a.selectedQuickAnswers) && a.selectedQuickAnswers.length > 0;
          return hasText || hasQuick;
        });
        if (filled.length > 0) {
          const contextLine = filled
            .map((a) => {
              const quick = Array.isArray(a.selectedQuickAnswers) && a.selectedQuickAnswers.length > 0
                ? `Quick picks: ${a.selectedQuickAnswers.join(', ')}`
                : '';
              const text = (a.answer || '').trim() ? `Detail: ${(a.answer || '').trim()}` : '';
              return [quick, text].filter(Boolean).join(' | ');
            })
            .filter(Boolean)
            .join(' · ');
          if (contextLine) {
            parentAnswersBlock = `\nPARENT_CONTEXT: ${contextLine}`;
          }
        }
      }

      const structureLine =
        draft.archetype === 'connection'
          ? 'Companion-led story: the bond with the companion drives what happens in most scenes (not only the opening).'
          : draft.archetype === 'adventure'
            ? 'Outward adventure: the child moves through at least two distinct outside / widened settings; the world offers the problem and the path.'
            : 'Inner / small-act story: the turning point is one concrete act in a familiar small space or in the body (breath, hands, switch) — not an epic quest.';

      // Card title and summary stay simple and parent-friendly (from baseDrafts).
      // All therapeutic / category detail goes into storyPremise for the LLM pipeline.
      return {
        ...draft,
        storyPremise: `${draft.storyPremise}

DIRECTION_ID: ${m.id} — ${structureLine}
CATEGORY_NARRATIVE (Hebrew): ${m.summary}
CATEGORY_PROMPT_HINT: ${m.promptHint}
REAL_WORLD_ANCHOR (Hebrew: stage with these props/settings; do not recite as a list to the child): ${m.realWorldAnchor}
TREATMENT_ENGINE: ${branching.treatmentStrategy.approach}
REQUIRED_OUTCOME: ${branching.treatmentStrategy.resolutionType}
FORBIDDEN_PLOT_DRIVERS: ${branching.treatmentStrategy.avoid.join(' | ')}${parentAnswersBlock}`,
      };
    });
  }
  return baseDrafts;
}

/** Page numbers map to composition rotation in image.ts — pick readable wide/medium beats. */
function previewPageNumberForArchetype(archetype: StoryDirectionArchetype): number {
  if (archetype === 'adventure') return 2; // wide-shot-environment
  if (archetype === 'courage') return 7; // action-movement / readable motion
  return 1; // medium-shot-interaction — warmth + faces
}

function buildCoverMomentImagePrompt(params: {
  hero: string;
  archetype: StoryDirectionArchetype;
  illustrationStyle: string;
  emotionalTone: string;
  actionBeat: string;
  setting: string;
  topic: string;
  companion: Companion | null;
}): string {
  const { hero, archetype, illustrationStyle, emotionalTone, actionBeat, setting, topic, companion } = params;
  const styleContract = getStyleContract(illustrationStyle);
  const styleLockBlock = `STYLE_LOCK: ${styleContract.optionBlock}`;

  const negativeBlock = [
    'NEGATIVE (strict for all direction previews): no portrait-only or ID-photo framing; no flat plain background; no featureless void or empty white space;',
    'no isolated centered static standing “school photo” pose; no figure floating in blank negative space; must read as a real place with action.',
  ].join(' ');

  const sceneOrder =
    'SCENE_ORDER: Lead with the dominant environment and spatial layout (first sentences), then the action and physical interaction, then place the named child with a readable face and natural gesture.';

  const companionDuoLine = companion
    ? `The companion ${companion.name} must share the frame with ${hero} and participate in the interaction: ${companion.narrativeHook} — not a bystander cutout.`
    : 'If only one child appears, pair them with a second caring on-screen figure (parent, caregiver, or sibling) OR a second visible presence in the same beat—this card requires two beings or clear relational staging.';

  const archetypeSceneTemplate =
    archetype === 'connection'
      ? [
          'DIRECTION_PREVIEW_CONNECTION: intimate INDOOR story moment (real scene, not a posed look-at-camera shot).',
          'CAMERA: medium shot, eye level or soft slight low angle; subject in lower two-thirds; walls, furniture, and props visible—cozy, warm, calm atmosphere with tactile contact and belonging.',
          `ENVIRONMENT (state this first, dominant, detailed before describing ${hero}): ${setting}`,
          `ACTION: use reaching, pouring, page-turning, offering a blanket, or leaning into lamplight—hands and body doing something in the room.`,
          `INTERACTION: ${hero} engaged with a physical object (book, cup, soft lamp glow, toy) and/or a second trusted person in-frame with mutual attention (leaning in, shared gaze at object).`,
          `Emotional tone: ${emotionalTone} Action beat: ${actionBeat}`,
        ].join(' ')
      : archetype === 'adventure'
        ? [
            'DIRECTION_PREVIEW_ADVENTURE: outdoor path DISCOVERY (wide environmental read—hero inside the world, not a sticker on a plain field).',
            'CAMERA: WIDE or establishing shot: show horizon, deep path, or broad sky; foreground rocks, plants, or bridge wood for layers; child scaled as part of the landscape (roughly one-fifth to one-third frame height) while still the focal story subject.',
            `ENVIRONMENT (state this first, dominant, sweeping before describing ${hero}): ${setting}`,
            'ACTION: walking, stepping, pointing along the trail, reaching toward a path marker, leaning over a stream edge—legs and arms in motion, curious forward energy.',
            `INTERACTION: clear touch with the world—palm on bark or bridge rail, boot on root, hand lifting a leaf or map, wind moving hair; discovery and movement.`,
            `Emotional tone: ${emotionalTone} Action beat: ${actionBeat}`,
          ].join(' ')
        : [
            'DIRECTION_PREVIEW_COURAGE: quiet BRAVERY as emotional two-character (or child + companion) beat—tender, not combat or chaos.',
            'CAMERA: medium two-shot or medium-wide: two figures share the frame with readable faces or profiles, off-center staging, environment still visible; no single-child portrait.',
            `ENVIRONMENT (state this first, warm lived-in before figures): ${setting}`,
            "ACTION: kneeling to eye level, both hands on a small shared object, one figure reaches to touch the other's shoulder, breathing together at a threshold—tension and courage in closeness, grounded and hopeful.",
            `INTERACTION: two-way emotional exchange: eye contact, parallel relief, or mutual reassurance; ${companionDuoLine}`,
            `Emotional tone: ${emotionalTone} Action beat: ${actionBeat} Keywords: brave, courage, challenge, gentle tension, grounded resolution.`,
          ].join(' ');

  // PRIMARY_SCENE goes first — Flux pays most attention to the first ~50 words.
  // This is the single strongest signal for visual differentiation between the 3 cards.
  const primaryScene =
    archetype === 'connection'
      ? `PRIMARY SCENE: Warm cozy indoor room, soft evening lamp light, close intimate framing. Child ${hero} in a safe home space — reading, hugging, or nestled with a loved one. Mood: calm, warm, safe.`
      : archetype === 'adventure'
        ? `PRIMARY SCENE: Wide outdoor landscape, golden hour sunlight, open trail or path stretching to horizon. Child ${hero} small in vast colorful nature — walking, exploring, discovering. Mood: wonder, movement, bright.`
        : `PRIMARY SCENE: Two figures face-to-face in a gentle threshold moment. Child ${hero} taking a brave small step — eye contact, held hands, quiet determination. Mood: courage, tenderness, hope.`;

  const prompt = [
    primaryScene,
    styleLockBlock,
    negativeBlock,
    sceneOrder,
    'COVER_MOMENT — full-scene book illustration (Hebrew personalized children book, visual only):',
    archetypeSceneTemplate,
    `Child ${hero} must be clearly visible as the main story subject: readable face, natural storytelling gesture, not a tiny speck; avoid centered head-and-shoulders on empty backdrop.`,
    companion && archetype !== 'courage'
      ? `The companion ${companion.name} (ally) appears in the same frame with ${hero}, behavior aligned with: ${companion.narrativeHook}.`
      : '',
    `Story anchor topic (suggest real props only, no text): ${topic}.`,
    'composition: clear foreground / midground / background; readable silhouettes; no generic stock void.',
    archetype === 'connection'
      ? 'World signature: calm belonging, warm soft indoor light, close tactile comfort — still a real scene, not a static portrait.'
      : archetype === 'adventure'
        ? 'World signature: open trail, horizon, wonder, forward discovery — the environment is the picture.'
        : 'World signature: two presences, emotional courage, softened challenge, warm resolution cue — relationship is the story.',
    'Cross-card rules: same child and companion (if any) design and STYLE_LOCK; vary only place, light, action, and composition.',
    'Resemblance: keep the same child proportions, hair, skin tone, and face structure across all three direction previews.',
    companion
      ? 'When a companion is present, keep the same species, outfit, and palette on every card.'
      : '',
    archetype === 'adventure'
      ? 'Energy: wonder, path, curiosity — child-safe, playful scale.'
      : archetype === 'courage'
        ? 'Energy: gentle bravery in connection — no explosive action; emotional stakes, safe outcome implied.'
        : 'Energy: closeness, safety, contact — shared warmth, lived-in room.',
    'Hard constraints: no text, no letters, no captions, no typographic elements in the art.',
  ]
    .filter((line) => line.length > 0)
    .join(' ');
  console.info('[DirPreviewDebug][DraftPrompt]', {
    archetype,
    hasStyleLock: prompt.includes('STYLE_LOCK'),
    hasSceneTemplate: prompt.includes('DIRECTION_PREVIEW_'),
    previewHead500: prompt.slice(0, 500),
  });
  return prompt;
}

export function buildDirectionDrafts(foundation: SharedStoryFoundation, input: RuntimeDirectionInput): StoryDirectionDraft[] {
  const drafts = buildPersonalizedCopy(input, foundation);
  const hero = foundation.childName;
  const branching = getCategoryBranching(input.challengeCategory ?? null);

  return drafts.map((draft) => {
    const setting = environmentSnippetForPreview(seedFrom(input.orderId, draft.archetype), draft.archetype);
    let emotionalTone = 'warm safety and belonging';
    let actionBeat = `${hero} shares a calm connected moment in a familiar space`;
    if (draft.archetype === 'adventure') {
      emotionalTone = 'bright wonder, playful exploration, low threat';
      actionBeat = `${hero} strides or leans forward toward a new discovery with open posture`;
    } else if (draft.archetype === 'courage') {
      emotionalTone = 'quiet bravery, hopeful tension, safe resolution cue';
      actionBeat = `${hero} takes one brave forward step toward a softened challenge while staying grounded`;
    }
    const dirMeta = branching?.storyDirections.find((d) => d.flavor === draft.archetype);
    if (branching?.treatmentStrategy) {
      emotionalTone = `${emotionalTone}. Therapeutic goal (subtle, visual mood only): ${branching.treatmentStrategy.resolutionType}.`;
    }

    let previewImagePrompt = buildCoverMomentImagePrompt({
      hero,
      archetype: draft.archetype,
      illustrationStyle: input.illustrationStyle,
      emotionalTone,
      actionBeat,
      setting,
      topic: input.topicLabel,
      companion: input.companion,
    });
    if (branching?.treatmentStrategy) {
      previewImagePrompt += ` Avoid visual stories that feel like: ${branching.treatmentStrategy.avoid.slice(0, 3).join(', ')}.`;
    }
    if (dirMeta?.realWorldAnchor) {
      previewImagePrompt += ` Stage using real-child-world cues (Hebrew): ${dirMeta.realWorldAnchor}.`;
    }

    return {
      ...draft,
      previewImagePrompt,
      openingScenePrompt: `${draft.openingScenePrompt} Setting detail: ${setting}. ${dirMeta?.realWorldAnchor ? `Real-world prop anchor: ${dirMeta.realWorldAnchor}.` : ''}`,
    };
  });
}

const VISUAL_QA_REINFORCE =
  'VISUAL_QA_REINFORCE: Child hero must occupy roughly one-quarter to one-third of frame height with readable facial features; show a clear body gesture in motion (not a neutral standing pose); avoid scenery-only frames; keep emotional tone aligned with this archetype.';

const WEAK_COMPOSITION_PHRASES = [
  'scenery-only',
  'empty horizon',
  'tiny silhouette',
  'distant figure only',
  'postcard panorama',
];

const ACTION_VERB_RE =
  /\b(stride|strides|lean|leans|reach|reaches|step|steps|run|running|explore|discover|hold|hug|hugs|face|gaze|turn|forward|motion|gesture|walk|walking|jump|jumping|movement|posture|shares|sharing|touch|touches|embrace|active)\b/i;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryAfterSeconds(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const explicit = message.match(/"retry_after"\s*:\s*(\d+)/i);
  if (explicit) return Number(explicit[1]);
  const alt = message.match(/retry_after[^0-9]*(\d+)/i);
  if (alt) return Number(alt[1]);
  return null;
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('status 429') || message.toLowerCase().includes('too many requests');
}

function countToneHits(archetype: StoryDirectionArchetype, p: string): number {
  const connection = ['calm', 'close', 'warm', 'cozy', 'safety', 'soft', 'gentle', 'lamp', 'contact', 'tactile', 'comfort', 'belonging'];
  const adventure = ['forward', 'path', 'discover', 'wonder', 'explor', 'movement', 'motion', 'curious', 'trail', 'open', 'discovery'];
  const courage = ['brave', 'bravery', 'challenge', 'tension', 'obstacle', 'decisive', 'hesitation', 'grounded', 'courage'];
  const words = archetype === 'adventure' ? adventure : archetype === 'courage' ? courage : connection;
  return words.filter((w) => p.includes(w)).length;
}

/** Lightweight prompt QA before accepting a preview (no ML). Used to decide single regeneration. */
export function validatePreviewPromptQuality(
  archetype: StoryDirectionArchetype,
  prompt: string,
  heroName: string
): boolean {
  const p = prompt.toLowerCase();
  const hero = heroName.trim().toLowerCase();
  if (hero.length >= 2 && !p.includes(hero) && !p.includes('hero')) {
    return false;
  }
  if (WEAK_COMPOSITION_PHRASES.some((phrase) => p.includes(phrase))) {
    return false;
  }
  if (!ACTION_VERB_RE.test(p)) {
    return false;
  }
  if (countToneHits(archetype, p) < 1) {
    return false;
  }
  return true;
}

async function generateSingleStoryDirectionWithQa(params: {
  input: RuntimeDirectionInput;
  draft: StoryDirectionDraft;
  characterSheet: CharacterSheet;
  environmentContinuity: string;
  referenceImages: string[] | undefined;
  childAnchorImageUrl?: string;
}): Promise<StoryDirectionWithPreview> {
  const { input, draft, characterSheet, environmentContinuity, referenceImages, childAnchorImageUrl } = params;
  const { pageIntent, compositionRules } = getPreviewIntent(draft.archetype);
  const pageNumber = previewPageNumberForArchetype(draft.archetype);
  // PROMPT_ONLY: Suffix below guides preview generation quality; it is not code-level identity validation.
  const strictIdentitySuffix = [
    'STRONG_CHILD_RESEMBLANCE_GUIDANCE:',
    '- keep a similar child character based on the anchor/reference (not a different storybook character)',
    '- keep face geometry consistent: jaw/cheeks/chin, eye shape+spacing, nose, mouth proportions',
    '- keep skin tone, hair color/length/style, and age appearance consistent',
    '- only clothing/pose/expression/environment/lighting may vary',
    '- visual guidance: if face-only crop would not read as a similar child character, prefer regeneration',
  ].join('\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const companionRefUrl = input.companion ? getCompanionReferencePublicUrl(input.companion, baseUrl) : null;
  const companionAnchorChars =
    input.companion && companionRefUrl
      ? [
          {
            characterId: companionAnchorKey(input.companion.id),
            name: input.companion.name,
            anchorImageUrl: companionRefUrl,
          },
        ]
      : [];

  async function runOnce(extraSuffix: string, runPhase: 'primary' | 'qa_reinforce') {
    const suffixParts = [strictIdentitySuffix, extraSuffix].filter(Boolean);
    const suffix = suffixParts.length > 0 ? `\n\n${suffixParts.join('\n\n')}` : '';
    const pagePrompt = `${draft.previewImagePrompt}${suffix} Environment anchors: ${environmentContinuity}.`;
    console.info('[DirPreviewDebug][PreGenerate]', {
      orderId: input.orderId,
      archetype: draft.archetype,
      pageNumber,
      hasStyleLock: pagePrompt.includes('STYLE_LOCK'),
      hasSceneTemplate: pagePrompt.includes('DIRECTION_PREVIEW_'),
      previewHead500: pagePrompt.slice(0, 500),
    });
    const mergedRefs = [
      ...new Set([
        ...(referenceImages ?? []),
        ...(childAnchorImageUrl ? [childAnchorImageUrl] : []),
        ...(companionRefUrl ? [companionRefUrl] : []),
      ]),
    ];
    const finalReferenceImages = mergedRefs.length > 0 ? mergedRefs : undefined;
    const childAnchors = childAnchorImageUrl
      ? [
          {
            characterId: 'child' as const,
            name: input.childName,
            anchorImageUrl: childAnchorImageUrl,
          },
        ]
      : [];
    const anchorCharacters =
      childAnchors.length + companionAnchorChars.length > 0
        ? [...childAnchors, ...companionAnchorChars]
        : undefined;
    let image: Awaited<ReturnType<typeof generateImage>> | null = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.info(
          `[DirectionsGeneration] image_start orderId=${input.orderId} ` +
            `archetype=${draft.archetype} attempt=${attempt} phase=${runPhase}`
        );
        image = await generateImage({
          pagePrompt,
          illustrationStyle: input.illustrationStyle,
          isDirectionPreview: true,
          characterSheet,
          childDescription: buildChildVisualDescription(input),
          pageIntent,
          compositionRules,
          environmentContinuity,
          referenceImages: finalReferenceImages,
          anchorCharacters,
          companion: input.companion,
          orderId: input.orderId,
          pageNumber,
          totalPages: 3,
        });
        console.info(
          `[DirectionsGeneration] image_done orderId=${input.orderId} ` +
            `archetype=${draft.archetype} attempt=${attempt} phase=${runPhase}`
        );
        break;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error ?? '');
        const willRetry = isRateLimitError(error) && attempt < maxAttempts;
        if (!willRetry) {
          console.info(
            `[DirectionsGeneration] image_failed orderId=${input.orderId} ` +
              `archetype=${draft.archetype} attempt=${attempt} phase=${runPhase} err=${errMsg.slice(0, 200)}`
          );
        }
        if (!isRateLimitError(error) || attempt >= maxAttempts) {
          throw error;
        }
        const retryAfterSec = extractRetryAfterSeconds(error) ?? 8;
        await wait(Math.max(1, retryAfterSec) * 1000);
      }
    }
    if (!image) {
      throw new Error('Direction preview image generation returned no image');
    }
    return { image, pagePrompt, suffix };
  }

  let { image, pagePrompt } = await runOnce('', 'primary');
  let usedReinforce = false;

  if (!validatePreviewPromptQuality(draft.archetype, pagePrompt, input.childName)) {
    const second = await runOnce(VISUAL_QA_REINFORCE, 'qa_reinforce');
    image = second.image;
    pagePrompt = second.pagePrompt;
    usedReinforce = true;
  }

  const previewImagePrompt =
    draft.previewImagePrompt + (usedReinforce ? `\n\n${VISUAL_QA_REINFORCE}` : '');

  return {
    ...draft,
    previewImagePrompt,
    previewImageUrl: image.url,
    previewImageRawUrl: image.rawUrl,
  };
}

function getPreviewIntent(archetype: StoryDirectionArchetype): { pageIntent: PageIntent; compositionRules: string } {
  if (archetype === 'adventure') {
    return {
      pageIntent: {
        type: 'world_scene',
        focus: 'environment',
        camera: 'wide',
        background: 'full',
        emotion: 'excitement',
      },
      compositionRules:
        'Wide outdoor composition: foreground texture (plants, path, rail), midground child in motion, background sky or hills; scale child within the world, strong journey depth, not a centered portrait on empty ground.',
    };
  }

  if (archetype === 'courage') {
    return {
      pageIntent: {
        type: 'interaction_page',
        focus: 'hero',
        camera: 'medium',
        background: 'full',
        emotion: 'tension',
      },
      compositionRules:
        'Emotional two-shot: two characters (or child + companion) in the same frame, off-center, readable interaction; warm interior or threshold light; quiet bravery, not chaotic action.',
    };
  }

  return {
    pageIntent: {
      type: 'interaction_page',
      focus: 'hero',
      camera: 'medium',
      background: 'partial',
      emotion: 'calm',
    },
    compositionRules:
      'Intimate indoor medium shot: real room with walls and props, child engaged in a concrete action and object/relationship, off-center or lower-two-thirds, warm soft light, not a static head-and-shoulders on blank color.',
  };
}

/**
 * Generates each direction + preview sequentially, invoking `onEach` after each so rows can be persisted
 * while later previews are still rendering.
 */
export async function generateStoryDirectionsIncrementally(
  input: RuntimeDirectionInput,
  onEach: (direction: StoryDirectionWithPreview) => Promise<void>
): Promise<{ foundation: SharedStoryFoundation }> {
  const family = parseFamilyContext(input.familyContext);
  const foundation = buildSharedStoryFoundation(input);
  const drafts = buildDirectionDrafts(foundation, input);
  const characterSheet = buildCharacterSheet(input, family);
  const environmentContinuity = foundation.visualWorldAnchors.join(' | ');
  const baseReferenceImages = input.childImageUrl ? [input.childImageUrl] : undefined;
  let rollingChildAnchorImageUrl = input.childImageUrl ?? undefined;

  for (const draft of drafts) {
    console.info('[DirPreviewDebug][GenerateDirection]', {
      orderId: input.orderId,
      archetype: draft.archetype,
    });
    const direction = await generateSingleStoryDirectionWithQa({
      input,
      draft,
      characterSheet,
      environmentContinuity,
      referenceImages: baseReferenceImages,
      childAnchorImageUrl: rollingChildAnchorImageUrl,
    });
    if (!rollingChildAnchorImageUrl && direction.previewImageUrl) {
      rollingChildAnchorImageUrl = direction.previewImageUrl;
    }
    await onEach(direction);
  }

  return { foundation };
}

/** @deprecated Prefer generateStoryDirectionsIncrementally for streaming persistence */
export async function generateStoryDirectionsWithPreviews(
  input: RuntimeDirectionInput
): Promise<{ foundation: SharedStoryFoundation; directions: StoryDirectionWithPreview[] }> {
  const directions: StoryDirectionWithPreview[] = [];
  const { foundation } = await generateStoryDirectionsIncrementally(input, async (d) => {
    directions.push(d);
  });
  return { foundation, directions };
}
