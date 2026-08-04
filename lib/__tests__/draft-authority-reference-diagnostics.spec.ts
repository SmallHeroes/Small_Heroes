import { describe, expect, it } from 'vitest';

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
  visualContractAuthoringTerminalFailureIsValid,
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
      fieldRole: 'spatialNodes.propId' as const,
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
      'spatialNodes.propId',
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
    expect(visualContractAuthoringTerminalFailureIsValid(unrelated)).toBe(true);
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
