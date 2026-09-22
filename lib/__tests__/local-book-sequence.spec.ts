import { describe, expect, it } from 'vitest';
import { bookSequenceSchema, validateBookSequence, validateSequenceSelection, sequencePredecessor, sequencePagePacket, sequenceRenderPrompt } from '../local-book-sequence';
import { QUALITY_CATEGORIES } from '../local-preview-quality';
import { previewStory, type PreviewPlan } from '../local-story-preview';

function fixture() {
  const plan: PreviewPlan = { wardrobe: 'blue', visualLanguage: 'watercolor', locations: [{ id: 'garden', design: 'garden' }, { id: 'room', design: 'room' }],
    recurringProps: [{ id: 'hut', design: 'one hut' }, { id: 'ball', design: 'red ball' }],
    pages: [0, 1, 2, 3].map(pageNumber => ({ pageNumber, locationId: 'garden', shot: 'wide', angle: 'high', composition: 'wide', childAction: 'looks', childExpression: 'curious', childGaze: 'hut', companionAction: 'waits', scene: 'garden', props: [{ id: 'hut', state: 'fixed' }] })),
    continuity: { companionStandingHeightInChildHeights: .75,
      entities: [{ id: 'hut', kind: 'prop', invariants: [{ attribute: 'design', value: 'hut' }] }, { id: 'ball', kind: 'prop', invariants: [{ attribute: 'design', value: 'red ball' }] }, { id: 'driver', kind: 'supporting_character', invariants: [{ attribute: 'design', value: 'girl' }] }],
      pages: [0, 1, 2, 3].map(pageNumber => ({ pageNumber, visibleLocationIds: ['garden'], visibleEntityIds: ['hut', 'driver'], changes: [], childHeightFraction: .3, environmentAreaFraction: .65 })) } };
  const sequence = bookSequenceSchema.parse({ version: 'local-book-sequence/v1', sourceSha: 'a'.repeat(64), planSha: 'b'.repeat(64), premise: 'Finding a way to play together', mutableAttributes: [],
    pages: [1, 2, 3].map(pageNumber => ({ pageNumber, sceneId: 'visit', beat: `Beat ${pageNumber}`, sceneChangeEvidence: null, visibleCastIds: ['child', 'companion', 'driver'],
      states: [
        { entityId: 'child', value: { relation: 'beside', targetId: 'hut' } },
        { entityId: 'companion', value: { relation: 'beside', targetId: 'child' } },
        { entityId: 'driver', value: { relation: 'inside', targetId: 'hut' } },
        { entityId: 'hut', value: { relation: 'at', targetId: 'garden' } },
        { entityId: 'ball', value: { relation: 'unestablished', targetId: null } },
      ], transitions: [] })) });
  const story = previewStory('---\ntitle: Cover\npages: 3\n---\n--- Page 1 ---\nShe sits inside.\n--- Page 2 ---\nHe waits outside.\n--- Page 3 ---\nShe comes outside.', 'Bar', 'boy');
  sequence.sourceSha = story.sourceSha;
  const input = { plan, story, planSha: sequence.planSha };
  return { sequence, input };
}
function previous() {
  const candidate = { imageName: 'page-01.png', imageSha: 'c'.repeat(64) }, contextSha = 'd'.repeat(64);
  return { pageNumber: 1, status: 'passed', candidate, contextSha,
    history: [{ candidate, review: { candidateSha: candidate.imageSha, contextSha,
      checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass' as const, observation: 'observed', correction: '' })) } }] };
}
describe('whole-book local sequence state', () => {
  it('rejects detached texts even when their declared hash matches the sequence', () => {
    const { sequence, input } = fixture();
    const texts = [input.story.title, ...input.story.pages.map(p => p.text + ' extra')];
    expect(() => validateBookSequence(sequence, { ...input, texts } as typeof input)).toThrow('source_binding');
    // @ts-expect-error Detached hash/text API must not be reintroduced.
    expect(() => validateBookSequence(sequence, { plan: input.plan, planSha: input.planSha, sourceSha: sequence.sourceSha, texts })).toThrow('source_binding');
  });
  it('rejects modified prose inside a genuine parsed story with unchanged sourceSha', () => {
    const { sequence, input } = fixture();
    input.story.pages.forEach(p => { p.text += ' extra'; });
    expect(() => validateBookSequence(sequence, input)).toThrow('preview_story_source_binding');
  });
  it('rejects a different parsed source even when all original quotes still occur', () => {
    const { sequence, input } = fixture();
    input.story = previewStory('---\ntitle: Cover\npages: 3\n---\n--- Page 1 ---\nShe sits inside. extra\n--- Page 2 ---\nHe waits outside. extra\n--- Page 3 ---\nShe comes outside. extra', 'Bar', 'boy');
    expect(() => validateBookSequence(sequence, input)).toThrow('source_binding');
  });
  it('inherits physical relationships while expressions/camera change', () => {
    const { sequence, input } = fixture(); input.plan.pages[2].angle = 'eye_level'; input.plan.pages[2].childExpression = 'disappointed';
    const before = JSON.stringify({ sequence, input }); const s = validateBookSequence(sequence, input);
    expect(sequencePagePacket(s, input.plan, 2, [previous()]).relations.find(x => x.entityId === 'driver')!.value).toEqual({ relation: 'inside', targetId: 'hut' });
    expect(JSON.stringify({ sequence, input })).toBe(before);
  });
  it.each(['sourceSha', 'planSha'] as const)('rejects stale %s', field => {
    const { sequence, input } = fixture(); sequence[field] = 'f'.repeat(64);
    expect(() => validateBookSequence(sequence, input)).toThrow('source_binding');
  });
  it('rejects unexplained relocation even when location and character inventory match', () => {
    const { sequence, input } = fixture(); sequence.pages[1].states[2].value = { relation: 'beside', targetId: 'hut' };
    expect(() => validateBookSequence(sequence, input)).toThrow('unexplained_change');
  });
  it('accepts an explicit supported movement, not just a blanket freeze', () => {
    const { sequence, input } = fixture(); const p = sequence.pages[2];
    const from = p.states[2].value; p.states[2].value = { relation: 'beside', targetId: 'hut' };
    p.transitions = [{ entityId: 'driver', from, to: p.states[2].value, evidence: 'She comes outside.' }];
    expect(validateBookSequence(sequence, input)).toEqual(sequence);
    p.transitions[0].evidence = 'He waits outside.';
    expect(() => validateBookSequence(sequence, input)).toThrow('transition_evidence');
  });
  it('rejects false before-state, no-op and duplicate transitions', () => {
    for (const kind of ['before', 'noop', 'duplicate']) {
      const { sequence, input } = fixture(); const p = sequence.pages[2];
      const from = { ...p.states[2].value }; if (kind !== 'noop') p.states[2].value = { relation: 'beside', targetId: 'hut' };
      p.transitions = [{ entityId: 'driver', from, to: p.states[2].value, evidence: 'She comes outside.' }];
      if (kind === 'before') p.transitions[0].from.targetId = 'garden';
      if (kind === 'duplicate') p.transitions.push(p.transitions[0]);
      expect(() => validateBookSequence(sequence, input)).toThrow();
    }
  });
  it('preserves an invisible character without forcing it into the frame', () => {
    const { sequence, input } = fixture(); sequence.pages[1].visibleCastIds.pop(); input.plan.continuity!.pages[2].visibleEntityIds.pop();
    const s = validateBookSequence(sequence, input);
    expect(s.pages[1].states[2].value.relation).toBe('inside');
    expect(sequencePagePacket(s, input.plan, 2, [previous()]).relations.some(x => x.entityId === 'driver')).toBe(false);
    expect(s.pages[2].states[2].value.relation).toBe('inside');
  });
  it.each(['missing', 'duplicate', 'unknown', 'self', 'cycle', 'visible_future', 'custody', 'unestablished_target'])('rejects invalid relation inventory: %s', kind => {
    const { sequence, input } = fixture(); const p = sequence.pages[0];
    if (kind === 'missing') p.states.pop();
    if (kind === 'duplicate') p.states.push(p.states[0]);
    if (kind === 'unknown') p.states[2].value.targetId = 'missing';
    if (kind === 'self') p.states[2].value.targetId = 'driver';
    if (kind === 'cycle') p.states[3].value = { relation: 'inside', targetId: 'driver' };
    if (kind === 'visible_future') input.plan.continuity!.pages[1].visibleEntityIds.push('ball');
    if (kind === 'custody') p.states[2].value = { relation: 'held_by', targetId: 'hut' };
    if (kind === 'unestablished_target') p.states[2].value.targetId = 'ball';
    expect(() => validateBookSequence(sequence, input)).toThrow();
  });
  it.each(['coverage', 'cast', 'scene', 'location', 'appearance'])('rejects cross-book drift: %s', kind => {
    const { sequence, input } = fixture();
    if (kind === 'coverage') sequence.pages.pop();
    if (kind === 'cast') sequence.pages[1].visibleCastIds.pop();
    if (kind === 'scene') sequence.pages[1].sceneId = 'new_scene';
    if (kind === 'location') input.plan.pages[2].locationId = 'room';
    if (kind === 'appearance') input.plan.continuity!.pages[2].changes = [{ entityId: 'hut', attribute: 'design', value: 'stone', storyEvidence: 'He waits outside.' }];
    expect(() => validateBookSequence(sequence, input)).toThrow();
  });
  it('scene cut is explicit and does not reuse the previous scene image', () => {
    const { sequence, input } = fixture(); sequence.pages[2].sceneId = 'new_visit'; sequence.pages[2].sceneChangeEvidence = 'She comes outside.';
    const s = validateBookSequence(sequence, input);
    expect(sequencePredecessor(s, 3, [])).toBeNull(); expect(() => validateSequenceSelection(s, [3])).not.toThrow();
  });
  it('validates selection boundaries, not a cover or skipped predecessor', () => {
    const { sequence, input } = fixture(); const s = validateBookSequence(sequence, input);
    expect(() => validateSequenceSelection(s, [1, 2, 3])).not.toThrow();
    for (const pages of [[0, 1], [1, 3], [2], [4]]) expect(() => validateSequenceSelection(s, pages)).toThrow();
  });
  it.each(['missing', 'held', 'wrong_page', 'wrong_hash', 'uncertain'])('never promotes an unsafe predecessor: %s', kind => {
    const { sequence, input } = fixture(); const s = validateBookSequence(sequence, input); const p = previous();
    if (kind === 'held') p.status = 'held_error';
    if (kind === 'wrong_page') p.pageNumber = 0;
    if (kind === 'wrong_hash') p.history[0].review.candidateSha = 'e'.repeat(64);
    if (kind === 'uncertain') Object.assign(p.history[0].review.checks[0], { verdict: 'uncertain' });
    expect(() => sequencePredecessor(s, 2, kind === 'missing' ? [] : [p])).toThrow();
  });
  it('projects book intent/current state without leaking future narrative or unseen objects', () => {
    const { sequence, input } = fixture(); sequence.pages[2].beat = 'FUTURE_UNSEEN';
    const s = validateBookSequence(sequence, input), packet = sequencePagePacket(s, input.plan, 2, [previous()]);
    expect(JSON.stringify(packet)).not.toContain('FUTURE_UNSEEN'); expect(JSON.stringify(packet)).not.toContain('ball');
    expect(packet.bookPremise).toBe(s.premise); expect(packet.predecessor?.authority).toBe('comparison_only_not_canonical');
    const prompt = sequenceRenderPrompt('image 3, when attached = recurring PROP design board ONLY.', packet, 3);
    expect(prompt).not.toContain('recurring PROP'); expect(prompt).toContain('BOOK SEQUENCE STATE:');
    expect(() => sequenceRenderPrompt('', packet, 5)).toThrow('reference_role');
  });
  it('does not claim an exact source quote proves semantic entailment', () => {
    const { sequence, input } = fixture(); const p = sequence.pages[2], from = p.states[2].value;
    p.states[2].value = { relation: 'beside', targetId: 'hut' };
    p.transitions = [{ entityId: 'driver', from, to: p.states[2].value, evidence: 'She' }];
    // Syntactic binding cannot distinguish a weak/truncated quote from sufficient creative authority.
    expect(validateBookSequence(sequence, input)).toEqual(sequence);
  });
});
