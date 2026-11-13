import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { blockedRouteDrawing, initialBlockedRoutesOnPage, locationSpatialDirection } from '../location-spatial-direction';
import { locationSpatialGuide } from '../location-spatial-guide';
import { planGPTImageRequest } from '../../generate-image';

function fixture(route: string, beyond: 'dry' | 'empty', overhead: string) {
  const locationId = 'lower_works', routeId = 'route', obstructionId = 'barrier';
  const condition = `Separate supplies, with the ${route} blocked and ${beyond} beyond its obstruction.`;
  const design = {
    locations: [{ id: locationId, design: 'One room adjoining a yard.' }],
    landmarks: [
      { id: routeId, kind: 'landmark', invariants: [
        { attribute: 'form', value: `The ${route} passes beneath ${overhead}.` },
        { attribute: 'condition', value: condition },
      ] },
      { id: obstructionId, kind: 'landmark', invariants: [
        { attribute: 'form', value: `A screen at the end of the ${beyond} ${route}.` },
        { attribute: 'condition', value: 'Upright and blocking the supply.' },
      ] },
    ],
    referenceState: { mutableAttributes: [{ entityId: routeId, attribute: 'condition', initialValue: condition }] },
  };
  const visibleEntityIds = [routeId, obstructionId];
  const location = { locationId };
  const initial = { visibleEntityIds, changes: [] };
  const book = {
    plan: { pages: [location, location, location, location],
      continuity: { pages: [initial, initial, { visibleEntityIds, changes: [
        { entityId: routeId, attribute: 'condition', value: 'Cleared.', storyEvidence: 'Exact later quote.' },
      ] }, initial] } },
    sequence: { pages: [{ states: visibleEntityIds.map(entityId => ({ entityId, value: { relation: 'at', targetId: locationId } })) }] },
  };
  return { book, design };
}

const compile = (f: ReturnType<typeof fixture>) =>
  locationSpatialDirection(f.book as Parameters<typeof locationSpatialDirection>[0], f.design as Parameters<typeof locationSpatialDirection>[1]);

describe('source-bound location composition', () => {
  it.each([
    ['rain gutter', 'dry', 'the raised terrace'],
    ['service passage', 'empty', 'the timber crossbeam'],
  ] as const)('separates the two sides of the %s without copying its earlier picture', async (route, beyond, overhead) => {
    const f = fixture(route, beyond, overhead);
    const result = compile(f);
    expect(result.routes).toEqual([{ locationId: 'lower_works', routeId: 'route', obstructionId: 'barrier', route, beyond, overhead }]);
    expect(blockedRouteDrawing(result.routes[0])).toContain(`then the ${beyond} continuation of the same route`);
    expect(blockedRouteDrawing(result.routes[0])).toContain(`Keep ${overhead} above the route`);
    const guide = (await locationSpatialGuide(result.routes))!;
    expect(await sharp(guide).metadata()).toMatchObject({ format: 'png', width: 512, height: 152 });
    expect(await locationSpatialGuide(result.routes)).toEqual(guide);
  });

  it.each(['no continuation', 'unrelated obstacle', 'unknown placement', 'ambiguous obstacle', 'negated route'])('abstains for %s', mode => {
    const f = fixture('rain gutter', 'dry', 'the raised terrace');
    if (mode === 'no continuation') f.design.landmarks[0].invariants[1].value = 'The rain gutter is blocked.';
    if (mode === 'unrelated obstacle') f.design.landmarks[1].invariants[0].value = 'A screen near a wall.';
    if (mode === 'unknown placement') f.book.sequence.pages[0].states.pop();
    if (mode === 'ambiguous obstacle') {
      f.design.landmarks.push({ ...f.design.landmarks[1], id: 'second' });
      f.book.sequence.pages[0].states.push({ entityId: 'second', value: { relation: 'at', targetId: 'lower_works' } });
    }
    if (mode === 'negated route') f.design.landmarks[0].invariants[1].value = 'It is untrue that the rain gutter is blocked and dry beyond its obstruction.';
    expect(compile(f).routes).toEqual([]);
  });

  it('omits an initial direction after the route changes and when either landmark is offstage', () => {
    const f = fixture('rain gutter', 'dry', 'the raised terrace');
    const routes = compile(f).routes;
    f.book.plan.continuity.pages[0] = { visibleEntityIds: ['route'], changes: [] };
    const onPage = (n: number) => initialBlockedRoutesOnPage(f.book as Parameters<typeof initialBlockedRoutesOnPage>[0],
      f.design as Parameters<typeof initialBlockedRoutesOnPage>[1], routes, n);
    expect(onPage(0)).toEqual([]);
    expect(onPage(1)).toEqual(routes);
    expect(onPage(2)).toEqual([]);
    expect(onPage(3)).toEqual([]);
  });

  it('labels the diagram only in its exact reference role and refuses swapped or edit-target diagrams', () => {
    const input = { finalPrompt: 'Draw the setting.', referenceMode: 'book_design' as const, referenceImages: ['child', 'companion', 'guide'] };
    const args = { defaultModel: 'gpt-image-2.6-sunburst', defaultQuality: 'low' as const, maxReferences: 4 };
    const plan = planGPTImageRequest({ ...input, referenceRoles: ['child_design_authority', 'companion_design_authority', 'location_layout_guide'] }, args);
    expect(plan.finalPrompt).toContain('Image 3: Source-bound location layout diagram.');
    expect(() => planGPTImageRequest({ ...input, referenceRoles: ['location_layout_guide', 'child_design_authority', 'companion_design_authority'] }, args)).toThrow('Invalid explicit');
    expect(() => planGPTImageRequest({ ...input, referenceRoles: ['rejected_edit_target', 'child_design_authority', 'location_layout_guide'] }, args)).toThrow('Invalid explicit');
  });
});
