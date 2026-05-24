import type { VoiceFindingType } from '../editorial/voice-schemas';
import { isVoiceReviewerBlockingEnabled } from '../editorial/voice-reviewer-meta';
import type { ProductionRecipe } from '../recipes/recipe-types';

export const VOICE_REROLL_MAX_ROUNDS = 2;
export const VOICE_REROLL_MAX_PAGES_PER_ROUND = 3;
export const VOICE_REROLL_MAX_ATTEMPTS_PER_PAGE = 2;
export const VOICE_REROLL_FAMILY_PAGE_THRESHOLD = 4;

export { isVoiceReviewerBlockingEnabled };

export interface VoiceRerollPlan {
  eligiblePages: number[];
  skippedStoryScope: number;
  skippedFamilySpread: number;
  blockedByFlag: boolean;
}

/**
 * Phase C reroll candidates (section 7). When VOICE_REVIEWER_BLOCKING is off,
 * returns a plan with blockedByFlag=true and never mutates the story.
 */
export function planVoiceRerolls(findings: VoiceFindingType[]): VoiceRerollPlan {
  if (!isVoiceReviewerBlockingEnabled()) {
    return {
      eligiblePages: [],
      skippedStoryScope: findings.filter((f) => f.scope === 'story').length,
      skippedFamilySpread: 0,
      blockedByFlag: true,
    };
  }

  const byFamily = new Map<string, number>();
  for (const f of findings) {
    if (!f.rerollEligibleActive) continue;
    byFamily.set(f.family, (byFamily.get(f.family) ?? 0) + 1);
  }

  let skippedFamilySpread = 0;
  const blockedFamilies = new Set<string>();
  for (const [family, count] of byFamily) {
    if (count >= VOICE_REROLL_FAMILY_PAGE_THRESHOLD) {
      blockedFamilies.add(family);
      skippedFamilySpread += count;
    }
  }

  const pages = new Set<number>();
  for (const f of findings) {
    if (!f.rerollEligibleActive || f.page == null) continue;
    if (blockedFamilies.has(f.family)) continue;
    pages.add(f.page);
  }

  const eligiblePages = [...pages]
    .sort((a, b) => a - b)
    .slice(0, VOICE_REROLL_MAX_PAGES_PER_ROUND * VOICE_REROLL_MAX_ROUNDS);

  return {
    eligiblePages,
    skippedStoryScope: findings.filter((f) => f.scope === 'story').length,
    skippedFamilySpread,
    blockedByFlag: false,
  };
}

export interface VoiceRerollExecutionResult {
  executed: boolean;
  reason: string;
  plan: VoiceRerollPlan;
}

/**
 * Stub hook for splice-reroll integration (#172). Unit-tested; no-op when flag off.
 */
export async function executeVoiceRerolls(_args: {
  storyMarkdown: string;
  findings: VoiceFindingType[];
  recipe: ProductionRecipe;
  plan: VoiceRerollPlan;
}): Promise<VoiceRerollExecutionResult> {
  const plan = _args.plan;
  if (plan.blockedByFlag) {
    return {
      executed: false,
      reason: 'VOICE_REVIEWER_BLOCKING=off (v1 diagnostic-only)',
      plan,
    };
  }
  if (plan.eligiblePages.length === 0) {
    return {
      executed: false,
      reason: 'no eligible page findings',
      plan,
    };
  }
  return {
    executed: false,
    reason: 'reroll wiring not connected to splice-reroll yet',
    plan,
  };
}
