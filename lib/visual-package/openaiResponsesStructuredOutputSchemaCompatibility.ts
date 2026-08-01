import { canonicalJsonDigest } from './integrity';

export const OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION =
  'openai-responses-structured-output-compatibility-profile/v1' as const;
export const OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION =
  'openai-responses-structured-output-compatibility-evidence/v1' as const;

export const OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE = {
  version:
    OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  authority:
    'official-openai-structured-outputs-supported-schemas-guide',
  root: {
    type: 'object',
    anyOfAllowed: false,
  },
  supportedTypes: [
    'array',
    'boolean',
    'integer',
    'null',
    'number',
    'object',
    'string',
  ],
  supportedKeywords: [
    '$defs',
    '$ref',
    '$schema',
    'additionalProperties',
    'anyOf',
    'const',
    'description',
    'enum',
    'exclusiveMaximum',
    'exclusiveMinimum',
    'format',
    'items',
    'maximum',
    'maxItems',
    'minimum',
    'minItems',
    'multipleOf',
    'pattern',
    'properties',
    'required',
    'type',
  ],
  supportedStringFormats: [
    'date',
    'date-time',
    'duration',
    'email',
    'hostname',
    'ipv4',
    'ipv6',
    'time',
    'uuid',
  ],
  unsupportedCompositionKeywords: [
    'allOf',
    'dependentRequired',
    'dependentSchemas',
    'else',
    'if',
    'not',
    'then',
  ],
  strictObjectPolicy: {
    everyPropertyRequired: true,
    additionalProperties: false,
  },
  literalPolicy: {
    explicitTypeRequiredForConst: true,
    explicitTypeRequiredForEnum: true,
  },
  limits: {
    maximumObjectProperties: 5_000,
    maximumNestingDepth: 10,
    maximumNamedStringCharacters: 120_000,
    maximumEnumValues: 1_000,
    largeStringEnumThreshold: 250,
    maximumLargeStringEnumCharacters: 15_000,
  },
} as const;

export const OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST =
  canonicalJsonDigest(
    OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
  );

export type OpenAIResponsesStructuredOutputCompatibilityRuleId =
  | 'OAI_SO_ADDITIONAL_PROPERTIES_FALSE'
  | 'OAI_SO_ANY_OF_INVALID'
  | 'OAI_SO_ARRAY_ITEMS_REQUIRED'
  | 'OAI_SO_CONST_TYPE_MISMATCH'
  | 'OAI_SO_CONST_TYPE_REQUIRED'
  | 'OAI_SO_DEFINITIONS_INVALID'
  | 'OAI_SO_DESCRIPTION_INVALID'
  | 'OAI_SO_ENUM_INVALID'
  | 'OAI_SO_ENUM_LIMIT_EXCEEDED'
  | 'OAI_SO_ENUM_STRING_LIMIT_EXCEEDED'
  | 'OAI_SO_ENUM_TYPE_MISMATCH'
  | 'OAI_SO_ENUM_TYPE_REQUIRED'
  | 'OAI_SO_FORMAT_UNSUPPORTED'
  | 'OAI_SO_KEYWORD_REQUIRES_ARRAY'
  | 'OAI_SO_KEYWORD_REQUIRES_NUMBER'
  | 'OAI_SO_KEYWORD_REQUIRES_STRING'
  | 'OAI_SO_KEYWORD_UNSUPPORTED'
  | 'OAI_SO_META_SCHEMA_INVALID'
  | 'OAI_SO_NAMED_STRING_LIMIT_EXCEEDED'
  | 'OAI_SO_NESTING_DEPTH_EXCEEDED'
  | 'OAI_SO_OBJECT_PROPERTIES_INVALID'
  | 'OAI_SO_OBJECT_PROPERTY_LIMIT_EXCEEDED'
  | 'OAI_SO_PATTERN_INVALID'
  | 'OAI_SO_REFERENCE_INVALID'
  | 'OAI_SO_REQUIRED_FIELDS_INVALID'
  | 'OAI_SO_ROOT_ANY_OF_UNSUPPORTED'
  | 'OAI_SO_ROOT_OBJECT_REQUIRED'
  | 'OAI_SO_SCHEMA_NODE_INVALID'
  | 'OAI_SO_SCHEMA_SERIALIZATION_INVALID'
  | 'OAI_SO_TYPE_INVALID'
  | 'OAI_SO_TYPE_REQUIRED';

