/**
 * Step 5.3 — revalidate repaired Dini F1 artifact (no regen).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { DINI_F1_HATISA_HARISHONA } from '../lib/story-gen/scenarios-dragon-dini';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';
import {
  computePageWordCounts,
  formatWordCountLine,
} from '../lib/story-gen/story-page-utils';
import { runWritersRoomBoundedLoop } from '../lib/story-gen/writers-room-bounded-loop';
import { FANTASY_WORD_MIN } from '../lib/story-gen/word-bands';

const RUN_DIR = path.join(
  process.cwd(),
  'outputs/story-gen-runs/step5-dini-f1-2026-06-08T18-49-41-489Z'
);
const STORY_PATH = path.join(RUN_DIR, 'story.md');

function stripWordCount(md: string): string {
  return md.replace(/\r?\nWORD_COUNT:[^\n]*(\r?\n\*\*[^\n]*\*\*)?[\s\S]*$/i, '').trim();
}

async function main(): Promise<void> {
  let storyMarkdown = fs.readFileSync(STORY_PATH, 'utf8');
  storyMarkdown = stripWordCount(storyMarkdown);
  const counts = computePageWordCounts(storyMarkdown);
  storyMarkdown = `${storyMarkdown}\n\n${formatWordCountLine(counts)}`;
  fs.writeFileSync(STORY_PATH, storyMarkdown, 'utf8');
  fs.writeFileSync(path.join(RUN_DIR, 'story.final.md'), storyMarkdown, 'utf8');

  const outline = JSON.parse(
    fs.readFileSync(path.join(RUN_DIR, 'outline.json'), 'utf8')
  ) as StoryOutline;
  const scenario = resolveScenarioById(DINI_F1_HATISA_HARISHONA.id);

  console.log('[step5.3] revalidate repaired artifact...');
  const loop = await runWritersRoomBoundedLoop({
    storyMarkdown,
    scenario,
    outline,
    reportId: scenario.id,
    runLabel: 'step5-3-revalidate',
    skipAdventureEnrich: true,
    blockAuthorRewrite: true,
    judgeModel: 'gpt-5-chat-latest',
    draftModel: 'gpt-5-chat-latest',
  });

  const outDir = path.join(RUN_DIR, 'step5-3-revalidate');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'bounded-loop-report.json'), JSON.stringify(loop, null, 2));

  const finalCounts = computePageWordCounts(loop.finalStoryMarkdown);
  const belowFloor = finalCounts.filter((c) => c < FANTASY_WORD_MIN).length;

  const summary = {
    terminal: loop.terminal,
    tasteTerminal: loop.tasteTerminal,
    taste: loop.finalTaste.verdict,
    technicalPass: loop.technicalPass,
    technicalFailures: loop.technicalFailures,
    totalWords: finalCounts.reduce((a, b) => a + b, 0),
    perPage: finalCounts,
    belowFantasyFloor: belowFloor,
    lexicalBlockers: loop.lexicalRouting?.blockerCount ?? null,
    proseReview: loop.lexicalRouting?.highSeverityProseReviewCount ?? null,
    authorRewrite: loop.authorRewriteUsed,
    craft: loop.craftV21.overall,
    freshness: loop.freshnessTest.recommendation,
    shapeMax: loop.freshnessTest.shapeOverlapMax,
  };

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
