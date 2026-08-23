import type {
  PortraitBlueprintFrame,
  PortraitPageBlueprintFrame,
} from './preRenderBlueprintTypes';

export const PRE_RENDER_BLUEPRINT_MIN_BODY_PAGES_FOR_BOOK_DIVERSITY = 8;

const NORMALIZED_CANVAS_AREA = 1_000_000;
const MIN_CLOSE_UP_KEY_SUBJECT_AREA = 0.1;
const MIN_MEDIUM_CAST_AREA = 0.035;
const MIN_OVER_SHOULDER_CAST_AREA = 0.04;
const MIN_CAST_SCALE_RATIO = 3.5;

function pageFrames(
  frames: readonly PortraitBlueprintFrame[],
): PortraitPageBlueprintFrame[] {
  return frames
    .filter(
      (frame): frame is PortraitPageBlueprintFrame =>
        typeof frame === 'object' &&
        frame !== null &&
        frame.kind === 'page' &&
        typeof frame.pageNumber === 'number' &&
        typeof frame.camera === 'object' &&
        frame.camera !== null &&
        Array.isArray(frame.placements),
    )
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

function areaRatio(region: { width: number; height: number }): number {
  return (region.width * region.height) / NORMALIZED_CANVAS_AREA;
}

function largestKeySubjectArea(frame: PortraitPageBlueprintFrame): number {
  return Math.max(
    0,
    ...frame.placements
      .filter(
        (placement) =>
          typeof placement === 'object' &&
          placement !== null &&
          placement.importance === 'key' &&
          typeof placement.region === 'object' &&
          placement.region !== null &&
          Number.isFinite(placement.region.width) &&
          Number.isFinite(placement.region.height),
      )
      .map((placement) => areaRatio(placement.region)),
  );
}

function largestCastArea(frame: PortraitPageBlueprintFrame): number {
  return Math.max(
    0,
    ...frame.placements
      .filter(
        (placement) =>
          typeof placement === 'object' &&
          placement !== null &&
          typeof placement.subject === 'object' &&
          placement.subject !== null &&
          placement.subject.kind === 'cast' &&
          typeof placement.region === 'object' &&
          placement.region !== null &&
          Number.isFinite(placement.region.width) &&
          Number.isFinite(placement.region.height),
      )
      .map((placement) => areaRatio(placement.region)),
  );
}

/**
 * Validate material camera diversity from the exact approved geometry.
 *
 * This deliberately does not inspect prompt prose. A plan cannot satisfy the
 * policy by renaming a distant layout `close_up`, or by nudging the same tiny
 * figures a few pixels between pages.
 */
export function preRenderBlueprintCompositionPolicyIssues(
  frames: readonly PortraitBlueprintFrame[],
): string[] {
  const pages = pageFrames(frames);
  const issues: string[] = [];

  if (pages.length < PRE_RENDER_BLUEPRINT_MIN_BODY_PAGES_FOR_BOOK_DIVERSITY) {
    return issues;
  }

  for (const frame of pages) {
    const castArea = largestCastArea(frame);
    if (
      frame.camera.shot === 'close_up' &&
      largestKeySubjectArea(frame) < MIN_CLOSE_UP_KEY_SUBJECT_AREA
    ) {
      issues.push(
        `page ${frame.pageNumber} labels a close_up but no key subject occupies at least 10% of the normalized frame`,
      );
    }
    if (frame.camera.shot === 'medium' && castArea < MIN_MEDIUM_CAST_AREA) {
      issues.push(
        `page ${frame.pageNumber} labels a medium shot but its largest cast placement occupies less than 3.5% of the normalized frame`,
      );
    }
    if (
      frame.camera.shot === 'over_shoulder' &&
      castArea < MIN_OVER_SHOULDER_CAST_AREA
    ) {
      issues.push(
        `page ${frame.pageNumber} labels an over_shoulder shot but its largest cast placement occupies less than 4% of the normalized frame`,
      );
    }
  }

  const shots = new Set(pages.map((frame) => frame.camera.shot));
  const angles = new Set(pages.map((frame) => frame.camera.angle));
  if (!shots.has('close_up')) {
    issues.push('an eight-page Blueprint must contain at least one authored close_up frame');
  }
  if (!shots.has('wide')) {
    issues.push('an eight-page Blueprint must contain at least one authored wide frame');
  }
  if (shots.size < 3) {
    issues.push(`an eight-page Blueprint needs at least three shot types; found ${shots.size}`);
  }
  if (angles.size < 3) {
    issues.push(`an eight-page Blueprint needs at least three camera angles; found ${angles.size}`);
  }

  let runLength = 1;
  for (let index = 1; index < pages.length; index += 1) {
    if (pages[index]!.camera.shot === pages[index - 1]!.camera.shot) {
      runLength += 1;
      if (runLength > 2) {
        issues.push(
          `pages ${pages[index - 2]!.pageNumber}-${pages[index]!.pageNumber} repeat the same ${pages[index]!.camera.shot} shot three times in a row`,
        );
        break;
      }
    } else {
      runLength = 1;
    }
  }

  const castAreas = pages.map(largestCastArea).filter((area) => area > 0);
  if (castAreas.length === pages.length) {
    const smallest = Math.min(...castAreas);
    const largest = Math.max(...castAreas);
    const ratio = largest / smallest;
    if (ratio < MIN_CAST_SCALE_RATIO) {
      issues.push(
        `cast scale contrast is too small: ${ratio.toFixed(2)}x; require at least ${MIN_CAST_SCALE_RATIO.toFixed(1)}x between the tightest and widest body-page framing`,
      );
    }
  }

  return issues;
}
