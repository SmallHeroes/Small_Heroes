import {
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
} from './contractTemplateTypes';
import { projectZoneStableGeometry } from './projectContractProse';
import type { VisualZone } from './types';
import {
  assertValidBookVisualContractTemplate,
  InvalidTemplateContractError,
} from './validateTemplateContract';

export const LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION = 'vc-schema/v1' as const;
export const LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION_V2 = 'vc-schema/v2' as const;

export interface VisualContractReferenceDomainMigration {
  /** Exact Set Board area -> page-zone projection, keyed first by set identity and then area id. */
  areaZoneIds: Readonly<
    Record<string, Readonly<Record<string, readonly string[]>>>
  >;
  /** Explicit legacy -> current page-zone node remaps. Omitted ids are never guessed. */
  pageZoneNodeIds?: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function migrateLegacyActionSubjects(candidate: Record<string, unknown>): void {
  if (!Array.isArray(candidate.pageContracts)) return;
  for (const page of candidate.pageContracts) {
    if (!objectValue(page) || !Array.isArray(page.actionRequirements)) continue;
    for (const requirement of page.actionRequirements) {
      if (!objectValue(requirement) || !hasOwn(requirement, 'actorId')) continue;
      if (hasOwn(requirement, 'subject')) {
        throw new InvalidTemplateContractError([
          'legacy action requirement cannot carry both actorId and subject',
        ]);
      }
      if (typeof requirement.actorId !== 'string' || !requirement.actorId.trim()) {
        throw new InvalidTemplateContractError([
          'legacy action requirement actorId must be a non-empty string',
        ]);
      }
      requirement.subject = {
        kind: 'entity',
        entity: { kind: 'cast', id: requirement.actorId },
      };
      delete requirement.actorId;
    }
  }
}

function migrateReferenceDomains(
  candidate: Record<string, unknown>,
  migration: VisualContractReferenceDomainMigration,
): void {
  const zones = Array.isArray(candidate.zones)
    ? candidate.zones.filter(objectValue)
    : [];
  const recurringProps = Array.isArray(candidate.recurringProps)
    ? candidate.recurringProps.filter(objectValue)
    : [];
  const authorities = Array.isArray(candidate.setBoardAuthorities)
    ? candidate.setBoardAuthorities.filter(objectValue)
    : [];

  for (const authority of authorities) {
    const setIdentityId = authority.setIdentityId;
    if (typeof setIdentityId !== 'string') continue;
    const exactMappings = migration.areaZoneIds[setIdentityId] ?? {};
    const stablePropIds = new Set<string>();
    const areas = Array.isArray(authority.areas)
      ? authority.areas.filter(objectValue)
      : [];
    for (const area of areas) {
      const areaId = area.id;
      const locationId = area.locationId;
      if (typeof areaId !== 'string' || typeof locationId !== 'string') continue;
      const zoneIds = exactMappings[areaId];
      if (!zoneIds || zoneIds.length === 0) {
        throw new InvalidTemplateContractError([
          `explicit reference-domain migration missing exact zone ids for set ${JSON.stringify(setIdentityId)} area ${JSON.stringify(areaId)}`,
        ]);
      }
      if (new Set(zoneIds).size !== zoneIds.length) {
        throw new InvalidTemplateContractError([
          `explicit reference-domain migration duplicates a zone id for set ${JSON.stringify(setIdentityId)} area ${JSON.stringify(areaId)}`,
        ]);
      }
      area.zoneProjection = zoneIds.length === 1
        ? { cardinality: 'one_to_one', zoneIds: [zoneIds[0]!] }
        : {
            cardinality: 'one_to_many',
            zoneIds: [zoneIds[0]!, zoneIds[1]!, ...zoneIds.slice(2)],
          };
      const spatialNodes = Array.isArray(area.spatialNodes)
        ? area.spatialNodes.filter(objectValue)
        : [];
      for (const node of spatialNodes) {
        if (typeof node.propId === 'string') stablePropIds.add(node.propId);
      }
      for (const zoneId of zoneIds) {
        const matches = zones.filter((zone) => zone.id === zoneId);
        if (
          matches.length !== 1 ||
          matches[0]!.locationId !== locationId
        ) {
          throw new InvalidTemplateContractError([
            `explicit reference-domain migration cannot bind set ${JSON.stringify(setIdentityId)} area ${JSON.stringify(areaId)} to exact zone ${JSON.stringify(zoneId)}`,
          ]);
        }
        const zone = matches[0]!;
        zone.spatialNodes = spatialNodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          description: node.description,
          ...(typeof node.propId === 'string'
            ? { bindsTo: { kind: 'prop', id: node.propId } }
            : {}),
        }));
        if (Array.isArray(area.spatialRelations) && area.spatialRelations.length > 0) {
          zone.spatialRelations = structuredClone(area.spatialRelations);
        } else {
          delete zone.spatialRelations;
        }
        zone.stableGeometry = projectZoneStableGeometry(
          zone as unknown as VisualZone,
        );
      }
    }
    authority.fixedObjects = [...stablePropIds]
      .sort()
      .map((propId) => {
        const matches = recurringProps.filter((prop) => prop.id === propId);
        if (matches.length !== 1 || typeof matches[0]!.name !== 'string') {
          throw new InvalidTemplateContractError([
            `explicit reference-domain migration cannot bind recurring prop ${JSON.stringify(propId)}`,
          ]);
        }
        return { propId, name: matches[0]!.name, quantity: 1 };
      });
  }

  const pageZoneNodeIds = migration.pageZoneNodeIds ?? {};
  if (!Array.isArray(candidate.pageContracts)) return;
  for (const page of candidate.pageContracts) {
    if (!objectValue(page) || typeof page.zoneId !== 'string') continue;
    const nodeIds = pageZoneNodeIds[page.zoneId];
    if (!nodeIds) continue;
    const remap = (value: unknown): void => {
      if (!objectValue(value) || value.kind !== 'spatial' || typeof value.id !== 'string') return;
      const currentId = nodeIds[value.id];
      if (currentId) value.id = currentId;
    };
    if (Array.isArray(page.actionRequirements)) {
      for (const rawAction of page.actionRequirements) {
        if (!objectValue(rawAction)) continue;
        remap(rawAction.object);
        const spatialEffect = objectValue(rawAction.spatialEffect)
          ? rawAction.spatialEffect
          : null;
        if (spatialEffect?.kind === 'relation') remap(spatialEffect.target);
      }
    }
    if (Array.isArray(page.safetyConstraints)) {
      for (const rawConstraint of page.safetyConstraints) {
        if (objectValue(rawConstraint)) remap(rawConstraint.target);
      }
    }
  }
}

