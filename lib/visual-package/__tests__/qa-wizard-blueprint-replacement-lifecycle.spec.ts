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

import {
  QA_WIZARD_CANDIDATE_BRIDGE_MANIFEST_VERSION,
  type QaWizardCandidateBridgeManifest,
} from '../qaWizardCandidateBridge';
import {
  QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
  QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
  QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION,
  authorizeBlueprintDiagnosticSuccessorCandidate,
  approveBlueprintReplacementProposal,
  executeBlueprintDiagnosticSuccessorLiveRequest,
  executeBlueprintReplacementLiveRequest,
  executeQaWizardBlueprintLiveRequest,
  prepareBlueprintDiagnosticSuccessorCandidate,
  prepareBlueprintReplacementProposal,
  prepareQaWizardBlueprintLiveRequest,
  qaWizardBlueprintOrdinaryExecutionIdentityDigest,
  reviewBlueprintReplacementProposal,
} from '../qaWizardBlueprintAuthoringLifecycle';
import {
  LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
} from '../blueprintAuthoringExecutionProgram';
import {
  buildProductionAuthoringContext,
  type ProductionAuthoringContext,
} from '../productionAuthoringContext';
import { buildStorySourceAuthoritySnapshot } from '../storySourceAuthority';
import { STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH } from '../styleAuthority';
import {
  BLUEPRINT_AUTHORING_MODEL,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringReservedExposureUsd,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from '../blueprintAuthoringPolicy';
import { PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA } from '../preRenderBlueprintDraftSchema';
import {
  LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
  PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  aggregateProductionAuthoringExecutionAttestations,
  type ProductionAuthoringProvider,
} from '../productionAuthoringRunner';
import {
  BLUEPRINT_AUTHORING_COUNT_EVIDENCE_VERSION,
  blueprintAuthoringCountRequestProjection,
  type BlueprintAuthoringInputTokenCounter,
  type BlueprintAuthoringInputTokenCountRequest,
} from '../blueprintAuthoringInputTokenAdmission';
import {
  BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
  LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
  type BlueprintAuthoringSanitizedFailureCapture,
} from '../blueprintAuthoringSanitizedFailureCapture';
import {
  frozenBlueprintRepairUserPromptV6,
  rebindReceiptPromptEvidenceToFrozenV6,
} from './fixtures/frozen-blueprint-authoring-v6-evidence';
import {
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
  PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3,
} from '../preRenderBlueprintProviderWire';
import type { AuthoringExecutionAttestation } from '../authoringTerminalDiagnostics';
import { canonicalJsonDigest } from '../integrity';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import {
  QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
  blueprintReplacementSuccessorExecutionDigest,
  buildBlueprintReplacementAuthorization,
  buildBlueprintReplacementProposal,
  buildBlueprintReplacementReview,
} from '../qaWizardBlueprintReplacementAuthority';
import {
  buildBlueprintFixture,
  buildVisualContractCandidateFixture,
} from './pre-render-book-visual-blueprint.fixtures';
import {
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CAPTURE_VERSION,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CENSUS_VERSION,
  QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_RECEIPT_VERSION,
  buildBlueprintDiagnosticSuccessorAuthorization,
  buildBlueprintDiagnosticSuccessorCandidate,
  buildBlueprintDiagnosticSuccessorExecutionClaim,
  blueprintDiagnosticSuccessorAuthorizationIsValid,
  blueprintDiagnosticSuccessorCandidateIsValid,
  type QaWizardBlueprintDiagnosticSuccessorLineage,
} from '../qaWizardBlueprintDiagnosticSuccessorAuthority';
import {
  parseBlueprintDiagnosticSuccessorCliArgs,
  runBlueprintDiagnosticSuccessorCliAsync,
} from '../qaWizardBlueprintDiagnosticSuccessorCli';

const tempRoots: string[] = [];
const OUTPUT_DIR = 'outputs/blueprint-operator';
const REQUESTED_AT = '2026-08-25T12:00:00.000Z';
const PREPARED_AT = '2026-08-26T09:00:00.000Z';
const REVIEWED_AT = '2026-08-26T09:30:00.000Z';
const APPROVED_AT = '2026-08-26T10:00:00.000Z';
const STYLE_ID = 'soft_hand_drawn_storybook';

afterEach(() => {
  bridgeLoaderMock.mockReset();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'qa-wizard-blueprint-replacement-'),
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
  const bridgeManifestPath = `outputs/bridge/bridge-manifests/${bridge.digest}.json`;
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
    inputAccounting: blueprintAuthoringInputAccounting({
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    }),
    reservedExposureBeforeCallUsd: blueprintAuthoringReservedExposureUsd({
      conservativeAccountedCostUsd: (args.attempt - 1) * conservativeCallCostUsd,
      callsCompleted: args.attempt - 1,
    }),
    nominalEstimatedCostUsd: nominalBlueprintAuthoringUsageCostUsd(usage),
    conservativeCallCostUsd,
  };
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

function prepare(subject: ReturnType<typeof setup>, requestId = 'blueprint-live-request-001') {
  return prepareQaWizardBlueprintLiveRequest({
    repoRoot: subject.repoRoot,
    bridgeManifestPath: subject.bridgeManifestPath,
    outputDir: OUTPUT_DIR,
    requestId,
    requestedAt: REQUESTED_AT,
    write: true,
  });
}

function ledgerFile(repoRoot: string, ...segments: string[]): string {
  return path.join(repoRoot, QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT, ...segments);
}

/**
 * Reduces a completed ordinary execution to the historical orphan: a durable
 * published claim with no receipt, no terminal manifest, no terminal lookup and
 * no incident. The predecessor claim bytes are left byte-for-byte intact.
 */
async function orphanedPredecessor(subject: ReturnType<typeof setup>) {
  const preflight = prepare(subject);
  const completed = await executeQaWizardBlueprintLiveRequest(
    {
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      write: true,
    },
    { providerFactory: () => passingProvider(subject.fixture) },
  );
  const authoringAuthorityDigest =
    completed.manifest.blueprint!.authoringAuthorityDigest;
  const predecessorExecutionDigest = path.basename(
    completed.claimPath,
    '.json',
  );
  const claimBefore = fs.readFileSync(
    path.join(subject.repoRoot, completed.claimPath),
    'utf8',
  );
  // Delete every downstream terminal artifact, preserving only the claim. A
  // real orphan is a claim written before any terminal manifest/binding, so the
  // terminal binding (written after the manifest) is absent too.
  fs.rmSync(
    path.join(subject.repoRoot, completed.executionRecordPath),
  );
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-bindings', `${predecessorExecutionDigest}.json`),
  );
  fs.rmSync(path.join(subject.repoRoot, completed.manifestPath));
  fs.rmSync(path.join(subject.repoRoot, completed.receiptPath));
  fs.rmSync(
    path.join(
      subject.repoRoot,
      OUTPUT_DIR,
      'blueprint-lifecycle',
      'authorities',
      authoringAuthorityDigest,
    ),
    { recursive: true, force: true },
  );
  return {
    preflight,
    authoringAuthorityDigest,
    predecessorExecutionDigest,
    predecessorClaimPath: completed.claimPath,
    claimBefore,
  };
}

/**
 * Reconstructs the legacy pre-Round-2 crash state: a completed ordinary
 * execution whose terminal MANIFEST (and receipt/lifecycle) remain on disk, but
 * whose terminal binding and terminal lookup were never written. Ordinary
 * recovery still adopts such a terminal, so it is recoverable — NOT an orphan.
 * The predecessor claim bytes are left byte-for-byte intact.
 */
async function legacyUnboundTerminalPredecessor(subject: ReturnType<typeof setup>) {
  const preflight = prepare(subject);
  const completed = await executeQaWizardBlueprintLiveRequest(
    {
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      write: true,
    },
    { providerFactory: () => passingProvider(subject.fixture) },
  );
  const authoringAuthorityDigest =
    completed.manifest.blueprint!.authoringAuthorityDigest;
  const predecessorExecutionDigest = path.basename(
    completed.claimPath,
    '.json',
  );
  const claimBefore = fs.readFileSync(
    path.join(subject.repoRoot, completed.claimPath),
    'utf8',
  );
  // Round-2 wrote a terminal binding and lookup; a legacy crash predates both.
  fs.rmSync(
    path.join(subject.repoRoot, completed.executionRecordPath),
  );
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-bindings', `${predecessorExecutionDigest}.json`),
  );
  return {
    preflight,
    authoringAuthorityDigest,
    predecessorExecutionDigest,
    predecessorClaimPath: completed.claimPath,
    claimBefore,
    completed,
  };
}

