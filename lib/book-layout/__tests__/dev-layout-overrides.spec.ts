import { describe, expect, it } from 'vitest';
import {
  applyDevLayoutOverrides,
  findSceneArrayIndex,
  parseDevLayoutFlags,
} from '../dev-layout-overrides';
import type { StoryScene } from '../types';

function storyScene(partial: Partial<StoryScene> & Pick<StoryScene, 'sceneIndex' | 'sceneId'>): StoryScene {
  return {
    kind: 'story',
    text: 'טקסט',
    illustration: { imageUrl: '/p.png', aspect: 'portrait' },
    direction: 'bedtime',
    layout: 'standard',
    illustrationAspect: 'portrait',
    textTreatment: 'standard',
    audioUrl: null,
    effectiveLayout: 'standard',
    effectiveTextTreatment: 'standard',
    ...partial,
  };
}

describe('dev layout overrides', () => {
  const scenes: StoryScene[] = [
    storyScene({ sceneIndex: 0, sceneId: 'scene-0', kind: 'cover' }),
    storyScene({ sceneIndex: 1, sceneId: 'scene-1' }),
    storyScene({ sceneIndex: 2, sceneId: 'scene-2' }),
    storyScene({ sceneIndex: 3, sceneId: 'scene-3' }),
  ];

  it('finds scene by sceneIndex, page id, or story ordinal', () => {
    expect(findSceneArrayIndex(scenes, 3)).toBe(3);
    expect(findSceneArrayIndex(scenes, 2)).toBe(2);
    const onlyStory = scenes.filter((s) => s.kind === 'story');
    expect(findSceneArrayIndex(onlyStory, 1)).toBe(0);
  });

  it('forces wide-spread with assumed wide asset', () => {
    const out = applyDevLayoutOverrides(scenes, { forceWideSpreadScene: 3 });
    expect(out[3]?.layout).toBe('wide-spread');
    expect(out[3]?.effectiveLayout).toBe('wide-spread');
    expect(out[3]?.illustration.aspect).toBe('wide');
  });

  it('degrades portrait-only forced wide-spread to standard', () => {
    const out = applyDevLayoutOverrides(scenes, { forceWideSpreadPortrait: 3 });
    expect(out[3]?.layout).toBe('wide-spread');
    expect(out[3]?.effectiveLayout).toBe('standard');
    expect(out[3]?.illustration.aspect).toBe('portrait');
  });

  it('parseDevLayoutFlags reads query keys', () => {
    const params = new URLSearchParams('forceWideSpreadScene=3&forceWideSpreadPortrait=5');
    expect(parseDevLayoutFlags(params)).toEqual({
      forceWideSpreadScene: 3,
      forceWideSpreadPortrait: 5,
    });
  });
});
