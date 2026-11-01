import { z } from 'zod';

export const COMPANION_SCALE_VERSION = 'companion-scale/v1' as const;
export const standingScaleSchema = z.object({ standingHeightInChildHeights: z.object({ min: z.number().finite().positive(), max: z.number().finite().positive() }).strict()
  .refine(r => r.min <= r.max, 'inverted standing-height range') }).strict();
export type StandingScale = z.infer<typeof standingScaleSchema>;
export type CompanionScaleAuthority = { version: typeof COMPANION_SCALE_VERSION; companionId: string; scale: StandingScale };
export const companionScaleAuthoritySchema = z.object({version:z.literal(COMPANION_SCALE_VERSION),companionId:z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),scale:standingScaleSchema}).strict();
export function validateCompanionScale(authority: CompanionScaleAuthority, proposed: number) {
  const range = companionScaleAuthoritySchema.parse(authority).scale.standingHeightInChildHeights;
  if (!Number.isFinite(proposed) || proposed < range.min || proposed > range.max) throw Error('personal_storyboard_companion_scale');
}
export const scaleEvidenceSchema = z.object({ comparable: z.boolean(), reason: z.enum(['same_plane_standing','different_depth','not_standing','airborne','occluded']),
  estimatedRatio: z.number().finite().positive().nullable() }).strict().superRefine((e, ctx) => {
    if (e.comparable !== (e.reason === 'same_plane_standing') || e.comparable !== (e.estimatedRatio !== null))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Comparable evidence requires a same-ground natural standing comparison and a measured ratio; abstention requires null.' });
  });
export type ScaleEvidence = z.infer<typeof scaleEvidenceSchema>;
export function assessCompanionScale(raw: unknown, authority: CompanionScaleAuthority) {
  const evidence = scaleEvidenceSchema.parse(raw), range = companionScaleAuthoritySchema.parse(authority).scale.standingHeightInChildHeights;
  return { evidence, disposition: !evidence.comparable ? 'abstain' as const : evidence.estimatedRatio! < range.min || evidence.estimatedRatio! > range.max
    ? 'defect' as const : 'pass' as const };
}
export function scaleCoverage(evidence: readonly ReturnType<typeof assessCompanionScale>[]) {
  return evidence.some(e => e.disposition === 'defect') ? 'defect' as const : evidence.some(e => e.disposition === 'pass') ? 'observed_within_range' as const : 'unverified' as const;
}
export const SCALE_STORYBOARD_ADDENDUM = `COMPANION SCALE CONTRACT: use the supplied companionScale authority. Choose
companionStandingHeightInChildHeights inside its inclusive min/max. This is the companion's OWN natural standing pose and geometry from
its admitted views, relative to the child's standing height; a quadruped stands on four legs, never forced upright like a human. No
universal ratio. Scale is compared only on the same ground plane at comparable depth. Keep action-pose identity and relative-scale checks.`;
export const SCALE_REVIEW_ADDENDUM = `COMPANION SCALE CONTRACT REVIEW: Verify the supplied companionScale authority and
the proposed companionStandingHeightInChildHeights against its inclusive min/max. Do not choose or invent a replacement ratio. Check
the companion's OWN admitted natural standing geometry and compare only same-ground, comparable-depth standing poses; never force a
quadruped upright. Preserve action-pose identity and relative-scale checks. Missing or unsupported authority cannot be inferred.`;
export const SCALE_IMAGE_RULES = `COMPANION SCALE CONTRACT: return scaleEvidence {comparable,reason,estimatedRatio}. Comparable means
the child and companion are on the same ground plane at comparable depth, each in its natural standing pose. Only then use reason
same_plane_standing and a finite positive ratio of companion height to child height. Compare with context.companionScale.scale.
Otherwise comparable=false, estimatedRatio=null, reason different_depth/not_standing/airborne/occluded: this is ABSTENTION, never a scale
pass or a size defect. Record it as coverage evidence; do not create a standing-scale issue merely because the frame is incomparable.
Keep all existing identity and relative_scale checks for action poses. A quadruped is never measured upright.
An entire book of abstentions is scale unverified, never scale passed. Do not infer missing measurements from the requested ratio.`;

export const SCALE_RENDER_RULES = 'COMPANION SCALE CONTRACT: keep the approved companion in its OWN natural standing geometry and height range relative to the child, as in the admitted views. Keep the planned action and camera: do not force a quadruped upright or an airborne actor into a standing pose. Perspective and depth change apparent height; preserve the character design. Do not draw measuring bars, labels, JSON or QA evidence.';
export function companionScaleFromContext(context: unknown): CompanionScaleAuthority | undefined {
  if (!context || typeof context!=='object' || !('companionScale' in context)) return undefined;
  return companionScaleAuthoritySchema.parse(context.companionScale);
}
export function withCompanionScaleReview<T extends z.AnyZodObject>(schema: T, authority?: CompanionScaleAuthority): T {
  return authority ? schema.extend({scaleEvidence:scaleEvidenceSchema}) as unknown as T : schema;
}
export function scaleRenderAppendix(context:unknown) {
  const scale=companionScaleFromContext(context);
  return scale ? '\n'+SCALE_RENDER_RULES+'\nAPPROVED NATURAL STANDING SCALE (data, not text to paint): '+JSON.stringify(scale) : '';
}
