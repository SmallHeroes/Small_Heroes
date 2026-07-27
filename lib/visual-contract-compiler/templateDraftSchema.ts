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
} from './types';

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

const zone = obj({
  id: { type: 'string' },
  locationId: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  stableGeometry: stringArray,
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
  propId: nullableString,
});
const setBoardStableRelation = obj({
  subjectId: { type: 'string' },
  relation: {
    type: 'string',
    enum: ['on_same_wall_as', 'adjacent_to', 'opposite_to', 'above', 'below', 'centered_in'],
  },
  objectId: nullableString,
});
const setBoardStableArea = obj({
  id: { type: 'string' },
  locationId: { type: 'string' },
  spatialNodes: { type: 'array', items: setBoardStableNode },
  spatialRelations: { type: 'array', items: setBoardStableRelation },
});
const setBoardStableFixedObject = obj({
  propId: { type: 'string' },
  name: { type: 'string' },
  material: nullableString,
  scale: nullableString,
  quantity: { type: 'integer', minimum: 1 },
});
const setBoardStableAuthority = obj({
  setIdentityId: { type: 'string' },
  locations: { type: 'array', items: setBoardStableLocation },
  areas: { type: 'array', items: setBoardStableArea },
  fixedObjects: { type: 'array', items: setBoardStableFixedObject },
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

const prop = obj({
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
const actionRequirement = obj({
  checkId: { type: 'string' },
  actorId: { type: 'string' },
  predicate: {
    type: 'string',
    enum: ACTION_PREDICATE_VALUES,
  },
  object: { anyOf: [actionObject, { type: 'null' }] },
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
  /**
   * Exact same-page Story Source words that support this structured beat.
   * Compiler validation removes this evidence-only field before the
   * candidate contract is assembled.
   */
  sourcePhrase: { type: 'string' },
});
const unsupportedActionSemantic = obj({
  sourcePhrase: { type: 'string' },
  reason: {
    type: 'string',
    enum: ['closed_action_vocabulary_gap'],
  },
});

const pageContract = obj({
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
  unsupportedActionSemantics: {
    type: 'array',
    items: unsupportedActionSemantic,
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
  recurringProps: { type: 'array', items: prop },
  forbiddenGlobalElements: stringArray,
  coverContract,
  pageContracts: { type: 'array', items: pageContract },
});

/** Bump when the draft schema shape changes (recorded in authoring provenance). */
export const TEMPLATE_DRAFT_SCHEMA_VERSION = 'vc-draft-schema/v5' as const;

/** The structured-output request name (OpenAI json_schema `name`). */
export const TEMPLATE_DRAFT_SCHEMA_NAME = 'BookVisualContractTemplateDraft' as const;
