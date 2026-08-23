import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  buildPvbVisualContractFactsPromptBlock,
  derivePageVisualContracts,
  materialize,
  sourceEvidenceValidation,
  validateBookVisualContract,
  type BookVisualContractTemplate,
  type PageCompanionStateOverride,
} from '@/lib/visual-contract-compiler';
import {
  CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
  companionAppearanceProseConflicts,
  companionAppearanceStateAuthorityIssues,
  declaredCompanionAppearanceStateAuthority,
  resolveCompanionAppearanceState,
} from '@/lib/companion-appearance-state';
import { buildStyle01CompanionTextLock } from '@/lib/style01-gptimage';

const PACKAGE_PATH = path.join(
  process.cwd(),
  'visual-packages',
  'approved',
  'revisions',
  '2b488f2db44702106f49ad80c257b88269972ffb8ebbc92cced95f81c13d98a6.visual-package.json',
);

const FAMILY = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

function template(): BookVisualContractTemplate {
  const packageValue = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
    visualContractTemplate: { content: BookVisualContractTemplate };
  };
  return structuredClone(packageValue.visualContractTemplate.content);
}

function statefulTemplate(): BookVisualContractTemplate {
  const value = template();
  if (!value.cast.companion) throw new Error('Chameleon package companion missing');
  value.cast.companion.companionAppearanceStateAuthority =
    structuredClone(CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY);
  return value;
}

function authoredOverride(
  stateId: string,
  note = 'Reviewed companion-state transition.',
): PageCompanionStateOverride {
  return {
    stateId,
    origin: { kind: 'authored', authorNote: note },
  };
}

function validStateArc(): BookVisualContractTemplate {
  const value = statefulTemplate();
  value.pageContracts[1]!.companionStateOverride = authoredOverride(
    'alert_olive_shift',
  );
  value.pageContracts[2]!.companionStateOverride = authoredOverride(
    'mismatched_amber_stripes',
  );
  value.pageContracts[3]!.companionStateOverride = authoredOverride(
    'attuning_blue_green',
  );
  value.pageContracts[4]!.companionStateOverride = authoredOverride(
    'blended_moonlit_teal',
  );
  return value;
}

function errors(value: BookVisualContractTemplate): string[] {
  const result = validateBookVisualContract(value);
  return result.ok ? [] : result.errors;
}

