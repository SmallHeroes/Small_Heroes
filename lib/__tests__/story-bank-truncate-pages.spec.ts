import { describe, expect, it } from 'vitest';
import { truncateStoryMarkdownToPages } from '@/lib/story-bank-truncate';

const SAMPLE = `---
title: Test
powerCard:
  companionId: bear_cub_gahal
---

--- Page 1 ---
imageDirection: scene one
Page one text.

--- Page 2 ---
imageDirection: scene two
Page two text.

--- Page 3 ---
imageDirection: scene three
Page three text.

--- Page 4 ---
imageDirection: scene four
Page four text.
`;

describe('truncateStoryMarkdownToPages', () => {
  it('keeps frontmatter and first N page blocks', () => {
    const truncated = truncateStoryMarkdownToPages(SAMPLE, 3);
    expect(truncated).toContain('powerCard:');
    expect(truncated).toContain('--- Page 1 ---');
    expect(truncated).toContain('--- Page 2 ---');
    expect(truncated).toContain('--- Page 3 ---');
    expect(truncated).not.toContain('--- Page 4 ---');
    expect(truncated).not.toContain('Page four text');
  });

  it('returns full markdown when maxPages exceeds story length', () => {
    expect(truncateStoryMarkdownToPages(SAMPLE, 10)).toBe(SAMPLE);
  });
});
