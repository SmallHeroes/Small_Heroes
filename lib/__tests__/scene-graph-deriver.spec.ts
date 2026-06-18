import { describe, expect, it } from 'vitest';
import path from 'path';

import {
  derivePagePlansFromSceneGraph,
  deriveZonesFromSceneGraph,
  loadStoryLocationPlanOverride,
  recurringObjectAppearsOnPage,
  validateSceneGraph,
} from '../story-location-bible';
import type { RecurringObjectLock, SceneGraph } from '../story-location-bible';

function sg(partial: Partial<SceneGraph>): SceneGraph {
  return {
    scenes: [],
    recurringObjects: [],
    ...partial,
  };
}

const TWO_SCENE: SceneGraph = sg({
  scenes: [
    { id: 'sceneA', description: 'A', visualAnchors: ['a1'], pages: [1, 2] },
    { id: 'sceneB', description: 'B', visualAnchors: ['b1'], pages: [3, 4] },
  ],
  recurringObjects: [],
  forbiddenDrift: ['no drift'],
});

describe('SceneGraph deriver', () => {
  it('derives one zone per scene', () => {
    const zones = deriveZonesFromSceneGraph(TWO_SCENE);
    expect(zones.map((z) => z.id)).toEqual(['sceneA', 'sceneB']);
    expect(zones[1].visualAnchors).toEqual(['b1']);
  });

  it('derives pagePlans mapping each page to its scene (full coverage)', () => {
    const plans = derivePagePlansFromSceneGraph(TWO_SCENE, 4);
    expect(plans.map((p) => `${p.page}:${p.zoneId}`)).toEqual([
      '1:sceneA',
      '2:sceneA',
      '3:sceneB',
      '4:sceneB',
    ]);
    expect(plans[3].forbiddenDrift).toEqual(['no drift']);
  });

  it('THROWS on a page-coverage gap when allowCarryForward is not set', () => {
    const gapped = sg({
      scenes: [{ id: 'only', description: 'O', pages: [1, 2] }],
      recurringObjects: [],
    });
    expect(() => derivePagePlansFromSceneGraph(gapped, 4)).toThrow(/coverage gap/i);
  });

  it('carries forward when allowCarryForward:true', () => {
    const gapped = sg({
      scenes: [{ id: 'only', description: 'O', pages: [1, 2] }],
      recurringObjects: [],
      allowCarryForward: true,
    });
    const plans = derivePagePlansFromSceneGraph(gapped, 4);
    expect(plans.map((p) => p.zoneId)).toEqual(['only', 'only', 'only', 'only']);
  });
});

describe('Recurring-object presence policy', () => {
  const base = { id: 'o', label: 'the o', identity: 'an o' };

  it('timeline_only (default): present only on stateTimeline pages', () => {
    const o: RecurringObjectLock = {
      ...base,
      appearsInScenes: ['s'],
      stateTimeline: [{ page: 6, state: 'made' }],
    };
    expect(recurringObjectAppearsOnPage(o, { page: 1, zoneId: 's' })).toBe(false);
    expect(recurringObjectAppearsOnPage(o, { page: 6, zoneId: 's' })).toBe(true);
  });

  it('whole_scene: present on every page of its scenes', () => {
    const o: RecurringObjectLock = {
      ...base,
      presencePolicy: 'whole_scene',
      appearsInScenes: ['s'],
      stateTimeline: [{ page: 6, state: 'x' }],
    };
    expect(recurringObjectAppearsOnPage(o, { page: 1, zoneId: 's' })).toBe(true);
    expect(recurringObjectAppearsOnPage(o, { page: 1, zoneId: 'other' })).toBe(false);
  });

  it('explicit_pages: present only on appearsOnPages', () => {
    const o: RecurringObjectLock = {
      ...base,
      presencePolicy: 'explicit_pages',
      appearsOnPages: [2, 5],
      stateTimeline: [{ page: 9, state: 'x' }],
    };
    expect(recurringObjectAppearsOnPage(o, { page: 2, zoneId: 's' })).toBe(true);
    expect(recurringObjectAppearsOnPage(o, { page: 9, zoneId: 's' })).toBe(false);
  });
});

describe('validateSceneGraph (hard structural signal)', () => {
  it('passes a well-formed graph', () => {
    expect(validateSceneGraph(TWO_SCENE, 4)).toEqual([]);
  });

  it('flags a coverage gap', () => {
    const gapped = sg({ scenes: [{ id: 'only', description: 'O', pages: [1, 2] }], recurringObjects: [] });
    const issues = validateSceneGraph(gapped, 4);
    expect(issues.some((i) => i.code === 'page_coverage_gap')).toBe(true);
  });

  it('flags whole_scene object without appearsInScenes and unknown scene refs', () => {
    const graph = sg({
      scenes: [{ id: 'real', description: 'R', pages: [1] }],
      recurringObjects: [
        { id: 'bad', label: 'b', identity: 'b', presencePolicy: 'whole_scene', stateTimeline: [] },
        { id: 'ghost', label: 'g', identity: 'g', appearsInScenes: ['nope'], stateTimeline: [{ page: 1, state: 'x' }] },
      ],
      allowCarryForward: true,
    });
    const codes = validateSceneGraph(graph, 1).map((i) => i.code);
    expect(codes).toContain('whole_scene_no_scenes');
    expect(codes).toContain('object_unknown_scene');
  });
});

describe('Authored bibles are NOT overridden by the deriver', () => {
  it('koko (authored allowedZones + pagePlans) loads unchanged', () => {
    const koko = path.join(process.cwd(), 'story-bank', 'v3-approved', 'chameleon_koko_fantasy.md');
    const bundle = loadStoryLocationPlanOverride(koko)!;
    expect(bundle).not.toBeNull();
    expect(bundle.pagePlans.length).toBe(16);
    expect(bundle.bible.allowedZones.map((z) => z.id)).toEqual([
      'kindergarten_path',
      'color_gate_threshold',
      'color_courtyard',
      'real_kindergarten_entrance',
    ]);
    // authored pageActions survive (deriver would not produce these)
    expect(bundle.pagePlans.find((p) => p.page === 5)?.pageAction).toMatch(/single Kim|color gate/i);
  });
});
