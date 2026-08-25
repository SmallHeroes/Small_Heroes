import fs from 'node:fs';

import {
  prepareQaWizardPackageCandidate,
  publishQaWizardApprovedPackage,
  recordQaWizardPackageApproval,
} from '@/lib/visual-package/qaWizardPackageLifecycle';

type JsonObject = Record<string, unknown>;

interface PreparePackageRequest {
  repoRoot: string;
  approvedBlueprintManifestPath: string;
  worldMode:
    | 'grounded'
    | 'grounded_with_visual_metaphor'
    | 'fantastical';
  reviewedBy: 'Guy';
  reviewedAt: string;
}

interface ApprovePackageRequest {
  repoRoot: string;
  candidateManifestPath: string;
  expectedPackageCandidateDigest: string;
  expectedPackageReviewDigest: string;
  approvedBy: 'Guy';
  approvedAt: string;
  note?: string;
}

interface PublishPackageRequest {
  repoRoot: string;
  approvedManifestPath: string;
  publishedAt: string;
}

function usage(): string {
  return [
    'QA Wizard Visual Package lifecycle:',
    '  prepare-package --request <json> --out <repo-relative-dir> --write true|false',
    '  approve-package --request <json> --out <same-repo-relative-dir> --write true|false',
    '  publish-package --request <json> --out <same-repo-relative-dir> --write true|false',
    '',
    'The lifecycle consumes only an exact approved QA Wizard Blueprint manifest.',
    'It cannot call a provider, render, access credentials, write a database, deploy, or select a noncanonical approved-package directory.',
    'Package preparation does not grant approval. Approval is exact-Guy and candidate/review-digest bound; publication compare-and-swaps the canonical locator.',
  ].join('\n');
}

function parseFlags(tokens: string[]): Map<string, string> {
  if (tokens.length % 2 !== 0) throw new Error('invalid_arguments');
  const allowed = new Set(['--request', '--out', '--write']);
  const flags = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !flag ||
      !value ||
      !flag.startsWith('--') ||
      flag.includes('=') ||
      value.startsWith('--') ||
      !allowed.has(flag) ||
      flags.has(flag)
    ) {
      throw new Error('invalid_arguments');
    }
    flags.set(flag, value);
  }
  if (
    flags.size !== allowed.size ||
    [...allowed].some((flag) => !flags.has(flag))
  ) {
    throw new Error('invalid_arguments');
  }
  return flags;
}

function required(flags: ReadonlyMap<string, string>, flag: string): string {
  const value = flags.get(flag);
  if (!value) throw new Error('invalid_arguments');
  return value;
}

function writeValue(flags: ReadonlyMap<string, string>): boolean {
  const value = required(flags, '--write');
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('invalid_arguments');
}

function objectValue(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is JsonObject {
  if (!objectValue(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  return (
    requiredKeys.every((key) => keys.includes(key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function readRequest<T>(args: {
  filePath: string;
  requiredKeys: readonly string[];
  optionalKeys?: readonly string[];
}): T {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(args.filePath, 'utf8')) as unknown;
  } catch {
    throw new Error('request_invalid');
  }
  if (!exactKeys(value, args.requiredKeys, args.optionalKeys)) {
    throw new Error('request_invalid');
  }
  return value as T;
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function rejectionCode(error: unknown): string {
  if (!(error instanceof Error)) return 'package_lifecycle_failed';
  if (error.message === 'invalid_arguments') return 'operator_arguments_invalid';
  if (error.message === 'request_invalid') return 'operator_request_invalid';
  return 'package_authority_validation_failed';
}

function execute(command: string, tokens: string[]): void {
  const flags = parseFlags(tokens);
  const requestPath = required(flags, '--request');
  const outputDir = required(flags, '--out');
  const write = writeValue(flags);

  if (command === 'prepare-package') {
    const request = readRequest<PreparePackageRequest>({
      filePath: requestPath,
      requiredKeys: [
        'repoRoot',
        'approvedBlueprintManifestPath',
        'worldMode',
        'reviewedBy',
        'reviewedAt',
      ],
    });
    const result = prepareQaWizardPackageCandidate({
      ...request,
      outputDir,
      write,
    });
    output({
      status: write
        ? 'package_candidate_review_persisted'
        : 'package_candidate_review_preview_ready',
      localImmutableWriteRequested: write,
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      packageCandidate: {
        digest: result.candidate.digest,
        path: result.manifest.package.candidatePath,
      },
      packageReview: {
        digest: result.packageReview.digest,
        path: result.manifest.package.reviewPath,
        readyForApproval: result.packageReview.readyForApproval,
      },
      qualification: {
        digest: result.qualification.digest,
        readyForPublication: result.qualification.readyForPublication,
        reasonCodes: result.qualification.reasons.map((reason) => reason.code),
      },
      boundaryEvidence: result.manifest.externalCounters,
    });
    return;
  }

  if (command === 'approve-package') {
    const request = readRequest<ApprovePackageRequest>({
      filePath: requestPath,
      requiredKeys: [
        'repoRoot',
        'candidateManifestPath',
        'expectedPackageCandidateDigest',
        'expectedPackageReviewDigest',
        'approvedBy',
        'approvedAt',
      ],
      optionalKeys: ['note'],
    });
    const result = recordQaWizardPackageApproval({
      ...request,
      outputDir,
      write,
    });
    output({
      status: write
        ? 'exact_package_approval_recorded'
        : 'exact_package_approval_preview_ready',
      localImmutableWriteRequested: write,
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      approval: {
        version: result.approval.version,
        digest: result.approval.digest,
        path: result.approvalPath,
        approvedBy: result.approval.approvedBy,
        approvedAt: result.approval.approvedAt,
      },
      decisionPath: result.decisionPath,
    });
    return;
  }

  if (command === 'publish-package') {
    const request = readRequest<PublishPackageRequest>({
      filePath: requestPath,
      requiredKeys: ['repoRoot', 'approvedManifestPath', 'publishedAt'],
    });
    const result = publishQaWizardApprovedPackage({
      ...request,
      outputDir,
      write,
    });
    output({
      status: write
        ? 'canonical_package_published'
        : 'canonical_package_publication_preview_ready',
      localCanonicalWriteRequested: write,
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      package: {
        revisionDigest: result.packageValue.revisionDigest,
        path: result.packagePath,
      },
      locator: {
        path: result.locatorPath,
        revisionDigest: result.locator.revisionDigest,
        changed: result.locatorChanged,
      },
      publicationClaimPath: result.publicationClaimPath,
      boundaryEvidence: result.manifest.externalCounters,
    });
    return;
  }

  throw new Error('invalid_arguments');
}

function main(): void {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    execute(command, tokens);
  } catch (error) {
    output({
      status: 'rejected',
      reasonCode: rejectionCode(error),
      localWriteClaimed: false,
      providerCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
    });
    process.exitCode = 1;
  }
}

main();
