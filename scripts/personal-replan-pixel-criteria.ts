/**
 * PRE-REGISTERED scoring for the later two-image pixel proof under a re-planned (kind-enabled) storyboard. Offline code only: nothing
 * here is ever sent to a reviewer (no expected answers, no image labels). It re-derives every count from the raw review with the
 * engine's own assessment, so a saved status or summary is never trusted.
 *
 * Hard preconditions (any failure: UNUSABLE, never a result): exactly the mandatory binding checklist, every item true; the review parses,
 * binds and has complete landmark coverage with consistent objectIds (the engine's assessment refuses anything else); the engine's own
 * review policy holds (no invalid citation, no safety block: what it calls review_invalid / ineligible_safety); an explicit second-shrub
 * target binding (an objectId or null); the pre-registered landmarks, declared kinds and material features resolve uniquely.
 *
 * Outcomes are kept apart: preserved rock detection (defect image) and a clear control; CONFIRMED discrimination of THE bound second-shrub
 * target (that object, by its shared objectId, dismissed on a contradicted whole-object cue; dismissing any other object proves nothing)
 * versus inconclusive (no target bound, target absent, claimed as a landmark, or not examined) versus containment only (an uncertain hold)
 * versus a definite false duplicate; and a POSITIVE material observation (`matches`) versus inconclusive versus confusion.
 * The target is never inferred here (no wording or position rule): it is bound per image BEFORE scoring by an adjudicator who sees only the
 * review's object list (objectId, region, description), never its checks, associations or findings (SHRUB_TARGET_PROTOCOL).
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
/** The pre-registered second-shrub target and how it is bound (a protocol for the later run; nothing here reaches the reviewer). */
export const SHRUB_TARGET_PROTOCOL = Object.freeze({
  target: 'the background hedge: the continuous green shrub mass behind the garden that produced the earlier false thorn duplicate',
  binding: 'per image, before scoring, from the object list only (objectId, region, description); null when no listed object is that hedge',
  frozen: 'the binding is saved and hash-bound before the scorer runs; it is never revised after seeing results',
});
/** The binding checklist the later run's scorer computes by re-binding each wire request to its freeze. Exactly these, each true. */
export const REPLAN_PIXEL_BINDING_FIELDS = Object.freeze(['image', 'context', 'model', 'schema', 'instruction', 'text', 'imageOrder', 'noExpectationLeak',
  'completed', 'policy'] as const);

export type PixelImageInput = { raw: unknown; candidateSha: string; contextSha: string; requirementIds: readonly string[];
  landmarks: readonly AuditionLandmark[]; binding: Record<string, unknown>;
  /** Mandatory: the adjudicated second-shrub target for THIS image (see SHRUB_TARGET_PROTOCOL), or null when none could be bound. */
  shrubTarget: { objectId: string } | null };
type Assessed = ReturnType<typeof assessAuditionReview>;
export type RockOutcome = 'ROCK_DETECTED' | 'ROCK_DEGRADED' | 'ROCK_MISSED' | 'ROCK_CLEAR' | 'ROCK_FALSE_POSITIVE' | 'ROCK_NOT_FOUND';
export type ShrubOutcome = 'SHRUB_DISCRIMINATED_BY_KIND' | 'SHRUB_DISCRIMINATED_OTHER_CUE' | 'SHRUB_TARGET_UNBOUND' | 'SHRUB_TARGET_CLAIMED' |
  'SHRUB_TARGET_NOT_EXAMINED' | 'SHRUB_CLEAR_UNCONFIRMED' | 'SHRUB_UNCERTAIN' | 'SHRUB_FALSE_DEFECT';
export type MaterialOutcome = 'MATERIAL_OK' | 'MATERIAL_CONFUSED' | 'MATERIAL_INCONCLUSIVE';
export type ImageScore = { usable: false; reason: string } | { usable: true; rock: RockOutcome; shrub: ShrubOutcome; shrubEvidence: unknown;
  material: MaterialOutcome; materialReason: string | null; materialEvidence: unknown };

const feature = (landmarks: readonly AuditionLandmark[], landmarkId: string, match: (f: AuditionLandmark['features'][number]) => boolean) => {
  const found = landmarks.find(l => l.id === landmarkId)?.features.filter(match) ?? [];
  return found.length === 1 ? found[0] : null;
};

