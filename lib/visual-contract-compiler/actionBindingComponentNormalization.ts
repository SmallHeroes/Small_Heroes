import { canonicalHash } from '@/lib/canonical-json';

import {
  resolveSourceEvidenceId,
  type SourceEvidenceCatalog,
} from './sourceEvidenceCatalog';

export const ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION =
  'action-binding-component-normalization/v1' as const;
export const ACTION_MISSING_BINDING_NORMALIZATION_VERSION =
  'action-missing-binding-normalization/v1' as const;

export interface ActionBindingComponentNormalization {
  version: typeof ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION;
  pageNumber: number;
  sourceBeatId: string;
  memberActionIndexes: number[];
  sourceCoverageIndex: number;
  sourceEvidenceId: string;
  generatedBindings: Array<{
    actionIndex: number;
    beatId: string;
    coverageIndex: number;
  }>;
}

export interface ActionMissingBindingNormalization {
  version: typeof ACTION_MISSING_BINDING_NORMALIZATION_VERSION;
  pageNumber: number;
  actionIndex: number;
  beatId: string;
  sourceEvidenceId: string;
  coverageIndex: number;
}

export interface ExactActionBindingComponentNormalizationResult {
  pages: Record<string, unknown>[];
  normalizations: ActionBindingComponentNormalization[];
  missingBindingNormalizations: ActionMissingBindingNormalization[];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function generatedBeatId(args: {
  pageNumber: number;
  sourceBeatId: string;
  memberActionIndexes: readonly number[];
  sourceCoverageIndex: number;
  actionIndex: number;
  usedBeatIds: Set<string>;
}): string {
  const digest = canonicalHash({
    version: ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION,
    pageNumber: args.pageNumber,
    sourceBeatId: args.sourceBeatId,
    memberActionIndexes: [...args.memberActionIndexes],
    sourceCoverageIndex: args.sourceCoverageIndex,
    actionIndex: args.actionIndex,
  });
  const base = `beat:p${args.pageNumber}:compiler_action_${digest}`;
  let candidate = base;
  let collisionOrdinal = 1;
  while (args.usedBeatIds.has(candidate)) {
    candidate = `${base}_${collisionOrdinal}`;
    collisionOrdinal += 1;
  }
  args.usedBeatIds.add(candidate);
  return candidate;
}

function normalizationInvariant(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error(
      'action_binding_component_normalization_invariant_failed',
    );
  }
}

