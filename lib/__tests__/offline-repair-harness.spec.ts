import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  classifyOfflineRepairDelta,
  runOfflineRepairHarness,
} from '../visual-contract-compiler/offlineRepairHarness';
import type { TemplateCompileInput } from '../visual-contract-compiler/compileBookVisualContractTemplate';
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

describe('offline Visual Contract repair harness', () => {
  it('executes the production compiler with a local response queue and no provider boundary', async () => {
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
