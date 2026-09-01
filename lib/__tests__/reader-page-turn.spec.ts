import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_PAGE_CURL_SLICE_COUNT,
  DESKTOP_PAGE_TURN_PERSPECTIVE_PX,
  desktopPageCurlSlicePoses,
  desktopPageTurnVerticalCompensation,
  pageTurnDirectionForIndexChange,
  readerRestartTransition,
} from '../book-layout/page-turn';
import {
  MOBILE_OVERLAY_LIMITS,
  mobileTextPresentationFor,
} from '../book-layout/adapters/mobile-page';
import {
  readerSourceAccessKey,
  readerSourceBookId,
  readerSourceExitHref,
  type ReaderBookSource,
} from '../reader-book-source';
import type { DesktopSpread } from '../book-layout/types';
import {
  clearReaderImageCacheUrls,
  decodeReaderImage,
  getReaderImageCacheState,
  readerImageIsPaintReady,
  recordReaderImageError,
  resetReaderImageCacheUrl,
  retainReaderImageCacheUrls,
} from '../../app/book/[id]/read-v2/useAdjacentImagePreload';
import {
  createDesktopPhysicalPageTurnSettler,
  createDesktopPhysicalPageTurnUnmountGuard,
  desktopPhysicalPageTurnIsAvailable,
  desktopPhysicalPageTurnImagesAreReady,
  scheduleDesktopPhysicalPageTurnHandoff,
} from '../../app/book/[id]/read-v2/components/useDesktopPhysicalPageTurn';

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeReaderImage(
  decode: () => Promise<void>,
  options: { complete?: boolean; naturalWidth?: number } = {},
): HTMLImageElement {
  return {
    complete: options.complete ?? true,
    naturalWidth: options.naturalWidth ?? 1024,
    decode,
  } as unknown as HTMLImageElement;
}

function desktopSpreadWithImage(illustrationUrl: string | null): DesktopSpread {
  return {
    sceneIndex: 0,
    sceneId: 'scene-0',
    direction: 'bedtime',
    templateVersion: 'bedtime-v1',
    bookTitle: 'Book',
    textHtml: '',
    text: 'Page text.',
    showText: true,
    textTreatment: 'standard',
    illustrationUrl,
    illustrationAspect: 'portrait',
    isWide: false,
    audioUrl: null,
    playAudio: false,
    showRunningHeader: false,
  };
}

