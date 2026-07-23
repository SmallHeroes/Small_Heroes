/**
 * Select five distinct structured-risk frames when the book has at least four pages plus a cover. Historical prose
 * and camera-word heuristics are deliberately excluded: explicit calibration evidence may identify the best page
 * for each risk, while safe contract-only fallbacks and deterministic backfill preserve generality.
 */
import type { BookVisualContract, PageVisualContract } from './types';

export type CalibrationRisk =
  | 'cover'
  | 'primary_world'
  | 'reveal_prop_continuity'
  | 'meaningful_interaction'
  | 'emotional_close'
  | 'structured_backfill';

export interface CalibrationRiskEvidence {
  primaryWorldPage?: number;
  revealPropContinuityPage?: number;
  meaningfulInteractionPage?: number;
  emotionalClosePage?: number;
}

export interface CalibrationRiskAssignment {
  pageNumber: number;
  risks: CalibrationRisk[];
}

export interface CalibrationSelection {
  /** Page numbers to render+gate (cover represented as `0`). */
  pageNumbers: number[];
  cover: true;
  establishingLocation: number | null;
  zoneTransitionSamePlace: number | null;
  companionAction: number | null;
  keyProp: number | null;
  emotionalClose: number | null;
  riskAssignments: CalibrationRiskAssignment[];
}

function mostUsedLocationId(pages: PageVisualContract[]): string | null {
  const counts = new Map<string, number>();
  for (const page of pages) {
    counts.set(page.locationId, (counts.get(page.locationId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

function pageExists(pages: PageVisualContract[], pageNumber: number | undefined): pageNumber is number {
  return typeof pageNumber === 'number' && pages.some((page) => page.pageNumber === pageNumber);
}

function zoneTransitionPage(pages: PageVisualContract[]): number | null {
  for (let index = 1; index < pages.length; index += 1) {
    const previous = pages[index - 1]!;
    const current = pages[index]!;
    if (
      current.locationId === previous.locationId &&
      current.zoneId &&
      current.zoneId !== previous.zoneId
    ) {
      return current.pageNumber;
    }
  }
  return null;
}

function firstRevealPage(
  contract: BookVisualContract,
  pages: PageVisualContract[],
): number | null {
  const lifecyclePages = contract.recurringProps
    .map((prop) => prop.firstRevealPage)
    .filter((page): page is number => pageExists(pages, page))
    .sort((a, b) => a - b);
  if (lifecyclePages.length > 0) return lifecyclePages[0]!;
  const requiredPage = pages.find((page) =>
    (page.propConstraints ?? []).some((constraint) => constraint.visibility === 'required')
  )?.pageNumber;
  if (requiredPage !== undefined) return requiredPage;
  const previousState = new Map<string, string>();
  for (const page of pages) {
    for (const state of page.propState ?? []) {
      const previous = previousState.get(state.propId);
      if (previous !== undefined && previous !== state.state) return page.pageNumber;
      previousState.set(state.propId, state.state);
    }
  }
  return pages.find((page) => (page.propState ?? []).length > 0)?.pageNumber ?? null;
}

function interactionPage(pages: PageVisualContract[]): number | null {
  return pages.find((page) =>
    (page.actionRequirements ?? []).some((action) =>
      action.polarity === 'must' && action.object !== undefined
    )
  )?.pageNumber ??
    pages.find((page) => (page.castStates ?? []).some((state) => nonEmpty(state.bodyState)))?.pageNumber ??
    pages.find((page) => page.characterPresence.companion)?.pageNumber ??
    null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function structuredBackfillOrder(pages: PageVisualContract[]): number[] {
  const candidates = [
    ...pages.filter((page) => page.transition && page.transition.kind !== 'steady'),
    ...pages.filter((page) => (page.actionRequirements ?? []).length > 0),
    ...pages.filter((page) =>
      (page.propConstraints ?? []).some((constraint) => constraint.visibility === 'required')
    ),
    ...pages.filter((page) => (page.castStates ?? []).length > 0),
    ...pages,
  ];
  return [...new Set(candidates.map((page) => page.pageNumber))];
}

export function selectCalibrationPages(
  contract: BookVisualContract,
  evidence: CalibrationRiskEvidence = {},
): CalibrationSelection {
  const pages = [...contract.pageContracts].sort((a, b) => a.pageNumber - b.pageNumber);
  const primaryLocationId = mostUsedLocationId(pages);
  const establishingLocation = pageExists(pages, evidence.primaryWorldPage)
    ? evidence.primaryWorldPage
    : pages.find((page) => page.locationId === primaryLocationId)?.pageNumber ??
      pages[0]?.pageNumber ??
      null;
  const keyProp = pageExists(pages, evidence.revealPropContinuityPage)
    ? evidence.revealPropContinuityPage
    : firstRevealPage(contract, pages);
  const companionAction = pageExists(pages, evidence.meaningfulInteractionPage)
    ? evidence.meaningfulInteractionPage
    : interactionPage(pages);
  const emotionalClose = pageExists(pages, evidence.emotionalClosePage)
    ? evidence.emotionalClosePage
    : pages[pages.length - 1]?.pageNumber ?? null;
  const zoneTransitionSamePlace = zoneTransitionPage(pages);

  const assignments = new Map<number, CalibrationRisk[]>();
  const assign = (pageNumber: number | null, risk: CalibrationRisk): void => {
    if (pageNumber === null) return;
    assignments.set(pageNumber, [...(assignments.get(pageNumber) ?? []), risk]);
  };
  assign(0, 'cover');
  assign(establishingLocation, 'primary_world');
  assign(keyProp, 'reveal_prop_continuity');
  assign(companionAction, 'meaningful_interaction');
  assign(emotionalClose, 'emotional_close');

  const targetCount = Math.min(5, pages.length + 1);
  for (const pageNumber of structuredBackfillOrder(pages)) {
    if (assignments.size >= targetCount) break;
    if (!assignments.has(pageNumber)) assign(pageNumber, 'structured_backfill');
  }

  const pageNumbers = [...assignments.keys()];
  return {
    pageNumbers,
    cover: true,
    establishingLocation,
    zoneTransitionSamePlace,
    companionAction,
    keyProp,
    emotionalClose,
    riskAssignments: pageNumbers.map((pageNumber) => ({
      pageNumber,
      risks: assignments.get(pageNumber)!,
    })),
  };
}
