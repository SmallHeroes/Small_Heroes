/**
 * Offline-only Set Board identity rebind for an approved time-authority
 * migration. This entrypoint imports no provider, image, Vision, network,
 * storage, database, Wizard, publication, locator, or deployment boundary.
 */
import fs from 'node:fs';

import {
  approveTimeAuthoritySetBoardRebind,
  prepareTimeAuthoritySetBoardRebind,
} from '@/lib/visual-package/timeAuthorityMigrationSetBoardLifecycle';

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

function boundaryEvidence(): Record<string, number | string> {
  return {
    credentialAccess: 'none',
    providerCalls: 0,
    imageCalls: 0,
    visionCalls: 0,
    networkCalls: 0,
    databaseWrites: 0,
    productionWrites: 0,
  };
}

function main(): void {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write([
      'Time-authority Set Board rebind (offline only):',
      '  prepare --request <json> --out <repo-relative-dir> --write true|false',
      '  approve --request <json> --out <repo-relative-dir> --write true|false',
      '',
      'No provider, image, Vision, network, database, Wizard, publication, locator, render, or deployment path is imported.',
    ].join('\n') + '\n');
    return;
  }
  try {
    const flags = parseFlags(tokens);
    const outputRoot = required(flags, '--out');
    const write = writeFlag(flags);
    const requestPath = required(flags, '--request');
    if (command === 'prepare') {
      const value = request<{
        repoRoot: string;
        approvedManifestPath: string;
        setIdentityId: string;
        targetBoardRegistryDir?: string;
      }>(
        requestPath,
        ['repoRoot', 'approvedManifestPath', 'setIdentityId'],
        ['targetBoardRegistryDir'],
      );
      const result = prepareTimeAuthoritySetBoardRebind({
        ...value,
        outputRoot,
        write,
      });
      output({
        status: write
          ? 'time_authority_set_board_rebind_pending'
          : 'time_authority_set_board_rebind_preview_ready',
        localImmutableWriteRequested: write,
        candidateDigest: result.candidate.digest,
        reviewDigest: result.review.digest,
        sourceSetDefinitionHash: result.candidate.sourceSetDefinitionHash,
        targetSetDefinitionHash: result.candidate.targetSetDefinitionHash,
        preservedAssetSha256: result.review.preservedAssetSha256,
        candidateArtifact: result.candidateArtifact,
        reviewArtifact: result.reviewArtifact,
        targetRegistryPath: result.targetRegistryPath,
        boundaryEvidence: boundaryEvidence(),
      });
      return;
    }
    if (command === 'approve') {
      const value = request<{
        repoRoot: string;
        approvedManifestPath: string;
        setIdentityId: string;
        targetBoardRegistryDir?: string;
        candidatePath: string;
        reviewPath: string;
        approvedBy: 'Guy';
        approvedAt: string;
        note?: string;
      }>(
        requestPath,
        [
          'repoRoot',
          'approvedManifestPath',
          'setIdentityId',
          'candidatePath',
          'reviewPath',
          'approvedBy',
          'approvedAt',
        ],
        ['targetBoardRegistryDir', 'note'],
      );
      if (value.approvedBy !== 'Guy') {
        throw new Error('approval_identity_invalid');
      }
      const result = approveTimeAuthoritySetBoardRebind({
        ...value,
        outputRoot,
        write,
      });
      output({
        status: write
          ? 'time_authority_set_board_rebind_approved'
          : 'time_authority_set_board_rebind_approval_preview_ready',
        localImmutableWriteRequested: write,
        approvalDigest: result.approval.digest,
        candidateDigest: result.candidate.digest,
        reviewDigest: result.review.digest,
        targetRegistryEntryDigest: result.registryArtifact.digest,
        preservedAssetSha256: result.targetRegistryEntry.assetSha256,
        approvalArtifact: result.approvalArtifact,
        registryArtifact: result.registryArtifact,
        boundaryEvidence: boundaryEvidence(),
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
          ? 'set_board_rebind_cli_arguments_invalid'
          : error instanceof Error && error.message === 'request_invalid'
            ? 'set_board_rebind_request_invalid'
            : error instanceof Error && error.message ===
                'approval_identity_invalid'
              ? 'set_board_rebind_approval_identity_invalid'
              : 'set_board_rebind_authority_validation_failed',
      ],
      boundaryEvidence: boundaryEvidence(),
    });
    process.exitCode = 1;
  }
}

main();
