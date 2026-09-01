'use client';

import { useCallback, useEffect } from 'react';

export type ReaderImageCacheState = 'loading' | 'decoded' | 'error';

type ReaderImageCacheEntry = {
  state: ReaderImageCacheState;
  image: HTMLImageElement | null;
  decodePromise: Promise<boolean> | null;
};

const imageCache = new Map<string, ReaderImageCacheEntry>();

export function retainReaderImageCacheUrls(urls: readonly (string | null)[]): void {
  const retained = new Set(urls.filter((url): url is string => Boolean(url)));
  for (const url of imageCache.keys()) {
    if (!retained.has(url)) imageCache.delete(url);
  }
}

export function clearReaderImageCacheUrls(urls: readonly (string | null)[]): void {
  for (const url of urls) {
    if (url) imageCache.delete(url);
  }
}

export function getReaderImageCacheState(url: string | null): ReaderImageCacheState | 'unknown' {
  if (!url) return 'unknown';
  return imageCache.get(url)?.state ?? 'unknown';
}

export function resetReaderImageCacheUrl(url: string | null): void {
  if (!url) return;
  imageCache.delete(url);
}

export function recordReaderImageError(
  url: string | null,
  image: HTMLImageElement,
): void {
  if (!url) return;
  const existing = imageCache.get(url);
  if (existing?.image !== image) return;
  if (
    existing.state === 'decoded' &&
    image.complete &&
    image.naturalWidth > 0
  ) {
    return;
  }
  imageCache.set(url, { state: 'error', image, decodePromise: null });
}

export function readerImageIsDecoded(url: string | null): boolean {
  if (!url) return false;
  const entry = imageCache.get(url);
  return entry?.state === 'decoded' &&
    Boolean(entry.image?.complete) &&
    (entry.image?.naturalWidth ?? 0) > 0;
}

/**
 * Decode and retain the exact image resource used to prove turn-time paint
 * readiness. A later request for the same element shares the in-flight proof;
 * a newer element for the URL supersedes stale load/decode callbacks.
 */
export function decodeReaderImage(
  url: string,
  image: HTMLImageElement,
): Promise<boolean> {
  const existing = imageCache.get(url);
  if (existing?.image === image) {
    if (
      existing.state === 'decoded' &&
      image.complete &&
      image.naturalWidth > 0
    ) {
      return Promise.resolve(true);
    }
    if (existing.decodePromise) return existing.decodePromise;
  }

  const entry: ReaderImageCacheEntry = {
    state: 'loading',
    image,
    decodePromise: null,
  };
  imageCache.set(url, entry);

  const decodePromise = Promise.resolve()
    .then(() => image.decode())
    .then(() => {
      const decoded = image.complete && image.naturalWidth > 0;
      if (imageCache.get(url) !== entry) return decoded;
      if (!decoded) {
        entry.state = 'error';
        entry.decodePromise = null;
        return false;
      }
      entry.state = 'decoded';
      entry.decodePromise = null;
      return true;
    })
    .catch(() => {
      if (imageCache.get(url) === entry) {
        entry.state = 'error';
        entry.decodePromise = null;
      }
      return false;
    });
  entry.decodePromise = decodePromise;
  return decodePromise;
}

/**
 * Synchronous paint-readiness proof used at the click boundary. The shared
 * registry covers decoded preloads and SceneIllustration resources. An unknown
 * browser-cache entry starts an explicit decode proof but remains false for the
 * current click, preserving the safe static-navigation path.
 */
export function readerImageIsPaintReady(url: string | null): boolean {
  if (!url) return false;
  if (readerImageIsDecoded(url)) return true;
  const cached = imageCache.get(url);
  if (cached?.state === 'loading' || cached?.state === 'error') return false;
  if (typeof Image === 'undefined') return false;
  const probe = new Image();
  probe.decoding = 'async';
  probe.src = url;
  void decodeReaderImage(url, probe);
  return false;
}

function preloadUrl(url: string): void {
  const existing = imageCache.get(url)?.state;
  if (existing === 'decoded' || existing === 'loading' || existing === 'error') return;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  void decodeReaderImage(url, img);
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

  useEffect(() => {
    if (!enabled) {
      clearReaderImageCacheUrls(imageUrls);
      return;
    }
    retainReaderImageCacheUrls([
      imageUrls[currentIndex - 1] ?? null,
      imageUrls[currentIndex] ?? null,
      imageUrls[currentIndex + 1] ?? null,
    ]);
  }, [currentIndex, enabled, imageUrls]);

  useEffect(() => (
    () => clearReaderImageCacheUrls(imageUrls)
  ), [imageUrls]);
}
