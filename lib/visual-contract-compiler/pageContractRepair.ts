import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
  type PageFinalStructuralCause,
} from './draftValidationDiagnostics';
import {
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  permittedRepresentedElsewherePointerValuesForPage,
  type ActionSemanticCoverageTemplate,
  type RepresentedElsewherePointerValue,
} from './actionSemanticCoverage';
import {
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
} from './templateDraftSchema';
import {
  draftAuthorityReferenceIssueIsValid,
  type DraftAuthorityReferenceIssue,
} from './draftAuthorityReferenceDiagnostics';
import type { PresentationRequirementRepairTarget } from './presentationRequirementRepair';
import { SOURCE_EVIDENCE_ID_PATTERN } from './sourceEvidenceCatalog';
import { canonicalize } from '@/lib/canonical-json';

export const PAGE_CONTRACT_REPAIR_SCHEMA_VERSION =
  'page-contract-repair-schema/v2' as const;
export const PAGE_CONTRACT_REPAIR_SCHEMA_NAME =
  'PageContractRepairPatches' as const;
export const PAGE_CONTRACT_REPAIR_PROMPT_VERSION =
  'page-contract-repair-prompt/v12' as const;
export const PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION =
  'page-contract-repair-user-prompt/v13' as const;
export const PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION =
  'page-contract-repair-input-encoding/v3' as const;
export const PAGE_CONTRACT_REPAIR_PREVIOUS_FAILURE_VALUES = [
  'target_scope_invalid',
] as const;
export type PageContractRepairPreviousFailure =
  (typeof PAGE_CONTRACT_REPAIR_PREVIOUS_FAILURE_VALUES)[number];
export const PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION =
  'page-spatial-reference-repair-schema/v1' as const;
export const PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_NAME =
  'PageSpatialReferenceRepairPatches' as const;
export const PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION =
  'page-spatial-reference-repair-prompt/v1' as const;
export const PAGE_SPATIAL_REFERENCE_REPAIR_USER_PROMPT_VERSION =
  'page-spatial-reference-repair-user-prompt/v1' as const;

function strictObject(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export const PAGE_CONTRACT_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
    pageContracts: {
      type: 'array',
      minItems: 1,
      items: TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
    },
  });

const PAGE_SPATIAL_REPAIR_FIELD_ROLES = [
  'subject',
  'object',
  'spatialEffect.target',
  'spatialConstraint.target',
] as const;

export type PageSpatialReferenceRepairFieldRole =
  (typeof PAGE_SPATIAL_REPAIR_FIELD_ROLES)[number];

const pageSpatialReferencePatch = strictObject({
  pageNumber: { type: 'integer', minimum: 1 },
  actionIndex: { type: 'integer', minimum: 0 },
  fieldRole: {
    type: 'string',
    enum: PAGE_SPATIAL_REPAIR_FIELD_ROLES,
  },
  spatialReferenceId: { type: 'string' },
});

export const PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
  patches: {
    type: 'array',
    minItems: 1,
    items: pageSpatialReferencePatch,
  },
});

const PAGE_CONTRACT_KEYS = Object.freeze(
  Object.keys(
    (
      TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA.properties as Record<
        string,
        unknown
      >
    ),
  ),
);

export interface PageContractRepairAffectedPage {
  pageNumber: number;
  pageContract: Record<string, unknown>;
  repairTargets: PageContractRepairTarget[];
  /**
   * Exact repository-validator messages for this page and this failed attempt.
   * These are in-memory repair input only; canonical receipts retain the typed
   * issue identities instead of this prose.
   */
  validationHints: string[];
  permittedPointerValues: RepresentedElsewherePointerValue[];
}

type PageContractRepairEncodedValue =
  | null
  | boolean
  | number
  | string
  | PageContractRepairEncodedValue[];

export interface PageContractRepairEncodedInput {
  encodingVersion: typeof PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION;
  stringDictionary: string[];
  fragmentDictionary: string[];
  objectShapes: string[][];
  valueDictionary: PageContractRepairEncodedValue[];
  rootTuple: PageContractRepairEncodedValue;
}

export interface PageSpatialReferenceValue {
  id: string;
  kind: string;
  description: string;
}

export interface PageSpatialRepairAuthority {
  pageNumber: number;
  zoneId: string;
  permittedSpatialReferences: PageSpatialReferenceValue[];
}

export interface PageSpatialReferenceRepairTarget {
  pageNumber: number;
  actionIndex: number;
  fieldRole: PageSpatialReferenceRepairFieldRole;
  actionContext: {
    predicate: string;
    polarity: string;
    spatialEffectKind: string | null;
    spatialEffectRelation: string | null;
    spatialConstraintRelation: string | null;
  };
  permittedSpatialReferences: PageSpatialReferenceValue[];
}

type PageSpatialReferenceRepairTargetBase = Omit<
  PageSpatialReferenceRepairTarget,
  'actionContext'
>;

export interface PageSpatialReferenceRepairPatch {
  pageNumber: number;
  actionIndex: number;
  fieldRole: PageSpatialReferenceRepairFieldRole;
  spatialReferenceId: string;
}

type PageContractSpatialRepairTarget = {
  family: 'draft_contract';
  code: 'page_spatial_reference_outside_zone';
  pageNumber: number;
  collectionRole: 'page_actions';
  itemIndex: number;
  fieldRole:
    | 'subject'
    | 'object'
    | 'spatialEffect.target'
    | 'spatialConstraint.target';
  permittedSpatialReferences: PageSpatialReferenceValue[];
};

type PageSpatialLocatorRepairTarget = Omit<
  PageContractSpatialRepairTarget,
  'permittedSpatialReferences'
>;

export type PageContractRepairTarget =
  | {
      family: 'draft_contract';
      code: 'final_structural_invariant_invalid';
      pageNumber: number;
      causes: readonly PageFinalStructuralCause[];
    }
  | {
      family: 'action_semantic';
      code:
        | 'represented_elsewhere_pointer_out_of_scope'
        | 'represented_elsewhere_pointer_unresolved'
        | 'represented_elsewhere_value_mismatch';
      pageNumber: number;
      coverageIndex: number;
    }
  | {
      family: 'action_semantic';
      code: 'action_coverage_cardinality_invalid';
      pageNumber: number;
      actionIndex: number;
    }
  | {
      family: 'action_semantic';
      code: 'action_beat_binding_cardinality_invalid';
      pageNumber: number;
      actionIndex: number;
    }
  | {
      family: 'action_semantic';
      code: 'action_beat_binding_component_invalid';
      pageNumber: number;
      originalBeatId: string;
      actionIndexes: number[];
      coverageIndex: number;
      sourceEvidenceId: string;
      coverageDeficit: number;
    }
  | {
      family: 'action_semantic';
      code: 'coverage_action_binding_cardinality_invalid';
      pageNumber: number;
      coverageIndex: number;
    }
  | {
      family: 'action_semantic';
      code: 'closed_catalog_capability_gap';
      pageNumber: number;
      coverageIndex: number;
      beatId: string;
      sourceEvidenceId: string;
      sourcePhrase: string;
      permittedPointerValues: PresentationRequirementRepairTarget['permittedPointerValues'];
    }
  | PageContractSpatialRepairTarget;

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function structuralRepairTarget(
  issue: DraftValidationIssue,
): PageContractRepairTarget | null {
  if (
    !draftValidationIssueIsValid(issue) ||
    issue.family !== 'draft_contract' ||
    issue.code !== 'final_structural_invariant_invalid' ||
    issue.locator.fieldRole !== 'final_structure' ||
    issue.locator.kind !== 'page' ||
    !('causes' in issue)
  ) {
    return null;
  }
  return {
    family: issue.family,
    code: issue.code,
    pageNumber: issue.locator.pageNumber,
    causes: [...issue.causes],
  };
}

const REPRESENTED_ELSEWHERE_REPAIR_FIELD_ROLES = {
  represented_elsewhere_pointer_out_of_scope: 'reference',
  represented_elsewhere_pointer_unresolved: 'reference',
  represented_elsewhere_value_mismatch: 'payload',
} as const;

function representedElsewhereRepairTarget(
  issue: DraftValidationIssue,
): PageContractRepairTarget | null {
  if (
    !draftValidationIssueIsValid(issue) ||
    issue.family !== 'action_semantic' ||
    !Object.prototype.hasOwnProperty.call(
      REPRESENTED_ELSEWHERE_REPAIR_FIELD_ROLES,
      issue.code,
    ) ||
    issue.locator.kind !== 'page_item' ||
    issue.locator.collectionRole !==
      'page_action_semantic_coverage'
  ) {
    return null;
  }
  const code = issue.code as keyof typeof REPRESENTED_ELSEWHERE_REPAIR_FIELD_ROLES;
  if (
    issue.locator.fieldRole !==
    REPRESENTED_ELSEWHERE_REPAIR_FIELD_ROLES[code]
  ) {
    return null;
  }
  return {
    family: issue.family,
    code,
    pageNumber: issue.locator.pageNumber,
    coverageIndex: issue.locator.itemIndex,
  };
}

function pageContractRepairTargetKey(
  target: PageContractRepairTarget,
): string {
  return JSON.stringify([
    target.pageNumber,
    target.family,
    target.code,
    'actionIndex' in target ? target.actionIndex : null,
    'coverageIndex' in target ? target.coverageIndex : null,
    'collectionRole' in target ? target.collectionRole : null,
    'itemIndex' in target ? target.itemIndex : null,
    'fieldRole' in target ? target.fieldRole : null,
    'originalBeatId' in target ? target.originalBeatId : null,
    'actionIndexes' in target ? target.actionIndexes : null,
    'sourceEvidenceId' in target ? target.sourceEvidenceId : null,
    'coverageDeficit' in target ? target.coverageDeficit : null,
    'causes' in target ? target.causes : null,
  ]);
}

function pageSpatialRepairTarget(
  issue: DraftAuthorityReferenceIssue,
): PageSpatialLocatorRepairTarget | null {
  if (
    !draftAuthorityReferenceIssueIsValid(issue) ||
    issue.code !== 'page_spatial_reference_outside_zone' ||
    issue.locator.referenceClass !== 'page_spatial_selection'
  ) {
    return null;
  }
  if (issue.locator.kind === 'page_spatial_action') {
    if (
      ![
        'subject',
        'object',
        'spatialEffect.target',
        'spatialConstraint.target',
      ].includes(issue.locator.fieldRole)
    ) {
      return null;
    }
    return {
      family: 'draft_contract',
      code: 'page_spatial_reference_outside_zone',
      pageNumber: issue.locator.pageNumber,
      collectionRole: 'page_actions',
      itemIndex: issue.locator.actionIndex,
      fieldRole: issue.locator.fieldRole as
        | 'subject'
        | 'object'
        | 'spatialEffect.target'
        | 'spatialConstraint.target',
    };
  }
  return null;
}

