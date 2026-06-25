/**
 * Bounded, in-flight-deduping async cache for IMMUTABLE image bytes keyed by a URL or
 * absolute path.
 *
 * Why this exists: the render path passes the SAME reference images (child canonical
 * anchor + companion sheet) to gpt-image for the cover AND for every page. Without a
 * cache each `generateGPTImage` call re-fetched those references from Supabase — for a
 * 12-page book that is ~13 fresh reads of the same anchor, and a single slow/hanging
 * Supabase read (30s+) per call is enough to push a render past the 300s Vercel
 * maxDuration, get the function killed mid-cover, lose the buffer, and re-GPT the cover
 * in a loop (the 2026-06 cover regenerate-loop). Caching by URL collapses all of those
 * to a single fetch per warm worker.
 *
 * Safe to cache across invocations within a warm lambda because order asset URLs are
 * write-once (anchors/candidates are immutable for a given URL) and committed/public
 * reference paths never change content under a stable path.
 *
 * Properties:
 *  - In-flight dedup: concurrent callers for the same key share one loader promise, so
 *    parallel page renders sharing an anchor never stampede the network.
 *  - LRU eviction with a hard entry cap (bounds memory — a handful of distinct refs per
 *    order, so the default cap is generous).
 *  - Failures are NOT cached: a rejected load is evicted so the next caller retries.
 */

function resolveMaxEntries(): number {
  const raw = process.env.IMAGE_BUFFER_CACHE_MAX?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 16;
}

export class BoundedAsyncCache<T> {
  private readonly map = new Map<string, T | Promise<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = resolveMaxEntries()) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  /** Return the cached value for `key`, or run `loader` once and cache the result. */
  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      // Refresh recency (LRU): re-insert so this key is the most-recently-used.
      this.map.delete(key);
      this.map.set(key, existing);
      return existing;
    }

    const promise = loader();
    this.map.set(key, promise);
    try {
      const value = await promise;
      // Replace the in-flight promise with the resolved value (only if still ours —
      // a clear() or eviction may have dropped it).
      if (this.map.get(key) === promise) {
        this.map.set(key, value);
        this.evict();
      }
      return value;
    } catch (err) {
      // Do not cache failures: drop the in-flight entry so the next caller retries.
      if (this.map.get(key) === promise) this.map.delete(key);
      throw err;
    }
  }

  private evict(): void {
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
