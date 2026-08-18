/**
 * Strict JSON Schema for the DESCRIPTIVE draft the authoring LLM returns (Stage 1 of the live-authoring fix).
 *
 * Used as OpenAI structured-output (`json_schema`, strict) so a 12-page relational doc is produced completely and
 * in-shape instead of truncating under `json_object`. This constrains ONLY the descriptive fields the compiler
 * consumes; the deterministic facts (gender/presence/evidence/laterality, castIds) are overlaid AFTER and are NOT
 * in this schema. Strict-mode invariant (enforced by `obj()`): every object sets additionalProperties:false and
 * lists ALL its properties in `required`; genuinely-optional fields are nullable (type union / anyOf-null).
 */
import {
  ACTION_POLARITY_VALUES,
  ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
  ACTION_SPATIAL_DIRECTION_VALUES,
  ACTION_SPATIAL_RELATION_VALUES,
} from './types';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_ENTITY_KIND_VALUES,
  ACTION_SEMANTIC_SUBJECT_KIND_VALUES,
  ACTION_PREDICATE_VALUES,
  type ActionSemanticEntityKind,
  type ActionSemanticSubjectKind,
} from './actionSemanticCatalog';
import {
  NON_VISUAL_RATIONALE_VALUES,
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
} from './actionSemanticCoverage';

/** Build a strict object schema: additionalProperties:false + required = every property. */
function obj(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const nullableString = { type: ['string', 'null'] } as const;
const nullableNumber = { type: ['number', 'null'] } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;

const anchor = obj({ id: { type: 'string' }, description: { type: 'string' } });
const setReference = obj({
  status: { type: 'string', enum: ['none', 'pending', 'ready'] },
  url: nullableString,
  storageKey: nullableString,
  prompt: nullableString,
});

const location = obj({
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  environmentClass: { type: 'string', enum: ['indoor', 'outdoor', 'neutral'] },
  lighting: { type: 'string' },
  timeOfDay: nullableString,
  anchors: { type: 'array', items: anchor },
  topology: nullableString,
  setIdentityId: nullableString,
  setReference: { anyOf: [setReference, { type: 'null' }] },
});

const setBoardStableLocation = obj({
  locationId: { type: 'string' },
  name: { type: 'string' },
  environmentClass: { type: 'string', enum: ['indoor', 'outdoor', 'neutral'] },
  timeOfDay: { type: 'string' },
  lighting: { type: 'string' },
});
const setBoardStableNode = obj({
  id: { type: 'string' },
  kind: {
    type: 'string',
    enum: ['doorway', 'window', 'balcony_door', 'railing', 'ledge', 'wall', 'floor', 'furniture'],
  },
  description: { type: 'string' },
  stablePropId: nullableString,
});
const setBoardStableRelation = {
  anyOf: [
    obj({
      subjectId: { type: 'string' },
      relation: { type: 'string', const: 'centered_in' },
    }),
    obj({
      subjectId: { type: 'string' },
      relation: {
        type: 'string',
        enum: ['on_same_wall_as', 'adjacent_to', 'opposite_to', 'above', 'below'],
      },
      objectId: { type: 'string' },
    }),
  ],
};
const zoneNodeBinding = {
  anyOf: [
    obj({
      kind: { type: 'string', const: 'prop' },
      id: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'anchor' },
      id: { type: 'string' },
    }),
    { type: 'null' },
  ],
};
const zoneSpatialNode = obj({
  id: { type: 'string' },
  kind: {
    type: 'string',
    enum: ['doorway', 'window', 'balcony_door', 'railing', 'ledge', 'wall', 'floor', 'furniture'],
  },
  description: { type: 'string' },
  bindsTo: zoneNodeBinding,
});
const zone = obj({
  id: { type: 'string' },
  locationId: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  stableGeometry: stringArray,
  spatialNodes: { type: 'array', items: zoneSpatialNode },
  spatialRelations: { type: 'array', items: setBoardStableRelation },
});
const setBoardAreaZoneProjection = obj({
  cardinality: {
    type: 'string',
    enum: ['one_to_one', 'one_to_many'],
  },
  zoneIds: { type: 'array', minItems: 1, items: { type: 'string' } },
});
const setBoardStableArea = obj({
  id: { type: 'string' },
  locationId: { type: 'string' },
  zoneProjection: setBoardAreaZoneProjection,
  spatialNodes: { type: 'array', items: setBoardStableNode },
  spatialRelations: { type: 'array', items: setBoardStableRelation },
});
const setBoardStableAuthority = obj({
  setIdentityId: { type: 'string' },
  locations: { type: 'array', items: setBoardStableLocation },
  areas: { type: 'array', items: setBoardStableArea },
});

