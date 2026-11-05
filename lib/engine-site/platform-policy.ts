import 'server-only';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { renderMaximum, IDENTITY_MAXIMUM_MICRO_USD } from '@/scripts/personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from '@/scripts/personal-simple-book-illustrator';
import { PREPARATION_SLOTS, PREPARATION_STEPS } from '@/lib/personal-wizard/source-preparation-policy';
import { simpleStoryOutputTokens } from '@/lib/personal-wizard/simple-story-engine';
import { SOL_WRITING } from '@/lib/personal-wizard/sol-writing-route';
import { NATIVE_BOOK_FRAMES, NATIVE_BOOK_PAGE_ATTEMPTS } from '@/lib/personal-wizard/native-page-proof';
import { digestSchema, identifierSchema, microUsdSchema, utcSchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import {LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD} from './local-trial-recovery-policy';

export const ENGINE_RECIPE_VERSION = 'engine-site-native-production/v1';
export const engineSpendPolicySchema = z.object({
  version: z.literal('engine-site-spend-policy/v1'), sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  maximumMicroUsd: microUsdSchema.refine(n => n > 0), maximumCalls: z.number().int().min(1).max(1000),
  approvalReference: identifierSchema, approvedBy: identifierSchema, approvedAt: utcSchema,
  /** A distinct explicit spend activation, never implied by the checkout flag or a proposed cap. */
  paidProviderActivation: z.literal('owner_approved_live_personal_orders'),
}).strict();
export type EngineSpendPolicy = z.infer<typeof engineSpendPolicySchema>;
export function engineRecipeSteps(options?:{initialStoryboardRecovery?:true}) {
  const steps: { id: string; maximumMicroUsd: number }[] = [];
  const add = (id: string, maximumMicroUsd: number) => steps.push({ id, maximumMicroUsd });
  for (const stage of ['author', 'editor'] as const) {
    const tokens = simpleStoryOutputTokens(8);
    add(`story_${stage}`, stage === 'author' ? Math.ceil((104_000 * 4 + tokens * 20) * 1.1)
      : Math.max(SOL_WRITING.minimumReserveMicroUsd, Math.ceil((104_000 * 2 + tokens * 10) * 1.1)));
  }
  for (const stage of ['final_review', 'comparison']) {
    add(`story_${stage}`, Math.max(SOL_WRITING.minimumReserveMicroUsd, Math.ceil((104_000 * 2 + 16_000 * 10) * 1.1)));
    add(`story_${stage}_citation`, Math.max(SOL_WRITING.minimumReserveMicroUsd, Math.ceil((104_000 * 2 + 16_000 * 10) * 1.1)));
  }
  PREPARATION_STEPS.forEach((id, i) => add(id, PREPARATION_SLOTS[i]));
  if(options?.initialStoryboardRecovery){add('initial_storyboard_repair_1',LOCAL_INITIAL_REPAIR_RESERVE_MICRO_USD);add('initial_storyboard_repair_1_review',PREPARATION_SLOTS[1]);}
  for (const name of ['reference_child', 'reference_child_repair']) {
    add(name, renderMaximum('x'.repeat(32_768), 4));
    add(`${name}_style_qa`, SOL_PIXEL_REVIEW_SLOT_MICRO_USD); add(`${name}_qa`, SOL_PIXEL_REVIEW_SLOT_MICRO_USD);
    add(`${name}_identity`, IDENTITY_MAXIMUM_MICRO_USD);
  }
  add('photo_appearance', SOL_PIXEL_REVIEW_SLOT_MICRO_USD);
  add('initial_storyboard', PREPARATION_SLOTS[0]); add('initial_storyboard_review', PREPARATION_SLOTS[1]);
  for (const page of NATIVE_BOOK_FRAMES) {
    for (let attempt = 0; attempt < NATIVE_BOOK_PAGE_ATTEMPTS; attempt += 1) {
      const stem = `page_${page}_${attempt}`;
      add(stem, renderMaximum('x'.repeat(96_000), 4));
      add(`${stem}_qa`, SOL_PIXEL_REVIEW_SLOT_MICRO_USD); add(`${stem}_qa2`, SOL_PIXEL_REVIEW_SLOT_MICRO_USD);
      add(`${stem}_identity`, IDENTITY_MAXIMUM_MICRO_USD);
    }
    // Current narration accounting rule:100 microUSD/character, x2 reserve, <=5000 characters per frame.
    add(`narration_${page}`, 1_000_000);
  }
  return steps;
}
export const enginePolicyDigest = (policy: EngineSpendPolicy) => canonicalHash({ recipe: ENGINE_RECIPE_VERSION, policy, steps: engineRecipeSteps() });
export function configuredEngineSpendPolicy(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.ENGINE_SITE_WORKER_ENABLED !== 'true' || env.ENGINE_SITE_PROVIDERS_ENABLED !== 'true') engineSiteFail('engine_runtime_disabled');
  let raw: unknown; try { raw = JSON.parse(env.ENGINE_SITE_SPEND_POLICY ?? ''); } catch { engineSiteFail('engine_spend_policy_required'); }
  const policy = engineSpendPolicySchema.parse(raw);
  const deployed = env.VERCEL_GIT_COMMIT_SHA ?? env.ENGINE_SITE_SOURCE_REVISION;
  if (deployed !== policy.sourceRevision) engineSiteFail('engine_runtime_revision_mismatch');
  return policy;
}
export function assertEnginePolicyCurrent(authority: EngineOrderAuthority, env: Readonly<Record<string, string | undefined>> = process.env) {
  const policy = configuredEngineSpendPolicy(env);
  if (authority.policySha256 !== enginePolicyDigest(policy) || authority.sourceRevision !== policy.sourceRevision)
    engineSiteFail('engine_runtime_policy_changed');
  digestSchema.parse(authority.policySha256);
}
