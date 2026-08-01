/**
 * Adapts checked-in contract candidates into current authoring-draft fixtures.
 *
 * Historical candidates intentionally remain immutable and do not acquire
 * authoring-only Action Semantic Coverage. Tests add exact, review-only
 * evidence at their simulated provider boundary instead.
 */
export function withCurrentActionSemanticCoverage<
  Draft extends {
    pageContracts: Array<object>;
  },
>(args: {
  draft: Draft;
  pages: readonly {
    pageNumber: number;
    text: string;
  }[];
  sourceEvidenceCatalog: {
    entries: Array<{
      sourceEvidenceId: string;
      pageNumber: number;
    }>;
  };
}): Draft {
  for (const [pageIndex, rawPage] of args.draft.pageContracts.entries()) {
    const page = rawPage as Record<string, unknown>;
    const pageNumber = Number(page.pageNumber);
    const sourcePage = args.pages.find(
      (candidate) => candidate.pageNumber === pageNumber,
    );
    const contractValue = page.locationId;
    const sourceEvidence = args.sourceEvidenceCatalog.entries.find(
      (entry) => entry.pageNumber === pageNumber,
    );
    if (
      !sourcePage ||
      !sourceEvidence ||
      typeof contractValue !== 'string' ||
      contractValue.length === 0
    ) {
      throw new Error(
        `Current authoring fixture cannot bind page ${pageNumber}`,
      );
    }
    page.actionSemanticCoverage = [
      {
        beatId: `beat:p${pageNumber}:fixture_contract`,
        sourceEvidenceId: sourceEvidence.sourceEvidenceId,
        disposition: {
          kind: 'represented_elsewhere',
          contractPointer: `/pageContracts/${pageIndex}/locationId`,
          contractValue,
        },
      },
    ];
  }
  return args.draft;
}
