import { afterEach, describe, expect, it, vi } from 'vitest';

import { callVisualContractVision } from '@/lib/generation-pipeline/visual-contract-vision';

const realFetch = global.fetch;
const realKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = realKey;
  vi.restoreAllMocks();
});

describe('callVisualContractVision', () => {
  it('returns the model content and sends image_url(detail:low) + instruction', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"locationMatchesContract":true}' } }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await callVisualContractVision('https://x/p.png', 'INSTRUCTION');
    expect(out).toBe('{"locationMatchesContract":true}');

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.messages[0].content[0].text).toBe('INSTRUCTION');
    expect(body.messages[0].content[1].image_url.url).toBe('https://x/p.png');
    expect(body.messages[0].content[1].image_url.detail).toBe('low');
  });

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(callVisualContractVision('https://x/p.png', 'i')).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('throws on a non-OK response (surfaces the status)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    })) as unknown as typeof fetch;
    await expect(callVisualContractVision('https://x/p.png', 'i')).rejects.toThrow(/429/);
  });

  it('returns "" when the model returns no content', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [] }) })) as unknown as typeof fetch;
    expect(await callVisualContractVision('https://x/p.png', 'i')).toBe('');
  });
});