describe('QA Wizard Blueprint replacement (orphan-claim successor) lifecycle', () => {
  it('advances an unresolved orphan through proposal → review → Guy approval → one successor execution and replays with zero calls', async () => {
    const subject = setup();
    const {
      preflight,
      authoringAuthorityDigest,
      predecessorClaimPath,
      claimBefore,
    } =
      await orphanedPredecessor(subject);

    const proposal = prepareBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      reason: 'orphan_claim_unknown_provider_outcome',
      preparedBy: 'Codex',
      preparedAt: PREPARED_AT,
      write: true,
    });
    // The predecessor binding's claimDigest is the ordinary claim's own
    // canonical digest — NOT the content authoring-authority digest (which is
    // only the ledger key/filename). Assert both independently.
    const predecessorClaimDigest = (
      JSON.parse(claimBefore) as { digest: string }
    ).digest;
    expect(proposal.proposal.predecessor.claimDigest).toBe(predecessorClaimDigest);
    expect(predecessorClaimDigest).not.toBe(authoringAuthorityDigest);
    expect(proposal.proposal.predecessor.authoringAuthorityDigest).toBe(
      authoringAuthorityDigest,
    );
    expect(proposal.proposal.maxSuccessorExecutions).toBe(1);

    const review = reviewBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      proposalPath: proposal.proposalPath,
      proposalDigest: proposal.proposal.digest,
      reviewedBy: 'claude_code',
      reviewedAt: REVIEWED_AT,
      write: true,
    });

    expect(() =>
      approveBlueprintReplacementProposal({
        repoRoot: subject.repoRoot,
        proposalPath: proposal.proposalPath,
        proposalDigest: proposal.proposal.digest,
        reviewPath: review.reviewPath,
        reviewDigest: review.review.digest,
        approvedBy: 'Codex' as never,
        approvedAt: APPROVED_AT,
        write: true,
      }),
    ).toThrow(/exact approver/);

    const authorization = approveBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      proposalPath: proposal.proposalPath,
      proposalDigest: proposal.proposal.digest,
      reviewPath: review.reviewPath,
      reviewDigest: review.review.digest,
      approvedBy: 'Guy',
      approvedAt: APPROVED_AT,
      write: true,
    });
    const successorDigest = authorization.successorExecutionDigest;
    expect(successorDigest).not.toBe(authoringAuthorityDigest);

    const providerCalls = vi.fn();
    const successor = await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, providerCalls) },
    );
    expect(successor.replayed).toBe(false);
    expect(successor.manifest.stage).toBe('blueprint_candidate');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    // Content authoring authority is unchanged in the successor Blueprint.
    expect(successor.manifest.blueprint!.authoringAuthorityDigest).toBe(
      authoringAuthorityDigest,
    );
    // The successor ledger is keyed distinctly and cannot impersonate the
    // predecessor claim.
    expect(successor.claimPath).toContain(`execution-claims/${successorDigest}.json`);
    expect(successor.executionRecordPath).toContain(
      `terminal-lookups/${successorDigest}.json`,
    );
    // The predecessor claim bytes are preserved untouched.
    expect(
      fs.readFileSync(
        path.join(subject.repoRoot, predecessorClaimPath),
        'utf8',
      ),
    ).toBe(claimBefore);

    // Replay: no further provider call.
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const replay = await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbidden },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(successor.manifest.digest);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('keeps the ordinary lane fenced while the predecessor orphan is unresolved', async () => {
    const subject = setup();
    const { preflight } = await orphanedPredecessor(subject);
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
  });

  it('rejects preparation when the predecessor is not an unresolved orphan', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    // A completed predecessor terminal is not an orphan.
    await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    expect(() =>
      prepareBlueprintReplacementProposal({
        repoRoot: subject.repoRoot,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        reason: 'orphan_claim_unknown_provider_outcome',
        preparedBy: 'Codex',
        preparedAt: PREPARED_AT,
        write: true,
      }),
    ).toThrow(/terminal result/);
  });

  it('records an incident and never retries the provider after a successor claim crash', async () => {
    const subject = setup();
    const { preflight } = await orphanedPredecessor(subject);
    const proposal = prepareBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      reason: 'orphan_claim_unknown_provider_outcome',
      preparedBy: 'Codex',
      preparedAt: PREPARED_AT,
      write: true,
    });
    const review = reviewBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      proposalPath: proposal.proposalPath,
      proposalDigest: proposal.proposal.digest,
      reviewedBy: 'claude_code',
      reviewedAt: REVIEWED_AT,
      write: true,
    });
    const authorization = approveBlueprintReplacementProposal({
      repoRoot: subject.repoRoot,
      proposalPath: proposal.proposalPath,
      proposalDigest: proposal.proposal.digest,
      reviewPath: review.reviewPath,
      reviewDigest: review.review.digest,
      approvedBy: 'Guy',
      approvedAt: APPROVED_AT,
      write: true,
    });
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        {
          hooks: {
            afterClaim() {
              throw new Error('simulated_crash_after_successor_claim');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    const incidents = fs.readdirSync(
      ledgerFile(subject.repoRoot, 'execution-incidents'),
    );
    expect(incidents).toContain(`${authorization.successorExecutionDigest}.json`);
    // A retry after the incident still fails closed with no provider call.
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerFactory).not.toHaveBeenCalled();
  });
});

const PREPARED_AT_ALT = '2026-08-26T09:05:00.000Z';
const APPROVED_AT_ALT = '2026-08-26T10:05:00.000Z';

function prepareProposal(
  subject: ReturnType<typeof setup>,
  preflightManifestPath: string,
  preparedAt = PREPARED_AT,
) {
  return prepareBlueprintReplacementProposal({
    repoRoot: subject.repoRoot,
    preflightManifestPath,
    outputDir: OUTPUT_DIR,
    reason: 'orphan_claim_unknown_provider_outcome',
    preparedBy: 'Codex',
    preparedAt,
    write: true,
  });
}

function reviewProposal(
  subject: ReturnType<typeof setup>,
  proposal: ReturnType<typeof prepareProposal>,
) {
  return reviewBlueprintReplacementProposal({
    repoRoot: subject.repoRoot,
    proposalPath: proposal.proposalPath,
    proposalDigest: proposal.proposal.digest,
    reviewedBy: 'claude_code',
    reviewedAt: REVIEWED_AT,
    write: true,
  });
}

function approveProposal(
  subject: ReturnType<typeof setup>,
  proposal: ReturnType<typeof prepareProposal>,
  review: ReturnType<typeof reviewProposal>,
  overrides: { approvedAt?: string; note?: string } = {},
) {
  return approveBlueprintReplacementProposal({
    repoRoot: subject.repoRoot,
    proposalPath: proposal.proposalPath,
    proposalDigest: proposal.proposal.digest,
    reviewPath: review.reviewPath,
    reviewDigest: review.review.digest,
    approvedBy: 'Guy',
    approvedAt: overrides.approvedAt ?? APPROVED_AT,
    write: true,
    ...(overrides.note ? { note: overrides.note } : {}),
  });
}

async function approvedSuccessor(subject: ReturnType<typeof setup>) {
  const orphan = await orphanedPredecessor(subject);
  const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
  const review = reviewProposal(subject, proposal);
  const authorization = approveProposal(subject, proposal, review);
  return { ...orphan, proposal, review, authorization };
}

/**
 * Writes a hand-authored, individually self-valid, content-addressed replacement
 * ledger artifact (canonical bytes + recomputed digest) exactly as the honest
 * writer would, but from arbitrary caller-supplied fields. This models an
 * attacker with canonical tooling forging on-disk bytes; `payload` must exclude
 * `digest`/`digestAlgorithm`.
 */
function writeHandAuthoredLedgerArtifact(
  root: string,
  category: 'replacement-reviews' | 'replacement-authorizations',
  payload: Record<string, unknown>,
): { digest: string; path: string } {
  const digest = canonicalJsonDigest(payload);
  const artifact = {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest,
  };
  const relative = `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/${category}/${digest}.json`;
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, canonicalContentAddressedJsonBytes(artifact), 'utf8');
  return { digest, path: relative };
}

/**
 * Forges a fully self-consistent proposal→review→authorization lineage on disk
 * whose ONLY defect is the caller-chosen canonical timestamps. Every digest,
 * path relation and the recomputed successor identity match, so the lineage is
 * rejectable only by re-deriving time ordering at authorization reload.
 */
function forgeInvertedTimeAuthorization(
  subject: ReturnType<typeof setup>,
  proposal: ReturnType<typeof prepareProposal>,
  times: { reviewedAt: string; approvedAt: string },
): { authorizationPath: string; authorizationDigest: string; successorExecutionDigest: string } {
  const p = proposal.proposal;
  const review = writeHandAuthoredLedgerArtifact(
    subject.repoRoot,
    'replacement-reviews',
    {
      version: 'qa-wizard-blueprint-replacement-review/v1',
      proposalDigest: p.digest,
      proposalPath: proposal.proposalPath,
      disposition: 'recommend_replacement',
      reviewedBy: 'claude_code',
      reviewedAt: times.reviewedAt,
      note: null,
      scope: 'single_use_paid_blueprint_replacement_review',
    },
  );
  const successorExecutionDigest = blueprintReplacementSuccessorExecutionDigest({
    proposalDigest: p.digest,
    reviewDigest: review.digest,
    approvedBy: QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
    approvedAt: times.approvedAt,
    predecessorClaimDigest: p.predecessor.claimDigest,
    authoringAuthorityDigest: p.current.authoringAuthorityDigest,
  });
  const authorization = writeHandAuthoredLedgerArtifact(
    subject.repoRoot,
    'replacement-authorizations',
    {
      version: 'qa-wizard-blueprint-replacement-authorization/v1',
      proposalDigest: p.digest,
      proposalPath: proposal.proposalPath,
      reviewDigest: review.digest,
      reviewPath: review.path,
      authoringAuthorityDigest: p.current.authoringAuthorityDigest,
      requestDigest: p.current.requestDigest,
      preflightManifestDigest: p.current.preflightManifestDigest,
      predecessorClaimDigest: p.predecessor.claimDigest,
      predecessorClaimPath: p.predecessor.claimPath,
      successorExecutionDigest,
      maxSuccessorExecutions: 1,
      approvedBy: QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
      approvedAt: times.approvedAt,
      note: null,
      scope: 'single_use_paid_blueprint_replacement_authorization',
    },
  );
  return {
    authorizationPath: authorization.path,
    authorizationDigest: authorization.digest,
    successorExecutionDigest,
  };
}

