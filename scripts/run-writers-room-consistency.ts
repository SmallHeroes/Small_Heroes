/**
 * Writer's Room consistency pass — revalidate B4/S2 + rewrite S5/B1 (no new generation).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-writers-room-consistency.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { runAuthorRewritePass } from '../lib/story-gen/author-rewrite-pass';
import {
  runPostRewritePipeline,
  runRevalidateOnlyPipeline,
} from '../lib/story-gen/post-rewrite-pipeline';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import {
  computePageWordCounts,
  parseWordCountLine,
} from '../lib/story-gen/story-page-utils';
import {
  DEFAULT_STORY_GEN_MODELS,
  type StoryOutline,
} from '../lib/story-gen/story-generation-types';

const PRIOR_REWRITE_ROOT = 'outputs/writers-room-canary/2026-06-07T20-19-03-245Z';

const REVALIDATE_TARGETS = [
  {
    scenarioId: 'bolly_b4_hacheder_bed',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T19-11-50-756Z',
    rewrittenFrom: `${PRIOR_REWRITE_ROOT}/bolly_b4_hacheder_bed/story.after-rewrite.md`,
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
    rewrittenFrom: `${PRIOR_REWRITE_ROOT}/tubi_s2_ha_bayit_bed/story.after-rewrite.md`,
  },
] as const;

const REWRITE_TARGETS = [
  {
    scenarioId: 'tubi_s5_ha_zikukim_adv',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T17-48-35-373Z',
    knownHumanNotes: [
      'Preserve Tubi engine: eyes on light, half-ear, booms beyond window — NOT whale noise→song.',
      'Strengthen adventure oral Hebrew and body comedy (ears open all doors by mistake, belly before ears).',
      'Child agency active: chooses where to stand, when to look, what sound to let in.',
      'Remove any label leaks or garbled Hebrew; child breathes from nose, Tubi from trunk.',
      'Keep fireworks scenario shape — desire vs overwhelm, not escape-only.',
    ],
  },
  {
    scenarioId: 'bolly_b1_lahitraf_adv',
    beforeRunFolder: 'outputs/story-gen-runs/2026-06-07T18-49-32-189Z',
    knownHumanNotes: [
      'Social-entry adventure — concrete play scene (hoop circle, colorful ball, turn/rule).',
      'Strengthen child agency: edge → one peek → ask ONE child "אפשר גם אני?" not whole group.',
      'More Bolly body comedy: round progress, trembling leg, stuck shell, brave from inside ball.',
      'Remove garbled Hebrew (נומבפנים, לעף אחד) if present; keep peek/shell engine.',
      'No medical ordeal, no generic bravery lecture — small exposure on child terms.',
    ],
  },
] as const;

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function wordCountsFromMd(md: string): number[] {
  return parseWordCountLine(md) ?? computePageWordCounts(md);
}

function gateLine(label: string, before: unknown, after: unknown): string {
  return `- ${label}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`;
}

async function writeArtifacts(
  outDir: string,
  storyBefore: string,
  post: Awaited<ReturnType<typeof runPostRewritePipeline>>,
  rewriteReport?: Awaited<ReturnType<typeof runAuthorRewritePass>>['report']
): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'story.before-rewrite.md'), storyBefore, 'utf8');
  fs.writeFileSync(path.join(outDir, 'story.after-rewrite.md'), post.storyMarkdown, 'utf8');
  fs.writeFileSync(path.join(outDir, 'story.md'), post.storyMarkdown, 'utf8');
  if (rewriteReport) {
    fs.writeFileSync(
      path.join(outDir, 'author-rewrite-report.json'),
      JSON.stringify(rewriteReport, null, 2),
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(outDir, 'powercard-sanitizer-report.json'),
    JSON.stringify(post.powerCardSanitizer, null, 2),
    'utf8'
  );
  if ('proofread' in post) {
    fs.writeFileSync(
      path.join(outDir, 'proofread-report.json'),
      JSON.stringify(post.proofread, null, 2),
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(outDir, 'hebrew-sanity-report.json'),
    JSON.stringify(post.hebrewSanity, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'validator-report.json'),
    JSON.stringify(post.advisory.validators, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'craft-v2.1.json'),
    JSON.stringify(post.advisory.craftV21, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'swap-test.json'),
    JSON.stringify(post.advisory.swapTest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'freshness-test.json'),
    JSON.stringify(post.advisory.freshnessTest, null, 2),
    'utf8'
  );
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rootOut = path.join(process.cwd(), 'outputs', 'writers-room-canary', timestamp);
  fs.mkdirSync(rootOut, { recursive: true });

  console.log(`[writers-room] consistency → ${rootOut}`);
  const summary: string[] = [
    "# Writer's Room — 4-story consistency (sanitizer + rewrite)",
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  for (const target of REVALIDATE_TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const outline = readJson<StoryOutline>(
      path.join(process.cwd(), target.beforeRunFolder, 'outline.json')
    );
    if (!outline) throw new Error(`Missing outline for ${target.scenarioId}`);

    const rewrittenPath = path.join(process.cwd(), target.rewrittenFrom);
    const storyIn = fs.readFileSync(rewrittenPath, 'utf8');
    const beforeOriginal = fs.readFileSync(
      path.join(process.cwd(), target.beforeRunFolder, 'story.md'),
      'utf8'
    );
    const beforeGates = {
      craft: readJson<{ overall: number }>(
        path.join(process.cwd(), PRIOR_REWRITE_ROOT, target.scenarioId, 'craft-v2.1.json')
      ),
      validator: readJson<{ advisoryResult: string }>(
        path.join(process.cwd(), PRIOR_REWRITE_ROOT, target.scenarioId, 'validator-report.json')
      ),
      hebrew: readJson<{ hitCount: number }>(
        path.join(
          process.cwd(),
          PRIOR_REWRITE_ROOT,
          target.scenarioId,
          'hebrew-sanity-report.json'
        )
      ),
    };

    console.log(`[writers-room] revalidate ${target.scenarioId} (sanitizer only)...`);
    const post = await runRevalidateOnlyPipeline({
      storyMarkdown: storyIn,
      scenario,
      outline,
      runLabel: 'writers-room-revalidate',
    });

    const outDir = path.join(rootOut, target.scenarioId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'story.before-rewrite.md'), beforeOriginal, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.after-rewrite.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'powercard-sanitizer-report.json'),
      JSON.stringify(post.powerCardSanitizer, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'hebrew-sanity-report.json'),
      JSON.stringify(post.hebrewSanity, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'validator-report.json'),
      JSON.stringify(post.advisory.validators, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'craft-v2.1.json'),
      JSON.stringify(post.advisory.craftV21, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'swap-test.json'),
      JSON.stringify(post.advisory.swapTest, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'freshness-test.json'),
      JSON.stringify(post.advisory.freshnessTest, null, 2),
      'utf8'
    );

    summary.push(
      `## ${target.scenarioId} (revalidate + sanitizer)`,
      '',
      `- Before original: \`${target.beforeRunFolder}\``,
      `- Prior rewrite: \`${target.rewrittenFrom}\``,
      `- Output: \`${path.relative(process.cwd(), outDir).replace(/\\/g, '/')}\``,
      '',
      '### Sanitizer fixes',
      ...post.powerCardSanitizer.fixes.map(
        (f) => `- \`${f.before}\` → \`${f.after}\` (${f.reason})`
      ),
      ...(post.powerCardSanitizer.fixes.length === 0 ? ['- (none)'] : []),
      '',
      '### Gates',
      gateLine('validator', beforeGates.validator?.advisoryResult, post.advisory.validators.advisoryResult),
      gateLine('hebrew hits', beforeGates.hebrew?.hitCount, post.hebrewSanity.hitCount),
      gateLine('craft', beforeGates.craft?.overall, post.advisory.craftV21.overall),
      gateLine('swap', null, `${post.advisory.swapTest.verdict} (${post.advisory.swapTest.bindingScore})`),
      gateLine(
        'freshness',
        null,
        `${post.advisory.freshnessTest.recommendation} (shapeMax ${post.advisory.freshnessTest.shapeOverlapMax})`
      ),
      ''
    );
    console.log(`[writers-room] ${target.scenarioId} revalidated — validator ${post.advisory.validators.advisoryResult}`);
  }

  for (const target of REWRITE_TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const beforeDir = path.join(process.cwd(), target.beforeRunFolder);
    const beforeStory = fs.readFileSync(path.join(beforeDir, 'story.md'), 'utf8');
    const outline = readJson<StoryOutline>(path.join(beforeDir, 'outline.json'));
    if (!outline) throw new Error(`Missing outline for ${target.scenarioId}`);

    const beforeGates = {
      craft: readJson<{ overall: number }>(path.join(beforeDir, 'craft-v2.1.json')),
      validator: readJson<{ advisoryResult: string }>(path.join(beforeDir, 'validator-report.json')),
      hebrew: readJson<{ hitCount: number }>(path.join(beforeDir, 'hebrew-sanity-report.json')),
    };

    console.log(`[writers-room] author rewrite ${target.scenarioId}...`);
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

    const post = await runPostRewritePipeline({
      storyMarkdown: rewrittenRaw,
      scenario,
      outline,
      runLabel: 'writers-room-consistency',
    });

    const outDir = path.join(rootOut, target.scenarioId);
    await writeArtifacts(outDir, beforeStory, post, rewriteReport);

    summary.push(
      `## ${target.scenarioId} (author rewrite + sanitizer)`,
      '',
      `- Before: \`${target.beforeRunFolder}\``,
      `- Output: \`${path.relative(process.cwd(), outDir).replace(/\\/g, '/')}\``,
      '',
      '### Word counts',
      `- Before: \`[${wordCountsFromMd(beforeStory).join(', ')}]\``,
      `- After: \`[${wordCountsFromMd(post.storyMarkdown).join(', ')}]\``,
      '',
      '### Sanitizer fixes',
      ...post.powerCardSanitizer.fixes.map(
        (f) => `- \`${f.before}\` → \`${f.after}\` (${f.reason})`
      ),
      ...(post.powerCardSanitizer.fixes.length === 0 ? ['- (none)'] : []),
      '',
      '### Changed pages',
      ...rewriteReport.changedPages.map(
        (p) => `- p${p.page}: ${p.beforeWordCount}→${p.afterWordCount}w — ${p.changeSummary}`
      ),
      '',
      '### Gates',
      gateLine('validator', beforeGates.validator?.advisoryResult, post.advisory.validators.advisoryResult),
      gateLine('hebrew hits', beforeGates.hebrew?.hitCount, post.hebrewSanity.hitCount),
      gateLine('craft', beforeGates.craft?.overall, post.advisory.craftV21.overall),
      gateLine('swap', null, `${post.advisory.swapTest.verdict} (${post.advisory.swapTest.bindingScore})`),
      gateLine(
        'freshness',
        null,
        `${post.advisory.freshnessTest.recommendation} (shapeMax ${post.advisory.freshnessTest.shapeOverlapMax})`
      ),
      ''
    );
    console.log(`[writers-room] ${target.scenarioId} done — craft ${post.advisory.craftV21.overall}`);
  }

  fs.writeFileSync(path.join(rootOut, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[writers-room] Wrote ${rootOut}/summary.md`);
  console.log('[writers-room] Hard stop — 4-story consistency complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
