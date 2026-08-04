export const MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES = 128;
export const MAX_DRAFT_AUTHORITY_REFERENCE_STRUCTURAL_INDEX = 1_000_000;

export type DraftAuthorityReferenceClass =
  | 'action_identity'
  | 'action_coverage'
  | 'spatial_relation'
  | 'page_zone'
  | 'set_identity'
  | 'recurring_prop'
  | 'zone_projection'
  | 'page_spatial_selection';

export type DraftAuthorityReferenceFieldRole =
  | 'actionRequirements.checkId'
  | 'actionRequirements.beatId'
  | 'actionRequirements.actionSemanticCoverage'
  | 'actionSemanticCoverage.checkId'
  | 'actionSemanticCoverage.beatId'
  | 'actionSemanticCoverage.actionRequirementBinding'
  | 'spatialRelations.objectId'
  | 'zones.id'
  | 'setBoardAuthorities.fixedObjects'
  | 'setBoardAuthorities.setIdentityId'
  | 'spatialNodes.propId'
  | 'zoneProjection.cardinality'
  | 'zoneProjection.zoneIds'
  | 'zones.stableAreaProjection'
  | 'subject'
  | 'object'
  | 'spatialEffect.target'
  | 'spatialConstraint.target'
  | 'safetyConstraints.target';

export type DraftAuthorityReferenceLocator =
  | {
      kind: 'page_action_field';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      pageNumber: number;
    }
  | {
      kind: 'page_action';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      pageNumber: number;
      actionIndex: number;
    }
  | {
      kind: 'page_coverage';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      pageNumber: number;
      coverageIndex: number;
    }
  | {
      kind: 'set_authority';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      authorityIndex: number;
    }
  | {
      kind: 'set_area_relation';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      authorityIndex: number;
      areaIndex: number;
      relationIndex: number;
    }
  | {
      kind: 'page_zone_relation';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      zoneIndex: number;
      relationIndex: number;
    }
  | {
      kind: 'page_zone';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      zoneIndex: number;
    }
  | {
      kind: 'set_area_node';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      authorityIndex: number;
      areaIndex: number;
      nodeIndex: number;
    }
  | {
      kind: 'set_area_projection';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      authorityIndex: number;
      areaIndex: number;
    }
  | {
      kind: 'set_area_projection_zone';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      authorityIndex: number;
      areaIndex: number;
      projectionIndex: number;
    }
  | {
      kind: 'page_spatial_action';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      pageNumber: number;
      actionIndex: number;
    }
  | {
      kind: 'page_spatial_safety_constraint';
      referenceClass: DraftAuthorityReferenceClass;
      fieldRole: DraftAuthorityReferenceFieldRole;
      pageNumber: number;
      safetyConstraintIndex: number;
    };

type LocatorKind = DraftAuthorityReferenceLocator['kind'];

interface DraftAuthorityReferenceInvariantDefinition {
  referenceClass: DraftAuthorityReferenceClass;
  locatorKinds: readonly LocatorKind[];
  fieldRoles: readonly DraftAuthorityReferenceFieldRole[];
}

/**
 * The single production authority for this closed invariant family. Adding an
 * invariant requires an explicit catalog entry and exhaustive local proof.
 */
