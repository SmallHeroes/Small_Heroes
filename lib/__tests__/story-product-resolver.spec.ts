/**
 * Order product source-of-truth: direction/pages/price must come from the
 * story that will actually be served — never from a silent fallback.
 * Acceptance (launch-blocker): forcing the Bunny v3 story → bedtime/10/₪59,
 * even when the client claims adventure/15/₪99.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  resolveStoryProductTruth,
  StoryProductResolutionError,
} from '../../backend/providers/story-product-resolver';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const BUNNY_BEDTIME = path.join(V3_APPROVED_DIR, 'bunny_ometz_bedtime.md');

const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;
// Only delete the fixture if WE created it (a real import may land here later).
let createdFixture = false;

function writeBunnyFixture(pages: number, direction = 'bedtime') {
  fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
  fs.writeFileSync(
    BUNNY_BEDTIME,
    `---\ntitle: "באני fixture"\ncompanionId: bunny_ometz\ndirection: ${direction}\npages: ${pages}\n---\n--- Page 1 ---\nimageDirection: x\nשלום\n`,
    'utf8'
  );
}

describe('resolveStoryProductTruth', () => {
  beforeEach(() => {
    createdFixture = !fs.existsSync(BUNNY_BEDTIME);
  });

  afterEach(() => {
    if (createdFixture && fs.existsSync(BUNNY_BEDTIME)) fs.unlinkSync(BUNNY_BEDTIME);
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
  });

  it('ACCEPTANCE: bunny v3 binding overrides client adventure claim → bedtime/10/59', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (createdFixture) writeBunnyFixture(10);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('bedtime');
    expect(resolved.storyLength).toBe('short');
    expect(resolved.pages).toBe(10);
    expect(resolved.priceILS).toBe(59);
    expect(resolved.source).toBe('v3_approved_binding');
  });

  it('flag OFF: v3-approved file is ignored, client direction resolves via companion golden', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    if (createdFixture) writeBunnyFixture(10);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('adventure');
    expect(resolved.priceILS).toBe(79);
    expect(resolved.source).toBe('companion_golden');
  });

  it('v3 binding with mismatched pages frontmatter fails loudly (500)', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (!createdFixture) return; // never overwrite a real import
    writeBunnyFixture(15);

    expect(() =>
      resolveStoryProductTruth({ companionId: 'bunny_ometz', clientDirection: 'bedtime' })
    ).toThrowError(StoryProductResolutionError);
  });

  it('missing direction with no derivable story fails loudly (400) — no adventure guess', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    let caught: unknown = null;
    try {
      resolveStoryProductTruth({ companionId: null, clientDirection: null });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoryProductResolutionError);
    expect((caught as StoryProductResolutionError).httpStatus).toBe(400);
  });

  it('legacy product.length still maps (short → bedtime/59)', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    const resolved = resolveStoryProductTruth({ legacyLength: 'short' });
    expect(resolved.storyDirection).toBe('bedtime');
    expect(resolved.priceILS).toBe(59);
    expect(resolved.source).toBe('legacy_length');
  });

  it('pages derive from the served story frontmatter when it deviates from the table', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    // dog_layla_adventure is one of the v5 files with pages=12 (frontmatter truth).
    const v5Dir = path.join(
      process.cwd(),
      'story-bank',
      (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
    );
    const sample = fs
      .readdirSync(v5Dir)
      .find((f) => /_adventure\.md$/.test(f) && /^pages:\s*12\s*$/m.test(fs.readFileSync(path.join(v5Dir, f), 'utf8')));
    if (!sample) return; // bank normalized — nothing to assert
    const companionId = sample.replace(/_adventure\.md$/, '');
    const resolved = resolveStoryProductTruth({ companionId, clientDirection: 'adventure' });
    expect(resolved.pages).toBe(12);
    expect(resolved.priceILS).toBe(79); // price stays on the table
  });
});
