import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { BookShotPlan } from '../../book-shot-plan';
import {
  blueprintStoryboardFrameSignature,
  projectPageShotToBlueprintStoryboard,
  validateBlueprintStoryboardDiversity,
} from '../blueprint-storyboard-diversity';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function foxPlan(): BookShotPlan {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        repoRoot,
        'story-bank',
        'v3-approved',
        'fox_uri_adventure.shot-plan.json',
      ),
      'utf8',
    ),
  ) as BookShotPlan;
}

describe('Blueprint storyboard diversity projection', () => {
  it('projects the canonical twelve-page Fox shot plan into a varied portrait storyboard', () => {
    const layouts = foxPlan().pages.map(projectPageShotToBlueprintStoryboard);

    expect(layouts).toHaveLength(12);
    expect(validateBlueprintStoryboardDiversity(layouts)).toEqual([]);
    expect(new Set(layouts.map(blueprintStoryboardFrameSignature)).size).toBe(12);
    expect(layouts[4].camera).toEqual({ shot: 'tracking', angle: 'low_angle' });
    expect(layouts[9].camera.shot).toBe('wide');
    expect(layouts[10].camera.shot).toBe('medium');
    expect(layouts[11].camera.shot).toBe('wide');
    expect(layouts[9].focalRegion).not.toEqual(layouts[11].focalRegion);
    expect(
      layouts.every((layout) =>
        [
          layout.childRegion,
          layout.companionRegion,
          layout.focalRegion,
          layout.actionRegion,
        ].every((region) => region.y + region.height <= 750),
      ),
    ).toBe(true);
  });

  it('rejects adjacent camera-plus-placement identity', () => {
    const layouts = foxPlan().pages.map(projectPageShotToBlueprintStoryboard);
    layouts[1] = { ...layouts[0], pageNumber: 2 };

    expect(validateBlueprintStoryboardDiversity(layouts)).toContain(
      'pages 1-2 have identical camera and key placement signatures',
    );
  });

  it('rejects whole-book camera and placement vocabularies that are too small', () => {
    const first = projectPageShotToBlueprintStoryboard(foxPlan().pages[0]);
    const layouts = Array.from({ length: 12 }, (_, index) => ({
      ...structuredClone(first),
      pageNumber: index + 1,
    }));

    expect(validateBlueprintStoryboardDiversity(layouts)).toEqual(
      expect.arrayContaining([
        'camera vocabulary too small: 1',
        'placement vocabulary too small: 1',
      ]),
    );
  });
});
