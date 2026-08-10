import { describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';

import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
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
  buildBlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const CONFIG = {
  model: 'fixture-reasoning-model',
  reasoningEffort: 'medium',
  maxOutputTokens: 48_000,
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

function wholeBookDraft(blueprint: PreRenderBookVisualBlueprint): unknown {
  return {
    worldPlan: clone(blueprint.worldPlan),
    frames: blueprint.frames.map((frame) => ({
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? null : frame.pageNumber,
      narrative: clone(frame.narrative),
      placements: clone(frame.placements),
      camera: clone(frame.camera),
      textSafeRegion: clone(frame.textSafeRegion),
      affordanceIds: clone(frame.affordanceIds),
      continuity: {
        connectionId: frame.continuity.connectionId ?? null,
        carryoverRefs: clone(frame.continuity.carryoverRefs),
      },
    })),
  };
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
        'presentationRequirements.requirements[0] lacks one approved preserved story-prose beat',
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
    'uses one shared whole-book call for %s and returns exact valid v3 authority',
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
        'exact Story Source prose and authored product authority',
      );
      expect(calls[0].system).toContain(
        'historical imageDirection, which is advisory',
      );
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
        'pre-render-book-visual-blueprint/v4',
      );
      expect(result.blueprint.identity.authoringAuthority.digest).toBe(
        fixture.blueprint.identity.authoringAuthority.digest,
      );
    },
  );

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
      frames: Array<{ textSafeRegion: unknown }>;
    };
    invalid.frames[1].textSafeRegion = {
      x: 0,
      y: 300,
      width: 1000,
      height: 700,
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
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v4',
    });
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
  });
});