export interface OpenAIResponsesStructuredOutputCompatibilityIssue {
  ruleId: OpenAIResponsesStructuredOutputCompatibilityRuleId;
  /** Structural-only path. Property/definition names and literal values are never emitted. */
  path: string;
}

export interface OpenAIResponsesStructuredOutputCompatibilityMetrics {
  objectPropertyCount: number;
  maximumNestingDepth: number;
  namedStringCharacterCount: number;
  enumValueCount: number;
}

export interface OpenAIResponsesStructuredOutputCompatibilityEvidence {
  version:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
  profileVersion:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
  profileDigest: string;
  status: 'compatible' | 'incompatible';
  serializedSchemaDigest: string | null;
  metrics: OpenAIResponsesStructuredOutputCompatibilityMetrics;
  issues: OpenAIResponsesStructuredOutputCompatibilityIssue[];
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface OpenAIResponsesStructuredOutputCompatibilityAuthority {
  profileVersion:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION;
  profileDigest: string;
  evidenceVersion:
    typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION;
  evidenceDigest: string;
  status: 'compatible';
  serializedSchemaDigest: string;
}

type JsonRecord = Record<string, unknown>;
type JsonSchemaType =
  (typeof OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE.supportedTypes)[number];

const SUPPORTED_TYPES = new Set<string>(
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE.supportedTypes,
);
const SUPPORTED_KEYWORDS = new Set<string>(
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE.supportedKeywords,
);
const SUPPORTED_STRING_FORMATS = new Set<string>(
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE.supportedStringFormats,
);

function record(value: unknown): JsonRecord | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function jsonValueType(value: unknown): JsonSchemaType | null {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number';
    case 'object':
      return 'object';
    default:
      return null;
  }
}

function declaredTypes(value: unknown): JsonSchemaType[] | null {
  const candidates = Array.isArray(value) ? value : [value];
  if (
    candidates.length === 0 ||
    candidates.some(
      (candidate) =>
        typeof candidate !== 'string' ||
        !SUPPORTED_TYPES.has(candidate),
    ) ||
    new Set(candidates).size !== candidates.length
  ) {
    return null;
  }
  if (
    candidates.length > 1 &&
    (candidates.length !== 2 || !candidates.includes('null'))
  ) {
    return null;
  }
  return candidates as JsonSchemaType[];
}

function typesAcceptValue(
  types: readonly JsonSchemaType[],
  value: unknown,
): boolean {
  const actual = jsonValueType(value);
  return (
    actual !== null &&
    (types.includes(actual) ||
      (actual === 'integer' && types.includes('number')))
  );
}

function serializeSchema(value: unknown): {
  serialized: unknown | null;
  digest: string | null;
} {
  try {
    const bytes = JSON.stringify(value);
    if (typeof bytes !== 'string') {
      return { serialized: null, digest: null };
    }
    const serialized = JSON.parse(bytes) as unknown;
    return {
      serialized,
      digest: canonicalJsonDigest(serialized),
    };
  } catch {
    return { serialized: null, digest: null };
  }
}

function sortedIssues(
  issues: readonly OpenAIResponsesStructuredOutputCompatibilityIssue[],
): OpenAIResponsesStructuredOutputCompatibilityIssue[] {
  const unique = new Map<string, OpenAIResponsesStructuredOutputCompatibilityIssue>();
  for (const issue of issues) {
    unique.set(`${issue.path}\u0000${issue.ruleId}`, issue);
  }
  return [...unique.values()].sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path, 'en');
    return pathOrder !== 0
      ? pathOrder
      : left.ruleId.localeCompare(right.ruleId, 'en');
  });
}

