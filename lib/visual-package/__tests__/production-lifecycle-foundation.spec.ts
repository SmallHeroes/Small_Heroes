import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  auditProductionStoryReadiness,
  buildProductionAuthoringContext,
  buildProductionReconciliationDraftBundle,
  buildReconciliationReviewBundle,
  canonicalJsonDigest,
  loadProductionStyleAuthority,
  persistProductionAuthoringReceipt,
  persistReconciliationDraftBundle,
  runProductionBlueprintAuthoring,
  type ProductionAuthoringContext,
  type ProductionAuthoringRunRequest,
} from '@/lib/visual-package';

import {
  buildBlueprintFixture,
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
  fixture: ReturnType<typeof buildBlueprintFixture>;
} {
  const repoRoot = tempRoot();
  const fixture = buildBlueprintFixture(shape, options);
  const storyKey = fixture.blueprint.identity.storyKey;
  const storyPath = fixture.context.source.path;
  const templatePath = fixture.context.templateIdentity.artifactPath;
  const reconciliationPath = fixture.context.reconciliationArtifactPath;
  writeText(repoRoot, storyPath, fixture.context.rawStorySource);
  writeJson(repoRoot, templatePath, fixture.context.template);
  writeJson(repoRoot, reconciliationPath, fixture.context.reconciliation);
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
    styleId: STYLE_ID,
    styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  });
  return { context, materialized };
}

function requestFor(
  context: ProductionAuthoringContext,
  mode: 'preflight' | 'live',
  maxCalls = 3,
): ProductionAuthoringRunRequest {
  return {
    version: PRODUCTION_AUTHORING_RUN_REQUEST_VERSION,
    mode,
    requestId: `request-${mode}`,
    requestedAt: '2026-07-27T12:00:00.000Z',
    contextDigest: context.digest,
    model: 'injected-production-model',
    reasoningEffort: 'high',
    maxOutputTokens: 48_000,
    noFallback: true,
    callBudget: {
      maxCalls,
      maxRepairCount: maxCalls - 1,
    },
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
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
        throughStage: 'blueprint_authoring',
      });
      expect(audit.ready, JSON.stringify(audit.reasons, null, 2)).toBe(true);
      expect(audit.reasons).toEqual([]);
    });
  }

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
                  spatialNodes: zone.spatialNodes!.map((node) => ({
                    id: node.id,
                    kind: node.kind,
                    description: `stable physical ${node.kind}`,
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

  it('records only strict receipt metadata and sanitized usage through an injected live adapter', async () => {
    const { context, materialized } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => ({
        output: providerDraft(materialized.fixture),
        receipt: {
          provider: 'injected-test-provider',
          model: 'injected-production-model',
          responseId: 'response-1',
          usage: {
            input_tokens: 120,
            output_tokens: 80,
            total_tokens: 200,
            secret_debug_payload: 'must-not-persist',
          },
        },
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });
    expect(result.receipt.status).toBe('completed');
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.repairCount).toBe(0);
    expect(result.receipt.attempts[0]?.usage).toEqual({
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
    });
    expect(result.receipt.attempts[0]?.responseDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.authoringResult?.blueprint.digest).toBe(
      result.receipt.blueprintDigest,
    );
    expect(JSON.stringify(result.receipt)).not.toContain(
      'secret_debug_payload',
    );
  });

  it('enforces exact call budget with no fallback and never persists raw provider failures', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('Bearer secret-token provider failure');
      }),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live', 1),
      context,
      provider,
    });
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.failure?.code).toBe('provider_call_failed');
    expect(JSON.stringify(result.receipt)).not.toContain('secret-token');
    expect(result.receipt.attempts[0]?.validationErrors).toEqual([]);
    expect(provider.call).toHaveBeenCalledTimes(1);
  });

  it('preserves bounded deterministic validation evidence when all repairs are exhausted', async () => {
    const { context } = buildContext('single_location');
    const rawDraftSentinel = 'raw-draft-must-not-persist';
    const provider = {
      call: vi.fn(async ({ attempt }: { attempt: number }) => ({
        output: {
          rawDraftSentinel,
          attempt,
        },
        receipt: {
          provider: 'injected-test-provider',
          model: 'injected-production-model',
          responseId: `response-${attempt}`,
        },
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live'),
      context,
      provider,
    });

    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe('validation_exhausted');
    expect(result.receipt.callCount).toBe(3);
    expect(result.receipt.repairCount).toBe(2);
    expect(provider.call).toHaveBeenCalledTimes(3);
    expect(result.receipt.attempts).toHaveLength(3);
    for (const attempt of result.receipt.attempts) {
      expect(attempt.validationErrors.length).toBeGreaterThan(0);
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

  it('keeps call-budget exhaustion redacted without copying compiler-wrapped failure text', async () => {
    const { context } = buildContext('single_location');
    const provider = {
      call: vi.fn(async () => ({
        output: { invalidDraft: 'call-budget-secret-sentinel' },
        receipt: {
          provider: 'injected-test-provider',
          model: 'injected-production-model',
        },
      })),
    };
    const result = await runProductionBlueprintAuthoring({
      request: requestFor(context, 'live', 1),
      context,
      provider,
    });

    expect(result.receipt.failure?.code).toBe('call_budget_exhausted');
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.repairCount).toBe(0);
    expect(result.receipt.attempts[0]?.validationErrors).toEqual([]);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /call-budget-secret-sentinel|authoring call budget exhausted|repair call failed/i,
    );
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
    await expect(
      runProductionBlueprintAuthoring({
        request: requestFor(context, 'live'),
        context,
      }),
    ).rejects.toThrow(/requires an explicitly injected provider adapter/);
  });
});
