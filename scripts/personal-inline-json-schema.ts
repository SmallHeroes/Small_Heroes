/** Constraint-preserving expansion for an explicit diagnostic wire only. No provider work. */
export function inlineLocalJsonSchemaReferences(schema: Record<string, unknown>): Record<string, unknown> {
  let nodes = 0;
  const fail = (): never => { throw new Error('inline_schema_invalid'); };
  function walk(value: unknown, stack: readonly string[], depth: number, root = false): unknown {
    if (++nodes > 20000 || depth > 60) return fail();
    if (Array.isArray(value)) return value.map(v => walk(v, stack, depth + 1));
    if (!value || typeof value !== 'object') return value;
    const obj = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(obj, '$ref')) {
      if (Object.keys(obj).length !== 1 || typeof obj.$ref !== 'string' || !obj.$ref.startsWith('#/') || stack.includes(obj.$ref)) return fail();
      let target: unknown = schema;
      for (const key of obj.$ref.slice(2).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'))) {
        if (!target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, key)) return fail();
        target = (target as Record<string, unknown>)[key];
      }
      return walk(target, [...stack, obj.$ref], depth + 1);
    }
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !root || !['definitions', '$defs'].includes(k))
      .map(([k, v]) => [k, walk(v, stack, depth + 1)]));
  }
  const result = walk(schema, [], 0, true) as Record<string, unknown>;
  if (Buffer.byteLength(JSON.stringify(result)) > 128000) return fail();
  return result;
}
