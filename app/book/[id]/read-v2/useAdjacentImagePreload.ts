'use client';

import { useCallback, useEffect } from 'react';

export type ReaderImageCacheState = 'loading' | 'loaded' | 'error';

const imageCache = new Map<string, ReaderImageCacheState>();

export function getReaderImageCacheState(url: string | null): ReaderImageCacheState | 'unknown' {
  if (!url) return 'unknown';
  return imageCache.get(url) ?? 'unknown';
}

export function recordReaderImageCacheState(
  url: string | null,
  state: ReaderImageCacheState,
): void {
  if (!url) return;
  imageCache.set(url, state);
}

export function readerImageIsLoaded(url: string | null): boolean {
  return Boolean(url) && getReaderImageCacheState(url) === 'loaded';
}

/**
 * Synchronous paint-readiness proof used at the click boundary. The shared
 * registry covers normal preloads and SceneIllustration loads; the browser
 * probe also recognizes a decoded HTTP-cache entry in callers that did not run
 * this hook (for example a standalone QA viewer).
 */
export function readerImageIsPaintReady(url: string | null): boolean {
  if (!url) return false;
  if (readerImageIsLoaded(url)) return true;
  if (typeof Image === 'undefined') return false;
  const probe = new Image();
  probe.src = url;
  if (!probe.complete || probe.naturalWidth <= 0) return false;
  recordReaderImageCacheState(url, 'loaded');
  return true;
}

function preloadUrl(url: string): void {
  const existing = imageCache.get(url);
  if (existing === 'loaded' || existing === 'loading') return;
  recordReaderImageCacheState(url, 'loading');
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => recordReaderImageCacheState(url, 'loaded');
  img.onerror = () => recordReaderImageCacheState(url, 'error');
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
