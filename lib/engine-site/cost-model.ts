import 'server-only';

import { z } from 'zod';
import { renderMaximum, IDENTITY_MAXIMUM_MICRO_USD } from '@/scripts/personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from '@/scripts/personal-simple-book-illustrator';
import { NATIVE_BOOK_PAGE_ATTEMPTS, NATIVE_BOOK_REVIEW_REASKS } from '@/lib/personal-wizard/native-page-proof';
import { PREPARATION_SLOTS } from '@/lib/personal-wizard/source-preparation-policy';
import { BOOK_NARRATION } from '@/scripts/personal-book-narration';
import { causalOutputCap } from '@/scripts/personal-causal-trial-host';
import { generationTimeoutMs } from '@/lib/personal-wizard/story-config';
import { simpleStoryOutputTokens } from '@/lib/personal-wizard/simple-story-engine';
import { SOL_WRITING } from '@/lib/personal-wizard/sol-writing-route';
import { engineRecipeSteps } from './platform-policy';
import { ENGINE_SITE_LAUNCH_OFFER } from './offer';

const nonnegative = z.number().finite().nonnegative();
/** Owner-supplied measured anchor; no provider/receipt/account access is performed by this module. */
export const LOW_NATIVE_ANCHOR = Object.freeze({ book: 'book-r15e', calls: 81, microUsd: 5_457_428 });
/** Proposal only. This constant never creates spend authority or selects a dispatch budget. */
export const PROPOSED_ORDER_CAP_MICRO_USD = 10_000_000;
const assumptionsSchema = z.object({
  storyAndPreparationUsd: nonnegative, narrationCharacters: z.number().int().min(1).max(45_000),
  finalPromptUtf8Bytes: z.number().int().min(1).max(96_000), referencesPerRender: z.number().int().min(1).max(4),
  storyWireByteCeiling: z.number().int().min(1).max(104_000),
  ilsPerUsd: z.number().positive().finite(), vatRate: z.number().min(0).max(1),
  paymentFeeRate: z.number().min(0).max(1), paymentFixedIls: nonnegative, infrastructureUsd: nonnegative,
}).strict();
export type CostAssumptions = z.infer<typeof assumptionsSchema>;

