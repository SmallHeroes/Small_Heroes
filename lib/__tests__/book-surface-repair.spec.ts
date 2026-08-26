import { describe, expect, it } from 'vitest';

import type {
  DraftValidationIssue,
  PageFinalStructuralCause,
} from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import { PAGE_TRANSITION_STRUCTURAL_CAUSES } from '@/lib/visual-contract-compiler/draftValidationDiagnostics';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_PROMPT_VERSION,
  BOOK_SURFACE_REPAIR_SCHEMA_VERSION,
  BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
  applyBookSurfaceRepairPatch as applyBookSurfaceRepairPatchWithAuthorityDraft,
  bookSurfaceRepairAuthority,
  buildBookSurfaceRepairSystemPrompt,
  buildBookSurfaceRepairUserPrompt as buildBookSurfaceRepairUserPromptWithPrivateAuthority,
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
import {
  analyzePageTransition,
  analyzeTransitionSequence,
} from '@/lib/visual-contract-compiler/transitionAnalysis';
import type { PageVisualContract } from '@/lib/visual-contract-compiler/types';

function buildBookSurfaceRepairUserPrompt(args: {
  authority: BookSurfaceRepairAuthority;
  authorityDraft: Record<string, unknown>;
  expectedAuthorityDigest?: string;
}): string {
  return buildBookSurfaceRepairUserPromptWithPrivateAuthority({
    authority: args.authority,
    authorityDraft: args.authorityDraft,
    expectedAuthorityDigest:
      args.expectedAuthorityDigest ?? args.authority.authorityDigest,
  });
}

// Most unit fixtures use the same bytes for authored and compiler-effective
// state. Tests that exercise normalization pass authorityDraft explicitly.
function applyBookSurfaceRepairPatch(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  authorityDraft?: Record<string, unknown>;
  expectedAuthorityDigest?: string;
  patch: BookSurfaceRepairPatch;
}): Record<string, unknown> {
  return applyBookSurfaceRepairPatchWithAuthorityDraft({
    draft: args.draft,
    authority: args.authority,
    authorityDraft: args.authorityDraft ?? args.draft,
    expectedAuthorityDigest:
      args.expectedAuthorityDigest ?? args.authority.authorityDigest,
    patch: args.patch,
  });
}

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
      kind: pageNumber === 1 ? 'steady' : 'after_transition',
      fromZoneId: pageNumber === 1 ? null : `zone:${pageNumber - 1}`,
      toZoneId: pageNumber === 1 ? null : `zone:${pageNumber}`,
      cue: pageNumber === 1 ? null : `enter zone ${pageNumber}`,
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
    presentationClass: 'static_state',
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
    pointerChoiceIndex: mustShowIndex,
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

function finalStructuralRepairTarget(
  target: BookSurfaceRepairAuthority['affectedPages'][number]['repairTargets'][number],
) {
  if (target.code !== 'final_structural_invariant_invalid') {
    throw new Error('expected final structural repair target');
  }
  return target;
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

function openingTransitionFailure(value: Record<string, unknown>) {
  const pages = value.pageContracts as Array<Record<string, unknown>>;
  pages.find((candidate) => candidate.pageNumber === 1)!.transition = {
    kind: 'threshold',
    fromZoneId: 'zone:1',
    toZoneId: 'zone:2',
    cue: 'opening departure',
  };
  return {
    issue: {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: [
        'page_transition_invalid',
        'page_transition_opening_departure_without_origin',
      ].sort(),
    } as DraftValidationIssue,
    message:
      'page 1 declares a threshold transition with no established origin — the opening page must be steady or before_transition (nothing precedes it to depart from)',
  };
}

function analyzedTransitionFailures(value: Record<string, unknown>) {
  const pages = (value.pageContracts as Array<Record<string, unknown>>).map(
    (candidate, pageIndex) => ({
      page: candidate as unknown as PageVisualContract,
      pageIndex,
    }),
  );
  const declaredZoneIds = new Set(
    (value.zones as Array<{ id: string }>).map((zone) => zone.id),
  );
  const findings = [
    ...pages.flatMap(({ page }) =>
      analyzePageTransition({
        label: `page ${page.pageNumber}`,
        page,
        declaredZoneIds,
      }).map((finding) => ({ pageNumber: page.pageNumber, ...finding })),
    ),
    ...analyzeTransitionSequence(pages).flatMap((analysis) =>
      analysis.findings.map((finding) => ({
        pageNumber: analysis.pageNumber,
        ...finding,
      })),
    ),
  ];
  return {
    issues: findings.map(
      ({ pageNumber, cause }) => ({
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'page',
          fieldRole: 'final_structure',
          pageNumber,
        },
        causes: ['page_transition_invalid', cause].sort(),
      }) as DraftValidationIssue,
    ),
    messages: findings.map(({ message }) => message),
    findings,
  };
}

