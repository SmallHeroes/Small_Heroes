import assert from 'node:assert/strict';

import {
  BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
  type BlueprintAuthoringAdmissionDecisionRecord,
} from '../../blueprintAuthoringAdmissionLedger';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  blueprintAuthoringCountRequestProjection,
  type BlueprintAuthoringInputTokenCountRequest,
} from '../../blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MODEL,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringReservedExposureUsd,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from '../../blueprintAuthoringPolicy';
import {
  PRODUCTION_AUTHORING_CONTEXT_VERSION,
  computeProductionAuthoringContextDigest,
  type ProductionAuthoringContext,
} from '../../productionAuthoringContext';
import {
  PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  buildProductionAuthoringRunRequest,
  productionAuthoringReceiptV7EvidenceReason,
  productionAuthoringRunResultIsCompleted,
  productionBlueprintAuthoringPreflightIssues,
  runProductionBlueprintAuthoring,
  type ProductionAuthoringAttemptReceipt,
  type ProductionAuthoringProvider,
} from '../../productionAuthoringRunner';
import { canonicalJsonDigest } from '../../integrity';
import { assemblePreRenderBookVisualBlueprintFromDraft } from '../../preRenderBlueprintAuthoring';
import { validatePreRenderBookVisualBlueprint } from '../../preRenderBlueprint';
import { PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION } from '../../preRenderBlueprintTypes';
import {
  computeVisualPackageV4RevisionDigest,
  loadVisualPackageV4Revision,
  type VisualPackageV4,
} from '../../visualPackageV4';

const REVISION =
  '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6';
const PACKAGE_PATH =
  `visual-packages/approved/revisions/${REVISION}.visual-package.json`;
const EXPECTED_CONTEXT_DIGEST =
  '0cc212ea805e53395d9757c04b436ac55527aecc2f434c5a35c5c91dbee80d0c';
const EXPECTED_DIAGNOSTIC_COUNT = 86;
const EXPECTED_REPAIR_ACCOUNTING = {
  systemBytes: 2_290,
  userBytes: 47_647,
  schemaBytes: 20_753,
  separatorBytes: 2,
  protocolAllowance: 4_096,
  estimatedBytes: 74_788,
} as const;

type ProviderCallArgs = Parameters<ProductionAuthoringProvider['call']>[0];

function loadPinnedPackage(repoRoot: string): VisualPackageV4 {
  const value = loadVisualPackageV4Revision({
    repoRoot,
    packagePath: PACKAGE_PATH,
    expectedRevisionDigest: REVISION,
  });
  assert.equal(value.revisionDigest, REVISION);
  assert.equal(computeVisualPackageV4RevisionDigest(value), REVISION);
  assert.equal(value.sourceSnapshot.identity.pageCount, 8);
  assert.equal(
    value.blueprint.content.frames.filter((frame) => frame.kind === 'page')
      .length,
    8,
  );
  return value;
}

