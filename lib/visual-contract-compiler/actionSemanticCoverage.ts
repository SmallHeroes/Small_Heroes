import {
  buildDraftValidationDiagnosticTrail,
  type DraftValidationAttemptDiagnostics,
  type DraftValidationIssue,
} from './draftValidationDiagnostics';

export const ACTION_SEMANTIC_COVERAGE_VERSION =
  'action-semantic-coverage/v5' as const;

export const ACTION_SEMANTIC_COVERAGE_DISPOSITION_VALUES = [
  'action_requirement',
  'represented_elsewhere',
  'non_visual',
  'unsupported',
] as const;

export const NON_VISUAL_RATIONALE_VALUES = [
  'internal_state',
  'dialogue_only',
  'sound_only',
  'narrative_context',
  'temporal_context',
  'non_depictable_abstraction',
] as const;

export type NonVisualRationale =
  (typeof NON_VISUAL_RATIONALE_VALUES)[number];

export type ActionSemanticCoverageDisposition =
  | {
      kind: 'action_requirement';
      checkId: string;
    }
  | {
      kind: 'represented_elsewhere';
      contractPointer: string;
      contractValue: string;
    }
  | {
      kind: 'non_visual';
      rationale: NonVisualRationale;
    }
  | {
      kind: 'unsupported';
      reason: 'closed_action_catalog_gap';
    };

export interface ActionSemanticCoverageRecord {
  version: typeof ACTION_SEMANTIC_COVERAGE_VERSION;
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
  /** Exact Story Source excerpt resolved locally from sourceEvidenceId. */
  sourcePhrase: string;
  disposition: Exclude<
    ActionSemanticCoverageDisposition,
    { kind: 'unsupported' }
  >;
  /**
   * Coverage is compiler-checked review evidence only. It never approves its
   * own semantic classification; later Semantic Reconciliation owns that.
   */
  reviewState: 'unreviewed';
}

export interface ActionSemanticCapabilityGap {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  sourcePhrase: string;
  reason: 'closed_action_catalog_gap';
}

export interface DraftActionSemanticCoverageRecord {
  beatId: string;
  sourceEvidenceId: string;
  disposition:
    | { kind: 'action_requirement' }
    | Exclude<
        ActionSemanticCoverageDisposition,
        { kind: 'action_requirement' }
      >;
}

export interface ActionSemanticCoverageTemplate {
  pageContracts: Array<{
    pageNumber: number;
    actionRequirements?: Array<{
      checkId: string;
      subject?: unknown;
    }>;
  }>;
}

export interface ActionSemanticCoverageValidation {
  errors: string[];
  diagnosticIssues: readonly DraftValidationIssue[];
}

function emitActionSemanticIssue(
  errors: string[],
  diagnosticIssues: DraftValidationIssue[],
  error: string,
  issue: DraftValidationIssue,
): void {
  errors.push(error);
  diagnosticIssues.push(issue);
}

function actionSemanticCoverageLocator(
  record: Pick<ActionSemanticCoverageRecord, 'pageNumber'>,
  index: number,
  fieldRole:
    | 'identity'
    | 'reference'
    | 'coverage'
    | 'action_binding'
    | 'source_evidence'
    | 'disposition'
    | 'payload',
): DraftValidationIssue['locator'] {
  return Number.isSafeInteger(record.pageNumber) && record.pageNumber > 0
    ? {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole,
        pageNumber: record.pageNumber,
        itemIndex: index,
      }
    : {
        kind: 'collection_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole,
        itemIndex: index,
      };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isProseOnlyPagePointer(prefix: string, pointer: string): boolean {
  return [
    `${prefix}mustShow/`,
    `${prefix}mustNotShow/`,
    `${prefix}camera`,
    `${prefix}shot`,
    `${prefix}transition/cue`,
  ].some(
    (candidate) =>
      pointer === candidate || pointer.startsWith(candidate),
  );
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortActionSemanticCapabilityGaps(
  gaps: readonly ActionSemanticCapabilityGap[],
): ActionSemanticCapabilityGap[] {
  return [...gaps].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.coverageIndex - right.coverageIndex ||
      lexicalCompare(left.beatId, right.beatId) ||
      lexicalCompare(left.sourcePhrase, right.sourcePhrase),
  );
}

export function actionSemanticCapabilityGapDiagnosticIssues(
  gaps: readonly ActionSemanticCapabilityGap[],
): DraftValidationIssue[] {
  return sortActionSemanticCapabilityGaps(gaps).map((gap) => ({
    family: 'action_semantic',
    code: 'closed_catalog_capability_gap',
    locator: actionSemanticCoverageLocator(
      gap,
      gap.coverageIndex,
      'disposition',
    ),
  }));
}

export class ActionSemanticCapabilityGapError extends Error {
  readonly gaps: ActionSemanticCapabilityGap[];
  readonly diagnosticIssues: DraftValidationIssue[];
  readonly diagnosticIssuesByAttempt: readonly (
    readonly DraftValidationIssue[]
  )[];
  readonly draftValidationDiagnostics: readonly DraftValidationAttemptDiagnostics[];

  constructor(
    gaps: readonly ActionSemanticCapabilityGap[],
    previousDiagnosticIssuesByAttempt: readonly (
      readonly DraftValidationIssue[]
    )[] = [],
  ) {
    const sorted = sortActionSemanticCapabilityGaps(gaps);
    super(
      `closed Action Semantic Catalog cannot represent ${sorted.length} required visual beat(s) across ${new Set(sorted.map((gap) => gap.pageNumber)).size} page(s)`,
    );
    this.name = 'ActionSemanticCapabilityGapError';
    this.gaps = sorted;
    this.diagnosticIssues = actionSemanticCapabilityGapDiagnosticIssues(
      sorted,
    );
    this.diagnosticIssuesByAttempt = [
      ...previousDiagnosticIssuesByAttempt.map((issues) => [...issues]),
      this.diagnosticIssues,
    ];
    this.draftValidationDiagnostics =
      buildDraftValidationDiagnosticTrail(
        this.diagnosticIssuesByAttempt,
      );
  }
}

function decodeJsonPointerToken(token: string): string | null {
  if (/~(?:[^01]|$)/.test(token)) return null;
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolveJsonPointer(
  root: unknown,
  pointer: string,
): { found: true; value: unknown } | { found: false } {
  if (pointer === '') return { found: true, value: root };
  if (!pointer.startsWith('/')) return { found: false };
  let current = root;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = decodeJsonPointerToken(rawToken);
    if (token === null) return { found: false };
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/.test(token)) {
        return { found: false };
      }
      const index = Number(token);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }
    if (
      typeof current !== 'object' ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, token)
    ) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[token];
  }
  return { found: true, value: current };
}