const wardrobe = obj({ description: { type: 'string' }, forbidden: stringArray });

const childCast = obj({ id: { type: 'string' }, role: { type: 'string' }, wardrobe });
const companionCast = obj({ id: { type: 'string' }, role: { type: 'string' }, name: nullableString, wardrobe });
const cast = obj({ child: childCast, companion: { anyOf: [companionCast, { type: 'null' }] } });

// Appearance binding — the origin union is FLATTENED into one object with per-kind nullable fields (simpler + fully
// strict-compliant vs anyOf). The validator checks the kind↔payload coherence downstream.
const origin = obj({
  kind: { type: 'string', enum: ['story_evidence', 'family_profile', 'policy_default', 'deterministic_palette'] },
  page: nullableNumber,
  phrase: nullableString,
  policyId: nullableString,
  paletteId: nullableString,
  version: nullableString,
});
const binding = obj({
  mode: { type: 'string', enum: ['explicit', 'family_profile', 'deterministic_palette'] },
  origin,
  value: nullableString,
});
const garment = obj({ id: { type: 'string' }, label: nullableString, colour: binding });

// The LLM drafts ONLY id + garments + forbiddenAppearance per human — appearance (skin/hair) is COMPILER-injected
// from a role policy (S2a), and identity/gender/presence are overlaid from facts.
const humanDraft = obj({
  id: { type: 'string' },
  garments: { type: 'array', items: garment },
  forbiddenAppearance: stringArray,
});

export const TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA = obj({
  id: { type: 'string', pattern: '\\S' },
  name: { type: 'string' },
  description: { type: 'string' },
  material: nullableString,
  scale: nullableString,
  persistence: nullableString,
  firstRevealPage: nullableNumber,
});

/**
 * Strict cover-contract member schema. Exported for the bounded book-surface
 * repair lane so it shares the exact authoring authority with the draft.
 */
export const TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA = obj({
  worldType: { type: 'string' },
  locationId: { type: 'string' },
  zoneId: { type: 'string' },
  castIds: stringArray,
  timeOfDay: nullableString,
  mustShow: stringArray,
  mustNotShow: stringArray,
});

const transition = obj({
  kind: { type: 'string', enum: ['steady', 'before_transition', 'threshold', 'after_transition'] },
  fromZoneId: nullableString,
  toZoneId: nullableString,
  cue: nullableString,
});
const propState = obj({ propId: { type: 'string' }, state: { type: 'string' } });
const propConstraint = obj({
  propId: { type: 'string' },
  visibility: { type: 'string', enum: ['required', 'forbidden'] },
  stateId: nullableString,
  anchorId: nullableString,
});
function actionObjectForKinds(
  kinds: readonly ActionSemanticEntityKind[],
): Record<string, unknown> {
  if (kinds.length === 0) {
    throw new Error('action requirement object schema requires at least one kind');
  }
  return obj({
    kind: {
      type: 'string',
      enum: [...kinds],
    },
    id: { type: 'string' },
  });
}

function actionSubjectForKinds(
  kinds: readonly ActionSemanticSubjectKind[],
  entityReference: Record<string, unknown> | null,
): Record<string, unknown> {
  const variants: Record<string, unknown>[] = [];
  if (entityReference) {
    variants.push(
      obj({
        kind: { type: 'string', const: 'entity' },
        entity: entityReference,
      }),
    );
  }
  if (kinds.some((kind) => kind === 'source_phenomenon')) {
    variants.push(
      obj({
        kind: { type: 'string', const: 'source_phenomenon' },
        sourceEvidenceId: { type: 'string' },
      }),
    );
  }
  if (kinds.some((kind) => kind === 'cast_group')) {
    variants.push(
      obj({
        kind: { type: 'string', const: 'cast_group' },
        castIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
        },
      }),
    );
  }
  if (variants.length === 0) {
    throw new Error('action requirement subject schema requires at least one kind');
  }
  return { anyOf: variants };
}