function contextFromPackage(pkg: VisualPackageV4): ProductionAuthoringContext {
  const styleIdentity: ProductionAuthoringContext['styleAuthority']['identity'] = {
    styleId: pkg.styleId,
    artifactPath: pkg.styleAuthority.artifactPath,
    digestAlgorithm: pkg.styleAuthority.digestAlgorithm,
    digest: pkg.styleAuthority.digest,
  };
  const validationContext: ProductionAuthoringContext['validationContext'] = {
    source: pkg.sourceSnapshot.identity,
    rawStorySource: pkg.sourceSnapshot.content,
    template: pkg.visualContractTemplate.content,
    templateIdentity: pkg.visualContractTemplate.identity,
    reconciliation: pkg.reconciliation.content,
    reconciliationArtifactPath: pkg.reconciliation.artifactPath,
    actionSemanticCoverage:
      pkg.reconciliation.content.actionSemanticCoverageAuthority.records,
    style: styleIdentity,
    styleContent:
      pkg.styleAuthority.content as ProductionAuthoringContext['styleAuthority']['content'],
  };
  const withoutDigest = {
    version: PRODUCTION_AUTHORING_CONTEXT_VERSION,
    storyKey: pkg.storyKey,
    styleId: pkg.styleId,
    sourceSnapshot: structuredClone(pkg.sourceSnapshot),
    template: {
      identity: structuredClone(pkg.visualContractTemplate.identity),
      content: structuredClone(pkg.visualContractTemplate.content),
    },
    reconciliation: {
      artifactPath: pkg.reconciliation.artifactPath,
      digestAlgorithm: pkg.reconciliation.digestAlgorithm,
      digest: pkg.reconciliation.digest,
      content: structuredClone(pkg.reconciliation.content),
    },
    styleAuthority: {
      artifactPath: pkg.styleAuthority.artifactPath,
      identity: styleIdentity,
      content: structuredClone(
        pkg.styleAuthority.content,
      ) as ProductionAuthoringContext['styleAuthority']['content'],
    },
    authoredCoverAuthority: structuredClone(pkg.authoredCoverAuthority),
  } satisfies Omit<
    ProductionAuthoringContext,
    'validationContext' | 'digestAlgorithm' | 'digest'
  >;
  return {
    ...withoutDigest,
    validationContext,
    digestAlgorithm: 'canonical-json-sha256',
    digest: computeProductionAuthoringContextDigest(withoutDigest),
  };
}

function providerDraft(pkg: VisualPackageV4) {
  const draft = {
    worldPlan: structuredClone(pkg.blueprint.content.worldPlan),
    frames: pkg.blueprint.content.frames.map((frame) => ({
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      narrative: structuredClone(frame.narrative),
      placements: structuredClone(frame.placements),
      camera: structuredClone(frame.camera),
      affordanceIds: structuredClone(frame.affordanceIds),
      continuity: {
        connectionId: frame.continuity.connectionId ?? null,
        carryoverRefs: structuredClone(frame.continuity.carryoverRefs),
      },
    })),
  };
  // The approved package predates the current composition-policy cutover. Keep
  // all package authority intact while expressing the same geometry through a
  // policy-qualified provider draft: one genuine close-up, three shot types,
  // and material cast-scale contrast. These are ordinary provider-owned camera
  // and placement fields, not compiler-owned identity or source authority.
  const page2 = draft.frames.find(
    (frame) => frame.kind === 'page' && frame.pageNumber === 2,
  );
  const page3 = draft.frames.find(
    (frame) => frame.kind === 'page' && frame.pageNumber === 3,
  );
  const page8 = draft.frames.find(
    (frame) => frame.kind === 'page' && frame.pageNumber === 8,
  );
  assert.ok(page2 && page3 && page8);
  page2.camera.shot = 'wide';
  page3.camera.shot = 'tracking';
  page8.camera.shot = 'close_up';
  const page8PrimaryCast = page8.placements.find(
    (placement) => placement.subject.kind === 'cast',
  );
  assert.ok(page8PrimaryCast);
  page8PrimaryCast.region.width = 300;
  page8PrimaryCast.region.height = 350;
  return draft;
}

function hostileFirstDraft(pkg: VisualPackageV4): ReturnType<typeof providerDraft> {
  const hostile = providerDraft(pkg);
  for (const frame of hostile.frames) {
    frame.affordanceIds = ['affordance:missing'];
    frame.continuity.carryoverRefs = [
      { kind: 'cast', id: 'cast:missing' },
    ];
  }
  let changed = 0;
  for (const frame of hostile.frames.filter((entry) => entry.kind === 'page')) {
    for (const placement of frame.placements) {
      if (placement.importance === 'key' && changed < 14) {
        placement.region.y = 800;
        placement.region.height = 100;
        changed += 1;
      }
    }
  }
  hostile.frames[0]!.narrative.summary += 'x'.repeat(2_304);
  assert.equal(changed, 14);
  return hostile;
}

