import { describe, expect, it } from 'vitest';

import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_PROMPT_VERSION,
  BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
  applyBookSurfaceRepairPatch,
  bookSurfaceRepairAuthority,
  buildBookSurfaceRepairSystemPrompt,
  buildBookSurfaceRepairUserPrompt,
  decodeBookSurfaceRepairUserPrompt,
  parseBookSurfaceRepairPatch,
} from '@/lib/visual-contract-compiler/bookSurfaceRepair';
import type { PresentationRequirementRepairTarget } from '@/lib/visual-contract-compiler/presentationRequirementRepair';

function cover() {
  return {
    worldType: 'grounded',
    locationId: 'loc:home',
    zoneId: 'zone:1',
    castIds: ['child:hero', 'companion:fox'],
    timeOfDay: 'morning',
    mustShow: ['hero and fox beside the cake'],
    mustNotShow: ['unsafe'],
  };
}

function recurringProp() {
  return {
    id: 'prop:cake',
    name: 'delivery cake',
    description: 'three-tier cake kept stable by gentle motion',
    material: 'cake',
    scale: 'child-height',
    persistence: 'persists after reveal',
    firstRevealPage: 1,
  };
}

function page(pageNumber: number) {
  return {
    pageNumber,
    locationId: 'loc:home',
    zoneId: `zone:${pageNumber}`,
    sameLocationAs: null,
    mustShow: [`page ${pageNumber} visible beat`],
    mustNotShow: [],
    propState: [],
    propConstraints: [],
    actionRequirements: [],
    actionSemanticCoverage: [
      {
        beatId: `beat:p${pageNumber}:test`,
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        disposition: {
          kind: 'unsupported',
          reason: 'closed_action_catalog_gap',
        },
      },
    ],
    camera: 'portrait medium shot',
    transition: {
      kind: 'steady',
      fromZoneId: null,
      toZoneId: null,
      cue: null,
    },
  };
}

function draft(): Record<string, unknown> {
  return {
    worldType: 'grounded',
    locations: [{ id: 'loc:home' }],
    zones: [
      {
        id: 'zone:1',
        locationId: 'loc:home',
        spatialNodes: [{ id: 'node:one' }],
      },
      {
        id: 'zone:2',
        locationId: 'loc:home',
        spatialNodes: [{ id: 'node:two' }],
      },
      {
        id: 'zone:3',
        locationId: 'loc:home',
        spatialNodes: [{ id: 'node:three' }],
      },
    ],
    cast: {
      child: { id: 'child:hero' },
      companion: { id: 'companion:fox' },
    },
    humanCast: [{ id: 'human:parent' }],
    recurringProps: [recurringProp()],
    coverContract: cover(),
    pageContracts: [page(1), page(2), page(3)],
    unrelatedStorySource: 'RAW_STORY_SOURCE_SENTINEL',
    providerMaterial: 'PROVIDER_RESPONSE_SENTINEL',
    credential: 'SECRET_CREDENTIAL_SENTINEL',
    executable: 'powershell REMOVE_SENTINEL',
  };
}

function presentationTarget(
  pageNumber: number,
): PresentationRequirementRepairTarget {
  return {
    pageNumber,
    coverageIndex: 0,
    beatId: `beat:p${pageNumber}:test`,
    sourceEvidenceId: `se1_${'a'.repeat(64)}`,
    sourcePhrase: `source phrase page ${pageNumber}`,
    permittedPointerValues: [
      {
        contractPointer: `/pageContracts/${pageNumber - 1}/mustShow/0`,
        contractValue: `page ${pageNumber} visible beat`,
      },
    ],
  };
}

const coverProjectionIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'cover_projection_invalid',
  locator: { kind: 'cover', fieldRole: 'final_structure' },
};

const coverWorldTypeIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'cover_projection_invalid',
  locator: { kind: 'cover', fieldRole: 'world_type' },
};

const coverStructureIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: { kind: 'cover', fieldRole: 'final_structure' },
};

const recurringPropLifecycleIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'lifecycle_invariant_invalid',
  locator: {
    kind: 'collection',
    collectionRole: 'recurring_props',
    fieldRole: 'lifecycle',
  },
};

function pageStructureIssue(pageNumber: number): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'page',
      fieldRole: 'final_structure',
      pageNumber,
    },
  };
}

function authority(value = draft()) {
  const issues = [
    coverProjectionIssue,
    coverStructureIssue,
    pageStructureIssue(1),
  ];
  return bookSurfaceRepairAuthority({
    draft: value,
    authorityDraft: value,
    presentationTargets: [presentationTarget(1), presentationTarget(2)],
    structuralDiagnosticIssues: issues,
    structuralValidationMessages: issues.map(
      (issue, index) => `${issue.code}: sanitized validation ${index}`,
    ),
  });
}

