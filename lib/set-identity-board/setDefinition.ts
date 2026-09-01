/**
 * Set Identity Board v2 — PURE spoiler-neutral base-set projection. NO I/O, clock, or randomness.
 *
 * The projection keeps stable location lighting and structured zone geometry. A prop-bound node is excluded when
 * any cover/page that consumes the physical set forbids that prop or precedes its lifecycle reveal. Relations that
 * depend on an excluded node and the prop's fixed facts are removed with it. Free-form location/zone descriptions,
 * anchors, topology prose, page actions, effects, and prop states are never board authority. The completed
 * projection is then checked by a deterministic canonical-token invariant so an excluded prop cannot re-enter
 * through retained positive free text.
 */
import { canonicalHash } from '@/lib/canonical-json';
import type {
  BookVisualContract,
  PageVisualContract,
  SetBoardStableArea,
  SetBoardStableAuthority,
  SetBoardStableLocation,
  SpatialNode,
  SpatialRelation,
  VisualLocation,
} from '@/lib/visual-contract-compiler';
import { requireSetBoardStableAuthority } from '@/lib/visual-contract-compiler/setBoardStableAuthority';

import {
  SET_BOARD_CONTENT_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_BOARD_RESERVED_EMPTY_PLACEMENTS_VERSION,
  SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION,
  SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION,
  SET_IDENTITY_BOARD_VERSION,
  type SetBoardContentPolicy,
  type SetBoardExcludedProp,
  type SetBoardExclusionReason,
  type SetBoardPositiveAuthorityPolicy,
  type SetBoardPositiveAuthorityPolicyVersion,
  type SetBoardReservedEmptyPlacement,
  type SetDefinition,
  type SetDefinitionFixedFact,
  type SetDefinitionLocation,
  type SetDefinitionZone,
} from './types';
import { currentSetBoardAmbientDressingPolicy } from './ambientDressing';
import {
  collectSetBoardPositiveAuthorityIssues,
  type SetBoardPositiveAuthorityIssue,
} from './positiveAuthoritySpoilerGuard';

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function identityKeyOf(location: VisualLocation): string {
  return location.setIdentityId ?? location.id;
}

export function groupLocationsBySetIdentity(
  contract: BookVisualContract,
): Map<string, VisualLocation[]> {
  const groups = new Map<string, VisualLocation[]>();
  for (const location of contract.locations ?? []) {
    if (!location || typeof location.id !== 'string') continue;
    const key = identityKeyOf(location);
    const bucket = groups.get(key);
    if (bucket) bucket.push(location);
    else groups.set(key, [location]);
  }
  return groups;
}

export function listRequiredSetIdentityIds(contract: BookVisualContract): string[] {
  const required = new Set<string>();
  for (const [identityId, locations] of groupLocationsBySetIdentity(contract)) {
    if (locations.some((location) =>
      location.setReference?.status === 'pending' || location.setReference?.status === 'ready'
    )) {
      required.add(identityId);
    }
  }
  return Array.from(required).sort();
}

function projectLocation(location: SetBoardStableLocation): SetDefinitionLocation {
  return {
    id: location.locationId,
    name: location.name,
    timeOfDay: location.timeOfDay,
    lighting: location.lighting,
    environmentClass: location.environmentClass,
  };
}

