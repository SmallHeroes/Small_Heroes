import {
  getNegativeStylePromptBlock,
  getStyleContract,
  normalizeStyleId,
  STYLE_IDS,
  type StyleId,
} from './styles';
import { resolveStyleSentence } from './visualDirector';

const GLOBAL_NEGATIVE_CONSTRAINTS = [
  'no text',
  'no letters',
  'no words',
  'no numbers',
  'no signs',
  'no labels',
  'no captions',
  'no speech bubbles',
  'no book pages with writing',
  'no posters',
  'no banners',
  'no watermarks',
  'pure illustration only',
];

export interface BuildPromptInput {
  styleIdInput: string;
  sceneDescription: string;
  textZoneDirective: string;
  protagonistLock: string;
  entityLock: string;
  /** Strong identity constraints (hero + optional companion) — placed first in Flux prompt. */
  characterLockLead?: string;
  /** Full style option block — same contract for cover and interior parity. */
  styleContractBlock?: string;
  globalNegativeConstraints?: string[];
}

export interface BuiltPrompt {
  styleId: StyleId;
  positivePrompt: string;
  negativePrompt: string;
  finalPrompt: string;
}

export function buildImagePrompt(input: BuildPromptInput): BuiltPrompt {
  const styleId = normalizeStyleId(input.styleIdInput);
  const styleSentence = resolveStyleSentence(input.styleIdInput).replace(/\s+/g, ' ').trim();
  const sceneDescription = input.sceneDescription.replace(/\s+/g, ' ').trim();
  const textZone = input.textZoneDirective.replace(/\s+/g, ' ').trim();
  const protagonistLock = input.protagonistLock.replace(/\s+/g, ' ').trim();
  const entityLock = input.entityLock.replace(/\s+/g, ' ').trim();
  const characterLockLead = (input.characterLockLead ?? '').replace(/\s+/g, ' ').trim();
  const styleContractBlockInput = (input.styleContractBlock ?? '').replace(/\s+/g, ' ').trim();
  const resolvedStyleBlock =
    styleContractBlockInput ||
    getStyleContract(input.styleIdInput).optionBlock.replace(/\s+/g, ' ').trim();
  // CINEMATIC FRAMING for Flux — small character inside a vast, fully-rendered scene.
  // Inverse of the OLD "character fills 60-70%, hero of the page" approach which produced
  // tight portraits across all pages and broke compositional variety.
  const framingDirective = `COMPOSITION & FRAMING (CRITICAL):
WIDE STORYBOOK SCENE — the character occupies 20-30% of the frame height. The character is a SMALL FIGURE inside a fully-rendered environment. The environment dominates 70%+ of the image.
PULL THE CAMERA BACK significantly. Show the wide world: room/garden/sky/water/landscape — fully detailed and atmospheric, NOT abstract washes.
Generous BREATHING SPACE around the character — at least 25-30% empty/atmospheric area between character and frame edges.
NOT a portrait. NOT a centered hero shot. NOT a tight close-up.
Think classic picture-book illustration: Sergio Ruzzier, Jon Klassen, Beatrix Potter — small child in a large detailed world, with room to breathe.
Override any earlier instruction that wants character larger.`;

  // Mobile-overlay band: bottom 33% of the image is mildly quieter for Hebrew text overlay
  // on phones. On desktop the band is cropped out (separate text page). KEEP COLOR — never cream/sepia.
  const textSafeZone = 'TEXT-OVERLAY BAND (bottom 33% of frame, ~one third of frame height): keep environment softer and lower-detail in this band — ground, floor, water, foliage, atmospheric haze — STILL in real saturated colors, NOT cream or sepia. No faces, hands, or important objects in this band. The character can extend INTO this band — only key details stay above.';

  const negativeParts = [
    getNegativeStylePromptBlock(styleId),
    GLOBAL_NEGATIVE_CONSTRAINTS.join('; '),
    ...(input.globalNegativeConstraints ?? []),
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  const negativePrompt = negativeParts.join('; ');
  const styleLockLine = resolvedStyleBlock
    ? `STYLE_LOCK (must match interior pages): ${resolvedStyleBlock}`
    : '';

  // PROMPT ORDER: Framing first (controls composition), then scene, then character identity.
  // The model weights the beginning of the prompt most heavily.
  const finalPrompt = [
    framingDirective,
    sceneDescription,
    characterLockLead || (protagonistLock ? `Main character: ${protagonistLock}` : ''),
    entityLock,
    textSafeZone,
    textZone,
    `Style: ${styleSentence} Children's picture book page, portrait 2:3. Character is one element inside a fully-rendered environment — small and expressive, NOT filling the frame. Background is a detailed scene (room, garden, water, sky — whatever the page describes), rendered with the same warm watercolor style. Maintain exact same artistic style, color palette, and rendering technique across all pages.`,
    styleLockLine,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    styleId,
    positivePrompt: [
      sceneDescription,
      characterLockLead,
      protagonistLock,
      entityLock,
      textZone,
      styleSentence,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n'),
    negativePrompt,
    finalPrompt,
  };
}