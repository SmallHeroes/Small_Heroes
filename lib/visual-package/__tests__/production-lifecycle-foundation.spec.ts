import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
  PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  auditProductionStoryReadiness,
  buildProductionAuthoringRunRequest,
  buildProductionAuthoringContext,
  buildStorySourceAuthoritySnapshot,
  buildProductionReconciliationDraftBundle,
  buildReconciliationReviewBundle,
  canonicalJsonDigest,
  loadProductionStyleAuthority,
  persistProductionAuthoringReceipt,
  persistReconciliationDraftBundle,
  productionAuthoringReceiptVersionStatus,
  productionAuthoringRequestVersionStatus,
  productionBlueprintAuthoringPreflightIssues,
  productionBlueprintInitialInputAccounting,
  runProductionBlueprintAuthoring,
  productionAuthoringRunResultIsCompleted,
  productionAuthoringRunResultIsFailed,
  deriveBlueprintAuthoringSanitizedFailureCaptureDisposition,
  blueprintAuthoringReceiptRequiresSanitizedCapture,
  blueprintAuthoringSanitizedFailureCaptureIsValid,
  ProductionAuthoringProviderBoundaryError,
  type ProductionAuthoringProvider,
  type ProductionAuthoringContext,
  type ProductionAuthoringRunRequest,
} from '@/lib/visual-package';
import {
  createOpenAIResponsesBlueprintAuthoringAdapter,
} from '@/lib/visual-package/openaiResponsesBlueprintAuthoringAdapter';
import type {
  OpenAIResponsesAuthoringTransport,
  OpenAIResponsesAuthoringTransportRequest,
} from '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter';
import {
  BLUEPRINT_AUTHORING_MAX_CALLS,
  BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
  BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
  BLUEPRINT_AUTHORING_MODEL,
  BLUEPRINT_AUTHORING_REASONING_EFFORT,
  OPENAI_RESPONSES_BLUEPRINT_AUTHORING_EVIDENCE_VERSION,
  blueprintAuthoringInputAccounting,
  blueprintAuthoringReservedExposureUsd,
  conservativeBlueprintAuthoringCostUsd,
  nominalBlueprintAuthoringUsageCostUsd,
} from '@/lib/visual-package/blueprintAuthoringPolicy';
import { PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA } from '@/lib/visual-package/preRenderBlueprintDraftSchema';
import {
  PreRenderBlueprintAuthoringRepairExhaustedError,
  preRenderBlueprintRepairDiagnosticErrorText,
  type PreRenderBlueprintRepairDiagnostic,
} from '@/lib/visual-package/preRenderBlueprintAuthoring';
import {
  sanitizedAuthoringDiagnostics,
  type AuthoringDiagnosticCode,
} from '@/lib/visual-package/authoringTerminalDiagnostics';
import type { ProductionAuthoringAttemptReceipt } from '@/lib/visual-package/productionAuthoringRunner';
import { productionBlueprintAuthoringReceiptReplayIsValid } from '@/lib/visual-package/qaWizardBlueprintAuthoringLifecycle';
import { computeProductionAuthoringContextDigest } from '@/lib/visual-package/productionAuthoringContext';
import { projectZoneStableGeometry } from '@/lib/visual-contract-compiler';