function coveragePrefixForPage(
  template: ActionSemanticCoverageTemplate,
  pageNumber: number,
): string | null {
  const pageIndex = template.pageContracts.findIndex(
    (page) => page.pageNumber === pageNumber,
  );
  return pageIndex < 0 ? null : `/pageContracts/${pageIndex}/`;
}

function pageByNumber(
  template: ActionSemanticCoverageTemplate,
  pageNumber: number,
) {
  return template.pageContracts.find(
    (page) => page.pageNumber === pageNumber,
  );
}

export function actionSemanticCoverageValidation(args: {
  template: ActionSemanticCoverageTemplate;
  coverage: readonly ActionSemanticCoverageRecord[];
}): ActionSemanticCoverageValidation {
  const issues: string[] = [];
  const diagnosticIssues: DraftValidationIssue[] = [];
  const seenBeatIds = new Set<string>();
  const pagesWithCoverage = new Set<number>();
  const boundActionCheckIdsByPage = new Map<
    number,
    Set<string>
  >();

  for (const [index, record] of args.coverage.entries()) {
    const label = `actionSemanticCoverage[${index}]`;
    const expectedBeatPattern = new RegExp(
      `^beat:p${record.pageNumber}:[a-z0-9_]+$`,
    );
    if (!expectedBeatPattern.test(record.beatId)) {
      emitActionSemanticIssue(
        issues,
        diagnosticIssues,
        `${label}.beatId "${record.beatId}" must be stable and page-scoped (${String(expectedBeatPattern)})`,
        {
          family: 'action_semantic',
          code: 'beat_identity_out_of_scope',
          locator: actionSemanticCoverageLocator(record, index, 'identity'),
        },
      );
    } else if (seenBeatIds.has(record.beatId)) {
      emitActionSemanticIssue(
        issues,
        diagnosticIssues,
        `${label}.beatId "${record.beatId}" is duplicated`,
        {
          family: 'action_semantic',
          code: 'beat_identity_duplicate',
          locator: actionSemanticCoverageLocator(record, index, 'identity'),
        },
      );
    } else {
      seenBeatIds.add(record.beatId);
    }
    pagesWithCoverage.add(record.pageNumber);

    const page = pageByNumber(args.template, record.pageNumber);
    if (!page) {
      emitActionSemanticIssue(
        issues,
        diagnosticIssues,
        `${label}.pageNumber ${record.pageNumber} does not resolve`,
        {
          family: 'action_semantic',
          code: 'beat_identity_out_of_scope',
          locator: actionSemanticCoverageLocator(record, index, 'reference'),
        },
      );
      continue;
    }

    if (record.disposition.kind === 'action_requirement') {
      const checkId = record.disposition.checkId;
      const matches = (page.actionRequirements ?? []).filter(
        (action) =>
          action.checkId === checkId,
      );
      if (matches.length !== 1) {
        emitActionSemanticIssue(
          issues,
          diagnosticIssues,
          `${label}.disposition.checkId "${checkId}" must bind exactly one same-page actionRequirement`,
          {
            family: 'action_semantic',
            code: 'action_binding_cardinality_invalid',
            locator: actionSemanticCoverageLocator(record, index, 'action_binding'),
          },
        );
      } else {
        const subject = recordValue(matches[0]?.subject);
        if (subject?.kind === 'source_phenomenon') {
          if (
            subject.sourceEvidenceId !== record.sourceEvidenceId ||
            subject.sourcePhrase !== record.sourcePhrase
          ) {
            emitActionSemanticIssue(
              issues,
              diagnosticIssues,
              `${label}.disposition.checkId "${checkId}" source_phenomenon subject must bind this exact same-page Source Evidence record`,
              {
                family: 'action_semantic',
                code: 'source_phenomenon_binding_mismatch',
                locator: actionSemanticCoverageLocator(record, index, 'source_evidence'),
              },
            );
          }
        }
        const bound =
          boundActionCheckIdsByPage.get(record.pageNumber) ??
          new Set<string>();
        bound.add(checkId);
        boundActionCheckIdsByPage.set(record.pageNumber, bound);
      }
      continue;
    }

    if (record.disposition.kind === 'represented_elsewhere') {
      const prefix = coveragePrefixForPage(
        args.template,
        record.pageNumber,
      );
      const pointer = record.disposition.contractPointer;
      if (
        prefix === null ||
        !pointer.startsWith(prefix) ||
        pointer.startsWith(`${prefix}actionRequirements/`) ||
        isProseOnlyPagePointer(prefix, pointer)
      ) {
        emitActionSemanticIssue(
          issues,
          diagnosticIssues,
          `${label}.disposition.contractPointer must target a structured non-action, non-prose field on the exact same page`,
          {
            family: 'action_semantic',
            code: 'represented_elsewhere_pointer_out_of_scope',
            locator: actionSemanticCoverageLocator(record, index, 'reference'),
          },
        );
        continue;
      }
      const resolved = resolveJsonPointer(args.template, pointer);
      if (!resolved.found) {
        emitActionSemanticIssue(
          issues,
          diagnosticIssues,
          `${label}.disposition.contractPointer "${pointer}" does not resolve`,
          {
            family: 'action_semantic',
            code: 'represented_elsewhere_pointer_unresolved',
            locator: actionSemanticCoverageLocator(record, index, 'reference'),
          },
        );
      } else if (
        typeof resolved.value !== 'string' ||
        resolved.value !== record.disposition.contractValue
      ) {
        emitActionSemanticIssue(
          issues,
          diagnosticIssues,
          `${label}.disposition.contractValue does not exactly match the current pointed-to string value`,
          {
            family: 'action_semantic',
            code: 'represented_elsewhere_value_mismatch',
            locator: actionSemanticCoverageLocator(record, index, 'payload'),
          },
        );
      }
    }
  }

  for (const [pageIndex, page] of args.template.pageContracts.entries()) {
    if (!pagesWithCoverage.has(page.pageNumber)) {
      emitActionSemanticIssue(
        issues,
        diagnosticIssues,
        `page ${page.pageNumber}: action_semantic_coverage_missing`,
        {
          family: 'action_semantic',
          code: 'coverage_missing',
          locator: Number.isSafeInteger(page.pageNumber) && page.pageNumber > 0
            ? { kind: 'page', fieldRole: 'coverage', pageNumber: page.pageNumber }
            : { kind: 'collection_item', collectionRole: 'page_contracts', fieldRole: 'coverage', itemIndex: pageIndex },
        },
      );
    }
    const bound =
      boundActionCheckIdsByPage.get(page.pageNumber) ??
      new Set<string>();
    for (const [actionIndex, action] of (page.actionRequirements ?? []).entries()) {
      if (!bound.has(action.checkId)) {
        emitActionSemanticIssue(
          issues,
          diagnosticIssues,
          `page ${page.pageNumber}: actionRequirement "${action.checkId}" has no Action Semantic Coverage binding`,
          {
            family: 'action_semantic',
            code: 'action_binding_missing',
            locator: Number.isSafeInteger(page.pageNumber) && page.pageNumber > 0
              ? {
                  kind: 'page_item',
                  collectionRole: 'page_actions',
                  fieldRole: 'action_binding',
                  pageNumber: page.pageNumber,
                  itemIndex: actionIndex,
                }
              : {
                  kind: 'collection_item',
                  collectionRole: 'page_actions',
                  fieldRole: 'action_binding',
                  itemIndex: actionIndex,
                },
          },
        );
      }
    }
  }
  return {
    errors: issues,
    diagnosticIssues,
  };
}

export function actionSemanticCoverageIssues(args: {
  template: ActionSemanticCoverageTemplate;
  coverage: readonly ActionSemanticCoverageRecord[];
}): string[] {
  return actionSemanticCoverageValidation(args).errors;
}

export function assertCompleteActionSemanticCoverage(args: {
  template: ActionSemanticCoverageTemplate;
  coverage: readonly ActionSemanticCoverageRecord[];
}): void {
  const validation = actionSemanticCoverageValidation(args);
  if (validation.errors.length > 0) {
    throw new Error(
      `Action Semantic Coverage is incomplete:\n- ${validation.errors.join('\n- ')}`,
    );
  }
}
