/**
 * Brief 1 — text-first visual-contract compiler: extractor unit tests, fail-closed validation, and the
 * bunny RE-DERIVATION self-check (deterministic facts vs the hand-authored template, no live LLM).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  extractDeterministicFacts,
  stripNiqqud,
} from '../visual-contract-compiler/extractDeterministicFacts';
import {
  compileBookVisualContractTemplate,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { renderVisualContractReview } from '../visual-contract-compiler/writeVisualContractReview';
import { InvalidTemplateContractError } from '../visual-contract-compiler/validateTemplateContract';
import type { BookVisualContractTemplate } from '../visual-contract-compiler/contractTemplateTypes';
import type { ContractLlmCaller } from '../visual-contract-compiler/compileBookVisualContract';

const BUNNY_KEY = 'bunny_ometz_adventure';
const BANK = path.join(process.cwd(), 'story-bank/v3-approved');

function bunnySource(): TemplateCompileInput {
  const md = fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.md`), 'utf8');
  return extractSourceFromMarkdown(BUNNY_KEY, md) as TemplateCompileInput;
}
function bunnyTemplate(): BookVisualContractTemplate {
  return JSON.parse(fs.readFileSync(path.join(BANK, `${BUNNY_KEY}.visual-contract-template.json`), 'utf8'));
}
/** A stub LLM that returns a descriptive draft (the given template JSON). */
const stubFrom = (t: unknown): ContractLlmCaller => async () => JSON.stringify(t);

describe('text-first compiler — C1 source extractor', () => {
  it('extracts a page-marked source with per-page prose + companion + directions', () => {
    const src = bunnySource();
    expect(src.pageCount).toBe(12);
    expect(src.pages).toHaveLength(12);
    expect(src.companion?.id).toBe('bunny_ometz');
    expect(src.pageImageDirections?.length).toBe(12);
    expect(src.pages[0].text).toContain('{{childName}}'); // placeholder preserved, not resolved
    expect(src.fullStoryText).toContain('--- Page 1 ---');
  });
});

