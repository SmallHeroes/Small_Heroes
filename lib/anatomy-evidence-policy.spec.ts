import { describe, expect, it } from 'vitest';
import { adjudicateAnatomyEvidence, ANATOMY_EVIDENCE_VERSION, type AnatomyEvidence, type AnatomyExpectation } from './anatomy-evidence-policy';

const box = { x: 0.1, y: 0.2, width: 0.1, height: 0.1 };
const boundary = { region: box, observation: 'Visible attachment or foreground edge' };
const expected = (): AnatomyExpectation => ({ candidateSha: 'a'.repeat(64), contextSha: 'b'.repeat(64),
  subjects: [{ id: 'child', maxVisibleHands: 2, maxVisibleFeet: 2 }] });
const fixture = (): AnatomyEvidence => ({ version: ANATOMY_EVIDENCE_VERSION,
  candidateSha: expected().candidateSha, contextSha: expected().contextSha, coverage: 'complete',
  subjects: [{ id: 'child', parts: [{ id: 'hand_a', kind: 'hand_endpoint', region: box, attachment: { state: 'attached', boundary } }] }] });

describe('offline evidence rules (synthetic observations, NOT visual accuracy)', () => {
  it('accepts a visible attachment without inventing the other limbs', () => {
    expect(adjudicateAnatomyEvidence(fixture(), expected()).disposition).toBe('observed_pass');
  });
  it.each(['occluded', 'hidden'] as const)('accepts supported %s without demanding a visible shoulder', state => {
    const f = fixture(), part = f.subjects[0].parts[0];
    part.attachment = { state, occluder: 'foreground instrument', boundary };
    if (state === 'hidden') part.region = null;
    expect(adjudicateAnatomyEvidence(f, expected()).disposition).toBe('observed_pass');
  });
  it('holds unresolved visible attachment instead of granting repair', () => {
    const f = fixture(); f.subjects[0].parts[0].attachment = { state: 'unresolved', observation: 'Ownership or connection cannot be settled' };
    expect(adjudicateAnatomyEvidence(f, expected())).toMatchObject({ disposition: 'held_uncertain', defects: [], repairAuthorized: false });
  });
  it.each(['extra_part', 'disconnected_fragment', 'merged_parts', 'impossible_joint'] as const)('retains localized %s', kind => {
    const f = fixture(); f.subjects[0].parts[0].attachment = { state: 'defect', kind, observation: 'Visible contour contradiction', correction: 'Correct the identified contour' };
    expect(adjudicateAnatomyEvidence(f, expected())).toMatchObject({ disposition: 'observed_defect', defects: [{ kind }], renderAuthorized: false, repairAuthorized: false });
  });
  it('supports an additional fragment beyond four ordinary records', () => {
    const f = fixture(), part = f.subjects[0].parts[0];
    f.subjects[0].parts = Array.from({ length: 4 }, (_, i) => ({ ...part, id: `limb_${i}`, kind: 'limb' }));
    f.subjects[0].parts.push({ id: 'extra_fragment', kind: 'fragment', region: box,
      attachment: { state: 'defect', kind: 'disconnected_fragment', observation: 'Exposed separate fragment', correction: 'Remove disconnected fragment' } });
    expect(adjudicateAnatomyEvidence(f, expected()).defects).toHaveLength(1);
  });
  it.each(['hand_endpoint', 'foot_endpoint'] as const)('detects excess distinct observed %s against external limits', kind => {
    const f = fixture(); f.subjects[0].parts = Array.from({ length: 3 }, (_, i) => ({ ...f.subjects[0].parts[0], id: `part_${i}`, region: { ...box, x: 0.1 + i * 0.15 }, kind }));
    expect(adjudicateAnatomyEvidence(f, expected()).disposition).toBe('observed_defect');
  });
  it('does not impose human limb counts on canonical four-handed creatures', () => {
    const f = fixture(), e = expected(); e.subjects[0].maxVisibleHands = 4;
    f.subjects[0].parts = Array.from({ length: 4 }, (_, i) => ({ ...f.subjects[0].parts[0], id: `hand_${i}`, region: { ...box, x: 0.1 + i * 0.15 } }));
    expect(adjudicateAnatomyEvidence(f, e).disposition).toBe('observed_pass');
    e.subjects[0].maxVisibleHands = null;
    expect(adjudicateAnatomyEvidence(f, e).disposition).toBe('observed_pass');
  });
  it('does not count a hidden or unresolved endpoint as a definite excess', () => {
    const f = fixture(); f.subjects[0].parts = Array.from({ length: 3 }, (_, i) => ({ ...f.subjects[0].parts[0], id: `hand_${i}`, region: { ...box, x: 0.1 + i * 0.15 } }));
    f.subjects[0].parts[2].attachment = { state: 'unresolved', observation: 'Could belong to another person' };
    expect(adjudicateAnatomyEvidence(f, expected())).toMatchObject({ disposition: 'held_uncertain', defects: [] });
    f.subjects[0].parts[2] = { ...f.subjects[0].parts[2], region: null, attachment: { state: 'hidden', occluder: 'torso', boundary } };
    expect(adjudicateAnatomyEvidence(f, expected()).disposition).toBe('observed_pass');
  });
  it('does not combine hands from different people', () => {
    const f = fixture(), e = expected();
    f.subjects.push({ ...f.subjects[0], id: 'other_person' });
    e.subjects.push({ ...e.subjects[0], id: 'other_person' });
    expect(adjudicateAnatomyEvidence(f, e).disposition).toBe('observed_pass');
  });
  it('holds duplicate endpoint regions instead of counting repeated crop observations as extra hands', () => {
    const f = fixture(); f.subjects[0].parts = Array.from({ length: 3 }, (_, i) => ({ ...f.subjects[0].parts[0], id: `hand_${i}` }));
    expect(adjudicateAnatomyEvidence(f, expected())).toMatchObject({ disposition: 'held_uncertain', defects: [], repairAuthorized: false });
  });
  it.each(['incomplete', 'missing_subject', 'unknown_subject'])('holds %s coverage', problem => {
    const f = fixture(), e = expected();
    if (problem === 'incomplete') f.coverage = 'incomplete';
    if (problem === 'missing_subject') e.subjects.push({ ...e.subjects[0], id: 'second_child' });
    if (problem === 'unknown_subject') f.subjects[0].id = 'unassigned';
    expect(adjudicateAnatomyEvidence(f, e).disposition).toBe('held_uncertain');
  });
  it('keeps known defects alongside an uncertainty hold', () => {
    const f = fixture(); f.coverage = 'incomplete';
    f.subjects[0].parts[0].attachment = { state: 'defect', kind: 'extra_part', observation: 'Extra visible hand', correction: 'Remove extra hand' };
    expect(adjudicateAnatomyEvidence(f, expected())).toMatchObject({ disposition: 'held_uncertain', defects: [{ kind: 'extra_part' }], repairAuthorized: false });
  });
  it.each(['candidateSha', 'contextSha'] as const)('rejects stale %s', key => {
    const f = fixture(); f[key] = 'c'.repeat(64);
    expect(() => adjudicateAnatomyEvidence(f, expected())).toThrow('anatomy_evidence_binding');
  });
  it.each(['report_subject', 'expected_subject', 'part'])('rejects duplicate %s', kind => {
    const f = fixture(), e = expected();
    if (kind === 'report_subject') f.subjects.push(f.subjects[0]);
    if (kind === 'expected_subject') e.subjects.push(e.subjects[0]);
    if (kind === 'part') f.subjects[0].parts.push(f.subjects[0].parts[0]);
    expect(() => adjudicateAnatomyEvidence(f, e)).toThrow(/anatomy_duplicate/);
  });
  it.each(['missing_boundary', 'empty_occluder', 'visible_null', 'hidden_box', 'invalid_box', 'empty_correction', 'invented_boolean'])('rejects malformed %s evidence', kind => {
    const f = fixture(), part = f.subjects[0].parts[0];
    if (kind === 'missing_boundary') Object.assign(part, { attachment: { state: 'occluded', occluder: 'cart' } });
    if (kind === 'empty_occluder') part.attachment = { state: 'occluded', occluder: ' ', boundary };
    if (kind === 'visible_null') part.region = null;
    if (kind === 'hidden_box') part.attachment = { state: 'hidden', occluder: 'cart', boundary };
    if (kind === 'invalid_box') part.region = { ...box, x: 0.95 };
    if (kind === 'empty_correction') part.attachment = { state: 'defect', kind: 'extra_part', observation: 'extra', correction: '' };
    if (kind === 'invented_boolean') Object.assign(part.attachment, { proximalAttachmentVisible: true });
    expect(() => adjudicateAnatomyEvidence(f, expected())).toThrow();
  });
  it('cannot determine whether a syntactically supported attachment was hallucinated', () => {
    const result = adjudicateAnatomyEvidence(fixture(), expected());
    expect(result).toMatchObject({ disposition: 'observed_pass', pixelAccuracyProven: false, renderAuthorized: false, repairAuthorized: false });
  });
});
