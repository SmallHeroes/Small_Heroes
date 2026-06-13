import {
  isStyle01BookStyle,
  isStyle01Phase2BookPipelineEnabled,
} from './style01-gptimage';
import {
  isStyle02BookStyle,
  isStyle02Phase2BookPipelineEnabled,
} from './style02-gptimage';
import { STYLE_IDS, normalizeStyleId } from './styles';

export type LegacyImageProvider = 'replicate' | 'dall-e-3' | 'gpt-image';

export type PipelineStyleBranch = 'style01' | 'style02';

/** Canonical branch for an order's persisted illustrationStyle (DB enum or canonical id). */
export function resolveOrderStyleBranch(illustrationStyle?: string | null): PipelineStyleBranch {
  return normalizeStyleId(illustrationStyle) === STYLE_IDS.DETAILED_WHIMSICAL_WORLD
    ? 'style02'
    : 'style01';
}

/**
 * Gap 2 (bunny forensics, Guy LOCKED 2026-06-10): Style 02 appears in the wizard
 * but is NOT sellable until it passes the full gate chain (guarded-v2 integration +
 * companion sheets + render QA). Server-side block — the UI alone can be bypassed.
 */
export function isStyle02Sellable(): boolean {
  return process.env.STYLE02_SELLABLE?.trim().toLowerCase() === 'true';
}

/** Landing gallery toggle — Style 02 selectable when live (defaults to sellable flag). */
export function isStyle02GalleryLive(): boolean {
  const gallery = process.env.STYLE02_GALLERY_LIVE?.trim().toLowerCase();
  if (gallery === 'true') return true;
  if (gallery === 'false') return false;
  return isStyle02Sellable();
}

export function assertOrderStyleSellable(
  illustrationStyle?: string | null,
  context = 'render'
): void {
  if (resolveOrderStyleBranch(illustrationStyle) === 'style02' && !isStyle02Sellable()) {
    throw new Error(
      `[StyleGate] Style 02 (detailed_whimsical_world) is not sellable yet — blocking ${context}. ` +
        'Proven failure: bunny order cmq82b5f3 rendered through the ungated Style 02 path. ' +
        'Style 02 opens only after its gate chain passes (set STYLE02_SELLABLE=true).'
    );
  }
}

/**
 * Gap 2 hard guard: a pipeline stage running a style branch that does not match
 * the order's illustrationStyle must THROW — not warn, not fall back, never
 * "render anyway". (Bunny order: Style 02 on the order while Stage-0 child
 * anchor ran the hardcoded Style 01 path — silent mixing.)
 */
export function assertPipelineStyleBranchMatchesOrder(input: {
  orderIllustrationStyle?: string | null;
  pipelineStyleBranch: PipelineStyleBranch;
  context: string;
}): void {
  const orderBranch = resolveOrderStyleBranch(input.orderIllustrationStyle);
  if (orderBranch !== input.pipelineStyleBranch) {
    throw new Error(
      `[StyleGate] style mismatch at ${input.context}: order.illustrationStyle=` +
        `"${input.orderIllustrationStyle ?? '(unset)'}" resolves to ${orderBranch} but the ` +
        `pipeline is executing the ${input.pipelineStyleBranch} branch. Refusing to render.`
    );
  }
}

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
