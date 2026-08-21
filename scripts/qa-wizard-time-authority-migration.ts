import fs from 'node:fs';

import {
  advanceApprovedTimeAuthorityMigration,
  prepareTimeAuthorityMigrationReconciliation,
  recordTimeAuthorityMigrationReconciliationApproval,
} from '@/lib/visual-package/timeAuthorityMigrationLifecycle';

const ALLOWED_FLAGS = new Set(['--request', '--out', '--write']);

function parseFlags(tokens: string[]): Map<string, string> {
  if (tokens.length % 2 !== 0) throw new Error('invalid_arguments');
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !flag?.startsWith('--') ||
      flag.includes('=') ||
      !ALLOWED_FLAGS.has(flag) ||
      !value ||
      value.startsWith('--') ||
      values.has(flag)
    ) {
      throw new Error('invalid_arguments');
    }
    values.set(flag, value);
  }
  return values;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error('invalid_arguments');
  return value;
}

function writeFlag(values: ReadonlyMap<string, string>): boolean {
  const value = required(values, '--write');
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('invalid_arguments');
}

function request<T>(
  requestPath: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): T {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as unknown;
  } catch {
    throw new Error('request_invalid');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request_invalid');
  }
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  if (
    requiredKeys.some((key) => !keys.includes(key)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new Error('request_invalid');
  }
  return value as T;
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(): void {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write([
      'QA Wizard time-authority migration (offline only):',
      '  prepare --request <json> --out <repo-relative-dir> --write true|false',
      '  approve --request <json> --out <repo-relative-dir> --write true|false',
      '  advance --request <json> --out <repo-relative-dir> --write true|false',
      '',
      'No provider, credential, image, publication, locator, Wizard promotion, render, or deployment path is imported.',
    ].join('\n') + '\n');
    return;
  }
  try {
    const flags = parseFlags(tokens);
    const outputDir = required(flags, '--out');
    const write = writeFlag(flags);
    const requestPath = required(flags, '--request');
    if (command === 'prepare') {
      const value = request<{
        repoRoot: string;
        sourcePackageCandidatePath: string;
        sourcePackageReviewPath: string;
        sourcePackageApprovalPath: string;
      }>(requestPath, [
        'repoRoot',
        'sourcePackageCandidatePath',
        'sourcePackageReviewPath',
        'sourcePackageApprovalPath',
      ]);
      const result = prepareTimeAuthorityMigrationReconciliation({
        ...value,
        outputDir,
        write,
      });
      output({
        status: write
          ? 'time_authority_migration_reconciliation_pending'
          : 'time_authority_migration_preview_ready',
        localImmutableWriteRequested: write,
        ...result,
        boundaryEvidence: {
          credentialAccess: 'none',
          providerCalls: 0,
          imageCalls: 0,
          networkCalls: 0,
          databaseWrites: 0,
          productionWrites: 0,
        },
      });
      return;
    }
    if (command === 'approve') {
      const value = request<{
        repoRoot: string;
        pendingManifestPath: string;
        approvedBy: 'Guy';
        approvedAt: string;
      }>(requestPath, [
        'repoRoot',
        'pendingManifestPath',
        'approvedBy',
        'approvedAt',
      ]);
      const result = recordTimeAuthorityMigrationReconciliationApproval({
        ...value,
        outputDir,
        write,
      });
      output({
        status: write
          ? 'time_authority_migration_reconciliation_approval_recorded'
          : 'time_authority_migration_reconciliation_approval_preview_ready',
        localImmutableWriteRequested: write,
        ...result,
        boundaryEvidence: {
          credentialAccess: 'none',
          providerCalls: 0,
          imageCalls: 0,
          networkCalls: 0,
          databaseWrites: 0,
          productionWrites: 0,
        },
      });
      return;
    }
    if (command === 'advance') {
      const value = request<{
        repoRoot: string;
        pendingManifestPath: string;
        approvalPath: string;
        styleId: string;
        styleAuthorityPath: string;
        expectedStyleAuthorityDigest?: string;
      }>(
        requestPath,
        [
          'repoRoot',
          'pendingManifestPath',
          'approvalPath',
          'styleId',
          'styleAuthorityPath',
        ],
        ['expectedStyleAuthorityDigest'],
      );
      const result = advanceApprovedTimeAuthorityMigration({
        ...value,
        outputDir,
        write,
      });
      output({
        status: write
          ? 'time_authority_migration_ready_for_blueprint'
          : 'time_authority_migration_blueprint_preview_ready',
        localImmutableWriteRequested: write,
        manifest: result.manifest,
        manifestArtifact: result.manifestArtifact,
        productionContext: {
          version: result.context.version,
          digest: result.context.digest,
        },
        boundaryEvidence: {
          credentialAccess: 'none',
          providerCalls: 0,
          imageCalls: 0,
          networkCalls: 0,
          databaseWrites: 0,
          productionWrites: 0,
        },
      });
      return;
    }
    throw new Error('invalid_arguments');
  } catch (error) {
    output({
      status: 'rejected',
      localImmutableWriteState: 'not_attested_after_rejection',
      reasonCodes: [
        error instanceof Error && error.message === 'invalid_arguments'
          ? 'migration_cli_arguments_invalid'
          : error instanceof Error && error.message === 'request_invalid'
            ? 'migration_request_invalid'
            : 'migration_authority_validation_failed',
      ],
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        productionWrites: 0,
      },
    });
    process.exitCode = 1;
  }
}

main();
