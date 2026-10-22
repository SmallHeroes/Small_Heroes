import { describe, expect, it } from 'vitest';
import { assessAuditionReview, auditionJudgeInstruction, auditionPageReviewSchemaForContext, reviewedAuditionPolicy,
  LANDMARK_DESIGN_HEAD_VERSION, type AuditionLandmark } from '../simple-book-reviewed-audition';
import { LANDMARK_SCAN_REGIONS as regions, LANDMARK_COVERAGE_TOPOLOGY_VERSION as V } from '../landmark-topology';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';

const sha = (s: string) => s.repeat(64);
function fixture() {
  const landmarks: AuditionLandmark[] = ['building', 'facade'].map((kind, i) => ({ id: `s${i}`, plannedVisible: true, features: [
    { id: 'f1', aspect: 'kind', text: kind, clause: kind, decisive: true },
    { id: 'f2', aspect: 'colour', text: 'gray', clause: 'gray', decisive: true },
    { id: 'f3', aspect: 'shape', text: 'window', clause: 'with window', decisive: false },
  ] }));
  const objects = ['o1', 'o2', 'o3'].map(objectId => ({ objectId, region: objectId, description: 'visible physical body', quadrants: ['top_left'] }));
  const candidates = (index: number) => objects.map((o, i) => ({ objectId: o.objectId,
    association: i === 2 ? 'different_object' : index === i ? 'this_landmark' : 'possible_copy',
    featureChecks: landmarks[index].features.map(f => ({ featureId: f.id,
      observed: i === 2 && f.id === 'f1' || index === 0 && i === 0 && f.id === 'f3' ? 'contradicted' : 'matches' })),
    evidence: 'visible per aspect feature evidence',
  }));
  const bindings = landmarks.flatMap((l, i) => objects.map((o, n) => ({ landmarkId: l.id, objectId: o.objectId,
    sourceKind: l.features[0].text, extent: n === 2 ? 'not_instance' : i === n ? 'whole_instance' : i === 0 ? 'component_only' : 'containing_aggregate',
    evidence: 'visible kind and extent evidence' })));
  const topology: any = { version: V, relations: [
    { from: 'o2', to: 'o1', relation: 'component_of', basis: 'visible_attachment', evidence: 'facade visibly attached to whole building' },
    ...['o1', 'o2'].map(from => ({ from, to: 'o3', relation: 'separate_objects', basis: 'visible_separation', evidence: 'separate visible bodies with a gap' })),
  ], bindings, coverage: { version: 'landmark-candidate-coverage/v1', populations: [{ populationId: 'p1', quadrants: ['top_left'],
    description: 'visible uniform decorative population with witness', membership: 'uniform_noninstances', witnessObjectIds: ['o3'],
    negativeChecks: landmarks.map(l => ({ landmarkId: l.id, featureId: 'f1', observed: 'contradicted', basis: 'visible_kind',
      allMembersReadable: true, evidence: 'every visible member has a decisively different whole kind', grounding: null })),
  }], scans: regions.map(quadrant => ({ quadrant, status: 'complete', unresolvedReason: 'none', objectIds: quadrant === 'top_left' ? objects.map(o => o.objectId) : [],
    populationIds: quadrant === 'top_left' ? ['p1'] : [], uncertainLandmarkIds: [], evidence: 'whole quadrant scanned with visible coverage' })) } };
  const raw: any = { candidateSha: sha('a'), contextSha: sha('b'), landmarkInventory: {
    objects, landmarks: landmarks.map((l, i) => ({ landmarkId: l.id, candidates: candidates(i) })), topology,
  }, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'visible evidence', correction: '', issues: [] })) };
  return { raw, landmarks, topology };
}
const assess = (s = fixture()) => assessAuditionReview(s.raw, sha('a'), sha('b'), ['landmark_unique:s0', 'landmark_unique:s1'], s.landmarks, V).assessment;
const context = { version: 'audition-page-context/v4', landmarkDesignHead: LANDMARK_DESIGN_HEAD_VERSION,
  landmarkTopology: V, landmarkCoverage: 'landmark-candidate-coverage/v1' };

