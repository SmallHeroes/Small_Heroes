import {
  canonicalHash,
  canonicalize,
} from '@/lib/canonical-json';

import {
  permittedRepresentedElsewherePointerValuesForPage,
  representedElsewherePointerIsPermittedForPage,
  resolveJsonPointer,
  type ActionSemanticCoverageTemplate,
  type RepresentedElsewherePointerValue,
} from './actionSemanticCoverage';
import {
  draftValidationIssueIsValid,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import {
  REPRESENTED_ELSEWHERE_REPAIR_OUTPUT_CLOSED_SUBREASON_VALUES,
  type RepresentedElsewhereRepairOutputClosedSubreason,
  type TemplateRepairOutputTargetContext,
} from './templateRepairOutputDiagnostics';
import {
  resolveSourceEvidenceId,
  SOURCE_EVIDENCE_ID_PATTERN,
  type SourceEvidenceCatalog,
} from './sourceEvidenceCatalog';

export const REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_VERSION =
  'represented-elsewhere-repair-schema/v1' as const;
export const REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_NAME =
  'RepresentedElsewhereRepairPatches' as const;
export const REPRESENTED_ELSEWHERE_REPAIR_PROMPT_VERSION =
  'represented-elsewhere-repair-prompt/v1' as const;
export const REPRESENTED_ELSEWHERE_REPAIR_USER_PROMPT_VERSION =
  'represented-elsewhere-repair-user-prompt/v1' as const;

export const REPRESENTED_ELSEWHERE_REPAIR_FAILURE_CODES = [
  'represented_elsewhere_pointer_out_of_scope',
  'represented_elsewhere_pointer_unresolved',
  'represented_elsewhere_value_mismatch',
] as const;

export type RepresentedElsewhereRepairFailureCode =
  (typeof REPRESENTED_ELSEWHERE_REPAIR_FAILURE_CODES)[number];

export const REPRESENTED_ELSEWHERE_REPAIR_TARGET_ASSOCIATION_SUBREASONS =
  REPRESENTED_ELSEWHERE_REPAIR_OUTPUT_CLOSED_SUBREASON_VALUES;

export type RepresentedElsewhereRepairTargetAssociationSubreason =
  RepresentedElsewhereRepairOutputClosedSubreason;

export type RepresentedElsewhereRepairTargetContext =
  TemplateRepairOutputTargetContext;

export class RepresentedElsewhereRepairTargetAssociationError
  extends Error
  implements RepresentedElsewhereRepairTargetContext
{
  readonly pageNumber: number;
  readonly coverageIndex: number;
  readonly closedSubreason: RepresentedElsewhereRepairTargetAssociationSubreason;

  constructor(args: {
    pageNumber: number;
    coverageIndex: number;
    closedSubreason: RepresentedElsewhereRepairTargetAssociationSubreason;
  }) {
    super('represented_elsewhere_repair_target_association_invalid');
    this.name = 'RepresentedElsewhereRepairTargetAssociationError';
    this.pageNumber = args.pageNumber;
    this.coverageIndex = args.coverageIndex;
    this.closedSubreason = args.closedSubreason;
  }
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

const representedElsewherePatchSchema = strictObject({
  pageNumber: { type: 'integer', minimum: 1 },
  coverageIndex: { type: 'integer', minimum: 0 },
  beatId: {
    type: 'string',
    pattern: '^beat:p[1-9][0-9]*:[a-z0-9_]+$',
  },
  sourceEvidenceId: {
    type: 'string',
    pattern: SOURCE_EVIDENCE_ID_PATTERN.source,
  },
  pointerChoiceIndex: { type: 'integer', minimum: 0 },
});

export const REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
  patches: {
    type: 'array',
    minItems: 1,
    items: representedElsewherePatchSchema,
  },
});

export const REPRESENTED_ELSEWHERE_REPAIR_SCHEMA_DIGEST = canonicalHash(
  REPRESENTED_ELSEWHERE_REPAIR_JSON_SCHEMA,
);

