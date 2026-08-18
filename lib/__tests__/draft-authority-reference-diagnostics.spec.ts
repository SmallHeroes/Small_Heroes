import { describe, expect, it } from 'vitest';

import { canonicalize } from '../canonical-json';
import {
  DraftAuthorityReferenceDomainError,
  compilerOwnedActionCheckId,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG,
  MAX_DRAFT_AUTHORITY_REFERENCE_STRUCTURAL_INDEX,
  MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES,
  buildDraftAuthorityReferenceDiagnostics,
  draftAuthorityReferenceDiagnosticsIsValid,
  draftAuthorityReferenceIssueIsValid,
  normalizeDraftAuthorityReferenceIssues,
  type DraftAuthorityReferenceIssue,
} from '../visual-contract-compiler/draftAuthorityReferenceDiagnostics';
import {
  authoringTerminalFailureIsValid,
  buildAuthoringTerminalFailure,
} from '../visual-package/authoringTerminalDiagnostics';
import {
  buildVisualContractAuthoringTerminalFailure,
  legacyVisualContractAuthoringTerminalFailureIsValid,
  legacyVisualContractRepairOutputDiagnosticsIsValid,
  legacyVisualContractRepairOutputDiagnosticsV1IsValid,
  visualContractAuthoringTerminalFailureIsValid,
  visualContractRepairRouteAdmissionDiagnosticsIsValid,
  visualContractRepairOutputDiagnosticsIsValid,
  visualContractRepairOutputDiagnosticsIsReadable,
  visualContractRepairOutputDiagnosticsVersionStatus,
} from '../visual-package/visualContractAuthoringTerminalDiagnostics';