function repairTargets(
  issues: readonly DraftValidationIssue[],
): PageContractRepairTarget[] | null {
  if (issues.length === 0) return null;
  const targetForIssue = structuralRepairTarget(issues[0]!)
    ? structuralRepairTarget
    : representedElsewhereRepairTarget(issues[0]!)
      ? representedElsewhereRepairTarget
      : null;
  if (!targetForIssue) return null;
  const targets = issues.map(targetForIssue);
  if (targets.some((target) => target === null)) return null;
  const unique = new Map<string, PageContractRepairTarget>();
  for (const target of targets as PageContractRepairTarget[]) {
    const key =
      target.code === 'final_structural_invariant_invalid'
        ? JSON.stringify([
            target.pageNumber,
            target.family,
            target.code,
          ])
        : pageContractRepairTargetKey(target);
    const prior = unique.get(key);
    if (
      prior?.code === 'final_structural_invariant_invalid' &&
      target.code === 'final_structural_invariant_invalid'
    ) {
      unique.set(key, {
        ...prior,
        causes: [...new Set([...prior.causes, ...target.causes])].sort(),
      });
    } else if (!prior) {
      unique.set(key, target);
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.family.localeCompare(right.family) ||
      left.code.localeCompare(right.code) ||
      pageContractRepairTargetKey(left).localeCompare(
        pageContractRepairTargetKey(right),
      ),
  );
}

function pageSpatialRepairTargets(
  issues: readonly DraftAuthorityReferenceIssue[],
): PageSpatialLocatorRepairTarget[] | null {
  if (issues.length === 0) return null;
  const targets = issues.map(pageSpatialRepairTarget);
  if (targets.some((target) => target === null)) return null;
  const unique = new Map<string, PageSpatialLocatorRepairTarget>();
  for (const target of targets as PageSpatialLocatorRepairTarget[]) {
    unique.set(
      JSON.stringify([
        target.pageNumber,
        target.family,
        target.code,
        'collectionRole' in target ? target.collectionRole : null,
        'itemIndex' in target ? target.itemIndex : null,
        'fieldRole' in target ? target.fieldRole : null,
      ]),
      target,
    );
  }
  return [...unique.values()].sort((left, right) => {
    const leftCollection =
      'collectionRole' in left ? left.collectionRole : '';
    const rightCollection =
      'collectionRole' in right ? right.collectionRole : '';
    const leftIndex = 'itemIndex' in left ? left.itemIndex : -1;
    const rightIndex = 'itemIndex' in right ? right.itemIndex : -1;
    const leftField = 'fieldRole' in left ? left.fieldRole : '';
    const rightField = 'fieldRole' in right ? right.fieldRole : '';
    return (
      left.pageNumber - right.pageNumber ||
      leftCollection.localeCompare(rightCollection) ||
      leftIndex - rightIndex ||
      leftField.localeCompare(rightField)
    );
  });
}

function pageSpatialAuthorityForPage(args: {
  authority: readonly PageSpatialRepairAuthority[];
  pageContract: Record<string, unknown>;
  pageNumber: number;
}): PageSpatialReferenceValue[] | null {
  const matches = args.authority.filter(
    (value) => value.pageNumber === args.pageNumber,
  );
  if (
    matches.length !== 1 ||
    typeof args.pageContract.zoneId !== 'string' ||
    matches[0]!.zoneId !== args.pageContract.zoneId ||
    matches[0]!.permittedSpatialReferences.length === 0
  ) {
    return null;
  }
  const unique = new Map<string, PageSpatialReferenceValue>();
  for (const value of matches[0]!.permittedSpatialReferences) {
    if (
      typeof value.id !== 'string' ||
      value.id.length === 0 ||
      typeof value.kind !== 'string' ||
      value.kind.length === 0 ||
      typeof value.description !== 'string' ||
      value.description.length === 0 ||
      unique.has(value.id)
    ) {
      return null;
    }
    unique.set(value.id, structuredClone(value));
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.id.localeCompare(right.id) ||
      left.kind.localeCompare(right.kind) ||
      left.description.localeCompare(right.description),
  );
}

function spatialRepairTargetKey(value: {
  pageNumber: number;
  actionIndex: number;
  fieldRole: PageSpatialReferenceRepairFieldRole;
}): string {
  return JSON.stringify([
    value.pageNumber,
    value.actionIndex,
    value.fieldRole,
  ]);
}

function pageActionForTarget(args: {
  draft: Record<string, unknown>;
  pageNumber: number;
  actionIndex: number;
}): Record<string, unknown> | null {
  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const matches = pages.filter(
    (page) => page?.pageNumber === args.pageNumber,
  );
  if (matches.length !== 1) return null;
  const actions = Array.isArray(matches[0]!.actionRequirements)
    ? matches[0]!.actionRequirements
    : [];
  return args.actionIndex >= 0 && args.actionIndex < actions.length
    ? recordValue(actions[args.actionIndex])
    : null;
}

function pageCoverageForTarget(args: {
  draft: Record<string, unknown>;
  pageNumber: number;
  coverageIndex: number;
}): Record<string, unknown> | null {
  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const matches = pages.filter(
    (page) => page?.pageNumber === args.pageNumber,
  );
  if (matches.length !== 1) return null;
  const coverage = Array.isArray(matches[0]!.actionSemanticCoverage)
    ? matches[0]!.actionSemanticCoverage
    : [];
  return args.coverageIndex >= 0 &&
    args.coverageIndex < coverage.length
    ? recordValue(coverage[args.coverageIndex])
    : null;
}

function currentSpatialReferenceForRole(
  action: Record<string, unknown>,
  fieldRole: PageSpatialReferenceRepairFieldRole,
): Record<string, unknown> | null {
  if (fieldRole === 'subject') {
    const subject = recordValue(action.subject);
    return subject?.kind === 'entity'
      ? recordValue(subject.entity)
      : null;
  }
  if (fieldRole === 'object') return recordValue(action.object);
  if (fieldRole === 'spatialEffect.target') {
    const effect = recordValue(action.spatialEffect);
    return effect?.kind === 'relation'
      ? recordValue(effect.target)
      : null;
  }
  const constraint = recordValue(action.spatialConstraint);
  return constraint ? recordValue(constraint.target) : null;
}

function spatialReferenceShapeIsRepairable(
  value: Record<string, unknown> | null,
): value is Record<string, unknown> & { kind: 'spatial'; id: string } {
  return (
    value?.kind === 'spatial' &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
}

function replaceSpatialReferenceForRole(args: {
  action: Record<string, unknown>;
  fieldRole: PageSpatialReferenceRepairFieldRole;
  value: Record<string, unknown>;
}): boolean {
  if (
    !spatialReferenceShapeIsRepairable(
      currentSpatialReferenceForRole(args.action, args.fieldRole),
    )
  ) {
    return false;
  }
  if (args.fieldRole === 'subject') {
    const subject = recordValue(args.action.subject)!;
    subject.entity = args.value;
    return true;
  }
  if (args.fieldRole === 'object') {
    args.action.object = args.value;
    return true;
  }
  if (args.fieldRole === 'spatialEffect.target') {
    recordValue(args.action.spatialEffect)!.target = args.value;
    return true;
  }
  recordValue(args.action.spatialConstraint)!.target = args.value;
  return true;
}

function actionContextForSpatialRepair(
  action: Record<string, unknown>,
): PageSpatialReferenceRepairTarget['actionContext'] | null {
  if (
    typeof action.predicate !== 'string' ||
    action.predicate.length === 0 ||
    typeof action.polarity !== 'string' ||
    action.polarity.length === 0
  ) {
    return null;
  }
  const effect = recordValue(action.spatialEffect);
  const constraint = recordValue(action.spatialConstraint);
  return {
    predicate: action.predicate,
    polarity: action.polarity,
    spatialEffectKind:
      typeof effect?.kind === 'string' ? effect.kind : null,
    spatialEffectRelation:
      typeof effect?.relation === 'string' ? effect.relation : null,
    spatialConstraintRelation:
      typeof constraint?.relation === 'string'
        ? constraint.relation
        : null,
  };
}

/**
 * Builds an exact field-level repair set for the one closed page-spatial
 * authority family. Rejected authored IDs are validated as spatial refs but
 * never copied into repair authority or prompt context.
 */
function pageSpatialReferenceRepairTargetBases(args: {
  draft: Record<string, unknown>;
  issues: readonly DraftAuthorityReferenceIssue[];
  authority: readonly PageSpatialRepairAuthority[];
}): PageSpatialReferenceRepairTargetBase[] | null {
  const targets = pageSpatialRepairTargets(args.issues);
  if (!targets) return null;
  const result = targets.map((target) => {
    if (
      !('itemIndex' in target) ||
      !('fieldRole' in target) ||
      !PAGE_SPATIAL_REPAIR_FIELD_ROLES.includes(target.fieldRole)
    ) {
      return null;
    }
    const pages = Array.isArray(args.draft.pageContracts)
      ? args.draft.pageContracts.map(recordValue)
      : [];
    const pageMatches = pages.filter(
      (page) => page?.pageNumber === target.pageNumber,
    );
    if (pageMatches.length !== 1) return null;
    const action = pageActionForTarget({
      draft: args.draft,
      pageNumber: target.pageNumber,
      actionIndex: target.itemIndex,
    });
    if (
      !action ||
      !spatialReferenceShapeIsRepairable(
        currentSpatialReferenceForRole(action, target.fieldRole),
      )
    ) {
      return null;
    }
    const permittedSpatialReferences = pageSpatialAuthorityForPage({
      authority: args.authority,
      pageContract: pageMatches[0]!,
      pageNumber: target.pageNumber,
    });
    return permittedSpatialReferences
      ? {
          pageNumber: target.pageNumber,
          actionIndex: target.itemIndex,
          fieldRole: target.fieldRole,
          permittedSpatialReferences,
        }
      : null;
  });
  if (result.some((value) => value === null)) return null;
  const unique = new Map<string, PageSpatialReferenceRepairTargetBase>();
  for (const target of result as PageSpatialReferenceRepairTargetBase[]) {
    const key = spatialRepairTargetKey(target);
    if (unique.has(key)) return null;
    unique.set(key, target);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.actionIndex - right.actionIndex ||
      left.fieldRole.localeCompare(right.fieldRole),
  );
}

export function pageSpatialReferenceRepairTargets(args: {
  draft: Record<string, unknown>;
  issues: readonly DraftAuthorityReferenceIssue[];
  authority: readonly PageSpatialRepairAuthority[];
}): PageSpatialReferenceRepairTarget[] | null {
  const bases = pageSpatialReferenceRepairTargetBases(args);
  if (!bases) return null;
  const targets = bases.map((base) => {
    const action = pageActionForTarget({
      draft: args.draft,
      pageNumber: base.pageNumber,
      actionIndex: base.actionIndex,
    });
    const actionContext = action
      ? actionContextForSpatialRepair(action)
      : null;
    return actionContext
      ? { ...base, actionContext }
      : null;
  });
  return targets.every(
    (target): target is PageSpatialReferenceRepairTarget =>
      target !== null,
  )
    ? targets
    : null;
}

export function buildPageSpatialReferenceRepairSystemPrompt(): string {
  return [
    'Repair ONLY the exact page-spatial reference targets listed by the input.',
    'Return exactly one patch for every target identity and no other patch.',
    'For each patch copy one exact id from that target permittedSpatialReferences.',
    'Do not return a page, action, EntityRef object, JSON pointer, prose, or any extra key.',
    'The compiler applies the selected id at the exact typed target and preserves every other field.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildPageSpatialReferenceRepairUserPrompt(args: {
  targets: readonly PageSpatialReferenceRepairTarget[];
}): string {
  return JSON.stringify({
    targets: [...args.targets]
      .sort(
        (left, right) =>
          left.pageNumber - right.pageNumber ||
          left.actionIndex - right.actionIndex ||
          left.fieldRole.localeCompare(right.fieldRole),
      )
      .map((target) => structuredClone(target)),
  });
}

const PAGE_SPATIAL_REFERENCE_PATCH_KEYS = [
  'pageNumber',
  'actionIndex',
  'fieldRole',
  'spatialReferenceId',
] as const;

export function parsePageSpatialReferenceRepairPatches(
  raw: string,
): PageSpatialReferenceRepairPatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('page_spatial_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, ['patches']) ||
    !Array.isArray(root.patches) ||
    root.patches.length === 0
  ) {
    throw new Error('page_spatial_repair_response_invalid_shape');
  }
  return root.patches.map((value) => {
    const patch = recordValue(value);
    if (
      !patch ||
      !exactKeys(patch, PAGE_SPATIAL_REFERENCE_PATCH_KEYS) ||
      !Number.isSafeInteger(patch.pageNumber) ||
      (patch.pageNumber as number) < 1 ||
      !Number.isSafeInteger(patch.actionIndex) ||
      (patch.actionIndex as number) < 0 ||
      typeof patch.fieldRole !== 'string' ||
      !PAGE_SPATIAL_REPAIR_FIELD_ROLES.includes(
        patch.fieldRole as PageSpatialReferenceRepairFieldRole,
      ) ||
      typeof patch.spatialReferenceId !== 'string' ||
      patch.spatialReferenceId.length === 0
    ) {
      throw new Error('page_spatial_repair_patch_invalid');
    }
    return patch as unknown as PageSpatialReferenceRepairPatch;
  });
}

function maskedSpatialTargets(args: {
  draft: Record<string, unknown>;
  targets: readonly PageSpatialReferenceRepairTarget[];
}): unknown {
  const masked = structuredClone(args.draft);
  for (const target of args.targets) {
    const action = pageActionForTarget({
      draft: masked,
      pageNumber: target.pageNumber,
      actionIndex: target.actionIndex,
    });
    if (
      !action ||
      !replaceSpatialReferenceForRole({
        action,
        fieldRole: target.fieldRole,
        value: { kind: 'spatial', id: '__repair_target__' },
      })
    ) {
      throw new Error('page_spatial_repair_target_stale');
    }
  }
  return canonicalize(masked);
}

export function applyPageSpatialReferenceRepairPatches(args: {
  draft: Record<string, unknown>;
  targets: readonly PageSpatialReferenceRepairTarget[];
  patches: readonly PageSpatialReferenceRepairPatch[];
}): Record<string, unknown> {
  if (args.targets.length === 0) {
    throw new Error('page_spatial_repair_target_set_empty');
  }
  const expected = new Map<string, PageSpatialReferenceRepairTarget>();
  for (const target of args.targets) {
    const key = spatialRepairTargetKey(target);
    if (expected.has(key)) {
      throw new Error('page_spatial_repair_target_duplicate');
    }
    expected.set(key, target);
  }
  if (args.patches.length !== expected.size) {
    throw new Error('page_spatial_repair_patch_set_incomplete');
  }
  const replacements = new Map<
    string,
    PageSpatialReferenceRepairPatch
  >();
  for (const patch of args.patches) {
    const key = spatialRepairTargetKey(patch);
    const target = expected.get(key);
    if (!target || replacements.has(key)) {
      throw new Error('page_spatial_repair_patch_unexpected_or_duplicate');
    }
    if (
      !target.permittedSpatialReferences.some(
        (value) => value.id === patch.spatialReferenceId,
      )
    ) {
      throw new Error('page_spatial_repair_reference_not_permitted');
    }
    replacements.set(key, patch);
  }

  const beforeMasked = maskedSpatialTargets({
    draft: args.draft,
    targets: args.targets,
  });
  const result = structuredClone(args.draft);
  for (const target of args.targets) {
    const action = pageActionForTarget({
      draft: result,
      pageNumber: target.pageNumber,
      actionIndex: target.actionIndex,
    });
    const patch = replacements.get(spatialRepairTargetKey(target))!;
    if (
      !action ||
      !replaceSpatialReferenceForRole({
        action,
        fieldRole: target.fieldRole,
        value: {
          kind: 'spatial',
          id: patch.spatialReferenceId,
        },
      })
    ) {
      throw new Error('page_spatial_repair_target_stale');
    }
  }
  const afterMasked = maskedSpatialTargets({
    draft: result,
    targets: args.targets,
  });
  if (JSON.stringify(beforeMasked) !== JSON.stringify(afterMasked)) {
    throw new Error('page_spatial_repair_non_target_drift');
  }
  return result;
}

/**
 * Returns a complete, deterministic affected-page set only when every emitted
 * diagnostic belongs to one homogeneous closed repair family. Mixed or
 * unlocatable failures deliberately stay on the existing route.
 */
export function pageContractRepairAffectedPages(args: {
  draft: Record<string, unknown>;
  diagnosticIssues: readonly DraftValidationIssue[];
  validationMessages: readonly string[];
  pointerTemplate?: ActionSemanticCoverageTemplate;
}): PageContractRepairAffectedPage[] | null {
  if (
    args.validationMessages.length !== args.diagnosticIssues.length ||
    !args.validationMessages.every(
      (message) => typeof message === 'string' && message.length > 0,
    )
  ) {
    return null;
  }
  const targets = repairTargets(args.diagnosticIssues);
  if (!targets) return null;
  const actionSemanticRepair =
    targets[0]?.family === 'action_semantic';
  if (actionSemanticRepair && !args.pointerTemplate) return null;
  const pageNumbers = new Set(
    targets.map((target) => target.pageNumber),
  );
  const pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts
    : [];
  const validationHintsByPage = new Map<number, Set<string>>();
  for (const [index, issue] of args.diagnosticIssues.entries()) {
    const target = actionSemanticRepair
      ? representedElsewhereRepairTarget(issue)
      : structuralRepairTarget(issue);
    if (!target) return null;
    const hints = validationHintsByPage.get(target.pageNumber) ?? new Set<string>();
    hints.add(args.validationMessages[index]!);
    validationHintsByPage.set(target.pageNumber, hints);
  }
  const result = [...pageNumbers]
    .sort((left, right) => left - right)
    .map((pageNumber) => {
      const matches = pageContracts
        .map(recordValue)
        .filter((page) => page?.pageNumber === pageNumber);
      return matches.length === 1
        ? (() => {
            const pageTargets = targets.filter(
              (target) => target.pageNumber === pageNumber,
            );
            if (
              actionSemanticRepair &&
              pageTargets.some((target) => {
                if (!('coverageIndex' in target)) return true;
                const coverage = pageCoverageForTarget({
                  draft: args.draft,
                  pageNumber,
                  coverageIndex: target.coverageIndex,
                });
                return (
                  recordValue(coverage?.disposition)?.kind !==
                  'represented_elsewhere'
                );
              })
            ) {
              return null;
            }
            return {
              pageNumber,
              pageContract: structuredClone(matches[0]!),
              repairTargets: pageTargets,
              validationHints: [
                ...(validationHintsByPage.get(pageNumber) ?? []),
              ].sort(lexicalCompare),
              permittedPointerValues: actionSemanticRepair
                ? permittedRepresentedElsewherePointerValuesForPage({
                    template: args.pointerTemplate!,
                    pageNumber,
                  })
                : [],
            };
          })()
        : null;
    });
  return result.every(
    (value): value is PageContractRepairAffectedPage =>
      value !== null &&
      value.repairTargets.length > 0 &&
      value.validationHints.length > 0 &&
      (!actionSemanticRepair ||
        value.permittedPointerValues.length > 0),
  )
    ? result
    : null;
}

/**
 * Builds one complete-page repair authority when a draft exposes both closed
 * presentation gaps and final page-structure failures in the same validation
 * pass. The two existing provider repairs would otherwise serialize and
 * consume the bounded two-repair budget. No other family is admitted.
 */
export function pageContractPresentationStructuralRepairAffectedPages(args: {
  draft: Record<string, unknown>;
  presentationTargets: readonly PresentationRequirementRepairTarget[];
  structuralDiagnosticIssues: readonly DraftValidationIssue[];
  structuralValidationMessages: readonly string[];
}): PageContractRepairAffectedPage[] | null {
  if (args.presentationTargets.length === 0) return null;
  const structuralPages = pageContractRepairAffectedPages({
    draft: args.draft,
    diagnosticIssues: args.structuralDiagnosticIssues,
    validationMessages: args.structuralValidationMessages,
  });
  if (!structuralPages) return null;

  const presentationKeys = new Set<string>();
  for (const target of args.presentationTargets) {
    if (
      !Number.isSafeInteger(target.pageNumber) ||
      target.pageNumber < 1 ||
      !Number.isSafeInteger(target.coverageIndex) ||
      target.coverageIndex < 0 ||
      target.beatId.length === 0 ||
      target.sourceEvidenceId.length === 0 ||
      target.sourcePhrase.length === 0 ||
      target.permittedPointerValues.length === 0
    ) {
      return null;
    }
    const key = JSON.stringify([
      target.pageNumber,
      target.coverageIndex,
      target.beatId,
      target.sourceEvidenceId,
    ]);
    if (presentationKeys.has(key)) return null;
    presentationKeys.add(key);
  }

  const pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  if (pageContracts.some((page) => page === null)) return null;
  const structuralByPage = new Map(
    structuralPages.map((page) => [page.pageNumber, page]),
  );
  const pageNumbers = new Set<number>([
    ...structuralByPage.keys(),
    ...args.presentationTargets.map((target) => target.pageNumber),
  ]);

  const combined = [...pageNumbers]
    .sort((left, right) => left - right)
    .map((pageNumber): PageContractRepairAffectedPage | null => {
      const matches = pageContracts.filter(
        (page) => page?.pageNumber === pageNumber,
      );
      if (matches.length !== 1 || !matches[0]) return null;
      const presentationTargets = args.presentationTargets
        .filter((target) => target.pageNumber === pageNumber)
        .sort(
          (left, right) =>
            left.coverageIndex - right.coverageIndex ||
            lexicalCompare(left.beatId, right.beatId),
        );
      const presentationRepairTargets: PageContractRepairTarget[] =
        presentationTargets.map((target) => ({
          family: 'action_semantic',
          code: 'closed_catalog_capability_gap',
          pageNumber: target.pageNumber,
          coverageIndex: target.coverageIndex,
          beatId: target.beatId,
          sourceEvidenceId: target.sourceEvidenceId,
          sourcePhrase: target.sourcePhrase,
          permittedPointerValues: structuredClone(
            target.permittedPointerValues,
          ),
        }));
      const structural = structuralByPage.get(pageNumber);
      return {
        pageNumber,
        pageContract: structuredClone(matches[0]),
        repairTargets: [
          ...(structural?.repairTargets ?? []),
          ...presentationRepairTargets,
        ],
        validationHints: [
          ...(structural?.validationHints ?? []),
          ...presentationTargets.map(
            (target) =>
              `closed_catalog_capability_gap: actionSemanticCoverage[${target.coverageIndex}] must become one same-page presentation_requirement using one exact permitted pointer/value`,
          ),
        ].sort(lexicalCompare),
        permittedPointerValues: [],
      };
    });

  return combined.every(
    (page): page is PageContractRepairAffectedPage =>
      page !== null &&
      page.repairTargets.length > 0 &&
      page.validationHints.length > 0,
  )
    ? combined
    : null;
}

export interface PageContractAuthorityRepairPlan {
  affectedPages: PageContractRepairAffectedPage[];
  diagnosticIssues: DraftValidationIssue[];
  validationMessages: string[];
}

type ActionBindingCardinalityRepairTarget = Extract<
  PageContractRepairTarget,
  {
    code:
      | 'action_coverage_cardinality_invalid'
      | 'action_beat_binding_cardinality_invalid'
      | 'coverage_action_binding_cardinality_invalid';
  }
>;

type ActionBindingComponentRepairTarget = Extract<
  PageContractRepairTarget,
  { code: 'action_beat_binding_component_invalid' }
>;

type ActionBindingRepairPlanTarget =
  | ActionBindingCardinalityRepairTarget
  | ActionBindingComponentRepairTarget;

function actionBindingCardinalityRepairTarget(
  issue: DraftAuthorityReferenceIssue,
): ActionBindingCardinalityRepairTarget | null {
  if (!draftAuthorityReferenceIssueIsValid(issue)) return null;
  if (
    issue.code === 'action_coverage_cardinality_invalid' &&
    issue.locator.kind === 'page_action' &&
    issue.locator.referenceClass === 'action_coverage' &&
    issue.locator.fieldRole ===
      'actionRequirements.actionSemanticCoverage'
  ) {
    return {
      family: 'action_semantic',
      code: issue.code,
      pageNumber: issue.locator.pageNumber,
      actionIndex: issue.locator.actionIndex,
    };
  }
  if (
    issue.code === 'action_beat_binding_cardinality_invalid' &&
    issue.locator.kind === 'page_action' &&
    issue.locator.referenceClass === 'action_identity' &&
    issue.locator.fieldRole === 'actionRequirements.beatId'
  ) {
    return {
      family: 'action_semantic',
      code: issue.code,
      pageNumber: issue.locator.pageNumber,
      actionIndex: issue.locator.actionIndex,
    };
  }
  if (
    issue.code === 'coverage_action_binding_cardinality_invalid' &&
    issue.locator.kind === 'page_coverage' &&
    issue.locator.referenceClass === 'action_coverage' &&
    issue.locator.fieldRole ===
      'actionSemanticCoverage.actionRequirementBinding'
  ) {
    return {
      family: 'action_semantic',
      code: issue.code,
      pageNumber: issue.locator.pageNumber,
      coverageIndex: issue.locator.coverageIndex,
    };
  }
  return null;
}

function actionRequirementDispositionIsExact(value: unknown): boolean {
  const disposition = recordValue(value);
  return (
    disposition?.kind === 'action_requirement' &&
    exactKeys(disposition, ['kind'])
  );
}

function pageContractForRepairPlan(args: {
  draft: Record<string, unknown>;
  pageNumber: number;
}): Record<string, unknown> | null {
  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const matches = pages.filter(
    (page) => page?.pageNumber === args.pageNumber,
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Collapses one fully diagnosed duplicate-beat graph into one atomic target.
 * Partial graphs remain ineligible: every duplicate action and the one
 * over-bound action-requirement coverage record must be present in the issue
 * set before this authority can append the exact coverage deficit.
 */
function actionBindingRepairPlanTargets(args: {
  draft: Record<string, unknown>;
  targets: readonly ActionBindingCardinalityRepairTarget[];
}): ActionBindingRepairPlanTarget[] | null {
  const actionBeatTargets = args.targets.filter(
    (target): target is Extract<
      ActionBindingCardinalityRepairTarget,
      { code: 'action_beat_binding_cardinality_invalid' }
    > => target.code === 'action_beat_binding_cardinality_invalid',
  );
  const grouped = new Map<
    string,
    {
      pageNumber: number;
      originalBeatId: string;
      targets: typeof actionBeatTargets;
    }
  >();
  for (const target of actionBeatTargets) {
    const action = pageActionForTarget({
      draft: args.draft,
      pageNumber: target.pageNumber,
      actionIndex: target.actionIndex,
    });
    if (typeof action?.beatId !== 'string') continue;
    const key = JSON.stringify([target.pageNumber, action.beatId]);
    const group = grouped.get(key) ?? {
      pageNumber: target.pageNumber,
      originalBeatId: action.beatId,
      targets: [],
    };
    group.targets.push(target);
    grouped.set(key, group);
  }

  const consumed = new Set<string>();
  const components: ActionBindingComponentRepairTarget[] = [];
  for (const group of [...grouped.values()].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.originalBeatId.localeCompare(right.originalBeatId),
  )) {
    const page = pageContractForRepairPlan({
      draft: args.draft,
      pageNumber: group.pageNumber,
    });
    if (!page) return null;
    const actions = Array.isArray(page.actionRequirements)
      ? page.actionRequirements.map(recordValue)
      : [];
    if (actions.some((action) => action === null)) return null;
    const memberIndexes = actions
      .map((action, index) =>
        action?.beatId === group.originalBeatId ? index : -1,
      )
      .filter((index) => index >= 0);
    if (memberIndexes.length < 2) continue;
    const targetIndexes = group.targets
      .map((target) => target.actionIndex)
      .sort((left, right) => left - right);
    if (
      JSON.stringify(memberIndexes) !== JSON.stringify(targetIndexes) ||
      !repairBeatIdIsValid(group.originalBeatId, group.pageNumber)
    ) {
      return null;
    }

    const coverage = Array.isArray(page.actionSemanticCoverage)
      ? page.actionSemanticCoverage.map(recordValue)
      : [];
    if (coverage.some((record) => record === null)) return null;
    const matchingCoverageIndexes = coverage
      .map((record, index) =>
        record?.beatId === group.originalBeatId &&
        actionRequirementDispositionIsExact(record.disposition)
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    if (matchingCoverageIndexes.length !== 1) return null;
    const coverageIndex = matchingCoverageIndexes[0]!;
    const coverageTargets = args.targets.filter(
      (target) =>
        target.code ===
          'coverage_action_binding_cardinality_invalid' &&
        target.pageNumber === group.pageNumber &&
        target.coverageIndex === coverageIndex,
    );
    if (coverageTargets.length !== 1) return null;
    if (
      args.targets.some(
        (target) =>
          target.code === 'action_coverage_cardinality_invalid' &&
          target.pageNumber === group.pageNumber &&
          memberIndexes.includes(target.actionIndex),
      )
    ) {
      return null;
    }
    const sourceEvidenceId = coverage[coverageIndex]?.sourceEvidenceId;
    if (
      typeof sourceEvidenceId !== 'string' ||
      !SOURCE_EVIDENCE_ID_PATTERN.test(sourceEvidenceId)
    ) {
      return null;
    }
    const component: ActionBindingComponentRepairTarget = {
      family: 'action_semantic',
      code: 'action_beat_binding_component_invalid',
      pageNumber: group.pageNumber,
      originalBeatId: group.originalBeatId,
      actionIndexes: memberIndexes,
      coverageIndex,
      sourceEvidenceId,
      coverageDeficit: memberIndexes.length - 1,
    };
    components.push(component);
    for (const target of group.targets) {
      consumed.add(pageContractRepairTargetKey(target));
    }
    consumed.add(pageContractRepairTargetKey(coverageTargets[0]!));
  }

  return [
    ...args.targets.filter(
      (target) => !consumed.has(pageContractRepairTargetKey(target)),
    ),
    ...components,
  ].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.code.localeCompare(right.code) ||
      pageContractRepairTargetKey(left).localeCompare(
        pageContractRepairTargetKey(right),
      ),
  );
}

/**
 * Builds the one closed DraftAuthorityReferenceDomainError plan that may use
 * the existing complete-page repair lane. All other authority families remain
 * terminal at this boundary.
 */
export function pageContractAuthorityRepairPlan(args: {
  draft: Record<string, unknown>;
  issues: readonly DraftAuthorityReferenceIssue[];
}): PageContractAuthorityRepairPlan | null {
  if (args.issues.length === 0) return null;
  const targets = args.issues.map(
    actionBindingCardinalityRepairTarget,
  );
  if (targets.some((target) => target === null)) return null;
  const unique = new Map<string, ActionBindingCardinalityRepairTarget>();
  for (const target of targets as ActionBindingCardinalityRepairTarget[]) {
    const itemIndex =
      'actionIndex' in target
        ? target.actionIndex
        : target.coverageIndex;
    const key = JSON.stringify([
      target.code,
      target.pageNumber,
      itemIndex,
    ]);
    if (unique.has(key)) return null;
    unique.set(key, target);
  }
  const normalizedTargets = actionBindingRepairPlanTargets({
    draft: args.draft,
    targets: [...unique.values()],
  });
  if (!normalizedTargets) return null;
  if (
    normalizedTargets.some(
      (target) => {
        if (target.code === 'action_beat_binding_component_invalid') {
          return false;
        }
        if ('actionIndex' in target) {
          return !pageActionForTarget({
            draft: args.draft,
            pageNumber: target.pageNumber,
            actionIndex: target.actionIndex,
          });
        }
        return !pageCoverageForTarget({
          draft: args.draft,
          pageNumber: target.pageNumber,
          coverageIndex: target.coverageIndex,
        });
      },
    )
  ) {
    return null;
  }
  const pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const pageNumbers = [
    ...new Set(normalizedTargets.map((target) => target.pageNumber)),
  ].sort((left, right) => left - right);
  const affectedPages = pageNumbers.map((pageNumber) => {
    const matches = pageContracts.filter(
      (page) => page?.pageNumber === pageNumber,
    );
    if (matches.length !== 1) return null;
    const pageTargets = normalizedTargets.filter(
      (target) => target.pageNumber === pageNumber,
    );
    return {
      pageNumber,
      pageContract: structuredClone(matches[0]!),
      repairTargets: pageTargets,
      validationHints: pageTargets.map((target) => {
        if (target.code === 'action_coverage_cardinality_invalid') {
          return `action_coverage_cardinality_invalid: actionRequirements[${target.actionIndex}] must bind exactly one same-page actionSemanticCoverage record with disposition.kind action_requirement`;
        }
        if (target.code === 'action_beat_binding_cardinality_invalid') {
          return `action_beat_binding_cardinality_invalid: actionRequirements[${target.actionIndex}].beatId must be unique on the page and bind exactly one same-page actionSemanticCoverage record with disposition.kind action_requirement`;
        }
        if (target.code === 'action_beat_binding_component_invalid') {
          return `action_beat_binding_component_invalid: atomically assign unique same-page beatIds to actionRequirements[${target.actionIndexes.join(',')}], bind actionSemanticCoverage[${target.coverageIndex}] to the first action, and append exactly ${target.coverageDeficit} action_requirement coverage records in remaining action order using sourceEvidenceId ${target.sourceEvidenceId}`;
        }
        return `coverage_action_binding_cardinality_invalid: actionSemanticCoverage[${target.coverageIndex}] must bind exactly one same-page actionRequirement through one unique beatId`;
      }),
      permittedPointerValues: [],
    } satisfies PageContractRepairAffectedPage;
  });
  if (
    affectedPages.some(
      (page): page is null => page === null,
    )
  ) {
    return null;
  }
  const validationMessages = (
    affectedPages as PageContractRepairAffectedPage[]
  ).flatMap((page) => page.validationHints);
  const diagnosticIssues = [...unique.values()].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.code.localeCompare(right.code) ||
      pageContractRepairTargetKey(left).localeCompare(
        pageContractRepairTargetKey(right),
      ),
  ).map(
    (target): DraftValidationIssue => ({
      family: 'action_semantic',
      code: 'action_binding_cardinality_invalid',
      locator: {
        kind: 'page_item',
        collectionRole:
          'actionIndex' in target
            ? 'page_actions'
            : 'page_action_semantic_coverage',
        fieldRole: 'cardinality',
        pageNumber: target.pageNumber,
        itemIndex:
          'actionIndex' in target
            ? target.actionIndex
            : target.coverageIndex,
      },
    }),
  );
  return {
    affectedPages:
      affectedPages as PageContractRepairAffectedPage[],
    diagnosticIssues,
    validationMessages,
  };
}

function pageContractSpatialRepairDiagnostic(
  target: PageSpatialReferenceRepairTargetBase,
): DraftValidationIssue {
  return {
    family: 'draft_contract',
    code: 'out_of_scope_reference',
    locator: {
      kind: 'page_item',
      collectionRole: 'page_actions',
      fieldRole: 'reference',
      pageNumber: target.pageNumber,
      itemIndex: target.actionIndex,
    },
  };
}

function pageContractSpatialRepairHint(
  target: PageSpatialReferenceRepairTargetBase,
): string {
  return (
    `page_spatial_reference_outside_zone: page ${target.pageNumber} ` +
    `actionRequirements[${target.actionIndex}].${target.fieldRole} must copy one exact spatial id ` +
    "from that target's permittedSpatialReferences without changing page zone authority"
  );
}

/**
 * Builds one compact complete-page repair authority only for the exact closed
 * union observed after a prior repair: action/coverage cardinality plus
 * page-action spatial references outside their current zone. Keeping both
 * families in one page set prevents a second whole-draft rewrite while every
 * third family, malformed locator, duplicate target, stale target, or missing
 * zone authority remains fail-closed.
 */
export function pageContractCompoundAuthorityRepairPlan(args: {
  draft: Record<string, unknown>;
  issues: readonly DraftAuthorityReferenceIssue[];
  pageSpatialRepairAuthority: readonly PageSpatialRepairAuthority[];
}): PageContractAuthorityRepairPlan | null {
  if (args.issues.length === 0) return null;
  const actionIssues: DraftAuthorityReferenceIssue[] = [];
  const spatialIssues: DraftAuthorityReferenceIssue[] = [];
  for (const issue of args.issues) {
    const actionTarget = actionBindingCardinalityRepairTarget(issue);
    const spatialTarget = pageSpatialRepairTarget(issue);
    if ((actionTarget === null) === (spatialTarget === null)) {
      return null;
    }
    if (actionTarget) actionIssues.push(issue);
    else spatialIssues.push(issue);
  }
  if (actionIssues.length === 0 || spatialIssues.length === 0) {
    return null;
  }

  const actionPlan = pageContractAuthorityRepairPlan({
    draft: args.draft,
    issues: actionIssues,
  });
  const spatialTargets = pageSpatialReferenceRepairTargetBases({
    draft: args.draft,
    issues: spatialIssues,
    authority: args.pageSpatialRepairAuthority,
  });
  if (!actionPlan || !spatialTargets) return null;

  const actionPages = new Map(
    actionPlan.affectedPages.map((page) => [page.pageNumber, page]),
  );
  const pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  if (pageContracts.some((page) => page === null)) return null;
  const pageNumbers = [
    ...new Set([
      ...actionPlan.affectedPages.map((page) => page.pageNumber),
      ...spatialTargets.map((target) => target.pageNumber),
    ]),
  ].sort((left, right) => left - right);

  const affectedPages = pageNumbers.map(
    (pageNumber): PageContractRepairAffectedPage | null => {
      const matches = pageContracts.filter(
        (page) => page?.pageNumber === pageNumber,
      );
      if (matches.length !== 1 || !matches[0]) return null;
      const spatialPageTargets = spatialTargets
        .filter((target) => target.pageNumber === pageNumber)
        .map(
          (target): PageContractSpatialRepairTarget => ({
            family: 'draft_contract',
            code: 'page_spatial_reference_outside_zone',
            pageNumber: target.pageNumber,
            collectionRole: 'page_actions',
            itemIndex: target.actionIndex,
            fieldRole: target.fieldRole,
            permittedSpatialReferences: structuredClone(
              target.permittedSpatialReferences,
            ),
          }),
        );
      const pageContract = structuredClone(matches[0]);
      const pageActions = Array.isArray(pageContract.actionRequirements)
        ? pageContract.actionRequirements
        : [];
      for (const target of spatialPageTargets) {
        const action = recordValue(pageActions[target.itemIndex]);
        if (
          !action ||
          !replaceSpatialReferenceForRole({
            action,
            fieldRole: target.fieldRole,
            value: {
              kind: 'spatial',
              id: '__repair_target__',
            },
          })
        ) {
          return null;
        }
      }
      const actionPage = actionPages.get(pageNumber);
      const repairTargets = [
        ...(actionPage?.repairTargets ?? []),
        ...spatialPageTargets,
      ];
      const validationHints = [
        ...(actionPage?.validationHints ?? []),
        ...spatialTargets
          .filter((target) => target.pageNumber === pageNumber)
          .map(pageContractSpatialRepairHint),
      ].sort(lexicalCompare);
      return repairTargets.length > 0 && validationHints.length > 0
        ? {
            pageNumber,
            pageContract,
            repairTargets,
            validationHints,
            permittedPointerValues: [],
          }
        : null;
    },
  );
  if (
    affectedPages.some(
      (page): page is null => page === null,
    )
  ) {
    return null;
  }

  return {
    affectedPages:
      affectedPages as PageContractRepairAffectedPage[],
    diagnosticIssues: [
      ...actionPlan.diagnosticIssues,
      ...spatialTargets.map(pageContractSpatialRepairDiagnostic),
    ],
    validationMessages: (
      affectedPages as PageContractRepairAffectedPage[]
    ).flatMap((page) => page.validationHints),
  };
}

function assertPageContractRepairJsonValue(
  value: unknown,
  location: string,
  ancestors: Set<object>,
): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('page_contract_repair_input_non_json');
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new Error('page_contract_repair_input_non_json');
  }
  if (ancestors.has(value)) {
    throw new Error('page_contract_repair_input_non_json');
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertPageContractRepairJsonValue(
        entry,
        `${location}[${index}]`,
        ancestors,
      ),
    );
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('page_contract_repair_input_non_json');
    }
    for (const [key, entry] of Object.entries(value)) {
      assertPageContractRepairJsonValue(
        entry,
        `${location}.${key}`,
        ancestors,
      );
    }
  }
  ancestors.delete(value);
}

