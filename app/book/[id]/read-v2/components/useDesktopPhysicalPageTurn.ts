'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesktopSpread, PageTurnDirection } from '@/lib/book-layout';

export const DESKTOP_PHYSICAL_PAGE_TURN_MS = 560;

export type DesktopPhysicalPageTurn = Readonly<{
  id: number;
  direction: Exclude<PageTurnDirection, 'initial'>;
  outgoing: DesktopSpread;
  incoming: DesktopSpread;
}>;

export type DesktopPhysicalPageTurnRequest = Omit<DesktopPhysicalPageTurn, 'id'>;
export type DesktopPhysicalPageTurnStart = 'started' | 'skipped' | 'blocked';

function desktopPhysicalPageTurnIsAvailable(
  outgoing: DesktopSpread,
  incoming: DesktopSpread,
): boolean {
  if (typeof window === 'undefined') return false;
  if (outgoing.isWide || incoming.isWide) return false;
  if (!window.matchMedia('(min-width: 1024px)').matches) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const fallbackTimerRef = useRef<number | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current == null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const complete = useCallback(
    (id: number) => {
      if (activeRef.current?.id !== id) return;
      clearFallbackTimer();
      activeRef.current = null;
      setTurn(null);
    },
    [clearFallbackTimer],
  );

  const cancel = useCallback(() => {
    clearFallbackTimer();
    activeRef.current = null;
    setTurn(null);
  }, [clearFallbackTimer]);

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
      fallbackTimerRef.current = window.setTimeout(
        () => complete(nextTurn.id),
        DESKTOP_PHYSICAL_PAGE_TURN_MS + 180,
      );
      return 'started';
    },
    [complete],
  );

  useEffect(() => cancel, [cancel]);

  return { turn, start, complete, cancel } as const;
}
