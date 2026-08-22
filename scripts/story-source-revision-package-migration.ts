#!/usr/bin/env node

import { prepareStorySourceRevisionPackageMigration } from '@/lib/visual-package/storySourceRevisionPackageMigrationLifecycle';

interface CliArgs {
  repoRoot: string;
  outputDir: string;
  storyKey: string;
  styleId: string;
  locatorPath: string;
  acceptedRevisionManifestPath: string;
  write: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const allowed = [
    '--accepted-manifest',
    '--locator',
    '--out',
    '--repo-root',
    '--story-key',
    '--style-id',
    '--write',
  ] as const;
  if (argv.length !== allowed.length * 2) {
    throw new Error('story_source_revision_package_migration_arguments_invalid');
  }
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || value === undefined || !allowed.includes(key as (typeof allowed)[number]) || values.has(key)) {
      throw new Error('story_source_revision_package_migration_arguments_invalid');
    }
    values.set(key, value);
  }
  if (
    JSON.stringify([...values.keys()].sort()) !== JSON.stringify([...allowed].sort()) ||
    !['true', 'false'].includes(values.get('--write') ?? '')
  ) {
    throw new Error('story_source_revision_package_migration_arguments_invalid');
  }
  return {
    repoRoot: values.get('--repo-root')!,
    outputDir: values.get('--out')!,
    storyKey: values.get('--story-key')!,
    styleId: values.get('--style-id')!,
    locatorPath: values.get('--locator')!,
    acceptedRevisionManifestPath: values.get('--accepted-manifest')!,
    write: values.get('--write') === 'true',
  };
}

function main(): void {
  const result = prepareStorySourceRevisionPackageMigration(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    manifestPath: result.artifacts.manifestPath,
    manifestDigest: result.manifest.digest,
    created: result.artifacts.created,
    storyKey: result.manifest.storyKey,
    sourceRevisionDigest: result.manifest.acceptedRevision.revisionDigest,
    migratedTemplateDigest: result.manifest.projection.migratedTemplateDigest,
    reconciliationDigest: result.manifest.reconciliation.digest,
    reviewBundleDigest: result.manifest.reconciliation.reviewBundleDigest,
    evidenceEntryCount: result.manifest.evidenceMigration.entryCount,
    changedExcerptCount: result.manifest.evidenceMigration.changedExcerptCount,
    coverageRecordCount: result.manifest.projection.coverageRecordCount,
    externalCounters: result.manifest.externalCounters,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error
    ? error.message.split(':')[0]
    : 'story_source_revision_package_migration_unknown_failure'}\n`);
  process.exitCode = 1;
}
