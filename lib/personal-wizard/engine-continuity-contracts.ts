import { z } from 'zod';
/** Prospective engine contracts only; existing sources/grants have no such field. */
export const engineContinuityOptionsSchema = z.object({ materialFunction: z.literal(true).optional(), companionScale: z.literal(true).optional() }).strict().refine(v => Object.keys(v).length > 0);
export type EngineContinuityOptions = z.infer<typeof engineContinuityOptionsSchema>;
export function assertEngineContinuityOptions(value: unknown, instances?: true): EngineContinuityOptions | undefined {
  if (value === undefined) return undefined;
  const p=engineContinuityOptionsSchema.safeParse(value);
  if (!p.success || p.data.materialFunction && instances !== true) throw Error('personal_storyboard_engine_continuity_policy');
  return p.data;
}
