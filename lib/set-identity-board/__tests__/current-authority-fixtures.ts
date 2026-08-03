import {
  projectZoneStableGeometry,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';

/** Explicit test-only migration: every legacy area receives named exact zone ids. */
export function migrateLegacySetBoardFixture(
  source: BookVisualContract,
  areaZoneIds: Readonly<Record<string, readonly string[]>>,
  pageZoneNodeIds: Readonly<
    Record<string, Readonly<Record<string, string>>>
  > = {},
): BookVisualContract {
  const contract = structuredClone(source);
  for (const authority of contract.setBoardAuthorities ?? []) {
    const stablePropIds = new Set<string>();
    for (const area of authority.areas) {
      const zoneIds = areaZoneIds[area.id];
      if (!zoneIds || zoneIds.length === 0) {
        throw new Error(`explicit fixture migration missing area ${area.id}`);
      }
      area.zoneProjection =
        zoneIds.length === 1
          ? { cardinality: 'one_to_one', zoneIds: [zoneIds[0]!] }
          : {
              cardinality: 'one_to_many',
              zoneIds: [zoneIds[0]!, zoneIds[1]!, ...zoneIds.slice(2)],
            };
      for (const node of area.spatialNodes) {
        if (!node.propId) continue;
        stablePropIds.add(node.propId);
      }
      for (const zoneId of zoneIds) {
        const matches = contract.zones.filter((zone) => zone.id === zoneId);
        if (
          matches.length !== 1 ||
          matches[0]!.locationId !== area.locationId
        ) {
          throw new Error(
            `explicit fixture migration cannot bind area ${area.id} to ${zoneId}`,
          );
        }
        const zone = matches[0]!;
        zone.spatialNodes = area.spatialNodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          description: node.description,
          ...(node.propId
            ? { bindsTo: { kind: 'prop' as const, id: node.propId } }
            : {}),
        }));
        if (area.spatialRelations?.length) {
          zone.spatialRelations = structuredClone(area.spatialRelations);
        } else {
          delete zone.spatialRelations;
        }
        zone.stableGeometry = projectZoneStableGeometry(zone);
      }
    }
    authority.fixedObjects = [...stablePropIds]
      .map((propId) => {
        const matches = contract.recurringProps.filter(
          (prop) => prop.id === propId,
        );
        if (matches.length !== 1) {
          throw new Error(
            `explicit fixture migration cannot bind recurring prop ${propId}`,
          );
        }
        return { propId, name: matches[0]!.name, quantity: 1 };
      })
      .sort((left, right) => left.propId.localeCompare(right.propId));
  }
  for (const page of contract.pageContracts) {
    const nodeIds = typeof page.zoneId === 'string'
      ? pageZoneNodeIds[page.zoneId]
      : undefined;
    if (!nodeIds) continue;
    const remap = (reference: { kind: string; id: string } | undefined): void => {
      if (reference?.kind !== 'spatial') return;
      const currentId = nodeIds[reference.id];
      if (currentId) reference.id = currentId;
    };
    for (const action of page.actionRequirements ?? []) {
      remap(action.object);
      if (action.spatialEffect?.kind === 'relation') {
        remap(action.spatialEffect.target);
      }
    }
    for (const constraint of page.safetyConstraints ?? []) {
      remap(constraint.target);
    }
  }
  return contract;
}
