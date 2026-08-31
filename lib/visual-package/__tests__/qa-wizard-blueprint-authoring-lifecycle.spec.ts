import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const bridgeLoaderMock = vi.hoisted(() => vi.fn());

vi.mock('../qaWizardCandidateBridge', async () => {
  const actual = await vi.importActual<
    typeof import('../qaWizardCandidateBridge')
  >('../qaWizardCandidateBridge');
  return {
    ...actual,
    loadQaWizardApprovedProductionContext: bridgeLoaderMock,
  };
});

// Scoped seam for the F3 torn-state tests only. Both fields default to null (real
// behavior), so every other test is unaffected; a test opts in, then resets in a
// finally. `requiresCapture` forces the canonical receipt-evidence capture-required
// classification (used to fabricate a fully-consistent capture-less diagnostic-bearing
// terminal). `buildThrows` makes the runner's capture derivation fail (used to exercise
// the overflow/derivation incident path). It overrides the single canonical predicate
// (`blueprintAuthoringReceiptRequiresSanitizedCapture`), which the runner derivation,
// first materialization, replay, and recovery all consult — so all four move together.
const captureMockState = vi.hoisted(
  () => ({ requiresCapture: null as null | boolean, buildThrows: null as null | string }),
);

vi.mock('../blueprintAuthoringSanitizedFailureCapture', async () => {
  const actual = await vi.importActual<
    typeof import('../blueprintAuthoringSanitizedFailureCapture')
  >('../blueprintAuthoringSanitizedFailureCapture');
  return {
    ...actual,
    blueprintAuthoringReceiptRequiresSanitizedCapture: (
      receipt: Parameters<
        typeof actual.blueprintAuthoringReceiptRequiresSanitizedCapture
      >[0],
    ) =>
      captureMockState.requiresCapture ??
      actual.blueprintAuthoringReceiptRequiresSanitizedCapture(receipt),
    buildBlueprintAuthoringSanitizedFailureCapture: (
      args: Parameters<
        typeof actual.buildBlueprintAuthoringSanitizedFailureCapture
      >[0],
    ) => {
      if (captureMockState.buildThrows !== null) {
        throw new Error(captureMockState.buildThrows);
      }
      return actual.buildBlueprintAuthoringSanitizedFailureCapture(args);
    },
  };
});

import {
  QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
  type QaWizardCandidateBridgeManifest,
} from '../qaWizardCandidateBridge';
import {
  LEGACY_QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
  QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
  QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
  QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION,
  executeBlueprintReplacementLiveRequest,
  executeQaWizardBlueprintLiveRequest,
  loadQaWizardBlueprintAuthoringManifest,
  prepareQaWizardBlueprintLiveRequest,
  productionBlueprintAuthoringReceiptReplayIsValid,
  qaWizardBlueprintAuthoringProvenanceVersionsForRequest,
  qaWizardBlueprintOrdinaryExecutionIdentityDigest,
  qaWizardBlueprintTerminalCaptureRequirement,
  recordQaWizardBlueprintApproval,
  type QaWizardBlueprintAuthoringManifest,
} from '../qaWizardBlueprintAuthoringLifecycle';
import {
  buildProductionAuthoringContext,
  type ProductionAuthoringContext,
} from '../productionAuthoringContext';
import { buildStorySourceAuthoritySnapshot } from '../storySourceAuthority';
import {
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
} from '../styleAuthority';
import {
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MODEL,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringReservedExposureUsd,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from '../blueprintAuthoringPolicy';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  blueprintAuthoringCountRequestProjection,
  type BlueprintAuthoringInputTokenCountRequest,
} from '../blueprintAuthoringInputTokenAdmission';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6,
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
} from '../preRenderBlueprintDraftSchema';
import {
  persistPreRenderBlueprintLifecycle,
} from '../preRenderBlueprintLifecycle';
import type { PreRenderBookVisualBlueprint } from '../preRenderBlueprintTypes';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
  LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6,
  PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
  type PreRenderBlueprintAuthoringProvenance,
} from '../preRenderBlueprintAuthoringContract';
import {
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
  LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
  blueprintAuthoringSanitizedFailureCaptureBytes,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  type BlueprintAuthoringSanitizedFailureCapture,
} from '../blueprintAuthoringSanitizedFailureCapture';
import {
  rebindReceiptPromptEvidenceToFrozenV6,
} from './fixtures/frozen-blueprint-authoring-v6-evidence';
import {
  LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
  LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6,
  LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
  PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  ProductionAuthoringProviderBoundaryError,
  aggregateProductionAuthoringExecutionAttestations,
  type ProductionAuthoringProvider,
  type ProductionAuthoringRunReceipt,
  type ReplayableProductionAuthoringRunReceipt,
} from '../productionAuthoringRunner';
import { createOpenAIResponsesBlueprintAuthoringAdapter } from '../openaiResponsesBlueprintAuthoringAdapter';
import type { OpenAIResponsesAuthoringTransport } from '../openaiResponsesVisualContractAuthoringAdapter';
import {
  buildAuthoringTerminalFailure,
  injectedAuthoringExecutionAttestation,
  notRunAuthoringExecutionAttestation,
  type AuthoringExecutionAttestation,
} from '../authoringTerminalDiagnostics';
import { canonicalJsonDigest } from '../integrity';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import {
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7,
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_PROMPT_V8,
} from '../blueprintAuthoringExecutionProgram';
import { createLazyLocalOpenAICredentialReader } from '../../../scripts/lib/qa-wizard-blueprint-local-credential';
import {
  buildBlueprintReplacementAuthorization,
  buildBlueprintReplacementExecutionClaim,
  buildBlueprintReplacementProposal,
  buildBlueprintReplacementReview,
} from '../qaWizardBlueprintReplacementAuthority';
import {
  buildBlueprintFixture,
  buildVisualContractCandidateFixture,
} from './pre-render-book-visual-blueprint.fixtures';

const tempRoots: string[] = [];
const OUTPUT_DIR = 'outputs/blueprint-operator';
const REQUESTED_AT = '2026-08-25T12:00:00.000Z';
const APPROVED_AT = '2026-08-25T12:30:00.000Z';
const STYLE_ID = 'soft_hand_drawn_storybook';

afterEach(() => {
  bridgeLoaderMock.mockReset();
  captureMockState.requiresCapture = null;
  captureMockState.buildThrows = null;
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'qa-wizard-blueprint-operator-'),
  );
  tempRoots.push(root);
  return root;
}

function writeJson(root: string, relative: string, value: unknown): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(root: string, relative: string, value: string): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, value, 'utf8');
}

function rebindAggregateAndRedigestReceipt(
  receipt: Record<string, unknown> & {
    attempts: Array<Record<string, unknown>>;
    digest: string;
  },
): void {
  receipt.executionAttestation =
    aggregateProductionAuthoringExecutionAttestations(
      receipt.attempts.map(
        (attempt) =>
          attempt.executionAttestation as AuthoringExecutionAttestation,
      ),
    );
  const {
    digest: _digest,
    digestAlgorithm: _digestAlgorithm,
    ...payload
  } = receipt;
  receipt.digest = canonicalJsonDigest(payload);
}

function styleAuthorityContent(): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH),
      'utf8',
    ),
  ) as unknown;
}

function buildContext(): {
  repoRoot: string;
  context: ProductionAuthoringContext;
  fixture: ReturnType<typeof buildBlueprintFixture>;
} {
  const repoRoot = tempRoot();
  const fixture = buildBlueprintFixture('single_location');
  const storyKey = fixture.blueprint.identity.storyKey;
  const storyPath = fixture.context.source.path;
  const templatePath = fixture.context.templateIdentity.artifactPath;
  const reconciliationPath = fixture.context.reconciliationArtifactPath;
  const candidatePath = 'authorities/visual-contract-candidate.json';
  writeText(repoRoot, storyPath, fixture.context.rawStorySource);
  writeJson(repoRoot, templatePath, fixture.context.template);
  writeJson(repoRoot, reconciliationPath, fixture.context.reconciliation);
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot,
    storyKey,
    storyPath,
  });
  writeJson(
    repoRoot,
    candidatePath,
    buildVisualContractCandidateFixture({
      fixture,
      sourceSnapshotDigest: snapshot.digest,
    }),
  );
  writeJson(
    repoRoot,
    STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
    styleAuthorityContent(),
  );
  const context = buildProductionAuthoringContext({
    repoRoot,
    storyKey,
    storyPath,
    templatePath,
    reconciliationPath,
    candidatePath,
    styleId: STYLE_ID,
    styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  });
  return { repoRoot, context, fixture };
}

function approvedBridge(
  context: ProductionAuthoringContext,
): QaWizardCandidateBridgeManifest {
  return {
    version: QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
    stage: 'reconciliation_approved',
    productionContext: {
      version: context.version,
      digest: context.digest,
      styleId: context.styleId,
      styleAuthorityPath: context.styleAuthority.identity.artifactPath,
      styleAuthorityDigest: context.styleAuthority.identity.digest,
    },
    digest: canonicalJsonDigest({
      fixture: 'approved-qa-wizard-bridge',
      contextDigest: context.digest,
    }),
  } as unknown as QaWizardCandidateBridgeManifest;
}

function setup() {
  const built = buildContext();
  const bridge = approvedBridge(built.context);
  const bridgeManifestPath =
    `outputs/bridge/bridge-manifests/${bridge.digest}.json`;
  bridgeLoaderMock.mockImplementation(() => ({
    manifest: bridge,
    context: built.context,
  }));
  return { ...built, bridge, bridgeManifestPath };
}

function providerDraft(
  fixture: ReturnType<typeof buildBlueprintFixture>,
): unknown {
  return {
    worldPlan: fixture.blueprint.worldPlan,
    frames: fixture.blueprint.frames.map((frame) => ({
      ...frame,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
    })),
  };
}

function providerReceipt(args: {
  attempt: number;
  systemPrompt: string;
  userPrompt: string;
}) {
  const usage = {
    inputTokens: 120,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 80,
    reasoningTokens: 20,
    totalTokens: 200,
  };
  const conservativeCallCostUsd = conservativeBlueprintAuthoringCostUsd({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    responseId: `response-${args.attempt}`,
    usage: {
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      cache_write_input_tokens: usage.cacheWriteInputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      total_tokens: usage.totalTokens,
      secret_debug_payload: 'must-not-persist',
    },
    evidenceVersion:
      OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
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
    inputAccounting: blueprintAuthoringInputAccounting({
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    }),
    reservedExposureBeforeCallUsd: blueprintAuthoringReservedExposureUsd({
      conservativeAccountedCostUsd:
        (args.attempt - 1) * conservativeCallCostUsd,
      callsCompleted: args.attempt - 1,
    }),
    nominalEstimatedCostUsd: nominalBlueprintAuthoringUsageCostUsd(usage),
    conservativeCallCostUsd,
  };
}

function providerReceiptWithInputTokens(
  args: Parameters<ProductionAuthoringProvider['call']>[0],
  inputTokens: number,
) {
  const usage = {
    inputTokens,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 80,
    reasoningTokens: 20,
    totalTokens: inputTokens + 80,
  };
  const firstCallCost = conservativeBlueprintAuthoringCostUsd({
    inputTokens: 120,
    outputTokens: 80,
  });
  const countedRepairCost = conservativeBlueprintAuthoringCostUsd({
    inputTokens: 50_000,
    outputTokens: 80,
  });
  const priorGenerationCostUsd =
    args.attempt === 1
      ? 0
      : args.attempt === 2
        ? firstCallCost
        : firstCallCost + countedRepairCost;
  return {
    ...providerReceipt(args),
    usage: {
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      cache_write_input_tokens: usage.cacheWriteInputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      total_tokens: usage.totalTokens,
    },
    inputAccounting: args.inputAdmission.inputAccounting,
    reservedExposureBeforeCallUsd: blueprintAuthoringReservedExposureUsd({
      conservativeAccountedCostUsd: priorGenerationCostUsd,
      callsCompleted: args.attempt - 1,
    }),
    nominalEstimatedCostUsd: nominalBlueprintAuthoringUsageCostUsd(usage),
    conservativeCallCostUsd: conservativeBlueprintAuthoringCostUsd({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }),
  };
}

function draftWithExactInvalidAffordanceCount(
  fixture: ReturnType<typeof buildBlueprintFixture>,
  diagnosticCount: number,
): unknown {
  const draft = structuredClone(providerDraft(fixture)) as {
    worldPlan: {
      affordances: Array<{
        id: string;
        zoneId: string;
        kind: string;
        consumers: unknown[];
      }>;
    };
  };
  const existing = draft.worldPlan.affordances[0];
  if (!existing) throw new Error('fixture must expose one valid affordance zone');
  for (let index = 0; index < diagnosticCount; index += 1) {
    draft.worldPlan.affordances.push({
      id: `affordance:offline_invalid_${index}`,
      zoneId: existing.zoneId,
      kind: 'synthetic_invalid',
      consumers: [],
    });
  }
  return draft;
}

function passingProvider(
  fixture: ReturnType<typeof buildBlueprintFixture>,
  call = vi.fn(),
): ProductionAuthoringProvider {
  return {
    call: async (args) => {
      const draft = providerDraft(fixture);
      call(args, draft);
      return {
        output: JSON.stringify(draft),
        receipt: providerReceipt(args),
      };
    },
  };
}

function repairInputIneligibleProvider(
  fixture: ReturnType<typeof buildBlueprintFixture>,
  call = vi.fn(),
): ProductionAuthoringProvider {
  const invalid = structuredClone(providerDraft(fixture)) as {
    frames: Array<{
      narrative: { summary: string };
      camera: unknown;
    }>;
  };
  invalid.frames[0]!.narrative.summary = 'x'.repeat(70_000);
  invalid.frames[1]!.camera = null;
  return {
    call: async (args) => {
      call(args);
      return {
        output: JSON.stringify(invalid),
        receipt: providerReceipt(args),
      };
    },
  };
}

function policyMismatchProvider(): ProductionAuthoringProvider {
  return {
    call: async (callArgs) => {
      const inputAccounting = blueprintAuthoringInputAccounting({
        systemPrompt: callArgs.systemPrompt,
        userPrompt: callArgs.userPrompt,
        schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      });
      throw new ProductionAuthoringProviderBoundaryError(
        'provider_policy_mismatch',
        {
          provider: 'openai',
          model: 'gpt-5.6-sol',
          providerEvidenceVersion:
            OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
          inputAccounting,
          reservedExposureBeforeCallUsd: blueprintAuthoringReservedExposureUsd({
            conservativeAccountedCostUsd: 0,
            callsCompleted: 0,
          }),
          executionAttestation: notRunAuthoringExecutionAttestation(),
        },
        'adapter_policy_mismatch',
      );
    },
  };
}

function prepare(args: ReturnType<typeof setup>) {
  return prepareQaWizardBlueprintLiveRequest({
    repoRoot: args.repoRoot,
    bridgeManifestPath: args.bridgeManifestPath,
    outputDir: OUTPUT_DIR,
    requestId: 'blueprint-live-request-001',
    requestedAt: REQUESTED_AT,
    write: true,
  });
}

function fileInventory(root: string): Array<{ path: string; bytes: string }> {
  if (!fs.existsSync(root)) return [];
  const result: Array<{ path: string; bytes: string }> = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        result.push({
          path: path.relative(root, absolute).split('\\').join('/'),
          bytes: fs.readFileSync(absolute, 'utf8'),
        });
      }
    }
  };
  visit(root);
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function executionIncidentInventory(repoRoot: string) {
  return fileInventory(
    path.join(
      repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
      'execution-incidents',
    ),
  );
}

// Drop the terminal lookup + binding so a re-entry takes the recovery lane
// (which must run the full shared assertion before writing any lookup).
function stripTerminalLedger(repoRoot: string): void {
  for (const category of ['terminal-lookups', 'terminal-bindings']) {
    fs.rmSync(
      path.join(
        repoRoot,
        QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
        category,
      ),
      { recursive: true, force: true },
    );
  }
}

// A torn recovery must publish no terminal-lookup file. The directory may be
// lazily re-created empty by a path resolver, so count durable JSON files.
function terminalLookupFileCount(repoRoot: string): number {
  const dir = path.join(
    repoRoot,
    QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    'terminal-lookups',
  );
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.json')).length;
}

type HistoricalCompletedTarget =
  | {
      kind: 'request_v4';
      systemPromptDigest:
        | typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5
        | typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6;
    }
  | {
      kind: 'request_v5_frozen_v6';
      systemPromptDigest: typeof LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6;
    };

function repoRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split('\\').join('/');
}

