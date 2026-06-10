/**
 * Order product source-of-truth: direction/pages/price must come from the
 * story that will actually be served — never from a silent fallback.
 * Acceptance (launch-blocker): forcing the Bunny v3 story → bedtime/8 beats/₪59,
 * even when the client claims adventure.
 * Canonical BEAT counts (2026-06-10): bedtime=8, adventure=12, fantasy=16;
 * customer display = beats × 2 physical pages (displayPages).
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('ACCEPTANCE: bunny v3 binding overrides client adventure claim → bedtime/8 beats/59 (display 16)', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (createdFixture) writeBunnyFixture(8);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('bedtime');
    expect(resolved.storyLength).toBe('short');
    expect(resolved.pages).toBe(8);
    expect(resolved.displayPages).toBe(16);
    expect(resolved.priceILS).toBe(59);
    expect(resolved.source).toBe('v3_approved_binding');
  });

  it('flag OFF: v3-approved file is ignored, client direction resolves via companion golden', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    if (createdFixture) writeBunnyFixture(8);

    const resolved = resolveStoryProductTruth({
      companionId: 'bunny_ometz',
      clientDirection: 'adventure',
    });
    expect(resolved.storyDirection).toBe('adventure');
    expect(resolved.priceILS).toBe(79);
    expect(resolved.source).toBe('companion_golden');
  });

  it('v3 binding with mismatched pages frontmatter fails loudly (500) — old 10-beat bedtime rejected', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    if (!createdFixture) return; // never overwrite a real import
    writeBunnyFixture(10);

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

  it('non-canonical frontmatter: pages follow the served story, dev warning fires (launch-routing guard)', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    // Templated v5 adventure files with pages=15 (old rule) deviate from the
    // new canonical 12 beats — they must resolve to their ACTUAL count and warn.
    const v5Dir = path.join(
      process.cwd(),
      'story-bank',
      (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
    );
    const samples = fs
      .readdirSync(v5Dir)
      .filter((f) => /_adventure\.md$/.test(f) && /^pages:\s*15\s*$/m.test(fs.readFileSync(path.join(v5Dir, f), 'utf8')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Not every bank file belongs to a servable (active) companion — find
      // one the selector actually binds.
      let resolved = null;
      for (const sample of samples) {
        try {
          resolved = resolveStoryProductTruth({
            companionId: sample.replace(/_adventure\.md$/, ''),
            clientDirection: 'adventure',
          });
          break;
        } catch {
          /* companion not servable — try the next file */
        }
      }
      if (!resolved) return; // bank normalized / no servable deviating story
      expect(resolved.pages).toBe(15); // frontmatter truth — served as-is
      expect(resolved.displayPages).toBe(30);
      expect(resolved.priceILS).toBe(79); // price stays on the table
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('non-canonical story bound'))
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('canonical frontmatter (12-beat adventure) binds without a warning', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    const v5Dir = path.join(
      process.cwd(),
      'story-bank',
      (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
    );
    const sample = fs
      .readdirSync(v5Dir)
      .find((f) => /_adventure\.md$/.test(f) && /^pages:\s*12\s*$/m.test(fs.readFileSync(path.join(v5Dir, f), 'utf8')));
    if (!sample) return;
    const companionId = sample.replace(/_adventure\.md$/, '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const resolved = resolveStoryProductTruth({ companionId, clientDirection: 'adventure' });
      expect(resolved.pages).toBe(12);
      expect(resolved.displayPages).toBe(24);
      expect(
        warnSpy.mock.calls.some((args) => String(args[0]).includes('non-canonical story bound'))
      ).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
