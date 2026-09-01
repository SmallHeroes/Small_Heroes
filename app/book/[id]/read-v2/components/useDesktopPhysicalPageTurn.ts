'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { DesktopSpread, PageTurnDirection } from '@/lib/book-layout';
import { readerImageIsPaintReady } from '../useAdjacentImagePreload';

export const DESKTOP_PHYSICAL_PAGE_TURN_MS = 560;

export function scheduleDesktopPhysicalPageTurnHandoff(
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (handle: number) => void,
  applyFinalPoseAndHide: () => void,
  complete: () => void,
): () => void {
  let completeFrame: number | null = null;
  const settleFrame = requestFrame(() => {
    applyFinalPoseAndHide();
    completeFrame = requestFrame(complete);
  });
  return () => {
    cancelFrame(settleFrame);
    if (completeFrame !== null) cancelFrame(completeFrame);
  };
}

export function createDesktopPhysicalPageTurnSettler(
  cancelActiveAnimation: () => void,
  clearWatchdog: () => void,
  beginHandoff: () => () => void,
): { settle: () => void; cancel: () => void } {
  let settling = false;
  let cancelled = false;
  let cancelHandoff: (() => void) | null = null;

  return {
    settle: () => {
      if (settling || cancelled) return;
      settling = true;
      cancelActiveAnimation();
      clearWatchdog();
      cancelHandoff = beginHandoff();
    },
    cancel: () => {
      cancelled = true;
      cancelHandoff?.();
      cancelHandoff = null;
    },
  };
}

export function createDesktopPhysicalPageTurnUnmountGuard(
  scheduleMicrotask: (callback: () => void) => void,
): {
  mount: () => number;
  abortIfStillUnmounted: (mountGeneration: number, abort: () => void) => void;
} {
  let currentMountGeneration = 0;

  return {
    mount: () => {
      currentMountGeneration += 1;
      return currentMountGeneration;
    },
    abortIfStillUnmounted: (mountGeneration, abort) => {
      scheduleMicrotask(() => {
        if (currentMountGeneration === mountGeneration) abort();
      });
    },
  };
}

export type DesktopPhysicalPageTurn = Readonly<{
  id: number;
  direction: Exclude<PageTurnDirection, 'initial'>;
  outgoing: DesktopSpread;
  incoming: DesktopSpread;
}>;

export type DesktopPhysicalPageTurnRequest = Omit<DesktopPhysicalPageTurn, 'id'>;
export type DesktopPhysicalPageTurnStart = 'started' | 'skipped' | 'blocked';

export function desktopPhysicalPageTurnImagesAreReady(
  outgoing: DesktopSpread,
  incoming: DesktopSpread,
): boolean {
  return readerImageIsPaintReady(outgoing.illustrationUrl) &&
    readerImageIsPaintReady(incoming.illustrationUrl);
}

export function desktopPhysicalPageTurnIsAvailable(
  outgoing: DesktopSpread,
  incoming: DesktopSpread,
): boolean {
  if (typeof window === 'undefined') return false;
  if (outgoing.isWide || incoming.isWide) return false;
  if (!window.matchMedia('(min-width: 1024px)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return desktopPhysicalPageTurnImagesAreReady(outgoing, incoming);
}

/**
 * Shared, synchronous navigation guard for the production Reader and QA Viewer.
 * The current index may move immediately so the incoming spread can be the static
 * base; this snapshot keeps the outgoing spread alive until the paper lands.
 */
export function useDesktopPhysicalPageTurn() {
  const [turn, setTurn] = useState<DesktopPhysicalPageTurn | null>(null);
  const activeRef = useRef<DesktopPhysicalPageTurn | null>(null);
  const nextIdRef = useRef(1);

  const complete = useCallback(
    (id: number) => {
      if (activeRef.current?.id !== id) return;
      activeRef.current = null;
      setTurn(null);
    },
    [],
  );

  const cancel = useCallback(() => {
    activeRef.current = null;
    setTurn(null);
  }, []);

  const start = useCallback(
    (request: DesktopPhysicalPageTurnRequest): DesktopPhysicalPageTurnStart => {
      if (activeRef.current) return 'blocked';
      if (!desktopPhysicalPageTurnIsAvailable(request.outgoing, request.incoming)) {
        return 'skipped';
      }

      const nextTurn: DesktopPhysicalPageTurn = {
        ...request,
        id: nextIdRef.current,
      };
      nextIdRef.current += 1;
      activeRef.current = nextTurn;
      setTurn(nextTurn);
      return 'started';
    },
    [],
  );

  useLayoutEffect(() => cancel, [cancel]);

  return { turn, start, complete, cancel } as const;
}
