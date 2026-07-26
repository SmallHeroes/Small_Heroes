import { describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
  assertValidPreRenderBookVisualBlueprint,
  buildPreRenderBlueprintIdentity,
  computePreRenderBookVisualBlueprintDigest,
  finalizePreRenderBookVisualBlueprint,
  serializePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
  InvalidPreRenderBookVisualBlueprintError,
  type PreRenderBlueprintIssueCode,
  type PreRenderBookVisualBlueprint,
} from '@/lib/visual-package';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
import {
  projectCoverMustNotShow,
  projectPageMustNotShow,
  projectPageMustShow,
  projectZoneStableGeometry,
  type BookVisualContract,
  type BookVisualContractTemplate,
  type PageTransitionKind,
} from '@/lib/visual-contract-compiler';

import {
  buildBlueprintFixture,
  type BlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function issueCodes(
  blueprint: unknown,
  context: ReturnType<typeof buildBlueprintFixture>['context'],
): PreRenderBlueprintIssueCode[] {
  const result = validatePreRenderBookVisualBlueprint(blueprint, context);
  return result.ok ? [] : result.issues.map((entry) => entry.code);
}

function restamp(blueprint: PreRenderBookVisualBlueprint): PreRenderBookVisualBlueprint {
  const { digest: _digest, digestAlgorithm: _algorithm, ...draft } = blueprint;
  return finalizePreRenderBookVisualBlueprint(draft);
}

function refreshContractProjections(blueprint: PreRenderBookVisualBlueprint): void {
  const contract = blueprint.visualContract as unknown as BookVisualContract;
  blueprint.visualContract.coverContract.mustNotShow = projectCoverMustNotShow(contract);
  for (const page of blueprint.visualContract.pageContracts) {
    page.mustShow = [
      `authored narrative beat ${page.pageNumber}`,
      ...projectPageMustShow(page, contract),
    ];
    page.mustNotShow = projectPageMustNotShow(page, contract);
  }
}

function rebindEmbeddedAuthority(args: {
  blueprint: PreRenderBookVisualBlueprint;
  context: BlueprintFixture['context'];
}): BlueprintFixture {
  const blueprint = clone(args.blueprint);
  const context = clone(args.context);
  context.template = clone(blueprint.visualContract);
  context.visualPackage.template = {
    ...context.visualPackage.template,
    digest: canonicalJsonDigest(context.template),
    schemaVersion: context.template.schemaVersion,
  };
  blueprint.identity = buildPreRenderBlueprintIdentity({
    source: context.source,
    template: context.visualPackage.template,
    visualPackage: context.visualPackage,
    visualPackageArtifactPath: blueprint.identity.visualPackage.artifactPath,
  });
  return {
    blueprint: restamp(blueprint),
    context,
  };
}

function validTemplateHuman(): BookVisualContractTemplate['humanCast'][number] {
  const explicit = (value: string) => ({
    mode: 'explicit' as const,
    value,
    origin: {
      kind: 'story_evidence' as const,
      page: 1,
      phrase: `page 1 explicitly establishes ${value}`,
    },
  });
  return {
    id: 'human:guide',
    role: 'guide',
    gender: 'unspecified',
    aliases: ['the guide'],
    textEvidence: 'page 1: the guide',
    pagesPresent: [1],
    appearance: {
      skinTone: explicit('warm brown skin'),
      hairColour: explicit('dark brown hair'),
      hairTexture: explicit('wavy hair texture'),
      hairStyle: explicit('short side-parted hair'),
    },
    garments: [
      {
        id: 'guide_coat',
        colour: explicit('green coat'),
      },
    ],
    forbiddenAppearance: [],
  };
}

function addValidTemplateHuman(
  blueprint: PreRenderBookVisualBlueprint,
): BookVisualContractTemplate['humanCast'][number] {
  const human = validTemplateHuman();
  blueprint.visualContract.humanCast.push(human);
  const page = blueprint.visualContract.pageContracts.find(
    (entry) => entry.pageNumber === 1,
  );
  if (!page) throw new Error('page-1 contract fixture missing');
  page.castIds = [...(page.castIds ?? []), human.id];
  return human;
}

function validTemplateProp(
  id: string,
  firstRevealPage?: number,
): BookVisualContractTemplate['recurringProps'][number] {
  return {
    id,
    name: `Prop ${id}`,
    description: `Stable description for ${id}`,
    ...(firstRevealPage === undefined ? {} : { firstRevealPage }),
  };
}

function buildTransitionKindFixture(
  kind: Exclude<PageTransitionKind, 'steady'>,
  frameEndpoint: 'from' | 'to',
): BlueprintFixture {
  const fixture = buildBlueprintFixture('multi_zone_transition');
  const blueprint = clone(fixture.blueprint);
  const page = blueprint.visualContract.pageContracts.find(
    (entry) => entry.pageNumber === 2,
  );
  const frame = blueprint.frames.find((entry) => entry.id === 'frame:page:2');
  if (
    !page?.transition?.fromZoneId ||
    !page.transition.toZoneId ||
    !frame ||
    frame.kind !== 'page'
  ) {
    throw new Error('transition fixture missing');
  }
  const zoneId =
    frameEndpoint === 'from' ? page.transition.fromZoneId : page.transition.toZoneId;
  page.transition = { ...page.transition, kind };
  page.zoneId = zoneId;
  frame.zoneId = zoneId;
  frame.continuity.transitionKind = kind;

  for (const affordance of blueprint.worldPlan.affordances) {
    const consumedByPageFrame = affordance.consumers.some(
      (consumer) =>
        ('pageNumber' in consumer && consumer.pageNumber === page.pageNumber) ||
        (consumer.kind === 'frame' && consumer.frameId === frame.id),
    );
    if (consumedByPageFrame) affordance.zoneId = zoneId;
  }

  refreshContractProjections(blueprint);
  return rebindEmbeddedAuthority({ blueprint, context: fixture.context });
}

function renameRevealProp(
  fixture: BlueprintFixture,
  next: { id: string; name: string },
): BlueprintFixture {
  const blueprint = clone(fixture.blueprint);
  const prop = blueprint.visualContract.recurringProps[0];
  const previousId = prop.id;
  prop.id = next.id;
  prop.name = next.name;
  for (const page of blueprint.visualContract.pageContracts) {
    for (const constraint of page.propConstraints ?? []) {
      if (constraint.propId === previousId) constraint.propId = next.id;
    }
  }
  for (const frame of blueprint.frames) {
    frame.propLifecycle.requiredPropIds = frame.propLifecycle.requiredPropIds.map((id) =>
      id === previousId ? next.id : id,
    );
    frame.propLifecycle.forbiddenPropIds = frame.propLifecycle.forbiddenPropIds.map((id) =>
      id === previousId ? next.id : id,
    );
    for (const placement of frame.placements) {
      if (placement.subject.kind === 'prop' && placement.subject.propId === previousId) {
        placement.subject.propId = next.id;
      }
    }
    for (const ref of frame.continuity.carryoverRefs) {
      if (ref.kind === 'prop' && ref.id === previousId) ref.id = next.id;
    }
  }
  for (const geometry of blueprint.worldPlan.revealSafeSupportingGeometry) {
    geometry.supportsPropIds = geometry.supportsPropIds.map((id) =>
      id === previousId ? next.id : id,
    );
  }
  for (const affordance of blueprint.worldPlan.affordances) {
    if (affordance.kind === 'placement_support') {
      for (const entity of affordance.supportedEntities) {
        if (entity.kind === 'prop' && entity.id === previousId) entity.id = next.id;
      }
      for (const consumer of affordance.consumers) {
        if (consumer.kind === 'placement' && consumer.propId === previousId) {
          consumer.propId = next.id;
        }
      }
    }
  }
  refreshContractProjections(blueprint);
  return rebindEmbeddedAuthority({ blueprint, context: fixture.context });
}

function buildTwoPropCapacityFixture(maximumOccupants: number): BlueprintFixture {
  const fixture = buildBlueprintFixture('reveal_timeline');
  const blueprint = clone(fixture.blueprint);
  const secondPropId = 'prop:second_token';
  blueprint.visualContract.recurringProps.push({
    id: secondPropId,
    name: 'Second token',
    description: 'a second small token with an independent stable identity',
    firstRevealPage: 2,
  });
  const page1 = blueprint.visualContract.pageContracts.find(
    (page) => page.pageNumber === 1,
  )!;
  const page2 = blueprint.visualContract.pageContracts.find(
    (page) => page.pageNumber === 2,
  )!;
  page1.propConstraints = [
    ...(page1.propConstraints ?? []),
    { propId: secondPropId, visibility: 'forbidden' },
  ];
  page2.propConstraints = [
    ...(page2.propConstraints ?? []),
    {
      propId: secondPropId,
      visibility: 'required',
      anchorId: 'anchor:support',
    },
  ];
  const cover = blueprint.frames.find((frame) => frame.kind === 'cover')!;
  cover.propLifecycle.forbiddenPropIds.push(secondPropId);
  const frame1 = blueprint.frames.find((frame) => frame.id === 'frame:page:1')!;
  frame1.propLifecycle.forbiddenPropIds.push(secondPropId);
  const frame2 = blueprint.frames.find((frame) => frame.id === 'frame:page:2')!;
  frame2.propLifecycle.requiredPropIds.push(secondPropId);
  frame2.placements.push({
    id: 'placement:2:second-required-prop',
    subject: { kind: 'prop', propId: secondPropId },
    region: { x: 620, y: 550, width: 100, height: 100 },
    depth: 'foreground',
    importance: 'key',
  });
  const support = blueprint.worldPlan.affordances.find(
    (affordance) =>
      affordance.kind === 'placement_support' &&
      affordance.consumers.some(
        (consumer) => consumer.kind === 'placement' && consumer.pageNumber === 2,
      ),
  );
  if (!support || support.kind !== 'placement_support') {
    throw new Error('placement support fixture missing');
  }
  support.maximumOccupants = maximumOccupants;
  support.supportedEntities.push({ kind: 'prop', id: secondPropId });
  support.consumers.push({
    kind: 'placement',
    pageNumber: 2,
    propId: secondPropId,
  });
  refreshContractProjections(blueprint);
  return rebindEmbeddedAuthority({ blueprint, context: fixture.context });
}

function buildTwoActorCapacityFixture(maximumActors: number): BlueprintFixture {
  const fixture = buildBlueprintFixture('single_location');
  const blueprint = clone(fixture.blueprint);
  const page = blueprint.visualContract.pageContracts[0];
  const companionId = blueprint.visualContract.cast.companion?.id;
  if (!companionId) throw new Error('companion fixture missing');
  page.actionRequirements = [
    ...(page.actionRequirements ?? []),
    {
      checkId: 'action:page_1_companion_points',
      actorId: companionId,
      predicate: 'points_at',
      object: { kind: 'anchor', id: 'anchor:focus' },
      polarity: 'must',
    },
  ];
  const frame = blueprint.frames.find((entry) => entry.id === 'frame:page:1')!;
  frame.placements.push({
    id: 'placement:1:companion-action',
    subject: { kind: 'action', checkId: 'action:page_1_companion_points' },
    region: { x: 250, y: 360, width: 200, height: 220 },
    depth: 'midground',
    importance: 'key',
  });
  const actionSpace = blueprint.worldPlan.affordances.find(
    (affordance) =>
      affordance.kind === 'action_space' &&
      affordance.consumers.some(
        (consumer) => consumer.kind === 'action' && consumer.pageNumber === 1,
      ),
  );
  if (!actionSpace || actionSpace.kind !== 'action_space') {
    throw new Error('action-space fixture missing');
  }
  actionSpace.maximumActors = maximumActors;
  actionSpace.supportedPredicates.push('points_at');
  actionSpace.supportedEntities.push({ kind: 'cast', id: companionId });
  actionSpace.consumers.push({
    kind: 'action',
    pageNumber: 1,
    checkId: 'action:page_1_companion_points',
  });
  refreshContractProjections(blueprint);
  return rebindEmbeddedAuthority({ blueprint, context: fixture.context });
}

describe('R1D-PVB-A — schema generalization fixtures', () => {
  const shapes: BlueprintFixtureShape[] = [
    'single_location',
    'multi_zone_transition',
    'journey_fantastical',
    'no_companion',
    'reveal_timeline',
  ];

  it.each(shapes)('accepts a complete %s book blueprint', (shape) => {
    const fixture = buildBlueprintFixture(shape);
    const result = validatePreRenderBookVisualBlueprint(fixture.blueprint, fixture.context);
    expect(result.ok, result.ok ? '' : result.issues.map((entry) => `${entry.code}: ${entry.message}`).join('\n')).toBe(true);
  });

  it('represents no-companion authority without inventing a companion frame placement', () => {
    const fixture = buildBlueprintFixture('no_companion');
    expect(fixture.blueprint.visualContract.cast.companion).toBeUndefined();
    expect(
      fixture.blueprint.frames.every(
        (frame) =>
          frame.castIds.every((castId) => !castId.startsWith('companion:')) &&
          frame.placements.every(
            (placement) =>
              placement.subject.kind !== 'cast' ||
              !placement.subject.castId.startsWith('companion:'),
          ),
      ),
    ).toBe(true);
  });

  it('requires exact 2:3 portrait authority for the cover and every authored page', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    bad.frames[1].aspectRatio = { width: 3, height: 2 } as never;
    const restamped = restamp(bad);
    expect(issueCodes(restamped, fixture.context)).toContain('aspect_ratio_invalid');
  });
});

