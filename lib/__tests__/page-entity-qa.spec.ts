import { describe, expect, it } from 'vitest';

import {
  evaluateEntityQaFromRaw,
  evaluatePageEntityQa,
  isEntityQaVerifiedPass,
  resolveEntityQaVisionDataUrl,
} from '../generation-pipeline/page-entity-qa';

describe('page-entity-qa (0074)', () => {
  it('hard-fails duplicate_companion when companionCount > 1', () => {
    const result = evaluateEntityQaFromRaw({
      expectsChild: true,
      expectsCompanion: true,
      raw: {
        singleChildOnly: true,
        companionPresentOk: true,
        companionSpeciesOk: true,
        companionIdentityOk: true,
        companionCount: 3,
        singleCompanionOnly: false,
        duplicateChildCount: 1,
        notes: 'three chameleons',
      },
    });
    expect(result.status).toBe('fail');
    expect(result.passed).toBe(false);
    expect(result.hardFailures).toContain('duplicate_companion');
  });

  it('passes single companion', () => {
    const result = evaluateEntityQaFromRaw({
      expectsChild: true,
      expectsCompanion: true,
      raw: {
        singleChildOnly: true,
        companionPresentOk: true,
        companionSpeciesOk: true,
        companionIdentityOk: true,
        companionCount: 1,
        singleCompanionOnly: true,
        duplicateChildCount: 1,
        notes: 'ok',
      },
    });
    expect(result.status).toBe('pass');
    expect(result.passed).toBe(true);
    expect(isEntityQaVerifiedPass(result)).toBe(true);
  });

  it('incomplete JSON is error, never pass', () => {
    const result = evaluateEntityQaFromRaw({
      expectsChild: true,
      expectsCompanion: true,
      raw: {},
    });
    expect(result.status).toBe('error');
    expect(result.passed).toBe(false);
    expect(isEntityQaVerifiedPass(result)).toBe(false);
  });

  it('local PNG path resolves to base64 data URL', () => {
    const dataUrl = resolveEntityQaVisionDataUrl(
      'outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-155755/page-05.png',
    );
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(1000);
  });

  it('missing API key is error, never pass', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await evaluatePageEntityQa({
      imageUrl: 'https://example.com/page.png',
      companionId: 'chameleon_koko',
      companionName: 'קים',
      expectsCompanion: true,
      expectsChild: true,
    });
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    expect(result.status).toBe('error');
    expect(result.passed).toBe(false);
  });
});
