/**
 * Long-form drift check for 20-page fantasy (lion confidence batch).
 *
 * No 3 consecutive pages may repeat:
 * emotion grows → chaos grows → companion reacts
 * without new child action, discovery, reversal, or changed tactic.
 */

import type { PageBeatV3 } from './types';

export interface LongFormDriftResult {
  longFormDriftCheck: 'PASS' | 'REPAIR';
  midStoryTurnPage: number | null;
  repeatedBeatRuns: Array<{ startPage: number; endPage: number; pattern: string }>;
  warnings: string[];
}

const ESCALATION_RE =
  /גדל|יותר|מסתבך|chaos|escalat|רעש|עולה|מתחזק|harder|worse/i;
const COMPANION_REACT_RE =
  /ליאו|lion|companion|אריה|reac|מגיב|אומר|עושה|tail|זנב|roar|שאג/i;
const CHILD_ACTION_RE =
  /ילד|child|מנסה|discover|מגלה|reversal|הופך|בוחר|שם לב|action|עושה משהו|מחליט/i;

function pageFunction(beat: PageBeatV3): 'escalation' | 'companion_react' | 'child_action' | 'other' {
  const blob = `${beat.event} ${beat.childDoes} ${beat.companionDoes ?? ''} ${beat.whatChanges}`;
  if (CHILD_ACTION_RE.test(blob) && beat.childDoes?.trim().length > 5) return 'child_action';
  if (ESCALATION_RE.test(blob)) return 'escalation';
  if (COMPANION_REACT_RE.test(blob)) return 'companion_react';
  return 'other';
}

export function runLongFormDriftGate(beats: PageBeatV3[]): LongFormDriftResult {
  const repeatedBeatRuns: LongFormDriftResult['repeatedBeatRuns'] = [];
  const warnings: string[] = [];

  let midStoryTurnPage: number | null = null;
  const midStart = Math.floor(beats.length * 0.35);
  const midEnd = Math.floor(beats.length * 0.65);

  for (let i = 0; i < beats.length; i++) {
    const fn = pageFunction(beats[i]!);
    if (fn === 'child_action' && i >= midStart && i <= midEnd && midStoryTurnPage == null) {
      midStoryTurnPage = beats[i]!.page;
    }
  }

  for (let i = 0; i <= beats.length - 3; i++) {
    const trio = beats.slice(i, i + 3);
    const fns = trio.map(pageFunction);
    const allEscalationCompanion =
      fns.every((f) => f === 'escalation' || f === 'companion_react') &&
      fns.filter((f) => f === 'escalation').length >= 1 &&
      fns.filter((f) => f === 'companion_react').length >= 1;
    const noChildBreak = !fns.includes('child_action');

    if (allEscalationCompanion && noChildBreak) {
      repeatedBeatRuns.push({
        startPage: trio[0]!.page,
        endPage: trio[2]!.page,
        pattern: 'emotion→chaos→companion without child action',
      });
    }
  }

  if (midStoryTurnPage == null) {
    warnings.push('no clear mid-story child turn detected in pages 35–65% band');
  }

  const longFormDriftCheck =
    repeatedBeatRuns.length === 0 && midStoryTurnPage != null ? 'PASS' : 'REPAIR';

  return { longFormDriftCheck, midStoryTurnPage, repeatedBeatRuns, warnings };
}
