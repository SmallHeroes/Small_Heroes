/**
 * Book Layout v1 — canonical content model (device-agnostic).
 */

export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

export type SceneLayout = 'standard' | 'wide-spread';

export type IllustrationAspect = 'portrait' | 'wide';

export type TextTreatment = 'standard' | 'overlay' | 'captionless';

export type SceneKind = 'cover' | 'dedication' | 'story' | 'end';

export type StorySceneIllustration = {
  imageUrl: string | null;
  aspect: IllustrationAspect;
  alt?: string;
};

/** Optional metadata for future guarded-v2 / stickers — not required in Phase 1. */
export type StorySceneFutureHints = {
  pageIntent?: string;
  sceneMood?: string;
  dominantColor?: string;
  stickerSlotHints?: string[];
  sceneState?: 'daytime' | 'transitional' | 'in-bed' | 'sleeping';
  framingType?:
    | 'wide-establishing'
    | 'medium-environment'
    | 'medium-action'
    | 'close-emotional'
    | 'object-close-up'
    | 'hand-detail'
    | 'over-the-shoulder'
    | 'top-down'
    | 'low-angle'
    | 'intimate-low-light';
  focalObject?: string;
  gestureFocus?: string;
};

export type StoryScene = {
  sceneIndex: number;
  sceneId: string;
  kind: SceneKind;
  text: string;
  illustration: StorySceneIllustration;
  direction: StoryDirection;
  layout: SceneLayout;
  illustrationAspect: IllustrationAspect;
  textTreatment: TextTreatment;
  audioUrl: string | null;
  title?: string | null;
  companionPresent?: boolean;
  emotionalBeat?: string | null;
  /** Effective layout after wide+portrait degradation. */
  effectiveLayout: SceneLayout;
  effectiveTextTreatment: TextTreatment;
  future?: StorySceneFutureHints;
};

export type RenderedBookPayloadMeta = {
  layoutVersion: 'book-layout-v1';
  templateVersion: `${StoryDirection}-v1`;
  sceneCount: number;
};

export type DesktopSpread = {
  sceneIndex: number;
  sceneId: string;
  direction: StoryDirection;
  templateVersion: `${StoryDirection}-v1`;
  bookTitle: string;
  /** Right page (RTL): HTML text */
  textHtml: string;
  text: string;
  showText: boolean;
  textTreatment: TextTreatment;
  /** Left page: illustration */
  illustrationUrl: string | null;
  illustrationAspect: IllustrationAspect;
  isWide: boolean;
  audioUrl: string | null;
  playAudio: boolean;
  /** Chapter mark — first story spread only in Phase 1. */
  showRunningHeader: boolean;
  sceneTitle?: string | null;
};

export type MobilePage = {
  sceneIndex: number;
  sceneId: string;
  direction: StoryDirection;
  templateVersion: `${StoryDirection}-v1`;
  bookTitle: string;
  text: string;
  showText: boolean;
  textTreatment: TextTreatment;
  illustrationUrl: string | null;
  audioUrl: string | null;
  playAudio: boolean;
};

/** Future print adapter — architect only. */
export type PrintPage = {
  sceneIndex: number;
  sceneId: string;
  direction: StoryDirection;
  trimRatio: { widthIn: number; heightIn: number };
  bleedMm: number;
};
