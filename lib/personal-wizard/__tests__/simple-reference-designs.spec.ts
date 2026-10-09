import { describe, expect, it } from 'vitest';
import { simpleReferenceEntityDesign, simpleReferenceStateSchema } from '../simple-reference-designs';
import type { PersonalStoryboard } from '../storyboard';

// Only data-projection input, not a reviewed storyboard or pixel authority.
const fixture = () => ({
  plan: { recurringProps: [{ id: 'paper_boat', appearance: 'red folded paper' }], wardrobe: 'teal shirt',
    continuity: { entities: [
      { id: 'paper_boat', kind: 'prop', invariants: [{ attribute: 'crease', value: 'flat' }, { attribute: 'color', value: 'red' }, { attribute: 'material', value: 'paper' }] },
      { id: 'ribbon', kind: 'prop', invariants: [{ attribute: 'color', value: 'gold' }] },
    ], pages: [{ pageNumber: 0, changes: [] }, { pageNumber: 1, changes: [] },
      { pageNumber: 2, changes: [{ entityId: 'paper_boat', attribute: 'crease', value: 'folded boat', storyEvidence: 'She folds it into a boat.' }] }] } },
  sequence: { mutableAttributes: [{ entityId: 'paper_boat', attribute: 'crease' }], pages: [1, 2].map(pageNumber => ({
    pageNumber, states: [{ entityId: 'ribbon', value: { relation: 'attached_to', targetId: 'child' } }],
  })) },
}) as unknown as Pick<PersonalStoryboard, 'plan' | 'sequence'>;
const texts = ['She takes the paper.', 'She folds it into a boat.'];
describe('source-bound reference design projection', () => {
  it('preserves exact legacy design shapes without adding state metadata', () => {
    const b = fixture(), base = { props: b.plan.recurringProps, entities: b.plan.continuity!.entities };
    expect(JSON.stringify(simpleReferenceEntityDesign(b))).toBe(JSON.stringify(base));
    expect(JSON.stringify(simpleReferenceEntityDesign(b, true))).toBe(JSON.stringify({ ...base, childClothingAuthority: 'teal shirt' }));
    expect(() => simpleReferenceEntityDesign(b, undefined, true, texts)).toThrow('simple_reference_state_scope');
  });
  it('projects a differently named mutable attribute with initial and exact source-backed forms, keeping every fixed fact', () => {
    const b = fixture(), design = simpleReferenceEntityDesign(b, true, true, texts);
    expect(design.entities).toEqual(b.plan.continuity!.entities);
    expect('referenceState' in design && design.referenceState).toMatchObject({
      presentation: 'one_known_source_form_per_design_view',
      mutableAttributes: [{ entityId: 'paper_boat', attribute: 'crease', initialValue: 'flat', knownValues: [
        { value: 'flat', pageNumber: 0, evidence: null }, { value: 'folded boat', pageNumber: 2, evidence: texts[1] },
      ] }], stableAttachments: [{ entityId: 'ribbon', relation: 'attached_to', targetId: 'child' }],
    });
    expect(design.entities[0].invariants).toHaveLength(3);
  });
  it('rejects missing/duplicate declarations instead of silently filtering invariants', () => {
    const b = fixture(); b.sequence.mutableAttributes.push({ entityId: 'paper_boat', attribute: 'crease' });
    expect(() => simpleReferenceEntityDesign(b, true, true, texts)).toThrow('simple_reference_state_binding');
    b.sequence.mutableAttributes = [{ entityId: 'paper_boat', attribute: 'absent' }];
    expect(() => simpleReferenceEntityDesign(b, true, true, texts)).toThrow('simple_reference_state_binding');
  });
  it('rejects unsupported source quotes and undeclared changes rather than blessing invented states', () => {
    const b = fixture(), change = b.plan.continuity!.pages[2].changes[0];
    change.storyEvidence = 'Not in the final text.';
    expect(() => simpleReferenceEntityDesign(b, true, true, texts)).toThrow('simple_reference_state_evidence');
    change.storyEvidence = texts[1]; change.attribute = 'color';
    expect(() => simpleReferenceEntityDesign(b, true, true, texts)).toThrow('simple_reference_state_undeclared');
  });
  it('does not treat a transferred or only later-attached item as permanently actor-owned', () => {
    const b = fixture(); b.sequence.pages[1].states[0].value.targetId = 'companion';
    const result = simpleReferenceEntityDesign(b, true, true, texts);
    expect('referenceState' in result && result.referenceState.stableAttachments).toEqual([]);
    b.sequence.pages[0].states[0].value = { relation: 'unestablished', targetId: null };
    const late = simpleReferenceEntityDesign(b, true, true, texts);
    expect('referenceState' in late && late.referenceState.stableAttachments).toEqual([]);
  });
  it('rejects an invented presentation policy or malformed state packet', () => {
    const d = simpleReferenceEntityDesign(fixture(), true, true, texts);
    if (!('referenceState' in d)) throw Error('missing_state');
    expect(simpleReferenceStateSchema.safeParse({ ...d.referenceState, presentation: 'anything_goes' }).success).toBe(false);
    expect(simpleReferenceStateSchema.safeParse({ ...d.referenceState, hiddenOverride: true }).success).toBe(false);
    expect(simpleReferenceStateSchema.safeParse({ ...d.referenceState, mutableAttributes: [{
      entityId: 'paper_boat', attribute: 'crease', initialValue: 'flat', knownValues: [{ value: 'new', pageNumber: 2, evidence: null }],
    }] }).success).toBe(false);
  });
});
