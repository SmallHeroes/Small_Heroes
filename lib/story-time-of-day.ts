/**
 * Global story / page time-of-day lock for Style 01 book pages.
 * Enforces consistent lighting atmosphere (especially night stories).
 */

export type StoryTimeOfDay = 'night' | 'day' | 'dusk' | 'dawn' | 'mixed';

export type StoryTimeOfDayContext = {
  storyTimeOfDay: StoryTimeOfDay;
  /** Per-page override from story markdown `pageTimeOfDay:` */
  pageTimeOfDayOverrides?: Partial<Record<number, StoryTimeOfDay>>;
  storyCategory?: string | null;
};

const CATEGORY_DEFAULT_TIME: Partial<Record<string, StoryTimeOfDay>> = {
  NIGHT_FEAR: 'night',
};

const NIGHT_TEXT =
  /\b(night|nighttime|starlit|starry|moonlight|moonlit|midnight|after dark|in the dark)\b/i;
const NIGHT_HE = /(?:לילה|בלילה|חש(?:ך|כה)|כוכב(?:ים)?|ירח|ליל)/u;
const DAY_TEXT =
  /\b(daytime|midday|noon|sunny|sunshine|bright blue sky|golden afternoon|morning sun|broad daylight)\b/i;
const DUSK_TEXT = /\b(dusk|twilight|sunset|golden hour)\b/i;
const DAWN_TEXT = /\b(dawn|sunrise|early morning light)\b/i;

const INDOOR_RE =
  /\b(indoors?|inside|bedroom|room|porch|window|kitchen|hallway|living room|bedside)\b/i;

export function parseStoryTimeOfDayFromFrontmatter(raw: string): StoryTimeOfDay | null {
  const m = raw.match(/^timeOfDay\s*:\s*(night|day|dusk|dawn|mixed)\s*$/im);
  if (!m?.[1]) return null;
  return m[1] as StoryTimeOfDay;
}

export function parseStoryCategoryFromFrontmatter(raw: string): string | null {
  const m = raw.match(/^category\s*:\s*([A-Z_]+)\s*$/im);
  return m?.[1]?.trim() ?? null;
}

export function parsePageTimeOfDayFromBlock(block: string): StoryTimeOfDay | null {
  const m = block.match(/^pageTimeOfDay\s*:\s*(night|day|dusk|dawn)\s*$/im);
  if (!m?.[1]) return null;
  return m[1] as StoryTimeOfDay;
}

export function inferStoryTimeOfDayFromStoryText(pages: Array<{ text?: string; imagePrompt?: string }>): StoryTimeOfDay | null {
  let night = 0;
  let day = 0;
  let dusk = 0;
  let dawn = 0;
  for (const page of pages) {
    const hay = `${page.text ?? ''}\n${page.imagePrompt ?? ''}`;
    if (NIGHT_TEXT.test(hay) || NIGHT_HE.test(hay)) night += 1;
    if (DAY_TEXT.test(hay)) day += 1;
    if (DUSK_TEXT.test(hay)) dusk += 1;
    if (DAWN_TEXT.test(hay)) dawn += 1;
  }
  const scores = [
    { k: 'night' as const, v: night },
    { k: 'day' as const, v: day },
    { k: 'dusk' as const, v: dusk },
    { k: 'dawn' as const, v: dawn },
  ].sort((a, b) => b.v - a.v);
  const top = scores[0];
  const second = scores[1];
  if (!top || top.v === 0) return null;
  if (second && second.v > 0 && top.v <= second.v + 1) return 'mixed';
  return top.k;
}

export function resolveStoryTimeOfDay(input: {
  frontmatterTimeOfDay?: StoryTimeOfDay | null;
  category?: string | null;
  pages?: Array<{ text?: string; imagePrompt?: string }>;
}): StoryTimeOfDay {
  if (input.frontmatterTimeOfDay) return input.frontmatterTimeOfDay;
  const cat = input.category?.trim().toUpperCase();
  if (cat && CATEGORY_DEFAULT_TIME[cat]) return CATEGORY_DEFAULT_TIME[cat]!;
  const inferred = input.pages ? inferStoryTimeOfDayFromStoryText(input.pages) : null;
  if (inferred) return inferred;
  return 'day';
}

export function inferPageTimeOfDayFromDirection(imageDirection?: string | null): StoryTimeOfDay | null {
  const hay = (imageDirection ?? '').trim();
  if (!hay) return null;
  if (NIGHT_TEXT.test(hay) || NIGHT_HE.test(hay)) return 'night';
  if (DAWN_TEXT.test(hay)) return 'dawn';
  if (DUSK_TEXT.test(hay)) return 'dusk';
  if (DAY_TEXT.test(hay)) return 'day';
  return null;
}

