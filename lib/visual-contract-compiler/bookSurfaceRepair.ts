import { canonicalHash, canonicalize } from '@/lib/canonical-json';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import {
  decodePageContractRepairInput,
  encodePageContractRepairInput,
  pageContractRepairAffectedPages,
  type PageContractRepairAffectedPage,
} from './pageContractRepair';
import {
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA,
  parsePresentationRequirementRepairPatches,
  type PresentationRequirementRepairPatch,
  type PresentationRequirementRepairTarget,
} from './presentationRequirementRepair';
import {
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  type PresentationRequirementClass,
} from './actionSemanticCoverage';
import {
  TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
} from './templateDraftSchema';

export const BOOK_SURFACE_REPAIR_SCHEMA_VERSION =
  'book-surface-repair-schema/v4' as const;
export const BOOK_SURFACE_REPAIR_SCHEMA_NAME =
  'BookSurfaceRepairPatch' as const;
export const BOOK_SURFACE_REPAIR_PROMPT_VERSION =
  'book-surface-repair-prompt/v4' as const;
export const BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION =
  'book-surface-repair-user-prompt/v4' as const;

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

const PAGE_CONTRACT_PROPERTIES =
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA.properties as Record<
    string,
    unknown
  >;

const PAGE_CONTRACT_KEYS = Object.freeze(
  Object.keys(PAGE_CONTRACT_PROPERTIES),
);

const PAGE_STRUCTURAL_PATCH_KEYS = Object.freeze([
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
] as const);

const PAGE_STRUCTURAL_FIELD_KEYS = Object.freeze(
  PAGE_STRUCTURAL_PATCH_KEYS.filter(
    (key) =>
      key !== 'pageNumber' && key !== 'locationId' && key !== 'zoneId',
  ),
);

const PAGE_STRUCTURAL_PATCH_JSON_SCHEMA = strictObject(
  Object.fromEntries(
    PAGE_STRUCTURAL_PATCH_KEYS.map((key) => [
      key,
      PAGE_CONTRACT_PROPERTIES[key],
    ]),
  ),
);

const PRESENTATION_PATCHES_JSON_SCHEMA = (
  PRESENTATION_REQUIREMENT_REPAIR_JSON_SCHEMA.properties as Record<
    string,
    unknown
  >
).patches;

