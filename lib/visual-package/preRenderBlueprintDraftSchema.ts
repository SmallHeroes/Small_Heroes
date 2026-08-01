/**
 * Strict structured-output schema for one whole-book Blueprint authoring call.
 *
 * Deterministic identity, embedded Visual Contract authority, cover/page ids, exact frame coverage,
 * portrait ratio, location/zone/cast, prop lifecycle, and transition kind are intentionally absent.
 * The compiler overlays those fields after authoring so model output cannot replace upstream authority.
 */
import {
  ACTION_PREDICATE_VALUES,
  ACTION_SEMANTIC_SUBJECT_KIND_VALUES,
} from '@/lib/visual-contract-compiler/actionSemanticCatalog';
import {
  ACTION_SPATIAL_DIRECTION_VALUES,
  ACTION_SPATIAL_RELATION_VALUES,
} from '@/lib/visual-contract-compiler/types';

function obj(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const stringArray = { type: 'array', items: { type: 'string' } } as const;
const nullableString = { type: ['string', 'null'] } as const;

const region = obj({
  x: { type: 'integer', minimum: 0, maximum: 1000 },
  y: { type: 'integer', minimum: 0, maximum: 1000 },
  width: { type: 'integer', minimum: 1, maximum: 1000 },
  height: { type: 'integer', minimum: 1, maximum: 1000 },
});

const entityRef = obj({
  kind: { type: 'string', enum: ['cast', 'prop', 'spatial', 'anchor'] },
  id: { type: 'string' },
});

const consumer = {
  anyOf: [
    obj({ kind: { type: 'string', const: 'frame' }, frameId: { type: 'string' } }),
    obj({
      kind: { type: 'string', const: 'action' },
      pageNumber: { type: 'integer', minimum: 1 },
      checkId: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'placement' },
      pageNumber: { type: 'integer', minimum: 1 },
      propId: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'transition' },
      pageNumber: { type: 'integer', minimum: 1 },
    }),
    obj({
      kind: { type: 'string', const: 'safety' },
      pageNumber: { type: 'integer', minimum: 1 },
      subjectId: { type: 'string' },
      relation: {
        type: 'string',
        enum: [
          'must_not_sit_on',
          'must_not_stand_on',
          'must_not_lean_over',
          'must_not_pass_beyond',
          'must_not_be_unsupported_at',
          'must_not_be_within_reach_of',
          'must_not_be_inside',
        ],
      },
      target: entityRef,
    }),
  ],
};

const affordanceBase = {
  id: { type: 'string' },
  zoneId: { type: 'string' },
  footprint: region,
  consumers: { type: 'array', items: consumer, minItems: 1 },
};

const affordance = {
  anyOf: [
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'traversal' },
      connectionId: { type: 'string' },
      direction: { type: 'string', enum: ['forward', 'reverse', 'both'] },
      minimumClearance: { type: 'integer', minimum: 1, maximum: 1000 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'opening_clearance' },
      connectionId: { type: 'string' },
      openingSpatialNodeId: nullableString,
      clearanceRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'placement_support' },
      support: entityRef,
      supportedEntities: { type: 'array', items: entityRef, minItems: 1 },
      maximumOccupants: { type: 'integer', minimum: 1 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'action_space' },
      supportedPredicates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: ACTION_PREDICATE_VALUES,
        },
      },
      supportedSubjectKinds: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: ACTION_SEMANTIC_SUBJECT_KIND_VALUES,
        },
      },
      supportedEntities: { type: 'array', items: entityRef },
      supportedSpatialDirections: {
        type: 'array',
        items: { type: 'string', enum: ACTION_SPATIAL_DIRECTION_VALUES },
      },
      supportedSpatialRelations: {
        type: 'array',
        items: { type: 'string', enum: ACTION_SPATIAL_RELATION_VALUES },
      },
      spatialTargetRegions: {
        type: 'array',
        items: obj({ target: entityRef, region }),
      },
      maximumActors: { type: 'integer', minimum: 1 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'camera_access' },
      visibleRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'safe_boundary' },
      target: entityRef,
      permittedRegion: region,
    }),
  ],
};

const connectionEndpoint = obj({
  zoneId: { type: 'string' },
  spatialNodeId: nullableString,
});

const connection = obj({
  id: { type: 'string' },
  kind: {
    type: 'string',
    enum: ['doorway', 'opening', 'threshold', 'path', 'portal', 'continuous_space'],
  },
  from: connectionEndpoint,
  to: connectionEndpoint,
  bidirectional: { type: 'boolean' },
  traversalAffordanceIds: stringArray,
  openingClearanceAffordanceIds: stringArray,
  safeBoundaryAffordanceIds: stringArray,
});

const supportingGeometry = obj({
  id: { type: 'string' },
  zoneId: { type: 'string' },
  spatialNodeId: { type: 'string' },
  supportsPropIds: stringArray,
  spoilerNeutral: { type: 'boolean', const: true },
});

const placementSubject = {
  anyOf: [
    obj({ kind: { type: 'string', const: 'cast' }, castId: { type: 'string' } }),
    obj({ kind: { type: 'string', const: 'prop' }, propId: { type: 'string' } }),
    obj({ kind: { type: 'string', const: 'action' }, checkId: { type: 'string' } }),
    obj({
      kind: { type: 'string', const: 'action_destination' },
      checkId: { type: 'string' },
    }),
    obj({
      kind: { type: 'string', const: 'supporting_geometry' },
      geometryId: { type: 'string' },
    }),
  ],
};

const placement = obj({
  id: { type: 'string' },
  subject: placementSubject,
  region,
  depth: { type: 'string', enum: ['foreground', 'midground', 'background'] },
  importance: { type: 'string', enum: ['key', 'supporting'] },
});

const frame = obj({
  kind: { type: 'string', enum: ['cover', 'page'] },
  pageNumber: { type: ['integer', 'null'], minimum: 1 },
  narrative: obj({
    purpose: {
      type: 'string',
      enum: [
        'cover_promise',
        'establish_world',
        'introduce_cast',
        'advance_action',
        'transition',
        'reveal',
        'emotional_turn',
        'resolution',
      ],
    },
    summary: { type: 'string' },
  }),
  placements: { type: 'array', items: placement },
  camera: obj({
    shot: {
      type: 'string',
      enum: ['wide', 'medium', 'close_up', 'over_shoulder', 'tracking'],
    },
    angle: {
      type: 'string',
      enum: ['eye_level', 'low_angle', 'high_angle', 'three_quarter', 'overhead'],
    },
    affordanceId: { type: 'string' },
  }),
  textSafeRegion: region,
  affordanceIds: stringArray,
  continuity: obj({
    connectionId: nullableString,
    carryoverRefs: { type: 'array', items: entityRef },
  }),
});

export const PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA: Record<string, unknown> = obj({
  worldPlan: obj({
    connections: { type: 'array', items: connection },
    affordances: { type: 'array', items: affordance },
    revealSafeSupportingGeometry: { type: 'array', items: supportingGeometry },
  }),
  frames: { type: 'array', items: frame, minItems: 1 },
});

export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION =
  'pre-render-blueprint-draft-schema/v4' as const;
export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME =
  'PreRenderBookVisualBlueprintWholeBookDraft' as const;