export interface RepresentedElsewhereRepairTarget {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  sourcePhrase: string;
  failureCode: RepresentedElsewhereRepairFailureCode;
}

export interface RepresentedElsewhereRepairPageAuthority {
  pageNumber: number;
  permittedPointerValues: RepresentedElsewherePointerValue[];
  targets: RepresentedElsewhereRepairTarget[];
}

export interface RepresentedElsewhereRepairAuthority {
  pages: RepresentedElsewhereRepairPageAuthority[];
}

export interface RepresentedElsewhereRepairPatch {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  pointerChoiceIndex: number;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    canonicalJson(Object.keys(value).sort()) ===
    canonicalJson([...expected].sort())
  );
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function targetKey(value: {
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

function targetSort(
  left: RepresentedElsewhereRepairTarget,
  right: RepresentedElsewhereRepairTarget,
): number {
  return (
    left.coverageIndex - right.coverageIndex ||
    lexicalCompare(left.beatId, right.beatId) ||
    lexicalCompare(left.sourceEvidenceId, right.sourceEvidenceId) ||
    lexicalCompare(left.failureCode, right.failureCode)
  );
}

function failureCodeIsValid(
  value: unknown,
): value is RepresentedElsewhereRepairFailureCode {
  return REPRESENTED_ELSEWHERE_REPAIR_FAILURE_CODES.includes(
    value as RepresentedElsewhereRepairFailureCode,
  );
}

function pointerValueIsValid(
  value: unknown,
): value is RepresentedElsewherePointerValue {
  const record = recordValue(value);
  return Boolean(
    record &&
      exactKeys(record, ['contractPointer', 'contractValue']) &&
      typeof record.contractPointer === 'string' &&
      record.contractPointer.length > 0 &&
      typeof record.contractValue === 'string' &&
      record.contractValue.length > 0,
  );
}

function targetIsValid(
  value: unknown,
): value is RepresentedElsewhereRepairTarget {
  const target = recordValue(value);
  return Boolean(
    target &&
      exactKeys(target, [
        'pageNumber',
        'coverageIndex',
        'beatId',
        'sourceEvidenceId',
        'sourcePhrase',
        'failureCode',
      ]) &&
      Number.isSafeInteger(target.pageNumber) &&
      (target.pageNumber as number) >= 1 &&
      Number.isSafeInteger(target.coverageIndex) &&
      (target.coverageIndex as number) >= 0 &&
      typeof target.beatId === 'string' &&
      new RegExp(
        `^beat:p${target.pageNumber as number}:[a-z0-9_]+$`,
      ).test(target.beatId) &&
      typeof target.sourceEvidenceId === 'string' &&
      SOURCE_EVIDENCE_ID_PATTERN.test(target.sourceEvidenceId) &&
      typeof target.sourcePhrase === 'string' &&
      target.sourcePhrase.length > 0 &&
      failureCodeIsValid(target.failureCode),
  );
}

function patchIsValid(
  value: unknown,
): value is RepresentedElsewhereRepairPatch {
  const patch = recordValue(value);
  return Boolean(
    patch &&
      exactKeys(patch, [
        'pageNumber',
        'coverageIndex',
        'beatId',
        'sourceEvidenceId',
        'pointerChoiceIndex',
      ]) &&
      Number.isSafeInteger(patch.pageNumber) &&
      (patch.pageNumber as number) >= 1 &&
      Number.isSafeInteger(patch.coverageIndex) &&
      (patch.coverageIndex as number) >= 0 &&
      typeof patch.beatId === 'string' &&
      new RegExp(
        `^beat:p${patch.pageNumber as number}:[a-z0-9_]+$`,
      ).test(patch.beatId) &&
      typeof patch.sourceEvidenceId === 'string' &&
      SOURCE_EVIDENCE_ID_PATTERN.test(patch.sourceEvidenceId) &&
      Number.isSafeInteger(patch.pointerChoiceIndex) &&
      (patch.pointerChoiceIndex as number) >= 0,
  );
}

function authorityIsValid(
  value: unknown,
): value is RepresentedElsewhereRepairAuthority {
  const authority = recordValue(value);
  if (
    !authority ||
    !exactKeys(authority, ['pages']) ||
    !Array.isArray(authority.pages) ||
    authority.pages.length === 0
  ) {
    return false;
  }
  const pageNumbers = new Set<number>();
  let previousPageNumber = 0;
  const targetKeys = new Set<string>();
  for (const rawPage of authority.pages) {
    const page = recordValue(rawPage);
    if (
      !page ||
      !exactKeys(page, [
        'pageNumber',
        'permittedPointerValues',
        'targets',
      ]) ||
      !Number.isSafeInteger(page.pageNumber) ||
      (page.pageNumber as number) <= previousPageNumber ||
      pageNumbers.has(page.pageNumber as number) ||
      !Array.isArray(page.permittedPointerValues) ||
      page.permittedPointerValues.length === 0 ||
      !page.permittedPointerValues.every(pointerValueIsValid) ||
      new Set(
        page.permittedPointerValues.map((pointerValue) =>
          canonicalJson(pointerValue),
        ),
      ).size !== page.permittedPointerValues.length ||
      !Array.isArray(page.targets) ||
      page.targets.length === 0 ||
      !page.targets.every(targetIsValid) ||
      page.targets.some(
        (target) => target.pageNumber !== page.pageNumber,
      ) ||
      canonicalJson(page.targets) !==
        canonicalJson(
          [...(page.targets as RepresentedElsewhereRepairTarget[])].sort(
            targetSort,
          ),
        )
    ) {
      return false;
    }
    previousPageNumber = page.pageNumber as number;
    pageNumbers.add(page.pageNumber as number);
    for (const target of page.targets as RepresentedElsewhereRepairTarget[]) {
      const key = targetKey(target);
      if (targetKeys.has(key)) return false;
      targetKeys.add(key);
    }
  }
  return true;
}

function representedElsewhereFailureCode(args: {
  pointerTemplate: ActionSemanticCoverageTemplate;
  pageNumber: number;
  coverage: Record<string, unknown>;
}): RepresentedElsewhereRepairFailureCode | null {
  const disposition = recordValue(args.coverage.disposition);
  if (
    !disposition ||
    !exactKeys(disposition, [
      'kind',
      'contractPointer',
      'contractValue',
    ]) ||
    disposition.kind !== 'represented_elsewhere' ||
    typeof disposition.contractPointer !== 'string' ||
    typeof disposition.contractValue !== 'string'
  ) {
    return null;
  }
  if (
    !representedElsewherePointerIsPermittedForPage({
      template: args.pointerTemplate,
      pageNumber: args.pageNumber,
      pointer: disposition.contractPointer,
    })
  ) {
    return 'represented_elsewhere_pointer_out_of_scope';
  }
  const resolved = resolveJsonPointer(
    args.pointerTemplate,
    disposition.contractPointer,
  );
  if (!resolved.found) {
    return 'represented_elsewhere_pointer_unresolved';
  }
  return typeof resolved.value !== 'string' ||
    resolved.value !== disposition.contractValue
    ? 'represented_elsewhere_value_mismatch'
    : null;
}

function exactDiagnosticTarget(
  issue: DraftValidationIssue,
): {
  pageNumber: number;
  globalCoverageIndex: number;
  failureCode: RepresentedElsewhereRepairFailureCode;
} | null {
  if (
    !draftValidationIssueIsValid(issue) ||
    issue.family !== 'action_semantic' ||
    !failureCodeIsValid(issue.code) ||
    issue.locator.kind !== 'page_item' ||
    issue.locator.collectionRole !==
      'page_action_semantic_coverage' ||
    !(
      (issue.code === 'represented_elsewhere_value_mismatch' &&
        issue.locator.fieldRole === 'payload') ||
      (issue.code !== 'represented_elsewhere_value_mismatch' &&
        issue.locator.fieldRole === 'reference')
    )
  ) {
    return null;
  }
  return {
    pageNumber: issue.locator.pageNumber,
    globalCoverageIndex: issue.locator.itemIndex,
    failureCode: issue.code,
  };
}

function localCoverageTargetForGlobalIndex(args: {
  draftPages: readonly (Record<string, unknown> | null)[];
  pointerTemplate: ActionSemanticCoverageTemplate;
  expectedPageNumber: number;
  globalCoverageIndex: number;
}): {
  page: Record<string, unknown>;
  coverageIndex: number;
  record: Record<string, unknown>;
} | null {
  // actionSemanticCoverageValidation emits itemIndex over its whole-book
  // flattened coverage array, not over the page-local draft array. This lane
  // is admitted only for a complete pure represented-elsewhere census, so all
  // preceding draft coverage records have grounded successfully. Walk the
  // compiler-owned template page order and convert that global coordinate to
  // one page-local target without changing the legacy diagnostic identity.
  if (
    args.draftPages.some((page) => page === null) ||
    args.pointerTemplate.pageContracts.length !== args.draftPages.length
  ) {
    return null;
  }
  const seenPageNumbers = new Set<number>();
  let coverageOffset = 0;
  for (const templatePage of args.pointerTemplate.pageContracts) {
    if (
      !Number.isSafeInteger(templatePage.pageNumber) ||
      templatePage.pageNumber < 1 ||
      seenPageNumbers.has(templatePage.pageNumber)
    ) {
      return null;
    }
    seenPageNumbers.add(templatePage.pageNumber);
    const matchingDraftPages = args.draftPages.filter(
      (page) => page?.pageNumber === templatePage.pageNumber,
    );
    if (matchingDraftPages.length !== 1 || !matchingDraftPages[0]) {
      return null;
    }
    const rawCoverage = matchingDraftPages[0].actionSemanticCoverage;
    if (!Array.isArray(rawCoverage)) return null;
    const nextOffset = coverageOffset + rawCoverage.length;
    if (!Number.isSafeInteger(nextOffset)) return null;
    if (
      args.globalCoverageIndex >= coverageOffset &&
      args.globalCoverageIndex < nextOffset
    ) {
      if (templatePage.pageNumber !== args.expectedPageNumber) return null;
      const coverageIndex =
        args.globalCoverageIndex - coverageOffset;
      const record = recordValue(rawCoverage[coverageIndex]);
      return record
        ? {
            page: matchingDraftPages[0],
            coverageIndex,
            record,
          }
        : null;
    }
    coverageOffset = nextOffset;
  }
  return null;
}

/**
 * Builds the only provider-visible authority admitted by this lane. Diagnostic
 * coordinates are rebound to the exact current coverage records; no
 * page-wide, failure-code-only lookup is used, so same-page same-code targets
 * remain independent.
 */
export function representedElsewhereRepairAuthority(args: {
  draft: Record<string, unknown>;
  diagnosticIssues: readonly DraftValidationIssue[];
  pointerTemplate: ActionSemanticCoverageTemplate;
  sourceEvidenceCatalog: SourceEvidenceCatalog;
}): RepresentedElsewhereRepairAuthority | null {
  if (args.diagnosticIssues.length === 0) return null;
  const draftPages = Array.isArray(args.draft.pageContracts)
    ? args.draft.pageContracts.map(recordValue)
    : [];
  if (
    draftPages.some((page) => page === null) ||
    draftPages.length !== args.pointerTemplate.pageContracts.length
  ) {
    return null;
  }

  const pages = new Map<number, RepresentedElsewhereRepairPageAuthority>();
  const seenTargets = new Set<string>();
  for (const issue of args.diagnosticIssues) {
    const diagnostic = exactDiagnosticTarget(issue);
    if (!diagnostic) return null;
    const matchingTemplatePages = args.pointerTemplate.pageContracts.filter(
      (page) => page.pageNumber === diagnostic.pageNumber,
    );
    const localTarget = localCoverageTargetForGlobalIndex({
      draftPages,
      pointerTemplate: args.pointerTemplate,
      expectedPageNumber: diagnostic.pageNumber,
      globalCoverageIndex: diagnostic.globalCoverageIndex,
    });
    if (!localTarget || matchingTemplatePages.length !== 1) {
      return null;
    }
    const { coverageIndex, record } = localTarget;
    if (
      typeof record.beatId !== 'string' ||
      !new RegExp(
        `^beat:p${diagnostic.pageNumber}:[a-z0-9_]+$`,
      ).test(record.beatId) ||
      representedElsewhereFailureCode({
        pointerTemplate: args.pointerTemplate,
        pageNumber: diagnostic.pageNumber,
        coverage: record,
      }) !== diagnostic.failureCode
    ) {
      return null;
    }
    const sourceResolution = resolveSourceEvidenceId({
      catalog: args.sourceEvidenceCatalog,
      sourceEvidenceId: record.sourceEvidenceId,
      pageNumber: diagnostic.pageNumber,
    });
    if (!sourceResolution.ok || sourceResolution.entry.excerpt.length === 0) {
      return null;
    }
    const target: RepresentedElsewhereRepairTarget = {
      pageNumber: diagnostic.pageNumber,
      coverageIndex,
      beatId: record.beatId,
      sourceEvidenceId: sourceResolution.entry.sourceEvidenceId,
      sourcePhrase: sourceResolution.entry.excerpt,
      failureCode: diagnostic.failureCode,
    };
    const key = targetKey(target);
    if (seenTargets.has(key)) return null;
    seenTargets.add(key);

    let pageAuthority = pages.get(diagnostic.pageNumber);
    if (!pageAuthority) {
      const permittedPointerValues =
        permittedRepresentedElsewherePointerValuesForPage({
          template: args.pointerTemplate,
          pageNumber: diagnostic.pageNumber,
        });
      if (
        permittedPointerValues.length === 0 ||
        !permittedPointerValues.every(pointerValueIsValid) ||
        new Set(
          permittedPointerValues.map((value) => canonicalJson(value)),
        ).size !== permittedPointerValues.length
      ) {
        return null;
      }
      pageAuthority = {
        pageNumber: diagnostic.pageNumber,
        permittedPointerValues: structuredClone(permittedPointerValues),
        targets: [],
      };
      pages.set(diagnostic.pageNumber, pageAuthority);
    }
    pageAuthority.targets.push(target);
  }

  const authority: RepresentedElsewhereRepairAuthority = {
    pages: [...pages.values()]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((page) => ({
        ...page,
        targets: [...page.targets].sort(targetSort),
      })),
  };
  return authorityIsValid(authority) ? authority : null;
}

export const REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT = [
  'You repair ONLY the listed represented_elsewhere coverage dispositions.',
  'Return exactly one patch for every target and no other patch.',
  'For each target, copy pageNumber, coverageIndex, beatId, and sourceEvidenceId exactly.',
  'Choose one zero-based pointerChoiceIndex into that target page\'s ordered permittedPointerValues array.',
  'Targets on the same page share the page-level choice domain but remain independent targets.',
  'Never return a raw contractPointer or contractValue; the compiler resolves the selected pair locally.',
  'Do not return sourcePhrase, failureCode, prose, a page contract, a full draft, or any extra key.',
  'Output only the JSON patch object required by the schema.',
].join('\n');

export const REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT_DIGEST =
  canonicalHash(REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT);

export function buildRepresentedElsewhereRepairSystemPrompt(): string {
  return REPRESENTED_ELSEWHERE_REPAIR_SYSTEM_PROMPT;
}

export function decodeRepresentedElsewhereRepairUserPrompt(
  raw: string,
): RepresentedElsewhereRepairAuthority {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('represented_elsewhere_repair_input_invalid_json');
  }
  if (!authorityIsValid(parsed)) {
    throw new Error('represented_elsewhere_repair_input_invalid_shape');
  }
  return structuredClone(parsed);
}

export function buildRepresentedElsewhereRepairUserPrompt(args: {
  authority: RepresentedElsewhereRepairAuthority;
}): string {
  if (!authorityIsValid(args.authority)) {
    throw new Error('represented_elsewhere_repair_input_invalid_shape');
  }
  const prompt = canonicalJson(args.authority);
  const decoded = decodeRepresentedElsewhereRepairUserPrompt(prompt);
  if (canonicalJson(decoded) !== canonicalJson(args.authority)) {
    throw new Error('represented_elsewhere_repair_input_roundtrip_invalid');
  }
  return prompt;
}

export function parseRepresentedElsewhereRepairPatches(
  raw: string,
): RepresentedElsewhereRepairPatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('represented_elsewhere_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (
    !root ||
    !exactKeys(root, ['patches']) ||
    !Array.isArray(root.patches) ||
    root.patches.length === 0
  ) {
    throw new Error('represented_elsewhere_repair_response_invalid_shape');
  }
  if (!root.patches.every(patchIsValid)) {
    throw new Error('represented_elsewhere_repair_patch_invalid');
  }
  return structuredClone(root.patches);
}