function materializeHistoricalCompletedTerminal(args: {
  subject: ReturnType<typeof setup>;
  currentPreflight: ReturnType<typeof prepare>;
  currentResult: Awaited<ReturnType<typeof executeQaWizardBlueprintLiveRequest>>;
  target: HistoricalCompletedTarget;
  providerCalls?: ReturnType<typeof vi.fn>;
}) {
  const currentBlueprintAuthority = args.currentResult.manifest.blueprint;
  const firstAttempt = args.currentResult.receipt.attempts[0];
  if (
    args.currentResult.manifest.stage !== 'blueprint_candidate' ||
    currentBlueprintAuthority === null ||
    args.currentResult.receipt.status !== 'completed' ||
    !firstAttempt ||
    args.currentResult.receipt.callCount !== 1
  ) {
    throw new Error('historical completed fixture requires a one-call Candidate');
  }

  const request = structuredClone(args.currentPreflight.request) as unknown as Record<
    string,
    unknown
  >;
  if (args.target.kind === 'request_v4') {
    request.version = LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4;
    delete request.program;
  } else {
    request.program = structuredClone(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
    );
  }
  const requestDigest = canonicalJsonDigest(request);
  const requestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${requestDigest}.json`;
  writeText(
    args.subject.repoRoot,
    requestPath,
    canonicalContentAddressedJsonBytes(request),
  );

  const {
    digest: _currentPreflightDigest,
    digestAlgorithm: _currentPreflightDigestAlgorithm,
    ...currentPreflightPayload
  } = args.currentPreflight.manifest;
  void _currentPreflightDigest;
  void _currentPreflightDigestAlgorithm;
  const preflightPayload = {
    ...currentPreflightPayload,
    request: {
      ...args.currentPreflight.manifest.request,
      version: request.version,
      digest: requestDigest,
      path: requestPath,
    },
  };
  const preflight = {
    ...preflightPayload,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: canonicalJsonDigest(preflightPayload),
  };
  const preflightPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${preflight.digest}.json`;
  writeText(
    args.subject.repoRoot,
    preflightPath,
    canonicalContentAddressedJsonBytes(preflight),
  );

  const blueprint = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, currentBlueprintAuthority.candidatePath),
      'utf8',
    ),
  ) as PreRenderBookVisualBlueprint;
  const currentProvenance = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, currentBlueprintAuthority.provenancePath),
      'utf8',
    ),
  ) as PreRenderBlueprintAuthoringProvenance;
  const provenanceVersions = qaWizardBlueprintAuthoringProvenanceVersionsForRequest(
    request as unknown as Parameters<
      typeof qaWizardBlueprintAuthoringProvenanceVersionsForRequest
    >[0],
    args.target.systemPromptDigest,
  );
  const provenance: PreRenderBlueprintAuthoringProvenance = {
    ...currentProvenance,
    version: PRE_RENDER_BLUEPRINT_AUTHORING_PROVENANCE_VERSION,
    draftSchemaVersion: provenanceVersions.draftSchemaVersion,
    promptVersion: provenanceVersions.promptVersion,
    systemPromptDigest: args.target.systemPromptDigest,
  };
  delete provenance.repairPromptVersion;
  const persisted = persistPreRenderBlueprintLifecycle({
    root: path.join(args.subject.repoRoot, OUTPUT_DIR, 'blueprint-lifecycle'),
    blueprint,
    context: args.subject.context.validationContext,
    provenance,
    repairAttempts: [],
  });

  const receipt = structuredClone(args.currentResult.receipt) as unknown as Record<
    string,
    unknown
  > & {
    attempts: Array<Record<string, unknown>>;
    digest: string;
  };
  receipt.requestDigest = requestDigest;
  receipt.authoringProvenanceDigest = persisted.provenance.digest;
  receipt.attempts[0]!.systemPromptDigest = args.target.systemPromptDigest;
  if (args.target.kind === 'request_v4') {
    const inputAccounting = receipt.attempts[0]!.inputAccounting as Record<
      string,
      number
    >;
    inputAccounting.systemBytes =
      args.target.systemPromptDigest ===
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5
        ? 8_419
        : 2_144;
    inputAccounting.schemaBytes = Buffer.byteLength(
      JSON.stringify(LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6),
      'utf8',
    );
    inputAccounting.estimatedBytes =
      inputAccounting.protocolAllowance +
      inputAccounting.schemaBytes +
      inputAccounting.separatorBytes +
      inputAccounting.systemBytes +
      inputAccounting.userBytes;
    receipt.version = LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6;
    delete receipt.admissionDecisions;
    delete receipt.diagnosticCensusCommitment;
    for (const attempt of receipt.attempts) {
      delete attempt.inputAdmissionDigest;
      delete attempt.tokenRelevantRequestDigest;
      delete attempt.diagnosticCensusCommitment;
      const diagnostics = attempt.validationDiagnostics as Record<string, unknown>;
      attempt.validationDiagnostics = {
        count: diagnostics.count,
        codes: diagnostics.codes,
      };
    }
  } else {
    if (!args.providerCalls) {
      throw new Error('frozen request-v5 fixture requires captured provider calls');
    }
    rebindReceiptPromptEvidenceToFrozenV6({
      receipt: receipt as never,
      calls: args.providerCalls.mock.calls.map(
        ([call]) => call as Parameters<ProductionAuthoringProvider['call']>[0],
      ),
      context: args.subject.context.validationContext,
      rawDrafts: args.providerCalls.mock.calls.map(([, draft]) => draft),
    });
  }
  rebindAggregateAndRedigestReceipt(receipt);
  const receiptPath = `${OUTPUT_DIR}/authoring-receipts/${receipt.digest}.json`;
  writeText(
    args.subject.repoRoot,
    receiptPath,
    canonicalContentAddressedJsonBytes(receipt),
  );

  const blueprintAuthority = {
    ...currentBlueprintAuthority,
    candidatePath: repoRelative(args.subject.repoRoot, persisted.candidate.path),
    provenanceDigest: persisted.provenance.digest,
    provenancePath: repoRelative(args.subject.repoRoot, persisted.provenance.path),
    validationEvidenceDigest: persisted.validationEvidence.digest,
    validationEvidencePath: repoRelative(
      args.subject.repoRoot,
      persisted.validationEvidence.path,
    ),
    reviewPacketDigest: persisted.reviewPacket.digest,
    reviewPacketPath: repoRelative(
      args.subject.repoRoot,
      persisted.reviewPacket.path,
    ),
    reviewMarkdownDigest: persisted.reviewMarkdown.digest,
    reviewMarkdownPath: repoRelative(
      args.subject.repoRoot,
      persisted.reviewMarkdown.path,
    ),
    contactSheetDigest: persisted.contactSheet.digest,
    contactSheetPath: repoRelative(
      args.subject.repoRoot,
      persisted.contactSheet.path,
    ),
  };
  const {
    digest: _currentTerminalDigest,
    digestAlgorithm: _currentTerminalDigestAlgorithm,
    ...currentTerminalPayload
  } = args.currentResult.manifest;
  void _currentTerminalDigest;
  void _currentTerminalDigestAlgorithm;
  const terminalPayload = {
    ...currentTerminalPayload,
    predecessor: {
      version: preflight.version,
      digest: preflight.digest,
      path: preflightPath,
    },
    request: preflight.request,
    receipt: {
      version: receipt.version,
      digest: receipt.digest,
      path: receiptPath,
      status: 'completed' as const,
    },
    blueprint: blueprintAuthority,
  };
  const terminal = {
    ...terminalPayload,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: canonicalJsonDigest(terminalPayload),
  };
  const terminalPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${terminal.digest}.json`;
  writeText(
    args.subject.repoRoot,
    terminalPath,
    canonicalContentAddressedJsonBytes(terminal),
  );
  return {
    request,
    requestDigest,
    requestPath,
    preflight,
    preflightPath,
    receipt,
    receiptPath,
    terminal,
    terminalPath,
    provenance,
    blueprintAuthority,
  };
}

function writeTerminalBindingForHistoricalExecution(args: {
  repoRoot: string;
  executionIdentityDigest: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  terminalManifestDigest: string;
  terminalManifestPath: string;
}): void {
  const payload = {
    version: QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION,
    executionIdentityDigest: args.executionIdentityDigest,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
    requestDigest: args.requestDigest,
    preflightManifestDigest: args.preflightManifestDigest,
    terminalManifestDigest: args.terminalManifestDigest,
    terminalManifestPath: args.terminalManifestPath,
    scope: 'single_blueprint_execution_terminal_binding' as const,
  };
  const binding = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: canonicalJsonDigest(payload),
  };
  writeText(
    args.repoRoot,
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-bindings/${args.executionIdentityDigest}.json`,
    canonicalContentAddressedJsonBytes(binding),
  );
}

