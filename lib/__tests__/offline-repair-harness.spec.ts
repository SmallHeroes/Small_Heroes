import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  classifyOfflineRepairDelta,
  runOfflineRepairHarness,
} from '../visual-contract-compiler/offlineRepairHarness';
import {
  compileBookVisualContractTemplate,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import type { DraftValidationIssue } from '../visual-contract-compiler/draftValidationDiagnostics';
import {
  projectPageMustShow,
  projectZoneStableGeometry,
} from '../visual-contract-compiler/projectContractProse';
import type {
  BookVisualContract,
  PageVisualContract,
  VisualZone,
} from '../visual-contract-compiler/types';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';

const BANK = path.join(process.cwd(), 'story-bank/v3-approved');

function bunnySource(): TemplateCompileInput {
  return extractSourceFromMarkdown(
    'bunny_ometz_adventure',
    fs.readFileSync(
      path.join(BANK, 'bunny_ometz_adventure.md'),
      'utf8',
    ),
  ) as TemplateCompileInput;
}

function bunnyDraft(): Record<string, unknown> & {
  pageContracts: Array<Record<string, unknown>>;
  zones: Array<Record<string, unknown> & { id: string }>;
} {
  const source = bunnySource();
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(
        BANK,
        'bunny_ometz_adventure.visual-contract-template.json',
      ),
      'utf8',
    ),
  ) as Record<string, unknown> & {
    recurringProps: Array<Record<string, unknown>>;
    pageContracts: Array<Record<string, unknown>>;
    zones: Array<Record<string, unknown> & { id: string }>;
  };
  for (const prop of draft.recurringProps) {
    prop.firstRevealPage ??= null;
  }
  return withCurrentActionSemanticCoverage({
    draft,
    pages: source.pages,
    sourceEvidenceCatalog: source.sourceEvidenceCatalog,
  });
}

const WORLD_TYPE_MISSING = {
  family: 'draft_contract',
  code: 'world_type_missing',
  locator: { kind: 'root', fieldRole: 'world_type' },
} satisfies DraftValidationIssue;

const PAGE_STEERING_INVALID = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: {
    kind: 'page',
    fieldRole: 'final_structure',
    pageNumber: 1,
  },
  causes: ['page_steering_invalid'],
} satisfies DraftValidationIssue;

const CAPABILITY_GAP = {
  family: 'action_semantic',
  code: 'closed_catalog_capability_gap',
  locator: {
    kind: 'page_item',
    collectionRole: 'page_action_semantic_coverage',
    fieldRole: 'disposition',
    pageNumber: 1,
    itemIndex: 0,
  },
} satisfies DraftValidationIssue;

const CAPABILITY_COVERAGE_MISSING = {
  family: 'action_semantic',
  code: 'coverage_missing',
  locator: {
    kind: 'page',
    fieldRole: 'coverage',
    pageNumber: 1,
  },
} satisfies DraftValidationIssue;

const CONTINUITY_AUTHORITY_INVALID = {
  family: 'draft_contract',
  code: 'continuity_authority_invalid',
  locator: { kind: 'root', fieldRole: 'authority' },
} satisfies DraftValidationIssue;

const BEAT_ID_OUT_OF_SCOPE = {
  family: 'action_semantic',
  code: 'beat_identity_out_of_scope',
  locator: {
    kind: 'page_item',
    collectionRole: 'page_action_semantic_coverage',
    fieldRole: 'identity',
    pageNumber: 1,
    itemIndex: 0,
  },
} satisfies DraftValidationIssue;

const PAGE_ACTION_REQUIREMENTS_INVALID = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: {
    kind: 'page',
    fieldRole: 'final_structure',
    pageNumber: 1,
  },
  causes: ['page_action_requirements_invalid'],
} satisfies DraftValidationIssue;

