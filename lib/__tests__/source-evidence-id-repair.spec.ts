import { describe, expect, it } from 'vitest';

import { buildSourceEvidenceCatalog } from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import {
  applySourceEvidenceIdPatches,
  parseSourceEvidenceIdPatches,
  type SourceEvidenceIdPatch,
  type SourceEvidenceIdRepairAffectedRecord,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';

function identity(digest = '1'.repeat(64)) {
  return {
    version: 'normalized-story-source/v1',
    path: 'stories/repair-guard-story.md',
    digestAlgorithm: 'sha256',
    digest,
    pageCount: 2,
    pageNumbers: [1, 2],
  };
}

const pages = [
  { pageNumber: 1, text: 'Page one evidence. Another page one fact.' },
  { pageNumber: 2, text: 'Page two evidence.' },
];

function affectedRecord(
  pageNumber: number,
  coverageIndex: number,
  beatId: string,
): SourceEvidenceIdRepairAffectedRecord {
  return {
    pageNumber,
    coverageIndex,
    beatId,
    failureCode: 'source_evidence_id_unknown',
    coverageRecord: {
      beatId,
      sourceEvidenceId: `se1_${'f'.repeat(64)}`,
      disposition: 'unreviewed',
    },
    actionRequirement: null,
  };
}

function repairFixture() {
  const catalog = buildSourceEvidenceCatalog({
    storyKey: 'repair-guard-story',
    sourceIdentity: identity(),
    pages,
  });
  const staleCatalog = buildSourceEvidenceCatalog({
    storyKey: 'repair-guard-story',
    sourceIdentity: identity('2'.repeat(64)),
    pages,
  });
  const pageOneId = catalog.entries.find(
    (entry) => entry.pageNumber === 1,
  )!.sourceEvidenceId;
  const pageTwoId = catalog.entries.find(
    (entry) => entry.pageNumber === 2,
  )!.sourceEvidenceId;
  const affectedRecords = [
    affectedRecord(1, 0, 'beat:page-one'),
    affectedRecord(2, 0, 'beat:page-two'),
  ];
  const patches: SourceEvidenceIdPatch[] = [
    {
      pageNumber: 1,
      beatId: 'beat:page-one',
      sourceEvidenceId: pageOneId,
    },
    {
      pageNumber: 2,
      beatId: 'beat:page-two',
      sourceEvidenceId: pageTwoId,
    },
  ];
  const draft = {
    pageContracts: [
      {
        pageNumber: 1,
        actionSemanticCoverage: [
          {
            beatId: 'beat:page-one',
            sourceEvidenceId: `se1_${'f'.repeat(64)}`,
          },
        ],
      },
      {
        pageNumber: 2,
        actionSemanticCoverage: [
          {
            beatId: 'beat:page-two',
            sourceEvidenceId: `se1_${'e'.repeat(64)}`,
          },
        ],
      },
    ],
  };
  return {
    affectedRecords,
    catalog,
    draft,
    pageOneId,
    pageTwoId,
    patches,
    staleId: staleCatalog.entries.find(
      (entry) => entry.pageNumber === 1,
    )!.sourceEvidenceId,
  };
}

describe('parseSourceEvidenceIdPatches rejection guards', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseSourceEvidenceIdPatches('{')).toThrowError(
      'source_evidence_id_repair_response_invalid_json',
    );
  });

  it.each([
    ['non-object root', []],
    ['extra root key', { patches: [], extra: true }],
    ['non-array patches', { patches: null }],
  ])('rejects invalid root shape: %s', (_label, value) => {
    expect(() =>
      parseSourceEvidenceIdPatches(JSON.stringify(value)),
    ).toThrowError('source_evidence_id_repair_response_invalid_shape');
  });

  it.each([
    ['non-object patch', null],
    [
      'missing patch key',
      { pageNumber: 1, beatId: 'beat:page-one' },
    ],
    [
      'extra patch key',
      {
        pageNumber: 1,
        beatId: 'beat:page-one',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        extra: true,
      },
    ],
    [
      'invalid page number',
      {
        pageNumber: 0,
        beatId: 'beat:page-one',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
      },
    ],
    [
      'non-string beat ID',
      {
        pageNumber: 1,
        beatId: 1,
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
      },
    ],
    [
      'non-string source evidence ID',
      {
        pageNumber: 1,
        beatId: 'beat:page-one',
        sourceEvidenceId: 1,
      },
    ],
  ])('rejects invalid patch shape: %s', (_label, patch) => {
    expect(() =>
      parseSourceEvidenceIdPatches(JSON.stringify({ patches: [patch] })),
    ).toThrowError('source_evidence_id_repair_patch_invalid');
  });

  it('accepts the exact patch shape as a positive control', () => {
    const { patches } = repairFixture();

    expect(
      parseSourceEvidenceIdPatches(JSON.stringify({ patches })),
    ).toEqual(patches);
  });
});

