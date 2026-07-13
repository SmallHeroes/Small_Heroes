/**
 * Strict JSON Schema for the DESCRIPTIVE draft the authoring LLM returns (Stage 1 of the live-authoring fix).
 *
 * Used as OpenAI structured-output (`json_schema`, strict) so a 12-page relational doc is produced completely and
 * in-shape instead of truncating under `json_object`. This constrains ONLY the descriptive fields the compiler
 * consumes; the deterministic facts (gender/presence/evidence/laterality, castIds) are overlaid AFTER and are NOT
 * in this schema. Strict-mode invariant (enforced by `obj()`): every object sets additionalProperties:false and
 * lists ALL its properties in `required`; genuinely-optional fields are nullable (type union / anyOf-null).
 */

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

const location = obj({
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  environmentClass: { type: 'string', enum: ['indoor', 'outdoor', 'neutral'] },
  lighting: { type: 'string' },
  timeOfDay: nullableString,
  anchors: { type: 'array', items: anchor },
  topology: nullableString,
});

const zone = obj({
  id: { type: 'string' },
  locationId: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  stableGeometry: stringArray,
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
const appearance = obj({ skinTone: binding, hairColour: binding, hairTexture: binding, hairStyle: binding });
const garment = obj({ id: { type: 'string' }, label: nullableString, colour: binding });

// The LLM drafts ONLY id + descriptive appearance for each human (identity/gender/presence are overlaid from facts).
const humanDraft = obj({
  id: { type: 'string' },
  appearance,
  garments: { type: 'array', items: garment },
  forbiddenAppearance: stringArray,
});

const prop = obj({
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  material: nullableString,
  scale: nullableString,
  persistence: nullableString,
});

const coverContract = obj({
  worldType: { type: 'string' },
  locationId: { type: 'string' },
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

const pageContract = obj({
  pageNumber: { type: 'number' },
  locationId: { type: 'string' },
  zoneId: { type: 'string' },
  sameLocationAs: nullableNumber,
  mustShow: stringArray,
  mustNotShow: stringArray,
  propState: { type: 'array', items: propState },
  camera: { type: 'string' },
  transition,
});

/** The strict draft schema (root). */
export const TEMPLATE_DRAFT_JSON_SCHEMA: Record<string, unknown> = obj({
  worldType: { type: 'string' },
  locations: { type: 'array', items: location },
  zones: { type: 'array', items: zone },
  cast,
  humanCast: { type: 'array', items: humanDraft },
  recurringProps: { type: 'array', items: prop },
  forbiddenGlobalElements: stringArray,
  coverContract,
  pageContracts: { type: 'array', items: pageContract },
});

/** Bump when the draft schema shape changes (recorded in authoring provenance). */
export const TEMPLATE_DRAFT_SCHEMA_VERSION = 'vc-draft-schema/v1' as const;

/** The structured-output request name (OpenAI json_schema `name`). */
export const TEMPLATE_DRAFT_SCHEMA_NAME = 'BookVisualContractTemplateDraft' as const;
