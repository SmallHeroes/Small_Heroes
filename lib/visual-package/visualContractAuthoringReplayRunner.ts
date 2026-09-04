import {
  LEGACY_VISUAL_CONTRACT_AUTHORING_ROUTING_POLICY_VERSION,
  VISUAL_CONTRACT_AUTHORING_ROUTING_POLICY_VERSION,
  type VisualContractAuthoringRoutingPolicyVersion,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import {
  runOfflineRepairHarness,
  type OfflineRepairHarnessResult,
} from '@/lib/visual-contract-compiler/offlineRepairHarness';
import { canonicalHash } from '@/lib/canonical-json';

import {
  assertValidStorySourceAuthoritySnapshot,
  storySourceSnapshotToTemplateInput,
  type StorySourceAuthoritySnapshot,
} from './storySourceAuthority';
import {
  LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V58,
  LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V55,
  VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION,
  VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION,
  assertValidLegacyVisualContractAuthoringReplayArtifacts,
  persistVisualContractAuthoringReceipt,
  visualContractAuthoringRequestIssues,
  type VisualContractAuthoringReceipt,
  type VisualContractAuthoringRequest,
} from './visualContractAuthoringLifecycle';
import {
  VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION,
  assertValidVisualContractAuthoringReplayEvidence,
  visualContractAuthoringAttemptHasCapturedResponse,
  type VisualContractAuthoringReplayEvidence,
} from './visualContractAuthoringReplayEvidence';

export const VISUAL_CONTRACT_AUTHORING_REPLAY_RESULT_VERSION =
  'visual-contract-authoring-replay-result/v2' as const;

export interface VisualContractAuthoringReplayResult {
  version: typeof VISUAL_CONTRACT_AUTHORING_REPLAY_RESULT_VERSION;
  executionMode: 'offline_captured_structured_responses';
  providerCalls: 0;
  exactCapturedCallSequence: boolean;
  receiptExpectedHarnessOutcome:
    | OfflineRepairHarnessResult['outcome']
    | null;
  receiptCandidateDigestCongruent: boolean;
  receiptFailureCodeCongruent: boolean;
  receiptFinalIssueCountCongruent: boolean;
  receiptFinalIssueDigestCongruent: boolean;
  receiptTerminalFailureIdentityCongruent: boolean;
  receiptOutcomeCongruent: boolean;
  harness: OfflineRepairHarnessResult;
}

function runtimeStringField(
  value: unknown,
  field: string,
): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === 'string' ? candidate : null;
}

export type VisualContractAuthoringReplayCongruence = Pick<
  VisualContractAuthoringReplayResult,
  | 'receiptExpectedHarnessOutcome'
  | 'receiptCandidateDigestCongruent'
  | 'receiptFailureCodeCongruent'
  | 'receiptFinalIssueCountCongruent'
  | 'receiptFinalIssueDigestCongruent'
  | 'receiptTerminalFailureIdentityCongruent'
  | 'receiptOutcomeCongruent'
>;

function receiptTerminalFailureIdentity(
  receipt: VisualContractAuthoringReceipt,
): {
  digest: string | null;
  complete: boolean;
} {
  if (receipt.status === 'completed') {
    return { digest: null, complete: true };
  }
  const failure = receipt.failure;
  switch (failure?.code) {
    case 'draft_validation_repair_exhausted':
    case 'draft_validation_repair_regressed':
    case 'draft_validation_repair_stagnated':
      return { digest: null, complete: true };
    case 'repair_output_invalid': {
      const diagnostics = failure.repairOutputDiagnostics;
      if (
        !diagnostics ||
        diagnostics.version !==
          'visual-contract-repair-output-diagnostics/v5'
      ) {
        return { digest: null, complete: false };
      }
      return {
        digest: canonicalHash({
          kind: 'repair_output_invalid',
          repairAttempt: diagnostics.repairAttempt,
          repairMode: diagnostics.repairMode,
          failureCode: diagnostics.failureCode,
          identity: diagnostics.identity,
          targetContext: diagnostics.targetContext,
          carriedDraftDiagnosticCount:
            diagnostics.carriedDraftDiagnosticCount,
        }),
        complete: true,
      };
    }
    case 'repair_route_input_not_admissible': {
      const diagnostics = failure.repairRouteAdmissionDiagnostics;
      if (
        !diagnostics ||
        diagnostics.version !==
          'visual-contract-repair-route-admission-diagnostics/v3'
      ) {
        return { digest: null, complete: false };
      }
      return {
        digest: canonicalHash({
          kind: 'repair_route_input_not_admissible',
          repairAttempt: diagnostics.repairAttempt,
          repairMode: diagnostics.repairMode,
          inputAccounting: diagnostics.inputAccounting,
          maxAdmissibleInputBytes:
            diagnostics.maxAdmissibleInputBytes,
          carriedDraftDiagnosticCount:
            diagnostics.carriedDraftDiagnosticCount,
        }),
        complete: true,
      };
    }
    case 'draft_authority_reference_domain_invalid': {
      const diagnostics = failure.authorityReferenceDiagnostics;
      if (!diagnostics || diagnostics.truncated) {
        return { digest: null, complete: false };
      }
      return {
        digest: canonicalHash({
          kind: 'draft_authority_reference_domain_invalid',
          authorityReferenceDiagnostics: diagnostics,
        }),
        complete: true,
      };
    }
    case 'action_semantic_capability_gap':
      return receipt.actionSemanticCoverage.status === 'capability_gap'
        ? {
            digest: canonicalHash({
              kind: 'action_semantic_capability_gap',
              gapCount: receipt.actionSemanticCoverage.gapCount,
            }),
            complete: true,
          }
        : { digest: null, complete: false };
    default:
      return { digest: null, complete: false };
  }
}

