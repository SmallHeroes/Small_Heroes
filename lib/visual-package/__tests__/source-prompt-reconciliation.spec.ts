import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  type ActionSemanticCoverageRecord,
} from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import { normalizedTextDigest } from '@/lib/visual-package/integrity';
import {
  buildReconciliationReviewBundle,
  renderReconciliationReviewMarkdown,
} from '@/lib/visual-package/reconciliationLifecycle';
import {
  buildSourcePromptReconciliationDraft,
  legacySourcePromptReconciliationV2Issues,
  projectLegacySourcePromptReconciliationV2,
  reviewerPresentationRebindPointerIsPermittedForPage,
  sourcePromptReconciliationIssues,
  type ReconciliationSourceRequirement,
  type SourcePromptReconciliation,
} from '@/lib/visual-package/sourcePromptReconciliation';
import type { StorySourceIdentity } from '@/lib/visual-package/types';

const REVIEW = {
  status: 'approved',
  reviewedBy: 'fixture reviewer',
  reviewedAt: '2026-07-23T08:00:00.000Z',
} as const;
const GUY_REVIEW = {
  status: 'approved',
  reviewedBy: 'Guy',
  reviewedAt: '2026-08-20T08:00:00.000Z',
} as const;
const PENDING_REVIEW = {
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
} as const;

function source(withDirections = true, changedPlot = false): string {
  return [
    '---',
    'title: "The Signal Beyond the Dunes"',
    'pages: 2',
    '---',
    '--- Page 1 ---',
    ...(withDirections
      ? ['imageDirection: A magical castle floats over the sea; replace the rescue beacon.']
      : []),
    '',
    changedPlot
      ? 'The child repairs a solar kite and sends medicine across the canyon.'
      : 'The child follows a blinking rescue beacon across the windy dunes.',
    '',
    '--- Page 2 ---',
    ...(withDirections ? ['imageDirection: Close view of relieved smiles around the beacon.'] : []),
    '',
    'A small rover reaches the lost scientist, and everyone shares a relieved smile.',
    '',
  ].join('\n');
}

function identity(raw: string): StorySourceIdentity {
  const pages = parseStorySourceContent(raw).pages;
  return {
    version: 'story-source/v1',
    path: 'story-bank/fixtures/dunes_rescue.md',
    digestAlgorithm: 'sha256-normalized-utf8',
    digest: normalizedTextDigest(raw),
    pageCount: pages.length,
    pageNumbers: pages.map((page) => page.pageNumber),
  };
}

function template(): BookVisualContractTemplate {
  return {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: 'dunes_rescue',
    worldType: 'grounded near-future desert rescue',
    locations: [{
      id: 'loc_dunes',
      name: 'Windy dunes',
      description: 'open ochre dunes with a grounded rescue trail',
      environmentClass: 'outdoor',
      timeOfDay: 'day',
      lighting: 'clear afternoon sunlight',
      setIdentityId: 'set_dunes',
    }],
    zones: [{
      id: 'zone_beacon',
      locationId: 'loc_dunes',
      name: 'Beacon ridge',
      description: 'low ridge beside the rescue beacon',
    }],
    cast: {
      child: {
        id: 'child:hero',
        role: 'child',
        wardrobe: { description: 'yellow windbreaker and sturdy boots' },
      },
    },
    humanCast: [],
    recurringProps: [{
      id: 'prop_rescue_beacon',
      name: 'rescue beacon',
      description: 'compact amber rescue beacon',
    }],
    forbiddenGlobalElements: ['magic castles'],
    coverContract: {
      worldType: 'grounded near-future desert rescue',
      locationId: 'loc_dunes',
      zoneId: 'zone_beacon',
      castIds: ['child:hero'],
      mustShow: ['child following an amber rescue beacon'],
      mustNotShow: ['magic castles'],
    },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'loc_dunes',
        zoneId: 'zone_beacon',
        mustShow: ['child follows the blinking rescue beacon across windy dunes'],
        mustNotShow: ['magic castles'],
        characterPresence: { child: true, companion: false },
        castIds: ['child:hero'],
        propState: [{ propId: 'prop_rescue_beacon', state: 'blinking ahead' }],
        camera: 'wide tracking composition across the ridge',
        transition: { kind: 'steady' },
      },
      {
        pageNumber: 2,
        locationId: 'loc_dunes',
        zoneId: 'zone_beacon',
        mustShow: ['child, rover, scientist, and relieved shared smiles'],
        mustNotShow: ['magic castles'],
        characterPresence: { child: true, companion: false },
        castIds: ['child:hero'],
        propState: [{ propId: 'prop_rescue_beacon', state: 'steady safe glow' }],
        camera: 'close group composition with readable relieved expressions',
        transition: { kind: 'steady' },
      },
    ],
  };
}