const GENERIC_ACTION_OBJECT_JSON_SCHEMA = actionObjectForKinds(
  ACTION_SEMANTIC_ENTITY_KIND_VALUES,
);
const GENERIC_ACTION_SUBJECT_JSON_SCHEMA = actionSubjectForKinds(
  ACTION_SEMANTIC_SUBJECT_KIND_VALUES,
  GENERIC_ACTION_OBJECT_JSON_SCHEMA,
);
const GENERIC_ACTION_SPATIAL_EFFECT_JSON_SCHEMA = {
  anyOf: [
    obj({
      kind: { type: 'string', const: 'directional' },
      direction: {
        type: 'string',
        enum: ACTION_SPATIAL_DIRECTION_VALUES,
      },
    }),
    obj({
      kind: { type: 'string', const: 'relation' },
      relation: {
        type: 'string',
        enum: ACTION_SPATIAL_RELATION_VALUES,
      },
      target: GENERIC_ACTION_OBJECT_JSON_SCHEMA,
    }),
  ],
};
const GENERIC_ACTION_SPATIAL_CONSTRAINT_JSON_SCHEMA = obj({
  relation: {
    type: 'string',
    enum: ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
  },
  target: GENERIC_ACTION_OBJECT_JSON_SCHEMA,
});

/**
 * The unchanged whole-draft action shape. The full Story Source already sits
 * close to the immutable 64K provider ceiling, so static catalog coupling is
 * enforced by the validator on this initial/full-draft lane and by the
 * catalog-strict schemas on every bounded page-rewrite lane below.
 */
export const TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA = obj({
  beatId: {
    type: 'string',
    pattern: '^beat:p[1-9][0-9]*:[a-z0-9_]+$',
  },
  subject: GENERIC_ACTION_SUBJECT_JSON_SCHEMA,
  predicate: {
    type: 'string',
    enum: ACTION_PREDICATE_VALUES,
  },
  object: {
    anyOf: [GENERIC_ACTION_OBJECT_JSON_SCHEMA, { type: 'null' }],
  },
  spatialEffect: {
    anyOf: [GENERIC_ACTION_SPATIAL_EFFECT_JSON_SCHEMA, { type: 'null' }],
  },
  spatialConstraint: {
    anyOf: [
      GENERIC_ACTION_SPATIAL_CONSTRAINT_JSON_SCHEMA,
      { type: 'null' },
    ],
  },
  polarity: {
    type: 'string',
    enum: ACTION_POLARITY_VALUES,
  },
  laterality: {
    anyOf: [
      { type: 'string', enum: ['left', 'right'] },
      { type: 'null' },
    ],
  },
});

function nullableOrRequiredSchema(args: {
  rule: 'required' | 'optional' | 'forbidden';
  schema: Record<string, unknown>;
}): Record<string, unknown> {
  if (args.rule === 'required') return args.schema;
  if (args.rule === 'optional') {
    return { anyOf: [args.schema, { type: 'null' }] };
  }
  return { type: 'null' };
}

function actionRuleSignature(
  definition: (typeof ACTION_SEMANTIC_CATALOG)[number],
): string {
  return JSON.stringify({
    subjectKinds: definition.subjectKinds,
    objectRule: definition.objectRule,
    objectKinds: definition.objectKinds,
    spatialEffectRule: definition.spatialEffectRule,
    spatialConstraintRule: definition.spatialConstraintRule,
    spatialConstraintRelations: definition.spatialConstraintRelations,
    lateralityAllowed: definition.lateralityAllowed,
  });
}

interface ActionRequirementSchemaGroup {
  definition: (typeof ACTION_SEMANTIC_CATALOG)[number];
  predicates: string[];
}

function actionRequirementSchemaGroups(): ActionRequirementSchemaGroup[] {
  const groups = new Map<string, ActionRequirementSchemaGroup>();
  for (const definition of ACTION_SEMANTIC_CATALOG) {
    const signature = actionRuleSignature(definition);
    const current = groups.get(signature);
    if (current) {
      current.predicates.push(definition.predicate);
    } else {
      groups.set(signature, {
        definition,
        predicates: [definition.predicate],
      });
    }
  }
  return [...groups.values()];
}

