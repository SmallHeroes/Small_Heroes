import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluatePageVisualQa,
  evaluatePageVisualQaWithReQa,
} from '@/lib/generation-pipeline/page-visual-qa';

function primaryResponse(value: unknown) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }),
  };
}

function goodBase(overrides: Record<string, unknown> = {}) {
  return {
    anatomyOk: true,
    identityOk: true,
    styleOk: true,
    singleChildOk: true,
    objectGeometryOk: true,
    emotionalStagingOk: true,
    uncannyNeck: false,
    blanketThroughRails: false,
    physicallySafe: true,
    childOnRailing: false,
    childUnsupportedAtHeight: false,
    dangerousProximity: false,
    ...overrides,
  };
}

const CRIB_GOOD = {
  closedCribOk: true,
  nearRailPresent: true,
  childOutsideCrib: true,
  blanketInsideRails: true,
  babyInsideCrib: true,
  openFrontRail: false,
  childThroughRail: false,
  disconnectedRails: false,
};

const STRICT_GOOD = {
  pass: true,
  openFrontRail: false,
  childThroughRail: false,
  blanketThroughRail: false,
  missingNearTopRail: false,
  babyInsideCrib: true,
  explanation: 'ok',
};

describe('page visual QA dedicated deadlines', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('PAGE_VISUAL_QA_TIMEOUT_MS', '4321');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a fresh bounded AbortSignal for every bounded same-candidate QA attempt', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const signals: AbortSignal[] = [];
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return primaryResponse({});
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qa = await evaluatePageVisualQaWithReQa(
      { imageUrl: 'https://cdn.example/persisted.png' },
      evaluatePageVisualQa,
      2,
    );

    expect(qa.reason).toBe('vision_malformed');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(timeoutSpy).toHaveBeenCalledTimes(3);
    expect(timeoutSpy.mock.calls.every(([timeoutMs]) => timeoutMs === 4321)).toBe(true);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    expect(new Set(signals).size).toBe(3);
  });

  it('classifies a dedicated deadline firing as retryable timeout evidence, then stops at the bound', async () => {
    const signals: AbortSignal[] = [];
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      controller.abort(new DOMException('QA deadline exceeded', 'TimeoutError'));
      signals.push(controller.signal);
      return controller.signal;
    });
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      throw signal.reason;
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qa = await evaluatePageVisualQaWithReQa(
      { imageUrl: 'https://cdn.example/persisted.png' },
      evaluatePageVisualQa,
      2,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(signals).toHaveLength(3);
    expect(new Set(signals).size).toBe(3);
    expect(qa.verdict).toBe('evidence_unknown');
    expect(qa.reason).toBe('vision_timeout');
    expect(qa.safetyStatus).toBe('unverified');
  });

  it('gives the strict crib follow-up its own fresh deadline instead of reusing the primary signal', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const signals: AbortSignal[] = [];
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return signals.length === 1
        ? primaryResponse(goodBase(CRIB_GOOD))
        : primaryResponse(STRICT_GOOD);
    });
    vi.stubGlobal('fetch', fetchSpy);

    const qa = await evaluatePageVisualQa({
      imageUrl: 'https://cdn.example/crib.png',
      hasRailedBedOrCrib: true,
    });

    expect(qa.verdict).toBe('passed');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
    expect(signals[0]).not.toBe(signals[1]);
  });
});
