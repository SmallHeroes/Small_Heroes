/**
 * Phase 4 — binary structural fence before prose (not final human verdict).
 */

import type { EventMomentumReport, PageBeatV2, StorySpineV2 } from './types';

const PASSIVE_CHILD_RE =
  /^(הילד|הילדה|{{childName}})?\s*(רק\s+)?(צופה|מסתכל|מחכה|מרגיש|מאפשר|עומד\s+ומסתכל|נוכח|צועד\s+ללא|שותק)/i;

const WATCH_ONLY_RE = /\b(צופה|מסתכל|מחכה|מרגיש|נוכח)\b/i;
const NO_EVENT_RE = /^(אין|שום|רק\s+אווירה|תיאור)/i;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tooSimilar(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.75) return true;
  return false;
}

function spineFieldEmpty(spine: StorySpineV2, key: keyof StorySpineV2): boolean {
  const v = spine[key];
  return typeof v !== 'string' || v.trim().length < 8;
}

function longestStaticRun(staticPages: Set<number>, pageCount: number): number {
  let max = 0;
  let run = 0;
  for (let p = 1; p <= pageCount; p++) {
    if (staticPages.has(p)) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return max;
}

export function runEventMomentumGate(args: {
  spine: StorySpineV2;
  beats: PageBeatV2[];
  pageCount: number;
}): EventMomentumReport {
  const { spine, beats, pageCount } = args;
  const notes: string[] = [];

  const missingChildDesire = spineFieldEmpty(spine, 'protagonistWant');
  const missingTryFail =
    spineFieldEmpty(spine, 'firstAttempt') || spineFieldEmpty(spine, 'firstAttemptFailsBecause');
  const missingCompanionMisread = spineFieldEmpty(spine, 'companionMisread');
  const missingChildDiscovery =
    spineFieldEmpty(spine, 'childDiscovery') || spineFieldEmpty(spine, 'childPlan');
  const missingBraveChildAction = spineFieldEmpty(spine, 'childBraveAction');
  const missingWorldResponse =
    spineFieldEmpty(spine, 'payoff') || spineFieldEmpty(spine, 'climaxChoice');

  const pagesWithoutConcreteEvent: number[] = [];
  const passiveChildPages: number[] = [];
  const staticPages: number[] = [];
  const weakPageTurnPages: number[] = [];

  for (const beat of beats) {
    const eventBlob = `${beat.eventOnPage} ${beat.complicationOrChange}`;
    if (NO_EVENT_RE.test(beat.eventOnPage.trim()) || eventBlob.trim().length < 12) {
      pagesWithoutConcreteEvent.push(beat.page);
    }

    if (
      PASSIVE_CHILD_RE.test(beat.childAction.trim()) ||
      (WATCH_ONLY_RE.test(beat.childAction) &&
        !/\b(שואל|לוקח|מציע|מחליט|בוחר|ממציא|עושה|צועד|ניגש|מזיז|פותח|סוגר|אומר)\b/i.test(
          beat.childAction
        ))
    ) {
      passiveChildPages.push(beat.page);
    }

    if (tooSimilar(beat.storyFactBefore, beat.storyFactAfter)) {
      staticPages.push(beat.page);
      notes.push(`p${beat.page}: static — before≈after`);
    }

    if (!beat.pageTurnReason?.trim() || beat.pageTurnReason.trim().length < 10) {
      weakPageTurnPages.push(beat.page);
    }
  }

  const longestStatic = longestStaticRun(new Set(staticPages), pageCount);

  const failConditions = [
    missingChildDesire,
    missingTryFail,
    missingChildDiscovery,
    missingBraveChildAction,
    missingWorldResponse,
    pagesWithoutConcreteEvent.length > 2,
    passiveChildPages.length > pageCount * 0.25,
    longestStatic >= 2,
  ];

  if (missingCompanionMisread) {
    notes.push('spine: companionMisread thin or missing');
  }

  const verdict = failConditions.some(Boolean) ? 'FAIL' : 'PASS';

  if (verdict === 'FAIL') {
    if (missingChildDesire) notes.push('FAIL: missing child desire');
    if (missingTryFail) notes.push('FAIL: missing try/fail');
    if (missingChildDiscovery) notes.push('FAIL: missing child discovery/plan');
    if (missingBraveChildAction) notes.push('FAIL: missing brave child action');
    if (missingWorldResponse) notes.push('FAIL: missing world response');
    if (pagesWithoutConcreteEvent.length > 2) {
      notes.push(`FAIL: ${pagesWithoutConcreteEvent.length} pages without concrete event`);
    }
    if (passiveChildPages.length > pageCount * 0.25) {
      notes.push(`FAIL: ${passiveChildPages.length} passive child pages`);
    }
    if (longestStatic >= 2) notes.push(`FAIL: longest static run = ${longestStatic}`);
  }

  return {
    verdict,
    missingChildDesire,
    missingTryFail,
    missingCompanionMisread,
    missingChildDiscovery,
    missingBraveChildAction,
    missingWorldResponse,
    pagesWithoutConcreteEvent,
    passiveChildPages,
    staticPages,
    weakPageTurnPages,
    longestStaticRun: longestStatic,
    notes,
  };
}
