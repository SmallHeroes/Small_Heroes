import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import {
  buildFrozenStoryProductTruth,
  STORY_PRODUCT_CONTRACT_VERSION,
} from '@/lib/generation-pipeline/frozen-product-truth';

describe('buildFrozenStoryProductTruth', () => {
  it('binds exact source bytes + repo-relative selection + product contract version', () => {
    const storyFilePath = path.join(
      process.cwd(),
      'story-bank',
      'v3-approved',
      'bunny_ometz_bedtime.md',
    );
    const expectedHash = createHash('sha256').update(readFileSync(storyFilePath)).digest('hex');
    const truth = buildFrozenStoryProductTruth({
      storyFilePath,
      expectedPageCount: 8,
      storyDirection: ' Bedtime ',
    });
    expect(truth).toEqual({
      expectedPageCount: 8,
      storySourceHash: expectedHash,
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      frozenProductVersion: `${STORY_PRODUCT_CONTRACT_VERSION}:bedtime`,
    });
  });

  it('rejects an invalid expected page count', () => {
    expect(() => buildFrozenStoryProductTruth({
      storyFilePath: path.join(process.cwd(), 'story-bank', 'v3-approved', 'bunny_ometz_bedtime.md'),
      expectedPageCount: 0,
      storyDirection: 'bedtime',
    })).toThrow('invalid_frozen_expected_page_count');
  });
});
