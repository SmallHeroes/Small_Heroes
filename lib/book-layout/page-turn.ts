export type PageTurnDirection = 'initial' | 'forward' | 'backward';

export const DESKTOP_PAGE_CURL_SLICE_COUNT = 12;

const MIN_PAGE_CURL_SLICE_COUNT = 4;
const MAX_PAGE_CURL_SLICE_COUNT = 24;
const MAX_PAGE_CURL_RADIANS = (34 * Math.PI) / 180;

export type DesktopPageCurlSlicePose = Readonly<{
  sourceIndex: number;
  backSourceIndex: number;
  outwardIndex: number;
  rotationYDeg: number;
  translateXPx: number;
  translateZPx: number;
  shadeOpacity: number;
  scaleX: number;
}>;

export type DesktopPageCurlLandingGeometry = Readonly<{
  /** Destination page left edge, relative to the source page left edge. */
  targetOffsetXPx: number;
  /** Destination page width. May differ from the source page width. */
  targetPageWidth: number;
}>;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizedSliceCount(value: number): number {
  if (!Number.isFinite(value)) return DESKTOP_PAGE_CURL_SLICE_COUNT;
  return Math.min(
    MAX_PAGE_CURL_SLICE_COUNT,
    Math.max(MIN_PAGE_CURL_SLICE_COUNT, Math.trunc(value)),
  );
}

/**
 * Models a page as a connected horizontal chain of narrow paper strips.
 *
 * Every strip has its own orientation, but its centre is integrated from the
 * preceding strip's outer edge. This preserves edge continuity while the
 * cosine/sine curl profile makes the sheet flex instead of rotating as a card.
 * At progress 0 and 1 all strips are exactly coplanar.
 */
export function desktopPageCurlSlicePoses(
  direction: Exclude<PageTurnDirection, 'initial'>,
  progress: number,
  pageWidth: number,
  requestedSliceCount = DESKTOP_PAGE_CURL_SLICE_COUNT,
  landingGeometry?: DesktopPageCurlLandingGeometry,
): readonly DesktopPageCurlSlicePose[] {
  const sliceCount = normalizedSliceCount(requestedSliceCount);
  const safePageWidth = Number.isFinite(pageWidth) && pageWidth > 0 ? pageWidth : 1;
  const clampedProgress = clamp01(progress);
  const defaultTargetOffset = direction === 'forward' ? safePageWidth : -safePageWidth;
  const targetPageWidth = Number.isFinite(landingGeometry?.targetPageWidth) &&
    (landingGeometry?.targetPageWidth ?? 0) > 0
    ? landingGeometry!.targetPageWidth
    : safePageWidth;
  const targetOffsetX = Number.isFinite(landingGeometry?.targetOffsetXPx)
    ? landingGeometry!.targetOffsetXPx
    : defaultTargetOffset;
  const currentPageWidth = safePageWidth +
    (targetPageWidth - safePageWidth) * clampedProgress;
  const sourceSliceWidth = safePageWidth / sliceCount;
  const sliceWidth = currentPageWidth / sliceCount;
  const arc = clampedProgress === 0 || clampedProgress === 1
    ? 0
    : Math.sin(clampedProgress * Math.PI);
  const baseAngle = clampedProgress * Math.PI;
  const outwardSign = direction === 'forward' ? -1 : 1;
  const rotationSign = direction === 'forward' ? 1 : -1;
  const sourceAnchorX = direction === 'forward' ? safePageWidth : 0;
  const targetAnchorX = direction === 'forward'
    ? targetOffsetX
    : targetOffsetX + targetPageWidth;
  let edgeX = sourceAnchorX + (targetAnchorX - sourceAnchorX) * clampedProgress;
  let edgeZ = 0;
  const poses: DesktopPageCurlSlicePose[] = [];

  for (let outwardIndex = 0; outwardIndex < sliceCount; outwardIndex += 1) {
    const sourceIndex = direction === 'forward'
      ? sliceCount - 1 - outwardIndex
      : outwardIndex;
    const distanceFromSpine = (outwardIndex + 0.5) / sliceCount;
    const curlProfile =
      0.78 * Math.cos(Math.PI * distanceFromSpine) +
      0.22 * Math.sin(2 * Math.PI * distanceFromSpine);
    const localAngle = Math.min(
      Math.PI,
      Math.max(0, baseAngle + arc * MAX_PAGE_CURL_RADIANS * curlProfile),
    );
    const segmentX = outwardSign * sliceWidth * Math.cos(localAngle);
    const segmentZ = sliceWidth * Math.sin(localAngle);
    const desiredCenterX = edgeX + segmentX / 2;
    const desiredCenterZ = edgeZ + segmentZ / 2;
    const initialCenterX = (sourceIndex + 0.5) * sourceSliceWidth;

    poses.push({
      sourceIndex,
      backSourceIndex: sliceCount - 1 - sourceIndex,
      outwardIndex,
      rotationYDeg: rotationSign * (localAngle * 180) / Math.PI,
      translateXPx: desiredCenterX - initialCenterX,
      translateZPx: desiredCenterZ,
      shadeOpacity: arc * (0.018 + 0.05 * Math.abs(curlProfile)),
      scaleX: currentPageWidth / safePageWidth,
    });

    edgeX += segmentX;
    edgeZ += segmentZ;
  }

  return poses;
}

/** Direction is derived only from scene order, never from story or locale prose. */
export function pageTurnDirectionForIndexChange(
  currentIndex: number,
  nextIndex: number,
): PageTurnDirection {
  if (nextIndex === currentIndex) return 'initial';
  return nextIndex > currentIndex ? 'forward' : 'backward';
}

export type ReaderRestartTransition = Readonly<{
  sceneIndex: 0;
  pageTurnDirection: 'initial';
}>;

/** Restart is a state reset, not a synthetic backward turn from the final scene. */
export function readerRestartTransition(): ReaderRestartTransition {
  return { sceneIndex: 0, pageTurnDirection: 'initial' };
}