describe('prospective whole-landmark candidate coverage, not incidental cue enumeration', () => {
  it('fixes nondecisive anchor veto only in v2; v1 deterministic history stays held', () => {
    const s = fixture();
    expect(assess(s).counts.continuity).toBe(0);
    const legacy = structuredClone(s.raw); legacy.landmarkInventory.objects.forEach((o: any) => delete o.quadrants);
    legacy.landmarkInventory.topology.version = 'landmark-topology/v1'; delete legacy.landmarkInventory.topology.coverage;
    expect(assessAuditionReview(legacy, sha('a'), sha('b'), ['landmark_unique:s0', 'landmark_unique:s1'],
      s.landmarks, 'landmark-topology/v1').assessment.counts.continuity).toBe(1);
  });
  it.each(['kind', 'colour'])('decisive %s contradiction cannot gain a supported whole anchor', aspect => {
    const s = fixture(), feature = s.landmarks[0].features.find(f => f.aspect === aspect)!;
    s.raw.landmarkInventory.landmarks[0].candidates[0].featureChecks.find((f: any) => f.featureId === feature.id).observed = 'contradicted';
    if (aspect === 'kind') expect(() => assess(s)).toThrow(); else expect(assess(s).counts.continuity).toBeGreaterThan(0);
  });
  it.each(['kind', 'colour'])('unreadable required %s support stays held', aspect => {
    const s = fixture(), f = s.landmarks[0].features.find(f => f.aspect === aspect)!;
    s.raw.landmarkInventory.landmarks[0].candidates[0].featureChecks.find((x: any) => x.featureId === f.id).observed = 'not_visible';
    expect(assess(s).counts.continuity).toBeGreaterThan(0);
  });
  it.each(['mixed_possible_instance', 'unreadable'])('typed %s membership holds even explicit complete/pass', membership => {
    const s = fixture(); s.topology.coverage.populations[0].membership = membership;
    expect(assess(s).findings).toEqual(expect.arrayContaining([expect.objectContaining({ derived: true, verdict: 'uncertain', impact: 'continuity' })]));
  });
  it.each(['not_visible', 'unreadable_members', 'not_readable'])('typed %s negative evidence holds independently of explicit issues', mode => {
    const s = fixture(), row = s.topology.coverage.populations[0].negativeChecks[0];
    if (mode === 'not_visible') row.observed = mode;
    if (mode === 'unreadable_members') row.allMembersReadable = false;
    if (mode === 'not_readable') row.basis = mode;
    expect(assess(s).counts.continuity).toBeGreaterThan(0);
  });
  it.each(['missing_scan', 'duplicate_scan', 'missing_object', 'unknown_object', 'missing_population', 'unknown_population',
    'duplicate_quadrant', 'empty_quadrants', 'empty_uncertain_ids', 'unknown_uncertain_id', 'complete_with_uncertainty',
    'missing_source', 'duplicate_source', 'unknown_source', 'nondecisive_feature', 'unknown_feature', 'wrong_aspect',
    'unknown_witness', 'possible_whole_witness', 'witness_feature_mismatch', 'witness_outside_population', 'duplicate_population'])('refuses %s', mutation => {
    const s = fixture(), cover = s.topology.coverage, pop = cover.populations[0], scan = cover.scans[0], row = pop.negativeChecks[0];
    const objects = s.raw.landmarkInventory.objects;
    if (mutation === 'missing_scan') cover.scans.pop();
    if (mutation === 'duplicate_scan') cover.scans[1] = structuredClone(scan);
    if (mutation === 'missing_object') scan.objectIds.pop();
    if (mutation === 'unknown_object') scan.objectIds.push('o9');
    if (mutation === 'missing_population') scan.populationIds = [];
    if (mutation === 'unknown_population') scan.populationIds.push('p9');
    if (mutation === 'duplicate_quadrant') objects[0].quadrants.push('top_left');
    if (mutation === 'empty_quadrants') objects[0].quadrants = [];
    if (mutation === 'empty_uncertain_ids') scan.status = 'uncertain';
    if (mutation === 'unknown_uncertain_id') { scan.status = 'uncertain'; scan.uncertainLandmarkIds = ['unknown']; }
    if (mutation === 'complete_with_uncertainty') scan.uncertainLandmarkIds = ['s0'];
    if (mutation === 'missing_source') pop.negativeChecks.pop();
    if (mutation === 'duplicate_source') pop.negativeChecks[1] = structuredClone(row);
    if (mutation === 'unknown_source') row.landmarkId = 'unknown';
    if (mutation === 'nondecisive_feature') row.featureId = 'f3';
    if (mutation === 'unknown_feature') row.featureId = 'f9';
    if (mutation === 'wrong_aspect') row.basis = 'visible_colour';
    if (mutation === 'unknown_witness') pop.witnessObjectIds = ['o9'];
    if (mutation === 'possible_whole_witness') pop.witnessObjectIds = ['o1'];
    if (mutation === 'witness_feature_mismatch') s.raw.landmarkInventory.landmarks[0].candidates[2].featureChecks[0].observed = 'not_visible';
    if (mutation === 'witness_outside_population') { pop.quadrants = ['top_right']; cover.scans[0].populationIds = []; cover.scans[1].populationIds = ['p1']; }
    if (mutation === 'duplicate_population') cover.populations.push(structuredClone(pop));
    expect(() => assess(s)).toThrow();
  });
  it('explicit scan uncertainty derives a source-bound hold even all checks say pass', () => {
    const s = fixture(); s.topology.coverage.scans[0].status = 'uncertain'; s.topology.coverage.scans[0].unresolvedReason = 'capacity_exceeded';
    s.topology.coverage.scans[0].uncertainLandmarkIds = ['s1'];
    expect(assess(s).findings).toEqual([expect.objectContaining({ requirement: 'landmark_unique:s1', verdict: 'uncertain', derived: true })]);
  });
  it('unreadable required attachment still holds with complete spatial scans', () => {
    const s = fixture(); Object.assign(s.topology.relations[0], { relation: 'uncertain', basis: 'not_readable' });
    expect(assess(s).counts.continuity).toBeGreaterThan(0);
  });
  it('population summaries do not subtract any listed positive or possible whole', () => {
    const s = fixture(); s.topology.coverage.populations = []; s.topology.coverage.scans[0].populationIds = [];
    const row = s.raw.landmarkInventory.landmarks[0].candidates[2]; row.association = 'possible_copy'; row.featureChecks[0].observed = 'matches';
    s.topology.bindings.find((b: any) => b.landmarkId === 's0' && b.objectId === 'o3').extent = 'whole_instance';
    expect(assess(s).findings).toContainEqual(expect.objectContaining({ verdict: 'defect', requirement: 'landmark_unique:s0' }));
  });
  function sizeFixture() {
    const s = fixture();
    for (const l of s.landmarks) Object.assign(l.features[1], { aspect: 'size', text: 'larger than the visible scale reference', decisive: true });
    for (const l of s.raw.landmarkInventory.landmarks) l.candidates[2].featureChecks[1].observed = 'contradicted';
    for (const c of s.topology.coverage.populations[0].negativeChecks) Object.assign(c, { featureId: 'f2', basis: 'grounded_size',
      grounding: { referenceObjectId: 'o1', relation: 'same_ground_plane', evidence: 'visible bases and perspective anchor on a shared plane' } });
    return s;
  }
  it('population size exclusion requires a visible independent grounded scale reference', () => {
    expect(assess(sizeFixture()).counts.continuity).toBe(0);
  });
  it.each(['unreadable_depth', 'unreadable_reference'])('typed %s holds despite complete/pass and allMembersReadable=true', reason => {
    const s = sizeFixture(), g = s.topology.coverage.populations[0].negativeChecks[0].grounding;
    g.relation = 'not_readable'; if (reason === 'unreadable_reference') g.referenceObjectId = null;
    expect(assess(s).counts.continuity).toBeGreaterThan(0);
  });
  it.each(['no_grounding', 'unknown_reference', 'self_reference', 'pixel_size_only', 'wrong_aspect_basis'])('refuses %s population size evidence', reason => {
    const s = sizeFixture(), c = s.topology.coverage.populations[0].negativeChecks[0];
    if (reason === 'no_grounding') c.grounding = null;
    if (reason === 'unknown_reference') c.grounding.referenceObjectId = 'o9';
    if (reason === 'self_reference') c.grounding.referenceObjectId = 'o3';
    if (reason === 'pixel_size_only') c.grounding.relation = 'pixel_size';
    if (reason === 'wrong_aspect_basis') c.basis = 'visible_colour';
    expect(() => assess(s)).toThrow();
  });
  it('F1/F3 same-body ownership and identical kind contradictions remain unusable in v2', () => {
    const s = fixture(); Object.assign(s.topology.relations[0], { relation: 'same_object', basis: 'shared_visible_body' });
    expect(() => assess(s)).toThrow();
    const x = fixture(); x.landmarks[1].features[0].text = x.landmarks[0].features[0].text;
    x.topology.bindings.filter((b: any) => b.landmarkId === 's1').forEach((b: any) => b.sourceKind = x.landmarks[0].features[0].text);
    x.raw.landmarkInventory.landmarks[1].candidates[0].featureChecks[0].observed = 'contradicted';
    expect(() => assess(x)).toThrow();
  });
  it('empty scans do not approve a missing planned-visible canonical whole', () => {
    const s = fixture(); s.raw.landmarkInventory.objects = []; s.raw.landmarkInventory.landmarks.forEach((l: any) => l.candidates = []);
    s.topology.bindings = []; s.topology.relations = []; s.topology.coverage.populations = [];
    s.topology.coverage.scans.forEach((c: any) => { c.objectIds = []; c.populationIds = []; });
    expect(assess(s).counts.continuity).toBe(2);
  });
  it('replacement instruction, schema and policy are selected together without changing legacy instruction', () => {
    const fresh = auditionJudgeInstruction('page', context), old = auditionJudgeInstruction('page', { version: 'audition-page-context/v3',
      landmarkDesignHead: LANDMARK_DESIGN_HEAD_VERSION, landmarkTopology: 'landmark-topology/v1' });
    expect(fresh).toContain('SPATIAL CANDIDATE COVERAGE');
    expect(fresh).not.toContain('objects = every object in the picture that shares any listed feature');
    expect(old).toContain('objects = every object in the picture that shares any listed feature');
    expect(old).not.toContain('SPATIAL CANDIDATE COVERAGE');
    expect(reviewedAuditionPolicy(undefined, true, V).version).toBe('reviewed-audition-policy/v13');
    expect(auditionPageReviewSchemaForContext(context).parse(fixture().raw)).toBeTruthy();
    expect(() => auditionPageReviewSchemaForContext({ ...context, version: 'audition-page-context/v3' })).toThrow();
    expect(() => auditionPageReviewSchemaForContext({ ...context, landmarkCoverage: undefined })).toThrow();
    expect(() => auditionPageReviewSchemaForContext({ ...context, landmarkTopology: 'landmark-topology/v1' })).toThrow();
    expect(() => auditionPageReviewSchemaForContext({ ...context, landmarkTopology: undefined })).toThrow();
  });
});
