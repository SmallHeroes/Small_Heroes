import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { LANDMARK_TOPOLOGY_VERSION as V, type LandmarkTopology } from '../landmark-topology';
import { assessAuditionReview, assessLandmarkInventory, type AuditionLandmark, auditionPageReviewSchemaForContext,
  auditionJudgeInstruction, reviewedAuditionPolicy, LANDMARK_DESIGN_HEAD_VERSION as H, AUDITION_JUDGE_INSTRUCTIONS,
  auditionPageReviewSchema, topologyAuditionPageReviewSchema, attemptStatus } from '../simple-book-reviewed-audition';
import { QUALITY_CATEGORIES, previewQualityContextSha } from '../../local-preview-quality';
import { auditionJudgePayload } from '../../../scripts/personal-simple-book-reviewed-audition';

const sha = (char: string) => char.repeat(64);
const landmark = (id: string, kind: string): AuditionLandmark => ({ id, plannedVisible: true, features: [
  { id: 'f1', aspect: 'kind', text: kind, clause: kind, decisive: true },
  { id: 'f2', aspect: 'colour', text: 'gray', clause: 'gray', decisive: true },
  { id: 'f3', aspect: 'shape', text: 'rounded', clause: 'rounded', decisive: true },
] });
const object = (id: string) => ({ objectId: id, region: 'background', description: `visible ${id}` });
const candidate = (id: string, association = 'possible_copy') => ({ objectId: id, association,
  evidence: 'visible whole-object feature evidence',
  featureChecks: ['f1', 'f2', 'f3'].map(featureId => ({ featureId, observed: 'matches' })) });
const binding = (landmarkId: string, id: string, sourceKind: string, extent = 'whole_instance') => ({
  landmarkId, objectId: id, sourceKind, extent, evidence: 'visible source-kind extent evidence',
});
const relation = (from: string, to: string, kind = 'separate_objects') => ({ from, to, relation: kind,
  basis: kind === 'component_of' ? 'visible_attachment' : kind === 'same_object' ? 'shared_visible_body'
    : kind === 'uncertain' ? 'not_readable' : 'visible_separation', evidence: 'actual visible physical relation evidence' });
const packet = (inventory: unknown) => ({ candidateSha: sha('a'), contextSha: sha('b'),
  checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'pixel evidence', correction: '', issues: [] })),
  landmarkInventory: inventory });
const aggregate = (whole = 'canyon', part = 'cliff') => ({
  landmarks: [landmark('a', whole), landmark('b', part)],
  inventory: { objects: [object('o1'), object('o2')], landmarks: [
    { landmarkId: 'a', candidates: [candidate('o1', 'this_landmark'), candidate('o2')] },
    { landmarkId: 'b', candidates: [candidate('o2', 'this_landmark'), candidate('o1')] },
  ], topology: { version: V, relations: [relation('o2', 'o1', 'component_of')], bindings: [
    binding('a', 'o1', whole), binding('a', 'o2', whole, 'component_only'),
    binding('b', 'o2', part), binding('b', 'o1', part, 'containing_aggregate'),
  ] } },
});
const assess = (s = aggregate()) => assessAuditionReview(packet(s.inventory), sha('a'), sha('b'),
  ['landmark_unique:a', 'landmark_unique:b'], s.landmarks, V);
const single = (relationKind = 'separate_objects') => ({ landmarks: [landmark('a', 'building')], inventory: {
  objects: [object('o1'), object('o2')], landmarks: [{ landmarkId: 'a', candidates: [candidate('o1', 'this_landmark'), candidate('o2')] }],
  topology: { version: V, relations: [relation('o1', 'o2', relationKind)], bindings: [binding('a', 'o1', 'building'), binding('a', 'o2', 'building')] },
} });

