import 'server-only';

import {
  beatsFromStoryPages,
  resolveBookShotPlan,
  type BookShotPlan,
  type PageShot,
} from '@/lib/book-shot-plan';
import {
  resolvePageLocationPlan,
  resolveStoryLocationPlan,
  type PageLocationPlan,
  type StoryLocationPlanBundle,
} from '@/lib/story-location-bible';
import { resolveStyle01StoryWardrobeLock } from '@/lib/style01-story-wardrobe';

/** Day-default wardrobe tokens — must not appear when a story wardrobe lock is active. */
const DAY_DEFAULT_WARDROBE_PATTERNS: RegExp[] = [
  /plain solid sky-blue t-shirt with a small yellow sun/i,
  /Shorts: dark denim shorts/i,
  /Shoes: RED sneakers/i,
];

export type QaBookLockContext = {
  storyFile: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  storyTimeOfDay: import('@/lib/story-time-of-day').StoryTimeOfDay | undefined;
  pageTimeOfDayOverrides:
    | Partial<Record<number, import('@/lib/story-time-of-day').StoryTimeOfDay>>
    | undefined;
  bookShotPlan: BookShotPlan;
  storyLocationPlan: StoryLocationPlanBundle;
};

export function resolveQaBookLockContext(args: {
  storyPath: string;
  storyFileKey: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  challengeCategory: string;
  pages: Array<{ pageNumber: number; text: string; imagePrompt?: string; rawScenePrompt?: string }>;
  storyTimeOfDay?: QaBookLockContext['storyTimeOfDay'];
  pageTimeOfDayOverrides?: QaBookLockContext['pageTimeOfDayOverrides'];
}): QaBookLockContext {
  const beats = beatsFromStoryPages(
    args.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imagePrompt: p.imagePrompt ?? '',
      rawScenePrompt: p.rawScenePrompt,
    }))
  );
  const bookShotPlan = resolveBookShotPlan({ storyFilePath: args.storyPath, pages: beats });
  const storyLocationPlan = resolveStoryLocationPlan({
    storyFilePath: args.storyPath,
    challengeCategory: args.challengeCategory,
    direction: args.direction,
    pages: beats,
  });
  return {
    storyFile: args.storyFileKey,
    direction: args.direction,
    storyTimeOfDay: args.storyTimeOfDay,
    pageTimeOfDayOverrides: args.pageTimeOfDayOverrides,
    bookShotPlan,
    storyLocationPlan,
  };
}

export function resolveQaPageShot(
  bookShotPlan: BookShotPlan,
  pageNumber: number
): PageShot | null {
  const slot = bookShotPlan.pages.find((p) => p.page === pageNumber);
  if (!slot) return null;
  return {
    page: slot.page,
    shot: slot.shot,
    angle: slot.angle,
    rationale: slot.rationale,
  };
}

export function resolveQaPageLocationPlan(
  storyLocationPlan: StoryLocationPlanBundle,
  pageNumber: number
): PageLocationPlan | null {
  return resolvePageLocationPlan(storyLocationPlan, pageNumber);
}

/**
 * Lock fields mirrored from production `bookPipelineLockFields` in image.ts.
 * Single source — QA audit, parity guard, and render must share this object.
 */
export function buildQaImageGenerationLockFields(
  lockContext: QaBookLockContext
): {
  storyFile: string;
  direction: QaBookLockContext['direction'];
  storyTimeOfDay: QaBookLockContext['storyTimeOfDay'];
  pageTimeOfDayOverrides: QaBookLockContext['pageTimeOfDayOverrides'];
  bookShotPlan: BookShotPlan;
  storyLocationPlan: StoryLocationPlanBundle;
} {
  return {
    storyFile: lockContext.storyFile,
    direction: lockContext.direction,
    storyTimeOfDay: lockContext.storyTimeOfDay,
    pageTimeOfDayOverrides: lockContext.pageTimeOfDayOverrides,
    bookShotPlan: lockContext.bookShotPlan,
    storyLocationPlan: lockContext.storyLocationPlan,
  };
}

function deriveRequiredWardrobePatterns(wardrobeLock: string): RegExp[] {
  const required: RegExp[] = [];
  if (/two-piece pajamas/i.test(wardrobeLock)) {
    required.push(/\btwo-piece pajamas\b/i);
  }
  const printMatch = wardrobeLock.match(
    /all-over print of\s+([^.\n—]+?)(?:\s+in\s+|\s+—|\.)/i
  );
  if (printMatch?.[1]?.trim()) {
    const phrase = printMatch[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    required.push(new RegExp(phrase, 'i'));
  }
  if (/slipper-sock/i.test(wardrobeLock)) {
    required.push(/slipper-sock/i);
  }
  if (/BOOK WARDROBE LOCK/i.test(wardrobeLock)) {
    required.push(/BOOK WARDROBE LOCK/i);
  }
  return required;
}

/**
 * Cost-safe parity guard — throws before image spend when render prompt diverges from wardrobe lock.
 */
export function assertQaRenderWardrobeParity(
  prompt: string,
  args: { companionId: string; storyFile: string; pageNumber: number }
): void {
  const wardrobeLock = resolveStyle01StoryWardrobeLock(args.companionId, args.storyFile);
  if (!wardrobeLock) return;

  const required = deriveRequiredWardrobePatterns(wardrobeLock);
  const missing = required.filter((re) => !re.test(prompt)).map((re) => re.source);
  if (missing.length) {
    throw new Error(
      `QA render wardrobe parity failed (page ${args.pageNumber}): prompt missing expected lock signature(s): ${missing.join(', ')}`
    );
  }

  for (const re of DAY_DEFAULT_WARDROBE_PATTERNS) {
    if (re.test(prompt)) {
      throw new Error(
        `QA render wardrobe parity failed (page ${args.pageNumber}): prompt contains day-default wardrobe (${re.source}) despite story lock`
      );
    }
  }
}
