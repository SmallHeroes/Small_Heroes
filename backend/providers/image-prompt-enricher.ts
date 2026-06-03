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
  full_bleed_soft: ({ wordCount }) => {
    const density = wordCount > 45
      ? 'Use simplified composition with strong silhouettes — keep it readable.'
      : 'Composition can include rich detail, varied textures, painterly nuance.';
    return [
      'COMPOSITION RULES:',
      `- TRUE full-bleed illustration filling the ENTIRE frame edge-to-edge. Aspect 4:5 vertical.`,
      `- Paint EVERY area of the canvas fully, including the bottom — do NOT leave any region quiet, blurred, empty, faded, or dissolving into paper. There is NO reserved text panel and NO empty band.`,
      `- Keep the main face/focal subject out of the very bottom ~15% strip (mobile overlays caption text there), but still PAINT that strip fully (ground, floor, grass, scenery) — it must not be blank.`,
      `- ${density}`,
      `- PALETTE: soft, muted, gentle watercolor tones on warm cream paper — calm and desaturated, like a classic printed children's book. Color comes from delicate pigment layering, NOT from intensity. Do NOT render vivid, neon, glossy, or oversaturated colors.`,
      // BREATHING-ROOM RULES (keep — prevents tight crops; characters were filling 75%+ of frames):
      `- CHARACTER SIZE: The main character should occupy roughly 35-50% of the frame, NOT dominate the entire image.`,
      `- ENVIRONMENT VISIBLE: Show the WORLD around the character — garden, room corner, ground, sky, props, depth. The character lives in a place; show the place edge-to-edge.`,
      `- AVOID TIGHT CROPS: Unless the storyboard specifies close_up shot type, do NOT crop to head-and-shoulders or fill the frame with the character.`,
      `- Reference style: classic Hebrew children's books (Devorah Omer, Shoham Smit) — characters live within fully-painted illustrated worlds, not as portrait close-ups.`,
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
    // BREATHING-ROOM (vignette):
    `- CHARACTER SIZE: Character occupies roughly 40-55% of the inner image (not the full circle). Leave breathing room around them within the vignette.`,
    `- Show ONE small environmental cue (a leaf, a corner of blanket, a stone) — don't isolate the character on pure cream.`,
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
 *
 * Priority order:
 *   1. Special pages (cover / letter) — always specific layouts
 *   2. Storyboard's explicit choice (vignette / full_bleed) — preferred
 *   3. Heuristic fallback based on word count / quiet flag
 */
export function deriveLayout(args: {
  pageNumber: number;
  totalPages: number;
  text: string;
  isCover?: boolean;
  isLetter?: boolean;
  isQuietPage?: boolean;
  /** Storyboard's per-page choice — takes priority over heuristic when provided. */
  storyboardLayoutStyle?: 'vignette' | 'full_bleed' | null;
}): PageLayout {
  if (args.isCover) return 'cover';
  if (args.isLetter) return 'letter';

  // Storyboard intelligently chose for this page — trust it.
  if (args.storyboardLayoutStyle === 'vignette') return 'vignette_breath';
  if (args.storyboardLayoutStyle === 'full_bleed') return 'full_bleed_soft';

  // Heuristic fallback (no storyboard data).
  // We default to full_bleed_soft for ALL body pages so the reader keeps a
  // consistent spread layout. Only explicit isQuietPage flags get vignette.
  if (args.isQuietPage) return 'vignette_breath';
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
