import { canonicalize } from '@/lib/canonical-json';

export const DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION =
  'draft-validation-attempt-diagnostics/v4' as const;
export const LEGACY_DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION =
  'draft-validation-attempt-diagnostics/v3' as const;
export const LEGACY_DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION_V2 =
  'draft-validation-attempt-diagnostics/v2' as const;
export const LEGACY_DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION_V1 =
  'draft-validation-attempt-diagnostics/v1' as const;
export const MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS = 128;
export const MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX = 1_000_000;

export const DRAFT_VALIDATION_FAMILIES = [
  'draft_schema',
  'draft_contract',
  'action_semantic',
  'source_evidence_id',
] as const;

export type DraftValidationIssueFamily =
  (typeof DRAFT_VALIDATION_FAMILIES)[number];

export const DRAFT_VALIDATION_ISSUE_CATALOG = {
  draft_schema: {
    required_field_missing: true,
    value_type_invalid: true,
    value_domain_invalid: true,
    array_shape_invalid: true,
    array_member_invalid: true,
    schema_version_invalid: true,
    binding_shape_invalid: true,
    binding_mode_invalid: true,
    binding_origin_invalid: true,
    binding_mode_origin_incoherent: true,
    binding_value_required: true,
    binding_value_forbidden: true,
    binding_value_placeholder: true,
  },
  draft_contract: {
    topology_empty: true,
    topology_malformed: true,
    duplicate_identity: true,
    unresolved_reference: true,
    ambiguous_reference: true,
    out_of_scope_reference: true,
    relation_arity_invalid: true,
    coverage_invalid: true,
    cardinality_invalid: true,
    world_type_missing: true,
    cover_projection_invalid: true,
    cover_source_fidelity_invalid: true,
    cast_authority_mismatch: true,
    fact_authority_mismatch: true,
    source_evidence_phrase_invalid: true,
    lifecycle_invariant_invalid: true,
    consumer_invariant_invalid: true,
    continuity_authority_invalid: true,
    final_structural_invariant_invalid: true,
  },
  action_semantic: {
    coverage_missing: true,
    beat_identity_missing: true,
    beat_identity_out_of_scope: true,
    beat_identity_duplicate: true,
    disposition_kind_invalid: true,
    disposition_reason_invalid: true,
    disposition_payload_invalid: true,
    action_binding_missing: true,
    action_binding_cardinality_invalid: true,
    represented_elsewhere_pointer_out_of_scope: true,
    represented_elsewhere_pointer_unresolved: true,
    represented_elsewhere_value_mismatch: true,
    presentation_requirement_pointer_out_of_scope: true,
    presentation_requirement_pointer_unresolved: true,
    presentation_requirement_value_mismatch: true,
    source_phenomenon_binding_mismatch: true,
    closed_catalog_capability_gap: true,
  },
  source_evidence_id: {
    source_evidence_id_malformed: true,
    source_evidence_id_unknown: true,
    source_evidence_id_wrong_page: true,
  },
} as const;

export type DraftSchemaValidationIssueCode =
  keyof typeof DRAFT_VALIDATION_ISSUE_CATALOG.draft_schema;
export type DraftContractValidationIssueCode =
  keyof typeof DRAFT_VALIDATION_ISSUE_CATALOG.draft_contract;
export type ActionSemanticValidationIssueCode =
  keyof typeof DRAFT_VALIDATION_ISSUE_CATALOG.action_semantic;
export type SourceEvidenceIdValidationIssueCode =
  keyof typeof DRAFT_VALIDATION_ISSUE_CATALOG.source_evidence_id;

export const PAGE_FINAL_STRUCTURAL_CAUSES = [
  'page_spatial_binding_invalid',
  'page_steering_invalid',
  'page_character_presence_invalid',
  'page_prop_state_invalid',
  'page_cast_state_invalid',
  'page_prop_constraints_invalid',
  'page_action_requirements_invalid',
  'page_safety_constraints_invalid',
  'page_action_constraint_conflict_invalid',
  'page_action_check_id_collision_invalid',
  'page_prop_check_id_collision_invalid',
  'page_safety_check_id_collision_invalid',
  'page_projection_containment_invalid',
  'page_cast_binding_invalid',
  'page_human_presence_binding_invalid',
  'page_transition_invalid',
] as const;