function buildActionRequirementSchemaAuthority(): {
  itemSchema: Record<string, unknown>;
  definitions: Record<string, unknown>;
} {
  const definitions: Record<string, unknown> = {};
  const definitionNames = new Map<string, string>();
  const schemaRef = (
    schema: Record<string, unknown>,
  ): Record<string, unknown> => {
    const signature = JSON.stringify(schema);
    let name = definitionNames.get(signature);
    if (!name) {
      name = `ar${definitionNames.size}`;
      definitionNames.set(signature, name);
      definitions[name] = schema;
    }
    return { $ref: `#/$defs/${name}` };
  };

  const branches = actionRequirementSchemaGroups().map((group) => {
    const { definition } = group;
    if (
      definition.subjectKinds.length === 0 ||
      (definition.objectRule !== 'forbidden' &&
        definition.objectKinds.length === 0) ||
      (definition.objectRule === 'forbidden' &&
        definition.objectKinds.length > 0) ||
      (definition.spatialConstraintRule !== 'forbidden' &&
        definition.spatialConstraintRelations.length === 0) ||
      (definition.spatialConstraintRule === 'forbidden' &&
        definition.spatialConstraintRelations.length > 0)
    ) {
      throw new Error(
        `action semantic catalog rule is not schema-constructible: ${definition.predicate}`,
      );
    }
    const entityKinds = ACTION_SEMANTIC_ENTITY_KIND_VALUES.filter((kind) =>
      definition.subjectKinds.some((candidate) => candidate === kind),
    );
    const subjectSchema = actionSubjectForKinds(
      definition.subjectKinds,
      entityKinds.length > 0
        ? actionObjectForKinds(entityKinds)
        : null,
    );
    const objectSchema =
      definition.objectKinds.length > 0
        ? actionObjectForKinds(definition.objectKinds)
        : null;
    const spatialConstraintSchema =
      definition.spatialConstraintRelations.length > 0
        ? obj({
            relation: {
              type: 'string',
              enum: [...definition.spatialConstraintRelations],
            },
            target: GENERIC_ACTION_OBJECT_JSON_SCHEMA,
          })
        : null;
    return obj({
      beatId: schemaRef({
        type: 'string',
        pattern: '^beat:p[1-9][0-9]*:[a-z0-9_]+$',
      }),
      subject: schemaRef(subjectSchema),
      predicate: {
        type: 'string',
        enum: group.predicates,
      },
      object: schemaRef(
        definition.objectRule === 'forbidden'
          ? { type: 'null' }
          : nullableOrRequiredSchema({
              rule: definition.objectRule,
              schema: objectSchema!,
            }),
      ),
      spatialEffect: schemaRef(
        nullableOrRequiredSchema({
          rule: definition.spatialEffectRule,
          schema: GENERIC_ACTION_SPATIAL_EFFECT_JSON_SCHEMA,
        }),
      ),
      spatialConstraint: schemaRef(
        definition.spatialConstraintRule === 'forbidden'
          ? { type: 'null' }
          : nullableOrRequiredSchema({
              rule: definition.spatialConstraintRule,
              schema: spatialConstraintSchema!,
            }),
      ),
      polarity: schemaRef({
        type: 'string',
        enum: ACTION_POLARITY_VALUES,
      }),
      laterality: schemaRef(
        definition.lateralityAllowed
          ? {
              anyOf: [
                { type: 'string', enum: ['left', 'right'] },
                { type: 'null' },
              ],
            }
          : { type: 'null' },
      ),
    });
  });

  return {
    itemSchema: { anyOf: branches },
    definitions,
  };
}

const ACTION_REQUIREMENT_SCHEMA_AUTHORITY =
  buildActionRequirementSchemaAuthority();

/**
 * One strict structured-output branch per unique Action Semantic Catalog rule
 * signature. Every predicate appears exactly once. Dynamic identity,
 * presence, source grounding and coverage checks remain validator-owned.
 */
export const CATALOG_STRICT_ACTION_REQUIREMENT_JSON_SCHEMA: Record<
  string,
  unknown
> = ACTION_REQUIREMENT_SCHEMA_AUTHORITY.itemSchema;

