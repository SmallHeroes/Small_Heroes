import {
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  permittedRepresentedElsewherePointerValuesForPage,
  type ActionSemanticCoverageTemplate,
  type PresentationRequirementClass,
} from './actionSemanticCoverage';

export const INITIAL_FULL_DRAFT_UNBOUND_REPRESENTED_POINTER =
  '/__compiler_unbound__/represented_elsewhere' as const;
export const INITIAL_FULL_DRAFT_UNBOUND_PRESENTATION_POINTER =
  '/__compiler_unbound__/presentation_requirement' as const;

const UNBOUND_REPRESENTED_VALUE =
  '__compiler_unbound_represented_value__' as const;
const UNBOUND_PRESENTATION_VALUE =
  '__compiler_unbound_presentation_value__' as const;

export interface InitialFullDraftDispositionBindingStats {
  representedBound: number;
  representedUnbound: number;
  representedAmbiguous: number;
  presentationBound: number;
  presentationInvalid: number;
}

export interface InitialFullDraftDispositionBindingResult {
  draft: Record<string, unknown>;
  stats: InitialFullDraftDispositionBindingStats;
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

function compilerOwnedTopologyPointer(pointer: string): boolean {
  return /\/(?:locationId|zoneId|transition\/(?:fromZoneId|toZoneId))$/.test(
    pointer,
  );
}

function providerWireCandidateTemplate(
  pages: readonly unknown[],
): ActionSemanticCoverageTemplate {
  return {
    pageContracts: pages.map((value) => {
      const page = recordValue(value);
      return page
        ? {
            ...structuredClone(page),
            actionSemanticCoverage: [],
          }
        : { pageNumber: Number.NaN, actionSemanticCoverage: [] };
    }),
  } as unknown as ActionSemanticCoverageTemplate;
}

function emptyStats(): InitialFullDraftDispositionBindingStats {
  return {
    representedBound: 0,
    representedUnbound: 0,
    representedAmbiguous: 0,
    presentationBound: 0,
    presentationInvalid: 0,
  };
}

function canonicalUnboundRepresentedElsewhere(): Record<string, unknown> {
  return {
    kind: 'represented_elsewhere',
    contractPointer: INITIAL_FULL_DRAFT_UNBOUND_REPRESENTED_POINTER,
    contractValue: UNBOUND_REPRESENTED_VALUE,
  };
}

function canonicalUnboundPresentation(
  presentationClass: unknown,
): Record<string, unknown> {
  const closedClass = PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
    presentationClass as PresentationRequirementClass,
  )
    ? (presentationClass as PresentationRequirementClass)
    : 'static_state';
  return {
    kind: 'presentation_requirement',
    presentationClass: closedClass,
    contractPointer: INITIAL_FULL_DRAFT_UNBOUND_PRESENTATION_POINTER,
    contractValue: UNBOUND_PRESENTATION_VALUE,
  };
}

/**
 * Converts only the initial/full-draft provider wire disposition into the
 * canonical internal pointer/value contract. Invalid or ambiguous selectors
 * become compiler-owned non-resolving sentinels, so ordinary validation fails
 * closed and no provider-authored pointer or value can cross this boundary.
 */
