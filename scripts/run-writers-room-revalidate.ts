/**
 * Revalidate existing Writer's Room artifacts (no new generation).
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-writers-room-revalidate.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { runRevalidateOnlyPipeline } from '../lib/story-gen/post-rewrite-pipeline';
import { resolveScenarioById } from '../lib/story-gen/scenario-resolver';
import {
  computePageWordCounts,
  parseWordCountLine,
} from '../lib/story-gen/story-page-utils';
import type { StoryOutline } from '../lib/story-gen/story-generation-types';

const PRIOR_RUN = 'outputs/writers-room-canary/2026-06-07T20-37-53-381Z';

const TARGETS = [
  {
    scenarioId: 'tubi_s5_ha_zikukim_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T17-48-35-373Z',
    storyFrom: `${PRIOR_RUN}/tubi_s5_ha_zikukim_adv/story.after-rewrite.md`,
    priorValidator: 'fail',
  },
  {
    scenarioId: 'bolly_b1_lahitraf_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-49-32-189Z',
    storyFrom: `${PRIOR_RUN}/bolly_b1_lahitraf_adv/story.after-rewrite.md`,
    priorValidator: 'pass',
  },
  {
    scenarioId: 'bolly_b4_hacheder_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T19-11-50-756Z',
    storyFrom: `${PRIOR_RUN}/bolly_b4_hacheder_bed/story.after-rewrite.md`,
    priorValidator: 'pass',
    skipEnrich: true,
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
    storyFrom: `${PRIOR_RUN}/tubi_s2_ha_bayit_bed/story.after-rewrite.md`,
    priorValidator: 'pass',
    skipEnrich: true,
  },
] as const;

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function wordCountsFromMd(md: string): number[] {
  return parseWordCountLine(md) ?? computePageWordCounts(md);
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rootOut = path.join(process.cwd(), 'outputs', 'writers-room-canary', timestamp);
  fs.mkdirSync(rootOut, { recursive: true });

  console.log(`[writers-room] revalidate → ${rootOut}`);
  const summary: string[] = [
    '# Writer\'s Room — patch revalidate (density + sanitizer v2 + chip normalize)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source run: \`${PRIOR_RUN}\``,
    '',
  ];

  const results: Array<{ id: string; pass: boolean }> = [];

  for (const target of TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const outline = readJson<StoryOutline>(
      path.join(process.cwd(), target.outlineRunFolder, 'outline.json')
    );
    if (!outline) throw new Error(`Missing outline for ${target.scenarioId}`);

    const storyIn = fs.readFileSync(path.join(process.cwd(), target.storyFrom), 'utf8');
    const beforeCounts = wordCountsFromMd(storyIn);

    console.log(`[writers-room] revalidate ${target.scenarioId}...`);
    const post = await runRevalidateOnlyPipeline({
      storyMarkdown: storyIn,
      scenario,
      outline,
      runLabel: 'writers-room-patch-revalidate',
      skipAdventureEnrich: 'skipEnrich' in target ? target.skipEnrich : false,
    });

    const afterCounts = wordCountsFromMd(post.storyMarkdown);
    const validatorPass = post.advisory.validators.advisoryResult === 'pass';

    const outDir = path.join(rootOut, target.scenarioId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'story.before-patch.md'), storyIn, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.after-patch.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'chip-normalize-report.json'),
      JSON.stringify(post.chipNormalize, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'powercard-sanitizer-report.json'),
      JSON.stringify(post.powerCardSanitizer, null, 2),
      'utf8'
    );
    if (post.thinPageEnrich) {
      fs.writeFileSync(
        path.join(outDir, 'thin-page-enrich-report.json'),
        JSON.stringify(post.thinPageEnrich, null, 2),
        'utf8'
      );
    }
    fs.writeFileSync(
      path.join(outDir, 'adventure-density-check.json'),
      JSON.stringify(post.adventureDensity, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'validator-report.json'),
      JSON.stringify(post.advisory.validators, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'hebrew-sanity-report.json'),
      JSON.stringify(post.hebrewSanity, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'craft-v2.1.json'),
      JSON.stringify(post.advisory.craftV21, null, 2),
      'utf8'
    );

    results.push({ id: target.scenarioId, pass: validatorPass });

    summary.push(
      `## ${target.scenarioId}`,
      '',
      `- Source: \`${target.storyFrom}\``,
      `- Prior validator: **${target.priorValidator}**`,
      `- Final: **${validatorPass ? 'PASS' : 'FAIL'}**`,
      '',
      '### Word counts',
      `- Before: \`[${beforeCounts.join(', ')}]\``,
      `- After: \`[${afterCounts.join(', ')}]\``,
      ...(post.thinPageEnrich
        ? [
            '',
            '### Adventure enrich',
            `- Pages enriched: [${post.thinPageEnrich.pagesEnriched.join(', ')}]`,
            `- Density before: ${post.adventureDensity.belowMinCount}/${post.adventureDensity.totalPages} below ${post.adventureDensity.floorWords}`,
          ]
        : [
            '',
            '### Adventure density',
            `- needsEnrich: ${post.adventureDensity.needsEnrich}`,
            `- below min: ${post.adventureDensity.belowMinCount}/${post.adventureDensity.totalPages}`,
          ]),
      '',
      '### Sanitizer fixes',
      ...(post.powerCardSanitizer.fixes.length
        ? post.powerCardSanitizer.fixes.map((f) => `- \`${f.before}\` → \`${f.after}\` (${f.reason})`)
        : ['- (none)']),
      '',
      '### Chip normalization',
      ...(post.chipNormalize.fixes.length
        ? post.chipNormalize.fixes.map((f) => `- p${f.page}: \`${f.before}\` → \`${f.after}\` (${f.reason})`)
        : ['- (none)']),
      ...(post.chipNormalize.unrepaired.length
        ? ['', '**Unrepaired chips:**', ...post.chipNormalize.unrepaired.map((u) => `- p${u.page}: \`${u.token}\``)]
        : []),
      '',
      '### Validator',
      ...(post.advisory.validators.failures.length
        ? post.advisory.validators.failures.map((f) => `- FAIL: ${f}`)
        : ['- PASS']),
      ''
    );

    console.log(
      `[writers-room] ${target.scenarioId} — validator ${post.advisory.validators.advisoryResult}`
    );
  }

  summary.push('## Final verdicts', '');
  for (const r of results) {
    summary.push(`- **${r.id}**: ${r.pass ? 'PASS' : 'FAIL'}`);
  }

  fs.writeFileSync(path.join(rootOut, 'summary.md'), summary.join('\n'), 'utf8');
  console.log(`[writers-room] Wrote ${rootOut}/summary.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