describe('text-first compiler — C2 deterministic facts (Hebrew morphology, never \\b)', () => {
  it('strips niqqud so vowelized aliases match bare needles', () => {
    expect(stripNiqqud('הָרוֹפֵא')).toBe('הרופא');
    expect(stripNiqqud('אִמָּא')).toBe('אמא');
  });

  it('derives doctor=male + mother=female with real evidence, from the vowelized text', () => {
    const facts = extractDeterministicFacts(bunnySource());
    const doctor = facts.humans.find((h) => h.id === 'human:doctor')!;
    const mother = facts.humans.find((h) => h.id === 'human:mother')!;
    expect(doctor.gender).toBe('male');
    expect(doctor.genderConfidence).toBe('high');
    expect(doctor.genderEvidence?.page).toBe(4); // "הרופא קרא" — actor mention, not the p1 construct
    expect(mother.gender).toBe('female');
    expect(mother.genderEvidence?.phrase).toContain('אמא');
  });

  it('reproduces the doctor presence graph EXACTLY (genitive + construct excluded)', () => {
    const facts = extractDeterministicFacts(bunnySource());
    const doctor = facts.humans.find((h) => h.id === 'human:doctor')!;
    // p1 "דלת הרופא" (construct) + p5 "של הרופא" (genitive) excluded; 9,10 are image-direction only.
    expect(doctor.pagesPresent).toEqual([4, 6, 7, 9, 10, 11]);
    expect(doctor.lowConfidencePages).toEqual([9, 10]);
  });

  it('reproduces companion presence EXACTLY from the companionPresence marker', () => {
    const facts = extractDeterministicFacts(bunnySource());
    expect(facts.companionAbsentPages).toEqual([1]);
    expect(facts.companionPresentPages).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('DEFERS laterality (the text has no שמאל/ימין) instead of inventing it', () => {
    const facts = extractDeterministicFacts(bunnySource());
    expect(facts.laterality).toEqual([]);
    expect(facts.deferrals.some((d) => d.field.startsWith('castStates.laterality'))).toBe(true);
  });

  it('flags mother continuity gaps (named on some pages, not others) rather than guessing', () => {
    const facts = extractDeterministicFacts(bunnySource());
    const mother = facts.humans.find((h) => h.id === 'human:mother')!;
    expect(mother.pagesPresent).toEqual([1, 4, 9, 10, 12]);
    const gap = facts.deferrals.find((d) => d.field.includes('human:mother'));
    expect(gap?.pages).toContain(5);
    expect(gap?.pages).toContain(11);
  });
});

describe('text-first compiler — C3 assembly (facts overlaid LAST) + fail-closed', () => {
  it('compiles a VALID candidate; identity comes from facts, laterality is stripped', async () => {
    const { template, notes } = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: stubFrom(bunnyTemplate()),
    });
    expect(notes).toEqual([]);
    const doctor = template.humanCast.find((h) => h.id === 'human:doctor')!;
    expect(doctor.gender).toBe('male');
    expect(doctor.pagesPresent).toEqual([4, 6, 7, 9, 10, 11]);
    // Laterality is DEFERRED → no injectionArm/bandageArm/freeHand anywhere in the candidate.
    const anyLat = template.pageContracts.some((pc) =>
      (pc.castStates ?? []).some((cs) => cs.injectionArm || cs.bandageArm || cs.freeHand),
    );
    expect(anyLat).toBe(false);
    // But descriptive bodyState survives the strip.
    const p9 = template.pageContracts.find((pc) => pc.pageNumber === 9)!;
    expect(p9.castStates?.[0]?.bodyState).toBeTruthy();
    // castIds recomputed from facts: mother dropped from the continuity pages.
    const p5 = template.pageContracts.find((pc) => pc.pageNumber === 5)!;
    expect(p5.castIds).not.toContain('human:mother');
    const p4 = template.pageContracts.find((pc) => pc.pageNumber === 4)!;
    expect(p4.castIds).toContain('human:mother');
  });

  it('a LYING draft cannot fabricate gender / cast: facts win, phantom humans are dropped', async () => {
    const lying = bunnyTemplate() as unknown as Record<string, unknown>;
    const humans = lying.humanCast as Array<Record<string, unknown>>;
    humans[0].gender = 'female'; // lie about the doctor
    humans.push({ id: 'human:phantom', role: 'wizard', appearance: humans[0].appearance, garments: [], forbiddenAppearance: [] });
    const { template, notes } = await compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(lying) });
    const doctor = template.humanCast.find((h) => h.id === 'human:doctor')!;
    expect(doctor.gender).toBe('male'); // fact wins over the lying draft
    expect(template.humanCast.some((h) => h.id === 'human:phantom')).toBe(false); // not in the text → dropped
    expect(notes.some((n) => n.includes('human:phantom'))).toBe(true);
  });

  it('is FAIL-CLOSED: a draft missing a detected human\'s appearance is rejected', async () => {
    const broken = bunnyTemplate() as unknown as Record<string, unknown>;
    broken.humanCast = []; // no draft appearance for the doctor/mother the extractor detects
    await expect(
      compileBookVisualContractTemplate(bunnySource(), { callLLM: stubFrom(broken) }),
    ).rejects.toBeInstanceOf(InvalidTemplateContractError);
  });
});

describe('text-first compiler — C4 review + bunny re-derivation DIFF', () => {
  it('the candidate diff vs the hand-authored template is exactly the deferred human-authored fields', async () => {
    const { template, facts, notes } = await compileBookVisualContractTemplate(bunnySource(), {
      callLLM: stubFrom(bunnyTemplate()),
    });
    const review = renderVisualContractReview({
      storyKey: BUNNY_KEY,
      facts,
      template,
      notes,
      valid: true,
      previous: bunnyTemplate(),
    });
    // The ONLY differences are mother continuity + laterality (both correctly deferred).
    expect(review).toContain('human:mother.pagesPresent');
    expect(review).toContain('previous had extra [5, 6, 7, 8, 11]');
    expect(review).toContain('castStates laterality on pages: candidate=[—] vs previous=[9, 10, 11, 12]');
    // The doctor is NOT a difference (reproduced exactly) — no doctor pagesPresent diff line.
    expect(review).not.toContain('human:doctor.pagesPresent: candidate');
    expect(review).toContain('gender **male**');
  });
});
