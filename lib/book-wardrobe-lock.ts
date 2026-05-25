/**
 * Per-book wardrobe + hairstyle lock for gpt-image identity consistency.
 * One continuous story = one fixed outfit and one fixed hairstyle.
 * Overrides reference-photo clothing (face only from photo).
 */

export type BookDirection = 'bedtime' | 'adventure' | 'fantasy';

export type BookWardrobeLock = {
  direction: BookDirection;
  /** Fixed outfit — identical wording on every page of this book. */
  outfit: string;
  /** Fixed hairstyle — identical wording on every page of this book. */
  hairstyle: string;
};

const BOOK_WARDROBE_LOCKS: Record<BookDirection, BookWardrobeLock> = {
  bedtime: {
    direction: 'bedtime',
    outfit:
      'soft lavender long-sleeve pajama top with tiny white star print, matching lavender pajama pants, bare feet',
    hairstyle:
      'dark brown wavy shoulder-length hair worn loose down with a center part (same length, part, and style every page)',
  },
  adventure: {
    direction: 'adventure',
    outfit:
      'coral-pink short-sleeve cotton t-shirt, light-wash denim blue jeans, white sneakers with pink laces',
    hairstyle:
      'dark brown wavy shoulder-length hair worn loose down with a center part (same length, part, and style every page)',
  },
  fantasy: {
    direction: 'fantasy',
    outfit:
      'soft sage-green long-sleeve tunic top, cream comfortable leggings, simple brown slip-on shoes',
    hairstyle:
      'dark brown wavy shoulder-length hair worn loose down with a center part (same length, part, and style every page)',
  },
};

const loggedRunKeys = new Set<string>();

export function resolveBookWardrobeLock(
  direction: BookDirection | string | null | undefined
): BookWardrobeLock | null {
  if (!direction || typeof direction !== 'string') return null;
  const key = direction.trim().toLowerCase() as BookDirection;
  return BOOK_WARDROBE_LOCKS[key] ?? null;
}

export function applyWardrobeToChildStructured<
  T extends { face: string; hair: string; body: string; clothing: string; signature: string },
>(childStructured: T, lock: BookWardrobeLock): T {
  return {
    ...childStructured,
    hair: lock.hairstyle,
    clothing: lock.outfit,
  };
}

/** Prompt lines injected into every page's child identity block. */
export function buildBookWardrobePromptSection(lock: BookWardrobeLock): string {
  return [
    'BOOK WARDROBE LOCK (MANDATORY — this story is one continuous time):',
    `Outfit (identical every page): ${lock.outfit}.`,
    `Hairstyle (identical every page): ${lock.hairstyle}.`,
    'REFERENCE PHOTO CLOTHING OVERRIDE: Use the uploaded child photo ONLY for face identity (shape, skin, eyes). ' +
      'IGNORE any clothing, pose, or background in the reference photo. ' +
      'The outfit and hairstyle above MUST appear on every page — they override the photo.',
  ].join('\n');
}

/** Marker substring used to verify wardrobe lock is present in assembled prompts. */
export function bookWardrobeVerificationToken(lock: BookWardrobeLock): string {
  return `BOOK WARDROBE LOCK (MANDATORY`;
}

export function logBookWardrobeLockOnce(lock: BookWardrobeLock, runId: string): void {
  const key = `${runId}:${lock.direction}`;
  if (loggedRunKeys.has(key)) return;
  loggedRunKeys.add(key);
  console.info(
    `[book_wardrobe_lock] runId=${runId} direction=${lock.direction} ` +
      `outfit="${lock.outfit}" hairstyle="${lock.hairstyle}"`
  );
}

/** Reset logged keys — for tests only. */
export function resetBookWardrobeLockLogs(): void {
  loggedRunKeys.clear();
}
