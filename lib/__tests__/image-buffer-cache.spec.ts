import { describe, expect, it, vi } from 'vitest';

import { BoundedAsyncCache } from '../image-buffer-cache';

describe('BoundedAsyncCache', () => {
  it('runs the loader once and serves cached value on subsequent hits', async () => {
    const cache = new BoundedAsyncCache<string>(4);
    const loader = vi.fn(async () => 'value');

    const a = await cache.getOrLoad('k', loader);
    const b = await cache.getOrLoad('k', loader);

    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('dedups concurrent in-flight loads for the same key (no stampede)', async () => {
    const cache = new BoundedAsyncCache<number>(4);
    let resolveLoad: (n: number) => void = () => {};
    const loader = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLoad = resolve;
        })
    );

    const p1 = cache.getOrLoad('k', loader);
    const p2 = cache.getOrLoad('k', loader);
    resolveLoad(42);

    expect(await p1).toBe(42);
    expect(await p2).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures — the next caller retries', async () => {
    const cache = new BoundedAsyncCache<string>(4);
    let calls = 0;
    const loader = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return 'recovered';
    });

    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('transient');
    expect(cache.has('k')).toBe(false);
    await expect(cache.getOrLoad('k', loader)).resolves.toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('evicts the least-recently-used entry beyond the cap', async () => {
    const cache = new BoundedAsyncCache<string>(2);
    const make = (v: string) => vi.fn(async () => v);

    await cache.getOrLoad('a', make('a'));
    await cache.getOrLoad('b', make('b'));
    // Touch 'a' so 'b' becomes the LRU entry.
    await cache.getOrLoad('a', make('a-again'));
    await cache.getOrLoad('c', make('c'));

    expect(cache.size).toBe(2);
    expect(cache.has('a')).toBe(true); // recently used — retained
    expect(cache.has('c')).toBe(true); // newest — retained
    expect(cache.has('b')).toBe(false); // LRU — evicted

    // 'a' is still the cached value (loader not re-run after eviction of 'b').
    const reload = make('a-reloaded');
    expect(await cache.getOrLoad('a', reload)).toBe('a');
    expect(reload).not.toHaveBeenCalled();
  });

  it('clear() drops all entries', async () => {
    const cache = new BoundedAsyncCache<string>(4);
    await cache.getOrLoad('k', async () => 'v');
    expect(cache.has('k')).toBe(true);
    cache.clear();
    expect(cache.has('k')).toBe(false);
    expect(cache.size).toBe(0);
  });
});
