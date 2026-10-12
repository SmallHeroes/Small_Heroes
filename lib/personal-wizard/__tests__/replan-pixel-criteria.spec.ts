import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { landmarkFeatureCatalogue, assessAuditionReview, AUDITION_JUDGE_INSTRUCTIONS, type AuditionLandmark } from '../simple-book-reviewed-audition';
import { scoreReplanPixelImage, scoreReplanPixelPair, REPLAN_PIXEL_TARGETS, REPLAN_PIXEL_BINDING_FIELDS, SHRUB_TARGET_PROTOCOL,
  type PixelImageInput } from '../../../scripts/personal-replan-pixel-criteria';

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
  ['o6', 'second big rock, front left'], ['o7', 'tall hedge along the back'], ['o8', 'flower bed beside the path']] as const;
// Spelled out (not derived from the export) so this file also loads against older code; equality with the export is asserted below.
const FIELDS = ['image', 'context', 'model', 'schema', 'instruction', 'text', 'imageOrder', 'noExpectationLeak', 'completed', 'policy'];
const BINDING = Object.fromEntries(FIELDS.map(field => [field, true]));
const KIND_ONLY: Seen = { '+kind:thorn bush': 'contradicted' };

type Scene = { rockCopy?: Seen | null; hedge?: Record<string, string> | null; swingOwn?: Seen; swingInBench?: Seen | null;
  /** Other objects examined in the shrub entry (e.g. the identified tree, or an unrelated flower bed). */
  shrubOthers?: { objectId: string; association: string; seen: Seen }[];
  target?: unknown; binding?: unknown; invalidCitation?: true; safety?: true; drop?: (inv: any) => void };
function image(scene: Scene, landmarks = catalogue()): PixelImageInput {
  const L = (id: string, objectId: string, association: string, seen?: Seen) => cand(landmarks, id, objectId, association, seen);
  const { association: hedgeAssociation = 'different_object', ...hedgeSeen } = scene.hedge ?? {};
  const entries: Record<string, unknown[]> = {
    tree_landmark: [L('tree_landmark', 'o1', 'this_landmark')],
    bench_landmark: [L('bench_landmark', 'o2', 'this_landmark'),
      ...(scene.swingInBench === null ? [] : [L('bench_landmark', 'o3', 'different_object', scene.swingInBench ?? { '+kind:bench': 'contradicted' })])],
    swing_landmark: [L('swing_landmark', 'o3', 'this_landmark', scene.swingOwn)],
    thorn_landmark: [L('thorn_landmark', 'o4', 'this_landmark'), ...(scene.hedge ? [L('thorn_landmark', 'o7', hedgeAssociation, hedgeSeen as Seen)] : []),
      ...(scene.shrubOthers ?? []).map(o => L('thorn_landmark', o.objectId, o.association, o.seen))],
    rock_landmark: [L('rock_landmark', 'o5', 'this_landmark'), ...(scene.rockCopy ? [L('rock_landmark', 'o6', 'possible_copy', scene.rockCopy)] : [])],
  };
  const inventory = { objects: OBJECTS.map(([objectId, region]) => ({ objectId, region, description: region })),
    landmarks: landmarks.map(l => ({ landmarkId: l.id, candidates: entries[l.id] })) };
  scene.drop?.(inventory);
  const checks = QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '', issues: [] as unknown[] }));
  // The engine's own invalid-citation case: a schema-valid defect with its required non-empty correction, citing an unbound requirement.
  if (scene.invalidCitation) Object.assign(checks[0], { verdict: 'defect', correction: 'Repaint the cited element.',
    issues: [{ impact: 'continuity', requirement: 'unbound_critical_requirement', note: 'A serious issue citing no bound requirement.' }] });
  if (scene.safety) Object.assign(checks.find(c => c.category === 'safety')!, { verdict: 'defect', correction: 'Remove the unsafe element.',
    issues: [{ impact: 'safety', requirement: 'safety', note: 'Synthetic safety issue.' }] });
  const raw = { candidateSha: sha('img'), contextSha: sha('ctx'), landmarkInventory: inventory, checks };
  return { raw, candidateSha: sha('img'), contextSha: sha('ctx'), requirementIds: ['safety', ...landmarks.map(l => `landmark_unique:${l.id}`)], landmarks,
    binding: (scene.binding === undefined ? BINDING : scene.binding) as Record<string, unknown>,
    shrubTarget: (scene.target === undefined ? { objectId: 'o7' } : scene.target) as PixelImageInput['shrubTarget'] };
}
const STRONG_COPY: Seen = {}; // every rock cue seen: a definite second rock
const ok = (s: ReturnType<typeof scoreReplanPixelImage>) => { if (!s.usable) throw Error(`unusable: ${s.reason}`); return s; };
const reason = (input: PixelImageInput) => { const s = scoreReplanPixelImage(input, 'control'); return s.usable ? 'usable' : s.reason; };
const defect = (scene: Scene = {}) => image({ rockCopy: STRONG_COPY, hedge: KIND_ONLY,
  swingOwn: { '+material:wooden': 'not_visible', '+shape:rectangular': 'not_visible' }, ...scene });