function consumingPageNumbers(
  contract: BookVisualContract,
  locationIds: ReadonlySet<string>,
): number[] {
  const pages = new Set<number>();
  if (locationIds.has(contract.coverContract.locationId)) pages.add(0);
  for (const page of contract.pageContracts ?? []) {
    if (locationIds.has(page.locationId)) pages.add(page.pageNumber);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function pageFor(
  contract: BookVisualContract,
  pageNumber: number,
): PageVisualContract | undefined {
  return pageNumber === 0
    ? undefined
    : contract.pageContracts.find((page) => page.pageNumber === pageNumber);
}

function exclusionReasons(
  contract: BookVisualContract,
  propId: string,
  consumers: readonly number[],
): SetBoardExclusionReason[] {
  const prop = contract.recurringProps.find((candidate) => candidate.id === propId);
  const reasons = new Set<SetBoardExclusionReason>();
  // A lifecycle-gated prop is page-conditioned by definition. It remains separate from the reusable base board
  // even when this set first appears on/after the reveal page; the same neutral board must never absorb reveal state.
  if (prop?.firstRevealPage !== undefined) {
    reasons.add('lifecycle');
  }
  if (consumers.some((pageNumber) =>
    pageFor(contract, pageNumber)?.propConstraints?.some(
      (constraint) => constraint.propId === propId && constraint.visibility === 'forbidden',
    )
  )) {
    reasons.add('page_forbidden');
  }
  return Array.from(reasons).sort();
}

function nodeAliases(nodes: readonly SpatialNode[]): Map<string, string> {
  const counts = new Map<string, number>();
  const aliases = new Map<string, string>();
  for (const node of nodes) {
    const count = (counts.get(node.kind) ?? 0) + 1;
    counts.set(node.kind, count);
    aliases.set(node.id, `${node.kind.replace(/_/g, ' ')} ${count}`);
  }
  return aliases;
}

function projectBoardGeometry(
  nodes: readonly SpatialNode[],
  relations: readonly SpatialRelation[],
): string[] {
  const aliases = nodeAliases(nodes);
  const lines = nodes.map((node) => `${aliases.get(node.id)}: ${node.description}`);
  for (const relation of relations) {
    const subject = aliases.get(relation.subjectId);
    const object =
      relation.relation === 'centered_in'
        ? undefined
        : aliases.get(relation.objectId);
    if (!subject) continue;
    const relationLabel = relation.relation.replace(/_/g, ' ');
    lines.push(object ? `${subject} ${relationLabel} ${object}` : `${subject} ${relationLabel}`);
  }
  return lines;
}

function projectZones(areas: readonly SetBoardStableArea[]): SetDefinitionZone[] {
  return byId(areas).flatMap((area) => {
    const spatialNodes: SpatialNode[] = area.spatialNodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      description: node.description,
      ...(node.propId ? { bindsTo: { kind: 'prop' as const, id: node.propId } } : {}),
    }));
    const retainedIds = new Set(spatialNodes.map((node) => node.id));
    const spatialRelations = (area.spatialRelations ?? []).filter(
      (relation) =>
        retainedIds.has(relation.subjectId) &&
        (relation.relation === 'centered_in' ||
          retainedIds.has(relation.objectId)),
    );
    return area.zoneProjection.zoneIds.map((zoneId) => ({
      id: zoneId,
      locationId: area.locationId,
      spatialNodes: structuredClone(spatialNodes),
      spatialRelations: structuredClone(spatialRelations),
      geometry: projectBoardGeometry(spatialNodes, spatialRelations),
    }));
  }).sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
}

function propsAssociatedWithSet(
  contract: BookVisualContract,
  locationIds: ReadonlySet<string>,
  consumers: readonly number[],
): Set<string> {
  const ids = new Set<string>();
  for (const zone of contract.zones ?? []) {
    if (!locationIds.has(zone.locationId)) continue;
    for (const node of zone.spatialNodes ?? []) {
      if (node.bindsTo?.kind === 'prop') ids.add(node.bindsTo.id);
    }
  }
  for (const pageNumber of consumers) {
    const page = pageFor(contract, pageNumber);
    for (const state of page?.propState ?? []) ids.add(state.propId);
    for (const constraint of page?.propConstraints ?? []) ids.add(constraint.propId);
  }
  return ids;
}

function projectFixedSetFacts(
  authority: SetBoardStableAuthority,
  zones: readonly SetDefinitionZone[],
): SetDefinitionFixedFact[] {
  const placementsByProp = new Map<string, SetDefinitionFixedFact['placements']>();
  for (const zone of zones) {
    for (const node of zone.spatialNodes) {
      if (node.bindsTo?.kind !== 'prop') continue;
      const placements = placementsByProp.get(node.bindsTo.id) ?? [];
      placements.push({ zoneId: zone.id, nodeId: node.id, nodeKind: node.kind });
      placementsByProp.set(node.bindsTo.id, placements);
    }
  }
  return authority.fixedObjects
    .map((fixedObject) => {
      const placements = placementsByProp.get(fixedObject.propId) ?? [];
      return {
        propId: fixedObject.propId,
        name: fixedObject.name,
        material: fixedObject.material,
        scale: fixedObject.scale,
        quantity: fixedObject.quantity,
        placements,
      };
    })
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
}

