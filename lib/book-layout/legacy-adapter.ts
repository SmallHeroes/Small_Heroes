/**
 * One-way adapter: legacy API book payload → StoryScene[].
 */

import { formatHebrewForDisplay } from '@/lib/hebrew-text';
import { recomputeStorySceneLayout } from './recompute-scene-layout';
import type {
  IllustrationAspect,
  SceneKind,
  SceneLayout,
  StoryDirection,
  StoryScene,
  TextTreatment,
} from './types';

export type LegacyBookPage = {
  pageNumber: number;
  title?: string | null;
  text: string;
  narrationText?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  presentationImageUrl?: string | null;
  isCover?: boolean;
  isDedication?: boolean;
  isLetter?: boolean;
  isQuietPage?: boolean;
  pageTemplate?: string | null;
  pageLayout?: string | null;
  textZone?: string | null;
  /** Future: when API exposes StoryScene metadata */
  layout?: SceneLayout;
  illustrationAspect?: IllustrationAspect;
  textTreatment?: TextTreatment;
  direction?: StoryDirection;
  sceneId?: string;
  companionPresent?: boolean;
  emotionalBeat?: string | null;
};

export type LegacyBookPayload = {
  title?: string | null;
  pages: LegacyBookPage[];
  storyScenes?: StoryScene[];
};

export type AdaptBookInput = {
  book: LegacyBookPayload;
  storyDirection?: string | null;
  storyLength?: string | null;
};

function normalizeDirection(
  raw: string | null | undefined,
  storyLength?: string | null
): StoryDirection {
  const d = (raw ?? '').trim().toLowerCase();
  if (d === 'bedtime' || d === 'adventure' || d === 'fantasy') return d;
  const len = (storyLength ?? '').toLowerCase();
  if (len === 'short') return 'bedtime';
  if (len === 'long') return 'fantasy';
  return 'adventure';
}

function resolveImageUrl(page: LegacyBookPage): string | null {
  const u = page.imageUrl ?? page.presentationImageUrl ?? null;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function inferKind(page: LegacyBookPage): SceneKind {
  if (page.pageNumber === 0 || page.isCover) return 'cover';
  if (page.isDedication) return 'dedication';
  return 'story';
}

function legacyPageToScene(
  page: LegacyBookPage,
  sceneIndex: number,
  direction: StoryDirection
): StoryScene {
  const kind = inferKind(page);
  const layout: SceneLayout = page.layout ?? 'standard';
  const illustrationAspect: IllustrationAspect = page.illustrationAspect ?? 'portrait';
  const imageUrl = resolveImageUrl(page);
  const rawAudio = typeof page.audioUrl === 'string' ? page.audioUrl.trim() : '';

  const base: StoryScene = {
    sceneIndex,
    sceneId: page.sceneId ?? `scene-${page.pageNumber}`,
    kind,
    text: compactStoryText(formatHebrewForDisplay(page.text ?? '')),
    illustration: {
      imageUrl,
      aspect: illustrationAspect,
      alt: kind === 'cover' ? 'כריכת הספר' : `איור סצנה ${page.pageNumber}`,
    },
    direction: page.direction ?? direction,
    layout,
    illustrationAspect,
    textTreatment: page.textTreatment ?? 'standard',
    audioUrl: rawAudio.length > 0 ? rawAudio : null,
    title: page.title ?? null,
    companionPresent: page.companionPresent,
    emotionalBeat: page.emotionalBeat ?? null,
    effectiveLayout: 'standard',
    effectiveTextTreatment: 'standard',
  };

  return recomputeStorySceneLayout(base);
}

export function compactStoryText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split prose into sentence paragraphs for reader typography. */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [' '];
  const sentences = trimmed
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [trimmed];
}

/** Split Hebrew prose into read-aloud rhythm lines. */
export function splitTextByRhythm(text: string): string[] {
  if (!text) return [' '];
  const byNewline = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  return splitIntoSentences(text);
}

export function adaptLegacyBookToStoryScenes(input: AdaptBookInput): StoryScene[] {
  if (input.book.storyScenes?.length) {
    return input.book.storyScenes;
  }

  const direction = normalizeDirection(input.storyDirection, input.storyLength);
  const sorted = [...input.book.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return sorted.map((page, i) => legacyPageToScene(page, i, direction));
}

export function buildRenderedBookMeta(scenes: StoryScene[]): {
  layoutVersion: 'book-layout-v1';
  templateVersion: `${StoryDirection}-v1`;
  sceneCount: number;
} {
  const storyScenes = scenes.filter((s) => s.kind === 'story');
  const direction = storyScenes[0]?.direction ?? 'adventure';
  return {
    layoutVersion: 'book-layout-v1',
    templateVersion: `${direction}-v1`,
    sceneCount: storyScenes.length,
  };
}
