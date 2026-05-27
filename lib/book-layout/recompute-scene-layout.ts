import type {
  IllustrationAspect,
  SceneLayout,
  StoryScene,
  TextTreatment,
} from './types';

export function resolveEffectiveLayout(
  layout: SceneLayout,
  aspect: IllustrationAspect,
  hasWideAsset: boolean
): { effectiveLayout: SceneLayout; effectiveAspect: IllustrationAspect } {
  if (layout === 'wide-spread' && aspect === 'wide' && hasWideAsset) {
    return { effectiveLayout: 'wide-spread', effectiveAspect: 'wide' };
  }
  if (layout === 'wide-spread') {
    return { effectiveLayout: 'standard', effectiveAspect: 'portrait' };
  }
  return { effectiveLayout: layout, effectiveAspect: aspect };
}

export type RecomputeSceneLayoutOptions = {
  /** Dev/QA: treat scene as having a wide asset even when only portrait URL exists. */
  assumeWideAsset?: boolean;
};

export function recomputeStorySceneLayout(
  scene: StoryScene,
  options?: RecomputeSceneLayoutOptions
): StoryScene {
  const imageUrl = scene.illustration.imageUrl;
  const hasWideAsset =
    Boolean(options?.assumeWideAsset) ||
    (scene.illustrationAspect === 'wide' && Boolean(imageUrl));

  const { effectiveLayout, effectiveAspect } = resolveEffectiveLayout(
    scene.layout,
    scene.illustrationAspect,
    hasWideAsset
  );

  let textTreatment: TextTreatment = scene.textTreatment;
  if (effectiveLayout === 'wide-spread' && textTreatment === 'standard') {
    textTreatment = 'overlay';
  }
  const effectiveTextTreatment =
    effectiveLayout === 'wide-spread' ? textTreatment : 'standard';

  return {
    ...scene,
    illustration: {
      ...scene.illustration,
      aspect: effectiveAspect,
    },
    textTreatment,
    effectiveLayout,
    effectiveTextTreatment,
  };
}
