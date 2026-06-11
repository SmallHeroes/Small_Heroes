import { quotasForBeatCount } from './quotas';
import type { BookShotPlan, PageBeatInput, PageShot, ShotAngle, ShotType } from './types';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function haystack(page: PageBeatInput): string {
  return `${page.imageDirection} ${page.bookPageText}`.toLowerCase();
}

function scoreEmotional(page: PageBeatInput): number {
  const hay = haystack(page);
  let score = 0;
  if (/trembl|רועד|whisper|לוחש|גם הידיים|vulnerable|עדינות|quiet truth|לוחשת|נושמת/.test(hay)) score += 4;
  if (/laugh|צוחק|smil|מחייך|together|יחד/.test(hay) && /רועד|trembl|גם הידיים/.test(hay)) score += 3;
  if ((page.wordCount ?? countWords(page.bookPageText)) < 22) score += 1;
  if (/intimate|עדין|soft|רך/.test(hay)) score += 1;
  return score;
}

function scoreAction(page: PageBeatInput): number {
  const hay = haystack(page);
  let score = 0;
  if (/shout|צועק|heroic|אמיץ|chair|כיסא|jump|קופץ/.test(hay)) score += 5;
  if (/sneeze|אפצ|dance|ריקוד|mid-dance|comedy|משחק|rhythm|טוק/.test(hay)) score += 3;
  if (/standing on|על הכיסא|motion lines|קופצות/.test(hay)) score += 2;
  return score;
}

function scoreQuietTransition(page: PageBeatInput): number {
  const hay = haystack(page);
  let score = 0;
  if (/nurse|אחות|thermometer|מדחום|mirror|מראה|clinic|מרפאה|waiting/.test(hay)) score += 3;
  if (/medium|environment|room|חדר/.test(hay)) score += 1;
  if ((page.wordCount ?? countWords(page.bookPageText)) >= 20 && (page.wordCount ?? countWords(page.bookPageText)) <= 40) {
    score += 1;
  }
  return score;
}

function needsReadableWideEnvironment(page: PageBeatInput): boolean {
  const hay = haystack(page);
  return (
    /mirror|מראה|both visible|reflected|clinic room|חדר המרפאה|waiting room|full scene|establishing/.test(
      hay
    ) || (page.page === 1 && /clinic|מרפאה|nurse|אחות|door|דלת/.test(hay))
  );
}

function shotAngleForAction(page: PageBeatInput): ShotAngle {
  const hay = haystack(page);
  if (/chair|כיסא|shout|צועק|heroic/.test(hay)) return 'low';
  if (/above|מעל|bird|aerial/.test(hay)) return 'high';
  return 'eye';
}

function consecutiveKey(shot: PageShot): string {
  return `${shot.shot}:${shot.angle ?? 'eye'}`;
}

const SHOT_WIDTH_RANK: Record<ShotType, number> = {
  close_up: 0,
  intimate: 1,
  dynamic_angle: 2,
  medium: 3,
  medium_wide: 4,
  establishing_wide: 5,
};

function widenShot(shot: ShotType): ShotType {
  if (shot === 'close_up' || shot === 'intimate') return 'medium_wide';
  if (shot === 'dynamic_angle' || shot === 'medium') return 'medium_wide';
  return 'establishing_wide';
}

function makeShot(
  page: number,
  shot: ShotType,
  rationale: string,
  angle?: ShotAngle
): PageShot {
  return { page, shot, ...(angle ? { angle } : {}), rationale };
}

function applyReadabilityOverride(page: PageBeatInput, assigned: PageShot): PageShot {
  if (
    (assigned.shot === 'close_up' || assigned.shot === 'intimate') &&
    needsReadableWideEnvironment(page)
  ) {
    return makeShot(
      page.page,
      'medium_wide',
      `${assigned.rationale} → readability override: beat needs environment legibility`
    );
  }
  return assigned;
}

function breakConsecutiveRuns(pages: PageShot[]): PageShot[] {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const byPage = new Map(sorted.map((p) => [p.page, p]));
  const pageNums = sorted.map((p) => p.page);

  for (let i = 2; i < pageNums.length; i++) {
    const a = byPage.get(pageNums[i - 2])!;
    const b = byPage.get(pageNums[i - 1])!;
    const c = byPage.get(pageNums[i])!;
    if (consecutiveKey(a) === consecutiveKey(b) && consecutiveKey(b) === consecutiveKey(c)) {
      const alt: ShotType =
        b.shot === 'medium' ? 'medium_wide' : b.shot === 'medium_wide' ? 'medium' : 'medium';
      byPage.set(
        b.page,
        makeShot(
          b.page,
          alt,
          `${b.rationale} → consecutive-run break (rule 6)`
        )
      );
    }
  }
  return [...byPage.values()].sort((x, y) => x.page - y.page);
}

