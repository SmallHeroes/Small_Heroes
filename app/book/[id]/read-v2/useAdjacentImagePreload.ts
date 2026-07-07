'use client';

import { useCallback, useEffect } from 'react';

export type ReaderImageCacheState = 'loading' | 'loaded' | 'error';

const imageCache = new Map<string, ReaderImageCacheState>();

export function getReaderImageCacheState(url: string | null): ReaderImageCacheState | 'unknown' {
  if (!url) return 'unknown';
  return imageCache.get(url) ?? 'unknown';
}

function preloadUrl(url: string): void {
  const existing = imageCache.get(url);
  if (existing === 'loaded' || existing === 'loading') return;
  imageCache.set(url, 'loading');
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => imageCache.set(url, 'loaded');
  img.onerror = () => imageCache.set(url, 'error');
  img.src = url;
}

/**
 * Preload current scene + adjacent prev/next illustrations so page-turns feel instant.
 * Keeps scope to 1–2 neighbors — not the whole book.
 */
export function useAdjacentImagePreload(
  imageUrls: (string | null)[],
  currentIndex: number,
  enabled = true
): void {
  const preload = useCallback(
    (url: string | null) => {
      if (!enabled || !url) return;
      preloadUrl(url);
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    preload(imageUrls[currentIndex] ?? null);
    preload(imageUrls[currentIndex - 1] ?? null);
    preload(imageUrls[currentIndex + 1] ?? null);
  }, [currentIndex, enabled, imageUrls, preload]);

  useEffect(() => {
    if (!enabled || imageUrls.length === 0) return;
    preload(imageUrls[0] ?? null);
    preload(imageUrls[1] ?? null);
  }, [enabled, imageUrls, preload]);
}
