import { describe, expect, it } from 'vitest';
import { LOCATION_SHEET_PROJECTION, LOCATION_SHEET_PROJECTION_V2, locationSheetProjection } from '../location-sheet-projection';
import { auditionEntitySheetPrompt, auditionSheetContext, auditionSheetPrompt, sheetRepairPrompt } from '../simple-book-reviewed-audition';

function fixture() {
  const referenceOwnership = { version: 'disjoint-reference-ownership/v1', assignments: [
    { entityId: 'toy_box', kind: 'prop', role: 'entities' },
    { entityId: 'bird', kind: 'supporting_character', role: 'entities' },
    { entityId: 'orb', kind: 'prop', role: 'entities' },
    { entityId: 'rail', kind: 'landmark', role: 'locations' },
  ] };
  const referenceState = { version: 'source-bound-reference-state/v1', presentation: 'one_known_source_form_per_design_view', mutableAttributes: [], stableAttachments: [] };
  const pageDeferred = [
    { entityId: 'toy_box', requirement: 'formation = a folded blue bridge', reason: 'later_state', source: { pageNumber: 3, evidence: 'a synthetic exact quote' }, verifiedOn: 'page_3' },
    { entityId: 'rail', requirement: 'aperture = open', reason: 'later_state', source: { pageNumber: 4, evidence: 'another synthetic quote' }, verifiedOn: 'page_4' },
    { entityId: 'child', requirement: 'childClothingAuthority', reason: 'actor_owned_clothing', source: { field: 'plan.actorAppearance.child.clothing' }, verifiedOn: 'child_reference_and_pages' },
  ];
  const entities = { referenceOwnership, referenceState, pageDeferred, entities: [
    { id: 'toy_box', kind: 'prop', invariants: [{ attribute: 'design', value: 'A blue folding container.' }] },
    { id: 'bird', kind: 'supporting_character', invariants: [{ attribute: 'design', value: 'A small silver bird.' }] },
    { id: 'orb', kind: 'prop', invariants: [{ attribute: 'design', value: 'A copper sphere with seven dark spots.' }] },
  ], props: [{ id: 'toy_box', design: 'A container with two hinges.' }, { id: 'orb', design: 'A copper sphere.' }] };
  const locations = { referenceOwnership, referenceState, pageDeferred, props: [],
    locations: [{ id: 'room', design: 'A pale room, the folding structure beside its window.' }, { id: 'roof', design: 'A folded blue bridge leads past a copper sphere over these roofs.' }],
    landmarks: [{ id: 'rail', kind: 'landmark', invariants: [{ attribute: 'design', value: 'Four wooden posts.' }, { attribute: 'aperture', value: 'closed' }] }] };
  return { entities, locations };
}