describe('R1D-PVB-A — coverage, references, and deterministic authority', () => {
  it('fails closed on a missing, duplicate, or extra page frame', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');

    const missing = clone(fixture.blueprint);
    missing.frames = missing.frames.filter(
      (frame) => frame.kind !== 'page' || frame.pageNumber !== 2,
    );
    expect(issueCodes(restamp(missing), fixture.context)).toContain('coverage_incomplete');

    const duplicate = clone(fixture.blueprint);
    duplicate.frames.push(clone(duplicate.frames.find((frame) => frame.id === 'frame:page:1')!));
    expect(issueCodes(restamp(duplicate), fixture.context)).toContain('coverage_duplicate');

    const extra = clone(fixture.blueprint);
    const page = clone(extra.frames.find((frame) => frame.id === 'frame:page:2')!);
    if (page.kind !== 'page') throw new Error('fixture page missing');
    page.id = 'frame:page:99';
    page.pageNumber = 99;
    extra.frames.push(page);
    expect(issueCodes(restamp(extra), fixture.context)).toContain('coverage_extra');
  });

  it('rejects unresolved frame, connection, and affordance references', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const bad = clone(fixture.blueprint);
    const page2 = bad.frames.find((frame) => frame.id === 'frame:page:2')!;
    page2.zoneId = 'zone:missing';
    page2.camera.affordanceId = 'affordance:missing';
    page2.continuity.connectionId = 'connection:missing';
    const codes = issueCodes(restamp(bad), fixture.context);
    expect(codes).toContain('reference_unresolved');
    expect(codes).toContain('camera_infeasible');
    expect(codes).toContain('transition_invalid');
  });

  it('canonical normalization makes array order and object-key order digest-stable', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const reordered = clone(fixture.blueprint);
    reordered.worldPlan.affordances.reverse();
    reordered.worldPlan.connections.reverse();
    reordered.frames.reverse();
    for (const frame of reordered.frames) {
      frame.placements.reverse();
      frame.affordanceIds.reverse();
    }
    const restamped = restamp(reordered);
    expect(restamped.digest).toBe(fixture.blueprint.digest);

    const keyReordered = JSON.parse(
      JSON.stringify(fixture.blueprint, Object.keys(fixture.blueprint).reverse()),
    ) as unknown;
    // A JSON replacer-array is lossy for nested keys, so use parse/stringify with a recursive
    // explicit reordering instead to prove canonical serialization stability.
    void keyReordered;
    const recursiveReverse = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(recursiveReverse);
      if (!value || typeof value !== 'object') return value;
      return Object.keys(value as Record<string, unknown>)
        .reverse()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = recursiveReverse((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    };
    const reversedKeys = recursiveReverse(fixture.blueprint) as PreRenderBookVisualBlueprint;
    expect(computePreRenderBookVisualBlueprintDigest(reversedKeys)).toBe(fixture.blueprint.digest);
    expect(serializePreRenderBookVisualBlueprint(reversedKeys)).toBe(
      serializePreRenderBookVisualBlueprint(fixture.blueprint),
    );
  });

  it('uses explicit locale-independent lexical ordering for digest-owned arrays', () => {
    const fixture = buildBlueprintFixture('single_location');
    const reordered = clone(fixture.blueprint);
    const coverCamera = reordered.worldPlan.affordances.find(
      (affordance) =>
        affordance.kind === 'camera_access' &&
        affordance.consumers.some(
          (consumer) => consumer.kind === 'frame' && consumer.frameId === 'frame:cover',
        ),
    );
    const pageCamera = reordered.worldPlan.affordances.find(
      (affordance) =>
        affordance.kind === 'camera_access' &&
        affordance.consumers.some(
          (consumer) => consumer.kind === 'frame' && consumer.frameId === 'frame:page:1',
        ),
    );
    if (!coverCamera || coverCamera.kind !== 'camera_access') {
      throw new Error('cover camera fixture missing');
    }
    if (!pageCamera || pageCamera.kind !== 'camera_access') {
      throw new Error('page camera fixture missing');
    }
    const oldCoverId = coverCamera.id;
    const oldPageId = pageCamera.id;
    coverCamera.id = 'affordance:camera:ä';
    pageCamera.id = 'affordance:camera:z';
    for (const frame of reordered.frames) {
      frame.affordanceIds = frame.affordanceIds.map((id) =>
        id === oldCoverId
          ? coverCamera.id
          : id === oldPageId
            ? pageCamera.id
            : id,
      );
      if (frame.camera.affordanceId === oldCoverId) {
        frame.camera.affordanceId = coverCamera.id;
      } else if (frame.camera.affordanceId === oldPageId) {
        frame.camera.affordanceId = pageCamera.id;
      }
    }
    reordered.worldPlan.affordances.reverse();
    const finalized = restamp(reordered);
    const orderedIds = finalized.worldPlan.affordances
      .map((affordance) => affordance.id)
      .filter((id) => id === coverCamera.id || id === pageCamera.id);
    expect(orderedIds).toEqual(['affordance:camera:z', 'affordance:camera:ä']);
    expect(validatePreRenderBookVisualBlueprint(finalized, fixture.context).ok).toBe(true);
  });

  it('finalization is pure and does not mutate caller-owned draft arrays', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const { digest: _digest, digestAlgorithm: _algorithm, ...draft } = clone(fixture.blueprint);
    draft.frames.reverse();
    draft.worldPlan.affordances.reverse();
    const before = clone(draft);
    finalizePreRenderBookVisualBlueprint(draft);
    expect(draft).toEqual(before);
  });

  it('rejects schema, content, and digest mutation', () => {
    const fixture = buildBlueprintFixture('single_location');

    const schemaMutation = clone(fixture.blueprint);
    schemaMutation.version = 'pre-render-book-visual-blueprint/v0' as typeof PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION;
    expect(issueCodes(schemaMutation, fixture.context)).toContain('schema_version_unsupported');

    const contentMutation = clone(fixture.blueprint);
    contentMutation.frames[0].narrative.summary = 'mutated without re-stamping';
    expect(issueCodes(contentMutation, fixture.context)).toContain('digest_mismatch');

    const digestMutation = clone(fixture.blueprint);
    digestMutation.digest = '0'.repeat(64);
    expect(issueCodes(digestMutation, fixture.context)).toContain('digest_mismatch');
  });

  it('returns structured issues instead of throwing on malformed nested arrays', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint) as unknown as Record<string, unknown>;
    (bad.worldPlan as Record<string, unknown>).affordances = null;
    bad.frames = [null];
    expect(() => validatePreRenderBookVisualBlueprint(bad, fixture.context)).not.toThrow();
    const result = validatePreRenderBookVisualBlueprint(bad, fixture.context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((entry) => entry.code)).toContain('schema_invalid');
  });

  const malformedCases: Array<{
    name: string;
    shape?: BlueprintFixtureShape;
    restampable: boolean;
    expectedCode?: PreRenderBlueprintIssueCode;
    mutate: (blueprint: PreRenderBookVisualBlueprint) => void;
  }> = [
    {
      name: 'omitted visual-contract humanCast',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        delete (blueprint.visualContract as unknown as { humanCast?: unknown }).humanCast;
      },
    },
    {
      name: 'non-array visual-contract humanCast',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.humanCast = 'invalid' as never;
      },
    },
    {
      name: 'visual-contract humanCast [null]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.humanCast = [null] as never;
      },
    },
    {
      name: 'visual-contract humanCast [undefined]',
      restampable: false,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.humanCast = [undefined] as never;
      },
    },
    {
      name: 'visual-contract humanCast [{}]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.humanCast = [{}] as never;
      },
    },
    {
      name: 'visual-contract humanCast valid plus null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const valid = addValidTemplateHuman(blueprint);
        blueprint.visualContract.humanCast = [valid, null] as never;
      },
    },
    {
      name: 'visual-contract humanCast mixed scalar and object entries',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const valid = addValidTemplateHuman(blueprint);
        blueprint.visualContract.humanCast = [valid, 'invalid', {}] as never;
      },
    },
    {
      name: 'omitted visual-contract recurringProps',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        delete (blueprint.visualContract as unknown as { recurringProps?: unknown })
          .recurringProps;
      },
    },
    {
      name: 'null visual-contract recurringProps',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = null as never;
      },
    },
    {
      name: 'object visual-contract recurringProps',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = { invalid: true } as never;
      },
    },
    {
      name: 'string visual-contract recurringProps',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = 'invalid' as never;
      },
    },
    {
      name: 'malformed-array visual-contract recurringProps',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = [null] as never;
      },
    },
    {
      name: 'visual-contract recurringProps [{}]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = [{}] as never;
      },
    },
    {
      name: 'visual-contract recurringProps valid plus null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = [
          validTemplateProp('prop:plain'),
          null,
        ] as never;
      },
    },
    {
      name: 'visual-contract recurringProps null plus valid',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = [
          null,
          validTemplateProp('prop:plain'),
        ] as never;
      },
    },
    {
      name: 'visual-contract recurringProps mixed scalars with valid prop',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.recurringProps = [
          validTemplateProp('prop:plain'),
          'invalid',
          7,
        ] as never;
      },
    },
    {
      name: 'visual-contract lifecycle and non-lifecycle props around null',
      shape: 'reveal_timeline',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const lifecycle = blueprint.visualContract.recurringProps[0];
        blueprint.visualContract.recurringProps = [
          lifecycle,
          null,
          validTemplateProp('prop:plain'),
        ] as never;
      },
    },
    {
      name: 'visual-contract garments [null]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const human = addValidTemplateHuman(blueprint);
        human.garments = [null] as never;
      },
    },
    {
      name: 'visual-contract garments [{}]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const human = addValidTemplateHuman(blueprint);
        human.garments = [{}] as never;
      },
    },
    {
      name: 'visual-contract garments mixed valid and invalid entries',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        const human = addValidTemplateHuman(blueprint);
        human.garments = [...human.garments, null, 'invalid'] as never;
      },
    },
    {
      name: 'visual-contract locations mixed valid and null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.locations = [
          blueprint.visualContract.locations[0],
          null,
        ] as never;
      },
    },
    {
      name: 'visual-contract zones mixed valid and null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.zones = [
          ...blueprint.visualContract.zones,
          null,
        ] as never;
      },
    },
    {
      name: 'visual-contract pageContracts mixed valid and null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.pageContracts = [
          ...blueprint.visualContract.pageContracts,
          null,
        ] as never;
      },
    },
    {
      name: 'visual-contract forbiddenGlobalElements mixed string and null',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.forbiddenGlobalElements = [
          'valid exclusion',
          null,
        ] as never;
      },
    },
    {
      name: 'visual-contract setBoardAuthorities [null]',
      restampable: true,
      expectedCode: 'visual_contract_invalid',
      mutate: (blueprint) => {
        blueprint.visualContract.setBoardAuthorities = [null] as never;
      },
    },
    {
      name: 'missing identity.source',
      restampable: true,
      mutate: (blueprint) => {
        delete (blueprint.identity as unknown as { source?: unknown }).source;
      },
    },
    {
      name: 'missing identity.template',
      restampable: true,
      mutate: (blueprint) => {
        delete (blueprint.identity as unknown as { template?: unknown }).template;
      },
    },
    {
      name: 'missing identity.visualPackage',
      restampable: true,
      mutate: (blueprint) => {
        delete (blueprint.identity as unknown as { visualPackage?: unknown }).visualPackage;
      },
    },
    {
      name: 'null placement entry',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.frames[1].placements = [null] as never;
      },
    },
    {
      name: 'null placement subject',
      restampable: true,
      mutate: (blueprint) => {
        blueprint.frames[1].placements[0].subject = null as never;
      },
    },
    {
      name: 'null castIds',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.frames[1].castIds = null as never;
      },
    },
    {
      name: 'null frame camera',
      restampable: true,
      mutate: (blueprint) => {
        blueprint.frames[1].camera = null as never;
      },
    },
    {
      name: 'null frame propLifecycle',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.frames[1].propLifecycle = null as never;
      },
    },
    {
      name: 'non-array frame affordanceIds',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.frames[1].affordanceIds = { invalid: true } as never;
      },
    },
    {
      name: 'null affordance consumers',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.worldPlan.affordances[0].consumers = null as never;
      },
    },
    {
      name: 'null placement supportedEntities',
      shape: 'reveal_timeline',
      restampable: false,
      mutate: (blueprint) => {
        const target = blueprint.worldPlan.affordances.find(
          (entry) => entry.kind === 'placement_support',
        );
        if (!target || target.kind !== 'placement_support') {
          throw new Error('placement support fixture missing');
        }
        target.supportedEntities = null as never;
      },
    },
    {
      name: 'null action supportedEntities',
      restampable: false,
      mutate: (blueprint) => {
        const target = blueprint.worldPlan.affordances.find(
          (entry) => entry.kind === 'action_space',
        );
        if (!target || target.kind !== 'action_space') {
          throw new Error('action-space fixture missing');
        }
        target.supportedEntities = null as never;
      },
    },
    {
      name: 'null safe-boundary target',
      restampable: true,
      mutate: (blueprint) => {
        const target = blueprint.worldPlan.affordances.find(
          (entry) => entry.kind === 'safe_boundary',
        );
        if (!target || target.kind !== 'safe_boundary') {
          throw new Error('safe-boundary fixture missing');
        }
        target.target = null as never;
      },
    },
    {
      name: 'truthy non-array continuity carryoverRefs',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.frames[1].continuity.carryoverRefs = { invalid: true } as never;
      },
    },
    {
      name: 'non-array transition traversal ids',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.worldPlan.connections[0].traversalAffordanceIds = {
          invalid: true,
        } as never;
      },
    },
    {
      name: 'non-array transition opening ids',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.worldPlan.connections[0].openingClearanceAffordanceIds = {
          invalid: true,
        } as never;
      },
    },
    {
      name: 'non-array transition safety ids',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.worldPlan.connections[0].safeBoundaryAffordanceIds = {
          invalid: true,
        } as never;
      },
    },
    {
      name: 'null connection endpoint',
      restampable: true,
      mutate: (blueprint) => {
        blueprint.worldPlan.connections[0].from = null as never;
      },
    },
    {
      name: 'null supporting-geometry entry',
      shape: 'reveal_timeline',
      restampable: false,
      mutate: (blueprint) => {
        blueprint.worldPlan.revealSafeSupportingGeometry = [null] as never;
      },
    },
  ];

  it.each(malformedCases)(
    'fails closed deterministically without raw exceptions for $name',
    ({ shape = 'multi_zone_transition', restampable, expectedCode, mutate }) => {
      const fixture = buildBlueprintFixture(shape);
      let bad = clone(fixture.blueprint);
      mutate(bad);
      if (restampable) bad = restamp(bad);

      expect(() => validatePreRenderBookVisualBlueprint(bad, fixture.context)).not.toThrow();
      const first = validatePreRenderBookVisualBlueprint(bad, fixture.context);
      const second = validatePreRenderBookVisualBlueprint(bad, fixture.context);
      expect(first).toEqual(second);
      expect(first.ok).toBe(false);
      if (!first.ok && expectedCode) {
        expect(first.issues.map((entry) => entry.code)).toContain(expectedCode);
        expect(first.issues).not.toEqual([
          {
            code: 'schema_invalid',
            message: 'blueprint validation could not safely inspect malformed nested input',
          },
        ]);
      }

      let thrown: unknown;
      try {
        assertValidPreRenderBookVisualBlueprint(bad, fixture.context);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(InvalidPreRenderBookVisualBlueprintError);
      expect(thrown).not.toBeInstanceOf(TypeError);
    },
  );

  it('contains unforeseen property-access failures at the PVB public boundary', () => {
    const fixture = buildBlueprintFixture('single_location');
    const explosive = Object.defineProperty(clone(fixture.blueprint), 'version', {
      get: () => {
        throw new TypeError('untrusted accessor');
      },
    });
    const first = validatePreRenderBookVisualBlueprint(explosive, fixture.context);
    const second = validatePreRenderBookVisualBlueprint(explosive, fixture.context);
    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: false,
      issues: [
        {
          code: 'schema_invalid',
          message: 'blueprint validation could not safely inspect malformed nested input',
        },
      ],
    });
    expect(() =>
      assertValidPreRenderBookVisualBlueprint(explosive, fixture.context),
    ).toThrow(InvalidPreRenderBookVisualBlueprintError);
  });
});