describe('closed companion appearance-state authority', () => {
  it('validates the complete frozen Kim vocabulary and returns defensive authoring copies', () => {
    expect(
      companionAppearanceStateAuthorityIssues(
        CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
        'companion:chameleon_koko',
      ),
    ).toEqual([]);
    expect(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY.states.map((state) => [
        state.continuityIndex,
        state.continuityRole,
      ]),
    ).toEqual([
      [0, 'baseline'],
      [1, 'transition'],
      [2, 'mismatched'],
      [3, 'transition'],
      [4, 'resolved'],
    ]);

    const first = declaredCompanionAppearanceStateAuthority(
      'companion:chameleon_koko',
    );
    const second = declaredCompanionAppearanceStateAuthority('chameleon-koko');
    expect(first).toEqual(CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY);
    expect(second).toEqual(first);
    first!.states[0]!.hue = 'mutated caller copy';
    expect(second!.states[0]!.hue).not.toBe('mutated caller copy');
    expect(declaredCompanionAppearanceStateAuthority('unknown')).toBeNull();
  });

  it('resolves a gradual authored arc, carries it forward, and projects exact typed prompt facts', () => {
    const value = validStateArc();
    const validation = validateBookVisualContract(value);
    expect(validation.ok, validation.ok ? '' : validation.errors.join('\n')).toBe(
      true,
    );

    const resolved = materialize(value, FAMILY);
    const pages = derivePageVisualContracts(resolved);
    expect(pages.map((page) => page.resolvedCompanionState?.id)).toEqual([
      'settled_warm_green',
      'alert_olive_shift',
      'mismatched_amber_stripes',
      'attuning_blue_green',
      'blended_moonlit_teal',
      'blended_moonlit_teal',
      'blended_moonlit_teal',
      'blended_moonlit_teal',
    ]);

    const facts = buildPvbVisualContractFactsPromptBlock(pages[2]!, resolved);
    expect(facts).toContain(
      'COMPANION APPEARANCE STATE (typed; sole hue/pattern/body-language authority)',
    );
    expect(facts).toContain('mismatched_amber_stripes');
    expect(facts).toContain('clear sharper stress stripes');
    expect(facts).toContain('tiny warm-mustard fabric shoulder satchel');

    const stateLock = buildStyle01CompanionTextLock({
      companionId: 'companion:chameleon_koko',
      companionName: 'Kim',
      companionVisualDescription:
        'LEGACY_FIXED_GREEN_DESCRIPTION_MUST_NOT_WIN',
      resolvedCompanionState: pages[2]!.resolvedCompanionState,
    });
    expect(stateLock).toContain('stateId=mismatched_amber_stripes');
    expect(stateLock).toContain('warm-mustard fabric shoulder satchel');
    expect(stateLock).not.toContain('LEGACY_FIXED_GREEN_DESCRIPTION_MUST_NOT_WIN');
  });

  it('carries state through an absent page and restores it when the same companion returns', () => {
    const value = statefulTemplate();
    value.pageContracts[0]!.companionStateOverride = authoredOverride(
      'alert_olive_shift',
    );
    value.pageContracts[1]!.characterPresence.companion = false;
    value.pageContracts[1]!.castIds = value.pageContracts[1]!.castIds?.filter(
      (castId) => castId !== 'companion:chameleon_koko',
    );
    const validation = validateBookVisualContract(value);
    expect(validation.ok, validation.ok ? '' : validation.errors.join('\n')).toBe(
      true,
    );

    const pages = derivePageVisualContracts(materialize(value, FAMILY));
    expect(pages[0]!.resolvedCompanionState?.id).toBe('alert_olive_shift');
    expect(pages[1]!.resolvedCompanionState).toBeUndefined();
    expect(pages[2]!.resolvedCompanionState?.id).toBe('alert_olive_shift');
  });

  it('fails closed on no-ops, non-adjacent jumps, undeclared states, absence, and missing authority', () => {
    const noOp = statefulTemplate();
    noOp.pageContracts[0]!.companionStateOverride = authoredOverride(
      'settled_warm_green',
    );
    expect(errors(noOp)).toContain(
      'page 1.companionStateOverride is a no-op — omit it when the resolved companion state is unchanged',
    );

    const jump = statefulTemplate();
    jump.pageContracts[0]!.companionStateOverride = authoredOverride(
      'mismatched_amber_stripes',
    );
    expect(errors(jump).some((entry) => entry.includes('adjacent authored transitions may move at most one continuity step'))).toBe(true);

    const unknown = statefulTemplate();
    unknown.pageContracts[0]!.companionStateOverride = authoredOverride(
      'invented_random_colour',
    );
    expect(errors(unknown).some((entry) => entry.includes('is not declared by the frozen companion authority'))).toBe(true);

    const absent = statefulTemplate();
    absent.pageContracts[0]!.characterPresence.companion = false;
    absent.pageContracts[0]!.castIds = absent.pageContracts[0]!.castIds?.filter(
      (castId) => castId !== 'companion:chameleon_koko',
    );
    absent.pageContracts[0]!.companionStateOverride = authoredOverride(
      'alert_olive_shift',
    );
    expect(errors(absent)).toContain(
      'page 1.companionStateOverride requires the companion to be present on the page',
    );

    const missingAuthority = template();
    missingAuthority.pageContracts[0]!.companionStateOverride = authoredOverride(
      'alert_olive_shift',
    );
    expect(errors(missingAuthority)).toContain(
      'page 1.companionStateOverride requires cast.companion.companionAppearanceStateAuthority',
    );
  });

  it('rejects malformed frozen authority and resolved-state identity mismatch', () => {
    const malformed = statefulTemplate();
    malformed.cast.companion!.companionAppearanceStateAuthority = {
      ...structuredClone(CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY),
      companionId: 'dragon_dini',
    };
    expect(errors(malformed).some((entry) => entry.includes('companionId does not match cast companion'))).toBe(true);

    const state = resolveCompanionAppearanceState(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
      'alert_olive_shift',
    );
    expect(state).not.toBeNull();
    expect(() =>
      buildStyle01CompanionTextLock({
        companionId: 'dragon_dini',
        companionName: 'Dini',
        resolvedCompanionState: state!,
      }),
    ).toThrow(
      'resolved companion appearance state does not match the requested companion identity',
    );
  });

  it('fails closed when a declared vocabulary is not canonical, ordered, gradual, mismatched, and resolved', () => {
    const withoutMismatch = structuredClone(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
    );
    withoutMismatch.states[2]!.continuityRole = 'transition';
    expect(companionAppearanceStateAuthorityIssues(withoutMismatch)).toContain(
      'companion appearance-state authority must contain a mismatched state',
    );

    const unordered = structuredClone(CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY);
    [unordered.states[1], unordered.states[2]] = [
      unordered.states[2]!,
      unordered.states[1]!,
    ];
    expect(companionAppearanceStateAuthorityIssues(unordered)).toContain(
      'companion appearance-state states must be ordered by continuityIndex',
    );

    const nonCanonical = structuredClone(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
    );
    nonCanonical.states[1]!.id = 'Alert Olive';
    expect(companionAppearanceStateAuthorityIssues(nonCanonical)).toContain(
      'companion appearance-state authority states[1].id must be a canonical lowercase underscore id',
    );

    const noTransition = structuredClone(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
    );
    noTransition.states[1]!.continuityRole = 'mismatched';
    noTransition.states[3]!.continuityRole = 'mismatched';
    expect(companionAppearanceStateAuthorityIssues(noTransition)).toContain(
      'companion appearance-state authority must contain a transition state',
    );

    const unresolvedEnd = structuredClone(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
    );
    unresolvedEnd.states[4]!.continuityRole = 'transition';
    expect(companionAppearanceStateAuthorityIssues(unresolvedEnd)).toEqual(
      expect.arrayContaining([
        'companion appearance-state authority must contain exactly one resolved state',
        'companion appearance-state highest continuity state must be resolved',
      ]),
    );
  });

  it('rejects companion-scoped loose appearance prose without banning world colours or substring lookalikes', () => {
    const conflict = statefulTemplate();
    conflict.pageContracts[0]!.mustShow.push('Kim turns blue-green under the lamp.');
    expect(errors(conflict).some((entry) => entry.includes('typed companion state is the sole appearance authority'))).toBe(true);

    const absentButNamed = statefulTemplate();
    absentButNamed.pageContracts[0]!.characterPresence.companion = false;
    absentButNamed.pageContracts[0]!.castIds =
      absentButNamed.pageContracts[0]!.castIds?.filter(
        (castId) => castId !== 'companion:chameleon_koko',
      );
    absentButNamed.pageContracts[0]!.mustShow.push(
      'Kim turns blue-green outside the frame.',
    );
    expect(
      errors(absentButNamed).some((entry) =>
        entry.includes('typed companion state is the sole appearance authority'),
      ),
    ).toBe(true);

    const safe = statefulTemplate();
    safe.pageContracts[0]!.mustShow.push(
      'A blue-green painted wall remains part of the stable set.',
      'Skimming light crosses a green blanket without naming the companion.',
    );
    const validation = validateBookVisualContract(safe);
    expect(validation.ok, validation.ok ? '' : validation.errors.join('\n')).toBe(
      true,
    );
    expect(
      companionAppearanceProseConflicts({
        authority: CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
        texts: ['Skimming light crosses a green blanket.'],
      }),
    ).toEqual([]);

    const hebrewAndEnglishEscapes = [
      'קים לירוק',
      'קים בירוק',
      'קים וירוק',
      'קים מירוק',
      'קים הירוק',
      'קים והירוק',
      'לקים ירוק',
      'לְקִים יָרֹק',
      'קִים נִשְׁאַרָה בְּיָרֹק רַךְ הַיּוֹם',
      'Kim turns greenish.',
      'Kim goes olive.',
      "Kim's stripes sharpen.",
    ];
    for (const text of hebrewAndEnglishEscapes) {
      expect(
        companionAppearanceProseConflicts({
          authority: CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
          texts: [text],
        }),
        text,
      ).not.toEqual([]);
    }

    for (const text of [
      'Kim stands by the greenhouse.',
      'Kim watches evergreen branches.',
      'קים אכלה ירק.',
      'בר מקים אוהל ירוק.',
    ]) {
      expect(
        companionAppearanceProseConflicts({
          authority: CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
          texts: [text],
        }),
        text,
      ).toEqual([]);
    }

    const stateIdReservedAutomatically = structuredClone(
      CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
    );
    stateIdReservedAutomatically.reservedAppearanceTerms =
      stateIdReservedAutomatically.reservedAppearanceTerms.filter(
        (term) => term !== 'alert_olive_shift',
      );
    expect(
      companionAppearanceProseConflicts({
        authority: stateIdReservedAutomatically,
        texts: ['Kim must look alert_olive_shift.'],
      }),
    ).toEqual(
      expect.arrayContaining([
        { textIndex: 0, alias: 'Kim', term: 'alert_olive_shift' },
      ]),
    );
  });

  it('verifies story-evidence origins against the exact same-page source text', () => {
    const value = statefulTemplate();
    value.pageContracts[1]!.companionStateOverride = {
      stateId: 'alert_olive_shift',
      origin: {
        kind: 'story_evidence',
        page: 2,
        phrase: 'קים הדקה את זנבה',
      },
    };
    const resolved = materialize(value, FAMILY);
    expect(
      sourceEvidenceValidation(resolved, [
        { pageNumber: 2, text: 'קִים הִדְּקָה אֶת זְנָבָהּ והביטה סביב.' },
      ]).errors,
    ).toEqual([]);
    expect(
      sourceEvidenceValidation(resolved, [
        { pageNumber: 2, text: 'קים הביטה סביב.' },
      ]).errors.some((entry) => entry.includes('does not occur on page 2')),
    ).toBe(true);
  });

  it('preserves legacy contracts byte-semantically when no state authority is declared', () => {
    const legacy = template();
    const validation = validateBookVisualContract(legacy);
    expect(validation.ok, validation.ok ? '' : validation.errors.join('\n')).toBe(
      true,
    );
    const pages = derivePageVisualContracts(materialize(legacy, FAMILY));
    expect(pages.every((page) => page.resolvedCompanionState === undefined)).toBe(
      true,
    );
  });
});
