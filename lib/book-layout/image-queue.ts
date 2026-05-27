'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Preload illustrations: current + adjacent scenes; lazy for the rest.
 */
export function useSceneImageQueue(
  imageUrls: (string | null)[],
  currentIndex: number,
  enabled = true
): void {
  const cacheRef = useRef<Set<string>>(new Set());

  const preload = useCallback((url: string | null) => {
    if (!enabled || !url || cacheRef.current.has(url)) return;
    cacheRef.current.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const current = imageUrls[currentIndex] ?? null;
    const prev = imageUrls[currentIndex - 1] ?? null;
    const next = imageUrls[currentIndex + 1] ?? null;
    preload(current);
    preload(prev);
    preload(next);
  }, [currentIndex, enabled, imageUrls, preload]);

  useEffect(() => {
    if (!enabled || imageUrls.length === 0) return;
    preload(imageUrls[0] ?? null);
    preload(imageUrls[1] ?? null);
  }, [enabled, imageUrls, preload]);
}

export function illustrationLoadingAttr(isCurrent: boolean): 'eager' | 'lazy' {
  return isCurrent ? 'eager' : 'lazy';
}
