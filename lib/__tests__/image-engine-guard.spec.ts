import { afterEach, describe, expect, it } from 'vitest';
import {
  assertOrderStyleSellable,
  assertPipelineStyleBranchMatchesOrder,
  assertShippedBookStyleEngineActive,
  resolveLegacyImageProviderEnv,
  resolveOrderStyleBranch,
} from '../image-engine-guard';

const ENV_KEYS = [
  'IMAGE_PROVIDER',
  'PHASE2_STYLE01_BOOK_PIPELINE',
  'PHASE2_STYLE02_BOOK_PIPELINE',
  'STYLE02_SELLABLE',
] as const;

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

describe('image-engine-guard', () => {
  const snap = saveEnv();

  afterEach(() => restoreEnv(snap));

  it('throws when Style 01 is requested without PHASE2_STYLE01_BOOK_PIPELINE', () => {
    delete process.env.PHASE2_STYLE01_BOOK_PIPELINE;
    expect(() => assertShippedBookStyleEngineActive('soft_hand_drawn_storybook')).toThrow(
      /PHASE2_STYLE01_BOOK_PIPELINE=true/
    );
  });

  it('throws when Style 02 is requested without PHASE2_STYLE02_BOOK_PIPELINE', () => {
    delete process.env.PHASE2_STYLE02_BOOK_PIPELINE;
    expect(() => assertShippedBookStyleEngineActive('detailed_whimsical_world')).toThrow(
      /PHASE2_STYLE02_BOOK_PIPELINE=true/
    );
  });

  it('allows Style 01 when phase-2 flag is on', () => {
    process.env.PHASE2_STYLE01_BOOK_PIPELINE = 'true';
    expect(() => assertShippedBookStyleEngineActive('soft_hand_drawn_storybook')).not.toThrow();
  });

  it('does not throw for non-shipped legacy styles', () => {
    delete process.env.PHASE2_STYLE01_BOOK_PIPELINE;
    delete process.env.PHASE2_STYLE02_BOOK_PIPELINE;
    expect(() => assertShippedBookStyleEngineActive('whimsical_comic_fantasy')).not.toThrow();
  });

  it('throws when IMAGE_PROVIDER is unset (no silent replicate default)', () => {
    delete process.env.IMAGE_PROVIDER;
    expect(() => resolveLegacyImageProviderEnv()).toThrow(/IMAGE_PROVIDER is unset/);
  });

  it('returns explicit legacy provider when set', () => {
    process.env.IMAGE_PROVIDER = 'replicate';
    expect(resolveLegacyImageProviderEnv()).toBe('replicate');
  });
});

describe('style branch + sellable gates (bunny forensics Gap 2)', () => {
  const snap = saveEnv();

  afterEach(() => restoreEnv(snap));

  it('resolves DB enums and canonical ids to the right branch', () => {
    expect(resolveOrderStyleBranch('pencil_watercolor')).toBe('style01');
    expect(resolveOrderStyleBranch('soft_hand_drawn_storybook')).toBe('style01');
    expect(resolveOrderStyleBranch('detailed_whimsical_world')).toBe('style02');
    expect(resolveOrderStyleBranch('whimsical_comic_fantasy')).toBe('style02');
  });

  it('blocks Style 02 orders while STYLE02_SELLABLE is not true', () => {
    delete process.env.STYLE02_SELLABLE;
    expect(() => assertOrderStyleSellable('detailed_whimsical_world', 'order creation')).toThrow(
      /not sellable/
    );
    process.env.STYLE02_SELLABLE = 'false';
    expect(() => assertOrderStyleSellable('detailed_whimsical_world')).toThrow(/not sellable/);
  });

  it('opens Style 02 only with the explicit env gate', () => {
    process.env.STYLE02_SELLABLE = 'true';
    expect(() => assertOrderStyleSellable('detailed_whimsical_world')).not.toThrow();
  });

  it('never blocks Style 01 orders', () => {
    delete process.env.STYLE02_SELLABLE;
    expect(() => assertOrderStyleSellable('pencil_watercolor')).not.toThrow();
    expect(() => assertOrderStyleSellable('soft_hand_drawn_storybook')).not.toThrow();
  });

  it('throws on pipeline-vs-order style mismatch — no warning, no fallback', () => {
    expect(() =>
      assertPipelineStyleBranchMatchesOrder({
        orderIllustrationStyle: 'detailed_whimsical_world',
        pipelineStyleBranch: 'style01',
        context: 'stage0-method-b child anchor',
      })
    ).toThrow(/style mismatch/);
    expect(() =>
      assertPipelineStyleBranchMatchesOrder({
        orderIllustrationStyle: 'pencil_watercolor',
        pipelineStyleBranch: 'style02',
        context: 'generateWithGPTImageStyle02',
      })
    ).toThrow(/style mismatch/);
  });

  it('passes when the branch matches the order style', () => {
    expect(() =>
      assertPipelineStyleBranchMatchesOrder({
        orderIllustrationStyle: 'pencil_watercolor',
        pipelineStyleBranch: 'style01',
        context: 'pages',
      })
    ).not.toThrow();
  });
});
