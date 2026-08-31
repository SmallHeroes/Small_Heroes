import fs from 'node:fs';

import {
  executeQaWizardBlueprintLiveRequest,
  prepareQaWizardBlueprintLiveRequest,
  recordQaWizardBlueprintApproval,
} from '@/lib/visual-package/qaWizardBlueprintAuthoringLifecycle';
import { createLazyLocalOpenAICredentialReader } from './lib/qa-wizard-blueprint-local-credential';

interface PrepareRequest {
  repoRoot: string;
  bridgeManifestPath: string;
  requestId: string;
  requestedAt: string;
}

interface ExecuteRequest {
  repoRoot: string;
  preflightManifestPath: string;
}

interface ApprovalRequest {
  repoRoot: string;
  candidateManifestPath: string;
  expectedBlueprintDigest: string;
  expectedAuthoringAuthorityDigest: string;
  expectedReviewPacketDigest: string;
  approvedBy: 'Guy';
  approvedAt: string;
  note?: string;
}

const ALLOWED_FLAGS = new Set([
  '--credential-file',
  '--request',
  '--out',
  '--write',
]);

function usage(): string {
  return [
    'QA Wizard Blueprint authoring operator:',
    '  prepare-live-request --request <json> --out <repo-relative-dir> --write true|false',
    '  execute-live --request <json> --out <repo-relative-dir> --credential-file <absolute-local-env-file> --write true',
    '  approve-blueprint --request <json> --out <repo-relative-dir> --write true|false',
    '',
    'The model, reasoning, token, call, retry, fallback, endpoint and credential policies are compiler-owned and cannot be overridden by this CLI.',
    'execute-live is the only paid boundary. It requires an immutable preflight manifest and an atomic process-restart single-use claim before the provider adapter and focused OPENAI_API_KEY credential source can load; abrupt host or power loss is not claimed as durable on Windows.',
  ].join('\n');
}

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

function required(flags: ReadonlyMap<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) throw new Error('invalid_arguments');
  return value;
}

function exactFlags(
  flags: ReadonlyMap<string, string>,
  expected: readonly string[],
): void {
  if (
    flags.size !== expected.length ||
    expected.some((flag) => !flags.has(flag))
  ) {
    throw new Error('invalid_arguments');
  }
}

function writeValue(flags: ReadonlyMap<string, string>): boolean {
  const value = required(flags, '--write');
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('invalid_arguments');
}

