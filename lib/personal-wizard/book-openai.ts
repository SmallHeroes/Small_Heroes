import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { wholeBookDraftSchema } from '../local-book-planning';
import { personalStoryboardReviewSchema, STORYBOARD_BOOK_CHECKS, STORYBOARD_FRAME_CHECKS } from './storyboard';
import { createPersonalStoryProvider } from './story-openai';
import type { StoryModel } from './story-config';
import { BOOK_LIMITS } from './book-config';
import type { BookVisualCall, PersonalBookProvider } from './book-runner';
import type { StoryUsage } from './story-contract';

export class BookProviderError extends Error {
  providerUsage?: StoryUsage;
  constructor(readonly code: 'book_provider_context' | 'book_provider_schema' | 'book_provider_incomplete' | 'book_provider_malformed' | 'book_provider_input_limit') { super(code); }
}
const hash = /^[a-f0-9]{64}$/;
export function personalBookProviderSchema(call: BookVisualCall) {
  const { narrativeSpreads: count, sourceDigest, storyboardDigest } = call.context;
  if (![8, 12, 16].includes(count) || !hash.test(sourceDigest) ||
      (call.stage === 'review' && !hash.test(storyboardDigest ?? '')) || !['storyboard', 'review'].includes(call.stage)) throw new BookProviderError('book_provider_context');
  if (call.stage === 'storyboard') {
    return wholeBookDraftSchema.extend({
      plan: wholeBookDraftSchema.shape.plan.extend({
        pages: z.array(wholeBookDraftSchema.shape.plan.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        continuity: wholeBookDraftSchema.shape.plan.shape.continuity.extend({
          pages: z.array(wholeBookDraftSchema.shape.plan.shape.continuity.shape.pages.element.omit({ pageNumber: true })).length(count + 1),
        }),
      }),
      sequence: wholeBookDraftSchema.shape.sequence.extend({
        pages: z.array(wholeBookDraftSchema.shape.sequence.shape.pages.element.omit({ pageNumber: true })).length(count),
      }),
    });
  }
  const item = personalStoryboardReviewSchema.shape.bookChecks.element.omit({ category: true });
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

/** Caller must validate request/settings and reserve the entire job before constructing this. */
export function createPersonalBookProvider(apiKey: string, model: StoryModel): PersonalBookProvider {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: BOOK_LIMITS.timeoutMs });
  return { story: createPersonalStoryProvider(apiKey, model), visual: { async generate(call, signal) {
    const schema = personalBookProviderSchema(call);
    const expectedTokens = call.stage === 'storyboard' ? BOOK_LIMITS.storyboardOutputTokens : BOOK_LIMITS.reviewOutputTokens;
    if (call.maxOutputTokens !== expectedTokens) throw new BookProviderError('book_provider_context');
    const payload = { model, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const },
      instructions: call.instructions + '\nProvider output: ordered arrays have NO pageNumber; book/continuity start with cover. Review fixed groups have NO category/hash/pageNumber metadata.',
      input: call.input, max_output_tokens: call.maxOutputTokens, text: { format: zodTextFormat(schema, `personal_book_${call.stage}`) } };
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > BOOK_LIMITS.inputBytesPerCall) throw new BookProviderError('book_provider_input_limit');
    const response = await client.responses.create(payload, { signal });
    const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null;
    try {
      if (response.status !== 'completed' || !response.output_text) throw new BookProviderError('book_provider_incomplete');
      let raw: unknown;
      try { raw = JSON.parse(response.output_text); } catch { throw new BookProviderError('book_provider_malformed'); }
      return { output: decodePersonalBookProviderOutput(call, raw), usage };
    } catch (error) { if (error instanceof BookProviderError) error.providerUsage = usage; throw error; }
  } } };
}