describe('prospective typed landmark topology: no source-specific rules or legacy reinterpretation', () => {
  it.each([['canyon', 'cliff'], ['building', 'facade'], ['park', 'fountain'], ['forest', 'tree']])(
    'distinguishes one %s aggregate and its %s member, retains both canonical owners', (whole, part) => {
      const { assessment } = assess(aggregate(whole, part));
      expect(assessment.counts.continuity).toBe(0);
      expect(assessment.landmarks?.map(l => [l.instances, l.strong, l.excluded, l.topologyUncertain])).toEqual([[1, 1, 1, false], [1, 1, 1, false]]);
      expect(assessment.landmarks?.[0].candidates[1]).toMatchObject({ association: 'possible_copy', counted: false,
        topology: { extent: 'component_only', excludedAsNonWhole: true } });
    });
  it.each(['building', 'ring', 'tower'])('two separate matching %s wholes still block, including identical region labels', kind => {
    const s = single(); s.landmarks = [landmark('a', kind)]; s.inventory.topology.bindings.forEach(b => b.sourceKind = kind);
    const a = assessLandmarkInventory(s.inventory as any, s.landmarks, s.inventory.topology as LandmarkTopology);
    expect(a[0]).toMatchObject({ instances: 2, strong: 2, excluded: 0 });
    const result = assess(s as any).assessment;
    expect(result.findings).toContainEqual(expect.objectContaining({ verdict: 'defect', derived: true, requirement: 'landmark_unique:a' }));
  });
  it('same visible physical body can have multiple observations, never merged merely from region or prose', () => {
    const s = single('same_object');
    expect(assess(s as any).assessment.landmarks?.[0]).toMatchObject({ instances: 1, strong: 1 });
    s.inventory.topology.relations = [relation('o1', 'o2', 'separate_objects')];
    s.inventory.landmarks[0].candidates[1].evidence = 'The prose says they are the SAME object';
    expect(assess(s as any).assessment.landmarks?.[0].instances).toBe(2);
  });
  it.each([false, true])('refuses conflicting whole/non-instance evidence in one physical group (transitive=%s)', transitive => {
    const s = single('same_object');
    s.inventory.topology.bindings[1].extent = 'not_instance';
    s.inventory.landmarks[0].candidates[1].association = 'different_object';
    s.inventory.landmarks[0].candidates[1].featureChecks[0].observed = 'contradicted';
    if (transitive) {
      s.inventory.objects.push(object('o3'));
      s.inventory.landmarks[0].candidates.push(candidate('o3'));
      s.inventory.topology.bindings.push(binding('a', 'o3', 'building'));
      s.inventory.topology.relations.push(relation('o2', 'o3', 'same_object'), relation('o1', 'o3', 'same_object'));
    }
    expect(() => assess(s as any)).toThrow();
  });
  it('refuses opposite decisive feature evidence across aliases even when neither single alias is a supported anchor', () => {
    const s = single('same_object');
    s.inventory.landmarks[0].candidates[0].featureChecks[1].observed = 'not_visible';
    s.inventory.landmarks[0].candidates[1].featureChecks[1].observed = 'contradicted';
    s.inventory.landmarks[0].candidates[1].featureChecks[0].observed = 'not_visible';
    // The kind is visible on o1 and unreadable on o2; colour contradiction is not by itself a kind contradiction.
    expect(assess(s as any).assessment.counts.continuity).toBeGreaterThan(0);
    s.inventory.landmarks[0].candidates[0].featureChecks[1].observed = 'matches';
    expect(() => assess(s as any)).toThrow();
  });
  it('does not treat not-visible decisive evidence in one consistent alias as an opposing verdict', () => {
    const s = single('same_object');
    s.inventory.landmarks[0].candidates[1].featureChecks[0].observed = 'not_visible';
    expect(assess(s as any).assessment.landmarks?.[0]).toMatchObject({ instances: 1, strong: 1 });
    // Missing whole-anchor evidence still stays uncertain in its own row; no inference from the positive alias.
    expect(assess(s as any).assessment.counts.continuity).toBeGreaterThan(0);
  });
  it('unreadable relation of two decisively proven non-instances cannot hold the one positive landmark', () => {
    const s = single();
    s.inventory.objects.push(object('o3'));
    s.inventory.landmarks[0].candidates.push(candidate('o3', 'different_object'));
    s.inventory.landmarks[0].candidates[1].association = 'different_object';
    for (const c of s.inventory.landmarks[0].candidates.slice(1)) c.featureChecks[0].observed = 'contradicted';
    s.inventory.topology.bindings[1].extent = 'not_instance';
    s.inventory.topology.bindings.push(binding('a', 'o3', 'building', 'not_instance'));
    s.inventory.topology.relations.push(relation('o1', 'o3'), relation('o2', 'o3', 'uncertain'));
    const result = assess(s as any).assessment;
    expect(result.landmarks?.[0]).toMatchObject({ instances: 1, strong: 1, topologyUncertain: false });
    expect(result.counts.continuity).toBe(0);
    s.inventory.topology.relations[2] = relation('o2', 'o3');
    expect(assess(s as any).assessment).toEqual(result);
  });
  it('does not let an irrelevant uncertain non-instance edge suppress a valid component exclusion', () => {
    const s = aggregate();
    s.inventory.objects.push(object('o3'));
    for (const l of s.inventory.landmarks) {
      const c = candidate('o3', 'different_object'); c.featureChecks[0].observed = 'contradicted'; l.candidates.push(c);
    }
    s.inventory.topology.bindings.push(binding('a', 'o3', 'canyon', 'not_instance'), binding('b', 'o3', 'cliff', 'not_instance'));
    s.inventory.topology.relations.push(relation('o1', 'o3'), relation('o2', 'o3', 'uncertain'));
    expect(assess(s).assessment.landmarks?.map(l => [l.instances, l.excluded, l.topologyUncertain])).toEqual([[1, 1, false], [1, 1, false]]);
    // A genuinely unresolved membership between the part and its relevant source anchor still holds.
    s.inventory.topology.relations[0] = relation('o2', 'o1', 'uncertain');
    expect(assess(s).assessment.counts.continuity).toBeGreaterThan(0);
  });
  it('does not merge two whole members just because both belong to one aggregate', () => {
    const s = aggregate('forest', 'tree');
    s.inventory.objects.push(object('o3'));
    s.inventory.landmarks[0].candidates.push(candidate('o3'));
    s.inventory.landmarks[1].candidates.push(candidate('o3'));
    s.inventory.topology.bindings.push(binding('a', 'o3', 'forest', 'component_only'), binding('b', 'o3', 'tree'));
    s.inventory.topology.relations.push(relation('o3', 'o1', 'component_of'), relation('o2', 'o3'));
    const a = assess(s).assessment;
    expect(a.landmarks?.[0]).toMatchObject({ instances: 1, strong: 1 });
    expect(a.landmarks?.[1]).toMatchObject({ instances: 2, strong: 2 });
    expect(a.findings).toContainEqual(expect.objectContaining({ verdict: 'defect', requirement: 'landmark_unique:b' }));
  });
  it.each(['hidden attachment', 'different perspective depth', 'overlapping silhouettes'])('holds %s; unreadable relation is not separate or same', _reason => {
    const s = single('uncertain'), a = assess(s as any).assessment;
    expect(a.landmarks?.[0]).toMatchObject({ instances: 2, strong: 1, topologyUncertain: true });
    expect(a.findings).toContainEqual(expect.objectContaining({ verdict: 'uncertain', impact: 'continuity' }));
  });
  it('a non-whole extent cannot exclude an object without its positively evidenced ancestor/descendant', () => {
    const s = aggregate(); s.inventory.topology.relations = [relation('o2', 'o1')];
    expect(assess(s).assessment.counts.continuity).toBeGreaterThan(0);
    expect(assess(s).assessment.landmarks?.map(l => l.excluded)).toEqual([0, 0]);
  });
  it('uncertain extent blocks even one observation; an unobserved planned whole is not approved', () => {
    const s = single(); s.inventory.objects.pop(); s.inventory.landmarks[0].candidates = [candidate('o1')];
    s.inventory.topology.relations = []; s.inventory.topology.bindings = [binding('a', 'o1', 'building', 'uncertain')];
    expect(assess(s as any).assessment.counts.continuity).toBe(1);
    s.inventory.objects = []; s.inventory.landmarks[0].candidates = []; s.inventory.topology.bindings = [];
    expect(assess(s as any).assessment.counts.continuity).toBe(1);
  });
  it('positive kind is required for a whole anchor; hidden kind or only one support stays held', () => {
    const s = aggregate(); s.inventory.landmarks[0].candidates[0].featureChecks[0].observed = 'not_visible';
    expect(assess(s).assessment.counts.continuity).toBeGreaterThan(0);
    s.inventory.landmarks[0].candidates[0].featureChecks[0].observed = 'contradicted';
    expect(() => assess(s)).toThrow();
  });
  it('not_instance needs the existing typed negative-feature evidence, not a label or a contradiction in prose', () => {
    const s = single(); s.inventory.topology.bindings[1].extent = 'not_instance';
    s.inventory.landmarks[0].candidates[1].association = 'different_object';
    expect(() => assess(s as any)).toThrow();
    s.inventory.landmarks[0].candidates[1].featureChecks[0].observed = 'contradicted';
    expect(assess(s as any).assessment.landmarks?.[0]).toMatchObject({ instances: 1, strong: 1 });
  });
  it.each(['unknown_object', 'missing_pair', 'repeated_pair', 'self', 'wrong_kind', 'missing_binding', 'repeated_binding',
    'foreign_binding', 'prose_basis', 'overlap_basis', 'relation_basis_conflict', 'wrong_version'])('refuses malformed/incomplete topology: %s', mutation => {
    const s = aggregate(), t = s.inventory.topology as any;
    if (mutation === 'unknown_object') t.relations[0].to = 'o9';
    if (mutation === 'missing_pair') t.relations = [];
    if (mutation === 'repeated_pair') t.relations.push({ ...t.relations[0], from: 'o1', to: 'o2' });
    if (mutation === 'self') t.relations[0].to = 'o2';
    if (mutation === 'wrong_kind') t.bindings[0].sourceKind = 'unrelated kind';
    if (mutation === 'missing_binding') t.bindings.pop();
    if (mutation === 'repeated_binding') t.bindings.push(t.bindings[0]);
    if (mutation === 'foreign_binding') t.bindings[0].landmarkId = 'foreign';
    if (mutation === 'prose_basis') t.relations[0].basis = 'source_prose';
    if (mutation === 'overlap_basis') t.relations[0].basis = 'visible_overlap';
    if (mutation === 'relation_basis_conflict') t.relations[0].basis = 'shared_visible_body';
    if (mutation === 'wrong_version') t.version = 'landmark-topology/v99';
    expect(() => assess(s)).toThrow();
  });
  it('refuses cycles and transitive separate/containment contradictions', () => {
    const s = aggregate(); s.inventory.objects.push(object('o3'));
    const t = s.inventory.topology;
    for (const l of s.inventory.landmarks) l.candidates.push(candidate('o3'));
    t.bindings.push(binding('a', 'o3', 'canyon'), binding('b', 'o3', 'cliff'));
    t.relations = [relation('o1', 'o2', 'component_of'), relation('o2', 'o3', 'component_of'), relation('o3', 'o1', 'component_of')];
    expect(() => assess(s)).toThrow();
    t.relations[2] = relation('o1', 'o3');
    expect(() => assess(s)).toThrow();
  });
  it('same physical identity cannot fuse two distinct canonical owners', () => {
    const s = aggregate(); s.inventory.topology.relations = [relation('o1', 'o2', 'same_object')];
    expect(() => assess(s)).toThrow();
  });
  it('requires every object/source comparison; neither an orphan nor one missing source row can hide a duplicate', () => {
    const s = aggregate();
    s.inventory.landmarks[0].candidates.pop();
    s.inventory.topology.bindings = s.inventory.topology.bindings.filter(b => !(b.landmarkId === 'a' && b.objectId === 'o2'));
    expect(() => assess(s)).toThrow();
  });
  it('source kinds must come from the canonical declared-kind contract, not a free label', () => {
    const s = aggregate(); s.landmarks[0].features = s.landmarks[0].features.filter(f => f.aspect !== 'kind');
    s.inventory.landmarks[0].candidates.forEach(c => c.featureChecks.shift());
    expect(() => assess(s)).toThrow();
  });
  it('preserves explicit model safety/story/identity/continuity findings; topology is not an impact override', () => {
    for (const impact of ['safety', 'story', 'identity', 'continuity']) {
      const s = aggregate(), r = packet(s.inventory); r.checks[0] = { category: r.checks[0].category, verdict: 'uncertain',
        observation: 'visible uncertainty', correction: '', issues: [{ impact, requirement: 'landmark_unique:a', note: 'material evidence' }] } as any;
      const a = assessAuditionReview(r, sha('a'), sha('b'), ['landmark_unique:a', 'landmark_unique:b'], s.landmarks, V).assessment;
      expect(a.counts[impact as keyof typeof a.counts]).toBe(1);
      expect(attemptStatus('page', { candidate: { imageName: 'x.png', imageSha: sha('a') }, assessment: a } as any)).not.toBe('qa_supported');
    }
  });
  it('old raw is refused in the new contract; new raw is refused in legacy; neither is mutated', () => {
    const s = aggregate(), raw = packet(s.inventory), frozen = JSON.stringify(raw);
    expect(() => assessAuditionReview(raw, sha('a'), sha('b'), [], s.landmarks)).toThrow();
    const { topology: _, ...old } = s.inventory;
    expect(() => assessAuditionReview(packet(old), sha('a'), sha('b'), [], s.landmarks, V)).toThrow();
    expect(JSON.stringify(raw)).toBe(frozen);
    expect(() => assessAuditionReview(raw, sha('c'), sha('b'), [], s.landmarks, V)).toThrow();
  });
  it('binds context, schema, policy and instruction together, leaving defaults byte-identical', () => {
    const c = { version: 'audition-page-context/v3', landmarkDesignHead: H, landmarkTopology: V };
    expect(reviewedAuditionPolicy(false, true, V).version).toBe('reviewed-audition-policy/v12');
    expect(reviewedAuditionPolicy().version).toBe('reviewed-audition-policy/v9');
    expect(reviewedAuditionPolicy(false, true).version).toBe('reviewed-audition-policy/v11');
    expect(() => reviewedAuditionPolicy(false, undefined, V)).toThrow();
    expect(auditionPageReviewSchemaForContext(c)).toBe(topologyAuditionPageReviewSchema);
    expect(auditionPageReviewSchemaForContext({})).toBe(auditionPageReviewSchema);
    expect(auditionJudgeInstruction('page', {})).toBe(AUDITION_JUDGE_INSTRUCTIONS.page);
    expect(auditionJudgeInstruction('page', c)).toContain('never group siblings');
    for (const bad of [{ ...c, landmarkDesignHead: undefined }, { ...c, landmarkTopology: undefined },
      { ...c, version: 'audition-page-context/v2' }, { ...c, landmarkTopology: 'unknown' }])
      expect(() => auditionJudgeInstruction('page', bad)).toThrow('audition_landmark_contract');
    expect(() => auditionJudgeInstruction('sheet', c)).toThrow();
  });
  it('uses the real payload builder for the prospective schema, same exact candidate and references; no API', async () => {
    const context = { version: 'audition-page-context/v3', landmarkDesignHead: H, landmarkTopology: V, checks: aggregate().landmarks };
    const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: 'gray' } }).png().toBuffer();
    const p = await auditionJudgePayload({ candidate: { imageName: 'synthetic.png', imageSha: sha('a') }, candidateBytes: bytes,
      context, contextSha: previewQualityContextSha(context), refs: [bytes, bytes, bytes, bytes], predecessor: null, kind: 'page' });
    expect(p.text.format.name).toBe('personal_audition_pixels_topology_v1');
    expect(p.instructions).toContain('source prose does not establish');
    expect(p.max_output_tokens).toBe(12000);
    expect(p.input[0].content.filter(x => x.type === 'input_image')).toHaveLength(9);
    expect(p.text.format.schema).toHaveProperty('properties.landmarkInventory.properties.topology');
  });
});
