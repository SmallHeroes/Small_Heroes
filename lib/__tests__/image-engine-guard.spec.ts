import { afterEach, describe, expect, it } from 'vitest';
import {
  assertShippedBookStyleEngineActive,
  resolveLegacyImageProviderEnv,
} from '../image-engine-guard';

const ENV_KEYS = [
  'IMAGE_PROVIDER',
  'PHASE2_STYLE01_BOOK_PIPELINE',
  'PHASE2_STYLE02_BOOK_PIPELINE',
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