function receiptFinalIssueIdentity(
  receipt: VisualContractAuthoringReceipt,
): {
  count: number;
  digest: string | null;
  complete: boolean;
} | null {
  for (let index = receipt.attempts.length - 1; index >= 0; index -= 1) {
    const diagnostics =
      receipt.attempts[index]?.draftValidationDiagnostics;
    if (diagnostics) {
      const currentIssues = diagnostics.items
        .filter((item) => item.state !== 'resolved')
        .map((item) => structuredClone(item.issue));
      return {
        count: diagnostics.currentUniqueCount,
        digest:
          currentIssues.length > 0
            ? canonicalHash(currentIssues)
            : null,
        complete:
          !diagnostics.truncated &&
          currentIssues.length === diagnostics.currentUniqueCount,
      };
    }
  }
  return null;
}

function expectedHarnessOutcome(
  receipt: VisualContractAuthoringReceipt,
): OfflineRepairHarnessResult['outcome'] | null {
  if (receipt.status === 'completed') return 'candidate';
  switch (receipt.failure?.code) {
    case 'draft_validation_repair_exhausted':
      return 'repair_exhausted';
    case 'draft_validation_repair_regressed':
      return 'repair_regressed';
    case 'draft_validation_repair_stagnated':
      return 'repair_stagnated';
    case 'repair_output_invalid':
      return 'repair_output_invalid';
    case 'repair_route_input_not_admissible':
      return 'repair_route_not_admissible';
    case 'draft_authority_reference_domain_invalid':
    case 'action_semantic_capability_gap':
      return 'invalid_draft';
    default:
      return null;
  }
}

export function evaluateVisualContractAuthoringReplayCongruence(args: {
  receipt: VisualContractAuthoringReceipt;
  harness: OfflineRepairHarnessResult;
}): VisualContractAuthoringReplayCongruence {
  const { receipt, harness } = args;
  const receiptExpectedHarnessOutcome =
    expectedHarnessOutcome(receipt);
  const receiptCandidateDigestCongruent =
    receipt.status !== 'completed'
      ? harness.candidateTemplateDigest === null
      : harness.candidateTemplateDigest !== null &&
        harness.candidateTemplateDigest === receipt.candidateDigest;
  const receiptFailureCodeCongruent =
    receipt.status === 'completed'
      ? harness.terminalFailureCode === null
      : harness.terminalFailureCode !== null &&
        harness.terminalFailureCode === receipt.failure?.code;
  const expectedFinalIssueIdentity =
    receiptFinalIssueIdentity(receipt);
  const receiptFinalIssueCountCongruent =
    expectedFinalIssueIdentity === null
      ? true
      : harness.finalSurfacedIssueCount ===
        expectedFinalIssueIdentity.count;
  const receiptFinalIssueDigestCongruent =
    expectedFinalIssueIdentity === null
      ? harness.terminalIssueDigest === null
      : expectedFinalIssueIdentity.complete &&
        harness.terminalIssueDigest ===
          expectedFinalIssueIdentity.digest;
  const expectedTerminalFailureIdentity =
    receiptTerminalFailureIdentity(receipt);
  const receiptTerminalFailureIdentityCongruent =
    expectedTerminalFailureIdentity.complete &&
    harness.terminalFailureIdentityComplete &&
    harness.terminalFailureIdentityDigest ===
      expectedTerminalFailureIdentity.digest;
  const receiptOutcomeCongruent =
    receiptExpectedHarnessOutcome !== null &&
    harness.outcome === receiptExpectedHarnessOutcome &&
    receiptCandidateDigestCongruent &&
    receiptFailureCodeCongruent &&
    receiptFinalIssueCountCongruent &&
    receiptFinalIssueDigestCongruent &&
    receiptTerminalFailureIdentityCongruent;
  return {
    receiptExpectedHarnessOutcome,
    receiptCandidateDigestCongruent,
    receiptFailureCodeCongruent,
    receiptFinalIssueCountCongruent,
    receiptFinalIssueDigestCongruent,
    receiptTerminalFailureIdentityCongruent,
    receiptOutcomeCongruent,
  };
}

