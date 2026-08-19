import type {
  BookVisualContract,
  SetBoardStableAuthority,
} from './types';
import { canonicalHash } from '@/lib/canonical-json';

const ENVIRONMENT_CLASSES = new Set(['indoor', 'outdoor', 'neutral']);
const SPATIAL_NODE_KINDS = new Set([
  'doorway',
  'window',
  'balcony_door',
  'railing',
  'ledge',
  'wall',
  'floor',
  'furniture',
]);
const SPATIAL_RELATION_KINDS = new Set([
  'on_same_wall_as',
  'adjacent_to',
  'opposite_to',
  'above',
  'below',
  'centered_in',
]);

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStr(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

function sameStrings(left: Iterable<string>, right: Iterable<string>): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function sameCanonicalJson(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalHash(left) === canonicalHash(right);
}

function boardRequired(status: unknown): boolean {
  return status === 'pending' || status === 'ready';
}

/**
 * Validate the reviewed stable board-only authority independently from page-rich location/zone prose.
 *
 * No authority is required for a story with no pending/ready Set Board. Once a set is board-required, however,
 * missing, partial, malformed, transient, or cross-set authority is a hard error.
 */
export function setBoardStableAuthorityErrors(input: unknown): string[] {
  if (!isObj(input)) return ['contract is not an object'];
  const errors: string[] = [];
  const rawLocations = Array.isArray(input.locations) ? input.locations : [];
  const rawZones = Array.isArray(input.zones) ? input.zones : [];
  const rawProps = Array.isArray(input.recurringProps) ? input.recurringProps : [];
  const rawPages = Array.isArray(input.pageContracts) ? input.pageContracts : [];

  const locationIdsBySet = new Map<string, Set<string>>();
  const zonesById = new Map<string, Record<string, unknown>[]>();
  for (const zone of rawZones) {
    if (!isObj(zone) || !isStr(zone.id)) continue;
    const matches = zonesById.get(zone.id) ?? [];
    matches.push(zone);
    zonesById.set(zone.id, matches);
  }
  const requiredSetIds = new Set<string>();
  for (const location of rawLocations) {
    if (!isObj(location) || !isStr(location.id) || !isStr(location.setIdentityId)) continue;
    const members = locationIdsBySet.get(location.setIdentityId) ?? new Set<string>();
    members.add(location.id);
    locationIdsBySet.set(location.setIdentityId, members);
    if (isObj(location.setReference) && boardRequired(location.setReference.status)) {
      requiredSetIds.add(location.setIdentityId);
    }
  }

  const rawAuthorities = input.setBoardAuthorities;
  if (rawAuthorities === undefined) {
    for (const setIdentityId of sorted(requiredSetIds)) {
      errors.push(
        `setIdentityId "${setIdentityId}" requires a Set Board but setBoardAuthorities has no reviewed stable authority`,
      );
    }
    return errors;
  }
  if (!Array.isArray(rawAuthorities) || rawAuthorities.length === 0) {
    errors.push(
      'setBoardAuthorities must be a non-empty array when present; omit it only when no set is board-required',
    );
    return errors;
  }

  const seenSetIds = new Set<string>();
  for (const [authorityIndex, rawAuthority] of rawAuthorities.entries()) {
    const prefix = `setBoardAuthorities[${authorityIndex}]`;
    if (!isObj(rawAuthority) || !isStr(rawAuthority.setIdentityId)) {
      errors.push(`${prefix}.setIdentityId missing`);
      continue;
    }
    const setIdentityId = rawAuthority.setIdentityId;
    const label = `setBoardAuthority "${setIdentityId}"`;
    if (seenSetIds.has(setIdentityId)) {
      errors.push(`duplicate ${label}`);
      continue;
    }
    seenSetIds.add(setIdentityId);

    const expectedLocationIds = locationIdsBySet.get(setIdentityId);
    if (!expectedLocationIds) {
      errors.push(`${label} references no declared VisualLocation setIdentityId`);
    }

    const stableLocations = Array.isArray(rawAuthority.locations) ? rawAuthority.locations : [];
    if (stableLocations.length === 0) {
      errors.push(`${label}.locations must be a non-empty array`);
    }
    const stableLocationIds = new Set<string>();
    for (const [locationIndex, rawLocation] of stableLocations.entries()) {
      const locationLabel = `${label}.locations[${locationIndex}]`;
      if (!isObj(rawLocation) || !isStr(rawLocation.locationId)) {
        errors.push(`${locationLabel}.locationId missing`);
        continue;
      }
      if (stableLocationIds.has(rawLocation.locationId)) {
        errors.push(`${label} has duplicate stable location "${rawLocation.locationId}"`);
      }
      stableLocationIds.add(rawLocation.locationId);
      if (!expectedLocationIds?.has(rawLocation.locationId)) {
        errors.push(
          `${locationLabel}.locationId "${rawLocation.locationId}" is outside physical set "${setIdentityId}"`,
        );
      }
      if (!isStr(rawLocation.name)) errors.push(`${locationLabel}.name missing`);
      if (!isStr(rawLocation.timeOfDay)) errors.push(`${locationLabel}.timeOfDay missing`);
      if (!isStr(rawLocation.lighting)) errors.push(`${locationLabel}.lighting missing`);
      if (!isStr(rawLocation.environmentClass) || !ENVIRONMENT_CLASSES.has(rawLocation.environmentClass)) {
        errors.push(`${locationLabel}.environmentClass must be indoor|outdoor|neutral`);
      }
    }
    if (expectedLocationIds && !sameStrings(stableLocationIds, expectedLocationIds)) {
      errors.push(
        `${label}.locations must cover exactly the physical-set locations ` +
        `(expected ${JSON.stringify(sorted(expectedLocationIds))}, got ${JSON.stringify(sorted(stableLocationIds))})`,
      );
    }

    const fixedObjects = Array.isArray(rawAuthority.fixedObjects) ? rawAuthority.fixedObjects : null;
    if (!fixedObjects) {
      errors.push(`${label}.fixedObjects must be an array (use [] when the stable set has no fixed objects)`);
    }
    const fixedObjectIds = new Set<string>();
    const propById = new Map<string, Record<string, unknown>>();
    for (const prop of rawProps) {
      if (isObj(prop) && isStr(prop.id)) propById.set(prop.id, prop);
    }
    for (const [objectIndex, rawObject] of (fixedObjects ?? []).entries()) {
      const objectLabel = `${label}.fixedObjects[${objectIndex}]`;
      if (!isObj(rawObject) || !isStr(rawObject.propId)) {
        errors.push(`${objectLabel}.propId missing`);
        continue;
      }
      if (fixedObjectIds.has(rawObject.propId)) {
        errors.push(`${label} has duplicate fixed object "${rawObject.propId}"`);
      }
      fixedObjectIds.add(rawObject.propId);
      if (!propById.has(rawObject.propId)) {
        errors.push(`${objectLabel}.propId "${rawObject.propId}" is not a recurring prop`);
      }
      if (!isStr(rawObject.name)) errors.push(`${objectLabel}.name missing`);
      for (const field of ['material', 'scale'] as const) {
        if (rawObject[field] !== undefined && !isStr(rawObject[field])) {
          errors.push(`${objectLabel}.${field} must be a non-empty string when present`);
        }
      }
      if (
        typeof rawObject.quantity !== 'number' ||
        !Number.isInteger(rawObject.quantity) ||
        rawObject.quantity < 1
      ) {
        errors.push(`${objectLabel}.quantity must be an integer >= 1`);
      }

      const prop = propById.get(rawObject.propId);
      if (prop?.firstRevealPage !== undefined) {
        errors.push(
          `${objectLabel}.propId "${rawObject.propId}" is lifecycle-gated and cannot be stable board content`,
        );
      }
      const consumerLocationIds = expectedLocationIds ?? new Set<string>();
      const forbiddenOnConsumer = rawPages.some((page) =>
        isObj(page) &&
        isStr(page.locationId) &&
        consumerLocationIds.has(page.locationId) &&
        Array.isArray(page.propConstraints) &&
        page.propConstraints.some((constraint) =>
          isObj(constraint) &&
          constraint.propId === rawObject.propId &&
          constraint.visibility === 'forbidden'
        )
      );
      if (forbiddenOnConsumer) {
        errors.push(
          `${objectLabel}.propId "${rawObject.propId}" is forbidden on a consumer page and cannot be stable board content`,
        );
      }
    }

    const areas = Array.isArray(rawAuthority.areas) ? rawAuthority.areas : [];
    if (areas.length === 0) errors.push(`${label}.areas must be a non-empty array`);
    const areaIds = new Set<string>();
    const areaLocationIds = new Set<string>();
    const placedObjectIds = new Set<string>();
    const projectedZoneOwners = new Map<string, string>();
    for (const [areaIndex, rawArea] of areas.entries()) {
      const areaLabel = `${label}.areas[${areaIndex}]`;
      if (!isObj(rawArea) || !isStr(rawArea.id) || !isStr(rawArea.locationId)) {
        errors.push(`${areaLabel} needs id + locationId`);
        continue;
      }
      if (areaIds.has(rawArea.id)) errors.push(`${label} has duplicate area id "${rawArea.id}"`);
      areaIds.add(rawArea.id);
      if (!stableLocationIds.has(rawArea.locationId)) {
        errors.push(`${areaLabel}.locationId "${rawArea.locationId}" is not a stable location in this authority`);
      } else {
        areaLocationIds.add(rawArea.locationId);
      }
      const projection = isObj(rawArea.zoneProjection)
        ? rawArea.zoneProjection
        : null;
      const cardinality = projection?.cardinality;
      const zoneIds = Array.isArray(projection?.zoneIds)
        ? projection!.zoneIds.filter(isStr)
        : [];
      if (
        (cardinality === 'one_to_one' && zoneIds.length !== 1) ||
        (cardinality === 'one_to_many' && zoneIds.length < 2) ||
        (cardinality !== 'one_to_one' && cardinality !== 'one_to_many')
      ) {
        errors.push(
          `${areaLabel}.zoneProjection must declare matching one_to_one or one_to_many exact zoneIds`,
        );
      }
      if (new Set(zoneIds).size !== zoneIds.length) {
        errors.push(`${areaLabel}.zoneProjection.zoneIds contains a duplicate`);
      }
      for (const zoneId of zoneIds) {
        const matches = zonesById.get(zoneId) ?? [];
        if (matches.length !== 1) {
          errors.push(
            `${areaLabel}.zoneProjection zoneId "${zoneId}" resolves to ${matches.length} page zones`,
          );
          continue;
        }
        if (matches[0]!.locationId !== rawArea.locationId) {
          errors.push(
            `${areaLabel}.zoneProjection zoneId "${zoneId}" belongs to a different location`,
          );
        }
        const prior = projectedZoneOwners.get(zoneId);
        if (prior) {
          errors.push(
            `${areaLabel}.zoneProjection zoneId "${zoneId}" is already projected by ${prior}`,
          );
        } else {
          projectedZoneOwners.set(zoneId, areaLabel);
        }
      }
      if (!Array.isArray(rawArea.spatialNodes) || rawArea.spatialNodes.length === 0) {
        errors.push(`${areaLabel}.spatialNodes must be a non-empty array`);
        continue;
      }
      const nodeIds = new Set<string>();
      for (const [nodeIndex, rawNode] of rawArea.spatialNodes.entries()) {
        const nodeLabel = `${areaLabel}.spatialNodes[${nodeIndex}]`;
        if (!isObj(rawNode) || !isStr(rawNode.id)) {
          errors.push(`${nodeLabel}.id missing`);
          continue;
        }
        if (nodeIds.has(rawNode.id)) errors.push(`${areaLabel} has duplicate node id "${rawNode.id}"`);
        nodeIds.add(rawNode.id);
        if (!isStr(rawNode.kind) || !SPATIAL_NODE_KINDS.has(rawNode.kind)) {
          errors.push(`${nodeLabel}.kind is not a supported spatial kind`);
        }
        if (!isStr(rawNode.description)) errors.push(`${nodeLabel}.description missing`);
        if (rawNode.propId !== undefined) {
          if (!isStr(rawNode.propId) || !fixedObjectIds.has(rawNode.propId)) {
            errors.push(
              `${nodeLabel}.propId must reference an explicitly declared stable fixed object`,
            );
          } else {
            placedObjectIds.add(rawNode.propId);
          }
        }
      }

      if (rawArea.spatialRelations !== undefined) {
        if (!Array.isArray(rawArea.spatialRelations) || rawArea.spatialRelations.length === 0) {
          errors.push(`${areaLabel}.spatialRelations must be a non-empty array when present`);
        } else {
          for (const [relationIndex, rawRelation] of rawArea.spatialRelations.entries()) {
            const relationLabel = `${areaLabel}.spatialRelations[${relationIndex}]`;
            if (
              !isObj(rawRelation) ||
              !isStr(rawRelation.subjectId) ||
              !isStr(rawRelation.relation)
            ) {
              errors.push(`${relationLabel} needs subjectId + relation`);
              continue;
            }
            if (!nodeIds.has(rawRelation.subjectId)) {
              errors.push(`${relationLabel}.subjectId does not resolve within its area`);
            }
            if (!SPATIAL_RELATION_KINDS.has(rawRelation.relation)) {
              errors.push(`${relationLabel}.relation is not a supported spatial relation`);
            }
            if (rawRelation.relation === 'centered_in') {
              if (rawRelation.objectId !== undefined) {
                errors.push(`${relationLabel}.centered_in takes no objectId`);
              }
            } else if (!isStr(rawRelation.objectId) || !nodeIds.has(rawRelation.objectId)) {
              errors.push(`${relationLabel}.objectId must resolve within its area`);
            }
          }
        }
      }

      for (const zoneId of zoneIds) {
        const zone = (zonesById.get(zoneId) ?? [])[0];
        if (!zone) continue;
        const expectedNodes = rawArea.spatialNodes.map((rawNode) => {
          const node = isObj(rawNode) ? rawNode : {};
          return {
            id: node.id,
            kind: node.kind,
            description: node.description,
            ...(typeof node.propId === 'string'
              ? { bindsTo: { kind: 'prop', id: node.propId } }
              : {}),
          };
        });
        if (!sameCanonicalJson(zone.spatialNodes, expectedNodes)) {
          errors.push(
            `${areaLabel}.zoneProjection zoneId "${zoneId}" spatialNodes do not equal the compiler-owned area projection`,
          );
        }
        const expectedRelations = Array.isArray(rawArea.spatialRelations)
          ? rawArea.spatialRelations
          : undefined;
        if (!sameCanonicalJson(zone.spatialRelations, expectedRelations)) {
          errors.push(
            `${areaLabel}.zoneProjection zoneId "${zoneId}" spatialRelations do not equal the compiler-owned area projection`,
          );
        }
      }
    }
    for (const propId of fixedObjectIds) {
      if (!placedObjectIds.has(propId)) {
        errors.push(`${label}.fixedObjects prop "${propId}" has no stable area placement`);
      }
    }
    for (const rawObject of fixedObjects ?? []) {
      if (!isObj(rawObject) || !isStr(rawObject.propId)) continue;
      const prop = propById.get(rawObject.propId);
      if (!prop) continue;
      const expected = {
        propId: rawObject.propId,
        name: prop.name,
        quantity: 1,
      };
      if (!sameCanonicalJson(rawObject, expected)) {
        errors.push(
          `${label}.fixedObjects prop "${rawObject.propId}" must equal its compiler-owned recurring-prop projection`,
        );
      }
    }
    for (const [zoneId, matches] of zonesById) {
      const zone = matches[0];
      if (
        matches.length === 1 &&
        zone &&
        typeof zone.locationId === 'string' &&
        expectedLocationIds?.has(zone.locationId) &&
        !projectedZoneOwners.has(zoneId)
      ) {
        errors.push(
          `${label} page-zone "${zoneId}" has no exact stable-area projection`,
        );
      }
    }
    for (const locationId of stableLocationIds) {
      if (!areaLocationIds.has(locationId)) {
        errors.push(`${label}.locations "${locationId}" has no stable board area`);
      }
    }
  }

  for (const setIdentityId of sorted(requiredSetIds)) {
    if (!seenSetIds.has(setIdentityId)) {
      errors.push(
        `setIdentityId "${setIdentityId}" requires a Set Board but has no reviewed stable authority`,
      );
    }
  }

  return errors;
}

export class InvalidSetBoardStableAuthorityError extends Error {
  readonly code = 'set_board_stable_authority_invalid' as const;
  readonly isInvalidSetBoardStableAuthorityError = true as const;

  constructor(readonly errors: string[]) {
    super(`[set_board_stable_authority_invalid] ${errors.join('; ')}`);
    this.name = 'InvalidSetBoardStableAuthorityError';
  }
}

export function requireSetBoardStableAuthority(
  contract: BookVisualContract,
  setIdentityId: string,
): SetBoardStableAuthority {
  const errors = setBoardStableAuthorityErrors(contract);
  if (errors.length > 0) throw new InvalidSetBoardStableAuthorityError(errors);
  const authority = contract.setBoardAuthorities?.find(
    (candidate) => candidate.setIdentityId === setIdentityId,
  );
  if (!authority) {
    throw new InvalidSetBoardStableAuthorityError([
      `setIdentityId "${setIdentityId}" has no reviewed stable authority`,
    ]);
  }
  return authority;
}
