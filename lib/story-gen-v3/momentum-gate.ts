/**
 * Pre-prose momentum gate — beat structure sanity before Hebrew prose.
 */

import type { PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from './types';

export interface MomentumReport {
  pass: boolean;
  failures: string[];
  warnings: string[];
  childActionPages: number;
  companionClimaxPages: number;
}

const PASSIVE_CHILD_RE = /^(צופה|מחכה|מרגיש|מסתכל|עומד)/i;

/** Strip placeholders/chips for verb detection in childDoes. */
export function normalizeChildDoesField(childDoes: string): string {
  return childDoes
    .replace(/\{\{childName\}\}/g, '')
    .replace(/\{[^{}|]+\|[^{}]+\}/g, ' ')
    .replace(
      /([\u0590-\u05FF][\u0590-\u05FF\u05F3\u05F4\-]*)\/([\u0590-\u05FF][\u0590-\u05FF\u05F3\u05F4\-]*)/g,
      '$1'
    )
    .trim();
}

const CHILD_ACTION_VERBS =
  'מנסה|מוביל|בונה|דוחף|מסדר|קורא|פותח|מרים|שם|מדביק|מושך|טובל|מצייר|קופץ|מנער|תולה|תול|עוקב|מחזיק|נכנס|מניח|מצביע|מנגב|מודד|עומד|הצביע|הסתכל|טבל|משך|הניח|נשם|ניגב|גיחך|מתגלגל|ניער|תלה|הרים|מדד|מוסיף|אומר|מבחין|מתכונן|מדליק|מקיש|מתכופף|מושיט|מצמיד|מחליק|מתופף|מכבה|סופר|מטה';

function childDoesHasAction(normalized: string): boolean {
  return new RegExp(CHILD_ACTION_VERBS).test(normalized);
}
const POPCORN_SHAPE_RE = /מגבת|פופקורן|כנף כבדה|מנהרת רוח|גרעין/i;
const REASSURANCE_ONLY_RE = /הכול בסדר|זה יהיה בסדר|אין מה לפחד/i;

export function runMomentumGateBeforeProse(args: {
  spine: StorySpineV3;
  beats: PageBeatV3[];
  premise: StoryPremiseCandidate;
}): MomentumReport {
  const failures: string[] = [];
  const warnings: string[] = [];

  let childActionPages = 0;
  let companionClimaxPages = 0;

  for (const beat of args.beats) {
    if (!beat.whatChanges?.trim()) {
      failures.push(`p${beat.page}: empty whatChanges`);
    }
    if (PASSIVE_CHILD_RE.test(beat.childDoes?.trim() ?? '')) {
      failures.push(`p${beat.page}: passive childDoes`);
    }
    if (/קוֹקוֹ.*(פותרת|מצילה|מובילה את הסיום)|דיני.*(פותרת|מצילה)/i.test(beat.event)) {
      companionClimaxPages++;
    }
    const childDoes = normalizeChildDoesField(beat.childDoes ?? '');
    if (childDoesHasAction(childDoes)) {
      childActionPages++;
    }
    if (REASSURANCE_ONLY_RE.test(beat.event + beat.whatChanges)) {
      warnings.push(`p${beat.page}: reassurance-only beat`);
    }
  }

  if (childActionPages < 4) {
    failures.push(`only ${childActionPages} pages with child action (need ≥4)`);
  }
  if (companionClimaxPages > 0) {
    failures.push(`companion owns climax on ${companionClimaxPages} page(s)`);
  }
  if (POPCORN_SHAPE_RE.test(JSON.stringify(args.beats)) && /koko|chameleon/i.test(args.premise.id)) {
    warnings.push('beats contain popcorn-shape residue');
  }
  if (!args.spine.braveChildAction || args.spine.braveChildAction.length < 20) {
    failures.push('spine.braveChildAction too thin');
  }

  return {
    pass: failures.length === 0,
    failures,
    warnings,
    childActionPages,
    companionClimaxPages,
  };
}
