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
    recurringProps: [{ id: 'prop:cake' }],
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

const coverStructureIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: { kind: 'cover', fieldRole: 'final_structure' },
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
      pageContracts: { items: unknown };
    };
    expect(schema.coverContract).toBeTruthy();
    expect(schema.pageContracts.items).toBeTruthy();
    expect(BOOK_SURFACE_REPAIR_PROMPT_VERSION).toBe(
      'book-surface-repair-prompt/v1',
    );
    expect(BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION).toBe(
      'book-surface-repair-user-prompt/v1',
    );
    expect(buildBookSurfaceRepairSystemPrompt()).toContain('ONLY');
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
    });
    const payload = decodeBookSurfaceRepairUserPrompt(rawPrompt);
    expect(payload.coverContract).toEqual(cover());
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
          pageContracts: [invalidPage],
        }),
      ),
    ).toThrow('book_surface_repair_page_invalid');
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
        pageContracts: [repairedPage(2), repairedPage(1)],
      },
    });
    expect(original).toEqual(snapshot);
    expect(result.coverContract).toEqual(repairedCover);
    expect(
      (result.pageContracts as Array<Record<string, unknown>>).map(
        (value) => value.camera,
      ),
    ).toEqual(['repaired page 1', 'repaired page 2', 'portrait medium shot']);
    expect({
      ...result,
      coverContract: undefined,
      pageContracts: undefined,
    }).toEqual({
      ...snapshot,
      coverContract: undefined,
      pageContracts: undefined,
    });
  });

  it('rejects incomplete, unexpected, duplicate, and invalid-reference patches', () => {
    const original = draft();
    const selected = authority(original)!;
    const apply = (
      patchedCover: Record<string, unknown>,
      pages: Record<string, unknown>[],
    ) =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: { coverContract: patchedCover, pageContracts: pages },
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
  });
});
