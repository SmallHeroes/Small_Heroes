/**
 * Writer's Room canary — Author Rewrite Pass on Bolly B4 + Tubi S2 only.
 * No new generation, no bank writes, no images.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-writers-room-canary.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { runAuthorRewritePass } from '../lib/story-gen/author-rewrite-pass';
import { repairGenderChipsInStory } from '../lib/story-gen/gender-chip-repair';
import { scanHebrewSanity } from '../lib/story-gen/hebrew-sanity';
import { runProofreadPass } from '../lib/story-gen/proofread-pass';
import { buildRun1AdvisoryBundle } from '../lib/story-gen/run1-advisory';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import { normalizePhaseBStoryMarkdown } from '../lib/story-gen/story-markdown-normalize';
import {
  computePageWordCounts,
  parseWordCountLine,
} from '../lib/story-gen/story-page-utils';
import {
  DEFAULT_STORY_GEN_MODELS,
  type StoryOutline,
} from '../lib/story-gen/story-generation-types';

const CANARY_TARGETS = [
  {
    scenarioId: 'bolly_b4_hacheder_bed',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T19-11-50-756Z',
    knownHumanNotes: [
      'Child agency too internal — strengthen with one concrete bedtime choice (hand outside blanket, door-light stripe, whisper to parent, one more small minute).',
      'Add Bolly physical-comedy beat: brave announcement from inside shell, eye opens after claiming asleep, rolls into blanket fold, nose wrong direction.',
      'Remove adult-poetic lines: "הלילה נוגע בקירות", "שקט שמקשיב", "לא צריך קהל לזה", "נשארים במרחב שלהם".',
      'Ending must be concrete: blanket, door-light stripe, Bolly half-open, one small brave choice remains.',
      'Keep bedtime softness — no big adventure, no moral.',
    ],
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
    knownHumanNotes: [
      'Remove English leak: too-SHUT.',
      'Fix broken Hebrew: אָסוּג → child-friendly "אֶסְגֹּר אֶת כָּל הָעוֹלָם"; קוֹל כָשֵׁר → "קוֹל אֶחָד נִבְחָר!" or similar.',
      'Anatomy: child breathes through nose/mouth; Tubi uses trunk — never child from חדק.',
      'Ground page 7: replace adult-poetic "שקט מלא בקצף חי" with concrete sound layers (clock, hallway step, fridge hum farther away).',
      'Preserve Tubi engine: half-ear, one sound, ears as curtains, big body startled by small sounds — NOT whale noise→song.',
    ],
  },
] as const;

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function gateSnapshot(runFolder: string) {
  const base = path.join(process.cwd(), runFolder);
  return {
    validator: readJson<{ advisoryResult: string; warnings: string[] }>(
      path.join(base, 'validator-report.json')
    ),
    craft: readJson<{ overall: number; ladderPlacement: string; verdict: string }>(
      path.join(base, 'craft-v2.1.json')
    ),
    swap: readJson<{ verdict: string; bindingScore: number }>(path.join(base, 'swap-test.json')),
    freshness: readJson<{ recommendation: string; shapeOverlapMax: number }>(
      path.join(base, 'freshness-test.json')
    ),
    hebrew: readJson<{ hitCount: number; advisoryFail: boolean }>(
      path.join(base, 'hebrew-sanity-report.json')
    ),
    wordCounts: (() => {
      const md = fs.readFileSync(path.join(base, 'story.md'), 'utf8');
      return parseWordCountLine(md) ?? computePageWordCounts(md);
    })(),
  };
}

async function postRewritePipeline(args: {
  storyMarkdown: string;
  scenario: ReturnType<typeof resolveScenarioById>;
  outline: StoryOutline;
}) {
  let md = normalizePhaseBStoryMarkdown({
    rawMarkdown: args.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
  });

  const chipResult = repairGenderChipsInStory(md);
  md = chipResult.markdown;

  const proofreadResult = await runProofreadPass({
    storyMarkdown: md,
    modelId: DEFAULT_STORY_GEN_MODELS.draftModel,
  });
  md = proofreadResult.markdown;

  const hebrewSanity = scanHebrewSanity(md);

  const advisory = await buildRun1AdvisoryBundle({
    scenario: args.scenario,
    storyMarkdown: md,
    runLabel: 'writers-room-canary',
    judgeModel: DEFAULT_STORY_GEN_MODELS.judgeModel,
    chipRepairReport: chipResult.report,
    proofreadReport: proofreadResult.report,
    hebrewSanity,
  });

  return {
    storyMarkdown: md,
    chipRepair: chipResult.report,
    proofread: proofreadResult.report,
    hebrewSanity,
    advisory,
  };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rootOut = path.join(process.cwd(), 'outputs', 'writers-room-canary', timestamp);
  fs.mkdirSync(rootOut, { recursive: true });

  console.log(`[writers-room] canary → ${rootOut}`);

  const summaries: string[] = [
    '# Writer\'s Room Canary — Author Rewrite Pass',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Model: ${DEFAULT_STORY_GEN_MODELS.draftModel}`,
    '',
  ];

  for (const target of CANARY_TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const beforeDir = path.join(process.cwd(), target.beforeRunFolder);
    const beforeStory = fs.readFileSync(path.join(beforeDir, 'story.md'), 'utf8');
    const outline = readJson<StoryOutline>(path.join(beforeDir, 'outline.json'));
    if (!outline) {
      throw new Error(`Missing outline.json in ${target.beforeRunFolder}`);
    }

    const afterDir = path.join(rootOut, target.scenarioId);
    fs.mkdirSync(afterDir, { recursive: true });

    console.log(`[writers-room] rewriting ${target.scenarioId}...`);
    fs.writeFileSync(path.join(afterDir, 'story.before-rewrite.md'), beforeStory, 'utf8');

    const beforeGates = gateSnapshot(target.beforeRunFolder);

    const { markdown: rewrittenRaw, report: rewriteReport } = await runAuthorRewritePass({
      storyMarkdown: beforeStory,
      companionId: scenario.companionId,
      direction: scenario.direction,
      scenarioId: target.scenarioId,
      scenario,
      outline,
      knownHumanNotes: [...target.knownHumanNotes],
      modelId: DEFAULT_STORY_GEN_MODELS.draftModel,
    });

    fs.writeFileSync(
      path.join(afterDir, 'author-rewrite-report.json'),
      JSON.stringify(rewriteReport, null, 2),
      'utf8'
    );

    const post = await postRewritePipeline({
      storyMarkdown: rewrittenRaw,
      scenario,
      outline,
    });

    fs.writeFileSync(path.join(afterDir, 'story.after-rewrite.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(afterDir, 'story.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(afterDir, 'proofread-report.json'),
      JSON.stringify(post.proofread, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(afterDir, 'hebrew-sanity-report.json'),
      JSON.stringify(post.hebrewSanity, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(afterDir, 'validator-report.json'),
      JSON.stringify(post.advisory.validators, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(afterDir, 'craft-v2.1.json'),
      JSON.stringify(post.advisory.craftV21, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(afterDir, 'swap-test.json'),
      JSON.stringify(post.advisory.swapTest, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(afterDir, 'freshness-test.json'),
      JSON.stringify(post.advisory.freshnessTest, null, 2),
      'utf8'
    );

    const afterWordCounts =
      parseWordCountLine(post.storyMarkdown) ?? computePageWordCounts(post.storyMarkdown);

    summaries.push(
      `## ${target.scenarioId}`,
      '',
      `- **Before run:** \`${target.beforeRunFolder}\``,
      `- **After output:** \`${path.relative(process.cwd(), afterDir).replace(/\\/g, '/')}\``,
      '',
      '### Word counts',
      `- Before: \`[${beforeGates.wordCounts.join(', ')}]\``,
      `- After: \`[${afterWordCounts.join(', ')}]\``,
      '',
      '### Gates (before → after)',
      `- Validator: ${beforeGates.validator?.advisoryResult ?? '?'} → ${post.advisory.validators.advisoryResult}`,
      `- Hebrew sanity hits: ${beforeGates.hebrew?.hitCount ?? '?'} → ${post.hebrewSanity.hitCount}`,
      `- Craft overall: ${beforeGates.craft?.overall ?? '?'} → ${post.advisory.craftV21.overall}`,
      `- Swap: ${beforeGates.swap?.verdict ?? '?'} (${beforeGates.swap?.bindingScore ?? '?'}) → ${post.advisory.swapTest.verdict} (${post.advisory.swapTest.bindingScore})`,
      `- Freshness: ${beforeGates.freshness?.recommendation ?? '?'} (shapeMax ${beforeGates.freshness?.shapeOverlapMax ?? '?'}) → ${post.advisory.freshnessTest.recommendation} (shapeMax ${post.advisory.freshnessTest.shapeOverlapMax})`,
      '',
      '### Changed pages',
      ...rewriteReport.changedPages.map(
        (p) =>
          `- p${p.page}: ${p.beforeWordCount}→${p.afterWordCount}w — ${p.changeSummary}`
      ),
      '',
      '### Preservation',
      `- pageCount: ${rewriteReport.preserved.pageCount}`,
      `- frontmatter: ${rewriteReport.preserved.frontmatter}`,
      `- chips: ${rewriteReport.preserved.chips}`,
      `- imageDirections: ${rewriteReport.preserved.imageDirections}`,
      `- risks: ${rewriteReport.risks.length ? rewriteReport.risks.join(', ') : 'none'}`,
      ''
    );

    console.log(`[writers-room] ${target.scenarioId} done — craft ${post.advisory.craftV21.overall}`);
  }

  fs.writeFileSync(path.join(rootOut, 'summary.md'), summaries.join('\n'), 'utf8');
  console.log(`[writers-room] Wrote ${rootOut}/summary.md`);
  console.log('[writers-room] Hard stop — canary complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
