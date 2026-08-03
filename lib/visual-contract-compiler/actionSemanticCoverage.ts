export const ACTION_SEMANTIC_COVERAGE_VERSION =
  'action-semantic-coverage/v3' as const;

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
      lexicalCompare(left.beatId, right.beatId) ||
      lexicalCompare(left.sourcePhrase, right.sourcePhrase),
  );
}

export class ActionSemanticCapabilityGapError extends Error {
  readonly gaps: ActionSemanticCapabilityGap[];

  constructor(gaps: readonly ActionSemanticCapabilityGap[]) {
    const sorted = sortActionSemanticCapabilityGaps(gaps);
    super(
      `closed Action Semantic Catalog cannot represent ${sorted.length} required visual beat(s) across ${new Set(sorted.map((gap) => gap.pageNumber)).size} page(s)`,
    );
    this.name = 'ActionSemanticCapabilityGapError';
    this.gaps = sorted;
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

export function actionSemanticCoverageIssues(args: {
  template: ActionSemanticCoverageTemplate;
  coverage: readonly ActionSemanticCoverageRecord[];
}): string[] {
  const issues: string[] = [];
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
      issues.push(
        `${label}.beatId "${record.beatId}" must be stable and page-scoped (${String(expectedBeatPattern)})`,
      );
    } else if (seenBeatIds.has(record.beatId)) {
      issues.push(`${label}.beatId "${record.beatId}" is duplicated`);
    } else {
      seenBeatIds.add(record.beatId);
    }
    pagesWithCoverage.add(record.pageNumber);

    const page = pageByNumber(args.template, record.pageNumber);
    if (!page) {
      issues.push(
        `${label}.pageNumber ${record.pageNumber} does not resolve`,
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
        issues.push(
          `${label}.disposition.checkId "${checkId}" must bind exactly one same-page actionRequirement`,
        );
      } else {
        const subject = recordValue(matches[0]?.subject);
        if (subject?.kind === 'source_phenomenon') {
          if (
            subject.sourceEvidenceId !== record.sourceEvidenceId ||
            subject.sourcePhrase !== record.sourcePhrase
          ) {
            issues.push(
              `${label}.disposition.checkId "${checkId}" source_phenomenon subject must bind this exact same-page Source Evidence record`,
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
        issues.push(
          `${label}.disposition.contractPointer must target a structured non-action, non-prose field on the exact same page`,
        );
        continue;
      }
      const resolved = resolveJsonPointer(args.template, pointer);
      if (!resolved.found) {
        issues.push(
          `${label}.disposition.contractPointer "${pointer}" does not resolve`,
        );
      } else if (
        typeof resolved.value !== 'string' ||
        resolved.value !== record.disposition.contractValue
      ) {
        issues.push(
          `${label}.disposition.contractValue does not exactly match the current pointed-to string value`,
        );
      }
    }
  }

  for (const page of args.template.pageContracts) {
    if (!pagesWithCoverage.has(page.pageNumber)) {
      issues.push(
        `page ${page.pageNumber}: action_semantic_coverage_missing`,
      );
    }
    const bound =
      boundActionCheckIdsByPage.get(page.pageNumber) ??
      new Set<string>();
    for (const action of page.actionRequirements ?? []) {
      if (!bound.has(action.checkId)) {
        issues.push(
          `page ${page.pageNumber}: actionRequirement "${action.checkId}" has no Action Semantic Coverage binding`,
        );
      }
    }
  }
  return issues;
}

export function assertCompleteActionSemanticCoverage(args: {
  template: ActionSemanticCoverageTemplate;
  coverage: readonly ActionSemanticCoverageRecord[];
}): void {
  const issues = actionSemanticCoverageIssues(args);
  if (issues.length > 0) {
    throw new Error(
      `Action Semantic Coverage is incomplete:\n- ${issues.join('\n- ')}`,
    );
  }
}
