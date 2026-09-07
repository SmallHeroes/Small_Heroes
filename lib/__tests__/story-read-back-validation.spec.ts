import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import os from 'node:os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateStoryMdReadBack } from '../story-gen-v3/story-read-back-validation';
import { renderStoryMdFromFiles } from '../story-gen-v3/story-md-renderer';

let RUN_DIR: string;
const TRUNCATED_FIXTURE = path.join(
  process.cwd(),
  'lib/story-gen-v3/__fixtures__/dini-popcorn-truncated-p12.md'
);
const COMPLETE_PAGES = path.join(
  process.cwd(),
  'lib/__tests__/fixtures/residual-gate/read-back/story-pages.json'
);

describe('story.md read-back validation (P0)', () => {
  beforeEach(() => {
    RUN_DIR = mkdtempSync(path.join(os.tmpdir(), 'sh-story-read-back-'));
  });
  afterEach(() => {
    rmSync(RUN_DIR, { recursive: true, force: true });
  });

  it('fails completedEnding when story.md is truncated but story-pages.json is complete', () => {
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
    const prefix = readFileSync(
      path.join(
        process.cwd(),
        'lib/__tests__/fixtures/residual-gate/read-back/story.md'
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

  it('completedEnding is false when story has bare pipe gender chip in prose', () => {
    const storyMd = path.join(RUN_DIR, 'bare-pipe-chip.md');
    writeFileSync(
      storyMd,
      [
        '---',
        'title: "fixture"',
        '---',
        '--- Page 1 ---',
        'imageDirection: child at window',
        'הילד התכופף|התכופפה ליד החלון.',
      ].join('\n'),
      'utf8'
    );

    const result = validateStoryMdReadBack({
      storyMarkdownPath: storyMd,
      expectedPageCount: 1,
      endingProfile: 'confidence_generic',
      requiredEndingMarkers: [],
    });

    expect(result.completedEnding).toBe(false);
    expect(result.failures.some((f) => f.includes('bare pipe'))).toBe(true);
  });
});
