import type {
  ContractLlmCallOptions,
  ContractLlmPromptAuthority,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  CONTRACT_LLM_CALL_OPTIONS_IDENTITY_VERSION,
  contractLlmCallOptionsIdentityDigest,
  projectContractLlmCallOptionsIdentity,
} from '@/lib/visual-contract-compiler/contractLlmCallOptionsIdentity';

import { canonicalJsonDigest } from './integrity';
import type {
  VisualContractAuthoringAttemptReceipt,
  VisualContractAuthoringReceipt,
  VisualContractAuthoringRequest,
} from './visualContractAuthoringLifecycle';

export const VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION =
  'visual-contract-authoring-replay-evidence/v2' as const;

const REPLAY_EVIDENCE_DOES_NOT_AUTHORIZE = [
  'provider retry or another paid authoring call',
  'Visual Contract Candidate acceptance',
  'Wizard publication or product sellability',
  'image, audio, page or book rendering',
] as const;

const STRUCTURED_RESPONSE_CAPTURE_KEYS = [
  'attempt',
  'kind',
  'budgetClass',
  'repairMode',
  'schemaName',
  'schemaDigest',
  'systemPromptVersion',
  'userPromptVersion',
  'systemPromptDigest',
  'userPromptDigest',
  'providerResponseDigest',
  'maxOutputTokens',
  'callOptionsDigest',
  'payloadDigest',
  'responseJson',
  'structuredOutput',
] as const;

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export interface VisualContractAuthoringStructuredResponseCapture {
  attempt: number;
  kind: 'initial' | 'repair';
  budgetClass: 'standard' | 'terminal_reference_cleanup';
  repairMode: VisualContractAuthoringAttemptReceipt['repairMode'];
  schemaName: string;
  schemaDigest: string;
  systemPromptVersion: string;
  userPromptVersion: string;
  systemPromptDigest: string;
  userPromptDigest: string;
  providerResponseDigest: string;
  maxOutputTokens: number;
  callOptionsDigest: string;
  payloadDigest: string;
  responseJson: string;
  structuredOutput: Record<string, unknown>;
}