function pageForTarget(args: {
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

function currentCoverageRecord(args: {
  draft: Record<string, unknown>;
  target: RepresentedElsewhereRepairTarget;
}): Record<string, unknown> | null {
  const page = pageForTarget({
    draft: args.draft,
    pageNumber: args.target.pageNumber,
  });
  const coverage = Array.isArray(page?.actionSemanticCoverage)
    ? page.actionSemanticCoverage
    : [];
  return recordValue(coverage[args.target.coverageIndex]);
}

function assertCurrentTarget(args: {
  draft: Record<string, unknown>;
  target: RepresentedElsewhereRepairTarget;
  pointerTemplate: ActionSemanticCoverageTemplate;
}): Record<string, unknown> {
  const record = currentCoverageRecord(args);
  if (!record) {
    throw new RepresentedElsewhereRepairTargetAssociationError({
      pageNumber: args.target.pageNumber,
      coverageIndex: args.target.coverageIndex,
      closedSubreason: 'target_stale',
    });
  }
  const disposition = recordValue(record.disposition);
  if (disposition?.kind !== 'represented_elsewhere') {
    throw new RepresentedElsewhereRepairTargetAssociationError({
      pageNumber: args.target.pageNumber,
      coverageIndex: args.target.coverageIndex,
      closedSubreason: 'kind_drift',
    });
  }
  if (record.beatId !== args.target.beatId) {
    throw new RepresentedElsewhereRepairTargetAssociationError({
      pageNumber: args.target.pageNumber,
      coverageIndex: args.target.coverageIndex,
      closedSubreason: 'beat_drift',
    });
  }
  if (record.sourceEvidenceId !== args.target.sourceEvidenceId) {
    throw new RepresentedElsewhereRepairTargetAssociationError({
      pageNumber: args.target.pageNumber,
      coverageIndex: args.target.coverageIndex,
      closedSubreason: 'source_drift',
    });
  }
  if (
    representedElsewhereFailureCode({
      pointerTemplate: args.pointerTemplate,
      pageNumber: args.target.pageNumber,
      coverage: record,
    }) !== args.target.failureCode
  ) {
    throw new RepresentedElsewhereRepairTargetAssociationError({
      pageNumber: args.target.pageNumber,
      coverageIndex: args.target.coverageIndex,
      closedSubreason: 'target_stale',
    });
  }
  return record;
}

function maskedDraft(args: {
  draft: Record<string, unknown>;
  targets: readonly RepresentedElsewhereRepairTarget[];
}): Record<string, unknown> {
  const clone = structuredClone(args.draft);
  for (const target of args.targets) {
    const record = currentCoverageRecord({ draft: clone, target });
    if (!record) {
      throw new Error('represented_elsewhere_repair_non_target_drift');
    }
    record.disposition = '__represented_elsewhere_repair_target__';
  }
  return clone;
}

export function applyRepresentedElsewhereRepairPatches(args: {
  draft: Record<string, unknown>;
  authority: RepresentedElsewhereRepairAuthority;
  patches: readonly RepresentedElsewhereRepairPatch[];
  pointerTemplate: ActionSemanticCoverageTemplate;
}): Record<string, unknown> {
  if (!authorityIsValid(args.authority)) {
    throw new Error('represented_elsewhere_repair_authority_invalid');
  }
  if (!args.patches.every(patchIsValid)) {
    throw new Error('represented_elsewhere_repair_patch_invalid');
  }
  const targets = args.authority.pages.flatMap((page) => page.targets);
  const expected = new Map(
    targets.map((target) => [targetKey(target), target]),
  );
  if (expected.size !== targets.length) {
    throw new Error('represented_elsewhere_repair_target_duplicate');
  }
  const patchKeys = args.patches.map(targetKey);
  if (new Set(patchKeys).size !== patchKeys.length) {
    throw new Error(
      'represented_elsewhere_repair_patch_unexpected_or_duplicate',
    );
  }
  if (args.patches.length !== expected.size) {
    throw new Error('represented_elsewhere_repair_patch_set_incomplete');
  }

  const pagesByNumber = new Map(
    args.authority.pages.map((page) => [page.pageNumber, page]),
  );
  const selections = new Map<string, RepresentedElsewherePointerValue>();
  for (const patch of args.patches) {
    const key = targetKey(patch);
    const target = expected.get(key);
    if (!target) {
      throw new Error(
        'represented_elsewhere_repair_patch_unexpected_or_duplicate',
      );
    }
    const page = pagesByNumber.get(target.pageNumber)!;
    const matchingTemplatePages = args.pointerTemplate.pageContracts.filter(
      (candidate) => candidate.pageNumber === target.pageNumber,
    );
    const currentDomain =
      permittedRepresentedElsewherePointerValuesForPage({
        template: args.pointerTemplate,
        pageNumber: target.pageNumber,
      });
    if (
      matchingTemplatePages.length !== 1 ||
      canonicalJson(currentDomain) !==
        canonicalJson(page.permittedPointerValues)
    ) {
      throw new RepresentedElsewhereRepairTargetAssociationError({
        pageNumber: target.pageNumber,
        coverageIndex: target.coverageIndex,
        closedSubreason: 'target_stale',
      });
    }
    assertCurrentTarget({
      draft: args.draft,
      target,
      pointerTemplate: args.pointerTemplate,
    });
    const selection = page.permittedPointerValues[patch.pointerChoiceIndex];
    if (!selection) {
      throw new RepresentedElsewhereRepairTargetAssociationError({
        pageNumber: target.pageNumber,
        coverageIndex: target.coverageIndex,
        closedSubreason: 'choice_out_of_range',
      });
    }
    selections.set(key, selection);
  }

  const beforeMasked = canonicalJson(maskedDraft({
    draft: args.draft,
    targets,
  }));
  const result = structuredClone(args.draft);
  for (const target of targets) {
    const record = currentCoverageRecord({ draft: result, target });
    const selection = selections.get(targetKey(target));
    if (!record || !selection) {
      throw new Error('represented_elsewhere_repair_patch_set_incomplete');
    }
    record.disposition = {
      kind: 'represented_elsewhere',
      contractPointer: selection.contractPointer,
      contractValue: selection.contractValue,
    };
  }
  const afterMasked = canonicalJson(maskedDraft({
    draft: result,
    targets,
  }));
  if (afterMasked !== beforeMasked) {
    throw new Error('represented_elsewhere_repair_non_target_drift');
  }
  return result;
}
