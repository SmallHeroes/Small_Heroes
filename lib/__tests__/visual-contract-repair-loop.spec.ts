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
  buildTemplateRepairSystemPrompt,
  buildTemplateRepairUserPrompt,
  SourceEvidenceIdValidationError,
  TemplateRepairExhaustedError,
  TemplateRepairOutputInvalidError,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA,
  SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION,
  SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME,
} from '../visual-contract-compiler/sourceEvidenceIdRepair';
import { TEMPLATE_DRAFT_SCHEMA_NAME } from '../visual-contract-compiler/templateDraftSchema';
import {
  PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
  PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
} from '../visual-contract-compiler/pageContractRepair';
import {
  STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
  STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
} from '../visual-contract-compiler/structuralBundleRepair';
import { VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS } from '../visual-contract-compiler/authoringPolicy';
import { InvalidTemplateContractError } from '../visual-contract-compiler/validateTemplateContract';
import { extractDeterministicFacts } from '../visual-contract-compiler/extractDeterministicFacts';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';
import { draftValidationIssueIsValid } from '../visual-contract-compiler/draftValidationDiagnostics';

const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
const bunnySource = (): TemplateCompileInput =>
  extractSourceFromMarkdown('bunny_ometz_adventure', fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.md'), 'utf8')) as TemplateCompileInput;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bunnyDraft = (): any => withCurrentActionSemanticCoverage({
  draft: JSON.parse(fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.visual-contract-template.json'), 'utf8')),
  pages: bunnySource().pages,
  sourceEvidenceCatalog: bunnySource().sourceEvidenceCatalog,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withEmptyMaterial = (): any => {
  const d = bunnyDraft();
  d.recurringProps[0].material = ''; // the exact fox repair-class: a required descriptive field left empty
  return d;
};

/** A caller that returns a fixed SEQUENCE of drafts (clamped to the last) and records every prompt it received. */
function recordingCaller(drafts: unknown[]): { caller: ContractLlmCaller; prompts: Array<{ system: string; user: string }>; calls: () => number } {
  const prompts: Array<{ system: string; user: string }> = [];
  const caller: ContractLlmCaller = async (system, user) => {
    prompts.push({ system, user });
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
  });

  it('an invalid draft is REPAIRED and passes on attempt 2', async () => {
    const { caller, prompts, calls } = recordingCaller([withEmptyMaterial(), bunnyDraft()]);
    const res = await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    expect(res.provenance.attempt).toBe(2);
    expect(res.provenance.repairPromptVersion).toBe('vc-repair-prompt/v10');
    expect(res.repairAttempts).toHaveLength(1);
    expect(res.repairAttempts[0].attempt).toBe(1);
    expect(res.repairAttempts[0].diagnosticIssues.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.repairAttempts)).not.toMatch(/material/i);
    expect(calls()).toBe(2);
    // the SECOND call is the repair call: repair system prompt + the exact errors + the previous draft
    expect(prompts[1].system).toMatch(/REPAIRING/);
    expect(prompts[1].user).toMatch(/FAILED validation/);
    expect(prompts[1].user).toMatch(/material/i);
  });

  it('two invalid drafts are repaired and pass on attempt 3 (the 2-repair budget)', async () => {
    const { caller, calls } = recordingCaller([withEmptyMaterial(), withEmptyMaterial(), bunnyDraft()]);
    const res = await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    expect(res.provenance.attempt).toBe(3);
    expect(res.repairAttempts).toHaveLength(2);
    expect(calls()).toBe(3);
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
    expect(err.message).toBe(
      'completed template repair output was unusable',
    );
    expect(calls).toBe(2); // initial + the one (failed) repair call
  });

  it('exhausts after the initial + 2 repairs, writes NOTHING, and does not over-call the model', async () => {
    // A 4th (valid) draft is provided but must NEVER be requested — the cap is 2 repairs.
    const { caller, calls } = recordingCaller([withEmptyMaterial(), withEmptyMaterial(), withEmptyMaterial(), bunnyDraft()]);
    let thrown: unknown;
    try {
      await compileBookVisualContractTemplate(bunnySource(), { callLLM: caller });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TemplateRepairExhaustedError);
    expect(thrown).toBeInstanceOf(InvalidTemplateContractError); // still catchable as the fail-closed type
    const err = thrown as TemplateRepairExhaustedError;
    expect(err.attempts).toHaveLength(3);
    expect(
      err.attempts.every((a) => a.diagnosticIssues.length > 0),
    ).toBe(true);
    expect(JSON.stringify(err.attempts)).not.toMatch(/material/i);
    expect(calls()).toBe(3); // initial + 2 repairs — the 4th valid draft was never requested
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
      expect(calls()).toBe(3);
      expect(exhausted.attempts).toHaveLength(3);
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
    expect(sys).toMatch(/MUST NOT change/);
    expect(sys).toMatch(/appearance/);
    expect(sys).toMatch(/coverContract\.worldType/);
    expect(sys).toMatch(/castIds|characterPresence|laterality/);
  });

  it('the user prompt carries the exact errors, the facts, and the previous invalid draft', () => {
    const input = bunnySource();
    const facts = extractDeterministicFacts(input);
    const prev = withEmptyMaterial();
    const errors = ['recurringProps[0] (wall_stickers) material must be a non-empty string when present'];
    const user = buildTemplateRepairUserPrompt(prev, errors, facts, input);
    expect(user).toContain(errors[0]);
    expect(user).toMatch(/PREVIOUS \(INVALID\) DRAFT/);
    expect(user).toContain('wall_stickers'); // the previous draft is embedded
    if (facts.humans[0]) expect(user).toContain(facts.humans[0].id); // facts are embedded
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
    expect(calls[1]!.system).toMatch(/REPAIRING/);
    expect(calls[1]!.user).toContain('PREVIOUS (INVALID) DRAFT');
    expect(result.repairAttempts[0]!.nextRepairMode).toBe('full_draft');
  });
});

