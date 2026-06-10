/**
 * Generator-v2 Exp1c — prose-only (Exp1b + Companion Comic Bits Bank).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-story-gen-v2-exp1c.ts
 *
 * Optional: --source <exp1-run-dir>
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { PANDA_ANAT_COMIC_BITS } from '../lib/story-gen-v2/companion-comic-bits';
import { generateProseExp1c } from '../lib/story-gen-v2/prose-gen-exp1c';
import {
  formatExp1cSelfCheckMarkdown,
  runProseExp1cSelfCheck,
} from '../lib/story-gen-v2/prose-exp1c-self-check';
import { applyProseV2ArtifactFixes } from '../lib/story-gen-v2/prose-v2-artifact-fix';
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
        id: 'panda_anat_adv_social_v2_exp1c',
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

  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'story-gen-v2-runs',
    `panda_anat_adv_social_v2_exp1c-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(path.join(runDir, 'story-spine.json'), spineRaw);
  fs.writeFileSync(path.join(runDir, 'page-beats.json'), beatsRaw);
  fs.writeFileSync(
    path.join(runDir, 'source-exp1.json'),
    JSON.stringify(
      {
        sourceDir,
        spineHash: sha256(spineRaw),
        beatsHash: sha256(beatsRaw),
        exp1bDir: 'panda_anat_adv_social_v2_exp1b-2026-06-09T06-50-07-681Z',
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(runDir, 'companion-comic-bits.json'),
    JSON.stringify(PANDA_ANAT_COMIC_BITS, null, 2)
  );
  if (fs.existsSync(specPath)) {
    fs.copyFileSync(specPath, path.join(runDir, 'experiment-spec.json'));
  }

  console.log(`[exp1c] source=${sourceDir}`);
  console.log(`[exp1c] comic bits=${PANDA_ANAT_COMIC_BITS.length}`);
  console.log('[exp1c] prose-only (locked structure + comic bits bank)...');

  const { storyMarkdown: rawMd, inputTokens, outputTokens } = await generateProseExp1c({
    spine,
    beats,
    spec,
    modelId: 'gpt-5-chat-latest',
    generatedAt,
  });

  const { markdown: storyMarkdown, fixes } = applyProseV2ArtifactFixes({
    storyMarkdown: rawMd,
    pageCount: spec.pageCount,
    storyId: spec.id.replace(/_exp1c$/, '_exp1c'),
    generatedAt,
    promptVersion: 'v2-event-driven-exp1c',
  });

  fs.writeFileSync(path.join(runDir, 'story.md'), storyMarkdown, 'utf8');
  if (fixes.length) {
    fs.writeFileSync(path.join(runDir, 'artifact-fixes.json'), JSON.stringify(fixes, null, 2));
  }

  const selfCheck = runProseExp1cSelfCheck(storyMarkdown, spec.pageCount);
  fs.writeFileSync(path.join(runDir, 'self-check.json'), JSON.stringify(selfCheck, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'self-check.md'),
    formatExp1cSelfCheckMarkdown(selfCheck, runDir),
    'utf8'
  );

  fs.writeFileSync(
    path.join(runDir, 'report.md'),
    [
      '# Generator-v2 Exp1c — prose-only + Companion Comic Bits',
      '',
      `Source Exp1: \`${sourceDir}\``,
      `Spine/beats: **unchanged**`,
      `Comic bits bank: **${PANDA_ANAT_COMIC_BITS.length}** Panda Anat bits`,
      `Artifact fixes: ${fixes.length ? fixes.join('; ') : 'none'}`,
      `Tokens: in=${inputTokens} out=${outputTokens}`,
      '',
      formatExp1cSelfCheckMarkdown(selfCheck, runDir),
      '',
      '## Human verdict (fill after read)',
      '',
      '- [ ] COMPANION_BITS_WORK — fresher Anat humor, still natural',
      '- [ ] PROMISING_PLUS (same as Exp1b)',
      '- [ ] FORCED / OVER-JOKEY',
      '- [ ] STILL_GOLDEN_COPY',
      '- [ ] FAIL',
      '',
      '**If COMPANION_BITS_WORK → build Dini bits bank + Dini fantasy Exp2.**',
      '**If not → do not keep iterating Panda; consider stronger author model or more human content.**',
    ].join('\n'),
    'utf8'
  );

  console.log(`[exp1c] → ${runDir}/story.md`);
  console.log(
    `[exp1c] self-check: comic-hits=${selfCheck.comicBitHits.length} forbidden=${selfCheck.forbiddenNearGoldenHits.length} broken-chips=${selfCheck.brokenChipPatterns.length} formatV5=${selfCheck.formatV5}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
