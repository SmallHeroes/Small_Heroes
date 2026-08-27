import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runOfflineRepairHarness } from '../offlineRepairHarness';
import { analyzeTransitionSequence } from '../transitionAnalysis';
import type { PageVisualContract } from '../types';
import {
  buildTemplateCompileSystemPrompt,
} from '../compileBookVisualContractTemplate';
import { buildBookSurfaceRepairSystemPrompt } from '../bookSurfaceRepair';
import { buildStorySourceAuthoritySnapshot } from '@/lib/visual-package/storySourceAuthority';
import { storySourceSnapshotToTemplateInput } from '@/lib/visual-package/storySourceAuthority';

/**
 * The EXACT captured transition frontier from paid lantern authoring attempt 2
 * (run root outputs/r1d-lantern-fresh-readiness-20260827T000426Z, receipt
 * 4a8fce8d…, terminal draft_validation_repair_stagnated). The fixtures are the
 * verbatim provider bytes: the initial draft and the byte-identical
 * BookSurface repair the model returned on BOTH paid repair calls. The
 * corrective fixture differs from the captured repair ONLY in the six flagged
 * pages' transitions, rewritten to the validator's arrival scheme — the exact
 * rewrite the v22/v14 prompt contract now instructs.
 *
 * This spec is the repair-ROUTE convergence proof Codex QA required: the same
 * frontier that stagnated 6→6→6 through the real book_surface_patch route
 * reaches a candidate with 0 issues once the patch applies the arrival scheme,
 * with zero provider calls.
 */
const FIXTURES = path.join(
  __dirname,
  'fixtures',
  'lantern-transition-frontier',
);
const ACCEPTED_STORY_PATH =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a/integrated.md';
const CAPTURED_SNAPSHOT_DIGEST =
  '35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c';
const FLAGGED_PAGES = [2, 3, 4, 6, 7, 8];

function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES, name), 'utf8'),
  );
}

function harnessInput() {
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: process.cwd(),
    storyKey: 'chameleon_koko_bedtime',
    storyPath: ACCEPTED_STORY_PATH,
  });
  // Bind this spec to the exact captured run: the rebuilt snapshot must be the
  // same content-addressed artifact the paid attempt executed against.
  expect(snapshot.digest).toBe(CAPTURED_SNAPSHOT_DIGEST);
  return storySourceSnapshotToTemplateInput(snapshot);
}

type HarnessResult = {
  outcome: string;
  terminalFailureCode: string | null;
  providerCalls: number;
  finalSurfacedIssueCount: number;
  finalCompleteIssueCount: number;
  calls: Array<{ kind: string; repairMode: string | null }>;
  stages: Array<{
    surfacedIssueCount: number;
    completeIssueCount: number;
    surfacedDiagnosticIssues: Array<{
      code: string;
      locator: { kind: string; pageNumber?: number };
      causes?: string[];
    }>;
  }>;
};

describe('lantern transition frontier (captured attempt-2 bytes)', () => {
  it('reproduces the captured stagnation through the REAL repair route: 6→6→6, terminal repair stagnation', async () => {
    const capturedRepair = fixture('captured-stagnating-repair.json');
    const result = (await runOfflineRepairHarness({
      input: harnessInput(),
      initialDraft: fixture('initial-draft.json'),
      repairResponses: [capturedRepair, capturedRepair],
    })) as unknown as HarnessResult;

    expect(result.providerCalls).toBe(0);
    expect(result.outcome).not.toBe('candidate');
    expect(result.terminalFailureCode).toBe(
      'draft_validation_repair_stagnated',
    );
    expect(
      result.stages.map((stage) => stage.completeIssueCount),
    ).toEqual([6, 6, 6]);
    // Every surfaced issue in the terminal frontier is a transition-pair
    // failure on exactly the six captured pages.
    const lastStage = result.stages[result.stages.length - 1]!;
    const pages = lastStage.surfacedDiagnosticIssues
      .map((issue) => issue.locator.pageNumber)
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(pages).toEqual(FLAGGED_PAGES);
    for (const issue of lastStage.surfacedDiagnosticIssues) {
      expect(issue.causes ?? []).toContain('page_transition_invalid');
    }
  });

  it('converges the SAME frontier to a candidate with 0 issues when the repair applies the arrival scheme', async () => {
    const result = (await runOfflineRepairHarness({
      input: harnessInput(),
      initialDraft: fixture('initial-draft.json'),
      repairResponses: [fixture('corrective-arrival-repair.json')],
    })) as unknown as HarnessResult;

    expect(result.providerCalls).toBe(0);
    expect(result.outcome).toBe('candidate');
    expect(result.terminalFailureCode).toBeNull();
    expect(result.finalSurfacedIssueCount).toBe(0);
    expect(result.finalCompleteIssueCount).toBe(0);
    expect(result.calls.map((call) => call.kind)).toEqual([
      'initial',
      'repair',
    ]);
    expect(result.calls[1]!.repairMode).toBe('book_surface_patch');
    // The corrective fixture differs from the captured stagnating repair ONLY
    // in the six flagged pages' transitions — the arrival-scheme rewrite.
    const captured = fixture('captured-stagnating-repair.json') as {
      pageStructuralPatches: Array<Record<string, unknown>>;
    };
    const corrective = fixture('corrective-arrival-repair.json') as {
      pageStructuralPatches: Array<Record<string, unknown>>;
    };
    const stripTransition = (
      patches: Array<Record<string, unknown>>,
    ): Array<Record<string, unknown>> =>
      patches.map(({ transition: _transition, ...rest }) => rest);
    expect(stripTransition(corrective.pageStructuralPatches)).toEqual(
      stripTransition(captured.pageStructuralPatches),
    );
    expect(
      corrective.pageStructuralPatches.map((patch) => patch.pageNumber),
    ).toEqual(FLAGGED_PAGES);
  });

  it('states the identical transition arrival contract in BOTH prompt routes (initial + BookSurface repair)', () => {
    const initial = buildTemplateCompileSystemPrompt();
    const repair = buildBookSurfaceRepairSystemPrompt();
    expect(initial).toContain('Page 1: steady or before_transition only');
    expect(initial).toContain(
      "departing FROM the previous page's zone",
    );
    expect(initial).toContain('declare NO arrival');
    expect(repair).toContain('valid only as an ARRIVAL');
    expect(repair).toContain('Page 1 must be steady or before_transition');
    expect(repair).toContain(
      "fromZoneId = the previous page's zone",
    );
    expect(repair).toContain(
      'never re-assert the current transitions unchanged',
    );
  });
});

