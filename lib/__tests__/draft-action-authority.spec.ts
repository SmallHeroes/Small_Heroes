import { describe, expect, it, vi } from 'vitest';

import {
  TemplateRepairOutputInvalidError,
  compileBookVisualContractTemplate,
  compilerOwnedActionCheckId,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { buildSourceEvidenceCatalog } from '../visual-contract-compiler/sourceEvidenceCatalog';
import { TEMPLATE_DRAFT_JSON_SCHEMA } from '../visual-contract-compiler/templateDraftSchema';
import { projectPageMustShow } from '../visual-contract-compiler/projectContractProse';
import type {
  BookVisualContract,
  PageActionRequirement,
  PageVisualContract,
} from '../visual-contract-compiler/types';

const sourceIdentity = {
  version: 'story-source-identity/v2',
  path: 'fixtures/domain_authority.md',
  digestAlgorithm: 'normalized-text-sha256',
  digest: 'a'.repeat(64),
  pageCount: 1,
  pageNumbers: [1],
};
const pages = [
  {
    pageNumber: 1,
    text: 'The child looks toward a bright wall and waves with a calm smile.',
  },
];
const sourceEvidenceCatalog = buildSourceEvidenceCatalog({
  storyKey: 'domain_authority_fixture',
  sourceIdentity,
  pages,
});

const input: TemplateCompileInput = {
  storyKey: 'domain_authority_fixture',
  pageCount: 1,
  fullStoryText: pages[0]!.text,
  pages,
  childGender: 'female',
  sourceIdentity,
  sourceEvidenceCatalog,
};

type Beat = 'look' | 'wave';

function actionFor(beat: Beat): Omit<PageActionRequirement, 'checkId'> & {
  beatId: string;
} {
  return beat === 'look'
    ? {
        beatId: 'beat:p1:look',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        spatialEffect: undefined,
        polarity: 'must',
      }
    : {
        beatId: 'beat:p1:wave',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'waves',
        spatialEffect: undefined,
        polarity: 'must',
      };
}

function draftFor(order: Beat[] = ['look', 'wave']): Record<string, unknown> {
  const draftActions = order.map(actionFor);
  const finalActions = draftActions.map(({ beatId, ...action }) => ({
    ...action,
    checkId: compilerOwnedActionCheckId(1, beatId),
  })) as PageActionRequirement[];
  const page: PageVisualContract = {
    pageNumber: 1,
    locationId: 'location:room',
    zoneId: 'zone:wall',
    mustShow: [],
    mustNotShow: [],
    propState: [],
    propConstraints: [],
    actionRequirements: finalActions,
    camera: 'portrait medium-wide view',
    transition: { kind: 'steady' },
    castIds: ['child:hero'],
    characterPresence: { child: true, companion: false },
  };
  const draft = {
    worldType: 'grounded_room',
    locations: [
      {
        id: 'location:room',
        name: 'Room',
        description: 'A calm, bright room.',
        environmentClass: 'indoor',
        lighting: 'soft daylight',
        timeOfDay: 'day',
        anchors: [],
        topology: null,
        setIdentityId: null,
        setReference: {
          status: 'none',
          url: null,
          storageKey: null,
          prompt: null,
        },
      },
    ],
    zones: [
      {
        id: 'zone:wall',
        locationId: 'location:room',
        name: 'Wall area',
        description: 'The bright wall area.',
        stableGeometry: ['one bright wall'],
      },
    ],
    setBoardAuthorities: [],
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
      zoneId: 'zone:wall',
      castIds: ['child:hero'],
      timeOfDay: 'day',
      mustShow: [],
      mustNotShow: [],
    },
    pageContracts: [
      {
        ...page,
        sameLocationAs: null,
        actionRequirements: draftActions.map((action) => ({
          ...action,
          object: null,
          spatialEffect: null,
          laterality: null,
        })),
        actionSemanticCoverage: order.map((beat) => ({
          beatId: `beat:p1:${beat}`,
          sourceEvidenceId:
            sourceEvidenceCatalog.entries[0]!.sourceEvidenceId,
          disposition: { kind: 'action_requirement' },
        })),
        transition: {
          kind: 'steady',
          fromZoneId: null,
          toZoneId: null,
          cue: null,
        },
      },
    ],
  };
  page.mustShow = projectPageMustShow(
    page,
    draft as unknown as BookVisualContract,
  );
  (draft.pageContracts[0] as { mustShow: string[] }).mustShow =
    page.mustShow;
  return draft;
}

async function compileDraft(draft: unknown) {
  const callLLM = vi.fn(async () => JSON.stringify(draft));
  const result = await compileBookVisualContractTemplate(input, {
    callLLM,
  });
  return { callLLM, result };
}

