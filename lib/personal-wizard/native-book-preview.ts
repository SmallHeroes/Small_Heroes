import { z } from 'zod';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** Display contract for the explicitly approved LOCAL native diagnostic only. */
export const NATIVE_TEXT_MODELS = { author: 'claude-opus-5-5', editor: 'claude-opus-5-5', critic: 'gpt-6-astra' } as const;
const manuscript = z.object({ title: z.string().min(1).max(200), pages: z.array(z.object({
  pageNumber: z.number().int().min(1).max(8), text: z.string().min(1).max(6000),
}).strict()).length(8) }).strict().refine(v => v.pages.every((p, i) => p.pageNumber === i + 1));
const quote = z.object({ pageNumber: z.number().int().min(1).max(8), quote: z.string().min(1).max(2400) }).strict();
export const nativeBookViewSchema = z.object({
  version: z.literal('local-native-book-view/v1'), requestId: hash, revision: z.number().int().min(0).max(30),
  phase: z.enum(['queued', 'planning', 'synopsis_review', 'repairing', 'writing', 'complete', 'held', 'failed']),
  models: z.object({ author: z.literal(NATIVE_TEXT_MODELS.author), editor: z.literal(NATIVE_TEXT_MODELS.editor), critic: z.literal(NATIVE_TEXT_MODELS.critic) }).strict(),
  original: manuscript.nullable(), edited: manuscript.nullable(),
  readings: z.array(z.object({ stage: z.enum(['original_review', 'final_review', 'comparison']), summary: z.string().max(2400),
    findings: z.array(z.object({ severity: z.enum(['blocking', 'meaningful', 'polish']), kind: z.string().max(40),
      criterion: z.string().max(2400), explanation: z.string().max(2400), original: z.array(quote).max(8), revised: z.array(quote).max(8),
    }).strict()).max(20) }).strict()).max(3),
  error: z.string().regex(/^[a-z0-9_]+$/).nullable(),
  accounting: z.object({ knownEstimateMicroUsd: z.number().int().nonnegative(), unknownAttemptCosts: z.number().int().nonnegative(),
    logicalAttempts: z.number().int().min(0).max(8), allowanceMicroUsd: z.number().int().max(12000000).nonnegative(),
    kind: z.literal('estimate_not_invoice') }).strict(),
  runtimeEligible: z.literal(false),
}).strict().superRefine((v, ctx) => {
  if ((v.phase === 'complete' && (!v.original || !v.edited || v.readings.length !== 3 ||
      new Set(v.readings.map(r => r.stage)).size !== 3)) ||
      (['queued', 'planning', 'synopsis_review', 'repairing'].includes(v.phase) && (v.original || v.edited))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'native_view_phase' });
  }
});
export type NativeBookView = z.infer<typeof nativeBookViewSchema>;
export function readNativeBookView(raw: unknown, requestId: string) {
  const parsed = nativeBookViewSchema.safeParse(raw);
  return parsed.success && parsed.data.requestId === requestId ? parsed.data : null;
}
/** A delayed queue acknowledgement must not replace a later completed view. */
export function newerNativeBookView(previous: NativeBookView | null, next: NativeBookView) {
  return previous?.requestId === next.requestId && previous.revision > next.revision ? previous : next;
}
