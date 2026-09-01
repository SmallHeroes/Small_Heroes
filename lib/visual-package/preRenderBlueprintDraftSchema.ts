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
  ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
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

/**
 * Provider-owned affordance associations. Frame consumers are deliberately absent:
 * canonical frame ids are compiler authority, and the compiler materializes the
 * camera reverse-link from each draft frame's `camera.affordanceId` after overlay.
 */
const legacyNonFrameConsumerV7 = {
  anyOf: [
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

const legacyFrameConsumer = obj({
  kind: { type: 'string', const: 'frame' },
  frameId: { type: 'string' },
});

const legacyConsumerV6 = {
  anyOf: [legacyFrameConsumer, ...legacyNonFrameConsumerV7.anyOf],
};

const affordanceBase = {
  id: { type: 'string' },
  zoneId: { type: 'string' },
  footprint: region,
};

const legacyNonFrameConsumersV7 = {
  type: 'array',
  items: legacyNonFrameConsumerV7,
  minItems: 1,
} as const;

const legacyCompilerOwnedCameraConsumersV7 = {
  type: 'array',
  items: legacyNonFrameConsumerV7,
  maxItems: 0,
} as const;

const legacyAffordanceV7 = {
  anyOf: [
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'traversal' },
      consumers: legacyNonFrameConsumersV7,
      connectionId: { type: 'string' },
      direction: { type: 'string', enum: ['forward', 'reverse', 'both'] },
      minimumClearance: { type: 'integer', minimum: 1, maximum: 1000 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'opening_clearance' },
      consumers: legacyNonFrameConsumersV7,
      connectionId: { type: 'string' },
      openingSpatialNodeId: nullableString,
      clearanceRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'placement_support' },
      consumers: legacyNonFrameConsumersV7,
      support: entityRef,
      supportedEntities: { type: 'array', items: entityRef, minItems: 1 },
      maximumOccupants: { type: 'integer', minimum: 1 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'action_space' },
      consumers: legacyNonFrameConsumersV7,
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
      supportedSpatialConstraintRelations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
        },
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
      consumers: legacyCompilerOwnedCameraConsumersV7,
      visibleRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'safe_boundary' },
      consumers: legacyNonFrameConsumersV7,
      target: entityRef,
      permittedRegion: region,
    }),
  ],
};

const actionConsumerChoice = obj({
  kind: { type: 'string', const: 'action' },
  choiceIndex: { type: 'integer', minimum: 0 },
});

const placementConsumerChoice = obj({
  kind: { type: 'string', const: 'placement' },
  choiceIndex: { type: 'integer', minimum: 0 },
});

const transitionConsumerChoice = obj({
  kind: { type: 'string', const: 'transition' },
  choiceIndex: { type: 'integer', minimum: 0 },
});

const safetyConsumerChoice = obj({
  kind: { type: 'string', const: 'safety' },
  choiceIndex: { type: 'integer', minimum: 0 },
});

function choiceArray(items: unknown): Record<string, unknown> {
  return { type: 'array', items, minItems: 1 };
}

const compilerOwnedCameraConsumers = {
  type: 'array',
  items: actionConsumerChoice,
  maxItems: 0,
} as const;

const affordance = {
  anyOf: [
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'traversal' },
      consumers: choiceArray(transitionConsumerChoice),
      connectionId: { type: 'string' },
      direction: { type: 'string', enum: ['forward', 'reverse', 'both'] },
      minimumClearance: { type: 'integer', minimum: 1, maximum: 1000 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'opening_clearance' },
      consumers: choiceArray(transitionConsumerChoice),
      connectionId: { type: 'string' },
      openingSpatialNodeId: nullableString,
      clearanceRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'placement_support' },
      consumers: choiceArray(placementConsumerChoice),
      support: entityRef,
      supportedEntities: { type: 'array', items: entityRef, minItems: 1 },
      maximumOccupants: { type: 'integer', minimum: 1 },
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'action_space' },
      consumers: choiceArray(actionConsumerChoice),
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
      supportedSpatialConstraintRelations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ACTION_SPATIAL_CONSTRAINT_RELATION_VALUES,
        },
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
      consumers: compilerOwnedCameraConsumers,
      visibleRegion: region,
    }),
    obj({
      ...affordanceBase,
      kind: { type: 'string', const: 'safe_boundary' },
      consumers: choiceArray({
        anyOf: [transitionConsumerChoice, safetyConsumerChoice],
      }),
      target: entityRef,
      permittedRegion: region,
    }),
  ],
};

/**
 * Exact v6 affordance schema retained for immutable request/receipt replay.
 * Its `required` ordering is intentionally reconstructed in the original
 * order because that ordering is part of the historical schema digest.
 */
const legacyAffordanceV6 = {
  anyOf: legacyAffordanceV7.anyOf.map((branch) => {
    const properties = branch.properties as Record<string, unknown>;
    const tail = Object.fromEntries(
      Object.entries(properties).filter(
        ([key]) =>
          key !== 'id' &&
          key !== 'zoneId' &&
          key !== 'footprint' &&
          key !== 'kind' &&
          key !== 'consumers',
      ),
    );
    return obj({
      id: properties.id,
      zoneId: properties.zoneId,
      footprint: properties.footprint,
      consumers: {
        type: 'array',
        items: legacyConsumerV6,
        minItems: 1,
      },
      kind: properties.kind,
      ...tail,
    });
  }),
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

/** Exact v7 schema retained for immutable request/receipt/program replay. */
export const LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V7: Record<
  string,
  unknown
> = obj({
  worldPlan: obj({
    connections: { type: 'array', items: connection },
    affordances: { type: 'array', items: legacyAffordanceV7 },
    revealSafeSupportingGeometry: { type: 'array', items: supportingGeometry },
  }),
  frames: { type: 'array', items: frame, minItems: 1 },
});

export const LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6: Record<
  string,
  unknown
> = obj({
  worldPlan: obj({
    connections: { type: 'array', items: connection },
    affordances: { type: 'array', items: legacyAffordanceV6 },
    revealSafeSupportingGeometry: { type: 'array', items: supportingGeometry },
  }),
  frames: { type: 'array', items: frame, minItems: 1 },
});

export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V8 =
  'pre-render-blueprint-draft-schema/v8' as const;
export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION =
  PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V8;
export const LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V7 =
  'pre-render-blueprint-draft-schema/v7' as const;
/** Source-compatibility alias only; frozen programs use the absolute legacy name. */
export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V7 =
  LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V7;
export const LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V6 =
  'pre-render-blueprint-draft-schema/v6' as const;
export type PreRenderBlueprintDraftSchemaVersion =
  | typeof PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V8
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V7
  | typeof LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V6;
export const PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_NAME =
  'PreRenderBookVisualBlueprintWholeBookDraft' as const;

export function preRenderBlueprintDraftJsonSchemaForVersion(
  version: unknown,
): Record<string, unknown> | null {
  if (version === PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V8) {
    return PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA;
  }
  if (version === LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V7) {
    return LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V7;
  }
  if (version === LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_SCHEMA_VERSION_V6) {
    return LEGACY_PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA_V6;
  }
  return null;
}