describe('R1D-PVB-A — spatial feasibility and safety', () => {
  it('rejects a declared action without compatible footprint/predicate support', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    const action = bad.worldPlan.affordances.find(
      (entry) => entry.kind === 'action_space',
    );
    if (!action || action.kind !== 'action_space') throw new Error('action fixture missing');
    action.supportedPredicates = ['points_at'];
    expect(issueCodes(restamp(bad), fixture.context)).toContain('action_infeasible');
  });

  it('rejects required prop placement without compatible support', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const support = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'placement_support' &&
        entry.consumers.some(
          (consumer) => consumer.kind === 'placement' && consumer.pageNumber === 2,
        ),
    );
    if (!support || support.kind !== 'placement_support') throw new Error('placement fixture missing');
    support.support = { kind: 'anchor', id: 'anchor:focus' };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('placement_infeasible');
  });

  it('enforces aggregate unique-prop capacity with an exact-capacity boundary', () => {
    const exact = buildTwoPropCapacityFixture(2);
    expect(validatePreRenderBookVisualBlueprint(exact.blueprint, exact.context).ok).toBe(true);

    const overbooked = buildTwoPropCapacityFixture(1);
    expect(issueCodes(overbooked.blueprint, overbooked.context)).toContain(
      'placement_infeasible',
    );
  });

  it('enforces aggregate unique required-action actors with an exact-capacity boundary', () => {
    const exact = buildTwoActorCapacityFixture(2);
    expect(validatePreRenderBookVisualBlueprint(exact.blueprint, exact.context).ok).toBe(true);

    const overbooked = buildTwoActorCapacityFixture(1);
    expect(issueCodes(overbooked.blueprint, overbooked.context)).toContain(
      'action_infeasible',
    );
  });

  it('rejects a transition without traversal/opening clearance and authored connection support', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const bad = clone(fixture.blueprint);
    const connection = bad.worldPlan.connections[0];
    connection.traversalAffordanceIds = ['affordance:missing'];
    connection.openingClearanceAffordanceIds = [];
    const codes = issueCodes(restamp(bad), fixture.context);
    expect(codes).toContain('traversal_infeasible');
  });

  it('enforces minimumClearance on traversal and opening min-dimensions at the exact boundary', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const traversal = fixture.blueprint.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    );
    const opening = fixture.blueprint.worldPlan.affordances.find(
      (entry) => entry.kind === 'opening_clearance',
    );
    if (!traversal || traversal.kind !== 'traversal') {
      throw new Error('traversal fixture missing');
    }
    if (!opening || opening.kind !== 'opening_clearance') {
      throw new Error('opening fixture missing');
    }
    expect(traversal.minimumClearance).toBe(180);
    expect(Math.min(opening.clearanceRegion.width, opening.clearanceRegion.height)).toBe(180);
    expect(validatePreRenderBookVisualBlueprint(fixture.blueprint, fixture.context).ok).toBe(true);

    const narrowOpening = clone(fixture.blueprint);
    const narrowOpeningAffordance = narrowOpening.worldPlan.affordances.find(
      (entry) => entry.kind === 'opening_clearance',
    );
    if (!narrowOpeningAffordance || narrowOpeningAffordance.kind !== 'opening_clearance') {
      throw new Error('opening fixture missing');
    }
    narrowOpeningAffordance.clearanceRegion.width = 179;
    expect(issueCodes(restamp(narrowOpening), fixture.context)).toContain(
      'traversal_infeasible',
    );

    const narrowTraversal = clone(fixture.blueprint);
    const narrowTraversalAffordance = narrowTraversal.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    );
    if (!narrowTraversalAffordance || narrowTraversalAffordance.kind !== 'traversal') {
      throw new Error('traversal fixture missing');
    }
    narrowTraversalAffordance.footprint.width = 179;
    expect(issueCodes(restamp(narrowTraversal), fixture.context)).toContain(
      'traversal_infeasible',
    );
  });

  it('rejects transition support in an unrelated endpoint zone', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const bad = clone(fixture.blueprint);
    const page2 = bad.frames.find((frame) => frame.id === 'frame:page:2');
    if (!page2?.continuity.connectionId) throw new Error('page-2 connection fixture missing');
    const traversal = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'traversal' &&
        entry.connectionId === page2.continuity.connectionId,
    );
    const opening = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'opening_clearance' &&
        entry.connectionId === page2.continuity.connectionId,
    );
    if (!traversal || traversal.kind !== 'traversal') {
      throw new Error('traversal fixture missing');
    }
    if (!opening || opening.kind !== 'opening_clearance') {
      throw new Error('opening fixture missing');
    }
    traversal.zoneId = 'zone:castle';
    opening.zoneId = 'zone:castle';
    expect(issueCodes(restamp(bad), fixture.context)).toContain('traversal_infeasible');
  });

  it.each([
    { kind: 'before_transition' as const, endpoint: 'from' as const },
    { kind: 'after_transition' as const, endpoint: 'to' as const },
    { kind: 'threshold' as const, endpoint: 'from' as const },
    { kind: 'threshold' as const, endpoint: 'to' as const },
  ])('accepts $kind support at its authoritative $endpoint endpoint', ({ kind, endpoint }) => {
    const fixture = buildTransitionKindFixture(kind, endpoint);
    const result = validatePreRenderBookVisualBlueprint(
      fixture.blueprint,
      fixture.context,
    );
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('rejects a before-transition frame authored at the destination', () => {
    const fixture = buildTransitionKindFixture('before_transition', 'to');
    const codes = issueCodes(fixture.blueprint, fixture.context);
    expect(codes).toContain('visual_contract_invalid');
  });

  it('rejects opposite-endpoint support with identical geometry for a before-transition frame', () => {
    const fixture = buildTransitionKindFixture('before_transition', 'from');
    const bad = clone(fixture.blueprint);
    for (const affordance of bad.worldPlan.affordances) {
      if (
        (affordance.kind === 'traversal' ||
          affordance.kind === 'opening_clearance') &&
        affordance.connectionId === bad.worldPlan.connections[0].id
      ) {
        affordance.zoneId = 'zone:room';
      }
    }
    const codes = issueCodes(restamp(bad), fixture.context);
    expect(codes).toContain('traversal_infeasible');
  });

  it('represents valid forward and reverse traversal on a bidirectional connection', () => {
    const forwardFixture = buildBlueprintFixture('multi_zone_transition');
    const forward = clone(forwardFixture.blueprint);
    forward.worldPlan.connections[0].bidirectional = true;
    const forwardResult = validatePreRenderBookVisualBlueprint(
      restamp(forward),
      forwardFixture.context,
    );
    expect(
      forwardResult.ok,
      forwardResult.ok ? '' : JSON.stringify(forwardResult.issues, null, 2),
    ).toBe(true);

    const fixture = buildBlueprintFixture('multi_zone_transition');
    const reverse = clone(fixture.blueprint);
    const connection = reverse.worldPlan.connections[0];
    connection.from = { zoneId: 'zone:room' };
    connection.to = { zoneId: 'zone:hall' };
    connection.bidirectional = true;
    const traversal = reverse.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    );
    if (!traversal || traversal.kind !== 'traversal') {
      throw new Error('traversal fixture missing');
    }
    traversal.direction = 'reverse';
    const result = validatePreRenderBookVisualBlueprint(
      restamp(reverse),
      fixture.context,
    );
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('accepts multiple endpoint-pinned traversal authorities on a bidirectional connection', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const blueprint = clone(fixture.blueprint);
    const connection = blueprint.worldPlan.connections[0];
    const existingTraversal = blueprint.worldPlan.affordances.find(
      (entry) => entry.kind === 'traversal',
    );
    if (!existingTraversal || existingTraversal.kind !== 'traversal') {
      throw new Error('traversal fixture missing');
    }
    connection.bidirectional = true;
    connection.traversalAffordanceIds.push('affordance:traversal:2:origin');
    blueprint.worldPlan.affordances.push({
      ...clone(existingTraversal),
      id: 'affordance:traversal:2:origin',
      zoneId: 'zone:hall',
      direction: 'reverse',
    });
    const result = validatePreRenderBookVisualBlueprint(
      restamp(blueprint),
      fixture.context,
    );
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('rejects a traversal whose declared direction cannot serve the authored transition', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const wrongDirection = clone(fixture.blueprint);
    const connection = wrongDirection.worldPlan.connections[0];
    connection.from = { zoneId: 'zone:room' };
    connection.to = { zoneId: 'zone:hall' };
    connection.bidirectional = true;
    const codes = issueCodes(restamp(wrongDirection), fixture.context);
    expect(codes).toContain('transition_invalid');
    expect(codes).toContain('traversal_infeasible');
  });

  it('rejects camera access that cannot see all key actors/actions/props', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const camera = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'camera_access' &&
        entry.consumers.some(
          (consumer) => consumer.kind === 'frame' && consumer.frameId === 'frame:page:2',
        ),
    );
    if (!camera || camera.kind !== 'camera_access') throw new Error('camera fixture missing');
    camera.visibleRegion = { x: 0, y: 250, width: 300, height: 300 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('camera_infeasible');
  });

  it('rejects actor blocking outside the deterministic safe boundary', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    const boundary = bad.worldPlan.affordances.find(
      (entry) => entry.kind === 'safe_boundary',
    );
    if (!boundary || boundary.kind !== 'safe_boundary') throw new Error('safety fixture missing');
    boundary.permittedRegion = { x: 700, y: 250, width: 300, height: 750 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('safety_infeasible');
  });

  it('rejects deterministic text-safe collision with key actor/action/required-prop evidence', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const page2 = bad.frames.find((frame) => frame.id === 'frame:page:2')!;
    const requiredProp = page2.placements.find(
      (placement) => placement.subject.kind === 'prop',
    )!;
    requiredProp.region = { x: 100, y: 100, width: 120, height: 100 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('text_safe_collision');
  });
});