export async function replayVisualContractAuthoringEvidence(args: {
  repoRoot: string;
  snapshot: StorySourceAuthoritySnapshot;
  request: VisualContractAuthoringRequest;
  receipt: VisualContractAuthoringReceipt;
  evidence: VisualContractAuthoringReplayEvidence;
  evidencePath: string;
}): Promise<VisualContractAuthoringReplayResult> {
  assertValidStorySourceAuthoritySnapshot(args.snapshot);
  const requestVersion = runtimeStringField(args.request, 'version');
  const receiptVersion = runtimeStringField(args.receipt, 'version');
  const isCurrentChain =
    requestVersion === VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION &&
    receiptVersion === VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION &&
    args.evidence.version ===
      VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION;
  const isLegacyV1Chain =
    requestVersion ===
      LEGACY_VISUAL_CONTRACT_AUTHORING_REQUEST_VERSION_V55 &&
    receiptVersion ===
      LEGACY_VISUAL_CONTRACT_AUTHORING_RECEIPT_VERSION_V58 &&
    args.evidence.version ===
      VISUAL_CONTRACT_AUTHORING_REPLAY_EVIDENCE_VERSION;
  if (!isCurrentChain && !isLegacyV1Chain) {
    throw new Error(
      'Replay authoring artifacts do not form an exact supported current or immutable legacy version tuple',
    );
  }
  let routingPolicyVersion: VisualContractAuthoringRoutingPolicyVersion;
  if (isLegacyV1Chain) {
    assertValidLegacyVisualContractAuthoringReplayArtifacts({
      snapshot: args.snapshot,
      request: args.request,
      receipt: args.receipt,
    });
    routingPolicyVersion =
      LEGACY_VISUAL_CONTRACT_AUTHORING_ROUTING_POLICY_VERSION;
  } else {
    const requestIssues = visualContractAuthoringRequestIssues({
      request: args.request,
      snapshot: args.snapshot,
    });
    if (requestIssues.length > 0) {
      throw new Error(
        `Invalid replay authoring request:\n- ${requestIssues.join('\n- ')}`,
      );
    }
    persistVisualContractAuthoringReceipt({
      repoRoot: args.repoRoot,
      outputDir: 'outputs/.offline-replay-validation',
      request: args.request,
      receipt: args.receipt,
      write: false,
    });
    routingPolicyVersion =
      VISUAL_CONTRACT_AUTHORING_ROUTING_POLICY_VERSION;
  }
  const replayLocator =
    args.receipt.structuredDraftReplayEvidence;
  if (
    !replayLocator ||
    replayLocator.version !== args.evidence.version ||
    replayLocator.digest !== args.evidence.digest ||
    replayLocator.path !== args.evidencePath
  ) {
    throw new Error(
      'Replay evidence is not exactly bound to the supplied authoring receipt',
    );
  }
  assertValidVisualContractAuthoringReplayEvidence({
    evidence: args.evidence,
    sourceSnapshotDigest: args.snapshot.digest,
    request: args.request,
    receipt: args.receipt,
  });

  const capturedReceiptAttempts = args.receipt.attempts.filter(
    visualContractAuthoringAttemptHasCapturedResponse,
  );
  const expectedCalls = args.evidence.attempts.map((attempt, index) => ({
    kind: attempt.kind,
    repairMode: attempt.repairMode,
    routeProvenance:
      capturedReceiptAttempts[index]?.routeProvenance ?? null,
    budgetClass: attempt.budgetClass,
    maxOutputTokens: attempt.maxOutputTokens,
    schemaName: attempt.schemaName,
    schemaDigest: attempt.schemaDigest,
    callOptionsDigest: attempt.callOptionsDigest,
    systemPromptVersion: attempt.systemPromptVersion,
    userPromptVersion: attempt.userPromptVersion,
    systemPromptDigest: attempt.systemPromptDigest,
    userPromptDigest: attempt.userPromptDigest,
  }));
  const harness = await runOfflineRepairHarness({
    input: storySourceSnapshotToTemplateInput(args.snapshot),
    routingPolicyVersion,
    initialDraft:
      args.evidence.attempts[0]!.responseJson,
    repairResponses: args.evidence.attempts
      .slice(1)
      .map((attempt) => attempt.responseJson),
    expectedCalls,
  });
  const exactCapturedCallSequence =
    harness.calls.length === expectedCalls.length &&
    harness.calls.every((call, index) => {
      const expected = expectedCalls[index];
      return (
        expected !== undefined &&
        call.kind === expected.kind &&
        call.repairMode === expected.repairMode &&
        call.routeProvenance === expected.routeProvenance &&
        call.budgetClass === expected.budgetClass &&
        call.maxOutputTokens === expected.maxOutputTokens &&
        call.schemaName === expected.schemaName &&
        call.schemaDigest === expected.schemaDigest &&
        call.callOptionsDigest === expected.callOptionsDigest &&
        call.systemPromptVersion === expected.systemPromptVersion &&
        call.userPromptVersion === expected.userPromptVersion &&
        call.systemPromptDigest === expected.systemPromptDigest &&
        call.userPromptDigest === expected.userPromptDigest
      );
    });
  const congruence =
    evaluateVisualContractAuthoringReplayCongruence({
      receipt: args.receipt,
      harness,
    });
  return {
    version: VISUAL_CONTRACT_AUTHORING_REPLAY_RESULT_VERSION,
    executionMode: 'offline_captured_structured_responses',
    providerCalls: 0,
    exactCapturedCallSequence,
    ...congruence,
    harness,
  };
}
