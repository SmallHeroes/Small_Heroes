import {
  resolveSourceEvidenceId,
  type SourceEvidenceCatalog,
} from './sourceEvidenceCatalog';

/**
 * Projects the provider-wire continuity selectors onto the exact page shape
 * consumed by final validation. Keeping this transformation shared prevents
 * the initial/full-draft binder from minting pointers to fields that the
 * compiler later removes.
 */
export function projectDraftPageContinuitySelections(args: {
  pageDraft: Record<string, unknown>;
  pageNumber: number;
  sourceEvidenceCatalog: SourceEvidenceCatalog;
}): Record<string, unknown> {
  const out = { ...args.pageDraft };
  const draftChildWardrobeOverrideDescription =
    args.pageDraft.childWardrobeOverrideDescription;
  const draftChildWardrobeOverrideSourceEvidenceId =
    args.pageDraft.childWardrobeOverrideSourceEvidenceId;
  delete out.childWardrobeOverrideDescription;
  delete out.childWardrobeOverrideSourceEvidenceId;
  if (
    (draftChildWardrobeOverrideDescription !== null &&
      draftChildWardrobeOverrideDescription !== undefined) ||
    (draftChildWardrobeOverrideSourceEvidenceId !== null &&
      draftChildWardrobeOverrideSourceEvidenceId !== undefined)
  ) {
    const sourceResolution = resolveSourceEvidenceId({
      catalog: args.sourceEvidenceCatalog,
      sourceEvidenceId:
        draftChildWardrobeOverrideSourceEvidenceId,
      pageNumber: args.pageNumber,
    });
    out.childWardrobeOverride = {
      description:
        typeof draftChildWardrobeOverrideDescription === 'string'
          ? draftChildWardrobeOverrideDescription.trim()
          : '',
      origin: {
        kind: 'story_evidence',
        page: args.pageNumber,
        phrase: sourceResolution.ok
          ? sourceResolution.entry.excerpt
          : '',
      },
    };
  }

  const draftCompanionStateId = args.pageDraft.companionStateId;
  const draftCompanionStateSourceEvidenceId =
    args.pageDraft.companionStateSourceEvidenceId;
  delete out.companionStateId;
  delete out.companionStateSourceEvidenceId;
  if (
    (draftCompanionStateId !== null &&
      draftCompanionStateId !== undefined) ||
    (draftCompanionStateSourceEvidenceId !== null &&
      draftCompanionStateSourceEvidenceId !== undefined)
  ) {
    const sourceResolution = resolveSourceEvidenceId({
      catalog: args.sourceEvidenceCatalog,
      sourceEvidenceId: draftCompanionStateSourceEvidenceId,
      pageNumber: args.pageNumber,
    });
    out.companionStateOverride = {
      stateId:
        typeof draftCompanionStateId === 'string'
          ? draftCompanionStateId.trim()
          : '',
      origin: {
        kind: 'story_evidence',
        page: args.pageNumber,
        phrase: sourceResolution.ok
          ? sourceResolution.entry.excerpt
          : '',
      },
    };
  }

  return out;
}