describe('page-contract compact repair routing', () => {
  it('repairs an all-page final structural failure without resending the full draft', async () => {
    const invalid = bunnyDraft();
    invalid.pageContracts[0].camera = '';
    const validPage = structuredClone(bunnyDraft().pageContracts[0]);
    delete validPage.castIds;
    delete validPage.characterPresence;
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
      return calls.length === 1
        ? JSON.stringify(invalid)
        : JSON.stringify({ pageContracts: [validPage] });
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.authority).toEqual({
      kind: 'repair',
      repairMode: 'page_contract_patch',
      systemPromptVersion: PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
      userPromptVersion: 'page-contract-repair-user-prompt/v4',
    });
    expect(calls[1]!.options?.jsonSchema?.name).toBe(
      PAGE_CONTRACT_REPAIR_SCHEMA_NAME,
    );
    const payload = JSON.parse(calls[1]!.user);
    expect(payload.affectedPages).toHaveLength(1);
    expect(payload.affectedPages[0].pageNumber).toBe(1);
    expect(payload.affectedPages[0].repairTargets).toEqual([
      {
        family: 'draft_contract',
        code: 'final_structural_invariant_invalid',
        pageNumber: 1,
      },
    ]);
    expect(payload.affectedPages[0].permittedPointerValues).toEqual([]);
    expect(payload.affectedPages[0]).not.toHaveProperty(
      'permittedSpatialReferences',
    );
    expect(payload).not.toHaveProperty('validatorErrors');
    expect(payload).not.toHaveProperty('referenceAuthority');
    expect(payload).not.toHaveProperty('worldType');
    expect(result.provenance.attempt).toBe(2);
    expect(result.provenance.repairPromptVersion).toBe(
      PAGE_CONTRACT_REPAIR_PROMPT_VERSION,
    );
    expect(result.repairAttempts[0]!.nextRepairMode).toBe(
      'page_contract_patch',
    );
  });

  it('routes structural page repair then one represented-elsewhere issue through a second page repair and returns a candidate', async () => {
    const initial = bunnyDraft();
    initial.pageContracts[0].camera = '';
    const representedElsewhereInvalid = structuredClone(
      bunnyDraft().pageContracts[0],
    );
    delete representedElsewhereInvalid.castIds;
    delete representedElsewhereInvalid.characterPresence;
    representedElsewhereInvalid.propConstraints ??= [];
    representedElsewhereInvalid.actionRequirements ??= [];
    representedElsewhereInvalid.actionSemanticCoverage[0].disposition.contractValue =
      'stale-structured-value';
    const finalPage = structuredClone(bunnyDraft().pageContracts[0]);
    delete finalPage.castIds;
    delete finalPage.characterPresence;
    finalPage.propConstraints ??= [];
    finalPage.actionRequirements ??= [];
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
      return JSON.stringify({
        pageContracts: [
          calls.length === 2 ? representedElsewhereInvalid : finalPage,
        ],
      });
    };

    const result = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: caller,
    });

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.authority)).toEqual([
      expect.objectContaining({ kind: 'initial' }),
      expect.objectContaining({
        kind: 'repair',
        repairMode: 'page_contract_patch',
      }),
      expect.objectContaining({
        kind: 'repair',
        repairMode: 'page_contract_patch',
      }),
    ]);
    const thirdPayload = JSON.parse(calls[2]!.user);
    expect(thirdPayload.affectedPages).toHaveLength(1);
    expect(thirdPayload.affectedPages[0]).toMatchObject({
      pageNumber: 1,
      repairTargets: [
        {
          family: 'action_semantic',
          code: 'represented_elsewhere_value_mismatch',
          pageNumber: 1,
        },
      ],
    });
    expect(
      thirdPayload.affectedPages[0].permittedPointerValues,
    ).toContainEqual({
      contractPointer: '/pageContracts/0/locationId',
      contractValue: finalPage.locationId,
    });
    expect(thirdPayload).not.toHaveProperty('validatorErrors');
    expect(result.provenance.attempt).toBe(3);
    expect(result.repairAttempts.map((attempt) => attempt.nextRepairMode)).toEqual(
      ['page_contract_patch', 'page_contract_patch'],
    );
    expect(result.actionSemanticCoverage[0]?.disposition).toMatchObject({
      kind: 'represented_elsewhere',
      contractPointer: '/pageContracts/0/locationId',
      contractValue: finalPage.locationId,
    });
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
      const payload = JSON.parse(user);
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
      repairMode: 'structural_bundle_patch',
      systemPromptVersion: STRUCTURAL_BUNDLE_REPAIR_PROMPT_VERSION,
      userPromptVersion: 'structural-bundle-repair-user-prompt/v1',
    });
    expect(calls[1]?.options?.jsonSchema?.name).toBe(
      STRUCTURAL_BUNDLE_REPAIR_SCHEMA_NAME,
    );
    const payload = JSON.parse(calls[1]!.user);
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
