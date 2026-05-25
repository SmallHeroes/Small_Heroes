/**
 * Scene-led Flux prompt assembly (Experiment — FLUX_CLEAN_PROMPT=on).
 * Legacy buildImagePrompt is unchanged when the flag is off.
 */

import type { Companion } from './companions';
import { resolveBookWardrobeLock, type BookDirection } from './book-wardrobe-lock';

export const FLUX_CLEAN_TRIGGER = 'SOFTSTYLE01';

/** Style tag for base flux-dev (no LoRA) — neutral WB, no warm/cozy cast wording. */
export const FLUX_CLEAN_STYLE_TAG =
  "soft watercolor children's-book illustration on neutral white paper, rounded cute characters with large sparkling eyes and rosy cheeks, balanced palette with neutral white balance and no yellow or amber color cast";

/** Line 2 of every clean prompt — breathing-room floor, not a fixed composition. */
export const FLUX_CLEAN_FRAMING_FLOOR =
  'Framing: keep the child within a fully-drawn environment with open breathing space at the frame edges — never a tight face crop, never the child filling the whole frame.';

export const FLUX_CLEAN_ANTI_CROP_NEGATIVES =
  'close-up portrait, cropped face, character filling the frame, oversized character, tight head crop, empty background';

export const FLUX_CLEAN_BOLLY_COMPANION_LINE =
  'Bolly, small friendly armadillo with a hard segmented armored shell arched over his back, warm tan-brown shell plates, soft pink belly, round dark gentle eyes.';

const HEBREW_SCRIPT = /[\u0590-\u05FF]/;

export type FluxCleanPromptInput = {
  sceneText: string;
  childLine: string;
  companionLine?: string;
  compositionLine: string;
};

export function isFluxCleanPromptEnabled(): boolean {
  return process.env.FLUX_CLEAN_PROMPT?.trim().toLowerCase() === 'on';
}

export function countPromptWords(prompt: string): number {
  return prompt.split(/\s+/).filter(Boolean).length;
}

const FLUX_CLEAN_WORD_MIN = 70;
const FLUX_CLEAN_WORD_MAX = 130;

