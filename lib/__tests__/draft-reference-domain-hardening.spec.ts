import { describe, expect, it, vi } from 'vitest';

import {
  DraftAuthorityReferenceDomainError,
  TemplateRepairExhaustedError,
  compileBookVisualContractTemplate,
  compilerOwnedActionCheckId,
  decodeTemplateRepairUserPrompt,
  isDraftDiagnosticNormalizationRejection,
  pageSpatialReferenceIssuesAreRepairable,
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
import { decodePageContractRepairUserPrompt } from '../visual-contract-compiler/pageContractRepair';

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
    spatialConstraint: null,
    polarity: 'must' as const,
    laterality: null,
  };
}

function matrixDraft(): Record<string, unknown> {
  const draftActions = Array.from({ length: 37 }, (_, index) =>
    actionBeat(index));
  const finalActions = draftActions.map(({ beatId, object, spatialEffect, spatialConstraint, laterality, ...action }) => ({
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
  it('keeps the repairable diagnostic-normalization boundary closed to two internal identities', () => {
    expect(
      isDraftDiagnosticNormalizationRejection(
        new Error('draft validation diagnostic contract invalid'),
      ),
    ).toBe(true);
    expect(
      isDraftDiagnosticNormalizationRejection(
        new Error('draft authority/reference diagnostic contract invalid'),
      ),
    ).toBe(true);
    expect(
      isDraftDiagnosticNormalizationRejection(
        new Error('unexpected local programming error'),
      ),
    ).toBe(false);
    expect(
      isDraftDiagnosticNormalizationRejection(
        'draft validation diagnostic contract invalid',
      ),
    ).toBe(false);
  });
  it('routes an untrusted non-positive page identity through deterministic draft repair instead of a local crash', async () => {
    const invalid = matrixDraft();
    pageRecord(invalid).pageNumber = 0;
    const valid = matrixDraft();
    const callLLM = vi.fn(async () =>
      JSON.stringify(callLLM.mock.calls.length === 1 ? invalid : valid),
    );

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(result.template.pageContracts.map((page) => page.pageNumber)).toEqual([
      1,
    ]);
    expect(result.repairAttempts).toHaveLength(1);
  });

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
        description: 'A portable prop forbidden on this page.',
      },
      constraint: {
        propId: 'prop:forbidden',
        visibility: 'forbidden',
      },
    },
  ])('normalizes $expectedCode on spatialNodes.stablePropId locally without a repair call', async ({
    expectedCode,
    propId,
    prop,
    constraint,
  }) => {
    const draft = matrixDraft();
    draft.recurringProps = [prop];
    nodes(draft)[0]!.stablePropId = propId;
    if (constraint) {
      pageRecord(draft).propConstraints = [constraint];
      pageRecord(draft).mustNotShow = [prop.name];
    }
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    const result = await compileBookVisualContractTemplate(input, { callLLM });

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toEqual([]);
    expect(result.provenance.attempt).toBe(1);
    expect(result.provenance.repairPromptVersion).toBeUndefined();
    expect(result.notes).toContain(
      `compiler normalized non-authoritative stable-prop consumer at setBoardAuthorities[0].areas[0].spatialNodes[0] (${expectedCode})`,
    );
    expect(result.template.setBoardAuthorities?.[0]?.fixedObjects).toEqual([]);
  });

  it('normalizes every closed stable-prop scope target deterministically in one provider call', async () => {
    const draft = matrixDraft();
    draft.recurringProps = [
      {
        id: 'prop:gated-a',
        name: 'Gated prop A',
        description: 'Appears only after its reveal.',
        firstRevealPage: 1,
      },
      {
        id: 'prop:gated-b',
        name: 'Gated prop B',
        description: 'Also appears only after its reveal.',
        firstRevealPage: 1,
      },
    ];
    nodes(draft)[0]!.stablePropId = 'prop:gated-a';
    nodes(draft)[2]!.stablePropId = 'prop:gated-b';
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.provenance.attempt).toBe(1);
    expect(result.repairAttempts).toEqual([]);
    expect(result.notes.filter((note) =>
      note.startsWith('compiler normalized non-authoritative stable-prop consumer'),
    )).toHaveLength(2);
    expect(
      result.template.setBoardAuthorities?.[0]?.fixedObjects,
    ).toEqual([]);
  });

  it('routes only page-zone spatial selection failures through one field-scoped spatial repair', async () => {
    const draft = matrixDraft();
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    for (const [index, action] of (page.actionRequirements as Array<Record<string, unknown>>).entries()) {
      if (index >= 5) break;
      action.object = { kind: 'spatial', id: `outside_zone_${index + 1}` };
    }
    let callIndex = 0;
    let repairUserPrompt = '';
    const callLLM = vi.fn(async (
      _system: string,
      user: string,
      _options?: unknown,
      _authority?: unknown,
    ) => {
      const output =
        callIndex === 0
          ? draft
          : {
              patches: Array.from({ length: 5 }, (_, index) => ({
                pageNumber: 1,
                actionIndex: index,
                fieldRole: 'object',
                spatialReferenceId: `structure_${index + 1}`,
              })),
            };
      if (callIndex === 1) {
        repairUserPrompt = user;
      }
      callIndex += 1;
      return JSON.stringify(output);
    });

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(repairUserPrompt).not.toContain('pageContracts');
    expect(repairUserPrompt).not.toContain('outside_zone_1');
    expect(repairUserPrompt).toContain('"actionIndex":0');
    expect(repairUserPrompt).toContain('"fieldRole":"object"');
    expect(repairUserPrompt).toContain(
      '"permittedSpatialReferences"',
    );
    const repairPayload = JSON.parse(repairUserPrompt) as {
      targets: Array<{
        permittedSpatialReferences: Array<{ id: string }>;
      }>;
    };
    expect(
      repairPayload.targets[0]!.permittedSpatialReferences.some(
        (value) => value.id === 'outside_zone_1',
      ),
    ).toBe(false);
    expect(result.provenance.attempt).toBe(2);
    expect(result.repairAttempts).toEqual([
      expect.objectContaining({
        attempt: 1,
        nextRepairMode: 'page_spatial_reference_patch',
        diagnosticIssues: expect.arrayContaining([
          expect.objectContaining({
            family: 'draft_contract',
            code: 'out_of_scope_reference',
            locator: expect.objectContaining({
              kind: 'page_item',
              collectionRole: 'page_actions',
              pageNumber: 1,
              itemIndex: 0,
            }),
          }),
        ]),
      }),
    ]);
  });

  it('keeps deterministic authority issues terminal before repair', async () => {
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
    const callLLM = vi.fn(async (_system: string, _user: string) =>
      JSON.stringify(draft));

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

  it('rejects mixed typed authority issues from page-spatial repair eligibility', () => {
    const pageSpatial = {
      code: 'page_spatial_reference_outside_zone' as const,
      locator: {
        kind: 'page_spatial_action' as const,
        referenceClass: 'page_spatial_selection' as const,
        fieldRole: 'object' as const,
        pageNumber: 1,
        actionIndex: 0,
      },
    };
    expect(
      pageSpatialReferenceIssuesAreRepairable([pageSpatial]),
    ).toBe(true);
    expect(
      pageSpatialReferenceIssuesAreRepairable([
        pageSpatial,
        {
          code: 'recurring_prop_consumer_forbidden',
          locator: {
            kind: 'set_area_node',
            referenceClass: 'recurring_prop',
            fieldRole: 'spatialNodes.stablePropId',
            authorityIndex: 0,
            areaIndex: 0,
            nodeIndex: 0,
          },
        },
      ]),
    ).toBe(false);
    expect(pageSpatialReferenceIssuesAreRepairable([])).toBe(false);
  });

  it('fails an ambiguous two-area mapping before repair', async () => {
    const draft = matrixDraft();
    const authority = (draft.setBoardAuthorities as Array<Record<string, unknown>>)[0]!;
    const areas = authority.areas as Array<Record<string, unknown>>;
    areas.push({
      ...structuredClone(areas[0]!),
      id: 'area:duplicate',
    });
    const callLLM = vi.fn(async (_system: string, _user: string) =>
      JSON.stringify(draft));

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
      'coverage_check_id_forbidden',
      (draft: Record<string, unknown>) => {
        const disposition = coverage(draft)[0]!
          .disposition as Record<string, unknown>;
        disposition.checkId = 'authored_check';
      },
    ],
    [
      'coverage_beat_cardinality_invalid',
      (draft: Record<string, unknown>) => {
        coverage(draft).push(structuredClone(coverage(draft)[0]!));
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

  it('emits and routes action_coverage_cardinality_invalid through complete-page repair', async () => {
    const invalid = matrixDraft();
    coverage(invalid).shift();
    const validPage = structuredClone(pageRecord(matrixDraft()));
    delete validPage.castIds;
    delete validPage.characterPresence;
    const callLLM = vi.fn(async () =>
      callLLM.mock.calls.length === 1
        ? JSON.stringify(invalid)
        : JSON.stringify({ pageContracts: [validPage] }),
    );

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toMatchObject([
      {
        attempt: 1,
        nextRepairMode: 'page_contract_patch',
        diagnosticIssues: [
          {
            family: 'action_semantic',
            code: 'action_binding_cardinality_invalid',
            locator: {
              kind: 'page_item',
              collectionRole: 'page_actions',
              fieldRole: 'cardinality',
              pageNumber: 1,
              itemIndex: 0,
            },
          },
        ],
      },
    ]);
    expect(result.provenance.attempt).toBe(2);
  });

  it('routes the mixed action beat-binding cardinality family through one complete-page repair', async () => {
    const invalid = matrixDraft();
    const firstAction = structuredClone(actions(invalid)[0]!);
    actions(invalid).push(firstAction);
    const validPage = structuredClone(pageRecord(matrixDraft()));
    delete validPage.castIds;
    delete validPage.characterPresence;
    const callLLM = vi.fn(async () =>
      callLLM.mock.calls.length === 1
        ? JSON.stringify(invalid)
        : JSON.stringify({ pageContracts: [validPage] }),
    );

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toHaveLength(1);
    expect(result.repairAttempts[0]?.nextRepairMode).toBe(
      'page_contract_patch',
    );
    expect(result.repairAttempts[0]?.diagnosticIssues).toHaveLength(3);
    expect(
      result.repairAttempts[0]?.diagnosticIssues.map(
        (issue) =>
          issue.locator.kind === 'page_item'
            ? issue.locator.collectionRole
            : null,
      ),
    ).toEqual([
      'page_actions',
      'page_actions',
      'page_action_semantic_coverage',
    ]);
    expect(result.provenance.attempt).toBe(2);
  });

  it('co-observes action-binding and page-spatial failures and spends one full-draft repair on both', async () => {
    const invalid = matrixDraft();
    coverage(invalid).shift();
    actions(invalid)[0]!.object = {
      kind: 'spatial',
      id: 'outside_current_page_zone',
    };
    const repaired = matrixDraft();
    const repairUserPrompts: string[] = [];
    const callLLM = vi.fn(async (
      _system: string,
      user: string,
      _options?: unknown,
      _authority?: unknown,
    ) => {
      if (callLLM.mock.calls.length === 1) {
        return JSON.stringify(invalid);
      }
      repairUserPrompts.push(user);
      return JSON.stringify(repaired);
    });

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(callLLM.mock.calls[1]![3]).toMatchObject({
      kind: 'repair',
      repairMode: 'full_draft',
    });
    expect(result.repairAttempts).toMatchObject([
      {
        attempt: 1,
        nextRepairMode: 'full_draft',
        diagnosticIssues: expect.arrayContaining([
          {
            family: 'action_semantic',
            code: 'action_binding_cardinality_invalid',
            locator: {
              kind: 'page_item',
              collectionRole: 'page_actions',
              fieldRole: 'cardinality',
              pageNumber: 1,
              itemIndex: 0,
            },
          },
          {
            family: 'draft_contract',
            code: 'out_of_scope_reference',
            locator: {
              kind: 'page_item',
              collectionRole: 'page_actions',
              fieldRole: 'reference',
              pageNumber: 1,
              itemIndex: 0,
            },
          },
        ]),
      },
    ]);
    expect(
      decodeTemplateRepairUserPrompt(
        repairUserPrompts[0]!,
      ).validationIssues,
    ).toEqual(
      expect.arrayContaining(
        [...result.repairAttempts[0]!.diagnosticIssues],
      ),
    );
    expect(result.provenance.attempt).toBe(2);
  });

  it('keeps a compound authority set terminal when it contains any third family', async () => {
    const invalid = matrixDraft();
    coverage(invalid).shift();
    actions(invalid)[0]!.object = {
      kind: 'spatial',
      id: 'outside_current_page_zone',
    };
    const firstNode = nodes(invalid)[0]!;
    firstNode.stablePropId = 17;
    const callLLM = vi.fn(async () => JSON.stringify(invalid));

    await expect(
      compileBookVisualContractTemplate(input, { callLLM }),
    ).rejects.toBeInstanceOf(DraftAuthorityReferenceDomainError);
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('aggregates action binding authority across every affected page before one complete-page repair', async () => {
    const multiPages = [
      {
        pageNumber: 1,
        text: 'The hero studies the room and waves beside the stable wall.',
      },
      {
        pageNumber: 2,
        text: 'The hero crosses the room and looks toward the quiet window.',
      },
    ];
    const multiSourceIdentity = {
      ...sourceIdentity,
      digest: 'c'.repeat(64),
      pageCount: 2,
      pageNumbers: [1, 2],
    };
    const multiCatalog = buildSourceEvidenceCatalog({
      storyKey: 'reference_domain_matrix_two_pages',
      sourceIdentity: multiSourceIdentity,
      pages: multiPages,
    });
    const multiInput: TemplateCompileInput = {
      ...input,
      storyKey: 'reference_domain_matrix_two_pages',
      pageCount: 2,
      fullStoryText: multiPages.map((page) => page.text).join('\n'),
      pages: multiPages,
      sourceIdentity: multiSourceIdentity,
      sourceEvidenceCatalog: multiCatalog,
    };
    const pageFor = (
      pageNumber: number,
      duplicateAction: boolean,
    ): Record<string, unknown> => {
      const page = structuredClone(pageRecord(matrixDraft()));
      page.pageNumber = pageNumber;
      const pageActions = page.actionRequirements as Array<
        Record<string, unknown>
      >;
      const pageCoverage = page.actionSemanticCoverage as Array<
        Record<string, unknown>
      >;
      const evidence = multiCatalog.entries.find(
        (entry) => entry.pageNumber === pageNumber,
      )!;
      for (const action of pageActions) {
        action.beatId = String(action.beatId).replace(
          'beat:p1:',
          `beat:p${pageNumber}:`,
        );
      }
      for (const record of pageCoverage) {
        record.beatId = String(record.beatId).replace(
          'beat:p1:',
          `beat:p${pageNumber}:`,
        );
        record.sourceEvidenceId = evidence.sourceEvidenceId;
      }
      if (duplicateAction) {
        pageActions.push(structuredClone(pageActions[0]!));
      }
      delete page.castIds;
      delete page.characterPresence;
      return page;
    };
    const invalid = matrixDraft();
    invalid.pageContracts = [pageFor(1, true), pageFor(2, true)];
    const repairedPages = [pageFor(1, false), pageFor(2, false)];
    const callLLM = vi.fn(async () =>
      callLLM.mock.calls.length === 1
        ? JSON.stringify(invalid)
        : JSON.stringify({ pageContracts: repairedPages }),
    );

    const result = await compileBookVisualContractTemplate(
      multiInput,
      { callLLM },
    );

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toHaveLength(1);
    expect(result.repairAttempts[0]?.nextRepairMode).toBe(
      'page_contract_patch',
    );
    expect(result.repairAttempts[0]?.diagnosticIssues).toHaveLength(6);
    expect([
      ...new Set(
        result.repairAttempts[0]?.diagnosticIssues.flatMap((issue) =>
          'pageNumber' in issue.locator
            ? [issue.locator.pageNumber]
            : [],
        ),
      ),
    ]).toEqual([1, 2]);
    expect(result.template.pageContracts).toHaveLength(2);
    expect(result.provenance.attempt).toBe(2);
  });

  it('uses one complete-page repair for presentation gaps and final structure after a spatial repair', async () => {
    const invalid = matrixDraft();
    actions(invalid)[0]!.object = {
      kind: 'spatial',
      id: 'outside_current_page_zone',
    };
    pageRecord(invalid).camera = '';
    coverage(invalid).push({
      beatId: 'beat:p1:presentation_gap',
      sourceEvidenceId:
        sourceEvidenceCatalog.entries[0]!.sourceEvidenceId,
      disposition: {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      },
    });

    const repairedPage = structuredClone(pageRecord(matrixDraft()));
    repairedPage.actionSemanticCoverage = [
      ...(repairedPage.actionSemanticCoverage as Array<
        Record<string, unknown>
      >),
      {
        beatId: 'beat:p1:presentation_gap',
        sourceEvidenceId:
          sourceEvidenceCatalog.entries[0]!.sourceEvidenceId,
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'composition_focus',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: (repairedPage.mustShow as string[])[0],
        },
      },
    ];
    delete repairedPage.castIds;
    delete repairedPage.characterPresence;

    let callIndex = 0;
    const authorities: unknown[] = [];
    const userPrompts: string[] = [];
    const callLLM = vi.fn(async (
      _system: string,
      user: string,
      _options?: unknown,
      authority?: unknown,
    ) => {
      authorities.push(authority);
      userPrompts.push(user);
      const output =
        callIndex === 0
          ? invalid
          : callIndex === 1
            ? {
                patches: [
                  {
                    pageNumber: 1,
                    actionIndex: 0,
                    fieldRole: 'object',
                    spatialReferenceId: 'structure_1',
                  },
                ],
              }
            : { pageContracts: [repairedPage] };
      callIndex += 1;
      return JSON.stringify(output);
    });

    const result = await compileBookVisualContractTemplate(input, {
      callLLM,
    });

    expect(callLLM).toHaveBeenCalledTimes(3);
    expect(authorities).toEqual([
      expect.objectContaining({ kind: 'initial' }),
      expect.objectContaining({
        kind: 'repair',
        repairMode: 'page_spatial_reference_patch',
      }),
      expect.objectContaining({
        kind: 'repair',
        repairMode: 'page_contract_patch',
      }),
    ]);
    const encoded = JSON.parse(userPrompts[2]!) as Record<
      string,
      unknown
    >;
    expect(encoded).toHaveProperty('encodingVersion');
    const combined = decodePageContractRepairUserPrompt(
      userPrompts[2]!,
    );
    expect(combined.affectedPages).toHaveLength(1);
    expect(combined.affectedPages[0]!.repairTargets).toEqual([
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        pageNumber: 1,
      },
      expect.objectContaining({
        family: 'action_semantic',
        code: 'closed_catalog_capability_gap',
        pageNumber: 1,
        coverageIndex: 37,
        beatId: 'beat:p1:presentation_gap',
        permittedPointerValues: expect.arrayContaining([
          expect.objectContaining({
            contractPointer: '/pageContracts/0/mustShow/0',
          }),
        ]),
      }),
    ]);
    expect(combined.affectedPages[0]!.validationHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('camera'),
        expect.stringContaining('closed_catalog_capability_gap'),
      ]),
    );
    expect(result.repairAttempts).toHaveLength(2);
    expect(
      result.repairAttempts.map((attempt) =>
        attempt.nextRepairMode,
      ),
    ).toEqual([
      'page_spatial_reference_patch',
      'page_contract_patch',
    ]);
    expect(result.provenance.attempt).toBe(3);
    expect(
      result.actionSemanticCoverage.find(
        (record) => record.beatId === 'beat:p1:presentation_gap',
      )?.disposition,
    ).toMatchObject({
      kind: 'presentation_requirement',
      presentationClass: 'composition_focus',
    });
  });

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

  it('routes all currently reachable draft-page spatial field roles with typed compact targets and closed authority', async () => {
    const draft = matrixDraft();
    const pageActions = actions(draft);
    pageActions[1]!.object = {
      kind: 'spatial',
      id: 'hostile_object',
    };
    pageActions[2]!.predicate = 'moves';
    pageActions[2]!.spatialEffect = {
      kind: 'relation',
      relation: 'toward',
      target: { kind: 'spatial', id: 'hostile_effect' },
    };
    pageActions[3]!.predicate = 'sits';
    pageActions[3]!.object = null;
    pageActions[3]!.spatialConstraint = {
      relation: 'beside',
      target: { kind: 'spatial', id: 'hostile_constraint' },
    };
    const repairPage = structuredClone(pageRecord(draft));
    delete repairPage.castIds;
    delete repairPage.characterPresence;
    let callIndex = 0;
    const callLLM = vi.fn(async (
      _system: string,
      user: string,
      _options?: unknown,
      _authority?: unknown,
    ) => {
      const repairInput =
        callIndex !== 1
          ? null
          : (JSON.parse(user) as {
              targets: Array<{
                pageNumber: number;
                actionIndex: number;
                fieldRole: string;
                permittedSpatialReferences: Array<{ id: string }>;
              }>;
            });
      const output =
        callIndex === 0
          ? draft
          : callIndex === 1
            ? {
              patches: repairInput!.targets.map((target) => ({
                pageNumber: target.pageNumber,
                actionIndex: target.actionIndex,
                fieldRole: target.fieldRole,
                spatialReferenceId:
                  target.permittedSpatialReferences[0]!.id,
              })),
              }
            : { pageContracts: [repairPage] };
      callIndex += 1;
      return JSON.stringify(output);
    });
    await expect(
      compileBookVisualContractTemplate(input, { callLLM }),
    ).rejects.toBeInstanceOf(TemplateRepairExhaustedError);
    expect(callLLM).toHaveBeenCalledTimes(3);
    const repairPrompt = String(callLLM.mock.calls[1]![1]);
    expect(repairPrompt).not.toContain('"fieldRole":"subject"');
    expect(repairPrompt).toContain(
      '"actionIndex":1,"fieldRole":"object"',
    );
    expect(repairPrompt).toContain(
      '"actionIndex":2,"fieldRole":"spatialEffect.target"',
    );
    expect(repairPrompt).toContain(
      '"actionIndex":3,"fieldRole":"spatialConstraint.target"',
    );
    const payload = JSON.parse(repairPrompt) as {
      targets: Array<{
        permittedSpatialReferences: Array<{ id: string }>;
      }>;
    };
    expect(
      payload.targets[0]!.permittedSpatialReferences.map(
        (value) => value.id,
      ),
    ).toEqual([
      'structure_1',
      'structure_2',
      'structure_3',
      'structure_4',
      'structure_5',
      'structure_6',
    ]);
    expect(
      JSON.stringify(
        payload.targets[0]!.permittedSpatialReferences,
      ),
    ).not.toMatch(/hostile_/);
    expect(callLLM.mock.calls[1]![3]).toMatchObject({
      kind: 'repair',
      repairMode: 'page_spatial_reference_patch',
    });
    expect(callLLM.mock.calls[2]![3]).toMatchObject({
      kind: 'repair',
      repairMode: 'page_contract_patch',
    });
  });

  it('keeps final-only safety spatial fields on the legacy full-draft route', async () => {
    const draft = matrixDraft();
    pageRecord(draft).safetyConstraints = [
      {
        relation: 'beside',
        target: { kind: 'spatial', id: 'hostile_safety' },
      },
    ];
    const callLLM = vi.fn(async (_system: string, _user: string) =>
      JSON.stringify(draft));
    await expect(
      compileBookVisualContractTemplate(input, { callLLM }),
    ).rejects.toBeInstanceOf(TemplateRepairExhaustedError);
    expect(callLLM).toHaveBeenCalledTimes(3);
    expect(
      decodeTemplateRepairUserPrompt(
        String(callLLM.mock.calls[1]![1]),
      ).validationIssues,
    ).toContainEqual({
      family: 'draft_contract',
      code: 'out_of_scope_reference',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_safety_constraints',
        fieldRole: 'reference',
        pageNumber: 1,
        itemIndex: 0,
      },
    });
  });
});