export const TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS:
  Record<string, unknown> = ACTION_REQUIREMENT_SCHEMA_AUTHORITY.definitions;

export function withTemplateDraftActionRequirementDefinitions(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const existing = schema.$defs;
  if (
    existing !== undefined &&
    (existing === null ||
      typeof existing !== 'object' ||
      Array.isArray(existing))
  ) {
    throw new Error('template draft schema definitions must be an object');
  }
  const existingDefinitions =
    (existing as Record<string, unknown> | undefined) ?? {};
  for (const key of Object.keys(TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS)) {
    if (Object.prototype.hasOwnProperty.call(existingDefinitions, key)) {
      throw new Error(`template draft schema definition collision: ${key}`);
    }
  }
  return {
    ...schema,
    $defs: {
      ...existingDefinitions,
      ...TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS,
    },
  };
}
const actionSemanticCoverageDisposition = {
  anyOf: [
    obj({
      kind: { type: 'string', const: 'action_requirement' },
    }),
    obj({
      kind: { type: 'string', const: 'represented_elsewhere' },
      contractPointer: { type: 'string' },
      contractValue: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'presentation_requirement' },
      presentationClass: {
        type: 'string',
        enum: PRESENTATION_REQUIREMENT_CLASS_VALUES,
      },
      contractPointer: { type: 'string' },
      contractValue: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'non_visual' },
      rationale: {
        type: 'string',
        enum: NON_VISUAL_RATIONALE_VALUES,
      },
    }),
    obj({
      kind: { type: 'string', const: 'unsupported' },
      reason: {
        type: 'string',
        const: 'closed_action_catalog_gap',
      },
    }),
  ],
};
const actionSemanticCoverage = obj({
  beatId: { type: 'string' },
  sourceEvidenceId: { type: 'string' },
  disposition: actionSemanticCoverageDisposition,
});

/**
 * Strict page-contract member schema. Exported so the bounded page-only repair
 * route can reuse the exact authoring authority instead of maintaining a
 * second, drift-prone copy.
 */
function pageContractJsonSchema(
  actionRequirementSchema: Record<string, unknown>,
): Record<string, unknown> {
  return obj({
    pageNumber: { type: 'number', minimum: 1, multipleOf: 1 },
    locationId: { type: 'string' },
    zoneId: { type: 'string' },
    sameLocationAs: nullableNumber,
    mustShow: stringArray,
    mustNotShow: stringArray,
    propState: { type: 'array', items: propState },
    propConstraints: { type: 'array', items: propConstraint },
    actionRequirements: {
      type: 'array',
      items: actionRequirementSchema,
    },
    actionSemanticCoverage: {
      type: 'array',
      minItems: 1,
      items: actionSemanticCoverage,
    },
    camera: { type: 'string' },
    transition,
  });
}

export const TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA: Record<
  string,
  unknown
> = pageContractJsonSchema(
  TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA,
);

/** Exact page shape for bounded repair roots that may rewrite actions. */
export const CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA: Record<
  string,
  unknown
> = pageContractJsonSchema(
  CATALOG_STRICT_ACTION_REQUIREMENT_JSON_SCHEMA,
);

/** The strict draft schema (root). */
export const TEMPLATE_DRAFT_JSON_SCHEMA: Record<string, unknown> = obj({
      worldType: { type: 'string' },
      locations: { type: 'array', items: location },
      zones: { type: 'array', items: zone },
      setBoardAuthorities: {
        type: 'array',
        items: setBoardStableAuthority,
      },
      cast,
      humanCast: { type: 'array', items: humanDraft },
      recurringProps: {
        type: 'array',
        items: TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
      },
      forbiddenGlobalElements: stringArray,
      coverContract: TEMPLATE_DRAFT_COVER_CONTRACT_JSON_SCHEMA,
      pageContracts: {
        type: 'array',
        items: TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
      },
  });

/** Bump when the draft schema shape changes (recorded in authoring provenance). */
export const TEMPLATE_DRAFT_SCHEMA_VERSION = 'vc-draft-schema/v15' as const;

/** The structured-output request name (OpenAI json_schema `name`). */
export const TEMPLATE_DRAFT_SCHEMA_NAME = 'BookVisualContractTemplateDraft' as const;