describe('compiler-owned draft action identity', () => {
  it('derives stable checkIds from exact beatIds independent of array order', async () => {
    const first = await compileDraft(draftFor(['look', 'wave']));
    const second = await compileDraft(draftFor(['wave', 'look']));
    const identity = (result: typeof first.result) =>
      Object.fromEntries(
        result.actionSemanticCoverage.map((record) => [
          record.beatId,
          record.disposition.kind === 'action_requirement'
            ? record.disposition.checkId
            : null,
        ]),
      );

    expect(identity(first.result)).toEqual({
      'beat:p1:look': 'action:p1_look',
      'beat:p1:wave': 'action:p1_wave',
    });
    expect(identity(second.result)).toEqual(identity(first.result));
    expect(first.callLLM).toHaveBeenCalledTimes(1);
    expect(second.callLLM).toHaveBeenCalledTimes(1);
  });

  it('routes exact near-miss bindings through one bounded page repair', async () => {
    const draft = draftFor(['look']);
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    (page.actionRequirements as Array<Record<string, unknown>>)[0]!.beatId =
      'beat:p1:look_alt';
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    await expect(
      compileBookVisualContractTemplate(input, { callLLM }),
    ).rejects.toBeInstanceOf(TemplateRepairOutputInvalidError);
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it('normalizes an exact duplicate stable-key component without consuming a repair', async () => {
    const draft = draftFor(['look']);
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    const actions = page.actionRequirements as Array<Record<string, unknown>>;
    actions.push(structuredClone(actions[0]!));
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    const result = await compileBookVisualContractTemplate(input, { callLLM });
    const compiledActions =
      result.template.pageContracts[0]!.actionRequirements!;

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toEqual([]);
    expect(compiledActions).toHaveLength(2);
    expect(compiledActions[0]!.checkId).toBe('action:p1_look');
    expect(compiledActions[1]!.checkId).toMatch(
      /^action:p1_compiler_action_[a-f0-9]{64}$/,
    );
    expect(
      new Set(compiledActions.map((candidate) => candidate.checkId)).size,
    ).toBe(2);
    expect(result.notes).toContain(
      'compiler normalized exact action-binding component on page 1 (2 actions; 1 generated binding)',
    );
  });

  it('normalizes a typed same-page presentation requirement without inventing an action', async () => {
    const draft = draftFor(['look']);
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    const mustShow = page.mustShow as string[];
    (page.actionSemanticCoverage as Array<Record<string, unknown>>).push({
      beatId: 'beat:p1:bright_wall',
      sourceEvidenceId:
        sourceEvidenceCatalog.entries[0]!.sourceEvidenceId,
      disposition: {
        kind: 'presentation_requirement',
        presentationClass: 'lighting_state',
        contractPointer: '/pageContracts/0/mustShow/0',
        contractValue: mustShow[0],
      },
    });

    const { callLLM, result } = await compileDraft(draft);
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.template.pageContracts[0]!.actionRequirements).toHaveLength(1);
    expect(result.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        beatId: 'beat:p1:bright_wall',
        disposition: {
          kind: 'presentation_requirement',
          presentationClass: 'lighting_state',
          contractPointer: '/pageContracts/0/mustShow/0',
          contractValue: mustShow[0],
        },
        reviewState: 'unreviewed',
      }),
    );
  });
});

describe('strict draft authority shapes', () => {
  it('authors beatId rather than checkId and encodes relation arity in distinct variants', () => {
    const root = TEMPLATE_DRAFT_JSON_SCHEMA as any;
    const page = root.properties.pageContracts.items.properties;
    expect(page.actionRequirements.items.properties).toHaveProperty(
      'beatId',
    );
    expect(page.actionRequirements.items.properties).not.toHaveProperty(
      'checkId',
    );
    const subjectBranches =
      page.actionRequirements.items.properties.subject.anyOf;
    const castGroupBranch = subjectBranches.find(
      (branch: any) =>
        branch.properties.kind.const === 'cast_group',
    );
    expect(castGroupBranch.properties.castIds).toMatchObject({
      type: 'array',
      minItems: 2,
      items: { type: 'string' },
    });
    const constraint =
      page.actionRequirements.items.properties.spatialConstraint;
    expect(constraint.anyOf[0].properties.relation.enum).toEqual([
      'beside',
    ]);
    expect(constraint.anyOf[0].required).toEqual([
      'relation',
      'target',
    ]);
    const dispositionBranches =
      page.actionSemanticCoverage.items.properties.disposition.anyOf;
    const actionBranch = dispositionBranches.find(
      (branch: any) =>
        branch.properties.kind.const === 'action_requirement',
    );
    expect(actionBranch.properties).toEqual({
      kind: { type: 'string', const: 'action_requirement' },
    });
    const presentationBranch = dispositionBranches.find(
      (branch: any) =>
        branch.properties.kind.const === 'presentation_requirement',
    );
    expect(presentationBranch.properties.presentationClass.enum).toEqual([
      'static_state',
      'lighting_state',
      'composition_focus',
      'graphic_sound_cue',
      'ambient_event',
    ]);

    const relationBranches =
      root.properties.setBoardAuthorities.items.properties.areas.items
        .properties.spatialRelations.items.anyOf;
    const unary = relationBranches.find(
      (branch: any) => branch.properties.relation.const === 'centered_in',
    );
    const binary = relationBranches.find(
      (branch: any) => Array.isArray(branch.properties.relation.enum),
    );
    expect(unary.properties).not.toHaveProperty('objectId');
    expect(binary.required).toContain('objectId');
  });
});
