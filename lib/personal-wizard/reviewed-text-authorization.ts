import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { canonicalJson } from './request-acceptance';
import type { PreparedStory } from './story-writer';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** Server/operator permission for this exact reviewed TEXT, not a fixture label. */
export const reviewedTextAuthorizationSchema = z.object({
  version: z.literal('local-reviewed-text-authorization/v1'),
  approvalReference: z.string().min(10).max(600), userId: z.string().min(1).max(200),
  requestId: hash, requestDigest: hash, optionsFingerprint: hash,
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  consent: z.literal('reviewed_text_to_opus_and_astra'),
}).strict();
export type ReviewedTextAuthorization = z.infer<typeof reviewedTextAuthorizationSchema>;
export function reviewedTextDigest(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function assertReviewedTextAuthorization(raw: unknown, prepared: PreparedStory,
  approvalReference: string, sourceHead: string): ReviewedTextAuthorization {
  const auth = reviewedTextAuthorizationSchema.parse(raw);
  if (auth.approvalReference !== approvalReference || auth.sourceHead !== sourceHead ||
      auth.requestId !== prepared.accepted.requestId || auth.optionsFingerprint !== prepared.accepted.optionsFingerprint ||
      auth.requestDigest !== reviewedTextDigest(prepared.accepted.canonical) || prepared.brief.beats !== 8) {
    throw Error('reviewed_text_authorization');
  }
  return structuredClone(auth);
}