function pageContractRepairStringCounts(
  value: unknown,
  counts: Map<string, number>,
): void {
  if (typeof value === 'string') {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      pageContractRepairStringCounts(entry, counts);
    }
    return;
  }
  const record = recordValue(value);
  if (record) {
    for (const entry of Object.values(record)) {
      pageContractRepairStringCounts(entry, counts);
    }
  }
}

function pageContractRepairObjectShapes(
  value: unknown,
  shapes: Map<string, string[]>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      pageContractRepairObjectShapes(entry, shapes);
    }
    return;
  }
  const record = recordValue(value);
  if (!record) return;
  const keys = Object.keys(record).sort();
  shapes.set(JSON.stringify(keys), keys);
  for (const key of keys) {
    pageContractRepairObjectShapes(record[key], shapes);
  }
}

function repeatedStringDictionary(value: unknown): string[] {
  const counts = new Map<string, number>();
  pageContractRepairStringCounts(value, counts);
  const candidates = [...counts.entries()]
    .filter(([text, count]) => count > 1 && Buffer.byteLength(text, 'utf8') >= 8)
    .map(([text]) => text)
    .sort();
  return candidates.filter((text, index) => {
    const count = counts.get(text)!;
    const rawBytes = Buffer.byteLength(JSON.stringify(text), 'utf8');
    const referenceBytes = Buffer.byteLength(
      JSON.stringify(['s', index]),
      'utf8',
    );
    return (
      count * rawBytes -
        count * referenceBytes -
        rawBytes -
        1 >
      0
    );
  });
}

