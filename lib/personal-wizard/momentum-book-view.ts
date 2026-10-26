import { z } from 'zod';

/** What the local Wizard panel may show about the ONE momentum book it recorded: progress only, never authority or acceptance. */
export const momentumBookViewSchema = z.object({
  requestId: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(['received', 'running', 'ready', 'held', 'stopped']),
  event: z.string().max(300).nullable(),
  readerUrl: z.string().regex(/^\/dev\/local-reader\?book=trial-[a-f0-9]{16}$/).nullable(),
  narration: z.enum(['narrated', 'narration_stopped', 'narration_unavailable']).nullable(),
  accounting: z.object({ apiCumulativeMicroUsd: z.number().int().nonnegative().nullable(), claudeMaxMicroUsd: z.number().int().nonnegative().nullable() }).strict().nullable(),
  runtimeEligible: z.literal(false), productAccepted: z.literal(false),
}).strict();
export type MomentumBookView = z.infer<typeof momentumBookViewSchema>;
export function readMomentumBookView(value: unknown, requestId: string): MomentumBookView | null {
  const parsed = momentumBookViewSchema.safeParse(value);
  return parsed.success && parsed.data.requestId === requestId ? parsed.data : null;
}
