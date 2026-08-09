import type { DraftValidationIssue } from './draftValidationDiagnostics';
import {
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
} from './templateDraftSchema';

export const PAGE_CONTRACT_REPAIR_SCHEMA_VERSION =
  'page-contract-repair-schema/v1' as const;
export const PAGE_CONTRACT_REPAIR_SCHEMA_NAME =
  'PageContractRepairPatches' as const;
export const PAGE_CONTRACT_REPAIR_PROMPT_VERSION =
  'page-contract-repair-prompt/v1' as const;
export const PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION =
  'page-contract-repair-user-prompt/v1' as const;

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
}

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

function affectedPageNumber(
  issue: DraftValidationIssue,
): number | null {
  if (
    issue.family !== 'draft_contract' ||
    issue.code !== 'final_structural_invariant_invalid' ||
    issue.locator.fieldRole !== 'final_structure' ||
    (issue.locator.kind !== 'page' &&
      issue.locator.kind !== 'page_item')
  ) {
    return null;
  }
  return Number.isSafeInteger(issue.locator.pageNumber) &&
    issue.locator.pageNumber > 0
    ? issue.locator.pageNumber
    : null;
}

/**
 * Returns a complete, deterministic affected-page set only when every emitted
 * diagnostic belongs to the single closed structural family. Mixed or
 * unlocatable failures deliberately stay on the existing route.
 */
export function pageContractRepairAffectedPages(args: {
  draft: Record<string, unknown>;
  diagnosticIssues: readonly DraftValidationIssue[];
}): PageContractRepairAffectedPage[] | null {
  if (args.diagnosticIssues.length === 0) return null;
  const pageNumbers = new Set<number>();
  for (const issue of args.diagnosticIssues) {
    const pageNumber = affectedPageNumber(issue);
    if (pageNumber === null) return null;
    pageNumbers.add(pageNumber);
  }
  const pageContracts = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts
    : [];
  const result = [...pageNumbers]
    .sort((left, right) => left - right)
    .map((pageNumber) => {
      const matches = pageContracts
        .map(recordValue)
        .filter((page) => page?.pageNumber === pageNumber);
      return matches.length === 1
        ? {
            pageNumber,
            pageContract: structuredClone(matches[0]!),
          }
        : null;
    });
  return result.every(
    (value): value is PageContractRepairAffectedPage => value !== null,
  )
    ? result
    : null;
}

export function buildPageContractRepairSystemPrompt(): string {
  return [
    'You repair ONLY the complete page contracts identified by the input.',
    'Return exactly one complete page contract for every affected pageNumber and no other page.',
    'Keep pageNumber unchanged and use only IDs present in referenceAuthority.',
    'Do not rewrite locations, zones, set boards, cast, recurring props, cover, or global fields.',
    'Resolve every supplied validator error while preserving unaffected page semantics.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(recordValue)
        .map((entry) => stringField(entry?.id))
        .filter((entry): entry is string => entry !== null)
        .sort()
    : [];
}

function referenceAuthority(draft: Record<string, unknown>): unknown {
  const zones = Array.isArray(draft.zones) ? draft.zones : [];
  const cast = recordValue(draft.cast);
  const child = recordValue(cast?.child);
  const companion = recordValue(cast?.companion);
  return {
    locationIds: stringIds(draft.locations),
    zones: zones
      .map(recordValue)
      .filter((zone): zone is Record<string, unknown> => zone !== null)
      .map((zone) => ({
        id: stringField(zone.id),
        locationId: stringField(zone.locationId),
        spatialNodeIds: stringIds(zone.spatialNodes),
      }))
      .filter((zone) => zone.id !== null)
      .sort((left, right) => left.id!.localeCompare(right.id!)),
    recurringPropIds: stringIds(draft.recurringProps),
    castIds: [
      stringField(child?.id),
      stringField(companion?.id),
      ...stringIds(draft.humanCast),
    ]
      .filter((entry): entry is string => entry !== null)
      .sort(),
  };
}

export function buildPageContractRepairUserPrompt(args: {
  draft: Record<string, unknown>;
  affectedPages: readonly PageContractRepairAffectedPage[];
  errors: readonly string[];
}): string {
  return JSON.stringify({
    affectedPages: [...args.affectedPages]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((value) => ({
        pageNumber: value.pageNumber,
        pageContract: value.pageContract,
      })),
    validatorErrors: [...args.errors],
    referenceAuthority: referenceAuthority(args.draft),
  });
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

export function applyPageContractRepairs(args: {
  draft: Record<string, unknown>;
  affectedPages: readonly PageContractRepairAffectedPage[];
  pageContracts: readonly Record<string, unknown>[];
}): Record<string, unknown> {
  const expected = new Set(
    args.affectedPages.map((value) => value.pageNumber),
  );
  if (expected.size !== args.affectedPages.length) {
    throw new Error('page_contract_repair_affected_page_duplicate');
  }
  if (args.pageContracts.length !== expected.size) {
    throw new Error('page_contract_repair_patch_set_incomplete');
  }
  const replacements = new Map<number, Record<string, unknown>>();
  for (const page of args.pageContracts) {
    const pageNumber = page.pageNumber as number;
    if (!expected.has(pageNumber) || replacements.has(pageNumber)) {
      throw new Error('page_contract_repair_page_unexpected_or_duplicate');
    }
    replacements.set(pageNumber, structuredClone(page));
  }
  const draft = structuredClone(args.draft);
  if (!Array.isArray(draft.pageContracts)) {
    throw new Error('page_contract_repair_page_collection_invalid');
  }
  const seen = new Set<number>();
  draft.pageContracts = draft.pageContracts.map((value) => {
    const page = recordValue(value);
    const pageNumber = page?.pageNumber;
    if (
      typeof pageNumber === 'number' &&
      replacements.has(pageNumber)
    ) {
      if (seen.has(pageNumber)) {
        throw new Error('page_contract_repair_page_not_unique');
      }
      seen.add(pageNumber);
      return replacements.get(pageNumber)!;
    }
    return value;
  });
  if (seen.size !== expected.size) {
    throw new Error('page_contract_repair_page_not_unique');
  }
  return draft;
}
