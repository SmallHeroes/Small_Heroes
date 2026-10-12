/**
 * PRE-REGISTERED scoring for the later two-image pixel proof under a re-planned (kind-enabled) storyboard. Offline code only: nothing
 * here is ever sent to a reviewer (no expected answers, no image labels). It re-derives every count from the raw review with the
 * engine's own assessment, so a saved status or summary is never trusted.
 *
 * Hard preconditions (any failure: UNUSABLE, never a result): every wire/freeze binding check true; the review parses, binds and has complete
 * landmark coverage with consistent objectIds (the engine's assessment refuses anything else); the pre-registered landmarks, their declared
 * kinds and the material features resolve uniquely in the catalogue.
 *
 * Outcomes are kept apart: preserved rock detection (defect image) and a clear control; CONFIRMED discrimination of a second shrub (a
 * candidate dismissed on a contradicted whole-object cue) versus containment only (an uncertain hold) versus a definite false duplicate;
 * and a POSITIVE material observation (`matches`) versus an inconclusive one (hidden, missing or not examined) versus confusion.
 * The page-7 companion identity is NOT part of this pair and stays an open, separately reported issue.
 */
import { assessAuditionReview, type AuditionLandmark } from '../lib/personal-wizard/simple-book-reviewed-audition';

export const REPLAN_PIXEL_CRITERIA_VERSION = 'replan-pixel-criteria/v1' as const;
export const REPLAN_PIXEL_TARGETS = Object.freeze({
  rock: 'rock_landmark',
  shrub: 'thorn_landmark',
  material: Object.freeze({ owner: 'swing_landmark', entry: 'bench_landmark', aspect: 'material' as const, text: 'wooden' }),
  outOfScope: Object.freeze(['page 7 companion identity (nose): not in this pair, reported separately']),
});

export type PixelImageInput = { raw: unknown; candidateSha: string; contextSha: string; requirementIds: readonly string[];
  landmarks: readonly AuditionLandmark[]; binding: Record<string, boolean> };
type Assessed = ReturnType<typeof assessAuditionReview>;
export type RockOutcome = 'ROCK_DETECTED' | 'ROCK_DEGRADED' | 'ROCK_MISSED' | 'ROCK_CLEAR' | 'ROCK_FALSE_POSITIVE' | 'ROCK_NOT_FOUND';
export type ShrubOutcome = 'SHRUB_DISCRIMINATED_BY_KIND' | 'SHRUB_DISCRIMINATED_OTHER_CUE' | 'SHRUB_CLEAR_UNCONFIRMED' | 'SHRUB_UNCERTAIN' | 'SHRUB_FALSE_DEFECT';
export type MaterialOutcome = 'MATERIAL_OK' | 'MATERIAL_CONFUSED' | 'MATERIAL_INCONCLUSIVE';
export type ImageScore = { usable: false; reason: string } | { usable: true; rock: RockOutcome; shrub: ShrubOutcome; shrubEvidence: unknown;
  material: MaterialOutcome; materialReason: string | null; materialEvidence: unknown };

const feature = (landmarks: readonly AuditionLandmark[], landmarkId: string, match: (f: AuditionLandmark['features'][number]) => boolean) => {
  const found = landmarks.find(l => l.id === landmarkId)?.features.filter(match) ?? [];
  return found.length === 1 ? found[0] : null;
};

function preconditions(image: PixelImageInput): { ok: true; assessed: Assessed } | { ok: false; reason: string } {
  const failed = Object.entries(image.binding).filter(([, ok]) => ok !== true).map(([name]) => name);
  if (!Object.keys(image.binding).length) return { ok: false, reason: 'binding:none' };
  if (failed.length) return { ok: false, reason: `binding:${failed.join(',')}` };
  const t = REPLAN_PIXEL_TARGETS, m = t.material;
  for (const id of [t.rock, t.shrub, m.owner, m.entry]) if (!feature(image.landmarks, id, f => f.aspect === 'kind' && f.decisive)) return { ok: false, reason: `catalogue:${id}:kind` };
  for (const id of [m.owner, m.entry]) if (!feature(image.landmarks, id, f => f.aspect === m.aspect && f.text === m.text && f.decisive)) return { ok: false, reason: `catalogue:${id}:material` };
  try { return { ok: true, assessed: assessAuditionReview(image.raw, image.candidateSha, image.contextSha, image.requirementIds, image.landmarks) }; }
  catch (error) { return { ok: false, reason: `review:${error && typeof error === 'object' && 'code' in error ? String(error.code) : 'invalid'}` }; }
}

function shrub(image: PixelImageInput, { assessment }: Assessed): { outcome: ShrubOutcome; evidence: unknown } {
  const id = REPLAN_PIXEL_TARGETS.shrub, findings = assessment.findings.filter(f => f.requirement === `landmark_unique:${id}`);
  if (findings.some(f => f.verdict === 'defect')) return { outcome: 'SHRUB_FALSE_DEFECT', evidence: findings };
  if (findings.length) return { outcome: 'SHRUB_UNCERTAIN', evidence: findings };
  const kind = feature(image.landmarks, id, f => f.aspect === 'kind' && f.decisive)!;
  const dismissed = assessment.landmarks!.find(l => l.landmarkId === id)!.candidates.filter(c => c.association === 'different_object' && c.contradictedCore.length);
  const evidence = dismissed.map(c => ({ objectId: c.objectId, region: c.region, contradicted: c.contradictedCore, evidence: c.evidence }));
  return { outcome: dismissed.some(c => c.contradictedCore.includes(kind.id)) ? 'SHRUB_DISCRIMINATED_BY_KIND'
    : dismissed.length ? 'SHRUB_DISCRIMINATED_OTHER_CUE' : 'SHRUB_CLEAR_UNCONFIRMED', evidence };
}

