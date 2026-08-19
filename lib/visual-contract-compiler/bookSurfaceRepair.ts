import { canonicalHash, canonicalize } from '@/lib/canonical-json';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
  type PageFinalStructuralCause,
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
  CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
  withTemplateDraftActionRequirementDefinitions,
} from './templateDraftSchema';
import { SOURCE_EVIDENCE_ID_PATTERN } from './sourceEvidenceCatalog';
import {
  classifyPagePropConstraints,
  pagePropConstraintViolationsAreValid,
  type PagePropConstraintViolation,
} from './pagePropConstraintValidation';

export const BOOK_SURFACE_REPAIR_SCHEMA_VERSION =
  'book-surface-repair-schema/v6' as const;
export const BOOK_SURFACE_REPAIR_SCHEMA_NAME =
  'BookSurfaceRepairPatch' as const;
export const BOOK_SURFACE_REPAIR_PROMPT_VERSION =
  'book-surface-repair-prompt/v11' as const;
export const BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION =
  'book-surface-repair-user-prompt/v11' as const;

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
  CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA.properties as Record<
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

export const BOOK_SURFACE_WRITABLE_PAGE_FIELD_VALUES = [
  'mustShow',
  'mustNotShow',
  'propState',
  'propConstraints',
  'actionRequirements',
  'camera',
  'transition',
] as const;

export type BookSurfaceWritablePageField =
  (typeof BOOK_SURFACE_WRITABLE_PAGE_FIELD_VALUES)[number];

const PAGE_CAUSE_WRITABLE_FIELDS: Record<
  PageFinalStructuralCause,
  readonly BookSurfaceWritablePageField[] | null
> = {
  page_spatial_binding_invalid: null,
  page_steering_invalid: ['mustShow', 'mustNotShow', 'camera'],
  page_character_presence_invalid: null,
  page_prop_state_invalid: ['propState'],
  page_cast_state_invalid: null,
  page_prop_constraints_invalid: ['propConstraints'],
  page_action_requirements_invalid: ['actionRequirements'],
  page_safety_constraints_invalid: null,
  page_action_constraint_conflict_invalid: ['actionRequirements'],
  page_action_check_id_collision_invalid: ['actionRequirements'],
  page_prop_check_id_collision_invalid: ['propConstraints'],
  page_safety_check_id_collision_invalid: null,
  page_projection_containment_invalid: null,
  page_cast_binding_invalid: null,
  page_human_presence_binding_invalid: null,
  page_transition_invalid: ['transition'],
};

