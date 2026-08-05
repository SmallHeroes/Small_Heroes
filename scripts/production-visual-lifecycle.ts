/**
 * Zero-cost production lifecycle entrypoint for R1D-PVB-D0/D1A0.
 *
 * This CLI intentionally has no provider adapter, approval command, publication
 * write flag, environment-file loader, registry mutation, or render boundary.
 * It reads exact local artifacts, creates deterministic drafts/plans, and emits
 * JSON to stdout. D1A0 adds one explicit write surface for immutable,
 * content-addressed local source/preflight review artifacts. D1A1B0 adds one
 * provider-free materialization surface for canonical future-live inputs.
 */
import fs from 'fs';

import {
  CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
  assertValidVisualPackageV4,
  assembleVisualPackageV4Candidate,
  auditProductionStoryReadiness,
  buildProductionAuthoringContext,
  buildProductionReconciliationDraftFromFiles,
  buildStorySourceAuthoritySnapshot,
  buildVisualContractAuthoringReadinessEvidence,
  buildVisualContractAuthoringRequest,
  finalizeApprovedVisualPackageV4,
  materializeCanonicalLiveRequestBundle,
  persistReconciliationDraftBundle,
  persistStorySourceAuthoritySnapshot,
  persistVisualContractAuthoringReadiness,
  persistVisualContractAuthoringReceipt,
  persistVisualContractAuthoringRequest,
  persistVisualPackageV4CandidateReview,
  publishVisualPackageV4,
  qualifyVisualPackageV4Candidate,
  runProductionBlueprintAuthoring,
  runVisualContractAuthoring,
  verifyCanonicalLiveRequestBundle,
  type ApprovedBlueprintLifecyclePaths,
  type ProductionAuthoringRunRequest,
  type StorySourceAuthorityRequest,
  type VisualPackageReviewReality,
  type VisualPackageV4,
  type VisualPackageV4Approval,
  type VisualPackageV4Candidate,
  type VisualPackageV4PackageReview,
} from '@/lib/visual-package';

type ReadinessRequest = Parameters<
  typeof auditProductionStoryReadiness
>[0];
type ContextRequest = Parameters<
  typeof buildProductionAuthoringContext
>[0];
type ReconciliationRequest = Parameters<
  typeof buildProductionReconciliationDraftFromFiles
>[0];

interface AuthoringPreflightRequest {
  context: ContextRequest;
  authoringRequest: ProductionAuthoringRunRequest;
}

interface SourceAuthoringPreflightRequest
  extends StorySourceAuthorityRequest {
  requestId: string;
  requestedAt: string;
}

interface AssembleV4Request {
  context: ContextRequest;
  approvedBlueprintPaths: ApprovedBlueprintLifecyclePaths;
  review: VisualPackageReviewReality;
  boardRegistryDir?: string;
}

const REQUEST_ONLY = new Set(['--request']);
const REQUEST_WITH_OUT = new Set(['--request', '--out']);
const REQUEST_WITH_OUT_WRITE = new Set([
  '--request',
  '--out',
  '--write',
]);
const QUALIFY_FLAGS = new Set([
  '--repo-root',
  '--candidate',
  '--review',
  '--approval',
  '--board-registry-dir',
]);
const FINALIZE_FLAGS = new Set([
  ...QUALIFY_FLAGS,
  '--review-artifact',
]);
const PUBLICATION_FLAGS = new Set([
  '--repo-root',
  '--package',
  '--approved-dir',
]);
const LIVE_REQUEST_MATERIALIZATION_FLAGS = new Set([
  '--repo-root',
  '--request',
  '--out',
]);
const LIVE_REQUEST_VERIFICATION_FLAGS = new Set([
  '--repo-root',
  '--manifest',
]);

