import 'server-only';
import { canonicalJson } from './request-acceptance';
import type { PersonalWizardOptions } from './options';
import { prepareCurrentPersonalStoryboard, authorPersonalStoryboard, PERSONAL_STORYBOARD_INSTRUCTION, personalStoryboardReviewInput,
  personalStoryboardReviewSchema, storyboardReviewDisposition, currentPersonalStoryboardFrame, OWNED_STORYBOARD_INSTRUCTION } from './storyboard';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION, type BookVisualCall } from './book-runner';
import { personalBookOutputLimits } from './book-config';
import type { wholeBookDraftSchema, ownedWholeBookDraftSchema } from '../local-book-planning';

export const SIMPLE_STORYBOARD_DIAGNOSTIC_VERSION = 'personal-simple-storyboard-diagnostic/offline-v1' as const;
export const SIMPLE_STORYBOARD_INPUT_LIMIT = 104_000;
export type SimpleStoryboardDiagnosticCall = BookVisualCall & {
  schema: typeof wholeBookDraftSchema | typeof ownedWholeBookDraftSchema | typeof personalStoryboardReviewSchema;
};
export class SimpleStoryboardDiagnosticError extends Error {
  constructor(readonly code: string) { super(`simple_storyboard_diagnostic_${code}`); }
}
const fail = (code: string): never => { throw new SimpleStoryboardDiagnosticError(code); };

/**
 * Injected diagnostic only. No default transport, key, network, reservation, retry or image authority.
 * A future paid caller must enforce its own approved transport/accounting before supplying generate.
 */
export async function runSimpleStoryboardDiagnostic(args: {
  request: unknown; writerResult: unknown; options: PersonalWizardOptions; signal: AbortSignal;
  generate: (call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => Promise<unknown>;
  inputByteLimit?: number;
  actorOwnedAppearance?: true;
}) {
  const limit = args.inputByteLimit ?? SIMPLE_STORYBOARD_INPUT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > SIMPLE_STORYBOARD_INPUT_LIMIT) fail('input_policy');
  if (args.signal.aborted) fail('cancelled');
  // This driver is for the explicit simple envelope only, never archive/v3 substitution.
  if (!args.writerResult || typeof args.writerResult !== 'object' || !('simpleSource' in args.writerResult)) fail('simple_source_required');
  const source = prepareCurrentPersonalStoryboard(args.request, args.writerResult, args.options, args.actorOwnedAppearance);
  const instructions = args.actorOwnedAppearance ? OWNED_STORYBOARD_INSTRUCTION : PERSONAL_STORYBOARD_INSTRUCTION;
  const caps = personalBookOutputLimits(source.story.pages.length);
  const calls: (BookVisualCall & { contentBytes: number; contentByteLimit: number; headroomBytes: number })[] = [];
  const assertCurrent = () => {
    if (args.signal.aborted) fail('cancelled');
    try {
      if (prepareCurrentPersonalStoryboard(args.request, args.writerResult, args.options, args.actorOwnedAppearance).sourceDigest !== source.sourceDigest) fail('source_changed');
    } catch (error) {
      if (error instanceof SimpleStoryboardDiagnosticError) throw error;
      fail('source_changed');
    }
  };
  const measure = (instructions: string, input: string) => {
    const contentBytes = Buffer.byteLength(instructions, 'utf8') + Buffer.byteLength(input, 'utf8');
    if (contentBytes > limit) fail('input_limit');
    return { contentBytes, contentByteLimit: limit, headroomBytes: limit - contentBytes };
  };
  const dispatch = async (call: SimpleStoryboardDiagnosticCall) => {
    assertCurrent();
    const { schema: _schema, ...record } = call;
    calls.push({ ...record, context: { ...record.context }, ...measure(call.instructions, call.input) });
    let output: unknown;
    try { output = await args.generate(call, args.signal); }
    catch { return fail(args.signal.aborted ? 'cancelled' : `${call.stage}_callback_failed`); }
    assertCurrent();
    return output;
  };
  // Preflight outside authorPersonalStoryboard's callback-error wrapper, before any injected invocation.
  measure(instructions, canonicalJson(source.planningInput));
  assertCurrent();
  const storyboard = await authorPersonalStoryboard(source, call => dispatch({ stage: 'storyboard',
    instructions: call.instructions, input: canonicalJson(call.input), schema: call.schema,
    maxOutputTokens: caps.storyboardOutputTokens,
    context: { narrativeSpreads: source.story.pages.length, sourceDigest: source.sourceDigest,
      ...(args.actorOwnedAppearance ? { actorOwnedAppearance: true as const } : {}) } }), args.signal);
  assertCurrent();
  const rawReview = await dispatch({ stage: 'review', instructions: PERSONAL_BOOK_REVIEW_INSTRUCTION,
    input: canonicalJson(personalStoryboardReviewInput(storyboard)), schema: personalStoryboardReviewSchema,
    maxOutputTokens: caps.reviewOutputTokens,
    context: { narrativeSpreads: storyboard.narrativeSpreads, sourceDigest: storyboard.sourceDigest, storyboardDigest: storyboard.storyboardDigest,
      ...(args.actorOwnedAppearance ? { actorOwnedAppearance: true as const } : {}) } });
  const review = storyboardReviewDisposition(storyboard, rawReview);
  assertCurrent();
  const framePackets = review.disposition === 'review_supported'
    ? Array.from({ length: storyboard.narrativeSpreads + 1 }, (_, pageNumber) => currentPersonalStoryboardFrame(storyboard, rawReview, pageNumber,
      { request: args.request, writerResult: args.writerResult, options: args.options })) : [];
  assertCurrent();
  return { version: SIMPLE_STORYBOARD_DIAGNOSTIC_VERSION, status: review.disposition,
    sourceDigest: source.sourceDigest, storyboardDigest: storyboard.storyboardDigest,
    writerResult: source.result, storyboard, rawReview, review, framePackets, calls,
    measurementScope: 'instruction_and_input_utf8_content_not_wire_tokens_or_output_adequacy' as const,
    runtimeEligible: false as const };
}