function transitionAuthorityFor(
  value: Record<string, unknown>,
  authorityDraft = value,
): BookSurfaceRepairAuthority {
  const failures = analyzedTransitionFailures(authorityDraft);
  const selected = bookSurfaceRepairAuthority({
    draft: value,
    authorityDraft,
    presentationTargets: [],
    structuralDiagnosticIssues: failures.issues,
    structuralValidationMessages: failures.messages,
  });
  expect(failures.issues.length).toBeGreaterThan(0);
  expect(selected).not.toBeNull();
  return selected!;
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

describe('atomic causal book-surface repair v13 typed input authority', () => {
  it('publishes the byte-identical strict v7 schema under v13 prompts with nullable cover/props and no action coverage', () => {
    expect(BOOK_SURFACE_REPAIR_SCHEMA_VERSION).toBe(
      'book-surface-repair-schema/v7',
    );
    expect(BOOK_SURFACE_REPAIR_PROMPT_VERSION).toBe(
      'book-surface-repair-prompt/v13',
    );
    expect(BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION).toBe(
      'book-surface-repair-user-prompt/v13',
    );
    expect(canonicalJsonDigest(BOOK_SURFACE_REPAIR_JSON_SCHEMA)).toBe(
      'a1d16581b25d9af14b33fdaa21806713f739212e51afa53643ba4c030739b20f',
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
    const presentationPatchSchema = (
      properties.presentationPatches?.items as Record<string, unknown>
    ).properties as Record<string, unknown>;
    expect(presentationPatchSchema).toHaveProperty(
      'pointerChoiceIndex',
      { type: 'integer', minimum: 0 },
    );
    expect(presentationPatchSchema).not.toHaveProperty('contractPointer');
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
      buildBookSurfaceRepairUserPrompt({
        authority: selected!,
        authorityDraft: value,
      }),
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
        buildBookSurfaceRepairUserPrompt({
          authority: tampered,
          authorityDraft: value,
        }),
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
      buildBookSurfaceRepairUserPrompt({
        authority: selected,
        authorityDraft: lifecycleDraft,
      }),
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

  it('maps every non-transition page cause to its exact writable fields', () => {
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
      expect(selected!.transitionAuthority).toBeNull();
    }
  });

  it('maps a broad transition cause plus its closed subtype only to transition authority', () => {
    expect(PAGE_TRANSITION_STRUCTURAL_CAUSES).toHaveLength(13);
    const value = draft();
    const failure = openingTransitionFailure(value);
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [failure.issue],
      structuralValidationMessages: [failure.message],
    });
    expect(selected).not.toBeNull();
    expect(selected!.affectedPages[0]!.writableFields).toEqual([
      'transition',
    ]);
    expect(selected!.affectedPages[0]!.repairTargets[0]).toMatchObject({
      causes: [
        'page_transition_invalid',
        'page_transition_opening_departure_without_origin',
      ].sort(),
    });
    expect(selected!.transitionAuthority!.declaredZoneIds).toEqual([
      'zone:1',
      'zone:2',
      'zone:3',
    ]);
    expect(selected!.transitionAuthority!.authorityDraftDigest).toBe(
      canonicalJsonDigest(value),
    );
    expect(selected!.transitionAuthority!.pages[0]).toMatchObject({
      pageNumber: 1,
      previous: null,
      next: { pageNumber: 2, zoneId: 'zone:2' },
      establishedZoneIdsBeforePage: [],
      lastThresholdEdgeBeforePage: null,
    });
    expect(() =>
      buildBookSurfaceRepairUserPrompt({
        authority: selected!,
        authorityDraft: value,
      }),
    ).not.toThrow();
    expect(() =>
      buildBookSurfaceRepairUserPromptWithPrivateAuthority({
        authority: selected!,
        expectedAuthorityDigest: selected!.authorityDigest,
      } as never),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      buildBookSurfaceRepairUserPromptWithPrivateAuthority({
        authority: selected!,
        authorityDraft: value,
      } as never),
    ).toThrow('book_surface_repair_authority_mismatch');
    expect(() =>
      applyBookSurfaceRepairPatchWithAuthorityDraft({
        draft: value,
        authority: selected!,
        expectedAuthorityDigest: selected!.authorityDigest,
        patch: {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [
            structuralPatchFromAuthority(selected!),
          ],
        },
      } as never),
    ).toThrow('book_surface_repair_authority_mismatch');
  });

  it('canonicalizes out-of-order pages but rejects duplicate, gapped, missing-target, broad-only, and false subtype authority', () => {
    const unordered = draft();
    const unorderedPages = unordered.pageContracts as Array<
      Record<string, unknown>
    >;
    unordered.pageContracts = [
      unorderedPages[2]!,
      unorderedPages[0]!,
      unorderedPages[1]!,
    ];
    const opening = openingTransitionFailure(unordered);
    const selected = bookSurfaceRepairAuthority({
      draft: unordered,
      authorityDraft: unordered,
      presentationTargets: [],
      structuralDiagnosticIssues: [opening.issue],
      structuralValidationMessages: [opening.message],
    });
    expect(selected).not.toBeNull();
    expect(
      selected!.transitionAuthority!.pages.map((candidate) =>
        candidate.pageNumber,
      ),
    ).toEqual([1, 2, 3]);
    expect(
      selected!.transitionAuthority!.pages.map((candidate) => ({
        pageNumber: candidate.pageNumber,
        previous: candidate.previous,
        next: candidate.next,
      })),
    ).toEqual([
      {
        pageNumber: 1,
        previous: null,
        next: { pageNumber: 2, zoneId: 'zone:2' },
      },
      {
        pageNumber: 2,
        previous: { pageNumber: 1, zoneId: 'zone:1' },
        next: { pageNumber: 3, zoneId: 'zone:3' },
      },
      {
        pageNumber: 3,
        previous: { pageNumber: 2, zoneId: 'zone:2' },
        next: null,
      },
    ]);

    for (const mutate of [
      (value: Record<string, unknown>) => {
        const pages = value.pageContracts as Array<Record<string, unknown>>;
        pages[2]!.pageNumber = 2;
      },
      (value: Record<string, unknown>) => {
        const pages = value.pageContracts as Array<Record<string, unknown>>;
        pages[2]!.pageNumber = 4;
      },
    ]) {
      const invalid = draft();
      mutate(invalid);
      const failure = openingTransitionFailure(invalid);
      expect(
        bookSurfaceRepairAuthority({
          draft: invalid,
          authorityDraft: invalid,
          presentationTargets: [],
          structuralDiagnosticIssues: [failure.issue],
          structuralValidationMessages: [failure.message],
        }),
      ).toBeNull();
    }

    const value = draft();
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [],
        structuralDiagnosticIssues: [
          pageStructureIssueWithCause(1, 'page_transition_invalid'),
        ],
        structuralValidationMessages: ['legacy broad transition issue'],
      }),
    ).toBeNull();
    expect(
      bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [],
        structuralDiagnosticIssues: [
          {
            ...pageStructureIssueWithCause(
              9,
              'page_transition_opening_departure_without_origin',
            ),
            causes: [
              'page_transition_invalid',
              'page_transition_opening_departure_without_origin',
            ],
          } as DraftValidationIssue,
        ],
        structuralValidationMessages: ['missing target'],
      }),
    ).toBeNull();

    const falseSubtype = draft();
    const falseFailure = openingTransitionFailure(falseSubtype);
    expect(
      bookSurfaceRepairAuthority({
        draft: falseSubtype,
        authorityDraft: falseSubtype,
        presentationTargets: [],
        structuralDiagnosticIssues: [
          {
            ...falseFailure.issue,
            causes: [
              'page_transition_invalid',
              'page_transition_origin_not_established',
            ].sort(),
          } as DraftValidationIssue,
        ],
        structuralValidationMessages: [falseFailure.message],
      }),
    ).toBeNull();
  });

  it('distinguishes the same target page through prior-threshold and established-history authority', () => {
    const priorThreshold = (kind: 'threshold' | 'after_transition') => {
      const value = draft();
      const pages = value.pageContracts as Array<Record<string, unknown>>;
      pages[1]!.transition = {
        kind,
        fromZoneId: 'zone:1',
        toZoneId: 'zone:2',
        cue: 'same edge',
      };
      pages[2]!.transition = {
        kind: 'after_transition',
        fromZoneId: 'zone:1',
        toZoneId: 'zone:2',
        cue: 'common target',
      };
      return value;
    };
    const thresholdGood = priorThreshold('threshold');
    const thresholdBad = priorThreshold('after_transition');
    const goodAuthority = transitionAuthorityFor(thresholdGood);
    const badAuthority = transitionAuthorityFor(thresholdBad);
    const goodTarget = goodAuthority.affectedPages.find(
      (candidate) => candidate.pageNumber === 3,
    )!;
    const badTarget = badAuthority.affectedPages.find(
      (candidate) => candidate.pageNumber === 3,
    )!;
    expect(goodTarget.pageContract).toEqual(badTarget.pageContract);
    expect(goodTarget.readOnlyContext).toEqual(badTarget.readOnlyContext);
    expect(finalStructuralRepairTarget(goodTarget.repairTargets[0]!).causes).not.toContain(
      'page_transition_origin_not_previous_zone',
    );
    expect(finalStructuralRepairTarget(badTarget.repairTargets[0]!).causes).toContain(
      'page_transition_origin_not_previous_zone',
    );
    expect(
      goodAuthority.transitionAuthority!.pages[2]!
        .lastThresholdEdgeBeforePage,
    ).toEqual({ fromZoneId: 'zone:1', toZoneId: 'zone:2' });
    expect(
      badAuthority.transitionAuthority!.pages[2]!
        .lastThresholdEdgeBeforePage,
    ).toBeNull();

    const establishedHistory = (openingZone: string) => {
      const value = draft(4);
      const pages = value.pageContracts as Array<Record<string, unknown>>;
      pages[0]!.zoneId = openingZone;
      pages[1]!.transition = {
        kind: 'after_transition',
        fromZoneId: openingZone,
        toZoneId: 'zone:2',
        cue: 'enter B',
      };
      pages[2]!.zoneId = 'zone:2';
      pages[2]!.transition = {
        kind: 'threshold',
        fromZoneId: 'zone:1',
        toZoneId: 'zone:2',
        cue: 'common threshold',
      };
      pages[3]!.transition = {
        kind: 'after_transition',
        fromZoneId: 'zone:1',
        toZoneId: 'zone:2',
        cue: 'common suffix',
      };
      return value;
    };
    const establishedGood = establishedHistory('zone:1');
    const establishedBad = establishedHistory('zone:3');
    const historyGood = transitionAuthorityFor(establishedGood);
    const historyBad = transitionAuthorityFor(establishedBad);
    const goodPage4 = historyGood.affectedPages.find(
      (candidate) => candidate.pageNumber === 4,
    )!;
    const badPage4 = historyBad.affectedPages.find(
      (candidate) => candidate.pageNumber === 4,
    )!;
    expect(goodPage4.pageContract).toEqual(badPage4.pageContract);
    expect(goodPage4.readOnlyContext).toEqual(badPage4.readOnlyContext);
    expect(finalStructuralRepairTarget(goodPage4.repairTargets[0]!).causes).not.toContain(
      'page_transition_origin_not_established',
    );
    expect(finalStructuralRepairTarget(badPage4.repairTargets[0]!).causes).toContain(
      'page_transition_origin_not_established',
    );
    const goodPage4State = historyGood.transitionAuthority!.pages[3]!;
    const badPage4State = historyBad.transitionAuthority!.pages[3]!;
    expect(goodPage4State.previous).toEqual(badPage4State.previous);
    expect(goodPage4State.lastThresholdEdgeBeforePage).toEqual(
      badPage4State.lastThresholdEdgeBeforePage,
    );
    expect(goodPage4State.establishedZoneIdsBeforePage).toContain('zone:1');
    expect(badPage4State.establishedZoneIdsBeforePage).not.toContain(
      'zone:1',
    );
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
    const failure = openingTransitionFailure(value);
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [failure.issue],
      structuralValidationMessages: [failure.message],
    });
    expect(selected).not.toBeNull();
    const originalBytes = JSON.stringify(value);
    const mutations: Array<(candidate: BookSurfaceRepairAuthority) => void> = [
      (candidate) => candidate.transitionAuthority!.pages.reverse(),
      (candidate) => { candidate.transitionAuthority!.pages.pop(); },
      (candidate) => {
        candidate.transitionAuthority!.pages.push(
          structuredClone(candidate.transitionAuthority!.pages[1]!),
        );
      },
      (candidate) => {
        candidate.transitionAuthority!.pages[1]!.effectiveTransition.kind =
          'threshold';
      },
      (candidate) => {
        candidate.transitionAuthority!.pages[1]!.effectiveTransition.fromZoneId =
          'zone:3';
      },
      (candidate) => {
        candidate.transitionAuthority!.pages[0]!
          .establishedZoneIdsBeforePage = ['zone:tampered'];
      },
      (candidate) => {
        candidate.transitionAuthority!.pages[1]!
          .lastThresholdEdgeBeforePage = {
            fromZoneId: 'zone:1',
            toZoneId: 'zone:2',
          };
      },
      (candidate) => {
        candidate.transitionAuthority!.declaredZoneIds = ['zone:1'];
      },
      (candidate) => {
        candidate.transitionAuthority!.authorityDraftDigest = 'f'.repeat(64);
      },
      (candidate) => {
        finalStructuralRepairTarget(
          candidate.affectedPages[0]!.repairTargets[0]!,
        ).causes = [
          'page_transition_invalid',
          'page_transition_origin_not_established',
        ];
      },
      (candidate) => {
        finalStructuralRepairTarget(
          candidate.affectedPages[0]!.repairTargets[0]!,
        ).causes = ['page_prop_state_invalid'];
        candidate.affectedPages[0]!.writableFields = ['propState'];
        candidate.transitionAuthority = null;
      },
    ];
    for (const mutate of mutations) {
      const tampered = structuredClone(selected!);
      mutate(tampered);
      const { authorityDigest: _digest, ...content } = tampered;
      tampered.authorityDigest = canonicalJsonDigest(content);
      expect(() =>
        buildBookSurfaceRepairUserPrompt({
          authority: tampered,
          authorityDraft: value,
          expectedAuthorityDigest: selected!.authorityDigest,
        }),
      ).toThrow('book_surface_repair_authority_mismatch');
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: value,
          authority: tampered,
          authorityDraft: value,
          expectedAuthorityDigest: selected!.authorityDigest,
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
      expect(JSON.stringify(value)).toBe(originalBytes);
    }
  });

  it('uses one deterministic zone ordering for transition and reference authority', () => {
    const value = draft(5);
    const zoneIds = ['zone_1', 'zone-1', 'zone:1', 'zone:a', 'zone:A'];
    const zones = value.zones as Array<Record<string, unknown>>;
    const pages = value.pageContracts as Array<Record<string, unknown>>;
    for (let index = 0; index < zoneIds.length; index += 1) {
      zones[index]!.id = zoneIds[index]!;
      pages[index]!.zoneId = zoneIds[index]!;
      pages[index]!.transition =
        index === 0
          ? {
              kind: 'threshold',
              fromZoneId: zoneIds[0],
              toZoneId: zoneIds[1],
              cue: 'opening departure',
            }
          : {
              kind: 'after_transition',
              fromZoneId: zoneIds[index - 1],
              toZoneId: zoneIds[index],
              cue: `enter ${zoneIds[index]}`,
            };
    }
    const selected = transitionAuthorityFor(value);
    const lexicalOrder = [
      'zone-1',
      'zone:1',
      'zone:A',
      'zone:a',
      'zone_1',
    ];
    expect(selected.transitionAuthority!.declaredZoneIds).toEqual(
      lexicalOrder,
    );
    expect(selected.referenceAuthority.zones.map((zone) => zone.id)).toEqual(
      lexicalOrder,
    );
    expect(() =>
      buildBookSurfaceRepairUserPrompt({
        authority: selected,
        authorityDraft: value,
      }),
    ).not.toThrow();
    const pagePatch = structuralPatchFromAuthority(selected);
    pagePatch.transition = {
      kind: 'steady',
      fromZoneId: null,
      toZoneId: null,
      cue: null,
    };
    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: value,
        authority: selected,
        authorityDraft: value,
        patch: {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [pagePatch],
        },
      }),
    ).not.toThrow();
  });

  it('rejects invented or normalization-looking transition endpoints before mutation', () => {
    const value = draft();
    openingTransitionFailure(value);
    const selected = transitionAuthorityFor(value);
    const originalBytes = JSON.stringify(value);
    for (const endpoint of ['zone:invented', 'ZONE:1']) {
      const pagePatch = structuralPatchFromAuthority(selected);
      pagePatch.transition = {
        ...(pagePatch.transition as Record<string, unknown>),
        fromZoneId: endpoint,
      };
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: value,
          authority: selected,
          authorityDraft: value,
          patch: {
            presentationPatches: [],
            coverContract: null,
            recurringProps: null,
            pageStructuralPatches: [pagePatch],
          },
        }),
      ).toThrow('book_surface_repair_transition_reference_invalid');
      expect(JSON.stringify(value)).toBe(originalBytes);
    }
  });

  it('exposes typed effective transition state without compiler digest, raw prose, adjacent cue, or private material', () => {
    const value = draft();
    const pages = value.pageContracts as Array<Record<string, unknown>>;
    pages[1]!.transition = {
      ...(pages[1]!.transition as Record<string, unknown>),
      cue: 'ADJACENT_CUE_SENTINEL',
    };
    const failure = openingTransitionFailure(value);
    const selected = bookSurfaceRepairAuthority({
      draft: value,
      authorityDraft: value,
      presentationTargets: [],
      structuralDiagnosticIssues: [failure.issue],
      structuralValidationMessages: [failure.message],
    })!;
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
      authorityDraft: value,
    });
    const decoded = decodeBookSurfaceRepairUserPrompt(rawPrompt) as {
      transitionAuthority: Record<string, unknown>;
    };
    expect(decoded.transitionAuthority).not.toHaveProperty(
      'authorityDraftDigest',
    );
    expect(decoded.transitionAuthority).toHaveProperty('declaredZoneIds');
    expect(decoded.transitionAuthority).toHaveProperty('pages');
    for (const forbidden of [
      selected.transitionAuthority!.authorityDraftDigest,
      failure.message,
      'ADJACENT_CUE_SENTINEL',
      'RAW_STORY_SOURCE_SENTINEL',
      'PROVIDER_RESPONSE_SENTINEL',
      'SECRET_CREDENTIAL_SENTINEL',
      'REMOVE_SENTINEL',
      'attemptIndex',
    ]) {
      expect(rawPrompt).not.toContain(forbidden);
    }
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
        buildBookSurfaceRepairUserPrompt({
          authority: selected!,
          authorityDraft: original,
        }),
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
    const value = draft();
    const selected = authority(value);
    const rawPrompt = buildBookSurfaceRepairUserPrompt({
      authority: selected,
      authorityDraft: value,
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
      authorityDraft: value,
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
      authorityDraft: value,
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
      authorityDraft: value,
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

  it.each([8, 12])(
    'freezes compact transition-chain accounting with %i pages',
    (pageCount) => {
      const value = draft(pageCount);
      const failure = openingTransitionFailure(value);
      const issues: DraftValidationIssue[] = [failure.issue];
      const messages = [failure.message];
      if (pageCount === 12) {
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
        for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
          for (let index = 0; index < 7; index += 1) {
            issues.push(
              pageStructureIssueWithCause(
                pageNumber,
                'page_prop_constraints_invalid',
              ),
            );
            messages.push(`typed prop violation ${pageNumber}:${index}`);
          }
        }
      }
      const selected = bookSurfaceRepairAuthority({
        draft: value,
        authorityDraft: value,
        presentationTargets: [],
        structuralDiagnosticIssues: issues,
        structuralValidationMessages: messages,
      });
      expect(selected).not.toBeNull();
      const systemPrompt = buildBookSurfaceRepairSystemPrompt();
      const userPrompt = buildBookSurfaceRepairUserPrompt({
        authority: selected!,
        authorityDraft: value,
      });
      const decoded = decodeBookSurfaceRepairUserPrompt(userPrompt) as {
        transitionAuthority: { pages: unknown[] };
        affectedPages: Array<{ propConstraintViolations: unknown[] }>;
      };
      const accounting = visualContractAuthoringInputAccounting(
        systemPrompt,
        userPrompt,
        BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      );
      expect(decoded.transitionAuthority.pages).toHaveLength(pageCount);
      expect(
        decoded.affectedPages.flatMap(
          (candidate) => candidate.propConstraintViolations,
        ),
      ).toHaveLength(pageCount === 12 ? 84 : 0);
      expect(accounting).toEqual(
        pageCount === 8
          ? {
              systemBytes: 3_523,
              userBytes: 3_234,
              schemaBytes: 15_921,
              separatorBytes: 2,
              protocolAllowance: 4_096,
              estimatedBytes: 26_776,
            }
          : {
              systemBytes: 3_523,
              userBytes: 7_089,
              schemaBytes: 15_921,
              separatorBytes: 2,
              protocolAllowance: 4_096,
              estimatedBytes: 30_631,
            },
      );
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
    },
  );

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

  it('rejects missing, duplicate, and reordered presentation targets with a distinct association error before mutation', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);
    const validPatch = patch();
    for (const presentationPatches of [
      [presentationPatch(1)],
      [presentationPatch(1), presentationPatch(1)],
      [presentationPatch(2, 'composition_focus', 1), presentationPatch(1)],
    ]) {
      expect(() =>
        applyBookSurfaceRepairPatch({
          draft: original,
          authority: selected,
          patch: { ...validPatch, presentationPatches },
        }),
      ).toThrow(
        'presentation_requirement_repair_target_association_invalid',
      );
      expect(original).toEqual(snapshot);
    }
  });

  it('rejects out-of-range bounded choices and invalid classes distinctly before mutation', () => {
    const original = draft();
    const snapshot = structuredClone(original);
    const selected = authority(original);

    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          ...patch(),
          presentationPatches: [
            presentationPatch(1),
            { ...presentationPatch(2), pointerChoiceIndex: 999 },
          ],
        },
      }),
    ).toThrow(
      'presentation_requirement_repair_pointer_choice_not_permitted',
    );
    expect(original).toEqual(snapshot);

    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          ...patch(),
          presentationPatches: [
            { ...presentationPatch(1), presentationClass: 'invalid' },
            presentationPatch(2),
          ],
        } as never,
      }),
    ).toThrow('presentation_requirement_repair_class_invalid');
    expect(original).toEqual(snapshot);
  });

  it('rejects forged presentation identities instead of restoring them by array position', () => {
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

    expect(() =>
      applyBookSurfaceRepairPatch({
        draft: original,
        authority: selected,
        patch: {
          ...patch(),
          presentationPatches: hostilePatches,
        },
      }),
    ).toThrow(
      'presentation_requirement_repair_target_association_invalid',
    );
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