/** Positive evidence only: the owner's OWN wood cue must be seen (`matches`) on the one object it claims, and the entry must judge that same objectId's wood. */
function material(image: PixelImageInput, { review }: Assessed): { outcome: MaterialOutcome; reason: string | null; evidence: unknown } {
  const m = REPLAN_PIXEL_TARGETS.material, inventory = review.landmarkInventory!;
  const ownerWood = feature(image.landmarks, m.owner, f => f.aspect === m.aspect && f.text === m.text && f.decisive)!;
  const entryWood = feature(image.landmarks, m.entry, f => f.aspect === m.aspect && f.text === m.text && f.decisive)!;
  const own = inventory.landmarks.find(l => l.landmarkId === m.owner)!.candidates.filter(c => c.association === 'this_landmark');
  if (own.length !== 1) return { outcome: 'MATERIAL_INCONCLUSIVE', reason: 'owner_not_identified', evidence: own };
  const objectId = own[0].objectId, ownObserved = own[0].featureChecks.find(c => c.featureId === ownerWood.id)?.observed;
  if (ownObserved !== 'matches') return { outcome: 'MATERIAL_INCONCLUSIVE', reason: 'wood_not_observed_on_owner', evidence: { objectId, ownObserved } };
  const there = inventory.landmarks.find(l => l.landmarkId === m.entry)!.candidates.find(c => c.objectId === objectId);
  if (!there) return { outcome: 'MATERIAL_INCONCLUSIVE', reason: 'owner_not_examined_in_entry', evidence: { objectId } };
  const observed = there.featureChecks.find(c => c.featureId === entryWood.id)?.observed;
  const evidence = { objectId, association: there.association, observed, checks: there.featureChecks, note: there.evidence };
  return observed === 'matches' ? { outcome: 'MATERIAL_OK', reason: null, evidence }
    : observed === 'contradicted' ? { outcome: 'MATERIAL_CONFUSED', reason: 'visible_wood_contradicted', evidence }
    : { outcome: 'MATERIAL_INCONCLUSIVE', reason: 'inconsistent_visibility', evidence };
}

export function scoreReplanPixelImage(image: PixelImageInput, role: 'defect' | 'control'): ImageScore {
  const ready = preconditions(image);
  if (!ready.ok) return { usable: false, reason: ready.reason };
  const { assessment } = ready.assessed, rockId = REPLAN_PIXEL_TARGETS.rock;
  const rockFindings = assessment.findings.filter(f => f.requirement === `landmark_unique:${rockId}`), derived = rockFindings.filter(f => f.derived);
  const instances = assessment.landmarks!.find(l => l.landmarkId === rockId)!.instances;
  const rock: RockOutcome = role === 'defect'
    ? derived.some(f => f.verdict === 'defect') ? 'ROCK_DETECTED' : derived.length ? 'ROCK_DEGRADED' : 'ROCK_MISSED'
    : rockFindings.length ? 'ROCK_FALSE_POSITIVE' : instances === 1 ? 'ROCK_CLEAR' : 'ROCK_NOT_FOUND';
  const s = shrub(image, ready.assessed), mat = material(image, ready.assessed);
  return { usable: true, rock, shrub: s.outcome, shrubEvidence: s.evidence, material: mat.outcome, materialReason: mat.reason, materialEvidence: mat.evidence };
}

/**
 * UNUSABLE: a precondition failed for either image. FAILED: the defect image's duplicate rock is not detected as a definite defect, the control
 * gets a rock finding, either image gets a definite false shrub duplicate, or visible wood is contradicted. CONFIRMED: rock detected and
 * control clear, the second shrub positively discriminated on the defect image, and the control's wood positively observed. Anything
 * else is PARTIAL (containment or inconclusive evidence, not proof).
 */
export function scoreReplanPixelPair(input: { defect: PixelImageInput; control: PixelImageInput }) {
  const defect = scoreReplanPixelImage(input.defect, 'defect'), control = scoreReplanPixelImage(input.control, 'control');
  const base = { version: REPLAN_PIXEL_CRITERIA_VERSION, targets: REPLAN_PIXEL_TARGETS, defect, control };
  if (!defect.usable || !control.usable) return { ...base, verdict: 'UNUSABLE' as const, failures: [], kindDiscriminationConfirmed: false };
  const failures = [
    ...(defect.rock !== 'ROCK_DETECTED' ? [`defect:${defect.rock}`] : []),
    ...(control.rock === 'ROCK_FALSE_POSITIVE' ? ['control:ROCK_FALSE_POSITIVE'] : []),
    ...[['defect', defect], ['control', control]].flatMap(([role, s]) => (s as typeof defect).shrub === 'SHRUB_FALSE_DEFECT' ? [`${role}:SHRUB_FALSE_DEFECT`] : []),
    ...[['defect', defect], ['control', control]].flatMap(([role, s]) => (s as typeof defect).material === 'MATERIAL_CONFUSED' ? [`${role}:MATERIAL_CONFUSED`] : []),
  ];
  const confirmed = !failures.length && control.rock === 'ROCK_CLEAR' && control.material === 'MATERIAL_OK' &&
    (defect.shrub === 'SHRUB_DISCRIMINATED_BY_KIND' || defect.shrub === 'SHRUB_DISCRIMINATED_OTHER_CUE');
  return { ...base, verdict: failures.length ? 'FAILED' as const : confirmed ? 'CONFIRMED' as const : 'PARTIAL' as const, failures,
    kindDiscriminationConfirmed: !failures.length && defect.shrub === 'SHRUB_DISCRIMINATED_BY_KIND' };
}
