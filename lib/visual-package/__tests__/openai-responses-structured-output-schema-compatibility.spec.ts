import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/templateDraftSchema';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/sourceEvidenceIdRepair';
import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  PAGE_CONTRACT_REPAIR_SCHEMA_VERSION,
  PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
  PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/pageContractRepair';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/bookSurfaceRepair';
import {
  STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION,
} from '@/lib/visual-contract-compiler/structuralBundleRepair';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION,
} from '@/lib/visual-package/preRenderBlueprintDraftSchema';
import {
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
  OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
  OpenAIResponsesStructuredOutputSchemaCompatibilityError,
  assertOpenAIResponsesStructuredOutputSchemaCompatible,
  evaluateOpenAIResponsesStructuredOutputSchemaCompatibility,
  type OpenAIResponsesStructuredOutputCompatibilityRuleId,
} from '@/lib/visual-package/openaiResponsesStructuredOutputSchemaCompatibility';

function objectSchema(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function withProperty(schema: unknown): Record<string, unknown> {
  return objectSchema({ value: schema });
}

function expectRule(
  schema: unknown,
  ruleId: OpenAIResponsesStructuredOutputCompatibilityRuleId,
): void {
  const evidence =
    evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
      schema,
    );
  expect(evidence.status).toBe('incompatible');
  expect(evidence.issues.map((issue) => issue.ruleId)).toContain(
    ruleId,
  );
  expect(() =>
    assertOpenAIResponsesStructuredOutputSchemaCompatible(schema),
  ).toThrow(
    OpenAIResponsesStructuredOutputSchemaCompatibilityError,
  );
}

function allConstNodes(schema: unknown): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      return;
    }
    const node = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(node, 'const')) {
      nodes.push(node);
    }
    Object.values(node).forEach(visit);
  };
  visit(JSON.parse(JSON.stringify(schema)) as unknown);
  return nodes;
}