export const BOOK_SURFACE_REPAIR_JSON_SCHEMA: Record<string, unknown> =
  strictObject({
    presentationPatches: {
      ...(PRESENTATION_PATCHES_JSON_SCHEMA as Record<string, unknown>),
      minItems: 0,
    },
    coverContract: {
      anyOf: [
        TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA,
        { type: 'null' },
      ],
    },
    recurringProps: {
      anyOf: [
        {
          type: 'array',
          items: TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
        },
        { type: 'null' },
      ],
    },
    pageStructuralPatches: {
      type: 'array',
      minItems: 1,
      items: PAGE_STRUCTURAL_PATCH_JSON_SCHEMA,
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
const RECURRING_PROP_KEYS = Object.freeze(
  Object.keys(
    TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA.properties as Record<
      string,
      unknown
    >,
  ),
);

const RECURRING_PROP_IMMUTABLE_KEYS = Object.freeze(
  RECURRING_PROP_KEYS.filter((key) => key !== 'firstRevealPage'),
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
  sourceDraftDigest: string;
  coverContract: Record<string, unknown> | null;
  recurringProps: Record<string, unknown>[] | null;
  repairRecurringProps: boolean;
  presentationTargets: PresentationRequirementRepairTarget[];
  affectedPages: PageContractRepairAffectedPage[];
  coverValidationHints: string[];
  recurringPropValidationHints: string[];
  referenceAuthority: BookSurfaceReferenceAuthority;
}

export interface BookSurfaceRepairPatch {
  presentationPatches: PresentationRequirementRepairPatch[];
  coverContract: Record<string, unknown> | null;
  recurringProps: Record<string, unknown>[] | null;
  pageStructuralPatches: Record<string, unknown>[];
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

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function objectProjection(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function samePageMustShowValue(args: {
  pages: readonly (Record<string, unknown> | null)[];
  pageNumber: number;
  pointer: string;
}): string | null {
  const match =
    /^\/pageContracts\/(0|[1-9]\d*)\/mustShow\/(0|[1-9]\d*)$/.exec(
      args.pointer,
    );
  if (!match) return null;
  const page = args.pages[Number(match[1])];
  const mustShow = Array.isArray(page?.mustShow) ? page.mustShow : [];
  const value = mustShow[Number(match[2])];
  return page?.pageNumber === args.pageNumber && typeof value === 'string'
    ? value
    : null;
}

function presentationTargetKey(value: {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
}): string {
  return canonicalJson([
    value.pageNumber,
    value.coverageIndex,
    value.beatId,
    value.sourceEvidenceId,
  ]);
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

function presentationTargetsAreValidForDraft(args: {
  draft: Record<string, unknown>;
  targets: readonly PresentationRequirementRepairTarget[];
}): boolean {
  const pages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map((value, pageIndex) => ({
        page: recordValue(value),
        pageIndex,
      }))
    : [];
  if (pages.some(({ page }) => page === null)) return false;
  const seen = new Set<string>();
  for (const target of args.targets) {
    const key = presentationTargetKey(target);
    const matches = pages.filter(
      ({ page }) => page?.pageNumber === target.pageNumber,
    );
    if (
      seen.has(key) ||
      matches.length !== 1 ||
      !matches[0]?.page ||
      !positiveInteger(target.pageNumber) ||
      !Number.isSafeInteger(target.coverageIndex) ||
      target.coverageIndex < 0 ||
      typeof target.beatId !== 'string' ||
      target.beatId.length === 0 ||
      typeof target.sourceEvidenceId !== 'string' ||
      target.sourceEvidenceId.length === 0 ||
      typeof target.sourcePhrase !== 'string' ||
      target.sourcePhrase.length === 0 ||
      !Array.isArray(target.permittedPointerValues) ||
      target.permittedPointerValues.length === 0
    ) {
      return false;
    }
    seen.add(key);
    const matchedPage = matches[0].page;
    const coverage = Array.isArray(matchedPage.actionSemanticCoverage)
      ? matchedPage.actionSemanticCoverage
      : [];
    const coverageRecord = recordValue(coverage[target.coverageIndex]);
    const disposition = recordValue(coverageRecord?.disposition);
    const mustShow = Array.isArray(matchedPage.mustShow)
      ? matchedPage.mustShow
      : [];
    const exactPermittedPairs = mustShow
      .flatMap((value, index) =>
        typeof value === 'string' && value.trim().length > 0
          ? [
              {
                contractPointer: `/pageContracts/${matches[0]!.pageIndex}/mustShow/${index}`,
                contractValue: value,
              },
            ]
          : [],
      )
      .sort(
        (left, right) =>
          lexicalCompare(left.contractPointer, right.contractPointer) ||
          lexicalCompare(left.contractValue, right.contractValue),
      );
    const permittedPairs = new Set<string>();
    if (
      !coverageRecord ||
      coverageRecord.beatId !== target.beatId ||
      coverageRecord.sourceEvidenceId !== target.sourceEvidenceId ||
      disposition?.kind !== 'unsupported' ||
      disposition.reason !== 'closed_action_catalog_gap'
    ) {
      return false;
    }
    for (const permitted of target.permittedPointerValues) {
      if (
        typeof permitted.contractPointer !== 'string' ||
        permitted.contractPointer.length === 0 ||
        typeof permitted.contractValue !== 'string' ||
        permitted.contractValue.length === 0
      ) {
        return false;
      }
      const pairKey = canonicalJson([
        permitted.contractPointer,
        permitted.contractValue,
      ]);
      if (permittedPairs.has(pairKey)) return false;
      permittedPairs.add(pairKey);
    }
    if (
      !orderedValuesEqual(
        target.permittedPointerValues,
        exactPermittedPairs,
      )
    ) {
      return false;
    }
  }
  return true;
}

function pageStructuralProjection(
  pageContract: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    PAGE_STRUCTURAL_PATCH_KEYS.map((key) => [
      key,
      structuredClone(pageContract[key]),
    ]),
  );
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
    zoneAuthority.some(
      (value) => !locationIds.includes(value.locationId),
    ) ||
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
 * Selects only the closed book-surface family seen after a bounded repair:
 * cover/page final-structure failures and, when present, the exact
 * recurring-props lifecycle identity, optionally combined with closed
 * presentation gaps. The authority excludes every unrelated draft collection
 * and returns null on any mixture.
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
  if (pageIssueEntries.length === 0) return null;

  const affectedPages = pageContractRepairAffectedPages({
    draft: args.draft,
    diagnosticIssues: pageIssueEntries.map(({ issue }) => issue),
    validationMessages: pageIssueEntries.map(({ message }) => message),
  });
  const cleanedAffectedPages = affectedPages?.map((page) => {
    const validationHints = cleanValidationMessages(
      page.validationHints,
    );
    return validationHints
      ? {
          ...page,
          pageContract: objectProjection(
            page.pageContract,
            PAGE_CONTRACT_KEYS,
          ),
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
  const coverContract = coverIssueSeen
    ? recordValue(args.authorityDraft.coverContract)
    : null;
  const recurringProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  const coverValidationHints = cleanValidationMessages(
    coverIssueEntries.map(({ message }) => message),
    { allowEmpty: !coverIssueSeen },
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
    !presentationTargetsAreValidForDraft({
      draft: args.draft,
      targets: args.presentationTargets,
    }) ||
    affectedPageValidationHintCount === undefined ||
    !cleanedAffectedPages ||
    cleanedAffectedPages.some((page) => page === null) ||
    !coverValidationHints ||
    (coverIssueSeen &&
      (!coverContract ||
        !exactKeys(coverContract, COVER_CONTRACT_KEYS) ||
        coverValidationHints.length === 0)) ||
    (!coverIssueSeen &&
      (coverContract !== null || coverValidationHints.length > 0)) ||
    !recurringPropValidationHints ||
    (repairRecurringProps && recurringPropValidationHints.length === 0) ||
    (!repairRecurringProps && recurringPropValidationHints.length > 0) ||
    !refs ||
    !recurringPropIds ||
    JSON.stringify([...recurringPropIds].sort()) !==
      JSON.stringify(refs.recurringPropIds)
  ) {
    return null;
  }
  return {
    sourceDraftDigest: canonicalHash(args.draft),
    coverContract:
      coverContract === null ? null : structuredClone(coverContract),
    recurringProps: repairRecurringProps
      ? structuredClone(typedRecurringProps)
      : null,
    repairRecurringProps,
    presentationTargets: args.presentationTargets.map((target) =>
      structuredClone(target),
    ),
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
    'Repair one closed book surface atomically: exact presentation dispositions, the cover only when coverAuthority is non-null, recurring props only when recurringPropAuthority is non-null, and only the structural page fields supplied by affectedPages.',
    'Decode the compact input exactly: ["s",i] references stringDictionary[i], ["a",...items] is an array, and ["o",i,...values] is an object whose ordered keys are objectShapes[i].',
    'The decoded root contains presentationTargets, nullable coverAuthority and recurringPropAuthority, affectedPages with exact structural projections/targets/validationHints, and referenceAuthority.',
    'Return presentationPatches in the exact target order, coverContract or null exactly as authorized, recurringProps or null exactly as authorized, and pageStructuralPatches in the exact affected-page order.',
    'Every pageStructuralPatch must copy pageNumber, locationId, and zoneId exactly and may repair only sameLocationAs, mustShow, mustNotShow, propState, propConstraints, actionRequirements, camera, and transition.',
    'Never return actionSemanticCoverage. For each presentation target, copy its identities and one exact permitted contractPointer. Preserve the selected mustShow item exactly through structural repair; the compiler verifies that exact permitted pointer/value pair and resolves contractValue locally.',
    'When recurringPropAuthority is non-null, preserve the exact recurring-prop ID order and resolve only its listed lifecycle invariant. Otherwise return recurringProps:null.',
    'When coverAuthority is non-null, use only IDs and worldType present in referenceAuthority and resolve its listed validation hints. Otherwise return coverContract:null.',
    'Preserve all valid semantics. Never infer or return unrelated page or global fields.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildBookSurfaceRepairUserPrompt(args: {
  authority: BookSurfaceRepairAuthority;
}): string {
  const payload = {
    presentationTargets: args.authority.presentationTargets.map(
      (target) => structuredClone(target),
    ),
    coverAuthority:
      args.authority.coverContract === null
        ? null
        : {
            coverContract: structuredClone(
              args.authority.coverContract,
            ),
            validationHints: [
              ...args.authority.coverValidationHints,
            ],
          },
    recurringPropAuthority:
      !args.authority.repairRecurringProps ||
      args.authority.recurringProps === null
        ? null
        : {
            recurringProps: structuredClone(
              args.authority.recurringProps,
            ),
            validationHints: [
              ...args.authority.recurringPropValidationHints,
            ],
          },
    affectedPages: args.authority.affectedPages.map((value) => ({
      pageNumber: value.pageNumber,
      pageStructuralProjection: pageStructuralProjection(
        value.pageContract,
      ),
      repairTargets: structuredClone(value.repairTargets),
      validationHints: [...value.validationHints],
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
      'presentationPatches',
      'coverContract',
      'recurringProps',
      'pageStructuralPatches',
    ]) ||
    !Array.isArray(root.presentationPatches) ||
    !Array.isArray(root.pageStructuralPatches) ||
    root.pageStructuralPatches.length === 0 ||
    (root.coverContract !== null &&
      recordValue(root.coverContract) === null) ||
    (root.recurringProps !== null &&
      !Array.isArray(root.recurringProps))
  ) {
    throw new Error('book_surface_repair_response_invalid_shape');
  }
  const presentationPatches =
    parsePresentationRequirementRepairPatches(
      JSON.stringify({ patches: root.presentationPatches }),
    );
  const coverContract =
    root.coverContract === null
      ? null
      : recordValue(root.coverContract);
  if (
    coverContract !== null &&
    !exactKeys(coverContract, COVER_CONTRACT_KEYS)
  ) {
    throw new Error('book_surface_repair_cover_invalid');
  }
  const recurringProps =
    root.recurringProps === null
      ? null
      : root.recurringProps.map(recordValue);
  if (
    recurringProps?.some(
      (value) =>
        !value ||
        !exactKeys(value, RECURRING_PROP_KEYS) ||
        typeof value.id !== 'string' ||
        value.id.trim().length === 0,
    )
  ) {
    throw new Error('book_surface_repair_prop_invalid');
  }
  const pageStructuralPatches =
    root.pageStructuralPatches.map(recordValue);
  if (
    pageStructuralPatches.some(
      (value) =>
        !value ||
        !exactKeys(value, PAGE_STRUCTURAL_PATCH_KEYS) ||
        !positiveInteger(value.pageNumber) ||
        typeof value.locationId !== 'string' ||
        value.locationId.trim().length === 0 ||
        typeof value.zoneId !== 'string' ||
        value.zoneId.trim().length === 0 ||
        (value.sameLocationAs !== null &&
          typeof value.sameLocationAs !== 'number') ||
        !Array.isArray(value.mustShow) ||
        value.mustShow.some((entry) => typeof entry !== 'string') ||
        !Array.isArray(value.mustNotShow) ||
        !Array.isArray(value.propState) ||
        !Array.isArray(value.propConstraints) ||
        !Array.isArray(value.actionRequirements) ||
        typeof value.camera !== 'string' ||
        recordValue(value.transition) === null,
    )
  ) {
    throw new Error('book_surface_repair_page_invalid');
  }
  return {
    presentationPatches,
    coverContract,
    recurringProps:
      recurringProps as Record<string, unknown>[] | null,
    pageStructuralPatches:
      pageStructuralPatches as Record<string, unknown>[],
  };
}

function maskedSurface(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
}): unknown {
  const structuralPageNumbers = new Set(
    args.authority.affectedPages.map((page) => page.pageNumber),
  );
  const presentationByPage = new Map<
    number,
    PresentationRequirementRepairTarget[]
  >();
  for (const target of args.authority.presentationTargets) {
    const pageTargets = presentationByPage.get(target.pageNumber) ?? [];
    pageTargets.push(target);
    presentationByPage.set(target.pageNumber, pageTargets);
  }
  const masked: Record<string, unknown> = { ...args.draft };
  if (args.authority.coverContract !== null) {
    masked.coverContract = '__book_surface_cover_target__';
  }
  if (args.authority.repairRecurringProps) {
    masked.recurringProps = Array.isArray(args.draft.recurringProps)
      ? args.draft.recurringProps.map((value) => {
          const prop = recordValue(value);
          return prop
            ? {
                ...prop,
                firstRevealPage:
                  '__book_surface_recurring_prop_lifecycle_target__',
              }
            : value;
        })
      : args.draft.recurringProps;
  }
  masked.pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map((value) => {
        const page = recordValue(value);
        if (!page || !positiveInteger(page.pageNumber)) return value;
        const presentationTargets =
          presentationByPage.get(page.pageNumber) ?? [];
        if (
          !structuralPageNumbers.has(page.pageNumber) &&
          presentationTargets.length === 0
        ) {
          return value;
        }
        const maskedPage: Record<string, unknown> = { ...page };
        if (structuralPageNumbers.has(page.pageNumber)) {
          for (const key of PAGE_STRUCTURAL_FIELD_KEYS) {
            if (key === 'mustShow' && presentationTargets.length > 0) {
              continue;
            }
            maskedPage[key] = '__book_surface_page_structural_target__';
          }
        }
        if (presentationTargets.length > 0) {
          const targetIndexes = new Set(
            presentationTargets.map((target) => target.coverageIndex),
          );
          maskedPage.actionSemanticCoverage = Array.isArray(
            page.actionSemanticCoverage,
          )
            ? page.actionSemanticCoverage.map((coverageValue, index) => {
                if (!targetIndexes.has(index)) return coverageValue;
                const coverage = recordValue(coverageValue);
                return coverage
                  ? {
                      ...coverage,
                      disposition:
                        '__book_surface_presentation_target__',
                    }
                  : coverageValue;
              })
            : page.actionSemanticCoverage;
        }
        return maskedPage;
      })
    : args.draft.pageContracts;
  return canonicalize(masked);
}

function orderedValuesEqual(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function validatePresentationAuthorityAndPatches(args: {
  draft: Record<string, unknown>;
  targets: readonly PresentationRequirementRepairTarget[];
  patches: readonly PresentationRequirementRepairPatch[];
}): void {
  if (
    !presentationTargetsAreValidForDraft({
      draft: args.draft,
      targets: args.targets,
    }) ||
    args.targets.length !== args.patches.length ||
    !orderedValuesEqual(
      args.targets.map(presentationTargetKey),
      args.patches.map(presentationTargetKey),
    )
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  for (let index = 0; index < args.targets.length; index += 1) {
    const target = args.targets[index]!;
    const patch = args.patches[index]!;
    if (
      !PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
        patch.presentationClass as PresentationRequirementClass,
      ) ||
      !target.permittedPointerValues.some(
        (permitted) =>
          permitted.contractPointer === patch.contractPointer,
      )
    ) {
      throw new Error(
        'presentation_requirement_repair_pointer_not_permitted',
      );
    }
  }
}

function validatePageAuthorityAndPatches(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  patches: readonly Record<string, unknown>[];
}): void {
  const pageNumbers = args.authority.affectedPages.map(
    (page) => page.pageNumber,
  );
  if (
    pageNumbers.length === 0 ||
    new Set(pageNumbers).size !== pageNumbers.length ||
    args.patches.length !== pageNumbers.length ||
    !orderedValuesEqual(
      pageNumbers,
      args.patches.map((patch) => patch.pageNumber),
    )
  ) {
    throw new Error('page_contract_repair_patch_set_incomplete');
  }
  const draftPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  for (let index = 0; index < pageNumbers.length; index += 1) {
    const affectedPage = args.authority.affectedPages[index]!;
    const patch = args.patches[index]!;
    const authorityPage = affectedPage.pageContract;
    const matches = draftPages.filter(
      (page) => page?.pageNumber === affectedPage.pageNumber,
    );
    if (
      matches.length !== 1 ||
      !matches[0] ||
      !exactKeys(authorityPage, PAGE_CONTRACT_KEYS) ||
      authorityPage.pageNumber !== affectedPage.pageNumber ||
      affectedPage.repairTargets.length !== 1 ||
      affectedPage.repairTargets.some(
        (target) =>
          target.code !== 'final_structural_invariant_invalid' ||
          target.pageNumber !== affectedPage.pageNumber,
      ) ||
      patch.locationId !== authorityPage.locationId ||
      patch.zoneId !== authorityPage.zoneId ||
      matches[0].locationId !== authorityPage.locationId ||
      matches[0].zoneId !== authorityPage.zoneId
    ) {
      throw new Error('book_surface_repair_authority_mismatch');
    }
  }
}

function validateCoverAuthorityAndPatch(args: {
  authority: BookSurfaceRepairAuthority;
  patch: Record<string, unknown> | null;
}): void {
  if ((args.authority.coverContract === null) !== (args.patch === null)) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  if (args.patch === null) return;
  if (
    !args.authority.coverContract ||
    !exactKeys(args.authority.coverContract, COVER_CONTRACT_KEYS)
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  const coverLocationId = args.patch.locationId;
  const coverZoneId = args.patch.zoneId;
  const coverZone = args.authority.referenceAuthority.zones.find(
    (value) => value.id === coverZoneId,
  );
  const coverCastIds = uniqueStrings(args.patch.castIds);
  if (
    args.patch.worldType !==
      args.authority.referenceAuthority.worldType ||
    typeof coverLocationId !== 'string' ||
    typeof coverZoneId !== 'string' ||
    !args.authority.referenceAuthority.locationIds.includes(
      coverLocationId,
    ) ||
    !coverZone ||
    coverZone.locationId !== coverLocationId ||
    !coverCastIds ||
    coverCastIds.some(
      (id) => !args.authority.referenceAuthority.castIds.includes(id),
    )
  ) {
    throw new Error('book_surface_repair_cover_reference_invalid');
  }
}

function validateRecurringPropAuthorityAndPatch(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  patch: readonly Record<string, unknown>[] | null;
}): void {
  if (
    args.authority.repairRecurringProps !==
      (args.authority.recurringProps !== null) ||
    args.authority.repairRecurringProps !== (args.patch !== null)
  ) {
    throw new Error('book_surface_repair_prop_change_not_authorized');
  }
  const currentProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  const currentPropIds = currentProps.some((value) => value === null)
    ? null
    : uniqueRecordIds(currentProps as Record<string, unknown>[]);
  if (
    !currentPropIds ||
    !orderedValuesEqual(
      [...currentPropIds].sort(lexicalCompare),
      args.authority.referenceAuthority.recurringPropIds,
    )
  ) {
    throw new Error('book_surface_repair_prop_target_stale');
  }
  if (args.patch === null || args.authority.recurringProps === null) {
    return;
  }
  if (
    args.authority.recurringProps.some(
      (value) => !exactKeys(value, RECURRING_PROP_KEYS),
    )
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  const authorityPropIds = uniqueRecordIds(
    args.authority.recurringProps,
  );
  const patchPropIds = uniqueRecordIds(args.patch);
  if (
    !authorityPropIds ||
    !patchPropIds ||
    !orderedValuesEqual(currentPropIds, authorityPropIds) ||
    !orderedValuesEqual(authorityPropIds, patchPropIds)
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  for (let index = 0; index < args.patch.length; index += 1) {
    const current = currentProps[index]!;
    const authority = args.authority.recurringProps[index]!;
    const patch = args.patch[index]!;
    const currentImmutable = objectProjection(
      current!,
      RECURRING_PROP_IMMUTABLE_KEYS,
    );
    if (
      canonicalJson(currentImmutable) !==
        canonicalJson(
          objectProjection(authority, RECURRING_PROP_IMMUTABLE_KEYS),
        ) ||
      canonicalJson(currentImmutable) !==
        canonicalJson(
          objectProjection(patch, RECURRING_PROP_IMMUTABLE_KEYS),
        )
    ) {
      throw new Error('book_surface_repair_non_target_drift');
    }
  }
}

export function applyBookSurfaceRepairPatch(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): Record<string, unknown> {
  if (
    typeof args.authority.sourceDraftDigest !== 'string' ||
    canonicalHash(args.draft) !== args.authority.sourceDraftDigest
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  let validatedPatch: BookSurfaceRepairPatch;
  try {
    validatedPatch = parseBookSurfaceRepairPatch(
      JSON.stringify(args.patch),
    );
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('book_surface_repair_response_invalid_shape');
  }
  validatePresentationAuthorityAndPatches({
    draft: args.draft,
    targets: args.authority.presentationTargets,
    patches: validatedPatch.presentationPatches,
  });
  validatePageAuthorityAndPatches({
    draft: args.draft,
    authority: args.authority,
    patches: validatedPatch.pageStructuralPatches,
  });
  validateCoverAuthorityAndPatch({
    authority: args.authority,
    patch: validatedPatch.coverContract,
  });
  validateRecurringPropAuthorityAndPatch({
    draft: args.draft,
    authority: args.authority,
    patch: validatedPatch.recurringProps,
  });

  const beforeMasked = maskedSurface({
    draft: args.draft,
    authority: args.authority,
  });
  const atomic = structuredClone({
    draft: args.draft,
    patch: validatedPatch,
  });
  const result = atomic.draft;
  const patch = atomic.patch;
  const resultPages = Array.isArray(result.pageContracts)
    ? result.pageContracts.map(recordValue)
    : [];
  const presentationPageNumbers = new Set(
    args.authority.presentationTargets.map((target) => target.pageNumber),
  );
  for (const pagePatch of patch.pageStructuralPatches) {
    const page = resultPages.find(
      (candidate) => candidate?.pageNumber === pagePatch.pageNumber,
    )!;
    for (const key of PAGE_STRUCTURAL_FIELD_KEYS) {
      if (
        key === 'mustShow' &&
        positiveInteger(pagePatch.pageNumber) &&
        presentationPageNumbers.has(pagePatch.pageNumber)
      ) {
        continue;
      }
      page[key] = pagePatch[key];
    }
  }
  const presentationSelections = patch.presentationPatches.map(
    (presentationPatch, index) => {
      const target = args.authority.presentationTargets[index]!;
      const selection = target.permittedPointerValues.find(
        (permitted) =>
          permitted.contractPointer ===
          presentationPatch.contractPointer,
      )!;
      if (
        samePageMustShowValue({
          pages: resultPages,
          pageNumber: presentationPatch.pageNumber,
          pointer: presentationPatch.contractPointer,
        }) !== selection.contractValue
      ) {
        throw new Error('presentation_requirement_repair_target_stale');
      }
      return selection;
    },
  );
  for (let index = 0; index < patch.presentationPatches.length; index += 1) {
    const presentationPatch = patch.presentationPatches[index]!;
    const page = resultPages.find(
      (candidate) =>
        candidate?.pageNumber === presentationPatch.pageNumber,
    )!;
    const coverage = page.actionSemanticCoverage as unknown[];
    const coverageRecord = recordValue(
      coverage[presentationPatch.coverageIndex],
    )!;
    const selection = presentationSelections[index]!;
    coverageRecord.disposition = {
      kind: 'presentation_requirement',
      presentationClass: presentationPatch.presentationClass,
      contractPointer: presentationPatch.contractPointer,
      contractValue: selection.contractValue,
    };
  }
  if (patch.coverContract !== null) {
    result.coverContract = patch.coverContract;
  }
  if (patch.recurringProps !== null) {
    result.recurringProps = patch.recurringProps;
  }

  const afterMasked = maskedSurface({
    draft: result,
    authority: args.authority,
  });
  if (canonicalJson(beforeMasked) !== canonicalJson(afterMasked)) {
    throw new Error('book_surface_repair_non_target_drift');
  }
  return result;
}
