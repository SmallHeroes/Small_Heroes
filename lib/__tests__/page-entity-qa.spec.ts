import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
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

  it('local PNG path resolves to base64 data URL', async () => {
    // This tests transport, not visual quality. No rendered book image is needed.
    const pixels = Buffer.from(Array.from({ length: 16 * 16 * 3 }, (_, i) => i % 251));
    const png = await sharp(pixels, { raw: { width: 16, height: 16, channels: 3 } })
      .png({ compressionLevel: 0 }).toBuffer();
    const root = mkdtempSync(path.join(os.tmpdir(), 'sh-entity-qa-png-'));
    try {
      const pngPath = path.join(root, 'transport.png');
      writeFileSync(pngPath, png);
      const dataUrl = resolveEntityQaVisionDataUrl(pngPath);
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(1000);
      expect(Buffer.from(dataUrl.split(',')[1], 'base64')).toEqual(png);
      expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 16, height: 16 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
