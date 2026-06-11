import { quotasForBeatCount } from './quotas';
import { SHOT_TYPES, type BookShotPlan, type PageShot, type ShotType } from './types';

export interface ShotPlanValidationIssue {
  rule: string;
  message: string;
}

const ESTABLISHING: ShotType[] = ['establishing_wide', 'medium_wide'];
const EMOTIONAL: ShotType[] = ['close_up', 'intimate'];
const DYNAMIC: ShotType[] = ['dynamic_angle', 'medium_wide', 'medium'];
const QUIET: ShotType[] = ['medium', 'medium_wide'];

function consecutiveKey(shot: PageShot): string {
  return `${shot.shot}:${shot.angle ?? 'eye'}`;
}

function countByTypes(pages: PageShot[], types: ShotType[]): number {
  return pages.filter((p) => types.includes(p.shot)).length;
}

function dominantShotType(pages: PageShot[]): ShotType | null {
  const counts = new Map<ShotType, number>();
  for (const p of pages) {
    counts.set(p.shot, (counts.get(p.shot) ?? 0) + 1);
  }
  let best: ShotType | null = null;
  let bestN = 0;
  for (const [shot, n] of counts) {
    if (n > bestN) {
      best = shot;
      bestN = n;
    }
  }
  return bestN >= pages.length - 1 ? best : null;
}

/** Deterministic contract validator (rules 1–7 + page-count quotas). */
export function validateBookShotPlan(plan: BookShotPlan): ShotPlanValidationIssue[] {
  const issues: ShotPlanValidationIssue[] = [];
  const pages = [...plan.pages].sort((a, b) => a.page - b.page);
  const quotas = quotasForBeatCount(plan.pageCount);

  if (pages.length !== plan.pageCount) {
    issues.push({
      rule: 'pageCount',
      message: `plan has ${pages.length} pages but pageCount=${plan.pageCount}`,
    });
  }

  const page1 = pages.find((p) => p.page === 1);
  if (!page1) {
    issues.push({ rule: '1', message: 'missing page 1' });
  } else if (!ESTABLISHING.includes(page1.shot)) {
    issues.push({
      rule: '1',
      message: `page 1 must be establishing_wide or medium_wide (got ${page1.shot})`,
    });
  }

  if (countByTypes(pages, EMOTIONAL) < quotas.emotionalClose) {
    issues.push({
      rule: '2',
      message: `need ≥${quotas.emotionalClose} close_up/intimate pages (have ${countByTypes(pages, EMOTIONAL)})`,
    });
  }

  if (countByTypes(pages, DYNAMIC) < quotas.dynamicAction) {
    issues.push({
      rule: '3',
      message: `need ≥${quotas.dynamicAction} dynamic/action pages (have ${countByTypes(pages, DYNAMIC)})`,
    });
  }

  const quietMediumPages = pages.filter(
    (p) => p.shot === 'medium' && p.page !== 1 && p.page !== plan.pageCount
  );
  if (quietMediumPages.length < quotas.quietTransition) {
    issues.push({
      rule: '4',
      message: `need ≥${quotas.quietTransition} quiet transition medium pages (have ${quietMediumPages.length})`,
    });
  }

  const WIDTH_RANK: Record<string, number> = {
    close_up: 0,
    intimate: 1,
    dynamic_angle: 2,
    medium: 3,
    medium_wide: 4,
    establishing_wide: 5,
  };
  const final = pages.find((p) => p.page === plan.pageCount);
  const penult = pages.find((p) => p.page === plan.pageCount - 1);
  if (final && penult) {
    const finalRank = WIDTH_RANK[final.shot] ?? 0;
    const penultRank = WIDTH_RANK[penult.shot] ?? 0;
    if (finalRank <= penultRank) {
      issues.push({
        rule: '5',
        message: `final page should resolve wider than penultimate (${penult.shot} → ${final.shot})`,
      });
    }
  }

  for (let i = 2; i < pages.length; i++) {
    const a = pages[i - 2]!;
    const b = pages[i - 1]!;
    const c = pages[i]!;
    if (consecutiveKey(a) === consecutiveKey(b) && consecutiveKey(b) === consecutiveKey(c)) {
      issues.push({
        rule: '6',
        message: `pages ${a.page}-${c.page} share identical shot+angle (${consecutiveKey(b)}) — max 2 consecutive allowed`,
      });
      break;
    }
  }

  const dominant = dominantShotType(pages);
  if (dominant) {
    issues.push({
      rule: '7',
      message: `default-all detected: ${dominant} dominates ${pages.length - 1}+ pages`,
    });
  }

  for (const p of pages) {
    if (!SHOT_TYPES.includes(p.shot)) {
      issues.push({ rule: 'shotType', message: `page ${p.page} has invalid shot ${p.shot}` });
    }
    if (!p.rationale?.trim()) {
      issues.push({ rule: 'rationale', message: `page ${p.page} missing rationale` });
    }
  }

  return issues;
}

export function isBookShotPlanValid(plan: BookShotPlan): boolean {
  return validateBookShotPlan(plan).length === 0;
}