function usage(): string {
  return [
    'Production visual lifecycle (deterministic local authority tooling):',
    '  source-authoring-preflight --request <json> [--out <repo-relative-dir>] [--write true|false]',
    '  source-authoring-live-request-materialize --repo-root <absolute-dir> --request <canonical-materialization-input> --out <repo-relative-dir>',
    '  source-authoring-live-request-verify --repo-root <absolute-dir> --manifest <repo-relative-json>',
    '  readiness --request <json>',
    '  context --request <json>',
    '  reconciliation-draft --request <json> [--out <repo-relative-dir>]',
    '  authoring-preflight --request <json>',
    '  assemble-v4 --request <json> [--out <repo-relative-dir>]',
    '  qualify-v4 --repo-root <dir> --candidate <json> --review <json> [--approval <json>] [--board-registry-dir <dir>]',
    '  finalize-plan --repo-root <dir> --candidate <json> --review <json> --review-artifact <repo-relative-json> --approval <json> [--board-registry-dir <dir>]',
    '  publication-plan --repo-root <dir> --package <json> --approved-dir <dir>',
    '',
    'Write surfaces are limited to explicit --write true for source/preflight review artifacts and source-authoring-live-request-materialize consuming repository-writer canonical materialization input for immutable future-live artifacts.',
    'There is no live provider adapter, approval command, publication write flag, fallback, render, Vision, network, database, or registry mutation in this entrypoint.',
  ].join('\n');
}

function parseFlags(
  tokens: string[],
  allowed: ReadonlySet<string>,
): Map<string, string> {
  if (tokens.length % 2 !== 0) {
    throw new Error('every flag requires one separate value');
  }
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !flag?.startsWith('--') ||
      flag.includes('=') ||
      !allowed.has(flag)
    ) {
      throw new Error(`unknown or malformed flag: ${flag ?? '<missing>'}`);
    }
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }
    if (values.has(flag)) {
      throw new Error(`duplicate flag: ${flag}`);
    }
    values.set(flag, value);
  }
  return values;
}

function requireFlag(
  values: ReadonlyMap<string, string>,
  flag: string,
): string {
  const value = values.get(flag);
  if (!value) throw new Error(`missing required flag: ${flag}`);
  return value;
}

