import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';

import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
  OpenAIResponsesStructuredOutputSchemaCompatibilityError,
  PreRenderBlueprintAuthoringRepairExhaustedError,
  InvalidPreRenderBlueprintAuthoringInputError,
  preRenderBlueprintAuthoringInputErrors,
  compilePreRenderBookVisualBlueprint,
  serializePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
  type PreRenderBookVisualBlueprint,
} from '@/lib/visual-package';
import {
  PreRenderBlueprintRepairInputNotAdmissibleError,
  assemblePreRenderBookVisualBlueprintFromDraft,
  buildPreRenderBlueprintAuthoringSystemPrompt,
  buildPreRenderBlueprintAuthoringUserPrompt,
  buildPreRenderBlueprintRepairSystemPrompt,
  buildPreRenderBlueprintRepairUserPrompt,
  groupPreRenderBlueprintRepairDiagnostics,
} from '@/lib/visual-package/preRenderBlueprintAuthoring';
import { blueprintAuthoringInputAccounting } from '@/lib/visual-package/blueprintAuthoringPolicy';
import {
  PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3,
  LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
  serializeLegacyPreRenderBlueprintRepairWireV2,
  serializePreRenderBlueprintRepairWire,
} from '@/lib/visual-package/preRenderBlueprintProviderWire';