import {
  buildBlueprintFixture,
  buildVisualContractCandidateFixture,
  type BlueprintFixtureOptions,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const tempRoots: string[] = [];
const STYLE_ID = 'soft_hand_drawn_storybook';
const ALL_SHAPES: BlueprintFixtureShape[] = [
  'single_location',
  'multi_zone_transition',
  'journey_fantastical',
  'no_companion',
  'reveal_timeline',
];
type ProductionProviderCallArgs = Parameters<
  ProductionAuthoringProvider['call']
>[0];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pvb-d0-foundation-'));
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

function materializeFixture(
  shape: BlueprintFixtureShape,
  options?: BlueprintFixtureOptions,
): {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
  templatePath: string;
  reconciliationPath: string;
  candidatePath: string;
  fixture: ReturnType<typeof buildBlueprintFixture>;
} {
  const repoRoot = tempRoot();
  const fixture = buildBlueprintFixture(shape, options);
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
  return {
    repoRoot,
    storyKey,
    storyPath,
    templatePath,
    reconciliationPath,
    candidatePath,
    fixture,
  };
}

function buildContext(
  shape: BlueprintFixtureShape = 'single_location',
): {
  context: ProductionAuthoringContext;
  materialized: ReturnType<typeof materializeFixture>;
} {
  const materialized = materializeFixture(shape);
  const context = buildProductionAuthoringContext({
    repoRoot: materialized.repoRoot,
    storyKey: materialized.storyKey,
    storyPath: materialized.storyPath,
    templatePath: materialized.templatePath,
    reconciliationPath: materialized.reconciliationPath,
    candidatePath: materialized.candidatePath,
    styleId: STYLE_ID,
    styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  });
  return { context, materialized };
}

function requestFor(
  context: ProductionAuthoringContext,
  mode: 'preflight' | 'live',
  maxCalls = BLUEPRINT_AUTHORING_MAX_CALLS,
): ProductionAuthoringRunRequest {
  return {
    version: PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
    mode,
    requestId: `request-${mode}`,
    requestedAt: '2026-07-27T12:00:00.000Z',
    contextDigest: context.digest,
    model: BLUEPRINT_AUTHORING_MODEL,
    reasoningEffort: BLUEPRINT_AUTHORING_REASONING_EFFORT,
    maxOutputTokens: BLUEPRINT_AUTHORING_MAX_OUTPUT_TOKENS,
    noFallback: true,
    callBudget: {
      maxCalls,
      maxRepairCount: maxCalls - 1,
    },
  };
}

function canonicalProviderReceipt(args: {
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
  const conservativeCallCostUsd =
    conservativeBlueprintAuthoringCostUsd({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
  return {
    provider: 'openai',
    model: BLUEPRINT_AUTHORING_MODEL,
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
    reservedExposureBeforeCallUsd:
      blueprintAuthoringReservedExposureUsd({
        conservativeAccountedCostUsd:
          (args.attempt - 1) * conservativeCallCostUsd,
        callsCompleted: args.attempt - 1,
      }),
    nominalEstimatedCostUsd:
      nominalBlueprintAuthoringUsageCostUsd(usage),
    conservativeCallCostUsd,
  };
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

describe('canonical production Style01 authority', () => {
  it('loads structured content by exact digest without marketing or mutable prompt fields', () => {
    const loaded = loadProductionStyleAuthority({
      repoRoot: process.cwd(),
      artifactPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      expectedStyleId: STYLE_ID,
    });
    expect(loaded.identity.digest).toBe(canonicalJsonDigest(loaded.content));
    expect(loaded.content.authorityBoundaries.doesNotOwn).toEqual(
      expect.arrayContaining([
        'camera',
        'composition',
        'staging',
        'action',
        'pose',
        'blocking',
        'placement',
        'page layout',
      ]),
    );
    expect(loaded.content).not.toHaveProperty('userLabel');
    expect(loaded.content).not.toHaveProperty('wizardBlurb');
    expect(loaded.content).not.toHaveProperty('optionBlock');
  });

  it('fails closed on stale content, wrong style, and repository escape', () => {
    const root = tempRoot();
    writeJson(
      root,
      STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      styleAuthorityContent(),
    );
    expect(() =>
      loadProductionStyleAuthority({
        repoRoot: root,
        artifactPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
        expectedStyleId: STYLE_ID,
        expectedDigest: '0'.repeat(64),
      }),
    ).toThrow(/content digest mismatch/);
    expect(() =>
      loadProductionStyleAuthority({
        repoRoot: root,
        artifactPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
        expectedStyleId: 'another_style',
      }),
    ).toThrow(/styleId mismatch/);
    expect(() =>
      loadProductionStyleAuthority({
        repoRoot: root,
        artifactPath: '../outside.json',
        expectedStyleId: STYLE_ID,
      }),
    ).toThrow(/escapes repository root/);
  });
});

describe('Story Source readiness and authoring context', () => {
  for (const shape of ALL_SHAPES) {
    it(`builds exact approved authoring context for ${shape}`, () => {
      const { context, materialized } = buildContext(shape);
      expect(context.storyKey).toBe(materialized.storyKey);
      expect(context.sourceSnapshot.content).toBe(
        materialized.fixture.context.rawStorySource,
      );
      expect(context.template.identity.digest).toBe(
        canonicalJsonDigest(materialized.fixture.context.template),
      );
      expect(context.reconciliation.digest).toBe(
        canonicalJsonDigest(materialized.fixture.context.reconciliation),
      );
      expect(context.styleAuthority.identity.styleId).toBe(STYLE_ID);
      expect(context.digest).toMatch(/^[a-f0-9]{64}$/);

      const audit = auditProductionStoryReadiness({
        repoRoot: materialized.repoRoot,
        storyKey: materialized.storyKey,
        storyPath: materialized.storyPath,
        templatePath: materialized.templatePath,
        reconciliationPath: materialized.reconciliationPath,
        candidatePath: materialized.candidatePath,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
        throughStage: 'blueprint_authoring',
      });
      expect(audit.ready, JSON.stringify(audit.reasons, null, 2)).toBe(true);
      expect(audit.reasons).toEqual([]);
    });
  }

  it('rejects a self-consistent persisted reconciliation that diverges from the exact candidate', () => {
    const materialized = materializeFixture('single_location');
    const substituted = structuredClone(
      materialized.fixture.context.reconciliation,
    );
    const record =
      substituted.actionSemanticCoverageAuthority.records[0]!;
    record.beatId = `beat:p${record.pageNumber}:substituted_identity`;
    const substitutedDigest = canonicalJsonDigest(
      substituted.actionSemanticCoverageAuthority.records,
    );
    substituted.actionSemanticCoverageAuthority
      .actionSemanticCoverageDigest = substitutedDigest;
    substituted.presentationRequirements
      .actionSemanticCoverageDigest = substitutedDigest;
    writeJson(
      materialized.repoRoot,
      materialized.reconciliationPath,
      substituted,
    );

    expect(() =>
      buildProductionAuthoringContext({
        repoRoot: materialized.repoRoot,
        storyKey: materialized.storyKey,
        storyPath: materialized.storyPath,
        templatePath: materialized.templatePath,
        reconciliationPath: materialized.reconciliationPath,
        candidatePath: materialized.candidatePath,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/candidate-mismatched/);

    const audit = auditProductionStoryReadiness({
      repoRoot: materialized.repoRoot,
      storyKey: materialized.storyKey,
      storyPath: materialized.storyPath,
      templatePath: materialized.templatePath,
      reconciliationPath: materialized.reconciliationPath,
      candidatePath: materialized.candidatePath,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      throughStage: 'blueprint_authoring',
    });
    expect(audit.ready).toBe(false);
    expect(audit.reasons).toContainEqual(
      expect.objectContaining({
        stage: 'reconciliation_review',
        message: expect.stringContaining('candidate-mismatched'),
      }),
    );
  });

  it('rejects a redigested candidate whose template body does not match its declared template digest', () => {
    const materialized = materializeFixture('single_location');
    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: materialized.repoRoot,
      storyKey: materialized.storyKey,
      storyPath: materialized.storyPath,
    });
    const candidate = buildVisualContractCandidateFixture({
      fixture: materialized.fixture,
      sourceSnapshotDigest: snapshot.digest,
    });
    candidate.template.worldType = 'tampered_world';
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...candidatePayload
    } = candidate;
    candidate.digest = canonicalJsonDigest(candidatePayload);
    writeJson(
      materialized.repoRoot,
      materialized.candidatePath,
      candidate,
    );

    expect(() =>
      buildProductionAuthoringContext({
        repoRoot: materialized.repoRoot,
        storyKey: materialized.storyKey,
        storyPath: materialized.storyPath,
        templatePath: materialized.templatePath,
        reconciliationPath: materialized.reconciliationPath,
        candidatePath: materialized.candidatePath,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/candidate is stale, malformed/);
  });

  it('returns structured reasons for incomplete cover, stale source, and unresolved reconciliation', () => {
    const materialized = materializeFixture('reveal_timeline');
    const incompleteTemplate = structuredClone(materialized.fixture.context.template);
    delete (incompleteTemplate.coverContract as { zoneId?: string }).zoneId;
    writeJson(materialized.repoRoot, materialized.templatePath, incompleteTemplate);
    const audit = auditProductionStoryReadiness({
      repoRoot: materialized.repoRoot,
      storyKey: materialized.storyKey,
      storyPath: materialized.storyPath,
      templatePath: materialized.templatePath,
      reconciliationPath: materialized.reconciliationPath,
      candidatePath: materialized.candidatePath,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      throughStage: 'blueprint_authoring',
    });
    expect(audit.ready).toBe(false);
    expect(audit.reasons.map((candidate) => candidate.code)).toEqual(
      expect.arrayContaining([
        'cover_authority_incomplete',
        'reconciliation_stale',
      ]),
    );

    writeText(
      materialized.repoRoot,
      materialized.storyPath,
      `${materialized.fixture.context.rawStorySource}\nsemantic mutation`,
    );
    const stale = auditProductionStoryReadiness({
      repoRoot: materialized.repoRoot,
      storyKey: materialized.storyKey,
      storyPath: materialized.storyPath,
      templatePath: materialized.templatePath,
      reconciliationPath: materialized.reconciliationPath,
      candidatePath: materialized.candidatePath,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      throughStage: 'blueprint_authoring',
    });
    expect(stale.ready).toBe(false);
    expect(stale.reasons.some((candidate) =>
      ['reconciliation_stale', 'template_invalid'].includes(candidate.code),
    )).toBe(true);
  });

  it.each([
    { grouping: 'one', expectedSets: 1 },
    { grouping: 'per_location', expectedSets: 3 },
  ] as const)(
    'enumerates $expectedSets unresolved Set Board requirement(s) for a multi-location $grouping story',
    ({ grouping, expectedSets }) => {
      const materialized = materializeFixture('journey_fantastical', {
        mutateTemplate: (template) => {
          for (const [index, location] of template.locations.entries()) {
            location.setIdentityId =
              grouping === 'one' ? 'set:whole_world' : `set:${index + 1}`;
            location.setReference = { status: 'pending' };
          }
          for (const zone of template.zones) {
            zone.spatialNodes = zone.spatialNodes!.map((node) => ({
              id: node.id,
              kind: node.kind,
              description: `stable physical ${node.kind}`,
            }));
            zone.stableGeometry = projectZoneStableGeometry(zone);
          }
          const setIds = [
            ...new Set(
              template.locations.map(
                (location) => location.setIdentityId!,
              ),
            ),
          ];
          template.setBoardAuthorities = setIds.map((setIdentityId) => {
            const locations = template.locations.filter(
              (location) => location.setIdentityId === setIdentityId,
            );
            const locationIds = new Set(
              locations.map((location) => location.id),
            );
            return {
              setIdentityId,
              locations: locations.map((location) => ({
                locationId: location.id,
                name: location.name,
                environmentClass: location.environmentClass!,
                timeOfDay: location.timeOfDay!,
                lighting: location.lighting!,
              })),
              areas: template.zones
                .filter((zone) => locationIds.has(zone.locationId))
                .map((zone) => ({
                  id: `board:${zone.id}`,
                  locationId: zone.locationId,
                  zoneProjection: {
                    cardinality: 'one_to_one' as const,
                    zoneIds: [zone.id] as [string],
                  },
                  spatialNodes: zone.spatialNodes!.map((node) => ({
                    id: node.id,
                    kind: node.kind,
                    description: node.description,
                  })),
                  ...(zone.spatialRelations
                    ? {
                        spatialRelations: structuredClone(
                          zone.spatialRelations,
                        ),
                      }
                    : {}),
                })),
              fixedObjects: [],
            };
          });
        },
      });
      const audit = auditProductionStoryReadiness({
        repoRoot: materialized.repoRoot,
        storyKey: materialized.storyKey,
        storyPath: materialized.storyPath,
        templatePath: materialized.templatePath,
        reconciliationPath: materialized.reconciliationPath,
        candidatePath: materialized.candidatePath,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
        throughStage: 'board_compatibility',
      });
      expect(audit.requiredSetIdentityIds).toHaveLength(expectedSets);
      expect(
        audit.reasons.filter((reason) => reason.code === 'board_missing'),
        JSON.stringify(audit.reasons, null, 2),
      ).toHaveLength(expectedSets);
      expect(audit.ready).toBe(false);
    },
  );

  it('audits the real Fox source/template read-only without treating it as a special path', () => {
    const audit = auditProductionStoryReadiness({
      repoRoot: process.cwd(),
      storyKey: 'fox_uri_adventure',
      storyPath: 'story-bank/v3-approved/fox_uri_adventure.md',
      templatePath:
        'story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json',
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      throughStage: 'source_authority',
    });
    expect(audit.source?.pageCount).toBeGreaterThan(0);
    expect(audit.templateIdentity?.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(audit.reasons.map((candidate) => candidate.code)).not.toContain(
      'source_missing',
    );
    expect(audit.reasons.map((candidate) => candidate.code)).not.toContain(
      'template_missing',
    );
  });

  it('rejects absolute and escaping input paths', () => {
    const materialized = materializeFixture('single_location');
    expect(() =>
      buildProductionAuthoringContext({
        repoRoot: materialized.repoRoot,
        storyKey: materialized.storyKey,
        storyPath: path.join(materialized.repoRoot, materialized.storyPath),
        templatePath: materialized.templatePath,
        reconciliationPath: materialized.reconciliationPath,
        candidatePath: materialized.candidatePath,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/manifest path must be repository-relative/);
    const audit = auditProductionStoryReadiness({
      repoRoot: materialized.repoRoot,
      storyKey: materialized.storyKey,
      storyPath: '../outside.md',
      templatePath: materialized.templatePath,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      throughStage: 'source_authority',
    });
    expect(audit.ready).toBe(false);
    expect(audit.reasons[0]?.code).toBe('source_invalid');
  });
});

describe('reconciliation draft and review workflow', () => {
  it('enumerates exact requirements but fabricates no beats or approvals', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bundle = buildProductionReconciliationDraftBundle({
      storyKey: fixture.blueprint.identity.storyKey,
      sourceIdentity: fixture.context.source,
      rawStorySource: fixture.context.rawStorySource,
      template: fixture.context.template,
      actionSemanticCoverage: [],
    });
    expect(
      bundle.reconciliation.frames.flatMap((frame) =>
        frame.sourceRequirements.flatMap(
          (requirement) => requirement.visualBeats,
        ),
      ),
    ).toEqual([]);
    expect(bundle.reconciliation.review).toEqual({
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(bundle.reviewBundle.readyForApproval).toBe(false);
    expect(bundle.reviewBundle.blockingIssues.some(
      (issue) => issue.code === 'reconciliation_incomplete',
    )).toBe(true);
    expect(bundle.markdown).toContain('Ready for reconciliation approval: **NO**');
    expect(bundle.markdown).toContain('Exact source requirements');
  });

  it('binds a complete reviewed reconciliation and defaults to zero-write persistence', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bundle = buildReconciliationReviewBundle({
      reconciliation: fixture.context.reconciliation,
      sourceIdentity: fixture.context.source,
      rawStorySource: fixture.context.rawStorySource,
      template: fixture.context.template,
      actionSemanticCoverage:
        fixture.context.reconciliation
          .actionSemanticCoverageAuthority.records,
    });
    expect(bundle.readyForApproval).toBe(true);
    expect(bundle.blockingIssues).toEqual([]);
    const root = tempRoot();
    const planned = persistReconciliationDraftBundle({
      repoRoot: root,
      outputDir: 'outputs/reconciliation',
      reconciliation: fixture.context.reconciliation,
      reviewBundle: bundle,
      markdown: '# safe review\n',
    });
    expect(planned.wrote).toBe(false);
    expect(fs.existsSync(path.join(root, planned.reviewBundlePath))).toBe(false);
    expect(() =>
      persistReconciliationDraftBundle({
        repoRoot: root,
        outputDir: '../outside',
        reconciliation: fixture.context.reconciliation,
        reviewBundle: bundle,
        markdown: '# safe review\n',
      }),
    ).toThrow(/escapes repository root/);
  });
});

describe('provider-isolated Blueprint authoring runner', () => {
  it('builds one exact locked request and rejects added nested budget authority', () => {
    const { context } = buildContext();
    const request = buildProductionAuthoringRunRequest({
      context,
      mode: 'live',
      requestId: 'request-live',
      requestedAt: '2026-07-27T12:00:00.000Z',
    });
    expect(request).toEqual(requestFor(context, 'live'));
    const hostile = structuredClone(request) as ProductionAuthoringRunRequest & {
      callBudget: ProductionAuthoringRunRequest['callBudget'] & {
        extra: boolean;
      };
    };
    hostile.callBudget.extra = true;
    expect(
      productionBlueprintAuthoringPreflightIssues({
        request: hostile,
        context,
      }),
    ).toContain('callBudget keys are invalid');
  });

  it('keeps provider, network, storage, registry, approval, publication, render, and Vision unreachable in preflight', async () => {
    const { context } = buildContext('multi_zone_transition');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('provider boundary must be unreachable');
      }),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'preflight'),
      context,
      provider,
    });
    expect(result.receipt.status).toBe('preflight_passed');
    expect(result.receipt.callCount).toBe(0);
    expect(result.receipt.attempts).toEqual([]);
    expect(result.authoringResult).toBeNull();
    expect(provider.call).not.toHaveBeenCalled();
    const readCredential = vi.fn(() => 'must-not-be-read');
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async () => {
        throw new Error('transport must remain unreachable');
      }),
    };
    const realAdapter =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        readCredential,
        transport,
      });
    const realAdapterPreflight =
      await runProductionBlueprintAuthoring({
        request: requestFor(context, 'preflight'),
        context,
        provider: realAdapter,
      });
    expect(realAdapterPreflight.receipt.status).toBe(
      'preflight_passed',
    );
    expect(readCredential).not.toHaveBeenCalled();
    expect(transport.create).not.toHaveBeenCalled();
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /systemPrompt|userPrompt|responseBody|credential|apiKey|Bearer/i,
    );
    const root = tempRoot();
    const persisted = persistProductionAuthoringReceipt({
      repoRoot: root,
      outputDir: 'outputs/receipts',
      receipt: result.receipt,
    });
    expect(persisted.wrote).toBe(false);
    expect(fs.existsSync(path.join(root, persisted.receiptPath))).toBe(false);

    const cliSource = fs.readFileSync(
      path.join(
        process.cwd(),
        'scripts/production-visual-lifecycle.ts',
      ),
      'utf8',
    );
    const importBlock = cliSource
      .split(/\r?\n/)
      .filter((line) => /^import\b|^\s+from\b/.test(line))
      .join('\n');
    expect(importBlock).not.toMatch(
      /openai|replicate|supabase|prisma|puppeteer|vision|render/i,
    );
    expect(cliSource).not.toMatch(
      /process\.env|dotenv|fetch\s*\(|\bwrite\s*:\s*true/i,
    );
    expect(cliSource).not.toContain("command === 'approve'");
    expect(cliSource).toContain(
      "'source-authoring-preflight'",
    );
    expect(cliSource).toContain(
      '--write must be exactly true or false',
    );
    expect(cliSource).toContain(
      "'source-authoring-live-request-materialize'",
    );
    expect(cliSource).toContain(
      'Write surfaces are limited to explicit --write true for source/preflight review artifacts and source-authoring-live-request-materialize consuming repository-writer canonical materialization input for immutable future-live artifacts.',
    );
  });

  it('rejects an oversized projected prompt in preflight before a provider attempt or credential boundary', async () => {
    const { context } = buildContext('multi_zone_transition');
    const oversized = structuredClone(context);
    oversized.validationContext.styleContent = {
      ...(oversized.validationContext.styleContent as Record<string, unknown>),
      oversizedPromptProbe: 'x'.repeat(BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS),
    };
    oversized.validationContext.style = {
      ...oversized.validationContext.style,
      digest: canonicalJsonDigest(
        oversized.validationContext.styleContent,
      ),
    };
    const { digest: _staleDigest, ...payload } = oversized;
    oversized.digest = computeProductionAuthoringContextDigest(payload);
    const request = requestFor(oversized, 'live');
    const accounting = productionBlueprintInitialInputAccounting(oversized);
    const provider = { call: vi.fn() };

    expect(accounting.estimatedBytes).toBeGreaterThan(
      BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(
      productionBlueprintAuthoringPreflightIssues({
        request,
        context: oversized,
      }),
    ).toEqual([
      `initial Blueprint prompt exceeds canonical input-token ceiling: conservative upper bound ${accounting.estimatedBytes} > ${BLUEPRINT_AUTHORING_MAX_INPUT_TOKENS}`,
    ]);

    const result = await runProductionBlueprintAuthoring({
      request,
      context: oversized,
      provider,
    });
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'input_token_ceiling_exceeded',
    );
    expect(result.receipt.attempts).toEqual([]);
    expect(result.receipt.callCount).toBe(0);
    expect(result.receipt.executionAttestation.evidenceKind).toBe('not_run');
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('records only strict receipt metadata and sanitized usage through a canonical live adapter', async () => {
    const { context, materialized } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => ({
        output: JSON.stringify(providerDraft(materialized.fixture)),
        receipt: canonicalProviderReceipt(args),
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(result.receipt.status).toBe('completed');
    expect(result.receipt.version).toBe(
      PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
    );
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.repairCount).toBe(0);
    expect(result.receipt.executionAttestation).toEqual({
      evidenceKind: 'canonical_adapter_observed',
      logicalProviderCalls: 1,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    });
    expect(result.receipt.attempts[0]?.usage).toEqual({
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 20,
    });
    expect(result.receipt.attempts[0]).toMatchObject({
      inputAccounting: canonicalProviderReceipt({
        attempt: 1,
        systemPrompt: provider.call.mock.calls[0]![0].systemPrompt,
        userPrompt: provider.call.mock.calls[0]![0].userPrompt,
      }).inputAccounting,
      reservedExposureBeforeCallUsd: 4.224,
      nominalEstimatedCostUsd: 0.00208,
      conservativeCallCostUsd: 0.00242,
      cumulativeConservativeCostUsd: 0.00242,
    });
    expect(result.receipt.attempts[0]?.responseDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.authoringResult?.blueprint.digest).toBe(
      result.receipt.blueprintDigest,
    );
    expect(result.authoringResult?.blueprint.compositionPolicyVersion).toBe(
      'blueprint-composition-policy/v1',
    );
    expect(JSON.stringify(result.receipt)).not.toContain(
      'secret_debug_payload',
    );
  });

  it('rejects a noncanonical call budget before provider reachability', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('Bearer secret-token provider failure');
      }),
    };
    await expect(
      runProductionBlueprintAuthoring({
        request: requestFor(context, 'live', 1),
        context,
        provider,
      }),
    ).rejects.toThrow(/maxCalls differs from canonical Blueprint policy/);
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('redacts a canonical-adapter provider failure without another compiler call', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('Bearer raw-provider-secret');
      }),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(result.receipt.callCount).toBe(1);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /raw-provider-secret|Bearer/i,
    );
    expect(result.receipt.executionAttestation.evidenceKind).toBe(
      'injected_adapter_unattested',
    );
  });

  it('keeps a credential failure explicitly not-run with zero transport dispatches', async () => {
    const { context } = buildContext('single_location');
    const readCredential = vi.fn(() => {
      throw new Error('raw missing credential material');
    });
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async () => {
        throw new Error('transport must remain unreachable');
      }),
    };
    const provider =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        readCredential,
        transport,
      });

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(readCredential).toHaveBeenCalledTimes(1);
    expect(transport.create).not.toHaveBeenCalled();
    expect(result.receipt.executionAttestation).toEqual({
      evidenceKind: 'not_run',
      logicalProviderCalls: 0,
      transportDispatchCount: 0,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: false,
      canonicalModelConfirmed: false,
    });
    expect(result.receipt.attempts[0]).toMatchObject({
      provider: 'openai',
      model: BLUEPRINT_AUTHORING_MODEL,
      inputAccounting: expect.objectContaining({
        estimatedBytes: expect.any(Number),
      }),
      reservedExposureBeforeCallUsd: 4.224,
      executionAttestation: {
        evidenceKind: 'not_run',
        transportDispatchCount: 0,
      },
      failureCode: 'provider_call_failed',
    });
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /raw missing credential material|credential|apiKey|Bearer/i,
    );
  });

  it('preserves a proven canonical dispatch when a later repair credential read is not run', async () => {
    const { context } = buildContext('single_location');
    const readCredential = vi.fn(() => {
      if (readCredential.mock.calls.length > 1) {
        throw new Error('raw second credential failure');
      }
      return 'test-key-never-persisted';
    });
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async (
        request: OpenAIResponsesAuthoringTransportRequest,
      ) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        return {
          id: 'response-invalid-draft-1',
          model: BLUEPRINT_AUTHORING_MODEL,
          status: 'completed',
          output_text: '{"invalid":true}',
          usage: {
            input_tokens: 120,
            input_tokens_details: {
              cached_tokens: 0,
              cache_write_tokens: 0,
            },
            output_tokens: 80,
            output_tokens_details: { reasoning_tokens: 20 },
            total_tokens: 200,
          },
        };
      }),
    };
    const provider =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        readCredential,
        transport,
      });

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(readCredential).toHaveBeenCalledTimes(2);
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts).toHaveLength(2);
    expect(result.receipt.attempts[0]?.executionAttestation.evidenceKind).toBe(
      'canonical_adapter_observed',
    );
    expect(result.receipt.attempts[1]?.executionAttestation.evidenceKind).toBe(
      'not_run',
    );
    expect(result.receipt.executionAttestation).toEqual({
      evidenceKind: 'canonical_adapter_observed',
      logicalProviderCalls: 1,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    });
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /raw second credential failure|test-key-never-persisted/i,
    );
  });

  it('rejects forged canonical evidence before compiler repair and persists no output', async () => {
    const { context } = buildContext('single_location');
    const rawOutput = 'raw-hostile-output-must-not-persist';
    const rawEvidence = 'raw-hostile-evidence-must-not-persist';
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => ({
        output: rawOutput,
        receipt: {
          ...canonicalProviderReceipt(args),
          evidenceVersion: rawEvidence,
        },
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(result.receipt.callCount).toBe(1);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.receipt)).not.toContain(rawOutput);
    expect(JSON.stringify(result.receipt)).not.toContain(rawEvidence);
  });

  it('rejects missing cost evidence before compiler repair with the exact sanitized code', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        const receipt = canonicalProviderReceipt(args);
        const { inputAccounting: _missing, ...withoutAccounting } =
          receipt;
        return {
          output: JSON.stringify({ invalid: true }),
          receipt: withoutAccounting,
        };
      }),
    };

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(result.receipt.callCount).toBe(1);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts[0]).toMatchObject({
      inputAccounting: expect.objectContaining({
        estimatedBytes: expect.any(Number),
      }),
      reservedExposureBeforeCallUsd: 4.224,
      conservativeCallCostUsd: 0.00242,
      cumulativeConservativeCostUsd: 0.00242,
      failureCode: 'provider_evidence_invalid',
    });
  });

  it.each([
    'reservedExposureBeforeCallUsd',
    'nominalEstimatedCostUsd',
    'conservativeCallCostUsd',
  ] as const)(
    'rejects forged %s before compiler repair and persists the recomputed value only',
    async (field) => {
      const { context, materialized } = buildContext('single_location');
      const provider = {
        call: vi.fn(async (args: ProductionProviderCallArgs) => ({
          output: JSON.stringify(providerDraft(materialized.fixture)),
          receipt: {
            ...canonicalProviderReceipt(args),
            [field]: 999,
          },
        })),
      };

      const result = await runProductionBlueprintAuthoring({
        request: requestFor(context, 'live'),
        context,
        provider,
      });

      expect(result.receipt.failure?.code).toBe(
        'provider_evidence_invalid',
      );
      expect(provider.call).toHaveBeenCalledTimes(1);
      expect(result.receipt.repairCount).toBe(0);
      expect(result.receipt.attempts[0]).toMatchObject({
        reservedExposureBeforeCallUsd: 4.224,
        nominalEstimatedCostUsd: 0.00208,
        conservativeCallCostUsd: 0.00242,
        cumulativeConservativeCostUsd: 0.00242,
        failureCode: 'provider_evidence_invalid',
      });
      expect(JSON.stringify(result.receipt)).not.toContain(':999');
    },
  );

  it.each([
    ['logical calls', { logicalProviderCalls: 2 }],
    ['zero dispatch', { transportDispatchCount: 0 }],
    ['multiple dispatches', { transportDispatchCount: 2 }],
    ['retry', { transportRetryCount: 1 }],
    ['fallback', { fallbackUsed: true }],
    ['route', { canonicalRouteConfirmed: false }],
    ['model', { canonicalModelConfirmed: false }],
    [
      'evidence kind',
      {
        evidenceKind: 'not_run',
        logicalProviderCalls: 0,
        transportDispatchCount: 0,
        transportRetryCount: 0,
        fallbackUsed: false,
        canonicalRouteConfirmed: false,
        canonicalModelConfirmed: false,
      },
    ],
  ] as const)(
    'rejects mutated canonical attestation axis %s without compiler repair',
    async (_label, mutation) => {
      const { context, materialized } = buildContext('single_location');
      const provider = {
        call: vi.fn(async (args: ProductionProviderCallArgs) => {
          const receipt = canonicalProviderReceipt(args);
          return {
            output: JSON.stringify(providerDraft(materialized.fixture)),
            receipt: {
              ...receipt,
              executionAttestation: {
                ...receipt.executionAttestation,
                ...mutation,
              },
            },
          };
        }),
      };

      const result = await runProductionBlueprintAuthoring({
        request: requestFor(context, 'live'),
        context,
        provider,
      });

      expect(result.receipt.failure?.code).toBe(
        'provider_evidence_invalid',
      );
      expect(provider.call).toHaveBeenCalledTimes(1);
      expect(result.receipt.repairCount).toBe(0);
    },
  );

  it.each([
    [
      'output ceiling',
      {
        input_tokens: 120,
        cached_input_tokens: 0,
        cache_write_input_tokens: 0,
        output_tokens: 48_001,
        reasoning_tokens: 20,
        total_tokens: 48_121,
      },
    ],
    [
      'total mismatch',
      {
        input_tokens: 120,
        cached_input_tokens: 0,
        cache_write_input_tokens: 0,
        output_tokens: 80,
        reasoning_tokens: 20,
        total_tokens: 201,
      },
    ],
    [
      'cache partition overflow',
      {
        input_tokens: 120,
        cached_input_tokens: 100,
        cache_write_input_tokens: 21,
        output_tokens: 80,
        reasoning_tokens: 20,
        total_tokens: 200,
      },
    ],
    [
      'reasoning overflow',
      {
        input_tokens: 120,
        cached_input_tokens: 0,
        cache_write_input_tokens: 0,
        output_tokens: 80,
        reasoning_tokens: 81,
        total_tokens: 200,
      },
    ],
  ] as const)(
    'rejects invalid usage evidence: %s',
    async (_label, usage) => {
      const { context, materialized } = buildContext('single_location');
      const provider = {
        call: vi.fn(async (args: ProductionProviderCallArgs) => ({
          output: JSON.stringify(providerDraft(materialized.fixture)),
          receipt: {
            ...canonicalProviderReceipt(args),
            usage,
          },
        })),
      };

      const result = await runProductionBlueprintAuthoring({
        request: requestFor(context, 'live'),
        context,
        provider,
      });

      expect(result.receipt.failure?.code).toBe('usage_invalid');
      expect(provider.call).toHaveBeenCalledTimes(1);
      expect(result.receipt.repairCount).toBe(0);
    },
  );

  it('preserves one observed dispatch and zero retries when transport fails', async () => {
    const { context } = buildContext('single_location');
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async (
        request: OpenAIResponsesAuthoringTransportRequest,
      ) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        throw new Error('raw transport failure must not persist');
      }),
    };
    const provider =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        transport,
        readCredential: () => 'test-key-never-persisted',
      });

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(result.receipt.executionAttestation).toEqual({
      evidenceKind: 'canonical_adapter_observed',
      logicalProviderCalls: 1,
      transportDispatchCount: 1,
      transportRetryCount: 0,
      fallbackUsed: false,
      canonicalRouteConfirmed: true,
      canonicalModelConfirmed: true,
    });
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /raw transport failure must not persist|test-key-never-persisted/i,
    );
  });

  it('preserves dispatched canonical adapter cost evidence and exact completion failure without repair', async () => {
    const { context } = buildContext('single_location');
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async (
        request: OpenAIResponsesAuthoringTransportRequest,
      ) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        return {
          id: 'response-incomplete-1',
          model: BLUEPRINT_AUTHORING_MODEL,
          status: 'incomplete',
          output_text: '{"incomplete":true}',
          usage: {
            input_tokens: 120,
            input_tokens_details: {
              cached_tokens: 0,
              cache_write_tokens: 0,
            },
            output_tokens: 80,
            output_tokens_details: { reasoning_tokens: 20 },
            total_tokens: 200,
          },
        };
      }),
    };
    const provider =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        transport,
        readCredential: () => 'test-key-never-persisted',
      });

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'completion_status_invalid',
    );
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts[0]).toMatchObject({
      usage: {
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
      },
      reservedExposureBeforeCallUsd: 4.224,
      conservativeCallCostUsd: 0.00242,
      cumulativeConservativeCostUsd: 0.00242,
      executionAttestation: {
        evidenceKind: 'canonical_adapter_observed',
        transportDispatchCount: 1,
        transportRetryCount: 0,
      },
      failureCode: 'completion_status_invalid',
    });
  });

  it('records an omitted provider model as unknown without losing dispatched usage evidence', async () => {
    const { context } = buildContext('single_location');
    const transport: OpenAIResponsesAuthoringTransport & {
      create: ReturnType<typeof vi.fn>;
    } = {
      create: vi.fn(async (
        request: OpenAIResponsesAuthoringTransportRequest,
      ) => {
        request.observations.transportDispatchStarted = true;
        request.observations.transportDispatchCount += 1;
        request.observations.canonicalRouteConfirmed = true;
        request.observations.canonicalModelConfirmed = true;
        return {
          id: 'response-model-omitted-1',
          status: 'completed',
          output_text: '{"invalid":true}',
          usage: {
            input_tokens: 120,
            input_tokens_details: {
              cached_tokens: 0,
              cache_write_tokens: 0,
            },
            output_tokens: 80,
            output_tokens_details: { reasoning_tokens: 20 },
            total_tokens: 200,
          },
        };
      }),
    };
    const provider =
      createOpenAIResponsesBlueprintAuthoringAdapter({
        transport,
        readCredential: () => 'test-key-never-persisted',
      });

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'provider_policy_mismatch',
    );
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts[0]).toMatchObject({
      provider: 'openai',
      model: 'unknown-model',
      conservativeCallCostUsd: 0.00242,
      cumulativeConservativeCostUsd: 0.00242,
      failureCode: 'provider_policy_mismatch',
    });
  });

  it('recomputes dispatched cost evidence and rejects a forged cumulative amount', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        const receipt = canonicalProviderReceipt(args);
        throw new ProductionAuthoringProviderBoundaryError(
          'completion_status_invalid',
          {
            provider: receipt.provider,
            model: receipt.model,
            responseId: receipt.responseId,
            responseDigest: 'a'.repeat(64),
            usage: receipt.usage,
            providerEvidenceVersion: receipt.evidenceVersion,
            completionStatus: 'incomplete',
            usageEvidenceComplete: true,
            executionAttestation: receipt.executionAttestation,
            inputAccounting: receipt.inputAccounting,
            reservedExposureBeforeCallUsd:
              receipt.reservedExposureBeforeCallUsd,
            nominalEstimatedCostUsd:
              receipt.nominalEstimatedCostUsd,
            conservativeCallCostUsd:
              receipt.conservativeCallCostUsd,
            cumulativeConservativeCostUsd: 999,
          },
          'completion_status_invalid',
        );
      }),
    };

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts[0]).toMatchObject({
      nominalEstimatedCostUsd: 0.00208,
      conservativeCallCostUsd: 0.00242,
      cumulativeConservativeCostUsd: 0.00242,
      failureCode: 'provider_evidence_invalid',
    });
    expect(JSON.stringify(result.receipt)).not.toContain(':999');
  });

  it('reclassifies malformed thrown-boundary attestation evidence without claiming a dispatch', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        const receipt = canonicalProviderReceipt(args);
        throw new ProductionAuthoringProviderBoundaryError(
          'completion_status_invalid',
          {
            provider: receipt.provider,
            model: receipt.model,
            responseId: receipt.responseId,
            responseDigest: 'b'.repeat(64),
            usage: receipt.usage,
            providerEvidenceVersion: receipt.evidenceVersion,
            completionStatus: 'incomplete',
            usageEvidenceComplete: true,
            executionAttestation: {
              ...receipt.executionAttestation,
              hostileExtraKey: true,
            },
            inputAccounting: receipt.inputAccounting,
            reservedExposureBeforeCallUsd:
              receipt.reservedExposureBeforeCallUsd,
            nominalEstimatedCostUsd:
              receipt.nominalEstimatedCostUsd,
            conservativeCallCostUsd:
              receipt.conservativeCallCostUsd,
            cumulativeConservativeCostUsd:
              receipt.conservativeCallCostUsd,
          },
          'completion_status_invalid',
        );
      }),
    };

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts[0]?.executionAttestation.evidenceKind).toBe(
      'not_run',
    );
    expect(result.receipt.executionAttestation.evidenceKind).toBe('not_run');
    expect(JSON.stringify(result.receipt)).not.toContain(
      'hostileExtraKey',
    );
  });

  it('does not credit an omitted boundary model as the requested canonical model', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        const receipt = canonicalProviderReceipt(args);
        throw new ProductionAuthoringProviderBoundaryError(
          'completion_status_invalid',
          {
            provider: receipt.provider,
            responseId: receipt.responseId,
            responseDigest: 'c'.repeat(64),
            usage: receipt.usage,
            providerEvidenceVersion: receipt.evidenceVersion,
            completionStatus: 'incomplete',
            usageEvidenceComplete: true,
            executionAttestation: receipt.executionAttestation,
            inputAccounting: receipt.inputAccounting,
            reservedExposureBeforeCallUsd:
              receipt.reservedExposureBeforeCallUsd,
            nominalEstimatedCostUsd:
              receipt.nominalEstimatedCostUsd,
            conservativeCallCostUsd:
              receipt.conservativeCallCostUsd,
            cumulativeConservativeCostUsd:
              receipt.conservativeCallCostUsd,
          },
          'completion_status_invalid',
        );
      }),
    };

    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe(
      'provider_evidence_invalid',
    );
    expect(result.receipt.attempts[0]?.model).toBe('unknown-model');
    expect(provider.call).toHaveBeenCalledTimes(1);
  });

  it('preserves bounded deterministic validation evidence when all repairs are exhausted', async () => {
    const { context } = buildContext('single_location');
    const rawDraftSentinel = 'raw-draft-must-not-persist';
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => ({
        output: JSON.stringify({
          rawDraftSentinel,
          attempt: args.attempt,
        }),
        receipt: canonicalProviderReceipt(args),
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'draft_validation_repair_exhausted',
    );
    expect(result.receipt.failure).toMatchObject({
      phase: 'draft_validation',
      errorClass: 'draft_validation_budget_exhausted',
      repairEligibility: 'budget_exhausted',
      repairReasonCode:
        'draft_validation_budget_consumed',
    });
    expect(result.receipt.callCount).toBe(3);
    expect(result.receipt.repairCount).toBe(2);
    expect(provider.call).toHaveBeenCalledTimes(3);
    expect(result.receipt.attempts).toHaveLength(3);
    for (const attempt of result.receipt.attempts) {
      expect(
        attempt.validationDiagnostics.count,
      ).toBeGreaterThan(0);
      expect(attempt.failureCode).toBeNull();
    }
    const serialized = JSON.stringify(result.receipt);
    expect(serialized).not.toContain(rawDraftSentinel);
    expect(serialized).not.toMatch(
      /systemPrompt["']|userPrompt["']|responseBody|credential|apiKey|Bearer/i,
    );
    expect(serialized).not.toContain('"draft"');
    expect(serialized).not.toContain('"output"');
  });

  it('records repair input ineligibility after one provider call without dispatching a repair', async () => {
    const { context, materialized } = buildContext('single_location');
    const oversizedInvalid = structuredClone(
      providerDraft(materialized.fixture),
    ) as {
      frames: Array<{
        narrative: { summary: string };
        camera: unknown;
      }>;
    };
    oversizedInvalid.frames[0]!.narrative.summary = 'x'.repeat(70_000);
    oversizedInvalid.frames[1]!.camera = null;
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => ({
        output: JSON.stringify(oversizedInvalid),
        receipt: canonicalProviderReceipt(args),
      })),
    };

    const request = requestFor(context, 'live');
    const result = await runProductionBlueprintAuthoring({
      request,
      context,
      provider,
    });

    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'repair_route_input_not_admissible',
    );
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.repairCount).toBe(0);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result.receipt.attempts).toHaveLength(1);
    expect(
      result.receipt.attempts[0]!.validationDiagnostics.count,
    ).toBeGreaterThan(0);
    expect(result.receipt.attempts[0]!.failureCode).toBeNull();
    const serialized = JSON.stringify(result.receipt);
    expect(serialized).not.toContain('x'.repeat(256));
    expect(serialized).not.toMatch(
      /systemPrompt["']|userPrompt["']|responseBody|credential|apiKey|Bearer/i,
    );
    expect(serialized).not.toContain('"draft"');
    expect(serialized).not.toContain('"output"');
    expect(
      productionBlueprintAuthoringReceiptReplayIsValid({
        receipt: result.receipt as unknown as Record<string, unknown>,
        request,
        expectedStatus: 'failed',
        expectedDigest: result.receipt.digest,
      }),
    ).toBe(true);
  });

  it('keeps legacy request and receipt versions immutable after the canonical cutover', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('provider must remain unreachable');
      }),
    };
    expect(
      productionAuthoringRequestVersionStatus(
        'production-blueprint-authoring-request/v3',
      ),
    ).toBe('legacy_immutable');
    expect(
      productionAuthoringReceiptVersionStatus(
        'production-blueprint-authoring-receipt/v4',
      ),
    ).toBe('legacy_immutable');
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('fails unexpected local request processing closed and retains prior receipts as immutable legacy evidence', async () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const rawError = 'raw-blueprint-local-error-must-not-persist';
    const hostileRequest = new Proxy(request, {
      get(target, property, receiver) {
        if (property === 'version') throw new Error(rawError);
        return Reflect.get(target, property, receiver);
      },
    });
    const provider = {
      call: vi.fn(async () => {
        throw new Error('provider must remain unreachable');
      }),
    };

    const result = await runProductionBlueprintAuthoring({
      request: hostileRequest,
      context,
      provider,
    });

    expect(result.receipt).toMatchObject({
      version: PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      status: 'failed',
      callCount: 0,
      repairCount: 0,
      failure: {
        code: 'local_processing_failed',
        phase: 'local_processing',
        errorClass: 'unexpected_local_failure',
        repairEligibility: 'ineligible',
      },
    });
    expect(provider.call).not.toHaveBeenCalled();
    expect(JSON.stringify(result.receipt)).not.toContain(rawError);
    expect(
      productionAuthoringReceiptVersionStatus(
        PRODUCTION_AUTHORING_RUN_RECEIPT_VERSION,
      ),
    ).toBe('current');
    expect(
      productionAuthoringReceiptVersionStatus(
        'production-blueprint-authoring-receipt/v3',
      ),
    ).toBe('legacy_immutable');
    expect(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'lib/visual-package/productionAuthoringRunner.ts',
        ),
        'utf8',
      ),
    ).not.toContain("'validation_exhausted'");
  });

  it('rejects mutated context and live mode without an adapter before any call', async () => {
    const { context } = buildContext('single_location');
    const stale = structuredClone(context);
    stale.sourceSnapshot.rawDigest = '0'.repeat(64);
    await expect(
      runProductionBlueprintAuthoring({
        request: requestFor(context, 'preflight'),
        context: stale,
      }),
    ).rejects.toThrow(/context digest is stale/);

    const staleCoverage = structuredClone(context);
    staleCoverage.reconciliation.content
      .actionSemanticCoverageAuthority.records[0]!.sourcePhrase =
        'mutated self-declared coverage';
    staleCoverage.validationContext.reconciliation =
      staleCoverage.reconciliation.content;
    staleCoverage.validationContext.actionSemanticCoverage =
      structuredClone(
        staleCoverage.reconciliation.content
          .actionSemanticCoverageAuthority.records,
      );
    await expect(
      runProductionBlueprintAuthoring({
        request: requestFor(context, 'preflight'),
        context: staleCoverage,
      }),
    ).rejects.toThrow(/reconciliation content is stale/);

    await expect(
      runProductionBlueprintAuthoring({
        request: requestFor(context, 'live'),
        context,
      }),
    ).rejects.toThrow(/requires an explicitly injected provider adapter/);
  });
});