describe('QA Wizard Blueprint authoring operator lifecycle', () => {
  it('prepares the exact live request without provider access and rejects loose timestamps', () => {
    const subject = setup();
    expect(() =>
      prepareQaWizardBlueprintLiveRequest({
        repoRoot: subject.repoRoot,
        bridgeManifestPath: subject.bridgeManifestPath,
        outputDir: OUTPUT_DIR,
        requestId: 'bad-timestamp',
        requestedAt: '2026-08-25',
        write: true,
      }),
    ).toThrow(/canonical UTC/);
    expect(bridgeLoaderMock).not.toHaveBeenCalled();

    const result = prepare(subject);
    expect(result.request).toMatchObject({
      version: 'production-blueprint-authoring-request/v5',
      mode: 'live',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'medium',
      maxOutputTokens: 48_000,
      noFallback: true,
      callBudget: { maxCalls: 3, maxRepairCount: 2 },
    });
    expect(result.manifest.stage).toBe('live_request_preflight_passed');
    expect(
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: result.manifestPath,
      }),
    ).toEqual(result.manifest);
    for (const category of [
      'authoring-receipts',
      'blueprint-authoring-manifests',
      'blueprint-authoring-requests',
      'blueprint-lifecycle',
    ]) {
      expect(
        fs.statSync(path.join(subject.repoRoot, OUTPUT_DIR, category)).isDirectory(),
      ).toBe(true);
    }
  });

  it('reloads a legacy v4 preflight but never lets it mint a fresh claim or reach a provider', async () => {
    const subject = setup();
    const current = prepare(subject);
    const { program: _program, ...requestWithoutProgram } = current.request;
    void _program;
    const legacyRequest = {
      ...requestWithoutProgram,
      version: LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
    };
    const legacyRequestDigest = canonicalJsonDigest(legacyRequest);
    const legacyRequestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${legacyRequestDigest}.json`;
    writeText(
      subject.repoRoot,
      legacyRequestPath,
      canonicalContentAddressedJsonBytes(legacyRequest),
    );
    const {
      digest: _manifestDigest,
      digestAlgorithm: _manifestDigestAlgorithm,
      ...manifestPayload
    } = current.manifest;
    void _manifestDigest;
    void _manifestDigestAlgorithm;
    const legacyManifestPayload = {
      ...manifestPayload,
      request: {
        ...current.manifest.request,
        version: LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
        digest: legacyRequestDigest,
        path: legacyRequestPath,
      },
    };
    const legacyManifest = {
      ...legacyManifestPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(legacyManifestPayload),
    };
    const legacyManifestPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${legacyManifest.digest}.json`;
    writeText(
      subject.repoRoot,
      legacyManifestPath,
      canonicalContentAddressedJsonBytes(legacyManifest),
    );

    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const inputTokenCounterFactory = vi.fn(() => {
      throw new Error('count transport must remain unreachable');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: legacyManifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory, inputTokenCounterFactory },
      ),
    ).rejects.toThrow(
      'legacy Blueprint authoring request cannot authorize fresh dispatch',
    );
    expect(providerFactory).not.toHaveBeenCalled();
    expect(inputTokenCounterFactory).not.toHaveBeenCalled();
    for (const category of [
      'execution-claims',
      'terminal-bindings',
      'terminal-lookups',
      'execution-incidents',
    ]) {
      expect(
        fs.readdirSync(
          path.join(
            subject.repoRoot,
            QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
            category,
          ),
        ),
      ).toEqual([]);
    }
  });

  it.each([
    ['former-current', LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_PROMPT_V8],
    ['prompt-v7', LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V7],
    ['prompt-v6', LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6],
  ] as const)(
    'reloads the frozen %s request-v5 preflight but never lets it fresh-dispatch',
    async (_label, program) => {
    const subject = setup();
    const current = prepare(subject);
    const replayOnlyRequest = {
      ...current.request,
      program,
    };
    const requestDigest = canonicalJsonDigest(replayOnlyRequest);
    const requestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${requestDigest}.json`;
    writeText(
      subject.repoRoot,
      requestPath,
      canonicalContentAddressedJsonBytes(replayOnlyRequest),
    );
    const {
      digest: _manifestDigest,
      digestAlgorithm: _manifestDigestAlgorithm,
      ...manifestPayload
    } = current.manifest;
    void _manifestDigest;
    void _manifestDigestAlgorithm;
    const reboundPayload = {
      ...manifestPayload,
      request: {
        ...current.manifest.request,
        digest: requestDigest,
        path: requestPath,
      },
    };
    const reboundManifest = {
      ...reboundPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(reboundPayload),
    };
    const reboundManifestPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${reboundManifest.digest}.json`;
    writeText(
      subject.repoRoot,
      reboundManifestPath,
      canonicalContentAddressedJsonBytes(reboundManifest),
    );

    expect(
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: reboundManifestPath,
      }),
    ).toEqual(reboundManifest);
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const inputTokenCounterFactory = vi.fn(() => {
      throw new Error('count transport must remain unreachable');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: reboundManifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory, inputTokenCounterFactory },
      ),
    ).rejects.toThrow(
      'legacy Blueprint authoring request cannot authorize fresh dispatch',
    );
    expect(providerFactory).not.toHaveBeenCalled();
    expect(inputTokenCounterFactory).not.toHaveBeenCalled();
    for (const category of [
      'execution-claims',
      'terminal-bindings',
      'terminal-lookups',
      'execution-incidents',
    ]) {
      expect(
        fs.readdirSync(
          path.join(
            subject.repoRoot,
            QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
            category,
          ),
        ),
      ).toEqual([]);
    }
    },
  );

  it('rejects a self-redigested noncurrent embedded program before any paid factory or ledger write', async () => {
    const subject = setup();
    const current = prepare(subject);
    const hostileRequest = structuredClone(current.request);
    const hostileProgram = hostileRequest.program as unknown as Record<
      string,
      unknown
    >;
    hostileProgram.draftSchemaName = 'forged_schema_name';
    const { digest: _programDigest, ...programPayload } = hostileProgram;
    void _programDigest;
    hostileProgram.digest = canonicalJsonDigest(programPayload);
    const hostileRequestDigest = canonicalJsonDigest(hostileRequest);
    const hostileRequestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${hostileRequestDigest}.json`;
    writeText(
      subject.repoRoot,
      hostileRequestPath,
      canonicalContentAddressedJsonBytes(hostileRequest),
    );
    const {
      digest: _manifestDigest,
      digestAlgorithm: _manifestDigestAlgorithm,
      ...manifestPayload
    } = current.manifest;
    void _manifestDigest;
    void _manifestDigestAlgorithm;
    const hostileManifestPayload = {
      ...manifestPayload,
      request: {
        ...current.manifest.request,
        digest: hostileRequestDigest,
        path: hostileRequestPath,
      },
    };
    const hostileManifest = {
      ...hostileManifestPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(hostileManifestPayload),
    };
    const hostileManifestPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${hostileManifest.digest}.json`;
    writeText(
      subject.repoRoot,
      hostileManifestPath,
      canonicalContentAddressedJsonBytes(hostileManifest),
    );

    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const inputTokenCounterFactory = vi.fn(() => {
      throw new Error('count transport must remain unreachable');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: hostileManifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory, inputTokenCounterFactory },
      ),
    ).rejects.toThrow('Blueprint authoring request is stale or invalid');
    expect(providerFactory).not.toHaveBeenCalled();
    expect(inputTokenCounterFactory).not.toHaveBeenCalled();
    expect(
      fs.existsSync(
        path.join(
          subject.repoRoot,
          QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
        ),
      ),
    ).toBe(false);
  });

  it('claims before lazy provider access, persists a complete Candidate, and replays with zero calls', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const providerCalls = vi.fn();
    const providerFactory = vi.fn(() => {
      const claimDirectory = path.join(
        subject.repoRoot,
        QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
        'execution-claims',
      );
      expect(fs.readdirSync(claimDirectory)).toHaveLength(1);
      return passingProvider(subject.fixture, providerCalls);
    });
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory },
    );
    expect(result.replayed).toBe(false);
    expect(
      result.manifest.stage,
      JSON.stringify(result.receipt, null, 2),
    ).toBe('blueprint_candidate');
    expect(result.receipt.status).toBe('completed');
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(1);
    const claim = JSON.parse(
      fs.readFileSync(path.join(subject.repoRoot, result.claimPath), 'utf8'),
    ) as Record<string, unknown>;
    expect(claim).toMatchObject({
      version: 'qa-wizard-blueprint-execution-claim/v2',
      authoringAuthorityDigest:
        result.manifest.blueprint!.authoringAuthorityDigest,
      executionProgramDigest: preflight.request.program.digest,
    });
    expect(claim.executionIdentityDigest).toBe(
      path.basename(result.claimPath, '.json'),
    );
    expect(claim.executionIdentityDigest).not.toBe(
      claim.authoringAuthorityDigest,
    );
    expect(
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: result.manifestPath,
      }),
    ).toEqual(result.manifest);
    const beforeReplay = fileInventory(path.join(subject.repoRoot, OUTPUT_DIR));
    const forbiddenFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbiddenFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(result.manifest.digest);
    expect(forbiddenFactory).not.toHaveBeenCalled();
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      beforeReplay,
    );
    expect(JSON.stringify(beforeReplay)).not.toContain('must-not-persist');
  });

  it('exact-counts an over-byte repair, publishes a v8 Candidate, and replays without loading either factory', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const invalidFirstDraft = {
      ...(providerDraft(subject.fixture) as Record<string, unknown>),
      worldPlan: 'x'.repeat(80_000),
    };
    const count = vi.fn(
      async (countRequest: BlueprintAuthoringInputTokenCountRequest) => ({
        routeKind: 'repair' as const,
        repairOrdinal: countRequest.repairOrdinal,
        countRequestDigest: canonicalJsonDigest(
          blueprintAuthoringCountRequestProjection(countRequest),
        ),
        outcome: 'counted' as const,
        inputTokens: 50_000,
        unavailableReason: null,
        attestation: {
          provider: 'openai' as const,
          model: 'gpt-5.6-sol',
          route: 'responses_input_tokens' as const,
          evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
          transportDispatchCount: 1,
          transportRetryCount: 0,
          canonicalRouteConfirmed: true,
          canonicalModelConfirmed: true,
        },
      }),
    );
    const providerCalls = vi.fn();
    const providerFactory = vi.fn(
      (): ProductionAuthoringProvider => ({
        call: async (args) => {
          providerCalls(args);
          if (args.attempt === 1) {
            return {
              output: JSON.stringify(invalidFirstDraft),
              receipt: providerReceipt(args),
            };
          }
          expect(args.inputAdmission).toMatchObject({
            admitted: true,
            basis: 'exact_provider_count',
            exactInputTokens: 50_000,
            ordinal: 1,
            generationAttempt: 2,
            probe: {
              status: 'cache_miss',
              transportDisposition: 'dispatched',
            },
          });
          const usage = {
            inputTokens: 50_000,
            cachedInputTokens: 0,
            cacheWriteInputTokens: 0,
            outputTokens: 80,
            reasoningTokens: 20,
            totalTokens: 50_080,
          };
          return {
            output: JSON.stringify(providerDraft(subject.fixture)),
            receipt: {
              ...providerReceipt(args),
              usage: {
                input_tokens: usage.inputTokens,
                cached_input_tokens: usage.cachedInputTokens,
                cache_write_input_tokens: usage.cacheWriteInputTokens,
                output_tokens: usage.outputTokens,
                reasoning_tokens: usage.reasoningTokens,
                total_tokens: usage.totalTokens,
              },
              inputAccounting: args.inputAdmission.inputAccounting,
              nominalEstimatedCostUsd:
                nominalBlueprintAuthoringUsageCostUsd(usage),
              conservativeCallCostUsd:
                conservativeBlueprintAuthoringCostUsd({
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                }),
            },
          };
        },
      }),
    );
    const inputTokenCounterFactory = vi.fn(() => count);

    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory, inputTokenCounterFactory },
    );

    expect(result.replayed).toBe(false);
    expect(result.manifest.stage).toBe('blueprint_candidate');
    expect(result.receipt.version).toBe(
      PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    );
    if (result.receipt.version !== PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION) {
      throw new Error('expected current v8 authoring receipt');
    }
    expect(result.receipt).toMatchObject({
      status: 'completed',
      callCount: 2,
      repairCount: 1,
    });
    expect(result.manifest.receipt?.version).toBe(
      PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    );
    expect(result.manifest.blueprint).not.toBeNull();
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(2);
    expect(inputTokenCounterFactory).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0]![0].userPrompt.length).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
    const repairDecision = result.receipt.admissionDecisions[1]!;
    expect(repairDecision).toMatchObject({
      basis: 'exact_provider_count',
      exactInputTokens: 50_000,
      admitted: true,
    });
    expect(result.receipt.attempts[1]!.inputAdmissionDigest).toBe(
      canonicalJsonDigest(repairDecision),
    );
    expect(result.receipt.attempts[1]!.tokenRelevantRequestDigest).toBe(
      repairDecision.tokenRelevantRequestDigest,
    );
    expect(result.receipt.diagnosticCensusCommitment).not.toBeNull();

    const forbiddenProviderFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const forbiddenCountFactory = vi.fn(() => {
      throw new Error('counter_must_not_load_on_replay');
    });
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: forbiddenProviderFactory,
        inputTokenCounterFactory: forbiddenCountFactory,
      },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.receipt.digest).toBe(result.receipt.digest);
    expect(replay.manifest.digest).toBe(result.manifest.digest);
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCountFactory).not.toHaveBeenCalled();
  });

  it('publishes and replays a v8 failed terminal when exact counting succeeds but repair generation fails before usage exists', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const invalidFirstDraft = {
      ...(providerDraft(subject.fixture) as Record<string, unknown>),
      worldPlan: 'x'.repeat(80_000),
    };
    const count = vi.fn(
      async (countRequest: BlueprintAuthoringInputTokenCountRequest) => ({
        routeKind: 'repair' as const,
        repairOrdinal: countRequest.repairOrdinal,
        countRequestDigest: canonicalJsonDigest(
          blueprintAuthoringCountRequestProjection(countRequest),
        ),
        outcome: 'counted' as const,
        inputTokens: 50_000,
        unavailableReason: null,
        attestation: {
          provider: 'openai' as const,
          model: 'gpt-5.6-sol',
          route: 'responses_input_tokens' as const,
          evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
          transportDispatchCount: 1,
          transportRetryCount: 0,
          canonicalRouteConfirmed: true,
          canonicalModelConfirmed: true,
        },
      }),
    );
    const providerCalls = vi.fn();
    const providerFactory = vi.fn(
      (): ProductionAuthoringProvider => ({
        call: async (args) => {
          providerCalls(args);
          if (args.attempt === 1) {
            return {
              output: JSON.stringify(invalidFirstDraft),
              receipt: providerReceipt(args),
            };
          }
          expect(args.inputAdmission).toMatchObject({
            admitted: true,
            basis: 'exact_provider_count',
            exactInputTokens: 50_000,
            generationAttempt: 2,
          });
          throw new Error('synthetic transport failure before response usage');
        },
      }),
    );
    const inputTokenCounterFactory = vi.fn(() => count);

    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory, inputTokenCounterFactory },
    );

    expect(result.replayed).toBe(false);
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt).toMatchObject({
      version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      status: 'failed',
      callCount: 2,
      repairCount: 1,
      failure: { code: 'provider_call_failed' },
    });
    if (result.receipt.version !== PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION) {
      throw new Error('expected current v8 authoring receipt');
    }
    expect(result.receipt.attempts[1]).toMatchObject({
      usage: null,
      failureCode: 'provider_call_failed',
      failureEvidenceKind: 'raw_provider_exception',
      failureEvidenceReason: 'raw_provider_exception',
    });
    expect(result.receipt.admissionDecisions[1]).toMatchObject({
      basis: 'exact_provider_count',
      exactInputTokens: 50_000,
      admitted: true,
    });
    expect(result.manifest.observabilityCapture).toBeDefined();
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(2);
    expect(inputTokenCounterFactory).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);

    const forbiddenProviderFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const forbiddenCountFactory = vi.fn(() => {
      throw new Error('counter_must_not_load_on_replay');
    });
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: forbiddenProviderFactory,
        inputTokenCounterFactory: forbiddenCountFactory,
      },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.receipt.digest).toBe(result.receipt.digest);
    expect(replay.manifest.digest).toBe(result.manifest.digest);
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCountFactory).not.toHaveBeenCalled();
  });

  it('grandfathers only missing capture evidence on immutable diagnostic-bearing v6 receipts', () => {
    const legacyReceipt = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'lib/visual-package/__tests__/fixtures/legacy-v6-authoring-receipt.json',
        ),
        'utf8',
      ),
    ) as ReplayableProductionAuthoringRunReceipt;
    expect(legacyReceipt.version).toBe('production-blueprint-authoring-receipt/v6');
    expect(qaWizardBlueprintTerminalCaptureRequirement(legacyReceipt)).toBe(
      'legacy_optional',
    );

    const diagnosticLessLegacy = structuredClone(legacyReceipt);
    diagnosticLessLegacy.failure = {
      ...diagnosticLessLegacy.failure!,
      code: 'provider_call_failed',
    };
    for (const attempt of diagnosticLessLegacy.attempts) {
      attempt.validationDiagnostics = { count: 0, codes: [] };
    }
    expect(
      qaWizardBlueprintTerminalCaptureRequirement(diagnosticLessLegacy),
    ).toBe('forbidden');
  });

  it('persists repair-route input ineligibility as a failed terminal and replays with zero calls', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const providerCalls = vi.fn();
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () =>
          repairInputIneligibleProvider(subject.fixture, providerCalls),
      },
    );

    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'repair_route_input_not_admissible',
    );
    expect(result.receipt.callCount).toBe(1);
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(executionIncidentInventory(subject.repoRoot)).toEqual([]);

    const retryFactory = vi.fn(() => passingProvider(subject.fixture));
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: retryFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.receipt.digest).toBe(result.receipt.digest);
    expect(retryFactory).not.toHaveBeenCalled();
  });

  it('fails closed after an orphan claim and never automatically retries', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          hooks: {
            afterClaim() {
              throw new Error('simulated_crash_after_claim');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    const incidents = executionIncidentInventory(subject.repoRoot);
    expect(incidents).toHaveLength(1);
    const incident = JSON.parse(incidents[0]!.bytes) as Record<string, unknown>;
    expect(incident).toMatchObject({
      phase: 'claim_validation',
      receiptAvailable: false,
      receiptDigest: null,
      receiptStatus: null,
      providerOutcome: 'unknown',
      resolution: 'operator_resolution_required_no_redispatch',
      scope: 'single_use_paid_blueprint_authoring_incident',
    });
    expect(JSON.stringify(incident)).not.toContain('simulated_crash_after_claim');
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toMatchObject({
      message: 'execution_state_uncertain',
      incidentPhase: 'claim_validation',
    });
    expect(providerFactory).not.toHaveBeenCalled();
    expect(executionIncidentInventory(subject.repoRoot)).toEqual(incidents);
  });

  it('rejects conflicting incident bytes without overwriting or redispatching', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          hooks: {
            afterClaim() {
              throw new Error('seed_incident');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    const inventory = executionIncidentInventory(subject.repoRoot);
    expect(inventory).toHaveLength(1);
    const incidentPath = path.join(
      subject.repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
      'execution-incidents',
      inventory[0]!.path,
    );
    const hostileBytes = '{"hostile":true}\n';
    fs.writeFileSync(incidentPath, hostileBytes, 'utf8');
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerFactory).not.toHaveBeenCalled();
    expect(fs.readFileSync(incidentPath, 'utf8')).toBe(hostileBytes);
  });

  it('recovers a completed terminal manifest after a crash without another provider call', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          providerFactory: () => passingProvider(subject.fixture),
          hooks: {
            afterTerminalManifest() {
              throw new Error('simulated_crash_before_terminal_lookup');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const recovered = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory },
    );
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.stage).toBe('blueprint_candidate');
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('classifies a crash after receipt as uncertain and never redispatches', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const providerCalls = vi.fn();
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          providerFactory: () => passingProvider(subject.fixture, providerCalls),
          hooks: {
            afterReceipt() {
              throw new Error('simulated_crash_after_receipt');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    const incidents = executionIncidentInventory(subject.repoRoot);
    expect(incidents).toHaveLength(1);
    const incident = JSON.parse(incidents[0]!.bytes) as Record<string, unknown>;
    expect(incident).toMatchObject({
      phase: 'receipt_publication',
      receiptAvailable: true,
      receiptStatus: 'completed',
      providerOutcome: 'unknown',
      resolution: 'operator_resolution_required_no_redispatch',
    });
    expect(incident.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(incident)).not.toContain('simulated_crash_after_receipt');
    const retryFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: retryFactory },
      ),
    ).rejects.toMatchObject({
      message: 'execution_state_uncertain',
      incidentPhase: 'receipt_publication',
    });
    expect(retryFactory).not.toHaveBeenCalled();
    expect(executionIncidentInventory(subject.repoRoot)).toEqual(incidents);
  });

  it('admits only one concurrent owner for the same paid request', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    let releaseProvider!: () => void;
    let providerEntered!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      providerEntered = resolve;
    });
    const providerCalls = vi.fn();
    const providerFactory = vi.fn((): ProductionAuthoringProvider => ({
      call: async (args) => {
        providerCalls(args);
        providerEntered();
        await release;
        return {
          output: JSON.stringify(providerDraft(subject.fixture)),
          receipt: providerReceipt(args),
        };
      },
    }));
    const executeArgs = {
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      write: true as const,
    };
    const owner = executeQaWizardBlueprintLiveRequest(executeArgs, {
      providerFactory,
    });
    await entered;
    await expect(
      executeQaWizardBlueprintLiveRequest(executeArgs, { providerFactory }),
    ).rejects.toThrow('execution_state_uncertain');
    releaseProvider();
    const completed = await owner;
    expect(completed.manifest.stage).toBe('blueprint_candidate');
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(1);
  });

  it('admits only one paid owner across output roots and caller-minted request identities', async () => {
    const subject = setup();
    const firstOutput = 'outputs/blueprint-operator-a';
    const secondOutput = 'outputs/blueprint-operator-b';
    const first = prepareQaWizardBlueprintLiveRequest({
      repoRoot: subject.repoRoot,
      bridgeManifestPath: subject.bridgeManifestPath,
      outputDir: firstOutput,
      requestId: 'caller-request-a',
      requestedAt: '2026-08-25T12:00:00.000Z',
      write: true,
    });
    const second = prepareQaWizardBlueprintLiveRequest({
      repoRoot: subject.repoRoot,
      bridgeManifestPath: subject.bridgeManifestPath,
      outputDir: secondOutput,
      requestId: 'caller-request-b',
      requestedAt: '2026-08-25T12:01:00.000Z',
      write: true,
    });
    let releaseProvider!: () => void;
    let providerEntered!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      providerEntered = resolve;
    });
    const providerCalls = vi.fn();
    const providerFactory = vi.fn((): ProductionAuthoringProvider => ({
      call: async (args) => {
        providerCalls(args);
        providerEntered();
        await release;
        return {
          output: JSON.stringify(providerDraft(subject.fixture)),
          receipt: providerReceipt(args),
        };
      },
    }));
    const owner = executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: first.manifestPath,
        outputDir: firstOutput,
        write: true,
      },
      { providerFactory },
    );
    await entered;
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: second.manifestPath,
          outputDir: secondOutput,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow('execution_identity_already_claimed');
    releaseProvider();
    await expect(owner).resolves.toMatchObject({
      manifest: { stage: 'blueprint_candidate' },
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: second.manifestPath,
          outputDir: secondOutput,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow('execution_identity_already_consumed');
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(
      fs.readdirSync(
        path.join(
          subject.repoRoot,
          QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
          'execution-claims',
        ),
      ),
    ).toHaveLength(1);
  });

  it('rejects partial success usage/evidence during receipt replay', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    const forged = JSON.parse(JSON.stringify(result.receipt)) as Record<
      string,
      unknown
    > & { attempts: Array<Record<string, unknown>>; digest: string };
    forged.attempts[0]!.usage = { inputTokens: 120 };
    forged.attempts[0]!.usageEvidenceComplete = false;
    const {
      digest: _digest,
      digestAlgorithm: _digestAlgorithm,
      ...payload
    } = forged;
    forged.digest = canonicalJsonDigest(payload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: forged,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: forged.digest,
      }),
    ).toBe(false);
    const inconsistentUsage = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown> & {
      attempts: Array<Record<string, unknown>>;
      digest: string;
    };
    inconsistentUsage.attempts[0]!.usage = {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 999,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    };
    const {
      digest: _inconsistentDigest,
      digestAlgorithm: _inconsistentDigestAlgorithm,
      ...inconsistentPayload
    } = inconsistentUsage;
    inconsistentUsage.digest = canonicalJsonDigest(inconsistentPayload);
    expect(() =>
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: inconsistentUsage,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: inconsistentUsage.digest,
      }),
    ).not.toThrow();
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: inconsistentUsage,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: inconsistentUsage.digest,
      }),
    ).toBe(false);
    const hostileAttempts = JSON.parse(JSON.stringify(result.receipt)) as Record<
      string,
      unknown
    > & { attempts: unknown[]; digest: string };
    hostileAttempts.attempts = [null];
    const {
      digest: _hostileDigest,
      digestAlgorithm: _hostileDigestAlgorithm,
      ...hostilePayload
    } = hostileAttempts;
    hostileAttempts.digest = canonicalJsonDigest(hostilePayload);
    expect(() =>
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: hostileAttempts,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: hostileAttempts.digest,
      }),
    ).not.toThrow();
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: hostileAttempts,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: hostileAttempts.digest,
      }),
    ).toBe(false);
    const nonFiniteTopLevel = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown>;
    nonFiniteTopLevel.callCount = Number.POSITIVE_INFINITY;
    expect(() =>
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: nonFiniteTopLevel,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: result.receipt.digest,
      }),
    ).not.toThrow();
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: nonFiniteTopLevel,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(false);
    const arrayDigestConfusion = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown> & { digest: string };
    arrayDigestConfusion.blueprintDigest = [result.receipt.blueprintDigest];
    const {
      digest: _arrayDigest,
      digestAlgorithm: _arrayDigestAlgorithm,
      ...arrayDigestPayload
    } = arrayDigestConfusion;
    arrayDigestConfusion.digest = canonicalJsonDigest(arrayDigestPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: arrayDigestConfusion,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: arrayDigestConfusion.digest,
      }),
    ).toBe(false);
    const arrayAttemptIdentity = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown> & {
      attempts: Array<Record<string, unknown>>;
      digest: string;
    };
    arrayAttemptIdentity.attempts[0]!.provider = ['openai'];
    const {
      digest: _arrayAttemptDigest,
      digestAlgorithm: _arrayAttemptDigestAlgorithm,
      ...arrayAttemptPayload
    } = arrayAttemptIdentity;
    arrayAttemptIdentity.digest = canonicalJsonDigest(arrayAttemptPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: arrayAttemptIdentity,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: arrayAttemptIdentity.digest,
      }),
    ).toBe(false);
    const nonEmittableTerminal = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown> & { digest: string };
    Object.assign(nonEmittableTerminal, {
      status: 'failed',
      blueprintDigest: null,
      authoringProvenanceDigest: null,
      failure: buildAuthoringTerminalFailure({
        code: 'provider_output_decode_failed',
        issueCodes: ['provider_output_decode_failed'],
      }),
    });
    const {
      digest: _nonEmittableDigest,
      digestAlgorithm: _nonEmittableDigestAlgorithm,
      ...nonEmittablePayload
    } = nonEmittableTerminal;
    nonEmittableTerminal.digest = canonicalJsonDigest(nonEmittablePayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: nonEmittableTerminal,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: nonEmittableTerminal.digest,
      }),
    ).toBe(false);
    const impossibleContextTerminal = JSON.parse(
      JSON.stringify(nonEmittableTerminal),
    ) as Record<string, unknown> & { digest: string };
    impossibleContextTerminal.failure = buildAuthoringTerminalFailure({
      code: 'context_invalid',
      issueCodes: ['context_invalid'],
    });
    const {
      digest: _contextDigest,
      digestAlgorithm: _contextDigestAlgorithm,
      ...contextPayload
    } = impossibleContextTerminal;
    impossibleContextTerminal.digest = canonicalJsonDigest(contextPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: impossibleContextTerminal,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: impossibleContextTerminal.digest,
      }),
    ).toBe(false);
  });

  it('accepts only the closed three-validation-attempt replay shape for call-budget terminals', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const calls = vi.fn();
    const exhausted = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => ({
          call: async (args) => {
            calls(args);
            return {
              output: JSON.stringify({ invalid: true }),
              receipt: providerReceipt(args),
            };
          },
        }),
      },
    );
    expect(calls).toHaveBeenCalledTimes(3);
    expect(exhausted.receipt.failure?.code).toBe(
      'draft_validation_repair_exhausted',
    );
    const deniedFourth = JSON.parse(
      JSON.stringify(exhausted.receipt),
    ) as Record<string, unknown> & {
      attempts: Array<{
        validationDiagnostics: { count: number; codes: string[] };
      }>;
      digest: string;
    };
    deniedFourth.failure = buildAuthoringTerminalFailure({
      code: 'call_budget_exhausted',
      issueCodes: ['call_budget_exhausted'],
    });
    const {
      digest: _deniedDigest,
      digestAlgorithm: _deniedDigestAlgorithm,
      ...deniedPayload
    } = deniedFourth;
    deniedFourth.digest = canonicalJsonDigest(deniedPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: deniedFourth,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: deniedFourth.digest,
      }),
    ).toBe(true);
    const missingPriorEvidence = JSON.parse(
      JSON.stringify(deniedFourth),
    ) as typeof deniedFourth;
    missingPriorEvidence.attempts[0]!.validationDiagnostics = {
      count: 0,
      codes: [],
    };
    const {
      digest: _missingPriorDigest,
      digestAlgorithm: _missingPriorDigestAlgorithm,
      ...missingPriorPayload
    } = missingPriorEvidence;
    missingPriorEvidence.digest = canonicalJsonDigest(missingPriorPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: missingPriorEvidence,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: missingPriorEvidence.digest,
      }),
    ).toBe(false);
  });

  it('binds completion-status terminal failure to exact observed provider evidence', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => ({
          call: async (args) => ({
            output: JSON.stringify(providerDraft(subject.fixture)),
            receipt: {
              ...providerReceipt(args),
              completionStatus: 'incomplete',
            },
          }),
        }),
      },
    );
    expect(result.receipt.failure?.code).toBe('completion_status_invalid');
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    const forged = JSON.parse(JSON.stringify(result.receipt)) as Record<
      string,
      unknown
    > & { attempts: Array<Record<string, unknown>>; digest: string };
    Object.assign(forged.attempts[0]!, {
      provider: 'unknown-provider',
      model: 'unknown-model',
      responseId: null,
      responseDigest: null,
      usage: null,
      providerEvidenceVersion: null,
      completionStatus: null,
      usageEvidenceComplete: false,
      nominalEstimatedCostUsd: null,
      conservativeCallCostUsd: null,
      cumulativeConservativeCostUsd: null,
      executionAttestation: {
        evidenceKind: 'not_run',
        logicalProviderCalls: 0,
        transportDispatchCount: 0,
        transportRetryCount: 0,
        fallbackUsed: false,
        canonicalRouteConfirmed: false,
        canonicalModelConfirmed: false,
      },
    });
    forged.executionAttestation = {
      evidenceKind: 'not_run',
      logicalProviderCalls: 0,
      transportDispatchCount: 0,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: false,
      canonicalModelConfirmed: false,
    };
    const {
      digest: _digest,
      digestAlgorithm: _digestAlgorithm,
      ...payload
    } = forged;
    forged.digest = canonicalJsonDigest(payload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: forged,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: forged.digest,
      }),
    ).toBe(false);
  });

  it('persists only closed repair diagnostics and never raw invalid draft material', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const rawSecret = 'RAW_REPAIR_SECRET_MUST_NEVER_PERSIST';
    const calls = vi.fn();
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => ({
          call: async (args) => {
            calls(args);
            return {
              output:
                args.attempt === 1
                  ? JSON.stringify({ rawSecret })
                  : JSON.stringify(providerDraft(subject.fixture)),
              receipt: providerReceipt(args),
            };
          },
        }),
      },
    );
    expect(result.manifest.stage).toBe('blueprint_candidate');
    expect(result.receipt.callCount).toBe(2);
    expect(calls).toHaveBeenCalledTimes(2);
    const inventory = fileInventory(subject.repoRoot);
    expect(JSON.stringify(inventory)).not.toContain(rawSecret);
    const reviewPath = path.join(
      subject.repoRoot,
      result.manifest.blueprint!.reviewPacketPath,
    );
    const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as {
      warnings: string[];
      repairAttemptCount: number;
    };
    expect(review.repairAttemptCount).toBe(1);
    expect(review.warnings.length).toBeGreaterThan(0);
    expect(review.warnings.every((warning) => /^[a-z0-9_ :]+$/.test(warning))).toBe(
      true,
    );
    const missingRepairEvidence = JSON.parse(
      JSON.stringify(result.receipt),
    ) as Record<string, unknown> & {
      attempts: Array<{
        validationDiagnostics: { count: number; codes: string[] };
      }>;
      digest: string;
    };
    missingRepairEvidence.attempts[0]!.validationDiagnostics = {
      count: 0,
      codes: [],
    };
    const {
      digest: _missingRepairDigest,
      digestAlgorithm: _missingRepairDigestAlgorithm,
      ...missingRepairPayload
    } = missingRepairEvidence;
    missingRepairEvidence.digest = canonicalJsonDigest(missingRepairPayload);
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: missingRepairEvidence,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: missingRepairEvidence.digest,
      }),
    ).toBe(false);

    const closedDiagnosticVariants = [
      { count: 1, codes: ['mysecret'] },
      { count: 1, codes: ['provider_call_failed'] },
      {
        count: 1,
        codes: [
          'action_semantic_validation_failed',
          'draft_contract_validation_failed',
          'draft_schema_validation_failed',
        ],
      },
      {
        count: 17,
        codes: [
          'action_semantic_capability_gap',
          'action_semantic_validation_failed',
          'authority_reference_validation_failed',
          'call_budget_exhausted',
          'call_budget_invariant_failed',
          'context_validation_failed',
          'cost_ceiling_exceeded',
          'draft_authority_reference_domain_invalid',
          'draft_contract_validation_failed',
          'draft_schema_validation_failed',
          'draft_validation_repair_regressed',
          'draft_validation_repair_stagnated',
          'input_token_ceiling_exceeded',
          'post_compile_authority_incomplete',
          'provider_adapter_missing',
          'provider_call_failed',
          'provider_completion_invalid',
        ],
      },
      {
        count: 2,
        codes: [
          'source_evidence_validation_failed',
          'draft_contract_validation_failed',
        ],
      },
      {
        count: 2,
        codes: [
          'draft_contract_validation_failed',
          'draft_contract_validation_failed',
        ],
      },
      { count: 0, codes: ['draft_contract_validation_failed'] },
    ];
    for (const diagnostics of closedDiagnosticVariants) {
      const forgedDiagnostics = JSON.parse(
        JSON.stringify(result.receipt),
      ) as Record<string, unknown> & {
        attempts: Array<{
          validationDiagnostics: { count: number; codes: string[] };
        }>;
        digest: string;
      };
      forgedDiagnostics.attempts[0]!.validationDiagnostics = diagnostics;
      const {
        digest: _forgedDigest,
        digestAlgorithm: _forgedDigestAlgorithm,
        ...forgedPayload
      } = forgedDiagnostics;
      forgedDiagnostics.digest = canonicalJsonDigest(forgedPayload);
      expect(() =>
        productionBlueprintAuthoringReceiptReplayIsValid({
          receipt: forgedDiagnostics,
          request: preflight.request,
          expectedStatus: 'completed',
          expectedDigest: forgedDiagnostics.digest,
        }),
      ).not.toThrow();
      expect(
        productionBlueprintAuthoringReceiptReplayIsValid({
          receipt: forgedDiagnostics,
          request: preflight.request,
          expectedStatus: 'completed',
          expectedDigest: forgedDiagnostics.digest,
        }),
      ).toBe(false);
    }
  });

  it('replays a one-error repair whose closed fallback and category codes outnumber the raw issue count', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const calls = vi.fn();
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => ({
          call: async (args) => {
            calls(args);
            return {
              output:
                args.attempt === 1
                  ? '{'
                  : JSON.stringify(providerDraft(subject.fixture)),
              receipt: providerReceipt(args),
            };
          },
        }),
      },
    );
    expect(result.manifest.stage).toBe('blueprint_candidate');
    expect(calls).toHaveBeenCalledTimes(2);
    expect(result.receipt.attempts[0]!.validationDiagnostics).toEqual({
      count: 1,
      codes: [
        'draft_contract_validation_failed',
        'draft_schema_validation_failed',
      ],
      totalCount: 1,
      countSaturated: false,
    });
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'completed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
  });

  it('rejects a nested lifecycle junction before provider access', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const external = tempRoot();
    const authoritiesPath = path.join(
      subject.repoRoot,
      OUTPUT_DIR,
      'blueprint-lifecycle',
      'authorities',
    );
    fs.symlinkSync(
      external,
      authoritiesPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow(/resolves outside the repository|symlink or junction alias/);
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('rechecks lifecycle containment at publish and blocks a post-provider junction swap', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const external = tempRoot();
    const providerCalls = vi.fn();
    let swapped = false;
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          providerFactory: () => passingProvider(subject.fixture, providerCalls),
          hooks: {
            beforeLifecycleArtifactPublish() {
              if (swapped) return;
              swapped = true;
              const authorities = path.join(
                subject.repoRoot,
                OUTPUT_DIR,
                'blueprint-lifecycle',
                'authorities',
              );
              fs.renameSync(authorities, `${authorities}-safe-backup`);
              fs.symlinkSync(
                external,
                authorities,
                process.platform === 'win32' ? 'junction' : 'dir',
              );
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(swapped).toBe(true);
    expect(fileInventory(external)).toEqual([]);
    expect(
      fileInventory(subject.repoRoot).filter((entry) =>
        entry.path.includes('.tmp'),
      ),
    ).toEqual([]);
    const retryFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: retryFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(retryFactory).not.toHaveBeenCalled();
  });

  it.each(['receipt', 'lifecycle', 'terminal'] as const)(
    'rejects an identical-byte hardlink at the %s publication boundary',
    async (surface) => {
      const subject = setup();
      const preflight = prepare(subject);
      const external = tempRoot();
      const providerCalls = vi.fn();
      let installedPath: string | null = null;
      const installHardlink = (
        temporaryPath: string,
        destinationPath: string,
      ): void => {
        if (installedPath !== null) return;
        const source = path.join(external, `${surface}.json`);
        fs.copyFileSync(temporaryPath, source);
        fs.linkSync(source, destinationPath);
        installedPath = destinationPath;
      };
      await expect(
        executeQaWizardBlueprintLiveRequest(
          {
            repoRoot: subject.repoRoot,
            preflightManifestPath: preflight.manifestPath,
            outputDir: OUTPUT_DIR,
            write: true,
          },
          {
            providerFactory: () => passingProvider(subject.fixture, providerCalls),
            hooks: {
              ...(surface === 'receipt'
                ? { beforeReceiptArtifactPublish: installHardlink }
                : {}),
              ...(surface === 'lifecycle'
                ? { beforeLifecycleArtifactPublish: installHardlink }
                : {}),
              ...(surface === 'terminal'
                ? { beforeTerminalLookupPublish: installHardlink }
                : {}),
            },
          },
        ),
      ).rejects.toThrow('execution_state_uncertain');
      expect(providerCalls).toHaveBeenCalledTimes(1);
      expect(installedPath).not.toBeNull();
      expect(fs.lstatSync(installedPath!).nlink).toBe(2);
      expect(
        fileInventory(subject.repoRoot).filter((entry) =>
          entry.path.includes('.tmp'),
        ),
      ).toEqual([]);
      const retryFactory = vi.fn(() => passingProvider(subject.fixture));
      await expect(
        executeQaWizardBlueprintLiveRequest(
          {
            repoRoot: subject.repoRoot,
            preflightManifestPath: preflight.manifestPath,
            outputDir: OUTPUT_DIR,
            write: true,
          },
          { providerFactory: retryFactory },
        ),
      ).rejects.toThrow('execution_state_uncertain');
      expect(retryFactory).not.toHaveBeenCalled();
    },
  );

  it('rejects a semantically equal but byte-noncanonical terminal manifest', async () => {
    const baseline = setup();
    const baselinePreflight = prepare(baseline);
    const baselineResult = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: baseline.repoRoot,
        preflightManifestPath: baselinePreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(baseline.fixture) },
    );

    const subject = setup();
    const preflight = prepare(subject);
    const hostilePath = path.join(
      subject.repoRoot,
      baselineResult.manifestPath,
    );
    const hostileBytes = JSON.stringify(baselineResult.manifest);
    fs.mkdirSync(path.dirname(hostilePath), { recursive: true });
    fs.writeFileSync(hostilePath, hostileBytes, 'utf8');
    const providerCalls = vi.fn();
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture, providerCalls) },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(hostilePath, 'utf8')).toBe(hostileBytes);
    const retryFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: retryFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(retryFactory).not.toHaveBeenCalled();
  });

  it('persists a sanitized terminal failure and replays it with zero calls', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const providerFactory = vi.fn(() => ({
      call: async () => {
        throw new Error('secret_provider_failure_detail');
      },
    }));
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.status).toBe('failed');
    expect(result.manifest.blueprint).toBeNull();
    expect(JSON.stringify(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))))
      .not.toContain('secret_provider_failure_detail');
    const replayFactory = vi.fn(() => passingProvider(subject.fixture));
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: replayFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.stage).toBe('authoring_failed');
    expect(replayFactory).not.toHaveBeenCalled();

    const hostileFailureVariants = [
      (failure: Record<string, unknown>) => {
        const codes = failure.diagnosticCodes as string[];
        failure.diagnosticCodes = [...codes, codes[0]!];
      },
      (failure: Record<string, unknown>) => {
        const codes = failure.diagnosticCodes as string[];
        failure.diagnosticCodes = [
          ...new Set([...codes, 'action_semantic_capability_gap']),
        ].sort();
      },
      (failure: Record<string, unknown>) => {
        failure.diagnosticCount = 1;
        failure.diagnosticCodes = [
          'draft_contract_validation_failed',
          'draft_schema_validation_failed',
          'provider_call_failed',
        ];
      },
      (failure: Record<string, unknown>) => {
        const issues = failure.issues as string[];
        failure.issues = [...issues, issues[0]!];
      },
      (failure: Record<string, unknown>) => {
        failure.issues = ['z_issue', 'a_issue'];
      },
    ];
    for (const mutate of hostileFailureVariants) {
      const forged = JSON.parse(JSON.stringify(result.receipt)) as Record<
        string,
        unknown
      > & { digest: string; failure: Record<string, unknown> };
      mutate(forged.failure);
      const {
        digest: _forgedDigest,
        digestAlgorithm: _forgedDigestAlgorithm,
        ...forgedPayload
      } = forged;
      forged.digest = canonicalJsonDigest(forgedPayload);
      expect(
        productionBlueprintAuthoringReceiptReplayIsValid({
          receipt: forged,
          request: preflight.request,
          expectedStatus: 'failed',
          expectedDigest: forged.digest,
        }),
      ).toBe(false);
    }
  });

  it.each([
    'credential',
    'transport_before_dispatch',
    'transport',
    'empty_output',
  ] as const)(
    'accepts and zero-call replays the canonical adapter %s failure receipt',
    async (failureKind) => {
      const subject = setup();
      const preflight = prepare(subject);
      const readCredential = vi.fn(() => {
        if (failureKind === 'credential') {
          throw new Error('raw credential failure must never persist');
        }
        return 'test-key-must-never-persist';
      });
      const transport: OpenAIResponsesAuthoringTransport & {
        create: ReturnType<typeof vi.fn>;
      } = {
        create: vi.fn(async (request) => {
          if (failureKind === 'transport_before_dispatch') {
            throw new Error('raw pre-dispatch transport failure must never persist');
          }
          request.observations.transportDispatchStarted = true;
          request.observations.transportDispatchCount += 1;
          request.observations.canonicalRouteConfirmed = true;
          request.observations.canonicalModelConfirmed = true;
          if (failureKind === 'transport') {
            throw new Error('raw transport failure must never persist');
          }
          request.observations.httpResponseReceived = true;
          request.observations.httpStatus = 200;
          return {
            id: 'resp-empty-output-1',
            model: 'gpt-5.6-sol',
            status: 'completed',
            output_text: '   ',
            usage: {
              input_tokens: 1_000,
              input_tokens_details: {
                cached_tokens: 100,
                cache_write_tokens: 200,
              },
              output_tokens: 2_000,
              output_tokens_details: { reasoning_tokens: 500 },
              total_tokens: 3_000,
            },
          };
        }),
      };
      const providerFactory = vi.fn(() =>
        createOpenAIResponsesBlueprintAuthoringAdapter({
          readCredential,
          transport,
        }),
      );
      const result = await executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      );
      expect(result.manifest.stage).toBe('authoring_failed');
      expect(result.receipt.failure?.code).toBe(
        failureKind === 'empty_output'
          ? 'provider_evidence_invalid'
          : 'provider_call_failed',
      );
      expect(
        productionBlueprintAuthoringReceiptReplayIsValid({
          receipt: result.receipt as unknown as Record<string, unknown>,
          request: preflight.request,
          expectedStatus: 'failed',
          expectedDigest: result.receipt.digest,
        }),
        JSON.stringify(result.receipt, null, 2),
      ).toBe(true);
      expect(JSON.stringify(result.receipt)).not.toMatch(
        /raw credential failure|raw transport failure|raw pre-dispatch transport failure|test-key-must-never-persist/i,
      );
      if (
        failureKind === 'transport_before_dispatch' ||
        failureKind === 'transport'
      ) {
        const impossibleAdapterAttestation = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        const attestation = impossibleAdapterAttestation.attempts[0]!
          .executionAttestation as Record<string, unknown>;
        if (failureKind === 'transport_before_dispatch') {
          attestation.canonicalModelConfirmed = false;
        } else {
          attestation.canonicalRouteConfirmed = false;
        }
        rebindAggregateAndRedigestReceipt(impossibleAdapterAttestation);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: impossibleAdapterAttestation,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: impossibleAdapterAttestation.digest,
          }),
        ).toBe(false);
      }
      if (failureKind === 'empty_output') {
        const singletonArrayBoundary = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        Object.assign(singletonArrayBoundary.attempts[0]!, {
          provider: ['openai'],
          model: ['gpt-5.6-sol'],
          failureEvidenceKind: ['provider_adapter_boundary'],
        });
        const {
          digest: _singletonDigest,
          digestAlgorithm: _singletonDigestAlgorithm,
          ...singletonPayload
        } = singletonArrayBoundary;
        singletonArrayBoundary.digest = canonicalJsonDigest(singletonPayload);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: singletonArrayBoundary,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: singletonArrayBoundary.digest,
          }),
        ).toBe(false);

        for (const failureEvidenceKind of [
          'provider_adapter_boundary',
          'compiler_response_boundary',
        ] as const) {
          for (const responseEvidenceMutation of [
            { providerEvidenceVersion: null },
            { responseDigest: null },
            { responseId: null },
          ]) {
            const strippedResponseEvidence = JSON.parse(
              JSON.stringify(result.receipt),
            ) as Record<string, unknown> & {
              attempts: Array<Record<string, unknown>>;
              digest: string;
            };
            Object.assign(strippedResponseEvidence.attempts[0]!, {
              failureEvidenceKind,
              ...responseEvidenceMutation,
            });
            rebindAggregateAndRedigestReceipt(strippedResponseEvidence);
            expect(
              productionBlueprintAuthoringReceiptReplayIsValid({
                receipt: strippedResponseEvidence,
                request: preflight.request,
                expectedStatus: 'failed',
                expectedDigest: strippedResponseEvidence.digest,
              }),
            ).toBe(false);
          }
        }

        const compilerResponseBoundary = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        compilerResponseBoundary.attempts[0]!.failureEvidenceKind =
          'compiler_response_boundary';
        rebindAggregateAndRedigestReceipt(compilerResponseBoundary);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: compilerResponseBoundary,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: compilerResponseBoundary.digest,
          }),
        ).toBe(true);
        compilerResponseBoundary.attempts[0]!.executionAttestation =
          notRunAuthoringExecutionAttestation();
        rebindAggregateAndRedigestReceipt(compilerResponseBoundary);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: compilerResponseBoundary,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: compilerResponseBoundary.digest,
          }),
        ).toBe(false);

        const compilerExecutionInvalid = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        Object.assign(compilerExecutionInvalid.attempts[0]!, {
          failureEvidenceKind: 'compiler_response_boundary',
          failureEvidenceReason: 'execution_attestation_invalid',
          executionAttestation: injectedAuthoringExecutionAttestation(),
        });
        rebindAggregateAndRedigestReceipt(compilerExecutionInvalid);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: compilerExecutionInvalid,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: compilerExecutionInvalid.digest,
          }),
        ).toBe(true);
        compilerExecutionInvalid.attempts[0]!.executionAttestation =
          notRunAuthoringExecutionAttestation();
        rebindAggregateAndRedigestReceipt(compilerExecutionInvalid);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: compilerExecutionInvalid,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: compilerExecutionInvalid.digest,
          }),
        ).toBe(false);

        const adapterExecutionInvalid = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        const observedWithoutDispatch = {
          ...(adapterExecutionInvalid.attempts[0]!
            .executionAttestation as Record<string, unknown>),
          transportDispatchCount: 0,
          canonicalRouteConfirmed: false,
          canonicalModelConfirmed: true,
        };
        Object.assign(adapterExecutionInvalid.attempts[0]!, {
          failureEvidenceReason: 'execution_attestation_invalid',
          executionAttestation: observedWithoutDispatch,
        });
        rebindAggregateAndRedigestReceipt(adapterExecutionInvalid);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: adapterExecutionInvalid,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: adapterExecutionInvalid.digest,
          }),
        ).toBe(true);

        for (const impossibleExecutionAttestation of [
          notRunAuthoringExecutionAttestation(),
          injectedAuthoringExecutionAttestation(),
          {
            ...observedWithoutDispatch,
            canonicalModelConfirmed: false,
          },
          {
            ...observedWithoutDispatch,
            transportDispatchCount: 1,
            canonicalRouteConfirmed: false,
          },
        ]) {
          const impossibleExecutionEvidence = JSON.parse(
            JSON.stringify(adapterExecutionInvalid),
          ) as Record<string, unknown> & {
            attempts: Array<Record<string, unknown>>;
            digest: string;
          };
          impossibleExecutionEvidence.attempts[0]!.executionAttestation =
            impossibleExecutionAttestation;
          rebindAggregateAndRedigestReceipt(impossibleExecutionEvidence);
          expect(
            productionBlueprintAuthoringReceiptReplayIsValid({
              receipt: impossibleExecutionEvidence,
              request: preflight.request,
              expectedStatus: 'failed',
              expectedDigest: impossibleExecutionEvidence.digest,
            }),
          ).toBe(false);
        }

        const impossibleStaticAccounting = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        const staticAccounting = impossibleStaticAccounting.attempts[0]!
          .inputAccounting as Record<string, number>;
        staticAccounting.systemBytes! +=
          staticAccounting.schemaBytes! + staticAccounting.separatorBytes!;
        staticAccounting.schemaBytes = 0;
        staticAccounting.separatorBytes = 0;
        const {
          digest: _staticAccountingDigest,
          digestAlgorithm: _staticAccountingDigestAlgorithm,
          ...staticAccountingPayload
        } = impossibleStaticAccounting;
        impossibleStaticAccounting.digest = canonicalJsonDigest(
          staticAccountingPayload,
        );
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: impossibleStaticAccounting,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: impossibleStaticAccounting.digest,
          }),
        ).toBe(false);

        const overCeilingBoundary = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        const overCeilingAccounting = overCeilingBoundary.attempts[0]!
          .inputAccounting as Record<string, number>;
        const overCeilingEstimatedBytes =
          BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS + 1;
        const accountingDelta =
          overCeilingEstimatedBytes - overCeilingAccounting.estimatedBytes!;
        expect(accountingDelta).toBeGreaterThan(0);
        overCeilingAccounting.userBytes! += accountingDelta;
        overCeilingAccounting.estimatedBytes = overCeilingEstimatedBytes;
        const {
          digest: _overCeilingDigest,
          digestAlgorithm: _overCeilingDigestAlgorithm,
          ...overCeilingPayload
        } = overCeilingBoundary;
        overCeilingBoundary.digest = canonicalJsonDigest(overCeilingPayload);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: overCeilingBoundary,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: overCeilingBoundary.digest,
          }),
        ).toBe(false);

        for (const impossibleAdapterBoundary of [
          {
            reason: 'cost_evidence_mismatch',
            providerEvidenceVersion:
              OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
          },
          {
            reason: 'provider_evidence_version_invalid',
            providerEvidenceVersion: null,
          },
        ] as const) {
          const compilerBoundary = JSON.parse(
            JSON.stringify(result.receipt),
          ) as Record<string, unknown> & {
            attempts: Array<Record<string, unknown>>;
            digest: string;
          };
          Object.assign(compilerBoundary.attempts[0]!, {
            failureEvidenceKind: 'compiler_response_boundary',
            failureEvidenceReason: impossibleAdapterBoundary.reason,
            providerEvidenceVersion:
              impossibleAdapterBoundary.providerEvidenceVersion,
          });
          const {
            digest: _compilerDigest,
            digestAlgorithm: _compilerDigestAlgorithm,
            ...compilerPayload
          } = compilerBoundary;
          compilerBoundary.digest = canonicalJsonDigest(compilerPayload);
          expect(
            productionBlueprintAuthoringReceiptReplayIsValid({
              receipt: compilerBoundary,
              request: preflight.request,
              expectedStatus: 'failed',
              expectedDigest: compilerBoundary.digest,
            }),
          ).toBe(true);

          compilerBoundary.attempts[0]!.failureEvidenceKind =
            'provider_adapter_boundary';
          const {
            digest: _adapterDigest,
            digestAlgorithm: _adapterDigestAlgorithm,
            ...adapterPayload
          } = compilerBoundary;
          compilerBoundary.digest = canonicalJsonDigest(adapterPayload);
          expect(
            productionBlueprintAuthoringReceiptReplayIsValid({
              receipt: compilerBoundary,
              request: preflight.request,
              expectedStatus: 'failed',
              expectedDigest: compilerBoundary.digest,
            }),
          ).toBe(false);
        }
      }
      const replayFactory = vi.fn(() => passingProvider(subject.fixture));
      const replay = await executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: replayFactory },
      );
      expect(replay.replayed).toBe(true);
      expect(replay.receipt.digest).toBe(result.receipt.digest);
      expect(replayFactory).not.toHaveBeenCalled();
    },
  );

  it('reads only the exact local OpenAI credential after the execution claim and never persists source material', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const credentialRoot = tempRoot();
    const credentialPath = path.join(credentialRoot, 'approved-local.env');
    const credential = 'sk-test-focused-credential-1234567890';
    const unrelatedSecret = 'postgres-secret-must-not-enter-process-authority';
    fs.writeFileSync(
      credentialPath,
      [
        '# local operator credential source',
        `OPENAI_API_KEY='${credential}'`,
        `DATABASE_URL=${unrelatedSecret}`,
        '',
      ].join('\n'),
      'utf8',
    );
    const beforeRead = vi.fn(() => {
      const claims = path.join(
        subject.repoRoot,
        QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
        'execution-claims',
      );
      expect(fs.existsSync(claims)).toBe(true);
      expect(fs.readdirSync(claims)).toHaveLength(1);
    });
    const readCredential = createLazyLocalOpenAICredentialReader({
      credentialFilePath: credentialPath,
      hooks: { beforeCredentialSourceRead: beforeRead },
    });
    expect(beforeRead).not.toHaveBeenCalled();
    const transport: OpenAIResponsesAuthoringTransport = {
      create: vi.fn(async (request) => {
        expect(request.apiKey).toBe(credential);
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        throw new Error('raw transport failure must not persist');
      }),
    };
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () =>
          createOpenAIResponsesBlueprintAuthoringAdapter({
            readCredential,
            transport,
          }),
      },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(beforeRead).toHaveBeenCalledTimes(1);
    expect(readCredential()).toBe(credential);
    expect(beforeRead).toHaveBeenCalledTimes(1);
    const persisted = JSON.stringify(fileInventory(subject.repoRoot));
    expect(persisted).not.toContain(credential);
    expect(persisted).not.toContain(unrelatedSecret);
    expect(persisted).not.toContain(credentialPath);

    for (const source of [
      'OTHER_KEY=value\n',
      'OPENAI_API_KEY=short\n',
      `${`OPENAI_API_KEY=${credential}\n`.repeat(2)}`,
    ]) {
      const invalidPath = path.join(tempRoot(), 'invalid.env');
      fs.writeFileSync(invalidPath, source, 'utf8');
      const invalidReader = createLazyLocalOpenAICredentialReader({
        credentialFilePath: invalidPath,
      });
      expect(invalidReader).toThrowError('credential_source_invalid');
    }
  });

  it('replays a canonical combined-invalid response using deterministic evidence precedence', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const transport: OpenAIResponsesAuthoringTransport = {
      create: vi.fn(async (request) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        request.observations.httpResponseReceived = true;
        request.observations.httpStatus = 200;
        return {
          model: 'gpt-5.6-sol',
          status: 'incomplete',
          output_text: '',
        };
      }),
    };
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () =>
          createOpenAIResponsesBlueprintAuthoringAdapter({
            readCredential: () => 'test-key-must-never-persist',
            transport,
          }),
      },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.failure?.code).toBe('provider_evidence_invalid');
    expect(result.receipt.attempts[0]).toMatchObject({
      failureEvidenceKind: 'provider_adapter_boundary',
      failureEvidenceReason: 'response_id_invalid',
    });
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    for (const failureEvidenceKind of [
      'provider_adapter_boundary',
      'compiler_response_boundary',
    ] as const) {
      for (const responseEvidenceMutation of [
        { providerEvidenceVersion: null },
        { responseDigest: null },
      ]) {
        const strippedResponseIdEvidence = JSON.parse(
          JSON.stringify(result.receipt),
        ) as Record<string, unknown> & {
          attempts: Array<Record<string, unknown>>;
          digest: string;
        };
        Object.assign(strippedResponseIdEvidence.attempts[0]!, {
          failureEvidenceKind,
          ...responseEvidenceMutation,
        });
        rebindAggregateAndRedigestReceipt(strippedResponseIdEvidence);
        expect(
          productionBlueprintAuthoringReceiptReplayIsValid({
            receipt: strippedResponseIdEvidence,
            request: preflight.request,
            expectedStatus: 'failed',
            expectedDigest: strippedResponseIdEvidence.digest,
          }),
        ).toBe(false);
      }
    }
  });

  it('replays a repair-time credential failure with prior closed diagnostics', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const readCredential = vi.fn(() => {
      if (readCredential.mock.calls.length > 1) {
        throw new Error('raw repair credential failure must never persist');
      }
      return 'test-key-must-never-persist';
    });
    const transport: OpenAIResponsesAuthoringTransport = {
      create: vi.fn(async (request) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        request.observations.httpResponseReceived = true;
        request.observations.httpStatus = 200;
        return {
          id: 'resp-invalid-first-draft',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output_text: '{"invalid":true}',
          usage: {
            input_tokens: 1_000,
            input_tokens_details: {
              cached_tokens: 100,
              cache_write_tokens: 200,
            },
            output_tokens: 2_000,
            output_tokens_details: { reasoning_tokens: 500 },
            total_tokens: 3_000,
          },
        };
      }),
    };
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () =>
          createOpenAIResponsesBlueprintAuthoringAdapter({
            readCredential,
            transport,
          }),
      },
    );
    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(result.receipt.attempts).toHaveLength(2);
    expect(result.receipt.attempts[0]!.validationDiagnostics.count).toBeGreaterThan(
      0,
    );
    expect(result.receipt.attempts[0]!.validationDiagnostics.codes.length).toBeGreaterThan(
      0,
    );
    expect(result.receipt.attempts[1]!.failureEvidenceKind).toBe(
      'provider_adapter_boundary',
    );
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /raw repair credential failure|test-key-must-never-persist/i,
    );
    // The terminal code is the non-mandatory provider_call_failed, but attempt 1 carried
    // grouped validation diagnostics, so the receipt is diagnostic-BEARING and a capture
    // is REQUIRED (derived from receipt evidence, not the terminal code). It is bound and
    // re-validates to the exact digest.
    expect(result.manifest.stage).toBe('authoring_failed');
    const binding = result.manifest.observabilityCapture;
    expect(binding).toBeDefined();
    expect(binding!.digest).toMatch(/^[a-f0-9]{64}$/);
    const boundAbsolute = path.join(subject.repoRoot, binding!.path);
    const boundCapture = JSON.parse(
      fs.readFileSync(boundAbsolute, 'utf8'),
    ) as BlueprintAuthoringSanitizedFailureCapture;
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(boundCapture)).toBe(true);
    expect(boundCapture.terminalFailureCode).toBe('provider_call_failed');
    expect(boundCapture.linkage.terminalReceiptDigest).toBe(result.receipt.digest);
    expect(boundCapture.census.distinctIdentities).toBeGreaterThan(0);
    expect(boundCapture.census.truncated).toBe(false);
    const replayFactory = vi.fn(() => passingProvider(subject.fixture));
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: replayFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.observabilityCapture?.digest).toBe(binding!.digest);
    expect(replayFactory).not.toHaveBeenCalled();
  });

  it('tears a capture-stripped provider_call_failed terminal that carries prior diagnostics', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    // A provider that returns a canonical INVALID initial draft (grouped validation
    // diagnostics on attempt 1), then fails the repair call at the provider boundary.
    const readCredential = vi.fn(() => {
      if (readCredential.mock.calls.length > 1) {
        throw new Error('raw repair credential failure must never persist');
      }
      return 'test-key-must-never-persist';
    });
    const transport: OpenAIResponsesAuthoringTransport = {
      create: vi.fn(async (request) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        request.observations.httpResponseReceived = true;
        request.observations.httpStatus = 200;
        return {
          id: 'resp-invalid-first-draft',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output_text: '{"invalid":true}',
          usage: {
            input_tokens: 1_000,
            input_tokens_details: { cached_tokens: 100, cache_write_tokens: 200 },
            output_tokens: 2_000,
            output_tokens_details: { reasoning_tokens: 500 },
            total_tokens: 3_000,
          },
        };
      }),
    };
    // Fabricate the hostile/legacy on-disk shape: a diagnostic-bearing provider_call_failed
    // terminal published WITHOUT a capture binding, by classifying it as not-required
    // during creation ONLY.
    captureMockState.requiresCapture = false;
    let created;
    try {
      created = await executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          providerFactory: () =>
            createOpenAIResponsesBlueprintAuthoringAdapter({
              readCredential,
              transport,
            }),
        },
      );
    } finally {
      captureMockState.requiresCapture = null;
    }
    expect(created.manifest.stage).toBe('authoring_failed');
    expect(created.receipt.failure?.code).toBe('provider_call_failed');
    expect(created.receipt.attempts[0]!.validationDiagnostics.count).toBeGreaterThan(
      0,
    );
    expect(created.manifest.observabilityCapture).toBeUndefined();
    // With the real receipt-evidence classification restored, the terminal is torn:
    // replay/recovery must refuse before any lookup, and must not load a provider.
    const replayPreflight = prepare(subject);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: replayPreflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
    expect(forbidden).not.toHaveBeenCalled();
  });

  // Builds a real diagnostic-BEARING failed terminal: attempt 1 returns a canonical but
  // INVALID draft (grouped validation diagnostics), the repair call then fails at the
  // provider boundary -> terminal code provider_call_failed, capture REQUIRED and bound.
  function diagnosticBearingProviderFactory() {
    const readCredential = vi.fn(() => {
      if (readCredential.mock.calls.length > 1) {
        throw new Error('raw repair credential failure must never persist');
      }
      return 'test-key-must-never-persist';
    });
    const transport: OpenAIResponsesAuthoringTransport = {
      create: vi.fn(async (request) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        request.observations.httpResponseReceived = true;
        request.observations.httpStatus = 200;
        return {
          id: 'resp-invalid-first-draft',
          model: 'gpt-5.6-sol',
          status: 'completed',
          output_text: '{"invalid":true}',
          usage: {
            input_tokens: 1_000,
            input_tokens_details: { cached_tokens: 100, cache_write_tokens: 200 },
            output_tokens: 2_000,
            output_tokens_details: { reasoning_tokens: 500 },
            total_tokens: 3_000,
          },
        };
      }),
    };
    return () =>
      createOpenAIResponsesBlueprintAuthoringAdapter({ readCredential, transport });
  }

  // Re-sign a terminal manifest on disk with a substituted observability-capture binding.
  // The manifest is content-addressed, so this recomputes its digest, writes it under the
  // new digest, and removes the old file — a faithful hostile on-disk shape, not a mock.
  function resignTerminalManifestWithCapture(
    repoRoot: string,
    result: { manifest: QaWizardBlueprintAuthoringManifest; manifestPath: string },
    capture: { version: string; digest: string; path: string },
  ): string {
    const {
      digest: _oldDigest,
      digestAlgorithm,
      ...rest
    } = result.manifest as unknown as Record<string, unknown>;
    const newPayload = { ...rest, observabilityCapture: capture };
    const newDigest = canonicalJsonDigest(newPayload);
    const newManifest = { ...newPayload, digestAlgorithm, digest: newDigest };
    const manifestsDir = path.join(
      repoRoot,
      OUTPUT_DIR,
      'blueprint-authoring-manifests',
    );
    fs.rmSync(path.join(repoRoot, result.manifestPath), { force: true });
    fs.writeFileSync(
      path.join(manifestsDir, `${newDigest}.json`),
      canonicalContentAddressedJsonBytes(newManifest),
      'utf8',
    );
    return newDigest;
  }

  it('tears a diagnostic-less terminal that carries an unexpected capture on replay', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: diagnosticBearingProviderFactory() },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.manifest.observabilityCapture).toBeDefined();
    // Force the shared classifier to treat this exact receipt as NOT requiring a capture.
    // The bound capture is now an unexpected extra on a (classified) diagnostic-less
    // terminal: the required<->present equivalence must tear on replay, with zero
    // provider and no new lookup.
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    captureMockState.requiresCapture = false;
    try {
      await expect(
        executeQaWizardBlueprintLiveRequest(
          {
            repoRoot: subject.repoRoot,
            preflightManifestPath: preflight.manifestPath,
            outputDir: OUTPUT_DIR,
            write: true,
          },
          { providerFactory: forbidden },
        ),
      ).rejects.toThrow(/execution_state_uncertain/);
    } finally {
      captureMockState.requiresCapture = null;
    }
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('tears a required terminal rebinding a valid capture from another receipt (recovery)', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: diagnosticBearingProviderFactory() },
    );
    const binding = result.manifest.observabilityCapture;
    expect(binding).toBeDefined();
    // A structurally VALID capture bound to a DIFFERENT terminal receipt.
    const foreign = JSON.parse(
      fs.readFileSync(path.join(subject.repoRoot, binding!.path), 'utf8'),
    ) as BlueprintAuthoringSanitizedFailureCapture;
    foreign.linkage.terminalReceiptDigest = 'a'.repeat(64);
    const { digest: _drop, ...foreignWithoutDigest } =
      foreign as unknown as Record<string, unknown>;
    (foreign as unknown as { digest: string }).digest =
      canonicalJsonDigest(foreignWithoutDigest);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(foreign)).toBe(true);
    expect(foreign.digest).not.toBe(binding!.digest);
    // Publish it at THIS outputDir's canonical location so containment passes and the
    // LINKAGE mismatch is what tears.
    const foreignCapturePath = `${OUTPUT_DIR}/sanitized-failure-captures/${foreign.digest}.json`;
    fs.writeFileSync(
      path.join(subject.repoRoot, foreignCapturePath),
      blueprintAuthoringSanitizedFailureCaptureBytes(foreign),
      'utf8',
    );
    resignTerminalManifestWithCapture(subject.repoRoot, result, {
      version: BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
      digest: foreign.digest,
      path: foreignCapturePath,
    });
    stripTerminalLedger(subject.repoRoot);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_recovery');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
    expect(forbidden).not.toHaveBeenCalled();
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(0);
  });

  it('tears a required terminal whose capture is bound under another output root (recovery)', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: diagnosticBearingProviderFactory() },
    );
    const binding = result.manifest.observabilityCapture;
    expect(binding).toBeDefined();
    // The SAME valid capture (valid linkage), but written under a DIFFERENT output root
    // and bound there. Containment under THIS outputDir must tear before any read.
    const capture = JSON.parse(
      fs.readFileSync(path.join(subject.repoRoot, binding!.path), 'utf8'),
    ) as BlueprintAuthoringSanitizedFailureCapture;
    const foreignRootPath = `outputs/blueprint-operator-elsewhere/sanitized-failure-captures/${binding!.digest}.json`;
    fs.mkdirSync(path.dirname(path.join(subject.repoRoot, foreignRootPath)), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(subject.repoRoot, foreignRootPath),
      blueprintAuthoringSanitizedFailureCaptureBytes(capture),
      'utf8',
    );
    resignTerminalManifestWithCapture(subject.repoRoot, result, {
      version: binding!.version,
      digest: binding!.digest,
      path: foreignRootPath,
    });
    stripTerminalLedger(subject.repoRoot);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_recovery');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
    expect(forbidden).not.toHaveBeenCalled();
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(0);
  });

  it('replays an exact pre-response adapter policy failure', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const provider: ProductionAuthoringProvider = {
      call: async (args) => {
        const inputAccounting = blueprintAuthoringInputAccounting({
          systemPrompt: args.systemPrompt,
          userPrompt: args.userPrompt,
          schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
        });
        throw new ProductionAuthoringProviderBoundaryError(
          'provider_policy_mismatch',
          {
            provider: 'openai',
            model: 'gpt-5.6-sol',
            providerEvidenceVersion:
              OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
            inputAccounting,
            reservedExposureBeforeCallUsd:
              blueprintAuthoringReservedExposureUsd({
                conservativeAccountedCostUsd: 0,
                callsCompleted: 0,
              }),
            executionAttestation: notRunAuthoringExecutionAttestation(),
          },
          'adapter_policy_mismatch',
        );
      },
    };
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => provider },
    );
    expect(result.receipt.failure?.code).toBe('provider_policy_mismatch');
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request: preflight.request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
    const replayFactory = vi.fn(() => passingProvider(subject.fixture));
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: replayFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replayFactory).not.toHaveBeenCalled();
  });

  it('rejects reordered receipt bytes even when semantic value and digest match', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const receiptPath = path.join(subject.repoRoot, result.receiptPath);
    const parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<
      string,
      unknown
    > & { attempts: Array<Record<string, unknown>> };
    const reordered = Object.fromEntries(
      Object.entries({
        ...parsed,
        attempts: parsed.attempts.map((attempt) =>
          Object.fromEntries(Object.entries(attempt).reverse()),
        ),
      }).reverse(),
    );
    fs.writeFileSync(
      receiptPath,
      `${JSON.stringify(reordered, null, 2)}\n`,
      'utf8',
    );
    const replayFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: replayFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(replayFactory).not.toHaveBeenCalled();
  });

  it('rejects an on-disk non-finite receipt as stale without escaping the loader boundary', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const receiptPath = path.join(subject.repoRoot, result.receiptPath);
    const canonicalBytes = fs.readFileSync(receiptPath, 'utf8');
    const hostileBytes = canonicalBytes.replace(
      /"callCount": 1,/,
      '"callCount": 1e400,',
    );
    expect(hostileBytes).not.toBe(canonicalBytes);
    fs.writeFileSync(receiptPath, hostileBytes, 'utf8');
    const replayFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: replayFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(replayFactory).not.toHaveBeenCalled();
  });

  it('records one exact Guy approval and rejects a second timestamp without residue', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const candidate = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const approvalArgs = {
      repoRoot: subject.repoRoot,
      candidateManifestPath: candidate.manifestPath,
      outputDir: OUTPUT_DIR,
      expectedBlueprintDigest:
        candidate.manifest.blueprint!.blueprintDigest,
      expectedAuthoringAuthorityDigest:
        candidate.manifest.blueprint!.authoringAuthorityDigest,
      expectedReviewPacketDigest:
        candidate.manifest.blueprint!.reviewPacketDigest,
      approvedBy: 'Guy' as const,
      approvedAt: APPROVED_AT,
    };
    const preview = recordQaWizardBlueprintApproval({
      ...approvalArgs,
      write: false,
    });
    expect(preview.manifest.stage).toBe('blueprint_approved');
    expect(fs.existsSync(path.join(subject.repoRoot, preview.approvalPath))).toBe(
      false,
    );
    const written = recordQaWizardBlueprintApproval({
      ...approvalArgs,
      write: true,
    });
    expect(
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: written.manifestPath,
      }),
    ).toEqual(written.manifest);
    const inventoryBeforeReplay = fileInventory(
      path.join(subject.repoRoot, OUTPUT_DIR),
    );
    const replay = recordQaWizardBlueprintApproval({
      ...approvalArgs,
      write: true,
    });
    expect(replay.attestation.digest).toBe(written.attestation.digest);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      inventoryBeforeReplay,
    );
    expect(() =>
      recordQaWizardBlueprintApproval({
        ...approvalArgs,
        approvedAt: '2026-08-25T12:31:00.000Z',
        write: true,
      }),
    ).toThrow(/different approval/);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      inventoryBeforeReplay,
    );
  });

  it('publishes the candidate-keyed approval decision before variable artifacts and recovers exact replay', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const candidate = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const approvalArgs = {
      repoRoot: subject.repoRoot,
      candidateManifestPath: candidate.manifestPath,
      outputDir: OUTPUT_DIR,
      expectedBlueprintDigest:
        candidate.manifest.blueprint!.blueprintDigest,
      expectedAuthoringAuthorityDigest:
        candidate.manifest.blueprint!.authoringAuthorityDigest,
      expectedReviewPacketDigest:
        candidate.manifest.blueprint!.reviewPacketDigest,
      approvedBy: 'Guy' as const,
      approvedAt: APPROVED_AT,
      write: true,
    };
    const preview = recordQaWizardBlueprintApproval({
      ...approvalArgs,
      write: false,
    });
    expect(() =>
      recordQaWizardBlueprintApproval(approvalArgs, {
        hooks: {
          afterApprovalDecision() {
            throw new Error('simulated_crash_after_approval_decision');
          },
        },
      }),
    ).toThrow('simulated_crash_after_approval_decision');
    expect(fs.existsSync(path.join(subject.repoRoot, preview.approvalPath))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(subject.repoRoot, preview.manifestPath))).toBe(
      false,
    );
    expect(() =>
      recordQaWizardBlueprintApproval({
        ...approvalArgs,
        approvedAt: '2026-08-25T12:31:00.000Z',
      }),
    ).toThrow(/approval decision.*conflicts|different approval decision/);
    const recovered = recordQaWizardBlueprintApproval(approvalArgs);
    expect(recovered.manifest.stage).toBe('blueprint_approved');
    expect(
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: recovered.manifestPath,
      }),
    ).toEqual(recovered.manifest);
  });

  it('rejects added manifest and nested callBudget keys before any provider access', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const manifestAbsolute = path.join(subject.repoRoot, preflight.manifestPath);
    const originalManifest = fs.readFileSync(manifestAbsolute, 'utf8');
    const hostileManifest = JSON.parse(originalManifest) as Record<string, unknown>;
    hostileManifest.hostileExtraKey = true;
    fs.writeFileSync(manifestAbsolute, `${JSON.stringify(hostileManifest)}\n`, 'utf8');
    expect(() =>
      loadQaWizardBlueprintAuthoringManifest({
        repoRoot: subject.repoRoot,
        manifestPath: preflight.manifestPath,
      }),
    ).toThrow(/invalid or tampered/);
    fs.writeFileSync(manifestAbsolute, originalManifest, 'utf8');

    const requestAbsolute = path.join(subject.repoRoot, preflight.requestPath);
    const originalRequest = fs.readFileSync(requestAbsolute, 'utf8');
    const hostileRequest = JSON.parse(originalRequest) as {
      callBudget: Record<string, unknown>;
    };
    hostileRequest.callBudget.hostileExtraKey = true;
    fs.writeFileSync(
      requestAbsolute,
      `${JSON.stringify(hostileRequest, null, 2)}\n`,
      'utf8',
    );
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow(/request.*canonical|request.*invalid/i);
    expect(providerFactory).not.toHaveBeenCalled();
  });
});