/** LOW launch calculation. The measured aggregate is not a distribution or a provider invoice guarantee. */
export function engineSiteCostScenario(raw: CostAssumptions) {
  const a = assumptionsSchema.parse(raw), frames = 9;
  const expectedNativeUsd = LOW_NATIVE_ANCHOR.microUsd / 1e6;
  const narrationUsd = a.narrationCharacters * BOOK_NARRATION.accountingMicroUsdPerCharacter / 1e6;
  const expectedGenerationUsd = expectedNativeUsd + a.storyAndPreparationUsd + narrationUsd;
  const renderReserve = renderMaximum('x'.repeat(a.finalPromptUtf8Bytes), a.referencesPerRender);
  const nativeDeclaredReserveUsd = (frames * NATIVE_BOOK_PAGE_ATTEMPTS *
    (renderReserve + SOL_PIXEL_REVIEW_SLOT_MICRO_USD + IDENTITY_MAXIMUM_MICRO_USD) +
    NATIVE_BOOK_REVIEW_REASKS * SOL_PIXEL_REVIEW_SLOT_MICRO_USD) / 1e6;
  // Repository investigation: current momentum is Opus author + Sol editor/readers; causal plan/replan are not launch calls.
  const writingTokens = simpleStoryOutputTokens(8);
  const storyOpusReserveUsd = (a.storyWireByteCeiling * 4 + writingTokens * 20) * 1.1 / 1e6;
  const storyEditorReserveUsd = Math.max(.6, (a.storyWireByteCeiling * 2 + writingTokens * 10) * 1.1 / 1e6);
  const storyReviewReserveUsd = 4 * Math.max(.6, (a.storyWireByteCeiling * 2 + 16_000 * 10) * 1.1 / 1e6);
  const preparationDeclaredReserveUsd = PREPARATION_SLOTS.reduce((sum, amount) => sum + amount, 0) / 1e6;
  const narrationReserveUsd = narrationUsd * BOOK_NARRATION.reserveFactor;
  const steps = engineRecipeSteps(), amount = (id: string) => steps.find(s => s.id === id)!.maximumMicroUsd / 1e6;
  const initialStoryboardReserveUsd = amount('initial_storyboard') + amount('initial_storyboard_review');
  const photoAppearanceReserveUsd = amount('photo_appearance');
  const childDeclaredReserveUsd = ['reference_child', 'reference_child_repair'].reduce((sum, id) =>
    sum + amount(id) + amount(`${id}_style_qa`) + amount(`${id}_qa`), 0) + amount('reference_child_identity');
  const fullDeclaredReserveUsd = nativeDeclaredReserveUsd + storyOpusReserveUsd + storyEditorReserveUsd + storyReviewReserveUsd +
    preparationDeclaredReserveUsd + initialStoryboardReserveUsd + photoAppearanceReserveUsd + childDeclaredReserveUsd + narrationReserveUsd;
  const runtimeNativeDeclaredReserveUsd = frames * NATIVE_BOOK_PAGE_ATTEMPTS *
    (amount('page_0_0') + amount('page_0_0_qa') + amount('page_0_0_identity')) + NATIVE_BOOK_REVIEW_REASKS * amount('page_0_0_qa2');
  const runtimeNarrationReserveUsd = Array.from({ length: 9 }, (_, n) => amount(`narration_${n}`)).reduce((sum, n) => sum + n, 0);
  const runtimeDeclaredReserveUsd = fullDeclaredReserveUsd - nativeDeclaredReserveUsd + runtimeNativeDeclaredReserveUsd
    - narrationReserveUsd + runtimeNarrationReserveUsd;
  const grossRevenueUsd = ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100 / a.ilsPerUsd;
  const netRevenueUsd = grossRevenueUsd / (1 + a.vatRate);
  const paymentFeeUsd = (ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100 * a.paymentFeeRate + a.paymentFixedIls) / a.ilsPerUsd;
  const availableForGenerationUsd = netRevenueUsd - paymentFeeUsd - a.infrastructureUsd;
  return { assumptions: a, expectedNativeUsd, narrationUsd, expectedGenerationUsd,
    reserve: { nativeDeclaredReserveUsd, storyOpusReserveUsd, storyEditorReserveUsd, storyReviewReserveUsd, preparationDeclaredReserveUsd,
      initialStoryboardReserveUsd, photoAppearanceReserveUsd, childDeclaredReserveUsd,
      narrationReserveUsd, fullDeclaredReserveUsd, runtimeNativeDeclaredReserveUsd, runtimeNarrationReserveUsd, runtimeDeclaredReserveUsd },
    grossRevenueUsd, netRevenueUsd, paymentFeeUsd, availableForGenerationUsd,
    expectedContributionUsd: availableForGenerationUsd - expectedGenerationUsd,
    fullReserveContributionUsd: availableForGenerationUsd - fullDeclaredReserveUsd,
    proposedCapUsd: PROPOSED_ORDER_CAP_MICRO_USD / 1e6,
    qualification: 'reported_low_anchor_not_invoice_or_spend_authority' as const };
}

/** Preserve current output caps/timeouts; classify a step rather than truncating it to fit serverless. */
export function authorStepRuntime(stage: 'plan' | 'replan' | 'author' | 'editor', invocationMs = 300_000) {
  const outputTokens = causalOutputCap(8, stage), providerDeadlineMs = generationTimeoutMs(outputTokens), persistMarginMs = 45_000;
  return { stage, outputTokens, providerDeadlineMs, persistMarginMs,
    requiredMs: providerDeadlineMs + persistMarginMs,
    fitsInvocation: providerDeadlineMs + persistMarginMs < invocationMs,
    executor: providerDeadlineMs + persistMarginMs < invocationMs ? 'existing_chunk_worker' as const : 'durable_long_step_executor' as const };
}

export function launchStoryRuntime() {
  const outputTokens = simpleStoryOutputTokens(8), authorDeadlineMs = generationTimeoutMs(outputTokens);
  return { separatePlannerSelected: false, author: { model: 'claude-opus-5-5', outputTokens,
    providerDeadlineMs: authorDeadlineMs, requiredMs: authorDeadlineMs + 45_000, executor: 'durable_long_step_executor' },
    editor: { model: SOL_WRITING.model, outputTokens, providerDeadlineMs: SOL_WRITING.timeoutMs,
      executor: 'background_responses_existing_chunk_worker' } };
}
