import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  compileBookVisualContractTemplate,
  TemplateRepairExhaustedError,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import {
  ActionSemanticCapabilityGapError,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import {
  projectPageMustShow,
} from '@/lib/visual-contract-compiler/projectContractProse';
import type {
  BookVisualContract,
  PageVisualContract,
} from '@/lib/visual-contract-compiler/types';
import type {
  BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import {
  buildStorySourceAuthoritySnapshot,
  buildProductionReconciliationDraftFromSourceSnapshot,
  buildCanonicalImportPreflightAttestation,
  buildVisualContractAuthoringReadinessEvidence,
  buildVisualContractAuthoringRequest,
  authoringReservedExposureUsd,
  authoringSpendIsWithinCeiling,
  canonicalJsonDigest,
  conservativeAuthoringCostUsd,
  nominalAuthoringUsageCostUsd,
  persistStorySourceAuthoritySnapshot,
  persistReconciliationDraftBundle,
  persistVisualContractAuthoringReadiness,
  persistVisualContractAuthoringReceipt,
  persistVisualContractAuthoringRequest,
  persistVisualContractCandidate,
  runVisualContractAuthoring,
  sourcePromptReconciliationIssues,
  visualContractAuthoringArtifactVersionStatus,
  type StorySourceAuthoritySnapshot,
  type VisualContractAuthoringProvider,
} from '@/lib/visual-package';

const tempRoots: string[] = [];
const REQUESTED_AT = '2026-07-27T12:00:00.000Z';
const BANK = path.join(
  process.cwd(),
  'story-bank',
  'v3-approved',
);

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'source-authority-'),
  );
  tempRoots.push(root);
  return root;
}

function storyMarkdown(args: {
  pageCount: number;
  companion?: boolean;
  multiLocation?: boolean;
  revealGatedProp?: boolean;
  imageDirectionSuffix?: string;
}): string {
  const pages = Array.from(
    { length: args.pageCount },
    (_, index) => {
      const page = index + 1;
      const location =
        args.multiLocation && page > args.pageCount / 2
          ? 'the garden'
          : 'the reading room';
      const prop =
        args.revealGatedProp && page === args.pageCount
          ? ' The child opens the covered box and points at the silver key for the first time.'
          : ' The child looks at the paper map and holds it carefully.';
      return [
        `--- Page ${page} ---`,
        `In ${location}, the child takes a slow breath, notices the light, and chooses one clear next step.${prop}`,
        '',
        `imageDirection: A calm composition in ${location}, with the map visible.${args.imageDirectionSuffix ?? ''}`,
      ].join('\n');
    },
  ).join('\n\n');
  return [
    '---',
    'title: "General source fixture"',
    ...(args.companion
      ? ['companionId: bunny_ometz']
      : []),
    'gender: female',
    `pages: ${args.pageCount}`,
    '---',
    '',
    pages,
    '',
  ].join('\n');
}

