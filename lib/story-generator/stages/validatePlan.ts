import { getDirectionDNA, MOMENT_WINDOWS, resolvePageCount } from '../data/direction-dna';
import type { GenerateInput, Plan, PlanQualityWarning, PlanValidationResult } from '../types';

const GENERIC_COMPANION_ACTIONS = /(יושב|מסתכל|צופה|נוכח|עומד ליד|מלווה)(?!\S)/i;
const PASSIVE_CHILD = /(חושב|מבין|יודע|מרגיש|מפחד מ|חושש)(?!\S)/i;

function collectPlanWarnings(plan: Plan, input: GenerateInput): PlanQualityWarning[] {
  const warnings: PlanQualityWarning[] = [];
  const pageCount = resolvePageCount(input.direction, input.pageCount);

  let passiveChildPages = 0;
  let prevLocation = '';
  let sameLocationRun = 0;
  const wordTargets = plan.beatMap.map((b) => b.wordCountTarget);

  for (const beat of plan.beatMap) {
    if (GENERIC_COMPANION_ACTIONS.test(beat.companionAction)) {
      warnings.push({
        type: 'companion_action_generic',
        detail: `Page ${beat.pageNumber}: companion action too passive ("${beat.companionAction}")`,
        affectedPages: [beat.pageNumber],
      });
    }
    if (PASSIVE_CHILD.test(beat.childAction)) {
      passiveChildPages++;
    }
    const loc = beat.location.trim().toLowerCase();
    if (loc && loc === prevLocation) {
      sameLocationRun++;
      if (sameLocationRun >= 3) {
        warnings.push({
          type: 'location_repetition',
          detail: `Location "${beat.location}" repeats 4+ times in a row`,
          affectedPages: [beat.pageNumber - 3, beat.pageNumber - 2, beat.pageNumber - 1, beat.pageNumber],
        });
      }
    } else {
      sameLocationRun = 0;
      prevLocation = loc;
    }
  }

  if (passiveChildPages >= 4) {
    warnings.push({
      type: 'child_action_passive',
      detail: `${passiveChildPages} pages with passive child verbs`,
    });
  }

  if (wordTargets.length >= 3) {
    const min = Math.min(...wordTargets);
    const max = Math.max(...wordTargets);
    if (max - min <= 5) {
      warnings.push({
        type: 'pacing_flat',
        detail: 'wordCountTarget range is very flat across pages',
      });
    }
  }

  const emotional = plan.beatMap.map((b) => b.emotionalRead.toLowerCase());
  const hasRise = emotional.some((e) => /עלי|מתח|גדל|חזק|overwhelm|tense/i.test(e));
  const hasFall = emotional.some((e) => /שקט|רגוע|נח|soft|calm|settle/i.test(e));
  if (!hasRise || !hasFall) {
    warnings.push({
      type: 'escalation_missing',
      detail: 'beatMap emotionalRead may lack clear rise and settle',
    });
  }

  const hook = plan.hookContract;
  const hookText = [hook.sound, hook.phrase, hook.microAction, hook.object].filter(Boolean).join(' ');
  if (!hookText || hookText.length < 3 || /^(שלום|היי|שוב|ok)$/i.test(hookText.trim())) {
    warnings.push({ type: 'hook_weak', detail: 'hook elements look generic or empty' });
  }

  const introBy = getDirectionDNA(input.direction).companionIntroByPage;
  const earlyBeats = plan.beatMap.filter((b) => b.pageNumber <= introBy);
  const companionNamedEarly = earlyBeats.some((b) =>
    /בולי|לילי|קים|bolly|lily|koko|companion|דמות/i.test(b.companionAction)
  );
  if (!companionNamedEarly && pageCount >= introBy) {
    warnings.push({
      type: 'companion_action_generic',
      detail: `No clear companion action by page ${introBy}`,
      affectedPages: earlyBeats.map((b) => b.pageNumber),
    });
  }

  return warnings;
}

/** Structural plan validation before drafting. */
export function validatePlan(plan: Plan, input: GenerateInput): PlanValidationResult {
  const warnings = collectPlanWarnings(plan, input);
  const pageCount = resolvePageCount(input.direction, input.pageCount);

  if (!plan.momentContract?.page) {
    return { ok: false, reason: 'momentContract.page missing', warnings };
  }
  if (!plan.hookContract?.appearsOnPages?.length) {
    return { ok: false, reason: 'hookContract.appearsOnPages empty', warnings };
  }
  if (!Array.isArray(plan.beatMap) || plan.beatMap.length !== pageCount) {
    return {
      ok: false,
      reason: `beatMap length ${plan.beatMap?.length ?? 0} ≠ pageCount ${pageCount}`,
      warnings,
    };
  }
  if (!plan.preserveListSeeds?.length) {
    return { ok: false, reason: 'preserveListSeeds must be populated', warnings };
  }
  if (!plan.visualPacingMap?.heartPage) {
    return { ok: false, reason: 'visualPacingMap.heartPage missing', warnings };
  }

  const window = MOMENT_WINDOWS[input.direction];
  const momentPage = plan.momentContract.page;
  if (momentPage < window[0] || momentPage > window[1]) {
    return {
      ok: false,
      reason: `moment page ${momentPage} outside window [${window[0]}, ${window[1]}]`,
      warnings,
    };
  }

  if (plan.hookContract.appearsOnPages.length < 2) {
    return { ok: false, reason: 'hook must appear on ≥2 pages', warnings };
  }

  const pageNumbers = new Set(plan.beatMap.map((b) => b.pageNumber));
  for (let i = 1; i <= pageCount; i++) {
    if (!pageNumbers.has(i)) {
      return { ok: false, reason: `beatMap missing page ${i}`, warnings };
    }
  }

  return { ok: true, warnings };
}
