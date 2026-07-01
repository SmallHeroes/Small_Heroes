import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluatePageVisualQa, resolvePageVisualQaConfig } from '@/lib/generation-pipeline/page-visual-qa';

const OLD_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  delete process.env.PAGE_VISUAL_QA_MAX_REGENS;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (OLD_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = OLD_KEY;
  delete process.env.PAGE_VISUAL_QA_MAX_REGENS;
});

function mockVision(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }),
    }))
  );
}

describe('resolvePageVisualQaConfig — hard cap 5 → 2 (#7-a)', () => {
  it('caps maxRegens at 2 even when the env asks for 5', () => {
    process.env.PAGE_VISUAL_QA_MAX_REGENS = '5';
    expect(resolvePageVisualQaConfig().maxRegens).toBe(2);
  });
  it('default is 2', () => {
    expect(resolvePageVisualQaConfig().maxRegens).toBe(2);
  });
  it('can still be lowered below 2', () => {
    process.env.PAGE_VISUAL_QA_MAX_REGENS = '1';
    expect(resolvePageVisualQaConfig().maxRegens).toBe(1);
  });
});

describe('evaluatePageVisualQa — durable verdict is fail-closed while `passed` preserves legacy accept', () => {
  it('missing OPENAI_API_KEY → verdict evidence_unknown (passed stays true for the render loop)', async () => {
    delete process.env.OPENAI_API_KEY;
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('evidence_unknown');
    expect(r.passed).toBe(true); // legacy render-loop behavior preserved
    expect(r.reason).toBe('vision_skipped');
  });

  it('vision HTTP non-200 → verdict evidence_unknown', async () => {
    process.env.OPENAI_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('evidence_unknown');
    expect(r.reason).toBe('vision_error');
    expect(r.passed).toBe(true);
  });

  it('vision throws (network) → verdict evidence_unknown', async () => {
    process.env.OPENAI_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('evidence_unknown');
  });

  it('clean vision response → verdict passed', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockVision({
      anatomyOk: true,
      identityOk: true,
      styleOk: true,
      singleChildOk: true,
      objectGeometryOk: true,
      emotionalStagingOk: true,
      notes: 'looks good',
    });
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('passed');
    expect(r.passed).toBe(true);
  });

  it('failing vision response (bad anatomy) → verdict failed', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockVision({ anatomyOk: false, uncannyNeck: true, notes: 'twisted neck' });
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('failed');
    expect(r.passed).toBe(false);
    expect(r.reason).toBe('anatomy_failed');
  });
});
