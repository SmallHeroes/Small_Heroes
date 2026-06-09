/**
 * Generator-v2 Exp1b — prose-only rerun (locked Exp1 spine + beats).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v2-exp1b.ts
 *
 * Optional: --source <exp1-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { generateProseExp1b } from '../lib/story-gen-v2/prose-gen-exp1b';
import {
  formatSelfCheckMarkdown,
  runProseExp1bSelfCheck,
} from '../lib/story-gen-v2/prose-exp1b-self-check';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from '../lib/story-gen-v2/types';

const DEFAULT_EXP1_DIR = path.join(
  process.cwd(),
  'outputs/story-gen-v2-runs/panda_anat_adv_social_v2_exp1-2026-06-09T06-33-51-212Z'
);

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function main(): Promise<void> {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
  const sourceDir = sourceArg ? path.resolve(sourceArg) : DEFAULT_EXP1_DIR;

  const spinePath = path.join(sourceDir, 'story-spine.json');
  const beatsPath = path.join(sourceDir, 'page-beats.json');
  const specPath = path.join(sourceDir, 'experiment-spec.json');

  if (!fs.existsSync(spinePath) || !fs.existsSync(beatsPath)) {
    throw new Error(`Missing Exp1 artifacts in ${sourceDir}`);
  }

  const spineRaw = fs.readFileSync(spinePath, 'utf8');
  const beatsRaw = fs.readFileSync(beatsPath, 'utf8');
  const spine = readJson<StorySpineV2>(spinePath);
  const beats = readJson<PageBeatV2[]>(beatsPath);
  const spec = fs.existsSync(specPath)
    ? readJson<ExperimentSpecV2>(specPath)
    : ({
        id: 'panda_anat_adv_social_v2_exp1b',
        companionId: 'panda_anat',
        direction: 'adventure',
        pageCount: 12,
        resilienceTheme: 'social hesitation',
        goldenDnaSourceId: 'panda_anat_adventure',
        setting: 'ארגז חול',
        gameOrPlayPattern: 'גשר חול',
        keyObject: 'עלה יבש',
        entryMethod: 'מחזיק הדלי',
        finalChildAction: 'שפיכת דלי לאט',
        forbidPlotCopy: [],
      } as ExperimentSpecV2);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v2-runs',
    `panda_anat_adv_social_v2_exp1b-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(path.join(runDir, 'story-spine.json'), spineRaw);
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), beatsRaw);
  fs.writeFileSync(
    path.join(runDir, 'source-exp1.json'),
    JSON.stringify({ sourceDir, spineHash: sha256(spineRaw), beatsHash: sha256(beatsRaw) }, null, 2)
  );
  if (fs.existsSync(specPath)) {
    fs.copyFileSync(specPath, path.join(runDir, 'experiment-spec.json'));
  }

  console.log(`[exp1b] source=${sourceDir}`);
  console.log(`[exp1b] spine hash=${sha256(spineRaw)} beats hash=${sha256(beatsRaw)}`);
  console.log('[exp1b] prose-only (locked structure)...');

  const { storyMarkdown, inputTokens, outputTokens } = await generateProseExp1b({
    spine,
    beats,
    spec,
    modelId: 'gpt-5-chat-latest',
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), storyMarkdown, 'utf8');

  const selfCheck = runProseExp1bSelfCheck(storyMarkdown);
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'self-check.md'),
    formatSelfCheckMarkdown(selfCheck, runDir),
    'utf8'
  );

  fs.writeFileSync(
    path.join(runDir, 'report.md'),
    [
      '# Generator-v2 Exp1b — prose-only rerun',
      '',
      `Source Exp1: \`${sourceDir}\``,
      `Spine/beats: **unchanged** (hashes in source-exp1.json)`,
      `Tokens: in=${inputTokens} out=${outputTokens}`,
      '',
      formatSelfCheckMarkdown(selfCheck, runDir),
      '',
      '## Human verdict (fill after read)',
      '',
      '- [ ] GOLDEN_LIKE',
      '- [ ] PROMISING_BUT_NEEDS_AUTHOR_PASS',
      '- [ ] STILL_DESCRIPTIVE',
      '- [ ] FAIL',
      '',
      '**Hard stop — no Dini until human read.**',
    ].join('\n'),
    'utf8'
  );

  console.log(`[exp1b] → ${runDir}/story.md`);
  console.log(`[exp1b] self-check: rhetorical-Q pages=${selfCheck.rhetoricalQuestionPageEndings} emotion-summary=${selfCheck.explicitEmotionSummaryCount} anat-beats=${selfCheck.anatPhysicalComicVulnerableBeats} formatV5=${selfCheck.formatV5}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
