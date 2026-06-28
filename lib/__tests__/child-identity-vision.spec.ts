import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkChildIdentityViaVision,
  parseChildIdentityVerdict,
} from '@/lib/generation-pipeline/child-identity-vision';

const realFetch = global.fetch;
const realKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = realKey;
  vi.restoreAllMocks();
});

describe('parseChildIdentityVerdict — tolerant 3-state parse', () => {
  it('parses same / different / uncertain', () => {
    expect(parseChildIdentityVerdict('{"sameChild":"same","confidence":0.9,"reason":"x"}').sameChild).toBe('same');
    expect(parseChildIdentityVerdict('{"sameChild":"different","confidence":0.8}').sameChild).toBe('different');
    expect(parseChildIdentityVerdict('{"sameChild":"uncertain","confidence":0.2}').sameChild).toBe('uncertain');
  });

  it('extracts JSON embedded in prose', () => {
    const v = parseChildIdentityVerdict('Sure! {"sameChild":"same","confidence":0.77,"reason":"same hair"} done');
    expect(v.sameChild).toBe('same');
    expect(v.confidence).toBeCloseTo(0.77);
  });

  it('clamps confidence to [0,1]', () => {
    expect(parseChildIdentityVerdict('{"sameChild":"different","confidence":1.7}').confidence).toBe(1);
    expect(parseChildIdentityVerdict('{"sameChild":"different","confidence":-3}').confidence).toBe(0);
  });

  it('a same/different claim with 0 confidence collapses to uncertain (untrustworthy)', () => {
    expect(parseChildIdentityVerdict('{"sameChild":"different","confidence":0}').sameChild).toBe('uncertain');
  });

  it('garbage / unknown → uncertain @ 0 (never throws)', () => {
    expect(parseChildIdentityVerdict('not json at all').sameChild).toBe('uncertain');
    expect(parseChildIdentityVerdict('{"sameChild":"maybe"}').sameChild).toBe('uncertain');
    expect(parseChildIdentityVerdict('').confidence).toBe(0);
  });
});

describe('checkChildIdentityViaVision', () => {
  it('sends BOTH images (anchor + candidate) at detail:low and returns the parsed verdict', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"sameChild":"same","confidence":0.9,"reason":"same child"}' } }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await checkChildIdentityViaVision('https://x/anchor.png', 'https://x/page.png');
    expect(out.sameChild).toBe('same');
    expect(out.confidence).toBeCloseTo(0.9);

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    const imageParts = body.messages[0].content.filter((c: { type: string }) => c.type === 'image_url');
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url.url).toBe('https://x/anchor.png');
    expect(imageParts[0].image_url.detail).toBe('low');
    expect(imageParts[1].image_url.url).toBe('https://x/page.png');
  });

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(checkChildIdentityViaVision('https://x/a.png', 'https://x/b.png')).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('throws on a non-OK response (surfaces the status)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate limited' })) as unknown as typeof fetch;
    await expect(checkChildIdentityViaVision('https://x/a.png', 'https://x/b.png')).rejects.toThrow(/429/);
  });

  it('no content from the model → uncertain @ 0 (never throws)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [] }) })) as unknown as typeof fetch;
    const out = await checkChildIdentityViaVision('https://x/a.png', 'https://x/b.png');
    expect(out.sameChild).toBe('uncertain');
    expect(out.confidence).toBe(0);
  });
});
