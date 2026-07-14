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

function mockVision(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }),
    }))
  );
}

// (#7-a-fix) A COMPLETE base verdict object (all 8 base fields present as booleans), good values by default.
// (Stage 1) The 4 UNIVERSAL safety booleans are now always required + safe by default.
function goodBase(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    anatomyOk: true, identityOk: true, styleOk: true, singleChildOk: true,
    objectGeometryOk: true, emotionalStagingOk: true, uncannyNeck: false, blanketThroughRails: false,
    physicallySafe: true, childOnRailing: false, childUnsupportedAtHeight: false, dangerousProximity: false,
    ...over,
  };
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

  it('complete clean vision response → verdict passed', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockVision(goodBase({ notes: 'looks good' }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('passed');
    expect(r.passed).toBe(true);
  });

  it('complete failing vision response (bad anatomy) → verdict failed', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockVision(goodBase({ anatomyOk: false, uncannyNeck: true, notes: 'twisted neck' }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('failed');
    expect(r.passed).toBe(false);
    expect(r.reason).toBe('anatomy_failed');
  });
});

describe('evaluatePageVisualQa — UNIVERSAL physical-safety gate (Stage 1)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'k';
  });

  it('a safe scene passes (safety fields present + all false) — no context needed', async () => {
    mockVision(goodBase());
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/p.png' });
    expect(r.verdict).toBe('passed');
    expect(r.flags.safetyOk).toBe(true);
    expect(r.safetyHazards).toEqual([]);
  });

  it('child on a railing → verdict failed, reason safety_failed, hazard reported', async () => {
    mockVision(goodBase({ childOnRailing: true, safetyNotes: 'child sitting on balcony railing' }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/p.png' });
    expect(r.verdict).toBe('failed');
    expect(r.passed).toBe(false);
    expect(r.reason).toBe('safety_failed');
    expect(r.flags.safetyOk).toBe(false);
    expect(r.safetyHazards).toContain('child_on_railing');
  });

  it('unsupported at height + physicallySafe false → multiple hazards, still safety_failed', async () => {
    mockVision(goodBase({ physicallySafe: false, childUnsupportedAtHeight: true }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/p.png' });
    expect(r.verdict).toBe('failed');
    expect(r.reason).toBe('safety_failed');
    expect(r.safetyHazards).toEqual(expect.arrayContaining(['unsupported_at_height', 'unsafe_pose']));
  });

  it('safety DOMINATES another failure (safety + duplicate child) → reason safety_failed', async () => {
    mockVision(goodBase({ childOnRailing: true, singleChildOk: false }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/p.png' });
    expect(r.reason).toBe('safety_failed'); // safety is first in the ladder
  });

  it('a response OMITTING the safety fields → evidence_unknown (fail-closed, never a defaulted safe pass)', async () => {
    // A base-complete response with NO safety booleans — the safety prompt was ignored by the model.
    mockVision({
      anatomyOk: true, identityOk: true, styleOk: true, singleChildOk: true,
      objectGeometryOk: true, emotionalStagingOk: true, uncannyNeck: false, blanketThroughRails: false,
    });
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/p.png' });
    expect(r.verdict).toBe('evidence_unknown');
    expect(r.reason).toBe('vision_malformed');
  });
});
