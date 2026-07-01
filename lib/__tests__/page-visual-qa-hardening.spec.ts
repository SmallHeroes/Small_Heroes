import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluatePageVisualQa } from '@/lib/generation-pipeline/page-visual-qa';

/**
 * #7-a-fix — the two QA-producer fail-opens must be closed:
 *  ITEM 1  primary Vision: a malformed/incomplete response can NEVER yield a durable `passed` (evidence_unknown).
 *  ITEM 1b strict-crib: HTTP error / malformed body / throw can NEVER keep a durable `passed` (evidence_unknown).
 * In both cases the LEGACY accept (`passed:true`) is preserved so the render loop's behavior is unchanged.
 */

const OLD_KEY = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = 'k';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (OLD_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = OLD_KEY;
});

// The primary vision call returns `content`; JSON.stringify a value or pass a raw JSON string.
function mockPrimary(value: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }),
    }))
  );
}

function goodBase(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    anatomyOk: true, identityOk: true, styleOk: true, singleChildOk: true,
    objectGeometryOk: true, emotionalStagingOk: true, uncannyNeck: false, blanketThroughRails: false,
    ...over,
  };
}
const CRIB_GOOD = {
  closedCribOk: true, nearRailPresent: true, childOutsideCrib: true, blanketInsideRails: true,
  babyInsideCrib: true, openFrontRail: false, childThroughRail: false, disconnectedRails: false,
};
const STRICT_GOOD = {
  pass: true, openFrontRail: false, childThroughRail: false, blanketThroughRail: false,
  missingNearTopRail: false, babyInsideCrib: true, explanation: 'ok',
};

// A fetch that returns the primary response, then the strict-crib response (for crib pages, two calls happen).
function mockPrimaryThenStrict(primary: unknown, strict: 'http_error' | 'throw' | unknown) {
  const fn = vi.fn();
  fn.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(primary) } }] }),
  });
  if (strict === 'http_error') {
    fn.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  } else if (strict === 'throw') {
    fn.mockImplementationOnce(async () => {
      throw new Error('strict network down');
    });
  } else {
    fn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(strict) } }] }),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('ITEM 1 — primary Vision positive validation (no durable passed on malformed/incomplete)', () => {
  const cases: Array<[string, unknown]> = [
    ['empty object {}', {}],
    ['irrelevant object (no verdict fields)', { foo: true, bar: 'x' }],
    ['missing a required base field (no uncannyNeck)', { anatomyOk: true, identityOk: true, styleOk: true, singleChildOk: true, objectGeometryOk: true, emotionalStagingOk: true, blanketThroughRails: false }],
    ['wrong field type (anatomyOk is a string)', goodBase({ anatomyOk: 'yes' })],
    ['null', null],
    ['array', [{ anatomyOk: true }]],
    ['primitive number', 5],
  ];
  for (const [name, body] of cases) {
    it(`${name} → evidence_unknown (vision_malformed), passed stays true`, async () => {
      mockPrimary(body);
      const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
      expect(r.verdict).toBe('evidence_unknown');
      expect(r.reason).toBe('vision_malformed');
      expect(r.passed).toBe(true); // legacy accept preserved
    });
  }

  it('a missing CONDITIONAL field for an active check → evidence_unknown (not a defaulted PASS)', async () => {
    // companion check active but companionSilhouetteOk omitted
    mockPrimary(goodBase());
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png', expectsCompanion: true });
    expect(r.verdict).toBe('evidence_unknown');
    expect(r.reason).toBe('vision_malformed');
  });

  it('a COMPLETE valid response still resolves to a real verdict (passed)', async () => {
    mockPrimary(goodBase());
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('passed');
  });

  it('a COMPLETE valid response with a real fail → failed', async () => {
    mockPrimary(goodBase({ singleChildOk: false }));
    const r = await evaluatePageVisualQa({ imageUrl: 'https://x/img.png' });
    expect(r.verdict).toBe('failed');
    expect(r.reason).toBe('duplicate_child');
  });
});

describe('ITEM 1b — strict-crib uncertainty can never keep a durable passed', () => {
  const cribInput = { imageUrl: 'https://x/crib.png', hasRailedBedOrCrib: true };

  it('strict-crib HTTP error → final verdict evidence_unknown (passed stays true)', async () => {
    mockPrimaryThenStrict(goodBase(CRIB_GOOD), 'http_error');
    const r = await evaluatePageVisualQa(cribInput);
    expect(r.verdict).toBe('evidence_unknown');
    expect(r.passed).toBe(true);
  });

  it('strict-crib malformed body → final verdict evidence_unknown', async () => {
    mockPrimaryThenStrict(goodBase(CRIB_GOOD), {});
    const r = await evaluatePageVisualQa(cribInput);
    expect(r.verdict).toBe('evidence_unknown');
  });

  it('strict-crib throw → final verdict evidence_unknown', async () => {
    mockPrimaryThenStrict(goodBase(CRIB_GOOD), 'throw');
    const r = await evaluatePageVisualQa(cribInput);
    expect(r.verdict).toBe('evidence_unknown');
  });

  it('strict-crib validated PASS → verdict passed', async () => {
    mockPrimaryThenStrict(goodBase(CRIB_GOOD), STRICT_GOOD);
    const r = await evaluatePageVisualQa(cribInput);
    expect(r.verdict).toBe('passed');
    expect(r.passed).toBe(true);
  });

  it('strict-crib validated FAIL → verdict failed', async () => {
    mockPrimaryThenStrict(goodBase(CRIB_GOOD), { ...STRICT_GOOD, pass: false, openFrontRail: true });
    const r = await evaluatePageVisualQa(cribInput);
    expect(r.verdict).toBe('failed');
    expect(r.passed).toBe(false);
    expect(r.reason).toBe('closed_crib_geometry_failed');
  });
});