describe('offline Visual Contract repair harness', () => {
  it('compiler-binds exact initial selectors, eliminates the historical pointer family, and reaches Candidate without provider or repair', async () => {
    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: bunnyDraft(),
      completeDiagnosticIssuesByAttempt: [[]],
    });

    expect(result.executionMode).toBe('offline_stub');
    expect(result.providerCalls).toBe(0);
    expect(result.outcome).toBe('candidate');
    expect(result.calls).toEqual([
      expect.objectContaining({
        call: 1,
        kind: 'initial',
        repairMode: null,
      }),
    ]);
    expect(result.actionCoverageCensuses).toHaveLength(1);
    expect(result.actionCoverageCensuses[0]).toMatchObject({
      call: 1,
      repairMode: null,
    });
    expect(result.actionCoverageCensuses[0]!.records).toHaveLength(
      bunnySource().pages.length,
    );
    expect(result.actionCoverageCensuses[0]!.records[0]).toMatchObject({
      pageNumber: 1,
      coverageIndex: 0,
      dispositionKind: 'represented_elsewhere',
      matchingActionIndexes: [],
    });
    expect(result.actionCoverageCensuses[0]!.records[0]!.attemptedPredicates)
      .toEqual([]);
    expect(JSON.stringify(result.actionCoverageCensuses)).not.toMatch(
      /sourcePhrase|contractValue|systemPrompt|userPrompt|rawResponse/i,
    );
    expect(result.stages).toEqual([
      expect.objectContaining({
        attempt: 1,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        classification: 'baseline',
      }),
    ]);
    expect(result.monotonicCompleteIssueDelta).toBe(true);
    expect(result.maxPositiveCompleteIssueDelta).toBe(0);
    expect(JSON.stringify(result.stages)).not.toMatch(
      /represented_elsewhere_pointer_(?:out_of_scope|unresolved)/,
    );
  });

  it('closes an exact missing source-phenomenon binding before routing and spends no repair slot', async () => {
    const source = bunnySource();
    const draft = bunnyDraft();
    const page = draft.pageContracts[0]!;
    const evidence = source.sourceEvidenceCatalog.entries.find(
      (entry) => entry.pageNumber === page.pageNumber,
    );
    if (!evidence) throw new Error('offline_harness_source_evidence_missing');
    const beatId = `beat:p${page.pageNumber}:offline_source_event`;
    const rawAction = {
      beatId,
      subject: {
        kind: 'source_phenomenon',
        sourceEvidenceId: evidence.sourceEvidenceId,
      },
      predicate: 'touches',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'must',
      laterality: null,
    };
    page.actionRequirements ??= [];
    (page.actionRequirements as Array<Record<string, unknown>>).push(rawAction);
    const projectionPage = structuredClone(page) as unknown as PageVisualContract;
    projectionPage.actionRequirements = [{
      checkId: `action:p${page.pageNumber}_offline_source_event`,
      subject: {
        kind: 'source_phenomenon',
        sourceEvidenceId: evidence.sourceEvidenceId,
        sourcePhrase: evidence.excerpt,
      },
      predicate: 'touches',
      polarity: 'must',
    }];
    const [projection] = projectPageMustShow(
      projectionPage,
      draft as unknown as BookVisualContract,
    );
    if (!projection) throw new Error('offline_harness_projection_missing');
    (page.mustShow as string[]).push(projection);

    const result = await runOfflineRepairHarness({
      input: source,
      initialDraft: draft,
      completeDiagnosticIssuesByAttempt: [[]],
    });

    expect(result.outcome).toBe('candidate');
    expect(result.calls.map((call) => call.repairMode)).toEqual([null]);
    expect(result.stages).toEqual([
      expect.objectContaining({
        attempt: 1,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
      }),
    ]);
    expect(result.monotonicCompleteIssueDelta).toBe(true);
  });

  it('replays an injected full-draft repair and reports exact issue delta', async () => {
    const invalid = bunnyDraft();
    invalid.worldType = '';
    const input = bunnySource();
    delete (input as unknown as Record<string, unknown>).worldType;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: invalid,
      repairResponses: [bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [WORLD_TYPE_MISSING],
        [],
      ],
    });

    expect(result.outcome).toBe('candidate');
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(
      result.actionCoverageCensuses.map((census) => census.repairMode),
    ).toEqual([null, 'full_draft']);
    expect(result.stages.map((stage) => ({
      surfaced: stage.surfacedIssueCount,
      complete: stage.completeIssueCount,
      delta: stage.completeDelta,
      classification: stage.classification,
    }))).toEqual([
      {
        surfaced: 3,
        complete: 1,
        delta: null,
        classification: 'baseline',
      },
      {
        surfaced: 0,
        complete: 0,
        delta: -1,
        classification: 'improved',
      },
    ]);
    expect(result.monotonicCompleteIssueDelta).toBe(true);
  });

  it('closes a historical free-form coverage beatId and its structural consequence offline with delta 2 to 0', async () => {
    const invalid = bunnyDraft();
    const repaired = bunnyDraft();
    const invalidPage = invalid.pageContracts[0]!;
    const repairedPage = repaired.pageContracts[0]!;
    const repairedCoverage = (
      repairedPage.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!;
    const sourceEvidenceId = repairedCoverage.sourceEvidenceId;
    if (typeof sourceEvidenceId !== 'string') {
      throw new Error('offline_harness_source_evidence_missing');
    }
    const validBeatId = 'beat:p1:offline_look';
    repairedPage.actionRequirements = [{
      beatId: validBeatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'waves',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'must',
      laterality: null,
    }];
    repairedCoverage.beatId = validBeatId;
    repairedCoverage.disposition = { kind: 'action_requirement' };
    const projectionPage = structuredClone(
      repairedPage,
    ) as unknown as PageVisualContract;
    projectionPage.actionRequirements = [{
      checkId: 'action:p1_offline_look',
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'waves',
      polarity: 'must',
    }];
    const [actionProjection] = projectPageMustShow(
      projectionPage,
      repaired as unknown as BookVisualContract,
    );
    if (!actionProjection) {
      throw new Error('offline_harness_action_projection_missing');
    }
    (repairedPage.mustShow as string[]).push(actionProjection);
    (
      invalidPage.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!.beatId = 'p1_offline_look';

    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: invalid,
      repairResponses: [repaired],
      completeDiagnosticIssuesByAttempt: [
        [BEAT_ID_OUT_OF_SCOPE, PAGE_ACTION_REQUIREMENTS_INVALID],
        [],
      ],
    });

    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'candidate',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 0,
    });
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(result.stages.map((stage) => ({
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
      classification: stage.classification,
    }))).toEqual([
      {
        completeIssueCount: 2,
        completeDelta: null,
        classification: 'baseline',
      },
      {
        completeIssueCount: 0,
        completeDelta: -2,
        classification: 'improved',
      },
    ]);
    expect(result.actionCoverageCensuses[1]!.records[0]).toMatchObject({
      pageNumber: 1,
      beatId: validBeatId,
      dispositionKind: 'action_requirement',
      matchingActionIndexes: [0],
      attemptedPredicates: ['waves'],
    });

    const compiled = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: async () => JSON.stringify(repaired),
    });
    expect(compiled.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        pageNumber: 1,
        beatId: validBeatId,
        sourceEvidenceId,
        disposition: {
          kind: 'action_requirement',
          checkId: 'action:p1_offline_look',
        },
      }),
    );
  });

  it('repairs an accepted typed wardrobe transition through full_draft without a provider call', async () => {
    const input = bunnySource();
    input.continuityIntent = {
      version: 'small-heroes-story-visual-continuity-intent/v1',
      childWardrobeAuthority: 'frozen_visual_contract',
      childWardrobeTransitionPages: [12],
      companionAccessoryAuthority: 'canonical_companion_profile',
      companionAppearanceAuthority: 'frozen_companion_state',
      companionStateTransitionPages: [],
    };
    const invalid = bunnyDraft();
    const repaired = bunnyDraft();
    const repairedPage = repaired.pageContracts.find(
      (page) => page.pageNumber === 12,
    );
    const evidence = input.sourceEvidenceCatalog.entries.find(
      (entry) => entry.pageNumber === 12,
    );
    if (!repairedPage || !evidence) {
      throw new Error('offline_harness_wardrobe_fixture_missing');
    }
    repairedPage.childWardrobeOverrideDescription =
      'soft sky-blue cotton pajamas for bedtime';
    repairedPage.childWardrobeOverrideSourceEvidenceId =
      evidence.sourceEvidenceId;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: invalid,
      repairResponses: [repaired],
      completeDiagnosticIssuesByAttempt: [
        [CONTINUITY_AUTHORITY_INVALID],
        [],
      ],
    });

    expect(result.outcome).toBe('candidate');
    expect(result.providerCalls).toBe(0);
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(result.stages.map((stage) => ({
      complete: stage.completeIssueCount,
      delta: stage.completeDelta,
      classification: stage.classification,
    }))).toEqual([
      { complete: 1, delta: null, classification: 'baseline' },
      { complete: 0, delta: -1, classification: 'improved' },
    ]);
    expect(result.monotonicCompleteIssueDelta).toBe(true);

    const compiled = await compileBookVisualContractTemplate(input, {
      callLLM: async () => JSON.stringify(repaired),
    });
    expect(
      compiled.template.pageContracts.find(
        (page) => page.pageNumber === 12,
      )?.childWardrobeOverride,
    ).toEqual({
      description: 'soft sky-blue cotton pajamas for bedtime',
      origin: {
        kind: 'story_evidence',
        page: 12,
        phrase: evidence.excerpt,
      },
    });
    expect(
      compiled.template.cast.companion?.wardrobe.description,
    ).toContain('tiny heart-shaped badge pinned to the chest');
  });

  it('distinguishes unmasking from genuine repair damage using the complete census', async () => {
    expect(classifyOfflineRepairDelta({
      surfacedDelta: 11,
      completeDelta: -1,
    })).toBe('improved_with_unmasking');
    expect(classifyOfflineRepairDelta({
      surfacedDelta: 11,
      completeDelta: 0,
    })).toBe('unmasking');
    expect(classifyOfflineRepairDelta({
      surfacedDelta: -1,
      completeDelta: 1,
    })).toBe('destructive');

    const invalid = bunnyDraft();
    invalid.worldType = '';
    const input = bunnySource();
    delete (input as unknown as Record<string, unknown>).worldType;
    const stillInvalid = structuredClone(invalid);
    (stillInvalid.pageContracts[0] as Record<string, unknown>).camera = '';

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: invalid,
      repairResponses: [stillInvalid, bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [WORLD_TYPE_MISSING],
        [WORLD_TYPE_MISSING, PAGE_STEERING_INVALID],
        [],
      ],
    });

    expect(result.outcome).toBe('repair_regressed');
    expect(result.calls).toHaveLength(2);
    expect(result.stages).toHaveLength(2);
    expect(result.monotonicCompleteIssueDelta).toBe(false);
    expect(result.maxPositiveCompleteIssueDelta).toBe(1);
    expect(result.stages[1]).toEqual(
      expect.objectContaining({
        completeDelta: 1,
        classification: 'destructive',
      }),
    );
  });

  it('reports an exact complete fixed point after one repair without reaching a provider or a third stub call', async () => {
    const fixedPoint = bunnyDraft();
    fixedPoint.worldType = '';
    const input = bunnySource();
    delete (input as unknown as Record<string, unknown>).worldType;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: fixedPoint,
      repairResponses: [structuredClone(fixedPoint), bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [WORLD_TYPE_MISSING],
        [WORLD_TYPE_MISSING],
      ],
    });

    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'repair_stagnated',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 1,
    });
    expect(result.calls).toHaveLength(2);
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(result.stages).toHaveLength(2);
    expect(result.stages[1]).toEqual(expect.objectContaining({
      completeDelta: 0,
      classification: 'stable',
    }));
  });

  it('defers one represented-elsewhere residual behind atomic BookSurface and closes it without issue growth', async () => {
    const initial = bunnyDraft();
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    const page1 = initial.pageContracts[0]!;
    const page2 = initial.pageContracts[1]!;
    const validCamera = page1.camera;
    const capabilityCoverage = (
      page1.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!;
    page1.actionRequirements = [];
    capabilityCoverage.disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };
    page1.camera = '';

    const page2Coverage = page2.actionSemanticCoverage as Array<
      Record<string, unknown>
    >;
    const sourceRecord = page2Coverage[0]!;
    const representedCoverageIndex = 0;
    sourceRecord.disposition = {
      kind: 'represented_elsewhere',
      representedValue: 'outside the current page',
    };
    const actionBeatId = 'beat:p2:offline_invalid_action';
    page2.actionRequirements = [{
      beatId: actionBeatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'flies_over',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'must',
      laterality: null,
    }];
    page2Coverage.push({
      beatId: actionBeatId,
      sourceEvidenceId: sourceRecord.sourceEvidenceId,
      disposition: {
        kind: 'action_requirement',
      },
    });

    const repairedPage2Action = {
      beatId: actionBeatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'looks_at',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'must',
      laterality: null,
    };

    const bookSurfaceResponse = {
      presentationPatches: [{
        pageNumber: 1,
        coverageIndex: 0,
        beatId: capabilityCoverage.beatId,
        sourceEvidenceId: capabilityCoverage.sourceEvidenceId,
        presentationClass: 'composition_focus',
        pointerChoiceIndex: 0,
      }],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [
        {
          pageNumber: 1,
          locationId: null,
          zoneId: null,
          sameLocationAs: null,
          mustShow: null,
          mustNotShow: structuredClone(page1.mustNotShow),
          propState: null,
          propConstraints: null,
          actionRequirements: null,
          camera: validCamera,
          transition: null,
        },
        {
          pageNumber: 2,
          locationId: null,
          zoneId: null,
          sameLocationAs: null,
          mustShow: null,
          mustNotShow: null,
          propState: null,
          propConstraints: null,
          actionRequirements: [repairedPage2Action],
          camera: null,
          transition: null,
        },
      ],
    };
    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: initial,
      repairResponses: [
        bookSurfaceResponse,
        {
          patches: [{
            pageNumber: 2,
            coverageIndex: representedCoverageIndex,
            beatId: sourceRecord.beatId,
            sourceEvidenceId: sourceRecord.sourceEvidenceId,
            pointerChoiceIndex: 0,
          }],
        },
      ],
      completeDiagnosticIssuesByAttempt: [
        [
          CAPABILITY_GAP,
          CAPABILITY_COVERAGE_MISSING,
          PAGE_STEERING_INVALID,
          {
            family: 'draft_contract',
            code: 'final_structural_invariant_invalid',
            locator: {
              kind: 'page',
              fieldRole: 'final_structure',
              pageNumber: 2,
            },
            causes: ['page_action_requirements_invalid'],
          },
          {
            family: 'action_semantic',
            code: 'represented_elsewhere_pointer_out_of_scope',
            locator: {
              kind: 'page_item',
              collectionRole: 'page_action_semantic_coverage',
              fieldRole: 'reference',
              pageNumber: 2,
              itemIndex: 1,
            },
          },
        ],
        [{
          family: 'action_semantic',
          code: 'represented_elsewhere_pointer_out_of_scope',
          locator: {
            kind: 'page_item',
            collectionRole: 'page_action_semantic_coverage',
            fieldRole: 'reference',
            pageNumber: 2,
            itemIndex: 1,
          },
        }],
        [],
      ],
    });

    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
      'represented_elsewhere_patch',
    ]);
    expect(result.outcome).toBe('candidate');
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      surfacedIssueCount: stage.surfacedIssueCount,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
    }))).toEqual([
      {
        nextRepairMode: 'book_surface_patch',
        surfacedIssueCount: 5,
        completeIssueCount: 5,
        completeDelta: null,
      },
      {
        nextRepairMode: 'represented_elsewhere_patch',
        surfacedIssueCount: 1,
        completeIssueCount: 1,
        completeDelta: -4,
      },
      {
        nextRepairMode: null,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        completeDelta: -1,
      },
    ]);
    expect(result.monotonicCompleteIssueDelta).toBe(true);
    expect(result.maxPositiveCompleteIssueDelta).toBe(0);
    expect(result.providerCalls).toBe(0);
  });

  it('routes a real surfaced 19-to-6-to-5 frontier while replaying the independent complete census', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }

    const representedPages = initial.pageContracts.slice(0, 5);
    const structuralPages = initial.pageContracts.slice(0, 8);
    const capabilityPages = initial.pageContracts.slice(5, 11);
    const capabilityPageNumbers = new Set(
      capabilityPages.map((page) => page.pageNumber),
    );
    const validOpeningTransition = structuredClone(
      valid.pageContracts[0]!.transition,
    );
    const openingZoneId = initial.pageContracts[0]!.zoneId;
    const distantZoneId = initial.pageContracts[4]!.zoneId;
    expect(typeof openingZoneId).toBe('string');
    expect(typeof distantZoneId).toBe('string');
    expect(distantZoneId).not.toBe(openingZoneId);
    initial.pageContracts[0]!.transition = {
      kind: 'threshold',
      fromZoneId: openingZoneId,
      toZoneId: distantZoneId,
      cue: 'offline opening departure with no established origin',
    };
    for (const [index, page] of structuralPages.entries()) {
      page.camera = '';
      if (index < representedPages.length) {
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        coverage[0]!.disposition = {
          kind: 'represented_elsewhere',
          representedValue: `offline-unbound-value-p${String(page.pageNumber)}`,
        };
      }
    }
    for (const page of capabilityPages) {
      const coverage = page.actionSemanticCoverage as Array<
        Record<string, unknown>
      >;
      coverage.push({
        ...structuredClone(coverage[0]!),
        beatId: `beat:p${String(page.pageNumber)}:offline_valid_guard`,
      });
      coverage[0]!.disposition = {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      };
    }

    const bookSurfaceResponse = {
      presentationPatches: capabilityPages.map((page) => {
        const coverage = page.actionSemanticCoverage as Array<
          Record<string, unknown>
        >;
        return {
          pageNumber: page.pageNumber,
          coverageIndex: 0,
          beatId: coverage[0]!.beatId,
          sourceEvidenceId: coverage[0]!.sourceEvidenceId,
          presentationClass: 'composition_focus',
          pointerChoiceIndex: 0,
        };
      }),
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: structuralPages.map((page, index) => ({
        pageNumber: page.pageNumber,
        locationId: null,
        zoneId: null,
        sameLocationAs: null,
        mustShow: capabilityPageNumbers.has(page.pageNumber)
          ? null
          : structuredClone(valid.pageContracts[index]!.mustShow),
        mustNotShow: structuredClone(
          valid.pageContracts[index]!.mustNotShow,
        ),
        propState: null,
        propConstraints: null,
        actionRequirements: null,
        camera: valid.pageContracts[index]!.camera,
        transition: null,
      })),
    };
    const transitionBookSurfaceResponse = {
      presentationPatches: [],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [{
        pageNumber: initial.pageContracts[0]!.pageNumber,
        locationId: null,
        zoneId: null,
        sameLocationAs: null,
        mustShow: null,
        mustNotShow: null,
        propState: null,
        propConstraints: null,
        actionRequirements: null,
        camera: null,
        transition: validOpeningTransition,
      }],
    };
    const representedRepairPages = representedPages.map((page, index) => {
      const repairedPage = structuredClone(page);
      repairedPage.camera = valid.pageContracts[index]!.camera;
      const coverage = repairedPage.actionSemanticCoverage as Array<
        Record<string, unknown>
      >;
      coverage[0]!.disposition = {
        kind: 'represented_elsewhere',
        contractPointer: `/pageContracts/${String(index)}/locationId`,
        contractValue: repairedPage.locationId,
      };
      return repairedPage;
    });
    const representedIssues = representedPages.map((page, itemIndex) => ({
      family: 'action_semantic',
      code: 'represented_elsewhere_pointer_out_of_scope',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'reference',
        pageNumber: page.pageNumber as number,
        itemIndex,
      },
    })) satisfies DraftValidationIssue[];
    const structuralIssues = structuralPages.map((page) => ({
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: page.pageNumber as number,
      },
      causes: ['page_steering_invalid'],
    })) satisfies DraftValidationIssue[];
    const capabilityIssues = capabilityPages.map((page) => ({
      family: 'action_semantic',
      code: 'closed_catalog_capability_gap',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'disposition',
        pageNumber: page.pageNumber as number,
        itemIndex: 0,
      },
    })) satisfies DraftValidationIssue[];
    const transitionIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: initial.pageContracts[0]!.pageNumber as number,
      },
      causes: [
        'page_transition_invalid',
        'page_transition_opening_departure_without_origin',
      ] as const,
    } satisfies DraftValidationIssue;

    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: initial,
      repairResponses: [
        bookSurfaceResponse,
        transitionBookSurfaceResponse,
        {
          patches: representedRepairPages.map((page) => {
            const coverage = page.actionSemanticCoverage as Array<
              Record<string, unknown>
            >;
            return {
              pageNumber: page.pageNumber,
              coverageIndex: 0,
              beatId: coverage[0]!.beatId,
              sourceEvidenceId: coverage[0]!.sourceEvidenceId,
              pointerChoiceIndex: 0,
            };
          }),
        },
      ],
      completeDiagnosticIssuesByAttempt: [
        [
          ...representedIssues,
          ...capabilityIssues,
          ...structuralIssues,
          transitionIssue,
        ],
        [...representedIssues, transitionIssue],
        representedIssues,
        [],
      ],
    });

    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
      'book_surface_patch',
      'represented_elsewhere_patch',
    ]);
    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'candidate',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 0,
    });
    expect(result.calls.map((call) => call.kind)).toEqual([
      'initial',
      'repair',
      'repair',
      'repair',
    ]);
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      surfacedIssueCount: stage.surfacedIssueCount,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
    }))).toEqual([
      {
        nextRepairMode: 'book_surface_patch',
        surfacedIssueCount: 19,
        completeIssueCount: 19,
        completeDelta: null,
      },
      {
        nextRepairMode: 'book_surface_patch',
        surfacedIssueCount: 6,
        completeIssueCount: 6,
        completeDelta: -13,
      },
      {
        nextRepairMode: 'represented_elsewhere_patch',
        surfacedIssueCount: 5,
        completeIssueCount: 5,
        completeDelta: -1,
      },
      {
        nextRepairMode: null,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        completeDelta: -5,
      },
    ]);
    expect(result.stages[0]!.surfacedDiagnosticIssues.filter(
      (issue) =>
        issue.family === 'action_semantic' &&
        issue.code === 'represented_elsewhere_pointer_out_of_scope',
    )).toEqual(representedIssues);
    expect(result.stages[0]!.surfacedDiagnosticIssues).not.toContainEqual(
      transitionIssue,
    );
    expect(result.stages[1]!.surfacedDiagnosticIssues).toEqual([
      ...representedIssues,
      transitionIssue,
    ]);
    expect(result.stages[2]!.surfacedDiagnosticIssues).toEqual(
      representedIssues,
    );
    expect(JSON.stringify(bookSurfaceResponse)).not.toContain(
      'actionSemanticCoverage',
    );
    expect(JSON.stringify(transitionBookSurfaceResponse)).not.toContain(
      'actionSemanticCoverage',
    );
    expect(transitionBookSurfaceResponse.pageStructuralPatches).toEqual([
      {
        pageNumber: initial.pageContracts[0]!.pageNumber,
        locationId: null,
        zoneId: null,
        sameLocationAs: null,
        mustShow: null,
        mustNotShow: null,
        propState: null,
        propConstraints: null,
        actionRequirements: null,
        camera: null,
        transition: validOpeningTransition,
      },
    ]);
    expect(result.calls[2]).toMatchObject({
      repairMode: 'book_surface_patch',
      schemaName: 'BookSurfaceRepairPatch',
    });
    expect(result.calls[3]).toMatchObject({
      repairMode: 'represented_elsewhere_patch',
      schemaName: 'RepresentedElsewhereRepairPatches',
    });
  });

  it('repairs two threshold-coupled adjacent transitions atomically before one represented residual with 3-to-1-to-0 delta', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    const page4 = initial.pageContracts[3]!;
    const page5 = initial.pageContracts[4]!;
    page4.transition = {
      kind: 'after_transition',
      fromZoneId: 'clinic.exam_room',
      toZoneId: 'clinic.waiting_room',
      cue: 'departure from an unestablished adjacent origin',
    };
    page5.transition = {
      kind: 'before_transition',
      fromZoneId: 'clinic.exam_room',
      toZoneId: 'clinic.waiting_room',
      cue: 'adjacent page declares no move after the zone changed',
    };
    const representedPage = page5;
    const representedCoverage = representedPage.actionSemanticCoverage as Array<
      Record<string, unknown>
    >;
    representedCoverage[0]!.disposition = {
      kind: 'represented_elsewhere',
      representedValue: 'offline residual without a bound pointer',
    };

    const transitionPatch = (pageNumber: number) => ({
      pageNumber,
      locationId: null,
      zoneId: null,
      sameLocationAs: null,
      mustShow: null,
      mustNotShow: null,
      propState: null,
      propConstraints: null,
      actionRequirements: null,
      camera: null,
      transition: structuredClone(
        valid.pageContracts[pageNumber - 1]!.transition,
      ),
    });
    const representedIssue = {
      family: 'action_semantic',
      code: 'represented_elsewhere_pointer_out_of_scope',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'reference',
        pageNumber: representedPage.pageNumber as number,
        itemIndex: 0,
      },
    } satisfies DraftValidationIssue;
    const transitionIssue = (
      pageNumber: number,
      causes: string[],
    ) => ({
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber,
      },
      causes: ['page_transition_invalid', ...causes].sort(),
    }) as DraftValidationIssue;

    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: initial,
      repairResponses: [
        {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [transitionPatch(4), transitionPatch(5)],
        },
        {
          patches: [{
            pageNumber: representedPage.pageNumber,
            coverageIndex: 0,
            beatId: representedCoverage[0]!.beatId,
            sourceEvidenceId: representedCoverage[0]!.sourceEvidenceId,
            pointerChoiceIndex: 0,
          }],
        },
      ],
      completeDiagnosticIssuesByAttempt: [
        [
          representedIssue,
          transitionIssue(4, [
            'page_transition_origin_not_established',
            'page_transition_origin_not_previous_zone',
          ]),
          transitionIssue(5, [
            'page_transition_no_move_zone_changed',
          ]),
        ],
        [representedIssue],
        [],
      ],
    });

    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
      'represented_elsewhere_patch',
    ]);
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      surfacedIssueCount: stage.surfacedIssueCount,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
    }))).toEqual([
      {
        nextRepairMode: 'book_surface_patch',
        surfacedIssueCount: 3,
        completeIssueCount: 3,
        completeDelta: null,
      },
      {
        nextRepairMode: 'represented_elsewhere_patch',
        surfacedIssueCount: 1,
        completeIssueCount: 1,
        completeDelta: -2,
      },
      {
        nextRepairMode: null,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        completeDelta: -1,
      },
    ]);
    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'candidate',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 0,
    });
    expect(result.calls[1]).toMatchObject({
      repairMode: 'book_surface_patch',
      schemaName: 'BookSurfaceRepairPatch',
    });
  });

  it('replays the production-shaped 17 to 9 to 6 to 0 frontier through three exact narrow lanes without a provider', async () => {
    const input = bunnySource();
    const valid = bunnyDraft();
    for (const page of valid.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }

    const page6 = valid.pageContracts[5]!;
    const page6Zone = (
      valid.zones as Array<Record<string, unknown> & {
        id: string;
        spatialNodes?: Array<Record<string, unknown>>;
        stableGeometry?: string[];
      }>
    ).find((zone) => zone.id === page6.zoneId);
    if (!page6Zone) throw new Error('offline_harness_spatial_zone_missing');
    const permittedSpatialReferenceId = 'offline_harness_story_anchor';
    page6Zone.spatialNodes = [
      ...(page6Zone.spatialNodes ?? []),
      {
        id: permittedSpatialReferenceId,
        kind: 'furniture',
        description: 'A stable story anchor for offline repair proof.',
      },
    ];
    page6Zone.stableGeometry = projectZoneStableGeometry(
      page6Zone as unknown as VisualZone,
    )!;

    const page6Coverage = page6.actionSemanticCoverage as Array<
      Record<string, unknown>
    >;
    const page6SourceEvidenceId = page6Coverage[0]!.sourceEvidenceId;
    const actionRecords = [
      {
        beatId: 'beat:p6:offline_spatial_touch',
        predicate: 'touches',
      },
      {
        beatId: 'beat:p6:offline_spatial_look',
        predicate: 'looks_at',
      },
    ];
    page6.actionRequirements = actionRecords.map((record) => ({
      beatId: record.beatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: record.predicate,
      object: {
        kind: 'spatial',
        id: permittedSpatialReferenceId,
      },
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    }));
    page6Coverage.push(
      ...actionRecords.map((record) => ({
        beatId: record.beatId,
        sourceEvidenceId: page6SourceEvidenceId,
        disposition: { kind: 'action_requirement' },
      })),
    );
    const initial = structuredClone(valid);
    const representedCoordinates = [
      { pageNumber: 2, coverageIndex: 0 },
      { pageNumber: 3, coverageIndex: 0 },
      { pageNumber: 5, coverageIndex: 0 },
      { pageNumber: 6, coverageIndex: 0 },
      { pageNumber: 6, coverageIndex: 1 },
      { pageNumber: 8, coverageIndex: 0 },
    ] as const;
    const initialPage6Coverage = initial.pageContracts[5]!
      .actionSemanticCoverage as Array<Record<string, unknown>>;
    initialPage6Coverage.splice(1, 0, {
      ...structuredClone(initialPage6Coverage[0]!),
      beatId: 'beat:p6:offline_represented_second',
    });
    const page4Coverage = initial.pageContracts[3]!
      .actionSemanticCoverage as Array<Record<string, unknown>>;
    page4Coverage.push({
      ...structuredClone(page4Coverage[0]!),
      beatId: 'beat:p4:offline_gap_second',
    });
    page4Coverage.push({
      ...structuredClone(page4Coverage[0]!),
      beatId: 'beat:p4:offline_valid_guard',
    });
    const page7Coverage = initial.pageContracts[6]!
      .actionSemanticCoverage as Array<Record<string, unknown>>;
    page7Coverage.push({
      ...structuredClone(page7Coverage[0]!),
      beatId: 'beat:p7:offline_valid_guard',
    });

    for (const page of initial.pageContracts.slice(0, 8)) page.camera = '';
    for (const coordinate of representedCoordinates) {
      const coverage = initial.pageContracts[coordinate.pageNumber - 1]!
        .actionSemanticCoverage as Array<Record<string, unknown>>;
      coverage[coordinate.coverageIndex]!.disposition = {
        kind: 'represented_elsewhere',
        contractPointer: `/outside/offline/p${String(coordinate.pageNumber)}`,
        contractValue: 'outside the compiler-owned page domain',
      };
    }
    const capabilityCoordinates = [
      { pageNumber: 4, coverageIndex: 0 },
      { pageNumber: 4, coverageIndex: 1 },
      { pageNumber: 7, coverageIndex: 0 },
    ] as const;
    for (const coordinate of capabilityCoordinates) {
      const coverage = initial.pageContracts[coordinate.pageNumber - 1]!
        .actionSemanticCoverage as Array<Record<string, unknown>>;
      coverage[coordinate.coverageIndex]!.disposition = {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      };
    }

    const invalidSpatialActions = structuredClone(
      initial.pageContracts[5]!.actionRequirements,
    ) as Array<Record<string, unknown>>;
    for (const action of invalidSpatialActions) {
      action.polarity = 'must';
      action.object = {
        kind: 'spatial',
        id: 'the furniture',
      };
    }
    const invalidSpatialPage = structuredClone(initial.pageContracts[5]!);
    invalidSpatialPage.actionRequirements = invalidSpatialActions;
    invalidSpatialPage.camera = valid.pageContracts[5]!.camera;
    const page6MustShow = [
      ...(initial.pageContracts[5]!.mustShow as string[]),
    ];
    for (const projected of projectPageMustShow(
      invalidSpatialPage as unknown as PageVisualContract,
      {
        ...initial,
        pageContracts: [
          ...initial.pageContracts.slice(0, 5),
          invalidSpatialPage,
          ...initial.pageContracts.slice(6),
        ],
      } as unknown as BookVisualContract,
    )) {
      if (!page6MustShow.includes(projected)) page6MustShow.push(projected);
    }
    const bookSurfaceResponse = {
      presentationPatches: capabilityCoordinates.map((coordinate) => {
        const coverage = initial.pageContracts[coordinate.pageNumber - 1]!
          .actionSemanticCoverage as Array<Record<string, unknown>>;
        return {
          pageNumber: coordinate.pageNumber,
          coverageIndex: coordinate.coverageIndex,
          beatId: coverage[coordinate.coverageIndex]!.beatId,
          sourceEvidenceId:
            coverage[coordinate.coverageIndex]!.sourceEvidenceId,
          presentationClass: 'composition_focus',
          pointerChoiceIndex: 0,
        };
      }),
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: initial.pageContracts.slice(0, 8).map((page, index) => ({
        pageNumber: page.pageNumber,
        locationId: null,
        zoneId: null,
        sameLocationAs: null,
        mustShow:
          page.pageNumber === 4 || page.pageNumber === 7
            ? null
            : page.pageNumber === 6
              ? page6MustShow
              : structuredClone(valid.pageContracts[index]!.mustShow),
        mustNotShow: structuredClone(
          valid.pageContracts[index]!.mustNotShow,
        ),
        propState: null,
        propConstraints: null,
        actionRequirements:
          page.pageNumber === 6 ? invalidSpatialActions : null,
        camera: valid.pageContracts[index]!.camera,
        transition: null,
      })),
    };

    const representedIssues = [
      { pageNumber: 2, itemIndex: 1 },
      { pageNumber: 3, itemIndex: 2 },
      { pageNumber: 5, itemIndex: 4 },
      { pageNumber: 6, itemIndex: 5 },
      { pageNumber: 6, itemIndex: 6 },
      { pageNumber: 8, itemIndex: 10 },
    ].map(({ pageNumber, itemIndex }) => ({
      family: 'action_semantic',
      code: 'represented_elsewhere_pointer_out_of_scope',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'reference',
        pageNumber,
        itemIndex,
      },
    })) satisfies DraftValidationIssue[];
    const capabilityIssues = [
      { pageNumber: 4, itemIndex: 0 },
      { pageNumber: 4, itemIndex: 1 },
      { pageNumber: 7, itemIndex: 0 },
    ].map(({ pageNumber, itemIndex }) => ({
      family: 'action_semantic',
      code: 'closed_catalog_capability_gap',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'disposition',
        pageNumber,
        itemIndex,
      },
    })) satisfies DraftValidationIssue[];
    const initialStructuralIssues = initial.pageContracts.slice(0, 8).map((page) => ({
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: page.pageNumber as number,
      },
      causes: page.pageNumber === 6
        ? [
            'page_action_requirements_invalid',
            'page_steering_invalid',
          ]
        : ['page_steering_invalid'],
    })) satisfies DraftValidationIssue[];
    const spatialIssues = [0, 1].map((itemIndex) => ({
      family: 'draft_contract',
      code: 'out_of_scope_reference',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_actions',
        fieldRole: 'reference',
        pageNumber: 6,
        itemIndex,
      },
    })) satisfies DraftValidationIssue[];
    const page6StructuralIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 6,
      },
      causes: ['page_action_requirements_invalid'],
    } satisfies DraftValidationIssue;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: initial,
      repairResponses: [
        bookSurfaceResponse,
        {
          patches: [0, 1].map((actionIndex) => ({
            pageNumber: 6,
            actionIndex,
            fieldRole: 'object',
            spatialReferenceId: permittedSpatialReferenceId,
          })),
        },
        {
          patches: representedCoordinates.map((coordinate) => {
            const coverage = initial.pageContracts[
              coordinate.pageNumber - 1
            ]!.actionSemanticCoverage as Array<Record<string, unknown>>;
            return {
              pageNumber: coordinate.pageNumber,
              coverageIndex: coordinate.coverageIndex,
              beatId: coverage[coordinate.coverageIndex]!.beatId,
              sourceEvidenceId:
                coverage[coordinate.coverageIndex]!.sourceEvidenceId,
              pointerChoiceIndex: 0,
            };
          }),
        },
      ],
      completeDiagnosticIssuesByAttempt: [
        [
          ...capabilityIssues,
          ...representedIssues,
          ...initialStructuralIssues,
        ],
        [
          ...representedIssues,
          page6StructuralIssue,
          ...spatialIssues,
        ],
        representedIssues,
        [],
      ],
    });

    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
      'page_spatial_reference_patch',
      'represented_elsewhere_patch',
    ]);
    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'candidate',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 0,
    });
    expect(result.calls[result.calls.length - 1]).toMatchObject({
      schemaName: 'RepresentedElsewhereRepairPatches',
    });
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      surfacedIssueCount: stage.surfacedIssueCount,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
    }))).toEqual([
      {
        nextRepairMode: 'book_surface_patch',
        surfacedIssueCount: 17,
        completeIssueCount: 17,
        completeDelta: null,
      },
      {
        nextRepairMode: 'page_spatial_reference_patch',
        surfacedIssueCount: 9,
        completeIssueCount: 9,
        completeDelta: -8,
      },
      {
        nextRepairMode: 'represented_elsewhere_patch',
        surfacedIssueCount: 6,
        completeIssueCount: 6,
        completeDelta: -3,
      },
      {
        nextRepairMode: null,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        completeDelta: -6,
      },
    ]);
    expect(
      result.stages[2]!.surfacedDiagnosticIssues.map(
        (issue) => issue.locator.kind === 'page_item'
          ? issue.locator.pageNumber
          : null,
      ).sort((left, right) => (left ?? 0) - (right ?? 0)),
    ).toEqual([2, 3, 5, 6, 6, 8]);
    expect(JSON.stringify(result.calls)).not.toMatch(
      /page_contract_patch|full_draft/,
    );
  });

  it('does not admit BookSurface when coverage_missing is not bound to a capability-gap page', async () => {
    const input = bunnySource();
    const initial = bunnyDraft();
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    initial.pageContracts[0]!.camera = '';
    initial.pageContracts[0]!.actionSemanticCoverage = [];

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: initial,
      repairResponses: [bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [CAPABILITY_COVERAGE_MISSING, PAGE_STEERING_INVALID],
        [],
      ],
    });

    expect(result.providerCalls).toBe(0);
    expect(result.outcome).toBe('candidate');
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(result.calls.some(
      (call) => call.repairMode === 'book_surface_patch',
    )).toBe(false);
  });

  it('does not admit BookSurface when deferred represented coverage coexists with a non-BookSurface root cause', async () => {
    const input = bunnySource();
    delete (input as unknown as Record<string, unknown>).worldType;
    const initial = bunnyDraft();
    initial.worldType = '';
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    const coverage = initial.pageContracts[0]!
      .actionSemanticCoverage as Array<Record<string, unknown>>;
    coverage[0]!.disposition = {
      kind: 'represented_elsewhere',
      representedValue: 'offline-unbound-root-counterexample',
    };
    const representedIssue = {
      family: 'action_semantic',
      code: 'represented_elsewhere_pointer_out_of_scope',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'reference',
        pageNumber: 1,
        itemIndex: 0,
      },
    } satisfies DraftValidationIssue;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: initial,
      repairResponses: [bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [WORLD_TYPE_MISSING, representedIssue],
        [],
      ],
    });

    expect(result.providerCalls).toBe(0);
    expect(result.outcome).toBe('candidate');
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'full_draft',
    ]);
    expect(result.calls.some(
      (call) => call.repairMode === 'book_surface_patch',
    )).toBe(false);
  });

  it('stops an exact zero-gap BookSurface fixed point after two offline calls', async () => {
    const initial = bunnyDraft();
    for (const page of initial.pageContracts) {
      delete page.castIds;
      delete page.characterPresence;
      delete page.castStates;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    const page1 = initial.pageContracts[0]!;
    const invalidConstraints = [{
      propId: 'prop:offline_unknown',
      visibility: 'required',
    }];
    page1.propConstraints = invalidConstraints;
    const coverage = page1.actionSemanticCoverage as Array<
      Record<string, unknown>
    >;
    coverage[0]!.disposition = {
      kind: 'represented_elsewhere',
      representedValue: 'offline-unbound-stagnation',
    };
    const representedIssue = {
      family: 'action_semantic',
      code: 'represented_elsewhere_pointer_out_of_scope',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_action_semantic_coverage',
        fieldRole: 'reference',
        pageNumber: 1,
        itemIndex: 0,
      },
    } satisfies DraftValidationIssue;
    const structuralIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 1,
      },
      causes: ['page_prop_constraints_invalid'],
    } satisfies DraftValidationIssue;
    const unchangedBookSurfaceResponse = {
      presentationPatches: [],
      coverContract: null,
      recurringProps: null,
      pageStructuralPatches: [{
        pageNumber: 1,
        locationId: null,
        zoneId: null,
        sameLocationAs: null,
        mustShow: null,
        mustNotShow: null,
        propState: null,
        propConstraints: structuredClone(invalidConstraints),
        actionRequirements: null,
        camera: null,
        transition: null,
      }],
    };

    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: initial,
      repairResponses: [unchangedBookSurfaceResponse, bunnyDraft()],
      completeDiagnosticIssuesByAttempt: [
        [representedIssue, structuralIssue],
        [representedIssue, structuralIssue],
      ],
    });

    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'repair_stagnated',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 2,
    });
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
    ]);
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
    }))).toEqual([
      {
        nextRepairMode: 'book_surface_patch',
        completeIssueCount: 2,
        completeDelta: null,
      },
      {
        nextRepairMode: null,
        completeIssueCount: 2,
        completeDelta: 0,
      },
    ]);
  });

  it('closes a typed prop-constraint violation through BookSurface with non-positive complete-census delta', async () => {
    const initial = bunnyDraft();
    for (const page of initial.pageContracts) {
      page.propConstraints ??= [];
    }
    const page1 = initial.pageContracts[0]!;
    page1.propConstraints = [{
      propId: 'prop:offline_unknown',
      visibility: 'required',
    }];

    const result = await runOfflineRepairHarness({
      input: bunnySource(),
      initialDraft: initial,
      repairResponses: [{
        presentationPatches: [],
        coverContract: null,
        recurringProps: null,
        pageStructuralPatches: [{
          pageNumber: 1,
          locationId: null,
          zoneId: null,
          sameLocationAs: null,
          mustShow: null,
          mustNotShow: null,
          propState: null,
          propConstraints: [{
            propId: 'wall_stickers',
            visibility: 'required',
          }],
          actionRequirements: null,
          camera: null,
          transition: null,
        }],
      }],
      completeDiagnosticIssuesByAttempt: [[{
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        locator: {
          kind: 'page',
          fieldRole: 'final_structure',
          pageNumber: 1,
        },
        causes: ['page_prop_constraints_invalid'],
      }], []],
    });

    expect(result.providerCalls).toBe(0);
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'book_surface_patch',
    ]);
    expect(result.outcome).toBe('candidate');
    expect(result.stages.map((stage) => ({
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
      classification: stage.classification,
    }))).toEqual([
      {
        completeIssueCount: 1,
        completeDelta: null,
        classification: 'baseline',
      },
      {
        completeIssueCount: 0,
        completeDelta: -1,
        classification: 'improved',
      },
    ]);
    expect(result.completeCensusCoverage).toBe('complete');
    expect(result.monotonicCompleteIssueDelta).toBe(true);
    expect(result.maxPositiveCompleteIssueDelta).toBe(0);
  });

  it('schedules a closed mixed source repair before BookSurface and PageContract with monotonic complete census', async () => {
    const input = bunnySource();
    const valid = bunnyDraft();
    for (const page of valid.pageContracts) {
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    const page1 = valid.pageContracts[0]!;
    const page2 = valid.pageContracts[1]!;
    const page3 = valid.pageContracts[2]!;
    const validPage2Camera = page2.camera;
    const validPage1SourceEvidenceId = (
      page1.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!.sourceEvidenceId as string;

    const validPage3 = structuredClone(page3);
    const page3Coverage = (
      validPage3.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!;
    const page3BeatId = page3Coverage.beatId as string;
    validPage3.actionRequirements = [{
      beatId: page3BeatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'looks_at',
      object: null,
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'must',
      laterality: null,
    }];
    page3Coverage.disposition = { kind: 'action_requirement' };
    validPage3.mustShow = [
      ...(validPage3.mustShow as string[]),
      ...projectPageMustShow(
        validPage3 as unknown as PageVisualContract,
        {
          ...valid,
          pageContracts: [
            ...valid.pageContracts.slice(0, 2),
            validPage3,
            ...valid.pageContracts.slice(3),
          ],
        } as unknown as BookVisualContract,
      ),
    ];

    const initial = structuredClone(valid);
    const initialPage1 = initial.pageContracts[0]!;
    const initialPage2 = initial.pageContracts[1]!;
    const initialPage3 = structuredClone(validPage3);
    initial.pageContracts[2] = initialPage3;
    (
      initialPage1.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!.sourceEvidenceId = 'malformed-source-evidence-id';
    initialPage2.camera = '';
    (
      initialPage3.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!.disposition = {
      kind: 'non_visual',
      rationale: 'narrative_context',
    };

    const repairedPage3 = structuredClone(validPage3);
    delete repairedPage3.castIds;
    delete repairedPage3.characterPresence;
    repairedPage3.propConstraints ??= [];
    const sourceIssue = {
      family: 'source_evidence_id',
      code: 'source_evidence_id_malformed',
      locator: {
        kind: 'source_evidence',
        fieldRole: 'source_evidence',
        pageNumber: 1,
        coverageIndex: 0,
      },
    } satisfies DraftValidationIssue;
    const page2Issue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 2,
      },
      causes: ['page_steering_invalid'],
    } satisfies DraftValidationIssue;
    const page3CardinalityIssue = {
      family: 'action_semantic',
      code: 'action_binding_cardinality_invalid',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_actions',
        fieldRole: 'cardinality',
        pageNumber: 3,
        itemIndex: 0,
      },
    } satisfies DraftValidationIssue;
    const page3MissingIssue = {
      family: 'action_semantic',
      code: 'action_binding_missing',
      locator: {
        kind: 'page_item',
        collectionRole: 'page_actions',
        fieldRole: 'action_binding',
        pageNumber: 3,
        itemIndex: 0,
      },
    } satisfies DraftValidationIssue;
    const page3StructuralIssue = {
      family: 'draft_contract',
      code: 'final_structural_invariant_invalid',
      locator: {
        kind: 'page',
        fieldRole: 'final_structure',
        pageNumber: 3,
      },
      causes: ['page_action_requirements_invalid'],
    } satisfies DraftValidationIssue;

    const result = await runOfflineRepairHarness({
      input,
      initialDraft: initial,
      repairResponses: [
        {
          patches: [{
            pageNumber: 1,
            beatId: (
              initialPage1.actionSemanticCoverage as Array<Record<string, unknown>>
            )[0]!.beatId,
            sourceEvidenceId: validPage1SourceEvidenceId,
          }],
        },
        { pageContracts: [repairedPage3] },
        {
          presentationPatches: [],
          coverContract: null,
          recurringProps: null,
          pageStructuralPatches: [{
            pageNumber: 2,
            locationId: null,
            zoneId: null,
            sameLocationAs: null,
            mustShow: structuredClone(page2.mustShow),
            mustNotShow: structuredClone(page2.mustNotShow),
            propState: null,
            propConstraints: null,
            actionRequirements: null,
            camera: validPage2Camera,
            transition: null,
          }],
        },
      ],
      completeDiagnosticIssuesByAttempt: [
        [
          sourceIssue,
          page2Issue,
          page3CardinalityIssue,
          page3MissingIssue,
          page3StructuralIssue,
        ],
        [
          page2Issue,
          page3CardinalityIssue,
          page3MissingIssue,
          page3StructuralIssue,
        ],
        [page2Issue],
        [],
      ],
    });

    expect(result).toMatchObject({
      executionMode: 'offline_stub',
      providerCalls: 0,
      outcome: 'candidate',
      completeCensusCoverage: 'complete',
      monotonicCompleteIssueDelta: true,
      maxPositiveCompleteIssueDelta: 0,
      finalCompleteIssueCount: 0,
    });
    expect(result.calls.map((call) => call.repairMode)).toEqual([
      null,
      'source_evidence_id_patch',
      'page_contract_patch',
      'book_surface_patch',
    ]);
    expect(
      result.actionCoverageCensuses[0]!.records.find(
        (record) => record.pageNumber === 3,
      ),
    ).toMatchObject({
      dispositionKind: 'non_visual',
      matchingActionIndexes: [0],
      attemptedPredicates: ['looks_at'],
    });
    expect(result.stages.map((stage) => ({
      nextRepairMode: stage.nextRepairMode,
      completeIssueCount: stage.completeIssueCount,
      completeDelta: stage.completeDelta,
      classification: stage.classification,
    }))).toEqual([
      {
        nextRepairMode: 'source_evidence_id_patch',
        completeIssueCount: 5,
        completeDelta: null,
        classification: 'baseline',
      },
      {
        nextRepairMode: 'page_contract_patch',
        completeIssueCount: 4,
        completeDelta: -1,
        classification: 'improved',
      },
      {
        nextRepairMode: 'book_surface_patch',
        completeIssueCount: 1,
        completeDelta: -3,
        classification: 'improved',
      },
      {
        nextRepairMode: null,
        completeIssueCount: 0,
        completeDelta: -1,
        classification: 'improved',
      },
    ]);
  });

  it('replays the production BookSurface, spatial and PageContract selectors without a provider', async () => {
    const bookSurfaceDraft = bunnyDraft();
    bookSurfaceDraft.pageContracts[0]!.camera = '';

    const spatialDraft = bunnyDraft();
    const spatialPage = spatialDraft.pageContracts[0]!;
    const spatialZone = (
      spatialDraft.zones as Array<Record<string, unknown> & {
        id: string;
        spatialNodes?: Array<Record<string, unknown>>;
        stableGeometry?: string[];
      }>
    ).find((zone) => zone.id === spatialPage.zoneId);
    if (!spatialZone) throw new Error('offline_harness_spatial_zone_missing');
    spatialZone.spatialNodes = [{
      id: 'offline_harness_chair',
      kind: 'furniture',
      description: 'A stable offline harness chair.',
    }];
    spatialZone.stableGeometry = projectZoneStableGeometry(
      spatialZone as unknown as VisualZone,
    )!;
    const spatialCoverage = (
      spatialPage.actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!;
    spatialCoverage.disposition = { kind: 'action_requirement' };
    spatialPage.actionRequirements = [{
      beatId: spatialCoverage.beatId,
      subject: {
        kind: 'entity',
        entity: { kind: 'cast', id: 'child:hero' },
      },
      predicate: 'touches',
      object: {
        kind: 'spatial',
        id: 'outside_offline_harness_zone',
      },
      spatialEffect: null,
      spatialConstraint: null,
      polarity: 'affirmative',
      laterality: null,
    }];
    spatialPage.mustShow = [
      ...(spatialPage.mustShow as string[]),
      ...projectPageMustShow(
        spatialPage as unknown as PageVisualContract,
        spatialDraft as unknown as BookVisualContract,
      ),
    ];

    const pageContractDraft = bunnyDraft();
    const pageContractCoverage = (
      pageContractDraft.pageContracts[0]!
        .actionSemanticCoverage as Array<Record<string, unknown>>
    )[0]!;
    pageContractCoverage.disposition = { kind: 'action_requirement' };
    pageContractDraft.pageContracts[0]!.actionRequirements = [];

    const scenarios = [
      {
        draft: bookSurfaceDraft,
        expected: 'book_surface_patch',
      },
      {
        draft: spatialDraft,
        expected: 'page_spatial_reference_patch',
      },
      {
        draft: pageContractDraft,
        expected: 'page_contract_patch',
      },
    ] as const;

    for (const scenario of scenarios) {
      const result = await runOfflineRepairHarness({
        input: bunnySource(),
        initialDraft: scenario.draft,
        repairResponses: [{}],
      });
      expect(result.providerCalls).toBe(0);
      expect(result.calls.map((call) => call.repairMode)).toEqual([
        null,
        scenario.expected,
      ]);
      expect(result.outcome).toBe('repair_output_invalid');
    }
  });
});