const control = (scene: Scene = {}) => image({ hedge: { '+kind:thorn bush': 'not_visible', '+size:low': 'contradicted' }, ...scene });

describe('pre-registered pixel criteria for the re-plan pair (QA F2)', () => {
  it('uses the real catalogue: the declared kind is decisive, and the swing and bench share one decisive wood cue', () => {
    const c = catalogue(), f = (id: string) => c.find(l => l.id === id)!.features.map(key);
    expect(f('swing_landmark')).toEqual(['+kind:swing', '+shape:rectangular', '+material:wooden', '~colour:cream', '~material:wooden']);
    expect(f('bench_landmark')).toEqual(['+kind:bench', '+material:wooden', '~colour:dark', '~material:iron']);
    expect(f('thorn_landmark')).toEqual(['+kind:thorn bush', '+size:low', '+colour:dusty-green', '~shape:forked']);
    // Nothing the scorer knows (outcomes, targets, the hedge protocol) is ever reviewer text.
    for (const word of ['ROCK_DETECTED', 'SHRUB_', 'MATERIAL_OK', 'CONFIRMED', 'hedge', REPLAN_PIXEL_TARGETS.material.entry])
      expect(AUDITION_JUDGE_INSTRUCTIONS.page.toLowerCase()).not.toContain(word.toLowerCase());
    expect(SHRUB_TARGET_PROTOCOL.binding).toContain('object list only');
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
    expect(shrubOf(KIND_ONLY)).toBe('SHRUB_DISCRIMINATED_BY_KIND');
    expect(shrubOf({ '+kind:thorn bush': 'not_visible', '+size:low': 'contradicted' })).toBe('SHRUB_DISCRIMINATED_OTHER_CUE');
    expect(shrubOf(null)).toBe('SHRUB_TARGET_NOT_EXAMINED');
    // rejudge-3's hedge: kind unreadable, "low" and "dusty-green" seen as matching: a definite (false) duplicate.
    expect(shrubOf({ association: 'possible_copy', '+kind:thorn bush': 'not_visible', '~shape:forked': 'not_visible' })).toBe('SHRUB_FALSE_DEFECT');
    // One supporting aspect only: an uncertain hold (fail-closed containment, NOT proof the false alarm is solved).
    expect(shrubOf({ association: 'possible_copy', '+kind:thorn bush': 'not_visible', '+colour:dusty-green': 'not_visible', '~shape:forked': 'not_visible' }))
      .toBe('SHRUB_UNCERTAIN');
    // "different_object" without a contradicted whole-object cue is reclassified as a possible copy, never a dismissal.
    expect(shrubOf({ '+kind:thorn bush': 'not_visible', '~shape:forked': 'contradicted' })).toBe('SHRUB_FALSE_DEFECT');
  });

  describe('only THE bound target proves discrimination (QA F1)', () => {
    const shrubAndVerdict = (d: PixelImageInput) => {
      const pair = scoreReplanPixelPair({ defect: d, control: control() });
      return [pair.defect.usable ? pair.defect.shrub : pair.defect.reason, pair.verdict, pair.kindDiscriminationConfirmed];
    };
    it('the honest target: the bound hedge dismissed on its kind is CONFIRMED', () => {
      expect(shrubAndVerdict(defect())).toEqual(['SHRUB_DISCRIMINATED_BY_KIND', 'CONFIRMED', true]);
    });
    it("Codex's counterexample: the identified tree dismissed instead, the hedge never examined, is not CONFIRMED", () => {
      expect(shrubAndVerdict(defect({ hedge: null, shrubOthers: [{ objectId: 'o1', association: 'different_object', seen: KIND_ONLY }] })))
        .toEqual(['SHRUB_TARGET_NOT_EXAMINED', 'PARTIAL', false]);
    });
    it('an unrelated, unidentified object dismissed on the kind proves nothing about the hedge', () => {
      expect(shrubAndVerdict(defect({ hedge: null, shrubOthers: [{ objectId: 'o8', association: 'different_object', seen: KIND_ONLY }] })))
        .toEqual(['SHRUB_TARGET_NOT_EXAMINED', 'PARTIAL', false]);
      // ...and it does not dilute the real target's outcome either.
      expect(shrubAndVerdict(defect({ shrubOthers: [{ objectId: 'o8', association: 'different_object', seen: KIND_ONLY }] }))[0]).toBe('SHRUB_DISCRIMINATED_BY_KIND');
    });
    it('no bound target, an unlisted target, or a target that is some landmark itself is inconclusive, never CONFIRMED', () => {
      expect(shrubAndVerdict(defect({ target: null }))).toEqual(['SHRUB_TARGET_UNBOUND', 'PARTIAL', false]);
      expect(shrubAndVerdict(defect({ target: { objectId: 'o9' } }))).toEqual(['SHRUB_TARGET_UNBOUND', 'PARTIAL', false]);
      expect(shrubAndVerdict(defect({ target: { objectId: 'o1' }, shrubOthers: [{ objectId: 'o1', association: 'different_object', seen: KIND_ONLY }] })))
        .toEqual(['SHRUB_TARGET_CLAIMED', 'PARTIAL', false]);
    });
    it('a malformed or missing target binding is unusable (the field is mandatory; null means "none bound")', () => {
      for (const target of [{ objectId: 'hedge' }, [{ objectId: 'o7' }], { objectId: 'o7', extra: 1 }, 'o7'])
        expect(reason(defect({ target })), JSON.stringify(target)).toBe('target:malformed');
      const missing = defect(); delete (missing as any).shrubTarget;
      expect(reason(missing)).toBe('target:malformed');
    });
    it('the duplicate and material controls are unchanged by the target binding', () => {
      expect(scoreReplanPixelPair({ defect: defect({ hedge: { association: 'possible_copy', '+kind:thorn bush': 'not_visible', '~shape:forked': 'not_visible' } }),
        control: control() })).toMatchObject({ verdict: 'FAILED', failures: ['defect:SHRUB_FALSE_DEFECT'] });
      expect(scoreReplanPixelPair({ defect: defect(), control: control({ swingInBench: { '+kind:bench': 'contradicted', '+material:wooden': 'contradicted' } }) }))
        .toMatchObject({ verdict: 'FAILED', failures: ['control:MATERIAL_CONFUSED'] });
    });
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

  describe('hard preconditions: the full proof contract, or UNUSABLE (QA F2)', () => {
    it('binding is exactly the mandatory checklist, each item true: arbitrary, missing, extra or false items are refused', () => {
      expect(reason(image({}))).toBe('usable');
      expect(reason(image({ binding: { arbitrary: true } }))).toBe(`binding:missing:${FIELDS.join(',')}`);
      const { policy: _policy, ...withoutPolicy } = BINDING;
      expect(reason(image({ binding: withoutPolicy }))).toBe('binding:missing:policy');
      expect(reason(image({ binding: { ...BINDING, extra: true } }))).toBe('binding:unknown:extra');
      expect(reason(image({ binding: { ...BINDING, noExpectationLeak: false } }))).toBe('binding:noExpectationLeak');
      expect(reason(image({ binding: { ...BINDING, completed: 'true' } }))).toBe('binding:completed');
      for (const binding of [{}, null, [], 'all']) expect(reason(image({ binding })), JSON.stringify(binding)).toMatch(/^binding:(none|missing)/);
      // Codex's pair counterexample ({arbitrary: true} on both images) is UNUSABLE, not CONFIRMED.
      expect(scoreReplanPixelPair({ defect: defect({ binding: { arbitrary: true } }), control: control({ binding: { arbitrary: true } }) }).verdict).toBe('UNUSABLE');
      expect(REPLAN_PIXEL_BINDING_FIELDS).toEqual(FIELDS);
    });

    it("the engine's own review policy: an invalid citation or a safety block is unusable, and the raw evidence is never altered", () => {
      const input = defect({ invalidCitation: true }), before = structuredClone(input.raw);
      // The engine parses this review and reports the invalid citation; that is exactly what makes it unusable here.
      expect(assessAuditionReview(input.raw, input.candidateSha, input.contextSha, input.requirementIds, input.landmarks).assessment.invalidCitations).toBe(1);
      expect(reason(input)).toBe('review:invalid_citations');
      expect(scoreReplanPixelPair({ defect: input, control: control() })).toMatchObject({ verdict: 'UNUSABLE' });
      expect(input.raw).toEqual(before);
      expect(reason(control({ safety: true }))).toBe('review:safety_blocked');
    });

    it('schema, coverage, objectIds and the declared kinds stay hard preconditions', () => {
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
  });

  it('pair verdicts: CONFIRMED needs every positive observation; containment or inconclusive evidence is PARTIAL; any failure is FAILED', () => {
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
    expect(scoreReplanPixelPair({ defect: defect(), control: control({ binding: { ...BINDING, image: false } }) })).toMatchObject({ verdict: 'UNUSABLE' });
  });
});