function assertNormalizationPostconditions(args: {
  pageNumber: number;
  originalActions: readonly unknown[];
  originalCoverage: readonly unknown[];
  normalizedActions: readonly unknown[];
  normalizedCoverage: readonly unknown[];
  normalizations: readonly ActionBindingComponentNormalization[];
  missingBindingNormalizations: readonly ActionMissingBindingNormalization[];
}): void {
  const generatedBindings = args.normalizations.flatMap(
    (normalization) => normalization.generatedBindings,
  );
  const modifiedActionIndexes = new Set(
    generatedBindings.map((binding) => binding.actionIndex),
  );
  normalizationInvariant(
    args.normalizedActions.length === args.originalActions.length,
  );
  normalizationInvariant(
    args.normalizedCoverage.length ===
      args.originalCoverage.length +
        generatedBindings.length +
        args.missingBindingNormalizations.length,
  );

  for (const [actionIndex, originalAction] of args.originalActions.entries()) {
    const normalizedAction = args.normalizedActions[actionIndex];
    if (!modifiedActionIndexes.has(actionIndex)) {
      normalizationInvariant(
        canonicalHash(normalizedAction) === canonicalHash(originalAction),
      );
      continue;
    }
    const originalRecord = recordValue(originalAction);
    const normalizedRecord = recordValue(normalizedAction);
    normalizationInvariant(Boolean(originalRecord && normalizedRecord));
    const originalWithoutBeat = { ...originalRecord };
    const normalizedWithoutBeat = { ...normalizedRecord };
    delete originalWithoutBeat.beatId;
    delete normalizedWithoutBeat.beatId;
    normalizationInvariant(
      canonicalHash(normalizedWithoutBeat) ===
        canonicalHash(originalWithoutBeat),
    );
  }
  for (const [coverageIndex, originalRecord] of args.originalCoverage.entries()) {
    normalizationInvariant(
      canonicalHash(args.normalizedCoverage[coverageIndex]) ===
        canonicalHash(originalRecord),
    );
  }

  const expectedGeneratedCoverageIndexes = new Set(
    Array.from(
      {
        length:
          generatedBindings.length +
          args.missingBindingNormalizations.length,
      },
      (_, offset) => args.originalCoverage.length + offset,
    ),
  );
  const observedGeneratedCoverageIndexes = new Set(
    [
      ...generatedBindings.map((binding) => binding.coverageIndex),
      ...args.missingBindingNormalizations.map(
        (normalization) => normalization.coverageIndex,
      ),
    ],
  );
  normalizationInvariant(
    expectedGeneratedCoverageIndexes.size ===
      observedGeneratedCoverageIndexes.size &&
      [...expectedGeneratedCoverageIndexes].every((index) =>
        observedGeneratedCoverageIndexes.has(index),
      ),
  );

  const pageBeatIdPattern = new RegExp(
    `^beat:p${args.pageNumber}:[a-z0-9_]+$`,
  );
  for (const normalization of args.normalizations) {
    normalizationInvariant(
      normalization.memberActionIndexes.length >= 2 &&
        normalization.generatedBindings.length ===
          normalization.memberActionIndexes.length - 1,
    );
    const memberBeatIds: string[] = [];
    for (const [memberOffset, actionIndex] of
      normalization.memberActionIndexes.entries()) {
      const action = recordValue(args.normalizedActions[actionIndex]);
      const beatId = action?.beatId;
      normalizationInvariant(
        typeof beatId === 'string' && pageBeatIdPattern.test(beatId),
      );
      if (memberOffset === 0) {
        normalizationInvariant(beatId === normalization.sourceBeatId);
      } else {
        const generated = normalization.generatedBindings.find(
          (binding) => binding.actionIndex === actionIndex,
        );
        normalizationInvariant(Boolean(generated));
        normalizationInvariant(generated!.beatId === beatId);
      }
      memberBeatIds.push(beatId);

      const matchingCoverage = args.normalizedCoverage.flatMap(
        (rawCoverage, coverageIndex) => {
          const record = recordValue(rawCoverage);
          return record?.beatId === beatId
            ? [{ record, coverageIndex }]
            : [];
        },
      );
      normalizationInvariant(matchingCoverage.length === 1);
      const match = matchingCoverage[0]!;
      const disposition = recordValue(match.record.disposition);
      normalizationInvariant(
        hasExactKeys(match.record, [
          'beatId',
          'sourceEvidenceId',
          'disposition',
        ]) &&
          match.record.sourceEvidenceId === normalization.sourceEvidenceId &&
          Boolean(disposition) &&
          hasExactKeys(disposition!, ['kind']) &&
          disposition!.kind === 'action_requirement',
      );
    }
    normalizationInvariant(
      new Set(memberBeatIds).size === memberBeatIds.length,
    );
  }

  for (const normalization of args.missingBindingNormalizations) {
    const action = recordValue(
      args.normalizedActions[normalization.actionIndex],
    );
    normalizationInvariant(
      canonicalHash(action) ===
        canonicalHash(args.originalActions[normalization.actionIndex]),
    );
    normalizationInvariant(
      action?.beatId === normalization.beatId,
    );
    normalizationInvariant(
      pageBeatIdPattern.test(normalization.beatId),
    );
    const subject = recordValue(action?.subject);
    normalizationInvariant(
      Boolean(subject) &&
        hasExactKeys(subject!, ['kind', 'sourceEvidenceId']) &&
        subject!.kind === 'source_phenomenon' &&
        subject!.sourceEvidenceId === normalization.sourceEvidenceId,
    );
    const matchingActions = args.normalizedActions.filter(
      (candidate) =>
        recordValue(candidate)?.beatId === normalization.beatId,
    );
    normalizationInvariant(matchingActions.length === 1);
    const matchingCoverage = args.normalizedCoverage.flatMap(
      (rawCoverage, coverageIndex) => {
        const record = recordValue(rawCoverage);
        return record?.beatId === normalization.beatId
          ? [{ record, coverageIndex }]
          : [];
      },
    );
    normalizationInvariant(
      matchingCoverage.length === 1 &&
        matchingCoverage[0]!.coverageIndex ===
          normalization.coverageIndex,
    );
    const record = matchingCoverage[0]!.record;
    const disposition = recordValue(record.disposition);
    normalizationInvariant(
      hasExactKeys(record, [
        'beatId',
        'sourceEvidenceId',
        'disposition',
      ]) &&
        record.sourceEvidenceId === normalization.sourceEvidenceId &&
        Boolean(disposition) &&
        hasExactKeys(disposition!, ['kind']) &&
        disposition!.kind === 'action_requirement',
    );
  }
}