describe('QA Wizard Blueprint failed-terminal sanitized capture integration', () => {
  function captureAbsolutePath(
    repoRoot: string,
    manifest: { observabilityCapture?: { path: string } },
  ): string {
    return path.join(repoRoot, manifest.observabilityCapture!.path);
  }

  async function runFailedTerminal(subject: ReturnType<typeof setup>) {
    const preflight = prepare(subject);
    return executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => repairInputIneligibleProvider(subject.fixture) },
    );
  }

  it('durably publishes, binds, and re-validates the sanitized capture alongside the terminal receipt', async () => {
    const subject = setup();
    const result = await runFailedTerminal(subject);

    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.status).toBe('failed');
    // The terminal manifest binds the capture as an authority (not an orphan sibling).
    const binding = result.manifest.observabilityCapture;
    expect(binding).toBeDefined();
    expect(binding!.version).toBe(
      BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
    );
    expect(binding!.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(binding!.path).toContain('sanitized-failure-captures/');

    // The bound file exists, is canonical, and re-validates to the exact digest.
    const absolute = captureAbsolutePath(subject.repoRoot, result.manifest);
    expect(fs.existsSync(absolute)).toBe(true);
    expect(path.basename(absolute)).toBe(`${binding!.digest}.json`);
    const rawBytes = fs.readFileSync(absolute, 'utf8');
    const capture = JSON.parse(rawBytes) as BlueprintAuthoringSanitizedFailureCapture;
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    expect(capture.digest).toBe(binding!.digest);
    expect(rawBytes).toBe(blueprintAuthoringSanitizedFailureCaptureBytes(capture));

    // It is linkage-bound to THIS terminal and is pure observability.
    expect(capture.linkage.terminalReceiptDigest).toBe(result.receipt.digest);
    expect(capture.linkage.requestDigest).toBe(result.receipt.requestDigest);
    expect(capture.terminalFailureCode).toBe(result.receipt.failure?.code);
    expect(capture.doesNotAuthorize).toContain('provider_dispatch');
    expect(capture.doesNotAuthorize).toContain('replacement_authorization');

    // Complete census; both admission decisions accounted; no prose survives.
    expect(capture.census.truncated).toBe(false);
    expect(capture.census.omittedDistinctIdentities).toBe(0);
    expect(capture.census.retainedIdentities).toBe(
      capture.census.distinctIdentities,
    );
    expect(result.receipt.version).toBe(PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION);
    const currentReceipt = result.receipt as ProductionAuthoringRunReceipt;
    const diagnosticAttempts = currentReceipt.attempts.filter(
      (attempt) => attempt.diagnosticCensusCommitment !== null,
    );
    expect(capture.attemptCensuses).toHaveLength(diagnosticAttempts.length);
    for (const entry of capture.attemptCensuses) {
      const commitment =
        currentReceipt.attempts[entry.attempt - 1]!.diagnosticCensusCommitment;
      expect(commitment).toEqual({
        version: commitment!.version,
        totalEmitted: entry.census.totalEmitted,
        distinctIdentities: entry.census.distinctIdentities,
        fullCensusDigest: entry.census.fullCensusDigest,
      });
    }
    expect(
      capture.admission.decisions.some((decision) => decision.routeKind === 'repair'),
    ).toBe(true);
    expect(rawBytes).not.toContain('Chameleon');
  });

  it('re-validates the bound capture on replay with zero provider calls', async () => {
    const subject = setup();
    const first = await runFailedTerminal(subject);
    const preflight = prepare(subject);
    const forbiddenFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbiddenFactory },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(first.manifest.digest);
    expect(replay.manifest.observabilityCapture?.digest).toBe(
      first.manifest.observabilityCapture?.digest,
    );
    expect(forbiddenFactory).not.toHaveBeenCalled();
  });

  it('mints, persists, recovers, and replays an exact 223 -> 89 -> 5 per-attempt census', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const drafts = new Map([
      [1, draftWithExactInvalidAffordanceCount(subject.fixture, 223)],
      [2, draftWithExactInvalidAffordanceCount(subject.fixture, 89)],
      [3, draftWithExactInvalidAffordanceCount(subject.fixture, 5)],
    ]);
    const providerCalls = vi.fn();
    const providerFactory = vi.fn(
      (): ProductionAuthoringProvider => ({
        call: async (args) => {
          providerCalls(args);
          const draft = drafts.get(args.attempt);
          if (!draft) throw new Error('unexpected offline generation attempt');
          return {
            output: JSON.stringify(draft),
            receipt: providerReceiptWithInputTokens(
              args,
              args.attempt === 2 ? 50_000 : 120,
            ),
          };
        },
      }),
    );
    const count = vi.fn(
      async (countRequest: BlueprintAuthoringInputTokenCountRequest) => ({
        routeKind: 'repair' as const,
        repairOrdinal: countRequest.repairOrdinal,
        countRequestDigest: canonicalJsonDigest(
          blueprintAuthoringCountRequestProjection(countRequest),
        ),
        outcome: 'counted' as const,
        inputTokens: 50_000,
        unavailableReason: null,
        attestation: {
          provider: 'openai' as const,
          model: BLUEPRINT_AUTHORING_MODEL,
          route: 'responses_input_tokens' as const,
          evidenceVersion: BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
          transportDispatchCount: 1,
          transportRetryCount: 0,
          canonicalRouteConfirmed: true,
          canonicalModelConfirmed: true,
        },
      }),
    );
    const inputTokenCounterFactory = vi.fn(() => count);
    const executionArgs = {
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      write: true,
    } as const;

    const first = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory,
      inputTokenCounterFactory,
    });
    expect(first.replayed).toBe(false);
    expect(first.manifest.stage).toBe('authoring_failed');
    expect(first.manifest.blueprint).toBeNull();
    expect(first.receipt.version).toBe(PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION);
    if (first.receipt.version !== PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION) {
      throw new Error('expected current v8 authoring receipt');
    }
    expect(first.receipt).toMatchObject({
      status: 'failed',
      callCount: 3,
      repairCount: 2,
      failure: { code: 'draft_validation_repair_exhausted' },
    });
    expect(
      first.receipt.attempts.map((attempt) => attempt.validationDiagnostics),
    ).toEqual([
      expect.objectContaining({
        count: 128,
        totalCount: 223,
        countSaturated: true,
      }),
      expect.objectContaining({
        count: 89,
        totalCount: 89,
        countSaturated: false,
      }),
      expect.objectContaining({
        count: 5,
        totalCount: 5,
        countSaturated: false,
      }),
    ]);
    expect(
      first.receipt.attempts.map(
        (attempt) => attempt.diagnosticCensusCommitment?.totalEmitted,
      ),
    ).toEqual([223, 89, 5]);
    expect(first.receipt.diagnosticCensusCommitment?.totalEmitted).toBe(317);
    expect(providerFactory).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveBeenCalledTimes(3);
    expect(inputTokenCounterFactory).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);

    const capturePath = captureAbsolutePath(subject.repoRoot, first.manifest);
    const captureBytes = fs.readFileSync(capturePath, 'utf8');
    const capture = JSON.parse(
      captureBytes,
    ) as BlueprintAuthoringSanitizedFailureCapture;
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(capture)).toBe(true);
    expect(capture.linkage.terminalReceiptDigest).toBe(first.receipt.digest);
    expect(capture.attemptCensuses.map((entry) => entry.census.totalEmitted)).toEqual(
      [223, 89, 5],
    );
    expect(capture.census.totalEmitted).toBe(317);
    expect(capture.attemptCensuses[2]!.census.distinctIdentities).toBe(5);
    expect(capture.attemptCensuses[2]!.census.identities).toHaveLength(5);
    expect(capture.attemptCensuses[2]!.census.fullCensusDigest).toBe(
      first.receipt.attempts[2]!.diagnosticCensusCommitment?.fullCensusDigest,
    );
    expect(captureBytes).toBe(
      blueprintAuthoringSanitizedFailureCaptureBytes(capture),
    );
    expect(captureBytes).not.toMatch(
      /offline_invalid|synthetic_invalid|child:hero|test-key|provider output/i,
    );
    expect(JSON.stringify(first.receipt)).not.toMatch(
      /offline_invalid|synthetic_invalid|child:hero/i,
    );

    fs.rmSync(
      path.join(
        subject.repoRoot,
        QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
        'terminal-lookups',
      ),
      { recursive: true, force: true },
    );
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(0);
    const forbiddenProviderFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_for_census_recovery_or_replay');
    });
    const forbiddenCounterFactory = vi.fn(() => {
      throw new Error('counter_must_not_load_for_census_recovery_or_replay');
    });
    const recovered = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenProviderFactory,
      inputTokenCounterFactory: forbiddenCounterFactory,
    });
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(first.manifest.digest);
    expect(recovered.receipt.digest).toBe(first.receipt.digest);
    expect(recovered.manifest.observabilityCapture?.digest).toBe(capture.digest);
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(1);
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCounterFactory).not.toHaveBeenCalled();

    const afterRecovery = fileInventory(path.join(subject.repoRoot, OUTPUT_DIR));
    const replay = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenProviderFactory,
      inputTokenCounterFactory: forbiddenCounterFactory,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(first.manifest.digest);
    expect(replay.receipt.digest).toBe(first.receipt.digest);
    expect(replay.manifest.observabilityCapture?.digest).toBe(capture.digest);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      afterRecovery,
    );
    expect(fs.readFileSync(capturePath, 'utf8')).toBe(captureBytes);
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCounterFactory).not.toHaveBeenCalled();
  });

  it('rejects a valid same-aggregate capture whose attempt censuses are swapped', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => ({
          call: async (args) => {
            const draft = structuredClone(providerDraft(subject.fixture)) as any;
            if (args.attempt === 1) draft.frames[0].camera = null;
            if (args.attempt === 2) draft.frames[0].placements = [];
            if (args.attempt === 3) draft.frames[0].continuity = null;
            return {
              output: JSON.stringify(draft),
              receipt: providerReceipt(args),
            };
          },
        }),
      },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    const originalCapture = JSON.parse(
      fs.readFileSync(captureAbsolutePath(subject.repoRoot, result.manifest), 'utf8'),
    ) as BlueprintAuthoringSanitizedFailureCapture;
    expect(originalCapture.attemptCensuses).toHaveLength(3);
    expect(
      new Set(
        originalCapture.attemptCensuses.map(
          (entry) => entry.census.fullCensusDigest,
        ),
      ).size,
    ).toBeGreaterThan(1);

    const hostileCapture = structuredClone(originalCapture);
    const leftIndex = hostileCapture.attemptCensuses.findIndex(
      (entry, index, entries) =>
        entries.some(
          (candidate, candidateIndex) =>
            candidateIndex > index &&
            candidate.census.fullCensusDigest !== entry.census.fullCensusDigest,
        ),
    );
    const rightIndex = hostileCapture.attemptCensuses.findIndex(
      (entry, index) =>
        index > leftIndex &&
        entry.census.fullCensusDigest !==
          hostileCapture.attemptCensuses[leftIndex]!.census.fullCensusDigest,
    );
    expect(leftIndex).toBeGreaterThanOrEqual(0);
    expect(rightIndex).toBeGreaterThan(leftIndex);
    const first = hostileCapture.attemptCensuses[leftIndex]!.census;
    hostileCapture.attemptCensuses[leftIndex]!.census =
      hostileCapture.attemptCensuses[rightIndex]!.census;
    hostileCapture.attemptCensuses[rightIndex]!.census = first;
    const { digest: _captureDigest, ...hostileCapturePayload } = hostileCapture;
    hostileCapture.digest = canonicalJsonDigest(hostileCapturePayload);
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(hostileCapture)).toBe(
      true,
    );
    const hostileCapturePath = `${OUTPUT_DIR}/sanitized-failure-captures/${hostileCapture.digest}.json`;
    writeText(
      subject.repoRoot,
      hostileCapturePath,
      canonicalContentAddressedJsonBytes(hostileCapture),
    );

    const {
      digest: _manifestDigest,
      digestAlgorithm,
      ...manifestShared
    } = result.manifest;
    const hostileManifestPayload = {
      ...manifestShared,
      observabilityCapture: {
        version: hostileCapture.version,
        digest: hostileCapture.digest,
        path: hostileCapturePath,
      },
    };
    const hostileManifest = {
      ...hostileManifestPayload,
      digestAlgorithm,
      digest: canonicalJsonDigest(hostileManifestPayload),
    };
    const hostileManifestPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${hostileManifest.digest}.json`;
    writeText(
      subject.repoRoot,
      hostileManifestPath,
      canonicalContentAddressedJsonBytes(hostileManifest),
    );
    fs.rmSync(path.join(subject.repoRoot, result.manifestPath), { force: true });
    for (const category of ['terminal-lookups', 'terminal-bindings']) {
      fs.rmSync(
        path.join(
          subject.repoRoot,
          QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
          category,
        ),
        { recursive: true, force: true },
      );
    }
    const forbiddenFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_for_attempt_swap');
    });
    const replayPreflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: replayPreflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbiddenFactory },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
    expect(forbiddenFactory).not.toHaveBeenCalled();
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(0);
  });

  it('fails closed on replay when the bound capture is tampered', async () => {
    const subject = setup();
    const result = await runFailedTerminal(subject);
    const absolute = captureAbsolutePath(subject.repoRoot, result.manifest);
    // Tamper the on-disk capture bytes (still valid JSON, wrong content/digest).
    fs.writeFileSync(absolute, '{}\n', 'utf8');
    const preflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture) },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
  });

  it('fails closed on replay when the bound capture is missing', async () => {
    const subject = setup();
    const result = await runFailedTerminal(subject);
    const absolute = captureAbsolutePath(subject.repoRoot, result.manifest);
    fs.rmSync(absolute);
    const preflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture) },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
  });

  it('binds no capture on a completed candidate terminal', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    expect(result.manifest.stage).toBe('blueprint_candidate');
    expect(result.manifest.observabilityCapture).toBeUndefined();
    const captureDir = path.join(
      subject.repoRoot,
      OUTPUT_DIR,
      'sanitized-failure-captures',
    );
    expect(fs.existsSync(captureDir)).toBe(false);
  });

  it('binds no capture on a diagnostic-less boundary failure and replays without one', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => policyMismatchProvider() },
    );
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.failure?.code).toBe('provider_policy_mismatch');
    // Diagnostic-less boundary failure: explicitly allowed to bind no capture.
    expect(result.manifest.observabilityCapture).toBeUndefined();
    expect(
      fs.existsSync(
        path.join(subject.repoRoot, OUTPUT_DIR, 'sanitized-failure-captures'),
      ),
    ).toBe(false);
    // It replays cleanly with no provider load and no capture requirement.
    const replayPreflight = prepare(subject);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const replay = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: replayPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbidden },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(result.manifest.digest);
    expect(replay.manifest.observabilityCapture).toBeUndefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'prompt-v5',
      systemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V5,
      expectedPromptVersion:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V5,
    },
    {
      label: 'prompt-v6',
      systemPromptDigest:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      expectedPromptVersion:
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6,
    },
  ] as const)(
    'recovers and replays a completed request-v4 $label terminal from its absolute prompt digest with zero paid dependencies',
    async ({ systemPromptDigest, expectedPromptVersion }) => {
      const subject = setup();
      const currentPreflight = prepare(subject);
      const currentResult = await executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: currentPreflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture) },
      );
      const historical = materializeHistoricalCompletedTerminal({
        subject,
        currentPreflight,
        currentResult,
        target: { kind: 'request_v4', systemPromptDigest },
      });
      expect(historical.provenance.promptVersion).toBe(expectedPromptVersion);

      const authoringAuthorityDigest =
        historical.blueprintAuthority.authoringAuthorityDigest;
      const claimPayload = {
        version: LEGACY_QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
        authoringAuthorityDigest,
        requestDigest: historical.requestDigest,
        preflightManifestDigest: historical.preflight.digest,
        preflightManifestPath: historical.preflightPath,
        requestedAt: historical.request.requestedAt,
        scope: 'single_use_paid_blueprint_authoring' as const,
      };
      const claim = {
        ...claimPayload,
        digestAlgorithm: 'canonical-json-sha256' as const,
        digest: canonicalJsonDigest(claimPayload),
      };
      stripTerminalLedger(subject.repoRoot);
      writeText(
        subject.repoRoot,
        `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${authoringAuthorityDigest}.json`,
        canonicalContentAddressedJsonBytes(claim),
      );
      const terminalBytes = fs.readFileSync(
        path.join(subject.repoRoot, historical.terminalPath),
        'utf8',
      );
      const receiptBytes = fs.readFileSync(
        path.join(subject.repoRoot, historical.receiptPath),
        'utf8',
      );
      const forbiddenProviderFactory = vi.fn(() => {
        throw new Error('provider_must_not_load_for_v4_completed_replay');
      });
      const forbiddenCountFactory = vi.fn(() => {
        throw new Error('counter_must_not_load_for_v4_completed_replay');
      });
      const executionArgs = {
        repoRoot: subject.repoRoot,
        preflightManifestPath: historical.preflightPath,
        outputDir: OUTPUT_DIR,
        write: true,
      } as const;
      const recovered = await executeQaWizardBlueprintLiveRequest(
        executionArgs,
        {
          providerFactory: forbiddenProviderFactory,
          inputTokenCounterFactory: forbiddenCountFactory,
        },
      );
      expect(recovered.replayed).toBe(true);
      expect(recovered.manifest.digest).toBe(historical.terminal.digest);
      expect(recovered.receipt.digest).toBe(historical.receipt.digest);
      expect(terminalLookupFileCount(subject.repoRoot)).toBe(1);
      const afterRecovery = fileInventory(
        path.join(subject.repoRoot, OUTPUT_DIR),
      );

      const replay = await executeQaWizardBlueprintLiveRequest(executionArgs, {
        providerFactory: forbiddenProviderFactory,
        inputTokenCounterFactory: forbiddenCountFactory,
      });
      expect(replay.replayed).toBe(true);
      expect(replay.manifest.digest).toBe(historical.terminal.digest);
      expect(replay.receipt.digest).toBe(historical.receipt.digest);
      expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
        afterRecovery,
      );
      expect(
        fs.readFileSync(
          path.join(subject.repoRoot, historical.terminalPath),
          'utf8',
        ),
      ).toBe(terminalBytes);
      expect(
        fs.readFileSync(
          path.join(subject.repoRoot, historical.receiptPath),
          'utf8',
        ),
      ).toBe(receiptBytes);
      expect(forbiddenProviderFactory).not.toHaveBeenCalled();
      expect(forbiddenCountFactory).not.toHaveBeenCalled();
    },
  );

  it('rejects a coordinated current-v7 receipt relabel under the frozen-v6 program', async () => {
    const subject = setup();
    const currentPreflight = prepare(subject);
    const currentResult = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: currentPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const request = {
      ...structuredClone(currentPreflight.request),
      program: structuredClone(
        LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
      ),
    };
    const receipt = structuredClone(currentResult.receipt) as unknown as Record<
      string,
      unknown
    > & {
      attempts: Array<Record<string, unknown>>;
      digest: string;
      requestDigest: string;
    };
    receipt.requestDigest = canonicalJsonDigest(request);
    receipt.attempts[0]!.systemPromptDigest =
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6
        .authoringSystemPromptDigest;
    rebindAggregateAndRedigestReceipt(receipt);

    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt,
        request,
        expectedStatus: 'completed',
        expectedDigest: receipt.digest,
      }),
    ).toBe(false);
  });

  it('recovers and replays a completed frozen request-v5/program-v6 terminal with zero paid dependencies', async () => {
    const subject = setup();
    const currentPreflight = prepare(subject);
    const providerCalls = vi.fn();
    const currentResult = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: currentPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, providerCalls) },
    );
    const historical = materializeHistoricalCompletedTerminal({
      subject,
      currentPreflight,
      currentResult,
      target: {
        kind: 'request_v5_frozen_v6',
        systemPromptDigest:
          LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      },
      providerCalls,
    });
    const authoringAuthorityDigest =
      historical.blueprintAuthority.authoringAuthorityDigest;
    const executionIdentityDigest =
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest,
        program: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
      });
    const claimPayload = {
      version: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
      authoringAuthorityDigest,
      executionIdentityDigest,
      executionProgramDigest:
        LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6.digest,
      requestDigest: historical.requestDigest,
      preflightManifestDigest: historical.preflight.digest,
      preflightManifestPath: historical.preflightPath,
      requestedAt: historical.request.requestedAt,
      scope: 'single_use_paid_blueprint_authoring' as const,
    };
    const claim = {
      ...claimPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(claimPayload),
    };
    stripTerminalLedger(subject.repoRoot);
    writeText(
      subject.repoRoot,
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${executionIdentityDigest}.json`,
      canonicalContentAddressedJsonBytes(claim),
    );
    writeTerminalBindingForHistoricalExecution({
      repoRoot: subject.repoRoot,
      executionIdentityDigest,
      authoringAuthorityDigest,
      requestDigest: historical.requestDigest,
      preflightManifestDigest: historical.preflight.digest,
      terminalManifestDigest: historical.terminal.digest,
      terminalManifestPath: historical.terminalPath,
    });
    const forbiddenProviderFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_for_frozen_completed_replay');
    });
    const forbiddenCountFactory = vi.fn(() => {
      throw new Error('counter_must_not_load_for_frozen_completed_replay');
    });
    const executionArgs = {
      repoRoot: subject.repoRoot,
      preflightManifestPath: historical.preflightPath,
      outputDir: OUTPUT_DIR,
      write: true,
    } as const;
    const recovered = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenProviderFactory,
      inputTokenCounterFactory: forbiddenCountFactory,
    });
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(historical.terminal.digest);
    expect(recovered.receipt.digest).toBe(historical.receipt.digest);
    expect(historical.provenance.promptVersion).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_PROMPT_VERSION_V6,
    );
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(1);
    const afterRecovery = fileInventory(path.join(subject.repoRoot, OUTPUT_DIR));

    const replay = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenProviderFactory,
      inputTokenCounterFactory: forbiddenCountFactory,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(historical.terminal.digest);
    expect(replay.receipt.digest).toBe(historical.receipt.digest);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      afterRecovery,
    );
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCountFactory).not.toHaveBeenCalled();
  });

  it('recovers and replays a frozen replacement terminal before the current-program precheck and with zero paid dependencies', async () => {
    const subject = setup();
    const currentPreflight = prepare(subject);
    const providerCalls = vi.fn();
    const currentResult = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: currentPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, providerCalls) },
    );
    const historical = materializeHistoricalCompletedTerminal({
      subject,
      currentPreflight,
      currentResult,
      target: {
        kind: 'request_v5_frozen_v6',
        systemPromptDigest:
          LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6,
      },
      providerCalls,
    });
    const authoringAuthorityDigest =
      historical.blueprintAuthority.authoringAuthorityDigest;
    const predecessorExecutionIdentity =
      qaWizardBlueprintOrdinaryExecutionIdentityDigest({
        authoringAuthorityDigest,
        program: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
      });
    const predecessorClaimPayload = {
      version: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
      authoringAuthorityDigest,
      executionIdentityDigest: predecessorExecutionIdentity,
      executionProgramDigest:
        LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6.digest,
      requestDigest: historical.requestDigest,
      preflightManifestDigest: historical.preflight.digest,
      preflightManifestPath: historical.preflightPath,
      requestedAt: historical.request.requestedAt,
      scope: 'single_use_paid_blueprint_authoring' as const,
    };
    const predecessorClaim = {
      ...predecessorClaimPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(predecessorClaimPayload),
    };
    const predecessorClaimPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${predecessorExecutionIdentity}.json`;
    const predecessorClaimBytes =
      canonicalContentAddressedJsonBytes(predecessorClaim);
    writeText(subject.repoRoot, predecessorClaimPath, predecessorClaimBytes);

    const proposal = buildBlueprintReplacementProposal({
      reason: 'orphan_claim_unknown_provider_outcome',
      predecessor: {
        claimVersion: predecessorClaim.version,
        claimDigest: predecessorClaim.digest,
        claimPath: predecessorClaimPath,
        claimByteLength: Buffer.byteLength(predecessorClaimBytes, 'utf8'),
        claimSha256: createHash('sha256')
          .update(predecessorClaimBytes, 'utf8')
          .digest('hex'),
        authoringAuthorityDigest,
        requestDigest: historical.requestDigest,
        preflightManifestDigest: historical.preflight.digest,
        preflightManifestPath: historical.preflightPath,
        requestedAt: historical.request.requestedAt as string,
      },
      current: {
        authoringAuthorityDigest,
        requestDigest: historical.requestDigest,
        preflightManifestDigest: historical.preflight.digest,
        preflightManifestPath: historical.preflightPath,
        outputDir: OUTPUT_DIR,
        requestId: historical.request.requestId as string,
        requestedAt: historical.request.requestedAt as string,
      },
      preparedBy: 'Codex',
      preparedAt: '2026-08-25T12:10:00.000Z',
    });
    const proposalPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/replacement-proposals/${proposal.digest}.json`;
    writeText(
      subject.repoRoot,
      proposalPath,
      canonicalContentAddressedJsonBytes(proposal),
    );
    const review = buildBlueprintReplacementReview({
      proposal,
      proposalPath,
      reviewedBy: 'claude_code',
      reviewedAt: '2026-08-25T12:20:00.000Z',
    });
    const reviewPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/replacement-reviews/${review.digest}.json`;
    writeText(
      subject.repoRoot,
      reviewPath,
      canonicalContentAddressedJsonBytes(review),
    );
    const authorization = buildBlueprintReplacementAuthorization({
      proposal,
      proposalPath,
      review,
      reviewPath,
      approvedBy: 'Guy',
      approvedAt: APPROVED_AT,
    });
    const authorizationPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/replacement-authorizations/${authorization.digest}.json`;
    writeText(
      subject.repoRoot,
      authorizationPath,
      canonicalContentAddressedJsonBytes(authorization),
    );
    const successorClaim = buildBlueprintReplacementExecutionClaim({
      authorization,
      authorizationPath,
      requestedAt: historical.request.requestedAt as string,
      preflightManifestPath: historical.preflightPath,
    });
    stripTerminalLedger(subject.repoRoot);
    writeText(
      subject.repoRoot,
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${authorization.successorExecutionDigest}.json`,
      canonicalContentAddressedJsonBytes(successorClaim),
    );
    writeTerminalBindingForHistoricalExecution({
      repoRoot: subject.repoRoot,
      executionIdentityDigest: authorization.successorExecutionDigest,
      authoringAuthorityDigest,
      requestDigest: historical.requestDigest,
      preflightManifestDigest: historical.preflight.digest,
      terminalManifestDigest: historical.terminal.digest,
      terminalManifestPath: historical.terminalPath,
    });

    const forbiddenProviderFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_for_frozen_replacement_replay');
    });
    const forbiddenCountFactory = vi.fn(() => {
      throw new Error('counter_must_not_load_for_frozen_replacement_replay');
    });
    const executionArgs = {
      repoRoot: subject.repoRoot,
      authorizationPath,
      authorizationDigest: authorization.digest,
      preflightManifestPath: historical.preflightPath,
      outputDir: OUTPUT_DIR,
      write: true,
    } as const;
    const recovered = await executeBlueprintReplacementLiveRequest(
      executionArgs,
      {
        providerFactory: forbiddenProviderFactory,
        inputTokenCounterFactory: forbiddenCountFactory,
      },
    );
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(historical.terminal.digest);
    expect(recovered.receipt.digest).toBe(historical.receipt.digest);
    expect(recovered.claimPath).toContain(
      authorization.successorExecutionDigest,
    );
    const afterRecovery = fileInventory(path.join(subject.repoRoot, OUTPUT_DIR));

    const replay = await executeBlueprintReplacementLiveRequest(executionArgs, {
      providerFactory: forbiddenProviderFactory,
      inputTokenCounterFactory: forbiddenCountFactory,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(historical.terminal.digest);
    expect(replay.executionRecordPath).toBe(recovered.executionRecordPath);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      afterRecovery,
    );
    expect(forbiddenProviderFactory).not.toHaveBeenCalled();
    expect(forbiddenCountFactory).not.toHaveBeenCalled();
  });

  it('recovers and replays a writer-shaped request-v4/receipt-v6 failed terminal without provider dispatch', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    const result = await runFailedTerminal(subject);
    expect(result.manifest.stage).toBe('authoring_failed');
    expect(result.receipt.version).toBe(
      PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    );
    expect(result.manifest.observabilityCapture).toBeDefined();

    // Rebuild the immutable request-v4/receipt-v6 shape used by the durable
    // replacement terminal. Receipt v6 predates admission-ledger/capture
    // publication, so those later authorities must not be backfilled.
    const { program: _program, ...requestWithoutProgram } = preflight.request;
    void _program;
    const legacyRequest = {
      ...requestWithoutProgram,
      version: LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
    };
    const legacyRequestDigest = canonicalJsonDigest(legacyRequest);
    const legacyRequestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${legacyRequestDigest}.json`;
    writeText(
      subject.repoRoot,
      legacyRequestPath,
      canonicalContentAddressedJsonBytes(legacyRequest),
    );

    const {
      digest: _preflightDigest,
      digestAlgorithm: _preflightDigestAlgorithm,
      ...preflightPayload
    } = preflight.manifest;
    void _preflightDigest;
    void _preflightDigestAlgorithm;
    const legacyPreflightPayload = {
      ...preflightPayload,
      request: {
        ...preflight.manifest.request,
        version: LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
        digest: legacyRequestDigest,
        path: legacyRequestPath,
      },
    };
    const legacyPreflight = {
      ...legacyPreflightPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(legacyPreflightPayload),
    };
    const legacyPreflightPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${legacyPreflight.digest}.json`;
    writeText(
      subject.repoRoot,
      legacyPreflightPath,
      canonicalContentAddressedJsonBytes(legacyPreflight),
    );

    const legacyReceipt = structuredClone(result.receipt) as unknown as Record<
      string,
      unknown
    > & {
      version: string;
      attempts: Array<Record<string, unknown>>;
      digest: string;
      requestDigest: string;
    };
    legacyReceipt.requestDigest = legacyRequestDigest;
    legacyReceipt.version = LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6;
    delete legacyReceipt.admissionDecisions;
    delete legacyReceipt.diagnosticCensusCommitment;
    for (const attempt of legacyReceipt.attempts) {
      attempt.systemPromptDigest =
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_DIGEST_V6;
      const accounting = attempt.inputAccounting as Record<string, number>;
      accounting.systemBytes =
        LEGACY_PRE_RENDER_BLUEPRINT_AUTHORING_SYSTEM_PROMPT_UTF8_BYTES_V6;
      accounting.schemaBytes = Buffer.byteLength(
        JSON.stringify(LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6),
        'utf8',
      );
      accounting.estimatedBytes =
        accounting.protocolAllowance +
        accounting.schemaBytes +
        accounting.separatorBytes +
        accounting.systemBytes +
        accounting.userBytes;
      delete attempt.inputAdmissionDigest;
      delete attempt.tokenRelevantRequestDigest;
      delete attempt.diagnosticCensusCommitment;
      const diagnostics = attempt.validationDiagnostics as Record<string, unknown>;
      attempt.validationDiagnostics = {
        count: diagnostics.count,
        codes: diagnostics.codes,
      };
    }
    rebindAggregateAndRedigestReceipt(legacyReceipt);
    const legacyReceiptPath = `${OUTPUT_DIR}/authoring-receipts/${legacyReceipt.digest}.json`;
    writeText(
      subject.repoRoot,
      legacyReceiptPath,
      canonicalContentAddressedJsonBytes(legacyReceipt),
    );

    const {
      digest: _terminalDigest,
      digestAlgorithm: _terminalDigestAlgorithm,
      observabilityCapture: _currentObservabilityCapture,
      ...terminalPayload
    } = result.manifest;
    void _terminalDigest;
    void _terminalDigestAlgorithm;
    void _currentObservabilityCapture;
    const legacyTerminalPayload = {
      ...terminalPayload,
      predecessor: {
        version: legacyPreflight.version,
        digest: legacyPreflight.digest,
        path: legacyPreflightPath,
      },
      request: legacyPreflight.request,
      receipt: {
        version: LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6,
        digest: legacyReceipt.digest,
        path: legacyReceiptPath,
        status: 'failed' as const,
      },
    };
    const legacyTerminal = {
      ...legacyTerminalPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(legacyTerminalPayload),
    };
    const legacyTerminalPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${legacyTerminal.digest}.json`;
    writeText(
      subject.repoRoot,
      legacyTerminalPath,
      canonicalContentAddressedJsonBytes(legacyTerminal),
    );

    const loaded = loadQaWizardBlueprintAuthoringManifest({
      repoRoot: subject.repoRoot,
      manifestPath: legacyTerminalPath,
    });
    expect(loaded.stage).toBe('authoring_failed');
    expect(loaded.request.version).toBe(
      LEGACY_PRODUCTION_AUTHORING_RUN_REQUEST_VERSION_V4,
    );
    expect(loaded.receipt?.version).toBe(
      LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6,
    );
    expect(loaded.observabilityCapture).toBeUndefined();

    // Reconstruct the frozen pre-current execution claim under the legacy
    // content-authority key. This is the exact durable state that could exist
    // after a v4/v6 terminal became visible but before its lookup was
    // published. Recovery and the subsequent direct replay must both validate
    // the legacy receipt/capture pair without reaching a paid boundary.
    const currentClaim = JSON.parse(
      fs.readFileSync(path.join(subject.repoRoot, result.claimPath), 'utf8'),
    ) as { authoringAuthorityDigest: string };
    const legacyClaimPayload = {
      version: LEGACY_QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
      authoringAuthorityDigest: currentClaim.authoringAuthorityDigest,
      requestDigest: legacyRequestDigest,
      preflightManifestDigest: legacyPreflight.digest,
      preflightManifestPath: legacyPreflightPath,
      requestedAt: legacyRequest.requestedAt,
      scope: 'single_use_paid_blueprint_authoring' as const,
    };
    const legacyClaim = {
      ...legacyClaimPayload,
      digestAlgorithm: 'canonical-json-sha256' as const,
      digest: canonicalJsonDigest(legacyClaimPayload),
    };
    stripTerminalLedger(subject.repoRoot);
    writeText(
      subject.repoRoot,
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${currentClaim.authoringAuthorityDigest}.json`,
      canonicalContentAddressedJsonBytes(legacyClaim),
    );
    const forbiddenFactory = vi.fn(() => {
      throw new Error('provider_must_not_load_for_legacy_recovery_or_replay');
    });
    const executionArgs = {
      repoRoot: subject.repoRoot,
      preflightManifestPath: legacyPreflightPath,
      outputDir: OUTPUT_DIR,
      write: true,
    } as const;
    const recovered = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenFactory,
    });
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(legacyTerminal.digest);
    expect(recovered.receipt.version).toBe(
      LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V6,
    );
    expect(recovered.manifest.observabilityCapture).toBeUndefined();
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(1);
    expect(forbiddenFactory).not.toHaveBeenCalled();

    const replay = await executeQaWizardBlueprintLiveRequest(executionArgs, {
      providerFactory: forbiddenFactory,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(legacyTerminal.digest);
    expect(replay.receipt.digest).toBe(legacyReceipt.digest);
    expect(replay.manifest.observabilityCapture).toBeUndefined();
    expect(replay.executionRecordPath).toBe(recovered.executionRecordPath);
    expect(terminalLookupFileCount(subject.repoRoot)).toBe(1);
    expect(forbiddenFactory).not.toHaveBeenCalled();
  });

  it('rejects on replay a diagnostic-bearing terminal that lacks its required capture binding', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    // Fabricate a fully-consistent capture-less authoring_failed terminal for a
    // diagnostic-bearing failure by treating it as diagnostic-less during creation
    // ONLY — the on-disk shape of a hostile/legacy artifact that keeps the
    // diagnostic-bearing failure code but omits the capture binding.
    captureMockState.requiresCapture = false;
    let created;
    try {
      created = await executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => repairInputIneligibleProvider(subject.fixture) },
      );
    } finally {
      captureMockState.requiresCapture = null;
    }
    expect(created.manifest.stage).toBe('authoring_failed');
    expect(created.receipt.failure?.code).toBe(
      'repair_route_input_not_admissible',
    );
    expect(created.manifest.observabilityCapture).toBeUndefined();
    // With the real classification restored, the terminal is torn: replay/recovery
    // must refuse to adopt it as a completed terminal, and must not load a provider.
    const replayPreflight = prepare(subject);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: replayPreflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('drives a diagnostic-bearing capture derivation overflow into the incident path, not an ordinary terminal', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    // The sanitized census overflows the fail-closed hard bound: the runner yields a
    // derivation_failed disposition, which must become an incident — never an ordinary
    // replayable authoring_failed terminal that claims a census it does not have.
    captureMockState.buildThrows =
      'sanitized census would omit distinct identities (9999 > 4096); refusing to mint an incomplete census';
    try {
      await expect(
        executeQaWizardBlueprintLiveRequest(
          {
            repoRoot: subject.repoRoot,
            preflightManifestPath: preflight.manifestPath,
            outputDir: OUTPUT_DIR,
            write: true,
          },
          {
            providerFactory: () => repairInputIneligibleProvider(subject.fixture),
          },
        ),
      ).rejects.toThrow(/execution_state_uncertain/);
    } finally {
      captureMockState.buildThrows = null;
    }
    // No capture and no ordinary terminal were published; re-entry stays torn (the
    // incident is durable) instead of replaying a completed terminal.
    expect(
      fs.existsSync(
        path.join(subject.repoRoot, OUTPUT_DIR, 'sanitized-failure-captures'),
      ),
    ).toBe(false);
    const replayPreflight = prepare(subject);
    await expect(
      executeQaWizardBlueprintLiveRequest(
        {
          repoRoot: subject.repoRoot,
          preflightManifestPath: replayPreflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture) },
      ),
    ).rejects.toThrow(/execution_state_uncertain/);
  });
});
