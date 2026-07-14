/**
 * Stage 2a — compiler-owned appearance injection + worldType / coverContract. Reproduces the EXACT live failures
 * (appearance binding carries a value in a Template; worldType silent default) and proves the fixes.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  compileBookVisualContractTemplate,
  injectAppearance,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  validateBookVisualContractTemplate,
  InvalidTemplateContractError,
} from '../visual-contract-compiler/validateTemplateContract';
import { PALETTE_VERSION } from '../visual-contract-compiler/contractTemplateTypes';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';

const BUNNY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
function bunnySource(): TemplateCompileInput {
  return extractSourceFromMarkdown(BUNNY_KEY, fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.md`), 'utf8')) as TemplateCompileInput;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bunnyTemplate(): any {
  return JSON.parse(fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.visual-contract-template.json`), 'utf8'));
}
const stubFrom = (t: unknown): ContractLlmCaller => async () => JSON.stringify(t);

describe('S2a — injectAppearance (compiler-owned, UNRESOLVED bindings)', () => {
  it('non-relative (doctor) → deterministic_palette, canonical paletteId = cast id, NO value', () => {
    const a = injectAppearance('doctor', 'human:doctor');
    for (const trait of ['skinTone', 'hairColour', 'hairTexture'] as const) {
      expect(a[trait].mode).toBe('deterministic_palette');
      expect(a[trait].origin).toEqual({ kind: 'deterministic_palette', paletteId: 'human:doctor', version: PALETTE_VERSION });
      expect(a[trait].value).toBeUndefined();
    }
    expect(a.hairStyle.mode).toBe('explicit');
    expect(typeof a.hairStyle.value).toBe('string');
    expect(a.hairStyle.origin.kind).toBe('policy_default');
  });

  it('relatives (mother, parent) → family_profile, NO value', () => {
    for (const role of ['mother', 'parent']) {
      const a = injectAppearance(role, `human:${role}`);
      expect(a.skinTone.mode).toBe('family_profile');
      expect(a.skinTone.origin).toEqual({ kind: 'family_profile' });
      expect(a.skinTone.value).toBeUndefined();
    }
  });

  it('unknown role → throws (never auto-classified as non-relative)', () => {
    expect(() => injectAppearance('wizard', 'human:wizard')).toThrow(InvalidTemplateContractError);
  });
});

describe('S2a — the exact appearance failure is reproduced + cleared', () => {
  it('validator REJECTS a non-explicit binding carrying a value (the live --live failure)', () => {
    const bad = bunnyTemplate();
    bad.humanCast[0].appearance.skinTone.value = 'olive'; // deterministic_palette + value → illegal in a Template
    const res = validateBookVisualContractTemplate(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => /must NOT carry a value/i.test(e))).toBe(true);
  });

  it('compiler STRIPS any LLM appearance value — the candidate is injected + unresolved', async () => {
    const draft = bunnyTemplate();
    draft.humanCast[0].appearance.skinTone = {
      mode: 'deterministic_palette',
      value: 'olive',
      origin: { kind: 'deterministic_palette', paletteId: 'llm-made-up', version: 'palette/v1' },
    };
    const { template } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) });
    const doctor = template.humanCast.find((h) => h.id === 'human:doctor')!;
    expect(doctor.appearance.skinTone.value).toBeUndefined(); // stripped
    expect(doctor.appearance.skinTone.mode).toBe('deterministic_palette'); // injected skeleton
  });

  it('validator accepts family_profile for a `parent` role (RELATIVE_ROLES now includes parent)', () => {
    const t = bunnyTemplate();
    t.humanCast.find((h: { id: string }) => h.id === 'human:mother').role = 'parent';
    const res = validateBookVisualContractTemplate(t);
    expect(res.ok).toBe(true);
  });
});

describe('S2a — worldType + coverContract compiler copies', () => {
  it('worldType missing → the candidate FAILS (no silent "unspecified" default)', async () => {
    const draft = bunnyTemplate();
    delete draft.worldType; // and bunnySource() carries no worldType hint
    await expect(
      compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) }),
    ).rejects.toBeInstanceOf(InvalidTemplateContractError);
  });

  it('coverContract.worldType is COPIED from the top-level worldType (overrides the draft)', async () => {
    const draft = bunnyTemplate();
    draft.coverContract.worldType = 'WRONG_WORLD';
    const { template } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(draft) });
    expect(template.coverContract.worldType).toBe(template.worldType);
    expect(template.coverContract.worldType).not.toBe('WRONG_WORLD');
  });
});
