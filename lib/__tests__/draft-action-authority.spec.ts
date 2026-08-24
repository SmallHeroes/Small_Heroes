import { describe, expect, it, vi } from 'vitest';

import {
  TemplateRepairOutputInvalidError,
  compileBookVisualContractTemplate,
  compilerOwnedActionCheckId,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { buildSourceEvidenceCatalog } from '../visual-contract-compiler/sourceEvidenceCatalog';
import {
  CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA,
  TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA,
  TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS,
  TEMPLATE_DRAFT_BEAT_ID_PATTERN,
  TEMPLATE_DRAFT_JSON_SCHEMA,
} from '../visual-contract-compiler/templateDraftSchema';
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

  it('rejects a schema-valid coverage beatId from another page before minting action identity', async () => {
    const draft = draftFor(['look']);
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    (
      page.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!.beatId = 'beat:p2:look';
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

  it('restores one exact missing source-phenomenon binding without consuming a repair', async () => {
    const draft = draftFor(['look']);
    const page = (draft.pageContracts as Array<Record<string, unknown>>)[0]!;
    const evidence = sourceEvidenceCatalog.entries[0]!;
    const action = (
      page.actionRequirements as Array<Record<string, unknown>>
    )[0]!;
    action.subject = {
      kind: 'source_phenomenon',
      sourceEvidenceId: evidence.sourceEvidenceId,
    };
    action.predicate = 'touches';
    action.spatialConstraint = null;
    page.actionSemanticCoverage = [];
    const projectionPage = structuredClone(page) as unknown as PageVisualContract;
    projectionPage.actionRequirements = [{
      checkId: 'action:p1_look',
      subject: {
        kind: 'source_phenomenon',
        sourceEvidenceId: evidence.sourceEvidenceId,
        sourcePhrase: evidence.excerpt,
      },
      predicate: 'touches',
      polarity: 'must',
    }];
    page.mustShow = projectPageMustShow(
      projectionPage,
      draft as unknown as BookVisualContract,
    );
    const callLLM = vi.fn(async () => JSON.stringify(draft));

    const result = await compileBookVisualContractTemplate(input, { callLLM });

    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toEqual([]);
    expect(result.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        beatId: 'beat:p1:look',
        sourceEvidenceId: evidence.sourceEvidenceId,
        disposition: {
          kind: 'action_requirement',
          checkId: 'action:p1_look',
        },
      }),
    );
    expect(result.notes).toContain(
      'compiler restored exact missing source-phenomenon action binding on page 1 at action 0',
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

describe('strict bounded-repair authority shapes', () => {
  it('uses one lexical beatId authority for actions and semantic coverage', () => {
    const page = (CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA as any)
      .properties;
    const actionBeatSchemas = page.actionRequirements.items.anyOf.map(
      (branch: any) => branch.properties.beatId,
    );
    const coverageBeatSchema =
      page.actionSemanticCoverage.items.properties.beatId;
    const wholeDraftActionBeatSchema = (
      TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA as any
    ).properties.beatId;

    expect(actionBeatSchemas).not.toHaveLength(0);
    expect(actionBeatSchemas.every(
      (schema: unknown) =>
        JSON.stringify(schema) === JSON.stringify(actionBeatSchemas[0]),
    )).toBe(true);
    const strictBeatDefinition =
      TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS[
        actionBeatSchemas[0].$ref.slice('#/$defs/'.length)
      ];
    expect(strictBeatDefinition).toEqual({
      type: 'string',
      pattern: TEMPLATE_DRAFT_BEAT_ID_PATTERN,
    });
    expect(wholeDraftActionBeatSchema).toEqual(strictBeatDefinition);
    expect(coverageBeatSchema).toEqual(strictBeatDefinition);

    const rootPage = (TEMPLATE_DRAFT_JSON_SCHEMA as any)
      .properties.pageContracts.items.properties;
    expect(rootPage.actionRequirements.items.properties.beatId).toEqual(
      strictBeatDefinition,
    );
    expect(
      rootPage.actionSemanticCoverage.items.properties.beatId,
    ).toEqual(strictBeatDefinition);

    const beatIdPattern = new RegExp(TEMPLATE_DRAFT_BEAT_ID_PATTERN);
    expect(beatIdPattern.test('beat:p1:look')).toBe(true);
    expect(beatIdPattern.test('beat:p12:child_looks')).toBe(true);
    expect(beatIdPattern.test('p1:look')).toBe(false);
    expect(beatIdPattern.test('beat:page1:look')).toBe(false);
    expect(beatIdPattern.test('beat:p1:LOOK')).toBe(false);
    expect(beatIdPattern.test('beat:p1:child-looks')).toBe(false);
  });

  it('authors beatId rather than checkId and encodes relation arity in distinct variants', () => {
    const page = (CATALOG_STRICT_PAGE_CONTRACT_JSON_SCHEMA as any)
      .properties;
    const actionBranches = page.actionRequirements.items.anyOf;
    expect(actionBranches).not.toHaveLength(0);
    for (const branch of actionBranches) {
      expect(branch.properties).toHaveProperty('beatId');
      expect(branch.properties).not.toHaveProperty('checkId');
    }
    const sitsBranch = actionBranches.find(
      (branch: any) => branch.properties.predicate.const === 'sits',
    );
    const definitions =
      TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS;
    const resolve = (schema: any) =>
      typeof schema.$ref === 'string'
        ? definitions[schema.$ref.slice('#/$defs/'.length)]
        : schema;
    const actualSitsBranch = sitsBranch ?? actionBranches.find(
      (branch: any) =>
        branch.properties.predicate.enum.includes('sits'),
    );
    const subjectBranches =
      resolve(actualSitsBranch.properties.subject).anyOf;
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
      resolve(actualSitsBranch.properties.spatialConstraint);
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

    const root = TEMPLATE_DRAFT_JSON_SCHEMA as any;
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
