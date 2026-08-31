import { canonicalize } from '@/lib/canonical-json';
import {
  projectPageMustNotShow,
  projectPageMustNotShowLegacySpatial,
  projectPageMustShow,
  projectPageMustShowLegacySpatial,
  projectProviderSafeBookSpatialProse,
  projectProviderSafeSpatialProse,
} from '@/lib/visual-contract-compiler/projectContractProse';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import type {
  EntityRef,
  PageActionRequirement,
  PageActionSpatialEffect,
  PageActionSubject,
  PageVisualContract,
} from '@/lib/visual-contract-compiler/types';

import type { PreRenderBlueprintValidationContext } from './preRenderBlueprintTypes';

export const PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION =
  'pre-render-blueprint-provider-wire/v1' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3 =
  'pre-render-blueprint-repair-wire/v3' as const;
export const PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION =
  PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2 =
  'pre-render-blueprint-repair-wire/v2' as const;
/** Source-compatibility alias only; frozen programs use the absolute legacy name. */
export const PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2 =
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2;
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1 =
  'pre-render-blueprint-repair-wire/v1' as const;
/** Source-compatibility alias only; frozen programs use the absolute name. */
export const LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION =
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V1;

type Obj = Record<string, unknown>;
type CompactRef = [kind: EntityRef['kind'], id: string];
type CompactRegion = [x: number, y: number, width: number, height: number];

const INTERNAL_SPATIAL_MARKER = /\[spatial:[^\]\r\n]*\]/u;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function compactRef(value: EntityRef): CompactRef {
  return [value.kind, value.id];
}

function compactOptionalRef(value: unknown): CompactRef | null {
  if (
    !isObj(value) ||
    (value.kind !== 'cast' &&
      value.kind !== 'prop' &&
      value.kind !== 'spatial' &&
      value.kind !== 'anchor') ||
    typeof value.id !== 'string'
  ) {
    return null;
  }
  return [value.kind, value.id];
}

function compactSubject(value: PageActionSubject): unknown[] {
  switch (value.kind) {
    case 'entity':
      return ['entity', compactRef(value.entity)];
    case 'cast_group':
      return ['cast_group', value.castIds];
    case 'source_phenomenon':
      return ['source', value.sourceEvidenceId, value.sourcePhrase];
  }
}

function compactSpatialEffect(value: PageActionSpatialEffect): unknown[] {
  return value.kind === 'directional'
    ? ['direction', value.direction]
    : ['relation', value.relation, compactRef(value.target)];
}

function compactAction(value: PageActionRequirement): Obj {
  return {
    id: value.checkId,
    sub: compactSubject(value.subject),
    pred: value.predicate,
    ...(value.object ? { obj: compactRef(value.object) } : {}),
    ...(value.spatialEffect
      ? { effect: compactSpatialEffect(value.spatialEffect) }
      : {}),
    ...(value.spatialConstraint
      ? {
          state: [
            value.spatialConstraint.relation,
            compactRef(value.spatialConstraint.target),
          ],
        }
      : {}),
    pol: value.polarity,
    ...(value.laterality ? { side: value.laterality } : {}),
  };
}

function compactRepairAction(value: PageActionRequirement): unknown[] {
  const action = compactAction(value);
  const subject = action.sub as unknown[];
  return [
    action.id,
    subject[0] === 'source' ? ['source', subject[1]] : subject,
    action.pred,
    action.obj ?? null,
    action.effect ?? null,
    action.state ?? null,
    action.pol,
    action.side ?? null,
  ];
}

function pageResidualProse(args: {
  page: PageVisualContract;
  context: PreRenderBlueprintValidationContext;
}): { show: string[]; hide: string[] } {
  const template = args.context.template;
  const derivedShow = new Set([
    ...projectPageMustShow(args.page, template),
    ...projectPageMustShowLegacySpatial(args.page, template),
  ]);
  const derivedHide = new Set([
    ...projectPageMustNotShow(args.page, template),
    ...projectPageMustNotShowLegacySpatial(args.page, template),
  ]);
  const globalForbidden = new Set(template.forbiddenGlobalElements);
  return {
    show: args.page.mustShow
      .filter((value) => !derivedShow.has(value))
      .map((value) =>
        projectProviderSafeSpatialProse(value, args.page, template),
      ),
    hide: args.page.mustNotShow
      .filter((value) => !derivedHide.has(value))
      .map((value) =>
        globalForbidden.has(value)
          ? projectProviderSafeBookSpatialProse(value, template)
          : projectProviderSafeSpatialProse(value, args.page, template),
      ),
  };
}

