/**
 * Set Identity Board — the PURE SET-only projection + its hash. NO I/O, NO clock, NO randomness.
 *
 * This module answers exactly one question deterministically: "for one physical SET (a `setIdentityId`), what are the
 * reusable set facts?" — and hashes them. The projection is DELIBERATELY narrow: it reads only locations, zones, their
 * geometry, and the recurring props bound INTO that geometry. It never reads cast / humanCast / page camera / page
 * action / transient prop state / firstRevealPage / family or appearance / order data. That narrowness is what makes
 * an approved board survive personalization: two orders of the same story with different children (or different page
 * cameras, or different prop states) project to the SAME `SetDefinition` and therefore reuse the SAME approved board.
 *
 * Everything is contract-derived and reusable — ZERO story-specific literals live here.
 */
import { canonicalHash } from '@/lib/canonical-json';
import type {
  BookVisualContract,
  VisualLocation,
  VisualZone,
  SpatialNode,
  SpatialRelation,
} from '@/lib/visual-contract-compiler';
import { projectZoneStableGeometry } from '@/lib/visual-contract-compiler';

import {
  SET_IDENTITY_BOARD_VERSION,
  type SetDefinition,
  type SetDefinitionFixedFact,
  type SetDefinitionLocation,
  type SetDefinitionZone,
} from './types';

/** Stable ascending sort by `.id` — used everywhere the projection order must be deterministic and hash-stable. */
function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The physical-set identity a location belongs to. Authored `setIdentityId` when present; otherwise the location is
 * its OWN singleton identity, keyed by its own id. This makes default authoring (omit the field) resolve to exactly
 * one identity per location, and guarantees two distinct identities never share a key.
 */
function identityKeyOf(location: VisualLocation): string {
  return location.setIdentityId ?? location.id;
}

/**
 * Group a contract's locations by their physical-set identity. A location WITHOUT `setIdentityId` forms its own
 * singleton group keyed by its own location id; locations that share a `setIdentityId` land in one group. Distinct
 * identities never cross-wire (different keys → different groups).
 */
export function groupLocationsBySetIdentity(
  contract: BookVisualContract
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

/**
 * The distinct set-identity ids that REQUIRE an approved board — i.e. whose group contains any location whose
 * `setReference.status` is `'pending'` or `'ready'`. A location with `status:'none'` (or no `setReference`) does not
 * require a board. Result is sorted + deduped.
 */
export function listRequiredSetIdentityIds(contract: BookVisualContract): string[] {
  const required = new Set<string>();
  for (const [identityId, locations] of groupLocationsBySetIdentity(contract)) {
    const needsBoard = locations.some(
      (l) => l.setReference?.status === 'pending' || l.setReference?.status === 'ready'
    );
    if (needsBoard) required.add(identityId);
  }
  return Array.from(required).sort();
}

/** Project one location to the SET-only shape. Optional fields are carried through only when authored. */
function projectLocation(location: VisualLocation): SetDefinitionLocation {
  return {
    id: location.id,
    description: location.description,
    // Undefined optionals are dropped by JSON serialization, so an unauthored field hashes byte-identically.
    timeOfDay: location.timeOfDay,
    lighting: location.lighting,
    environmentClass: location.environmentClass,
    anchors: (location.anchors ?? []).map((a) => ({ id: a.id, description: a.description })),
    topology: location.topology,
  };
}

/** Project one zone to the SET-only shape, preserving authored declaration order of nodes + relations. */
function projectZone(zone: VisualZone): SetDefinitionZone {
  const spatialNodes: SpatialNode[] = Array.isArray(zone.spatialNodes) ? zone.spatialNodes : [];
  const spatialRelations: SpatialRelation[] = Array.isArray(zone.spatialRelations)
    ? zone.spatialRelations
    : [];
  return {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    spatialNodes,
    spatialRelations,
    geometry: projectZoneStableGeometry(zone) ?? [],
  };
}

/**
 * The recurring props that are part of THIS set's fixed geometry: every `recurringProps` entry whose id is the
 * `bindsTo.id` of a `{kind:'prop'}` spatialNode in the selected zones. Sorted by propId, deduped. Only the STABLE
 * facts (material/scale) are carried — never per-page state.
 */
function projectFixedSetFacts(
  contract: BookVisualContract,
  zones: readonly SetDefinitionZone[]
): SetDefinitionFixedFact[] {
  const boundPropIds = new Set<string>();
  for (const zone of zones) {
    for (const node of zone.spatialNodes) {
      if (node.bindsTo?.kind === 'prop' && typeof node.bindsTo.id === 'string') {
        boundPropIds.add(node.bindsTo.id);
      }
    }
  }
  const facts = (contract.recurringProps ?? [])
    .filter((p) => boundPropIds.has(p.id))
    .map((p): SetDefinitionFixedFact => ({ propId: p.id, material: p.material, scale: p.scale }));
  return facts
    .slice()
    .sort((a, b) => (a.propId < b.propId ? -1 : a.propId > b.propId ? 1 : 0));
}

/**
 * Build the SET-only projection for ONE set identity. Deterministic and pure: same inputs → same object → same hash.
 *
 * `setIdentityId` selects the location group (see `groupLocationsBySetIdentity`); a missing/unknown identity yields
 * an empty group (empty locations/zones/facts) rather than throwing — the caller decides requiredness.
 */
export function projectSetDefinition(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string }
): SetDefinition {
  const boardVersion = opts?.boardVersion ?? SET_IDENTITY_BOARD_VERSION;

  const group = groupLocationsBySetIdentity(contract).get(setIdentityId) ?? [];
  const locations = byId(group).map(projectLocation);
  const locationIds = new Set(group.map((l) => l.id));

  const zoneEntities = byId((contract.zones ?? []).filter((z) => locationIds.has(z.locationId)));
  const zones = zoneEntities.map(projectZone);

  const fixedSetFacts = projectFixedSetFacts(contract, zones);

  return {
    boardVersion,
    storyKey: contract.storyKey ?? '',
    styleId,
    setIdentityId,
    locations,
    zones,
    fixedSetFacts,
  };
}

/** SHA-256 (canonical JSON) of the SET-only projection — the GLOBAL board key. */
export function computeSetDefinitionHash(
  contract: BookVisualContract,
  setIdentityId: string,
  styleId: string,
  opts?: { boardVersion?: string }
): string {
  return canonicalHash(projectSetDefinition(contract, setIdentityId, styleId, opts));
}
