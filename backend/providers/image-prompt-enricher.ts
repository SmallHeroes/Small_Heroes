/**
 * image-prompt-enricher.ts — Adds layout-aware composition rules to imageDirection.
 *
 * The raw imageDirection from story files describes WHO/WHAT/WHERE.
 * This layer adds HOW TO COMPOSE — based on the page's layout, word count, and text zone.
 *
 * Pipeline position: story.imageDirection → enrichImageDirection() → GPT image API
 */

export type PageLayout = 'full_bleed_soft' | 'vignette_breath' | 'asymmetric_split' | 'letter' | 'cover';
export type TextZone = 'top_clear' | 'bottom_clear' | null;

export interface EnrichInput {
  rawImageDirection: string;
  layout: PageLayout;
  wordCount: number;
  textZone: TextZone;
  isQuietPage?: boolean;
  isClosing?: boolean;
}

const COMPOSITION_TEMPLATES: Record<PageLayout, (input: EnrichInput) => string> = {
  full_bleed_soft: ({ textZone, wordCount }) => {
    const textArea = textZone === 'top_clear' ? 'TOP 40%' : 'LOWER 40%';
    const focalArea = textZone === 'top_clear' ? 'LOWER 60%' : 'UPPER 60%';
    const density = wordCount > 45
      ? 'Use simplified composition with strong silhouettes — text will compete for attention.'
      : 'Composition can include rich detail, varied textures, painterly nuance.';
    return [
      'COMPOSITION RULES:',
      `- Full-page bleed composition. Aspect 4:5 vertical.`,
      `- Critical focal subject and characters in ${focalArea} of frame.`,
      `- ${textArea} must be visually QUIET: soft pastel sky, blurred ground, gentle texture (sand/blanket/water surface). Avoid critical details, faces, or busy patterns there.`,
      `- Lighting transitions smoothly from subject area to text reservation area.`,
      `- ${density}`,
    ].join('\n');
  },

  vignette_breath: ({ wordCount }) => [
    'COMPOSITION RULES:',
    `- Centered VIGNETTE composition. Aspect 1:1 square.`,
    `- Image occupies inner 65% of canvas. Edges fade naturally to soft cream/paper-tone.`,
    `- ONE primary focal element. Minimal background detail.`,
    `- Painterly soft edges. Muted but warm palette.`,
    `- This is a "breath moment" — image should feel still, intimate, contemplative.`,
    `- ${wordCount < 15 ? 'Rich painterly detail OK — text is brief.' : 'Keep composition simple — text will accompany.'}`,
  ].join('\n'),

  asymmetric_split: () => [
    'COMPOSITION RULES:',
    `- Compose for UPPER HALF of canvas only. Aspect 4:3 landscape.`,
    `- All critical action and characters in TOP 55% of frame.`,
    `- LOWER 45% should be visually quiet — soft floor, sky, ground — designed to be cropped or covered by clean text panel.`,
    `- Strong silhouettes in upper portion. Lower portion: soft gradient or unfocused.`,
  ].join('\n'),

  letter: () => [
    'COMPOSITION RULES:',
    `- Portrait close-up of the companion ONLY. Aspect 1:1 square.`,
    `- Intimate eye-level framing. Companion looking at camera with quiet recognition.`,
    `- Single subject. Soft painted background (warm cream/sunset/twilight).`,
    `- NO child in frame. NO other characters.`,
    `- Painterly portrait style — like an inset character study from a picture book.`,
  ].join('\n'),

  cover: () => [
    'COMPOSITION RULES:',
    `- Full-page bleed. Aspect 4:5 vertical.`,
    `- Hero composition: child and companion together, warmth, intrigue.`,
    `- Reserve TOP 25% for title overlay — soft sky/light/gradient area.`,
    `- Strong color identity that telegraphs the story's emotional category.`,
  ].join('\n'),
};

export function enrichImageDirection(input: EnrichInput): string {
  const composition = COMPOSITION_TEMPLATES[input.layout](input);
  return `${input.rawImageDirection.trim()}\n\n${composition}`;
}

/**
 * Decision heuristic — derives the right layout for a page based on its content.
 * Used by reader and pipeline alike.
 */
export function deriveLayout(args: {
  pageNumber: number;
  totalPages: number;
  text: string;
  isCover?: boolean;
  isLetter?: boolean;
  isQuietPage?: boolean;
}): PageLayout {
  if (args.isCover) return 'cover';
  if (args.isLetter) return 'letter';

  const wordCount = args.text.trim().split(/\s+/).filter(Boolean).length;
  const isClosing = args.pageNumber === args.totalPages;

  if (args.isQuietPage || (isClosing && wordCount < 20)) return 'vignette_breath';
  if (wordCount < 20) return 'vignette_breath';

  return 'full_bleed_soft';
}

export function countHebrewWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function parseEnrichTextZone(raw: string | null | undefined): TextZone {
  if (raw === 'top_clear' || raw === 'bottom_clear') return raw;
  return null;
}

export function buildEnrichedScenePrompt(args: {
  rawScenePrompt?: string | null;
  imagePrompt: string;
  layout: PageLayout;
  text: string;
  textZone?: string | null;
  isLetter?: boolean;
  isQuietPage?: boolean;
  pageNumber: number;
  totalPages: number;
}): { rawScenePrompt: string; imagePrompt: string } {
  const rawImageDirection = (args.rawScenePrompt ?? args.imagePrompt ?? '').trim();
  const wordCount = countHebrewWords(args.text);
  const enriched = enrichImageDirection({
    rawImageDirection,
    layout: args.layout,
    wordCount,
    textZone: parseEnrichTextZone(args.textZone),
    isQuietPage: args.isQuietPage,
    isClosing: args.pageNumber === args.totalPages,
  });

  const rawScene = args.rawScenePrompt?.trim();
  if (rawScene && args.imagePrompt.includes(rawScene)) {
    return {
      rawScenePrompt: enriched,
      imagePrompt: args.imagePrompt.replace(rawScene, enriched),
    };
  }

  return {
    rawScenePrompt: enriched,
    imagePrompt: enriched,
  };
}