function compactCompanionStateAuthority(
  context: PreRenderBlueprintValidationContext,
): Obj | undefined {
  const authority =
    context.template.cast.companion?.companionAppearanceStateAuthority;
  if (!authority) return undefined;
  return {
    base: authority.defaultStateId,
    identity: authority.invariantIdentityDescription,
    no: authority.invariantForbidden,
    states: authority.states.map((state) => [
      state.id,
      state.continuityIndex,
      state.continuityRole,
      state.hue,
      state.pattern,
      state.bodyLanguageCue,
      state.forbidden,
    ]),
  };
}

/**
 * Provider-only authority projection. The complete context remains the only
 * compiler/persistence authority and is deliberately not copied into this wire.
 */
export function buildPreRenderBlueprintProviderWire(
  context: PreRenderBlueprintValidationContext,
): Obj {
  const template = context.template;
  const story = parseStorySourceContent(context.rawStorySource);
  const companionState = compactCompanionStateAuthority(context);

  return {
    v: PRE_RENDER_BLUEPRINT_PROVIDER_WIRE_VERSION,
    story: story.pages.map((page) => [page.pageNumber, page.text]),
    style: context.styleContent,
    cast: [
      [
        template.cast.child.id,
        'child',
        template.cast.child.name ?? 'child',
        template.cast.child.wardrobe.description,
        template.cast.child.wardrobe.forbidden ?? [],
      ],
      ...(template.cast.companion
        ? [
            [
              template.cast.companion.id,
              'companion',
              template.cast.companion.name ?? 'companion',
              template.cast.companion.wardrobe.description,
              template.cast.companion.wardrobe.forbidden ?? [],
              companionState ?? null,
            ],
          ]
        : []),
      ...template.humanCast.map((member) => [
        member.id,
        'human',
        member.role,
      ]),
    ],
    props: template.recurringProps.map((prop) => [
      prop.id,
      prop.name,
      prop.description,
      prop.scale ?? null,
      prop.firstRevealPage ?? null,
    ]),
    world: {
      type: template.worldType,
      loc: template.locations.map((location) => [
        location.id,
        location.name,
        location.description,
        location.topology ?? null,
        (location.anchors ?? []).map((anchor) => [
          anchor.id,
          anchor.description,
        ]),
      ]),
      zones: template.zones.map((zone) => [
        zone.id,
        zone.locationId,
        zone.name,
        zone.description,
        zone.spatialNodes
          ? zone.spatialNodes.map((node) => [
              node.id,
              node.kind,
              node.description,
              node.bindsTo ? compactRef(node.bindsTo) : null,
            ])
          : (zone.stableGeometry ?? []),
        (zone.spatialRelations ?? []).map((relation) => [
          relation.relation,
          relation.subjectId,
          relation.relation === 'centered_in' ? null : relation.objectId,
        ]),
      ]),
    },
    globalHide: template.forbiddenGlobalElements.map((value) =>
      projectProviderSafeBookSpatialProse(value, template),
    ),
    cover: [
      template.coverContract.locationId,
      template.coverContract.zoneId ?? null,
      template.coverContract.castIds ?? [],
      template.coverContract.mustShow.map((value) =>
        projectProviderSafeBookSpatialProse(value, template),
      ),
      template.coverContract.mustNotShow.map((value) =>
        projectProviderSafeBookSpatialProse(value, template),
      ),
    ],
    pages: template.pageContracts.map((page) => {
      const residual = pageResidualProse({ page, context });
      const propIds = Array.from(
        new Set([
          ...page.propState.map((entry) => entry.propId),
          ...(page.propConstraints ?? []).map((entry) => entry.propId),
        ]),
      );
      return {
        p: page.pageNumber,
        loc: page.locationId,
        zone: page.zoneId ?? null,
        cast: page.castIds ?? [],
        show: residual.show,
        hide: residual.hide,
        cam: page.camera,
        shot: page.shot ?? null,
        transition: page.transition
          ? [
              page.transition.kind,
              page.transition.fromZoneId ?? null,
              page.transition.toZoneId ?? null,
              page.transition.cue ?? null,
            ]
          : ['steady', null, null, null],
        sameLoc: page.sameLocationAs ?? null,
        props: propIds.map((propId) => {
          const state = page.propState.find(
            (entry) => entry.propId === propId,
          );
          const constraint = page.propConstraints?.find(
            (entry) => entry.propId === propId,
          );
          return [
            propId,
            state?.state ?? null,
            constraint?.visibility ?? null,
            constraint?.stateId ?? null,
            constraint?.anchorId ?? null,
          ];
        }),
        actions: (page.actionRequirements ?? []).map(compactAction),
        safety: (page.safetyConstraints ?? []).map((entry) => [
          entry.subjectId,
          entry.relation,
          compactRef(entry.target),
        ]),
        castState: (page.castStates ?? []).map((entry) => [
          entry.castId,
          entry.bodyState ?? null,
          entry.injectionArm ?? null,
          entry.bandageArm ?? null,
          entry.freeHand ?? null,
        ]),
        childWardrobe: page.childWardrobeOverride
          ? [
              page.childWardrobeOverride.description,
              page.childWardrobeOverride.forbidden ?? [],
            ]
          : null,
        companionState: page.companionStateOverride?.stateId ?? null,
      };
    }),
  };
}

