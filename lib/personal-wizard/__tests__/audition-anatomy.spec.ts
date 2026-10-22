import { describe, it, expect } from 'vitest';
import { anatomyFindings, AUDITION_ANATOMY_VERSION as V, ANATOMY_RENDER_RULES, anatomyPoseStrategy } from '../audition-anatomy';
const part = (value: Record<string, unknown> = {}) => ({ part: 'legs', condition: 'intact', expectedTotal: 4,
  expectationBasis: 'species_anatomy', expectationEvidence: 'The canonical visible actor is a quadruped.', visibleDistinct: 4,
  unseen: 'not_applicable', evidence: 'Four distinct attached limb paths belong to the same torso.', correction: '', ...value });
const raw = (value: Record<string, unknown> = {}, id = 'actor') => ({ version: V,
  actors: [{ actorId: id, region: 'right side full actor', parts: [part(value)] }] });
describe('prospective structural anatomy evidence; synthetic facts are NOT pixel proof', () => {
  it.each([5, 6, 7])('extra %i visible limbs cannot become cosmetic despite intact label', n => {
    expect(anatomyFindings(raw({ visibleDistinct: n }), ['actor'])).toMatchObject([{ impact: 'identity', verdict: 'defect',
      requirement: 'anatomy:actor', derived: true }]);
  });
  it.each(['extra', 'missing', 'detached', 'malformed'])('%s is material without a numeric count', condition => {
    expect(anatomyFindings(raw({ condition, expectedTotal: null, visibleDistinct: null, expectationBasis: 'not_counted' }), ['actor']))
      .toMatchObject([{ impact: 'identity', verdict: 'defect' }]);
  });
  it.each(['occluded', 'off_frame'])('does not demand hidden limbs (%s)', unseen => {
    expect(anatomyFindings(raw({ visibleDistinct: 2, unseen }), ['actor'])).toEqual([]);
  });
  it('a fully hidden actor can have naturally occluded limbs, not an invented absence', () => {
    expect(anatomyFindings(raw({ visibleDistinct: 0, unseen: 'occluded' }), ['actor'])).toEqual([]);
  });
  it.each([{ condition: 'uncertain' }, { visibleDistinct: null, unseen: 'unreadable' }, { visibleDistinct: 3 }])('uncertainty is material %j', p => {
    expect(anatomyFindings(raw(p), ['actor'])).toMatchObject([{ impact: 'identity', verdict: 'uncertain' }]);
  });
  it('intact normal anatomy produces no invented cosmetic defect', () => expect(anatomyFindings(raw(), ['actor'])).toEqual([]));
  it.each(['horse', 'dragon', 'human', 'anything_else'])('uses stable IDs, not a species/name whitelist: %s', id => {
    expect(anatomyFindings(raw({ condition: 'extra' }, id), [id])[0].requirement).toBe(`anatomy:${id}`);
  });
  it('canonical six-limbed design is not forced into a quadruped body', () => {
    expect(anatomyFindings(raw({ expectedTotal: 6, visibleDistinct: 6, expectationBasis: 'canonical_design' }), ['actor'])).toEqual([]);
  });
  it('counts raised limbs as part of the total; no demand to expose hidden limbs', () => {
    expect(ANATOMY_RENDER_RULES).toContain('existing total'); expect(ANATOMY_RENDER_RULES).toContain('naturally hidden');
    expect(ANATOMY_RENDER_RULES).toContain('remaining limbs support');
  });
  it.each(['unknown', 'missing', 'duplicate', 'duplicate-part', 'null-basis', 'number-basis', 'old-version'])('rejects binding/coverage error: %s', kind => {
    const r: any = raw();
    if (kind === 'unknown') r.actors[0].actorId = 'other';
    if (kind === 'missing') r.actors = [];
    if (kind === 'duplicate') r.actors.push(structuredClone(r.actors[0]));
    if (kind === 'duplicate-part') r.actors[0].parts.push(part());
    if (kind === 'null-basis') r.actors[0].parts[0].expectedTotal = null;
    if (kind === 'number-basis') r.actors[0].parts[0].expectationBasis = 'not_counted';
    if (kind === 'old-version') r.version = 'legacy';
    expect(() => anatomyFindings(r, ['actor'])).toThrow();
  });
  it('simplifies only a structural recovery, retaining source action and identity', () => {
    const s = anatomyPoseStrategy([{ key: 'identity:anatomy:actor' }]);
    expect(s).toContain('SIMPLER'); expect(s).toContain('not canonical identity, story action');
    expect(anatomyPoseStrategy([{ key: 'detail:framing' }])).toBe('');
  });
});
