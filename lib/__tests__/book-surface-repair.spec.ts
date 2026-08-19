import { describe, expect, it } from 'vitest';

import type {
  DraftValidationIssue,
  PageFinalStructuralCause,
} from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_PROMPT_VERSION,
  BOOK_SURFACE_REPAIR_SCHEMA_VERSION,
  BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
  applyBookSurfaceRepairPatch,
  bookSurfaceRepairAuthority,
  buildBookSurfaceRepairSystemPrompt,
  buildBookSurfaceRepairUserPrompt,
  decodeBookSurfaceRepairUserPrompt,
  parseBookSurfaceRepairPatch,
  type BookSurfaceRepairAuthority,
  type BookSurfaceRepairPatch,
} from '@/lib/visual-contract-compiler/bookSurfaceRepair';
import type {
  PresentationRequirementRepairPatch,
  PresentationRequirementRepairTarget,
} from '@/lib/visual-contract-compiler/presentationRequirementRepair';
import { PRESENTATION_REQUIREMENT_CLASS_VALUES } from '@/lib/visual-contract-compiler/actionSemanticCoverage';
import {
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
  visualContractAuthoringInputAccounting,
  visualContractAuthoringRouteIsAdmissible,
} from '@/lib/visual-contract-compiler/authoringPolicy';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';

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

function recurringProp(id = 'prop:cake') {
  return {
    id,
    name: id === 'prop:cake' ? 'delivery cake' : 'delivery cart',
    description:
      id === 'prop:cake'
        ? 'three-tier cake kept stable by gentle motion'
        : 'cart carrying the cake',
    material: id === 'prop:cake' ? 'cake' : 'wood',
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
    mustShow: [
      `page ${pageNumber} visible beat`,
      `page ${pageNumber} alternate visible beat`,
    ],
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
    castIds: ['child:hero', 'companion:fox'],
    characterPresence: { child: true, companion: true },
    safetyConstraints: [],
    transition: {
      kind: 'steady',
      fromZoneId: null,
      toZoneId: null,
      cue: null,
    },
  };
}

function draft(pageCount = 3): Record<string, unknown> {
  return {
    worldType: 'grounded',
    locations: [{ id: 'loc:home' }],
    zones: Array.from({ length: pageCount }, (_, index) => ({
      id: `zone:${index + 1}`,
      locationId: 'loc:home',
      spatialNodes: [{ id: `node:${index + 1}` }],
    })),
    cast: {
      child: { id: 'child:hero' },
      companion: { id: 'companion:fox' },
    },
    humanCast: [{ id: 'human:parent' }],
    recurringProps: [recurringProp()],
    coverContract: cover(),
    pageContracts: Array.from({ length: pageCount }, (_, index) =>
      page(index + 1),
    ),
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
      {
        contractPointer: `/pageContracts/${pageNumber - 1}/mustShow/1`,
        contractValue: `page ${pageNumber} alternate visible beat`,
      },
    ],
  };
}

function presentationPatch(
  pageNumber: number,
  presentationClass: PresentationRequirementRepairPatch['presentationClass'] =
    'static_state',
  mustShowIndex = 0,
): PresentationRequirementRepairPatch {
  return {
    pageNumber,
    coverageIndex: 0,
    beatId: `beat:p${pageNumber}:test`,
    sourceEvidenceId: `se1_${'a'.repeat(64)}`,
    presentationClass,
    contractPointer: `/pageContracts/${pageNumber - 1}/mustShow/${mustShowIndex}`,
  };
}

function structuralPatch(
  pageNumber: number,
  writableFields: readonly string[] = ['mustNotShow', 'camera'],
) {
  const source = page(pageNumber);
  const result: Record<string, unknown> = {
    pageNumber: source.pageNumber,
    locationId: null,
    zoneId: null,
    sameLocationAs: null,
    mustShow: null,
    mustNotShow: null,
    propState: null,
    propConstraints: null,
    actionRequirements: null,
    camera: null,
    transition: null,
  };
  const repairedValues: Record<string, unknown> = {
    mustShow: source.mustShow,
    mustNotShow: source.mustNotShow,
    propState: source.propState,
    propConstraints: source.propConstraints,
    actionRequirements: source.actionRequirements,
    camera: `repaired page ${pageNumber}`,
    transition: source.transition,
  };
  for (const field of writableFields) {
    result[field] = structuredClone(repairedValues[field]);
  }
  return result;
}

const STRUCTURAL_PATCH_KEYS = [
  'pageNumber',
  'locationId',
  'zoneId',
  'sameLocationAs',
  'mustShow',
  'mustNotShow',
  'propState',
  'propConstraints',
  'actionRequirements',
  'camera',
  'transition',
] as const;

function structuralPatchFromAuthority(
  selected: BookSurfaceRepairAuthority,
  affectedPageIndex = 0,
): Record<string, unknown> {
  const authorityPage =
    selected.affectedPages[affectedPageIndex]!.pageContract;
  const writableFields = new Set<string>(
    selected.affectedPages[affectedPageIndex]!.writableFields,
  );
  return Object.fromEntries(
    STRUCTURAL_PATCH_KEYS.map((key) => [
      key,
      key === 'pageNumber'
        ? structuredClone(authorityPage[key])
        : writableFields.has(key)
          ? structuredClone(authorityPage[key])
          : null,
    ]),
  );
}

const coverProjectionIssue: DraftValidationIssue = {
  family: 'draft_contract',
  code: 'cover_projection_invalid',
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
    causes: ['page_steering_invalid'],
  };
}

function pageStructureIssueWithCause(
  pageNumber: number,
  cause: PageFinalStructuralCause,
): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'final_structural_invariant_invalid',
    locator: {
      kind: 'page',
      fieldRole: 'final_structure',
      pageNumber,
    },
    causes: [cause],
  };
}

function authority(
  value = draft(),
  options: { lifecycle?: boolean; pageNumbers?: number[] } = {},
): BookSurfaceRepairAuthority {
  const pageNumbers = options.pageNumbers ?? [1];
  const issues = [
    coverProjectionIssue,
    ...(options.lifecycle ? [recurringPropLifecycleIssue] : []),
    ...pageNumbers.map(pageStructureIssue),
  ];
  const selected = bookSurfaceRepairAuthority({
    draft: value,
    authorityDraft: value,
    presentationTargets: [presentationTarget(1), presentationTarget(2)],
    structuralDiagnosticIssues: issues,
    structuralValidationMessages: issues.map(
      (issue, index) => `${issue.code}: sanitized validation ${index}`,
    ),
  });
  expect(selected).not.toBeNull();
  return selected!;
}

function patch(
  options: {
    lifecycle?: boolean;
    pageNumbers?: number[];
    presentationPageNumbers?: number[];
  } = {},
): BookSurfaceRepairPatch {
  const presentationPageNumbers =
    options.presentationPageNumbers ?? [1, 2];
  const presentationPages = new Set(presentationPageNumbers);
  return {
    presentationPatches: presentationPageNumbers.map((pageNumber) =>
      presentationPatch(pageNumber),
    ),
    coverContract: {
      ...cover(),
      mustShow: ['hero, fox, and complete cake are visible'],
    },
    recurringProps: options.lifecycle
      ? [
          {
            ...recurringProp(),
            firstRevealPage: 2,
          },
        ]
      : null,
    pageStructuralPatches: (options.pageNumbers ?? [1]).map((pageNumber) =>
      structuralPatch(
        pageNumber,
        presentationPages.has(pageNumber)
          ? ['mustNotShow', 'camera']
          : ['mustShow', 'mustNotShow', 'camera'],
      ),
    ),
  };
}