/**
 * Deterministically closes two exact mechanical binding defects:
 *
 * - a duplicate action-beat component whose missing 1:1 bindings are fully
 *   determined by one existing canonical same-page coverage record; and
 * - one source-phenomenon action whose beat has no coverage record and whose
 *   exact same-page Source Evidence identity is already carried by its subject.
 *
 * Ambiguous or malformed components are deliberately left byte-for-byte
 * unchanged so the ordinary fail-closed validators retain authority.
 */
export function normalizeExactActionBindingComponents(args: {
  pages: readonly Record<string, unknown>[];
  sourceEvidenceCatalog: SourceEvidenceCatalog;
}): ExactActionBindingComponentNormalizationResult {
  const pages = [...args.pages];
  const normalizations: ActionBindingComponentNormalization[] = [];
  const missingBindingNormalizations: ActionMissingBindingNormalization[] = [];
  const pageNumberCounts = new Map<number, number>();
  for (const page of pages) {
    const pageNumber = page.pageNumber;
    if (Number.isSafeInteger(pageNumber) && Number(pageNumber) > 0) {
      pageNumberCounts.set(
        Number(pageNumber),
        (pageNumberCounts.get(Number(pageNumber)) ?? 0) + 1,
      );
    }
  }

  const pageOrder = pages
    .map((page, pageIndex) => ({
      page,
      pageIndex,
      pageNumber: Number(page.pageNumber),
    }))
    .filter(
      (candidate) =>
        Number.isSafeInteger(candidate.pageNumber) &&
        candidate.pageNumber > 0 &&
        pageNumberCounts.get(candidate.pageNumber) === 1,
    )
    .sort(
      (left, right) =>
        left.pageNumber - right.pageNumber ||
        left.pageIndex - right.pageIndex,
    );

  for (const { page, pageIndex, pageNumber } of pageOrder) {
    if (
      !Array.isArray(page.actionRequirements) ||
      !Array.isArray(page.actionSemanticCoverage)
    ) {
      continue;
    }
    const actions = page.actionRequirements;
    const coverage = page.actionSemanticCoverage;
    const beatIdPattern = new RegExp(
      `^beat:p${pageNumber}:[a-z0-9_]+$`,
    );
    const usedBeatIds = new Set<string>();
    const actionsByBeatId = new Map<
      string,
      Array<{ action: Record<string, unknown>; actionIndex: number }>
    >();

    for (const [actionIndex, rawAction] of actions.entries()) {
      const action = recordValue(rawAction);
      const beatId = action?.beatId;
      if (typeof beatId === 'string') usedBeatIds.add(beatId);
      if (!action || typeof beatId !== 'string' || !beatIdPattern.test(beatId)) {
        continue;
      }
      const members = actionsByBeatId.get(beatId) ?? [];
      members.push({ action, actionIndex });
      actionsByBeatId.set(beatId, members);
    }
    for (const rawCoverage of coverage) {
      const candidate = recordValue(rawCoverage);
      if (typeof candidate?.beatId === 'string') {
        usedBeatIds.add(candidate.beatId);
      }
    }

    const eligibleComponents = [...actionsByBeatId.entries()]
      .filter(([, members]) => members.length >= 2)
      .sort(([left], [right]) => lexicalCompare(left, right))
      .flatMap(([sourceBeatId, members]) => {
        const coverageMatches = coverage.flatMap((rawCoverage, coverageIndex) => {
          const record = recordValue(rawCoverage);
          return record?.beatId === sourceBeatId
            ? [{ record, coverageIndex }]
            : [];
        });
        if (coverageMatches.length !== 1) return [];
        const sourceCoverage = coverageMatches[0]!;
        const disposition = recordValue(sourceCoverage.record.disposition);
        if (
          !hasExactKeys(sourceCoverage.record, [
            'beatId',
            'sourceEvidenceId',
            'disposition',
          ]) ||
          !disposition ||
          !hasExactKeys(disposition, ['kind']) ||
          disposition.kind !== 'action_requirement'
        ) {
          return [];
        }
        const sourceEvidenceId = sourceCoverage.record.sourceEvidenceId;
        const resolution = resolveSourceEvidenceId({
          catalog: args.sourceEvidenceCatalog,
          sourceEvidenceId,
          pageNumber,
        });
        if (!resolution.ok || typeof sourceEvidenceId !== 'string') return [];
        return [
          {
            sourceBeatId,
            members: [...members].sort(
              (left, right) => left.actionIndex - right.actionIndex,
            ),
            sourceCoverageIndex: sourceCoverage.coverageIndex,
            sourceEvidenceId,
          },
        ];
      });

    const eligibleMissingBindings = [...actionsByBeatId.entries()]
      .filter(([, members]) => members.length === 1)
      .sort(([, left], [, right]) =>
        left[0]!.actionIndex - right[0]!.actionIndex,
      )
      .flatMap(([beatId, members]) => {
        const member = members[0]!;
        const action = member.action;
        if (
          !hasExactKeys(action, [
            'beatId',
            'subject',
            'predicate',
            'object',
            'spatialEffect',
            'spatialConstraint',
            'polarity',
            'laterality',
          ]) ||
          coverage.some(
            (rawCoverage) => recordValue(rawCoverage)?.beatId === beatId,
          )
        ) {
          return [];
        }
        const subject = recordValue(action.subject);
        if (
          !subject ||
          !hasExactKeys(subject, ['kind', 'sourceEvidenceId']) ||
          subject.kind !== 'source_phenomenon'
        ) {
          return [];
        }
        const resolution = resolveSourceEvidenceId({
          catalog: args.sourceEvidenceCatalog,
          sourceEvidenceId: subject.sourceEvidenceId,
          pageNumber,
        });
        if (!resolution.ok) return [];
        return [{
          actionIndex: member.actionIndex,
          beatId,
          sourceEvidenceId: resolution.entry.sourceEvidenceId,
        }];
      });

    if (
      eligibleComponents.length === 0 &&
      eligibleMissingBindings.length === 0
    ) {
      continue;
    }

    const normalizedActions = structuredClone(actions) as unknown[];
    const normalizedCoverage = structuredClone(coverage) as unknown[];
    const pageNormalizations: ActionBindingComponentNormalization[] = [];
    const pageMissingBindingNormalizations: ActionMissingBindingNormalization[] = [];
    for (const component of eligibleComponents) {
      const memberActionIndexes = component.members.map(
        (member) => member.actionIndex,
      );
      const generatedBindings: ActionBindingComponentNormalization['generatedBindings'] = [];
      for (const member of component.members.slice(1)) {
        const action = recordValue(normalizedActions[member.actionIndex]);
        if (!action) continue;
        const beatId = generatedBeatId({
          pageNumber,
          sourceBeatId: component.sourceBeatId,
          memberActionIndexes,
          sourceCoverageIndex: component.sourceCoverageIndex,
          actionIndex: member.actionIndex,
          usedBeatIds,
        });
        action.beatId = beatId;
        const coverageIndex = normalizedCoverage.length;
        normalizedCoverage.push({
          beatId,
          sourceEvidenceId: component.sourceEvidenceId,
          disposition: { kind: 'action_requirement' },
        });
        generatedBindings.push({
          actionIndex: member.actionIndex,
          beatId,
          coverageIndex,
        });
      }
      pageNormalizations.push({
        version: ACTION_BINDING_COMPONENT_NORMALIZATION_VERSION,
        pageNumber,
        sourceBeatId: component.sourceBeatId,
        memberActionIndexes,
        sourceCoverageIndex: component.sourceCoverageIndex,
        sourceEvidenceId: component.sourceEvidenceId,
        generatedBindings,
      });
    }
    for (const binding of eligibleMissingBindings) {
      const coverageIndex = normalizedCoverage.length;
      normalizedCoverage.push({
        beatId: binding.beatId,
        sourceEvidenceId: binding.sourceEvidenceId,
        disposition: { kind: 'action_requirement' },
      });
      pageMissingBindingNormalizations.push({
        version: ACTION_MISSING_BINDING_NORMALIZATION_VERSION,
        pageNumber,
        actionIndex: binding.actionIndex,
        beatId: binding.beatId,
        sourceEvidenceId: binding.sourceEvidenceId,
        coverageIndex,
      });
    }
    assertNormalizationPostconditions({
      pageNumber,
      originalActions: actions,
      originalCoverage: coverage,
      normalizedActions,
      normalizedCoverage,
      normalizations: pageNormalizations,
      missingBindingNormalizations:
        pageMissingBindingNormalizations,
    });
    normalizations.push(...pageNormalizations);
    missingBindingNormalizations.push(
      ...pageMissingBindingNormalizations,
    );
    pages[pageIndex] = {
      ...page,
      actionRequirements: normalizedActions,
      actionSemanticCoverage: normalizedCoverage,
    };
  }

  return { pages, normalizations, missingBindingNormalizations };
}
