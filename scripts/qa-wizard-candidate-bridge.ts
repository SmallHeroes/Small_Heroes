import fs from 'node:fs';

import {
  advanceQaWizardApprovedReconciliation,
  captureQaWizardCanonicalSupervisorResultEvidence,
  prepareQaWizardCandidateReconciliation,
  recordQaWizardReconciliationApproval,
  type AdvanceQaWizardApprovedReconciliationRequest,
  type CaptureQaWizardCanonicalSupervisorResultRequest,
  type PrepareQaWizardCandidateReconciliationRequest,
  type RecordQaWizardReconciliationApprovalRequest,
} from '@/lib/visual-package/qaWizardCandidateBridge';

type PrepareRequest = Omit<
  PrepareQaWizardCandidateReconciliationRequest,
  'outputDir' | 'write'
>;
type AdvanceRequest = Omit<
  AdvanceQaWizardApprovedReconciliationRequest,
  'outputDir' | 'write'
>;
type ApprovalRequest = Omit<
  RecordQaWizardReconciliationApprovalRequest,
  'outputDir' | 'write'
>;
type CaptureRequest = Omit<
  CaptureQaWizardCanonicalSupervisorResultRequest,
  'outputDir' | 'write'
>;

const ALLOWED_FLAGS = new Set(['--request', '--out', '--write']);

function usage(): string {
  return [
    'QA Wizard candidate bridge (deterministic QA authority tooling):',
    '  capture-supervisor-result --request <json> --out <repo-relative-dir> --write true|false',
    '  prepare-reconciliation --request <json> --out <repo-relative-dir> --write true|false',
    '  approve-reconciliation --request <json> --out <repo-relative-dir> --write true|false',
    '  advance-reconciliation --request <json> --out <repo-relative-dir> --write true|false',
    '',
    'This entrypoint never decides approval, loads credentials, invokes providers, renders images, publishes production authority, or deploys. The approval command records, but cannot authenticate, an exact-content decision explicitly supplied by Guy; automation must stop before that command until Guy has reviewed the exact digests.',
  ].join('\n');
}

function parseFlags(tokens: string[]): Map<string, string> {
  if (tokens.length % 2 !== 0) {
    throw new Error('invalid_arguments');
  }
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

function required(flags: ReadonlyMap<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) throw new Error('invalid_arguments');
  return value;
}

function writeValue(flags: ReadonlyMap<string, string>): boolean {
  const value = required(flags, '--write');
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('invalid_arguments');
}

function readRequest<T>(
  filePath: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): T {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
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

function closedReason(error: unknown): string {
  if (error instanceof Error && error.message === 'invalid_arguments') {
    return 'bridge_cli_arguments_invalid';
  }
  if (error instanceof Error && error.message === 'request_invalid') {
    return 'bridge_request_invalid';
  }
  return 'bridge_authority_validation_failed';
}

function execute(command: string, tokens: string[]): void {
  const flags = parseFlags(tokens);
  const outputDir = required(flags, '--out');
  const write = writeValue(flags);
  const requestPath = required(flags, '--request');
  if (command === 'capture-supervisor-result') {
    const artifact = captureQaWizardCanonicalSupervisorResultEvidence({
      ...readRequest<CaptureRequest>(requestPath, [
        'repoRoot',
        'supervisorResultSourcePath',
      ]),
      outputDir,
      write,
    });
    output({
      status: write
        ? 'canonical_supervisor_result_captured'
        : 'canonical_supervisor_result_capture_preview_ready',
      localImmutableWriteRequested: write,
      supervisorResultArtifact: artifact,
      bridgeBoundaryEvidence: {
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
  if (command === 'prepare-reconciliation') {
    const result = prepareQaWizardCandidateReconciliation({
      ...readRequest<PrepareRequest>(requestPath, [
        'repoRoot',
        'storyKey',
        'storyPath',
        'templatePath',
        'candidatePath',
        'authoringRequestPath',
        'authoringReceiptPath',
        'authoringReadinessPath',
        'freshReadinessPath',
        'supervisorExecutionRequestPath',
        'supervisorExecutionResultPath',
      ]),
      outputDir,
      write,
    });
    output({
      status: write
        ? 'awaiting_exact_reconciliation_content'
        : 'reconciliation_content_preview_ready',
      localImmutableWriteRequested: write,
      manifest: result.manifest,
      manifestArtifact: result.manifestArtifact,
      sourceSnapshotArtifact: result.sourceSnapshotArtifact,
      reconciliationArtifacts: result.reconciliationArtifacts,
      bridgeBoundaryEvidence: {
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
  if (command === 'advance-reconciliation') {
    const result = advanceQaWizardApprovedReconciliation({
      ...readRequest<AdvanceRequest>(
        requestPath,
        [
          'repoRoot',
          'bridgeManifestPath',
          'approvedReconciliationPath',
          'approvedReviewBundlePath',
          'approvedReviewMarkdownPath',
          'approvalAttestationPath',
          'styleId',
          'styleAuthorityPath',
        ],
        ['expectedStyleAuthorityDigest'],
      ),
      outputDir,
      write,
    });
    output({
      status: write
        ? 'ready_for_blueprint_preflight'
        : 'blueprint_preflight_preview_ready',
      localImmutableWriteRequested: write,
      manifest: result.manifest,
      manifestArtifact: result.manifestArtifact,
      productionContext: {
        version: result.context.version,
        digest: result.context.digest,
      },
      bridgeBoundaryEvidence: {
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
  if (command === 'approve-reconciliation') {
    const result = recordQaWizardReconciliationApproval({
      ...readRequest<ApprovalRequest>(requestPath, [
        'repoRoot',
        'pendingManifestPath',
        'approvedReconciliationPath',
        'approvedReviewBundlePath',
        'approvedReviewMarkdownPath',
        'approvedBy',
        'approvedAt',
      ]),
      outputDir,
      write,
    });
    output({
      status: write
        ? 'exact_reconciliation_approval_recorded'
        : 'exact_reconciliation_approval_preview_ready',
      localImmutableWriteRequested: write,
      approvalAttestation: result.attestation,
      approvalArtifact: result.artifact,
      approvedReconciliationArtifacts:
        result.approvedReconciliationArtifacts,
      bridgeBoundaryEvidence: {
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
      localImmutableWriteState: 'not_attested_after_rejection',
      reasonCodes: [closedReason(error)],
      bridgeBoundaryEvidence: {
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