function preserved(
  sourceRequirement: ReconciliationSourceRequirement,
  id: string,
  path: string,
  value: unknown,
): void {
  sourceRequirement.visualBeats = [{
    id,
    description: `preserve ${id}`,
    aspects: ['narrative_meaning'],
    disposition: 'preserved',
    contractEvidence: [{ path, value }],
    justification: null,
    supersessionReview: null,
  }];
}

function reviewedArtifact(
  rawSource: string,
  contract: BookVisualContractTemplate = template(),
): {
  artifact: SourcePromptReconciliation;
  contract: BookVisualContractTemplate;
  sourceIdentity: StorySourceIdentity;
} {
  const content = parseStorySourceContent(rawSource);
  const sourceIdentity = identity(rawSource);
  const artifact = buildSourcePromptReconciliationDraft({
    storyKey: 'dunes_rescue',
    sourceIdentity,
    pages: content.pages,
    pageImageDirections: content.pageImageDirections,
    actionSemanticCoverage: [],
  }, contract);
  artifact.review = REVIEW;
  const cover = artifact.frames[0]!;
  preserved(
    cover.sourceRequirements[0]!,
    'cover:story-promise',
    '/coverContract/mustShow/0',
    contract.coverContract.mustShow[0],
  );
  for (const frame of artifact.frames.filter((candidate) => candidate.frameKind === 'page')) {
    const pageIndex = contract.pageContracts.findIndex(
      (candidate) => candidate.pageNumber === frame.pageNumber,
    );
    const storyRequirement = frame.sourceRequirements.find(
      (candidate) => candidate.sourceKind === 'story_prose',
    )!;
    preserved(
      storyRequirement,
      `page:${frame.pageNumber}:story`,
      `/pageContracts/${pageIndex}/mustShow/0`,
      contract.pageContracts[pageIndex]!.mustShow[0],
    );
    const direction = frame.sourceRequirements.find(
      (candidate) => candidate.sourceKind === 'historical_image_direction',
    );
    if (direction && frame.pageNumber === 1) {
      direction.visualBeats = [{
        id: 'page:1:legacy-castle',
        description: 'legacy castle composition conflicts with the grounded rescue world',
        aspects: ['composition'],
        disposition: 'intentionally_superseded',
        contractEvidence: [],
        justification: 'Story prose and frozen world authority require a grounded dune rescue.',
        supersessionReview: REVIEW,
      }];
    } else if (direction) {
      preserved(
        direction,
        `page:${frame.pageNumber}:direction-expression`,
        `/pageContracts/${pageIndex}/camera`,
        contract.pageContracts[pageIndex]!.camera,
      );
      direction.visualBeats[0]!.aspects = ['expression', 'composition'];
    }
  }
  return { artifact, contract, sourceIdentity };
}

function validate(
  rawSource: string,
  artifact: SourcePromptReconciliation,
  contract: BookVisualContractTemplate,
  sourceIdentity = identity(rawSource),
  actionSemanticCoverage =
    artifact.actionSemanticCoverageAuthority.records,
) {
  return sourcePromptReconciliationIssues({
    raw: artifact,
    storyKey: 'dunes_rescue',
    sourceIdentity,
    rawStorySource: rawSource,
    template: contract,
    templateDigest: canonicalHash(contract),
    actionSemanticCoverage,
  });
}