export type PageFinalStructuralCause =
  (typeof PAGE_FINAL_STRUCTURAL_CAUSES)[number];

export type DraftValidationCollectionRole =
  | 'locations'
  | 'location_anchors'
  | 'zones'
  | 'zone_nodes'
  | 'zone_relations'
  | 'human_cast'
  | 'human_garments'
  | 'recurring_props'
  | 'set_board_authorities'
  | 'set_board_areas'
  | 'set_board_nodes'
  | 'set_board_relations'
  | 'page_contracts'
  | 'page_cast_ids'
  | 'page_cast_states'
  | 'page_actions'
  | 'page_action_semantic_coverage'
  | 'page_prop_constraints'
  | 'page_safety_constraints'
  | 'forbidden_global_elements';

export type DraftValidationFieldRole =
  | 'root'
  | 'schema_version'
  | 'identity'
  | 'name'
  | 'description'
  | 'value'
  | 'array'
  | 'member'
  | 'reference'
  | 'reference_kind'
  | 'binding'
  | 'binding_mode'
  | 'binding_origin'
  | 'binding_value'
  | 'appearance'
  | 'world_type'
  | 'topology'
  | 'transition'
  | 'coverage'
  | 'cardinality'
  | 'disposition'
  | 'reason'
  | 'payload'
  | 'action_binding'
  | 'cast_presence'
  | 'source_evidence'
  | 'lifecycle'
  | 'consumer'
  | 'relation'
  | 'projection'
  | 'authority'
  | 'prose_projection'
  | 'final_structure';

export type DraftValidationLocator =
  | {
      kind: 'root';
      fieldRole: DraftValidationFieldRole;
    }
  | {
      kind: 'cover';
      fieldRole: DraftValidationFieldRole;
    }
  | {
      kind: 'collection';
      collectionRole: DraftValidationCollectionRole;
      fieldRole: DraftValidationFieldRole;
    }
  | {
      kind: 'collection_item';
      collectionRole: DraftValidationCollectionRole;
      fieldRole: DraftValidationFieldRole;
      itemIndex: number;
    }
  | {
      kind: 'human_garment';
      fieldRole: DraftValidationFieldRole;
      humanIndex: number;
      garmentIndex: number;
    }
  | {
      kind: 'zone_node';
      fieldRole: DraftValidationFieldRole;
      zoneIndex: number;
      nodeIndex: number;
    }
  | {
      kind: 'zone_relation';
      fieldRole: DraftValidationFieldRole;
      zoneIndex: number;
      relationIndex: number;
    }
  | {
      kind: 'set_authority';
      fieldRole: DraftValidationFieldRole;
      authorityIndex: number;
    }
  | {
      kind: 'set_area';
      fieldRole: DraftValidationFieldRole;
      authorityIndex: number;
      areaIndex: number;
    }
  | {
      kind: 'set_area_node';
      fieldRole: DraftValidationFieldRole;
      authorityIndex: number;
      areaIndex: number;
      nodeIndex: number;
    }
  | {
      kind: 'set_area_relation';
      fieldRole: DraftValidationFieldRole;
      authorityIndex: number;
      areaIndex: number;
      relationIndex: number;
    }
  | {
      kind: 'page';
      fieldRole: DraftValidationFieldRole;
      pageNumber: number;
    }
  | {
      kind: 'page_item';
      collectionRole: Extract<
        DraftValidationCollectionRole,
        | 'page_cast_ids'
        | 'page_cast_states'
        | 'page_actions'
        | 'page_action_semantic_coverage'
        | 'page_prop_constraints'
        | 'page_safety_constraints'
      >;
      fieldRole: DraftValidationFieldRole;
      pageNumber: number;
      itemIndex: number;
    }
  | {
      kind: 'source_evidence';
      fieldRole: 'source_evidence';
      pageNumber: number;
      coverageIndex: number;
    };

type DraftValidationLocatorKind = DraftValidationLocator['kind'];

export type SourceEvidenceIdDraftValidationLocator =
  | Extract<DraftValidationLocator, { kind: 'source_evidence' }>
  | {
      kind: 'collection';
      collectionRole: 'page_action_semantic_coverage';
      fieldRole: 'source_evidence';
    }
  | {
      kind: 'collection_item';
      collectionRole: 'page_action_semantic_coverage';
      fieldRole: 'source_evidence';
      itemIndex: number;
    };

