/**
 * Brief F — Bar lion bedtime Stage 0 anchor resemblance experiment (variants A + B).
 *
 *   npx tsx --env-file=.env.local --require ./scripts/shims/register-server-only.cjs \
 *     scripts/run-lion-bedtime-bar-anchor-experiment.ts --photo path/to/bar.jpg
 *
 * Uses corrected olive/tan identity (NOT "warm pale"). Saves to outputs/anchor-experiments/lion_bedtime_bar/.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

const OUT_DIR = path.join(process.cwd(), 'outputs', 'anchor-experiments', 'lion_bedtime_bar');

function flag(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function resolvePhotoUrl(): string {
  const explicit = flag('--photo')?.trim();
  if (!explicit) {
    throw new Error(
      '--photo <path> is required — pass Bar\'s clear photo explicitly (no cached/latest-order fallback).'
    );
  }
  const resolved = path.resolve(explicit);
  if (!fs.existsSync(resolved)) {
    throw new Error(`--photo path not found: ${resolved}`);
  }
  return resolved;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }

  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.STYLE_01_AUDITION_MODE = 'true';

  const childPhotoUrl = resolvePhotoUrl();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const {
    LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION,
    LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION,
    buildLionBedtimeBarContactSheet,
    formatLionBedtimeBarExperimentReport,
    runLionBedtimeBarAnchorExperiment,
  } = await import('@/lib/generation-pipeline/stage0-resemblance-experiment');

  fs.writeFileSync(
    path.join(OUT_DIR, 'identity-lock.txt'),
    [
      'Corrected Bar identity (Brief F pre-step)',
      '',
      `childPhotoDescription: ${LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION}`,
      '',
      `lockedChildDescription: ${LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION}`,
      '',
      'Variant C: SKIPPED (no face-less template asset).',
    ].join('\n'),
    'utf-8'
  );

  const results = await runLionBedtimeBarAnchorExperiment({
    childPhotoUrl,
    outDir: OUT_DIR,
  });

  const reportJsonPath = path.join(OUT_DIR, 'report.json');
  const reportMdPath = path.join(OUT_DIR, 'report.md');
  const contactSheetPath = path.join(OUT_DIR, 'contact-sheet.png');

  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify(
      {
        experiment: 'lion_bedtime_bar_anchor_resemblance',
        childPhotoUrl,
        variantC: 'skipped — no face-less template',
        results: results.map((r) => ({
          variant: r.variant,
          label: r.label,
          layout: r.layout,
          resemblanceScore: r.resemblanceScore,
          pageThreshold: r.pageThreshold,
          embeddingVerdict: r.embeddingVerdict,
          referenceOrderLabels: r.referenceOrderLabels,
          referenceMode: r.referenceMode,
          styleQa: r.styleQa,
          semanticOk: r.semantic.ok,
          anchorVisionDescription: r.anchorVisionDescription,
          fivePointGate: r.fivePointGate,
          localPngPath: r.localPngPath,
          promptPath: r.promptPath,
        })),
      },
      null,
      2
    )
  );
  fs.writeFileSync(reportMdPath, formatLionBedtimeBarExperimentReport(results), 'utf-8');
  await buildLionBedtimeBarContactSheet(results, contactSheetPath);

  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        reportJsonPath,
        reportMdPath,
        contactSheetPath,
        scores: results.map((r) => ({ variant: r.variant, score: r.resemblanceScore.toFixed(3) })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
