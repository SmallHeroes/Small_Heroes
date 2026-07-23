import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { normalizedTextDigest } from '@/lib/visual-package/integrity';
import {
  buildSourcePromptReconciliationDraft,
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
    schemaVersion: 'vc-schema/v1',
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
) {
  return sourcePromptReconciliationIssues({
    raw: artifact,
    storyKey: 'dunes_rescue',
    sourceIdentity,
    rawStorySource: rawSource,
    template: contract,
    templateDigest: canonicalHash(contract),
  });
}

describe('source-prompt reconciliation v1', () => {
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
