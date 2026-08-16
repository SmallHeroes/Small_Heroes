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
import {
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
  visualContractAuthoringInputAccounting,
  visualContractAuthoringRouteIsAdmissible,
} from '@/lib/visual-contract-compiler/authoringPolicy';

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
    expect(selected?.coverValidationHints).toEqual([
      'cover_projection_invalid: sanitized validation 0',
      'final_structural_invariant_invalid: sanitized validation 1',
    ]);
    expect(selected?.recurringPropValidationHints).toEqual([]);
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
      'book-surface-repair-prompt/v3',
    );
    expect(BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION).toBe(
      'book-surface-repair-user-prompt/v3',
    );
    expect(buildBookSurfaceRepairSystemPrompt()).toContain('ONLY');
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
    });
    const payload = decodeBookSurfaceRepairUserPrompt(rawPrompt);
    expect(payload.coverContract).toEqual(cover());
    expect(payload.recurringProps).toEqual([recurringProp()]);
    expect(payload.repairRecurringProps).toBe(false);
    expect(payload.coverValidationHints).toEqual(
      selected.coverValidationHints,
    );
    expect(payload.recurringPropValidationHints).toEqual([]);
    expect(payload).not.toHaveProperty('validationMessages');
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

  it('partitions and deduplicates validation hints without repeating page hints globally', () => {
    const value = draft();
    const issues = [
      coverProjectionIssue,
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      recurringPropLifecycleIssue,
      pageStructureIssue(1),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [presentationTarget(1)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: [
        'cover needs repair',
        '  cover   needs repair  ',
        'recurring props need lifecycle repair',
        'recurring props need lifecycle repair',
        'page 1 final structure needs repair',
      ],
    });

    expect(selected).not.toBeNull();
    expect(selected?.coverValidationHints).toEqual([
      'cover needs repair',
    ]);
    expect(selected?.recurringPropValidationHints).toEqual([
      'recurring props need lifecycle repair',
    ]);
    expect(selected?.affectedPages[0]?.validationHints).toEqual([
      'closed_catalog_capability_gap: actionSemanticCoverage[0] must become one same-page presentation_requirement using one exact permitted pointer/value',
      'page 1 final structure needs repair',
    ]);
    const payload = decodeBookSurfaceRepairUserPrompt(
      buildBookSurfaceRepairUserPrompt({ authority: selected! }),
    );
    const serialized = JSON.stringify(payload);
    expect(serialized.match(/page 1 final structure needs repair/g)).toHaveLength(
      1,
    );
    expect(serialized.match(/closed_catalog_capability_gap/g)).toHaveLength(2);
  });

  it('uses codepoint ordering for digest-stable validation hints', () => {
    const issues = [
      coverProjectionIssue,
      coverStructureIssue,
      coverProjectionIssue,
      pageStructureIssue(1),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: draft(),
      authorityDraft: draft(),
      presentationTargets: [presentationTarget(1)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: [
        'page 2 hint',
        '_leading underscore',
        'Page 10 hint',
        'page structure',
      ],
    });

    expect(selected?.coverValidationHints).toEqual([
      'Page 10 hint',
      '_leading underscore',
      'page 2 hint',
    ]);
  });

  it('enforces one aggregate 128-item bound across cover, recurring-prop, and page hints', () => {
    const value = draft();
    const pageOne = (value.pageContracts as ReturnType<typeof page>[])[0]!;
    pageOne.actionSemanticCoverage = Array.from(
      { length: 127 },
      (_, coverageIndex) => ({
        beatId: `beat:p1:coverage_${coverageIndex}`,
        sourceEvidenceId: `se1_${String(coverageIndex).padStart(64, 'b')}`,
        disposition: {
          kind: 'unsupported',
          reason: 'closed_action_catalog_gap',
        },
      }),
    );
    const targets = pageOne.actionSemanticCoverage.map(
      (coverage, coverageIndex) => ({
        pageNumber: 1,
        coverageIndex,
        beatId: coverage.beatId,
        sourceEvidenceId: coverage.sourceEvidenceId,
        sourcePhrase: `sanitized phrase ${coverageIndex}`,
        permittedPointerValues: [
          {
            contractPointer: '/pageContracts/0/mustShow/0',
            contractValue: pageOne.mustShow[0]!,
          },
        ],
      }),
    );

    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: targets,
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: [
          'cover validation',
          'page validation',
        ],
      }),
    ).toBeNull();
  });

  it('measures a production-built twelve-page surface and rejects the compact route when it lacks safety margin', () => {
    const value = draft();
    value.zones = Array.from({ length: 12 }, (_, index) => ({
      id: `zone:${index + 1}`,
      locationId: 'loc:home',
      spatialNodes: [{ id: `node:${index + 1}` }],
    }));
    value.pageContracts = Array.from({ length: 12 }, (_, index) => {
      const pageContract = page(index + 1);
      pageContract.mustShow = [
        `page ${index + 1} ${String.fromCharCode(97 + index).repeat(5_000)}`,
      ];
      const targetCount = index < 8 ? 2 : 1;
      pageContract.actionSemanticCoverage = Array.from(
        { length: targetCount },
        (_, coverageIndex) => ({
          beatId: `beat:p${index + 1}:coverage_${coverageIndex}`,
          sourceEvidenceId: `se1_${String(index * 10 + coverageIndex).padStart(64, 'a')}`,
          disposition: {
            kind: 'unsupported',
            reason: 'closed_action_catalog_gap',
          },
        }),
      );
      return pageContract;
    });
    const presentationTargets = (
      value.pageContracts as ReturnType<typeof page>[]
    ).flatMap((pageContract) =>
      pageContract.actionSemanticCoverage.map(
        (coverage, coverageIndex) => ({
          pageNumber: pageContract.pageNumber,
          coverageIndex,
          beatId: coverage.beatId,
          sourceEvidenceId: coverage.sourceEvidenceId,
          sourcePhrase: `sanitized source phrase ${pageContract.pageNumber} ${coverageIndex}`,
          permittedPointerValues: [
            {
              contractPointer: `/pageContracts/${pageContract.pageNumber - 1}/mustShow/0`,
              contractValue: pageContract.mustShow[0]!,
            },
          ],
        }),
      ),
    );
    const issues = [
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      ...Array.from({ length: 12 }, (_, index) =>
        pageStructureIssue(index + 1),
      ),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets,
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: issues.map(
        (issue, index) =>
          `${issue.code}: sanitized production-shaped validation ${index}`,
      ),
    });
    expect(selected).not.toBeNull();

    const systemPrompt = buildBookSurfaceRepairSystemPrompt();
    const userPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected!,
    });
    const accounting = visualContractAuthoringInputAccounting(
      systemPrompt,
      userPrompt,
      BOOK_SURFACE_REPAIR_JSON_SCHEMA,
    );

    expect(
      decodeBookSurfaceRepairUserPrompt(userPrompt).affectedPages,
    ).toHaveLength(12);
    expect(presentationTargets).toHaveLength(20);
    expect(accounting.estimatedBytes).toBeGreaterThan(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS -
        VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
    );
    expect(
      visualContractAuthoringRouteIsAdmissible({
        systemPrompt,
        userPrompt,
        schema: BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      }),
    ).toBe(false);
    expect(userPrompt).not.toMatch(
      /RAW_STORY_SOURCE_SENTINEL|PROVIDER_RESPONSE_SENTINEL|SECRET_CREDENTIAL_SENTINEL|OPENAI_API_KEY|Bearer\s+/,
    );
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
