import { describe, expect, it } from 'vitest';

import { storyPagesFromMarkdown } from '../story-gen-v3/story-md-renderer';

describe('story-md-renderer', () => {
  it('storyPagesFromMarkdown keeps prose after imageDirection line', () => {
    const md = `--- Page 1 ---
imageDirection: A child reaches.

גרעין קפץ.
"אש!"

--- Page 2 ---
imageDirection: Dini lands.

דיני נחתה.`;

    const pages = storyPagesFromMarkdown(md);
    expect(pages[0].prose).toContain('גרעין קפץ');
    expect(pages[1].prose).toContain('דיני נחתה');
  });
});