export class SetBoardReservedPlacementAuthorityError extends Error {
  readonly code = 'set_board_reserved_placement_authority_invalid' as const;

  constructor(
    readonly setIdentityId: string,
    readonly pageNumber: number,
    readonly reason: string,
  ) {
    super(
      `[set_board_reserved_placement_authority_invalid] set ${JSON.stringify(setIdentityId)} ` +
        `page ${pageNumber}: ${reason}`,
    );
    this.name = 'SetBoardReservedPlacementAuthorityError';
  }
}

/**
 * Project only exact same-page placement authority. A required prop constraint by itself says where content is
 * visible, not that the child/companion places it there; an action by itself says nothing about the physical point.
 * The conjunction below is the smallest structural fact that authorizes reserving a point on the reusable Board.
 */
function projectReservedEmptyPlacements(
  contract: BookVisualContract,
  setIdentityId: string,
  locationIds: ReadonlySet<string>,
  zones: readonly SetDefinitionZone[],
  includedPropIds: ReadonlySet<string>,
): SetBoardReservedEmptyPlacement[] {
  const grouped = new Map<
    string,
    Omit<SetBoardReservedEmptyPlacement, 'propIds'> & { propIds: Set<string> }
  >();

  for (const page of [...(contract.pageContracts ?? [])].sort(
    (left, right) => left.pageNumber - right.pageNumber,
  )) {
    if (!locationIds.has(page.locationId)) continue;
    const actions = page.actionRequirements ?? [];
    for (const action of actions) {
      if (
        action.polarity !== 'must' ||
        action.predicate !== 'places' ||
        action.object?.kind !== 'prop'
      ) {
        continue;
      }
      const propId = action.object.id;
      if (includedPropIds.has(propId)) continue;

      const constraints = (page.propConstraints ?? []).filter(
        (constraint) =>
          constraint.propId === propId &&
          constraint.visibility === 'required' &&
          typeof constraint.anchorId === 'string' &&
          constraint.anchorId.trim().length > 0,
      );
      // No anchored constraint means this action carries semantic intent but no compiler-owned physical-placement
      // authority. It is therefore outside this projection and preserves historical v6 behavior. More than one
      // exact candidate is different: authority exists but is ambiguous, so selecting one would be unsafe.
      if (constraints.length === 0) continue;
      if (constraints.length > 1) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `must/places prop ${JSON.stringify(propId)} requires exactly one same-page required anchored constraint ` +
            `(got ${constraints.length})`,
        );
      }
      const anchorId = constraints[0]!.anchorId!.trim();
      const pageZoneId = page.zoneId?.trim();
      if (!pageZoneId) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `must/places prop ${JSON.stringify(propId)} has no exact page zone`,
        );
      }
      const matchingZones = zones.filter(
        (zone) => zone.id === pageZoneId && zone.locationId === page.locationId,
      );
      if (matchingZones.length !== 1) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `page zone ${JSON.stringify(pageZoneId)} does not map to exactly one stable Board area ` +
            `(got ${matchingZones.length})`,
        );
      }
      const matchingLocations = (contract.locations ?? []).filter(
        (location) => location.id === page.locationId,
      );
      if (matchingLocations.length !== 1) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `page location ${JSON.stringify(page.locationId)} is not unique`,
        );
      }
      const matchingAnchors = (matchingLocations[0]!.anchors ?? []).filter(
        (anchor) => anchor.id === anchorId,
      );
      if (matchingAnchors.length !== 1) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `anchor ${JSON.stringify(anchorId)} is not unique in location ${JSON.stringify(page.locationId)} ` +
            `(got ${matchingAnchors.length})`,
        );
      }
      const anchorDescription = matchingAnchors[0]!.description?.trim();
      if (!anchorDescription) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `anchor ${JSON.stringify(anchorId)} has no stable physical description`,
        );
      }

      const key = [page.locationId, pageZoneId, anchorId].join('\u0000');
      const current = grouped.get(key) ?? {
        locationId: page.locationId,
        zoneId: pageZoneId,
        anchorId,
        anchorDescription,
        propIds: new Set<string>(),
      };
      if (current.anchorDescription !== anchorDescription) {
        throw new SetBoardReservedPlacementAuthorityError(
          setIdentityId,
          page.pageNumber,
          `anchor ${JSON.stringify(anchorId)} has conflicting stable descriptions`,
        );
      }
      current.propIds.add(propId);
      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .map((placement) => ({
      locationId: placement.locationId,
      zoneId: placement.zoneId,
      anchorId: placement.anchorId,
      anchorDescription: placement.anchorDescription,
      propIds: [...placement.propIds].sort(),
    }))
    .sort((left, right) =>
      left.locationId.localeCompare(right.locationId) ||
      left.zoneId.localeCompare(right.zoneId) ||
      left.anchorId.localeCompare(right.anchorId),
    );
}