export interface VisualContractAuthoringReplayEvidence {
  version: typeof VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION;
  sourceSnapshotDigest: string;
  authoringRequestDigest: string;
  authoringStatus: VisualContractAuthoringReceipt['status'];
  authoringFailureCode: string | null;
  captureCoverage: 'complete_structured_responses';
  attempts: VisualContractAuthoringStructuredResponseCapture[];
  doesNotAuthorize: string[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export function visualContractAuthoringAttemptHasCapturedResponse(
  attempt: VisualContractAuthoringAttemptReceipt,
): boolean {
  return (
    attempt.status === 'response_received' ||
    attempt.status === 'cost_ceiling_exceeded'
  );
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jsonValueEquals(left: unknown, right: unknown): boolean {
  return canonicalJsonDigest(left) === canonicalJsonDigest(right);
}

function resolveLocalSchemaRef(
  root: Record<string, unknown>,
  ref: unknown,
): Record<string, unknown> | null {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  let current: unknown = root;
  for (const rawToken of ref.slice(2).split('/')) {
    const token = rawToken.replace(/~1/g, '/').replace(/~0/g, '~');
    const record = recordValue(current);
    if (!record || !Object.prototype.hasOwnProperty.call(record, token)) {
      return null;
    }
    current = record[token];
  }
  return recordValue(current);
}

function valueMatchesClosedSchemaShape(args: {
  value: unknown;
  schema: unknown;
  root: Record<string, unknown>;
  depth?: number;
}): boolean {
  const depth = args.depth ?? 0;
  if (depth > 128) return false;
  const schema = recordValue(args.schema);
  if (!schema) return false;
  if (schema.$ref !== undefined) {
    const resolved = resolveLocalSchemaRef(args.root, schema.$ref);
    return (
      resolved !== null &&
      valueMatchesClosedSchemaShape({
        value: args.value,
        schema: resolved,
        root: args.root,
        depth: depth + 1,
      })
    );
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.every((candidate) =>
      valueMatchesClosedSchemaShape({
        value: args.value,
        schema: candidate,
        root: args.root,
        depth: depth + 1,
      }),
    );
  }
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((candidate) =>
      valueMatchesClosedSchemaShape({
        value: args.value,
        schema: candidate,
        root: args.root,
        depth: depth + 1,
      }),
    );
  }
  if (Array.isArray(schema.oneOf)) {
    return (
      schema.oneOf.filter((candidate) =>
        valueMatchesClosedSchemaShape({
          value: args.value,
          schema: candidate,
          root: args.root,
          depth: depth + 1,
        }),
      ).length === 1
    );
  }
  if (
    schema.const !== undefined &&
    !jsonValueEquals(args.value, schema.const)
  ) {
    return false;
  }
  if (
    Array.isArray(schema.enum) &&
    !schema.enum.some((candidate) =>
      jsonValueEquals(args.value, candidate),
    )
  ) {
    return false;
  }
  const types = Array.isArray(schema.type)
    ? schema.type
    : [schema.type];
  const typeMatches = (type: unknown): boolean => {
    if (type === 'null') return args.value === null;
    if (type === 'string') return typeof args.value === 'string';
    if (type === 'boolean') return typeof args.value === 'boolean';
    if (type === 'number') {
      return typeof args.value === 'number' && Number.isFinite(args.value);
    }
    if (type === 'integer') return Number.isSafeInteger(args.value);
    if (type === 'array') return Array.isArray(args.value);
    if (type === 'object') return recordValue(args.value) !== null;
    return type === undefined;
  };
  if (!types.some(typeMatches)) return false;
  if (Array.isArray(args.value)) {
    return args.value.every((entry) =>
      valueMatchesClosedSchemaShape({
        value: entry,
        schema: schema.items,
        root: args.root,
        depth: depth + 1,
      }),
    );
  }
  const valueRecord = recordValue(args.value);
  if (!valueRecord) return true;
  const properties = recordValue(schema.properties);
  if (!properties || schema.additionalProperties !== false) return false;
  const required = Array.isArray(schema.required)
    ? schema.required
    : [];
  if (
    required.some(
      (key) =>
        typeof key !== 'string' ||
        !Object.prototype.hasOwnProperty.call(valueRecord, key),
    ) ||
    Object.keys(valueRecord).some(
      (key) => !Object.prototype.hasOwnProperty.call(properties, key),
    )
  ) {
    return false;
  }
  return Object.entries(valueRecord).every(([key, value]) =>
    valueMatchesClosedSchemaShape({
      value,
      schema: properties[key],
      root: args.root,
      depth: depth + 1,
    }),
  );
}

function structuredResponseCaptureIsValid(
  capture: VisualContractAuthoringStructuredResponseCapture,
): boolean {
  const value = recordValue(capture);
  const output = recordValue(capture.structuredOutput);
  let parsedResponse: Record<string, unknown> | null = null;
  try {
    parsedResponse = recordValue(JSON.parse(capture.responseJson));
  } catch {
    parsedResponse = null;
  }
  return (
    value !== null &&
    exactKeys(value, STRUCTURED_RESPONSE_CAPTURE_KEYS) &&
    Number.isSafeInteger(capture.attempt) &&
    capture.attempt > 0 &&
    (capture.kind === 'initial' || capture.kind === 'repair') &&
    (capture.kind === 'initial'
      ? capture.repairMode === null &&
        capture.budgetClass === 'standard'
      : typeof capture.repairMode === 'string' &&
        capture.repairMode.length > 0) &&
    (capture.budgetClass === 'standard' ||
      capture.budgetClass === 'terminal_reference_cleanup') &&
    typeof capture.schemaName === 'string' &&
    capture.schemaName.length > 0 &&
    typeof capture.systemPromptVersion === 'string' &&
    capture.systemPromptVersion.length > 0 &&
    typeof capture.userPromptVersion === 'string' &&
    capture.userPromptVersion.length > 0 &&
    DIGEST_PATTERN.test(capture.schemaDigest) &&
    DIGEST_PATTERN.test(capture.systemPromptDigest) &&
    DIGEST_PATTERN.test(capture.userPromptDigest) &&
    DIGEST_PATTERN.test(capture.providerResponseDigest) &&
    Number.isSafeInteger(capture.maxOutputTokens) &&
    capture.maxOutputTokens > 0 &&
    DIGEST_PATTERN.test(capture.callOptionsDigest) &&
    DIGEST_PATTERN.test(capture.payloadDigest) &&
    typeof capture.responseJson === 'string' &&
    capture.responseJson.length > 0 &&
    output !== null &&
    parsedResponse !== null &&
    canonicalJsonDigest(capture.responseJson) ===
      capture.providerResponseDigest &&
    canonicalJsonDigest(output) === capture.payloadDigest &&
    jsonValueEquals(output, parsedResponse)
  );
}

export function captureVisualContractAuthoringStructuredResponse(args: {
  attempt: number;
  responseOutput: string;
  options: ContractLlmCallOptions;
  promptAuthority: ContractLlmPromptAuthority;
  systemPromptDigest: string;
  userPromptDigest: string;
  providerResponseDigest: string;
}): VisualContractAuthoringStructuredResponseCapture | null {
  let structuredOutput: Record<string, unknown> | null = null;
  const callOptionsIdentity =
    projectContractLlmCallOptionsIdentity(args.options);
  try {
    structuredOutput = recordValue(
      JSON.parse(args.responseOutput) as unknown,
    );
  } catch {
    structuredOutput = null;
  }
  if (
    !structuredOutput ||
    !callOptionsIdentity ||
    !args.options.jsonSchema?.name ||
    !args.options.jsonSchema.schema ||
    !Number.isSafeInteger(args.options.maxOutputTokens) ||
    (args.options.maxOutputTokens ?? 0) < 1 ||
    canonicalJsonDigest(args.responseOutput) !==
      args.providerResponseDigest ||
    !valueMatchesClosedSchemaShape({
      value: structuredOutput,
      schema: args.options.jsonSchema.schema,
      root: args.options.jsonSchema.schema,
    })
  ) {
    return null;
  }
  return {
    attempt: args.attempt,
    kind: args.promptAuthority.kind,
    budgetClass: args.promptAuthority.budgetClass,
    repairMode:
      args.promptAuthority.kind === 'repair'
        ? args.promptAuthority.repairMode
        : null,
    schemaName: args.options.jsonSchema.name,
    schemaDigest: canonicalJsonDigest(
      args.options.jsonSchema.schema,
    ),
    systemPromptVersion:
      args.promptAuthority.systemPromptVersion,
    userPromptVersion:
      args.promptAuthority.userPromptVersion,
    systemPromptDigest: args.systemPromptDigest,
    userPromptDigest: args.userPromptDigest,
    providerResponseDigest: args.providerResponseDigest,
    maxOutputTokens: args.options.maxOutputTokens!,
    callOptionsDigest:
      contractLlmCallOptionsIdentityDigest(callOptionsIdentity),
    payloadDigest: canonicalJsonDigest(structuredOutput),
    responseJson: args.responseOutput,
    structuredOutput: structuredClone(structuredOutput),
  };
}

function requestCallIdentity(args: {
  request: VisualContractAuthoringRequest;
  attempt: VisualContractAuthoringAttemptReceipt;
}): {
  schemaName: string;
  schemaDigest: string;
  systemPromptVersion: string;
  userPromptVersion: string;
  systemPromptDigest: string;
  userPromptDigest: string;
  maxOutputTokens: number;
  callOptionsDigest: string;
} | null {
  const { request, attempt } = args;
  let structuredOutput: {
    schemaName: string;
    schemaDigest: string;
  };
  let promptAuthority: {
    systemPromptVersion: string;
    userPromptVersion: string;
    systemPromptDigest: string;
  };
  if (attempt.kind === 'initial' && attempt.repairMode === null) {
    structuredOutput = request.structuredOutput;
    promptAuthority = request.promptAuthority.initial;
  } else if (attempt.kind === 'repair') {
    switch (attempt.repairMode) {
      case 'full_draft':
        structuredOutput = request.structuredOutput;
        promptAuthority = request.promptAuthority.repair;
        break;
      case 'source_evidence_id_patch':
        structuredOutput = request.compactRepairStructuredOutput;
        promptAuthority = request.promptAuthority.sourceEvidenceIdRepair;
        break;
      case 'page_contract_patch':
        structuredOutput = request.pageContractRepairStructuredOutput;
        promptAuthority = request.promptAuthority.pageContractRepair;
        break;
      case 'represented_elsewhere_patch':
        structuredOutput =
          request.representedElsewhereRepairStructuredOutput;
        promptAuthority =
          request.promptAuthority.representedElsewhereRepair;
        break;
      case 'page_spatial_reference_patch':
        structuredOutput =
          request.pageSpatialReferenceRepairStructuredOutput;
        promptAuthority =
          request.promptAuthority.pageSpatialReferenceRepair;
        break;
      case 'stable_prop_scope_patch':
        structuredOutput = request.stablePropScopeRepairStructuredOutput;
        promptAuthority = request.promptAuthority.stablePropScopeRepair;
        break;
      case 'presentation_requirement_patch':
        structuredOutput =
          request.presentationRequirementRepairStructuredOutput;
        promptAuthority =
          request.promptAuthority.presentationRequirementRepair;
        break;
      case 'structural_bundle_patch':
        structuredOutput = request.structuralBundleRepairStructuredOutput;
        promptAuthority = request.promptAuthority.structuralBundleRepair;
        break;
      case 'book_surface_patch':
        structuredOutput = request.bookSurfaceRepairStructuredOutput;
        promptAuthority = request.promptAuthority.bookSurfaceRepair;
        break;
      default:
        return null;
    }
  } else {
    return null;
  }
  const maxInputTokens =
    attempt.budgetClass === 'terminal_reference_cleanup'
      ? request.callBudget?.terminalReferenceCleanup
          ?.maxInputTokens ?? null
      : request.tokenBudget?.maxInputTokens ?? null;
  const callOptionsDigest =
    contractLlmCallOptionsIdentityDigest({
      version: CONTRACT_LLM_CALL_OPTIONS_IDENTITY_VERSION,
      maxOutputTokens: attempt.appliedMaxOutputTokens,
      model: request.model ?? null,
      reasoningEffort: request.reasoningEffort ?? null,
      schemaName: structuredOutput.schemaName,
      schemaDigest: structuredOutput.schemaDigest,
      noFallback: request.noFallback ?? null,
      provider: request.provider ?? null,
      endpoint: request.endpoint ?? null,
      serviceTier: request.serviceTier ?? null,
      toolsDisabled: request.toolsDisabled ?? null,
      transportRetries: request.transportRetries ?? null,
      timeoutMs: request.timeoutMs ?? null,
      maxInputTokens,
    });
  return {
    schemaName: structuredOutput.schemaName,
    schemaDigest: structuredOutput.schemaDigest,
    systemPromptVersion: promptAuthority.systemPromptVersion,
    userPromptVersion: promptAuthority.userPromptVersion,
    systemPromptDigest: promptAuthority.systemPromptDigest,
    userPromptDigest: attempt.userPromptDigest,
    maxOutputTokens: attempt.appliedMaxOutputTokens,
    callOptionsDigest,
  };
}

export function buildVisualContractAuthoringReplayEvidence(args: {
  sourceSnapshotDigest: string;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
  captures: readonly VisualContractAuthoringStructuredResponseCapture[];
}): VisualContractAuthoringReplayEvidence | null {
  const acceptedAttempts = args.receipt.attempts.filter(
    visualContractAuthoringAttemptHasCapturedResponse,
  );
  if (
    args.request.digest !== args.receipt.requestDigest ||
    args.request.sourceSnapshotDigest !== args.sourceSnapshotDigest ||
    acceptedAttempts.length === 0 ||
    !Array.isArray(args.captures) ||
    acceptedAttempts.length !== args.captures.length ||
    acceptedAttempts.some((attempt, index) => {
      const capture = args.captures[index];
      const expected = requestCallIdentity({
        request: args.request,
        attempt,
      });
      return (
        !capture ||
        !expected ||
        !structuredResponseCaptureIsValid(capture) ||
        capture.attempt !== attempt.attempt ||
        capture.kind !== attempt.kind ||
        capture.budgetClass !== attempt.budgetClass ||
        capture.repairMode !== attempt.repairMode ||
        capture.systemPromptDigest !==
          attempt.systemPromptDigest ||
        capture.userPromptDigest !== attempt.userPromptDigest ||
        capture.providerResponseDigest !== attempt.responseDigest ||
        capture.schemaName !== expected.schemaName ||
        capture.schemaDigest !== expected.schemaDigest ||
        capture.systemPromptVersion !==
          expected.systemPromptVersion ||
        capture.userPromptVersion !== expected.userPromptVersion ||
        capture.systemPromptDigest !==
          expected.systemPromptDigest ||
        capture.userPromptDigest !== expected.userPromptDigest ||
        capture.maxOutputTokens !== expected.maxOutputTokens ||
        capture.callOptionsDigest !== expected.callOptionsDigest ||
        canonicalJsonDigest(capture.responseJson) !==
          attempt.responseDigest ||
        capture.payloadDigest !==
          canonicalJsonDigest(capture.structuredOutput) ||
        !jsonValueEquals(
          JSON.parse(capture.responseJson),
          capture.structuredOutput,
        )
      );
    })
  ) {
    return null;
  }
  const withoutDigest = {
    version: VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION,
    sourceSnapshotDigest: args.sourceSnapshotDigest,
    authoringRequestDigest: args.request.digest,
    authoringStatus: args.receipt.status,
    authoringFailureCode: args.receipt.failure?.code ?? null,
    captureCoverage: 'complete_structured_responses' as const,
    attempts: [...structuredClone(args.captures)],
    doesNotAuthorize: [...REPLAY_EVIDENCE_DOES_NOT_AUTHORIZE],
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(withoutDigest),
  };
}

export function visualContractAuthoringReplayEvidenceIssues(args: {
  evidence: VisualContractAuthoringReplayEvidence;
  sourceSnapshotDigest: string;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
}): string[] {
  const issues: string[] = [];
  const evidence = args.evidence;
  if (
    !exactKeys(evidence as unknown as Record<string, unknown>, [
      'version',
      'sourceSnapshotDigest',
      'authoringRequestDigest',
      'authoringStatus',
      'authoringFailureCode',
      'captureCoverage',
      'attempts',
      'doesNotAuthorize',
      'digestAlgorithm',
      'digest',
    ])
  ) {
    issues.push('replay_evidence_keys_invalid');
  }
  const attempts = Array.isArray(evidence.attempts)
    ? evidence.attempts
    : [];
  const rebuilt = buildVisualContractAuthoringReplayEvidence({
    sourceSnapshotDigest: args.sourceSnapshotDigest,
    request: args.request,
    receipt: args.receipt,
    captures: attempts,
  });
  if (
    evidence.version !==
      VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION ||
    evidence.sourceSnapshotDigest !== args.sourceSnapshotDigest ||
    evidence.authoringRequestDigest !== args.request.digest ||
    evidence.authoringStatus !== args.receipt.status ||
    evidence.authoringFailureCode !==
      (args.receipt.failure?.code ?? null) ||
    evidence.captureCoverage !== 'complete_structured_responses' ||
    evidence.digestAlgorithm !== 'canonical-json-sha256' ||
    !rebuilt ||
    evidence.digest !== rebuilt.digest ||
    canonicalJsonDigest(evidence.attempts) !==
      canonicalJsonDigest(rebuilt.attempts) ||
    JSON.stringify(evidence.doesNotAuthorize) !==
      JSON.stringify(REPLAY_EVIDENCE_DOES_NOT_AUTHORIZE)
  ) {
    issues.push('replay_evidence_binding_invalid');
  }
  return [...new Set(issues)];
}

export function assertValidVisualContractAuthoringReplayEvidence(args: {
  evidence: VisualContractAuthoringReplayEvidence;
  sourceSnapshotDigest: string;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
}): void {
  const issues = visualContractAuthoringReplayEvidenceIssues(args);
  if (issues.length > 0) {
    throw new Error(
      `Invalid Visual Contract authoring replay evidence:\n- ${issues.join('\n- ')}`,
    );
  }
}
