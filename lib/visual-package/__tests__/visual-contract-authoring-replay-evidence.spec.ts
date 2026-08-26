import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import type {
  OfflineRepairHarnessResult,
} from '@/lib/visual-contract-compiler/offlineRepairHarness';
import type {
  ContractLlmCallOptions,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import {
  contractLlmCallOptionsIdentityDigest,
  projectContractLlmCallOptionsIdentity,
} from '@/lib/visual-contract-compiler/contractLlmCallOptionsIdentity';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  assertValidVisualContractAuthoringReplayEvidence,
  buildVisualContractAuthoringReplayEvidence,
  captureVisualContractAuthoringStructuredResponse,
  visualContractAuthoringReplayEvidenceIssues,
} from '@/lib/visual-package/visualContractAuthoringReplayEvidence';
import type {
  VisualContractAuthoringReceipt,
  VisualContractAuthoringRequest,
} from '@/lib/visual-package/visualContractAuthoringLifecycle';
import {
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  bindVisualContractAuthoringReplayEvidenceToReceipt,
} from '@/lib/visual-package/visualContractAuthoringLifecycle';
import {
  evaluateVisualContractAuthoringReplayCongruence,
} from '@/lib/visual-package/visualContractAuthoringReplayRunner';

const SOURCE_DIGEST = '4'.repeat(64);
const REQUEST_DIGEST = '5'.repeat(64);
const MAX_OUTPUT_TOKENS = 1_000;
const TEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pageContracts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { pageNumber: { type: 'integer' } },
        required: ['pageNumber'],
      },
    },
  },
  required: ['pageContracts'],
} as const;

function capturedOutput(args: {
  output?: string;
  schema?: Record<string, unknown>;
} = {}) {
  const output =
    args.output ??
    JSON.stringify({ pageContracts: [{ pageNumber: 1 }] });
  const schema = args.schema ?? TEST_SCHEMA;
  return captureVisualContractAuthoringStructuredResponse({
    attempt: 1,
    responseOutput: output,
    options: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      jsonSchema: {
        name: 'BookVisualContractTemplateDraft',
        schema,
      },
    },
    promptAuthority: {
      kind: 'initial',
      budgetClass: 'standard',
      systemPromptVersion: 'system/v1',
      userPromptVersion: 'user/v1',
    },
    systemPromptDigest: '1'.repeat(64),
    userPromptDigest: '2'.repeat(64),
    providerResponseDigest: canonicalJsonDigest(output),
  });
}

function requestForCapture(
  capture: NonNullable<ReturnType<typeof capturedOutput>>,
): VisualContractAuthoringRequest {
  return {
    digest: REQUEST_DIGEST,
    sourceSnapshotDigest: SOURCE_DIGEST,
    structuredOutput: {
      schemaName: capture.schemaName,
      schemaDigest: capture.schemaDigest,
    },
    promptAuthority: {
      initial: {
        systemPromptVersion: capture.systemPromptVersion,
        userPromptVersion: capture.userPromptVersion,
        systemPromptDigest: capture.systemPromptDigest,
        userPromptDigest: capture.userPromptDigest,
      },
    },
  } as unknown as VisualContractAuthoringRequest;
}

function receiptForCapture(
  capture: NonNullable<ReturnType<typeof capturedOutput>>,
): VisualContractAuthoringReceipt {
  return {
    requestDigest: REQUEST_DIGEST,
    sourceSnapshotDigest: SOURCE_DIGEST,
    status: 'failed',
    structuredDraftReplayEvidence: null,
    failure: { code: 'draft_validation_repair_exhausted' },
    digest: '3'.repeat(64),
    attempts: [
      {
        attempt: capture.attempt,
        kind: capture.kind,
        budgetClass: capture.budgetClass,
        repairMode: capture.repairMode,
        status: 'response_received',
        systemPromptDigest: capture.systemPromptDigest,
        userPromptDigest: capture.userPromptDigest,
        responseDigest: capture.providerResponseDigest,
        appliedMaxOutputTokens: MAX_OUTPUT_TOKENS,
        providerEvidenceVersion:
          OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
      },
    ],
  } as unknown as VisualContractAuthoringReceipt;
}