function repairedPage(pageNumber: number) {
  const value = page(pageNumber);
  value.actionSemanticCoverage[0]!.disposition = {
    kind: 'presentation_requirement',
    presentationClass: 'static_state',
    contractPointer: `/pageContracts/${pageNumber - 1}/mustShow/0`,
    contractValue: `page ${pageNumber} visible beat`,
  } as never;
  value.camera = `repaired page ${pageNumber}`;
  return value;
}

describe('bounded book-surface repair', () => {
  it('selects only the cover and exact union of structural and presentation pages', () => {
    const selected = authority();
    expect(selected?.coverContract).toEqual(cover());
    expect(selected?.recurringProps).toEqual([recurringProp()]);
    expect(selected?.repairRecurringProps).toBe(false);
    expect(selected?.affectedPages.map((value) => value.pageNumber)).toEqual([
      1,
      2,
    ]);
    expect(selected?.referenceAuthority).toEqual({
      worldType: 'grounded',
      recurringPropIds: ['prop:cake'],
      locationIds: ['loc:home'],
      zones: [
        { id: 'zone:1', locationId: 'loc:home' },
        { id: 'zone:2', locationId: 'loc:home' },
        { id: 'zone:3', locationId: 'loc:home' },
      ],
      castIds: ['child:hero', 'companion:fox', 'human:parent'],
      spatialReferenceIdsByZone: [
        { zoneId: 'zone:1', spatialReferenceIds: ['node:one'] },
        { zoneId: 'zone:2', spatialReferenceIds: ['node:two'] },
        { zoneId: 'zone:3', spatialReferenceIds: ['node:three'] },
      ],
    });
  });

  it('admits only the exact recurring-prop lifecycle identity into the compact surface', () => {
    const value = draft();
    const issues = [
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      pageStructureIssue(1),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [presentationTarget(1)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: issues.map(
        (issue, index) => `${issue.code}: live shape ${index}`,
      ),
    });

    expect(selected?.repairRecurringProps).toBe(true);
    expect(selected?.recurringProps).toEqual([recurringProp()]);

    for (const locator of [
      {
        kind: 'collection',
        collectionRole: 'locations',
        fieldRole: 'lifecycle',
      },
      {
        kind: 'collection',
        collectionRole: 'recurring_props',
        fieldRole: 'final_structure',
      },
      {
        kind: 'collection_item',
        collectionRole: 'recurring_props',
        fieldRole: 'lifecycle',
        itemIndex: 0,
      },
    ] as const) {
      expect(
        bookSurfaceRepairAuthority({
          draft: value,
          authorityDraft: value,
          presentationTargets: [presentationTarget(1)],
          structuralDiagnosticIssues: [
            coverProjectionIssue,
            pageStructureIssue(1),
            {
              family: 'draft_contract',
              code: 'lifecycle_invariant_invalid',
              locator,
            } as DraftValidationIssue,
          ],
          structuralValidationMessages: ['cover', 'page', 'lifecycle'],
        }),
      ).toBeNull();
    }
  });

  it('uses compiler-normalized cover and reference authority while targeting the original draft', () => {
    const providerDraft = draft();
    providerDraft.humanCast = [{ id: 'child:hero' }];
    expect(authority(providerDraft)).toBeNull();

    const issues = [coverProjectionIssue, pageStructureIssue(1)];
    const selected = bookSurfaceRepairAuthority({
      draft: providerDraft,
      authorityDraft: draft(),
      presentationTargets: [presentationTarget(2)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: issues.map(
        (issue, index) => `${issue.code}: normalized authority ${index}`,
      ),
    });

    expect(selected).not.toBeNull();
    expect(selected?.coverContract).toEqual(cover());
    expect(selected?.affectedPages.map((value) => value.pageNumber)).toEqual([
      1,
      2,
    ]);
  });

  it('accepts every closed cover identity and multiple cover issues without widening the page surface', () => {
    for (const coverIssues of [
      [coverWorldTypeIssue],
      [coverProjectionIssue, coverStructureIssue],
    ]) {
      const issues = [...coverIssues, pageStructureIssue(1)];
      const selected = bookSurfaceRepairAuthority({
        draft: draft(),
        authorityDraft: draft(),
        presentationTargets: [presentationTarget(2)],
        structuralDiagnosticIssues: issues,
        structuralValidationMessages: issues.map(
          (issue, index) => `${issue.code}: sanitized validation ${index}`,
        ),
      });

      expect(selected).not.toBeNull();
      expect(selected?.affectedPages.map((value) => value.pageNumber)).toEqual([
        1,
        2,
      ]);
    }
  });

  it.each([
    ['no presentation target', [], [coverProjectionIssue, pageStructureIssue(1)]],
    ['cover only', [presentationTarget(1)], [coverProjectionIssue]],
    ['page only', [presentationTarget(1)], [pageStructureIssue(1)]],
    [
      'collection mixed in',
      [presentationTarget(1)],
      [
        coverProjectionIssue,
        pageStructureIssue(1),
        {
          family: 'draft_contract',
          code: 'final_structural_invariant_invalid',
          locator: {
            kind: 'collection',
            collectionRole: 'locations',
            fieldRole: 'final_structure',
          },
        } as DraftValidationIssue,
      ],
    ],
    [
      'unrelated cover code',
      [presentationTarget(1)],
      [
        {
          family: 'draft_contract',
          code: 'cover_source_fidelity_invalid',
          locator: { kind: 'cover', fieldRole: 'prose_projection' },
        } as DraftValidationIssue,
        pageStructureIssue(1),
      ],
    ],
  ])('rejects %s outside the closed mixed family', (_label, targets, issues) => {
    expect(
      bookSurfaceRepairAuthority({
        draft: draft(),
        authorityDraft: draft(),
        presentationTargets: targets,
        structuralDiagnosticIssues: issues,
        structuralValidationMessages: issues.map((_, index) => `message ${index}`),
      }),
    ).toBeNull();
  });

  it('rejects ambiguous authority and unsafe or misaligned diagnostics', () => {
    const duplicateCast = draft();
    duplicateCast.humanCast = [{ id: 'child:hero' }];
    expect(authority(duplicateCast)).toBeNull();

    const duplicateNode = draft();
    (duplicateNode.zones as Array<Record<string, unknown>>)[0]!.spatialNodes = [
      { id: 'node:one' },
      { id: 'node:one' },
    ];
    expect(authority(duplicateNode)).toBeNull();

    expect(
      bookSurfaceRepairAuthority({
        draft: draft(),
        authorityDraft: draft(),
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: ['only one'],
      }),
    ).toBeNull();
    expect(
      bookSurfaceRepairAuthority({
        draft: draft(),
        authorityDraft: draft(),
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: [
          'safe',
          'OPENAI_API_KEY=do-not-persist',
        ],
      }),
    ).toBeNull();
  });

  it('uses current member schemas and emits a compact sanitized authority prompt', () => {
    const selected = authority()!;
    const schema = BOOK_SURFACE_REPAIR_JSON_SCHEMA.properties as {
      coverContract: unknown;
      recurringProps: { items: unknown };
      pageContracts: { items: unknown };
    };
    expect(schema.coverContract).toBeTruthy();
    expect(schema.recurringProps.items).toBeTruthy();
    expect(schema.pageContracts.items).toBeTruthy();
    expect(BOOK_SURFACE_REPAIR_PROMPT_VERSION).toBe(
      'book-surface-repair-prompt/v2',
    );
    expect(BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION).toBe(
      'book-surface-repair-user-prompt/v2',
    );
    expect(buildBookSurfaceRepairSystemPrompt()).toContain('ONLY');
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
    });
    const payload = decodeBookSurfaceRepairUserPrompt(rawPrompt);
    expect(payload.coverContract).toEqual(cover());
    expect(payload.recurringProps).toEqual([recurringProp()]);
    expect(payload.repairRecurringProps).toBe(false);
    expect(
      (payload.affectedPages as Array<{ pageNumber: number }>).map(
        (value) => value.pageNumber,
      ),
    ).toEqual([1, 2]);
    const serialized = JSON.stringify(payload);
    for (const sentinel of [
      'RAW_STORY_SOURCE_SENTINEL',
      'PROVIDER_RESPONSE_SENTINEL',
      'SECRET_CREDENTIAL_SENTINEL',
      'REMOVE_SENTINEL',
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it('parses exact output and rejects root, cover, and page drift', () => {
    const valid = JSON.stringify({
      coverContract: cover(),
      recurringProps: [recurringProp()],
      pageContracts: [repairedPage(1), repairedPage(2)],
    });
    expect(parseBookSurfaceRepairPatch(valid).pageContracts).toHaveLength(2);
    expect(() => parseBookSurfaceRepairPatch('not-json')).toThrow(
      'book_surface_repair_response_invalid_json',
    );
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({ ...JSON.parse(valid), extra: true }),
      ),
    ).toThrow('book_surface_repair_response_invalid_shape');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          coverContract: { ...cover(), extra: true },
          recurringProps: [recurringProp()],
          pageContracts: [repairedPage(1)],
        }),
      ),
    ).toThrow('book_surface_repair_cover_invalid');
    const invalidPage = repairedPage(1) as Record<string, unknown>;
    delete invalidPage.camera;
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          coverContract: cover(),
          recurringProps: [recurringProp()],
          pageContracts: [invalidPage],
        }),
      ),
    ).toThrow('book_surface_repair_page_invalid');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          coverContract: cover(),
          recurringProps: [{ ...recurringProp(), extra: true }],
          pageContracts: [repairedPage(1)],
        }),
      ),
    ).toThrow('book_surface_repair_prop_invalid');
  });

  it('applies the exact surface non-mutatingly and preserves every unrelated field', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original)!;
    const repairedCover = {
      ...cover(),
      camera: undefined,
      mustShow: ['hero, fox, and complete cake are visible'],
    } as Record<string, unknown>;
    delete repairedCover.camera;
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        coverContract: repairedCover,
        recurringProps: [recurringProp()],
        pageContracts: [repairedPage(2), repairedPage(1)],
      },
    });
    expect(original).toEqual(snapshot);
    expect(result.coverContract).toEqual(repairedCover);
    expect(
      (result.pageContracts as Array<Record<string, unknown>>).map(
        (value) => value.camera,
      ),
    ).toEqual([
      'repaired page 1',
      'portrait medium shot',
      'portrait medium shot',
    ]);
    expect({
      ...result,
      coverContract: undefined,
      recurringProps: undefined,
      pageContracts: undefined,
    }).toEqual({
      ...snapshot,
      coverContract: undefined,
      recurringProps: undefined,
      pageContracts: undefined,
    });
  });

  it('rejects incomplete, unexpected, duplicate, and invalid-reference patches', () => {
    const original = draft();
    const selected = authority(original)!;
    const apply = (
      patchedCover: Record<string, unknown>,
      pages: Record<string, unknown>[],
      props: Record<string, unknown>[] = [recurringProp()],
    ) =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          coverContract: patchedCover,
          recurringProps: props,
          pageContracts: pages,
        },
      });

    expect(() => apply(cover(), [repairedPage(1)])).toThrow(
      'page_contract_repair_patch_set_incomplete',
    );
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(3)]),
    ).toThrow('page_contract_repair_page_unexpected_or_duplicate');
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(1)]),
    ).toThrow('page_contract_repair_page_unexpected_or_duplicate');
    expect(() =>
      apply(
        { ...cover(), worldType: 'magical' },
        [repairedPage(1), repairedPage(2)],
      ),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      apply(
        { ...cover(), zoneId: 'zone:unknown' },
        [repairedPage(1), repairedPage(2)],
      ),
    ).toThrow('book_surface_repair_cover_reference_invalid');
    expect(() =>
      apply(
        { ...cover(), castIds: ['child:unknown'] },
        [repairedPage(1), repairedPage(2)],
      ),
    ).toThrow('book_surface_repair_cover_reference_invalid');
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(2)], []),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(2)], [
        recurringProp(),
        recurringProp(),
      ]),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(2)], [
        { ...recurringProp(), id: 'prop:other' },
      ]),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      apply(cover(), [repairedPage(1), repairedPage(2)], [
        { ...recurringProp(), persistence: 'changed without authority' },
      ]),
    ).toThrow('book_surface_repair_prop_change_not_authorized');
  });

  it('repairs recurring-prop lifecycle in input order without mutating the draft', () => {
    const original = draft();
    original.recurringProps = [
      recurringProp(),
      {
        ...recurringProp(),
        id: 'prop:cart',
        name: 'delivery cart',
        description: 'cart carrying the cake',
      },
    ];
    const snapshot = structuredClone(original);
    const issues = [
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      pageStructureIssue(1),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [presentationTarget(1)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: issues.map(
        (issue) => `${issue.code}: repair required`,
      ),
    })!;
    const repairedProps = [
      {
        ...(original.recurringProps as Record<string, unknown>[])[1]!,
        persistence: 'persists after page 1 reveal',
      },
      {
        ...(original.recurringProps as Record<string, unknown>[])[0]!,
        persistence: 'persists after page 1 reveal',
      },
    ];
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        coverContract: cover(),
        recurringProps: repairedProps,
        pageContracts: [repairedPage(1)],
      },
    });

    expect(original).toEqual(snapshot);
    expect(
      (result.recurringProps as Record<string, unknown>[]).map(
        (value) => value.id,
      ),
    ).toEqual(['prop:cake', 'prop:cart']);
    expect(
      (result.recurringProps as Record<string, unknown>[]).map(
        (value) => value.persistence,
      ),
    ).toEqual([
      'persists after page 1 reveal',
      'persists after page 1 reveal',
    ]);
  });
});
