/**
 * WS0c — bunny_ometz_adventure.visual-contract.json AUTHORING SPEC (no render, no LLM).
 *
 * This is a REAL guard on the shipped bank artifact, not just "it validates". It loads the actual
 * `story-bank/v3-approved/bunny_ometz_adventure.visual-contract.json` through the production loader
 * (`loadVisualContractArtifact`) and asserts, one by one, that the artifact encodes the four book
 * defects it exists to prevent, plus the two authoring decisions Guy approved:
 *
 *   1. Page 12 (the sunny exit) sits in a NEUTRAL-environmentClass location → ZERO style refs (leak-safe);
 *      "outside" is carried by description + a global nature ban (trees / creek / park / grass / bridge).
 *   2. The doctor is text-evidenced MALE (the page-4 "הַדֶּלֶת נִפְתְּחָה. הָרוֹפֵא קָרָא" line), with a
 *      forbidden list that blocks role / gender flips — and the frozen gender + guards reach the render
 *      channel (contractPageSupportingCharacters).
 *   3. Every human cast member (mother + doctor) locks build + hair length/STYLE + wardrobe, and DEFERS
 *      skin tone AND hair colour to the per-order Family Appearance Lock as a coherence requirement
 *      ("must match the child's family lock") — never a hardcoded value.
 *   4. Buni is anchored to the child's height (25–35%), cream-white, with a heart badge and long ears.
 *   5. The cover mustNotShow the injection (p10), the bandage (p11), the trembling/brave beat (p8), and
 *      the sunny exit (p12) — no spoiler.
 *   6. The artifact passes assertValidVNextVisualContract (incl. the C2 first-page guard + Rule 3b
 *      transition sequencing) and loads fail-closed; each structural guard is proven to REJECT a tamper.
 *
 * If a future edit weakens any lock, this spec (and therefore `npm run check`) fails.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  loadVisualContractArtifact,
  validateVNextVisualContract,
  assertValidVNextVisualContract,
  InvalidVNextVisualContractError,
  contractPageEnvironmentClass,
  contractPageSupportingCharacters,
  computeVisualContractHash,
  type BookVisualContract,
  type RecurringHumanCastMember,
} from '@/lib/visual-contract-compiler';

const ARTIFACT_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'bunny_ometz_adventure';

/** JSON deep clone (the artifact is JSON-safe) — for tamper/mutation guard tests. */
function clone(c: BookVisualContract): BookVisualContract {
  return JSON.parse(JSON.stringify(c)) as BookVisualContract;
}

// Load ONCE through the real production loader (fail-closed: a missing/invalid artifact throws here).
const { contract, contractHash } = loadVisualContractArtifact(ARTIFACT_DIR, STORY_KEY);

const doctor = (contract.humanCast ?? []).find((m) => m.id === 'human:doctor') as RecurringHumanCastMember;
const mother = (contract.humanCast ?? []).find((m) => m.id === 'human:mother') as RecurringHumanCastMember;