function readJson<T = unknown>(filePath: string): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(
      `cannot parse JSON ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requestFile<T>(
  tokens: string[],
  allowed: ReadonlySet<string> = REQUEST_ONLY,
): { request: T; flags: Map<string, string> } {
  const flags = parseFlags(tokens, allowed);
  const request = readJson<T>(requireFlag(flags, '--request'));
  objectValue(request, 'request');
  return { request, flags };
}

function readiness(tokens: string[]): void {
  const { request } = requestFile<ReadinessRequest>(tokens);
  output(auditProductionStoryReadiness(request));
}

function context(tokens: string[]): void {
  const { request } = requestFile<ContextRequest>(tokens);
  output(buildProductionAuthoringContext(request));
}

function reconciliationDraft(tokens: string[]): void {
  const { request, flags } = requestFile<ReconciliationRequest>(
    tokens,
    REQUEST_WITH_OUT,
  );
  const bundle =
    buildProductionReconciliationDraftFromFiles(request);
  const persistence = flags.has('--out')
    ? persistReconciliationDraftBundle({
        repoRoot: request.repoRoot,
        outputDir: requireFlag(flags, '--out'),
        reconciliation: bundle.reconciliation,
        reviewBundle: bundle.reviewBundle,
        markdown: bundle.markdown,
        write: false,
      })
    : null;
  output({
    mode: 'deterministic_reconciliation_draft',
    zeroWrite: true,
    sourceIdentity: bundle.sourceIdentity,
    templateIdentity: bundle.templateIdentity,
    reconciliation: bundle.reconciliation,
    reviewBundle: bundle.reviewBundle,
    markdown: bundle.markdown,
    persistencePlan: persistence,
  });
}

async function authoringPreflight(tokens: string[]): Promise<void> {
  const { request } =
    requestFile<AuthoringPreflightRequest>(tokens);
  objectValue(request.context, 'request.context');
  objectValue(
    request.authoringRequest,
    'request.authoringRequest',
  );
  if (request.authoringRequest.mode !== 'preflight') {
    throw new Error(
      'D0 CLI accepts only mode=preflight; live mode requires a separately injected provider adapter',
    );
  }
  const authoringContext =
    buildProductionAuthoringContext(request.context);
  const result = await runProductionBlueprintAuthoring({
    request: request.authoringRequest,
    context: authoringContext,
  });
  output({
    mode: 'provider_unreachable_authoring_preflight',
    zeroWrite: true,
    receipt: result.receipt,
  });
}

function writeFlag(flags: ReadonlyMap<string, string>): boolean {
  const value = flags.get('--write');
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('--write must be exactly true or false');
}

async function sourceAuthoringPreflight(
  tokens: string[],
): Promise<void> {
  const { request, flags } =
    requestFile<SourceAuthoringPreflightRequest>(
      tokens,
      REQUEST_WITH_OUT_WRITE,
    );
  const snapshot =
    buildStorySourceAuthoritySnapshot(request);
  const authoringRequest =
    buildVisualContractAuthoringRequest({
      snapshot,
      mode: 'preflight',
      requestId: request.requestId,
      requestedAt: request.requestedAt,
    });
  const result = await runVisualContractAuthoring({
    request: authoringRequest,
    snapshot,
  });
  const readiness =
    buildVisualContractAuthoringReadinessEvidence({
      snapshot,
      request: authoringRequest,
      receipt: result.receipt,
    });
  const shouldWrite = writeFlag(flags);
  if (shouldWrite && !flags.has('--out')) {
    throw new Error(
      '--write true requires --out <repo-relative-dir>',
    );
  }
  const outputDir = flags.get('--out');
  const persistence = outputDir
    ? {
        sourceSnapshot:
          persistStorySourceAuthoritySnapshot({
            repoRoot: request.repoRoot,
            outputDir,
            snapshot,
            write: shouldWrite,
          }),
        authoringRequest:
          persistVisualContractAuthoringRequest({
            repoRoot: request.repoRoot,
            outputDir,
            request: authoringRequest,
            write: shouldWrite,
          }),
        authoringReceipt:
          persistVisualContractAuthoringReceipt({
            repoRoot: request.repoRoot,
            outputDir,
            receipt: result.receipt,
            write: shouldWrite,
          }),
        readiness:
          persistVisualContractAuthoringReadiness({
            repoRoot: request.repoRoot,
            outputDir,
            evidence: readiness,
            receipt: result.receipt,
            write: shouldWrite,
          }),
      }
    : null;
  output({
    mode: 'provider_unreachable_source_authoring_preflight',
    localImmutableWrite: shouldWrite,
    snapshot,
    authoringRequest,
    receipt: result.receipt,
    readiness,
    persistence,
  });
}

function sourceAuthoringLiveRequestMaterialize(
  tokens: string[],
): void {
  const flags = parseFlags(
    tokens,
    LIVE_REQUEST_MATERIALIZATION_FLAGS,
  );
  const result = materializeCanonicalLiveRequestBundle({
    repoRoot: requireFlag(flags, '--repo-root'),
    requestPath: requireFlag(flags, '--request'),
    outputDir: requireFlag(flags, '--out'),
  });
  output(result);
}

function sourceAuthoringLiveRequestVerify(
  tokens: string[],
): void {
  let flags: Map<string, string>;
  try {
    flags = parseFlags(
      tokens,
      LIVE_REQUEST_VERIFICATION_FLAGS,
    );
    requireFlag(flags, '--repo-root');
    requireFlag(flags, '--manifest');
  } catch {
    output({
      version:
        CANONICAL_LIVE_REQUEST_VERIFICATION_VERSION,
      status: 'rejected',
      zeroWrite: true,
      reasonCodes: ['verification_cli_arguments_invalid'],
    });
    process.exitCode = 1;
    return;
  }
  const result = verifyCanonicalLiveRequestBundle({
    repoRoot: requireFlag(flags, '--repo-root'),
    manifestPath: requireFlag(flags, '--manifest'),
  });
  output(result);
  if (result.status === 'rejected') {
    process.exitCode = 1;
  }
}

function assembleV4(tokens: string[]): void {
  const { request, flags } = requestFile<AssembleV4Request>(
    tokens,
    REQUEST_WITH_OUT,
  );
  const authoringContext =
    buildProductionAuthoringContext(request.context);
  const result = assembleVisualPackageV4Candidate({
    repoRoot: request.context.repoRoot,
    context: authoringContext,
    approvedBlueprintPaths: request.approvedBlueprintPaths,
    review: request.review,
    ...(request.boardRegistryDir
      ? { boardRegistryDir: request.boardRegistryDir }
      : {}),
  });
  const persistence = flags.has('--out')
    ? persistVisualPackageV4CandidateReview({
        repoRoot: request.context.repoRoot,
        outputDir: requireFlag(flags, '--out'),
        candidate: result.candidate,
        packageReview: result.packageReview,
        write: false,
      })
    : null;
  output({
    mode: 'visual_package_v4_candidate_assembly',
    zeroWrite: true,
    ...result,
    persistencePlan: persistence,
  });
}

function qualificationArgs(tokens: string[]): {
  flags: Map<string, string>;
  repoRoot: string;
  candidate: unknown;
  packageReview: unknown;
  approval: unknown;
  boardRegistryDir?: string;
} {
  const flags = parseFlags(tokens, QUALIFY_FLAGS);
  const repoRoot = requireFlag(flags, '--repo-root');
  const candidate = readJson(requireFlag(flags, '--candidate'));
  const packageReview = readJson(requireFlag(flags, '--review'));
  const approval = flags.has('--approval')
    ? readJson(requireFlag(flags, '--approval'))
    : null;
  return {
    flags,
    repoRoot,
    candidate,
    packageReview,
    approval,
    ...(flags.has('--board-registry-dir')
      ? {
          boardRegistryDir: requireFlag(
            flags,
            '--board-registry-dir',
          ),
        }
      : {}),
  };
}

function qualifyV4(tokens: string[]): void {
  const args = qualificationArgs(tokens);
  output(
    qualifyVisualPackageV4Candidate({
      repoRoot: args.repoRoot,
      candidate: args.candidate,
      packageReview: args.packageReview,
      approval: args.approval,
      ...(args.boardRegistryDir
        ? { boardRegistryDir: args.boardRegistryDir }
        : {}),
    }),
  );
}

function finalizePlan(tokens: string[]): void {
  const flags = parseFlags(tokens, FINALIZE_FLAGS);
  const repoRoot = requireFlag(flags, '--repo-root');
  const candidate = readJson<VisualPackageV4Candidate>(
    requireFlag(flags, '--candidate'),
  );
  const packageReview = readJson<VisualPackageV4PackageReview>(
    requireFlag(flags, '--review'),
  );
  const approval = readJson<VisualPackageV4Approval>(
    requireFlag(flags, '--approval'),
  );
  const packageValue = finalizeApprovedVisualPackageV4({
    repoRoot,
    candidate,
    packageReview,
    packageReviewArtifactPath: requireFlag(
      flags,
      '--review-artifact',
    ),
    approval,
    ...(flags.has('--board-registry-dir')
      ? {
          boardRegistryDir: requireFlag(
            flags,
            '--board-registry-dir',
          ),
        }
      : {}),
  });
  output({
    mode: 'approved_package_finalization_plan',
    zeroWrite: true,
    packageValue,
  });
}

function publicationPlan(tokens: string[]): void {
  const flags = parseFlags(tokens, PUBLICATION_FLAGS);
  const repoRoot = requireFlag(flags, '--repo-root');
  const packageValue = readJson<VisualPackageV4>(
    requireFlag(flags, '--package'),
  );
  assertValidVisualPackageV4(packageValue);
  const plan = publishVisualPackageV4({
    repoRoot,
    approvedPackagesDir: requireFlag(flags, '--approved-dir'),
    packageValue,
    write: false,
  });
  output({
    mode: 'immutable_publication_plan',
    zeroWrite: true,
    ...plan,
  });
}

async function main(): Promise<void> {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === 'readiness') return readiness(tokens);
  if (command === 'source-authoring-preflight') {
    return sourceAuthoringPreflight(tokens);
  }
  if (
    command ===
    'source-authoring-live-request-materialize'
  ) {
    return sourceAuthoringLiveRequestMaterialize(tokens);
  }
  if (
    command === 'source-authoring-live-request-verify'
  ) {
    return sourceAuthoringLiveRequestVerify(tokens);
  }
  if (command === 'context') return context(tokens);
  if (command === 'reconciliation-draft') {
    return reconciliationDraft(tokens);
  }
  if (command === 'authoring-preflight') {
    return authoringPreflight(tokens);
  }
  if (command === 'assemble-v4') return assembleV4(tokens);
  if (command === 'qualify-v4') return qualifyV4(tokens);
  if (command === 'finalize-plan') return finalizePlan(tokens);
  if (command === 'publication-plan') return publicationPlan(tokens);
  throw new Error(`unknown command: ${command}\n${usage()}`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