describe('R1D-PVB-A — reveal lifecycle and staleness', () => {
  it('allows explicitly spoiler-neutral supporting geometry before reveal', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const result = validatePreRenderBookVisualBlueprint(fixture.blueprint, fixture.context);
    expect(result.ok).toBe(true);
    expect(
      fixture.blueprint.frames
        .filter((frame) => frame.kind === 'cover' || frame.pageNumber < 2)
        .every((frame) =>
          frame.placements.some(
            (placement) => placement.subject.kind === 'supporting_geometry',
          ),
        ),
    ).toBe(true);
  });

  it('forbids direct depiction or naming of a hidden prop before reveal', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');

    const depicted = clone(fixture.blueprint);
    const page1 = depicted.frames.find((frame) => frame.id === 'frame:page:1')!;
    page1.placements.push({
      id: 'placement:page1:hidden-prop',
      subject: { kind: 'prop', propId: 'prop:hidden_keepsake' },
      region: { x: 560, y: 580, width: 110, height: 100 },
      depth: 'foreground',
      importance: 'supporting',
    });
    expect(issueCodes(restamp(depicted), fixture.context)).toContain('reveal_violation');

    const named = clone(fixture.blueprint);
    named.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary =
      'The child sees the hidden keepsake';
    expect(issueCodes(restamp(named), fixture.context)).toContain('reveal_violation');
  });

  it.each([
    { propName: 'TV', leak: 'The TV waits beside the child' },
    { propName: 'Ax', leak: 'The child notices an Ax nearby' },
    { propName: 'Object', leak: 'The Object waits beside the child' },
    { propName: 'ד', leak: 'הילד רואה ד ליד הדלת' },
    { propName: '桶', leak: '孩子看见桶在门边' },
  ])('detects short Unicode token-exact pre-reveal names: $propName', ({ propName, leak }) => {
    const renamed = renameRevealProp(buildBlueprintFixture('reveal_timeline'), {
      id: `prop:${propName}`,
      name: propName,
    });
    const bad = clone(renamed.blueprint);
    bad.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary = leak;
    expect(issueCodes(restamp(bad), renamed.context)).toContain('reveal_violation');
  });

  it('detects separated and reordered multi-token prop names', () => {
    const renamed = renameRevealProp(buildBlueprintFixture('reveal_timeline'), {
      id: 'prop:red_bucket',
      name: 'Red Bucket',
    });
    const bad = clone(renamed.blueprint);
    bad.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary =
      'The bucket, which is red, waits beyond the child';
    expect(issueCodes(restamp(bad), renamed.context)).toContain('reveal_violation');
  });

  it('keeps reveal matching token-exact instead of matching substrings', () => {
    const renamed = renameRevealProp(buildBlueprintFixture('reveal_timeline'), {
      id: 'prop:ax',
      name: 'Ax',
    });
    const safe = clone(renamed.blueprint);
    safe.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary =
      'The tax and axle stay outside while the child looks at the platform';
    const result = validatePreRenderBookVisualBlueprint(restamp(safe), renamed.context);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('does not flag a partial multi-token name when one exact semantic token is absent', () => {
    const renamed = renameRevealProp(buildBlueprintFixture('reveal_timeline'), {
      id: 'prop:red_bucket',
      name: 'Red Bucket',
    });
    const safe = clone(renamed.blueprint);
    safe.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary =
      'A red scarf rests near a basket while the child looks at the platform';
    const result = validatePreRenderBookVisualBlueprint(restamp(safe), renamed.context);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues, null, 2)).toBe(true);
  });

  it('rejects supporting geometry unless it is explicitly spoiler-neutral', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    bad.worldPlan.revealSafeSupportingGeometry[0].spoilerNeutral = false as true;
    expect(issueCodes(restamp(bad), fixture.context)).toContain('reveal_violation');
  });

  it('rejects neutral-geometry prose that names the future reveal object', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const zone = bad.visualContract.zones[0];
    const node = zone.spatialNodes?.find((entry) => entry.id === 'future_support');
    if (!node) throw new Error('supporting-geometry node missing');
    node.description = 'a platform labeled Hidden keepsake';
    zone.stableGeometry = projectZoneStableGeometry(zone);
    const rebound = rebindEmbeddedAuthority({ blueprint: bad, context: fixture.context });
    const codes = issueCodes(rebound.blueprint, rebound.context);
    expect(codes).toContain('reveal_violation');
    expect(codes).not.toContain('template_stale');
  });

  it('applies separated/reordered token detection identically to neutral geometry prose', () => {
    const fixture = renameRevealProp(buildBlueprintFixture('reveal_timeline'), {
      id: 'prop:red_bucket',
      name: 'Red Bucket',
    });
    const bad = clone(fixture.blueprint);
    const zone = bad.visualContract.zones[0];
    const node = zone.spatialNodes?.find((entry) => entry.id === 'future_support');
    if (!node) throw new Error('supporting-geometry node missing');
    node.description = 'a fixed platform for the bucket, which is painted red';
    zone.stableGeometry = projectZoneStableGeometry(zone);
    const rebound = rebindEmbeddedAuthority({ blueprint: bad, context: fixture.context });
    const codes = issueCodes(rebound.blueprint, rebound.context);
    expect(codes).toContain('reveal_violation');
    expect(codes).not.toContain('template_stale');
  });

  it('becomes stale when the current Story Source, template, or visual package changes', () => {
    const fixture = buildBlueprintFixture('single_location');

    const sourceContext = clone(fixture.context);
    sourceContext.source.digest = 'a'.repeat(64);
    expect(issueCodes(fixture.blueprint, sourceContext)).toContain('source_stale');

    const templateContext = clone(fixture.context);
    templateContext.template.worldType = 'changed_world';
    expect(issueCodes(fixture.blueprint, templateContext)).toContain('template_stale');

    const packageContext = clone(fixture.context);
    packageContext.visualPackage.candidateEvidence.reviewDigest = 'changed-review';
    expect(issueCodes(fixture.blueprint, packageContext)).toContain('package_stale');
  });

  it('provides a fail-closed assertion API', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    bad.digest = 'f'.repeat(64);
    expect(() => assertValidPreRenderBookVisualBlueprint(bad, fixture.context)).toThrow(
      InvalidPreRenderBookVisualBlueprintError,
    );
  });
});