describe('bunny_ometz_adventure — loads + passes the vNext validator (criterion 6)', () => {
  it('loads through loadVisualContractArtifact with a stable, non-empty hash', () => {
    expect(contract.storyKey).toBe(STORY_KEY);
    expect(contractHash).toMatch(/^[a-f0-9]{16,}$/);
    expect(contractHash).toBe(computeVisualContractHash(contract));
  });

  it('passes assertValidVNextVisualContract (structural, cast, transition, coverage)', () => {
    expect(() => assertValidVNextVisualContract(contract)).not.toThrow();
    expect(validateVNextVisualContract(contract).ok).toBe(true);
  });

  it('covers EXACTLY the 12 book pages, once each', () => {
    const nums = contract.pageContracts.map((p) => p.pageNumber).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('declares both human cast members (doctor + mother)', () => {
    expect(doctor).toBeTruthy();
    expect(mother).toBeTruthy();
  });
});

describe('criterion 1 — page 12 is NEUTRAL (zero style refs) + nature banned globally', () => {
  it('pages 1–11 lock indoor; page 12 locks neutral → zero style refs on the sunny exit', () => {
    for (let p = 1; p <= 11; p++) {
      expect(contractPageEnvironmentClass(contract, p)).toBe('indoor');
    }
    expect(contractPageEnvironmentClass(contract, 12)).toBe('neutral');
  });

  it("page 12's location itself carries environmentClass=neutral", () => {
    const p12 = contract.pageContracts.find((p) => p.pageNumber === 12)!;
    const loc = contract.locations.find((l) => l.id === p12.locationId)!;
    expect(loc.environmentClass).toBe('neutral');
  });

  it('"outside" is carried by page-12 description (not by an outdoor class)', () => {
    const p12 = contract.pageContracts.find((p) => p.pageNumber === 12)!;
    const show = p12.mustShow.join(' ');
    expect(show).toMatch(/outside/i);
    expect(show).toMatch(/sun/i);
  });

  it('nature is banned globally: trees / grass / park / creek / bridge', () => {
    const banned = contract.forbiddenGlobalElements.map((s) => s.toLowerCase());
    expect(banned).toContain('trees');
    expect(banned).toContain('grass');
    expect(banned.some((s) => /\bpark\b/.test(s))).toBe(true);
    expect(banned.some((s) => /creek|stream/.test(s))).toBe(true);
    expect(banned.some((s) => /bridge/.test(s))).toBe(true);
  });

  it('page 12 re-bans nature at the page level too (belt-and-suspenders)', () => {
    const p12 = contract.pageContracts.find((p) => p.pageNumber === 12)!;
    expect(p12.mustNotShow.join(' ')).toMatch(/trees|nature/i);
  });

  it('GUARD: dropping the neutral environmentClass fails closed', () => {
    const bad = clone(contract);
    const loc = bad.locations.find((l) => l.id === 'clinic_exterior')!;
    delete (loc as { environmentClass?: string }).environmentClass;
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/missing environmentClass/);
  });
});

describe('criterion 2 — the doctor is text-evidenced MALE with role/gender-flip guards', () => {
  it('gender is male, bound to the page-4 "הָרוֹפֵא" text evidence', () => {
    expect(doctor.gender).toBe('male');
    expect(doctor.textEvidence).toMatch(/הָרוֹפֵא|הרופא/);
    expect(doctor.textEvidence).toMatch(/הַדֶּלֶת נִפְתְּחָה|נפתחה/);
  });

  it('forbiddenAppearance blocks a GENDER flip (doctor rendered female)', () => {
    expect(doctor.forbiddenAppearance.join(' ')).toMatch(/woman|female/i);
  });

  it('forbiddenAppearance blocks a ROLE flip (nurse / parent / non-doctor)', () => {
    expect(doctor.forbiddenAppearance.join(' ')).toMatch(/nurse|receptionist|parent|role other than/i);
  });

  it('the frozen gender + guards actually reach the render channel on page 4', () => {
    const supporting = contractPageSupportingCharacters(contract, 4);
    const doc = supporting.find((c) => c.relationship === 'doctor')!;
    expect(doc).toBeTruthy();
    expect(doc.description).toMatch(/male doctor/i);
    expect(doc.description).toMatch(/must never appear/i);
    expect(doc.description).toMatch(/woman|female/i);
  });
});

describe('criterion 3 — mother + doctor: build/hair/wardrobe locked; skin tone + hair colour DEFERRED', () => {
  // A concrete skin-tone / hair-colour VALUE the artifact must never hardcode (positive controls prove the
  // regexes below are not vacuous).
  const HARDCODED_HAIR_COLOUR = /\b(brown|black|blonde|blond|brunette|ginger|auburn|red|redhead|grey|gray|silver)[- ]?hair(ed)?\b/i;
  const HARDCODED_SKIN_TONE = /\b(dark|fair|olive|pale|tan|tanned|brown|light|medium|ebony|bronze)[- ]?(skin|complexion)(ed)?\b/i;

  it('the hardcoded-value regexes are real (positive controls)', () => {
    expect('brown hair').toMatch(HARDCODED_HAIR_COLOUR);
    expect('dark skin').toMatch(HARDCODED_SKIN_TONE);
    expect('olive complexion').toMatch(HARDCODED_SKIN_TONE);
  });

  for (const who of ['doctor', 'mother'] as const) {
    it(`${who}: build + hair length/style + wardrobe are locked`, () => {
      const m = who === 'doctor' ? doctor : mother;
      expect(m.coarseAppearance).toMatch(/build/i);
      expect(m.coarseAppearance).toMatch(/hair length and style/i);
      expect(m.wardrobe.description.trim().length).toBeGreaterThan(0);
    });

    it(`${who}: skin tone + hair colour are DEFERRED to the per-order Family Appearance Lock (a requirement, not a value)`, () => {
      const m = who === 'doctor' ? doctor : mother;
      expect(m.coarseAppearance).toMatch(/deferred/i);
      expect(m.coarseAppearance).toMatch(/per-order/i);
      expect(m.coarseAppearance).toMatch(/family lock/i);
      // ...and NOT a hardcoded skin-tone / hair-colour value.
      expect(m.coarseAppearance).not.toMatch(HARDCODED_HAIR_COLOUR);
      expect(m.coarseAppearance).not.toMatch(HARDCODED_SKIN_TONE);
    });
  }
});

describe('criterion 4 — Buni: size anchored to the child, cream-white, heart badge, long ears', () => {
  const buni = contract.cast.companion!;

  it('is cream-white with a heart-shaped chest badge and long floppy ears', () => {
    const d = buni.wardrobe.description;
    expect(d).toMatch(/cream[- ]?white/i);
    expect(d).toMatch(/heart[- ]?shaped/i);
    expect(d).toMatch(/badge/i);
    expect(d).toMatch(/long/i);
    expect(d).toMatch(/floppy ears/i);
  });

  it('is size-anchored to the child (25–35% of height; never waist-high)', () => {
    const d = buni.wardrobe.description;
    expect(d).toMatch(/25/);
    expect(d).toMatch(/35/);
    expect(d).toMatch(/height/i);
    expect(d).toMatch(/never waist-high/i);
  });

  it('forbids a star badge and any second accessory (drift guards)', () => {
    const forbidden = (buni.wardrobe.forbidden ?? []).join(' ');
    expect(forbidden).toMatch(/star/i);
    expect(forbidden).toMatch(/scarf|cape|bow|hat|necklace|glasses|backpack|held toy/i);
  });
});

describe('criterion 5 — the cover is no-spoiler', () => {
  const mustNotShow = contract.coverContract.mustNotShow.join(' ');

  it('hides the injection (page 10)', () => {
    expect(mustNotShow).toMatch(/inject|syringe|needle/i);
    expect(mustNotShow).toMatch(/page-10/);
  });
  it('hides the bandage (page 11)', () => {
    expect(mustNotShow).toMatch(/bandage/i);
    expect(mustNotShow).toMatch(/page-11/);
  });
  it('hides the trembling / brave realization (page 8)', () => {
    expect(mustNotShow).toMatch(/tremb/i);
    expect(mustNotShow).toMatch(/page-8/);
  });
  it('hides the sunny exit (page 12)', () => {
    expect(mustNotShow).toMatch(/outside|sunny/i);
    expect(mustNotShow).toMatch(/page-12/);
  });
  it('also keeps the cover out of the exam room and away from nature', () => {
    expect(mustNotShow).toMatch(/exam/i);
    expect(mustNotShow).toMatch(/trees|nature/i);
  });
});

describe('criterion 6 — Rule 3b sequencing + the C2 first-page guard are REAL (tampers fail closed)', () => {
  it('an undeclared scene move (exam page turned "steady" after the waiting room) is rejected (Rule 3b)', () => {
    const bad = clone(contract);
    // Page 5 legitimately arrives in the exam room via after_transition. Strip it → page 5 "steady" in the
    // exam room right after page 4 (still waiting room) = a teleport with no declared move.
    bad.pageContracts[4].transition = { kind: 'steady' };
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/undeclared scene move/);
  });

  it('a non-steady OPENING page is rejected (C2 — nothing precedes page 1 to depart from)', () => {
    const bad = clone(contract);
    bad.pageContracts[0].transition = {
      kind: 'threshold',
      fromZoneId: 'clinic.waiting_room',
      toZoneId: 'clinic.exam_room',
      cue: 'the door opens',
    };
    const r = validateVNextVisualContract(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/opening page must be steady or before_transition/);
  });

  it('assertValidVNextVisualContract throws InvalidVNextVisualContractError on a tampered contract', () => {
    const bad = clone(contract);
    delete (bad.pageContracts[7] as { castIds?: string[] }).castIds; // page 8 loses its cast declaration
    expect(() => assertValidVNextVisualContract(bad)).toThrow(InvalidVNextVisualContractError);
  });
});
