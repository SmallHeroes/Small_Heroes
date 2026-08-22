import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStoryFromBank } from '@/backend/providers/story-bank-loader';

const SOURCE_PATH = path.join(
  process.cwd(),
  'story-pipeline',
  '04_approved_story_sources',
  'accepted',
  'chameleon_koko_bedtime',
  'revisions',
  '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb',
  'integrated.md',
);

describe('product-accepted gender-flexible runtime Story Source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves boy and girl prose deterministically without a provider rewrite', async () => {
    const fetchSentinel = vi.fn(() => {
      throw new Error('provider/network must remain unreachable');
    });
    vi.stubGlobal('fetch', fetchSentinel);

    const boy = await loadStoryFromBank(SOURCE_PATH, 'בר', 'קים', 'boy', {
      patchContext: null,
      letterContext: null,
    });
    const girl = await loadStoryFromBank(SOURCE_PATH, 'בר', 'קים', 'girl', {
      patchContext: null,
      letterContext: null,
    });
    const boyText = boy.pages.map((page) => page.text).join('\n');
    const girlText = girl.pages.map((page) => page.text).join('\n');

    expect(boy.pages).toHaveLength(8);
    expect(girl.pages).toHaveLength(8);
    expect(boyText).toContain('בר ניסה לסובב אותה');
    expect(boyText).toContain('הוא הוביל את האוטובוס');
    expect(boyText).toContain('קִים התכרבלה לידו');
    expect(girlText).toContain('בר ניסתה לסובב אותה');
    expect(girlText).toContain('היא הובילה את האוטובוס');
    expect(girlText).toContain('קִים התכרבלה לידה');
    expect(`${boyText}\n${girlText}`).not.toMatch(/\{[^{}|]+\|[^{}|]+\}/);
    expect(fetchSentinel).not.toHaveBeenCalled();
  });
});
