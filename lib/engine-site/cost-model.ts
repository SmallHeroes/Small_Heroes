import 'server-only';

import { z } from 'zod';
import { renderMaximum, IDENTITY_MAXIMUM_MICRO_USD } from '@/scripts/personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from '@/scripts/personal-simple-book-illustrator';
import { NATIVE_BOOK_PAGE_ATTEMPTS, NATIVE_BOOK_REVIEW_REASKS } from '@/lib/personal-wizard/native-page-proof';
import { PREPARATION_SLOTS } from '@/lib/personal-wizard/source-preparation-policy';
import { BOOK_NARRATION } from '@/scripts/personal-book-narration';
import { causalOutputCap } from '@/scripts/personal-causal-trial-host';
import { generationTimeoutMs } from '@/lib/personal-wizard/story-config';
import { ENGINE_SITE_LAUNCH_OFFER } from './offer';

const nonnegative = z.number().finite().nonnegative();
const assumptionsSchema = z.object({
  lowNativeUsd: nonnegative, lowRenderShare: z.number().min(0).max(1), mediumRenderMultiplier: z.number().min(1).max(20),
  storyAndPreparationUsd: nonnegative, narrationCharacters: z.number().int().min(1).max(45_000),
  finalPromptUtf8Bytes: z.number().int().min(1).max(96_000), referencesPerRender: z.number().int().min(1).max(4),
  storyWireByteCeiling: z.number().int().min(1).max(104_000),
  childReferenceCeilingUsd: nonnegative, ilsPerUsd: z.number().positive().finite(), vatRate: z.number().min(0).max(1),
  paymentFeeRate: z.number().min(0).max(1), paymentFixedIls: nonnegative, infrastructureUsd: nonnegative,
}).strict();
export type CostAssumptions = z.infer<typeof assumptionsSchema>;

/** Sensitivity only. Owner-supplied LOW aggregate is not a MEDIUM measurement or a provider invoice. */
export function engineSiteCostScenario(raw: CostAssumptions) {
  const a = assumptionsSchema.parse(raw), frames = 9;
  const expectedNativeUsd = a.lowNativeUsd * (1 + (a.mediumRenderMultiplier - 1) * a.lowRenderShare);
  const narrationUsd = a.narrationCharacters * BOOK_NARRATION.accountingMicroUsdPerCharacter / 1e6;
  const expectedGenerationUsd = expectedNativeUsd + a.storyAndPreparationUsd + narrationUsd;
  const renderReserve = renderMaximum('x'.repeat(a.finalPromptUtf8Bytes), a.referencesPerRender);
  const nativeDeclaredReserveUsd = (frames * NATIVE_BOOK_PAGE_ATTEMPTS *
    (renderReserve + SOL_PIXEL_REVIEW_SLOT_MICRO_USD + IDENTITY_MAXIMUM_MICRO_USD) +
    NATIVE_BOOK_REVIEW_REASKS * SOL_PIXEL_REVIEW_SLOT_MICRO_USD) / 1e6;
  // Same current author stage caps; hosted Opus API standard price is 4/20, not the CLI's historical 8/20.
  const opusCaps = (['plan', 'replan', 'author', 'editor'] as const).map(stage => causalOutputCap(8, stage));
  const storyOpusReserveUsd = (4 * a.storyWireByteCeiling * 4 + opusCaps.reduce((sum, cap) => sum + cap, 0) * 20) * 1.1 / 1e6;
  const storyReviewReserveUsd = (3 * a.storyWireByteCeiling * 10 + 3 * causalOutputCap(8, 'final_review') * 50) * 1.1 / 1e6;
  const preparationDeclaredReserveUsd = PREPARATION_SLOTS.reduce((sum, amount) => sum + amount, 0) / 1e6;
  const narrationReserveUsd = narrationUsd * BOOK_NARRATION.reserveFactor;
  const fullDeclaredReserveUsd = nativeDeclaredReserveUsd + storyOpusReserveUsd + storyReviewReserveUsd +
    preparationDeclaredReserveUsd + a.childReferenceCeilingUsd + narrationReserveUsd;
  const grossRevenueUsd = ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100 / a.ilsPerUsd;
  const netRevenueUsd = grossRevenueUsd / (1 + a.vatRate);
  const paymentFeeUsd = (ENGINE_SITE_LAUNCH_OFFER.priceAgorot / 100 * a.paymentFeeRate + a.paymentFixedIls) / a.ilsPerUsd;
  const availableForGenerationUsd = netRevenueUsd - paymentFeeUsd - a.infrastructureUsd;
  return { assumptions: a, expectedNativeUsd, narrationUsd, expectedGenerationUsd,
    reserve: { nativeDeclaredReserveUsd, storyOpusReserveUsd, storyReviewReserveUsd, preparationDeclaredReserveUsd,
      childReferenceCeilingUsd: a.childReferenceCeilingUsd, narrationReserveUsd, fullDeclaredReserveUsd },
    grossRevenueUsd, netRevenueUsd, paymentFeeUsd, availableForGenerationUsd,
    expectedContributionUsd: availableForGenerationUsd - expectedGenerationUsd,
    fullReserveContributionUsd: availableForGenerationUsd - fullDeclaredReserveUsd,
    qualification: 'unmeasured_medium_sensitivity_not_invoice_or_spend_authority' as const };
}

/** Preserve current output caps/timeouts; classify a step rather than truncating it to fit serverless. */
export function authorStepRuntime(stage: 'plan' | 'replan' | 'author' | 'editor', invocationMs = 300_000) {
  const outputTokens = causalOutputCap(8, stage), providerDeadlineMs = generationTimeoutMs(outputTokens), persistMarginMs = 45_000;
  return { stage, outputTokens, providerDeadlineMs, persistMarginMs,
    requiredMs: providerDeadlineMs + persistMarginMs,
    fitsInvocation: providerDeadlineMs + persistMarginMs < invocationMs,
    executor: providerDeadlineMs + persistMarginMs < invocationMs ? 'existing_chunk_worker' as const : 'durable_long_step_executor' as const };
}
