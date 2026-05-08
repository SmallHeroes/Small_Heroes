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
  const textSafeZone = styleId === STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK
    ? 'CRITICAL LAYOUT: The top 25% of the image MUST be empty cream/off-white paper — no scene detail, no dark colors, no objects in this zone. This is a mandatory blank text area. The character and scene action should be in the center and lower 75% of the image.'
    : 'CRITICAL LAYOUT: The top 25% of the image MUST fade to a soft, light, nearly-white warm tone (cream, off-white, or the lightest tone of the scene palette). No dark sky, no trees, no detailed scenery in this zone — it must be a clean light area suitable for dark text overlay. The scene and characters occupy the center and lower 75% of the image. Background dissolves into abstract warm tones above the characters.';

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

  // SCENE-FIRST PROMPT ORDER: Flux gives most weight to the start of the prompt.
  // Scene description must come FIRST so the model renders a scene, not a character portrait.
  // Character identity comes after — compact, not repeated.
  const protagonistRule = 'MANDATORY: The child protagonist MUST appear in EVERY page illustration. Never generate a landscape-only or environment-only image without the child character visible and prominent.';

  const finalPrompt = [
    sceneDescription,
    characterLockLead || (protagonistLock ? `Main character: ${protagonistLock}` : ''),
    entityLock,
    protagonistRule,
    textSafeZone,
    textZone,
    `Style: ${styleSentence} ${styleId === STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK ? 'Prominent character illustration on cream paper for a children\'s picture book page, portrait 2:3. Character fills most of the image with cream paper visible at edges.' : 'Realistic artistic illustration for a children\'s picture book page, portrait 2:3. Characters in sharp painterly detail, background dissolving into warm watercolor washes. Top area open for text.'} Maintain exact same artistic style, color palette, and rendering technique across all pages.`,
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