function preconditions(image: PixelImageInput): { ok: true; assessed: Assessed } | { ok: false; reason: string } {
  const binding = image.binding && typeof image.binding === 'object' && !Array.isArray(image.binding) ? image.binding : null;
  if (!binding) return { ok: false, reason: 'binding:none' };
  const fields: readonly string[] = REPLAN_PIXEL_BINDING_FIELDS, keys = Object.keys(binding);
  const missing = fields.filter(k => !keys.includes(k)), unknown = keys.filter(k => !fields.includes(k)), failed = fields.filter(k => keys.includes(k) && binding[k] !== true);
  if (missing.length) return { ok: false, reason: `binding:missing:${missing.join(',')}` };
  if (unknown.length) return { ok: false, reason: `binding:unknown:${unknown.join(',')}` };
  if (failed.length) return { ok: false, reason: `binding:${failed.join(',')}` };
  const target = image.shrubTarget as unknown;
  if (target !== null && !(target && typeof target === 'object' && !Array.isArray(target) && Object.keys(target).join() === 'objectId' &&
      typeof (target as { objectId: unknown }).objectId === 'string' && /^o[1-9][0-9]?$/.test((target as { objectId: string }).objectId)))
    return { ok: false, reason: 'target:malformed' };
  const t = REPLAN_PIXEL_TARGETS, m = t.material;
  for (const id of [t.rock, t.shrub, m.owner, m.entry]) if (!feature(image.landmarks, id, f => f.aspect === 'kind' && f.decisive)) return { ok: false, reason: `catalogue:${id}:kind` };
  for (const id of [m.owner, m.entry]) if (!feature(image.landmarks, id, f => f.aspect === m.aspect && f.text === m.text && f.decisive)) return { ok: false, reason: `catalogue:${id}:material` };
  let assessed: Assessed;
  try { assessed = assessAuditionReview(image.raw, image.candidateSha, image.contextSha, image.requirementIds, image.landmarks); }
  catch (error) { return { ok: false, reason: `review:${error && typeof error === 'object' && 'code' in error ? String(error.code) : 'invalid'}` }; }
  // The engine's own review policy (attemptStatus): a safety block or an invalid citation is never usable evidence, whatever else it says.
  if (assessed.assessment.safetyBlocked) return { ok: false, reason: 'review:safety_blocked' };
  if (assessed.assessment.invalidCitations) return { ok: false, reason: 'review:invalid_citations' };
  return { ok: true, assessed };
}

/**
 * A false duplicate of the shrub landmark (any object) fails; an uncertain one is containment. Otherwise only THE bound target counts: it must
 * be listed, not claimed as any landmark's own instance, examined in the shrub entry under its shared objectId, and dismissed there on a
 * contradicted whole-object cue (by the declared kind, or by another decisive cue). Dismissing any other object proves nothing.
 */
function shrub(image: PixelImageInput, { review, assessment }: Assessed): { outcome: ShrubOutcome; evidence: unknown } {
  const id = REPLAN_PIXEL_TARGETS.shrub, findings = assessment.findings.filter(f => f.requirement === `landmark_unique:${id}`);
  if (findings.some(f => f.verdict === 'defect')) return { outcome: 'SHRUB_FALSE_DEFECT', evidence: findings };
  if (findings.length) return { outcome: 'SHRUB_UNCERTAIN', evidence: findings };
  const target = image.shrubTarget, inventory = review.landmarkInventory!;
  if (!target || !inventory.objects.some(o => o.objectId === target.objectId)) return { outcome: 'SHRUB_TARGET_UNBOUND', evidence: { target } };
  const claimedBy = inventory.landmarks.filter(l => l.candidates.some(c => c.objectId === target.objectId && c.association === 'this_landmark'))
    .map(l => l.landmarkId);
  if (claimedBy.length) return { outcome: 'SHRUB_TARGET_CLAIMED', evidence: { target, claimedBy } };
  const c = assessment.landmarks!.find(l => l.landmarkId === id)!.candidates.find(x => x.objectId === target.objectId);
  if (!c) return { outcome: 'SHRUB_TARGET_NOT_EXAMINED', evidence: { target } };
  const kind = feature(image.landmarks, id, f => f.aspect === 'kind' && f.decisive)!;
  const evidence = { objectId: c.objectId, region: c.region, association: c.association, contradicted: c.contradictedCore, matched: c.matchedCore, evidence: c.evidence };
  if (c.association === 'different_object' && c.contradictedCore.includes(kind.id)) return { outcome: 'SHRUB_DISCRIMINATED_BY_KIND', evidence };
  if (c.association === 'different_object' && c.contradictedCore.length) return { outcome: 'SHRUB_DISCRIMINATED_OTHER_CUE', evidence };
  return { outcome: 'SHRUB_CLEAR_UNCONFIRMED', evidence };
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