describe('atomic causal book-surface repair v11 typed input authority', () => {
  it('publishes the strict v6 causal-delta schema under v11 prompts with nullable cover/props and no action coverage', () => {
    expect(BOOK_SURFACE_REPAIR_SCHEMA_VERSION).toBe(
      'book-surface-repair-schema/v6',
    );
    expect(BOOK_SURFACE_REPAIR_PROMPT_VERSION).toBe(
      'book-surface-repair-prompt/v11',
    );
    expect(BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION).toBe(
      'book-surface-repair-user-prompt/v11',
    );
    expect(buildBookSurfaceRepairSystemPrompt()).toContain(
      'Return a repaired non-null value only for that page\'s exact writableFields',
    );
    expect(buildBookSurfaceRepairSystemPrompt()).toContain(
      'compiler preserves an already-valid current location/zone/cast identity',
    );
    const properties = BOOK_SURFACE_REPAIR_JSON_SCHEMA.properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(Object.keys(properties)).toEqual([
      'presentationPatches',
      'coverContract',
      'recurringProps',
      'pageStructuralPatches',
    ]);
    expect(properties.coverContract?.anyOf).toContainEqual({ type: 'null' });
    expect(properties.recurringProps?.anyOf).toContainEqual({ type: 'null' });
    const pageSchema = properties.pageStructuralPatches?.items as Record<
      string,
      unknown
    >;
    expect(pageSchema).toMatchObject({ additionalProperties: false });
    expect(pageSchema.properties).not.toHaveProperty(
      'actionSemanticCoverage',
    );
    expect(pageSchema.properties).toHaveProperty('actionRequirements');
    expect(
      (pageSchema.properties as Record<string, unknown>).camera,
    ).toMatchObject({ anyOf: expect.arrayContaining([{ type: 'null' }]) });
  });

  it('keeps presentation targets separate from exact structural pages and omits unauthorized props', () => {
    const selected = authority();
    expect(selected.sourceDraftDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(selected.coverContract).toEqual(cover());
    expect(selected.recurringProps).toBeNull();
    expect(selected.repairRecurringProps).toBe(false);
    expect(selected.presentationTargets.map((value) => value.pageNumber)).toEqual([
      1,
      2,
    ]);
    expect(selected.affectedPages.map((value) => value.pageNumber)).toEqual([
      1,
    ]);
    expect(selected.affectedPages[0]?.repairTargets).toEqual([
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        pageNumber: 1,
        causes: ['page_steering_invalid'],
      },
    ]);
    expect(selected.affectedPages[0]?.writableFields).toEqual([
      'mustNotShow',
      'camera',
    ]);
    expect(selected.affectedPages[0]?.readOnlyContext).toMatchObject({
      castIds: ['child:hero', 'companion:fox'],
      characterPresence: { child: true, companion: true },
      actionBindingAuthority: [],
    });
    expect(selected.affectedPages[0]?.propConstraintViolations).toEqual([]);
  });

  it('binds every item-level prop-constraint template as closed index-only authority and rejects tamper before prompt or apply', () => {
    const value = draft();
    const valuePages = value.pageContracts as Array<Record<string, unknown>>;
    valuePages[0]!.propConstraints = [
      null,
      {
        propId: 'prop:unknown',
        visibility: 'maybe',
        stateId: '',
        anchorId: 7,
      },
      {
        propId: 'prop:cake',
        visibility: 'required',
        anchorId: 'anchor:unknown',
      },
      { propId: 'prop:cake', visibility: 'forbidden' },
    ];
    const issue = pageStructureIssueWithCause(
      1,
      'page_prop_constraints_invalid',
    );
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: Array.from({ length: 7 }, () => issue),
      structuralValidationMessages: Array.from(
        { length: 7 },
        (_, index) => `sanitized prop constraint ${index}`,
      ),
    });
    expect(selected).not.toBeNull();
    const expected = [
      { code: 'prop_id_missing', constraintIndex: 0 },
      { code: 'prop_id_unknown', constraintIndex: 1 },
      { code: 'visibility_invalid', constraintIndex: 1 },
      { code: 'state_id_invalid', constraintIndex: 1 },
      { code: 'anchor_id_invalid', constraintIndex: 1 },
      { code: 'anchor_id_unknown', constraintIndex: 2 },
      {
        code: 'visibility_self_contradiction',
        constraintIndex: 3,
        relatedConstraintIndex: 2,
      },
    ];
    expect(selected!.affectedPages[0]!.propConstraintViolations).toEqual(
      expected,
    );
    const decoded = decodeBookSurfaceRepairUserPrompt(
      buildBookSurfaceRepairUserPrompt({ authority: selected! }),
    ) as {
      affectedPages: Array<{ propConstraintViolations: unknown[] }>;
    };
    expect(decoded.affectedPages[0]!.propConstraintViolations).toEqual(
      expected,
    );
    const typedJson = JSON.stringify(
      decoded.affectedPages[0]!.propConstraintViolations,
    );
    expect(typedJson).not.toContain('prop:unknown');
    expect(typedJson).not.toContain('anchor:unknown');
    expect(typedJson).not.toContain('sanitized prop constraint');

    const patchValue: BookSurfaceRepairPatch = {
      presentationPatches: [],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [
        structuralPatchFromAuthority(selected!),
      ],
    };
    const snapshot = structuredClone(value);
    for (const mutate of [
      (authorityValue: BookSurfaceRepairAuthority) => {
        authorityValue.affectedPages[0]!.propConstraintViolations[1] = {
          code: 'visibility_invalid',
          constraintIndex: 1,
        };
      },
      (authorityValue: BookSurfaceRepairAuthority) => {
        authorityValue.affectedPages[0]!.propConstraintViolations[6] = {
          code: 'visibility_self_contradiction',
          constraintIndex: 3,
          relatedConstraintIndex: 1,
        };
      },
    ]) {
      const tampered = structuredClone(selected!);
      mutate(tampered);
      const { authorityDigest: _digest, ...content } = tampered;
      tampered.authorityDigest = canonicalJsonDigest(content);
      expect(() =>
        buildBookSurfaceRepairUserPrompt({ authority: tampered }),
      ).toThrow('book_surface_repair_authority_mismatch');
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: value,
          authority: tampered,
          patch: patchValue,
        }),
      ).toThrow('book_surface_repair_authority_mismatch');
      expect(value).toEqual(snapshot);
    }
  });

  it('includes recurring props only for the exact lifecycle identity', () => {
    const lifecycleDraft = draft();
    (
      lifecycleDraft.recurringProps as Array<Record<string, unknown>>
    )[0]!.firstRevealPage = 3;
    (
      lifecycleDraft.pageContracts as Array<Record<string, unknown>>
    )[0]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
    ];
    (
      lifecycleDraft.pageContracts as Array<Record<string, unknown>>
    )[1]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'required' },
    ];
    const selected = authority(lifecycleDraft, { lifecycle: true });
    expect(selected.repairRecurringProps).toBe(true);
    expect(selected.recurringProps).toEqual([
      { ...recurringProp(), firstRevealPage: 3 },
    ]);
    expect(selected.recurringPropLifecycleContext).toEqual([
      {
        propId: 'prop:cake',
        currentFirstRevealPage: 3,
        forbiddenPageNumbers: [1],
        requiredPageNumbers: [2],
      },
    ]);
    const decoded = decodeBookSurfaceRepairUserPrompt(
      buildBookSurfaceRepairUserPrompt({ authority: selected }),
    ) as {
      recurringPropAuthority: {
        lifecycleContext: unknown;
      };
    };
    expect(decoded.recurringPropAuthority.lifecycleContext).toEqual(
      selected.recurringPropLifecycleContext,
    );

    expect(
      bookSurfaceRepairAuthority({
        draft: draft(),
        authorityDraft: draft(),
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
          {
            family: 'draft_contract',
            code: 'lifecycle_invariant_invalid',
            locator: {
              kind: 'collection',
              collectionRole: 'locations',
              fieldRole: 'lifecycle',
            },
          } as DraftValidationIssue,
        ],
        structuralValidationMessages: ['cover', 'page', 'lifecycle'],
      }),
    ).toBeNull();

  });

  it('maps every closed page cause to its exact writable fields and conditional context', () => {
    const cases: Array<
      [PageFinalStructuralCause, string[] | null]
    > = [
      ['page_spatial_binding_invalid', null],
      [
        'page_steering_invalid',
        ['mustShow', 'mustNotShow', 'camera'],
      ],
      ['page_character_presence_invalid', null],
      ['page_prop_state_invalid', ['propState']],
      ['page_cast_state_invalid', null],
      ['page_prop_constraints_invalid', ['propConstraints']],
      ['page_action_requirements_invalid', ['actionRequirements']],
      ['page_safety_constraints_invalid', null],
      [
        'page_action_constraint_conflict_invalid',
        ['actionRequirements'],
      ],
      ['page_action_check_id_collision_invalid', ['actionRequirements']],
      ['page_prop_check_id_collision_invalid', ['propConstraints']],
      ['page_safety_check_id_collision_invalid', null],
      ['page_projection_containment_invalid', null],
      ['page_cast_binding_invalid', null],
      ['page_human_presence_binding_invalid', null],
      ['page_transition_invalid', ['transition']],
    ];
    for (const [cause, expectedWritableFields] of cases) {
      const value = draft();
      const selected = bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [],
        structuralDiagnosticIssues: [
          pageStructureIssueWithCause(1, cause),
        ],
        structuralValidationMessages: [`sanitized ${cause}`],
      });
      if (expectedWritableFields === null) {
        expect(selected, cause).toBeNull();
        continue;
      }
      expect(selected, cause).not.toBeNull();
      expect(selected!.affectedPages[0]?.writableFields).toEqual(
        expectedWritableFields,
      );
      expect(
        selected!.affectedPages[0]?.readOnlyContext.transitionTopology,
      ).toEqual(
        cause === 'page_transition_invalid'
          ? {
              previous: null,
              current: { pageNumber: 1, zoneId: 'zone:1' },
              next: { pageNumber: 2, zoneId: 'zone:2' },
            }
          : null,
      );
    }
  });

  it('unions only canonical writable fields and rejects hostile drift in every other page field', () => {
    const value = draft();
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [
        pageStructureIssueWithCause(1, 'page_prop_state_invalid'),
        pageStructureIssueWithCause(
          1,
          'page_action_requirements_invalid',
        ),
      ],
      structuralValidationMessages: [
        'sanitized prop state',
        'sanitized action requirements',
      ],
    });
    expect(selected).not.toBeNull();
    expect(selected!.affectedPages[0]?.writableFields).toEqual([
      'propState',
      'actionRequirements',
    ]);
    const writable = new Set<string>(
      selected!.affectedPages[0]!.writableFields,
    );
    for (const key of STRUCTURAL_PATCH_KEYS.filter(
      (candidate) => !writable.has(candidate),
    )) {
      const hostile = structuralPatchFromAuthority(selected!);
      hostile[key] = `HOSTILE_${key}`;
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: value,
          authority: selected!,
          patch: {
            presentationPatches: [],
            coverContract: null,
            recurringProps: null,
            pageStructuralPatches: [hostile],
          },
        }),
      ).toThrow();
    }

    const missingWritableValue = structuralPatchFromAuthority(selected!);
    missingWritableValue.propState = null;
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: value,
        authority: selected!,
        patch: {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [missingWritableValue],
        },
      }),
    ).toThrow('book_surface_repair_non_target_drift');
  });

  it('rejects tampered compiler-owned read-only context before prompt or apply', () => {
    const value = draft();
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [
        pageStructureIssueWithCause(1, 'page_transition_invalid'),
      ],
      structuralValidationMessages: ['sanitized transition'],
    });
    expect(selected).not.toBeNull();
    const tampered = structuredClone(selected!);
    tampered.affectedPages[0]!.readOnlyContext.transitionTopology!
      .current.zoneId = 'zone:tampered';
    expect(() =>
      buildBookSurfaceRepairUserPrompt({ authority: tampered }),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: value,
        authority: tampered,
        patch: {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [
            structuralPatchFromAuthority(selected!),
          ],
        },
      }),
    ).toThrow('book_surface_repair_authority_mismatch');
  });

  it('rejects stale, duplicate, unsafe, or unrelated authority before prompt construction', () => {
    const value = draft();
    const duplicateTarget = presentationTarget(1);
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [duplicateTarget, duplicateTarget],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: ['cover', 'page'],
      }),
    ).toBeNull();

    const unpermitted = presentationTarget(1);
    unpermitted.permittedPointerValues = [
      {
        contractPointer: '/pageContracts/0/mustShow/999',
        contractValue: 'invented authority',
      },
    ];
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [unpermitted],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: ['cover', 'page'],
      }),
    ).toBeNull();

    const stale = presentationTarget(1);
    stale.beatId = 'beat:p1:stale';
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [stale],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: ['cover', 'page'],
      }),
    ).toBeNull();

    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: [
          'cover',
          'OPENAI_API_KEY=do-not-persist',
        ],
      }),
    ).toBeNull();

    const invalidReferenceDraft = draft();
    (
      invalidReferenceDraft.zones as Array<Record<string, unknown>>
    )[0]!.locationId = 'loc:missing';
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: invalidReferenceDraft,
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: ['cover', 'page'],
      }),
    ).toBeNull();
  });

  it('builds a pure page-structural authority without cover or presentation repair', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const issues = [pageStructureIssue(1)];
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: ['page'],
    });
    expect(selected).not.toBeNull();
    expect(selected?.presentationTargets).toEqual([]);
    expect(selected?.coverContract).toBeNull();
    expect(selected?.coverValidationHints).toEqual([]);
    expect(
      decodeBookSurfaceRepairUserPrompt(
        buildBookSurfaceRepairUserPrompt({ authority: selected! }),
      ).coverAuthority,
    ).toBeNull();
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: {
        ...patch({ presentationPageNumbers: [] }),
        presentationPatches: [],
        coverContract: null,
      },
    });
    expect(
      (result.pageContracts as ReturnType<typeof page>[])[0]?.camera,
    ).toBe('repaired page 1');
    expect(
      (result.pageContracts as ReturnType<typeof page>[])[0]
        ?.actionSemanticCoverage,
    ).toEqual(page(1).actionSemanticCoverage);
    expect(result.coverContract).toEqual(snapshot.coverContract);
    expect(original).toEqual(snapshot);
  });

  it('encodes only compact structural projections and exact presentation authority', () => {
    const selected = authority();
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
    });
    const payload = decodeBookSurfaceRepairUserPrompt(rawPrompt);
    expect(payload.presentationTargets).toEqual(
      selected.presentationTargets.map(
        ({ sourcePhrase: _sourcePhrase, ...target }) => target,
      ),
    );
    expect(payload).not.toHaveProperty('sourceDraftDigest');
    expect(payload.coverAuthority).toEqual({
      coverContract: cover(),
      diagnosticCount: selected.coverValidationHints.length,
    });
    expect(payload.recurringPropAuthority).toBeNull();
    const affectedPages = payload.affectedPages as Array<
      Record<string, unknown>
    >;
    expect(affectedPages).toHaveLength(1);
    expect(affectedPages[0]).toHaveProperty(
      'pageStructuralProjection',
    );
    expect(
      affectedPages[0]?.pageStructuralProjection,
    ).not.toHaveProperty('actionSemanticCoverage');
    expect(affectedPages[0]).not.toHaveProperty('pageContract');
    expect(buildBookSurfaceRepairSystemPrompt()).toContain(
      'never return or alter actionSemanticCoverage',
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(selected.sourceDraftDigest);
    for (const target of selected.presentationTargets) {
      expect(serialized).not.toContain(target.sourcePhrase);
    }
    for (const sentinel of [
      'RAW_STORY_SOURCE_SENTINEL',
      'PROVIDER_RESPONSE_SENTINEL',
      'SECRET_CREDENTIAL_SENTINEL',
      'REMOVE_SENTINEL',
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it('sends only compact action-binding identities while retaining full compiler authority', () => {
    const value = draft();
    const sourceEvidenceId = `se1_${'b'.repeat(64)}`;
    const valuePages = value.pageContracts as Array<
      Record<string, unknown>
    >;
    valuePages[0]!.actionRequirements = [
      {
        beatId: 'beat:p1:walk',
        subject: {
          kind: 'entity',
          entityKind: 'cast',
          entityId: 'child:hero',
        },
        predicate: 'walks',
        object: null,
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'affirmed',
        laterality: null,
      },
    ];
    valuePages[0]!.actionSemanticCoverage = [
      {
        beatId: 'beat:p1:walk',
        sourceEvidenceId,
        disposition: { kind: 'action_requirement' },
      },
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [
        pageStructureIssueWithCause(
          1,
          'page_action_requirements_invalid',
        ),
      ],
      structuralValidationMessages: ['sanitized action repair'],
    });
    expect(selected).not.toBeNull();
    expect(
      selected!.affectedPages[0]!.readOnlyContext.actionBindingAuthority,
    ).toEqual([
      {
        actionIndex: 0,
        beatId: 'beat:p1:walk',
        coverageIndex: 0,
        sourceEvidenceId,
      },
    ]);

    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected!,
    });
    const decoded = decodeBookSurfaceRepairUserPrompt(rawPrompt) as {
      affectedPages: Array<{
        readOnlyContext: { actionBindingAuthority: unknown[] };
      }>;
    };
    expect(
      decoded.affectedPages[0]!.readOnlyContext.actionBindingAuthority,
    ).toEqual([{ actionIndex: 0, beatId: 'beat:p1:walk' }]);
    expect(rawPrompt).not.toContain(sourceEvidenceId);
  });

  it('deduplicates structural hints under one aggregate bound', () => {
    const value = draft();
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [presentationTarget(1)],
      structuralDiagnosticIssues: [
        coverProjectionIssue,
        coverProjectionIssue,
        recurringPropLifecycleIssue,
        recurringPropLifecycleIssue,
        pageStructureIssue(1),
      ],
      structuralValidationMessages: [
        'cover needs repair',
        '  cover   needs repair  ',
        'props need repair',
        'props need repair',
        'page needs repair',
      ],
    });
    expect(selected?.coverValidationHints).toEqual([
      'cover needs repair',
    ]);
    expect(selected?.recurringPropValidationHints).toEqual([
      'props need repair',
    ]);
    expect(selected?.affectedPages[0]?.validationHints).toEqual([
      'page needs repair',
    ]);
  });

  it('defers aggregate hint admission to canonical bytes while retaining each bounded scope', () => {
    const value = draft(12);
    const pageIssues = Array.from({ length: 124 }, () =>
      pageStructureIssue(1),
    );
    const structuralIssues = [
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      ...pageIssues,
    ];
    const structuralMessages = [
      'cover needs exact repair',
      'props need exact repair',
      ...pageIssues.map(
        (_issue, index) => `page one exact structural clause ${index + 1}`,
      ),
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: Array.from({ length: 8 }, (_, index) =>
        presentationTarget(index + 1),
      ),
      structuralDiagnosticIssues: structuralIssues,
      structuralValidationMessages: structuralMessages,
    });

    expect(structuralMessages).toHaveLength(126);
    expect(selected).not.toBeNull();
    expect(selected?.presentationTargets).toHaveLength(8);
    expect(selected?.coverValidationHints).toEqual([
      'cover needs exact repair',
    ]);
    expect(selected?.recurringPropValidationHints).toEqual([
      'props need exact repair',
    ]);
    expect(selected?.affectedPages[0]?.validationHints).toHaveLength(124);

    const overScopeIssues = Array.from({ length: 129 }, () =>
      pageStructureIssue(1),
    );
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          ...overScopeIssues,
        ],
        structuralValidationMessages: [
          'cover remains bounded',
          ...overScopeIssues.map(
            (_issue, index) => `over-bound page clause ${index + 1}`,
          ),
        ],
      }),
    ).toBeNull();
  });

  it('admits a twelve-page live-shaped v6 request without sending redundant validation prose', () => {
    const value = draft(12);
    const pageIssues = Array.from(
      { length: 113 },
      (_, index) => pageStructureIssue((index % 12) + 1),
    );
    const issues = [
      coverProjectionIssue,
      recurringPropLifecycleIssue,
      ...pageIssues,
    ];
    const messages = issues.map(
      (issue, index) =>
        `${issue.code}: exact live-shaped structural validation ${index} ${'detail '.repeat(12)}`,
    );
    const normalizedMessages = messages.map((message) =>
      message.replace(/\s+/g, ' ').trim(),
    );
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [presentationTarget(4)],
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: messages,
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
    const decoded = decodeBookSurfaceRepairUserPrompt(
      userPrompt,
    ) as unknown as {
      presentationTargets: unknown[];
      coverAuthority: { diagnosticCount: number } | null;
      recurringPropAuthority: { diagnosticCount: number } | null;
      affectedPages: Array<{ diagnosticCount: number }>;
    };
    expect(decoded.presentationTargets).toHaveLength(1);
    expect(decoded.affectedPages).toHaveLength(12);
    const decodedDiagnosticCount =
      (decoded.coverAuthority?.diagnosticCount ?? 0) +
      (decoded.recurringPropAuthority?.diagnosticCount ?? 0) +
      decoded.affectedPages.reduce(
        (total, page) => total + page.diagnosticCount,
        0,
      );
    expect(decodedDiagnosticCount).toBe(115);
    expect(59_904 - accounting.estimatedBytes).toBeGreaterThanOrEqual(
      4_096,
    );
    expect(accounting.estimatedBytes).toBeLessThanOrEqual(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS -
        VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
    );
    expect(
      visualContractAuthoringRouteIsAdmissible({
        systemPrompt,
        userPrompt,
        schema: BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      }),
    ).toBe(true);
    const decodedJson = JSON.stringify(decoded);
    for (const message of normalizedMessages) {
      expect(decodedJson).not.toContain(message);
    }
  });

  it('keeps at least 4096 bytes of route headroom with twelve pages and 84 typed prop violations', () => {
    const value = draft(12);
    const pages = value.pageContracts as Array<Record<string, unknown>>;
    for (const pageValue of pages) {
      pageValue.propConstraints = [
        null,
        {
          propId: 'prop:unknown',
          visibility: 'maybe',
          stateId: '',
          anchorId: 7,
        },
        {
          propId: 'prop:cake',
          visibility: 'required',
          anchorId: 'anchor:unknown',
        },
        { propId: 'prop:cake', visibility: 'forbidden' },
      ];
    }
    const propIssueForPage = (pageNumber: number) =>
      pageStructureIssueWithCause(
        pageNumber,
        'page_prop_constraints_invalid',
      );
    const pageIssues = pages.flatMap((_, pageIndex) =>
      Array.from({ length: 7 }, () => propIssueForPage(pageIndex + 1)),
    );
    const issues = [coverProjectionIssue, ...pageIssues];
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: Array.from(
        { length: 8 },
        (_, index) => presentationTarget(index + 1),
      ),
      structuralDiagnosticIssues: issues,
      structuralValidationMessages: issues.map(
        (issue, index) =>
          `${issue.code}: bounded prop-heavy validation ${index}`,
      ),
    });
    expect(selected).not.toBeNull();
    expect(
      selected!.affectedPages.flatMap(
        (pageValue) => pageValue.propConstraintViolations,
      ),
    ).toHaveLength(84);
    const systemPrompt = buildBookSurfaceRepairSystemPrompt();
    const userPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected!,
    });
    const accounting = visualContractAuthoringInputAccounting(
      systemPrompt,
      userPrompt,
      BOOK_SURFACE_REPAIR_JSON_SCHEMA,
    );
    const decoded = decodeBookSurfaceRepairUserPrompt(userPrompt) as {
      affectedPages: Array<{ propConstraintViolations: unknown[] }>;
    };
    expect(
      decoded.affectedPages.flatMap(
        (pageValue) => pageValue.propConstraintViolations,
      ),
    ).toHaveLength(84);
    expect(59_904 - accounting.estimatedBytes).toBeGreaterThanOrEqual(
      4_096,
    );
    expect(
      visualContractAuthoringRouteIsAdmissible({
        systemPrompt,
        userPrompt,
        schema: BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      }),
    ).toBe(true);
  });

  it('refuses a presentation overlap only when its frozen mustShow is structurally invalid', () => {
    const value = draft();
    const valuePages = value.pageContracts as Array<ReturnType<typeof page>>;
    valuePages[0]!.mustShow = [
      ...valuePages[0]!.mustShow,
      '   ',
    ];
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: [
          'cover remains bounded',
          'page 1 steering remains invalid',
        ],
      }),
    ).toBeNull();

    const cameraOnly = draft();
    const cameraOnlyPages = cameraOnly.pageContracts as Array<
      ReturnType<typeof page>
    >;
    cameraOnlyPages[0]!.camera = '';
    expect(
      bookSurfaceRepairAuthority({
        draft: cameraOnly,
        authorityDraft: cameraOnly,
        presentationTargets: [presentationTarget(1)],
        structuralDiagnosticIssues: [
          coverProjectionIssue,
          pageStructureIssue(1),
        ],
        structuralValidationMessages: [
          'cover remains bounded',
          'page 1 camera remains invalid',
        ],
      }),
    ).not.toBeNull();
  });

  it('parses exact delta output and rejects full-page, key, identity, and nullable drift', () => {
    const valid = patch();
    expect(
      parseBookSurfaceRepairPatch(JSON.stringify(valid)),
    ).toEqual(valid);
    expect(() => parseBookSurfaceRepairPatch('not-json')).toThrow(
      'book_surface_repair_response_invalid_json',
    );
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({ ...valid, extra: true }),
      ),
    ).toThrow('book_surface_repair_response_invalid_shape');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          ...valid,
          pageContracts: [page(1)],
        }),
      ),
    ).toThrow('book_surface_repair_response_invalid_shape');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          ...valid,
          pageStructuralPatches: [
            {
              ...structuralPatch(1),
              actionSemanticCoverage: page(1).actionSemanticCoverage,
            },
          ],
        }),
      ),
    ).toThrow('book_surface_repair_page_invalid');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          ...valid,
          recurringProps: [{ ...recurringProp(), extra: true }],
        }),
      ),
    ).toThrow('book_surface_repair_prop_invalid');
    expect(() =>
      parseBookSurfaceRepairPatch(
        JSON.stringify({
          ...valid,
          pageStructuralPatches: [
            { ...structuralPatch(1), pageNumber: 0 },
          ],
        }),
      ),
    ).toThrow('book_surface_repair_page_invalid');
    for (const invalidMustShowEntry of [null, { text: 'not a string' }]) {
      expect(() =>
        parseBookSurfaceRepairPatch(
          JSON.stringify({
            ...valid,
            pageStructuralPatches: [
              {
                ...structuralPatch(1),
                mustShow: [invalidMustShowEntry],
              },
            ],
          }),
        ),
      ).toThrow('book_surface_repair_page_invalid');
    }
  });

  it('applies cover, structural fields, and exact presentation pairs atomically without input mutation', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: patch(),
    });

    expect(original).toEqual(snapshot);
    expect(result.coverContract).toEqual(patch().coverContract);
    expect(result.recurringProps).toEqual(snapshot.recurringProps);
    const pages = result.pageContracts as ReturnType<typeof page>[];
    expect(pages.map((value) => value.camera)).toEqual([
      'repaired page 1',
      'portrait medium shot',
      'portrait medium shot',
    ]);
    expect(pages[0]?.actionSemanticCoverage[0]?.disposition).toEqual({
      kind: 'presentation_requirement',
      presentationClass: 'static_state',
      contractPointer: '/pageContracts/0/mustShow/0',
      contractValue: 'page 1 visible beat',
    });
    expect(pages[1]?.actionSemanticCoverage[0]?.disposition).toEqual({
      kind: 'presentation_requirement',
      presentationClass: 'static_state',
      contractPointer: '/pageContracts/1/mustShow/0',
      contractValue: 'page 2 visible beat',
    });
    expect(pages[2]?.actionSemanticCoverage).toEqual(
      (snapshot.pageContracts as ReturnType<typeof page>[])[2]
        ?.actionSemanticCoverage,
    );
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

  it('supports every closed presentation class and each compiler-permitted pointer pair', () => {
    for (const [index, presentationClass] of
      PRESENTATION_REQUIREMENT_CLASS_VALUES.entries()) {
      const original = draft();
      const snapshot = structuredClone(original);
      const selected = authority(original);
      const mustShowIndex = index % 2;
      const result = applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          ...patch(),
          presentationPatches: [
            presentationPatch(1, presentationClass, mustShowIndex),
            presentationPatch(2, presentationClass, mustShowIndex),
          ],
        },
      });
      const pages = result.pageContracts as ReturnType<typeof page>[];
      for (const pageNumber of [1, 2]) {
        expect(
          pages[pageNumber - 1]?.actionSemanticCoverage[0]
            ?.disposition,
        ).toEqual({
          kind: 'presentation_requirement',
          presentationClass,
          contractPointer: `/pageContracts/${pageNumber - 1}/mustShow/${mustShowIndex}`,
          contractValue:
            mustShowIndex === 0
              ? `page ${pageNumber} visible beat`
              : `page ${pageNumber} alternate visible beat`,
        });
      }
      expect(original).toEqual(snapshot);
    }
  });

  it('rejects a stale full-draft authority before applying any component', () => {
    const original = draft();
    const selected = authority(original);
    const stale = structuredClone(original);
    stale.unrelatedStorySource = 'CHANGED_AFTER_AUTHORITY_SELECTION';
    const snapshot = structuredClone(stale);

    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: stale,
        authority: selected,
        patch: patch(),
      }),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(stale).toEqual(snapshot);
  });

  it('reattaches compiler-owned beat, Source Evidence and exact action cardinality', () => {
    const original = draft();
    const evidenceId = `se1_${'a'.repeat(64)}`;
    const pageOne = (
      original.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    pageOne.actionRequirements = [
      {
        beatId: 'beat:p1:phenomenon_contact',
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId: evidenceId,
        },
        predicate: 'touches',
        object: { kind: 'cast', id: 'child:hero' },
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'affirmative',
        laterality: null,
      },
    ];
    pageOne.actionSemanticCoverage = [
      {
        beatId: 'beat:p1:phenomenon_contact',
        sourceEvidenceId: evidenceId,
        disposition: { kind: 'action_requirement' },
      },
    ];
    const issue: DraftValidationIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: ['page_action_requirements_invalid'],
    };
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: [issue],
      structuralValidationMessages: ['sanitized action validation'],
    });
    expect(selected).not.toBeNull();
    const pagePatch = structuralPatchFromAuthority(selected!);
    const patchedAction = (
      pagePatch.actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    patchedAction.beatId = 'beat:p1:provider_rewrite';
    patchedAction.subject = {
      kind: 'entity',
      entityKind: 'cast',
      entityId: 'child:hero',
    };
    const snapshot = structuredClone(original);

    const validPatch = {
      presentationPatches: [],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [pagePatch],
    } satisfies BookSurfaceRepairPatch;
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: validPatch,
    });
    const resultAction = (
      (result.pageContracts as Array<Record<string, unknown>>)[0]!
        .actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    expect(resultAction.beatId).toBe('beat:p1:phenomenon_contact');
    expect(resultAction.subject).toEqual({
      kind: 'source_phenomenon',
      sourceEvidenceId: evidenceId,
    });
    expect(original).toEqual(snapshot);

    const cardinalityDrift = structuredClone(validPatch);
    cardinalityDrift.pageStructuralPatches[0]!.actionRequirements = [];
    const restored = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: cardinalityDrift,
    });
    const restoredAction = (
      (restored.pageContracts as Array<Record<string, unknown>>)[0]!
        .actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    expect(restoredAction).toEqual(
      (pageOne.actionRequirements as Array<Record<string, unknown>>)[0],
    );
    expect(cardinalityDrift.pageStructuralPatches[0]!.actionRequirements).toEqual(
      [],
    );
    expect(original).toEqual(snapshot);
  });

  it('keeps recognized semantic action patches while filling missing bindings and discarding extras', () => {
    const original = draft();
    const pageOne = (
      original.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    const first: Record<string, unknown> = {
      beatId: 'beat:p1:first',
      subject: {
        kind: 'entity',
        entityKind: 'cast',
        entityId: 'child:hero',
      },
      predicate: 'looks_at',
      object: { kind: 'cast', id: 'companion:fox' },
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    };
    const second = structuredClone(first);
    second.beatId = 'beat:p1:second';
    pageOne.actionRequirements = [first, second];
    pageOne.actionSemanticCoverage = [
      {
        beatId: 'beat:p1:first',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        disposition: { kind: 'action_requirement' },
      },
      {
        beatId: 'beat:p1:second',
        sourceEvidenceId: `se1_${'b'.repeat(64)}`,
        disposition: { kind: 'action_requirement' },
      },
    ];
    const issue: DraftValidationIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: { kind: 'page', fieldRole: 'final_structure', pageNumber: 1 },
      causes: ['page_action_requirements_invalid'],
    };
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: [issue],
      structuralValidationMessages: ['sanitized action validation'],
    });
    expect(selected).not.toBeNull();
    const pagePatch = structuralPatchFromAuthority(selected!);
    const semanticSecond = structuredClone(second);
    semanticSecond.polarity = 'negated';
    const extra = structuredClone(first);
    extra.beatId = 'beat:p1:provider_extra';
    const anotherExtra = structuredClone(first);
    anotherExtra.beatId = 'beat:p1:provider_extra_2';
    pagePatch.actionRequirements = [semanticSecond, extra, anotherExtra];
    const patchValue = {
      presentationPatches: [],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [pagePatch],
    } satisfies BookSurfaceRepairPatch;
    const patchSnapshot = structuredClone(patchValue);
    const draftSnapshot = structuredClone(original);

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: patchValue,
    });
    const actions = (
      (result.pageContracts as Array<Record<string, unknown>>)[0]!
        .actionRequirements as Array<Record<string, unknown>>
    );
    expect(actions).toHaveLength(2);
    expect(actions[0]).toEqual(first);
    expect(actions[1]).toEqual({ ...semanticSecond, beatId: 'beat:p1:second' });
    expect(patchValue).toEqual(patchSnapshot);
    expect(original).toEqual(draftSnapshot);
  });

  it('does not admit an unbound provider-created source phenomenon subject', () => {
    const original = draft();
    const pageOne = (
      original.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    pageOne.actionRequirements = [
      {
        beatId: 'beat:p1:look',
        subject: {
          kind: 'entity',
          entityKind: 'cast',
          entityId: 'child:hero',
        },
        predicate: 'looks_at',
        object: { kind: 'cast', id: 'companion:fox' },
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'affirmative',
        laterality: null,
      },
    ];
    pageOne.actionSemanticCoverage = [
      {
        beatId: 'beat:p1:look',
        sourceEvidenceId: `se1_${'a'.repeat(64)}`,
        disposition: { kind: 'action_requirement' },
      },
    ];
    const issue: DraftValidationIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: { kind: 'page', fieldRole: 'final_structure', pageNumber: 1 },
      causes: ['page_action_requirements_invalid'],
    };
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: [issue],
      structuralValidationMessages: ['sanitized action validation'],
    });
    expect(selected).not.toBeNull();
    const pagePatch = structuralPatchFromAuthority(selected!);
    const authorityAction = (
      (selected!.affectedPages[0]!.pageContract.actionRequirements as Array<
        Record<string, unknown>
      >)[0]!
    );
    const patchAction = (
      pagePatch.actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    patchAction.subject = {
      kind: 'source_phenomenon',
      sourceEvidenceId: `se1_${'f'.repeat(64)}`,
    };

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: {
        presentationPatches: [],
        coverContract: null,
        recurringProps: null,
        pageStructuralPatches: [pagePatch],
      },
    });
    const resultAction = (
      (result.pageContracts as Array<Record<string, unknown>>)[0]!
        .actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    expect(resultAction.subject).toEqual(authorityAction.subject);
  });

  it('rejects every provider mustShow edit on presentation-target pages', () => {
    for (const providerMustShow of [
      ['provider changed the selected value', 'provider changed the other value'],
      ['provider shortened the array'],
      ['page 1 alternate visible beat', 'page 1 visible beat'],
      [],
    ]) {
      const original = draft();
      const snapshot = structuredClone(original);
      const selected = authority(original);
      const pagePatch = structuralPatch(1);
      pagePatch.mustShow = providerMustShow;

      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: {
            ...patch(),
            pageStructuralPatches: [pagePatch],
          },
        }),
      ).toThrow('book_surface_repair_non_target_drift');
      expect(original).toEqual(snapshot);
    }
  });

  it('keeps target-page mustShow exact while applying another authorized structural repair', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const pagePatch = structuralPatch(1);
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        ...patch(),
        pageStructuralPatches: [pagePatch],
      },
    });
    const pages = result.pageContracts as ReturnType<typeof page>[];
    expect(pages[0]?.camera).toBe('repaired page 1');
    expect(pages[0]?.mustShow).toEqual(
      (snapshot.pageContracts as ReturnType<typeof page>[])[0]?.mustShow,
    );
    expect(pages[0]?.actionSemanticCoverage[0]?.disposition).toEqual({
      kind: 'presentation_requirement',
      presentationClass: 'static_state',
      contractPointer: '/pageContracts/0/mustShow/0',
      contractValue: 'page 1 visible beat',
    });
    expect(original).toEqual(snapshot);
  });

  it('preserves mustShow repair authority on structural pages with no presentation target', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original, { pageNumbers: [3] });
    const pagePatch = structuralPatch(3);
    pagePatch.mustShow = ['provider repaired the non-target page'];

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        ...patch({ pageNumbers: [3] }),
        pageStructuralPatches: [pagePatch],
      },
    });
    const pages = result.pageContracts as ReturnType<typeof page>[];
    expect(pages[2]?.mustShow).toEqual(pagePatch.mustShow);
    expect(pages[0]?.mustShow).toEqual(
      (snapshot.pageContracts as ReturnType<typeof page>[])[0]?.mustShow,
    );
    expect(pages[1]?.mustShow).toEqual(
      (snapshot.pageContracts as ReturnType<typeof page>[])[1]?.mustShow,
    );
    expect(original).toEqual(snapshot);
  });

  it('resolves multiple same-page presentation targets against one frozen compiler array', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const secondaryBeatId = 'beat:p1:test-secondary';
    const secondarySourceEvidenceId = `se1_${'b'.repeat(64)}`;
    const originalPages = original.pageContracts as ReturnType<typeof page>[];
    originalPages[0]!.actionSemanticCoverage.push({
      beatId: secondaryBeatId,
      sourceEvidenceId: secondarySourceEvidenceId,
      disposition: {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      },
    });
    const originalWithSecondaryTarget = structuredClone(original);
    const secondaryTarget: PresentationRequirementRepairTarget = {
      ...presentationTarget(1),
      coverageIndex: 1,
      beatId: secondaryBeatId,
      sourceEvidenceId: secondarySourceEvidenceId,
      sourcePhrase: 'secondary source phrase page 1',
    };
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [presentationTarget(1), secondaryTarget],
      structuralDiagnosticIssues: [coverProjectionIssue, pageStructureIssue(1)],
      structuralValidationMessages: ['cover needs repair', 'page needs repair'],
    });
    expect(selected).not.toBeNull();
    const pagePatch = structuralPatch(1);

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: {
        ...patch({ presentationPageNumbers: [] }),
        presentationPatches: [
          presentationPatch(1, 'static_state', 0),
          {
            ...presentationPatch(1, 'composition_focus', 1),
            coverageIndex: 1,
            beatId: secondaryBeatId,
            sourceEvidenceId: secondarySourceEvidenceId,
          },
        ],
        pageStructuralPatches: [pagePatch],
      },
    });
    const resultPage = (result.pageContracts as ReturnType<typeof page>[])[0]!;
    expect(resultPage.mustShow).toEqual(
      (originalWithSecondaryTarget.pageContracts as ReturnType<typeof page>[])[0]!
        .mustShow,
    );
    expect(resultPage.actionSemanticCoverage.map((entry) => entry.disposition))
      .toEqual([
        {
          kind: 'presentation_requirement',
          presentationClass: 'static_state',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: 'page 1 visible beat',
        },
        {
          kind: 'presentation_requirement',
          presentationClass: 'composition_focus',
          contractPointer: '/pageContracts/0/mustShow/1',
          contractValue: 'page 1 alternate visible beat',
        },
      ]);
    expect(original).toEqual(originalWithSecondaryTarget);
    expect(
      (snapshot.pageContracts as ReturnType<typeof page>[])[0]!
        .actionSemanticCoverage,
    ).toHaveLength(1);
  });

  it('rejects missing, extra, duplicate, and reordered page targets before mutation', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original, { pageNumbers: [1, 2] });
    const validPatch = patch({ pageNumbers: [1, 2] });
    for (const pageStructuralPatches of [
      [structuralPatch(1)],
      [structuralPatch(1), structuralPatch(3)],
      [structuralPatch(1), structuralPatch(1)],
      [structuralPatch(2), structuralPatch(1)],
    ]) {
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: { ...validPatch, pageStructuralPatches },
        }),
      ).toThrow();
      expect(original).toEqual(snapshot);
    }
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          ...validPatch,
          pageStructuralPatches: [
            { ...structuralPatch(1), locationId: 'loc:other' },
            structuralPatch(2),
          ],
        },
      }),
    ).toThrow('book_surface_repair_non_target_drift');
    expect(original).toEqual(snapshot);
  });

  it('rejects missing, duplicate, reordered, stale, and unpermitted presentation patches atomically', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const validPatch = patch();
    for (const presentationPatches of [
      [presentationPatch(1)],
      [presentationPatch(1), presentationPatch(1)],
      [presentationPatch(2), presentationPatch(1)],
      [
        presentationPatch(1),
        {
          ...presentationPatch(2),
          contractPointer: '/pageContracts/1/mustShow/999',
        },
      ],
    ]) {
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: { ...validPatch, presentationPatches },
        }),
      ).toThrow();
      expect(original).toEqual(snapshot);
    }
  });

  it('reattaches compiler-owned presentation target identity by exact ordered target', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const hostilePatches = patch().presentationPatches.map(
      (presentationPatch, index) => ({
        ...presentationPatch,
        pageNumber: 90 + index,
        coverageIndex: 90 + index,
        beatId: `beat:p${90 + index}:provider_forged`,
        sourceEvidenceId: `se1_${String(index + 1).repeat(64)}`,
      }),
    );

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: {
        ...patch(),
        presentationPatches: hostilePatches,
      },
    });

    const pages = result.pageContracts as ReturnType<typeof page>[];
    expect(pages[0]!.actionSemanticCoverage[0]!.disposition).toEqual({
      kind: 'presentation_requirement',
      presentationClass: hostilePatches[0]!.presentationClass,
      contractPointer: hostilePatches[0]!.contractPointer,
      contractValue: pages[0]!.mustShow[0],
    });
    expect(pages[1]!.actionSemanticCoverage[0]!.disposition).toEqual({
      kind: 'presentation_requirement',
      presentationClass: hostilePatches[1]!.presentationClass,
      contractPointer: hostilePatches[1]!.contractPointer,
      contractValue: pages[1]!.mustShow[0],
    });
    expect(original).toEqual(snapshot);
  });

  it('preserves unauthorized cover and recurring props through explicit null output', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const coverPreservingAuthority = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [presentationTarget(1), presentationTarget(2)],
      structuralDiagnosticIssues: [pageStructureIssue(1)],
      structuralValidationMessages: ['sanitized page structure'],
    });
    expect(coverPreservingAuthority).not.toBeNull();
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: coverPreservingAuthority!,
      patch: { ...patch(), coverContract: null },
    });
    expect(result.coverContract).toEqual(snapshot.coverContract);
    expect(result.recurringProps).toEqual(snapshot.recurringProps);
    expect(original).toEqual(snapshot);
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: coverPreservingAuthority!,
        patch: patch(),
      }),
    ).toThrow('book_surface_repair_authority_mismatch');
  });

  it('repairs lifecycle by exact ordered slots while restoring recurring-prop identity', () => {
    const original = draft();
    original.recurringProps = [
      recurringProp(),
      recurringProp('prop:cart'),
    ];
    const pageOne = (
      original.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    pageOne.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
      { propId: 'prop:cart', visibility: 'forbidden' },
    ];
    const snapshot = structuredClone(original);
    const selected = authority(original, { lifecycle: true });
    const repairedProps: Record<string, unknown>[] = (
      selected.recurringProps as Record<string, unknown>[]
    ).map((value) => ({
      ...value,
      firstRevealPage: 2,
    }));
    const patchBase = patch({ lifecycle: true });
    const validPatch = {
      ...patchBase,
      recurringProps: repairedProps,
    };
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: validPatch,
    });
    expect(
      (result.recurringProps as Record<string, unknown>[]).map(
        (value) => value.id,
      ),
    ).toEqual(['prop:cake', 'prop:cart']);
    expect(
      (result.recurringProps as Record<string, unknown>[]).map(
        (value) => value.firstRevealPage,
      ),
    ).toEqual([2, 2]);
    expect(original).toEqual(snapshot);

    for (const recurringProps of [null, [repairedProps[0]!]]) {
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: { ...validPatch, recurringProps },
        }),
      ).toThrow();
      expect(original).toEqual(snapshot);
    }

    const hostileImmutableProps = structuredClone(repairedProps);
    hostileImmutableProps[0]!.id = 'prop:provider_forged';
    hostileImmutableProps[0]!.name = 'provider changed name';
    hostileImmutableProps[0]!.description = 'provider changed description';
    hostileImmutableProps[0]!.material = 'provider changed material';
    hostileImmutableProps[0]!.scale = 'provider changed scale';
    hostileImmutableProps[0]!.persistence = 'provider changed persistence';
    hostileImmutableProps[0]!.firstRevealPage = 2;
    hostileImmutableProps[1]!.id = 'prop:provider_forged_second';
    hostileImmutableProps[1]!.firstRevealPage = 2;
    const compilerOwnedResult = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: { ...validPatch, recurringProps: hostileImmutableProps },
    });
    const snapshotRecurringProps = snapshot.recurringProps as Record<
      string,
      unknown
    >[];
    expect(compilerOwnedResult.recurringProps).toEqual([
      { ...snapshotRecurringProps[0], firstRevealPage: 2 },
      { ...snapshotRecurringProps[1], firstRevealPage: 2 },
    ]);
    expect(original).toEqual(snapshot);

    const tamperedAuthority = structuredClone(selected);
    tamperedAuthority.recurringProps![0]!.name = 'tampered authority';
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: tamperedAuthority,
        patch: validPatch,
      }),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(original).toEqual(snapshot);

    const contextTamperedAuthority = structuredClone(selected);
    contextTamperedAuthority.recurringPropLifecycleContext[0]!
      .requiredPageNumbers.push(1);
    const {
      authorityDigest: _contextAuthorityDigest,
      ...contextTamperedContent
    } = contextTamperedAuthority;
    contextTamperedAuthority.authorityDigest = canonicalJsonDigest(
      contextTamperedContent,
    );
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: contextTamperedAuthority,
        patch: validPatch,
      }),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(original).toEqual(snapshot);
  });

  it('recomputes pre-reveal obligations from the effective recurring-prop repair', () => {
    const original = draft();
    original.recurringProps = [
      { ...recurringProp(), firstRevealPage: 3 },
    ];
    const pages = original.pageContracts as Array<Record<string, unknown>>;
    pages[0]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
      { propId: 'prop:unknown', visibility: 'required' },
    ];
    pages[1]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: [
        recurringPropLifecycleIssue,
        pageStructureIssueWithCause(1, 'page_prop_constraints_invalid'),
      ],
      structuralValidationMessages: [
        'sanitized lifecycle',
        'sanitized prop constraints',
      ],
    });
    expect(selected).not.toBeNull();
    const validPagePatch = structuralPatchFromAuthority(selected!);
    validPagePatch.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
    ];
    const recurringProps = [
      { ...recurringProp(), firstRevealPage: 2 },
    ];
    const snapshot = structuredClone(original);
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected!,
        patch: {
          presentationPatches: [],
          coverContract: null,
          recurringProps,
          pageStructuralPatches: [
            { ...validPagePatch, propConstraints: [] },
          ],
        },
      }),
    ).toThrow('book_surface_repair_lifecycle_obligation_invalid');
    expect(original).toEqual(snapshot);

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: {
        presentationPatches: [],
        coverContract: null,
        recurringProps,
        pageStructuralPatches: [validPagePatch],
      },
    });
    expect(result.recurringProps).toEqual(recurringProps);
    expect(original).toEqual(snapshot);
  });

  it('restores compiler-owned pre-reveal prohibitions when recurring props are not repairable', () => {
    const original = draft();
    original.recurringProps = [
      { ...recurringProp(), firstRevealPage: 3 },
    ];
    const pages = original.pageContracts as Array<Record<string, unknown>>;
    pages[0]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
      { propId: 'prop:unknown', visibility: 'required' },
    ];
    pages[1]!.propConstraints = [
      { propId: 'prop:cake', visibility: 'forbidden' },
    ];
    const selected = bookSurfaceRepairAuthority({
      draft: original,
      authorityDraft: original,
      presentationTargets: [],
      structuralDiagnosticIssues: [
        pageStructureIssueWithCause(1, 'page_prop_constraints_invalid'),
      ],
      structuralValidationMessages: ['sanitized prop constraints'],
    });
    expect(selected).not.toBeNull();
    const pagePatch = structuralPatchFromAuthority(selected!);
    pagePatch.propConstraints = [
      { propId: 'prop:cake', visibility: 'required' },
    ];
    const snapshot = structuredClone(original);

    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected!,
      patch: {
        presentationPatches: [],
        coverContract: null,
        recurringProps: null,
        pageStructuralPatches: [pagePatch],
      },
    });

    expect(
      (result.pageContracts as Array<Record<string, unknown>>)[0]!
        .propConstraints,
    ).toEqual([
      { propId: 'prop:cake', visibility: 'forbidden' },
    ]);
    expect(original).toEqual(snapshot);
  });

  it('reattaches compiler-owned cover identity while rejecting malformed identity shape', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const hostileCover = {
      ...cover(),
      worldType: 'magical',
      locationId: 'loc:other',
      zoneId: 'zone:unknown',
      castIds: ['child:unknown'],
      mustShow: ['provider repaired semantic cover content'],
    };
    const result = applyBookSurfaceRepairPatch({
      draft: original,
      authority: selected,
      patch: { ...patch(), coverContract: hostileCover },
    });
    expect(result.coverContract).toEqual({
      ...hostileCover,
      worldType: cover().worldType,
      locationId: cover().locationId,
      zoneId: cover().zoneId,
      castIds: cover().castIds,
    });
    expect(original).toEqual(snapshot);

    const invalidCurrent = draft();
    const invalidCurrentCover = invalidCurrent.coverContract as Record<
      string,
      unknown
    >;
    invalidCurrentCover.locationId = 'loc:stale';
    invalidCurrentCover.zoneId = 'zone:stale';
    invalidCurrentCover.castIds = [
      'child:hero',
      'cast:stale',
    ];
    const invalidSnapshot = structuredClone(invalidCurrent);
    const fallbackAuthority = authority(invalidCurrent);
    const fallbackResult = applyBookSurfaceRepairPatch({
      draft: invalidCurrent,
      authority: fallbackAuthority,
      patch: patch(),
    });
    expect(fallbackResult.coverContract).toMatchObject({
      worldType: 'grounded',
      locationId: 'loc:home',
      zoneId: 'zone:1',
      castIds: cover().castIds,
    });
    expect(invalidCurrent).toEqual(invalidSnapshot);

    const partiallyValidCurrent = draft();
    const partiallyValidCurrentCover =
      partiallyValidCurrent.coverContract as Record<string, unknown>;
    partiallyValidCurrentCover.locationId = 'loc:stale';
    partiallyValidCurrentCover.zoneId = 'zone:stale';
    partiallyValidCurrentCover.castIds = ['child:hero', 'cast:stale'];
    const partiallyValidSnapshot = structuredClone(partiallyValidCurrent);
    const partiallyValidAuthority = authority(partiallyValidCurrent);
    const partialFallbackResult = applyBookSurfaceRepairPatch({
      draft: partiallyValidCurrent,
      authority: partiallyValidAuthority,
      patch: {
        ...patch(),
        coverContract: {
          ...cover(),
          castIds: ['child:hero', 'cast:stale'],
        },
      },
    });
    expect(partialFallbackResult.coverContract).toMatchObject({
      worldType: 'grounded',
      locationId: 'loc:home',
      zoneId: 'zone:1',
      castIds: ['child:hero'],
    });
    expect(partiallyValidCurrent).toEqual(partiallyValidSnapshot);

    const fullyInvalidCurrent = draft();
    const fullyInvalidCurrentCover =
      fullyInvalidCurrent.coverContract as Record<string, unknown>;
    fullyInvalidCurrentCover.locationId = 'loc:stale';
    fullyInvalidCurrentCover.zoneId = 'zone:stale';
    fullyInvalidCurrentCover.castIds = ['cast:stale'];
    const fullyInvalidSnapshot = structuredClone(fullyInvalidCurrent);
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: fullyInvalidCurrent,
        authority: authority(fullyInvalidCurrent),
        patch: {
          ...patch(),
          coverContract: {
            ...cover(),
            castIds: ['child:hero', 'cast:stale'],
          },
        },
      }),
    ).toThrow('book_surface_repair_cover_reference_invalid');
    expect(fullyInvalidCurrent).toEqual(fullyInvalidSnapshot);

    for (const coverContract of [
      { ...cover(), worldType: '' },
      { ...cover(), locationId: null },
      { ...cover(), zoneId: '   ' },
      { ...cover(), castIds: [] },
      { ...cover(), castIds: [null] },
    ]) {
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: {
            ...patch(),
            coverContract: coverContract as unknown as Record<string, unknown>,
          },
        }),
      ).toThrow('book_surface_repair_cover_invalid');
      expect(original).toEqual(snapshot);
    }
  });
});
