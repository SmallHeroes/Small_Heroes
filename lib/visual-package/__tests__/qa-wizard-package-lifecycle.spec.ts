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
  executeQaWizardBlueprintLiveRequest,
  prepareQaWizardBlueprintLiveRequest,
  recordQaWizardBlueprintApproval,
} from '../qaWizardBlueprintAuthoringLifecycle';
import {
  QA_WIZARD_PACKAGE_LIFECYCLE_LEDGER_ROOT,
  loadQaWizardPackageLifecycleManifest,
  prepareQaWizardPackageCandidate,
  publishQaWizardApprovedPackage,
  recordQaWizardPackageApproval,
} from '../qaWizardPackageLifecycle';
import * as visualPackageArtifacts from '../artifacts';
import { qualifyVisualPackageV4Candidate } from '../visualPackageV4Lifecycle';
import {
  buildProductionAuthoringContext,
  type ProductionAuthoringContext,
} from '../productionAuthoringContext';
import { buildStorySourceAuthoritySnapshot } from '../storySourceAuthority';
import {
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
} from '../styleAuthority';
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
import {
  buildBlueprintFixture,
  buildVisualContractCandidateFixture,
  projectCurrentBlueprintProviderWorldPlan,
} from './pre-render-book-visual-blueprint.fixtures';

const tempRoots: string[] = [];
const BLUEPRINT_OUTPUT_DIR = 'outputs/blueprint-operator';
const PACKAGE_OUTPUT_DIR = 'outputs/package-operator';
const BLUEPRINT_REQUESTED_AT = '2026-08-25T12:00:00.000Z';
const BLUEPRINT_APPROVED_AT = '2026-08-25T12:30:00.000Z';
const PACKAGE_REVIEWED_AT = '2026-08-25T13:00:00.000Z';
const PACKAGE_APPROVED_AT = '2026-08-25T13:30:00.000Z';
const PACKAGE_PUBLISHED_AT = '2026-08-25T14:00:00.000Z';
const STYLE_ID = 'soft_hand_drawn_storybook';

