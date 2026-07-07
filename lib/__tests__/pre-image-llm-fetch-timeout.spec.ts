/**
 * Pre-image LLM/vision fetch timeout + fallback (generation-path reliability).
 *
 * A hung provider must ABORT at the bounded timeout and let the EXISTING fallback fire — NEVER run to the 300s
 * worker hard kill (FUNCTION_INVOCATION_TIMEOUT) before the child anchor. Proven with a mocked provider whose fetch
 * NEVER resolves (only rejects when the AbortSignal fires) + a tiny PRE_IMAGE_LLM_TIMEOUT_MS. Also asserts the
 * happy path (fast provider) is unchanged — the signal only fires on a hang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// describeChildFromPhoto first calls normalizePhotoUrlForVision; for an http(s) url the REAL impl FETCHES the image,
// which the hung-fetch mock would intercept BEFORE the vision call. Stub it to pass the url through so the test
// targets the provider (vision) fetch. Explicit stubs (not importOriginal) so no native image deps load in vitest.
vi.mock('@/lib/child-photo-normalize', () => ({
  normalizePhotoUrlForVision: vi.fn(async (u: string) => u),
  ChildPhotoUploadError: class ChildPhotoUploadError extends Error {},
}));

import { describeChildFromPhoto } from '@/backend/providers/story-bank-loader';

describe('pre-image LLM/vision fetch timeout + fallback', () => {
  const saved = {
    PRE_IMAGE_LLM_TIMEOUT_MS: process.env.PRE_IMAGE_LLM_TIMEOUT_MS,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.PRE_IMAGE_LLM_TIMEOUT_MS = '50'; // shrink so the abort fires fast in the test
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    process.env.OPENAI_API_KEY = 'test-openai';
  });
  afterEach(() => {
    global.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.clearAllMocks();
  });

  it('aborts a HUNG provider at the timeout and falls back (Claude→OpenAI→null), never a 300s hang', async () => {
    // A hung provider: the fetch never resolves; it only rejects when the bound AbortSignal fires.
    const hungFetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return; // the helper ALWAYS attaches a timeout signal; guard just in case
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener('abort', () => reject(signal.reason ?? new DOMException('aborted', 'AbortError')));
        }),
    );
    global.fetch = hungFetch as unknown as typeof fetch;

    const startedAt = Date.now();
    const result = await describeChildFromPhoto('https://example.com/child.jpg');
    const elapsedMs = Date.now() - startedAt;

    // Claude aborts (~50ms) → OpenAI vision fallback aborts (~50ms) → null. NOT a multi-second (let alone 300s) hang.
    expect(result).toBeNull();
    expect(elapsedMs).toBeLessThan(5_000);
    expect(hungFetch).toHaveBeenCalledTimes(2); // both providers attempted (Claude, then OpenAI fallback)
    // every provider call was bound by an abort signal — never an unbounded fetch
    for (const call of hungFetch.mock.calls) {
      expect((call[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('happy path UNCHANGED — a fast provider result is returned; no fallback, no abort', async () => {
    const okFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                text: 'Round face, warm light olive skin, medium-length straight brown hair framing the face, round dark-brown eyes, small nose.',
              },
            ],
          }),
          { status: 200 },
        ),
    );
    global.fetch = okFetch as unknown as typeof fetch;

    const result = await describeChildFromPhoto('https://example.com/child.jpg');
    expect(result).toBeTruthy();
    expect(String(result)).toMatch(/olive|brown/i);
    expect(okFetch).toHaveBeenCalledTimes(1); // Claude succeeded → the OpenAI fallback was never called
  });
});