function pageContractRepairStringFragments(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? [value];
}

function repeatedFragmentCandidates(
  value: unknown,
  exactStrings: ReadonlySet<string>,
): string[] {
  const counts = new Map<string, number>();
  const candidateLengths = [8, 12, 16, 24, 32] as const;
  const visit = (entry: unknown): void => {
    if (typeof entry === 'string') {
      if (exactStrings.has(entry)) return;
      for (const fragment of pageContractRepairStringFragments(entry)) {
        if (Buffer.byteLength(fragment, 'utf8') < 6) continue;
        counts.set(fragment, (counts.get(fragment) ?? 0) + 1);
      }
      const codePoints = Array.from(entry);
      for (const length of candidateLengths) {
        if (codePoints.length < length) continue;
        for (let index = 0; index + length <= codePoints.length; index += 1) {
          const fragment = codePoints.slice(index, index + length).join('');
          counts.set(fragment, (counts.get(fragment) ?? 0) + 1);
        }
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    const record = recordValue(entry);
    if (record) Object.values(record).forEach(visit);
  };
  visit(value);
  const candidates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([fragment, count]) => {
      const rawBytes = Buffer.byteLength(fragment, 'utf8');
      const dictionaryBytes =
        Buffer.byteLength(JSON.stringify(fragment), 'utf8') + 1;
      const score = count * (rawBytes - 4) - dictionaryBytes;
      return { fragment, score };
    })
    .filter((entry) => entry.score > 12)
    .sort(
      (left, right) =>
        right.score - left.score ||
        lexicalCompare(left.fragment, right.fragment),
    )
    .slice(0, 384)
    .map((entry) => entry.fragment)
    .sort();
  return candidates;
}

function encodePageContractRepairString(
  value: string,
  exactStringIndexes: ReadonlyMap<string, number>,
  fragmentIndexes: ReadonlyMap<string, number>,
  usedFragments?: Set<number>,
): PageContractRepairEncodedValue {
  const exactIndex = exactStringIndexes.get(value);
  if (exactIndex !== undefined) return ['s', exactIndex];
  const parts: Array<string | number> = [];
  let usedAnyFragment = false;
  const fragmentsByPriority = [...fragmentIndexes.entries()].sort(
    ([left], [right]) =>
      Array.from(right).length - Array.from(left).length ||
      lexicalCompare(left, right),
  );
  for (let offset = 0; offset < value.length; ) {
    const match = fragmentsByPriority.find(([fragment]) =>
      value.startsWith(fragment, offset),
    );
    if (!match) {
      const codePoint = value.codePointAt(offset);
      if (codePoint === undefined) break;
      const fragment = String.fromCodePoint(codePoint);
      const last = parts[parts.length - 1];
      if (typeof last === 'string') {
        parts[parts.length - 1] = last + fragment;
      } else {
        parts.push(fragment);
      }
      offset += fragment.length;
      continue;
    }
    const [fragment, fragmentIndex] = match;
    parts.push(fragmentIndex);
    usedAnyFragment = true;
    offset += fragment.length;
  }
  if (!usedAnyFragment) return value;
  const encoded: PageContractRepairEncodedValue = ['t', ...parts];
  if (
    Buffer.byteLength(JSON.stringify(encoded), 'utf8') >=
    Buffer.byteLength(JSON.stringify(value), 'utf8')
  ) {
    return value;
  }
  for (const part of parts) {
    if (typeof part === 'number') usedFragments?.add(part);
  }
  return encoded;
}

function usedFragmentDictionary(
  value: unknown,
  exactStringIndexes: ReadonlyMap<string, number>,
  candidates: readonly string[],
): string[] {
  let fragments = [...candidates];
  for (;;) {
    const indexes = new Map(
      fragments.map((fragment, index) => [fragment, index]),
    );
    const used = new Set<number>();
    const visit = (entry: unknown): void => {
      if (typeof entry === 'string') {
        encodePageContractRepairString(
          entry,
          exactStringIndexes,
          indexes,
          used,
        );
        return;
      }
      if (Array.isArray(entry)) {
        entry.forEach(visit);
        return;
      }
      const record = recordValue(entry);
      if (record) Object.values(record).forEach(visit);
    };
    visit(value);
    const next = fragments.filter((_fragment, index) => used.has(index));
    if (next.length === fragments.length) return fragments;
    fragments = next;
  }
}

function repeatedCompositeValues(value: unknown): unknown[] {
  const counts = new Map<string, { count: number; value: unknown }>();
  const visit = (entry: unknown, root: boolean): void => {
    if (Array.isArray(entry)) {
      if (!root) {
        const key = JSON.stringify(entry);
        const current = counts.get(key);
        counts.set(key, {
          count: (current?.count ?? 0) + 1,
          value: entry,
        });
      }
      entry.forEach((child) => visit(child, false));
      return;
    }
    const record = recordValue(entry);
    if (!record) return;
    if (!root) {
      const key = JSON.stringify(record);
      const current = counts.get(key);
      counts.set(key, {
        count: (current?.count ?? 0) + 1,
        value: record,
      });
    }
    Object.values(record).forEach((child) => visit(child, false));
  };
  visit(value, true);
  return [...counts.entries()]
    .filter(([raw, entry]) => {
      if (entry.count < 2 || Buffer.byteLength(raw, 'utf8') < 24) {
        return false;
      }
      const referenceBytes = Buffer.byteLength(
        JSON.stringify(['v', 999]),
        'utf8',
      );
      return (
        entry.count * Buffer.byteLength(raw, 'utf8') -
          Buffer.byteLength(raw, 'utf8') -
          entry.count * referenceBytes >
        16
      );
    })
    .sort(([left], [right]) => lexicalCompare(left, right))
    .map(([, entry]) => entry.value);
}

/**
 * Canonically compacts a JSON-domain authority without omitting or summarizing
 * any value. Object keys live in deterministic shape tables, arrays are tagged,
 * repeated strings and repeated string fragments use byte-beneficial refs, and
 * repeated composite values may be referenced from a closed value dictionary.
 */
export function encodePageContractRepairInput(
  value: unknown,
): PageContractRepairEncodedInput {
  assertPageContractRepairJsonValue(value, '$', new Set());
  const canonical = canonicalize(value);
  const stringDictionary = repeatedStringDictionary(canonical);
  const stringIndexes = new Map(
    stringDictionary.map((entry, index) => [entry, index]),
  );
  const fragmentDictionary = usedFragmentDictionary(
    canonical,
    stringIndexes,
    repeatedFragmentCandidates(canonical, new Set(stringDictionary)),
  );
  const fragmentIndexes = new Map(
    fragmentDictionary.map((entry, index) => [entry, index]),
  );
  const shapeMap = new Map<string, string[]>();
  pageContractRepairObjectShapes(canonical, shapeMap);
  const objectShapes = [...shapeMap.values()].sort((left, right) => {
    const leftKey = JSON.stringify(left);
    const rightKey = JSON.stringify(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const shapeIndexes = new Map(
    objectShapes.map((keys, index) => [JSON.stringify(keys), index]),
  );

  const compositeCandidates = repeatedCompositeValues(canonical);
  let valueDictionaryValues = [...compositeCandidates];

  const encode = (
    entry: unknown,
    valueIndexes: ReadonlyMap<string, number>,
    allowValueReference: boolean,
    usedValues?: Set<number>,
  ): PageContractRepairEncodedValue => {
    if (typeof entry === 'string') {
      return encodePageContractRepairString(
        entry,
        stringIndexes,
        fragmentIndexes,
      );
    }
    if (
      entry === null ||
      typeof entry === 'boolean' ||
      typeof entry === 'number'
    ) {
      return entry;
    }
    if (Array.isArray(entry)) {
      const valueIndex = allowValueReference
        ? valueIndexes.get(JSON.stringify(entry))
        : undefined;
      if (valueIndex !== undefined) {
        usedValues?.add(valueIndex);
        return ['v', valueIndex];
      }
      return [
        'a',
        ...entry.map((child) =>
          encode(child, valueIndexes, allowValueReference, usedValues),
        ),
      ];
    }
    const record = recordValue(entry);
    if (!record) {
      throw new Error('page_contract_repair_input_non_json');
    }
    const valueIndex = allowValueReference
      ? valueIndexes.get(JSON.stringify(record))
      : undefined;
    if (valueIndex !== undefined) {
      usedValues?.add(valueIndex);
      return ['v', valueIndex];
    }
    const keys = Object.keys(record).sort();
    const shapeIndex = shapeIndexes.get(JSON.stringify(keys));
    if (shapeIndex === undefined) {
      throw new Error('page_contract_repair_input_encoding_invalid');
    }
    return [
      'o',
      shapeIndex,
      ...keys.map((key) =>
        encode(
          record[key],
          valueIndexes,
          allowValueReference,
          usedValues,
        ),
      ),
    ];
  };

  for (;;) {
    const indexes = new Map(
      valueDictionaryValues.map((entry, index) => [
        JSON.stringify(entry),
        index,
      ]),
    );
    const used = new Set<number>();
    encode(canonical, indexes, true, used);
    const next = valueDictionaryValues.filter((_entry, index) =>
      used.has(index),
    );
    if (next.length === valueDictionaryValues.length) break;
    valueDictionaryValues = next;
  }

  const valueIndexes = new Map(
    valueDictionaryValues.map((entry, index) => [
      JSON.stringify(entry),
      index,
    ]),
  );
  const valueDictionary = valueDictionaryValues.map((entry) =>
    encode(entry, valueIndexes, false),
  );
  const rootTuple = encode(canonical, valueIndexes, true);

  const withoutValueDictionary: PageContractRepairEncodedInput = {
    encodingVersion: PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION,
    stringDictionary,
    fragmentDictionary,
    objectShapes,
    valueDictionary: [],
    rootTuple: encode(canonical, new Map(), false),
  };
  const withValueDictionary: PageContractRepairEncodedInput = {
    encodingVersion: PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION,
    stringDictionary,
    fragmentDictionary,
    objectShapes,
    valueDictionary,
    rootTuple,
  };

  return Buffer.byteLength(
    JSON.stringify(canonicalize(withValueDictionary)),
    'utf8',
  ) <
    Buffer.byteLength(
      JSON.stringify(canonicalize(withoutValueDictionary)),
      'utf8',
    )
    ? withValueDictionary
    : withoutValueDictionary;
}

/** Strict local decoder used to prove that the provider-facing compact input is lossless. */
export function decodePageContractRepairInput(
  value: unknown,
): unknown {
  const envelope = recordValue(value);
  if (
    !envelope ||
    !exactKeys(envelope, [
      'encodingVersion',
      'stringDictionary',
      'fragmentDictionary',
      'objectShapes',
      'valueDictionary',
      'rootTuple',
    ]) ||
    envelope.encodingVersion !==
      PAGE_CONTRACT_REPAIR_INPUT_ENCODING_VERSION ||
    !Array.isArray(envelope.stringDictionary) ||
    !envelope.stringDictionary.every(
      (entry) => typeof entry === 'string',
    ) ||
    new Set(envelope.stringDictionary).size !==
      envelope.stringDictionary.length ||
    !Array.isArray(envelope.fragmentDictionary) ||
    !envelope.fragmentDictionary.every(
      (entry) => typeof entry === 'string' && entry.length > 0,
    ) ||
    new Set(envelope.fragmentDictionary).size !==
      envelope.fragmentDictionary.length ||
    !Array.isArray(envelope.objectShapes) ||
    !Array.isArray(envelope.valueDictionary)
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  const dictionary = envelope.stringDictionary as string[];
  if (
    JSON.stringify([...dictionary].sort()) !==
    JSON.stringify(dictionary)
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  const fragments = envelope.fragmentDictionary as string[];
  if (
    JSON.stringify([...fragments].sort()) !==
    JSON.stringify(fragments)
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  const shapes = envelope.objectShapes.map((entry) => {
    if (
      !Array.isArray(entry) ||
      !entry.every((key) => typeof key === 'string') ||
      new Set(entry).size !== entry.length ||
      JSON.stringify([...entry].sort()) !== JSON.stringify(entry)
    ) {
      throw new Error('page_contract_repair_input_encoding_invalid');
    }
    return entry as string[];
  });
  if (
    new Set(shapes.map((shape) => JSON.stringify(shape))).size !==
      shapes.length ||
    JSON.stringify(
      shapes
        .map((shape) => JSON.stringify(shape))
        .sort(),
    ) !==
      JSON.stringify(shapes.map((shape) => JSON.stringify(shape)))
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }

  const usedFragments = new Set<number>();
  const usedValues = new Set<number>();
  let decodedValueDictionary: unknown[] = [];
  const decode = (
    entry: unknown,
    allowValueReference: boolean,
  ): unknown => {
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'boolean'
    ) {
      return entry;
    }
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      return entry;
    }
    if (!Array.isArray(entry) || entry.length === 0) {
      throw new Error('page_contract_repair_input_encoding_invalid');
    }
    if (entry[0] === 's') {
      if (
        entry.length !== 2 ||
        !Number.isSafeInteger(entry[1]) ||
        (entry[1] as number) < 0 ||
        (entry[1] as number) >= dictionary.length
      ) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      return dictionary[entry[1] as number];
    }
    if (entry[0] === 't') {
      if (entry.length < 2) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      let output = '';
      for (const part of entry.slice(1)) {
        if (typeof part === 'string') {
          output += part;
          continue;
        }
        if (
          !Number.isSafeInteger(part) ||
          (part as number) < 0 ||
          (part as number) >= fragments.length
        ) {
          throw new Error('page_contract_repair_input_encoding_invalid');
        }
        usedFragments.add(part as number);
        output += fragments[part as number];
      }
      return output;
    }
    if (entry[0] === 'v') {
      if (
        !allowValueReference ||
        entry.length !== 2 ||
        !Number.isSafeInteger(entry[1]) ||
        (entry[1] as number) < 0 ||
        (entry[1] as number) >= decodedValueDictionary.length
      ) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      usedValues.add(entry[1] as number);
      return structuredClone(
        decodedValueDictionary[entry[1] as number],
      );
    }
    if (entry[0] === 'a') {
      return entry
        .slice(1)
        .map((child) => decode(child, allowValueReference));
    }
    if (entry[0] === 'o') {
      if (
        entry.length < 2 ||
        !Number.isSafeInteger(entry[1]) ||
        (entry[1] as number) < 0 ||
        (entry[1] as number) >= shapes.length
      ) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      const keys = shapes[entry[1] as number]!;
      if (entry.length !== keys.length + 2) {
        throw new Error('page_contract_repair_input_encoding_invalid');
      }
      return Object.fromEntries(
        keys.map((key, index) => [
          key,
          decode(entry[index + 2], allowValueReference),
        ]),
      );
    }
    throw new Error('page_contract_repair_input_encoding_invalid');
  };
  decodedValueDictionary = envelope.valueDictionary.map((entry) =>
    decode(entry, false),
  );
  const decodedValueKeys = decodedValueDictionary.map((entry) =>
    JSON.stringify(canonicalize(entry)),
  );
  if (
    new Set(decodedValueKeys).size !== decodedValueKeys.length ||
    JSON.stringify([...decodedValueKeys].sort()) !==
      JSON.stringify(decodedValueKeys)
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  const decoded = decode(envelope.rootTuple, true);
  if (
    usedFragments.size !== fragments.length ||
    usedValues.size !== decodedValueDictionary.length
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  return decoded;
}

export function decodePageContractRepairUserPrompt(
  raw: string,
): {
  affectedPages: PageContractRepairAffectedPage[];
  previousRepairFailure: PageContractRepairPreviousFailure | null;
} {
  let encoded: unknown;
  try {
    encoded = JSON.parse(raw);
  } catch {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  const decoded = decodePageContractRepairInput(encoded);
  const root = recordValue(decoded);
  if (
    !root ||
    !exactKeys(root, ['affectedPages', 'previousRepairFailure']) ||
    !Array.isArray(root.affectedPages) ||
    (root.previousRepairFailure !== null &&
      !PAGE_CONTRACT_REPAIR_PREVIOUS_FAILURE_VALUES.includes(
        root.previousRepairFailure as PageContractRepairPreviousFailure,
      ))
  ) {
    throw new Error('page_contract_repair_input_encoding_invalid');
  }
  return root as unknown as {
    affectedPages: PageContractRepairAffectedPage[];
    previousRepairFailure: PageContractRepairPreviousFailure | null;
  };
}

export function buildPageContractRepairSystemPrompt(): string {
  return [
    'You repair ONLY the complete page contracts identified by the input.',
    'Decode the compact input exactly: ["s",i] references stringDictionary[i]; ["t",...parts] concatenates raw string parts and numeric fragmentDictionary indexes; ["v",i] deep-copies valueDictionary[i]; ["a",...items] is an array; and ["o",i,...values] is an object whose ordered keys are objectShapes[i].',
    'The decoded root has affectedPages; the compact representation omits no authority value.',
    'Return exactly one complete page contract for every affected pageNumber and no other page.',
    'Keep pageNumber, locationId, and zoneId unchanged; never invent a new authority ID.',
    'Do not rewrite locations, zones, set boards, cast, recurring props, cover, or global fields.',
    'Resolve only the closed typed repairTargets and the exact repository-validator validationHints on that page while preserving unaffected page semantics.',
    'For action_coverage_cardinality_invalid, align the targeted action beatId with exactly one same-page actionSemanticCoverage record whose disposition.kind is action_requirement.',
    'For action_beat_binding_cardinality_invalid, make the targeted action beatId unique on its page and bind it to exactly one same-page actionSemanticCoverage action_requirement record.',
    'For coverage_action_binding_cardinality_invalid, bind the targeted actionSemanticCoverage record to exactly one same-page actionRequirement through one unique beatId.',
    'For page_spatial_reference_outside_zone, change only the exact targeted spatial field and copy one exact id from that target permittedSpatialReferences; keep every page and zone identity unchanged.',
    'For closed_catalog_capability_gap, replace only the exact targeted unsupported disposition with one presentation_requirement: choose a closed presentationClass and copy one exact contractPointer/contractValue pair from that target permittedPointerValues.',
    'Never use closed_catalog_capability_gap repair to disguise a physical action, spatial action, or unsupported predicate.',
    'For represented_elsewhere, contractPointer and contractValue must be copied as one exact pair from permittedPointerValues on that page.',
    'Never rewrite a pointer silently or infer an authoring record from an item/list position.',
    'When previousRepairFailure is target_scope_invalid, the preceding page repair changed more action/coverage bindings than its target allowed. Change only the targeted action beatId and, when required by action_coverage_cardinality_invalid, at most one existing same-page coverage beatId/disposition binding. Preserve every other action and coverage binding exactly; never add or remove a record.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildPageContractRepairUserPrompt(args: {
  affectedPages: readonly PageContractRepairAffectedPage[];
  previousRepairFailure?: PageContractRepairPreviousFailure | null;
}): string {
  const payload = {
    affectedPages: [...args.affectedPages]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((value) => ({
        pageNumber: value.pageNumber,
        pageContract: value.pageContract,
        repairTargets: value.repairTargets,
        validationHints: value.validationHints,
        permittedPointerValues: value.permittedPointerValues,
      })),
    previousRepairFailure: args.previousRepairFailure ?? null,
  };
  const encoded = encodePageContractRepairInput(payload);
  const decoded = decodePageContractRepairInput(encoded);
  if (
    JSON.stringify(canonicalize(payload)) !==
    JSON.stringify(canonicalize(decoded))
  ) {
    throw new Error('page_contract_repair_input_roundtrip_mismatch');
  }
  return JSON.stringify(canonicalize(encoded));
}

export function parsePageContractRepairs(
  raw: string,
): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('page_contract_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, ['pageContracts']) ||
    !Array.isArray(root.pageContracts) ||
    root.pageContracts.length === 0
  ) {
    throw new Error('page_contract_repair_response_invalid_shape');
  }
  return root.pageContracts.map((value) => {
    const page = recordValue(value);
    if (
      !page ||
      !exactKeys(page, PAGE_CONTRACT_KEYS) ||
      !Number.isSafeInteger(page.pageNumber) ||
      (page.pageNumber as number) < 1
    ) {
      throw new Error('page_contract_repair_page_invalid');
    }
    return page;
  });
}

function pageActionAt(
  page: Record<string, unknown>,
  actionIndex: number,
): Record<string, unknown> | null {
  const actions = Array.isArray(page.actionRequirements)
    ? page.actionRequirements
    : [];
  return actionIndex >= 0 && actionIndex < actions.length
    ? recordValue(actions[actionIndex])
    : null;
}

function pageCoverageAt(
  page: Record<string, unknown>,
  coverageIndex: number,
): Record<string, unknown> | null {
  const coverage = Array.isArray(page.actionSemanticCoverage)
    ? page.actionSemanticCoverage
    : [];
  return coverageIndex >= 0 && coverageIndex < coverage.length
    ? recordValue(coverage[coverageIndex])
    : null;
}

function repairBeatIdIsValid(
  value: unknown,
  pageNumber: number,
): value is string {
  return (
    typeof value === 'string' &&
    new RegExp(`^beat:p${pageNumber}:[a-z0-9_]+$`).test(value)
  );
}

function canonicalValuesEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(canonicalize(left)) ===
    JSON.stringify(canonicalize(right))
  );
}

function pageContractSchemaProjection(
  page: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    PAGE_CONTRACT_KEYS.map((key) => [key, page[key]]),
  );
}

function actionWithoutBeatId(
  action: Record<string, unknown>,
): Record<string, unknown> {
  const { beatId: _beatId, ...body } = action;
  return body;
}

function applyActionBindingComponentTarget(args: {
  affectedPage: PageContractRepairAffectedPage;
  target: ActionBindingComponentRepairTarget;
  originalPage: Record<string, unknown>;
  replacementPage: Record<string, unknown>;
  resultPage: Record<string, unknown>;
}): void {
  const { target } = args;
  const componentTargets = args.affectedPage.repairTargets.filter(
    (candidate): candidate is ActionBindingComponentRepairTarget =>
      candidate.code === 'action_beat_binding_component_invalid',
  );
  const componentIndex = componentTargets.findIndex(
    (candidate) =>
      pageContractRepairTargetKey(candidate) ===
      pageContractRepairTargetKey(target),
  );
  const originalActions = Array.isArray(
    args.originalPage.actionRequirements,
  )
    ? args.originalPage.actionRequirements.map(recordValue)
    : [];
  const replacementActions = Array.isArray(
    args.replacementPage.actionRequirements,
  )
    ? args.replacementPage.actionRequirements.map(recordValue)
    : [];
  const resultActions = Array.isArray(args.resultPage.actionRequirements)
    ? args.resultPage.actionRequirements.map(recordValue)
    : [];
  const originalCoverage = Array.isArray(
    args.originalPage.actionSemanticCoverage,
  )
    ? args.originalPage.actionSemanticCoverage.map(recordValue)
    : [];
  const replacementCoverage = Array.isArray(
    args.replacementPage.actionSemanticCoverage,
  )
    ? args.replacementPage.actionSemanticCoverage.map(recordValue)
    : [];
  const resultCoverage = Array.isArray(
    args.resultPage.actionSemanticCoverage,
  )
    ? args.resultPage.actionSemanticCoverage
    : [];
  const totalDeficit = componentTargets.reduce(
    (sum, candidate) => sum + candidate.coverageDeficit,
    0,
  );
  const precedingDeficit = componentTargets
    .slice(0, componentIndex)
    .reduce(
      (sum, candidate) => sum + candidate.coverageDeficit,
      0,
    );
  if (
    componentIndex < 0 ||
    originalActions.length !== replacementActions.length ||
    originalActions.length !== resultActions.length ||
    originalActions.some((action) => action === null) ||
    replacementActions.some((action) => action === null) ||
    resultActions.some((action) => action === null) ||
    originalCoverage.some((record) => record === null) ||
    replacementCoverage.some((record) => record === null) ||
    replacementCoverage.length !==
      originalCoverage.length + totalDeficit ||
    resultCoverage.length !==
      originalCoverage.length + precedingDeficit
  ) {
    throw new Error(
      'page_contract_repair_action_binding_component_scope_invalid',
    );
  }

  const originalMemberIndexes = originalActions
    .map((action, index) =>
      action?.beatId === target.originalBeatId ? index : -1,
    )
    .filter((index) => index >= 0);
  if (
    JSON.stringify(originalMemberIndexes) !==
      JSON.stringify(target.actionIndexes) ||
    originalCoverage.filter(
      (record) =>
        record?.beatId === target.originalBeatId &&
        actionRequirementDispositionIsExact(record.disposition),
    ).length !== 1
  ) {
    throw new Error(
      'page_contract_repair_action_binding_component_stale',
    );
  }
  const originalComponentCoverage =
    originalCoverage[target.coverageIndex];
  const replacementComponentCoverage =
    replacementCoverage[target.coverageIndex];
  const resultComponentCoverage = recordValue(
    resultCoverage[target.coverageIndex],
  );
  if (
    !originalComponentCoverage ||
    !replacementComponentCoverage ||
    !resultComponentCoverage ||
    originalComponentCoverage.beatId !== target.originalBeatId ||
    originalComponentCoverage.sourceEvidenceId !==
      target.sourceEvidenceId ||
    !SOURCE_EVIDENCE_ID_PATTERN.test(target.sourceEvidenceId) ||
    !actionRequirementDispositionIsExact(
      originalComponentCoverage.disposition,
    ) ||
    replacementComponentCoverage.sourceEvidenceId !==
      target.sourceEvidenceId ||
    !actionRequirementDispositionIsExact(
      replacementComponentCoverage.disposition,
    )
  ) {
    throw new Error(
      'page_contract_repair_action_binding_component_stale',
    );
  }

  const replacementBeatIds = replacementActions.map(
    (action) => action!.beatId,
  );
  if (
    replacementBeatIds.some(
      (beatId) => !repairBeatIdIsValid(beatId, target.pageNumber),
    ) ||
    new Set(replacementBeatIds).size !== replacementBeatIds.length
  ) {
    throw new Error(
      'page_contract_repair_action_binding_component_beat_id_invalid',
    );
  }
  for (const actionIndex of target.actionIndexes) {
    const originalAction = originalActions[actionIndex];
    const replacementAction = replacementActions[actionIndex];
    const resultAction = resultActions[actionIndex];
    if (
      !originalAction ||
      !replacementAction ||
      !resultAction ||
      !canonicalValuesEqual(
        actionWithoutBeatId(originalAction),
        actionWithoutBeatId(replacementAction),
      )
    ) {
      throw new Error(
        'page_contract_repair_action_binding_component_scope_invalid',
      );
    }
    resultAction.beatId = replacementAction.beatId;
  }
  const memberBeatIds = target.actionIndexes.map(
    (actionIndex) => replacementActions[actionIndex]!.beatId as string,
  );
  if (replacementComponentCoverage.beatId !== memberBeatIds[0]) {
    throw new Error(
      'page_contract_repair_action_binding_component_scope_invalid',
    );
  }
  resultComponentCoverage.beatId = memberBeatIds[0];
  const appendedStart = originalCoverage.length + precedingDeficit;
  const appendedRecords = memberBeatIds.slice(1).map((beatId) => ({
    beatId,
    sourceEvidenceId: target.sourceEvidenceId,
    disposition: { kind: 'action_requirement' },
  }));
  for (let index = 0; index < appendedRecords.length; index += 1) {
    if (
      !canonicalValuesEqual(
        replacementCoverage[appendedStart + index],
        appendedRecords[index],
      )
    ) {
      throw new Error(
        'page_contract_repair_action_binding_component_scope_invalid',
      );
    }
  }
  resultCoverage.push(...structuredClone(appendedRecords));

  for (const beatId of memberBeatIds) {
    const bindingCount = replacementCoverage.filter(
      (record) => record?.beatId === beatId,
    ).length;
    if (bindingCount !== 1) {
      throw new Error(
        'page_contract_repair_action_binding_component_scope_invalid',
      );
    }
  }
}

function pointerValueIsPermitted(
  permitted: readonly RepresentedElsewherePointerValue[],
  pointer: unknown,
  value: unknown,
): pointer is string {
  return (
    typeof pointer === 'string' &&
    typeof value === 'string' &&
    permitted.some(
      (candidate) =>
        candidate.contractPointer === pointer &&
        candidate.contractValue === value,
    )
  );
}

function assertPageSpatialRepairTarget(
  target: PageContractSpatialRepairTarget,
): Set<string> {
  if (
    target.collectionRole !== 'page_actions' ||
    target.permittedSpatialReferences.length === 0
  ) {
    throw new Error('page_contract_repair_spatial_target_invalid');
  }
  const permittedIds = new Set<string>();
  for (const permitted of target.permittedSpatialReferences) {
    if (
      typeof permitted.id !== 'string' ||
      permitted.id.length === 0 ||
      typeof permitted.kind !== 'string' ||
      permitted.kind.length === 0 ||
      typeof permitted.description !== 'string' ||
      permitted.description.length === 0 ||
      permittedIds.has(permitted.id)
    ) {
      throw new Error('page_contract_repair_spatial_target_invalid');
    }
    permittedIds.add(permitted.id);
  }
  return permittedIds;
}

function applyPageContractFieldTarget(args: {
  affectedPage: PageContractRepairAffectedPage;
  target: Exclude<
    PageContractRepairTarget,
    { code: 'final_structural_invariant_invalid' }
  >;
  originalPage: Record<string, unknown>;
  replacementPage: Record<string, unknown>;
  resultPage: Record<string, unknown>;
}): void {
  const { target } = args;
  if (target.code === 'action_beat_binding_component_invalid') {
    applyActionBindingComponentTarget({
      affectedPage: args.affectedPage,
      target,
      originalPage: args.originalPage,
      replacementPage: args.replacementPage,
      resultPage: args.resultPage,
    });
    return;
  }
  if (target.code === 'action_coverage_cardinality_invalid') {
    const original = pageActionAt(args.originalPage, target.actionIndex);
    const replacement = pageActionAt(
      args.replacementPage,
      target.actionIndex,
    );
    const result = pageActionAt(args.resultPage, target.actionIndex);
    if (!original || !replacement || !result) {
      throw new Error('page_contract_repair_action_target_stale');
    }
    if (!repairBeatIdIsValid(replacement.beatId, target.pageNumber)) {
      throw new Error('page_contract_repair_action_beat_id_invalid');
    }
    result.beatId = replacement.beatId;
    const originalCoverage = Array.isArray(
      args.originalPage.actionSemanticCoverage,
    )
      ? args.originalPage.actionSemanticCoverage
      : [];
    const replacementCoverage = Array.isArray(
      args.replacementPage.actionSemanticCoverage,
    )
      ? args.replacementPage.actionSemanticCoverage
      : [];
    const resultCoverage = Array.isArray(
      args.resultPage.actionSemanticCoverage,
    )
      ? args.resultPage.actionSemanticCoverage
      : [];
    if (
      originalCoverage.length !== replacementCoverage.length ||
      originalCoverage.length !== resultCoverage.length
    ) {
      throw new Error(
        'page_contract_repair_action_binding_scope_invalid',
      );
    }
    const matchingCoverageChanges: number[] = [];
    for (let index = 0; index < originalCoverage.length; index += 1) {
      const originalRecord = recordValue(originalCoverage[index]);
      const replacementRecord = recordValue(replacementCoverage[index]);
      if (!originalRecord || !replacementRecord) {
        throw new Error(
          'page_contract_repair_action_binding_scope_invalid',
        );
      }
      const originalBinding = canonicalize({
        beatId: originalRecord.beatId,
        disposition: originalRecord.disposition,
      });
      const replacementBinding = canonicalize({
        beatId: replacementRecord.beatId,
        disposition: replacementRecord.disposition,
      });
      if (
        JSON.stringify(originalBinding) !==
        JSON.stringify(replacementBinding)
      ) {
        if (replacementRecord.beatId !== replacement.beatId) continue;
        const replacementDisposition = recordValue(
          replacementRecord.disposition,
        );
        if (
          replacementDisposition?.kind !== 'action_requirement' ||
          !exactKeys(replacementDisposition, ['kind'])
        ) {
          throw new Error(
            'page_contract_repair_action_binding_scope_invalid',
          );
        }
        matchingCoverageChanges.push(index);
      }
    }
    if (matchingCoverageChanges.length > 1) {
      throw new Error(
        'page_contract_repair_action_binding_scope_invalid',
      );
    }
    if (matchingCoverageChanges.length === 1) {
      const coverageIndex = matchingCoverageChanges[0]!;
      const originalRecord = recordValue(
        originalCoverage[coverageIndex],
      )!;
      const replacementRecord = recordValue(
        replacementCoverage[coverageIndex],
      )!;
      const resultRecord = recordValue(resultCoverage[coverageIndex]);
      if (
        !resultRecord ||
        originalRecord.sourceEvidenceId !==
          replacementRecord.sourceEvidenceId ||
        replacementRecord.beatId !== replacement.beatId
      ) {
        throw new Error(
          'page_contract_repair_action_binding_scope_invalid',
        );
      }
      resultRecord.beatId = replacementRecord.beatId;
      resultRecord.disposition = { kind: 'action_requirement' };
    }
    return;
  }

  if (target.code === 'action_beat_binding_cardinality_invalid') {
    const original = pageActionAt(args.originalPage, target.actionIndex);
    const replacement = pageActionAt(
      args.replacementPage,
      target.actionIndex,
    );
    const result = pageActionAt(args.resultPage, target.actionIndex);
    if (!original || !replacement || !result) {
      throw new Error('page_contract_repair_action_target_stale');
    }
    if (!repairBeatIdIsValid(replacement.beatId, target.pageNumber)) {
      throw new Error('page_contract_repair_action_beat_id_invalid');
    }
    result.beatId = replacement.beatId;
    return;
  }

  if (target.code === 'coverage_action_binding_cardinality_invalid') {
    const original = pageCoverageAt(
      args.originalPage,
      target.coverageIndex,
    );
    const replacement = pageCoverageAt(
      args.replacementPage,
      target.coverageIndex,
    );
    const result = pageCoverageAt(args.resultPage, target.coverageIndex);
    if (!original || !replacement || !result) {
      throw new Error('page_contract_repair_coverage_target_stale');
    }
    if (!repairBeatIdIsValid(replacement.beatId, target.pageNumber)) {
      throw new Error('page_contract_repair_coverage_beat_id_invalid');
    }
    result.beatId = replacement.beatId;
    return;
  }

  if (target.code === 'page_spatial_reference_outside_zone') {
    const permittedIds = assertPageSpatialRepairTarget(target);
    const original = pageActionAt(args.originalPage, target.itemIndex);
    const replacement = pageActionAt(
      args.replacementPage,
      target.itemIndex,
    );
    const result = pageActionAt(args.resultPage, target.itemIndex);
    const originalReference = original
      ? currentSpatialReferenceForRole(original, target.fieldRole)
      : null;
    const replacementReference = replacement
      ? currentSpatialReferenceForRole(replacement, target.fieldRole)
      : null;
    if (
      !result ||
      !spatialReferenceShapeIsRepairable(originalReference) ||
      !spatialReferenceShapeIsRepairable(replacementReference)
    ) {
      throw new Error('page_contract_repair_spatial_target_stale');
    }
    if (!permittedIds.has(replacementReference.id)) {
      throw new Error(
        'page_contract_repair_spatial_reference_not_permitted',
      );
    }
    if (
      !replaceSpatialReferenceForRole({
        action: result,
        fieldRole: target.fieldRole,
        value: {
          kind: 'spatial',
          id: replacementReference.id,
        },
      })
    ) {
      throw new Error('page_contract_repair_spatial_target_stale');
    }
    return;
  }

  const original = pageCoverageAt(
    args.originalPage,
    target.coverageIndex,
  );
  const replacement = pageCoverageAt(
    args.replacementPage,
    target.coverageIndex,
  );
  const result = pageCoverageAt(args.resultPage, target.coverageIndex);
  const originalDisposition = recordValue(original?.disposition);
  const replacementDisposition = recordValue(replacement?.disposition);
  if (!original || !replacement || !result || !replacementDisposition) {
    throw new Error('page_contract_repair_coverage_target_stale');
  }

  if (target.code === 'closed_catalog_capability_gap') {
    if (
      original.beatId !== target.beatId ||
      original.sourceEvidenceId !== target.sourceEvidenceId ||
      replacement.beatId !== target.beatId ||
      replacement.sourceEvidenceId !== target.sourceEvidenceId ||
      originalDisposition?.kind !== 'unsupported' ||
      originalDisposition.reason !== 'closed_action_catalog_gap' ||
      replacementDisposition.kind !== 'presentation_requirement' ||
      !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
        replacementDisposition.presentationClass as never,
      ) ||
      !pointerValueIsPermitted(
        target.permittedPointerValues,
        replacementDisposition.contractPointer,
        replacementDisposition.contractValue,
      )
    ) {
      throw new Error(
        'page_contract_repair_presentation_target_invalid',
      );
    }
    result.disposition = {
      kind: 'presentation_requirement',
      presentationClass: replacementDisposition.presentationClass,
      contractPointer: replacementDisposition.contractPointer,
      contractValue: replacementDisposition.contractValue,
    };
    return;
  }

  if (
    originalDisposition?.kind !== 'represented_elsewhere' ||
    replacementDisposition.kind !== 'represented_elsewhere' ||
    original.beatId !== replacement.beatId ||
    original.sourceEvidenceId !== replacement.sourceEvidenceId ||
    !pointerValueIsPermitted(
      args.affectedPage.permittedPointerValues,
      replacementDisposition.contractPointer,
      replacementDisposition.contractValue,
    )
  ) {
    throw new Error(
      'page_contract_repair_represented_elsewhere_target_invalid',
    );
  }
  result.disposition = {
    kind: 'represented_elsewhere',
    contractPointer: replacementDisposition.contractPointer,
    contractValue: replacementDisposition.contractValue,
  };
}

export function applyPageContractRepairs(args: {
  draft: Record<string, unknown>;
  affectedPages: readonly PageContractRepairAffectedPage[];
  pageContracts: readonly Record<string, unknown>[];
}): Record<string, unknown> {
  const affectedByPage = new Map<
    number,
    PageContractRepairAffectedPage
  >();
  for (const affectedPage of args.affectedPages) {
    if (affectedByPage.has(affectedPage.pageNumber)) {
      throw new Error('page_contract_repair_affected_page_duplicate');
    }
    affectedByPage.set(affectedPage.pageNumber, affectedPage);
  }
  if (affectedByPage.size === 0) {
    throw new Error('page_contract_repair_patch_set_incomplete');
  }
  if (args.pageContracts.length !== affectedByPage.size) {
    throw new Error('page_contract_repair_patch_set_incomplete');
  }
  const replacements = new Map<number, Record<string, unknown>>();
  for (const page of args.pageContracts) {
    const pageNumber = page.pageNumber as number;
    if (!affectedByPage.has(pageNumber) || replacements.has(pageNumber)) {
      throw new Error('page_contract_repair_page_unexpected_or_duplicate');
    }
    replacements.set(pageNumber, structuredClone(page));
  }
  for (const affectedPage of args.affectedPages) {
    if (affectedPage.repairTargets.length === 0) {
      throw new Error('page_contract_repair_target_set_empty');
    }
    const targetKeys = new Set<string>();
    const componentActionIndexes = new Set<number>();
    const componentCoverageIndexes = new Set<number>();
    for (const target of affectedPage.repairTargets) {
      const key = pageContractRepairTargetKey(target);
      if (
        target.pageNumber !== affectedPage.pageNumber ||
        targetKeys.has(key)
      ) {
        throw new Error('page_contract_repair_target_invalid_or_duplicate');
      }
      targetKeys.add(key);
      if (target.code === 'action_beat_binding_component_invalid') {
        if (
          target.actionIndexes.length < 2 ||
          target.coverageDeficit !== target.actionIndexes.length - 1 ||
          target.coverageIndex < 0 ||
          !Number.isSafeInteger(target.coverageIndex) ||
          !repairBeatIdIsValid(
            target.originalBeatId,
            target.pageNumber,
          ) ||
          typeof target.sourceEvidenceId !== 'string' ||
          !SOURCE_EVIDENCE_ID_PATTERN.test(
            target.sourceEvidenceId,
          ) ||
          target.actionIndexes.some(
            (actionIndex, index) =>
              !Number.isSafeInteger(actionIndex) ||
              actionIndex < 0 ||
              (index > 0 &&
                target.actionIndexes[index - 1]! >= actionIndex) ||
              componentActionIndexes.has(actionIndex),
          ) ||
          componentCoverageIndexes.has(target.coverageIndex)
        ) {
          throw new Error(
            'page_contract_repair_action_binding_component_target_invalid',
          );
        }
        target.actionIndexes.forEach((actionIndex) =>
          componentActionIndexes.add(actionIndex),
        );
        componentCoverageIndexes.add(target.coverageIndex);
      }
    }
  }

  const draft = structuredClone(args.draft);
  if (!Array.isArray(draft.pageContracts)) {
    throw new Error('page_contract_repair_page_collection_invalid');
  }
  const expected = new Set(affectedByPage.keys());
  const seen = new Set<number>();
  draft.pageContracts = draft.pageContracts.map((value) => {
    const originalPage = recordValue(value);
    const pageNumber = originalPage?.pageNumber;
    if (
      !originalPage ||
      typeof pageNumber !== 'number' ||
      !affectedByPage.has(pageNumber)
    ) {
      return value;
    }
    if (seen.has(pageNumber)) {
      throw new Error('page_contract_repair_page_not_unique');
    }
    seen.add(pageNumber);
    const affectedPage = affectedByPage.get(pageNumber)!;
    const replacementPage = replacements.get(pageNumber);
    if (!replacementPage) {
      throw new Error('page_contract_repair_patch_set_incomplete');
    }
    const targetedResult = structuredClone(originalPage);
    for (const target of affectedPage.repairTargets) {
      if (target.code === 'final_structural_invariant_invalid') continue;
      applyPageContractFieldTarget({
        affectedPage,
        target,
        originalPage,
        replacementPage,
        resultPage: targetedResult,
      });
    }
    const hasStructuralAuthority = affectedPage.repairTargets.some(
      (target) => target.code === 'final_structural_invariant_invalid',
    );
    const hasActionBindingComponentAuthority =
      affectedPage.repairTargets.some(
        (target) =>
          target.code ===
          'action_beat_binding_component_invalid',
      );
    if (
      hasActionBindingComponentAuthority &&
      !hasStructuralAuthority &&
      !canonicalValuesEqual(
        pageContractSchemaProjection(targetedResult),
        pageContractSchemaProjection(replacementPage),
      )
    ) {
      throw new Error(
        'page_contract_repair_action_binding_component_scope_invalid',
      );
    }
    return hasStructuralAuthority
      ? {
          ...replacementPage,
          locationId: originalPage.locationId,
          zoneId: originalPage.zoneId,
        }
      : targetedResult;
  });
  if (seen.size !== expected.size) {
    throw new Error('page_contract_repair_page_not_unique');
  }
  return draft;
}