describe('applySourceEvidenceIdPatches rejection guards', () => {
  it('rejects duplicate affected records before applying patches', () => {
    const fixture = repairFixture();
    const duplicate = fixture.affectedRecords[0]!;

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: [duplicate, duplicate],
        patches: fixture.patches,
      }),
    ).toThrowError('source_evidence_id_repair_affected_record_duplicate');
  });

  it('rejects an incomplete patch set', () => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [fixture.patches[0]!],
      }),
    ).toThrowError('source_evidence_id_repair_patch_set_incomplete');
  });

  it.each([
    [
      'unexpected patch',
      (fixture: ReturnType<typeof repairFixture>) => [
        fixture.patches[0]!,
        {
          pageNumber: 2,
          beatId: 'beat:not-affected',
          sourceEvidenceId: fixture.pageTwoId,
        },
      ],
    ],
    [
      'duplicate patch',
      (fixture: ReturnType<typeof repairFixture>) => [
        fixture.patches[0]!,
        fixture.patches[0]!,
      ],
    ],
  ])('rejects an %s', (_label, patchFactory) => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: patchFactory(fixture),
      }),
    ).toThrowError(
      'source_evidence_id_repair_patch_unexpected_or_duplicate',
    );
  });

  it('rejects a malformed source evidence ID', () => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [{ ...fixture.patches[0]!, sourceEvidenceId: 'copied phrase' }],
      }),
    ).toThrowError(
      'source_evidence_id_repair_patch_source_evidence_id_malformed',
    );
  });

  it('rejects an unknown source evidence ID', () => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [
          {
            ...fixture.patches[0]!,
            sourceEvidenceId: `se1_${'0'.repeat(64)}`,
          },
        ],
      }),
    ).toThrowError(
      'source_evidence_id_repair_patch_source_evidence_id_unknown',
    );
  });

  it('rejects an ID from a stale source catalog', () => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [
          {
            ...fixture.patches[0]!,
            sourceEvidenceId: fixture.staleId,
          },
        ],
      }),
    ).toThrowError(
      'source_evidence_id_repair_patch_source_evidence_id_unknown',
    );
  });

  it('rejects an ID that belongs to a different page', () => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [
          {
            ...fixture.patches[0]!,
            sourceEvidenceId: fixture.pageTwoId,
          },
        ],
      }),
    ).toThrowError(
      'source_evidence_id_repair_patch_source_evidence_id_wrong_page',
    );
  });

  it.each([
    ['missing page', []],
    [
      'duplicate page',
      [
        {
          pageNumber: 1,
          actionSemanticCoverage: [
            { beatId: 'beat:page-one', sourceEvidenceId: 'old' },
          ],
        },
        {
          pageNumber: 1,
          actionSemanticCoverage: [
            { beatId: 'beat:page-one', sourceEvidenceId: 'old' },
          ],
        },
      ],
    ],
  ])('rejects a non-unique target page: %s', (_label, pageContracts) => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: { pageContracts },
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [fixture.patches[0]!],
      }),
    ).toThrowError('source_evidence_id_repair_page_not_unique');
  });

  it.each([
    ['missing beat', []],
    [
      'duplicate beat',
      [
        { beatId: 'beat:page-one', sourceEvidenceId: 'old-one' },
        { beatId: 'beat:page-one', sourceEvidenceId: 'old-two' },
      ],
    ],
  ])('rejects a non-unique target beat: %s', (_label, coverage) => {
    const fixture = repairFixture();

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: {
          pageContracts: [
            { pageNumber: 1, actionSemanticCoverage: coverage },
          ],
        },
        catalog: fixture.catalog,
        affectedRecords: [fixture.affectedRecords[0]!],
        patches: [fixture.patches[0]!],
      }),
    ).toThrowError('source_evidence_id_repair_beat_not_unique');
  });

  it('applies one exact patch per affected record without mutating the input', () => {
    const fixture = repairFixture();
    const result = applySourceEvidenceIdPatches({
      draft: fixture.draft,
      catalog: fixture.catalog,
      affectedRecords: fixture.affectedRecords,
      patches: fixture.patches,
    });

    expect(result).toMatchObject({
      pageContracts: [
        {
          actionSemanticCoverage: [
            { sourceEvidenceId: fixture.pageOneId },
          ],
        },
        {
          actionSemanticCoverage: [
            { sourceEvidenceId: fixture.pageTwoId },
          ],
        },
      ],
    });
    expect(fixture.draft.pageContracts[0]!.actionSemanticCoverage[0]!
      .sourceEvidenceId).toBe(`se1_${'f'.repeat(64)}`);
  });
});
