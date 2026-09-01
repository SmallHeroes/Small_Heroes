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

vi.mock('@/lib/child-photo-normalize', () => ({
  normalizeReferenceImageBuffer: vi.fn(async (buffer: Buffer) => ({
    buffer,
    ext: 'jpg' as const,
    mime: 'image/jpeg' as const,
  })),
}));

import {
  generateGPTImage,
  GPT_IMAGE_PROMPT_MAX_CHARS,
  GPTImagePromptTooLongError,
  planGPTImageRequest,
} from '@/lib/generate-image';

const OK_RESPONSE = { data: [{ b64_json: Buffer.from('fake-png-bytes').toString('base64') }] };
const hasOwn = (value: object, property: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, property);

describe('generateGPTImage (3a) — real cancellation + no hidden SDK retries', () => {
  beforeEach(() => {
    generateSpy.mockReset();
    editSpy.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.GPT_IMAGE_EDIT_MAX_REFERENCES;
  });

  it('images.generate forwards maxRetries:0 + signal + explicit timeout in RequestOptions', async () => {
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

  it('images.edit forwards maxRetries:0 + signal + explicit timeout in RequestOptions', async () => {
    editSpy.mockResolvedValue(OK_RESPONSE);
    const controller = new AbortController();
    await generateGPTImage({
      finalPrompt: 'a friendly fox',
      referenceImages: ['package.json'],
      size: '1024x1536',
      quality: 'low',
      signal: controller.signal,
      requestTimeoutMs: 654321,
    });
    expect(generateSpy).not.toHaveBeenCalled();
    expect(editSpy).toHaveBeenCalledTimes(1);
    const opts = editSpy.mock.calls[0][1] as { maxRetries?: number; timeout?: number; signal?: AbortSignal };
    expect(opts.maxRetries).toBe(0);
    expect(opts.timeout).toBe(654321);
    expect(opts.signal).toBe(controller.signal);
  });

  it('omits absent signal/timeout properties while keeping maxRetries:0 mandatory', () => {
    const plan = planGPTImageRequest(
      { finalPrompt: 'x' },
      { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
    );

    expect(plan.requestOptions).toEqual({ maxRetries: 0 });
    expect(hasOwn(plan.requestOptions, 'signal')).toBe(false);
    expect(hasOwn(plan.requestOptions, 'timeout')).toBe(false);
  });

  it('includes signal without manufacturing a timeout property', () => {
    const controller = new AbortController();
    const plan = planGPTImageRequest(
      { finalPrompt: 'x', signal: controller.signal },
      { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
    );

    expect(plan.requestOptions).toEqual({ maxRetries: 0, signal: controller.signal });
    expect(hasOwn(plan.requestOptions, 'timeout')).toBe(false);
  });

  it('includes a valid explicit timeout without manufacturing a signal property', () => {
    const plan = planGPTImageRequest(
      { finalPrompt: 'x', requestTimeoutMs: 30_000 },
      { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
    );

    expect(plan.requestOptions).toEqual({ maxRetries: 0, timeout: 30_000 });
    expect(hasOwn(plan.requestOptions, 'signal')).toBe(false);
  });

  it('accepts the exact character ceiling and rejects one character beyond it', () => {
    const exact = planGPTImageRequest(
      { finalPrompt: 'x'.repeat(GPT_IMAGE_PROMPT_MAX_CHARS) },
      { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
    );
    expect(exact.finalPrompt).toHaveLength(GPT_IMAGE_PROMPT_MAX_CHARS);

    expect(() =>
      planGPTImageRequest(
        { finalPrompt: 'x'.repeat(GPT_IMAGE_PROMPT_MAX_CHARS + 1) },
        { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
      ),
    ).toThrowError(GPTImagePromptTooLongError);
  });

  it('rejects an over-limit final edit request before reference loading or provider I/O', async () => {
    await expect(
      generateGPTImage({
        finalPrompt: 'x'.repeat(GPT_IMAGE_PROMPT_MAX_CHARS),
        negativePrompt: 'extra child',
        referenceImages: ['missing-reference.png'],
        size: '1024x1536',
        quality: 'low',
      }),
    ).rejects.toMatchObject({
      code: 'gpt_image_prompt_too_long',
      maxPromptLength: GPT_IMAGE_PROMPT_MAX_CHARS,
    });
    expect(generateSpy).not.toHaveBeenCalled();
    expect(editSpy).not.toHaveBeenCalled();
  });

  it('accepts multibyte prompt content that remains within the character limit', () => {
    const multibytePrompt = 'לביא'.repeat(4_000);
    expect(multibytePrompt.length).toBeLessThan(GPT_IMAGE_PROMPT_MAX_CHARS);
    expect(Buffer.byteLength(multibytePrompt, 'utf8')).toBeGreaterThan(
      multibytePrompt.length,
    );
    expect(
      planGPTImageRequest(
        { finalPrompt: multibytePrompt },
        { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
      ).finalPrompt,
    ).toBe(multibytePrompt);
  });

  it('rejects edit prompts whose multipart CRLF normalization crosses the provider limit', () => {
    const newlineDense = `${'x\n'.repeat(10_500)}x`;
    expect(newlineDense.length).toBeLessThan(GPT_IMAGE_PROMPT_MAX_CHARS);
    expect(() =>
      planGPTImageRequest(
        {
          finalPrompt: newlineDense,
          referenceImages: ['reference.png'],
        },
        { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
      ),
    ).toThrowError(GPTImagePromptTooLongError);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid explicit timeout %s in the pure planner',
    (requestTimeoutMs) => {
      expect(() =>
        planGPTImageRequest(
          { finalPrompt: 'x', requestTimeoutMs },
          { defaultModel: 'gpt-image-1', defaultQuality: 'low', maxReferences: 4 },
        )
      ).toThrow(/requestTimeoutMs must be a finite positive integer/);
    },
  );

  it.each([
    { mode: 'images.generate', referenceImages: undefined },
    { mode: 'images.edit', referenceImages: ['package.json'] },
  ])('does not invoke $mode for any invalid explicit timeout', async ({ referenceImages }) => {
    for (const requestTimeoutMs of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      await expect(
        generateGPTImage({
          finalPrompt: 'x',
          referenceImages,
          size: '1024x1536',
          quality: 'low',
          requestTimeoutMs,
        }),
      ).rejects.toThrow(/requestTimeoutMs must be a finite positive integer/);
    }

    expect(generateSpy).not.toHaveBeenCalled();
    expect(editSpy).not.toHaveBeenCalled();
  });

  it('uses the production planner for the exact final edit body, prompt additions, and ordered reference cap', async () => {
    const plan = planGPTImageRequest({
      finalPrompt: 'child shares a reassuring smile while touching the stool',
      negativePrompt: 'castle, dragon',
      referenceImages: ['first.png', 'second.png', 'third.png'],
      referenceMode: 'style',
      quality: 'medium',
      size: '1536x1536',
      modelOverride: 'gpt-image-fixture',
    }, {
      defaultModel: 'gpt-image-1',
      defaultQuality: 'low',
      maxReferences: 2,
    });
    expect(plan).toMatchObject({
      version: 'gpt-image-request-plan/v1',
      apiMode: 'images.edit',
      model: 'gpt-image-fixture',
      quality: 'medium',
      size: '1536x1536',
      referenceCountRequested: 3,
      referenceCountPassed: 2,
      referenceCountCap: 2,
      orderedReferenceSources: ['first.png', 'second.png'],
    });
    expect(plan.finalPrompt).toContain('[STYLE REFERENCES');
    expect(plan.finalPrompt).toContain('[AVOID]\ncastle, dragon');
    expect(plan.finalPrompt).toContain('No text or letters in the image.');
    expect(plan.bodyWithoutBinaryImage.prompt).toBe(plan.finalPrompt);

    editSpy.mockResolvedValue(OK_RESPONSE);
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES = '2';
    await generateGPTImage({
      finalPrompt: 'child shares a reassuring smile while touching the stool',
      negativePrompt: 'castle, dragon',
      referenceImages: ['package.json', 'package-lock.json', 'tsconfig.json'],
      referenceMode: 'style',
      quality: 'medium',
      size: '1536x1536',
      modelOverride: 'gpt-image-fixture',
    });
    expect(editSpy).toHaveBeenCalledTimes(1);
    const body = editSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'gpt-image-fixture',
      prompt: expect.stringContaining('[AVOID]\ncastle, dragon'),
      size: '1536x1536',
      quality: 'medium',
      n: 1,
    });
    expect(String(body.prompt)).toContain('[STYLE REFERENCES');
    expect(Array.isArray(body.image)).toBe(true);
    expect((body.image as unknown[])).toHaveLength(2);
    delete process.env.GPT_IMAGE_EDIT_MAX_REFERENCES;
  });

  it('maxRetries:0 is set even when the caller passes no signal/timeout', async () => {
    generateSpy.mockResolvedValue(OK_RESPONSE);
    await generateGPTImage({ finalPrompt: 'x', size: '1024x1536', quality: 'low' });
    const opts = generateSpy.mock.calls[0][1] as { maxRetries?: number; signal?: AbortSignal; timeout?: number };
    expect(opts).toEqual({ maxRetries: 0 });
    expect(hasOwn(opts, 'signal')).toBe(false);
    expect(hasOwn(opts, 'timeout')).toBe(false);
  });

  it('images.edit also omits absent signal/timeout while keeping maxRetries:0', async () => {
    editSpy.mockResolvedValue(OK_RESPONSE);
    await generateGPTImage({
      finalPrompt: 'x',
      referenceImages: ['package.json'],
      size: '1024x1536',
      quality: 'low',
    });
    const opts = editSpy.mock.calls[0][1] as { maxRetries?: number; signal?: AbortSignal; timeout?: number };
    expect(opts).toEqual({ maxRetries: 0 });
    expect(hasOwn(opts, 'signal')).toBe(false);
    expect(hasOwn(opts, 'timeout')).toBe(false);
  });

  it('an abort reaches the OpenAI call and fires its abort handler — cancellation is REAL, not abandoned', async () => {
    const controller = new AbortController();
    let handlerFired = false;
    generateSpy.mockImplementation((_body: unknown, opts: { signal?: AbortSignal; timeout?: number }) =>
      new Promise((_resolve, reject) => {
        expect(hasOwn(opts, 'timeout')).toBe(false);
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

  it('an abort reaches images.edit and fires its request-option signal handler', async () => {
    const controller = new AbortController();
    let handlerFired = false;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    editSpy.mockImplementation((_body: unknown, opts: { signal?: AbortSignal; timeout?: number }) => {
      markStarted();
      return new Promise((_resolve, reject) => {
        expect(hasOwn(opts, 'timeout')).toBe(false);
        opts.signal?.addEventListener('abort', () => {
          handlerFired = true;
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const p = generateGPTImage({
      finalPrompt: 'x',
      referenceImages: ['package.json'],
      size: '1024x1536',
      quality: 'low',
      signal: controller.signal,
    });
    await started;
    controller.abort(new Error('page soft timeout'));

    await expect(p).rejects.toThrow();
    expect(handlerFired).toBe(true);
  });
});