function writeStoryFixture(args: {
  pageCount?: number;
  companion?: boolean;
  multiLocation?: boolean;
  revealGatedProp?: boolean;
  cover?: boolean;
}): {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
} {
  const repoRoot = tempRoot();
  const storyKey = `fixture_${args.pageCount ?? 3}_${args.companion ? 'with' : 'without'}_companion`;
  const storyPath = `stories/${storyKey}.md`;
  const absolute = path.join(repoRoot, storyPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(
    absolute,
    storyMarkdown({
      pageCount: args.pageCount ?? 3,
      companion: args.companion,
      multiLocation: args.multiLocation,
      revealGatedProp: args.revealGatedProp,
    }),
    'utf8',
  );
  if (args.cover) {
    fs.writeFileSync(
      absolute.replace(/\.md$/, '.location-bible.json'),
      `${JSON.stringify(
        {
          allowedZones: [{ id: 'reading_room_window' }],
          pagePlans: [
            {
              page: 0,
              zoneId: 'reading_room_window',
              visibleAnchors: ['wide window', 'paper map'],
              forbiddenDrift: ['no hidden key on cover'],
              visualSpoilerPolicy: {
                hiddenObjects: ['silver_key'],
              },
              pageAction: 'the child looks at the paper map',
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
  return { repoRoot, storyKey, storyPath };
}

function snapshotFor(
  fixture: ReturnType<typeof writeStoryFixture>,
): StorySourceAuthoritySnapshot {
  return buildStorySourceAuthoritySnapshot(fixture);
}

function requestFor(
  snapshot: StorySourceAuthoritySnapshot,
  mode: 'preflight' | 'live',
) {
  return buildVisualContractAuthoringRequest({
    snapshot,
    mode,
    requestId: `request-${mode}`,
    requestedAt: REQUESTED_AT,
  });
}

function bunnySnapshot(): StorySourceAuthoritySnapshot {
  return storySnapshot('bunny_ometz_adventure');
}

function storySnapshot(storyKey: string): StorySourceAuthoritySnapshot {
  const repoRoot = tempRoot();
  const storyPath = `stories/${storyKey}.md`;
  const destination = path.join(repoRoot, storyPath);
  fs.mkdirSync(path.dirname(destination), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(BANK, `${storyKey}.md`),
    destination,
  );
  return buildStorySourceAuthoritySnapshot({
    repoRoot,
    storyKey,
    storyPath,
  });
}

function actionCapabilityCalibrationDraft(
  snapshot: StorySourceAuthoritySnapshot,
): BookVisualContractTemplate & Record<string, unknown> {
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(
        BANK,
        'fox_uri_adventure.visual-contract-template.json',
      ),
      'utf8',
    ),
  ) as BookVisualContractTemplate & Record<string, unknown>;
  const evidence = (pageNumber: number, needle: string) => {
    const entry =
      snapshot.content.sourceEvidenceCatalog.entries.find(
        (candidate) =>
          candidate.pageNumber === pageNumber &&
          candidate.excerpt.includes(needle),
      );
    if (!entry) {
      throw new Error(`missing calibration evidence on page ${pageNumber}`);
    }
    return entry;
  };

  for (const [pageIndex, page] of draft.pageContracts.entries()) {
    const pageRecord = page as unknown as Record<string, unknown>;
    const firstEvidence =
      snapshot.content.sourceEvidenceCatalog.entries.find(
        (candidate) => candidate.pageNumber === page.pageNumber,
      );
    if (!firstEvidence) throw new Error(`missing page ${page.pageNumber}`);
    const existingActions = Array.isArray(page.actionRequirements)
      ? page.actionRequirements
      : [];
    pageRecord.actionSemanticCoverage =
      existingActions.length > 0
        ? existingActions.map((action, index) => ({
            beatId: `beat:p${page.pageNumber}:existing_${index + 1}`,
            sourceEvidenceId: firstEvidence.sourceEvidenceId,
            disposition: {
              kind: 'action_requirement',
              checkId: action.checkId,
            },
          }))
        : [
            {
              beatId: `beat:p${page.pageNumber}:structured_context`,
              sourceEvidenceId: firstEvidence.sourceEvidenceId,
              disposition: {
                kind: 'represented_elsewhere',
                contractPointer: `/pageContracts/${pageIndex}/locationId`,
                contractValue: page.locationId,
              },
            },
          ];
  }

  const sneeze = evidence(6, 'התעטש');
  const touch = evidence(7, 'טיפה קרירה נגעה');
  const move = evidence(9, 'הזיז');
  const cases = [
    {
      pageNumber: 6,
      beatId: 'beat:p6:intransitive_action',
      evidence: sneeze,
      action: {
        checkId: 'action:intransitive_action',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'companion:fox_uri' },
        },
        predicate: 'sneezes',
        object: null,
        spatialEffect: null,
        polarity: 'must',
        laterality: null,
      },
    },
    {
      pageNumber: 7,
      beatId: 'beat:p7:phenomenon_contact',
      evidence: touch,
      action: {
        checkId: 'action:phenomenon_contact',
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId: touch.sourceEvidenceId,
        },
        predicate: 'touches',
        object: { kind: 'cast', id: 'child:hero' },
        spatialEffect: null,
        polarity: 'must',
        laterality: null,
      },
    },
    {
      pageNumber: 9,
      beatId: 'beat:p9:object_movement',
      evidence: move,
      action: {
        checkId: 'action:object_movement',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'moves',
        object: { kind: 'prop', id: 'prop_tin_bucket' },
        spatialEffect: {
          kind: 'directional',
          direction: 'sideways',
        },
        polarity: 'must',
        laterality: null,
      },
    },
  ] as const;

  for (const semanticCase of cases) {
    const page = draft.pageContracts.find(
      (candidate) => candidate.pageNumber === semanticCase.pageNumber,
    )!;
    const pageRecord = page as unknown as Record<string, unknown>;
    pageRecord.actionRequirements = [
      structuredClone(semanticCase.action),
    ];
    pageRecord.actionSemanticCoverage = [
      {
        beatId: semanticCase.beatId,
        sourceEvidenceId: semanticCase.evidence.sourceEvidenceId,
        disposition: {
          kind: 'action_requirement',
          checkId: semanticCase.action.checkId,
        },
      },
    ];
    const projectionAction = structuredClone(
      semanticCase.action,
    ) as Record<string, unknown>;
    const projectionSubject = projectionAction.subject as Record<
      string,
      unknown
    >;
    if (projectionSubject.kind === 'source_phenomenon') {
      projectionSubject.sourcePhrase =
        semanticCase.evidence.excerpt;
    }
    const projectionPage = {
      ...page,
      actionRequirements: [projectionAction],
    } as unknown as PageVisualContract;
    page.mustShow = [
      ...new Set([
        ...page.mustShow,
        ...projectPageMustShow(
          projectionPage,
          draft as unknown as BookVisualContract,
        ),
      ]),
    ];
  }
  return draft;
}

function fullyActionedBunnyDraft(
  snapshot: StorySourceAuthoritySnapshot,
): BookVisualContractTemplate & Record<string, unknown> {
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(
        BANK,
        'bunny_ometz_adventure.visual-contract-template.json',
      ),
      'utf8',
    ),
  ) as BookVisualContractTemplate & Record<string, unknown>;
  for (const page of draft.pageContracts) {
    const sourceEvidence =
      snapshot.content.sourceEvidenceCatalog.entries.find(
        (candidate) =>
          candidate.pageNumber === page.pageNumber,
      );
    if (!sourceEvidence) {
      throw new Error(
        `missing Source Evidence Catalog entry for page ${page.pageNumber}`,
      );
    }
    const action = {
      checkId: `action:p${page.pageNumber}_look`,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'looks_at' as const,
      object: null,
      polarity: 'must' as const,
      laterality: null,
    };
    (
      page as unknown as Record<string, unknown>
    ).actionRequirements = [action];
    (
      page as unknown as Record<string, unknown>
    ).actionSemanticCoverage = [
      {
        beatId: `beat:p${page.pageNumber}:look`,
        sourceEvidenceId: sourceEvidence.sourceEvidenceId,
        disposition: {
          kind: 'action_requirement',
          checkId: action.checkId,
        },
      },
    ];
  }
  for (const page of draft.pageContracts) {
    const projected = projectPageMustShow(
      page,
      draft as unknown as BookVisualContract,
    );
    page.mustShow = [
      ...new Set([...page.mustShow, ...projected]),
    ];
  }
  return draft;
}

function successfulProvider(
  draft: unknown,
  overrides: Partial<{
    provider: string;
    model: string;
    usage: Record<string, unknown> | null;
  }> = {},
): VisualContractAuthoringProvider {
  return {
    call: vi.fn(async () => ({
      output: JSON.stringify(draft),
      receipt: {
        provider: overrides.provider ?? 'openai',
        model: overrides.model ?? 'gpt-5.6-sol',
        responseId: 'response-1',
        usage:
          overrides.usage === undefined
            ? {
                input_tokens: 1_000,
                output_tokens: 2_000,
                total_tokens: 3_000,
                output_tokens_details: {
                  reasoning_tokens: 500,
                },
                secret_debug_payload:
                  'must-not-persist',
              }
            : overrides.usage,
      },
    })),
  };
}

describe('Story Source authority snapshot', () => {
  it.each([
    {
      label: 'no companion / one location / ordinary prop',
      options: {
        companion: false,
        multiLocation: false,
        revealGatedProp: false,
      },
    },
    {
      label:
        'companion / multiple locations / reveal-gated prop / cover',
      options: {
        companion: true,
        multiLocation: true,
        revealGatedProp: true,
        cover: true,
      },
    },
  ])('captures the general $label shape', ({ options }) => {
    const fixture = writeStoryFixture(options);
    const snapshot = snapshotFor(fixture);
    expect(snapshot.content.pages).toHaveLength(3);
    expect(snapshot.content.pageImageDirections).toHaveLength(
      3,
    );
    expect(Boolean(snapshot.content.companion)).toBe(
      options.companion,
    );
    expect(Boolean(snapshot.content.authoredCoverAuthority)).toBe(
      Boolean(options.cover),
    );
    expect(snapshot.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.content.sourceIdentity.path).toBe(
      fixture.storyPath,
    );
  });

  it('invalidates on prose, image-direction, and cover-authority mutations', () => {
    const fixture = writeStoryFixture({
      companion: true,
      cover: true,
    });
    const first = snapshotFor(fixture);
    const storyAbsolute = path.join(
      fixture.repoRoot,
      fixture.storyPath,
    );

    fs.appendFileSync(
      storyAbsolute,
      '\nA final source-authority sentence changes.\n',
      'utf8',
    );
    const proseMutation = snapshotFor(fixture);
    expect(proseMutation.digest).not.toBe(first.digest);
    expect(
      requestFor(proseMutation, 'preflight').digest,
    ).not.toBe(requestFor(first, 'preflight').digest);

    const current = fs.readFileSync(storyAbsolute, 'utf8');
    fs.writeFileSync(
      storyAbsolute,
      current.replace(
        'A calm composition',
        'A changed composition',
      ),
      'utf8',
    );
    const directionMutation = snapshotFor(fixture);
    expect(directionMutation.digest).not.toBe(
      proseMutation.digest,
    );
    expect(
      requestFor(directionMutation, 'preflight').digest,
    ).not.toBe(
      requestFor(proseMutation, 'preflight').digest,
    );

    const biblePath = storyAbsolute.replace(
      /\.md$/,
      '.location-bible.json',
    );
    const bible = JSON.parse(
      fs.readFileSync(biblePath, 'utf8'),
    ) as {
      pagePlans: Array<{
        visibleAnchors: string[];
      }>;
    };
    bible.pagePlans[0].visibleAnchors.push(
      'a new cover anchor',
    );
    fs.writeFileSync(
      biblePath,
      `${JSON.stringify(bible, null, 2)}\n`,
      'utf8',
    );
    const coverMutation = snapshotFor(fixture);
    expect(coverMutation.content.sourceIdentity.digest).toBe(
      directionMutation.content.sourceIdentity.digest,
    );
    expect(coverMutation.digest).not.toBe(
      directionMutation.digest,
    );
    expect(
      requestFor(coverMutation, 'preflight').digest,
    ).not.toBe(
      requestFor(directionMutation, 'preflight').digest,
    );
  });
});

describe('exact zero-cost authoring preflight', () => {
  it('locks every approved request surface and keeps the injected provider unreachable', async () => {
    const fixture = writeStoryFixture({
      pageCount: 12,
      companion: true,
      multiLocation: true,
      revealGatedProp: true,
      cover: true,
    });
    const snapshot = snapshotFor(fixture);
    const request = requestFor(snapshot, 'preflight');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('must remain unreachable');
      }),
    };
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });

    expect(request).toMatchObject({
      provider: 'openai',
      endpoint: 'responses',
      model: 'gpt-5.6-sol',
      serviceTier: 'default',
      reasoningEffort: 'medium',
      toolsDisabled: true,
      noFallback: true,
      transportRetries: 0,
      timeoutMs: 1_200_000,
      tokenBudget: {
        maxInputTokens: 64_000,
        maxOutputTokens: 36_000,
        outputIncludesReasoning: true,
      },
      callBudget: {
        maxCalls: 3,
        maxRepairCount: 2,
      },
      pricing: {
        version: 'openai-standard-pricing/2026-07-27-v2',
        uncachedInputUsdPerUnit: 5,
        cacheWriteInputUsdPerUnit: 6.25,
        cachedInputUsdPerUnit: 0.5,
        outputUsdPerUnit: 30,
        regionalUpliftMultiplier: 1.1,
        source:
          'https://developers.openai.com/api/docs/pricing',
      },
      costBudget: {
        projectedMaxUsd: 4.884,
        hardCeilingUsd: 5,
      },
    });
    expect(request.pricingDigest).toBe(
      canonicalJsonDigest(request.pricing),
    );
    expect(
      request.tokenBudget.promptAndSchemaTokenUpperBound,
    ).toBeLessThanOrEqual(64_000);
    expect(result.receipt.status).toBe(
      'preflight_passed',
    );
    expect(result.receipt.callCount).toBe(0);
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('blocks a generally-derived longer-story live budget above the approved ceiling before provider reachability', async () => {
    const snapshot = snapshotFor(
      writeStoryFixture({
        pageCount: 13,
        multiLocation: true,
      }),
    );
    const request = requestFor(snapshot, 'live');
    const provider = {
      call: vi.fn(async () => {
        throw new Error('must remain unreachable');
      }),
    };
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(request.tokenBudget.maxOutputTokens).toBe(39_000);
    expect(request.costBudget.projectedMaxUsd).toBe(5.181);
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.issues).toContain(
      'projected_cost_ceiling_exceeded',
    );
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('uses cache-write worst case plus regional uplift and treats the $5 boundary inclusively', () => {
    expect(
      conservativeAuthoringCostUsd({
        inputTokens: 64_000,
        outputTokens: 36_000,
      }),
    ).toBe(1.628);
    expect(authoringSpendIsWithinCeiling(4.999999, 5)).toBe(
      true,
    );
    expect(authoringSpendIsWithinCeiling(5, 5)).toBe(true);
    expect(authoringSpendIsWithinCeiling(5.000001, 5)).toBe(
      false,
    );
  });

  it('reserves remaining multi-call exposure conservatively before each provider call', () => {
    const request = requestFor(
      snapshotFor(writeStoryFixture({ pageCount: 12 })),
      'live',
    );
    expect(
      authoringReservedExposureUsd({
        request,
        conservativeAccountedCostUsd: 0,
        providerCallsCompleted: 0,
      }),
    ).toBe(4.884);
    expect(
      authoringReservedExposureUsd({
        request,
        conservativeAccountedCostUsd: 1.628,
        providerCallsCompleted: 1,
      }),
    ).toBe(4.884);
    expect(
      authoringSpendIsWithinCeiling(
        authoringReservedExposureUsd({
          request,
          conservativeAccountedCostUsd: 1.75,
          providerCallsCompleted: 1,
        }),
        request.costBudget.hardCeilingUsd,
      ),
    ).toBe(false);
  });

  it.each([
    ['provider', 'anthropic'],
    ['model', 'gpt-substitute'],
    ['transportRetries', 1],
    ['pricingDigest', '0'.repeat(64)],
  ] as const)(
    'blocks %s mismatch before provider reachability',
    async (field, value) => {
      const snapshot = snapshotFor(
        writeStoryFixture({ pageCount: 3 }),
      );
      const request = structuredClone(
        requestFor(snapshot, 'preflight'),
      ) as unknown as Record<string, unknown>;
      request[field] = value;
      const provider = {
        call: vi.fn(async () => {
          throw new Error('must remain unreachable');
        }),
      };
      const result = await runVisualContractAuthoring({
        request:
          request as unknown as ReturnType<
            typeof requestFor
          >,
        snapshot,
        provider,
      });
      expect(result.receipt.status).toBe('failed');
      expect(provider.call).not.toHaveBeenCalled();
    },
  );

  it('invalidates stale authority even when altered price assumptions are internally re-digested', async () => {
    const snapshot = snapshotFor(
      writeStoryFixture({ pageCount: 12 }),
    );
    const request = structuredClone(
      requestFor(snapshot, 'live'),
    ) as unknown as Record<string, unknown>;
    const pricing = request.pricing as Record<
      string,
      unknown
    >;
    pricing.cacheWriteInputUsdPerUnit = 5;
    request.pricingDigest = canonicalJsonDigest(pricing);
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = request;
    request.digest = canonicalJsonDigest(payload);
    const provider = {
      call: vi.fn(async () => {
        throw new Error('must remain unreachable');
      }),
    };
    const result = await runVisualContractAuthoring({
      request:
        request as unknown as ReturnType<
          typeof requestFor
        >,
      snapshot,
      provider,
    });
    expect(result.receipt.failure?.issues).toContain(
      'price_assumptions_mismatch',
    );
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('fails closed when the Action Semantic Catalog digest or version changes and requires rematerialization', async () => {
    const snapshot = snapshotFor(
      writeStoryFixture({ pageCount: 3 }),
    );
    const request = structuredClone(
      requestFor(snapshot, 'live'),
    );
    request.actionSemanticAuthority.catalogDigest =
      '0'.repeat(64);
    const {
      digestAlgorithm: _digestAlgorithm,
      digest: _digest,
      ...payload
    } = request;
    request.digest = canonicalJsonDigest(payload);
    const provider = {
      call: vi.fn(async () => {
        throw new Error('must remain unreachable');
      }),
    };
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(result.receipt.failure?.issues).toContain(
      'action_semantic_authority_mismatch',
    );
    expect(provider.call).not.toHaveBeenCalled();
  });
});

describe('source-grounded closed action authority', () => {
  it('authors and validates explicit actions on every page of a complete real template shape', async () => {
    const snapshot = bunnySnapshot();
    const draft = fullyActionedBunnyDraft(snapshot);
    const result =
      await compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(draft),
        },
      );
    expect(
      result.template.pageContracts.every(
        (page) =>
          (page.actionRequirements?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(
      JSON.stringify(result.template),
    ).not.toContain('sourcePhrase');
    expect(result.actionSemanticCoverage).toHaveLength(
      snapshot.content.pages.length,
    );
    expect(
      result.actionSemanticCoverage.every((entry) =>
        snapshot.content.pages
          .find(
            (page) => page.pageNumber === entry.pageNumber,
          )
          ?.text.includes(entry.sourcePhrase),
      ),
    ).toBe(true);
  });

  it('traverses the calibration source through sneeze, exact phenomenon contact, and typed movement without predicate substitution', async () => {
    const snapshot = storySnapshot('fox_uri_adventure');
    const draft = actionCapabilityCalibrationDraft(snapshot);
    const result = await compileBookVisualContractTemplate(
      {
        ...snapshot.content,
        storyKey: snapshot.content.storyKey,
        pageCount: snapshot.content.pages.length,
        authoredCoverAuthority:
          snapshot.content.authoredCoverAuthority ?? undefined,
      },
      { callLLM: async () => JSON.stringify(draft) },
    );
    const actions = result.template.pageContracts.flatMap(
      (page) => page.actionRequirements ?? [],
    ) as unknown as Array<Record<string, unknown>>;
    expect(actions.map((action) => action.predicate)).toEqual(
      expect.arrayContaining(['sneezes', 'touches', 'moves']),
    );
    expect(actions.some((action) => action.predicate === 'pushes')).toBe(
      false,
    );
    const phenomenon = actions.find(
      (action) => action.predicate === 'touches',
    )!.subject as Record<string, unknown>;
    expect(phenomenon).toMatchObject({
      kind: 'source_phenomenon',
    });
    expect(
      snapshot.content.pages
        .find((page) => page.pageNumber === 7)!
        .text.includes(String(phenomenon.sourcePhrase)),
    ).toBe(true);
    expect(
      actions.find((action) => action.predicate === 'moves'),
    ).toMatchObject({
      spatialEffect: {
        kind: 'directional',
        direction: 'sideways',
      },
    });
  });

  it('fails with a stable blocker when a source beat cannot fit the closed vocabulary', async () => {
    const snapshot = bunnySnapshot();
    const draft = fullyActionedBunnyDraft(snapshot);
    const first = draft.pageContracts[0] as PageVisualContract &
      Record<string, unknown>;
    first.actionSemanticCoverage = [
      {
        beatId: `beat:p${first.pageNumber}:unsupported`,
        sourceEvidenceId:
          snapshot.content.sourceEvidenceCatalog.entries.find(
            (entry) => entry.pageNumber === first.pageNumber,
          )!.sourceEvidenceId,
        disposition: {
          kind: 'unsupported',
          reason: 'closed_action_catalog_gap',
        },
      },
    ];
    const second = draft.pageContracts[1] as PageVisualContract &
      Record<string, unknown>;
    second.actionSemanticCoverage = [
      {
        beatId: `beat:p${second.pageNumber}:unsupported`,
        sourceEvidenceId:
          snapshot.content.sourceEvidenceCatalog.entries.find(
            (entry) => entry.pageNumber === second.pageNumber,
          )!.sourceEvidenceId,
        disposition: {
          kind: 'unsupported',
          reason: 'closed_action_catalog_gap',
        },
      },
    ];
    let thrown: unknown;
    try {
      await compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(draft),
        },
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(
      ActionSemanticCapabilityGapError,
    );
    expect(
      (thrown as ActionSemanticCapabilityGapError).gaps.map(
        (gap) => gap.pageNumber,
      ),
    ).toEqual([1, 2]);
  });

  it('rejects an action-bound coverage record when its same-page action list is empty', async () => {
    const snapshot = bunnySnapshot();
    const draft = fullyActionedBunnyDraft(snapshot);
    (
      draft.pageContracts[0] as unknown as Record<
        string,
        unknown
      >
    ).actionRequirements = [];
    let thrown: unknown;
    try {
      await compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(draft),
        },
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(
      TemplateRepairExhaustedError,
    );
    expect(
      (
        thrown as TemplateRepairExhaustedError
      ).attempts.some((attempt) =>
        attempt.errors.some((error) =>
          error.includes('same-page actionRequirement'),
        ),
      ),
    ).toBe(true);
  });

  it('rejects minted, malformed, and duplicate action authority through the repair path', async () => {
    const snapshot = bunnySnapshot();
    const minted = fullyActionedBunnyDraft(snapshot);
    const mintedCoverage = (
      minted.pageContracts[0] as unknown as Record<string, unknown>
    ).actionSemanticCoverage as Array<Record<string, unknown>>;
    mintedCoverage[0].sourceEvidenceId = `se1_${'f'.repeat(64)}`;
    await expect(
      compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(minted),
        },
      ),
    ).rejects.toThrow(/source_evidence_id/);

    const malformed = fullyActionedBunnyDraft(snapshot);
    (
      (
        malformed.pageContracts[0] as unknown as Record<
          string,
          unknown
        >
      ).actionRequirements as Array<
        Record<string, unknown>
      >
    )[0].predicate = 'flies_over';
    await expect(
      compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(malformed),
        },
      ),
    ).rejects.toThrow(/predicate.*not one of/);

    const duplicate = fullyActionedBunnyDraft(snapshot);
    const first =
      duplicate.pageContracts[0] as unknown as Record<
        string,
        unknown
      >;
    const existing = structuredClone(
      (first.actionRequirements as unknown[])[0],
    );
    first.actionRequirements = [existing, existing];
    await expect(
      compileBookVisualContractTemplate(
        {
          ...snapshot.content,
          storyKey: snapshot.content.storyKey,
          pageCount: snapshot.content.pages.length,
          authoredCoverAuthority: undefined,
        },
        {
          callLLM: async () => JSON.stringify(duplicate),
        },
      ),
    ).rejects.toThrow(/duplicate checkId/);
  });
});

describe('sanitized receipts and immutable artifact lifecycle', () => {
  it('terminates a genuine catalog capability gap after the initial call with all page gaps and no candidate', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const draft = fullyActionedBunnyDraft(snapshot);
    for (const pageIndex of [0, 1]) {
      const page = draft.pageContracts[
        pageIndex
      ] as unknown as Record<string, unknown>;
      page.actionSemanticCoverage = [
        {
          beatId: `beat:p${pageIndex + 1}:unsupported`,
          sourceEvidenceId:
            snapshot.content.sourceEvidenceCatalog.entries.find(
              (entry) => entry.pageNumber === pageIndex + 1,
            )!.sourceEvidenceId,
          disposition: {
            kind: 'unsupported',
            reason: 'closed_action_catalog_gap',
          },
        },
      ];
    }
    const provider = successfulProvider(draft);
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      compileResult: null,
      receipt: {
        status: 'failed',
        callCount: 1,
        repairCount: 0,
        candidateDigest: null,
        actionSemanticCoverage: {
          status: 'capability_gap',
          gapCount: 2,
        },
        failure: {
          code: 'action_semantic_capability_gap',
        },
      },
    });
    expect(
      result.receipt.failure?.issues.map((issue) =>
        issue.match(/^page \d+/)?.[0],
      ),
    ).toEqual(['page 1', 'page 2']);
  });

  it('separates import-preflight attestation, authoring outcome, coverage, and candidate state in readiness v3', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: successfulProvider(
        fullyActionedBunnyDraft(snapshot),
      ),
    });
    const absent =
      buildVisualContractAuthoringReadinessEvidence({
        snapshot,
        request,
        receipt: result.receipt,
      });
    expect(absent).toMatchObject({
      version: 'visual-contract-authoring-readiness/v4',
      canonicalImportPreflight: {
        status: 'not_attested',
      },
      authoringOutcome: {
        status: 'completed',
        failureCode: null,
      },
      actionSemanticCoverage: {
        status: 'complete_review_required',
      },
      visualContractCandidate: {
        status: 'candidate',
      },
      semanticReconciliation: {
        status: 'absent',
      },
      blueprintAuthoringReady: false,
      d1a1Authorized: false,
    });
    expect(absent.blockers).toContain(
      'canonical_import_preflight_not_attested',
    );

    const attestation =
      buildCanonicalImportPreflightAttestation({
        snapshot,
        request,
      });
    const passed =
      buildVisualContractAuthoringReadinessEvidence({
        snapshot,
        request,
        receipt: result.receipt,
        canonicalImportPreflightAttestation: attestation,
      });
    expect(passed.canonicalImportPreflight.status).toBe(
      'passed',
    );
    const stale = structuredClone(attestation);
    stale.digest = '0'.repeat(64);
    expect(
      buildVisualContractAuthoringReadinessEvidence({
        snapshot,
        request,
        receipt: result.receipt,
        canonicalImportPreflightAttestation: stale,
      }).canonicalImportPreflight.status,
    ).toBe('unknown');
  });

  it('classifies every prior authoring authority as immutable without mutating its bytes', () => {
    const immediatelyPrior = [
      ['request', 'visual-contract-authoring-request/v6'],
      ['receipt', 'visual-contract-authoring-receipt/v5'],
      ['readiness', 'visual-contract-authoring-readiness/v3'],
      ['candidate', 'visual-contract-candidate-artifact/v3'],
    ] as const;
    const historicalBytes = immediatelyPrior.map(([kind, version]) =>
      JSON.stringify({ kind, version, evidence: ['immutable'] }),
    );
    for (const [kind, version] of immediatelyPrior) {
      expect(
        visualContractAuthoringArtifactVersionStatus(kind, version),
      ).toBe('legacy_immutable');
    }
    expect(
      immediatelyPrior.map(([kind, version]) =>
        JSON.stringify({ kind, version, evidence: ['immutable'] }),
      ),
    ).toEqual(historicalBytes);
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'request',
        'visual-contract-authoring-request/v3',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'receipt',
        'visual-contract-authoring-receipt/v3',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'readiness',
        'visual-contract-authoring-readiness/v1',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'candidate',
        'visual-contract-candidate-artifact/v1',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'request',
        'visual-contract-authoring-request/v4',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'request',
        'visual-contract-authoring-request/v5',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'receipt',
        'visual-contract-authoring-receipt/v4',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'readiness',
        'visual-contract-authoring-readiness/v2',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'candidate',
        'visual-contract-candidate-artifact/v2',
      ),
    ).toBe('legacy_immutable');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'request',
        'visual-contract-authoring-request/v7',
      ),
    ).toBe('current');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'receipt',
        'visual-contract-authoring-receipt/v6',
      ),
    ).toBe('current');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'readiness',
        'visual-contract-authoring-readiness/v4',
      ),
    ).toBe('current');
    expect(
      visualContractAuthoringArtifactVersionStatus(
        'candidate',
        'visual-contract-candidate-artifact/v4',
      ),
    ).toBe('current');
  });

  it('records exact per-attempt and aggregate usage/cost without raw prompt, response, or provider payload', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const draft = fullyActionedBunnyDraft(snapshot);
    const provider = successfulProvider(draft);
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(result.receipt.status).toBe('completed');
    expect(result.receipt.version).toBe(
      'visual-contract-authoring-receipt/v6',
    );
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.aggregateUsage).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 2_000,
      reasoningTokens: 500,
      totalTokens: 3_000,
    });
    expect(result.receipt.nominalEstimatedCostUsd).toBe(
      0.065,
    );
    expect(
      result.receipt.conservativeAccountedCostUsd,
    ).toBe(0.072875);
    expect(result.receipt.pricing).toEqual(request.pricing);
    expect(result.receipt.pricingDigest).toBe(
      request.pricingDigest,
    );
    expect(result.receipt.attempts[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      responseId: 'response-1',
      usageEvidenceKind: 'legacy_injected_compatibility',
      reservedExposureBeforeCallUsd: 4.884,
      nominalEstimatedCostUsd: 0.065,
      conservativeAccountedCostUsd: 0.072875,
      status: 'response_received',
    });
    expect(
      result.receipt.attempts[0].systemPromptDigest,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(
      result.receipt.attempts[0].responseDigest,
    ).toMatch(/^[a-f0-9]{64}$/);
    const serialized = JSON.stringify(result.receipt);
    expect(serialized).not.toMatch(
      /secret_debug_payload|systemPrompt["']|userPrompt["']|responseBody|Bearer|apiKey/i,
    );
    expect(serialized).not.toContain('"output"');
    expect(result.compileResult).not.toBeNull();
  });

  it('prices cached reads, cache writes, remaining ordinary input, and output nominally while retaining the conservative fence', () => {
    const usage = {
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteInputTokens: 300,
      outputTokens: 100,
      reasoningTokens: 0,
      totalTokens: 1_100,
    };
    expect(nominalAuthoringUsageCostUsd(usage)).toBe(
      0.007475,
    );
    expect(
      conservativeAuthoringCostUsd({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }),
    ).toBe(0.010175);
  });

  it('sanitizes provider failures and refuses provider/model substitution', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const failing: VisualContractAuthoringProvider = {
      call: vi.fn(async () => {
        throw new Error(
          'Bearer secret-token raw provider exception',
        );
      }),
    };
    const failure = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: failing,
    });
    expect(failure.receipt.failure?.code).toBe(
      'provider_call_failed',
    );
    expect(JSON.stringify(failure.receipt)).not.toMatch(
      /secret-token|raw provider exception/i,
    );
    expect(failing.call).toHaveBeenCalledTimes(1);

    const mismatch = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: successfulProvider('{}', {
        provider: 'another-provider',
        model: 'gpt-substitute',
      }),
    });
    expect(mismatch.receipt.failure?.code).toBe(
      'provider_policy_mismatch',
    );
    expect(mismatch.receipt.callCount).toBe(1);
  });

  it('preserves all three bounded attempt receipts and aggregate evidence on validation exhaustion', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const invalid = fullyActionedBunnyDraft(snapshot);
    invalid.recurringProps[0].material = '';
    const provider = successfulProvider(invalid);
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.code).toBe(
      'validation_exhausted',
    );
    expect(result.receipt.callCount).toBe(3);
    expect(result.receipt.repairCount).toBe(2);
    expect(result.receipt.attempts).toHaveLength(3);
    expect(
      result.receipt.attempts.every(
        (attempt) =>
          attempt.validationErrors.length > 0,
      ),
    ).toBe(true);
    expect(result.receipt.aggregateUsage.inputTokens).toBe(
      3_000,
    );
    expect(result.receipt.nominalEstimatedCostUsd).toBe(
      0.195,
    );
    expect(
      result.receipt.conservativeAccountedCostUsd,
    ).toBe(0.218625);
    expect(
      result.receipt.attempts.map(
        (attempt) =>
          attempt.reservedExposureBeforeCallUsd,
      ),
    ).toEqual([4.884, 3.328875, 1.77375]);
    expect(
      result.receipt.attempts.reduce(
        (sum, attempt) =>
          sum + (attempt.nominalEstimatedCostUsd ?? 0),
        0,
      ),
    ).toBeCloseTo(
      result.receipt.nominalEstimatedCostUsd,
      6,
    );
    expect(
      result.receipt.attempts.reduce(
        (sum, attempt) =>
          sum +
          (attempt.conservativeAccountedCostUsd ?? 0),
        0,
      ),
    ).toBeCloseTo(
      result.receipt.conservativeAccountedCostUsd,
      6,
    );
  });

  it('records the compact source-evidence repair as a bounded second provider call', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const invalid = fullyActionedBunnyDraft(snapshot);
    const firstCoverage = (
      invalid.pageContracts[0] as unknown as Record<
        string,
        unknown
      >
    ).actionSemanticCoverage as Array<Record<string, unknown>>;
    firstCoverage[0]!.sourceEvidenceId = `se1_${'f'.repeat(64)}`;
    const provider: VisualContractAuthoringProvider = {
      call: vi.fn(async (args) => {
        const output =
          args.attempt === 1
            ? JSON.stringify(invalid)
            : JSON.stringify({
                patches: [
                  {
                    pageNumber: 1,
                    beatId: 'beat:p1:look',
                    sourceEvidenceId:
                      snapshot.content.sourceEvidenceCatalog.entries.find(
                        (entry) => entry.pageNumber === 1,
                      )!.sourceEvidenceId,
                  },
                ],
              });
        return {
          output,
          receipt: {
            provider: 'openai',
            model: 'gpt-5.6-sol',
            responseId: `response-${args.attempt}`,
            usage: {
              input_tokens: 1_000,
              output_tokens: 2_000,
              total_tokens: 3_000,
              output_tokens_details: {
                reasoning_tokens: 500,
              },
            },
          },
        };
      }),
    };

    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });

    expect(result.receipt.status).toBe('completed');
    expect(result.receipt.callCount).toBe(2);
    expect(result.receipt.repairCount).toBe(1);
    expect(result.receipt.attempts.map((attempt) => attempt.repairMode))
      .toEqual([null, 'source_evidence_id_patch']);
    expect(provider.call).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(provider.call).mock.calls[1]![0];
    expect(secondCall.options.jsonSchema?.name).toBe(
      'SourceEvidenceIdRepairPatches',
    );
    expect(secondCall.options.maxInputTokens).toBe(64_000);
    expect(secondCall.userPrompt).not.toContain('"worldType"');
    expect(result.receipt.actionSemanticCoverage).toMatchObject({
      sourceEvidenceCatalogVersion: 'source-evidence-catalog/v1',
      sourceEvidenceCatalogDigest:
        snapshot.content.sourceEvidenceCatalog.digest,
    });
  });

  it('rechecks the 64k input ceiling before a repair and never reaches the provider for an oversized repair prompt', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const invalid = fullyActionedBunnyDraft(snapshot);
    invalid.worldType = '';
    invalid.recurringProps[0].description =
      'x'.repeat(80_000);
    const provider = successfulProvider(invalid);
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });
    expect(result.receipt.failure?.code).toBe(
      'input_token_ceiling_exceeded',
    );
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(result.receipt.callCount).toBe(1);
    expect(result.receipt.repairCount).toBe(0);
    expect(
      result.receipt.attempts[
        result.receipt.attempts.length - 1
      ]?.status,
    ).toBe('input_ceiling_exceeded');
    expect(
      result.receipt.attempts[
        result.receipt.attempts.length - 1
      ]?.providerReached,
    ).toBe(false);
    expect(
      JSON.stringify(result.receipt),
    ).not.toContain('x'.repeat(100));
  });

  it('persists source/request/receipt/readiness/candidate by digest, is idempotent, and fails on collision', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: successfulProvider(
        fullyActionedBunnyDraft(snapshot),
      ),
    });
    expect(result.compileResult).not.toBeNull();
    const evidence =
      buildVisualContractAuthoringReadinessEvidence({
        snapshot,
        request,
        receipt: result.receipt,
      });
    expect(evidence.blueprintAuthoringReady).toBe(false);
    expect(evidence.d1a1Authorized).toBe(false);
    expect(evidence.blockers).toEqual(
      expect.arrayContaining([
        'semantic_reconciliation_absent',
        'human_source_approval_absent',
      ]),
    );
    const repoRoot = tempRoot();
    const outputDir = 'outputs/review';
    const sourceWrite =
      persistStorySourceAuthoritySnapshot({
        repoRoot,
        outputDir,
        snapshot,
        write: true,
      });
    const requestWrite =
      persistVisualContractAuthoringRequest({
        repoRoot,
        outputDir,
        request,
        write: true,
      });
    const receiptWrite =
      persistVisualContractAuthoringReceipt({
        repoRoot,
        outputDir,
        receipt: result.receipt,
        write: true,
      });
    const readinessWrite =
      persistVisualContractAuthoringReadiness({
        repoRoot,
        outputDir,
        evidence,
        write: true,
      });
    const candidateWrite = persistVisualContractCandidate({
      repoRoot,
      outputDir,
      receipt: result.receipt,
      compileResult: result.compileResult!,
      write: true,
    });
    for (const write of [
      sourceWrite,
      requestWrite,
      receiptWrite,
      readinessWrite,
      candidateWrite,
    ]) {
      expect(write.path).toContain(write.digest);
      expect(write.created).toBe(true);
      expect(
        fs.existsSync(path.join(repoRoot, write.path)),
      ).toBe(true);
    }
    const candidateArtifact = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, candidateWrite.path),
        'utf8',
      ),
    ) as {
      sourceEvidenceCatalogVersion: string;
      sourceEvidenceCatalogDigest: string;
      actionSemanticCoverageDigest: string;
      actionSemanticCoverage: Array<{
        pageNumber: number;
        beatId: string;
        sourcePhrase: string;
      }>;
    };
    expect(candidateArtifact).toMatchObject({
      sourceEvidenceCatalogVersion: 'source-evidence-catalog/v1',
      sourceEvidenceCatalogDigest:
        snapshot.content.sourceEvidenceCatalog.digest,
    });
    expect(candidateArtifact.actionSemanticCoverage).toHaveLength(
      snapshot.content.pages.length,
    );
    expect(candidateArtifact.actionSemanticCoverageDigest).toBe(
      canonicalJsonDigest(
        candidateArtifact.actionSemanticCoverage,
      ),
    );
    for (const evidenceEntry of candidateArtifact.actionSemanticCoverage) {
      expect(
        snapshot.content.pages
          .find(
            (page) =>
              page.pageNumber === evidenceEntry.pageNumber,
          )
          ?.text,
      ).toContain(evidenceEntry.sourcePhrase);
    }
    expect(
      persistVisualContractAuthoringRequest({
        repoRoot,
        outputDir,
        request,
        write: true,
      }).created,
    ).toBe(false);

    fs.writeFileSync(
      path.join(repoRoot, receiptWrite.path),
      '{"collision":true}\n',
      'utf8',
    );
    expect(() =>
      persistVisualContractAuthoringReceipt({
        repoRoot,
        outputDir,
        receipt: result.receipt,
        write: true,
      }),
    ).toThrow(/immutable artifact collision/);
  });

  it('reuses the established reconciliation draft/review lifecycle while binding exact source-snapshot and Visual Contract digests', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const authored = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: successfulProvider(
        fullyActionedBunnyDraft(snapshot),
      ),
    });
    const template = authored.compileResult!.template;
    const bundle =
      buildProductionReconciliationDraftFromSourceSnapshot({
        snapshot,
        template,
      });
    expect(
      bundle.reconciliation.sourceAuthoritySnapshotDigest,
    ).toBe(snapshot.digest);
    expect(bundle.reconciliation.templateDigest).toBe(
      canonicalJsonDigest(template),
    );
    expect(
      bundle.reviewBundle.sourceAuthoritySnapshotDigest,
    ).toBe(snapshot.digest);
    expect(bundle.reviewBundle.readyForApproval).toBe(false);
    expect(bundle.reconciliation.review.status).toBe('pending');

    const stale = structuredClone(bundle.reconciliation);
    stale.sourceAuthoritySnapshotDigest = '0'.repeat(64);
    expect(
      sourcePromptReconciliationIssues({
        raw: stale,
        storyKey: snapshot.content.storyKey,
        sourceIdentity: snapshot.content.sourceIdentity,
        sourceAuthoritySnapshotDigest: snapshot.digest,
        rawStorySource:
          snapshot.content.normalizedRawStorySource,
        template,
        templateDigest: canonicalJsonDigest(template),
        authoredCoverAuthority:
          snapshot.content.authoredCoverAuthority ??
          undefined,
        requireComplete: false,
      }).some(
        (issue) =>
          issue.code === 'reconciliation_source_mismatch',
      ),
    ).toBe(true);

    const repoRoot = tempRoot();
    const persisted = persistReconciliationDraftBundle({
      repoRoot,
      outputDir: 'outputs/reconciliation',
      reconciliation: bundle.reconciliation,
      reviewBundle: bundle.reviewBundle,
      markdown: bundle.markdown,
      write: true,
    });
    expect(persisted.wrote).toBe(true);
    expect(
      fs.existsSync(
        path.join(repoRoot, persisted.reconciliationPath),
      ),
    ).toBe(true);
    expect(
      persistReconciliationDraftBundle({
        repoRoot,
        outputDir: 'outputs/reconciliation',
        reconciliation: bundle.reconciliation,
        reviewBundle: bundle.reviewBundle,
        markdown: bundle.markdown,
        write: true,
      }).wrote,
    ).toBe(true);
  });

  it('refuses to persist a candidate without a completed exact receipt binding', () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'preflight');
    return runVisualContractAuthoring({
      request,
      snapshot,
    }).then((result) => {
      expect(() =>
        persistVisualContractCandidate({
          repoRoot: tempRoot(),
          outputDir: 'outputs/review',
          receipt: result.receipt,
          compileResult: {
            template: fullyActionedBunnyDraft(snapshot),
            actionSemanticCoverage: [],
          },
          write: true,
        }),
      ).toThrow(/receipt-unbound/);
      expect(result.receipt.candidateDigest).toBeNull();
      expect(
        canonicalJsonDigest(result.receipt),
      ).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  it('refuses a post-receipt substitution of otherwise complete Action Semantic Coverage', async () => {
    const snapshot = bunnySnapshot();
    const request = requestFor(snapshot, 'live');
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: successfulProvider(
        fullyActionedBunnyDraft(snapshot),
      ),
    });
    const substituted = structuredClone(
      result.compileResult!,
    );
    substituted.actionSemanticCoverage[0].sourcePhrase =
      snapshot.content.pages[0].text;
    expect(() =>
      persistVisualContractCandidate({
        repoRoot: tempRoot(),
        outputDir: 'outputs/review',
        receipt: result.receipt,
        compileResult: substituted,
        write: false,
      }),
    ).toThrow(/current Action Semantic Coverage authority/);
  });
});
