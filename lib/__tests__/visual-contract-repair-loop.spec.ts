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
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
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
    expect(res.provenance.repairPromptVersion).toBe('vc-repair-prompt/v4');
    expect(res.repairAttempts).toHaveLength(1);
    expect(res.repairAttempts[0].attempt).toBe(1);
    expect(res.repairAttempts[0].errors.some((e) => /material/i.test(e))).toBe(true);
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

  it('a repair call that returns unparseable JSON surfaces as exhaustion WITH the recorded trail (never lost)', async () => {
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
    expect(thrown).toBeInstanceOf(TemplateRepairExhaustedError);
    const err = thrown as TemplateRepairExhaustedError;
    expect(err.attempts).toHaveLength(1); // the failing initial attempt is still carried
    expect(err.attempts[0].errors.some((e) => /material/i.test(e))).toBe(true);
    expect(err.message).toMatch(/could not be produced/i);
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
