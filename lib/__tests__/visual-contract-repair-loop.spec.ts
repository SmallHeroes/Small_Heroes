/**
 * Stage 3 — the bounded repair loop (≤2 semantic repairs after the initial authoring call). Motivated by the real
 * fox failure: gpt-5.5 minted a VALID+faithful draft except for one trivial descriptive-field error
 * (recurringProps[].material empty) — exactly the repair-class this loop targets. Proves: repairs on attempt 2/3,
 * the cap at 2 (writes nothing on exhaustion), provenance/attempt trail, and that the repair call carries the
 * invalid draft + exact errors + facts.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  compileBookVisualContractTemplate,
  buildTemplateCompileUserPrompt,
  buildTemplateRepairSystemPrompt,
  buildTemplateRepairUserPrompt,
  decodeTemplateRepairUserPrompt,
  REPAIR_PROMPT_VERSION,
  REPAIR_USER_PROMPT_VERSION,
  TEMPLATE_REPAIR_ISSUES_MARKER,
  SourceEvidenceIdValidationError,
  TemplateRepairExhaustedError,
  TemplateRepairOutputInvalidError,
  TemplateRepairRouteAdmissionError,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
} from '../visual-contract-compiler/sourceEvidenceIdRepair';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
} from '../visual-contract-compiler/templateDraftSchema';
import {
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
  PAGE_SPATIAL_REFERENCE_REPAIR_PROMPT_VERSION,
  decodePageContractRepairUserPrompt,
  parsePageContractRepairs,
} from '../visual-contract-compiler/pageContractRepair';
import {
  decodeStructuralBundleRepairUserPrompt,
  STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
} from '../visual-contract-compiler/structuralBundleRepair';
import {
  BOOK_SURFACE_REPAIR_JSON_SCHEMA,
  BOOK_SURFACE_REPAIR_PROMPT_VERSION,
  BOOK_SURFACE_REPAIR_SCHEMA_NAME,
  BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
  decodeBookSurfaceRepairUserPrompt,
} from '../visual-contract-compiler/bookSurfaceRepair';
import {
  PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
  PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
  type PresentationRequirementRepairPatch,
  type PresentationRequirementRepairTarget,
} from '../visual-contract-compiler/presentationRequirementRepair';
import {
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
  terminalReferenceCleanupPredecessorIsEligible,
  visualContractAuthoringInputAccounting,
} from '../visual-contract-compiler/authoringPolicy';
import { InvalidTemplateContractError } from '../visual-contract-compiler/validateTemplateContract';
import { extractDeterministicFacts } from '../visual-contract-compiler/extractDeterministicFacts';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';
import { draftValidationIssueIsValid } from '../visual-contract-compiler/draftValidationDiagnostics';
import { projectPageMustShow } from '../visual-contract-compiler/projectContractProse';

const FULL_DRAFT_ISSUE = {
  family: 'draft_contract',
  code: 'final_structural_invariant_invalid',
  locator: { kind: 'root', fieldRole: 'authority' },
} as const;

function bookSurfaceStructuralPatch(
  page: Record<string, unknown>,
): Record<string, unknown> {
  return structuredClone({
    pageNumber: page.pageNumber,
    locationId: page.locationId,
    zoneId: page.zoneId,
    sameLocationAs: page.sameLocationAs,
    mustShow: page.mustShow,
    mustNotShow: page.mustNotShow,
    propState: page.propState,
    propConstraints: page.propConstraints,
    actionRequirements: page.actionRequirements,
    camera: page.camera,
    transition: page.transition,
  });
}

function bookSurfaceV6Response(args: {
  payload: Record<string, unknown>;
  coverContract: Record<string, unknown> | null;
  recurringProps: Record<string, unknown>[] | null;
  repairedPages: readonly Record<string, unknown>[];
  hostileEchoIdentity?: boolean;
}): Record<string, unknown> {
  const presentationTargets = args.payload.presentationTargets as
    | PresentationRequirementRepairTarget[]
    | undefined;
  const affectedPages = args.payload.affectedPages as
    | Array<{
        pageNumber: number;
        pageStructuralProjection: Record<string, unknown>;
        writableFields: string[];
      }>
    | undefined;
  if (!presentationTargets || !affectedPages) {
    throw new Error('missing book-surface v6 fixture authority');
  }
  const repairedPagesByNumber = new Map(
    args.repairedPages.map((page) => [page.pageNumber, page]),
  );
  return {
    presentationPatches: presentationTargets.map((target, index) => ({
      pageNumber: args.hostileEchoIdentity ? 90 + index : target.pageNumber,
      coverageIndex: args.hostileEchoIdentity
        ? 90 + index
        : target.coverageIndex,
      beatId: args.hostileEchoIdentity
        ? `beat:p${90 + index}:provider_forged`
        : target.beatId,
      sourceEvidenceId: args.hostileEchoIdentity
        ? `se1_${String(index + 1).repeat(64)}`
        : target.sourceEvidenceId,
      presentationClass: 'composition_focus',
      contractPointer:
        target.permittedPointerValues[0]!.contractPointer,
    })),
    coverContract: args.coverContract,
    recurringProps: args.recurringProps,
    pageStructuralPatches: affectedPages.map((affectedPage) => {
      const repairedPage = repairedPagesByNumber.get(
        affectedPage.pageNumber,
      );
      if (!repairedPage) {
        throw new Error('missing repaired book-surface page fixture');
      }
      const repaired = bookSurfaceStructuralPatch(repairedPage);
      const writableFields = new Set(affectedPage.writableFields);
      return Object.fromEntries(
        Object.entries(repaired).map(([field, value]) => [
          field,
          field === 'pageNumber' || writableFields.has(field)
            ? structuredClone(value)
            : null,
        ]),
      );
    }),
  };
}

function ensureBookSurfacePageShape(
  draft: { pageContracts: Array<Record<string, unknown>> },
): void {
  for (const page of draft.pageContracts) {
    delete page.castIds;
    delete page.characterPresence;
    delete page.castStates;
    page.propConstraints ??= [];
    page.actionRequirements ??= [];
  }
}

function repairEnvelopeParts(user: string): {
  source: string;
  envelope: unknown[];
} {
  const marker = `\n${TEMPLATE_REPAIR_ISSUES_MARKER}\n`;
  const index = user.indexOf(marker);
  if (index <= 0) throw new Error('missing repair marker');
  return {
    source: user.slice(0, index),
    envelope: JSON.parse(
      user.slice(index + marker.length),
    ) as unknown[],
  };
}

const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
const bunnySource = (): TemplateCompileInput =>
  extractSourceFromMarkdown('bunny_ometz_adventure', fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.md'), 'utf8')) as TemplateCompileInput;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bunnyDraft = (): any => {
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(
        BANK,
        'bunny_ometz_adventure.visual-contract-template.json',
      ),
      'utf8',
    ),
  );
  for (const prop of draft.recurringProps) {
    if (
      !Object.prototype.hasOwnProperty.call(
        prop,
        'firstRevealPage',
      )
    ) {
      prop.firstRevealPage = null;
    }
  }
  return withCurrentActionSemanticCoverage({
    draft,
    pages: bunnySource().pages,
    sourceEvidenceCatalog: bunnySource().sourceEvidenceCatalog,
  });
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withEmptyMaterial = (): any => {
  const d = bunnyDraft();
  d.recurringProps[0].material = ''; // the exact fox repair-class: a required descriptive field left empty
  return d;
};

/** A caller that returns a fixed SEQUENCE of drafts (clamped to the last) and records every prompt it received. */
function recordingCaller(drafts: unknown[]): { caller: ContractLlmCaller; prompts: Array<{ system: string; user: string; options: Parameters<ContractLlmCaller>[2]; authority: Parameters<ContractLlmCaller>[3] }>; calls: () => number } {
  const prompts: Array<{ system: string; user: string; options: Parameters<ContractLlmCaller>[2]; authority: Parameters<ContractLlmCaller>[3] }> = [];
  const caller: ContractLlmCaller = async (system, user, options, authority) => {
    prompts.push({ system, user, options, authority });
    return JSON.stringify(drafts[Math.min(prompts.length - 1, drafts.length - 1)]);
  };
  return { caller, prompts, calls: () => prompts.length };
}

const OBSERVED_EVIDENCE_FAILURE_PAGES = [
  6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
] as const;

// The failed live attempt had eleven evidence failures across these six pages.
// This fixture preserves that general shape without using a story-specific
// phrase or selection rule.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withElevenInvalidEvidenceIds(): any {
  const draft = bunnyDraft();
  const occurrenceByPage = new Map<number, number>();
  for (const pageNumber of OBSERVED_EVIDENCE_FAILURE_PAGES) {
    const page = draft.pageContracts.find(
      (candidate: { pageNumber: number }) =>
        candidate.pageNumber === pageNumber,
    );
    if (!page) throw new Error(`missing page ${pageNumber}`);
    const occurrence = occurrenceByPage.get(pageNumber) ?? 0;
    occurrenceByPage.set(pageNumber, occurrence + 1);
    const source = structuredClone(page.actionSemanticCoverage[0]);
    source.beatId =
      `beat:p${pageNumber}:observed_failure_${occurrence + 1}`;
    source.sourceEvidenceId =
      `se1_${String(pageNumber * 10 + occurrence).padStart(64, 'f')}`;
    if (occurrence === 0) page.actionSemanticCoverage = [source];
    else page.actionSemanticCoverage.push(source);
  }
  return draft;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withDuplicateBeatOnRawPage(rawPageNumber: unknown): any {
  const input = bunnySource();
  const draft = bunnyDraft();
  const compilerPageNumber =
    typeof rawPageNumber === 'number' ? rawPageNumber : -1;
  const sourceEvidenceId = input.sourceEvidenceCatalog.entries.find(
    (entry) => entry.pageNumber === 1,
  )!.sourceEvidenceId;
  for (const page of draft.pageContracts.slice(0, 2)) {
    page.pageNumber = rawPageNumber;
    page.actionRequirements = [];
    page.actionSemanticCoverage = [
      {
        beatId: `beat:p${compilerPageNumber}:qa_duplicate`,
        sourceEvidenceId,
        disposition: {
          kind: 'non_visual',
          rationale: 'narrative_context',
        },
      },
    ];
  }
  return draft;
}

