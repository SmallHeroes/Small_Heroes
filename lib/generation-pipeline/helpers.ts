import type { BookPageTemplate } from '@/lib/bookPageLayout';
import { getCompanionById } from '@/lib/companions';

export function effectiveStoryDirectionForV3(
  storyDirection: string | null | undefined,
  storyLength: 'short' | 'medium' | 'long'
): 'bedtime' | 'adventure' | 'fantasy' {
  const d = (storyDirection || '').trim().toLowerCase();
  if (d === 'bedtime' || d === 'adventure' || d === 'fantasy') return d;
  if (storyLength === 'short') return 'bedtime';
  if (storyLength === 'long') return 'fantasy';
  return 'adventure';
}

export function normalizePageTemplate(value: string | null | undefined): BookPageTemplate | null {
  if (value === 'full_bleed_overlay' || value === 'art_top_text_bottom' || value === 'character_vignette_text') {
    return value;
  }
  return null;
}

export function compositionRulesForTemplate(
  template: BookPageTemplate,
  composition?: {
    cameraDistance?: string;
    cameraAngle?: string;
    mainFocus?: string;
    topTextAreaPlan?: string;
    mainIllustrationZone?: string;
    backgroundComplexity?: string;
  }
): string {
  const camera =
    composition?.cameraDistance && composition?.cameraAngle
      ? `${composition.cameraDistance}/${composition.cameraAngle}`
      : 'medium/eye-level';
  const focus = composition?.mainFocus ?? 'single story focus';
  const topZone = composition?.topTextAreaPlan ?? 'calm text-safe area';
  const zone = composition?.mainIllustrationZone ?? 'primary scene zone';
  const complexity = composition?.backgroundComplexity ?? 'moderate';
  if (template === 'full_bleed_overlay') {
    return [
      'pageTemplate=full_bleed_overlay',
      `camera=${camera}`,
      `focus=${focus}`,
      `topTextAreaPlan=${topZone}`,
      'immersive full-page composition with protected text-safe band',
      'no key face/hand/object in text-safe overlay region',
      `backgroundComplexity=${complexity}`,
    ].join(' | ');
  }
  if (template === 'character_vignette_text') {
    return [
      'pageTemplate=character_vignette_text',
      `camera=${camera}`,
      `focus=${focus}`,
      'single focused subject, airy surroundings, generous negative space',
      'visual mass center-to-lower frame, soft dissolving edges',
      `mainIllustrationZone=${zone}`,
    ].join(' | ');
  }
  return [
    'pageTemplate=art_top_text_bottom',
    `camera=${camera}`,
    `focus=${focus}`,
    'upper-half visual focus with calmer lower composition density',
    'designed to naturally fade downward into paper for text area',
    `topTextAreaPlan=${topZone}`,
  ].join(' | ');
}

export function collectExistingImagePageNumbers(
  pages: Array<{ pageNumber: number; imageAsset?: { id: string } | null }>
): number[] {
  return pages
    .filter((page) => Boolean(page.imageAsset?.id))
    .map((page) => page.pageNumber);
}

export function parsePipelineCache(raw: unknown): import('./types').PipelineCache {
  if (!raw || typeof raw !== 'object') return {};
  return raw as import('./types').PipelineCache;
}

export function companionFromWizardMeta(wizardMeta: {
  companionCharacterId?: string | null;
}): ReturnType<typeof getCompanionById> {
  const id = wizardMeta.companionCharacterId?.trim();
  return id ? getCompanionById(id) : null;
}