const representativeIssues: DraftAuthorityReferenceIssue[] = [
  {
    code: 'action_check_id_forbidden',
    locator: {
      kind: 'page_action',
      referenceClass: 'action_identity',
      fieldRole: 'actionRequirements.checkId',
      pageNumber: 1,
      actionIndex: 0,
    },
  },
  {
    code: 'action_beat_id_outside_page_authority',
    locator: {
      kind: 'page_action_field',
      referenceClass: 'action_identity',
      fieldRole: 'actionRequirements.beatId',
      pageNumber: 1,
    },
  },
  {
    code: 'action_beat_binding_cardinality_invalid',
    locator: {
      kind: 'page_action',
      referenceClass: 'action_identity',
      fieldRole: 'actionRequirements.beatId',
      pageNumber: 1,
      actionIndex: 1,
    },
  },
  {
    code: 'coverage_check_id_forbidden',
    locator: {
      kind: 'page_coverage',
      referenceClass: 'action_coverage',
      fieldRole: 'actionSemanticCoverage.checkId',
      pageNumber: 1,
      coverageIndex: 0,
    },
  },
  {
    code: 'coverage_action_binding_cardinality_invalid',
    locator: {
      kind: 'page_coverage',
      referenceClass: 'action_coverage',
      fieldRole: 'actionSemanticCoverage.actionRequirementBinding',
      pageNumber: 1,
      coverageIndex: 1,
    },
  },
  {
    code: 'coverage_beat_cardinality_invalid',
    locator: {
      kind: 'page_coverage',
      referenceClass: 'action_coverage',
      fieldRole: 'actionSemanticCoverage.beatId',
      pageNumber: 1,
      coverageIndex: 2,
    },
  },
  {
    code: 'action_coverage_cardinality_invalid',
    locator: {
      kind: 'page_action',
      referenceClass: 'action_coverage',
      fieldRole: 'actionRequirements.actionSemanticCoverage',
      pageNumber: 1,
      actionIndex: 2,
    },
  },
  {
    code: 'unary_relation_object_forbidden',
    locator: {
      kind: 'set_area_relation',
      referenceClass: 'spatial_relation',
      fieldRole: 'spatialRelations.objectId',
      authorityIndex: 0,
      areaIndex: 0,
      relationIndex: 0,
    },
  },
  {
    code: 'binary_relation_object_required',
    locator: {
      kind: 'page_zone_relation',
      referenceClass: 'spatial_relation',
      fieldRole: 'spatialRelations.objectId',
      zoneIndex: 0,
      relationIndex: 0,
    },
  },
  {
    code: 'page_zone_id_duplicate',
    locator: {
      kind: 'page_zone',
      referenceClass: 'page_zone',
      fieldRole: 'zones.id',
      zoneIndex: 1,
    },
  },
  {
    code: 'set_fixed_objects_forbidden',
    locator: {
      kind: 'set_authority',
      referenceClass: 'set_identity',
      fieldRole: 'setBoardAuthorities.fixedObjects',
      authorityIndex: 0,
    },
  },
  {
    code: 'set_identity_id_duplicate',
    locator: {
      kind: 'set_authority',
      referenceClass: 'set_identity',
      fieldRole: 'setBoardAuthorities.setIdentityId',
      authorityIndex: 1,
    },
  },
  ...([
    'recurring_prop_reference_type_invalid',
    'recurring_prop_reference_cardinality_invalid',
    'recurring_prop_lifecycle_gated',
    'recurring_prop_consumer_forbidden',
  ] as const).map((code, nodeIndex) => ({
    code,
    locator: {
      kind: 'set_area_node' as const,
      referenceClass: 'recurring_prop' as const,
      fieldRole: 'spatialNodes.stablePropId' as const,
      authorityIndex: 0,
      areaIndex: 0,
      nodeIndex,
    },
  })),
  {
    code: 'zone_projection_cardinality_invalid',
    locator: {
      kind: 'set_area_projection',
      referenceClass: 'zone_projection',
      fieldRole: 'zoneProjection.cardinality',
      authorityIndex: 0,
      areaIndex: 0,
    },
  },
  ...([
    'zone_projection_duplicate_zone',
    'zone_projection_unknown_zone',
    'zone_projection_location_mismatch',
    'zone_projection_ambiguous_owner',
  ] as const).map((code, projectionIndex) => ({
    code,
    locator: {
      kind: 'set_area_projection_zone' as const,
      referenceClass: 'zone_projection' as const,
      fieldRole: 'zoneProjection.zoneIds' as const,
      authorityIndex: 0,
      areaIndex: 0,
      projectionIndex,
    },
  })),
  {
    code: 'board_required_zone_unprojected',
    locator: {
      kind: 'page_zone',
      referenceClass: 'zone_projection',
      fieldRole: 'zones.stableAreaProjection',
      zoneIndex: 0,
    },
  },
  ...([
    'subject',
    'object',
    'spatialEffect.target',
    'spatialConstraint.target',
  ] as const).map((fieldRole, actionIndex) => ({
    code: 'page_spatial_reference_outside_zone' as const,
    locator: {
      kind: 'page_spatial_action' as const,
      referenceClass: 'page_spatial_selection' as const,
      fieldRole,
      pageNumber: 1,
      actionIndex,
    },
  })),
  {
    code: 'page_spatial_reference_outside_zone',
    locator: {
      kind: 'page_spatial_safety_constraint',
      referenceClass: 'page_spatial_selection',
      fieldRole: 'safetyConstraints.target',
      pageNumber: 1,
      safetyConstraintIndex: 0,
    },
  },
];

