import type {
  BookVisualContract,
  PagePropConstraint,
  PageVisualContract,
  PropVisibility,
} from './types';

export type EffectivePropVisibility = PropVisibility | 'permitted';

function explicitConstraint(
  page: Pick<PageVisualContract, 'propConstraints'> | null | undefined,
  propId: string,
): PagePropConstraint | undefined {
  return page?.propConstraints?.find((constraint) => constraint.propId === propId);
}

/**
 * Resolve one prop's authoritative visibility for a cover/page.
 *
 * Page 0 is the cover. A lifecycle makes the prop forbidden before `firstRevealPage`, independently of prose.
 * Page constraints remain the explicit page contract; validation rejects a `required` constraint that disagrees
 * with the lifecycle. Absence after the reveal means permitted, not required.
 */
export function effectivePropVisibility(
  contract: Pick<BookVisualContract, 'recurringProps' | 'pageContracts'>,
  pageNumber: number,
  propId: string,
): EffectivePropVisibility {
  const prop = contract.recurringProps.find((candidate) => candidate.id === propId);
  const page = pageNumber === 0
    ? null
    : contract.pageContracts.find((candidate) => candidate.pageNumber === pageNumber);
  const explicit = explicitConstraint(page, propId);

  if (prop?.firstRevealPage !== undefined && pageNumber < prop.firstRevealPage) {
    return 'forbidden';
  }
  return explicit?.visibility ?? 'permitted';
}

export function requiredPropIdsForPage(
  contract: Pick<BookVisualContract, 'recurringProps' | 'pageContracts'>,
  pageNumber: number,
): string[] {
  return contract.recurringProps
    .map((prop) => prop.id)
    .filter((propId) => effectivePropVisibility(contract, pageNumber, propId) === 'required')
    .sort();
}

export function forbiddenPropIdsForPage(
  contract: Pick<BookVisualContract, 'recurringProps' | 'pageContracts'>,
  pageNumber: number,
): string[] {
  return contract.recurringProps
    .map((prop) => prop.id)
    .filter((propId) => effectivePropVisibility(contract, pageNumber, propId) === 'forbidden')
    .sort();
}