export type DraftValidationIssue =
  | {
      family: 'draft_schema';
      code: DraftSchemaValidationIssueCode;
      locator: DraftValidationLocator;
    }
  | {
      family: 'draft_contract';
      code: Exclude<
        DraftContractValidationIssueCode,
        'final_structural_invariant_invalid'
      >;
      locator: DraftValidationLocator;
    }
  | {
      family: 'draft_contract';
      code: 'final_structural_invariant_invalid';
      locator: Extract<DraftValidationLocator, { kind: 'page' }>;
      causes: readonly PageFinalStructuralCause[];
    }
  | {
      family: 'draft_contract';
      code: 'final_structural_invariant_invalid';
      locator: Exclude<DraftValidationLocator, { kind: 'page' }>;
    }
  | {
      family: 'action_semantic';
      code: ActionSemanticValidationIssueCode;
      locator: DraftValidationLocator;
    }
  | {
      family: 'source_evidence_id';
      code: SourceEvidenceIdValidationIssueCode;
      locator: SourceEvidenceIdDraftValidationLocator;
    };

export type DraftValidationTransitionState =
  | 'newly_introduced'
  | 'persistent'
  | 'resolved';

export interface DraftValidationTransitionItem {
  state: DraftValidationTransitionState;
  issue: DraftValidationIssue;
}

export interface DraftValidationAttemptDiagnostics {
  version: typeof DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION;
  emittedCount: number;
  currentUniqueCount: number;
  newlyIntroducedCount: number;
  persistentCount: number;
  resolvedCount: number;
  items: readonly DraftValidationTransitionItem[];
  finalAttempt: boolean;
  truncated: boolean;
}

const FAMILY_SET = new Set<string>(DRAFT_VALIDATION_FAMILIES);
const COLLECTION_ROLE_SET = new Set<string>([
  'locations',
  'location_anchors',
  'zones',
  'zone_nodes',
  'zone_relations',
  'human_cast',
  'human_garments',
  'recurring_props',
  'set_board_authorities',
  'set_board_areas',
  'set_board_nodes',
  'set_board_relations',
  'page_contracts',
  'page_cast_ids',
  'page_cast_states',
  'page_actions',
  'page_action_semantic_coverage',
  'page_prop_constraints',
  'page_safety_constraints',
  'forbidden_global_elements',
]);
const PAGE_ITEM_COLLECTION_ROLE_SET = new Set<string>([
  'page_cast_ids',
  'page_cast_states',
  'page_actions',
  'page_action_semantic_coverage',
  'page_prop_constraints',
  'page_safety_constraints',
]);
const FIELD_ROLE_SET = new Set<string>([
  'root',
  'schema_version',
  'identity',
  'name',
  'description',
  'value',
  'array',
  'member',
  'reference',
  'reference_kind',
  'binding',
  'binding_mode',
  'binding_origin',
  'binding_value',
  'appearance',
  'world_type',
  'topology',
  'transition',
  'coverage',
  'cardinality',
  'disposition',
  'reason',
  'payload',
  'action_binding',
  'cast_presence',
  'source_evidence',
  'lifecycle',
  'consumer',
  'relation',
  'projection',
  'authority',
  'prose_projection',
  'final_structure',
]);
const TRANSITION_STATE_SET = new Set<string>([
  'newly_introduced',
  'persistent',
  'resolved',
]);
const PAGE_FINAL_STRUCTURAL_CAUSE_SET = new Set<string>(
  PAGE_FINAL_STRUCTURAL_CAUSES,
);