describe('closed draft authority/reference diagnostic contract', () => {
  it('covers every issue identity, locator variant, and locator field role', () => {
    expect(
      [...new Set(representativeIssues.map((issue) => issue.code))].sort(),
    ).toEqual(
      Object.keys(DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG).sort(),
    );
    expect(
      [...new Set(representativeIssues.map((issue) => issue.locator.kind))].sort(),
    ).toEqual([
      'page_action',
      'page_action_field',
      'page_coverage',
      'page_spatial_action',
      'page_spatial_safety_constraint',
      'page_zone',
      'page_zone_relation',
      'set_area_node',
      'set_area_projection',
      'set_area_projection_zone',
      'set_area_relation',
      'set_authority',
    ]);
    expect(
      [...new Set(representativeIssues.map((issue) => issue.locator.fieldRole))].sort(),
    ).toEqual([
      'actionRequirements.actionSemanticCoverage',
      'actionRequirements.beatId',
      'actionRequirements.checkId',
      'actionSemanticCoverage.actionRequirementBinding',
      'actionSemanticCoverage.beatId',
      'actionSemanticCoverage.checkId',
      'object',
      'safetyConstraints.target',
      'setBoardAuthorities.fixedObjects',
      'setBoardAuthorities.setIdentityId',
      'spatialConstraint.target',
      'spatialEffect.target',
      'spatialNodes.stablePropId',
      'spatialRelations.objectId',
      'subject',
      'zoneProjection.cardinality',
      'zoneProjection.zoneIds',
      'zones.id',
      'zones.stableAreaProjection',
    ]);
    expect(
      representativeIssues.every(draftAuthorityReferenceIssueIsValid),
    ).toBe(true);
  });

  it('normalizes, sorts, and deduplicates independently of input order', () => {
    const forward = normalizeDraftAuthorityReferenceIssues([
      ...representativeIssues,
      representativeIssues[0]!,
    ]);
    const reverse = normalizeDraftAuthorityReferenceIssues([
      ...representativeIssues,
    ].reverse());
    expect(forward).toEqual(reverse);
    expect(forward).toHaveLength(representativeIssues.length);
  });

  it('persists at most 128 unique normalized items with exact total and truncation', () => {
    const issues = Array.from({ length: 140 }, (_, actionIndex) => ({
      code: 'action_check_id_forbidden' as const,
      locator: {
        kind: 'page_action' as const,
        referenceClass: 'action_identity' as const,
        fieldRole: 'actionRequirements.checkId' as const,
        pageNumber: 1,
        actionIndex,
      },
    }));
    const diagnostics = buildDraftAuthorityReferenceDiagnostics([
      ...issues.reverse(),
      issues[0]!,
    ]);
    expect(diagnostics).toMatchObject({
      totalCount: 140,
      truncated: true,
    });
    expect(diagnostics.items).toHaveLength(
      MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES,
    );
    expect(draftAuthorityReferenceDiagnosticsIsValid(diagnostics)).toBe(true);
  });

  it('accepts canonical key-sorted round trips without weakening tamper rejection', () => {
    const diagnostics = buildDraftAuthorityReferenceDiagnostics([
      representativeIssues[6]!,
      representativeIssues[0]!,
    ]);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid(diagnostics),
    ).toBe(true);

    const persisted = JSON.parse(
      JSON.stringify(canonicalize(diagnostics)),
    ) as {
      totalCount: number;
      items: DraftAuthorityReferenceIssue[];
      truncated: boolean;
    };
    expect(Object.keys(persisted.items[0]!.locator)).not.toEqual(
      Object.keys(diagnostics.items[0]!.locator),
    );
    expect(
      draftAuthorityReferenceDiagnosticsIsValid(persisted),
    ).toBe(true);

    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...persisted,
        items: [...persisted.items].reverse(),
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...persisted,
        totalCount: 2,
        items: [persisted.items[0], persisted.items[0]],
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...persisted,
        totalCount: persisted.totalCount + 1,
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...persisted,
        truncated: true,
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...persisted,
        rawIssue: 'forbidden',
      }),
    ).toBe(false);
    const { truncated: _truncated, ...missingKey } = persisted;
    expect(
      draftAuthorityReferenceDiagnosticsIsValid(missingKey),
    ).toBe(false);
    const invalidLocator = structuredClone(persisted);
    invalidLocator.items[0]!.locator = {
      ...invalidLocator.items[0]!.locator,
      referenceClass: 'story_specific_identity',
    } as unknown as DraftAuthorityReferenceIssue['locator'];
    expect(
      draftAuthorityReferenceDiagnosticsIsValid(invalidLocator),
    ).toBe(false);
  });

  it('fails closed on extra keys, unknown enums, invalid numbers, and forbidden strings', () => {
    const valid = representativeIssues[0]!;
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        authoredValue: 'must never persist',
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: { ...valid.locator, fieldRole: 'raw.path' },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: {
          ...valid.locator,
          referenceClass: 'story_specific_identity',
        },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: { ...valid.locator, pageNumber: 0 },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: { ...valid.locator, pageNumber: 1.5 },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: { ...valid.locator, actionIndex: -1 },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: { ...valid.locator, actionIndex: 0.5 },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceIssueIsValid({
        ...valid,
        locator: {
          ...valid.locator,
          actionIndex:
            MAX_DRAFT_AUTHORITY_REFERENCE_STRUCTURAL_INDEX + 1,
        },
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        totalCount: 1,
        items: [valid],
        truncated: false,
        rawPath: 'forbidden',
      }),
    ).toBe(false);
    const ordered = buildDraftAuthorityReferenceDiagnostics([
      representativeIssues[0]!,
      representativeIssues[1]!,
    ]);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...ordered,
        items: [...ordered.items].reverse(),
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...ordered,
        totalCount: 3,
      }),
    ).toBe(false);
    expect(
      draftAuthorityReferenceDiagnosticsIsValid({
        ...ordered,
        truncated: true,
      }),
    ).toBe(false);
  });

  it('keeps the compiler error message fixed and excludes hostile authored values', () => {
    const hostile =
      'beat:p1:raw\n{"OPENAI_API_KEY":"secret"}\nError: stack path C:\\private';
    let failure: unknown;
    try {
      compilerOwnedActionCheckId(1, hostile);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(DraftAuthorityReferenceDomainError);
    expect((failure as Error).message).toBe(
      'draft authority/reference domain invalid',
    );
    expect(JSON.stringify(failure)).not.toContain(hostile);
    expect(
      (failure as DraftAuthorityReferenceDomainError).issues,
    ).toEqual([
      {
        code: 'action_beat_id_outside_page_authority',
        locator: {
          kind: 'page_action_field',
          referenceClass: 'action_identity',
          fieldRole: 'actionRequirements.beatId',
          pageNumber: 1,
        },
      },
    ]);
  });
});