/** Effective lighting lock for one page (page override > direction inference > story default). */
export function resolveEffectivePageTimeOfDay(input: {
  storyTimeOfDay: StoryTimeOfDay;
  pageNumber: number;
  pageTimeOfDayOverrides?: Partial<Record<number, StoryTimeOfDay>>;
  imageDirection?: string | null;
  bookPageText?: string | null;
}): StoryTimeOfDay {
  const override = input.pageTimeOfDayOverrides?.[input.pageNumber];
  if (override) return override;

  const fromDirection = inferPageTimeOfDayFromDirection(input.imageDirection);
  if (input.storyTimeOfDay === 'mixed') {
    if (fromDirection) return fromDirection;
    const hay = `${input.imageDirection ?? ''}\n${input.bookPageText ?? ''}`;
    if (NIGHT_HE.test(hay) || NIGHT_TEXT.test(hay)) return 'night';
    return 'day';
  }

  if (fromDirection && fromDirection !== input.storyTimeOfDay) {
    return fromDirection;
  }
  return input.storyTimeOfDay;
}

function buildNightLockBlock(input: { strictRetry?: boolean; isIndoor?: boolean }): string {
  const base = [
    'SCENE TIME-OF-DAY LOCK — NIGHT (entire story):',
    'This entire story takes place at NIGHT. The environment is a true night scene: dark indigo/navy sky, moonlight and starlight, deep soft shadows.',
    'Warm light is allowed ONLY from local sources — windows, lanterns, the fox\'s glowing neck lantern, garden lights, bedside lamp, porch light — pooling locally around the characters.',
    'The image must remain readable for a children\'s book, but it must never become daytime, never sunny, never golden afternoon, never bright blue daytime sky, and never a daylight garden.',
    'Cozy/magical warmth is allowed; daylight atmosphere is not.',
  ];
  if (input.isIndoor) {
    base.push(
      'INDOOR NIGHT: Show night context — dark window, moonlight outside, bedside lamp, dim room. Warm interior light is OK but must NOT feel like daytime.'
    );
  } else {
    base.push(
      'OUTDOOR NIGHT: Preserve dark sky/background, moon/stars or clear night-garden cues, local warm light only — NOT pastoral daylight.'
    );
  }
  if (input.strictRetry) {
    base.push(
      'REGENERATION — TIME OF DAY (mandatory): Previous render read as DAYLIGHT. You MUST fix lighting to true readable children\'s-book NIGHT — indigo/navy sky where visible, moon/stars outdoors, local warm pools only. NO sunny sky, NO golden afternoon, NO bright blue daytime feel.'
    );
  }
  return base.join('\n');
}

function buildDuskLockBlock(strictRetry?: boolean): string {
  const lines = [
    'SCENE TIME-OF-DAY LOCK — DUSK:',
    'Low sun or twilight only — warm horizon, lengthening shadows, NOT bright midday, NOT full daylight garden.',
  ];
  if (strictRetry) {
    lines.push(
      'REGENERATION: Previous render read as midday/daylight. Shift to consistent dusk/twilight atmosphere.'
    );
  }
  return lines.join('\n');
}

function buildDawnLockBlock(strictRetry?: boolean): string {
  const lines = [
    'SCENE TIME-OF-DAY LOCK — DAWN:',
    'Early morning soft light — cool/pale sky, gentle sunrise cues, NOT bright midday or sunny afternoon.',
  ];
  if (strictRetry) {
    lines.push('REGENERATION: Previous render read as midday. Shift to dawn atmosphere.');
  }
  return lines.join('\n');
}

export function buildStoryTimeOfDayLockBlock(input: {
  effectiveTimeOfDay: StoryTimeOfDay;
  imageDirection?: string | null;
  strictRetry?: boolean;
}): string | undefined {
  const { effectiveTimeOfDay } = input;
  if (effectiveTimeOfDay === 'day' || effectiveTimeOfDay === 'mixed') return undefined;
  const isIndoor = INDOOR_RE.test(input.imageDirection ?? '');
  if (effectiveTimeOfDay === 'night') {
    return buildNightLockBlock({ strictRetry: input.strictRetry, isIndoor });
  }
  if (effectiveTimeOfDay === 'dusk') {
    return buildDuskLockBlock(input.strictRetry);
  }
  if (effectiveTimeOfDay === 'dawn') {
    return buildDawnLockBlock(input.strictRetry);
  }
  return undefined;
}

export function pageTimeOfDayRequiresNightQa(effective: StoryTimeOfDay): boolean {
  return effective === 'night' || effective === 'dusk';
}