const ISSUE_KEYS = ['code', 'family', 'locator'].sort();
const PAGE_FINAL_STRUCTURAL_ISSUE_KEYS = [
  'causes',
  'code',
  'family',
  'locator',
].sort();
const TRANSITION_ITEM_KEYS = ['issue', 'state'].sort();
const ATTEMPT_DIAGNOSTICS_KEYS = [
  'currentUniqueCount',
  'emittedCount',
  'finalAttempt',
  'items',
  'newlyIntroducedCount',
  'persistentCount',
  'resolvedCount',
  'truncated',
  'version',
].sort();
const LOCATOR_KEYS: Record<DraftValidationLocatorKind, readonly string[]> = {
  root: ['fieldRole', 'kind'],
  cover: ['fieldRole', 'kind'],
  collection: ['collectionRole', 'fieldRole', 'kind'],
  collection_item: [
    'collectionRole',
    'fieldRole',
    'itemIndex',
    'kind',
  ],
  human_garment: [
    'fieldRole',
    'garmentIndex',
    'humanIndex',
    'kind',
  ],
  zone_node: ['fieldRole', 'kind', 'nodeIndex', 'zoneIndex'],
  zone_relation: [
    'fieldRole',
    'kind',
    'relationIndex',
    'zoneIndex',
  ],
  set_authority: ['authorityIndex', 'fieldRole', 'kind'],
  set_area: ['areaIndex', 'authorityIndex', 'fieldRole', 'kind'],
  set_area_node: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'nodeIndex',
  ],
  set_area_relation: [
    'areaIndex',
    'authorityIndex',
    'fieldRole',
    'kind',
    'relationIndex',
  ],
  page: ['fieldRole', 'kind', 'pageNumber'],
  page_item: [
    'collectionRole',
    'fieldRole',
    'itemIndex',
    'kind',
    'pageNumber',
  ],
  source_evidence: [
    'coverageIndex',
    'fieldRole',
    'kind',
    'pageNumber',
  ],
};

const ALLOWED_LOCATOR_KINDS: Record<
  DraftValidationIssueFamily,
  readonly DraftValidationLocatorKind[]
> = {
  draft_schema: [
    'root',
    'cover',
    'collection',
    'collection_item',
    'human_garment',
    'zone_node',
    'zone_relation',
    'set_authority',
    'set_area',
    'set_area_node',
    'set_area_relation',
    'page',
    'page_item',
  ],
  draft_contract: [
    'root',
    'cover',
    'collection',
    'collection_item',
    'human_garment',
    'zone_node',
    'zone_relation',
    'set_authority',
    'set_area',
    'set_area_node',
    'set_area_relation',
    'page',
    'page_item',
  ],
  action_semantic: ['root', 'collection', 'collection_item', 'page', 'page_item'],
  source_evidence_id: [
    'collection',
    'collection_item',
    'source_evidence',
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function structuralIndexIsValid(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DRAFT_VALIDATION_STRUCTURAL_INDEX
  );
}

function pageNumberIsValid(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

/**
 * Build a closed locator at a producer boundary without ever copying an
 * unusable authored page value into typed evidence. Positive safe integers
 * retain page precision. Otherwise the caller's array position is used when
 * it is itself a bounded structural index; an impossible oversized position
 * degrades once more to the closed collection root.
 *
 * `source_evidence` needs its coverage index on the positive-page path. Its
 * fallback deliberately uses the already-closed action-semantic collection
 * vocabulary and carries no authored page value.
 */
export function draftValidationLocatorForUntrustedPage(args: {
  positiveKind: 'source_evidence';
  pageNumber: unknown;
  fieldRole: 'source_evidence';
  fallbackCollectionRole: 'page_action_semantic_coverage';
  itemIndex: unknown;
}): SourceEvidenceIdDraftValidationLocator;
export function draftValidationLocatorForUntrustedPage(args: {
  positiveKind: 'page';
  pageNumber: unknown;
  fieldRole: DraftValidationFieldRole;
  fallbackCollectionRole: DraftValidationCollectionRole;
  itemIndex: unknown;
}): DraftValidationLocator;
export function draftValidationLocatorForUntrustedPage(
  args:
    | {
        positiveKind: 'page';
        pageNumber: unknown;
        fieldRole: DraftValidationFieldRole;
        fallbackCollectionRole: DraftValidationCollectionRole;
        itemIndex: unknown;
      }
    | {
        positiveKind: 'source_evidence';
        pageNumber: unknown;
        fieldRole: 'source_evidence';
        fallbackCollectionRole: 'page_action_semantic_coverage';
        itemIndex: unknown;
      },
): DraftValidationLocator {
  if (pageNumberIsValid(args.pageNumber)) {
    if (
      args.positiveKind === 'source_evidence' &&
      structuralIndexIsValid(args.itemIndex)
    ) {
      return {
        kind: 'source_evidence',
        fieldRole: args.fieldRole,
        pageNumber: args.pageNumber,
        coverageIndex: args.itemIndex,
      };
    }
    if (args.positiveKind === 'page') {
      return {
        kind: 'page',
        fieldRole: args.fieldRole,
        pageNumber: args.pageNumber,
      };
    }
  }
  if (structuralIndexIsValid(args.itemIndex)) {
    return {
      kind: 'collection_item',
      collectionRole: args.fallbackCollectionRole,
      fieldRole: args.fieldRole,
      itemIndex: args.itemIndex,
    };
  }
  return {
    kind: 'collection',
    collectionRole: args.fallbackCollectionRole,
    fieldRole: args.fieldRole,
  };
}

function countIsValid(value: unknown): value is number {
  return structuralIndexIsValid(value);
}

export function draftValidationLocatorIsValid(
  value: unknown,
): value is DraftValidationLocator {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (!Object.prototype.hasOwnProperty.call(LOCATOR_KEYS, value.kind)) {
    return false;
  }
  const kind = value.kind as DraftValidationLocatorKind;
  if (!exactKeys(value, LOCATOR_KEYS[kind]!)) return false;
  if (
    typeof value.fieldRole !== 'string' ||
    !FIELD_ROLE_SET.has(value.fieldRole)
  ) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'collectionRole') &&
    (typeof value.collectionRole !== 'string' ||
      !COLLECTION_ROLE_SET.has(value.collectionRole))
  ) {
    return false;
  }
  if (
    kind === 'page_item' &&
    !PAGE_ITEM_COLLECTION_ROLE_SET.has(String(value.collectionRole))
  ) {
    return false;
  }
  if (
    kind === 'source_evidence' &&
    value.fieldRole !== 'source_evidence'
  ) {
    return false;
  }
  for (const [key, candidate] of Object.entries(value)) {
    if (key === 'pageNumber' && !pageNumberIsValid(candidate)) return false;
    if (key.endsWith('Index') && !structuralIndexIsValid(candidate)) {
      return false;
    }
  }
  return true;
}