/**
 * Explicit offline migration for immutable vc-schema/v1 template evidence.
 * Runtime loaders never call this function: historical bytes remain rejected as
 * current authority until a caller deliberately writes and reviews a new artifact.
 */
export function migrateLegacyBookVisualContractTemplateV1(
  input: unknown,
  referenceDomains: VisualContractReferenceDomainMigration = {
    areaZoneIds: {},
  },
): BookVisualContractTemplate {
  if (!objectValue(input) || input.schemaVersion !== LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION) {
    throw new InvalidTemplateContractError([
      `explicit migration requires ${LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION} input`,
    ]);
  }
  const candidate = structuredClone(input);
  candidate.schemaVersion = VISUAL_CONTRACT_SCHEMA_VERSION;
  migrateLegacyActionSubjects(candidate);
  migrateReferenceDomains(candidate, referenceDomains);

  assertValidBookVisualContractTemplate(candidate);
  return candidate;
}

/**
 * Explicit offline vc-schema/v2 -> current migration. Runtime loaders never
 * invoke it; callers must supply exact area/zone and legacy/current node maps.
 */
export function migrateLegacyBookVisualContractTemplateV2(
  input: unknown,
  referenceDomains: VisualContractReferenceDomainMigration,
): BookVisualContractTemplate {
  if (
    !objectValue(input) ||
    input.schemaVersion !== LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION_V2
  ) {
    throw new InvalidTemplateContractError([
      `explicit migration requires ${LEGACY_VISUAL_CONTRACT_SCHEMA_VERSION_V2} input`,
    ]);
  }
  const candidate = structuredClone(input);
  candidate.schemaVersion = VISUAL_CONTRACT_SCHEMA_VERSION;
  migrateReferenceDomains(candidate, referenceDomains);
  assertValidBookVisualContractTemplate(candidate);
  return candidate;
}