function pickTopPages(
  pages: PageBeatInput[],
  scoreFn: (p: PageBeatInput) => number,
  count: number,
  exclude: Set<number>
): number[] {
  return [...pages]
    .filter((p) => !exclude.has(p.page))
    .map((p) => ({ page: p.page, score: scoreFn(p) }))
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, count)
    .map((r) => r.page);
}

/** Deterministic per-book shot plan from served story metadata. */
export function deriveBookShotPlan(pages: PageBeatInput[]): BookShotPlan {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const pageCount = sorted.length;
  const quotas = quotasForBeatCount(pageCount);
  const assigned = new Map<number, PageShot>();
  const used = new Set<number>();

  const page1 = sorted[0];
  if (page1) {
    const openingShot: ShotType = needsReadableWideEnvironment(page1)
      ? 'medium_wide'
      : /\bwide\b|establishing|panoramic/.test(page1.imageDirection.toLowerCase())
        ? 'establishing_wide'
        : 'medium_wide';
    assigned.set(
      page1.page,
      makeShot(
        page1.page,
        openingShot,
        'Rule 1: page 1 establishes place and relationship',
        'eye'
      )
    );
    used.add(page1.page);
  }

  const actionPages = pickTopPages(sorted, scoreAction, quotas.dynamicAction, used);
  for (const pn of actionPages) {
    const page = sorted.find((p) => p.page === pn)!;
    assigned.set(
      pn,
      makeShot(
        pn,
        'dynamic_angle',
        'Rule 3: action/comedy beat — dynamic composition or playful staging',
        shotAngleForAction(page)
      )
    );
    used.add(pn);
  }

  const emotionalPages = pickTopPages(sorted, scoreEmotional, quotas.emotionalClose, used);
  for (const pn of emotionalPages) {
    const page = sorted.find((p) => p.page === pn)!;
    const shot: ShotType = scoreEmotional(page) >= 5 ? 'close_up' : 'intimate';
    assigned.set(
      pn,
      applyReadabilityOverride(
        page,
        makeShot(
          pn,
          shot,
          'Rule 2: emotional-peak beat — child + companion intimacy (not giant face portrait)',
          'eye'
        )
      )
    );
    used.add(pn);
  }

  const quietPages = pickTopPages(sorted, scoreQuietTransition, quotas.quietTransition, used);
  for (const pn of quietPages) {
    assigned.set(
      pn,
      makeShot(pn, 'medium', 'Rule 4: quiet transition — medium shot with environment context', 'eye')
    );
    used.add(pn);
  }

  const finalPage = sorted[sorted.length - 1];
  const penultPage = sorted[sorted.length - 2];
  if (finalPage) {
    const penultShot = penultPage ? assigned.get(penultPage.page)?.shot : undefined;
    const penultRank = penultShot ? SHOT_WIDTH_RANK[penultShot] : 2;
    let finalShot: ShotType = 'medium_wide';
    if (penultShot) {
      finalShot = widenShot(penultShot);
      if (SHOT_WIDTH_RANK[finalShot] <= penultRank) {
        finalShot = 'establishing_wide';
      }
    }
    assigned.set(
      finalPage.page,
      makeShot(
        finalPage.page,
        finalShot,
        'Rule 5: final page — warm resolving composition, slightly wider than preceding beat',
        'eye'
      )
    );
    used.add(finalPage.page);
  }

  const alternates: ShotType[] = ['medium', 'medium_wide', 'medium', 'medium_wide'];
  let altIdx = 0;
  for (const page of sorted) {
    if (assigned.has(page.page)) continue;
    const shot = alternates[altIdx % alternates.length]!;
    altIdx++;
    assigned.set(
      page.page,
      makeShot(page.page, shot, 'Fill beat — medium/medium-wide variety between featured shots', 'eye')
    );
  }

  let result = [...assigned.values()].map((shot) => {
    const page = sorted.find((p) => p.page === shot.page)!;
    return applyReadabilityOverride(page, shot);
  });
  result = breakConsecutiveRuns(result);

  if (finalPage && penultPage) {
    const byPage = new Map(result.map((p) => [p.page, p]));
    const penultShot = byPage.get(penultPage.page)?.shot;
    const penultRank = penultShot ? SHOT_WIDTH_RANK[penultShot] : 2;
    let finalShot = penultShot ? widenShot(penultShot) : 'medium_wide';
    if (SHOT_WIDTH_RANK[finalShot] <= penultRank) finalShot = 'establishing_wide';
    byPage.set(
      finalPage.page,
      makeShot(
        finalPage.page,
        finalShot,
        'Rule 5: final page — warm resolving composition, slightly wider than preceding beat',
        'eye'
      )
    );
    result = [...byPage.values()];
  }

  return { pageCount, source: 'derived', pages: result.sort((a, b) => a.page - b.page) };
}
