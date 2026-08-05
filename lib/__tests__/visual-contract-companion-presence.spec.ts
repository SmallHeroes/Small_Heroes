/**
 * Companion-presence fix (Codex render-integration NO-GO): the detector matched only the full roster display name,
 * so a prose SHORT name ("אוּרי") went undetected → companion forced ABSENT while the LLM's mustShow still required
 * it → a cross-field contradiction that survived every validator (11 in fox_uri). Two fixes:
 *   1. alias-aware presence detection (companionPresenceTokens), explicit directive still overrides;
 *   2. a cross-field fail-closed validator rule — mustShow positively referencing an ABSENT cast member is rejected
 *      (possessive/genitive + mustNotShow references stay legitimate).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { extractDeterministicFacts, hasCleanEnglishMention, type DeterministicFactsInput } from '../visual-contract-compiler/extractDeterministicFacts';
import { validateBookVisualContractTemplate } from '../visual-contract-compiler/validateTemplateContract';
import { mustShowAbsenceContradictions } from '../visual-contract-compiler/castPresenceContradiction';
import { migrateLegacyBookVisualContractTemplateV1 } from '../visual-contract-compiler/contractTemplateMigration';
import {
  assertValidVNextVisualContract,
  InvalidVNextVisualContractError,
} from '../visual-contract-compiler/validateVNextVisualContract';
import { draftValidationIssueIsValid } from '../visual-contract-compiler/draftValidationDiagnostics';

const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bunnyTemplate = (): any => migrateLegacyBookVisualContractTemplateV1(
  JSON.parse(fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.visual-contract-template.json'), 'utf8')),
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pageOf = (t: any, n: number) => t.pageContracts.find((p: any) => p.pageNumber === n);

describe('Fix 1 — alias-aware companion presence detection', () => {
  it('detects the companion by its prose SHORT name ("אוּרי") — not only the full roster name', () => {
    const input: DeterministicFactsInput = {
      storyKey: 'fox_test',
      pageCount: 3,
      companion: { id: 'fox_uri', name: 'השועל אוּרי' }, // full roster name is multi-word
      pages: [
        { pageNumber: 1, text: 'אוּרי מזדקף כמו שומר אמיץ, אוזן צמודה לקיר.' }, // short name only
        { pageNumber: 2, text: 'הילד הלך לבד אל החלון.' }, // no companion mention
        { pageNumber: 3, text: 'אוּרי חייך אליו בשמחה.' }, // named, but the directive overrides (below)
      ],
      pageImageDirections: [{ pageNumber: 3, imageDirection: 'wide shot. companionPresence: absent.' }],
    };
    const facts = extractDeterministicFacts(input);
    expect(facts.companionPresentPages).toContain(1); // the root fix — short name detected
    expect(facts.companionPresentPages).not.toContain(2); // genuinely absent
  });

  it('detects prose genitive/speech mentions but never lets direction-only possession select cast', () => {
    const input: DeterministicFactsInput = {
      storyKey: 'fox_test',
      pageCount: 3,
      companion: { id: 'fox_uri', name: 'השועל אוּרי' },
      pages: [
        { pageNumber: 1, text: 'והפנס של אוּרי כמעט כבה.' }, // genitive "של אוּרי" — companion IS on-scene
        { pageNumber: 2, text: '"רגע," אמר אוּרי. "אני אדליק את הכול!"' }, // speech-subject inversion "אמר אוּרי"
        { pageNumber: 3, text: 'הילד צעד לבד קדימה.' }, // prose does not name the companion…
      ],
      pageImageDirections: [{ pageNumber: 3, imageDirection: "Uri's neck-lantern lights the next patch." }], // …but the direction possessive does
    };
    const facts = extractDeterministicFacts(input);
    expect(facts.companionPresentPages).toEqual([1, 2]);
  });

  it('hasCleanEnglishMention: a clean mention is detected even alongside a possessive of the same alias', () => {
    expect(hasCleanEnglishMention("Uri points dramatically; Uri's lantern glows.", ['uri'])).toBe(true); // was wrongly false
    expect(hasCleanEnglishMention('only the doctor’s closed door is visible', ['doctor'])).toBe(false); // possessive only
  });

  it('ignores a legacy companionPresence directive when source prose authoritatively names the companion', () => {
    const input: DeterministicFactsInput = {
      storyKey: 'fox_test',
      pageCount: 1,
      companion: { id: 'fox_uri', name: 'השועל אוּרי' },
      pages: [{ pageNumber: 1, text: 'אוּרי חייך אליו בשמחה.' }], // prose names the companion…
      pageImageDirections: [{ pageNumber: 1, imageDirection: 'companionPresence: absent.' }], // …but the directive wins
    };
    const facts = extractDeterministicFacts(input);
    expect(facts.companionPresentPages).toContain(1);
    expect(facts.companionAbsentPages).not.toContain(1);
  });
});

describe('Fix 2 — cross-field fail-closed validator', () => {
  it('REJECTS a page whose mustShow positively references a companion declared ABSENT (the fox p4 / fox_fantasy class)', () => {
    const t = bunnyTemplate();
    const compId = t.cast.companion.id;
    const p2 = pageOf(t, 2); // companion is present here and named "Buni" in mustShow
    p2.castIds = p2.castIds.filter((id: string) => id !== compId); // force the companion ABSENT
    p2.characterPresence = { ...p2.characterPresence, companion: false };
    const res = validateBookVisualContractTemplate(t);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /cross-field contradiction/.test(e) && /page 2/.test(e) && /companion/.test(e))).toBe(true);
    }
  });

  it('does NOT false-positive on a possessive/scenery reference (bunny p1: companion absent + "the doctor\'s closed door")', () => {
    // The committed bunny template has companion ABSENT on p1 and "the doctor's closed door" in p1.mustShow while the
    // doctor is absent too. A naive matcher would reject it; the present-mention matcher excludes possessives.
    expect(mustShowAbsenceContradictions(bunnyTemplate())).toEqual([]);
    expect(validateBookVisualContractTemplate(bunnyTemplate()).ok).toBe(true);
  });

  it('does NOT reject a NEGATIVE reference — mustNotShow naming an absent companion is legitimate', () => {
    const t = bunnyTemplate();
    const p1 = pageOf(t, 1); // companion absent on p1
    p1.mustNotShow = [...(p1.mustNotShow ?? []), 'no bunny or rabbit visible yet — the companion has not appeared'];
    expect(validateBookVisualContractTemplate(t).ok).toBe(true);
  });

  it.each([
    ['zero', 0, 'collection_item'],
    ['negative', -1, 'collection_item'],
    ['fractional', 1.5, 'collection_item'],
    ['string', '1', null],
    ['missing', undefined, null],
    ['positive control', 2, 'page'],
  ])(
    'keeps the cast-presence rejection typed when pageNumber is %s',
    (_label, pageNumber, expectedCastLocatorKind) => {
      const t = bunnyTemplate();
      const companionId = t.cast.companion.id;
      const page = pageOf(t, 2);
      page.castIds = page.castIds.filter(
        (id: string) => id !== companionId,
      );
      page.characterPresence = {
        ...page.characterPresence,
        companion: false,
      };
      page.pageNumber = pageNumber;

      let thrown: unknown;
      try {
        assertValidVNextVisualContract(t);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(InvalidVNextVisualContractError);
      const invalid = thrown as InvalidVNextVisualContractError;
      expect(invalid.diagnosticIssues.length).toBeGreaterThan(0);
      expect(
        invalid.diagnosticIssues.every(draftValidationIssueIsValid),
      ).toBe(true);
      if (expectedCastLocatorKind) {
        expect(invalid.diagnosticIssues).toContainEqual(
          expect.objectContaining({
            family: 'draft_contract',
            code: 'cast_authority_mismatch',
            locator: expect.objectContaining({
              kind: expectedCastLocatorKind,
              fieldRole: 'cast_presence',
            }),
          }),
        );
      }
    },
  );
});

describe('mustShowAbsenceContradictions — helper unit', () => {
  it('flags a positive companion reference but excludes a possessive one', () => {
    const contract = {
      cast: { companion: { id: 'companion:fox_uri', name: 'השועל אוּרי' } },
      humanCast: [],
      pageContracts: [
        { pageNumber: 1, castIds: ['child:hero'], mustShow: ['Uri the fox leaps beside the child'] }, // positive → flagged
        { pageNumber: 2, castIds: ['child:hero'], mustShow: ["the fox's empty den in the background"] }, // possessive → not
      ],
    };
    expect(mustShowAbsenceContradictions(contract)).toEqual([{ page: 1, id: 'companion:fox_uri', role: 'companion' }]);
  });

  it('does NOT hard-reject a SPECIES simile/scenery reference on a companion-absent page (only the NAME rejects)', () => {
    const base = (mustShow: string[]) => ({
      cast: { companion: { id: 'companion:bunny_ometz', name: 'בּוּנִי' } },
      humanCast: [],
      pageContracts: [
        { pageNumber: 1, castIds: ['child:hero'], mustShow }, // companion ABSENT here
        { pageNumber: 2, castIds: ['child:hero', 'companion:bunny_ometz'], mustShow: ['Buni peeks out'] },
      ],
    });
    // Species simile + species scenery on the absent page → NOT a contradiction.
    expect(mustShowAbsenceContradictions(base(['the child curls up small like a frightened rabbit']))).toEqual([]);
    expect(mustShowAbsenceContradictions(base(['a bright waiting room with colourful bunny stickers on the wall']))).toEqual([]);
    // The NAME on the absent page → still a real contradiction.
    expect(mustShowAbsenceContradictions(base(['Buni is missing from the room']))).toEqual([
      { page: 1, id: 'companion:bunny_ometz', role: 'companion' },
    ]);
  });

  it('a metacharacter-bearing alias does not throw or over-match (escaper is correct)', () => {
    expect(() => hasCleanEnglishMention('a scene with axb', ['a.b'])).not.toThrow();
    expect(hasCleanEnglishMention('a scene with axb', ['a.b'])).toBe(false); // "." must be literal, not any-char
    expect(() => hasCleanEnglishMention('the doctor (sam) waves', ['doctor (sam)'])).not.toThrow();
  });

  it('a HUMAN referenced WITHIN its presence span is continuity (not rejected); OUTSIDE the span it is', () => {
    // The mother is present (in castIds) on p1 and p4 — span [1,4]. mustShow names "the parent" on p2 (within span,
    // continuity → allowed) and on p6 (after she leaves → real contradiction).
    const contract = {
      cast: { companion: null },
      humanCast: [{ id: 'human:mother', role: 'mother', aliases: ['the parent', 'mom', 'אמא'] }],
      pageContracts: [
        { pageNumber: 1, castIds: ['child:hero', 'human:mother'], mustShow: ['the parent holds the child'] },
        { pageNumber: 2, castIds: ['child:hero'], mustShow: ['the parent staying close beside the child'] }, // within [1,4] → continuity
        { pageNumber: 4, castIds: ['child:hero', 'human:mother'], mustShow: ['the parent waves'] },
        { pageNumber: 6, castIds: ['child:hero'], mustShow: ['the parent standing in the doorway'] }, // after span → contradiction
      ],
    };
    expect(mustShowAbsenceContradictions(contract)).toEqual([{ page: 6, id: 'human:mother', role: 'mother' }]);
  });
});
