import {
  ACTION_SEMANTIC_CATALOG_VERSION,
  LEGACY_ACTION_SEMANTIC_CATALOG_VERSION_V3,
  actionSemanticCatalogForVersion,
  type ActionSemanticCatalogVersion,
} from './actionSemanticCatalog';

/**
 * Catalog v4 adds exactly one enum member to the existing walks schema group.
 * Project the immutable v3 wire vocabulary for provider-free historical replay.
 * This is local data, never a mutable process-wide catalog switch. Schema shape,
 * group/definition order and all non-predicate fields remain byte-identical.
 * Historical schema/prompt fingerprints are regression-tested; any later catalog
 * shape change needs its own policy, not a broader "filter unknowns" migration.
 */
export function actionSchemaForCatalog<T extends Record<string, unknown>>(
  schema: T,
  version: ActionSemanticCatalogVersion,
): T {
  actionSemanticCatalogForVersion(version);
  if (version === ACTION_SEMANTIC_CATALOG_VERSION) return schema;
  if (version !== LEGACY_ACTION_SEMANTIC_CATALOG_VERSION_V3) throw new Error('unsupported_catalog_wire_policy');
  const copy = structuredClone(schema);
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.enum) && node.enum.includes('runs')) {
      // The only v4 delta is in a predicate enum which also allows walks.
      if (!node.enum.includes('walks')) throw new Error('legacy_catalog_schema_shape_changed');
      node.enum = node.enum.filter((member) => member !== 'runs');
    }
    Object.values(node).forEach(visit);
  }
  visit(copy);
  return copy;
}

export function actionSchemasForCatalog<T extends Record<string, Record<string, unknown>>>(
  schemas: T,
  version: ActionSemanticCatalogVersion,
): T {
  return Object.fromEntries(Object.entries(schemas).map(([name, schema]) =>
    [name, actionSchemaForCatalog(schema, version)],
  )) as T;
}