export const DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG = {
  action_check_id_forbidden: {
    referenceClass: 'action_identity',
    locatorKinds: ['page_action'],
    fieldRoles: ['actionRequirements.checkId'],
  },
  action_beat_id_outside_page_authority: {
    referenceClass: 'action_identity',
    locatorKinds: ['page_action', 'page_action_field'],
    fieldRoles: ['actionRequirements.beatId'],
  },
  action_beat_binding_cardinality_invalid: {
    referenceClass: 'action_identity',
    locatorKinds: ['page_action'],
    fieldRoles: ['actionRequirements.beatId'],
  },
  coverage_check_id_forbidden: {
    referenceClass: 'action_coverage',
    locatorKinds: ['page_coverage'],
    fieldRoles: ['actionSemanticCoverage.checkId'],
  },
  coverage_action_binding_cardinality_invalid: {
    referenceClass: 'action_coverage',
    locatorKinds: ['page_coverage'],
    fieldRoles: ['actionSemanticCoverage.actionRequirementBinding'],
  },
  coverage_beat_cardinality_invalid: {
    referenceClass: 'action_coverage',
    locatorKinds: ['page_coverage'],
    fieldRoles: ['actionSemanticCoverage.beatId'],
  },
  action_coverage_cardinality_invalid: {
    referenceClass: 'action_coverage',
    locatorKinds: ['page_action'],
    fieldRoles: ['actionRequirements.actionSemanticCoverage'],
  },
  unary_relation_object_forbidden: {
    referenceClass: 'spatial_relation',
    locatorKinds: ['set_area_relation', 'page_zone_relation'],
    fieldRoles: ['spatialRelations.objectId'],
  },
  binary_relation_object_required: {
    referenceClass: 'spatial_relation',
    locatorKinds: ['set_area_relation', 'page_zone_relation'],
    fieldRoles: ['spatialRelations.objectId'],
  },
  page_zone_id_duplicate: {
    referenceClass: 'page_zone',
    locatorKinds: ['page_zone'],
    fieldRoles: ['zones.id'],
  },
  set_fixed_objects_forbidden: {
    referenceClass: 'set_identity',
    locatorKinds: ['set_authority'],
    fieldRoles: ['setBoardAuthorities.fixedObjects'],
  },
  set_identity_id_duplicate: {
    referenceClass: 'set_identity',
    locatorKinds: ['set_authority'],
    fieldRoles: ['setBoardAuthorities.setIdentityId'],
  },
  recurring_prop_reference_type_invalid: {
    referenceClass: 'recurring_prop',
    locatorKinds: ['set_area_node'],
    fieldRoles: ['spatialNodes.propId'],
  },
  recurring_prop_reference_cardinality_invalid: {
    referenceClass: 'recurring_prop',
    locatorKinds: ['set_area_node'],
    fieldRoles: ['spatialNodes.propId'],
  },
  recurring_prop_lifecycle_gated: {
    referenceClass: 'recurring_prop',
    locatorKinds: ['set_area_node'],
    fieldRoles: ['spatialNodes.propId'],
  },
  recurring_prop_consumer_forbidden: {
    referenceClass: 'recurring_prop',
    locatorKinds: ['set_area_node'],
    fieldRoles: ['spatialNodes.propId'],
  },
  zone_projection_cardinality_invalid: {
    referenceClass: 'zone_projection',
    locatorKinds: ['set_area_projection'],
    fieldRoles: ['zoneProjection.cardinality'],
  },
  zone_projection_duplicate_zone: {
    referenceClass: 'zone_projection',
    locatorKinds: ['set_area_projection_zone'],
    fieldRoles: ['zoneProjection.zoneIds'],
  },
  zone_projection_unknown_zone: {
    referenceClass: 'zone_projection',
    locatorKinds: ['set_area_projection_zone'],
    fieldRoles: ['zoneProjection.zoneIds'],
  },
  zone_projection_location_mismatch: {
    referenceClass: 'zone_projection',
    locatorKinds: ['set_area_projection_zone'],
    fieldRoles: ['zoneProjection.zoneIds'],
  },
  zone_projection_ambiguous_owner: {
    referenceClass: 'zone_projection',
    locatorKinds: ['set_area_projection_zone'],
    fieldRoles: ['zoneProjection.zoneIds'],
  },
  board_required_zone_unprojected: {
    referenceClass: 'zone_projection',
    locatorKinds: ['page_zone'],
    fieldRoles: ['zones.stableAreaProjection'],
  },
  page_spatial_reference_outside_zone: {
    referenceClass: 'page_spatial_selection',
    locatorKinds: [
      'page_spatial_action',
      'page_spatial_safety_constraint',
    ],
    fieldRoles: [
      'subject',
      'object',
      'spatialEffect.target',
      'spatialConstraint.target',
      'safetyConstraints.target',
    ],
  },
} as const satisfies Record<
  string,
  DraftAuthorityReferenceInvariantDefinition
>;

export type DraftAuthorityReferenceIssueCode =
  keyof typeof DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG;

