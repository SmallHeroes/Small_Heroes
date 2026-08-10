import { describe, expect, it } from 'vitest';

import type { DraftValidationIssue } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
  STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
  STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION,
  applyStructuralBundleRepairPatch,
  buildStructuralBundleRepairSystemPrompt,
  buildStructuralBundleRepairUserPrompt,
  decodeStructuralBundleRepairUserPrompt,
  parseStructuralBundleRepairPatch,
  structuralBundleRepairAuthority,
} from '@/lib/visual-contract-compiler/structuralBundleRepair';

function prop(id: string, name = id) {
  return {
    id,
    name,
    description: `${name} description`,
    material: null,
    scale: null,
    persistence: null,
    firstRevealPage: null,
  };
}

function page(pageNumber: number) {
  return {
    pageNumber,
    locationId: 'loc:home',
    zoneId: `zone:${pageNumber}`,
    sameLocationAs: null,
    mustShow: [`page ${pageNumber}`],
    mustNotShow: [],
    propState: [],
    propConstraints: [],
    actionRequirements: [],
    actionSemanticCoverage: [
      {
        beatId: `beat:p${pageNumber}:test`,
        sourceEvidenceId: `se${pageNumber}_${'a'.repeat(64)}`,
        disposition: {
          kind: 'non_visual',
          rationale: 'narrative_context',
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
    recurringProps: [prop('prop:bucket'), prop('prop:book')],
    forbiddenGlobalElements: ['unsafe'],
    coverContract: { marker: 'preserved' },
    pageContracts: [page(1), page(2), page(3)],
    unrelatedStorySource: 'RAW_STORY_SOURCE_SENTINEL',
    providerMaterial: 'PROVIDER_RESPONSE_SENTINEL',
    credential: 'SECRET_CREDENTIAL_SENTINEL',
    executable: 'powershell REMOVE_SENTINEL',
  };
}

const collectionIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: {
    kind: 'collection',
    collectionRole: 'recurring_props',
    fieldRole: 'final_structure',
  },
};

function pageIssue(pageNumber: number): DraftValidationIssue {
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

function authority(
  value = draft(),
  issues: DraftValidationIssue[] = [
    collectionIssue,
    collectionIssue,
    pageIssue(2),
    pageIssue(1),
    pageIssue(1),
  ],
) {
  return structuralBundleRepairAuthority({
    draft: value,
    diagnosticIssues: issues,
    validationMessages: issues.map(
      (_issue, index) => `compiler validation ${index}`,
    ),
  });
}

describe('recurring-prop and page structural bundle repair', () => {
  it('selects the exact unique recurring-props plus page identity set', () => {
    const selected = authority();
    expect(selected?.recurringProps.map((value) => value.id)).toEqual([
      'prop:bucket',
      'prop:book',
    ]);
    expect(selected?.affectedPages.map((value) => value.pageNumber)).toEqual([
      1,
      2,
    ]);
    expect(selected?.referenceAuthority).toEqual({
      recurringPropIds: ['prop:book', 'prop:bucket'],
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
    ['page only', [pageIssue(1)]],
    ['collection only', [collectionIssue]],
    [
      'second collection',
      [
        collectionIssue,
        pageIssue(1),
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
      'root issue',
      [
        collectionIssue,
        pageIssue(1),
        {
          family: 'draft_contract',
          code: 'world_type_missing',
          locator: { kind: 'root', fieldRole: 'world_type' },
        } as DraftValidationIssue,
      ],
    ],
  ])('rejects %s outside the closed mixed family', (_label, issues) => {
    expect(authority(draft(), issues)).toBeNull();
  });

  it('rejects malformed identities, misaligned messages, and secret-bearing messages', () => {
    const duplicated = draft();
    duplicated.recurringProps = [
      prop('prop:duplicate'),
      prop('prop:duplicate'),
    ];
    expect(authority(duplicated)).toBeNull();
    expect(
      structuralBundleRepairAuthority({
        draft: draft(),
        diagnosticIssues: [collectionIssue, pageIssue(1)],
        validationMessages: ['one'],
      }),
    ).toBeNull();
    expect(
      structuralBundleRepairAuthority({
        draft: draft(),
        diagnosticIssues: [collectionIssue, pageIssue(1)],
        validationMessages: ['one', 'OPENAI_API_KEY=secret'],
      }),
    ).toBeNull();
  });

  it('uses the current member schemas and emits a bounded sanitized prompt', () => {
    const selected = authority()!;
    const schema = STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA.properties as {
      recurringProps: { items: unknown };
      pageContracts: { items: unknown };
    };
    expect(schema.recurringProps.items).toBeTruthy();
    expect(schema.pageContracts.items).toBeTruthy();
    expect(STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION).toBe(
      'structural-bundle-repair-prompt/v2',
    );
    expect(STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION).toBe(
      'structural-bundle-repair-user-prompt/v2',
    );
    expect(buildStructuralBundleRepairSystemPrompt()).toContain('ONLY');
    const rawPrompt = buildStructuralBundleRepairUserPrompt({
      authority: selected,
    });
    const payload = decodeStructuralBundleRepairUserPrompt(rawPrompt);
    expect(payload.recurringProps).toHaveLength(2);
    expect(payload.affectedPages.map((value: { pageNumber: number }) => value.pageNumber)).toEqual([
      1,
      2,
    ]);
    const serialized = JSON.stringify(payload);
    for (const sentinel of [
      'RAW_STORY_SOURCE_SENTINEL',
      'PROVIDER_RESPONSE_SENTINEL',
      'SECRET_CREDENTIAL_SENTINEL',
      'REMOVE_SENTINEL',
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
    const reordered = structuredClone(selected);
    reordered.recurringProps = reordered.recurringProps.map((value) =>
      Object.fromEntries(Object.entries(value).reverse()),
    );
    expect(
      buildStructuralBundleRepairUserPrompt({ authority: reordered }),
    ).toBe(rawPrompt);
    const encoded = JSON.parse(rawPrompt) as Record<string, unknown>;
    expect(() =>
      decodeStructuralBundleRepairUserPrompt(
        JSON.stringify({ ...encoded, extra: true }),
      ),
    ).toThrow('structural_bundle_repair_input_encoding_invalid');
  });

  it('parses exact output and rejects root/member drift', () => {
    const valid = JSON.stringify({
      recurringProps: [prop('prop:bucket'), prop('prop:book')],
      pageContracts: [page(1), page(2)],
    });
    expect(parseStructuralBundleRepairPatch(valid).pageContracts).toHaveLength(2);
    expect(() => parseStructuralBundleRepairPatch('not-json')).toThrow(
      'structural_bundle_repair_response_invalid_json',
    );
    expect(() =>
      parseStructuralBundleRepairPatch(
        JSON.stringify({
          ...JSON.parse(valid),
          extra: true,
        }),
      ),
    ).toThrow('structural_bundle_repair_response_invalid_shape');
    expect(() =>
      parseStructuralBundleRepairPatch(
        JSON.stringify({
          recurringProps: [{ ...prop('prop:bucket'), extra: true }],
          pageContracts: [page(1)],
        }),
      ),
    ).toThrow('structural_bundle_repair_prop_invalid');
    const missingCamera = page(1) as Record<string, unknown>;
    delete missingCamera.camera;
    expect(() =>
      parseStructuralBundleRepairPatch(
        JSON.stringify({
          recurringProps: [prop('prop:bucket')],
          pageContracts: [missingCamera],
        }),
      ),
    ).toThrow('structural_bundle_repair_page_invalid');
  });

  it('applies the exact bundle without mutation or non-target drift and normalizes response order', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original)!;
    const correctedBucket = prop('prop:bucket', 'corrected bucket');
    const correctedBook = prop('prop:book', 'corrected book');
    const correctedPage1 = page(1);
    correctedPage1.camera = 'corrected page one';
    const correctedPage2 = page(2);
    correctedPage2.camera = 'corrected page two';
    const result = applyStructuralBundleRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        recurringProps: [correctedBook, correctedBucket],
        pageContracts: [correctedPage2, correctedPage1],
      },
    });
    expect(original).toEqual(snapshot);
    expect(
      (result.recurringProps as Array<Record<string, unknown>>).map(
        (value) => value.id,
      ),
    ).toEqual(['prop:bucket', 'prop:book']);
    expect(
      (result.pageContracts as Array<Record<string, unknown>>).map(
        (value) => value.camera,
      ),
    ).toEqual(['corrected page one', 'corrected page two', 'portrait medium shot']);
    expect({
      ...result,
      recurringProps: undefined,
      pageContracts: undefined,
    }).toEqual({
      ...snapshot,
      recurringProps: undefined,
      pageContracts: undefined,
    });
  });

  it('rejects missing, extra, duplicate, renamed, and stale identities', () => {
    const original = draft();
    const selected = authority(original)!;
    const apply = (patch: {
      recurringProps: Record<string, unknown>[];
      pageContracts: Record<string, unknown>[];
    }) =>
      applyStructuralBundleRepairPatch({
        draft: original,
        authority: selected,
        patch,
      });
    expect(() =>
      apply({
        recurringProps: [prop('prop:bucket')],
        pageContracts: [page(1), page(2)],
      }),
    ).toThrow('structural_bundle_repair_prop_set_mismatch');
    expect(() =>
      apply({
        recurringProps: [
          prop('prop:bucket'),
          prop('prop:book'),
          prop('prop:extra'),
        ],
        pageContracts: [page(1), page(2)],
      }),
    ).toThrow('structural_bundle_repair_prop_set_mismatch');
    expect(() =>
      apply({
        recurringProps: [prop('prop:bucket'), prop('prop:bucket')],
        pageContracts: [page(1), page(2)],
      }),
    ).toThrow('structural_bundle_repair_prop_unexpected_or_duplicate');
    expect(() =>
      apply({
        recurringProps: [prop('prop:bucket'), prop('prop:renamed')],
        pageContracts: [page(1), page(2)],
      }),
    ).toThrow('structural_bundle_repair_prop_set_mismatch');
    expect(() =>
      apply({
        recurringProps: [prop('prop:bucket'), prop('prop:book')],
        pageContracts: [page(1)],
      }),
    ).toThrow('structural_bundle_repair_page_set_mismatch');
    expect(() =>
      apply({
        recurringProps: [prop('prop:bucket'), prop('prop:book')],
        pageContracts: [page(1), page(1)],
      }),
    ).toThrow('structural_bundle_repair_page_unexpected_or_duplicate');

    for (const staleRecurringProps of [
      [prop('prop:bucket')],
      [prop('prop:bucket'), prop('prop:book'), prop('prop:unknown')],
    ]) {
      const stale = structuredClone(original);
      stale.recurringProps = staleRecurringProps;
      expect(() =>
        applyStructuralBundleRepairPatch({
          draft: stale,
          authority: selected,
          patch: {
            recurringProps: [prop('prop:bucket'), prop('prop:book')],
            pageContracts: [page(1), page(2)],
          },
        }),
      ).toThrow('structural_bundle_repair_prop_target_stale');
    }

    const stale = structuredClone(original);
    (stale.pageContracts as Array<Record<string, unknown>>).push(page(1));
    expect(() =>
      applyStructuralBundleRepairPatch({
        draft: stale,
        authority: selected,
        patch: {
          recurringProps: [prop('prop:bucket'), prop('prop:book')],
          pageContracts: [page(1), page(2)],
        },
      }),
    ).toThrow('structural_bundle_repair_page_target_stale');
  });
});
