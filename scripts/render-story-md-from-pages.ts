/**
 * Re-render story.md from canonical story-pages.json + YAML prefix.
 *
 *   npx tsx scripts/render-story-md-from-pages.ts <run-dir>
 */
import path from 'path';

import { renderStoryMdFromFiles } from '../lib/story-gen-v3/story-md-renderer';
import { validateStoryMdReadBack } from '../lib/story-gen-v3/story-read-back-validation';

const runDir = path.resolve(process.argv[2] ?? '');
const storyMd = path.join(runDir, 'story.md');
const storyPages = path.join(runDir, 'story-pages.json');

renderStoryMdFromFiles({ storyMarkdownPath: storyMd, storyPagesPath: storyPages });

const readBack = validateStoryMdReadBack({
  storyMarkdownPath: storyMd,
  expectedPageCount: 12,
});

console.log('[render] story.md re-rendered from story-pages.json');
console.log('[render] read-back:', JSON.stringify(readBack, null, 2));
if (!readBack.completedEnding || readBack.failures.length) {
  process.exitCode = 2;
}
