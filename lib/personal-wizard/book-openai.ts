import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';
import { personalStoryboardReviewSchema, impactStoryboardReviewSchema, claimBasisStoryboardReviewSchema, calibrationStoryboardReviewSchema, STORYBOARD_BOOK_CHECKS,
  STORYBOARD_FRAME_CHECKS } from './storyboard';
import { calibrationSelfCheckWireSchema } from './storyboard-calibration';
import { momentWholeBookDraftSchema, ownedMomentWholeBookDraftSchema, storyboardMomentsSchema, drawnInstantWholeBookDraftSchema,
  ownedDrawnInstantWholeBookDraftSchema, drawnInstantMomentsSchema } from './storyboard-moments';
import { selfCheckWireSchema } from './storyboard-self-check';
import { claimBasisMomentsSchema, claimBasisFrameSchema } from './storyboard-claim-basis';
import { createPersonalStoryProvider } from './story-openai';
import { createStoryEditorProvider } from './story-editor-openai';
import { generationTimeoutMs, type StoryModel } from './story-config';
import { BOOK_LIMITS, personalBookOutputLimits } from './book-config';
import type { BookVisualCall, PersonalBookProvider } from './book-runner';
import type { StoryUsage } from './story-contract';

export class BookProviderError extends Error {
  providerUsage?: StoryUsage;
  constructor(readonly code: 'book_provider_context' | 'book_provider_schema' | 'book_provider_incomplete' | 'book_provider_malformed' | 'book_provider_input_limit') { super(code); }
}
const hash = /^[a-f0-9]{64}$/;
export function personalBookProviderSchema(call: BookVisualCall) {
  if (call.context.actorOwnedAppearance !== undefined && call.context.actorOwnedAppearance !== true) throw new BookProviderError('book_provider_context');
  if (call.context.momentContract !== undefined && call.context.momentContract !== true) throw new BookProviderError('book_provider_context');
  if (call.context.landmarkKindContract !== undefined && call.context.landmarkKindContract !== true) throw new BookProviderError('book_provider_context');
  // The drawn-instant contract extends the moments contract's frames (actorStates), so it needs that contract.
  if (call.context.drawnInstantContract !== undefined && (call.context.drawnInstantContract !== true || call.context.momentContract !== true))
    throw new BookProviderError('book_provider_context');
  // The planner self-check binds the moments contract's frames, so it needs that contract; the typed review policy stands alone.
  if (call.context.selfCheckContract !== undefined && (call.context.selfCheckContract !== true || call.context.momentContract !== true))
    throw new BookProviderError('book_provider_context');
  if (call.context.reviewImpactPolicy !== undefined && call.context.reviewImpactPolicy !== true) throw new BookProviderError('book_provider_context');
  // The claim basis refines the planner's drawn-instant frames and self-check, and the typed review's issues, so it needs those contracts.
  if (call.context.claimBasisContract !== undefined && (call.context.claimBasisContract !== true || (call.stage === 'storyboard'
    ? call.context.momentContract !== true || call.context.drawnInstantContract !== true || call.context.selfCheckContract !== true
    : call.context.reviewImpactPolicy !== true))) throw new BookProviderError('book_provider_context');
  // The calibration refines the claim basis on both sides (the planner's self-check map, the review's basis and citations), so it needs it.
  if (call.context.calibrationContract !== undefined && (call.context.calibrationContract !== true || call.context.claimBasisContract !== true))
    throw new BookProviderError('book_provider_context');
  const { narrativeSpreads: count, sourceDigest, storyboardDigest } = call.context;
  if (![8, 12, 16].includes(count) || !hash.test(sourceDigest) ||
      (call.stage === 'review' && !hash.test(storyboardDigest ?? '')) || !['storyboard', 'review'].includes(call.stage)) throw new BookProviderError('book_provider_context');
  // Opt-in self-check: one self-check frame per page (cover first), beside the moments, on its bound-free wire shape (the engine compiler
  // validates the decoded selfCheck with its bounded schema). Statically the draft shape: the decoder keeps every field it parsed.
  const withSelfCheck = <T extends z.AnyZodObject>(schema: T): T => (call.context.selfCheckContract
    ? schema.extend({ selfCheck: call.context.calibrationContract ? calibrationSelfCheckWireSchema(count + 1) : selfCheckWireSchema(count + 1) }) : schema) as T;
  if (call.stage === 'storyboard' && call.context.momentContract && call.context.drawnInstantContract) {
    // Opt-in drawn-instant contract: exactly the moments shape below, with actorStates in every depicted instant.
    const draft = call.context.actorOwnedAppearance ? ownedDrawnInstantWholeBookDraftSchema : drawnInstantWholeBookDraftSchema;
    return withSelfCheck(draft.extend({
      plan: draft.shape.plan.extend({
        pages: z.array(draft.shape.plan.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        continuity: draft.shape.plan.shape.continuity.extend({
          pages: z.array(draft.shape.plan.shape.continuity.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        }),
      }),
      sequence: draft.shape.sequence.extend({
        pages: z.array(draft.shape.sequence.shape.pages.element.omit({ pageNumber: true })).length(count),
      }),
      // Opt-in claim basis: its frames (staging and the flat requirement) instead; otherwise the exact drawn-instant frames.
      moments: call.context.claimBasisContract ? claimBasisMomentsSchema.extend({ frames: z.array(claimBasisFrameSchema).length(count + 1) })
        : drawnInstantMomentsSchema.extend({ frames: z.array(drawnInstantMomentsSchema.shape.frames.element).length(count + 1) }),
    }));
  }
  if (call.stage === 'storyboard' && call.context.momentContract) {
    // Opt-in moments contract: same page-order metadata removal, plus one moments frame per page (cover first).
    const draft = call.context.actorOwnedAppearance ? ownedMomentWholeBookDraftSchema : momentWholeBookDraftSchema;
    return withSelfCheck(draft.extend({
      plan: draft.shape.plan.extend({
        pages: z.array(draft.shape.plan.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        continuity: draft.shape.plan.shape.continuity.extend({
          pages: z.array(draft.shape.plan.shape.continuity.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        }),
      }),
      sequence: draft.shape.sequence.extend({
        pages: z.array(draft.shape.sequence.shape.pages.element.omit({ pageNumber: true })).length(count),
      }),
      moments: storyboardMomentsSchema.extend({ frames: z.array(storyboardMomentsSchema.shape.frames.element).length(count + 1) }),
    }));
  }
  if (call.stage === 'storyboard') {
    const draft = call.context.actorOwnedAppearance ? ownedWholeBookDraftSchema : wholeBookDraftSchema;
    return draft.extend({
      plan: draft.shape.plan.extend({
        pages: z.array(draft.shape.plan.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        continuity: draft.shape.plan.shape.continuity.extend({
          pages: z.array(draft.shape.plan.shape.continuity.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        }),
      }),
      sequence: draft.shape.sequence.extend({
        pages: z.array(draft.shape.sequence.shape.pages.element.omit({ pageNumber: true })).length(count),
      }),
    });
  }
  // Under the typed review policy every check item also carries its issues (under the claim basis each with its citation); otherwise the exact
  // existing item.
  const item = call.context.calibrationContract ? calibrationStoryboardReviewSchema.shape.bookChecks.element.omit({ category: true })
    : call.context.claimBasisContract ? claimBasisStoryboardReviewSchema.shape.bookChecks.element.omit({ category: true })
    : call.context.reviewImpactPolicy ? impactStoryboardReviewSchema.shape.bookChecks.element.omit({ category: true })
    : personalStoryboardReviewSchema.shape.bookChecks.element.omit({ category: true });
  const group = (names: readonly string[]) => z.object(Object.fromEntries(names.map(name => [name, item]))).strict();
  return z.object({ bookChecks: group(STORYBOARD_BOOK_CHECKS),
    frames: z.array(group(STORYBOARD_FRAME_CHECKS)).length(count + 1) }).strict();
}

/** Page order and binding identities are deterministic engine metadata, never model claims. */
export function decodePersonalBookProviderOutput(call: BookVisualCall, raw: unknown) {
  const parsed = personalBookProviderSchema(call).safeParse(raw);
  if (!parsed.success) throw new BookProviderError('book_provider_schema');
  if ('plan' in parsed.data) {
    const data = parsed.data;
    return { ...data, plan: { ...data.plan, pages: data.plan.pages.map((page, index) => ({ ...page, pageNumber: index })),
      continuity: { ...data.plan.continuity, pages: data.plan.continuity.pages.map((page, index) => ({ ...page, pageNumber: index })) } },
      sequence: { ...data.sequence, pages: data.sequence.pages.map((page, index) => ({ ...page, pageNumber: index + 1 })) } };
  }
  const data = parsed.data;
  return { sourceDigest: call.context.sourceDigest, storyboardDigest: call.context.storyboardDigest,
    bookChecks: STORYBOARD_BOOK_CHECKS.map(category => ({ category, ...data.bookChecks[category] })),
    frames: data.frames.map((frame, pageNumber) => ({ pageNumber,
      checks: STORYBOARD_FRAME_CHECKS.map(category => ({ category, ...frame[category] })) })) };
}

/** Exact existing SDK wire, shared with the explicit local receipt-recording caller. */
export function personalBookProviderPayload(call: BookVisualCall, model: StoryModel) {
    const schema = personalBookProviderSchema(call);
    const limits = personalBookOutputLimits(call.context.narrativeSpreads, call.context.selfCheckContract ? { selfCheck: true } : undefined);
    const expectedTokens = call.stage === 'storyboard' ? limits.storyboardOutputTokens : limits.reviewOutputTokens;
    if (call.maxOutputTokens !== expectedTokens) throw new BookProviderError('book_provider_context');
    const payload = { model, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const },
      instructions: call.instructions + '\nProvider output: ordered arrays have NO pageNumber; book/continuity start with cover. Review fixed groups have NO category/hash/pageNumber metadata.',
      input: call.input, max_output_tokens: call.maxOutputTokens, text: { format: zodTextFormat(schema, `personal_book_${call.stage}`) } };
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > BOOK_LIMITS.inputBytesPerCall) throw new BookProviderError('book_provider_input_limit');
    return payload;
}

/** Caller must validate request/settings and reserve the entire job before constructing this. */
export function createPersonalBookProvider(apiKey: string, model: StoryModel): PersonalBookProvider {
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  return { story: createPersonalStoryProvider(apiKey, model), editor: createStoryEditorProvider(apiKey, model), visual: { async generate(call, signal) {
    const payload = personalBookProviderPayload(call, model);
    const response = await client.responses.create(payload, { signal, timeout: generationTimeoutMs(call.maxOutputTokens) });
    const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null;
    try {
      if (response.status !== 'completed' || !response.output_text) throw new BookProviderError('book_provider_incomplete');
      let raw: unknown;
      try { raw = JSON.parse(response.output_text); } catch { throw new BookProviderError('book_provider_malformed'); }
      return { output: decodePersonalBookProviderOutput(call, raw), usage };
    } catch (error) { if (error instanceof BookProviderError) error.providerUsage = usage; throw error; }
  } } };
}
