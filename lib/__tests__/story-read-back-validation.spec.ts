import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { validateStoryMdReadBack } from '../story-gen-v3/story-read-back-validation';
import { renderStoryMdFromFiles } from '../story-gen-v3/story-md-renderer';

const RUN_DIR = path.join(
  process.cwd(),
  'outputs/test-fixtures/story-read-back-regression'
);
const TRUNCATED_FIXTURE = path.join(
  process.cwd(),
  'lib/story-gen-v3/__fixtures__/dini-popcorn-truncated-p12.md'
);
const COMPLETE_PAGES = path.join(
  process.cwd(),
  'outputs/story-gen-v3-runs/dini_premise_sprint_b-p10-2026-06-09T09-45-32-833Z/story-pages.json'
);

describe('story.md read-back validation (P0)', () => {
  it('fails completedEnding when story.md is truncated but story-pages.json is complete', () => {
    mkdirSync(RUN_DIR, { recursive: true });
    const storyMd = path.join(RUN_DIR, 'story-truncated.md');
    writeFileSync(storyMd, readFileSync(TRUNCATED_FIXTURE, 'utf8'), 'utf8');
    writeFileSync(path.join(RUN_DIR, 'story-pages.json'), readFileSync(COMPLETE_PAGES, 'utf8'));

    const result = validateStoryMdReadBack({
      storyMarkdownPath: storyMd,
      expectedPageCount: 1,
    });

    expect(result.readFromDisk).toBe(true);
    expect(result.completedEnding).toBe(false);
    expect(result.allPagesPresent).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.includes('אחרי הסרט') || f.includes('truncated'))).toBe(
      true
    );
  });

  it('passes when story.md is rendered from complete story-pages.json', () => {
    mkdirSync(RUN_DIR, { recursive: true });
    const prefix = readFileSync(
      path.join(
        process.cwd(),
        'outputs/story-gen-v3-runs/dini_premise_sprint_b-p10-2026-06-09T09-45-32-833Z/story.md'
      ),
      'utf8'
    ).split('--- Page 1 ---')[0];
    const storyMd = path.join(RUN_DIR, 'story-complete.md');
    writeFileSync(storyMd, prefix, 'utf8');
    writeFileSync(path.join(RUN_DIR, 'story-pages.json'), readFileSync(COMPLETE_PAGES, 'utf8'));

    renderStoryMdFromFiles({
      storyMarkdownPath: storyMd,
      storyPagesPath: path.join(RUN_DIR, 'story-pages.json'),
    });

    const result = validateStoryMdReadBack({
      storyMarkdownPath: storyMd,
      expectedPageCount: 12,
    });

    expect(result.completedEnding).toBe(true);
    expect(result.allPagesPresent).toBe(true);
    expect(result.validUtf8).toBe(true);
    const text = readFileSync(storyMd, 'utf8');
    expect(text.includes('אחרי הסרט')).toBe(true);
    expect(text.includes('קרצה')).toBe(true);
  });
});