describe('Visual Contract-specific terminal extension', () => {
  const typedIssue = representativeIssues[0]!;

  it.each([
    'repair_output_json_invalid',
    'repair_output_shape_invalid',
    'repair_output_target_identity_invalid',
    'repair_output_reference_authority_invalid',
    'repair_output_recurring_prop_invalid',
    'repair_output_non_target_drift',
    'repair_output_application_rejected',
  ] as const)(
    'accepts the closed sanitized repair-output identity %s',
    (diagnosticCodeOverride) => {
      const failure = buildAuthoringTerminalFailure({
        code: 'repair_output_invalid',
        diagnosticCodeOverride,
        issueCodes: ['repair_output_invalid'],
      });
      expect(failure.diagnosticCodes).toContain(
        diagnosticCodeOverride,
      );
      expect(authoringTerminalFailureIsValid(failure)).toBe(true);
    },
  );

  it('preserves the shared shape while requiring exact Visual Contract detail semantics', () => {
    const shared = buildAuthoringTerminalFailure({
      code: 'draft_authority_reference_domain_invalid',
      issueCodes: ['draft_authority_reference_domain_invalid'],
    });
    expect(authoringTerminalFailureIsValid(shared)).toBe(true);
    expect(Object.keys(shared).sort()).toEqual([
      'code',
      'diagnosticCodes',
      'diagnosticCount',
      'errorClass',
      'issues',
      'message',
      'phase',
      'repairEligibility',
      'repairReasonCode',
    ]);

    const visual = buildVisualContractAuthoringTerminalFailure({
      code: 'draft_authority_reference_domain_invalid',
      issueCodes: ['draft_authority_reference_domain_invalid'],
      authorityReferenceIssues: [typedIssue],
    });
    expect(authoringTerminalFailureIsValid(visual)).toBe(false);
    expect(visualContractAuthoringTerminalFailureIsValid(visual)).toBe(true);
    expect(visual.authorityReferenceDiagnostics).toEqual({
      totalCount: 1,
      items: [typedIssue],
      truncated: false,
    });

    const unrelated = buildVisualContractAuthoringTerminalFailure({
      code: 'provider_call_failed',
      issueCodes: ['provider_call_failed'],
    });
    expect(unrelated.authorityReferenceDiagnostics).toBeNull();
    expect(unrelated.repairOutputDiagnostics).toBeNull();
    expect(unrelated.repairRouteAdmissionDiagnostics).toBeNull();
    expect(visualContractAuthoringTerminalFailureIsValid(unrelated)).toBe(true);
    const legacyUnrelated = structuredClone(unrelated) as unknown as Record<
      string,
      unknown
    >;
    delete legacyUnrelated.repairRouteAdmissionDiagnostics;
    expect(
      legacyVisualContractAuthoringTerminalFailureIsValid(
        legacyUnrelated,
      ),
    ).toBe(true);
    expect(
      visualContractAuthoringTerminalFailureIsValid(legacyUnrelated),
    ).toBe(false);
  });

  it('persists one exact repair-route admission detail slot on the existing terminal shape', () => {
    const inputAccounting = {
      systemBytes: 1_000,
      userBytes: 55_000,
      schemaBytes: 1_000,
      separatorBytes: 2,
      protocolAllowance: 4_096,
      estimatedBytes: 61_098,
    };
    const failure = buildVisualContractAuthoringTerminalFailure({
      code: 'repair_route_input_not_admissible',
      issueCodes: ['repair_route_input_not_admissible'],
      repairRouteAdmissionDiagnostics: {
        repairAttempt: 7,
        repairMode: 'book_surface_patch',
        inputAccounting,
        maxAdmissibleInputBytes: 59_904,
        carriedDraftDiagnosticCount: 17,
      },
    });

    expect(failure).toMatchObject({
      code: 'repair_route_input_not_admissible',
      phase: 'provider_admission',
      errorClass: 'input_limit_violation',
      repairEligibility: 'ineligible',
      repairReasonCode: 'input_limit_not_repairable',
      diagnosticCount: 18,
      diagnosticCodes: ['repair_route_input_not_admissible'],
      issues: ['repair_route_input_not_admissible'],
      authorityReferenceDiagnostics: null,
      repairOutputDiagnostics: null,
    });
    expect(failure.repairRouteAdmissionDiagnostics).toEqual({
      version: 'visual-contract-repair-route-admission-diagnostics/v1',
      repairAttempt: 7,
      repairMode: 'book_surface_patch',
      inputAccounting,
      maxAdmissibleInputBytes: 59_904,
      carriedDraftDiagnosticCount: 17,
      routeAdmissionDiagnosticCount: 1,
    });
    expect(
      visualContractRepairRouteAdmissionDiagnosticsIsValid(
        failure.repairRouteAdmissionDiagnostics,
      ),
    ).toBe(true);
    expect(visualContractAuthoringTerminalFailureIsValid(failure)).toBe(true);
    expect(authoringTerminalFailureIsValid(failure)).toBe(false);

    const currentWithoutRouteSlot = structuredClone(failure) as unknown as Record<
      string,
      unknown
    >;
    delete currentWithoutRouteSlot.repairRouteAdmissionDiagnostics;
    expect(
      visualContractAuthoringTerminalFailureIsValid(currentWithoutRouteSlot),
    ).toBe(false);
    expect(
      legacyVisualContractAuthoringTerminalFailureIsValid(
        currentWithoutRouteSlot,
      ),
    ).toBe(false);
  });

  it('rejects route-admission threshold, accounting, identity, count, and mutual-exclusion tampering', () => {
    const valid = buildVisualContractAuthoringTerminalFailure({
      code: 'repair_route_input_not_admissible',
      issueCodes: ['repair_route_input_not_admissible'],
      repairRouteAdmissionDiagnostics: {
        repairAttempt: 7,
        repairMode: 'book_surface_patch',
        inputAccounting: {
          systemBytes: 1_000,
          userBytes: 55_000,
          schemaBytes: 1_000,
          separatorBytes: 2,
          protocolAllowance: 4_096,
          estimatedBytes: 61_098,
        },
        maxAdmissibleInputBytes: 59_904,
        carriedDraftDiagnosticCount: 17,
      },
    });
    const details = valid.repairRouteAdmissionDiagnostics!;
    const invalidDetails = [
      { ...details, version: 'visual-contract-repair-route-admission-diagnostics/v2' },
      { ...details, repairAttempt: 1 },
      { ...details, repairAttempt: 2 },
      { ...details, repairAttempt: 3 },
      { ...details, repairMode: 'unknown_mode' },
      { ...details, repairMode: 'full_draft' },
      { ...details, maxAdmissibleInputBytes: 59_903 },
      { ...details, carriedDraftDiagnosticCount: 0 },
      { ...details, routeAdmissionDiagnosticCount: 2 },
      { ...details, extra: true },
      {
        ...details,
        inputAccounting: {
          ...details.inputAccounting,
          estimatedBytes: 59_904,
        },
      },
      {
        ...details,
        inputAccounting: {
          ...details.inputAccounting,
          separatorBytes: 3,
        },
      },
      {
        ...details,
        inputAccounting: {
          ...details.inputAccounting,
          protocolAllowance: 4_095,
        },
      },
    ];
    for (const repairRouteAdmissionDiagnostics of invalidDetails) {
      expect(
        visualContractAuthoringTerminalFailureIsValid({
          ...valid,
          repairRouteAdmissionDiagnostics,
        }),
      ).toBe(false);
    }
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        diagnosticCount: 17,
      }),
    ).toBe(false);
    expect(() =>
      buildVisualContractAuthoringTerminalFailure({
        code: 'provider_call_failed',
        issueCodes: ['provider_call_failed'],
        repairRouteAdmissionDiagnostics: {
          repairAttempt: 3,
          repairMode: 'book_surface_patch',
          inputAccounting: details.inputAccounting,
          maxAdmissibleInputBytes: 59_904,
          carriedDraftDiagnosticCount: 17,
        },
      }),
    ).toThrow(/matching terminal code/);
    expect(() =>
      buildVisualContractAuthoringTerminalFailure({
        code: 'repair_route_input_not_admissible',
        issueCodes: ['repair_route_input_not_admissible'],
      }),
    ).toThrow(/requires typed diagnostics/);
  });

  it('persists exact sanitized repair-output identity with explicit diagnostic provenance', () => {
    const visual = buildVisualContractAuthoringTerminalFailure({
      code: 'repair_output_invalid',
      issueCodes: ['repair_output_invalid'],
      repairOutputDiagnostics: {
        repairAttempt: 2,
        repairMode: 'book_surface_patch',
        failureCode: 'recurring_prop_invalid',
        identity: 'book_surface_repair_prop_invalid',
        carriedDraftDiagnosticCount: 39,
      },
    });
    expect(visual.diagnosticCount).toBe(40);
    expect(visual.diagnosticCodes).toContain(
      'repair_output_recurring_prop_invalid',
    );
    expect(visual.repairOutputDiagnostics).toEqual({
      version: 'visual-contract-repair-output-diagnostics/v3',
      repairAttempt: 2,
      repairMode: 'book_surface_patch',
      failureCode: 'recurring_prop_invalid',
      identity: 'book_surface_repair_prop_invalid',
      carriedDraftDiagnosticCount: 39,
      repairOutputDiagnosticCount: 1,
    });
    expect(
      visualContractRepairOutputDiagnosticsIsValid(
        visual.repairOutputDiagnostics,
      ),
    ).toBe(true);
    expect(
      visualContractAuthoringTerminalFailureIsValid(
        JSON.parse(JSON.stringify(canonicalize(visual))),
      ),
    ).toBe(true);
    expect(authoringTerminalFailureIsValid(visual)).toBe(false);
  });

  it.each([
    [
      'page_contract_repair_action_binding_component_scope_invalid',
      'non_target_drift',
    ],
    [
      'page_contract_repair_action_binding_component_stale',
      'target_identity_invalid',
    ],
    [
      'page_contract_repair_action_binding_component_beat_id_invalid',
      'target_identity_invalid',
    ],
    [
      'page_contract_repair_action_binding_component_target_invalid',
      'target_identity_invalid',
    ],
  ] as const)(
    'round-trips closed component repair-output identity %s',
    (identity, failureCode) => {
      const failure = buildVisualContractAuthoringTerminalFailure({
        code: 'repair_output_invalid',
        issueCodes: ['repair_output_invalid'],
        repairOutputDiagnostics: {
          repairAttempt: 2,
          repairMode: 'page_contract_patch',
          failureCode,
          identity,
          carriedDraftDiagnosticCount: 18,
        },
      });
      const roundTrip = JSON.parse(
        JSON.stringify(canonicalize(failure)),
      );

      expect(
        visualContractAuthoringTerminalFailureIsValid(roundTrip),
      ).toBe(true);
      expect(roundTrip.repairOutputDiagnostics).toMatchObject({
        version: 'visual-contract-repair-output-diagnostics/v3',
        failureCode,
        identity,
        repairOutputDiagnosticCount: 1,
      });
    },
  );

  it('keeps v1 diagnostics explicitly legacy-only and rejects v2 identities or unknown versions under v1', () => {
    const currentFailure = buildVisualContractAuthoringTerminalFailure({
      code: 'repair_output_invalid',
      issueCodes: ['repair_output_invalid'],
      repairOutputDiagnostics: {
        repairAttempt: 2,
        repairMode: 'book_surface_patch',
        failureCode: 'recurring_prop_invalid',
        identity: 'book_surface_repair_prop_invalid',
        carriedDraftDiagnosticCount: 3,
      },
    });
    const current = currentFailure.repairOutputDiagnostics!;
    const legacy = {
      ...current,
      version: 'visual-contract-repair-output-diagnostics/v1',
    };
    const legacyV2 = {
      ...current,
      version: 'visual-contract-repair-output-diagnostics/v2',
    };
    const forgedLegacyAddition = {
      ...legacy,
      identity:
        'page_contract_repair_action_binding_component_target_invalid',
    };
    const forgedLegacyV3Addition = {
      ...legacyV2,
      identity: 'book_surface_repair_action_binding_changed',
    };
    const unknown = {
      ...current,
      version: 'visual-contract-repair-output-diagnostics/v4',
    };
    const legacyFailure = {
      ...currentFailure,
      repairOutputDiagnostics: legacy,
    };
    const forgedLegacyFailure = {
      ...currentFailure,
      repairOutputDiagnostics: forgedLegacyAddition,
    };

    expect(legacyVisualContractRepairOutputDiagnosticsV1IsValid(legacy))
      .toBe(true);
    expect(legacyVisualContractRepairOutputDiagnosticsIsValid(legacyV2))
      .toBe(true);
    expect(
      legacyVisualContractRepairOutputDiagnosticsIsValid(
        forgedLegacyV3Addition,
      ),
    ).toBe(false);
    expect(visualContractRepairOutputDiagnosticsIsReadable(legacy))
      .toBe(true);
    expect(visualContractRepairOutputDiagnosticsIsValid(legacy))
      .toBe(false);
    expect(visualContractRepairOutputDiagnosticsVersionStatus(legacy))
      .toBe('legacy_immutable');
    expect(visualContractAuthoringTerminalFailureIsValid(legacyFailure))
      .toBe(true);
    expect(
      legacyVisualContractRepairOutputDiagnosticsV1IsValid(
        forgedLegacyAddition,
      ),
    ).toBe(false);
    expect(
      visualContractRepairOutputDiagnosticsVersionStatus(
        forgedLegacyAddition,
      ),
    ).toBe('unsupported');
    expect(
      visualContractRepairOutputDiagnosticsIsReadable(
        forgedLegacyAddition,
      ),
    ).toBe(false);
    expect(
      visualContractAuthoringTerminalFailureIsValid(
        forgedLegacyFailure,
      ),
    ).toBe(false);
    expect(visualContractRepairOutputDiagnosticsVersionStatus(unknown))
      .toBe('unsupported');
  });

  it('rejects repair-output identity, count, ordering, key, and locator-domain tampering', () => {
    const valid = buildVisualContractAuthoringTerminalFailure({
      code: 'repair_output_invalid',
      issueCodes: ['repair_output_invalid'],
      repairOutputDiagnostics: {
        repairAttempt: 2,
        repairMode: 'book_surface_patch',
        failureCode: 'recurring_prop_invalid',
        identity: 'book_surface_repair_prop_change_not_authorized',
        carriedDraftDiagnosticCount: 2,
      },
    });
    const diagnostics = valid.repairOutputDiagnostics!;
    const invalidDetails = [
      { ...diagnostics, identity: 'provider-authored prose' },
      { ...diagnostics, carriedDraftDiagnosticCount: -1 },
      { ...diagnostics, repairOutputDiagnosticCount: 2 },
      { ...diagnostics, repairAttempt: 0 },
      { ...diagnostics, repairMode: 'unknown_mode' },
      { ...diagnostics, failureCode: 'shape_invalid' },
      { ...diagnostics, extra: true },
    ];
    for (const repairOutputDiagnostics of invalidDetails) {
      expect(
        visualContractAuthoringTerminalFailureIsValid({
          ...valid,
          repairOutputDiagnostics,
        }),
      ).toBe(false);
    }
    const { identity: _identity, ...missingIdentity } = diagnostics;
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        repairOutputDiagnostics: missingIdentity,
      }),
    ).toBe(false);
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        diagnosticCount: 2,
      }),
    ).toBe(false);
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        diagnosticCodes: ['repair_output_shape_invalid'],
      }),
    ).toBe(false);
    const reordered = {
      repairOutputDiagnosticCount: 1,
      identity: diagnostics.identity,
      version: diagnostics.version,
      repairMode: diagnostics.repairMode,
      carriedDraftDiagnosticCount:
        diagnostics.carriedDraftDiagnosticCount,
      failureCode: diagnostics.failureCode,
      repairAttempt: diagnostics.repairAttempt,
    };
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        repairOutputDiagnostics: reordered,
      }),
    ).toBe(true);
  });

  it('rejects extra keys, missing detail, detail on other terminals, and malformed locators', () => {
    expect(() =>
      buildVisualContractAuthoringTerminalFailure({
        code: 'draft_authority_reference_domain_invalid',
        issueCodes: ['draft_authority_reference_domain_invalid'],
      }),
    ).toThrow(/requires typed diagnostics/);
    expect(() =>
      buildVisualContractAuthoringTerminalFailure({
        code: 'provider_call_failed',
        issueCodes: ['provider_call_failed'],
        authorityReferenceIssues: [typedIssue],
      }),
    ).toThrow(/matching terminal code/);
    expect(() =>
      buildVisualContractAuthoringTerminalFailure({
        code: 'repair_output_invalid',
        issueCodes: ['repair_output_invalid'],
      }),
    ).toThrow(/requires typed diagnostics/);
    const valid = buildVisualContractAuthoringTerminalFailure({
      code: 'draft_authority_reference_domain_invalid',
      issueCodes: ['draft_authority_reference_domain_invalid'],
      authorityReferenceIssues: [typedIssue],
    });
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        rawIssue: 'forbidden',
      }),
    ).toBe(false);
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...valid,
        authorityReferenceDiagnostics: null,
      }),
    ).toBe(false);
    const unrelated = buildVisualContractAuthoringTerminalFailure({
      code: 'provider_call_failed',
      issueCodes: ['provider_call_failed'],
    });
    expect(
      visualContractAuthoringTerminalFailureIsValid({
        ...unrelated,
        authorityReferenceDiagnostics:
          valid.authorityReferenceDiagnostics,
      }),
    ).toBe(false);
    const malformed = structuredClone(valid);
    const diagnostics = malformed.authorityReferenceDiagnostics!;
    const locator = diagnostics.items[0]!.locator as unknown as Record<
      string,
      unknown
    >;
    locator.actionIndex = -1;
    expect(
      visualContractAuthoringTerminalFailureIsValid(malformed),
    ).toBe(false);
  });
});