export function draftValidationIssueIsValid(
  value: unknown,
): value is DraftValidationIssue {
  const pageFinalStructural =
    isObject(value) &&
    value.family === 'draft_contract' &&
    value.code === 'final_structural_invariant_invalid' &&
    isObject(value.locator) &&
    value.locator.kind === 'page';
  if (
    !isObject(value) ||
    !exactKeys(
      value,
      pageFinalStructural
        ? PAGE_FINAL_STRUCTURAL_ISSUE_KEYS
        : ISSUE_KEYS,
    ) ||
    typeof value.family !== 'string' ||
    !FAMILY_SET.has(value.family) ||
    typeof value.code !== 'string' ||
    !draftValidationLocatorIsValid(value.locator)
  ) {
    return false;
  }
  const family = value.family as DraftValidationIssueFamily;
  const catalog = DRAFT_VALIDATION_ISSUE_CATALOG[family] as Record<
    string,
    true
  >;
  if (
    !Object.prototype.hasOwnProperty.call(catalog, value.code) ||
    !ALLOWED_LOCATOR_KINDS[family].includes(value.locator.kind)
  ) {
    return false;
  }
  if (pageFinalStructural) {
    if (
      !Array.isArray(value.causes) ||
      value.causes.length === 0 ||
      value.causes.length > PAGE_FINAL_STRUCTURAL_CAUSES.length ||
      value.causes.some(
        (cause) =>
          typeof cause !== 'string' ||
          !PAGE_FINAL_STRUCTURAL_CAUSE_SET.has(cause),
      )
    ) {
      return false;
    }
    const causes = value.causes as string[];
    const canonicalCauses = [...new Set(causes)].sort();
    if (
      causes.length !== canonicalCauses.length ||
      JSON.stringify(causes) !== JSON.stringify(canonicalCauses)
    ) {
      return false;
    }
  }
  if (family === 'source_evidence_id') {
    if (value.locator.kind === 'source_evidence') return true;
    if (
      value.locator.kind !== 'collection' &&
      value.locator.kind !== 'collection_item'
    ) {
      return false;
    }
    return (
      value.locator.collectionRole ===
        'page_action_semantic_coverage' &&
      value.locator.fieldRole === 'source_evidence'
    );
  }
  return true;
}

