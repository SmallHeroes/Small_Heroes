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
import type { ChipSafetyHit } from '../lib/story-gen/chip-safety';
import { applyWritersRoomArtifactPatches, applyPostEnrichDeterministicRepairs, patchWritersRoomOutline } from '../lib/story-gen/writers-room-artifact-patches';

const PRIOR_RUN = 'outputs/writers-room-canary/2026-06-07T20-37-53-381Z';
const CORRUPT_RUN = 'outputs/writers-room-canary/2026-06-07T20-59-19-269Z';

const TARGETS = [
  {
    scenarioId: 'tubi_s5_ha_zikukim_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T17-48-35-373Z',
    storyFrom: `${PRIOR_RUN}/tubi_s5_ha_zikukim_adv/story.after-rewrite.md`,
    priorValidator: 'fail',
    runEnrich: true,
  },
  {
    scenarioId: 'bolly_b1_lahitraf_adv',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-49-32-189Z',
    storyFrom: `${PRIOR_RUN}/bolly_b1_lahitraf_adv/story.after-rewrite.md`,
    priorValidator: 'pass',
    runEnrich: false,
  },
  {
    scenarioId: 'bolly_b4_hacheder_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T19-11-50-756Z',
    storyFrom: `${PRIOR_RUN}/bolly_b4_hacheder_bed/story.after-rewrite.md`,
    priorValidator: 'pass',
    runEnrich: false,
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    outlineRunFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
    storyFrom: `${PRIOR_RUN}/tubi_s2_ha_bayit_bed/story.after-rewrite.md`,
    priorValidator: 'fail',
    runEnrich: false,
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
    "# Writer's Room — bare child-gender + literary read closeout",
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source run: \`${PRIOR_RUN}\``,
    '',
  ];

  const results: Array<{ id: string; pass: boolean }> = [];

  for (const target of TARGETS) {
    const scenario = resolveScenarioById(target.scenarioId);
    const outlineRaw = readJson<StoryOutline>(
      path.join(process.cwd(), target.outlineRunFolder, 'outline.json')
    );
    if (!outlineRaw) throw new Error(`Missing outline for ${target.scenarioId}`);
    const outline = patchWritersRoomOutline(target.scenarioId, outlineRaw);

    const storyRaw = fs.readFileSync(path.join(process.cwd(), target.storyFrom), 'utf8');
    const patched = applyWritersRoomArtifactPatches(target.scenarioId, storyRaw, 'pre');
    const beforeCounts = wordCountsFromMd(storyRaw);

    console.log(`[writers-room] revalidate ${target.scenarioId}...`);
    let post = await runRevalidateOnlyPipeline({
      storyMarkdown: patched.markdown,
      scenario,
      outline,
      runLabel: 'writers-room-patch-revalidate',
      skipAdventureEnrich: !target.runEnrich,
    });

    let postPatchReport = patched.report;
    if (target.runEnrich) {
      const postEnrich = applyWritersRoomArtifactPatches(target.scenarioId, post.storyMarkdown, 'post');
      const repaired = applyPostEnrichDeterministicRepairs(postEnrich.markdown);
      post = await runRevalidateOnlyPipeline({
        storyMarkdown: repaired.markdown,
        scenario,
        outline,
        runLabel: 'writers-room-post-enrich-finalize',
        skipAdventureEnrich: true,
      });
      postPatchReport = {
        scenarioId: target.scenarioId,
        patches: [
          ...patched.report.patches,
          ...postEnrich.report.patches,
          ...repaired.repairs,
        ],
        patchCount:
          patched.report.patchCount + postEnrich.report.patchCount + repaired.repairs.length,
      };
    }

    const afterCounts = wordCountsFromMd(post.storyMarkdown);
    const validatorPass = post.advisory.validators.advisoryResult === 'pass';

    const outDir = path.join(rootOut, target.scenarioId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'story.before-patch.md'), storyRaw, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.after-artifact-patch.md'), patched.markdown, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.after-patch.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(path.join(outDir, 'story.md'), post.storyMarkdown, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'artifact-patch-report.json'),
      JSON.stringify(postPatchReport, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, 'chip-safety-report.json'),
      JSON.stringify(post.chipSafety, null, 2),
      'utf8'
    );
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
      path.join(outDir, 'bare-child-gender-report.json'),
      JSON.stringify(post.bareChildGender, null, 2),
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
      '### Artifact patches',
      ...(postPatchReport.patches.length
        ? postPatchReport.patches.map((p) => `- \`${p.before.slice(0, 60)}…\` → \`${p.after.slice(0, 60)}…\` (${p.reason})`)
        : ['- (none)']),
      '',
      '### Word counts',
      `- Before: \`[${beforeCounts.join(', ')}]\``,
      `- After: \`[${afterCounts.join(', ')}]\``,
      ...(post.thinPageEnrich
        ? [
            '',
            '### Adventure enrich',
            `- Pages enriched: [${post.thinPageEnrich.pagesEnriched.join(', ')}]`,
            `- Density before enrich: ${post.thinPageEnrich.beforeCounts.filter((c) => c < 35).length}/12 below 35`,
          ]
        : [
            '',
            '### Adventure density',
            `- needsEnrich: ${post.adventureDensity.needsEnrich}`,
            `- below min: ${post.adventureDensity.belowMinCount}/${post.adventureDensity.totalPages}`,
          ]),
      '',
      '### Chip normalization',
      ...(post.chipNormalize.fixes.length
        ? post.chipNormalize.fixes.map((f) => `- p${f.page}: \`${f.before}\` → \`${f.after}\` (${f.reason})`)
        : ['- (none)']),
      ...(post.chipNormalize.unrepaired.length
        ? ['', '**Unrepaired chips:**', ...post.chipNormalize.unrepaired.map((u) => `- p${u.page}: \`${u.token}\``)]
        : []),
      '',
      '### Chip safety hits',
      ...(post.chipSafety.hits.length
        ? post.chipSafety.hits.map(
            (h: ChipSafetyHit) => `- p${h.page} ${h.field}: \`${h.token}\` (${h.reason})`
          )
        : ['- (none)']),
      '',
      '### Bare child-gender',
      ...(post.bareChildGender.failHits.length
        ? post.bareChildGender.failHits.map(
            (h) => `- FAIL p${h.page}: \`${h.token}\` (${h.reason})`
          )
        : ['- fail hits: (none)']),
      ...(post.bareChildGender.warningHits.length
        ? post.bareChildGender.warningHits.map(
            (h) => `- WARN p${h.page}: \`${h.token}\` (${h.reason})`
          )
        : ['- warnings: (none)']),
      '',
      '### Validator failures',
      ...(post.advisory.validators.failures.length
        ? post.advisory.validators.failures.map((f) => `- FAIL: ${f}`)
        : ['- PASS']),
      ''
    );

    console.log(
      `[writers-room] ${target.scenarioId} — validator ${post.advisory.validators.advisoryResult}`
    );
  }

  summary.push('## Unsafe fallback guard', '');
  const chipNormalizeSrc = fs.readFileSync(
    path.join(process.cwd(), 'lib/story-gen/chip-normalize.ts'),
    'utf8'
  );
  const fallbackDisabled = !/fullChipForStem/.test(chipNormalizeSrc);
  summary.push(
    `- Generic \`fullChipForStem\` fallback: **${fallbackDisabled ? 'DISABLED (expected)' : 'PRESENT (bug)'}**`
  );
  summary.push('');

  summary.push('## Corrupt-run spot check (must FAIL)', '');
  for (const scenarioId of ['tubi_s5_ha_zikukim_adv', 'tubi_s2_ha_bayit_bed', 'bolly_b4_hacheder_bed']) {
    const corruptPath = path.join(
      process.cwd(),
      CORRUPT_RUN,
      scenarioId,
      'story.after-patch.md'
    );
    if (!fs.existsSync(corruptPath)) continue;
    const corruptMd = fs.readFileSync(corruptPath, 'utf8');
    const { scanChipSafety } = await import('../lib/story-gen/chip-safety');
    const safety = scanChipSafety(corruptMd);
    summary.push(
      `- **${scenarioId}** corrupt artifact: ${safety.advisoryFail ? 'FAIL (expected)' : 'PASS (unexpected)'} — ${safety.hitCount} hit(s)`
    );
  }
  summary.push('');

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
