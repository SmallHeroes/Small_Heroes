import type { PersonalStoryboard } from './storyboard';
import type { auditionSheetDesigns } from './simple-book-reviewed-audition';
import { planAtDrawnInstant } from './storyboard-moments';

type SpatialBook = Pick<PersonalStoryboard, 'plan' | 'sequence' | 'moments'>;
type LocationDesign = ReturnType<typeof auditionSheetDesigns>['locations'];
type Landmark = LocationDesign['landmarks'][number];
type Placement = { entityId: string; relation: string; targetId: string };

export type BlockedRoute = {
  locationId: string;
  routeId: string;
  obstructionId: string;
  route: string;
  beyond: 'dry' | 'empty';
  overhead: string | null;
};

const valueOf = (landmark: Landmark, attribute: string) => landmark.invariants.find(a => a.attribute === attribute)?.value;

/** Use only placements that agree throughout the established state of an owned landmark. */
function fixedPlacements(book: SpatialBook, design: LocationDesign) {
  const owned = new Set([...design.locations, ...design.landmarks].map(row => row.id));
  return design.landmarks.flatMap(({ id }) => {
    const states = book.sequence.pages.flatMap(page => page.states.filter(row => row.entityId === id && row.value.relation !== 'unestablished'));
    const first = states[0]?.value;
    if (!first?.targetId || !owned.has(first.targetId) || states.some(({ value }) =>
      value.relation !== first.relation || value.targetId !== first.targetId)) return [];
    return [{ entityId: id, relation: first.relation, targetId: first.targetId } satisfies Placement];
  });
}

/** Compile a small visual pattern when the admitted design explicitly states both sides of an obstruction. */
export function locationSpatialDirection(book: SpatialBook, design: LocationDesign) {
  const placements = fixedPlacements(book, design);
  const locationOf = (entityId: string) => placements.find(p => p.entityId === entityId &&
    (p.relation === 'at' || p.relation === 'inside') && design.locations.some(l => l.id === p.targetId))?.targetId;
  const routes: BlockedRoute[] = [];
  for (const landmark of design.landmarks) {
    const locationId = locationOf(landmark.id);
    if (!locationId) continue;
    const matches = landmark.invariants.flatMap(({ value }) => [...value.matchAll(
      /(?:^|[.;] |, with )the ([a-z]{2,20}(?: [a-z]{2,20})? (?:branch|channel|ditch|trench|gutter|path|route|passage)) (?:is )?blocked and (dry|empty) beyond (?:its |the )(?:blockage|obstruction|barrier)(?=[.,;]|$)/gi)]);
    if (matches.length !== 1) continue;
    const route = matches[0][1].toLowerCase();
    const beyond = matches[0][2].toLowerCase() === 'dry' ? 'dry' : 'empty';
    const atEnd = new RegExp(`\\bat the end of the ${beyond} ${route}(?=[.,;]|$)`, 'i');
    const blockers = design.landmarks.filter(candidate => candidate.id !== landmark.id && locationOf(candidate.id) === locationId &&
      atEnd.test(valueOf(candidate, 'form') ?? '') &&
      candidate.invariants.some(({ value }) => /^(?:[\w -]+ and )?(?:blocking|blocks|holding back|holds back)\b/i.test(value)));
    if (blockers.length !== 1) continue;
    const above = new RegExp(`\\bthe ${route} (?:passes|runs|continues|extends) (?:beneath|under|below) (the [a-z][a-z -]{1,63})(?=[.;,]|$)`, 'i');
    const overhead = above.exec(valueOf(landmark, 'form') ?? '')?.[1] ?? null;
    routes.push({ locationId, routeId: landmark.id, obstructionId: blockers[0].id, route, beyond, overhead });
  }
  return { placements, routes };
}

export function blockedRouteDrawing({ locationId, routeId, obstructionId, route, beyond, overhead }: BlockedRoute) {
  return [
    `In ${locationId}, give ${routeId} a continuous readable bed. Compose the ${route} in three visible sections: supply side, ${obstructionId} across the route, then the ${beyond} continuation of the same route.`,
    `Show the supply stopping against ${obstructionId}. Past it, keep both edges and the ${beyond} surface visible. Make the obstacle a separate shape interrupting the bed.`,
    ...(overhead ? [`Keep ${overhead} above the route. Give it its own outline and leave the obstacle, edges and surface of the ${beyond} continuation easy to distinguish.`] : []),
    'Leave room around this relationship. Use a slightly elevated view or a side cutaway as needed for a young reader to trace it.',
  ].join(' ');
}

/** Reuse the initial cue on a story frame only while both landmarks are visible and the drawn state still matches. */
export function initialBlockedRoutesOnPage(book: SpatialBook, design: LocationDesign, routes: readonly BlockedRoute[], pageNumber: number) {
  const frame = book.plan.continuity?.pages[pageNumber];
  if (!frame) return [];
  const drawn = book.moments ? planAtDrawnInstant(book.plan, book.moments, pageNumber) : book.plan;
  const changes = drawn.continuity!.pages.slice(0, pageNumber + 1).flatMap(page => page.changes);
  return routes.filter(route => book.plan.pages[pageNumber].locationId === route.locationId &&
    frame.visibleEntityIds.includes(route.routeId) && frame.visibleEntityIds.includes(route.obstructionId) &&
    design.referenceState.mutableAttributes.filter(a => a.entityId === route.routeId || a.entityId === route.obstructionId).every(a => {
      const matches = changes.filter(change => change.entityId === a.entityId && change.attribute === a.attribute);
      const current = matches[matches.length - 1];
      return current === undefined || current.value === a.initialValue;
    }));
}