function canonicalLocator(
  locator: DraftValidationLocator,
): DraftValidationLocator {
  return canonicalize(locator) as DraftValidationLocator;
}

export function draftValidationIssueKey(
  issue: DraftValidationIssue,
): string {
  if (!draftValidationIssueIsValid(issue)) {
    throw new Error('draft validation diagnostic contract invalid');
  }
  return JSON.stringify([
    issue.family,
    issue.code,
    canonicalLocator(issue.locator),
  ]);
}

export function normalizeDraftValidationIssues(
  values: readonly DraftValidationIssue[],
): readonly DraftValidationIssue[] {
  const normalized = new Map<string, DraftValidationIssue>();
  for (const value of values) {
    if (!draftValidationIssueIsValid(value)) {
      throw new Error('draft validation diagnostic contract invalid');
    }
    const issue = (
      value.family === 'draft_contract' &&
      value.code === 'final_structural_invariant_invalid' &&
      value.locator.kind === 'page' &&
      'causes' in value
        ? {
            family: value.family,
            code: value.code,
            locator: canonicalLocator(value.locator),
            causes: [...value.causes],
          }
        : {
            family: value.family,
            code: value.code,
            locator: canonicalLocator(value.locator),
          }
    ) as DraftValidationIssue;
    const key = draftValidationIssueKey(issue);
    const prior = normalized.get(key);
    if (
      prior?.family === 'draft_contract' &&
      prior.code === 'final_structural_invariant_invalid' &&
      prior.locator.kind === 'page' &&
      'causes' in prior &&
      issue.family === 'draft_contract' &&
      issue.code === 'final_structural_invariant_invalid' &&
      issue.locator.kind === 'page' &&
      'causes' in issue
    ) {
      normalized.set(key, {
        ...issue,
        causes: [...new Set([...prior.causes, ...issue.causes])].sort(),
      });
    } else {
      normalized.set(key, issue);
    }
  }
  return [...normalized.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, issue]) => issue);
}

export function draftValidationDiagnosticCodesForIssues(
  values: readonly DraftValidationIssue[],
): Array<
  | 'draft_schema_validation_failed'
  | 'draft_contract_validation_failed'
  | 'action_semantic_validation_failed'
  | 'source_evidence_validation_failed'
> {
  const families = new Set(
    normalizeDraftValidationIssues(values).map((issue) => issue.family),
  );
  const mapping = {
    draft_schema: 'draft_schema_validation_failed',
    draft_contract: 'draft_contract_validation_failed',
    action_semantic: 'action_semantic_validation_failed',
    source_evidence_id: 'source_evidence_validation_failed',
  } as const;
  return DRAFT_VALIDATION_FAMILIES.filter((family) => families.has(family))
    .map((family) => mapping[family])
    .sort();
}

function transitionItemKey(item: DraftValidationTransitionItem): string {
  return JSON.stringify([
    draftValidationIssueKey(item.issue),
    item.state,
  ]);
}

