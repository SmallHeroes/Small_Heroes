import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { landmarkFeatureCatalogue, AUDITION_JUDGE_INSTRUCTIONS, type AuditionLandmark } from '../simple-book-reviewed-audition';
import { scoreReplanPixelImage, scoreReplanPixelPair, REPLAN_PIXEL_TARGETS, type PixelImageInput } from '../../../scripts/personal-replan-pixel-criteria';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
// The real Goni landmark designs plus the kinds a kind-enabled re-plan would declare (the catalogue code is the engine's own).
const DESIGNS: Record<string, [string, string]> = {
  tree_landmark: ['tree', 'Broad rounded green canopy, forked warm-gray trunk, standing on the left lawn.'],
  bench_landmark: ['bench', 'Three wooden seat slats, three back slats and two dark iron supports; behind the tree.'],
  swing_landmark: ['swing', 'Single rectangular wooden seat on two cream ropes, supported by a separate wooden frame on the right lawn.'],
  thorn_landmark: ['thorn bush', 'Low dusty-green thorn bush beside the path before the rock, with a forked outward-facing twig.'],
  rock_landmark: ['rock', 'Large pale-gray rounded rock with one diagonal ochre seam and a low burrow opening beneath its front lip; rear right of garden.'],
};
const catalogue = (kindContract = true): AuditionLandmark[] => Object.entries(DESIGNS).map(([id, [kind, value]]) => ({ id,
  features: landmarkFeatureCatalogue([{ attribute: 'design', value }, ...(kindContract ? [{ attribute: 'kind', value: kind }] : [])], kindContract) }));
type Seen = Record<string, 'matches' | 'contradicted' | 'not_visible'>;
const key = (f: AuditionLandmark['features'][number]) => `${f.decisive ? '+' : '~'}${f.aspect}:${f.text}`;
const cand = (landmarks: AuditionLandmark[], landmarkId: string, objectId: string, association: string, seen: Seen = {}) => ({ objectId, association,
  evidence: `${objectId} as seen`, featureChecks: landmarks.find(l => l.id === landmarkId)!.features.map(f => ({ featureId: f.id, observed: seen[key(f)] ?? 'matches' })) });
const OBJECTS = [['o1', 'tree, left lawn'], ['o2', 'bench behind the tree'], ['o3', 'swing, right lawn'], ['o4', 'low bush by the path'], ['o5', 'big rock, rear right'],
  ['o6', 'second big rock, front left'], ['o7', 'tall hedge along the back']] as const;

type Scene = { rockCopy?: Seen | null; hedge?: Record<string, string> | null; swingOwn?: Seen; swingInBench?: Seen | null; drop?: (inv: any) => void };
function image(scene: Scene, landmarks = catalogue(), binding: Record<string, boolean> = { wire: true, freeze: true, noLeak: true }): PixelImageInput {
  const L = (id: string, objectId: string, association: string, seen?: Seen) => cand(landmarks, id, objectId, association, seen);
  const { association: hedgeAssociation = 'different_object', ...hedgeSeen } = scene.hedge ?? {};
  const entries: Record<string, unknown[]> = {
    tree_landmark: [L('tree_landmark', 'o1', 'this_landmark')],
    bench_landmark: [L('bench_landmark', 'o2', 'this_landmark'),
      ...(scene.swingInBench === null ? [] : [L('bench_landmark', 'o3', 'different_object', scene.swingInBench ?? { '+kind:bench': 'contradicted' })])],
    swing_landmark: [L('swing_landmark', 'o3', 'this_landmark', scene.swingOwn)],
    thorn_landmark: [L('thorn_landmark', 'o4', 'this_landmark'), ...(scene.hedge ? [L('thorn_landmark', 'o7', hedgeAssociation, hedgeSeen as Seen)] : [])],
    rock_landmark: [L('rock_landmark', 'o5', 'this_landmark'), ...(scene.rockCopy ? [L('rock_landmark', 'o6', 'possible_copy', scene.rockCopy)] : [])],
  };
  const inventory = { objects: OBJECTS.map(([objectId, region]) => ({ objectId, region, description: region })),
    landmarks: landmarks.map(l => ({ landmarkId: l.id, candidates: entries[l.id] })) };
  scene.drop?.(inventory);
  const raw = { candidateSha: sha('img'), contextSha: sha('ctx'), landmarkInventory: inventory,
    checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] })) };
  return { raw, candidateSha: sha('img'), contextSha: sha('ctx'), requirementIds: landmarks.map(l => `landmark_unique:${l.id}`), landmarks, binding };
}
const STRONG_COPY: Seen = {}; // every rock cue seen: a definite second rock
const ok = (s: ReturnType<typeof scoreReplanPixelImage>) => { if (!s.usable) throw Error(`unusable: ${s.reason}`); return s; };

