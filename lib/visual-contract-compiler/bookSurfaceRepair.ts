import { canonicalize } from '@/lib/canonical-json';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import {
  applyPageContractRepairs,
  decodePageContractRepairInput,
  encodePageContractRepairInput,
  pageContractPresentationStructuralRepairAffectedPages,
  type PageContractRepairAffectedPage,
} from './pageContractRepair';
import type { PresentationRequirementRepairTarget } from './presentationRequirementRepair';
import {
  TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
} from './templateDraftSchema';

export const BOOK_SURFACE_REPAIR_SCHEMA_VERSION =
  'book-surface-repair-schema/v3' as const;
export const BOOK_SURFACE_REPAIR_SCHEMA_NAME =
  'BookSurfaceRepairPatch' as const;
export const BOOK_SURFACE_REPAIR_PROMPT_VERSION =
  'book-surface-repair-prompt/v3' as const;
export const BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION =
  'book-surface-repair-user-prompt/v3' as const;

const MAX_VALIDATION_MESSAGES = 128;
const MAX_VALIDATION_MESSAGE_LENGTH = 1_024;

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

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

export const BOOK_SURFACE_REPAIR_JSON_SCHEMA: Record<string, unknown> =
  strictObject({
    coverContract: TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA,
    recurringProps: {
      type: 'array',
      items: TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
    },
    pageContracts: {
      type: 'array',
      minItems: 1,
      items: TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
    },
  });

