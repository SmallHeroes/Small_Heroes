/**
 * The paid reviews of child-anchor-style/v1 (opt-in): the style review and the design + apparent-age review of one anchor candidate, each a
 * Sol 6.1 call at the default tier through the caller's meter (the reviewed $0.60 slot, claimed before sending), settled from its raw answer
 * under the reviewed audition's own review rule. No retry, no fallback model; an invalid, incomplete or unpriced answer fails with its receipt.
 * No work runs on import.
 */
import sharp from 'sharp';
import OpenAI from 'openai';
import type { z } from 'zod';
import { auditionReviewRule, digestImages, type AuditionMeter } from './personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { childAnchorDesignPayload, childAnchorDesignReviewSchema, childAnchorStylePayload, childAnchorStyleReviewSchema, ChildAnchorStyleError,
  type ChildAnchorRecipe } from '../lib/personal-wizard/child-anchor-style';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';

const fail = (code: string): never => { throw new ChildAnchorStyleError(code); };
export type ChildAnchorStyleJudge = (step: string, candidate: AuditionImage, contextSha: string, recipeSha: string) => Promise<unknown>;
export type ChildAnchorDesignJudge = (step: string, candidate: AuditionImage, context: unknown, contextSha: string, recipe: ChildAnchorRecipe) => Promise<unknown>;

const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
/** The complete image and its four 70% corner crops (the existing pixel judge's views of one candidate). */
async function candidateViews(bytes: Buffer) {
  const meta = await sharp(bytes).metadata(), width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
  const crops = await Promise.all([[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].map(async ([left, top]) =>
    dataUrl(await sharp(bytes).extract({ left, top, width: cw, height: ch }).png().toBuffer())));
  return [dataUrl(bytes), ...crops];
}

export function childAnchorJudges(args: { bytesOf: (image: AuditionImage) => Buffer; meter: Pick<AuditionMeter, 'run'>; key: () => string;
  signal: AbortSignal; guard: () => void }) {
  const cancelled = () => { if (args.signal.aborted) fail('child_anchor_cancelled'); };
  const check = () => { cancelled(); args.guard(); };
  const send = <S extends z.ZodTypeAny>(step: string, payload: Record<string, unknown>, schema: S) => {
    // The payload was prepared asynchronously: re-check before the claim.
    check();
    return args.meter.run(step, digestImages(payload), SOL_PIXEL_REVIEW_SLOT_MICRO_USD, async () => {
      cancelled(); const client = new OpenAI({ apiKey: args.key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const raw = await client.responses.create(payload as never, { signal: args.signal, timeout: 300000 }) as unknown as { output_text?: string };
      const settled = auditionReviewRule.settle(payload, { raw }, true), receipt = { raw, estimatedMicroUsd: settled.estimatedMicroUsd };
      if (!settled.coherent || settled.estimatedMicroUsd === null) throw Object.assign(new ChildAnchorStyleError('child_anchor_review_provider_invalid'), { receipt });
      let value: z.infer<S>;
      try { value = schema.parse(JSON.parse(raw.output_text!)); }
      catch { throw Object.assign(new ChildAnchorStyleError('child_anchor_review_schema'), { receipt }); }
      // A judgment is never used after a change during the call; the receipt keeps its cost.
      try { check(); } catch (error) { throw Object.assign(error as object, { receipt }); }
      return { value, estimatedMicroUsd: settled.estimatedMicroUsd, receipt };
    });
  };
  const style: ChildAnchorStyleJudge = async (step, candidate, contextSha, recipeSha) => {
    check();
    return send(step, childAnchorStylePayload({ candidateSha: candidate.imageSha, contextSha, recipeSha, candidateURL: dataUrl(args.bytesOf(candidate)) }),
      childAnchorStyleReviewSchema);
  };
  const design: ChildAnchorDesignJudge = async (step, candidate, context, contextSha, recipe) => {
    check();
    const imageURLs = await candidateViews(args.bytesOf(candidate));
    return send(step, childAnchorDesignPayload({ candidateSha: candidate.imageSha, contextSha, context, recipe, imageURLs }), childAnchorDesignReviewSchema);
  };
  return { style, design };
}