export function serializePreRenderBlueprintProviderWire(
  context: PreRenderBlueprintValidationContext,
): string {
  const serialized = stableJson(buildPreRenderBlueprintProviderWire(context));
  if (INTERNAL_SPATIAL_MARKER.test(serialized)) {
    throw new Error(
      'Blueprint provider wire contains an unresolved internal spatial marker',
    );
  }
  return serialized;
}

function compactRegion(value: unknown): CompactRegion | null {
  if (!isObj(value)) return null;
  const values = [value.x, value.y, value.width, value.height];
  return values.every((entry) => typeof entry === 'number')
    ? (values as CompactRegion)
    : null;
}

function compactConsumer(value: unknown): unknown {
  if (!isObj(value)) return value;
  switch (value.kind) {
    case 'frame':
      return ['f', value.frameId];
    case 'action':
      return ['a', value.pageNumber, value.checkId];
    case 'placement':
      return ['p', value.pageNumber, value.propId];
    case 'transition':
      return ['t', value.pageNumber];
    case 'safety':
      return [
        's',
        value.pageNumber,
        value.subjectId,
        value.relation,
        compactOptionalRef(value.target),
      ];
    default:
      return value;
  }
}

function compactAffordance(
  value: unknown,
  includeLegacyFrameConsumers: boolean,
): unknown {
  if (!isObj(value)) return value;
  const base = [
    value.id,
    value.kind,
    value.zoneId,
    compactRegion(value.footprint),
    Array.isArray(value.consumers)
      ? value.consumers
          .filter(
            (consumer) =>
              includeLegacyFrameConsumers ||
              !isObj(consumer) ||
              consumer.kind !== 'frame',
          )
          .map(compactConsumer)
      : value.consumers,
  ];
  switch (value.kind) {
    case 'traversal':
      return [
        ...base,
        value.connectionId,
        value.direction,
        value.minimumClearance,
      ];
    case 'opening_clearance':
      return [
        ...base,
        value.connectionId,
        value.openingSpatialNodeId ?? null,
        compactRegion(value.clearanceRegion),
      ];
    case 'placement_support':
      return [
        ...base,
        compactOptionalRef(value.support),
        Array.isArray(value.supportedEntities)
          ? value.supportedEntities.map(compactOptionalRef)
          : value.supportedEntities,
        value.maximumOccupants,
      ];
    case 'action_space':
      return [
        ...base,
        value.supportedPredicates,
        value.supportedSubjectKinds,
        Array.isArray(value.supportedEntities)
          ? value.supportedEntities.map(compactOptionalRef)
          : value.supportedEntities,
        value.supportedSpatialDirections,
        value.supportedSpatialRelations,
        value.supportedSpatialConstraintRelations,
        Array.isArray(value.spatialTargetRegions)
          ? value.spatialTargetRegions.map((entry) =>
              isObj(entry)
                ? [
                    compactOptionalRef(entry.target),
                    compactRegion(entry.region),
                  ]
                : entry,
            )
          : value.spatialTargetRegions,
        value.maximumActors,
      ];
    case 'camera_access':
      return [...base, compactRegion(value.visibleRegion)];
    case 'safe_boundary':
      return [
        ...base,
        compactOptionalRef(value.target),
        compactRegion(value.permittedRegion),
      ];
    default:
      return value;
  }
}

function compactConnection(value: unknown): unknown {
  if (!isObj(value)) return value;
  const endpoint = (candidate: unknown): unknown =>
    isObj(candidate)
      ? [candidate.zoneId, candidate.spatialNodeId ?? null]
      : candidate;
  return [
    value.id,
    value.kind,
    endpoint(value.from),
    endpoint(value.to),
    value.bidirectional,
    value.traversalAffordanceIds,
    value.openingClearanceAffordanceIds,
    value.safeBoundaryAffordanceIds,
  ];
}

function compactPlacement(value: unknown): unknown {
  if (!isObj(value)) return value;
  const subject = isObj(value.subject)
    ? [
        value.subject.kind,
        value.subject.castId ??
          value.subject.propId ??
          value.subject.checkId ??
          value.subject.geometryId,
      ]
    : value.subject;
  return [
    value.id,
    subject,
    compactRegion(value.region),
    value.depth,
    value.importance,
  ];
}