function canonicalProviderReceipt(args: ProviderCallArgs, inputTokens: number) {
  const usage = {
    inputTokens,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 80,
    reasoningTokens: 20,
    totalTokens: inputTokens + 80,
  };
  const conservativeCallCostUsd = conservativeBlueprintAuthoringCostUsd({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  const priorGenerationCostUsd =
    args.attempt === 1
      ? 0
      : conservativeBlueprintAuthoringCostUsd({
          inputTokens: 120,
          outputTokens: 80,
        });
  return {
    provider: 'openai',
    model: BLUEPRINT_AUTHORING_MODEL,
    responseId: `offline-response-${args.attempt}`,
    usage: {
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      cache_write_input_tokens: usage.cacheWriteInputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      total_tokens: usage.totalTokens,
    },
    evidenceVersion: OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
    completionStatus: 'completed',
    usageEvidenceComplete: true,
    executionAttestation: {
      evidenceKind: 'canonical_adapter_observed' as const,
      logicalProviderCalls: 1,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    },
    inputAccounting: args.inputAdmission.inputAccounting,
    reservedExposureBeforeCallUsd: blueprintAuthoringReservedExposureUsd({
      conservativeAccountedCostUsd: priorGenerationCostUsd,
      callsCompleted: args.attempt - 1,
    }),
    nominalEstimatedCostUsd: nominalBlueprintAuthoringUsageCostUsd(usage),
    conservativeCallCostUsd,
  };
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const pkg = loadPinnedPackage(repoRoot);
  const context = contextFromPackage(pkg);
  assert.equal(context.digest, EXPECTED_CONTEXT_DIGEST);
  const request = buildProductionAuthoringRunRequest({
    context,
    mode: 'live',
    requestId: 'offline-production-scale-f1',
    requestedAt: '2026-08-31T00:00:00.000Z',
  });
  assert.deepEqual(
    productionBlueprintAuthoringPreflightIssues({ request, context }),
    [],
  );

  const hostile = hostileFirstDraft(pkg);
  const clean = providerDraft(pkg);
  const cleanCandidate = assemblePreRenderBookVisualBlueprintFromDraft({
    draft: JSON.parse(JSON.stringify(clean)) as unknown,
    context: context.validationContext,
    compositionPolicyVersion: PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
  });
  const cleanValidation = validatePreRenderBookVisualBlueprint(
    cleanCandidate,
    context.validationContext,
  );
  assert.equal(
    cleanValidation.ok,
    true,
    JSON.stringify(cleanValidation.ok ? [] : cleanValidation.issues),
  );
  const countedRequests: BlueprintAuthoringInputTokenCountRequest[] = [];
  const providerCalls: ProviderCallArgs[] = [];
  const result = await runProductionBlueprintAuthoring({
    request,
    context,
    provider: {
      async call(args) {
        providerCalls.push(args);
        return {
          output: JSON.stringify(args.attempt === 1 ? hostile : clean),
          receipt: canonicalProviderReceipt(
            args,
            args.attempt === 1 ? 120 : 50_000,
          ),
        };
      },
    },
    inputTokenCounter: async (countRequest) => {
      countedRequests.push(countRequest);
      return {
        routeKind: 'repair',
        repairOrdinal: countRequest.repairOrdinal,
        countRequestDigest: canonicalJsonDigest(
          blueprintAuthoringCountRequestProjection(countRequest),
        ),
        outcome: 'counted',
        inputTokens: 50_000,
        unavailableReason: null,
        attestation: {
          provider: 'openai',
          model: BLUEPRINT_AUTHORING_MODEL,
          route: 'responses_input_tokens',
          evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
          transportDispatchCount: 1,
          transportRetryCount: 0,
          canonicalRouteConfirmed: true,
          canonicalModelConfirmed: true,
        },
      };
    },
  });

  assert.equal(
    productionAuthoringRunResultIsCompleted(result),
    true,
    JSON.stringify({
      status: result.receipt.status,
      failure: result.receipt.failure,
      callCount: result.receipt.callCount,
      repairCount: result.receipt.repairCount,
      attempts: result.receipt.attempts.map((attempt) => ({
        attempt: attempt.attempt,
        failureCode: attempt.failureCode,
        validationDiagnostics: attempt.validationDiagnostics,
      })),
      admissionDecisions: result.receipt.admissionDecisions.map((decision) => ({
        routeKind: decision.routeKind,
        ordinal: decision.ordinal,
        admitted: decision.admitted,
        basis: decision.basis,
        estimatedBytes: decision.inputAccounting.estimatedBytes,
        exactInputTokens: decision.exactInputTokens,
        failureReason: decision.failureReason,
      })),
    }),
  );
  if (!productionAuthoringRunResultIsCompleted(result)) {
    throw new Error('production-scale F1 run did not complete');
  }
  assert.equal(result.receipt.version, PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION);
  assert.equal(result.receipt.callCount, 2);
  assert.equal(result.receipt.repairCount, 1);
  assert.equal(providerCalls.length, 2);
  assert.equal(countedRequests.length, 1);
  assert.deepEqual(
    result.receipt.admissionDecisions[1]!.inputAccounting,
    EXPECTED_REPAIR_ACCOUNTING,
  );
  assert.equal(
    result.receipt.admissionDecisions[1]!.inputAccounting.estimatedBytes >
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    true,
  );
  assert.equal(
    result.receipt.attempts[0]!.validationDiagnostics.count,
    86,
    JSON.stringify(result.authoringResult.repairAttempts[0]?.diagnostics ?? []),
  );
  assert.equal(
    result.receipt.diagnosticCensusCommitment?.totalEmitted,
    EXPECTED_DIAGNOSTIC_COUNT,
  );
  assert.equal(result.receipt.admissionDecisions.length, 2);
  assert.equal(
    result.receipt.admissionDecisions[0]!.version,
    BLUEPRINT_AUTHORING_ADMISSION_LEDGER_VERSION,
  );
  assert.deepEqual(
    result.receipt.admissionDecisions[1]!.inputAccounting,
    EXPECTED_REPAIR_ACCOUNTING,
  );
  assert.equal(
    result.receipt.admissionDecisions[1]!.basis,
    'exact_provider_count',
  );
  assert.equal(result.receipt.admissionDecisions[1]!.exactInputTokens, 50_000);
  for (let index = 0; index < result.receipt.attempts.length; index += 1) {
    const attempt: ProductionAuthoringAttemptReceipt =
      result.receipt.attempts[index]!;
    const decision: BlueprintAuthoringAdmissionDecisionRecord =
      result.receipt.admissionDecisions[index]!;
    assert.equal(attempt.inputAdmissionDigest, canonicalJsonDigest(decision));
    assert.equal(
      attempt.tokenRelevantRequestDigest,
      decision.tokenRelevantRequestDigest,
    );
  }
  assert.equal(productionAuthoringReceiptV7EvidenceReason(result.receipt), null);

  process.stdout.write(
    `${JSON.stringify({
      packageRevision: REVISION,
      contextDigest: context.digest,
      pageCount: context.sourceSnapshot.identity.pageCount,
      firstDraftDiagnostics: result.receipt.attempts[0]!.validationDiagnostics
        .count,
      repairEstimatedBytes:
        result.receipt.admissionDecisions[1]!.inputAccounting.estimatedBytes,
      exactRepairInputTokens:
        result.receipt.admissionDecisions[1]!.exactInputTokens,
      countCalls: countedRequests.length,
      generationCalls: providerCalls.length,
      status: result.receipt.status,
      receiptVersion: result.receipt.version,
      receiptDigest: result.receipt.digest,
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