const COVER_CONTRACT_KEYS = Object.freeze(
  Object.keys(
    TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);
const PAGE_CONTRACT_KEYS = Object.freeze(
  Object.keys(
    TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);
const RECURRING_PROP_KEYS = Object.freeze(
  Object.keys(
    TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);

interface BookSurfaceReferenceAuthority {
  worldType: string;
  recurringPropIds: string[];
  locationIds: string[];
  zones: Array<{ id: string; locationId: string }>;
  castIds: string[];
  spatialReferenceIdsByZone: Array<{
    zoneId: string;
    spatialReferenceIds: string[];
  }>;
}

export interface BookSurfaceRepairAuthority {
  coverContract: Record<string, unknown>;
  recurringProps: Record<string, unknown>[];
  repairRecurringProps: boolean;
  affectedPages: PageContractRepairAffectedPage[];
  coverValidationHints: string[];
  recurringPropValidationHints: string[];
  referenceAuthority: BookSurfaceReferenceAuthority;
}

export interface BookSurfaceRepairPatch {
  coverContract: Record<string, unknown>;
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

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function uniqueStrings(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  if (
    values.some(
      (value) => typeof value !== 'string' || value.trim().length === 0,
    )
  ) {
    return null;
  }
  const strings = values as string[];
  return new Set(strings).size === strings.length ? strings : null;
}

function uniqueRecordIds(
  values: readonly Record<string, unknown>[],
): string[] | null {
  const ids = values.map((value) => value.id);
  if (
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
  options: { allowEmpty?: boolean } = {},
): string[] | null {
  if (
    (!options.allowEmpty && values.length === 0) ||
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
  return [...new Set(messages)].sort(lexicalCompare);
}

function referenceAuthority(
  draft: Record<string, unknown>,
): BookSurfaceReferenceAuthority | null {
  if (typeof draft.worldType !== 'string' || draft.worldType.trim().length === 0) {
    return null;
  }
  const locations = Array.isArray(draft.locations)
    ? draft.locations.map(recordValue)
    : [];
  const zones = Array.isArray(draft.zones)
    ? draft.zones.map(recordValue)
    : [];
  const recurringProps = Array.isArray(draft.recurringProps)
    ? draft.recurringProps.map(recordValue)
    : [];
  if (
    locations.some((value) => value === null) ||
    zones.some((value) => value === null) ||
    recurringProps.some((value) => value === null)
  ) {
    return null;
  }
  const cast = recordValue(draft.cast);
  const child = recordValue(cast?.child);
  const companion =
    cast?.companion === null ? null : recordValue(cast?.companion);
  const humanCast = Array.isArray(draft.humanCast)
    ? draft.humanCast.map(recordValue)
    : [];
  if (
    !cast ||
    !child ||
    (companion === null && cast.companion !== null) ||
    humanCast.some((value) => value === null)
  ) {
    return null;
  }
  const castValues = [
    child,
    ...(companion ? [companion] : []),
    ...(humanCast as Record<string, unknown>[]),
  ];
  const locationIds = (locations as Record<string, unknown>[]).flatMap(
    (value) => (typeof value.id === 'string' ? [value.id] : []),
  );
  const typedZones = zones as Record<string, unknown>[];
  const recurringPropIds = (
    recurringProps as Record<string, unknown>[]
  ).flatMap((value) =>
    typeof value.id === 'string' ? [value.id] : [],
  );
  const castIds = castValues.flatMap((value) =>
    typeof value.id === 'string' ? [value.id] : [],
  );
  const zoneAuthority = typedZones.flatMap((value) =>
    typeof value.id === 'string' && typeof value.locationId === 'string'
      ? [{ id: value.id, locationId: value.locationId }]
      : [],
  );
  if (
    locationIds.length !== locations.length ||
    new Set(locationIds).size !== locationIds.length ||
    zoneAuthority.length !== typedZones.length ||
    new Set(zoneAuthority.map((value) => value.id)).size !==
      zoneAuthority.length ||
    recurringPropIds.length !== recurringProps.length ||
    new Set(recurringPropIds).size !== recurringPropIds.length ||
    castIds.length !== castValues.length ||
    new Set(castIds).size !== castIds.length
  ) {
    return null;
  }
  const spatialReferenceIdsByZone = typedZones.map((zone) => {
    const spatialNodes = Array.isArray(zone.spatialNodes)
      ? zone.spatialNodes.map(recordValue)
      : [];
    if (spatialNodes.some((value) => value === null)) return null;
    const spatialReferenceIds = (
      spatialNodes as Record<string, unknown>[]
    ).flatMap((value) =>
      typeof value.id === 'string' ? [value.id] : [],
    );
    if (
      spatialReferenceIds.length !== spatialNodes.length ||
      new Set(spatialReferenceIds).size !== spatialReferenceIds.length
    ) {
      return null;
    }
    return {
      zoneId: zone.id as string,
      spatialReferenceIds: spatialReferenceIds.sort(),
    };
  });
  if (spatialReferenceIdsByZone.some((value) => value === null)) {
    return null;
  }
  return {
    worldType: draft.worldType,
    recurringPropIds: recurringPropIds.sort(),
    locationIds: [...locationIds].sort(),
    zones: zoneAuthority.sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.locationId.localeCompare(right.locationId),
    ),
    castIds: castIds.sort(),
    spatialReferenceIdsByZone: (
      spatialReferenceIdsByZone as Array<{
        zoneId: string;
        spatialReferenceIds: string[];
      }>
    )
      .sort((left, right) => left.zoneId.localeCompare(right.zoneId)),
  };
}

function permittedStructuralIssue(issue: DraftValidationIssue): boolean {
  if (issue.family !== 'draft_contract') return false;
  if (
    issue.code === 'cover_projection_invalid' &&
    issue.locator.kind === 'cover' &&
    (issue.locator.fieldRole === 'world_type' ||
      issue.locator.fieldRole === 'final_structure')
  ) {
    return true;
  }
  if (
    issue.code === 'lifecycle_invariant_invalid' &&
    issue.locator.kind === 'collection' &&
    issue.locator.collectionRole === 'recurring_props' &&
    issue.locator.fieldRole === 'lifecycle'
  ) {
    return true;
  }
  if (
    issue.code !== 'final_structural_invariant_invalid' ||
    issue.locator.fieldRole !== 'final_structure'
  ) {
    return false;
  }
  return (
    issue.locator.kind === 'cover' ||
    (issue.locator.kind === 'page' &&
      positiveInteger(issue.locator.pageNumber))
  );
}

/**
 * Selects only the closed mixed family seen after a bounded page repair:
 * presentation gaps plus cover/page final-structure failures and, when
 * present, the exact recurring-props lifecycle identity. The authority
 * excludes every unrelated draft collection and returns null on any mixture.
 */
export function bookSurfaceRepairAuthority(args: {
  draft: Record<string, unknown>;
  /**
   * Compiler-normalized projection used only for closed reference and cover
   * authority. The patch is still applied to `draft`, so no normalized or
   * compiler-owned field can leak into an unrelated provider-authored field.
   */
  authorityDraft: Record<string, unknown>;
  presentationTargets: readonly PresentationRequirementRepairTarget[];
  structuralDiagnosticIssues: readonly DraftValidationIssue[];
  structuralValidationMessages: readonly string[];
}): BookSurfaceRepairAuthority | null {
  if (
    args.presentationTargets.length === 0 ||
    args.structuralDiagnosticIssues.length === 0 ||
    args.structuralDiagnosticIssues.length !==
      args.structuralValidationMessages.length ||
    !args.structuralDiagnosticIssues.every(
      (issue) =>
        draftValidationIssueIsValid(issue) && permittedStructuralIssue(issue),
    )
  ) {
    return null;
  }
  const coverIssueSeen = args.structuralDiagnosticIssues.some(
    (issue) => issue.locator.kind === 'cover',
  );
  const repairRecurringProps = args.structuralDiagnosticIssues.some(
    (issue) =>
      issue.code === 'lifecycle_invariant_invalid' &&
      issue.locator.kind === 'collection' &&
      issue.locator.collectionRole === 'recurring_props' &&
      issue.locator.fieldRole === 'lifecycle',
  );
  const structuralIssueEntries = args.structuralDiagnosticIssues
    .map((issue, index) => ({
      issue,
      message: args.structuralValidationMessages[index]!,
    }));
  const coverIssueEntries = structuralIssueEntries.filter(
    ({ issue }) => issue.locator.kind === 'cover',
  );
  const recurringPropIssueEntries = structuralIssueEntries.filter(
    ({ issue }) =>
      issue.code === 'lifecycle_invariant_invalid' &&
      issue.locator.kind === 'collection' &&
      issue.locator.collectionRole === 'recurring_props' &&
      issue.locator.fieldRole === 'lifecycle',
  );
  const pageIssueEntries = structuralIssueEntries.filter(
    ({ issue }) => issue.locator.kind === 'page',
  );
  if (
    coverIssueEntries.length +
      recurringPropIssueEntries.length +
      pageIssueEntries.length !==
    structuralIssueEntries.length
  ) {
    return null;
  }
  if (!coverIssueSeen || pageIssueEntries.length === 0) return null;

  const affectedPages =
    pageContractPresentationStructuralRepairAffectedPages({
      draft: args.draft,
      presentationTargets: args.presentationTargets,
      structuralDiagnosticIssues: pageIssueEntries.map(
        ({ issue }) => issue,
      ),
      structuralValidationMessages: pageIssueEntries.map(
        ({ message }) => message,
      ),
    });
  const cleanedAffectedPages = affectedPages?.map((page) => {
    const validationHints = cleanValidationMessages(
      page.validationHints,
    );
    return validationHints
      ? {
          ...page,
          validationHints,
        }
      : null;
  });
  const affectedPageValidationHintCount =
    cleanedAffectedPages?.reduce(
      (total, page) =>
        total + (page?.validationHints.length ?? 0),
      0,
    );
  const coverContract = recordValue(args.authorityDraft.coverContract);
  const recurringProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  const coverValidationHints = cleanValidationMessages(
    coverIssueEntries.map(({ message }) => message),
  );
  const recurringPropValidationHints = cleanValidationMessages(
    recurringPropIssueEntries.map(({ message }) => message),
    { allowEmpty: !repairRecurringProps },
  );
  const refs = referenceAuthority(args.authorityDraft);
  const typedRecurringProps = recurringProps as Record<string, unknown>[];
  const recurringPropIds = recurringProps.some((value) => value === null)
    ? null
    : uniqueRecordIds(typedRecurringProps);
  if (
    !affectedPages ||
    affectedPageValidationHintCount === undefined ||
    !cleanedAffectedPages ||
    cleanedAffectedPages.some((page) => page === null) ||
    !coverContract ||
    !exactKeys(coverContract, COVER_CONTRACT_KEYS) ||
    !coverValidationHints ||
    !recurringPropValidationHints ||
    (repairRecurringProps && recurringPropValidationHints.length === 0) ||
    (!repairRecurringProps && recurringPropValidationHints.length > 0) ||
    coverValidationHints.length +
      recurringPropValidationHints.length +
      affectedPageValidationHintCount >
      MAX_VALIDATION_MESSAGES ||
    !refs ||
    !recurringPropIds ||
    JSON.stringify([...recurringPropIds].sort()) !==
      JSON.stringify(refs.recurringPropIds)
  ) {
    return null;
  }
  return {
    coverContract: structuredClone(coverContract),
    recurringProps: structuredClone(typedRecurringProps),
    repairRecurringProps,
    affectedPages: (
      cleanedAffectedPages as PageContractRepairAffectedPage[]
    ).map((value) => structuredClone(value)),
    coverValidationHints,
    recurringPropValidationHints,
    referenceAuthority: refs,
  };
}

export function buildBookSurfaceRepairSystemPrompt(): string {
  return [
    'Repair ONLY the coverContract, the recurringProps collection when repairRecurringProps is true, and complete page contracts identified by the input.',
    'Decode the compact input exactly: ["s",i] references stringDictionary[i], ["a",...items] is an array, and ["o",i,...values] is an object whose ordered keys are objectShapes[i].',
    'The decoded root contains coverContract with coverValidationHints, recurringProps with recurringPropValidationHints, repairRecurringProps, affectedPages with exact repairTargets and page-specific validationHints, and referenceAuthority.',
    'Return exactly one coverContract, the same recurring prop IDs, and exactly the affected pageNumbers; never add, remove, or rename an identity.',
    'When repairRecurringProps is false, recurringPropValidationHints is empty and recurringProps must be returned unchanged. When true, resolve only its listed lifecycle invariant.',
    'Use only IDs and worldType present in referenceAuthority. Preserve page locationId and zoneId. Resolve every listed target and scoped validation hint.',
    'Preserve all valid semantics and do not infer or return any unrelated global field.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildBookSurfaceRepairUserPrompt(args: {
  authority: BookSurfaceRepairAuthority;
}): string {
  const payload = {
    coverContract: structuredClone(args.authority.coverContract),
    recurringProps: structuredClone(args.authority.recurringProps),
    repairRecurringProps: args.authority.repairRecurringProps,
    coverValidationHints: [...args.authority.coverValidationHints],
    recurringPropValidationHints: [
      ...args.authority.recurringPropValidationHints,
    ],
    affectedPages: args.authority.affectedPages.map((value) => ({
      pageNumber: value.pageNumber,
      pageContract: structuredClone(value.pageContract),
      repairTargets: structuredClone(value.repairTargets),
      validationHints: [...value.validationHints],
      permittedPointerValues: structuredClone(
        value.permittedPointerValues,
      ),
    })),
    referenceAuthority: structuredClone(
      args.authority.referenceAuthority,
    ),
  };
  const encoded = encodePageContractRepairInput(payload);
  const decoded = decodePageContractRepairInput(encoded);
  if (
    JSON.stringify(canonicalize(payload)) !==
    JSON.stringify(canonicalize(decoded))
  ) {
    throw new Error('book_surface_repair_input_roundtrip_mismatch');
  }
  return JSON.stringify(canonicalize(encoded));
}

export function decodeBookSurfaceRepairUserPrompt(
  raw: string,
): Record<string, unknown> {
  let encoded: unknown;
  try {
    encoded = JSON.parse(raw);
  } catch {
    throw new Error('book_surface_repair_input_encoding_invalid');
  }
  const decoded = decodePageContractRepairInput(encoded);
  const root = recordValue(decoded);
  if (!root) {
    throw new Error('book_surface_repair_input_encoding_invalid');
  }
  return root;
}

export function parseBookSurfaceRepairPatch(
  raw: string,
): BookSurfaceRepairPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('book_surface_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, [
      'coverContract',
      'recurringProps',
      'pageContracts',
    ]) ||
    !Array.isArray(root.recurringProps) ||
    !Array.isArray(root.pageContracts) ||
    root.pageContracts.length === 0
  ) {
    throw new Error('book_surface_repair_response_invalid_shape');
  }
  const coverContract = recordValue(root.coverContract);
  if (!coverContract || !exactKeys(coverContract, COVER_CONTRACT_KEYS)) {
    throw new Error('book_surface_repair_cover_invalid');
  }
  const recurringProps = root.recurringProps.map(recordValue);
  if (
    recurringProps.some(
      (value) =>
        !value ||
        !exactKeys(value, RECURRING_PROP_KEYS) ||
        typeof value.id !== 'string' ||
        value.id.trim().length === 0,
    )
  ) {
    throw new Error('book_surface_repair_prop_invalid');
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
    throw new Error('book_surface_repair_page_invalid');
  }
  return {
    coverContract,
    recurringProps: recurringProps as Record<string, unknown>[],
    pageContracts: pageContracts as Record<string, unknown>[],
  };
}

function maskedSurface(args: {
  draft: Record<string, unknown>;
  pageNumbers: ReadonlySet<number>;
}): unknown {
  const masked = structuredClone(args.draft);
  masked.coverContract = '__book_surface_target__';
  masked.recurringProps = '__book_surface_recurring_props_target__';
  masked.pageContracts = Array.isArray(masked.pageContracts)
    ? masked.pageContracts.map((value) => {
        const page = recordValue(value);
        return page &&
          positiveInteger(page.pageNumber) &&
          args.pageNumbers.has(page.pageNumber)
          ? {
              pageNumber: page.pageNumber,
              __bookSurfaceTarget: true,
            }
          : value;
      })
    : masked.pageContracts;
  return canonicalize(masked);
}

export function applyBookSurfaceRepairPatch(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): Record<string, unknown> {
  const pageNumbers = new Set(
    args.authority.affectedPages.map((value) => value.pageNumber),
  );
  const authorityPropIds = uniqueRecordIds(args.authority.recurringProps);
  const patchPropIds = uniqueRecordIds(args.patch.recurringProps);
  if (
    pageNumbers.size !== args.authority.affectedPages.length ||
    !authorityPropIds ||
    !patchPropIds ||
    patchPropIds.length !== authorityPropIds.length ||
    authorityPropIds.some((id) => !patchPropIds.includes(id)) ||
    args.patch.coverContract.worldType !==
      args.authority.referenceAuthority.worldType
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  if (
    !args.authority.repairRecurringProps &&
    JSON.stringify(canonicalize(args.patch.recurringProps)) !==
      JSON.stringify(canonicalize(args.authority.recurringProps))
  ) {
    throw new Error('book_surface_repair_prop_change_not_authorized');
  }
  const coverLocationId = args.patch.coverContract.locationId;
  const coverZoneId = args.patch.coverContract.zoneId;
  const coverZone = args.authority.referenceAuthority.zones.find(
    (value) => value.id === coverZoneId,
  );
  const coverCastIds = uniqueStrings(args.patch.coverContract.castIds);
  if (
    typeof coverLocationId !== 'string' ||
    typeof coverZoneId !== 'string' ||
    !coverZone ||
    coverZone.locationId !== coverLocationId ||
    !coverCastIds ||
    coverCastIds.some(
      (id) => !args.authority.referenceAuthority.castIds.includes(id),
    )
  ) {
    throw new Error('book_surface_repair_cover_reference_invalid');
  }
  const beforeMasked = maskedSurface({
    draft: args.draft,
    pageNumbers,
  });
  const pagesApplied = applyPageContractRepairs({
    draft: args.draft,
    affectedPages: args.authority.affectedPages,
    pageContracts: args.patch.pageContracts,
  });
  const result = structuredClone(pagesApplied);
  result.coverContract = structuredClone(args.patch.coverContract);
  const currentProps = Array.isArray(result.recurringProps)
    ? result.recurringProps.map(recordValue)
    : [];
  const currentPropIds = currentProps.some((value) => value === null)
    ? null
    : uniqueRecordIds(currentProps as Record<string, unknown>[]);
  if (
    !currentPropIds ||
    currentPropIds.length !== authorityPropIds.length ||
    authorityPropIds.some((id) => !currentPropIds.includes(id))
  ) {
    throw new Error('book_surface_repair_prop_target_stale');
  }
  const patchPropsById = new Map(
    args.patch.recurringProps.map((value) => [value.id as string, value]),
  );
  result.recurringProps = currentPropIds.map((id) =>
    structuredClone(patchPropsById.get(id)!),
  );
  const afterMasked = maskedSurface({ draft: result, pageNumbers });
  if (JSON.stringify(beforeMasked) !== JSON.stringify(afterMasked)) {
    throw new Error('book_surface_repair_non_target_drift');
  }
  return result;
}
