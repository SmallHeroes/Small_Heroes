/**
 * Dev-only query overrides for book layout QA (ignored in production).
 *
 * ?forceWideSpreadScene=3
 *   Force scene N to wide-spread with wide aspect (assumes wide asset for layout QA).
 *
 * ?forceWideSpreadPortrait=3
 *   Force wide-spread intent on portrait-only illustration — must degrade to standard.
 */

import { recomputeStorySceneLayout } from './recompute-scene-layout';
import type { StoryScene } from './types';

export type DevLayoutQueryFlags = {
  forceWideSpreadScene?: number;
  forceWideSpreadPortrait?: number;
};

export function isDevLayoutOverridesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function parsePositiveInt(raw: string | null | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseDevLayoutFlags(
  input: URLSearchParams | { get(name: string): string | null }
): DevLayoutQueryFlags {
  if (!isDevLayoutOverridesEnabled()) return {};

  const forceWideSpreadScene = parsePositiveInt(input.get('forceWideSpreadScene'));
  const forceWideSpreadPortrait = parsePositiveInt(input.get('forceWideSpreadPortrait'));

  const flags: DevLayoutQueryFlags = {};
  if (forceWideSpreadScene !== undefined) flags.forceWideSpreadScene = forceWideSpreadScene;
  if (forceWideSpreadPortrait !== undefined) flags.forceWideSpreadPortrait = forceWideSpreadPortrait;
  return flags;
}

/** Resolve N to a scene array index (sceneIndex, page number in sceneId, or 1-based story ordinal). */
export function findSceneArrayIndex(scenes: StoryScene[], n: number): number {
  const bySceneIndex = scenes.findIndex((s) => s.sceneIndex === n);
  if (bySceneIndex >= 0) return bySceneIndex;

  const byPageInId = scenes.findIndex((s) => {
    const m = s.sceneId.match(/(\d+)\s*$/);
    return m ? Number(m[1]) === n : false;
  });
  if (byPageInId >= 0) return byPageInId;

  const storyOnly = scenes.filter((s) => s.kind === 'story');
  if (n >= 1 && n <= storyOnly.length) {
    const target = storyOnly[n - 1];
    return scenes.findIndex((s) => s.sceneId === target?.sceneId);
  }

  return -1;
}

function forceWideSpreadOnScene(
  scene: StoryScene,
  mode: 'wide-asset' | 'portrait-fallback'
): StoryScene {
  if (scene.kind !== 'story') return scene;

  const illustrationAspect = mode === 'wide-asset' ? 'wide' : 'portrait';
  const patched: StoryScene = {
    ...scene,
    layout: 'wide-spread',
    illustrationAspect,
    illustration: { ...scene.illustration, aspect: illustrationAspect },
  };

  return recomputeStorySceneLayout(patched, {
    assumeWideAsset: mode === 'wide-asset',
  });
}

export function applyDevLayoutOverrides(
  scenes: StoryScene[],
  flags: DevLayoutQueryFlags
): StoryScene[] {
  if (!isDevLayoutOverridesEnabled()) return scenes;
  if (flags.forceWideSpreadScene === undefined && flags.forceWideSpreadPortrait === undefined) {
    return scenes;
  }

  let next = scenes.map((s) => ({
    ...s,
    illustration: { ...s.illustration },
  }));

  if (flags.forceWideSpreadPortrait !== undefined) {
    const idx = findSceneArrayIndex(next, flags.forceWideSpreadPortrait);
    if (idx >= 0) {
      next[idx] = forceWideSpreadOnScene(next[idx]!, 'portrait-fallback');
    }
  }

  if (flags.forceWideSpreadScene !== undefined) {
    const idx = findSceneArrayIndex(next, flags.forceWideSpreadScene);
    if (idx >= 0) {
      next[idx] = forceWideSpreadOnScene(next[idx]!, 'wide-asset');
    }
  }

  return next;
}
