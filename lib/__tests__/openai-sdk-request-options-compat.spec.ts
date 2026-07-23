import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planGPTImageRequest } from '@/lib/generate-image';

const NETWORK_SENTINEL = 'TEST_NETWORK_BLOCKED: OpenAI SDK reached the injected fetch boundary';
const hasOwn = (value: object, property: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, property);

function errorChainMessages(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return messages.join(' | ');
}

describe('installed OpenAI SDK request-options compatibility (zero network)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('accepts omitted timeout/signal through option validation and reaches only the throwing fetch sentinel', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const blockedFetch = vi.fn(async () => {
      throw new Error(NETWORK_SENTINEL);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', blockedFetch);

    const plan = planGPTImageRequest(
      {
        finalPrompt: 'synthetic compatibility prompt',
        modelOverride: 'gpt-image-test',
        size: '1024x1024',
        quality: 'low',
      },
      {
        defaultModel: 'gpt-image-test',
        defaultQuality: 'low',
        maxReferences: 4,
      },
    );
    expect(plan.requestOptions).toEqual({ maxRetries: 0 });
    expect(hasOwn(plan.requestOptions, 'timeout')).toBe(false);
    expect(hasOwn(plan.requestOptions, 'signal')).toBe(false);

    const client = new OpenAI({
      apiKey: 'test-key-never-sent',
      baseURL: 'https://network.invalid/v1',
      fetch: blockedFetch,
    });

    let thrown: unknown;
    try {
      await client.images.generate(
        {
          ...plan.bodyWithoutBinaryImage,
          size: plan.bodyWithoutBinaryImage.size as never,
          quality: plan.bodyWithoutBinaryImage.quality as never,
        },
        plan.requestOptions,
      );
    } catch (error) {
      thrown = error;
    }

    expect(blockedFetch).toHaveBeenCalledTimes(1);
    expect(errorChainMessages(thrown)).toContain(NETWORK_SENTINEL);
  });
});
