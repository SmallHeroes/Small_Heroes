/**
 * Classify engine auto-selected premise autonomy vs human-hardened fallback.
 */

import type { PremiseHardFail, PremiseScoredCandidate, StoryPremiseCandidate } from './types';
import type { PremiseExperimentSpecV3 } from './types';

export type AutoPremiseAutonomy = 'PASS' | 'WOULD_FAIL' | 'CONTAMINATED';

const CONTAMINATION_CODES = new Set([
  'wrong_companion_leak',
  'popcorn_collapse_shape',
  'medical_forbidden_phrase',
  'homesickness_slogan_only',
  'golden_copy_leak',
]);

const MEDICAL_FORBIDDEN =
  /זה לא יכאב|אין מה לפחד|תהיה אמיץ|הרופא נחמד|אם תירגע הכול יעבור/i;

const HOMESICKNESS_SLOGAN =
  /הבית בלב|הבית תמיד איתך|גם מקום חדש יכול להיות בית/i;

const COMPANION_LEAK: Record<string, RegExp> = {
  lion_shaket: /דיני|דרקון|קוֹקוֹ|chameleon|פופקורן|כנף.*קן/i,
  bunny_ometz: /דיני|דרקון|קוֹקוֹ|chameleon|פופקורן|לֵיוֹ|lion/i,
  turtle_beiti: /דיני|דרקון|קוֹקוֹ|chameleon|פופקורן|לֵיוֹ|בוּנִי.*אוזנ/i,
  chameleon_koko: /דיני|דרקון|כנף.*קן|פופקורן/i,
};

function blob(c: StoryPremiseCandidate): string {
  return JSON.stringify(c);
}

export function detectPremiseContamination(
  candidate: StoryPremiseCandidate,
  spec: PremiseExperimentSpecV3
): string[] {
  const reasons: string[] = [];
  const b = blob(candidate);

  const leakRe = COMPANION_LEAK[spec.companionId];
  if (leakRe?.test(b)) reasons.push('cross_companion_or_prior_scenario_leak');

  if (spec.category === 'MEDICAL_PROCEDURE' && MEDICAL_FORBIDDEN.test(b)) {
    reasons.push('medical_forbidden_phrase');
  }

  if (spec.category === 'HOMESICKNESS') {
    const hasSlogan = HOMESICKNESS_SLOGAN.test(b);
    const hasPhysical =
      /קונכייה|מפה|בד|ריח|טקס|סימן|שולחן|מסלול|חפץ|object|shell|ritual|route|mark|smell/i.test(
        b
      );
    if (hasSlogan && !hasPhysical) reasons.push('homesickness_slogan_only');
  }

  for (const forbidden of spec.forbidPlotCopy ?? []) {
    if (forbidden.length > 8 && b.toLowerCase().includes(forbidden.slice(0, 20).toLowerCase())) {
      reasons.push(`forbidPlotCopy_near:${forbidden.slice(0, 30)}`);
    }
  }

  return reasons;
}

export function classifyAutoPremiseAutonomy(args: {
  scored: PremiseScoredCandidate | undefined;
  selected: StoryPremiseCandidate;
  spec: PremiseExperimentSpecV3;
  minPassScore?: number;
}): { status: AutoPremiseAutonomy; reasons: string[] } {
  const { scored, selected, spec } = args;
  const minPass = args.minPassScore ?? 72;
  const reasons: string[] = [];

  const contamination = detectPremiseContamination(selected, spec);
  if (contamination.length) {
    return { status: 'CONTAMINATED', reasons: contamination };
  }

  if (scored?.hardFails?.some((f: PremiseHardFail) => CONTAMINATION_CODES.has(f.code))) {
    return {
      status: 'CONTAMINATED',
      reasons: scored.hardFails.map((f) => f.code),
    };
  }

  if (scored?.disqualified) {
    return {
      status: 'WOULD_FAIL',
      reasons: scored.hardFails?.map((f) => f.code) ?? ['disqualified'],
    };
  }

  const score = scored?.weightedTotal ?? 0;
  if (score < minPass) {
    reasons.push(`score_below_${minPass}:${score}`);
  }

  if (reasons.length) {
    return { status: 'WOULD_FAIL', reasons };
  }

  return { status: 'PASS', reasons: [] };
}