describe('transition sequence validator counterexamples (prompt/validator agreement)', () => {
  const page = (
    pageNumber: number,
    zoneId: string,
    transition: Record<string, unknown> | null,
  ): { page: PageVisualContract; pageIndex: number } => ({
    page: { pageNumber, zoneId, transition } as unknown as PageVisualContract,
    pageIndex: pageNumber - 1,
  });
  const causesOf = (
    analyses: ReturnType<typeof analyzeTransitionSequence>,
    pageNumber: number,
  ): string[] =>
    analyses
      .find((analysis) => analysis.pageNumber === pageNumber)!
      .findings.map((finding) => finding.cause);

  it.each([
    ['threshold', { kind: 'threshold', fromZoneId: 'a', toZoneId: 'b' }],
    ['after_transition', { kind: 'after_transition', fromZoneId: 'a', toZoneId: 'b' }],
  ])('rejects an opening page-1 %s (no established origin exists)', (_label, transition) => {
    const analyses = analyzeTransitionSequence([
      page(1, 'b', transition),
      page(2, 'b', null),
    ]);
    expect(causesOf(analyses, 1)).toContain(
      'page_transition_opening_departure_without_origin',
    );
  });

  it('rejects a new-zone threshold departing from an unestablished zone', () => {
    const analyses = analyzeTransitionSequence([
      page(1, 'a', null),
      page(2, 'c', { kind: 'threshold', fromZoneId: 'x', toZoneId: 'c' }),
    ]);
    expect(causesOf(analyses, 2)).toEqual(
      expect.arrayContaining([
        'page_transition_origin_not_established',
        'page_transition_origin_not_previous_zone',
      ]),
    );
  });

  it('rejects a new-zone threshold departing from an established zone that is not the previous page', () => {
    const analyses = analyzeTransitionSequence([
      page(1, 'a', null),
      page(2, 'b', { kind: 'after_transition', fromZoneId: 'a', toZoneId: 'b' }),
      page(3, 'c', { kind: 'threshold', fromZoneId: 'a', toZoneId: 'c' }),
    ]);
    const causes = causesOf(analyses, 3);
    expect(causes).toContain('page_transition_origin_not_previous_zone');
    expect(causes).not.toContain('page_transition_origin_not_established');
  });

  it('rejects a before_transition/steady page whose zone changed (the captured failure shape)', () => {
    const analyses = analyzeTransitionSequence([
      page(1, 'a', null),
      page(2, 'b', { kind: 'before_transition', fromZoneId: 'b', toZoneId: 'c' }),
    ]);
    expect(causesOf(analyses, 2)).toContain(
      'page_transition_no_move_zone_changed',
    );
  });

  it('accepts the arrival scheme end-to-end, including a threshold continued by after_transition', () => {
    const analyses = analyzeTransitionSequence([
      page(1, 'a', null),
      page(2, 'b', { kind: 'after_transition', fromZoneId: 'a', toZoneId: 'b' }),
      page(3, 'b', { kind: 'threshold', fromZoneId: 'b', toZoneId: 'c' }),
      page(4, 'c', { kind: 'after_transition', fromZoneId: 'b', toZoneId: 'c' }),
    ]);
    expect(analyses.flatMap((analysis) => analysis.findings)).toEqual([]);
  });
});