function withoutEvidenceDigest(
  value: Omit<
    OpenAIResponsesStructuredOutputCompatibilityEvidence,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return value;
}

export function evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
  schema: unknown,
): OpenAIResponsesStructuredOutputCompatibilityEvidence {
  const limits =
    OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE.limits;
  const serialized = serializeSchema(schema);
  const issues: OpenAIResponsesStructuredOutputCompatibilityIssue[] = [];
  const metrics: OpenAIResponsesStructuredOutputCompatibilityMetrics = {
    objectPropertyCount: 0,
    maximumNestingDepth: 0,
    namedStringCharacterCount: 0,
    enumValueCount: 0,
  };
  const add = (
    ruleId: OpenAIResponsesStructuredOutputCompatibilityRuleId,
    path: string,
  ): void => {
    issues.push({ ruleId, path });
  };

  if (serialized.serialized === null) {
    add('OAI_SO_SCHEMA_SERIALIZATION_INVALID', 'root');
  } else {
    const visit = (
      value: unknown,
      structuralPath: string,
      depth: number,
      rootNode = false,
    ): void => {
      metrics.maximumNestingDepth = Math.max(
        metrics.maximumNestingDepth,
        depth,
      );
      if (depth > limits.maximumNestingDepth) {
        add('OAI_SO_NESTING_DEPTH_EXCEEDED', structuralPath);
      }
      const node = record(value);
      if (!node) {
        add('OAI_SO_SCHEMA_NODE_INVALID', structuralPath);
        return;
      }

      const keys = Object.keys(node).sort();
      keys.forEach((key, index) => {
        if (!SUPPORTED_KEYWORDS.has(key)) {
          add(
            'OAI_SO_KEYWORD_UNSUPPORTED',
            `${structuralPath}.keywords[${index}]`,
          );
        }
      });

      if (
        Object.prototype.hasOwnProperty.call(node, 'description') &&
        typeof node.description !== 'string'
      ) {
        add('OAI_SO_DESCRIPTION_INVALID', structuralPath);
      }

      const hasType = Object.prototype.hasOwnProperty.call(node, 'type');
      const types = hasType ? declaredTypes(node.type) : null;
      if (hasType && !types) {
        add('OAI_SO_TYPE_INVALID', structuralPath);
      }
      const hasAnyOf = Object.prototype.hasOwnProperty.call(node, 'anyOf');
      const hasRef = Object.prototype.hasOwnProperty.call(node, '$ref');
      if (!hasType && !hasAnyOf && !hasRef) {
        add('OAI_SO_TYPE_REQUIRED', structuralPath);
      }

      if (rootNode) {
        if (
          !types ||
          types.length !== 1 ||
          types[0] !== 'object'
        ) {
          add('OAI_SO_ROOT_OBJECT_REQUIRED', structuralPath);
        }
        if (hasAnyOf) {
          add('OAI_SO_ROOT_ANY_OF_UNSUPPORTED', structuralPath);
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, '$schema')) {
        if (
          !rootNode ||
          node.$schema !==
            'http://json-schema.org/draft-07/schema#'
        ) {
          add('OAI_SO_META_SCHEMA_INVALID', structuralPath);
        }
      }

      if (hasRef) {
        if (
          typeof node.$ref !== 'string' ||
          (node.$ref !== '#' && !node.$ref.startsWith('#/$defs/'))
        ) {
          add('OAI_SO_REFERENCE_INVALID', structuralPath);
        }
      }

      if (hasAnyOf) {
        if (!Array.isArray(node.anyOf) || node.anyOf.length === 0) {
          add('OAI_SO_ANY_OF_INVALID', structuralPath);
        } else {
          node.anyOf.forEach((branch, index) =>
            visit(
              branch,
              `${structuralPath}.anyOf[${index}]`,
              depth + 1,
            ),
          );
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, '$defs')) {
        const definitions = record(node.$defs);
        if (!definitions) {
          add('OAI_SO_DEFINITIONS_INVALID', structuralPath);
        } else {
          Object.keys(definitions)
            .sort()
            .forEach((name, index) => {
              metrics.namedStringCharacterCount += name.length;
              visit(
                definitions[name],
                `${structuralPath}.$defs[${index}]`,
                depth + 1,
              );
            });
        }
      }

      const isObject = types?.includes('object') ?? false;
      const properties = record(node.properties);
      if (isObject) {
        if (!properties) {
          add('OAI_SO_OBJECT_PROPERTIES_INVALID', structuralPath);
        } else {
          const propertyNames = Object.keys(properties).sort();
          metrics.objectPropertyCount += propertyNames.length;
          propertyNames.forEach((name, index) => {
            metrics.namedStringCharacterCount += name.length;
            visit(
              properties[name],
              `${structuralPath}.properties[${index}]`,
              depth + 1,
            );
          });
          if (
            !Array.isArray(node.required) ||
            node.required.some((entry) => typeof entry !== 'string') ||
            new Set(node.required).size !== node.required.length ||
            node.required.length !== propertyNames.length ||
            propertyNames.some(
              (name) => !(node.required as unknown[]).includes(name),
            )
          ) {
            add('OAI_SO_REQUIRED_FIELDS_INVALID', structuralPath);
          }
        }
        if (node.additionalProperties !== false) {
          add('OAI_SO_ADDITIONAL_PROPERTIES_FALSE', structuralPath);
        }
      } else if (
        Object.prototype.hasOwnProperty.call(node, 'properties') ||
        Object.prototype.hasOwnProperty.call(node, 'required') ||
        Object.prototype.hasOwnProperty.call(node, 'additionalProperties')
      ) {
        add('OAI_SO_OBJECT_PROPERTIES_INVALID', structuralPath);
      }

      const isArray = types?.includes('array') ?? false;
      if (isArray) {
        if (!Object.prototype.hasOwnProperty.call(node, 'items')) {
          add('OAI_SO_ARRAY_ITEMS_REQUIRED', structuralPath);
        } else {
          visit(node.items, `${structuralPath}.items`, depth + 1);
        }
      } else if (Object.prototype.hasOwnProperty.call(node, 'items')) {
        add('OAI_SO_KEYWORD_REQUIRES_ARRAY', structuralPath);
      }

      for (const keyword of ['minItems', 'maxItems'] as const) {
        if (Object.prototype.hasOwnProperty.call(node, keyword)) {
          if (
            !isArray ||
            typeof node[keyword] !== 'number' ||
            !Number.isSafeInteger(node[keyword]) ||
            (node[keyword] as number) < 0
          ) {
            add('OAI_SO_KEYWORD_REQUIRES_ARRAY', structuralPath);
          }
        }
      }

      const isString = types?.includes('string') ?? false;
      if (Object.prototype.hasOwnProperty.call(node, 'pattern')) {
        if (!isString || typeof node.pattern !== 'string') {
          add('OAI_SO_KEYWORD_REQUIRES_STRING', structuralPath);
        } else {
          try {
            new RegExp(node.pattern);
          } catch {
            add('OAI_SO_PATTERN_INVALID', structuralPath);
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(node, 'format')) {
        if (!isString || typeof node.format !== 'string') {
          add('OAI_SO_KEYWORD_REQUIRES_STRING', structuralPath);
        } else if (!SUPPORTED_STRING_FORMATS.has(node.format)) {
          add('OAI_SO_FORMAT_UNSUPPORTED', structuralPath);
        }
      }

      const isNumber =
        (types?.includes('number') ?? false) ||
        (types?.includes('integer') ?? false);
      for (const keyword of [
        'multipleOf',
        'maximum',
        'exclusiveMaximum',
        'minimum',
        'exclusiveMinimum',
      ] as const) {
        if (
          Object.prototype.hasOwnProperty.call(node, keyword) &&
          (!isNumber ||
            typeof node[keyword] !== 'number' ||
            !Number.isFinite(node[keyword]))
        ) {
          add('OAI_SO_KEYWORD_REQUIRES_NUMBER', structuralPath);
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, 'const')) {
        if (!types) {
          add('OAI_SO_CONST_TYPE_REQUIRED', structuralPath);
        } else if (!typesAcceptValue(types, node.const)) {
          add('OAI_SO_CONST_TYPE_MISMATCH', structuralPath);
        }
        if (typeof node.const === 'string') {
          metrics.namedStringCharacterCount += node.const.length;
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, 'enum')) {
        if (!types) {
          add('OAI_SO_ENUM_TYPE_REQUIRED', structuralPath);
        }
        if (!Array.isArray(node.enum) || node.enum.length === 0) {
          add('OAI_SO_ENUM_INVALID', structuralPath);
        } else {
          metrics.enumValueCount += node.enum.length;
          let enumStringCharacters = 0;
          for (const entry of node.enum) {
            if (types && !typesAcceptValue(types, entry)) {
              add('OAI_SO_ENUM_TYPE_MISMATCH', structuralPath);
            }
            if (typeof entry === 'string') {
              enumStringCharacters += entry.length;
              metrics.namedStringCharacterCount += entry.length;
            }
          }
          if (
            node.enum.length > limits.largeStringEnumThreshold &&
            enumStringCharacters >
              limits.maximumLargeStringEnumCharacters
          ) {
            add(
              'OAI_SO_ENUM_STRING_LIMIT_EXCEEDED',
              structuralPath,
            );
          }
        }
      }
    };

    visit(serialized.serialized, 'root', 1, true);
  }

  if (
    metrics.objectPropertyCount >
    limits.maximumObjectProperties
  ) {
    add('OAI_SO_OBJECT_PROPERTY_LIMIT_EXCEEDED', 'root');
  }
  if (
    metrics.namedStringCharacterCount >
    limits.maximumNamedStringCharacters
  ) {
    add('OAI_SO_NAMED_STRING_LIMIT_EXCEEDED', 'root');
  }
  if (metrics.enumValueCount > limits.maximumEnumValues) {
    add('OAI_SO_ENUM_LIMIT_EXCEEDED', 'root');
  }

  const stableIssues = sortedIssues(issues);
  const withoutDigest = {
    version:
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
    profileVersion:
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
    profileDigest:
      OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
    status:
      stableIssues.length === 0
        ? ('compatible' as const)
        : ('incompatible' as const),
    serializedSchemaDigest: serialized.digest,
    metrics,
    issues: stableIssues,
  };
  return {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      withoutEvidenceDigest(withoutDigest),
    ),
  };
}

export class OpenAIResponsesStructuredOutputSchemaCompatibilityError extends Error {
  constructor(
    readonly evidence: OpenAIResponsesStructuredOutputCompatibilityEvidence,
  ) {
    super('OpenAI Responses structured-output schema is incompatible');
    this.name =
      'OpenAIResponsesStructuredOutputSchemaCompatibilityError';
  }
}

export function assertOpenAIResponsesStructuredOutputSchemaCompatible(
  schema: unknown,
): OpenAIResponsesStructuredOutputCompatibilityEvidence & {
  status: 'compatible';
  serializedSchemaDigest: string;
} {
  const evidence =
    evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
      schema,
    );
  if (
    evidence.status !== 'compatible' ||
    evidence.serializedSchemaDigest === null
  ) {
    throw new OpenAIResponsesStructuredOutputSchemaCompatibilityError(
      evidence,
    );
  }
  return evidence as OpenAIResponsesStructuredOutputCompatibilityEvidence & {
    status: 'compatible';
    serializedSchemaDigest: string;
  };
}

export function compatibilityAuthorityFromEvidence(
  evidence: OpenAIResponsesStructuredOutputCompatibilityEvidence & {
    status: 'compatible';
    serializedSchemaDigest: string;
  },
): OpenAIResponsesStructuredOutputCompatibilityAuthority {
  return {
    profileVersion: evidence.profileVersion,
    profileDigest: evidence.profileDigest,
    evidenceVersion: evidence.version,
    evidenceDigest: evidence.digest,
    status: evidence.status,
    serializedSchemaDigest: evidence.serializedSchemaDigest,
  };
}