/** Trim scene text so full prompt can stay within FLUX_CLEAN_WORD_MAX. */
export function trimFluxCleanSceneToBudget(
  sceneText: string,
  input: Omit<FluxCleanPromptInput, 'sceneText'>
): string {
  const overhead = countPromptWords(
    buildFluxCleanPositivePrompt({ ...input, sceneText: '' }).replace(/\n\n+/g, '\n')
  );
  const sceneBudget = Math.min(50, Math.max(22, FLUX_CLEAN_WORD_MAX - overhead - 2));
  const words = sanitizeFluxCleanEnglishText(sceneText).split(/\s+/).filter(Boolean);
  if (words.length <= sceneBudget) {
    return words.join(' ');
  }
  const trimmed = words.slice(0, sceneBudget).join(' ');
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

/** Build positive prompt and shave scene words until total is within budget. */
export function buildFluxCleanPromptWithinBudget(
  sceneText: string,
  input: Omit<FluxCleanPromptInput, 'sceneText'>
): { sceneText: string; finalPrompt: string; wordCount: number } {
  let scene = trimFluxCleanSceneToBudget(sceneText, input);
  let finalPrompt = buildFluxCleanPositivePrompt({ ...input, sceneText: scene });
  let wordCount = countPromptWords(finalPrompt);
  while (wordCount > FLUX_CLEAN_WORD_MAX) {
    const words = scene.split(/\s+/).filter(Boolean);
    if (words.length <= 8) break;
    scene = words.slice(0, words.length - 1).join(' ');
    if (!scene.endsWith('.')) scene += '.';
    finalPrompt = buildFluxCleanPositivePrompt({ ...input, sceneText: scene });
    wordCount = countPromptWords(finalPrompt);
  }
  return { sceneText: scene, finalPrompt, wordCount };
}

/** English display name for the child in Flux prompts (never Hebrew / Micha / Michael). */
export function normalizeFluxChildDisplayName(childName?: string | null): string {
  const raw = (childName ?? '').trim();
  if (!raw || HEBREW_SCRIPT.test(raw)) return 'Michal';
  if (/^micha$/i.test(raw)) return 'Michal';
  if (/^michael$/i.test(raw)) return 'Michal';
  if (/^michal$/i.test(raw)) return 'Michal';
  return raw;
}

/** Strip Hebrew, normalize names, fix known LLM typos; never emit literal close-up. */
export function sanitizeFluxCleanEnglishText(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/\bMicha\b/g, 'Michal');
  t = t.replace(/\bMichael\b/gi, 'Michal');
  t = t.replace(/\bמיכל\b/g, 'Michal');
  t = t.replace(/בּוֹלִי|בולי/g, 'Bolly');
  t = t.replace(/soft\s+pi\s+ink/gi, 'soft pink');
  t = t.replace(/\bpi\s+ink\b/gi, 'pink');
  t = t.replace(/\bclose-up\b/gi, 'medium-close');
  t = t.replace(/[\u0590-\u05FF]/g, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

export function fluxCleanPromptContainsHebrew(prompt: string): boolean {
  return HEBREW_SCRIPT.test(prompt);
}

export function fluxCleanPromptContainsCloseUp(prompt: string): boolean {
  return /\bclose-up\b/i.test(prompt);
}

/** Warm-cast wording must not appear in the style line (line 1 of the clean prompt). */
export function fluxCleanStyleLineHasWarmCastWording(prompt: string): boolean {
  const styleLine = prompt.split('\n')[0] ?? '';
  return (
    /\bwarm\b/i.test(styleLine) ||
    /\bcozy\b/i.test(styleLine) ||
    /warm cream/i.test(styleLine)
  );
}

export function fluxCleanStyleLineHasNeutralWhiteBalance(prompt: string): boolean {
  const styleLine = prompt.split('\n')[0] ?? '';
  return /neutral white balance/i.test(styleLine) && /no yellow or amber/i.test(styleLine);
}

export function buildFluxCleanPositivePrompt(input: FluxCleanPromptInput): string {
  const sceneText = sanitizeFluxCleanEnglishText(input.sceneText);
  const childLine = sanitizeFluxCleanEnglishText(input.childLine);
  const companionLine = input.companionLine?.trim()
    ? sanitizeFluxCleanEnglishText(input.companionLine)
    : undefined;
  const compositionLine = sanitizeFluxCleanEnglishText(input.compositionLine);

  const lines = [
    `${FLUX_CLEAN_TRIGGER} style, ${FLUX_CLEAN_STYLE_TAG}.`,
    FLUX_CLEAN_FRAMING_FLOOR,
    sceneText,
    `Child: ${childLine}`,
  ];
  if (companionLine) {
    lines.push(`Companion: ${companionLine}`);
  }
  lines.push(`Composition: ${compositionLine}`);
  return lines.join('\n');
}

export function buildFluxCleanChildLine(input: {
  childName?: string | null;
  childAge?: number | null;
  childGender?: string | null;
  directionArchetype?: BookDirection | string | null;
  heroVisualLock?: {
    skinTone?: string;
    hair?: string;
    clothing?: string;
  } | null;
}): string {
  const wardrobe = resolveBookWardrobeLock(input.directionArchetype ?? null);
  const age = input.childAge && input.childAge > 0 ? input.childAge : 5;
  const gender =
    input.childGender === 'girl' ? 'girl' : input.childGender === 'boy' ? 'boy' : 'child';
  const skin = (input.heroVisualLock?.skinTone?.trim() || 'olive skin').split(',')[0].trim();
  const hairShort = wardrobe
    ? 'dark wavy shoulder-length hair, center part'
    : (input.heroVisualLock?.hair?.trim() || 'natural hair').slice(0, 45);
  const outfitShort = wardrobe
    ? wardrobe.direction === 'bedtime'
      ? 'lavender star-print pajamas, bare feet'
      : wardrobe.direction === 'adventure'
        ? 'coral tee, denim jeans, white sneakers'
        : 'sage tunic, cream leggings'
    : (input.heroVisualLock?.clothing?.trim() || 'simple clothing').slice(0, 40);
  const name = normalizeFluxChildDisplayName(input.childName);
  return sanitizeFluxCleanEnglishText(
    `${name}, ${age}-year-old ${gender}, ${skin}, ${hairShort}, ${outfitShort}.`
  );
}

export function buildFluxCleanCompanionLine(
  companion?: Companion | null,
  _companionStructured?: { species?: string; coloring?: string; feature?: string } | null
): string {
  if (!companion || companion.id === 'bolly_armadillo') {
    return sanitizeFluxCleanEnglishText(FLUX_CLEAN_BOLLY_COMPANION_LINE);
  }
  const displayName = companion.name?.trim() || 'companion';
  return sanitizeFluxCleanEnglishText(
    `${displayName}, small friendly creature with clear species-appropriate features, gentle round eyes.`
  );
}

/** Storyboard per-page shot → single composition line (only composition signal on clean path). */
export function buildFluxCleanCompositionLine(storyboard: {
  shotType: string;
  cameraAngle: string;
  protagonistDominance: string;
  compositionMode?: string;
}): string {
  const shot =
    storyboard.shotType === 'wide'
      ? 'wide shot'
      : storyboard.shotType === 'close_up'
        ? 'medium-close shot'
        : storyboard.shotType === 'medium'
          ? 'medium shot'
          : storyboard.shotType === 'over_shoulder'
            ? 'over-the-shoulder shot'
            : 'tracking shot';
  const angle =
    storyboard.cameraAngle === 'low_angle'
      ? 'low angle'
      : storyboard.cameraAngle === 'high_angle'
        ? 'high angle'
        : storyboard.cameraAngle === 'three_quarter'
          ? 'three-quarter view'
          : 'eye-level';
  const dominance =
    storyboard.protagonistDominance === 'background'
      ? 'child small in the environment'
      : storyboard.protagonistDominance === 'shared'
        ? 'child and companion share the frame'
        : 'child mid-action in the scene';
  const mode =
    storyboard.compositionMode === 'duo_interaction'
      ? 'duo interaction visible'
      : storyboard.compositionMode === 'environmental'
        ? 'environment-led framing'
        : '';
  return [shot, angle, dominance, mode].filter(Boolean).join(', ') + '.';
}

export function shouldIncludeCompanionInFluxCleanPrompt(input: {
  companion?: Companion | null;
  bookPageText?: string | null;
  pagePrompt?: string;
  visualDirection?: { mustInclude?: string[]; mustNotInclude?: string[] } | null;
  expectedCharacterIds?: string[];
  pageStoryboard?: { compositionMode?: string; action?: string } | null;
}): boolean {
  if (!input.companion?.name?.trim()) return false;

  const companionKeyPrefix = 'companion:';
  if (
    input.expectedCharacterIds?.some((id) =>
      id.toLowerCase().startsWith(companionKeyPrefix)
    )
  ) {
    return true;
  }

  const mustNot = (input.visualDirection?.mustNotInclude ?? []).map((s) => s.toLowerCase());
  const companionNameLc = input.companion.name.toLowerCase();
  if (mustNot.some((item) => companionNameLc && item.includes(companionNameLc))) {
    return false;
  }

  const mustInclude = (input.visualDirection?.mustInclude ?? []).map((s) => s.toLowerCase());
  if (mustInclude.some((item) => companionNameLc && item.includes(companionNameLc))) {
    return true;
  }
  const speciesLc = (input.companion.visualDescription ?? '').toLowerCase();
  if (
    mustInclude.some(
      (item) =>
        item.includes('companion') ||
        item.includes('armadillo') ||
        item.includes('bolly') ||
        (speciesLc && speciesLc.split(/\s+/).some((tok) => tok.length > 3 && item.includes(tok)))
    )
  ) {
    return true;
  }

  const haystack = `${input.pagePrompt ?? ''} ${input.bookPageText ?? ''}`.toLowerCase();
  if (companionNameLc && haystack.includes(companionNameLc)) return true;
  if (haystack.includes('bolly') || haystack.includes('בולי') || haystack.includes('בּוֹלִי')) {
    return true;
  }

  const sb = input.pageStoryboard;
  if (sb?.compositionMode === 'duo_interaction') return true;
  if ((sb?.action ?? '').toLowerCase().includes('companion')) return true;
  if ((sb?.action ?? '').toLowerCase().includes('bolly')) return true;

  return false;
}

/** Alias matching experiment brief naming. */
export const buildFluxCleanPrompt = buildFluxCleanPositivePrompt;