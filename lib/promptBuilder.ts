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
    ? 'Leave the top 20-30% of the image as cream paper space for text. The character should be prominent in the center/lower area — filling at least 50% of the image height.'
    : 'The top 20-30% of the image must fade into soft warm watercolor washes — open warm space for text overlay. Background dissolves into abstract warm tones above and around the characters. No fully detailed backgrounds edge-to-edge. No picture frame borders.';

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
  const finalPrompt = [
    sceneDescription,
    characterLockLead || (protagonistLock ? `Main character: ${protagonistLock}` : ''),
    entityLock,
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