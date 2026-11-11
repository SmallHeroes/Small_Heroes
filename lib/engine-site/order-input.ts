import { z } from 'zod';
import { reviewedPersonalBookRequestSchema, normalizeText } from '@/lib/personal-wizard/contract';

export const engineOrderInputSchema = z.object({
  version: z.literal('engine-site-order-input/v1'),
  optionsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  fictionalQa: z.literal(true).optional(),
  request: reviewedPersonalBookRequestSchema,
  appearance: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('description'), description: z.string().min(10).max(1200)
      .refine(s => s === normalizeText(s), 'appearance_not_normalized') }).strict(),
    z.object({ kind: z.literal('private_photo'), assetId: z.string().uuid() }).strict(),
  ]),
}).strict();
export type EngineOrderInput = z.infer<typeof engineOrderInputSchema>;
