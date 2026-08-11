import type { PageShot } from '../book-shot-plan';
import type {
  BlueprintFrameCamera,
  BlueprintRegion,
} from '../visual-package/preRenderBlueprintTypes';

export const BLUEPRINT_STORYBOARD_PROJECTION_VERSION =
  'blueprint-storyboard-projection/v1' as const;

export interface BlueprintStoryboardLayout {
  version: typeof BLUEPRINT_STORYBOARD_PROJECTION_VERSION;
  pageNumber: number;
  camera: Omit<BlueprintFrameCamera, 'affordanceId'>;
  childRegion: BlueprintRegion;
  companionRegion: BlueprintRegion;
  focalRegion: BlueprintRegion;
  actionRegion: BlueprintRegion;
}

export interface StoryboardFrameSignatureInput {
  camera: Pick<BlueprintFrameCamera, 'shot' | 'angle'>;
  childRegion: BlueprintRegion;
  companionRegion: BlueprintRegion;
  focalRegion: BlueprintRegion;
}

function cameraFor(shot: PageShot): BlueprintStoryboardLayout['camera'] {
  const cameraShot: BlueprintFrameCamera['shot'] =
    shot.shot === 'dynamic_angle'
      ? 'tracking'
      : shot.shot === 'intimate' || shot.shot === 'close_up'
        ? 'close_up'
        : shot.shot === 'medium'
          ? 'medium'
          : 'wide';
  const cameraAngle: BlueprintFrameCamera['angle'] =
    shot.angle === 'low'
      ? 'low_angle'
      : shot.angle === 'high'
        ? 'high_angle'
      : shot.angle === 'over_shoulder'
          ? 'three_quarter'
          : shot.shot === 'dynamic_angle'
            ? 'three_quarter'
            : 'eye_level';
  return { shot: cameraShot, angle: cameraAngle };
}

function fitRegionToBodyIllustrationBand(region: BlueprintRegion): BlueprintRegion {
  const scale = 0.75;
  return {
    x: region.x,
    y: Math.round(region.y * scale),
    width: region.width,
    height: Math.round(region.height * scale),
  };
}

const WIDE_LAYOUTS = [
  {
    childRegion: { x: 80, y: 360, width: 280, height: 360 },
    companionRegion: { x: 650, y: 470, width: 200, height: 240 },
    focalRegion: { x: 420, y: 545, width: 210, height: 170 },
    actionRegion: { x: 180, y: 260, width: 650, height: 470 },
  },
  {
    childRegion: { x: 570, y: 350, width: 290, height: 370 },
    companionRegion: { x: 110, y: 485, width: 210, height: 230 },
    focalRegion: { x: 385, y: 530, width: 220, height: 180 },
    actionRegion: { x: 120, y: 250, width: 700, height: 480 },
  },
  {
    childRegion: { x: 90, y: 500, width: 230, height: 270 },
    companionRegion: { x: 350, y: 545, width: 180, height: 210 },
    focalRegion: { x: 650, y: 455, width: 220, height: 230 },
    actionRegion: { x: 120, y: 300, width: 760, height: 450 },
  },
] as const;

const MEDIUM_LAYOUTS = [
  {
    childRegion: { x: 75, y: 300, width: 350, height: 440 },
    companionRegion: { x: 590, y: 410, width: 260, height: 310 },
    focalRegion: { x: 405, y: 565, width: 230, height: 185 },
    actionRegion: { x: 120, y: 270, width: 700, height: 500 },
  },
  {
    childRegion: { x: 535, y: 305, width: 355, height: 435 },
    companionRegion: { x: 120, y: 420, width: 255, height: 300 },
    focalRegion: { x: 360, y: 550, width: 235, height: 190 },
    actionRegion: { x: 100, y: 270, width: 760, height: 500 },
  },
] as const;

const CLOSE_LAYOUTS = [
  {
    childRegion: { x: 45, y: 300, width: 410, height: 465 },
    companionRegion: { x: 535, y: 350, width: 340, height: 390 },
    focalRegion: { x: 355, y: 575, width: 290, height: 180 },
    actionRegion: { x: 90, y: 300, width: 790, height: 470 },
  },
  {
    childRegion: { x: 485, y: 295, width: 420, height: 470 },
    companionRegion: { x: 70, y: 365, width: 340, height: 380 },
    focalRegion: { x: 350, y: 565, width: 300, height: 190 },
    actionRegion: { x: 70, y: 290, width: 820, height: 480 },
  },
] as const;

