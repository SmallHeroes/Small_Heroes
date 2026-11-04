import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import {
  planGPTImageRequest, type BookDesignReferenceRole, type GenerateGPTImageInput,
} from '@/lib/generate-image';
import { authorityDigest, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';

const inputSchema = z.object({
  step: z.string().regex(/^page_[0-8]_[0-2]$/),
  prompt: z.string().min(1),
  size: z.enum(['1024x1024', '1024x1536']),
  referenceMode: z.enum(['book_identity', 'book_design', 'book_scene_edit']),
  references: z.array(z.instanceof(Buffer).refine(bytes => bytes.length > 0 && bytes.length <= 20_000_000))
    .min(1).max(4),
  referenceRoles: z.array(z.string()).min(1).max(4).optional(),
}).strict();
export type NativeOrderImageInput = z.infer<typeof inputSchema>;
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/**
 * Provider-free boundary for an order's explicit native-v1 quality. The actual common image planner
 * assembles the body; no SDK/client/key/default environment is used and no request is sent.
 * Historical LOW audition planner/meter stay unchanged. This is not a paid transport or a measured
 * invoice cost model: its reservation is the externally approved immutable step allowance.
 */
export function planNativeOrderImage(rawAuthority: EngineOrderAuthority, rawInput: NativeOrderImageInput) {
  const authority = engineOrderAuthoritySchema.parse(rawAuthority), parsed = inputSchema.parse(rawInput);
  if (authority.purpose !== 'customer') engineSiteFail('customer_authority_required');
  const slot = authority.budget.steps.find(step => step.id === parsed.step);
  if (!slot) engineSiteFail('engine_step_not_authorized');
  // Freeze exact bytes now. Caller mutation or a rotating signed URL cannot change the planned references.
  const references = parsed.references.map(bytes => Buffer.from(bytes));
  const input: GenerateGPTImageInput = {
    finalPrompt: parsed.prompt, size: parsed.size, referenceMode: parsed.referenceMode,
    ...(parsed.referenceRoles ? { referenceRoles: [...parsed.referenceRoles] as BookDesignReferenceRole[] } : {}),
    referenceImages: references.map(bytes => `data:image/png;base64,${bytes.toString('base64')}`),
    exactReferenceBytes: references,
    requireReferenceEdit: true, quality: authority.imageQuality, modelOverride: 'gpt-image-2', requestTimeoutMs: 180_000,
  };
  const plan = planGPTImageRequest(input, { defaultQuality: authority.imageQuality, defaultModel: 'gpt-image-2', maxReferences: 4 });
  if (plan.apiMode !== 'images.edit' || plan.referenceCountPassed !== references.length ||
      plan.bodyWithoutBinaryImage.quality !== authority.imageQuality || plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' ||
      plan.bodyWithoutBinaryImage.n !== 1 || plan.requestOptions.maxRetries !== 0) engineSiteFail('customer_image_plan_invalid');
  const wire = {
    version: 'engine-site-native-image-wire/v1' as const,
    orderId: authority.orderId, authoritySha256: authorityDigest(authority), step: parsed.step,
    body: plan.bodyWithoutBinaryImage, mode: plan.apiMode,
    references: references.map(bytes => ({ sha256: sha(bytes), bytes: bytes.length })),
    ...(plan.referenceRoles ? { referenceRoles: plan.referenceRoles } : {}),
    maxRetries: 0 as const, deadlineMs: 180_000,
  };
  return { input, wire, call: { step: parsed.step, wireSha256: canonicalHash(wire), maximumMicroUsd: slot.maximumMicroUsd } };
}

/** Rebuild immediately before dispatch; return fresh reference-byte copies, never a mutable stale plan. */
export function revalidateNativeOrderImage(authority: EngineOrderAuthority, planned: ReturnType<typeof planNativeOrderImage>) {
  const admitted = engineOrderAuthoritySchema.parse(authority);
  const allowed = new Set(['finalPrompt', 'size', 'referenceMode', 'referenceRoles', 'referenceImages',
    'exactReferenceBytes', 'requireReferenceEdit', 'quality', 'modelOverride', 'requestTimeoutMs']);
  const input = planned.input;
  if (Object.keys(input).some(key => !allowed.has(key)) || input.quality !== admitted.imageQuality ||
      input.modelOverride !== 'gpt-image-2' || input.requireReferenceEdit !== true || input.requestTimeoutMs !== 180_000 ||
      !input.exactReferenceBytes || !input.referenceImages ||
      input.exactReferenceBytes.length !== input.referenceImages.length ||
      input.exactReferenceBytes.some((bytes, index) => input.referenceImages![index] !== `data:image/png;base64,${bytes.toString('base64')}`)) {
    engineSiteFail('customer_image_plan_changed');
  }
  const checked = planNativeOrderImage(authority, {
    step: planned.call.step, prompt: input.finalPrompt, size: input.size as NativeOrderImageInput['size'],
    referenceMode: input.referenceMode as NativeOrderImageInput['referenceMode'], references: input.exactReferenceBytes,
    ...(input.referenceRoles ? { referenceRoles: [...input.referenceRoles] } : {}),
  });
  if (canonicalHash(checked.wire) !== canonicalHash(planned.wire) || canonicalHash(checked.call) !== canonicalHash(planned.call)) {
    engineSiteFail('customer_image_plan_changed');
  }
  return checked;
}
