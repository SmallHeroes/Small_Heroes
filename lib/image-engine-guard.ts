import {
  isStyle01BookStyle,
  isStyle01Phase2BookPipelineEnabled,
} from './style01-gptimage';
import {
  isStyle02BookStyle,
  isStyle02Phase2BookPipelineEnabled,
} from './style02-gptimage';

export type LegacyImageProvider = 'replicate' | 'dall-e-3' | 'gpt-image';

/**
 * Shipped wizard styles (Style 01 / 02) must use phase-2 gpt-image-2 — never silent Flux/gpt-image-1.
 */
export function assertShippedBookStyleEngineActive(illustrationStyle?: string | null): void {
  if (isStyle01BookStyle(illustrationStyle) && !isStyle01Phase2BookPipelineEnabled()) {
    throw new Error(
      '[ImageEngine] Style 01 (soft_hand_drawn_storybook) requires PHASE2_STYLE01_BOOK_PIPELINE=true with gpt-image-2. ' +
        'Refusing silent Flux/gpt-image-1 fallback. Set IMAGE_PROVIDER=gpt-image and STYLE_01_GPT_MODEL=gpt-image-2.'
    );
  }
  if (isStyle02BookStyle(illustrationStyle) && !isStyle02Phase2BookPipelineEnabled()) {
    throw new Error(
      '[ImageEngine] Style 02 (detailed_whimsical_world) requires PHASE2_STYLE02_BOOK_PIPELINE=true with gpt-image-2. ' +
        'Refusing silent Flux/gpt-image-1 fallback. Set IMAGE_PROVIDER=gpt-image.'
    );
  }
}

/** Legacy/dev providers only — never defaults; unset IMAGE_PROVIDER throws. */
export function resolveLegacyImageProviderEnv(): LegacyImageProvider {
  const raw = process.env.IMAGE_PROVIDER?.trim();
  if (!raw) {
    throw new Error(
      '[ImageEngine] IMAGE_PROVIDER is unset. Shipped Style 01/02 books use PHASE2_STYLE01_BOOK_PIPELINE / PHASE2_STYLE02_BOOK_PIPELINE. ' +
        'For dev-only legacy Flux or gpt-image-1, set IMAGE_PROVIDER explicitly to replicate, gpt-image, or dall-e-3.'
    );
  }
  const lower = raw.toLowerCase();
  if (lower === 'dall-e-3') return 'dall-e-3';
  if (lower === 'gpt-image') return 'gpt-image';
  if (lower === 'replicate') return 'replicate';
  throw new Error(
    `[ImageEngine] Unsupported IMAGE_PROVIDER="${raw}". Expected gpt-image, replicate, or dall-e-3.`
  );
}
