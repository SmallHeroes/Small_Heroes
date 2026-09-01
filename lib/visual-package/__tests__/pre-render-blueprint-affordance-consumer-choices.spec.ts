import { describe, expect, it } from 'vitest';

import {
  PreRenderBlueprintAffordanceConsumerChoiceBindingError,
  bindPreRenderBlueprintAffordanceConsumerChoices,
  buildPreRenderBlueprintAffordanceConsumerCatalog,
  compactPreRenderBlueprintAffordanceConsumerCatalog,
  projectPreRenderBlueprintAffordanceConsumerChoices,
} from '../preRenderBlueprintAffordanceConsumerChoices';
import { buildBlueprintFixture } from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('bounded Blueprint affordance consumer authority', () => {
  it('builds deterministic unique catalogs covering all four semantic consumer families', () => {
    const fixture = buildBlueprintFixture('reveal_timeline', {
      pageCount: 8,
    });
    const first = buildPreRenderBlueprintAffordanceConsumerCatalog(
      fixture.context.template,
    );
    const second = buildPreRenderBlueprintAffordanceConsumerCatalog(
      clone(fixture.context.template),
    );

    expect(second).toEqual(first);
    expect(first.action).toHaveLength(8);
    expect(first.placement).toEqual([
      { kind: 'placement', pageNumber: 2, propId: 'prop:hidden_keepsake' },
    ]);
    expect(first.safety).toHaveLength(8);
    const transitionFixture = buildBlueprintFixture('multi_zone_transition');
    const transitionCatalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
      transitionFixture.context.template,
    );
    expect(transitionCatalog.transition.length).toBeGreaterThan(0);
    for (const values of [
      first.action,
      first.placement,
      first.transition,
      first.safety,
    ] as ReadonlyArray<readonly unknown[]>) {
      expect(new Set(values.map((value) => JSON.stringify(value))).size).toBe(
        values.length,
      );
    }
    expect(compactPreRenderBlueprintAffordanceConsumerCatalog(first)).toEqual({
      a: first.action.map((value) => [value.pageNumber, value.checkId]),
      p: first.placement.map((value) => [value.pageNumber, value.propId]),
      t: first.transition.map((value) => value.pageNumber),
      s: first.safety.map((value) => [
        value.pageNumber,
        value.subjectId,
        value.relation,
        [value.target.kind, value.target.id],
      ]),
    });

    const negativeTemplate = clone(fixture.context.template);
    negativeTemplate.pageContracts[0]!.actionRequirements![0]!.polarity =
      'must_not';
    const negativeCatalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
      negativeTemplate,
    );
    expect(negativeCatalog.action).toHaveLength(7);
    expect(negativeCatalog.action).not.toContainEqual(
      expect.objectContaining({ pageNumber: 1 }),
    );
    expect(negativeCatalog.placement).not.toContainEqual(
      expect.objectContaining({ pageNumber: 1 }),
    );
  });

  it('round-trips every canonical semantic consumer without mutating input or deriving non-camera frame membership', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition', {
      pageCount: 8,
    });
    const catalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
      fixture.context.template,
    );
    const original = clone(fixture.blueprint.worldPlan.affordances);
    const choices = projectPreRenderBlueprintAffordanceConsumerChoices({
      affordances: fixture.blueprint.worldPlan.affordances,
      catalog,
    });
    const choicesBefore = clone(choices);
    const rebound = bindPreRenderBlueprintAffordanceConsumerChoices({
      rawAffordances: choices,
      catalog,
    }) as Array<{ consumers: Array<{ kind: string }> }>;

    expect(fixture.blueprint.worldPlan.affordances).toEqual(original);
    expect(choices).toEqual(choicesBefore);
    expect(
      (choices as Array<{ consumers: Array<{ kind: string }> }>).flatMap(
        (affordance) => affordance.consumers,
      ),
    ).not.toContainEqual(expect.objectContaining({ kind: 'frame' }));
    expect(rebound).toEqual(
      original.map((affordance) => ({
        ...affordance,
        consumers: affordance.consumers.filter(
          (consumer) => consumer.kind !== 'frame',
        ),
      })),
    );
  });

  it('collects raw-identity, wrong-kind, invalid-index, out-of-range, and duplicate failures atomically', () => {
    const fixture = buildBlueprintFixture('single_location', { pageCount: 8 });
    const catalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
      fixture.context.template,
    );
    const rawAffordances = [
      {
        kind: 'action_space',
        consumers: [clone(catalog.action[0])],
      },
      {
        kind: 'placement_support',
        consumers: [{ kind: 'action', choiceIndex: 0 }],
      },
      {
        kind: 'action_space',
        consumers: [{ kind: 'action', choiceIndex: -1 }],
      },
      {
        kind: 'action_space',
        consumers: [{ kind: 'action', choiceIndex: catalog.action.length }],
      },
      {
        kind: 'action_space',
        consumers: [
          { kind: 'action', choiceIndex: 0 },
          { kind: 'action', choiceIndex: 0 },
        ],
      },
    ];
    const before = clone(rawAffordances);

    try {
      bindPreRenderBlueprintAffordanceConsumerChoices({
        rawAffordances,
        catalog,
      });
      throw new Error('expected bounded choice binding to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(
        PreRenderBlueprintAffordanceConsumerChoiceBindingError,
      );
      const issues = (
        error as PreRenderBlueprintAffordanceConsumerChoiceBindingError
      ).issues;
      expect(issues).toHaveLength(5);
      expect(issues.map((issue) => issue.code)).toEqual([
        'schema_invalid',
        'affordance_incompatible',
        'schema_invalid',
        'affordance_incompatible',
        'reference_duplicate',
      ]);
      expect(issues[1]).toMatchObject({
        field: 'worldPlan.affordances[1].consumers[0].kind',
        expected: ['placement'],
        actual: 'action',
      });
      expect(issues[3]).toMatchObject({
        field: 'worldPlan.affordances[3].consumers[0].choiceIndex',
        expected: {
          minimum: 0,
          exclusiveMaximum: catalog.action.length,
        },
        actual: catalog.action.length,
      });
    }
    expect(rawAffordances).toEqual(before);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '0'])(
    'rejects non-safe-integer choiceIndex %s',
    (choiceIndex) => {
      const fixture = buildBlueprintFixture('single_location');
      const catalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
        fixture.context.template,
      );
      expect(() =>
        bindPreRenderBlueprintAffordanceConsumerChoices({
          rawAffordances: [
            {
              kind: 'action_space',
              consumers: [{ kind: 'action', choiceIndex }],
            },
          ],
          catalog,
        }),
      ).toThrow(PreRenderBlueprintAffordanceConsumerChoiceBindingError);
    },
  );

  it('never silently drops a semantic consumer outside canonical authority', () => {
    const fixture = buildBlueprintFixture('single_location');
    const catalog = buildPreRenderBlueprintAffordanceConsumerCatalog(
      fixture.context.template,
    );
    expect(() =>
      projectPreRenderBlueprintAffordanceConsumerChoices({
        affordances: [
          {
            kind: 'action_space',
            consumers: [
              { kind: 'action', pageNumber: 999, checkId: 'action:invented' },
            ],
          },
        ],
        catalog,
      }),
    ).toThrow('outside canonical consumer authority');
  });
});
