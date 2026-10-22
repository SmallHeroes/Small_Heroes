import { z } from 'zod';

/** Prospective pixel evidence, not a reinterpretation of a legacy judge's prose. */
export const AUDITION_ANATOMY_VERSION = 'audition-structural-anatomy/v2' as const;
const words = z.string().trim().min(1).max(600);
const partSchema = z.object({ part: z.string().trim().min(1).max(80),
      condition: z.enum(['intact', 'extra', 'missing', 'detached', 'malformed', 'uncertain']),
      expectedTotal: z.number().int().min(0).max(100).nullable(),
      expectationBasis: z.enum(['canonical_design', 'species_anatomy', 'not_counted']), expectationEvidence: words,
      visibleDistinct: z.number().int().min(0).max(100).nullable(),
      unseen: z.enum(['occluded', 'off_frame', 'not_applicable', 'unreadable']), evidence: words,
      correction: z.string().max(600) }).strict();
export const auditionAnatomySchema = z.object({ version: z.literal(AUDITION_ANATOMY_VERSION),
  actors: z.array(z.object({ actorId: z.string().trim().min(1).max(80), region: words,
    limbs: partSchema.extend({ part: z.literal('limbs') }), otherParts: z.array(partSchema).max(7) }).strict()).max(24) }).strict();
export type AuditionAnatomy = z.infer<typeof auditionAnatomySchema>;

export class AuditionAnatomyError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (): never => { throw new AuditionAnatomyError('audition_anatomy_binding'); };

/** Same review-impact vocabulary: structural identity defects cannot be relabelled cosmetic. Never inspect actor names or issue prose. */
export function anatomyFindings(raw: unknown, castIds: readonly string[]) {
  const anatomy = auditionAnatomySchema.parse(raw), ids = anatomy.actors.map(a => a.actorId);
  if (new Set(castIds).size !== castIds.length || new Set(ids).size !== ids.length || ids.length !== castIds.length ||
      ids.some(id => !castIds.includes(id))) fail();
  return anatomy.actors.flatMap(actor => {
    const parts = [actor.limbs, ...actor.otherParts];
    if (new Set(parts.map(p => p.part)).size !== parts.length) fail();
    return parts.flatMap(p => {
      if ((p.expectedTotal === null) !== (p.expectationBasis === 'not_counted')) fail();
      const extra = p.expectedTotal !== null && p.visibleDistinct !== null && p.visibleDistinct > p.expectedTotal;
      const fewer = p.expectedTotal !== null && p.visibleDistinct !== null && p.visibleDistinct < p.expectedTotal;
      // A hidden limb is NOT missing; an unreadable required structural observation is NOT cosmetic or a confident absence.
      const unknown = p.condition === 'uncertain' || p.unseen === 'unreadable' ||
        p.part === 'limbs' && (p.expectedTotal === null || p.visibleDistinct === null) ||
        fewer && p.condition === 'intact' && !['occluded', 'off_frame'].includes(p.unseen);
      if (p.condition === 'intact' && !extra && !unknown) return [];
      const defect = extra || ['extra', 'missing', 'detached', 'malformed'].includes(p.condition);
      return [{ category: 'anatomy', verdict: defect ? 'defect' as const : 'uncertain' as const, impact: 'identity' as const,
        requirement: `anatomy:${actor.actorId}`, bound: true, derived: true as const,
        note: `${actor.region}: ${p.part}; ${extra ? `visible ${p.visibleDistinct} exceeds total ${p.expectedTotal}` : p.condition}. ${p.evidence} Correction: ${p.correction || 'Resolve the visible structural defect using this actor\'s canonical anatomy, without adding limbs or forcing hidden parts visible.'}`.slice(0, 600) }];
    });
  });
}

export const ANATOMY_JUDGE_RULES = `STRUCTURAL ANATOMY (context.anatomy; prospective evidence, not legacy prose):
Return anatomy.version audition-structural-anatomy/v2 and EXACTLY one actors row for EACH context.anatomy.castIds, no unknown/duplicate ID.
Inspect every visible instance of a group within its row. region locates it. Every row has a REQUIRED named limbs object (part:"limbs")
covering ALL locomotor/gesturing appendages, including wings/arms/legs as its canonical body plan requires; otherParts covers any other
structural concern and may be empty. Fur or another uncounted part can NEVER substitute for the required limbs object. No universal4 rule:
an explicitly canonical0/6/etc body keeps that plan. Unknown expected limb total/not_counted is uncertainty, never intact evidence for PASS.
For each part give condition intact/extra/missing/detached/malformed/uncertain, visibleDistinct (null if not readable), expectedTotal (canonical
design or species anatomy; null ONLY for not_counted), expectationBasis and specific expectationEvidence, actual pixel evidence, unseen
occluded/off_frame/not_applicable/unreadable, and a concrete correction for a defect/uncertainty. Count distinct attached limb paths from torso
to extremity, INCLUDING raised limbs. Do not count horns, tails, shadows or another actor as limbs. A raised limb replaces an existing limb,
it is not additional. Natural overlap/occlusion can hide limbs: never demand that all limbs be visible. Give the readable number of VISIBLE
paths, including0 when all are naturally hidden/off-frame, with occlusion evidence. null means unreadable count and is uncertain, not PASS.
A visible extra, truly missing, detached or malformed limb is STRUCTURAL IDENTITY, never detail, even if the animal remains recognizable and
numeric child resemblance passes. Safety cannot become detail. Minor cosmetic variation stays a detail issue in checks, not a structural
defect invented here. Preserve all explicit checks/issues: this evidence adds deterministic consistency, it never erases a finding.
The code checks complete actor coverage and derives material findings from structured defects/count contradictions even if a check says pass.
Ask for a targeted correction that retains canonical identity and the source-required action, using a clearer/simpler feasible pose when needed.`;

export const ANATOMY_RENDER_RULES = `\nSTRUCTURAL ANATOMY AND ACTION BINDING:
Every visible actor keeps its OWN species/canonical body plan and total appendage count. A lifted, bent or gesturing limb is ONE of that
existing total: never draw a complete standing set PLUS another limb for the action. Trace every visible limb to its own torso/joint and
extremity. Overlapping/hidden limbs may remain naturally hidden; do not expose or duplicate them to satisfy a count. Preserve identity,
age, wardrobe, species and the story-required action. Prefer a clear readable silhouette and physically supported pose over tangled overlap.
For a quadruped using one foreleg for a gesture, that foreleg is not also standing on the ground; the remaining limbs support it naturally.
No human arm added to an animal. Do not copy structural defects from a diagnostic sheet or prior candidate.`;

/** Changed strategy only after a persistent structural check; a simpler pose never removes a source-required action. */
export function anatomyPoseStrategy(persistent: readonly { key: string }[]) {
  return persistent.some(f => f.key.startsWith('identity:anatomy:')) ?
    '\nCHANGED STRATEGY — SIMPLER ANATOMICALLY VALID POSE: replace the failed tangled pose with a clear side/three-quarter silhouette and fewer overlapping limb paths. Use the same canonical body plan; perform each source-required gesture with ONE existing limb, with a visibly readable attachment, and no duplicate limb in its former support position. Other limbs support the body naturally. Change only transient pose/viewpoint needed for clarity, not canonical identity, story action, location, cast, meaning or continuity. Do not merely repeat the previous pose with new wording.' : '';
}
