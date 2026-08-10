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
  ACTION_PREDICATE_VALUES,
  ACTION_SPATIAL_DIRECTION_VALUES,
  ACTION_SPATIAL_RELATION_VALUES,
  ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
} from './types';
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
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  material: nullableString,
  scale: nullableString,
  persistence: nullableString,
  firstRevealPage: nullableNumber,
});

const coverContract = obj({
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
const actionObject = obj({
  kind: {
    type: 'string',
    enum: ['cast', 'prop', 'spatial', 'anchor'],
  },
  id: { type: 'string' },
});
const actionSubject = {
  anyOf: [
    obj({
      kind: { type: 'string', const: 'entity' },
      entity: actionObject,
    }),
    obj({
      kind: { type: 'string', const: 'source_phenomenon' },
      sourceEvidenceId: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'cast_group' },
      castIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
      },
    }),
  ],
};
const actionSpatialEffect = {
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
      target: actionObject,
    }),
  ],
};
const actionSpatialConstraint = obj({
  relation: {
    type: 'string',
    enum: ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
  },
  target: actionObject,
});
const actionRequirement = obj({
  beatId: {
    type: 'string',
    pattern: '^beat:p[1-9][0-9]*:[a-z0-9_]+$',
  },
  subject: actionSubject,
  predicate: {
    type: 'string',
    enum: ACTION_PREDICATE_VALUES,
  },
  object: { anyOf: [actionObject, { type: 'null' }] },
  spatialEffect: {
    anyOf: [actionSpatialEffect, { type: 'null' }],
  },
  spatialConstraint: {
    anyOf: [actionSpatialConstraint, { type: 'null' }],
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
export const TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA: Record<
  string,
  unknown
> = obj({
  pageNumber: { type: 'number' },
  locationId: { type: 'string' },
  zoneId: { type: 'string' },
  sameLocationAs: nullableNumber,
  mustShow: stringArray,
  mustNotShow: stringArray,
  propState: { type: 'array', items: propState },
  propConstraints: { type: 'array', items: propConstraint },
  actionRequirements: {
    type: 'array',
    items: actionRequirement,
  },
  actionSemanticCoverage: {
    type: 'array',
    minItems: 1,
    items: actionSemanticCoverage,
  },
  camera: { type: 'string' },
  transition,
});

/** The strict draft schema (root). */
export const TEMPLATE_DRAFT_JSON_SCHEMA: Record<string, unknown> = obj({
  worldType: { type: 'string' },
  locations: { type: 'array', items: location },
  zones: { type: 'array', items: zone },
  setBoardAuthorities: { type: 'array', items: setBoardStableAuthority },
  cast,
  humanCast: { type: 'array', items: humanDraft },
  recurringProps: {
    type: 'array',
    items: TEMPLATE_DRAFT_RECURRING_PROP_JSON_SCHEMA,
  },
  forbiddenGlobalElements: stringArray,
  coverContract,
  pageContracts: {
    type: 'array',
    items: TEMPLATE_DRAFT_PAGE_CONTRACT_JSON_SCHEMA,
  },
});

/** Bump when the draft schema shape changes (recorded in authoring provenance). */
export const TEMPLATE_DRAFT_SCHEMA_VERSION = 'vc-draft-schema/v14' as const;

/** The structured-output request name (OpenAI json_schema `name`). */
export const TEMPLATE_DRAFT_SCHEMA_NAME = 'BookVisualContractTemplateDraft' as const;