import {
  buildBlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const CONFIG = {
  model: 'fixture-reasoning-model',
  reasoningEffort: 'medium',
  maxOutputTokens: 48_000,
  compositionPolicyVersion: null,
};

function findConstNode(
  value: unknown,
  literal: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findConstNode(child, literal);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const node = value as Record<string, unknown>;
  if (node.const === literal) return node;
  for (const child of Object.values(node)) {
    const found = findConstNode(child, literal);
    if (found) return found;
  }
  return null;
}

function legacyWholeBookDraftWithFrameConsumers(
  blueprint: PreRenderBookVisualBlueprint,
): {
  worldPlan: PreRenderBookVisualBlueprint['worldPlan'];
  frames: Array<Record<string, unknown>>;
} {
  return {
    worldPlan: clone(blueprint.worldPlan),
    frames: blueprint.frames.map((frame) => ({
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      narrative: clone(frame.narrative),
      placements: clone(frame.placements),
      camera: clone(frame.camera),
      affordanceIds: clone(frame.affordanceIds),
      continuity: {
        connectionId: frame.continuity.connectionId ?? null,
        carryoverRefs: clone(frame.continuity.carryoverRefs),
      },
    })),
  };
}

function wholeBookDraft(blueprint: PreRenderBookVisualBlueprint): unknown {
  const draft = legacyWholeBookDraftWithFrameConsumers(blueprint);
  for (const affordance of draft.worldPlan.affordances) {
    affordance.consumers = affordance.consumers.filter(
      (consumer) => consumer.kind !== 'frame',
    );
  }
  return draft;
}

function sixTransitionEightPageFixture() {
  const zoneSequence = [
    'zone:home',
    'zone:stage_2',
    'zone:stage_3',
    'zone:stage_4',
    'zone:stage_4',
    'zone:stage_5',
    'zone:stage_6',
    'zone:stage_7',
  ];
  return buildBlueprintFixture('single_location', {
    pageCount: 8,
    mutateTemplate: (template) => {
      const baseZone = template.zones[0]!;
      const locationId = template.locations[0]!.id;
      template.zones = [...new Set(zoneSequence)].map((zoneId) => ({
        ...clone(baseZone),
        id: zoneId,
        name: `Fixture stage ${zoneId}`,
        description: `Stable authored fixture stage ${zoneId}`,
      }));
      template.coverContract.zoneId = zoneSequence[0]!;
      template.pageContracts.forEach((page, index) => {
        const zoneId = zoneSequence[index]!;
        const previousZoneId = index > 0 ? zoneSequence[index - 1]! : null;
        page.zoneId = zoneId;
        page.locationId = locationId;
        page.transition =
          previousZoneId === null || previousZoneId === zoneId
            ? { kind: 'steady' }
            : {
                kind: 'after_transition',
                fromZoneId: previousZoneId,
                toZoneId: zoneId,
                cue: `fixture transition ${index}`,
              };
      });
    },
  });
}

type MutableWholeBookDraft = {
  worldPlan: {
    connections: Array<{ id: string; traversalAffordanceIds: string[] }>;
    affordances: Array<{ id: string; kind: string }>;
  };
  frames: Array<{
    kind: 'cover' | 'page';
    pageNumber: number | null;
    placements: Array<{
      subject: { kind: string };
      region: { x: number; y: number; width: number; height: number };
    }>;
    camera: { shot: string; angle: string; affordanceId: string };
    affordanceIds: string[];
    continuity: { connectionId: string | null };
  }>;
};

function applyEightPageComposition(
  draft: MutableWholeBookDraft,
  smallestCastSize: { width: number; height: number },
): void {
  const cameras = [
    ['wide', 'eye_level'],
    ['close_up', 'low_angle'],
    ['medium', 'high_angle'],
    ['over_shoulder', 'three_quarter'],
    ['wide', 'eye_level'],
    ['tracking', 'low_angle'],
    ['medium', 'high_angle'],
    ['close_up', 'three_quarter'],
  ] as const;
  for (const frame of draft.frames.filter((entry) => entry.kind === 'page')) {
    const index = frame.pageNumber! - 1;
    frame.camera.shot = cameras[index]![0];
    frame.camera.angle = cameras[index]![1];
    for (const placement of frame.placements.filter(
      (entry) => entry.subject.kind === 'cast',
    )) {
      placement.region =
        frame.pageNumber === 2 || frame.pageNumber === 8
          ? { x: 80, y: 350, width: 400, height: 300 }
          : frame.pageNumber === 5
            ? { x: 80, y: 360, ...smallestCastSize }
            : { x: 80, y: 360, width: 200, height: 200 };
    }
  }
}

function assertStrictObjects(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const schema = value as Record<string, unknown>;
  if (schema.type === 'object') {
    expect(schema.additionalProperties, path).toBe(false);
    const properties = schema.properties as Record<string, unknown>;
    expect(schema.required, path).toEqual(Object.keys(properties));
  }
  for (const [key, child] of Object.entries(schema)) {
    if (key === 'properties' && child && typeof child === 'object') {
      for (const [property, propertySchema] of Object.entries(
        child as Record<string, unknown>,
      )) {
        assertStrictObjects(propertySchema, `${path}.properties.${property}`);
      }
    } else if (key === 'items' || key === 'anyOf') {
      if (Array.isArray(child)) {
        child.forEach((entry, index) =>
          assertStrictObjects(entry, `${path}.${key}[${index}]`),
        );
      } else {
        assertStrictObjects(child, `${path}.${key}`);
      }
    }
  }
}

describe('R1D-PVB-B — whole-book Blueprint authoring compiler', () => {
  const shapes: BlueprintFixtureShape[] = [
    'single_location',
    'multi_zone_transition',
    'journey_fantastical',
    'no_companion',
    'reveal_timeline',
  ];

  it('materializes the nine compiler-owned camera consumers on an eight-page provider-shaped draft without repair', async () => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const draft = wholeBookDraft(fixture.blueprint) as {
      worldPlan: { affordances: Array<{ consumers: Array<{ kind: string }> }> };
    };
    expect(
      draft.worldPlan.affordances.flatMap((entry) => entry.consumers)
        .filter((consumer) => consumer.kind === 'frame'),
    ).toHaveLength(0);

    let calls = 0;
    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      {
        callAuthor: async () => {
          calls += 1;
          return draft;
        },
      },
    );

    expect(calls).toBe(1);
    expect(result.provenance).toMatchObject({
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v7',
      promptVersion: 'pre-render-blueprint-authoring-prompt/v8',
      passingAttempt: 1,
      callCount: 1,
    });
    expect(result.repairAttempts).toEqual([]);
    expect(
      serializePreRenderBookVisualBlueprint(result.blueprint),
    ).toBe(serializePreRenderBookVisualBlueprint(fixture.blueprint));
    const frameConsumers = result.blueprint.worldPlan.affordances.flatMap(
      (affordance) =>
        affordance.consumers
          .filter((consumer) => consumer.kind === 'frame')
          .map((consumer) => ({ affordance, consumer })),
    );
    expect(frameConsumers).toHaveLength(9);
    for (const frame of result.blueprint.frames) {
      expect(frameConsumers).toContainEqual({
        affordance: expect.objectContaining({
          id: frame.camera.affordanceId,
          kind: 'camera_access',
        }),
        consumer: { kind: 'frame', frameId: frame.id },
      });
    }
  });

  it('strips forged frame consumers defensively while preserving the canonical Blueprint and the input bytes', () => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const draft = legacyWholeBookDraftWithFrameConsumers(fixture.blueprint);
    for (const [index, affordance] of draft.worldPlan.affordances.entries()) {
      affordance.consumers.push(
        { kind: 'frame', frameId: `frame:forged:${index}` },
        { kind: 'frame', frameId: 'frame:page:999' },
      );
    }
    const before = clone(draft);
    const assembled = assemblePreRenderBookVisualBlueprintFromDraft({
      draft,
      context: fixture.context,
    });

    expect(draft).toEqual(before);
    expect(serializePreRenderBookVisualBlueprint(assembled)).toBe(
      serializePreRenderBookVisualBlueprint(fixture.blueprint),
    );
    expect(
      validatePreRenderBookVisualBlueprint(assembled, fixture.context).ok,
    ).toBe(true);
  });

  it('allows two canonical frames to share one camera affordance and derives both reverse consumers exactly once', () => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const draft = wholeBookDraft(fixture.blueprint) as {
      worldPlan: {
        affordances: Array<{ id: string; kind: string; consumers: unknown[] }>;
      };
      frames: Array<{
        kind: string;
        camera: { affordanceId: string };
        affordanceIds: string[];
      }>;
    };
    const cover = draft.frames.find((frame) => frame.kind === 'cover')!;
    const page = draft.frames.find((frame) => frame.kind === 'page')!;
    const oldPageCameraId = page.camera.affordanceId;
    page.camera.affordanceId = cover.camera.affordanceId;
    page.affordanceIds = [
      ...page.affordanceIds.filter((id) => id !== oldPageCameraId),
      cover.camera.affordanceId,
    ];
    draft.worldPlan.affordances = draft.worldPlan.affordances.filter(
      (affordance) => affordance.id !== oldPageCameraId,
    );

    const assembled = assemblePreRenderBookVisualBlueprintFromDraft({
      draft,
      context: fixture.context,
    });
    const shared = assembled.worldPlan.affordances.find(
      (affordance) => affordance.id === cover.camera.affordanceId,
    )!;
    expect(
      shared.consumers.filter((consumer) => consumer.kind === 'frame'),
    ).toEqual([
      { kind: 'frame', frameId: 'frame:cover' },
      { kind: 'frame', frameId: 'frame:page:1' },
    ]);
    expect(
      validatePreRenderBookVisualBlueprint(assembled, fixture.context).ok,
    ).toBe(true);
  });

  it.each([
    {
      label: 'unknown camera id',
      mutate: (draft: { frames: Array<{ camera: { affordanceId: string } }> }) => {
        draft.frames[0]!.camera.affordanceId = 'affordance:missing';
      },
    },
    {
      label: 'camera omitted from frame membership',
      mutate: (draft: {
        frames: Array<{
          camera: { affordanceId: string };
          affordanceIds: string[];
        }>;
      }) => {
        const frame = draft.frames[0]!;
        frame.affordanceIds = frame.affordanceIds.filter(
          (id) => id !== frame.camera.affordanceId,
        );
      },
    },
  ])('does not heal $label while deriving reverse camera consumers', ({ mutate }) => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const draft = wholeBookDraft(fixture.blueprint) as Parameters<
      typeof mutate
    >[0];
    mutate(draft);
    const assembled = assemblePreRenderBookVisualBlueprintFromDraft({
      draft,
      context: fixture.context,
    });
    const validation = validatePreRenderBookVisualBlueprint(
      assembled,
      fixture.context,
    );
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toContainEqual(
        expect.objectContaining({ code: 'camera_infeasible' }),
      );
    }
  });

  it('cuts the current repair wire to v3 by stripping only frame consumers while preserving exact v2 replay bytes', () => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const previousDraft = legacyWholeBookDraftWithFrameConsumers(
      fixture.blueprint,
    );
    const current = JSON.parse(
      serializePreRenderBlueprintRepairWire({
        context: fixture.context,
        previousDraft,
      }),
    ) as { draft: { v: string; world: [unknown[], unknown[][], unknown[]] } };
    const legacy = JSON.parse(
      serializeLegacyPreRenderBlueprintRepairWireV2({
        context: fixture.context,
        previousDraft,
      }),
    ) as { draft: { v: string; world: [unknown[], unknown[][], unknown[]] } };

    expect(current.draft.v).toBe(PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V3);
    expect(legacy.draft.v).toBe(
      LEGACY_PRE_RENDER_BLUEPRINT_REPAIR_WIRE_VERSION_V2,
    );
    let legacyFrameConsumerCount = 0;
    for (const [index, legacyAffordance] of legacy.draft.world[1].entries()) {
      const currentAffordance = current.draft.world[1][index]!;
      const legacyConsumers = legacyAffordance[4] as unknown[][];
      const currentConsumers = currentAffordance[4] as unknown[][];
      legacyFrameConsumerCount += legacyConsumers.filter(
        (consumer) => consumer[0] === 'f',
      ).length;
      expect(currentConsumers).toEqual(
        legacyConsumers.filter((consumer) => consumer[0] !== 'f'),
      );
    }
    expect(legacyFrameConsumerCount).toBe(9);
  });

  it('carries approved typed presentation evidence into the Blueprint authoring gate', () => {
    const fixture = buildBlueprintFixture('single_location');
    const coverage = [{
      version: 'action-semantic-coverage/v6' as const,
      pageNumber: 1,
      beatId: 'beat:p1:static_presentation',
      sourceEvidenceId: `se1_${'b'.repeat(64)}`,
      sourcePhrase: 'fixture presentation source evidence',
      disposition: {
        kind: 'presentation_requirement' as const,
        presentationClass: 'composition_focus' as const,
        contractPointer: '/pageContracts/0/mustShow/0',
        contractValue:
          fixture.context.template.pageContracts[0]!.mustShow[0]!,
      },
      reviewState: 'unreviewed' as const,
    }];
    const coverageDigest = canonicalHash(coverage);
    fixture.context.reconciliation.actionSemanticCoverageAuthority = {
      version:
        'action-semantic-coverage-reconciliation-authority/v1',
      actionSemanticCoverageVersion: 'action-semantic-coverage/v6',
      actionSemanticCoverageDigest: coverageDigest,
      records: coverage,
    };
    fixture.context.reconciliation.presentationRequirements = {
      version: 'presentation-requirement-reconciliation/v1',
      actionSemanticCoverageVersion: 'action-semantic-coverage/v6',
      actionSemanticCoverageDigest: coverageDigest,
      requirements: [
        {
          pageNumber: 1,
          beatId: 'beat:p1:static_presentation',
          sourceEvidenceId: coverage[0]!.sourceEvidenceId,
          presentationClass: 'composition_focus',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue:
            fixture.context.template.pageContracts[0]!.mustShow[0]!,
        },
      ],
    };
    fixture.context.actionSemanticCoverage = coverage;
    expect(
      preRenderBlueprintAuthoringInputErrors(fixture.context, CONFIG),
    ).toEqual([]);

    fixture.context.reconciliation.frames.find(
      (frame) => frame.frameKind === 'page' && frame.pageNumber === 1,
    )!.sourceRequirements.find(
      (requirement) => requirement.sourceKind === 'story_prose',
    )!.visualBeats = [];
    expect(
      preRenderBlueprintAuthoringInputErrors(fixture.context, CONFIG),
    ).toContainEqual(
      expect.stringContaining(
        'presentationRequirements.requirements[0] lacks original preserved evidence, a reviewed exact rebind, or a reviewed explicit supersession',
      ),
    );
  });

  it('rejects internally consistent reconciliation coverage substitution at both Blueprint gates', () => {
    const fixture = buildBlueprintFixture('single_location');
    const substituted = clone(fixture.context.reconciliation);
    const record = substituted.actionSemanticCoverageAuthority.records[0]!;
    record.sourceEvidenceId = `se1_${'f'.repeat(64)}`;
    record.sourcePhrase = 'substituted but internally consistent evidence';
    const substitutedDigest = canonicalHash(
      substituted.actionSemanticCoverageAuthority.records,
    );
    substituted.actionSemanticCoverageAuthority
      .actionSemanticCoverageDigest = substitutedDigest;
    substituted.presentationRequirements
      .actionSemanticCoverageDigest = substitutedDigest;
    fixture.context.reconciliation = substituted;

    expect(
      preRenderBlueprintAuthoringInputErrors(fixture.context, CONFIG),
    ).toContainEqual(
      expect.stringContaining('candidate-mismatched'),
    );
    const validation = validatePreRenderBookVisualBlueprint(
      fixture.blueprint,
      fixture.context,
    );
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('candidate-mismatched'),
        }),
      );
    }
  });

  it.each(shapes)(
    'uses one shared whole-book call for %s and returns exact valid v4 authoring authority',
    async (shape) => {
      const fixture = buildBlueprintFixture(shape);
      const calls: Array<{
        system: string;
        user: string;
        options: unknown;
      }> = [];
      const result = await compilePreRenderBookVisualBlueprint(
        fixture.context,
        CONFIG,
        {
          callAuthor: async (system, user, options) => {
            calls.push({ system, user, options });
            return wholeBookDraft(fixture.blueprint);
          },
        },
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].system).toContain(
        'BLUEPRINT_PROVIDER_WIRE is validated compiler authority',
      );
      expect(calls[0].system).toContain(
        'never infer omitted authority',
      );
      expect(calls[0].system).toContain(
        'Reserve cover x0,y0,w1000,h250',
      );
      expect(calls[0].system).toContain(
        'body x0,y750,w1000,h250',
      );
      expect(calls[0].user).toMatch(/^BLUEPRINT_PROVIDER_WIRE:\n\{/u);
      expect(calls[0].user).not.toContain(
        'actionSemanticCoverageAuthority',
      );
      expect(calls[0].user).not.toMatch(/\[spatial:/u);
      expect(calls[0].options).toMatchObject({
        model: CONFIG.model,
        reasoningEffort: CONFIG.reasoningEffort,
        maxOutputTokens: CONFIG.maxOutputTokens,
        noFallback: true,
        jsonSchema: {
          name: 'PreRenderBookVisualBlueprintWholeBookDraft',
          strict: true,
        },
      });
      expect(result.provenance).toMatchObject({
        model: CONFIG.model,
        reasoningEffort: CONFIG.reasoningEffort,
        maxOutputTokens: CONFIG.maxOutputTokens,
        noFallback: true,
        promptVersion: 'pre-render-blueprint-authoring-prompt/v8',
        passingAttempt: 1,
        callCount: 1,
      });
      expect(result.repairAttempts).toEqual([]);
      expect(
        validatePreRenderBookVisualBlueprint(
          result.blueprint,
          fixture.context,
        ).ok,
      ).toBe(true);
      expect(result.blueprint.version).toBe(
        'pre-render-book-visual-blueprint/v5',
      );
      expect(result.blueprint.identity.authoringAuthority.digest).toBe(
        fixture.blueprint.identity.authoringAuthority.digest,
      );
      expect(result.blueprint.frames.map((frame) => frame.textSafeRegion)).toEqual(
        fixture.blueprint.frames.map((frame) => frame.textSafeRegion),
      );
    },
  );

  it('projects Template authority into a compact marker-free wire with exact unary and binary spatial relations', () => {
    const fixture = buildBlueprintFixture('single_location');
    const zone = fixture.context.template.zones[0]!;
    zone.spatialNodes = [
      {
        id: 'node_center',
        kind: 'floor',
        description: 'the center of the room',
      },
      {
        id: 'node_wall',
        kind: 'wall',
        description: 'the painted back wall',
      },
    ];
    zone.spatialRelations = [
      { relation: 'centered_in', subjectId: 'node_center' },
      {
        relation: 'adjacent_to',
        subjectId: 'node_center',
        objectId: 'node_wall',
      },
    ];
    const user = buildPreRenderBlueprintAuthoringUserPrompt(fixture.context);
    const wire = JSON.parse(
      user.slice('BLUEPRINT_PROVIDER_WIRE:\n'.length),
    ) as {
      v: string;
      story: unknown[];
      world: { zones: unknown[][] };
    };

    expect(wire.v).toBe('pre-render-blueprint-provider-wire/v1');
    expect(wire.story).toHaveLength(fixture.context.source.pageCount);
    expect(wire.world.zones[0]![5]).toEqual([
      ['centered_in', 'node_center', null],
      ['adjacent_to', 'node_center', 'node_wall'],
    ]);
    expect(user).not.toMatch(/\[spatial:/u);
    expect(user).not.toContain('actionSemanticCoverageAuthority');
  });

  it('fails closed instead of leaking an unresolved internal spatial marker', () => {
    const fixture = buildBlueprintFixture('single_location');
    fixture.context.template.pageContracts[0]!.mustShow.push(
      'unresolved [spatial:not_in_this_zone]',
    );
    expect(() =>
      buildPreRenderBlueprintAuthoringUserPrompt(fixture.context),
    ).toThrow('unresolved internal spatial reference marker');
  });

  it('keeps both initial and compact whole-book repair prompts under the unchanged byte ceiling', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const initial = blueprintAuthoringInputAccounting({
      systemPrompt: buildPreRenderBlueprintAuthoringSystemPrompt(),
      userPrompt: buildPreRenderBlueprintAuthoringUserPrompt(fixture.context),
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    });
    const previousDraft = wholeBookDraft(fixture.blueprint);
    const repairUser = buildPreRenderBlueprintRepairUserPrompt({
      context: fixture.context,
      previousDraft,
      diagnostics: [
        {
          code: 'schema_invalid',
          message: 'representative deterministic validation failure',
        },
      ],
    });
    expect(buildPreRenderBlueprintAuthoringSystemPrompt()).toContain(
      'both footprint dimensions must be at least minimumClearance',
    );
    expect(buildPreRenderBlueprintAuthoringSystemPrompt()).toContain(
      'greatest minimumClearance among them',
    );
    expect(buildPreRenderBlueprintRepairSystemPrompt()).toContain(
      'both footprint dimensions must be at least minClearance',
    );
    expect(buildPreRenderBlueprintRepairSystemPrompt()).toContain(
      'Repair zone authority and these dimensions together',
    );
    const repair = blueprintAuthoringInputAccounting({
      systemPrompt: buildPreRenderBlueprintRepairSystemPrompt(),
      userPrompt: repairUser,
      schema: PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
    });

    expect(initial.estimatedBytes).toBeLessThanOrEqual(64_000);
    expect(repair.estimatedBytes).toBeLessThanOrEqual(64_000);
    expect(repairUser).not.toContain('worldPlan');
    expect(repairUser).not.toMatch(/\[spatial:/u);
  });

  it('groups only byte-identical complete repair diagnostic identities', () => {
    expect(
      groupPreRenderBlueprintRepairDiagnostics([
        {
          code: 'text_safe_collision',
          field: 'frames[1].placements[0]',
          message: 'placement overlaps the reserved text-safe region',
          expected: { maximumY: 750 },
          actual: { y: 800 },
        },
        {
          code: 'text_safe_collision',
          field: 'frames[1].placements[0]',
          message: 'placement overlaps the reserved text-safe region',
          expected: { maximumY: 750 },
          actual: { y: 800 },
        },
        {
          code: 'text_safe_collision',
          field: 'frames[1].placements[0]',
          message: 'a different causal message must remain visible',
          expected: { maximumY: 740 },
          actual: { y: 800 },
        },
        {
          code: 'schema_invalid',
          message: 'explicit null differs from an absent expected value',
          expected: null,
        },
        {
          code: 'schema_invalid',
          message: 'explicit null differs from an absent expected value',
        },
      ]),
    ).toEqual([
      [
        'text_safe_collision',
        'frames[1].placements[0]',
        'placement overlaps the reserved text-safe region',
        [1, { maximumY: 750 }],
        [1, { y: 800 }],
        2,
      ],
      [
        'text_safe_collision',
        'frames[1].placements[0]',
        'a different causal message must remain visible',
        [1, { maximumY: 740 }],
        [1, { y: 800 }],
        1,
      ],
      [
        'schema_invalid',
        null,
        'explicit null differs from an absent expected value',
        [1, null],
        [0, null],
        1,
      ],
      [
        'schema_invalid',
        null,
        'explicit null differs from an absent expected value',
        [0, null],
        [0, null],
        1,
      ],
    ]);
  });

  it('stops before a second provider call when the exact repair wire exceeds the unchanged ceiling', async () => {
    const fixture = buildBlueprintFixture('single_location');
    const oversizedInvalid = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{
        narrative: { summary: string };
        camera: unknown;
      }>;
    };
    oversizedInvalid.frames[0]!.narrative.summary = 'x'.repeat(70_000);
    oversizedInvalid.frames[1]!.camera = null;
    let calls = 0;
    let caught: unknown;

    try {
      await compilePreRenderBookVisualBlueprint(
        fixture.context,
        CONFIG,
        {
          callAuthor: async () => {
            calls += 1;
            return oversizedInvalid;
          },
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(
      PreRenderBlueprintRepairInputNotAdmissibleError,
    );
    const failure =
      caught as PreRenderBlueprintRepairInputNotAdmissibleError;
    expect(failure.inputAccounting.estimatedBytes).toBeGreaterThan(
      64_000,
    );
    expect(failure.attempts).toHaveLength(1);
    expect(failure.attempts[0]!.errors).not.toEqual([]);
    expect(calls).toBe(1);
  });

  it('overlays upstream authority after the draft and ignores attempted frame authority injection', async () => {
    const fixture = buildBlueprintFixture('no_companion');
    const draft = wholeBookDraft(fixture.blueprint) as {
      frames: Array<Record<string, unknown>>;
    };
    for (const frame of draft.frames) {
      frame.id = 'attacker-controlled-id';
      frame.locationId = 'location:wrong';
      frame.zoneId = 'zone:wrong';
      frame.castIds = ['companion:invented'];
      frame.aspectRatio = { width: 1, height: 1 };
      frame.textSafeRegion = { x: 99, y: 99, width: 1, height: 1 };
      frame.propLifecycle = {
        requiredPropIds: ['prop:invented'],
        forbiddenPropIds: [],
      };
    }

    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      { callAuthor: async () => draft },
    );
    expect(result.blueprint.frames[0]).toMatchObject({
      id: 'frame:cover',
      locationId: fixture.context.template.coverContract.locationId,
      zoneId: fixture.context.template.coverContract.zoneId,
      castIds: ['child:hero'],
      aspectRatio: { width: 2, height: 3 },
      textSafeRegion: { x: 0, y: 0, width: 1000, height: 250 },
    });
    expect(
      result.blueprint.frames.some((frame) =>
        frame.castIds.includes('companion:invented'),
      ),
    ).toBe(false);
  });

  it('repairs only with bounded whole-book calls and records exact provenance', async () => {
    const fixture = buildBlueprintFixture('single_location');
    const invalid = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{
        placements: Array<{ region: unknown }>;
      }>;
    };
    invalid.frames[1].placements[0].region = {
      x: 100,
      y: 800,
      width: 150,
      height: 100,
    };
    const valid = wholeBookDraft(fixture.blueprint);
    const outputs = [invalid, valid];
    const calls: unknown[] = [];

    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      {
        callAuthor: async (system, user, options) => {
          calls.push({ system, user, options });
          return outputs[calls.length - 1];
        },
      },
    );

    expect(calls).toHaveLength(2);
    expect(result.repairAttempts).toHaveLength(1);
    expect(result.repairAttempts[0].errors.join('\n')).toContain(
      'text_safe_collision',
    );
    expect(result.provenance).toMatchObject({
      passingAttempt: 2,
      callCount: 2,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v9',
    });
    expect((calls[1] as { system: string }).system).toContain(
      'never return textSafeRegion',
    );
  });

  it('uses one canonical index space for normalized diagnostics, retained draft, and repair wire', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const raw = wholeBookDraft(fixture.blueprint) as {
      worldPlan: {
        connections: Array<{
          traversalAffordanceIds: string[];
          openingClearanceAffordanceIds: string[];
          safeBoundaryAffordanceIds: string[];
        }>;
        affordances: Array<{
          id: string;
          kind: string;
          clearanceRegion?: { width: number };
        }>;
        revealSafeSupportingGeometry: unknown[];
      };
      frames: unknown[];
    };
    raw.worldPlan.connections.reverse();
    raw.worldPlan.affordances.reverse();
    raw.worldPlan.revealSafeSupportingGeometry.reverse();
    raw.frames.reverse();
    for (const connection of raw.worldPlan.connections) {
      connection.traversalAffordanceIds.reverse();
      connection.openingClearanceAffordanceIds.reverse();
      connection.safeBoundaryAffordanceIds.reverse();
    }
    const opening = raw.worldPlan.affordances.find(
      (entry) => entry.kind === 'opening_clearance',
    );
    if (!opening?.clearanceRegion) throw new Error('opening fixture missing');
    opening.clearanceRegion.width = 1;
    const rawBefore = clone(raw);
    const calls: Array<{ system: string; user: string }> = [];

    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      {
        callAuthor: async (system, user) => {
          calls.push({ system, user });
          return calls.length === 1
            ? raw
            : wholeBookDraft(fixture.blueprint);
        },
      },
    );

    expect(raw).toEqual(rawBefore);
    expect(calls).toHaveLength(2);
    const retained = result.repairAttempts[0]!.draft as {
      worldPlan: { affordances: Array<{ id: string }> };
    };
    const retainedIds = retained.worldPlan.affordances.map((entry) => entry.id);
    expect(retainedIds).toEqual([...retainedIds].sort());
    const repairWire = JSON.parse(
      calls[1]!.user.split('\nREPAIR_WIRE:\n')[1]!,
    ) as {
      draft: { world: [unknown[], Array<[string, ...unknown[]]>, unknown[]] };
    };
    const wireIds = repairWire.draft.world[1].map((entry) => entry[0]);
    expect(wireIds).toEqual(retainedIds);
    const firstDiagnostics = result.repairAttempts[0]!.diagnostics ?? [];
    const affordanceDiagnostics = firstDiagnostics.filter(
      (entry) => entry.field?.startsWith('worldPlan.affordances['),
    );
    expect(affordanceDiagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of affordanceDiagnostics) {
      const match = /^worldPlan\.affordances\[(\d+)\]/u.exec(
        diagnostic.field ?? '',
      );
      expect(match).not.toBeNull();
      const index = Number(match![1]);
      expect(wireIds[index]).toBe(retainedIds[index]);
    }
    expect(
      firstDiagnostics.some((entry) =>
        /AffordanceIds\[\d+\]\.(?:footprint|clearanceRegion)$/u.test(
          entry.field ?? '',
        ),
      ),
    ).toBe(false);
  });

  it('repairs association before an unmasked numeric clearance failure within the fixed two-repair budget', async () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const associationInvalid = wholeBookDraft(fixture.blueprint) as {
      worldPlan: {
        affordances: Array<{
          kind: string;
          zoneId: string;
          clearanceRegion?: { width: number };
        }>;
      };
    };
    const traversal = associationInvalid.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    );
    const opening = associationInvalid.worldPlan.affordances.find(
      (entry) => entry.kind === 'opening_clearance',
    );
    if (!traversal || !opening?.clearanceRegion) {
      throw new Error('transition fixture missing');
    }
    const correctZone = traversal.zoneId;
    traversal.zoneId = fixture.context.template.zones.find(
      (zone) => zone.id !== correctZone,
    )!.id;
    opening.clearanceRegion.width = 100;
    const numericInvalid = clone(associationInvalid);
    numericInvalid.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    )!.zoneId = correctZone;
    const outputs = [
      associationInvalid,
      numericInvalid,
      wholeBookDraft(fixture.blueprint),
    ];
    let calls = 0;

    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      {
        callAuthor: async () => outputs[calls++]!,
      },
    );

    expect(calls).toBe(3);
    expect(result.repairAttempts).toHaveLength(2);
    const firstDiagnostics = result.repairAttempts[0]!.diagnostics ?? [];
    const secondDiagnostics = result.repairAttempts[1]!.diagnostics ?? [];
    expect(
      firstDiagnostics.some((entry) =>
        entry.message.includes('opening clearance is narrower'),
      ),
    ).toBe(false);
    expect(
      firstDiagnostics.some((entry) =>
        entry.message.includes('no same-zone traversal authority'),
      ),
    ).toBe(true);
    expect(secondDiagnostics).toContainEqual(
      expect.objectContaining({
        code: 'traversal_infeasible',
        message: 'opening clearance is narrower than traversal minimumClearance',
        field: expect.stringMatching(
          /^worldPlan\.affordances\[\d+\]\.clearanceRegion$/u,
        ),
      }),
    );
    expect(result.provenance.passingAttempt).toBe(3);
  });

  it('closes an eight-page five-traversal plus one-composition frontier in one provider-free repair', async () => {
    const fixture = sixTransitionEightPageFixture();
    const corrected = wholeBookDraft(
      fixture.blueprint,
    ) as MutableWholeBookDraft;
    applyEightPageComposition(corrected, { width: 160, height: 200 });

    const invalid = clone(corrected);
    applyEightPageComposition(invalid, { width: 200, height: 200 });
    const missingTraversalPages = new Set([2, 3, 4, 6, 7]);
    for (const frame of invalid.frames) {
      if (frame.kind !== 'page' || !missingTraversalPages.has(frame.pageNumber!)) {
        continue;
      }
      const connectionId = frame.continuity.connectionId;
      const connection = invalid.worldPlan.connections.find(
        (entry) => entry.id === connectionId,
      );
      if (!connection) throw new Error('transition connection missing');
      const traversalIds = new Set(connection.traversalAffordanceIds);
      frame.affordanceIds = frame.affordanceIds.filter(
        (id) => !traversalIds.has(id),
      );
    }

    const calls: Array<{ system: string; user: string }> = [];
    const outputs = [invalid, corrected];
    const result = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      {
        ...CONFIG,
        compositionPolicyVersion:
          PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
      },
      {
        callAuthor: async (system, user) => {
          calls.push({ system, user });
          return outputs[calls.length - 1]!;
        },
      },
    );

    expect(calls).toHaveLength(2);
    expect(result.provenance.passingAttempt).toBe(2);
    expect(result.repairAttempts).toHaveLength(1);
    const diagnostics = result.repairAttempts[0]!.diagnostics ?? [];
    expect(diagnostics).toHaveLength(6);
    expect(
      diagnostics.filter((entry) => entry.code === 'traversal_infeasible'),
    ).toHaveLength(5);
    expect(
      diagnostics
        .filter((entry) => entry.code === 'traversal_infeasible')
        .map((entry) => entry.field)
        .sort(),
    ).toEqual([
      'frames[2].affordanceIds',
      'frames[3].affordanceIds',
      'frames[4].affordanceIds',
      'frames[6].affordanceIds',
      'frames[7].affordanceIds',
    ]);
    expect(
      diagnostics.filter((entry) => entry.code === 'composition_policy_invalid'),
    ).toHaveLength(1);
    expect(
      diagnostics.find((entry) => entry.code === 'composition_policy_invalid'),
    ).toMatchObject({
      field: 'frames',
      message:
        'cast scale contrast is too small: 3.00x; require at least 3.5x between the tightest and widest body-page framing',
      expected: { minimumCastScaleRatio: 3.5 },
      actual: { castScaleRatio: 3 },
    });
    for (const diagnostic of diagnostics) {
      expect(Object.prototype.hasOwnProperty.call(diagnostic, 'expected')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(diagnostic, 'actual')).toBe(true);
    }
    const grouped = JSON.parse(
      calls[1]!.user.split('\nREPAIR_WIRE:\n')[0]!.split('\n').slice(1).join('\n'),
    ) as Array<[string, string | null, string, [number, unknown], [number, unknown], number]>;
    expect(grouped).toHaveLength(6);
    expect(grouped.every((entry) => entry[3][0] === 1 && entry[4][0] === 1)).toBe(true);
    const finalValidation = validatePreRenderBookVisualBlueprint(
      result.blueprint,
      fixture.context,
    );
    expect(finalValidation.ok, finalValidation.ok ? '' : JSON.stringify(finalValidation.issues)).toBe(true);
  });

  it('fails closed after the initial whole-book call plus two repairs', async () => {
    const fixture = buildBlueprintFixture('single_location');
    const invalid = wholeBookDraft(fixture.blueprint) as {
      frames: Array<{ camera: unknown }>;
    };
    invalid.frames[0].camera = null;
    let calls = 0;

    await expect(
      compilePreRenderBookVisualBlueprint(fixture.context, CONFIG, {
        callAuthor: async () => {
          calls += 1;
          return invalid;
        },
      }),
    ).rejects.toBeInstanceOf(
      PreRenderBlueprintAuthoringRepairExhaustedError,
    );
    expect(calls).toBe(3);
  });

  it('fails current authority before the injected call can run', async () => {
    const fixture = buildBlueprintFixture('single_location');
    const stale = clone(fixture.context);
    stale.styleContent = {
      styleId: stale.style.styleId,
      renderingContract: 'changed style content with old digest',
    };
    let calls = 0;

    await expect(
      compilePreRenderBookVisualBlueprint(stale, CONFIG, {
        callAuthor: async () => {
          calls += 1;
          return wholeBookDraft(fixture.blueprint);
        },
      }),
    ).rejects.toBeInstanceOf(InvalidPreRenderBlueprintAuthoringInputError);
    expect(calls).toBe(0);
  });

  it('rejects an incompatible fully serialized Blueprint schema before author or repair calls', async () => {
    const fixture = buildBlueprintFixture('single_location');
    const booleanConst = findConstNode(
      PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
      true,
    );
    expect(booleanConst).not.toBeNull();
    const originalType = booleanConst!.type;
    let calls = 0;
    let caught: unknown;
    delete booleanConst!.type;
    try {
      await compilePreRenderBookVisualBlueprint(
        fixture.context,
        CONFIG,
        {
          callAuthor: async () => {
            calls += 1;
            return wholeBookDraft(fixture.blueprint);
          },
        },
      );
    } catch (error) {
      caught = error;
    } finally {
      booleanConst!.type = originalType;
    }
    expect(caught).toBeInstanceOf(
      OpenAIResponsesStructuredOutputSchemaCompatibilityError,
    );
    expect(
      (
        caught as OpenAIResponsesStructuredOutputSchemaCompatibilityError
      ).evidence,
    ).toMatchObject({
      status: 'incompatible',
      issues: expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'OAI_SO_CONST_TYPE_REQUIRED',
        }),
      ]),
    });
    expect(calls).toBe(0);
  });

  it('produces deterministic candidate bytes and digest from equivalent fixture outputs', async () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const draft = wholeBookDraft(fixture.blueprint);
    const asObject = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      { callAuthor: async () => clone(draft) },
    );
    const asJson = await compilePreRenderBookVisualBlueprint(
      fixture.context,
      CONFIG,
      { callAuthor: async () => JSON.stringify(draft) },
    );

    expect(asObject.blueprint.digest).toBe(asJson.blueprint.digest);
    expect(serializePreRenderBookVisualBlueprint(asObject.blueprint)).toBe(
      serializePreRenderBookVisualBlueprint(asJson.blueprint),
    );
  });

  it('declares every structured-output object strict and fully required', () => {
    assertStrictObjects(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA);
    const root = PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA as {
      properties: {
        worldPlan: {
          properties: {
            affordances: {
              items: {
                anyOf: Array<{
                  properties: Record<string, Record<string, unknown>>;
                }>;
              };
            };
          };
        };
        frames: { items: { properties: Record<string, unknown> } };
      };
    };
    expect(findConstNode(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA, 'frame')).toBeNull();
    const affordanceBranches =
      root.properties.worldPlan.properties.affordances.items.anyOf;
    const camera = affordanceBranches.find(
      (branch) => branch.properties.kind.const === 'camera_access',
    )!;
    expect(camera.properties.consumers).toMatchObject({
      type: 'array',
      maxItems: 0,
    });
    expect(camera.properties.consumers).not.toHaveProperty('minItems');
    for (const branch of affordanceBranches.filter(
      (entry) => entry !== camera,
    )) {
      expect(branch.properties.consumers).toMatchObject({
        type: 'array',
        minItems: 1,
      });
    }
    expect(root.properties.frames.items.properties).not.toHaveProperty(
      'textSafeRegion',
    );
  });
});