function positiveAuthorityPolicy(
  contract: BookVisualContract,
  includedPropIds: ReadonlySet<string>,
  version: SetBoardPositiveAuthorityPolicyVersion =
    SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
): SetBoardPositiveAuthorityPolicy {
  const blockedCast = [
    contract.cast?.child,
    contract.cast?.companion,
    ...(contract.humanCast ?? []),
  ]
    .filter((candidate): candidate is Exclude<typeof candidate, undefined> => candidate !== undefined)
    .map((candidate) => {
      const record = candidate as unknown as {
        id: string;
        role?: string;
        name?: string;
        aliases?: string[];
      };
      return {
        castId: record.id,
        labels: [...new Set([
          record.id,
          record.role ?? '',
          record.name ?? '',
          ...(record.aliases ?? []),
        ].filter((value) => value.trim().length > 0))],
      };
    })
    .sort((a, b) => (a.castId < b.castId ? -1 : a.castId > b.castId ? 1 : 0));
  const blockedProps = contract.recurringProps
    .filter((prop) => !includedPropIds.has(prop.id))
    .map((prop) => ({ propId: prop.id, name: prop.name }))
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
  return {
    version,
    blockedCast,
    blockedProps,
  };
}

function evaluateSetDefinition(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): { definition: SetDefinition; issues: SetBoardPositiveAuthorityIssue[] } {
  const authority = requireSetBoardStableAuthority(contract, setIdentityId);
  const group = groupLocationsBySetIdentity(contract).get(setIdentityId) ?? [];
  const locations = authority.locations
    .slice()
    .sort((a, b) =>
      a.locationId < b.locationId ? -1 : a.locationId > b.locationId ? 1 : 0
    )
    .map(projectLocation);
  const locationIds = new Set(group.map((location) => location.id));
  const consumers = consumingPageNumbers(contract, locationIds);
  const propsBoundToSet = propsAssociatedWithSet(contract, locationIds, consumers);

  const excludedProps: SetBoardExcludedProp[] = contract.recurringProps
    .filter((prop) => propsBoundToSet.has(prop.id))
    .map((prop) => ({ prop, reasons: exclusionReasons(contract, prop.id, consumers) }))
    .filter((entry) => entry.reasons.length > 0)
    .map(({ prop, reasons }) => ({ propId: prop.id, name: prop.name, reasons }))
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
  const zones = projectZones(authority.areas);
  const fixedSetFacts = projectFixedSetFacts(authority, zones);
  const includedPropIds = fixedSetFacts.map((fact) => fact.propId).sort();
  const requestedBoardVersion = opts?.boardVersion;
  const projectReservations =
    requestedBoardVersion === undefined ||
    requestedBoardVersion === SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION;
  const reservedEmptyPlacements = projectReservations
    ? projectReservedEmptyPlacements(
        contract,
        setIdentityId,
        locationIds,
        zones,
        new Set(includedPropIds),
      )
    : [];
  if (
    requestedBoardVersion === SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION &&
    reservedEmptyPlacements.length === 0
  ) {
    throw new SetBoardReservedPlacementAuthorityError(
      setIdentityId,
      0,
      'set-board/v7 requires at least one exact reserved empty placement',
    );
  }
  const boardVersion =
    requestedBoardVersion ??
    (reservedEmptyPlacements.length > 0
      ? SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION
      : SET_IDENTITY_BOARD_VERSION);
  const contentPolicy: SetBoardContentPolicy =
    boardVersion === SET_IDENTITY_BOARD_RESERVED_PAGE_PLACEMENT_VERSION
      ? {
          version: SET_BOARD_RESERVED_PAGE_CONTENT_POLICY_VERSION,
          includedPropIds,
          excludedProps,
          ambientDressing: currentSetBoardAmbientDressingPolicy(),
          reservedEmptyPlacements: {
            version: SET_BOARD_RESERVED_EMPTY_PLACEMENTS_VERSION,
            placements: reservedEmptyPlacements,
          },
        }
      : {
          version: SET_BOARD_CONTENT_POLICY_VERSION,
          includedPropIds,
          excludedProps,
          ambientDressing: currentSetBoardAmbientDressingPolicy(),
        };
  const authorityPolicy = positiveAuthorityPolicy(
    contract,
    new Set(contentPolicy.includedPropIds),
  );

  const definition: SetDefinition = {
    boardVersion,
    storyKey: contract.storyKey ?? '',
    styleId,
    setIdentityId,
    locations,
    zones,
    fixedSetFacts,
    contentPolicy,
    positiveAuthorityPolicy: authorityPolicy,
  };
  const v2Issues = collectSetBoardPositiveAuthorityIssues(definition);
  if (v2Issues.length === 0) return { definition, issues: [] };

  // Compatibility is compiler-owned and deterministic: a definition that has
  // always passed v2 keeps the same policy/hash/Registry identity. Only a v2
  // rejection is evaluated under the more precise v3 matcher, and v3 is then
  // bound into the definition hash. This avoids a global Registry migration.
  const preciseDefinition: SetDefinition = {
    ...definition,
    positiveAuthorityPolicy: positiveAuthorityPolicy(
      contract,
      new Set(contentPolicy.includedPropIds),
      SET_BOARD_POSITIVE_AUTHORITY_PRECISE_POLICY_VERSION,
    ),
  };
  const preciseIssues = collectSetBoardPositiveAuthorityIssues(
    preciseDefinition,
  );
  if (preciseIssues.length === 0) {
    return { definition: preciseDefinition, issues: [] };
  }

  // V4 is another additive compatibility tier. Existing definitions that
  // pass v2 or v3 never reach it and therefore retain their exact policy,
  // hash, prompt bytes and Registry identity.
  const contextualDefinition: SetDefinition = {
    ...definition,
    positiveAuthorityPolicy: positiveAuthorityPolicy(
      contract,
      new Set(contentPolicy.includedPropIds),
      SET_BOARD_POSITIVE_AUTHORITY_CONTEXTUAL_POLICY_VERSION,
    ),
  };
  const contextualIssues = collectSetBoardPositiveAuthorityIssues(
    contextualDefinition,
  );
  return { definition: contextualDefinition, issues: contextualIssues };
}

export function collectSetDefinitionAdmissionIssues(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): SetBoardPositiveAuthorityIssue[] {
  return evaluateSetDefinition(contract, setIdentityId, styleId, opts).issues;
}

export function projectSetDefinition(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): SetDefinition {
  const evaluated = evaluateSetDefinition(
    contract,
    setIdentityId,
    styleId,
    opts,
  );
  const [firstIssue] = evaluated.issues;
  if (firstIssue) throw firstIssue;
  return evaluated.definition;
}

export function computeSetBoardContentPolicyDigest(definition: SetDefinition): string {
  return canonicalHash(definition.contentPolicy);
}

export function computeProjectedSetDefinitionHash(definition: SetDefinition): string {
  const { positiveAuthorityPolicy, ...physicalAuthority } = definition;
  return canonicalHash({
    ...physicalAuthority,
    positiveAuthorityPolicy: {
      version: positiveAuthorityPolicy.version,
      blockedProps: positiveAuthorityPolicy.blockedProps,
    },
  });
}

export function computeSetDefinitionHash(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): string {
  return computeProjectedSetDefinitionHash(
    projectSetDefinition(contract, setIdentityId, styleId, opts),
  );
}
