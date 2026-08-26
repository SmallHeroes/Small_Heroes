function schemaNodeRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('test schema node is not an object');
  }
  return value as Record<string, unknown>;
}

export function projectClosedSchemaFixture(args: {
  value: unknown;
  schema: unknown;
  root: Record<string, unknown>;
  path?: string;
}): unknown {
  const pathLabel = args.path ?? '$';
  let schema = schemaNodeRecord(args.schema);
  if (typeof schema.$ref === 'string') {
    const segments = schema.$ref.replace(/^#\//, '').split('/');
    let resolved: unknown = args.root;
    for (const segment of segments) {
      resolved = schemaNodeRecord(resolved)[
        segment.replace(/~1/g, '/').replace(/~0/g, '~')
      ];
    }
    schema = schemaNodeRecord(resolved);
  }
  const union = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : null;
  if (union) {
    for (const candidate of union) {
      try {
        return projectClosedSchemaFixture({
          value: args.value,
          schema: candidate,
          root: args.root,
          path: pathLabel,
        });
      } catch {
        // Try the next closed branch.
      }
    }
    throw new Error(`test fixture does not match schema union at ${pathLabel}`);
  }
  const types = Array.isArray(schema.type)
    ? schema.type
    : typeof schema.type === 'string'
      ? [schema.type]
      : [];
  if (args.value === undefined) {
    if (types.includes('null')) return null;
    if (types.includes('array')) return [];
    throw new Error(`missing non-null test fixture value at ${pathLabel}`);
  }
  if (args.value === null) {
    if (types.includes('null')) return null;
    throw new Error(`unexpected null test fixture value at ${pathLabel}`);
  }
  if (types.includes('object')) {
    const value = schemaNodeRecord(args.value);
    const properties = schemaNodeRecord(schema.properties);
    return Object.fromEntries(
      Object.entries(properties).map(([key, childSchema]) => [
        key,
        projectClosedSchemaFixture({
          value: value[key],
          schema: childSchema,
          root: args.root,
          path: `${pathLabel}.${key}`,
        }),
      ]),
    );
  }
  if (types.includes('array')) {
    if (!Array.isArray(args.value)) {
      throw new Error(`non-array test fixture value at ${pathLabel}`);
    }
    return args.value.map((value, index) =>
      projectClosedSchemaFixture({
        value,
        schema: schema.items,
        root: args.root,
        path: `${pathLabel}[${index}]`,
      }),
    );
  }
  if (
    (types.includes('string') && typeof args.value === 'string') ||
    (types.includes('number') && typeof args.value === 'number') ||
    (types.includes('integer') && Number.isInteger(args.value)) ||
    (types.includes('boolean') && typeof args.value === 'boolean')
  ) {
    return structuredClone(args.value);
  }
  throw new Error(`test fixture scalar type is invalid at ${pathLabel}`);
}
