import { describe, expect, it, vi } from 'vitest';

import {
  DraftAuthorityReferenceDomainError,
  compileBookVisualContractTemplate,
  compilerOwnedActionCheckId,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { projectPageMustShow } from '../visual-contract-compiler/projectContractProse';
import { buildSourceEvidenceCatalog } from '../visual-contract-compiler/sourceEvidenceCatalog';
import type {
  BookVisualContract,
  PageActionRequirement,
  PageVisualContract,
} from '../visual-contract-compiler/types';
import { RECURRING_PROP_SPATIAL_CONSUMER_SCOPES } from '../visual-contract-compiler/types';

const sourceIdentity = {
  version: 'story-source-identity/v2',
  path: 'fixtures/reference_domain_matrix.md',
  digestAlgorithm: 'normalized-text-sha256',
  digest: 'b'.repeat(64),
  pageCount: 1,
  pageNumbers: [1],
};
const pages = [{
  pageNumber: 1,
  text: 'The hero studies five room features, then repeats a quiet greeting.',
}];
const sourceEvidenceCatalog = buildSourceEvidenceCatalog({
  storyKey: 'reference_domain_matrix',
  sourceIdentity,
  pages,
});
const input: TemplateCompileInput = {
  storyKey: 'reference_domain_matrix',
  pageCount: 1,
  fullStoryText: pages[0]!.text,
  pages,
  childGender: 'female',
  sourceIdentity,
  sourceEvidenceCatalog,
};

function actionBeat(index: number) {
  const beatId = `beat:p1:action_${String(index + 1).padStart(2, '0')}`;
  const spatialId = index < 5 ? `structure_${index + 1}` : null;
  return {
    beatId,
    subject: {
      kind: 'entity' as const,
      entity: { kind: 'cast' as const, id: 'child:hero' },
    },
    predicate: spatialId ? 'looks_at' as const : 'waves' as const,
    object: spatialId
      ? { kind: 'spatial' as const, id: spatialId }
      : null,
    spatialEffect: null,
    polarity: 'must' as const,
    laterality: null,
  };
}

function matrixDraft(): Record<string, unknown> {
  const draftActions = Array.from({ length: 37 }, (_, index) =>
    actionBeat(index));
  const finalActions = draftActions.map(({ beatId, object, spatialEffect, laterality, ...action }) => ({
    ...action,
    checkId: compilerOwnedActionCheckId(1, beatId),
    ...(object ? { object } : {}),
    ...(spatialEffect ? { spatialEffect } : {}),
    ...(laterality ? { laterality } : {}),
  })) as PageActionRequirement[];
  const finalPage: PageVisualContract = {
    pageNumber: 1,
    locationId: 'location:room',
    zoneId: 'zone:room',
    castIds: ['child:hero'],
    characterPresence: { child: true, companion: false },
    mustShow: [],
    mustNotShow: [],
    propState: [],
    propConstraints: [],
    actionRequirements: finalActions,
    camera: 'portrait medium-wide view',
    transition: { kind: 'steady' },
  };
  const nodes = Array.from({ length: 6 }, (_, index) => ({
    id: `structure_${index + 1}`,
    kind: index === 0 ? 'window' : 'wall',
    description: `stable architectural feature ${index + 1}`,
    stablePropId: null,
  }));
  const draft = {
    worldType: 'grounded_room',
    locations: [{
      id: 'location:room',
      name: 'Room',
      description: 'A room with stable architectural features.',
      environmentClass: 'indoor',
      lighting: 'soft daylight',
      timeOfDay: 'day',
      anchors: [],
      topology: null,
      setIdentityId: 'set:room',
      setReference: {
        status: 'pending',
        url: null,
        storageKey: null,
        prompt: null,
      },
    }],
    zones: [{
      id: 'zone:room',
      locationId: 'location:room',
      name: 'Room zone',
      description: 'The exact page zone.',
      stableGeometry: [],
      spatialNodes: [],
      spatialRelations: [],
    }],
    setBoardAuthorities: [{
      setIdentityId: 'set:room',
      locations: [{
        locationId: 'location:room',
        name: 'Room',
        environmentClass: 'indoor',
        timeOfDay: 'day',
        lighting: 'soft daylight',
      }],
      areas: [{
        id: 'area:room',
        locationId: 'location:room',
        zoneProjection: {
          cardinality: 'one_to_one',
          zoneIds: ['zone:room'],
        },
        spatialNodes: nodes,
        spatialRelations: [{
          subjectId: 'structure_6',
          relation: 'centered_in',
        }],
      }],
    }],
    cast: {
      child: {
        id: 'child:hero',
        role: 'child',
        wardrobe: { description: 'simple clothes', forbidden: [] },
      },
      companion: null,
    },
    humanCast: [],
    recurringProps: [],
    forbiddenGlobalElements: [],
    coverContract: {
      worldType: 'grounded_room',
      locationId: 'location:room',
      zoneId: 'zone:room',
      castIds: ['child:hero'],
      timeOfDay: 'day',
      mustShow: [],
      mustNotShow: [],
    },
    pageContracts: [{
      ...finalPage,
      sameLocationAs: null,
      actionRequirements: draftActions,
      actionSemanticCoverage: draftActions.map(({ beatId }) => ({
        beatId,
        sourceEvidenceId: sourceEvidenceCatalog.entries[0]!.sourceEvidenceId,
        disposition: { kind: 'action_requirement' },
      })),
      transition: {
        kind: 'steady',
        fromZoneId: null,
        toZoneId: null,
        cue: null,
      },
    }],
  };
  finalPage.mustShow = projectPageMustShow(
    finalPage,
    draft as unknown as BookVisualContract,
  );
  finalPage.mustShow.splice(
    0,
    5,
    'the child looks at the window',
    'the child looks at the wall',
    'the child looks at the wall',
    'the child looks at the wall',
    'the child looks at the wall',
  );
  draft.pageContracts[0]!.mustShow = finalPage.mustShow;
  return draft;
}

async function compile(draft: unknown) {
  const callLLM = vi.fn(async () => JSON.stringify(draft));
  const result = await compileBookVisualContractTemplate(input, { callLLM });
  return { callLLM, result };
}

async function emittedAuthorityIssues(
  draft: Record<string, unknown>,
) {
  const callLLM = vi.fn(async () => JSON.stringify(draft));
  let failure: unknown;
  try {
    await compileBookVisualContractTemplate(input, { callLLM });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(DraftAuthorityReferenceDomainError);
  expect(callLLM).toHaveBeenCalledTimes(1);
  return (failure as DraftAuthorityReferenceDomainError).issues;
}

function pageRecord(draft: Record<string, unknown>) {
  return (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
}

function actions(draft: Record<string, unknown>) {
  return pageRecord(draft).actionRequirements as Array<
    Record<string, unknown>
  >;
}

function coverage(draft: Record<string, unknown>) {
  return pageRecord(draft).actionSemanticCoverage as Array<
    Record<string, unknown>
  >;
}

function authority(draft: Record<string, unknown>) {
  return (draft.setBoardAuthorities as Array<Record<string, unknown>>)[0]!;
}

function area(draft: Record<string, unknown>) {
  return (authority(draft).areas as Array<Record<string, unknown>>)[0]!;
}

function nodes(draft: Record<string, unknown>) {
  return area(draft).spatialNodes as Array<Record<string, unknown>>;
}

describe('captured reference-domain matrix', () => {
  it('keeps the recurring-prop consumer domain closed to stable Set Board binding and page-frame placement', () => {
    expect(RECURRING_PROP_SPATIAL_CONSUMER_SCOPES).toEqual([
      'stable_set',
      'page_frame',
    ]);
  });

  it('compiles 37 actions, five spatial selections, six architecture nodes, and unary centered_in without repair', async () => {
    const { callLLM, result } = await compile(matrixDraft());
    const page = result.template.pageContracts[0]!;
    const zone = result.template.zones[0]!;
    const authority = result.template.setBoardAuthorities![0]!;

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(page.actionRequirements).toHaveLength(37);
    expect(page.actionRequirements?.filter(
      (action) => action.object?.kind === 'spatial',
    )).toHaveLength(5);
    expect(zone.spatialNodes).toHaveLength(6);
    expect(authority.areas[0]!.spatialNodes).toHaveLength(6);
    expect(authority.fixedObjects).toEqual([]);
    expect(authority.areas[0]!.spatialRelations).toEqual([{
      subjectId: 'structure_6',
      relation: 'centered_in',
    }]);
  });

  it('projects one unique ungated stablePropId into the unchanged final Set Board and zone binding domains', async () => {
    const draft = matrixDraft();
    draft.recurringProps = [{
      id: 'prop:fixed_marker',
      name: 'Fixed marker',
      description: 'one fixed marker integrated into the room',
    }];
    nodes(draft)[0]!.stablePropId = 'prop:fixed_marker';

    const { callLLM, result } = await compile(draft);
    const authority = result.template.setBoardAuthorities![0]!;
    const boundNode = result.template.zones[0]!.spatialNodes![0]!;

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(authority.fixedObjects).toEqual([{
      propId: 'prop:fixed_marker',
      name: 'Fixed marker',
      quantity: 1,
    }]);
    expect(authority.areas[0]!.spatialNodes[0]).toMatchObject({
      id: 'structure_1',
      propId: 'prop:fixed_marker',
    });
    expect(boundNode.bindsTo).toEqual({
      kind: 'prop',
      id: 'prop:fixed_marker',
    });
    expect(JSON.stringify(result.template)).not.toContain('stablePropId');
  });

  it('rejects a new v13 draft that binds the same stablePropId on two nodes', async () => {
    const draft = matrixDraft();
    draft.recurringProps = [{
      id: 'prop:fixed_marker',
      name: 'Fixed marker',
      description: 'one fixed marker integrated into the room',
    }];
    nodes(draft)[0]!.stablePropId = 'prop:fixed_marker';
    nodes(draft)[1]!.stablePropId = 'prop:fixed_marker';

    const issues = await emittedAuthorityIssues(draft);

    expect(issues).toContainEqual({
      code: 'recurring_prop_reference_cardinality_invalid',
      locator: {
        kind: 'set_area_node',
        referenceClass: 'recurring_prop',
        fieldRole: 'spatialNodes.stablePropId',
        authorityIndex: 0,
        areaIndex: 0,
        nodeIndex: 1,
      },
    });
  });

  it('keeps an explicitly required reveal-gated portable prop outside Set Board projection', async () => {
    const draft = matrixDraft();
    draft.recurringProps = [{
      id: 'prop:portable_token',
      name: 'Portable token',
      description: 'one portable token revealed through the page action',
      firstRevealPage: 1,
    }];
    pageRecord(draft).propConstraints = [{
      propId: 'prop:portable_token',
      visibility: 'required',
      anchorId: 'anchor:focus',
    }];
    (pageRecord(draft).mustShow as string[]).unshift('Portable token');
    const cover = draft.coverContract as Record<string, unknown>;
    cover.mustNotShow = [
      'Portable token (first revealed on page 1 â€” no spoiler)',
    ];
    const location = (draft.locations as Array<Record<string, unknown>>)[0]!;
    location.anchors = [{
      id: 'anchor:focus',
      description: 'the exact page placement support',
    }];

    const { result } = await compile(draft);
    const authority = result.template.setBoardAuthorities![0]!;

    expect(authority.fixedObjects).toEqual([]);
    expect(authority.areas.flatMap((entry) => entry.spatialNodes)).not.toContainEqual(
      expect.objectContaining({ propId: 'prop:portable_token' }),
    );
    expect(result.template.zones[0]!.spatialNodes).not.toContainEqual(
      expect.objectContaining({
        bindsTo: { kind: 'prop', id: 'prop:portable_token' },
      }),
    );
    expect(result.template.pageContracts[0]!.propConstraints).toContainEqual({
      propId: 'prop:portable_token',
      visibility: 'required',
      anchorId: 'anchor:focus',
    });
  });

  it('does not create a consumer for a merely permitted gated prop and leaves neutral support geometry unbound', async () => {
    const draft = matrixDraft();
    draft.recurringProps = [{
      id: 'prop:portable_token',
      name: 'Portable token',
      description: 'one portable token available only after its reveal',
      firstRevealPage: 1,
    }];
    const cover = draft.coverContract as Record<string, unknown>;
    cover.mustNotShow = [
      'Portable token (first revealed on page 1 â€” no spoiler)',
    ];
    nodes(draft)[0]!.description =
      'a plain fixed low platform integrated into the room';

    const { result } = await compile(draft);
    const neutralNode = result.template.zones[0]!.spatialNodes![0]!;

    expect(result.template.pageContracts[0]!.propConstraints).toBeUndefined();
    expect(result.template.setBoardAuthorities![0]!.fixedObjects).toEqual([]);
    expect(neutralNode).toMatchObject({
      id: 'structure_1',
      description: 'a plain fixed low platform integrated into the room',
    });
    expect(neutralNode).not.toHaveProperty('bindsTo');
  });

  it('rejects legacy draft spatialNodes.propId fail-closed before repair', async () => {
    const draft = matrixDraft();
    nodes(draft)[0]!.propId = 'prop:legacy';

    const issues = await emittedAuthorityIssues(draft);

    expect(issues).toContainEqual({
      code: 'recurring_prop_reference_type_invalid',
      locator: {
        kind: 'set_area_node',
        referenceClass: 'recurring_prop',
        fieldRole: 'spatialNodes.stablePropId',
        authorityIndex: 0,
        areaIndex: 0,
        nodeIndex: 0,
      },
    });
  });

  it.each([
    {
      expectedCode: 'recurring_prop_lifecycle_gated',
      propId: 'prop:gated',
      prop: {
        id: 'prop:gated',
        name: 'Gated prop',
        description: 'Appears later.',
        firstRevealPage: 1,
      },
      constraint: undefined,
    },
    {
      expectedCode: 'recurring_prop_consumer_forbidden',
      propId: 'prop:forbidden',
      prop: {
        id: 'prop:forbidden',
        name: 'Forbidden prop',
        description: 'Forbidden on the consuming page.',
      },
      constraint: {
        propId: 'prop:forbidden',
        visibility: 'forbidden',
      },
    },
  ])('keeps terminal issue identity $expectedCode on spatialNodes.stablePropId', async ({
    expectedCode,
    propId,
    prop,
    constraint,
  }) => {
    const draft = matrixDraft();
    draft.recurringProps = [prop];
    nodes(draft)[0]!.stablePropId = propId;
    if (constraint) pageRecord(draft).propConstraints = [constraint];

    const issues = await emittedAuthorityIssues(draft);

    expect(issues).toContainEqual({
      code: expectedCode,
      locator: {
        kind: 'set_area_node',
        referenceClass: 'recurring_prop',
        fieldRole: 'spatialNodes.stablePropId',
        authorityIndex: 0,
        areaIndex: 0,
        nodeIndex: 0,
      },
    });
  });

  it('reports all five unknown page-zone spatial selections and spends no repair call', async () => {
    const draft = matrixDraft();
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    for (const [index, action] of (page.actionRequirements as Array<Record<string, unknown>>).entries()) {
      if (index >= 5) break;
      action.object = { kind: 'spatial', id: `outside_zone_${index + 1}` };
    }
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    try {
      await compileBookVisualContractTemplate(input, { callLLM });
      throw new Error('expected exact page-zone authority failure');
    } catch (error) {
      expect(error).toBeInstanceOf(DraftAuthorityReferenceDomainError);
      expect((error as DraftAuthorityReferenceDomainError).issues.filter(
        (issue) =>
          issue.code === 'page_spatial_reference_outside_zone' &&
          issue.locator.kind === 'page_spatial_action' &&
          issue.locator.fieldRole === 'object',
      )).toHaveLength(5);
    }
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('reports six invented recurring-prop bindings plus centered_in arity before repair', async () => {
    const draft = matrixDraft();
    const authority = (draft.setBoardAuthorities as Array<Record<string, unknown>>)[0]!;
    const area = (authority.areas as Array<Record<string, unknown>>)[0]!;
    for (const [index, node] of (area.spatialNodes as Array<Record<string, unknown>>).entries()) {
      node.stablePropId = `fixed_architecture_${index + 1}`;
    }
    area.spatialRelations = [{
      subjectId: 'structure_6',
      relation: 'centered_in',
      objectId: 'structure_1',
    }];
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    try {
      await compileBookVisualContractTemplate(input, { callLLM });
      throw new Error('expected stable authority failure');
    } catch (error) {
      expect(error).toBeInstanceOf(DraftAuthorityReferenceDomainError);
      const issues = (error as DraftAuthorityReferenceDomainError).issues;
      expect(issues.filter((issue) =>
        issue.code === 'recurring_prop_reference_cardinality_invalid',
      )).toHaveLength(6);
      expect(issues.filter((issue) =>
        issue.code === 'unary_relation_object_forbidden',
      )).toHaveLength(1);
    }
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('fails an ambiguous two-area mapping before repair', async () => {
    const draft = matrixDraft();
    const authority = (draft.setBoardAuthorities as Array<Record<string, unknown>>)[0]!;
    const areas = authority.areas as Array<Record<string, unknown>>;
    areas.push({
      ...structuredClone(areas[0]!),
      id: 'area:duplicate',
    });
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    await expect(
      compileBookVisualContractTemplate(input, { callLLM }),
    ).rejects.toBeInstanceOf(DraftAuthorityReferenceDomainError);
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'action_check_id_forbidden',
      (draft: Record<string, unknown>) => {
        actions(draft)[0]!.checkId = 'authored_check';
      },
    ],
    [
      'action_beat_id_outside_page_authority',
      (draft: Record<string, unknown>) => {
        actions(draft)[0]!.beatId = 'beat:p2:wrong_page';
      },
    ],
    [
      'action_beat_binding_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        actions(draft)[1]!.beatId = actions(draft)[0]!.beatId;
      },
    ],
    [
      'coverage_check_id_forbidden',
      (draft: Record<string, unknown>) => {
        const disposition = coverage(draft)[0]!
          .disposition as Record<string, unknown>;
        disposition.checkId = 'authored_check';
      },
    ],
    [
      'coverage_action_binding_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        coverage(draft)[0]!.beatId = 'beat:p1:no_action';
      },
    ],
    [
      'coverage_beat_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        coverage(draft).push(structuredClone(coverage(draft)[0]!));
      },
    ],
    [
      'action_coverage_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        coverage(draft).shift();
      },
    ],
    [
      'unary_relation_object_forbidden',
      (draft: Record<string, unknown>) => {
        const relation = (
          area(draft).spatialRelations as Array<Record<string, unknown>>
        )[0]!;
        relation.objectId = 'structure_1';
      },
    ],
    [
      'binary_relation_object_required',
      (draft: Record<string, unknown>) => {
        area(draft).spatialRelations = [
          { subjectId: 'structure_1', relation: 'left_of' },
        ];
      },
    ],
    [
      'page_zone_id_duplicate',
      (draft: Record<string, unknown>) => {
        const zones = draft.zones as Array<Record<string, unknown>>;
        zones.push(structuredClone(zones[0]!));
      },
    ],
    [
      'set_fixed_objects_forbidden',
      (draft: Record<string, unknown>) => {
        authority(draft).fixedObjects = [];
      },
    ],
    [
      'set_identity_id_duplicate',
      (draft: Record<string, unknown>) => {
        const authorities = draft.setBoardAuthorities as Array<
          Record<string, unknown>
        >;
        authorities.push(structuredClone(authorities[0]!));
      },
    ],
    [
      'recurring_prop_reference_type_invalid',
      (draft: Record<string, unknown>) => {
        nodes(draft)[0]!.stablePropId = 7;
      },
    ],
    [
      'recurring_prop_reference_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        nodes(draft)[0]!.stablePropId = 'prop:missing';
      },
    ],
    [
      'recurring_prop_lifecycle_gated',
      (draft: Record<string, unknown>) => {
        draft.recurringProps = [
          {
            id: 'prop:gated',
            name: 'Gated prop',
            description: 'Appears later.',
            firstRevealPage: 1,
          },
        ];
        nodes(draft)[0]!.stablePropId = 'prop:gated';
      },
    ],
    [
      'recurring_prop_consumer_forbidden',
      (draft: Record<string, unknown>) => {
        draft.recurringProps = [
          {
            id: 'prop:forbidden',
            name: 'Forbidden prop',
            description: 'Forbidden on the page.',
            firstRevealPage: null,
          },
        ];
        nodes(draft)[0]!.stablePropId = 'prop:forbidden';
        pageRecord(draft).propConstraints = [
          { propId: 'prop:forbidden', visibility: 'forbidden' },
        ];
      },
    ],
    [
      'zone_projection_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        const projection = area(draft).zoneProjection as Record<
          string,
          unknown
        >;
        projection.cardinality = 'one_to_many';
      },
    ],
    [
      'zone_projection_duplicate_zone',
      (draft: Record<string, unknown>) => {
        area(draft).zoneProjection = {
          cardinality: 'one_to_many',
          zoneIds: ['zone:room', 'zone:room'],
        };
      },
    ],
    [
      'zone_projection_unknown_zone',
      (draft: Record<string, unknown>) => {
        area(draft).zoneProjection = {
          cardinality: 'one_to_one',
          zoneIds: ['zone:unknown'],
        };
      },
    ],
    [
      'zone_projection_location_mismatch',
      (draft: Record<string, unknown>) => {
        area(draft).locationId = 'location:other';
      },
    ],
    [
      'zone_projection_ambiguous_owner',
      (draft: Record<string, unknown>) => {
        const areas = authority(draft).areas as Array<
          Record<string, unknown>
        >;
        areas.push(structuredClone(areas[0]!));
      },
    ],
    [
      'board_required_zone_unprojected',
      (draft: Record<string, unknown>) => {
        authority(draft).areas = [];
      },
    ],
  ] as const)(
    'emits compiler-owned issue identity %s before repair',
    async (expectedCode, mutate) => {
      const draft = matrixDraft();
      mutate(draft);
      const issues = await emittedAuthorityIssues(draft);
      expect(issues.map((issue) => issue.code)).toContain(expectedCode);
    },
  );

  it('emits both relation locator variants from structural context', async () => {
    const draft = matrixDraft();
    const location = (draft.locations as Array<Record<string, unknown>>)[0]!;
    location.setReference = {
      status: 'none',
      url: null,
      storageKey: null,
      prompt: null,
    };
    draft.setBoardAuthorities = [];
    const zone = (draft.zones as Array<Record<string, unknown>>)[0]!;
    zone.spatialRelations = [
      { subjectId: 'structure_1', relation: 'left_of' },
    ];
    const issues = await emittedAuthorityIssues(draft);
    expect(issues).toContainEqual({
      code: 'binary_relation_object_required',
      locator: {
        kind: 'page_zone_relation',
        referenceClass: 'spatial_relation',
        fieldRole: 'spatialRelations.objectId',
        zoneIndex: 0,
        relationIndex: 0,
      },
    });
  });

  it('emits all five closed page-spatial field roles without authored values', async () => {
    const draft = matrixDraft();
    const pageActions = actions(draft);
    pageActions[0]!.subject = {
      kind: 'entity',
      entity: { kind: 'spatial', id: 'hostile_subject' },
    };
    pageActions[1]!.object = {
      kind: 'spatial',
      id: 'hostile_object',
    };
    pageActions[2]!.spatialEffect = {
      kind: 'relation',
      relation: 'beside',
      target: { kind: 'spatial', id: 'hostile_effect' },
    };
    pageActions[3]!.spatialConstraint = {
      relation: 'beside',
      target: { kind: 'spatial', id: 'hostile_constraint' },
    };
    pageRecord(draft).safetyConstraints = [
      {
        relation: 'beside',
        target: { kind: 'spatial', id: 'hostile_safety' },
      },
    ];
    const issues = await emittedAuthorityIssues(draft);
    expect(
      issues
        .filter(
          (issue) =>
            issue.code === 'page_spatial_reference_outside_zone',
        )
        .map((issue) => issue.locator.fieldRole)
        .sort(),
    ).toEqual([
      'object',
      'safetyConstraints.target',
      'spatialConstraint.target',
      'spatialEffect.target',
      'subject',
    ]);
    expect(JSON.stringify(issues)).not.toMatch(/hostile_/);
  });
});
