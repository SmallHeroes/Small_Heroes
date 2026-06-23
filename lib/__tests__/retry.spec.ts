import { describe, expect, it, vi } from 'vitest';

import { withRetry, TimeoutError } from '../retry';

describe('withRetry', () => {
  it('returns immediately on success (no retry)', async () => {
    const fn = vi.fn(async () => 'ok');
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1 });
    expect(out).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure then succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('fetch failed');
      return 'recovered';
    });
    const out = await withRetry(fn, { attempts: 4, baseDelayMs: 1, factor: 1 });
    expect(out).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting attempts', async () => {
    const fn = vi.fn(async () => {
      throw new Error('still failing');
    });
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1, factor: 1 })).rejects.toThrow('still failing');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry returns false (fast-fail on 4xx)', async () => {
    class NonRetryable extends Error {}
    const fn = vi.fn(async () => {
      throw new NonRetryable('404 not found');
    });
    await expect(
      withRetry(fn, { attempts: 5, baseDelayMs: 1, shouldRetry: (e) => !(e instanceof NonRetryable) })
    ).rejects.toThrow('404 not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('times out a hung attempt and surfaces TimeoutError', async () => {
    // fn ignores the signal and never resolves → the per-attempt timeout must reject.
    const fn = vi.fn(() => new Promise<string>(() => {}));
    await expect(withRetry(fn, { attempts: 1, timeoutMs: 20, label: 'test' })).rejects.toBeInstanceOf(TimeoutError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts the provided signal when an attempt times out (signal-honoring fn)', async () => {
    // A fetch-style fn that honors the signal rejects with its OWN abort error (mirrors the
    // real "operation aborted due to timeout"); either way the attempt fails and the signal aborts.
    let abortedSignal: AbortSignal | undefined;
    const fn = vi.fn(
      (signal: AbortSignal | undefined) =>
        new Promise<string>((_, reject) => {
          abortedSignal = signal;
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    await expect(withRetry(fn, { attempts: 1, timeoutMs: 20 })).rejects.toThrow('aborted');
    expect(abortedSignal?.aborted).toBe(true);
  });
});
