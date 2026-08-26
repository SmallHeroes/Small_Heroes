import { describe, expect, it } from 'vitest';

import { buildSourceEvidenceCatalog } from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import {
  applySourceEvidenceIdPatches,
  parseSourceEvidenceIdPatches,
  sourceEvidenceIdRepairAffectedRecordsAreClosed,
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

function phenomenonActionRepairFixture() {
  const fixture = repairFixture();
  const oldSourceEvidenceId = `se1_${'f'.repeat(64)}`;
  const beatId = 'beat:p1:phenomenon_contact';
  const action = {
    beatId,
    subject: {
      kind: 'source_phenomenon',
      sourceEvidenceId: oldSourceEvidenceId,
    },
    predicate: 'touches',
    object: { kind: 'cast', id: 'child:hero' },
    spatialEffect: null,
    polarity: 'must',
    laterality: null,
  };
  const coverageRecord = {
    beatId,
    sourceEvidenceId: oldSourceEvidenceId,
    disposition: {
      kind: 'action_requirement',
    },
  };
  const draft = {
    pageContracts: [
      {
        pageNumber: 1,
        actionSemanticCoverage: [coverageRecord],
        actionRequirements: [action],
      },
    ],
  };
  const affectedRecords: SourceEvidenceIdRepairAffectedRecord[] = [
    {
      pageNumber: 1,
      coverageIndex: 0,
      beatId,
      failureCode: 'source_evidence_id_unknown',
      coverageRecord,
      actionRequirement: action,
    },
  ];
  return {
    action,
    affectedRecords,
    catalog: fixture.catalog,
    draft,
    patch: {
      ...fixture.patches[0]!,
      beatId,
    },
  };
}

function continuityRepairFixture(
  kind: 'companion' | 'wardrobe',
) {
  const fixture = repairFixture();
  const oldSourceEvidenceId = `se1_${'f'.repeat(64)}`;
  const beatId = `beat:p1:${kind}_shift`;
  const contractValue =
    kind === 'companion' ? 'alert_olive_shift' : 'green pajamas';
  const contractPointer =
    kind === 'companion'
      ? '/pageContracts/0/companionStateOverride/stateId'
      : '/pageContracts/0/childWardrobeOverride/description';
  const disposition = {
    kind: 'represented_elsewhere',
    contractPointer,
    contractValue,
  };
  const coverageRecord = {
    beatId,
    sourceEvidenceId: oldSourceEvidenceId,
    disposition,
  };
  const page = {
    pageNumber: 1,
    ...(kind === 'companion'
      ? {
          companionStateId: contractValue,
          companionStateSourceEvidenceId: oldSourceEvidenceId,
        }
      : {
          childWardrobeOverrideDescription: contractValue,
          childWardrobeOverrideSourceEvidenceId: oldSourceEvidenceId,
        }),
    actionSemanticCoverage: [coverageRecord],
    actionRequirements: [],
  };
  const affectedRecords: SourceEvidenceIdRepairAffectedRecord[] = [{
    pageNumber: 1,
    coverageIndex: 0,
    beatId,
    failureCode: 'source_evidence_id_unknown',
    coverageRecord: structuredClone(coverageRecord),
    actionRequirement: null,
  }];
  return {
    affectedRecords,
    catalog: fixture.catalog,
    draft: { pageContracts: [page] },
    page,
    patch: {
      pageNumber: 1,
      beatId,
      sourceEvidenceId: fixture.pageOneId,
    },
  };
}

function closedAuthorityFixture(args?: {
  failureCode?: SourceEvidenceIdRepairAffectedRecord['failureCode'];
  actionRequirement?: boolean;
}) {
  const fixture = repairFixture();
  const failureCode = args?.failureCode ?? 'source_evidence_id_unknown';
  const sourceEvidenceId =
    failureCode === 'source_evidence_id_malformed'
      ? 'malformed-source-evidence'
      : failureCode === 'source_evidence_id_wrong_page'
        ? fixture.pageTwoId
        : `se1_${'f'.repeat(64)}`;
  const beatId = 'beat:page-one';
  const disposition = args?.actionRequirement
    ? { kind: 'action_requirement' }
    : { kind: 'non_visual', rationale: 'narrative_context' };
  const action = args?.actionRequirement
    ? {
        beatId,
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId,
        },
        predicate: 'touches',
        object: { kind: 'cast', id: 'child:hero' },
        spatialEffect: null,
        polarity: 'must',
        laterality: null,
      }
    : null;
  const coverageRecord = {
    beatId,
    sourceEvidenceId,
    disposition,
  };
  const draft = {
    pageContracts: [{
      pageNumber: 1,
      actionSemanticCoverage: [coverageRecord],
      actionRequirements: action ? [action] : [],
    }],
  };
  const affectedRecords: SourceEvidenceIdRepairAffectedRecord[] = [{
    pageNumber: 1,
    coverageIndex: 0,
    beatId,
    failureCode,
    coverageRecord: structuredClone(coverageRecord),
    actionRequirement: action ? structuredClone(action) : null,
  }];
  return {
    affectedRecords,
    catalog: fixture.catalog,
    draft,
  };
}