describe('Stage 3 — bounded repair loop', () => {
  it('a valid initial draft passes on attempt 1 with NO repair', async () => {
    const { caller, calls } = recordingCaller([bunnyDraft()]);
    const res = await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    expect(res.provenance.attempt).toBe(1);
    expect(res.repairAttempts).toHaveLength(0);
    expect(res.provenance.repairPromptVersion).toBeUndefined();
    expect(calls()).toBe(1);
    expect(res.provenance.maxOutputTokens).toBe(40_000);
  });

  it('routes a homogeneous closed-catalog gap through the compact presentation repair', async () => {
    const invalid = bunnyDraft();
    const pageIndex = 0;
    const firstPage = invalid.pageContracts[pageIndex];
    const coverageIndex = 0;
    const firstCoverage = firstPage.actionSemanticCoverage[coverageIndex];
    const targetBeatId = firstCoverage.beatId;
    firstCoverage.disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };
    let calls = 0;
    const authorities: unknown[] = [];
    const caller: ContractLlmCaller = async (_system, _user, options, authority) => {
      calls += 1;
      authorities.push({ options, authority });
      if (calls === 1) return JSON.stringify(invalid);
      return JSON.stringify({
        patches: [
          {
            pageNumber: firstPage.pageNumber,
            coverageIndex,
            beatId: targetBeatId,
            sourceEvidenceId: firstCoverage.sourceEvidenceId,
            presentationClass: 'composition_focus',
            contractPointer: `/pageContracts/${pageIndex}/mustShow/0`,
          },
        ],
      });
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toBe(2);
    expect(result.provenance.attempt).toBe(2);
    expect(result.provenance.repairPromptVersion).toBe(
      PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
    );
    expect(result.repairAttempts[0]?.nextRepairMode).toBe(
      'presentation_requirement_patch',
    );
    expect(
      result.actionSemanticCoverage.find(
        (record) => record.beatId === targetBeatId,
      )?.disposition,
    ).toMatchObject({
      kind: 'presentation_requirement',
      presentationClass: 'composition_focus',
    });
    const second = authorities[1] as {
      options: { jsonSchema?: { name: string }; maxOutputTokens?: number };
      authority: { repairMode: string };
    };
    expect(second.options.jsonSchema?.name).toBe(
      PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
    );
    expect(second.options.maxOutputTokens).toBe(32_000);
    expect(second.authority.repairMode).toBe(
      'presentation_requirement_patch',
    );
  });

  it('an invalid draft is REPAIRED and passes on attempt 2', async () => {
    const { caller, prompts, calls } = recordingCaller([withEmptyMaterial(), bunnyDraft()]);
    const res = await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    expect(res.provenance.attempt).toBe(2);
    expect(res.provenance.repairPromptVersion).toBe('vc-repair-prompt/v13');
    expect(res.repairAttempts).toHaveLength(1);
    expect(res.repairAttempts[0].attempt).toBe(1);
    expect(res.repairAttempts[0].diagnosticIssues.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.repairAttempts)).not.toMatch(/material/i);
    expect(calls()).toBe(2);
    expect(prompts.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
    ]);
    // The second call regenerates from the same complete source authority.
    expect(prompts[1].system).toMatch(/FULL-DRAFT REPAIR MODE/);
    const repairInput = decodeTemplateRepairUserPrompt(
      prompts[1].user,
    );
    const source = bunnySource();
    expect(repairInput.sourceAuthoringInput).toBe(
      buildTemplateCompileUserPrompt(
        source,
        extractDeterministicFacts(source),
      ),
    );
    expect(repairInput.validationIssues.length).toBeGreaterThan(0);
    expect(
      repairInput.validationIssues.every(
        draftValidationIssueIsValid,
      ),
    ).toBe(true);
  });

  it('routes action coverage cardinality through one complete-page repair', async () => {
    const valid = bunnyDraft();
    const validPage = valid.pageContracts[0];
    const actionIndex = 0;
    const beatId = validPage.actionSemanticCoverage[0].beatId;
    validPage.actionRequirements = [
      {
        beatId,
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
      },
    ];
    validPage.actionSemanticCoverage[0].disposition = {
      kind: 'action_requirement',
    };
    validPage.mustShow = [
      ...new Set([
        ...validPage.mustShow,
        ...projectPageMustShow(validPage, valid),
      ]),
    ];
    const invalid = structuredClone(valid);
    const invalidPage = invalid.pageContracts[0];
    const invalidCoverage = invalidPage.actionSemanticCoverage[0];
    invalidCoverage.disposition = {
      kind: 'non_visual',
      rationale: 'narrative_context',
    };
    const repairedPage = structuredClone(validPage);
    delete repairedPage.castIds;
    delete repairedPage.characterPresence;
    repairedPage.propConstraints ??= [];
    expect(() =>
      parsePageContractRepairs(
        JSON.stringify({ pageContracts: [repairedPage] }),
      ),
    ).not.toThrow();
    const calls: Array<{
      user: string;
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      _options,
      authority,
    ) => {
      calls.push({ user, authority });
      return calls.length === 1
        ? JSON.stringify(invalid)
        : JSON.stringify({ pageContracts: [repairedPage] });
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      repairMode: 'page_contract_patch',
      systemPromptVersion: PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
      userPromptVersion: 'page-contract-repair-user-prompt/v13',
    });
    const payload = decodePageContractRepairUserPrompt(
      calls[1]!.user,
    );
    expect(payload.affectedPages).toMatchObject([
      {
        pageNumber: invalidPage.pageNumber,
        repairTargets: [
          {
            family: 'action_semantic',
            code: 'action_coverage_cardinality_invalid',
            pageNumber: invalidPage.pageNumber,
            actionIndex,
          },
        ],
        permittedPointerValues: [],
      },
    ]);
    expect(result.provenance.attempt).toBe(2);
    expect(result.repairAttempts[0]?.nextRepairMode).toBe(
      'page_contract_patch',
    );
  });

  it('two invalid drafts are repaired and pass on attempt 3 within the 3-repair budget', async () => {
    const { caller, prompts, calls } = recordingCaller([withEmptyMaterial(), withEmptyMaterial(), bunnyDraft()]);
    const res = await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    expect(res.provenance.attempt).toBe(3);
    expect(res.repairAttempts).toHaveLength(2);
    expect(calls()).toBe(3);
    expect(prompts.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
    ]);
  });

  it('uses the approved fourth standard call and completes after three invalid validation frontiers', async () => {
    const { caller, prompts, calls } = recordingCaller([
      withEmptyMaterial(),
      withEmptyMaterial(),
      withEmptyMaterial(),
      bunnyDraft(),
    ]);
    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(result.provenance.attempt).toBe(4);
    expect(result.repairAttempts).toHaveLength(3);
    expect(calls()).toBe(4);
    expect(
      prompts.map((call) => call.options?.maxOutputTokens),
    ).toEqual([40_000, 32_000, 36_000, 36_000]);
    expect(
      result.repairAttempts.map((attempt) =>
        attempt.nextRepairBudgetClass,
      ),
    ).toEqual(['standard', 'standard', 'standard']);
  });

  it('uses the approved fifth standard call and completes after four invalid validation frontiers', async () => {
    const { caller, prompts, calls } = recordingCaller([
      withEmptyMaterial(),
      withEmptyMaterial(),
      withEmptyMaterial(),
      withEmptyMaterial(),
      bunnyDraft(),
    ]);
    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(result.provenance.attempt).toBe(5);
    expect(result.repairAttempts).toHaveLength(4);
    expect(calls()).toBe(5);
    expect(
      prompts.map((call) => call.options?.maxOutputTokens),
    ).toEqual([40_000, 32_000, 36_000, 36_000, 36_000]);
    expect(
      result.repairAttempts.map((attempt) =>
        attempt.nextRepairBudgetClass,
      ),
    ).toEqual(['standard', 'standard', 'standard', 'standard']);
  });

  it('a completed repair response that is unparseable remains distinct from full validation exhaustion', async () => {
    let calls = 0;
    const caller: ContractLlmCaller = async () => {
      calls += 1;
      if (calls === 1) return JSON.stringify(withEmptyMaterial()); // invalid initial → triggers a repair
      return 'not-json-at-all {{{'; // the repair response cannot be parsed
    };
    let thrown: unknown;
    try {
      await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(
      TemplateRepairOutputInvalidError,
    );
    const err = thrown as TemplateRepairOutputInvalidError;
    expect(err.attempts).toHaveLength(1); // only the typed failing-attempt summary is carried
    expect(err.attempts[0].diagnosticIssues.length).toBeGreaterThan(0);
    expect(JSON.stringify(err.attempts)).not.toMatch(/material/i);
    expect(err.repairAttempt).toBe(2);
    expect(err.repairMode).toBe('full_draft');
    expect(err.failureCode).toBe('json_invalid');
    expect(err.identity).toBe('unclassified');
    expect(err.message).toBe(
      'completed template repair output was unusable',
    );
    expect(calls).toBe(2); // initial + the one (failed) repair call
  });

  it('exhausts after the initial + 4 repairs, writes NOTHING, and does not over-call the model', async () => {
    // A 6th (valid) draft is provided but must NEVER be requested — the cap is 4 repairs.
    const { caller, calls } = recordingCaller([withEmptyMaterial(), withEmptyMaterial(), withEmptyMaterial(), withEmptyMaterial(), withEmptyMaterial(), bunnyDraft()]);
    let thrown: unknown;
    try {
      await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TemplateRepairExhaustedError);
    expect(thrown).toBeInstanceOf(InvalidTemplateContractError); // still catchable as the fail-closed type
    const err = thrown as TemplateRepairExhaustedError;
    expect(err.attempts).toHaveLength(5);
    expect(
      err.attempts.every((a) => a.diagnosticIssues.length > 0),
    ).toBe(true);
    expect(JSON.stringify(err.attempts)).not.toMatch(/material/i);
    expect(calls()).toBe(5); // initial + 4 repairs — the 6th valid draft was never requested
  });
  it.each([
    ['zero', 0, 'collection_item'],
    ['negative', -1, 'collection_item'],
    ['fractional', 1.5, 'collection_item'],
    ['string', '1', 'collection_item'],
    ['missing', undefined, 'collection_item'],
    ['positive control', 1, 'page'],
  ])(
    'keeps duplicate-beat diagnostics typed through bounded exhaustion for %s pageNumber',
    async (_label, pageNumber, expectedLocatorKind) => {
      const invalid = withDuplicateBeatOnRawPage(pageNumber);
      const { caller, calls } = recordingCaller([
        invalid,
        invalid,
        invalid,
        invalid,
        invalid,
      ]);
      let thrown: unknown;
      try {
        await compileBookVisualContractTemplate(bunnySource(), {
          callLLM: caller,
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TemplateRepairExhaustedError);
      const exhausted = thrown as TemplateRepairExhaustedError;
      expect(calls()).toBe(5);
      expect(exhausted.attempts).toHaveLength(5);
      expect(
        exhausted.attempts.every(
          (attempt) =>
            attempt.diagnosticIssues.length > 0 &&
            attempt.diagnosticIssues.every(draftValidationIssueIsValid),
        ),
      ).toBe(true);
      expect(exhausted.attempts[0]!.diagnosticIssues).toContainEqual(
        expect.objectContaining({
          family: 'action_semantic',
          code: 'beat_identity_duplicate',
          locator: expect.objectContaining({
            kind: expectedLocatorKind,
            fieldRole: 'identity',
          }),
        }),
      );
      expect(exhausted.attempts[0]!.nextRepairMode).toBe('full_draft');
    },
  );
});

describe('Stage 3 — repair prompt content (allowlist + inputs)', () => {
  it('the system prompt allowlists descriptive fields and forbids compiler-owned/fact fields', () => {
    const sys = buildTemplateRepairSystemPrompt();
    expect(sys).toMatch(/recurringProps/);
    expect(sys).toMatch(/MUST NOT output/);
    expect(sys).toMatch(/appearance/);
    expect(sys).toMatch(/DETERMINISTIC FACTS|AUTHORITATIVE/);
    expect(sys).toMatch(/castIds|characterPresence|laterality/);
  });

  it('carries the exact complete source input and canonical typed failures without the rejected draft', () => {
    const input = bunnySource();
    const facts = extractDeterministicFacts(input);
    const user = buildTemplateRepairUserPrompt(input, facts, [
      FULL_DRAFT_ISSUE,
      FULL_DRAFT_ISSUE,
    ]);
    const decoded = decodeTemplateRepairUserPrompt(user);
    expect(decoded.sourceAuthoringInput).toBe(
      buildTemplateCompileUserPrompt(input, facts),
    );
    expect(decoded.repairMode).toBe('regenerate_from_source');
    expect(decoded.validationIssues).toEqual([
      FULL_DRAFT_ISSUE,
    ]);
    expect(decoded.storyKey).toBe(input.storyKey);
    expect(decoded.pageCount).toBe(input.pageCount);
    expect(user).not.toContain(
      JSON.stringify(withEmptyMaterial()),
    );
  });

  it('roundtrips the canonical tuple and rejects malformed or non-canonical encodings', () => {
    const input = bunnySource();
    const user = buildTemplateRepairUserPrompt(
      input,
      extractDeterministicFacts(input),
      [FULL_DRAFT_ISSUE],
    );
    const { source, envelope } = repairEnvelopeParts(user);
    expect(decodeTemplateRepairUserPrompt(user)).toEqual(
      decodeTemplateRepairUserPrompt(user),
    );
    expect(() =>
      decodeTemplateRepairUserPrompt('{'),
    ).toThrow('template_repair_input_encoding_invalid');
    expect(() =>
      decodeTemplateRepairUserPrompt(
        [
          source,
          TEMPLATE_REPAIR_ISSUES_MARKER,
          JSON.stringify([...envelope, true]),
        ].join('\n'),
      ),
    ).toThrow('template_repair_input_encoding_invalid');
    expect(() =>
      decodeTemplateRepairUserPrompt(
        [
          source,
          TEMPLATE_REPAIR_ISSUES_MARKER,
          JSON.stringify([
            ...envelope.slice(0, 3),
            [...(envelope[3] as string[]), 'unused_dictionary_entry'],
            ...envelope.slice(4),
          ]),
        ].join('\n'),
      ),
    ).toThrow('template_repair_input_encoding_invalid');
  });

  it('keeps a maximal typed source-regeneration repair below the unchanged conservative 64K ceiling', () => {
    const input = bunnySource();
    const issues = Array.from({ length: 128 }, (_, index) => ({
      family: 'action_semantic' as const,
      code: 'closed_catalog_capability_gap' as const,
      locator: {
        kind: 'page_item' as const,
        pageNumber: (index % 12) + 1,
        collectionRole:
          'page_action_semantic_coverage' as const,
        itemIndex: index,
        fieldRole: 'disposition' as const,
      },
    }));
    const user = buildTemplateRepairUserPrompt(
      input,
      extractDeterministicFacts(input),
      issues,
    );
    const upperBound =
      Buffer.byteLength(
        [
          buildTemplateRepairSystemPrompt(),
          user,
          JSON.stringify(TEMPLATE_DRAFT_JSON_SCHEMA),
        ].join('\n'),
        'utf8',
      ) + 4_096;

    expect(upperBound).toBeLessThanOrEqual(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS - upperBound,
    ).toBeGreaterThan(4_096);
    expect(
      decodeTemplateRepairUserPrompt(user).validationIssues,
    ).toHaveLength(128);
  });
});

describe('Source Evidence ID compact repair', () => {
  it.each([
    ['zero', 0, 'collection_item'],
    ['negative', -1, 'collection_item'],
    ['fractional', 1.5, 'collection_item'],
    ['string', '1', 'collection_item'],
    ['missing', undefined, 'collection_item'],
    ['positive control', 1, 'source_evidence'],
  ])(
    'constructs the typed bridge without a plain Error for %s pageNumber',
    (_label, pageNumber, expectedLocatorKind) => {
      let thrown: unknown;
      try {
        throw new SourceEvidenceIdValidationError(
          [
            {
              pageNumber: pageNumber as number,
              coverageIndex: 0,
              beatId: 'beat:p1:qa_source',
              failureCode: 'source_evidence_id_unknown',
              coverageRecord: {
                beatId: 'beat:p1:qa_source',
                sourceEvidenceId: 'invalid',
                disposition: {
                  kind: 'non_visual',
                  rationale: 'narrative_context',
                },
              },
              actionRequirement: null,
            },
          ],
          ['source evidence id is invalid'],
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SourceEvidenceIdValidationError);
      expect(thrown).toBeInstanceOf(InvalidTemplateContractError);
      const invalid = thrown as SourceEvidenceIdValidationError;
      expect(invalid.diagnosticIssues).toHaveLength(1);
      expect(invalid.diagnosticIssues[0]).toEqual(
        expect.objectContaining({
          family: 'source_evidence_id',
          code: 'source_evidence_id_unknown',
          locator: expect.objectContaining({
            kind: expectedLocatorKind,
            fieldRole: 'source_evidence',
          }),
        }),
      );
      expect(invalid.diagnosticIssues.every(draftValidationIssueIsValid)).toBe(
        true,
      );
      if (expectedLocatorKind === 'collection_item') {
        expect(JSON.stringify(invalid.diagnosticIssues)).not.toContain(
          'pageNumber',
        );
      }
    },
  );

  it('repairs the observed eleven-failure shape with a compact ID patch and revalidates the full draft', async () => {
    const input = bunnySource();
    const invalid = withElevenInvalidEvidenceIds();
    const calls: Array<{
      system: string;
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      system,
      user,
      options,
      authority,
    ) => {
      calls.push({ system, user, options, authority });
      if (calls.length === 1) return JSON.stringify(invalid);
      const affected = JSON.parse(user).affectedRecords as Array<{
        pageNumber: number;
        beatId: string;
      }>;
      return JSON.stringify({
        patches: affected.map((record) => ({
          pageNumber: record.pageNumber,
          beatId: record.beatId,
          sourceEvidenceId: input.sourceEvidenceCatalog.entries.find(
            (entry) => entry.pageNumber === record.pageNumber,
          )!.sourceEvidenceId,
        })),
      });
    };

    const result = await compileBookVisualContractTemplate(input, {
      callLLM: caller,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toEqual({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'source_evidence_id_patch',
      systemPromptVersion: SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
      userPromptVersion: 'source-evidence-id-repair-user-prompt/v2',
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
    );
    expect(calls[1]!.options?.maxInputTokens).toBe(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(calls[1]!.options?.maxOutputTokens).toBe(32_000);
    const compactPayload = JSON.parse(calls[1]!.user) as {
      affectedRecords: unknown[];
      catalogEntries: Array<{ pageNumber: number }>;
    };
    expect(compactPayload.affectedRecords).toHaveLength(11);
    expect(
      new Set(
        compactPayload.catalogEntries.map((entry) => entry.pageNumber),
      ),
    ).toEqual(new Set([6, 8, 9, 10, 11, 12]));
    expect(calls[1]!.user).not.toContain('"worldType"');
    const conservativeUpperBound =
      Buffer.byteLength(
        [
          calls[1]!.system,
          calls[1]!.user,
          JSON.stringify(SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA),
        ].join('\n'),
        'utf8',
      ) + 256;
    expect(conservativeUpperBound).toBeLessThan(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
    );
    expect(result.provenance.attempt).toBe(2);
    expect(result.provenance.repairPromptVersion).toBe(
      SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
    );
    expect(result.repairAttempts).toHaveLength(1);
    expect(result.repairAttempts[0]!.nextRepairMode).toBe(
      'source_evidence_id_patch',
    );
    expect(result.actionSemanticCoverage).toHaveLength(17);
    for (const record of result.actionSemanticCoverage) {
      const entry = input.sourceEvidenceCatalog.entries.find(
        (candidate) =>
          candidate.sourceEvidenceId === record.sourceEvidenceId,
      );
      expect(entry?.pageNumber).toBe(record.pageNumber);
      expect(record.sourcePhrase).toBe(entry?.excerpt);
    }
    expect(
      result.template.pageContracts.flatMap(
        (page) => page.actionRequirements ?? [],
      ),
    ).toSatisfy((actions: unknown[]) =>
      actions.every(
        (action) =>
          !Object.prototype.hasOwnProperty.call(
            action as object,
            'sourcePhrase',
          ),
      ),
    );
  });

  it('keeps mixed source-ID and other failures on the existing whole-draft repair path', async () => {
    const invalid = withElevenInvalidEvidenceIds();
    invalid.recurringProps[0].material = '';
    const calls: Array<{
      system: string;
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      system,
      user,
      options,
      authority,
    ) => {
      calls.push({ system, user, options, authority });
      return JSON.stringify(calls.length === 1 ? invalid : bunnyDraft());
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      repairMode: 'full_draft',
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      TEMPLATE_DRAFT_SCHEMA_NAME,
    );
    expect(calls[1]!.options?.maxOutputTokens).toBe(32_000);
    expect(calls[1]!.system).toMatch(/FULL-DRAFT REPAIR MODE/);
    const repairInput = decodeTemplateRepairUserPrompt(
      calls[1]!.user,
    );
    expect(repairInput.sourceAuthoringInput).toBe(
      buildTemplateCompileUserPrompt(
        bunnySource(),
        extractDeterministicFacts(bunnySource()),
      ),
    );
    expect(repairInput.validationIssues).toEqual(
      result.repairAttempts[0]!.diagnosticIssues,
    );
    expect(JSON.stringify(repairInput)).not.toContain(
      JSON.stringify(invalid),
    );
    expect(result.repairAttempts[0]!.nextRepairMode).toBe('full_draft');
  });
});

describe('page-contract compact repair routing', () => {
  it('keeps the terminal cleanup predecessor catalog closed', () => {
    expect(
      ['book_surface_patch', 'full_draft'].filter(
        terminalReferenceCleanupPredecessorIsEligible,
      ),
    ).toEqual(['book_surface_patch', 'full_draft']);
    for (const mode of [
      undefined,
      null,
      'source_evidence_id_patch',
      'page_contract_patch',
      'page_spatial_reference_patch',
      'stable_prop_scope_patch',
      'presentation_requirement_patch',
      'structural_bundle_patch',
      'unknown_repair_mode',
    ]) {
      expect(
        terminalReferenceCleanupPredecessorIsEligible(mode),
      ).toBe(false);
    }
  });

  it('routes the live-shaped spatial then mixed surface through atomic v5 and returns a three-call candidate', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    const page1 = initial.pageContracts[0];
    const page2 = initial.pageContracts[1];
    const page1Zone = initial.zones.find(
      (zone: { id: string }) => zone.id === page1.zoneId,
    );
    if (!page1Zone) throw new Error('missing page-1 zone fixture');
    page1Zone.spatialNodes = [
      {
        id: 'waiting_chair',
        kind: 'furniture',
        description: 'the stable waiting-room chair',
        bindsTo: null,
      },
    ];
    page1Zone.spatialRelations = [];
    const page1BeatId = page1.actionSemanticCoverage[0].beatId;
    page1.actionRequirements = [
      {
        beatId: page1BeatId,
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: {
          kind: 'spatial',
          id: 'outside_current_page_zone',
        },
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'must',
        laterality: null,
      },
    ];
    page1.actionSemanticCoverage[0].disposition = {
      kind: 'action_requirement',
    };
    page1.mustShow = [
      ...new Set([
        ...page1.mustShow,
        ...projectPageMustShow(page1, valid),
      ]),
    ];
    initial.coverContract.mustShow = [''];
    page2.camera = '';
    page2.actionSemanticCoverage[0].disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };
    ensureBookSurfacePageShape(initial);
    const frozenPage1MustShowPrefix = structuredClone(
      initial.pageContracts[0].mustShow,
    );
    const frozenPresentationMustShow = structuredClone(
      initial.pageContracts[1].mustShow,
    );

    const repairedCover = {
      ...structuredClone(valid.coverContract),
      worldType: 'provider-forged-world',
      locationId: 'loc:provider-forged',
      zoneId: 'zone:provider-forged',
      castIds: ['cast:provider-forged'],
    };
    const repairedPage2 = structuredClone(valid.pageContracts[1]);
    delete repairedPage2.castIds;
    delete repairedPage2.characterPresence;
    delete repairedPage2.castStates;
    repairedPage2.propConstraints ??= [];
    repairedPage2.actionRequirements ??= [];
    repairedPage2.mustShow = [
      'provider replaced and shortened the selected presentation array',
    ];
    const repairedPages = initial.pageContracts.map(
      (page: Record<string, unknown>) => structuredClone(page),
    );
    const repairedPage1 = repairedPages[0] as Record<string, unknown> & {
      actionRequirements: Array<{
        object: { id: string };
      }>;
      mustShow: string[];
    };
    repairedPage1.actionRequirements[0]!.object.id = 'waiting_chair';
    repairedPage1.mustShow = [
      ...new Set([
        ...valid.pageContracts[0].mustShow,
        ...projectPageMustShow(
          repairedPage1 as unknown as Parameters<
            typeof projectPageMustShow
          >[0],
          initial,
        ),
      ]),
    ];
    repairedPages[1] = repairedPage2;

    const calls: Array<{
      system: string;
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      system,
      user,
      options,
      authority,
    ) => {
      calls.push({ system, user, options, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      if (calls.length === 2) {
        const payload = JSON.parse(user) as {
          targets: Array<{
            pageNumber: number;
            actionIndex: number;
            fieldRole: string;
            permittedSpatialReferences: Array<{ id: string }>;
          }>;
        };
        return JSON.stringify({
          patches: payload.targets.map((target) => ({
            pageNumber: target.pageNumber,
            actionIndex: target.actionIndex,
            fieldRole: target.fieldRole,
            spatialReferenceId:
              target.permittedSpatialReferences[0]!.id,
          })),
        });
      }
      const payload = decodeBookSurfaceRepairUserPrompt(user);
      return JSON.stringify(
        bookSurfaceV6Response({
          payload,
          coverContract: repairedCover,
          recurringProps: null,
          repairedPages,
          hostileEchoIdentity: true,
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(3);
    expect(
      calls.map((call) =>
        call.authority?.kind === 'repair'
          ? call.authority.repairMode
          : null,
      ),
    ).toEqual([
      null,
      'page_spatial_reference_patch',
      'book_surface_patch',
    ]);
    expect(calls.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
    ]);
    const payload = decodeBookSurfaceRepairUserPrompt(calls[2]!.user);
    expect(
      (payload.presentationTargets as Array<{ pageNumber: number }>).map(
        (target) => target.pageNumber,
      ),
    ).toEqual([2]);
    expect(
      (payload.affectedPages as Array<{ pageNumber: number }>).map(
        (page) => page.pageNumber,
      ),
    ).toEqual([2]);
    expect(payload.coverAuthority).not.toBeNull();
    const accounting = visualContractAuthoringInputAccounting(
      calls[2]!.system,
      calls[2]!.user,
      BOOK_SURFACE_REPAIR_JSON_SCHEMA,
    );
    expect(
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS -
        VISUAL_CONTRACT_AUTHORING_ROUTE_SAFETY_MARGIN,
    ).toBe(59_904);
    expect(accounting.estimatedBytes).toBeLessThanOrEqual(59_904);
    const compilerCoverAuthority = (
      payload.coverAuthority as {
        coverContract: {
          worldType: string;
          locationId: string;
          zoneId: string;
          castIds: string[];
        };
      }
    ).coverContract;
    expect(result.template.coverContract).toMatchObject({
      worldType: compilerCoverAuthority.worldType,
      locationId: compilerCoverAuthority.locationId,
      zoneId: compilerCoverAuthority.zoneId,
      castIds: compilerCoverAuthority.castIds,
    });
    const presentationTarget = (
      payload.presentationTargets as PresentationRequirementRepairTarget[]
    )[0]!;
    const finalCoverage = result.actionSemanticCoverage.find(
      (record) =>
        record.pageNumber === presentationTarget.pageNumber &&
        record.beatId === presentationTarget.beatId,
    );
    expect(finalCoverage).toBeDefined();
    const finalDisposition = finalCoverage!.disposition as {
      contractPointer: string;
      contractValue: string;
    };
    const pointerParts = finalDisposition.contractPointer.split('/');
    const selectedMustShowIndex = Number(
      pointerParts[pointerParts.length - 1],
    );
    const finalPage = result.template.pageContracts.find(
      (page) => page.pageNumber === presentationTarget.pageNumber,
    );
    expect(finalPage).toBeDefined();
    expect(finalPage!.mustShow).toEqual(frozenPresentationMustShow);
    expect(finalDisposition.contractValue).toBe(
      finalPage!.mustShow[selectedMustShowIndex],
    );
    const finalPage1 = result.template.pageContracts.find(
      (page) => page.pageNumber === 1,
    )!;
    expect(
      finalPage1.mustShow.slice(0, frozenPage1MustShowPrefix.length),
    ).toEqual(frozenPage1MustShowPrefix);
    const finalPage1Projections = projectPageMustShow(
      finalPage1,
      result.template as unknown as Parameters<
        typeof projectPageMustShow
      >[1],
    );
    const appendedPage1Projections = finalPage1Projections.filter(
      (value) => !frozenPage1MustShowPrefix.includes(value),
    );
    expect(appendedPage1Projections.length).toBeGreaterThan(0);
    expect(finalPage1.mustShow.slice(-appendedPage1Projections.length)).toEqual(
      appendedPage1Projections,
    );
    for (const projection of appendedPage1Projections) {
      expect(
        finalPage1.mustShow.filter((value) => value === projection),
      ).toHaveLength(1);
    }
    expect(result.provenance.attempt).toBe(3);
    expect(
      result.repairAttempts[1]?.diagnosticIssues.some(
        (issue) =>
          issue.family === 'draft_contract' &&
          issue.code === 'final_structural_invariant_invalid' &&
          issue.locator.kind === 'page' &&
          issue.locator.pageNumber === 2 &&
          'causes' in issue &&
          issue.causes.includes('page_steering_invalid'),
      ),
    ).toBe(true);
    expect(
      result.repairAttempts.map((attempt) => attempt.nextRepairMode),
    ).toEqual([
      'page_spatial_reference_patch',
      'book_surface_patch',
    ]);
  });

  it('closes the observed spatial, BookSurface, spatial, BookSurface frontier in five standard calls', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    ensureBookSurfacePageShape(initial);
    const page1 = initial.pageContracts[0]!;
    const page2 = initial.pageContracts[1]!;
    const page1Zone = initial.zones.find(
      (zone: { id: string }) => zone.id === page1.zoneId,
    );
    if (!page1Zone) throw new Error('missing page-1 zone fixture');
    page1Zone.spatialNodes = [
      {
        id: 'waiting_chair',
        kind: 'furniture',
        description: 'the stable waiting-room chair',
        bindsTo: null,
      },
    ];
    page1Zone.spatialRelations = [];
    page1.actionRequirements = [
      {
        beatId: page1.actionSemanticCoverage[0]!.beatId,
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: { kind: 'spatial', id: 'outside_current_page_zone' },
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'must',
        laterality: null,
      },
    ];
    page1.actionSemanticCoverage[0]!.disposition = {
      kind: 'action_requirement',
    };
    page2.actionRequirements = [
      {
        beatId: page2.actionSemanticCoverage[0]!.beatId,
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'opens',
        object: null,
        spatialEffect: null,
        spatialConstraint: null,
        polarity: 'must',
        laterality: null,
      },
    ];
    page2.actionSemanticCoverage[0]!.disposition = {
      kind: 'action_requirement',
    };
    page2.camera = '';
    initial.coverContract.mustShow = [''];

    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      if (calls.length === 2 || calls.length === 4) {
        const payload = JSON.parse(user) as {
          targets: Array<{
            pageNumber: number;
            actionIndex: number;
            fieldRole: string;
            permittedSpatialReferences: Array<{ id: string }>;
          }>;
        };
        return JSON.stringify({
          patches: payload.targets.map((target) => ({
            pageNumber: target.pageNumber,
            actionIndex: target.actionIndex,
            fieldRole: target.fieldRole,
            spatialReferenceId:
              target.permittedSpatialReferences[0]!.id,
          })),
        });
      }
      const payload = decodeBookSurfaceRepairUserPrompt(user);
      const affectedPages = payload.affectedPages as Array<{
        pageNumber: number;
        pageStructuralProjection: Record<string, unknown>;
      }>;
      const coverAuthority = payload.coverAuthority as
        | { coverContract: Record<string, unknown> }
        | null;
      const repairedPages = affectedPages.map((affectedPage) => {
        const repaired = structuredClone(
          affectedPage.pageStructuralProjection,
        );
        if (calls.length === 3 && affectedPage.pageNumber === 2) {
          const actions = repaired.actionRequirements as Array<
            Record<string, unknown>
          >;
          actions[0] = {
            beatId: page2.actionSemanticCoverage[0]!.beatId,
            subject: {
              kind: 'entity',
              entity: { kind: 'cast', id: 'child:hero' },
            },
            predicate: 'looks_at',
            object: {
              kind: 'spatial',
              id: 'outside_current_page_zone_after_surface',
            },
            spatialEffect: null,
            spatialConstraint: null,
            polarity: 'must',
            laterality: null,
          };
          actions.push({
            ...structuredClone(actions[0]),
            beatId: 'beat:p2:provider_extra_unbound',
          });
          repaired.camera = '';
        } else if (affectedPage.pageNumber === 2) {
          repaired.camera = valid.pageContracts[1]!.camera;
        }
        return repaired;
      });
      return JSON.stringify(
        bookSurfaceV6Response({
          payload,
          coverContract:
            calls.length === 3
              ? {
                  ...structuredClone(
                    coverAuthority?.coverContract ?? {},
                  ),
                  mustShow: structuredClone(
                    valid.coverContract.mustShow,
                  ),
                }
              : null,
          recurringProps: null,
          repairedPages,
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(5);
    expect(
      calls.map((call) =>
        call.authority?.kind === 'repair'
          ? call.authority.repairMode
          : null,
      ),
    ).toEqual([
      null,
      'page_spatial_reference_patch',
      'book_surface_patch',
      'page_spatial_reference_patch',
      'book_surface_patch',
    ]);
    expect(calls.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
      36_000,
      36_000,
    ]);
    expect(result.provenance.attempt).toBe(5);
    expect(result.repairAttempts.map((attempt) => attempt.nextRepairMode))
      .toEqual([
        'page_spatial_reference_patch',
        'book_surface_patch',
        'page_spatial_reference_patch',
        'book_surface_patch',
      ]);
    const finalPage2 = result.template.pageContracts.find(
      (page) => page.pageNumber === 2,
    )!;
    expect(finalPage2.camera).toBe(valid.pageContracts[1]!.camera);
    expect(finalPage2.actionRequirements).toHaveLength(1);
    const finalPage2Coverage = result.actionSemanticCoverage.filter(
      (coverage) => coverage.pageNumber === 2,
    );
    expect(finalPage2Coverage).toHaveLength(
      page2.actionSemanticCoverage.length,
    );
    expect(finalPage2Coverage.map((coverage) => coverage.beatId)).toEqual(
      page2.actionSemanticCoverage.map(
        (coverage: { beatId: string }) => coverage.beatId,
      ),
    );
    expect(finalPage2Coverage[0]!.disposition).toMatchObject({
      kind: 'action_requirement',
    });
  });

  it('closes a provider-completed page transition endpoint defect locally without consuming a repair call', async () => {
    const draft = bunnyDraft();
    const page3 = draft.pageContracts.find(
      (page: { pageNumber: number }) => page.pageNumber === 3,
    )!;
    page3.transition = {
      kind: 'before_transition',
      fromZoneId: null,
      toZoneId: 'clinic.exam_room',
      cue: 'the doctor calls from the open exam-room door',
    };
    const before = structuredClone(draft);
    let callCount = 0;

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: async () => {
        callCount += 1;
        return JSON.stringify(draft);
      },
    });

    expect(callCount).toBe(1);
    expect(result.repairAttempts).toEqual([]);
    expect(result.provenance.attempt).toBe(1);
    expect(draft).toEqual(before);
    expect(
      result.template.pageContracts.find((page) => page.pageNumber === 3)
        ?.transition,
    ).toEqual({
      kind: 'before_transition',
      fromZoneId: 'clinic.waiting_room',
      toZoneId: 'clinic.exam_room',
      cue: 'the doctor calls from the open exam-room door',
    });
    expect(result.notes).toContainEqual(
      expect.stringMatching(
        /page 3 before_transition transition endpoints normalized/,
      ),
    );
  });

  it('routes a latent mixed cover/page/presentation failure through one bounded book-surface repair', async () => {
    const valid = bunnyDraft();
    const page2Zone = valid.zones.find(
      (zone: { id: string }) =>
        zone.id === valid.pageContracts[1].zoneId,
    );
    if (!page2Zone) throw new Error('missing page-2 zone fixture');
    page2Zone.spatialNodes = [
      {
        id: 'waiting_chair',
        kind: 'furniture',
        description: 'the stable waiting-room chair',
        bindsTo: null,
      },
    ];
    page2Zone.spatialRelations = [];
    const validPage1 = structuredClone(valid.pageContracts[0]);
    const page1BeatId = validPage1.actionSemanticCoverage[0].beatId;
    validPage1.actionRequirements = [
      {
        beatId: page1BeatId,
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
      },
    ];
    validPage1.actionSemanticCoverage[0].disposition = {
      kind: 'action_requirement',
    };
    validPage1.mustShow = [
      ...new Set([
        ...validPage1.mustShow,
        ...projectPageMustShow(validPage1, valid),
      ]),
    ];
    delete validPage1.castIds;
    delete validPage1.characterPresence;
    validPage1.propConstraints ??= [];

    const initial = structuredClone(valid);
    const repairedCover = {
      ...structuredClone(valid.coverContract),
      zoneId: valid.pageContracts[0].zoneId,
      castIds: ['child:hero', 'companion:bunny_ometz'],
    };
    initial.coverContract = structuredClone(repairedCover);
    initial.pageContracts[0] = structuredClone(validPage1);
    initial.pageContracts[0].actionSemanticCoverage[0].disposition = {
      kind: 'non_visual',
      rationale: 'narrative_context',
    };
    initial.coverContract.mustShow = [''];
    initial.pageContracts[1].camera = '';
    // The provider can include a cast identity that the compiler correctly
    // drops. Raw-draft reference extraction is therefore ambiguous while the
    // compiler-normalized authority used by the final validator is exact.
    initial.humanCast = [
      {
        id: 'child:hero',
        garments: [],
        forbiddenAppearance: [],
      },
    ];
    initial.pageContracts[1].actionSemanticCoverage[0].disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };
    ensureBookSurfacePageShape(initial);

    const repairedPage2 = structuredClone(valid.pageContracts[1]);
    delete repairedPage2.castIds;
    delete repairedPage2.characterPresence;
    repairedPage2.propConstraints ??= [];
    repairedPage2.actionRequirements ??= [];
    repairedPage2.actionSemanticCoverage[0].disposition = {
      kind: 'presentation_requirement',
      presentationClass: 'composition_focus',
      contractPointer: '/pageContracts/1/mustShow/0',
      contractValue: repairedPage2.mustShow[0],
    };
    repairedPage2.actionRequirements = [];

    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      if (calls.length === 2) {
        return JSON.stringify({ pageContracts: [validPage1] });
      }
      if (calls.length === 3) {
        const payload = decodeBookSurfaceRepairUserPrompt(user);
        return JSON.stringify(
          bookSurfaceV6Response({
            payload,
            coverContract: repairedCover,
            recurringProps: null,
            repairedPages: [repairedPage2],
          }),
        );
      }
      const payload = JSON.parse(user) as {
        targets: Array<{
          pageNumber: number;
          actionIndex: number;
          fieldRole: string;
          permittedSpatialReferences: Array<{ id: string }>;
        }>;
      };
      return JSON.stringify({
        patches: payload.targets.map((target) => ({
          pageNumber: target.pageNumber,
          actionIndex: target.actionIndex,
          fieldRole: target.fieldRole,
          spatialReferenceId:
            target.permittedSpatialReferences[0]!.id,
        })),
      });
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(3);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      repairMode: 'page_contract_patch',
    });
    expect(calls[2]!.authority).toEqual({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'book_surface_patch',
      systemPromptVersion: BOOK_SURFACE_REPAIR_PROMPT_VERSION,
      userPromptVersion: BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
    });
    expect(calls[2]!.options?.jsonSchema?.name).toBe(
      BOOK_SURFACE_REPAIR_SCHEMA_NAME,
    );
    expect(calls.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
    ]);
    const payload = decodeBookSurfaceRepairUserPrompt(calls[2]!.user);
    expect(payload.coverAuthority).toMatchObject({
      coverContract: initial.coverContract,
    });
    expect(payload.recurringPropAuthority).toBeNull();
    expect(payload.presentationTargets).toHaveLength(1);
    expect(
      (payload.affectedPages as Array<{ pageNumber: number }>).map(
        (value) => value.pageNumber,
      ),
    ).toEqual([2]);
    expect(payload).not.toHaveProperty('previousDraft');
    expect(payload).not.toHaveProperty('storySource');
    expect(result.provenance.attempt).toBe(3);
    expect(result.provenance.repairPromptVersion).toBe(
      BOOK_SURFACE_REPAIR_PROMPT_VERSION,
    );
    expect(
      result.repairAttempts.map((attempt) => attempt.nextRepairMode),
    ).toEqual([
      'page_contract_patch',
      'book_surface_patch',
    ]);
  });

  it('repeats BookSurface v6 with null cover after the mixed repair leaves only page structure', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    initial.coverContract.mustShow = [''];
    initial.pageContracts[0].camera = '';
    initial.pageContracts[1].actionSemanticCoverage[0].disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };
    initial.recurringProps[0].firstRevealPage =
      initial.pageContracts.length + 10;
    ensureBookSurfacePageShape(initial);

    const repairedCover = {
      ...structuredClone(valid.coverContract),
      zoneId: valid.pageContracts[0].zoneId,
      castIds: ['child:hero', 'companion:bunny_ometz'],
    };
    const repairedPage1 = structuredClone(valid.pageContracts[0]);
    delete repairedPage1.castIds;
    delete repairedPage1.characterPresence;
    repairedPage1.propConstraints ??= [];
    repairedPage1.actionRequirements ??= [];
    const stillInvalidPage1 = structuredClone(initial.pageContracts[0]);
    delete stillInvalidPage1.castIds;
    delete stillInvalidPage1.characterPresence;
    delete stillInvalidPage1.castStates;
    stillInvalidPage1.propConstraints ??= [];
    stillInvalidPage1.actionRequirements ??= [];
    const repairedPage2 = structuredClone(valid.pageContracts[1]);
    delete repairedPage2.castIds;
    delete repairedPage2.characterPresence;
    repairedPage2.propConstraints ??= [];
    repairedPage2.actionRequirements = [];
    repairedPage2.actionSemanticCoverage[0].disposition = {
      kind: 'presentation_requirement',
      presentationClass: 'composition_focus',
      contractPointer: '/pageContracts/1/mustShow/0',
      contractValue: repairedPage2.mustShow[0],
    };

    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      const payload = decodeBookSurfaceRepairUserPrompt(user);
      if (calls.length === 2) {
        return JSON.stringify(
          bookSurfaceV6Response({
            payload,
            coverContract: repairedCover,
            recurringProps: valid.recurringProps,
            repairedPages: [stillInvalidPage1, repairedPage2],
          }),
        );
      }
      return JSON.stringify(
        bookSurfaceV6Response({
          payload,
          coverContract: null,
          recurringProps: null,
          repairedPages: [repairedPage1],
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(3);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      repairMode: 'book_surface_patch',
      systemPromptVersion: BOOK_SURFACE_REPAIR_PROMPT_VERSION,
      userPromptVersion: BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
    });
    const payload = decodeBookSurfaceRepairUserPrompt(calls[1]!.user);
    expect(payload.recurringPropAuthority).toMatchObject({
      recurringProps: initial.recurringProps,
    });
    expect(
      (payload.affectedPages as Array<{ pageNumber: number }>).map(
        (value) => value.pageNumber,
      ),
    ).toEqual([1]);
    expect(
      (payload.presentationTargets as Array<{ pageNumber: number }>).map(
        (value) => value.pageNumber,
      ),
    ).toEqual([2]);
    const pureStructuralPayload = decodeBookSurfaceRepairUserPrompt(
      calls[2]!.user,
    );
    expect(pureStructuralPayload.coverAuthority).toBeNull();
    expect(pureStructuralPayload.recurringPropAuthority).toBeNull();
    expect(pureStructuralPayload.presentationTargets).toEqual([]);
    expect(
      (pureStructuralPayload.affectedPages as Array<{
        pageNumber: number;
      }>).map((value) => value.pageNumber),
    ).toEqual([1]);
    expect(
      calls.map((call) =>
        call.authority?.kind === 'repair'
          ? call.authority.repairMode
          : null,
      ),
    ).toEqual([null, 'book_surface_patch', 'book_surface_patch']);
    expect(calls.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
    ]);
    expect(result.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        pageNumber: 1,
        beatId: initial.pageContracts[0].actionSemanticCoverage[0].beatId,
        sourceEvidenceId:
          initial.pageContracts[0].actionSemanticCoverage[0].sourceEvidenceId,
        disposition:
          initial.pageContracts[0].actionSemanticCoverage[0].disposition,
      }),
    );
    expect(result.provenance.attempt).toBe(3);
    expect(
      result.repairAttempts.map((attempt) => attempt.nextRepairMode),
    ).toEqual(['book_surface_patch', 'book_surface_patch']);
  });

  it('splits an input-inadmissible mixed book surface into compact presentation then pure structural repair', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    const repairedCover = {
      ...structuredClone(valid.coverContract),
      zoneId: valid.pageContracts[0].zoneId,
      castIds: ['child:hero', 'companion:bunny_ometz'],
    };
    initial.coverContract.mustShow = [''];
    initial.recurringProps[0].firstRevealPage =
      initial.pageContracts.length + 1;
    let remainingPresentationTargets = initial.pageContracts.length;
    for (const [pageIndex, pageContract] of initial.pageContracts.entries()) {
      pageContract.camera = '';
      pageContract.mustNotShow = [
        ...valid.pageContracts[pageIndex].mustNotShow,
        `structural-only page ${pageIndex + 1} ${String.fromCharCode(
          97 + pageIndex,
        ).repeat(22_000)}`,
      ];
      remainingPresentationTargets -= 1;
      pageContract.actionSemanticCoverage[0].disposition = {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      };
    }
    expect(remainingPresentationTargets).toBe(0);
    ensureBookSurfacePageShape(initial);

    const calls: Array<{
      system: string;
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    let postPresentationDraft: Record<string, unknown> | null = null;
    const caller: ContractLlmCaller = async (
      system,
      user,
      options,
      authority,
    ) => {
      calls.push({ system, user, options, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      if (calls.length === 2) {
        const payload = JSON.parse(user) as {
          targets: PresentationRequirementRepairTarget[];
        };
        const patches: PresentationRequirementRepairPatch[] =
          payload.targets.map((target) => ({
            pageNumber: target.pageNumber,
            coverageIndex: target.coverageIndex,
            beatId: target.beatId,
            sourceEvidenceId: target.sourceEvidenceId,
            presentationClass: 'composition_focus',
            contractPointer:
              target.permittedPointerValues[0]!.contractPointer,
          }));
        const nextDraft = structuredClone(initial) as Record<
          string,
          unknown
        >;
        postPresentationDraft = nextDraft;
        const pages = nextDraft.pageContracts as Record<
          string,
          unknown
        >[];
        for (const [patchIndex, patch] of patches.entries()) {
          const target = payload.targets[patchIndex]!;
          const page = pages.find(
            (candidate) => candidate.pageNumber === patch.pageNumber,
          );
          const coverage = page?.actionSemanticCoverage as
            | Record<string, unknown>[]
            | undefined;
          if (!coverage?.[patch.coverageIndex]) {
            throw new Error('missing presentation coverage fixture');
          }
          const permitted = target.permittedPointerValues.find(
            (value) =>
              value.contractPointer === patch.contractPointer,
          );
          coverage[patch.coverageIndex]!.disposition = {
            kind: 'presentation_requirement',
            presentationClass: patch.presentationClass,
            contractPointer: patch.contractPointer,
            contractValue: permitted!.contractValue,
          };
        }
        return JSON.stringify({ patches });
      }
      if (!postPresentationDraft) {
        throw new Error('missing post-presentation draft fixture');
      }
      const repairedPages = (
        postPresentationDraft.pageContracts as Record<string, unknown>[]
      ).map((pageContract, pageIndex) => {
        const repairedPage = structuredClone(
          valid.pageContracts[pageIndex],
        );
        repairedPage.mustShow = structuredClone(pageContract.mustShow);
        repairedPage.actionSemanticCoverage = structuredClone(
          pageContract.actionSemanticCoverage,
        );
        delete repairedPage.castIds;
        delete repairedPage.characterPresence;
        delete repairedPage.castStates;
        repairedPage.propConstraints ??= [];
        repairedPage.actionRequirements ??= [];
        return repairedPage;
      });
      const payload = decodeBookSurfaceRepairUserPrompt(user);
      return JSON.stringify(
        bookSurfaceV6Response({
          payload,
          coverContract: repairedCover,
          recurringProps: valid.recurringProps,
          repairedPages,
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(3);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'presentation_requirement_patch',
      systemPromptVersion:
        PRESENTATION_REQUIREMENT_REPAIR_PROMPT_VERSION,
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      PRESENTATION_REQUIREMENT_REPAIR_SCHEMA_NAME,
    );
    expect(
      (JSON.parse(calls[1]!.user) as { targets: unknown[] }).targets,
    ).toHaveLength(initial.pageContracts.length);
    expect(calls[2]!.authority).toMatchObject({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'book_surface_patch',
      systemPromptVersion: BOOK_SURFACE_REPAIR_PROMPT_VERSION,
    });
    expect(calls[2]!.options?.jsonSchema?.name).toBe(
      BOOK_SURFACE_REPAIR_SCHEMA_NAME,
    );
    expect(calls.map((call) => call.options?.maxOutputTokens)).toEqual([
      40_000,
      32_000,
      36_000,
    ]);
    const bookSurfacePayload = decodeBookSurfaceRepairUserPrompt(
      calls[2]!.user,
    );
    expect(bookSurfacePayload.recurringPropAuthority).toMatchObject({
      recurringProps: initial.recurringProps,
    });
    expect(bookSurfacePayload.presentationTargets).toEqual([]);
    expect(
      (bookSurfacePayload.affectedPages as Array<{
        repairTargets: Array<{ kind: string }>;
      }>).flatMap((page) => page.repairTargets),
    ).toSatisfy((targets: Array<{ kind: string }>) =>
      targets.every(
        (target) => target.kind !== 'presentation_requirement',
      ),
    );
    expect(result.provenance.attempt).toBe(3);
    expect(
      result.repairAttempts.map((attempt) => attempt.nextRepairMode),
    ).toEqual([
      'presentation_requirement_patch',
      'book_surface_patch',
    ]);
  });

  it('stops before fifth standard-call dispatch when mixed v6 is input-inadmissible', async () => {
    const valid = bunnyDraft();
    const firstAttempt = structuredClone(valid);
    ensureBookSurfacePageShape(firstAttempt);
    firstAttempt.worldType = '';

    const finalSlotMixed = structuredClone(valid);
    ensureBookSurfacePageShape(finalSlotMixed);
    finalSlotMixed.coverContract.mustShow = [''];
    finalSlotMixed.pageContracts[0].camera = '';
    const structurallyAuthorizedUniqueBytes = Array.from(
      { length: 18_000 },
      (_value, index) => String.fromCodePoint(0x10000 + index),
    ).join('');
    finalSlotMixed.pageContracts[0].mustNotShow = [
      ...finalSlotMixed.pageContracts[0].mustNotShow,
      `structural-only-${structurallyAuthorizedUniqueBytes}`,
    ];
    finalSlotMixed.pageContracts[1].actionSemanticCoverage[0].disposition = {
      kind: 'unsupported',
      reason: 'closed_action_catalog_gap',
    };

    const calls: Array<{
      system: string;
      user: string;
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      system,
      user,
      _options,
      authority,
    ) => {
      calls.push({ system, user, authority });
      return JSON.stringify(
        calls.length <= 3 ? firstAttempt : finalSlotMixed,
      );
    };

    let admissionError: TemplateRepairRouteAdmissionError | undefined;
    try {
      await compileBookVisualContractTemplate(bunnySource(), {
        callLLM: caller,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(
        TemplateRepairRouteAdmissionError,
      );
      admissionError = error as TemplateRepairRouteAdmissionError;
    }

    expect(admissionError).toBeDefined();
    expect(calls).toHaveLength(4);
    expect(
      calls.map((call) =>
        call.authority?.kind === 'repair'
          ? call.authority.repairMode
          : null,
      ),
    ).toEqual([null, 'full_draft', 'full_draft', 'full_draft']);
    expect(admissionError).toMatchObject({
      repairAttempt: 5,
      repairMode: 'book_surface_patch',
      maxAdmissibleInputBytes: 59_904,
    });
    expect(
      admissionError!.inputAccounting.estimatedBytes,
    ).toBeGreaterThan(59_904);
    expect(
      admissionError!.attempts.map(
        (attempt) => attempt.nextRepairMode,
      ),
    ).toEqual([
      'full_draft',
      'full_draft',
      'full_draft',
      'book_surface_patch',
    ]);
    expect(JSON.stringify(admissionError)).not.toContain(
      'structural-only-',
    );
  });

  it('keeps the fail-closed full-draft lane when the compact presentation fallback is also input-inadmissible', async () => {
    const valid = bunnyDraft();
    const initial = structuredClone(valid);
    initial.coverContract.mustShow = [''];
    initial.recurringProps[0].firstRevealPage =
      initial.pageContracts.length + 1;
    for (const [pageIndex, pageContract] of initial.pageContracts.entries()) {
      pageContract.camera = '';
      pageContract.mustShow = [
        ...valid.pageContracts[pageIndex].mustShow,
        `page ${pageIndex + 1} ${String.fromCharCode(
          97 + pageIndex,
        ).repeat(35_000)}`,
      ];
      pageContract.actionSemanticCoverage[0].disposition = {
        kind: 'unsupported',
        reason: 'closed_action_catalog_gap',
      };
    }
    ensureBookSurfacePageShape(initial);

    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      return JSON.stringify(calls.length === 1 ? initial : valid);
    };

    const result = await compileBookVisualContractTemplate(
      bunnySource(),
      { callLLM: caller },
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toMatchObject({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'full_draft',
      systemPromptVersion: REPAIR_PROMPT_VERSION,
      userPromptVersion: REPAIR_USER_PROMPT_VERSION,
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      TEMPLATE_DRAFT_SCHEMA_NAME,
    );
    expect(calls[1]!.user).toContain(TEMPLATE_REPAIR_ISSUES_MARKER);
    expect(result.provenance.attempt).toBe(2);
    expect(result.repairAttempts[0]?.nextRepairMode).toBe(
      'full_draft',
    );
  });

  it('routes a pure page-structural failure through null-cover BookSurface v6', async () => {
    const invalid = bunnyDraft();
    invalid.pageContracts[0].camera = '';
    ensureBookSurfacePageShape(invalid);
    const validPage = structuredClone(bunnyDraft().pageContracts[0]);
    delete validPage.castIds;
    delete validPage.characterPresence;
    delete validPage.castStates;
    validPage.propConstraints ??= [];
    validPage.actionRequirements ??= [];
    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      if (calls.length === 1) return JSON.stringify(invalid);
      return JSON.stringify(
        bookSurfaceV6Response({
          payload: decodeBookSurfaceRepairUserPrompt(user),
          coverContract: null,
          recurringProps: null,
          repairedPages: [validPage],
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toEqual({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'book_surface_patch',
      systemPromptVersion: BOOK_SURFACE_REPAIR_PROMPT_VERSION,
      userPromptVersion: BOOK_SURFACE_REPAIR_USER_PROMPT_VERSION,
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      BOOK_SURFACE_REPAIR_SCHEMA_NAME,
    );
    expect(calls[1]!.options?.maxOutputTokens).toBe(32_000);
    const payload = decodeBookSurfaceRepairUserPrompt(calls[1]!.user);
    expect(payload.coverAuthority).toBeNull();
    expect(payload.recurringPropAuthority).toBeNull();
    expect(payload.presentationTargets).toEqual([]);
    expect(payload.affectedPages).toHaveLength(1);
    const affectedPage = (
      payload.affectedPages as Array<{
        pageNumber: number;
        repairTargets: unknown[];
        diagnosticCount: number;
        pageStructuralProjection: Record<string, unknown>;
      }>
    )[0]!;
    expect(affectedPage.pageNumber).toBe(1);
    expect(affectedPage.repairTargets).toEqual([
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        pageNumber: 1,
        causes: ['page_steering_invalid'],
      },
    ]);
    expect(affectedPage.diagnosticCount).toBeGreaterThan(0);
    expect(calls[1]!.user).not.toContain('camera must be a non-empty string');
    expect(affectedPage.pageStructuralProjection).not.toHaveProperty(
      'actionSemanticCoverage',
    );
    expect(result.template.coverContract).toMatchObject({
      worldType: invalid.coverContract.worldType,
      locationId: invalid.coverContract.locationId,
      timeOfDay: invalid.coverContract.timeOfDay,
      mustShow: invalid.coverContract.mustShow,
      mustNotShow: invalid.coverContract.mustNotShow,
    });
    expect(result.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        pageNumber: 1,
        beatId: invalid.pageContracts[0].actionSemanticCoverage[0].beatId,
        sourceEvidenceId:
          invalid.pageContracts[0].actionSemanticCoverage[0]
            .sourceEvidenceId,
        disposition:
          invalid.pageContracts[0].actionSemanticCoverage[0].disposition,
      }),
    );
    expect(result.provenance.attempt).toBe(2);
    expect(result.provenance.repairPromptVersion).toBe(
      BOOK_SURFACE_REPAIR_PROMPT_VERSION,
    );
    expect(result.repairAttempts[0]!.nextRepairMode).toBe(
      'book_surface_patch',
    );
  });

  it('keeps provider action-semantic overreach outside a pure structural BookSurface patch', async () => {
    const initial = bunnyDraft();
    initial.pageContracts[0].camera = '';
    ensureBookSurfacePageShape(initial);
    const structurallyRepairedPage = structuredClone(
      bunnyDraft().pageContracts[0],
    );
    delete structurallyRepairedPage.castIds;
    delete structurallyRepairedPage.characterPresence;
    delete structurallyRepairedPage.castStates;
    structurallyRepairedPage.propConstraints ??= [];
    structurallyRepairedPage.actionRequirements ??= [];
    structurallyRepairedPage.actionSemanticCoverage[0].disposition = {
      kind: 'non_visual',
      rationale: 'provider_attempted_overreach',
    };
    const calls: Array<{
      user: string;
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      _options,
      authority,
    ) => {
      calls.push({ user, authority });
      if (calls.length === 1) return JSON.stringify(initial);
      return JSON.stringify(
        bookSurfaceV6Response({
          payload: decodeBookSurfaceRepairUserPrompt(user),
          coverContract: null,
          recurringProps: null,
          repairedPages: [structurallyRepairedPage],
        }),
      );
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.authority)).toEqual([
      expect.objectContaining({ kind: 'initial' }),
      expect.objectContaining({
        kind: 'repair',
        repairMode: 'book_surface_patch',
      }),
    ]);
    const bookSurfacePayload = decodeBookSurfaceRepairUserPrompt(
      calls[1]!.user,
    );
    expect(
      JSON.stringify(bookSurfacePayload.affectedPages),
    ).not.toContain('actionSemanticCoverage');
    expect(result.provenance.attempt).toBe(2);
    expect(result.repairAttempts.map((attempt) => attempt.nextRepairMode)).toEqual([
      'book_surface_patch',
    ]);
    expect(result.actionSemanticCoverage).toContainEqual(
      expect.objectContaining({
        pageNumber: 1,
        beatId: initial.pageContracts[0].actionSemanticCoverage[0].beatId,
        sourceEvidenceId:
          initial.pageContracts[0].actionSemanticCoverage[0]
            .sourceEvidenceId,
        disposition:
          initial.pageContracts[0].actionSemanticCoverage[0].disposition,
      }),
    );
  });

  it('routes one recurring-prop collection failure plus page failures through a bounded structural-bundle repair', async () => {
    const invalid = bunnyDraft();
    for (const prop of invalid.recurringProps) {
      prop.firstRevealPage ??= null;
    }
    for (const page of invalid.pageContracts) {
      delete page.characterPresence;
      delete page.castIds;
      page.propConstraints ??= [];
      page.actionRequirements ??= [];
    }
    invalid.pageContracts[0].camera = '';
    invalid.recurringProps[0].material = '';
    const calls: Array<{
      user: string;
      options: Parameters<ContractLlmCaller>[2];
      authority: Parameters<ContractLlmCaller>[3];
    }> = [];
    const caller: ContractLlmCaller = async (
      _system,
      user,
      options,
      authority,
    ) => {
      calls.push({ user, options, authority });
      if (calls.length === 1) return JSON.stringify(invalid);
      const payload = decodeStructuralBundleRepairUserPrompt(user);
      const recurringProps = structuredClone(payload.recurringProps);
      const pageContracts = payload.affectedPages.map(
        (value: { pageContract: Record<string, unknown> }) =>
          structuredClone(value.pageContract),
      );
      recurringProps[0].material = 'durable printed material';
      pageContracts[0].camera = 'portrait medium shot';
      return JSON.stringify({
        recurringProps,
        pageContracts,
      });
    };
    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });
    expect(calls[1]?.authority).toEqual({
      kind: 'repair',
      budgetClass: 'standard',
      repairMode: 'structural_bundle_patch',
      systemPromptVersion: STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
      userPromptVersion: 'structural-bundle-repair-user-prompt/v2',
    });
    expect(calls[1]?.options?.jsonSchema?.name).toBe(
      STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
    );
    expect(calls[1]?.options?.maxOutputTokens).toBe(32_000);
    const payload = decodeStructuralBundleRepairUserPrompt(
      calls[1]!.user,
    );
    expect(payload.recurringProps).toHaveLength(
      invalid.recurringProps.length,
    );
    expect(payload.affectedPages).toHaveLength(1);
    expect(payload.affectedPages[0].pageNumber).toBe(1);
    expect(payload).not.toHaveProperty('previousDraft');
    expect(payload).not.toHaveProperty('storySource');
    expect(result.provenance.attempt).toBe(2);
    expect(result.repairAttempts[0]!.nextRepairMode).toBe(
      'structural_bundle_patch',
    );
  });

  it('keeps unsupported mixed collection and page failures on full-draft repair', async () => {
    const invalid = bunnyDraft();
    invalid.pageContracts[0].camera = '';
    invalid.locations[0].name = '';
    const calls: Array<Parameters<ContractLlmCaller>[3]> = [];
    const caller: ContractLlmCaller = async (
      _system,
      _user,
      _options,
      authority,
    ) => {
      calls.push(authority);
      return JSON.stringify(calls.length === 1 ? invalid : bunnyDraft());
    };
    await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });
    expect(calls[1]).toMatchObject({
      kind: 'repair',
      repairMode: 'full_draft',
    });
  });
});
