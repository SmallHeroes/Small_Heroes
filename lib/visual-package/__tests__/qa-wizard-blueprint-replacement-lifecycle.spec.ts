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
  approveBlueprintReplacementProposal,
  executeBlueprintReplacementLiveRequest,
  executeQaWizardBlueprintLiveRequest,
  prepareBlueprintReplacementProposal,
  prepareQaWizardBlueprintLiveRequest,
  reviewBlueprintReplacementProposal,
} from '../qaWizardBlueprintAuthoringLifecycle';
import {
  buildProductionAuthoringContext,
  type ProductionAuthoringContext,
} from '../productionAuthoringContext';
import { buildStorySourceAuthoritySnapshot } from '../storySourceAuthority';
import { STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH } from '../styleAuthority';
import {
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringReservedExposureUsd,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from '../blueprintAuthoringPolicy';
import { PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA } from '../preRenderBlueprintDraftSchema';
import type { ProductionAuthoringProvider } from '../productionAuthoringRunner';
import { canonicalJsonDigest } from '../integrity';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import {
  QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER,
  blueprintReplacementSuccessorExecutionDigest,
  buildBlueprintReplacementAuthorization,
} from '../qaWizardBlueprintReplacementAuthority';
import {
  buildBlueprintFixture,
  buildVisualContractCandidateFixture,
} from './pre-render-book-visual-blueprint.fixtures';

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
      call(args);
      return {
        output: JSON.stringify(providerDraft(fixture)),
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
  const claimBefore = fs.readFileSync(
    ledgerFile(subject.repoRoot, 'execution-claims', `${authoringAuthorityDigest}.json`),
    'utf8',
  );
  // Delete every downstream terminal artifact, preserving only the claim. A
  // real orphan is a claim written before any terminal manifest/binding, so the
  // terminal binding (written after the manifest) is absent too.
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-lookups', `${authoringAuthorityDigest}.json`),
  );
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-bindings', `${authoringAuthorityDigest}.json`),
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
  return { preflight, authoringAuthorityDigest, claimBefore };
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
  const claimBefore = fs.readFileSync(
    ledgerFile(subject.repoRoot, 'execution-claims', `${authoringAuthorityDigest}.json`),
    'utf8',
  );
  // Round-2 wrote a terminal binding and lookup; a legacy crash predates both.
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-lookups', `${authoringAuthorityDigest}.json`),
  );
  fs.rmSync(
    ledgerFile(subject.repoRoot, 'terminal-bindings', `${authoringAuthorityDigest}.json`),
  );
  return { preflight, authoringAuthorityDigest, claimBefore, completed };
}

describe('QA Wizard Blueprint replacement (orphan-claim successor) lifecycle', () => {
  it('advances an unresolved orphan through proposal → review → Guy approval → one successor execution and replays with zero calls', async () => {
    const subject = setup();
    const { preflight, authoringAuthorityDigest, claimBefore } =
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
        ledgerFile(subject.repoRoot, 'execution-claims', `${authoringAuthorityDigest}.json`),
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
    const { authorization, preflight, authoringAuthorityDigest, claimBefore } =
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
      `${authoringAuthorityDigest}.json`,
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
        ledgerFile(
          subject.repoRoot,
          'execution-claims',
          `${authoringAuthorityDigest}.json`,
        ),
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
        ledgerFile(
          subject.repoRoot,
          'execution-claims',
          `${legacy.authoringAuthorityDigest}.json`,
        ),
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
