import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assembleStyle01BookReferencesWithZoneSheets } from '../story-location-bible/zone-sheets';

/**
 * setAppearanceBoard budget-drop regression.
 *
 * The trim loop in assembleStyle01BookReferencesWithZoneSheets used to rebuild `paths` from a
 * separate inline array that OMITTED breakdown.setAppearanceBoard, so the moment any style ref was
 * popped under ref-budget pressure the room anchor (set-appearance board) was silently evicted —
 * the "why did the room change again" bug. The board must be a PROTECTED ref (same tier as child /
 * companion identity refs): style/zone refs drop first, and if nothing droppable remains it must
 * fail loud rather than silently drop the board.
 */
const ENV_KEY = 'GPT_IMAGE_EDIT_MAX_REFERENCES';

function baseInput(maxOverride: string) {
  process.env[ENV_KEY] = maxOverride;
  return {
    styleRefPaths: ['style1.png', 'style2.png'],
    childPhotoPath: 'child.png',
    includeChildPhoto: true,
    companionRefPaths: ['companion.png'],
    otherCharacterRefPaths: [] as string[],
    config: 'A' as const,
    setAppearanceBoardPath: 'board.png',
  };
}

let prevMax: string | undefined;
beforeEach(() => {
  prevMax = process.env[ENV_KEY];
});
afterEach(() => {
  if (prevMax === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = prevMax;
});

describe('assembleStyle01BookReferencesWithZoneSheets — set-appearance board protection', () => {
  it('under budget pressure the board SURVIVES and a lower-priority style ref is trimmed instead', () => {
    // child(1) + companion(1) + board(1) + style(2) = 5 refs, budget 4 → one style ref must drop.
    const { paths, breakdown } = assembleStyle01BookReferencesWithZoneSheets(baseInput('4'));

    expect(paths.length).toBe(4);
    // Protected tier all present.
    expect(paths).toContain('child.png');
    expect(paths).toContain('companion.png');
    expect(paths, 'set-appearance board must NOT be silently dropped').toContain('board.png');
    expect(breakdown.setAppearanceBoard).toEqual(['board.png']);
    // The trimmed ref is a style ref (last popped first), not the board.
    expect(paths).toContain('style1.png');
    expect(paths).not.toContain('style2.png');
    expect(breakdown.style).toEqual(['style1.png']);
  });

  it('keeps the board AND all style refs when the budget is roomy', () => {
    const { paths } = assembleStyle01BookReferencesWithZoneSheets(baseInput('8'));
    expect(paths).toEqual(
      expect.arrayContaining(['child.png', 'companion.png', 'board.png', 'style1.png', 'style2.png'])
    );
    expect(paths.length).toBe(5);
  });

  it('fails LOUD when protected refs alone exceed budget — never silently drops the board', () => {
    // child(1) + companion(1) + board(1) = 3 protected refs, no style to drop, budget 2 → must throw.
    const input = baseInput('2');
    input.styleRefPaths = [];
    expect(() => assembleStyle01BookReferencesWithZoneSheets(input)).toThrow(
      /reference budget exceeded.*set-appearance-board refs must not be evicted/s
    );
  });
});