describe('production authoring run result totality + capture disposition', () => {
  it('returns a preflight arm with no authoring result and no failure disposition', async () => {
    const { context } = buildContext('single_location');
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'preflight'),
      context,
      provider: { call: vi.fn() },
    });
    expect(result.receipt.status).toBe('preflight_passed');
    expect(productionAuthoringRunResultIsCompleted(result)).toBe(false);
    expect(productionAuthoringRunResultIsFailed(result)).toBe(false);
    expect(result.authoringResult).toBeNull();
    // The failed-only field is absent on a preflight arm (total union — no default).
    expect('sanitizedFailureCaptureDisposition' in result).toBe(false);
  });

  it('returns a completed arm with an authoring result and no failure disposition', async () => {
    const { context, materialized } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => ({
        output: JSON.stringify(providerDraft(materialized.fixture)),
        receipt: canonicalProviderReceipt(args),
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(productionAuthoringRunResultIsCompleted(result)).toBe(true);
    if (!productionAuthoringRunResultIsCompleted(result)) return;
    expect(result.authoringResult).not.toBeNull();
    expect('sanitizedFailureCaptureDisposition' in result).toBe(false);
  });

  it('a first-call provider failure with no prior diagnostics is an explicit allowed absence', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('Bearer first-call-secret provider failure');
      }),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(productionAuthoringRunResultIsFailed(result)).toBe(true);
    if (!productionAuthoringRunResultIsFailed(result)) return;
    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(result.receipt.attempts[0]?.validationDiagnostics.count).toBe(0);
    // Not required (no mandatory code, no attempt diagnostics) => explicit absence.
    expect(blueprintAuthoringReceiptRequiresSanitizedCapture(result.receipt)).toBe(
      false,
    );
    expect(result.sanitizedFailureCaptureDisposition).toEqual({
      kind: 'diagnostic_less_absence',
    });
  });

  it('a repair-time provider failure with prior grouped diagnostics binds a complete valid capture', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        if (args.attempt === 1) {
          // A canonical, self-consistent provider response carrying an INVALID draft:
          // validation fails, producing grouped validation diagnostics on attempt 1.
          return {
            output: JSON.stringify({ invalid: true }),
            receipt: canonicalProviderReceipt(args),
          };
        }
        // The repair call then fails at the provider boundary.
        throw new Error('Bearer repair-secret provider failure');
      }),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(productionAuthoringRunResultIsFailed(result)).toBe(true);
    if (!productionAuthoringRunResultIsFailed(result)) return;
    // Terminal code is the non-mandatory provider_call_failed, yet the receipt is
    // diagnostic-BEARING (attempt 1 carried grouped validation diagnostics), so a
    // capture is REQUIRED and derived from receipt evidence — not the code alone.
    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(
      result.receipt.attempts[0]?.validationDiagnostics.count,
    ).toBeGreaterThan(0);
    expect(blueprintAuthoringReceiptRequiresSanitizedCapture(result.receipt)).toBe(
      true,
    );
    const disposition = result.sanitizedFailureCaptureDisposition;
    expect(disposition.kind).toBe('captured');
    if (disposition.kind !== 'captured') return;
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(disposition.capture)).toBe(
      true,
    );
    expect(disposition.capture.census.distinctIdentities).toBeGreaterThan(0);
    expect(disposition.capture.census.truncated).toBe(false);
    expect(disposition.capture.linkage.terminalReceiptDigest).toBe(
      result.receipt.digest,
    );
    expect(disposition.capture.terminalFailureCode).toBe('provider_call_failed');
    // No raw provider prose survives into the capture.
    expect(JSON.stringify(disposition.capture)).not.toMatch(
      /repair-secret|Bearer/i,
    );
  });

  it('fails closed to derivation_failed when a diagnostic-bearing receipt has no correlatable in-memory census source', async () => {
    // Reuse a genuinely diagnostic-bearing failed receipt, but hand the derivation an
    // error that carries NO matching structured diagnostics. The census cannot be
    // proven complete, so the derivation refuses to mint a partial one.
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async (args: ProductionProviderCallArgs) => {
        if (args.attempt === 1) {
          return {
            output: JSON.stringify({ invalid: true }),
            receipt: canonicalProviderReceipt(args),
          };
        }
        throw new Error('Bearer repair-secret provider failure');
      }),
    };
    const request = requestFor(context, 'live');
    const result = await runProductionBlueprintAuthoring({
      request,
      context,
      provider,
    });
    if (!productionAuthoringRunResultIsFailed(result)) {
      throw new Error('expected a failed run');
    }
    expect(blueprintAuthoringReceiptRequiresSanitizedCapture(result.receipt)).toBe(
      true,
    );
    const disposition = deriveBlueprintAuthoringSanitizedFailureCaptureDisposition({
      request,
      context,
      attempts: result.receipt.attempts,
      // A plain error is NOT a structured repair/exhaustion error: no diagnostics.
      error: new Error('unstructured failure'),
      failureReceipt: result.receipt,
      failureCode: 'provider_call_failed',
    });
    expect(disposition).toEqual({
      kind: 'derivation_failed',
      reasonCode: 'sanitized_census_correlation_unproven',
    });
  });
});

