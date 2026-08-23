import { canonicalize } from '@/lib/canonical-json';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import {
  CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
  withTemplateDraftActionRequirementDefinitions,
} from './templateDraftSchema';
import {
  decodePageContractRepairInput,
  encodePageContractRepairInput,
} from './pageContractRepair';

export const STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION =
  'structural-bundle-repair-schema/v3' as const;
export const STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME =
  'StructuralBundleRepairPatch' as const;
export const STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION =
  'structural-bundle-repair-prompt/v2' as const;
export const STRUCTURAL_BUNDLE_REPAIR_USER_PROMPT_VERSION =
  'structural-bundle-repair-user-prompt/v2' as const;

const MAX_VALIDATION_MESSAGES = 128;
const MAX_VALIDATION_MESSAGE_LENGTH = 1_024;

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

export const STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = withTemplateDraftActionRequirementDefinitions(
  strictObject({
    recurringProps: {
      type: 'array',
      minItems: 1,
      items: TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
    },
    pageContracts: {
      type: 'array',
      minItems: 1,
      items: CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA,
    },
  }),
);

const RECURRING_PROP_KEYS = Object.freeze(
  Object.keys(
    TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);
const PAGE_CONTRACT_KEYS = Object.freeze(
  Object.keys(
    CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);

interface StructuralBundleReferenceAuthority {
  recurringPropIds: string[];
  locationIds: string[];
  zones: Array<{ id: string; locationId: string }>;
  castIds: string[];
  spatialReferenceIdsByZone: Array<{
    zoneId: string;
    spatialReferenceIds: string[];
  }>;
}

export interface StructuralBundleRepairAffectedPage {
  pageNumber: number;
  pageContract: Record<string, unknown>;
}

export interface StructuralBundleRepairAuthority {
  recurringProps: Record<string, unknown>[];
  affectedPages: StructuralBundleRepairAffectedPage[];
  validationMessages: string[];
  referenceAuthority: StructuralBundleReferenceAuthority;
}

export interface StructuralBundleRepairPatch {
  recurringProps: Record<string, unknown>[];
  pageContracts: Record<string, unknown>[];
}

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
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

function pageContractProjection(
  page: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    PAGE_CONTRACT_KEYS.map((key) => [key, structuredClone(page[key])]),
  );
}

function preservedContinuitySelections(
  page: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    [
      'childWardrobeOverrideDescription',
      'childWardrobeOverrideSourceEvidenceId',
      'companionStateId',
      'companionStateSourceEvidenceId',
    ]
      .filter((key) => Object.prototype.hasOwnProperty.call(page, key))
      .map((key) => [key, structuredClone(page[key])]),
  );
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function uniqueNonEmptyIds(
  values: readonly Record<string, unknown>[],
): string[] | null {
  const ids = values.map((value) => value.id);
  if (
    ids.length === 0 ||
    ids.some(
      (value) =>
        typeof value !== 'string' || value.trim().length === 0,
    )
  ) {
    return null;
  }
  const strings = ids as string[];
  return new Set(strings).size === strings.length ? strings : null;
}

function cleanValidationMessages(
  values: readonly string[],
): string[] | null {
  if (
    values.length === 0 ||
    values.length > MAX_VALIDATION_MESSAGES
  ) {
    return null;
  }
  const secretPattern =
    /(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+|OPENAI_API_KEY|BEGIN [A-Z ]*PRIVATE KEY|password\s*=)/i;
  const messages = values.map((value) =>
    value.replace(/\s+/g, ' ').trim(),
  );
  if (
    messages.some(
      (value) =>
        value.length === 0 ||
        value.length > MAX_VALIDATION_MESSAGE_LENGTH ||
        value.includes('\0') ||
        secretPattern.test(value),
    )
  ) {
    return null;
  }
  return [...new Set(messages)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function referenceAuthority(
  draft: Record<string, unknown>,
  recurringPropIds: readonly string[],
): StructuralBundleReferenceAuthority {
  const locations = Array.isArray(draft.locations)
    ? draft.locations.map(recordValue).filter((value) => value !== null)
    : [];
  const zones = Array.isArray(draft.zones)
    ? draft.zones.map(recordValue).filter((value) => value !== null)
    : [];
  const cast = recordValue(draft.cast);
  const castValues = [
    recordValue(cast?.child),
    recordValue(cast?.companion),
    ...(Array.isArray(draft.humanCast)
      ? draft.humanCast.map(recordValue)
      : []),
  ].filter((value) => value !== null);
  return {
    recurringPropIds: [...recurringPropIds].sort(),
    locationIds: locations
      .flatMap((value) =>
        typeof value.id === 'string' ? [value.id] : [],
      )
      .sort(),
    zones: zones
      .flatMap((value) =>
        typeof value.id === 'string' &&
        typeof value.locationId === 'string'
          ? [{ id: value.id, locationId: value.locationId }]
          : [],
      )
      .sort(
        (left, right) =>
          left.id.localeCompare(right.id) ||
          left.locationId.localeCompare(right.locationId),
      ),
    castIds: castValues
      .flatMap((value) =>
        typeof value.id === 'string' ? [value.id] : [],
      )
      .sort(),
    spatialReferenceIdsByZone: zones
      .flatMap((zone) => {
        if (typeof zone.id !== 'string') return [];
        const spatialReferenceIds = Array.isArray(zone.spatialNodes)
          ? zone.spatialNodes
              .map(recordValue)
              .flatMap((value) =>
                typeof value?.id === 'string' ? [value.id] : [],
              )
              .sort()
          : [];
        return [{ zoneId: zone.id, spatialReferenceIds }];
      })
      .sort((left, right) => left.zoneId.localeCompare(right.zoneId)),
  };
}

/**
 * Selects only the closed mixed structural family proven by the live attempt:
 * one recurring-props collection identity plus one or more page identities.
 * Repeated emitted issues are allowed, but their unique locator domain is
 * exact. Validation messages remain transient provider guidance.
 */
export function structuralBundleRepairAuthority(args: {
  draft: Record<string, unknown>;
  validationMessages: readonly string[];
  diagnosticIssues: readonly DraftValidationIssue[];
}): StructuralBundleRepairAuthority | null {
  if (
    args.diagnosticIssues.length === 0 ||
    args.validationMessages.length !== args.diagnosticIssues.length ||
    !args.diagnosticIssues.every(draftValidationIssueIsValid)
  ) {
    return null;
  }
  let recurringPropsIdentitySeen = false;
  const pageNumbers = new Set<number>();
  for (const issue of args.diagnosticIssues) {
    if (
      issue.family !== 'draft_contract' ||
      issue.code !== 'final_structural_invariant_invalid' ||
      issue.locator.fieldRole !== 'final_structure'
    ) {
      return null;
    }
    if (
      issue.locator.kind === 'collection' &&
      issue.locator.collectionRole === 'recurring_props'
    ) {
      recurringPropsIdentitySeen = true;
      continue;
    }
    if (
      issue.locator.kind === 'page' &&
      positiveInteger(issue.locator.pageNumber)
    ) {
      pageNumbers.add(issue.locator.pageNumber);
      continue;
    }
    return null;
  }
  if (!recurringPropsIdentitySeen || pageNumbers.size === 0) return null;

  const recurringProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  if (recurringProps.some((value) => value === null)) return null;
  const typedProps = recurringProps as Record<string, unknown>[];
  const recurringPropIds = uniqueNonEmptyIds(typedProps);
  if (!recurringPropIds) return null;

  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  if (pages.some((value) => value === null)) return null;
  const typedPages = pages as Record<string, unknown>[];
  const affectedPages = [...pageNumbers]
    .sort((left, right) => left - right)
    .map((pageNumber) => {
      const matches = typedPages.filter(
        (page) => page.pageNumber === pageNumber,
      );
      return matches.length === 1
        ? {
            pageNumber,
            pageContract: pageContractProjection(matches[0]!),
          }
        : null;
    });
  const validationMessages = cleanValidationMessages(
    args.validationMessages,
  );
  if (
    !validationMessages ||
    affectedPages.some((value) => value === null)
  ) {
    return null;
  }
  return {
    recurringProps: structuredClone(typedProps),
    affectedPages:
      affectedPages as StructuralBundleRepairAffectedPage[],
    validationMessages,
    referenceAuthority: referenceAuthority(
      args.draft,
      recurringPropIds,
    ),
  };
}

export function buildStructuralBundleRepairSystemPrompt(): string {
  return [
    'Repair ONLY the recurringProps collection and complete page contracts identified by the input.',
    'Decode the compact input exactly: ["s",i] references stringDictionary[i], ["a",...items] is an array, and ["o",i,...values] is an object whose ordered keys are objectShapes[i].',
    'The decoded root contains recurringProps, affectedPages, validationMessages, and referenceAuthority; the compact representation omits no authority value.',
    'Return the same recurring prop IDs and exactly the affected pageNumbers; never add, remove, or rename an identity.',
    'Use only IDs present in referenceAuthority and resolve every listed validationMessage.',
    'Preserve all valid semantics and do not infer or return any unrelated global field.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildStructuralBundleRepairUserPrompt(args: {
  authority: StructuralBundleRepairAuthority;
}): string {
  const payload = {
    recurringProps: structuredClone(args.authority.recurringProps),
    affectedPages: args.authority.affectedPages.map((value) => ({
      pageNumber: value.pageNumber,
      pageContract: structuredClone(value.pageContract),
    })),
    validationMessages: [...args.authority.validationMessages],
    referenceAuthority: structuredClone(
      args.authority.referenceAuthority,
    ),
  };
  const encoded = encodePageContractRepairInput(payload);
  let decoded: unknown;
  try {
    decoded = decodePageContractRepairInput(encoded);
  } catch {
    throw new Error('structural_bundle_repair_input_encoding_invalid');
  }
  if (
    JSON.stringify(canonicalize(payload)) !==
    JSON.stringify(canonicalize(decoded))
  ) {
    throw new Error('structural_bundle_repair_input_roundtrip_mismatch');
  }
  return JSON.stringify(canonicalize(encoded));
}

/** Strict local decoder used by tests and diagnostics to prove losslessness. */
export function decodeStructuralBundleRepairUserPrompt(raw: string): {
  recurringProps: Record<string, unknown>[];
  affectedPages: StructuralBundleRepairAffectedPage[];
  validationMessages: string[];
  referenceAuthority: StructuralBundleReferenceAuthority;
} {
  let encoded: unknown;
  try {
    encoded = JSON.parse(raw);
  } catch {
    throw new Error('structural_bundle_repair_input_encoding_invalid');
  }
  let decoded: unknown;
  try {
    decoded = decodePageContractRepairInput(encoded);
  } catch {
    throw new Error('structural_bundle_repair_input_encoding_invalid');
  }
  const root = recordValue(decoded);
  if (
    !root ||
    !exactKeys(root, [
      'recurringProps',
      'affectedPages',
      'validationMessages',
      'referenceAuthority',
    ]) ||
    !Array.isArray(root.recurringProps) ||
    !Array.isArray(root.affectedPages) ||
    !Array.isArray(root.validationMessages) ||
    !recordValue(root.referenceAuthority)
  ) {
    throw new Error('structural_bundle_repair_input_encoding_invalid');
  }
  return root as unknown as {
    recurringProps: Record<string, unknown>[];
    affectedPages: StructuralBundleRepairAffectedPage[];
    validationMessages: string[];
    referenceAuthority: StructuralBundleReferenceAuthority;
  };
}

export function parseStructuralBundleRepairPatch(
  raw: string,
): StructuralBundleRepairPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('structural_bundle_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, ['recurringProps', 'pageContracts']) ||
    !Array.isArray(root.recurringProps) ||
    root.recurringProps.length === 0 ||
    !Array.isArray(root.pageContracts) ||
    root.pageContracts.length === 0
  ) {
    throw new Error('structural_bundle_repair_response_invalid_shape');
  }
  const recurringProps = root.recurringProps.map(recordValue);
  if (
    recurringProps.some(
      (value) =>
        !value ||
        !exactKeys(value, RECURRING_PROP_KEYS) ||
        typeof value.id !== 'string' ||
        value.id.length === 0,
    )
  ) {
    throw new Error('structural_bundle_repair_prop_invalid');
  }
  const pageContracts = root.pageContracts.map(recordValue);
  if (
    pageContracts.some(
      (value) =>
        !value ||
        !exactKeys(value, PAGE_CONTRACT_KEYS) ||
        !positiveInteger(value.pageNumber),
    )
  ) {
    throw new Error('structural_bundle_repair_page_invalid');
  }
  return {
    recurringProps: recurringProps as Record<string, unknown>[],
    pageContracts: pageContracts as Record<string, unknown>[],
  };
}

function exactIdentityMap(
  values: readonly Record<string, unknown>[],
  key: 'id' | 'pageNumber',
  errorCode: string,
): Map<string | number, Record<string, unknown>> {
  const result = new Map<string | number, Record<string, unknown>>();
  for (const value of values) {
    const identity = value[key];
    if (
      (key === 'id'
        ? typeof identity !== 'string' || identity.length === 0
        : !positiveInteger(identity)) ||
      result.has(identity as string | number)
    ) {
      throw new Error(errorCode);
    }
    result.set(identity as string | number, value);
  }
  return result;
}

function maskedBundle(args: {
  draft: Record<string, unknown>;
  pageNumbers: ReadonlySet<number>;
}): unknown {
  const masked = structuredClone(args.draft);
  masked.recurringProps = '__structural_bundle_target__';
  masked.pageContracts = Array.isArray(masked.pageContracts)
    ? masked.pageContracts.map((value) => {
        const page = recordValue(value);
        return page &&
          positiveInteger(page.pageNumber) &&
          args.pageNumbers.has(page.pageNumber)
          ? {
              pageNumber: page.pageNumber,
              __structuralBundleTarget: true,
            }
          : value;
      })
    : masked.pageContracts;
  return canonicalize(masked);
}

export function applyStructuralBundleRepairPatch(args: {
  draft: Record<string, unknown>;
  authority: StructuralBundleRepairAuthority;
  patch: StructuralBundleRepairPatch;
}): Record<string, unknown> {
  const expectedProps = exactIdentityMap(
    args.authority.recurringProps,
    'id',
    'structural_bundle_repair_prop_authority_invalid',
  );
  const patchProps = exactIdentityMap(
    args.patch.recurringProps,
    'id',
    'structural_bundle_repair_prop_unexpected_or_duplicate',
  );
  if (
    patchProps.size !== expectedProps.size ||
    [...expectedProps.keys()].some((id) => !patchProps.has(id))
  ) {
    throw new Error('structural_bundle_repair_prop_set_mismatch');
  }
  const expectedPages = exactIdentityMap(
    args.authority.affectedPages.map((value) => value.pageContract),
    'pageNumber',
    'structural_bundle_repair_page_authority_invalid',
  );
  const patchPages = exactIdentityMap(
    args.patch.pageContracts,
    'pageNumber',
    'structural_bundle_repair_page_unexpected_or_duplicate',
  );
  if (
    patchPages.size !== expectedPages.size ||
    [...expectedPages.keys()].some(
      (pageNumber) => !patchPages.has(pageNumber),
    )
  ) {
    throw new Error('structural_bundle_repair_page_set_mismatch');
  }

  const pageNumbers = new Set(
    [...expectedPages.keys()] as number[],
  );
  const beforeMasked = maskedBundle({
    draft: args.draft,
    pageNumbers,
  });
  const result = structuredClone(args.draft);
  const currentProps = Array.isArray(result.recurringProps)
    ? result.recurringProps.map(recordValue)
    : [];
  if (
    currentProps.some((value) => !value) ||
    !uniqueNonEmptyIds(currentProps as Record<string, unknown>[])
  ) {
    throw new Error('structural_bundle_repair_prop_target_stale');
  }
  const currentPropIds = new Set(
    (currentProps as Record<string, unknown>[]).map(
      (value) => value.id as string,
    ),
  );
  if (
    currentPropIds.size !== patchProps.size ||
    [...currentPropIds].some((id) => !patchProps.has(id))
  ) {
    throw new Error('structural_bundle_repair_prop_target_stale');
  }
  result.recurringProps = currentProps.map((value) =>
    structuredClone(patchProps.get(value!.id as string)!),
  );
  if (!Array.isArray(result.pageContracts)) {
    throw new Error('structural_bundle_repair_page_target_stale');
  }
  const seenSelectedPages = new Set<number>();
  result.pageContracts = result.pageContracts.map((value) => {
    const page = recordValue(value);
    if (!page || !positiveInteger(page.pageNumber)) return value;
    if (!pageNumbers.has(page.pageNumber)) return value;
    if (seenSelectedPages.has(page.pageNumber)) {
      throw new Error('structural_bundle_repair_page_target_stale');
    }
    seenSelectedPages.add(page.pageNumber);
    return {
      ...structuredClone(patchPages.get(page.pageNumber)!),
      ...preservedContinuitySelections(page),
    };
  });
  if (seenSelectedPages.size !== pageNumbers.size) {
    throw new Error('structural_bundle_repair_page_target_stale');
  }
  const afterMasked = maskedBundle({ draft: result, pageNumbers });
  if (JSON.stringify(beforeMasked) !== JSON.stringify(afterMasked)) {
    throw new Error('structural_bundle_repair_non_target_drift');
  }
  return result;
}
