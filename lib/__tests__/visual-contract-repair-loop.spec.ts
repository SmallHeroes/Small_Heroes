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
import { VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS } from '../visual-contract-compiler/authoringPolicy';
import { InvalidTemplateContractError } from '../visual-contract-compiler/validateTemplateContract';
import { extractDeterministicFacts } from '../visual-contract-compiler/extractDeterministicFacts';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';
import { withCurrentActionSemanticCoverage } from './visual-contract-authoring-draft-fixtures';

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
    expect(res.provenance.repairPromptVersion).toBe('vc-repair-prompt/v9');
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
    expect(err.attempts).toHaveLength(1); // the failing initial attempt is still carried
    expect(err.attempts[0].errors.some((e) => /material/i.test(e))).toBe(true);
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
    expect(err.attempts.every((a) => a.errors.some((e) => /material/i.test(e)))).toBe(true);
    expect(calls()).toBe(3); // initial + 2 repairs — the 4th valid draft was never requested
  });
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
