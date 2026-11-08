/** Explicit wire dialect only. Never repairs model output or changes the local evidence schema. */
export const ENGINE_RESPONSE_SCHEMA_POLICY = 'json-schema-null/v1' as const;

const primitiveTypes = new Set(['string', 'number', 'integer', 'boolean', 'null']);
const primitiveAnnotations = new Set(['type', 'nullable', '$schema', '$id', '$anchor', '$comment', 'title',
  'description', 'default', 'examples', 'example', 'deprecated', 'readOnly', 'writeOnly']);
const schemaMaps = new Set(['properties', 'patternProperties', 'definitions', '$defs', 'dependentSchemas']);
const schemaLists = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const schemaChildren = new Set(['additionalProperties', 'additionalItems', 'contains', 'not', 'if', 'then', 'else',
  'propertyNames', 'unevaluatedProperties', 'unevaluatedItems', 'contentSchema']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (): never => { throw Error('engine_response_schema_nullable_shape'); };

/**
 * The installed SDK emits the OpenAPI nullable extension for unconstrained primitives. Replace that precise
 * shape in place with a standard JSON Schema type union. Constraints such as enums/minima already use anyOf
 * in SDK output; an unfamiliar constrained extension fails closed instead of silently widening its domain.
 * Schema positions are traversed explicitly: const/default/enum/examples and property names are data.
 * No wrapper is inserted, so every existing JSON Pointer and definition stays at its original location.
 */
export function standardEngineResponseSchema(input: Record<string, unknown>): Record<string, unknown> {
  if (!record(input)) return fail();
  const originalBytes = Buffer.byteLength(JSON.stringify(input)), active = new Set<object>();
  let visited = 0;
  const visit = (value: unknown, depth: number): unknown => {
    if (typeof value === 'boolean') return value;
    if (!record(value) || depth > 128 || ++visited > 100_000 || active.has(value)) return fail();
    active.add(value);
    const result: Record<string, unknown> = { ...value };
    for (const [key, child] of Object.entries(value)) {
      if (schemaMaps.has(key)) {
        if (!record(child)) return fail();
        result[key] = Object.fromEntries(Object.entries(child).map(([name, schema]) => [name, visit(schema, depth + 1)]));
      } else if (schemaLists.has(key)) {
        if (!Array.isArray(child)) return fail();
        result[key] = child.map(schema => visit(schema, depth + 1));
      } else if (key === 'items') {
        result[key] = Array.isArray(child) ? child.map(schema => visit(schema, depth + 1)) : visit(child, depth + 1);
      } else if (key === 'dependencies') {
        if (!record(child)) return fail();
        result[key] = Object.fromEntries(Object.entries(child).map(([name, dependency]) =>
          [name, Array.isArray(dependency) ? dependency : visit(dependency, depth + 1)]));
      } else if (schemaChildren.has(key)) result[key] = visit(child, depth + 1);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'nullable')) {
      if (value.nullable !== true || typeof value.type !== 'string' || !primitiveTypes.has(value.type) ||
          Object.keys(value).some(key => !primitiveAnnotations.has(key))) return fail();
      result.type = value.type === 'null' ? 'null' : [value.type, 'null'];
      delete result.nullable;
    }
    active.delete(value);
    return result;
  };
  const result = visit(input, 0) as Record<string, unknown>;
  // Existing full-body byte limits and UNKNOWN/cache slot reserves cannot become cheaper or insufficient.
  if (Buffer.byteLength(JSON.stringify(result)) > originalBytes) throw Error('engine_response_schema_expanded');
  return result;
}