const TRACKING_LAYOUTS = [
  {
    childRegion: { x: 70, y: 435, width: 260, height: 320 },
    companionRegion: { x: 470, y: 260, width: 250, height: 300 },
    focalRegion: { x: 680, y: 545, width: 190, height: 190 },
    actionRegion: { x: 100, y: 250, width: 780, height: 500 },
  },
  {
    childRegion: { x: 610, y: 430, width: 270, height: 325 },
    companionRegion: { x: 285, y: 255, width: 250, height: 300 },
    focalRegion: { x: 90, y: 545, width: 200, height: 190 },
    actionRegion: { x: 80, y: 250, width: 800, height: 500 },
  },
] as const;

export function projectPageShotToBlueprintStoryboard(
  shot: PageShot,
): BlueprintStoryboardLayout {
  const camera = cameraFor(shot);
  const source =
    camera.shot === 'tracking'
      ? TRACKING_LAYOUTS[(shot.page - 1) % TRACKING_LAYOUTS.length]
      : camera.shot === 'close_up'
        ? CLOSE_LAYOUTS[(shot.page - 1) % CLOSE_LAYOUTS.length]
        : camera.shot === 'medium'
          ? MEDIUM_LAYOUTS[(shot.page - 1) % MEDIUM_LAYOUTS.length]
          : WIDE_LAYOUTS[(shot.page - 1) % WIDE_LAYOUTS.length];
  const pageOffset = shot.page - 1;
  const nudge = (region: BlueprintRegion, xFactor: number, yFactor: number) =>
    fitRegionToBodyIllustrationBand({
      ...region,
      x: region.x + pageOffset * xFactor,
      y: region.y + (pageOffset % 4) * yFactor,
    });
  return {
    version: BLUEPRINT_STORYBOARD_PROJECTION_VERSION,
    pageNumber: shot.page,
    camera,
    childRegion: nudge(source.childRegion, 2, 3),
    companionRegion: nudge(source.companionRegion, -1, 2),
    focalRegion: nudge(source.focalRegion, 1, -2),
    actionRegion: nudge(source.actionRegion, 0, 2),
  };
}

export function blueprintStoryboardFrameSignature(
  frame: StoryboardFrameSignatureInput,
): string {
  const region = (value: BlueprintRegion) =>
    `${value.x},${value.y},${value.width},${value.height}`;
  return [
    frame.camera.shot,
    frame.camera.angle,
    region(frame.childRegion),
    region(frame.companionRegion),
    region(frame.focalRegion),
  ].join('|');
}

export function validateBlueprintStoryboardDiversity(
  layouts: readonly BlueprintStoryboardLayout[],
): string[] {
  const issues: string[] = [];
  const sorted = [...layouts].sort((a, b) => a.pageNumber - b.pageNumber);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const previousSignature = blueprintStoryboardFrameSignature(previous);
    const currentSignature = blueprintStoryboardFrameSignature(current);
    if (previousSignature === currentSignature) {
      issues.push(
        `pages ${previous.pageNumber}-${current.pageNumber} have identical camera and key placement signatures`,
      );
    }
  }
  const cameraVocabulary = new Set(
    sorted.map((entry) => `${entry.camera.shot}/${entry.camera.angle}`),
  );
  const placementVocabulary = new Set(
    sorted.map((entry) =>
      blueprintStoryboardFrameSignature({
        ...entry,
        camera: { shot: 'wide', angle: 'eye_level' },
      }),
    ),
  );
  if (sorted.length >= 8 && cameraVocabulary.size < 4) {
    issues.push(`camera vocabulary too small: ${cameraVocabulary.size}`);
  }
  if (sorted.length >= 8 && placementVocabulary.size < 6) {
    issues.push(`placement vocabulary too small: ${placementVocabulary.size}`);
  }
  return issues;
}