export function bindInitialFullDraftSamePageDispositions(
  input: Record<string, unknown>,
  candidateTemplate: ActionSemanticCoverageTemplate,
): InitialFullDraftDispositionBindingResult {
  const draft = structuredClone(input);
  const pages = Array.isArray(draft.pageContracts)
    ? draft.pageContracts
    : [];
  const providerWireTemplate = providerWireCandidateTemplate(pages);
  const stats = emptyStats();

  for (const [pageIndex, pageValue] of pages.entries()) {
    const page = recordValue(pageValue);
    if (!page || !Array.isArray(page.actionSemanticCoverage)) continue;
    const pageNumber = page.pageNumber;
    const sameNumberPageCount = Number.isSafeInteger(pageNumber)
      ? pages.filter(
          (candidate) =>
            recordValue(candidate)?.pageNumber === pageNumber,
        ).length
      : 0;
    const mustShow = Array.isArray(page.mustShow) ? page.mustShow : [];

    for (const coverageValue of page.actionSemanticCoverage) {
      const coverage = recordValue(coverageValue);
      const disposition = recordValue(coverage?.disposition);
      if (!coverage || !disposition) continue;

      if (disposition.kind === 'represented_elsewhere') {
        const representedValue =
          exactKeys(disposition, ['kind', 'representedValue']) &&
          typeof disposition.representedValue === 'string'
            ? disposition.representedValue
            : null;
        const finalCandidates =
          representedValue !== null && sameNumberPageCount === 1
            ? permittedRepresentedElsewherePointerValuesForPage({
                template: candidateTemplate,
                pageNumber: pageNumber as number,
              })
            : [];
        const directFinalMatches = finalCandidates.filter(
          (candidate) =>
            candidate.contractValue === representedValue,
        );
        const rawTopologyPointers =
          representedValue === null
            ? []
            : permittedRepresentedElsewherePointerValuesForPage({
                template: providerWireTemplate,
                pageNumber: pageNumber as number,
              })
                .filter(
                  (candidate) =>
                    candidate.contractValue === representedValue &&
                    compilerOwnedTopologyPointer(
                      candidate.contractPointer,
                    ),
                )
                .map((candidate) => candidate.contractPointer);
        const mappedTopologyMatches = finalCandidates.filter(
          (candidate) =>
            rawTopologyPointers.includes(candidate.contractPointer),
        );
        const matches = [
          ...new Map(
            [...directFinalMatches, ...mappedTopologyMatches].map(
              (candidate) => [
                JSON.stringify([
                  candidate.contractPointer,
                  candidate.contractValue,
                ]),
                candidate,
              ],
            ),
          ).values(),
        ];
        if (matches.length === 1) {
          coverage.disposition = {
            kind: 'represented_elsewhere',
            contractPointer: matches[0]!.contractPointer,
            contractValue: matches[0]!.contractValue,
          };
          stats.representedBound += 1;
        } else {
          coverage.disposition =
            canonicalUnboundRepresentedElsewhere();
          if (matches.length > 1) {
            stats.representedAmbiguous += 1;
          } else {
            stats.representedUnbound += 1;
          }
        }
        continue;
      }

      if (disposition.kind === 'presentation_requirement') {
        const mustShowIndex = disposition.mustShowIndex;
        const validShape = exactKeys(disposition, [
          'kind',
          'mustShowIndex',
          'presentationClass',
        ]);
        const contractValue =
          validShape &&
          Number.isSafeInteger(mustShowIndex) &&
          (mustShowIndex as number) >= 0
            ? mustShow[mustShowIndex as number]
            : undefined;
        if (
          typeof contractValue === 'string' &&
          PRESENTATION_REQUIREMENT_CLASS_VALUES.includes(
            disposition.presentationClass as PresentationRequirementClass,
          )
        ) {
          coverage.disposition = {
            kind: 'presentation_requirement',
            presentationClass: disposition.presentationClass,
            contractPointer: `/pageContracts/${pageIndex}/mustShow/${String(mustShowIndex)}`,
            contractValue,
          };
          stats.presentationBound += 1;
        } else {
          coverage.disposition = canonicalUnboundPresentation(
            disposition.presentationClass,
          );
          stats.presentationInvalid += 1;
        }
      }
    }
  }

  return { draft, stats };
}

export function initialFullDraftDispositionBindingNote(
  stats: InitialFullDraftDispositionBindingStats,
): string | null {
  const total = Object.values(stats).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (total === 0) return null;
  return [
    'compiler materialized initial/full-draft same-page disposition bindings',
    `represented_bound=${stats.representedBound}`,
    `represented_unbound=${stats.representedUnbound}`,
    `represented_ambiguous=${stats.representedAmbiguous}`,
    `presentation_bound=${stats.presentationBound}`,
    `presentation_invalid=${stats.presentationInvalid}`,
  ].join(' ');
}
