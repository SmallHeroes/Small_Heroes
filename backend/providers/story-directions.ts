import type { Companion } from '../../lib/companions';
import type { StyleId } from '../../lib/styles';
import { getStyleContract, normalizeStyleId } from '../../lib/styles';
import { getCategoryBranching } from '../../lib/categoryBranching';

export type StoryDirectionArchetype = 'bedtime' | 'adventure' | 'fantasy';

/** Public URLs for direction cards (static art; see `public/directions/`). */
export const STATIC_DIRECTION_CARD_IMAGE: Record<StoryDirectionArchetype, string> = {
  bedtime: '/directions/bedtime.jpg',
  adventure: '/directions/adventure.jpg',
  fantasy: '/directions/fantasy.jpg',
};

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

  appendMember(source.parent1, 'הורה');
  appendMember(source.parent2, 'הורה');
  appendMember(source.sibling, 'אח/אחות');

  const homeText = typeof source.homeText === 'string' ? source.homeText.trim() : undefined;
  return { members, homeText: homeText || undefined };
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
  const fantasyWorld = [
    'floating islands with soft impossible staircases, candy-colored alien plants, upside-down doorways opening into warm lamplight—dream physics, saturated hues, child-sized scale',
    'upside-down room as storybook set: furniture on ceiling, rain falling upward, oversized toys as terrain—absurd spatial rules, vibrant palette, safe whimsy',
    'underwater kingdom vibe above ground: glowing coral towers, bioluminescent jelly platforms, impossible gentle slopes—fluid motion, wide readable environment',
  ];
  if (archetype === 'adventure') return pickVariant(outdoorAdventure, seed);
  if (archetype === 'fantasy') return pickVariant(fantasyWorld, seed);
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
    case 'bedtime':
      return `סיפור חם ורגוע לפני השינה שבו ${hero} מרגיש/ה בטחון וקרבה${companionBit}. מתאים לרגעים שקטים ושלווים.`;
    case 'adventure':
      return `${hero} יוצא/ת להרפתקה מלאת הפתעות וגילויים${companionBit}. סיפור עם דמיון, תנועה וסקרנות.`;
    case 'fantasy':
      return `${hero} נכנס/ת לעולם בדיוני מלא הפתעות ודמיון${companionBit}. סיפור עם קסם, אבסורד וחופש.`;
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
      archetype: 'bedtime',
      title: `🌙 סיפור לפני השינה`,
      summary: parentFacingCardSummary('bedtime', hero, input.companion),
      emotionalLabel: 'שקט וחם',
      storyPremise: `Calm, safety-first arc for ${hero} tied to topic "${topic}"; emphasize co-regulation, warmth, and a recognizable home anchor. ${premiseContext}`,
      openingScenePrompt: `Home evening scene for ${hero}: soft lamp, tactile comfort, a parent or trusted figure nearby, topic "${topic}" implied through props not text.`,
      previewImagePrompt: '',
    },
    {
      archetype: 'adventure',
      title: `🗺️ הרפתקה`,
      summary: parentFacingCardSummary('adventure', hero, input.companion),
      emotionalLabel: 'פעולה וגילוי',
      storyPremise: `Curious, low-threat exploration for ${hero} tied to "${topic}"; movement, wonder, and playful discovery beats. ${premiseContext}`,
      openingScenePrompt: `A clear transition beat: ${hero} steps toward a whimsical outdoor or hybrid space, bright and inviting, tied to "${topic}".`,
      previewImagePrompt: '',
    },
    {
      archetype: 'fantasy',
      title: `✨ סיפור בדיוני`,
      summary: parentFacingCardSummary('fantasy', hero, input.companion),
      emotionalLabel: 'דמיון ללא גבולות',
      storyPremise: `Imaginative, absurd-friendly arc for ${hero} about "${topic}"; whimsical worlds, playful impossibilities, safe surreal beats. ${premiseContext}`,
      openingScenePrompt: `Soft threshold into a fantastical space: ${hero} discovers a rule-bending world tied to "${topic}" — vivid, dreamlike, never frightening.`,
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
        draft.archetype === 'bedtime'
          ? 'Companion-led story: the bond with the companion drives what happens in most scenes (not only the opening).'
          : draft.archetype === 'adventure'
            ? 'Outward adventure: the child moves through at least two distinct outside / widened settings; the world offers the problem and the path.'
            : 'Fantasy-world story: surreal but safe environments with playful impossibilities; the turning point can be a small brave choice inside the absurd, not grim danger.';

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
    archetype === 'bedtime'
      ? [
          'DIRECTION_PREVIEW_BEDTIME: intimate INDOOR story moment (real scene, not a posed look-at-camera shot).',
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
            'DIRECTION_PREVIEW_FANTASY: fantastical wide scene — impossible physics, saturated dreamlike palette, child clearly exploring something absurd and delightful.',
            'CAMERA: WIDE: establish floating platforms, inverted architecture, or oversized flora; hero reads as adventuring through the impossible space, not floating in a void.',
            `ENVIRONMENT (state this first — dominant, surreal but child-safe): ${setting}`,
            `ACTION: ${hero} touches or steps across an impossible surface, chases a glowing wisp, or opens a door that should not exist—readable gesture, wonder-forward.`,
            `INTERACTION: ${companionDuoLine}`,
            `Emotional tone: ${emotionalTone} Action beat: ${actionBeat} Keywords: wonder, whimsy, absurd, safe surreal, vibrant color.`,
          ].join(' ');

  // PRIMARY_SCENE goes first — Flux pays most attention to the first ~50 words.
  // This is the single strongest signal for visual differentiation between the 3 cards.
  const primaryScene =
    archetype === 'bedtime'
      ? `PRIMARY SCENE: Warm cozy indoor room, soft evening lamp light, close intimate framing. Child ${hero} in a safe home space — reading, hugging, or nestled with a loved one. Mood: calm, warm, safe.`
      : archetype === 'adventure'
        ? `PRIMARY SCENE: Wide outdoor landscape, golden hour sunlight, open trail or path stretching to horizon. Child ${hero} small in vast colorful nature — walking, exploring, discovering. Mood: wonder, movement, bright.`
        : `PRIMARY SCENE: Fantastical wide scene with impossible physics, vibrant saturated colors, dreamlike setting — Child ${hero} exploring the absurd with curiosity. Mood: wonder, play, safe surrealism.`;

  const prompt = [
    primaryScene,
    styleLockBlock,
    negativeBlock,
    sceneOrder,
    'COVER_MOMENT — full-scene book illustration (Hebrew personalized children book, visual only):',
    archetypeSceneTemplate,
    `Child ${hero} must be clearly visible as the main story subject: readable face, natural storytelling gesture, not a tiny speck; avoid centered head-and-shoulders on empty backdrop.`,
    companion && archetype !== 'fantasy'
      ? `The companion ${companion.name} (ally) appears in the same frame with ${hero}, behavior aligned with: ${companion.narrativeHook}.`
      : '',
    `Story anchor topic (suggest real props only, no text): ${topic}.`,
    'composition: clear foreground / midground / background; readable silhouettes; no generic stock void.',
    archetype === 'bedtime'
      ? 'World signature: calm belonging, warm soft indoor light, close tactile comfort — still a real scene, not a static portrait.'
      : archetype === 'adventure'
        ? 'World signature: open trail, horizon, wonder, forward discovery — the environment is the picture.'
        : 'World signature: playful impossibility, saturated palette, dream physics — the environment is fantastical yet child-safe.',
    'Cross-card rules: same child and companion (if any) design and STYLE_LOCK; vary only place, light, action, and composition.',
    'Resemblance: keep the same child proportions, hair, skin tone, and face structure across all three direction previews.',
    companion
      ? 'When a companion is present, keep the same species, outfit, and palette on every card.'
      : '',
    archetype === 'adventure'
      ? 'Energy: wonder, path, curiosity — child-safe, playful scale.'
      : archetype === 'fantasy'
        ? 'Energy: wonder-forward absurdism — no horror; vivid, funny-impossible, joyful exploration.'
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
    } else if (draft.archetype === 'fantasy') {
      emotionalTone = 'wonder, whimsical courage, joyful absurdity';
      actionBeat = `${hero} explores a rule-breaking world with open posture and curiosity`;
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

/**
 * Generates each direction with static preview artwork; invokes `onEach` after each for DB persistence.
 * Text fields (title, summary, storyPremise, previewImagePrompt) are still produced for the pipeline.
 */
export async function generateStoryDirectionsIncrementally(
  input: RuntimeDirectionInput,
  onEach: (direction: StoryDirectionWithPreview) => Promise<void>
): Promise<{ foundation: SharedStoryFoundation }> {
  const foundation = buildSharedStoryFoundation(input);
  const drafts = buildDirectionDrafts(foundation, input);

  for (const draft of drafts) {
    console.info('[DirPreviewDebug][GenerateDirection]', {
      orderId: input.orderId,
      archetype: draft.archetype,
    });
    const url = STATIC_DIRECTION_CARD_IMAGE[draft.archetype];
    const direction: StoryDirectionWithPreview = {
      ...draft,
      previewImageUrl: url,
      previewImageRawUrl: url,
    };
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