function readRequest<T>(args: {
  path: string;
  requiredKeys: readonly string[];
  optionalKeys?: readonly string[];
}): T {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(args.path, 'utf8')) as unknown;
  } catch {
    throw new Error('request_invalid');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request_invalid');
  }
  const keys = Object.keys(value);
  const allowed = new Set([
    ...args.requiredKeys,
    ...(args.optionalKeys ?? []),
  ]);
  if (
    args.requiredKeys.some((key) => !keys.includes(key)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new Error('request_invalid');
  }
  return value as T;
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function rejectionCode(error: unknown): string {
  if (!(error instanceof Error)) return 'blueprint_operator_failed';
  if (error.message === 'invalid_arguments') return 'operator_arguments_invalid';
  if (error.message === 'request_invalid') return 'operator_request_invalid';
  if (error.message === 'execution_state_uncertain') {
    return 'execution_state_uncertain';
  }
  if (error.message === 'execution_identity_already_claimed') {
    return 'execution_identity_already_claimed';
  }
  if (error.message === 'execution_identity_already_consumed') {
    return 'execution_identity_already_consumed';
  }
  return 'blueprint_authority_validation_failed';
}

function executionIncidentOutput(error: unknown):
  | { executionIncident: { path: string; phase: string } }
  | Record<string, never> {
  if (!(error instanceof Error) || error.message !== 'execution_state_uncertain') {
    return {};
  }
  const incident = error as Error & {
    incidentPath?: unknown;
    incidentPhase?: unknown;
  };
  if (
    typeof incident.incidentPath !== 'string' ||
    !incident.incidentPath.startsWith(
      'outputs/qa-wizard-blueprint-authoring-ledger-v1/execution-incidents/',
    ) ||
    !/^[a-z_]+$/.test(String(incident.incidentPhase ?? ''))
  ) {
    return {};
  }
  return {
    executionIncident: {
      path: incident.incidentPath,
      phase: String(incident.incidentPhase),
    },
  };
}

async function execute(command: string, tokens: string[]): Promise<void> {
  const flags = parseFlags(tokens);
  const requestPath = required(flags, '--request');
  const outputDir = required(flags, '--out');
  const write = writeValue(flags);
  if (command === 'prepare-live-request') {
    exactFlags(flags, ['--request', '--out', '--write']);
    const request = readRequest<PrepareRequest>({
      path: requestPath,
      requiredKeys: [
        'repoRoot',
        'bridgeManifestPath',
        'requestId',
        'requestedAt',
      ],
    });
    const result = prepareQaWizardBlueprintLiveRequest({
      ...request,
      outputDir,
      write,
    });
    output({
      status: write
        ? 'blueprint_live_request_preflight_persisted'
        : 'blueprint_live_request_preflight_preview_ready',
      localImmutableWriteRequested: write,
      request: {
        version: result.request.version,
        digest: result.manifest.request.digest,
        path: result.requestPath,
        requestId: result.request.requestId,
        requestedAt: result.request.requestedAt,
      },
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        audioCalls: 0,
        databaseWrites: 0,
        productionWrites: 0,
      },
    });
    return;
  }
  if (command === 'execute-live') {
    exactFlags(flags, [
      '--request',
      '--out',
      '--credential-file',
      '--write',
    ]);
    if (!write) throw new Error('invalid_arguments');
    const readCredential = createLazyLocalOpenAICredentialReader({
      credentialFilePath: required(flags, '--credential-file'),
    });
    const request = readRequest<ExecuteRequest>({
      path: requestPath,
      requiredKeys: ['repoRoot', 'preflightManifestPath'],
    });
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        ...request,
        outputDir,
        write: true,
      },
      {
        providerFactory: async () => {
          const adapter = await import(
            '@/lib/visual-package/openaiResponsesBlueprintAuthoringAdapter'
          );
          return adapter.createOpenAIResponsesBlueprintAuthoringAdapter({
            readCredential,
          });
        },
        inputTokenCounterFactory: async () => {
          const adapter = await import(
            '@/lib/visual-package/openaiResponsesBlueprintAuthoringCountAdapter'
          );
          return adapter.createOpenAIResponsesBlueprintAuthoringCountAdapter({
            readCredential,
          });
        },
      },
    );
    output({
      status:
        result.manifest.stage === 'blueprint_candidate'
          ? 'blueprint_candidate_ready_for_exact_review'
          : 'blueprint_authoring_failed_terminally',
      replayed: result.replayed,
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      receipt: {
        version: result.receipt.version,
        status: result.receipt.status,
        digest: result.receipt.digest,
        path: result.receiptPath,
        callCount: result.receipt.callCount,
        repairCount: result.receipt.repairCount,
      },
      blueprint: result.manifest.blueprint,
      claimPath: result.claimPath,
      terminalLookupPath: result.executionRecordPath,
    });
    return;
  }
  if (command === 'approve-blueprint') {
    exactFlags(flags, ['--request', '--out', '--write']);
    const request = readRequest<ApprovalRequest>({
      path: requestPath,
      requiredKeys: [
        'repoRoot',
        'candidateManifestPath',
        'expectedBlueprintDigest',
        'expectedAuthoringAuthorityDigest',
        'expectedReviewPacketDigest',
        'approvedBy',
        'approvedAt',
      ],
      optionalKeys: ['note'],
    });
    const result = recordQaWizardBlueprintApproval({
      ...request,
      outputDir,
      write,
    });
    output({
      status: write
        ? 'exact_blueprint_approval_recorded'
        : 'exact_blueprint_approval_preview_ready',
      localImmutableWriteRequested: write,
      manifest: {
        version: result.manifest.version,
        stage: result.manifest.stage,
        digest: result.manifest.digest,
        path: result.manifestPath,
      },
      approval: {
        version: result.attestation.version,
        digest: result.attestation.digest,
        path: result.approvalPath,
        approvedBy: result.attestation.approvedBy,
        approvedAt: result.attestation.approvedAt,
      },
    });
    return;
  }
  throw new Error('invalid_arguments');
}

async function main(): Promise<void> {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    await execute(command, tokens);
  } catch (error) {
    output({
      status: 'rejected',
      localImmutableWriteState: 'not_attested_after_rejection',
      reasonCodes: [rejectionCode(error)],
      ...executionIncidentOutput(error),
    });
    process.exitCode = 1;
  }
}

void main();
