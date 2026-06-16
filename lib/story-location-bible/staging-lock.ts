import type { PageLocationPlan } from './types';

export type StagingSurface = 'floor' | 'bed' | 'unknown';

const FLOOR_SURFACE_RE =
  /\b(floor|on the rug|rug\b|scattered|pillow[\s-]?cave|fort\b|cave\b|beside (?:the )?pillow)\b/i;
const BED_SURFACE_RE =
  /\b(on the bed|in bed|into bed|climbs? into bed|under the covers|tucked in|on the mattress|bedtime in bed)\b/i;

function stagingHaystack(pagePlan: PageLocationPlan, imageDirection?: string): string {
  return [
    pagePlan.pageAction ?? '',
    pagePlan.visibleAnchors.join(' '),
    imageDirection ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function inferStagingSurface(
  pagePlan: PageLocationPlan,
  imageDirection?: string
): StagingSurface {
  const override = pagePlan.staging?.surface;
  if (override === 'floor' || override === 'bed') return override;

  const haystack = stagingHaystack(pagePlan, imageDirection);
  if (BED_SURFACE_RE.test(haystack)) return 'bed';
  if (FLOOR_SURFACE_RE.test(haystack)) return 'floor';
  return 'unknown';
}

function resolveStagingAnchorHint(
  pagePlan: PageLocationPlan,
  surface: Exclude<StagingSurface, 'unknown'>
): string | null {
  if (pagePlan.staging?.anchorHint?.trim()) return pagePlan.staging.anchorHint.trim();

  const haystack = [pagePlan.pageAction ?? '', pagePlan.visibleAnchors.join(' ')].join(' ');
  if (surface === 'floor') {
    const cave = haystack.match(/\b(scattered pillow[\s-]?cave|pillow[\s-]?cave)\b/i);
    if (cave) return `the ${cave[1].toLowerCase()}`;
    const rug = haystack.match(/\b(?:on the )?rug\b/i);
    if (rug) return 'the rug';
    const fort = haystack.match(/\bfort\b/i);
    if (fort) return 'the fort';
  }
  if (surface === 'bed') {
    const bed = haystack.match(/\b(?:on |in )?the bed\b/i);
    if (bed) return 'the bed';
  }
  return null;
}

export function buildStagingLockBlock(
  pagePlan: PageLocationPlan,
  imageDirection?: string
): string | null {
  const surface = inferStagingSurface(pagePlan, imageDirection);
  if (surface === 'unknown') return null;

  const anchor = resolveStagingAnchorHint(pagePlan, surface);
  if (surface === 'floor') {
    const near = anchor ? ` near ${anchor}` : '';
    return `STAGING LOCK: child and companion are on the FLOOR${near}; do NOT place them on the bed.`;
  }
  const onBed = anchor ? ` on ${anchor}` : '';
  return `STAGING LOCK: child and companion are${onBed} on the BED; do NOT place them on the floor.`;
}

export function promptContainsStagingLock(prompt: string): boolean {
  return /\bSTAGING LOCK:/i.test(prompt);
}

export type { PageStagingOverride } from './types';