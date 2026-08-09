import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import {
  permittedRepresentedElsewherePointerValuesForPage,
  type ActionSemanticCoverageTemplate,
  type RepresentedElsewherePointerValue,
} from './actionSemanticCoverage';
import {
  TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
} from './templateDraftSchema';

export const PAGE_CONTRACT_REPAIR_SCHEMA_VERSION =
  'page-contract-repair-schema/v1' as const;
export const PAGE_CONTRACT_REPAIR_SCHEMA_NAME =
  'PageContractRepairPatches' as const;
export const PAGE_CONTRACT_REPAIR_PROMPT_VERSION =
  'page-contract-repair-prompt/v2' as const;
export const PAGE_CONTRACT_REPAIR_USER_PROMPT_VERSION =
  'page-contract-repair-user-prompt/v2' as const;

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
  repairTargets: PageContractRepairTarget[];
  permittedPointerValues: RepresentedElsewherePointerValue[];
}

export type PageContractRepairTarget =
  | {
      family: 'draft_contract';
      code: 'final_structural_invariant_invalid';
      pageNumber: number;
    }
  | {
      family: 'action_semantic';
      code:
        | 'represented_elsewhere_pointer_out_of_scope'
        | 'represented_elsewhere_pointer_unresolved'
        | 'represented_elsewhere_value_mismatch';
      pageNumber: number;
    };

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
    (issue.locator.kind !== 'page' &&
      issue.locator.kind !== 'page_item')
  ) {
    return null;
  }
  return {
    family: issue.family,
    code: issue.code,
    pageNumber: issue.locator.pageNumber,
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
  };
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
    unique.set(
      JSON.stringify([target.pageNumber, target.family, target.code]),
      target,
    );
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.family.localeCompare(right.family) ||
      left.code.localeCompare(right.code),
  );
}

/**
 * Returns a complete, deterministic affected-page set only when every emitted
 * diagnostic belongs to one homogeneous closed repair family. Mixed or
 * unlocatable failures deliberately stay on the existing route.
 */
export function pageContractRepairAffectedPages(args: {
  draft: Record<string, unknown>;
  diagnosticIssues: readonly DraftValidationIssue[];
  pointerTemplate?: ActionSemanticCoverageTemplate;
}): PageContractRepairAffectedPage[] | null {
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
            repairTargets: targets.filter(
              (target) => target.pageNumber === pageNumber,
            ),
            permittedPointerValues: actionSemanticRepair
              ? permittedRepresentedElsewherePointerValuesForPage({
                  template: args.pointerTemplate!,
                  pageNumber,
                })
              : [],
          }
        : null;
    });
  return result.every(
    (value): value is PageContractRepairAffectedPage =>
      value !== null &&
      value.repairTargets.length > 0 &&
      (!actionSemanticRepair ||
        value.permittedPointerValues.length > 0),
  )
    ? result
    : null;
}

export function buildPageContractRepairSystemPrompt(): string {
  return [
    'You repair ONLY the complete page contracts identified by the input.',
    'Return exactly one complete page contract for every affected pageNumber and no other page.',
    'Keep pageNumber and all authority IDs unchanged; never invent a new ID.',
    'Do not rewrite locations, zones, set boards, cast, recurring props, cover, or global fields.',
    'Resolve only the closed typed repairTargets while preserving unaffected page semantics.',
    'For represented_elsewhere, contractPointer and contractValue must be copied as one exact pair from permittedPointerValues on that page.',
    'Never rewrite a pointer silently or infer an authoring record from an item/list position.',
    'Output only the JSON object required by the strict repair schema.',
  ].join('\n');
}

export function buildPageContractRepairUserPrompt(args: {
  affectedPages: readonly PageContractRepairAffectedPage[];
}): string {
  return JSON.stringify({
    affectedPages: [...args.affectedPages]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((value) => ({
        pageNumber: value.pageNumber,
        pageContract: value.pageContract,
        repairTargets: value.repairTargets,
        permittedPointerValues: value.permittedPointerValues,
      })),
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