describe('shared Reader page-turn contract', () => {
  it('derives deterministic forward/backward direction from scene order', () => {
    expect(pageTurnDirectionForIndexChange(1, 2)).toBe('forward');
    expect(pageTurnDirectionForIndexChange(2, 1)).toBe('backward');
    expect(pageTurnDirectionForIndexChange(2, 2)).toBe('initial');
  });

  it('resets restart state without exposing a stale turn direction', () => {
    expect(readerRestartTransition()).toEqual({
      sceneIndex: 0,
      pageTurnDirection: 'initial',
    });
  });

  it('keeps QA and production readers on the same directional data contract', () => {
    const qa = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'viewer', 'DevBookViewer.tsx'),
      'utf8',
    );
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    const illustration = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'SceneIllustration.tsx',
      ),
      'utf8',
    );
    for (const source of [qa, reader]) {
      expect(source).toContain('data-page-turn-direction={pageTurnDirection}');
      expect(source).toContain("data-page-turn-mode={physicalPageTurn ? 'physical-sheet' : 'instant'}");
      expect(source).toContain('<DesktopPhysicalPageTurn');
      expect(source).not.toContain('styles.sceneTurnForward');
      expect(source).not.toContain('styles.sceneTurnBackward');
    }
    expect(reader).toContain('setPageTurnDirection(restart.pageTurnDirection)');
    expect(qa).toContain(
      "useAdjacentImagePreload(imageUrls, sceneIndex, status === 'ready' && scenes.length > 0)",
    );
    expect(qa).not.toContain('useSceneImageQueue');
    expect(illustration).toContain('illustrationState.url === url');
    expect(illustration).toContain('illustrationState.retryNonce === retryNonce');
    expect(illustration.match(/if \(imgRef\.current !== image\) return;/g)).toHaveLength(3);
  });

  it('keeps the old whole-book tilt/fade animation removed', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );
    expect(css).not.toContain('@keyframes readerPageTurnForward');
    expect(css).not.toContain('@keyframes readerPageTurnBackward');
    expect(css).not.toContain('@keyframes readerPageTurnShadow');
    expect(css).not.toContain('.sceneTurnForward');
    expect(css).not.toContain('.sceneTurnBackward');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('turns a connected paper mesh through 180 degrees while the book frame stays static', () => {
    const engine = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopPhysicalPageTurn.tsx',
      ),
      'utf8',
    );
    const spread = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopBookSpread.tsx',
      ),
      'utf8',
    );
    const turnHook = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'useDesktopPhysicalPageTurn.ts',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(engine).toContain('DESKTOP_PAGE_CURL_SLICE_COUNT');
    expect(engine).toContain('desktopPageCurlSlicePoses');
    expect(engine).toContain('styles.physicalTurnSlice');
    expect(engine).not.toContain('styles.physicalTurnSegmentSpine');
    expect(engine).not.toContain('styles.physicalTurnSegmentOuter');
    expect(engine).toContain('styles.physicalTurnFaceBack');
    expect(engine).toContain('fullFrameProjectionIntoPage(pageBox)');
    expect(engine).toContain('? LEFT_PAGE_MASK_WINDOW');
    expect(engine).not.toContain('OPEN_BOOK_PAGE_BOXES.leftPage');
    expect(engine).toContain('src={OPEN_BOOK_ASSET.src}');
    expect(engine).toContain('data-physical-book-substrate');
    expect(engine).toContain('styles.physicalBookSubstrateProjection');
    expect(engine.match(/style=\{pageProjectionStyle\}/g)).toHaveLength(2);
    expect(engine).toContain('<DesktopBookPageSideSurface');
    expect(engine).toContain('side={side}');
    expect(engine).toContain('data-physical-turn-texture-index');
    expect(engine).toContain('nominalSliceWidth');
    expect(engine).toContain('PHYSICAL_TURN_FACE_BLEED_PX');
    expect(engine).toContain('PHYSICAL_TURN_HANDOFF_START');
    expect(engine).toContain('overlay.style.opacity');
    expect(engine).toContain("overlay.style.visibility = 'hidden'");
    expect(engine).not.toContain('data-physical-turn-final-landing');
    expect(engine).not.toContain('MASK_ON_BOOK_ASSET');
    expect(engine).not.toContain('physicalPaperFrame');
    expect(engine).not.toContain('physicalPaperEdge');
    expect(spread).toContain('<DesktopBookPageSurface spread={spread} isCurrent={isCurrent} />');
    expect(spread).not.toContain('physical-turn-spine-clamp');
    expect(spread).toContain('{pageTurnOverlay}');
    expect(css).toContain('backface-visibility: hidden');
    expect(css).toContain('rotateY(var(--physical-turn-rotate-y');
    expect(css).toContain('var(--physical-turn-scale-x, 1)');
    expect(css).toContain('opacity: calc(var(--physical-turn-progress, 0) * 0.38)');
    expect(css).toContain('var(--physical-turn-slice-count)');
    expect(css).toContain('.physicalBookContentProjection');
    expect(css).toContain('.physicalBookSubstrateProjection');
    expect(css).toMatch(
      /\.physicalTurnGuardLeft\s*\{[^}]*left: var\(--book-image-mask-window-x\);[^}]*top: var\(--book-image-mask-window-y\);[^}]*width: var\(--book-image-mask-window-w\);[^}]*height: var\(--book-image-mask-window-h\);/s,
    );
    expect(css).toMatch(
      /\.physicalTurnSheetForward\s*\{[^}]*left: var\(--book-image-mask-window-x\);[^}]*top: var\(--book-image-mask-window-y\);[^}]*width: var\(--book-image-mask-window-w\);[^}]*height: var\(--book-image-mask-window-h\);/s,
    );
    expect(css).toMatch(
      /\.physicalTurnGuardRight\s*\{[^}]*left: var\(--open-right-page-x\);[^}]*top: var\(--open-right-page-y\);[^}]*width: var\(--open-right-page-w\);[^}]*height: var\(--open-right-page-h\);/s,
    );
    expect(css).toMatch(
      /\.physicalTurnSheetBackward\s*\{[^}]*left: var\(--open-right-page-x\);[^}]*top: var\(--open-right-page-y\);[^}]*width: var\(--open-right-page-w\);[^}]*height: var\(--open-right-page-h\);/s,
    );
    expect(css).toMatch(/\.physicalBookSubstrateProjection\s*\{[^}]*z-index: 1;/s);
    expect(css).toMatch(/\.physicalBookContentProjection\s*\{[^}]*z-index: 2;/s);
    expect(css).toMatch(/\.physicalTurnSheetShade\s*\{[^}]*z-index: 3;/s);
    expect(css).not.toContain('.physicalPaperFrame');
    expect(css).not.toContain('.physicalPaperEdge');
    expect(css).not.toContain('.physicalTurnSpineClamp');
    expect(css).toContain('var(--physical-turn-perspective, 6400px)');
    expect(css).toContain('max-width: none');
    expect(css).not.toContain('calc(100% / var(--physical-turn-slice-count) + 0.75px)');
    expect(css).toMatch(
      /\.physicalTurnSlice\s*\{[^}]*width: calc\(100% \/ var\(--physical-turn-slice-count\)\);/s,
    );
    expect(engine).toContain('targetRect.left - sourceRect.left');
    expect(engine).toContain('targetPageWidth: targetRect.width');
    expect(engine).toContain('scheduleDesktopPhysicalPageTurnHandoff');
    expect(engine).toContain('watchdogTimer = window.setTimeout');
    expect(engine).toContain('abortIfStillUnmounted');
    expect(turnHook).toContain('useLayoutEffect(() => cancel, [cancel])');
    expect(turnHook).not.toContain('window.setTimeout');
  });

  it('starts a physical turn only after both illustration textures are decoded', async () => {
    const outgoingUrl = '/reader-turn-outgoing.png';
    const incomingUrl = '/reader-turn-incoming.png';
    const outgoing = desktopSpreadWithImage(outgoingUrl);
    const incoming = desktopSpreadWithImage(incomingUrl);
    let finishIncomingDecode!: () => void;
    const incomingDecode = new Promise<void>((resolve) => {
      finishIncomingDecode = resolve;
    });

    await decodeReaderImage(outgoingUrl, fakeReaderImage(() => Promise.resolve()));
    const pendingDecode = decodeReaderImage(
      incomingUrl,
      fakeReaderImage(() => incomingDecode),
    );
    expect(desktopPhysicalPageTurnImagesAreReady(outgoing, incoming)).toBe(false);

    finishIncomingDecode();
    await pendingDecode;
    expect(desktopPhysicalPageTurnImagesAreReady(outgoing, incoming)).toBe(true);
    expect(
      desktopPhysicalPageTurnImagesAreReady(
        desktopSpreadWithImage(null),
        incoming,
      ),
    ).toBe(false);
  });

  it('fails closed on rejected decode and never upgrades complete dimensions alone', async () => {
    const failedUrl = '/reader-turn-decode-failed.png';
    const decoded = await decodeReaderImage(
      failedUrl,
      fakeReaderImage(() => Promise.reject(new DOMException('bad image', 'EncodingError'))),
    );

    expect(decoded).toBe(false);
    expect(getReaderImageCacheState(failedUrl)).toBe('error');
    expect(readerImageIsPaintReady(failedUrl)).toBe(false);
  });

  it('keeps a synchronous browser-cache probe static until its decode promise resolves', async () => {
    const cachedUrl = '/reader-turn-browser-cache.png';
    let finishDecode!: () => void;
    const decodePromise = new Promise<void>((resolve) => {
      finishDecode = resolve;
    });

    class CachedImageProbe {
      complete = true;
      naturalWidth = 1200;
      decoding = 'auto';
      src = '';
      decode = () => decodePromise;
    }
    vi.stubGlobal('Image', CachedImageProbe);

    expect(readerImageIsPaintReady(cachedUrl)).toBe(false);
    expect(getReaderImageCacheState(cachedUrl)).toBe('loading');
    finishDecode();
    await decodePromise;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(getReaderImageCacheState(cachedUrl)).toBe('decoded');
    expect(readerImageIsPaintReady(cachedUrl)).toBe(true);
  });

  it('keeps a superseded same-URL element loaded without overwriting the retained winner', async () => {
    const url = '/reader-turn-stale-decode.png';
    let finishStaleDecode!: () => void;
    const staleDecode = new Promise<void>((resolve) => {
      finishStaleDecode = resolve;
    });
    const staleResult = decodeReaderImage(url, fakeReaderImage(() => staleDecode));
    const currentResult = decodeReaderImage(
      url,
      fakeReaderImage(() => Promise.resolve()),
    );

    expect(await currentResult).toBe(true);
    finishStaleDecode();
    expect(await staleResult).toBe(true);
    expect(getReaderImageCacheState(url)).toBe('decoded');
    expect(readerImageIsPaintReady(url)).toBe(true);
  });

  it('ignores stale errors after replacement, pruning, and retry reset', async () => {
    const url = '/reader-turn-stale-error.png';
    const staleImage = fakeReaderImage(() => Promise.reject(new Error('stale failure')));
    const retainedImage = fakeReaderImage(() => Promise.resolve());

    await decodeReaderImage(url, retainedImage);
    recordReaderImageError(url, staleImage);
    expect(getReaderImageCacheState(url)).toBe('decoded');
    expect(readerImageIsPaintReady(url)).toBe(true);

    recordReaderImageError(url, retainedImage);
    expect(getReaderImageCacheState(url)).toBe('decoded');

    clearReaderImageCacheUrls([url]);
    recordReaderImageError(url, staleImage);
    expect(getReaderImageCacheState(url)).toBe('unknown');

    await decodeReaderImage(url, retainedImage);
    resetReaderImageCacheUrl(url);
    recordReaderImageError(url, retainedImage);
    expect(getReaderImageCacheState(url)).toBe('unknown');
  });

  it('records an error only for the current failed image owner', async () => {
    const url = '/reader-turn-current-error.png';
    let rejectDecode!: (reason: Error) => void;
    const pendingDecode = new Promise<void>((_resolve, reject) => {
      rejectDecode = reject;
    });
    const owner = fakeReaderImage(
      () => pendingDecode,
      { complete: true, naturalWidth: 0 },
    );

    const result = decodeReaderImage(url, owner);
    await Promise.resolve();
    recordReaderImageError(url, owner);
    expect(getReaderImageCacheState(url)).toBe('error');
    rejectDecode(new Error('current failure'));
    expect(await result).toBe(false);
  });

  it('lets a retry generation replace a failed decode without stale overwrite', async () => {
    const url = '/reader-turn-retry.png';
    const failedOwner = fakeReaderImage(
      () => Promise.reject(new Error('first failure')),
      { complete: true, naturalWidth: 0 },
    );
    expect(await decodeReaderImage(url, failedOwner)).toBe(false);
    expect(getReaderImageCacheState(url)).toBe('error');

    resetReaderImageCacheUrl(url);
    let finishRetry!: () => void;
    const retryDecode = new Promise<void>((resolve) => {
      finishRetry = resolve;
    });
    const retryOwner = fakeReaderImage(() => retryDecode);
    const retryResult = decodeReaderImage(url, retryOwner);
    recordReaderImageError(url, failedOwner);
    expect(getReaderImageCacheState(url)).toBe('loading');
    expect(readerImageIsPaintReady(url)).toBe(false);

    finishRetry();
    expect(await retryResult).toBe(true);
    expect(getReaderImageCacheState(url)).toBe('decoded');
    expect(readerImageIsPaintReady(url)).toBe(true);
  });

  it('does not probe images when viewport or motion settings require a static turn', () => {
    const outgoing = desktopSpreadWithImage('/reader-static-outgoing.png');
    const incoming = desktopSpreadWithImage('/reader-static-incoming.png');
    let imageConstructions = 0;

    class CountingImageProbe {
      complete = false;
      naturalWidth = 0;
      decoding = 'auto';
      src = '';
      constructor() {
        imageConstructions += 1;
      }
      decode = () => Promise.resolve();
    }
    vi.stubGlobal('Image', CountingImageProbe);

    const media = (desktop: boolean, reducedMotion: boolean) => ({
      matchMedia: (query: string) => ({
        matches: query === '(min-width: 1024px)' ? desktop : reducedMotion,
      }),
    });

    vi.stubGlobal('window', media(false, false));
    expect(desktopPhysicalPageTurnIsAvailable(outgoing, incoming)).toBe(false);
    expect(imageConstructions).toBe(0);

    vi.stubGlobal('window', media(true, true));
    expect(desktopPhysicalPageTurnIsAvailable(outgoing, incoming)).toBe(false);
    expect(imageConstructions).toBe(0);

    vi.stubGlobal('window', media(true, false));
    expect(desktopPhysicalPageTurnIsAvailable(outgoing, incoming)).toBe(false);
    expect(imageConstructions).toBe(1);
  });

  it('retains only the current turn neighborhood and clears book-scoped entries', async () => {
    const urls = [
      '/reader-cache-page-1.png',
      '/reader-cache-page-2.png',
      '/reader-cache-page-3.png',
      '/reader-cache-page-4.png',
    ];
    for (const url of urls) {
      await decodeReaderImage(url, fakeReaderImage(() => Promise.resolve()));
    }

    retainReaderImageCacheUrls([urls[1], urls[2], urls[3]]);
    expect(getReaderImageCacheState(urls[0])).toBe('unknown');
    expect(getReaderImageCacheState(urls[1])).toBe('decoded');
    expect(getReaderImageCacheState(urls[2])).toBe('decoded');
    expect(getReaderImageCacheState(urls[3])).toBe('decoded');

    clearReaderImageCacheUrls(urls);
    expect(urls.map((url) => getReaderImageCacheState(url))).toEqual([
      'unknown',
      'unknown',
      'unknown',
      'unknown',
    ]);
  });

  it('does not let a late decode resurrect a pruned image entry', async () => {
    const url = '/reader-cache-pruned-pending.png';
    let finishDecode!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishDecode = resolve;
    });
    const result = decodeReaderImage(url, fakeReaderImage(() => pending));
    await Promise.resolve();
    clearReaderImageCacheUrls([url]);
    finishDecode();

    expect(await result).toBe(true);
    expect(getReaderImageCacheState(url)).toBe('unknown');
  });

  it('provides a cancellable two-frame painted handoff, including RAF handle zero', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const events: string[] = [];
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback) => {
      const handle = nextFrame;
      nextFrame += 1;
      callbacks.set(handle, callback);
      return handle;
    };
    const cancelFrame = (handle: number) => {
      callbacks.delete(handle);
    };
    const runFrame = (handle: number, timestamp: number) => {
      const callback = callbacks.get(handle);
      callbacks.delete(handle);
      callback?.(timestamp);
    };

    const cancel = scheduleDesktopPhysicalPageTurnHandoff(
      requestFrame,
      cancelFrame,
      () => events.push('final-hidden'),
      () => events.push('complete'),
    );

    expect(events).toEqual([]);
    runFrame(0, 16);
    expect(events).toEqual(['final-hidden']);
    runFrame(1, 32);
    expect(events).toEqual(['final-hidden', 'complete']);

    cancel();
    expect(callbacks.size).toBe(0);

    const cancelBeforePaint = scheduleDesktopPhysicalPageTurnHandoff(
      requestFrame,
      cancelFrame,
      () => events.push('cancelled-hidden'),
      () => events.push('cancelled-complete'),
    );
    cancelBeforePaint();
    runFrame(2, 48);
    expect(events).toEqual(['final-hidden', 'complete']);

    const cancelBetweenFrames = scheduleDesktopPhysicalPageTurnHandoff(
      requestFrame,
      cancelFrame,
      () => events.push('partial-hidden'),
      () => events.push('partial-complete'),
    );
    runFrame(3, 64);
    cancelBetweenFrames();
    runFrame(4, 80);
    expect(events).toEqual(['final-hidden', 'complete', 'partial-hidden']);
  });

  it.each([
    ['normal completion first', 'watchdog second'],
    ['watchdog first', 'normal completion second'],
  ])('settles exactly once when %s races %s', () => {
    const callbacks: FrameRequestCallback[] = [];
    const events: string[] = [];
    const cancelled: string[] = [];
    const settler = createDesktopPhysicalPageTurnSettler(
      () => cancelled.push('animation'),
      () => cancelled.push('watchdog'),
      () => scheduleDesktopPhysicalPageTurnHandoff(
        (callback) => {
          callbacks.push(callback);
          return callbacks.length - 1;
        },
        (handle) => {
          callbacks[handle] = () => undefined;
        },
        () => events.push('final-hidden'),
        () => events.push('complete'),
      ),
    );

    settler.settle();
    settler.settle();
    expect(cancelled).toEqual(['animation', 'watchdog']);
    expect(callbacks).toHaveLength(1);
    callbacks[0]?.(16);
    expect(callbacks).toHaveLength(2);
    callbacks[1]?.(32);
    expect(events).toEqual(['final-hidden', 'complete']);

    settler.cancel();
    settler.settle();
    expect(callbacks).toHaveLength(2);
  });

  it('clears a genuinely unmounted turn without aborting a Strict Mode effect replay', () => {
    const microtasks: Array<() => void> = [];
    const aborts: string[] = [];
    const guard = createDesktopPhysicalPageTurnUnmountGuard((callback) => {
      microtasks.push(callback);
    });

    const firstMount = guard.mount();
    guard.abortIfStillUnmounted(firstMount, () => aborts.push('replay'));
    const replayMount = guard.mount();
    microtasks.shift()?.();
    expect(aborts).toEqual([]);

    guard.abortIfStillUnmounted(replayMount, () => aborts.push('real-unmount'));
    microtasks.shift()?.();
    expect(aborts).toEqual(['real-unmount']);
  });

  it('neutralizes perspective growth on the vertical paper edges without flattening depth', () => {
    for (const direction of ['forward', 'backward'] as const) {
      for (const pose of desktopPageCurlSlicePoses(direction, 0.5, 900)) {
        const projectedScale = DESKTOP_PAGE_TURN_PERSPECTIVE_PX /
          (DESKTOP_PAGE_TURN_PERSPECTIVE_PX - pose.translateZPx);
        expect(
          projectedScale * desktopPageTurnVerticalCompensation(pose.translateZPx),
        ).toBeCloseTo(1, 10);
      }
    }
  });

  it('keeps every paper-mesh edge connected throughout the curl', () => {
    const pageWidth = 480;
    const sourceSliceWidth = pageWidth / DESKTOP_PAGE_CURL_SLICE_COUNT;

    for (const direction of ['forward', 'backward'] as const) {
      for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
        const poses = [...desktopPageCurlSlicePoses(direction, progress, pageWidth)]
          .sort((left, right) => left.outwardIndex - right.outwardIndex);
        let previousOuterEdge: { x: number; z: number } | null = null;

        for (const pose of poses) {
          const radians = Math.abs(pose.rotationYDeg) * Math.PI / 180;
          const outwardSign = direction === 'forward' ? -1 : 1;
          const sliceWidth = sourceSliceWidth * pose.scaleX;
          const segment = {
            x: outwardSign * sliceWidth * Math.cos(radians),
            z: sliceWidth * Math.sin(radians),
          };
          const center = {
            x: (pose.sourceIndex + 0.5) * sourceSliceWidth + pose.translateXPx,
            z: pose.translateZPx,
          };
          const innerEdge = {
            x: center.x - segment.x / 2,
            z: center.z - segment.z / 2,
          };
          const outerEdge = {
            x: center.x + segment.x / 2,
            z: center.z + segment.z / 2,
          };

          if (previousOuterEdge) {
            expect(innerEdge.x).toBeCloseTo(previousOuterEdge.x, 8);
            expect(innerEdge.z).toBeCloseTo(previousOuterEdge.z, 8);
          }
          previousOuterEdge = outerEdge;
        }
      }
    }
  });

  it('lands exactly on unequal destination page rectangles in both directions', () => {
    const leftPage = { x: 40.864, width: 453.354 };
    const rightPage = { x: 501.928, width: 468.774 };

    for (const scenario of [
      { direction: 'forward' as const, source: leftPage, target: rightPage },
      { direction: 'backward' as const, source: rightPage, target: leftPage },
    ]) {
      const targetOffset = scenario.target.x - scenario.source.x;
      const poses = [...desktopPageCurlSlicePoses(
        scenario.direction,
        1,
        scenario.source.width,
        DESKTOP_PAGE_CURL_SLICE_COUNT,
        {
          targetOffsetXPx: targetOffset,
          targetPageWidth: scenario.target.width,
        },
      )].sort((left, right) => left.outwardIndex - right.outwardIndex);
      const sourceSliceWidth = scenario.source.width / DESKTOP_PAGE_CURL_SLICE_COUNT;
      const landedSliceWidth = scenario.target.width / DESKTOP_PAGE_CURL_SLICE_COUNT;
      const outwardSign = scenario.direction === 'forward' ? -1 : 1;
      let firstInnerEdge: number | null = null;
      let lastOuterEdge: number | null = null;

      for (const pose of poses) {
        const radians = Math.abs(pose.rotationYDeg) * Math.PI / 180;
        const segmentX = outwardSign * landedSliceWidth * Math.cos(radians);
        const centerX =
          (pose.sourceIndex + 0.5) * sourceSliceWidth + pose.translateXPx;
        const innerEdge = centerX - segmentX / 2;
        const outerEdge = centerX + segmentX / 2;
        firstInnerEdge ??= innerEdge;
        lastOuterEdge = outerEdge;
        expect(pose.scaleX).toBeCloseTo(
          scenario.target.width / scenario.source.width,
          10,
        );
      }

      if (scenario.direction === 'forward') {
        expect(firstInnerEdge).toBeCloseTo(targetOffset, 8);
        expect(lastOuterEdge).toBeCloseTo(targetOffset + scenario.target.width, 8);
      } else {
        expect(firstInnerEdge).toBeCloseTo(targetOffset + scenario.target.width, 8);
        expect(lastOuterEdge).toBeCloseTo(targetOffset, 8);
      }
    }
  });

  it('is flat at rest and landing but visibly non-rigid mid-turn', () => {
    for (const direction of ['forward', 'backward'] as const) {
      const start = desktopPageCurlSlicePoses(direction, 0, 480);
      const middle = desktopPageCurlSlicePoses(direction, 0.5, 480);
      const end = desktopPageCurlSlicePoses(direction, 1, 480);

      expect(start).toHaveLength(DESKTOP_PAGE_CURL_SLICE_COUNT);
      expect(start.every(
        (pose) => pose.backSourceIndex === DESKTOP_PAGE_CURL_SLICE_COUNT - 1 - pose.sourceIndex,
      )).toBe(true);
      expect(start.every((pose) => pose.rotationYDeg === 0)).toBe(true);
      expect(start.every((pose) => Math.abs(pose.translateZPx) < 1e-10)).toBe(true);
      expect(new Set(middle.map((pose) => pose.rotationYDeg.toFixed(3))).size).toBeGreaterThan(6);
      expect(middle.every((pose) => pose.translateZPx > 0)).toBe(true);
      expect(Math.max(...middle.map((pose) => pose.shadeOpacity))).toBeLessThan(0.07);
      expect(end.every((pose) => Math.abs(Math.abs(pose.rotationYDeg) - 180) < 1e-10)).toBe(true);
      expect(end.every((pose) => Math.abs(pose.translateZPx) < 1e-10)).toBe(true);
    }
  });

  it('keeps the spine tangent coherent while concentrating curl in the paper body', () => {
    for (const direction of ['forward', 'backward'] as const) {
      const poses = desktopPageCurlSlicePoses(direction, 0.5, 480);
      const rotationSign = direction === 'forward' ? 1 : -1;
      const hingeRotation = rotationSign * 90;
      const spinePose = poses.find((pose) => pose.outwardIndex === 0);
      const outerPose = poses.find(
        (pose) => pose.outwardIndex === DESKTOP_PAGE_CURL_SLICE_COUNT - 1,
      );
      const interiorOffsets = poses
        .filter((pose) => pose.outwardIndex > 0 && pose.outwardIndex < DESKTOP_PAGE_CURL_SLICE_COUNT - 1)
        .map((pose) => Math.abs(pose.rotationYDeg - hingeRotation));

      expect(spinePose).toBeDefined();
      expect(outerPose).toBeDefined();
      expect(Math.abs(spinePose!.rotationYDeg - hingeRotation)).toBeLessThan(2);
      expect(Math.abs(outerPose!.rotationYDeg - hingeRotation)).toBeLessThan(2);
      expect(Math.max(...interiorOffsets)).toBeGreaterThan(25);
    }
  });

  it('mirrors the same bounded three-stop curvature shade in both directions', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    ).replace(/\s+/g, ' ');
    const shadeStops = [
      'rgba(30, 20, 10, 0.2)',
      'rgba(255, 251, 242, 0.05) 48%',
      'rgba(30, 20, 10, 0.08)',
    ].join(', ');

    expect(css).toContain(`background: linear-gradient( to left, ${shadeStops} );`);
    expect(css).toContain(
      `.physicalTurnSheetBackward .physicalTurnSheetShade { background: linear-gradient( to right, ${shadeStops} ); }`,
    );
    expect(css).not.toContain('rgba(30, 20, 10, 0.24)');
  });

  it('keeps all visible mobile prose over the illustration', () => {
    expect(mobileTextPresentationFor('A short line for the page.', 'overlay')).toBe('overlay');

    const denseCopy = Array.from(
      { length: MOBILE_OVERLAY_LIMITS.words + 1 },
      (_, index) => `word${index}`,
    ).join(' ');
    expect(mobileTextPresentationFor(denseCopy, 'overlay')).toBe('overlay');
  });

  it('uses one desktop surface, 22px prose, matched cover/open height, and a viewport-safe root', () => {
    const surface = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'DesktopBookPageSurface.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );

    expect(surface).toContain('data-desktop-book-page-surface');
    expect(surface).toContain('styles.leftPageMaskLayer');
    expect(surface).toContain('styles.openTextSafe');
    expect(css).toContain('--book-body-desktop: 22px');
    expect(css).toContain('font-size: var(--book-body-desktop, 22px)');
    expect(css).toContain('min-height: calc(100dvh - var(--nav-h, 72px))');
    expect(css.match(/height: var\(--reader-book-display-height\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(css).toContain('.pageCanvas.tplCover::before');
    expect(css).toContain('.pageCanvas.tplCover::after');
    expect(css).toMatch(
      /\.pageCanvas\.tplCover::before\s*\{[^}]*right: 1\.1%;[^}]*border-radius: 2px 10px 10px 2px;/s,
    );
    expect(css).toMatch(
      /\.pageCanvas\.tplCover::after\s*\{[^}]*left: 3px;[^}]*border-radius: 3px 0 0 3px;/s,
    );
    expect(css).toContain('--closed-cover-inset-right: clamp(16px, 1.4vw, 24px)');
    expect(css).toContain('--closed-cover-inset-left: clamp(11px, 1vw, 17px)');
    expect(css).toMatch(/\.rootReaderReady \.spreadNavBtn\s*\{\s*display: none;/);
  });

  it('keeps captionless mobile scenes captionless even when source text exists', () => {
    expect(mobileTextPresentationFor('Hidden narration.', 'captionless')).toBe('captionless');
    expect(mobileTextPresentationFor('Hidden narration.', 'standard', false)).toBe('captionless');
  });

  it('uses a closed Reader source contract for orders and tracked QA fixtures', () => {
    const order: ReaderBookSource = {
      kind: 'order',
      bookId: 'book/1',
      accessKey: 'key from props',
    };
    const qaFixture: ReaderBookSource = {
      kind: 'qa_fixture',
      payload: {
        id: 'qa-book',
        status: 'QA_FIXTURE_READY',
        book: null,
      },
      exitHref: '/dev/viewer?dir=fixture',
      exitLabel: 'Back to QA library',
    };

    expect(readerSourceBookId(order)).toBe('book/1');
    expect(readerSourceBookId(qaFixture)).toBe('qa-book');
    expect(readerSourceAccessKey(order, 'browser key')).toBe('key from props');
    expect(readerSourceAccessKey({ ...order, accessKey: '' }, 'browser key')).toBe('browser key');
    expect(readerSourceAccessKey(qaFixture, 'ambient key')).toBe('');
    expect(readerSourceExitHref(order, 'resolved key')).toBe(
      '/ready?orderId=book%2F1&accessKey=resolved%20key',
    );
    expect(readerSourceExitHref(qaFixture, 'ignored')).toBe('/dev/viewer?dir=fixture');
  });

  it('routes tracked QA books through the same ReaderV2 controller as production orders', () => {
    const qaRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'dev', 'reader', 'page.tsx'),
      'utf8',
    );
    const productionRoute = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'page.tsx'),
      'utf8',
    );
    const mobilePage = fs.readFileSync(
      path.join(
        process.cwd(),
        'app',
        'book',
        '[id]',
        'read-v2',
        'components',
        'MobileBookPage.tsx',
      ),
      'utf8',
    );
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.module.css'),
      'utf8',
    );
    const mobileAdapter = fs.readFileSync(
      path.join(process.cwd(), 'lib', 'book-layout', 'adapters', 'mobile-page.ts'),
      'utf8',
    );

    expect(qaRoute).toContain('trackedQaReaderFixtureForDir');
    expect(qaRoute).toContain("kind: 'qa_fixture'");
    expect(qaRoute).toContain('<ReaderV2');
    expect(productionRoute).toContain("kind: 'order'");
    const reader = fs.readFileSync(
      path.join(process.cwd(), 'app', 'book', '[id]', 'read-v2', 'reader-v2.tsx'),
      'utf8',
    );
    expect(reader).toContain('const EMPTY_DEV_LAYOUT_FLAGS: DevLayoutQueryFlags = {}');
    expect(reader).toContain('devLayoutFlags = EMPTY_DEV_LAYOUT_FLAGS');
    expect(reader).not.toContain('devLayoutFlags = {}');
    expect(mobilePage).toContain("page.textPresentation === 'paper_panel'");
    expect(mobileAdapter).toContain("return 'overlay';");
    expect(mobileAdapter).not.toContain("return shortEnoughForOverlay ? 'overlay' : 'paper_panel';");
    expect(css).toContain('.mobilePaperPanel');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
});