export interface DraftAuthorityReferenceIssue {
  code: DraftAuthorityReferenceIssueCode;
  locator: DraftAuthorityReferenceLocator;
}

export interface DraftAuthorityReferenceDiagnostics {
  totalCount: number;
  items: readonly DraftAuthorityReferenceIssue[];
  truncated: boolean;
}

const ISSUE_KEYS = ['code', 'locator'].sort();
const DIAGNOSTICS_KEYS = ['items', 'totalCount', 'truncated'].sort();
const LOCATOR_KEYS: Record<LocatorKind, readonly string[]> = {
  page_action_field: [
    'fieldRole',
    'kind',
    'pageNumber',
    'referenceClass',
  ],
  page_action: [
    'actionIndex',
    'fieldRole',
    'kind',
    'pageNumber',
    'referenceClass',
  ],
  page_coverage: [
    'coverageIndex',
    'fieldRole',
    'kind',
    'pageNumber',
    'referenceClass',
  ],
  set_authority: [
    'authorityIndex',
    'fieldRole',
    'kind',
    'referenceClass',
  ],
  set_area_relation: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'referenceClass',
    'relationIndex',
  ],
  page_zone_relation: [
    'fieldRole',
    'kind',
    'referenceClass',
    'relationIndex',
    'zoneIndex',
  ],
  page_zone: [
    'fieldRole',
    'kind',
    'referenceClass',
    'zoneIndex',
  ],
  set_area_node: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'nodeIndex',
    'referenceClass',
  ],
  set_area_projection: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'referenceClass',
  ],
  set_area_projection_zone: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'projectionIndex',
    'referenceClass',
  ],
  page_spatial_action: [
    'actionIndex',
    'fieldRole',
    'kind',
    'pageNumber',
    'referenceClass',
  ],
  page_spatial_safety_constraint: [
    'fieldRole',
    'kind',
    'pageNumber',
    'referenceClass',
    'safetyConstraintIndex',
  ],
};

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function structuralIndexIsValid(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DRAFT_AUTHORITY_REFERENCE_STRUCTURAL_INDEX
  );
}

function pageNumberIsValid(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function locatorIsStructurallyValid(
  value: unknown,
): value is DraftAuthorityReferenceLocator {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const locator = value as Record<string, unknown>;
  if (
    typeof locator.kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(LOCATOR_KEYS, locator.kind)
  ) {
    return false;
  }
  const kind = locator.kind as LocatorKind;
  if (!exactKeys(locator, LOCATOR_KEYS[kind]!)) return false;
  if (
    typeof locator.referenceClass !== 'string' ||
    typeof locator.fieldRole !== 'string'
  ) {
    return false;
  }
  for (const [key, candidate] of Object.entries(locator)) {
    if (key === 'pageNumber' && !pageNumberIsValid(candidate)) {
      return false;
    }
    if (
      key.endsWith('Index') &&
      !structuralIndexIsValid(candidate)
    ) {
      return false;
    }
  }
  return true;
}

export function draftAuthorityReferenceIssueIsValid(
  value: unknown,
): value is DraftAuthorityReferenceIssue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const issue = value as Record<string, unknown>;
  if (
    !exactKeys(issue, ISSUE_KEYS) ||
    typeof issue.code !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG,
      issue.code,
    ) ||
    !locatorIsStructurallyValid(issue.locator)
  ) {
    return false;
  }
  const definition =
    DRAFT_AUTHORITY_REFERENCE_INVARIANT_CATALOG[
      issue.code as DraftAuthorityReferenceIssueCode
    ];
  return (
    issue.locator.referenceClass === definition.referenceClass &&
    (definition.locatorKinds as readonly string[]).includes(
      issue.locator.kind,
    ) &&
    (definition.fieldRoles as readonly string[]).includes(
      issue.locator.fieldRole,
    )
  );
}

