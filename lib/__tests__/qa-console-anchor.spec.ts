import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  approveQaAnchorCache,
  buildQaAnchorCacheKey,
  loadQaAnchorCache,
  qaAnchorRequiresStage0,
  saveQaAnchorCache,
  type QaAnchorCacheEntry,
} from '../qa-console-anchor';

describe('qa-console-anchor', () => {
  it('requires Stage 0 for all QA console renders (0071/E)', () => {
    expect(qaAnchorRequiresStage0('lion_shaket', 'lion_shaket_bedtime')).toBe(true);
    expect(qaAnchorRequiresStage0('chameleon_koko', 'chameleon_koko_fantasy')).toBe(true);
  });

  it('requires Stage 0 for wardrobe-locked lion bedtime', () => {
    expect(qaAnchorRequiresStage0('lion_shaket', 'lion_shaket_bedtime')).toBe(true);
  });

  it('requires Stage 0 for stories without story wardrobe lock too', () => {
    expect(qaAnchorRequiresStage0('lion_shaket', 'lion_shaket_adventure')).toBe(true);
  });

  it('builds stable cache keys from photo + story + wardrobe', () => {
    const wardrobe = 'BOOK WARDROBE LOCK — STORY lion_shaket_bedtime';
    const a = buildQaAnchorCacheKey({
      photoFingerprint: 'abc123',
      storyFileKey: 'lion_shaket_bedtime',
      wardrobeLock: wardrobe,
    });
    const b = buildQaAnchorCacheKey({
      photoFingerprint: 'abc123',
      storyFileKey: 'lion_shaket_bedtime',
      wardrobeLock: wardrobe,
    });
    expect(a).toBe(b);
    expect(a).toContain('lion_shaket_bedtime');
  });

  it('approves cached anchor entries for reuse', () => {
    const cacheKey = 'test_lion__fp__wardrobe';
    const localPath = path.join(process.cwd(), 'outputs', 'qa-anchors', cacheKey, 'anchor.png');
    mkdirSync(path.dirname(localPath), { recursive: true });
    writeFileSync(localPath, Buffer.from('fake-png'));
    const entry: QaAnchorCacheEntry = {
      cacheKey,
      storyFileKey: 'lion_shaket_bedtime',
      companionId: 'lion_shaket',
      wardrobeLockHash: 'deadbeef',
      childPhotoFingerprint: 'fp',
      anchorUrl: 'https://example.com/anchor.png',
      localPath,
      approved: false,
      resemblanceScore: 0.88,
      generatedAt: new Date().toISOString(),
    };
    saveQaAnchorCache(entry);
    expect(loadQaAnchorCache(entry.cacheKey)?.approved).toBe(false);
    const approved = approveQaAnchorCache(entry.cacheKey);
    expect(approved.approved).toBe(true);
    expect(loadQaAnchorCache(entry.cacheKey)?.approved).toBe(true);
  });
});
