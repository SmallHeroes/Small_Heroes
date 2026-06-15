/**
 * Shared book-level image lock contract — style-agnostic DATA consumed by
 * Style 01 and Style 02 renderers (separate prompt language + style refs).
 */
import type { BookShotPlan, PageShot } from './book-shot-plan';
import type {
  BookLocationBible,
  PageLocationPlan,
  StoryLocationPlanBundle,
} from './story-location-bible';
import type { StoryTimeOfDay } from './story-time-of-day';
import { resolveEffectivePageTimeOfDay } from './story-time-of-day';
import type { FamilyCoherenceBundle } from './family-coherence';
import type { StoryRecurringEntityDeclaration } from './story-bank/recurring-entities';
import type { SceneMemory, SceneMemoryPlan } from './scene-memory/types';
import {
  assembleStyle02BookReferences,
  type Style02RefBudgetConfig,
} from './style02-gptimage';
import { resolveGPTImageEditMaxReferences } from './generate-image';
import { isStyle02Sellable } from './image-engine-guard';

/** Book-level locks resolved once per render — shared by both style renderers. */
export interface BookImageLockContext {
  bookShotPlan: BookShotPlan | null;
  storyLocationPlan: StoryLocationPlanBundle | null;
  sceneMemoryPlan: SceneMemoryPlan | null;
  storyTimeOfDay?: StoryTimeOfDay;
  pageTimeOfDayOverrides?: Partial<Record<number, StoryTimeOfDay>>;
  familyCoherence?: FamilyCoherenceBundle | null;
  storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
  /** Canonical child anchor path (Style01 Method-B or Style02 Stage0). */
  childCanonicalAnchorPath?: string | null;
  totalPages?: number;
}

/** Per-page slice derived from {@link BookImageLockContext}. */
export interface PageImageLockSlice {
  pageNumber: number;
  pageShot: PageShot | null;
  pageLocationPlan: PageLocationPlan | null;
  locationBible: BookLocationBible | null;
  effectivePageTimeOfDay: StoryTimeOfDay;
  isolatedObjectRefPaths: string[];
  sceneMemory: SceneMemory | null;
}

export const STYLE02_REFERENCE_KIND_ORDER = [
  'child',
  'companion',
  'isolatedObjects',
  'otherCharacters',
  'style',
] as const;

export type Style02ReferenceKind = (typeof STYLE02_REFERENCE_KIND_ORDER)[number];

export function buildBookImageLockContext(input: {
  bookShotPlan?: BookShotPlan | null;
  storyLocationPlan?: StoryLocationPlanBundle | null;
  sceneMemoryPlan?: SceneMemoryPlan | null;
  storyTimeOfDay?: StoryTimeOfDay;
  pageTimeOfDayOverrides?: Partial<Record<number, StoryTimeOfDay>>;
  familyCoherence?: FamilyCoherenceBundle | null;
  storyRecurringEntityDeclarations?: StoryRecurringEntityDeclaration[];
  childCanonicalAnchorPath?: string | null;
  totalPages?: number;
}): BookImageLockContext {
  return {
    bookShotPlan: input.bookShotPlan ?? null,
    storyLocationPlan: input.storyLocationPlan ?? null,
    sceneMemoryPlan: input.sceneMemoryPlan ?? null,
    storyTimeOfDay: input.storyTimeOfDay,
    pageTimeOfDayOverrides: input.pageTimeOfDayOverrides,
    familyCoherence: input.familyCoherence ?? null,
    storyRecurringEntityDeclarations: input.storyRecurringEntityDeclarations,
    childCanonicalAnchorPath: input.childCanonicalAnchorPath ?? null,
    totalPages: input.totalPages,
  };
}