describe('source-prompt reconciliation v3', () => {
  it('keeps the shared reconciliation/selector/package authority free of the Fox key, prop id, and page literal', () => {
    const sharedModules = [
      'lib/visual-package/sourcePromptReconciliation.ts',
      'lib/visual-package/promotion.ts',
      'lib/visual-package/qualification.ts',
      'lib/visual-package/runtimeAuthority.ts',
      'lib/visual-contract-compiler/selectCalibrationPages.ts',
      'lib/visual-contract-compiler/compileBookVisualContractTemplate.ts',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
    expect(sharedModules).not.toMatch(
      /fox_uri_adventure|prop_tin_bucket|old tin bucket|first reveal(?:ed)? on page 5/i,
    );
  });

  it('accepts a materially different plot/world/prop and records a conflicting direction as reviewed supersession', () => {
    const raw = source(true);
    const { artifact, contract } = reviewedArtifact(raw);
    expect(validate(raw, artifact, contract)).toEqual([]);
    expect(artifact.frames[1]!.sourceRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: 'historical_image_direction' }),
    ]));
  });

  it('works when imageDirection is entirely absent', () => {
    const raw = source(false);
    const { artifact, contract } = reviewedArtifact(raw);
    expect(validate(raw, artifact, contract)).toEqual([]);
    expect(artifact.frames.flatMap((frame) => frame.sourceRequirements)
      .some((requirement) => requirement.sourceKind === 'historical_image_direction')).toBe(false);
  });

  it('binds typed presentation requirements to exact preserved story-prose evidence', () => {
    const raw = source(false);
    const contract = template();
    const content = parseStorySourceContent(raw);
    const sourceIdentity = identity(raw);
    const coverage: ActionSemanticCoverageRecord[] = [
      {
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: 1,
        beatId: 'beat:p1:beacon_light',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        sourcePhrase: 'The child follows a blinking rescue beacon across the windy dunes.',
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'lighting_state',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: contract.pageContracts[0]!.mustShow[0]!,
        },
        reviewState: 'unreviewed',
      },
    ];
    const artifact = buildSourcePromptReconciliationDraft(
      {
        storyKey: 'dunes_rescue',
        sourceIdentity,
        pages: content.pages,
        actionSemanticCoverage: coverage,
      },
      contract,
    );
    artifact.review = REVIEW;
    preserved(
      artifact.frames[0]!.sourceRequirements[0]!,
      'cover:story-promise',
      '/coverContract/mustShow/0',
      contract.coverContract.mustShow[0],
    );
    preserved(
      artifact.frames[1]!.sourceRequirements[0]!,
      'page:1:presentation',
      '/pageContracts/0/mustShow/0',
      contract.pageContracts[0]!.mustShow[0],
    );
    preserved(
      artifact.frames[2]!.sourceRequirements[0]!,
      'page:2:story',
      '/pageContracts/1/mustShow/0',
      contract.pageContracts[1]!.mustShow[0],
    );
    expect(artifact.presentationRequirements).toMatchObject({
      version: 'presentation-requirement-reconciliation/v1',
      actionSemanticCoverageVersion:
        ACTION_SEMANTIC_COVERAGE_VERSION,
      requirements: [
        {
          pageNumber: 1,
          beatId: 'beat:p1:beacon_light',
          presentationClass: 'lighting_state',
          contractPointer: '/pageContracts/0/mustShow/0',
        },
      ],
    });
    expect(artifact.actionSemanticCoverageAuthority).toMatchObject({
      version:
        'action-semantic-coverage-reconciliation-authority/v1',
      actionSemanticCoverageVersion:
        ACTION_SEMANTIC_COVERAGE_VERSION,
      actionSemanticCoverageDigest:
        artifact.presentationRequirements
          .actionSemanticCoverageDigest,
      records: coverage,
    });
    expect(validate(raw, artifact, contract, sourceIdentity)).toEqual([]);

    const roundTripped = JSON.parse(
      JSON.stringify(artifact),
    ) as SourcePromptReconciliation;
    expect(
      sourcePromptReconciliationIssues({
        raw: roundTripped,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }),
    ).toEqual([]);

    const missingBinding = structuredClone(artifact) as Partial<
      SourcePromptReconciliation
    >;
    delete missingBinding.presentationRequirements;
    expect(
      sourcePromptReconciliationIssues({
        raw: missingBinding,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const emptyBinding = structuredClone(artifact);
    emptyBinding.presentationRequirements.requirements = [];
    expect(
      sourcePromptReconciliationIssues({
        raw: emptyBinding,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const forgedDigest = structuredClone(artifact);
    forgedDigest.presentationRequirements
      .actionSemanticCoverageDigest = 'f'.repeat(64);
    expect(
      sourcePromptReconciliationIssues({
        raw: forgedDigest,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const missingAuthority = structuredClone(artifact) as Partial<
      SourcePromptReconciliation
    >;
    delete missingAuthority.actionSemanticCoverageAuthority;
    expect(
      sourcePromptReconciliationIssues({
        raw: missingAuthority,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const substitutedAuthority = structuredClone(artifact);
    substitutedAuthority.actionSemanticCoverageAuthority.records[0]!
      .sourcePhrase = 'substituted source evidence';
    const substitutedDigest = canonicalHash(
      substitutedAuthority.actionSemanticCoverageAuthority.records,
    );
    substitutedAuthority.actionSemanticCoverageAuthority
      .actionSemanticCoverageDigest = substitutedDigest;
    substitutedAuthority.presentationRequirements
      .actionSemanticCoverageDigest = substitutedDigest;
    expect(
      sourcePromptReconciliationIssues({
        raw: substitutedAuthority,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const legacy = {
      ...structuredClone(artifact),
      version: 'source-prompt-reconciliation/v1',
    };
    expect(
      sourcePromptReconciliationIssues({
        raw: legacy,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const missingReview = structuredClone(artifact);
    missingReview.frames[1]!.sourceRequirements[0]!.visualBeats = [];
    expect(
      validate(raw, missingReview, contract, sourceIdentity).map(
        (issue) => issue.code,
      ),
    ).toContain('reconciliation_incomplete');

    const tampered = structuredClone(artifact);
    tampered.presentationRequirements!.requirements[0]!.contractValue =
      'stale';
    expect(
      validate(raw, tampered, contract, sourceIdentity).map(
        (issue) => issue.code,
      ),
    ).toContain('reconciliation_invalid');
  });

  it('supports only explicit same-page rebinds or visible Guy-reviewed supersessions and preserves v2 read-only validation', () => {
    const raw = source(false);
    const contract = template();
    contract.pageContracts[0]!.mustShow.push(
      'the exact alternate beacon composition selected by the reviewer',
    );
    const sourceIdentity = identity(raw);
    const content = parseStorySourceContent(raw);
    const coverage: ActionSemanticCoverageRecord[] = [
      {
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: 1,
        beatId: 'beat:p1:rebound_must_show',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        sourcePhrase: 'The child selects the exact alternate beacon composition.',
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'composition_focus',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: contract.pageContracts[0]!.mustShow[0]!,
        },
        reviewState: 'unreviewed',
      },
      {
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: 1,
        beatId: 'beat:p1:rebound_prop_state',
        sourceEvidenceId: `se1_${'b'.repeat(64)}`,
        sourcePhrase: 'The rescue beacon is blinking ahead.',
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'static_state',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: contract.pageContracts[0]!.mustShow[0]!,
        },
        reviewState: 'unreviewed',
      },
      {
        version: ACTION_SEMANTIC_COVERAGE_VERSION,
        pageNumber: 2,
        beatId: 'beat:p2:unsupported_detail',
        sourceEvidenceId: `se1_${'c'.repeat(64)}`,
        sourcePhrase: 'A source detail intentionally omitted from the frozen illustration.',
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'ambient_event',
          contractPointer: '/pageContracts/1/mustShow/0',
          contractValue: contract.pageContracts[1]!.mustShow[0]!,
        },
        reviewState: 'unreviewed',
      },
    ];
    const artifact = buildSourcePromptReconciliationDraft(
      {
        storyKey: 'dunes_rescue',
        sourceIdentity,
        pages: content.pages,
        actionSemanticCoverage: coverage,
      },
      contract,
    );
    preserved(
      artifact.frames[0]!.sourceRequirements[0]!,
      'cover:story-promise',
      '/coverContract/mustShow/0',
      contract.coverContract.mustShow[0],
    );
    artifact.frames[1]!.sourceRequirements[0]!.visualBeats = [{
      id: 'page:1:reviewed-rebinds',
      description: 'reviewed exact alternate evidence for two page-one source beats',
      aspects: ['composition', 'staging'],
      disposition: 'preserved',
      contractEvidence: [
        {
          path: '/pageContracts/0/mustShow/1',
          value: contract.pageContracts[0]!.mustShow[1],
        },
        {
          path: '/pageContracts/0/propState/0/state',
          value: contract.pageContracts[0]!.propState![0]!.state,
        },
      ],
      justification: null,
      supersessionReview: null,
    }];
    preserved(
      artifact.frames[2]!.sourceRequirements[0]!,
      'page:2:remaining-story',
      '/pageContracts/1/camera',
      contract.pageContracts[1]!.camera,
    );
    artifact.review = PENDING_REVIEW;
    artifact.presentationRequirementDispositions.entries = [
      {
        pageNumber: 1,
        beatId: coverage[0]!.beatId,
        sourceEvidenceId: coverage[0]!.sourceEvidenceId,
        kind: 'rebound',
        reboundPointer: '/pageContracts/0/mustShow/1',
        reboundValue: contract.pageContracts[0]!.mustShow[1]!,
        justification: null,
        review: PENDING_REVIEW,
      },
      {
        pageNumber: 1,
        beatId: coverage[1]!.beatId,
        sourceEvidenceId: coverage[1]!.sourceEvidenceId,
        kind: 'rebound',
        reboundPointer: '/pageContracts/0/propState/0/state',
        reboundValue: contract.pageContracts[0]!.propState![0]!.state,
        justification: null,
        review: PENDING_REVIEW,
      },
      {
        pageNumber: 2,
        beatId: coverage[2]!.beatId,
        sourceEvidenceId: coverage[2]!.sourceEvidenceId,
        kind: 'superseded',
        reboundPointer: null,
        reboundValue: null,
        justification: 'Guy may approve omitting this exact source moment from the illustration.',
        review: PENDING_REVIEW,
      },
    ];

    expect(validate(raw, artifact, contract, sourceIdentity, coverage)).toEqual([
      expect.objectContaining({
        code: 'reconciliation_incomplete',
        field: 'review',
      }),
    ]);
    const pendingBundle = buildReconciliationReviewBundle({
      reconciliation: artifact,
      sourceIdentity,
      rawStorySource: raw,
      template: contract,
      actionSemanticCoverage: coverage,
    });
    expect(pendingBundle.blockingIssues).toEqual([
      expect.objectContaining({ field: 'review' }),
    ]);
    expect(pendingBundle.presentationRequirementDispositions).toHaveLength(3);
    const pendingMarkdown = renderReconciliationReviewMarkdown(pendingBundle);
    expect(pendingMarkdown).toContain('## Presentation Requirement reviewer decisions');
    expect(pendingMarkdown).toContain('**REBIND**');
    expect(pendingMarkdown).toContain('**SUPERSEDE / WILL NOT BE DEPICTED**');
    expect(pendingMarkdown).toContain('/pageContracts/0/propState/0/state');
    expect(pendingMarkdown).toContain(coverage[2]!.sourcePhrase);
    expect(
      reviewerPresentationRebindPointerIsPermittedForPage({
        template: contract,
        pageNumber: 1,
        pointer: '/pageContracts/0/propState/0/state',
      }),
    ).toBe(true);
    expect(
      reviewerPresentationRebindPointerIsPermittedForPage({
        template: contract,
        pageNumber: 1,
        pointer: '/pageContracts/0/actionRequirements/0/predicate',
      }),
    ).toBe(false);

    artifact.review = GUY_REVIEW;
    for (const entry of artifact.presentationRequirementDispositions.entries) {
      entry.review = GUY_REVIEW;
    }
    expect(validate(raw, artifact, contract, sourceIdentity, coverage)).toEqual([]);
    expect(buildReconciliationReviewBundle({
      reconciliation: artifact,
      sourceIdentity,
      rawStorySource: raw,
      template: contract,
      actionSemanticCoverage: coverage,
    }).readyForApproval).toBe(true);

    const expectRejected = (
      mutate: (candidate: SourcePromptReconciliation) => void,
      code: 'reconciliation_invalid' | 'reconciliation_incomplete',
    ) => {
      const candidate = structuredClone(artifact);
      mutate(candidate);
      expect(
        validate(raw, candidate, contract, sourceIdentity, coverage).map(
          (issue) => issue.code,
        ),
      ).toContain(code);
    };
    expectRejected((candidate) => {
      candidate.presentationRequirementDispositions.entries[0]!.beatId = 'orphan';
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      candidate.presentationRequirementDispositions.entries.push(
        structuredClone(candidate.presentationRequirementDispositions.entries[0]!),
      );
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      const entry = candidate.presentationRequirementDispositions.entries[0]!;
      entry.reboundPointer = '/pageContracts/1/mustShow/0';
      entry.reboundValue = contract.pageContracts[1]!.mustShow[0]!;
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      const entry = candidate.presentationRequirementDispositions.entries[0]!;
      entry.reboundPointer = '/pageContracts/0/camera';
      entry.reboundValue = contract.pageContracts[0]!.camera;
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      candidate.presentationRequirementDispositions.entries[0]!.reboundValue = 'stale';
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      const entry = candidate.presentationRequirementDispositions.entries[0]!;
      entry.reboundPointer = '/pageContracts/0/mustShow/0';
      entry.reboundValue = contract.pageContracts[0]!.mustShow[0]!;
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      candidate.frames[1]!.sourceRequirements[0]!.visualBeats[0]!
        .contractEvidence = candidate.frames[1]!.sourceRequirements[0]!
        .visualBeats[0]!.contractEvidence.slice(1);
    }, 'reconciliation_incomplete');
    expectRejected((candidate) => {
      candidate.presentationRequirementDispositions.entries[2]!.justification = '';
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      const entry = candidate.presentationRequirementDispositions.entries[2]!;
      entry.reboundPointer = '/pageContracts/1/mustShow/0';
      entry.reboundValue = contract.pageContracts[1]!.mustShow[0]!;
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      candidate.review = REVIEW;
      for (const entry of candidate.presentationRequirementDispositions.entries) {
        entry.review = REVIEW;
      }
    }, 'reconciliation_invalid');
    expectRejected((candidate) => {
      (candidate.presentationRequirementDispositions.entries[0] as unknown as Record<string, unknown>)
        .extra = true;
    }, 'reconciliation_invalid');

    const sharedOriginalWithRebound = structuredClone(artifact);
    sharedOriginalWithRebound.presentationRequirementDispositions.entries =
      sharedOriginalWithRebound.presentationRequirementDispositions.entries.slice(1);
    sharedOriginalWithRebound.frames[1]!.sourceRequirements[0]!.visualBeats[0]!
      .contractEvidence.unshift({
        path: '/pageContracts/0/mustShow/0',
        value: contract.pageContracts[0]!.mustShow[0],
      });
    expect(
      validate(
        raw,
        sharedOriginalWithRebound,
        contract,
        sourceIdentity,
        coverage,
      ),
    ).toEqual([]);

    const sharedOriginalWithSupersession = structuredClone(
      sharedOriginalWithRebound,
    );
    const sharedSupersession =
      sharedOriginalWithSupersession.presentationRequirementDispositions
        .entries[0]!;
    sharedSupersession.kind = 'superseded';
    sharedSupersession.reboundPointer = null;
    sharedSupersession.reboundValue = null;
    sharedSupersession.justification =
      'Guy explicitly accepts omitting this distinct source moment.';
    expect(
      validate(
        raw,
        sharedOriginalWithSupersession,
        contract,
        sourceIdentity,
        coverage,
      ),
    ).toEqual([]);

    const targetIsAnotherRequirementPointer = structuredClone(
      sharedOriginalWithRebound,
    );
    const targetCollisionCoverage = structuredClone(coverage);
    const targetOwnerDisposition = targetCollisionCoverage[0]!.disposition;
    if (targetOwnerDisposition.kind !== 'presentation_requirement') {
      throw new Error('fixture presentation requirement drift');
    }
    targetOwnerDisposition.contractPointer = '/pageContracts/0/mustShow/1';
    targetOwnerDisposition.contractValue =
      contract.pageContracts[0]!.mustShow[1]!;
    targetIsAnotherRequirementPointer.actionSemanticCoverageAuthority.records =
      structuredClone(targetCollisionCoverage);
    const targetCollisionDigest = canonicalHash(targetCollisionCoverage);
    targetIsAnotherRequirementPointer.actionSemanticCoverageAuthority
      .actionSemanticCoverageDigest = targetCollisionDigest;
    targetIsAnotherRequirementPointer.presentationRequirements
      .actionSemanticCoverageDigest = targetCollisionDigest;
    targetIsAnotherRequirementPointer.presentationRequirements.requirements[0]!
      .contractPointer = '/pageContracts/0/mustShow/1';
    targetIsAnotherRequirementPointer.presentationRequirements.requirements[0]!
      .contractValue = contract.pageContracts[0]!.mustShow[1]!;
    const targetCollisionRebind =
      targetIsAnotherRequirementPointer.presentationRequirementDispositions
        .entries[0]!;
    targetCollisionRebind.reboundPointer = '/pageContracts/0/mustShow/1';
    targetCollisionRebind.reboundValue =
      contract.pageContracts[0]!.mustShow[1]!;
    expect(
      validate(
        raw,
        targetIsAnotherRequirementPointer,
        contract,
        sourceIdentity,
        targetCollisionCoverage,
      ),
    ).toEqual([]);

    const legacy = projectLegacySourcePromptReconciliationV2(artifact);
    expect(
      legacySourcePromptReconciliationV2Issues({
        raw: legacy,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_incomplete');
    expect(
      sourcePromptReconciliationIssues({
        raw: legacy,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: coverage,
      }).map((issue) => issue.code),
    ).toContain('reconciliation_invalid');

    const oldComplete = reviewedArtifact(raw, contract).artifact;
    const oldCompleteV2 = projectLegacySourcePromptReconciliationV2(
      oldComplete,
    );
    expect(
      legacySourcePromptReconciliationV2Issues({
        raw: oldCompleteV2,
        storyKey: 'dunes_rescue',
        sourceIdentity,
        rawStorySource: raw,
        template: contract,
        templateDigest: canonicalHash(contract),
        actionSemanticCoverage: [],
      }),
    ).toEqual([]);
  });

  it('invalidates an old package after any plot/source edit and accepts a rebuilt evidence artifact without shared-code changes', () => {
    const original = source(true);
    const changed = source(true, true);
    const originalReviewed = reviewedArtifact(original);
    const stale = validate(
      changed,
      originalReviewed.artifact,
      originalReviewed.contract,
      identity(changed),
    );
    expect(stale.map((issue) => issue.code)).toContain('reconciliation_source_mismatch');

    const changedContract = template();
    changedContract.recurringProps = [{
      id: 'prop_solar_kite',
      name: 'solar kite',
      description: 'folding orange medicine-delivery kite',
    }];
    changedContract.coverContract.mustShow = ['child launching an orange solar kite'];
    changedContract.pageContracts[0]!.mustShow = [
      'child repairs and launches an orange solar kite carrying medicine',
    ];
    changedContract.pageContracts[0]!.propState = [{
      propId: 'prop_solar_kite',
      state: 'repaired and ready to launch',
    }];
    changedContract.pageContracts[1]!.mustShow = [
      'solar kite reaches the far canyon clinic and everyone shares a relieved smile',
    ];
    changedContract.pageContracts[1]!.propState = [{
      propId: 'prop_solar_kite',
      state: 'landed safely with medicine',
    }];
    const rebuilt = reviewedArtifact(changed, changedContract);
    expect(validate(changed, rebuilt.artifact, rebuilt.contract)).toEqual([]);
    expect(rebuilt.sourceIdentity.digest).not.toBe(originalReviewed.sourceIdentity.digest);
    expect(rebuilt.artifact.templateDigest).not.toBe(originalReviewed.artifact.templateDigest);
  });

  it('fails closed on unresolved beats, stale contract values, and direction citations into world authority', () => {
    const raw = source(true);
    const malformed = reviewedArtifact(raw);
    delete (malformed.artifact as Partial<SourcePromptReconciliation>).sourceIdentity;
    expect(validate(raw, malformed.artifact, malformed.contract).map((issue) => issue.code))
      .toContain('reconciliation_invalid');

    const unresolved = reviewedArtifact(raw);
    unresolved.artifact.frames[1]!.sourceRequirements[0]!.visualBeats = [];
    expect(validate(raw, unresolved.artifact, unresolved.contract).map((issue) => issue.code))
      .toContain('reconciliation_incomplete');

    const staleValue = reviewedArtifact(raw);
    staleValue.artifact.frames[2]!.sourceRequirements[0]!.visualBeats[0]!.contractEvidence[0]!.value =
      'stale value';
    expect(validate(raw, staleValue.artifact, staleValue.contract).map((issue) => issue.code))
      .toContain('reconciliation_template_mismatch');

    const forbiddenDirectionAuthority = reviewedArtifact(raw);
    const pageTwoDirection = forbiddenDirectionAuthority.artifact.frames[2]!.sourceRequirements.find(
      (candidate) => candidate.sourceKind === 'historical_image_direction',
    )!;
    pageTwoDirection.visualBeats[0]!.contractEvidence = [{
      path: '/pageContracts/1/locationId',
      value: forbiddenDirectionAuthority.contract.pageContracts[1]!.locationId,
    }];
    expect(validate(
      raw,
      forbiddenDirectionAuthority.artifact,
      forbiddenDirectionAuthority.contract,
    ).map((issue) => issue.code)).toContain('reconciliation_invalid');
  });
});
