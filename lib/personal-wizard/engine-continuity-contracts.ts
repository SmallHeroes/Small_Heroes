import { z } from 'zod';
/** Prospective engine contracts only; existing sources/grants have no such field. */
export const engineContinuityOptionsSchema = z.object({ materialFunction: z.literal(true).optional(), companionScale: z.literal(true).optional(),
  sourceConcurrency:z.literal(true).optional(), sceneRelations:z.literal(true).optional() }).strict().refine(v => Object.keys(v).length > 0);
export type EngineContinuityOptions = z.infer<typeof engineContinuityOptionsSchema>;
/** Prospective native binding only: no cycle, grant, paid allowance or historical upgrade. */
export const NATIVE_BOOK_CONTINUITY_VERSION = 'native-book-continuity/v1' as const;
export const nativeBookContinuitySchema = z.object({version:z.literal(NATIVE_BOOK_CONTINUITY_VERSION),
  sample:z.array(z.number().int().min(1).max(8)).min(1).max(2).refine(a=>a.every((n,i)=>i===0||n>a[i-1]),'sample must be distinct and ascending')}).strict();
/** The whole native book names no sample: every frame is drawn. Accepted only by the contracts below, never by a sampled trial. */
export const nativeWholeBookContinuitySchema = z.object({version:z.literal(NATIVE_BOOK_CONTINUITY_VERSION),wholeBook:z.literal(true)}).strict();
export type NativeBookContinuity = z.infer<typeof nativeBookContinuitySchema>|z.infer<typeof nativeWholeBookContinuitySchema>;
/** Explicit caller authority, never inferred from a saved marker. All three contracts travel together in the native mode. */
export const storyboardContinuityAdmissionSchema = z.object({instanceDistinctionContract:z.literal(true),
  engineContinuity:z.object({materialFunction:z.literal(true),companionScale:z.literal(true),sourceConcurrency:z.literal(true).optional()}).strict()}).strict();
export type StoryboardContinuityAdmission = z.infer<typeof storyboardContinuityAdmissionSchema>;
export function nativeBookContinuityContracts(value?: NativeBookContinuity): StoryboardContinuityAdmission | undefined {
  if(value===undefined)return undefined;
  if('wholeBook' in value)nativeWholeBookContinuitySchema.parse(value);else nativeBookContinuitySchema.parse(value);
  return {instanceDistinctionContract:true,engineContinuity:{materialFunction:true,companionScale:true}};
}
export function assertEngineContinuityOptions(value: unknown, instances?: true): EngineContinuityOptions | undefined {
  if (value === undefined) return undefined;
  const p=engineContinuityOptionsSchema.safeParse(value);
  if (!p.success || p.data.materialFunction && instances !== true) throw Error('personal_storyboard_engine_continuity_policy');
  return p.data;
}