describe('QA Wizard Blueprint replacement — adversarial authority', () => {
  it('rejects frozen-program replacement prepare and authorize before any slot, authorization, or claim residue', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const frozen = freezeOrdinaryOrphan({ subject, orphan });
    const ledgerRoot = path.join(
      subject.repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    );
    const beforePrepare = fileInventory(ledgerRoot);
    expect(() =>
      prepareBlueprintReplacementProposal({
        repoRoot: subject.repoRoot,
        preflightManifestPath: frozen.preflightPath,
        outputDir: OUTPUT_DIR,
        reason: 'orphan_claim_unknown_provider_outcome',
        preparedBy: 'Codex',
        preparedAt: PREPARED_AT,
        write: true,
      }),
    ).toThrow(/preflight is not current|legacy Blueprint/);
    expect(fileInventory(ledgerRoot)).toEqual(beforePrepare);

    const proposal = buildBlueprintReplacementProposal({
      reason: 'orphan_claim_unknown_provider_outcome',
      predecessor: {
        claimVersion: frozen.claim.version as string,
        claimDigest: frozen.claim.digest,
        claimPath: frozen.claimPath,
        claimByteLength: Buffer.byteLength(frozen.claimBytes, 'utf8'),
        claimSha256: createHash('sha256')
          .update(frozen.claimBytes, 'utf8')
          .digest('hex'),
        authoringAuthorityDigest: frozen.authoringAuthorityDigest,
        requestDigest: frozen.requestDigest,
        preflightManifestDigest: frozen.preflight.digest,
        preflightManifestPath: frozen.preflightPath,
        requestedAt: frozen.request.requestedAt,
      },
      current: {
        authoringAuthorityDigest: frozen.authoringAuthorityDigest,
        requestDigest: frozen.requestDigest,
        preflightManifestDigest: frozen.preflight.digest,
        preflightManifestPath: frozen.preflightPath,
        outputDir: OUTPUT_DIR,
        requestId: frozen.request.requestId,
        requestedAt: frozen.request.requestedAt,
      },
      preparedBy: 'Codex',
      preparedAt: PREPARED_AT,
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
      reviewedAt: REVIEWED_AT,
    });
    const reviewPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/replacement-reviews/${review.digest}.json`;
    writeText(
      subject.repoRoot,
      reviewPath,
      canonicalContentAddressedJsonBytes(review),
    );
    const beforeAuthorize = fileInventory(ledgerRoot);
    expect(() =>
      approveBlueprintReplacementProposal({
        repoRoot: subject.repoRoot,
        proposalPath,
        proposalDigest: proposal.digest,
        reviewPath,
        reviewDigest: review.digest,
        approvedBy: 'Guy',
        approvedAt: APPROVED_AT,
        write: true,
      }),
    ).toThrow('replacement predecessor preflight is not current');
    expect(fileInventory(ledgerRoot)).toEqual(beforeAuthorize);
    expect(
      fs.existsSync(
        ledgerFile(
          subject.repoRoot,
          'replacement-authorization-slots',
          `${frozen.authoringAuthorityDigest}.json`,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a second approval that differs only by timestamp (one global slot)', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
    const review = reviewProposal(subject, proposal);
    approveProposal(subject, proposal, review);
    // Same predecessor/proposal/review, different approval timestamp → a
    // different successor identity → the predecessor-keyed slot collides.
    expect(() =>
      approveProposal(subject, proposal, review, { approvedAt: APPROVED_AT_ALT }),
    ).toThrow(/already bound to a different successor/);
    const slots = fs.readdirSync(
      ledgerFile(subject.repoRoot, 'replacement-authorization-slots'),
    );
    expect(slots).toHaveLength(1);
  });

  it('rejects an alternative proposal for the same predecessor (one global slot)', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposalA = prepareProposal(subject, orphan.preflight.manifestPath);
    const reviewA = reviewProposal(subject, proposalA);
    approveProposal(subject, proposalA, reviewA);
    // A distinct proposal (different preparedAt) for the SAME predecessor yields
    // a distinct successor identity, which the slot rejects at approval.
    const proposalB = prepareProposal(
      subject,
      orphan.preflight.manifestPath,
      PREPARED_AT_ALT,
    );
    expect(proposalB.proposal.digest).not.toBe(proposalA.proposal.digest);
    const reviewB = reviewProposal(subject, proposalB);
    expect(() => approveProposal(subject, proposalB, reviewB)).toThrow(
      /already bound to a different successor/,
    );
  });

  it('admits exactly one provider owner across output roots for one predecessor', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposalA = prepareProposal(subject, orphan.preflight.manifestPath);
    const reviewA = reviewProposal(subject, proposalA);
    const authorizationA = approveProposal(subject, proposalA, reviewA);
    const first = vi.fn();
    await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorizationA.authorizationPath,
        authorizationDigest: authorizationA.authorization.digest,
        preflightManifestPath: orphan.preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, first) },
    );
    expect(first).toHaveBeenCalledTimes(1);
    // A second, distinct authorization (different approval timestamp) cannot
    // obtain a second paid successor even though the predecessor is still an
    // unresolved orphan and the ledger slot lives outside any output root.
    const proposalB = prepareProposal(
      subject,
      orphan.preflight.manifestPath,
      PREPARED_AT_ALT,
    );
    const reviewB = reviewProposal(subject, proposalB);
    expect(() =>
      approveProposal(subject, proposalB, reviewB, { approvedAt: APPROVED_AT_ALT }),
    ).toThrow(/already bound to a different successor/);
  });

  it('never lets an existing successor terminal replay under a note-only authorization (exact claim binding)', async () => {
    const subject = setup();
    const { authorization, proposal, review, preflight } =
      await approvedSuccessor(subject);
    const first = vi.fn();
    await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, first) },
    );
    expect(first).toHaveBeenCalledTimes(1);
    // A note-only authorization converges on the SAME successor identity/slot
    // but has a different authorization digest. Its claim matcher must reject
    // the stored claim (which embeds the first authorization) instead of
    // replaying it.
    const authorizationNote = approveProposal(subject, proposal, review, {
      note: 'operator_added_context',
    });
    expect(authorizationNote.authorization.digest).not.toBe(
      authorization.authorization.digest,
    );
    expect(authorizationNote.successorExecutionDigest).toBe(
      authorization.successorExecutionDigest,
    );
    const forbidden = vi.fn();
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorizationNote.authorizationPath,
          authorizationDigest: authorizationNote.authorization.digest,
          preflightManifestPath: preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: () => passingProvider(subject.fixture, forbidden) },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('keeps the ordinary lane fenced after a completed successor and never mints a predecessor lookup', async () => {
    const subject = setup();
    const {
      authorization,
      preflight,
      predecessorExecutionDigest,
      predecessorClaimPath,
      claimBefore,
    } =
      await approvedSuccessor(subject);
    await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture) },
    );
    const predecessorLookup = ledgerFile(
      subject.repoRoot,
      'terminal-lookups',
      `${predecessorExecutionDigest}.json`,
    );
    expect(fs.existsSync(predecessorLookup)).toBe(false);
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
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
    ).rejects.toThrow('execution_state_uncertain');
    expect(forbidden).not.toHaveBeenCalled();
    // No predecessor lookup was minted and the predecessor claim is untouched.
    expect(fs.existsSync(predecessorLookup)).toBe(false);
    expect(
      fs.readFileSync(
        path.join(subject.repoRoot, predecessorClaimPath),
        'utf8',
      ),
    ).toBe(claimBefore);
  });

  it('rejects executing an authorization against a different preflight before any provider', async () => {
    const subject = setup();
    const { authorization } = await approvedSuccessor(subject);
    // A second, structurally valid preflight (distinct request id) is not the
    // one the authorization was minted for.
    const other = prepare(subject, 'blueprint-live-request-002');
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          preflightManifestPath: other.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/does not match the current preflight/);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('replays a completed successor with zero provider calls after the slot is bound', async () => {
    const subject = setup();
    const { authorization, preflight } = await approvedSuccessor(subject);
    const first = vi.fn();
    const completed = await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(subject.fixture, first) },
    );
    expect(first).toHaveBeenCalledTimes(1);
    const forbidden = vi.fn(() => {
      throw new Error('provider_must_not_load_on_replay');
    });
    const replay = await executeBlueprintReplacementLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        preflightManifestPath: preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbidden },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(completed.manifest.digest);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('rejects a review or approval whose canonical time ordering is inverted', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
    // A review dated before the proposal preparation is rejected.
    expect(() =>
      reviewBlueprintReplacementProposal({
        repoRoot: subject.repoRoot,
        proposalPath: proposal.proposalPath,
        proposalDigest: proposal.proposal.digest,
        reviewedBy: 'claude_code',
        reviewedAt: '2026-08-26T08:00:00.000Z',
        write: true,
      }),
    ).toThrow(/review must not precede proposal preparation/);
    const review = reviewProposal(subject, proposal);
    // An approval dated before the review is rejected.
    expect(() =>
      approveProposal(subject, proposal, review, {
        approvedAt: '2026-08-26T09:15:00.000Z',
      }),
    ).toThrow(/approval must not precede the review/);
  });

  it('publishes terminal ownership before the terminal manifest so a crash cannot expose an unbound terminal', async () => {
    const subject = setup();
    const preflight = prepare(subject);
    // Crash in the true exposure window: ownership binding durable, manifest not
    // yet published. This is the actual publication interval — not the seam
    // after both writes.
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
            afterTerminalBinding() {
              throw new Error('crash_between_ownership_and_manifest');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    // Exactly one paid call; the torn state never redispatches the provider.
    expect(providerCalls).toHaveBeenCalledTimes(1);

    // The ordinary execution identity is the content authoring-authority key.
    const claims = fs.readdirSync(ledgerFile(subject.repoRoot, 'execution-claims'));
    expect(claims).toHaveLength(1);
    const identity = claims[0]!.replace(/\.json$/, '');

    // Ownership is durable — the terminal binding exists...
    const bindingFile = ledgerFile(
      subject.repoRoot,
      'terminal-bindings',
      `${identity}.json`,
    );
    expect(fs.existsSync(bindingFile)).toBe(true);
    const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8')) as {
      terminalManifestDigest: string;
    };
    // ...but the terminal manifest it owns is NOT yet visible: nothing for the
    // other execution identity to scan and adopt.
    const terminalManifestFile = path.join(
      subject.repoRoot,
      OUTPUT_DIR,
      'blueprint-authoring-manifests',
      `${binding.terminalManifestDigest}.json`,
    );
    expect(fs.existsSync(terminalManifestFile)).toBe(false);
    // No terminal lookup was minted either.
    expect(
      fs.existsSync(
        ledgerFile(subject.repoRoot, 'terminal-lookups', `${identity}.json`),
      ),
    ).toBe(false);

    // Re-entry fails closed with zero further provider calls; a binding that
    // names a missing terminal is a torn state, never an adoptable terminal.
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
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
    ).rejects.toThrow('execution_state_uncertain');
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('rejects replacement for a legacy unbound but recoverable predecessor terminal (write:false and write:true)', async () => {
    const subject = setup();
    const legacy = await legacyUnboundTerminalPredecessor(subject);
    const base = {
      repoRoot: subject.repoRoot,
      preflightManifestPath: legacy.preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      reason: 'orphan_claim_unknown_provider_outcome',
      preparedBy: 'Codex',
      preparedAt: PREPARED_AT,
    } as const;
    // A read-only preparation (write:false) rejects and writes no bytes.
    expect(() =>
      prepareBlueprintReplacementProposal({ ...base, write: false }),
    ).toThrow(/recoverable terminal/);
    // A write:true preparation rejects before any artifact is created.
    expect(() =>
      prepareBlueprintReplacementProposal({ ...base, write: true }),
    ).toThrow(/recoverable terminal/);
    for (const category of [
      'replacement-proposals',
      'replacement-reviews',
      'replacement-authorizations',
      'replacement-authorization-slots',
    ]) {
      const dir = ledgerFile(subject.repoRoot, category);
      const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      expect(entries).toEqual([]);
    }
    // Predecessor claim bytes untouched.
    expect(
      fs.readFileSync(
        path.join(subject.repoRoot, legacy.predecessorClaimPath),
        'utf8',
      ),
    ).toBe(legacy.claimBefore);
    // Compatibility: the ordinary lane still recovers this exact legacy terminal
    // with zero provider calls — proving the predecessor really was recoverable.
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
    const recovered = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: subject.repoRoot,
        preflightManifestPath: legacy.preflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: forbidden },
    );
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(legacy.completed.manifest.digest);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('rejects a hand-authored canonical authorization whose approval predates its review before any slot/claim/provider', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
    // Self-consistent lineage, recomputed digests, but approvedAt < reviewedAt.
    const forged = forgeInvertedTimeAuthorization(subject, proposal, {
      reviewedAt: '2026-08-26T11:00:00.000Z',
      approvedAt: APPROVED_AT,
    });
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: forged.authorizationPath,
          authorizationDigest: forged.authorizationDigest,
          preflightManifestPath: orphan.preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/lineage is inconsistent or tampered/);
    expect(forbidden).not.toHaveBeenCalled();
    // No slot bound and no successor claim written: rejection precedes them.
    const slotDir = ledgerFile(
      subject.repoRoot,
      'replacement-authorization-slots',
    );
    expect(fs.existsSync(slotDir) ? fs.readdirSync(slotDir) : []).toEqual([]);
    expect(
      fs.existsSync(
        ledgerFile(
          subject.repoRoot,
          'execution-claims',
          `${forged.successorExecutionDigest}.json`,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a hand-authored canonical authorization whose review predates the proposal before any slot/claim/provider', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
    // Only the proposal→review ordering is inverted; approval follows the review.
    const forged = forgeInvertedTimeAuthorization(subject, proposal, {
      reviewedAt: '2026-08-26T08:00:00.000Z',
      approvedAt: APPROVED_AT,
    });
    const forbidden = vi.fn(() => passingProvider(subject.fixture));
    await expect(
      executeBlueprintReplacementLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: forged.authorizationPath,
          authorizationDigest: forged.authorizationDigest,
          preflightManifestPath: orphan.preflight.manifestPath,
          outputDir: OUTPUT_DIR,
          write: true,
        },
        { providerFactory: forbidden },
      ),
    ).rejects.toThrow(/lineage is inconsistent or tampered/);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('pure authorization builder rejects a review bound to a different proposal path', async () => {
    const subject = setup();
    const orphan = await orphanedPredecessor(subject);
    const proposal = prepareProposal(subject, orphan.preflight.manifestPath);
    const review = reviewProposal(subject, proposal);
    // The review is bound to proposal.proposalPath; supplying a different path
    // must be rejected by the pure builder, not only by the filesystem reload.
    expect(() =>
      buildBlueprintReplacementAuthorization({
        proposal: proposal.proposal,
        proposalPath: `${proposal.proposalPath}.tampered`,
        review: review.review,
        reviewPath: review.reviewPath,
        approvedBy: QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/not bound to this proposal path/);
  });
});

const DIAGNOSTIC_PREPARED_AT = '2026-08-31T12:00:00.000Z';
const DIAGNOSTIC_APPROVED_AT = '2026-08-31T12:05:00.000Z';

function diagnosticDraft(
  fixture: ReturnType<typeof buildBlueprintFixture>,
  invalidAffordanceCount: number,
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
  for (let index = 0; index < invalidAffordanceCount; index += 1) {
    draft.worldPlan.affordances.push({
      id: `affordance:diagnostic_invalid_${index}`,
      zoneId: existing.zoneId,
      kind: 'synthetic_invalid',
      consumers: [],
    });
  }
  return draft;
}

function diagnosticFailureProvider(
  fixture: ReturnType<typeof buildBlueprintFixture>,
  calls = vi.fn(),
): ProductionAuthoringProvider {
  const drafts = new Map([
    [1, diagnosticDraft(fixture, 3)],
    [2, diagnosticDraft(fixture, 2)],
    [3, diagnosticDraft(fixture, 1)],
  ]);
  return {
    call: async (args) => {
      const draft = drafts.get(args.attempt);
      if (!draft) throw new Error('unexpected diagnostic generation attempt');
      calls(args, draft);
      return {
        output: JSON.stringify(draft),
        receipt: providerReceipt(args),
      };
    },
  };
}

function offlineInputTokenCounter(
  calls = vi.fn(),
): BlueprintAuthoringInputTokenCounter {
  return async (request) => {
    calls(request);
    return {
      routeKind: 'repair',
      repairOrdinal: request.repairOrdinal,
      countRequestDigest: canonicalJsonDigest(
        blueprintAuthoringCountRequestProjection(request),
      ),
      outcome: 'counted',
      inputTokens: 1_000,
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
  };
}

function redigestWithoutAlgorithm(
  value: Record<string, unknown>,
): Record<string, unknown> & { digestAlgorithm: 'canonical-json-sha256'; digest: string } {
  const {
    digest: _digest,
    digestAlgorithm: _digestAlgorithm,
    ...payload
  } = value;
  void _digest;
  void _digestAlgorithm;
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

function redigestIncludingAlgorithm(
  value: Record<string, unknown>,
): Record<string, unknown> & { digest: string } {
  const { digest: _digest, ...payload } = value;
  void _digest;
  return { ...payload, digest: canonicalJsonDigest(payload) };
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

/**
 * Converts a hermetic current v8/v4 failed execution into the exact durable
 * v7/v3 topology that motivated the one-shot successor. The request/preflight,
 * ordinary v2 claim, terminal binding and lookup remain current and exact.
 */
async function legacyDiagnosticPredecessor(
  subject: ReturnType<typeof setup>,
  mutateLegacyReceipt?: (receipt: Record<string, unknown>) => void,
) {
  const preflight = prepare(subject);
  const providerCalls = vi.fn();
  const countCalls = vi.fn();
  const current = await executeQaWizardBlueprintLiveRequest(
    {
      repoRoot: subject.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: OUTPUT_DIR,
      write: true,
    },
    {
      providerFactory: () =>
        diagnosticFailureProvider(subject.fixture, providerCalls),
      inputTokenCounterFactory: () => offlineInputTokenCounter(countCalls),
    },
  );
  if (
    current.manifest.stage !== 'authoring_failed' ||
    current.receipt.version !== PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION ||
    !current.manifest.observabilityCapture
  ) {
    throw new Error('fixture did not produce a current diagnostic terminal');
  }

  const legacyReceipt = structuredClone(current.receipt) as unknown as Record<
    string,
    unknown
  > & {
    version: string;
    attempts: Array<Record<string, unknown>>;
    executionAttestation: AuthoringExecutionAttestation;
    digest: string;
  };
  legacyReceipt.version = LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7;
  for (const attempt of legacyReceipt.attempts) {
    delete attempt.diagnosticCensusCommitment;
    const diagnostics = attempt.validationDiagnostics as Record<string, unknown>;
    attempt.validationDiagnostics = {
      count: diagnostics.count,
      codes: diagnostics.codes,
    };
  }
  legacyReceipt.executionAttestation =
    aggregateProductionAuthoringExecutionAttestations(
      legacyReceipt.attempts.map(
        (attempt) =>
          attempt.executionAttestation as AuthoringExecutionAttestation,
      ),
    );
  mutateLegacyReceipt?.(legacyReceipt);
  const redigestedReceipt = redigestWithoutAlgorithm(legacyReceipt);
  const legacyReceiptPath = `${OUTPUT_DIR}/authoring-receipts/${redigestedReceipt.digest}.json`;
  writeText(
    subject.repoRoot,
    legacyReceiptPath,
    canonicalContentAddressedJsonBytes(redigestedReceipt),
  );

  const currentCapture = JSON.parse(
    fs.readFileSync(
      path.join(subject.repoRoot, current.manifest.observabilityCapture.path),
      'utf8',
    ),
  ) as BlueprintAuthoringSanitizedFailureCapture;
  const {
    attemptCensuses: _attemptCensuses,
    digest: _captureDigest,
    ...captureShared
  } = currentCapture;
  void _attemptCensuses;
  void _captureDigest;
  const legacyCapturePayload = {
    ...captureShared,
    version: LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
    linkage: {
      ...captureShared.linkage,
      terminalReceiptDigest: redigestedReceipt.digest,
    },
  };
  const legacyCapture = {
    ...legacyCapturePayload,
    digest: canonicalJsonDigest(legacyCapturePayload),
  };
  const legacyCapturePath = `${OUTPUT_DIR}/sanitized-failure-captures/${legacyCapture.digest}.json`;
  writeText(
    subject.repoRoot,
    legacyCapturePath,
    canonicalContentAddressedJsonBytes(legacyCapture),
  );

  const {
    digest: _terminalDigest,
    digestAlgorithm: _terminalAlgorithm,
    ...terminalPayload
  } = current.manifest;
  void _terminalDigest;
  void _terminalAlgorithm;
  const legacyTerminalPayload = {
    ...terminalPayload,
    receipt: {
      version: LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
      digest: redigestedReceipt.digest,
      path: legacyReceiptPath,
      status: 'failed' as const,
    },
    observabilityCapture: {
      version: LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
      digest: legacyCapture.digest,
      path: legacyCapturePath,
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

  const executionIdentityDigest = path.basename(current.claimPath, '.json');
  const terminalBindingPath = `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-bindings/${executionIdentityDigest}.json`;
  const binding = JSON.parse(
    fs.readFileSync(path.join(subject.repoRoot, terminalBindingPath), 'utf8'),
  ) as Record<string, unknown>;
  const reboundBinding = redigestWithoutAlgorithm({
    ...binding,
    terminalManifestDigest: legacyTerminal.digest,
    terminalManifestPath: legacyTerminalPath,
  });
  writeText(
    subject.repoRoot,
    terminalBindingPath,
    canonicalContentAddressedJsonBytes(reboundBinding),
  );

  const lookup = JSON.parse(
    fs.readFileSync(path.join(subject.repoRoot, current.executionRecordPath), 'utf8'),
  ) as Record<string, unknown>;
  const legacyLookup = redigestWithoutAlgorithm({
    ...lookup,
    terminalManifestDigest: legacyTerminal.digest,
    terminalManifestPath: legacyTerminalPath,
    receiptDigest: redigestedReceipt.digest,
    receiptPath: legacyReceiptPath,
  });
  writeText(
    subject.repoRoot,
    current.executionRecordPath,
    canonicalContentAddressedJsonBytes(legacyLookup),
  );

  return {
    preflight,
    current,
    lookupPath: current.executionRecordPath,
    lookupDigest: legacyLookup.digest,
    legacyTerminalPath,
    legacyReceiptPath,
    legacyCapturePath,
    providerCalls,
    countCalls,
  };
}

function frozenProgramV6RequestAndPreflight(args: {
  subject: ReturnType<typeof setup>;
  preflight: ReturnType<typeof prepare>;
}) {
  const request = {
    ...structuredClone(args.preflight.request),
    program: structuredClone(
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
    ),
  };
  const requestDigest = canonicalJsonDigest(request);
  const requestPath = `${OUTPUT_DIR}/blueprint-authoring-requests/${requestDigest}.json`;
  writeText(
    args.subject.repoRoot,
    requestPath,
    canonicalContentAddressedJsonBytes(request),
  );
  const {
    digest: _preflightDigest,
    digestAlgorithm: _preflightAlgorithm,
    ...preflightPayload
  } = args.preflight.manifest;
  void _preflightDigest;
  void _preflightAlgorithm;
  const frozenPayload = {
    ...preflightPayload,
    request: {
      ...args.preflight.manifest.request,
      digest: requestDigest,
      path: requestPath,
    },
  };
  const preflight = {
    ...frozenPayload,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest: canonicalJsonDigest(frozenPayload),
  };
  const preflightPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${preflight.digest}.json`;
  writeText(
    args.subject.repoRoot,
    preflightPath,
    canonicalContentAddressedJsonBytes(preflight),
  );
  return { request, requestDigest, requestPath, preflight, preflightPath };
}

function freezeOrdinaryOrphan(args: {
  subject: ReturnType<typeof setup>;
  orphan: Awaited<ReturnType<typeof orphanedPredecessor>>;
}) {
  const frozen = frozenProgramV6RequestAndPreflight({
    subject: args.subject,
    preflight: args.orphan.preflight,
  });
  const currentClaim = JSON.parse(args.orphan.claimBefore) as Record<
    string,
    unknown
  > & { authoringAuthorityDigest: string };
  const executionIdentityDigest =
    qaWizardBlueprintOrdinaryExecutionIdentityDigest({
      authoringAuthorityDigest: currentClaim.authoringAuthorityDigest,
      program: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
    });
  const claim = redigestWithoutAlgorithm({
    ...currentClaim,
    version: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
    executionIdentityDigest,
    executionProgramDigest:
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6.digest,
    requestDigest: frozen.requestDigest,
    preflightManifestDigest: frozen.preflight.digest,
    preflightManifestPath: frozen.preflightPath,
  });
  const claimPath =
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${executionIdentityDigest}.json`;
  const claimBytes = canonicalContentAddressedJsonBytes(claim);
  writeText(args.subject.repoRoot, claimPath, claimBytes);
  return {
    ...frozen,
    executionIdentityDigest,
    authoringAuthorityDigest: currentClaim.authoringAuthorityDigest,
    claim,
    claimPath,
    claimBytes,
  };
}

function rebindAttemptsToFrozenProgram(args: {
  context: ReturnType<typeof setup>['context']['validationContext'];
  receipt: Record<string, unknown> & {
    admissionDecisions: Array<Record<string, unknown>>;
    attempts: Array<Record<string, unknown>>;
  };
  providerCalls: ReturnType<typeof vi.fn>;
}): void {
  rebindReceiptPromptEvidenceToFrozenV6({
    receipt: args.receipt as never,
    calls: args.providerCalls.mock.calls.map(
      ([call]) => call as Parameters<ProductionAuthoringProvider['call']>[0],
    ),
    context: args.context,
    rawDrafts: args.providerCalls.mock.calls.map(([, draft]) => draft),
  });
}

function freezeDiagnosticPredecessor(args: {
  subject: ReturnType<typeof setup>;
  predecessor: Awaited<ReturnType<typeof legacyDiagnosticPredecessor>>;
}) {
  const frozen = frozenProgramV6RequestAndPreflight({
    subject: args.subject,
    preflight: args.predecessor.preflight,
  });
  const legacyReceipt = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, args.predecessor.legacyReceiptPath),
      'utf8',
    ),
  ) as Record<string, unknown> & {
    attempts: Array<Record<string, unknown>>;
  };
  legacyReceipt.requestDigest = frozen.requestDigest;
  rebindAttemptsToFrozenProgram({
    context: args.subject.context.validationContext,
    receipt: legacyReceipt as never,
    providerCalls: args.predecessor.providerCalls,
  });
  const receipt = redigestWithoutAlgorithm(legacyReceipt);
  const receiptPath = `${OUTPUT_DIR}/authoring-receipts/${receipt.digest}.json`;
  writeText(
    args.subject.repoRoot,
    receiptPath,
    canonicalContentAddressedJsonBytes(receipt),
  );

  const legacyCapture = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, args.predecessor.legacyCapturePath),
      'utf8',
    ),
  ) as Record<string, unknown> & { linkage: Record<string, unknown> };
  legacyCapture.linkage = {
    ...legacyCapture.linkage,
    terminalReceiptDigest: receipt.digest,
    requestDigest: frozen.requestDigest,
  };
  legacyCapture.admission = {
    ...(legacyCapture.admission as Record<string, unknown>),
    decisions: receipt.admissionDecisions,
  };
  const capture = redigestIncludingAlgorithm(legacyCapture);
  const capturePath = `${OUTPUT_DIR}/sanitized-failure-captures/${capture.digest}.json`;
  writeText(
    args.subject.repoRoot,
    capturePath,
    canonicalContentAddressedJsonBytes(capture),
  );

  const legacyTerminal = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, args.predecessor.legacyTerminalPath),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const terminal = redigestWithoutAlgorithm({
    ...legacyTerminal,
    predecessor: {
      version: frozen.preflight.version,
      digest: frozen.preflight.digest,
      path: frozen.preflightPath,
    },
    request: frozen.preflight.request,
    receipt: {
      version: LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
      digest: receipt.digest,
      path: receiptPath,
      status: 'failed',
    },
    observabilityCapture: {
      version: LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
      digest: capture.digest,
      path: capturePath,
    },
  });
  const terminalPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${terminal.digest}.json`;
  writeText(
    args.subject.repoRoot,
    terminalPath,
    canonicalContentAddressedJsonBytes(terminal),
  );

  const currentClaim = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, args.predecessor.current.claimPath),
      'utf8',
    ),
  ) as Record<string, unknown> & { authoringAuthorityDigest: string };
  const executionIdentityDigest =
    qaWizardBlueprintOrdinaryExecutionIdentityDigest({
      authoringAuthorityDigest: currentClaim.authoringAuthorityDigest,
      program: LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6,
    });
  const claim = redigestWithoutAlgorithm({
    ...currentClaim,
    version: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
    executionIdentityDigest,
    executionProgramDigest:
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6.digest,
    requestDigest: frozen.requestDigest,
    preflightManifestDigest: frozen.preflight.digest,
    preflightManifestPath: frozen.preflightPath,
  });
  const claimPath =
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${executionIdentityDigest}.json`;
  writeText(
    args.subject.repoRoot,
    claimPath,
    canonicalContentAddressedJsonBytes(claim),
  );

  const currentExecutionIdentity = path.basename(
    args.predecessor.current.claimPath,
    '.json',
  );
  const sourceBindingPath =
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-bindings/${currentExecutionIdentity}.json`;
  const sourceBinding = JSON.parse(
    fs.readFileSync(path.join(args.subject.repoRoot, sourceBindingPath), 'utf8'),
  ) as Record<string, unknown>;
  const binding = redigestWithoutAlgorithm({
    ...sourceBinding,
    version: QA_WIZARD_BLUEPRINT_TERMINAL_BINDING_VERSION,
    executionIdentityDigest,
    requestDigest: frozen.requestDigest,
    preflightManifestDigest: frozen.preflight.digest,
    terminalManifestDigest: terminal.digest,
    terminalManifestPath: terminalPath,
  });
  const bindingPath =
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-bindings/${executionIdentityDigest}.json`;
  writeText(
    args.subject.repoRoot,
    bindingPath,
    canonicalContentAddressedJsonBytes(binding),
  );

  const sourceLookup = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, args.predecessor.lookupPath),
      'utf8',
    ),
  ) as Record<string, unknown>;
  const lookup = redigestWithoutAlgorithm({
    ...sourceLookup,
    requestDigest: frozen.requestDigest,
    claimDigest: claim.digest,
    claimPath,
    terminalManifestDigest: terminal.digest,
    terminalManifestPath: terminalPath,
    receiptDigest: receipt.digest,
    receiptPath,
  });
  const lookupPath =
    `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-lookups/${executionIdentityDigest}.json`;
  writeText(
    args.subject.repoRoot,
    lookupPath,
    canonicalContentAddressedJsonBytes(lookup),
  );

  const lineage: QaWizardBlueprintDiagnosticSuccessorLineage = {
    executionIdentityDigest,
    authoringAuthorityDigest: currentClaim.authoringAuthorityDigest,
    executionProgramDigest:
      LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_PROMPT_V6.digest,
    requestVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION,
    requestDigest: frozen.requestDigest,
    requestPath: frozen.requestPath,
    requestId: frozen.request.requestId,
    requestedAt: frozen.request.requestedAt,
    preflightManifestVersion: frozen.preflight.version,
    preflightManifestDigest: frozen.preflight.digest,
    preflightManifestPath: frozen.preflightPath,
    outputDir: OUTPUT_DIR,
    claimVersion: QA_WIZARD_BLUEPRINT_EXECUTION_CLAIM_VERSION,
    claimDigest: claim.digest,
    claimPath,
    terminalLookupVersion: lookup.version as QaWizardBlueprintDiagnosticSuccessorLineage['terminalLookupVersion'],
    terminalLookupDigest: lookup.digest,
    terminalLookupPath: lookupPath,
    terminalBindingVersion: binding.version as QaWizardBlueprintDiagnosticSuccessorLineage['terminalBindingVersion'],
    terminalBindingDigest: binding.digest,
    terminalBindingPath: bindingPath,
    terminalManifestVersion: terminal.version as QaWizardBlueprintDiagnosticSuccessorLineage['terminalManifestVersion'],
    terminalManifestDigest: terminal.digest,
    terminalManifestPath: terminalPath,
    receiptVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION,
    receiptDigest: receipt.digest,
    receiptPath,
    captureVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION,
    captureDigest: capture.digest,
    capturePath,
    terminalFailureCode: 'draft_validation_repair_exhausted',
    callCount: 3,
    repairCount: 2,
  };
  return { ...frozen, receipt, receiptPath, capture, capturePath, terminal, terminalPath, claim, claimPath, binding, bindingPath, lookup, lookupPath, lineage };
}

function materializeFrozenDiagnosticSuccessorTarget(args: {
  subject: ReturnType<typeof setup>;
  predecessor: Awaited<ReturnType<typeof legacyDiagnosticPredecessor>>;
  frozen: ReturnType<typeof freezeDiagnosticPredecessor>;
}) {
  const currentReceipt = structuredClone(
    args.predecessor.current.receipt,
  ) as unknown as Record<string, unknown> & {
    attempts: Array<Record<string, unknown>>;
  };
  currentReceipt.requestDigest = args.frozen.requestDigest;
  rebindAttemptsToFrozenProgram({
    context: args.subject.context.validationContext,
    receipt: currentReceipt as never,
    providerCalls: args.predecessor.providerCalls,
  });
  const receipt = redigestWithoutAlgorithm(currentReceipt);
  const receiptPath = `${OUTPUT_DIR}/authoring-receipts/${receipt.digest}.json`;
  writeText(
    args.subject.repoRoot,
    receiptPath,
    canonicalContentAddressedJsonBytes(receipt),
  );
  const currentCaptureAuthority =
    args.predecessor.current.manifest.observabilityCapture;
  if (!currentCaptureAuthority) {
    throw new Error('diagnostic successor target requires a current capture');
  }
  const currentCapture = JSON.parse(
    fs.readFileSync(
      path.join(args.subject.repoRoot, currentCaptureAuthority.path),
      'utf8',
    ),
  ) as Record<string, unknown> & { linkage: Record<string, unknown> };
  currentCapture.linkage = {
    ...currentCapture.linkage,
    terminalReceiptDigest: receipt.digest,
    requestDigest: args.frozen.requestDigest,
  };
  currentCapture.admission = {
    ...(currentCapture.admission as Record<string, unknown>),
    decisions: receipt.admissionDecisions,
  };
  const capture = redigestIncludingAlgorithm(currentCapture);
  const capturePath = `${OUTPUT_DIR}/sanitized-failure-captures/${capture.digest}.json`;
  writeText(
    args.subject.repoRoot,
    capturePath,
    canonicalContentAddressedJsonBytes(capture),
  );
  const terminal = redigestWithoutAlgorithm({
    ...args.predecessor.current.manifest,
    predecessor: {
      version: args.frozen.preflight.version,
      digest: args.frozen.preflight.digest,
      path: args.frozen.preflightPath,
    },
    request: args.frozen.preflight.request,
    receipt: {
      version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      digest: receipt.digest,
      path: receiptPath,
      status: 'failed',
    },
    observabilityCapture: {
      version: BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
      digest: capture.digest,
      path: capturePath,
    },
  });
  const terminalPath = `${OUTPUT_DIR}/blueprint-authoring-manifests/${terminal.digest}.json`;
  writeText(
    args.subject.repoRoot,
    terminalPath,
    canonicalContentAddressedJsonBytes(terminal),
  );
  return { receipt, receiptPath, capture, capturePath, terminal, terminalPath };
}

function prepareDiagnosticSuccessor(
  subject: ReturnType<typeof setup>,
  predecessor: Awaited<ReturnType<typeof legacyDiagnosticPredecessor>>,
  preparedAt = DIAGNOSTIC_PREPARED_AT,
) {
  return prepareBlueprintDiagnosticSuccessorCandidate({
    repoRoot: subject.repoRoot,
    predecessorTerminalLookupPath: predecessor.lookupPath,
    predecessorTerminalLookupDigest: predecessor.lookupDigest,
    preparedBy: 'Codex',
    preparedAt,
    write: true,
  });
}

function authorizeDiagnosticSuccessor(
  subject: ReturnType<typeof setup>,
  candidate: ReturnType<typeof prepareDiagnosticSuccessor>,
  approvedAt = DIAGNOSTIC_APPROVED_AT,
) {
  return authorizeBlueprintDiagnosticSuccessorCandidate({
    repoRoot: subject.repoRoot,
    candidatePath: candidate.candidatePath,
    candidateDigest: candidate.candidate.digest,
    approvedBy: 'Guy',
    approvedAt,
    write: true,
  });
}

describe('QA Wizard Blueprint failed-terminal diagnostic successor', () => {
  it('binds one exact v7/v3 predecessor, emits one current v8/v4 terminal, and replays with zero paid dependencies', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    expect(predecessor.providerCalls).toHaveBeenCalledTimes(3);
    const predecessorBytes = [
      predecessor.lookupPath,
      predecessor.legacyTerminalPath,
      predecessor.legacyReceiptPath,
      predecessor.legacyCapturePath,
      predecessor.current.claimPath,
    ].map((artifactPath) => ({
      artifactPath,
      bytes: fs.readFileSync(path.join(subject.repoRoot, artifactPath), 'utf8'),
    }));

    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    expect(candidate.candidate.receiptVersion).toBe(
      LEGACY_PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION_V7,
    );
    expect(candidate.candidate.captureVersion).toBe(
      LEGACY_BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION_V3,
    );
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    const providerCalls = vi.fn();
    const countCalls = vi.fn();
    const successor = await executeBlueprintDiagnosticSuccessorLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        write: true,
      },
      {
        providerFactory: () =>
          diagnosticFailureProvider(subject.fixture, providerCalls),
        inputTokenCounterFactory: () => offlineInputTokenCounter(countCalls),
      },
    );
    expect(successor.replayed).toBe(false);
    expect(successor.manifest.stage).toBe('authoring_failed');
    expect(successor.receipt.version).toBe(PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION);
    expect(successor.manifest.observabilityCapture?.version).toBe(
      BLUEPRINT_AUTHORING_SANITIZED_FAILURE_CAPTURE_VERSION,
    );
    expect(providerCalls).toHaveBeenCalledTimes(3);
    expect(successor.claimPath).toContain(
      `execution-claims/${authorization.successorExecutionDigest}.json`,
    );
    for (const snapshot of predecessorBytes) {
      expect(
        fs.readFileSync(path.join(subject.repoRoot, snapshot.artifactPath), 'utf8'),
      ).toBe(snapshot.bytes);
    }

    const successorLookup = JSON.parse(
      fs.readFileSync(
        path.join(subject.repoRoot, successor.executionRecordPath),
        'utf8',
      ),
    ) as { digest: string };
    expect(() =>
      prepareBlueprintDiagnosticSuccessorCandidate({
        repoRoot: subject.repoRoot,
        predecessorTerminalLookupPath: successor.executionRecordPath,
        predecessorTerminalLookupDigest: successorLookup.digest,
        preparedBy: 'Codex',
        preparedAt: '2026-08-31T12:10:00.000Z',
        write: true,
      }),
    ).toThrow(/exact ordinary-v2 predecessor/);

    // Replay authority is the successor's own claim+terminal. Once that durable
    // result exists, loss of legacy predecessor evidence must not strand it.
    fs.rmSync(path.join(subject.repoRoot, predecessor.legacyCapturePath));

    const forbiddenProvider = vi.fn(() => {
      throw new Error('provider_must_not_load_on_diagnostic_replay');
    });
    const forbiddenCounter = vi.fn(() => {
      throw new Error('counter_must_not_load_on_diagnostic_replay');
    });
    const replay = await executeBlueprintDiagnosticSuccessorLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        write: true,
      },
      {
        providerFactory: forbiddenProvider,
        inputTokenCounterFactory: forbiddenCounter,
      },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(successor.manifest.digest);
    expect(forbiddenProvider).not.toHaveBeenCalled();
    expect(forbiddenCounter).not.toHaveBeenCalled();
  });

  it('recovers and replays a frozen diagnostic-successor terminal before current eligibility and with zero paid dependencies', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const firstRepairCall = predecessor.providerCalls.mock.calls[1]![0] as
      Parameters<ProductionAuthoringProvider['call']>[0];
    const firstRawDraft = predecessor.providerCalls.mock.calls[0]![1];
    const frozenWriterRepairPrompt = frozenBlueprintRepairUserPromptV6({
      currentCall: firstRepairCall,
      context: subject.context.validationContext,
      previousRawDraft: firstRawDraft,
    });
    const naiveCurrentCallRelabel = firstRepairCall.userPrompt
      .split(PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3)
      .join(LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1);
    expect(frozenWriterRepairPrompt).not.toBe(naiveCurrentCallRelabel);
    expect(frozenWriterRepairPrompt).toContain(
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1,
    );
    expect(frozenWriterRepairPrompt).not.toContain(
      PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3,
    );
    expect(frozenWriterRepairPrompt).not.toContain(
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
    );
    const frozen = freezeDiagnosticPredecessor({ subject, predecessor });
    const target = materializeFrozenDiagnosticSuccessorTarget({
      subject,
      predecessor,
      frozen,
    });
    const candidate = buildBlueprintDiagnosticSuccessorCandidate({
      lineage: frozen.lineage,
      preparedBy: 'Codex',
      preparedAt: DIAGNOSTIC_PREPARED_AT,
    });
    const candidatePath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/diagnostic-successor-candidates/${candidate.digest}.json`;
    writeText(
      subject.repoRoot,
      candidatePath,
      canonicalContentAddressedJsonBytes(candidate),
    );
    const authorization = buildBlueprintDiagnosticSuccessorAuthorization({
      candidate,
      candidatePath,
      approvedBy: 'Guy',
      approvedAt: DIAGNOSTIC_APPROVED_AT,
    });
    const authorizationPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/diagnostic-successor-authorizations/${authorization.digest}.json`;
    writeText(
      subject.repoRoot,
      authorizationPath,
      canonicalContentAddressedJsonBytes(authorization),
    );
    const successorClaim = buildBlueprintDiagnosticSuccessorExecutionClaim({
      authorization,
      authorizationPath,
    });
    const successorClaimPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/execution-claims/${authorization.successorExecutionDigest}.json`;
    writeText(
      subject.repoRoot,
      successorClaimPath,
      canonicalContentAddressedJsonBytes(successorClaim),
    );
    const successorBinding = redigestWithoutAlgorithm({
      ...frozen.binding,
      executionIdentityDigest: authorization.successorExecutionDigest,
      terminalManifestDigest: target.terminal.digest,
      terminalManifestPath: target.terminalPath,
    });
    const successorBindingPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-bindings/${authorization.successorExecutionDigest}.json`;
    writeText(
      subject.repoRoot,
      successorBindingPath,
      canonicalContentAddressedJsonBytes(successorBinding),
    );
    const successorLookupPath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/terminal-lookups/${authorization.successorExecutionDigest}.json`;
    expect(fs.existsSync(path.join(subject.repoRoot, successorLookupPath))).toBe(
      false,
    );

    // Once a successor terminal and its own claim/binding are durable, replay
    // must not depend on the now-frozen predecessor capture remaining readable.
    fs.rmSync(path.join(subject.repoRoot, frozen.capturePath));
    const forbiddenProvider = vi.fn(() => {
      throw new Error('provider_must_not_load_for_frozen_diagnostic_replay');
    });
    const forbiddenCounter = vi.fn(() => {
      throw new Error('counter_must_not_load_for_frozen_diagnostic_replay');
    });
    const executionArgs = {
      repoRoot: subject.repoRoot,
      authorizationPath,
      authorizationDigest: authorization.digest,
      write: true,
    } as const;
    const recovered = await executeBlueprintDiagnosticSuccessorLiveRequest(
      executionArgs,
      {
        providerFactory: forbiddenProvider,
        inputTokenCounterFactory: forbiddenCounter,
      },
    );
    expect(recovered.replayed).toBe(true);
    expect(recovered.manifest.digest).toBe(target.terminal.digest);
    expect(recovered.receipt.digest).toBe(target.receipt.digest);
    expect(recovered.claimPath).toBe(successorClaimPath);
    expect(recovered.executionRecordPath).toBe(successorLookupPath);
    const afterRecovery = fileInventory(path.join(subject.repoRoot, OUTPUT_DIR));

    const replay = await executeBlueprintDiagnosticSuccessorLiveRequest(
      executionArgs,
      {
        providerFactory: forbiddenProvider,
        inputTokenCounterFactory: forbiddenCounter,
      },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(target.terminal.digest);
    expect(replay.executionRecordPath).toBe(recovered.executionRecordPath);
    expect(fileInventory(path.join(subject.repoRoot, OUTPUT_DIR))).toEqual(
      afterRecovery,
    );
    expect(forbiddenProvider).not.toHaveBeenCalled();
    expect(forbiddenCounter).not.toHaveBeenCalled();
  });

  it('rejects frozen-program diagnostic prepare and authorize before any slot, authorization, or claim residue', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const frozen = freezeDiagnosticPredecessor({ subject, predecessor });
    const ledgerRoot = path.join(
      subject.repoRoot,
      QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT,
    );
    const beforePrepare = fileInventory(ledgerRoot);
    expect(() =>
      prepareBlueprintDiagnosticSuccessorCandidate({
        repoRoot: subject.repoRoot,
        predecessorTerminalLookupPath: frozen.lookupPath,
        predecessorTerminalLookupDigest: frozen.lookup.digest,
        preparedBy: 'Codex',
        preparedAt: DIAGNOSTIC_PREPARED_AT,
        write: true,
      }),
    ).toThrow('diagnostic successor predecessor preflight is not current');
    expect(fileInventory(ledgerRoot)).toEqual(beforePrepare);

    const candidate = buildBlueprintDiagnosticSuccessorCandidate({
      lineage: frozen.lineage,
      preparedBy: 'Codex',
      preparedAt: DIAGNOSTIC_PREPARED_AT,
    });
    const candidatePath =
      `${QA_WIZARD_BLUEPRINT_AUTHORING_LEDGER_ROOT}/diagnostic-successor-candidates/${candidate.digest}.json`;
    writeText(
      subject.repoRoot,
      candidatePath,
      canonicalContentAddressedJsonBytes(candidate),
    );
    const beforeAuthorize = fileInventory(ledgerRoot);
    expect(() =>
      authorizeBlueprintDiagnosticSuccessorCandidate({
        repoRoot: subject.repoRoot,
        candidatePath,
        candidateDigest: candidate.digest,
        approvedBy: 'Guy',
        approvedAt: DIAGNOSTIC_APPROVED_AT,
        write: true,
      }),
    ).toThrow('diagnostic successor predecessor preflight is not current');
    expect(fileInventory(ledgerRoot)).toEqual(beforeAuthorize);
    expect(
      fs.existsSync(
        ledgerFile(
          subject.repoRoot,
          'diagnostic-successor-slots',
          `${frozen.lineage.executionIdentityDigest}.json`,
        ),
      ),
    ).toBe(false);
  });

  it('rejects current evidence, completed terminals, and missing legacy capture before creating successor authority', async () => {
    const currentSubject = setup();
    const currentPreflight = prepare(currentSubject);
    const currentFailed = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: currentSubject.repoRoot,
        preflightManifestPath: currentPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      {
        providerFactory: () => diagnosticFailureProvider(currentSubject.fixture),
        inputTokenCounterFactory: () => offlineInputTokenCounter(),
      },
    );
    const currentLookup = JSON.parse(
      fs.readFileSync(
        path.join(currentSubject.repoRoot, currentFailed.executionRecordPath),
        'utf8',
      ),
    ) as { digest: string };
    expect(() =>
      prepareBlueprintDiagnosticSuccessorCandidate({
        repoRoot: currentSubject.repoRoot,
        predecessorTerminalLookupPath: currentFailed.executionRecordPath,
        predecessorTerminalLookupDigest: currentLookup.digest,
        preparedBy: 'Codex',
        preparedAt: DIAGNOSTIC_PREPARED_AT,
        write: true,
      }),
    ).toThrow(/not diagnostic-successor eligible|exact legacy v7\/v3/);

    const completedSubject = setup();
    const completedPreflight = prepare(completedSubject);
    const completed = await executeQaWizardBlueprintLiveRequest(
      {
        repoRoot: completedSubject.repoRoot,
        preflightManifestPath: completedPreflight.manifestPath,
        outputDir: OUTPUT_DIR,
        write: true,
      },
      { providerFactory: () => passingProvider(completedSubject.fixture) },
    );
    const completedLookup = JSON.parse(
      fs.readFileSync(
        path.join(completedSubject.repoRoot, completed.executionRecordPath),
        'utf8',
      ),
    ) as { digest: string };
    expect(() =>
      prepareBlueprintDiagnosticSuccessorCandidate({
        repoRoot: completedSubject.repoRoot,
        predecessorTerminalLookupPath: completed.executionRecordPath,
        predecessorTerminalLookupDigest: completedLookup.digest,
        preparedBy: 'Codex',
        preparedAt: DIAGNOSTIC_PREPARED_AT,
        write: true,
      }),
    ).toThrow(/not diagnostic-successor eligible/);

    const tornSubject = setup();
    const torn = await legacyDiagnosticPredecessor(tornSubject);
    fs.rmSync(path.join(tornSubject.repoRoot, torn.legacyCapturePath));
    expect(() => prepareDiagnosticSuccessor(tornSubject, torn)).toThrow();
    const candidateDir = ledgerFile(
      tornSubject.repoRoot,
      'diagnostic-successor-candidates',
    );
    expect(fs.existsSync(candidateDir) ? fs.readdirSync(candidateDir) : []).toEqual([]);
  });

  it('requires exact Guy authorization and allows only one approval identity for a predecessor', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    expect(() =>
      prepareDiagnosticSuccessor(
        subject,
        predecessor,
        '2020-01-01T00:00:00.000Z',
      ),
    ).toThrow(/preparation identity is invalid/);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    expect(() =>
      authorizeBlueprintDiagnosticSuccessorCandidate({
        repoRoot: subject.repoRoot,
        candidatePath: candidate.candidatePath,
        candidateDigest: candidate.candidate.digest,
        approvedBy: 'Codex' as never,
        approvedAt: DIAGNOSTIC_APPROVED_AT,
        write: true,
      }),
    ).toThrow(/exact approver/);
    const first = authorizeDiagnosticSuccessor(subject, candidate);
    // Crash window: the predecessor slot is durable but authorization
    // publication was lost. Repeating the exact explicit approvedAt recovers.
    fs.rmSync(path.join(subject.repoRoot, first.authorizationPath));
    const replay = authorizeDiagnosticSuccessor(subject, candidate);
    expect(replay.authorization.digest).toBe(first.authorization.digest);
    expect(fs.existsSync(path.join(subject.repoRoot, replay.authorizationPath))).toBe(
      true,
    );
    expect(() =>
      authorizeDiagnosticSuccessor(
        subject,
        candidate,
        '2026-08-31T12:06:00.000Z',
      ),
    ).toThrow(/already bound to a different successor/);
  });

  it('freezes v1 evidence identities, rejects extra keys, and is independent of mutable producer aliases', async () => {
    expect(QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_REQUEST_VERSION).toBe(
      'production-blueprint-authoring-request/v5',
    );
    expect(QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_RECEIPT_VERSION).toBe(
      'production-blueprint-authoring-receipt/v7',
    );
    expect(QA_WIZARD_BLUEPRINT_DIAGNOSTIC_PREDECESSOR_CAPTURE_VERSION).toBe(
      'blueprint-authoring-sanitized-failure-capture/v3',
    );
    expect(QA_WIZARD_BLUEPRINT_DIAGNOSTIC_EVIDENCE_TARGET_DIGEST).toBe(
      canonicalJsonDigest({
        version: 'qa-wizard-blueprint-diagnostic-evidence-target/v1',
        receiptVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_RECEIPT_VERSION,
        captureVersion: QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CAPTURE_VERSION,
        censusCommitmentVersion:
          QA_WIZARD_BLUEPRINT_DIAGNOSTIC_TARGET_CENSUS_VERSION,
        attribution: 'ordered_complete_per_attempt',
      }),
    );
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'lib/visual-package/qaWizardBlueprintDiagnosticSuccessorAuthority.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /from '\.\/productionAuthoringRunner'|from '\.\/blueprintAuthoringSanitizedFailureCapture'/,
    );

    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    expect(
      blueprintDiagnosticSuccessorCandidateIsValid({
        ...candidate.candidate,
        hostileExtraKey: true,
      }),
    ).toBe(false);
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    expect(
      blueprintDiagnosticSuccessorAuthorizationIsValid({
        ...authorization.authorization,
        hostileExtraKey: true,
      }),
    ).toBe(false);
  });

  it('can produce a Candidate successor and replay it without provider or counter access', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    const providerCalls = vi.fn();
    const forbiddenCounter = vi.fn(() => {
      throw new Error('counter_must_not_load_for_one_call_candidate');
    });
    const first = await executeBlueprintDiagnosticSuccessorLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        write: true,
      },
      {
        providerFactory: () => passingProvider(subject.fixture, providerCalls),
        inputTokenCounterFactory: forbiddenCounter,
      },
    );
    expect(first.manifest.stage).toBe('blueprint_candidate');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(forbiddenCounter).not.toHaveBeenCalled();
    const forbiddenProvider = vi.fn(() => {
      throw new Error('provider_must_not_load_on_candidate_replay');
    });
    const replay = await executeBlueprintDiagnosticSuccessorLiveRequest(
      {
        repoRoot: subject.repoRoot,
        authorizationPath: authorization.authorizationPath,
        authorizationDigest: authorization.authorization.digest,
        write: true,
      },
      {
        providerFactory: forbiddenProvider,
        inputTokenCounterFactory: forbiddenCounter,
      },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.manifest.digest).toBe(first.manifest.digest);
    expect(forbiddenProvider).not.toHaveBeenCalled();
    expect(forbiddenCounter).not.toHaveBeenCalled();
  });

  it('rejects post-authorization predecessor tamper before provider, counter, claim, or terminal publication', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    fs.writeFileSync(
      path.join(subject.repoRoot, predecessor.legacyCapturePath),
      '{}\n',
      'utf8',
    );
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const counterFactory = vi.fn(() => offlineInputTokenCounter());
    await expect(
      executeBlueprintDiagnosticSuccessorLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          write: true,
        },
        { providerFactory, inputTokenCounterFactory: counterFactory },
      ),
    ).rejects.toThrow();
    expect(providerFactory).not.toHaveBeenCalled();
    expect(counterFactory).not.toHaveBeenCalled();
    expect(
      fs.existsSync(
        ledgerFile(
          subject.repoRoot,
          'execution-claims',
          `${authorization.successorExecutionDigest}.json`,
        ),
      ),
    ).toBe(false);
  });

  it('permits exactly one provider owner under concurrent execution', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    const providerCalls = vi.fn();
    const args = {
      repoRoot: subject.repoRoot,
      authorizationPath: authorization.authorizationPath,
      authorizationDigest: authorization.authorization.digest,
      write: true as const,
    };
    const settled = await Promise.allSettled([
      executeBlueprintDiagnosticSuccessorLiveRequest(args, {
        providerFactory: () => passingProvider(subject.fixture, providerCalls),
      }),
      executeBlueprintDiagnosticSuccessorLiveRequest(args, {
        providerFactory: () => passingProvider(subject.fixture, providerCalls),
      }),
    ]);
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(settled.some((entry) => entry.status === 'fulfilled')).toBe(true);
  });

  it('records a post-claim incident and never redispatches the diagnostic successor', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const candidate = prepareDiagnosticSuccessor(subject, predecessor);
    const authorization = authorizeDiagnosticSuccessor(subject, candidate);
    await expect(
      executeBlueprintDiagnosticSuccessorLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          write: true,
        },
        {
          hooks: {
            afterClaim() {
              throw new Error('simulated_diagnostic_crash_after_claim');
            },
          },
        },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    const providerFactory = vi.fn(() => passingProvider(subject.fixture));
    const counterFactory = vi.fn(() => offlineInputTokenCounter());
    await expect(
      executeBlueprintDiagnosticSuccessorLiveRequest(
        {
          repoRoot: subject.repoRoot,
          authorizationPath: authorization.authorizationPath,
          authorizationDigest: authorization.authorization.digest,
          write: true,
        },
        { providerFactory, inputTokenCounterFactory: counterFactory },
      ),
    ).rejects.toThrow('execution_state_uncertain');
    expect(providerFactory).not.toHaveBeenCalled();
    expect(counterFactory).not.toHaveBeenCalled();
  });

  it('rejects malformed legacy execution topology before minting a candidate', async () => {
    const cases: Array<{
      name: string;
      mutate: (receipt: Record<string, unknown>) => void;
    }> = [
      {
        name: 'wrong failure code',
        mutate: (receipt) => {
          receipt.failure = { code: 'provider_policy_mismatch' };
        },
      },
      {
        name: 'wrong call count',
        mutate: (receipt) => {
          receipt.callCount = 2;
        },
      },
      {
        name: 'transport retry',
        mutate: (receipt) => {
          (receipt.executionAttestation as Record<string, unknown>)
            .transportRetryCount = 1;
        },
      },
      {
        name: 'fallback',
        mutate: (receipt) => {
          (receipt.executionAttestation as Record<string, unknown>).fallbackUsed =
            true;
        },
      },
    ];
    for (const entry of cases) {
      const subject = setup();
      const predecessor = await legacyDiagnosticPredecessor(
        subject,
        entry.mutate,
      );
      expect(
        () => prepareDiagnosticSuccessor(subject, predecessor),
        entry.name,
      ).toThrow();
      const candidateDir = ledgerFile(
        subject.repoRoot,
        'diagnostic-successor-candidates',
      );
      expect(
        fs.existsSync(candidateDir) ? fs.readdirSync(candidateDir) : [],
        entry.name,
      ).toEqual([]);
    }
  });
});