const PAGE_STRUCTURAL_PATCH_JSON_SCHEMA = strictObject(
  Object.fromEntries(
    PAGE_STRUCTURAL_PATCH_KEYS.map((key) => [
      key,
      key === 'pageNumber' || key === 'sameLocationAs'
        ? PAGE_CONTRACT_PROPERTIES[key]
        : {
            anyOf: [
              PAGE_CONTRACT_PROPERTIES[key],
              { type: 'null' },
            ],
          },
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
  withTemplateDraftActionRequirementDefinitions(strictObject({
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
  }));

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

export interface BookSurfaceActionBindingAuthority {
  actionIndex: number;
  beatId: string;
  coverageIndex: number;
  sourceEvidenceId: string;
}

export interface BookSurfacePageReadOnlyContext {
  castIds: string[];
  characterPresence: {
    child: boolean;
    companion: boolean;
  };
  anchorIds: string[];
  spatialReferenceIds: string[];
  safetyConstraints: Array<{
    subjectId: string;
    relation: string;
    target: { kind: string; id: string };
  }>;
  actionBindingAuthority: BookSurfaceActionBindingAuthority[];
  preRevealPropObligations: Array<{
    propId: string;
    firstRevealPage: number;
  }>;
  transitionTopology: {
    previous: { pageNumber: number; zoneId: string } | null;
    current: { pageNumber: number; zoneId: string };
    next: { pageNumber: number; zoneId: string } | null;
  } | null;
}

export interface BookSurfaceRecurringPropLifecycleContext {
  propId: string;
  currentFirstRevealPage: number | null;
  forbiddenPageNumbers: number[];
  requiredPageNumbers: number[];
}

export interface BookSurfaceRepairAffectedPage
  extends PageContractRepairAffectedPage {
  writableFields: BookSurfaceWritablePageField[];
  readOnlyContext: BookSurfacePageReadOnlyContext;
  propConstraintViolations: PagePropConstraintViolation[];
}

export interface BookSurfaceRepairAuthority {
  authorityDigest: string;
  sourceDraftDigest: string;
  coverContract: Record<string, unknown> | null;
  recurringProps: Record<string, unknown>[] | null;
  recurringPropLifecycleContext: BookSurfaceRecurringPropLifecycleContext[];
  repairRecurringProps: boolean;
  presentationTargets: PresentationRequirementRepairTarget[];
  affectedPages: BookSurfaceRepairAffectedPage[];
  coverValidationHints: string[];
  recurringPropValidationHints: string[];
  referenceAuthority: BookSurfaceReferenceAuthority;
}

type BookSurfaceRepairAuthorityContent = Omit<
  BookSurfaceRepairAuthority,
  'authorityDigest'
>;

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

function pageHasPropConstraintRepairCause(
  page: Pick<PageContractRepairAffectedPage, 'repairTargets'>,
): boolean {
  return page.repairTargets.some(
    (target) =>
      target.code === 'final_structural_invariant_invalid' &&
      target.causes.includes('page_prop_constraints_invalid'),
  );
}

function expectedPagePropConstraintViolations(args: {
  pageContract: Record<string, unknown>;
  repairTargets: PageContractRepairAffectedPage['repairTargets'];
  recurringPropIds: readonly string[];
  anchorIds: readonly string[];
}): PagePropConstraintViolation[] | null {
  if (
    !pageHasPropConstraintRepairCause({
      repairTargets: args.repairTargets,
    })
  ) {
    return [];
  }
  const result = classifyPagePropConstraints({
    propConstraints: args.pageContract.propConstraints,
    propIds: new Set(args.recurringPropIds),
    anchorIds: new Set(args.anchorIds),
  }).violations;
  return result.length > 0 &&
    result.length <= MAX_VALIDATION_MESSAGES &&
    pagePropConstraintViolationsAreValid(result)
    ? result
    : null;
}

function affectedPagePropConstraintAuthorityIsCurrent(args: {
  page: BookSurfaceRepairAffectedPage;
  recurringPropIds: readonly string[];
  pageContract?: Record<string, unknown>;
  anchorIds?: readonly string[];
}): boolean {
  const expected = expectedPagePropConstraintViolations({
    pageContract: args.pageContract ?? args.page.pageContract,
    repairTargets: args.page.repairTargets,
    recurringPropIds: args.recurringPropIds,
    anchorIds: args.anchorIds ?? args.page.readOnlyContext.anchorIds,
  });
  return (
    expected !== null &&
    pagePropConstraintViolationsAreValid(
      args.page.propConstraintViolations,
    ) &&
    canonicalJson(expected) ===
      canonicalJson(args.page.propConstraintViolations)
  );
}

function bookSurfaceRepairAuthorityIsIntact(
  authority: BookSurfaceRepairAuthority,
): boolean {
  const { authorityDigest, ...content } = authority;
  return (
    /^[a-f0-9]{64}$/.test(authorityDigest) &&
    canonicalHash(content) === authorityDigest
  );
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

function anchorIdsForPageContract(args: {
  draft: Record<string, unknown>;
  pageContract: Record<string, unknown>;
}): string[] | null {
  if (typeof args.pageContract.locationId !== 'string') return null;
  const locations = Array.isArray(args.draft.locations)
    ? args.draft.locations.map(recordValue)
    : [];
  const matches = locations.filter(
    (location) => location?.id === args.pageContract.locationId,
  );
  if (matches.length !== 1 || !matches[0]) return null;
  const anchors =
    matches[0].anchors === undefined
      ? []
      : Array.isArray(matches[0].anchors)
        ? matches[0].anchors.map(recordValue)
        : [null];
  const anchorIds = anchors.flatMap((anchor) =>
    typeof anchor?.id === 'string' ? [anchor.id] : [],
  );
  return anchors.some((anchor) => anchor === null) ||
    anchorIds.length !== anchors.length ||
    new Set(anchorIds).size !== anchorIds.length
    ? null
    : [...anchorIds].sort(lexicalCompare);
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
  writableFields: readonly BookSurfaceWritablePageField[],
): Record<string, unknown> {
  const projectedKeys = new Set<string>([
    'pageNumber',
    'locationId',
    'zoneId',
    ...writableFields,
  ]);
  return Object.fromEntries(
    PAGE_STRUCTURAL_PATCH_KEYS.filter((key) =>
      projectedKeys.has(key),
    ).map((key) => [key, structuredClone(pageContract[key])]),
  );
}

function providerReadOnlyContext(
  value: BookSurfacePageReadOnlyContext,
): Record<string, unknown> {
  return {
    castIds: [...value.castIds],
    characterPresence: structuredClone(value.characterPresence),
    anchorIds: [...value.anchorIds],
    spatialReferenceIds: [...value.spatialReferenceIds],
    safetyConstraints: structuredClone(value.safetyConstraints),
    actionBindingAuthority: value.actionBindingAuthority.map(
      ({ actionIndex, beatId }) => ({ actionIndex, beatId }),
    ),
    preRevealPropObligations: structuredClone(
      value.preRevealPropObligations,
    ),
    transitionTopology: structuredClone(value.transitionTopology),
  };
}

function buildRecurringPropLifecycleContext(args: {
  recurringProps: readonly Record<string, unknown>[];
  pages: readonly Record<string, unknown>[];
}): BookSurfaceRecurringPropLifecycleContext[] | null {
  const pageNumbers = args.pages.map((page) => page.pageNumber);
  if (
    pageNumbers.some((pageNumber) => !positiveInteger(pageNumber)) ||
    new Set(pageNumbers).size !== pageNumbers.length
  ) {
    return null;
  }
  const constraintsByPage = new Map<
    number,
    Array<{ propId: string; visibility: 'forbidden' | 'required' }>
  >();
  for (const page of args.pages) {
    if (!Array.isArray(page.propConstraints)) return null;
    const constraints = page.propConstraints.flatMap((value) => {
      const constraint = recordValue(value);
      return constraint &&
        typeof constraint.propId === 'string' &&
        constraint.propId.length > 0 &&
        (constraint.visibility === 'forbidden' ||
          constraint.visibility === 'required')
        ? [{
            propId: constraint.propId,
            visibility: constraint.visibility as 'forbidden' | 'required',
          }]
        : [];
    });
    if (constraints.length !== page.propConstraints.length) return null;
    constraintsByPage.set(page.pageNumber as number, constraints);
  }
  const seenPropIds = new Set<string>();
  const context: BookSurfaceRecurringPropLifecycleContext[] = [];
  for (const prop of args.recurringProps) {
    if (
      typeof prop.id !== 'string' ||
      prop.id.length === 0 ||
      seenPropIds.has(prop.id) ||
      (prop.firstRevealPage !== null &&
        prop.firstRevealPage !== undefined &&
        typeof prop.firstRevealPage !== 'number')
    ) {
      return null;
    }
    seenPropIds.add(prop.id);
    const forbiddenPageNumbers: number[] = [];
    const requiredPageNumbers: number[] = [];
    for (const pageNumber of [...(pageNumbers as number[])].sort(
      (left, right) => left - right,
    )) {
      for (const constraint of constraintsByPage.get(pageNumber) ?? []) {
        if (constraint.propId !== prop.id) continue;
        (constraint.visibility === 'forbidden'
          ? forbiddenPageNumbers
          : requiredPageNumbers
        ).push(pageNumber);
      }
    }
    context.push({
      propId: prop.id,
      currentFirstRevealPage:
        typeof prop.firstRevealPage === 'number'
          ? prop.firstRevealPage
          : null,
      forbiddenPageNumbers: [...new Set(forbiddenPageNumbers)],
      requiredPageNumbers: [...new Set(requiredPageNumbers)],
    });
  }
  return context;
}

function writableFieldsForAffectedPage(args: {
  page: PageContractRepairAffectedPage;
  presentationTargets: readonly PresentationRequirementRepairTarget[];
}): BookSurfaceWritablePageField[] | null {
  if (
    args.page.repairTargets.length !== 1 ||
    args.page.repairTargets[0]?.code !==
      'final_structural_invariant_invalid'
  ) {
    return null;
  }
  const allowed = new Set<BookSurfaceWritablePageField>();
  for (const cause of args.page.repairTargets[0].causes) {
    const fields = PAGE_CAUSE_WRITABLE_FIELDS[cause];
    if (!fields) return null;
    fields.forEach((field) => allowed.add(field));
  }
  const presentationTargeted = args.presentationTargets.some(
    (target) => target.pageNumber === args.page.pageNumber,
  );
  if (presentationTargeted) {
    const currentMustShow = args.page.pageContract.mustShow;
    if (
      allowed.has('mustShow') &&
      (!Array.isArray(currentMustShow) ||
        currentMustShow.some(
          (value) =>
            typeof value !== 'string' || value.trim().length === 0,
        ))
    ) {
      return null;
    }
    allowed.delete('mustShow');
  }
  const result = BOOK_SURFACE_WRITABLE_PAGE_FIELD_VALUES.filter(
    (field) => allowed.has(field),
  );
  return result.length > 0 ? [...result] : null;
}

function pageReadOnlyContext(args: {
  draft: Record<string, unknown>;
  authorityDraft: Record<string, unknown>;
  pageNumber: number;
  includeTransitionTopology: boolean;
}): BookSurfacePageReadOnlyContext | null {
  const draftPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const authorityPages = Array.isArray(args.authorityDraft.pageContracts)
    ? args.authorityDraft.pageContracts.map(recordValue)
    : [];
  const draftMatches = draftPages.filter(
    (page) => page?.pageNumber === args.pageNumber,
  );
  const authorityMatches = authorityPages.filter(
    (page) => page?.pageNumber === args.pageNumber,
  );
  if (
    draftMatches.length !== 1 ||
    authorityMatches.length !== 1 ||
    !draftMatches[0] ||
    !authorityMatches[0]
  ) {
    return null;
  }
  const draftPage = draftMatches[0];
  const authorityPage = authorityMatches[0];
  const castIds = uniqueStrings(authorityPage.castIds);
  const characterPresence = recordValue(
    authorityPage.characterPresence,
  );
  if (
    !castIds ||
    castIds.length === 0 ||
    !characterPresence ||
    typeof characterPresence.child !== 'boolean' ||
    typeof characterPresence.companion !== 'boolean'
  ) {
    return null;
  }

  const locationId = authorityPage.locationId;
  const zoneId = authorityPage.zoneId;
  if (typeof locationId !== 'string' || typeof zoneId !== 'string') {
    return null;
  }
  const locations = Array.isArray(args.authorityDraft.locations)
    ? args.authorityDraft.locations.map(recordValue)
    : [];
  const zones = Array.isArray(args.authorityDraft.zones)
    ? args.authorityDraft.zones.map(recordValue)
    : [];
  const locationMatches = locations.filter(
    (location) => location?.id === locationId,
  );
  const zoneMatches = zones.filter((zone) => zone?.id === zoneId);
  if (
    locationMatches.length !== 1 ||
    zoneMatches.length !== 1 ||
    !locationMatches[0] ||
    !zoneMatches[0]
  ) {
    return null;
  }
  const anchors =
    locationMatches[0].anchors === undefined
      ? []
      : Array.isArray(locationMatches[0].anchors)
        ? locationMatches[0].anchors.map(recordValue)
        : [null];
  const spatialNodes =
    zoneMatches[0].spatialNodes === undefined
      ? []
      : Array.isArray(zoneMatches[0].spatialNodes)
        ? zoneMatches[0].spatialNodes.map(recordValue)
        : [null];
  const anchorIds = anchors.flatMap((anchor) =>
    typeof anchor?.id === 'string' ? [anchor.id] : [],
  );
  const spatialReferenceIds = spatialNodes.flatMap((node) =>
    typeof node?.id === 'string' ? [node.id] : [],
  );
  if (
    anchors.some((anchor) => anchor === null) ||
    spatialNodes.some((node) => node === null) ||
    anchorIds.length !== anchors.length ||
    spatialReferenceIds.length !== spatialNodes.length ||
    new Set(anchorIds).size !== anchorIds.length ||
    new Set(spatialReferenceIds).size !== spatialReferenceIds.length
  ) {
    return null;
  }

  const safetyValues =
    authorityPage.safetyConstraints === undefined
      ? []
      : Array.isArray(authorityPage.safetyConstraints)
        ? authorityPage.safetyConstraints.map(recordValue)
        : [null];
  const safetyConstraints = safetyValues.flatMap((value) => {
    const target = recordValue(value?.target);
    return value &&
      typeof value.subjectId === 'string' &&
      typeof value.relation === 'string' &&
      target &&
      typeof target.kind === 'string' &&
      typeof target.id === 'string'
      ? [{
          subjectId: value.subjectId,
          relation: value.relation,
          target: { kind: target.kind, id: target.id },
        }]
      : [];
  });
  if (safetyConstraints.length !== safetyValues.length) return null;

  const actions = Array.isArray(draftPage.actionRequirements)
    ? draftPage.actionRequirements.map(recordValue)
    : [];
  const coverage = Array.isArray(draftPage.actionSemanticCoverage)
    ? draftPage.actionSemanticCoverage.map(recordValue)
    : [];
  if (
    actions.some((action) => action === null) ||
    coverage.some((record) => record === null)
  ) {
    return null;
  }
  const actionBindingAuthority: BookSurfaceActionBindingAuthority[] = [];
  const boundCoverageIndexes = new Set<number>();
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex]!;
    const beatId = action!.beatId;
    if (
      typeof beatId !== 'string' ||
      !new RegExp(`^beat:p${args.pageNumber}:[a-z0-9_]+$`).test(beatId)
    ) {
      return null;
    }
    const matches = coverage.flatMap((record, coverageIndex) => {
      const disposition = record
        ? recordValue(record.disposition)
        : null;
      return record?.beatId === beatId &&
        disposition?.kind === 'action_requirement'
        ? [{ record, coverageIndex }]
        : [];
    });
    if (
      matches.length !== 1 ||
      boundCoverageIndexes.has(matches[0]!.coverageIndex) ||
      typeof matches[0]!.record.sourceEvidenceId !== 'string' ||
      !SOURCE_EVIDENCE_ID_PATTERN.test(
        matches[0]!.record.sourceEvidenceId,
      )
    ) {
      return null;
    }
    const subject = recordValue(action!.subject);
    if (
      subject?.kind === 'source_phenomenon' &&
      (typeof subject.sourceEvidenceId !== 'string' ||
        subject.sourceEvidenceId !==
          matches[0]!.record.sourceEvidenceId)
    ) {
      return null;
    }
    boundCoverageIndexes.add(matches[0]!.coverageIndex);
    actionBindingAuthority.push({
      actionIndex,
      beatId,
      coverageIndex: matches[0]!.coverageIndex,
      sourceEvidenceId: matches[0]!.record.sourceEvidenceId,
    });
  }
  const actionRequirementCoverageCount = coverage.filter(
    (record) => recordValue(record?.disposition)?.kind === 'action_requirement',
  ).length;
  if (actionRequirementCoverageCount !== actionBindingAuthority.length) {
    return null;
  }

  const recurringProps = Array.isArray(args.authorityDraft.recurringProps)
    ? args.authorityDraft.recurringProps.map(recordValue)
    : [];
  if (recurringProps.some((prop) => prop === null)) return null;
  const preRevealPropObligations = recurringProps.flatMap((prop) =>
    typeof prop?.id === 'string' &&
    positiveInteger(prop.firstRevealPage) &&
    args.pageNumber < prop.firstRevealPage
      ? [{ propId: prop.id, firstRevealPage: prop.firstRevealPage }]
      : [],
  ).sort((left, right) => lexicalCompare(left.propId, right.propId));

  const orderedAuthorityPages = authorityPages
    .filter((page): page is Record<string, unknown> => page !== null)
    .sort((left, right) => Number(left.pageNumber) - Number(right.pageNumber));
  const topologyEntry = (pageNumber: number) => {
    const matches = orderedAuthorityPages.filter(
      (page) => page.pageNumber === pageNumber,
    );
    return matches.length === 1 &&
      typeof matches[0]!.zoneId === 'string'
      ? { pageNumber, zoneId: matches[0]!.zoneId as string }
      : null;
  };
  return {
    castIds: [...castIds],
    characterPresence: {
      child: characterPresence.child,
      companion: characterPresence.companion,
    },
    anchorIds: [...anchorIds].sort(lexicalCompare),
    spatialReferenceIds: [...spatialReferenceIds].sort(lexicalCompare),
    safetyConstraints,
    actionBindingAuthority,
    preRevealPropObligations,
    transitionTopology: args.includeTransitionTopology
      ? {
          previous: topologyEntry(args.pageNumber - 1),
          current: { pageNumber: args.pageNumber, zoneId },
          next: topologyEntry(args.pageNumber + 1),
        }
      : null,
  };
}

function pageReadOnlyContextIsValid(
  value: BookSurfacePageReadOnlyContext,
  pageNumber: number,
  transitionIsWritable: boolean,
): boolean {
  if (
    !exactKeys(value as unknown as Record<string, unknown>, [
      'castIds',
      'characterPresence',
      'anchorIds',
      'spatialReferenceIds',
      'safetyConstraints',
      'actionBindingAuthority',
      'preRevealPropObligations',
      'transitionTopology',
    ]) ||
    !uniqueStrings(value.castIds) ||
    value.castIds.length === 0 ||
    !uniqueStrings(value.anchorIds) ||
    !uniqueStrings(value.spatialReferenceIds) ||
    !exactKeys(
      value.characterPresence as unknown as Record<string, unknown>,
      ['child', 'companion'],
    ) ||
    typeof value.characterPresence.child !== 'boolean' ||
    typeof value.characterPresence.companion !== 'boolean'
  ) {
    return false;
  }
  if (
    value.safetyConstraints.some(
      (constraint) =>
        !exactKeys(constraint as unknown as Record<string, unknown>, [
          'subjectId',
          'relation',
          'target',
        ]) ||
        typeof constraint.subjectId !== 'string' ||
        constraint.subjectId.length === 0 ||
        typeof constraint.relation !== 'string' ||
        constraint.relation.length === 0 ||
        !exactKeys(constraint.target as unknown as Record<string, unknown>, [
          'kind',
          'id',
        ]) ||
        typeof constraint.target.kind !== 'string' ||
        constraint.target.kind.length === 0 ||
        typeof constraint.target.id !== 'string' ||
        constraint.target.id.length === 0,
    )
  ) {
    return false;
  }
  const coverageIndexes = new Set<number>();
  if (
    value.actionBindingAuthority.some((binding, actionIndex) => {
      if (
        !exactKeys(binding as unknown as Record<string, unknown>, [
          'actionIndex',
          'beatId',
          'coverageIndex',
          'sourceEvidenceId',
        ]) ||
        binding.actionIndex !== actionIndex ||
        !new RegExp(`^beat:p${pageNumber}:[a-z0-9_]+$`).test(
          binding.beatId,
        ) ||
        !Number.isSafeInteger(binding.coverageIndex) ||
        binding.coverageIndex < 0 ||
        coverageIndexes.has(binding.coverageIndex) ||
        !SOURCE_EVIDENCE_ID_PATTERN.test(binding.sourceEvidenceId)
      ) {
        return true;
      }
      coverageIndexes.add(binding.coverageIndex);
      return false;
    })
  ) {
    return false;
  }
  const obligationIds = new Set<string>();
  for (
    let index = 0;
    index < value.preRevealPropObligations.length;
    index += 1
  ) {
    const obligation = value.preRevealPropObligations[index]!;
    if (
      !exactKeys(obligation as unknown as Record<string, unknown>, [
        'propId',
        'firstRevealPage',
      ]) ||
      typeof obligation.propId !== 'string' ||
      obligation.propId.length === 0 ||
      obligationIds.has(obligation.propId) ||
      !positiveInteger(obligation.firstRevealPage) ||
      obligation.firstRevealPage <= pageNumber ||
      (index > 0 &&
        lexicalCompare(
          value.preRevealPropObligations[index - 1]!.propId,
          obligation.propId,
        ) >= 0)
    ) {
      return false;
    }
    obligationIds.add(obligation.propId);
  }
  const topology = value.transitionTopology;
  if (topology === null) return !transitionIsWritable;
  if (!transitionIsWritable) return false;
  if (
    !exactKeys(topology as unknown as Record<string, unknown>, [
      'previous',
      'current',
      'next',
    ])
  ) {
    return false;
  }
  const topologyEntryIsValid = (
    entry: { pageNumber: number; zoneId: string } | null,
    expectedPageNumber: number,
  ) =>
    entry === null ||
    (exactKeys(entry as unknown as Record<string, unknown>, [
      'pageNumber',
      'zoneId',
    ]) &&
      entry.pageNumber === expectedPageNumber &&
      typeof entry.zoneId === 'string' &&
      entry.zoneId.length > 0);
  return (
    exactKeys(topology.current as unknown as Record<string, unknown>, [
      'pageNumber',
      'zoneId',
    ]) &&
    topology.current.pageNumber === pageNumber &&
    typeof topology.current.zoneId === 'string' &&
    topology.current.zoneId.length > 0 &&
    topologyEntryIsValid(topology.previous, pageNumber - 1) &&
    topologyEntryIsValid(topology.next, pageNumber + 1)
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
      positiveInteger(issue.locator.pageNumber) &&
      'causes' in issue &&
      issue.causes.every(
        (cause) => PAGE_CAUSE_WRITABLE_FIELDS[cause] !== null,
      ))
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
  const refs = referenceAuthority(args.authorityDraft);
  if (!refs) return null;

  const affectedPages = pageContractRepairAffectedPages({
    draft: args.draft,
    diagnosticIssues: pageIssueEntries.map(({ issue }) => issue),
    validationMessages: pageIssueEntries.map(({ message }) => message),
  });
  const cleanedAffectedPages = affectedPages?.map((page) => {
    const validationHints = cleanValidationMessages(
      page.validationHints,
    );
    const writableFields = writableFieldsForAffectedPage({
      page,
      presentationTargets: args.presentationTargets,
    });
    const readOnlyContext = pageReadOnlyContext({
      draft: args.draft,
      authorityDraft: args.authorityDraft,
      pageNumber: page.pageNumber,
      includeTransitionTopology: writableFields?.includes('transition') ?? false,
    });
    const propConstraintViolations = readOnlyContext
      ? expectedPagePropConstraintViolations({
          pageContract: page.pageContract,
          repairTargets: page.repairTargets,
          recurringPropIds: refs.recurringPropIds,
          anchorIds: readOnlyContext.anchorIds,
        })
      : null;
    const propConstraintDiagnosticCount = pageIssueEntries.filter(
      ({ issue }) =>
        issue.locator.kind === 'page' &&
        issue.locator.pageNumber === page.pageNumber &&
        'causes' in issue &&
        issue.causes.includes('page_prop_constraints_invalid'),
    ).length;
    return validationHints &&
      writableFields &&
      readOnlyContext &&
      propConstraintViolations &&
      propConstraintViolations.length === propConstraintDiagnosticCount
      ? {
          ...page,
          pageContract: objectProjection(
            page.pageContract,
            PAGE_CONTRACT_KEYS,
          ),
          validationHints,
          writableFields,
          readOnlyContext,
          propConstraintViolations,
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
  const typedRecurringProps = recurringProps as Record<string, unknown>[];
  const recurringPropIds = recurringProps.some((value) => value === null)
    ? null
    : uniqueRecordIds(typedRecurringProps);
  const draftPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const recurringPropLifecycleContext =
    repairRecurringProps && !draftPages.some((page) => page === null)
      ? buildRecurringPropLifecycleContext({
          recurringProps: typedRecurringProps,
          pages: draftPages as Record<string, unknown>[],
        })
      : [];
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
    !recurringPropIds ||
    recurringPropLifecycleContext === null ||
    JSON.stringify([...recurringPropIds].sort()) !==
      JSON.stringify(refs.recurringPropIds)
  ) {
    return null;
  }
  const authorityContent: BookSurfaceRepairAuthorityContent = {
    sourceDraftDigest: canonicalHash(args.draft),
    coverContract:
      coverContract === null ? null : structuredClone(coverContract),
    recurringProps: repairRecurringProps
      ? structuredClone(typedRecurringProps)
      : null,
    recurringPropLifecycleContext: structuredClone(
      recurringPropLifecycleContext,
    ),
    repairRecurringProps,
    presentationTargets: args.presentationTargets.map((target) =>
      structuredClone(target),
    ),
    affectedPages: (
      cleanedAffectedPages as BookSurfaceRepairAffectedPage[]
    ).map((value) => structuredClone(value)),
    coverValidationHints,
    recurringPropValidationHints,
    referenceAuthority: refs,
  };
  return {
    authorityDigest: canonicalHash(authorityContent),
    ...authorityContent,
  };
}

export function buildBookSurfaceRepairSystemPrompt(): string {
  return [
    'Repair one closed book surface atomically: exact presentation dispositions, the cover only when coverAuthority is non-null, recurring props only when recurringPropAuthority is non-null, and only the structural page fields supplied by affectedPages.',
    'Decode the compact input exactly: ["s",i] references stringDictionary[i], ["a",...items] is an array, and ["o",i,...values] is an object whose ordered keys are objectShapes[i].',
    'The decoded root contains presentationTargets, nullable coverAuthority and recurringPropAuthority, affectedPages with exact structural projections, causal repairTargets, writableFields, diagnosticCount, typed propConstraintViolations and readOnlyContext, and referenceAuthority.',
    'Return presentationPatches in the exact target order, coverContract or null exactly as authorized, recurringProps or null exactly as authorized, and pageStructuralPatches in the exact affected-page order.',
    'Every pageStructuralPatch must return the strict full patch shape. Copy pageNumber exactly. Return a repaired non-null value only for that page\'s exact writableFields and return null for every other structural field, including locationId, zoneId and sameLocationAs.',
    'readOnlyContext is preservation authority only and must never be returned. Use its cast/presence, anchors, spatial nodes, scrubbed safety, lifecycle, transition and action-binding facts to keep the repair valid.',
    'When actionRequirements is writable, return exactly one semantic action for every existing action index, in the same order. Never add, drop or reorder actions. The compiler reattaches the exact beatId and any source_phenomenon Source Evidence subject from its private authority before apply; never return or alter actionSemanticCoverage.',
    'For each presentation target, copy its identities and one exact permitted contractPointer. The overlapping page mustShow array is not writable; preserve it exactly so the compiler can resolve the authorized pointer/value locally.',
    'No raw validation prose is included. For writable propConstraints, use only the closed propConstraintViolations codes and their constraintIndex/relatedConstraintIndex positions to repair the supplied projection. Use only the typed targets, causes, exact projections, bounded diagnostic counts and read-only authority supplied in the decoded payload.',
    'When recurringPropAuthority is non-null, preserve the exact recurring-prop ID order and resolve only its typed lifecycle invariant. Use lifecycleContext as read-only page visibility authority: every page before a non-null firstRevealPage must be listed forbidden, and no listed required page may precede it. Otherwise return recurringProps:null.',
    'When coverAuthority is non-null, repair its semantic fields and return a well-shaped cover identity. The compiler preserves an already-valid current location/zone/cast identity; when the current identity is invalid, it accepts only a replacement inside referenceAuthority and never invents a reference. Otherwise return coverContract:null.',
    'Preserve all valid semantics. Never infer or return unrelated page or global fields.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildBookSurfaceRepairUserPrompt(args: {
  authority: BookSurfaceRepairAuthority;
}): string {
  if (!bookSurfaceRepairAuthorityIsIntact(args.authority)) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  if (
    args.authority.affectedPages.some(
      (page) =>
        !affectedPagePropConstraintAuthorityIsCurrent({
          page,
          recurringPropIds:
            args.authority.referenceAuthority.recurringPropIds,
        }),
    )
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  const payload = {
    presentationTargets: args.authority.presentationTargets.map(
      ({ sourcePhrase: _sourcePhrase, ...target }) =>
        structuredClone(target),
    ),
    coverAuthority:
      args.authority.coverContract === null
        ? null
        : {
            coverContract: structuredClone(
              args.authority.coverContract,
            ),
            diagnosticCount:
              args.authority.coverValidationHints.length,
          },
    recurringPropAuthority:
      !args.authority.repairRecurringProps ||
      args.authority.recurringProps === null
        ? null
        : {
            recurringProps: structuredClone(
              args.authority.recurringProps,
            ),
            lifecycleContext: structuredClone(
              args.authority.recurringPropLifecycleContext,
            ),
            diagnosticCount:
              args.authority.recurringPropValidationHints.length,
          },
    affectedPages: args.authority.affectedPages.map((value) => ({
      pageNumber: value.pageNumber,
      pageStructuralProjection: pageStructuralProjection(
        value.pageContract,
        value.writableFields,
      ),
      repairTargets: structuredClone(value.repairTargets),
      writableFields: [...value.writableFields],
      diagnosticCount: value.validationHints.length,
      propConstraintViolations: structuredClone(
        value.propConstraintViolations,
      ),
      readOnlyContext: providerReadOnlyContext(value.readOnlyContext),
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
        (value.locationId !== null &&
          (typeof value.locationId !== 'string' ||
            value.locationId.trim().length === 0)) ||
        (value.zoneId !== null &&
          (typeof value.zoneId !== 'string' ||
            value.zoneId.trim().length === 0)) ||
        (value.sameLocationAs !== null &&
          typeof value.sameLocationAs !== 'number') ||
        (value.mustShow !== null &&
          (!Array.isArray(value.mustShow) ||
            value.mustShow.some(
              (entry) => typeof entry !== 'string',
            ))) ||
        (value.mustNotShow !== null &&
          !Array.isArray(value.mustNotShow)) ||
        (value.propState !== null && !Array.isArray(value.propState)) ||
        (value.propConstraints !== null &&
          !Array.isArray(value.propConstraints)) ||
        (value.actionRequirements !== null &&
          !Array.isArray(value.actionRequirements)) ||
        (value.camera !== null && typeof value.camera !== 'string') ||
        (value.transition !== null &&
          recordValue(value.transition) === null),
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
  const writableFieldsByPage = new Map(
    args.authority.affectedPages.map((page) => [
      page.pageNumber,
      new Set<BookSurfaceWritablePageField>(page.writableFields),
    ]),
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
          !writableFieldsByPage.has(page.pageNumber) &&
          presentationTargets.length === 0
        ) {
          return value;
        }
        const maskedPage: Record<string, unknown> = { ...page };
        const writableFields = writableFieldsByPage.get(
          page.pageNumber,
        );
        if (writableFields) {
          for (const key of writableFields) {
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
  const draftRecurringProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  const currentRecurringPropIds = draftRecurringProps.some(
    (prop) => prop === null,
  )
    ? null
    : uniqueRecordIds(
        draftRecurringProps as Record<string, unknown>[],
      );
  if (!currentRecurringPropIds) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  for (let index = 0; index < pageNumbers.length; index += 1) {
    const affectedPage = args.authority.affectedPages[index]!;
    const patch = args.patches[index]!;
    const authorityPage = affectedPage.pageContract;
    const matches = draftPages.filter(
      (page) => page?.pageNumber === affectedPage.pageNumber,
    );
    const currentAnchorIds = matches[0]
      ? anchorIdsForPageContract({
          draft: args.draft,
          pageContract: matches[0],
        })
      : null;
    const expectedWritableFields = writableFieldsForAffectedPage({
      page: affectedPage,
      presentationTargets: args.authority.presentationTargets,
    });
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
      !expectedWritableFields ||
      !orderedValuesEqual(
        affectedPage.writableFields,
        expectedWritableFields,
      ) ||
      !pageReadOnlyContextIsValid(
        affectedPage.readOnlyContext,
        affectedPage.pageNumber,
        affectedPage.writableFields.includes('transition'),
      ) ||
      !currentAnchorIds ||
      !orderedValuesEqual(
        currentAnchorIds,
        affectedPage.readOnlyContext.anchorIds,
      ) ||
      !affectedPagePropConstraintAuthorityIsCurrent({
        page: affectedPage,
        recurringPropIds: currentRecurringPropIds,
        pageContract: matches[0],
        anchorIds: currentAnchorIds,
      }) ||
      canonicalJson(
        objectProjection(matches[0], PAGE_CONTRACT_KEYS),
      ) !== canonicalJson(authorityPage)
    ) {
      throw new Error('book_surface_repair_authority_mismatch');
    }

    const writableFields = new Set(affectedPage.writableFields);
    for (const key of PAGE_STRUCTURAL_PATCH_KEYS) {
      if (key === 'pageNumber') continue;
      const writable = writableFields.has(
        key as BookSurfaceWritablePageField,
      );
      if (
        (!writable && patch[key] !== null) ||
        (writable && patch[key] === null)
      ) {
        throw new Error('book_surface_repair_non_target_drift');
      }
    }

    const authorityActions = Array.isArray(authorityPage.actionRequirements)
      ? authorityPage.actionRequirements.map(recordValue)
      : [];
    const authorityCoverage = Array.isArray(
      authorityPage.actionSemanticCoverage,
    )
      ? authorityPage.actionSemanticCoverage.map(recordValue)
      : [];
    if (
      authorityActions.some((action) => action === null) ||
      authorityCoverage.some((coverage) => coverage === null) ||
      authorityActions.length !==
        affectedPage.readOnlyContext.actionBindingAuthority.length
    ) {
      throw new Error('book_surface_repair_action_binding_stale');
    }
    for (const binding of affectedPage.readOnlyContext
      .actionBindingAuthority) {
      const action = authorityActions[binding.actionIndex];
      const coverage = authorityCoverage[binding.coverageIndex];
      const disposition = recordValue(coverage?.disposition);
      if (
        action?.beatId !== binding.beatId ||
        coverage?.beatId !== binding.beatId ||
        coverage?.sourceEvidenceId !== binding.sourceEvidenceId ||
        disposition?.kind !== 'action_requirement'
      ) {
        throw new Error('book_surface_repair_action_binding_stale');
      }
    }
    if (writableFields.has('actionRequirements')) {
      const patchActions = Array.isArray(patch.actionRequirements)
        ? patch.actionRequirements.map(recordValue)
        : [];
      if (
        patchActions.length !==
          affectedPage.readOnlyContext.actionBindingAuthority.length ||
        patchActions.some(
          (action, actionIndex) =>
            action?.beatId !==
            affectedPage.readOnlyContext.actionBindingAuthority[
              actionIndex
            ]?.beatId,
        ) ||
        patchActions.some((action, actionIndex) => {
          const authoritySubject = recordValue(
            authorityActions[actionIndex]?.subject,
          );
          const patchSubject = recordValue(action?.subject);
          const authorityEvidenceId =
            authoritySubject?.kind === 'source_phenomenon'
              ? authoritySubject.sourceEvidenceId
              : null;
          const patchEvidenceId =
            patchSubject?.kind === 'source_phenomenon'
              ? patchSubject.sourceEvidenceId
              : null;
          return (
            (authorityEvidenceId !== null &&
              (typeof authorityEvidenceId !== 'string' ||
                !SOURCE_EVIDENCE_ID_PATTERN.test(authorityEvidenceId))) ||
            (patchEvidenceId !== null &&
              (typeof patchEvidenceId !== 'string' ||
                !SOURCE_EVIDENCE_ID_PATTERN.test(patchEvidenceId))) ||
            authorityEvidenceId !== patchEvidenceId
          );
        })
      ) {
        throw new Error('book_surface_repair_action_binding_changed');
      }
    }
    const effectivePropConstraints = writableFields.has(
      'propConstraints',
    )
      ? patch.propConstraints
      : authorityPage.propConstraints;
    const patchPropConstraints = Array.isArray(effectivePropConstraints)
      ? effectivePropConstraints.map(recordValue)
      : [];
    for (const obligation of args.authority.repairRecurringProps
      ? []
      : affectedPage.readOnlyContext.preRevealPropObligations) {
      const matching = patchPropConstraints.filter(
        (constraint) => constraint?.propId === obligation.propId,
      );
      if (
        !matching.some(
          (constraint) => constraint?.visibility === 'forbidden',
        ) ||
        matching.some(
          (constraint) => constraint?.visibility === 'required',
        )
      ) {
        throw new Error('book_surface_repair_lifecycle_obligation_invalid');
      }
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
  const currentPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  const expectedLifecycleContext =
    currentProps.some((value) => value === null) ||
    currentPages.some((value) => value === null)
      ? null
      : buildRecurringPropLifecycleContext({
          recurringProps: currentProps as Record<string, unknown>[],
          pages: currentPages as Record<string, unknown>[],
        });
  if (
    !expectedLifecycleContext ||
    canonicalJson(args.authority.recurringPropLifecycleContext) !==
      canonicalJson(
        args.authority.repairRecurringProps
          ? expectedLifecycleContext
          : [],
      )
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
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

function validateEffectiveRecurringPropLifecycle(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  pagePatches: readonly Record<string, unknown>[];
  recurringProps: readonly Record<string, unknown>[] | null;
}): void {
  const currentPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  if (currentPages.some((page) => page === null)) {
    throw new Error('book_surface_repair_lifecycle_obligation_invalid');
  }
  const patchByPage = new Map(
    args.pagePatches.map((patch) => [patch.pageNumber, patch]),
  );
  const writableFieldsByPage = new Map(
    args.authority.affectedPages.map((page) => [
      page.pageNumber,
      new Set(page.writableFields),
    ]),
  );
  const effectivePages = (
    currentPages as Record<string, unknown>[]
  ).map((page) => {
    const pageNumber = page.pageNumber;
    const patch = typeof pageNumber === 'number'
      ? patchByPage.get(pageNumber)
      : undefined;
    return patch &&
      writableFieldsByPage.get(pageNumber as number)?.has('propConstraints')
      ? { ...page, propConstraints: patch.propConstraints }
      : page;
  });
  const currentProps = Array.isArray(args.draft.recurringProps)
    ? args.draft.recurringProps.map(recordValue)
    : [];
  if (currentProps.some((prop) => prop === null)) {
    throw new Error('book_surface_repair_lifecycle_obligation_invalid');
  }
  const effectiveProps = args.recurringProps ??
    (currentProps as Record<string, unknown>[]);
  const pageNumbers = effectivePages.map((page) => page.pageNumber);
  const maxPage = pageNumbers.every(positiveInteger)
    ? Math.max(...(pageNumbers as number[]))
    : 0;
  if (
    maxPage < 1 ||
    new Set(pageNumbers).size !== pageNumbers.length
  ) {
    throw new Error('book_surface_repair_lifecycle_obligation_invalid');
  }
  for (const prop of effectiveProps) {
    if (typeof prop.id !== 'string' || prop.id.length === 0) {
      throw new Error('book_surface_repair_lifecycle_obligation_invalid');
    }
    if (prop.firstRevealPage === null || prop.firstRevealPage === undefined) {
      continue;
    }
    if (
      !positiveInteger(prop.firstRevealPage) ||
      prop.firstRevealPage > maxPage
    ) {
      throw new Error('book_surface_repair_lifecycle_obligation_invalid');
    }
    for (
      let pageNumber = 1;
      pageNumber < prop.firstRevealPage;
      pageNumber += 1
    ) {
      const matches = effectivePages.filter(
        (page) => page.pageNumber === pageNumber,
      );
      const constraints =
        matches.length === 1 && Array.isArray(matches[0]!.propConstraints)
          ? matches[0]!.propConstraints.map(recordValue)
          : [];
      if (
        matches.length !== 1 ||
        constraints.some((constraint) => constraint === null) ||
        !constraints.some(
          (constraint) =>
            constraint?.propId === prop.id &&
            constraint?.visibility === 'forbidden',
        ) ||
        constraints.some(
          (constraint) =>
            constraint?.propId === prop.id &&
            constraint?.visibility === 'required',
        )
      ) {
        throw new Error(
          'book_surface_repair_lifecycle_obligation_invalid',
        );
      }
    }
  }
}

function restoreCompilerOwnedActionBindingIdentity(args: {
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): BookSurfaceRepairPatch {
  const restored = structuredClone(args.patch);
  const patchByPage = new Map(
    restored.pageStructuralPatches.map((pagePatch) => [
      pagePatch.pageNumber,
      pagePatch,
    ]),
  );
  for (const affectedPage of args.authority.affectedPages) {
    if (!affectedPage.writableFields.includes('actionRequirements')) continue;
    const pagePatch = patchByPage.get(affectedPage.pageNumber);
    if (!pagePatch) continue;
    const patchActions = Array.isArray(pagePatch?.actionRequirements)
      ? pagePatch.actionRequirements.map(recordValue)
      : [];
    const bindings = affectedPage.readOnlyContext.actionBindingAuthority;
    const authorityActions = Array.isArray(
      affectedPage.pageContract.actionRequirements,
    )
      ? affectedPage.pageContract.actionRequirements.map(recordValue)
      : [];
    if (
      authorityActions.length !== bindings.length ||
      patchActions.some((action) => action === null) ||
      authorityActions.some((action) => action === null)
    ) {
      continue;
    }
    const restoredActions =
      patchActions.length === bindings.length
        ? (patchActions as Record<string, unknown>[])
        : bindings.map((binding, actionIndex) => {
            const matches = patchActions.filter(
              (action) => action?.beatId === binding.beatId,
            );
            return structuredClone(
              matches.length === 1
                ? matches[0]!
                : authorityActions[actionIndex]!,
            );
          });
    pagePatch.actionRequirements = restoredActions;
    for (let actionIndex = 0; actionIndex < bindings.length; actionIndex += 1) {
      const binding = bindings[actionIndex]!;
      const patchAction = restoredActions[actionIndex]!;
      const authoritySubject = recordValue(
        authorityActions[actionIndex]!.subject,
      );
      const patchSubject = recordValue(patchAction.subject);
      patchAction.beatId = binding.beatId;
      if (
        authoritySubject?.kind === 'source_phenomenon' &&
        typeof authoritySubject.sourceEvidenceId === 'string' &&
        SOURCE_EVIDENCE_ID_PATTERN.test(authoritySubject.sourceEvidenceId)
      ) {
        patchAction.subject = {
          kind: 'source_phenomenon',
          sourceEvidenceId: authoritySubject.sourceEvidenceId,
        };
      } else if (patchSubject?.kind === 'source_phenomenon') {
        patchAction.subject = structuredClone(
          authorityActions[actionIndex]!.subject,
        );
      }
    }
  }
  return restored;
}

function restoreCompilerOwnedPreRevealConstraints(args: {
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): BookSurfaceRepairPatch {
  const restored = structuredClone(args.patch);
  if (args.authority.repairRecurringProps) return restored;
  const patchByPage = new Map(
    restored.pageStructuralPatches.map((pagePatch) => [
      pagePatch.pageNumber,
      pagePatch,
    ]),
  );
  for (const affectedPage of args.authority.affectedPages) {
    if (
      !affectedPage.writableFields.includes('propConstraints') ||
      affectedPage.readOnlyContext.preRevealPropObligations.length === 0
    ) {
      continue;
    }
    const pagePatch = patchByPage.get(affectedPage.pageNumber);
    if (!pagePatch || !Array.isArray(pagePatch.propConstraints)) {
      throw new Error('book_surface_repair_lifecycle_obligation_invalid');
    }
    const authorityConstraints = Array.isArray(
      affectedPage.pageContract.propConstraints,
    )
      ? affectedPage.pageContract.propConstraints.map(recordValue)
      : [];
    let restoredConstraints = pagePatch.propConstraints.map((value) =>
      structuredClone(value),
    );
    for (const obligation of
      affectedPage.readOnlyContext.preRevealPropObligations) {
      const compilerOwned = authorityConstraints.find(
        (constraint) =>
          constraint?.propId === obligation.propId &&
          constraint.visibility === 'forbidden',
      );
      if (!compilerOwned) {
        throw new Error('book_surface_repair_lifecycle_obligation_invalid');
      }
      restoredConstraints = restoredConstraints.filter(
        (constraint) => recordValue(constraint)?.propId !== obligation.propId,
      );
      restoredConstraints.push(structuredClone(compilerOwned));
    }
    pagePatch.propConstraints = restoredConstraints;
  }
  return restored;
}

function restoreCompilerOwnedPresentationTargetIdentity(args: {
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): BookSurfaceRepairPatch {
  const restored = structuredClone(args.patch);
  if (
    restored.presentationPatches.length !==
    args.authority.presentationTargets.length
  ) {
    return restored;
  }
  for (
    let targetIndex = 0;
    targetIndex < args.authority.presentationTargets.length;
    targetIndex += 1
  ) {
    const target = args.authority.presentationTargets[targetIndex]!;
    const patch = restored.presentationPatches[targetIndex]!;
    patch.pageNumber = target.pageNumber;
    patch.coverageIndex = target.coverageIndex;
    patch.beatId = target.beatId;
    patch.sourceEvidenceId = target.sourceEvidenceId;
  }
  return restored;
}

function restoreCompilerOwnedRecurringPropIdentity(args: {
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): BookSurfaceRepairPatch {
  const restored = structuredClone(args.patch);
  if (
    restored.recurringProps === null ||
    args.authority.recurringProps === null ||
    restored.recurringProps.length !== args.authority.recurringProps.length
  ) {
    return restored;
  }
  restored.recurringProps = restored.recurringProps.map((patchProp, index) => ({
    ...structuredClone(args.authority.recurringProps![index]!),
    firstRevealPage: patchProp.firstRevealPage,
  }));
  return restored;
}

function restoreCompilerOwnedCoverReferenceIdentity(args: {
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): BookSurfaceRepairPatch {
  const restored = structuredClone(args.patch);
  if (restored.coverContract === null) return restored;
  const authorityCover = args.authority.coverContract;
  if (authorityCover === null) return restored;
  const patchCastIds = uniqueStrings(restored.coverContract.castIds);
  if (
    !exactKeys(authorityCover, COVER_CONTRACT_KEYS) ||
    typeof restored.coverContract.worldType !== 'string' ||
    restored.coverContract.worldType.trim().length === 0 ||
    typeof restored.coverContract.locationId !== 'string' ||
    restored.coverContract.locationId.trim().length === 0 ||
    typeof restored.coverContract.zoneId !== 'string' ||
    restored.coverContract.zoneId.trim().length === 0 ||
    !patchCastIds ||
    patchCastIds.length === 0
  ) {
    throw new Error('book_surface_repair_cover_invalid');
  }
  const validPair = (
    value: Record<string, unknown>,
  ): { locationId: string; zoneId: string } | null => {
    if (
      typeof value.locationId !== 'string' ||
      typeof value.zoneId !== 'string'
    ) {
      return null;
    }
    const zone = args.authority.referenceAuthority.zones.find(
      (candidate) => candidate.id === value.zoneId,
    );
    return args.authority.referenceAuthority.locationIds.includes(
      value.locationId,
    ) && zone?.locationId === value.locationId
      ? { locationId: value.locationId, zoneId: value.zoneId }
      : null;
  };
  const authorityPair = validPair(authorityCover);
  const patchPair = validPair(restored.coverContract);
  const selectedPair = authorityPair ?? patchPair;
  if (!selectedPair) {
    throw new Error('book_surface_repair_cover_reference_invalid');
  }
  const permittedCastIds = new Set(args.authority.referenceAuthority.castIds);
  const authorityCastIds = uniqueStrings(authorityCover.castIds) ?? [];
  const authorityValidCastIds = authorityCastIds.filter((id) =>
    permittedCastIds.has(id),
  );
  const patchValidCastIds = patchCastIds.filter((id) =>
    permittedCastIds.has(id),
  );
  const selectedCastIds =
    authorityCastIds.length > 0 &&
    authorityValidCastIds.length === authorityCastIds.length
      ? authorityCastIds
      : patchValidCastIds.length === patchCastIds.length
        ? patchCastIds
        : authorityValidCastIds;
  if (selectedCastIds.length === 0) {
    throw new Error('book_surface_repair_cover_reference_invalid');
  }
  restored.coverContract.worldType =
    args.authority.referenceAuthority.worldType;
  restored.coverContract.locationId = selectedPair.locationId;
  restored.coverContract.zoneId = selectedPair.zoneId;
  restored.coverContract.castIds = structuredClone(selectedCastIds);
  return restored;
}

export function applyBookSurfaceRepairPatch(args: {
  draft: Record<string, unknown>;
  authority: BookSurfaceRepairAuthority;
  patch: BookSurfaceRepairPatch;
}): Record<string, unknown> {
  if (
    !bookSurfaceRepairAuthorityIsIntact(args.authority) ||
    typeof args.authority.sourceDraftDigest !== 'string' ||
    canonicalHash(args.draft) !== args.authority.sourceDraftDigest
  ) {
    throw new Error('book_surface_repair_authority_mismatch');
  }
  let validatedPatch: BookSurfaceRepairPatch;
  try {
    validatedPatch = restoreCompilerOwnedCoverReferenceIdentity({
      authority: args.authority,
      patch: restoreCompilerOwnedRecurringPropIdentity({
        authority: args.authority,
        patch: restoreCompilerOwnedPresentationTargetIdentity({
          authority: args.authority,
          patch: restoreCompilerOwnedPreRevealConstraints({
            authority: args.authority,
            patch: restoreCompilerOwnedActionBindingIdentity({
              authority: args.authority,
              patch: parseBookSurfaceRepairPatch(JSON.stringify(args.patch)),
            }),
          }),
        }),
      }),
    });
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
  validateEffectiveRecurringPropLifecycle({
    draft: args.draft,
    authority: args.authority,
    pagePatches: validatedPatch.pageStructuralPatches,
    recurringProps: validatedPatch.recurringProps,
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
  const affectedPagesByNumber = new Map(
    args.authority.affectedPages.map((page) => [page.pageNumber, page]),
  );
  for (const pagePatch of patch.pageStructuralPatches) {
    const page = resultPages.find(
      (candidate) => candidate?.pageNumber === pagePatch.pageNumber,
    )!;
    const affectedPage = affectedPagesByNumber.get(
      pagePatch.pageNumber as number,
    )!;
    for (const key of affectedPage.writableFields) {
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
