import { z } from 'zod';

/** Explicit test-only provider selection; absence preserves every historical Image2 wire. */
export const ENGINE_IMAGE26_POLICY = 'image26-local-book/v1' as const;
export const engineImageModelPolicySchema = z.object({
  version: z.literal(ENGINE_IMAGE26_POLICY),
  model: z.enum(['gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']),
  complexity: z.enum(['low', 'medium', 'high']),
}).strict();
export type EngineImageModelPolicy = z.infer<typeof engineImageModelPolicySchema>;