describe('Blueprint diagnostic successor operator CLI', () => {
  it('strictly rejects ambiguous arguments and requires explicit write for execute', async () => {
    expect(() =>
      parseBlueprintDiagnosticSuccessorCliArgs([
        'prepare-diagnostic-successor',
        '--repo-root=.',
      ]),
    ).toThrow(/--name value/);
    expect(() =>
      parseBlueprintDiagnosticSuccessorCliArgs([
        'execute-diagnostic-successor',
        '--repo-root',
        '.',
        '--authorization-path',
        'a.json',
        '--authorization-digest',
        'a'.repeat(64),
        '--unknown',
      ]),
    ).toThrow(/unknown flag/);
    const errors: string[] = [];
    const code = await runBlueprintDiagnosticSuccessorCliAsync({
      argv: [
        'execute-diagnostic-successor',
        '--repo-root',
        '.',
        '--authorization-path',
        'missing.json',
        '--authorization-digest',
        'a'.repeat(64),
      ],
      stderr: (line) => errors.push(line),
    });
    expect(code).toBe(2);
    expect(errors).toEqual([
      'error: execute-diagnostic-successor requires --write',
    ]);
  });

  it('mints candidate and explicit Guy authorization through the operational CLI without provider access', async () => {
    const subject = setup();
    const predecessor = await legacyDiagnosticPredecessor(subject);
    const preparedOutput: string[] = [];
    expect(
      await runBlueprintDiagnosticSuccessorCliAsync({
        argv: [
          'prepare-diagnostic-successor',
          '--repo-root',
          subject.repoRoot,
          '--predecessor-terminal-lookup-path',
          predecessor.lookupPath,
          '--predecessor-terminal-lookup-digest',
          predecessor.lookupDigest,
          '--prepared-by',
          'Codex',
          '--prepared-at',
          DIAGNOSTIC_PREPARED_AT,
          '--write',
        ],
        stdout: (line) => preparedOutput.push(line),
      }),
    ).toBe(0);
    const prepared = JSON.parse(preparedOutput[0]!) as {
      candidatePath: string;
      candidateDigest: string;
    };
    const authorizationOutput: string[] = [];
    expect(
      await runBlueprintDiagnosticSuccessorCliAsync({
        argv: [
          'authorize-diagnostic-successor',
          '--repo-root',
          subject.repoRoot,
          '--candidate-path',
          prepared.candidatePath,
          '--candidate-digest',
          prepared.candidateDigest,
          '--approved-by',
          'Guy',
          '--approved-at',
          DIAGNOSTIC_APPROVED_AT,
          '--write',
        ],
        stdout: (line) => authorizationOutput.push(line),
      }),
    ).toBe(0);
    expect(JSON.parse(authorizationOutput[0]!)).toMatchObject({
      command: 'authorize-diagnostic-successor',
      wrote: true,
    });
  });
});