function terminalHarness(args: {
  outcome: OfflineRepairHarnessResult['outcome'];
  code: Exclude<
    OfflineRepairHarnessResult['terminalFailureCode'],
    null
  >;
  identityDigest: string | null;
}): OfflineRepairHarnessResult {
  return {
    version: 'visual-contract-offline-repair-harness-result/v2',
    executionMode: 'offline_stub',
    providerCalls: 0,
    outcome: args.outcome,
    candidateTemplateDigest: null,
    terminalFailureCode: args.code,
    terminalIssueDigest: null,
    terminalFailureIdentityDigest: args.identityDigest,
    terminalFailureIdentityComplete: true,
    calls: [],
    actionCoverageCensuses: [],
    stages: [],
    completeCensusCoverage: 'absent',
    monotonicCompleteIssueDelta: null,
    maxPositiveCompleteIssueDelta: null,
    finalSurfacedIssueCount: null,
    finalCompleteIssueCount: null,
  };
}

describe('Visual Contract authoring replay evidence', () => {
  it('binds every provider call-option field into one privacy-safe identity digest', () => {
    const base = {
      maxOutputTokens: 1_000,
      model: 'model-a',
      reasoningEffort: 'medium',
      jsonSchema: {
        name: 'BookVisualContractTemplateDraft',
        schema: TEST_SCHEMA,
      },
      noFallback: true,
      provider: 'openai',
      endpoint: 'responses',
      serviceTier: 'default',
      toolsDisabled: true,
      transportRetries: 0,
      timeoutMs: 120_000,
      maxInputTokens: 64_000,
    } satisfies ContractLlmCallOptions;
    const baseIdentity = projectContractLlmCallOptionsIdentity(base);
    expect(baseIdentity).not.toBeNull();
    const baseDigest = contractLlmCallOptionsIdentityDigest(
      baseIdentity!,
    );
    const variants: ContractLlmCallOptions[] = [
      { ...base, maxOutputTokens: 999 },
      { ...base, model: 'model-b' },
      { ...base, reasoningEffort: 'high' },
      {
        ...base,
        jsonSchema: { ...base.jsonSchema, name: 'OtherSchema' },
      },
      {
        ...base,
        jsonSchema: {
          ...base.jsonSchema,
          schema: {
            ...TEST_SCHEMA,
            required: [],
          },
        },
      },
      { ...base, noFallback: false },
      { ...base, provider: undefined },
      { ...base, endpoint: undefined },
      { ...base, serviceTier: undefined },
      { ...base, toolsDisabled: undefined },
      { ...base, transportRetries: 1 },
      { ...base, timeoutMs: 119_999 },
      { ...base, maxInputTokens: 63_999 },
    ];
    for (const variant of variants) {
      const identity = projectContractLlmCallOptionsIdentity(variant);
      expect(identity).not.toBeNull();
      expect(
        contractLlmCallOptionsIdentityDigest(identity!),
      ).not.toBe(baseDigest);
    }
    expect(
      projectContractLlmCallOptionsIdentity({
        ...base,
        hostileOption: true,
      } as ContractLlmCallOptions),
    ).toBeNull();
  });

  it('builds exact raw-response-bound evidence from closed-schema JSON', () => {
    const capture = capturedOutput();
    expect(capture).not.toBeNull();
    const request = requestForCapture(capture!);
    const receipt = receiptForCapture(capture!);
    const evidence = buildVisualContractAuthoringReplayEvidence({
      sourceSnapshotDigest: SOURCE_DIGEST,
      request,
      receipt,
      captures: [capture!],
    });

    expect(evidence).not.toBeNull();
    expect(() =>
      assertValidVisualContractAuthoringReplayEvidence({
        evidence: evidence!,
        sourceSnapshotDigest: SOURCE_DIGEST,
        request,
        receipt,
      }),
    ).not.toThrow();
    expect(evidence!.attempts[0]!.structuredOutput).toEqual({
      pageContracts: [{ pageNumber: 1 }],
    });
    expect(
      canonicalJsonDigest(evidence!.attempts[0]!.responseJson),
    ).toBe(receipt.attempts[0]!.responseDigest);
  });

  it('accepts a schema-owned prompt field and rejects undeclared transport or secret-shaped keys', () => {
    const promptSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        setReference: {
          type: 'object',
          additionalProperties: false,
          properties: { prompt: { type: ['string', 'null'] } },
          required: ['prompt'],
        },
      },
      required: ['setReference'],
    };
    expect(
      capturedOutput({
        output: JSON.stringify({
          setReference: { prompt: 'a lawful set description' },
        }),
        schema: promptSchema,
      }),
    ).not.toBeNull();
    for (const output of [
      { transportHeaders: { authorization: 'Bearer secret' } },
      { metadata: { api_token: 'secret' } },
      JSON.parse('{"__proto__":{"polluted":true}}') as unknown,
      { reasoning: ['hidden'] },
    ]) {
      expect(
        capturedOutput({ output: JSON.stringify(output) }),
      ).toBeNull();
    }
  });

  it('returns no sidecar when any accepted response is missing', () => {
    const capture = capturedOutput()!;
    const request = requestForCapture(capture);
    const receipt = receiptForCapture(capture);
    expect(
      buildVisualContractAuthoringReplayEvidence({
        sourceSnapshotDigest: SOURCE_DIGEST,
        request,
        receipt,
        captures: [],
      }),
    ).toBeNull();
  });

  it('preserves a captured response after the receipt marks its attempt as cost-ceiling-exceeded', () => {
    const capture = capturedOutput()!;
    const request = requestForCapture(capture);
    const receipt = receiptForCapture(capture);
    receipt.attempts[0]!.status = 'cost_ceiling_exceeded';
    receipt.failure = { code: 'cost_ceiling_exceeded' } as never;

    const evidence = buildVisualContractAuthoringReplayEvidence({
      sourceSnapshotDigest: SOURCE_DIGEST,
      request,
      receipt,
      captures: [capture],
    });

    expect(evidence).not.toBeNull();
    expect(evidence).toMatchObject({
      authoringStatus: 'failed',
      authoringFailureCode: 'cost_ceiling_exceeded',
      attempts: [expect.objectContaining({ attempt: 1 })],
    });
  });

  it('binds a receipt once, permits exact idempotence, and rejects rebinding', () => {
    const capture = capturedOutput()!;
    const receipt = receiptForCapture(capture);
    const digest = 'a'.repeat(64);
    const locator = {
      path:
        `outputs/replay/structured-draft-replay-evidence/${digest}.json`,
      digest,
    };
    const bound = bindVisualContractAuthoringReplayEvidenceToReceipt({
      receipt,
      ...locator,
    });
    expect(bound.structuredDraftReplayEvidence).toEqual({
      version: 'visual-contract-authoring-replay-evidence/v2',
      ...locator,
    });
    expect(
      bindVisualContractAuthoringReplayEvidenceToReceipt({
        receipt: bound,
        ...locator,
      }),
    ).toBe(bound);
    expect(() =>
      bindVisualContractAuthoringReplayEvidenceToReceipt({
        receipt: bound,
        path:
          `outputs/replay/structured-draft-replay-evidence/${'b'.repeat(64)}.json`,
        digest: 'b'.repeat(64),
      }),
    ).toThrow(/already bound/);
  });

  it.each([
    {
      label: 'a zero-attempt preflight receipt',
      receipt: {
        ...receiptForCapture(capturedOutput()!),
        status: 'preflight_passed',
        attempts: [],
        failure: null,
      } as unknown as VisualContractAuthoringReceipt,
    },
    {
      label: 'a provider-output-decode failure',
      receipt: {
        ...receiptForCapture(capturedOutput()!),
        failure: { code: 'provider_output_decode_failed' },
      } as unknown as VisualContractAuthoringReceipt,
    },
  ])('rejects phantom replay evidence for $label', ({ receipt }) => {
    expect(() =>
      bindVisualContractAuthoringReplayEvidenceToReceipt({
        receipt,
        path:
          `outputs/replay/structured-draft-replay-evidence/${'a'.repeat(64)}.json`,
        digest: 'a'.repeat(64),
      }),
    ).toThrow(/replay evidence is not required/);
  });

  it.each([
    `outputs\\replay\\structured-draft-replay-evidence\\${'a'.repeat(64)}.json`,
    `./outputs/replay/structured-draft-replay-evidence/${'a'.repeat(64)}.json`,
    `outputs//replay/structured-draft-replay-evidence/${'a'.repeat(64)}.json`,
    `outputs/replay/*/structured-draft-replay-evidence/${'a'.repeat(64)}.json`,
  ])('rejects a non-canonical replay locator path %s', (locatorPath) => {
    const receipt = receiptForCapture(capturedOutput()!);
    expect(() =>
      bindVisualContractAuthoringReplayEvidenceToReceipt({
        receipt,
        path: locatorPath,
        digest: 'a'.repeat(64),
      }),
    ).toThrow(/locator is invalid/);
  });

  it('rejects payload replacement, response, route and top-level tampering', () => {
    const capture = capturedOutput()!;
    const request = requestForCapture(capture);
    const receipt = receiptForCapture(capture);
    const evidence = buildVisualContractAuthoringReplayEvidence({
      sourceSnapshotDigest: SOURCE_DIGEST,
      request,
      receipt,
      captures: [capture],
    })!;
    const tampered = structuredClone(evidence) as typeof evidence & {
      extra?: boolean;
    };
    tampered.attempts[0]!.structuredOutput.pageContracts = [];
    tampered.attempts[0]!.responseJson = JSON.stringify({
      pageContracts: [{ pageNumber: 999 }],
    });
    tampered.attempts[0]!.schemaDigest = '9'.repeat(64);
    tampered.attempts[0]!.maxOutputTokens += 1;
    tampered.attempts[0]!.callOptionsDigest = '8'.repeat(64);
    (tampered.attempts[0] as typeof tampered.attempts[number] & {
      rawResponse?: string;
    }).rawResponse = 'must not survive validation';
    tampered.extra = true;

    expect(
      visualContractAuthoringReplayEvidenceIssues({
        evidence: tampered,
        sourceSnapshotDigest: SOURCE_DIGEST,
        request,
        receipt,
      }),
    ).toEqual([
      'replay_evidence_keys_invalid',
      'replay_evidence_binding_invalid',
    ]);
  });

  it('compares every replayable terminal failure family by exact outcome and typed identity', () => {
    const repairOutputDiagnostics = {
      version: 'visual-contract-repair-output-diagnostics/v5',
      repairAttempt: 2,
      repairMode: 'book_surface_patch',
      failureCode: 'schema_invalid',
      identity: 'book_surface_repair_output_invalid',
      targetContext: null,
      carriedDraftDiagnosticCount: 3,
    };
    const routeAdmissionDiagnostics = {
      version:
        'visual-contract-repair-route-admission-diagnostics/v2',
      repairAttempt: 2,
      repairMode: 'book_surface_patch',
      inputAccounting: {
        systemBytes: 1,
        userBytes: 2,
        schemaBytes: 3,
        separatorBytes: 2,
        protocolAllowance: 256,
        estimatedBytes: 264,
        ceiling: 128,
      },
      maxAdmissibleInputBytes: 128,
      carriedDraftDiagnosticCount: 3,
    };
    const authorityReferenceDiagnostics = {
      version: 'draft-authority-reference-diagnostics/v1',
      totalCount: 1,
      truncated: false,
      items: [
        {
          code: 'action_beat_id_outside_page_authority',
          locator: {
            kind: 'page_action',
            referenceClass: 'action_identity',
            fieldRole: 'actionRequirements.beatId',
            pageNumber: 1,
            actionIndex: 0,
          },
        },
      ],
    };
    const scenarios: Array<{
      code: Exclude<
        OfflineRepairHarnessResult['terminalFailureCode'],
        null
      >;
      outcome: OfflineRepairHarnessResult['outcome'];
      failure: Record<string, unknown>;
      actionSemanticCoverage?: Record<string, unknown>;
      identityDigest: string | null;
    }> = [
      {
        code: 'draft_validation_repair_exhausted',
        outcome: 'repair_exhausted',
        failure: { code: 'draft_validation_repair_exhausted' },
        identityDigest: null,
      },
      {
        code: 'draft_validation_repair_regressed',
        outcome: 'repair_regressed',
        failure: { code: 'draft_validation_repair_regressed' },
        identityDigest: null,
      },
      {
        code: 'draft_validation_repair_stagnated',
        outcome: 'repair_stagnated',
        failure: { code: 'draft_validation_repair_stagnated' },
        identityDigest: null,
      },
      {
        code: 'repair_output_invalid',
        outcome: 'repair_output_invalid',
        failure: {
          code: 'repair_output_invalid',
          repairOutputDiagnostics,
        },
        identityDigest: canonicalHash({
          kind: 'repair_output_invalid',
          repairAttempt: repairOutputDiagnostics.repairAttempt,
          repairMode: repairOutputDiagnostics.repairMode,
          failureCode: repairOutputDiagnostics.failureCode,
          identity: repairOutputDiagnostics.identity,
          targetContext: repairOutputDiagnostics.targetContext,
          carriedDraftDiagnosticCount:
            repairOutputDiagnostics.carriedDraftDiagnosticCount,
        }),
      },
      {
        code: 'repair_route_input_not_admissible',
        outcome: 'repair_route_not_admissible',
        failure: {
          code: 'repair_route_input_not_admissible',
          repairRouteAdmissionDiagnostics: routeAdmissionDiagnostics,
        },
        identityDigest: canonicalHash({
          kind: 'repair_route_input_not_admissible',
          repairAttempt: routeAdmissionDiagnostics.repairAttempt,
          repairMode: routeAdmissionDiagnostics.repairMode,
          inputAccounting: routeAdmissionDiagnostics.inputAccounting,
          maxAdmissibleInputBytes:
            routeAdmissionDiagnostics.maxAdmissibleInputBytes,
          carriedDraftDiagnosticCount:
            routeAdmissionDiagnostics.carriedDraftDiagnosticCount,
        }),
      },
      {
        code: 'draft_authority_reference_domain_invalid',
        outcome: 'invalid_draft',
        failure: {
          code: 'draft_authority_reference_domain_invalid',
          authorityReferenceDiagnostics,
        },
        identityDigest: canonicalHash({
          kind: 'draft_authority_reference_domain_invalid',
          authorityReferenceDiagnostics,
        }),
      },
      {
        code: 'action_semantic_capability_gap',
        outcome: 'invalid_draft',
        failure: { code: 'action_semantic_capability_gap' },
        actionSemanticCoverage: {
          status: 'capability_gap',
          gapCount: 2,
        },
        identityDigest: canonicalHash({
          kind: 'action_semantic_capability_gap',
          gapCount: 2,
        }),
      },
    ];

    for (const scenario of scenarios) {
      const receipt = {
        status: 'failed',
        failure: scenario.failure,
        candidateDigest: null,
        attempts: [],
        actionSemanticCoverage:
          scenario.actionSemanticCoverage ?? { status: 'not_run' },
      } as unknown as VisualContractAuthoringReceipt;
      const harness = terminalHarness(scenario);
      expect(
        evaluateVisualContractAuthoringReplayCongruence({
          receipt,
          harness,
        }),
      ).toEqual({
        receiptExpectedHarnessOutcome: scenario.outcome,
        receiptCandidateDigestCongruent: true,
        receiptFailureCodeCongruent: true,
        receiptFinalIssueCountCongruent: true,
        receiptFinalIssueDigestCongruent: true,
        receiptTerminalFailureIdentityCongruent: true,
        receiptOutcomeCongruent: true,
      });

      const hostileHarness = {
        ...harness,
        terminalFailureIdentityDigest: 'f'.repeat(64),
      };
      expect(
        evaluateVisualContractAuthoringReplayCongruence({
          receipt,
          harness: hostileHarness,
        }),
      ).toMatchObject({
        receiptTerminalFailureIdentityCongruent: false,
        receiptOutcomeCongruent: false,
      });
    }
  });
});
