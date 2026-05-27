import type { DesktopSpread, StoryScene } from '../types';

export type DesktopSpreadOptions = {
  showRunningHeader?: boolean;
};

export function storySceneToDesktopSpread(
  scene: StoryScene,
  bookTitle: string,
  options?: DesktopSpreadOptions
): DesktopSpread {
  const isWide = scene.effectiveLayout === 'wide-spread';
  const captionless = scene.effectiveTextTreatment === 'captionless';
  const overlay = scene.effectiveTextTreatment === 'overlay';
  const showText = !captionless && Boolean(scene.text?.trim());
  const playAudio = showText && Boolean(scene.audioUrl);

  return {
    sceneIndex: scene.sceneIndex,
    sceneId: scene.sceneId,
    direction: scene.direction,
    templateVersion: `${scene.direction}-v1`,
    bookTitle,
    text: scene.text,
    textHtml: scene.text,
    showText,
    textTreatment: scene.effectiveTextTreatment,
    illustrationUrl: scene.illustration.imageUrl,
    illustrationAspect: scene.illustration.aspect,
    isWide,
    audioUrl: scene.audioUrl,
    playAudio,
    showRunningHeader: options?.showRunningHeader ?? false,
    sceneTitle: scene.title ?? null,
  };
}

export function storyScenesToDesktopSpreads(
  scenes: StoryScene[],
  bookTitle: string
): DesktopSpread[] {
  return scenes.map((s) => storySceneToDesktopSpread(s, bookTitle));
}