export function resolvePageImageLockSlice(
  ctx: BookImageLockContext,
  pageNumber: number,
  pageTextHints?: { imageDirection?: string | null; bookPageText?: string | null }
): PageImageLockSlice {
  const pageShot =
    ctx.bookShotPlan?.pages.find((slot) => slot.page === pageNumber) ?? null;
  const pageLocationPlan =
    ctx.storyLocationPlan?.pagePlans.find((p) => p.page === pageNumber) ?? null;
  const storyDefault = ctx.storyTimeOfDay ?? 'day';
  const effectivePageTimeOfDay = resolveEffectivePageTimeOfDay({
    storyTimeOfDay: storyDefault,
    pageNumber,
    pageTimeOfDayOverrides: ctx.pageTimeOfDayOverrides,
    imageDirection: pageTextHints?.imageDirection,
    bookPageText: pageTextHints?.bookPageText,
  });
  const isolatedObjectRefPaths = (
    pageLocationPlan?.referenceSheets?.isolatedObjectPaths ?? []
  ).filter(Boolean);

  return {
    pageNumber,
    pageShot,
    pageLocationPlan,
    locationBible: ctx.storyLocationPlan?.bible ?? null,
    effectivePageTimeOfDay,
    isolatedObjectRefPaths,
    sceneMemory: ctx.sceneMemoryPlan?.memory ?? null,
  };
}

export function isStyle02CanonicalChildAnchorPath(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl?.trim()) return false;
  const hay = pathOrUrl.replace(/\\/g, '/');
  return (
    hay.includes('/character-anchors/') ||
    hay.includes('character-anchors%2F') ||
    hay.includes('child-canonical-style02')
  );
}

export function resolveStyle02ChildAnchorPath(input: {
  childCanonicalAnchorPath?: string | null;
  anchorCharacters?: Array<{ characterId: string; anchorImageUrl?: string }>;
  referenceImages?: string[];
}): string | undefined {
  if (input.childCanonicalAnchorPath?.trim()) {
    return input.childCanonicalAnchorPath.trim();
  }
  const fromAnchor = input.anchorCharacters?.find((c) => c.characterId === 'child')?.anchorImageUrl;
  if (fromAnchor?.trim()) return fromAnchor.trim();
  const first = input.referenceImages?.[0]?.trim();
  if (first && isStyle02CanonicalChildAnchorPath(first)) return first;
  return first;
}

/** Sellable Style 02 must keep the canonical child anchor in ref breakdown (config C omits child). */
export function assertStyle02SellableChildAnchorInBreakdown(input: {
  breakdown: Record<string, string[]>;
  childAnchorPath?: string;
  sellablePath?: boolean;
}): void {
  const sellable = input.sellablePath ?? isStyle02Sellable();
  if (!sellable || !input.childAnchorPath?.trim()) return;
  if ((input.breakdown.child?.length ?? 0) < 1) {
    throw new Error(
      '[Style02] sellable path requires canonical child anchor in reference breakdown — config C cannot omit child ref'
    );
  }
}

/**
 * Style 02 reference assembly with full lock contract:
 * child → companion → isolatedObjects → otherCharacters → style
 * (identity anchors before style refs; style dropped first if over GPT max).
 */
