import type { MobilePage, StoryScene } from '../types';

export function storySceneToMobilePage(scene: StoryScene, bookTitle: string): MobilePage {
  const captionless = scene.effectiveTextTreatment === 'captionless';
  const showText =
    !captionless &&
    scene.kind !== 'cover' &&
    Boolean(scene.text?.trim()) &&
    scene.effectiveTextTreatment !== 'captionless';
  const playAudio = showText && Boolean(scene.audioUrl);

  return {
    sceneIndex: scene.sceneIndex,
    sceneId: scene.sceneId,
    direction: scene.direction,
    templateVersion: `${scene.direction}-v1`,
    bookTitle,
    text: scene.text,
    showText,
    textTreatment: scene.effectiveTextTreatment,
    illustrationUrl: scene.illustration.imageUrl,
    audioUrl: scene.audioUrl,
    playAudio,
  };
}

export function storyScenesToMobilePages(scenes: StoryScene[], bookTitle: string): MobilePage[] {
  return scenes.map((s) => storySceneToMobilePage(s, bookTitle));
}