describe('locations v2 generator recognition binding (no new source/judge authority)', () => {
  it('describes every excluded ID from its sibling design, including no-deferred entities', () => {
    const { entities, locations } = fixture(), before = JSON.stringify({ entities, locations });
    const prompt = locationSheetProjection(locations, LOCATION_SHEET_PROJECTION_V2, entities);
    expect(prompt).toContain('exactly 2 SEPARATE');
    expect(prompt).toContain('design.pageDeferred items are NOT drawn here; later states belong to their pages.');
    const data = JSON.parse(prompt.split('EXCLUDED ENTITY DESCRIPTIONS (recognition only, NEVER drawing tasks): ')[1].split('\n')[0]);
    expect(data.map((d: { entityId: string }) => d.entityId)).toEqual(['toy_box', 'bird', 'orb']);
    expect(data[0]).toEqual({ entityId: 'toy_box', kind: 'prop', initialInvariants: entities.entities[0].invariants,
      propDesign: 'A container with two hinges.', deferredDescriptions: [{ reason: 'later_state', requirement: 'formation = a folded blue bridge' }] });
    expect(data[1].deferredDescriptions).toEqual([]);
    expect(data[2]).toMatchObject({ propDesign: 'A copper sphere.', deferredDescriptions: [] });
    expect(prompt).toContain('ONLY FOR PLACEMENT CONTEXT: do NOT draw');
    expect(JSON.stringify({ entities, locations })).toBe(before);
  });

  it('retains location-owned landmarks in their initial state, never turns their later state into an exclusion of the whole landmark', () => {
    const { entities, locations } = fixture(), prompt = locationSheetProjection(locations, LOCATION_SHEET_PROJECTION_V2, entities);
    const data = JSON.parse(prompt.split('EXCLUDED ENTITY DESCRIPTIONS (recognition only, NEVER drawing tasks): ')[1].split('\n')[0]);
    expect(data.some((d: { entityId: string }) => d.entityId === 'rail')).toBe(false);
    expect(prompt).toContain('landmark keeps its complete initial fixed design and its page-0 attribute values');
    expect(prompt).toContain('every location-owned landmark');
    expect(prompt).toContain('fixed materials/counts');
  });

  it('changes only generator instructions: canonical data, requirements, context hash and entities prompt stay exact', () => {
    const { entities, locations } = fixture(), before = auditionSheetContext('locations', locations);
    const legacy = auditionSheetPrompt('locations', locations), v1 = auditionSheetPrompt('locations', locations, LOCATION_SHEET_PROJECTION);
    const v2 = auditionSheetPrompt('locations', locations, LOCATION_SHEET_PROJECTION_V2, entities);
    expect(v2.split('AUTHORITATIVE DESIGN DATA: ')[1]).toBe(legacy.split('AUTHORITATIVE DESIGN DATA: ')[1]);
    expect(v1.split('AUTHORITATIVE DESIGN DATA: ')[1]).toBe(legacy.split('AUTHORITATIVE DESIGN DATA: ')[1]);
    expect(auditionSheetContext('locations', locations)).toEqual(before);
    expect(auditionSheetPrompt('entities', entities, LOCATION_SHEET_PROJECTION_V2, entities)).toBe(auditionSheetPrompt('entities', entities));
    expect(v1).not.toContain('EXCLUDED ENTITY DESCRIPTIONS');
    expect(legacy).not.toContain('location-ownership-and-views');
  });

  it('keeps the real repair role order and exact finding; source quotes are not extra generator tasks', () => {
    const { entities, locations } = fixture();
    const prompt = sheetRepairPrompt('locations', locations, [{ impact: 'continuity', requirement: 'sheet_scope', note: 'Synthetic unexpected object.', bound: true, category: 'scene', verdict: 'defect' }], LOCATION_SHEET_PROJECTION_V2, entities);
    expect(prompt).toContain('Image 1 is the previous sheet: an EDIT TARGET');
    expect(prompt).toContain('Images 2 and 3 are the approved child and companion');
    expect(prompt).toContain('- [continuity] sheet_scope: Synthetic unexpected object.');
    const exclusions = prompt.split('EXCLUDED ENTITY DESCRIPTIONS (recognition only, NEVER drawing tasks): ')[1].split('\n')[0];
    expect(exclusions).not.toContain('a synthetic exact quote');
    expect(exclusions).not.toContain('another synthetic quote');
  });

  it.each(['missing', 'wrong_role', 'missing_entity', 'duplicate_entity', 'wrong_kind', 'wrong_ownership', 'wrong_deferred', 'duplicate_prop', 'wrong_prop_kind', 'duplicate_attribute'])('refuses %s sibling data before rendering', kind => {
    const f = fixture(), e: any = structuredClone(f.entities);
    if (kind === 'missing') return expect(() => locationSheetProjection(f.locations, LOCATION_SHEET_PROJECTION_V2)).toThrow();
    if (kind === 'wrong_role') return expect(() => locationSheetProjection(f.locations, LOCATION_SHEET_PROJECTION_V2, f.locations)).toThrow();
    if (kind === 'missing_entity') e.entities.pop();
    if (kind === 'duplicate_entity') e.entities.push(e.entities[0]);
    if (kind === 'wrong_kind') e.entities[0].kind = 'landmark';
    if (kind === 'wrong_ownership') e.referenceOwnership.assignments.pop();
    if (kind === 'wrong_deferred') e.pageDeferred[0].requirement += ' changed';
    if (kind === 'duplicate_prop') e.props.push(e.props[0]);
    if (kind === 'wrong_prop_kind') e.props.push({ id: 'bird', design: 'A prop that belongs to a character ID.' });
    if (kind === 'duplicate_attribute') e.entities[0].invariants.push(e.entities[0].invariants[0]);
    expect(() => locationSheetProjection(f.locations, LOCATION_SHEET_PROJECTION_V2, e)).toThrow();
  });

  it('does not silently use v2 when an unknown policy is supplied', () => {
    const { entities, locations } = fixture();
    expect(() => auditionSheetPrompt('locations', locations, 'unknown' as any, entities)).toThrow('location_sheet_projection_policy');
  });
});

describe('entities generator drawing inventory', () => {
  it('sends only the owned tile inventory and keeps the judge context complete', () => {
    const { entities } = fixture();
    const input = entities as unknown as Parameters<typeof auditionEntitySheetPrompt>[0];
    const original = auditionSheetContext('entities', input);
    const prompt = auditionEntitySheetPrompt(input);
    const packet = JSON.parse(prompt.split('DRAWING DATA: ')[1]);
    expect(prompt).toContain('Draw exactly 3 separated tiles.');
    expect(packet.tiles.map((tile: { id: string }) => tile.id)).toEqual(['toy_box', 'bird', 'orb']);
    expect(packet.tiles[0]).toMatchObject({ kind: 'prop', design: 'A container with two hinges.', invariants: entities.entities[0].invariants });
    expect(prompt).not.toContain('referenceOwnership');
    expect(prompt).not.toContain('pageDeferred');
    expect(prompt).not.toContain('"rail"');
    expect(prompt).not.toContain('folded blue bridge');
    expect(auditionSheetContext('entities', input)).toEqual(original);
    expect(original.context.design).toMatchObject({ referenceOwnership: entities.referenceOwnership, pageDeferred: entities.pageDeferred });
  });

  it('refuses a location tile in the projected entities inventory', () => {
    const { entities, locations } = fixture();
    const mixed = { ...entities, entities: [...entities.entities, ...locations.landmarks] };
    expect(() => auditionEntitySheetPrompt(mixed as unknown as Parameters<typeof auditionEntitySheetPrompt>[0])).toThrow('simple_reference_ownership_binding');
  });
});