export function assembleStyle02BookReferencesWithLocks(input: {
  styleRefPaths: string[];
  childAnchorPath?: string;
  companionRefPath?: string;
  companionRefPaths?: string[];
  otherCharacterRefPaths?: string[];
  isolatedObjectRefPaths?: string[];
  config: Style02RefBudgetConfig;
  /** When true, canonical child anchor is always included (overrides config C). */
  requireChildAnchor?: boolean;
}): { paths: string[]; breakdown: Record<string, string[]> } {
  const companionPath =
    input.companionRefPath ??
    (input.companionRefPaths?.length ? input.companionRefPaths[0] : undefined);

  let effectiveConfig = input.config;
  if (input.requireChildAnchor && input.childAnchorPath?.trim() && effectiveConfig === 'C') {
    effectiveConfig = 'A';
  }

  const base = assembleStyle02BookReferences({
    styleRefPaths: input.styleRefPaths,
    childPhotoPath:
      effectiveConfig === 'C' && !input.requireChildAnchor
        ? undefined
        : input.childAnchorPath,
    companionRefPath: effectiveConfig === 'B' ? undefined : companionPath,
    otherCharacterRefPaths: input.otherCharacterRefPaths,
    config: effectiveConfig,
  });

  const isolatedPaths = (input.isolatedObjectRefPaths ?? []).filter(Boolean);
  const breakdown: Record<string, string[]> = {
    ...base.breakdown,
    isolatedObjects: isolatedPaths,
  };

  let paths = [
    ...breakdown.child,
    ...breakdown.companion,
    ...breakdown.isolatedObjects,
    ...breakdown.otherCharacters,
    ...breakdown.style,
  ];

  const maxRefs = resolveGPTImageEditMaxReferences();
  while (paths.length > maxRefs && breakdown.style.length > 0) {
    breakdown.style.pop();
    paths = [
      ...breakdown.child,
      ...breakdown.companion,
      ...breakdown.isolatedObjects,
      ...breakdown.otherCharacters,
      ...breakdown.style,
    ];
  }

  assertStyle02SellableChildAnchorInBreakdown({
    breakdown,
    childAnchorPath: input.childAnchorPath,
  });

  return { paths, breakdown };
}

/** Validates that assembled ref paths respect identity-before-style ordering. */
export function validateStyle02ReferenceOrder(breakdown: Record<string, string[]>): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const kindIndex = (kind: Style02ReferenceKind): number =>
    STYLE02_REFERENCE_KIND_ORDER.indexOf(kind);

  const orderedKinds: Style02ReferenceKind[] = [];
  for (const kind of STYLE02_REFERENCE_KIND_ORDER) {
    const refs = breakdown[kind] ?? [];
    if (refs.length > 0) orderedKinds.push(kind);
  }

  for (let i = 1; i < orderedKinds.length; i++) {
    if (kindIndex(orderedKinds[i]) < kindIndex(orderedKinds[i - 1])) {
      violations.push(
        `kind ${orderedKinds[i]} appears after ${orderedKinds[i - 1]} but should precede it in STYLE02_REFERENCE_KIND_ORDER`
      );
    }
  }

  const flatPaths: Array<{ path: string; kind: Style02ReferenceKind }> = [];
  for (const kind of STYLE02_REFERENCE_KIND_ORDER) {
    for (const p of breakdown[kind] ?? []) {
      flatPaths.push({ path: p, kind });
    }
  }

  let lastKindIndex = -1;
  for (const entry of flatPaths) {
    const idx = kindIndex(entry.kind);
    if (idx < lastKindIndex) {
      violations.push(`path ${entry.path} (${entry.kind}) breaks reference kind order`);
    }
    lastKindIndex = idx;
  }

  const styleStart = flatPaths.findIndex((e) => e.kind === 'style');
  if (styleStart >= 0) {
    for (let i = 0; i < styleStart; i++) {
      if (flatPaths[i].kind === 'style') {
        violations.push('style ref appears before identity/character anchors');
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

export function formatStyle02LockManifestLine(input: {
  pageNumber: number;
  slice: PageImageLockSlice;
  breakdown: Record<string, string[]>;
  paths: string[];
}): string {
  const { pageNumber, slice, breakdown, paths } = input;
  const parts = [
    `p${pageNumber}`,
    `shot=${slice.pageShot?.shot ?? '—'}`,
    `zone=${slice.pageLocationPlan?.zoneId ?? '—'}`,
    `time=${slice.effectivePageTimeOfDay}`,
    `child=${breakdown.child?.length ?? 0}`,
    `companion=${breakdown.companion?.length ?? 0}`,
    `objects=${breakdown.isolatedObjects?.length ?? 0}`,
    `other=${breakdown.otherCharacters?.length ?? 0}`,
    `style=${breakdown.style?.length ?? 0}`,
    `total=${paths.length}`,
  ];
  return parts.join(' · ');
}
