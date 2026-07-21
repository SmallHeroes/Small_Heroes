import { describe, it, expect, vi, beforeEach } from 'vitest';

// (render-loop Phase 1, 3a) Prove generateGPTImage threads a real AbortSignal + an explicit per-request timeout +
// maxRetries:0 into the OpenAI call — so a soft-timeout ACTUALLY cancels the in-flight request and no hidden SDK
// retry can fire. The text-only path (no referenceImages) routes to openai.images.generate.
const { generateSpy, editSpy } = vi.hoisted(() => ({ generateSpy: vi.fn(), editSpy: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    images = { generate: generateSpy, edit: editSpy };
    constructor(_opts: unknown) {}
  },
  toFile: vi.fn(async () => ({})),
}));

import { generateGPTImage } from '@/lib/generate-image';

const OK_RESPONSE = { data: [{ b64_json: Buffer.from('fake-png-bytes').toString('base64') }] };

describe('generateGPTImage (3a) — real cancellation + no hidden SDK retries', () => {
  beforeEach(() => {
    generateSpy.mockReset();
    editSpy.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('forwards maxRetries:0 + the signal + the explicit timeout as the RequestOptions arg', async () => {
    generateSpy.mockResolvedValue(OK_RESPONSE);
    const controller = new AbortController();
    await generateGPTImage({
      finalPrompt: 'a friendly fox',
      size: '1024x1536',
      quality: 'low',
      signal: controller.signal,
      requestTimeoutMs: 123456,
    });
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const opts = generateSpy.mock.calls[0][1] as { maxRetries?: number; timeout?: number; signal?: AbortSignal };
    expect(opts.maxRetries).toBe(0); // the visible retry loop owns retries, not the SDK's default 2
    expect(opts.timeout).toBe(123456);
    expect(opts.signal).toBe(controller.signal);
  });

  it('maxRetries:0 is set even when the caller passes no signal/timeout', async () => {
    generateSpy.mockResolvedValue(OK_RESPONSE);
    await generateGPTImage({ finalPrompt: 'x', size: '1024x1536', quality: 'low' });
    const opts = generateSpy.mock.calls[0][1] as { maxRetries?: number };
    expect(opts.maxRetries).toBe(0);
  });

  it('an abort reaches the OpenAI call and fires its abort handler — cancellation is REAL, not abandoned', async () => {
    const controller = new AbortController();
    let handlerFired = false;
    generateSpy.mockImplementation((_body: unknown, opts: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          handlerFired = true;
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }),
    );
    const p = generateGPTImage({ finalPrompt: 'x', size: '1024x1536', quality: 'low', signal: controller.signal });
    controller.abort(new Error('page soft timeout'));
    await expect(p).rejects.toThrow();
    expect(handlerFired).toBe(true); // the signal threaded all the way down to openai.images.generate
  });
});
