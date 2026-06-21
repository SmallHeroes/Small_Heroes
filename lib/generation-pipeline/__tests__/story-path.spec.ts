import path from 'path';

import { describe, expect, it } from 'vitest';

import { resolveCachedStoryFilePath, toRepoRelativeStoryPath } from '../story-path';

describe('story-path (0095 P0)', () => {
  it('toRepoRelativeStoryPath makes an absolute cwd path repo-relative (posix)', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'dragon_dini_bedtime.md');
    expect(toRepoRelativeStoryPath(abs)).toBe('story-bank/v3-approved/dragon_dini_bedtime.md');
  });

  it('toRepoRelativeStoryPath leaves a relative path unchanged', () => {
    expect(toRepoRelativeStoryPath('story-bank/v5-fixed-v2/x.md')).toBe('story-bank/v5-fixed-v2/x.md');
  });

  it('resolves the absolute path from { storyDir, selectionFilename }', () => {
    const got = resolveCachedStoryFilePath({
      storyDir: 'v3-approved',
      selectionFilename: 'fox_uri_adventure.md',
    });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md'));
  });

  it('resolves a relative storyFilePath to absolute', () => {
    const got = resolveCachedStoryFilePath({ storyFilePath: 'story-bank/v3-approved/x.md' });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md'));
  });

  it('returns a legacy absolute storyFilePath unchanged (in-flight caches)', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md');
    expect(resolveCachedStoryFilePath({ storyFilePath: abs })).toBe(abs);
  });

  it('prefers devStoryBankFile over storyFilePath', () => {
    const got = resolveCachedStoryFilePath({
      devStoryBankFile: 'story-bank/v5-fixed-v2/d.md',
      storyFilePath: 'story-bank/v3-approved/x.md',
    });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'd.md'));
  });

  it('returns undefined when the cache carries no story reference', () => {
    expect(resolveCachedStoryFilePath({})).toBeUndefined();
  });

  it('round-trips: store relative → resolve to absolute → relative again', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md');
    const rel = toRepoRelativeStoryPath(abs);
    expect(path.isAbsolute(rel)).toBe(false);
    const resolved = resolveCachedStoryFilePath({ storyFilePath: rel })!;
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(toRepoRelativeStoryPath(resolved)).toBe(rel);
  });
});