describe('pre-registered pixel criteria for the re-plan pair (QA F2)', () => {
  it('uses the real catalogue: the declared kind is decisive, and the swing and bench share one decisive wood cue', () => {
    const c = catalogue(), f = (id: string) => c.find(l => l.id === id)!.features.map(key);
    expect(f('swing_landmark')).toEqual(['+kind:swing', '+shape:rectangular', '+material:wooden', '~colour:cream', '~material:wooden']);
    expect(f('bench_landmark')).toEqual(['+kind:bench', '+material:wooden', '~colour:dark', '~material:iron']);
    expect(f('thorn_landmark')).toEqual(['+kind:thorn bush', '+size:low', '+colour:dusty-green', '~shape:forked']);
    // Nothing the scorer knows is ever reviewer text.
    for (const word of ['ROCK_DETECTED', 'SHRUB_', 'MATERIAL_OK', 'CONFIRMED', REPLAN_PIXEL_TARGETS.material.entry]) expect(AUDITION_JUDGE_INSTRUCTIONS.page).not.toContain(word);
  });

  it('rock: a definite derived copy is DETECTED; an uncertain one is DEGRADED; none is MISSED; the control must be clear', () => {
    expect(ok(scoreReplanPixelImage(image({ rockCopy: STRONG_COPY }), 'defect')).rock).toBe('ROCK_DETECTED');
    expect(ok(scoreReplanPixelImage(image({ rockCopy: { '+kind:rock': 'not_visible', '+colour:pale-gray': 'not_visible', '+shape:rounded': 'not_visible' } }), 'defect')).rock)
      .toBe('ROCK_DEGRADED');
    expect(ok(scoreReplanPixelImage(image({}), 'defect')).rock).toBe('ROCK_MISSED');
    expect(ok(scoreReplanPixelImage(image({}), 'control')).rock).toBe('ROCK_CLEAR');
    expect(ok(scoreReplanPixelImage(image({ rockCopy: STRONG_COPY }), 'control')).rock).toBe('ROCK_FALSE_POSITIVE');
    expect(ok(scoreReplanPixelImage(image({ drop: inv => { inv.landmarks.find((l: any) => l.landmarkId === 'rock_landmark').candidates = []; } }), 'control')).rock)
      .toBe('ROCK_NOT_FOUND');
  });

  it('second shrub: confirmed discrimination, containment and a definite false duplicate are different outcomes', () => {
    const shrubOf = (hedge: Scene['hedge']) => ok(scoreReplanPixelImage(image({ rockCopy: STRONG_COPY, hedge }), 'defect')).shrub;
    expect(shrubOf({ '+kind:thorn bush': 'contradicted' })).toBe('SHRUB_DISCRIMINATED_BY_KIND');
    expect(shrubOf({ '+kind:thorn bush': 'not_visible', '+size:low': 'contradicted' })).toBe('SHRUB_DISCRIMINATED_OTHER_CUE');
    expect(shrubOf(null)).toBe('SHRUB_CLEAR_UNCONFIRMED');
    // rejudge-3's hedge: kind unreadable, "low" and "dusty-green" seen as matching: a definite (false) duplicate.
    expect(shrubOf({ association: 'possible_copy', '+kind:thorn bush': 'not_visible', '~shape:forked': 'not_visible' })).toBe('SHRUB_FALSE_DEFECT');
    // One supporting aspect only: an uncertain hold (fail-closed containment, NOT proof the false alarm is solved).
    expect(shrubOf({ association: 'possible_copy', '+kind:thorn bush': 'not_visible', '+colour:dusty-green': 'not_visible', '~shape:forked': 'not_visible' }))
      .toBe('SHRUB_UNCERTAIN');
    // "different_object" without a contradicted whole-object cue is reclassified as a possible copy, never a dismissal.
    expect(shrubOf({ '+kind:thorn bush': 'not_visible', '~shape:forked': 'contradicted' })).toBe('SHRUB_FALSE_DEFECT');
  });

  it('material: only a positive "matches" on the SAME objectId counts; hidden, missing or unexamined wood is inconclusive', () => {
    const mat = (scene: Scene) => { const s = ok(scoreReplanPixelImage(image(scene), 'control')); return [s.material, s.materialReason]; };
    expect(mat({})).toEqual(['MATERIAL_OK', null]);
    expect(mat({ swingInBench: { '+kind:bench': 'contradicted', '+material:wooden': 'contradicted' } })).toEqual(['MATERIAL_CONFUSED', 'visible_wood_contradicted']);
    expect(mat({ swingOwn: { '+material:wooden': 'not_visible', '+shape:rectangular': 'not_visible' } })).toEqual(['MATERIAL_INCONCLUSIVE', 'wood_not_observed_on_owner']);
    expect(mat({ swingInBench: null })).toEqual(['MATERIAL_INCONCLUSIVE', 'owner_not_examined_in_entry']);
    expect(mat({ swingInBench: { '+kind:bench': 'contradicted', '+material:wooden': 'not_visible' } })).toEqual(['MATERIAL_INCONCLUSIVE', 'inconsistent_visibility']);
    expect(mat({ drop: inv => { inv.landmarks.find((l: any) => l.landmarkId === 'swing_landmark').candidates[0].association = 'possible_copy'; } }))
      .toEqual(['MATERIAL_INCONCLUSIVE', 'owner_not_identified']);
  });

  it('hard preconditions: binding, schema, complete coverage, consistent objectIds and the declared kinds, or UNUSABLE', () => {
    const reason = (input: PixelImageInput) => { const s = scoreReplanPixelImage(input, 'control'); return s.usable ? 'usable' : s.reason; };
    expect(reason(image({}, catalogue(), { wire: true, noLeak: false }))).toBe('binding:noLeak');
    expect(reason(image({}, catalogue(), {}))).toBe('binding:none');
    expect(reason(image({}, catalogue(false)))).toBe('catalogue:rock_landmark:kind');
    expect(reason(image({ drop: inv => { inv.landmarks[0].candidates[0].featureChecks.pop(); } }))).toBe('review:audition_review_landmark_inventory');
    expect(reason(image({ drop: inv => { inv.landmarks[0].candidates[0].objectId = 'o9'; } }))).toBe('review:audition_review_landmark_inventory');
    expect(reason(image({ drop: inv => { inv.landmarks.find((l: any) => l.landmarkId === 'bench_landmark').candidates[1].association = 'this_landmark'; } })))
      .toBe('review:audition_review_landmark_inventory');
    const noInventory = image({}); delete (noInventory.raw as any).landmarkInventory;
    expect(reason(noInventory)).toBe('review:invalid');
    const misbound = image({}); misbound.contextSha = sha('another context');
    expect(reason(misbound)).not.toBe('usable');
  });

  it('pair verdicts: CONFIRMED needs every positive observation; containment or inconclusive evidence is PARTIAL; any failure is FAILED', () => {
    const defect = (scene: Scene = {}) => image({ rockCopy: STRONG_COPY, hedge: { '+kind:thorn bush': 'contradicted' },
      swingOwn: { '+material:wooden': 'not_visible', '+shape:rectangular': 'not_visible' }, ...scene });
    const control = (scene: Scene = {}) => image({ hedge: { '+kind:thorn bush': 'not_visible', '+size:low': 'contradicted' }, ...scene });
    expect(scoreReplanPixelPair({ defect: defect(), control: control() })).toMatchObject({ verdict: 'CONFIRMED', failures: [], kindDiscriminationConfirmed: true });
    expect(scoreReplanPixelPair({ defect: defect({ hedge: { '+kind:thorn bush': 'not_visible', '+size:low': 'contradicted' } }), control: control() }))
      .toMatchObject({ verdict: 'CONFIRMED', kindDiscriminationConfirmed: false });
    expect(scoreReplanPixelPair({ defect: defect({ hedge: { association: 'possible_copy', '+kind:thorn bush': 'not_visible', '+colour:dusty-green': 'not_visible',
      '~shape:forked': 'not_visible' } }), control: control() }).verdict).toBe('PARTIAL');
    expect(scoreReplanPixelPair({ defect: defect(), control: control({ swingInBench: null }) }).verdict).toBe('PARTIAL');
    expect(scoreReplanPixelPair({ defect: defect({ hedge: null }), control: control() }).verdict).toBe('PARTIAL');
    for (const [scenes, failure] of [
      [{ defect: defect({ hedge: { association: 'possible_copy', '+kind:thorn bush': 'not_visible', '~shape:forked': 'not_visible' } }), control: control() }, 'defect:SHRUB_FALSE_DEFECT'],
      [{ defect: defect(), control: control({ swingInBench: { '+kind:bench': 'contradicted', '+material:wooden': 'contradicted' } }) }, 'control:MATERIAL_CONFUSED'],
      [{ defect: defect({ rockCopy: null }), control: control() }, 'defect:ROCK_MISSED'],
      [{ defect: defect({ rockCopy: { '+kind:rock': 'not_visible', '+colour:pale-gray': 'not_visible', '+shape:rounded': 'not_visible' } }), control: control() }, 'defect:ROCK_DEGRADED'],
      [{ defect: defect(), control: control({ rockCopy: STRONG_COPY }) }, 'control:ROCK_FALSE_POSITIVE'],
    ] as const) expect(scoreReplanPixelPair(scenes), failure).toMatchObject({ verdict: 'FAILED', failures: [failure] });
    expect(scoreReplanPixelPair({ defect: defect(), control: image({}, catalogue(), { wire: false }) })).toMatchObject({ verdict: 'UNUSABLE' });
  });
});
