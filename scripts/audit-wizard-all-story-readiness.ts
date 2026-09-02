#!/usr/bin/env tsx
/**
 * Read-only all-story control-plane audit.
 *
 * This command reads and validates committed repository authority only. It
 * cannot materialize, approve, publish, render, access credentials, or touch a
 * database/storage provider.
 */
import {
  auditWizardAllStoryRenderReadiness,
  type WizardAllStoryRenderReadinessReport,
} from '@/lib/visual-package/wizardAllStoryRenderReadiness';
import { isCompleteMvpWizardStoryInventory } from '@/backend/config/mvp-story-matrix';

type OutputFormat = 'json' | 'table';

function usage(): string {
  return [
    'Wizard all-story render-readiness audit (read-only):',
    '  npm run wizard-all-story-readiness -- [--format json|table] [--require-all-render-ready] [--require-all-narration-automated-preflight-ready]',
    'Run from the repository root. From another cwd, use npm --prefix <repo-root> run wizard-all-story-readiness -- [options].',
  ].join('\n');
}

function parseArgs(argv: readonly string[]): {
  format: OutputFormat;
  requireAllRenderReady: boolean;
  requireAllNarrationReady: boolean;
} {
  let format: OutputFormat = 'json';
  let requireAllRenderReady = false;
  let requireAllNarrationReady = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === 'help') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (token === '--require-all-render-ready') {
      requireAllRenderReady = true;
      continue;
    }
    if (token === '--require-all-narration-automated-preflight-ready') {
      requireAllNarrationReady = true;
      continue;
    }
    if (token === '--format') {
      const value = argv[index + 1];
      if (value !== 'json' && value !== 'table') {
        throw new Error('--format must be exactly json or table');
      }
      format = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}\n${usage()}`);
  }
  return {
    format,
    requireAllRenderReady,
    requireAllNarrationReady,
  };
}

function renderTable(report: WizardAllStoryRenderReadinessReport): string {
  const lines = [
    [
      'storyKey'.padEnd(28),
      'source'.padEnd(24),
      'QA',
      'accepted',
      'VC policy',
      'package',
      'render',
      'earliestBlocker'.padEnd(48),
      'nextCanonicalAction'.padEnd(52),
    ].join(' | '),
    '-'.repeat(232),
  ];
  for (const record of report.records) {
    lines.push(
      [
        record.storyKey.padEnd(28),
        String(record.sources.currentProductSourceRole ?? 'missing').padEnd(24),
        record.qaAuthority.readyForLowStoryGeneration ? 'Y ' : 'N ',
        record.productionStages.acceptedSourceRevision ? 'Y       ' : 'N       ',
        record.authoringPolicy.admitted ? 'Y        ' : 'BLOCKED  ',
        record.productionStages.approvedVisualPackage ? 'Y      ' : 'N      ',
        record.productionStages.renderQualified ? 'Y     ' : 'N     ',
        String(record.earliestBlocker ?? '-').padEnd(48),
        String(record.nextCanonicalAction?.code ?? '-').padEnd(52),
      ].join(' | '),
    );
  }
  lines.push('');
  lines.push(
    `summary: nominal=${report.summary.nominalSlotCount} ` +
      `sellable=${report.summary.environmentProductSellableCount} ` +
      `qaLow=${report.summary.qaLowReadyCount} ` +
      `accepted=${report.summary.acceptedProductLineageCount} ` +
      `renderQualified=${report.summary.renderQualifiedCount} ` +
      `narrationPreflight=${report.summary.supportedNarrationAutomatedPreflightReadyCount} ` +
      `softTtsReviewItems=${report.summary.softTtsReviewItemCount}`,
  );
  lines.push(`digest: ${report.digest}`);
  return lines.join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = auditWizardAllStoryRenderReadiness({
    repoRoot: process.cwd(),
  });
  process.stdout.write(
    options.format === 'json'
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${renderTable(report)}\n`,
  );

  const completeNominalInventory = isCompleteMvpWizardStoryInventory({
    declaredSlotCount: report.summary.nominalSlotCount,
    storyKeys: report.records.map((record) => record.storyKey),
  });
  if (
    options.requireAllRenderReady &&
    (!completeNominalInventory ||
      report.records.some(
        (record) =>
          !record.productionStages.sourceCorpusConfirmed ||
          !record.productionStages.acceptedSourceRevision ||
          !record.productionStages.renderQualified,
      ))
  ) {
    process.exitCode = 1;
  }
  if (
    options.requireAllNarrationReady &&
    (!completeNominalInventory ||
      report.records.some(
        (record) =>
          !record.productTextReadiness
            ?.supportedNarrationAutomatedPreflightReady,
      ))
  ) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