export function buildDraftValidationAttemptDiagnostics(args: {
  emittedIssues: readonly DraftValidationIssue[];
  previousIssues?: readonly DraftValidationIssue[];
  finalAttempt: boolean;
}): DraftValidationAttemptDiagnostics {
  const current = normalizeDraftValidationIssues(args.emittedIssues);
  const previous = normalizeDraftValidationIssues(args.previousIssues ?? []);
  const currentByKey = new Map(
    current.map((issue) => [draftValidationIssueKey(issue), issue]),
  );
  const previousByKey = new Map(
    previous.map((issue) => [draftValidationIssueKey(issue), issue]),
  );
  const items: DraftValidationTransitionItem[] = [];
  for (const [key, issue] of currentByKey) {
    items.push({
      state: previousByKey.has(key) ? 'persistent' : 'newly_introduced',
      issue,
    });
  }
  for (const [key, issue] of previousByKey) {
    if (!currentByKey.has(key)) items.push({ state: 'resolved', issue });
  }
  items.sort((left, right) => {
    const leftKey = transitionItemKey(left);
    const rightKey = transitionItemKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const newlyIntroducedCount = items.filter(
    (item) => item.state === 'newly_introduced',
  ).length;
  const persistentCount = items.filter(
    (item) => item.state === 'persistent',
  ).length;
  const resolvedCount = items.filter(
    (item) => item.state === 'resolved',
  ).length;
  return {
    version: DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION,
    emittedCount: args.emittedIssues.length,
    currentUniqueCount: current.length,
    newlyIntroducedCount,
    persistentCount,
    resolvedCount,
    items: items.slice(0, MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS),
    finalAttempt: args.finalAttempt,
    truncated:
      items.length > MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS,
  };
}

export function buildDraftValidationDiagnosticTrail(
  emissionsByAttempt: readonly (readonly DraftValidationIssue[])[],
): readonly DraftValidationAttemptDiagnostics[] {
  return emissionsByAttempt.map((emittedIssues, index) =>
    buildDraftValidationAttemptDiagnostics({
      emittedIssues,
      previousIssues: index === 0 ? [] : emissionsByAttempt[index - 1],
      finalAttempt: index === emissionsByAttempt.length - 1,
    }),
  );
}

export function draftValidationAttemptDiagnosticsIsValid(
  value: unknown,
): value is DraftValidationAttemptDiagnostics {
  if (!isObject(value) || !exactKeys(value, ATTEMPT_DIAGNOSTICS_KEYS)) {
    return false;
  }
  if (
    value.version !== DRAFT_VALIDATION_ATTEMPT_DIAGNOSTICS_VERSION ||
    !countIsValid(value.emittedCount) ||
    !countIsValid(value.currentUniqueCount) ||
    !countIsValid(value.newlyIntroducedCount) ||
    !countIsValid(value.persistentCount) ||
    !countIsValid(value.resolvedCount) ||
    typeof value.finalAttempt !== 'boolean' ||
    typeof value.truncated !== 'boolean' ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS ||
    value.emittedCount < value.currentUniqueCount ||
    value.currentUniqueCount !==
      value.newlyIntroducedCount + value.persistentCount
  ) {
    return false;
  }
  const items = value.items as unknown[];
  const itemKeys: string[] = [];
  const persistedStateCounts = {
    newly_introduced: 0,
    persistent: 0,
    resolved: 0,
  };
  for (const candidate of items) {
    if (
      !isObject(candidate) ||
      !exactKeys(candidate, TRANSITION_ITEM_KEYS) ||
      typeof candidate.state !== 'string' ||
      !TRANSITION_STATE_SET.has(candidate.state) ||
      !draftValidationIssueIsValid(candidate.issue)
    ) {
      return false;
    }
    persistedStateCounts[
      candidate.state as DraftValidationTransitionState
    ] += 1;
    itemKeys.push(
      transitionItemKey(candidate as unknown as DraftValidationTransitionItem),
    );
  }
  const canonicalItemKeys = [...itemKeys].sort();
  if (
    new Set(itemKeys).size !== itemKeys.length ||
    JSON.stringify(itemKeys) !== JSON.stringify(canonicalItemKeys) ||
    persistedStateCounts.newly_introduced > value.newlyIntroducedCount ||
    persistedStateCounts.persistent > value.persistentCount ||
    persistedStateCounts.resolved > value.resolvedCount
  ) {
    return false;
  }
  const completeTransitionCount =
    value.newlyIntroducedCount + value.persistentCount + value.resolvedCount;
  if (value.truncated) {
    return (
      completeTransitionCount >
        MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS &&
      items.length === MAX_PERSISTED_DRAFT_VALIDATION_TRANSITION_ITEMS
    );
  }
  return (
    completeTransitionCount === items.length &&
    persistedStateCounts.newly_introduced === value.newlyIntroducedCount &&
    persistedStateCounts.persistent === value.persistentCount &&
    persistedStateCounts.resolved === value.resolvedCount
  );
}

export function draftValidationDiagnosticTrailIsValid(
  value: unknown,
): value is readonly DraftValidationAttemptDiagnostics[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(draftValidationAttemptDiagnosticsIsValid) &&
    value.filter((attempt) => attempt.finalAttempt).length === 1 &&
    value[value.length - 1]?.finalAttempt === true
  );
}