describe('sanitized census bijection is proven by IDENTITY, not attempt presence', () => {
  // Two structurally distinct diagnostics -> two census identities. Errors are derived
  // from the SAME canonical projection the compiler uses, so these are genuinely
  // identity-correlated evidence (the counterexamples below deliberately break that).
  const DIAG_ONE: PreRenderBlueprintRepairDiagnostic = {
    code: 'draft_assembly_failed',
    message: 'alpha',
  };
  const DIAG_TWO: PreRenderBlueprintRepairDiagnostic = {
    code: 'draft_assembly_failed',
    message: 'beta',
    // A retained (closed-vocabulary) field path makes this a DISTINCT sanitized identity
    // from DIAG_ONE, whose message alone is never retained.
    field: 'frames',
  };
  const CORRELATED = [DIAG_ONE, DIAG_TWO];
  const CORRELATED_ERRORS = CORRELATED.map(
    preRenderBlueprintRepairDiagnosticErrorText,
  );

  // The exact source/logic the runner uses to persist an attempt's validation summary.
  function persistedSummary(errors: string[]): {
    count: number;
    codes: AuthoringDiagnosticCode[];
  } {
    return sanitizedAuthoringDiagnostics({
      inputs: errors,
      fallbackCode: 'draft_contract_validation_failed',
    });
  }

  function receiptAttempt(
    attempt: number,
    validationDiagnostics: { count: number; codes: AuthoringDiagnosticCode[] },
  ): ProductionAuthoringAttemptReceipt {
    return {
      attempt,
      kind: attempt === 1 ? 'initial' : 'repair',
      completionStatus: null,
      usage: null,
      validationDiagnostics,
    } as unknown as ProductionAuthoringAttemptReceipt;
  }

  // A genuinely identity-correlated source attempt: its error strings ARE the canonical
  // projections of its structured diagnostics.
  function correlatedSourceAttempt(
    attempt: number,
    diagnostics: PreRenderBlueprintRepairDiagnostic[],
  ) {
    return {
      attempt,
      errors: diagnostics.map(preRenderBlueprintRepairDiagnosticErrorText),
      draft: null,
      diagnostics,
    };
  }

  function deriveWith(args: {
    context: ProductionAuthoringContext;
    request: ProductionAuthoringRunRequest;
    attempts: ProductionAuthoringAttemptReceipt[];
    error: unknown;
    // Optional distinct receipt-side attempt list to prove args.attempts must be
    // canonically identical to failureReceipt.attempts.
    failureReceiptAttempts?: ProductionAuthoringAttemptReceipt[];
  }) {
    const failureReceipt = {
      digest: canonicalJsonDigest({ receipt: 'terminal' }),
      requestDigest: canonicalJsonDigest({ request: 'terminal' }),
      failure: { code: 'draft_validation_repair_exhausted' as const },
      attempts: args.failureReceiptAttempts ?? args.attempts,
    } as unknown as Parameters<
      typeof deriveBlueprintAuthoringSanitizedFailureCaptureDisposition
    >[0]['failureReceipt'];
    return deriveBlueprintAuthoringSanitizedFailureCaptureDisposition({
      request: args.request,
      context: args.context,
      attempts: args.attempts,
      error: args.error,
      failureReceipt,
      failureCode: 'draft_validation_repair_exhausted',
    });
  }

  const UNPROVEN = {
    kind: 'derivation_failed',
    reasonCode: 'sanitized_census_correlation_unproven',
  } as const;

  it('mints a complete capture on the true valid identity-correlated shape', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
      ]),
    });
    expect(disposition.kind).toBe('captured');
    if (disposition.kind !== 'captured') return;
    expect(blueprintAuthoringSanitizedFailureCaptureIsValid(disposition.capture)).toBe(
      true,
    );
    // Every raw diagnostic is accounted for: two distinct identities, two emissions.
    expect(disposition.capture.census.distinctIdentities).toBe(2);
    expect(disposition.capture.census.totalEmitted).toBe(2);
  });

  it('rejects same count/codes/cardinality but UNRELATED diagnostic identities', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // Persisted summary re-derives exactly from the errors, and cardinality matches (2==2),
    // but the structured diagnostics project to DIFFERENT strings than the persisted
    // errors -> they are not the same evidence identities.
    const unrelated: PreRenderBlueprintRepairDiagnostic[] = [
      { code: 'draft_assembly_failed', message: 'gamma' },
      { code: 'draft_assembly_failed', message: 'delta', field: 'frames' },
    ];
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        { attempt: 1, errors: CORRELATED_ERRORS, draft: null, diagnostics: unrelated },
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects a receipt count that overstates the in-memory error source', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // Receipt claims count 2, but the in-memory attempt carries only 1 error/diagnostic
    // -> re-derived count 1 != persisted 2.
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, [DIAG_ONE]),
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects a code set the in-memory error source does not reproduce', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // Same count (2), but the in-memory errors re-derive to a different code set (a
    // JSON/decode-shaped error -> draft_schema_validation_failed).
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, { count: 2, codes: ['draft_contract_validation_failed'] })],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        {
          attempt: 1,
          errors: ['json decode broke', 'json parse broke'],
          draft: null,
          diagnostics: [DIAG_ONE, DIAG_TWO],
        },
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects a partial structured source (fewer diagnostics than raw errors)', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // {count,codes} re-derive exactly, but only 1 structured diagnostic for 2 raw errors.
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        { attempt: 1, errors: CORRELATED_ERRORS, draft: null, diagnostics: [DIAG_ONE] },
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects a duplicated SOURCE attempt number', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const disposition = deriveWith({
      context,
      request,
      // Two receipt attempts so the duplicate source number is in-range (1..2).
      attempts: [
        receiptAttempt(1, persistedSummary(CORRELATED_ERRORS)),
        receiptAttempt(2, { count: 0, codes: [] }),
      ],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
        correlatedSourceAttempt(1, [DIAG_ONE]),
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects a duplicated RECEIPT attempt number (non-sequential)', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const disposition = deriveWith({
      context,
      request,
      // Two receipt attempts both numbered 1 -> not a clean 1..N sequence.
      attempts: [
        receiptAttempt(1, persistedSummary(CORRELATED_ERRORS)),
        receiptAttempt(1, { count: 0, codes: [] }),
      ],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects an invalid / non-integer / out-of-range SOURCE attempt number', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
        // A non-integer source attempt number is rejected, never silently skipped.
        { attempt: 1.5, errors: ['x'], draft: null, diagnostics: [DIAG_ONE] },
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects args.attempts that differ from the content-addressed failureReceipt.attempts', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    const disposition = deriveWith({
      context,
      request,
      attempts: [receiptAttempt(1, persistedSummary(CORRELATED_ERRORS))],
      // The content-addressed receipt commits to a DIFFERENT attempt list.
      failureReceiptAttempts: [
        receiptAttempt(1, persistedSummary(CORRELATED_ERRORS)),
        receiptAttempt(2, { count: 0, codes: [] }),
      ],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('rejects extra structured evidence not reflected by any diagnostic-bearing attempt', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // Receipt marks only attempt 1 diagnostic-bearing; attempt 2 is not. The error,
    // however, carries structured diagnostics for attempt 2 too -> non-bijective.
    const disposition = deriveWith({
      context,
      request,
      attempts: [
        receiptAttempt(1, persistedSummary(CORRELATED_ERRORS)),
        receiptAttempt(2, { count: 0, codes: [] }),
      ],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
        correlatedSourceAttempt(2, [DIAG_ONE]),
      ]),
    });
    expect(disposition).toEqual(UNPROVEN);
  });

  it('preserves the real repair-time provider_call_failed path (attempt 1 diagnostics, attempt 2 none)', () => {
    const { context } = buildContext('single_location');
    const request = requestFor(context, 'live');
    // Attempt 1 carried grouped validation diagnostics; the later provider failure (attempt
    // 2) carries none. The bijection holds over attempt 1 only, so a capture is minted.
    const disposition = deriveWith({
      context,
      request,
      attempts: [
        receiptAttempt(1, persistedSummary(CORRELATED_ERRORS)),
        receiptAttempt(2, { count: 0, codes: [] }),
      ],
      error: new PreRenderBlueprintAuthoringRepairExhaustedError([
        correlatedSourceAttempt(1, CORRELATED),
        { attempt: 2, errors: ['repair call failed: boom'], draft: null },
      ]),
    });
    expect(disposition.kind).toBe('captured');
    if (disposition.kind !== 'captured') return;
    expect(disposition.capture.census.totalEmitted).toBe(2);
  });
});