describe('sourceEvidenceIdRepairAffectedRecordsAreClosed', () => {
  it.each([
    'source_evidence_id_malformed',
    'source_evidence_id_unknown',
    'source_evidence_id_wrong_page',
  ] as const)('admits one exact current %s record', (failureCode) => {
    const fixture = closedAuthorityFixture({ failureCode });

    expect(sourceEvidenceIdRepairAffectedRecordsAreClosed(fixture)).toBe(true);
  });

  it('admits one exact action-bound phenomenon record', () => {
    const fixture = closedAuthorityFixture({ actionRequirement: true });

    expect(sourceEvidenceIdRepairAffectedRecordsAreClosed(fixture)).toBe(true);
  });

  it.each(['companion', 'wardrobe'] as const)(
    'admits an exact compiler-bound %s continuity association',
    (kind) => {
      const fixture = continuityRepairFixture(kind);

      expect(sourceEvidenceIdRepairAffectedRecordsAreClosed(fixture)).toBe(
        true,
      );
    },
  );

  it.each([
    ['empty affected set', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.affectedRecords = [];
    }],
    ['duplicate authority key', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.affectedRecords.push(structuredClone(fixture.affectedRecords[0]!));
    }],
    ['stale coverage index', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.affectedRecords[0]!.coverageIndex = 1;
    }],
    ['stale beat identity', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.affectedRecords[0]!.beatId = 'beat:stale';
    }],
    ['stale source identity', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.affectedRecords[0]!.coverageRecord.sourceEvidenceId = `se1_${'e'.repeat(64)}`;
    }],
    ['missing same-page catalog authority', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.catalog.entries = fixture.catalog.entries.filter(
        (entry) => entry.pageNumber !== 1,
      );
    }],
    ['duplicate current page', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.draft.pageContracts.push(structuredClone(fixture.draft.pageContracts[0]!));
    }],
    ['duplicate current beat', (fixture: ReturnType<typeof closedAuthorityFixture>) => {
      fixture.draft.pageContracts[0]!.actionSemanticCoverage.push(
        structuredClone(fixture.draft.pageContracts[0]!.actionSemanticCoverage[0]!),
      );
    }],
  ])('rejects %s', (_label, mutate) => {
    const fixture = closedAuthorityFixture();
    mutate(fixture);

    expect(sourceEvidenceIdRepairAffectedRecordsAreClosed(fixture)).toBe(false);
  });

  it.each([
    ['missing action', []],
    ['duplicate action', null],
  ])('rejects an action-bound record with %s', (_label, actions) => {
    const fixture = closedAuthorityFixture({ actionRequirement: true });
    const current = fixture.draft.pageContracts[0]!.actionRequirements;
    fixture.draft.pageContracts[0]!.actionRequirements =
      actions ?? [current[0]!, structuredClone(current[0]!)];

    expect(sourceEvidenceIdRepairAffectedRecordsAreClosed(fixture)).toBe(false);
  });
});

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

  it('rejects a bound action requirement with zero matching beat IDs', () => {
    const fixture = phenomenonActionRepairFixture();
    fixture.draft.pageContracts[0]!.actionRequirements = [];

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [fixture.patch],
      }),
    ).toThrowError('source_evidence_id_repair_action_not_unique');
  });

  it('rejects a bound action requirement with two matching beat IDs', () => {
    const fixture = phenomenonActionRepairFixture();
    fixture.draft.pageContracts[0]!.actionRequirements = [
      fixture.action,
      structuredClone(fixture.action),
    ];

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [fixture.patch],
      }),
    ).toThrowError('source_evidence_id_repair_action_not_unique');
  });

  it('updates only coverage and phenomenon-subject evidence IDs without mutating input', () => {
    const fixture = phenomenonActionRepairFixture();
    const inputBefore = structuredClone(fixture.draft);
    const expected = structuredClone(inputBefore);
    expected.pageContracts[0]!.actionSemanticCoverage[0]!.sourceEvidenceId =
      fixture.patch.sourceEvidenceId;
    expected.pageContracts[0]!.actionRequirements[0]!.subject.sourceEvidenceId =
      fixture.patch.sourceEvidenceId;

    const result = applySourceEvidenceIdPatches({
      draft: fixture.draft,
      catalog: fixture.catalog,
      affectedRecords: fixture.affectedRecords,
      patches: [fixture.patch],
    });

    expect(result).toEqual(expected);
    expect(expected.pageContracts[0]!.actionRequirements[0]).toEqual({
      ...fixture.action,
      subject: {
        ...fixture.action.subject,
        sourceEvidenceId: fixture.patch.sourceEvidenceId,
      },
    });
    expect(fixture.draft).toEqual(inputBefore);
  });

  it.each([
    ['companion', 'companionStateSourceEvidenceId'],
    ['wardrobe', 'childWardrobeOverrideSourceEvidenceId'],
  ] as const)(
    'atomically propagates a validated %s continuity evidence binding',
    (kind, selectorField) => {
      const fixture = continuityRepairFixture(kind);
      const before = structuredClone(fixture.draft);

      const result = applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [fixture.patch],
      });
      const resultPage = (
        result.pageContracts as Array<Record<string, unknown>>
      )[0]!;

      expect(resultPage.actionSemanticCoverage).toMatchObject([
        { sourceEvidenceId: fixture.patch.sourceEvidenceId },
      ]);
      expect(resultPage[selectorField]).toBe(
        fixture.patch.sourceEvidenceId,
      );
      expect(fixture.draft).toEqual(before);
    },
  );

  it.each([
    [
      'selector old ID differs from coverage',
      (fixture: ReturnType<typeof continuityRepairFixture>) => {
        (fixture.page as Record<string, unknown>)
          .companionStateSourceEvidenceId =
          `se1_${'e'.repeat(64)}`;
      },
    ],
    [
      'contract value differs from the raw selector value',
      (fixture: ReturnType<typeof continuityRepairFixture>) => {
        (fixture.page as Record<string, unknown>).companionStateId =
          'different_state';
      },
    ],
    [
      'affected disposition is stale',
      (fixture: ReturnType<typeof continuityRepairFixture>) => {
        fixture.affectedRecords[0]!.coverageRecord.disposition = {
          kind: 'represented_elsewhere',
          contractPointer:
            '/pageContracts/0/companionStateOverride/stateId',
          contractValue: 'stale_state',
        };
      },
    ],
    [
      'canonical disposition has an extra key',
      (fixture: ReturnType<typeof continuityRepairFixture>) => {
        (
          fixture.page.actionSemanticCoverage[0]!.disposition as
            Record<string, unknown>
        ).extra = true;
      },
    ],
    [
      'pointer targets another page index',
      (fixture: ReturnType<typeof continuityRepairFixture>) => {
        (
          fixture.page.actionSemanticCoverage[0]!.disposition as
            Record<string, unknown>
        ).contractPointer =
          '/pageContracts/1/companionStateOverride/stateId';
      },
    ],
  ])(
    'patches coverage but does not borrow continuity authority when %s',
    (_label, mutate) => {
      const fixture = continuityRepairFixture('companion');
      mutate(fixture);
      const selectorBefore =
        (fixture.page as Record<string, unknown>)
          .companionStateSourceEvidenceId;

      const result = applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [fixture.patch],
      });
      const resultPage = (
        result.pageContracts as Array<Record<string, unknown>>
      )[0]!;

      expect(resultPage.actionSemanticCoverage).toMatchObject([
        { sourceEvidenceId: fixture.patch.sourceEvidenceId },
      ]);
      expect(resultPage.companionStateSourceEvidenceId).toBe(
        selectorBefore,
      );
    },
  );

  it('fails closed before returning when two repairs select different IDs for one continuity binding', () => {
    const fixture = continuityRepairFixture('companion');
    const secondBeatId = 'beat:p1:companion_shift_two';
    const secondCoverage = {
      ...structuredClone(fixture.page.actionSemanticCoverage[0]!),
      beatId: secondBeatId,
    };
    fixture.page.actionSemanticCoverage.push(secondCoverage);
    fixture.affectedRecords.push({
      ...structuredClone(fixture.affectedRecords[0]!),
      coverageIndex: 1,
      beatId: secondBeatId,
      coverageRecord: structuredClone(secondCoverage),
    });
    const alternativeId = `se1_${'a'.repeat(64)}`;
    fixture.catalog.entries.push({
      ...structuredClone(fixture.catalog.entries[0]!),
      sourceEvidenceId: alternativeId,
    });
    const inputBefore = structuredClone(fixture.draft);

    expect(() =>
      applySourceEvidenceIdPatches({
        draft: fixture.draft,
        catalog: fixture.catalog,
        affectedRecords: fixture.affectedRecords,
        patches: [
          fixture.patch,
          {
            pageNumber: 1,
            beatId: secondBeatId,
            sourceEvidenceId: alternativeId,
          },
        ],
      }),
    ).toThrowError(
      'source_evidence_id_repair_continuity_binding_conflict',
    );
    expect(fixture.draft).toEqual(inputBefore);
  });

  it('coalesces same-selector same-ID continuity repairs independent of patch order', () => {
    const fixture = continuityRepairFixture('companion');
    const secondBeatId = 'beat:p1:companion_shift_two';
    const secondCoverage = {
      ...structuredClone(fixture.page.actionSemanticCoverage[0]!),
      beatId: secondBeatId,
    };
    fixture.page.actionSemanticCoverage.push(secondCoverage);
    fixture.affectedRecords.push({
      ...structuredClone(fixture.affectedRecords[0]!),
      coverageIndex: 1,
      beatId: secondBeatId,
      coverageRecord: structuredClone(secondCoverage),
    });
    const secondPatch = {
      ...fixture.patch,
      beatId: secondBeatId,
    };
    const inputBefore = structuredClone(fixture.draft);

    const forward = applySourceEvidenceIdPatches({
      draft: fixture.draft,
      catalog: fixture.catalog,
      affectedRecords: fixture.affectedRecords,
      patches: [fixture.patch, secondPatch],
    });
    const reverse = applySourceEvidenceIdPatches({
      draft: fixture.draft,
      catalog: fixture.catalog,
      affectedRecords: fixture.affectedRecords,
      patches: [secondPatch, fixture.patch],
    });

    expect(forward).toEqual(reverse);
    expect(forward).toMatchObject({
      pageContracts: [{
        companionStateSourceEvidenceId:
          fixture.patch.sourceEvidenceId,
        actionSemanticCoverage: [
          { sourceEvidenceId: fixture.patch.sourceEvidenceId },
          { sourceEvidenceId: fixture.patch.sourceEvidenceId },
        ],
        actionRequirements: [],
      }],
    });
    expect(fixture.draft).toEqual(inputBefore);
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
