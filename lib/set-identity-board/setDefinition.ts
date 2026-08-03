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
  SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
  SET_IDENTITY_BOARD_VERSION,
  type SetBoardContentPolicy,
  type SetBoardExcludedProp,
  type SetBoardExclusionReason,
  type SetBoardPositiveAuthorityPolicy,
  type SetDefinition,
  type SetDefinitionFixedFact,
  type SetDefinitionLocation,
  type SetDefinitionZone,
} from './types';
import { assertSetBoardPositiveAuthoritySpoilerNeutral } from './positiveAuthoritySpoilerGuard';

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

function positiveAuthorityPolicy(
  contract: BookVisualContract,
  includedPropIds: ReadonlySet<string>,
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
    version: SET_BOARD_POSITIVE_AUTHORITY_POLICY_VERSION,
    blockedCast,
    blockedProps,
  };
}

export function projectSetDefinition(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): SetDefinition {
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
  const contentPolicy: SetBoardContentPolicy = {
    version: SET_BOARD_CONTENT_POLICY_VERSION,
    includedPropIds: fixedSetFacts.map((fact) => fact.propId).sort(),
    excludedProps,
  };
  const authorityPolicy = positiveAuthorityPolicy(
    contract,
    new Set(contentPolicy.includedPropIds),
  );

  const definition: SetDefinition = {
    boardVersion: opts?.boardVersion ?? SET_IDENTITY_BOARD_VERSION,
    storyKey: contract.storyKey ?? '',
    styleId,
    setIdentityId,
    locations,
    zones,
    fixedSetFacts,
    contentPolicy,
    positiveAuthorityPolicy: authorityPolicy,
  };
  assertSetBoardPositiveAuthoritySpoilerNeutral(definition);
  return definition;
}

export function computeSetBoardContentPolicyDigest(definition: SetDefinition): string {
  return canonicalHash(definition.contentPolicy);
}

export function computeSetDefinitionHash(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string },
): string {
  const { positiveAuthorityPolicy, ...physicalAuthority } =
    projectSetDefinition(contract, setIdentityId, styleId, opts);
  return canonicalHash({
    ...physicalAuthority,
    positiveAuthorityPolicy: {
      version: positiveAuthorityPolicy.version,
      blockedProps: positiveAuthorityPolicy.blockedProps,
    },
  });
}