describe('OpenAI Responses structured-output compatibility profile', () => {
  it('positive-controls the fully serialized current Visual Contract and Blueprint schemas', () => {
    expect(TEMPLATE_DRAFT_SCHEMA_VERSION).toBe(
      'vc-draft-schema/v15',
    );
    expect(PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION).toBe(
      'pre-render-blueprint-draft-schema/v5',
    );
    expect(SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION).toBe(
      'source-evidence-id-repair-schema/v1',
    );
    expect(PAGE_CONTRACT_REPAIR_SCHEMA_VERSION).toBe(
      'page-contract-repair-schema/v2',
    );
    expect(PAGE_SPATIAL_REFERENCE_REPAIR_SCHEMA_VERSION).toBe(
      'page-spatial-reference-repair-schema/v1',
    );
    expect(BOOK_SURFACE_REPAIR_SCHEMA_VERSION).toBe(
      'book-surface-repair-schema/v4',
    );
    expect(STRUCTURAL_BUNDLE_REPAIR_SCHEMA_VERSION).toBe(
      'structural-bundle-repair-schema/v2',
    );

    for (const schema of [
      TEMPLATE_DRAFT_JSON_SCHEMA,
      SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
      PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
      PAGE_SPATIAL_REFERENCE_REPAIR_JSON_SCHEMA,
      BOOK_SURFACE_REPAIR_JSON_SCHEMA,
      STRUCTURAL_BUNDLE_REPAIR_JSON_SCHEMA,
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    ]) {
      const serialized = JSON.parse(
        JSON.stringify(schema),
      ) as unknown;
      const evidence =
        assertOpenAIResponsesStructuredOutputSchemaCompatible(
          serialized,
        );
      expect(evidence).toMatchObject({
        version:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_EVIDENCE_VERSION,
        profileVersion:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_VERSION,
        profileDigest:
          OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE_DIGEST,
        status: 'compatible',
        issues: [],
      });
      expect(evidence.metrics.objectPropertyCount).toBeLessThanOrEqual(
        OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE
          .limits.maximumObjectProperties,
      );
      expect(evidence.metrics.maximumNestingDepth).toBeLessThanOrEqual(
        OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE
          .limits.maximumNestingDepth,
      );
      expect(evidence.metrics.namedStringCharacterCount).toBeLessThanOrEqual(
        OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE
          .limits.maximumNamedStringCharacters,
      );
      expect(evidence.metrics.enumValueCount).toBeLessThanOrEqual(
        OPENAI_RESPONSES_STRUCTURED_OUTPUT_COMPATIBILITY_PROFILE
          .limits.maximumEnumValues,
      );
    }
  });

  it('uses an explicit matching type for every production const, including the Blueprint boolean literal', () => {
    const visualContractConsts = allConstNodes(
      TEMPLATE_DRAFT_JSON_SCHEMA,
    );
    const blueprintConsts = allConstNodes(
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    );
    expect(visualContractConsts).toHaveLength(15);
    expect(blueprintConsts.length).toBeGreaterThan(5);
    for (const node of [
      ...visualContractConsts,
      ...blueprintConsts,
    ]) {
      expect(node.type).toBe(typeof node.const);
    }
    expect(
      blueprintConsts.some(
        (node) => node.type === 'boolean' && node.const === true,
      ),
    ).toBe(true);
  });

  it('positive-controls the installed OpenAI Zod helper typed-literal serialization', () => {
    const format = zodTextFormat(
      z.object({
        kind: z.literal('typed-string'),
        enabled: z.literal(true),
      }),
      'TypedLiteralControl',
    );
    const properties = (
      format.schema as {
        properties: Record<string, Record<string, unknown>>;
      }
    ).properties;
    expect(properties.kind).toMatchObject({
      type: 'string',
      const: 'typed-string',
    });
    expect(properties.enabled).toMatchObject({
      type: 'boolean',
      const: true,
    });
    expect(
      assertOpenAIResponsesStructuredOutputSchemaCompatible(
        format.schema,
      ).status,
    ).toBe('compatible');
  });

  it('accepts the supported subset controls used by this repository', () => {
    const schema = {
      ...objectSchema({
        nullable: { type: ['string', 'null'] },
        patterned: {
          type: 'string',
          pattern: '^[a-z]+$',
          format: 'hostname',
        },
        count: {
          type: 'integer',
          minimum: 0,
          maximum: 10,
          exclusiveMinimum: -1,
          exclusiveMaximum: 11,
          multipleOf: 1,
        },
        values: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: { type: 'string' },
        },
        choice: {
          anyOf: [
            { type: 'string' },
            { type: 'integer' },
          ],
        },
        linked: { $ref: '#/$defs/linked' },
      }),
      $defs: {
        linked: objectSchema({ id: { type: 'string' } }),
      },
    };
    expect(
      assertOpenAIResponsesStructuredOutputSchemaCompatible(schema)
        .status,
    ).toBe('compatible');
  });

  it.each<{
    label: string;
    schema: unknown;
    rule: OpenAIResponsesStructuredOutputCompatibilityRuleId;
  }>([
    {
      label: 'root is not an object',
      schema: { type: 'string' },
      rule: 'OAI_SO_ROOT_OBJECT_REQUIRED',
    },
    {
      label: 'root contains anyOf',
      schema: {
        ...objectSchema({}),
        anyOf: [objectSchema({})],
      },
      rule: 'OAI_SO_ROOT_ANY_OF_UNSUPPORTED',
    },
    {
      label: 'type is absent',
      schema: withProperty({ description: 'missing type' }),
      rule: 'OAI_SO_TYPE_REQUIRED',
    },
    {
      label: 'type union is unsupported',
      schema: withProperty({ type: ['string', 'integer'] }),
      rule: 'OAI_SO_TYPE_INVALID',
    },
    {
      label: 'object properties are absent',
      schema: withProperty({
        type: 'object',
        additionalProperties: false,
        required: [],
      }),
      rule: 'OAI_SO_OBJECT_PROPERTIES_INVALID',
    },
    {
      label: 'object required is incomplete',
      schema: withProperty({
        type: 'object',
        additionalProperties: false,
        properties: { named: { type: 'string' } },
        required: [],
      }),
      rule: 'OAI_SO_REQUIRED_FIELDS_INVALID',
    },
    {
      label: 'additional properties is not false',
      schema: withProperty({
        type: 'object',
        additionalProperties: true,
        properties: {},
        required: [],
      }),
      rule: 'OAI_SO_ADDITIONAL_PROPERTIES_FALSE',
    },
    {
      label: 'array items are absent',
      schema: withProperty({ type: 'array' }),
      rule: 'OAI_SO_ARRAY_ITEMS_REQUIRED',
    },
    {
      label: 'anyOf is empty',
      schema: withProperty({ anyOf: [] }),
      rule: 'OAI_SO_ANY_OF_INVALID',
    },
    {
      label: 'const lacks an explicit type',
      schema: withProperty({ const: 'sensitive-literal' }),
      rule: 'OAI_SO_CONST_TYPE_REQUIRED',
    },
    {
      label: 'const does not match its type',
      schema: withProperty({ type: 'boolean', const: 'true' }),
      rule: 'OAI_SO_CONST_TYPE_MISMATCH',
    },
    {
      label: 'enum lacks an explicit type',
      schema: withProperty({ enum: ['one'] }),
      rule: 'OAI_SO_ENUM_TYPE_REQUIRED',
    },
    {
      label: 'enum does not match its type',
      schema: withProperty({ type: 'integer', enum: ['one'] }),
      rule: 'OAI_SO_ENUM_TYPE_MISMATCH',
    },
    {
      label: 'unsupported composition keyword is present',
      schema: withProperty({
        type: 'string',
        allOf: [{ type: 'string' }],
      }),
      rule: 'OAI_SO_KEYWORD_UNSUPPORTED',
    },
    {
      label: 'meta-schema marker is not the SDK Draft-07 marker',
      schema: {
        ...objectSchema({}),
        $schema: 'https://json-schema.org/draft/2020-12/schema',
      },
      rule: 'OAI_SO_META_SCHEMA_INVALID',
    },
    {
      label: 'string format is unsupported',
      schema: withProperty({ type: 'string', format: 'uri' }),
      rule: 'OAI_SO_FORMAT_UNSUPPORTED',
    },
    {
      label: 'pattern is invalid',
      schema: withProperty({ type: 'string', pattern: '[' }),
      rule: 'OAI_SO_PATTERN_INVALID',
    },
    {
      label: 'numeric keyword is attached to a string',
      schema: withProperty({ type: 'string', minimum: 0 }),
      rule: 'OAI_SO_KEYWORD_REQUIRES_NUMBER',
    },
    {
      label: 'array keyword is attached to a string',
      schema: withProperty({ type: 'string', minItems: 0 }),
      rule: 'OAI_SO_KEYWORD_REQUIRES_ARRAY',
    },
    {
      label: 'reference escapes local definitions',
      schema: withProperty({ $ref: 'https://invalid.example/schema' }),
      rule: 'OAI_SO_REFERENCE_INVALID',
    },
  ])('rejects $label with a stable rule identifier', ({ schema, rule }) => {
    expectRule(schema, rule);
  });

  it('enforces each quantitative limit in the compatibility profile', () => {
    const tooManyProperties = Object.fromEntries(
      Array.from({ length: 5_001 }, (_, index) => [
        `property_${index}`,
        { type: 'string' },
      ]),
    );
    expectRule(
      objectSchema(tooManyProperties),
      'OAI_SO_OBJECT_PROPERTY_LIMIT_EXCEEDED',
    );

    let tooDeep: Record<string, unknown> = { type: 'string' };
    for (let index = 0; index < 10; index += 1) {
      tooDeep = objectSchema({ child: tooDeep });
    }
    expectRule(
      tooDeep,
      'OAI_SO_NESTING_DEPTH_EXCEEDED',
    );

    expectRule(
      withProperty({
        type: 'string',
        const: 'x'.repeat(120_001),
      }),
      'OAI_SO_NAMED_STRING_LIMIT_EXCEEDED',
    );

    expectRule(
      withProperty({
        type: 'integer',
        enum: Array.from({ length: 1_001 }, (_, index) => index),
      }),
      'OAI_SO_ENUM_LIMIT_EXCEEDED',
    );

    expectRule(
      withProperty({
        type: 'string',
        enum: Array.from(
          { length: 251 },
          (_, index) => `${index}-${'x'.repeat(60)}`,
        ),
      }),
      'OAI_SO_ENUM_STRING_LIMIT_EXCEEDED',
    );
  });

  it('emits deterministic sanitized evidence without property names or literal values', () => {
    const secretName = 'story_source_secret_property';
    const secretLiteral = 'story_source_secret_literal';
    const schema = objectSchema({
      [secretName]: { const: secretLiteral },
    });
    const first =
      evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
        schema,
      );
    const second =
      evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
        schema,
      );
    expect(second).toEqual(first);
    expect(first.issues).toEqual([
      {
        path: 'root.properties[0]',
        ruleId: 'OAI_SO_CONST_TYPE_REQUIRED',
      },
      {
        path: 'root.properties[0]',
        ruleId: 'OAI_SO_TYPE_REQUIRED',
      },
    ]);
    const serializedEvidence = JSON.stringify(first);
    expect(serializedEvidence).not.toContain(secretName);
    expect(serializedEvidence).not.toContain(secretLiteral);
  });

  it('fails closed and deterministically when the schema cannot be serialized', () => {
    const cyclic = objectSchema({});
    cyclic.self = cyclic;
    const first =
      evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
        cyclic,
      );
    const second =
      evaluateOpenAIResponsesStructuredOutputSchemaCompatibility(
        cyclic,
      );
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'incompatible',
      serializedSchemaDigest: null,
      issues: [
        {
          path: 'root',
          ruleId: 'OAI_SO_SCHEMA_SERIALIZATION_INVALID',
        },
      ],
    });
  });
});