afterEach(() => {
  bridgeLoaderMock.mockReset();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'qa-wizard-package-lifecycle-'),
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

function providerDraft(
  fixture: ReturnType<typeof buildBlueprintFixture>,
): unknown {
  return {
    worldPlan: projectCurrentBlueprintProviderWorldPlan(fixture.blueprint),
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

function passingProvider(
  fixture: ReturnType<typeof buildBlueprintFixture>,
): ProductionAuthoringProvider {
  return {
    call: async (args) => ({
      output: JSON.stringify(providerDraft(fixture)),
      receipt: providerReceipt(args),
    }),
  };
}

interface ApprovedBlueprintSubject {
  repoRoot: string;
  context: ProductionAuthoringContext;
  approvedBlueprintManifestPath: string;
}

async function approvedBlueprintSubject(): Promise<ApprovedBlueprintSubject> {
  const built = buildContext();
  const bridge = approvedBridge(built.context);
  const bridgeManifestPath =
    `outputs/bridge/bridge-manifests/${bridge.digest}.json`;
  bridgeLoaderMock.mockImplementation(() => ({
    manifest: bridge,
    context: built.context,
  }));
  const preflight = prepareQaWizardBlueprintLiveRequest({
    repoRoot: built.repoRoot,
    bridgeManifestPath,
    outputDir: BLUEPRINT_OUTPUT_DIR,
    requestId: 'blueprint-live-request-001',
    requestedAt: BLUEPRINT_REQUESTED_AT,
    write: true,
  });
  const candidate = await executeQaWizardBlueprintLiveRequest(
    {
      repoRoot: built.repoRoot,
      preflightManifestPath: preflight.manifestPath,
      outputDir: BLUEPRINT_OUTPUT_DIR,
      write: true,
    },
    { providerFactory: () => passingProvider(built.fixture) },
  );
  const approved = recordQaWizardBlueprintApproval({
    repoRoot: built.repoRoot,
    candidateManifestPath: candidate.manifestPath,
    outputDir: BLUEPRINT_OUTPUT_DIR,
    expectedBlueprintDigest: candidate.manifest.blueprint!.blueprintDigest,
    expectedAuthoringAuthorityDigest:
      candidate.manifest.blueprint!.authoringAuthorityDigest,
    expectedReviewPacketDigest:
      candidate.manifest.blueprint!.reviewPacketDigest,
    approvedBy: 'Guy',
    approvedAt: BLUEPRINT_APPROVED_AT,
    write: true,
  });
  return {
    repoRoot: built.repoRoot,
    context: built.context,
    approvedBlueprintManifestPath: approved.manifestPath,
  };
}

function preparePackage(subject: ApprovedBlueprintSubject) {
  return prepareQaWizardPackageCandidate({
    repoRoot: subject.repoRoot,
    approvedBlueprintManifestPath: subject.approvedBlueprintManifestPath,
    outputDir: PACKAGE_OUTPUT_DIR,
    worldMode: 'grounded',
    reviewedBy: 'Guy',
    reviewedAt: PACKAGE_REVIEWED_AT,
    write: true,
  });
}

function approvePackage(
  subject: ApprovedBlueprintSubject,
  prepared: ReturnType<typeof preparePackage>,
) {
  return recordQaWizardPackageApproval({
    repoRoot: subject.repoRoot,
    candidateManifestPath: prepared.manifestPath,
    outputDir: PACKAGE_OUTPUT_DIR,
    expectedPackageCandidateDigest: prepared.candidate.digest,
    expectedPackageReviewDigest: prepared.packageReview.digest,
    approvedBy: 'Guy',
    approvedAt: PACKAGE_APPROVED_AT,
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

describe('QA Wizard visual-package lifecycle', () => {
  it('prepares an exact approval-ready package with zero external counters', async () => {
    const subject = await approvedBlueprintSubject();
    const preview = prepareQaWizardPackageCandidate({
      repoRoot: subject.repoRoot,
      approvedBlueprintManifestPath: subject.approvedBlueprintManifestPath,
      outputDir: PACKAGE_OUTPUT_DIR,
      worldMode: 'grounded',
      reviewedBy: 'Guy',
      reviewedAt: PACKAGE_REVIEWED_AT,
      write: false,
    });
    expect(preview.manifest.stage).toBe('package_candidate');
    expect(preview.qualification).toMatchObject({
      candidateValid: true,
      reviewReady: true,
      approvalValid: false,
      readyForPublication: false,
      zeroWrite: true,
    });
    expect(preview.qualification.reasons.map((reason) => reason.code)).toEqual([
      'package_approval_missing',
    ]);
    expect(preview.manifest.externalCounters).toEqual({
      providerCalls: 0,
      imageRenders: 0,
      audioRenders: 0,
      databaseWrites: 0,
      storageWrites: 0,
      locatorWrites: 0,
    });
    expect(preview.manifest.locatorBefore).toMatchObject({
      state: 'absent',
      sha256: null,
      locator: null,
    });
    expect(fs.existsSync(path.join(subject.repoRoot, preview.manifestPath))).toBe(
      false,
    );

    const written = preparePackage(subject);
    expect(
      loadQaWizardPackageLifecycleManifest({
        repoRoot: subject.repoRoot,
        manifestPath: written.manifestPath,
      }),
    ).toEqual(written.manifest);
    expect(fs.existsSync(path.join(subject.repoRoot, written.manifest.package.candidatePath)))
      .toBe(true);
    expect(fs.existsSync(path.join(subject.repoRoot, written.manifest.package.reviewPath)))
      .toBe(true);
  });

  it('treats invalid Set authority as candidate-invalid without stale-board noise', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const resolver = vi.spyOn(
      visualPackageArtifacts,
      'resolveRequiredBoardArtifacts',
    )
      .mockReturnValue({
        boards: [],
        issues: [{
          code: 'board_authority_invalid',
          message: 'synthetic complete Set authority census failure',
        }],
      });
    const qualification = qualifyVisualPackageV4Candidate({
      repoRoot: subject.repoRoot,
      candidate: prepared.candidate,
      packageReview: prepared.packageReview,
    });
    expect(qualification).toMatchObject({
      candidateValid: false,
      reviewReady: false,
      approvalValid: false,
      readyForPublication: false,
    });
    expect(qualification.reasons.map((reason) => reason.code)).toContain(
      'set_authority_invalid',
    );
    expect(qualification.reasons.map((reason) => reason.code)).not.toContain(
      'board_stale',
    );
    resolver.mockRestore();
  });

  it('records one exact approval, replays without changes, and rejects another timestamp', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const approvalArgs = {
      repoRoot: subject.repoRoot,
      candidateManifestPath: prepared.manifestPath,
      outputDir: PACKAGE_OUTPUT_DIR,
      expectedPackageCandidateDigest: prepared.candidate.digest,
      expectedPackageReviewDigest: prepared.packageReview.digest,
      approvedBy: 'Guy' as const,
      approvedAt: PACKAGE_APPROVED_AT,
      write: true,
    };
    const written = recordQaWizardPackageApproval(approvalArgs);
    expect(written.manifest.stage).toBe('package_approved');
    expect(written.manifest.package.approvedRevisionDigest).toBe(
      written.packageValue.revisionDigest,
    );
    const beforeReplay = fileInventory(subject.repoRoot);
    const replay = recordQaWizardPackageApproval(approvalArgs);
    expect(replay.approval.digest).toBe(written.approval.digest);
    expect(fileInventory(subject.repoRoot)).toEqual(beforeReplay);
    expect(() =>
      recordQaWizardPackageApproval({
        ...approvalArgs,
        approvedAt: '2026-08-25T13:31:00.000Z',
      }),
    ).toThrow(/approval decision.*conflicts|different.*approval/i);
    expect(fileInventory(subject.repoRoot)).toEqual(beforeReplay);
  });

  it('recovers an exact approval after the candidate-keyed decision is durable', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const args = {
      repoRoot: subject.repoRoot,
      candidateManifestPath: prepared.manifestPath,
      outputDir: PACKAGE_OUTPUT_DIR,
      expectedPackageCandidateDigest: prepared.candidate.digest,
      expectedPackageReviewDigest: prepared.packageReview.digest,
      approvedBy: 'Guy' as const,
      approvedAt: PACKAGE_APPROVED_AT,
      write: true,
    };
    const preview = recordQaWizardPackageApproval({ ...args, write: false });
    expect(() =>
      recordQaWizardPackageApproval(args, {
        afterApprovalDecision() {
          throw new Error('simulated_crash_after_package_approval_decision');
        },
      }),
    ).toThrow('simulated_crash_after_package_approval_decision');
    expect(fs.existsSync(path.join(subject.repoRoot, preview.decisionPath))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(subject.repoRoot, preview.approvalPath))).toBe(
      false,
    );
    const recovered = recordQaWizardPackageApproval(args);
    expect(recovered.manifest.stage).toBe('package_approved');
    expect(
      loadQaWizardPackageLifecycleManifest({
        repoRoot: subject.repoRoot,
        manifestPath: recovered.manifestPath,
      }),
    ).toEqual(recovered.manifest);
  });

  it('publishes with locator CAS and replays without another locator write', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const approved = approvePackage(subject, prepared);
    const publicationArgs = {
      repoRoot: subject.repoRoot,
      approvedManifestPath: approved.manifestPath,
      outputDir: PACKAGE_OUTPUT_DIR,
      publishedAt: PACKAGE_PUBLISHED_AT,
      write: true,
    };
    const published = publishQaWizardApprovedPackage(publicationArgs);
    expect(published.manifest.stage).toBe('package_published');
    expect(published.locatorChanged).toBe(true);
    expect(published.manifest.externalCounters.locatorWrites).toBe(1);
    expect(fs.readFileSync(path.join(subject.repoRoot, published.packagePath), 'utf8'))
      .toBe(`${JSON.stringify(published.packageValue, null, 2)}\n`);
    expect(fs.readFileSync(path.join(subject.repoRoot, published.locatorPath), 'utf8'))
      .toBe(`${JSON.stringify(published.locator, null, 2)}\n`);
    const beforeReplay = fileInventory(subject.repoRoot);
    const replay = publishQaWizardApprovedPackage(publicationArgs);
    expect(replay.manifest.digest).toBe(published.manifest.digest);
    expect(replay.locatorChanged).toBe(false);
    expect(fileInventory(subject.repoRoot)).toEqual(beforeReplay);
  });

  it('rejects a stale or tampered locator before approval or publication', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const locatorAbsolute = path.join(
      subject.repoRoot,
      prepared.manifest.locatorBefore.path,
    );
    fs.mkdirSync(path.dirname(locatorAbsolute), { recursive: true });
    fs.writeFileSync(locatorAbsolute, '{"hostile":true}\n', 'utf8');
    expect(() => approvePackage(subject, prepared)).toThrow(
      /locator changed after package review/i,
    );

    fs.rmSync(locatorAbsolute);
    const approved = approvePackage(subject, prepared);
    fs.writeFileSync(locatorAbsolute, '{"hostile":"after-approval"}\n', 'utf8');
    const inventory = fileInventory(subject.repoRoot);
    expect(() =>
      publishQaWizardApprovedPackage({
        repoRoot: subject.repoRoot,
        approvedManifestPath: approved.manifestPath,
        outputDir: PACKAGE_OUTPUT_DIR,
        publishedAt: PACKAGE_PUBLISHED_AT,
        write: true,
      }),
    ).toThrow(/locator changed|reviewed predecessor/i);
    expect(fileInventory(subject.repoRoot)).toEqual(inventory);
  });

  it('fails closed without removing a held locator lock or publishing bytes', async () => {
    const subject = await approvedBlueprintSubject();
    const prepared = preparePackage(subject);
    const approved = approvePackage(subject, prepared);
    const args = {
      repoRoot: subject.repoRoot,
      approvedManifestPath: approved.manifestPath,
      outputDir: PACKAGE_OUTPUT_DIR,
      publishedAt: PACKAGE_PUBLISHED_AT,
      write: true,
    };
    const preview = publishQaWizardApprovedPackage({ ...args, write: false });
    const locatorAbsolute = path.join(subject.repoRoot, preview.locatorPath);
    const lockPath = `${locatorAbsolute}.qa-wizard-package.lock`;
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, 'held\n', 'utf8');

    expect(() => publishQaWizardApprovedPackage(args)).toThrow();
    expect(fs.readFileSync(lockPath, 'utf8')).toBe('held\n');
    expect(fs.existsSync(locatorAbsolute)).toBe(false);
    expect(fs.existsSync(path.join(subject.repoRoot, preview.packagePath))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(subject.repoRoot, preview.manifestPath))).toBe(
      false,
    );
  });

  it.each([
    'afterPublicationClaim',
    'afterRevisionWrite',
    'afterLocatorWrite',
  ] as const)(
    'recovers publication after a crash at %s without changing the approved successor',
    async (hookName) => {
      const subject = await approvedBlueprintSubject();
      const prepared = preparePackage(subject);
      const approved = approvePackage(subject, prepared);
      const args = {
        repoRoot: subject.repoRoot,
        approvedManifestPath: approved.manifestPath,
        outputDir: PACKAGE_OUTPUT_DIR,
        publishedAt: PACKAGE_PUBLISHED_AT,
        write: true,
      };
      const preview = publishQaWizardApprovedPackage({ ...args, write: false });
      expect(() =>
        publishQaWizardApprovedPackage(args, {
          [hookName]: () => {
            throw new Error(`simulated_crash_${hookName}`);
          },
        }),
      ).toThrow(`simulated_crash_${hookName}`);
      expect(
        fs.existsSync(
          path.join(subject.repoRoot, preview.publicationClaimPath),
        ),
      ).toBe(true);
      expect(() =>
        publishQaWizardApprovedPackage({
          ...args,
          publishedAt: '2026-08-25T14:01:00.000Z',
        }),
      ).toThrow(/publication claim.*conflicts/i);
      const recovered = publishQaWizardApprovedPackage(args);
      expect(recovered.manifest.stage).toBe('package_published');
      expect(fs.existsSync(path.join(subject.repoRoot, recovered.packagePath))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(subject.repoRoot, recovered.locatorPath))).toBe(
        true,
      );
      expect(
        fs.existsSync(path.join(subject.repoRoot, recovered.manifestPath)),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            subject.repoRoot,
            QA_WIZARD_PACKAGE_LIFECYCLE_LEDGER_ROOT,
            'publication-claims',
            `${prepared.candidate.digest}.json`,
          ),
        ),
      ).toBe(true);
    },
  );
});
