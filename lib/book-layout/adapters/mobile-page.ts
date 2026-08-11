import { splitIntoSentences } from '../legacy-adapter';
import type { MobilePage, MobileTextPresentation, StoryScene, TextTreatment } from '../types';

export const MOBILE_OVERLAY_LIMITS = Object.freeze({
  characters: 180,
  words: 36,
  sentences: 5,
});

export function mobileTextPresentationFor(
  text: string,
  treatment: TextTreatment,
  showText = true
): MobileTextPresentation {
  if (!showText || treatment === 'captionless') return 'captionless';

  const normalized = text.trim().replace(/\s+/g, ' ');
  const wordCount = normalized ? normalized.split(' ').length : 0;
  const sentenceCount = splitIntoSentences(normalized).length;
  const shortEnoughForOverlay =
    normalized.length <= MOBILE_OVERLAY_LIMITS.characters &&
    wordCount <= MOBILE_OVERLAY_LIMITS.words &&
    sentenceCount <= MOBILE_OVERLAY_LIMITS.sentences;

  return shortEnoughForOverlay ? 'overlay' : 'paper_panel';
}

export function storySceneToMobilePage(scene: StoryScene, bookTitle: string): MobilePage {
  const captionless = scene.effectiveTextTreatment === 'captionless';
  const showText =
    !captionless &&
    scene.kind !== 'cover' &&
    Boolean(scene.text?.trim()) &&
    scene.effectiveTextTreatment !== 'captionless';
  const playAudio = showText && Boolean(scene.audioUrl);
  const textPresentation = mobileTextPresentationFor(
    scene.text,
    scene.effectiveTextTreatment,
    showText
  );

  return {
    sceneIndex: scene.sceneIndex,
    sceneId: scene.sceneId,
    direction: scene.direction,
    templateVersion: `${scene.direction}-v1`,
    bookTitle,
    text: scene.text,
    showText,
    textTreatment: scene.effectiveTextTreatment,
    textPresentation,
    illustrationUrl: scene.illustration.imageUrl,
    audioUrl: scene.audioUrl,
    playAudio,
  };
}

export function storyScenesToMobilePages(scenes: StoryScene[], bookTitle: string): MobilePage[] {
  return scenes.map((s) => storySceneToMobilePage(s, bookTitle));
}