function compactFrame(value: unknown): unknown {
  if (!isObj(value)) return value;
  const narrative = isObj(value.narrative)
    ? [value.narrative.purpose, value.narrative.summary]
    : value.narrative;
  const camera = isObj(value.camera)
    ? [value.camera.shot, value.camera.angle, value.camera.affordanceId]
    : value.camera;
  const continuity = isObj(value.continuity)
    ? [value.continuity.connectionId ?? null, value.continuity.carryoverRefs]
    : value.continuity;
  return [
    value.kind,
    value.pageNumber ?? null,
    narrative,
    Array.isArray(value.placements)
      ? value.placements.map(compactPlacement)
      : value.placements,
    camera,
    value.affordanceIds,
    continuity,
  ];
}

function compactPreviousDraft(
  previousDraft: unknown,
  args: {
    version:
      | typeof PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3
      | typeof LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2;
    includeLegacyFrameConsumers: boolean;
  },
): unknown {
  if (!isObj(previousDraft) || !isObj(previousDraft.worldPlan)) {
    return previousDraft;
  }
  const world = previousDraft.worldPlan;
  return {
    v: args.version,
    world: [
      Array.isArray(world.connections)
        ? world.connections.map(compactConnection)
        : world.connections,
      Array.isArray(world.affordances)
        ? world.affordances.map((entry) =>
            compactAffordance(entry, args.includeLegacyFrameConsumers),
          )
        : world.affordances,
      Array.isArray(world.revealSafeSupportingGeometry)
        ? world.revealSafeSupportingGeometry.map((entry) =>
            isObj(entry)
              ? [
                  entry.id,
                  entry.zoneId,
                  entry.spatialNodeId,
                  entry.supportsPropIds,
                ]
              : entry,
          )
        : world.revealSafeSupportingGeometry,
    ],
    frames: Array.isArray(previousDraft.frames)
      ? previousDraft.frames.map(compactFrame)
      : previousDraft.frames,
  };
}

function buildRepairAuthorityIndex(
  context: PreRenderBlueprintValidationContext,
): Obj {
  const template = context.template;
  return {
    refs: {
      cast: [
        template.cast.child.id,
        ...(template.cast.companion ? [template.cast.companion.id] : []),
        ...template.humanCast.map((entry) => entry.id),
      ],
      props: template.recurringProps.map((entry) => entry.id),
      zones: template.zones.map((zone) => [
        zone.id,
        zone.locationId,
        (zone.spatialNodes ?? []).map((node) => node.id),
      ]),
      anchors: template.locations.map((location) => [
        location.id,
        (location.anchors ?? []).map((anchor) => anchor.id),
      ]),
    },
    cover: [
      template.coverContract.locationId,
      template.coverContract.zoneId ?? null,
      template.coverContract.castIds ?? [],
    ],
    pages: template.pageContracts.map((page) => [
      page.pageNumber,
      page.locationId,
      page.zoneId ?? null,
      page.castIds ?? [],
      page.transition
        ? [
            page.transition.kind,
            page.transition.fromZoneId ?? null,
            page.transition.toZoneId ?? null,
            page.transition.cue ?? null,
          ]
        : ['steady', null, null, null],
      (page.propConstraints ?? []).map((constraint) => [
        constraint.propId,
        constraint.visibility,
        constraint.anchorId ?? null,
      ]),
      page.actionRequirements?.map(compactRepairAction) ?? [],
      (page.safetyConstraints ?? []).map((entry) => [
        entry.subjectId,
        entry.relation,
        compactRef(entry.target),
      ]),
    ]),
  };
}

export function serializePreRenderBlueprintRepairWire(args: {
  context: PreRenderBlueprintValidationContext;
  previousDraft: unknown;
}): string {
  const serialized = stableJson({
    authority: buildRepairAuthorityIndex(args.context),
    draft: compactPreviousDraft(args.previousDraft, {
      version: PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3,
      includeLegacyFrameConsumers: false,
    }),
  });
  if (INTERNAL_SPATIAL_MARKER.test(serialized)) {
    throw new Error(
      'Blueprint repair wire contains an unresolved internal spatial marker',
    );
  }
  return serialized;
}

/**
 * Immutable v2 projection used only to reconstruct frozen replay evidence. New
 * generation must use v3, which removes compiler-owned frame consumers.
 */
export function serializeLegacyPreRenderBlueprintRepairWireV2(args: {
  context: PreRenderBlueprintValidationContext;
  previousDraft: unknown;
}): string {
  const serialized = stableJson({
    authority: buildRepairAuthorityIndex(args.context),
    draft: compactPreviousDraft(args.previousDraft, {
      version: LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
      includeLegacyFrameConsumers: true,
    }),
  });
  if (INTERNAL_SPATIAL_MARKER.test(serialized)) {
    throw new Error(
      'Legacy Blueprint repair wire contains an unresolved internal spatial marker',
    );
  }
  return serialized;
}