function canonicalLocator(
  locator: DraftAuthorityReferenceLocator,
): DraftAuthorityReferenceLocator {
  switch (locator.kind) {
    case 'page_action_field':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        pageNumber: locator.pageNumber,
      };
    case 'page_action':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        pageNumber: locator.pageNumber,
        actionIndex: locator.actionIndex,
      };
    case 'page_coverage':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        pageNumber: locator.pageNumber,
        coverageIndex: locator.coverageIndex,
      };
    case 'set_authority':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        authorityIndex: locator.authorityIndex,
      };
    case 'set_area_relation':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        authorityIndex: locator.authorityIndex,
        areaIndex: locator.areaIndex,
        relationIndex: locator.relationIndex,
      };
    case 'page_zone_relation':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        zoneIndex: locator.zoneIndex,
        relationIndex: locator.relationIndex,
      };
    case 'page_zone':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        zoneIndex: locator.zoneIndex,
      };
    case 'set_area_node':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        authorityIndex: locator.authorityIndex,
        areaIndex: locator.areaIndex,
        nodeIndex: locator.nodeIndex,
      };
    case 'set_area_projection':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        authorityIndex: locator.authorityIndex,
        areaIndex: locator.areaIndex,
      };
    case 'set_area_projection_zone':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        authorityIndex: locator.authorityIndex,
        areaIndex: locator.areaIndex,
        projectionIndex: locator.projectionIndex,
      };
    case 'page_spatial_action':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        pageNumber: locator.pageNumber,
        actionIndex: locator.actionIndex,
      };
    case 'page_spatial_safety_constraint':
      return {
        kind: locator.kind,
        referenceClass: locator.referenceClass,
        fieldRole: locator.fieldRole,
        pageNumber: locator.pageNumber,
        safetyConstraintIndex: locator.safetyConstraintIndex,
      };
  }
}

function issueKey(issue: DraftAuthorityReferenceIssue): string {
  return JSON.stringify([issue.code, canonicalLocator(issue.locator)]);
}

export function normalizeDraftAuthorityReferenceIssues(
  values: readonly DraftAuthorityReferenceIssue[],
): readonly DraftAuthorityReferenceIssue[] {
  const normalized = new Map<string, DraftAuthorityReferenceIssue>();
  for (const value of values) {
    if (!draftAuthorityReferenceIssueIsValid(value)) {
      throw new Error('draft authority/reference diagnostic contract invalid');
    }
    const issue: DraftAuthorityReferenceIssue = {
      code: value.code,
      locator: canonicalLocator(value.locator),
    };
    normalized.set(issueKey(issue), issue);
  }
  return [...normalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, issue]) => issue);
}

export function buildDraftAuthorityReferenceDiagnostics(
  values: readonly DraftAuthorityReferenceIssue[],
): DraftAuthorityReferenceDiagnostics {
  const normalized = normalizeDraftAuthorityReferenceIssues(values);
  const totalCount = normalized.length;
  return {
    totalCount,
    items: normalized.slice(
      0,
      MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES,
    ),
    truncated:
      totalCount > MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES,
  };
}

export function draftAuthorityReferenceDiagnosticsIsValid(
  value: unknown,
): value is DraftAuthorityReferenceDiagnostics {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  if (
    !exactKeys(diagnostics, DIAGNOSTICS_KEYS) ||
    !structuralIndexIsValid(diagnostics.totalCount) ||
    typeof diagnostics.truncated !== 'boolean' ||
    !Array.isArray(diagnostics.items) ||
    diagnostics.items.length >
      MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES ||
    !diagnostics.items.every(draftAuthorityReferenceIssueIsValid)
  ) {
    return false;
  }
  let normalized: readonly DraftAuthorityReferenceIssue[];
  try {
    normalized = normalizeDraftAuthorityReferenceIssues(
      diagnostics.items,
    );
  } catch {
    return false;
  }
  if (
    JSON.stringify(normalized) !== JSON.stringify(diagnostics.items) ||
    diagnostics.truncated !==
      ((diagnostics.totalCount as number) >
        MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES)
  ) {
    return false;
  }
  return diagnostics.truncated
    ? diagnostics.items.length ===
        MAX_PERSISTED_DRAFT_AUTHORITY_REFERENCE_ISSUES
    : diagnostics.totalCount === diagnostics.items.length;
}
