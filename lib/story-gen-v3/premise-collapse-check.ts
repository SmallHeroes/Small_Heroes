/**
 * Detect premise collapse into popcorn / over-wrap / air-gap template.
 */

import type { StoryPremiseCandidate } from './types';

export interface PopcornCollapseHit {
  candidateId: string;
  patterns: string[];
  collapsed: boolean;
}

const POPCORN_COLLAPSE_PATTERNS: RegExp[] = [
  /over[\s-]?(wrap|protect|help|cover)/i,
  /air[\s-]?gap|gentler\s+way|small\s+wind|needs\s+space|מרחב|לשחרר|אוויר|רוח\s+קטנה.*כנף/i,
  /companion\s+over[\s-]?help|מגן\s+מדי|עוטף\s+מדי|כנף\s+כבדה|קן\s+בטוח/i,
  /popcorn|פופקורן|גרעין.*אש/i,
  /towel[\s-]?sail|מפרש.*מגבת|wind\s+tunnel/i,
  /child\s+finds\s+(air|space|gap)|ילד.*מגלה.*מקום/i,
  /reassur|הרגעה|it\s+was\s+okay|הכול\s+בסדר/i,
];

export function checkPopcornCollapse(candidate: StoryPremiseCandidate): PopcornCollapseHit {
  const blob = JSON.stringify(candidate);
  const patterns: string[] = [];
  for (const re of POPCORN_COLLAPSE_PATTERNS) {
    if (re.test(blob)) patterns.push(re.source.slice(0, 40));
  }
  const collapsed =
    patterns.length >= 2 ||
    (/popcorn|פופקורן/i.test(blob) && /wrap|כנף|קן/i.test(blob));
  return { candidateId: candidate.id, patterns, collapsed };
}

export function analyzePremiseDiversity(candidates: StoryPremiseCandidate[]): {
  distinctCount: number;
  collapsedIds: string[];
  viableNonCollapsed: string[];
  passStop1: boolean;
  summary: string;
} {
  const hits = candidates.map(checkPopcornCollapse);
  const collapsedIds = hits.filter((h) => h.collapsed).map((h) => h.candidateId);
  const families = new Set(candidates.map((c) => c.premiseFamily ?? c.playSystem?.slice(0, 30)));
  const viableNonCollapsed = hits.filter((h) => !h.collapsed).map((h) => h.candidateId);
  const distinctCount = families.size;
  const passStop1 =
    viableNonCollapsed.length >= 2 &&
    distinctCount >= 3 &&
    collapsedIds.length < candidates.length;

  const summary =
    passStop1
      ? `STOP1 PASS: ${viableNonCollapsed.length} non-collapsed candidates, ${distinctCount} family clusters`
      : `STOP1 FAIL/RISK: ${collapsedIds.length} collapsed to popcorn-shape; ${viableNonCollapsed.length} viable`;

  return { distinctCount, collapsedIds, viableNonCollapsed, passStop1, summary };
}
