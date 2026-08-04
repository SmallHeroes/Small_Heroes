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
    propId: null,
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

describe('captured reference-domain matrix', () => {
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
      node.propId = `fixed_architecture_${index + 1}`;
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
});
